import React, { useRef } from "react";

interface Tab<T extends string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (id: T) => void;
  /** Distinguishes ids when more than one Tabs is mounted. */
  idPrefix?: string;
}

export function tabId(prefix: string, id: string): string {
  return `${prefix}-tab-${id}`;
}
export function tabPanelId(prefix: string, id: string): string {
  return `${prefix}-panel-${id}`;
}

/** Wrap the content of the active tab so screen readers can follow `aria-controls`. */
export function TabPanel({ idPrefix = "tabs", id, children }: { idPrefix?: string; id: string; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={tabPanelId(idPrefix, id)} aria-labelledby={tabId(idPrefix, id)}>
      {children}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, active, onChange, idPrefix = "tabs" }: TabsProps<T>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    const target = tabs[next];
    if (!target) return;
    onChange(target.id);
    refs.current[target.id]?.focus();
  }

  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(el) => {
            refs.current[tab.id] = el;
          }}
          id={tabId(idPrefix, tab.id)}
          role="tab"
          aria-selected={active === tab.id}
          aria-controls={tabPanelId(idPrefix, tab.id)}
          tabIndex={active === tab.id ? 0 : -1}
          className={`tab-btn${active === tab.id ? " active" : ""}`}
          onClick={() => onChange(tab.id)}
          onKeyDown={(e) => onKeyDown(e, index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
