/**
 * 긴 본문을 조각으로 나눌 때 열린 코드 블록(```)을 앞 조각 끝에서 닫고 다음 조각 앞에서 같은 언어
 * 태그로 다시 연다(NERV Task `CLE-T-RYXCFX`, 2026-11-15 사람 결정 B안). 규칙의 정본은
 * CLE-CHAT-ADAPTER-RENDER 「긴 본문 나누기」다. 자를 자리는 프로바이더가 넘긴 `pickEnd` 가 고르고
 * 이 함수는 그 자리가 블록 안인지만 본다.
 *
 * - 블록 표식은 ``` 세 글자다. 줄 어디에 있든 왼쪽부터 짝을 지어 여닫는다(Slack · Discord ·
 *   Telegram 이 모두 그렇게 읽는다). 백틱을 escape 한 본문(`\`\`\``)에는 ``` 가 이어 나오지
 *   않으므로 표식으로 잡히지 않는다.
 * - 여는 ``` 바로 뒤가 한 단어(영숫자와 `+ # . -`, 32자 이하)이고 그 뒤가 줄바꿈이면 그 단어를
 *   언어 태그로 본다. 다시 열 때는 ``` + 태그 + 줄바꿈을 쓴다.
 * - 표식(여는 ``` 가 있는 줄, 닫는 ```) 가운데에서는 자르지 않고 표식 앞으로 당긴다. 표식이 조각
 *   맨 앞이면 당기지 않는다.
 * - 닫는 표식은 본문이 줄바꿈으로 끝나면 ```, 아니면 줄바꿈 + ``` 다. 표식을 더해도 조각은 한도
 *   안이다. 자른 자리가 블록 안이면 닫는 표식 길이만큼 한도를 줄여 자리를 다시 고른다.
 * - 조각의 `body` 를 모두 이으면 원문과 같다.
 * - 한도가 다시 연 표식과 닫는 표식보다 작아도 조각마다 한 글자 이상 나아간다. 이때는 조각이
 *   한도를 넘을 수 있다(실제 프로바이더 한도에서는 생기지 않는다).
 */

const FENCE = '```';
const LANGUAGE_TAG_MAX_LENGTH = 32;
const LANGUAGE_TAG = /^[\w+#.-]+$/;
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
  /**
   * `start` 부터 `maxLength` 글자 안에서 자를 자리를 고른다. `maxLength` 는 1 이상이고 반환값은
   * `start` 보다 크다.
   */
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

/** `text` 를 조각으로 나눈다. 조각을 메시지 문자열로 이을 때는 {@link joinFencedChunks} 를 쓴다. */
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
    const budget = Math.max(1, options.midLimit - reopen.length);
    let end = pickOutsideFence(text, tokens, cursor, budget, options);
    let openAtEnd = openFenceAt(tokens, end);
    if (openAtEnd) {
      end = pickOutsideFence(
        text,
        tokens,
        cursor,
        Math.max(1, budget - CLOSE_RESERVE),
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

/**
 * 조각을 메시지 문자열로 잇는다. 마지막이 아닌 조각 끝에 이어짐 접미사를 붙인다. 접미사는
 * 프로바이더마다 escape 규칙이 달라 호출자가 넘긴다.
 */
export function joinFencedChunks(
  chunks: FencedChunk[],
  continuedSuffix: string,
): string[] {
  return chunks.map(
    (c, i) =>
      c.reopen +
      c.body +
      c.close +
      (i < chunks.length - 1 ? continuedSuffix : ''),
  );
}

function pickOutsideFence(
  text: string,
  tokens: FenceToken[],
  start: number,
  maxLength: number,
  options: FencedChunkOptions,
): number {
  const end = options.pickEnd(text, start, maxLength);
  // 표식은 겹치지 않고 위치 순이라 `end` 를 품을 수 있는 표식은 `end` 앞에서 시작한 마지막 표식뿐이다.
  const cut = lastTokenBefore(tokens, end);
  return cut && end < cut.end && cut.start > start ? cut.start : end;
}

/** `position` 앞까지 읽었을 때 열려 있는 블록의 여는 표식. 닫혀 있으면 `undefined`. */
function openFenceAt(
  tokens: FenceToken[],
  position: number,
): FenceToken | undefined {
  const last = lastTokenBefore(tokens, position);
  return last?.opens ? last : undefined;
}

/**
 * `position` 앞에서 시작한 마지막 표식. 조각마다 부르므로 이진 탐색한다(선형으로 찾으면 표식이
 * 많은 긴 본문에서 조각 수 × 표식 수가 된다).
 */
function lastTokenBefore(
  tokens: FenceToken[],
  position: number,
): FenceToken | undefined {
  let low = 0;
  let high = tokens.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (tokens[mid].start < position) low = mid + 1;
    else high = mid;
  }
  return low > 0 ? tokens[low - 1] : undefined;
}

/**
 * 표식을 왼쪽부터 찾아 여닫는 짝을 매긴다. 줄 끝 위치를 캐시해 본문 길이에 선형으로 끝난다(여는
 * 표식마다 줄 끝을 다시 찾으면 줄바꿈 없는 긴 본문에서 O(n²) 이 된다).
 */
function scanFences(text: string): FenceToken[] {
  const tokens: FenceToken[] = [];
  let opens = true;
  /** 마지막으로 찾은 줄바꿈 위치. 없으면 `text.length`. */
  let newline = -1;
  let start = text.indexOf(FENCE);
  while (start >= 0) {
    let end = start + FENCE.length;
    const next = text.indexOf(FENCE, end);
    let tag = '';
    if (opens) {
      if (newline < end) {
        newline = text.indexOf('\n', end);
        if (newline < 0) newline = text.length;
      }
      const closesOnSameLine = next >= 0 && next < newline;
      if (!closesOnSameLine) {
        const hasNewline = newline < text.length;
        if (hasNewline && newline - end <= LANGUAGE_TAG_MAX_LENGTH) {
          const info = text.slice(end, newline);
          if (LANGUAGE_TAG.test(info)) tag = info;
        }
        end = hasNewline ? newline + 1 : text.length;
      }
    }
    tokens.push({ start, end, opens, tag });
    opens = !opens;
    start = next;
  }
  return tokens;
}
