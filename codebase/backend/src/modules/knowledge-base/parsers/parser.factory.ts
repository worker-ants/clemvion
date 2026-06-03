import type { ChunkMetadata } from '../chunking/text-chunker';
import { parseTxt } from './txt.parser';
import { parseMd, parseMdSegments } from './md.parser';
import { parsePdf, parsePdfSegments } from './pdf.parser';
import { parseCsv } from './csv.parser';

/**
 * A parsed document slice that carries source-location metadata
 * (`page` for PDF, `section` for markdown). The chunker copies `metadata`
 * onto every chunk derived from this segment
 * (spec/5-system/8-embedding-pipeline.md §6.1).
 */
export interface ParsedSegment {
  text: string;
  metadata: ChunkMetadata;
}

export async function parseDocument(
  buffer: Buffer,
  fileType: string,
): Promise<string> {
  switch (fileType) {
    case 'txt':
      return parseTxt(buffer);
    case 'md':
      return parseMd(buffer);
    case 'pdf':
      return parsePdf(buffer);
    case 'csv':
      return parseCsv(buffer);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

/**
 * Parse a document into metadata-carrying segments. Markdown is split by
 * heading (`section`), PDF by page (`page`); txt yields a single section-less
 * segment. CSV is excluded — it uses the dedicated row-aware `chunkCsv` path
 * and carries no page/section metadata.
 */
export async function parseDocumentSegments(
  buffer: Buffer,
  fileType: string,
): Promise<ParsedSegment[]> {
  switch (fileType) {
    case 'txt':
      return [{ text: parseTxt(buffer), metadata: {} }];
    case 'md':
      return parseMdSegments(buffer);
    case 'pdf':
      return parsePdfSegments(buffer);
    default:
      throw new Error(`Unsupported file type for segment parsing: ${fileType}`);
  }
}
