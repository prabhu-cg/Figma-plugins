import { toFileSafeName } from '@shared/naming';
import type { ComponentDoc, DesignSystem } from '@shared/types';
import type { GeneratedFile } from '@shared/messages';
import { joinSections, mdHeading, mdList, mdTable } from './markdown';

/** A set can have hundreds of variants; past this many rows the table is noise, since every option is in Properties. */
const MAX_VARIANT_ROWS = 40;
/** Same idea for the tokens a component uses. */
const MAX_TOKEN_ROWS = 60;

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
  const shown = c.variants.slice(0, MAX_VARIANT_ROWS);
  const rows = shown.map((v) => [
    v.name,
    ...propertyNames.map((p) => v.variantProperties[p] ?? '—'),
  ]);
  const note =
    c.variants.length > shown.length
      ? `_Showing the first ${shown.length} of ${c.variants.length} variants. The Properties table below lists every option of each variant property; components.json lists all variants when it is exported._\n`
      : '';
  return joinSections([
    mdHeading(2, 'Variants'),
    mdTable(['Variant', ...propertyNames], rows),
    note,
  ]);
}

function layoutSection(c: ComponentDoc): string {
  const layout = c.layout;
  if (!layout) return '';
  const rows: string[][] = [['Size', `${layout.width} × ${layout.height}`]];
  if (layout.layoutMode === 'NONE') {
    rows.push(['Auto layout', 'None (fixed layout)']);
  } else {
    rows.push(['Auto layout', layout.layoutMode === 'HORIZONTAL' ? 'Horizontal' : 'Vertical']);
    if (layout.gap !== undefined) rows.push(['Gap', String(layout.gap)]);
    if (layout.padding) {
      const { top, right, bottom, left } = layout.padding;
      rows.push(['Padding (top, right, bottom, left)', `${top}, ${right}, ${bottom}, ${left}`]);
    }
  }
  if (layout.cornerRadius !== undefined) rows.push(['Corner radius', String(layout.cornerRadius)]);
  return joinSections([
    mdHeading(2, 'Layout'),
    `_Measured from the "${layout.measuredFrom}" ${c.isComponentSet ? 'variant' : 'component'}, in px._\n`,
    mdTable(['Property', 'Value'], rows),
  ]);
}

/** The default as people read it: a swap's default is a component name, not a node id. */
function defaultLabel(p: ComponentDoc['properties'][number]): string {
  if (p.type === 'INSTANCE_SWAP') return p.defaultResolvedName || '—';
  return p.defaultValue || '—';
}

function propertiesSection(c: ComponentDoc): string {
  if (c.properties.length === 0) {
    return joinSections([mdHeading(2, 'Properties'), '_No component properties defined._\n']);
  }
  const rows = c.properties.map((p) => [
    p.name,
    p.type,
    defaultLabel(p),
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
  const variablesById = new Map(ds.variables.map((v) => [v.id, v]));
  const stylesById = new Map(
    [...ds.styles.text, ...ds.styles.color, ...ds.styles.effect, ...ds.styles.grid].map((s) => [
      s.id,
      s,
    ]),
  );
  const variableRows = c.boundVariableIds.map((id) => {
    const v = variablesById.get(id);
    return v ? [v.name, v.cssName, v.category] : [id, '—', 'unresolved'];
  });
  // Styles count as tokens too: in a file built on styles they are most of what a component uses.
  const styleRows = (c.styleIds ?? []).flatMap((id) => {
    const s = stylesById.get(id);
    return s
      ? [[s.library ? `${s.name} (library)` : s.name, s.cssName, `${s.type.toLowerCase()} style`]]
      : [];
  });
  const all = [...variableRows, ...styleRows];
  if (all.length === 0) {
    return joinSections([
      mdHeading(2, 'Token References'),
      '_No bound variables or styles were detected on this component._\n',
    ]);
  }
  const shown = all.slice(0, MAX_TOKEN_ROWS);
  return joinSections([
    mdHeading(2, 'Token References'),
    mdTable(['Token', 'CSS Variable', 'Category'], shown),
    all.length > shown.length
      ? `_Showing ${shown.length} of ${all.length} tokens this component uses._\n`
      : '',
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
    layoutSection(c),
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
