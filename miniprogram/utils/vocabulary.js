const {normalize}=require('./wordLookup.js')
const KEY='we_vocabulary_v1',LIMIT=2000
function clean(item){
  if(!item||typeof item!=='object')return null
  const word=normalize(item.word);if(!word)return null
  const str=(key,max)=>typeof item[key]==='string'?item[key].slice(0,max):''
  return {word,meaning:str('meaning',1200),phonetic:str('phonetic',100),lemma:str('lemma',60),origin:str('origin',80),
    context:str('context',400),source:str('source',160),note:str('note',500),createdAt:Number(item.createdAt)||0}
}
function all(){
  const saved=wx.getStorageSync(KEY)
  if(!Array.isArray(saved))return []
  const seen=new Set()
  return saved.slice(0,LIMIT).map(clean).filter(item=>{if(!item||seen.has(item.word))return false;seen.add(item.word);return true})
}
function get(word){return all().find(item=>item.word===normalize(word))||null}
function save(entry){
  const item=clean(entry);if(!item)throw Error('请选择有效的英文单词。')
  const items=all(),index=items.findIndex(v=>v.word===item.word)
  if(index<0&&items.length>=LIMIT)throw Error('生词本已满，请整理部分单词后再收藏。')
  if(index>=0){item.createdAt=items[index].createdAt;items[index]=item}else{item.createdAt=Date.now();items.unshift(item)}
  try{wx.setStorageSync(KEY,items)}catch(_){throw Error('本机存储空间不足，未能保存生词，请清理后重试。')}
  return item
}
function remove(word){
  try{wx.setStorageSync(KEY,all().filter(item=>item.word!==normalize(word)))}catch(_){throw Error('移除失败，请重试。')}
}
function list(query='',sort='recent'){
  const q=String(query).trim().toLowerCase()
  return all().filter(v=>!q||[v.word,v.meaning,v.note,v.source].join(' ').toLowerCase().includes(q))
    .sort(sort==='alpha'?(a,b)=>a.word.localeCompare(b.word):(a,b)=>b.createdAt-a.createdAt||a.word.localeCompare(b.word))
}
module.exports={all,get,save,remove,list,KEY,LIMIT}
