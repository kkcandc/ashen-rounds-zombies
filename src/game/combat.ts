import type { Husk, Vec3 } from './types'
import type { WeaponDef } from './balance'

export function raySphere(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
): number | null {
  const lx = cx - ox
  const ly = cy - oy
  const lz = cz - oz
  const tca = lx * dx + ly * dy + lz * dz
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca
  const r2 = radius * radius
  if (d2 > r2) return null
  const thc = Math.sqrt(r2 - d2)
  let t = tca - thc
  if (t < 0.001) t = tca + thc
  if (t < 0.001) return null
  return t
}

export function hitHusk(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  husk: Pick<Husk, 'x' | 'z' | 'scale'>,
  maxRange: number,
): { t: number; head: boolean } | null {
  const s = husk.scale
  const samples = [
    { y: 0.55 * s, r: 0.34 * s, head: false },
    { y: 0.98 * s, r: 0.38 * s, head: false },
    { y: 1.32 * s, r: 0.32 * s, head: false },
    { y: 1.7 * s, r: 0.24 * s, head: true },
  ]
  let best: { t: number; head: boolean } | null = null
  for (const sm of samples) {
    const t = raySphere(ox, oy, oz, dx, dy, dz, husk.x, sm.y, husk.z, sm.r)
    if (t == null || t > maxRange) continue
    if (!best || t < best.t) best = { t, head: sm.head }
  }
  return best
}

export function perturb(dir: Vec3, spread: number, rng: () => number): Vec3 {
  if (spread <= 0) return dir
  const ax = Math.abs(dir.x) < 0.9 ? 1 : 0
  const ay = Math.abs(dir.x) < 0.9 ? 0 : 1
  const az = 0
  let rx = dir.y * az - dir.z * ay
  let ry = dir.z * ax - dir.x * az
  let rz = dir.x * ay - dir.y * ax
  const rl = Math.hypot(rx, ry, rz) || 1
  rx /= rl
  ry /= rl
  rz /= rl
  const ux = dir.y * rz - dir.z * ry
  const uy = dir.z * rx - dir.x * rz
  const uz = dir.x * ry - dir.y * rx
  const ang = rng() * Math.PI * 2
  const rad = spread * Math.sqrt(Math.max(0, rng()))
  const c = Math.cos(ang)
  const sn = Math.sin(ang)
  const x = dir.x + (rx * c + ux * sn) * rad
  const y = dir.y + (ry * c + uy * sn) * rad
  const z = dir.z + (rz * c + uz * sn) * rad
  const l = Math.hypot(x, y, z) || 1
  return { x: x / l, y: y / l, z: z / l }
}

export type PelletHit = {
  id: number
  head: boolean
  dmg: number
  x: number
  y: number
  z: number
}

export function castShot(
  husks: Husk[],
  origin: Vec3,
  aim: Vec3,
  weapon: WeaponDef,
  spread: number,
  rng: () => number = Math.random,
): PelletHit[] {
  const al = Math.hypot(aim.x, aim.y, aim.z) || 1
  const base = { x: aim.x / al, y: aim.y / al, z: aim.z / al }
  const hits: PelletHit[] = []
  const pellets = Math.max(1, weapon.pellets)
  for (let p = 0; p < pellets; p++) {
    const dir = perturb(base, spread, rng)
    let best: { husk: Husk; t: number; head: boolean } | null = null
    for (const husk of husks) {
      if (husk.state === 'dying' || husk.hp <= 0) continue
      const hit = hitHusk(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, husk, weapon.range)
      if (!hit) continue
      if (!best || hit.t < best.t) best = { husk, t: hit.t, head: hit.head }
    }
    if (!best) continue
    const dmg = weapon.damage * (best.head ? weapon.headMult : 1)
    hits.push({
      id: best.husk.id,
      head: best.head,
      dmg,
      x: origin.x + dir.x * best.t,
      y: origin.y + dir.y * best.t,
      z: origin.z + dir.z * best.t,
    })
  }
  return hits
}
