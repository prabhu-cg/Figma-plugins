import { beforeAll, describe, expect, it } from "vitest";
import {
  compositeOnBackground,
  contrastRatio,
  effectiveOpacity,
  findAncestorBackground,
  findTopSolidFill,
  isLargeText,
  relativeLuminance,
  WCAG_THRESHOLDS
} from "../src/plugin/color/contrast";
import { gradient, installFigmaStub, node, solid } from "./fakes";

const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

beforeAll(() => installFigmaStub());

describe("contrast math", () => {
  it("computes luminance extremes", () => {
    expect(relativeLuminance(BLACK)).toBe(0);
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 5);
  });

  it("gives 21:1 for black on white, regardless of argument order", () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 5);
    expect(contrastRatio(WHITE, BLACK)).toBeCloseTo(21, 5);
  });

  it("matches the known #767676-on-white ratio (just passes AA)", () => {
    const ratio = contrastRatio({ r: 0x76, g: 0x76, b: 0x76 }, WHITE);
    expect(ratio).toBeGreaterThan(4.5);
    expect(ratio).toBeLessThan(4.6);
  });

  it("classifies large text by size and weight", () => {
    expect(isLargeText(24, 400)).toBe(true);
    expect(isLargeText(18.66, 700)).toBe(true);
    expect(isLargeText(18.66, 400)).toBe(false);
    expect(isLargeText(14, 700)).toBe(false);
  });

  it("has stricter AAA thresholds", () => {
    expect(WCAG_THRESHOLDS.AAA.normalText).toBeGreaterThan(WCAG_THRESHOLDS.AA.normalText);
  });
});

describe("compositeOnBackground", () => {
  it("blends a half-transparent black over white to mid gray", () => {
    const out = compositeOnBackground([solid(0, 0, 0, 0.5)], WHITE);
    expect(out.r).toBeCloseTo(127.5, 1);
  });

  it("applies extra (layer) opacity", () => {
    const out = compositeOnBackground([solid(0, 0, 0, 1)], WHITE, 0.5);
    expect(out.g).toBeCloseTo(127.5, 1);
  });

  it("ignores invisible paints", () => {
    expect(compositeOnBackground([solid(0, 0, 0, 1, false)], WHITE)).toEqual(WHITE);
  });
});

describe("findTopSolidFill", () => {
  it("returns the topmost (last) visible solid, since Figma lists paints bottom-to-top", () => {
    const n = node({ fills: [solid(255, 0, 0), solid(0, 0, 255)] });
    expect(findTopSolidFill(n)).toEqual({ r: 0, g: 0, b: 255 });
  });

  it("skips hidden top paints", () => {
    const n = node({ fills: [solid(255, 0, 0), solid(0, 0, 255, 1, false)] });
    expect(findTopSolidFill(n)).toEqual({ r: 255, g: 0, b: 0 });
  });
});

describe("findAncestorBackground", () => {
  it("returns the nearest opaque ancestor fill", () => {
    const text = node({ type: "TEXT" });
    node({ children: [text], fills: [solid(10, 20, 30)] });
    expect(findAncestorBackground(text)).toEqual({ r: 10, g: 20, b: 30 });
  });

  it("falls back to white when no ancestor has a fill", () => {
    const text = node({ type: "TEXT" });
    node({ children: [text] });
    expect(findAncestorBackground(text)).toEqual(WHITE);
  });

  it("returns null behind a gradient, so the caller can skip instead of guessing", () => {
    const text = node({ type: "TEXT" });
    node({ children: [text], fills: [gradient()] });
    expect(findAncestorBackground(text)).toBeNull();
  });

  it("ignores hidden ancestors", () => {
    const text = node({ type: "TEXT" });
    const hiddenMid = node({ children: [text], fills: [solid(255, 0, 0)], visible: false });
    node({ children: [hiddenMid], fills: [solid(0, 0, 0)] });
    expect(findAncestorBackground(text)).toEqual(BLACK);
  });

  it("composites a translucent ancestor over the surface beneath", () => {
    const text = node({ type: "TEXT" });
    const overlay = node({ children: [text], fills: [solid(0, 0, 0, 0.5)] });
    node({ children: [overlay], fills: [solid(255, 255, 255)] });
    const bg = findAncestorBackground(text)!;
    expect(bg.r).toBeCloseTo(127.5, 1);
  });
});

describe("effectiveOpacity", () => {
  it("multiplies opacity up the ancestor chain", () => {
    const leaf = node({ opacity: 0.5 });
    const mid = node({ opacity: 0.5, children: [leaf] });
    node({ type: "PAGE", children: [mid] });
    expect(effectiveOpacity(leaf)).toBeCloseTo(0.25, 5);
  });
});
