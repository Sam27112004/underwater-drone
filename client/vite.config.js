import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Outputs directly into Express's static folder
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    // Proxy REST + MJPEG calls to Express in dev.
    // NO WebSocket proxy — frontend connects via window.location.host directly.
    proxy: {
      '/api': 'http://localhost:3000',
      '/video': 'http://localhost:3000',
    },
  },
});
