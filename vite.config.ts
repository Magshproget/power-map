import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/power-map/' : './',
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'leaflet-vendor': ['leaflet'],
          'lucide-vendor': ['lucide-react'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/loe': {
        target: 'https://api.loe.lviv.ua/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/loe/, ''),
        secure: false,
      },
      '/api/power-loe': {
        target: 'https://power-api.loe.lviv.ua/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/power-loe/, ''),
        secure: false,
      },
    },
  },
});
