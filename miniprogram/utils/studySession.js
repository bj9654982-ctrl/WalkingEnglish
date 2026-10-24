const engine = require('./wordEngine.js')
const storage = require('./storage.js')
const speech = require('./speech.js')
const { getRouteMountain } = require('./wordCatalog.js')

// 页面与山道内学习面板共用一个状态机，所有写入固定到开始时的词书。
class StudySession {
  constructor(options, events = {}) {
    this.bookId = options.bookId || storage.getSelectedBook()
    this.mountainId = Number(options.mountainId)
    this.mountain = getRouteMountain(this.mountainId, this.bookId)
    if (!this.mountain) throw new Error('无效的学习路线')
    this.mode = options.mode === 'review' ? 'review' : 'learn'
    this.events = events
    const size = options.groupSize || 5
    this.group = this.mode === 'review'
      ? engine.getReviewGroup(this.mountainId, size, this.bookId)
      : engine.getNextGroup(this.mountainId, size, this.bookId)
    this.wrongMap = {}
    this.passedWords = new Set()
    this.studyMs = 0
    this.savedStudyMs = 0
    this.activeSince = null
    this.visible = false
    this.destroyed = false
    this.finished = !this.group.length
    this.newlyLearned = 0
    this.reviewed = 0
    this.quizIndex = 0
    this.quizQueue = []
    this.data = {
      mode: this.mode, stage: this.group.length ? 'learn' : 'empty',
      mountainName: this.mountain.name, group: this.group, groupSize: this.group.length || 1,
      cardIndex: 0, card: this.group[0] || null, isLastCard: this.group.length === 1,
      currentQuiz: null, selected: -1, locked: false, passedCount: 0, wrongTotal: 0, resultInfo: null,
      emptyText: this.mode === 'review' ? '这一段暂时没有到期复习' : '这一段的新词已经学完'
    }
    this.emit(this.data)
    if (this.group.length) {
      storage.markStarted(this.mountainId, this.bookId)
      if (this.mode === 'review') this.startQuiz()
    }
  }
  emit(patch) {
    Object.assign(this.data, patch)
    if (!this.destroyed && this.events.state) this.events.state(patch)
  }
  captureTime() {
    if (this.activeSince != null) {
      const now = Date.now()
      this.studyMs += Math.max(0, now - this.activeSince)
      this.activeSince = now
    }
  }
  commit(results) {
    this.captureTime()
    const record = this.mode === 'review' ? storage.recordReview : storage.recordGroup
    const saved = record(this.mountainId, results, this.studyMs - this.savedStudyMs, this.bookId)
    this.savedStudyMs = this.studyMs
    this.newlyLearned += saved.newlyLearned || 0
    this.reviewed += saved.reviewed || 0
    return saved
  }
  resume() {
    if (this.destroyed) return
    this.visible = true
    if (!this.finished && this.activeSince == null) this.activeSince = Date.now()
    this.resumeAdvance()
  }
  pause() {
    this.captureTime()
    this.activeSince = null
    this.visible = false
    if (this.advanceTimer != null) {
      clearTimeout(this.advanceTimer)
      this.advanceTimer = null
      this.advanceDelay = Math.max(0, this.advanceDeadline - Date.now())
    }
    speech.destroy()
    if (!this.finished && this.studyMs > this.savedStudyMs) this.commit([])
  }
  destroy() {
    if (this.destroyed) return
    this.pause()
    if (this.mode === 'review' && !this.finished) {
      const failed = Object.keys(this.wrongMap).filter((w) => !this.passedWords.has(w))
        .map((w) => ({ w, wrong: this.wrongMap[w], passed: false }))
      if (failed.length) this.commit(failed)
    }
    this.destroyed = true
    this.pendingAdvance = null
  }
  scheduleAdvance(callback, delay) {
    this.pendingAdvance = callback
    this.advanceDelay = delay
    this.resumeAdvance()
  }
  resumeAdvance() {
    if (!this.visible || this.destroyed || !this.pendingAdvance || this.advanceTimer != null) return
    this.advanceDeadline = Date.now() + this.advanceDelay
    this.advanceTimer = setTimeout(() => {
      this.advanceTimer = null
      if (this.destroyed || !this.visible) return
      const callback = this.pendingAdvance
      this.pendingAdvance = null
      if (callback) callback()
    }, this.advanceDelay)
  }
  speak() {
    const word = this.data.stage === 'quiz' ? this.data.currentQuiz.word : this.data.card
    if (word && !this.destroyed) speech.speak(word.w)
  }
  prevCard() {
    if (this.destroyed || this.data.stage !== 'learn' || this.data.cardIndex <= 0) return
    speech.stop()
    const i = this.data.cardIndex - 1
    this.emit({ cardIndex: i, card: this.group[i], isLastCard: false })
  }
  nextCard() {
    if (this.destroyed || this.data.stage !== 'learn') return
    speech.stop()
    const i = this.data.cardIndex + 1
    if (i < this.group.length) this.emit({ cardIndex: i, card: this.group[i], isLastCard: i === this.group.length - 1 })
    else this.startQuiz()
  }
  startQuiz() {
    if (this.destroyed || this.finished || this.data.stage !== 'learn') return
    this.quizQueue = engine.buildQuiz(this.group, this.mountain.level)
    this.quizIndex = 0
    this.emit({ stage: 'quiz', passedCount: 0 })
    this.loadQuizQuestion()
  }
  loadQuizQuestion() {
    if (this.destroyed || this.finished) return
    speech.stop()
    if (this.quizIndex >= this.quizQueue.length) return this.finishUp()
    this.emit({ currentQuiz: this.quizQueue[this.quizIndex], selected: -1, locked: false })
  }
  chooseOption(index) {
    if (this.destroyed || !this.visible || this.data.stage !== 'quiz' || this.data.locked) return
    const q = this.data.currentQuiz, idx = Number(index)
    if (!q || !q.options[idx]) return
    this.emit({ selected: idx, locked: true })
    if (q.options[idx].correct) {
      if (!this.passedWords.has(q.word.w)) {
        const record = this.commit([{ w: q.word.w, wrong: this.wrongMap[q.word.w] || 0, passed: true }])
        this.passedWords.add(q.word.w)
        this.emit({ passedCount: this.passedWords.size })
        if (this.events.progress) this.events.progress({ newlyLearned: record.newlyLearned || 0, reviewed: record.reviewed || 0 })
      }
      this.scheduleAdvance(() => { this.quizIndex++; this.loadQuizQuestion() }, 650)
    } else {
      this.wrongMap[q.word.w] = (this.wrongMap[q.word.w] || 0) + 1
      this.emit({ wrongTotal: Object.values(this.wrongMap).reduce((sum, n) => sum + n, 0) })
      this.scheduleAdvance(() => {
        this.quizQueue.push({ word: q.word, options: engine.shuffle(q.options) })
        this.quizIndex++
        this.loadQuizQuestion()
      }, 1200)
    }
  }
  finishUp() {
    if (this.destroyed || this.finished || this.passedWords.size !== this.group.length) return
    this.commit([])
    this.activeSince = null
    this.finished = true
    const memory = storage.getMemorySummary(this.bookId, this.mountainId)
    const resultInfo = {
      newlyLearned: this.newlyLearned, reviewed: this.reviewed, groupSize: this.group.length,
      wrongTotal: this.data.wrongTotal, minutes: this.studyMs < 60000 ? '<1' : Math.round(this.studyMs / 60000),
      completed: storage.isMountainDone(this.mountainId, this.bookId), litCamps: memory.litCamps,
      masteredCount: memory.masteredCount
    }
    this.emit({ stage: 'result', resultInfo })
    if (this.events.complete) this.events.complete(resultInfo)
  }
}
module.exports = StudySession
