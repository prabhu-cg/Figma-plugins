// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReleasesPage } from "@ui/pages/ReleasesPage";
import { bridge } from "./helpers/bridge";
import { makeChange, makeProject, makeRelease } from "./helpers/fixtures";
import { renderWithProject } from "./helpers/render";

vi.mock("@ui/state/bridge", async () => (await import("./helpers/bridge")).bridgeModule);

const versionInput = () => screen.getByLabelText("Version") as HTMLInputElement;
const titleInput = () => screen.getByLabelText("Release title") as HTMLInputElement;
const createButton = () => screen.getByRole("button", { name: "Create release", description: /./ });
const status = () => document.getElementById("release-status")!.textContent;

/** One breaking change since v1.0.0, so the recommendation is a major bump to 2.0.0. */
const breakingProject = () => makeProject([makeChange("a", { breaking: true, category: "removed" })]);

function renderPage(project = breakingProject(), onNavigate = vi.fn()) {
  return { onNavigate, ...renderWithProject(<ReleasesPage onNavigate={onNavigate} />, project) };
}

describe("ReleasesPage", () => {
  describe("without a baseline", () => {
    it("sends the user to Track", async () => {
      const user = userEvent.setup();
      const project = makeProject([], { currentBaselineId: undefined, baselines: [] });
      const { onNavigate } = renderPage(project);
      expect(screen.getByText("No baseline yet")).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Create baseline" }));
      expect(onNavigate).toHaveBeenCalledWith("track");
    });
  });

  describe("form defaults", () => {
    it("starts from the recommended version, not a hardcoded one", () => {
      renderPage();
      expect(versionInput().value).toBe("2.0.0");
      expect(screen.getByText("In use above.")).toBeTruthy();
    });

    it("recommends a different version when the changes are not breaking", () => {
      renderPage(makeProject([makeChange("a", { category: "added", severity: "minor" })]));
      expect(versionInput().value).not.toBe("2.0.0");
      expect(versionInput().value).toMatch(/^1\.\d+\.\d+$/);
    });

    it("includes every section by default", () => {
      renderPage();
      for (const name of ["Components", "Tokens", "Breaking changes", "Migration notes"]) {
        expect(screen.getByRole("button", { name: new RegExp(name) }).getAttribute("aria-pressed")).toBe("true");
      }
      expect(status()).toMatch(/Add a release title/);
    });

    it("keeps the version the user typed even when the recommendation changes", async () => {
      const user = userEvent.setup();
      const project = breakingProject();
      renderPage(project);
      await user.clear(versionInput());
      await user.type(versionInput(), "3.1.4");

      act(() => bridge.emit({ type: "state", project: structuredClone(project) }));
      expect(versionInput().value).toBe("3.1.4");
      expect(screen.getByRole("button", { name: "Use recommended" })).toBeTruthy();
    });

    it("Use recommended puts the recommendation back", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.clear(versionInput());
      await user.type(versionInput(), "9.9.9");
      await user.click(screen.getByRole("button", { name: "Use recommended" }));
      expect(versionInput().value).toBe("2.0.0");
    });
  });

  describe("why the button is unavailable", () => {
    it("says it needs a title and keeps the button disabled", () => {
      renderPage();
      expect(status()).toBe("Can't create yet: Add a release title");
      expect((createButton() as HTMLButtonElement).disabled).toBe(true);
    });

    it("clears the message and enables the button once a title is entered", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.type(titleInput(), "Core refresh");
      expect(status()).toBe("4 of 4 sections included");
      expect((createButton() as HTMLButtonElement).disabled).toBe(false);
    });

    it("lists every blocker together", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.clear(versionInput());
      expect(status()).toMatch(/Enter a version; Add a release title/);
    });

    it("requires at least one section", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.type(titleInput(), "Core refresh");
      for (const name of ["Components", "Tokens", "Breaking changes", "Migration notes"]) {
        await user.click(screen.getByRole("button", { name: new RegExp(name) }));
      }
      expect(status()).toMatch(/Include at least one section/);
      expect((createButton() as HTMLButtonElement).disabled).toBe(true);
    });

    it("never prefills a version that has already been released", () => {
      const project = breakingProject();
      project.releases = [makeRelease({ version: "2.0.0" })];
      renderPage(project);
      expect(versionInput().value).not.toBe("2.0.0");
    });

    it("blocks a version that has already been released if the user types it", async () => {
      const user = userEvent.setup();
      const project = breakingProject();
      project.releases = [makeRelease({ version: "2.0.0" })];
      renderPage(project);
      await user.type(titleInput(), "Dupe");
      expect(status()).toBe("4 of 4 sections included");

      await user.clear(versionInput());
      await user.type(versionInput(), "2.0.0");
      expect(status()).toMatch(/^Can't create yet:/);
      expect((createButton() as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe("creating a release", () => {
    async function fillAndOpenConfirm(user: ReturnType<typeof userEvent.setup>) {
      await user.type(titleInput(), "  Core refresh  ");
      await user.click(createButton());
    }

    it("asks for confirmation before sending anything", async () => {
      const user = userEvent.setup();
      renderPage();
      await fillAndOpenConfirm(user);

      const panel = screen.getByRole("group", { name: "Confirm release" });
      expect(within(panel).getByText("Create v2.0.0 from 1 change?")).toBeTruthy();
      expect(within(panel).getByText(/1 of these is still unreviewed/)).toBeTruthy();
      expect(within(panel).getByText(/becomes the new baseline \(currently v1\.0\.0\)/)).toBeTruthy();
      expect(bridge.sentOfType("create-release")).toHaveLength(0);
    });

    it("Cancel goes back to the form without sending", async () => {
      const user = userEvent.setup();
      renderPage();
      await fillAndOpenConfirm(user);
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("group", { name: "Confirm release" })).toBeNull();
      expect(titleInput().value).toBe("  Core refresh  ");
      expect(bridge.sentOfType("create-release")).toHaveLength(0);
    });

    it("sends the trimmed values and chosen sections once confirmed", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByRole("button", { name: /Migration notes/ })); // turn one section off
      await user.type(screen.getByLabelText("Description"), "  Rounded corners  ");
      await fillAndOpenConfirm(user);
      await user.click(screen.getByRole("button", { name: "Create v2.0.0" }));

      expect(bridge.sentOfType("create-release")).toEqual([
        {
          type: "create-release",
          version: "2.0.0",
          title: "Core refresh",
          description: "Rounded corners",
          include: { components: true, tokens: true, breakingChanges: true, migrationNotes: false },
        },
      ]);
    });

    it("shows the success card and copies the changelog", async () => {
      const user = userEvent.setup();
      renderPage();
      await fillAndOpenConfirm(user);
      await user.click(screen.getByRole("button", { name: "Create v2.0.0" }));

      expect(screen.getByText("Release created")).toBeTruthy();
      expect(screen.getByText("Version 2.0.0")).toBeTruthy();
      expect(screen.queryByRole("group", { name: "Confirm release" })).toBeNull();

      await user.click(screen.getByRole("button", { name: /Copy changelog/ }));
      expect(await navigator.clipboard.readText()).toBe("# 2.0.0 — Core refresh");
      expect(screen.getByText("Copied to clipboard")).toBeTruthy();
    });

    it("reports a clipboard failure instead of failing silently", async () => {
      const user = userEvent.setup();
      renderPage();
      await fillAndOpenConfirm(user);
      await user.click(screen.getByRole("button", { name: "Create v2.0.0" }));
      vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("denied"));

      await user.click(screen.getByRole("button", { name: /Copy changelog/ }));
      expect(await screen.findByText(/Could not copy/)).toBeTruthy();
    });

    it("View changelog opens it on the Past releases tab", async () => {
      const user = userEvent.setup();
      renderPage();
      await fillAndOpenConfirm(user);
      await user.click(screen.getByRole("button", { name: "Create v2.0.0" }));
      await user.click(screen.getByRole("button", { name: "View changelog" }));

      expect(bridge.sentOfType("export")).toHaveLength(1);
      expect(screen.getByRole("tab", { name: /Past releases/ }).getAttribute("aria-selected")).toBe("true");
      expect((await screen.findByDisplayValue("# 2.0.0 — Core refresh")).tagName).toBe("TEXTAREA");
    });

    it("Create another returns to a fresh form", async () => {
      const user = userEvent.setup();
      renderPage();
      await fillAndOpenConfirm(user);
      await user.click(screen.getByRole("button", { name: "Create v2.0.0" }));
      await user.click(screen.getByRole("button", { name: "Create another" }));
      expect(screen.getByLabelText("Release title")).toBeTruthy();
    });
  });

  describe("tabs", () => {
    it("keeps a half-filled form when switching to Past releases and back", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.type(titleInput(), "Draft title");
      await user.clear(versionInput());
      await user.type(versionInput(), "7.0.0");

      await user.click(screen.getByRole("tab", { name: /Past releases/ }));
      expect(screen.getByText(/No releases yet/)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Create release", description: /./ })).toBeNull(); // footer is hidden here

      await user.click(screen.getByRole("tab", { name: "Create release" }));
      expect(titleInput().value).toBe("Draft title");
      expect(versionInput().value).toBe("7.0.0");
    });

    it("lists past releases newest first and toggles a changelog", async () => {
      const user = userEvent.setup();
      const project = breakingProject();
      project.releases = [makeRelease({ id: "r1", version: "1.1.0", title: "Older" }), makeRelease({ id: "r2", version: "1.2.0", title: "Newer" })];
      renderPage(project);
      await user.click(screen.getByRole("tab", { name: /Past releases \(2\)/ }));

      const rows = screen.getAllByRole("row").slice(1);
      expect(rows[0]!.textContent).toContain("v1.2.0");
      expect(rows[1]!.textContent).toContain("v1.1.0");

      await user.click(within(rows[0]!).getByRole("button", { name: "View changelog" }));
      expect(bridge.sentOfType("export")[0]).toMatchObject({ releaseId: "r2", format: "markdown" });
      expect(await screen.findByRole("button", { name: "Hide changelog" })).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Hide changelog" }));
      expect(screen.queryByRole("button", { name: "Hide changelog" })).toBeNull();
    });
  });

  describe("explainer banner", () => {
    it("dismisses once and stays dismissed", async () => {
      const user = userEvent.setup();
      const first = renderPage();
      expect(screen.getByText(/A release packages everything/)).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Dismiss" }));
      expect(screen.queryByText(/A release packages everything/)).toBeNull();

      first.unmount();
      bridge.reset();
      renderPage();
      expect(screen.queryByText(/A release packages everything/)).toBeNull();
    });
  });
});
