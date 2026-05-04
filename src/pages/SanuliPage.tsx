import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { dayKeyUtc, pickDailyIndex } from '../sanuli/dailyWord'
import { loadFiWords } from '../sanuli/loadWords'
import {
  isValidFiLetter,
  normalizeFi,
  scoreGuess,
  type TileState,
} from '../sanuli/scoreGuess'
import './SanuliPage.css'

const ROWS = 6
const COLS = 5
const STORAGE_KEY = 'sanuli-state-v1'

type GameStatus = 'playing' | 'won' | 'lost'

type CommittedRow = { word: string; scores: TileState[] }

type Persisted = {
  dayKey: string
  committed: string[]
  draft: string
  status: GameStatus
}

function parseDayKey(dayKey: string): { d: number; m: number; y: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey)
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

function dayKeyToFiLabel(dayKey: string): string {
  const p = parseDayKey(dayKey)
  if (!p) return dayKey
  return `${p.d}.${p.m}.${p.y}`
}

function loadPersisted(dayKey: string): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as Persisted
    if (o?.dayKey !== dayKey || !Array.isArray(o.committed)) return null
    if (o.status !== 'playing' && o.status !== 'won' && o.status !== 'lost') return null
    return {
      dayKey: o.dayKey,
      committed: o.committed.filter((w) => typeof w === 'string' && w.length === COLS),
      draft: typeof o.draft === 'string' ? o.draft.slice(0, COLS) : '',
      status: o.status,
    }
  } catch {
    return null
  }
}

function savePersisted(p: Persisted): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

const KEYBOARD_ROWS: string[][] = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'å'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä'],
  ['Enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'Backspace'],
]

function tileClass(s: TileState | 'empty' | 'tbd'): string {
  switch (s) {
    case 'correct':
      return 'sanuli-tile sanuli-tile--correct'
    case 'present':
      return 'sanuli-tile sanuli-tile--present'
    case 'absent':
      return 'sanuli-tile sanuli-tile--absent'
    case 'tbd':
      return 'sanuli-tile sanuli-tile--tbd'
    default:
      return 'sanuli-tile sanuli-tile--empty'
  }
}

function shareEmoji(scores: TileState[]): string {
  return scores
    .map((t) => (t === 'correct' ? '🟩' : t === 'present' ? '🟨' : '⬜'))
    .join('')
}

