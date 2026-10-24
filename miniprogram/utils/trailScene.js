// Canvas 2D 分层山道。场景只读取学习进度，不写入存档。
const BACKGROUND = '/assets/trail/watercolor-valley.jpg'
const ROUTE_START = 180
const ROUTE_LENGTH = 4200
const CAMP_STOPS = [0.25, 0.55, 0.85]
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const noise = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }

function routePoint(t, seed = 11) {
  const x = ROUTE_START + clamp(t, 0, 1) * ROUTE_LENGTH
  return { x, y: groundY(x, seed) }
}
function groundY(x, seed) {
  // 斜率始终向上，人物脚底与山道共用同一条曲线。
  return -x * 0.19 + Math.sin(x / 180 + seed) * 14 + Math.sin(x / 72 + seed) * 3
}
function ellipse(ctx, x, y, rx, ry, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(rx, ry)
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2)
  ctx.fillStyle = color; ctx.fill(); ctx.restore()
}
function line(ctx, points, color, width = 1) {
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1])
  points.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]))
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke()
}
function polygon(ctx, points, fill, stroke) {
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1])
  points.slice(1).forEach((p) => ctx.lineTo(p[0], p[1])); ctx.closePath()
  ctx.fillStyle = fill; ctx.fill()
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.8; ctx.stroke() }
}

// 枝干的轮廓、半透明色块和散点叶片保留手绘的不规则边缘。
function paintTree(ctx, variant, dark) {
  const baseAlpha = ctx.globalAlpha == null ? 1 : ctx.globalAlpha
  const seed = variant * 29 + 3
  const ink = dark ? '#253a34' : '#4d5945'
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.beginPath(); ctx.moveTo(105, 432)
  ctx.bezierCurveTo(132, 339, 78, 244, 125, 107)
  ctx.bezierCurveTo(101, 250, 150, 345, 127, 432)
  ctx.closePath(); ctx.fillStyle = ink; ctx.fill()
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1
    const y = 133 + i * 17, endX = 119 + side * (52 + noise(seed + i) * 45)
    ctx.beginPath(); ctx.moveTo(120, y + 52)
    ctx.quadraticCurveTo(119 + side * 28, y + 30, endX, y - 30)
    ctx.lineWidth = 6 - i * 0.3; ctx.strokeStyle = ink; ctx.stroke()
    line(ctx, [[endX, y - 30], [endX + side * 11, y - 59]], ink, 1)
  }
  const colors = dark ? ['#294238', '#344c3a', '#3e513b', '#273c35'] : ['#82916a', '#748763', '#a3a77b', '#657b60']
  for (let i = 0; i < 155; i++) {
    const x = 25 + noise(seed + i * 4) * 190
    const y = 40 + noise(seed + i * 4 + 1) * 267
    if (Math.pow((x - 120) / 108, 2) + Math.pow((y - 170) / 150, 2) > 1) continue
    ctx.globalAlpha = baseAlpha * (0.15 + noise(seed + i * 4 + 2) * 0.36)
    ellipse(ctx, x, y, 9 + noise(i + seed) * 25, 7 + noise(i * 2 + seed) * 15, colors[i % colors.length])
    ctx.globalAlpha = baseAlpha * 0.7
    for (let j = 0; j < 3; j++) ellipse(ctx, x + j * 4 - 8, y + noise(i + j) * 20, 2.2, 1.4, colors[(i + j) % colors.length])
  }
  ctx.globalAlpha = baseAlpha
  line(ctx, [[116, 417], [124, 359], [112, 301], [113, 253]], dark ? '#75816a' : '#a6aa86', 1.4)
  for (let i = 0; i < 7; i++) line(ctx, [[115, 419], [85 + i * 12, 437 - noise(i) * 8]], ink, 2)
}

class TrailScene {
  constructor(canvas, mountain, options = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    if (!this.ctx) throw new Error('Canvas 2D 不可用')
    this.mountain = mountain
    this.seed = mountain.scene.seed
    this.camps = []
    this.wildlife = []
    this.disposed = false
    this.background = null
    this.treeCache = []
    this.onAsset = options.onAsset || (() => {})
    this.createSurface = options.createSurface
    this.resize(options.width || 390, options.height || 844, options.pixelRatio || 1)
    this.buildCache()
    this.loadBackground()
  }

