import { HashRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { DodgePage } from './pages/DodgePage'
import { SanuliPage } from './pages/SanuliPage'
import { SanuliNavLabel } from './sanuli/SanuliNavLabel'
import './App.css'

/** Do not use `import.meta.env.BASE_URL` as HashRouter basename: routes live in `#/…`, not `/as/…`. */
function GamesHub() {
  return (
    <main className="as-games-hub" aria-label="Game picker">
      <h1 className="as-games-hub__title">Games</h1>
      <p className="as-games-hub__lead">Choose a game:</p>
      <ul className="as-games-hub__list">
        <li>
          <NavLink className="as-games-hub__card" to="/sanuli">
            <SanuliNavLabel />
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

/** Sanuli + AS Daily life only (e.g. https://joniwinsten-lab.github.io/as/). */
export default function AppAsGames() {
  return (
    <HashRouter>
      <nav className="site-nav" aria-label="Games">
        <NavLink className="site-nav__link" end to="/">
          Home
        </NavLink>
        <NavLink className="site-nav__link" to="/sanuli">
          <SanuliNavLabel />
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
