import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { circleHitsRect } from '../dodgeGame/collision'
import { utcDayKey } from '../dodgeGame/dayKey'
import {
  dodgeAlreadyPlayed,
  fetchDodgeLeaderboard,
  submitDodgeScore,
  type DodgeLeaderboardRow,
} from '../dodgeGame/leaderboardApi'
import { dodgeLeaderboardDateRange, type DodgeLeaderTab } from '../dodgeGame/leaderboardRanges'
import { validatePlayerName } from '../dodgeGame/name'
import { isSupabaseConfigured } from '../dodgeGame/supabaseClient'
import { caughtToUiMessage, safeUiString } from '../dodgeGame/errorMessage'
import collapickUrl from '../assets/dodge-brands/collapick.png'
import reviseUrl from '../assets/dodge-brands/revise.png'
import sprintitUrl from '../assets/dodge-brands/sprintit.png'
import playerSpriteUrl from '../assets/dodge-player.jpg'
import './DodgePage.css'

const W = 360
const H = 600
const PLAYER_R = 11

/** Esteen tekstin reunus (sama piirrossa ja koon laskennassa). */
const LABEL_PAD_X = 4
const LABEL_PAD_Y = 3
/** Lisävälys clip-reunan ja rivityksen väliin. */
const LABEL_INNER_TRIM = 2
/** Pienin fontti, jolla tekstiä yritetään pitää ilman skaalausta (spawn kasvattaa laatikkoa tämän alle). */
const LABEL_MIN_READABLE_PX = 8
/** Korkeus ei kasva loputtomiin; isompi arvo sallii useamman rivin (rivitys) ennen kuin leveys täytetään. */
const MAX_OBSTACLE_LABEL_HEIGHT = 120

type ObstacleKind = 'normal' | 'golive' | 'extraLife'

/** Harvinaiset partneri-/brändipalikat (kuva mustalla pohjalla). */
type BrandLogoKey = 'collapick' | 'sprintit' | 'revise'

const BRAND_LOGO_URL: Record<BrandLogoKey, string> = {
  collapick: collapickUrl,
  sprintit: sprintitUrl,
  revise: reviseUrl,
}

const BRAND_LOGO_KEYS: BrandLogoKey[] = ['collapick', 'sprintit', 'revise']

/** Todennäköisyys että tavallinen este on logopalikka (jos kuvat ladattu). */
const BRAND_LOGO_SPAWN_P = 0.028

type Obstacle = {
  x: number
  y: number
  w: number
  h: number
  vy: number
  label: string
  kind: ObstacleKind
  logoKey?: BrandLogoKey
}

type Phase = 'lobby' | 'playing' | 'over'

type LeaderTab = DodgeLeaderTab

const ARENA_BG = '#FBEAE3'
const OBSTACLE_FILL = '#5A1537'
const OBSTACLE_STROKE = '#3d0f26'
const GOLIVE_LABEL = 'Golive bug fix'
/** Todennäköisyys että yksi spawn on Golive-palkki (~1.5 %). */
const GOLIVE_SPAWN_P = 0.015

const EXTRA_LIFE_FILL = '#B369F3'
const EXTRA_LIFE_STROKE = '#6d28d9'
const EXTRA_LIFE_LABEL = 'process developed'
/** Seuraava extra-elämä yrittää syntyä kun matka (m) ylittää tämän. */
const extraLifeNextSpawnMeters = (from: number, rnd: () => number) =>
  from + 450 + rnd() * 130

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

/** Leveys glyyfeille (bold yms. ylittää usein pelkän `width`-arvon). */
function measuredTextWidth(ctx: CanvasRenderingContext2D, s: string): number {
  if (!s) return 0
  const m = ctx.measureText(s)
  let w = m.width
  if (typeof m.actualBoundingBoxLeft === 'number' && typeof m.actualBoundingBoxRight === 'number') {
    w = Math.max(w, m.actualBoundingBoxLeft + m.actualBoundingBoxRight)
  } else {
    w *= 1.08
  }
  return w
}

