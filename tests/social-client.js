const assert=require('node:assert/strict')
const social=require('../miniprogram/utils/social')
const config=require('../miniprogram/config/cloud')
const definitions={}
for(const name of ['camp','chat']){global.Page=d=>definitions[name]=d;require('../miniprogram/pages/'+name+'/'+name)}
const makePage=name=>({...definitions[name],data:structuredClone(definitions[name].data),setData(p){Object.assign(this.data,p)}})
async function main(){
 let count=0
 const original={call:social.call,available:social.available,setTimeout:global.setTimeout,clearTimeout:global.clearTimeout}
 let timers=new Map(),timerId=0
 global.setTimeout=(fn)=>{const id=++timerId;timers.set(id,fn);return id};global.clearTimeout=id=>timers.delete(id)
 global.wx={getStorageSync(){return ''},setStorageSync(){},showToast(){}}
 async function test(name,fn){await fn();count++;console.log('PASS '+name)}
 try{
  await test('空环境和初始化失败均保留本机功能，不发出云请求',async()=>{
   await assert.rejects(social.call('me'),e=>e.code==='UNCONFIGURED')
   config.envId='test-only';wx.cloud={init(){throw Error('invalid environment')},callFunction(){throw Error('must not call')}}
   assert.equal(social.init(),false);await assert.rejects(social.call('me'),e=>e.code==='UNCONFIGURED');config.envId=''
  })
  social.available=()=>true
  await test('营地加入失败显示设置资料入口；成功后才显示名单',async()=>{
   const p=makePage('camp');p.onLoad({id:0,camp:0,book:'easy'});p.setData({locked:false})
   social.call=async()=>{const e=Error('set profile');e.code='PROFILE_REQUIRED';throw e}
   await p.join();assert.equal(p.data.joined,false);assert.equal(p.data.needsProfile,true);assert.equal(p.data.loading,false)
   social.call=async action=>action==='joinCamp'?{campKey:'0:0'}:{items:[{uid:'b',nickname:'B',avatarIndex:0,joinedAt:1}],nextCursor:null}
   await p.join();assert.equal(p.data.joined,true);assert.equal(p.data.members.length,1);assert.equal(p.data.needsProfile,false)
   p.onUnload()
  })
  await test('私信断网保留草稿，重试沿用消息 ID，成功回执后才清空',async()=>{
   const p=makePage('chat');p.onLoad({id:'chat'});p.visible=true;p.setData({draft:'Hello'})
   const sends=[];let failed=true
   social.call=async(action,payload)=>{
    if(action==='send'){sends.push({...payload});if(failed)throw Error('offline');return {id:'m',seq:1}}
    if(action==='messages')return {uid:'a',profile:{uid:'b',nickname:'B'},items:[{id:'m',seq:1,sender:'a',text:'Hello',createdAt:1}],hasMore:false}
    return {}
   }
   await p.send();assert.equal(p.data.draft,'Hello');assert.ok(p.data.sendError)
   failed=false;await p.send();assert.equal(sends[0].requestId,sends[1].requestId);assert.equal(p.data.draft,'');assert.equal(p.data.messages.length,1)
   p.onUnload();assert.equal(timers.size,0)
  })
  await test('轮询按序号去重，同一阅读位置不反复写入；后台停止请求',async()=>{
   const p=makePage('chat');p.onLoad({id:'chat'});p.visible=true
   let marks=0,reads=0
   social.call=async(action)=>{
    if(action==='messages'){reads++;return {uid:'a',profile:{uid:'b',nickname:'B'},items:[{id:'one',seq:1,sender:'b',text:'Hi',createdAt:1}],hasMore:false}}
    if(action==='markRead')marks++;return {}
   }
   await p.load();await p.load();assert.equal(p.data.messages.length,1);assert.equal(marks,1);assert.equal(timers.size,1)
   p.onHide();assert.equal(timers.size,0);await p.load();assert.equal(reads,2);p.onUnload()
  })
  await test('离开页面后迟到的响应不更新界面或重新启动轮询',async()=>{
   const p=makePage('chat');p.onLoad({id:'chat'});p.visible=true
   let resolve
   social.call=()=>new Promise(r=>{resolve=r})
   const pending=p.load();p.onUnload();resolve({uid:'a',profile:{uid:'b'},items:[],hasMore:false});await pending
   assert.equal(p.data.profile,null);assert.equal(timers.size,0)
  })
 }finally{config.envId='';social.call=original.call;social.available=original.available;global.setTimeout=original.setTimeout;global.clearTimeout=original.clearTimeout}
 console.log(count+' social client checks passed')
}
main().catch(e=>{console.error(e);process.exitCode=1})
