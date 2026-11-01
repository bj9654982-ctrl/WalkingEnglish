const library = require('../../utils/paperLibrary.js')
const speech = require('../../utils/speech.js')
Page({
  data:{papers:[],categories:library.categories,category:'all',query:'',sort:'newest',onlyBookmarks:false,total:library.papers.length,stats:{completed:0,started:0,bookmarked:0}},
  onShow(){this.refresh()},
  refresh(){this.setData({papers:library.list(this.data),stats:library.stats()})},
  search(e){this.setData({query:e.detail.value});this.refresh()},
  selectCategory(e){this.setData({category:e.currentTarget.dataset.id});this.refresh()},
  toggleBookmarks(){this.setData({onlyBookmarks:!this.data.onlyBookmarks});this.refresh()},
  changeSort(){const sorts=['newest','oldest','recent'];this.setData({sort:sorts[(sorts.indexOf(this.data.sort)+1)%sorts.length]});this.refresh()},
  openPaper(e){speech.stop();wx.navigateTo({url:'/pages/paper/paper?id='+encodeURIComponent(e.currentTarget.dataset.id)})},
  clearSearch(){this.setData({query:'',category:'all',onlyBookmarks:false});this.refresh()},
  onHide(){speech.stop()},onUnload(){speech.stop()}
})
