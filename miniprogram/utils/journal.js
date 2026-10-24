const KEY = 'we_journal_v1'
function read() { return Object.assign({ reading: {}, practice: { rounds: 0, correct: 0, total: 0 }, encounters: {} }, wx.getStorageSync(KEY) || {}) }
function write(state) { wx.setStorageSync(KEY, state) }
function finishReading(id) { const s = read(); s.reading[id] = Date.now(); write(s) }
function finishPractice(correct, total) { const s = read(); s.practice.rounds++; s.practice.correct += correct; s.practice.total += total; write(s) }
function collect(key, animalId, mountainId) { const s = read(); if (s.encounters[key]) return false; s.encounters[key] = { animalId, mountainId, at: Date.now() }; write(s); return true }
function reset() { wx.removeStorageSync(KEY) }
module.exports = { read, finishReading, finishPractice, collect, reset }
