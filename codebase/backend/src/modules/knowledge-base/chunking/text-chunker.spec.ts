import { chunkText } from './text-chunker';

describe('TextChunker', () => {
  const defaultOptions = { chunkSize: 100, chunkOverlap: 20 };

  it('should return empty array for empty text', () => {
    expect(chunkText('', defaultOptions)).toEqual([]);
    expect(chunkText('   ', defaultOptions)).toEqual([]);
  });

  it('should return single chunk for small text', () => {
    const text = 'Hello, this is a short text.';
    const chunks = chunkText(text, defaultOptions);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(text);
    expect(chunks[0].index).toBe(0);
  });

  it('should split by paragraphs', () => {
    const paragraphs = Array.from(
      { length: 5 },
      (_, i) => `Paragraph ${i + 1}. ${'x'.repeat(200)}`,
    );
    const text = paragraphs.join('\n\n');
    const chunks = chunkText(text, { chunkSize: 100, chunkOverlap: 0 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should assign sequential chunk indices', () => {
    const text = Array.from(
      { length: 10 },
      (_, i) => `Paragraph ${i}. ${'word '.repeat(100)}`,
    ).join('\n\n');
    const chunks = chunkText(text, defaultOptions);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].index).toBe(i);
    }
  });

  it('should estimate token count', () => {
    const text = 'Hello world. This is a test sentence.';
    const chunks = chunkText(text, defaultOptions);
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it('should handle text with only sentences (no paragraphs)', () => {
    const text =
      'First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence. ' +
      'Sixth sentence. Seventh sentence. Eighth sentence. Ninth sentence. Tenth sentence.';
    const chunks = chunkText(text, { chunkSize: 20, chunkOverlap: 0 });
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('should cause content overlap between chunks when chunkOverlap > 0', () => {
    // Generate text large enough to produce multiple chunks
    const paragraphs = Array.from(
      { length: 10 },
      (_, i) => `Paragraph ${i}. ${'word '.repeat(80)}`,
    );
    const text = paragraphs.join('\n\n');

    const chunksWithOverlap = chunkText(text, {
      chunkSize: 100,
      chunkOverlap: 30,
    });
    const chunksWithoutOverlap = chunkText(text, {
      chunkSize: 100,
      chunkOverlap: 0,
    });

    expect(chunksWithOverlap.length).toBeGreaterThan(1);
    expect(chunksWithoutOverlap.length).toBeGreaterThan(1);

    // With overlap, consecutive chunks should share some content
    // The end of chunk N should appear at the start of chunk N+1
    let hasOverlap = false;
    for (let i = 1; i < chunksWithOverlap.length; i++) {
      const prevContent = chunksWithOverlap[i - 1].content;
      const currContent = chunksWithOverlap[i].content;
      // Check if the tail of the previous chunk appears in the current chunk
      const tailLength = Math.min(30, prevContent.length);
      const tail = prevContent.substring(prevContent.length - tailLength);
      if (currContent.includes(tail)) {
        hasOverlap = true;
        break;
      }
    }
    expect(hasOverlap).toBe(true);
  });
});

describe('chunkText baseMetadata propagation (spec §6.1)', () => {
  it('copies baseMetadata onto every chunk', () => {
    const chunks = chunkText(
      'hello world. this is a small document body.',
      { chunkSize: 100, chunkOverlap: 0 },
      { section: 'Intro', page: 2 },
    );
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(c.metadata).toEqual({ section: 'Intro', page: 2 });
    }
  });

  it('defaults to empty metadata when no baseMetadata is passed', () => {
    const chunks = chunkText('hello world', {
      chunkSize: 100,
      chunkOverlap: 0,
    });
    expect(chunks[0].metadata).toEqual({});
  });
});
