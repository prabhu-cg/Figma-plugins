import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeComponent } from "@plugin/snapshot/normalizeComponent";
import { normalizeToken } from "@plugin/snapshot/normalizeToken";
import { diffComponents } from "@plugin/diff/diffComponents";
import { diffTokens } from "@plugin/diff/diffTokens";
import type { ComponentInputLike, VariableInputLike } from "@plugin/scanner/types";

interface FixtureFile {
  components: ComponentInputLike[];
  tokens: VariableInputLike[];
}

function loadFixture(name: string): FixtureFile {
  const raw = readFileSync(path.resolve(import.meta.dirname, "..", "fixtures", name), "utf-8");
  return JSON.parse(raw) as FixtureFile;
}

const fixtures = [
  { name: "small-ds.json" },
  { name: "medium-ds.json" },
  { name: "large-ds.json" },
];

describe.each(fixtures)("fixture: $name", ({ name }) => {
  const data = loadFixture(name);

  it("normalizes every component and token without throwing", () => {
    const components = data.components.map(normalizeComponent);
    const tokens = data.tokens.map(normalizeToken);
    expect(components).toHaveLength(data.components.length);
    expect(tokens).toHaveLength(data.tokens.length);
  });

  it("diffing an unmodified snapshot against itself produces no changes", () => {
    const components = data.components.map(normalizeComponent);
    const tokens = data.tokens.map(normalizeToken);
    expect(diffComponents(components, components)).toHaveLength(0);
    expect(diffTokens(tokens, tokens)).toHaveLength(0);
  });

  it("detects a single injected change at scale without crashing", () => {
    const components = data.components.map(normalizeComponent);

    const mutatedInput: ComponentInputLike = JSON.parse(JSON.stringify(data.components[0]));
    mutatedInput.representative.width = (mutatedInput.representative.width ?? 0) + 999;
    const mutatedComponents = [normalizeComponent(mutatedInput), ...components.slice(1)];

    const changes = diffComponents(components, mutatedComponents);
    expect(changes.some((c) => c.changeType === "dimensions-changed")).toBe(true);
  });

  it("detects a single injected token value change at scale", () => {
    const tokens = data.tokens.map(normalizeToken);

    const mutatedInput: VariableInputLike = JSON.parse(JSON.stringify(data.tokens[0]));
    const firstMode = mutatedInput.valuesByMode[0];
    if (firstMode) {
      if (typeof firstMode.value === "number") {
        firstMode.value += 1;
      } else if (firstMode.value && typeof firstMode.value === "object" && "r" in firstMode.value) {
        (firstMode.value as { r: number }).r = Math.min(1, (firstMode.value as { r: number }).r + 0.1);
      }
    }
    const mutatedTokens = [normalizeToken(mutatedInput), ...tokens.slice(1)];

    const changes = diffTokens(tokens, mutatedTokens);
    expect(changes.length).toBeGreaterThan(0);
  });
});
