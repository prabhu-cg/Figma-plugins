import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

// Builds the plugin UI (iframe) bundle as a single self-contained HTML file,
// since Figma plugin UIs cannot load external network resources.
export default defineConfig({
  root: path.resolve(__dirname, "src/ui"),
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
      "@ui": path.resolve(__dirname, "src/ui"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist-ui"),
    emptyOutDir: true,
    target: "es2020",
    rollupOptions: {
      input: path.resolve(__dirname, "src/ui/index.html"),
    },
  },
});
