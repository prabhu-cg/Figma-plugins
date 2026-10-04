import { describe, expect, it } from "vitest";
import { createCheckpoint, ScanCancelledError } from "../src/plugin/scanner/checkpoint";
import { ruleRegistry } from "../src/plugin/rules/registry";
import type { AuditRule, RuleContext } from "../src/plugin/rules/types";

function clock() {
  let t = 0;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("createCheckpoint", () => {
  it("is a no-op until the time budget is spent", async () => {
    const c = clock();
    let cancelled = true; // would throw if it actually yielded
    const checkpoint = createCheckpoint(() => cancelled, 25, c.now);
    c.advance(10);
    await expect(checkpoint()).resolves.toBeUndefined();
    cancelled = false;
  });

  it("yields to the event loop once the budget is spent, letting a pending cancel message run", async () => {
    const c = clock();
    let cancelled = false;
    // Stands in for figma.ui.onmessage: only runs when the checkpoint yields.
    setTimeout(() => (cancelled = true), 0);
    const checkpoint = createCheckpoint(() => cancelled, 25, c.now);
    c.advance(30);
    await expect(checkpoint()).rejects.toBeInstanceOf(ScanCancelledError);
  });

  it("does not throw when it yields but nothing was cancelled, and resets its budget", async () => {
    const c = clock();
    const checkpoint = createCheckpoint(() => false, 25, c.now);
    c.advance(30);
    await expect(checkpoint()).resolves.toBeUndefined();
    c.advance(5);
    await expect(checkpoint()).resolves.toBeUndefined();
  });
});

describe("cancellation inside a rule", () => {
  const rule: AuditRule = {
    id: "t-cancel",
    category: "tokens",
    title: "t",
    description: "",
    whyItMatters: "",
    severity: "suggestion",
    async evaluate(context) {
      for (let i = 0; i < 5; i++) await context.checkpoint();
      return [{ message: "should not be reached when cancelled" }];
    },
    recommendation: () => ""
  };

  it("propagates ScanCancelledError out of the registry instead of reporting a failed rule", async () => {
    ruleRegistry.register(rule);
    const ctx = {
      isCancelled: () => false,
      checkpoint: async () => {
        throw new ScanCancelledError();
      }
    } as unknown as RuleContext;
    await expect(ruleRegistry.runAll(ctx)).rejects.toBeInstanceOf(ScanCancelledError);
  });
});

describe("real rules honor the checkpoint", () => {
  it("calls it once per component and stops the moment it throws", async () => {
    const { spacingRules } = await import("../src/plugin/rules/spacing");
    const { node } = await import("./fakes");
    const offGrid = spacingRules.find((r) => r.id === "spacing-off-grid")!;
    const record = () => {
      const frame = Object.assign(node({ type: "FRAME" }), {
        layoutMode: "VERTICAL",
        paddingTop: 5,
        paddingRight: 4,
        paddingBottom: 4,
        paddingLeft: 4,
        itemSpacing: 4
      });
      const variant = node({ type: "COMPONENT", children: [frame] });
      return { info: { id: "c", name: "C" }, variantNodes: [variant] };
    };
    const components = [record(), record(), record()];

    let calls = 0;
    const counting = { components, isCancelled: () => false, checkpoint: async () => void calls++ } as unknown as RuleContext;
    const findings = await offGrid.evaluate(counting);
    expect(calls).toBe(3);
    expect(findings).toHaveLength(3); // one off-grid padding-top per component

    let seen = 0;
    const cancelling = {
      components,
      isCancelled: () => false,
      checkpoint: async () => {
        if (++seen === 2) throw new ScanCancelledError();
      }
    } as unknown as RuleContext;
    await expect(offGrid.evaluate(cancelling)).rejects.toBeInstanceOf(ScanCancelledError);
    expect(seen).toBe(2); // did not keep scanning after cancel
  });
});