  resize(width, height, pixelRatio) {
    this.width = Math.max(1, width); this.height = Math.max(1, height)
    this.dpr = clamp(pixelRatio || this.dpr || 1, 1, 2)
    this.canvas.width = Math.round(this.width * this.dpr)
    this.canvas.height = Math.round(this.height * this.dpr)
  }

  loadBackground() {
    const image = this.canvas.createImage()
    this.pendingImage = image
    image.onload = () => {
      if (this.disposed) return
      this.background = image; this.pendingImage = null
      this.onAsset(true)
    }
    image.onerror = () => {
      if (this.disposed) return
      this.pendingImage = null
      this.onAsset(false)
    }
    image.src = BACKGROUND
  }

  buildCache() {
    if (!this.createSurface) return
    for (let i = 0; i < 4; i++) {
      // 缓存失败只影响性能，不阻断绘制或学习。
      try {
        const surface = this.createSurface(300, 550)
        const ctx = surface.getContext('2d')
        ctx.scale(1.25, 1.25)
        paintTree(ctx, i % 2, i >= 2)
        this.treeCache[i] = surface
      } catch (_) { break }
    }
  }

  setCamps(camps) { this.camps = camps || [] }
  setWildlife(animals) { this.wildlife = animals || [] }

  getView(state) {
    const point = routePoint(state.progress, this.seed)
    const unit = Math.min(this.width / 390, this.height / 680)
    const scale = unit * clamp(state.zoom || 1, 0.8, 1.45) * (state.studyOpen ? 0.68 : 1)
    const anchor = this.height * (state.studyOpen ? 0.255 : 0.635)
    return { point, scale, cameraX: point.x - this.width * 0.36 / scale + (state.pan || 0), cameraY: point.y - anchor / scale, anchor }
  }

  render(state) {
    if (this.disposed) return
    const ctx = this.ctx, w = this.width, h = this.height
    const view = this.getView(state)
    const time = state.time || 0
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.globalAlpha = 1
    ctx.clearRect(0, 0, w, h)
    this.drawBackdrop(view, time)
    this.drawWoods(view, false)
    this.drawMist(time, state.studyOpen ? h * 0.22 : h * 0.53)
    ctx.save()
    ctx.scale(view.scale, view.scale); ctx.translate(-view.cameraX, -view.cameraY)
    this.drawGround(view)
    this.drawLandmarks(view, time)
    this.drawWildlife(view, time)
    this.drawTraveler(view.point, time, state.walking, state.walkTime || 0)
    ctx.restore()
    this.drawWoods(view, true)
    this.drawFireflies(view, time)
    // 温和暗角衬托纸面，顶部导航和底部操作区单独由 WXML 绘制。
    const shade = ctx.createLinearGradient(0, 0, 0, h)
    shade.addColorStop(0, 'rgba(33,49,40,.08)')
    shade.addColorStop(0.6, 'rgba(33,49,40,0)')
    shade.addColorStop(1, 'rgba(17,34,29,.6)')
    ctx.fillStyle = shade; ctx.fillRect(0, 0, w, h)
    this.lastView = view
  }

