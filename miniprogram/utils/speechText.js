// Shared by the offline audio builder and the player. Read English in mixed text.
function english(text) {
  return (String(text || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .match(/[A-Za-z][A-Za-z0-9 \t\r\n'",.!?:;()\-]*/g) || [])
    .map(s => s.trim()).filter(Boolean).join('. ').replace(/\s+/g, ' ').trim()
}
function parts(text) {
  const result = []
  for (const sentence of english(text).match(/[^.!?]+[.!?]*/g) || []) {
    let chunk = ''
    for (const word of sentence.trim().split(/\s+/)) {
      if (chunk && chunk.length + word.length + 1 > 400) { result.push(chunk); chunk = '' }
      chunk += (chunk ? ' ' : '') + word
    }
    if (chunk) result.push(chunk)
  }
  return result
}
function key(text) { return english(text).toLowerCase().replace(/[.!?]+$/, '').trim() }
module.exports = { english, parts, key }
