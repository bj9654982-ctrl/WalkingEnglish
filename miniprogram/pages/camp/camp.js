const storage=require('../../utils/storage.js')
const {getRouteMountain}=require('../../utils/wordCatalog.js')
const {isReached,requiredWords}=require('../../utils/campAccess.js')
const social=require('../../utils/social.js')
Page({
 data:{configured:false,joined:false,loading:false,busy:'',members:[],cursor:null,error:'',locked:false},
 onLoad(options){
  this.destroyed=false;this.mountainId=Number(options.id);this.campIndex=Number(options.camp);this.bookId=options.book||storage.getSelectedBook()
  const mountain=getRouteMountain(this.mountainId,this.bookId)
  const learned=storage.getMountainProgress(this.mountainId,this.bookId).learnedCount
  const locked=!mountain||!isReached(this.mountainId,this.bookId,this.campIndex,learned)
  this.setData({mountain,campNumber:this.campIndex+1,locked,required:requiredWords(this.mountainId,this.bookId,this.campIndex),configured:social.available()})
 },
 onShow(){if(!this.data.locked&&social.available())this.loadMembers()},
 onUnload(){this.destroyed=true},
 payload(){return {mountainId:this.mountainId,campIndex:this.campIndex}},
 async loadMembers(e){
  if(this.data.loading)return
  const more=!!(e&&e.currentTarget&&e.currentTarget.dataset.more)
  this.setData({loading:true,error:''})
  try{
   const result=await social.call('campMembers',Object.assign(this.payload(),{cursor:more?this.data.cursor:null}))
   if(!this.destroyed)this.setData({joined:true,needsProfile:false,members:(more?this.data.members:[]).concat(result.items.map(p=>Object.assign(social.decorate(p),{joinedLabel:social.timeLabel(p.joinedAt)}))),cursor:result.nextCursor})
  }catch(error){if(!this.destroyed)this.setData({error:error.code==='CAMP_REQUIRED'?'':error.message,joined:error.code==='CAMP_REQUIRED'?false:this.data.joined})}
  finally{if(!this.destroyed)this.setData({loading:false})}
 },
 async join(){
  if(this.data.loading||this.data.locked)return
  this.setData({loading:true,error:'',needsProfile:false})
  try{
   await social.call('joinCamp',Object.assign(this.payload(),{bookId:this.bookId,learnedWords:Object.keys(storage.getMountainProgress(this.mountainId,this.bookId).words)}))
   if(!this.destroyed){this.setData({joined:true,loading:false});await this.loadMembers()}
  }catch(error){if(!this.destroyed)this.setData({error:error.message,needsProfile:error.code==='PROFILE_REQUIRED'})}
  finally{if(!this.destroyed)this.setData({loading:false})}
 },
 goProfile(){wx.switchTab({url:'/pages/profile/profile'})},
 async follow(e){
  if(this.data.busy)return
  const uid=e.currentTarget.dataset.uid,member=this.data.members.find(p=>p.uid===uid);if(!member)return
  this.setData({busy:uid,error:''})
  try{const result=await social.call('follow',{uid,following:!member.following,campKey:this.mountainId+':'+this.campIndex});if(!this.destroyed)this.setData({members:this.data.members.map(p=>p.uid===uid?Object.assign({},p,{following:result.following}):p)})}
  catch(error){if(!this.destroyed)this.setData({error:error.message})}
  finally{if(!this.destroyed)this.setData({busy:''})}
 },
 async chat(e){
  if(this.data.busy)return
  this.setData({busy:e.currentTarget.dataset.uid,error:''})
  try{const result=await social.call('openChat',{uid:e.currentTarget.dataset.uid,campKey:this.mountainId+':'+this.campIndex});if(!this.destroyed)wx.navigateTo({url:'/pages/chat/chat?id='+result.conversationId})}
  catch(error){if(!this.destroyed)this.setData({error:error.message})}
  finally{if(!this.destroyed)this.setData({busy:''})}
 },
 more(e){
  const uid=e.currentTarget.dataset.uid
  wx.showActionSheet({itemList:['屏蔽这位玩家','举报：骚扰或辱骂','举报：垃圾广告','举报：不适当内容'],success:async r=>{
   try{
    if(r.tapIndex===0){await social.call('block',{uid,blocked:true});if(!this.destroyed)this.loadMembers()}
    else {await social.call('report',{uid,campKey:this.mountainId+':'+this.campIndex,reason:['骚扰或辱骂','垃圾广告','不适当内容'][r.tapIndex-1]});wx.showToast({title:'举报已提交',icon:'none'})}
   }catch(error){if(!this.destroyed)this.setData({error:error.message})}
  }})
 }
})
