import * as THREE from 'three'
import type { Kind } from './types'
import { WEAPONS } from './balance'

export type HuskMesh = {
  group: THREE.Group
  skin: THREE.MeshStandardMaterial
  cloth: THREE.MeshStandardMaterial
  vein: THREE.MeshStandardMaterial
  eye: THREE.MeshStandardMaterial
  pauldron: THREE.Object3D
  veins: THREE.Object3D
  armL: THREE.Object3D
  armR: THREE.Object3D
  legL: THREE.Object3D
  legR: THREE.Object3D
  phase: number
  hunch: number
  drag: number
  dying: boolean
}

const KIND_COLOR: Record<Kind, number> = {
  husk: 0x4a4038,
  cinder: 0x6a3828,
  warden: 0x2e2a28,
}

const CLOTH_COLOR: Record<Kind, number> = {
  husk: 0x2a241e,
  cinder: 0x3a2218,
  warden: 0x1c1a22,
}

function fadeMaterial(mat: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial, opacity: number) {
  mat.opacity = opacity
  mat.transparent = opacity < 0.98
  mat.depthWrite = opacity > 0.85
}

export function createHuskMesh(): HuskMesh {
  const group = new THREE.Group()
  const skin = new THREE.MeshStandardMaterial({ color: KIND_COLOR.husk, roughness: 0.78, metalness: 0.06 })
  const cloth = new THREE.MeshStandardMaterial({ color: CLOTH_COLOR.husk, roughness: 0.92, metalness: 0.02 })
  const vein = new THREE.MeshStandardMaterial({
    color: 0xff6a2a,
    emissive: 0xff3a08,
    emissiveIntensity: 2.6,
    roughness: 0.4,
  })
  const eye = new THREE.MeshStandardMaterial({
    color: 0xffe0b0,
    emissive: 0xff6a1c,
    emissiveIntensity: 2.8,
    roughness: 0.3,
  })

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.26), skin)
  torso.position.set(0, 1.08, 0.02)
  torso.castShadow = true
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.3), cloth)
  chest.position.set(0, 1.28, 0)
  chest.castShadow = true
  const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.12, 0.32), cloth)
  shoulders.position.set(0, 1.4, 0)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.24), skin)
  head.position.set(0, 1.66, -0.04)
  head.castShadow = true
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.12), skin)
  jaw.position.set(0, 1.52, -0.14)
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eye)
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eye)
  eyeL.position.set(-0.07, 1.7, -0.16)
  eyeR.position.set(0.07, 1.7, -0.16)

  const rag = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.48, 0.06), cloth)
  rag.position.set(0, 0.7, 0.12)
  rag.rotation.x = 0.35
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.05), cloth)
  skirt.position.set(0, 0.66, -0.12)
  skirt.rotation.x = -0.2

  const limbGeo = new THREE.BoxGeometry(0.1, 0.58, 0.1)
  const armL = new THREE.Group()
  const armR = new THREE.Group()
  const legL = new THREE.Group()
  const legR = new THREE.Group()
  armL.position.set(-0.4, 1.36, 0)
  armR.position.set(0.4, 1.36, 0)
  legL.position.set(-0.14, 0.62, 0)
  legR.position.set(0.14, 0.62, 0)
  const aL = new THREE.Mesh(limbGeo, skin)
  const aR = new THREE.Mesh(limbGeo, cloth)
  const lL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.58, 0.12), skin)
  const lR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.58, 0.12), skin)
  aL.position.y = -0.3
  aR.position.y = -0.3
  lL.position.y = -0.3
  lR.position.y = -0.3
  aL.castShadow = aR.castShadow = lL.castShadow = lR.castShadow = true
  armL.add(aL)
  armR.add(aR)
  legL.add(lL)
  legR.add(lR)
  armL.rotation.z = 0.18
  armR.rotation.z = -0.28
  armL.rotation.x = 0.25
  armR.rotation.x = 0.15

  const veins = new THREE.Group()
  for (const [x, y, z, sx, sy] of [
    [-0.08, 1.12, -0.14, 0.03, 0.28],
    [0.1, 1.2, -0.14, 0.025, 0.18],
    [0.02, 1.55, -0.16, 0.02, 0.12],
  ] as const) {
    const crack = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.02), vein)
    crack.position.set(x, y, z)
    veins.add(crack)
  }
  veins.visible = false

  const pauldron = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.1, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x8a8178, roughness: 0.4, metalness: 0.7 }),
  )
  pauldron.position.set(-0.32, 1.5, 0)
  pauldron.visible = false
  pauldron.castShadow = true

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 14),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.025
  shadow.name = 'blob'

  group.add(torso, chest, shoulders, head, jaw, eyeL, eyeR, rag, skirt, armL, armR, legL, legR, veins, pauldron, shadow)
  group.visible = false
  return {
    group,
    skin,
    cloth,
    vein,
    eye,
    pauldron,
    veins,
    armL,
    armR,
    legL,
    legR,
    phase: Math.random() * Math.PI * 2,
    hunch: 0.12 + Math.random() * 0.16,
    drag: 0.65 + Math.random() * 0.7,
    dying: false,
  }
}

