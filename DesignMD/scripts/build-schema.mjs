// Generates schemas/designmd-components-v1.json from src/shared/componentsSchema.ts.
//   node scripts/build-schema.mjs          write the file
//   node scripts/build-schema.mjs --check  fail if the committed file is out of date
import { createGenerator } from 'ts-json-schema-generator';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(root, 'schemas', 'designmd-components-v1.json');
const SCHEMA_URL =
  'https://raw.githubusercontent.com/prabhu-cg/Figma-plugins/main/DesignMD/schemas/designmd-components-v1.json';

export function buildSchema() {
  const generated = createGenerator({
    path: path.join(root, 'src/shared/componentsSchema.ts'),
    tsconfig: path.join(root, 'tsconfig.json'),
    type: 'ComponentsFileV1',
    expose: 'export',
    topRef: true,
    jsDoc: 'extended',
    additionalProperties: false,
    skipTypeCheck: false,
  }).createSchema('ComponentsFileV1');
  const schema = {
    $schema: generated.$schema,
    $id: SCHEMA_URL,
    title: 'designmd.components/v1',
    description:
      'Output of the DesignMD Figma plugin: components, their layer trees and the tokens they use. ' +
      'Producers write only the fields listed here. Consumers must ignore fields they do not know, ' +
      'because new optional fields may be added within v1.',
    ...generated,
  };
  schema.$schema = generated.$schema;
  return JSON.stringify(schema, null, 2) + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const next = buildSchema();
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(outFile, 'utf8');
    } catch {
      /* missing */
    }
    if (current !== next) {
      console.error('schemas/designmd-components-v1.json is out of date. Run: npm run schema');
      process.exit(1);
    }
    console.log('schema is up to date');
  } else {
    writeFileSync(outFile, next);
    console.log('wrote', path.relative(root, outFile));
  }
}
