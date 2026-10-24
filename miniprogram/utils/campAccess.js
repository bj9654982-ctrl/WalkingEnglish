const { getRouteMountain } = require('./wordCatalog.js')
const STOPS = [0.25, 0.55, 0.85]
function requiredWords(mountainId, bookId, campIndex) {
  const m = getRouteMountain(mountainId, bookId)
  return m && Number.isInteger(campIndex) && STOPS[campIndex] ? Math.ceil(m.totalWords * STOPS[campIndex]) : Infinity
}
function isReached(mountainId, bookId, campIndex, learned) { return learned >= requiredWords(mountainId, bookId, campIndex) }
module.exports = { STOPS, requiredWords, isReached }
