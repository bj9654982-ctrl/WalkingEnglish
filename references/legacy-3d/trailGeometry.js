// 与 PlaneBufferGeometry 的两个三角形使用相同插值，贴合实际渲染的地表。
function createTerrainSampler(geometry, size, segments) {
  const positions = geometry.attributes.position
  const row = segments + 1
  return function heightAt(x, z) {
    const gx = Math.max(0, Math.min(segments, (x / size + 0.5) * segments))
    const gz = Math.max(0, Math.min(segments, (z / size + 0.5) * segments))
    const ix = Math.min(segments - 1, Math.floor(gx))
    const iz = Math.min(segments - 1, Math.floor(gz))
    const u = gx - ix, v = gz - iz
    const a = positions.getY(iz * row + ix)
    const b = positions.getY((iz + 1) * row + ix)
    const c = positions.getY((iz + 1) * row + ix + 1)
    const d = positions.getY(iz * row + ix + 1)
    return u + v <= 1 ? a + (d - a) * u + (b - a) * v : c + (b - c) * (1 - u) + (d - c) * (1 - v)
  }
}

function createTrail(THREE, controlPoints, heightAt) {
  const horizontal = new THREE.CatmullRomCurve3(controlPoints, false, 'catmullrom', 0.5)
  const clearance = 0.3
  const curve = new THREE.Curve()
  curve.arcLengthDivisions = 1200
  curve.getPoint = (t, target = new THREE.Vector3()) => {
    horizontal.getPoint(t, target)
    target.y = heightAt(target.x, target.z) + clearance
    return target
  }

  // 窄网格步道逐顶点贴地，不再用会埋入山体的圆管。
  const lengthSegments = 600
  const widthSegments = 8
  const positions = []
  const indices = []
  for (let i = 0; i <= lengthSegments; i++) {
    const t = i / lengthSegments
    const center = curve.getPointAt(t)
    const tangent = curve.getTangentAt(t)
    const length = Math.sqrt(tangent.x * tangent.x + tangent.z * tangent.z) || 1
    for (let j = 0; j <= widthSegments; j++) {
      const offset = (j / widthSegments - 0.5) * 2.3
      const x = center.x - tangent.z / length * offset
      const z = center.z + tangent.x / length * offset
      positions.push(x, heightAt(x, z) + clearance, z)
      if (i < lengthSegments && j < widthSegments) {
        const a = i * (widthSegments + 1) + j
        const b = a + widthSegments + 1
        indices.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.addAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return { curve, geometry }
}

module.exports = { createTerrainSampler, createTrail }
