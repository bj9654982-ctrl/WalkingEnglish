const crypto=require('crypto')
const catalog=require('./routes.json')
const COLLECTIONS={profiles:'trail_profiles',visits:'trail_visits',follows:'trail_follows',conversations:'trail_conversations',messages:'trail_messages',blocks:'trail_blocks',reports:'trail_reports'}
function fail(code,message){const error=new Error(message);error.code=code;error.public=true;throw error}
function hash(value){return crypto.createHash('sha256').update(value).digest('hex').slice(0,24)}
function validId(id){return typeof id==='string' && /^[a-f0-9]{24}$/.test(id)}
function text(value,max,min=0){if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)fail('INVALID_INPUT','填写的内容长度不符合要求。');return value.trim()}
function publicProfile(p){return {uid:p.uid,nickname:p.nickname,bio:p.bio||'',avatarIndex:p.avatarIndex||0}}
function createService({store,moderate,now=Date.now}){
 const C=COLLECTIONS
 const get=(name,id,db=store)=>db.get(C[name],id)
 const put=(name,id,data,db=store)=>db.put(C[name],id,data)
 const list=(name,filters,options,db=store)=>db.list(C[name],filters,options)
 async function checkedContent(content,openid){
  let accepted=false
  try{accepted=await moderate(content,openid)}catch(_){fail('MODERATION_UNAVAILABLE','内容检查暂不可用，请稍后再试。')}
  if(!accepted)fail('CONTENT_REJECTED','内容暂未通过检查，请修改后重试。')
 }
 async function requireProfile(uid){const p=await get('profiles',uid);if(!p)fail('PROFILE_REQUIRED','先到「我的」保存公开昵称，再加入营地。');return p}
 async function blocked(a,b,db=store){const pair=await Promise.all([get('blocks',a+'_'+b,db),get('blocks',b+'_'+a,db)]);return pair.some(r=>r&&r.active)}
 function target(value,uid){if(!validId(value)||value===uid)fail('INVALID_USER','请选择其他玩家。');return value}
 function campKey(p){
  if(!Number.isInteger(p.mountainId))fail('INVALID_CAMP','这个营地不存在。')
  const m=catalog.mountains[String(p.mountainId)],index=p.campIndex
  if(!m||!Number.isInteger(index)||index<0||index>2)fail('INVALID_CAMP','这个营地不存在。')
  return m.id+':'+index
 }
 async function campAccess(uid,key){
  if(typeof key!=='string'||!/^\d+:\d$/.test(key)||!await get('visits',uid+'_'+key))fail('CAMP_REQUIRED','先抵达并加入这个营地，才能查看同行玩家。')
 }
 async function canMeet(uid,other,key){
  const following=await get('follows',uid+'_'+other)
  if(following&&following.active)return
  await campAccess(uid,key)
  if(!await get('visits',other+'_'+key))fail('CAMP_REQUIRED','只能联系同一营地的玩家。')
 }
 async function conversation(uid,id,db=store){
  if(!validId(id))fail('INVALID_CHAT','会话不存在。')
  const c=await get('conversations',id,db)
  if(!c||!c.members.includes(uid))fail('FORBIDDEN','无法访问这个会话。')
  const other=c.members.find(u=>u!==uid)
  return {c,other}
 }
 function cursorFilters(base,cursor){if(cursor!=null&&typeof cursor!=='string')fail('INVALID_INPUT','分页参数无效。');return Object.assign({},base,cursor?{_id:{gt:cursor}}:{})}
 function page(items){return {items,nextCursor:items.length===20?items[items.length-1]._id:null}}
 async function profilesFor(rows,uid,field){
  const result=await Promise.all(rows.map(async row=>{
   const other=row[field]
   if(other===uid||await blocked(uid,other))return null
   const [p,relation]=await Promise.all([get('profiles',other),get('follows',uid+'_'+other)])
   return p?Object.assign(publicProfile(p),{following:!!(relation&&relation.active),joinedAt:row.joinedAt}):null
  }))
  return result.filter(Boolean)
 }
 const actions={
  async me(uid){const p=await get('profiles',uid);return {profile:p?publicProfile(p):null,uid}},
  async saveProfile(uid,p,openid){
   const nickname=text(p.nickname,20,1),bio=text(p.bio||'',120)
   const avatarIndex=p.avatarIndex
   if(!Number.isInteger(avatarIndex)||avatarIndex<0||avatarIndex>5)fail('INVALID_INPUT','请选择一个头像。')
   await checkedContent(nickname+'\n'+bio,openid)
   await put('profiles',uid,{uid,nickname,bio,avatarIndex,updatedAt:now()})
   return publicProfile({uid,nickname,bio,avatarIndex})
  },
  async joinCamp(uid,p){
   await requireProfile(uid)
   const key=campKey(p),m=catalog.mountains[String(p.mountainId)],pool=m.books[p.bookId]
   if(!Array.isArray(pool)||!Array.isArray(p.learnedWords)||p.learnedWords.length>500)fail('INVALID_PROGRESS','学习进度无效。')
   const allowed=new Set(pool),words=new Set(p.learnedWords.filter(w=>typeof w==='string'&&allowed.has(w)))
   if(words.size<Math.ceil(pool.length*[.25,.55,.85][p.campIndex]))fail('CAMP_LOCKED','完成这段学习后再来营地吧。')
   await store.transaction(async db=>{
    const id=uid+'_'+key,existing=await get('visits',id,db)
    if(!existing)await put('visits',id,{uid,campKey:key,mountainId:m.id,campIndex:p.campIndex,joinedAt:now()},db)
   })
   return {campKey:key}
  },
  async campMembers(uid,p){
   const key=campKey(p);await campAccess(uid,key)
   const rows=await list('visits',cursorFilters({campKey:key},p.cursor))
   return {items:await profilesFor(rows,uid,'uid'),nextCursor:page(rows).nextCursor}
  },
  async follow(uid,p){
   await requireProfile(uid);const other=target(p.uid,uid)
   if(typeof p.following!=='boolean')fail('INVALID_INPUT','关注状态无效。')
   if(p.following){await requireProfile(other);if(await blocked(uid,other))fail('BLOCKED','暂时无法与这位玩家互动。');await canMeet(uid,other,p.campKey)}
   await put('follows',uid+'_'+other,{uid,target:other,active:p.following,updatedAt:now()})
   return {following:p.following}
  },
  async following(uid,p){
   const rows=await list('follows',cursorFilters({uid,active:true},p.cursor))
   return {items:await profilesFor(rows,uid,'target'),nextCursor:page(rows).nextCursor}
  },
  async openChat(uid,p){
   await requireProfile(uid);const other=target(p.uid,uid);await requireProfile(other)
   if(await blocked(uid,other))fail('BLOCKED','暂时无法与这位玩家互动。')
   const members=[uid,other].sort(),id=hash(members.join(':'))
   await store.transaction(async db=>{
    const existing=await get('conversations',id,db)
    if(!existing){
     await canMeet(uid,other,p.campKey)
     await put('conversations',id,{members,seq:0,reads:{},lastSent:{},createdAt:now(),updatedAt:now()},db)
    }
   })
   return {conversationId:id}
  },
  async inbox(uid,p){
   const rows=await list('conversations',cursorFilters({members:{contains:uid}},p.cursor))
   const items=[]
   for(const c of rows){
    const other=c.members.find(u=>u!==uid),profile=await get('profiles',other)
    if(!profile||await blocked(uid,other))continue
    items.push({conversationId:c._id,profile:publicProfile(profile),lastMessage:c.lastMessage||'还没有消息',updatedAt:c.updatedAt,unread:c.seq>(c.reads[uid]||0)})
   }
   items.sort((a,b)=>b.updatedAt-a.updatedAt)
   return {items,nextCursor:page(rows).nextCursor}
  },
  async messages(uid,p){
   const {c,other}=await conversation(uid,p.conversationId)
   if(await blocked(uid,other))fail('BLOCKED','这个会话已暂停，无法读取或发送消息。')
   const profile=await requireProfile(other),filters={conversationId:p.conversationId}
   const after=p.after==null?null:Number(p.after),before=p.before==null?null:Number(p.before)
   if((after!=null&&(!Number.isSafeInteger(after)||after<0))||(before!=null&&(!Number.isSafeInteger(before)||before<1))||(after!=null&&before!=null))fail('INVALID_INPUT','消息分页参数无效。')
   if(after!=null)filters.seq={gt:after};else if(before!=null)filters.seq={lt:before}
   const rows=await list('messages',filters,{order:'seq',desc:after==null,limit:30})
   if(after==null)rows.reverse()
   return {uid,profile:publicProfile(profile),items:rows.map(m=>({id:m._id,seq:m.seq,sender:m.sender,text:m.text,createdAt:m.createdAt})),hasMore:rows.length===30}
  },
  async markRead(uid,p){
   const seq=Number(p.seq)
   if(!Number.isSafeInteger(seq)||seq<0)fail('INVALID_INPUT','阅读位置无效。')
   await store.transaction(async db=>{const {c}=await conversation(uid,p.conversationId,db);c.reads[uid]=Math.max(c.reads[uid]||0,Math.min(seq,c.seq));await put('conversations',p.conversationId,c,db)})
   return {}
  },
  async send(uid,p,openid){
   const body=text(p.text,500,1),requestId=p.requestId
   if(typeof requestId!=='string'||!/^[a-zA-Z0-9_-]{12,80}$/.test(requestId))fail('INVALID_INPUT','消息标识无效。')
   const messageId=hash(uid+':'+requestId)
   const {other}=await conversation(uid,p.conversationId)
   if(await blocked(uid,other))fail('BLOCKED','这个会话已暂停，无法发送消息。')
   const previous=await get('messages',messageId)
   if(previous){if(previous.conversationId!==p.conversationId||previous.text!==body)fail('REQUEST_CONFLICT','消息标识已用于其他内容。');return {id:messageId,seq:previous.seq}}
   await checkedContent(body,openid)
   return store.transaction(async db=>{
    const {c,other:recipient}=await conversation(uid,p.conversationId,db)
    if(await blocked(uid,recipient,db))fail('BLOCKED','这个会话已暂停，无法发送消息。')
    const existing=await get('messages',messageId,db)
    if(existing){if(existing.text!==body||existing.conversationId!==p.conversationId)fail('REQUEST_CONFLICT','消息标识已用于其他内容。');return {id:messageId,seq:existing.seq}}
    const timestamp=now()
    if(c.lastSent[uid]!=null&&timestamp-c.lastSent[uid]<2000)fail('RATE_LIMIT','稍等两秒再发送下一条吧。')
    c.seq++;c.lastSent[uid]=timestamp;c.updatedAt=timestamp;c.lastMessage=body.slice(0,80)
    await put('messages',messageId,{conversationId:p.conversationId,sender:uid,text:body,seq:c.seq,createdAt:timestamp},db)
    await put('conversations',p.conversationId,c,db)
    return {id:messageId,seq:c.seq}
   })
  },
  async block(uid,p){
   const other=target(p.uid,uid);if(typeof p.blocked!=='boolean')fail('INVALID_INPUT','屏蔽状态无效。')
   await store.transaction(async db=>{
    await put('blocks',uid+'_'+other,{uid,target:other,active:p.blocked,updatedAt:now()},db)
    if(p.blocked)await put('follows',uid+'_'+other,{uid,target:other,active:false,updatedAt:now()},db)
   });return {}
  },
  async blockedUsers(uid,p){
   const rows=await list('blocks',cursorFilters({uid,active:true},p.cursor)),items=[]
   for(const row of rows){const profile=await get('profiles',row.target);if(profile)items.push(publicProfile(profile))}
   return {items,nextCursor:page(rows).nextCursor}
  },
  async report(uid,p){
   const other=target(p.uid,uid),reasons=['骚扰或辱骂','垃圾广告','不适当内容']
   if(!reasons.includes(p.reason))fail('INVALID_INPUT','请选择举报原因。')
   if(p.conversationId){const {other:participant}=await conversation(uid,p.conversationId);if(participant!==other)fail('FORBIDDEN','无法举报这个会话。')}
   else {await campAccess(uid,p.campKey);if(!await get('visits',other+'_'+p.campKey))fail('FORBIDDEN','玩家不在这个营地。')}
   const id=hash(uid+':'+other+':'+Math.floor(now()/86400000))
   await put('reports',id,{reporter:uid,target:other,reason:p.reason,conversationId:p.conversationId||'',campKey:p.campKey||'',createdAt:now(),status:'pending'})
   return {}
  }
 }
 return {async handle(event,openid){
  if(typeof openid!=='string'||!openid)fail('UNAUTHENTICATED','请从微信小程序进入。')
  if(!event||!Object.prototype.hasOwnProperty.call(actions,event.action))fail('INVALID_ACTION','操作不存在。')
  const p=event.payload||{}
  if(typeof p!=='object'||Array.isArray(p))fail('INVALID_INPUT','请求内容无效。')
  return actions[event.action](hash(openid),p,openid)
 }}
}
module.exports={createService,COLLECTIONS,hash}

