const readings = require('../../data/readings.js')
const journal = require('../../utils/journal.js')
const speech = require('../../utils/speech.js')
Page({
 data:{ articles:[],article:null,showTranslation:false,answer:-1,feedback:'',finished:false },
 onShow(){const done=journal.read().reading;this.setData({articles:readings.map(a=>Object.assign({},a,{done:!!done[a.id]}))})},
 openArticle(e){const article=readings.find(a=>a.id===e.currentTarget.dataset.id);if(!article)return;speech.stop();this.setData({article,articleAudio:[article.title].concat(article.paragraphs.map(p=>p.en)),showTranslation:false,answer:-1,feedback:'',finished:!!journal.read().reading[article.id]})},
 closeArticle(){speech.stop();this.setData({article:null,articleAudio:[]});this.onShow()},
 toggleTranslation(){this.setData({showTranslation:!this.data.showTranslation})},
 choose(e){if(this.data.finished)return;const index=Number(e.currentTarget.dataset.index),correct=index===this.data.article.answer;if(correct)journal.finishReading(this.data.article.id);this.setData({answer:index,finished:correct,feedback:correct?this.data.article.explanation:'再读一遍相关段落，试试另一个答案。'})},
 speak(e){speech.speak(e.currentTarget.dataset.word)},
 onHide(){speech.destroy()}, onUnload(){speech.destroy()}
})
