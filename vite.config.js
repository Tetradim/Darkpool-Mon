import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export const getVendorChunkName = (id) => {
  if (!id.includes('node_modules')) return undefined

  if (id.includes('lucide-react')) return 'vendor-icons'

  if (
    id.includes('recharts') ||
    id.includes('d3-') ||
    id.includes('victory-vendor')
  ) {
    return 'vendor-charts'
  }

  if (
    id.includes('react') ||
    id.includes('react-dom') ||
    id.includes('scheduler')
  ) {
    return 'vendor-react'
  }

  return 'vendor'
}

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: getVendorChunkName,
      },
    },
  },
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
