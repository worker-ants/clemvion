import { parseTxt } from './txt.parser';
import { parseMd } from './md.parser';
import { parsePdf } from './pdf.parser';
import { parseCsv } from './csv.parser';

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
