import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/darkpool': 'http://127.0.0.1:8000',
      '/scanner': 'http://127.0.0.1:8000',
      '/alerts': 'http://127.0.0.1:8000',
      '/watchlists': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
      '/data': 'http://127.0.0.1:8000',
      '/options': 'http://127.0.0.1:8000',
      '/marketcap': 'http://127.0.0.1:8000',
      '/chart': 'http://127.0.0.1:8000',
      '/replay': 'http://127.0.0.1:8000',
      '/admin': 'http://127.0.0.1:8000',
    },
  },
})
