import * as THREE from 'three'
import type { DoorId } from './types'
import { scorchTexture, softDisc } from './look'
import { DOORS, FLOORS, SOLIDS } from './world'

export type Impact = {
  x: number
  y: number
  z: number
  nx: number
  ny: number
  nz: number
  t: number
}

type Spec = {
  life: number
  max: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  r: number
  g: number
  b: number
}

function rayBox(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): { t: number; nx: number; ny: number; nz: number } | null {
  let tNear = -1e9
  let tFar = 1e9
  let nx = 0
  let ny = 0
  let nz = 0
  const axes: [number, number, number, number, 0 | 1 | 2][] = [
    [ox, dx, minX, maxX, 0],
    [oy, dy, minY, maxY, 1],
    [oz, dz, minZ, maxZ, 2],
  ]
  for (const [o, d, mn, mx, axis] of axes) {
    if (Math.abs(d) < 1e-8) {
      if (o < mn || o > mx) return null
      continue
    }
    let t1 = (mn - o) / d
    let t2 = (mx - o) / d
    let nEnter = -1
    if (t1 > t2) {
      const swap = t1
      t1 = t2
      t2 = swap
      nEnter = 1
    }
    if (t1 > tNear) {
      tNear = t1
      nx = axis === 0 ? nEnter : 0
      ny = axis === 1 ? nEnter : 0
      nz = axis === 2 ? nEnter : 0
    }
    if (t2 < tFar) tFar = t2
    if (tNear > tFar) return null
  }
  if (tNear < 0.08) return null
  return { t: tNear, nx, ny, nz }
}

export function bunkerImpact(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  open: Record<DoorId, boolean>,
): Impact | null {
  let best: Impact | null = null
  const consider = (hit: { t: number; nx: number; ny: number; nz: number } | null) => {
    if (!hit || hit.t > maxDist) return
    if (best && hit.t >= best.t) return
    best = {
      t: hit.t,
      nx: hit.nx,
      ny: hit.ny,
      nz: hit.nz,
      x: ox + dx * hit.t,
      y: oy + dy * hit.t,
      z: oz + dz * hit.t,
    }
  }
  for (const s of SOLIDS) {
    if (s.kind === 'blocker') continue
    consider(rayBox(ox, oy, oz, dx, dy, dz, s.minX, s.y0, s.minZ, s.maxX, s.y1, s.maxZ))
  }
  for (const door of DOORS) {
    if (open[door.id]) continue
    consider(rayBox(ox, oy, oz, dx, dy, dz, door.minX, 0, door.minZ, door.maxX, 2.6, door.maxZ))
  }
  for (const f of FLOORS) {
    consider(rayBox(ox, oy, oz, dx, dy, dz, f.minX, -0.2, f.minZ, f.maxX, 0.02, f.maxZ))
    consider(rayBox(ox, oy, oz, dx, dy, dz, f.minX, 3.16, f.minZ, f.maxX, 3.45, f.maxZ))
  }
  return best
}

const POOL = 180
const FLASH_LIFE = 0.14
const BRASS_POOL = 18

function muzzleTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is unavailable')
  const cx = size / 2
  const cy = size / 2
  for (let i = 0; i < 10; i++) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((i / 10) * Math.PI)
    const streak = ctx.createLinearGradient(0, 0, 60, 0)
    streak.addColorStop(0, 'rgba(255,255,255,0.95)')
    streak.addColorStop(0.3, 'rgba(255,196,110,0.65)')
    streak.addColorStop(1, 'rgba(255,90,20,0)')
    ctx.fillStyle = streak
    const h = i % 2 === 0 ? 5 : 2.4
    ctx.fillRect(0, -h / 2, 60, h)
    ctx.restore()
  }
  const core = ctx.createRadialGradient(cx, cy, 1, cx, cy, 30)
  core.addColorStop(0, 'rgba(255,255,255,1)')
  core.addColorStop(0.35, 'rgba(255,214,140,0.9)')
  core.addColorStop(1, 'rgba(255,110,30,0)')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(cx, cy, 30, 0, Math.PI * 2)
  ctx.fill()
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function brassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is unavailable')
  ctx.fillStyle = '#ffd56a'
  ctx.fillRect(0, 0, 32, 64)
  ctx.fillStyle = '#6a3e14'
  ctx.fillRect(0, 0, 32, 9)
  ctx.fillRect(0, 55, 32, 9)
  ctx.fillStyle = '#fff6d2'
  ctx.fillRect(8, 12, 7, 40)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

type Brass = {
  mesh: THREE.Mesh
  life: number
  max: number
  vx: number
  vy: number
  vz: number
  sx: number
  sy: number
  sz: number
}

export class Juice {
  readonly flash: THREE.Mesh
  private readonly flashMats: THREE.MeshBasicMaterial[] = []
  private readonly flashLife = { t: 0 }
  private flashRoll = 0
  private readonly sparks: Spec[] = []
  private readonly pos: Float32Array
  private readonly col: Float32Array
  private readonly points: THREE.Points
  private readonly decals: { mesh: THREE.Mesh; life: number; max: number }[] = []
  private readonly tracers: { mesh: THREE.Mesh; life: number; max: number }[] = []
  private readonly up = new THREE.Vector3(0, 0, 1)
  private readonly tmp = new THREE.Vector3()
  private readonly tmp2 = new THREE.Vector3()
  private readonly brass: Brass[] = []

