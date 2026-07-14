import {
  MARKDOWN_V2_SPECIAL_CHARS,
  firstUnescapedMarkdownV2Special,
} from './markdown-v2';
import { escapeMarkdownV2 } from '../providers/telegram/telegram-message.renderer';

describe('firstUnescapedMarkdownV2Special (F-5 detection)', () => {
  it('특수문자 없으면 null', () => {
    expect(
      firstUnescapedMarkdownV2Special('양식이나 버튼을 사용해 주세요'),
    ).toBeNull();
    expect(firstUnescapedMarkdownV2Special('')).toBeNull();
  });

  it('unescaped 특수문자 검출 (좌→우 첫 문자)', () => {
    expect(firstUnescapedMarkdownV2Special('받을 수 없어요.')).toBe('.');
    expect(firstUnescapedMarkdownV2Special('a-b.c')).toBe('-');
  });

  it('escape 된 특수문자(\\.)는 통과', () => {
    expect(firstUnescapedMarkdownV2Special('처리 중입니다\\.')).toBeNull();
    expect(firstUnescapedMarkdownV2Special('\\- 새 대화\\.')).toBeNull();
  });

  // 회귀 가드 — 연속 backslash: `\\!` = escaped-backslash + unescaped-`!` → telegram 400.
  // 단순 /\\X/ regex 는 이를 놓쳐(우회) 안전하지 않은 override 를 통과시켰다. toggle 스캔은 검출.
  it('연속 backslash 뒤 예약문자는 unescaped 로 검출 (regex 우회 회귀 가드)', () => {
    expect(firstUnescapedMarkdownV2Special('lit\\\\!bang')).toBe('!');
    expect(firstUnescapedMarkdownV2Special('a\\\\.b')).toBe('.');
    // `\\\!` = escaped-backslash + escaped-`!` → 안전(통과).
    expect(firstUnescapedMarkdownV2Special('a\\\\\\!b')).toBeNull();
  });
});

// SoT drift 가드 — renderer 의 escapeMarkdownV2 가 escape 하는 문자 집합이 shared 상수와
// 정확히 일치해야 한다. telegram Bot API 예약문자가 바뀌어 한쪽만 갱신되면 여기서 fail.
describe('MARKDOWN_V2_SPECIAL_CHARS ↔ escapeMarkdownV2 계약', () => {
  it('shared 집합의 모든 문자를 renderer 가 escape 한다', () => {
    for (const ch of MARKDOWN_V2_SPECIAL_CHARS) {
      expect(escapeMarkdownV2(ch)).toBe(`\\${ch}`);
    }
  });

  it('비-특수문자는 renderer 가 escape 하지 않는다', () => {
    for (const ch of 'aZ0 가나,?') {
      expect(escapeMarkdownV2(ch)).toBe(ch);
    }
  });
});
