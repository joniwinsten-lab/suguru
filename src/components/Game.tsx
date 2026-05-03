import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { Level } from '../game/types'
import { gameReducer } from '../game/reducer'
import { createInitialState } from '../game/state'
import { isGiven, isSolved } from '../game/rules'
import { Board } from './Board'
import { NumberPad } from './NumberPad'

type GameProps = {
  level: Level
}

export function Game({ level }: GameProps) {
  const [state, dispatch] = useReducer(
    gameReducer,
    level,
    (l) => createInitialState(l),
  )

  const boardRef = useRef<HTMLDivElement>(null)

  const solved = isSolved(state.level, state.values)
  const sel = state.selected
  const canEdit =
    sel !== null && !isGiven(state.level, sel.row, sel.col) && !solved

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
        <button type="button" onClick={() => dispatch({ type: 'RESET' })}>
          Nollaa taso
        </button>
      </div>

      {solved ? (
        <p className="game-won" role="status">
          Ratkaisu oikein — hyvä!
        </p>
      ) : null}
    </div>
  )
}