/** Rivin korkeus kyseiselle tekstille (baseline + nousevat/laskevat). */
function measuredLineHeightForLine(ctx: CanvasRenderingContext2D, fontPx: number, line: string): number {
  const sample = line.length > 0 ? line : 'Mg'
  const m = ctx.measureText(sample)
  if (typeof m.actualBoundingBoxAscent === 'number' && typeof m.actualBoundingBoxDescent === 'number') {
    return Math.max(fontPx * 1.05, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + 2)
  }
  return fontPx * 1.3
}

function uniformLineHeight(
  ctx: CanvasRenderingContext2D,
  fontPx: number,
  lines: string[],
): number {
  if (lines.length === 0) return fontPx * 1.3
  return Math.max(fontPx * 1.12, ...lines.map((ln) => measuredLineHeightForLine(ctx, fontPx, ln)))
}

/** Rivittää tekstin niin, että jokainen rivi mahtuu `maxW`:hen (mitta nykyisellä fontilla). */
function wrapLinesToWidth(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return [text.length > 0 ? text : '?']

  const lines: string[] = []
  let line = ''

  const pushWord = (word: string) => {
    if (measuredTextWidth(ctx, word) <= maxW) {
      line = line ? `${line} ${word}` : word
      return
    }
    if (line) {
      lines.push(line)
      line = ''
    }
    let chunk = ''
    for (const ch of word) {
      const next = chunk + ch
      if (measuredTextWidth(ctx, next) <= maxW) {
        chunk = next
      } else {
        if (chunk) lines.push(chunk)
        chunk = ch
      }
    }
    if (chunk) line = chunk
  }

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (measuredTextWidth(ctx, candidate) <= maxW) {
      line = candidate
    } else {
      if (line) lines.push(line)
      line = ''
      pushWord(word)
    }
  }
  if (line) lines.push(line)
  return lines
}

function innerLabelBounds(w: number, h: number): { maxW: number; maxH: number } {
  const maxW = Math.max(1, w - LABEL_PAD_X * 2 - LABEL_INNER_TRIM)
  const maxH = Math.max(1, h - LABEL_PAD_Y * 2 - LABEL_INNER_TRIM)
  return { maxW, maxH }
}

let measureCanvas: HTMLCanvasElement | null = null
function getMeasureCtx(): CanvasRenderingContext2D {
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas')
    measureCanvas.width = W
    measureCanvas.height = Math.min(H, 240)
  }
  const c = measureCanvas.getContext('2d')
  if (!c) throw new Error('Canvas 2d ei saatavilla')
  return c
}

function measureLabelLayout(
  ctx: CanvasRenderingContext2D,
  label: string,
  innerW: number,
  innerH: number,
  minFontPx: number,
): { fontPx: number; lines: string[]; lineH: number } | null {
  const raw = label.trim() || '?'
  const setFont = (px: number) => {
    ctx.font = `bold ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`
  }
  const startPx = Math.min(12, Math.max(9, Math.floor(innerH * 0.4)))
  for (let fontPx = startPx; fontPx >= minFontPx; fontPx--) {
    setFont(fontPx)
    const lines = wrapLinesToWidth(ctx, raw, innerW)
    if (lines.length === 0) continue
    const lineH = uniformLineHeight(ctx, fontPx, lines)
    const blockH = lines.length * lineH
    if (blockH > innerH) continue
    if (!lines.every((ln) => measuredTextWidth(ctx, ln) <= innerW)) continue
    return { fontPx, lines, lineH }
  }
  return null
}

/** Kasvattaa ulkomittoja: ensin korkeus (rivitys, paksumpi laatikko), vasta sitten leveys. */
function growObstacleToFitLabel(
  label: string,
  baseW: number,
  baseH: number,
  capOuterW: number,
  capOuterH: number,
  minReadablePx: number,
): { w: number; h: number } {
  const ctx = getMeasureCtx()
  let w = Math.max(20, baseW)
  let h = Math.max(10, baseH)
  const limitW = Math.min(capOuterW, W - 8)
  const limitH = Math.min(capOuterH, MAX_OBSTACLE_LABEL_HEIGHT)

  for (let i = 0; i < 500; i++) {
    const { maxW, maxH } = innerLabelBounds(w, h)
    if (measureLabelLayout(ctx, label, maxW, maxH, minReadablePx)) {
      return { w: Math.min(w, limitW), h: Math.min(h, limitH) }
    }
    if (h < limitH) {
      h = Math.min(limitH, h + 6)
    } else if (w < limitW) {
      w = Math.min(limitW, w + Math.max(8, Math.ceil((limitW - w) * 0.12)))
    } else {
      break
    }
  }
  return { w: limitW, h: limitH }
}

