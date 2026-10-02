import * as THREE from 'three'
import type { Kind } from './types'
import { WEAPONS } from './balance'

export type HuskMesh = {
  group: THREE.Group
  skin: THREE.MeshStandardMaterial
  eye: THREE.MeshStandardMaterial
  armL: THREE.Object3D
  armR: THREE.Object3D
  legL: THREE.Object3D
  legR: THREE.Object3D
}

const KIND_COLOR: Record<Kind, number> = {
  husk: 0x3a332f,
  cinder: 0x5a3428,
  warden: 0x2a2724,
}

export function createHuskMesh(): HuskMesh {
  const group = new THREE.Group()
  const skin = new THREE.MeshStandardMaterial({ color: KIND_COLOR.husk, roughness: 0.86, metalness: 0.04 })
  const eye = new THREE.MeshStandardMaterial({
    color: 0xffc48a,
    emissive: 0xff6a1c,
    emissiveIntensity: 2.4,
    roughness: 0.35,
  })
  const limb = () => new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.12), skin)

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.05, 7), skin)
  body.position.y = 0.98
  body.castShadow = true
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 7), skin)
  head.position.y = 1.68
  head.castShadow = true
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), eye)
  const eyeR = eyeL.clone()
  eyeL.position.set(-0.07, 1.72, -0.16)
  eyeR.position.set(0.07, 1.72, -0.16)

  const armL = new THREE.Group()
  const armR = new THREE.Group()
  const legL = new THREE.Group()
  const legR = new THREE.Group()
  armL.position.set(-0.38, 1.35, 0)
  armR.position.set(0.38, 1.35, 0)
  legL.position.set(-0.14, 0.62, 0)
  legR.position.set(0.14, 0.62, 0)
  const aL = limb()
  const aR = limb()
  const lL = limb()
  const lR = limb()
  aL.position.y = -0.28
  aR.position.y = -0.28
  lL.position.y = -0.28
  lR.position.y = -0.28
  armL.add(aL)
  armR.add(aR)
  legL.add(lL)
  legR.add(lR)
  group.add(body, head, eyeL, eyeR, armL, armR, legL, legR)
  group.visible = false
  return { group, skin, eye, armL, armR, legL, legR }
}

export function paintHusk(mesh: HuskMesh, kind: Kind) {
  mesh.skin.color.setHex(KIND_COLOR[kind])
  mesh.skin.emissive.setHex(kind === 'cinder' ? 0x441608 : 0x000000)
  mesh.skin.emissiveIntensity = kind === 'cinder' ? 0.35 : 0
  mesh.eye.emissiveIntensity = kind === 'warden' ? 1.2 : kind === 'cinder' ? 3.2 : 2.2
}

export function createGuns(): Record<string, THREE.Group> {
  const guns: Record<string, THREE.Group> = {}
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa3ab, roughness: 0.38, metalness: 0.72 })
  const wood = new THREE.MeshStandardMaterial({ color: 0x8d5a34, roughness: 0.7, metalness: 0.05 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a4046, roughness: 0.45, metalness: 0.45 })
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08a4f, roughness: 0.35, metalness: 0.6 })

  const add = (id: string, build: (g: THREE.Group) => void) => {
    const g = new THREE.Group()
    build(g)
    g.visible = false
    guns[id] = g
  }

  const bar = (g: THREE.Group, w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    g.add(m)
  }

  add('pistol', (g) => {
    bar(g, 0.08, 0.12, 0.28, 0, 0, -0.05, dark)
    bar(g, 0.07, 0.16, 0.08, 0, -0.1, 0.08, wood)
  })
  add('repeater', (g) => {
    bar(g, 0.09, 0.12, 0.55, 0, 0, -0.12, dark)
    bar(g, 0.1, 0.16, 0.22, 0, -0.08, 0.12, wood)
    bar(g, 0.08, 0.2, 0.08, 0, -0.16, 0.08, metal)
  })
  add('lance', (g) => {
    bar(g, 0.08, 0.08, 0.62, -0.04, 0.02, -0.16, metal)
    bar(g, 0.08, 0.08, 0.62, 0.04, 0.02, -0.16, metal)
    bar(g, 0.12, 0.12, 0.22, 0, -0.06, 0.12, wood)
  })
  add('pyre', (g) => {
    bar(g, 0.07, 0.08, 0.9, 0, 0.04, -0.22, dark)
    bar(g, 0.09, 0.14, 0.32, 0, -0.04, 0.16, wood)
    bar(g, 0.04, 0.1, 0.16, 0, 0.1, -0.05, metal)
  })
  add('carbine', (g) => {
    bar(g, 0.09, 0.11, 0.62, 0, 0.02, -0.14, dark)
    bar(g, 0.1, 0.14, 0.24, 0, -0.06, 0.14, wood)
  })
  add('splinter', (g) => {
    bar(g, 0.14, 0.1, 0.48, 0, 0.02, -0.1, metal)
    bar(g, 0.1, 0.12, 0.2, 0, -0.08, 0.14, wood)
  })
  add('howl', (g) => {
    bar(g, 0.16, 0.16, 0.42, 0, 0.02, -0.08, brass)
    bar(g, 0.1, 0.14, 0.22, 0, -0.1, 0.14, wood)
  })
  add('spire', (g) => {
    bar(g, 0.06, 0.07, 1.05, 0, 0.05, -0.28, dark)
    bar(g, 0.08, 0.12, 0.28, 0, -0.04, 0.18, wood)
    bar(g, 0.02, 0.08, 0.2, 0, 0.12, 0.02, metal)
  })
  add('drum', (g) => {
    bar(g, 0.12, 0.14, 0.5, 0, 0.02, -0.1, metal)
    bar(g, 0.16, 0.22, 0.16, 0, -0.12, 0.02, dark)
    bar(g, 0.08, 0.1, 0.18, 0, -0.02, 0.16, wood)
  })

  for (const id of Object.keys(WEAPONS)) {
    if (!guns[id]) add(id, (g) => bar(g, 0.08, 0.1, 0.4, 0, 0, 0, metal))
  }
  return guns
}
