const library = require('../../utils/paperLibrary.js')
const documents = require('../../utils/paperDocument.js')
const speech = require('../../utils/speech.js')
Page({
  data:{paper:null,loading:true,error:'',currentPage:1,pageDraft:'1',paragraphs:[],pageAudio:[],bookmarked:false,finished:false,visited:0,percent:0,fontSize:31,mode:'full',openingPdf:false,ocr:false},
  onLoad(options){this.paperId=options.id;this.destroyed=false;this.visible=true;this.loadToken=0;this.loadPaper()},
  onShow(){this.visible=true},
  async loadPaper(){
    const token=++this.loadToken,paper=library.get(this.paperId)
    if(!paper){this.setData({loading:false,error:'没有找到这篇论文，请返回书架重新选择。'});return}
    this.setData({paper,loading:true,error:''})
    try {
      const article=await library.load(paper.id)
      if(this.destroyed||token!==this.loadToken)return
      this.article=article;this.setData({loading:false});this.showPage(library.progress(paper.id).lastPage)
    } catch(error){if(!this.destroyed&&token===this.loadToken)this.setData({loading:false,error:error.message||'论文加载失败，请重试。'})}
  },
  refreshProgress(){const saved=library.progress(this.paperId);this.setData({bookmarked:saved.bookmarked,finished:!!saved.completedAt,visited:saved.visited.length,percent:Math.round(saved.visited.length/this.data.paper.pageCount*100)})},
  showPage(number){
    if(!this.article||!Number.isInteger(number)||number<1||number>this.data.paper.pageCount)return
    speech.stop();const page=this.article.pages[number-1]
    library.visit(this.paperId,number)
    this.setData({currentPage:number,pageDraft:String(number),mode:'full',paragraphs:page.paragraphs,pageAudio:page.paragraphs,ocr:!!page.ocr});this.refreshProgress()
    if(wx.pageScrollTo)wx.pageScrollTo({scrollTop:0,duration:0})
  },
  previous(){this.showPage(this.data.currentPage-1)},
  next(){this.showPage(this.data.currentPage+1)},
  editPage(e){this.setData({pageDraft:e.detail.value})},
  jump(){const value=String(this.data.pageDraft).trim(),number=Number(value);if(!/^\d+$/.test(value)||!Number.isInteger(number)||number<1||number>this.data.paper.pageCount){wx.showToast({title:'请输入 1–'+this.data.paper.pageCount+' 之间的页码',icon:'none'});this.setData({pageDraft:String(this.data.currentPage)});return}this.showPage(number)},
  toggleBookmark(){library.toggleBookmark(this.paperId);this.refreshProgress()},
  markRead(){if(this.data.finished)return;library.finish(this.paperId);this.refreshProgress();wx.showToast({title:'已标为读完',icon:'success'})},
  changeFont(e){const size=Math.max(27,Math.min(39,this.data.fontSize+Number(e.currentTarget.dataset.delta)));this.setData({fontSize:size})},
  toggleAbstract(){
    if(!this.data.paper.abstract)return
    if(this.data.mode==='abstract'){this.showPage(this.data.currentPage);return}
    speech.stop();this.setData({mode:'abstract',paragraphs:[this.data.paper.abstract],pageAudio:[this.data.paper.abstract],ocr:false})
  },
  async openPdf(){
    if(this.data.openingPdf)return
    speech.stop();this.setData({openingPdf:true})
    try{await documents.open(this.paperId,{isActive:()=>!this.destroyed&&this.visible})}catch(error){if(!this.destroyed)wx.showToast({title:error.message||'PDF 打开失败，请重试。',icon:'none',duration:3500})}
    finally{if(!this.destroyed)this.setData({openingPdf:false})}
  },
  backToShelf(){wx.switchTab({url:'/pages/reading/reading'})},
  onHide(){this.visible=false;speech.stop()},onUnload(){this.destroyed=true;this.visible=false;this.loadToken++;speech.stop()}
})
