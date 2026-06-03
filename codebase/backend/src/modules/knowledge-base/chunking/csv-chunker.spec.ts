import { chunkCsv } from './csv-chunker';

describe('CsvChunker', () => {
  const makeRow = (i: number): string =>
    `name: User${i}, age: ${20 + i}, department: Engineering`;

  it('should return empty array for empty text', () => {
    expect(chunkCsv('', { chunkSize: 100, chunkOverlap: 0 })).toEqual([]);
    expect(chunkCsv('   ', { chunkSize: 100, chunkOverlap: 0 })).toEqual([]);
  });

  it('should keep all rows in one chunk when under chunk_size', () => {
    const text = [makeRow(1), makeRow(2), makeRow(3)].join('\n');
    const chunks = chunkCsv(text, { chunkSize: 1000, chunkOverlap: 0 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(text);
    expect(chunks[0].index).toBe(0);
  });

  it('should group multiple whole rows up to chunk_size across several chunks', () => {
    const rows = Array.from({ length: 20 }, (_, i) => makeRow(i));
    const text = rows.join('\n');
    // small chunk size → forces multiple chunks
    const chunks = chunkCsv(text, { chunkSize: 30, chunkOverlap: 0 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should never split a row across chunks', () => {
    const rows = Array.from({ length: 20 }, (_, i) => makeRow(i));
    const text = rows.join('\n');
    const chunks = chunkCsv(text, { chunkSize: 30, chunkOverlap: 0 });

    // Every line in every chunk must be an intact original row.
    const rowSet = new Set(rows);
    const seen: string[] = [];
    for (const chunk of chunks) {
      for (const line of chunk.content.split('\n')) {
        expect(rowSet.has(line)).toBe(true);
        seen.push(line);
      }
    }
    // No row lost or duplicated — every row appears exactly once, in order.
    expect(seen).toEqual(rows);
  });

  it('should emit an oversized row as its own single chunk (no mid-row split)', () => {
    const big = `name: ${'x'.repeat(500)}`;
    const text = [makeRow(1), big, makeRow(2)].join('\n');
    const chunks = chunkCsv(text, { chunkSize: 30, chunkOverlap: 0 });

    const bigChunk = chunks.find((c) => c.content.includes(big));
    expect(bigChunk).toBeDefined();
    // The oversized row is intact and not combined with neighbours.
    expect(bigChunk?.content).toBe(big);
  });

  it('should assign sequential chunk indices and metadata', () => {
    const rows = Array.from({ length: 10 }, (_, i) => makeRow(i));
    const chunks = chunkCsv(rows.join('\n'), {
      chunkSize: 30,
      chunkOverlap: 0,
    });
    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
      expect(chunk.tokenCount).toBeGreaterThan(0);
      expect(chunk.metadata).toEqual({});
    });
  });
});
