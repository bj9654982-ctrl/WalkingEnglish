// Run prepare -> build-speech.ps1 -> finalize. Only generated paths are written.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto')
const root = path.resolve(__dirname, '..'), output = path.join(root, 'references/speech-build')
const entries = require('./speech-corpus').map(entry => {
  const hash = crypto.createHash('sha256').update(entry.id).digest('hex').slice(0, 20)
  const pack = parseInt(hash.slice(0, 2), 16) % 8
  return { ...entry, pack, path: `audio/pack${pack}/${hash}.mp3` }
})
if (new Set(entries.map(e => e.path)).size !== entries.length) throw Error('Audio hash collision')
fs.mkdirSync(output, { recursive: true })
if (process.argv[2] === 'prepare') {
  for (let i = 0; i < 8; i++) fs.mkdirSync(path.join(root, `miniprogram/audio/pack${i}`), { recursive: true })
  fs.writeFileSync(path.join(output, 'corpus.json'), JSON.stringify(entries, null, 2))
  console.log(`Prepared ${entries.length} clips in 8 audio packages.`)
} else if (process.argv[2] === 'finalize') {
  const sizes = Array(8).fill(0), manifest = {}
  for (const e of entries) {
    const file = fs.readFileSync(path.join(root, 'miniprogram', e.path))
    if (file.length < 300 || !(file.toString('ascii', 0, 3) === 'ID3' || file[0] === 0xff)) throw Error('Invalid MP3: ' + e.path)
    sizes[e.pack] += file.length; manifest[e.id] = e.path
  }
  if (sizes.some(n => n > 1700000)) throw Error('Audio package exceeds 1.7 MB budget')
  for (let i = 0; i < 8; i++) {
    const prefix = path.join(root, `miniprogram/audio/pack${i}/ready`)
    fs.writeFileSync(path.join(root, `miniprogram/audio/pack${i}/loader.js`), 'module.exports = { ready: true }\n')
    fs.writeFileSync(prefix + '.js', 'Page({})\n')
    fs.writeFileSync(prefix + '.json', '{"navigationBarTitleText":"语音资源"}\n')
    fs.writeFileSync(prefix + '.wxml', '<view>语音资源包已就绪，请返回学习页面。</view>\n')
    fs.writeFileSync(prefix + '.wxss', 'view { padding: 48rpx; color: #365b48; }\n')
  }
  fs.writeFileSync(path.join(root, 'miniprogram/data/speechManifest.js'), 'module.exports = ' + JSON.stringify(manifest, null, 2) + '\n')
  const configPath = path.join(root, 'miniprogram/app.json'), app = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  app.subPackages = Array.from({length:8}, (_, i) => ({ root:`audio/pack${i}`, name:`voice${i}`, pages:['ready'] }))
  app.usingComponents = { ...app.usingComponents, 'speech-button':'/components/speech-button/speech-button' }
  fs.writeFileSync(configPath, JSON.stringify(app, null, 2) + '\n')
  fs.writeFileSync(path.join(output, 'sizes.json'), JSON.stringify({ clips:entries.length, bytes:sizes.reduce((a,b)=>a+b,0), packages:sizes }, null, 2))
  console.log(JSON.stringify({clips:entries.length, packages:sizes, bytes:sizes.reduce((a,b)=>a+b,0)}))
} else throw Error('Use prepare or finalize')
