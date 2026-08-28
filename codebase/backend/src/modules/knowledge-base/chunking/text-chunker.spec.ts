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

describe('chunkText force-split branch (단일 문장이 chunkSize 초과)', () => {
  it('force-split 분기에 실제로 진입해 문자 단위로 강제 분할하고, 직전 문맥이 새지 않는다', () => {
    const chunkSize = 10; // 토큰 ≈ 30 chars
    const chunkOverlap = 3; // 토큰 ≈ 9 chars
    const shortSentence = 'Hi there.'; // 9 chars, tokens=3 — force-split 진입 전 currentChunk 로 누적
    // 90 chars, 마침표/물음표 등 문장 종결부호 없음 → splitSentences() 가 하나의 "문장"으로 취급.
    // 3자리 순번 코드로 구성해 강제 분할된 각 조각의 실제 위치를 식별 가능하게 만든다.
    const longSentence = Array.from({ length: 30 }, (_, i) =>
      String(i).padStart(3, '0'),
    ).join('');
    const text = `${shortSentence} ${longSentence}`;

    const chunks = chunkText(text, { chunkSize, chunkOverlap });

    // force-split 진입 증거 — 단일 긴 "문장" 하나가 여러 조각으로 쪼개졌다.
    // (진입하지 않는 fixture 라면 chunks.length 는 1~2 에 그친다.)
    expect(chunks.length).toBeGreaterThan(2);

    // force-split 진입 직전 누적돼 있던 currentChunk 는 그대로 먼저 flush 된다.
    expect(chunks[0].content).toBe(shortSentence);

    // "forceSplitAndPush 가 자체적으로 overlap 을 처리한다 — 이 분기는 캐리오버 없음" 불변식
    // (no-useless-assignment 로 제거된 dead-store 자리의 문서화된 계약). force-split 조각들은
    // 직전 currentChunk 텍스트를 물려받지 않고, longSentence 의 실제 부분 문자열만 담는다.
    const forcedChunks = chunks.slice(1);
    for (const chunk of forcedChunks) {
      expect(chunk.content).not.toContain(shortSentence);
      expect(longSentence).toContain(chunk.content);
    }

    // 마지막 조각은 longSentence 의 끝(마지막 순번 코드)까지 커버한다 — 문자 유실 없음.
    expect(forcedChunks[forcedChunks.length - 1].content.endsWith('029')).toBe(
      true,
    );
  });

  // 위 케이스는 force-split **진입**을 고정하지만 `overlapBuffer = ''` 리셋은 관측하지 못한다 —
  // fixture 가 force-split 직후 끝나서 그 값을 **읽는 코드가 없기** 때문이다. 즉 리셋을 지워도
  // GREEN 이다(vacuous). 아래 케이스가 그 축을 닫는다: force-split 이 끝난 뒤 일반 청크가 하나
  // 더 나오게 만들어, 그 청크가 `pushChunk(..., overlapBuffer, ...)` 로 값을 **소비**하게 한다.
  it('force-split 이 직전 문단의 overlap 캐리오버를 끊는다 (리셋 제거 시 RED)', () => {
    const chunkSize = 10; // 토큰 ≈ 30 chars
    const chunkOverlap = 3; // 토큰 ≈ 9 chars

    // 문단 1 — 작아서 currentChunk 로만 누적된다. 문단 2 진입 시 flush 되면서
    // `overlapBuffer = getOverlapText(문단1, 3)` = 마지막 9자 = 'ARRYOVER.' 로 채워진다.
    // 그 9자에 아래 단언이 쓸 마커('ARRYOVER')가 들어가도록 문자열을 골랐다.
    const para1 = 'AAA BBB CARRYOVER.'; // 18 chars → tokens 6
    const CARRYOVER_MARKER = 'ARRYOVER';

    // 문단 2 의 첫 "문장" — 종결부호가 없어 splitSentences 가 통째로 하나로 본다.
    // 91 chars → tokens 31 > chunkSize 라 force-split 분기로 들어간다.
    const longSentence =
      Array.from({ length: 30 }, (_, i) => String(i).padStart(3, '0')).join(
        '',
      ) + '.';
    // 문단 2 의 둘째 문장 — 작아서 force-split 이후 currentChunk 로 누적되고,
    // 루프 종료 후 `pushChunk(chunks, currentChunk, overlapBuffer, ...)` 로 flush 된다.
    // **이 flush 가 overlapBuffer 를 읽는 유일한 지점**이다.
    const tailSentence = 'TAILMARKER done.'; // 16 chars → tokens 6

    const text = `${para1}\n\n${longSentence} ${tailSentence}`;
    const chunks = chunkText(text, { chunkSize, chunkOverlap });

    // 전제 고정 — 문단 1 이 첫 청크로 그대로 나왔고(= overlapBuffer 가 비어있지 않게 채워졌고),
    // force-split 이 실제로 돌았다. 이 두 전제가 깨지면 아래 단언은 아무것도 검증하지 못한다.
    expect(chunks[0].content).toBe(para1);
    expect(chunks.length).toBeGreaterThan(3);

    // 핵심 — 마지막 청크는 tailSentence **뿐**이다. `overlapBuffer = ''` 를 지우면
    // 문단 1 의 잔여 overlap('ARRYOVER.')이 살아남아 'ARRYOVER. TAILMARKER done.' 이 된다.
    const last = chunks[chunks.length - 1];
    expect(last.content).toBe(tailSentence);
    expect(last.content).not.toContain(CARRYOVER_MARKER);
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
