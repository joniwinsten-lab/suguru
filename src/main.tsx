import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const saved = localStorage.getItem('suguru-ui-theme')
if (saved === 'dark' || saved === 'pastel' || saved === 'colorful') {
  document.documentElement.dataset.uiTheme = saved
} else {
  document.documentElement.dataset.uiTheme = 'pastel'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
