const assert=require('node:assert/strict')
const storage=require('../miniprogram/utils/storage')
const {CITIES,ALL_MOUNTAINS,getCityMountains,setSelectedCity,getSelectedCity}=require('../miniprogram/utils/cityCatalog')
const catalog=require('../miniprogram/utils/wordCatalog')
const wildlife=require('../miniprogram/utils/wildlife')
const journal=require('../miniprogram/utils/journal')
const camps=require('../miniprogram/utils/campAccess')
const {TrailScene}=require('../miniprogram/utils/trailScene')
const {createCanvas}=require('./canvasStub')
const definitions={}
for(const name of ['index','discover','reading','practice','profile','trail','camp','summit']){global.Page=d=>definitions[name]=d;require('../miniprogram/pages/'+name+'/'+name)}
const saved=new Map();let lastNav=''
global.wx={getStorageSync:k=>structuredClone(saved.get(k)),setStorageSync:(k,v)=>saved.set(k,structuredClone(v)),removeStorageSync:k=>saved.delete(k),showToast(){},showModal:o=>o.success({confirm:true}),navigateTo:o=>lastNav=o.url,reLaunch:o=>lastNav=o.url,switchTab:o=>lastNav=o.url,getWindowInfo:()=>({}),getMenuButtonBoundingClientRect:()=>null}
const page=name=>({...definitions[name],data:structuredClone(definitions[name].data),setData(p){Object.assign(this.data,p)}})
let count=0
function test(name,fn){saved.clear();storage.initProgress();lastNav='';fn();count++;console.log('PASS '+name)}
test('五个底部导航顺序与本地图标完整',()=>{
 const fs=require('fs'),app=require('../miniprogram/app.json')
 assert.deepEqual(app.tabBar.list.map(t=>t.text),['单词','阅读','练习','发现','我的'])
 for(const tab of app.tabBar.list){assert.ok(app.pages.includes(tab.pagePath));for(const key of ['iconPath','selectedIconPath'])assert.ok(fs.statSync('miniprogram/'+tab[key]).size>100)}
})
test('每座城市完整覆盖每本词书，不重复也不丢词',()=>{
 assert.equal(ALL_MOUNTAINS.length,22)
 for(const city of CITIES)for(const book of catalog.BOOKS){
  const words=getCityMountains(city.id).flatMap(m=>catalog.getMountainWords(m.id,book.id).map(w=>w.w))
  assert.equal(words.length,book.count);assert.equal(new Set(words).size,book.count)
 }
})
test('旧 v3 七山存档扩展后保留原记录，新城市不继承假进度',()=>{
 storage.recordGroup(0,[{w:'trail',passed:true}],5000,'easy')
 const state=saved.get('we_progress_v3')
 for(const book of Object.values(state.books))for(const key of Object.keys(book.mountains))if(Number(key)>6)delete book.mountains[key]
 saved.set('we_progress_v3',state)
 assert.equal(storage.getMountainProgress(0,'easy').learnedCount,1)
 assert.equal(storage.getMountainProgress(7,'easy').learnedCount,0)
 assert.equal(storage.getMountainProgress(0,'easy').studyMs,5000)
})
test('跨城同词独立进度，总已学词去重，重置一山不影响其他城市',()=>{
 storage.recordGroup(0,[{w:'trail',passed:true}],1000,'easy');storage.recordGroup(7,[{w:'trail',passed:true}],2000,'easy')
 assert.equal(storage.getProgress('easy').totalLearned,1)
 assert.equal(storage.getMountainProgress(7,'easy').learnedCount,1)
 storage.resetMountain(0,'easy');assert.equal(storage.getProgress('easy').totalLearned,1)
 assert.equal(storage.getMountainProgress(7,'easy').studyMs,2000)
})
test('城市选择同步发现与单词页，切换后链接使用正确的山峰 ID',()=>{
 const d=page('discover');d.onShow();assert.equal(d.data.mountains.length,7)
 d.selectCity({currentTarget:{dataset:{id:'hangzhou'}}});assert.equal(d.data.mountains[0].id,7)
 const home=page('index');home.onShow();assert.equal(home.data.current.id,7)
 home.enterTrail({currentTarget:{dataset:{id:7}}});assert.match(lastNav,/id=7&book=easy/)
 setSelectedCity('unknown');assert.equal(getSelectedCity().id,'hangzhou')
})
test('新城市登顶证书按本城市判断，不串到下一座城市',()=>{
 for(const m of getCityMountains('hangzhou'))storage.recordGroup(m.id,catalog.getMountainWords(m.id,'easy').map(w=>({w:w.w,passed:true})),1000,'easy')
 const summit=page('summit');summit.onLoad({id:9,book:'easy'});assert.equal(summit.data.allDone,true);assert.equal(summit.data.nextMountain,null);assert.equal(summit.data.city.id,'hangzhou')
})
test('动物只在达到节点后出现；观察收集持久化且不增加背词进度',()=>{
 assert.equal(wildlife.nextEncounter(0,'easy',.119),null)
 const a=wildlife.nextEncounter(0,'easy',.12);assert.ok(a);assert.ok(a.choices.includes(a.word))
 assert.equal(wildlife.collect(a,0),true);assert.equal(wildlife.collect(a,0),false)
 assert.equal(wildlife.nextEncounter(0,'easy',.12),null)
 assert.equal(Object.keys(journal.read().encounters).length,1);assert.equal(storage.getProgress('easy').totalLearned,0)
})
test('营地阈值向上取整，非法营地拒绝；镜头拖动不能解锁',()=>{
 for(const m of ALL_MOUNTAINS)for(const b of catalog.BOOKS)for(let i=0;i<3;i++){const threshold=camps.requiredWords(m.id,b.id,i);assert.equal(camps.isReached(m.id,b.id,i,threshold-1),false);assert.equal(camps.isReached(m.id,b.id,i,threshold),true)}
 assert.equal(camps.isReached(0,'easy',-1,1000),false)
 const p=page('trail');p.onLoad({id:0,book:'easy'});p.pan=180;p.checkJourney();assert.ok(p.data.camps.every(c=>!c.reached))
})
test('营地页面拒绝未学进度，未配置后端不会生成玩家或发云请求',()=>{
 const c=page('camp');c.onLoad({id:0,book:'easy',camp:0});assert.equal(c.data.locked,true);assert.equal(c.data.configured,false);assert.deepEqual(c.data.members,[])
 const words=catalog.getMountainWords(0,'easy').slice(0,camps.requiredWords(0,'easy',0));storage.recordGroup(0,words.map(w=>({w:w.w,passed:true})),0,'easy')
 const arrived=page('camp');arrived.onLoad({id:0,book:'easy',camp:0});assert.equal(arrived.data.locked,false)
})
test('所有城市场景和六种生物在有效 Canvas 坐标内绘制',()=>{
 for(const m of ALL_MOUNTAINS){
  const canvas=createCanvas(),renderer=new TrailScene(canvas,m,{width:390,height:844})
  renderer.setWildlife(wildlife.encounters(m.id,'easy'))
  for(const p of [.12,.38,.66,.9])renderer.render({progress:p,time:2,walkTime:1})
  assert.ok(canvas.calls.some(c=>c.method==='fill'));renderer.dispose()
 }
})
test('阅读页使用 42 篇本地论文，搜索和分类取交集，打开正确的论文详情',()=>{
 const r=page('reading');r.onShow();assert.equal(r.data.papers.length,42)
 r.search({detail:{value:'SSIM'}});assert.ok(r.data.papers.every(p=>p.search.includes('ssim')))
 r.selectCategory({currentTarget:{dataset:{id:'nr-deep'}}});assert.equal(r.data.papers.length,0)
 r.clearSearch();r.openPaper({currentTarget:{dataset:{id:'topiq'}}});assert.equal(lastNav,'/pages/paper/paper?id=topiq')
 assert.equal(Object.keys(journal.read().reading).length,0)
})
test('练习抽取已学词、锁定重复点击、完成才累计且不改登山进度',()=>{
 storage.recordGroup(0,[{w:'trail',passed:true}],0,'easy')
 const p=page('practice');p.onShow();p.start();assert.equal(p.data.total,1);assert.equal(p.data.word.w,'trail')
 const correct=p.answerIndex;p.choose({currentTarget:{dataset:{index:correct}}});p.choose({currentTarget:{dataset:{index:correct}}});assert.equal(p.data.correct,1)
 p.next();assert.equal(p.data.finished,true);assert.equal(journal.read().practice.rounds,1);assert.equal(storage.getProgress('easy').totalLearned,1)
})
test('空存档有可作答的体验题，中途退出不虚增练习统计',()=>{
 const p=page('practice');p.onShow();p.start();assert.equal(p.data.sample,true);assert.equal(p.data.question.options.length,4);p.exit();assert.equal(journal.read().practice.rounds,0)
})
console.log(count+' feature checks passed')

