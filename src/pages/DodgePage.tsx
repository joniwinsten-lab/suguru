import { useCallback, useEffect, useRef, useState } from 'react'
import { circleHitsRect } from '../dodgeGame/collision'
import './DodgePage.css'

const W = 360
const H = 600
const PLAYER_R = 11

type Obstacle = { x: number; y: number; w: number; h: number; vy: number }

type Phase = 'idle' | 'playing' | 'over'

const BEST_KEY = 'suguru_dodge_best_m'

function readBest(): number {
  try {
    const v = localStorage.getItem(BEST_KEY)
    if (v == null) return 0
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

function writeBest(m: number) {
  try {
    localStorage.setItem(BEST_KEY, String(Math.round(m * 100) / 100))
  } catch {
    /* ignore */
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function toGameCoords(
  e: React.PointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  const sx = W / rect.width
  const sy = H / rect.height
  return {
    x: (e.clientX - rect.left) * sx,
    y: (e.clientY - rect.top) * sy,
  }
}

function spawnIntervalMeters(distance: number): number {
  return Math.max(0.26, 0.9 - Math.min(distance * 0.0078, 0.62))
}

function baseFallSpeed(distance: number): number {
  return 88 + Math.min(distance * 0.38, 245)
}

function metersPerSecond(distance: number): number {
  return Math.min(5.2 + distance * 0.042, 15)
}

export function DodgePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const phaseRef = useRef<Phase>('idle')
  const [phase, setPhase] = useState<Phase>('idle')
  const [displayM, setDisplayM] = useState(0)
  const [finalM, setFinalM] = useState(0)
  const [bestM, setBestM] = useState(readBest)

  const obstaclesRef = useRef<Obstacle[]>([])
  const pxRef = useRef(W / 2)
  const pyRef = useRef(H - 72)
  const distanceRef = useRef(0)
  const spawnCooldownRef = useRef(0)
  const lastTsRef = useRef(0)
  const rafRef = useRef(0)
  const frameRef = useRef(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#0c1222'
    ctx.fillRect(0, 0, W, H)

    const scroll = (distanceRef.current * 3) % 40
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)'
    ctx.lineWidth = 1
    for (let x = -scroll; x < W + 40; x += 40) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x - 80, H)
      ctx.stroke()
    }

    for (const o of obstaclesRef.current) {
      ctx.fillStyle = '#f97316'
      ctx.strokeStyle = '#c2410c'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(o.x, o.y, o.w, o.h, 4)
      ctx.fill()
      ctx.stroke()
    }

    const px = pxRef.current
    const py = pyRef.current
    ctx.beginPath()
    ctx.arc(px, py, PLAYER_R, 0, Math.PI * 2)
    ctx.fillStyle = '#38bdf8'
    ctx.fill()
    ctx.strokeStyle = '#e0f2fe'
    ctx.lineWidth = 2
    ctx.stroke()
  }, [])

  const endGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    const d = distanceRef.current
    setFinalM(d)
    setBestM((prev) => {
      if (d > prev) {
        writeBest(d)
        return d
      }
      return prev
    })
    phaseRef.current = 'over'
    setPhase('over')
  }, [])

  const start = useCallback(() => {
    obstaclesRef.current = []
    distanceRef.current = 0
    spawnCooldownRef.current = 0.15
    lastTsRef.current = 0
    frameRef.current = 0
    pxRef.current = W / 2
    pyRef.current = H - 72
    setDisplayM(0)
    phaseRef.current = 'playing'
    setPhase('playing')
    draw()

    const gameTick = (ts: number) => {
      if (phaseRef.current !== 'playing') return

      const last = lastTsRef.current || ts
      const dt = Math.min(0.05, (ts - last) / 1000)
      lastTsRef.current = ts

      const d0 = distanceRef.current
      distanceRef.current += metersPerSecond(d0) * dt

      obstaclesRef.current = obstaclesRef.current
        .map((o) => ({ ...o, y: o.y + o.vy * dt }))
        .filter((o) => o.y < H + 80)

      const fall = baseFallSpeed(distanceRef.current)
      spawnCooldownRef.current -= dt
      if (spawnCooldownRef.current <= 0) {
        const rnd = Math.random
        const w = 30 + rnd() * (42 + Math.min(distanceRef.current * 0.1, 38))
        const h = 16 + rnd() * 22
        const x = clamp(8 + rnd() * (W - w - 16), 4, W - w - 4)
        const vy = fall * (0.82 + rnd() * 0.38)
        const next: Obstacle = { x, y: -h - 6, w, h, vy }
        obstaclesRef.current = [...obstaclesRef.current, next]
        spawnCooldownRef.current = spawnIntervalMeters(distanceRef.current)
      }

      const px = pxRef.current
      const py = pyRef.current
      for (const o of obstaclesRef.current) {
        if (circleHitsRect(px, py, PLAYER_R, o.x, o.y, o.w, o.h)) {
          endGame()
          return
        }
      }

      frameRef.current += 1
      if (frameRef.current % 5 === 0) {
        setDisplayM(Math.round(distanceRef.current * 10) / 10)
      }

      draw()
      rafRef.current = requestAnimationFrame(gameTick)
    }

    rafRef.current = requestAnimationFrame(gameTick)
  }, [draw, endGame])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    c.width = W
    c.height = H
    draw()
  }, [draw, phase])

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return
    const { x, y } = toGameCoords(e, canvas)
    pxRef.current = clamp(x, PLAYER_R, W - PLAYER_R)
    pyRef.current = clamp(y, PLAYER_R, H - PLAYER_R)
  }

  return (
    <div className="app dodge">
      <header className="app-header">
        <h1>Väistö</h1>
        <p className="dodge__lead">
          Liikuta hiirtä pelialueella. Esteet putoavat ylhäältä — väistä niin pitkään kuin pystyt. Matka
          kasvaa metrien mittaiseksi ja tempo kiristyy lennosta. Osuma = loppu.
        </p>
      </header>

      <section className="dodge__panel" aria-label="Pelialue">
        {phase === 'playing' ? (
          <div className="dodge__hud" aria-live="polite">
            <span>Matka</span>
            <span>{displayM.toFixed(1)} m</span>
          </div>
        ) : (
          <p className="dodge__hint">
            {phase === 'idle'
              ? 'Aloita peli — osoitin lukittuu pelialueelle napautuksella.'
              : `Viimeisin matka: ${finalM.toFixed(1)} m`}
          </p>
        )}

        <div className="dodge__arena-wrap">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="Väistöpeli: liikuta hiirtä väistääksesi oransseja esteitä"
            onPointerMove={onPointerMove}
            onPointerDown={(e) => {
              if (phaseRef.current === 'playing') {
                e.currentTarget.setPointerCapture(e.pointerId)
              }
            }}
          />
        </div>

        {phase === 'idle' ? (
          <button type="button" className="dodge__btn dodge__btn--primary" onClick={start}>
            Aloita
          </button>
        ) : null}

        {phase === 'over' ? (
          <div className="dodge__over">
            <p className="dodge__hint" style={{ marginBottom: '0.35rem' }}>
              Matka
            </p>
            <p>
              <strong>{finalM.toFixed(1)} m</strong>
            </p>
            {bestM > 0 ? (
              <p className="dodge__best">Paras tällä laitteella: {bestM.toFixed(1)} m</p>
            ) : null}
            <button
              type="button"
              className="dodge__btn dodge__btn--primary"
              style={{ marginTop: '0.75rem' }}
              onClick={start}
            >
              Pelaa uudelleen
            </button>
          </div>
        ) : null}

        {phase === 'playing' ? (
          <p className="dodge__hint" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            Vinkki: pidä hiirtä alhaalla alussa — tilaa väistää lisääntyy ylöspäin mentäessä.
          </p>
        ) : null}
      </section>
    </div>
  )
}