  constructor(scene: THREE.Scene) {
    const flashMat = new THREE.MeshBasicMaterial({
      map: muzzleTexture(),
      color: 0xfff6df,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    })
    this.flashMats.push(flashMat)
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), flashMat)
    this.flash.visible = false
    this.flash.frustumCulled = false
    this.flash.renderOrder = 4
    scene.add(this.flash)
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    })
    const streakMat = new THREE.MeshBasicMaterial({
      color: 0xffd7a4,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    })
    this.flashMats.push(coreMat, streakMat)
    const core = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), coreMat)
    const streak = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.06), streakMat)
    this.flash.add(core, streak)

    const brassGeo = new THREE.CylinderGeometry(0.024, 0.02, 0.078, 8)
    const brassMap = brassTexture()
    for (let i = 0; i < BRASS_POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: brassMap,
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(brassGeo, mat)
      mesh.visible = false
      mesh.frustumCulled = false
      scene.add(mesh)
      this.brass.push({
        mesh,
        life: 0,
        max: 1,
        vx: 0,
        vy: 0,
        vz: 0,
        sx: 0,
        sy: 0,
        sz: 0,
      })
    }

    this.pos = new Float32Array(POOL * 3)
    this.col = new Float32Array(POOL * 3)
    for (let i = 0; i < POOL; i++) {
      this.pos[i * 3 + 1] = -40
      this.sparks.push({ life: 0, max: 1, x: 0, y: -40, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1 })
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3))
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.085,
        map: softDisc(),
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    )
    scene.add(this.points)

    const decalMat = new THREE.MeshBasicMaterial({
      map: scorchTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    })
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), decalMat.clone())
      mesh.visible = false
      mesh.renderOrder = 2
      scene.add(mesh)
      this.decals.push({ mesh, life: 0, max: 1 })
    }

    const tracerMat = new THREE.MeshBasicMaterial({
      color: 0xffc48a,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    for (let i = 0; i < 10; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 1), tracerMat.clone())
      mesh.visible = false
      mesh.frustumCulled = false
      scene.add(mesh)
      this.tracers.push({ mesh, life: 0, max: 1 })
    }
  }

  muzzle(worldPos: THREE.Vector3, camera: THREE.Camera) {
    this.flashRoll = Math.random() * Math.PI
    this.flashLife.t = FLASH_LIFE
    this.flash.visible = true
    const s = 0.92 + Math.random() * 0.28
    this.flash.scale.setScalar(s)
    this.flashMats[0].color.setHex(Math.random() > 0.35 ? 0xfff6df : 0xffc56a)
    this.setFlashOpacity(1)
    this.placeFlash(worldPos, camera)
  }

  /** Keep the sprite on the barrel after the viewmodel kicks. */
  placeFlash(worldPos: THREE.Vector3, camera: THREE.Camera) {
    if (this.flashLife.t <= 0) return
    this.flash.position.copy(worldPos)
    this.flash.quaternion.copy(camera.quaternion)
    this.flash.rotateZ(this.flashRoll)
  }

  eject(pos: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3, forward: THREE.Vector3) {
    const slot = this.brass.find((b) => b.life <= 0)
    if (!slot) return
    const life = 1.05 + Math.random() * 0.25
    slot.life = life
    slot.max = life
    slot.mesh.visible = true
    slot.mesh.scale.setScalar(1.4)
    slot.mesh.position.copy(pos).addScaledVector(right, 0.16).addScaledVector(up, 0.06)
    slot.mesh.rotation.set(Math.random() * 6.2, Math.random() * 6.2, Math.random() * 6.2)
    const mat = slot.mesh.material as THREE.MeshBasicMaterial
    mat.opacity = 1
    const jitter = (n: number) => (Math.random() - 0.5) * n
    const spin = (n: number) => (Math.random() < 0.5 ? -1 : 1) * (9 + Math.random() * n)
    slot.vx = right.x * 1.35 + up.x * 1.45 + forward.x * 0.15 + jitter(0.35)
    slot.vy = right.y * 1.35 + up.y * 1.45 + forward.y * 0.15 + 0.4 + jitter(0.3)
    slot.vz = right.z * 1.35 + up.z * 1.45 + forward.z * 0.15 + jitter(0.35)
    slot.sx = spin(8)
    slot.sy = spin(10)
    slot.sz = spin(8)
  }

  private setFlashOpacity(opacity: number) {
    const shown = opacity > 0.02
    this.flash.visible = shown
    for (const mat of this.flashMats) mat.opacity = opacity
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3) {
    const slot = this.tracers.find((t) => t.life <= 0)
    if (!slot) return
    this.tmp.copy(to).sub(from)
    const len = this.tmp.length()
    if (len < 0.05) return
    slot.life = 0.07
    slot.max = 0.07
    slot.mesh.visible = true
    slot.mesh.scale.set(1, 1, len)
    slot.mesh.position.copy(from).addScaledVector(this.tmp, 0.5)
    slot.mesh.lookAt(to)
    const mat = slot.mesh.material as THREE.MeshBasicMaterial
    mat.opacity = 0.9
  }

  scorch(impact: Impact) {
    const slot = this.decals.find((d) => d.life <= 0)
    if (!slot) return
    slot.life = 8
    slot.max = 8
    slot.mesh.visible = true
    slot.mesh.position.set(impact.x, impact.y, impact.z)
    slot.mesh.position.addScaledVector(this.tmp2.set(impact.nx, impact.ny, impact.nz), 0.025)
    slot.mesh.quaternion.setFromUnitVectors(this.up, this.tmp2.set(impact.nx, impact.ny, impact.nz).normalize())
    const spread = 0.22 + Math.random() * 0.18
    slot.mesh.scale.setScalar(spread / 0.28)
    slot.mesh.rotateZ(Math.random() * Math.PI)
    const mat = slot.mesh.material as THREE.MeshBasicMaterial
    mat.opacity = 0.85
  }

  burst(x: number, y: number, z: number, tint: 'spark' | 'ash' | 'blood', count: number) {
    for (let n = 0; n < count; n++) {
      const slot = this.sparks.find((s) => s.life <= 0)
      if (!slot) return
      slot.life = 0.28 + Math.random() * 0.35
      slot.max = slot.life
      slot.x = x + (Math.random() - 0.5) * 0.08
      slot.y = y + (Math.random() - 0.5) * 0.08
      slot.z = z + (Math.random() - 0.5) * 0.08
      slot.vx = (Math.random() - 0.5) * (tint === 'ash' ? 1.4 : 3.2)
      slot.vy = Math.random() * (tint === 'ash' ? 1.6 : 2.4)
      slot.vz = (Math.random() - 0.5) * (tint === 'ash' ? 1.4 : 3.2)
      if (tint === 'blood') {
        slot.r = 0.55
        slot.g = 0.08
        slot.b = 0.05
      } else if (tint === 'ash') {
        slot.r = 0.75
        slot.g = 0.7
        slot.b = 0.62
      } else {
        slot.r = 1
        slot.g = 0.55 + Math.random() * 0.3
        slot.b = 0.2
      }
    }
  }

  death(x: number, z: number) {
    this.burst(x, 1.1, z, 'ash', 16)
    this.burst(x, 1.3, z, 'blood', 8)
    this.burst(x, 0.8, z, 'spark', 6)
  }

  update(dt: number) {
    if (this.flashLife.t > 0) {
      this.flashLife.t -= dt
      const u = Math.max(0, this.flashLife.t / FLASH_LIFE)
      this.setFlashOpacity(Math.pow(u, 1.35))
    }
    for (const spec of this.brass) {
      if (spec.life <= 0) continue
      spec.life -= dt
      spec.vy -= 9.4 * dt
      spec.mesh.position.x += spec.vx * dt
      spec.mesh.position.y += spec.vy * dt
      spec.mesh.position.z += spec.vz * dt
      if (spec.mesh.position.y < 0.03 && spec.vy < 0) {
        spec.mesh.position.y = 0.03
        spec.vy *= -0.32
        spec.vx *= 0.55
        spec.vz *= 0.55
        spec.sx *= 0.45
        spec.sy *= 0.45
        spec.sz *= 0.45
      }
      spec.mesh.rotation.x += spec.sx * dt
      spec.mesh.rotation.y += spec.sy * dt
      spec.mesh.rotation.z += spec.sz * dt
      const fade = spec.life < 0.38 ? Math.max(0, spec.life / 0.38) : 1
      ;(spec.mesh.material as THREE.MeshBasicMaterial).opacity = fade
      if (spec.life <= 0) spec.mesh.visible = false
    }
    for (let i = 0; i < this.sparks.length; i++) {
      const spec = this.sparks[i]
      if (spec.life <= 0) {
        this.pos[i * 3 + 1] = -40
        continue
      }
      spec.life -= dt
      spec.vy -= dt * (spec.b < 0.15 ? 3.5 : 1.4)
      spec.x += spec.vx * dt
      spec.y += spec.vy * dt
      spec.z += spec.vz * dt
      const fade = Math.max(0, spec.life / spec.max)
      this.pos[i * 3] = spec.x
      this.pos[i * 3 + 1] = spec.y
      this.pos[i * 3 + 2] = spec.z
      this.col[i * 3] = spec.r * fade
      this.col[i * 3 + 1] = spec.g * fade
      this.col[i * 3 + 2] = spec.b * fade
    }
    ;(this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    ;(this.points.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true

    for (const decal of this.decals) {
      if (decal.life <= 0) continue
      decal.life -= dt
      const mat = decal.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, Math.min(0.85, decal.life / 1.5))
      if (decal.life <= 0) decal.mesh.visible = false
    }
    for (const tracer of this.tracers) {
      if (tracer.life <= 0) continue
      tracer.life -= dt
      const mat = tracer.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, tracer.life / tracer.max)
      if (tracer.life <= 0) tracer.mesh.visible = false
    }
  }
}
