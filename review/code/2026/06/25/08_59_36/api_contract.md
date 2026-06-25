# API 계약(API Contract) 리뷰 결과

## 발견사항

### **[INFO]** `execution.message` 신규 SSE 이벤트 — additive(비파괴) 추가, 하위 호환성 유지
- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` `ExecutionEventType.EXECUTION_MESSAGE`
- 상세: 기존 `execution.node.completed` firehose 는 그대로 유지하고 presentation 4종 한정으로 새 이벤트를 추가 발행하는 additive 방식이다. 기존 클라이언트가 미지의 이벤트명을 무시하는 정상적인 구현이라면 breaking change 없음. chat-channel(텔레그램 등)은 `node.completed`를 별도 픽업하므로 중복 발화 없음이 코드에서 확인된다.
- 제안: 해당 없음 (설계 의도대로 구현됨).

### **[INFO]** `ExecutionMessageEvent` 타입 정의 — 모든 필드 optional
- 위치: `codebase/channel-web-chat/src/lib/eia-types.ts` `ExecutionMessageEvent` 인터페이스
- 상세: `nodeId`, `nodeType`, `presentations`, `seq` 가 모두 optional(`?`)이다. 백엔드 엔진이 실제 발행 시 `nodeId`·`nodeType`·`presentations` 를 필수 포함하는데 타입 계약은 이를 강제하지 않는다. `parseMessage` 함수도 `presentations` 누락 시 `undefined` 반환으로 정규화하므로 런타임 안전성은 있으나, 타입 수준의 계약 명확성이 낮다.
- 제안: 백엔드가 항상 포함하는 `nodeId`, `nodeType` 을 required 필드로 선언하면 클라이언트 소비 코드에서 타입 가드 없이 접근 가능하고 계약 위반을 컴파일 타임에 감지할 수 있다. 단, 현재 `parseMessage` 구현이 방어적으로 처리하므로 런타임 위험은 없다.

### **[INFO]** `wc:command` postMessage 계약 — payload 스키마 명시 없음
- 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx` `postCommand` 함수
- 상세: `{ type: "wc:command", payload: { action } }` 형태로 전송하며, 수신 측(`use-widget.ts`)에서 `cmd.action === "resetSession"` 분기로 처리한다. postMessage 계약이 `eia-types.ts` 의 공식 타입 외부에 존재하며, `action` 의 허용 값이 타입으로 정의되지 않아 문자열 오타 시 런타임에야 발견된다.
- 제안: `wc:command` payload 를 discriminated union 타입(`type WcCommandAction = "resetSession" | ...`)으로 선언해 발신·수신 양단이 같은 타입을 공유하면 계약 드리프트를 방지할 수 있다. 현재 범위(단일 action)에서는 위험도가 낮으나, action 종류가 증가할수록 관리 필요성이 커진다.

### **[INFO]** `presentations` envelope 스키마 — `Record<string, unknown>` 로 완전히 열려 있음
- 위치: `codebase/channel-web-chat/src/lib/eia-types.ts` `ExecutionMessageEvent.presentations`, `AiMessageEvent.presentations`
- 상세: `presentations` 배열 원소 타입이 `Record<string, unknown>` 이다. 백엔드가 `{ config, output }` 구조를 발행하고 위젯 `classifyPresentation`이 이를 소비하지만 타입 계약에 반영되지 않는다. AI render_* 와 presentation 노드 양 경로가 같은 열린 타입을 공유하므로 스키마 불일치를 컴파일 타임에 감지할 수 없다.
- 제안: `{ config: Record<string, unknown>; output: Record<string, unknown> }` 최소 구조 타입 선언을 권장한다. 단, 기존 AI render_* 경로도 동일 타입을 사용하므로 변경 범위가 넓어 별도 작업으로 처리 가능하며 현재 변경의 blocking 이슈는 아니다.

## 요약

이번 변경은 `execution.message` SSE 이벤트를 additive 방식으로 추가하고, `wc:command "resetSession"` postMessage 계약을 신설한다. 기존 클라이언트 및 chat-channel 어댑터에 대한 하위 호환성은 설계와 코드 모두에서 명확히 유지되며, 신규 이벤트의 응답 구조(`presentations: [{config, output}]`)는 기존 AI render_* 경로와 동일한 위젯 렌더 경로를 재사용해 일관성을 확보하고 있다. 에러 응답·인증·URL/경로·페이지네이션 변경은 해당 없다. 타입 계약이 다소 열려 있어(optional 필드, `Record<string, unknown>` presentations) 컴파일 타임 안전성이 낮지만, 런타임 방어 처리(`parseMessage` 정규화)와 단위 테스트가 이를 보완하고 있다. Critical/Warning 이슈 없음.

## 위험도

NONE
