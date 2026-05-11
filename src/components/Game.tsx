import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { Level } from '../game/types'
import { gameReducer } from '../game/reducer'
import { createInitialState } from '../game/state'
import { isGiven, isSolved } from '../game/rules'
import {
  formatElapsed,
  loadSolveRecord,
  saveSolveRecord,
  type SolveRecord,
} from '../solveStats'
import { Board } from './Board'
import { NumberPad } from './NumberPad'

type GameProps = {
  level: Level
  tierId: string
  tierTitle: string
  levelIndex: number
  poolCount: number
  onSolved?: () => void
}

export function Game({
  level,
  tierId,
  tierTitle,
  levelIndex,
  poolCount,
  onSolved,
}: GameProps) {
  const [state, dispatch] = useReducer(
    gameReducer,
    level,
    (l) => createInitialState(l),
  )

  const boardRef = useRef<HTMLDivElement>(null)
  const runStartMsRef = useRef(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [resetTick, setResetTick] = useState(0)
  const [storedStats, setStoredStats] = useState<SolveRecord | null>(() =>
    loadSolveRecord(tierId, levelIndex),
  )
  const lastRecordedKey = useRef<string | null>(null)

  useEffect(() => {
    runStartMsRef.current = Date.now()
    const tick = () => setElapsedMs(Date.now() - runStartMsRef.current)
    const t0 = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, 200)
    return () => {
      window.clearTimeout(t0)
      window.clearInterval(id)
    }
  }, [level.id, resetTick])

  const solved = isSolved(state.level, state.values)
  const sel = state.selected
  const canEdit =
    sel !== null && !isGiven(state.level, sel.row, sel.col) && !solved

  useEffect(() => {
    if (!solved) return
    const key = `${tierId}:${levelIndex}`
    if (lastRecordedKey.current === key) return
    lastRecordedKey.current = key
    const ms = Date.now() - runStartMsRef.current
    const rec = saveSolveRecord(tierId, levelIndex, ms)
    setStoredStats(rec)
    onSolved?.()
  }, [solved, tierId, levelIndex, onSolved])

  useEffect(() => {
    lastRecordedKey.current = null
  }, [level.id])

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!sel || solved) return
      if (isGiven(state.level, sel.row, sel.col)) return
      const k = e.key
      if (k === 'Backspace' || k === 'Delete') {
        e.preventDefault()
        dispatch({ type: 'CLEAR_CELL' })
        return
      }
      const d = Number.parseInt(k, 10)
      if (d >= 1 && d <= state.level.maxDigit) {
        e.preventDefault()
        dispatch({ type: 'SET_DIGIT', digit: d })
      }
    },
    [sel, solved, state.level],
  )

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  useEffect(() => {
    if (!sel) return
    const el = boardRef.current?.querySelector<HTMLElement>(
      `[data-row="${sel.row}"][data-col="${sel.col}"]`,
    )
    el?.focus()
  }, [sel])

  return (
    <div className="game">
      <p className="game-meta" aria-live="polite">
        <span className="game-meta__title">{tierTitle}</span>
        <span className="game-meta__sep"> · </span>
        Field {levelIndex + 1}/{poolCount}
        <span className="game-meta__sep"> · </span>
        <span className="game-meta__timer">Time: {formatElapsed(elapsedMs)}</span>
        {storedStats ? (
          <>
            <span className="game-meta__sep"> · </span>
            Best: {formatElapsed(storedStats.bestMs)}
            {storedStats.lastMs !== storedStats.bestMs ? (
              <>
                <span className="game-meta__sep"> · </span>
                Last: {formatElapsed(storedStats.lastMs)}
              </>
            ) : null}
          </>
        ) : null}
      </p>

      <div ref={boardRef}>
        <Board
          state={state}
          onSelect={(row, col) => dispatch({ type: 'SELECT', row, col })}
        />
      </div>

      <NumberPad
        maxDigit={state.level.maxDigit}
        disabled={!canEdit}
        onDigit={(digit) => dispatch({ type: 'SET_DIGIT', digit })}
        onClear={() => dispatch({ type: 'CLEAR_CELL' })}
      />

      <div className="game-actions">
        <button
          type="button"
          onClick={() => {
            dispatch({ type: 'RESET' })
            setResetTick((t) => t + 1)
          }}
        >
          Reset board
        </button>
      </div>

      {solved ? (
        <p className="game-won" role="status">
          Solved — time {formatElapsed(elapsedMs)}.
          {storedStats
            ? ` Best on this board: ${formatElapsed(storedStats.bestMs)}.`
            : ''}
        </p>
      ) : null}
    </div>
  )
}
