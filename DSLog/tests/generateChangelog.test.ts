import { describe, expect, it } from "vitest";
import { generateJson, generateMarkdown } from "@plugin/export/generateChangelog";
import { classify } from "@plugin/classifier/classify";
import type { RawChange } from "@plugin/diff/rawChange";

const include = { components: true, tokens: true, breakingChanges: true, migrationNotes: true };

function change(raw: RawChange) {
  return classify(raw);
}

describe("generateMarkdown", () => {
  it("includes added, changed, and breaking sections", () => {
    const changes = [
      change({ entityType: "component", entityId: "c1", entityName: "Button", changeType: "variant-added", field: "Loading" }),
      change({ entityType: "component", entityId: "c1", entityName: "Button", changeType: "variant-removed", field: "Large" }),
      change({ entityType: "token", entityId: "t1", entityName: "spacing.400", changeType: "token-added" }),
    ];
    const markdown = generateMarkdown({ version: "1.1.0", title: "Button updates", changes, include });

    expect(markdown).toContain("# Design System v1.1.0");
    expect(markdown).toContain("## Added");
    expect(markdown).toContain("## Breaking Changes");
    expect(markdown).toContain("Button");
    expect(markdown).toContain("spacing.400");
  });

  it("omits breaking changes section when include.breakingChanges is false", () => {
    const changes = [change({ entityType: "component", entityId: "c1", entityName: "Button", changeType: "variant-removed", field: "Large" })];
    const markdown = generateMarkdown({
      version: "1.1.0",
      title: "x",
      changes,
      include: { ...include, breakingChanges: false },
    });
    expect(markdown).not.toContain("## Breaking Changes");
  });

  it("excludes token changes when include.tokens is false", () => {
    const changes = [change({ entityType: "token", entityId: "t1", entityName: "spacing.400", changeType: "token-added" })];
    const markdown = generateMarkdown({ version: "1.0.0", title: "x", changes, include: { ...include, tokens: false } });
    expect(markdown).not.toContain("spacing.400");
  });

  it("lists migration notes when present", () => {
    const c = change({ entityType: "component", entityId: "c1", entityName: "Button", changeType: "variant-removed", field: "Large" });
    c.migrationNote = "Replace Button / Large with Button / XL.";
    const markdown = generateMarkdown({ version: "1.1.0", title: "x", changes: [c], include });
    expect(markdown).toContain("## Migration");
    expect(markdown).toContain("Replace Button / Large with Button / XL.");
  });
});

describe("generateJson", () => {
  it("produces machine-readable grouped output", () => {
    const changes = [
      change({ entityType: "component", entityId: "c1", entityName: "Button", changeType: "component-added" }),
      change({ entityType: "component", entityId: "c2", entityName: "Input", changeType: "component-removed" }),
    ];
    const json = generateJson({ version: "1.1.0", title: "x", changes, include });
    expect(json.summary.added).toBe(1);
    expect(json.summary.breaking).toBe(1);
    expect(json.added).toHaveLength(1);
    expect(json.breaking).toHaveLength(1);
  });
});
