// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "@ui/components/Tabs";
import { Nav } from "@ui/components/Nav";
import { Banner } from "@ui/components/Shared";
import { SearchBar } from "@ui/components/SearchBar";
import { useTheme } from "@ui/state/useTheme";
import { useDismissOnce } from "@ui/state/useDismissOnce";
import { bridge } from "./helpers/bridge";
import { makeChange, makeProject } from "./helpers/fixtures";
import { renderWithProject } from "./helpers/render";

vi.mock("@ui/state/bridge", async () => (await import("./helpers/bridge")).bridgeModule);

describe("Tabs", () => {
  function Harness({ onChange }: { onChange?: (id: string) => void }) {
    const [active, setActive] = useState("one");
    return (
      <Tabs
        idPrefix="t"
        tabs={[
          { id: "one", label: "One" },
          { id: "two", label: "Two" },
          { id: "three", label: "Three" },
        ]}
        active={active}
        onChange={(id) => {
          setActive(id);
          onChange?.(id);
        }}
      />
    );
  }

  it("exposes the tab pattern: selected state, controlled panel and a roving tab stop", () => {
    render(<Harness />);
    const [one, two] = screen.getAllByRole("tab");
    expect(one!.getAttribute("aria-selected")).toBe("true");
    expect(one!.getAttribute("aria-controls")).toBe("t-panel-one");
    expect(one!.id).toBe("t-tab-one");
    expect(one!.tabIndex).toBe(0);
    expect(two!.tabIndex).toBe(-1);
  });

  it("arrow keys select and focus the next/previous tab, wrapping around", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    screen.getByRole("tab", { name: "One" }).focus();

    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Two" }));
    expect(screen.getByRole("tab", { name: "Two" }).getAttribute("aria-selected")).toBe("true");

    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "One" }));
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Three" }));
    expect(onChange).toHaveBeenLastCalledWith("three");
  });

  it("Home and End jump to the first and last tab", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("tab", { name: "One" }).focus();
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Three" }));
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "One" }));
  });

  it("clicking selects a tab", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("tab", { name: "Three" }));
    expect(screen.getByRole("tab", { name: "Three" }).getAttribute("aria-selected")).toBe("true");
  });
});

describe("Nav", () => {
  it("marks the current page and reports selections", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProject(<Nav active="changes" onSelect={onSelect} onSearchSelect={() => {}} />, makeProject());

    expect(screen.getByRole("navigation", { name: "DSLog" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Changes" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Overview" }).getAttribute("aria-current")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Releases" }));
    expect(onSelect).toHaveBeenCalledWith("releases");
  });
});

