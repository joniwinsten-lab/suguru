import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { SanuliPage } from './pages/SanuliPage'
import { SuguruPage } from './pages/SuguruPage'
import './App.css'

function routerBasename(): string {
  const b = import.meta.env.BASE_URL.replace(/\/$/, '')
  return b === '' ? '/' : b
}

export default function App() {
  return (
    <BrowserRouter basename={routerBasename()}>
      <nav className="site-nav" aria-label="Päävalikko">
        <NavLink className="site-nav__link" end to="/">
          Suguru
        </NavLink>
        <NavLink className="site-nav__link" to="/sanuli">
          Sanuli
        </NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<SuguruPage />} />
        <Route path="/sanuli" element={<SanuliPage />} />
      </Routes>
    </BrowserRouter>
  )
}
