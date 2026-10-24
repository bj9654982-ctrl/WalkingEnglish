const { getMountain } = require('./cityCatalog.js')
const journal = require('./journal.js')
const ANIMALS = [
  { id: 'squirrel', name: '松鼠', word: 'squirrel', icon: '🐿️', hint: '一条蓬松的尾巴在树影间晃了晃。', fact: '松鼠会储藏食物。远远观察，让它安心留在自己的家。', sentence: 'A squirrel is hiding behind the tree.', translation: '一只松鼠正躲在树后。' },
  { id: 'butterfly', name: '蝴蝶', word: 'butterfly', icon: '🦋', hint: '一对轻盈的翅膀停在路边的花上。', fact: '蝴蝶用触角感受周围。留住观察的记忆，不带走它的翅膀。', sentence: 'The butterfly rests on a flower.', translation: '蝴蝶停在一朵花上。' },
  { id: 'snail', name: '蜗牛', word: 'snail', icon: '🐌', hint: '一位背着小房子的旅人慢慢爬过石头。', fact: '蜗牛靠腹足移动。慢慢走，也能抵达自己的目的地。', sentence: 'The snail moves slowly on a leaf.', translation: '蜗牛在一片叶子上慢慢移动。' },
  { id: 'bird', name: '小鸟', word: 'bird', icon: '🐦', hint: '树梢传来清脆的一声鸣叫。', fact: '安静观察鸟儿，比靠近鸟巢更适合做一个山林朋友。', sentence: 'A bird sings in the morning.', translation: '一只小鸟在清晨歌唱。' },
  { id: 'firefly', name: '萤火虫', word: 'firefly', icon: '✦', hint: '草丛里闪起了一点微微的光。', fact: '萤火虫用身体里的光交流。关掉强光，给夜色留一份安静。', sentence: 'A firefly shines in the dark.', translation: '一只萤火虫在黑暗里发光。' },
  { id: 'ladybird', name: '瓢虫', word: 'ladybird', icon: '🐞', hint: '叶尖上，一颗红色的小圆点正在移动。', fact: '不同瓢虫的斑点数不同，斑点并不能告诉我们它的年龄。', sentence: 'The ladybird has small black spots.', translation: '瓢虫身上有小小的黑色斑点。' }
]
const STOPS = [0.12, 0.38, 0.66, 0.9]
function encounters(mountainId, bookId) {
  const mountain = getMountain(mountainId)
  if (!mountain) return []
  const saved = journal.read().encounters
  return STOPS.map((at, index) => {
    const animal = ANIMALS[(mountain.id + index * 2 + Math.floor(index / 2)) % ANIMALS.length]
    const key = bookId + ':' + mountain.id + ':' + index
    const choices = [animal.word, ANIMALS[(ANIMALS.indexOf(animal) + 1) % ANIMALS.length].word, ANIMALS[(ANIMALS.indexOf(animal) + 3) % ANIMALS.length].word]
    // 固定轮换答案位置，重新进入也不会重新抽取遇见记录。
    for (let i = 0; i < (mountain.id + index) % 3; i++) choices.push(choices.shift())
    return Object.assign({}, animal, { key, at, collected: !!saved[key], choices })
  })
}
function nextEncounter(mountainId, bookId, progress) { return encounters(mountainId, bookId).find((a) => !a.collected && a.at <= progress + 0.000001) || null }
function collect(animal, mountainId) { return journal.collect(animal.key, animal.id, mountainId) }
module.exports = { ANIMALS, STOPS, encounters, nextEncounter, collect }
