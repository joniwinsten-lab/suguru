import type { GameState } from '../game/types'
import { cellShowsError, isGiven } from '../game/rules'

type BoardProps = {
  state: GameState
  onSelect: (row: number, col: number) => void
}

const THIN = 1
const THICK = 4
const REGION_COLOR_COUNT = 12

function regionColorClass(regionId: number): string {
  const i = ((regionId % REGION_COLOR_COUNT) + REGION_COLOR_COUNT) % REGION_COLOR_COUNT
  return `board-cell--reg${i}`
}

export function Board({ state, onSelect }: BoardProps) {
  const { level, values, selected } = state
  const { width, height, regions } = level

  const sizeClass =
    width >= 9
      ? 'board--xlarge'
      : width >= 8
        ? 'board--large'
        : width >= 6
          ? 'board--medium'
          : ''

  return (
    <div
      className={`board ${sizeClass}`.trim()}
      style={{
        gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
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
          const rid = regions[row][col]

          const br =
            col === width - 1 || regions[row][col] !== regions[row][col + 1]
              ? THICK
              : THIN
          const bb =
            row === height - 1 || regions[row][col] !== regions[row + 1][col]
              ? THICK
              : THIN

          const edgeStrong = 'var(--board-edge-strong)'
          const edgeInner = 'var(--board-edge-inner)'

          return (
            <button
              key={`${row}-${col}`}
              type="button"
              className={[
                'board-cell',
                regionColorClass(rid),
                sel ? 'board-cell--selected' : '',
                err ? 'board-cell--error' : '',
                given ? 'board-cell--given' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                borderRightWidth: br,
                borderBottomWidth: bb,
                borderRightColor: br === THICK ? edgeStrong : edgeInner,
                borderBottomColor: bb === THICK ? edgeStrong : edgeInner,
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
  if (value === null) return `${pos}, tyhjä`
  const clue = given ? 'vihje' : 'oma numero'
  return `${pos}, ${clue} ${value}`
}
