// 水彩 2.5D 山道：学习状态与 Canvas 场景分离。
const { TrailScene, clamp } = require('../../utils/trailScene.js')
const { getRouteMountain } = require('../../utils/wordCatalog.js')
const { describeDue } = require('../../utils/reviewSchedule.js')
const storage = require('../../utils/storage.js')
const wildlife = require('../../utils/wildlife.js')
const speech = require('../../utils/speech.js')
const { STOPS, isReached } = require('../../utils/campAccess.js')

Page({
  data: {
    mountain: null, pct: 0, learned: 0, totalWords: 1,
    btnText: '启程', done: false, loading: true, sceneError: false, artFallback: false,
    studyOpen: false, studyMode: 'learn', camps: [], reviewDue: 0, bookId: '',
    hudTop: 28, hudProgressTop: 100, hudRight: 100, lookingAround: false,
    chapter: '01', moodLabel: '晨雾林间', encounter: null, encounterOpen: false, animalCorrect: false, animalFeedback: ''
  },

  onLoad(options) {
    this.mountainId = Number(options.id || 0)
    this.bookId = options.book || storage.getSelectedBook()
    this.requestedStudy = options.study
    this.mountain = getRouteMountain(this.mountainId, this.bookId)
    if (!this.mountain) { wx.reLaunch({ url: '/pages/index/index' }); return }
    this.setData({
      mountain: this.mountain, mountainId: this.mountainId, bookId: this.bookId,
      totalWords: this.mountain.totalWords, chapter: String(this.mountain.routeIndex + 1).padStart(2, '0'),
      moodLabel: ['晨雾林间', '湖风入林', '晴空纸鸢', '金色幽谷', '浮云山径', '暮色书山', '落日归途'][this.mountainId % 7]
    })
    this.updateInsets()
    this.ready = false; this.paused = true; this.destroyed = false
    this.pan = 0; this.zoom = 1; this.touchMode = null
    this.walkTime = 0; this.sceneTime = 0
    this.skippedEncounters = new Set()
    this.refreshProgress()
  },

  updateInsets() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : (wx.getSystemInfoSync ? wx.getSystemInfoSync() : {})
    const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const hudTop = (info.statusBarHeight || 20) + 8
    this.windowInfo = info
    this.setData({
      hudTop, hudProgressTop: hudTop + 66,
      hudRight: menu && info.windowWidth ? Math.max(90, info.windowWidth - menu.left + 8) : 100
    })
  },

  onReady() {
    this.initScene()
    if (this.requestedStudy) {
      const mode = this.requestedStudy; this.requestedStudy = null; this.openStudy(mode)
    }
  },

  initScene() {
    if (!this.mountain || this.destroyed || this.ready || this.initializing) return
    this.initializing = true
    this.setData({ loading: true, sceneError: false, artFallback: false })
    wx.createSelectorQuery().select('#landscape').node().exec((res) => {
      this.initializing = false
      if (this.destroyed) return
      try {
        const canvas = res && res[0] && res[0].node
        if (!canvas) throw new Error('Canvas 尚未就绪')
        this.canvas = canvas
        this.buildWorld()
        this.ready = true
        this.refreshProgress()
        this.setData({ loading: false })
        this.loop()
      } catch (error) { this.sceneFailed(error) }
    })
  },

  buildWorld() {
    const info = this.windowInfo || {}
    this.renderer = new TrailScene(this.canvas, this.mountain, {
      width: info.windowWidth || 390, height: info.windowHeight || 844, pixelRatio: info.pixelRatio || 1,
      createSurface: wx.createOffscreenCanvas ? (width, height) => wx.createOffscreenCanvas({ type: '2d', width, height }) : null,
      onAsset: (loaded) => {
        if (this.destroyed) return
        this.setData({ artFallback: !loaded })
        // 图片可能在学习暂停期间就绪，也需补绘一帧。
        this.drawFrame()
      }
    })
    this.updateCamps()
  },

  sceneFailed(error) {
    console.error('山道场景加载失败', error)
    this.disposeWorld()
    if (!this.destroyed) this.setData({ loading: false, sceneError: true })
  },

  refreshProgress() {
    if (!this.mountain) return
    const mp = storage.getMountainProgress(this.mountainId, this.bookId)
    const total = this.mountain.totalWords
    const learned = Math.min(mp.learnedCount, total)
    const done = !!mp.completedAt || learned >= total
    if (this.hasProgressSnapshot && !this.data.done && done) this.summitPending = true
    this.hasProgressSnapshot = true
    const memory = storage.getMemorySummary(this.bookId, this.mountainId)
    this.setData({
      learned, pct: Math.round(learned / total * 100), done,
      btnText: done ? '已登顶 · 查看证书' : (learned ? '继续前行' : '启程 · 背单词前进'),
      camps: memory.camps, reviewDue: memory.dueCount, reviewHint: describeDue(memory.nextReviewAt),
      litCamps: memory.litCamps, masteredCount: memory.masteredCount
    })
    this.targetT = learned / total
    if (this.currentT === undefined || this.currentT > this.targetT) this.currentT = this.targetT
    this.encounterList = wildlife.encounters(this.mountainId, this.bookId)
    if (this.renderer) this.renderer.setWildlife(this.encounterList)
    this.checkJourney()
    this.updateCamps()
  },

  checkJourney() {
    const encounter = (this.encounterList || []).find((a) => !a.collected && !(this.skippedEncounters && this.skippedEncounters.has(a.key)) && a.at <= this.currentT + 0.000001) || null
    if ((encounter && encounter.key) !== (this.data.encounter && this.data.encounter.key)) this.setData({ encounter })
    const camps = this.data.camps.map((c, index) => Object.assign({}, c, { reached: isReached(this.mountainId, this.bookId, index, this.data.learned) && this.currentT + 0.000001 >= STOPS[index] }))
    if (camps.some((c, i) => c.reached !== this.data.camps[i].reached)) this.setData({ camps })
  },

  openEncounter() { if (this.data.encounter && !this.data.studyOpen) { this.stopScene(); this.setData({ encounterOpen: true, animalCorrect: false, animalFeedback: '' }); this.drawFrame() } },
  chooseAnimal(e) {
    if (!this.data.encounter || this.data.animalCorrect) return
    speech.stop()
    const correct = e.currentTarget.dataset.word === this.data.encounter.word
    this.setData({ animalCorrect: correct, animalFeedback: correct ? '认出来了！把这次遇见写进手册吧。' : '再看看它的样子，试试另一个名字。' })
  },
  collectAnimal() {
    if (!this.data.encounter || !this.data.animalCorrect) return
    speech.stop()
    wildlife.collect(this.data.encounter, this.mountainId)
    this.setData({ encounterOpen: false }); this.refreshProgress(); if (this.ready) this.loop()
  },
  closeEncounter() {
    speech.stop()
    if (this.data.encounter) this.skippedEncounters.add(this.data.encounter.key)
    this.setData({ encounterOpen: false }); this.checkJourney(); if (this.ready) this.loop()
  },
  enterCamp(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (!this.data.camps[index] || !this.data.camps[index].reached) { wx.showToast({ title: '继续背词，走到营地后即可进入', icon: 'none' }); return }
    wx.navigateTo({ url: `/pages/camp/camp?id=${this.mountainId}&book=${this.bookId}&camp=${index}` })
  },

  updateCamps() { if (this.renderer) this.renderer.setCamps(this.data.camps) },

  onShow() {
    if (!this.mountain || this.destroyed) return
    this.paused = false; this.navigating = false
    this.refreshProgress()
    if (this.ready) this.loop()
  },

  onHide() { speech.stop(); this.paused = true; this.touchMode = null; this.stopScene() },
  onUnload() { this.destroyed = true; this.onHide(); this.disposeWorld() },

  onResize(event) {
    if (this.destroyed) return
    this.updateInsets()
    if (!this.renderer) return
    const size = event && event.size || this.windowInfo
    this.renderer.resize(size.windowWidth || 390, size.windowHeight || 844, this.windowInfo.pixelRatio || 1)
    this.drawFrame()
  },

  stopScene() {
    if (this.frameId != null && this.canvas) this.canvas.cancelAnimationFrame(this.frameId)
    this.frameId = null; this.lastFrameTime = null
    if (this.summitTimer != null) clearTimeout(this.summitTimer)
    this.summitTimer = null
  },

  disposeWorld() {
    this.stopScene()
    if (this.renderer) this.renderer.dispose()
    this.renderer = null; this.canvas = null; this.ready = false
  },

  openSummit() {
    if (this.destroyed || this.paused || this.data.studyOpen || this.data.encounterOpen || !this.data.done || this.navigating) return
    this.navigating = true
    if (this.summitTimer != null) clearTimeout(this.summitTimer)
    this.summitTimer = null
    wx.redirectTo({
      url: `/pages/summit/summit?id=${this.mountainId}&book=${this.bookId}`,
      fail: () => { this.navigating = false }
    })
  },

  goLearn() {
    if (this.navigating || this.destroyed) return
    if (this.data.done) {
      this.openSummit()
      return
    }
    this.openStudy('learn')
  },

  goReview() {
    this.refreshProgress()
    if (this.data.reviewDue) this.openStudy('review')
  },

  openStudy(mode) {
    if (this.destroyed || this.paused || this.data.studyOpen || this.data.encounterOpen) return
    this.stopScene()
    this.setData({ studyOpen: true, studyMode: mode === 'review' ? 'review' : 'learn' })
    this.updateFraming()
    if (this.ready) this.loop()
  },

  onStudyProgress() {
    if (this.destroyed) return
    this.refreshProgress()
    if (this.ready) this.loop()
  },

  onStudyComplete() {
    if (!this.destroyed) this.refreshProgress()
  },

  onStudyClose() {
    if (this.destroyed) return
    this.setData({ studyOpen: false })
    this.refreshProgress()
    this.updateFraming()
    if (this.ready) this.loop()
  },

  updateFraming() {
    this.pan = 0
    this.zoom = 1
    this.setData({ lookingAround: false })
    this.drawFrame()
  },

  goBack() {
    if (this.data.encounterOpen) { this.closeEncounter(); return }
    if (this.data.studyOpen) {
      const sheet = this.selectComponent('#study')
      if (sheet) sheet.requestClose()
      return
    }
    wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/index/index' }) })
  },

  // 只移动镜头，不允许触摸修改角色的学习进度。
  onTouchStart(e) {
    if (!this.ready || this.data.studyOpen || this.data.encounterOpen || !e.touches.length) return
    this.touchMode = e.touches.length > 1 ? 'pinch' : 'pan'
    this.lastX = e.touches[0].clientX
    this.lastDist = this.pinchDist(e.touches)
  },
  onTouchMove(e) {
    if (!this.touchMode || !this.renderer || this.data.studyOpen) return
    const touches = e.touches
    if (!touches.length) return
    if (touches.length > 1) {
      const dist = this.pinchDist(touches)
      if (this.touchMode === 'pinch' && this.lastDist > 0) this.zoom = clamp(this.zoom * dist / this.lastDist, 0.8, 1.45)
      this.touchMode = 'pinch'; this.lastDist = dist
    } else {
      if (this.touchMode === 'pan') {
        const scale = this.renderer.getView({ progress: this.currentT, zoom: this.zoom }).scale
        this.pan = clamp(this.pan - (touches[0].clientX - this.lastX) / scale, -160, 180)
      }
      this.touchMode = 'pan'
    }
    this.lastX = touches[0].clientX
    const lookingAround = Math.abs(this.pan) > 5 || Math.abs(this.zoom - 1) > 0.02
    if (lookingAround !== this.data.lookingAround) this.setData({ lookingAround })
    this.drawFrame()
  },
  onTouchEnd(e) {
    const touches = e && e.touches || []
    if (touches.length) this.onTouchStart({ touches })
    else this.touchMode = null
  },
  pinchDist(t) {
    if (t.length < 2) return 0
    return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
  },
  resetView() {
    this.pan = 0; this.zoom = 1; this.setData({ lookingAround: false }); this.drawFrame()
  },

  drawFrame(walking = false) {
    if (!this.renderer || this.destroyed || this.paused) return
    try {
      this.renderer.render({
        progress: this.currentT || 0, pan: this.pan, zoom: this.zoom,
        studyOpen: this.data.studyOpen, time: this.sceneTime, walkTime: this.walkTime, walking
      })
    } catch (error) { this.sceneFailed(error) }
  },

  loop() {
    if (this.destroyed || this.paused || !this.ready || this.frameId != null || this.data.encounterOpen) return
    const now = Date.now()
    // 空闲场景最高约 30 fps；后台完全停止，答题静止时不继续调度。
    if (this.lastFrameTime == null || now - this.lastFrameTime >= 30) {
      const dt = this.lastFrameTime == null ? 1 / 30 : clamp((now - this.lastFrameTime) / 1000, 0, 0.05)
      this.lastFrameTime = now
      this.sceneTime += dt
      const walking = this.currentT < this.targetT
      if (walking) { this.currentT = Math.min(this.targetT, this.currentT + 0.065 * dt); this.walkTime += dt }
      if (walking) this.checkJourney()
      this.drawFrame(walking)
    }
    if (!this.ready) return
    if (this.currentT >= 1 && this.data.done && this.summitPending && !this.data.studyOpen && !this.data.encounterOpen && this.summitTimer == null && !this.navigating) {
      this.summitTimer = setTimeout(() => { this.summitTimer = null; this.openSummit() }, 1800)
    }
    if (!this.data.studyOpen || this.currentT < this.targetT) {
      this.frameId = this.canvas.requestAnimationFrame(() => { this.frameId = null; this.loop() })
    }
  }
})
