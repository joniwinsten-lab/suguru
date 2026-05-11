import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { DodgePage } from './pages/DodgePage'
import { SanuliPage } from './pages/SanuliPage'
import { SuguruPage } from './pages/SuguruPage'
import './App.css'

/** Hash-reititys: GitHub Pages ei ohjaa /sanuli-polkuja SPA:lle (#/sanuli toimii ilman 404.html-temppua). */
export default function App() {
  return (
    <HashRouter>
      <nav className="site-nav" aria-label="Päävalikko">
        <NavLink className="site-nav__link" end to="/">
          Suguru
        </NavLink>
        <NavLink className="site-nav__link" to="/sanuli">
          Sanuli
        </NavLink>
        <NavLink className="site-nav__link" to="/vaisto">
          Väistö
        </NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<SuguruPage />} />
        <Route path="/sanuli" element={<SanuliPage />} />
        <Route path="/vaisto" element={<DodgePage />} />
      </Routes>
    </HashRouter>
  )
}
