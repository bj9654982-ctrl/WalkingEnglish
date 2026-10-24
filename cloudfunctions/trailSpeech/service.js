// Unknown, player-written English only. Offline learning clips never reach this service.
function createService({ enabled, reserve, synthesize }) {
  return async (event, openid) => {
    if (!openid) return { ok: false, message: '请在微信中打开后再试。' }
    const text = event && event.text
    if (typeof text !== 'string' || !/[a-z]/i.test(text) || text.length > 400 || !/^[A-Za-z0-9 \t\r\n'",.!?:;()\-]+$/.test(text)) return { ok: false, message: '请朗读 400 字符以内的英文。' }
    if (!enabled()) return { ok: false, message: '自定义英文的云端朗读尚未开放，内置学习内容可直接听读。' }
    try {
      if (!await reserve(openid)) return { ok: false, message: '今天的云端朗读次数已用完，内置学习内容仍可听读。' }
      const audio = await synthesize(text)
      if (typeof audio !== 'string' || audio.length < 100 || audio.length > 900000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(audio)) throw Error('Invalid audio response')
      return { ok: true, audio }
    } catch (_) { return { ok: false, message: '云端朗读暂不可用，请稍后重试。' } }
  }
}
module.exports = { createService }
