# Storage schema

DSLog stores everything locally, split across two Figma storage backends,
so that "close Figma, reopen, reopen DSLog, still see the baseline" (V1
acceptance criterion) holds regardless of which machine reopens the file.

## Where things live

| Backend | API | Scope | What's stored |
|---|---|---|---|
| **Plugin data** | `figma.root.getPluginData` / `setPluginData` | Attached to the document, travels with the `.fig` file | The heavy stuff: full `DesignSystemSnapshot` per baseline (all scanned components + tokens), and all `ChangeSet`s |
| **clientStorage** | `figma.clientStorage` | Per-user, this machine only | Compact project metadata: baseline/release records *without* their snapshot payloads, and `Settings` |

This split exists because plugin data is what actually persists with the
file (so a teammate opening the same file on a different machine sees the
same tracked baselines), while `clientStorage` is fast, small, and — per
the product spec's explicit storage strategy — the right place for
"compact project metadata."

## Chunking

Both `figma.clientStorage` values and plugin-data values are capped in
size by the platform. `src/plugin/storage/chunking.ts` splits a
JSON-serialized blob into fixed-size string chunks (`STORAGE_CHUNK_SIZE` =
800,000 characters, see `shared/constants/storage.ts`) written under keys
`<prefix>:chunk:0`, `<prefix>:chunk:1`, ... plus a `<prefix>:index` key
recording the chunk count. Reading walks the index and reassembles the
chunks; if the index is missing, unparseable, or any chunk is missing, the
read returns `undefined` rather than throwing — callers treat that as "no
data" and fall back to an empty project rather than crashing.

Writing always overwrites the index last (after all chunk writes succeed)
and deletes any stale trailing chunks left over from a previous, larger
write, so a shrinking blob doesn't leave orphaned chunks behind.

## Logical shape

```ts
interface Project {
  schemaVersion: number;
  currentBaselineId?: string;
  baselines: Baseline[];
  releases: Release[];
  changeSets: ChangeSet[];
  trackedEntities: TrackedEntity[]; // V2 (schema version 2)
  settings: Settings;
}
```

On disk this is split into two chunked blobs:

```ts
// clientStorage, prefix "dslog:meta"
interface StoredMeta {
  schemaVersion: number;
  currentBaselineId?: string;
  baselines: Array<Omit<Baseline, "snapshot">>;
  releases: Release[];
  trackedEntities: TrackedEntity[]; // V2 — small, belongs in meta not heavy
  settings: Settings;
}

// plugin data (figma.root), prefix "dslog:heavy"
interface HeavyData {
  snapshots: Record<string /* baselineId */, DesignSystemSnapshot>;
  changeSets: ChangeSet[];
}
```

`loadProject()` reads both, and re-attaches each baseline's snapshot from
`HeavyData.snapshots[baseline.id]` (falling back to an empty snapshot if
that baseline's heavy data is missing/corrupted, rather than dropping the
baseline record entirely). `saveProject()` does the inverse split.

## Corruption recovery

- A `readChunked` call that finds no index, an unparseable index, a
  missing chunk, or unparseable reassembled JSON returns `undefined`.
- `loadProject()` treats missing/invalid meta as "no project yet" and
  returns an empty `Project` (the Overview page then shows the "Start
  tracking your Design System" empty state).
- Missing/invalid heavy data does **not** wipe the meta — baselines and
  releases still show up, just with an empty snapshot for any baseline
  whose heavy payload didn't load. This means metadata corruption and
  snapshot-payload corruption fail independently rather than compounding.
- `shared/schemas/validate.ts` additionally provides `isValidProject` (a
  strict, all-or-nothing shape check) and `migrateProject` (a lenient,
  field-by-field repair — a single malformed field falls back to its
  default without discarding the rest of the object) for schema migrations.
  V1 was schema version 1; V2 (schema version 2) is the first real use of
  this path — `projectStore.loadProject()` now always routes the assembled
  `Project` through `migrateProject()` before returning it (previously
  `migrateProject` existed but nothing called it), which backfills a
  missing `trackedEntities: []` and maps each Change's old `reviewed:
  boolean` to the new `reviewState` (`true -> "reviewed"`, `false ->
  "unreviewed"`) so a project created under V1 keeps working unmodified
  after upgrading — no explicit "migrate now" step, it happens transparently
  on next load.

## Deterministic hashing

Every `ComponentSnapshot` and `TokenSnapshot` carries a `hash` field —
FNV-1a over a recursively key-sorted JSON stringification of the
snapshot, excluding `capturedAt` (`shared/utils/hash.ts`). The diff engine
compares hashes first and skips unchanged entities without a field-by-field
walk, which is what keeps diffing fast at 1,000+ components.
