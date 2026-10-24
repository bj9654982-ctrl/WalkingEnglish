const { MOUNTAINS } = require('./trailData.js')
const { getMountain, getCityMountains } = require('./cityCatalog.js')
const wordMap = {
  easy: require('../data/words/easy.js'),
  cet4: require('../data/words/cet4.js'),
  cet6: require('../data/words/cet6.js'),
  kaoyan: require('../data/words/kaoyan.js')
}
const BOOKS = [
  { id: 'easy', name: '日常英语', description: '从身边的事物开始', count: 85 },
  { id: 'cet4', name: '四级词汇', description: '专注同一个考试目标', count: 100 },
  { id: 'cet6', name: '六级词汇', description: '进阶表达，一路积累', count: 115 },
  { id: 'kaoyan', name: '考研词汇', description: '把长目标拆成小段', count: 70 },
  { id: 'classic', name: '经典混合', description: '保留原来的七山旅程', count: 370 }
]
function getBook(id) { return BOOKS.find((book) => book.id === id) || null }
function loadWords(level) { return level === 'classic' ? Object.values(wordMap).reduce((all, words) => all.concat(words), []) : (wordMap[level] || []) }

function getMountainWords(mountainId, bookId = 'classic') {
  const mountain = getMountain(mountainId)
  if (!mountain || !getBook(bookId)) return []
  if (bookId !== 'classic' || mountain.cityId !== 'wuhan') {
    const words = loadWords(bookId)
    const size = getCityMountains(mountain.cityId).length
    const start = Math.floor(mountain.routeIndex * words.length / size)
    const end = Math.floor((mountain.routeIndex + 1) * words.length / size)
    return words.slice(start, end)
  }
  const offset = MOUNTAINS.slice(0, mountain.id)
    .filter((m) => m.level === mountain.level)
    .reduce((sum, m) => sum + m.totalWords, 0)
  return loadWords(mountain.level).slice(offset, offset + mountain.totalWords)
}

function getRouteMountain(id, bookId) {
  const mountain = getMountain(id), book = getBook(bookId)
  if (!mountain || !book) return null
  return Object.assign({}, mountain, {
    level: bookId === 'classic' ? mountain.level : bookId,
    levelName: book.name + ' · 第' + (mountain.routeIndex + 1) + '段',
    totalWords: getMountainWords(id, bookId).length
  })
}
function getRouteMountains(bookId, cityId = 'wuhan') { return getCityMountains(cityId).map((m) => getRouteMountain(m.id, bookId)) }
module.exports = { BOOKS, getBook, loadWords, getMountainWords, getRouteMountain, getRouteMountains }
