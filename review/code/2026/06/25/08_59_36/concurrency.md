# 동시성(Concurrency) 리뷰

## 발견사항

변경 범위: 백엔드 execution-engine 의 `execution.message` 이벤트 추가, 프론트엔드 위젯의 SSE 이벤트 핸들러 확장, `resetSession` postMessage 명령, live-preview iframe 통신.

---

### [INFO] execution.message await 순서 — node.completed 와의 이벤트 순서 보장

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (diff 추가 블록, `if (PRESENTATION_NODE_TYPES.has(node.type))` 분기)
- 상세: `emitExecution(... EXECUTION_MESSAGE ...)` 는 `await` 로 직렬 호출되고, 이어서 기존 `emitNodeEvent(... 'execution.node.completed' ...)` 도 `await` 된다. 같은 JS 이벤트 루프(Node.js 단일 스레드)이므로 두 emit 사이에 인터리빙 위험은 없다. 다만 `execution.message` 가 먼저 발행된 뒤 `execution.node.completed` 가 발행되는 순서가 위젯(클라이언트) 쪽에서 항상 동일하게 도착한다는 보장은 SSE 전송 레이어(TCP 큐)에서는 일반적으로 유지되지만, 네트워크 재전송·버퍼링이 있을 때 순서가 뒤집힐 이론적 가능성이 있다. 현재 위젯은 두 이벤트를 독립적으로 처리하므로 순서 역전이 기능 오류로 이어지지는 않는다.
- 제안: 현재 설계는 문제 없음. 다만 두 이벤트가 동일 SSE 스트림을 통해 전달되고 위젯이 `seq` 필드로 순서를 보정하는 메커니즘을 이미 갖추고 있다면 `ExecutionMessageEvent.seq` 를 실제로 채워 발행하는 것을 검토할 수 있다(현재 diff 에는 `seq` 설정 코드가 없음).

---

### [INFO] resetSession postMessage — 이중 클릭 경쟁 조건(사용자 레벨)

- 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx`, `onClick={() => postCommand("resetSession")}`
- 상세: 버튼에 `disabled={status !== "ready"}` 가이드가 있어 위젯이 준비되지 않은 상태에서의 클릭은 차단된다. 그러나 `newChat()` 이 비동기로 `closeStream → clearSession → start` 를 순차 수행하는 동안 버튼이 다시 활성화되어 있으면, 사용자가 짧은 간격으로 여러 번 클릭해 `newChat()` 이 중첩 실행될 수 있다. 위젯 내부의 `newChat` 이 `closeStream` 으로 기존 스트림을 닫고 새 세션을 시작하는 구조라면 중첩 호출 시 첫 번째 `start` 가 두 번째 `closeStream` 에 의해 즉시 닫힐 수 있다.
- 제안: `newChat` 실행 중에는 버튼을 비활성화하거나 debounce 를 적용한다. 위젯 내부의 `widgetReducer` 가 이미 "executing" 같은 상태를 관리한다면 그 상태와 연동해 버튼 disabled 조건을 확장하는 것이 가장 깔끔하다. 단, iframe 경계를 가로지르는 상태 동기화이므로 추가 postMessage 왕복이 필요하다. 현재 사용 패턴(미리보기 반복 테스트)에서 실질 위험은 낮다.

---

### [INFO] apiRef 갱신과 resetSession 핸들러 — stale closure 안전성

- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (diff, `apiRef` + `case "resetSession"` 추가)
- 상세: `apiRef` 에 `newChat` 을 추가하고, `useEffect(() => { apiRef.current = {..., newChat}; })` 로 매 렌더마다 갱신하는 패턴을 정확히 따르고 있다. `resetSession` 핸들러는 `apiRef.current.newChat()` 을 호출하므로 stale closure 없음. `postMessage` 리스너는 마운트 시 한 번만 등록되며 `apiRef` 를 통해 최신 `newChat` 을 참조하므로 동시성 관점에서 올바른 설계다.
- 제안: 해당 없음. 기존 패턴과 일관성이 있고 안전하다.

---

### [INFO] 단일 스레드 환경의 공유 상수 PRESENTATION_NODE_TYPES

- 위치: `codebase/backend/src/common/constants/presentation.ts`
- 상세: `new Set<string>([...])` 로 모듈 초기화 시 한 번 생성되는 불변 상수다. Node.js 단일 스레드 환경에서 읽기 전용으로만 사용되므로 경쟁 조건이나 동기화 문제가 없다. `chat-channel.dispatcher` 에서 동일 상수의 local 복사본을 삭제(-7줄 diff)하고 공유 상수로 통합한 것도 올바른 방향이다.
- 제안: 해당 없음.

---

## 요약

이번 변경은 Node.js 단일 스레드 + React 단일 이벤트 루프 환경에서 동작하는 코드이므로 전통적인 멀티스레드 경쟁 조건이나 데드락 위험은 없다. `execution.message` 의 `await` 직렬 발행, `apiRef` 패턴을 통한 stale closure 방지, 불변 공유 상수 도입 모두 동시성 관점에서 올바르게 구현됐다. 주목할 부분은 `resetSession` 버튼의 중첩 클릭 경쟁(사용자 레벨 INFO)과 `seq` 미설정으로 인한 이벤트 순서 역전 가능성(INFO)으로, 둘 다 현재 사용 맥락에서 기능 오류로 이어질 가능성은 낮다.

## 위험도

NONE
