# 동시성(Concurrency) 리뷰

## 발견사항

### 발견사항 1
- **[INFO]** `finalStatus` 변수의 단일 루프 스코프 내 단순 플래그 패턴 — 경쟁 조건 없음
  - 위치: `waitForAiConversation` 내 `let finalStatus: 'COMPLETED' | 'FAILED' = 'COMPLETED'` 및 `while` 루프 (diff +56, +64~66)
  - 상세: `finalStatus` 는 단일 `async` 함수의 단일 `while` 루프 안에서만 쓰이며, Node.js 의 싱글 스레드 이벤트 루프 위에서 동작한다. 루프 바디는 매번 `await` 로 suspension 되고 재개 후 단독 진입하므로 공유 자원 경쟁이 발생하지 않는다. `Promise` 기반 `conversationEnded` / `finalStatus` 동시 갱신도 동일 스택 프레임에서만 이루어진다.
  - 제안: 변경 불필요.

### 발견사항 2
- **[INFO]** `handleAiTurnError` — 동기 반환(non-async), 이벤트 루프 블로킹 여부 점검
  - 위치: `private handleAiTurnError(...)` 메서드 전체 (diff +153~195)
  - 상세: 메서드 시그니처가 `Promise` 를 반환하지 않는 완전한 동기 함수다. 내부에서 `handler.endMultiTurnConversation`, `adaptHandlerReturn`, `applyPortSelection`, `setStructuredOutput`, `setNodeOutput` 을 호출하는데, 이들이 모두 동기라면 문제 없다. 그러나 만약 이 중 하나라도 실제로 비동기(DB I/O, 네트워크)인데 반환값을 `void` 로 삼키면 "fire-and-forget" 버그가 된다. 기존 코드 맥락상 `setStructuredOutput` / `setNodeOutput` 은 in-memory 캐시 쓰기로 보이나, 외부 I/O 가 섞이면 await 누락이 된다.
  - 제안: `endMultiTurnConversation`, `setStructuredOutput`, `setNodeOutput`, `applyPortSelection` 이 동기임을 각 구현에서 확인하고, 향후 이들 중 하나라도 비동기 signature 로 변경될 경우 `handleAiTurnError` 도 `async`/`await` 로 전환해야 함을 TODO 주석으로 명시해 두는 것이 안전하다.

### 발견사항 3
- **[INFO]** `nodeExec.outputData = safe` 직접 mutate — 엔티티 참조 공유 시 일관성 위험 (미미)
  - 위치: `handleAiTurnError` 내 `nodeExec.outputData = safe` (diff +189)
  - 상세: `nodeExec` 객체는 참조로 전달된다. 동일 `nodeExec` 참조를 다른 async 체인이 동시에 읽거나 쓸 가능성은 현재 구조(단일 await chain)상 거의 없지만, 이후 `finalizeAiNode` 의 FAILED 분기에서 `nodeExec.error` 를 추가로 set 하고 `nodeExecutionRepository.save(nodeExec)` 를 호출한다. `handleAiTurnError` 에서의 mutate 와 `finalizeAiNode` 의 save 사이에 await 가 존재하지 않으므로 실질적 경쟁은 없다. 현 코드 흐름에서 안전하다.
  - 제안: 변경 불필요. 코드 주석의 "status / finishedAt / durationMs 는 finalizeAiNode 에서 처리" 설명이 의도를 충분히 문서화한다.

### 발견사항 4
- **[INFO]** `finalizeAiNode` FAILED 분기 — `throw new Error(errorMessage)` 후 호출자 propagation 경로
  - 위치: `finalizeAiNode` 내 `throw new Error(errorMessage)` (diff +353, +355)
  - 상세: 코드 주석에 "sentinel error 를 throw → caller(`waitForAiConversation`) 도 propagate → `runExecution` catch 로 흐른다" 가 명시되어 있다. Node.js async throw 는 rejected Promise 로 변환되어 await 체인을 타고 올라가므로, 이 경로 자체는 올바르다. 다만 `waitForAiConversation` 가 이 throw 를 별도 try/catch 없이 자연 propagate 하는지, 중간에 삼키는 catch 가 없는지는 diff 외부 코드에 의존한다. diff 에서 확인 가능한 범위 내에서는 문제 없다.
  - 제안: `waitForAiConversation` 호출부(`runExecution` 혹은 그 상위)에서 이 throw 를 처리하는 top-level catch 가 존재하는지 통합 테스트로 검증하면 충분하다.

### 발견사항 5
- **[INFO]** `extractAiTurnErrorPayload` 의 `JSON.stringify(rawDetails)` — 이벤트 루프 블로킹 가능성 (이론적)
  - 위치: `private static extractAiTurnErrorPayload` 내 `JSON.stringify` + `JSON.parse` (diff +250~252)
  - 상세: `rawDetails` 가 매우 큰 순환 구조를 포함하면 `JSON.stringify` 가 throw 하거나 블로킹된다. 오류 경로에서만 호출되므로 hot path 가 아니며, LLM 오류 객체의 `details` 가 대용량일 가능성은 낮다. 실질적 위험은 없다.
  - 제안: 방어적으로 `try/catch` 로 감싸 JSON 직렬화 실패 시 `details` 를 `undefined` 로 fallback 하는 것을 고려할 수 있으나 필수 아님.

## 요약

변경 코드의 핵심은 AI Agent 멀티턴 대화 루프(`waitForAiConversation`)에서 핸들러 throw 를 `handleAiTurnError` 로 포착해 `finalStatus='FAILED'` 신호로 루프를 자연 종료시킨 뒤 `finalizeAiNode` 의 FAILED 분기로 위임하는 흐름이다. 이 변경은 Node.js 싱글 스레드 이벤트 루프를 전제로 설계되어 있고, `finalStatus` 변수는 단일 async 함수 내부에서만 순차적으로 읽고 쓰이므로 경쟁 조건·데드락·스레드 안전성 문제는 발생하지 않는다. `handleAiTurnError` 가 동기 함수로 선언되어 있으므로 내부 호출 대상들의 비동기 여부만 지속적으로 검증하면 된다. `await` 누락, 이벤트 루프 블로킹, 공유 자원 오염 등 동시성 관점의 중대한 결함은 발견되지 않았다.

## 위험도

NONE
