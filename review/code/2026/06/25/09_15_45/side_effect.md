# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] 신규 SSE 이벤트 `execution.message` — 기존 구독자 영향 없음
- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` — `ExecutionEventType` enum 추가
- 상세: `EXECUTION_MESSAGE = "execution.message"` 를 enum 에 추가하는 것은 additive 변경이다. 프론트엔드 에디터(`use-execution-events.ts`)는 per-event `socket.on(name)` 구독이라 미등록 이벤트를 자동 무시한다. SSE 표면은 발행만 늘고 기존 구독자는 새 이벤트를 알 필요가 없다. 부작용 없음.
- 제안: 없음.

### [INFO] `PRESENTATION_NODE_TYPES` 모듈 분리 — 공유 상수 도입
- 위치: `codebase/backend/src/common/constants/presentation.ts` (신규), `chat-channel.dispatcher.ts` import 교체
- 상세: 기존 `chat-channel.dispatcher.ts` 에 로컬로 선언된 `const PRESENTATION_NODE_TYPES = new Set<string>(...)` 를 삭제하고 공용 모듈로 이전했다. `ReadonlySet<string>` 타입으로 불변 선언되어 외부에서 mutate 할 수 없다. 모듈 수준 상수라 공유 가변 상태가 아니다. 부작용 없음.
- 제안: 없음.

### [INFO] `execution-engine.service.ts` — 비차단 presentation 노드 완료 시 추가 이벤트 발행
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` ~4571
- 상세: `NODE_COMPLETED` emit 직후 조건부로 `emitExecution(executionId, EXECUTION_MESSAGE, ...)` 가 추가된다. `await` 로 처리되며 기존 `NODE_COMPLETED` 발행 경로는 변경 없다. chat-channel dispatcher 는 `EXECUTION_MESSAGE` 를 구독하지 않으므로 텔레그램 등 외부 채널로의 중복 발화가 없음을 코드상 확인했다. 신규 외부 서비스 호출이나 파일시스템 접근 없음.
- 제안: 없음.

### [INFO] `use-widget.ts` — `apiRef` 에 `newChat` 추가 및 `resetSession` command 처리
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `apiRef` 정의·effect 갱신 + `onCommand` switch 추가
- 상세: `apiRef.current` 객체에 `newChat` 이 추가됐다. `apiRef` 는 컴포넌트 로컬 ref 이므로 전역 상태 변경 없음. `newChat` 은 기존 함수(`closeStream` → `clearSession` → `start`)를 순서대로 호출하는 것으로 추정되며, 이 흐름이 기존 new_chat 버튼 등에서 이미 사용 중인 경로다. `resetSession` command 진입 경로는 host postMessage(`wc:command`)를 통해서만 도달하고, `live-preview.tsx` 가 iframe에 `widgetOrigin` 가드 하에 전송한다 — 임의 iframe이 해당 origin 없이 명령을 발송할 수 없다. 의도치 않은 세션 초기화 경로가 새로 열릴 위험 없음.
- 제안: 없음.

### [INFO] `live-preview.tsx` — `postCommand` 헬퍼 추가 및 새 세션 버튼
- 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx`
- 상세: `postCommand` 는 `widgetOrigin` 이 확보되지 않으면 전송을 건너뛰며(`if (!widgetOrigin) return`), 버튼은 `status !== "ready"` 일 때 비활성이다. `postBoot` 와 동형 보안 패턴을 따른다. 새로운 전역 상태·이벤트 리스너를 등록하지 않는다. `"*"` targetOrigin 을 쓰지 않으므로 cross-origin 메시지 누출 없음.
- 제안: 없음.

### [INFO] `execution.message` — AI_MESSAGE reducer 재사용 시 `text: ""` 처리
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` ~line 186
- 상세: `dispatch({ type: "AI_MESSAGE", text: "", presentations })` 로 text 를 빈 문자열로 설정해 기존 AI_MESSAGE reducer를 재사용한다. 이 설계에서 `text: ""` 인 AI_MESSAGE 와 실제 빈 문자열 AI 응답이 동일 reducer 경로를 탄다. 위젯 렌더러가 `text === ""` 인 경우를 "presentation 전용 말풍선"과 "빈 텍스트 AI 응답"을 동일하게 처리하는지 확인이 필요하다. 단, 빈 텍스트 AI 응답은 실제로 거의 발생하지 않으며 발생해도 `presentations` 필드가 없어 구분 가능한 경우가 대부분이다.
- 제안: 명시적 구분이 필요할 경우 별도 reducer action 타입(`PRESENTATION_MESSAGE`)을 두는 것이 명확하나, 현 코드에서 immediate 부작용은 없다. INFO 수준.

### [INFO] `page.tsx` 2-column 레이아웃 변경 — LivePreview Card sticky 적용
- 위치: `codebase/frontend/src/app/(main)/web-chat/page.tsx` — `WebChatDetail` 반환 JSX
- 상세: `xl:sticky xl:top-6` 클래스가 `LivePreview` 를 감싸는 Card 에 추가됐다. sticky 는 가장 가까운 scroll container 기준이다. 부모가 `overflow: hidden` 등을 갖고 있으면 sticky 가 무력화될 수 있으나, 이는 CSS 레이아웃 동작 문제이며 JS 부작용이 아니다. 기존 컴포넌트 시그니처 변경 없음.
- 제안: 없음.

---

## 요약

이번 변경은 세 가지 독립된 개선(백엔드 SSE 이벤트 신설, 위젯 세션 초기화 command, 콘솔 UI 배치 조정)으로 구성된다. 백엔드는 기존 이벤트 발행 경로에 조건부 additive 이벤트를 추가하는 방식이며, chat-channel(텔레그램 등)은 새 이벤트를 구독하지 않으므로 중복 외부 발화가 없다. 공유 상수 `PRESENTATION_NODE_TYPES` 는 `ReadonlySet` 으로 선언되어 공유 가변 상태 문제가 없다. 프론트엔드는 위젯 내부 ref 에 함수를 추가하고 iframe postMessage 통신에 `widgetOrigin` 가드를 유지한다. 기존 함수/메서드 시그니처 변경, 전역 변수 도입, 파일시스템 부작용, 환경 변수 변경은 발생하지 않는다. `AI_MESSAGE` reducer 재사용 시 `text: ""` 처리가 유일한 의미론적 주의점이나 현 렌더 경로에서 즉각적인 오동작은 없다.

## 위험도

NONE
