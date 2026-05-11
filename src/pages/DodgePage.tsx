import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { circleHitsRect } from '../dodgeGame/collision'
import { utcDayKey, utcMonthRange, utcWeekRange } from '../dodgeGame/dayKey'
import {
  dodgeAlreadyPlayed,
  fetchDodgeLeaderboard,
  submitDodgeScore,
  type DodgeLeaderboardRow,
} from '../dodgeGame/leaderboardApi'
import { validatePlayerName } from '../dodgeGame/name'
import { isSupabaseConfigured } from '../dodgeGame/supabaseClient'
import playerSpriteUrl from '../assets/dodge-player.jpg'
import './DodgePage.css'

const W = 360
const H = 600
const PLAYER_R = 11

type Obstacle = {
  x: number
  y: number
  w: number
  h: number
  vy: number
  label: string
  /** Harvinainen nopea leveä "Golive bug fix" -palkki */
  golive?: boolean
}

type Phase = 'lobby' | 'playing' | 'over'

type LeaderTab = 'day' | 'week' | 'month' | 'all'

const ARENA_BG = '#FBEAE3'
const OBSTACLE_FILL = '#5A1537'
const OBSTACLE_STROKE = '#3d0f26'
const GOLIVE_LABEL = 'Golive bug fix'
/** Todennäköisyys että yksi spawn on Golive-palkki (~1.5 %). */
const GOLIVE_SPAWN_P = 0.015

const OBSTACLE_LABELS = [
  'Customer',
  'Internal meet',
  'Workshop',
  'Retro',
  'Daily',
  'Monthly',
  'Competitor',
  'Bug',
  'Discounts',
  'Deadline',
  'Budget',
  'Free work',
  'Non-billable',
  'R&D',
  'Ticket',
  'Fire!',
  'Handoff',
  'Senior review',
] as const

function pickObstacleLabel(rng: () => number): string {
  const i = Math.floor(rng() * OBSTACLE_LABELS.length)
  return OBSTACLE_LABELS[Math.min(i, OBSTACLE_LABELS.length - 1)]!
}

function drawObstacleLabel(ctx: CanvasRenderingContext2D, o: Obstacle, textColor: string) {
  const padX = 3
  const padY = 2
  const maxW = o.w - padX * 2
  const maxH = o.h - padY * 2
  if (maxW < 8 || maxH < 10) return

  const raw = o.label?.trim() || '?'
  ctx.save()
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(o.x, o.y, o.w, o.h, 4)
  } else {
    ctx.rect(o.x, o.y, o.w, o.h)
  }
  ctx.clip()

  ctx.fillStyle = textColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cx = o.x + o.w / 2
  const cy = o.y + o.h / 2

  let fontPx = Math.min(12, Math.max(9, Math.floor(maxH * 0.42)))
  let display = raw

  const setFont = (px: number) => {
    ctx.font = `bold ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`
  }

  for (;;) {
    setFont(fontPx)
    if (ctx.measureText(display).width <= maxW || fontPx <= 8) break
    fontPx -= 1
  }

  if (ctx.measureText(display).width > maxW) {
    let t = raw
    while (t.length > 1 && ctx.measureText(`${t.slice(0, -1)}…`).width > maxW) {
      t = t.slice(0, -1)
    }
    display = t.length > 0 ? `${t}…` : '…'
  }

  ctx.fillText(display, cx, cy)
  ctx.restore()
}

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

