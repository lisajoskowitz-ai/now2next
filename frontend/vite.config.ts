import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves project sites below /<repository>/, while local and
  // non-Pages deployments continue to use the root path.
  base: process.env.GITHUB_ACTIONS ? '/now2next/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
