# 英文听读

内置内容使用 Microsoft Zira Desktop（en-US）本地合成，语速 -1，MP3 单声道 22.05 kHz / 40 kbps。816 条去重音频共 10,535,207 字节（约 10.05 MiB），分为 8 个按需加载分包，每包小于 1.7 MB，不增加首页的音频加载量。首次听读需要微信加载对应分包；已缓存资源可直接播放，缓存能否保留由微信管理。音频不是真人录音。

覆盖 370 个单词、全部配套例句、3 篇阅读的标题/正文/问题/选项/英文解析、6 种生物及例句、英文页面标语。整篇朗读按句顺序播放。混合中英文仅提取英文；音标作为标注保留，不作为英文朗读。原生小程序通过 `require.async` 异步加载各包的 `loader.js`，不使用小游戏的 `wx.loadSubpackage` API。项目基础库版本为 3.4.0。

## 重建

1. `node tools/build-speech.js prepare`
2. 使用安装了英文 SAPI 语音的 Windows，在允许读取语音引擎的终端运行 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/build-speech.ps1 -Ffmpeg <ffmpeg.exe路径>`。生成过程只写项目目录。现有同名音频会复用；改变音色时需先将旧音频移到项目内备份目录，再重建。
3. `node tools/build-speech.js finalize`
4. `node tests/speech.js`、`node tools/check-native.js`。

语料来自 `tools/speech-corpus.js`，按 `speechText.parts` 分句及按词边界切块；增加内置英文时也应加入语料再生成。文件名使用规范化文本 SHA-256 的前 20 位，构建时检查碰撞及大小。项目配置显式包含 `audio` 目录，并关闭开发/上传时的未引用文件剔除，防止动态音频路径被打包器误删。

## 玩家自行输入的英文

昵称、简介、消息等含英文时显示听读按钮。已收录文本优先走本地音频；未收录内容调用本应用的 `trailSpeech` 云函数，不再使用有道词典音源。尚未配置云环境时会明确提示，不会假装播放成功。

云端部署步骤（本次未部署、未启用计费服务）：

1. 沿用 `miniprogram/config/cloud.js` 中的环境 ID。上传并部署 `cloudfunctions/trailSpeech`，选择云端安装依赖。
2. 创建 `trail_speech_usage` 集合，使用项目的 `cloudfunctions/database-permissions.json` 禁止客户端直接读写。仅存每日计数和时间，不存朗读原文或音频。
3. 在腾讯云开通语音合成；给专用凭据最小权限 `tts:TextToVoice`。仅在云函数的受保护环境变量中配置 `TTS_SECRET_ID`、`TTS_SECRET_KEY`，核对费用后设置 `TTS_ENABLED=true`。不要将密钥写入小程序。
4. 函数超时建议 20 秒；在产品隐私说明中说明自定义文本的腾讯云语音处理。客户端按需传入英文片段，服务端认证 OPENID、限制 400 字符，默认每人每天 60 次、全应用每天 1000 次（失败合成也消耗已预留额度）。每天额度按北京时间重置；旧计数可由管理员定期清理。
5. 双账号真机验证：含英文消息可听读、中文不显示空按钮、额度/断网提示正常、离开页面停止且临时音频被删除。私信仍遵守已有可见性和访问控制；用户不能用该函数读取别人的消息。

接口依据：[腾讯云 TextToVoice](https://cloud.tencent.com/document/api/1073/37995)、[官方音色列表](https://cloud.tencent.com/document/product/1073/92668)、[微信官方音频 API 类型](https://github.com/wechat-miniprogram/api-typings)。当前云端使用英文精品音色 101050。内置音频不依赖此服务。
