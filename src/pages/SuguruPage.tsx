import { useEffect, useMemo, useState } from 'react'
import { Game } from '../components/Game'
import { loadPool, type PoolPack } from '../poolApi'
import { parseLevel } from '../game/level'
import { POOL_TIERS, type PoolTierId } from '../tiers'
import { formatElapsed, loadSolveRecord } from '../solveStats'

export function SuguruPage() {
  const [tierId, setTierId] = useState<PoolTierId>(POOL_TIERS[0].id)
  const [levelIndex, setLevelIndex] = useState(0)
  const [pool, setPool] = useState<PoolPack | null>(null)
  const [poolError, setPoolError] = useState<string | null>(null)
  const [resultsOpen, setResultsOpen] = useState(false)
  const [resultsTick, setResultsTick] = useState(0)
  const [resultsFilter, setResultsFilter] = useState<'all' | 'solved' | 'unsolved'>('all')
  const [resultsPage, setResultsPage] = useState(0)

  useEffect(() => {
    let cancelled = false
    const tid = window.setTimeout(() => {
      setPoolError(null)
      loadPool(tierId)
        .then((p) => {
          if (!cancelled) {
            setPool(p)
            setPoolError(null)
            setLevelIndex((i) => Math.min(i, p.count - 1))
          }
        })
        .catch((e: unknown) => {
          if (!cancelled)
            setPoolError(e instanceof Error ? e.message : String(e))
        })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(tid)
    }
  }, [tierId])

  const poolForTier = pool?.tierId === tierId ? pool : null
  const levelJson = poolForTier?.levels[levelIndex]
  const level = useMemo(() => {
    if (!levelJson) return null
    try {
      return parseLevel(levelJson)
    } catch (e) {
      console.error(e)
      return null
    }
  }, [levelJson])

  const tierTitle = POOL_TIERS.find((t) => t.id === tierId)?.title ?? tierId
  const levelNum = levelIndex + 1
  const canGoPrev = !!poolForTier && levelIndex > 0
  const canGoNext = !!poolForTier && levelIndex < poolForTier.count - 1
  const tierResults = useMemo(() => {
    if (!poolForTier) return []
    return poolForTier.levels.map((_, i) => {
      const rec = loadSolveRecord(tierId, i)
      return { index: i, rec }
    })
  }, [poolForTier, tierId, resultsTick])
  const solvedCount = tierResults.filter((r) => r.rec).length
  const filteredResults = useMemo(() => {
    if (resultsFilter === 'solved') return tierResults.filter((r) => !!r.rec)
    if (resultsFilter === 'unsolved') return tierResults.filter((r) => !r.rec)
    return tierResults
  }, [tierResults, resultsFilter])
  const RESULTS_PAGE_SIZE = 10
  const resultsPageCount = Math.max(1, Math.ceil(filteredResults.length / RESULTS_PAGE_SIZE))
  const clampedPage = Math.min(resultsPage, resultsPageCount - 1)
  const visibleResults = filteredResults.slice(
    clampedPage * RESULTS_PAGE_SIZE,
    clampedPage * RESULTS_PAGE_SIZE + RESULTS_PAGE_SIZE,
  )

  useEffect(() => {
    setResultsPage(0)
  }, [resultsFilter, tierId, resultsOpen])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Suguru</h1>
        <p className="app-lead">
          Fill each region with different numbers 1…k (k = region size). On an N×N grid the
          largest number is N (4×4 → 1…4, 8×8 → 1…8, 9×9 → 1…9). Neighbouring cells
          (including diagonally) must not contain the same number.
        </p>
      </header>

      <div className="app-toolbar">
        <label className="level-picker">
          <span className="level-picker__label">Difficulty</span>
          <select
            value={tierId}
            onChange={(e) => {
              setTierId(e.target.value as PoolTierId)
              setLevelIndex(0)
            }}
            aria-label="Select difficulty"
          >
            {POOL_TIERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>

        <label className="field-picker">
          <span className="field-picker__label">Puzzle</span>
          <input
            className="field-picker__input"
            type="number"
            min={1}
            max={poolForTier?.count ?? pool?.count ?? 24}
            value={levelNum}
            disabled={!poolForTier}
            onChange={(e) => {
              const v = Number.parseInt(e.target.value, 10)
              if (Number.isNaN(v) || !poolForTier) return
              const clamped = Math.min(Math.max(1, v), poolForTier.count)
              setLevelIndex(clamped - 1)
            }}
            aria-label="Puzzle number in tier"
          />
          <span className="field-picker__meta" aria-live="polite">
            {poolForTier ? ` / ${poolForTier.count}` : ''}
          </span>
        </label>

        <div className="field-nav" role="group" aria-label="Puzzle navigation">
          <button
            type="button"
            disabled={!canGoPrev}
            onClick={() => setLevelIndex((i) => Math.max(0, i - 1))}
          >
            Previous puzzle
          </button>
          <button
            type="button"
            disabled={!canGoNext}
            onClick={() =>
              setLevelIndex((i) =>
                poolForTier ? Math.min(poolForTier.count - 1, i + 1) : i,
              )
            }
          >
            Next puzzle
          </button>
        </div>

        <div className="field-nav" role="group" aria-label="Results">
          <button
            type="button"
            onClick={() => setResultsOpen((v) => !v)}
            disabled={!poolForTier}
          >
            {resultsOpen ? 'Hide results' : 'Results'}
          </button>
        </div>
      </div>

      {resultsOpen && poolForTier ? (
        <section className="results-panel" aria-label="Results">
          <p className="results-panel__meta">
            Solved {solvedCount}/{poolForTier.count}
          </p>
          <div className="results-controls" role="group" aria-label="Filter results">
            <button
              type="button"
              className={resultsFilter === 'all' ? 'is-active' : ''}
              onClick={() => setResultsFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={resultsFilter === 'solved' ? 'is-active' : ''}
              onClick={() => setResultsFilter('solved')}
            >
              Solved
            </button>
            <button
              type="button"
              className={resultsFilter === 'unsolved' ? 'is-active' : ''}
              onClick={() => setResultsFilter('unsolved')}
            >
              Unsolved
            </button>
          </div>
          <div className="results-table-wrap">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Puzzle</th>
                  <th>Status</th>
                  <th>Best</th>
                  <th>Last</th>
                  <th>Runs</th>
                </tr>
              </thead>
              <tbody>
                {visibleResults.map(({ index, rec }) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{rec ? 'Solved' : '—'}</td>
                    <td>{rec ? formatElapsed(rec.bestMs) : '—'}</td>
                    <td>{rec ? formatElapsed(rec.lastMs) : '—'}</td>
                    <td>{rec ? rec.solveCount : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="results-pagination" role="group" aria-label="Results pagination">
            <button
              type="button"
              disabled={clampedPage <= 0}
              onClick={() => setResultsPage((p) => Math.max(0, p - 1))}
            >
              Previous page
            </button>
            <span>
              Page {clampedPage + 1}/{resultsPageCount}
            </span>
            <button
              type="button"
              disabled={clampedPage >= resultsPageCount - 1}
              onClick={() =>
                setResultsPage((p) => Math.min(resultsPageCount - 1, p + 1))
              }
            >
              Next page
            </button>
          </div>
        </section>
      ) : null}

      {poolError ? (
        <p className="app-error" role="alert">
          {poolError}
        </p>
      ) : null}

      {!poolForTier && !poolError ? (
        <p className="app-loading">Loading puzzles…</p>
      ) : null}

      {poolForTier && level ? (
        <Game
          key={`${tierId}-${levelIndex}`}
          level={level}
          tierId={tierId}
          tierTitle={tierTitle}
          levelIndex={levelIndex}
          poolCount={poolForTier.count}
          onSolved={() => setResultsTick((n) => n + 1)}
        />
      ) : null}

      {poolForTier && !level && !poolError ? (
        <p className="app-error" role="alert">
          Invalid puzzle.
        </p>
      ) : null}
    </div>
  )
}
