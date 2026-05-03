import type { GameState, Level } from './types'
import { createInitialState } from './state'
import { isDigitInRangeForCell, isGiven } from './rules'

export type GameAction =
  | { type: 'SELECT'; row: number; col: number }
  | { type: 'SET_DIGIT'; digit: number }
  | { type: 'CLEAR_CELL' }
  | { type: 'RESET' }
  | { type: 'SET_LEVEL'; level: Level }

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SELECT':
      return { ...state, selected: { row: action.row, col: action.col } }
    case 'SET_DIGIT': {
      const sel = state.selected
      if (!sel) return state
      if (isGiven(state.level, sel.row, sel.col)) return state
      if (!isDigitInRangeForCell(state.level, sel.row, sel.col, action.digit)) {
        return state
      }
      const values = state.values.map((row) => [...row])
      values[sel.row][sel.col] = action.digit
      return { ...state, values }
    }
    case 'CLEAR_CELL': {
      const sel = state.selected
      if (!sel) return state
      if (isGiven(state.level, sel.row, sel.col)) return state
      const values = state.values.map((row) => [...row])
      values[sel.row][sel.col] = null
      return { ...state, values }
    }
    case 'RESET':
      return createInitialState(state.level)
    case 'SET_LEVEL':
      return createInitialState(action.level)
    default:
      return state
  }
}
