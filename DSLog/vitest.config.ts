import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
      "@plugin": path.resolve(__dirname, "src/plugin"),
      "@ui": path.resolve(__dirname, "src/ui"),
    },
  },
  test: {
    environment: "node",
    // UI tests opt in to jsdom per file with a `// @vitest-environment jsdom` docblock; everything else stays on node.
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
