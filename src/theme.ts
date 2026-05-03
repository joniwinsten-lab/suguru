export type UiTheme = 'pastel' | 'dark' | 'colorful'

export function readStoredTheme(): UiTheme {
  const s = localStorage.getItem('suguru-ui-theme')
  if (s === 'dark' || s === 'pastel' || s === 'colorful') return s
  return 'pastel'
}

export function applyTheme(theme: UiTheme): void {
  document.documentElement.dataset.uiTheme = theme
  localStorage.setItem('suguru-ui-theme', theme)
}
