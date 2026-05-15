import type { ComponentState, AnatomyPart, LayoutProperties, InteractionBehavior, VariantGroup } from '../documentation-engine/types';
import { inferComponentCategory, inferAccessibilityRole, inferKeyboardInteraction } from './anatomy-mapper';

// ─── Component Intent ──────────────────────────────────────────────────────

export function inferComponentIntent(
  name: string,
  category: string,
  variantGroups: VariantGroup[],
  states: ComponentState[]
): string {
  const lower = name.toLowerCase();

  // Button-like components
  if (lower.includes('button') || lower.includes('btn')) {
    if (lower.includes('primary') || lower.includes('main')) return 'High-emphasis action trigger';
    if (lower.includes('secondary') || lower.includes('secondary')) return 'Supporting action trigger';
    if (lower.includes('destructive') || lower.includes('delete') || lower.includes('danger'))
      return 'Destructive action trigger requiring confirmation';
    return 'Action trigger';
  }

  // Checkbox/Radio/Toggle
  if (lower.includes('checkbox')) return 'Binary selection control';
  if (lower.includes('radio')) return 'Single selection from mutually exclusive options';
  if (lower.includes('toggle') || lower.includes('switch')) return 'State toggle control';

  // Input fields
  if (lower.includes('input') || lower.includes('field') || lower.includes('textfield'))
    return 'Text input control';
  if (lower.includes('textarea')) return 'Multi-line text input control';
  if (lower.includes('select') || lower.includes('dropdown')) return 'Dropdown selection control';

  // Content containers
  if (lower.includes('card') || lower.includes('tile')) return 'Content container';
  if (lower.includes('modal') || lower.includes('dialog')) return 'Modal dialog for focused interaction';
  if (lower.includes('tooltip')) return 'Contextual information on hover';
  if (lower.includes('badge') || lower.includes('chip')) return 'Small labeled indicator';

  // Navigation
  if (lower.includes('nav') || lower.includes('menu')) return 'Navigation container';
  if (lower.includes('tab')) return 'Tab navigation control';

  // Feedback
  if (lower.includes('alert') || lower.includes('notification')) return 'Alert/notification feedback';
  if (lower.includes('progress') || lower.includes('loading')) return 'Progress indicator';

  // Fallback
  return 'Intent could not be confidently inferred.';
}

// ─── Interaction Behaviors ────────────────────────────────────────────────

export function inferInteractionBehaviors(
  name: string,
  category: string,
  states: ComponentState[]
): InteractionBehavior[] {
  const behaviors: InteractionBehavior[] = [];
  const stateNames = states.map((s) => s.name.toLowerCase());

  // Check for hover state → clickable
  if (stateNames.some((s) => s.includes('hover'))) {
    behaviors.push({
      behavior: 'Clickable',
      description: 'Triggers action or navigation',
    });
  }

  // Check for selected/checked state → selectable
  if (stateNames.some((s) => s.includes('selected') || s.includes('checked'))) {
    behaviors.push({
      behavior: 'Selectable',
      description: 'Supports toggled or selected state',
    });
  }

  // Check for expanded/collapsed → expandable
  const nameLower = name.toLowerCase();
  if (nameLower.includes('expand') || nameLower.includes('accordion') || nameLower.includes('dropdown')) {
    behaviors.push({
      behavior: 'Expandable',
      description: 'Reveals or hides content',
    });
  }

  // Check for dismissible (close, dismiss patterns)
  if (nameLower.includes('dismiss') || nameLower.includes('modal') || nameLower.includes('notification')) {
    behaviors.push({
      behavior: 'Dismissible',
      description: 'Can be closed or removed',
    });
  }

  // Check for focused state → focusable
  if (stateNames.some((s) => s.includes('focus'))) {
    behaviors.push({
      behavior: 'Focusable',
      description: 'Receives keyboard focus',
    });
  }

  // Check for disabled state → disableable
  if (stateNames.some((s) => s.includes('disabled'))) {
    behaviors.push({
      behavior: 'Disableable',
      description: 'Can be disabled to prevent interaction',
    });
  }

  return behaviors;
}

// ─── Responsive Behavior ──────────────────────────────────────────────────

export function inferResponsiveBehavior(layoutProps: LayoutProperties): string[] {
  const behaviors: string[] = [];

  if (!layoutProps.autoLayout || !layoutProps.autoLayout.enabled) {
    return []; // No responsive behavior
  }

  const { direction, justifyContent } = layoutProps.autoLayout;

  // Horizontal layout
  if (direction === 'HORIZONTAL') {
    if (justifyContent === 'SPACE_BETWEEN' || justifyContent === 'STRETCH') {
      behaviors.push('Expands horizontally to fill available width');
    }
  }

  // Vertical layout
  if (direction === 'VERTICAL') {
    if (justifyContent === 'SPACE_BETWEEN' || justifyContent === 'STRETCH') {
      behaviors.push('Grows vertically with content');
    }
  }

  // Fixed sizing
  if (layoutProps.dimensions?.width && layoutProps.dimensions?.height) {
    behaviors.push('Fixed sizing — does not respond to container changes');
  }

  if (behaviors.length === 0) {
    return ['Content-driven sizing'];
  }

  return behaviors;
}

