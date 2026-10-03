import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onPluginMessage, sendToPlugin } from "@ui/state/bridge";
import type { PluginToUiMessage } from "@shared/types/messages";

// Vitest runs in the node environment, so provide the minimal window/parent
// surface bridge.ts touches.
type Listener = (event: { data?: unknown }) => void;

let listeners: Set<Listener>;
let postMessage: ReturnType<typeof vi.fn>;

function dispatch(data: unknown) {
  for (const l of [...listeners]) l({ data });
}

beforeEach(() => {
  listeners = new Set();
  postMessage = vi.fn();
  vi.stubGlobal("parent", { postMessage });
  vi.stubGlobal("window", {
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendToPlugin", () => {
  it("wraps the message in a pluginMessage envelope addressed to any origin", () => {
    sendToPlugin({ type: "scan" });
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({ pluginMessage: { type: "scan" } }, "*");
  });

  it("passes payload fields through untouched", () => {
    const msg = { type: "focus-node", nodeId: "1:2" } as const;
    sendToPlugin(msg);
    expect(postMessage.mock.calls[0]![0].pluginMessage).toBe(msg);
  });
});

describe("onPluginMessage", () => {
  it("delivers the unwrapped plugin message to the handler", () => {
    const handler = vi.fn();
    onPluginMessage(handler);
    const msg: PluginToUiMessage = { type: "error", message: "bad" };
    dispatch({ pluginMessage: msg });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(msg);
  });

  it.each([
    ["no data", undefined],
    ["null data", null],
    ["a string", "hello"],
    ["an object without pluginMessage", { other: 1 }],
    ["a null pluginMessage", { pluginMessage: null }],
  ])("ignores events with %s", (_label, data) => {
    const handler = vi.fn();
    onPluginMessage(handler);
    expect(() => dispatch(data)).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns an unsubscribe function that stops delivery", () => {
    const handler = vi.fn();
    const off = onPluginMessage(handler);
    expect(listeners.size).toBe(1);
    off();
    expect(listeners.size).toBe(0);
    dispatch({ pluginMessage: { type: "error", message: "x" } });
    expect(handler).not.toHaveBeenCalled();
  });

  it("supports multiple independent subscribers", () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = onPluginMessage(a);
    onPluginMessage(b);
    offA();
    dispatch({ pluginMessage: { type: "error", message: "x" } });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
  });
});
