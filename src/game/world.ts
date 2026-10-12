import type { AABB, AreaId, DoorId } from './types'
import { COSTS } from './balance'

export type Solid = AABB & {
  y0: number
  y1: number
  kind: 'wall' | 'blocker' | 'obstacle'
  visual: boolean
  id?: string
}

export type FloorRect = {
  id: AreaId
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export type DoorDef = AABB & {
  id: DoorId
  name: string
  cost: number
  slide: { x: number; z: number }
  opens: AreaId[]
}

export type BreachDef = {
  id: string
  area: AreaId
  requires?: DoorId
  x: number
  z: number
  wx: number
  wz: number
  axis: 'x' | 'z'
  half: number
  planks: number
  maxPlanks: number
}

export type StationDef = {
  id: string
  kind: 'wall' | 'locker' | 'perk' | 'tonic'
  name: string
  cost: number
  ammoCost?: number
  weaponId?: string
  perk?: 'heart' | 'step'
  requires?: DoorId
  x: number
  z: number
  area: AreaId
}

export type VaultSpot = {
  id: string
  x: number
  z: number
  requires?: DoorId
  area: AreaId
}

export const NAV_BOUNDS = { minX: -32, maxX: 32, minZ: -28, maxZ: 12 }
export const SPAWN = { x: 0, z: 4.2 }

export const AREA_LABEL: Record<AreaId, string> = {
  ash: 'Ash Hall',
  hallE: 'Cinder Passage',
  relay: 'Relay Pit',
  hallW: 'Iron Passage',
  watch: 'Watch Gallery',
  hallN: 'Rift Stair',
  crypt: 'Ember Crypt',
}

export const FLOORS: FloorRect[] = [
  { id: 'ash', minX: -10.3, maxX: 10.3, minZ: -8.3, maxZ: 8.3 },
  { id: 'hallE', minX: 10.3, maxX: 13.8, minZ: -1.45, maxZ: 1.45 },
  { id: 'relay', minX: 13.8, maxX: 30.3, minZ: -10.7, maxZ: 10.7 },
  { id: 'hallW', minX: -13.8, maxX: -10.3, minZ: -1.45, maxZ: 1.45 },
  { id: 'watch', minX: -30.3, maxX: -13.8, minZ: -10.7, maxZ: 10.7 },
  { id: 'hallN', minX: 19.85, maxX: 23.05, minZ: -14.2, maxZ: -10.7 },
  { id: 'crypt', minX: 13.8, maxX: 30.3, minZ: -26.3, maxZ: -14.2 },
]

export const DOORS: DoorDef[] = [
  {
    id: 'cinder',
    name: 'Cinder Gate',
    cost: COSTS.cinder,
    minX: 9.85,
    maxX: 10.75,
    minZ: -1.55,
    maxZ: 1.55,
    slide: { x: 0, z: 2.7 },
    opens: ['hallE', 'relay'],
  },
  {
    id: 'iron',
    name: 'Iron Hatch',
    cost: COSTS.iron,
    minX: -10.75,
    maxX: -9.85,
    minZ: -1.55,
    maxZ: 1.55,
    slide: { x: 0, z: 2.7 },
    opens: ['hallW', 'watch'],
  },
  {
    id: 'rift',
    name: 'Rift Seal',
    cost: COSTS.rift,
    minX: 19.7,
    maxX: 23.2,
    minZ: -11.2,
    maxZ: -10.25,
    slide: { x: 3.1, z: 0 },
    opens: ['hallN', 'crypt'],
  },
]

export const BREACHES: BreachDef[] = [
  { id: 'ash-n1', area: 'ash', x: -5.2, z: -7.4, wx: -5.2, wz: -8.55, axis: 'x', half: 1.15, planks: 4, maxPlanks: 6 },
  { id: 'ash-n2', area: 'ash', x: 4.6, z: -7.4, wx: 4.6, wz: -8.55, axis: 'x', half: 1.15, planks: 4, maxPlanks: 6 },
  { id: 'ash-s', area: 'ash', x: 0, z: 7.4, wx: 0, wz: 8.55, axis: 'x', half: 1.1, planks: 4, maxPlanks: 6 },
  {
    id: 'relay-e1',
    area: 'relay',
    requires: 'cinder',
    x: 29.3,
    z: -4,
    wx: 30.55,
    wz: -4,
    axis: 'z',
    half: 1.15,
    planks: 4,
    maxPlanks: 6,
  },
  {
    id: 'relay-e2',
    area: 'relay',
    requires: 'cinder',
    x: 29.3,
    z: 5.8,
    wx: 30.55,
    wz: 5.8,
    axis: 'z',
    half: 1.15,
    planks: 4,
    maxPlanks: 6,
  },
  {
    id: 'watch-w1',
    area: 'watch',
    requires: 'iron',
    x: -29.3,
    z: -3.2,
    wx: -30.55,
    wz: -3.2,
    axis: 'z',
    half: 1.15,
    planks: 4,
    maxPlanks: 6,
  },
  {
    id: 'watch-w2',
    area: 'watch',
    requires: 'iron',
    x: -29.3,
    z: 5,
    wx: -30.55,
    wz: 5,
    axis: 'z',
    half: 1.15,
    planks: 4,
    maxPlanks: 6,
  },
  {
    id: 'crypt-n',
    area: 'crypt',
    requires: 'rift',
    x: 22.8,
    z: -25.4,
    wx: 22.8,
    wz: -26.55,
    axis: 'x',
    half: 1.15,
    planks: 4,
    maxPlanks: 6,
  },
]

export const STATIONS: StationDef[] = [
  { id: 'repeater', kind: 'wall', name: 'Ash Repeater', cost: COSTS.repeater, ammoCost: COSTS.repeaterAmmo, weaponId: 'repeater', x: -9.25, z: -5.3, area: 'ash' },
  { id: 'locker', kind: 'locker', name: 'Cinder Locker', cost: COSTS.pistolAmmo, x: 9, z: 2.4, area: 'ash' },
  { id: 'tonic', kind: 'tonic', name: 'Ember Tonic', cost: COSTS.tonic, x: 6.5, z: 6.55, area: 'ash' },
  { id: 'lance', kind: 'wall', name: 'Grave Lance', cost: COSTS.lance, ammoCost: COSTS.lanceAmmo, weaponId: 'lance', requires: 'cinder', x: 28.65, z: -8.1, area: 'relay' },
  { id: 'pyre', kind: 'wall', name: 'Long Pyre', cost: COSTS.pyre, ammoCost: COSTS.pyreAmmo, weaponId: 'pyre', requires: 'iron', x: -28.65, z: -8, area: 'watch' },
  { id: 'heart', kind: 'perk', name: 'Cinder Heart', cost: COSTS.heart, perk: 'heart', requires: 'iron', x: -17.4, z: 8.3, area: 'watch' },
  { id: 'step', kind: 'perk', name: 'Ashen Step', cost: COSTS.step, perk: 'step', requires: 'rift', x: 17.4, z: -23.5, area: 'crypt' },
]

export const VAULT_SPOTS: VaultSpot[] = [
  { id: 'vault-ash', x: -6.3, z: -6.35, area: 'ash' },
  { id: 'vault-relay', x: 22.4, z: 8.35, requires: 'cinder', area: 'relay' },
  { id: 'vault-watch', x: -17.6, z: -8.35, requires: 'iron', area: 'watch' },
  { id: 'vault-crypt', x: 27.3, z: -16.6, requires: 'rift', area: 'crypt' },
]

export const BRAZIERS: { x: number; z: number }[] = [
  { x: -8.5, z: -6.3 },
  { x: 8.3, z: 5.6 },
  { x: 16.3, z: -8.5 },
  { x: 27.2, z: 8.1 },
  { x: -16.7, z: -8.4 },
  { x: -22.4, z: 8.3 },
  { x: 27.2, z: -24.1 },
]

export const OBSTACLES: Solid[] = [
  { id: 'pillar-ash', minX: -1.15, maxX: 1.15, minZ: -1.15, maxZ: 1.15, y0: 0, y1: 3.15, kind: 'obstacle', visual: true },
  { id: 'crate-a', minX: -8.3, maxX: -5.7, minZ: 4.15, maxZ: 6.85, y0: 0, y1: 1.05, kind: 'obstacle', visual: true },
  { id: 'crate-b', minX: 5.05, maxX: 7.75, minZ: -6.75, maxZ: -4.25, y0: 0, y1: 0.85, kind: 'obstacle', visual: true },
  { id: 'pill-r1', minX: 17.5, maxX: 19.45, minZ: -5.5, maxZ: -3.25, y0: 0, y1: 3.15, kind: 'obstacle', visual: true },
  { id: 'pill-r2', minX: 24.1, maxX: 26.15, minZ: 3.05, maxZ: 5.2, y0: 0, y1: 3.15, kind: 'obstacle', visual: true },
  { id: 'crate-r', minX: 15.9, maxX: 18.3, minZ: 6.4, maxZ: 8.55, y0: 0, y1: 0.95, kind: 'obstacle', visual: true },
  { id: 'rubble-w', minX: -24.7, maxX: -21.3, minZ: -1.65, maxZ: 1.65, y0: 0, y1: 1.25, kind: 'obstacle', visual: true },
  { id: 'crate-w', minX: -28.7, maxX: -26.35, minZ: 5.15, maxZ: 7.45, y0: 0, y1: 1, kind: 'obstacle', visual: true },
  { id: 'altar', minX: 20.1, maxX: 25.7, minZ: -22.3, maxZ: -18.5, y0: 0, y1: 1.15, kind: 'obstacle', visual: true },
  { id: 'pill-c', minX: 16.2, maxX: 18.05, minZ: -17.3, maxZ: -15.4, y0: 0, y1: 3.15, kind: 'obstacle', visual: true },
]

function subtractIntervals(span0: number, span1: number, holes: [number, number][]): [number, number][] {
  let parts: [number, number][] = [[span0, span1]]
  for (const [h0, h1] of holes) {
    const next: [number, number][] = []
    for (const [a, b] of parts) {
      if (h1 <= a || h0 >= b) {
        next.push([a, b])
        continue
      }
      if (h0 > a) next.push([a, Math.min(h0, b)])
      if (h1 < b) next.push([Math.max(h1, a), b])
    }
    parts = next
  }
  return parts.filter(([a, b]) => b - a > 0.04)
}

function addXRun(
  solids: Solid[],
  z0: number,
  z1: number,
  x0: number,
  x1: number,
  doors: [number, number][],
  windows: [number, number][],
) {
  for (const [a, b] of subtractIntervals(x0, x1, [...doors, ...windows])) {
    solids.push({ minX: a, maxX: b, minZ: z0, maxZ: z1, y0: 0, y1: 3.2, kind: 'wall', visual: true })
  }
  for (const [a, b] of windows) {
    solids.push({ minX: a, maxX: b, minZ: z0, maxZ: z1, y0: 0, y1: 1.02, kind: 'wall', visual: true, id: 'sill' })
    solids.push({ minX: a, maxX: b, minZ: z0, maxZ: z1, y0: 2.38, y1: 3.2, kind: 'wall', visual: true, id: 'header' })
    solids.push({ minX: a, maxX: b, minZ: z0, maxZ: z1, y0: 0, y1: 3.2, kind: 'blocker', visual: false })
  }
}

function addZRun(
  solids: Solid[],
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  doors: [number, number][],
  windows: [number, number][],
) {
  for (const [a, b] of subtractIntervals(z0, z1, [...doors, ...windows])) {
    solids.push({ minX: x0, maxX: x1, minZ: a, maxZ: b, y0: 0, y1: 3.2, kind: 'wall', visual: true })
  }
  for (const [a, b] of windows) {
    solids.push({ minX: x0, maxX: x1, minZ: a, maxZ: b, y0: 0, y1: 1.02, kind: 'wall', visual: true, id: 'sill' })
    solids.push({ minX: x0, maxX: x1, minZ: a, maxZ: b, y0: 2.38, y1: 3.2, kind: 'wall', visual: true, id: 'header' })
    solids.push({ minX: x0, maxX: x1, minZ: a, maxZ: b, y0: 0, y1: 3.2, kind: 'blocker', visual: false })
  }
}

function buildSolids(): Solid[] {
  const solids: Solid[] = []
  addXRun(solids, -8.8, -8.3, -10.8, 10.8, [], [[-6.35, -4.05], [3.45, 5.75]])
  addXRun(solids, 8.3, 8.8, -10.8, 10.8, [], [[-1.15, 1.15]])
  addZRun(solids, 10.3, 10.8, -8.8, 8.8, [[-1.55, 1.55]], [])
  addZRun(solids, -10.8, -10.3, -8.8, 8.8, [[-1.55, 1.55]], [])

  addXRun(solids, -1.95, -1.45, 10.3, 13.8, [], [])
  addXRun(solids, 1.45, 1.95, 10.3, 13.8, [], [])
  addXRun(solids, -1.95, -1.45, -13.8, -10.3, [], [])
  addXRun(solids, 1.45, 1.95, -13.8, -10.3, [], [])

  addZRun(solids, 13.3, 13.8, -11.2, 11.2, [[-1.55, 1.55]], [])
  addZRun(solids, 30.3, 30.8, -11.2, 11.2, [], [[-5.15, -2.85], [4.65, 6.95]])
  addXRun(solids, -11.2, -10.7, 13.3, 30.8, [[19.7, 23.2]], [])
  addXRun(solids, 10.7, 11.2, 13.3, 30.8, [], [])

  addZRun(solids, -13.8, -13.3, -11.2, 11.2, [[-1.55, 1.55]], [])
  addZRun(solids, -30.8, -30.3, -11.2, 11.2, [], [[-4.35, -2.05], [3.85, 6.15]])
  addXRun(solids, -11.2, -10.7, -30.8, -13.3, [], [])
  addXRun(solids, 10.7, 11.2, -30.8, -13.3, [], [])

  addZRun(solids, 19.35, 19.85, -14.2, -10.7, [], [])
  addZRun(solids, 23.05, 23.55, -14.2, -10.7, [], [])

  addXRun(solids, -14.2, -13.7, 13.3, 30.8, [[19.7, 23.2]], [])
  addXRun(solids, -26.8, -26.3, 13.3, 30.8, [], [[21.65, 23.95]])
  addZRun(solids, 13.3, 13.8, -26.8, -13.7, [], [])
  addZRun(solids, 30.3, 30.8, -26.8, -13.7, [], [])

  solids.push(...OBSTACLES)
  return solids
}

export const SOLIDS: Solid[] = buildSolids()

export function floorAt(x: number, z: number, inset = 0): FloorRect | null {
  for (const f of FLOORS) {
    if (x >= f.minX + inset && x <= f.maxX - inset && z >= f.minZ + inset && z <= f.maxZ - inset) return f
  }
  return null
}

export function insideAnyFloor(x: number, z: number, inset: number): boolean {
  return floorAt(x, z, inset) !== null
}

export function pointIn(x: number, z: number, b: AABB): boolean {
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ
}

export function circleHits(x: number, z: number, radius: number, boxes: AABB[]): boolean {
  const r2 = radius * radius
  for (const b of boxes) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX))
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ))
    const dx = x - cx
    const dz = z - cz
    if (dx * dx + dz * dz < r2) return true
  }
  return false
}

export function collisionBoxes(open: Record<DoorId, boolean>): AABB[] {
  const list: AABB[] = []
  for (const s of SOLIDS) list.push(s)
  for (const d of DOORS) if (!open[d.id]) list.push(d)
  return list
}

export function makeWalker(open: Record<DoorId, boolean>): (x: number, z: number) => boolean {
  const boxes = collisionBoxes(open)
  return (x: number, z: number) => insideAnyFloor(x, z, 0) && !circleHits(x, z, 0.28, boxes)
}

export function closedDoors(): Record<DoorId, boolean> {
  return { cinder: false, iron: false, rift: false }
}
