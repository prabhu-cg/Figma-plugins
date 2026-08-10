import { describe, expect, it } from "vitest";
import { fnv1aHash, hashObject, stableStringify } from "@shared/utils/hash";

describe("stableStringify", () => {
  it("produces identical output regardless of key order", () => {
    const a = { b: 2, a: 1, c: { y: 2, x: 1 } };
    const b = { a: 1, c: { x: 1, y: 2 }, b: 2 };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it("preserves array order", () => {
    expect(stableStringify([1, 2, 3])).not.toBe(stableStringify([3, 2, 1]));
  });
});

describe("hashObject", () => {
  it("is deterministic for equivalent objects", () => {
    expect(hashObject({ a: 1, b: 2 })).toBe(hashObject({ b: 2, a: 1 }));
  });

  it("changes when a value changes", () => {
    expect(hashObject({ a: 1 })).not.toBe(hashObject({ a: 2 }));
  });

  it("fnv1aHash returns 8 hex characters", () => {
    expect(fnv1aHash("dslog")).toMatch(/^[0-9a-f]{8}$/);
  });
});
