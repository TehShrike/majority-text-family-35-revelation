
const english = require('revelation')
const currentGreek = require('./revelation.json')

function findParagraphBreaks(memo, structure) {
	const { match: nextParagraphBreak, rest: restOfStructure } = takeUntil(structure, chunk => chunk.type === 'paragraph break')

	if (nextParagraphBreak === null) {
		return memo
	}

	const { match: nextVerse, rest } = takeUntil(restOfStructure, chunk => chunk.type === 'verse')

	if (nextVerse === null) {
		return memo
	}

	return findParagraphBreaks([...memo, nextVerse], rest)
}

function takeUntil(ary, fn) {
	if (ary.length === 0) {
		return { match: null, rest: ary }
	}

	const [ head, ...tail ] = ary
	if (fn(head)) {
		return { match: head, rest: tail }
	} else {
		return takeUntil(tail, fn)
	}
}

const paragraphBreak = {
	type: 'paragraph break'
}

function applyParagraphBreaksBefore(paragraphBreakVerses, verses) {
	let currentParagraphBreak = paragraphBreakVerses.shift()
	return flatMap(verses, verse => {
		if (currentParagraphBreak && sameVerseSection(currentParagraphBreak, verse)) {
			currentParagraphBreak = paragraphBreakVerses.shift()
			return [ paragraphBreak, verse ]
		} else {
			return [ verse ]
		}
	})
}

function flatMap(ary, fn) {
	return ary.reduce((memo, current) => [ ...memo, ...fn(current) ], [])
}

function sameVerseSection(a, b) {
	return a.type === 'verse' && b.type === 'verse'
		&& a.chapterNumber === b.chapterNumber
		&& a.verseNumber === b.verseNumber
		&& a.sectionNumber === b.sectionNumber
}

const breaks = findParagraphBreaks([], english)

const output = applyParagraphBreaksBefore(breaks, currentGreek.filter(({ type }) => type !== 'paragraph break'))
// console.log(JSON.stringify(output, null, '\t'))

// writeJson(output)


function writeJson(structure) {
	require('fs').writeFileSync('./revelation.json', JSON.stringify(structure, null, '\t'))
}
