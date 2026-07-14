/**
 * Telegram MarkdownV2 특수문자 공통 SoT (F-5 ai-review architecture WARNING).
 *
 * 이 집합은 두 곳에서 필요하다:
 *   - `providers/telegram/telegram-message.renderer.ts` 의 `escapeMarkdownV2` (발송 시 escape)
 *   - `triggers/dto/chat-channel-config.dto.ts` 의 `LanguageHintsRawSendValidator` (등록 시점 검증)
 *
 * 두 파일이 각자 리터럴로 재선언하면 telegram Bot API 의 예약문자 변경 시 한쪽만 갱신돼
 * silent drift 가 난다. **DTO 검증기는 여기 정의를 직접 import** 하고, 렌더러는 자체 escape
 * 정규식(`MD_V2_ESCAPE_REGEX`)을 유지하되 그 집합이 본 상수와 동일함은 `markdown-v2.spec.ts`
 * 의 계약 테스트가 강제한다 (런타임 import 공유가 아니라 test-guarded 동등성 — 렌더러 regex 를
 * 이 상수에서 재구성하면 char-class escaping 이 얽혀 오히려 취약해지므로 계약 테스트로 잠근다).
 *
 * SoT: Telegram Bot API — MarkdownV2 style.
 */
export const MARKDOWN_V2_SPECIAL_CHARS = '_*[]()~`>#+-=|{}.!';

/**
 * `text` 안에서 **escape 되지 않은** MarkdownV2 특수문자를 좌→우로 찾아 첫 문자를 반환한다
 * (없으면 null). MarkdownV2 의 backslash-escape 의미론을 정확히 재현한다: `\` 는 **바로 다음
 * 1문자**를 escape 하므로(그 문자가 무엇이든), `\\`(escaped backslash) 뒤의 예약문자는
 * escape 되지 않은 상태다.
 *
 * 단순 `/\\X/` regex 로 escape 쌍을 제거하는 방식은 연속 backslash(`\\!` = escaped-backslash +
 * unescaped-`!`)에서 두 번째 backslash 를 예약문자와 잘못 짝지어 오탐/미탐을 낸다 — 그래서
 * 문자 단위 toggle 스캔을 쓴다.
 */
export function firstUnescapedMarkdownV2Special(text: string): string | null {
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      // backslash 는 다음 1문자를 escape — 둘 다 건너뛴다.
      i += 2;
      continue;
    }
    if (MARKDOWN_V2_SPECIAL_CHARS.includes(ch)) return ch;
    i += 1;
  }
  return null;
}
