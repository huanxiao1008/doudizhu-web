import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 允許區域網路裝置（如平板）連線到 dev server
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
});