// ─── UX Rules (Governance) ────────────────────────────────────────────────

export function generateUXRules(
  name: string,
  category: string,
  states: ComponentState[],
  anatomy: AnatomyPart[]
): string[] {
  const rules: string[] = [];
  const nameLower = name.toLowerCase();
  const stateNames = states.map((s) => s.name.toLowerCase());
  const anatomyNames = anatomy.map((a) => a.name?.toLowerCase() || '');

  // Disabled state rule
  if (stateNames.some((s) => s.includes('disabled'))) {
    rules.push('Preserve visible disabled state indication');
  }

  // Icon-only without label
  if (anatomyNames.some((a) => a.includes('icon')) && !anatomyNames.some((a) => a.includes('label'))) {
    rules.push('Provide accessible label for icon-only usage');
  }

  // Button rules
  if (nameLower.includes('button') || nameLower.includes('btn')) {
    rules.push('Maintain one primary action per action group');
    rules.push('Use consistent button size within action groups');
  }

  // Destructive action rules
  if (nameLower.includes('destructive') || nameLower.includes('delete') || nameLower.includes('danger')) {
    rules.push('Require user confirmation before destructive action');
    rules.push('Ensure destructive action clearly communicates consequences');
  }

  // Focus rules
  if (stateNames.some((s) => s.includes('focus'))) {
    rules.push('Preserve visible focus indicator for keyboard navigation');
  }

  // Form field rules
  if (nameLower.includes('input') || nameLower.includes('field') || nameLower.includes('textarea')) {
    rules.push('Maintain consistent label positioning within form');
    rules.push('Provide error state with clear error messaging');
  }

  // Modal/overlay rules
  if (nameLower.includes('modal') || nameLower.includes('dialog')) {
    rules.push('Support escape key to dismiss');
    rules.push('Trap focus within modal');
  }

  // Fallback
  if (rules.length === 0) {
    rules.push('Ensure consistent appearance across states');
  }

  return rules;
}

// ─── Accessibility Observations ───────────────────────────────────────────

export function generateAccessibilityObservations(
  category: string,
  states: ComponentState[],
  layoutProps: LayoutProperties,
  anatomy: AnatomyPart[]
): string[] {
  const observations: string[] = [];
  const stateNames = states.map((s) => s.name.toLowerCase());
  const anatomyNames = anatomy.map((a) => a.name?.toLowerCase() || '');

  // Focus state detection
  if (stateNames.some((s) => s.includes('focus'))) {
    observations.push('Focus state variant detected for keyboard navigation');
  }

  // Label detection
  if (anatomyNames.some((a) => a.includes('label'))) {
    observations.push('Text label supports screen reader identification');
  }

  // Icon-only detection
  if (anatomyNames.some((a) => a.includes('icon')) && !anatomyNames.some((a) => a.includes('label'))) {
    observations.push('Icon-only usage requires accessible label at implementation');
  }

  // Color contrast note
  if (layoutProps.fills && layoutProps.fills.length > 0) {
    observations.push('Verify sufficient color contrast against background at implementation');
  }

  // Disabled state
  if (stateNames.some((s) => s.includes('disabled'))) {
    observations.push('Disabled state visually distinguishable for user awareness');
  }

  // Default state
  if (stateNames.some((s) => s.includes('default'))) {
    observations.push('Default/initial state clearly established');
  }

  // Fallback
  if (observations.length === 0) {
    observations.push('Component structure supports standard accessibility implementation');
  }

  return observations;
}

// ─── Layer Role Naming ────────────────────────────────────────────────────

export function inferSemanticLayerName(rawName: string, role?: string): string {
  const lower = rawName.toLowerCase();

  // Container/Wrapper/Frame
  if (lower.includes('container') || lower.includes('wrapper') || lower.includes('frame')) {
    if (lower.includes('content')) return 'Content Wrapper';
    if (lower.includes('action')) return 'Action Area';
    return 'Surface Layer';
  }

  // Icon
  if (lower.includes('icon')) {
    if (lower.includes('leading')) return 'Leading Icon';
    if (lower.includes('trailing') || lower.includes('suffix')) return 'Trailing Icon';
    if (lower.includes('start')) return 'Start Icon';
    if (lower.includes('end')) return 'End Icon';
    return 'Icon';
  }

  // Label/Text
  if (lower.includes('label')) {
    if (lower.includes('primary')) return 'Primary Label';
    if (lower.includes('secondary') || lower.includes('supporting')) return 'Supporting Label';
    return 'Label';
  }

  if (lower.includes('text') || lower.includes('caption')) {
    if (lower.includes('help') || lower.includes('hint')) return 'Help Text';
    return 'Text Content';
  }

  // Background/Fill
  if (lower.includes('background') || lower.includes('bg') || lower.includes('fill')) {
    return 'Background Container';
  }

  // Divider/Separator
  if (lower.includes('divider') || lower.includes('separator') || lower.includes('line')) {
    return 'Divider';
  }

  // Media/Image
  if (lower.includes('image') || lower.includes('avatar') || lower.includes('thumbnail')) {
    return 'Media Container';
  }

  // Default fallback
  return rawName;
}