export function SanuliPage() {
  const dayKey = useMemo(() => dayKeyUtc(), [])
  const [pack, setPack] = useState<Awaited<ReturnType<typeof loadFiWords>> | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [committed, setCommitted] = useState<CommittedRow[]>([])
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<GameStatus>('playing')
  const [shakeRow, setShakeRow] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  const allowedSet = useMemo(() => {
    if (!pack) return null
    return new Set(pack.allowed)
  }, [pack])

  const solution = useMemo(() => {
    if (!pack?.solutions.length) return ''
    const i = pickDailyIndex(dayKey, pack.solutions.length)
    return pack.solutions[i] ?? ''
  }, [pack, dayKey])

  useEffect(() => {
    let cancelled = false
    loadFiWords()
      .then((p) => {
        if (cancelled) return
        setPack(p)
        setLoadError(null)
        const sol = p.solutions[pickDailyIndex(dayKey, p.solutions.length)] ?? ''
        const allowed = new Set(p.allowed)
        const saved = loadPersisted(dayKey)
        if (!saved || !sol) return
        const rows: CommittedRow[] = []
        for (const w of saved.committed) {
          if (w.length !== COLS || !allowed.has(w)) continue
          rows.push({ word: w, scores: scoreGuess(sol, w) })
        }
        setCommitted(rows)
        setDraft(saved.status === 'playing' ? saved.draft.slice(0, COLS) : '')
        setStatus(saved.status)
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setLoadError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [dayKey])

  useEffect(() => {
    if (!solution) return
    savePersisted({
      dayKey,
      committed: committed.map((r) => r.word),
      draft: status === 'playing' ? draft : '',
      status,
    })
  }, [dayKey, solution, committed, draft, status])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => {
      setToast(null)
      toastTimer.current = null
    }, 2000)
  }, [])

  const currentRowIndex = committed.length
  const gameOver = status !== 'playing'

  const submitRow = useCallback(() => {
    if (gameOver || !solution || !allowedSet) return
    const guess = normalizeFi(draft)
    if (guess.length !== COLS) return
    if (!allowedSet.has(guess)) {
      setShakeRow(true)
      window.setTimeout(() => setShakeRow(false), 450)
      showToast('Ei sanalistalla')
      return
    }
    const scores = scoreGuess(solution, guess)
    const next = [...committed, { word: guess, scores }]
    setCommitted(next)
    setDraft('')
    const win = scores.every((t) => t === 'correct')
    if (win) setStatus('won')
    else if (next.length >= ROWS) setStatus('lost')
  }, [committed, draft, gameOver, solution, allowedSet, showToast])

  const onKey = useCallback(
    (key: string) => {
      if (gameOver || currentRowIndex >= ROWS) return
      const k = normalizeFi(key)
      if (k === 'backspace') {
        setDraft((d) => d.slice(0, -1))
        return
      }
      if (k === 'enter') {
        submitRow()
        return
      }
      if (!isValidFiLetter(k)) return
      setDraft((d) => (d.length >= COLS ? d : d + k.toLowerCase()))
    },
    [gameOver, currentRowIndex, submitRow],
  )

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable))
        return
      if (e.key === 'Enter') {
        e.preventDefault()
        onKey('enter')
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        onKey('backspace')
        return
      }
      const one = normalizeFi(e.key)
      if (one.length === 1) onKey(one)
    }
    window.addEventListener('keydown', onDown)
    return () => window.removeEventListener('keydown', onDown)
  }, [onKey])

  const copyShare = useCallback(async () => {
    if (!solution || status === 'playing') return
    const n = committed.length
    const header = `Sanuli ${dayKeyToFiLabel(dayKey)} ${n}/${ROWS}`
    const grid = committed.map((r) => shareEmoji(r.scores)).join('\n')
    const text = `${header}\n${grid}`
    try {
      await navigator.clipboard.writeText(text)
      showToast('Kopioitu leikepöydälle')
    } catch {
      showToast('Kopiointi epäonnistui')
    }
  }, [solution, status, committed, dayKey, showToast])

  const letterKeyState = useMemo(() => {
    const m = new Map<string, TileState>()
    for (const row of committed) {
      const chars = [...row.word]
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i]!
        const st = row.scores[i]!
        if (st === 'correct') m.set(ch, 'correct')
        else if (st === 'present' && m.get(ch) !== 'correct') m.set(ch, 'present')
        else if (st === 'absent' && !m.has(ch)) m.set(ch, 'absent')
      }
    }
    return m
  }, [committed])

  if (loadError) {
    return (
      <div className="sanuli app">
        <p className="app-error" role="alert">
          {loadError}
        </p>
      </div>
    )
  }

  if (!pack || !solution) {
    return (
      <div className="sanuli app">
        <p className="app-loading">Ladataan…</p>
      </div>
    )
  }

  return (
    <div className="sanuli app">
      <header className="sanuli-header">
        <h1>Sanuli</h1>
        <p className="sanuli-lead">
          Arvaa suomenkielinen viisikirjaiminen sana kuudella yrityksellä. Uusi sana joka päivä
          (UTC). Vihreä = oikea paikka, keltainen = väärä paikka, harmaa = ei sanassa.
        </p>
      </header>

      {toast ? (
        <div className="sanuli-toast" role="status">
          {toast}
        </div>
      ) : null}

      <div className="sanuli-board" role="grid" aria-label="Arvausruudukko">
        {Array.from({ length: ROWS }, (_, ri) => {
          const rowCommitted = committed[ri]
          const isCurrent = ri === currentRowIndex && !gameOver
          const letters = rowCommitted
            ? [...rowCommitted.word]
            : isCurrent
              ? [...draft.padEnd(COLS, ' ')].map((c) => (c === ' ' ? '' : c))
              : Array(COLS).fill('')
          const scores = rowCommitted?.scores
          const shake = shakeRow && isCurrent && draft.length === COLS
          return (
            <div
              key={ri}
              className={`sanuli-row${shake ? ' sanuli-row--shake' : ''}`}
              role="row"
              aria-label={`Rivi ${ri + 1}`}
            >
              {letters.map((ch, ci) => {
                const st = scores?.[ci] ?? (ch ? 'tbd' : 'empty')
                const display = ch ? ch.toUpperCase() : ''
                return (
                  <div
                    key={ci}
                    className={tileClass(st)}
                    role="gridcell"
                    aria-label={ch ? `${display}, ${st}` : 'tyhjä'}
                  >
                    {display}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {status === 'won' ? (
        <p className="sanuli-message sanuli-message--won">Hienoa — arvasit oikein!</p>
      ) : null}
      {status === 'lost' ? (
        <p className="sanuli-message sanuli-message--lost" role="status">
          Loppu. Oikea sana: <strong>{solution.toUpperCase()}</strong>
        </p>
      ) : null}

      <div className="sanuli-actions">
        <button type="button" disabled={status === 'playing'} onClick={() => void copyShare()}>
          Jako
        </button>
      </div>

      <div className="sanuli-keyboard" role="group" aria-label="Näppäimistö">
        {KEYBOARD_ROWS.map((row, ri) => (
          <div key={ri} className="sanuli-keyboard__row">
            {row.map((k) => {
              const wide = k === 'Enter' || k === 'Backspace'
              const st = letterKeyState.get(k)
              const cls = [
                'sanuli-key',
                wide ? 'sanuli-key--wide' : '',
                st === 'correct'
                  ? 'sanuli-key--correct'
                  : st === 'present'
                    ? 'sanuli-key--present'
                    : st === 'absent'
                      ? 'sanuli-key--absent'
                      : '',
              ]
                .filter(Boolean)
                .join(' ')
              const label = k === 'Backspace' ? '⌫' : k === 'Enter' ? 'ENTER' : k.toUpperCase()
              return (
                <button
                  key={k + ri}
                  type="button"
                  className={cls}
                  disabled={gameOver}
                  onClick={() => {
                    if (k === 'Enter') onKey('enter')
                    else if (k === 'Backspace') onKey('backspace')
                    else onKey(k)
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
