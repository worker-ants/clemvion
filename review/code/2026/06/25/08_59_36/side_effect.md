# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] PRESENTATION_NODE_TYPES — 모듈-레벨 Set 객체 (변경 불가 상수)
- 위치: `codebase/backend/src/common/constants/presentation.ts` L74
- 상세: `new Set<string>([...])` 는 모듈 로드 시 1회 생성되는 불변 상수다. `const` 선언이고 외부에서 `.add()`/`.delete()` 를 직접 호출할 수 있으나, 현재 소비처(execution-engine, chat-channel.dispatcher) 는 `.has()` 읽기만 사용한다. 실질 변경 위험 없음. TypeScript `ReadonlySet<string>` 으로 선언하면 타입 수준에서 돌연변이를 방지할 수 있다.
- 제안: 선택적 개선 — `export const PRESENTATION_NODE_TYPES: ReadonlySet<string> = new Set([...])` 로 타입 강화. 현재 동작에는 영향 없다.

---

### [INFO] chat-channel.dispatcher.ts — 로컬 Set 제거, 공유 상수로 교체
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` diff L159-165
- 상세: 기존 로컬 `PRESENTATION_NODE_TYPES` Set 이 삭제되고 공용 import 로 대체됐다. 동일 4-원소 집합(`carousel`, `table`, `chart`, `template`)을 유지하므로 dispatcher 의 필터 동작은 불변이다. 상태 변경이나 동작 차이 없음.
- 제안: 없음.

---

### [INFO] ExecutionEventType enum 신규 값 추가 — SSE/WS 표면 확장
- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` L442
- 상세: `EXECUTION_MESSAGE = 'execution.message'` 가 추가됐다. TypeScript enum 은 추가 값이 기존 switch 문에 자동으로 영향 주지 않으므로 기존 소비처가 영향받지 않는다. 커밋 메시지에서도 확인된 대로 프론트엔드 `use-execution-events.ts` 는 `socket.on(name)` per-event 구독 방식이라 미등록 이벤트를 무시한다. SSE 어댑터는 필터 없이 전달하므로 새 이벤트가 SSE 스트림에 노출되나, 이는 의도된 additive 확장이다. WS 에러코드 `EXECUTION_MESSAGE_TOO_LONG` 과의 네임스페이스 충돌은 JSDoc 으로 명시 구분됐고 실제 충돌 없음.
- 제안: 없음.

---

### [INFO] execution-engine.service.ts — 비차단 분기에 await 이벤트 발행 추가
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L4571
- 상세: `if (PRESENTATION_NODE_TYPES.has(node.type))` 조건으로 `emitExecution` 을 `await` 한다. 이 호출은 기존 `NODE_COMPLETED` emit 직후에 위치한다. `emitExecution` 이 실패하는 경우 예외가 전파돼 엔진 실행이 중단될 수 있으나, `emitExecution` 은 이미 기존 코드에서 `await` 로 사용 중이어서 에러 처리 패턴이 동일하다. presentation 이 아닌 노드에는 실행 경로 변경이 없다.
- 제안: 없음.

---

### [INFO] use-widget.ts — apiRef 에 newChat 추가
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L1124-1128
- 상세: `apiRef` 객체에 `newChat` 이 추가됐다. 이 패턴은 기존 `open`, `close` 등과 동일한 stale-closure 회피 패턴이다. `newChat` 자체가 `closeStream -> clearSession -> start` 순서를 실행하는 함수로, 실행 시 localStorage 세션 데이터가 지워지고 새 SSE 연결이 시작된다. 이 동작은 의도된 것이며, `resetSession` 명령 경로로만 트리거된다.
- 제안: 없음.

---

### [INFO] use-widget.ts — execution.message 핸들러 dispatch
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L1111-1116
- 상세: `name === "execution.message"` 분기에서 `parseMessage` 를 호출하고 `presentations` 가 있을 때만 `dispatch({ type: "AI_MESSAGE", text: "", presentations })` 를 수행한다. `text: ""` 로 AI_MESSAGE reducer 를 재사용하므로 기존 텍스트 렌더 경로에 빈 문자열이 삽입된다. 빈 문자열로 인한 의도치 않은 공백 말풍선이 표시되지 않으려면 AI_MESSAGE reducer 가 `text === ""` 일 때 텍스트 렌더를 생략해야 한다. 기존 `ai_message` 에서 message 필드가 없을 때 `ev.message ?? ""` 로 처리하는 패턴이 이미 존재하므로, presentations-only 렌더가 기존부터 지원됐을 가능성이 높다.
- 제안: 소비처 widgetReducer 의 AI_MESSAGE 케이스가 `text === ""` 일 때 텍스트 렌더를 생략하는지 확인. 이미 지원하는 경우 문제 없다. INFO 수준.

---

### [INFO] live-preview.tsx — postCommand: postMessage 타겟 origin 보안
- 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx` L1797-1806
- 상세: `postCommand` 는 `widgetOrigin` 이 없을 때 전송을 건너뛰는 보안 가드를 포함하며, `postBoot` 와 동형으로 구현됐다. `"*"` 와일드카드 대신 `widgetOrigin` 을 target origin 으로 명시해 보안 요건을 충족한다. 의도치 않은 부작용 없음.
- 제안: 없음.

---

### [INFO] EiaEventName 유니언 타입 확장
- 위치: `codebase/channel-web-chat/src/lib/eia-types.ts` L892
- 상세: `"execution.message"` 가 `EiaEventName` 유니언에 추가됐다. 이는 순수 타입 추가로 런타임 동작에 영향 없다. 기존 switch 문이 있을 경우 exhaustive check 에서 신규 케이스를 요구할 수 있으나, 위젯의 handleEiaEvent 는 `if/else if` 체인이어서 컴파일 에러가 발생하지 않는다.
- 제안: 없음.

---

### [INFO] page.tsx — 레이아웃 변경은 순수 UI 재배치
- 위치: `codebase/frontend/src/app/(main)/web-chat/page.tsx` L1219-1250
- 상세: `<Card>` 세 개를 `xl:grid-cols-[...]` grid 안에 재배치한 것으로 상태/이벤트/API 호출 변경 없음. `LivePreview` 컴포넌트 인스턴스는 동일 props(`endpointPath`, `draft`)로 렌더된다.
- 제안: 없음.

---

## 요약

이번 변경은 execution-engine 의 비차단 분기에 `execution.message` 이벤트를 신규 추가(additive SSE 확장), 공유 상수 모듈 도입으로 중복 정의를 제거, 위젯에 `execution.message` 수신 핸들러와 `resetSession` 명령 경로를 추가, 프론트 콘솔에 세션 초기화 버튼과 2-column 레이아웃을 적용하는 변경이다. 전역 변수 도입 없음, 파일시스템 부작용 없음, 네트워크 호출 변경 없음, 환경 변수 읽기/쓰기 변경 없음. 공개 API 관점에서 `ExecutionEventType` enum 에 신규 값이 추가되고 `EiaEventName` 유니언이 확장됐으나 모두 additive 이며 기존 소비처가 per-event 구독 또는 if/else 체인으로 동작해 exhaustive 파단이 발생하지 않는다. `chat-channel.dispatcher.ts` 의 로컬 Set 이 공용 상수로 교체됐으나 동일 집합을 유지해 동작 불변이다. `use-widget.ts` 의 `resetSession` 핸들러가 localStorage 세션 데이터를 지우는 부작용이 있으나 이는 명시된 의도다. 전반적으로 의도치 않은 부작용은 발견되지 않았다.

## 위험도

NONE
