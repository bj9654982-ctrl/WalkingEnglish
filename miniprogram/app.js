// app.js
App({
  globalData: {
    // 每次学习组的单词数（学完 = 前进一段）
    groupSize: 5
  },
  onHide() { require('./utils/speech.js').stop() },
  onLaunch() {
    // 首次启动初始化本地进度结构
    const storage = require('./utils/storage.js')
    storage.initProgress()
    require('./utils/social.js').init()
  }
})
