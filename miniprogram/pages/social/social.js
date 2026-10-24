const social=require('../../utils/social.js')
Page({
 data:{mode:'inbox',items:[],cursor:null,loading:false,error:'',configured:false,busy:''},
 onLoad(options){this.destroyed=false;this.setData({mode:['following','blocked'].includes(options.mode)?options.mode:'inbox',configured:social.available()})},
 onShow(){if(social.available())this.load()},
 onUnload(){this.destroyed=true},
 async load(e){
  if(this.data.loading)return
  const more=!!(e&&e.currentTarget&&e.currentTarget.dataset.more)
  this.setData({loading:true,error:''})
  try{
   const action={following:'following',inbox:'inbox',blocked:'blockedUsers'}[this.data.mode]
   const result=await social.call(action,{cursor:more?this.data.cursor:null})
   const items=result.items.map(p=>this.data.mode==='inbox'?Object.assign({},p,{key:p.conversationId,profile:social.decorate(p.profile),timeLabel:social.timeLabel(p.updatedAt)}):Object.assign(social.decorate(p),{key:p.uid}))
   if(!this.destroyed)this.setData({items:(more?this.data.items:[]).concat(items),cursor:result.nextCursor})
  }catch(e){if(!this.destroyed)this.setData({error:e.message})}finally{if(!this.destroyed)this.setData({loading:false})}
 },
 async chat(e){
  if(this.data.busy)return
  this.setData({busy:'chat',error:''})
  try{let id=e.currentTarget.dataset.id;if(!id){const r=await social.call('openChat',{uid:e.currentTarget.dataset.uid});id=r.conversationId}if(!this.destroyed)wx.navigateTo({url:'/pages/chat/chat?id='+id})}
  catch(error){if(!this.destroyed)this.setData({error:error.message})}finally{if(!this.destroyed)this.setData({busy:''})}
 },
 async remove(e){
  if(this.data.busy)return
  const uid=e.currentTarget.dataset.uid;this.setData({busy:uid,error:''})
  try{await social.call(this.data.mode==='blocked'?'block':'follow',{uid,blocked:false,following:false});if(!this.destroyed)this.setData({items:this.data.items.filter(p=>p.uid!==uid)})}
  catch(error){if(!this.destroyed)this.setData({error:error.message})}finally{if(!this.destroyed)this.setData({busy:''})}
 }
})
