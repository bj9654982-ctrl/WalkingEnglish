const { BOOKS, getBook, getRouteMountains } = require('../../utils/wordCatalog.js')
const { getSelectedCity } = require('../../utils/cityCatalog.js')
const { describeDue } = require('../../utils/reviewSchedule.js')
const storage = require('../../utils/storage.js')
Page({
  data: { mountains: [], totalLearned: 0, doneCount: 0, totalWords: 0, overallPct: 0 },
  onShow() {
    const bookId = storage.getSelectedBook(), city = getSelectedCity(), progress = storage.getProgress(bookId)
    const memory = storage.getMemorySummary(bookId)
    const list = getRouteMountains(bookId, city.id).map((m) => {
      const mp = progress.mountains[m.id], count = Math.min(mp.learnedCount, m.totalWords)
      return Object.assign({}, m, { learned: count, pct: Math.round(count / m.totalWords * 100), done: count >= m.totalWords })
    })
    const totalWords = list.reduce((s, m) => s + m.totalWords, 0), totalLearned = list.reduce((s, m) => s + m.learned, 0)
    this.setData({ books: BOOKS, book: getBook(bookId), bookId, city, mountains: list,
      current: list.find((m) => m.learned && !m.done) || list.find((m) => !m.done) || list[0],
      totalLearned, totalWords, overallPct: Math.round(totalLearned / totalWords * 100), doneCount: list.filter((m) => m.done).length,
      reviewDue: memory.dueCount, masteredCount: memory.masteredCount, nextReviewMountain: memory.nextMountainId, reviewHint: describeDue(memory.nextReviewAt) })
  },
  enterTrail(e) { wx.navigateTo({ url: '/pages/trail/trail?id=' + e.currentTarget.dataset.id + '&book=' + this.data.bookId }) },
  selectBook(e) { if (storage.setSelectedBook(e.currentTarget.dataset.id)) this.onShow() },
  goDiscover() { wx.switchTab({ url: '/pages/discover/discover' }) },
  goPractice() { wx.switchTab({ url: '/pages/practice/practice' }) },
  goReview() { this.onShow(); if (this.data.reviewDue) wx.navigateTo({ url: '/pages/trail/trail?id=' + this.data.nextReviewMountain + '&book=' + this.data.bookId + '&study=review' }) }
})
