import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXPORT_OPTIONS,
  EMPTY_FILE_SETTINGS,
  sanitizeFileSettings,
  sanitizeSavedSettings,
} from '../../src/shared/messages';

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

describe('sanitizeSavedSettings', () => {
  it('returns null for anything that is not a settings object', () => {
    expect(sanitizeSavedSettings(undefined)).toBeNull();
    expect(sanitizeSavedSettings('x')).toBeNull();
    expect(sanitizeSavedSettings({})).toBeNull();
    expect(sanitizeSavedSettings({ options: 3 })).toBeNull();
  });

  it('keeps valid booleans and falls back to defaults for missing or invalid keys', () => {
    const result = sanitizeSavedSettings({
      options: { designMd: false, tokensJson: true, zip: 'yes', unknown: true },
    });
    expect(result?.options).toEqual({
      ...DEFAULT_EXPORT_OPTIONS,
      designMd: false,
      tokensJson: true,
    });
    expect(result?.options).not.toHaveProperty('unknown');
  });
});

describe('sanitizeFileSettings', () => {
  it('falls back to empty settings for anything malformed', () => {
    expect(sanitizeFileSettings(undefined)).toEqual(EMPTY_FILE_SETTINGS);
    expect(sanitizeFileSettings('x')).toEqual(EMPTY_FILE_SETTINGS);
    expect(sanitizeFileSettings({ excludedPages: 3, contrastPairs: 'no' })).toEqual(
      EMPTY_FILE_SETTINGS,
    );
  });

  it('keeps well-formed entries and drops the rest', () => {
    expect(
      sanitizeFileSettings({
        excludedPages: ['Drafts', 7, null, 'Playground'],
        contrastPairs: [
          { foreground: 'Text', background: 'Surface' },
          { foreground: 'Text' },
          null,
          { foreground: 1, background: 2 },
        ],
      }),
    ).toEqual({
      excludedPages: ['Drafts', 'Playground'],
      contrastPairs: [{ foreground: 'Text', background: 'Surface' }],
    });
  });
});