export function paintHusk(mesh: HuskMesh, kind: Kind) {
  mesh.skin.color.setHex(KIND_COLOR[kind])
  mesh.cloth.color.setHex(CLOTH_COLOR[kind])
  mesh.veins.visible = kind === 'cinder'
  mesh.pauldron.visible = kind === 'warden'
  mesh.eye.emissive.setHex(kind === 'warden' ? 0xc9a36a : 0xff6a1c)
  mesh.eye.emissiveIntensity = kind === 'warden' ? 1.4 : kind === 'cinder' ? 3.4 : 2.5
  if (kind !== 'cinder') {
    mesh.skin.emissive.setHex(0x000000)
    mesh.skin.emissiveIntensity = 0
  }
}

export function fadeHusk(mesh: HuskMesh, opacity: number) {
  fadeMaterial(mesh.skin, opacity)
  fadeMaterial(mesh.cloth, opacity)
  fadeMaterial(mesh.vein, opacity)
  fadeMaterial(mesh.eye, opacity)
  const blob = mesh.group.getObjectByName('blob') as THREE.Mesh | undefined
  const blobMat = blob?.material as THREE.MeshBasicMaterial | undefined
  if (blobMat) blobMat.opacity = 0.38 * opacity
}

export type Viewmodel = {
  guns: Record<string, THREE.Group>
  armsPistol: THREE.Group
  armsRifle: THREE.Group
}

