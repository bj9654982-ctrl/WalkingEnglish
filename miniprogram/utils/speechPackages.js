// Mini-programs use asynchronous require for on-demand packages (not the Mini Game loadSubpackage API).
// Keep literal paths so WeChat's compiler can discover the cross-package dependencies.
function load(name) {
  if (typeof require.async !== 'function') return Promise.reject(Error('当前微信版本不支持按需语音，请更新微信后重试。'))
  switch (name) {
    case 'voice0': return require.async('../audio/pack0/loader.js')
    case 'voice1': return require.async('../audio/pack1/loader.js')
    case 'voice2': return require.async('../audio/pack2/loader.js')
    case 'voice3': return require.async('../audio/pack3/loader.js')
    case 'voice4': return require.async('../audio/pack4/loader.js')
    case 'voice5': return require.async('../audio/pack5/loader.js')
    case 'voice6': return require.async('../audio/pack6/loader.js')
    case 'voice7': return require.async('../audio/pack7/loader.js')
    default: return Promise.reject(Error('语音资源不存在。'))
  }
}
module.exports = { load }
