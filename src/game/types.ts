export type Kind = 'husk' | 'cinder' | 'warden'
export type DoorId = 'cinder' | 'iron' | 'rift'
export type AreaId = 'ash' | 'hallE' | 'relay' | 'hallW' | 'watch' | 'hallN' | 'crypt'
export type PerkId = 'heart' | 'step'

export type AABB = { minX: number; maxX: number; minZ: number; maxZ: number }

export type Vec3 = { x: number; y: number; z: number }

export type WeaponInst = { id: string; mag: number; reserve: number }

export type HuskState = 'tear' | 'chase' | 'dying'

export type Husk = {
  id: number
  x: number
  z: number
  hp: number
  maxHp: number
  kind: Kind
  scale: number
  speed: number
  state: HuskState
  breachId: string | null
  attackCd: number
  path: { x: number; z: number }[]
  pathCd: number
  dead: number
  flash: number
  /** Seconds of impact lean left. Visual only — movement and damage ignore it. */
  flinch: number
  flinchHead: boolean
  anim: number
  stuck: number
  prevX: number
  prevZ: number
}

export type PlayerState = {
  x: number
  z: number
  vx: number
  vz: number
  health: number
  maxHealth: number
  points: number
  score: number
  alive: boolean
  pistol: WeaponInst
  heavy: WeaponInst | null
  slot: 0 | 1
  reload: number
  reloadDur: number
  fireCd: number
  knifeCd: number
  iframes: number
  bloom: number
  perks: { heart: boolean; step: boolean }
  tonicUsed: boolean
  hurt: number
}

export type FrameInput = {
  wishX: number
  wishZ: number
  sprint: boolean
  shootEdge: boolean
  shootHeld: boolean
  aim: Vec3
  reloadEdge: boolean
  knifeEdge: boolean
  interactEdge: boolean
  interactHeld: boolean
  cycle: number
  slot: 0 | 1 | null
}

export type GameEvent =
  | { type: 'shot'; weaponId: string; hits: { x: number; y: number; z: number; head: boolean }[] }
  | { type: 'dry' }
  | { type: 'reload' }
  | { type: 'knife'; hit: boolean; kill: boolean }
  | { type: 'points'; amount: number; reason: string }
  | { type: 'buy'; label: string }
  | { type: 'deny' }
  | { type: 'player-hit'; amount: number }
  | { type: 'round'; round: number }
  | { type: 'lull' }
  | { type: 'dead' }
  | { type: 'plank' }
  | { type: 'vault'; weaponId: string }
  | { type: 'kill'; head: boolean }

export type Banner = { title: string; sub: string; age: number; life: number }

export type Prompt = { text: string; broke: boolean; hold: boolean }
