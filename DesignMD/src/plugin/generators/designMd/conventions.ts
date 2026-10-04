import type { DesignSystem } from '@shared/types';
import { joinSections, mdHeading } from '../markdown';

export function namingConventionsSection(ds: DesignSystem): string {
  const allNames = [
    ...ds.variables.map((v) => v.name),
    ...Object.values(ds.styles)
      .flat()
      .map((s) => s.name),
  ];
  const slashDelimited = allNames.filter((n) => n.includes('/')).length;
  const dashDelimited = allNames.filter((n) => n.includes('-')).length;
  const camelCase = allNames.filter((n) => /[a-z][A-Z]/.test(n)).length;

  const dominant =
    slashDelimited >= dashDelimited && slashDelimited >= camelCase
      ? 'slash-delimited hierarchical naming (e.g. `Color/Primary/500`)'
      : dashDelimited >= camelCase
        ? 'kebab-case naming (e.g. `color-primary-500`)'
        : 'camelCase naming (e.g. `colorPrimary500`)';

  return joinSections([
    mdHeading(2, 'Naming Conventions'),
    `Detected source naming pattern: **${dominant}** (${allNames.length} names scanned).\n`,
    'All generated CSS custom properties are normalized to kebab-case with a `--` prefix (e.g. `--color-primary-500`), regardless of the source naming style, so downstream code has one consistent convention.\n',
  ]);
}

export function designPrinciplesSection(): string {
  return joinSections([
    mdHeading(2, 'Design Principles'),
    '_DesignMD does not invent design principles — this file only documents what already exists in Figma. ' +
      "Add your team's principles here (e.g. consistency, accessibility, clarity, scalability) so this file stays the single source of truth for both design intent and tokens._\n",
  ]);
}
