const { papers, categories } = require('../data/papers.js')
const KEY = 'we_papers_v1', cache = new Map()
function get(id) { return papers.find(paper => paper.id === id) || null }
function readProgress() {
  const saved = wx.getStorageSync(KEY)
  return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
}
function progress(id) {
  const paper = get(id), saved = readProgress()[id] || {}
  const visited = Array.isArray(saved.visited) ? [...new Set(saved.visited.filter(n => Number.isInteger(n) && paper && n >= 1 && n <= paper.pageCount))] : []
  return { visited, lastPage: paper ? Math.max(1, Math.min(paper.pageCount, Math.floor(Number(saved.lastPage))||1)) : 1,
    bookmarked:!!saved.bookmarked, completedAt:saved.completedAt||null, updatedAt:saved.updatedAt||null }
}
function update(id, change) {
  if (!get(id)) return null
  const state = readProgress(), previous = progress(id)
  state[id] = Object.assign({},previous,change,{updatedAt:Date.now()}); wx.setStorageSync(KEY,state)
  return progress(id)
}
function visit(id, number) {
  const paper = get(id)
  if (!paper || !Number.isInteger(number) || number < 1 || number > paper.pageCount) return null
  const previous = progress(id)
  return update(id,{lastPage:number,visited:[...new Set(previous.visited.concat(number))]})
}
function toggleBookmark(id) { return update(id,{bookmarked:!progress(id).bookmarked}) }
function finish(id) { return update(id,{completedAt:progress(id).completedAt||Date.now()}) }
function reset() { wx.removeStorageSync(KEY) }
function stats() { return papers.reduce((s,p) => { const item=progress(p.id);s.completed+=item.completedAt?1:0;s.started+=item.visited.length&&!item.completedAt?1:0;s.bookmarked+=item.bookmarked?1:0;return s },{completed:0,started:0,bookmarked:0}) }
function list(options = {}) {
  const query = String(options.query||'').trim().toLowerCase()
  let result = papers.filter(p => (!options.category || options.category==='all' || p.category===options.category) && (!query || p.search.includes(query)))
    .map(p => { const saved=progress(p.id);return Object.assign({},p,{bookmarked:saved.bookmarked,done:!!saved.completedAt,
      lastPage:saved.lastPage,visited:saved.visited.length,percent:Math.round(saved.visited.length/p.pageCount*100),updatedAt:saved.updatedAt||0}) })
  if (options.onlyBookmarks) result=result.filter(p=>p.bookmarked)
  if (options.sort==='recent') result.sort((a,b)=>b.updatedAt-a.updatedAt||b.year-a.year)
  else if (options.sort==='oldest') result.sort((a,b)=>a.year-b.year||a.id.localeCompare(b.id))
  else result.sort((a,b)=>b.year-a.year||a.id.localeCompare(b.id))
  return result
}
function requirePack(pack) {
  if (typeof require.async !== 'function') return Promise.reject(Error('当前微信版本不支持论文资料加载，请更新微信后重试。'))
  switch (pack) {
    case 0:return require.async('../papers/pack0/library.js')
    case 1:return require.async('../papers/pack1/library.js')
    case 2:return require.async('../papers/pack2/library.js')
    case 3:return require.async('../papers/pack3/library.js')
    default:return Promise.reject(Error('论文资料包不存在。'))
  }
}
async function load(id) {
  const paper=get(id)
  if (!paper) throw Error('没有找到这篇论文，请返回书架重新选择。')
  if (!cache.has(paper.pack)) {
    const promise=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('论文加载超时，请检查网络后重试。')),15000)
      requirePack(paper.pack).then(data=>{clearTimeout(timer);resolve(data)},()=>{clearTimeout(timer);reject(Error('论文资料加载失败，请检查网络后重试。'))})
    })
    cache.set(paper.pack,promise)
    promise.catch(()=>{if(cache.get(paper.pack)===promise)cache.delete(paper.pack)})
  }
  const pack=await cache.get(paper.pack), article=pack[id]
  if (!article || !Array.isArray(article.pages) || article.pages.length!==paper.pageCount) throw Error('论文资料不完整，请重新加载。')
  return article
}
module.exports={papers,categories,get,progress,visit,toggleBookmark,finish,stats,list,load,reset,requirePack}
