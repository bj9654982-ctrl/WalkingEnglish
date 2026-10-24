// 保留旧学习页入口，与山道面板共用学习状态机。
const StudySession = require('../../utils/studySession.js')
const storage = require('../../utils/storage.js')
const { getRouteMountain } = require('../../utils/wordCatalog.js')
Page({
  data: { stage: 'learn', groupSize: 1 },
  onLoad(options) {
    this.mountainId = Number(options.mountainId || 0)
    this.bookId = options.book || storage.getSelectedBook()
    const mountain = getRouteMountain(this.mountainId, this.bookId)
    if (!mountain) return wx.reLaunch({ url: '/pages/index/index' })
    this.session = new StudySession({
      mountainId: this.mountainId, bookId: this.bookId, mode: options.mode,
      groupSize: getApp().globalData.groupSize || 5
    }, { state: (patch) => this.setData(patch) })
    wx.setNavigationBarTitle({ title: mountain.name + ' · 背词' })
  },
  onShow() { if (this.session) this.session.resume() },
  onHide() { if (this.session) this.session.pause() },
  onUnload() { if (this.session) this.session.destroy() },
  speak() { this.session.speak() },
  prevCard() { this.session.prevCard() },
  nextCard() { this.session.nextCard() },
  startQuiz() { this.session.startQuiz() },
  chooseOption(event) { this.session.chooseOption(event.currentTarget.dataset.idx) },
  finishUp() { this.session.finishUp() },
  // 返回山道：上一页就是同一座山的山道时直接回退，否则用山道替换当前页。
  goBack() {
    if (this.navigating) return
    this.navigating = true
    const pages = getCurrentPages()
    const previous = pages[pages.length - 2]
    const fail = () => { this.navigating = false }
    if (previous && previous.route === 'pages/trail/trail' && previous.mountainId === this.mountainId && previous.bookId === this.bookId) {
      wx.navigateBack({ fail })
    } else {
      wx.redirectTo({ url: '/pages/trail/trail?id=' + this.mountainId + '&book=' + this.bookId, fail })
    }
  },
  nextAction() {
    if (!this.session || !this.session.finished || this.navigating) return
    this.navigating = true
    const pages = getCurrentPages(), previous = pages[pages.length - 2]
    const fail = () => { this.navigating = false }
    if (previous && previous.route === 'pages/trail/trail' && previous.mountainId === this.mountainId && previous.bookId === this.bookId) {
      wx.navigateBack({ fail })
    } else {
      wx.redirectTo({ url: '/pages/trail/trail?id=' + this.mountainId + '&book=' + this.bookId, fail })
    }
  }
})
