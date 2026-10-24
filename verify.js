// verify.js - 工程完整性检查
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const root = __dirname
const mini = path.join(root, 'miniprogram')
let failures = 0
function check(cond, msg) {
  if (cond) {
    console.log('  PASS  ' + msg)
  } else {
    console.log('  FAIL  ' + msg)
    failures++
  }
}

// 1. app.json 页面文件齐全
console.log('\n[1] 页面文件完整性')
const appJson = JSON.parse(fs.readFileSync(path.join(mini, 'app.json'), 'utf8'))
appJson.pages.forEach((p) => {
  ;['.js', '.wxml', '.wxss', '.json'].forEach((ext) => {
    const f = path.join(mini, p + ext)
    check(fs.existsSync(f), `${p}${ext}`)
  })
})
const componentPaths = new Set()
const units = appJson.pages.concat((appJson.subPackages || []).flatMap(p => p.pages.map(page => p.root + '/' + page)))
Object.values(appJson.usingComponents || {}).forEach(ref => { componentPaths.add(ref.slice(1)); units.push(ref.slice(1)) })
for (let index = 0; index < units.length; index++) {
  const unit = units[index]
  const config = JSON.parse(fs.readFileSync(path.join(mini, unit + '.json'), 'utf8'))
  Object.values(config.usingComponents || {}).forEach((ref) => {
    const component = ref.startsWith('/') ? ref.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(unit), ref))
    if (componentPaths.has(component)) return
    componentPaths.add(component)
    ;['.js', '.wxml', '.wxss', '.json'].forEach((ext) => check(fs.existsSync(path.join(mini, component + ext)), component + ext))
    if (fs.existsSync(path.join(mini, component + '.json'))) units.push(component)
  })
}

// 2. JSON 合法性
console.log('\n[2] JSON 合法性')
;['project.config.json', 'miniprogram/sitemap.json', 'miniprogram/app.json',
  ...units.map((p) => 'miniprogram/' + p + '.json')].forEach((f) => {
  try {
    JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'))
    check(true, f)
  } catch (e) {
    check(false, f + ' -> ' + e.message)
  }
})
const sitemapPath = path.resolve(mini, appJson.sitemapLocation)
check(sitemapPath.startsWith(mini + path.sep) && fs.existsSync(sitemapPath), 'sitemap 在小程序打包目录内且存在')
const { BACKGROUND } = require('./miniprogram/utils/trailScene')
const backdropPath = path.join(mini, BACKGROUND.replace(/^\//, ''))
check(fs.existsSync(backdropPath), '水彩山道背景已包含在小程序运行包内')
if (fs.existsSync(backdropPath)) {
  const image = fs.readFileSync(backdropPath)
  check(image.length < 600000 && image.readUInt16BE(0) === 0xffd8 && image.readUInt16BE(image.length - 2) === 0xffd9, '水彩背景 JPEG 完整且小于 600 KB')
}

// 3. 词库字段与数量
console.log('\n[3] 词库')
const { MOUNTAINS } = require('./miniprogram/utils/trailData.js')
const { ALL_MOUNTAINS } = require('./miniprogram/utils/cityCatalog.js')
const { BOOKS, getMountainWords } = require('./miniprogram/utils/wordCatalog.js')
const serverRoutes = require('./cloudfunctions/trailSocial/routes.json')
check(ALL_MOUNTAINS.every((m) => BOOKS.every((b) => JSON.stringify(serverRoutes.mountains[m.id].books[b.id]) === JSON.stringify(getMountainWords(m.id, b.id).map((w) => w.w)))), '云端营地词表与客户端 22 座山、5 本词书一致')
check(appJson.tabBar.list.every((tab) => ['iconPath','selectedIconPath'].every((key) => fs.existsSync(path.join(mini, tab[key])))), '底部导航图标齐全')
const permissions = require('./cloudfunctions/database-permissions.json')
check(permissions.read === false && permissions.write === false, '部署权限模板禁止客户端直接读写社交数据库')
const levelNeed = {}
MOUNTAINS.forEach((m) => {
  levelNeed[m.level] = (levelNeed[m.level] || 0) + m.totalWords
})
Object.keys(levelNeed).forEach((level) => {
  const words = require(path.join(mini, 'data/words', level + '.js'))
  check(words.length >= levelNeed[level],
    `${level}: ${words.length} 词 >= 山需求 ${levelNeed[level]}`)
  const bad = words.filter((w) => !w.w || !w.ph || !w.pos || !w.mean || !w.ex || !w.exZh)
  check(bad.length === 0, `${level}: 全部条目字段完整（w/ph/pos/mean/ex/exZh）`)
  const dup = words.length - new Set(words.map((w) => w.w)).size
  check(dup === 0, `${level}: 无重复单词`)
})

// 4. JS 语法
console.log('\n[4] JS 语法检查')
function walkJs(dir) {
  return fs.readdirSync(dir).reduce((acc, name) => {
    const f = path.join(dir, name)
    const st = fs.statSync(f)
    if (st.isDirectory()) acc.push(...walkJs(f))
    else if (name.endsWith('.js')) acc.push(f)
    return acc
  }, [])
}
walkJs(mini).concat(walkJs(path.join(root, 'cloudfunctions')).filter((f) => !f.includes('node_modules'))).forEach((f) => {
  try {
    execSync(`node --check "${f}"`, { stdio: 'pipe' })
    check(true, path.relative(root, f))
  } catch (e) {
    check(false, path.relative(root, f) + ' 语法错误')
  }
})

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`))
process.exit(failures === 0 ? 0 : 1)
