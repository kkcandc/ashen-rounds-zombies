import * as THREE from 'three'
import { WEAPONS } from './balance'
import { createGuns, createHuskMesh, paintHusk, type HuskMesh } from './actors'
import { Sfx } from './audio'
import { Director } from './director'
import { buildScenery } from './scenery'
import type { FrameInput, Husk } from './types'
import { DOORS, SPAWN, VAULT_SPOTS } from './world'

const BEST_R = 'ashen-rounds-best-round'
const BEST_S = 'ashen-rounds-best-score'

export type Mode = 'menu' | 'play' | 'pause' | 'dead'

export class Game {
  mode: Mode = 'menu'
  readonly director = new Director()
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(76, 1, 0.08, 80)
  private readonly clock = new THREE.Clock()
  private readonly sfx = new Sfx()
  private readonly scenery: ReturnType<typeof buildScenery>
  private readonly pool: HuskMesh[] = []
  private readonly guns: Record<string, THREE.Group>
  private readonly gunRoot = new THREE.Group()
  private readonly flash: THREE.SpotLight
  private readonly sparks: THREE.Points
  private readonly sparkPos: Float32Array
  private readonly sparkVel: Float32Array
  private readonly sparkLife: Float32Array
  private yaw = 0
  private pitch = 0
  private bob = 0
  private recoil = 0
  private kick = 0
  private foot = 0
  private groan = 2
  private idle = 0
  private vaultTick = 0
  private readonly keys = new Set<string>()
  private shooting = false
  private edges = { reload: false, knife: false, interact: false, shoot: false, cycle: 0, slot: null as 0 | 1 | null }
  private readonly text = new Map<string, string>()
  private readonly onLock: () => void
  private running = true

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15
    this.renderer.setClearColor(0x120f0c)

    this.scene.background = new THREE.Color(0x161310)
    this.scene.fog = new THREE.FogExp2(0x1a1612, 0.012)
    this.scene.add(new THREE.AmbientLight(0xb3a898, 0.72))
    const hemi = new THREE.HemisphereLight(0xb7c4d4, 0x5c4030, 0.55)
    this.scene.add(hemi)
    const moon = new THREE.DirectionalLight(0xfff0dd, 0.95)
    moon.position.set(12, 18, 8)
    this.scene.add(moon)

    this.scenery = buildScenery(this.scene)
    for (let i = 0; i < 36; i++) {
      const mesh = createHuskMesh()
      this.scene.add(mesh.group)
      this.pool.push(mesh)
    }

    this.guns = createGuns()
    for (const gun of Object.values(this.guns)) this.gunRoot.add(gun)
    this.gunRoot.position.set(0.34, -0.22, -0.46)
    this.gunRoot.scale.setScalar(1.45)
    this.camera.add(this.gunRoot)

    this.flash = new THREE.SpotLight(0xfff1dc, 36, 32, 0.7, 0.45, 1.15)
    this.flash.position.set(0.04, -0.02, 0.05)
    this.flash.target.position.set(0, 0, -1)
    this.camera.add(this.flash)
    this.camera.add(this.flash.target)
    const lamp = new THREE.PointLight(0xffe2c2, 7, 12, 1.5)
    this.camera.add(lamp)
    this.scene.add(this.camera)

