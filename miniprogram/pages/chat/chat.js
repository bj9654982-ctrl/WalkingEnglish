const social=require('../../utils/social.js')
Page({
 data:{messages:[],draft:'',loading:false,sending:false,error:'',sendError:'',profile:null,hasOlder:false,scrollTo:'',configured:false},
 onLoad(options){this.conversationId=options.id;this.destroyed=false;this.visible=false;this.setData({configured:social.available()})},
 onShow(){this.visible=true;this.load()},
 onHide(){this.visible=false;clearTimeout(this.pollTimer)},
 onUnload(){this.destroyed=true;this.onHide()},
 schedule(){clearTimeout(this.pollTimer);if(this.visible&&!this.destroyed&&social.available())this.pollTimer=setTimeout(()=>this.load(),5000)},
 async load(e){
  if(!social.available()||this.data.loading||this.destroyed||!this.visible)return
  const older=!!(e&&e.currentTarget&&e.currentTarget.dataset.older),first=this.data.messages[0],last=this.data.messages[this.data.messages.length-1]
  this.setData({loading:true,error:''})
  try{
   const payload={conversationId:this.conversationId}
   if(older&&first)payload.before=first.seq;else if(last)payload.after=last.seq
   const result=await social.call('messages',payload)
   if(this.destroyed||!this.visible)return
   const byId=new Map(this.data.messages.map(m=>[m.id,m]))
   result.items.forEach(m=>byId.set(m.id,Object.assign({},m,{mine:m.sender===result.uid,timeLabel:social.timeLabel(m.createdAt)})))
   const messages=Array.from(byId.values()).sort((a,b)=>a.seq-b.seq)
   const patch={messages,profile:social.decorate(result.profile)}
   if(older||!last)patch.hasOlder=result.hasMore
   if(!older&&result.items.length)patch.scrollTo='message-'+messages[messages.length-1].seq
   this.setData(patch)
   const latest=messages.length?messages[messages.length-1].seq:0
   if(latest>(this.readSeq||0)){await social.call('markRead',{conversationId:this.conversationId,seq:latest});this.readSeq=latest}
  }catch(error){if(!this.destroyed&&this.visible)this.setData({error:error.message})}
  finally{if(!this.destroyed)this.setData({loading:false});this.schedule()}
 },
 edit(e){const draft=e.detail.value;if(this.pending&&draft.trim()!==this.pending.text)this.pending=null;this.setData({draft,sendError:''})},
 async send(){
  if(this.data.sending||!this.data.draft.trim())return
  const body=this.data.draft.trim()
  if(!this.pending||this.pending.text!==body)this.pending={text:body,requestId:Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)+'_'+Math.random().toString(36).slice(2)}
  this.setData({sending:true,sendError:''})
  try{await social.call('send',Object.assign({conversationId:this.conversationId},this.pending));if(!this.destroyed){this.pending=null;this.setData({draft:''});await this.load()}}
  catch(error){if(!this.destroyed)this.setData({sendError:error.message+' 草稿已保留，可重试。'})}
  finally{if(!this.destroyed)this.setData({sending:false})}
 },
 more(){
  if(!this.data.profile)return
  const uid=this.data.profile.uid
  wx.showActionSheet({itemList:['屏蔽这位玩家','举报：骚扰或辱骂','举报：垃圾广告','举报：不适当内容'],success:async r=>{
   try{if(r.tapIndex===0){await social.call('block',{uid,blocked:true});this.onHide();wx.navigateBack()}
    else{await social.call('report',{uid,conversationId:this.conversationId,reason:['骚扰或辱骂','垃圾广告','不适当内容'][r.tapIndex-1]});wx.showToast({title:'举报已提交',icon:'none'})}}
   catch(error){if(!this.destroyed)this.setData({error:error.message})}
  }})
 }
})
