import { HashRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { DodgePage } from './pages/DodgePage'
import { SanuliPage } from './pages/SanuliPage'
import './App.css'

/** Älä käytä `import.meta.env.BASE_URL` HashRouter-basenameena: hash-polku on `#/…`, ei `/as/…`. */
function GamesHub() {
  return (
    <main className="as-games-hub" aria-label="Pelivalinta">
      <h1 className="as-games-hub__title">Pelit</h1>
      <p className="as-games-hub__lead">Valitse peli:</p>
      <ul className="as-games-hub__list">
        <li>
          <NavLink className="as-games-hub__card" to="/sanuli">
            Sanuli
          </NavLink>
        </li>
        <li>
          <NavLink className="as-games-hub__card" to="/as-daily-life">
            AS Daily life
          </NavLink>
        </li>
      </ul>
    </main>
  )
}

/** Vain Sanuli + AS Daily life (julkaisu esim. https://joniwinsten-lab.github.io/as/). */
export default function AppAsGames() {
  return (
    <HashRouter>
      <nav className="site-nav" aria-label="Pelit">
        <NavLink className="site-nav__link" end to="/">
          Etusivu
        </NavLink>
        <NavLink className="site-nav__link" to="/sanuli">
          Sanuli
        </NavLink>
        <NavLink className="site-nav__link" to="/as-daily-life">
          AS Daily life
        </NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<GamesHub />} />
        <Route path="/sanuli" element={<SanuliPage />} />
        <Route path="/as-daily-life" element={<DodgePage />} />
        <Route path="/vaisto" element={<Navigate to="/as-daily-life" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
