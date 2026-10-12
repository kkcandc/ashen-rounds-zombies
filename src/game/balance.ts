import type { Kind } from './types'

export type Report = 'pistol' | 'auto' | 'shot' | 'rifle' | 'heavy'

export type WeaponDef = {
  id: string
  name: string
  damage: number
  pellets: number
  spread: number
  rpm: number
  mag: number
  reserve: number
  reload: number
  auto: boolean
  headMult: number
  range: number
  report: Report
}

export const WEAPONS: Record<string, WeaponDef> = {
  pistol: {
    id: 'pistol',
    name: 'Cinder Pistol',
    damage: 40,
    pellets: 1,
    spread: 0.012,
    rpm: 420,
    mag: 12,
    reserve: 84,
    reload: 1.28,
    auto: false,
    headMult: 2.5,
    range: 42,
    report: 'pistol',
  },
  repeater: {
    id: 'repeater',
    name: 'Ash Repeater',
    damage: 17,
    pellets: 1,
    spread: 0.03,
    rpm: 700,
    mag: 32,
    reserve: 192,
    reload: 1.65,
    auto: true,
    headMult: 2,
    range: 36,
    report: 'auto',
  },
  lance: {
    id: 'lance',
    name: 'Grave Lance',
    damage: 18,
    pellets: 8,
    spread: 0.1,
    rpm: 72,
    mag: 6,
    reserve: 36,
    reload: 2.35,
    auto: false,
    headMult: 1.55,
    range: 15,
    report: 'shot',
  },
  pyre: {
    id: 'pyre',
    name: 'Long Pyre',
    damage: 74,
    pellets: 1,
    spread: 0.0035,
    rpm: 115,
    mag: 8,
    reserve: 48,
    reload: 2.05,
    auto: false,
    headMult: 2.5,
    range: 68,
    report: 'rifle',
  },
  carbine: {
    id: 'carbine',
    name: 'Hollow Carbine',
    damage: 24,
    pellets: 1,
    spread: 0.017,
    rpm: 540,
    mag: 30,
    reserve: 180,
    reload: 1.75,
    auto: true,
    headMult: 2.1,
    range: 44,
    report: 'auto',
  },
  splinter: {
    id: 'splinter',
    name: 'Splinter Shot',
    damage: 14,
    pellets: 6,
    spread: 0.072,
    rpm: 155,
    mag: 8,
    reserve: 40,
    reload: 2.05,
    auto: false,
    headMult: 1.6,
    range: 18,
    report: 'shot',
  },
  howl: {
    id: 'howl',
    name: 'Ember Howl',
    damage: 108,
    pellets: 1,
    spread: 0.02,
    rpm: 48,
    mag: 4,
    reserve: 20,
    reload: 2.55,
    auto: false,
    headMult: 2,
    range: 26,
    report: 'heavy',
  },
  spire: {
    id: 'spire',
    name: 'Night Spire',
    damage: 86,
    pellets: 1,
    spread: 0.0016,
    rpm: 78,
    mag: 5,
    reserve: 25,
    reload: 2.25,
    auto: false,
    headMult: 3,
    range: 76,
    report: 'rifle',
  },
  drum: {
    id: 'drum',
    name: 'Ruin Drum',
    damage: 15,
    pellets: 1,
    spread: 0.048,
    rpm: 860,
    mag: 50,
    reserve: 200,
    reload: 2.7,
    auto: true,
    headMult: 1.75,
    range: 30,
    report: 'auto',
  },
}

export const VAULT_POOL = ['repeater', 'lance', 'pyre', 'carbine', 'splinter', 'howl', 'spire', 'drum']

export const COSTS = {
  cinder: 750,
  iron: 1000,
  rift: 1250,
  repeater: 500,
  repeaterAmmo: 250,
  lance: 1200,
  lanceAmmo: 450,
  pyre: 1500,
  pyreAmmo: 550,
  pistolAmmo: 200,
  vault: 950,
  heart: 2500,
  step: 2000,
  tonic: 500,
}

export const KNIFE_DAMAGE = 115
export const EYE = 1.62
export const PLAYER_RADIUS = 0.34

export function roundCount(round: number): number {
  return Math.min(96, 6 + (round - 1) * 4)
}

export function zombieHp(round: number, kind: Kind): number {
  const base = Math.round(100 * Math.pow(1.15, round - 1))
  if (kind === 'cinder') return Math.max(40, Math.round(base * 0.62))
  if (kind === 'warden') return Math.round(base * 2.35)
  return base
}

export function zombieSpeed(round: number, kind: Kind): number {
  const base = 1.42 + Math.min(1.5, (round - 1) * 0.072)
  if (kind === 'cinder') return base * 1.42
  if (kind === 'warden') return base * 0.68
  return base
}

export function biteDamage(round: number): number {
  return 12 + round * 2
}

export function spawnInterval(round: number): number {
  return Math.max(0.22, 1.5 - (round - 1) * 0.065)
}

export function tearTime(round: number): number {
  return Math.max(0.38, 1.18 - (round - 1) * 0.042)
}

export function activeCap(round: number): number {
  return Math.min(22, 6 + round)
}

export function rollKind(round: number, rng: () => number = Math.random): Kind {
  const r = rng()
  if (round >= 6 && r < 0.09) return 'warden'
  if (round >= 3 && r < 0.22) return 'cinder'
  return 'husk'
}

export function roundSub(round: number): string {
  if (round === 1) return 'They smell the ember.'
  if (round === 5) return 'The breaches widen.'
  if (round === 10) return 'The crypt answers.'
  if (round === 15) return 'Ash learns your step.'
  if (round === 20) return 'Nothing left but embers.'
  if (round > 20 && round % 5 === 0) return 'Still standing.'
  return `${roundCount(round)} husks inbound.`
}

export function freshWeapon(id: string): { id: string; mag: number; reserve: number } {
  const d = WEAPONS[id]
  return { id, mag: d.mag, reserve: d.reserve }
}
