// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/* eslint-disable @typescript-eslint/no-explicit-any */

// A controllable IntersectionObserver: tests decide when "the end of the list scrolled into view".
const io = vi.hoisted(() => {
  const instances: Array<{ callback: (entries: Array<{ isIntersecting: boolean }>) => void; observed: Element[]; disconnected: boolean; options: any }> = [];
  class FakeIntersectionObserver {
    record: (typeof instances)[number];
    constructor(callback: any, options: any) {
      this.record = { callback, observed: [], disconnected: false, options };
      instances.push(this.record);
    }
    observe(el: Element) {
      this.record.observed.push(el);
    }
    disconnect() {
      this.record.disconnected = true;
    }
    unobserve() {}
    takeRecords() {
      return [];
    }
  }
  (globalThis as any).IntersectionObserver = FakeIntersectionObserver;
  return { instances };
});

// Count how often a row's contents actually render.
const renders = vi.hoisted(() => ({ categoryBadge: 0 }));
vi.mock("@ui/components/Shared", async (importOriginal) => {
  const original = await importOriginal<typeof import("@ui/components/Shared")>();
  return {
    ...original,
    CategoryBadge: (props: Parameters<typeof original.CategoryBadge>[0]) => {
      renders.categoryBadge++;
      return original.CategoryBadge(props);
    },
  };
});

import { ChangesPage } from "@ui/pages/ChangesPage";
import { bridge } from "./helpers/bridge";
import { makeChange, makeProject } from "./helpers/fixtures";
import { renderWithProject } from "./helpers/render";

vi.mock("@ui/state/bridge", async () => (await import("./helpers/bridge")).bridgeModule);

const rows = () => document.querySelectorAll(".change-item");
const rowId = (i: number) => `change-item-c${i}`;
const manyChanges = (n: number) => Array.from({ length: n }, (_, i) => makeChange(`c${i}`, { entityName: `Item ${i}`, summary: `Summary ${i}` }));
const lastLive = () => {
  const live = io.instances.filter((r) => !r.disconnected);
  return live[live.length - 1];
};
const loadNextPage = () => {
  const live = lastLive();
  if (!live) throw new Error("no live observer");
  act(() => live.callback([{ isIntersecting: true }]));
};
const selectedId = () => document.querySelector(".change-item.is-selected")?.id;

