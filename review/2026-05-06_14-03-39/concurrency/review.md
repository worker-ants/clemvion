---

### 발견사항

- **[INFO]** 프로바이더 툴 실행이 순차적임 (테스트 설명과 불일치)
  - 위치: `ai-agent.handler.ts` L547–568 (`executeSingleTurn`), L930–955 (`processMultiTurnMessageInner`)
  - 상세: LLM이 한 응답에서 여러 `kb_*` 툴 콜을 동시에 보내도 (`for...await` 루프), 핸들러는 하나씩 순차 실행한다. 테스트 이름(`runs parallel kb_ tool calls`)과 구현 동작이 다르다. Node.js 싱글 스레드 특성상 오류가 발생하진 않지만 멀티 의도 쿼리에서 레이턴시가 불필요하게 누적된다.
  - 제안: 독립적인 KB 툴 콜은 `Promise.all`로 병렬화 가능. 단, `messages` 배열 push 순서 보장이 필요하므로 결과를 모은 후 순서대로 append해야 한다. 혹은 테스트 설명을 실제 동작(sequential)에 맞게 수정하는 것이 최소 조치다.

- **[WARNING]** 싱글턴 핸들러에서 상태를 가진 프로바이더 공유 위험
  - 위치: `ai-agent.handler.ts` L236–250 (`AiAgentHandler` 생성자), L383–396 (`cleanupProviders`)
  - 상세: NestJS DI에서 `AiAgentHandler`는 싱글턴이다. `this.toolProviders` 배열의 인스턴스들 (특히 MCP 프로바이더)이 `executionId`로 격리되지 않은 내부 세션 상태를 가질 경우, 두 실행(execution A, B)이 동시에 `execute()`를 호출하면 동일 프로바이더 인스턴스를 공유하게 된다. `cleanupProviders`는 `executionId`를 인자로 받지만, 프로바이더 내부가 해당 ID로 상태를 격리하지 않으면 cleanup이 다른 실행의 세션을 파괴할 수 있다.
  - 제안: `AgentToolProvider.cleanup({ executionId })`의 구현이 반드시 executionId 범위 내의 리소스만 정리함을 보장해야 한다. 또는 실행마다 새 프로바이더 인스턴스를 생성하는 팩터리 패턴 도입을 검토한다.

- **[INFO]** `buildTools`의 프로바이더 초기화도 순차적
  - 위치: `ai-agent.handler.ts` L1313–1327
  - 상세: 각 프로바이더의 `buildTools()` 호출이 `for...await`로 순차 실행된다. MCP 서버가 여러 개일 경우 각 서버와의 핸드셰이크가 직렬화되어 첫 LLM 호출 전 대기 시간이 커진다.
  - 제안: `Promise.allSettled`로 병렬화 가능. 현재 에러 처리(`try/catch` per provider)도 이미 독립적으로 되어 있어 병렬화에 적합하다.

- **[INFO]** `emitExecutionEvent` fire-and-forget
  - 위치: `ai-agent.handler.ts` L278–282, L342–346
  - 상세: WS 이벤트 emit이 `await` 없이 호출된다. `WebsocketService` 내부에서 오류가 발생해도 핸들러 실행 흐름에 영향을 주지 않는다 (의도된 설계). 다만 emit이 비동기 큐잉 방식이고 cleanup 이전에 완료되지 않으면 이벤트 유실이 발생할 수 있다.
  - 제안: 현재 설계(WS는 best-effort)가 의도적이라면 문제없음. 순서 보장이 필요한 경우에만 `await` 추가를 검토한다.

- **[INFO]** `RagAccumulatorGroup`의 동기적 이중 업데이트 — 안전
  - 위치: `ai-agent.handler.ts` L219–234
  - 상세: `node`와 `turn` 두 accumulator를 동기적으로 같이 업데이트하는 구조다. Node.js 싱글 스레드 환경에서 단일 실행 내에서만 사용되므로 동시성 위험 없음. 불변식 보장 의도가 명확하게 설계되어 있다.
  - 제안: 현 설계 유지.

---

### 요약

전반적으로 코드는 Node.js 싱글 스레드 이벤트 루프 모델에 적합하게 설계되어 있어 로컬 변수(tokens 누적, messages 배열, ragAcc 등)에 대한 실질적인 경쟁 조건은 없다. 주요 동시성 위험은 싱글턴 `AiAgentHandler`가 MCP 등 상태를 가진 프로바이더를 인스턴스 필드로 공유하는 구조에 있으며, 동시 실행 간 cleanup이 서로 간섭할 수 있다는 점이 WARNING 수준의 잠재 위험이다. 또한 복수 KB 툴 콜을 실제로는 순차 실행하면서 테스트 설명이 "parallel"로 되어 있는 불일치는 가독성/유지보수 관점에서 개선이 필요하다.

### 위험도
**LOW**