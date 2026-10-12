import * as THREE from 'three'
import { WEAPONS } from './balance'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { createHuskMesh, createViewmodel, fadeHusk, paintHusk, type HuskMesh } from './actors'
import { Sfx } from './audio'
import { Director } from './director'
import { Juice, bunkerImpact } from './fx'
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
  private readonly armsPistol: THREE.Group
  private readonly armsRifle: THREE.Group
  private readonly gunRoot = new THREE.Group()
  private readonly flash: THREE.SpotLight
  private readonly juice: Juice
  private readonly composer: EffectComposer
  private readonly bloom: UnrealBloomPass
  private readonly moon: THREE.DirectionalLight
  private muzzleLeft = 0
  private readonly muzzleWorld = new THREE.Vector3()
  private readonly aimWorld = new THREE.Vector3()
  private yaw = 0
  private pitch = 0
  private bob = 0
  private recoil = 0
  private kick = 0
  private shake = 0
  private shakeMag = 0
  private shakeSeed = 0
  private markerToken = 0
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 2.2
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.setClearColor(0x241e19)

    this.scene.background = new THREE.Color(0x3a312a)
    this.scene.fog = new THREE.FogExp2(0x51463c, 0.016)
    this.scene.add(new THREE.AmbientLight(0xa89888, 0.34))
    const hemi = new THREE.HemisphereLight(0xa8bdd4, 0x6a3a22, 0.62)
    this.scene.add(hemi)
    this.moon = new THREE.DirectionalLight(0xd5e2f2, 0.55)
    this.moon.position.set(8, 14, 6)
    this.moon.castShadow = true
    this.moon.shadow.mapSize.set(1024, 1024)
    this.moon.shadow.bias = -0.001
    this.moon.shadow.camera.near = 0.5
    this.moon.shadow.camera.far = 32
    const shadowCam = this.moon.shadow.camera as THREE.OrthographicCamera
    shadowCam.left = -12
    shadowCam.right = 12
    shadowCam.top = 12
    shadowCam.bottom = -12
    this.scene.add(this.moon)
    this.scene.add(this.moon.target)

    this.scenery = buildScenery(this.scene)
    for (let i = 0; i < 36; i++) {
      const mesh = createHuskMesh()
      this.scene.add(mesh.group)
      this.pool.push(mesh)
    }

    const view = createViewmodel()
    this.guns = view.guns
    this.armsPistol = view.armsPistol
    this.armsRifle = view.armsRifle
    for (const gun of Object.values(this.guns)) this.gunRoot.add(gun)
    this.gunRoot.add(this.armsPistol, this.armsRifle)
    this.gunRoot.position.set(0.2, -0.16, -0.5)
    this.gunRoot.scale.setScalar(1.5)
    this.camera.add(this.gunRoot)

    this.flash = new THREE.SpotLight(0xfff1dc, 0, 26, 0.5, 0.35, 1)
    this.flash.position.set(0.12, -0.08, -0.2)
    this.flash.target.position.set(0, -0.04, -1)
    this.camera.add(this.flash)
    this.camera.add(this.flash.target)
    const lamp = new THREE.PointLight(0xffd7b0, 8, 12, 2)
    lamp.position.set(0, 0, 0.1)
    this.camera.add(lamp)
    this.scene.add(this.camera)
    this.juice = new Juice(this.scene)

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth * 0.6, window.innerHeight * 0.6), 0.22, 0.38, 0.82)
    this.composer.addPass(this.bloom)
    this.composer.addPass(
      new ShaderPass({
        uniforms: { tDiffuse: { value: null } },
        vertexShader:
          'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `
          uniform sampler2D tDiffuse;
          varying vec2 vUv;
          void main() {
            vec3 col = texture2D(tDiffuse, vUv).rgb;
            col = (col - 0.5) * 1.04 + 0.52;
            float luma = dot(col, vec3(0.299, 0.587, 0.114));
            vec3 cool = col * vec3(0.88, 0.94, 1.05);
            vec3 warm = col * vec3(1.07, 0.96, 0.86);
            col = mix(cool, warm, smoothstep(0.1, 0.75, luma));
            gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
          }
        `,
      }),
    )
    this.composer.addPass(new OutputPass())

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
    this.composer.setSize(w, h)
    this.bloom.setSize(Math.max(1, w * 0.6), Math.max(1, h * 0.6))
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
      this.composer.render()
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
    if (this.shake > 0) {
      const left = this.shake
      this.shake = Math.max(0, this.shake - dt)
      const amp = this.shakeMag * (left / 0.2)
      const t = this.shakeSeed + performance.now() * 0.055
      this.camera.position.x += Math.sin(t * 1.7) * amp
      this.camera.position.y += Math.cos(t * 2.2) * amp * 0.65
      this.camera.rotation.z = Math.sin(t * 1.4) * amp * 2.4
    } else {
      this.camera.rotation.z = 0
    }
    this.gunRoot.visible = this.mode !== 'dead'
    this.kick = Math.max(0, this.kick - dt * 8)
    this.gunRoot.position.x = 0.2
    this.gunRoot.position.z = -0.5 - this.kick * 0.1
    this.gunRoot.position.y = -0.16 + Math.sin(this.bob * 2) * Math.min(0.012, speed * 0.002)
    this.gunRoot.rotation.x = this.kick * 0.22 + (this.director.player.reload > 0 ? 0.28 : 0)
    const knife = this.director.player.knifeCd
    this.gunRoot.rotation.z = knife > 0 ? Math.sin((0.62 - knife) * 9) * 0.45 : 0
    if (this.muzzleLeft > 0) {
      this.muzzleLeft = Math.max(0, this.muzzleLeft - dt)
      this.flash.intensity = 84 * (this.muzzleLeft / 0.05)
    } else {
      this.flash.intensity = 0
    }

    if (this.mode === 'play' && speed > 2.2) {
      this.foot -= dt
      if (this.foot <= 0) {
        this.sfx.step()
        this.foot = this.keys.has('ShiftLeft') ? 0.32 : 0.46
      }
    }

    this.syncWorld(dt, true)
    this.drawHud(input)
    this.composer.render()
  }

  private consume(events: ReturnType<Director['update']>) {
    let killed = false
    let killHead = false
    for (const e of events) {
      if (e.type === 'kill') {
        killed = true
        killHead = killHead || e.head
      } else if (e.type === 'shot') {
        const def = WEAPONS[e.weaponId]
        this.sfx.shot(def.report)
        this.kick = Math.min(1, this.kick + (def.report === 'shot' || def.report === 'heavy' ? 0.85 : 0.45))
        this.recoil = Math.min(0.08, this.recoil + (def.report === 'rifle' ? 0.03 : 0.012))
        this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch + (def.report === 'rifle' ? 0.012 : 0.004)))
        this.fireJuice(e.weaponId, e.hits)
        const landed = e.hits.length > 0
        const head = e.hits.some((h) => h.head)
        if (landed) {
          const mag = killed ? (killHead ? 0.058 : 0.048) : head ? 0.032 : 0.02
          const dur = killed ? 0.2 : 0.11
          if (dur >= this.shake) {
            this.shake = dur
            this.shakeMag = mag
            this.shakeSeed = Math.random() * 8
          }
        }
        const marker = document.getElementById('hitmarker')
        if (marker && landed) {
          const token = ++this.markerToken
          marker.classList.toggle('head', head)
          marker.classList.toggle('kill', killed)
          marker.classList.add('show')
          window.setTimeout(() => {
            if (token !== this.markerToken) return
            marker.classList.remove('show')
          }, killed ? 160 : 90)
        }
        if (landed) this.sfx.hit(head)
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

  private fireJuice(weaponId: string, hits: { x: number; y: number; z: number; head: boolean }[]) {
    const muzzle = this.guns[weaponId]?.getObjectByName('muzzle')
    if (muzzle) muzzle.getWorldPosition(this.muzzleWorld)
    else this.muzzleWorld.copy(this.camera.position)
    this.juice.muzzle(this.muzzleWorld, this.camera)
    this.muzzleLeft = 0.05
    this.flash.intensity = 84
    this.aimWorld.set(0, 0, -1).applyQuaternion(this.camera.quaternion)
    const origin = this.camera.position
    const world = bunkerImpact(
      origin.x,
      origin.y,
      origin.z,
      this.aimWorld.x,
      this.aimWorld.y,
      this.aimWorld.z,
      48,
      this.director.doors,
    )
    let closest = Infinity
    const shown = hits.slice(0, 4)
    for (const hit of shown) {
      const dist = Math.hypot(hit.x - origin.x, hit.y - origin.y, hit.z - origin.z)
      if (dist < closest) closest = dist
      this.juice.tracer(this.muzzleWorld, new THREE.Vector3(hit.x, hit.y, hit.z))
      this.juice.burst(hit.x, hit.y, hit.z, hit.head ? 'spark' : 'blood', hit.head ? 7 : 5)
      this.juice.burst(hit.x, hit.y, hit.z, 'ash', 4)
    }
    const wallFirst = !!world && world.t < closest - 0.12
    if (world && (wallFirst || shown.length === 0)) {
      this.juice.tracer(this.muzzleWorld, new THREE.Vector3(world.x, world.y, world.z))
      this.juice.scorch(world)
      this.juice.burst(world.x, world.y, world.z, 'spark', 8)
    } else if (shown.length === 0) {
      this.juice.tracer(this.muzzleWorld, origin.clone().addScaledVector(this.aimWorld, 16))
    }
  }

  private syncWorld(dt: number, live: boolean) {
    const t = performance.now() * 0.001
    const anchor = this.mode === 'menu' ? SPAWN : this.director.player
    this.moon.position.set(anchor.x + 5, 12, anchor.z + 4)
    this.moon.target.position.set(anchor.x, 0, anchor.z)
    this.moon.target.updateMatrixWorld()
    this.scenery.braziers.forEach((light, i) => {
      const dip = Math.sin(t * 2.2 + i * 1.3) > 0.96 ? 0.28 : 1
      light.intensity = (34 + Math.sin(t * 7.5 + i * 1.7) * 8 + Math.sin(t * 18 + i) * 4) * dip
    })
    this.scenery.cools.forEach((light, i) => {
      light.intensity = 8 + Math.sin(t * 1.1 + i) * 1.4
    })
    this.scenery.flames.forEach((flame, i) => {
      const s = 0.82 + Math.sin(t * 13 + i) * 0.14 + Math.sin(t * 29 + i * 2) * 0.06
      flame.scale.set(1, Math.max(0.45, s), 1)
    })
    this.scenery.shafts.forEach((shaft, i) => {
      const mat = shaft.material as THREE.MeshBasicMaterial
      mat.opacity = 0.05 + Math.sin(t * 0.6 + i) * 0.018
    })
    this.scenery.dust.position.set(anchor.x, 0, anchor.z)
    this.scenery.embers.position.set(anchor.x, 0, anchor.z)
    const drift = (points: THREE.Points, speed: number, spread: number) => {
      const dust = points.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < dust.count; i++) {
        let y = dust.getY(i) + dt * speed
        let x = dust.getX(i) + dt * 0.05
        if (y > 3) y = 0.15
        if (x > spread) x = -spread
        dust.setY(i, y)
        dust.setX(i, x)
      }
      dust.needsUpdate = true
    }
    drift(this.scenery.dust, 0.12, 8)
    drift(this.scenery.embers, 0.28, 7)
    this.juice.update(dt)

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
      if (!active.has(i)) {
        mesh.group.visible = false
        if (mesh.dying) {
          mesh.dying = false
          fadeHusk(mesh, 1)
        }
      }
    })

    const weaponId = this.director.currentWeapon().id
    const showGun = this.gunRoot.visible
    for (const [id, gun] of Object.entries(this.guns)) gun.visible = id === weaponId && showGun
    this.armsPistol.visible = showGun && weaponId === 'pistol'
    this.armsRifle.visible = showGun && weaponId !== 'pistol'

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
    const swing = Math.sin(husk.anim + mesh.phase)
    const tearing = husk.state === 'tear'
    mesh.armL.rotation.x = tearing ? -1.35 + swing * 0.45 : 0.25 + swing * 0.9
    mesh.armR.rotation.x = tearing ? -0.7 - swing * 0.55 : 0.1 - swing * 0.9
    mesh.armL.rotation.z = 0.2
    mesh.armR.rotation.z = -0.32
    mesh.legL.rotation.x = tearing ? 0.08 : swing * 0.75
    mesh.legR.rotation.x = tearing ? 0.12 : -swing * 0.75 * mesh.drag
    const peak = husk.flinchHead ? 0.5 : 0.42
    const flinchT = husk.flinch > 0 ? Math.min(1, husk.flinch / peak) : 0
    const lean = Math.pow(flinchT, 0.4) * (husk.flinchHead ? 0.62 : 0.44)
    const side = husk.id % 2 === 0 ? 1 : -1
    mesh.group.rotation.z = Math.sin(husk.anim * 0.45 + mesh.phase) * 0.06 + lean * 0.7 * side
    mesh.armL.rotation.x += tearing ? lean * 1.15 : -lean * 1.35
    mesh.armR.rotation.x += tearing ? lean * 0.95 : -lean * 1.15
    mesh.armL.rotation.z += lean * 0.95
    mesh.armR.rotation.z -= lean * 0.95
    if (husk.state === 'dying') {
      if (!mesh.dying) {
        mesh.dying = true
        this.juice.death(husk.x, husk.z)
      }
      const k = Math.min(1, husk.dead / 1.05)
      mesh.group.rotation.x = mesh.hunch - lean * (1 - k * 0.4) + k * 1.25
      mesh.group.position.y = -k * 0.42
      mesh.group.scale.setScalar(husk.scale * (1 - k * 0.12))
      fadeHusk(mesh, 1 - Math.min(1, Math.max(0, (husk.dead - 0.15) / 0.9)))
    } else {
      mesh.dying = false
      mesh.group.rotation.x = mesh.hunch - lean
      mesh.group.position.y = Math.abs(Math.sin(husk.anim + mesh.phase)) * 0.03
      mesh.group.scale.setScalar(husk.scale)
      fadeHusk(mesh, 1)
    }
    const hot = husk.flash > 0
    mesh.skin.emissive.setHex(hot ? 0xfff0dc : husk.kind === 'cinder' ? 0x5a220c : 0x000000)
    mesh.skin.emissiveIntensity = hot ? 1.7 : husk.kind === 'cinder' ? 0.4 : 0
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
    document.getElementById('slot-a')?.classList.toggle('on', p.slot === 0)
    const slotB = document.getElementById('slot-b')
    slotB?.classList.toggle('on', p.slot === 1)
    slotB?.classList.toggle('locked', !p.heavy)
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
    ctx.fillStyle = '#100d0b'
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
      ctx.fillStyle = r.open ? 'rgba(214, 176, 132, 0.34)' : 'rgba(70, 54, 44, 0.28)'
      ctx.strokeStyle = r.open ? 'rgba(255, 196, 140, 0.45)' : 'rgba(120, 90, 70, 0.25)'
      ctx.lineWidth = 1
      const rx = px(r.x0)
      const ry = py(r.z0)
      const rw = px(r.x1) - rx
      const rh = py(r.z1) - ry
      ctx.fillRect(rx, ry, rw, rh)
      ctx.strokeRect(rx, ry, rw, rh)
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
