const assert=require('node:assert/strict')
const {createService,COLLECTIONS:C,hash}=require('../cloudfunctions/trailSocial/service')
const {createStore}=require('../cloudfunctions/trailSocial/db')
const routes=require('../cloudfunctions/trailSocial/routes.json')
function memoryStore(){
 let db=new Map(),tail=Promise.resolve()
 const store={
  async get(c,id){return structuredClone(db.get(c+':'+id)||null)},
  async put(c,id,data){db.set(c+':'+id,structuredClone({...data,_id:id}))},
  async list(c,filters={},options={}){
   const rows=[...db.entries()].filter(([key])=>key.startsWith(c+':')).map(([,v])=>v).filter(row=>Object.entries(filters).every(([key,val])=>{
    if(val&&typeof val==='object'){if(val.gt!==undefined)return row[key]>val.gt;if(val.lt!==undefined)return row[key]<val.lt;if(val.contains!==undefined)return row[key].includes(val.contains)}
    return row[key]===val
   })).sort((a,b)=>{const key=options.order||'_id';return (a[key]<b[key]?-1:a[key]>b[key]?1:0)*(options.desc?-1:1)})
   return structuredClone(rows.slice(0,options.limit||20))
  },
  transaction(fn){const next=tail.then(async()=>{const snapshot=structuredClone(db);try{return await fn(store)}catch(e){db=snapshot;throw e}});tail=next.catch(()=>{});return next}
 };return store
}
async function main(){
 let time=100000,moderation=true
 const store=memoryStore(),service=createService({store,now:()=>time,moderate:async()=>{if(moderation==='error')throw Error('offline');return moderation}})
 const call=(user,action,payload={})=>service.handle({action,payload},user)
 const A='test-openid-a',B='test-openid-b',D='test-openid-outsider',aid=hash(A),bid=hash(B)
 const proof={mountainId:0,campIndex:0,bookId:'easy',learnedWords:routes.mountains[0].books.easy.slice(0,3)}
 let count=0
 async function test(name,fn){await fn();count++;console.log('PASS '+name)}
 const deny=(promise,code)=>assert.rejects(promise,e=>e.code===code)
 const profile=user=>call(user,'saveProfile',{nickname:'Test '+user.slice(-1),bio:'Hello',avatarIndex:0})
 await test('云端身份只来自 OPENID，拒绝未登录及未知操作',async()=>{
  await deny(call('','me'),'UNAUTHENTICATED');await deny(call(A,'toString'),'INVALID_ACTION')
  await profile(A);await profile(B);await profile(D);assert.equal((await call(A,'me',{uid:bid})).profile.uid,aid)
 })
 await test('首次入营需要公开资料，进度证明去重并校验路线词库',async()=>{
  await deny(call('no-profile','joinCamp',proof),'PROFILE_REQUIRED')
  await deny(call(A,'joinCamp',{...proof,learnedWords:['trail','trail','trail']}),'CAMP_LOCKED')
  await deny(call(A,'joinCamp',{...proof,learnedWords:['foreign','fake','words']}),'CAMP_LOCKED')
  await deny(call(A,'joinCamp',{...proof,campIndex:3}),'INVALID_CAMP')
  await deny(call(A,'joinCamp',{...proof,bookId:'__proto__'}),'INVALID_PROGRESS')
  await call(A,'joinCamp',proof);await call(A,'joinCamp',proof);await call(B,'joinCamp',proof)
  assert.equal((await store.list(C.visits,{})).length,2)
 })
 await test('未到营地的人不能读取名单或随意联系陌生人',async()=>{
  await deny(call(D,'campMembers',{mountainId:0,campIndex:0}),'CAMP_REQUIRED')
  await deny(call(D,'follow',{uid:aid,following:true,campKey:'0:0'}),'CAMP_REQUIRED')
  await deny(call(D,'openChat',{uid:aid,campKey:'0:0'}),'CAMP_REQUIRED')
 })
 await test('玩家资料只返回公开字段，关注操作可重复提交',async()=>{
  const result=await call(A,'campMembers',{mountainId:0,campIndex:0})
  assert.equal(result.items.length,1);assert.equal(result.items[0].uid,bid);assert.ok(!JSON.stringify(result).includes('openid'))
  await call(A,'follow',{uid:bid,following:true,campKey:'0:0'});await call(A,'follow',{uid:bid,following:true,campKey:'0:0'})
  assert.equal((await call(A,'following')).items.length,1)
 })
 let chat
 await test('同营地或已关注玩家建立同一会话，外人不能读、发、标已读',async()=>{
  chat=(await call(A,'openChat',{uid:bid})).conversationId
  assert.equal((await call(B,'openChat',{uid:aid,campKey:'0:0'})).conversationId,chat)
  await deny(call(D,'messages',{conversationId:chat}),'FORBIDDEN')
  await deny(call(D,'markRead',{conversationId:chat,seq:1}),'FORBIDDEN')
  await deny(call(D,'send',{conversationId:chat,text:'x',requestId:'outsider_001'}),'FORBIDDEN')
 })
 await test('文本审核拒绝或不可用时不写消息，非法长度也不入库',async()=>{
  moderation=false;await deny(call(A,'send',{conversationId:chat,text:'x',requestId:'message_rejected_001'}),'CONTENT_REJECTED')
  moderation='error';await deny(call(A,'saveProfile',{nickname:'New',bio:'',avatarIndex:0}),'MODERATION_UNAVAILABLE')
  moderation=true;await deny(call(A,'send',{conversationId:chat,text:'x'.repeat(501),requestId:'message_too_long_001'}),'INVALID_INPUT')
  assert.equal((await store.list(C.messages,{})).length,0)
 })
 await test('重复和并发发送保持幂等；客户端不能冒用他人的 sender',async()=>{
  const payload={conversationId:chat,text:'Hello from the camp',requestId:'message_duplicate_001',sender:bid}
  const [a,b]=await Promise.all([call(A,'send',payload),call(A,'send',payload)]);assert.deepEqual(a,b)
  const messages=(await call(B,'messages',{conversationId:chat})).items
  assert.equal(messages.length,1);assert.equal(messages[0].sender,aid)
  await deny(call(A,'send',{...payload,text:'Changed'}),'REQUEST_CONFLICT')
  await deny(call(A,'send',{...payload,requestId:'message_rate_limit_001'}),'RATE_LIMIT')
 })
 await test('未读与已读游标只更新本人，读取历史不会回退',async()=>{
  assert.equal((await call(B,'inbox')).items[0].unread,true)
  await call(B,'markRead',{conversationId:chat,seq:999})
  await call(B,'markRead',{conversationId:chat,seq:0})
  assert.equal((await call(B,'inbox')).items[0].unread,false)
 })
 await test('消息超过一页后，历史与新增游标完整连续，不丢同一时间的消息',async()=>{
  for(let i=0;i<35;i++){time+=2001;await call(A,'send',{conversationId:chat,text:'message '+i,requestId:'pagination_'+String(i).padStart(5,'0')})}
  const latest=await call(B,'messages',{conversationId:chat});assert.equal(latest.items.length,30);assert.equal(latest.items[0].seq,7)
  const older=await call(B,'messages',{conversationId:chat,before:7});assert.deepEqual(older.items.map(m=>m.seq),[1,2,3,4,5,6])
  const newer=await call(B,'messages',{conversationId:chat,after:30});assert.deepEqual(newer.items.map(m=>m.seq),[31,32,33,34,35,36])
 })
 await test('举报只能针对同营地或本会话玩家，重复举报每天归并',async()=>{
  await deny(call(D,'report',{uid:aid,conversationId:chat,reason:'垃圾广告'}),'FORBIDDEN')
  await call(B,'report',{uid:aid,conversationId:chat,reason:'垃圾广告'});await call(B,'report',{uid:aid,conversationId:chat,reason:'垃圾广告'})
  assert.equal((await store.list(C.reports,{})).length,1)
 })
 await test('双向屏蔽立即禁止读取、发送与关注；解除后可恢复会话',async()=>{
  await call(B,'block',{uid:aid,blocked:true});assert.equal((await call(B,'blockedUsers')).items.length,1)
  await deny(call(A,'messages',{conversationId:chat}),'BLOCKED')
  await deny(call(A,'send',{conversationId:chat,text:'blocked',requestId:'blocked_message_001'}),'BLOCKED')
  await deny(call(A,'follow',{uid:bid,following:true,campKey:'0:0'}),'BLOCKED')
  assert.equal((await call(A,'campMembers',{mountainId:0,campIndex:0})).items.length,0)
  assert.equal((await call(A,'inbox')).items.length,0)
  await call(B,'block',{uid:aid,blocked:false});assert.equal((await call(B,'blockedUsers')).items.length,0)
  assert.equal((await call(A,'messages',{conversationId:chat})).items.length,30)
 })
 await test('营地名单分页不会泄露其他营地成员，包含本人时也不会提前截断',async()=>{
  for(let i=0;i<24;i++){const user='visitor-'+i;await profile(user);await call(user,'joinCamp',proof)}
  let cursor=null,seen=new Set()
  do{const result=await call(A,'campMembers',{mountainId:0,campIndex:0,cursor});for(const p of result.items){assert.ok(!seen.has(p.uid));seen.add(p.uid)}cursor=result.nextCursor}while(cursor)
  assert.equal(seen.size,25);assert.ok(!seen.has(hash(D)))
 })
 await test('数据库适配器处理普通与事务文档形态，并解包事务返回值',async()=>{
  let value={x:1}
  const fake={command:{gt:x=>({gt:x}),lt:x=>({lt:x}),all:x=>({all:x})},collection:()=>({doc:()=>({get:async()=>({data:value}),set:async()=>{}})}),runTransaction:async fn=>({result:await fn(fake),errMsg:'runTransaction:ok'})}
  const adapter=createStore(fake)
  assert.deepEqual(await adapter.get('c','x'),{x:1});value=[];assert.equal(await adapter.get('c','x'),null)
  value=[{x:2}];assert.deepEqual(await adapter.get('c','x'),{x:2});assert.deepEqual(await adapter.transaction(async()=>({id:'message-id'})),{id:'message-id'})
 })
 console.log(count+' social checks passed (mocked database and content moderation; no external messages sent)')
}
main().catch(e=>{console.error(e);process.exitCode=1})

