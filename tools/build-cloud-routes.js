const fs=require('node:fs'),path=require('node:path')
const {ALL_MOUNTAINS}=require('../miniprogram/utils/cityCatalog')
const {BOOKS,getMountainWords}=require('../miniprogram/utils/wordCatalog')
const routes={version:1,mountains:{}}
for(const m of ALL_MOUNTAINS){routes.mountains[m.id]={id:m.id,cityId:m.cityId,books:{}};for(const b of BOOKS)routes.mountains[m.id].books[b.id]=getMountainWords(m.id,b.id).map(w=>w.w)}
fs.writeFileSync(path.join(__dirname,'../cloudfunctions/trailSocial/routes.json'),JSON.stringify(routes))
console.log('Cloud route catalog: '+ALL_MOUNTAINS.length+' mountains, '+BOOKS.length+' books.')
