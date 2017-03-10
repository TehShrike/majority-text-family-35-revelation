const walk = require('walkdir')
const fs = require('fs')
const cheerio = require('cheerio')
const denodeify = require('then-denodeify')

const readFile = denodeify(fs.readFile)

const startAt = './html/'
// const fileStream = Bacon.fromNodeCallback(fs.readFile, './html/page2.html', { encoding: 'utf8' })

const pathNumberParser = /^.+\/page(\d+)\.html$/
const integerOnlyRegex = /^\d+\s*$/

const walkEmitter = walk(startAt)
const paths = []
walkEmitter.on('file', path => paths.push(path))
walkEmitter.on('end', async () => {
	const orderedPaths = paths
	// .filter(path => /.*page3.html/.test(path))
	.filter(path => pathNumberParser.test(path)).map(path => {
		return {
			path: path,
			number: parseInt(pathNumberParser.exec(path)[1])
		}
	}).sort((a, b) => a.number - b.number)
	.map(o => o.path)

	const fileContentsPromises = orderedPaths.map(async path => {
		const contents = await readFile(path, { encoding: 'utf8' })
		return { path, contents }
	})

	const fileContents = await Promise.all(fileContentsPromises)

	const parsedOutput = fileContents.map(({ path, contents }) => {
		try {
			return convertHtmlToParsedVerses(contents)
		} catch (e) {
			console.error('error when parsing', path)
			throw e
		}
	}).reduce((ary, parsed) => ary.concat(parsed), []).filter(chunk => {
		return chunk.type === 'verse'
			|| chunk.type === 'paragraph break'
			|| chunk.type === 'verse number'
			|| chunk.type === 'chapter number'
			|| chunk.type === 'line break'
			|| chunk.type === 'note reference'
	}).filter(duplicateLineBreaksFilter())

	fs.writeFileSync('./very-basic-parsed.json', JSON.stringify(parsedOutput, null, '\t'))
})

function duplicateLineBreaksFilter() {
	let lastChunkWasLineBreak = false
	return function filter(chunk) {
		const thisChunkIsLineBreak = chunk.type === 'line break'
		const filterThisChunkOut = thisChunkIsLineBreak && lastChunkWasLineBreak

		lastChunkWasLineBreak = thisChunkIsLineBreak

		return !filterThisChunkOut
	}
}

function convertHtmlToParsedVerses(html) {
	const $ = cheerio.load(html)
	const selectorIsBold = makeBoldDetector(html)

	const elements = []

	$('body').children('div').each((i, div) => {
		div = $(div)
		const left = parseInt(div.css('left'))
		const top = parseInt(div.css('top'))
		const pageHeader = top < 90
		const prettyOffset = left > 153
		const singleIndent = left === 153
		let foundAParagraphAlready = false

		div.children('span').each((i, span) => {
			span = $(span)
			const boldNormal = selectorIsBold(span.attr('id'))
			let text = span.text()
			const size = parseInt(span.css('font-size'))
			const verticalAlign = span.css('vertical-align')

			let type = 'UNKNOWN'

			if (size === 19 && integerOnlyRegex.test(text)) {
				type = 'chapter number'
			} else if (prettyOffset) {
				type = 'header'
			} else {
				if (singleIndent && !foundAParagraphAlready) {
					foundAParagraphAlready = true
					elements.push({
						type: 'paragraph break'
					})
				}

				const weirdParentheses = boldNormal && (text === '(' || text === ')')

				const greekText = size === 12
				const punctuation = size === 9
				if (pageHeader) {
					type = 'page header'
				} else if ((greekText || punctuation) && !weirdParentheses) {
					type = 'verse'
				} else if (size === 7 && verticalAlign === 'super') {
					type = 'verse number'
				} else if (size === 5 && verticalAlign === 'super') {
					type = 'note reference'
				} else if (size === 4 || size === 6 || size === 7 || size === 8) {
					type = 'note'
				}
			}

			elements.push({
				type,
				text
			})
		})

		elements.push({
			type: 'line break'
		})
	})

	return elements
}

function makeBoldDetector(html) {
	const boldNormalSelectorRegex = /\#(f\d) \{ font-family:sans-serif; font-weight:bold; font-style:normal/g
	const map = Object.create(null)

	let match
	while (match = boldNormalSelectorRegex.exec(html)) { // eslint-disable-line no-cond-assign
		const selector = match[1]
		map[selector] = true
	}

	return function selectorIsBold(selector) {
		return !!map[selector]
	}
}
