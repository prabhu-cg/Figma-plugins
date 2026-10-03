// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "@ui/App";
import { ChangesPage } from "@ui/pages/ChangesPage";
import { bridge } from "./helpers/bridge";
import { makeChange, makeProject } from "./helpers/fixtures";
import { renderWithProject } from "./helpers/render";

vi.mock("@ui/state/bridge", async () => (await import("./helpers/bridge")).bridgeModule);

const row = (id: string) => document.getElementById(`change-item-${id}`) as HTMLElement;

describe("'Updated since review' badge", () => {
  const changes = () => [
    makeChange("a", { entityName: "Button", changedSinceReview: true }),
    makeChange("b", { entityName: "Card" }),
  ];

  it("marks a change whose values moved on since it was reviewed, in the list and in the detail pane", async () => {
    const user = userEvent.setup();
    renderWithProject(<ChangesPage />, makeProject(changes()));
    expect(within(row("a")).getByText("Updated since review")).toBeTruthy();
    expect(within(row("b")).queryByText("Updated since review")).toBeNull();

    await user.click(row("a"));
    // once in the row, once in the detail pane
    expect(screen.getAllByText("Updated since review")).toHaveLength(2);
  });

  it("explains itself on hover", () => {
    renderWithProject(<ChangesPage />, makeProject(changes()));
    expect(within(row("a")).getByText("Updated since review").getAttribute("title")).toMatch(/reviewed before.*changed/i);
  });

  it("goes away as soon as the change is decided again", async () => {
    const user = userEvent.setup();
    renderWithProject(<ChangesPage />, makeProject(changes()));
    await user.keyboard("j"); // selects the first change, the flagged one
    await user.keyboard("a");
    expect(screen.queryByText("Updated since review")).toBeNull();
    expect(within(row("a")).getByText("Accepted")).toBeTruthy();
  });

  it("stays when only a note is edited", async () => {
    renderWithProject(<ChangesPage />, makeProject(changes()));
    act(() => bridge.emit({ type: "changes-updated", changeSetId: "changeset-1", patches: [{ changeId: "a", reviewNote: "looking at it" }] }));
    expect(within(row("a")).getByText("Updated since review")).toBeTruthy();
  });
});

describe("the toast after a scan", () => {
  function renderApp() {
    render(<App />);
    act(() => bridge.emit({ type: "state", project: makeProject([makeChange("a")]) }));
  }
  const scanDone = (extra: { reviewsKept?: number; reviewsReset?: number } = {}, changes = 3) =>
    act(() =>
      bridge.emit({
        type: "scan-complete",
        changeSet: makeProject(Array.from({ length: changes }, (_, i) => makeChange(`n${i}`))).changeSets[0]!,
        ...extra,
      }),
    );

  it("just counts the changes when no reviews were involved", () => {
    renderApp();
    scanDone();
    expect(screen.getByText("Scan complete — 3 changes detected.")).toBeTruthy();
  });

  it("says how many reviews were kept", () => {
    renderApp();
    scanDone({ reviewsKept: 14, reviewsReset: 0 }, 22);
    expect(screen.getByText("Scan complete — 22 changes detected · 14 reviews kept.")).toBeTruthy();
  });

  it("says how many need another look", () => {
    renderApp();
    scanDone({ reviewsKept: 2, reviewsReset: 3 });
    expect(screen.getByText("Scan complete — 3 changes detected · 2 reviews kept · 3 changed since you reviewed them.")).toBeTruthy();
  });

  it("uses singular wording", () => {
    renderApp();
    scanDone({ reviewsKept: 1, reviewsReset: 1 }, 1);
    expect(screen.getByText("Scan complete — 1 change detected · 1 review kept · 1 changed since you reviewed it.")).toBeTruthy();
  });
});

describe("when a re-scan replaces the change set", () => {
  const setOf = (suffix: string) => {
    const project = makeProject([makeChange(`a${suffix}`, { entityName: "Button" }), makeChange(`b${suffix}`, { entityName: "Card" })]);
    project.changeSets[0]!.id = `changeset-${suffix}`;
    return project;
  };

  it("forgets an undo that points at the old ids", async () => {
    const user = userEvent.setup();
    renderWithProject(<ChangesPage />, setOf("1"));
    await user.keyboard("ja");
    expect(screen.getByRole("button", { name: /Undo/ })).toBeTruthy();

    act(() => bridge.emit({ type: "state", project: setOf("2") }));
    expect(screen.queryByRole("button", { name: /Undo/ })).toBeNull();
    await user.keyboard("z"); // must not send a stale restore
    expect(bridge.sentOfType("bulk-update-review")).toHaveLength(0);
  });

  it("forgets ticked rows", async () => {
    const user = userEvent.setup();
    renderWithProject(<ChangesPage />, setOf("1"));
    await user.click(screen.getByLabelText(/Select all 2/));
    expect(screen.getByText("2 selected")).toBeTruthy();

    act(() => bridge.emit({ type: "state", project: setOf("2") }));
    expect(screen.queryByText(/\d+ selected/)).toBeNull();
  });

  it("keeps an undo across ordinary patches to the same change set", async () => {
    const user = userEvent.setup();
    renderWithProject(<ChangesPage />, setOf("1"));
    await user.keyboard("ja");
    act(() => bridge.emit({ type: "changes-updated", changeSetId: "changeset-1", patches: [{ changeId: "b1", reviewNote: "x" }] }));
    expect(screen.getByRole("button", { name: /Undo/ })).toBeTruthy();
  });
});
