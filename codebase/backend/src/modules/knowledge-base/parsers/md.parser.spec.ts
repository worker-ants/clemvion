import { parseMdSegments } from './md.parser';

describe('parseMdSegments (spec §6.1 section metadata)', () => {
  it('splits by heading and assigns section, keeping the heading line', () => {
    const md = '# Intro\nhello\n\n## Details\nworld';
    expect(parseMdSegments(Buffer.from(md))).toEqual([
      { text: '# Intro\nhello', metadata: { section: 'Intro' } },
      { text: '## Details\nworld', metadata: { section: 'Details' } },
    ]);
  });

  it('content before the first heading is section-less', () => {
    const segs = parseMdSegments(Buffer.from('preamble\n\n# H1\nbody'));
    expect(segs[0]).toEqual({ text: 'preamble', metadata: {} });
    expect(segs[1].metadata).toEqual({ section: 'H1' });
  });

  it('trims trailing `#` decoration from the heading title', () => {
    const segs = parseMdSegments(Buffer.from('## Title ##\nbody'));
    expect(segs[0].metadata).toEqual({ section: 'Title' });
  });

  it('no headings → single section-less segment', () => {
    expect(parseMdSegments(Buffer.from('just text'))).toEqual([
      { text: 'just text', metadata: {} },
    ]);
  });
});
