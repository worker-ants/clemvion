/**
 * Slack · Discord 렌더러가 긴 본문을 조각으로 나눌 때 자를 자리를 고른다(NERV Task `CLE-T-ZEWGJP`,
 * 2026-11-14 사람 결정 A). REQ-SLACK-018 · REQ-DISCORD-010 의 「단어 · 문장 경계로 나눈다」를 이렇게
 * 구현한다.
 *
 * 1. `start` 부터 `maxLength` 글자 안에서 마지막 줄바꿈 바로 뒤
 * 2. 줄바꿈이 없으면 마지막 공백 바로 뒤
 * 3. 둘 다 없거나 그 자리에서 자르면 조각이 `maxLength` 의 절반보다 짧아지면 `maxLength` 글자째
 *
 * 3번에서 자를 자리가 UTF-16 서로게이트 쌍 가운데면 한 글자 앞에서 자른다. 반환값은 언제나
 * `start` 보다 크다. 조각을 모두 이으면 원문과 같다(자른 자리의 줄바꿈 · 공백은 앞 조각 끝에 남는다).
 */
export function findChunkEnd(
  text: string,
  start: number,
  maxLength: number,
): number {
  const hardEnd = start + maxLength;
  if (hardEnd >= text.length) return text.length;
  const minLength = Math.ceil(maxLength / 2);

  const window = text.slice(start, hardEnd);
  const newline = window.lastIndexOf('\n');
  if (newline >= 0 && newline + 1 >= minLength) return start + newline + 1;

  const space = lastWhitespaceIndex(window);
  if (space >= 0 && space + 1 >= minLength) return start + space + 1;

  return isHighSurrogate(text.charCodeAt(hardEnd - 1)) && maxLength > 1
    ? hardEnd - 1
    : hardEnd;
}

function lastWhitespaceIndex(window: string): number {
  for (let i = window.length - 1; i >= 0; i -= 1) {
    if (/\s/.test(window[i])) return i;
  }
  return -1;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}
