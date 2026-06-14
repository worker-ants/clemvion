# API 계약(API Contract) 리뷰 결과

## 발견사항

- **[INFO]** `TelegramEditMessageReplyMarkupParams.reply_markup` 타입이 `{ inline_keyboard: unknown[][] }` 로 선언됨
  - 위치: `telegram-client.ts` L39–43, `TelegramEditMessageReplyMarkupParams`
  - 상세: `unknown[][]` 은 Telegram Bot API 의 `InlineKeyboardButton` 구체 타입을 표현하지 않는다. 빈 배열 `[]` 전달로 키보드 제거는 문제없이 동작하지만, 비-빈 케이스(keyboard 교체)를 쓰는 호출자는 컴파일러 타입 보호를 받지 못한다. 현재 변경에서는 빈 배열만 전달하므로 기능적 문제는 없다.
  - 제안: 향후 keyboard 교체 시나리오를 고려해 `Array<Array<{ text: string; callback_data?: string; url?: string }>>` 정도의 구체 타입으로 교체하면 contract 명확도가 높아진다. 단, v1 에서는 정보성 수준.

- **[INFO]** `button_callback` command 에 `messageId` 필드가 선택적(optional)으로 추가됨 — 기존 `messageId` 없는 클라이언트에 backward compatible
  - 위치: `telegram-update.parser.ts` L88–94
  - 상세: `messageId` 는 `...(typeof messageId === 'number' ? { messageId: String(messageId) } : {})` 로 조건부 스프레드 삽입이므로, 기존 파서 출력 형식(`button_callback` without `messageId`)을 그대로 보존한다. Telegram Update 에 `message.message_id` 가 없는 경우(예: 인라인 모드 callback_query) 에도 안전하게 필드를 생략한다. 하위 호환성 이슈 없음.
  - 제안: 해당 없음.

- **[INFO]** `editMessageReplyMarkup` 실패가 삼켜지는 best-effort 설계 — 에러 응답 일관성 관점에서 적절
  - 위치: `telegram.adapter.ts` L2742–2750
  - 상세: Telegram Bot API 는 메시지 48시간 경과 후 `editMessageReplyMarkup` 를 400 Bad Request 로 거부한다. try-catch 로 삼키고 warn 로그만 남기는 설계는 ack 흐름(answerCallbackQuery)을 막지 않으므로 UX·contract 관점에서 올바르다. `answerCallbackQuery` 자체의 실패는 삼키지 않으므로 의무 ack 계약은 유지된다.
  - 제안: 해당 없음.

- **[INFO]** `typing` 메시지의 `SendResult.externalMsgId` 가 리터럴 `'typing'` 으로 반환됨
  - 위치: `telegram.adapter.ts` (sendMessage case 'typing')
  - 상세: sendChatAction 은 Telegram API 상 메시지 id 를 반환하지 않는다. `'typing'` 리터럴을 externalMsgId 로 반환하는 것은 현재 dispatcher 가 typing 의 externalMsgId 를 사용하지 않는 경우 문제없으나, dispatcher 가 모든 SendResult 를 DB에 기록한다면 `'typing'` 이 실제 메시지 id와 혼동될 수 있다. `null` 또는 undefined 처리가 더 명시적이다.
  - 제안: `SendResult` 타입에서 `externalMsgId` 를 optional 처리하거나, typing 전용 sideEffectOnly 플래그를 두는 것을 중기 개선으로 고려할 수 있다. 현재 변경 범위 내 blocking 이슈는 아님.

- **[INFO]** `renderAiMessage` 에서 typing 메시지의 `conversationKey` 가 빈 문자열 `''` 로 설정됨
  - 위치: `telegram-message.renderer.ts` L898
  - 상세: `{ conversationKey: '', body: { kind: 'typing' } }` — 다른 렌더링 경로(`renderText`, renderButtons 등)도 동일하게 `''` 로 설정하고 dispatcher 가 보정한다는 주석이 있다. 일관된 패턴이며 API 계약 위반은 아님.

## 요약

이번 변경은 내부 Telegram Bot API 클라이언트에 `editMessageReplyMarkup` 메서드를 추가하고, 버튼 콜백 ack 이후 inline keyboard 제거 로직을 구현한 것이다. 외부 HTTP API 계약(Telegram Bot API)을 올바르게 준수하며, 내부 `ChannelUpdate`/`ChannelCommand` 타입에 `messageId` 필드를 optional 추가하는 방식으로 기존 클라이언트에 완전한 하위 호환성을 제공한다. `typing` 메시지 렌더링 추가는 렌더러 출력 구조를 변경하지만 dispatcher contract(순서대로 발송) 내에서 정상 처리되는 변경이다. 에러 응답 처리는 best-effort/의무 ack 구분이 명확하게 설계되어 있다. 전반적으로 API 계약 관점에서 안전한 변경이며 blocking 이슈는 없다.

## 위험도

LOW

---

STATUS=success ISSUES=0
