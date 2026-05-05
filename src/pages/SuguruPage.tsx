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

  return (
    <div className="app">
      <header className="app-header">
        <h1>Suguru</h1>
        <p className="app-lead">
          Täytä jokainen alue eri luvuin 1…k (k = alueen koko). N×N-ruudukolla
          suurin käytettävä luku on N (4×4 → 1…4, 8×8 → 1…8, 9×9 → 1…9). Vierekkäiset
          solut (myös vinosti) eivät saa sisältää samaa lukua.
        </p>
      </header>

      <div className="app-toolbar">
        <label className="level-picker">
          <span className="level-picker__label">Vaikeustaso</span>
          <select
            value={tierId}
            onChange={(e) => {
              setTierId(e.target.value as PoolTierId)
              setLevelIndex(0)
            }}
            aria-label="Valitse vaikeustaso"
          >
            {POOL_TIERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>

        <label className="field-picker">
          <span className="field-picker__label">Kenttä</span>
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
            aria-label="Kentän numero tasossa"
          />
          <span className="field-picker__meta" aria-live="polite">
            {poolForTier ? ` / ${poolForTier.count}` : ''}
          </span>
        </label>

        <div className="field-nav" role="group" aria-label="Kentän selaus">
          <button
            type="button"
            disabled={!canGoPrev}
            onClick={() => setLevelIndex((i) => Math.max(0, i - 1))}
          >
            Edellinen kenttä
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
            Seuraava kenttä
          </button>
        </div>

        <div className="field-nav" role="group" aria-label="Tulokset">
          <button
            type="button"
            onClick={() => setResultsOpen((v) => !v)}
            disabled={!poolForTier}
          >
            {resultsOpen ? 'Piilota tulokset' : 'Tulokset'}
          </button>
        </div>
      </div>

      {resultsOpen && poolForTier ? (
        <section className="results-panel" aria-label="Tulokset">
          <p className="results-panel__meta">
            Läpäisty {solvedCount}/{poolForTier.count}
          </p>
          <div className="results-table-wrap">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Kenttä</th>
                  <th>Tila</th>
                  <th>Paras</th>
                  <th>Viimeisin</th>
                  <th>Kerrat</th>
                </tr>
              </thead>
              <tbody>
                {tierResults.map(({ index, rec }) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{rec ? 'Läpäisty' : '—'}</td>
                    <td>{rec ? formatElapsed(rec.bestMs) : '—'}</td>
                    <td>{rec ? formatElapsed(rec.lastMs) : '—'}</td>
                    <td>{rec ? rec.solveCount : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {poolError ? (
        <p className="app-error" role="alert">
          {poolError}
        </p>
      ) : null}

      {!poolForTier && !poolError ? (
        <p className="app-loading">Ladataan kenttiä…</p>
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
          Virheellinen taso.
        </p>
      ) : null}
    </div>
  )
}
