import { beforeEach, describe, expect, it } from "vitest";
import { getIssueStatusMap, setIssueStatus, setIssueStatuses } from "../src/plugin/persistence";
import { installFigmaStub } from "./fakes";

function stubStorage(delayMs = 0) {
  const store = new Map<string, unknown>();
  installFigmaStub({
    clientStorage: {
      getAsync: async (k: string) => {
        await new Promise((r) => setTimeout(r, delayMs));
        return store.get(k);
      },
      setAsync: async (k: string, v: unknown) => {
        await new Promise((r) => setTimeout(r, delayMs));
        store.set(k, v);
      }
    }
  });
}

describe("issue status persistence", () => {
  beforeEach(() => stubStorage(2));

  it("applies a bulk update in one write", async () => {
    await setIssueStatuses("f", [
      { issueKey: "a", status: "resolved" },
      { issueKey: "b", status: "ignored" }
    ]);
    expect(await getIssueStatusMap("f")).toEqual({ a: "resolved", b: "ignored" });
  });

  it("deletes the entry when a status goes back to open", async () => {
    await setIssueStatus("f2", "a", "resolved");
    await setIssueStatus("f2", "a", "open");
    expect(await getIssueStatusMap("f2")).toEqual({});
  });

  it("does not lose updates when messages arrive concurrently", async () => {
    await Promise.all([setIssueStatus("f3", "a", "resolved"), setIssueStatus("f3", "b", "resolved"), setIssueStatus("f3", "c", "ignored")]);
    expect(await getIssueStatusMap("f3")).toEqual({ a: "resolved", b: "resolved", c: "ignored" });
  });

  it("keeps files separate", async () => {
    await setIssueStatus("x", "a", "resolved");
    expect(await getIssueStatusMap("y")).toEqual({});
  });
});
