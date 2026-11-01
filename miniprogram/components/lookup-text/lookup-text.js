const words=require('../../utils/wordLookup.js')
const speech=require('../../utils/speech.js')
Component({
  options:{virtualHost:true},
  properties:{text:{type:String,value:''},source:{type:String,value:''}},
  data:{tokens:[]},
  observers:{text:function(value){this.setData({tokens:words.tokenize(value)})}},
  lifetimes:{attached(){this.setData({tokens:words.tokenize(this.properties.text)})}},
  methods:{
    openWord(e){
      const token=this.data.tokens.find(t=>t.id===Number(e.currentTarget.dataset.offset))
      if(!token||!token.word||this.opening)return
      this.opening=true;speech.stop()
      const pages=getCurrentPages(),current=pages[pages.length-1]
      const navigate=current&&current.route==='pages/lexicon/lexicon'?wx.redirectTo:wx.navigateTo
      navigate({url:words.url(token.word,words.context(this.properties.text,token.id),this.properties.source),
        complete:()=>{this.opening=false},fail:()=>wx.showToast({title:'暂时无法打开释义，请返回上一页后重试。',icon:'none'})})
    }
  }
})
