type NumberPadProps = {
  maxDigit: number
  onDigit: (d: number) => void
  onClear: () => void
  disabled: boolean
}

export function NumberPad({
  maxDigit,
  onDigit,
  onClear,
  disabled,
}: NumberPadProps) {
  const keys = Array.from({ length: maxDigit }, (_, i) => i + 1)
  return (
    <div className="number-pad" aria-label="Pick a number">
      {keys.map((d) => (
        <button
          key={d}
          type="button"
          className="number-pad__btn"
          disabled={disabled}
          onClick={() => onDigit(d)}
        >
          {d}
        </button>
      ))}
      <button
        type="button"
        className="number-pad__btn number-pad__btn--clear"
        disabled={disabled}
        onClick={onClear}
      >
        Clear
      </button>
    </div>
  )
}
