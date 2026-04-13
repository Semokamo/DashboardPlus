import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api/telegram': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
