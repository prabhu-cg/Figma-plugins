import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

export default defineConfig({
  root: "src/ui",
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared")
    }
  },
  build: {
    outDir: "../../dist",
    emptyOutDir: false,
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      input: path.resolve(__dirname, "src/ui/ui.html"),
      output: {
        entryFileNames: "ui.js"
      }
    }
  }
});
