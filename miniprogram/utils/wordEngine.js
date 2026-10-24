// utils/wordEngine.js
// 背词调度：学习组 + 四选一测验生成
const storage = require('./storage.js')
const { loadWords, getMountainWords } = require('./wordCatalog.js')

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 最后一组可以不足 groupSize，完成的山不再发放新词。
function getNextGroup(mountainId, groupSize, bookId = storage.getSelectedBook()) {
  const pool = getMountainWords(mountainId, bookId)
  if (!pool.length) return []
  const mp = storage.getMountainProgress(mountainId, bookId)
  const learnedSet = new Set(Object.keys(mp.words))
  const size = Math.max(1, Math.floor(Number(groupSize) || 5))
  return pool.filter((item) => !learnedSet.has(item.w)).slice(0, size)
}

function getReviewGroup(mountainId, groupSize, bookId = storage.getSelectedBook(), now = Date.now()) {
  const words = storage.getMountainProgress(mountainId, bookId).words
  return getMountainWords(mountainId, bookId)
    .filter((item) => words[item.w] && words[item.w].nextReviewAt <= now)
    .sort((a, b) => words[a.w].nextReviewAt - words[b.w].nextReviewAt)
    .slice(0, Math.max(1, Math.floor(Number(groupSize) || 5)))
}

// 生成四选一测验
function buildQuiz(words, level) {
  const pool = loadWords(level)
  return words.map((target) => {
    const distractors = new Set()
    const candidates = shuffle(pool)
    for (const c of candidates) {
      if (distractors.size >= 3) break
      if (c.w === target.w) continue
      if (c.mean === target.mean) continue
      if ([...distractors].some((d) => d.mean === c.mean)) continue
      distractors.add(c)
    }
    const options = shuffle([
      { text: target.mean, correct: true },
      ...[...distractors].map((d) => ({ text: d.mean, correct: false }))
    ])
    return { word: target, options }
  })
}

// 汇总本组结果（页面测完后调用）
function summarizeGroup(group, wrongCountMap) {
  return group.map((item) => ({
    w: item.w,
    wrong: wrongCountMap[item.w] || 0,
    passed: true // 测验机制保证每题最终答对才结束
  }))
}

module.exports = {
  loadWords,
  getMountainWords,
  shuffle,
  getNextGroup,
  getReviewGroup,
  buildQuiz,
  summarizeGroup
}
