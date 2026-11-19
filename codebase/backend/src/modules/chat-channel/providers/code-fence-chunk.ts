/**
 * 긴 본문을 조각으로 나눌 때 열린 코드 블록(```)을 앞 조각 끝에서 닫고 다음 조각 앞에서 같은 언어
 * 태그로 다시 연다(NERV Task `CLE-T-RYXCFX`, 2026-11-15 사람 결정 B안). 규칙의 정본은
 * CLE-CHAT-ADAPTER-RENDER 「긴 본문 나누기」다. 자를 자리는 프로바이더가 넘긴 `pickEnd` 가 고르고
 * 이 함수는 그 자리가 블록 안인지만 본다.
 *
 * - 블록 표식은 ``` 세 글자다. 줄 어디에 있든 왼쪽부터 짝을 지어 여닫는다(Slack · Discord ·
 *   Telegram 이 모두 그렇게 읽는다). escape 된 `\`\`\`` 는 표식이 아니다.
 * - 여는 ``` 바로 뒤가 한 단어(영숫자와 `+ # . -`, 32자 이하)이고 그 뒤가 줄바꿈이면 그 단어를
 *   언어 태그로 본다. 다시 열 때는 ``` + 태그 + 줄바꿈을 쓴다.
 * - 표식(여는 ``` 가 있는 줄, 닫는 ```) 가운데에서는 자르지 않고 표식 앞으로 당긴다. 표식이 조각
 *   맨 앞이면 당기지 않는다.
 * - 닫는 표식은 본문이 줄바꿈으로 끝나면 ```, 아니면 줄바꿈 + ``` 다. 표식을 더해도 조각은 한도
 *   안이다. 자른 자리가 블록 안이면 닫는 표식 길이만큼 한도를 줄여 자리를 다시 고른다.
 * - 조각의 `body` 를 모두 이으면 원문과 같다.
 */

const FENCE = '```';
const LANGUAGE_TAG = /^[\w+#.-]{1,32}$/;
/** 닫는 표식의 가장 긴 모양(`\n```)의 길이. */
const CLOSE_RESERVE = 1 + FENCE.length;

export interface FencedChunk {
  /** 다시 연 표식. 블록 밖에서 시작하는 조각은 빈 문자열. */
  reopen: string;
  /** 원문 조각. */
  body: string;
  /** 닫는 표식. 블록 밖에서 끝나는 조각은 빈 문자열. */
  close: string;
}

export interface FencedChunkOptions {
  /** 마지막 조각(표식 포함)의 한도. 남은 글이 이 안에 들어가면 더 나누지 않는다. */
  lastLimit: number;
  /** 마지막이 아닌 조각(표식 포함, 이어짐 접미사 제외)의 한도. */
  midLimit: number;
  /** `start` 부터 `maxLength` 글자 안에서 자를 자리를 고른다. 반환값은 `start` 보다 크다. */
  pickEnd(text: string, start: number, maxLength: number): number;
}

interface FenceToken {
  start: number;
  /**
   * 자르면 안 되는 구간의 끝. 여는 표식은 그 줄의 줄바꿈까지(같은 줄에 닫는 ``` 가 있으면 ``` 세
   * 글자만), 닫는 표식은 ``` 세 글자다.
   */
  end: number;
  opens: boolean;
  tag: string;
}

export function splitKeepingCodeFences(
  text: string,
  options: FencedChunkOptions,
): FencedChunk[] {
  const tokens = scanFences(text);
  const chunks: FencedChunk[] = [];
  let open: FenceToken | undefined;
  let cursor = 0;
  while (cursor < text.length) {
    const reopen = open ? FENCE + open.tag + '\n' : '';
    if (reopen.length + text.length - cursor <= options.lastLimit) {
      chunks.push({ reopen, body: text.slice(cursor), close: '' });
      break;
    }
    const budget = options.midLimit - reopen.length;
    let end = pickOutsideFence(text, tokens, cursor, budget, options);
    let openAtEnd = openFenceAt(tokens, end);
    if (openAtEnd) {
      end = pickOutsideFence(
        text,
        tokens,
        cursor,
        budget - CLOSE_RESERVE,
        options,
      );
      openAtEnd = openFenceAt(tokens, end);
    }
    const body = text.slice(cursor, end);
    const close = openAtEnd ? (body.endsWith('\n') ? FENCE : '\n' + FENCE) : '';
    chunks.push({ reopen, body, close });
    open = openAtEnd;
    cursor = end;
  }
  return chunks;
}

function pickOutsideFence(
  text: string,
  tokens: FenceToken[],
  start: number,
  maxLength: number,
  options: FencedChunkOptions,
): number {
  const end = options.pickEnd(text, start, maxLength);
  const cut = tokens.find((t) => t.start < end && end < t.end);
  return cut && cut.start > start ? cut.start : end;
}

/** `position` 앞까지 읽었을 때 열려 있는 블록의 여는 표식. 닫혀 있으면 `undefined`. */
function openFenceAt(
  tokens: FenceToken[],
  position: number,
): FenceToken | undefined {
  let last: FenceToken | undefined;
  for (const token of tokens) {
    if (token.start >= position) break;
    last = token;
  }
  return last?.opens ? last : undefined;
}

function scanFences(text: string): FenceToken[] {
  const tokens: FenceToken[] = [];
  let opens = true;
  let from = 0;
  for (;;) {
    const start = text.indexOf(FENCE, from);
    if (start < 0) return tokens;
    let end = start + FENCE.length;
    let tag = '';
    if (opens) {
      const newline = text.indexOf('\n', end);
      const lineEnd = newline < 0 ? text.length : newline + 1;
      const info = text.slice(end, newline < 0 ? text.length : newline);
      if (!info.includes(FENCE)) {
        end = lineEnd;
        if (newline >= 0 && LANGUAGE_TAG.test(info)) tag = info;
      }
    }
    tokens.push({ start, end, opens, tag });
    opens = !opens;
    from = start + FENCE.length;
  }
}
