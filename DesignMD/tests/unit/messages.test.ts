import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPORT_OPTIONS } from '../../src/shared/messages';

describe('DEFAULT_EXPORT_OPTIONS', () => {
  it('checks design.md, component docs, and zip by default', () => {
    expect(DEFAULT_EXPORT_OPTIONS.designMd).toBe(true);
    expect(DEFAULT_EXPORT_OPTIONS.componentDocs).toBe(true);
    expect(DEFAULT_EXPORT_OPTIONS.zip).toBe(true);
  });

  it('leaves tokens.json and css-tokens.json unchecked by default', () => {
    expect(DEFAULT_EXPORT_OPTIONS.tokensJson).toBe(false);
    expect(DEFAULT_EXPORT_OPTIONS.cssTokensJson).toBe(false);
  });
});
