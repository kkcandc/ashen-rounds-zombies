import { roundCount, zombieHp, zombieSpeed, WEAPONS } from '../src/game/balance'
import { castShot, hitHusk } from '../src/game/combat'
import { createHusk, Director } from '../src/game/director'
import { buildGrid, findPath } from '../src/game/nav'
import type { FrameInput } from '../src/game/types'
import {
  BREACHES,
  circleHits,
  collisionBoxes,
  makeWalker,
  NAV_BOUNDS,
  SPAWN,
  STATIONS,
  VAULT_SPOTS,
  closedDoors,
} from '../src/game/world'

let failed = 0

function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1
    console.error('FAIL', msg)
  } else {
    console.log('ok', msg)
  }
}

function inp(partial: Partial<FrameInput> = {}): FrameInput {
  return {
    wishX: 0,
    wishZ: 0,
    sprint: false,
    shootEdge: false,
    shootHeld: false,
    aim: { x: 0, y: 0, z: -1 },
    reloadEdge: false,
    knifeEdge: false,
    interactEdge: false,
    interactHeld: false,
    cycle: 0,
    slot: null,
    ...partial,
  }
}

const openAll = { cinder: true, iron: true, rift: true }
const walkAll = makeWalker(openAll)
assert(walkAll(SPAWN.x, SPAWN.z), 'spawn is walkable')
assert(!walkAll(0, 0), 'pillar blocks the hall center')
for (const b of BREACHES) assert(walkAll(b.x, b.z), `breach walkable ${b.id}`)
for (const s of STATIONS) assert(walkAll(s.x, s.z), `station walkable ${s.id}`)
for (const v of VAULT_SPOTS) assert(walkAll(v.x, v.z), `vault walkable ${v.id}`)
assert(!circleHits(SPAWN.x, SPAWN.z, 0.34, collisionBoxes(closedDoors())), 'spawn is not inside a wall')

const shut = buildGrid(makeWalker(closedDoors()), NAV_BOUNDS, 0.5)
const blocked = findPath(shut, 0, 4, 20, 0)
assert(blocked.length === 0, 'closed Cinder Gate blocks the relay')

const opened = buildGrid(makeWalker({ cinder: true, iron: false, rift: false }), NAV_BOUNDS, 0.5)
const route = findPath(opened, 0, 4, 20, 0)
assert(route.length > 2, 'open Cinder Gate has a path into the relay')
if (route.length) {
  const last = route[route.length - 1]
  assert(Math.hypot(last.x - 20, last.z) < 2, `path ends near the relay (${last.x.toFixed(1)}, ${last.z.toFixed(1)})`)
}

const cryptShut = buildGrid(makeWalker({ cinder: true, iron: false, rift: false }), NAV_BOUNDS, 0.5)
assert(findPath(cryptShut, 20, 0, 22, -20).length === 0, 'rift seal blocks the crypt')
const cryptOpen = buildGrid(makeWalker({ cinder: true, iron: true, rift: true }), NAV_BOUNDS, 0.5)
assert(findPath(cryptOpen, 0, 4, -22, 0).length > 2, 'iron hatch path reaches the gallery')
assert(findPath(cryptOpen, 20, 0, 22, -20).length > 2, 'rift path reaches the crypt')

assert(roundCount(2) > roundCount(1), 'later rounds send more husks')
assert(roundCount(30) === 96, 'wave size caps')
assert(zombieHp(5, 'husk') > zombieHp(1, 'husk'), 'husks toughen')
assert(zombieHp(5, 'warden') > zombieHp(5, 'husk'), 'wardens are thicker')
assert(zombieHp(5, 'cinder') < zombieHp(5, 'husk'), 'cinders are frailer')
assert(zombieSpeed(8, 'cinder') > zombieSpeed(8, 'husk'), 'cinders are faster')

const chaser = new Director()
chaser.phase = 'fight'
chaser.queued = 1
const far = createHusk(-5.2, -7.4, 1, 'husk', 7)
far.attackCd = 5
chaser.husks = [far]
const startDist = Math.hypot(far.x - chaser.player.x, far.z - chaser.player.z)
for (let i = 0; i < 40; i++) chaser.update(0.1, inp())
const endDist = Math.hypot(chaser.husks[0].x - chaser.player.x, chaser.husks[0].z - chaser.player.z)
assert(endDist < startDist - 1.4, `husk closes distance ${startDist.toFixed(2)} -> ${endDist.toFixed(2)}`)

const biter = new Director()
biter.phase = 'fight'
biter.queued = 1
const onTop = createHusk(biter.player.x, biter.player.z, 1, 'husk', 3)
onTop.attackCd = 0
biter.husks = [onTop]
const before = biter.player.health
biter.update(0.05, inp())
assert(biter.player.health < before, `bite hurts (${before} -> ${biter.player.health})`)

