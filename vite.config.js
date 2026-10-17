import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  build: {
    target: 'es2020',
    sourcemap: false,
    assetsInlineLimit: 0, // keep fonts/images as files: cacheable and CSP-friendly (no data: fonts)
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600, // three.js chunk is lazy-loaded on capable devices only
    rollupOptions: {
      input: { main: r('index.html'), admin: r('admin/index.html') },
    },
  },
});
