// Preserve original punctuation/spacing; only Latin words are interactive.
function normalize(value) {
  const word = String(value || '').trim().toLowerCase().replace(/’/g, "'")
  return /^[a-z]+(?:'[a-z]+)*$/.test(word) && word.length <= 60 ? word : ''
}
function tokenize(value) {
  const text = String(value || ''), pattern = /[A-Za-z]+(?:['’][A-Za-z]+)*/g, result = []
  let previous = 0, match
  while ((match = pattern.exec(text))) {
    if (match.index > previous) result.push({id:previous,text:text.slice(previous,match.index),word:''})
    result.push({id:match.index,text:match[0],word:normalize(match[0])})
    previous = pattern.lastIndex
  }
  if (previous < text.length) result.push({id:previous,text:text.slice(previous),word:''})
  return result
}
function context(value, offset) {
  const text=String(value||''), at=Math.max(0,Math.min(text.length,Number(offset)||0))
  const start=Math.max(0,at-130),end=Math.min(text.length,at+220)
  return (start?'…':'')+text.slice(start,end)+(end<text.length?'…':'')
}
function url(word, sentence='', source='') {
  return '/pages/lexicon/lexicon?word='+encodeURIComponent(normalize(word))+'&context='+encodeURIComponent(String(sentence).slice(0,400))+'&source='+encodeURIComponent(String(source).slice(0,160))
}
module.exports={normalize,tokenize,context,url}
