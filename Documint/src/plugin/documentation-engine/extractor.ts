import type {
  ComponentDocumentation,
  AnatomyPart,
  VariantGroup,
  ComponentState,
  ComponentProperty,
  TokenBinding,
  AccessibilityInfo,
  UsageGuidelines,
  AssumptionNote,
  ExtractionContext,
} from './types';

// Parse naming convention: "Button/Primary/Small" → segments
function parseComponentName(name: string): string[] {
  return name.split('/').map((s) => s.trim()).filter(Boolean);
}

// Extract variant groups from component properties
function extractVariantGroups(componentProperties: Record<string, any>): VariantGroup[] {
  const groups: VariantGroup[] = [];

  for (const [key, prop] of Object.entries(componentProperties)) {
    if (prop && typeof prop === 'object') {
      // Handle VARIANT type (main variant properties)
      if (prop.type === 'VARIANT') {
        // Support both variantOptions (Figma API) and defaultValue (test/legacy)
        const values = prop.variantOptions || prop.defaultValue || [];
        if (Array.isArray(values) && values.length > 0) {
          groups.push({
            name: key.charAt(0).toUpperCase() + key.slice(1),
            values: values,
          });
        }
      }
      // Skip BOOLEAN and other types - they're not primary variants
    }
  }

  return groups;
}

// Infer states from variant names or predefined states
function inferStates(variants: any[], componentName: string): ComponentState[] {
  const stateNames = new Set<string>();
  const predefinedStates: Record<string, string> = {
    default: 'Base appearance',
    hover: 'On pointer hover',
    focus: 'Keyboard focus state',
    active: 'Pressed or selected state',
    disabled: 'Non-interactive state',
    loading: 'In-progress state',
  };

  // Check variant names for state patterns
  variants.forEach((v) => {
    const nameParts = parseComponentName(v.name);
    nameParts.forEach((part) => {
      const lower = part.toLowerCase();
      if (predefinedStates[lower]) {
        stateNames.add(lower);
      }
    });
  });

  // Always include default if nothing else found
  if (stateNames.size === 0) {
    stateNames.add('default');
  }

  return Array.from(stateNames)
    .sort()
    .map((name) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      description: predefinedStates[name] || 'Custom state',
    }));
}

// Extract full physical component tree - all nested children recursively
// For component sets, extract from first variant; for components, extract from children
function extractAnatomy(children: any[], isComponentSet: boolean = false): AnatomyPart[] {
  const anatomy: AnatomyPart[] = [];
  const processedIds = new Set<string>();

  // Recursively extract all structural nodes from the physical tree
  function extractRecursively(nodes: any[], depth: number = 0): void {
    if (!nodes || nodes.length === 0) return;

    const STRUCTURAL_TYPES = new Set(['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT', 'TEXT', 'VECTOR', 'RECTANGLE', 'ELLIPSE', 'BUTTON']);

    nodes.forEach((node) => {
      if (!node || !node.name || processedIds.has(node.id)) return;

      // Skip variant instances (names contain =)
      if (node.name.includes('=')) return;

      if (STRUCTURAL_TYPES.has(node.type)) {
        processedIds.add(node.id);

        // Use explicit description if available, otherwise just the node name
        const description = node.description?.trim() || '';

        anatomy.push({
          name: node.name,
          description,
          nodeId: node.id,
          nodeType: node.type,
        });

        // Recursively extract nested children
        if (node.children && Array.isArray(node.children)) {
          extractRecursively(node.children, depth + 1);
        }
      }
    });
  }

  extractRecursively(children);
  return anatomy;
}


// Helper: Convert component property value to readable string
// For instances, tries to get the component name; for everything else, uses the raw value
function formatPropertyValue(value: any, key: string): string {
  if (value === null || value === undefined) return '';

  // String and number values (most common)
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);

  // Boolean values
  if (typeof value === 'boolean') return value ? 'true' : 'false';

  // Object values (instances from INSTANCE_SWAP)
  if (typeof value === 'object') {
    // Try to extract meaningful component name
    if (value.name && typeof value.name === 'string') return value.name;
    if (value.mainComponent && value.mainComponent.name) return value.mainComponent.name;
    if (value.component && value.component.name) return value.component.name;

    // If it's a node reference object, try to get type info
    if (value.type && typeof value.type === 'string') {
      return value.type; // e.g., "COMPONENT", "INSTANCE"
    }

    // Skip pure ID objects (just {id: "..."})
    return '';
  }

  return '';
}

