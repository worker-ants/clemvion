import { splitKeepingCodeFences } from './code-fence-chunk';
import { findChunkEnd } from './text-chunk-boundary';
import { distinct } from './__test-utils__/distinct-text';

const SUFFIX = '\n_(continued…)_';

function split(text: string, lastLimit: number, midLimit = lastLimit) {
  return splitKeepingCodeFences(text, {
    lastLimit,
    midLimit,
    pickEnd: findChunkEnd,
  });
}

/** 조각을 이을 때 더한 표식을 뺀다. */
function joinBodies(chunks: ReturnType<typeof split>): string {
  return chunks.map((c) => c.body).join('');
}

function fenceCount(text: string): number {
  return text.split('```').length - 1;
}

describe('splitKeepingCodeFences (NERV Task CLE-T-RYXCFX)', () => {
  it('코드 블록이 없으면 표식 없이 경계 규칙대로만 나눈다', () => {
    const text = distinct(250);
    const chunks = split(text, 100);
    expect(chunks.map((c) => c.body)).toEqual([
      text.slice(0, 100),
      text.slice(100, 200),
      text.slice(200),
    ]);
    chunks.forEach((c) => {
      expect(c.reopen).toBe('');
      expect(c.close).toBe('');
    });
  });

  it('경계가 열린 블록 안이면 앞 조각을 닫고 다음 조각을 같은 언어 태그로 다시 연다', () => {
    const code = Array.from({ length: 30 }, (_, i) => `line${i}`).join('\n');
    const text = `intro\n\`\`\`python\n${code}\n\`\`\`\nouttro`;
    const chunks = split(text, 120);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].close).not.toBe('');
    expect(chunks[1].reopen).toBe('```python\n');
    expect(joinBodies(chunks)).toBe(text);
    chunks.forEach((c) => {
      const message = c.reopen + c.body + c.close;
      expect(message.length).toBeLessThanOrEqual(120);
      expect(fenceCount(message) % 2).toBe(0);
    });
  });

  it('언어 태그가 없는 블록은 ``` 만으로 다시 연다', () => {
    const text = '```\n' + 'x '.repeat(200) + '\n```';
    const chunks = split(text, 100);
    expect(chunks.length).toBeGreaterThan(2);
    chunks.slice(1).forEach((c) => expect(c.reopen).toBe('```\n'));
    expect(joinBodies(chunks)).toBe(text);
  });

  it('닫는 표식은 본문이 줄바꿈으로 끝나면 ``` 만 붙인다', () => {
    const text = '```js\n' + 'abc\n'.repeat(60) + '```';
    const chunks = split(text, 100);
    expect(chunks[0].body.endsWith('\n')).toBe(true);
    expect(chunks[0].close).toBe('```');
  });

  it('닫는 표식을 붙이면 한도를 넘는 경우 본문을 줄여 표식 자리를 만든다', () => {
    // 줄바꿈 · 공백이 없어 고정 길이로 자르는 본문. 표식이 없으면 한도 자리에서 자른다.
    const text = '```\n' + distinct(300);
    const chunks = split(text, 100);
    chunks.forEach((c) => {
      expect((c.reopen + c.body + c.close).length).toBeLessThanOrEqual(100);
    });
    expect(chunks[0].close).toBe('\n```');
    expect(joinBodies(chunks)).toBe(text);
  });

  it('마지막이 아닌 조각은 midLimit 안에, 마지막 조각은 lastLimit 안에 담는다', () => {
    const text = '```ts\n' + 'const a = 1;\n'.repeat(40) + '```';
    const mid = 100 - SUFFIX.length;
    const chunks = split(text, 100, mid);
    chunks.slice(0, -1).forEach((c) => {
      expect((c.reopen + c.body + c.close).length).toBeLessThanOrEqual(mid);
    });
    const last = chunks[chunks.length - 1];
    expect((last.reopen + last.body + last.close).length).toBeLessThanOrEqual(
      100,
    );
    expect(joinBodies(chunks)).toBe(text);
  });

  it('여는 표식 줄 가운데에서 자르지 않는다', () => {
    // 앞쪽 줄바꿈은 절반 규칙에 걸려 고정 길이(100)로 자르는데 그 자리가 여는 표식 줄 가운데다.
    // 표식 줄 앞에서 잘라야 다음 조각이 블록을 제대로 연다.
    const opener = '```' + 'p'.repeat(80);
    const text =
      distinct(30) + '\n' + opener + '\n' + 'x = 1\n'.repeat(30) + '```';
    const chunks = split(text, 100);
    expect(chunks[0].body).toBe(distinct(30) + '\n');
    expect(chunks[0].close).toBe('');
    expect(chunks[1].reopen).toBe('');
    expect(chunks[1].body.startsWith(opener + '\n')).toBe(true);
    expect(joinBodies(chunks)).toBe(text);
  });

  it('닫는 표식 ``` 가운데에서 자르지 않는다', () => {
    // 고정 길이 자리가 닫는 ``` 의 두 번째 글자 뒤에 온다.
    const text = '```\n' + distinct(94) + '```' + distinct(50);
    const chunks = split(text, 100);
    chunks.forEach((c) =>
      expect(fenceCount(c.reopen + c.body + c.close) % 2).toBe(0),
    );
    expect(joinBodies(chunks)).toBe(text);
  });

  it('한 줄 안에서 열고 닫는 ``` 는 열린 블록으로 보지 않는다', () => {
    const text = ('see ```inline``` here. ' + distinct(30) + '\n').repeat(10);
    const chunks = split(text, 100);
    chunks.forEach((c) => {
      expect(c.reopen).toBe('');
      expect(c.close).toBe('');
    });
    expect(joinBodies(chunks)).toBe(text);
  });

  it('언어 태그 자리에 단어가 아닌 글이 오면 태그 없이 다시 연다', () => {
    const text = '```' + 'x'.repeat(40) + ' y\n' + 'code line\n'.repeat(30);
    const chunks = split(text, 100);
    chunks.slice(1).forEach((c) => expect(c.reopen).toBe('```\n'));
    expect(joinBodies(chunks)).toBe(text);
  });

  it('블록이 여러 개여도 조각마다 ``` 짝이 맞고 원문을 되살릴 수 있다', () => {
    const block = (lang: string) =>
      '```' + lang + '\n' + 'console.log(1);\n'.repeat(12) + '```\n';
    const text = [
      'a '.repeat(30),
      block('js'),
      'b '.repeat(30),
      block('sh'),
      'c',
    ].join('\n');
    const chunks = split(text, 90, 75);
    chunks.forEach((c) =>
      expect(fenceCount(c.reopen + c.body + c.close) % 2).toBe(0),
    );
    const reopened = chunks.filter((c) => c.reopen !== '').map((c) => c.reopen);
    expect(new Set(reopened)).toEqual(new Set(['```js\n', '```sh\n']));
    expect(joinBodies(chunks)).toBe(text);
  });

  it('생성한 본문 여러 개에서 한도 · 원문 복원 · 표식 짝이 늘 지켜진다', () => {
    // 시드를 고정한 선형 합동 생성기. 실패하면 같은 입력을 다시 만들 수 있다.
    let state = 12345;
    const next = (n: number) => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state % n;
    };
    const pieces = ['```', '```py\n', '```\n', '\n', ' ', 'ab', 'xyz', '`'];
    for (let round = 0; round < 300; round += 1) {
      let text = '';
      const length = 50 + next(400);
      while (text.length < length) {
        text +=
          next(3) === 0
            ? pieces[next(pieces.length)]
            : distinct(1 + next(20), next(36));
      }
      const lastLimit = 40 + next(80);
      const midLimit = lastLimit - next(16);
      const chunks = split(text, lastLimit, midLimit);
      expect(joinBodies(chunks)).toBe(text);
      chunks.forEach((c, i) => {
        const message = c.reopen + c.body + c.close;
        const isLast = i === chunks.length - 1;
        expect(message.length).toBeLessThanOrEqual(
          isLast ? lastLimit : midLimit,
        );
        expect(c.body.length).toBeGreaterThan(0);
        if (!isLast) expect(fenceCount(message) % 2).toBe(0);
      });
    }
  });
});
