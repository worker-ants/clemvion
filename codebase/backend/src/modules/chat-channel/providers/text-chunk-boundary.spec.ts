import { findChunkEnd } from './text-chunk-boundary';

/** 자리마다 글자가 다른 문자열. 위치가 어긋나면 이어 붙인 결과가 원문과 달라진다. */
function distinct(length: number, seed = 0): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i += 1)
    out += alphabet[(i * 7 + seed) % alphabet.length];
  return out;
}

function split(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const end = findChunkEnd(text, cursor, maxLength);
    chunks.push(text.slice(cursor, end));
    cursor = end;
  }
  return chunks;
}

describe('findChunkEnd (NERV Task CLE-T-ZEWGJP)', () => {
  it('남은 글자가 한도 이하면 끝까지', () => {
    expect(findChunkEnd(distinct(10), 0, 10)).toBe(10);
    expect(findChunkEnd(distinct(25), 15, 10)).toBe(25);
  });

  it('한도 안의 마지막 줄바꿈 바로 뒤에서 자른다', () => {
    const text = `${distinct(12)}\n${distinct(3, 1)} ${distinct(10, 2)}`;
    // 0..19 안에 줄바꿈(12)과 공백(16)이 있다. 줄바꿈을 먼저 고른다.
    expect(findChunkEnd(text, 0, 20)).toBe(13);
  });

  it('줄바꿈이 없으면 마지막 공백 바로 뒤에서 자른다', () => {
    const text = `${distinct(6)} ${distinct(5, 1)} ${distinct(20, 2)}`;
    expect(findChunkEnd(text, 0, 20)).toBe(13);
  });

  it('탭도 공백으로 본다', () => {
    const text = `${distinct(14)}\t${distinct(20, 1)}`;
    expect(findChunkEnd(text, 0, 20)).toBe(15);
  });

  it.each([
    ['NBSP', '\u00a0'],
    ['전각 공백', '\u3000'],
  ])('%s 도 공백으로 본다', (_label, space) => {
    const text = `${distinct(14)}${space}${distinct(20, 1)}`;
    expect(findChunkEnd(text, 0, 20)).toBe(15);
  });

  it('\\r\\n 은 \\n 바로 뒤에서 잘라 두 글자를 앞 조각에 남긴다', () => {
    const text = `${distinct(12)}\r\n${distinct(20, 1)}`;
    const end = findChunkEnd(text, 0, 20);
    expect(end).toBe(14);
    expect(text.slice(0, end).endsWith('\r\n')).toBe(true);
  });

  it('줄바꿈 자리가 한도의 절반보다 앞이면 그보다 뒤의 공백을 고른다', () => {
    const text = `${distinct(3)}\n${distinct(10, 1)} ${distinct(20, 2)}`;
    expect(findChunkEnd(text, 0, 20)).toBe(15);
  });

  it('경계가 없으면 한도 글자째에서 자른다', () => {
    expect(findChunkEnd(distinct(50), 0, 20)).toBe(20);
    expect(findChunkEnd(distinct(50), 7, 20)).toBe(27);
  });

  it('경계에서 자르면 조각이 한도의 절반보다 짧아질 때 한도 글자째에서 자른다', () => {
    const text = `${distinct(8)} ${distinct(50, 1)}`;
    // 공백 뒤(9)에서 자르면 9 < 10 이다.
    expect(findChunkEnd(text, 0, 20)).toBe(20);
  });

  it('조각 길이가 정확히 한도의 절반이면 경계를 쓴다', () => {
    const text = `${distinct(9)} ${distinct(50, 1)}`;
    expect(findChunkEnd(text, 0, 20)).toBe(10);
  });

  it('start 뒤의 창만 본다(앞 조각의 경계를 다시 쓰지 않는다)', () => {
    const text = `${distinct(5)}\n${distinct(60, 1)}`;
    expect(findChunkEnd(text, 6, 20)).toBe(26);
  });

  it('고정 절단 자리가 서로게이트 쌍 가운데면 한 글자 앞에서 자른다', () => {
    const text = `${distinct(19)}😀${distinct(20, 1)}`;
    expect(findChunkEnd(text, 0, 20)).toBe(19);
    expect(findChunkEnd(text, 0, 21)).toBe(21);
  });

  it('한도가 1이면 서로게이트 쌍이어도 한 글자 나아간다(빈 조각을 만들지 않는다)', () => {
    expect(findChunkEnd('😀😀', 0, 1)).toBe(1);
    expect(findChunkEnd('😀😀', 1, 1)).toBe(2);
  });

  it.each<[string, number, string]>([
    ['줄바꿈 문단', 4, '\n'],
    ['공백 단어', 9, ' '],
    ['경계 없음', 0, ''],
  ])('%s — 조각은 한도 이하이고 이으면 원문이다', (_label, everyN, sep) => {
    let text = '';
    for (let i = 0; i < 300; i += 1) {
      text += distinct(1, i + everyN);
      if (everyN && i % everyN === everyN - 1) text += sep;
    }
    const chunks = split(text, 40);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(40);
    expect(chunks.join('')).toBe(text);
  });
});