// Infer properties from variant combinations
function inferProperties(variants: any[]): ComponentProperty[] {
  const properties: ComponentProperty[] = [];
  const propertyMap = new Map<string, Set<string>>();

  variants.forEach((v) => {
    if (v.componentProperties) {
      Object.entries(v.componentProperties).forEach(([key, value]) => {
        if (!propertyMap.has(key)) {
          propertyMap.set(key, new Set());
        }
        if (value !== null && value !== undefined) {
          const formatted = formatPropertyValue(value, key);
          if (formatted) {
            propertyMap.get(key)!.add(formatted);
          }
        }
      });
    }
  });

  propertyMap.forEach((values, name) => {
    const sortedValues = Array.from(values).sort();
    if (sortedValues.length > 0) {
      properties.push({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        values: sortedValues,
      });
    }
  });

  return properties;
}

// Hybrid token detection: Figma variables first, then naming convention inference
function extractTokenBindings(
  component: any,
  context: ExtractionContext
): { colors: TokenBinding[]; spacing: TokenBinding[]; typography: TokenBinding[] } {
  const bindings = {
    colors: [] as TokenBinding[],
    spacing: [] as TokenBinding[],
    typography: [] as TokenBinding[],
  };

  // Tier 1: Check for Figma bound variables
  if (component.boundVariables) {
    Object.entries(component.boundVariables).forEach(([key, value]: [string, any]) => {
      if (value && typeof value === 'object' && value.id) {
        // Look up variable name from the map, fallback to formatted ID
        let tokenName = value.id;
        if (context.variableIdToNameMap && context.variableIdToNameMap[value.id]) {
          tokenName = context.variableIdToNameMap[value.id];
        } else {
          // Format the ID as "var(id)" if no mapping found
          tokenName = `var(${value.id})`;
        }

        const binding: TokenBinding = {
          element: key,
          value: tokenName,
          isToken: true,
        };

        if (key.includes('color') || key.includes('fill')) {
          bindings.colors.push(binding);
        } else if (key.includes('padding') || key.includes('margin') || key.includes('gap')) {
          bindings.spacing.push(binding);
        } else if (key.includes('font') || key.includes('text')) {
          bindings.typography.push(binding);
        }
      }
    });
  }

  return bindings;
}

// Extract accessibility info - evidence-based observations
function extractAccessibilityInfo(
  component: any,
  category: string,
  states: ComponentState[],
  anatomy: AnatomyPart[]
): AccessibilityInfo {
  const stateNames = states.map((s) => s.name.toLowerCase());
  const anatomyNames = anatomy.map((a) => a.name.toLowerCase());

  // Determine accessibility role
  const lower = component.name.toLowerCase();
  let accessibilityRole = 'unknown';
  if (lower.includes('button')) accessibilityRole = 'button';
  else if (lower.includes('checkbox')) accessibilityRole = 'checkbox';
  else if (lower.includes('input') || lower.includes('field')) accessibilityRole = 'input';

  // Keyboard interaction description
  const keyboardMap: Record<string, string> = {
    button: 'Enter or Space to activate',
    checkbox: 'Space to toggle',
    radio: 'Arrow keys to select',
    input: 'Type to enter; Tab to move focus',
    unknown: 'Tab to focus component',
  };

  const interactionClarity = keyboardMap[accessibilityRole] || keyboardMap.unknown;

  // Contrast observation
  let contrastObservation = 'Not verified';
  if (component.fills && component.fills.length > 0) {
    contrastObservation = 'Verify color contrast at implementation time';
  }

  // Focus state observation
  if (stateNames.some((s) => s.includes('focus'))) {
    contrastObservation += ' — focus state variant detected';
  }

  return {
    contrast: contrastObservation,
    interactionClarity,
  };
}

// Enforce character limit on usage guideline items
function enforceCharLimit(items: string[], maxChars: number = 85): string[] {
  return items.map(item => {
    if (item.length > maxChars) {
      return item.substring(0, maxChars - 1) + '…';
    }
    return item;
  });
}

