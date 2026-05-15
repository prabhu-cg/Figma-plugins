import type { ComponentDocumentation } from '../types';

export interface IconGroup {
  name: string;
  icons: ComponentDocumentation[];
  count: number;
}

export interface IconLibraryData {
  totalIcons: number;
  groups: IconGroup[];
  allIcons: ComponentDocumentation[];
}

/**
 * Detect if a name suggests an icon page/section
 */
export function isIconPageName(pageName: string): boolean {
  const lower = pageName.toLowerCase();
  return lower.includes('icon') ||
         lower.includes('symbol') ||
         lower.includes('glyph') ||
         lower === 'ui kit' ||
         lower.includes('pictogram');
}

/**
 * Detect if a component is likely an icon based on name and properties
 * PRIMARY signal: page name (strongest)
 * Secondary signals: component naming, structure, variants
 */
export function isIconComponent(comp: ComponentDocumentation, pageNameHint?: string): boolean {
  const pageName = pageNameHint || comp.pageName || '';

  // STRONGEST signal: page name tells us definitively
  if (pageName) {
    // If the page is an icon page → definitely an icon
    if (isIconPageName(pageName)) return true;
    // If the page is NOT an icon page → definitely NOT an icon
    // (all other heuristics are unreliable when we have page context)
    return false;
  }

  // No page name available: fall back to name/structure heuristics
  const name = comp.name?.toLowerCase() || '';
  const nonIconKeywords = [
    'button', 'card', 'input', 'modal', 'dialog', 'drawer', 'sidebar',
    'header', 'footer', 'menu', 'nav', 'dropdown', 'select', 'checkbox',
    'radio', 'switch', 'toggle', 'tab', 'list', 'table', 'grid', 'form',
    'text', 'heading', 'title', 'label', 'badge', 'tag', 'tooltip',
    'notification', 'alert', 'avatar', 'accordion', 'pagination', 'field',
    'search', 'slider', 'price', 'link', 'image', 'content',
  ];
  if (nonIconKeywords.some(keyword => name.includes(keyword))) return false;

  const hasMinimalStructure = (comp.anatomy?.length || 0) <= 2;
  const noVariants = (comp.variantGroups?.length || 0) === 0;
  return hasMinimalStructure && noVariants;
}

/**
 * Extract icon category from component name
 * e.g., "arrow-up" -> "arrow", "bell-off" -> "bell", "activity" -> "activity"
 */
export function extractIconCategory(iconName: string): string {
  // Split by dash/hyphen and take the first part as category
  const parts = iconName.split('-');
  if (parts.length > 1) {
    // For names like "arrow-up", "arrow-down", return "arrow"
    // For names like "bell-off", return "bell"
    return parts[0];
  }
  // For single-word icons, they are their own category
  return iconName;
}

/**
 * Separate icons from regular components
 * Returns both regular components and icon data
 * Uses page context for strong icon detection
 */
export function separateIconsFromComponents(
  components: ComponentDocumentation[]
): {
  regularComponents: ComponentDocumentation[];
  iconLibrary: IconLibraryData | null;
} {
  // Debug: log a few components with their page names
  console.log('separateIconsFromComponents - sample components:');
  components.slice(0, 5).forEach((c) => {
    console.log(`  ${c.name}: pageName="${c.pageName}", isIcon=${isIconComponent(c, c.pageName)}`);
  });

  // Detect icons using page name as primary signal, then structural heuristics
  const icons = components.filter((comp) => isIconComponent(comp, comp.pageName));
  const regularComponents = components.filter((c) => !isIconComponent(c, c.pageName));

  console.log(`separateIconsFromComponents - Total: ${components.length}, Icons: ${icons.length}, Regular: ${regularComponents.length}`);

  if (icons.length === 0) {
    return { regularComponents: components, iconLibrary: null };
  }

  // Group icons by category
  const groupMap = new Map<string, ComponentDocumentation[]>();
  icons.forEach((icon) => {
    const category = extractIconCategory(icon.name || '');
    if (!groupMap.has(category)) {
      groupMap.set(category, []);
    }
    groupMap.get(category)!.push(icon);
  });

  // Convert map to sorted groups
  const groups: IconGroup[] = Array.from(groupMap.entries())
    .map(([name, icons]) => ({
      name,
      icons: icons.sort((a, b) => (a.name || '').localeCompare(b.name || '')),
      count: icons.length,
    }))
    .sort((a, b) => b.count - a.count); // Sort by count descending

  return {
    regularComponents,
    iconLibrary: {
      totalIcons: icons.length,
      groups,
      allIcons: icons,
    },
  };
}