export function createViewmodel(): Viewmodel {
  const guns: Record<string, THREE.Group> = {}
  const metal = new THREE.MeshStandardMaterial({ color: 0xb7c0c8, roughness: 0.32, metalness: 0.78 })
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a4e2c, roughness: 0.62, metalness: 0.04 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c3136, roughness: 0.48, metalness: 0.55 })
  const brass = new THREE.MeshStandardMaterial({ color: 0xd2a45a, roughness: 0.3, metalness: 0.7 })
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x2a231c, roughness: 0.88, metalness: 0.05 })
  const glove = new THREE.MeshStandardMaterial({ color: 0x4a3b30, roughness: 0.8, metalness: 0.08 })

  const add = (id: string, build: (g: THREE.Group) => void) => {
    const g = new THREE.Group()
    build(g)
    g.visible = false
    guns[id] = g
  }

  const box = (g: THREE.Group, w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    g.add(m)
    return m
  }
  const cyl = (
    g: THREE.Group,
    r: number,
    len: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
  ) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat)
    m.rotation.x = Math.PI / 2
    m.position.set(x, y, z)
    g.add(m)
    return m
  }
  const muzzle = (g: THREE.Group, z: number, y = 0.02) => {
    const node = new THREE.Object3D()
    node.name = 'muzzle'
    node.position.set(0, y, z)
    g.add(node)
  }

  add('pistol', (g) => {
    box(g, 0.085, 0.1, 0.22, 0, 0.03, -0.04, dark)
    cyl(g, 0.02, 0.2, 0, 0.055, -0.2, metal)
    box(g, 0.07, 0.16, 0.065, 0, -0.08, 0.05, wood)
    box(g, 0.09, 0.035, 0.05, 0, -0.01, 0.04, metal)
    box(g, 0.016, 0.045, 0.04, 0, 0.09, -0.02, metal)
    muzzle(g, -0.31, 0.055)
  })
  add('repeater', (g) => {
    box(g, 0.07, 0.09, 0.34, 0, 0.02, -0.08, dark)
    cyl(g, 0.016, 0.22, 0, 0.045, -0.28, metal)
    box(g, 0.075, 0.16, 0.08, 0, -0.06, 0.08, wood)
    box(g, 0.05, 0.14, 0.05, 0, -0.12, 0.02, dark)
    box(g, 0.06, 0.08, 0.16, 0, 0.01, 0.16, wood)
    muzzle(g, -0.4, 0.045)
  })
  add('lance', (g) => {
    box(g, 0.1, 0.08, 0.2, 0, 0.01, -0.02, wood)
    cyl(g, 0.02, 0.36, -0.035, 0.03, -0.22, metal)
    cyl(g, 0.02, 0.36, 0.035, 0.03, -0.22, metal)
    box(g, 0.09, 0.12, 0.08, 0, -0.06, 0.1, wood)
    muzzle(g, -0.42, 0.03)
  })
  add('pyre', (g) => {
    box(g, 0.06, 0.07, 0.42, 0, 0.03, -0.1, dark)
    cyl(g, 0.014, 0.48, 0, 0.05, -0.42, metal)
    box(g, 0.07, 0.12, 0.18, 0, -0.02, 0.16, wood)
    box(g, 0.02, 0.05, 0.12, 0, 0.09, -0.05, metal)
    box(g, 0.05, 0.06, 0.2, 0, 0.02, 0.28, wood)
    muzzle(g, -0.68, 0.05)
  })
  add('carbine', (g) => {
    box(g, 0.07, 0.08, 0.36, 0, 0.02, -0.08, dark)
    cyl(g, 0.015, 0.26, 0, 0.04, -0.3, metal)
    box(g, 0.08, 0.14, 0.1, 0, -0.05, 0.1, wood)
    box(g, 0.055, 0.08, 0.18, 0, 0.01, 0.22, wood)
    muzzle(g, -0.44, 0.04)
  })
  add('splinter', (g) => {
    box(g, 0.12, 0.09, 0.22, 0, 0.02, -0.04, wood)
    cyl(g, 0.028, 0.28, 0, 0.035, -0.22, metal)
    box(g, 0.08, 0.12, 0.07, 0, -0.07, 0.1, dark)
    muzzle(g, -0.38, 0.035)
  })
  add('howl', (g) => {
    box(g, 0.14, 0.12, 0.2, 0, 0.02, -0.02, brass)
    cyl(g, 0.04, 0.16, 0, 0.04, -0.16, dark)
    box(g, 0.08, 0.14, 0.08, 0, -0.08, 0.1, wood)
    muzzle(g, -0.26, 0.04)
  })
  add('spire', (g) => {
    box(g, 0.055, 0.06, 0.28, 0, 0.03, -0.02, dark)
    cyl(g, 0.012, 0.7, 0, 0.045, -0.42, metal)
    box(g, 0.06, 0.1, 0.16, 0, -0.02, 0.16, wood)
    box(g, 0.018, 0.05, 0.14, 0, 0.09, 0.02, metal)
    muzzle(g, -0.78, 0.045)
  })
  add('drum', (g) => {
    box(g, 0.09, 0.1, 0.28, 0, 0.03, -0.06, dark)
    cyl(g, 0.018, 0.2, 0, 0.05, -0.24, metal)
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 10), dark)
    drum.rotation.z = Math.PI / 2
    drum.position.set(0, -0.02, 0.02)
    g.add(drum)
    box(g, 0.07, 0.1, 0.08, 0, -0.02, 0.16, wood)
    muzzle(g, -0.36, 0.05)
  })

  for (const id of Object.keys(WEAPONS)) {
    if (!guns[id]) {
      add(id, (g) => {
        box(g, 0.08, 0.1, 0.4, 0, 0, -0.1, metal)
        muzzle(g, -0.32, 0.02)
      })
    }
  }

  const arm = (rifle: boolean) => {
    const g = new THREE.Group()
    const sleeveR = new THREE.Mesh(new THREE.BoxGeometry(0.07, rifle ? 0.26 : 0.22, 0.07), sleeve)
    sleeveR.position.set(0.1, -0.14, -0.02)
    sleeveR.rotation.z = -0.45
    sleeveR.rotation.x = 0.85
    const handR = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.07, 0.08), glove)
    handR.position.set(0.035, -0.045, 0.02)
    const sleeveL = new THREE.Mesh(new THREE.BoxGeometry(0.065, rifle ? 0.24 : 0.12, 0.065), sleeve)
    sleeveL.position.set(rifle ? -0.08 : 0.02, rifle ? -0.06 : -0.08, rifle ? -0.12 : -0.02)
    sleeveL.rotation.z = rifle ? 0.7 : 0.15
    sleeveL.rotation.x = rifle ? 1.05 : 0.4
    const handL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.055, 0.07), glove)
    handL.position.set(rifle ? -0.01 : 0.04, rifle ? 0.01 : -0.02, rifle ? -0.2 : -0.04)
    g.add(sleeveR, handR, sleeveL, handL)
    return g
  }

  return { guns, armsPistol: arm(false), armsRifle: arm(true) }
}
