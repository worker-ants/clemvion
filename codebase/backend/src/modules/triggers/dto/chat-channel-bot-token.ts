// 봇 토큰 입력 형식 — 생성(`chatChannel.botToken`, DTO 검증 → `VALIDATION_ERROR`)과 재발급
// (`newBotToken`, 컨트롤러 검증 → `INVALID_BOT_TOKEN`)이 같은 판정을 쓴다.
//
// 근거: [채팅 채널 「R-CC-32 봇 토큰 입력은 보이는 ASCII 만 받는다」](CLE-CHAT-CORE#r-cc-32-봇-토큰-입력은-보이는-ascii-만-받는다)
// NERV Task `CLE-T-FX354C`. 공백 · 제어 문자 · ASCII 밖 문자가 든 토큰은 `Authorization` 헤더에 실을 수 없어
// fetch 가 요청을 만들지 못하고 502 로 갔다. 사용자가 고칠 입력 오류라 프로바이더를 부르거나 시크릿을 저장하기 전에
// 400 으로 거부한다. 서버가 앞뒤 공백을 잘라 받지 않는다(무엇을 저장했는지 사용자가 알 수 없다). 이미 저장된 토큰은
// 바꾸지 않는다.
//
// 프로바이더별 문자 집합(텔레그램 `\d+:[A-Za-z0-9_-]+` 등)으로 좁히지 않는다. 형식이 바뀌면 정상 토큰을 거부하고,
// 형식 판정은 프로바이더 응답(401/403 → `BOT_TOKEN_INVALID`)이 이미 한다.

/** 봇 토큰 입력의 최대 길이. 생성과 재발급이 같은 상한을 쓴다. */
export const BOT_TOKEN_MAX_LENGTH = 256;

/**
 * 봇 토큰에 허용하는 문자 — 보이는 ASCII(U+0021~U+007E)만. 빈 문자열은 이 패턴으로 거부하지 않는다.
 * 생성 DTO 가 길이(`@MinLength` · `@MaxLength`)와 문자 집합(`@Matches`)을 다른 제약으로 보고해서 위반 하나가
 * `details` 항목 하나로 나가게 하려는 것이다.
 */
export const BOT_TOKEN_CHARSET_PATTERN = /^[\x21-\x7E]*$/;

/**
 * OpenAPI `pattern` 으로 광고하는 문자열. {@link BOT_TOKEN_CHARSET_PATTERN} 과 같은 문자 집합이고
 * 빈 문자열은 `minLength: 1` 과 함께 막는다.
 */
export const BOT_TOKEN_OPENAPI_PATTERN = '^[\\x21-\\x7E]+$';

/** `@Matches` 위반 메시지. 입력값을 싣지 않는다(봇 토큰은 시크릿이다). */
export const BOT_TOKEN_CHARSET_MESSAGE =
  'botToken must contain only visible ASCII characters (U+0021-U+007E)';

/** 봇 토큰 입력이 1~{@link BOT_TOKEN_MAX_LENGTH}자의 보이는 ASCII 인지 본다. */
export function isWellFormedBotToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= BOT_TOKEN_MAX_LENGTH &&
    BOT_TOKEN_CHARSET_PATTERN.test(value)
  );
}
