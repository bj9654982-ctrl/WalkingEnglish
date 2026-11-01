const storage=require('../../utils/storage.js')
const {ALL_MOUNTAINS,getMountain}=require('../../utils/cityCatalog.js')
const {getBook}=require('../../utils/wordCatalog.js')
const {ANIMALS}=require('../../utils/wildlife.js')
const journal=require('../../utils/journal.js')
const social=require('../../utils/social.js')
const paperLibrary=require('../../utils/paperLibrary.js')
const vocabulary=require('../../utils/vocabulary.js')
Page({
 data:{avatars:social.AVATARS,avatarIndex:0,nickname:'',bio:'',profile:null,configured:false,saving:false,error:'',animals:[]},
 onLoad(){this.destroyed=false},
 async onShow(){
  const bookId=storage.getSelectedBook(),progress=storage.getProgress(bookId),notes=journal.read()
  const seen=new Set(Object.values(notes.encounters).map(r=>r.animalId))
  const animals=ANIMALS.map(a=>Object.assign({},a,{seen:seen.has(a.id)}))
  this.setData({configured:social.available(),book:getBook(bookId),learned:progress.totalLearned,minutes:Math.round(progress.totalMinutes),
   summits:ALL_MOUNTAINS.filter(m=>storage.isMountainDone(m.id,bookId)).length,readingCount:paperLibrary.stats().completed,
   animalCount:seen.size,animals,error:'',vocabularyCount:vocabulary.all().length})
  if(!social.available())return
  try{const result=await social.call('me');if(!this.destroyed)this.setData({profile:result.profile,nickname:result.profile?result.profile.nickname:'',bio:result.profile?result.profile.bio:'',avatarIndex:result.profile?result.profile.avatarIndex:0})}
  catch(e){if(!this.destroyed)this.setData({error:e.message})}
 },
 onUnload(){this.destroyed=true},
 editName(e){this.setData({nickname:e.detail.value})},
 editBio(e){this.setData({bio:e.detail.value})},
 chooseAvatar(e){this.setData({avatarIndex:Number(e.currentTarget.dataset.index)})},
 async save(){
  if(this.data.saving)return
  this.setData({saving:true,error:''})
  try{const profile=await social.call('saveProfile',{nickname:this.data.nickname,bio:this.data.bio,avatarIndex:this.data.avatarIndex});if(!this.destroyed){this.setData({profile});wx.showToast({title:'资料已保存',icon:'success'})}}
  catch(e){if(!this.destroyed)this.setData({error:e.message})}
  finally{if(!this.destroyed)this.setData({saving:false})}
 },
 openSocial(e){wx.navigateTo({url:'/pages/social/social?mode='+e.currentTarget.dataset.mode})},
 openVocabulary(){wx.navigateTo({url:'/pages/vocabulary/vocabulary'})},
 openAnimal(e){wx.navigateTo({url:'/pages/animal/animal?id='+encodeURIComponent(e.currentTarget.dataset.id)})},
 resetProgress(){wx.showModal({title:'清空本机学习记录？',content:'将清空所有词书、城市的登山与复习记录，以及论文阅读位置、收藏、练习和生物手册。生词本与云端营地、关注、私信不受影响。此操作不可恢复。',confirmColor:'#a85340',success:r=>{if(r.confirm){storage.resetAll();journal.reset();paperLibrary.reset();this.onShow()}}})}
})
