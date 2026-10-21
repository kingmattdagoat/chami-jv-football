import { drawText, textWidth } from './pixelFont'
import { CENTER_Y, FIELD_W, type Scene, type SceneEnt } from './scene'

export const VIEW_W = 640
export const VIEW_H = 360
const PX = 10 // pixels per yard
const MARGIN = 7 // yards of sideline/crowd drawn around the field

export interface TeamColors {
  jersey: string
  helmet: string
  number: string
  abbr: string
}

export class Renderer {
  ctx: CanvasRenderingContext2D
  camX = 35
  camY = CENTER_Y
  field: HTMLCanvasElement
  user: TeamColors
  opp: TeamColors
  t = 0

  constructor(canvas: HTMLCanvasElement, user: TeamColors, opp: TeamColors) {
    canvas.width = VIEW_W
    canvas.height = VIEW_H
    this.ctx = canvas.getContext('2d')!
    this.ctx.imageSmoothingEnabled = false
    this.user = user
    this.opp = opp
    this.field = this.buildField()
  }

  private buildField() {
    const c = document.createElement('canvas')
    c.width = (120 + MARGIN * 2) * PX
    c.height = Math.ceil((FIELD_W + MARGIN * 2) * PX)
    const g = c.getContext('2d')!
    const X = (yd: number) => Math.round((yd + MARGIN) * PX)
    const Y = (yd: number) => Math.round((yd + MARGIN) * PX)
    // Track / crowd
    g.fillStyle = '#2a1a1e'
    g.fillRect(0, 0, c.width, c.height)
    for (let x = 0; x < c.width; x += 4) {
      for (let y = 0; y < Y(-3); y += 5) {
        const h = (x * 31 + y * 17) % 7
        g.fillStyle = h < 2 ? '#9e1b32' : h < 3 ? '#e8b923' : h < 5 ? '#3b2a2e' : '#5a4448'
        g.fillRect(x, y, 3, 3)
        g.fillRect(x, c.height - y - 4, 3, 3)
      }
    }
    g.fillStyle = '#7a3b2e'
    g.fillRect(0, Y(-3), c.width, PX * 3)
    g.fillRect(0, Y(FIELD_W), c.width, PX * 3)
    // Grass bands
    g.fillStyle = '#2f7a2f'
    g.fillRect(X(-2), Y(-1), (124) * PX, (FIELD_W + 2) * PX)
    for (let yd = 10; yd < 110; yd += 5) {
      g.fillStyle = (yd / 5) % 2 === 0 ? '#3f9a3c' : '#389033'
      g.fillRect(X(yd), Y(0), 5 * PX, FIELD_W * PX)
    }
    // Grass texture
    for (let i = 0; i < 4000; i++) {
      const x = (i * 97) % (120 * PX)
      const y = (i * 53) % Math.floor(FIELD_W * PX)
      g.fillStyle = i % 3 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'
      g.fillRect(X(0) + x, Y(0) + y, 2, 1)
    }
    // End zones
    const ez = (x0: number, color: string, text: string, tc: string) => {
      g.fillStyle = color
      g.fillRect(X(x0), Y(0), 10 * PX, FIELD_W * PX)
      g.save()
      g.translate(X(x0 + 5), Y(CENTER_Y))
      g.rotate(x0 === 0 ? -Math.PI / 2 : Math.PI / 2)
      const s = 6
      drawText(g, text, -textWidth(text, s) / 2, -2.5 * s, tc, s, 'rgba(0,0,0,0.35)')
      g.restore()
    }
    ez(0, '#9e1b32', 'FLYERS', '#e8b923')
    ez(110, this.opp.jersey, this.opp.abbr, this.opp.helmet)
    // Lines
    g.fillStyle = '#f4f4f4'
    for (let yd = 10; yd <= 110; yd += 5) g.fillRect(X(yd) - 1, Y(0), yd === 10 || yd === 110 ? 4 : 2, FIELD_W * PX)
    for (let yd = 11; yd < 110; yd++) {
      if (yd % 5 === 0) continue
      for (const hy of [0.6, 18.4, 34.3, FIELD_W - 1.2]) g.fillRect(X(yd), Y(hy), 2, 6)
    }
    g.fillRect(X(0), Y(0) - 3, 120 * PX, 3)
    g.fillRect(X(0), Y(FIELD_W), 120 * PX, 3)
    g.fillRect(X(0) - 3, Y(0), 3, FIELD_W * PX)
    g.fillRect(X(120), Y(0), 3, FIELD_W * PX)
    // Yard numbers
    for (let yd = 20; yd <= 100; yd += 10) {
      const n = String(yd <= 60 ? yd - 10 : 110 - yd)
      const s = 3
      const w = textWidth(n, s)
      drawText(g, n, X(yd) - w / 2, Y(7), '#f4f4f4', s, null)
      drawText(g, n, X(yd) - w / 2, Y(FIELD_W - 9), '#f4f4f4', s, null)
    }
    // Midfield logo
    g.fillStyle = '#9e1b32'
    g.beginPath()
    g.arc(X(60), Y(CENTER_Y), 5 * PX, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#e8b923'
    g.beginPath()
    g.arc(X(60), Y(CENTER_Y), 4.3 * PX, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#9e1b32'
    g.beginPath()
    g.arc(X(60), Y(CENTER_Y), 3.6 * PX, 0, Math.PI * 2)
    g.fill()
    drawText(g, 'C', X(60) - 9, Y(CENTER_Y) - 15, '#e8b923', 6, '#5c0f1d')
    return c
  }

  toScreen(x: number, y: number) {
    return { sx: (x - this.camX) * PX + VIEW_W / 2, sy: (y - this.camY) * PX + VIEW_H / 2 }
  }

  toField(sx: number, sy: number) {
    return { x: (sx - VIEW_W / 2) / PX + this.camX, y: (sy - VIEW_H / 2) / PX + this.camY }
  }

  snapCamera(scene: Scene) {
    this.camX = this.clampX(scene.focusX + scene.lookAhead)
    this.camY = this.clampY(scene.focusY)
  }

  private clampX(x: number) {
    const half = VIEW_W / PX / 2
    return Math.max(-MARGIN + half, Math.min(120 + MARGIN - half, x))
  }

  private clampY(y: number) {
    const half = VIEW_H / PX / 2
    return Math.max(-2 + half, Math.min(FIELD_W + 2 - half, y))
  }

  draw(scene: Scene, dt: number) {
    this.t += dt
    const g = this.ctx
    const k = 1 - Math.pow(0.002, dt)
    this.camX += (this.clampX(scene.focusX + scene.lookAhead) - this.camX) * k
    this.camY += (this.clampY(scene.focusY) - this.camY) * k
    const ox = Math.round((this.camX + MARGIN) * PX - VIEW_W / 2)
    const oy = Math.round((this.camY + MARGIN) * PX - VIEW_H / 2)
    g.drawImage(this.field, ox, oy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H)

    const S = (x: number, y: number) => this.toScreen(x, y)
    if (scene.losX != null) {
      const { sx } = S(scene.losX, 0)
      g.fillStyle = 'rgba(80,160,255,0.85)'
      g.fillRect(Math.round(sx) - 1, Math.round(S(0, 0).sy), 3, FIELD_W * PX)
    }
    if (scene.firstDownX != null) {
      const { sx } = S(scene.firstDownX, 0)
      g.fillStyle = 'rgba(255,213,74,0.9)'
      g.fillRect(Math.round(sx) - 1, Math.round(S(0, 0).sy), 3, FIELD_W * PX)
    }
    this.goalposts()

    // Aim arc
    if (scene.aim) {
      const a = scene.aim
      const from = S(a.fromX, a.fromY)
      const to = S(a.toX, a.toY)
      const dist = Math.hypot(a.toX - a.fromX, a.toY - a.fromY)
      g.fillStyle = a.ok ? '#ffe27a' : '#ff5a5a'
      for (let i = 1; i < 20; i++) {
        const p = i / 20
        const h = Math.sin(Math.PI * p) * Math.min(9, dist * 0.22) * PX * 0.6
        g.fillRect(Math.round(from.sx + (to.sx - from.sx) * p) - 1, Math.round(from.sy + (to.sy - from.sy) * p - h) - 1, 3, 3)
      }
      g.strokeStyle = a.ok ? '#ffe27a' : '#ff5a5a'
      g.lineWidth = 2
      const r = 9 + Math.sin(this.t * 10) * 2
      g.strokeRect(Math.round(to.sx - r), Math.round(to.sy - r), r * 2, r * 2)
      g.fillRect(Math.round(to.sx) - 1, Math.round(to.sy) - 1, 3, 3)
    }

    // Players sorted by y for depth
    const ents = [...scene.ents].sort((a, b) => a.y - b.y)
    for (const e of ents) this.player(e)

    if (scene.ball) {
      const b = scene.ball
      const p = S(b.x, b.y)
      g.fillStyle = 'rgba(0,0,0,0.35)'
      g.fillRect(Math.round(p.sx) - 3, Math.round(p.sy) + 2, 6, 2)
      const by = Math.round(p.sy - b.z * PX * 0.6)
      g.fillStyle = '#6b3a1e'
      g.fillRect(Math.round(p.sx) - 3, by - 2, 6, 4)
      g.fillRect(Math.round(p.sx) - 2, by - 3, 4, 6)
      g.fillStyle = '#fff'
      g.fillRect(Math.round(p.sx) - 1, by - 1, 2, 1)
    }

    for (const pu of scene.popups) {
      const p = S(pu.x, pu.y)
      const s = 2
      const w = textWidth(pu.text, s)
      drawText(g, pu.text, Math.round(p.sx - w / 2), Math.round(p.sy - 20 - pu.age * 24), pu.color, s)
    }
  }

  private goalposts() {
    const g = this.ctx
    for (const gx of [0.2, 119.8]) {
      const top = this.toScreen(gx, CENTER_Y - 3)
      const bot = this.toScreen(gx, CENTER_Y + 3)
      const dir = gx < 60 ? -1 : 1
      g.fillStyle = 'rgba(0,0,0,0.35)'
      g.fillRect(Math.round(top.sx) + 6 * dir, Math.round(top.sy) + 4, 3, bot.sy - top.sy)
      g.fillStyle = '#ffd400'
      g.fillRect(Math.round(top.sx) - 1, Math.round(top.sy), 3, Math.round(bot.sy - top.sy))
      g.fillRect(Math.round(top.sx) - 1 + (dir > 0 ? 0 : -14), Math.round(top.sy) - 1, 14, 3)
      g.fillRect(Math.round(top.sx) - 1 + (dir > 0 ? 0 : -14), Math.round(bot.sy) - 2, 14, 3)
    }
  }

  private player(e: SceneEnt) {
    const g = this.ctx
    const { sx, sy } = this.toScreen(e.x, e.y)
    const x = Math.round(sx)
    const y = Math.round(sy)
    if (x < -20 || x > VIEW_W + 20 || y < -30 || y > VIEW_H + 20) return
    const c = e.team === 'user' ? this.user : this.opp
    g.fillStyle = 'rgba(0,0,0,0.3)'
    g.fillRect(x - 5, y + 1, 10, 3)
    if (e.down) {
      g.fillStyle = c.jersey
      g.fillRect(x - 7, y - 4, 10, 5)
      g.fillStyle = c.helmet
      g.fillRect(x + (e.facing > 0 ? 3 : -11), y - 5, 6, 6)
      g.fillStyle = '#e9e4d8'
      g.fillRect(x + (e.facing > 0 ? -10 : 3), y - 3, 4, 3)
      return
    }
    const phase = e.moving ? Math.floor(e.step * 2.2) % 2 : 0
    // Legs (pants + socks)
    g.fillStyle = '#e9e4d8'
    g.fillRect(x - 3, y - 4 + (phase ? -1 : 0), 2, 4)
    g.fillRect(x + 1, y - 4 + (phase ? 0 : -1), 2, 4)
    g.fillStyle = '#111'
    g.fillRect(x - 3 + (phase ? -1 : 0), y - 1, 3, 1)
    g.fillRect(x + 1 + (phase ? 1 : 0), y - 1, 3, 1)
    // Jersey
    g.fillStyle = c.jersey
    g.fillRect(x - 4, y - 10, 9, 6)
    g.fillRect(x - 5, y - 9, 1, 3)
    g.fillRect(x + 5, y - 9, 1, 3)
    if (e.number != null) {
      const n = String(e.number)
      drawText(g, n, x - Math.floor(textWidth(n) / 2), y - 10, c.number, 1, null)
    }
    // Helmet
    g.fillStyle = c.helmet
    g.fillRect(x - 3, y - 15, 6, 5)
    g.fillStyle = '#222'
    g.fillRect(x + (e.facing > 0 ? 2 : -3), y - 13, 1, 2)
    g.fillStyle = 'rgba(255,255,255,0.45)'
    g.fillRect(x - 2, y - 15, 2, 1)
    if (e.carrier) {
      g.fillStyle = '#6b3a1e'
      g.fillRect(x + (e.facing > 0 ? 4 : -7), y - 8, 4, 3)
    }
    if (e.controlled) {
      const bob = Math.round(Math.sin(this.t * 8) * 1.5)
      g.fillStyle = '#ffe27a'
      g.fillRect(x - 3, y - 22 + bob, 7, 2)
      g.fillRect(x - 2, y - 20 + bob, 5, 1)
      g.fillRect(x - 1, y - 19 + bob, 3, 1)
      g.fillRect(x, y - 18 + bob, 1, 1)
    }
  }
}
