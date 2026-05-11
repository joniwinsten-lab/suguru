import { HashRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { DodgePage } from './pages/DodgePage'
import { SanuliPage } from './pages/SanuliPage'
import { SanuliNavLabel } from './sanuli/SanuliNavLabel'
import { SuguruPage } from './pages/SuguruPage'
import './App.css'

/** Hash-reititys: GitHub Pages ei ohjaa /sanuli-polkuja SPA:lle (#/sanuli toimii ilman 404.html-temppua). */
export default function App() {
  return (
    <HashRouter>
      <nav className="site-nav" aria-label="Main menu">
        <NavLink className="site-nav__link" end to="/">
          Suguru
        </NavLink>
        <NavLink className="site-nav__link" to="/sanuli">
          <SanuliNavLabel />
        </NavLink>
        <NavLink className="site-nav__link" to="/as-daily-life">
          AS Daily life
        </NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<SuguruPage />} />
        <Route path="/sanuli" element={<SanuliPage />} />
        <Route path="/as-daily-life" element={<DodgePage />} />
        <Route path="/vaisto" element={<Navigate to="/as-daily-life" replace />} />
      </Routes>
    </HashRouter>
  )
}
