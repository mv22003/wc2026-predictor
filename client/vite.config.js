import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5179,
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.BACKEND_PORT || 3001}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
