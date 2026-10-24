const assert = require('node:assert/strict')
const { MOUNTAINS } = require('../miniprogram/utils/trailData')
const engine = require('../miniprogram/utils/wordEngine')
const storage = require('../miniprogram/utils/storage')
const { BOOKS, getRouteMountain } = require('../miniprogram/utils/wordCatalog')
const { DAY, RETRY_DELAY } = require('../miniprogram/utils/reviewSchedule')
const StudySession = require('../miniprogram/utils/studySession')
const { TrailScene, routePoint, groundY } = require('../miniprogram/utils/trailScene')
const { createCanvas } = require('./canvasStub')
const definitions = {}
for (const name of ['index', 'trail', 'word', 'summit']) {
  global.Page = (definition) => { definitions[name] = definition }
  require(`../miniprogram/pages/${name}/${name}`)
}
let sheetDefinition
global.Component = (definition) => { sheetDefinition = definition }
require('../miniprogram/components/study-sheet/study-sheet')

function attachSheet(trail) {
  const sheet = {
    ...sheetDefinition.methods,
    properties: { mountainId: trail.mountainId, bookId: trail.bookId, mode: trail.data.studyMode },
    data: {},
    setData(patch) { Object.assign(this.data, patch) },
    triggerEvent(name, detail) {
      const handler = { progress: 'onStudyProgress', complete: 'onStudyComplete', close: 'onStudyClose' }[name]
      trail[handler]({ detail })
    }
  }
  trail.sheet = sheet
  trail.selectComponent = () => sheet
  sheetDefinition.lifetimes.attached.call(sheet)
  return sheet
}

let saved, now, timers, frames, timerId, frameId, stack, maxDepth, redirects, selectorCallback
const realNow = Date.now
const realSetTimeout = global.setTimeout
const realClearTimeout = global.clearTimeout

function page(name) {
  return {
    ...definitions[name],
    route: `pages/${name}/${name}`,
    data: structuredClone(definitions[name].data),
    setData(patch) { Object.assign(this.data, patch) }
  }
}

