const { parts, key } = require('../miniprogram/utils/speechText')
const { loadWords } = require('../miniprogram/utils/wordCatalog')
const readings = require('../miniprogram/data/readings')
const { ANIMALS } = require('../miniprogram/utils/wildlife')
const { papers } = require('../miniprogram/data/papers')
const texts = []
for (const w of loadWords('classic')) texts.push(w.w, w.ex, w.exZh, w.mean)
for (const r of readings) {
  texts.push(r.title, r.question, ...r.choices, r.explanation)
  r.paragraphs.forEach(p => texts.push(p.en, p.zh))
  r.words.forEach(w => texts.push(w.w, w.mean))
}
ANIMALS.forEach(a => texts.push(a.word, a.sentence))
papers.forEach(paper => texts.push(paper.title))
texts.push('Image Quality Papers')
texts.push('Walking English', 'Stories Along the Way', 'Take Your Time', 'A Little Every Day',
  'Wonder a Little Further', 'Your Own Little Journey', 'Rest. Meet. Keep Going.', 'People on Your Path',
  'noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'pronoun', 'interjection', 'phrase')
const unique = new Map()
texts.flatMap(parts).forEach(text => unique.set(key(text), text))
module.exports = [...unique].map(([id, text]) => ({ id, text }))
