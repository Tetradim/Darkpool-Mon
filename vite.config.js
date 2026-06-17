import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/darkpool': 'http://127.0.0.1:8002',
      '/scanner': 'http://127.0.0.1:8002',
      '/alerts': 'http://127.0.0.1:8002',
      '/watchlists': 'http://127.0.0.1:8002',
      '/health': 'http://127.0.0.1:8002',
      '/data': 'http://127.0.0.1:8002',
      '/options': 'http://127.0.0.1:8002',
      '/marketcap': 'http://127.0.0.1:8002',
      '/chart': 'http://127.0.0.1:8002',
      '/replay': 'http://127.0.0.1:8002',
      '/admin': 'http://127.0.0.1:8002',
    },
  },
})
