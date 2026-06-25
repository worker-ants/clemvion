# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] PRESENTATION_NODE_TYPES 상수 — 소비처 목록 stale 위험
- 위치: `codebase/backend/src/common/constants/presentation.ts` JSDoc
- 상세: JSDoc "단일 출처" 섹션에 두 소비처(execution-engine, chat-channel.dispatcher)가 산문으로 열거됐다. 세 번째 소비처가 추가될 경우 이 목록이 stale 될 수 있다. 현재 두 소비처는 명확히 기록돼 있고 TypeScript import 로 추적 가능하므로 심각하지 않다.
- 제안: 소비처 목록 대신 "모든 소비처는 이 파일을 import 해야 하며 로컬 복사 금지" 형태의 금지 규범 주석으로 교체하면 stale 위험이 원천 제거된다. 현행도 무방.

### [INFO] `execution.message` — spec/5-system/6-websocket-protocol.md 이벤트 카탈로그 갱신 여부 불분명
- 위치: `spec/5-system/14-external-interaction-api.md` §5.2, `plan/in-progress/web-chat-preview-improvements.md` Phase 4 4번 항목
- 상세: plan Phase 4 4번에 "6-websocket-protocol §4.4 이벤트 카탈로그에 execution.message 가 필요하면 동반 추가"라고 조건부 보류로 기술됐으나, 이 PR diff 에 `6-websocket-protocol.md` 변경이 포함되지 않았다. `execution.message` 는 실제로 `ExecutionEventType` enum 에 신설됐으므로 WebSocket 프로토콜 spec 과 구현 간 갭이 발생할 수 있다.
- 제안: `spec/5-system/6-websocket-protocol.md` §4.4 이벤트 카탈로그에 `execution.message` 가 이미 포함됐는지 확인 후, 없으면 이 PR 또는 바로 이어지는 PR 에서 추가한다.

### [INFO] spec payload 예시 — `executionId` 필드 출처 불명
- 위치: `spec/5-system/14-external-interaction-api.md` 신규 `execution.message` payload JSON 블록
- 상세: spec 예시에 `"executionId": "550e8400-..."` 가 포함됐으나, `execution-engine.service.ts` 의 실제 emit 페이로드는 `{ nodeId, nodeType, presentations }` 만 담고 있다. `executionId` 는 `emitExecution(executionId, ...)` 의 라우팅 인자로 별도 전달된다. SSE 어댑터가 envelope 에 `executionId` 를 자동 wrapping 하는지 이 diff 에서 확인되지 않는다.
- 제안: SSE 어댑터(`sse-adapter.service.ts`)의 envelope 포함 여부 확인 후, 포함하지 않으면 payload 예시에서 제거한다. 포함한다면 "SSE envelope 는 `executionId`·`seq`·`timestamp` 를 자동 포함" 주석을 spec 에 추가한다.

### [WARNING] `ParsedMessage` 인터페이스 — `ParsedAiMessage` 와 `presentations` 필드 독립 정의로 drift 위험
- 위치: `codebase/channel-web-chat/src/lib/eia-events.ts` `ParsedMessage` 인터페이스
- 상세: `ParsedMessage.presentations` 와 `ParsedAiMessage.presentations` 는 `Array<Record<string, unknown>>` 로 동일 타입이며 JSDoc 설명도 거의 동일하다("carousel/table/chart/template presentation 페이로드. 빈 배열은 undefined 로 정규화."). 두 인터페이스가 독립 정의돼 있어 향후 presentations shape 이 변경될 때 한쪽만 갱신되는 drift 위험이 있다.
- 제안: 공통 presentations 속성을 `interface PresentationSlot` 같은 공유 타입으로 추출하거나, `ParsedMessage` 가 `Pick<ParsedAiMessage, 'presentations'>` 를 extend 하도록 변경한다. 최소 대안으로 JSDoc 에 "ParsedAiMessage.presentations 와 동일 규약 — 변경 시 양쪽 동기 필요" 크로스레퍼런스 추가.

### [INFO] `resetSession` 명령 — SDK 공개 타입(`ChatInstance`)에 누락, 공개 여부 불명
- 위치: `spec/7-channel-web-chat/2-sdk.md` §3 postMessage 프로토콜, §5 `ChatInstance` 인터페이스
- 상세: §3 에 `resetSession` 명령이 추가되고 상세 설명도 달렸다. 그러나 §5 의 `ChatInstance` 타입(공개 SDK 계약 SoT)에는 `resetSession(): void;` 가 없다. §3 설명 문맥("위젯 내부의 대화 종료 후 새 대화 시작과 동일 동작을 host 가 임의 시점에 트리거")은 공개 API 처럼 읽히지만 타입 계약에서 빠져 있어 공개 여부가 불명확하다.
- 제안: 공개 SDK 메서드로 의도한다면 §5 `ChatInstance` 에 `resetSession(): void;` 추가. 운영 콘솔 내부 전용으로 의도한다면 §3 설명에 "운영 콘솔 내부 전용 — 공개 SDK `ChatInstance` 미노출" 명시.

### [INFO] `live-preview.tsx` `postCommand` — JSDoc 없으나 인라인 주석으로 의도 전달
- 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx` `postCommand` 함수
- 상세: `postCommand` 는 모듈 스코프 함수로 보안 가드(`widgetOrigin` 검사)를 내장하고 `postBoot` 와 대칭적 설계를 가진다. 변경된 코드에 인라인 주석("host→위젯 명령 — 세션 초기화 등…")이 달려 있어 의도는 전달된다. `postBoot` 에 달린 인라인 주석과 동등한 수준이다.
- 제안: 현행 인라인 주석으로 충분. 추가 조치 불필요.

---

## 요약

이번 변경은 전반적으로 문서화 품질이 높다. `PRESENTATION_NODE_TYPES` JSDoc 은 소비처·제외 이유(form 제외 근거)·단일 출처 원칙을 모두 설명하고, `ExecutionEventType.EXECUTION_MESSAGE` enum 멤버 JSDoc 은 이벤트 의미·payload 구조·WS 에러코드와의 혼동 방지까지 커버한다. `eia-events.ts` `parseMessage` 함수와 `ExecutionMessageEvent` 타입도 적절한 JSDoc 을 갖추고 있다. spec 갱신(EIA §5.2, R18, 2-sdk §3, admin-console §6/R7)이 구현과 동일 커밋에 포함되어 spec-impl 동기가 유지됐다. 주요 개선점은 두 가지다: (1) `ParsedMessage` 와 `ParsedAiMessage` 의 `presentations` 필드가 독립 정의되어 향후 drift 위험이 있으므로 공통 타입 추출 또는 크로스레퍼런스 주석 추가가 권장된다. (2) `resetSession` 의 SDK 공개 여부가 §3 설명과 §5 타입 계약 사이에서 모호하여 명확한 내부/공개 분류가 필요하다.

## 위험도

LOW
