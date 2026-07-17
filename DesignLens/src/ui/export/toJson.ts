import type { Issue, ScanResult } from "@shared/types";

const ISSUE_CHUNK_SIZE = 2000;

function indentLines(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line, i) => (i === 0 ? line : pad + line))
    .join("\n");
}

// A file with tens of thousands of issues makes JSON.stringify(result) block
// the UI thread for long enough that Figma flags the plugin as unresponsive.
// Serializing issues in chunks with a yield between them keeps the browser
// able to paint/respond while the export runs.
async function buildIssuesJson(issues: Issue[]): Promise<string> {
  if (issues.length === 0) return "[]";
  const entries: string[] = [];
  for (let i = 0; i < issues.length; i++) {
    entries.push(indentLines(JSON.stringify(issues[i], null, 2), 2));
    if (i % ISSUE_CHUNK_SIZE === ISSUE_CHUNK_SIZE - 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  return `[\n  ${entries.join(",\n  ")}\n]`;
}

export async function buildJsonReport(result: ScanResult): Promise<string> {
  const issuesJson = await buildIssuesJson(result.issues);
  const fields: Array<[string, string]> = [
    ["scannedAt", JSON.stringify(result.scannedAt)],
    ["fileName", JSON.stringify(result.fileName)],
    ["stats", indentLines(JSON.stringify(result.stats, null, 2), 2)],
    ["tokenStats", indentLines(JSON.stringify(result.tokenStats, null, 2), 2)],
    ["health", indentLines(JSON.stringify(result.health, null, 2), 2)],
    ["issues", indentLines(issuesJson, 2)],
    ["components", indentLines(JSON.stringify(result.components, null, 2), 2)],
    ["variables", indentLines(JSON.stringify(result.variables, null, 2), 2)]
  ];
  const body = fields.map(([key, value]) => `  "${key}": ${value}`).join(",\n");
  return `{\n${body}\n}`;
}
