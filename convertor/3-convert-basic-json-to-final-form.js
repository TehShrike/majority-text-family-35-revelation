const fs = require('fs')

const input = require('../very-basic-parsed.json')

write('revelation', process(input))

function process(basic) {
	// no trimming
	// if there's a note reference between verse chunks, add a space
	// if there's a line break between verse chunks, add a space

	// "between verses" = no chapter numbers or paragraph breaks before the next verse chunk

	let currentChapter = 1
	let currentVerse = 1
	let currentSection = 1

	const output = []

	concatenateVerseChunks(basic).forEach(chunk => {
		if (chunk.type === 'chapter number') {
			currentChapter = parseInt(chunk.text.trim(), 10)
			currentVerse = 1
			currentSection = 1
		} else if (chunk.type === 'verse number') {
			currentVerse = parseInt(chunk.text.trim(), 10)
			currentSection = 1
		} else if (chunk.type === 'verse') {
			output.push({
				type: 'verse',
				chapterNumber: currentChapter,
				verseNumber: currentVerse,
				sectionNumber: currentSection,
				text: chunk.text
			})
			currentSection++
		} else if (chunk.type === 'paragraph break') {
			output.push(chunk)
		} else {
			throw new Error(`not handling chunk type ${chunk.type}`)
		}
	})

	return flatMap(output, splitVerseIfNecessary)
}

function concatenateVerseChunks(basic) {
	const output = []
	let currentVerseChunkText = ''

	function finishCurrentChunk() {
		if (currentVerseChunkText) {
			output.push({
				type: 'verse',
				text: currentVerseChunkText
			})
			currentVerseChunkText = ''
		}
	}

	specialForEach(basic, (chunk, tail) => {
		if (chunk.type === 'verse') {
			currentVerseChunkText += chunk.text
			if (nextChunkThatMattersNeedsAtLeastOneSpace(tail)) {
				currentVerseChunkText += ' '
			}
		} else if (chunk.type === 'chapter number' ||
				chunk.type === 'verse number' ||
				chunk.type === 'paragraph break') {
			finishCurrentChunk()
			output.push(chunk)
		}
	})
	finishCurrentChunk()

	return output
}


function specialForEach(array, fn) {
	array.forEach((element, index) => {
		fn(element, array.slice(index + 1))
	})
}

function needAtLeastOneSpace(nextChunk) {
	return nextChunk.type === 'chapter number'
		|| nextChunk.type === 'paragraph break'
		|| nextChunk.type === 'note reference'
		|| nextChunk.type === 'line break'
}

function nextChunkThatMattersNeedsAtLeastOneSpace(chunks) {
	if (chunks.length === 0) {
		return false
	}

	const [ chunk, ...tail ] = chunks

	const doesntCount = chunk.type === 'verse number'

	if (doesntCount) {
		return nextChunkThatMattersNeedsAtLeastOneSpace(tail)
	}

	return needAtLeastOneSpace(chunk.type)
}



function flatMap(ary, mapFn) {
	const output = []

	ary.forEach(item => {
		const mapResult = mapFn(item)
		if (Array.isArray(mapResult)) {
			mapResult.forEach(item => output.push(item))
		} else {
			output.push(mapResult)
		}
	})

	return output
}

function write(file, data) {
	fs.writeFileSync(`./${file}.json`, JSON.stringify(data, null, '\t'))
}

function splitVerseIfNecessary(verse) {
	if (verse.chapterNumber === 12 && verse.verseNumber === 17) {
		return chunk(verse, [
			'Καὶὠργίσθη ὁ δράκων ἐπὶ τῇ γυναικί καὶ ἀπῆλθεν ποιῆσαι πόλεµον µετὰ τῶνλοιπῶν τοῦ σπέρµατος αὐτῆς, ',
			'τῶν τηρούντων τὰς ἐντολὰς τοῦ Θεοῦ καὶἐχόντων τὴν µαρτυρίαν Ἰησοῦ.'
		])
	} else {
		return verse
	}
}

function chunk(verse, chunks) {
	return chunks.reduce((array, text) => {
		const chunk = Object.assign({}, verse, {
			text,
			sectionNumber: verse.sectionNumber + array.length
		})

		return [ ...array, chunk ]
	}, [])
}
