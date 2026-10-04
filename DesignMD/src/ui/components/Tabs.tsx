import { useRef, type KeyboardEvent } from 'react';

export interface TabItem {
  id: string;
  label: string;
  /** Short count shown after the label, e.g. the number of pairs or files. */
  badge?: number;
}

interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  /** Prefix for element ids so panels can reference their tab (see tabId / panelId). */
  idPrefix: string;
  label: string;
}

export const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
export const panelId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

/** WAI-ARIA tabs: arrow keys move between tabs (wrapping), Home/End jump, only the active tab is tabbable. */
export function Tabs({ tabs, activeId, onChange, idPrefix, label }: TabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const move = (index: number) => {
    const next = tabs[(index + tabs.length) % tabs.length];
    onChange(next.id);
    refs.current[next.id]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
        move(index + 1);
        break;
      case 'ArrowLeft':
        move(index - 1);
        break;
      case 'Home':
        move(0);
        break;
      case 'End':
        move(tabs.length - 1);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div className="dmd-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const selected = tab.id === activeId;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[tab.id] = el;
            }}
            type="button"
            role="tab"
            id={tabId(idPrefix, tab.id)}
            aria-selected={selected}
            aria-controls={panelId(idPrefix, tab.id)}
            tabIndex={selected ? 0 : -1}
            className={`dmd-tab${selected ? ' is-selected' : ''}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="dmd-tab-badge">{tab.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
