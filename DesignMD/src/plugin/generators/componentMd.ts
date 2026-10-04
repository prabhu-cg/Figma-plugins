import { toFileSafeName } from '@shared/naming';
import type { ComponentDoc, DesignSystem } from '@shared/types';
import type { GeneratedFile } from '@shared/messages';
import { joinSections, mdHeading, mdList, mdTable } from './markdown';

function variantsSection(c: ComponentDoc): string {
  if (
    c.variants.length === 0 ||
    (c.variants.length === 1 && Object.keys(c.variants[0].variantProperties).length === 0)
  ) {
    return joinSections([
      mdHeading(2, 'Variants'),
      '_This component has no variant properties._\n',
    ]);
  }
  const propertyNames = Array.from(
    new Set(c.variants.flatMap((v) => Object.keys(v.variantProperties))),
  );
  const rows = c.variants.map((v) => [
    v.name,
    ...propertyNames.map((p) => v.variantProperties[p] ?? '—'),
  ]);
  return joinSections([mdHeading(2, 'Variants'), mdTable(['Variant', ...propertyNames], rows)]);
}

function propertiesSection(c: ComponentDoc): string {
  if (c.properties.length === 0) {
    return joinSections([mdHeading(2, 'Properties'), '_No component properties defined._\n']);
  }
  const rows = c.properties.map((p) => [
    p.name,
    p.type,
    p.defaultValue || '—',
    p.variantOptions?.join(', ') ?? '—',
  ]);
  return joinSections([
    mdHeading(2, 'Properties'),
    mdTable(['Property', 'Type', 'Default', 'Options'], rows),
  ]);
}

function sizesAndStatesSection(c: ComponentDoc): string {
  return joinSections([
    mdHeading(2, 'Sizes'),
    mdList(c.sizes),
    mdHeading(2, 'States'),
    mdList(c.states),
  ]);
}

function accessibilitySection(c: ComponentDoc): string {
  const notes: string[] = [];
  if (c.states.length === 0) {
    notes.push(
      'No interaction states (hover/focus/disabled/etc.) were detected — verify keyboard focus and state styling are implemented in code even if not modeled in Figma.',
    );
  } else {
    notes.push(
      `Detected states: ${c.states.join(', ')}. Ensure each has a corresponding accessible implementation (e.g. :focus-visible, :disabled, aria-pressed).`,
    );
  }
  notes.push(
    'Confirm this component has an accessible name (visible label, aria-label, or aria-labelledby) in its code implementation.',
  );
  return joinSections([mdHeading(2, 'Accessibility Notes'), mdList(notes)]);
}

function usageGuidelinesSection(c: ComponentDoc): string {
  return joinSections([
    mdHeading(2, 'Usage Guidelines'),
    c.description
      ? `${c.description}\n`
      : '_No usage guidance was provided in Figma. Add a description to the component or component set to populate this section._\n',
  ]);
}

function tokenReferencesSection(c: ComponentDoc, ds: DesignSystem): string {
  if (c.boundVariableIds.length === 0) {
    return joinSections([
      mdHeading(2, 'Token References'),
      '_No bound variables were detected on this component._\n',
    ]);
  }
  const variablesById = new Map(ds.variables.map((v) => [v.id, v]));
  const rows = c.boundVariableIds.map((id) => {
    const v = variablesById.get(id);
    return v ? [v.name, v.cssName, v.category] : [id, '—', 'unresolved'];
  });
  return joinSections([
    mdHeading(2, 'Token References'),
    mdTable(['Token', 'CSS Variable', 'Category'], rows),
  ]);
}

function relatedComponentsSection(c: ComponentDoc): string {
  return joinSections([mdHeading(2, 'Related Components'), mdList(c.relatedComponentNames)]);
}

/**
 * Assigns each component a unique `components/<Name>.md` path. Uniqueness is checked
 * case-insensitively because ZIPs are extracted onto case-insensitive filesystems
 * (macOS, Windows), where `Button.md` and `button.md` would overwrite each other.
 */
export function assignComponentDocPaths(components: ComponentDoc[]): Map<string, string> {
  const paths = new Map<string, string>();
  const taken = new Set<string>();
  for (const c of components) {
    const base = toFileSafeName(c.name);
    let candidate = base;
    for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${base}-${n}`;
    taken.add(candidate.toLowerCase());
    paths.set(c.id, `components/${candidate}.md`);
  }
  return paths;
}

export function generateComponentMd(
  c: ComponentDoc,
  ds: DesignSystem,
  path = `components/${toFileSafeName(c.name)}.md`,
): GeneratedFile {
  const content = joinSections([
    mdHeading(1, c.name),
    c.isComponentSet ? '_Component Set_\n' : '_Component_\n',
    mdHeading(2, 'Description'),
    c.description ? `${c.description}\n` : '_No description provided in Figma._\n',
    variantsSection(c),
    sizesAndStatesSection(c),
    propertiesSection(c),
    accessibilitySection(c),
    usageGuidelinesSection(c),
    tokenReferencesSection(c, ds),
    relatedComponentsSection(c),
  ]);

  return { path, content };
}

export function generateComponentDocs(ds: DesignSystem): GeneratedFile[] {
  const paths = assignComponentDocPaths(ds.components);
  return ds.components.map((c) => generateComponentMd(c, ds, paths.get(c.id)));
}
