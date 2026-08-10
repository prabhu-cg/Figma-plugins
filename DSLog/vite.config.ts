import { defineConfig } from "vite";
import path from "node:path";

// Builds the plugin sandbox bundle (runs in Figma's plugin thread, no DOM).
export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
      "@plugin": path.resolve(__dirname, "src/plugin"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    minify: false,
    target: "es2020",
    lib: {
      entry: path.resolve(__dirname, "src/plugin/main.ts"),
      formats: ["iife"],
      name: "DSLogPlugin",
      fileName: () => "code.js",
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
});
