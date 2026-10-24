const StudySession = require('../../utils/studySession.js')
Component({
  properties: {
    mountainId: Number,
    bookId: String,
    mode: { type: String, value: 'learn' }
  },
  data: { stage: 'learn', groupSize: 1 },
  lifetimes: {
    attached() {
      this.session = new StudySession({
        mountainId: this.properties.mountainId,
        bookId: this.properties.bookId,
        mode: this.properties.mode,
        groupSize: getApp().globalData.groupSize || 5
      }, {
        state: (patch) => this.setData(patch),
        progress: (detail) => this.triggerEvent('progress', detail),
        complete: (detail) => this.triggerEvent('complete', detail)
      })
      this.session.resume()
    },
    detached() {
      if (this.session) this.session.destroy()
    }
  },
  pageLifetimes: {
    show() { if (this.session) this.session.resume() },
    hide() { if (this.session) this.session.pause() }
  },
  methods: {
    noop() {},
    speak() { this.session.speak() },
    prevCard() { this.session.prevCard() },
    nextCard() { this.session.nextCard() },
    chooseOption(event) { this.session.chooseOption(event.currentTarget.dataset.idx) },
    nextAction() { this.close() },
    requestClose() {
      if (this.session.finished) return this.close()
      wx.showModal({
        title: '先休息一下？',
        content: '已答对的单词和学习用时已保存，下次从剩余单词继续。',
        confirmText: '收起学习',
        success: (res) => { if (res.confirm && !this.session.destroyed) this.close() }
      })
    },
    close() {
      if (!this.session || this.session.destroyed) return
      this.session.destroy()
      this.triggerEvent('close')
    }
  }
})
