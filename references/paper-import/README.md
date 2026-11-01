# Bug 修复与论文资料库

按 `当前存在的bug` 中的 3 张截图修复：

- 发音按钮：显式覆盖原生按钮默认宽度，改为随内容收缩；练习页将发音按钮放入居中容器，答案独立成行。
- 山林观察手册：列表卡片移除发音按钮，整张卡片进入 `pages/animal/animal`，展示已发现生物的英文名、发音、例句、科普和相遇足迹；未发现条目显示待发现状态。
- 阅读：原来的 3 篇小故事替换为 42 篇论文的书架。支持中英文关键词/方法/年份搜索、分类、排序、收藏、按原文件页码阅读、摘要摘录、字号调整、手动标记已读及断点续读。「我的」统计论文，清空学习记录同时清空论文进度及收藏。

## 来源和版本

来源为用户提供的 `J:\phd\图像质量方向\参考顶刊`。只读源目录；PDF 副本保存在 `originals/`，未修改原文件。

43 个 PDF 按 SHA-256 去重为 42 篇，合计 496 页。`TOPIQ-chenchaofeng.pdf` 与 `45-TOPIQ-2024.pdf` 完全相同，只收录一次。PDF 原件共 153,937,752 字节，约 154 MB，不放入小程序代码包。全文文字分成 4 个异步资料包（每包约 0.46–0.64 MB）。首页只加载目录；首次打开全文时下载对应资料包，缓存由微信管理。

版本核对记录：

- `08-MAD-2010.pdf` 实际为 2008 年的 Maximum Differentiation (MAD) Competition，不是 2010 年的 Most Apparent Distortion 指标论文。按实际标题、年份归入「研究方法」。
- `17-RR-WNISM-2004.pdf` 实际为 2009 年 Divisive Normalization 论文，DOI 10.1109/JSTSP.2009.2014497，书架显示 RR-DN 并保留原文件名。
- BIECON 为 5 页会议短版。FRIQUEE 的文件年份与稿件页眉存在差异。详情页均有版本说明。
- UQI 原 PDF 字符映射损坏，通过本地 Tesseract 英文 OCR 恢复，按左右栏顺序提取；详情页标注 OCR。普通 PDF 使用 PyMuPDF 分栏提取，并清理断词和英文连字。文字阅读版不等同于 PDF 的公式与图表排版。
- SSIM 的本地中文译文和配图仍保留在源目录。本次书架收录 PDF 正文，不把另附的翻译整理脚本作为阅读资料。

## 原始 PDF 的小程序接入

文字全文已内置，可独立阅读。原 PDF 需要按需从云存储打开：

1. 使用既定微信云开发环境，将 `cloud-upload-manifest.json` 中的 PDF 副本上传到自己的云存储，建议沿用清单中的 `cloudPath`。
2. 把上传返回的 fileID 按论文 ID 填入 `miniprogram/config/papers.js` 的 `files`。可参考 `cloud-files.example.js`。
3. 在 `miniprogram/config/cloud.js` 填写实际环境 ID。也支持已配置合法 downloadFile 域名的 HTTPS PDF 地址。
4. 小程序用 `downloadFile` + `openDocument` 打开 PDF，支持原始公式、图表和菜单。无配置时明确提示，文字版继续可用。离开页面后迟到的下载不会突然打开文档。

浏览器适配预览从只监听 `127.0.0.1` 的服务器读取项目内的 PDF 副本，支持 HTTP Range。这个本地预览途径不能替代微信真机云存储接入。

## 听读

保留全应用听读。论文书架增加小圆形标题听读控件，详情可听标题、本页或单个段落。已生成论文标题的本地英文音频，整套音频从 816 条增加为 859 条，约 11.21 MiB；每个语音包仍小于 1.9 MB，低于 2 MiB 单包限制。

新论文正文的连续朗读调用已有 `trailSpeech` 云函数，需配置云环境、腾讯云语音服务及凭据后启用，参见 [语音接入说明](../speech-build/README.md)。本次没有开通远程语音或上传原 PDF。

## 重建与验证

```text
python tools/import-papers.py "J:\phd\图像质量方向\参考顶刊"
node tools/build-paper-library.js
node tools/build-speech.js prepare
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/build-speech.ps1 -Ffmpeg <本机 ffmpeg.exe 路径>
node tools/build-speech.js finalize
node tests/papers.js
node tools/check-native.js
```

OCR 模型使用 [Tesseract tessdata_fast 官方英文模型](https://github.com/tesseract-ocr/tessdata_fast)，放在本目录 `tessdata/eng.traineddata`。原生分包入口使用 `require.async`。资源目录显式纳入打包配置，防止动态路径被未引用资源剔除。

验收结果见 `VALIDATION.md`；截图 `shelf-preview.jpg`、`reader-preview.jpg`、`practice-fixed.jpg`、`journal-fixed.jpg`、`animal-detail.jpg`。
