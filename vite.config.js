import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite' // <- 이 부분이 반드시 있어야 합니다!
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost',
        changeOrigin: true,
      },
      '/docs': {
        target: 'http://localhost',
        changeOrigin: true,
      },
    },
  },
})