const lib = require('./miniprogram/libs/threejs-miniprogram.js')
function mockCanvas() {
  return { width: 300, height: 400, createImage: () => ({}) }
}
const THREE = lib.createScopedThreejs(mockCanvas())

const checks = {
  PlaneBufferGeometry: [10, 10, 2, 2],
  CylinderBufferGeometry: [0.3, 0.5, 2, 6],
  ConeBufferGeometry: [1.5, 3, 7],
  SphereBufferGeometry: [1, 8, 6],
  DodecahedronBufferGeometry: [1, 0],
  TorusBufferGeometry: [3, 0.2, 8, 24]
}
let ok = true
Object.keys(checks).forEach((name) => {
  const g = new THREE[name](...checks[name])
  const has = g.attributes && g.attributes.position
  console.log((has ? 'OK  ' : 'FAIL') + ' ' + name + (has ? ' pos count=' + g.attributes.position.count : ''))
  if (!has) ok = false
})

// TubeBufferGeometry 需要 curve
const curve = new THREE.CatmullRomCurve3(
  [new THREE.Vector3(0,0,0), new THREE.Vector3(1,1,1), new THREE.Vector3(2,2,0)],
  false
)
const tube = new THREE.TubeBufferGeometry(curve, 30, 1, 6, false)
if (!tube.attributes || !tube.attributes.position) ok = false
console.log((tube.attributes ? 'OK  ' : 'FAIL') + ' TubeBufferGeometry pos count=' +
  (tube.attributes && tube.attributes.position.count))

console.log(ok ? 'ALL GEOMETRIES OK' : 'SOME FAILED')
process.exitCode = ok ? 0 : 1
