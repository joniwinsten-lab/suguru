import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppAsGames from './AppAsGames'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppAsGames />
  </StrictMode>,
)
