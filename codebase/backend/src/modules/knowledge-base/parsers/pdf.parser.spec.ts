jest.mock('pdf-parse', () =>
  jest.fn(
    async (
      _buffer: Buffer,
      options?: {
        pagerender?: (p: {
          getTextContent: () => Promise<{
            items: Array<{ str: string; transform?: number[] }>;
          }>;
        }) => Promise<string>;
      },
    ) => {
      if (options?.pagerender) {
        const page = (items: Array<{ str: string; transform?: number[] }>) => ({
          getTextContent: async () => ({ items }),
        });
        await options.pagerender(
          page([{ str: 'page one', transform: [1, 0, 0, 1, 0, 700] }]),
        );
        await options.pagerender(
          page([{ str: 'page two', transform: [1, 0, 0, 1, 0, 700] }]),
        );
      }
      return { text: 'page one\n\npage two', numpages: 2 };
    },
  ),
);

import { parsePdfSegments } from './pdf.parser';

describe('parsePdfSegments (spec §6.1 page metadata)', () => {
  it('returns one segment per page with a 1-based page number', async () => {
    const segs = await parsePdfSegments(Buffer.from('pdf-bytes'));
    expect(segs).toEqual([
      { text: 'page one', metadata: { page: 1 } },
      { text: 'page two', metadata: { page: 2 } },
    ]);
  });

  it('inserts a newline when the vertical position changes', async () => {
    const pdfParse = jest.requireMock('pdf-parse');
    pdfParse.mockImplementationOnce(
      async (
        _buffer: Buffer,
        options?: {
          pagerender?: (p: {
            getTextContent: () => Promise<{
              items: Array<{ str: string; transform?: number[] }>;
            }>;
          }) => Promise<string>;
        },
      ) => {
        await options?.pagerender?.({
          getTextContent: async () => ({
            items: [
              { str: 'line1', transform: [1, 0, 0, 1, 0, 700] },
              { str: 'line2', transform: [1, 0, 0, 1, 0, 680] },
            ],
          }),
        });
        return { text: '', numpages: 1 };
      },
    );
    const segs = await parsePdfSegments(Buffer.from('x'));
    expect(segs[0]).toEqual({ text: 'line1\nline2', metadata: { page: 1 } });
  });
});
