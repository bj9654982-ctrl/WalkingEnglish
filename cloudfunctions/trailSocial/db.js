// 只有云函数使用此适配器；客户端数据库权限应全部关闭。
function createStore(database) {
 const command=database.command
 function scope(client){
  return {
   async get(name,id){const r=await client.collection(name).doc(id).get();return Array.isArray(r.data)?r.data[0]||null:r.data||null},
   async put(name,id,data){const copy=Object.assign({},data);delete copy._id;await client.collection(name).doc(id).set({data:copy})},
   async list(name,filters={},options={}){
    const where={}
    Object.keys(filters).forEach(key=>{
     const v=filters[key]
     where[key]=v && typeof v==='object' && !Array.isArray(v) ? (v.gt!==undefined?command.gt(v.gt):v.lt!==undefined?command.lt(v.lt):v.contains!==undefined?command.all([v.contains]):v) : v
    })
    const r=await client.collection(name).where(where).orderBy(options.order||'_id',options.desc?'desc':'asc').limit(options.limit||20).get()
    return r.data
   }
  }
 }
 const store=scope(database)
 store.transaction=async fn=>{
  const response=await database.runTransaction(transaction=>fn(scope(transaction)))
  return response && Object.prototype.hasOwnProperty.call(response,'result') ? response.result : response
 }
 return store
}
module.exports={createStore}

