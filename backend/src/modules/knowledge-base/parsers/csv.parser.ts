import { parse } from 'csv-parse/sync';

export function parseCsv(buffer: Buffer): string {
  const content = buffer.toString('utf-8');
  const records: string[][] = parse(content, {
    skip_empty_lines: true,
  });

  if (records.length === 0) return '';

  const headers = records[0];
  const rows = records.slice(1);

  return rows
    .map((row) => headers.map((h, i) => `${h}: ${row[i] ?? ''}`).join(', '))
    .join('\n');
}
