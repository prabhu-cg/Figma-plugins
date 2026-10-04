import { useRef, type KeyboardEvent } from "react";

interface Tab<T extends string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (id: T) => void;
  /** Namespaces element ids so the tab/tabpanel pairing (aria-controls / aria-labelledby) is unique on the page. */
  idPrefix: string;
  label?: string;
}

/** Props for the element that shows a tab's content; pair with the same idPrefix passed to <Tabs>. */
export function tabPanelProps(idPrefix: string, id: string) {
  return {
    role: "tabpanel",
    id: `${idPrefix}-panel-${id}`,
    "aria-labelledby": `${idPrefix}-tab-${id}`,
    tabIndex: 0
  } as const;
}

export function Tabs<T extends string>({ tabs, active, onChange, idPrefix, label }: TabsProps<T>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  // WAI-ARIA tabs pattern: one tab stop (roving tabindex), arrows/Home/End move and activate.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((t) => t.id === active);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    onChange(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  }

  return (
    <div className="tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(el) => {
            refs.current[tab.id] = el;
          }}
          id={`${idPrefix}-tab-${tab.id}`}
          role="tab"
          aria-selected={active === tab.id}
          aria-controls={`${idPrefix}-panel-${tab.id}`}
          tabIndex={active === tab.id ? 0 : -1}
          className={`tab-btn${active === tab.id ? " active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
