import type { VersionRecommendation } from "@shared/utils/versionRecommendation";
import type { ValidationCheck } from "@shared/utils/releaseValidation";
import type { MigrationItem } from "@shared/utils/migrationReport";

const BUMP_LABEL: Record<VersionRecommendation["bump"] & string, string> = {
  major: "MAJOR",
  minor: "MINOR",
  patch: "PATCH",
};

export function VersionRecommendationCard({
  recommendation,
  currentVersion,
  onApply,
}: {
  recommendation: VersionRecommendation;
  currentVersion: string;
  onApply: (version: string) => void;
}) {
  if (!recommendation.bump) {
    return (
      <div className="card">
        <div className="card-title" style={{ marginBottom: 4 }}>
          Recommended version
        </div>
        <div className="text-secondary" style={{ fontSize: 12 }}>
          {recommendation.reason}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <div className="card-title">Recommended version</div>
        <span className="badge badge-neutral">{BUMP_LABEL[recommendation.bump]}</span>
      </div>
      {recommendation.recommendedVersion ? (
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{recommendation.recommendedVersion}</div>
      ) : null}
      <div className="text-secondary" style={{ fontSize: 12, marginBottom: recommendation.recommendedVersion ? 10 : 0 }}>
        {recommendation.reason}
      </div>
      {recommendation.recommendedVersion &&
        (currentVersion.trim() === recommendation.recommendedVersion ? (
          <div className="text-secondary" style={{ fontSize: 12 }}>
            In use above.
          </div>
        ) : (
          <button className="btn btn-secondary btn-sm" onClick={() => onApply(recommendation.recommendedVersion as string)}>
            Use recommended
          </button>
        ))}
    </div>
  );
}

export function ValidationChecklistCard({ checks }: { checks: ValidationCheck[] }) {
  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 8 }}>
        Release validation
      </div>
      <div className="flex flex-col gap-2">
        {checks.map((check) => (
          <div key={check.id} className="flex items-start gap-2" style={{ fontSize: 12 }}>
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                color:
                  check.status === "pass"
                    ? "var(--color-success-text)"
                    : check.status === "warning"
                      ? "var(--color-warning-text)"
                      : "var(--color-critical-text)",
              }}
            >
              {check.status === "pass" ? "✓" : check.status === "warning" ? "⚠" : "✗"}
            </span>
            <span>
              <span className={check.status === "pass" ? "text-secondary" : undefined}>{check.label}</span>
              {check.detail && (
                <span className="text-tertiary" style={{ display: "block", fontSize: 11 }}>
                  {check.detail}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MigrationActionsCard({ items }: { items: MigrationItem[] }) {
  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 8 }}>
        Migration actions ({items.length})
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.entityId} style={{ fontSize: 12 }}>
            <div style={{ fontWeight: 600 }}>{item.entityName}</div>
            <div className="text-secondary">{item.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
