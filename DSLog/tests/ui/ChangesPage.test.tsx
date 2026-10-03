// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangesPage } from "@ui/pages/ChangesPage";
import { bridge } from "./helpers/bridge";
import { makeChange, makeProject } from "./helpers/fixtures";
import { renderWithProject } from "./helpers/render";

vi.mock("@ui/state/bridge", async () => (await import("./helpers/bridge")).bridgeModule);

const row = (id: string) => document.getElementById(`change-item-${id}`) as HTMLElement;
const selectedRow = () => document.querySelector(".change-item.is-selected") as HTMLElement | null;
const reviewStates = (plugin: ReturnType<typeof renderWithProject>["plugin"]) =>
  plugin!.project.changeSets[0]!.changes.map((c) => c.reviewState);

function threeChanges() {
  return [
    makeChange("a", { entityName: "Button", summary: "Padding changed" }),
    makeChange("b", { entityName: "Card", summary: "Radius changed", category: "removed", breaking: true }),
    makeChange("c", { entityName: "Chip", summary: "Fill changed" }),
  ];
}

describe("ChangesPage", () => {
  describe("empty states", () => {
    it("offers a scan when there are no changes", async () => {
      const user = userEvent.setup();
      renderWithProject(<ChangesPage />, makeProject([]));
      expect(screen.getByText("No changes detected")).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Scan for changes" }));
      expect(bridge.sentOfType("scan")).toHaveLength(1);
    });

    it("renders nothing until the project arrives", () => {
      const { container } = renderWithProject(<ChangesPage />, undefined);
      expect(container.textContent).toBe("");
    });
  });

  describe("list", () => {
    it("shows every change with counts in the subtitle", () => {
      renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      expect(document.querySelectorAll(".change-item")).toHaveLength(3);
      expect(screen.getByText(/3 changes · 3 components · 0 tokens · 3 unreviewed · 0 reviewed/)).toBeTruthy();
    });
  });

  describe("keyboard review", () => {
    it("J selects the first change and arrows move, clamping at the ends", async () => {
      const user = userEvent.setup();
      renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      expect(selectedRow()).toBeNull();

      await user.keyboard("j");
      expect(selectedRow()).toBe(row("a"));
      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
      expect(selectedRow()).toBe(row("c"));
      await user.keyboard("k{ArrowUp}{ArrowUp}");
      expect(selectedRow()).toBe(row("a"));
    });

    it("A accepts the selected change, sends it to the plugin and advances to the next unreviewed one", async () => {
      const user = userEvent.setup();
      const { plugin } = renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      await user.keyboard("ja");

      expect(bridge.sentOfType("update-change")).toEqual([
        { type: "update-change", changeSetId: "changeset-1", changeId: "a", reviewState: "accepted" },
      ]);
      expect(reviewStates(plugin)).toEqual(["accepted", "unreviewed", "unreviewed"]);
      expect(selectedRow()).toBe(row("b"));
    });

    it("R rejects and V marks reviewed, each advancing in turn", async () => {
      const user = userEvent.setup();
      const { plugin } = renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      await user.keyboard("jrv");
      expect(reviewStates(plugin)).toEqual(["rejected", "reviewed", "unreviewed"]);
      expect(selectedRow()).toBe(row("c"));
    });

    it("does nothing for review keys when no change is selected", async () => {
      const user = userEvent.setup();
      renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      await user.keyboard("a");
      expect(bridge.sentOfType("update-change")).toHaveLength(0);
    });

    it("N jumps to the next unreviewed change, skipping reviewed ones", async () => {
      const user = userEvent.setup();
      const changes = threeChanges();
      changes[1]!.reviewState = "accepted";
      renderWithProject(<ChangesPage />, makeProject(changes));
      await user.keyboard("jn");
      expect(selectedRow()).toBe(row("c"));
    });

    it("ignores shortcuts while typing in the search field", async () => {
      const user = userEvent.setup();
      renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      await user.click(screen.getByLabelText("Search changes"));
      await user.keyboard("jarvn");
      expect(bridge.sentOfType("update-change")).toHaveLength(0);
      expect((screen.getByLabelText("Search changes") as HTMLInputElement).value).toBe("jarvn");
    });

    it("ignores shortcuts with a modifier held (⌘A must not accept)", async () => {
      const user = userEvent.setup();
      renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      await user.keyboard("j{Meta>}a{/Meta}");
      expect(bridge.sentOfType("update-change")).toHaveLength(0);
    });
  });

  describe("showing what the plugin reports", () => {
    it("a review decision appears on its row and in the counts straight away", async () => {
      const user = userEvent.setup();
      renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      await user.keyboard("ja");

      expect(within(row("a")).getByText("Accepted")).toBeTruthy();
      expect(within(row("b")).queryByText("Accepted")).toBeNull();
      expect(screen.getByText(/2 unreviewed · 1 reviewed/)).toBeTruthy();
    });

    it("shows a patch the plugin sends by itself", () => {
      renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      act(() =>
        bridge.emit({
          type: "changes-updated",
          changeSetId: "changeset-1",
          patches: [{ changeId: "b", reviewState: "rejected" }, { changeId: "c", reviewState: "reviewed" }],
        }),
      );
      expect(within(row("b")).getByText("Rejected")).toBeTruthy();
      expect(within(row("c")).getByText("Reviewed")).toBeTruthy();
      expect(within(row("a")).queryByText(/Rejected|Reviewed|Accepted/)).toBeNull();
      expect(screen.getByText(/1 unreviewed · 2 reviewed/)).toBeTruthy();
    });

    it("carries a patched note into the detail pane for the selected change", async () => {
      const user = userEvent.setup();
      renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      await user.click(row("a"));
      act(() => bridge.emit({ type: "changes-updated", changeSetId: "changeset-1", patches: [{ changeId: "a", reviewState: "rejected" }] }));
      const group = screen.getByRole("group", { name: "Review decision" });
      expect(within(group).getByRole("button", { name: /Reject/ }).getAttribute("aria-pressed")).toBe("true");
    });

    it("ignores a patch for a change set it does not have", () => {
      renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      act(() => bridge.emit({ type: "changes-updated", changeSetId: "someone-elses", patches: [{ changeId: "a", reviewState: "rejected" }] }));
      expect(screen.getByText(/3 unreviewed · 0 reviewed/)).toBeTruthy();
    });

    it("ignores a patch that arrives before any project does", () => {
      renderWithProject(<ChangesPage />, undefined);
      expect(() =>
        act(() => bridge.emit({ type: "changes-updated", changeSetId: "changeset-1", patches: [{ changeId: "a", reviewState: "rejected" }] })),
      ).not.toThrow();
    });

    it("undo puts the row's badge back", async () => {
      const user = userEvent.setup();
      renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      await user.keyboard("ja");
      expect(within(row("a")).getByText("Accepted")).toBeTruthy();
      await user.keyboard("z");
      expect(within(row("a")).queryByText("Accepted")).toBeNull();
      expect(screen.getByText(/3 unreviewed · 0 reviewed/)).toBeTruthy();
    });
  });

  describe("undo", () => {
    it("shows what happened with an Undo button, and Z puts the previous state back", async () => {
      const user = userEvent.setup();
      const { plugin } = renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      await user.keyboard("ja");
      // Shown in the undo bar and mirrored in a polite live region for screen readers.
      expect(screen.getAllByText("Button marked accepted")).toHaveLength(2);
      expect(screen.getByRole("status").textContent).toBe("Button marked accepted");
      expect(screen.getByRole("button", { name: /Undo/ })).toBeTruthy();

      await user.keyboard("z");
      expect(reviewStates(plugin)).toEqual(["unreviewed", "unreviewed", "unreviewed"]);
      expect(screen.queryByText("Button marked accepted")).toBeNull();
      expect(selectedRow()).toBe(row("a"));
    });

    it("Z does nothing when there is nothing to undo", async () => {
      const user = userEvent.setup();
      renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      await user.keyboard("z");
      expect(bridge.sent.filter((m) => m.type === "bulk-update-review")).toHaveLength(0);
    });

    it("the button undoes the same action as the key", async () => {
      const user = userEvent.setup();
      const { plugin } = renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      await user.keyboard("jr");
      await user.click(screen.getByRole("button", { name: /Undo/ }));
      expect(reviewStates(plugin)).toEqual(["unreviewed", "unreviewed", "unreviewed"]);
    });
  });

  describe("detail pane", () => {
    it("shows the review control for the selected change and sends the decision", async () => {
      const user = userEvent.setup();
      const { plugin } = renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      await user.click(row("b"));

      const group = screen.getByRole("group", { name: "Review decision" });
      await user.click(within(group).getByRole("button", { name: /Reject/ }));
      expect(reviewStates(plugin)).toEqual(["unreviewed", "rejected", "unreviewed"]);
    });

    it("pressing the active decision clears it back to unreviewed", async () => {
      const user = userEvent.setup();
      const changes = threeChanges();
      changes[0]!.reviewState = "accepted";
      const { plugin } = renderWithProject(<ChangesPage />, makeProject(changes));
      await user.click(row("a"));

      const accept = within(screen.getByRole("group", { name: "Review decision" })).getByRole("button", { name: /Accept/ });
      expect(accept.getAttribute("aria-pressed")).toBe("true");
      await user.click(accept);
      expect(reviewStates(plugin)).toEqual(["unreviewed", "unreviewed", "unreviewed"]);
    });
  });

  describe("filters", () => {
    it("filters by review state and offers to clear", async () => {
      const user = userEvent.setup();
      const changes = threeChanges();
      changes[0]!.reviewState = "accepted";
      renderWithProject(<ChangesPage />, makeProject(changes));

      expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
      await user.selectOptions(screen.getByLabelText("Review state"), "accepted");
      expect(document.querySelectorAll(".change-item")).toHaveLength(1);

      await user.click(screen.getByRole("button", { name: "Clear filters" }));
      expect(document.querySelectorAll(".change-item")).toHaveLength(3);
      expect((screen.getByLabelText("Review state") as HTMLSelectElement).value).toBe("all");
    });

    it("breaking-only keeps just the breaking change", async () => {
      const user = userEvent.setup();
      renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      await user.selectOptions(screen.getByLabelText("Breaking"), "breaking");
      expect(document.querySelectorAll(".change-item")).toHaveLength(1);
      expect(row("b")).toBeTruthy();
    });

    it("searches by name or summary", async () => {
      const user = userEvent.setup();
      renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      await user.type(screen.getByLabelText("Search changes"), "radius");
      expect(document.querySelectorAll(".change-item")).toHaveLength(1);
      expect(row("b")).toBeTruthy();
    });

    it("explains an empty result and clears from the card", async () => {
      const user = userEvent.setup();
      renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      await user.type(screen.getByLabelText("Search changes"), "zzzz");
      expect(screen.getByText("No changes match these filters.")).toBeTruthy();
      const buttons = screen.getAllByRole("button", { name: "Clear filters" });
      await user.click(buttons[buttons.length - 1]!);
      expect(document.querySelectorAll(".change-item")).toHaveLength(3);
    });

    it("keyboard navigation only walks the filtered rows", async () => {
      const user = userEvent.setup();
      renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      await user.selectOptions(screen.getByLabelText("Breaking"), "breaking");
      // The dropdown keeps focus after choosing, and shortcuts deliberately stand down while a field has it.
      await user.keyboard("j");
      expect(selectedRow()).toBeNull();
      await user.click(document.body);
      await user.keyboard("jj");
      expect(selectedRow()).toBe(row("b"));
    });
  });

  describe("bulk review", () => {
    it("select-all checks every visible row and shows the count", async () => {
      const user = userEvent.setup();
      renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      await user.click(screen.getByLabelText(/Select all 3/));
      expect(screen.getByText("3 selected")).toBeTruthy();
    });

    it("applies one state to the checked rows with a single bulk message", async () => {
      const user = userEvent.setup();
      const { plugin } = renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      await user.click(screen.getByLabelText(/Select Button change/));
      await user.click(screen.getByLabelText(/Select Chip change/));
      await user.selectOptions(screen.getByLabelText("Mark selected as"), "rejected");
      await user.click(screen.getByRole("button", { name: "Apply" }));

      expect(bridge.sentOfType("bulk-update-review")).toEqual([
        { type: "bulk-update-review", changeSetId: "changeset-1", changeIds: ["a", "c"], reviewState: "rejected" },
      ]);
      expect(reviewStates(plugin)).toEqual(["rejected", "unreviewed", "rejected"]);
      expect(screen.queryByText(/\d+ selected/)).toBeNull();
      expect(screen.getAllByText("2 changes marked rejected").length).toBeGreaterThan(0);
    });

    it("undo restores each change's own prior state, even when they differed", async () => {
      const user = userEvent.setup();
      const changes = threeChanges();
      changes[0]!.reviewState = "accepted";
      const { plugin } = renderWithProject(<ChangesPage />, makeProject(changes));
      await user.click(screen.getByLabelText(/Select all 3/));
      await user.click(screen.getByRole("button", { name: "Apply" })); // default target: reviewed
      expect(reviewStates(plugin)).toEqual(["reviewed", "reviewed", "reviewed"]);

      await user.click(screen.getByRole("button", { name: /Undo/ }));
      expect(reviewStates(plugin)).toEqual(["accepted", "unreviewed", "unreviewed"]);
    });

    it("clear drops the selection without sending anything", async () => {
      const user = userEvent.setup();
      renderWithProject(<ChangesPage />, makeProject(threeChanges()));
      await user.click(screen.getByLabelText(/Select all 3/));
      await user.click(screen.getByRole("button", { name: "Clear" }));
      expect(screen.queryByText(/\d+ selected/)).toBeNull();
      expect(bridge.sent.filter((m) => m.type === "bulk-update-review")).toHaveLength(0);
    });
  });

  describe("jumping to a change from search", () => {
    it("selects the requested change and tells the app it handled the request", () => {
      const onFocusConsumed = vi.fn();
      renderWithProject(<ChangesPage focusChangeId="c" onFocusConsumed={onFocusConsumed} />, makeProject(threeChanges()));
      expect(selectedRow()).toBe(row("c"));
      // The app clears the request after the first call; here nothing does, so later state updates may repeat it.
      expect(onFocusConsumed).toHaveBeenCalled();
    });

    it("ignores a request for a change that is not in the set", () => {
      const onFocusConsumed = vi.fn();
      renderWithProject(<ChangesPage focusChangeId="missing" onFocusConsumed={onFocusConsumed} />, makeProject(threeChanges()));
      expect(selectedRow()).toBeNull();
      expect(onFocusConsumed).not.toHaveBeenCalled();
    });

    it("keeps the user's filters when the target is still visible, and resets them when it would be hidden", async () => {
      const user = userEvent.setup();
      const project = makeProject(threeChanges());
      const { rerender } = renderWithProject(<ChangesPage />, project);

      await user.selectOptions(screen.getByLabelText("Breaking"), "breaking"); // only "b" visible
      const { ProjectProvider } = await import("@ui/state/ProjectContext");
      // Target "b" is visible under the filter: filter stays.
      rerender(<ProjectProvider><ChangesPage focusChangeId="b" /></ProjectProvider>);
      act(() => bridge.emit({ type: "state", project: structuredClone(project) }));
      expect((screen.getByLabelText("Breaking") as HTMLSelectElement).value).toBe("breaking");
      expect(selectedRow()).toBe(row("b"));

      // Target "a" is hidden by the filter: filters reset so it can be shown.
      rerender(<ProjectProvider><ChangesPage focusChangeId="a" /></ProjectProvider>);
      act(() => bridge.emit({ type: "state", project: structuredClone(project) }));
      expect((screen.getByLabelText("Breaking") as HTMLSelectElement).value).toBe("all");
      expect(selectedRow()).toBe(row("a"));
    });
  });
});
