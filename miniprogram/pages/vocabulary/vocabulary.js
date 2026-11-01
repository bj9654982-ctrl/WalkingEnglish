const vocabulary=require('../../utils/vocabulary.js')
const words=require('../../utils/wordLookup.js')
const speech=require('../../utils/speech.js')
Page({
  data:{items:[],query:'',sort:'recent',total:0,shown:50,matched:0},
  onShow(){this.refresh()},
  refresh(){const items=vocabulary.list(this.data.query,this.data.sort);this.setData({items:items.slice(0,this.data.shown),matched:items.length,total:vocabulary.all().length})},
  search(e){this.setData({query:e.detail.value,shown:50});this.refresh()},
  sort(){this.setData({sort:this.data.sort==='recent'?'alpha':'recent',shown:50});this.refresh()},
  more(){this.setData({shown:this.data.shown+50});this.refresh()},
  open(e){speech.stop();wx.navigateTo({url:words.url(e.currentTarget.dataset.word)})},
  goReading(){wx.switchTab({url:'/pages/reading/reading'})},
  onHide(){speech.stop()},onUnload(){speech.stop()}
})
