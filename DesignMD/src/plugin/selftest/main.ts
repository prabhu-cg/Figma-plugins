import { runSelectionSelfTest } from './checks';

async function main() {
  const checks = await runSelectionSelfTest();
  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) {
    console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  }
  figma.closePlugin(
    failed.length === 0
      ? `DesignMD self-test: all ${checks.length} checks passed`
      : `DesignMD self-test: ${failed.length} of ${checks.length} FAILED — open the console (Plugins › Development › Open console)`,
  );
}

void main();