function mount(url) {
  const [route, query = ''] = url.replace(/^\//, '').split('?')
  const p = page(route.split('/')[1])
  stack.push(p)
  maxDepth = Math.max(maxDepth, stack.length)
  if (p.onLoad) p.onLoad(Object.fromEntries(new URLSearchParams(query)))
  if (p.onShow && stack[stack.length - 1] === p) p.onShow()
  // 导航模拟不自动建立 Canvas，场景用实际绘制模块和受检画布桩验证。
  return p
}

function reset() {
  saved = new Map()
  now = Date.parse('2026-10-22T00:00:00Z')
  timers = new Map()
  frames = new Map()
  timerId = 0
  frameId = 0
  stack = []
  redirects = []
  maxDepth = 0
  selectorCallback = null
  Date.now = () => now
  global.setTimeout = (fn, delay) => {
    const id = ++timerId
    timers.set(id, { fn, at: now + delay })
    return id
  }
  global.clearTimeout = (id) => timers.delete(id)
  global.getApp = () => ({ globalData: { groupSize: 5 } })
  global.getCurrentPages = () => stack
  global.wx = {
    getStorageSync: (key) => saved.has(key) ? structuredClone(saved.get(key)) : '',
    setStorageSync: (key, value) => saved.set(key, structuredClone(value)),
    removeStorageSync: (key) => saved.delete(key),
    setNavigationBarTitle() {},
    showModal(options) { options.success({ confirm: true }) },
    createSelectorQuery: () => ({
      select() { return this }, node() { return this },
      exec(callback) { selectorCallback = callback }
    }),
    navigateTo({ url }) {
      const current = stack[stack.length - 1]
      if (current && current.onHide) current.onHide()
      mount(url)
    },
    redirectTo({ url }) {
      redirects.push(url)
      const current = stack.pop()
      if (current && current.onUnload) current.onUnload()
      mount(url)
    },
    navigateBack() {
      const current = stack.pop()
      if (current && current.onUnload) current.onUnload()
      const previous = stack[stack.length - 1]
      if (previous && previous.onShow) previous.onShow()
    },
    reLaunch({ url }) {
      stack.forEach((p) => { if (p.onUnload) p.onUnload() })
      stack = []
      mount(url)
    }
  }
  storage.setSelectedBook('classic')
}

function tick(ms) {
  const end = now + ms
  for (let guard = 0; guard < 10000; guard++) {
    const next = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
    if (!next) { now = end; return }
    timers.delete(next[0])
    now = next[1].at
    next[1].fn()
  }
  throw new Error('定时器没有收敛')
}

function answer(p, correct = true) {
  const idx = p.data.currentQuiz.options.findIndex((o) => o.correct === correct)
  p.chooseOption({ currentTarget: { dataset: { idx } } })
}

function finishQuiz(p) {
  while (p.data.stage === 'learn') p.nextCard()
  while (p.data.stage === 'quiz') { answer(p); tick(650) }
}

function world(id = 0) {
  const p = page('trail')
  p.onLoad({ id })
  p.onShow()
  p.canvas = createCanvas()
  p.canvas.requestAnimationFrame = (fn) => { const id = ++frameId; frames.set(id, fn); return id }
  p.canvas.cancelAnimationFrame = (id) => frames.delete(id)
  p.buildWorld()
  p.ready = true
  p.refreshProgress()
  return p
}

let passed = 0
let total = 0
function test(name, fn) {
  total++
  reset()
  try { fn(); passed++; console.log(`PASS ${name}`) }
  catch (error) { console.error(`FAIL ${name}\n${error.stack}`); process.exitCode = 1 }
}

test('七山覆盖 370 个不同单词；尾组不补重复词，通关不再发词', () => {
  const seen = new Set()
  for (const m of MOUNTAINS) {
    assert.equal(engine.getMountainWords(m.id).length, m.totalWords)
    while (!storage.isMountainDone(m.id)) {
      const group = engine.getNextGroup(m.id, 7)
      assert.ok(group.length > 0 && group.length <= 7)
      group.forEach((word) => { assert.ok(!seen.has(word.w)); seen.add(word.w) })
      storage.recordGroup(m.id, engine.summarizeGroup(group, {}), 12000)
    }
    assert.deepEqual(engine.getNextGroup(m.id, 5), [])
  }
  assert.equal(seen.size, 370)
  assert.equal(storage.getProgress().totalLearned, 370)
  assert.deepEqual(engine.getNextGroup(999, 5), [])
})

test('旧版完整存档迁移为 225 词；备份不变，补学后达到 370 词', () => {
  const old = { mountains: {}, totalLearned: 370, totalMinutes: 100 }
  for (const m of MOUNTAINS) {
    const words = Object.fromEntries(engine.loadWords(m.level).slice(0, m.totalWords)
      .map((w) => [w.w, { wrong: 1, learnedAt: now }]))
    old.mountains[m.id] = { words, learnedCount: m.totalWords, startedAt: now - 100000, completedAt: now }
  }
  saved.set('we_progress_v1', structuredClone(old))
  saved.delete('we_progress_v3')
  assert.equal(storage.initProgress().totalLearned, 225)
  assert.deepEqual(saved.get('we_progress_v1'), old)
  assert.equal(storage.getMountainProgress(0).words.trail.wrong, 2)
  assert.equal(storage.getMountainProgress(3).completedAt, null)
  assert.equal(storage.getMountainProgress(0).durationIncomplete, true)
  assert.equal(storage.initProgress().totalLearned, 225)
  for (const m of MOUNTAINS) {
    while (!storage.isMountainDone(m.id)) {
      storage.recordGroup(m.id, engine.summarizeGroup(engine.getNextGroup(m.id, 5), {}), 60000)
    }
  }
  assert.equal(storage.getProgress().totalLearned, 370)
  const certificate = page('summit')
  certificate.onLoad({ id: 0 })
  assert.equal(certificate.data.durationText, '—')
  assert.equal(certificate.data.durationNote, '旧记录未完整计时')
  storage.resetAll()
  assert.equal(storage.getProgress().totalLearned, 0)
  assert.equal(saved.has('we_progress_v1'), false)
})

test('外山词不能计数；重置单山同步扣除本版本学习用时', () => {
  storage.recordGroup(0, [{ w: 'ability', passed: true }], 0)
  assert.equal(storage.getProgress().totalLearned, 0)
  storage.recordGroup(0, engine.summarizeGroup(engine.getNextGroup(0, 5), {}), 120000)
  assert.equal(storage.getProgress().totalMinutes, 2)
  storage.resetMountain(0)
  assert.equal(storage.getProgress().totalLearned, 0)
  assert.equal(storage.getProgress().totalMinutes, 0)
})

test('答错须重试；连续点击不重复作答，完成不会重复保存', () => {
  const p = mount('/pages/word/word?mountainId=0')
  p.startQuiz()
  const first = p.data.currentQuiz.word.w
  answer(p, false)
  answer(p, false)
  assert.equal(p.data.wrongTotal, 1)
  tick(1200)
  finishQuiz(p)
  assert.equal(p.data.passedCount, 5)
  assert.equal(storage.getMountainProgress(0).words[first].wrong, 1)
  const snapshot = storage.getProgress()
  p.finishUp()
  assert.deepEqual(storage.getProgress(), snapshot)
})

test('中途后台停留不计时；隐藏时暂停答题回调，返回可继续', () => {
  const p = mount('/pages/word/word?mountainId=0')
  tick(60000)
  p.startQuiz()
  answer(p)
  tick(200)
  p.onHide()
  tick(10 * 24 * 60 * 60000)
  assert.equal(p.session.quizIndex, 0)
  assert.equal(timers.size, 0)
  p.onShow()
  tick(450)
  assert.equal(p.session.quizIndex, 1)
  finishQuiz(p)
  assert.equal(storage.getMountainProgress(0).studyMs, 60000 + 5 * 650)
})

test('最后一题答完后退出并重置，旧回调不能写回进度', () => {
  const p = mount('/pages/word/word?mountainId=0')
  p.startQuiz()
  for (let i = 0; i < 4; i++) { answer(p); tick(650) }
  answer(p)
  const staleCallback = [...timers.values()][0].fn
  p.onUnload()
  storage.resetAll()
  tick(5000)
  staleCallback()
  assert.equal(storage.getProgress().totalLearned, 0)
  assert.equal(timers.size, 0)
})

test('中途离开保留有效学习时间，重复卸载不重复计时', () => {
  const p = mount('/pages/word/word?mountainId=0')
  tick(12000)
  p.onHide()
  p.onUnload()
  p.onUnload()
  assert.equal(storage.getMountainProgress(0).studyMs, 12000)
  assert.equal(storage.getProgress().totalLearned, 0)
})

test('第一组 20 分钟加后续 7 分钟，证书显示 27 分钟', () => {
  for (let i = 0; i < 8; i++) {
    const p = mount('/pages/word/word?mountainId=0')
    tick((i === 0 ? 20 : 1) * 60000)
    finishQuiz(p)
    p.onUnload()
    stack = []
  }
  const certificate = page('summit')
  certificate.onLoad({ id: 0 })
  assert.equal(certificate.data.durationText, '27分钟')
  assert.equal(storage.getMountainProgress(0).studyMs, 27 * 60000 + 40 * 650)
})

test('山道面板完成七山，页面栈最多 2 层，证书下不残留山道', () => {
  mount('/pages/index/index')
  wx.navigateTo({ url: '/pages/trail/trail?id=0' })
  for (const m of MOUNTAINS) {
    while (!storage.isMountainDone(m.id)) {
      const trail = stack[stack.length - 1]
      trail.goLearn()
      const p = attachSheet(trail)
      assert.equal(trail.data.studyOpen, true)
      finishQuiz(p)
      p.nextAction()
      assert.equal(stack[stack.length - 1].route, 'pages/trail/trail')
    }
    stack[stack.length - 1].openSummit()
    assert.equal(stack.length, 2)
    assert.equal(stack.filter((p) => p.route === 'pages/trail/trail').length, 0)
    if (m.id < 6) stack[stack.length - 1].nextMountainGo()
  }
  assert.equal(maxDepth, 2)
  assert.equal(storage.getProgress().totalLearned, 370)
})

test('Canvas 仅在 onReady 查询；空节点可重试，退出后回调不初始化', () => {
  const p = mount('/pages/trail/trail?id=0')
  assert.equal(selectorCallback, null)
  p.onReady()
  const logError = console.error
  console.error = () => {}
  try { selectorCallback([null]) } finally { console.error = logError }
  assert.equal(p.data.sceneError, true)
  assert.equal(p.data.loading, false)
  p.initScene()
  const callback = selectorCallback
  let built = false
  p.buildWorld = () => { built = true }
  p.onUnload()
  callback([{ node: {} }])
  assert.equal(built, false)
})

test('场景隐藏/重显保持单个动画循环；登顶延迟在离开时取消', () => {
  const p = world()
  p.loop()
  p.loop()
  assert.equal(frames.size, 1)
  p.onHide()
  assert.equal(frames.size, 0)
  p.onShow()
  assert.equal(frames.size, 1)
  p.onHide()
  p.currentT = 1
  p.targetT = 1
  p.data.done = true
  p.summitPending = true
  p.paused = false
  p.loop()
  const stale = [...timers.values()][0].fn
  p.onUnload()
  assert.equal(timers.size, 0)
  assert.equal(frames.size, 0)
  tick(5000)
  stale()
  assert.deepEqual(redirects, [])
})

test('场景销毁取消图片回调并释放缓存，重复销毁安全', () => {
  const p = world(), renderer = p.renderer, image = renderer.pendingImage
  const stale = image.onload
  p.onUnload()
  p.disposeWorld()
  stale()
  assert.equal(image.onload, null)
  assert.equal(renderer.disposed, true)
  assert.equal(renderer.background, null)
  assert.equal(renderer.ctx, null)
  assert.equal(p.canvas, null)
  assert.equal(frames.size, 0)
})

test('登顶延迟在前后台切换后重新开始，证书只跳转一次', () => {
  storage.recordGroup(0, engine.summarizeGroup(engine.getMountainWords(0), {}), 60000)
  const p = world()
  stack = [p]
  p.summitPending = true
  p.loop()
  p.onHide()
  tick(5000)
  assert.equal(redirects.length, 0)
  p.onShow()
  tick(1799)
  assert.equal(redirects.length, 0)
  tick(1)
  assert.deepEqual(redirects, ['/pages/summit/summit?id=0&book=classic'])
  assert.equal(p.destroyed, true)
  assert.equal(frames.size, 0)
})

test('七山 2.5D 山道始终上坡，人物位置与路面一致，横竖屏绘制有效', () => {
  for (const mountain of MOUNTAINS) {
    let previous = routePoint(0, mountain.scene.seed)
    for (let n = 1; n <= 1000; n++) {
      const p = routePoint(n / 1000, mountain.scene.seed)
      assert.ok(p.x > previous.x && p.y < previous.y)
      assert.equal(p.y, groundY(p.x, mountain.scene.seed))
      previous = p
    }
    const canvas = createCanvas()
    const scene = new TrailScene(canvas, mountain, { width: 390, height: 844, pixelRatio: 3 })
    for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [844, 390]]) {
      scene.resize(width, height, 3)
      for (const progress of [0, 0.25, 0.5, 0.85, 1]) {
        for (const studyOpen of [false, true]) {
          const state = { progress, studyOpen, time: 0, walking: true, walkTime: 1 }
          scene.render(state)
          const view = scene.lastView
          const x = (view.point.x - view.cameraX) * view.scale
          const y = (view.point.y - view.cameraY) * view.scale
          assert.ok(x > 0 && x < width && y > 0 && y < height)
          if (studyOpen) assert.ok(y < height * 0.29)
          assert.equal(canvas.width, width * 2)
        }
      }
    }
    scene.dispose()
  }
})

