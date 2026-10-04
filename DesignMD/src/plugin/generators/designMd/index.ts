import type { DesignSystem } from '@shared/types';
import type { GeneratedFile } from '@shared/messages';
import { joinSections, mdHeading } from '../markdown';
import { accessibilitySection } from './accessibility';
import { componentsSection } from './components';
import { designPrinciplesSection, namingConventionsSection } from './conventions';
import { collectionsSection, overviewSection } from './overview';
import {
  colorTokensSection,
  effectTokensSection,
  gridTokensSection,
  spacingTokensSection,
  typographyTokensSection,
} from './tokens';
import { styleUsageSection, tokenUsageSection } from './usage';

export function generateDesignMd(ds: DesignSystem): GeneratedFile {
  const content = joinSections([
    mdHeading(1, 'Design System'),
    overviewSection(ds),
    collectionsSection(ds),
    colorTokensSection(ds),
    typographyTokensSection(ds),
    spacingTokensSection(ds),
    effectTokensSection(ds),
    gridTokensSection(ds),
    componentsSection(ds),
    tokenUsageSection(ds),
    styleUsageSection(ds),
    accessibilitySection(ds),
    namingConventionsSection(ds),
    designPrinciplesSection(),
  ]);

  return { path: 'design.md', content };
}
