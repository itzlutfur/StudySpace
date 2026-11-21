import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** The Express API server, proxied during development. */
const API_TARGET = 'http://127.0.0.1:4317';

export default defineConfig({
  plugins: [react()],
  root: 'client',
  build: {
    outDir: '../public/dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': API_TARGET,
      '/player': API_TARGET,
      '/css': API_TARGET,
    },
  },
});
