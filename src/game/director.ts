import {
  activeCap,
  biteDamage,
  COSTS,
  EYE,
  freshWeapon,
  KNIFE_DAMAGE,
  PLAYER_RADIUS,
  rollKind,
  roundCount,
  roundSub,
  spawnInterval,
  tearTime,
  VAULT_POOL,
  WEAPONS,
  zombieHp,
  zombieSpeed,
} from './balance'
import { castShot } from './combat'
import { buildGrid, findPath, slideMove, type Grid } from './nav'
import type { Banner, DoorId, FrameInput, GameEvent, Husk, Kind, PlayerState, Prompt } from './types'
import {
  BREACHES,
  circleHits,
  collisionBoxes,
  DOORS,
  floorAt,
  makeWalker,
  NAV_BOUNDS,
  OBSTACLES,
  pointIn,
  SPAWN,
  STATIONS,
  VAULT_SPOTS,
  type BreachDef,
  type StationDef,
} from './world'

export type BreachState = {
  def: BreachDef
  planks: number
  repair: number
  tear: number
}

const REPAIR_TIME = 0.46

export function createHusk(x: number, z: number, round: number, kind: Kind = 'husk', id = 0): Husk {
  const hp = zombieHp(round, kind)
  return {
    id,
    x,
    z,
    hp,
    maxHp: hp,
    kind,
    scale: kind === 'warden' ? 1.28 : kind === 'cinder' ? 0.9 : 1,
    speed: zombieSpeed(round, kind),
    state: 'chase',
    breachId: null,
    attackCd: 0.6,
    path: [],
    pathCd: 0,
    dead: 0,
    flash: 0,
    flinch: 0,
    flinchHead: false,
    anim: 0,
    stuck: 0,
    prevX: x,
    prevZ: z,
  }
}

/** Visual stagger only. Does not move the husk or change damage. */
function stagger(husk: Husk, head: boolean) {
  const power = head ? 0.5 : 0.42
  if (power >= husk.flinch) {
    husk.flinch = power
    husk.flinchHead = head
  }
}

function blankPlayer(): PlayerState {
  return {
    x: SPAWN.x,
    z: SPAWN.z,
    vx: 0,
    vz: 0,
    health: 100,
    maxHealth: 100,
    points: 500,
    score: 0,
    alive: true,
    pistol: freshWeapon('pistol'),
    heavy: null,
    slot: 0,
    reload: 0,
    reloadDur: 0,
    fireCd: 0,
    knifeCd: 0,
    iframes: 0,
    bloom: 0,
    perks: { heart: false, step: false },
    tonicUsed: false,
    hurt: 0,
  }
}

export class Director {
  round = 1
  phase: 'intro' | 'fight' | 'lull' = 'intro'
  phaseTime = 0
  queued = 0
  spawnTimer = 0
  husks: Husk[] = []
  player: PlayerState = blankPlayer()
  doors: Record<DoorId, boolean> = { cinder: false, iron: false, rift: false }
  breaches: BreachState[] = []
  vaultIndex = 0
  vaultSpin = 0
  vaultCooldown = 0
  vaultPending: string | null = null
  banner: Banner | null = null
  perfectAim = false
  private nextId = 1
  private events: GameEvent[] = []
  private grid: Grid
  private walker: (x: number, z: number) => boolean
  private solids: ReturnType<typeof collisionBoxes>

  constructor() {
    this.walker = makeWalker(this.doors)
    this.solids = collisionBoxes(this.doors)
    this.grid = buildGrid(this.walker, NAV_BOUNDS, 0.5)
    this.startRun()
  }

  startRun(): void {
    this.player = blankPlayer()
    this.doors = { cinder: false, iron: false, rift: false }
    this.breaches = BREACHES.map((def) => ({
      def,
      planks: def.planks,
      repair: 0,
      tear: 0,
    }))
    this.husks = []
    this.nextId = 1
    this.vaultIndex = 0
    this.vaultSpin = 0
    this.vaultCooldown = 0
    this.vaultPending = null
    this.events = []
    this.rebuildNav()
    this.beginRound(1)
  }

