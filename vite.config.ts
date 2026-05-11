import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** GitHub Pages: repo https://github.com/joniwinsten-lab/suguru → sivu /suguru/ */
const base = process.env.VITE_BASE_PATH ?? '/'
/** Pelisivu vain Sanuli + AS Daily life → `npm run build:gh-pages-as` (julkaisu /as/) */
const asHub = process.env.VITE_AS_HUB === '1'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  ...(asHub
    ? {
        build: {
          outDir: 'dist-as',
          emptyOutDir: true,
          rollupOptions: {
            input: path.resolve(__dirname, 'index-as.html'),
          },
        },
      }
    : {}),
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
