import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe("type scale", () => {
  const sources = files("src/ui").filter((f) => /\.(tsx|css)$/.test(f));

  it("uses only the --text-* tokens for font sizes (no one-off sizes)", () => {
    const offenders: string[] = [];
    for (const file of sources) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          const rawCss = /font-size:\s*[0-9.]+(px|rem|em)/.test(line) && !line.includes("--text-"); // the token definitions themselves
          const rawJsx = /fontSize:\s*[0-9.]+/.test(line);
          if (rawCss || rawJsx) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