  remaining(): number {
    const alive = this.husks.reduce((n, h) => n + (h.state === 'dying' ? 0 : 1), 0)
    return this.queued + alive
  }

  currentWeapon() {
    if (this.player.slot === 1 && this.player.heavy) return this.player.heavy
    return this.player.pistol
  }

  weaponName(): string {
    return WEAPONS[this.currentWeapon().id].name
  }

  update(dt: number, input: FrameInput): GameEvent[] {
    this.events = []
    dt = Math.max(0, Math.min(0.05, dt))
    const p = this.player
    p.iframes = Math.max(0, p.iframes - dt)
    p.hurt = Math.max(0, p.hurt - dt)
    p.fireCd = Math.max(0, p.fireCd - dt)
    p.knifeCd = Math.max(0, p.knifeCd - dt)
    p.bloom = Math.max(0, p.bloom - dt * 1.8)
    if (this.vaultCooldown > 0) this.vaultCooldown = Math.max(0, this.vaultCooldown - dt)

    if (p.alive) {
      this.unstick()
      this.movePlayer(dt, input)
      this.tickReload(dt)
      this.tickFire(input)
      this.tickKnife(input)
      if (input.cycle) this.cycle(input.cycle)
      if (input.slot !== null) this.selectSlot(input.slot)
      if (input.interactEdge) this.interact(input)
      this.tickRepair(dt, input)
      this.tickVault(dt)
    }

    this.tickHusks(dt)
    this.tickSpawns(dt)
    this.husks = this.husks.filter((h) => !(h.state === 'dying' && h.dead > 1.2))
    this.tickPhase(dt)
    if (this.banner) this.banner.age += dt
    return this.events
  }

  private rebuildNav() {
    this.walker = makeWalker(this.doors)
    this.solids = collisionBoxes(this.doors)
    this.grid = buildGrid(this.walker, NAV_BOUNDS, 0.5)
  }

  private beginRound(n: number) {
    this.round = n
    this.queued = roundCount(n)
    this.phase = 'intro'
    this.phaseTime = 2.35
    this.spawnTimer = 0.45
    this.player.tonicUsed = false
    this.banner = { title: `ROUND ${n}`, sub: roundSub(n), age: 0, life: 2.5 }
    this.events.push({ type: 'round', round: n })
  }

  private tickPhase(dt: number) {
    if (this.phase === 'intro') {
      this.phaseTime -= dt
      if (this.phaseTime <= 0) this.phase = 'fight'
    }
    if (this.phase === 'fight') {
      const alive = this.husks.some((h) => h.state === 'chase' || h.state === 'tear')
      if (this.queued <= 0 && !alive) {
        this.phase = 'lull'
        this.phaseTime = 4.1
        const next = roundCount(this.round + 1)
        this.banner = {
          title: 'THE HALL GOES QUIET',
          sub: `Next wave brings ${next} husks.`,
          age: 0,
          life: 3.6,
        }
        this.events.push({ type: 'lull' })
      }
    }
    if (this.phase === 'lull') {
      this.phaseTime -= dt
      if (this.phaseTime <= 0) this.beginRound(this.round + 1)
    }
  }

  private movePlayer(dt: number, input: FrameInput) {
    const p = this.player
    const sprint = input.sprint
    let speed = (sprint ? 7.35 : 4.55) * (p.perks.step ? 1.2 : 1)
    if (p.reload > 0) speed *= 0.92
    const wish = Math.hypot(input.wishX, input.wishZ)
    let tx = 0
    let tz = 0
    if (wish > 0.01) {
      tx = (input.wishX / wish) * speed
      tz = (input.wishZ / wish) * speed
    }
    const k = 1 - Math.exp(-14 * dt)
    p.vx += (tx - p.vx) * k
    p.vz += (tz - p.vz) * k
    const walk = (x: number, z: number) => !circleHits(x, z, PLAYER_RADIUS, this.solids)
    const moved = slideMove(p.x, p.z, p.vx * dt, p.vz * dt, walk)
    p.x = moved.x
    p.z = moved.z
    if (wish < 0.01) {
      p.vx *= Math.exp(-10 * dt)
      p.vz *= Math.exp(-10 * dt)
    }
  }

