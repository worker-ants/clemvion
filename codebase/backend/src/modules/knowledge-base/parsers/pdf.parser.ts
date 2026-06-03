import type { ParsedSegment } from './parser.factory';

interface PdfTextItem {
  str: string;
  transform?: number[];
}
interface PdfPageData {
  getTextContent: () => Promise<{ items: PdfTextItem[] }>;
}
type PdfParseOptions = {
  pagerender?: (pageData: PdfPageData) => Promise<string>;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (
  buffer: Buffer,
  options?: PdfParseOptions,
) => Promise<{ text: string; numpages: number }>;

/**
 * Render a single PDF page's text content, inserting a newline whenever the
 * vertical position (transform[5]) changes — mirrors pdf-parse's default
 * `render_page` so per-page text quality matches the flat `parsePdf` path.
 */
function renderPageText(items: PdfTextItem[]): string {
  let lastY: number | undefined;
  let text = '';
  for (const item of items) {
    const y = item.transform?.[5];
    if (lastY !== undefined && y !== undefined && y !== lastY) {
      text += '\n';
    }
    text += item.str;
    lastY = y;
  }
  return text;
}

export async function parsePdf(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  return result.text;
}

/**
 * Parse a PDF into per-page segments so each segment carries its 1-based
 * `page` number (spec/5-system/8-embedding-pipeline.md §6.1). pdf-parse invokes
 * `pagerender` once per page; we capture each page's text via the closure while
 * still letting pdf-parse concatenate the same text into its flat result.
 */
export async function parsePdfSegments(
  buffer: Buffer,
): Promise<ParsedSegment[]> {
  const pages: string[] = [];
  await pdfParse(buffer, {
    pagerender: async (pageData: PdfPageData) => {
      const content = await pageData.getTextContent();
      const text = renderPageText(content.items);
      pages.push(text);
      return text;
    },
  });
  return pages.map((text, i) => ({ text, metadata: { page: i + 1 } }));
}
