// 本地视觉验收：直接加载山道 JS / WXML / WXSS，模拟 wx Canvas 和组件接口。
// 音频使用真实 MP3；不模拟微信授权、分包下载策略、分享或真机性能，不用于发布。
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const port = Number(process.env.PREVIEW_PORT || 4173)
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  let file = decodeURIComponent(url.pathname)
  const paperMatch = /^\/paper-original\/([a-z0-9-]+)\.pdf$/.exec(file)
  if (paperMatch) {
    const paper = require('../miniprogram/data/papers.js').papers.find(p=>p.id===paperMatch[1])
    if (!paper) { res.writeHead(404); res.end('Paper not found'); return }
    const original = path.join(root,'references/paper-import/originals',paper.filename)
    const size = fs.statSync(original).size, range = req.headers.range && /^bytes=(\d+)-(\d*)$/.exec(req.headers.range)
    let start=0,end=size-1,status=200
    if(range){start=Number(range[1]);end=range[2]?Math.min(Number(range[2]),size-1):end;status=206}
    if(start>end||start>=size){res.writeHead(416,{'Content-Range':'bytes */'+size});res.end();return}
    const headers={'Content-Type':'application/pdf','Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'no-store'}
    if(status===206)headers['Content-Range']='bytes '+start+'-'+end+'/'+size
    res.writeHead(status,headers)
    if(req.method==='HEAD'){res.end();return}
    const stream=fs.createReadStream(original,{start,end});stream.on('error',()=>res.destroy());stream.pipe(res);return
  }
  if (file === '/') file = '/tools/preview.html'
  if (file.startsWith('/assets/') || file.startsWith('/audio/')) file = '/miniprogram' + file
  const target = path.resolve(root, '.' + file)
  const allowed = ['miniprogram', 'tools'].some((dir) => target.startsWith(path.join(root, dir) + path.sep))
  if (!allowed) { res.writeHead(403); res.end(); return }
  fs.readFile(target, (error, data) => {
    if (error) { res.writeHead(404); res.end('Not found'); return }
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.wxss': 'text/plain; charset=utf-8', '.wxml': 'text/plain; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3':'audio/mpeg' }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
    res.end(data)
  })
})
server.listen(port, '127.0.0.1', () => console.log('Trail preview: http://127.0.0.1:' + port))
