# 동시성(Concurrency) 코드 리뷰

## 발견사항

### 파일 5: backend/src/modules/llm/llm.service.ts — `source` 필드 스트립 로직

- **[INFO]** `sanitized` 객체 생성 후 `params.messages` 원본 배열은 변경되지 않음 — 안전
  - 위치: `llm.service.ts` diff @@ -80+18 (`sanitized` 블록)
  - 상세: `params.messages.map(({ source, ...rest }) => rest)` 는 새 배열을 반환하고 원본 `params.messages` 를 변경하지 않는다. 호출 스택의 다른 경로(WebSocket emit 등)가 동일 `params` 참조를 공유하더라도 경쟁 조건이 발생하지 않는다.
  - 제안: 현재 구현 유지. 변경 사항 없음.

### 파일 2: backend/src/modules/execution-engine/execution-engine.service.ts — `withSourceMarker`

- **[INFO]** `withSourceMarker` 는 순수 함수(pure function)로 공유 상태를 참조하지 않음
  - 위치: `execution-engine.service.ts` diff @@ -271+28 (`withSourceMarker` 함수 전체)
  - 상세: 입력 배열을 `map` 으로 새 배열로 변환하며 입력을 변이(mutate)하지 않는다. 동시 호출이 발생해도 각 호출이 독립된 클로저 범위를 가지므로 경쟁 조건 위험 없음. `as const` 캐스팅도 읽기 전용 리터럴 타입 힌트일 뿐 런타임 동기화 의미는 없으나 문제없다.
  - 제안: 현재 구현 유지.

### 파일 6: backend/src/nodes/ai/ai-agent/ai-agent.handler.ts — `mapTurnsToChatMessages`

- **[INFO]** `readonly` 입력 배열 + 새 `ChatMessage` 객체 반환 — 불변성 보장
  - 위치: `ai-agent.handler.ts` diff @@ -294+50 (`mapTurnsToChatMessages` 함수)
  - 상세: `turns: readonly ConversationTurn[]` 를 받아 `turns.map(...)` 으로 새 배열을 반환한다. 원본 `turns` 를 변이하지 않으며, 반환된 배열의 각 원소도 스프레드/리터럴로 새로 생성된다. 병렬 실행 컨텍스트에서도 안전하다.
  - 제안: 현재 구현 유지.

### 파일 9: frontend/src/lib/conversation/conversation-utils.ts — `messagesToConversationItems` 루프 내 상태 갱신

- **[INFO]** 단일 스레드(이벤트 루프) 환경에서의 루프 내 가변 변수 사용 — 구조 적절
  - 위치: `conversation-utils.ts` diff @@ -75+37 (for 루프 내 `currentTurn`, `assistantIdxInTurn`)
  - 상세: `currentTurn` 과 `assistantIdxInTurn` 은 함수 로컬 변수로 선언되어 있고, 이 함수는 동기 루프 안에서만 변경된다. JavaScript/TypeScript 단일 스레드 모델에서는 동일 함수 실행이 인터리브되지 않으므로 경쟁 조건 없음. `isInjected` 분기에 따라 `currentTurn` 증가를 조건부로 처리하는 변경도 논리적으로 일관된다.
  - 제안: 현재 구현 유지.

### 파일 11: frontend/src/lib/websocket/use-execution-events.ts — 인라인 타입 중복 선언

- **[INFO]** 두 곳(diff @@ -222, @@ -317)에 동일한 인라인 타입 블록이 별도로 선언됨
  - 위치: `use-execution-events.ts` diff @@ -222+8 및 @@ -317+8
  - 상세: 동시성 문제는 없다. 다만 `source?: "live" | "injected"` 필드가 두 개의 분리된 인라인 타입 블록에 중복 선언되어, 향후 타입 변경 시 한 곳만 수정하는 실수 가능성이 있다. 공유 `RawMessage` 인터페이스나 import 를 사용하면 중복이 제거된다.
  - 제안: 이미 `frontend/src/lib/conversation/conversation-utils.ts` 에 `RawMessage` 인터페이스가 정의되어 있으므로, `use-execution-events.ts` 의 인라인 타입을 해당 인터페이스 import 로 교체하는 것을 검토.

---

## 요약

이번 변경은 WebSocket 페이로드의 `source: 'live' | 'injected'` 마커를 backend-to-frontend 전 계층에 도입하는 작업이다. 동시성 관점에서 핵심 변경 사항인 `withSourceMarker`, `mapTurnsToChatMessages`, `sanitized` 생성, `messagesToConversationItems` 루프 수정 모두 순수 함수 또는 로컬 불변 변환으로 구현되어 있어 공유 가변 상태를 도입하지 않는다. async/await 변경도 없고, 이벤트 루프를 블로킹하는 동기 I/O나 과도한 계산도 없다. 발견된 INFO 2건 중 `use-execution-events.ts` 의 인라인 타입 중복은 유지보수 부채이지만 런타임 동시성 위험은 아니다. 전반적으로 동시성 측면의 위험 요소는 없다.

## 위험도

NONE
