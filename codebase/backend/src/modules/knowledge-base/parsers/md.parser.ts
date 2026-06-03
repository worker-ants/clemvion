import type { ParsedSegment } from './parser.factory';

export function parseMd(buffer: Buffer): string {
  return buffer.toString('utf-8');
}

/**
 * Split a markdown document into segments by heading so each segment carries
 * its `section` (the nearest preceding `#`…`######` heading text). The heading
 * line itself is kept in its section body (it is useful for embedding recall).
 * Content before the first heading becomes a section-less segment
 * (spec/5-system/8-embedding-pipeline.md §6.1).
 */
export function parseMdSegments(buffer: Buffer): ParsedSegment[] {
  const text = buffer.toString('utf-8');
  const lines = text.split('\n');
  const segments: ParsedSegment[] = [];
  let currentSection: string | undefined;
  let buf: string[] = [];

  const flush = (): void => {
    const body = buf.join('\n').trim();
    if (body) {
      segments.push({
        text: body,
        metadata: currentSection ? { section: currentSection } : {},
      });
    }
    buf = [];
  };

  for (const line of lines) {
    // ATX heading: 1–6 `#` + space + title (trailing `#` decoration trimmed).
    const heading = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      flush();
      currentSection = heading[1].trim();
    }
    buf.push(line);
  }
  flush();

  return segments.length > 0
    ? segments
    : [{ text: text.trim(), metadata: {} }];
}
