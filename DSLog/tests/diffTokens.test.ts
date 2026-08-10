import { describe, expect, it } from "vitest";
import { normalizeToken } from "@plugin/snapshot/normalizeToken";
import { diffTokens } from "@plugin/diff/diffTokens";
import type { VariableInputLike } from "@plugin/scanner/types";
import type { TokenSnapshot } from "@shared/types/token";

function makeToken(overrides: Partial<VariableInputLike> = {}): TokenSnapshot {
  const input: VariableInputLike = {
    id: "token-1",
    name: "spacing.300",
    collectionId: "coll-1",
    collectionName: "Primitives",
    resolvedType: "FLOAT",
    scopes: ["GAP"],
    remote: false,
    valuesByMode: [
      { modeId: "light", modeName: "Light", value: 12 },
      { modeId: "dark", modeName: "Dark", value: 12 },
    ],
    ...overrides,
  };
  return normalizeToken(input);
}

describe("diffTokens", () => {
  it("detects an added token", () => {
    const changes = diffTokens([], [makeToken()]);
    expect(changes[0]?.changeType).toBe("token-added");
  });

  it("detects a removed token", () => {
    const changes = diffTokens([makeToken()], []);
    expect(changes.some((c) => c.changeType === "token-removed")).toBe(true);
  });

  it("detects a renamed token (same id, new name)", () => {
    const before = makeToken();
    const after = makeToken({ name: "spacing.medium" });
    const changes = diffTokens([before], [after]);
    const renamed = changes.find((c) => c.changeType === "token-renamed");
    expect(renamed).toBeDefined();
    expect(renamed?.before).toBe("spacing.300");
    expect(renamed?.after).toBe("spacing.medium");
  });

  it("detects a value change in a single mode only", () => {
    const before = makeToken();
    const after = makeToken({
      valuesByMode: [
        { modeId: "light", modeName: "Light", value: 16 },
        { modeId: "dark", modeName: "Dark", value: 12 },
      ],
    });
    const changes = diffTokens([before], [after]);
    const valueChanged = changes.find((c) => c.changeType === "token-value-changed");
    expect(valueChanged).toBeDefined();
    const lightDetail = valueChanged?.modeDetails?.find((m) => m.modeName === "Light");
    const darkDetail = valueChanged?.modeDetails?.find((m) => m.modeName === "Dark");
    expect(lightDetail?.changed).toBe(true);
    expect(darkDetail?.changed).toBe(false);
  });

  it("detects an added mode", () => {
    const before = makeToken({ valuesByMode: [{ modeId: "light", modeName: "Light", value: 12 }] });
    const after = makeToken();
    const changes = diffTokens([before], [after]);
    expect(changes.some((c) => c.changeType === "token-mode-added")).toBe(true);
  });

  it("detects a removed mode", () => {
    const before = makeToken();
    const after = makeToken({ valuesByMode: [{ modeId: "light", modeName: "Light", value: 12 }] });
    const changes = diffTokens([before], [after]);
    expect(changes.some((c) => c.changeType === "token-mode-removed")).toBe(true);
  });

  it("detects an alias change", () => {
    const before = makeToken({
      resolvedType: "COLOR",
      valuesByMode: [{ modeId: "light", modeName: "Light", value: { r: 0, g: 0, b: 0 } }],
    });
    const after = makeToken({
      resolvedType: "COLOR",
      valuesByMode: [{ modeId: "light", modeName: "Light", value: { type: "VARIABLE_ALIAS", id: "token-2" } }],
      variableNamesById: { "token-2": "color.base" },
    });
    const changes = diffTokens([before], [after]);
    expect(changes.some((c) => c.changeType === "token-alias-changed")).toBe(true);
  });

  it("detects a type change", () => {
    const before = makeToken();
    const after = makeToken({ resolvedType: "STRING", valuesByMode: [{ modeId: "light", modeName: "Light", value: "12px" }, { modeId: "dark", modeName: "Dark", value: "12px" }] });
    const changes = diffTokens([before], [after]);
    expect(changes.some((c) => c.changeType === "token-type-changed")).toBe(true);
  });

  it("produces no changes for identical tokens", () => {
    const token = makeToken();
    expect(diffTokens([token], [token])).toHaveLength(0);
  });
});
