import { useProjectState } from "@ui/state/ProjectContext";
import { DeprecationControl } from "@ui/components/DeprecationControl";
import { StatCard } from "@ui/components/Shared";
import type { TrackedEntity } from "@shared/types/entity";
import type { Project } from "@shared/types/project";

/** Earliest release published on/after the deprecation, or "Unreleased" if none exists yet. */
function findDeprecatedInVersion(project: Project, deprecatedAt: string | undefined): string {
  if (!deprecatedAt) return "Unreleased";
  const candidates = project.releases
    .filter((r) => r.createdAt >= deprecatedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return candidates[0] ? `v${candidates[0].version}` : "Unreleased";
}

export function DeprecationsTab() {
  const { project } = useProjectState();
  if (!project) return null;

  const deprecated = project.trackedEntities.filter((e) => e.deprecated);
  const needsMigration = deprecated.filter((e) => !e.replacement?.trim());
  const replacementAvailable = deprecated.filter((e) => e.replacement?.trim());

  if (deprecated.length === 0) {
    return (
      <div className="state-screen">
        <div className="state-title">Nothing deprecated</div>
        <div className="state-body">
          Mark a component, variant, property, or token deprecated from its History entry to see it here.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3">
        <StatCard label="Deprecated" value={deprecated.length} />
        <StatCard label="Needs migration" value={needsMigration.length} />
        <StatCard label="Replacement available" value={replacementAvailable.length} />
      </div>
      <div className="flex flex-col gap-2">
        {deprecated.map((entity) => (
          <DeprecatedItemCard key={entity.id} entity={entity} project={project} />
        ))}
      </div>
    </div>
  );
}

function DeprecatedItemCard({ entity, project }: { entity: TrackedEntity; project: Project }) {
  const deprecatedInVersion = findDeprecatedInVersion(project, entity.deprecatedAt);
  const instanceCount = entity.kind === "component" ? project.instanceIndex?.byComponentId[entity.id]?.count : undefined;

  return (
    <div className="card">
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{entity.displayName}</div>
        <div className="text-tertiary" style={{ fontSize: 11.5, marginTop: 2 }}>
          Deprecated in {deprecatedInVersion}
          {instanceCount !== undefined && (
            <>
              {" "}
              · {instanceCount} instance{instanceCount === 1 ? "" : "s"} affected
            </>
          )}
        </div>
      </div>
      <DeprecationControl entityId={entity.id} kind={entity.kind} displayName={entity.displayName} trackedEntity={entity} />
    </div>
  );
}
