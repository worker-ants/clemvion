# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** WebSocket 페이로드에 `source` 필드 추가 — 하위 호환성 처리 명시적으로 구현됨
  - 위치: `frontend/src/lib/conversation/conversation-utils.ts` L559, L569; `frontend/src/lib/websocket/use-execution-events.ts` L687, L696
  - 상세: `source?: "live" | "injected"` 를 optional로 선언하고, 누락 시 `'live'`로 처리(`isInjected = msg.source === "injected"`)하여 구버전 백엔드 페이로드 및 persisted outputData와의 하위 호환을 보장한다. 테스트 케이스("treats missing source as 'live' for backward compatibility")도 이를 명시적으로 검증하고 있어 계약 준수가 확인된다.
  - 제안: 현재 구현 방향 유지. 다만 해당 필드가 spec에서 안정화된 이후 major 버전 업그레이드 시점에 optional 제거를 검토할 것.

- **[INFO]** LLM provider API 계약 보호 — `source` 필드가 외부 LLM API로 유출되지 않도록 strip 처리
  - 위치: `backend/src/modules/llm/llm.service.ts` L225–231
  - 상세: `source` 필드는 내부 WebSocket 전송용 메타데이터로, LLM provider가 인식하지 못하는 필드다. `map(({ source, ...rest }) => rest)` 로 sanitize된 `ChatParams`를 provider에 전달해 외부 API 계약 위반을 방지한다. `void source` 사용으로 lint unused variable 경고도 억제한다.
  - 제안: 현재 구현 적절. `ChatMessage` 인터페이스의 JSDoc에 "transport-layer metadata — LlmService strips this field"가 명시되어 있어 계약 경계가 명확하다.

- **[INFO]** `ConversationItem.isInjected` 필드 추가 — 프론트엔드 내부 모델 확장
  - 위치: `frontend/src/lib/stores/execution-store.ts` L663
  - 상세: `isInjected?: boolean` 을 optional로 추가하여 기존 `ConversationItem` 소비자에 대한 breaking change 없이 확장한다. 프론트엔드 내부 상태 모델이므로 외부 API 계약에 직접 영향은 없으나, 이 타입이 향후 API 응답으로 직렬화될 경우 관리가 필요하다.
  - 제안: 현재 구현 적절.

- **[WARNING]** WebSocket 이벤트 페이로드의 `source` 필드 타입이 인라인 중복 선언됨
  - 위치: `frontend/src/lib/websocket/use-execution-events.ts` L687 (두 곳: L222–226, L319–323)
  - 상세: `use-execution-events.ts` 내 두 개의 인라인 타입 블록 모두에 독립적으로 `source?: "live" | "injected"` 를 추가했다. 이는 `RawMessage` 인터페이스(`conversation-utils.ts`)와 타입 정의가 분산되어 있음을 의미한다. WebSocket 이벤트 페이로드 타입 정의가 단일 진실(single source of truth) 없이 3곳에 흩어져 있어, 향후 `source` 값이 변경될 경우(예: 세 번째 값 추가) 모든 위치를 동기화해야 하는 계약 드리프트 위험이 있다.
  - 제안: `source?: "live" | "injected"` 를 공유 타입 파일(예: `frontend/src/types/websocket.types.ts` 또는 `conversation-utils.ts` 의 `RawMessage` 익스포트)로 추출하고, `use-execution-events.ts` 의 인라인 타입이 이를 참조하도록 리팩터링한다.

- **[INFO]** 에러 응답 형식 — 이번 변경과 직접 관련 없음
  - 위치: `backend/src/modules/integrations/third-party-oauth.controller.spec.ts` L160–163
  - 상세: 404 응답의 `Content-Type: text/html` 검증 코드에서 타입 캐스팅을 `Record<string, string>`으로 좁혔고, `String(contentType ?? '')` 대신 `contentType ?? ''`를 직접 사용한다. 이는 타입 안전성 개선이며 실제 API 계약에는 영향 없다.
  - 제안: 현재 구현 적절.

## 요약

이번 변경은 WebSocket 프로토콜에 `messages[].source: 'live' | 'injected'` 마커를 도입하는 것으로, API Contract 관점에서 전반적으로 올바르게 설계되었다. 신규 필드를 optional로 선언하고 누락 시 기본값(`'live'`)을 적용하여 구버전 클라이언트 및 persisted 페이로드와의 하위 호환성을 유지했다. LLM provider 외부 API 계약 보호를 위해 `LlmService`에서 `source` 필드를 명시적으로 strip하는 설계도 적절하다. 다만 `source` 필드의 타입 정의가 `conversation-utils.ts`의 `RawMessage`, `use-execution-events.ts`의 인라인 타입 두 곳으로 분산되어 있어, 향후 값 확장 시 계약 드리프트 위험이 존재한다. 이 중복 선언을 공유 타입으로 추출하는 리팩터링을 권장한다.

## 위험도

LOW
