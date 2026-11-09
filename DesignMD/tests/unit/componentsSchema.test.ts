/* eslint-disable @typescript-eslint/no-explicit-any -- walking untyped JSON Schema */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs script without types
import { buildSchema } from '../../scripts/build-schema.mjs';
import { findBrokenRefs } from '../../src/shared/componentsRefs';
import { COMPONENTS_SCHEMA_ID, COMPONENTS_SCHEMA_URL } from '../../src/shared/componentsSchema';

const root = path.resolve(__dirname, '../..');
const schemaPath = path.join(root, 'schemas/designmd-components-v1.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ strict: false, allErrors: true });
const validate = ajv.compile(schema);

function loadExample(name: string) {
  return JSON.parse(readFileSync(path.join(root, 'examples', name), 'utf8'));
}

describe('designmd.components/v1 schema', () => {
  it('is up to date with src/shared/componentsSchema.ts', () => {
    expect(readFileSync(schemaPath, 'utf8')).toBe(buildSchema());
  });

  it('is identified by the published URL and format id', () => {
    expect(schema.$id).toBe(COMPONENTS_SCHEMA_URL);
    expect(schema.definitions.ComponentsFileV1.properties.schema.const).toBe(COMPONENTS_SCHEMA_ID);
  });

  it('describes every property', () => {
    const missing: string[] = [];
    for (const [defName, def] of Object.entries<any>(schema.definitions)) {
      for (const [prop, value] of Object.entries<any>(def.properties ?? {})) {
        if (!value.description) missing.push(`${defName}.${prop}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('forbids unknown properties on every object type it defines', () => {
    const open: string[] = [];
    for (const [defName, def] of Object.entries<any>(schema.definitions)) {
      if (def.properties && def.additionalProperties !== false) open.push(defName);
    }
    expect(open).toEqual([]);
  });

  it.each(readdirSync(path.join(root, 'examples')).filter((f) => f.endsWith('.json')))(
    'validates examples/%s',
    (file) => {
      const ok = validate(loadExample(file));
      expect(validate.errors ?? []).toEqual([]);
      expect(ok).toBe(true);
    },
  );

  it('rejects a file with the wrong schema id', () => {
    const bad = loadExample('components.example.json');
    bad.schema = 'designmd.components/v2';
    expect(validate(bad)).toBe(false);
  });

  it('rejects a string length such as "16px" where a number is required', () => {
    const bad = loadExample('components.example.json');
    bad.components[0].tree.layout.gap = '8px';
    expect(validate(bad)).toBe(false);
  });

  it('rejects an unknown role and an unknown field', () => {
    const badRole = loadExample('components.example.json');
    badRole.components[0].tree.role = 'banner';
    expect(validate(badRole)).toBe(false);
    const extra = loadExample('components.example.json');
    extra.components[0].tree.mystery = 1;
    expect(validate(extra)).toBe(false);
  });
});

describe('example files', () => {
  it('have no broken references (rule 6)', () => {
    expect(
      findBrokenRefs(loadExample('components.example.json'), { checkInstances: false }),
    ).toEqual([]);
  });

  it('are caught when a token id is missing', () => {
    const bad = loadExample('components.example.json');
    delete bad.tokens['VariableID:1:2'];
    const refs = findBrokenRefs(bad).map((r) => r.target);
    expect(refs).toContain('VariableID:1:2');
  });

  it('are caught when a propertyRef names a missing property', () => {
    const bad = loadExample('components.example.json');
    bad.components[0].tree.children[0].propertyRefs.characters = 'nope#1:1';
    expect(findBrokenRefs(bad)).toContainEqual(
      expect.objectContaining({ kind: 'propertyKey', target: 'nope#1:1' }),
    );
  });

  it('carry a contentHash computed with generatedAt and contentHash blanked', () => {
    const text = readFileSync(path.join(root, 'examples/components.example.json'), 'utf8');
    const blank = text
      .replace(/"generatedAt": "[^"]*"/, '"generatedAt": ""')
      .replace(/"contentHash": "[^"]*"/, '"contentHash": ""');
    const expected = createHash('sha256').update(blank).digest('hex');
    expect(JSON.parse(text).metadata.contentHash).toBe(expected);
  });
});
