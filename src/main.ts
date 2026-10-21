import '@fontsource/cinzel/600.css'
import '@fontsource/cinzel/700.css'
import '@fontsource/source-sans-3/400.css'
import '@fontsource/source-sans-3/600.css'
import { Game } from './game/game'

document.documentElement.dataset.ashenBuild = 'weaponfeel-2026-10-22'

const canvas = document.querySelector<HTMLCanvasElement>('#view')
if (!canvas) {
  throw new Error('Missing canvas')
}

try {
  new Game(canvas)
} catch (err) {
  const menu = document.getElementById('menu')
  if (menu) {
    menu.classList.remove('hidden')
    menu.innerHTML = `<div class="panel"><h1>Ashen Rounds</h1><p class="lede">This browser could not start the bunker. WebGL is required.</p><p class="best">${err instanceof Error ? err.message : 'WebGL unavailable'}</p></div>`
  }
}
