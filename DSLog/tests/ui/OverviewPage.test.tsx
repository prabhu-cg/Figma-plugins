// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverviewPage } from "@ui/pages/OverviewPage";
import { bridge } from "./helpers/bridge";
import { makeChange, makeProject, makeRelease } from "./helpers/fixtures";
import { renderWithProject } from "./helpers/render";

vi.mock("@ui/state/bridge", async () => (await import("./helpers/bridge")).bridgeModule);

function renderOverview(project = makeProject(), onNavigate = vi.fn()) {
  return { onNavigate, ...renderWithProject(<OverviewPage onNavigate={onNavigate} />, project) };
}
const lead = () => screen.getByRole("heading", { level: 2 });

describe("OverviewPage", () => {
  it("invites the user to create a baseline when there is none", async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderOverview(makeProject([], { currentBaselineId: undefined, baselines: [] }));
    expect(screen.getByText("Start tracking your Design System")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Create baseline" }));
    expect(onNavigate).toHaveBeenCalledWith("track");
  });

  describe("lead statement", () => {
    it("leads with breaking changes and points at the review", async () => {
      const user = userEvent.setup();
      const { onNavigate } = renderOverview(
        makeProject([
          makeChange("a", { breaking: true }),
          makeChange("b", { breaking: true }),
          makeChange("c"),
        ]),
      );
      expect(lead().textContent).toBe("2 breaking changes since v1.0.0");
      expect(screen.getByText("3 of 3 still unreviewed")).toBeTruthy();

      await user.click(screen.getByRole("button", { name: "Review changes" }));
      expect(onNavigate).toHaveBeenCalledWith("changes");
    });

    it("uses singular wording", () => {
      renderOverview(makeProject([makeChange("a", { breaking: true })]));
      expect(lead().textContent).toBe("1 breaking change since v1.0.0");
    });

    it("falls back to a plain count when nothing is breaking", () => {
      renderOverview(makeProject([makeChange("a"), makeChange("b")]));
      expect(lead().textContent).toBe("2 changes since v1.0.0");
    });

    it("mentions deprecations next to the unreviewed count", () => {
      renderOverview(makeProject([makeChange("a", { category: "deprecated" }), makeChange("b")]));
      expect(screen.getByText("2 of 2 still unreviewed · 1 deprecated")).toBeTruthy();
    });

    it("offers the release once everything is reviewed", async () => {
      const user = userEvent.setup();
      const { onNavigate } = renderOverview(makeProject([makeChange("a", { reviewState: "accepted" })]));
      expect(screen.getByText("All 1 reviewed — ready to release.")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Review changes" })).toBeNull();

      const [leadCreate] = screen.getAllByRole("button", { name: "Create release" });
      await user.click(leadCreate!);
      expect(onNavigate).toHaveBeenCalledWith("releases");
    });

    it("says so when there is nothing to review, and makes scanning the primary action", () => {
      renderOverview(makeProject([]));
      expect(lead().textContent).toBe("No changes since v1.0.0");
      expect(screen.getByText(/last scan found nothing new/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Scan for changes" }).className).toContain("btn-primary");
    });

    it("measures from the latest release, not the baseline version", () => {
      const project = makeProject([makeChange("a")]);
      project.releases = [makeRelease({ version: "1.1.0", createdAt: "2026-02-01T00:00:00.000Z" }), makeRelease({ id: "r2", version: "1.2.0", createdAt: "2026-03-01T00:00:00.000Z" })];
      renderOverview(project);
      expect(lead().textContent).toBe("1 change since v1.2.0");
      expect(screen.getByText(/Current release v1\.2\.0/)).toBeTruthy();
    });

    it("shows the baseline as unreleased before any release", () => {
      renderOverview(makeProject([makeChange("a")]));
      expect(screen.getByText("Current baseline v1.0.0 (unreleased)")).toBeTruthy();
    });

    it("summarises what is tracked in one plain sentence", () => {
      renderOverview();
      expect(screen.getByText(/Tracking 0 components and 0 tokens · 0 releases so far/)).toBeTruthy();
    });
  });

  describe("actions", () => {
    it("Scan for changes sends a scan", async () => {
      const user = userEvent.setup();
      renderOverview(makeProject([makeChange("a")]));
      await user.click(screen.getByRole("button", { name: "Scan for changes" }));
      expect(bridge.sentOfType("scan")).toHaveLength(1);
    });
  });

  describe("scan progress", () => {
    it("shows labelled progress bars while scanning, with their values", async () => {
      const user = userEvent.setup();
      renderOverview(makeProject([makeChange("a")]));
      await user.click(screen.getByRole("button", { name: "Scan for changes" }));
      act(() =>
        bridge.emit({
          type: "scan-progress",
          progress: { phase: "components", componentsTotal: 10, componentsDone: 5, tokensTotal: 4, tokensDone: 1 },
        }),
      );

      const components = screen.getByRole("progressbar", { name: "Components scanned" });
      const tokens = screen.getByRole("progressbar", { name: "Tokens scanned" });
      expect(components.getAttribute("aria-valuenow")).toBe("50");
      expect(tokens.getAttribute("aria-valuenow")).toBe("25");
      expect((components.firstElementChild as HTMLElement).style.transform).toBe("scaleX(0.5)");
      expect(screen.getByText("5 / 10")).toBeTruthy();
      expect((screen.getByRole("button", { name: "Scan for changes" }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("hides the bars when the scan finishes", async () => {
      const user = userEvent.setup();
      renderOverview(makeProject([makeChange("a")]));
      await user.click(screen.getByRole("button", { name: "Scan for changes" }));
      act(() =>
        bridge.emit({ type: "scan-progress", progress: { phase: "done", componentsTotal: 1, componentsDone: 1, tokensTotal: 0, tokensDone: 0 } }),
      );
      expect(screen.queryByRole("progressbar")).toBeNull();
    });

    it("never overshoots 100%", async () => {
      const user = userEvent.setup();
      renderOverview(makeProject([makeChange("a")]));
      await user.click(screen.getByRole("button", { name: "Scan for changes" }));
      act(() =>
        bridge.emit({ type: "scan-progress", progress: { phase: "components", componentsTotal: 2, componentsDone: 9, tokensTotal: 0, tokensDone: 0 } }),
      );
      expect(screen.getByRole("progressbar", { name: "Components scanned" }).getAttribute("aria-valuenow")).toBe("100");
    });
  });
});
