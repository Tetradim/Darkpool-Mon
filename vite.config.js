import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendUrl = process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8002'
const backendPrefixes = [
  '/api',
  '/auth',
  '/darkpool',
  '/scanner',
  '/chart',
  '/options',
  '/marketcap',
  '/alerts',
  '/watchlists',
  '/watchlist',
  '/history',
  '/reports',
  '/health',
  '/data',
  '/providers',
  '/ticker',
  '/replay',
  '/admin',
  '/normalize',
  '/schema',
  '/analysis',
  '/nbbo',
  '/vwap',
  '/orderbook',
  '/volume',
  '/sentiment',
  '/ws',
]

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: Object.fromEntries(
      backendPrefixes.map((prefix) => [
        prefix,
        {
          target: backendUrl,
          changeOrigin: true,
          ws: prefix === '/ws',
        },
      ]),
    ),
  },
})
