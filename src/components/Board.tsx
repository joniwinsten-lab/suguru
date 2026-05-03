import type { GameState } from '../game/types'
import { cellShowsError, isGiven } from '../game/rules'

type BoardProps = {
  state: GameState
  onSelect: (row: number, col: number) => void
}

export function Board({ state, onSelect }: BoardProps) {
  const { level, values, selected } = state
  const { width, height, regions } = level

  return (
    <div
      className="board"
      style={{
        gridTemplateColumns: `repeat(${width}, minmax(2.5rem, 1fr))`,
      }}
      role="grid"
      aria-label="Suguru-ruudukko"
    >
      {Array.from({ length: height }, (_, row) =>
        Array.from({ length: width }, (_, col) => {
          const v = values[row][col]
          const sel = selected?.row === row && selected?.col === col
          const err = cellShowsError(level, values, row, col)
          const given = isGiven(level, row, col)
          const thick = 3
          const thin = 1
          const br =
            col < width - 1 && regions[row][col] !== regions[row][col + 1]
              ? thick
              : thin
          const bb =
            row < height - 1 && regions[row][col] !== regions[row + 1][col]
              ? thick
              : thin
          const rid = regions[row][col]
          const hue = (rid * 47) % 360

          return (
            <button
              key={`${row}-${col}`}
              type="button"
              className={[
                'board-cell',
                sel ? 'board-cell--selected' : '',
                err ? 'board-cell--error' : '',
                given ? 'board-cell--given' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                borderRightWidth: br,
                borderBottomWidth: bb,
                background: `hsl(${hue} 35% var(--cell-lightness, 92%) / 0.55)`,
              }}
              aria-pressed={sel}
              aria-label={describeCell(row, col, v, given)}
              data-row={row}
              data-col={col}
              onClick={() => onSelect(row, col)}
            >
              {v ?? ''}
            </button>
          )
        }),
      ).flat()}
    </div>
  )
}

function describeCell(
  row: number,
  col: number,
  value: number | null,
  given: boolean,
): string {
  const pos = `Rivi ${row + 1}, sarake ${col + 1}`
  if (value === null) return `${pos}, tyhjä${given ? '' : ''}`
  const clue = given ? 'vihje' : 'oma numero'
  return `${pos}, ${clue} ${value}`
}
