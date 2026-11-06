import {
  BOT_TOKEN_CHARSET_PATTERN,
  BOT_TOKEN_MAX_LENGTH,
  isWellFormedBotToken,
} from './chat-channel-bot-token';

/**
 * 봇 토큰 입력 형식 판정(NERV Task `CLE-T-FX354C`). 생성 DTO 와 재발급 컨트롤러가 같은 판정을 쓴다.
 *
 * 거부 목록은 fetch 가 `Authorization` 헤더에 싣지 못하거나(CR · LF · NUL, ASCII 밖 문자) 조용히 바꿔 싣는
 * (앞뒤 공백 · 탭 trim) 문자를 모두 덮는다. 보이는 ASCII 한 글자씩 전수로 통과하는지도 본다.
 */
describe('isWellFormedBotToken', () => {
  it.each([
    ['telegram', '123456789:AAFakeTokenForExample_-'],
    ['slack', 'xoxb-1234-5678-abcdEFGH'],
    ['discord', 'MTAxMjM0NTY3ODkw.GhIjKl.mnopqrstuvwxyz0123456789'],
  ])('%s 모양의 토큰을 받는다', (_provider, token) => {
    expect(isWellFormedBotToken(token)).toBe(true);
  });

  it('보이는 ASCII(U+0021~U+007E) 94자를 모두 받는다', () => {
    const all = Array.from({ length: 0x7e - 0x21 + 1 }, (_, i) =>
      String.fromCharCode(0x21 + i),
    ).join('');
    expect(all).toHaveLength(94);
    expect(isWellFormedBotToken(all)).toBe(true);
  });

  it(`길이 경계 — ${BOT_TOKEN_MAX_LENGTH}자는 받고 ${BOT_TOKEN_MAX_LENGTH + 1}자는 거부한다`, () => {
    expect(isWellFormedBotToken('a'.repeat(BOT_TOKEN_MAX_LENGTH))).toBe(true);
    expect(isWellFormedBotToken('a'.repeat(BOT_TOKEN_MAX_LENGTH + 1))).toBe(
      false,
    );
  });

  it.each([
    ['빈 문자열', ''],
    ['공백만', '   '],
    ['앞 공백', ' 111:abc'],
    ['끝 공백', '111:abc '],
    ['가운데 공백', '111:a bc'],
    ['탭', '111:abc\t'],
    ['LF', '111:abc\n'],
    ['CR', '111:\rabc'],
    ['NUL', '111:abc\u0000'],
    ['DEL(U+007F)', '111:abc\u007f'],
    ['Latin-1(U+00E9)', '111:abcé'],
    ['NBSP(U+00A0)', '111:abc '],
    ['한글', '111:봇토큰'],
    ['zero-width space(U+200B)', '111:abc​'],
    ['전각 문자', '１１１:abc'],
  ])('%s 를 거부한다', (_label, token) => {
    expect(isWellFormedBotToken(token)).toBe(false);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['숫자', 12345],
    ['객체', { token: 'abc' }],
  ])('문자열이 아닌 값(%s)을 거부한다', (_label, value) => {
    expect(isWellFormedBotToken(value)).toBe(false);
  });

  it('문자 집합 패턴은 빈 문자열을 거부하지 않는다 — 길이 위반과 문자 위반을 다른 제약으로 보고한다', () => {
    expect(BOT_TOKEN_CHARSET_PATTERN.test('')).toBe(true);
    expect(BOT_TOKEN_CHARSET_PATTERN.test(' ')).toBe(false);
  });
});
