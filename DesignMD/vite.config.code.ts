import { defineConfig } from 'vite';
import path from 'path';

// Builds src/plugin/main.ts into a single dist/code.js that runs inside
// Figma's plugin sandbox (no DOM, no bundler runtime helpers relying on document).
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: false,
    sourcemap: false,
    lib: {
      entry: path.resolve(__dirname, 'src/plugin/main.ts'),
      formats: ['iife'],
      name: 'DesignMDPlugin',
      fileName: () => 'code.js',
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
});
