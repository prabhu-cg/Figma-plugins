import { inferColorRole } from '@/plugin/inference/color-roles';

describe('inferColorRole', () => {
  it.each([
    ['color/primary/500', 'primary'],
    ['brand-blue', 'primary'],
    ['color/secondary/300', 'secondary'],
    ['accent-purple', 'secondary'],
    ['color/success/400', 'success'],
    ['green-500', 'success'],
    ['color/warning/300', 'warning'],
    ['caution-yellow', 'warning'],
    ['color/error/500', 'error'],
    ['red-600', 'error'],
    ['danger-red', 'error'],
    ['destructive', 'error'],
    ['color/neutral/200', 'neutral'],
    ['gray-100', 'neutral'],
    ['grey-200', 'neutral'],
    ['slate-300', 'neutral'],
    ['color/surface/default', 'surface'],
    ['background/primary', 'surface'],
    ['bg-white', 'surface'],
    ['canvas', 'surface'],
    ['color/on-surface/primary', 'on-surface'],
    ['foreground/text', 'on-surface'],
    ['fg-default', 'on-surface'],
    ['random-token-xyz-123', 'unknown'],
  ] as [string, string][])(
    '"%s" → role "%s"',
    (tokenName, expectedRole) => {
      expect(inferColorRole(tokenName)).toBe(expectedRole);
    }
  );
});