// Extract all technical specifications from component (recursive)
function extractComponentSpecs(component: any, states: ComponentState[]): {
  textElements: Array<{ name: string; fontSize: number; width: number; maxChars: number }>;
  icons: Array<{ name: string; width: number; height: number }>;
  componentSize: { width: number; height: number } | null;
  itemSpacing: number | null;
  supportedStates: string[];
} {
  const specs = {
    textElements: [] as Array<{ name: string; fontSize: number; width: number; maxChars: number }>,
    icons: [] as Array<{ name: string; width: number; height: number }>,
    componentSize: null as { width: number; height: number } | null,
    itemSpacing: null as number | null,
    supportedStates: [] as string[],
  };

  try {
    // Extract component size
    if (component.width && component.height) {
      specs.componentSize = {
        width: Math.round(component.width),
        height: Math.round(component.height),
      };
    }

    // Extract item spacing
    if (component.itemSpacing) {
      specs.itemSpacing = Math.round(component.itemSpacing);
    }

    // Recursively extract text and icon elements from all descendants (with deduplication)
    const seenTextElements = new Set<string>();
    const seenIcons = new Set<string>();

    function extractDescendants(nodes: any[]): void {
      if (!nodes || nodes.length === 0) return;

      for (const node of nodes) {
        if (!node) continue;

        const nodeName = (node.name || '').toLowerCase();
        const nodeWidth = node.width ? Math.round(node.width) : 0;
        const nodeHeight = node.height ? Math.round(node.height) : 0;
        const fontSize = node.fontSize ? Math.round(node.fontSize) : 0;

        // Extract TEXT nodes (deduplicate by name+fontSize)
        if (node.type === 'TEXT' && fontSize > 0) {
          const key = `${node.name}|${fontSize}|${nodeWidth}`;
          if (!seenTextElements.has(key)) {
            seenTextElements.add(key);
            const charWidth = fontSize * 0.55;
            const maxChars = nodeWidth > 0 ? Math.round(nodeWidth / charWidth) : 50;
            specs.textElements.push({
              name: node.name || 'Text',
              fontSize,
              width: nodeWidth,
              maxChars: Math.max(10, maxChars),
            });
          }
        }

        // Extract ICON elements (deduplicate by name+dimensions)
        if (nodeName.includes('icon') && (nodeWidth > 0 || nodeHeight > 0)) {
          const key = `${node.name}|${nodeWidth}|${nodeHeight}`;
          if (!seenIcons.has(key)) {
            seenIcons.add(key);
            specs.icons.push({
              name: node.name || 'Icon',
              width: nodeWidth || 16,
              height: nodeHeight || 16,
            });
          }
        }

        // Recurse into children
        if (node.children && Array.isArray(node.children)) {
          extractDescendants(node.children);
        }
      }
    }

    // Start recursive extraction from component children
    if (component.children && Array.isArray(component.children)) {
      extractDescendants(component.children);
    }

    // Extract supported states
    const stateNames = states.map((s: ComponentState) => (s.name || '').toLowerCase());
    if (stateNames.some((s: string) => s.includes('default'))) specs.supportedStates.push('default');
    if (stateNames.some((s: string) => s.includes('hover'))) specs.supportedStates.push('hover');
    if (stateNames.some((s: string) => s.includes('disabled') || s.includes('disable'))) specs.supportedStates.push('disabled');
    if (stateNames.some((s: string) => s.includes('press') || s.includes('active'))) specs.supportedStates.push('active');
    if (stateNames.some((s: string) => s.includes('focus'))) specs.supportedStates.push('focus');
    if (stateNames.some((s: string) => s.includes('loading') || s.includes('load'))) specs.supportedStates.push('loading');
  } catch (_) {
    // Silent fail
  }

  return specs;
}