describe("long change lists render a page at a time", () => {
  it("starts with the first page and says how many more there are", () => {
    renderWithProject(<ChangesPage />, makeProject(manyChanges(350)));
    expect(rows()).toHaveLength(100);
    expect(screen.getByText("Showing 100 of 350 — scroll for more")).toBeTruthy();
  });

  it("a list that fits on one page has no 'more' marker and no observer", () => {
    io.instances.length = 0;
    renderWithProject(<ChangesPage />, makeProject(manyChanges(40)));
    expect(rows()).toHaveLength(40);
    expect(screen.queryByText(/scroll for more/)).toBeNull();
    expect(io.instances.filter((r) => !r.disconnected)).toHaveLength(0);
  });

  it("loads the next page when the end of the list nears the viewport, until everything is shown", () => {
    renderWithProject(<ChangesPage />, makeProject(manyChanges(350)));
    loadNextPage();
    expect(rows()).toHaveLength(200);
    loadNextPage();
    expect(rows()).toHaveLength(300);
    loadNextPage();
    expect(rows()).toHaveLength(350);
    expect(screen.queryByText(/scroll for more/)).toBeNull();
  });

  it("watches the list's own scroll container and starts loading before the end is visible", () => {
    io.instances.length = 0;
    renderWithProject(<ChangesPage />, makeProject(manyChanges(350)));
    const live = lastLive()!;
    expect(live.options.root).toBeInstanceOf(HTMLElement);
    expect(live.options.rootMargin).toMatch(/^\d+px/);
    expect(live.observed[0]!.textContent).toMatch(/Showing 100 of 350/);
  });

  it("stops observing once everything is loaded", () => {
    io.instances.length = 0;
    renderWithProject(<ChangesPage />, makeProject(manyChanges(150)));
    loadNextPage();
    expect(rows()).toHaveLength(150);
    expect(io.instances.filter((r) => !r.disconnected)).toHaveLength(0);
  });

  it("keeps the DOM small however large the change set is", () => {
    renderWithProject(<ChangesPage />, makeProject(manyChanges(5000)));
    expect(rows()).toHaveLength(100);
    expect(screen.getByText("Showing 100 of 5000 — scroll for more")).toBeTruthy();
    expect(screen.getByText(/5000 changes/)).toBeTruthy(); // counts still cover everything
  });

  it("keyboard navigation past the rendered rows loads more and selects the right one", async () => {
    const user = userEvent.setup();
    renderWithProject(<ChangesPage />, makeProject(manyChanges(350)));
    await user.keyboard("{ArrowDown}".repeat(121)); // index 120, beyond the first 100
    expect(selectedId()).toBe(rowId(120));
    expect(rows().length).toBeGreaterThan(120);
  });

  it("'next unreviewed' jumps to a change that is far down the list", async () => {
    const user = userEvent.setup();
    const changes = manyChanges(350);
    for (let i = 0; i < 230; i++) changes[i]!.reviewState = "accepted";
    renderWithProject(<ChangesPage />, makeProject(changes));
    await user.keyboard("n");
    expect(selectedId()).toBe(rowId(230));
    expect(document.getElementById(rowId(230))).toBeTruthy();
  });

  it("a search jump to a change near the end of the list renders it", () => {
    renderWithProject(<ChangesPage focusChangeId="c300" />, makeProject(manyChanges(350)));
    expect(selectedId()).toBe(rowId(300));
  });

  it("changing a filter starts again from the first page", async () => {
    const user = userEvent.setup();
    renderWithProject(<ChangesPage />, makeProject(manyChanges(350)));
    loadNextPage();
    loadNextPage();
    expect(rows()).toHaveLength(300);

    await user.type(screen.getByLabelText("Search changes"), "Item");
    expect(rows()).toHaveLength(100);
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(rows()).toHaveLength(100);
  });

  it("select-all covers every change, not just the rendered ones", async () => {
    const user = userEvent.setup();
    renderWithProject(<ChangesPage />, makeProject(manyChanges(350)));
    await user.click(screen.getByLabelText("Select all 350"));
    expect(screen.getByText("350 selected")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(bridge.sentOfType("bulk-update-review")[0]!.changeIds).toHaveLength(350);
  });

  it("the load-more marker does not appear when filters narrow the list below a page", async () => {
    const user = userEvent.setup();
    renderWithProject(<ChangesPage />, makeProject(manyChanges(350)));
    await user.type(screen.getByLabelText("Search changes"), "Item 34");
    expect(rows().length).toBeLessThan(100);
    expect(screen.queryByText(/scroll for more/)).toBeNull();
  });
});

describe("rows only re-render when they change", () => {
  it("reviewing one change re-renders a few rows, not the whole page of them", async () => {
    const user = userEvent.setup();
    renderWithProject(<ChangesPage />, makeProject(manyChanges(100)));
    await user.keyboard("j"); // select the first row
    const before = renders.categoryBadge;

    await user.keyboard("a"); // accept it: its row changes, the selection moves to the next row
    const rerendered = renders.categoryBadge - before;
    expect(rerendered).toBeGreaterThan(0);
    expect(rerendered).toBeLessThanOrEqual(4); // changed row, previous selection, new selection (+ detail pane badge)
  });

  it("moving the selection re-renders only the two rows involved", async () => {
    const user = userEvent.setup();
    renderWithProject(<ChangesPage />, makeProject(manyChanges(100)));
    await user.keyboard("j");
    const before = renders.categoryBadge;
    await user.keyboard("j");
    expect(renders.categoryBadge - before).toBeLessThanOrEqual(4);
  });

  it("checking one row's box re-renders just that row", async () => {
    const user = userEvent.setup();
    renderWithProject(<ChangesPage />, makeProject(manyChanges(100)));
    const before = renders.categoryBadge;
    await user.click(screen.getByLabelText("Select Item 7 change for bulk review"));
    expect(renders.categoryBadge - before).toBeLessThanOrEqual(2);
  });

  it("a patch for one change leaves every other row's data untouched", async () => {
    const user = userEvent.setup();
    renderWithProject(<ChangesPage />, makeProject(manyChanges(100)));
    await user.keyboard("jr");
    // The rejected row shows its new state; the rest are unchanged.
    expect(document.querySelectorAll(".change-item.is-done")).toHaveLength(1);
    expect(screen.getAllByText("Rejected").length).toBeGreaterThan(0);
  });
});
