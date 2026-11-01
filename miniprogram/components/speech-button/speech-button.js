const speech = require('../../utils/speech.js')
const { english } = require('../../utils/speechText.js')
let sequence = 0
Component({
  properties: { text: { type: String, value: '' }, segments: { type: Array, value: [] }, label: { type: String, value: '听读' }, compact: { type: Boolean, value: false }, iconOnly: { type: Boolean, value: false } },
  data: { readable: false, active: false, loading: false, failed: false, progress: '' },
  observers: { 'text, segments': function () { if (this.speechOwner) speech.stop(this.speechOwner); this.refreshText() } },
  lifetimes: {
    attached() {
      this.speechOwner = 'speech-' + (++sequence)
      this.refreshText()
      this.unsubscribe = speech.subscribe(state => {
        const own = state.owner === this.speechOwner, active = own && ['loading', 'playing'].includes(state.status)
        const patch = { active, loading: active && state.status === 'loading', failed: own && state.status === 'error', progress: active && state.total > 1 ? (state.index + 1) + '/' + state.total : '' }
        if (Object.keys(patch).some(k => this.data[k] !== patch[k])) this.setData(patch)
      })
    },
    detached() { if (this.unsubscribe) this.unsubscribe(); speech.stop(this.speechOwner) }
  },
  pageLifetimes: { hide() { speech.stop(this.speechOwner) } },
  methods: {
    refreshText() { this.setData({ readable: !!english(this.properties.segments.length ? this.properties.segments.join(' ') : this.properties.text) }) },
    toggle() { speech.speak(this.properties.segments.length ? this.properties.segments : this.properties.text, { owner: this.speechOwner }) }
  }
})
