// `chatChannel` 차단 5필드의 **사용자 노출 거부 메시지** 단일 진실.
//
// 왜 상수인가 — DRY 가 아니라 **등가성**이다. 이 5필드는 두 층에서 거부되고, 어느 층이
// 잡느냐는 **사용자가 보낸 값의 형태**로 갈린다:
//
//   - 비어있지 않은 값 → 전역 `CustomValidationPipe` 가 DTO 의 `@IsEmpty({ message })` 로 거부
//     (중첩 경로 `chatChannel.<field>` · 배열 `details` · `code: 'INVALID_FIELD'`)
//   - `null` / `''`    → `@IsEmpty()` 를 **통과**하고 `TriggersService` 가드가 거부
//     (flat `<field>` · 단일 object `details`)
//
// 즉 **같은 필드를 같은 이유로** 거부하는데 표현 층만 다르다. 두 문면이 갈리면 사용자는
// 같은 거부에 두 가지 설명을 보게 된다 — 보낸 값이 `''` 였는지에 따라. 그 등가성을 상수로
// 고정하고, `chat-channel-rejection-messages.spec.ts` 가 두 층이 이 상수를 쓰는지 단언한다.
//
// SoT: `spec/5-system/15-chat-channel.md` R-CC-21 (PATCH 는 비밀을 쓰지 않는다) ·
//      §5.4.1 「토큰 변경 (rotation)」 행 (두-갈래 `details.field` 서술).
//
// 문면 규율: 사용자 노출 문자열이므로 `message` 는 사람이 읽을 짧은 설명이다
// (`spec/5-system/2-api-convention.md` §5.3). 기계가 읽는 사유는 `details[].code` 가 싣는다 —
// 현재는 generic `INVALID_FIELD` 이고, 세 거부 사유(내부 필드 금지 / PATCH 불변 /
// 최초 설정 한정)를 **구분하는** 도메인 특화 코드 신설은 별개 미결정 항목이다.
export const CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES = {
  // 내부 필드 — 외부 입력 자체가 금지 (생성·PATCH 양쪽)
  botTokenRef:
    'botTokenRef 는 외부 입력이 금지된 내부 필드입니다. 토큰 변경은 POST /api/triggers/:id/chat-channel/rotate-bot-token 을 사용하세요.',
  inboundSigningRef: 'inboundSigningRef 는 외부 입력이 금지된 내부 필드입니다.',
  inboundSigning:
    'inboundSigning 은 setupChannel 시 자동 발급되는 내부 필드입니다. provider-issued (Slack signing secret / Discord public key) 입력은 inboundSigningPlaintext 를 사용하세요.',

  // 값 필드 — 생성에서는 받고 PATCH 에서만 금지
  botToken:
    'botToken 은 PATCH 로 바꿀 수 없어요. 토큰 변경은 POST /api/triggers/:id/chat-channel/rotate-bot-token 을 사용해 주세요.',
  inboundSigningPlaintext:
    'inboundSigningPlaintext 는 PATCH 로 바꿀 수 없어요. 회전이 필요하면 트리거를 삭제 후 다시 만들어 주세요 (v1 미정의).',
} as const;

// 위 객체가 다루는 필드 이름 — 두 층의 가드가 같은 집합을 보는지 테스트가 이것으로 순회한다.
// 배열을 따로 두는 이유: `Object.keys()` 는 타입이 `string[]` 로 넓어져 오탈자를 못 잡는다.
export const CHAT_CHANNEL_BLOCKED_FIELDS = [
  'botTokenRef',
  'inboundSigningRef',
  'inboundSigning',
  'botToken',
  'inboundSigningPlaintext',
] as const satisfies readonly (keyof typeof CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES)[];