// Generate contextual usage guidelines based on component type
function generateContextualUsageGuidelines(component: any, specs: any): { whenToUse: string[]; whenNotToUse: string[] } {
  const componentName = (component.name || '').toLowerCase();
  const hasTextElements = specs.textElements.length > 0;
  const hasIcons = specs.icons.length > 0;
  const hasMultipleStates = specs.supportedStates.length > 2;

  const whenToUse: string[] = [];
  const whenNotToUse: string[] = [];

  // Menu-specific guidance
  if (componentName.includes('menu')) {
    whenToUse.push('Navigation menus and dropdown lists');
    whenToUse.push('Action menus with predefined options');
    if (hasTextElements) whenToUse.push(`Text labels within ${specs.textElements[0]?.maxChars || 50} character limit`);
    if (hasIcons) whenToUse.push('Icon-based menu indicators');
    whenToUse.push('Organizing related menu items');
    whenToUse.push('Accessible keyboard navigation');

    whenNotToUse.push('Primary page navigation');
    whenNotToUse.push('Text exceeding character limits');
    if (hasIcons) whenNotToUse.push('Resizing icons beyond specifications');
    whenNotToUse.push('Deep menu nesting (>3 levels)');
    whenNotToUse.push('Mixed styling or custom overrides');
    whenNotToUse.push('Disabling without clear feedback');
  }

  // Button-specific guidance
  if (componentName.includes('button')) {
    whenToUse.push('User action triggers and submissions');
    whenToUse.push('Form confirmations and workflows');
    if (hasTextElements) whenToUse.push('Clear, action-oriented labels');
    whenToUse.push('Primary calls-to-action');
    whenToUse.push('Interactive state feedback');
    whenToUse.push('Keyboard and mouse interactions');

    whenNotToUse.push('Navigation (use links instead)');
    whenNotToUse.push('Generic or ambiguous labels');
    whenNotToUse.push('Disabled state without reason');
    whenNotToUse.push('Combining multiple button styles');
    whenNotToUse.push('Oversized or undersized buttons');
    whenNotToUse.push('Removing state indicators');
  }

  // Input-specific guidance
  if (componentName.includes('input') || componentName.includes('field')) {
    whenToUse.push('User text input collection');
    if (hasTextElements) whenToUse.push('Clear placeholder and label text');
    whenToUse.push('Form data entry');
    whenToUse.push('Search and filtering');
    whenToUse.push('Error and validation states');
    whenToUse.push('Focused user attention');

    whenNotToUse.push('Display-only content');
    whenNotToUse.push('Text beyond field width');
    whenNotToUse.push('Hiding required indicators');
    whenNotToUse.push('Removing error messages');
    whenNotToUse.push('Disabled without context');
    whenNotToUse.push('Custom validation overrides');
  }

  // Fallback for unrecognized components
  if (whenToUse.length === 0) {
    whenToUse.push('Follow component design specifications');
    whenToUse.push('Maintain consistency across instances');
    if (hasTextElements) whenToUse.push(`Adhere to text character limits`);
    if (hasIcons) whenToUse.push('Use icons as specified');
    if (specs.componentSize) whenToUse.push('Respect minimum component dimensions');
    if (hasMultipleStates) whenToUse.push('Test all component state variations');
  }

  if (whenNotToUse.length === 0) {
    whenNotToUse.push('Modify component structure');
    whenNotToUse.push('Override specifications');
    whenNotToUse.push('Detach instances');
    whenNotToUse.push('Mix with other patterns');
    whenNotToUse.push('Force incompatible content');
    whenNotToUse.push('Bypass accessibility');
  }

  return { whenToUse, whenNotToUse };
}

// Analyze component structure and generate dynamic guidelines
function buildDynamicUsageGuidelines(component: any, states: ComponentState[]): UsageGuidelines {
  const CHAR_LIMIT = 85;
  const specs = extractComponentSpecs(component, states);
  const contextualGuidelines = generateContextualUsageGuidelines(component, specs);

  const whenToUse: string[] = contextualGuidelines.whenToUse;
  const whenNotToUse: string[] = contextualGuidelines.whenNotToUse;
  const dos: string[] = [];
  const donts: string[] = [];

  // Add Dos based on component specs
  for (const textElem of specs.textElements) {
    dos.push(`Keep ${textElem.name} within ${textElem.maxChars} characters`);
  }
  for (const icon of specs.icons) {
    dos.push(`Maintain ${icon.width}x${icon.height}px icon size`);
  }
  if (specs.componentSize) {
    dos.push(`Never resize below ${specs.componentSize.width}x${specs.componentSize.height}px`);
  }
  if (specs.itemSpacing) {
    dos.push(`Maintain ${specs.itemSpacing}px spacing consistency`);
  }
  dos.push('Test component across all states and variations');
  dos.push('Use consistent spacing throughout implementation');
  dos.push('Maintain alignment with design system');
  dos.push('Test keyboard navigation thoroughly');
  dos.push('Verify accessibility compliance');
  dos.push('Test with screen readers');

  // Add Donts based on component specs
  for (const textElem of specs.textElements) {
    donts.push(`Exceed ${textElem.maxChars} character limit`);
  }
  for (const icon of specs.icons) {
    donts.push(`Resize icons beyond ${icon.width}x${icon.height}px`);
  }
  donts.push('Override internal component styling');
  donts.push('Detach instances for modifications');
  donts.push('Alter spacing values without approval');
  donts.push('Bypass design system specifications');
  donts.push('Mix component variants inconsistently');
  donts.push('Ignore responsive behavior requirements');

  return {
    whenToUse: enforceCharLimit(whenToUse.slice(0, 6), CHAR_LIMIT),
    whenNotToUse: enforceCharLimit(whenNotToUse.slice(0, 6), CHAR_LIMIT),
    dos: enforceCharLimit(dos.slice(0, 6), CHAR_LIMIT),
    donts: enforceCharLimit(donts.slice(0, 6), CHAR_LIMIT),
  };
}