test('观景拖拽与缩放不改学习进度，手势切换不跳变，回中可恢复', () => {
  const p = world(), before = storage.getProgress()
  p.onTouchStart({ touches: [{ clientX: 200, clientY: 200 }] })
  p.onTouchMove({ touches: [{ clientX: 100, clientY: 200 }] })
  assert.ok(p.pan > 0)
  assert.equal(p.data.lookingAround, true)
  p.onTouchMove({ touches: [{ clientX: 100, clientY: 200 }, { clientX: 200, clientY: 200 }] })
  assert.equal(p.zoom, 1)
  p.onTouchMove({ touches: [{ clientX: 20, clientY: 200 }, { clientX: 350, clientY: 200 }] })
  assert.equal(p.zoom, 1.45)
  p.onTouchEnd({ touches: [{ clientX: 350, clientY: 200 }] })
  p.onTouchMove({ touches: [{ clientX: 340, clientY: 200 }] })
  assert.ok(p.pan <= 180)
  assert.deepEqual(storage.getProgress(), before)
  assert.equal(p.targetT, 0)
  p.resetView()
  assert.equal(p.zoom, 1)
  assert.equal(p.pan, 0)
  assert.equal(p.data.lookingAround, false)
  p.zoom = 1.45
  p.pan = 150
  p.goLearn()
  assert.equal(p.zoom, 1)
  assert.equal(p.pan, 0)
  p.onUnload()
})