const shooter = new Director()
shooter.perfectAim = true
shooter.queued = 0
shooter.player.x = 0
shooter.player.z = 4
const victim = createHusk(0, 0.5, 1, 'husk', 9)
victim.hp = 500
victim.maxHp = 500
shooter.husks = [victim]
const aimY = 1.7 - 1.62
const aimL = Math.hypot(0, aimY, 0.5 - 4)
for (let i = 0; i < 6; i++) {
  shooter.update(
    0.2,
    inp({
      shootEdge: true,
      aim: { x: 0, y: aimY / aimL, z: (0.5 - 4) / aimL },
    }),
  )
}
assert(shooter.player.points > 500, `hits pay points (${shooter.player.points})`)
assert(shooter.husks.length === 0 || shooter.husks[0].state === 'dying' || shooter.husks[0].hp < 500, 'pistol damages a husk')

const flop = new Director()
flop.perfectAim = true
flop.queued = 0
const doll = createHusk(0, 1, 1, 'husk', 21)
doll.hp = 500
doll.maxHp = 500
flop.husks = [doll]
flop.player.x = 0
flop.player.z = 4
const fy = 1.15 - 1.62
const fz = 1 - 4
const fl = Math.hypot(0, fy, fz)
const beforeHp = doll.hp
flop.update(0.05, inp({ shootEdge: true, aim: { x: 0, y: fy / fl, z: fz / fl } }))
assert(doll.hp < beforeHp && doll.hp >= beforeHp - 40, `body shot damage stays a pistol hit (${beforeHp} -> ${doll.hp})`)
assert(doll.flinch > 0 && doll.state !== 'dying', 'a body shot flinches the husk without killing it')

const head = hitHusk(0, 1.62, 4, 0, 0.02, -1, { x: 0, z: 0.2, scale: 1 }, 40)
assert(head != null, 'a level shot meets a husk')
const miss = hitHusk(0, 1.62, 4, 1, 0, 0, { x: 0, z: 0.2, scale: 1 }, 40)
assert(miss == null, 'a shot to the side misses')

const pellets = castShot(
  [createHusk(0, -3, 1, 'husk', 4)],
  { x: 0, y: 1.62, z: 0 },
  { x: 0, y: 0.05, z: -1 },
  { ...WEAPONS.lance, spread: 0 },
  0,
  () => 0.5,
)
assert(pellets.length >= 4, `lance pellets connect (${pellets.length})`)

const buyer = new Director()
buyer.player.points = 2000
buyer.player.x = 8.1
buyer.player.z = 0
buyer.update(0.05, inp({ aim: { x: 1, y: 0, z: 0 }, interactEdge: true }))
assert(buyer.doors.cinder, 'Cinder Gate opens when paid')
assert(buyer.player.points === 1250, 'gate spends 750')
const afterGate = buildGrid(makeWalker(buyer.doors), NAV_BOUNDS, 0.5)
assert(findPath(afterGate, 0, 4, 20, 0).length > 2, 'opened gate is pathable')

const wall = new Director()
wall.player.points = 500
wall.player.x = -7.5
wall.player.z = -5.3
wall.update(0.05, inp({ aim: { x: -1, y: 0, z: 0 }, interactEdge: true }))
assert(wall.player.heavy?.id === 'repeater', 'wall buy grants the Ash Repeater')
assert(wall.player.points === 0, 'repeater costs 500')

const poor = new Director()
poor.player.points = 10
poor.player.x = 8.1
poor.player.z = 0
poor.update(0.05, inp({ aim: { x: 1, y: 0, z: 0 }, interactEdge: true }))
assert(!poor.doors.cinder, 'a broke buyer cannot open the gate')

const pillar = new Director()
pillar.player.x = 0
pillar.player.z = 2.3
for (let i = 0; i < 30; i++) pillar.update(0.05, inp({ wishX: 0, wishZ: -1, sprint: true }))
assert(pillar.player.z > 1.35, `pillar stops the player (${pillar.player.z.toFixed(2)})`)

const tonic = new Director()
tonic.player.health = 40
tonic.player.points = 500
tonic.player.x = 6.5
tonic.player.z = 4.9
tonic.update(0.05, inp({ aim: { x: 0, y: 0, z: 1 }, interactEdge: true }))
assert(tonic.player.health === 90, `tonic heals (${tonic.player.health})`)
assert(tonic.player.tonicUsed, 'tonic is spent for the round')
tonic.update(0.05, inp({ aim: { x: 0, y: 0, z: 1 }, interactEdge: true }))
assert(tonic.player.health === 90, 'tonic does not stack')

const loop = new Director()
loop.perfectAim = true
loop.queued = 0
const last = createHusk(0, 1, 1, 'husk', 11)
loop.husks = [last]
loop.player.x = 0
loop.player.z = 4
const dy = 1.7 - 1.62
const dz = 1 - 4
const len = Math.hypot(0, dy, dz)
for (let i = 0; i < 12; i++) {
  loop.update(0.16, inp({ shootEdge: true, aim: { x: 0, y: dy / len, z: dz / len } }))
}
for (let i = 0; i < 220; i++) loop.update(0.05, inp())
assert(loop.round === 2, `clearing the wave advances the round (now ${loop.round}, phase ${loop.phase})`)

if (failed) {
  console.error(`${failed} failed`)
  process.exit(1)
}
console.log('all simulations passed')
