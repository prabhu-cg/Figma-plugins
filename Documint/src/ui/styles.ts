import type { ProgressStep } from '@/types/messages';

// Figma native design palette
export const colors = {
  bg: '#ffffff',
  surface: '#fafafa',
  border: '#eeeeee',
  borderHover: '#EE661D',
  accent: '#18a0fb',
  accentHover: '#0d8ee8',
  textPrimary: '#1e1e1e',
  textSecondary: '#666666',
  textTertiary: '#999999',
  error: '#f24822',
  warning: '#ffa800',
  success: '#1bc47d',
  info: '#18a0fb',
  disabled: '#cccccc',
  hoverBg: '#FFF9EB',
  hoverBorder: '#EE661D',
  badgeBg: '#FFF9EB',
  badgeBorder: '#EE661D',
  badgeText: '#EE661D',
};

export const STEP_LABELS: Record<ProgressStep, string> = {
  EXTRACTING_STYLES: 'Extracting styles…',
  EXTRACTING_VARIABLES: 'Extracting variables…',
  EXTRACTING_COMPONENTS: 'Extracting components…',
  BUILDING_SCHEMA: 'Building schema…',
  RENDERING_FIGMA_PAGE: 'Rendering Figma page…',
  EXPORTING_FILES: 'Exporting files…',
};

export const baseFont = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: 12,
};

export const containerStyle = {
  width: '100%',
  height: '100%',
  display: 'flex' as const,
  flexDirection: 'column' as const,
  background: '#FAFAFA',
  color: colors.textPrimary,
  ...baseFont,
  boxSizing: 'border-box' as const,
  overflow: 'hidden' as const,
};

export const headerStyle = {
  padding: '16px',
  display: 'flex' as const,
  justifyContent: 'space-between' as const,
  alignItems: 'flex-start' as const,
  gap: 12,
  borderBottom: `1px solid ${colors.border}`,
  flexShrink: 0,
  background: colors.bg,
};

export const headerTitleStyle = {
  fontSize: 17,
  color: colors.textPrimary,
  fontWeight: 700,
  letterSpacing: 0,
};

export const headerIntroStyle = {
  fontSize: 12,
  color: colors.textSecondary,
  fontWeight: 400,
  marginTop: 4,
  lineHeight: 1.4,
};

export const chooseOptionLabelStyle = {
  fontSize: 14,
  color: colors.textPrimary,
  fontWeight: 600,
  marginBottom: 8,
};

export const chooseOptionDescStyle = {
  fontSize: 12,
  color: colors.textSecondary,
  marginBottom: 12,
};

export const selectedBadgeStyle = {
  display: 'inline-flex' as const,
  alignItems: 'center' as const,
  gap: 6,
  padding: '6px 10px',
  borderRadius: 4,
  border: `1px solid ${colors.badgeBorder}`,
  background: colors.badgeBg,
  fontSize: 11,
  fontWeight: 500,
  color: colors.badgeText,
};

export const badgeStyle = {
  padding: '6px 10px',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 500,
  background: colors.badgeBg,
  color: colors.badgeText,
  border: `1px solid ${colors.badgeBorder}`,
  whiteSpace: 'nowrap' as const,
};

export const badgeDisabledStyle = {
  ...badgeStyle,
  background: colors.border,
  color: colors.textTertiary,
  borderColor: colors.border,
};

export const screenStyle = {
  flex: 1,
  display: 'flex' as const,
  flexDirection: 'column' as const,
  overflow: 'auto' as const,
  padding: 16,
  gap: 12,
  background: '#FAFAFA',
};

