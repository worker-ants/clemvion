# API 계약(API Contract) 리뷰

**리뷰 대상**: chat-channel-template-render-outbound 변경 (15개 소스 파일 + 문서)
**리뷰 일시**: 2026-05-25

---

## 발견사항

### [INFO] `ChatChannelAdapter.renderNode` 시그니처 확장 — 하위 호환성 검토

- 위치: `codebase/backend/src/modules/chat-channel/types.ts` `ChatChannelAdapter` 인터페이스
- 상세: `renderNode(event: EiaEvent, ...)` 가 `renderNode(event: EiaEvent | ChatChannelInternalEvent, ...)` 로 확장되었다. TypeScript 관점에서 이는 파라미터 타입이 더 넓어진 것이므로, 기존 구현체 (Telegram / Slack / Discord renderer) 가 인터페이스를 `implements` 할 때 더 넓은 union 을 모두 처리해야 한다는 의무가 생긴다. 그러나 실제로는 `EiaEvent | ChatChannelInternalEvent` 를 받는 구현을 강제하는 방향이므로, 기존 구현체가 `EiaEvent` 만 처리하는 상태라면 컴파일 오류가 발생할 수 있다. 이번 변경에서 Telegram/Slack/Discord 세 renderer 가 동시에 업데이트되어 `ChatChannelInternalEvent` 케이스를 핸들링하고 있어 정합성은 유지된다.
- 제안: 이 인터페이스를 외부 플러그인이나 서드파티 어댑터가 구현할 가능성이 있다면 breaking change 문서를 남기는 것이 바람직하다. 현재는 내부 모듈 전용으로 보이므로 위험도는 낮다.

---

### [INFO] `EiaAiMessageEvent.presentations` 필드 신규 추가 — 하위 호환성 양호

- 위치: `codebase/backend/src/modules/chat-channel/types.ts` `EiaAiMessageEvent`
- 상세: `presentations?: PresentationPayload[]` 가 optional 필드로 추가되었다. 기존 클라이언트 (이 이벤트를 역직렬화해서 소비하는 쪽) 가 이 필드를 무시하더라도 동작에 문제없다. optional 처리로 하위 호환성이 유지된다.
- 제안: 해당 없음. 설계가 적절하다.

---

### [INFO] `toEiaEvent` 반환 타입 확장 — 내부 함수 contract 변경

- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` `toEiaEvent`
- 상세: 반환 타입이 `EiaEvent | null` 에서 `EiaEvent | ChatChannelInternalEvent | null` 로 확장되었다. 이 함수를 호출하는 모든 지점이 새 union 멤버를 처리해야 한다. 현재 호출자가 동일 파일 내 Dispatcher 에 한정되어 있고, 해당 Dispatcher 가 event.type 기반 discriminated union 분기로 처리한다면 안전하다. spec 파일(`types.ts`)에서 `ChatChannelInternalEvent` 와 `EiaEvent` 가 분리된 union 으로 명확히 구분된 점도 긍정적이다.
- 제안: `toEiaEvent` 함수 시그니처가 외부 모듈에 노출(`export`)되어 있다. 이 함수를 직접 import 해서 사용하는 다른 모듈이 있다면 타입 체크를 통해 변경을 검출할 수 있으나, 명시적인 변경 이력 주석이 이미 달려 있으므로 충분하다.

---

### [INFO] `SUBSCRIBED_EVENTS` 에 `execution.node.completed` 추가 — 이벤트 구독 whitelist 확장

- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` `SUBSCRIBED_EVENTS`
- 상세: 기존 EIA §6.1 5종 화이트리스트(execution.started / ai_message / completed / failed / cancelled) 외에 `execution.node.completed` 가 추가로 구독된다. 이 이벤트는 chat-channel-internal 전용이며 외부 SDK/EIA 화이트리스트에 노출되지 않는다. sub-filter (`PRESENTATION_NODE_TYPES` + `waiting_for_input` 제외)로 presentation 4종 비-blocking 케이스만 처리된다.
- 제안: 이벤트 소스가 in-process Subject(`WebsocketService.executionEvents$`)이므로 외부 API 계약에 직접 영향을 미치지 않는다. 안전하다.

---

### [INFO] renderer 함수 파라미터 타입 확장 (Telegram/Slack/Discord)

- 위치:
  - `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts` `renderTelegramMessages`
  - `codebase/backend/src/modules/chat-channel/providers/slack/slack-message.renderer.ts` `renderSlackEvent`
  - `codebase/backend/src/modules/chat-channel/providers/discord/discord-message.renderer.ts` `renderDiscordEvent`
- 상세: 세 renderer 함수 모두 `event: EiaEvent` 에서 `event: EiaEvent | ChatChannelInternalEvent` 로 파라미터가 확장되었다. TypeScript switch-case 의 `default: return []` 패턴이 유지되어 알 수 없는 이벤트 타입에 대한 안전 fallback 이 보존된다. 새 케이스(`execution.node.completed`) 가 각 renderer 에 동일하게 추가되어 일관성이 있다.
- 제안: 세 renderer 의 `renderPresentationByType` 로직이 사실상 동일한 코드이다(template/carousel/table/chart 처리 로직 중복). API 계약 관점의 문제는 아니나 향후 유지보수 시 세 곳을 동시에 수정해야 하는 부담이 생긴다. shared utility 로 추출을 고려할 수 있다.

---

### [INFO] 문서(MDX) 변경 — API 계약 직접 관련 없음

- 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/` 하위 4개 MDX 파일 (telegram/slack/discord `.en.mdx` + `.mdx`)
- 상세: 사용자 문서에 AI Agent render 도구 / Template 지원 내용이 추가되었다. 외부 HTTP API 엔드포인트 계약이나 요청/응답 스키마에 직접 영향을 주지 않는다.
- 제안: 해당 없음.

---

### [INFO] 리뷰 메타 파일 (consistency review JSON/MD) — API 계약 무관

- 위치: `review/consistency/2026/05/25/16_53_45/` 및 `review/consistency/2026/05/25/17_05_36/` 하위 파일들
- 상세: consistency checker 산출물 파일로 API 계약 변경과 직접 관련 없다.
- 제안: 해당 없음.

---

## 요약

이번 변경은 chat-channel 모듈의 내부 이벤트 처리 확장(비-blocking presentation 노드 outbound 발화)에 집중되어 있으며, 외부 HTTP API 엔드포인트의 URL/경로, 요청 스키마, HTTP 상태 코드, 인증/인가, 페이지네이션 등 전통적인 API 계약 요소에는 변경이 없다. API 계약 관련 변경 사항은 TypeScript 내부 인터페이스 수준에 한정된다. `ChatChannelAdapter.renderNode` 시그니처와 `toEiaEvent` 반환 타입이 확장되었으나 모두 optional/union 확장이고 구현체가 동시에 업데이트되어 하위 호환성이 유지된다. `EiaAiMessageEvent.presentations` 는 optional 필드로 추가되어 기존 소비자에게 breaking change 를 주지 않는다. 전체적으로 API 계약 관점의 리스크가 없는 안전한 변경이다.

---

## 위험도

NONE
