const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto')
const library=require('../miniprogram/utils/paperLibrary'),journal=require('../miniprogram/utils/journal')
const {papers}=library,definitions={},saved=new Map()
for(const name of ['paper','animal','profile']){global.Page=definition=>definitions[name]=definition;require('../miniprogram/pages/'+name+'/'+name)}
const page=name=>({...definitions[name],data:structuredClone(definitions[name].data),setData(patch){Object.assign(this.data,patch)}})
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve()}
let count=0,toasts=[],lastNav=''
function freshLibrary(load){
 const filename=path.resolve(__dirname,'../miniprogram/utils/paperLibrary.js'),module={exports:{}}
 const importer=ref=>require(path.resolve(path.dirname(filename),ref));importer.async=load
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,exports:module.exports,require:importer,wx:global.wx,setTimeout,clearTimeout,Date,console},{filename})
 return module.exports
}
async function test(name,run){
 saved.clear();toasts=[];lastNav=''
 global.wx={getStorageSync:key=>structuredClone(saved.get(key)),setStorageSync:(key,value)=>saved.set(key,structuredClone(value)),removeStorageSync:key=>saved.delete(key),showToast:options=>toasts.push(options.title),navigateTo:options=>lastNav=options.url,switchTab:options=>lastNav=options.url,pageScrollTo(){},showModal:options=>options.success({confirm:true})}
 await run();count++;console.log('PASS '+name)
}
async function main(){
 await test('43 个源 PDF 按哈希去重为 42 篇，496 页文字完整且页码连续',()=>{
  assert.equal(papers.length,42);assert.equal(papers.reduce((n,p)=>n+p.pageCount,0),496);assert.equal(new Set(papers.map(p=>p.sha256)).size,42)
  const report=require('../references/paper-import/library-report.json');assert.equal(report.duplicates.length,1)
  for(const paper of papers){
   const file=fs.readFileSync(path.join(__dirname,'../references/paper-import/originals',paper.filename));assert.equal(file.subarray(0,4).toString(),'%PDF');assert.equal(crypto.createHash('sha256').update(file).digest('hex'),paper.sha256)
   const text=require('../miniprogram/papers/pack'+paper.pack+'/library')[paper.id];assert.equal(text.pages.length,paper.pageCount)
   text.pages.forEach((p,i)=>{assert.equal(p.number,i+1);assert.ok(p.paragraphs.length>0,paper.id+' page '+p.number);assert.ok(p.paragraphs.every(s=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\uFB00-\uFB06]/.test(s)))})
  }
 })
 await test('本地错名稿件按 PDF 内容标注，不把 MAD competition 当作 MAD 指标',()=>{
  const mad=library.get('mad'),rr=library.get('rr-wnism');assert.equal(mad.year,2008);assert.equal(mad.category,'methodology');assert.match(mad.title,/Competition/);assert.ok(mad.versionNote)
  assert.equal(rr.year,2009);assert.match(rr.title,/Divisive/);assert.ok(rr.versionNote);assert.equal(library.get('biecon').pageCount,5);assert.ok(library.get('biecon').versionNote)
 })
 await test('UQI 乱码页面经 OCR 恢复，左右栏保持阅读顺序',()=>{
  const p=library.get('uqi'),text=require('../miniprogram/papers/pack'+p.pack+'/library').uqi
  assert.ok(text.pages.every(page=>page.ocr));const first=text.pages[0].paragraphs.join(' ')
  assert.match(first,/A Universal Image Quality Index/);assert.match(first,/We propose a new universal objective image/)
  assert.ok(first.indexOf('I. INTRODUCTION')<first.indexOf('II. DEFINITION'))
 })
 await test('搜索支持中英文、方法、年份，分类交集和年份排序正确',()=>{
  assert.equal(library.list({query:'结构相似性'}).length,2)
  assert.equal(library.list({query:'sSiM'}).length,3)
  assert.equal(library.list({query:'2024',category:'nr-deep'}).length,2)
  assert.equal(library.list({query:'2024',category:'fr'}).length,0)
  assert.equal(library.list({sort:'oldest'})[0].id,'csf')
 })
 await test('浏览、收藏、手动已读分别持久化，重进从上次原文页码继续',()=>{
  library.visit('ssim',3);library.visit('ssim',3);library.toggleBookmark('ssim');library.finish('ssim')
  assert.equal(library.progress('ssim').lastPage,3);assert.deepEqual(library.progress('ssim').visited,[3]);assert.equal(library.stats().completed,1);assert.equal(library.stats().started,0)
  const stamp=library.progress('ssim').completedAt;library.finish('ssim');assert.equal(library.progress('ssim').completedAt,stamp)
  assert.equal(library.list({onlyBookmarks:true})[0].id,'ssim');assert.equal(library.list({sort:'recent'})[0].id,'ssim')
  journal.finishReading('morning');assert.equal(library.stats().completed,1)
 })
 await test('非法页码与旧存档损坏不污染进度，论文重置不清空动物手册',()=>{
  assert.equal(library.visit('ssim',0),null);assert.equal(library.visit('ssim',999),null);assert.equal(library.visit('ssim',1.2),null);assert.equal(library.visit('unknown',1),null)
  saved.set('we_papers_v1',{ssim:{visited:[1,1,999,-1,'2'],lastPage:999}});assert.deepEqual(library.progress('ssim').visited,[1]);assert.equal(library.progress('ssim').lastPage,14)
  journal.collect('one','bird',0);library.reset();assert.equal(library.stats().started,0);assert.equal(Object.keys(journal.read().encounters).length,1)
 })
 await test('原生异步分包可载入每篇全文，同包缓存，失败允许重试',async()=>{
  let calls=0;const lib=freshLibrary(async ref=>{calls++;return require(path.resolve(__dirname,'../miniprogram/utils',ref))})
  for(const p of papers){const text=await lib.load(p.id);assert.equal(text.pages.length,p.pageCount)}assert.equal(calls,4)
  let fail=true;const retry=freshLibrary(async ref=>{if(fail)throw Error('offline');return require(path.resolve(__dirname,'../miniprogram/utils',ref))})
  await assert.rejects(retry.load('ssim'),/加载失败/);fail=false;assert.equal((await retry.load('ssim')).pages.length,14)
  await assert.rejects(lib.load('unknown'),/没有找到/)
 })
 const originalLoad=library.load
 try{
  await test('论文页加载失败可重试，页码跳转和摘要切换不破坏位置',async()=>{
   const data=require('../miniprogram/papers/pack1/library').ssim;let fail=true
   library.load=async()=>{if(fail)throw Error('offline');return data}
   const p=page('paper');p.onLoad({id:'ssim'});await tick();assert.equal(p.data.error,'offline')
   fail=false;await p.loadPaper();assert.equal(p.data.currentPage,1);p.next();assert.equal(p.data.currentPage,2)
   p.editPage({detail:{value:'999'}});p.jump();assert.equal(p.data.currentPage,2);assert.equal(toasts.length,1)
   p.editPage({detail:{value:'14'}});p.jump();assert.equal(p.data.currentPage,14);assert.equal(library.progress('ssim').lastPage,14)
   p.toggleAbstract();assert.equal(p.data.mode,'abstract');p.toggleAbstract();assert.equal(p.data.mode,'full');assert.equal(p.data.currentPage,14)
   p.toggleBookmark();assert.equal(p.data.bookmarked,true);p.markRead();assert.equal(library.stats().completed,1);p.onUnload()
  })
  await test('离开论文页后，迟到的加载结果不更新界面或写入阅读进度',async()=>{
   let resolve;library.load=()=>new Promise(done=>{resolve=done})
   const p=page('paper');p.onLoad({id:'ssim'});p.onUnload();const before=structuredClone(p.data)
   resolve(require('../miniprogram/papers/pack1/library').ssim);await tick();assert.deepEqual(p.data,before);assert.equal(library.stats().started,0)
  })
 }finally{library.load=originalLoad}
 await test('观察手册条目进入详情，未发现条目不泄露内容或伪造收集',()=>{
  const profile=page('profile');profile.openAnimal({currentTarget:{dataset:{id:'bird'}}});assert.equal(lastNav,'/pages/animal/animal?id=bird')
  const unseen=page('animal');unseen.onLoad({id:'bird'});assert.equal(unseen.data.seen,false);assert.equal(unseen.data.animal,null)
  journal.collect('a','bird',0);journal.collect('b','bird',7);const seen=page('animal');seen.onLoad({id:'bird'});assert.equal(seen.data.animal.word,'bird');assert.equal(seen.data.visitCount,2);assert.equal(seen.data.visits.length,2)
 })
 await test('公开资料页统计论文而非旧故事，清空记录包含论文收藏',async()=>{
  library.finish('ssim');library.toggleBookmark('ssim');journal.finishReading('morning')
  const p=page('profile');p.onLoad();await p.onShow();assert.equal(p.data.readingCount,1)
  p.resetProgress();await tick();assert.equal(library.stats().completed,0);assert.equal(library.stats().bookmarked,0)
 })
 await test('PDF 原件未配置时明确提示；只允许 HTTPS 或自有云文件',async()=>{
  const documents=require('../miniprogram/utils/paperDocument'),sources=require('../miniprogram/config/papers');assert.equal(await documents.open('ssim'),false);assert.match(toasts[0],/尚未连接云存储/)
  sources.files.ssim='http://example.com/test.pdf';await assert.rejects(documents.open('ssim'),/无效/)
  sources.files.ssim='https://example.com/test.pdf';let opened=false
  wx.downloadFile=options=>options.success({statusCode:200,tempFilePath:'test.pdf'});wx.openDocument=options=>{opened=true;options.success()};assert.equal(await documents.open('ssim'),true);assert.equal(opened,true);delete sources.files.ssim
 })
 await test('PDF 下载回调迟到时，不在已离开的页面突然打开文档',async()=>{
  const documents=require('../miniprogram/utils/paperDocument'),sources=require('../miniprogram/config/papers');sources.files.ssim='https://example.com/paper.pdf'
  let downloaded,opened=false,active=true
  wx.downloadFile=options=>{downloaded=options.success};wx.openDocument=()=>{opened=true}
  const pending=documents.open('ssim',{isActive:()=>active});active=false;downloaded({statusCode:200,tempFilePath:'paper.pdf'})
  assert.equal(await pending,false);assert.equal(opened,false);delete sources.files.ssim
 })
 console.log(count+' paper and bug regression checks passed')
}
main().catch(error=>{console.error(error);process.exitCode=1})
