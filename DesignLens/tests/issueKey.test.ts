import { describe, expect, it } from "vitest";
import { issueKey } from "../src/shared/util";

describe("issueKey", () => {
  it("is stable for the same rule and node", () => {
    expect(issueKey({ ruleId: "r", node: { id: "1:2" } })).toBe(issueKey({ ruleId: "r", node: { id: "1:2" } }));
  });

  it("keeps the legacy shape when there is no discriminator", () => {
    expect(issueKey({ ruleId: "r", node: { id: "1:2" } })).toBe("r::1:2");
    expect(issueKey({ ruleId: "r" })).toBe("r::file");
  });

  it("separates findings on the same node by discriminator (fill vs stroke)", () => {
    const fill = issueKey({ ruleId: "r", node: { id: "1:2" }, discriminator: "fill-0" });
    const stroke = issueKey({ ruleId: "r", node: { id: "1:2" }, discriminator: "stroke-0" });
    expect(fill).not.toBe(stroke);
  });

  it("separates node-less findings, so ignoring one variable doesn't ignore them all", () => {
    expect(issueKey({ ruleId: "r", discriminator: "a" })).not.toBe(issueKey({ ruleId: "r", discriminator: "b" }));
  });
});
