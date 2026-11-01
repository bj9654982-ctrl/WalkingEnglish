const fs = require('node:fs'), path = require('node:path')
const root = path.resolve(__dirname, '..'), mini = path.join(root, 'miniprogram')
const extracted = require('../references/paper-import/extracted.json')
const metadata = require('./paper-metadata')
const categories = [{id:'all',name:'全部'}, {id:'fr',name:'全参考'}, {id:'rr',name:'半参考'},
  {id:'nr-nss',name:'无参考 · 统计'}, {id:'nr-deep',name:'无参考 · 深度'}, {id:'foundation',name:'视觉基础'}, {id:'methodology',name:'研究方法'}]
const groups = Array.from({length:4}, () => ({})), papers = []
const sanitize = text => text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '').replace(/\uFFFD/g,'').trim()
for (let i = 0; i < extracted.papers.length; i++) {
  const record = extracted.papers[i], info = metadata[record.id]
  if (!info) throw Error('Missing reviewed metadata: ' + record.id)
  const [title, name, year, category, note=''] = info, pack = i % groups.length
  const pages = record.pages.map(page => ({number:page.number, ocr:page.ocr,
    paragraphs:sanitize(page.text).split(/\n\s*\n/).map(block => block.replace(/\s+/g,' ').trim()).filter(Boolean)}))
  groups[pack][record.id] = {id:record.id, pages}
  const abstract = pages[0].paragraphs.join(' ').match(/\babstract\s*[—:\-]?\s*([\s\S]*?)(?:\b(?:index terms|keywords|key words|I\.? introduction)\b|$)/i)
  papers.push({ id:record.id, method:record.id==='rr-wnism'?'RR-DN':record.method, title, name, year, category,
    categoryName:categories.find(c=>c.id===category).name, pageCount:record.pageCount, pack,
    filename:record.filename, bytes:record.bytes, sha256:record.sha256, versionNote:note,
    hasOCR:pages.some(page=>page.ocr), language:record.id==='sparse-iqa'?'中英':'英文',
    abstract:abstract?abstract[1].trim().slice(0,2400):'',
    search:[record.method,title,name,year,record.filename,category].join(' ').toLowerCase() })
}
for (let i=0;i<groups.length;i++) {
  const dir = path.join(mini,'papers/pack'+i); fs.mkdirSync(dir,{recursive:true})
  fs.writeFileSync(path.join(dir,'library.js'), 'module.exports = '+JSON.stringify(groups[i])+'\n')
  fs.writeFileSync(path.join(dir,'ready.js'),'Page({})\n')
  fs.writeFileSync(path.join(dir,'ready.json'),'{"navigationBarTitleText":"论文资料"}\n')
  fs.writeFileSync(path.join(dir,'ready.wxml'),'<view>论文资料已就绪，请返回阅读页。</view>\n')
  fs.writeFileSync(path.join(dir,'ready.wxss'),'view { padding: 48rpx; color: #365b48; }\n')
}
fs.writeFileSync(path.join(mini,'data/papers.js'), 'module.exports = '+JSON.stringify({papers,categories},null,2)+'\n')
const configPath = path.join(mini,'app.json'), app = JSON.parse(fs.readFileSync(configPath,'utf8'))
app.pages = [...new Set(app.pages.concat('pages/animal/animal','pages/paper/paper'))]
app.subPackages = (app.subPackages||[]).filter(p=>!p.root.startsWith('papers/')).concat(groups.map((_,i)=>({root:'papers/pack'+i,name:'papers'+i,pages:['ready']})))
fs.writeFileSync(configPath,JSON.stringify(app,null,2)+'\n')
const configFile=path.join(root,'project.config.json'), config=JSON.parse(fs.readFileSync(configFile,'utf8'))
if (!config.packOptions.include.some(p=>p.value==='papers')) config.packOptions.include.push({type:'folder',value:'papers'})
fs.writeFileSync(configFile,JSON.stringify(config,null,2)+'\n')
const result={papers:papers.length,pages:papers.reduce((n,p)=>n+p.pageCount,0),duplicates:extracted.duplicates,
  textPackages:groups.map((_,i)=>fs.statSync(path.join(mini,'papers/pack'+i+'/library.js')).size),pdfBytes:papers.reduce((n,p)=>n+p.bytes,0)}
fs.writeFileSync(path.join(root,'references/paper-import/library-report.json'),JSON.stringify(result,null,2)+'\n')
fs.writeFileSync(path.join(root,'references/paper-import/cloud-upload-manifest.json'),JSON.stringify(papers.map(p=>({id:p.id,localFile:'references/paper-import/originals/'+p.filename,cloudPath:'papers/'+p.id+'.pdf',bytes:p.bytes,sha256:p.sha256})),null,2)+'\n')
fs.writeFileSync(path.join(root,'references/paper-import/cloud-files.example.js'),'// Copy returned cloud file IDs into miniprogram/config/papers.js.\nmodule.exports = '+JSON.stringify({files:Object.fromEntries(papers.map(p=>[p.id,'']))},null,2)+'\n')
console.log(JSON.stringify(result))
