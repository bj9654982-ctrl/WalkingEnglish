const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const { tts } = require('tencentcloud-sdk-nodejs-tts')
const { createService } = require('./service')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, throwOnNotFound: false })
const db = cloud.database()
const service = createService({
  enabled: () => process.env.TTS_ENABLED === 'true' && !!process.env.TTS_SECRET_ID && !!process.env.TTS_SECRET_KEY,
  async reserve(openid) {
    const day = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
    const uid = crypto.createHash('sha256').update(openid).digest('hex').slice(0, 32)
    const result = await db.runTransaction(async transaction => {
      const ids = [day + ':global', day + ':' + uid], limits = [1000, 60], rows = []
      for (let i = 0; i < ids.length; i++) {
        const doc = transaction.collection('trail_speech_usage').doc(ids[i]), response = await doc.get()
        const data = Array.isArray(response.data) ? response.data[0] : response.data
        const count = data && data.count || 0
        if (count >= limits[i]) return false
        rows.push({ doc, count })
      }
      for (const row of rows) await row.doc.set({ data: { count: row.count + 1, day, updatedAt: Date.now() } })
      return true
    })
    return (result && typeof result === 'object' && 'result' in result ? result.result : result) === true
  },
  async synthesize(text) {
    const client = new tts.v20190823.Client({
      credential: { secretId: process.env.TTS_SECRET_ID, secretKey: process.env.TTS_SECRET_KEY },
      region: 'ap-guangzhou', profile: { httpProfile: { reqTimeout: 15 } }
    })
    const response = await client.TextToVoice({ Text: text, SessionId: crypto.randomBytes(16).toString('hex'),
      ModelType: 1, VoiceType: 101050, PrimaryLanguage: 2, Codec: 'mp3', SampleRate: 16000, Speed: -0.5 })
    return response.Audio
  }
})
exports.main = event => service(event, cloud.getWXContext().OPENID)
