import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildDailyRounds,
  scoreColorAnswer,
  scoreOrderAnswer,
  scoreTapAnswer,
  type RoundSpec,
} from '../teamGame/engine'
import { utcDayKey, utcMonthRange, utcWeekRange } from '../teamGame/dayKey'
import { fetchLeaderboard, submitScore, type LeaderboardRow } from '../teamGame/leaderboardApi'
import { isSupabaseConfigured } from '../teamGame/supabaseClient'
import { validatePlayerName } from '../teamGame/name'
import './TeamDailyPage.css'

type Phase = 'lobby' | 'playing' | 'done'

type LeaderTab = 'day' | 'week' | 'month' | 'all'

function formatMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)} s`
}

export function TeamDailyPage() {
  const dayKey = useMemo(() => utcDayKey(), [])
  const rounds = useMemo(() => buildDailyRounds(dayKey), [dayKey])

  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('lobby')
  const [roundIndex, setRoundIndex] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const [orderClicks, setOrderClicks] = useState<number[]>([])
  const [feedback, setFeedback] = useState<'ok' | 'bad' | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [finalMs, setFinalMs] = useState<number | null>(null)

  const startMsRef = useRef(0)
  const tickRef = useRef<number | null>(null)

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitOk, setSubmitOk] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [tab, setTab] = useState<LeaderTab>('day')
  const [boardLoading, setBoardLoading] = useState(false)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [boardRows, setBoardRows] = useState<LeaderboardRow[]>([])

  /** Napautuskierros: ensin näytetään oikea ruutu lyhyesti, sitten piilotetaan. */
  const [tapReady, setTapReady] = useState(true)

  const spec = rounds[roundIndex]

  useEffect(() => {
    if (phase !== 'playing' || finalMs != null) return
    const tick = () => setElapsedMs(Date.now() - startMsRef.current)
    tick()
    tickRef.current = window.setInterval(tick, 100)
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
    }
  }, [phase, finalMs])

  useEffect(() => {
    if (feedback === null) return
    const t = window.setTimeout(() => {
      setFeedback(null)
      if (roundIndex >= rounds.length - 1) {
        const end = Date.now() - startMsRef.current
        setFinalMs(end)
        if (tickRef.current) window.clearInterval(tickRef.current)
        setPhase('done')
      } else {
        setRoundIndex((i) => i + 1)
        setOrderClicks([])
      }
    }, 480)
    return () => window.clearTimeout(t)
  }, [feedback, roundIndex, rounds.length])

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
      const rows = await fetchLeaderboard(start, end)
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
    let innerTimer: number | undefined
    const outer = window.setTimeout(() => {
      if (phase !== 'playing') {
        setTapReady(true)
        return
      }
      const r = rounds[roundIndex]
      if (!r || r.kind !== 'tap') {
        setTapReady(true)
        return
      }
      setTapReady(false)
      innerTimer = window.setTimeout(() => setTapReady(true), 900)
    }, 0)
    return () => {
      window.clearTimeout(outer)
      if (innerTimer !== undefined) window.clearTimeout(innerTimer)
    }
  }, [phase, roundIndex, rounds])

  const startGame = () => {
    const err = validatePlayerName(name)
    setNameError(err)
    if (err) return
    setTotalScore(0)
    setRoundIndex(0)
    setOrderClicks([])
    setFeedback(null)
    setFinalMs(null)
    setSubmitError(null)
    setSubmitOk(false)
    startMsRef.current = Date.now()
    setElapsedMs(0)
    setPhase('playing')
  }

  const applyRoundPoints = (points: number) => {
    setTotalScore((s) => s + points)
    setFeedback(points > 0 ? 'ok' : 'bad')
  }

  const onColorPick = (idx: number) => {
    if (phase !== 'playing' || feedback !== null) return
    const r = spec as Extract<RoundSpec, { kind: 'color' }>
    applyRoundPoints(scoreColorAnswer(r, idx))
  }

  const onOrderClick = (n: number) => {
    if (phase !== 'playing' || feedback !== null) return
    const r = spec as Extract<RoundSpec, { kind: 'order' }>
    const next = [...orderClicks, n]
    setOrderClicks(next)
    if (next.length === 3) {
      applyRoundPoints(scoreOrderAnswer(r, next))
    }
  }

  const onTapCell = (idx: number) => {
    if (phase !== 'playing' || feedback !== null || !tapReady) return
    const r = spec as Extract<RoundSpec, { kind: 'tap' }>
    applyRoundPoints(scoreTapAnswer(r, idx))
  }

  const onSubmit = async () => {
    if (!isSupabaseConfigured()) {
      setSubmitError('Tulosten lähetys vaatii Supabase-konfiguraation.')
      return
    }
    if (finalMs == null) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitScore({
        playerName: name.trim(),
        dayKey,
        score: totalScore,
        timeMs: finalMs,
      })
      setSubmitOk(true)
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

  const roundLabel = roundIndex + 1

  return (
    <div className="app team-daily">
      <header className="app-header">
        <h1>Tiimin päiväpeli</h1>
        <p className="team-daily__lead">
          Lyhyt reaktio- ja tarkkuusrundi: sama haaste kaikille (UTC {dayKey}). Yksi yritys päivässä
          per nimi. Pisteet ratkaisevat, tasapelissä nopeampi aika voittaa.
        </p>
      </header>

      {phase === 'lobby' ? (
        <section className="team-daily__panel" aria-label="Aloitus">
          <label className="team-daily__label" htmlFor="team-player-name">
            Nimi (top-listoissa)
          </label>
          <input
            id="team-player-name"
            className="team-daily__input"
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
            <p className="team-daily__error" role="alert">
              {nameError}
            </p>
          ) : null}
          <button
            type="button"
            className="team-daily__btn team-daily__btn--primary"
            onClick={startGame}
          >
            Aloita ({rounds.length} kierrosta)
          </button>
        </section>
      ) : null}

      {phase === 'playing' ? (
        <section className="team-daily__panel" aria-live="polite">
          <div className="team-daily__scoreline">
            <span>
              Kierros {roundLabel}/{rounds.length}
            </span>
            <span className="team-daily__timer">{formatMs(elapsedMs)}</span>
          </div>
          <p className="team-daily__hint">Pisteet: {totalScore}</p>

          {spec.kind === 'color' ? (
            <>
              <p className="team-daily__hint">Valitse oikea väri (yksi oikea).</p>
              <div className="team-daily__colors">
                {spec.colors.map((c, i) => (
                  <button
                    key={`${c}-${i}`}
                    type="button"
                    className="team-daily__color-btn"
                    style={{ background: c }}
                    aria-label={`Väri ${i + 1}`}
                    disabled={feedback !== null}
                    onClick={() => onColorPick(i)}
                  />
                ))}
              </div>
            </>
          ) : null}

          {spec.kind === 'order' ? (
            <>
              <p className="team-daily__hint">
                {spec.clickOrder === 'asc'
                  ? 'Paina luvut nousevassa järjestyksessä (pienin ensin).'
                  : 'Paina luvut laskevassa järjestyksessä (suurin ensin).'}
              </p>
              <div className="team-daily__order-btns">
                {spec.shuffled.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="team-daily__order-btn"
                    disabled={feedback !== null || orderClicks.includes(n)}
                    onClick={() => onOrderClick(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {spec.kind === 'tap' ? (
            <>
              <p className="team-daily__hint">
                {tapReady
                  ? 'Napauta sama ruutu kuin äsken korostettiin.'
                  : 'Muista korostettu ruutu…'}
              </p>
              <div className="team-daily__grid3" role="grid" aria-label="3 kertaa 3">
                {Array.from({ length: 9 }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    className="team-daily__cell"
                    style={
                      !tapReady && i === spec.correctIndex
                        ? { boxShadow: 'inset 0 0 0 3px var(--accent)' }
                        : undefined
                    }
                    aria-label={`Solu ${i + 1}`}
                    disabled={feedback !== null || !tapReady}
                    onClick={() => onTapCell(i)}
                  />
                ))}
              </div>
            </>
          ) : null}

          <div
            className={`team-daily__flash${feedback === 'ok' ? ' team-daily__flash--ok' : ''}${feedback === 'bad' ? ' team-daily__flash--bad' : ''}`}
            aria-live="assertive"
          >
            {feedback === 'ok' ? '+10' : feedback === 'bad' ? '0' : ''}
          </div>
        </section>
      ) : null}

      {phase === 'done' && finalMs != null ? (
        <section className="team-daily__panel" aria-label="Tulos">
          <p className="team-daily__hint">
            Aika: <strong>{formatMs(finalMs)}</strong> · Pisteet: <strong>{totalScore}</strong>
          </p>
          {!isSupabaseConfigured() ? (
            <p className="team-daily__error" role="status">
              Supabase ei ole käytössä: tulosta ei voi tallentaa. Aseta VITE_SUPABASE_URL ja
              VITE_SUPABASE_ANON_KEY.
            </p>
          ) : (
            <>
              {submitOk ? (
                <p className="team-daily__hint" role="status">
                  Tulos tallennettu. Kiitos pelistä!
                </p>
              ) : (
                <button
                  type="button"
                  className="team-daily__btn team-daily__btn--primary"
                  disabled={submitting}
                  onClick={() => void onSubmit()}
                >
                  {submitting ? 'Lähetetään…' : 'Lähetä tulos'}
                </button>
              )}
              {submitError ? (
                <p className="team-daily__error" role="alert">
                  {submitError}
                </p>
              ) : null}
            </>
          )}
          <button
            type="button"
            className="team-daily__btn"
            style={{ marginTop: '0.5rem' }}
            onClick={() => {
              setPhase('lobby')
              setFinalMs(null)
            }}
          >
            Takaisin alkuun
          </button>
        </section>
      ) : null}

      <section className="team-daily__panel" aria-label="Top-listat">
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Top-listat</h2>
        <div className="team-daily__tabs" role="tablist" aria-label="Aikajänne">
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
              className={`team-daily__tab${tab === id ? ' is-active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {!isSupabaseConfigured() ? (
          <p className="team-daily__hint">Top-listat näkyvät, kun Supabase on konfiguroitu.</p>
        ) : boardLoading ? (
          <p className="team-daily__hint">Ladataan…</p>
        ) : boardError ? (
          <p className="team-daily__error" role="alert">
            {boardError}
          </p>
        ) : (
          <div className="team-daily__table-wrap">
            <table className="team-daily__table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nimi</th>
                  <th>Pisteet</th>
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
                      <td>{row.score}</td>
                      <td>{formatMs(row.time_ms)}</td>
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
