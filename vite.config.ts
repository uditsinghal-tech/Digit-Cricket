import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Spring Boot backend (digit-cricket-backend) runs on 8080. Proxying keeps
  // the API same-origin in dev, so no CORS config is needed and the session
  // cookie just works.
  server: { proxy: { '/api': 'http://localhost:8080' } },
  // Production: the build lands in the backend's static folder, so the one
  // Spring Boot jar serves both the site and /api from the same domain.
  build: { outDir: '../digit-cricket-backend/src/main/resources/static', emptyOutDir: true },
})