// Build usage guidelines - component-aware
function buildUsageGuidelines(componentName: string, _states: ComponentState[]): UsageGuidelines {
  const lower = componentName.toLowerCase();
  const CHAR_LIMIT = 85;

  // Button-specific guidelines
  if (lower.includes('button') || lower.includes('btn')) {
    if (lower.includes('primary') || lower.includes('main')) {
      return {
        whenToUse: enforceCharLimit([
          'Primary call-to-action for main task completion',
          'High-emphasis user actions that drive conversion',
          'Form submissions and workflow confirmations',
          'Critical user interactions requiring attention',
          'Single primary action per page or section',
          'Important navigation or state transitions',
        ], CHAR_LIMIT),
        whenNotToUse: enforceCharLimit([
          'Secondary or tertiary actions in workflow',
          'Non-critical interactions or optional tasks',
          'Navigation between equally important pages',
          'Cancel or dismiss actions (use secondary button)',
          'Multiple competing calls-to-action',
          'Disabled state for extended periods',
        ], CHAR_LIMIT),
        dos: enforceCharLimit([
          'Use clear, action-oriented labels',
          'Maintain adequate spacing from other buttons',
          'Provide hover and active states',
          'Test color contrast for accessibility',
        ], CHAR_LIMIT),
        donts: enforceCharLimit([
          'Use generic labels like "Click here"',
          'Disable without clear reason or feedback',
          'Create multiple primary buttons per screen',
          'Nest buttons inside other interactive elements',
        ], CHAR_LIMIT),
      };
    }
    if (lower.includes('secondary')) {
      return {
        whenToUse: enforceCharLimit([
          'Supporting actions complementary to primary action',
          'Alternative workflows alongside primary option',
          'Save or draft actions',
          'Optional but helpful operations',
          'Navigation to related pages',
          'Advanced or less common features',
        ], CHAR_LIMIT),
        whenNotToUse: enforceCharLimit([
          'Primary call-to-action when emphasis required',
          'When visual hierarchy demands prominence',
          'Standalone buttons without primary context',
          'Critical path actions (use primary instead)',
          'Destructive actions (use danger button)',
          'Repeated use creates visual confusion',
        ], CHAR_LIMIT),
        dos: enforceCharLimit([
          'Pair with primary button in workflows',
          'Keep labels concise and action-oriented',
          'Ensure clear visual distinction from primary',
          'Group secondary buttons logically',
        ], CHAR_LIMIT),
        donts: enforceCharLimit([
          'Overuse secondary buttons in interface',
          'Mix button styles inconsistently',
          'Hide secondary button if not essential',
          'Use same prominence as primary action',
        ], CHAR_LIMIT),
      };
    }
    return {
      whenToUse: enforceCharLimit([
        'User-initiated actions and interactions',
        'Form submissions and data confirmation',
        'Opening modals or drawers',
        'Triggering workflows or processes',
        'Toggling features on and off',
        'Completing multi-step tasks',
      ], CHAR_LIMIT),
      whenNotToUse: enforceCharLimit([
        'Navigation links (use Link component)',
        'Passive content display or information',
        'Purely visual elements without function',
        'Page-level navigation (use navigation patterns)',
        'Feedback messages (use notifications)',
        'Container or layout purposes',
      ], CHAR_LIMIT),
      dos: enforceCharLimit([
        'Label clearly with action verb',
        'Provide appropriate size variants',
        'Include loading state for async actions',
        'Test keyboard accessibility',
      ], CHAR_LIMIT),
      donts: enforceCharLimit([
        'Use ambiguous or passive labels',
        'Combine multiple purposes in one button',
        'Disable state without user feedback',
        'Create single-use buttons',
      ], CHAR_LIMIT),
    };
  }

  // Input/Field guidelines
  if (lower.includes('input') || lower.includes('field') || lower.includes('textarea')) {
    return {
      whenToUse: enforceCharLimit([
        'Collecting structured user text input',
        'Form data entry and validation',
        'Search functionality within pages',
        'Single-line or multi-line text input',
        'Email, password, and URL collection',
        'Providing helpful placeholder guidance',
      ], CHAR_LIMIT),
      whenNotToUse: enforceCharLimit([
        'When read-only content display suffices',
        'For large data sets or document editing',
        'Non-text data collection (use specialized inputs)',
        'Display-only information or labels',
        'Unstructured content longer than form field',
        'When predefined options available (use select)',
      ], CHAR_LIMIT),
      dos: enforceCharLimit([
        'Provide clear, descriptive labels above input',
        'Show error states and validation feedback',
        'Include helper text for guidance',
        'Use appropriate input type for content',
        'Test with various input lengths',
      ], CHAR_LIMIT),
      donts: enforceCharLimit([
        'Hide placeholder text as primary label',
        'Disable error messaging or validation',
        'Allow unlimited character input',
        'Use placeholder for required field indicator',
        'Apply inconsistent styling across forms',
      ], CHAR_LIMIT),
    };
  }

  // Checkbox guidelines
  if (lower.includes('checkbox')) {
    return {
      whenToUse: enforceCharLimit([
        'Multiple independent selection scenarios',
        'Binary agreement or confirmation choices',
        'Filtering or toggling multiple options',
        'Opt-in/opt-out preference controls',
        'License acceptance or terms confirmation',
        'Feature enablement in settings',
      ], CHAR_LIMIT),
      whenNotToUse: enforceCharLimit([
        'Single selection among options (use radio)',
        'When toggle behavior is more appropriate',
        'Mutually exclusive options (use radio)',
        'Simple yes/no decision (use toggle)',
        'Complex multi-selection (use select)',
        'Hierarchical selection patterns',
      ], CHAR_LIMIT),
      dos: enforceCharLimit([
        'Group related checkboxes logically',
        'Maintain clear and consistent focus states',
        'Label checkboxes with descriptive text',
        'Ensure keyboard accessibility',
        'Provide helper text if selection has impact',
      ], CHAR_LIMIT),
      donts: enforceCharLimit([
        'Use for mutually exclusive options',
        'Pre-check items unexpectedly or without reason',
        'Hide checkboxes or make hidden by default',
        'Create deeply nested checkbox hierarchies',
        'Use without accompanying labels',
      ], CHAR_LIMIT),
    };
  }

  // Radio guidelines
  if (lower.includes('radio')) {
    return {
      whenToUse: enforceCharLimit([
        'Mutually exclusive selection from options',
        'When exactly one choice must be made',
        'Options are finite and limited (3-6 items)',
        'All options should be visible',
        'Visual comparison between choices matters',
        'Default selection makes sense contextually',
      ], CHAR_LIMIT),
      whenNotToUse: enforceCharLimit([
        'Multiple selection allowed (use checkbox)',
        'Single on/off toggle (use toggle)',
        'More than 5-6 options (use select dropdown)',
        'Options need complex descriptions',
        'Hierarchical selection patterns',
        'Dependent or conditional options',
      ], CHAR_LIMIT),
      dos: enforceCharLimit([
        'Organize in logical, scannable groups',
        'Make default selection clear and obvious',
        'Use descriptive labels for each option',
        'Ensure sufficient spacing for touch targets',
        'Test with assistive technology',
      ], CHAR_LIMIT),
      donts: enforceCharLimit([
        'Mix radiobuttons with checkboxes',
        'Hide option labels or make tiny',
        'Pre-select option without user awareness',
        'Create confusing default selections',
        'Use for boolean yes/no (use toggle)',
      ], CHAR_LIMIT),
    };
  }

  // Modal/Dialog guidelines
  if (lower.includes('modal') || lower.includes('dialog')) {
    return {
      whenToUse: enforceCharLimit([
        'Focused user attention required',
        'Critical confirmations before action',
        'Important decision points in workflow',
        'Interrupting user for essential information',
        'Complex forms requiring isolation',
        'Warning about destructive operations',
      ], CHAR_LIMIT),
      whenNotToUse: enforceCharLimit([
        'Non-critical information display',
        'Heavy content beyond scrollable viewport',
        'Linear workflow steps (use wizard)',
        'Frequently needed content (use page)',
        'Secondary navigation or filters',
        'Simple notifications (use toast)',
      ], CHAR_LIMIT),
      dos: enforceCharLimit([
        'Provide clear escape mechanism',
        'Trap focus appropriately within modal',
        'Use descriptive titles and instructions',
        'Keep content focused and concise',
        'Test keyboard navigation thoroughly',
      ], CHAR_LIMIT),
      donts: enforceCharLimit([
        'Stack multiple modals simultaneously',
        'Auto-dismiss critical confirmation dialogs',
        'Remove close button or escape option',
        'Use for advertising or promotions',
        'Overflow content beyond viewport without scroll',
      ], CHAR_LIMIT),
    };
  }

  // Card guidelines
  if (lower.includes('card') || lower.includes('tile')) {
    return {
      whenToUse: enforceCharLimit([
        'Grouping related content into sections',
        'Repeating content items in lists or grids',
        'Summarizing information at a glance',
        'Creating interactive content containers',
        'Establishing visual hierarchy and organization',
        'Enabling card-specific actions on content',
      ], CHAR_LIMIT),
      whenNotToUse: enforceCharLimit([
        'Defining page structure (use layout)',
        'Purely decorative purposes',
        'Single non-grouped content item',
        'Content requiring full-width display',
        'Large data tables or complex layouts',
        'Page-level separation needs (use sections)',
      ], CHAR_LIMIT),
      dos: enforceCharLimit([
        'Maintain consistent spacing and sizing',
        'Use for easily scannable content',
        'Provide clear action targets on cards',
        'Ensure accessible focus states',
        'Test card layouts at different screen sizes',
      ], CHAR_LIMIT),
      donts: enforceCharLimit([
        'Nest cards deeply or recursively',
        'Override card styling inconsistently',
        'Create one-off card designs per use case',
        'Make cards wider than readability allows',
        'Hide important information on hover alone',
      ], CHAR_LIMIT),
    };
  }

  // Menu Item guidelines
  if (lower.includes('menu') && lower.includes('item')) {
    return {
      whenToUse: enforceCharLimit([
        'Navigation menus and dropdown lists',
        'Action menus with multiple options',
        'Context menus for user interactions',
        'Organizing related navigation items',
        'Providing shortcuts to common tasks',
        'Creating accessible menu hierarchies',
      ], CHAR_LIMIT),
      whenNotToUse: enforceCharLimit([
        'Standalone button actions (use button)',
        'Primary page navigation (use nav)',
        'Single option selections (use button)',
        'Complex hierarchies beyond 3 levels',
        'When all options should be visible',
        'Mobile-optimized interfaces',
      ], CHAR_LIMIT),
      dos: enforceCharLimit([
        'Keep labels concise and action-oriented',
        'Provide clear hover and active states',
        'Ensure keyboard navigation support',
        'Test with screen readers for accessibility',
        'Group related items logically',
        'Include icons for visual recognition',
      ], CHAR_LIMIT),
      donts: enforceCharLimit([
        'Disable menu items without clear reason',
        'Create deeply nested menu structures',
        'Hide menu items without explanation',
        'Use generic labels like "More" or "Options"',
        'Override menu styling inconsistently',
        'Include both icons and badges excessively',
      ], CHAR_LIMIT),
    };
  }

  // Default fallback with expanded guidelines
  return {
    whenToUse: enforceCharLimit([
      'Follow design system specifications for this component',
      'Maintain visual and functional consistency across product',
      'Implement in accordance with established patterns',
      'Apply component in its intended use case context',
      'Test component across different screen sizes',
      'Ensure accessibility compliance with WCAG 2.1 standards',
    ], CHAR_LIMIT),
    whenNotToUse: enforceCharLimit([
      'Do not force component into unintended contexts',
      'Do not override component properties unnecessarily',
      'Avoid creating one-off design variations',
      'Do not sacrifice accessibility for visual design',
      'Avoid using component in ways contradicting documentation',
      'Do not detach instances to make local modifications',
    ], CHAR_LIMIT),
    dos: enforceCharLimit([
      'Follow design system conventions consistently',
      'Document custom usage patterns if required',
      'Test for accessibility and responsiveness',
      'Collaborate with design system maintainers',
    ], CHAR_LIMIT),
    donts: enforceCharLimit([
      'Deviate from established patterns',
      'Create duplicate components for similar use cases',
      'Ignore component constraints and limitations',
      'Mix styles and behaviors inconsistently',
    ], CHAR_LIMIT),
  };
}

