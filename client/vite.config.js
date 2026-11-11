import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The browser talks to Vite on port 5173. Anything starting with /api is
// forwarded to the Express server, so the sign-in cookie stays on one origin.
// If you change PORT in server/.env, change the target below to match.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: false },
    },
  },
});
