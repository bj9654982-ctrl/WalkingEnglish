const { loadWords, getBook } = require('../../utils/wordCatalog.js')
const { buildQuiz } = require('../../utils/wordEngine.js')
const storage = require('../../utils/storage.js')
const journal = require('../../utils/journal.js')
const speech = require('../../utils/speech.js')
Page({
 data:{active:false,finished:false,question:null,selected:-1,correct:0,index:0,mistakes:[],answered:false},
 onShow(){
  if(this.data.active)return
  const bookId=storage.getSelectedBook(),progress=storage.getProgress(bookId)
  const learned=new Set(Object.values(progress.mountains).reduce((all,m)=>all.concat(Object.keys(m.words)),[]))
  this.pool=loadWords(bookId).filter(w=>learned.has(w.w));this.bookId=bookId
  this.setData({book:getBook(bookId),learnedCount:this.pool.length,stats:journal.read().practice})
 },
 start(){
  speech.stop()
  const pool=this.pool.length?this.pool:loadWords(this.bookId).slice(0,10)
  this.queue=pool.slice()
  for(let i=this.queue.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[this.queue[i],this.queue[j]]=[this.queue[j],this.queue[i]]}
  this.queue=this.queue.slice(0,10);this.results=[]
  this.setData({active:true,finished:false,correct:0,index:0,mistakes:[],sample:!this.pool.length,total:this.queue.length});this.showQuestion()
 },
 showQuestion(){const word=this.queue[this.data.index],q=buildQuiz([word],this.bookId)[0];this.answerIndex=q.options.findIndex(o=>o.correct);this.setData({question:{options:q.options.map(o=>o.text)},word,selected:-1,answered:false,feedback:''})},
 choose(e){
  if(this.data.answered)return
  const selected=Number(e.currentTarget.dataset.index),correct=selected===this.answerIndex
  this.results.push({word:this.data.word,correct});this.setData({selected,answered:true,correct:this.data.correct+(correct?1:0),feedback:correct?'记住了，继续向前。':'再记一次：'+this.data.word.mean})
 },
 next(){
  if(!this.data.answered)return
  speech.stop()
  if(this.data.index+1>=this.queue.length){journal.finishPractice(this.data.correct,this.queue.length);this.setData({active:false,finished:true,mistakes:this.results.filter(r=>!r.correct).map(r=>r.word),stats:journal.read().practice});this.onShow();return}
  this.setData({index:this.data.index+1});this.showQuestion()
 },
 exit(){wx.showModal({title:'结束这轮练习？',content:'这轮未完成的练习不会计入统计。',success:r=>{if(r.confirm){speech.stop();this.setData({active:false,finished:false});this.onShow()}}})},
 back(){speech.stop();this.setData({finished:false});this.onShow()},
 onHide(){speech.stop()}, onUnload(){speech.stop()}
})
