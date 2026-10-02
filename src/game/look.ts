import * as THREE from 'three'

function makeCanvas(size: number) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is unavailable')
  return { canvas, ctx }
}

function rand(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function fillNoise(
  ctx: CanvasRenderingContext2D,
  size: number,
  rng: () => number,
  tint: [number, number, number],
  amp: number,
) {
  const img = ctx.getImageData(0, 0, size, size)
  const data = img.data
  for (let i = 0; i < data.length; i += 4) {
    const n = (rng() - 0.5) * amp
    data[i] = tint[0] + n
    data[i + 1] = tint[1] + n * 0.92
    data[i + 2] = tint[2] + n * 0.75
    data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}

function cracks(ctx: CanvasRenderingContext2D, rng: () => number, count: number, color: string) {
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  for (let n = 0; n < count; n++) {
    let x = rng() * 512
    let y = rng() * 512
    ctx.beginPath()
    ctx.moveTo(x, y)
    const steps = 4 + Math.floor(rng() * 7)
    for (let i = 0; i < steps; i++) {
      x += (rng() - 0.5) * 46
      y += (rng() - 0.35) * 38
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}

function stains(ctx: CanvasRenderingContext2D, rng: () => number, count: number, color: string) {
  for (let n = 0; n < count; n++) {
    const x = rng() * 512
    const y = rng() * 512
    const r = 18 + rng() * 70
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r)
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * (0.45 + rng() * 0.8), rng() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
}

function wallTexture() {
  const { canvas, ctx } = makeCanvas(512)
  const rng = rand(0x51a7)
  fillNoise(ctx, 512, rng, [112, 104, 94], 36)
  ctx.globalAlpha = 0.55
  for (let y = 0; y < 512; y += 86) {
    ctx.fillStyle = y % 172 === 0 ? 'rgba(28,22,18,0.45)' : 'rgba(20,16,14,0.28)'
    ctx.fillRect(0, y, 512, 3)
    const offset = (y / 86) % 2 === 0 ? 0 : 70
    for (let x = offset; x < 512; x += 168) {
      ctx.fillStyle = 'rgba(22,18,16,0.33)'
      ctx.fillRect(x, y, 3, 86)
    }
  }
  ctx.globalAlpha = 1
  stains(ctx, rng, 18, 'rgba(24,16,12,0.28)')
  stains(ctx, rng, 6, 'rgba(120,52,24,0.16)')
  cracks(ctx, rng, 9, 'rgba(28,22,18,0.65)')
  ctx.fillStyle = 'rgba(12,9,8,0.35)'
  ctx.fillRect(0, 470, 512, 42)
  return canvas
}

function floorTexture() {
  const { canvas, ctx } = makeCanvas(512)
  const rng = rand(0x0a11)
  fillNoise(ctx, 512, rng, [96, 90, 82], 28)
  ctx.globalAlpha = 0.7
  for (let y = 0; y < 512; y += 128) {
    ctx.fillStyle = 'rgba(18,14,12,0.55)'
    ctx.fillRect(0, y, 512, 4)
    for (let x = (y / 128) % 2 ? 40 : 0; x < 512; x += 160) {
      ctx.fillRect(x, y, 4, 128)
    }
  }
  ctx.globalAlpha = 1
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(40,34,28,${0.15 + rng() * 0.35})`
    ctx.lineWidth = 1
    ctx.beginPath()
    const x = rng() * 512
    const y = rng() * 512
    ctx.moveTo(x, y)
    ctx.lineTo(x + (rng() - 0.5) * 80, y + (rng() - 0.5) * 14)
    ctx.stroke()
  }
  stains(ctx, rng, 10, 'rgba(20,16,14,0.34)')
  stains(ctx, rng, 5, 'rgba(90,40,16,0.18)')
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(255,140,60,${0.05 + rng() * 0.12})`
    ctx.fillRect(rng() * 512, rng() * 512, 2, 2)
  }
  return canvas
}

function ceilTexture() {
  const { canvas, ctx } = makeCanvas(512)
  const rng = rand(0xc001)
  fillNoise(ctx, 512, rng, [62, 56, 50], 22)
  stains(ctx, rng, 14, 'rgba(8,6,5,0.45)')
  ctx.strokeStyle = 'rgba(20,16,14,0.65)'
  ctx.lineWidth = 6
  for (let x = 40; x < 512; x += 128) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, 512)
    ctx.stroke()
  }
  return canvas
}

function woodTexture() {
  const { canvas, ctx } = makeCanvas(512)
  const rng = rand(0xb0a4)
  fillNoise(ctx, 512, rng, [112, 74, 42], 30)
  ctx.globalAlpha = 0.35
  for (let y = 0; y < 512; y += 36) {
    ctx.fillStyle = y % 72 === 0 ? 'rgba(40,22,10,0.65)' : 'rgba(70,40,18,0.35)'
    ctx.fillRect(0, y, 512, 2 + (y % 3))
    for (let x = 0; x < 512; x += 4) {
      const g = 80 + rng() * 50
      ctx.fillStyle = `rgba(${g},${g * 0.62},${g * 0.3},0.18)`
      ctx.fillRect(x, y, 1, 34)
    }
  }
  ctx.globalAlpha = 1
  return canvas
}

function metalTexture() {
  const { canvas, ctx } = makeCanvas(256)
  const rng = rand(0x5e1)
  fillNoise(ctx, 256, rng, [58, 56, 54], 22)
  ctx.globalAlpha = 0.45
  for (let y = 0; y < 256; y += 3) {
    ctx.fillStyle = `rgba(180,180,180,${rng() * 0.08})`
    ctx.fillRect(0, y, 256, 1)
  }
  ctx.globalAlpha = 1
  cracks(ctx, rng, 5, 'rgba(20,16,12,0.7)')
  stains(ctx, rng, 6, 'rgba(90,42,24,0.35)')
  return canvas
}

function bumpFrom(source: HTMLCanvasElement, contrast = 1) {
  const { canvas, ctx } = makeCanvas(source.width)
  ctx.drawImage(source, 0, 0)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = img.data
  for (let i = 0; i < data.length; i += 4) {
    const l = (data[i] * 0.3 + data[i + 1] * 0.5 + data[i + 2] * 0.2) * contrast
    const v = Math.max(0, Math.min(255, 40 + l))
    data[i] = data[i + 1] = data[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

function toMap(canvas: HTMLCanvasElement, color: boolean) {
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  return tex
}

export function softDisc(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(64)
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function scorchTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(128)
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 60)
  g.addColorStop(0, 'rgba(12,8,6,0.95)')
  g.addColorStop(0.45, 'rgba(40,24,16,0.7)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = 'rgba(20,12,8,0.8)'
  ctx.beginPath()
  ctx.arc(64, 64, 24, 0, Math.PI * 2)
  ctx.stroke()
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export type BunkerMaterials = {
  floor: THREE.MeshStandardMaterial
  ceil: THREE.MeshStandardMaterial
  wall: THREE.MeshStandardMaterial
  trim: THREE.MeshStandardMaterial
  wood: THREE.MeshStandardMaterial
  stone: THREE.MeshStandardMaterial
  metal: THREE.MeshStandardMaterial
  rust: THREE.MeshStandardMaterial
  ember: THREE.MeshStandardMaterial
  disc: THREE.CanvasTexture
}

export function createMaterials(): BunkerMaterials {
  const wallMap = toMap(wallTexture(), true)
  const wallBump = toMap(bumpFrom(wallTexture(), 1.15), false)
  const floorMap = toMap(floorTexture(), true)
  const floorBump = toMap(bumpFrom(floorTexture(), 1.3), false)
  const ceilMap = toMap(ceilTexture(), true)
  const woodMap = toMap(woodTexture(), true)
  const metalMap = toMap(metalTexture(), true)
  const metalBump = toMap(bumpFrom(metalTexture(), 1.4), false)

  const floor = new THREE.MeshStandardMaterial({
    color: 0xc8bfb2,
    map: floorMap,
    bumpMap: floorBump,
    bumpScale: 0.045,
    roughness: 0.92,
    metalness: 0.04,
  })
  const ceil = new THREE.MeshStandardMaterial({
    color: 0x8a8178,
    map: ceilMap,
    roughness: 0.96,
    metalness: 0.02,
  })
  const wall = new THREE.MeshStandardMaterial({
    color: 0xd2c6b6,
    map: wallMap,
    bumpMap: wallBump,
    bumpScale: 0.055,
    roughness: 0.86,
    metalness: 0.06,
  })
  const trim = new THREE.MeshStandardMaterial({
    color: 0x3a342e,
    map: wallMap,
    roughness: 0.8,
    metalness: 0.12,
  })
  const wood = new THREE.MeshStandardMaterial({
    color: 0xc09060,
    map: woodMap,
    roughness: 0.78,
    metalness: 0.02,
  })
  const stone = new THREE.MeshStandardMaterial({
    color: 0xb7aea2,
    map: wallMap,
    bumpMap: wallBump,
    bumpScale: 0.06,
    roughness: 0.9,
    metalness: 0.05,
  })
  const metal = new THREE.MeshStandardMaterial({
    color: 0x9aa0a6,
    map: metalMap,
    bumpMap: metalBump,
    bumpScale: 0.03,
    roughness: 0.42,
    metalness: 0.72,
  })
  const rust = new THREE.MeshStandardMaterial({
    color: 0xb85a32,
    map: metalMap,
    roughness: 0.62,
    metalness: 0.38,
  })
  const ember = new THREE.MeshStandardMaterial({
    color: 0xff7a3a,
    emissive: 0xff4a12,
    emissiveIntensity: 2.4,
    roughness: 0.45,
  })
  return { floor, ceil, wall, trim, wood, stone, metal, rust, ember, disc: softDisc() }
}

/** BoxGeometry UVs are 0–1 per face. Scale them into meters so textures tile. */
export function tileBox(w: number, h: number, d: number, tile = 2.15): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(w, h, d)
  const uv = geo.attributes.uv as THREE.BufferAttribute
  const scales: [number, number][] = [
    [d / tile, h / tile],
    [d / tile, h / tile],
    [w / tile, d / tile],
    [w / tile, d / tile],
    [w / tile, h / tile],
    [w / tile, h / tile],
  ]
  for (let face = 0; face < 6; face++) {
    const [su, sv] = scales[face]
    for (let i = 0; i < 4; i++) {
      const idx = face * 4 + i
      uv.setXY(idx, uv.getX(idx) * su, uv.getY(idx) * sv)
    }
  }
  uv.needsUpdate = true
  return geo
}

export function tilePlane(w: number, d: number, tile = 2.15): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(w, d)
  const uv = geo.attributes.uv as THREE.BufferAttribute
  const ox = (w * 0.17) % 1
  const oy = (d * 0.13) % 1
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * (w / tile) + ox, uv.getY(i) * (d / tile) + oy)
  }
  uv.needsUpdate = true
  return geo
}
