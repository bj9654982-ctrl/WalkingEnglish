const config = require('../config/cloud.js')
const AVATARS = ['🌿','🍂','🌼','🌙','⛰','🦋']
let initialized = false
function available() { return !!(config.envId && typeof wx !== 'undefined' && wx.cloud) }
function init() {
 if(!available())return false
 if(!initialized){try{wx.cloud.init({env:config.envId,traceUser:false});initialized=true}catch(_){return false}}
 return true
}
async function call(action, payload = {}) {
 if (!init()) { const e=new Error('营地社交尚未开放，云端连接完成后即可使用。');e.code='UNCONFIGURED';throw e }
 let response
 try { response=await wx.cloud.callFunction({name:'trailSocial',data:{action,payload}}) }
 catch (_) { throw new Error('暂时无法连接营地，请检查网络后重试。') }
 const result=response.result
 if(!result || !result.ok){const e=new Error(result && result.error && result.error.message || '营地服务暂不可用，请稍后重试。');e.code=result && result.error && result.error.code;throw e}
 return result.data
}
function decorate(profile) { return Object.assign({},profile,{avatar:AVATARS[profile.avatarIndex]||AVATARS[0]}) }
function timeLabel(value) { const d=new Date(value);return (d.getMonth()+1)+'月'+d.getDate()+'日 '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0') }
module.exports={AVATARS,available,init,call,decorate,timeLabel}

