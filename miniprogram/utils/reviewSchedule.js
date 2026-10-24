const DAY = 24 * 60 * 60 * 1000
const RETRY_DELAY = 10 * 60 * 1000
const INTERVALS = [1, 3, 7, 14, 30]

function newMemory(now, wrong) {
  return {
    reviewStep: 0, reviewCount: 0, lastReviewedAt: null,
    nextReviewAt: now + (wrong ? RETRY_DELAY : DAY), mastered: false
  }
}

function reviewedMemory(record, now, wrong) {
  const previous = record.lastReviewedAt == null ? record.learnedAt : record.lastReviewedAt
  // 同日的纠错重试不增加长期掌握度。
  const spaced = now - previous >= DAY
  const step = wrong ? 0 : Math.min(INTERVALS.length - 1, (record.reviewStep || 0) + (spaced ? 1 : 0))
  return {
    reviewStep: step, reviewCount: (record.reviewCount || 0) + 1,
    lastReviewedAt: now, mastered: step >= 3,
    nextReviewAt: now + (wrong ? RETRY_DELAY : INTERVALS[step] * DAY)
  }
}

function describeDue(timestamp, now = Date.now()) {
  if (timestamp == null) return '学完新词后安排复习'
  if (timestamp <= now) return '现在可以复习'
  if (timestamp - now < 60 * 60000) return Math.ceil((timestamp - now) / 60000) + '分钟后复习'
  const date = new Date(timestamp), today = new Date(now)
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const afterTomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2)
  if (timestamp >= tomorrow.getTime() && timestamp < afterTomorrow.getTime()) return '明天回来复习'
  return (date.getMonth() + 1) + '月' + date.getDate() + '日复习'
}
module.exports = { DAY, RETRY_DELAY, newMemory, reviewedMemory, describeDue }
