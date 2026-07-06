import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

// Builds src/ui into a single self-contained dist/ui.html (Figma iframe UI
// cannot load external files, so JS/CSS must be inlined).
export default defineConfig({
  root: path.resolve(__dirname, 'src/ui'),
  base: './',
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: false,
    minify: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/ui/ui.html'),
      output: {
        entryFileNames: 'ui.js',
      },
    },
  },
});
