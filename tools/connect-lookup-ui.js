// Idempotent integration for English content in the native templates.
const fs=require('node:fs'),path=require('node:path')
const root=path.join(__dirname,'../miniprogram')
const entries={
 reading:[['{{item.title}}',"{{item.method+' · 标题'}}"]],
 animal:[['{{animal.word}}','山林观察手册'],['{{animal.sentence}}',"{{animal.name+' · 观察例句'}}"]],
 trail:[['{{encounter.word}}','山林相遇'],['{{encounter.sentence}}',"{{encounter.name+' · 相遇例句'}}"]],
 chat:[['{{item.text}}','营地私信'],['{{profile.bio||\'让每一次交流，都像山风一样友善。\'}}','玩家简介']],
 social:[['{{item.lastMessage}}','营地私信'],['{{item.bio}}','玩家简介']],
 profile:[['{{profile?profile.bio:\'给自己一点时间，走自己的山路。\'}}','我的简介']],
 camp:[["{{item.bio||'把一步一步，走成自己的故事。'}}",'营地玩家简介']],
 practice:[['{{item.w}}','练习错词'],['{{word.ex}}',"{{word.w+' · 练习例句'}}"]]
}
for(const name of fs.readdirSync(path.join(root,'pages'))){
 const file=path.join(root,'pages',name,name+'.wxml');if(!fs.existsSync(file))continue
 let source=fs.readFileSync(file,'utf8')
 for(const [text,origin] of entries[name]||[]){
   source=source.replaceAll('>'+text+'</','><lookup-text text="'+text+'" source="'+origin+'"/></')
 }
 source=source.replace(/(<text class="eyebrow">)([A-Z][A-Z .]+)(<\/text>)/g,(_,open,text,close)=>open+'<lookup-text text="'+text+'" source="页面寄语"/>'+close)
 // Native text containers only support text children. Keep custom components outside them.
 source=source.replace(/<text class="eyebrow">(<lookup-text[^>]*\/>)<\/text>/g,'<view class="eyebrow">$1</view>')
 source=source.replace(/<text selectable>(<lookup-text[^>]*\/>)<\/text>/g,'<view>$1</view>')
 fs.writeFileSync(file,source)
}
