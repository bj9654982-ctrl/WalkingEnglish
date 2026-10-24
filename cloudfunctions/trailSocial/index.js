const cloud=require('wx-server-sdk')
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV,throwOnNotFound:false})
const {createStore}=require('./db')
const {createService}=require('./service')
const service=createService({
 store:createStore(cloud.database()),
 moderate:async(content,openid)=>{
  const result=await cloud.openapi.security.msgSecCheck({content,version:2,scene:2,openid})
  return result.errCode===0 && result.result && result.result.suggest==='pass'
 }
})
exports.main=async(event)=>{
 try{
  const context=cloud.getWXContext()
  const data=await service.handle(event,context.OPENID)
  return {ok:true,data}
 }catch(error){
  if(!error.code || !error.public) console.error('trailSocial failed',error.code||error.message)
  return {ok:false,error:{code:error.public?error.code:'SERVICE_UNAVAILABLE',message:error.public?error.message:'营地服务暂不可用，请稍后重试。'}}
 }
}