/** Satunnainen koko logolle (säilyttää kuvasuhteen). */
function sizeLogoObstacle(
  img: HTMLImageElement,
  rnd: () => number,
  capOuterW: number,
  capOuterH: number,
): { w: number; h: number } {
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  const limitW = Math.min(capOuterW, W - 8)
  const limitH = Math.min(capOuterH, MAX_OBSTACLE_LABEL_HEIGHT)
  if (nw <= 0 || nh <= 0) {
    return { w: Math.min(100, limitW), h: Math.min(52, limitH) }
  }
  const aspect = nw / nh
  let innerH = 38 + rnd() * 52
  innerH = Math.min(innerH, limitH - LABEL_PAD_Y * 2 - LABEL_INNER_TRIM - 2)
  innerH = Math.max(26, innerH)
  let innerW = innerH * aspect
  const maxInnerW = limitW - LABEL_PAD_X * 2 - LABEL_INNER_TRIM - 2
  if (innerW > maxInnerW) {
    innerW = maxInnerW
    innerH = innerW / aspect
  }
  const w = innerW + LABEL_PAD_X * 2 + LABEL_INNER_TRIM
  const h = innerH + LABEL_PAD_Y * 2 + LABEL_INNER_TRIM
  return {
    w: Math.max(44, Math.min(limitW, w)),
    h: Math.max(28, Math.min(limitH, h)),
  }
}

function clampObstacleX(x: number, obstacleW: number): number {
  return clamp(x, 4, W - obstacleW - 4)
}

function drawObstacleLabel(
  ctx: CanvasRenderingContext2D,
  o: Obstacle,
  textColor: string,
  logos?: ReadonlyMap<BrandLogoKey, HTMLImageElement> | null,
) {
  const { maxW, maxH } = innerLabelBounds(o.w, o.h)
  if (maxW < 2 || maxH < 2) return

  if (o.logoKey && logos) {
    const img = logos.get(o.logoKey)
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save()
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(o.x, o.y, o.w, o.h, 4)
      } else {
        ctx.rect(o.x, o.y, o.w, o.h)
      }
      ctx.clip()
      ctx.fillStyle = '#000000'
      ctx.fillRect(o.x, o.y, o.w, o.h)
      const nw = img.naturalWidth
      const nh = img.naturalHeight
      const scale = Math.min(maxW / nw, maxH / nh)
      const dw = nw * scale
      const dh = nh * scale
      const dx = o.x + LABEL_PAD_X + LABEL_INNER_TRIM / 2 + (maxW - dw) / 2
      const dy = o.y + LABEL_PAD_Y + LABEL_INNER_TRIM / 2 + (maxH - dh) / 2
      ctx.drawImage(img, dx, dy, dw, dh)
      ctx.restore()
      return
    }
  }

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
  const contentTop = o.y + LABEL_PAD_Y + LABEL_INNER_TRIM / 2

  const layout = measureLabelLayout(ctx, raw, maxW, maxH, 2)
  if (layout) {
    const { lines, lineH } = layout
    const blockH = lines.length * lineH
    const top = contentTop + (maxH - blockH) / 2
    lines.forEach((ln, i) => {
      ctx.fillText(ln, cx, top + lineH * (i + 0.5))
    })
    ctx.restore()
    return
  }

  const setFont = (px: number) => {
    ctx.font = `bold ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`
  }
  setFont(2)
  const linesFb = wrapLinesToWidth(ctx, raw, maxW)
  const lineH = uniformLineHeight(ctx, 2, linesFb)
  const blockH = Math.max(lineH, linesFb.length * lineH)
  const maxLineWF = Math.max(1, ...linesFb.map((ln) => measuredTextWidth(ctx, ln)))
  const s = Math.min(1, (maxW - 1) / maxLineWF, (maxH - 1) / blockH)
  const cxB = o.x + LABEL_PAD_X + LABEL_INNER_TRIM / 2 + maxW / 2
  const cyB = contentTop + maxH / 2
  ctx.translate(cxB, cyB)
  ctx.scale(s, s)
  let y = -blockH / 2 + lineH / 2
  for (const ln of linesFb) {
    ctx.fillText(ln, 0, y)
    y += lineH
  }
  ctx.restore()
}

