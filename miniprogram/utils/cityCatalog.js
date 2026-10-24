const { MOUNTAINS } = require('./trailData.js')
// ID 0–6 永久保留给旧版武汉存档。路线为学习关卡，不代表真实步道导航。
const CITIES = [
  { id: 'wuhan', name: '武汉', subtitle: '东湖七山 · 湖光与书香', theme: '湖畔漫游', note: '从熟悉的东湖出发，把七座山连成一段学习旅程。' },
  { id: 'hangzhou', name: '杭州', subtitle: '西湖群山 · 茶香与林影', theme: '湖山听风', note: '沿着西湖的山色，在一词一句里慢慢向上。' },
  { id: 'beijing', name: '北京', subtitle: '京城山色 · 松风与远眺', theme: '山间远眺', note: '在松林与山脊之间，收集属于自己的新词。' },
  { id: 'chengdu', name: '成都', subtitle: '蜀地青山 · 云雾与竹影', theme: '云中小径', note: '走进青翠的山间，让学习像散步一样自然。' },
  { id: 'guangzhou', name: '广州', subtitle: '羊城叠翠 · 花木与暖风', theme: '绿意常在', note: '循着温暖的山风，让每一次坚持都留下足迹。' },
  { id: 'nanjing', name: '南京', subtitle: '金陵山林 · 古意与秋色', theme: '林间寻光', note: '在起伏的林间小径，读一段故事，走一程山路。' }
]
const extras = [
  ['hangzhou', '宝石山', '宝石流霞', '拾一片湖光，记一个新词'], ['hangzhou', '玉皇山', '山间云起', '让脚步穿过轻柔的云'], ['hangzhou', '北高峰', '登高望湖', '带着新学的词望向远方'],
  ['beijing', '香山', '松风红叶', '在林间收集一页秋色'], ['beijing', '景山', '城中远望', '一步一词，慢慢看见更远'], ['beijing', '百望山', '绿野松涛', '听风从树梢经过'],
  ['chengdu', '青城山', '幽林竹影', '慢一点，山里有好故事'], ['chengdu', '西岭雪山', '云端来信', '向着云上的光前进'], ['chengdu', '龙泉山', '山野花信', '让新词在山路上开花'],
  ['guangzhou', '白云山', '白云叠翠', '把小小坚持藏进云里'], ['guangzhou', '火炉山', '石径林荫', '循着树影，继续向前'], ['guangzhou', '莲花山', '临风听绿', '山风会记住你的脚步'],
  ['nanjing', '紫金山', '林海微光', '在树与光之间找到方向'], ['nanjing', '栖霞山', '枫林晚照', '下一页故事就在山间'], ['nanjing', '老山', '青山慢行', '每一步都有新的发现']
]
const ALL_MOUNTAINS = MOUNTAINS.map((m, index) => Object.assign({}, m, { cityId: 'wuhan', routeIndex: index })).concat(extras.map((entry, index) => ({
  id: index + 7, cityId: entry[0], routeIndex: index % 3, name: entry[1], alias: entry[2], tagline: entry[3],
  level: 'classic', totalWords: 0, scene: { seed: 103 + index * 17, mood: 'morning' }
})))
function getCity(id) { return CITIES.find((c) => c.id === id) || CITIES[0] }
function getMountain(id) { return ALL_MOUNTAINS.find((m) => m.id === Number(id)) || null }
function getCityMountains(cityId = 'wuhan') { return ALL_MOUNTAINS.filter((m) => m.cityId === getCity(cityId).id) }
function getSelectedCity() { return getCity(wx.getStorageSync('we_city_v1')) }
function setSelectedCity(id) { if (!CITIES.some((c) => c.id === id)) return false; wx.setStorageSync('we_city_v1', id); return true }
module.exports = { CITIES, ALL_MOUNTAINS, getCity, getMountain, getCityMountains, getSelectedCity, setSelectedCity }