test('背景失败仍能学习，迟到的图片在后台不绘制，重显后显示', () => {
  const p = world(), canvas = p.canvas
  const image = p.renderer.pendingImage
  image.onerror()
  assert.equal(p.data.artFallback, true)
  p.goLearn()
  const sheet = attachSheet(p)
  finishQuiz(sheet)
  assert.equal(storage.getProgress().totalLearned, 5)
  sheet.close()
  p.onHide()
  const count = canvas.calls.length
  image.onload()
  assert.equal(canvas.calls.length, count)
  p.onShow()
  assert.ok(canvas.calls.slice(count).some((call) => call.method === 'drawImage'))
  p.onUnload()
})

test('Canvas 改变尺寸后更新像素比例，离开后的 resize 无副作用', () => {
  const p = world()
  wx.getWindowInfo = () => ({ windowWidth: 768, windowHeight: 1024, pixelRatio: 3, statusBarHeight: 24 })
  p.onResize({ size: { windowWidth: 768, windowHeight: 1024 } })
  assert.equal(p.canvas.width, 1536)
  assert.equal(p.canvas.height, 2048)
  assert.equal(p.renderer.width, 768)
  p.onUnload()
  p.onResize({ size: { windowWidth: 320, windowHeight: 568 } })
  assert.equal(p.canvas, null)
})

