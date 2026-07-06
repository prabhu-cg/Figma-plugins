import { defineConfig } from 'vite';
import path from 'node:path';

// Builds the plugin's main-thread code (runs in the Figma sandbox, no DOM)
// into a single IIFE bundle at dist/main/index.js, as referenced by manifest.json.
export default defineConfig({
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@main': path.resolve(__dirname, 'src/main'),
    },
  },
  build: {
    outDir: 'dist/main',
    emptyOutDir: true,
    target: 'es2022',
    minify: false,
    sourcemap: false,
    lib: {
      entry: path.resolve(__dirname, 'src/main/index.ts'),
      formats: ['iife'],
      name: 'ReqLensMain',
      fileName: () => 'index.js',
    },
  },
});
