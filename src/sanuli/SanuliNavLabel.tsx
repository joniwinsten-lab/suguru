/** Shown next to “Sanuli” in nav and hub; words / UI for the game stay Finnish. */
export const SANULI_NAME_FOR_SHARE = 'Sanuli (In Finnish)'

/** Sanuli is always in Finnish — suffix shown next to the name in the English UI. */
export function SanuliNavLabel() {
  return (
    <>
      Sanuli <span className="lang-note-fi">(In Finnish)</span>
    </>
  )
}