test('全新用户默认日常词书；四本词书各自无重复地覆盖七座山', () => {
  saved.clear()
  assert.equal(storage.getSelectedBook(), 'easy')
  for (const book of BOOKS.filter((b) => b.id !== 'classic')) {
    const all = []
    for (const m of MOUNTAINS) {
      const route = getRouteMountain(m.id, book.id)
      assert.equal(route.level, book.id)
      const words = engine.getMountainWords(m.id, book.id)
      assert.equal(route.totalWords, words.length)
      assert.ok(words.length >= 4)
      all.push(...words.map((w) => w.w))
    }
    assert.equal(all.length, book.count)
    assert.equal(new Set(all).size, book.count)
  }
})

test('切换词书保留独立进度，已打开的学习固定写入原词书', () => {
  storage.setSelectedBook('cet4')
  const p = mount('/pages/word/word?mountainId=0&book=cet4')
  storage.setSelectedBook('cet6')
  finishQuiz(p)
  assert.equal(storage.getProgress('cet4').totalLearned, 5)
  assert.equal(storage.getProgress('cet6').totalLearned, 0)
  assert.equal(storage.getProgress('classic').totalLearned, 0)
  storage.setSelectedBook('cet4')
  assert.equal(storage.getProgress().totalLearned, 5)
})

test('v2 升级保留原路线计时和备份，导入已学词但不伪造掌握度', () => {
  const old = { version: 2, mountains: {}, totalLearned: 5, totalMinutes: 27, legacyStudyMs: 0 }
  MOUNTAINS.forEach((m) => {
    old.mountains[m.id] = { words: {}, learnedCount: 0, startedAt: null, completedAt: null, studyMs: 0, durationIncomplete: false }
  })
  old.mountains[0] = {
    words: Object.fromEntries(engine.getMountainWords(0).slice(0, 5).map((w) => [w.w, { wrong: 0, learnedAt: now - DAY }])),
    learnedCount: 5, startedAt: now - DAY - 27 * 60000, completedAt: null, studyMs: 27 * 60000, durationIncomplete: false
  }
  saved.clear()
  saved.set('we_progress_v2', structuredClone(old))
  assert.equal(storage.getSelectedBook(), 'classic')
  assert.equal(storage.getMountainProgress(0).studyMs, 27 * 60000)
  assert.equal(storage.getMountainProgress(0).durationIncomplete, false)
  assert.equal(storage.getProgress('easy').totalLearned, 5)
  assert.equal(storage.getMemorySummary('classic').dueCount, 5)
  assert.equal(storage.getMemorySummary('classic').masteredCount, 0)
  assert.deepEqual(saved.get('we_progress_v2'), old)
})

