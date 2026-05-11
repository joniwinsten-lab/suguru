import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { SanuliPage } from './pages/SanuliPage'
import { SuguruPage } from './pages/SuguruPage'
import { TeamDailyPage } from './pages/TeamDailyPage'
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
        <NavLink className="site-nav__link" to="/tiimi">
          Tiimi
        </NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<SuguruPage />} />
        <Route path="/sanuli" element={<SanuliPage />} />
        <Route path="/tiimi" element={<TeamDailyPage />} />
      </Routes>
    </HashRouter>
  )
}
