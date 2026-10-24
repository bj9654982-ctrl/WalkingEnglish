const assert = require('node:assert/strict')

function createCanvas() {
  const calls = [], images = []
  const gradient = { addColorStop() {} }
  const context = {}
  for (const method of ['save', 'restore', 'clip', 'translate', 'scale', 'rotate', 'setTransform', 'beginPath', 'closePath', 'arc', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'fill', 'stroke', 'fillRect', 'clearRect', 'fillText', 'drawImage']) {
    context[method] = (...args) => {
      args.forEach((arg) => { if (typeof arg === 'number') assert.ok(Number.isFinite(arg), method + ' received non-finite coordinate') })
      calls.push({ method, args })
    }
  }
  context.createLinearGradient = context.createRadialGradient = () => gradient
  return {
    width: 390, height: 844, calls, images, context,
    getContext(type) { assert.equal(type, '2d'); return context },
    createImage() { const image = { width: 1536, height: 1024 }; images.push(image); return image }
  }
}

module.exports = { createCanvas }
