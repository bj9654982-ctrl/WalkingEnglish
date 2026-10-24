// v1/v2 保留为升级备份；每本词书独立保存七山进度。
const PROGRESS_KEY = 'we_progress_v3'
const { MOUNTAINS } = require('./trailData.js')
const { ALL_MOUNTAINS } = require('./cityCatalog.js')
const { BOOKS, getBook, getMountainWords, getRouteMountain } = require('./wordCatalog.js')
const { newMemory, reviewedMemory } = require('./reviewSchedule.js')

function defaultMountain() {
  return { words: {}, learnedCount: 0, startedAt: null, completedAt: null, studyMs: 0, durationIncomplete: false }
}
function emptyProgress() {
  const p = { mountains: {}, totalLearned: 0, totalMinutes: 0, legacyStudyMs: 0 }
  ALL_MOUNTAINS.forEach((m) => { p.mountains[m.id] = defaultMountain() })
  return p
}
function updateTotals(p) {
  const mountains = Object.values(p.mountains)
  p.totalLearned = new Set(mountains.reduce((words, m) => words.concat(Object.keys(m.words)), [])).size
  p.totalMinutes = ((p.legacyStudyMs || 0) + mountains.reduce((sum, m) => sum + m.studyMs, 0)) / 60000
}
function collectWords(progress) {
  const words = new Map()
  Object.values(progress.mountains || {}).forEach((mp) => {
    Object.keys(mp.words || {}).forEach((w) => {
      const r = mp.words[w], previous = words.get(w)
      const learnedAt = Number.isFinite(r.learnedAt) ? r.learnedAt : Date.now()
      words.set(w, {
        wrong: (previous ? previous.wrong : 0) + (r.wrong || 0),
        learnedAt: previous ? Math.min(previous.learnedAt, learnedAt) : learnedAt
      })
    })
  })
  return words
}
function importWords(bookId, words) {
  const p = emptyProgress()
  MOUNTAINS.forEach((m) => {
    const mp = p.mountains[m.id], pool = getMountainWords(m.id, bookId)
    pool.forEach(({ w }) => {
      if (!words.has(w)) return
      const r = words.get(w)
      // 旧记录没有复习证据：保留已学，不直接标为掌握，安排现在复习。
      mp.words[w] = Object.assign({}, r, newMemory(r.learnedAt, r.wrong), { nextReviewAt: Date.now() })
    })
    const dates = Object.values(mp.words).map((r) => r.learnedAt)
    mp.learnedCount = dates.length
    if (dates.length) {
      mp.startedAt = Math.min(...dates)
      mp.durationIncomplete = true
    }
    if (dates.length === pool.length && pool.length) mp.completedAt = Math.max(...dates)
  })
  updateTotals(p)
  return p
}
function readState() {
  const existing = wx.getStorageSync(PROGRESS_KEY)
  if (existing && existing.version === 3 && existing.books) {
    let changed = false
    BOOKS.forEach((book) => {
      if (!existing.books[book.id]) { existing.books[book.id] = emptyProgress(); changed = true }
      ALL_MOUNTAINS.forEach((m) => {
        if (!existing.books[book.id].mountains[m.id]) { existing.books[book.id].mountains[m.id] = defaultMountain(); changed = true }
      })
      updateTotals(existing.books[book.id])
    })
    if (changed) wx.setStorageSync(PROGRESS_KEY, existing)
    return existing
  }
  const old = wx.getStorageSync('we_progress_v2') || wx.getStorageSync('we_progress_v1')
  const learned = old && old.mountains ? collectWords(old) : new Map()
  const state = { version: 3, selectedBook: old && old.mountains ? 'classic' : 'easy', books: {} }
  BOOKS.forEach((book) => { state.books[book.id] = importWords(book.id, learned) })
  const classic = state.books.classic
  if (old && old.version === 2) {
    // 只有经典路线与 v2 的章节一致，可以完整保留逐山计时。
    MOUNTAINS.forEach((m) => {
      const previous = old.mountains[m.id], mp = classic.mountains[m.id]
      if (!previous) return
      mp.studyMs = Math.max(0, previous.studyMs || 0)
      mp.durationIncomplete = !!previous.durationIncomplete
      if (previous.startedAt != null) mp.startedAt = previous.startedAt
      if (mp.completedAt != null && previous.completedAt != null) mp.completedAt = previous.completedAt
    })
    classic.legacyStudyMs = old.legacyStudyMs || 0
  } else if (old) {
    classic.legacyStudyMs = Math.max(0, Number(old.totalMinutes) || 0) * 60000
  }
  updateTotals(classic)
  wx.setStorageSync(PROGRESS_KEY, state)
  return state
}
function resolveBook(state, bookId) {
  if (bookId && !getBook(bookId)) throw new Error('无效的词书')
  return bookId || state.selectedBook
}
function getSelectedBook() { return readState().selectedBook }
function setSelectedBook(bookId) {
  if (!getBook(bookId)) return false
  const state = readState()
  state.selectedBook = bookId
  wx.setStorageSync(PROGRESS_KEY, state)
  return true
}
function getProgress(bookId) {
  const state = readState()
  return state.books[resolveBook(state, bookId)]
}
function initProgress() { return getProgress() }
function getMountainProgress(mountainId, bookId) {
  return getProgress(bookId).mountains[mountainId] || defaultMountain()
}
function markStarted(mountainId, bookId) {
  const state = readState(), id = resolveBook(state, bookId)
  if (!getRouteMountain(mountainId, id)) return
  const mp = state.books[id].mountains[mountainId]
  if (mp.startedAt == null) {
    mp.startedAt = Date.now()
    wx.setStorageSync(PROGRESS_KEY, state)
  }
}
function recordGroup(mountainId, results, studyMs, bookId) {
  const state = readState(), id = resolveBook(state, bookId)
  const mountain = getRouteMountain(mountainId, id)
  if (!mountain) throw new Error('无效的山峰')
  const p = state.books[id], mp = p.mountains[mountainId], now = Date.now()
  const elapsed = Math.max(0, Number(studyMs) || 0)
  if (mp.startedAt == null) mp.startedAt = now - elapsed
  const allowed = new Set(getMountainWords(mountainId, id).map((item) => item.w))
  let newlyLearned = 0
  results.forEach((r) => {
    if (!r.passed || !allowed.has(r.w) || mp.words[r.w]) return
    mp.words[r.w] = Object.assign({ wrong: r.wrong || 0, learnedAt: now }, newMemory(now, r.wrong))
    newlyLearned++
  })
  mp.learnedCount = Object.keys(mp.words).length
  mp.studyMs += elapsed
  if (mp.learnedCount >= mountain.totalWords && mp.completedAt == null) mp.completedAt = now
  updateTotals(p)
  wx.setStorageSync(PROGRESS_KEY, state)
  return { progress: p, newlyLearned, completed: mp.completedAt != null }
}
function recordReview(mountainId, results, studyMs, bookId) {
  const state = readState(), id = resolveBook(state, bookId)
  const p = state.books[id], mp = p.mountains[mountainId], now = Date.now()
  if (!mp) throw new Error('无效的山峰')
  let reviewed = 0
  const seen = new Set()
  results.forEach((r) => {
    const record = mp.words[r.w]
    if (!record || seen.has(r.w) || record.nextReviewAt > now) return
    seen.add(r.w)
    record.wrong += r.wrong || 0
    Object.assign(record, reviewedMemory(record, now, r.wrong || !r.passed))
    reviewed++
  })
  mp.studyMs += Math.max(0, Number(studyMs) || 0)
  updateTotals(p)
  wx.setStorageSync(PROGRESS_KEY, state)
  return { progress: p, reviewed, newlyLearned: 0, completed: mp.completedAt != null }
}
function getMemorySummary(bookId, mountainId, now = Date.now()) {
  const state = readState(), id = resolveBook(state, bookId), p = state.books[id]
  const mountains = mountainId == null ? ALL_MOUNTAINS : ALL_MOUNTAINS.filter((m) => m.id === Number(mountainId))
  let dueCount = 0, masteredCount = 0, reviewedCount = 0, nextReviewAt = null, nextMountainId = null
  const camps = []
  mountains.forEach((m) => {
    const mp = p.mountains[m.id], pool = getMountainWords(m.id, id)
    Object.values(mp.words).forEach((record) => {
      if (record.mastered) masteredCount++
      if (record.reviewCount > 0) reviewedCount++
      if (record.nextReviewAt <= now) dueCount++
      if (nextReviewAt == null || record.nextReviewAt < nextReviewAt) {
        nextReviewAt = record.nextReviewAt
        nextMountainId = m.id
      }
    })
    for (let i = 0; i < 3; i++) {
      const section = pool.slice(Math.floor(i * pool.length / 3), Math.floor((i + 1) * pool.length / 3))
      const records = section.map((w) => mp.words[w.w]).filter(Boolean)
      const due = records.filter((r) => r.nextReviewAt <= now).length
      const recalled = records.filter((r) => r.lastReviewedAt != null && r.reviewStep >= 1).length
      camps.push({ id: m.id + '-' + i, index: i, mountainId: m.id, due, lit: section.length > 0 && recalled === section.length && due === 0 })
    }
  })
  return { dueCount, masteredCount, reviewedCount, nextReviewAt, nextMountainId, camps, litCamps: camps.filter((c) => c.lit).length }
}
function isMountainDone(mountainId, bookId) {
  const id = bookId || getSelectedBook(), m = getRouteMountain(mountainId, id)
  return !!m && getMountainProgress(mountainId, id).learnedCount >= m.totalWords
}
function resetMountain(mountainId, bookId) {
  const state = readState(), id = resolveBook(state, bookId), p = state.books[id]
  if (getRouteMountain(mountainId, id)) p.mountains[mountainId] = defaultMountain()
  updateTotals(p)
  wx.setStorageSync(PROGRESS_KEY, state)
  return p
}
function resetAll() {
  ;['we_progress_v1', 'we_progress_v2', PROGRESS_KEY].forEach((key) => wx.removeStorageSync(key))
  return initProgress()
}
module.exports = {
  initProgress, getProgress, getSelectedBook, setSelectedBook, getMountainProgress,
  markStarted, recordGroup, recordReview, getMemorySummary, isMountainDone, resetMountain, resetAll
}
