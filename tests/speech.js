const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const { parts, key, english } = require('../miniprogram/utils/speechText')
const manifest = require('../miniprogram/data/speechManifest')
const { createService } = require('../cloudfunctions/trailSpeech/service')
const config = require('../miniprogram/config/cloud')
const packageLoader = require('../miniprogram/utils/speechPackages')
let count = 0, state, contexts, loads, toasts, timers, nextTimer = 0
const originalTimers = [global.setTimeout, global.clearTimeout]
global.setTimeout = fn => { const id = ++nextTimer; timers.set(id, fn); return id }
global.clearTimeout = id => timers.delete(id)
const speech = require('../miniprogram/utils/speech')
const unsubscribe = speech.subscribe(s => { state = s })
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
async function test(name, run) {
  speech.stop(); contexts = []; loads = []; toasts = []; timers = new Map()
  packageLoader.load = name => { loads.push(name); return Promise.resolve({ready:true}) }
  global.wx = {
    showToast(options) { toasts.push(options.title) },
    createInnerAudioContext() {
      const callbacks = {}, context = { callbacks, played:0, stopped:0, destroyed:0,
        onPlay(fn) { callbacks.play = fn }, onWaiting(fn) { callbacks.waiting = fn }, onEnded(fn) { callbacks.ended = fn }, onError(fn) { callbacks.error = fn }, onTimeUpdate(fn) { callbacks.time = fn },
        stop() { this.stopped++ }, destroy() { this.destroyed++ }, play() { this.played++ } }
      contexts.push(context); return context
    }
  }
  await run(); speech.stop(); count++; console.log('PASS ' + name)
}
timers = new Map()
async function main() {
  try {
    await test('全部内置语料均有非空 MP3；主包、每个分包和总包均在预算内', () => {
      const corpus = require('../tools/speech-corpus')
      const project = require('../project.config.json'), local = require('../project.private.config.json')
      assert.equal(project.setting.ignoreUploadUnusedFiles, false)
      assert.equal(local.setting.ignoreDevUnusedFiles, false)
      assert.ok(project.packOptions.include.some(rule => rule.type === 'folder' && rule.value === 'audio'))
      assert.equal(corpus.length, Object.keys(manifest).length)
      for (const row of corpus) { assert.ok(manifest[row.id], row.text); assert.ok(fs.statSync(path.join(__dirname, '../miniprogram', manifest[row.id])).size > 300) }
      const app = require('../miniprogram/app.json'), sizes = new Map(app.subPackages.map(p => [p.root, 0])); let main = 0
      function walk(dir) { for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
        const file = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(file)
        else { const relative = path.relative(path.join(__dirname, '../miniprogram'), file).replace(/\\/g, '/'), root = [...sizes.keys()].find(p => relative.startsWith(p + '/')); if (root) sizes.set(root, sizes.get(root) + fs.statSync(file).size); else main += fs.statSync(file).size }
      } }
      walk(path.join(__dirname, '../miniprogram'))
      assert.ok(main < 2 * 1024 * 1024)
      assert.ok([...sizes.values()].every(n => n < 1.7e6)); assert.ok(main + [...sizes.values()].reduce((a,b)=>a+b,0) < 20 * 1024 * 1024)
    })
    await test('混合文本仅读英文、标点分句、长段落按词边界分块', () => {
      assert.equal(english('他说：Hello, friend! 中文结束。'), 'Hello, friend!')
      assert.deepEqual(parts('Rest. Meet. Keep going.'), ['Rest.', 'Meet.', 'Keep going.'])
      assert.deepEqual(parts('只有中文🦋'), [])
      const chunks = parts('mountain '.repeat(100)); assert.ok(chunks.every(s => s.length <= 400)); assert.equal(chunks.join(' '), 'mountain '.repeat(100).trim())
      assert.equal(key('Bird.'), key('bird'))
    })
    await test('仅点击才播放；状态等待真实 onPlay；同按钮再次点击停止', async () => {
      speech.speak('bird', {owner:'button'}); assert.equal(state.status, 'loading'); await tick()
      assert.equal(contexts.length, 1); assert.equal(contexts[0].played, 1); assert.equal(state.status, 'loading')
      contexts[0].callbacks.play(); assert.equal(state.status, 'playing')
      speech.speak('bird', {owner:'button'}); assert.equal(state.status, 'idle'); assert.equal(contexts[0].destroyed, 1)
    })
    await test('整篇连续朗读按队列播放，每句只在上一句结束后启动', async () => {
      speech.speak(['bird', 'squirrel'], {owner:'article'}); await tick(); const first = contexts[0]
      assert.equal(state.total, 2); assert.equal(contexts.length, 1)
      first.callbacks.play(); first.callbacks.ended(); await tick()
      assert.equal(contexts.length, 2); assert.equal(first.destroyed, 1); assert.equal(state.index, 1)
      contexts[1].callbacks.ended(); assert.equal(state.status, 'idle'); assert.equal(timers.size, 0)
    })
    await test('切换声音销毁旧音频，迟到回调不能打断新声音', async () => {
      speech.speak('bird', {owner:'a'}); await tick(); const old = contexts[0]
      speech.speak('squirrel', {owner:'b'}); await tick(); assert.equal(old.destroyed, 1)
      old.callbacks.error(); old.callbacks.ended(); assert.equal(state.owner, 'b'); assert.equal(toasts.length, 0); assert.equal(contexts.length, 2)
      speech.stop('a'); assert.equal(state.owner, 'b'); speech.stop('b'); assert.equal(state.status, 'idle')
    })
    await test('页面隐藏时取消尚未完成的分包加载，完成后不偷偷播放', async () => {
      // Fresh module to avoid the successful package cache from previous cases.
      delete require.cache[require.resolve('../miniprogram/utils/speech')]
      const player = require('../miniprogram/utils/speech'); let loading
      packageLoader.load = () => new Promise(resolve => { loading = resolve })
      player.speak('bird', {owner:'hidden'}); player.stop(); loading(); await tick()
      assert.equal(contexts.length, 0); player.stop()
    })
    await test('分包失败会提示并允许重新加载；停止清除超时', async () => {
      delete require.cache[require.resolve('../miniprogram/utils/speech')]
      const player = require('../miniprogram/utils/speech'); let attempts = 0
      packageLoader.load = () => { attempts++; return attempts === 1 ? Promise.reject(Error('offline')) : Promise.resolve({ready:true}) }
      player.speak('bird'); await tick(); assert.equal(toasts.length, 1)
      player.speak('bird'); await tick(); assert.equal(attempts, 2); assert.equal(contexts.length, 1); player.stop(); assert.equal(timers.size, 0)
    })
    await test('播放报错和超时均停止且可重试', async () => {
      speech.speak('bird'); await tick(); contexts[0].callbacks.error(); assert.equal(state.status, 'error'); assert.equal(toasts.length, 1)
      speech.speak('bird'); await tick(); assert.equal(contexts.length, 2)
      const callbacks = [...timers.values()]; callbacks[callbacks.length - 1](); assert.equal(state.status, 'error'); assert.equal(toasts.length, 2)
    })
    await test('纯中文不启动播放器；任意英文在未配置云端时如实提示', async () => {
      speech.speak('只有中文'); await tick(); assert.equal(contexts.length, 0)
      speech.speak('An unrecorded personal message.'); await tick(); assert.equal(state.status, 'error'); assert.match(toasts[0], /云端/); assert.equal(contexts.length, 0)
    })
    await test('自定义文本只调用自有云函数；取消后的迟到结果不落盘', async () => {
      config.envId = 'test'; let respond, request, writes = 0
      wx.cloud = {init(){},callFunction(options){ request = options; return new Promise(resolve => { respond = resolve }) }}
      wx.getFileSystemManager = () => ({writeFile(){writes++}})
      speech.speak('My private new sentence.'); await tick(); assert.equal(request.name, 'trailSpeech'); assert.equal(request.data.text, 'My private new sentence.')
      speech.stop(); respond({result:{ok:true,audio:'a'.repeat(100)}}); await tick(); assert.equal(writes, 0); assert.equal(contexts.length, 0); config.envId = ''
    })
    await test('听读组件文本变更、卸载及切页停止自己的声音', async () => {
      let definition; global.Component = d => { definition = d }; require('../miniprogram/components/speech-button/speech-button')
      const button = { ...definition.methods, properties:{text:'bird',segments:[],label:'听读',compact:false}, data:{...definition.data},setData(p){Object.assign(this.data,p)} }
      definition.lifetimes.attached.call(button); assert.equal(button.data.readable, true)
      button.toggle(); await tick(); definition.pageLifetimes.hide.call(button); assert.equal(button.data.active, false)
      button.properties.text = '中文'; definition.observers['text, segments'].call(button); assert.equal(button.data.readable, false)
      definition.lifetimes.detached.call(button)
    })
    await test('云端临时音频播放结束或写入失败时清理文件', async () => {
      config.envId='test'; let removed = [], failWrite = false
      wx.env={USER_DATA_PATH:'/private'}
      wx.cloud={init(){},async callFunction(){return {result:{ok:true,audio:Buffer.alloc(100).toString('base64')}}}}
      wx.getFileSystemManager=()=>({writeFile(options){failWrite?options.fail(Error('disk full')):options.success()},unlink(options){removed.push(options.filePath)}})
      speech.speak('A custom sentence for cleanup.'); await tick(); assert.equal(contexts.length,1); assert.ok(contexts[0].src.startsWith('/private/speech-'))
      contexts[0].callbacks.ended(); assert.equal(removed.length,1)
      failWrite=true; speech.speak('Another custom sentence for cleanup.'); await tick(); assert.equal(removed.length,2); assert.equal(state.status,'error'); config.envId=''
    })
    await test('云端拒绝匿名、非英文、超长与 SSML，未启用时不计费', async () => {
      let requests = 0; const svc = createService({enabled:()=>false,reserve:async()=>{requests++;return true},synthesize:async()=>{requests++}})
      for (const [text,uid] of [['hello',''],['中文','u'],['x'.repeat(401),'u'],['<speak>Hi</speak>','u'],['hello','u']]) assert.equal((await svc({text},uid)).ok, false)
      assert.equal(requests, 0)
    })
    await test('云端额度优先、鉴权使用调用身份，供应商错误不泄漏详情', async () => {
      let uid, calls = 0; const svc = createService({enabled:()=>true,reserve:async id=>{uid=id;return false},synthesize:async()=>{calls++}})
      assert.equal((await svc({text:'Hello',openid:'spoof'},'real')).ok, false); assert.equal(uid,'real'); assert.equal(calls,0)
      const broken = createService({enabled:()=>true,reserve:async()=>true,synthesize:async()=>{throw Error('secret internal error')}})
      assert.deepEqual(await broken({text:'Hello'},'u'), {ok:false,message:'云端朗读暂不可用，请稍后重试。'})
      const good = createService({enabled:()=>true,reserve:async()=>true,synthesize:async()=>Buffer.alloc(100).toString('base64')})
      assert.equal((await good({text:'Hello'},'u')).ok, true)
    })
    console.log(`${count} speech tests passed.`)
  } finally { speech.stop(); unsubscribe(); config.envId=''; [global.setTimeout, global.clearTimeout] = originalTimers }
}
main().catch(error => { console.error(error); process.exitCode=1 })
