import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Tất cả request /api/... được chuyển tiếp tới Spring Boot.
      // Frontend không cần biết địa chỉ backend; không bao giờ hardcode
      // 127.0.0.1:8080 bên trong code React.
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: false,
      },
    },
  },
})
