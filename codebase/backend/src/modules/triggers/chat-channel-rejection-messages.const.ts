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
// 고정한다. 그 등가성을 단언하는 테스트는 **두 층에 하나씩** 있다 (전용 spec 파일은 없다):
//   - 파이프 층: `dto/trigger-dto-validation.spec.ts` 의 `[등가성] 차단 5필드의 message 는
//     공유 상수에서 온다` — 비어있지 않은 값으로 파이프를 태운다.
//   - 서비스 층: `triggers.service.spec.ts` 의 `[등가성] … 서비스 message 는 공유 상수에서
//     온다` — `update()` 를 태워 가드를 발동시킨다.
// 둘이 같은 상수를 가리키므로 등가성이 **전이적으로** 고정된다.
//
// SoT: `spec/5-system/15-chat-channel.md` R-CC-21 (PATCH 는 비밀을 쓰지 않는다) ·
//      §5.4.1 「토큰 변경 (rotation)」 행 (두-갈래 `details.field` 서술).
//
// 문면 규율: 사용자 노출 문자열이므로 `message` 는 사람이 읽을 짧은 설명이다
// (`spec/5-system/2-api-convention.md` §5.3). 기계가 읽는 사유는 `details[].code` 가 싣는다 —
// 현재는 generic `INVALID_FIELD` 이고, 세 거부 사유(내부 필드 금지 / PATCH 불변 /
// 최초 설정 한정)를 **구분하는** 도메인 특화 코드 신설은 별개 미결정 항목이다.
export const CHAT_CHANNEL_BLOCKED_FIELDS = [
  'botTokenRef',
  'inboundSigningRef',
  'inboundSigning',
  'botToken',
  'inboundSigningPlaintext',
] as const;

export type ChatChannelBlockedField =
  (typeof CHAT_CHANNEL_BLOCKED_FIELDS)[number];

// **필드 배열이 1차 SoT 다.** `Record<ChatChannelBlockedField, string>` 로 선언하면
// 컴파일러가 **양방향**을 본다 — 배열에 필드를 더하면 메시지 누락이 에러고, 메시지에만
// 더하면 그 키가 타입에 없어서 에러다. 종전 `satisfies` 판본은 편도(원소→key 유효성)만
// 검사해 메시지 객체에 필드가 늘어도 배열 누락을 못 잡았다.
export const CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES: Record<
  ChatChannelBlockedField,
  string
> = {
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
};
