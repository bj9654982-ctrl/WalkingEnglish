const {normalize}=require('./wordLookup.js')
const {loadWords}=require('./wordCatalog.js')
const cache=new Map(), own=Object.create(null)
loadWords('classic').forEach(w=>{own[w.w.toLowerCase()]={word:w.w,phonetic:w.ph,meaning:w.pos+' '+w.mean,lemma:'',origin:'学习词库'}})
const terms={iqa:'图像质量评价（Image Quality Assessment）',ssim:'结构相似性（Structural Similarity）',psnr:'峰值信噪比（Peak Signal-to-Noise Ratio）',mse:'均方误差（Mean Squared Error）',rmse:'均方根误差（Root Mean Squared Error）',cnn:'卷积神经网络（Convolutional Neural Network）',mos:'平均意见分数（Mean Opinion Score）',dmos:'差分平均意见分数（Differential Mean Opinion Score）',srocc:'斯皮尔曼秩相关系数（Spearman Rank Order Correlation Coefficient）',plcc:'皮尔逊线性相关系数（Pearson Linear Correlation Coefficient）',nss:'自然场景统计（Natural Scene Statistics）',svr:'支持向量回归（Support Vector Regression）',vqa:'视频质量评价（Video Quality Assessment）',rgb:'红、绿、蓝三色通道（Red, Green, Blue）'}
Object.keys(terms).forEach(word=>{own[word]={word,phonetic:'',meaning:terms[word],lemma:'',origin:'图像质量术语'}})
const contractions={"isn't":'is not 的缩写；不是',"aren't":'are not 的缩写；不是',"wasn't":'was not 的缩写；过去不是',"weren't":'were not 的缩写；过去不是',"don't":'do not 的缩写；不',"doesn't":'does not 的缩写；不',"didn't":'did not 的缩写；过去没有',"can't":'cannot 的缩写；不能',"couldn't":'could not 的缩写；不能；无法',"won't":'will not 的缩写；将不；不愿',"wouldn't":'would not 的缩写；不会；不愿',"shouldn't":'should not 的缩写；不应该',"haven't":'have not 的缩写；尚未',"hasn't":'has not 的缩写；尚未',"hadn't":'had not 的缩写；之前尚未',"i'm":'I am 的缩写；我是；我处于某状态',"you're":'you are 的缩写；你是；你们是',"we're":'we are 的缩写；我们是',"they're":'they are 的缩写；他们是',"it's":'it is 或 it has 的缩写，含义需结合上下文',"he's":'he is 或 he has 的缩写，含义需结合上下文',"she's":'she is 或 she has 的缩写，含义需结合上下文',"that's":'that is 或 that has 的缩写，含义需结合上下文',"there's":'there is 或 there has 的缩写，含义需结合上下文',"let's":'let us 的缩写；让我们',"i've":'I have 的缩写',"we've":'we have 的缩写',"they've":'they have 的缩写',"you've":'you have 的缩写',"i'll":'I will 的缩写；我将',"we'll":'we will 的缩写；我们将',"you'll":'you will 的缩写；你将',"they'll":'they will 的缩写；他们将',"i'd":'I would 或 I had 的缩写，含义需结合上下文'}
Object.keys(contractions).forEach(word=>{own[word]={word,phonetic:'',meaning:contractions[word],lemma:'',origin:'常用缩写'}})
function bucket(word){let hash=0;for(let i=0;i<word.length;i++)hash=(Math.imul(hash,31)+word.charCodeAt(i))>>>0;return hash%4}
function requirePack(id){
  if(typeof require.async!=='function')return Promise.reject(Error('请更新微信后加载离线词典。'))
  switch(id){
    case 0:return require.async('../dictionary/pack0/entries.js')
    case 1:return require.async('../dictionary/pack1/entries.js')
    case 2:return require.async('../dictionary/pack2/entries.js')
    case 3:return require.async('../dictionary/pack3/entries.js')
    default:return Promise.reject(Error('词典资料不存在。'))
  }
}
function pack(id){
  if(!cache.has(id)){
    const promise=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('词典加载超时，请检查网络后重试。')),15000)
      requirePack(id).then(data=>{clearTimeout(timer);resolve(data)},()=>{clearTimeout(timer);reject(Error('词典加载失败，请检查网络后重试。'))})
    })
    cache.set(id,promise);promise.catch(()=>{if(cache.get(id)===promise)cache.delete(id)})
  }
  return cache.get(id)
}
async function lookup(value){
  const word=normalize(value)
  if(!word)return null
  if(own[word])return {...own[word],word}
  const data=await pack(bucket(word)), row=Object.prototype.hasOwnProperty.call(data,word)?data[word]:null
  if(!row)return {word,phonetic:'',meaning:'',lemma:'',origin:'',missing:true}
  return {word,phonetic:row[0],meaning:row[1],lemma:row[2],origin:'ECDICT 英汉词典'}
}
module.exports={lookup,bucket}
