import { CATEGORY_LABELS } from "@shared/types";
import type { AuditCategory, ScanResult } from "@shared/types";
import { priorityCategories } from "../../lib/metrics";
import { scoreColors } from "../Shared";

interface PriorityStripProps {
  result: ScanResult;
  onReview: (category: AuditCategory) => void;
}

/** Answers "where do I start?" without opening a tab: the categories that cost the most score, one click from their issues. */
export function PriorityStrip({ result, onReview }: PriorityStripProps) {
  const items = priorityCategories(result, 3);

  if (items.length === 0) {
    return (
      <div className="card priority-strip">
        <h2 className="card-title">Start here</h2>
        <div className="text-secondary" style={{ fontSize: "var(--text-base)" }}>
          Nothing critical or warning-level needs attention. Suggestions are listed in Audit.
        </div>
      </div>
    );
  }

  return (
    <div className="card priority-strip">
      <h2 className="card-title">Start here — biggest score gains</h2>
      <ol className="priority-list">
        {items.map((item) => (
          <li key={item.category}>
            <button className="priority-item" onClick={() => onReview(item.category)}>
              <span className="priority-score" style={{ color: scoreColors(item.score).text }}>
                {item.score}
              </span>
              <span className="priority-main">
                <span className="priority-name">{CATEGORY_LABELS[item.category]}</span>
                <span className="priority-detail">
                  {[
                    item.critical > 0 ? `${item.critical} critical` : null,
                    item.warnings > 0 ? `${item.warnings} warning${item.warnings === 1 ? "" : "s"}` : null
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="priority-cta">Review in Audit →</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
