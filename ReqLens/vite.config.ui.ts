import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';

// Builds the plugin UI (runs inside a Figma iframe) into a single
// self-contained dist/ui/index.html with all JS/CSS inlined, since
// Figma plugins cannot load external assets at runtime.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@ui': path.resolve(__dirname, 'src/ui'),
    },
  },
  build: {
    outDir: 'dist/ui',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
    },
  },
});