  drawBackdrop(view, time) {
    const c = this.ctx, w = this.width, h = this.height
    const sky = c.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#e5e3ce'); sky.addColorStop(0.6, '#bfcfc2'); sky.addColorStop(1, '#778c70')
    c.fillStyle = sky; c.fillRect(0, 0, w, h)
    if (this.background) {
      const image = this.background
      const size = Math.max(w / image.width, h / image.height)
      const dw = image.width * size, dh = image.height * size
      const t = clamp((view.point.x - ROUTE_START) / ROUTE_LENGTH, 0, 1)
      const left = -(dw - w) * (0.24 + t * 0.48) - (view.cameraX - view.point.x) * 0.025
      c.drawImage(image, clamp(left, w - dw, 0), (h - dh) / 2, dw, dh)
    }
    const washes = ['#e8d6a5', '#b8d3c7', '#d8e2cb', '#d9b96e', '#b5bca6', '#777eac', '#cd9b72']
    c.globalAlpha = this.mountain.id % 7 > 4 ? 0.28 : 0.09
    c.fillStyle = washes[this.mountain.id % 7]; c.fillRect(0, 0, w, h); c.globalAlpha = 1
    // 远处的山脊独立于画作横移，进一步拉开景深。
    for (let layer = 0; layer < 2; layer++) {
      c.beginPath(); c.moveTo(0, h)
      for (let x = -20; x <= w + 20; x += 12) {
        const u = x + view.cameraX * (0.06 + layer * 0.045)
        const y = h * (0.52 + layer * 0.09) + Math.sin(u / 140 + layer * 3) * 25 + Math.sin(u / 59) * 9
        c.lineTo(x, y)
      }
      c.lineTo(w, h); c.closePath(); c.fillStyle = layer ? 'rgba(77,111,91,.10)' : 'rgba(114,145,129,.12)'; c.fill()
    }
  }

  drawMist(time, baseline) {
    const c = this.ctx, w = this.width
    for (let i = 0; i < 3; i++) {
      const y = baseline + i * 25
      const fog = c.createLinearGradient(0, y - 25, 0, y + 45)
      fog.addColorStop(0, 'rgba(236,239,214,0)'); fog.addColorStop(0.5, 'rgba(236,239,214,.15)'); fog.addColorStop(1, 'rgba(236,239,214,0)')
      c.fillStyle = fog; c.fillRect(Math.sin(time * 0.1 + i) * 20 - 30, y - 25, w + 60, 70)
    }
  }

  drawWoods(view, foreground) {
    const c = this.ctx, { scale, cameraX, cameraY } = view
    const factor = foreground ? 1.17 : 0.65
    const spacing = foreground ? 390 : 220
    const cam = cameraX * factor
    const first = Math.floor((cam - 300) / spacing), last = Math.ceil((cam + this.width / scale + 300) / spacing)
    c.save(); c.scale(scale, scale)
    for (let i = first; i <= last; i++) {
      const n = noise(i + this.seed)
      const x = i * spacing + n * 110
      const sx = x - cam
      // 前景只在屏幕两侧及下沿露出，不遮挡人物与答题结果。
      const charScreen = (view.point.x - cameraX)
      if (foreground && Math.abs(sx - charScreen) < 120) continue
      const size = foreground ? 0.95 + n * 0.35 : 0.48 + n * 0.38
      const base = foreground ? this.height / scale + 135 : groundY(cameraX + sx, this.seed) - cameraY - 18
      const index = (i % 2 + 2) % 2 + (foreground ? 2 : 0)
      c.globalAlpha = foreground ? 0.88 : 0.44
      if (this.treeCache[index]) c.drawImage(this.treeCache[index], sx - 120 * size, base - 440 * size, 240 * size, 440 * size)
      else { c.save(); c.translate(sx - 120 * size, base - 440 * size); c.scale(size, size); paintTree(c, index % 2, foreground); c.restore() }
    }
    c.restore()
  }