describe("Banner", () => {
  it("is announced politely, and errors assertively", () => {
    render(
      <>
        <Banner kind="info">Saved</Banner>
        <Banner kind="error">Something broke</Banner>
      </>,
    );
    expect(screen.getByText("Saved").closest("[role]")!.getAttribute("role")).toBe("status");
    expect(screen.getByText("Something broke").closest("[role]")!.getAttribute("role")).toBe("alert");
  });

  it("only shows a dismiss button when it can be dismissed", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const { rerender } = render(<Banner kind="info">Hello</Banner>);
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
    rerender(<Banner kind="info" onDismiss={onDismiss}>Hello</Banner>);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("SearchBar", () => {
  const project = () =>
    makeProject([
      makeChange("a", { entityName: "Button", summary: "Padding changed" }),
      makeChange("b", { entityName: "Buttons group", summary: "Radius changed" }),
    ]);
  const input = () => screen.getByRole("combobox");

  it("is a collapsed combobox until there is a query", () => {
    renderWithProject(<SearchBar onSelectResult={() => {}} />, project());
    expect(input().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("opens a grouped listbox of options as you type", async () => {
    const user = userEvent.setup();
    renderWithProject(<SearchBar onSelectResult={() => {}} />, project());
    await user.type(input(), "button");

    expect(input().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Changes" })).toBeTruthy();
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });

  it("arrow keys move the active option and Enter selects it", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProject(<SearchBar onSelectResult={onSelect} />, project());
    await user.type(input(), "button");

    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(1);
    expect(options[0]!.getAttribute("aria-selected")).toBe("true");
    expect(input().getAttribute("aria-activedescendant")).toBe(options[0]!.id);

    await user.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("option")[1]!.getAttribute("aria-selected")).toBe("true");
    expect(input().getAttribute("aria-activedescendant")).toBe(options[1]!.id);

    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]![0]).toMatchObject({ type: "change" });
    // Selecting clears the query and closes the list.
    expect((input() as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("ArrowUp from the first option wraps to the last", async () => {
    const user = userEvent.setup();
    renderWithProject(<SearchBar onSelectResult={() => {}} />, project());
    await user.type(input(), "button");
    const count = screen.getAllByRole("option").length;
    await user.keyboard("{ArrowUp}");
    expect(screen.getAllByRole("option")[count - 1]!.getAttribute("aria-selected")).toBe("true");
  });

  it("Escape closes the list but keeps the text", async () => {
    const user = userEvent.setup();
    renderWithProject(<SearchBar onSelectResult={() => {}} />, project());
    await user.type(input(), "button");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect((input() as HTMLInputElement).value).toBe("button");
  });

  it("clicking an option selects it (focus leaving the input must not swallow the click)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProject(<SearchBar onSelectResult={onSelect} />, project());
    await user.type(input(), "radius");
    await user.click(screen.getAllByRole("option")[0]!);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("says when nothing matches and Enter does nothing", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProject(<SearchBar onSelectResult={onSelect} />, project());
    await user.type(input(), "zzzzzz");
    expect(screen.getByText("No matches.")).toBeTruthy();
    await user.keyboard("{Enter}");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("resets the highlighted option when the query changes", async () => {
    const user = userEvent.setup();
    renderWithProject(<SearchBar onSelectResult={() => {}} />, project());
    await user.type(input(), "button");
    await user.keyboard("{ArrowDown}");
    await user.type(input(), "s");
    expect(screen.getAllByRole("option")[0]!.getAttribute("aria-selected")).toBe("true");
  });
});

describe("useTheme", () => {
  const stubSystemDark = (dark: boolean) => {
    const listeners = new Set<() => void>();
    const query = {
      get matches() {
        return dark;
      },
      media: "(prefers-color-scheme: dark)",
      addEventListener: (_: string, l: () => void) => listeners.add(l),
      removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    };
    Object.defineProperty(window, "matchMedia", { configurable: true, value: () => query });
    return {
      setDark(next: boolean) {
        dark = next;
        listeners.forEach((l) => l());
      },
    };
  };
  const theme = () => document.documentElement.getAttribute("data-theme");

  it("always sets data-theme explicitly: system resolves to light or dark", () => {
    stubSystemDark(false);
    const { unmount } = renderHook(() => useTheme());
    expect(theme()).toBe("light");
    unmount();
    stubSystemDark(true);
    renderHook(() => useTheme());
    expect(theme()).toBe("dark");
  });

  it("follows the system when it changes while on 'system'", () => {
    const system = stubSystemDark(false);
    renderHook(() => useTheme());
    expect(theme()).toBe("light");
    act(() => system.setDark(true));
    expect(theme()).toBe("dark");
  });

  it("an explicit choice wins over the system and is remembered", () => {
    const system = stubSystemDark(true);
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme("light"));
    expect(theme()).toBe("light");
    expect(localStorage.getItem("dslog-theme")).toBe("light");

    act(() => system.setDark(false));
    act(() => system.setDark(true));
    expect(theme()).toBe("light");

    const second = renderHook(() => useTheme());
    expect(second.result.current.theme).toBe("light");
  });

  it("ignores a corrupt stored value", () => {
    stubSystemDark(false);
    localStorage.setItem("dslog-theme", "purple");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("system");
  });
});

describe("useDismissOnce", () => {
  it("starts visible, dismisses, and remembers across mounts", () => {
    const first = renderHook(() => useDismissOnce("tip"));
    expect(first.result.current[0]).toBe(false);
    act(() => first.result.current[1]());
    expect(first.result.current[0]).toBe(true);

    const second = renderHook(() => useDismissOnce("tip"));
    expect(second.result.current[0]).toBe(true);
  });

  it("keys are independent", () => {
    const a = renderHook(() => useDismissOnce("a"));
    act(() => a.result.current[1]());
    expect(renderHook(() => useDismissOnce("b")).result.current[0]).toBe(false);
  });

  it("still dismisses for this session when storage is blocked", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useDismissOnce("tip"));
    expect(result.current[0]).toBe(false);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe("bridge mock", () => {
  it("records what the UI sends on mount", () => {
    renderWithProject(<SearchBar onSelectResult={() => {}} />, makeProject());
    expect(bridge.sentOfType("ui-ready")).toHaveLength(1);
  });
});
