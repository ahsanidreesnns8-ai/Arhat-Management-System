import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Allow Cloudflare quick tunnels / reverse proxies during deploy demos
    allowedHosts: true,
    proxy: {
      // Must proxy before SPA fallback — without this, /api/* returns index.html
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: false,
        timeout: 30_000,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('[vite proxy /api]', err.message)
          })
        },
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
