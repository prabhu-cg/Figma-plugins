/**
 * Page type detection for design system files
 */

export type PageType = 'foundations' | 'core' | 'icons' | 'examples' | 'other';

export interface DetectedPages {
  foundations: string[];
  core: string[];
  icons: string[];
  examples: string[];
  other: string[];
}

export function isFoundationPageName(pageName: string): boolean {
  const lower = pageName.toLowerCase();
  return (
    lower.includes('color') || lower.includes('colour') || lower.includes('palette') ||
    lower.includes('typography') || lower.includes('typeface') || lower.includes('type scale') ||
    lower.includes('text style') || lower.includes('font style') ||
    lower === 'spacing' || lower === 'spacing system' || lower.startsWith('spacing ') ||
    lower === 'effects' || lower === 'shadows' || lower === 'elevation' ||
    lower === 'foundations' || lower === 'foundation' || lower === 'styles' ||
    lower === 'tokens' || lower.includes('design token') || lower === 'variables' ||
    lower === 'primitives' || lower === 'base' || lower === 'theme'
  );
}

export function detectPageType(pageName: string): PageType {
  const lower = pageName.toLowerCase();

  // Icons pages (highest priority)
  if (lower.includes('icon') || lower.includes('glyph')) {
    return 'icons';
  }

  // Foundation pages: colors, typography, spacing, tokens, etc.
  if (isFoundationPageName(pageName)) {
    return 'foundations';
  }

  // Example/demo pages (explicitly excluded from component extraction)
  if (
    lower.includes('example') ||
    lower.includes('demo') ||
    lower.includes('playground') ||
    lower.includes('sample') ||
    lower.includes('template') ||
    (lower.includes('page') && lower.length < 20)
  ) {
    return 'examples';
  }

  // Core pages — explicit design system naming
  if (
    lower.includes('component') ||
    lower.includes('design system') ||
    lower.includes('ui kit') ||
    lower.includes('design kit') ||
    lower.includes('symbol') ||
    lower.includes('library') ||
    lower === 'system' ||
    lower === 'design' ||
    lower === 'kit'
  ) {
    return 'core';
  }

  return 'other';
}

export function categorizePages(pageNames: string[]): DetectedPages {
  const result: DetectedPages = { foundations: [], core: [], icons: [], examples: [], other: [] };

  for (const name of pageNames) {
    const type = detectPageType(name);
    result[type].push(name);
  }

  return result;
}

export interface ExtractionSettings {
  mode: 'full-system' | 'core-design-system' | 'custom';
  includedPages: string[];
}

export function getDefaultSettings(detected: DetectedPages): ExtractionSettings {
  const corePages = detected.core.length > 0 ? detected.core : detected.other;

  return {
    mode: 'core-design-system',
    includedPages: [...corePages, ...detected.icons],
  };
}
