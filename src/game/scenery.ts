import * as THREE from 'three'
import type { DoorId } from './types'
import {
  BRAZIERS,
  BREACHES,
  DOORS,
  FLOORS,
  SOLIDS,
  STATIONS,
  VAULT_SPOTS,
} from './world'

export type SceneHandles = {
  doors: { id: DoorId; mesh: THREE.Group; slide: { x: number; z: number } }[]
  planks: { breachId: string; meshes: THREE.Mesh[] }[]
  vault: THREE.Group
  stations: Map<string, THREE.Group>
  braziers: THREE.PointLight[]
  dust: THREE.Points
}

function noiseTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')
  if (!g) return new THREE.CanvasTexture(c)
  const img = g.createImageData(256, 256)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 70 + Math.random() * 90
    img.data[i] = n
    img.data[i + 1] = n - 6
    img.data[i + 2] = n - 14
    img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(4, 4)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function labelTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')
  if (g) {
    g.clearRect(0, 0, 512, 128)
    g.fillStyle = '#e7d3ba'
    g.font = '600 54px Georgia, serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, 256, 64)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function yawToward(x: number, z: number, tx: number, tz: number): number {
  return Math.atan2(-(tx - x), -(tz - z))
}

export function buildScenery(scene: THREE.Scene): SceneHandles {
  const floorTex = noiseTexture()
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x5e5850,
    map: floorTex,
    roughness: 0.86,
    metalness: 0.04,
  })
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x3a342e, roughness: 1, metalness: 0 })
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x6e675e, roughness: 0.84, metalness: 0.05 })
  const sillMat = new THREE.MeshStandardMaterial({ color: 0x4e463e, roughness: 0.8, metalness: 0.08 })
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6d4e34, roughness: 0.78, metalness: 0.02 })
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5c574e, roughness: 0.9, metalness: 0.06 })
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.45, metalness: 0.55 })
  const rustMat = new THREE.MeshStandardMaterial({ color: 0x7a4632, roughness: 0.7, metalness: 0.25 })
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xff6a2a,
    emissive: 0xff4a12,
    emissiveIntensity: 2.2,
    roughness: 0.4,
  })

  for (const f of FLOORS) {
    const w = f.maxX - f.minX
    const d = f.maxZ - f.minZ
    const geo = new THREE.PlaneGeometry(w, d)
    const mesh = new THREE.Mesh(geo, floorMat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set((f.minX + f.maxX) / 2, 0, (f.minZ + f.maxZ) / 2)
    mesh.receiveShadow = true
    scene.add(mesh)
    const ceil = new THREE.Mesh(geo, ceilMat)
    ceil.rotation.x = Math.PI / 2
    ceil.position.set((f.minX + f.maxX) / 2, 3.18, (f.minZ + f.maxZ) / 2)
    scene.add(ceil)
  }

  const sharedBox = new Map<string, THREE.BoxGeometry>()
  const box = (w: number, h: number, d: number) => {
    const key = `${w.toFixed(2)}|${h.toFixed(2)}|${d.toFixed(2)}`
    let geo = sharedBox.get(key)
    if (!geo) {
      geo = new THREE.BoxGeometry(w, h, d)
      sharedBox.set(key, geo)
    }
    return geo
  }

  for (const s of SOLIDS) {
    if (!s.visual) continue
    const w = s.maxX - s.minX
    const h = s.y1 - s.y0
    const d = s.maxZ - s.minZ
    const stone = s.id?.startsWith('pill') || s.id === 'pillar-ash' || s.id === 'rubble-w' || s.id === 'altar'
    const mat = s.id === 'sill' || s.id === 'header' ? sillMat : s.kind === 'obstacle' ? (stone ? stoneMat : woodMat) : wallMat
    const mesh = new THREE.Mesh(box(w, h, d), mat)
    mesh.position.set((s.minX + s.maxX) / 2, (s.y0 + s.y1) / 2, (s.minZ + s.maxZ) / 2)
    mesh.castShadow = s.kind !== 'wall'
    mesh.receiveShadow = true
    scene.add(mesh)
    if (s.id === 'altar') {
      const glow = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.08, d * 0.55), emberMat)
      glow.position.set(mesh.position.x, s.y1 + 0.05, mesh.position.z)
      scene.add(glow)
    }
  }

  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.6, metalness: 0.4 })
  for (const x of [-6, -2, 2, 6]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 15, 6), pipeMat)
    pipe.rotation.z = Math.PI / 2
    pipe.position.set(x, 2.95, 0)
    scene.add(pipe)
  }

  const doors: SceneHandles['doors'] = []
  for (const d of DOORS) {
    const w = d.maxX - d.minX
    const dep = d.maxZ - d.minZ
    const group = new THREE.Group()
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 2.55, dep * 0.92), metalMat)
    slab.position.y = 1.28
    const band = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.16, dep * 0.98), rustMat)
    band.position.y = 1.7
    group.add(slab, band)
    group.position.set((d.minX + d.maxX) / 2, 0, (d.minZ + d.maxZ) / 2)
    scene.add(group)
    doors.push({ id: d.id, mesh: group, slide: d.slide })
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.48), new THREE.MeshBasicMaterial({ map: labelTexture(d.name.toUpperCase()), transparent: true }))
    sign.position.set((d.minX + d.maxX) / 2, 2.55, (d.minZ + d.maxZ) / 2 + (d.id === 'rift' ? 0.7 : 0.55))
    if (d.id === 'rift') sign.rotation.y = 0
    else if (d.id === 'iron') sign.rotation.y = Math.PI / 2
    else sign.rotation.y = -Math.PI / 2
    scene.add(sign)
  }

  const roomSigns: { text: string; x: number; y: number; z: number; rot: number }[] = [
    { text: 'ASH HALL', x: 0, y: 2.4, z: -8.2, rot: 0 },
    { text: 'RELAY PIT', x: 22, y: 2.4, z: -10.55, rot: 0 },
    { text: 'WATCH GALLERY', x: -22, y: 2.4, z: -10.55, rot: 0 },
    { text: 'EMBER CRYPT', x: 22, y: 2.4, z: -14.35, rot: Math.PI },
  ]
  for (const s of roomSigns) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 0.55),
      new THREE.MeshBasicMaterial({ map: labelTexture(s.text), transparent: true }),
    )
    mesh.position.set(s.x, s.y, s.z)
    mesh.rotation.y = s.rot
    scene.add(mesh)
  }

  const planks: SceneHandles['planks'] = []
  for (const b of BREACHES) {
    const meshes: THREE.Mesh[] = []
    for (let i = 0; i < b.maxPlanks; i++) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(b.half * 2, 0.12, 0.1), woodMat)
      board.position.set(b.wx, 1.16 + i * 0.2, b.wz)
      if (b.axis === 'z') board.rotation.y = Math.PI / 2
      board.castShadow = true
      scene.add(board)
      meshes.push(board)
    }
    planks.push({ breachId: b.id, meshes })
  }

  const stations = new Map<string, THREE.Group>()
  const centers: Record<string, { x: number; z: number }> = {
    ash: { x: 0, z: 0 },
    relay: { x: 22, z: 0 },
    watch: { x: -22, z: 0 },
    crypt: { x: 22, z: -20 },
  }
  for (const s of STATIONS) {
    const g = new THREE.Group()
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.15, 0.32), metalMat)
    pedestal.position.y = 0.58
    g.add(pedestal)
    if (s.kind === 'perk') {
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 10, 8),
        new THREE.MeshStandardMaterial({
          color: s.perk === 'heart' ? 0xff5a2a : 0xb7f0c2,
          emissive: s.perk === 'heart' ? 0xff4a18 : 0x7dffa8,
          emissiveIntensity: 1.8,
        }),
      )
      glow.position.y = 1.35
      glow.name = 'glow'
      g.add(glow)
    } else if (s.kind === 'tonic') {
      const bottle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 0.28, 8),
        new THREE.MeshStandardMaterial({ color: 0xffb15a, emissive: 0xff6a2a, emissiveIntensity: 0.8 }),
      )
      bottle.position.y = 1.28
      bottle.name = 'glow'
      g.add(bottle)
    } else {
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.12), rustMat)
      gun.position.y = 1.25
      g.add(gun)
    }
    const face = centers[s.area] ?? centers.ash
    g.position.set(s.x, 0, s.z)
    g.rotation.y = yawToward(s.x, s.z, face.x, face.z)
    scene.add(g)
    stations.set(s.id, g)
  }

  const vault = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.55, 0.7), metalMat)
  body.position.y = 0.78
  const seam = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1.2, 0.74),
    new THREE.MeshStandardMaterial({ color: 0xffc27a, emissive: 0xff6a2a, emissiveIntensity: 1.4 }),
  )
  seam.position.y = 0.85
  seam.name = 'seam'
  vault.add(body, seam)
  const spot0 = VAULT_SPOTS[0]
  vault.position.set(spot0.x, 0, spot0.z)
  scene.add(vault)

  const braziers: THREE.PointLight[] = []
  for (const b of BRAZIERS) {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.35, 8), rustMat)
    bowl.position.set(b.x, 0.2, b.z)
    const coal = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), emberMat)
    coal.position.set(b.x, 0.42, b.z)
    scene.add(bowl, coal)
    const light = new THREE.PointLight(0xff7a3a, 18, 16, 1.6)
    light.position.set(b.x, 1.3, b.z)
    scene.add(light)
    braziers.push(light)
  }

  const dustCount = 80
  const positions = new Float32Array(dustCount * 3)
  for (let i = 0; i < dustCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 18
    positions[i * 3 + 1] = 0.4 + Math.random() * 2.4
    positions[i * 3 + 2] = (Math.random() - 0.5) * 14
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ color: 0xe6d7c4, size: 0.035, transparent: true, opacity: 0.35, depthWrite: false }),
  )
  scene.add(dust)

  return { doors, planks, vault, stations, braziers, dust }
}