test('新词次日复习，正确复习间隔递增，重复提交不增加掌握或已学数', () => {
  storage.setSelectedBook('easy')
  const group = engine.getNextGroup(0, 5)
  const results = engine.summarizeGroup(group, {})
  storage.recordGroup(0, results, 60000)
  assert.equal(storage.getMemorySummary('easy').dueCount, 0)
  tick(DAY)
  assert.equal(engine.getReviewGroup(0, 5).length, 5)
  assert.equal(storage.recordReview(0, results, 1000).reviewed, 5)
  assert.equal(storage.recordReview(0, results, 0).reviewed, 0)
  assert.equal(storage.getMemorySummary('easy').masteredCount, 0)
  tick(3 * DAY)
  storage.recordReview(0, results, 1000)
  assert.equal(storage.getMemorySummary('easy').masteredCount, 0)
  tick(7 * DAY)
  storage.recordReview(0, results, 1000)
  assert.equal(storage.getMemorySummary('easy').masteredCount, 5)
  assert.equal(storage.getProgress().totalLearned, 5)
  assert.equal(storage.getMountainProgress(0).words[group[0].w].nextReviewAt, now + 14 * DAY)
})

test('错词十分钟后重现，同日纠错不会提高长期掌握度', () => {
  const group = engine.getNextGroup(0, 1)
  storage.recordGroup(0, [{ w: group[0].w, wrong: 1, passed: true }], 0)
  tick(RETRY_DELAY)
  assert.equal(engine.getReviewGroup(0, 5).length, 1)
  storage.recordReview(0, engine.summarizeGroup(group, {}), 0)
  let record = storage.getMountainProgress(0).words[group[0].w]
  assert.equal(record.reviewStep, 0)
  assert.equal(record.nextReviewAt, now + DAY)
  tick(DAY)
  storage.recordReview(0, engine.summarizeGroup(group, {}), 0)
  record = storage.getMountainProgress(0).words[group[0].w]
  assert.equal(record.reviewStep, 1)
})

test('营地在覆盖词隔天复习后点亮；再次到期后提示复习', () => {
  const results = engine.summarizeGroup(engine.getMountainWords(0), {})
  storage.recordGroup(0, results, 60000)
  assert.equal(storage.getMemorySummary('classic', 0).litCamps, 0)
  tick(DAY)
  storage.recordReview(0, results, 60000)
  assert.equal(storage.getMemorySummary('classic', 0).litCamps, 3)
  const p = world()
  assert.equal(p.renderer.camps[0].lit, true)
  tick(3 * DAY)
  p.refreshProgress()
  assert.equal(p.data.litCamps, 0)
  assert.equal(p.data.reviewDue, 40)
  assert.ok(p.renderer.camps[0].due)
  p.onUnload()
})

test('答对即时保存并改变山道目标位置，收起后从剩余新词继续', () => {
  const p = world()
  p.goLearn()
  const sheet = attachSheet(p)
  while (sheet.data.stage === 'learn') sheet.nextCard()
  const firstWord = sheet.data.currentQuiz.word.w
  answer(sheet)
  assert.equal(storage.getProgress().totalLearned, 1)
  assert.equal(p.targetT, 1 / 40)
  sheet.requestClose()
  assert.equal(p.data.studyOpen, false)
  assert.equal(timers.size, 0)
  p.goLearn()
  const next = attachSheet(p)
  assert.ok(next.session.group.every((w) => w.w !== firstWord))
  next.close()
  p.onUnload()
})

test('学习时静止场景停止刷新，答对只播放前进动画，收起恢复场景', () => {
  const p = world()
  p.loop()
  assert.equal(frames.size, 1)
  p.goLearn()
  const sheet = attachSheet(p)
  assert.equal(frames.size, 0)
  while (sheet.data.stage === 'learn') sheet.nextCard()
  answer(sheet)
  assert.equal(frames.size, 1)
  tick(650)
  for (let guard = 0; frames.size && guard < 300; guard++) {
    const [id, frame] = [...frames][0]
    frames.delete(id)
    now += 1000 / 60
    frame()
  }
  assert.equal(frames.size, 0)
  assert.equal(p.currentT, p.targetT)
  sheet.close()
  assert.equal(frames.size, 1)
  p.onUnload()
})