  drawGround(view) {
    const c = this.ctx, { cameraX: left, cameraY: top, scale } = view
    const right = left + this.width / scale, bottom = top + this.height / scale
    const points = []
    for (let x = Math.floor(left / 12) * 12 - 24; x < right + 24; x += 12) points.push([x, groundY(x, this.seed)])
    const earth = c.createLinearGradient(0, view.point.y, 0, view.point.y + 300)
    earth.addColorStop(0, '#8b9170'); earth.addColorStop(0.2, '#65715a'); earth.addColorStop(1, '#263d33')
    polygon(c, [...points, [right + 24, bottom + 100], [left - 24, bottom + 100]], earth)
    // 在地表蒙上原画的岩石/纸纹，避免与水彩背景形成生硬的纯色分界。
    if (this.background) {
      c.save(); c.clip(); c.globalAlpha = 0.19
      const image = this.background
      c.drawImage(image, 0, image.height * 0.6, image.width, image.height * 0.4,
        left, view.point.y - 100, right - left, bottom - view.point.y + 200)
      c.restore()
    }
    // 宽窄不齐的石板路、苔藓边缘和岩层细线。
    line(c, points.map(([x, y]) => [x, y + 13]), '#d2c7a1', 27)
    line(c, points.map(([x, y]) => [x, y + 27]), '#45533e', 2)
    line(c, points, '#9ca77b', 3)
    for (let i = Math.floor(left / 24) - 1; i <= Math.ceil(right / 24); i++) {
      const x = i * 24, y = groundY(x, this.seed), n = noise(i + this.seed)
      const skew = n * 12 - 6
      line(c, [[x + skew, y + 3], [x + 3, y + 11], [x - skew, y + 23]], 'rgba(74,78,54,.29)', 0.65)
      line(c, [[x + 3, y + 11], [x + 20 + skew, groundY(x + 23, this.seed) + 15]], 'rgba(74,78,54,.19)', 0.7)
      ellipse(c, x + 12, y + 8, 8 + n * 6, 2, 'rgba(244,235,202,.2)')
      for (let j = 0; j < 3; j++) {
        const yy = y + 50 + j * 42 + n * 19
        line(c, [[x - 8, yy], [x + 12, yy - 3], [x + 29, yy + 7]], 'rgba(34,48,34,.15)', 1)
        ellipse(c, x + j * 5, yy + 15, 9 + n * 12, 2 + n * 5, 'rgba(150,157,105,.14)')
      }
      if (n > 0.55) this.drawGrass(x, y - 2, n, false)
      if (n < 0.48) this.drawGrass(x + 10, y + 42 + n * 12, n, true)
    }
  }

