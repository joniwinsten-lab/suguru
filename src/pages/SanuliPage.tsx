import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DAILY_WORD_SLOTS,
  dayKeyUtc,
  pickDailyWordIndices,
} from '../sanuli/dailyWord'
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
const STORAGE_KEY = 'sanuli-state-v3'

type SlotStatus = 'locked' | 'playing' | 'won' | 'lost'

type CommittedRow = { word: string; scores: TileState[] }

type SlotPersisted = {
  status: SlotStatus
  committed: string[]
  draft: string
}

type Persisted = {
  dayKey: string
  slotCount: number
  slots: SlotPersisted[]
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

function emptySlots(count: number): SlotPersisted[] {
  const s: SlotPersisted[] = []
  const n = Math.max(0, Math.min(count, DAILY_WORD_SLOTS))
  for (let i = 0; i < n; i++) {
    s.push({
      status: i === 0 ? 'playing' : 'locked',
      committed: [],
      draft: '',
    })
  }
  return s
}

function loadPersisted(dayKey: string, slotCount: number): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as Persisted
    if (o?.dayKey !== dayKey || !Array.isArray(o.slots)) return null
    const expected =
      typeof o.slotCount === 'number' ? o.slotCount : DAILY_WORD_SLOTS
    if (expected !== slotCount || o.slots.length !== slotCount) return null
    const slots: SlotPersisted[] = []
    for (let i = 0; i < slotCount; i++) {
      const z = o.slots[i]
      if (!z || typeof z !== 'object') return null
      const st = z.status
      if (st !== 'locked' && st !== 'playing' && st !== 'won' && st !== 'lost')
        return null
      slots.push({
        status: st,
        committed: Array.isArray(z.committed)
          ? z.committed.filter((w) => typeof w === 'string' && w.length === COLS)
          : [],
        draft: typeof z.draft === 'string' ? z.draft.slice(0, COLS) : '',
      })
    }
    return { dayKey: o.dayKey, slotCount, slots }
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
  const [indices, setIndices] = useState<number[]>([])
  const [slotsPersist, setSlotsPersist] = useState<SlotPersisted[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [shakeRow, setShakeRow] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [celebration, setCelebration] = useState<{
    slotNumber: number
    message: string
  } | null>(null)
  const toastTimer = useRef<number | null>(null)
  const celebrationTimer = useRef<number | null>(null)

  const allowedSet = useMemo(() => {
    if (!pack) return null
    return new Set(pack.allowed)
  }, [pack])

  const solutionsFive = useMemo(() => {
    if (!pack?.solutions.length || indices.length === 0) return []
    return indices.map((i) => pack.solutions[i] ?? '')
  }, [pack, indices])

  const slotCount = indices.length

  const activeSlot = useMemo(() => {
    if (slotsPersist.length === 0) return 0
    const i = slotsPersist.findIndex((s) => s.status === 'playing' || s.status === 'lost')
    return i >= 0 ? i : slotsPersist.length - 1
  }, [slotsPersist])

  const solution = solutionsFive[activeSlot] ?? ''
  const slotState = slotsPersist[activeSlot]

  const committed = useMemo((): CommittedRow[] => {
    if (!allowedSet || !solution || !slotState) return []
    const rows: CommittedRow[] = []
    for (const w of slotState.committed) {
      if (w.length !== COLS || !allowedSet.has(w)) continue
      rows.push({ word: w, scores: scoreGuess(solution, w) })
    }
    return rows
  }, [allowedSet, solution, slotState])

  const draft = slotState?.draft ?? ''
  const playing = slotState?.status === 'playing'
  const lost = slotState?.status === 'lost'
  const wonCount = slotsPersist.filter((s) => s.status === 'won').length
  const allDone = slotCount > 0 && wonCount >= slotCount
  const wonAttempts = useMemo(
    () =>
      slotsPersist.map((s, i) => ({
        slotNumber: i + 1,
        attempts: s.committed.length,
        won: s.status === 'won',
      })),
    [slotsPersist],
  )

  useEffect(() => {
    let cancelled = false
    loadFiWords()
      .then((p) => {
        if (cancelled) return
        setPack(p)
        if (p.solutions.length < DAILY_WORD_SLOTS) {
          setLoadError(
            `Sanalistassa pitää olla vähintään ${DAILY_WORD_SLOTS} ratkaisua täydelle päivälle (nyt ${p.solutions.length}).`,
          )
          setIndices([])
          return
        }
        setLoadError(null)
        const idx = pickDailyWordIndices(dayKey, p.solutions.length)
        setIndices(idx)
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setLoadError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [dayKey])

  const indicesFingerprint = indices.join(',')

  useEffect(() => {
    if (!pack || indices.length === 0) {
      setHydrated(false)
      return
    }
    const n = indices.length
    const saved = loadPersisted(dayKey, n)
    setSlotsPersist(saved?.slots ?? emptySlots(n))
    setHydrated(true)
  }, [pack, dayKey, indicesFingerprint])

  useEffect(() => {
    if (!hydrated || !pack || indices.length === 0) return
    savePersisted({ dayKey, slotCount: indices.length, slots: slotsPersist })
  }, [hydrated, dayKey, pack, indices.length, slotsPersist])

  useEffect(() => {
    return () => {
      if (celebrationTimer.current) {
        window.clearTimeout(celebrationTimer.current)
        celebrationTimer.current = null
      }
      if (toastTimer.current) {
        window.clearTimeout(toastTimer.current)
        toastTimer.current = null
      }
    }
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => {
      setToast(null)
      toastTimer.current = null
    }, 2400)
  }, [])

  const currentRowIndex = committed.length
  const keyboardDisabled = !playing || allDone || currentRowIndex >= ROWS

  const submitRow = useCallback(() => {
    if (!playing || !solution || !allowedSet || allDone) return
    const guess = normalizeFi(draft)
    if (guess.length !== COLS) return
    if (!allowedSet.has(guess)) {
      setShakeRow(true)
      window.setTimeout(() => setShakeRow(false), 450)
      showToast('Ei sanalistalla')
      return
    }

    const scores = scoreGuess(solution, guess)
    const win = scores.every((t) => t === 'correct')
    const triesAfter = slotState!.committed.length + 1
    const lose = !win && triesAfter >= ROWS

    setSlotsPersist((prev) => {
      const next = prev.map((s) => ({ ...s }))
      const ai = prev.findIndex((s) => s.status === 'playing')
      if (ai < 0) return prev

      const nextWords = [...prev[ai].committed, guess]

      if (win) {
        next[ai] = { status: 'won', committed: nextWords, draft: '' }
        if (ai + 1 < next.length) {
          next[ai + 1] = {
            ...next[ai + 1],
            status: 'playing',
            committed: [],
            draft: '',
          }
        }
      } else if (lose) {
        next[ai] = {
          ...next[ai],
          status: 'lost',
          committed: nextWords,
          draft: '',
        }
      } else {
        next[ai] = {
          ...next[ai],
          status: 'playing',
          committed: nextWords,
          draft: '',
        }
      }
      return next
    })

    if (win) {
      const prevWon = slotsPersist.filter((s) => s.status === 'won').length
      const total = slotsPersist.length
      const solvedAll = prevWon + 1 >= total
      setCelebration({
        slotNumber: activeSlot + 1,
        message: solvedAll ? `Kaikki ${total}/${total} ratkaistu!` : 'Oikein!',
      })
      if (celebrationTimer.current) window.clearTimeout(celebrationTimer.current)
      celebrationTimer.current = window.setTimeout(() => {
        setCelebration(null)
        celebrationTimer.current = null
      }, 2100)
      if (prevWon + 1 >= total)
        showToast(`Kaikki päivän ${total} sanaa ratkaistu!`)
      else showToast('Oikein! Seuraava sana.')
    }
  }, [
    playing,
    solution,
    allowedSet,
    allDone,
    draft,
    slotState,
    slotsPersist,
    showToast,
    activeSlot,
  ])

  const retrySlot = useCallback(() => {
    setSlotsPersist((prev) => {
      const next = prev.map((s) => ({ ...s }))
      const ai = next.findIndex((s) => s.status === 'lost')
      if (ai < 0) return prev
      next[ai] = { status: 'playing', committed: [], draft: '' }
      return next
    })
  }, [])

  const onKey = useCallback(
    (key: string) => {
      if (keyboardDisabled) return
      const k = normalizeFi(key)
      if (k === 'backspace') {
        setSlotsPersist((prev) => {
          const next = prev.map((s) => ({ ...s }))
          const ai = next.findIndex((s) => s.status === 'playing')
          if (ai < 0) return prev
          next[ai].draft = next[ai].draft.slice(0, -1)
          return next
        })
        return
      }
      if (k === 'enter') {
        submitRow()
        return
      }
      if (!isValidFiLetter(k)) return
      setSlotsPersist((prev) => {
        const next = prev.map((s) => ({ ...s }))
        const ai = next.findIndex((s) => s.status === 'playing')
        if (ai < 0) return prev
        const d = next[ai].draft
        if (d.length < COLS) next[ai].draft = d + k.toLowerCase()
        return next
      })
    },
    [keyboardDisabled, submitRow],
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
    if (!solution || !lost) return
    const n = committed.length
    const header = `Sanuli ${dayKeyToFiLabel(dayKey)} · sana ${activeSlot + 1}/${slotCount} · ${n}/${ROWS}`
    const grid = committed.map((r) => shareEmoji(r.scores)).join('\n')
    const text = `${header}\n${grid}`
    try {
      await navigator.clipboard.writeText(text)
      showToast('Kopioitu leikepöydälle')
    } catch {
      showToast('Kopiointi epäonnistui')
    }
  }, [solution, lost, committed, dayKey, activeSlot, slotCount, showToast])

  const copyDailySummary = useCallback(async () => {
    if (!allDone) return
    const header = `Sanuli ${dayKeyToFiLabel(dayKey)} · 5/5`
    const lines = wonAttempts.map((x) => `Sana ${x.slotNumber}: ${x.attempts}/${ROWS}`)
    const compact = wonAttempts.map((x) => `${x.slotNumber}:${x.attempts}`).join('  ')
    const text = `${header}\n${compact}\n${lines.join('\n')}`
    try {
      await navigator.clipboard.writeText(text)
      showToast('Päivän tulos kopioitu')
    } catch {
      showToast('Kopiointi epäonnistui')
    }
  }, [allDone, dayKey, wonAttempts, showToast])

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

  if (!pack || indices.length === 0 || !solution || !hydrated) {
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
          Viisi viisikirjaimista sanaa päivässä (UTC). Kun ratkaiset sanan, saat seuraavan — enintään{' '}
          {DAILY_WORD_SLOTS} sanaa. Kuusi yritystä per sana. Vihreä / keltainen / harmaa kuten Wordlessä.
        </p>
      </header>

      <div
        className="sanuli-progress"
          aria-label={`Päivän sanat: ${wonCount} / ${slotCount}`}
      >
        {slotsPersist.map((s, i) => (
          <span
            key={i}
            className={`sanuli-progress__pill${s.status === 'won' ? ' sanuli-progress__pill--won' : ''}${s.status === 'locked' ? ' sanuli-progress__pill--locked' : ''}${i === activeSlot && (s.status === 'playing' || s.status === 'lost') ? ' sanuli-progress__pill--active' : ''}`}
          >
            {i + 1}
          </span>
        ))}
        <span className="sanuli-progress__meta">
          Ratkaistu {wonCount}/{slotCount}
        </span>
      </div>

      {toast ? (
        <div className="sanuli-toast" role="status">
          {toast}
        </div>
      ) : null}

      {celebration ? (
        <div className="sanuli-celebration" role="status" aria-live="polite">
          <div className="sanuli-celebration__badge" aria-hidden="true">
            🎉
          </div>
          <p className="sanuli-celebration__text">{celebration.message}</p>
          <p className="sanuli-celebration__sub">Sana {celebration.slotNumber} ratkaistu</p>
        </div>
      ) : null}

      {allDone ? (
        <section className="sanuli-day-summary" aria-label="Päivän yhteenveto">
          <p className="sanuli-message sanuli-message--won" role="status">
            Loistavaa — kaikki päivän sanat ratkaistu ({slotCount}/{slotCount})! Palaa huomenna uusien sanojen pariin.
          </p>
          <div className="sanuli-day-summary__card">
            <h2>Päivän tulos</h2>
            <p className="sanuli-day-summary__date">{dayKeyToFiLabel(dayKey)}</p>
            <ul className="sanuli-day-summary__list">
              {wonAttempts.map((item) => (
                <li key={item.slotNumber}>
                  <span>Sana {item.slotNumber}</span>
                  <strong>{item.attempts}/6</strong>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => void copyDailySummary()}>
              Jaa päivän tulos
            </button>
          </div>
        </section>
      ) : null}

      {!allDone ? (
        <>
          <p className="sanuli-slot-label">
            Sana <strong>{activeSlot + 1}</strong> / {slotCount}
          </p>

          <div className="sanuli-board" role="grid" aria-label="Arvausruudukko">
            {Array.from({ length: ROWS }, (_, ri) => {
              const rowCommitted = committed[ri]
              const isCurrent = ri === currentRowIndex && playing
              const letters = rowCommitted
                ? [...rowCommitted.word]
                : isCurrent
                  ? [...draft.padEnd(COLS, ' ')].map((c) => (c === ' ' ? '' : c))
                  : Array(COLS).fill('')
              const scores = rowCommitted?.scores
              const shake = shakeRow && isCurrent && draft.length === COLS && playing
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

          {lost ? (
            <div className="sanuli-after-loss">
              <p className="sanuli-message sanuli-message--lost" role="status">
                Yritykset loppuivat. Oikea sana oli{' '}
                <strong>{solution.toUpperCase()}</strong>. Voit yrittää samaa sanaa uudelleen tai odottaa huomista.
              </p>
              <button type="button" className="sanuli-retry" onClick={() => retrySlot()}>
                Yritä uudelleen
              </button>
            </div>
          ) : null}

          <div className="sanuli-actions">
            <button type="button" disabled={!lost} onClick={() => void copyShare()}>
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
                  const label =
                    k === 'Backspace' ? '⌫' : k === 'Enter' ? 'ENTER' : k.toUpperCase()
                  return (
                    <button
                      key={k + ri}
                      type="button"
                      className={cls}
                      disabled={keyboardDisabled}
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
        </>
      ) : null}
    </div>
  )
}
