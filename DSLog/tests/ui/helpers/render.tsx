import type { ReactElement } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { ProjectProvider } from "@ui/state/ProjectContext";
import type { Project } from "@shared/types/project";
import { bridge } from "./bridge";
import { installFakePlugin } from "./fakePlugin";

// jsdom gaps the UI relies on.
beforeEach(() => {
  bridge.reset();
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

/**
 * Renders `ui` inside the real ProjectProvider and hands it `project` the way the plugin does
 * (a `state` message). Returns the fake plugin's state so tests can inspect what "was saved".
 */
export function renderWithProject(ui: ReactElement, project: Project | undefined) {
  const plugin = project ? installFakePlugin(project) : undefined;
  const result = render(<ProjectProvider>{ui}</ProjectProvider>);
  if (project) act(() => bridge.emit({ type: "state", project: structuredClone(project) }));
  return { ...result, plugin };
}