  private unstick() {
    const p = this.player
    if (!circleHits(p.x, p.z, PLAYER_RADIUS * 0.92, this.solids)) return
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [0.7, 0.7],
      [0.7, -0.7],
      [-0.7, 0.7],
      [-0.7, -0.7],
    ]
    for (const [dx, dz] of dirs) {
      for (let s = 0.15; s <= 2.2; s += 0.15) {
        const x = p.x + dx * s
        const z = p.z + dz * s
        if (!circleHits(x, z, PLAYER_RADIUS, this.solids)) {
          p.x = x
          p.z = z
          return
        }
      }
    }
    p.x = SPAWN.x
    p.z = SPAWN.z
  }

  private tickReload(dt: number) {
    const p = this.player
    if (p.reload <= 0) return
    p.reload -= dt
    if (p.reload > 0) return
    const inst = this.currentWeapon()
    const def = WEAPONS[inst.id]
    const need = def.mag - inst.mag
    const take = Math.min(need, inst.reserve)
    inst.mag += take
    inst.reserve -= take
    p.reload = 0
    this.events.push({ type: 'reloaded' })
  }

  private startReload() {
    const p = this.player
    if (!p.alive || p.reload > 0) return
    const inst = this.currentWeapon()
    const def = WEAPONS[inst.id]
    if (inst.mag >= def.mag || inst.reserve <= 0) return
    p.reload = def.reload
    p.reloadDur = def.reload
    this.events.push({ type: 'reload' })
  }

  private tickFire(input: FrameInput) {
    const p = this.player
    const inst = this.currentWeapon()
    const def = WEAPONS[inst.id]
    const wants = def.auto ? input.shootHeld || input.shootEdge : input.shootEdge
    if (!wants) return
    if (p.reload > 0 || p.fireCd > 0) return
    if (inst.mag <= 0) {
      this.events.push({ type: 'dry' })
      this.startReload()
      return
    }
    inst.mag -= 1
    p.fireCd = 60 / def.rpm
    const moving = Math.hypot(p.vx, p.vz)
    const mul = moving > 6 ? 1.75 : moving > 2.2 ? 1.35 : 1
    p.bloom = Math.min(1, p.bloom + (def.report === 'shot' ? 0.55 : 0.28))
    const spread = this.perfectAim ? 0 : def.spread * mul
    const hits = castShot(this.husks, { x: p.x, y: EYE, z: p.z }, input.aim, def, spread)
    const grouped = new Map<number, { head: boolean; dmg: number }>()
    for (const hit of hits) {
      const prev = grouped.get(hit.id)
      if (!prev) grouped.set(hit.id, { head: hit.head, dmg: hit.dmg })
      else {
        prev.dmg += hit.dmg
        prev.head = prev.head || hit.head
      }
    }
    for (const [id, info] of grouped) {
      const husk = this.husks.find((h) => h.id === id)
      if (!husk || husk.state === 'dying') continue
      husk.hp -= info.dmg
      husk.flash = 0.14
      stagger(husk, info.head)
      if (husk.hp <= 0) {
        husk.hp = 0
        husk.state = 'dying'
        husk.dead = 0
        this.grant(info.head ? 100 : 50, info.head ? 'head' : 'kill')
        this.events.push({ type: 'kill', head: info.head })
      } else {
        this.grant(10, 'hit')
      }
    }
    this.events.push({
      type: 'shot',
      weaponId: def.id,
      hits: hits.map((h) => ({ x: h.x, y: h.y, z: h.z, head: h.head })),
    })
    if (inst.mag <= 0) this.startReload()
  }

  private tickKnife(input: FrameInput) {
    const p = this.player
    if (!input.knifeEdge || p.knifeCd > 0) return
    p.knifeCd = 0.62
    const ax = input.aim.x
    const az = input.aim.z
    const al = Math.hypot(ax, az) || 1
    let best: Husk | null = null
    let bestD = 1.85
    for (const husk of this.husks) {
      if (husk.state === 'dying') continue
      const dx = husk.x - p.x
      const dz = husk.z - p.z
      const dist = Math.hypot(dx, dz)
      if (dist > bestD || dist < 0.001) continue
      const dot = (dx / dist) * (ax / al) + (dz / dist) * (az / al)
      if (dot < 0.2) continue
      best = husk
      bestD = dist
    }
    if (!best) {
      this.events.push({ type: 'knife', hit: false, kill: false })
      return
    }
    best.hp -= KNIFE_DAMAGE
    best.flash = 0.14
    stagger(best, false)
    const kill = best.hp <= 0
    if (kill) {
      best.hp = 0
      best.state = 'dying'
      best.dead = 0
      this.grant(130, 'knife')
      this.events.push({ type: 'kill', head: false })
    } else {
      this.grant(10, 'knife')
    }
    this.events.push({ type: 'knife', hit: true, kill })
  }

  private grant(amount: number, reason: string) {
    this.player.points += amount
    this.player.score += amount
    this.events.push({ type: 'points', amount, reason })
  }

  private cycle(dir: number) {
    if (!this.player.heavy) {
      this.player.slot = 0
      return
    }
    this.player.slot = this.player.slot === 0 ? 1 : 0
    if (dir === 0) this.player.slot = 1
    this.player.reload = 0
  }

  private selectSlot(slot: 0 | 1) {
    if (slot === 1 && !this.player.heavy) return
    if (this.player.slot !== slot) this.player.reload = 0
    this.player.slot = slot
  }

  private facing(x: number, z: number, maxDist: number, aim: FrameInput['aim'], ignore?: DoorId): number | null {
    const dx = x - this.player.x
    const dz = z - this.player.z
    const dist = Math.hypot(dx, dz)
    if (dist > maxDist || dist < 0.05) return null
    const al = Math.hypot(aim.x, aim.z) || 1
    const dot = (dx / dist) * (aim.x / al) + (dz / dist) * (aim.z / al)
    if (dot < 0.52) return null
    if (!this.segmentClear(this.player.x, this.player.z, x, z, ignore)) return null
    return dist
  }

  private segmentClear(x0: number, z0: number, x1: number, z1: number, ignore?: DoorId): boolean {
    const steps = 8
    for (let i = 1; i < steps; i++) {
      const t = i / steps
      const x = x0 + (x1 - x0) * t
      const z = z0 + (z1 - z0) * t
      if (circleHits(x, z, 0.12, OBSTACLES)) return false
      for (const d of DOORS) {
        if (d.id === ignore || this.doors[d.id]) continue
        if (pointIn(x, z, d)) return false
      }
    }
    return true
  }

  aimed(input: FrameInput):
    | { kind: 'door'; door: DoorId; dist: number }
    | { kind: 'station'; station: StationDef; dist: number }
    | { kind: 'vault'; dist: number }
    | { kind: 'breach'; breach: BreachState; dist: number }
    | null {
    type Cand =
      | { kind: 'door'; door: DoorId; dist: number }
      | { kind: 'station'; station: StationDef; dist: number }
      | { kind: 'vault'; dist: number }
      | { kind: 'breach'; breach: BreachState; dist: number }
    let best: Cand | null = null
    const consider = (c: Cand) => {
      if (!best || c.dist < best.dist) best = c
    }
    for (const door of DOORS) {
      if (this.doors[door.id]) continue
      const dist = this.facing((door.minX + door.maxX) / 2, (door.minZ + door.maxZ) / 2, 2.5, input.aim, door.id)
      if (dist == null) continue
      consider({ kind: 'door', door: door.id, dist })
    }
    for (const station of STATIONS) {
      if (station.requires && !this.doors[station.requires]) continue
      const dist = this.facing(station.x, station.z, 2.25, input.aim)
      if (dist == null) continue
      consider({ kind: 'station', station, dist })
    }
    const spot = VAULT_SPOTS[this.vaultIndex]
    if (spot && (!spot.requires || this.doors[spot.requires])) {
      const dist = this.facing(spot.x, spot.z, 2.35, input.aim)
      if (dist != null) consider({ kind: 'vault', dist })
    }
    for (const breach of this.breaches) {
      if (breach.def.requires && !this.doors[breach.def.requires]) continue
      const dist = this.facing(breach.def.x, breach.def.z, 2.35, input.aim)
      if (dist == null) continue
      consider({ kind: 'breach', breach, dist })
    }
    return best
  }

  getPrompt(input: FrameInput): Prompt | null {
    if (this.vaultSpin > 0) return { text: 'The Ember Vault is choosing…', broke: false, hold: false }
    const target = this.aimed(input)
    if (!target) return null
    const pts = this.player.points
    if (target.kind === 'door') {
      const door = DOORS.find((d) => d.id === target.door)!
      const broke = pts < door.cost
      return {
        text: broke ? `${door.name}  —  need ${door.cost}` : `F   Open ${door.name}  —  ${door.cost}`,
        broke,
        hold: false,
      }
    }
    if (target.kind === 'vault') {
      if (this.vaultCooldown > 0.4) return { text: 'The Ember Vault is cold', broke: false, hold: false }
      const broke = pts < COSTS.vault
      return {
        text: broke ? `Ember Vault  —  need ${COSTS.vault}` : `F   Feed the Ember Vault  —  ${COSTS.vault}`,
        broke,
        hold: false,
      }
    }
    if (target.kind === 'breach') {
      if (target.breach.planks >= target.breach.def.maxPlanks) {
        return { text: 'Breach is braced', broke: false, hold: false }
      }
      return { text: 'Hold F   Brace the breach   +10', broke: false, hold: true }
    }
    const s = target.station
    if (s.kind === 'locker') {
      const w = this.player.pistol
      const def = WEAPONS[w.id]
      if (w.reserve >= def.reserve && w.mag >= def.mag) return { text: 'Cinder Locker is full', broke: false, hold: false }
      const broke = pts < s.cost
      return {
        text: broke ? `${s.name}  —  need ${s.cost}` : `F   Refill ${s.name}  —  ${s.cost}`,
        broke,
        hold: false,
      }
    }
    if (s.kind === 'tonic') {
      if (this.player.tonicUsed) return { text: 'The tonic sleeps until the hall is quiet', broke: false, hold: false }
      if (this.player.health >= this.player.maxHealth) return { text: 'You are already whole', broke: false, hold: false }
      const broke = pts < s.cost
      return {
        text: broke ? `${s.name}  —  need ${s.cost}` : `F   Drink ${s.name}  —  ${s.cost}`,
        broke,
        hold: false,
      }
    }
    if (s.kind === 'perk' && s.perk) {
      if (this.player.perks[s.perk]) return { text: `${s.name} already burns in you`, broke: false, hold: false }
      const broke = pts < s.cost
      return {
        text: broke ? `${s.name}  —  need ${s.cost.toLocaleString()}` : `F   Take ${s.name}  —  ${s.cost.toLocaleString()}`,
        broke,
        hold: false,
      }
    }
    if (s.kind === 'wall' && s.weaponId) {
      const owned = this.player.heavy?.id === s.weaponId
      const price = owned ? s.ammoCost ?? s.cost : s.cost
      const def = WEAPONS[s.weaponId]
      if (owned && this.player.heavy && this.player.heavy.reserve >= def.reserve && this.player.heavy.mag >= def.mag) {
        return { text: `${def.name} reserves are full`, broke: false, hold: false }
      }
      const broke = pts < price
      const verb = owned ? 'Feed' : 'Take'
      return {
        text: broke ? `${s.name}  —  need ${price}` : `F   ${verb} ${s.name}  —  ${price}`,
        broke,
        hold: false,
      }
    }
    return null
  }

  private interact(input: FrameInput) {
    const target = this.aimed(input)
    if (!target || target.kind === 'breach') return
    if (target.kind === 'door') {
      const door = DOORS.find((d) => d.id === target.door)!
      if (this.player.points < door.cost) {
        this.events.push({ type: 'deny' })
        return
      }
      this.player.points -= door.cost
      this.doors[door.id] = true
      this.rebuildNav()
      for (const h of this.husks) h.path = []
      this.events.push({ type: 'buy', label: door.name })
      return
    }
    if (target.kind === 'vault') {
      this.buyVault()
      return
    }
    this.buyStation(target.station)
  }

  private buyStation(s: StationDef) {
    const p = this.player
    if (s.kind === 'locker') {
      const def = WEAPONS.pistol
      if (p.pistol.reserve >= def.reserve && p.pistol.mag >= def.mag) {
        this.events.push({ type: 'deny' })
        return
      }
      if (p.points < s.cost) {
        this.events.push({ type: 'deny' })
        return
      }
      p.points -= s.cost
      p.pistol.mag = def.mag
      p.pistol.reserve = def.reserve
      p.slot = 0
      p.reload = 0
      this.events.push({ type: 'buy', label: s.name })
      return
    }
    if (s.kind === 'tonic') {
      if (p.tonicUsed || p.health >= p.maxHealth) {
        this.events.push({ type: 'deny' })
        return
      }
      if (p.points < s.cost) {
        this.events.push({ type: 'deny' })
        return
      }
      p.points -= s.cost
      p.tonicUsed = true
      p.health = Math.min(p.maxHealth, p.health + 50)
      this.events.push({ type: 'buy', label: s.name })
      return
    }
    if (s.kind === 'perk' && s.perk) {
      if (p.perks[s.perk]) {
        this.events.push({ type: 'deny' })
        return
      }
      if (p.points < s.cost) {
        this.events.push({ type: 'deny' })
        return
      }
      p.points -= s.cost
      p.perks[s.perk] = true
      if (s.perk === 'heart') {
        p.maxHealth = 200
        p.health = 200
      }
      this.events.push({ type: 'buy', label: s.name })
      return
    }
    if (s.kind === 'wall' && s.weaponId) {
      const def = WEAPONS[s.weaponId]
      const owned = p.heavy?.id === s.weaponId
      if (owned && p.heavy) {
        const price = s.ammoCost ?? s.cost
        if (p.heavy.reserve >= def.reserve && p.heavy.mag >= def.mag) {
          this.events.push({ type: 'deny' })
          return
        }
        if (p.points < price) {
          this.events.push({ type: 'deny' })
          return
        }
        p.points -= price
        p.heavy.mag = def.mag
        p.heavy.reserve = def.reserve
        p.slot = 1
        p.reload = 0
        this.events.push({ type: 'buy', label: `${def.name} rounds` })
        return
      }
      if (p.points < s.cost) {
        this.events.push({ type: 'deny' })
        return
      }
      p.points -= s.cost
      p.heavy = freshWeapon(s.weaponId)
      p.slot = 1
      p.reload = 0
      this.events.push({ type: 'buy', label: def.name })
    }
  }

  private buyVault() {
    const p = this.player
    if (this.vaultSpin > 0 || this.vaultCooldown > 0.35) {
      this.events.push({ type: 'deny' })
      return
    }
    if (p.points < COSTS.vault) {
      this.events.push({ type: 'deny' })
      return
    }
    p.points -= COSTS.vault
    const pool = VAULT_POOL.filter((id) => id !== p.heavy?.id)
    const roll = pool.length ? pool : VAULT_POOL
    this.vaultPending = roll[Math.floor(Math.random() * roll.length)]
    this.vaultSpin = 2.65
    this.events.push({ type: 'buy', label: 'Ember Vault' })
  }

  private tickVault(dt: number) {
    if (this.vaultSpin <= 0) return
    this.vaultSpin -= dt
    if (this.vaultSpin > 0 || !this.vaultPending) return
    const id = this.vaultPending
    this.player.heavy = freshWeapon(id)
    this.player.slot = 1
    this.player.reload = 0
    this.vaultPending = null
    this.events.push({ type: 'vault', weaponId: id })
    const unlocked = VAULT_SPOTS.map((s, i) => ({ s, i })).filter(
      (e) => e.i !== this.vaultIndex && (!e.s.requires || this.doors[e.s.requires]),
    )
    if (unlocked.length === 0) {
      this.vaultCooldown = 8
    } else {
      this.vaultIndex = unlocked[Math.floor(Math.random() * unlocked.length)].i
      this.vaultCooldown = 0.35
    }
  }

  private tickRepair(dt: number, input: FrameInput) {
    const target = this.aimed(input)
    if (!input.interactHeld || !target || target.kind !== 'breach') {
      for (const b of this.breaches) b.repair = Math.max(0, b.repair - dt * 2)
      return
    }
    const b = target.breach
    if (b.planks >= b.def.maxPlanks) return
    b.repair += dt
    if (b.repair < REPAIR_TIME) return
    b.repair = 0
    b.planks += 1
    this.grant(10, 'plank')
    this.events.push({ type: 'plank' })
  }

  private tickSpawns(dt: number) {
    if (this.phase !== 'fight' || this.queued <= 0) return
    this.spawnTimer -= dt
    if (this.spawnTimer > 0) return
    const active = this.husks.reduce((n, h) => n + (h.state === 'chase' || h.state === 'tear' ? 1 : 0), 0)
    if (active >= activeCap(this.round)) {
      this.spawnTimer = 0.2
      return
    }
    const breach = this.pickBreach()
    if (!breach) {
      this.spawnTimer = 0.25
      return
    }
    if (breach.planks > 0) {
      breach.tear = tearTime(this.round)
      this.spawnHusk(breach, 'tear')
    } else {
      this.spawnHusk(breach, 'chase')
    }
    this.queued -= 1
    this.spawnTimer = spawnInterval(this.round)
  }

  private pickBreach(): BreachState | null {
    const open = this.breaches.filter((b) => {
      if (b.def.requires && !this.doors[b.def.requires]) return false
      if (b.planks > 0 && this.husks.some((h) => h.state === 'tear' && h.breachId === b.def.id)) return false
      return true
    })
    if (!open.length) return null
    return open[Math.floor(Math.random() * open.length)]
  }

  private spawnHusk(breach: BreachState, state: 'tear' | 'chase') {
    const kind = rollKind(this.round)
    const husk = createHusk(breach.def.x, breach.def.z, this.round, kind, this.nextId++)
    husk.state = state
    husk.breachId = breach.def.id
    husk.attackCd = 0.35 + Math.random() * 0.5
    husk.anim = Math.random() * 6
    husk.pathCd = Math.random() * 0.25
    this.husks.push(husk)
  }

  private tickHusks(dt: number) {
    const p = this.player
    for (const husk of this.husks) {
      husk.flash = Math.max(0, husk.flash - dt)
      husk.flinch = Math.max(0, husk.flinch - dt)
      husk.anim += dt * (husk.state === 'tear' ? 7 : husk.speed * 3.2)
      if (husk.state === 'dying') {
        husk.dead += dt
        continue
      }
      if (husk.state === 'tear') {
        this.tryBite(husk, dt)
        const breach = this.breaches.find((b) => b.def.id === husk.breachId)
        if (!breach || breach.planks <= 0) {
          husk.state = 'chase'
          husk.path = []
        } else {
          breach.tear -= dt
          if (breach.tear <= 0) {
            breach.planks = Math.max(0, breach.planks - 1)
            breach.tear = tearTime(this.round)
            if (breach.planks <= 0) {
              husk.state = 'chase'
              husk.path = []
            }
          }
        }
        continue
      }
      this.steerHusk(husk, dt)
      if (p.alive) this.tryBite(husk, dt)
    }
  }

  private steerHusk(husk: Husk, dt: number) {
    const p = this.player
    husk.pathCd -= dt
    if (husk.pathCd <= 0 || husk.path.length === 0) {
      husk.path = findPath(this.grid, husk.x, husk.z, p.x, p.z)
      husk.pathCd = 0.32 + (husk.id % 5) * 0.05
    }
    while (husk.path.length && Math.hypot(husk.path[0].x - husk.x, husk.path[0].z - husk.z) < 0.42) {
      husk.path.shift()
    }
    let dx = p.x - husk.x
    let dz = p.z - husk.z
    if (husk.path.length) {
      dx = husk.path[0].x - husk.x
      dz = husk.path[0].z - husk.z
    }
    const len = Math.hypot(dx, dz) || 1
    let mx = (dx / len) * husk.speed
    let mz = (dz / len) * husk.speed
    for (const other of this.husks) {
      if (other === husk || other.state === 'dying' || other.state === 'tear') continue
      const ox = husk.x - other.x
      const oz = husk.z - other.z
      const d = Math.hypot(ox, oz)
      const min = 0.62 * (husk.scale + other.scale) * 0.5
      if (d > 0.001 && d < min) {
        mx += (ox / d) * (min - d) * 3.4
        mz += (oz / d) * (min - d) * 3.4
      }
    }
    const moved = slideMove(husk.x, husk.z, mx * dt, mz * dt, this.walker)
    const travel = Math.hypot(moved.x - husk.x, moved.z - husk.z)
    husk.x = moved.x
    husk.z = moved.z
    if (travel < 0.012) husk.stuck += dt
    else husk.stuck = 0
    if (husk.stuck > 0.7) {
      const nx = -(p.z - husk.z)
      const nz = p.x - husk.x
      const nl = Math.hypot(nx, nz) || 1
      const nudge = slideMove(husk.x, husk.z, (nx / nl) * 0.45, (nz / nl) * 0.45, this.walker)
      husk.x = nudge.x
      husk.z = nudge.z
      husk.stuck = 0
      husk.path = []
    }
  }

  private tryBite(husk: Husk, dt: number) {
    const p = this.player
    if (!p.alive) return
    husk.attackCd -= dt
    const dx = p.x - husk.x
    const dz = p.z - husk.z
    const dist = Math.hypot(dx, dz)
    const reach = 1.12 + husk.scale * 0.18
    if (dist > reach || husk.attackCd > 0) return
    husk.attackCd = 1.02
    this.hurt(biteDamage(this.round))
    const l = dist || 1
    p.vx += (dx / l) * 2.4
    p.vz += (dz / l) * 2.4
  }

  private hurt(amount: number) {
    const p = this.player
    if (!p.alive || p.iframes > 0) return
    p.health = Math.max(0, p.health - amount)
    p.iframes = 0.3
    p.hurt = 0.48
    this.events.push({ type: 'player-hit', amount })
    if (p.health <= 0) {
      p.alive = false
      this.events.push({ type: 'dead' })
    }
  }

  areaName(): string {
    const f = floorAt(this.player.x, this.player.z)
    if (!f) return 'Outpost'
    const labels: Record<string, string> = {
      ash: 'Ash Hall',
      hallE: 'Cinder Passage',
      relay: 'Relay Pit',
      hallW: 'Iron Passage',
      watch: 'Watch Gallery',
      hallN: 'Rift Stair',
      crypt: 'Ember Crypt',
    }
    return labels[f.id] ?? 'Outpost'
  }
}
