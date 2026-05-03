import type { GameState, Level } from './types'

export function createInitialState(level: Level): GameState {
  const values = level.givens.map((row) => [...row])
  return { level, values, selected: null }
}