function formatRunMs(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`
}

export function DodgePage() {
  const dayKey = useMemo(() => utcDayKey(), [])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const phaseRef = useRef<Phase>('lobby')
  const [phase, setPhase] = useState<Phase>('lobby')
  const [displayM, setDisplayM] = useState(0)
  const [finalM, setFinalM] = useState(0)
  const [finalRunMs, setFinalRunMs] = useState(0)
  const [bestM, setBestM] = useState(readBest)

  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [playedToday, setPlayedToday] = useState(false)
  const [playedCheckLoading, setPlayedCheckLoading] = useState(false)

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitOk, setSubmitOk] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [tab, setTab] = useState<LeaderTab>('day')
  const [boardLoading, setBoardLoading] = useState(false)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [boardRows, setBoardRows] = useState<DodgeLeaderboardRow[]>([])

  const obstaclesRef = useRef<Obstacle[]>([])
  const pxRef = useRef(W / 2)
  const pyRef = useRef(H - 72)
  const distanceRef = useRef(0)
  const spawnCooldownRef = useRef(0)
  const lastTsRef = useRef(0)
  const rafRef = useRef(0)
  const frameRef = useRef(0)
  const gameStartMsRef = useRef(0)
  const playerSpriteRef = useRef<HTMLImageElement | null>(null)

  const loadBoard = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setBoardRows([])
      setBoardError(null)
      return
    }
    setBoardLoading(true)
    setBoardError(null)
    try {
      let start: string
      let end: string
      if (tab === 'day') {
        start = dayKey
        end = dayKey
      } else if (tab === 'week') {
        const w = utcWeekRange()
        start = w.start
        end = w.end
      } else if (tab === 'month') {
        const m = utcMonthRange()
        start = m.start
        end = m.end
      } else {
        start = '2000-01-01'
        end = '2099-12-31'
      }
      const rows = await fetchDodgeLeaderboard(start, end)
      setBoardRows(rows)
    } catch (e: unknown) {
      setBoardError(e instanceof Error ? e.message : String(e))
      setBoardRows([])
    } finally {
      setBoardLoading(false)
    }
  }, [tab, dayKey])

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadBoard()
    }, 0)
    return () => window.clearTimeout(t)
  }, [loadBoard])

  useEffect(() => {
    let cancelled = false
    let innerDebounce: number | undefined
    const outer = window.setTimeout(() => {
      if (!isSupabaseConfigured()) {
        if (!cancelled) setPlayedToday(false)
        return
      }
      const trimmed = name.trim()
      if (trimmed.length === 0) {
        if (!cancelled) setPlayedToday(false)
        return
      }
      innerDebounce = window.setTimeout(() => {
        if (cancelled) return
        setPlayedCheckLoading(true)
        void dodgeAlreadyPlayed(dayKey, trimmed)
          .then((played) => {
            if (!cancelled) setPlayedToday(played)
          })
          .catch(() => {
            if (!cancelled) setPlayedToday(false)
          })
          .finally(() => {
            if (!cancelled) setPlayedCheckLoading(false)
          })
      }, 400)
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(outer)
      if (innerDebounce !== undefined) window.clearTimeout(innerDebounce)
    }
  }, [name, dayKey])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = ARENA_BG
    ctx.fillRect(0, 0, W, H)

    const scroll = (distanceRef.current * 3) % 40
    ctx.strokeStyle = 'rgba(90, 21, 55, 0.08)'
    ctx.lineWidth = 1
    for (let x = -scroll; x < W + 40; x += 40) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x - 80, H)
      ctx.stroke()
    }

    for (const o of obstaclesRef.current) {
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(o.x, o.y, o.w, o.h, 4)
      } else {
        ctx.rect(o.x, o.y, o.w, o.h)
      }
      ctx.fillStyle = OBSTACLE_FILL
      ctx.fill()
      drawObstacleLabel(ctx, o, ARENA_BG)
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(o.x, o.y, o.w, o.h, 4)
      } else {
        ctx.rect(o.x, o.y, o.w, o.h)
      }
      ctx.strokeStyle = o.golive ? '#8b294d' : OBSTACLE_STROKE
      ctx.lineWidth = o.golive ? 2.5 : 2
      ctx.stroke()
    }

    const px = pxRef.current
    const py = pyRef.current
    const sprite = playerSpriteRef.current
    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      const d = PLAYER_R * 2
      ctx.save()
      ctx.beginPath()
      ctx.arc(px, py, PLAYER_R, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(sprite, px - PLAYER_R, py - PLAYER_R, d, d)
      ctx.restore()
      ctx.beginPath()
      ctx.arc(px, py, PLAYER_R, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(90, 21, 55, 0.35)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(px, py, PLAYER_R, 0, Math.PI * 2)
      ctx.fillStyle = '#e8d4ef'
      ctx.fill()
      ctx.strokeStyle = OBSTACLE_FILL
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const img = new Image()
    const onLoad = () => {
      if (cancelled) return
      playerSpriteRef.current = img
      draw()
    }
    const onError = () => {
      if (cancelled) return
      playerSpriteRef.current = null
      draw()
    }
    img.addEventListener('load', onLoad, { once: true })
    img.addEventListener('error', onError, { once: true })
    img.src = playerSpriteUrl
    if (img.complete && img.naturalWidth > 0) onLoad()
    return () => {
      cancelled = true
      img.removeEventListener('load', onLoad)
      img.removeEventListener('error', onError)
    }
  }, [draw])

  const endGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    const d = distanceRef.current
    const runMs = Math.max(0, Date.now() - gameStartMsRef.current)
    setFinalRunMs(runMs)
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
    draw()
  }, [draw])

  const start = useCallback(() => {
    const err = validatePlayerName(name)
    setNameError(err)
    if (err) return
    if (isSupabaseConfigured() && playedToday) {
      setNameError('Olet jo pelannut tänään tällä nimellä.')
      return
    }

    obstaclesRef.current = []
    distanceRef.current = 0
    spawnCooldownRef.current = 0.15
    lastTsRef.current = 0
    frameRef.current = 0
    pxRef.current = W / 2
    pyRef.current = H - 72
    gameStartMsRef.current = Date.now()
    setDisplayM(0)
    setSubmitError(null)
    setSubmitOk(false)
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
        let next: Obstacle

        if (rnd() < GOLIVE_SPAWN_P) {
          const gh = 12 + rnd() * 11
          const gw = Math.min(W - 8, W * (0.58 + rnd() * 0.32))
          const gx = clamp(4 + rnd() * Math.max(1, W - gw - 8), 4, W - gw - 4)
          const gvy = fall * (2.05 + rnd() * 0.55)
          next = {
            x: gx,
            y: -gh - 2,
            w: gw,
            h: gh,
            vy: gvy,
            label: GOLIVE_LABEL,
            golive: true,
          }
        } else {
          const w = 30 + rnd() * (42 + Math.min(distanceRef.current * 0.1, 38))
          const h = 16 + rnd() * 22
          const x = clamp(8 + rnd() * (W - w - 16), 4, W - w - 4)
          const vy = fall * (0.82 + rnd() * 0.38)
          const label = pickObstacleLabel(rnd)
          next = { x, y: -h - 6, w, h, vy, label }
        }

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
  }, [draw, endGame, name, playedToday])

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

  const onSubmit = async () => {
    if (!isSupabaseConfigured()) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitDodgeScore({
        playerName: name.trim(),
        dayKey,
        distanceM: finalM,
        runMs: finalRunMs,
      })
      setSubmitOk(true)
      setPlayedToday(true)
      await loadBoard()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : ''
      if (code === '23505' || /duplicate|unique/i.test(msg)) {
        setSubmitError('Tällä nimellä on jo tulos tälle päivälle.')
      } else {
        setSubmitError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const backToLobby = () => {
    setPhase('lobby')
    phaseRef.current = 'lobby'
    setSubmitOk(false)
    setSubmitError(null)
  }

  const supabaseOn = isSupabaseConfigured()
  const startBlocked = supabaseOn && (playedToday || playedCheckLoading)

  return (
    <div className="app dodge">
      <header className="app-header">
        <h1>Väistö</h1>
        <p className="dodge__lead">
          Liikuta hiirtä pelialueella. Esteet putoavat ylhäältä — väistä niin pitkään kuin pystyt. Matka kasvaa
          metreinä ja tempo kiristyy. Yksi pelikerta päivässä per nimi (UTC {dayKey}); tulos tallennetaan
          Supabaseen.
        </p>
      </header>

      {phase === 'lobby' ? (
        <section className="dodge__panel" aria-label="Aloitus">
          <label className="dodge__label" htmlFor="dodge-player-name">
            Nimi (top-listoissa)
          </label>
          <input
            id="dodge-player-name"
            className="dodge__input"
            autoComplete="nickname"
            maxLength={40}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setNameError(null)
            }}
            placeholder="esim. Maija"
          />
          {nameError ? (
            <p className="dodge__error" role="alert">
              {nameError}
            </p>
          ) : null}
          {supabaseOn && playedToday ? (
            <p className="dodge__hint" role="status">
              Olet jo pelannut tänään tällä nimellä. Huomenna uusi yritys.
            </p>
          ) : null}
          <button
            type="button"
            className="dodge__btn dodge__btn--primary"
            disabled={startBlocked}
            onClick={() => start()}
          >
            {playedCheckLoading ? 'Tarkistetaan…' : 'Aloita peli'}
          </button>
        </section>
      ) : null}

      {phase === 'playing' || phase === 'over' ? (
        <section className="dodge__panel" aria-label="Pelialue">
          {phase === 'playing' ? (
            <div className="dodge__hud" aria-live="polite">
              <span>Matka</span>
              <span>{displayM.toFixed(1)} m</span>
            </div>
          ) : (
            <p className="dodge__hint">
              Tulos: <strong>{finalM.toFixed(1)} m</strong> · Aika {formatRunMs(finalRunMs)}
            </p>
          )}

          <div className="dodge__arena-wrap">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label="Väistöpeli: liikuta hiirtä väistääksesi tummanpunaisia esteitä"
              onPointerMove={onPointerMove}
              onPointerDown={(e) => {
                if (phaseRef.current === 'playing') {
                  e.currentTarget.setPointerCapture(e.pointerId)
                }
              }}
            />
          </div>

          {phase === 'playing' ? (
            <p className="dodge__hint" style={{ marginBottom: 0 }}>
              Vinkki: aloita alhaalta — tilaa väistää lisääntyy ylöspäin.
            </p>
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

              {!supabaseOn ? (
                <button
                  type="button"
                  className="dodge__btn dodge__btn--primary"
                  style={{ marginTop: '0.75rem' }}
                  onClick={backToLobby}
                >
                  Pelaa uudelleen
                </button>
              ) : null}

              {supabaseOn && !submitOk ? (
                <>
                  <p className="dodge__hint" style={{ marginTop: '0.65rem' }}>
                    Lähetä tulos listoihin (vain kerran / päivä / nimi).
                  </p>
                  <button
                    type="button"
                    className="dodge__btn dodge__btn--primary"
                    style={{ marginTop: '0.35rem' }}
                    disabled={submitting}
                    onClick={() => void onSubmit()}
                  >
                    {submitting ? 'Lähetetään…' : 'Lähetä tulos'}
                  </button>
                  {submitError ? (
                    <p className="dodge__error" role="alert">
                      {submitError}
                    </p>
                  ) : null}
                </>
              ) : null}

              {supabaseOn && submitOk ? (
                <>
                  <p className="dodge__hint" role="status" style={{ marginTop: '0.65rem' }}>
                    Tulos tallennettu. Kiitos pelistä!
                  </p>
                  <button
                    type="button"
                    className="dodge__btn dodge__btn--primary"
                    style={{ marginTop: '0.5rem' }}
                    onClick={backToLobby}
                  >
                    Takaisin alkuun
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="dodge__panel" aria-label="Top-listat">
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Top-listat</h2>
        <div className="dodge__tabs" role="tablist" aria-label="Aikajänne">
          {(
            [
              ['day', 'Päivä'],
              ['week', 'Viikko'],
              ['month', 'Kuukausi'],
              ['all', 'Kaikki'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`dodge__tab${tab === id ? ' is-active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {!supabaseOn ? (
          <p className="dodge__hint">Top-listat näkyvät, kun Supabase on konfiguroitu.</p>
        ) : boardLoading ? (
          <p className="dodge__hint">Ladataan…</p>
        ) : boardError ? (
          <p className="dodge__error" role="alert">
            {boardError}
          </p>
        ) : (
          <div className="dodge__table-wrap">
            <table className="dodge__table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nimi</th>
                  <th>Matka</th>
                  <th>Aika</th>
                </tr>
              </thead>
              <tbody>
                {boardRows.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Ei vielä tuloksia tälle jaksolle.</td>
                  </tr>
                ) : (
                  boardRows.map((row, i) => (
                    <tr key={`${row.player_name}-${row.day_key}-${row.created_at}`}>
                      <td>{i + 1}</td>
                      <td>{row.player_name}</td>
                      <td>{Number(row.distance_m).toFixed(1)} m</td>
                      <td>{formatRunMs(row.run_ms)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
