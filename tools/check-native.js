const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process')
const mini=path.join(__dirname,'../miniprogram')
const compiler=process.argv[2]||'C:/Program Files (x86)/Tencent/微信web开发者工具/resources/app.asar.unpacked/node_modules/wcc-exec'
const app=require('../miniprogram/app.json'),units=app.pages.concat('components/study-sheet/study-sheet','components/speech-button/speech-button',...(app.subPackages||[]).flatMap(p=>p.pages.map(page=>p.root+'/'+page)))
let failed=false
for(const [exe,files] of [['wcc.exe',units.map(p=>p+'.wxml')],['wcsc.exe',['app.wxss','styles/hub.wxss',...units.map(p=>p+'.wxss')]]]){
 const args=exe==='wcsc.exe'?['-pc',String(files.length),...files]:files
 const result=spawnSync(path.join(compiler,exe),args,{cwd:mini,encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024})
 if(result.error||result.status!==0){failed=true;console.error(exe,result.error||result.stderr||result.stdout)}
 else console.log('PASS '+exe+': '+files.length+' files compiled ('+Buffer.byteLength(result.stdout)+' bytes)')
}
process.exitCode=failed?1:0