/** Uusi avain nollaa paikallisen "paras tällä laitteella" -ennätyksen stats-resetin yhteydessä. */
const BEST_KEY = 'suguru_as_daily_life_best_m'

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
  /** Pelipaneeli: scroll mobiilissa näkyviin pelin alussa. */
  const gamePanelRef = useRef<HTMLElement | null>(null)
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
  const [reserveLifeHud, setReserveLifeHud] = useState(false)

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
  const brandLogosRef = useRef<Map<BrandLogoKey, HTMLImageElement>>(new Map())
  /** Enintään yksi varaelämä kerrallaan; törmäys normaaliin esteeseen kuluttaa tämän. */
  const hasReserveLifeRef = useRef(false)
  /** Kun `distanceRef` ylittää tämän (m), yritetään spawnaa extra-elämäpalikka (jos ei varaa). */
  const nextExtraLifeAtMetersRef = useRef(380 + Math.random() * 160)

  const loadBoard = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setBoardRows([])
      setBoardError(null)
      return
    }
    setBoardLoading(true)
    setBoardError(null)
    try {
      const { start, end } = dodgeLeaderboardDateRange(tab, dayKey)
      const rows = await fetchDodgeLeaderboard(start, end)
      setBoardRows(rows)
    } catch (e: unknown) {
      setBoardError(caughtToUiMessage(e))
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
      ctx.fillStyle =
        o.kind === 'extraLife'
          ? EXTRA_LIFE_FILL
          : o.kind === 'golive'
            ? OBSTACLE_FILL
            : o.logoKey
              ? '#141414'
              : OBSTACLE_FILL
      ctx.fill()
      drawObstacleLabel(ctx, o, ARENA_BG, brandLogosRef.current)
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(o.x, o.y, o.w, o.h, 4)
      } else {
        ctx.rect(o.x, o.y, o.w, o.h)
      }
      ctx.strokeStyle =
        o.kind === 'extraLife'
          ? EXTRA_LIFE_STROKE
          : o.kind === 'golive'
            ? '#8b294d'
            : o.logoKey
              ? 'rgba(255, 255, 255, 0.22)'
              : OBSTACLE_STROKE
      ctx.lineWidth = o.kind === 'golive' ? 2.5 : 2
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

  useEffect(() => {
    let cancelled = false
    const imgs: HTMLImageElement[] = []
    const cleanups: (() => void)[] = []
    const onAny = () => {
      if (cancelled) return
      draw()
    }
    for (const key of BRAND_LOGO_KEYS) {
      const img = new Image()
      imgs.push(img)
      const k = key
      const onLoad = () => {
        if (cancelled) return
        brandLogosRef.current.set(k, img)
        onAny()
      }
      const onError = () => {
        if (cancelled) return
        brandLogosRef.current.delete(k)
        onAny()
      }
      img.addEventListener('load', onLoad, { once: true })
      img.addEventListener('error', onError, { once: true })
      img.src = BRAND_LOGO_URL[k]
      if (img.complete && img.naturalWidth > 0) onLoad()
      cleanups.push(() => {
        img.removeEventListener('load', onLoad)
        img.removeEventListener('error', onError)
      })
    }
    return () => {
      cancelled = true
      brandLogosRef.current.clear()
      for (const c of cleanups) c()
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
    hasReserveLifeRef.current = false
    setReserveLifeHud(false)
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
    hasReserveLifeRef.current = false
    setReserveLifeHud(false)
    nextExtraLifeAtMetersRef.current = 380 + Math.random() * 160
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

      const moved = obstaclesRef.current.map((o) => ({ ...o, y: o.y + o.vy * dt }))
      const hadExtraLife = moved.some((o) => o.kind === 'extraLife')
      obstaclesRef.current = moved.filter((o) => o.y < H + 80)
      if (
        hadExtraLife &&
        !obstaclesRef.current.some((o) => o.kind === 'extraLife') &&
        !hasReserveLifeRef.current
      ) {
        const rndMiss = Math.random
        nextExtraLifeAtMetersRef.current = Math.min(
          nextExtraLifeAtMetersRef.current,
          extraLifeNextSpawnMeters(distanceRef.current, rndMiss),
        )
      }

      const fall = baseFallSpeed(distanceRef.current)
      spawnCooldownRef.current -= dt
      if (spawnCooldownRef.current <= 0) {
        const rnd = Math.random
        let next: Obstacle

        if (rnd() < GOLIVE_SPAWN_P) {
          let gh = 12 + rnd() * 11
          let gw = Math.min(W - 8, W * (0.58 + rnd() * 0.32))
          const xr = rnd()
          const gvy = fall * (2.05 + rnd() * 0.55)
          const sized = growObstacleToFitLabel(
            GOLIVE_LABEL,
            gw,
            gh,
            W - 8,
            MAX_OBSTACLE_LABEL_HEIGHT,
            LABEL_MIN_READABLE_PX,
          )
          gw = sized.w
          gh = sized.h
          const gx = clampObstacleX(4 + xr * Math.max(1, W - gw - 8), gw)
          next = {
            x: gx,
            y: -gh - 2,
            w: gw,
            h: gh,
            vy: gvy,
            label: GOLIVE_LABEL,
            kind: 'golive',
          }
        } else {
          const xr = rnd()
          const vy = fall * (0.82 + rnd() * 0.38)
          const logosMap = brandLogosRef.current
          const avail = BRAND_LOGO_KEYS.filter((k) => {
            const im = logosMap.get(k)
            return Boolean(im && im.complete && im.naturalWidth > 0)
          })
          if (rnd() < BRAND_LOGO_SPAWN_P && avail.length > 0) {
            const logoKey = avail[Math.floor(rnd() * avail.length)]!
            const img = logosMap.get(logoKey)!
            const sized = sizeLogoObstacle(img, rnd, W - 8, MAX_OBSTACLE_LABEL_HEIGHT)
            const lw = sized.w
            const lh = sized.h
            const lx = clampObstacleX(4 + xr * Math.max(1, W - lw - 8), lw)
            next = {
              x: lx,
              y: -lh - 6,
              w: lw,
              h: lh,
              vy,
              label: ' ',
              kind: 'normal' as const,
              logoKey,
            }
          } else {
            let w = 30 + rnd() * (42 + Math.min(distanceRef.current * 0.1, 38))
            let h = 16 + rnd() * 22
            const label = pickObstacleLabel(rnd)
            const sized = growObstacleToFitLabel(
              label,
              w,
              h,
              W - 8,
              MAX_OBSTACLE_LABEL_HEIGHT,
              LABEL_MIN_READABLE_PX,
            )
            w = sized.w
            h = sized.h
            const x = clampObstacleX(4 + xr * Math.max(1, W - w - 8), w)
            next = { x, y: -h - 6, w, h, vy, label, kind: 'normal' as const }
          }
        }

        obstaclesRef.current = [...obstaclesRef.current, next]
        spawnCooldownRef.current = spawnIntervalMeters(distanceRef.current)
      }

      const rndExtra = Math.random
      if (
        distanceRef.current >= nextExtraLifeAtMetersRef.current &&
        !hasReserveLifeRef.current &&
        !obstaclesRef.current.some((o) => o.kind === 'extraLife')
      ) {
        let ew = 28 + rndExtra() * 16
        let eh = 8 + rndExtra() * 5
        const sizedEx = growObstacleToFitLabel(
          EXTRA_LIFE_LABEL,
          ew,
          eh,
          W - 8,
          MAX_OBSTACLE_LABEL_HEIGHT,
          LABEL_MIN_READABLE_PX,
        )
        ew = sizedEx.w
        eh = sizedEx.h
        const ex = clampObstacleX(4 + rndExtra() * Math.max(1, W - ew - 8), ew)
        const evy = fall * (1.48 + rndExtra() * 0.5)
        obstaclesRef.current = [
          ...obstaclesRef.current,
          {
            x: ex,
            y: -eh - 2,
            w: ew,
            h: eh,
            vy: evy,
            label: EXTRA_LIFE_LABEL,
            kind: 'extraLife',
          },
        ]
        nextExtraLifeAtMetersRef.current = extraLifeNextSpawnMeters(distanceRef.current, rndExtra)
      }

      const px = pxRef.current
      const py = pyRef.current
      const obs = obstaclesRef.current
      for (let i = 0; i < obs.length; i++) {
        const o = obs[i]!
        if (!circleHitsRect(px, py, PLAYER_R, o.x, o.y, o.w, o.h)) continue

        if (o.kind === 'extraLife') {
          obstaclesRef.current = obs.filter((x) => x !== o)
          if (!hasReserveLifeRef.current) {
            hasReserveLifeRef.current = true
            setReserveLifeHud(true)
            nextExtraLifeAtMetersRef.current = extraLifeNextSpawnMeters(distanceRef.current, Math.random)
          }
          break
        }

        if (hasReserveLifeRef.current) {
          hasReserveLifeRef.current = false
          setReserveLifeHud(false)
          obstaclesRef.current = obs.filter((x) => x !== o)
        } else {
          endGame()
          return
        }
        break
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

  /** Mobiilissa peli alkaa näkyvällä alueella ilman ylimääräistä skrollia. */
  useEffect(() => {
    if (phase !== 'playing') return
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        gamePanelRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
      })
    })
    return () => cancelAnimationFrame(id)
  }, [phase])

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
      const msg = caughtToUiMessage(e)
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
    <div className={`app dodge${phase === 'playing' ? ' dodge--playing-mobile' : ''}`}>
      <header className="app-header">
        <h1>AS Daily life</h1>
        <p className="dodge__lead">
          AS Daily life — liikuta hiirtä pelialueella. Esteet putoavat ylhäältä; väistä niin pitkään kuin pystyt.
          Matka kasvaa metreinä ja tempo kiristyy. Yksi pelikerta päivässä per nimi (UTC {dayKey}); tulos
          tallennetaan Supabaseen.
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
              {safeUiString(nameError)}
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
        <section ref={gamePanelRef} className="dodge__panel" aria-label="Pelialue">
          {phase === 'playing' ? (
            <div className="dodge__hud" aria-live="polite">
              <span className="dodge__hud-main">
                <span>Matka</span>
                <span>{displayM.toFixed(1)} m</span>
              </span>
              {reserveLifeHud ? (
                <span className="dodge__reserve" title="Seuraava osuma kuluttaa varaelämän.">
                  Varaelämä
                </span>
              ) : null}
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
              aria-label="AS Daily life -peli: liikuta hiirtä väistääksesi putoavia esteitä"
              onPointerMove={onPointerMove}
              onPointerDown={(e) => {
                if (phaseRef.current === 'playing') {
                  e.currentTarget.setPointerCapture(e.pointerId)
                }
              }}
            />
          </div>

          {phase === 'playing' ? (
            <p className="dodge__hint dodge__hint--hide-when-playing-mobile" style={{ marginBottom: 0 }}>
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
                      {safeUiString(submitError)}
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
            {safeUiString(boardError)}
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
                    <tr key={`${String(row.player_name)}-${String(row.day_key)}-${String(row.created_at)}`}>
                      <td>{i + 1}</td>
                      <td>{safeUiString(row.player_name)}</td>
                      <td>
                        {Number.isFinite(row.distance_m) ? `${Number(row.distance_m).toFixed(1)} m` : '—'}
                      </td>
                      <td>{Number.isFinite(row.run_ms) ? formatRunMs(row.run_ms) : '—'}</td>
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