    this.sparkLife = new Float32Array(72)
    this.sparkVel = new Float32Array(72 * 3)
    this.sparkPos = new Float32Array(72 * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3))
    this.sparks = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xff8a3a, size: 0.07, transparent: true, opacity: 0.9, depthWrite: false }),
    )
    this.scene.add(this.sparks)

    this.resize()
    window.addEventListener('resize', () => this.resize())
    window.addEventListener('keydown', (e) => this.onKey(e, true))
    window.addEventListener('keyup', (e) => this.onKey(e, false))
    window.addEventListener('mousemove', (e) => this.onMouse(e))
    window.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return
      if (this.mode === 'play' && document.pointerLockElement === this.canvas) this.edges.shoot = true
      this.shooting = true
    })
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.shooting = false
    })
    window.addEventListener('wheel', (e) => {
      if (this.mode !== 'play') return
      this.edges.cycle += e.deltaY > 0 ? 1 : -1
    }, { passive: true })
    window.addEventListener('blur', () => {
      if (this.mode === 'play') this.pause()
    })
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    canvas.addEventListener('mousedown', () => {
      if (this.mode === 'play' && document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock()
    })
    this.onLock = () => {
      if (!document.pointerLockElement && this.mode === 'play') this.pause()
    }
    document.addEventListener('pointerlockchange', this.onLock)

    document.getElementById('play-btn')?.addEventListener('click', () => this.begin())
    document.getElementById('resume-btn')?.addEventListener('click', () => this.resume())
    document.getElementById('restart-btn')?.addEventListener('click', () => this.restart())
    document.getElementById('again-btn')?.addEventListener('click', () => this.restart())
    document.getElementById('menu-btn')?.addEventListener('click', () => this.toMenu())

    this.refreshBest()
    this.applyMode()
    this.renderer.setAnimationLoop(() => this.frame())
    if (location.hash === '#debug') {
      ;(window as unknown as { __ashen: Game }).__ashen = this
    }
  }

  debug() {
    const d = this.director
    return {
      x: d.player.x,
      z: d.player.z,
      health: d.player.health,
      points: d.player.points,
      score: d.player.score,
      round: d.round,
      phase: d.phase,
      heavy: d.player.heavy?.id ?? null,
      doors: { ...d.doors },
      perks: { ...d.player.perks },
      husks: d.husks.map((h) => ({
        x: h.x,
        z: h.z,
        hp: h.hp,
        state: h.state,
        kind: h.kind,
      })),
    }
  }

  /** Point the view at a floor position. Used by the local playtest hook. */
  face(x: number, z: number) {
    const dx = x - this.director.player.x
    const dz = z - this.director.player.z
    this.yaw = Math.atan2(-dx, -dz)
    this.pitch = 0.02
  }

  moveTo(x: number, z: number) {
    this.director.player.x = x
    this.director.player.z = z
    this.director.player.vx = 0
    this.director.player.vz = 0
  }

  private resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / Math.max(1, h)
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    if (down && e.repeat && (e.code === 'KeyF' || e.code === 'KeyE' || e.code === 'KeyR' || e.code === 'KeyV')) return
    if (down) this.keys.add(e.code)
    else this.keys.delete(e.code)
    if (down && e.code === 'Escape' && this.mode === 'play') this.pause()
    if (!down || this.mode !== 'play') return
    if (e.code === 'KeyR') this.edges.reload = true
    if (e.code === 'KeyV') this.edges.knife = true
    if (e.code === 'KeyF' || e.code === 'KeyE') this.edges.interact = true
    if (e.code === 'KeyQ') this.edges.cycle -= 1
    if (e.code === 'Digit1') this.edges.slot = 0
    if (e.code === 'Digit2') this.edges.slot = 1
  }

  private onMouse(e: MouseEvent) {
    if (this.mode !== 'play' || document.pointerLockElement !== this.canvas) return
    this.yaw -= e.movementX * 0.00215
    this.pitch += e.movementY * 0.00215
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch))
  }

  begin() {
    this.sfx.resume()
    this.director.startRun()
    this.sfx.round()
    this.yaw = 0
    this.pitch = 0
    this.mode = 'play'
    this.applyMode()
    this.canvas.requestPointerLock()
  }

  resume() {
    if (this.mode !== 'pause') return
    this.sfx.resume()
    this.mode = 'play'
    this.shooting = false
    this.applyMode()
    this.canvas.requestPointerLock()
  }

  pause() {
    if (this.mode !== 'play') return
    this.mode = 'pause'
    this.shooting = false
    this.keys.clear()
    this.applyMode()
  }

  restart() {
    this.sfx.resume()
    this.director.startRun()
    this.sfx.round()
    this.yaw = 0
    this.pitch = 0
    this.mode = 'play'
    this.applyMode()
    this.canvas.requestPointerLock()
  }

  toMenu() {
    this.mode = 'menu'
    if (document.pointerLockElement) document.exitPointerLock()
    this.refreshBest()
    this.applyMode()
  }

  private applyMode() {
    const show = (id: string, on: boolean) => document.getElementById(id)?.classList.toggle('hidden', !on)
    show('menu', this.mode === 'menu')
    show('pause', this.mode === 'pause')
    show('death', this.mode === 'dead')
    show('hud', this.mode === 'play' || this.mode === 'pause' || this.mode === 'dead')
    if (this.mode !== 'play') {
      document.getElementById('banner')?.classList.add('hidden')
      document.getElementById('prompt')?.classList.add('hidden')
    }
  }

  private frame() {
    if (!this.running) return
    const dt = Math.min(0.05, this.clock.getDelta())
    if (this.mode === 'menu') {
      this.idle += dt
      this.camera.position.set(SPAWN.x, 1.62, SPAWN.z)
      this.camera.rotation.order = 'YXZ'
      this.camera.rotation.y = Math.sin(this.idle * 0.28) * 0.42
      this.camera.rotation.x = -0.06
      this.gunRoot.visible = false
      this.syncWorld(dt, false)
      this.renderer.render(this.scene, this.camera)
      return
    }

    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.y = this.yaw
    this.camera.rotation.x = this.pitch + this.recoil
    this.recoil *= Math.exp(-8 * dt)

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion)
    forward.y = 0
    right.y = 0
    if (forward.lengthSq() > 0) forward.normalize()
    if (right.lengthSq() > 0) right.normalize()

    let wishX = 0
    let wishZ = 0
    if (this.mode === 'play') {
      const f = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0)
      const s = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0)
      wishX = forward.x * f + right.x * s
      wishZ = forward.z * f + right.z * s
    }
    const aim = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion)
    const input: FrameInput = {
      wishX,
      wishZ,
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      shootEdge: this.edges.shoot,
      shootHeld: this.shooting && this.mode === 'play' && document.pointerLockElement === this.canvas,
      aim: { x: aim.x, y: aim.y, z: aim.z },
      reloadEdge: this.edges.reload,
      knifeEdge: this.edges.knife,
      interactEdge: this.edges.interact,
      interactHeld: this.mode === 'play' && (this.keys.has('KeyF') || this.keys.has('KeyE')),
      cycle: this.edges.cycle,
      slot: this.edges.slot,
    }
    this.edges = { reload: false, knife: false, interact: false, shoot: false, cycle: 0, slot: null }

    if (this.mode === 'play') {
      const events = this.director.update(dt, input)
      this.consume(events)
    }

    const p = this.director.player
    const speed = Math.hypot(p.vx, p.vz)
    this.bob += dt * Math.max(1.2, speed) * 1.7
    const bobY = this.mode === 'play' ? Math.sin(this.bob) * Math.min(0.045, speed * 0.007) : 0
    this.camera.position.set(p.x, 1.62 + bobY, p.z)
    this.gunRoot.visible = this.mode !== 'dead'
    this.kick = Math.max(0, this.kick - dt * 8)
    this.gunRoot.position.z = -0.52 - this.kick * 0.08
    this.gunRoot.position.y = -0.26 + Math.sin(this.bob * 2) * Math.min(0.012, speed * 0.002)
    this.gunRoot.rotation.x = this.kick * 0.18 + (this.director.player.reload > 0 ? 0.25 : 0)

    if (this.mode === 'play' && speed > 2.2) {
      this.foot -= dt
      if (this.foot <= 0) {
        this.sfx.step()
        this.foot = this.keys.has('ShiftLeft') ? 0.32 : 0.46
      }
    }

    this.syncWorld(dt, true)
    this.drawHud(input)
    this.renderer.render(this.scene, this.camera)
  }

  private consume(events: ReturnType<Director['update']>) {
    for (const e of events) {
      if (e.type === 'shot') {
        const def = WEAPONS[e.weaponId]
        this.sfx.shot(def.report)
        this.kick = Math.min(1, this.kick + (def.report === 'shot' || def.report === 'heavy' ? 0.85 : 0.45))
        this.recoil = Math.min(0.08, this.recoil + (def.report === 'rifle' ? 0.03 : 0.012))
        this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch + (def.report === 'rifle' ? 0.012 : 0.004)))
        for (const hit of e.hits) this.burst(hit.x, hit.y, hit.z)
        const marker = document.getElementById('hitmarker')
        if (marker && e.hits.length) {
          marker.classList.toggle('head', e.hits.some((h) => h.head))
          marker.classList.add('show')
          window.setTimeout(() => marker.classList.remove('show'), 70)
        }
        if (e.hits.length) this.sfx.hit(e.hits.some((h) => h.head))
      } else if (e.type === 'dry') this.sfx.dry()
      else if (e.type === 'reload') this.sfx.reload()
      else if (e.type === 'player-hit') {
        this.sfx.hurt()
        this.recoil += 0.02
      } else if (e.type === 'buy') this.sfx.buy()
      else if (e.type === 'deny') this.sfx.deny()
      else if (e.type === 'round') this.sfx.round()
      else if (e.type === 'lull') this.sfx.lull()
      else if (e.type === 'plank') this.sfx.plank()
      else if (e.type === 'knife') this.sfx.knife(e.hit)
      else if (e.type === 'vault') this.sfx.vault()
      else if (e.type === 'points') this.floater(`+${e.amount}`)
      else if (e.type === 'dead') this.onDeath()
    }
  }

  private onDeath() {
    this.mode = 'dead'
    this.shooting = false
    this.sfx.dead()
    if (document.pointerLockElement) document.exitPointerLock()
    const round = this.director.round
    const score = this.director.player.score
    let bestR = 0
    let bestS = 0
    try {
      bestR = Number(localStorage.getItem(BEST_R) || 0)
      bestS = Number(localStorage.getItem(BEST_S) || 0)
      if (round > bestR || (round === bestR && score > bestS)) {
        localStorage.setItem(BEST_R, String(round))
        localStorage.setItem(BEST_S, String(score))
        bestR = round
        bestS = score
      }
    } catch {
      /* private mode */
    }
    this.setText('death-round', `Round ${round}`)
    this.setText('death-score', `Score ${score.toLocaleString()}`)
    this.setText('death-best', bestR ? `Best round ${bestR}  ·  ${bestS.toLocaleString()}` : '')
    this.applyMode()
  }

  private refreshBest() {
    let line = 'No record yet. The bunker is patient.'
    try {
      const r = Number(localStorage.getItem(BEST_R) || 0)
      const s = Number(localStorage.getItem(BEST_S) || 0)
      if (r) line = `Best round ${r}  ·  score ${s.toLocaleString()}`
    } catch {
      line = ''
    }
    this.setText('menu-best', line)
  }

  private floater(text: string) {
    const host = document.getElementById('floaters')
    if (!host) return
    const el = document.createElement('div')
    el.className = 'floater'
    el.textContent = text
    host.appendChild(el)
    window.setTimeout(() => el.remove(), 700)
  }

  private syncWorld(dt: number, live: boolean) {
    const t = performance.now() * 0.001
    this.scenery.braziers.forEach((light, i) => {
      light.intensity = 16 + Math.sin(t * 9 + i * 2) * 1.4 + Math.sin(t * 21 + i) * 0.8
    })
    const dust = this.scenery.dust.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < dust.count; i++) {
      let y = dust.getY(i) + dt * 0.08
      if (y > 2.8) y = 0.3
      dust.setY(i, y)
    }
    dust.needsUpdate = true

    for (const door of this.scenery.doors) {
      const open = this.director.doors[door.id]
      const base = DOORS.find((d) => d.id === door.id)!
      const tx = (base.minX + base.maxX) / 2 + (open ? door.slide.x : 0)
      const tz = (base.minZ + base.maxZ) / 2 + (open ? door.slide.z : 0)
      door.mesh.position.x += (tx - door.mesh.position.x) * Math.min(1, dt * 8)
      door.mesh.position.z += (tz - door.mesh.position.z) * Math.min(1, dt * 8)
    }

    for (const plank of this.scenery.planks) {
      const breach = this.director.breaches.find((b) => b.def.id === plank.breachId)
      const count = breach?.planks ?? 0
      plank.meshes.forEach((mesh, i) => {
        mesh.visible = i < count
      })
    }

    const spot = VAULT_SPOTS[this.director.vaultIndex]
    if (spot) {
      const v = this.scenery.vault
      v.position.x += (spot.x - v.position.x) * Math.min(1, dt * 6)
      v.position.z += (spot.z - v.position.z) * Math.min(1, dt * 6)
      if (this.director.vaultSpin > 0) v.rotation.y += dt * 2.4
      const seam = v.getObjectByName('seam') as THREE.Mesh | undefined
      const mat = seam?.material as THREE.MeshStandardMaterial | undefined
      if (mat) mat.emissiveIntensity = this.director.vaultSpin > 0 ? 4 : 1.3
    }

    const tonic = this.scenery.stations.get('tonic')?.getObjectByName('glow') as THREE.Mesh | undefined
    const tonicMat = tonic?.material as THREE.MeshStandardMaterial | undefined
    if (tonicMat) tonicMat.emissiveIntensity = this.director.player.tonicUsed ? 0.05 : 0.8
    for (const id of ['heart', 'step'] as const) {
      const glow = this.scenery.stations.get(id)?.getObjectByName('glow') as THREE.Mesh | undefined
      const mat = glow?.material as THREE.MeshStandardMaterial | undefined
      if (mat) mat.emissiveIntensity = this.director.player.perks[id] ? 0.25 : 1.8
    }

    const active = new Set<number>()
    this.director.husks.forEach((husk, index) => {
      const mesh = this.pool[index]
      if (!mesh) return
      active.add(index)
      this.poseHusk(mesh, husk)
    })
    this.pool.forEach((mesh, i) => {
      if (!active.has(i)) mesh.group.visible = false
    })

    const weaponId = this.director.currentWeapon().id
    for (const [id, gun] of Object.entries(this.guns)) gun.visible = id === weaponId && this.gunRoot.visible

    for (let i = 0; i < this.sparkLife.length; i++) {
      if (this.sparkLife[i] <= 0) {
        this.sparkPos[i * 3 + 1] = -10
        continue
      }
      this.sparkLife[i] -= dt
      this.sparkPos[i * 3] += this.sparkVel[i * 3] * dt
      this.sparkPos[i * 3 + 1] += this.sparkVel[i * 3 + 1] * dt
      this.sparkPos[i * 3 + 2] += this.sparkVel[i * 3 + 2] * dt
      this.sparkVel[i * 3 + 1] -= dt * 2.2
    }
    ;(this.sparks.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true

    if (live && this.mode === 'play') {
      this.groan -= dt
      if (this.groan <= 0 && this.director.husks.length) {
        this.sfx.groan()
        this.groan = 1.6 + Math.random() * 2.4
      }
      const last = this.director.phase === 'fight' && this.director.remaining() === 1
      this.sfx.mood(this.director.round, last, this.director.player.hurt > 0)
      if (this.director.vaultSpin > 0) {
        this.vaultTick -= dt
        if (this.vaultTick <= 0) {
          this.sfx.blip()
          this.vaultTick = 0.18
        }
      }
    }
  }

  private poseHusk(mesh: HuskMesh, husk: Husk) {
    mesh.group.visible = true
    paintHusk(mesh, husk.kind)
    mesh.group.position.set(husk.x, 0, husk.z)
    mesh.group.scale.setScalar(husk.scale)
    const dx = husk.x - husk.prevX
    const dz = husk.z - husk.prevZ
    if (husk.state === 'chase' && dx * dx + dz * dz > 0.00001) {
      mesh.group.rotation.y = Math.atan2(-dx, -dz)
    } else if (husk.state === 'tear') {
      const b = this.director.breaches.find((br) => br.def.id === husk.breachId)
      if (b) mesh.group.rotation.y = Math.atan2(-(b.def.wx - husk.x), -(b.def.wz - husk.z))
    }
    husk.prevX = husk.x
    husk.prevZ = husk.z
    const swing = Math.sin(husk.anim)
    const tearing = husk.state === 'tear'
    mesh.armL.rotation.x = tearing ? -1.1 + swing * 0.25 : swing * 0.7
    mesh.armR.rotation.x = tearing ? -1.1 - swing * 0.25 : -swing * 0.7
    mesh.legL.rotation.x = tearing ? 0 : swing * 0.6
    mesh.legR.rotation.x = tearing ? 0 : -swing * 0.6
    if (husk.state === 'dying') {
      mesh.group.rotation.x = Math.min(1.25, husk.dead * 2)
      mesh.group.position.y = -husk.dead * 0.35
    } else {
      mesh.group.rotation.x = 0
      mesh.group.position.y = 0
    }
    const hot = husk.flash > 0
    mesh.skin.emissive.setHex(hot ? 0xffe2c4 : husk.kind === 'cinder' ? 0x441608 : 0x000000)
    mesh.skin.emissiveIntensity = hot ? 0.8 : husk.kind === 'cinder' ? 0.35 : 0
  }

  private burst(x: number, y: number, z: number) {
    for (let n = 0; n < 4; n++) {
      let slot = -1
      for (let i = 0; i < this.sparkLife.length; i++) {
        if (this.sparkLife[i] <= 0) {
          slot = i
          break
        }
      }
      if (slot < 0) return
      this.sparkLife[slot] = 0.25 + Math.random() * 0.2
      this.sparkPos[slot * 3] = x
      this.sparkPos[slot * 3 + 1] = y
      this.sparkPos[slot * 3 + 2] = z
      this.sparkVel[slot * 3] = (Math.random() - 0.5) * 2.4
      this.sparkVel[slot * 3 + 1] = Math.random() * 1.8
      this.sparkVel[slot * 3 + 2] = (Math.random() - 0.5) * 2.4
    }
  }

  private drawHud(input: FrameInput) {
    if (this.mode === 'menu') return
    const d = this.director
    const p = d.player
    const gun = d.currentWeapon()
    const def = WEAPONS[gun.id]
    this.setText('points', p.points.toLocaleString())
    this.setText('score-line', `Score ${p.score.toLocaleString()}`)
    this.setText('hp-text', `${Math.ceil(p.health)} / ${p.maxHealth}`)
    this.setText('round-line', `Round ${d.round}`)
    const left = d.remaining()
    this.setText('left-line', left === 1 && d.phase === 'fight' ? 'Last husk' : `${left} husks`)
    this.setText('gun-name', def.name)
    this.setText('ammo', `${gun.mag}  /  ${gun.reserve}`)
    this.setText('area-name', d.areaName())
    const perks = [p.perks.heart ? 'HEART' : '', p.perks.step ? 'STEP' : ''].filter(Boolean).join('   ')
    this.setText('perks', perks || '—')
    const hp = document.getElementById('hp-fill')
    if (hp) {
      hp.style.width = `${Math.max(0, (p.health / p.maxHealth) * 100)}%`
      hp.classList.toggle('low', p.health / p.maxHealth < 0.35)
    }
    const reload = document.getElementById('reload-fill')
    if (reload) {
      const ratio = p.reload > 0 && p.reloadDur > 0 ? 1 - p.reload / p.reloadDur : 0
      reload.style.width = `${ratio * 100}%`
    }
    const cross = document.getElementById('crosshair') as HTMLElement | null
    if (cross) cross.style.setProperty('--gap', `${8 + p.bloom * 16 + (Math.hypot(p.vx, p.vz) > 5 ? 4 : 0)}px`)
    const hurt = document.getElementById('hurt')
    if (hurt) {
      const low = p.health / p.maxHealth < 0.3 ? 0.28 : 0
      hurt.style.opacity = String(Math.max(low, p.hurt > 0 ? 0.55 : 0))
    }
    const prompt = this.mode === 'play' ? d.getPrompt(input) : null
    const promptEl = document.getElementById('prompt')
    if (promptEl) {
      promptEl.classList.toggle('hidden', !prompt)
      promptEl.classList.toggle('broke', !!prompt?.broke)
      if (prompt) promptEl.textContent = prompt.text
    }
    const banner = d.banner
    const bannerEl = document.getElementById('banner')
    if (bannerEl) {
      const show = this.mode === 'play' && !!banner && banner.age < banner.life
      bannerEl.classList.toggle('hidden', !show)
      if (show && banner) {
        this.setText('banner-title', banner.title)
        this.setText('banner-sub', banner.sub)
      }
    }
    this.drawMap()
  }

  private drawMap() {
    const canvas = document.getElementById('minimap') as HTMLCanvasElement | null
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(12, 10, 8, 0.82)'
    ctx.fillRect(0, 0, w, h)
    const X0 = -32
    const X1 = 32
    const Z0 = -28
    const Z1 = 12
    const px = (x: number) => ((x - X0) / (X1 - X0)) * w
    const py = (z: number) => ((z - Z0) / (Z1 - Z0)) * h
    const rooms = [
      { x0: -10.3, x1: 10.3, z0: -8.3, z1: 8.3, open: true },
      { x0: 10.3, x1: 30.3, z0: -10.7, z1: 10.7, open: this.director.doors.cinder },
      { x0: -30.3, x1: -10.3, z0: -10.7, z1: 10.7, open: this.director.doors.iron },
      { x0: 13.8, x1: 30.3, z0: -26.3, z1: -14.2, open: this.director.doors.rift },
    ]
    for (const r of rooms) {
      ctx.fillStyle = r.open ? 'rgba(196, 176, 150, 0.28)' : 'rgba(90, 70, 58, 0.18)'
      ctx.fillRect(px(r.x0), py(r.z0), px(r.x1) - px(r.x0), py(r.z1) - py(r.z0))
    }
    ctx.strokeStyle = '#c47a45'
    ctx.lineWidth = 2
    for (const door of DOORS) {
      if (this.director.doors[door.id]) continue
      ctx.strokeRect(px(door.minX), py(door.minZ), Math.max(3, px(door.maxX) - px(door.minX)), Math.max(3, py(door.maxZ) - py(door.minZ)))
    }
    const spot = VAULT_SPOTS[this.director.vaultIndex]
    ctx.fillStyle = '#ffb15a'
    ctx.beginPath()
    ctx.arc(px(spot.x), py(spot.z), 3.5, 0, Math.PI * 2)
    ctx.fill()
    for (const husk of this.director.husks) {
      if (husk.state === 'dying') continue
      ctx.fillStyle = husk.kind === 'cinder' ? '#ff6a2a' : husk.kind === 'warden' ? '#d7c4a5' : '#c4473a'
      ctx.fillRect(px(husk.x) - 1.5, py(husk.z) - 1.5, 3, 3)
    }
    const p = this.director.player
    ctx.save()
    ctx.translate(px(p.x), py(p.z))
    ctx.rotate(this.yaw)
    ctx.fillStyle = '#f3eadc'
    ctx.beginPath()
    ctx.moveTo(0, -6)
    ctx.lineTo(4, 5)
    ctx.lineTo(-4, 5)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  private setText(id: string, value: string) {
    if (this.text.get(id) === value) return
    this.text.set(id, value)
    const el = document.getElementById(id)
    if (el) el.textContent = value
  }

  dispose() {
    this.running = false
    this.renderer.setAnimationLoop(null)
    document.removeEventListener('pointerlockchange', this.onLock)
  }
}
