const sources = require('../config/papers.js')
const cloud = require('./social.js')
function open(id, options = {}) {
  const source=sources.files[id]
  if (!source) { wx.showToast({title:'原 PDF 尚未连接云存储，可先阅读已收录的文字全文。',icon:'none',duration:3500});return Promise.resolve(false) }
  if (!/^cloud:\/\//.test(source) && !/^https:\/\//.test(source)) return Promise.reject(Error('PDF 地址配置无效。'))
  return new Promise((resolve,reject)=>{
    const success=result=>{
      if(options.isActive&&!options.isActive()){resolve(false);return}
      wx.openDocument({filePath:result.tempFilePath,fileType:'pdf',showMenu:true,success:()=>resolve(true),fail:()=>reject(Error('PDF 打开失败，请重试。'))})
    }
    const fail=()=>reject(Error('PDF 下载失败，请检查网络后重试。'))
    if (source.startsWith('cloud://')) {
      if (!cloud.init()) { reject(Error('请先配置微信云环境。'));return }
      wx.cloud.downloadFile({fileID:source,success,fail})
    } else wx.downloadFile({url:source,success:result=>result.statusCode===200?success(result):fail(),fail})
  })
}
module.exports={open}