export const buttonStyle = {
  padding: '10px 16px',
  borderRadius: 6,
  border: 'none',
  background: '#EE661D',
  color: '#ffffff',
  ...baseFont,
  fontWeight: 500,
  fontSize: 13,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

export const buttonHoverStyle = {
  ...buttonStyle,
  background: '#D65010',
  color: '#ffffff',
};

export const buttonDisabledStyle = {
  ...buttonStyle,
  background: colors.border,
  color: colors.textTertiary,
  cursor: 'not-allowed',
};

export const ghostButtonStyle = {
  padding: '10px 16px',
  borderRadius: 6,
  border: `1px solid ${colors.border}`,
  background: colors.bg,
  color: colors.textPrimary,
  ...baseFont,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

export const sectionLabelStyle = {
  fontSize: 11,
  color: colors.textSecondary,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
  marginTop: 0,
  marginBottom: 4,
};

export const exportCardStyle = {
  padding: 14,
  borderRadius: 8,
  border: `2px solid ${colors.border}`,
  background: colors.bg,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  display: 'flex' as const,
  gap: 12,
  alignItems: 'flex-start' as const,
};

export const exportCardHoverStyle = {
  border: `2px solid ${colors.borderHover}`,
  background: colors.hoverBg,
};

export const checkboxInputStyle = {
  accentColor: colors.accent,
  flexShrink: 0,
  marginTop: 2,
  cursor: 'pointer',
};

export const exportCardContentStyle = {
  flex: 1,
  display: 'flex' as const,
  flexDirection: 'column' as const,
  gap: 4,
};

export const exportCardTitleStyle = {
  fontSize: 12,
  fontWeight: 500,
  color: colors.textPrimary,
};

export const exportCardDescriptionStyle = {
  fontSize: 11,
  color: colors.textSecondary,
  lineHeight: 1.4,
};

export const progressBarContainerStyle = {
  width: '100%',
  height: 8,
  background: colors.border,
  borderRadius: 4,
  overflow: 'hidden' as const,
};

export const progressBarFillStyle = (percent: number) => ({
  width: `${percent}%`,
  height: '100%',
  background: colors.accent,
  transition: 'width 0.4s ease',
});

export const progressTextStyle = {
  fontSize: 11,
  color: colors.textSecondary,
  textAlign: 'right' as const,
  marginTop: 4,
};

export const stepLabelStyle = {
  fontSize: 13,
  color: colors.textPrimary,
  textAlign: 'center' as const,
  fontWeight: 500,
  marginBottom: 12,
};

export const tabBarStyle = {
  display: 'flex' as const,
  borderBottom: `1px solid ${colors.border}`,
  gap: 0,
  flexShrink: 0,
  background: colors.bg,
};

export const tabButtonStyle = {
  flex: 1,
  padding: '12px 16px',
  background: 'transparent',
  border: 'none',
  color: colors.textSecondary,
  ...baseFont,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  borderBottom: `2px solid transparent`,
  transition: 'all 0.2s ease',
};

export const tabButtonActiveStyle = {
  ...tabButtonStyle,
  color: colors.accent,
  borderBottomColor: colors.accent,
};

export const tabContentStyle = {
  flex: 1,
  overflowY: 'auto' as const,
  padding: '16px',
  background: colors.surface,
};

export const statGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: 12,
};

export const statCellStyle = {
  padding: 12,
  background: colors.bg,
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  textAlign: 'center' as const,
};

export const statLabelStyle = {
  fontSize: 11,
  color: colors.textSecondary,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
  marginBottom: 4,
  fontWeight: 500,
};

export const statValueStyle = {
  fontSize: 24,
  fontWeight: 700,
  color: colors.accent,
};

export const warningRowStyle = {
  display: 'flex' as const,
  gap: 8,
  padding: '10px 0',
  borderBottom: `1px solid ${colors.border}`,
  fontSize: 11,
};

export const warningIconStyle = {
  flexShrink: 0,
  width: 6,
  height: 6,
  borderRadius: '50%',
  marginTop: 3,
};

export const warningContentStyle = {
  flex: 1,
  display: 'flex' as const,
  flexDirection: 'column' as const,
  gap: 2,
};

export const warningMessageStyle = {
  color: colors.textPrimary,
  lineHeight: 1.4,
};

export const warningSuggestionStyle = {
  color: colors.textSecondary,
  fontSize: 10,
  lineHeight: 1.3,
  fontStyle: 'italic' as const,
};

export const scoreRingStyle = {
  width: 100,
  height: 100,
  borderRadius: '50%',
  display: 'flex' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  margin: '16px auto',
  border: '3px solid',
  background: colors.bg,
};

export const scoreValueStyle = {
  fontSize: 28,
  fontWeight: 700,
  color: colors.textPrimary,
};

export const subScoreRowStyle = {
  padding: '8px 0',
};

export const subScoreLabelStyle = {
  fontSize: 11,
  color: colors.textSecondary,
  marginBottom: 4,
};

export const subScoreBarStyle = {
  height: 4,
  background: colors.surface,
  borderRadius: 2,
  overflow: 'hidden' as const,
};

export const subScoreBarFillStyle = (percent: number) => ({
  width: `${percent}%`,
  height: '100%',
  background: colors.accent,
});

export const exportRowStyle = {
  display: 'flex' as const,
  justifyContent: 'space-between' as const,
  alignItems: 'center' as const,
  padding: '12px',
  background: colors.bg,
  borderRadius: 6,
  border: `1px solid ${colors.border}`,
  marginBottom: 8,
};
export const exportRowLastStyle = {
  ...exportRowStyle,
  marginBottom: 0,
};

export const exportLabelStyle = {
  fontSize: 12,
  color: colors.textPrimary,
  fontWeight: 500,
};

export const centerColumnStyle = {
  display: 'flex' as const,
  flexDirection: 'column' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  flex: 1,
  gap: 16,
};

export const errorCircleStyle = {
  width: 56,
  height: 56,
  borderRadius: '50%',
  background: `${colors.error}15`,
  border: `2px solid ${colors.error}`,
  display: 'flex' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  fontSize: 28,
  color: colors.error,
};

export const errorMessageStyle = {
  fontSize: 12,
  color: colors.textPrimary,
  textAlign: 'center' as const,
  maxWidth: 280,
  lineHeight: 1.4,
};