test('复习直接进入回忆测验；不会重复增加已学单词', () => {
  storage.recordGroup(0, engine.summarizeGroup(engine.getNextGroup(0, 5), {}), 0)
  tick(DAY)
  const p = mount('/pages/trail/trail?id=0&book=classic')
  p.goReview()
  const sheet = attachSheet(p)
  assert.equal(sheet.data.stage, 'quiz')
  answer(sheet, false)
  tick(1200)
  finishQuiz(sheet)
  assert.equal(sheet.data.resultInfo.reviewed, 5)
  assert.equal(sheet.data.resultInfo.newlyLearned, 0)
  assert.equal(storage.getProgress().totalLearned, 5)
  assert.equal(engine.getReviewGroup(0, 5).length, 0)
  sheet.close()
  tick(RETRY_DELAY)
  assert.equal(engine.getReviewGroup(0, 5).length, 1)
})

test('已掌握词复习答错后退出，也会降低掌握度并安排重试', () => {
  const results = engine.summarizeGroup(engine.getNextGroup(0, 1), {})
  storage.recordGroup(0, results, 0)
  for (const days of [1, 3, 7]) { tick(days * DAY); storage.recordReview(0, results, 0) }
  assert.equal(storage.getMemorySummary('classic').masteredCount, 1)
  tick(14 * DAY)
  const session = new StudySession({ mountainId: 0, bookId: 'classic', mode: 'review' })
  session.resume()
  session.chooseOption(session.data.currentQuiz.options.findIndex((o) => !o.correct))
  session.destroy()
  assert.equal(storage.getMemorySummary('classic').masteredCount, 0)
  assert.equal(storage.getMountainProgress(0).words[results[0].w].nextReviewAt, now + RETRY_DELAY)
  assert.equal(timers.size, 0)
})

test('已登顶山道重新进入可复习，不会自动跳走；最后一词结果面板不会被证书打断', () => {
  const pool = engine.getMountainWords(0)
  storage.recordGroup(0, engine.summarizeGroup(pool.slice(0, -1), {}), 0)
  const p = world()
  p.goLearn()
  const sheet = attachSheet(p)
  finishQuiz(sheet)
  assert.equal(p.summitPending, true)
  assert.equal(p.data.studyOpen, true)
  tick(5000)
  assert.equal(redirects.length, 0)
  sheet.close()
  p.onUnload()
  const reentered = world()
  reentered.loop()
  tick(5000)
  assert.equal(redirects.length, 0)
  reentered.onUnload()
})

test('面板的页面生命周期暂停计时和答题回调，返回后继续', () => {
  const p = world()
  p.goLearn()
  const sheet = attachSheet(p)
  while (sheet.data.stage === 'learn') sheet.nextCard()
  answer(sheet)
  tick(200)
  p.onHide()
  sheetDefinition.pageLifetimes.hide.call(sheet)
  assert.equal(frames.size, 0)
  assert.equal(timers.size, 0)
  tick(DAY)
  p.onShow()
  sheetDefinition.pageLifetimes.show.call(sheet)
  tick(450)
  assert.equal(sheet.session.quizIndex, 1)
  finishQuiz(sheet)
  assert.equal(storage.getMountainProgress(0).studyMs, 5 * 650)
  sheet.close()
  p.onUnload()
})

test('首页的复习入口携带词书和山峰，页面就绪后打开复习面板', () => {
  storage.setSelectedBook('cet4')
  storage.recordGroup(3, engine.summarizeGroup(engine.getNextGroup(3, 2, 'cet4'), {}), 0, 'cet4')
  tick(DAY)
  const index = mount('/pages/index/index')
  assert.equal(index.data.reviewDue, 2)
  index.goReview()
  const p = stack[stack.length - 1]
  assert.equal(p.bookId, 'cet4')
  assert.equal(p.mountainId, 3)
  p.onReady()
  assert.equal(p.data.studyOpen, true)
  const sheet = attachSheet(p)
  assert.equal(sheet.data.mode, 'review')
  assert.equal(sheet.data.groupSize, 2)
  sheet.close()
  p.onUnload()
})

Date.now = realNow
global.setTimeout = realSetTimeout
global.clearTimeout = realClearTimeout
console.log(`\n${passed}/${total} regression checks passed`)
