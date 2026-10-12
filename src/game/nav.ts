export type Grid = {
  cell: number
  originX: number
  originZ: number
  cols: number
  rows: number
  blocked: Uint8Array
  walk: (x: number, z: number) => boolean
}

type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number }

export function buildGrid(walk: (x: number, z: number) => boolean, bounds: Bounds, cell = 0.5): Grid {
  const originX = bounds.minX
  const originZ = bounds.minZ
  const cols = Math.ceil((bounds.maxX - bounds.minX) / cell)
  const rows = Math.ceil((bounds.maxZ - bounds.minZ) / cell)
  const blocked = new Uint8Array(cols * rows)
  const center = (c: number, r: number) => ({
    x: originX + (c + 0.5) * cell,
    z: originZ + (r + 0.5) * cell,
  })
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = center(c, r)
      blocked[r * cols + c] = walk(p.x, p.z) ? 0 : 1
    }
  }
  return { cell, originX, originZ, cols, rows, blocked, walk }
}

function nearestOpen(grid: Grid, c: number, r: number): { c: number; r: number } | null {
  const { cols, rows, blocked } = grid
  const inside = (cc: number, rr: number) => cc >= 0 && rr >= 0 && cc < cols && rr < rows
  if (inside(c, r) && blocked[r * cols + c] === 0) return { c, r }
  for (let rad = 1; rad <= 6; rad++) {
    for (let dz = -rad; dz <= rad; dz++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== rad) continue
        const cc = c + dx
        const rr = r + dz
        if (inside(cc, rr) && blocked[rr * cols + cc] === 0) return { c: cc, r: rr }
      }
    }
  }
  return null
}

function los(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  walk: (x: number, z: number) => boolean,
): boolean {
  const dist = Math.hypot(bx - ax, bz - az)
  const steps = Math.max(1, Math.ceil(dist / 0.4))
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    if (!walk(ax + (bx - ax) * t, az + (bz - az) * t)) return false
  }
  return true
}

export function findPath(
  grid: Grid,
  sx: number,
  sz: number,
  gx: number,
  gz: number,
): { x: number; z: number }[] {
  const { cell, originX, originZ, cols, rows, blocked, walk } = grid
  const toCell = (x: number, z: number) => ({
    c: Math.floor((x - originX) / cell),
    r: Math.floor((z - originZ) / cell),
  })
  const center = (c: number, r: number) => ({
    x: originX + (c + 0.5) * cell,
    z: originZ + (r + 0.5) * cell,
  })
  const start = nearestOpen(grid, toCell(sx, sz).c, toCell(sx, sz).r)
  const goal = nearestOpen(grid, toCell(gx, gz).c, toCell(gx, gz).r)
  if (!start || !goal) return []
  if (start.c === goal.c && start.r === goal.r) {
    const g = center(goal.c, goal.r)
    return [{ x: gx, z: gz }].filter(() => walk(g.x, g.z))
  }

  const count = cols * rows
  const gScore = new Float64Array(count)
  gScore.fill(Infinity)
  const came = new Int32Array(count)
  came.fill(-1)
  const closed = new Uint8Array(count)
  const idx = (c: number, r: number) => r * cols + c
  const si = idx(start.c, start.r)
  const gi = idx(goal.c, goal.r)
  gScore[si] = 0

  const heapI: number[] = [si]
  const heapF: number[] = [0]
  const siftUp = (i: number) => {
    while (i > 0) {
      const p = (i - 1) >> 1
      if (heapF[i] >= heapF[p]) break
      ;[heapF[i], heapF[p]] = [heapF[p], heapF[i]]
      ;[heapI[i], heapI[p]] = [heapI[p], heapI[i]]
      i = p
    }
  }
  const siftDown = (i: number) => {
    const n = heapI.length
    for (;;) {
      let s = i
      const l = i * 2 + 1
      const r = l + 1
      if (l < n && heapF[l] < heapF[s]) s = l
      if (r < n && heapF[r] < heapF[s]) s = r
      if (s === i) break
      ;[heapF[i], heapF[s]] = [heapF[s], heapF[i]]
      ;[heapI[i], heapI[s]] = [heapI[s], heapI[i]]
      i = s
    }
  }
  const push = (f: number, i: number) => {
    heapI.push(i)
    heapF.push(f)
    siftUp(heapI.length - 1)
  }
  const pop = () => {
    const top = heapI[0]
    const lastI = heapI.pop() as number
    const lastF = heapF.pop() as number
    if (heapI.length) {
      heapI[0] = lastI
      heapF[0] = lastF
      siftDown(0)
    }
    return top
  }

  const octile = (c: number, r: number) => {
    const dx = Math.abs(c - goal.c)
    const dz = Math.abs(r - goal.r)
    return dx + dz + (1.414 - 2) * Math.min(dx, dz)
  }

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]
  let guard = 0
  while (heapI.length && guard++ < count * 2) {
    const cur = pop()
    if (closed[cur]) continue
    if (cur === gi) break
    closed[cur] = 1
    const c = cur % cols
    const r = (cur / cols) | 0
    for (const [dc, dr] of dirs) {
      const nc = c + dc
      const nr = r + dr
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
      const ni = idx(nc, nr)
      if (blocked[ni] || closed[ni]) continue
      if (dc !== 0 && dr !== 0) {
        if (blocked[idx(c + dc, r)] || blocked[idx(c, r + dr)]) continue
      }
      const a = center(c, r)
      const b = center(nc, nr)
      const mx = (a.x + b.x) / 2
      const mz = (a.z + b.z) / 2
      if (!walk(mx, mz)) continue
      const step = dc !== 0 && dr !== 0 ? 1.414 : 1
      const tentative = gScore[cur] + step
      if (tentative >= gScore[ni]) continue
      gScore[ni] = tentative
      came[ni] = cur
      push(tentative + octile(nc, nr), ni)
    }
  }

  if (came[gi] === -1 && si !== gi) return []
  const cells: { x: number; z: number }[] = []
  let cur = gi
  const safety = count
  let n = 0
  while (cur !== -1 && n++ < safety) {
    const c = cur % cols
    const r = (cur / cols) | 0
    cells.push(center(c, r))
    if (cur === si) break
    cur = came[cur]
  }
  cells.reverse()
  cells.push({ x: gx, z: gz })
  return smooth(cells, walk)
}

function smooth(points: { x: number; z: number }[], walk: (x: number, z: number) => boolean) {
  if (points.length <= 2) return points
  const out = [points[0]]
  let i = 0
  while (i < points.length - 1) {
    let j = points.length - 1
    while (j > i + 1 && !los(points[i].x, points[i].z, points[j].x, points[j].z, walk)) j--
    out.push(points[j])
    i = j
  }
  return out
}

export function slideMove(
  x: number,
  z: number,
  dx: number,
  dz: number,
  walk: (x: number, z: number) => boolean,
): { x: number; z: number } {
  const dist = Math.hypot(dx, dz)
  const steps = Math.max(1, Math.ceil(dist / 0.18))
  let cx = x
  let cz = z
  const sx = dx / steps
  const sz = dz / steps
  for (let i = 0; i < steps; i++) {
    const nx = cx + sx
    const nz = cz + sz
    if (walk(nx, nz)) {
      cx = nx
      cz = nz
      continue
    }
    if (walk(nx, cz)) {
      cx = nx
      continue
    }
    if (walk(cx, nz)) {
      cz = nz
      continue
    }
    break
  }
  return { x: cx, z: cz }
}
