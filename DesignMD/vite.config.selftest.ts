import { defineConfig } from 'vite';
import path from 'path';

// Builds the real-node self-test plugin (src/plugin/selftest) into dist/selftest.js.
export default defineConfig({
  resolve: { alias: { '@shared': path.resolve(__dirname, 'src/shared') } },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: false,
    sourcemap: false,
    lib: {
      entry: path.resolve(__dirname, 'src/plugin/selftest/main.ts'),
      formats: ['iife'],
      name: 'DesignMDSelfTest',
      fileName: () => 'selftest.js',
    },
    rollupOptions: { output: { extend: true } },
  },
});
