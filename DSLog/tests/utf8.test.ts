import { describe, expect, it } from "vitest";
import { utf8Decode, utf8Encode } from "@shared/utils/utf8";

// Ground truth: Node's real TextEncoder/TextDecoder are available in this
// test environment (unlike Figma's plugin sandbox, which is why chunking.ts
// can't use them directly — see utf8.ts's doc comment).
const nodeEncoder = new TextEncoder();
const nodeDecoder = new TextDecoder();

const SAMPLES = [
  "",
  "hello world",
  "spacing.token.400",
  "café, naïve, résumé", // Latin-1 supplement, 2-byte UTF-8
  "颜色.文本.主要", // CJK, 3-byte UTF-8
  "Кириллица", // Cyrillic, 2-byte UTF-8
  "🎨🔘✨", // emoji, 4-byte UTF-8 / surrogate pairs
  "按钮 Button (Updated) 🔘", // mixed ASCII + CJK + emoji
  "line1\nline2\ttabbed \"quoted\"",
];

describe("utf8Encode", () => {
  for (const sample of SAMPLES) {
    it(`matches TextEncoder byte-for-byte for ${JSON.stringify(sample)}`, () => {
      expect(Array.from(utf8Encode(sample))).toEqual(Array.from(nodeEncoder.encode(sample)));
    });
  }
});

describe("utf8Decode", () => {
  for (const sample of SAMPLES) {
    it(`matches TextDecoder for ${JSON.stringify(sample)}`, () => {
      const bytes = nodeEncoder.encode(sample);
      expect(utf8Decode(bytes)).toBe(nodeDecoder.decode(bytes));
    });
  }

  it("round-trips through encode -> decode for every sample", () => {
    for (const sample of SAMPLES) {
      expect(utf8Decode(utf8Encode(sample))).toBe(sample);
    }
  });
});
