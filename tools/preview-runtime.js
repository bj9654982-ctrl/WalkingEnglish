/* Browser-only adapter for visual testing of the real mini-program templates. */
const modules = new Map()
async function loadModule(url) {
  if (modules.has(url)) return modules.get(url).exports
  const module = { exports: {} }; modules.set(url, module)
  const source = await fetch(url).then((r) => { if (!r.ok) throw Error(url); return r.text() })
  const resolve = (ref) => new URL(ref.endsWith('.js') ? ref : ref + '.js', location.origin + url).pathname
  for (const match of source.matchAll(/require\(['"]([^'"]+)['"]\)/g)) await loadModule(resolve(match[1]))
  const localRequire = ref => modules.get(resolve(ref)).exports
  localRequire.async = ref => loadModule(resolve(ref))
  new Function('require', 'module', 'exports', source + '\n//# sourceURL=' + url)(localRequire, module, module.exports)
  if (url === '/miniprogram/utils/paperDocument.js') {
    const catalog = await loadModule('/miniprogram/data/papers.js')
    // Browser-only original-PDF preview. The native app uses configured cloud files.
    module.exports = {open:id=>new Promise((resolve,reject)=>{
      if(!catalog.papers.some(p=>p.id===id)){reject(Error('Paper not found'));return}
      wx.openDocument({filePath:location.origin+'/paper-original/'+id+'.pdf',success:()=>resolve(true),fail:reject})
    })}
  }
  return module.exports
}
let pageDefinition, sheetDefinition, speechDefinition, lookupDefinition, page, sheet, template, sheetTemplate, speechTemplate, lookupTemplate, scheduled = false
const speechComponents = new Map()
let speechCursor = 0
const query = new URLSearchParams(location.search)
const pageName = query.get('page') || (query.has('id') ? 'trail' : 'index')
const tabNames = ['index', 'reading', 'practice', 'discover', 'profile']
const isTab = tabNames.includes(pageName)
function navigate(url, replace = false) {
  const [route, parameters = ''] = url.split('?'), name = route.split('/')[2]
  const next = '/tools/preview-phone.html?page=' + name + (parameters ? '&' + parameters : '')
  if (replace) location.replace(next); else location.assign(next)
}
window.Page = (definition) => { pageDefinition = definition }
window.Component = (definition) => { sheetDefinition = definition }
window.getApp = () => ({ globalData: { groupSize: 5 } })
window.getCurrentPages = () => [page]
const canvas = document.createElement('canvas')
canvas.createImage = () => new Image()
canvas.requestAnimationFrame = requestAnimationFrame.bind(window)
canvas.cancelAnimationFrame = cancelAnimationFrame.bind(window)
window.wx = {
  getStorageSync: (key) => JSON.parse(localStorage.getItem('trail-preview:' + key) || 'null'),
  setStorageSync: (key, value) => localStorage.setItem('trail-preview:' + key, JSON.stringify(value)),
  removeStorageSync: (key) => localStorage.removeItem('trail-preview:' + key),
  getWindowInfo: () => ({ windowWidth: innerWidth, windowHeight: innerHeight, statusBarHeight: 24, pixelRatio: devicePixelRatio }),
  getMenuButtonBoundingClientRect: () => ({ left: innerWidth - 88 }),
  createSelectorQuery: () => ({ select() { return this }, node() { return this }, exec(fn) { fn([{ node: canvas }]) } }),
  createOffscreenCanvas: ({ width, height }) => Object.assign(document.createElement('canvas'), { width, height }),
  showModal: ({ title, content, success }) => success({ confirm: confirm(title + '\n' + content) }),
  navigateBack: () => history.back(),
  navigateTo: ({ url }) => navigate(url),
  switchTab: ({ url }) => navigate(url, true),
  reLaunch: ({ url }) => navigate(url, true),
  redirectTo: ({ url }) => navigate(url, true),
  showToast: ({ title }) => { const message = parent.document.getElementById('result'); if (message) message.textContent = title },
  setNavigationBarTitle() {},
  pageScrollTo: ({scrollTop}) => window.scrollTo({top:scrollTop,behavior:'instant'}),
  downloadFile: ({url,success,fail}) => fetch(url,{method:'HEAD'}).then(r=>success({statusCode:r.status,tempFilePath:url})).catch(fail),
  openDocument: ({filePath,success,fail}) => { try { window.open(filePath,'_blank'); if(success)success() } catch(error) { if(fail)fail(error) } },
  showActionSheet: ({ itemList, success }) => { const choice = prompt(itemList.map((item, i) => (i + 1) + '. ' + item).join('\n')); if (choice && itemList[Number(choice) - 1]) success({ tapIndex: Number(choice) - 1 }) },
  createInnerAudioContext: () => {
    const media = new Audio(), handlers = {}, events = { Play: 'playing', Ended: 'ended', Error: 'error', Waiting: 'waiting', TimeUpdate: 'timeupdate' }
    const context = {
      set src(value) { media.src = value }, get src() { return media.src }, get currentTime() { return media.currentTime },
      stop() { media.pause(); media.currentTime = 0 },
      play() { media.play().catch(error => { if (handlers.Error) handlers.Error(error) }) },
      destroy() { Object.entries(events).forEach(([key, event]) => { if (handlers[key]) media.removeEventListener(event, handlers[key]) }); media.pause(); media.removeAttribute('src'); media.load() }
    }
    Object.entries(events).forEach(([key, event]) => { context['on' + key] = fn => { handlers[key] = fn; media.addEventListener(event, fn) } })
    return context
  }
}
const value = (code, data) => { try { return new Function('data', 'with(data){return (' + code + ')}')(data) } catch (_) { return '' } }
const evaluate = (text, data) => value(text.replace(/^\{\{|\}\}$/g, ''), data)
const interpolate = (text, data) => text.replace(/\{\{([\s\S]*?)\}\}/g, (_, code) => value(code, data) ?? '')
function children(nodes, data, owner, target) {
  let matched = false
  for (const node of nodes) {
    if (node.nodeType === 3) { target.append(document.createTextNode(interpolate(node.textContent, data))); continue }
    if (node.nodeType !== 1) continue
    if (node.hasAttribute('wx:if')) { matched = !!evaluate(node.getAttribute('wx:if'), data); if (!matched) continue }
    else if (node.hasAttribute('wx:elif')) { if (matched) continue; matched = !!evaluate(node.getAttribute('wx:elif'), data); if (!matched) continue }
    else if (node.hasAttribute('wx:else')) { if (matched) continue; matched = true }
    else matched = false
    if (node.hasAttribute('wx:for')) {
      const items = evaluate(node.getAttribute('wx:for'), data) || []
      items.forEach((item, index) => {
        const scope = { ...data, [node.getAttribute('wx:for-item') || 'item']: item, [node.getAttribute('wx:for-index') || 'index']: index }
        const clone = node.cloneNode(true); clone.removeAttribute('wx:for')
        renderNode(clone, scope, owner, target)
      })
    } else renderNode(node, data, owner, target)
  }
}
function renderNode(node, data, owner, target) {
  if (node.tagName.toLowerCase() === 'block') { children(node.childNodes, data, owner, target); return }
  if (node.tagName.toLowerCase() === 'lookup-text') {
    const properties={}
    for(const [name,info] of Object.entries(lookupDefinition.properties)){
      const attr=node.getAttribute(name)
      properties[name]=attr===null?info.value:attr.startsWith('{{')?evaluate(attr,data):attr
    }
    const component={...lookupDefinition.methods,properties,data:{tokens:[]},setData(patch){Object.assign(this.data,patch)}}
    lookupDefinition.lifetimes.attached.call(component)
    const el=document.createElement('lookup-text');el.style.display='inline'
    children(lookupTemplate.content.childNodes,component.data,component,el);target.append(el);return
  }
  if (node.tagName.toLowerCase() === 'speech-button') {
    const id = speechCursor++, properties = {}
    for (const [name, info] of Object.entries(speechDefinition.properties)) {
      const attr = node.getAttribute(name.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase()))
      properties[name] = attr === null ? structuredClone(info.value) : attr.startsWith('{{') ? evaluate(attr, data) : attr
      if (properties[name] == null) properties[name] = structuredClone(info.value)
    }
    let component = speechComponents.get(id)
    if (!component) {
      component = { ...speechDefinition.methods, properties, data: structuredClone(speechDefinition.data), setData(patch) { Object.assign(this.data, patch); scheduleRender() } }
      speechComponents.set(id, component); speechDefinition.lifetimes.attached.call(component)
    } else {
      const changed = component.properties.text !== properties.text || JSON.stringify(component.properties.segments) !== JSON.stringify(properties.segments)
      component.properties = properties
      if (changed) speechDefinition.observers['text, segments'].call(component)
    }
    const el = document.createElement('speech-button'); el.style.display = 'inline-block'
    children(speechTemplate.content.childNodes, { ...component.data, ...component.properties }, component, el); target.append(el); return
  }
  if (node.tagName.toLowerCase() === 'study-sheet') {
    if (!sheet) {
      sheet = { ...sheetDefinition.methods, properties: { mountainId: page.mountainId, bookId: page.bookId, mode: page.data.studyMode }, data: structuredClone(sheetDefinition.data),
        setData(patch) { Object.assign(this.data, patch); scheduleRender() },
        triggerEvent(name, detail) { page[{ progress: 'onStudyProgress', complete: 'onStudyComplete', close: 'onStudyClose' }[name]]({ detail }) }
      }
      sheetDefinition.lifetimes.attached.call(sheet)
    }
    const el = document.createElement('study-sheet')
    children(sheetTemplate.content.childNodes, sheet.data, sheet, el); target.append(el); return
  }
  const tag = node.tagName.toLowerCase()
  const el = tag === 'canvas' ? canvas : document.createElement(tag === 'image' ? 'img' : tag)
  for (const attribute of node.attributes) {
    if (attribute.name.startsWith('wx:')) continue
    if (attribute.name === 'bindtap' || attribute.name === 'catchtap') {
      el.onclick = event => { if (attribute.name === 'catchtap') event.stopPropagation(); owner[attribute.value]({ currentTarget: { dataset: el.dataset } }) }
    } else if (attribute.name === 'bindinput') {
      el.dataset.previewInput = attribute.value
      el.oninput = () => owner[attribute.value]({ detail: { value: el.value } })
    } else if (attribute.name === 'disabled') {
      if (evaluate(attribute.value, data)) el.disabled = true
    } else if (attribute.name === 'value') {
      el.value = interpolate(attribute.value, data)
    } else if (attribute.name === 'mode' && (tag === 'image' || tag === 'img')) {
      el.style.objectFit = attribute.value === 'aspectFill' ? 'cover' : 'contain'
    } else if (/^(bind|catch)touch/.test(attribute.name)) {
      const type = attribute.name.replace(/^(bind|catch)/, '')
      el['on' + type] = (event) => {
        if (attribute.name.startsWith('catch')) event.preventDefault()
        const box = el.getBoundingClientRect()
        owner[attribute.value]({ touches: [...event.touches].map((t) => ({ clientX: t.clientX - box.left, clientY: t.clientY - box.top })) })
      }
    } else el.setAttribute(attribute.name, interpolate(attribute.value, data))
  }
  children(node.childNodes, data, owner, el); target.append(el)
}
function render() {
  scheduled = false
  speechCursor = 0
  const active = document.activeElement
  const inputKey = active && active.dataset && active.dataset.previewInput
  const selection = inputKey ? active.selectionStart : null
  if (sheet && !page.data.studyOpen) { sheetDefinition.lifetimes.detached.call(sheet); sheet = null }
  const fragment = document.createDocumentFragment()
  children(template.content.childNodes, page.data, page, fragment)
  for (const [id, component] of speechComponents) if (id >= speechCursor) { speechDefinition.lifetimes.detached.call(component); speechComponents.delete(id) }
  document.getElementById('root').replaceChildren(fragment)
  if (inputKey) {
    const next = document.querySelector('[data-preview-input="' + inputKey + '"]')
    if (next) { next.focus(); if (next.setSelectionRange && selection != null) next.setSelectionRange(selection, selection) }
  }
}
function scheduleRender() { if (!scheduled) { scheduled = true; queueMicrotask(render) } }
async function boot() {
  await loadModule('/miniprogram/pages/' + pageName + '/' + pageName + '.js')
  await loadModule('/miniprogram/components/study-sheet/study-sheet.js')
  const studyDefinition = sheetDefinition
  await loadModule('/miniprogram/components/speech-button/speech-button.js')
  speechDefinition = sheetDefinition
  await loadModule('/miniprogram/components/lookup-text/lookup-text.js')
  lookupDefinition = sheetDefinition; sheetDefinition = studyDefinition
  async function loadCSS(url) {
    let css = await fetch(url).then((r) => r.text()), imports = ''
    for (const match of css.matchAll(/@import\s+['"]([^'"]+)['"];?/g)) imports += await loadCSS(new URL(match[1], location.origin + url).pathname)
    return imports + '\n' + css.replace(/@import[^;]+;/g, '')
  }
  const cssFiles = ['app', ...(pageName === 'trail' ? ['components/study-sheet/study-sheet'] : []), 'pages/' + pageName + '/' + pageName, 'components/speech-button/speech-button', 'components/lookup-text/lookup-text']
  const css = (await Promise.all(cssFiles.map((f) => loadCSS('/miniprogram/' + f + '.wxss')))).join('\n')
  const style = document.createElement('style')
  style.textContent = css.replace(/@import[^;]+;/g, '').replace(/(^|\n)\s*page\s*\{/g, '$1body {').replace(/(-?[\d.]+)rpx/g, 'calc($1 * var(--rpx))')
  document.head.append(style)
  const resize = () => document.documentElement.style.setProperty('--rpx', innerWidth / 750 + 'px')
  resize()
  template = document.createElement('template'); sheetTemplate = document.createElement('template'); speechTemplate = document.createElement('template')
  const markup = (source) => source.replace(/<([\w-]+)(\s[^<>]*?)?\/>/g, '<$1$2></$1>')
  template.innerHTML = markup(await fetch('/miniprogram/pages/' + pageName + '/' + pageName + '.wxml').then((r) => r.text()))
  sheetTemplate.innerHTML = markup(await fetch('/miniprogram/components/study-sheet/study-sheet.wxml').then((r) => r.text()))
  speechTemplate.innerHTML = markup(await fetch('/miniprogram/components/speech-button/speech-button.wxml').then((r) => r.text()))
  lookupTemplate=document.createElement('template')
  lookupTemplate.innerHTML=markup(await fetch('/miniprogram/components/lookup-text/lookup-text.wxml').then(r=>r.text()))
  page = { ...pageDefinition, route:'pages/'+pageName+'/'+pageName, data: structuredClone(pageDefinition.data), setData(patch) { Object.assign(this.data, patch); scheduleRender() }, selectComponent: () => sheet }
  const storage = modules.get('/miniprogram/utils/storage.js').exports
  const engine = modules.get('/miniprogram/utils/wordEngine.js').exports
  window.previewAdvance = () => {
    if (pageName !== 'trail') return wx.showToast({title:'先进入一座山，再演示前进。'})
    storage.recordGroup(page.mountainId, engine.summarizeGroup(engine.getNextGroup(page.mountainId, 1, page.bookId), {}), 0, page.bookId)
    page.onStudyProgress()
  }
  window.previewCamp = () => {
    if (pageName !== 'trail') return wx.showToast({title:'先进入一座山，再演示营地。'})
    storage.recordGroup(page.mountainId, engine.summarizeGroup(engine.getNextGroup(page.mountainId, Math.ceil(page.mountain.totalWords / 4), page.bookId), {}), 0, page.bookId)
    page.onStudyProgress()
  }
  if (isTab) {
    document.body.classList.add('with-tabs')
    const tabs = document.createElement('nav'); tabs.className = 'preview-tabs'
    const labels = ['单词','阅读','练习','发现','我的'], icons = ['words','reading','practice','discover','profile']
    tabs.innerHTML = tabNames.map((name, i) => '<button data-page="' + name + '" class="' + (name === pageName ? 'active' : '') + '"><img src="/assets/tabs/' + icons[i] + (name === pageName ? '-on' : '') + '.png">' + labels[i] + '</button>').join('')
    tabs.querySelectorAll('button').forEach((button) => { button.onclick = () => navigate('/pages/' + button.dataset.page + '/' + button.dataset.page, true) })
    document.body.append(tabs)
  }
  if (!isTab && pageName !== 'trail' && pageName !== 'summit') {
    document.body.classList.add('with-native')
    const config = await fetch('/miniprogram/pages/' + pageName + '/' + pageName + '.json').then((r) => r.json())
    const header = document.createElement('div'); header.className = 'preview-native'
    const back = document.createElement('button'); back.textContent = '‹ 返回'; back.onclick = () => history.back()
    const title = document.createElement('span'); title.textContent = config.navigationBarTitleText
    header.append(back, title); document.body.prepend(header)
  }
  const options=Object.fromEntries(query)
  // Native navigateTo delivers encoded query strings to onLoad.
  if(pageName==='lexicon')for(const name of ['word','context','source'])if(query.has(name))options[name]=encodeURIComponent(query.get(name))
  if (page.onLoad) page.onLoad(options); if (page.onShow) page.onShow(); render(); if (page.onReady) page.onReady()
  window.addEventListener('resize', () => { resize(); if (page.onResize) page.onResize({ size: { windowWidth: innerWidth, windowHeight: innerHeight } }) })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (page.onHide) page.onHide(); if (sheet) sheetDefinition.pageLifetimes.hide.call(sheet); speechComponents.forEach(c => speechDefinition.pageLifetimes.hide.call(c)) }
    else { if (page.onShow) page.onShow(); if (sheet) sheetDefinition.pageLifetimes.show.call(sheet) }
  })
  window.addEventListener('pagehide', () => { speechComponents.forEach(c => speechDefinition.lifetimes.detached.call(c)); if (sheet) sheetDefinition.lifetimes.detached.call(sheet); if (page.onUnload) page.onUnload() })
  // Mouse drag preview; touch uses the actual page event handlers above.
  canvas.onpointerdown = (e) => { if (e.pointerType === 'mouse') { canvas.setPointerCapture(e.pointerId); page.onTouchStart({ touches: [e] }) } }
  canvas.onpointermove = (e) => { if (e.pointerType === 'mouse' && e.buttons) page.onTouchMove({ touches: [e] }) }
  canvas.onpointerup = (e) => { if (e.pointerType === 'mouse') page.onTouchEnd({ touches: [] }) }
}
boot().catch((error) => { document.body.textContent = error.stack; console.error(error) })