// Extract layout and design properties from Figma component
function extractLayoutProperties(component: any): any {
  const layout: any = {};

  // Auto Layout properties
  if (component.layoutMode && component.layoutMode !== 'NONE') {
    layout.autoLayout = {
      enabled: true,
      direction: component.layoutMode, // HORIZONTAL or VERTICAL
      spacing: component.itemSpacing ?? 0,
      padding: {
        top: component.paddingTop ?? 0,
        right: component.paddingRight ?? 0,
        bottom: component.paddingBottom ?? 0,
        left: component.paddingLeft ?? 0,
      },
      alignment: component.primaryAxisAlignItems || 'AUTO',
      justifyContent: component.primaryAxisSizingMode || 'AUTO',
    };
  }

  // Size constraints
  if (component.constraints) {
    layout.constraints = {
      horizontal: component.constraints.horizontal || 'STRETCH',
      vertical: component.constraints.vertical || 'STRETCH',
    };
  }

  // Dimensions
  if (component.width || component.height) {
    layout.dimensions = {
      width: component.width,
      height: component.height,
    };
  }

  // Fill colors
  if (component.fills && Array.isArray(component.fills) && component.fills.length > 0) {
    layout.fills = component.fills.map((fill: any) => {
      if (fill.type === 'SOLID' && fill.color) {
        const { r, g, b, a } = fill.color;
        const hex = `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`;
        return {
          type: 'solid',
          color: hex,
          opacity: a !== undefined ? Math.round(a * 100) : 100,
        };
      }
      return null;
    }).filter(Boolean);
  }

  // Strokes
  if (component.strokes && Array.isArray(component.strokes) && component.strokes.length > 0) {
    layout.strokes = component.strokes.map((stroke: any) => {
      if (stroke.type === 'SOLID' && stroke.color) {
        const { r, g, b, a } = stroke.color;
        const hex = `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`;
        return {
          type: 'solid',
          color: hex,
          width: stroke.strokeWeight || 1,
          opacity: a !== undefined ? Math.round(a * 100) : 100,
          align: stroke.strokeAlign || 'CENTER',
        };
      }
      return null;
    }).filter(Boolean);
  }

  // Corner radius
  if (component.cornerRadius) {
    layout.borderRadius = component.cornerRadius;
  }

  // Individual corner radius
  if (component.topLeftRadius || component.topRightRadius || component.bottomLeftRadius || component.bottomRightRadius) {
    layout.individualRadius = {
      topLeft: component.topLeftRadius || 0,
      topRight: component.topRightRadius || 0,
      bottomLeft: component.bottomLeftRadius || 0,
      bottomRight: component.bottomRightRadius || 0,
    };
  }

  // Effects (shadow, blur)
  if (component.effects && Array.isArray(component.effects) && component.effects.length > 0) {
    layout.effects = component.effects.map((effect: any) => ({
      type: effect.type,
      visible: effect.visible !== false,
      blurRadius: effect.radius,
      offsetX: effect.offset?.x,
      offsetY: effect.offset?.y,
      color: effect.color?.toString(),
    })).filter((e: any) => e.visible);
  }

  // Opacity
  if (component.opacity !== undefined && component.opacity < 1) {
    layout.opacity = Math.round(component.opacity * 100);
  }

  // Blend mode
  if (component.blendMode && component.blendMode !== 'PASS_THROUGH') {
    layout.blendMode = component.blendMode;
  }

  return layout;
}

