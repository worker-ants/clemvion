# 부작용(Side Effect) 리뷰 결과

## 발견사항

### **[INFO]** `ChannelCommand.button_callback` 타입 union 에 선택적 필드 추가 — 기존 호출자에 무영향
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` — `ChannelCommand` 타입 정의
- 상세: `button_callback` variant 에 `messageId?: string` 가 추가되었다. TypeScript 선택적 필드이므로 기존 코드가 이 필드를 생성하지 않아도 컴파일 오류가 없고, 기존 소비자(switch/if 분기)도 필드 부재를 자연스럽게 처리한다. 인터페이스는 확장만 되었고 축소되지 않아 하위 호환성이 유지된다.
- 제안: 변경 자체는 적절하나, 다른 provider(Slack, Discord 등)가 `button_callback`을 생성하는 코드가 있다면 `messageId` 미설정이 의도대로인지 확인 필요. 현재 코드 범위 내에서는 문제 없음.

### **[INFO]** `renderAiMessage` 반환 배열 크기 변경 — 기존 테스트 기대값 갱신 필요 (이미 갱신됨)
- 위치: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts` — `renderAiMessage` 함수 (라인 890-908)
- 상세: `ai_message` 이벤트 처리 시 기존에는 `text` 메시지만 반환했으나, 이제 `{ kind: 'typing' }` 메시지가 배열 첫 번째 요소로 선행된다. 이로 인해 `renderTelegramMessages` 반환값의 배열 인덱스가 전반적으로 1씩 밀린다. 해당 `.spec.ts` 파일에서 기대값을 이미 갱신하였으므로 테스트 회귀는 없다. 그러나 이 함수를 직접 소비하거나 반환값 인덱스에 의존하는 다른 코드(예: dispatcher, e2e fixture)가 있다면 영향을 받을 수 있다.
- 제안: `renderNode` → `sendMessage` 파이프라인의 dispatcher 구현이 `typing` body 를 명시적으로 처리하는지(`case 'typing'` 분기 존재 여부) 확인 필요. `telegram.adapter.ts`에 `case 'typing'` 분기가 존재함을 확인하였으므로 현재 범위 내에서는 문제 없음.

### **[INFO]** `ackInteraction` 에 Telegram 외부 API 호출 추가 — best-effort 예외 처리됨
- 위치: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts` — `ackInteraction` 메서드 (라인 3011-3031)
- 상세: 기존 `ackInteraction`은 `answerCallbackQuery` 한 번만 호출했으나, 이제 `messageId`가 있을 때 `editMessageReplyMarkup`을 추가 호출한다. 이는 새로운 외부 네트워크 호출이다. `try/catch`로 예외를 삼키고 `logger.warn`으로만 기록하여 ack 흐름에는 영향이 없다. best-effort 계약이 명시적으로 주석 처리되어 있고 테스트도 이를 검증하므로 의도된 설계다.
- 제안: 이상 없음. Telegram API 의 48시간 편집 제한으로 인한 실패가 warn 수준으로 기록되므로 운영 모니터링에서 노이즈가 될 수 있다. 필요하다면 특정 Telegram API 에러 코드(예: 400 Bad Request: "message is not modified", "message can't be edited")를 구분하여 로깅 레벨을 조정하는 방향을 고려할 수 있다.

### **[INFO]** `TelegramEditMessageReplyMarkupParams` 인터페이스 및 `editMessageReplyMarkup` 메서드 신규 공개 — 추가만 수행
- 위치: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-client.ts` — 라인 35-41, 253-264
- 상세: 새 인터페이스와 메서드가 `export`되었다. 기존 코드에는 영향이 없으며, `TelegramClient`를 mock 하는 테스트에서 `editMessageReplyMarkup: jest.fn()`을 추가해야 하므로 `telegram.adapter.spec.ts`의 `makeMockClient()` 팩토리를 이미 갱신하였다. 다른 테스트 파일에 `TelegramClient`를 직접 mock 하는 코드가 있다면 TypeScript 컴파일 오류가 발생할 수 있다.
- 제안: `telegram.adapter.spec.ts` 외에 `TelegramClient`를 수동 mock 하는 파일이 있다면 `editMessageReplyMarkup` 추가 필요 여부를 확인할 것.

### **[INFO]** `parseTelegramUpdate` — `new Date().toISOString()` 호출로 인한 현재 시각 캡처
- 위치: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-update.parser.ts` — 라인 2047
- 상세: 이번 변경과 직접 관련은 없으나, `parseTelegramUpdate`는 "pure, side-effect free" 로 주석 처리되어 있지만 실제로 `new Date()` 호출로 호출 시각을 캡처한다. 이는 기존에도 존재하는 특성이며, 이번 변경(`messageId` 추가 전달)으로 인해 새로 도입된 것은 아니다.
- 제안: 이번 변경 범위 외. 기존 설계상의 특성이므로 별도 이슈로 관리할 것.

## 요약

이번 변경은 Telegram 채널의 두 가지 UX 개선을 구현한다: (1) `ai_message` 응답 직전 typing indicator 선행 발송, (2) 버튼 클릭(button_callback) ack 후 원본 메시지의 inline_keyboard 제거(중복 클릭 차단). 전역 변수 수정, 파일시스템 부작용, 환경 변수 읽기/쓰기, 이벤트 구독 변경은 없다. 공개 API(`ChannelCommand`, `TelegramClient`) 변경은 모두 순수 확장(옵션 필드 추가, 메서드 추가)으로 기존 호출자의 하위 호환성을 유지한다. `ackInteraction`에 추가된 외부 API 호출은 best-effort로 격리되어 ack 흐름을 막지 않는다. `renderAiMessage` 반환 배열 구조 변경(typing 선행)은 관련 테스트에서 이미 반영되었고, adapter의 `sendMessage`에 `typing` 처리 분기가 존재함을 확인하였다. 전반적으로 의도치 않은 부작용이 없는 안전한 변경이다.

## 위험도

LOW
