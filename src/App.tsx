import { useLayoutEffect, useMemo, useState } from 'react'
import { Game } from './components/Game'
import { levels } from './levels'
import { applyTheme, readStoredTheme, type UiTheme } from './theme'
import './App.css'

function App() {
  const [levelId, setLevelId] = useState(levels[0].id)
  const [uiTheme, setUiTheme] = useState<UiTheme>(readStoredTheme)

  const level = useMemo(
    () => levels.find((l) => l.id === levelId) ?? levels[0],
    [levelId],
  )

  useLayoutEffect(() => {
    applyTheme(uiTheme)
  }, [uiTheme])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Suguru</h1>
        <p className="app-lead">
          Täytä jokainen alue luvuilla 1…n (n = alueen koko). Vierekkäiset
          solut (myös vinosti) eivät saa sisältää samaa lukua.
        </p>
      </header>

      <div className="app-toolbar">
        <label className="level-picker">
          <span className="level-picker__label">Taso</span>
          <select
            value={levelId}
            onChange={(e) => setLevelId(e.target.value)}
            aria-label="Valitse taso"
          >
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </label>

        <label className="theme-picker">
          <span className="theme-picker__label">Teema</span>
          <select
            value={uiTheme}
            onChange={(e) => setUiTheme(e.target.value as UiTheme)}
            aria-label="Valitse värimaailma"
          >
            <option value="pastel">Pastelli</option>
            <option value="dark">Tumma</option>
            <option value="colorful">Värikäs</option>
          </select>
        </label>
      </div>

      <Game key={level.id} level={level} />
    </div>
  )
}

export default App
