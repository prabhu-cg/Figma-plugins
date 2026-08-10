import { describe, expect, it } from "vitest";
import { normalizeToken } from "@plugin/snapshot/normalizeToken";
import type { VariableInputLike } from "@plugin/scanner/types";

function baseInput(overrides: Partial<VariableInputLike> = {}): VariableInputLike {
  return {
    id: "var-1",
    key: "var-key-1",
    name: "color.text.primary",
    collectionId: "coll-1",
    collectionName: "Primitives",
    resolvedType: "COLOR",
    scopes: ["ALL_FILLS"],
    description: "Primary text color",
    remote: false,
    valuesByMode: [
      { modeId: "light", modeName: "Light", value: { r: 0.13, g: 0.13, b: 0.13 } },
      { modeId: "dark", modeName: "Dark", value: { r: 1, g: 1, b: 1 } },
    ],
    ...overrides,
  };
}

describe("normalizeToken", () => {
  it("converts COLOR values to hex", () => {
    const snapshot = normalizeToken(baseInput());
    const light = snapshot.valuesByMode.find((m) => m.modeName === "Light");
    expect(light?.value).toBe("#212121");
  });

  it("captures variable aliases", () => {
    const snapshot = normalizeToken(
      baseInput({
        valuesByMode: [
          { modeId: "light", modeName: "Light", value: { type: "VARIABLE_ALIAS", id: "var-2" } },
          { modeId: "dark", modeName: "Dark", value: { r: 1, g: 1, b: 1 } },
        ],
        variableNamesById: { "var-2": "color.text.base" },
      }),
    );
    const light = snapshot.valuesByMode.find((m) => m.modeName === "Light");
    expect(light?.aliasTo?.variableId).toBe("var-2");
    expect(light?.aliasTo?.variableName).toBe("color.text.base");
  });

  it("is deterministic for identical input", () => {
    const a = normalizeToken(baseInput());
    const b = normalizeToken(baseInput());
    expect(a.hash).toBe(b.hash);
  });

  it("changes hash when a mode value changes", () => {
    const a = normalizeToken(baseInput());
    const b = normalizeToken(
      baseInput({
        valuesByMode: [
          { modeId: "light", modeName: "Light", value: { r: 0.5, g: 0.5, b: 0.5 } },
          { modeId: "dark", modeName: "Dark", value: { r: 1, g: 1, b: 1 } },
        ],
      }),
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it("sorts modes by name for determinism", () => {
    const snapshot = normalizeToken(
      baseInput({
        valuesByMode: [
          { modeId: "dark", modeName: "Dark", value: { r: 1, g: 1, b: 1 } },
          { modeId: "light", modeName: "Light", value: { r: 0, g: 0, b: 0 } },
        ],
      }),
    );
    expect(snapshot.valuesByMode.map((m) => m.modeName)).toEqual(["Dark", "Light"]);
  });
});
