const dictionary=require('../../utils/dictionary.js')
const vocabulary=require('../../utils/vocabulary.js')
const {normalize}=require('../../utils/wordLookup.js')
const speech=require('../../utils/speech.js')
Page({
  data:{word:'',entry:null,context:'',source:'',note:'',loading:true,error:'',saved:false,saving:false},
  onLoad(options){
    const decode=value=>{try{return decodeURIComponent(value||'')}catch(_){return String(value||'')}}
    this.destroyed=false;this.sequence=0
    const word=normalize(decode(options.word)),saved=vocabulary.get(word)
    this.setData({word,context:String(decode(options.context)||saved&&saved.context||'').slice(0,400),source:String(decode(options.source)||saved&&saved.source||'').slice(0,160),
      note:saved?saved.note:'',saved:!!saved,entry:saved})
    if(!word){this.setData({loading:false,error:'没有识别到英文单词，请返回后重新选择。'});return}
    this.load()
  },
  async load(){
    const sequence=++this.sequence;this.setData({loading:true,error:''})
    try{
      const entry=await dictionary.lookup(this.data.word)
      if(!this.destroyed&&sequence===this.sequence)this.setData({entry,loading:false})
    }catch(error){if(!this.destroyed&&sequence===this.sequence)this.setData({loading:false,error:error.message||'词典加载失败，请重试。'})}
  },
  editNote(e){this.setData({note:e.detail.value})},
  save(){
    if(this.data.saving||!this.data.word)return
    this.setData({saving:true})
    try{
      vocabulary.save({...this.data.entry,word:this.data.word,context:this.data.context,source:this.data.source,note:this.data.note})
      this.setData({saved:true});wx.showToast({title:'已保存到生词本',icon:'success'})
    }catch(error){wx.showToast({title:error.message,icon:'none',duration:3500})}
    finally{this.setData({saving:false})}
  },
  remove(){wx.showModal({title:'移出生词本？',content:'将移除这个单词及其笔记。',success:r=>{
    if(!r.confirm||this.destroyed)return
    try{vocabulary.remove(this.data.word);this.setData({saved:false});wx.showToast({title:'已移除',icon:'success'})}
    catch(error){wx.showToast({title:error.message,icon:'none'})}
  }})},
  onHide(){speech.stop()},onUnload(){this.destroyed=true;this.sequence++;speech.stop()}
})
