# Storage schema

DSLog stores everything locally, split across two Figma storage backends,
so that "close Figma, reopen, reopen DSLog, still see the baseline" (V1
acceptance criterion) holds regardless of which machine reopens the file.

## Where things live

| Backend | API | Scope | What's stored |
|---|---|---|---|
| **Plugin data** | `figma.root.getPluginData` / `setPluginData` | Attached to the document, travels with the `.fig` file | The heavy stuff, one part each: a `DesignSystemSnapshot` per baseline (all scanned components + tokens), each `ChangeSet`, and the impact index |
| **clientStorage** | `figma.clientStorage` | Per-user, this machine only | Compact project metadata: baseline/release records *without* their snapshot payloads, and `Settings` |

This split exists because plugin data is what actually persists with the
file (so a teammate opening the same file on a different machine sees the
same tracked baselines), while `clientStorage` is fast, small, and — per
the product spec's explicit storage strategy — the right place for
"compact project metadata."

## Chunking

Both `figma.clientStorage` values and plugin-data values are capped in
size by the platform. `src/plugin/storage/chunking.ts` splits a
JSON-serialized blob into fixed-size chunks (clientStorage: 800,000
characters; plugin data: 40,000 bytes, well under its 100 kB per-entry cap —
see `shared/constants/storage.ts`) written under keys
`<prefix>:g<gen>:chunk:0`, `<prefix>:g<gen>:chunk:1`, ... plus a
`<prefix>:index` key recording `{ count, gen }`. Reading walks the index and
reassembles the chunks; if the index is missing, unparseable, or any chunk is
missing, the read returns `undefined` rather than throwing — callers treat
that as "no data" and fall back to an empty project rather than crashing.
Data written before generations existed (`<prefix>:chunk:<i>`, index without
`gen`) is still read, and replaced on the next save.

### Crash-safe writes

A write never modifies the chunks the current index points at:

1. Write the new chunks under a fresh generation (`gen + 1`).
2. Write the index with a single `set` — this is the commit point.
3. Best-effort delete every other chunk key for the prefix (the previous
   generation, legacy keys, orphans from earlier failures). A failure here
   does not fail the save; the next write collects the leftovers.

If anything fails before step 2, the half-written generation is deleted and
the previous data stays fully readable. (Previously chunks were overwritten
in place before the index, so a failed save could leave a mix of old and new
chunks that read back as corrupt — i.e. an empty project.)

`saveProject` writes the plugin-data parts first and the meta blob last (see
"Saving only what changed"). Plugin data holds every baseline's snapshot, so if
the meta write fails afterwards, the older meta still finds all of its
snapshots in the newer plugin data and no baseline loads with an empty
snapshot.

## Logical shape

```ts
interface Project {
  schemaVersion: number;
  currentBaselineId?: string;
  baselines: Baseline[];
  releases: Release[];
  changeSets: ChangeSet[];
  trackedEntities: TrackedEntity[]; // V2 (schema version 2)
  instanceIndex?: InstanceIndex; // V2 Phase 2 — built only by an explicit "Build impact index" action
  settings: Settings;
}
```

On disk this is split into a small metadata blob plus one chunked blob per part:

```ts
// clientStorage, prefix "dslog:meta"
interface StoredMeta {
  schemaVersion: number;
  currentBaselineId?: string;
  baselines: Array<Omit<Baseline, "snapshot">>;
  releases: Release[];
  trackedEntities: TrackedEntity[]; // V2 — small, belongs in meta
  settings: Settings;
}

// plugin data (figma.root)
//   "dslog:manifest"           { layout: 2, snapshots: baselineId[], changeSets: changeSetId[], instanceIndex: boolean }
//   "dslog:snap:<baselineId>"  one DesignSystemSnapshot        (immutable once the baseline exists)
//   "dslog:cs:<changeSetId>"   one ChangeSet                    (edited by review actions)
//   "dslog:instances"          the InstanceIndex, if built       (can be large)
```

Each part is its own chunked blob (see Chunking), so a review action rewrites
one change set rather than the whole project.

`loadProject()` reads the manifest, then each listed part, and re-attaches
each baseline's snapshot from `dslog:snap:<baseline.id>` (falling back to an
empty snapshot if that part is missing/corrupted, rather than dropping the
baseline record). A change set that can't be read is dropped; the rest of the
project still loads. `saveProject()` does the inverse split.

### Saving only what changed

`saveProject()` compares each part with what it last wrote and skips the
unchanged ones. Snapshots are immutable, so they are recognised by object
identity and never re-serialised. Change sets are edited in place by several
handlers, so they are compared by their serialised text. Before skipping a
part, the store's current index record must still match the one remembered
for it, so a wiped or altered store is rewritten rather than assumed intact.
A part is only remembered as written once its write succeeded, so a failed
save is retried in full by the next one.

Write order, every step safe to stop after:

1. new or changed snapshots, change sets and impact index
2. the manifest — the commit point for plugin data; it only ever names parts that exist
3. clean-up of parts the manifest no longer lists (and of any left by an earlier crash), then of the legacy blob
4. meta (clientStorage) — last, so a failure leaves older meta pointing at newer, superset data

### The original layout

Versions before this stored all plugin data in one `dslog:heavy` blob
(`{ snapshots, changeSets, instanceIndex }`). That is still read when no
manifest exists. The first save converts the project to the layout above and
then deletes the old blob.

### Stale change sets

Every scan, baseline and release used to append a change set and none were
ever removed, so the stored project grew with each scan and History and search
listed the same change once per scan. A project now keeps only:

- the **latest** change set for the **current** baseline (what the Changes
  page shows and the next release is built from), and
- every change set a **release** points at (its permanent record).

Pruning happens after a scan, a baseline and a release, and once when an older
project is opened. Note that re-scanning still starts from a fresh, all-
unreviewed change set (review decisions are not carried across scans).

## Concurrency and failure handling

- Operations on one chunked blob (read, write, delete) run strictly one at a
  time, in request order. A write's post-commit clean-up deletes chunks that
  don't belong to its own generation, so two overlapping writes used to be able
  to delete each other's chunks and leave the index pointing at missing data.
- `saveProject()` is serialised, and the plugin handles UI messages one at a
  time (only `focus-node` skips the queue), which also stops one handler's
  rollback from undoing another's changes.
- Handlers that must not report success before the data is safe — creating a
  baseline or release, scanning, deprecation, settings — await their save, and
  roll the in-memory project back if it fails.
- Review actions (`update-change`, `bulk-update-review`) are different. They
  change the in-memory project, send the UI a small `changes-updated` patch at
  once, and save in the background after a short delay (about 120 ms, at most
  1 s), so a burst of key presses is saved once. If that save fails the user is
  told, the edit is **kept** in memory for the session, and the next save
  retries it. A save still waiting out its delay is flushed when the plugin
  closes.

## Corruption recovery

- A `readChunked` call that finds no index, an unparseable index, a
  missing chunk, or unparseable reassembled JSON returns `undefined`.
- `loadProject()` treats missing/invalid meta as "no project yet" and
  returns an empty `Project` (the Overview page then shows the "Start
  tracking your Design System" empty state).
- Missing/invalid plugin-data parts do **not** wipe the meta — baselines and
  releases still show up, just with an empty snapshot for any baseline
  whose snapshot part didn't load, and without any change set that couldn't
  be read. This means metadata corruption and snapshot-payload corruption fail
  independently rather than compounding.
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
