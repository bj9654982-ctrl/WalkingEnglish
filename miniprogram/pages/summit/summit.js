// pages/summit/summit.js
const { getCityMountains, getCity } = require('../../utils/cityCatalog.js')
const storage = require('../../utils/storage.js')
const { getRouteMountain, getBook } = require('../../utils/wordCatalog.js')

Page({
  data: {
    mountain: null,
    learned: 0,
    durationText: '',
    certNo: '',
    nextMountain: null,
    allDone: false,
    wrongTotal: 0
  },

  onLoad(options) {
    const id = Number(options.id || 0)
    this.bookId = options.book || storage.getSelectedBook()
    const mountain = getRouteMountain(id, this.bookId)
    if (!mountain || !storage.isMountainDone(id, this.bookId)) {
      wx.reLaunch({ url: '/pages/index/index' })
      return
    }
    const progress = storage.getProgress(this.bookId)
    const mp = progress.mountains[id] || { learnedCount: 0, words: {}, startedAt: null, completedAt: null }
    const learned = Math.min(mp.learnedCount, mountain.totalWords)

    let durationText = '—'
    if (!mp.durationIncomplete) {
      const mins = Math.round(mp.studyMs / 60000)
      const h = Math.floor(mins / 60)
      const m = mins % 60
      durationText = mp.studyMs < 60000 ? '不足1分钟' : (h > 0 ? `${h}小时${m}分钟` : `${m}分钟`)
    }
    const wrongTotal = Object.values(mp.words).reduce((s, w) => s + (w.wrong || 0), 0)
    const MOUNTAINS = getCityMountains(mountain.cityId)
    const nextMountain = MOUNTAINS[mountain.routeIndex + 1] || null
    const doneCount = MOUNTAINS.filter((m) => {
      const p = progress.mountains[m.id]
      return p && p.completedAt
    }).length
    const allDone = doneCount >= MOUNTAINS.length

    this.setData({
      mountain,
      city: getCity(mountain.cityId), routeCount: MOUNTAINS.length,
      bookName: getBook(this.bookId).name,
      mountainId: id,
      learned,
      durationText,
      durationNote: mp.durationIncomplete ? '旧记录未完整计时' : '',
      wrongTotal,
      certNo: String(id + 1).padStart(3, '0'),
      nextMountain,
      allDone
    })
  },

  nextMountainGo() {
    if (!this.data.nextMountain || this.navigating) return
    this.navigating = true
    const nextId = this.data.nextMountain.id
    wx.redirectTo({ url: `/pages/trail/trail?id=${nextId}&book=${this.bookId}`, fail: () => { this.navigating = false } })
  },

  // 返回：上一页是同一座山的山道就直接回退，否则回到该山的山道。
  goBack() {
    if (this.navigating) return
    this.navigating = true
    const pages = getCurrentPages()
    const previous = pages[pages.length - 2]
    const fail = () => { this.navigating = false }
    if (previous && previous.route === 'pages/trail/trail' && previous.mountainId === this.data.mountainId) {
      wx.navigateBack({ fail })
    } else {
      wx.redirectTo({ url: `/pages/trail/trail?id=${this.data.mountainId}&book=${this.bookId}`, fail })
    }
  },

  backHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },

  onShareAppMessage() {
    const m = this.data.mountain
    return {
      title: `我登顶了${m.name}，在山径英语背了${this.data.learned}个单词，你也来试试！`,
      path: `/pages/index/index`
    }
  },

  onShareTimeline() {
    const m = this.data.mountain
    return {
      title: `我登顶了${m.name}，在山径英语背了${this.data.learned}个单词`,
      query: `id=${m.id}&book=${this.bookId}`
    }
  }
})
