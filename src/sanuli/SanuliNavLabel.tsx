/** Shown next to “Sanuli” in nav and hub; words / UI for the game stay Finnish. */
export const SANULI_NAME_FOR_SHARE = 'Sanuli (aina suomeksi)'

/** Sanuli is always in Finnish — suffix shown next to the name in the English UI. */
export function SanuliNavLabel() {
  return (
    <>
      Sanuli <span className="lang-note-fi">(aina suomeksi)</span>
    </>
  )
}