  drawGrass(x, y, n, front) {
    const c = this.ctx, color = front ? '#475a3c' : '#73825a'
    for (let j = -2; j <= 2; j++) {
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + j * 3, y - 10, x + j * 5, y - 12 - n * 17)
      c.strokeStyle = color; c.lineWidth = 1.2; c.stroke()
    }
    if (n > 0.72) {
      line(c, [[x + 5, y], [x + 8, y - 25]], color, 1)
      ellipse(c, x + 8, y - 25, 2.3, 1.8, '#e6d9a6')
    }
  }

  drawLandmarks(view, time) {
    const c = this.ctx
    const visible = (x) => x > view.cameraX - 150 && x < view.cameraX + this.width / view.scale + 150
    CAMP_STOPS.forEach((t, i) => {
      const p = routePoint(t, this.seed)
      if (!visible(p.x)) return
      const camp = this.camps[i] || {}, color = camp.lit ? '#e4bf72' : (camp.due ? '#9bbdb6' : '#9b9c7c')
      c.save(); c.translate(p.x, p.y)
      polygon(c, [[-37, -5], [0, -54], [35, -5]], '#6e7960', '#45523f')
      polygon(c, [[-29, -6], [0, -49], [18, -6]], '#b3ac7e', '#576149')
      polygon(c, [[-9, -6], [1, -35], [14, -6]], '#344a3d')
      line(c, [[39, -1], [39, -66], [53, -66]], '#4c5844', 2.8)
      if (camp.lit || camp.due) this.glow(51, -56, camp.lit ? 32 : 17, camp.lit ? 'rgba(255,219,133,.5)' : 'rgba(153,222,214,.25)')
      polygon(c, [[47, -60], [55, -60], [57, -50], [45, -50]], color, '#576149')
      c.font = '11px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#eee6c9'; c.fillText(String(i + 1), 1, -60)
      c.restore()
    })
    const summit = routePoint(1, this.seed)
    if (visible(summit.x)) {
      c.save(); c.translate(summit.x + 48, summit.y - 7)
      this.glow(0, -53, 75, 'rgba(255,232,156,.35)')
      polygon(c, [[-30, 0], [-24, -58], [-12, -84], [14, -84], [28, -58], [32, 0]], '#aaa98a', '#62715b')
      polygon(c, [[-14, 0], [-14, -52], [-7, -66], [7, -66], [16, -52], [17, 0]], '#ece7bc', '#62715b')
      c.fillStyle = '#4c5b43'; c.font = '10px sans-serif'; c.textAlign = 'center'; c.fillText('山 顶', 0, -91)
      c.restore()
    }
  }

  drawWildlife(view, time) {
    const c = this.ctx
    this.wildlife.forEach((animal) => {
      const point = routePoint(animal.at, this.seed)
      if (point.x < view.cameraX - 80 || point.x > view.cameraX + this.width / view.scale + 80) return
      c.save(); c.translate(point.x + 25, point.y - 8)
      const bob = Math.sin(time * 3 + animal.at * 10) * 3
      if (animal.id === 'butterfly') {
        c.translate(0, -35 + bob); const wing = 8 + Math.sin(time * 7) * 4
        ellipse(c, -wing / 2, -4, wing, 9, '#ae9b6c'); ellipse(c, wing / 2, -4, wing, 9, '#d0bc85')
        ellipse(c, -4, 5, 5, 5, '#b98962'); ellipse(c, 4, 5, 5, 5, '#c9a270'); line(c, [[0,-10],[0,10]], '#47503b', 2)
      } else if (animal.id === 'snail') {
        ellipse(c, 0, -1, 15, 4, '#9d9d77'); ellipse(c, -4, -9, 9, 10, '#a6926c')
        c.beginPath(); c.arc(-4, -9, 5, 0, Math.PI * 1.7); c.strokeStyle='#6b694b';c.lineWidth=1.3;c.stroke()
        line(c, [[10,-2],[12,-12]], '#6c7559', 1.4);line(c, [[7,-2],[7,-12]], '#6c7559', 1.4)
      } else if (animal.id === 'squirrel') {
        c.save();c.rotate(-.4);ellipse(c,-16,-20,9,18,'#9d7251');ellipse(c,-18,-24,5,12,'#bc9366');c.restore()
        ellipse(c,0,-12,10,13,'#ab825d');ellipse(c,4,-22,8,7,'#b28a62');polygon(c,[[0,-26],[0,-35],[6,-28]],'#98704c')
        ellipse(c,9,-24,1,1,'#354737');line(c,[[-6,0],[7,0]],'#755a41',3)
      } else if (animal.id === 'bird') {
        ellipse(c,0,-15+bob,12,8,'#677e75');ellipse(c,8,-22+bob,7,6,'#929c79');ellipse(c,-3,-15+bob,8,5,'#435f58')
        polygon(c,[[14,-24+bob],[21,-21+bob],[14,-20+bob]],'#b6995a');ellipse(c,11,-24+bob,1,1,'#344735')
        line(c,[[-3,-7+bob],[-3,0],[1,0]],'#6f6649',1.5)
      } else if (animal.id === 'ladybird') {
        ellipse(c,0,-6,8,7,'#ab5f44');ellipse(c,7,-7,4,4,'#45513e');line(c,[[-6,-7],[5,-7]],'#663e32',1)
        for(let i=0;i<4;i++)ellipse(c,-3+(i%2)*5,-9+Math.floor(i/2)*6,1.3,1.3,'#424b38')
      } else {
        c.translate(0,-35+bob);this.glow(0,0,24,'rgba(230,239,162,.5)');ellipse(c,0,0,3,5,'#e1dc8b');ellipse(c,-4,-4,4,2,'#a5b69a');ellipse(c,4,-4,4,2,'#a5b69a')
      }
      c.restore()
    })
  }

  glow(x, y, radius, color) {
    const c = this.ctx, gradient = c.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, color); gradient.addColorStop(1, 'rgba(255,240,180,0)')
    c.fillStyle = gradient; c.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }

  drawTraveler(point, time, walking, walkTime) {
    const c = this.ctx, phase = walkTime * 10
    const stride = walking ? Math.sin(phase) * 9 : 0
    const bob = walking ? Math.abs(Math.sin(phase)) * 2 : Math.sin(time * 1.8) * 0.7
    c.save(); c.translate(point.x, point.y)
    ellipse(c, 0, 2, 17, 3.2, 'rgba(30,45,34,.27)')
    // 脚掌始终落在对应横坐标的山道高度上。
    const foot = (dx, lift) => [dx, groundY(point.x + dx, this.seed) - point.y - lift]
    const front = foot(stride, walking ? Math.max(0, Math.cos(phase)) * 4 : 0)
    const back = foot(-stride, walking ? Math.max(0, -Math.cos(phase)) * 4 : 0)
    line(c, [[-4, -25 - bob], [-5 - stride * 0.35, -12 - bob], back], '#485044', 4)
    line(c, [[3, -25 - bob], [4 + stride * 0.4, -12 - bob], front], '#5b5945', 4)
    line(c, [back, [back[0] + 5, back[1]]], '#303e35', 3)
    line(c, [front, [front[0] + 5, front[1]]], '#303e35', 3)
    c.translate(0, -bob)
    // 原创赭红斗篷旅人，围巾与斗篷轻摆。
    const flutter = Math.sin(time * 3.4 + phase * 0.3) * 3
    c.beginPath(); c.moveTo(-4, -52); c.quadraticCurveTo(-14, -42, -24 - flutter, -24)
    c.quadraticCurveTo(-9, -18, 13, -26); c.quadraticCurveTo(8, -44, 3, -51)
    c.closePath(); c.fillStyle = '#a44e3b'; c.fill(); c.strokeStyle = '#663c30'; c.lineWidth = 1; c.stroke()
    polygon(c, [[-5, -48], [-12, -28], [-2, -24], [3, -46]], '#bc6a46')
    line(c, [[-4, -43], [-11, -27]], 'rgba(235,162,94,.5)', 1)
    ellipse(c, 2, -57, 8, 9, '#d9c29a')
    // 软帽和小背包，避免与参考游戏角色混淆。
    c.beginPath(); c.moveTo(-8, -55); c.quadraticCurveTo(-10, -73, 5, -69); c.quadraticCurveTo(11, -66, 11, -59)
    c.closePath(); c.fillStyle = '#985040'; c.fill(); c.strokeStyle = '#6e4333'; c.stroke()
    line(c, [[-9, -57], [12, -59]], '#b87553', 3)
    ellipse(c, 7, -56, 1, 1, '#394537')
    polygon(c, [[-13, -46], [-21, -44], [-22, -31], [-13, -29]], '#87734d', '#635a3c')
    line(c, [[7, -46], [12, -37], [20, -40]], '#d0ad7a', 3)
    line(c, [[22, -47], [19, -2]], '#6d6649', 2)
    c.restore()
    // 柔和的萤火光伴随旅人，形成水彩画里的亮色焦点。
    const lx = point.x + 34 + Math.sin(time * 1.4) * 5, ly = point.y - 47 + Math.cos(time * 1.8) * 7
    this.glow(lx, ly, 21, 'rgba(204,244,206,.6)')
    ellipse(c, lx, ly, 2.4, 3.1, '#f0f5c3')
  }

  drawFireflies(view, time) {
    const c = this.ctx
    for (let i = 0; i < 13; i++) {
      const x = ((noise(i + this.seed) * this.width * 2 - view.cameraX * 0.15 + Math.sin(time * 0.2 + i) * 12) % this.width + this.width) % this.width
      const y = this.height * (0.18 + noise(i * 3 + this.seed) * 0.55)
      c.globalAlpha = 0.18 + (Math.sin(time * 1.2 + i) + 1) * 0.2
      ellipse(c, x, y, 1.2, 1.2, '#ffedb4')
    }
    c.globalAlpha = 1
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    if (this.pendingImage) { this.pendingImage.onload = null; this.pendingImage.onerror = null }
    if (this.background) { this.background.onload = null; this.background.onerror = null }
    this.treeCache.forEach((surface) => { surface.width = 1; surface.height = 1 })
    this.treeCache = []; this.background = null; this.pendingImage = null
    this.onAsset = () => {}; this.ctx = null; this.canvas = null
  }
}

module.exports = { TrailScene, routePoint, groundY, clamp, BACKGROUND, CAMP_STOPS }
