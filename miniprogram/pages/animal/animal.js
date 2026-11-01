const { ANIMALS } = require('../../utils/wildlife.js')
const { getMountain } = require('../../utils/cityCatalog.js')
const journal = require('../../utils/journal.js')
const speech = require('../../utils/speech.js')
Page({
  data: { animal: null, seen: false, visits: [], visitCount: 0 },
  onLoad(options) { this.animalId = options.id; this.refresh() },
  onShow() { if (this.animalId) this.refresh() },
  refresh() {
    const animal = ANIMALS.find(item => item.id === this.animalId)
    if (!animal) { wx.showToast({title:'没有找到这位山林朋友',icon:'none'}); return }
    const visits = Object.values(journal.read().encounters).filter(item => item.animalId === animal.id)
      .sort((a,b) => b.at - a.at).map(item => {
        const mountain = getMountain(item.mountainId), date = new Date(item.at)
        return { mountain: mountain ? mountain.name : '山间小径', date: date.getFullYear() + '.' + (date.getMonth()+1) + '.' + date.getDate() }
      })
    this.setData({ animal: visits.length ? animal : null, seen: visits.length > 0, visits, visitCount: visits.length })
  },
  goDiscover() { wx.switchTab({url:'/pages/discover/discover'}) },
  onHide() { speech.stop() }, onUnload() { speech.stop() }
})
