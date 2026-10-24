const { CITIES, getSelectedCity, setSelectedCity } = require('../../utils/cityCatalog.js')
const { getRouteMountains, getBook } = require('../../utils/wordCatalog.js')
const storage = require('../../utils/storage.js')
Page({
  data: { cities: CITIES, mountains: [], city: CITIES[0] },
  onShow() {
    const city = getSelectedCity(), bookId = storage.getSelectedBook(), p = storage.getProgress(bookId)
    const mountains = getRouteMountains(bookId, city.id).map((m) => {
      const learned = Math.min(p.mountains[m.id].learnedCount, m.totalWords)
      return Object.assign({}, m, { learned, pct: Math.round(learned / m.totalWords * 100), done: learned >= m.totalWords, chapter: String(m.routeIndex + 1).padStart(2, '0') })
    })
    this.setData({ city, mountains, bookId, book: getBook(bookId), completed: mountains.filter((m) => m.done).length })
  },
  selectCity(e) { if (setSelectedCity(e.currentTarget.dataset.id)) this.onShow() },
  enterTrail(e) { wx.navigateTo({ url: '/pages/trail/trail?id=' + e.currentTarget.dataset.id + '&book=' + this.data.bookId }) }
})