// Collect assumptions made during extraction
function collectAssumptions(
  component: any,
  variants: any[],
  context: ExtractionContext
): AssumptionNote[] {
  const assumptions: AssumptionNote[] = [];

  if (variants.length === 0) {
    assumptions.push({
      category: 'Variants',
      description: 'No variants detected; component treated as single instance',
    });
  }

  const hasTokenBindings = component.boundVariables && Object.keys(component.boundVariables).length > 0;
  if (!hasTokenBindings) {
    assumptions.push({
      category: 'Tokens',
      description: 'No Figma variables bound; token values inferred from naming conventions',
    });
  }

  if (!component.description || component.description.trim() === '') {
    assumptions.push({
      category: 'Description',
      description: 'Component description not provided; using generated default',
    });
  }

  return assumptions;
}

export function extractComponentDocumentation(
  component: any,
  variants: any[],
  context: ExtractionContext,
  isComponentSet: boolean = false
): ComponentDocumentation {
  const description = component.description?.trim() || 'Figma component for application UI.';

  // For component sets, extract layout properties from first variant instead of wrapper
  const layoutPropertiesSource = isComponentSet && variants.length > 0 ? variants[0] : component;

  // Extract anatomy: for component sets, use first variant's children; for components, use component.children
  const anatomySource = isComponentSet && variants.length > 0
    ? (variants[0].children || [])
    : (component.children || []);
  const anatomy = extractAnatomy(anatomySource, false);
  const states = inferStates(variants, component.name);

  // Generate all variant combinations from groups
  const variantGroups = extractVariantGroups(component.componentPropertyDefinitions || {});
  const variantCombinations = generateVariantCombinations(variantGroups);

  // Get pageName from component or from context's componentIdToPageName map
  const pageName = component.pageName || context.componentIdToPageName?.[component.id];

  return {
    name: component.name,
    description,
    pageName,
    anatomy,
    variantGroups,
    variantCombinations,
    states,
    properties: inferProperties(variants),
    tokenBindings: extractTokenBindings(component, context),
    layoutProperties: extractLayoutProperties(layoutPropertiesSource),
    accessibility: extractAccessibilityInfo(component, component.name, states, anatomy),
    usage: buildDynamicUsageGuidelines(component, states),
    assumptions: collectAssumptions(component, variants, context),
  };
}

// Generate all variant combinations from variant groups
function generateVariantCombinations(groups: VariantGroup[]): string[] {
  if (groups.length === 0) return [];

  const combinations: string[] = [];

  function generateCombos(index: number, current: string[]): void {
    if (index === groups.length) {
      combinations.push(current.join(', '));
      return;
    }

    const group = groups[index];
    for (const value of group.values) {
      generateCombos(index + 1, [...current, `${group.name}=${value}`]);
    }
  }

  generateCombos(0, []);
  return combinations;
}
