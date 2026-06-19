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

type PdfParseFn = (
  buffer: Buffer,
  options?: PdfParseOptions,
) => Promise<{ text: string; numpages: number }>;

let cachedPdfParse: PdfParseFn | undefined;

/**
 * Lazily `require('pdf-parse')` on first parse instead of at module import.
 *
 * pdf-parse pulls in pdfjs-dist, which `dlopen`s the native `@napi-rs/canvas`
 * addon. That addon registers a process-lifetime `CustomGC` libuv handle the
 * instant it loads, which keeps Jest's event loop alive past teardown (the
 * leak `forceExit` was masking) and has even SIGSEGV'd on import in some test
 * environments — which is why several parser specs `jest.mock('pdf-parse')`.
 * Deferring the require keeps the addon out of every test (and every process)
 * that imports the parser graph but never actually parses a PDF, so the suite
 * exits cleanly without `forceExit`. The result is memoised; production behaviour
 * is unchanged beyond moving the one-time load from boot to first PDF parse.
 */
function getPdfParse(): PdfParseFn {
  if (!cachedPdfParse) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedPdfParse = require('pdf-parse') as PdfParseFn;
  }
  return cachedPdfParse;
}

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
  const result = await getPdfParse()(buffer);
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
  await getPdfParse()(buffer, {
    pagerender: async (pageData: PdfPageData) => {
      const content = await pageData.getTextContent();
      const text = renderPageText(content.items);
      pages.push(text);
      return text;
    },
  });
  // Map first to keep the 1-based page number stable, then drop blank pages
  // (scanned/image-only PDFs) so they don't produce empty segments.
  return pages
    .map((text, i) => ({ text, metadata: { page: i + 1 } }))
    .filter((segment) => segment.text.trim().length > 0);
}
