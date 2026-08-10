import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
mkdirSync(path.join(root, "dist"), { recursive: true });
copyFileSync(
  path.join(root, "dist-ui", "index.html"),
  path.join(root, "dist", "ui.html"),
);
console.log("Copied dist-ui/index.html -> dist/ui.html");
