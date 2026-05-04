import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/** GitHub Pages: repo https://github.com/joniwinsten-lab/suguru → sivu /suguru/ */
const base = process.env.VITE_BASE_PATH ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
