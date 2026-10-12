import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // En desarrollo, las llamadas a /api se redirigen al backend
    proxy: { '/api': 'http://localhost:3000' },
  },
});
