const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')
const words=require('../miniprogram/utils/wordLookup'),vocabulary=require('../miniprogram/utils/vocabulary')
const dictPath=path.resolve(__dirname,'../miniprogram/utils/dictionary.js'),store=new Map(),definitions={}
let total=0,lastUrl='',modalConfirm=true,toasts=[]
function dictionary(loader){
 const module={exports:{}},importer=ref=>require(path.resolve(path.dirname(dictPath),ref))
 importer.async=loader||((ref)=>Promise.resolve(require(path.resolve(path.dirname(dictPath),ref))))
 vm.runInNewContext(fs.readFileSync(dictPath,'utf8'),{module,require:importer,setTimeout,clearTimeout,console},{filename:dictPath})
 return module.exports
}
for(const name of ['lexicon','vocabulary','profile']){global.Page=d=>definitions[name]=d;require('../miniprogram/pages/'+name+'/'+name)}
const page=name=>({...definitions[name],data:structuredClone(definitions[name].data),setData(patch){Object.assign(this.data,patch)}})
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve()}
async function test(name,run){
 store.clear();lastUrl='';toasts=[];modalConfirm=true
 global.wx={getStorageSync:key=>structuredClone(store.get(key)),setStorageSync:(key,v)=>store.set(key,structuredClone(v)),removeStorageSync:key=>store.delete(key),
 showToast:o=>toasts.push(o.title),showModal:o=>o.success({confirm:modalConfirm}),navigateTo:o=>{lastUrl=o.url;if(o.complete)o.complete()},redirectTo:o=>{lastUrl='redirect:'+o.url;if(o.complete)o.complete()},switchTab:o=>{lastUrl=o.url}}
 await run();total++;console.log('PASS '+name)
}
async function main(){
 await test('分词保留原文、空白、中文、公式、连字符及撇号',()=>{
   const text="图像: Researchers’ image-quality isn't the same.\nIt's 50% better (x² = 2)."
   const tokens=words.tokenize(text);assert.equal(tokens.map(t=>t.text).join(''),text)
   assert.ok(tokens.some(t=>t.word==="isn't"));assert.ok(tokens.some(t=>t.word==='quality'));assert.equal(words.normalize('image-quality'),'')
   assert.equal(words.normalize('I’M'),"i'm");assert.equal(words.normalize('<script>'),'');assert.equal(words.normalize('a'.repeat(61)),'')
   assert.equal(new Set(tokens.map(t=>t.id)).size,tokens.length)
 })
 await test('点词上下文保持目标词，查询参数正确编码',()=>{
   const text='a'.repeat(800)+' structural '+'z'.repeat(800),context=words.context(text,801)
   assert.ok(context.includes('structural'));assert.ok(context.length<=352)
   const url=words.url("isn't",'Quality & 50% change? #一','SSIM · 第 2 页'),params=new URLSearchParams(url.split('?')[1])
   assert.equal(params.get('word'),"isn't");assert.equal(params.get('context'),'Quality & 50% change? #一');assert.equal(params.get('source'),'SSIM · 第 2 页')
 })
 await test('离线四分包查询、缓存、词形和图像质量术语',async()=>{
   let calls=0;const dict=dictionary(ref=>{calls++;return Promise.resolve(require(path.resolve(path.dirname(dictPath),ref)))})
   for(const word of ['structural','similarity','perceptual','assessment','images','hiding','the','quality','isn\'t']){
     const result=await dict.lookup(word);assert.ok(result.meaning,word)
   }
   assert.ok(calls<=4);assert.match((await dict.lookup('IQA')).meaning,/图像质量/)
   assert.match((await dict.lookup('trail')).meaning,/步道/)
   assert.equal((await dict.lookup('zzzzunknownword')).missing,true)
   assert.equal(await dict.lookup('../bad'),null)
 })
 await test('词典分包失败可重试，不缓存失败结果',async()=>{
   let fail=true;const dict=dictionary(ref=>fail?Promise.reject(Error('offline')):Promise.resolve(require(path.resolve(path.dirname(dictPath),ref))))
   await assert.rejects(dict.lookup('structural'),/加载失败/);fail=false;assert.ok((await dict.lookup('structural')).meaning)
 })
 await test('收藏持久化、大小写去重、保留笔记原句和来源',()=>{
   vocabulary.save({word:'Quality',meaning:'质量',context:'Image quality matters.',source:'SSIM · 第 2 页',note:'质量评价'})
   const stamp=vocabulary.get('QUALITY').createdAt
   vocabulary.save({...vocabulary.get('quality'),word:'QUALITY',note:'新增笔记'})
   assert.equal(vocabulary.all().length,1);assert.equal(vocabulary.get('quality').createdAt,stamp)
   assert.equal(vocabulary.get('quality').context,'Image quality matters.');assert.equal(vocabulary.list('新增').length,1)
   assert.equal(vocabulary.list('SSIM').length,1);assert.equal(vocabulary.list('质量').length,1)
   vocabulary.save({word:'apple',meaning:'苹果'});assert.equal(vocabulary.list('','alpha')[0].word,'apple')
   vocabulary.remove('QUALITY');assert.equal(vocabulary.get('quality'),null);assert.equal(vocabulary.all().length,1)
 })
 await test('损坏旧存档不崩溃，非法词拒绝，存储失败不假报成功',()=>{
   store.set(vocabulary.KEY,{bad:1});assert.equal(vocabulary.all().length,0)
   store.set(vocabulary.KEY,[null,{word:'One'},{word:'one'},{word:'<html>'}]);assert.equal(vocabulary.all().length,1)
   assert.throws(()=>vocabulary.save({word:'123'}),/有效/)
   wx.setStorageSync=()=>{throw Error('full')};assert.throws(()=>vocabulary.save({word:'new'}),/未能保存/);assert.equal(vocabulary.get('new'),null)
 })
 const service=require('../miniprogram/utils/dictionary'),original=service.lookup
 try{
  await test('释义页解码来源，收藏后可从生词本还原原句笔记',async()=>{
   service.lookup=dictionary().lookup
   const p=page('lexicon');p.onLoad({word:'quality',context:encodeURIComponent('50% & quality.'),source:encodeURIComponent('SSIM · 第 2 页')});await tick()
   assert.equal(p.data.loading,false);assert.equal(p.data.context,'50% & quality.');p.editNote({detail:{value:'测试笔记'}});p.save()
   assert.equal(p.data.saved,true);assert.equal(vocabulary.all().length,1)
   const restored=page('lexicon');restored.onLoad({word:'quality'});await tick();assert.equal(restored.data.note,'测试笔记');assert.equal(restored.data.source,'SSIM · 第 2 页')
   modalConfirm=false;restored.remove();assert.ok(vocabulary.get('quality'));modalConfirm=true;restored.remove();assert.equal(vocabulary.get('quality'),null)
  })
  await test('词典错误、未知词和离开页面后的迟到结果安全处理',async()=>{
   service.lookup=async()=>{throw Error('网络故障')};const p=page('lexicon');p.onLoad({word:'unknown'});await tick();assert.equal(p.data.error,'网络故障')
   service.lookup=async word=>({word,meaning:'',missing:true});await p.load();assert.equal(p.data.entry.missing,true);p.save();assert.ok(vocabulary.get('unknown'))
   let resolve;service.lookup=()=>new Promise(done=>resolve=done);const q=page('lexicon');q.onLoad({word:'late'});q.onUnload();const previous=structuredClone(q.data)
   resolve({word:'late',meaning:'迟到'});await tick();assert.deepEqual(q.data,previous)
  })
 }finally{service.lookup=original}
 await test('生词本搜索分页刷新，我的入口计数正确，学习重置保留生词',async()=>{
   for(let i=0;i<55;i++)vocabulary.save({word:'word'+String.fromCharCode(97+Math.floor(i/26))+String.fromCharCode(97+i%26),meaning:'词'})
   const p=page('vocabulary');p.onShow();assert.equal(p.data.items.length,50);p.more();assert.equal(p.data.items.length,55)
   p.search({detail:{value:'wordaa'}});assert.equal(p.data.matched,1);p.open({currentTarget:{dataset:{word:'wordaa'}}});assert.match(lastUrl,/lexicon/)
   const profile=page('profile');profile.onLoad();await profile.onShow();assert.equal(profile.data.vocabularyCount,55);profile.openVocabulary();assert.match(lastUrl,/vocabulary/)
   profile.resetProgress();assert.equal(vocabulary.all().length,55)
 })
 await test('点击单词阻止正文父级跳转，释义内再次查词不堆叠页面',()=>{
   let definition;global.Component=d=>definition=d;require('../miniprogram/components/lookup-text/lookup-text')
   const component={...definition.methods,properties:{text:'Quality & image.',source:'论文'},data:{tokens:words.tokenize('Quality & image.')}}
   global.getCurrentPages=()=>[{route:'pages/paper/paper'}];component.openWord({currentTarget:{dataset:{offset:0}}});assert.match(lastUrl,/word=quality/)
   global.getCurrentPages=()=>[{route:'pages/lexicon/lexicon'}];component.openWord({currentTarget:{dataset:{offset:10}}});assert.ok(lastUrl.startsWith('redirect:'))
   const markup=fs.readFileSync(path.join(__dirname,'../miniprogram/components/lookup-text/lookup-text.wxml'),'utf8');assert.match(markup,/catchtap="openWord"/)
 })
 await test('词典索引完整、许可证在包内、体积不超限',()=>{
   let entries=0;for(let id=0;id<4;id++){
     const data=require('../miniprogram/dictionary/pack'+id+'/entries'),dict=dictionary()
     for(const word of Object.keys(data)){assert.equal(dict.bucket(word),id);assert.ok(data[word][1]);entries++}
     assert.ok(fs.statSync(path.join(__dirname,'../miniprogram/dictionary/pack'+id+'/entries.js')).size<1900000)
   }
   assert.ok(entries>13000);assert.match(fs.readFileSync(path.join(__dirname,'../miniprogram/dictionary-LICENSE.txt'),'utf8'),/MIT License/)
   const app=require('../miniprogram/app.json');assert.ok(app.usingComponents['lookup-text']);assert.ok(app.pages.includes('pages/vocabulary/vocabulary'))
 })
 console.log('\n'+total+' vocabulary tests passed')
}
main().catch(error=>{console.error(error);process.exitCode=1})
