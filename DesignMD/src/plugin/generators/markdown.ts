/** Small collection of Markdown-building helpers shared by design.md and component docs. */

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export function mdTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '_None_\n';
  const headerRow = `| ${headers.map(escapeCell).join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;
  const bodyRows = rows.map(
    (row) => `| ${row.map((cell) => escapeCell(String(cell))).join(' | ')} |`,
  );
  return [headerRow, divider, ...bodyRows].join('\n') + '\n';
}

export function mdHeading(level: number, text: string): string {
  return `${'#'.repeat(level)} ${text}\n`;
}

export function mdList(items: string[]): string {
  if (items.length === 0) return '_None_\n';
  return items.map((item) => `- ${item}`).join('\n') + '\n';
}

export function mdCodeBlock(content: string, lang = ''): string {
  return `\`\`\`${lang}\n${content}\n\`\`\`\n`;
}

export function joinSections(sections: string[]): string {
  return sections.filter(Boolean).join('\n');
}
