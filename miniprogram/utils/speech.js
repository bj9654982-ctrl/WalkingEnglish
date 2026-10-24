const manifest = require('../data/speechManifest.js')
const { parts, key } = require('./speechText.js')
const cloudConfig = require('../config/cloud.js')
const packageLoader = require('./speechPackages.js')
let generation = 0, audio = null, release = null, timer = null
let state = { owner: '', status: 'idle', index: 0, total: 0, error: '' }
const listeners = new Set(), packages = new Map()
function publish(patch) { state = Object.assign({}, state, patch); listeners.forEach(fn => fn(state)) }
function subscribe(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn) }
function clearAudio() {
  clearTimeout(timer); timer = null
  const previous = audio; audio = null
  if (previous) { try { previous.stop() } catch (_) {}; try { previous.destroy() } catch (_) {} }
  if (release) { release(); release = null }
}
function stop(owner) {
  if (owner && state.owner !== owner) return
  generation++; clearAudio(); publish({ owner: '', status: 'idle', index: 0, total: 0, error: '' })
}
function loadPackage(name) {
  if (!packages.has(name)) {
    const promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('语音资源加载超时，请检查网络后重试。')), 15000)
      const done = (fn, value) => { clearTimeout(timeout); fn(value) }
      try { packageLoader.load(name).then(() => done(resolve), error => done(reject, Error(error && error.message || '语音资源加载失败，请检查网络后重试。'))) }
      catch (_) { done(reject, Error('语音资源加载失败，请检查网络后重试。')) }
    })
    packages.set(name, promise)
    promise.catch(() => { if (packages.get(name) === promise) packages.delete(name) })
  }
  return packages.get(name)
}
async function source(text, token) {
  const local = manifest[key(text)]
  if (local) {
    await loadPackage('voice' + local.match(/pack(\d+)/)[1])
    return { src: '/' + local, dispose() {} }
  }
  // Arbitrary player text stays within the app's own cloud service; never send it to a dictionary URL.
  if (!cloudConfig.envId || !wx.cloud) throw Error('这段自定义英文需要云端朗读服务，连接云环境后即可使用。')
  if (!require('./social.js').init()) throw Error('暂时无法连接云端朗读服务。')
  const response = await wx.cloud.callFunction({ name: 'trailSpeech', data: { text } })
  if (token !== generation) return null
  const result = response && response.result
  if (!result || !result.ok || !result.audio) throw Error(result && result.message || '云端朗读暂不可用，请稍后重试。')
  const fs = wx.getFileSystemManager(), file = wx.env.USER_DATA_PATH + '/speech-' + Date.now() + '-' + token + '.mp3'
  const dispose = () => { try { fs.unlink({ filePath: file, fail() {} }) } catch (_) {} }
  try { await new Promise((resolve, reject) => fs.writeFile({ filePath: file, data: result.audio, encoding: 'base64', success: resolve, fail: reject })) }
  catch (error) { dispose(); throw error }
  if (token !== generation) { dispose(); return null }
  return { src: file, dispose }
}
function speak(text, options = {}) {
  const queue = (Array.isArray(text) ? text : [text]).flatMap(parts)
  const owner = options.owner || 'legacy'
  if (state.owner === owner && ['loading', 'playing'].includes(state.status)) { stop(owner); return }
  stop()
  if (!queue.length) return
  const token = generation
  publish({ owner, status: 'loading', index: 0, total: queue.length, error: '' })
  function fail(error) {
    if (token !== generation) return
    clearAudio(); generation++
    const message = error && error.message || '播放失败，请检查音量或网络后重试。'
    publish({ status: 'error', error: message })
    wx.showToast({ title: message, icon: 'none', duration: 3500 })
  }
  async function next(index) {
    if (token !== generation) return
    clearAudio()
    if (index >= queue.length) { stop(); return }
    publish({ status: 'loading', index })
    timer = setTimeout(() => fail(Error('语音加载超时，请重试。')), 20000)
    try {
      const resolved = await source(queue[index], token)
      if (!resolved) return
      if (token !== generation) { resolved.dispose(); return }
      clearTimeout(timer); release = resolved.dispose
      const context = wx.createInnerAudioContext(); audio = context
      const valid = () => token === generation && audio === context
      context.obeyMuteSwitch = false; context.autoplay = false
      const playing = () => { if (valid()) { clearTimeout(timer); publish({ status: 'playing' }); timer = setTimeout(() => fail(Error('播放中断，请重试。')), 120000) } }
      context.onPlay(playing)
      if (context.onTimeUpdate) context.onTimeUpdate(() => { if (valid() && context.currentTime > 0 && state.status === 'loading') playing() })
      context.onWaiting(() => { if (valid()) { publish({ status: 'loading' }); clearTimeout(timer); timer = setTimeout(() => fail(Error('播放缓冲超时，请重试。')), 15000) } })
      context.onEnded(() => { if (valid()) next(index + 1) })
      context.onError(() => { if (valid()) fail(Error('播放失败，请检查音量或网络后重试。')) })
      context.src = resolved.src
      timer = setTimeout(() => fail(Error('播放启动超时，请重试。')), 15000)
      context.play()
    } catch (error) { fail(error) }
  }
  next(0)
}
module.exports = { speak, stop, destroy: stop, subscribe }
