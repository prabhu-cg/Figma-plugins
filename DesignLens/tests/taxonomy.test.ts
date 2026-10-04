import { describe, expect, it } from "vitest";
import {
  canonicalState,
  detectComponentKind,
  detectStatesFromVariants,
  statesFromPropertyNames,
  variantStatesOf
} from "../src/plugin/scanner/componentTaxonomy";

describe("detectComponentKind", () => {
  it.each([
    ["Button", "button"],
    ["ButtonPrimary", "button"],
    ["Buttons/Large", "button"],
    ["Icon Button", "button"],
    ["Tab Bar", "tab"],
    ["Text Field", "input"],
    ["Checkbox", "checkbox"],
    ["Toggle", "switch"]
  ])("%s -> %s", (name, kind) => expect(detectComponentKind(name)).toBe(kind));

  it.each(["Table", "Tablet View", "Stage", "Discard", "Linked list", "Selection", "Contact"])(
    "does not mistake %s for a keyword match",
    (name) => expect(detectComponentKind(name)).toBe("unknown")
  );
});

describe("state detection", () => {
  it("normalizes spelling variants", () => {
    expect(canonicalState("Focused")).toBe("focus");
    expect(canonicalState("Focus-visible")).toBe("focus");
    expect(canonicalState("Active")).toBe("pressed");
    expect(canonicalState("Hovered")).toBe("hover");
    expect(canonicalState("Rest")).toBe("default");
  });

  it("returns null for non-state values", () => {
    expect(canonicalState("Primary")).toBeNull();
    expect(canonicalState("Large")).toBeNull();
  });

  it("reads State=… and boolean Disabled=True styles", () => {
    expect(variantStatesOf({ State: "Hover" })).toEqual(["hover"]);
    expect(variantStatesOf({ Disabled: "True" })).toEqual(["disabled"]);
    expect(variantStatesOf({ Disabled: "False" })).toEqual([]);
  });

  it("maps false-valued paired booleans to their opposite state", () => {
    expect(variantStatesOf({ Checked: "False" })).toEqual(["unchecked"]);
    expect(variantStatesOf({ Checked: "True" })).toEqual(["checked"]);
  });

  it("treats boolean component properties as covering a state", () => {
    expect(statesFromPropertyNames(["Disabled#1:0", "Label#2:0"])).toEqual(["disabled"]);
  });

  it("merges variant and property-derived states without duplicates", () => {
    const states = detectStatesFromVariants([{ State: "Default" }, { State: "Focused" }, { State: "Focus" }], ["Disabled#1:0"]);
    expect(states.sort()).toEqual(["default", "disabled", "focus"]);
  });
});
