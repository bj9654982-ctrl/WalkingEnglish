// utils/trailData.js
// 东湖七山数据（顺序：东湖一棵树出发，经典徒步方向）
// 参考：武汉市政府官网"东湖七山步道"（枫多山→…→南望山，主线约20km）

const MOUNTAINS = [
  {
    id: 0,
    name: '枫多山',
    alias: '含猴山',
    level: 'easy',
    levelName: '入门 · 日常词',
    totalWords: 40,
    elevation: 49,
    distance: 1.8,
    tagline: '东湖一棵树，旅程的起点',
    desc: '临湖而起的小山，林荫蔽日，常有猴群出没。热身之旅，在湖风里学会第一组单词。',
    scene: {
      skyTop: '#8fb6e8', skyBottom: '#f7d9c8',
      fog: '#e8d9c8',
      hillA: '#8fbf7f', hillB: '#6fa566',
      rock: '#b9b0a0',
      mood: 'dawn',
      height: 26, turns: 3, seed: 11, trees: 46, clouds: 6,
      lakeSide: true, lightGold: '#ffe3b3'
    }
  },
  {
    id: 1,
    name: '斧头山',
    alias: '含虎口山',
    level: 'easy',
    levelName: '入门 · 日常词',
    totalWords: 45,
    elevation: 67,
    distance: 2.2,
    tagline: '山势如斧，虎口临风',
    desc: '山形陡然收窄，形如斧刃。坡度微微抬升，日常词汇继续陪你前行。',
    scene: {
      skyTop: '#7fb0e0', skyBottom: '#dcebf5',
      fog: '#d8e6ee',
      hillA: '#86bb78', hillB: '#67a35e',
      rock: '#aeb4a6',
      mood: 'morning',
      height: 32, turns: 4, seed: 23, trees: 54, clouds: 7,
      lakeSide: true, lightGold: '#fff0cf'
    }
  },
  {
    id: 2,
    name: '风筝山',
    alias: '',
    level: 'cet4',
    levelName: '四级 · 核心词',
    totalWords: 50,
    elevation: 84,
    distance: 2.6,
    tagline: '山顶开阔，纸鸢乘风',
    desc: '因常有市民在此放风筝得名。视野第一次开阔起来，四级核心词登场。',
    scene: {
      skyTop: '#6fa8dc', skyBottom: '#eaf4fb',
      fog: '#dce9f2',
      hillA: '#7cb370', hillB: '#5e9c58',
      rock: '#b2b2a4',
      mood: 'midday',
      height: 38, turns: 4, seed: 37, trees: 60, clouds: 8,
      lakeSide: true, lightGold: '#fff6dd'
    }
  },
  {
    id: 3,
    name: '夹山',
    alias: '',
    level: 'cet4',
    levelName: '四级 · 核心词',
    totalWords: 50,
    elevation: 91,
    distance: 2.8,
    tagline: '两峰相夹，幽谷穿行',
    desc: '山脊在两峰之间起伏，是最安静的一段路。专注攻克四级词，听见自己的脚步。',
    scene: {
      skyTop: '#79a6d6', skyBottom: '#f6e3b8',
      fog: '#e4dcc4',
      hillA: '#7faf6e', hillB: '#619a56',
      rock: '#b6ad96',
      mood: 'golden',
      height: 42, turns: 5, seed: 47, trees: 66, clouds: 7,
      lakeSide: false, lightGold: '#ffe6a8'
    }
  },
  {
    id: 4,
    name: '团山',
    alias: '',
    level: 'cet6',
    levelName: '六级 · 进阶词',
    totalWords: 55,
    elevation: 103,
    distance: 3.0,
    tagline: '圆润如团，云气渐生',
    desc: '山形浑圆，云雾开始在脚下游走。六级词汇带来新的挑战与风景。',
    scene: {
      skyTop: '#6f8fc8', skyBottom: '#f3c98f',
      fog: '#ddc9a8',
      hillA: '#76a668', hillB: '#5a8f50',
      rock: '#aca48e',
      mood: 'afternoon',
      height: 48, turns: 5, seed: 59, trees: 72, clouds: 9,
      lakeSide: false, lightGold: '#ffd98f'
    }
  },
  {
    id: 5,
    name: '喻家山',
    alias: '',
    level: 'cet6',
    levelName: '六级 · 进阶词',
    totalWords: 60,
    elevation: 149,
    distance: 3.4,
    tagline: '城区之巅，书香满径',
    desc: '武汉城区最高峰，毗邻学府。六级词汇的收官之战，风里都是书卷气。',
    scene: {
      skyTop: '#5f6fa8', skyBottom: '#d8a0c8',
      fog: '#c8b8d0',
      hillA: '#6f9c64', hillB: '#52874c',
      rock: '#a29ba6',
      mood: 'dusk',
      height: 56, turns: 6, seed: 71, trees: 80, clouds: 10,
      lakeSide: false, lightGold: '#f5b88a'
    }
  },
  {
    id: 6,
    name: '南望山',
    alias: '',
    level: 'kaoyan',
    levelName: '考研 · 高阶词',
    totalWords: 70,
    elevation: 139,
    distance: 3.8,
    tagline: '南望东湖，终见辽阔',
    desc: '七山连纵的终点。登顶俯瞰东湖与城市天际线，高阶词汇铺就最后的山脊。',
    scene: {
      skyTop: '#4a4a86', skyBottom: '#f2a05c',
      fog: '#d8b094',
      hillA: '#6a9460', hillB: '#4d7c48',
      rock: '#9c9098',
      mood: 'sunset',
      height: 64, turns: 7, seed: 89, trees: 90, clouds: 12,
      lakeSide: true, lightGold: '#ffbe6e'
    }
  }
]

const LEVEL_NAMES = {
  easy: '日常入门',
  cet4: '大学英语四级',
  cet6: '大学英语六级',
  kaoyan: '考研高阶'
}

function getMountain(id) {
  return MOUNTAINS[id] || null
}

module.exports = {
  MOUNTAINS,
  LEVEL_NAMES,
  getMountain
}
