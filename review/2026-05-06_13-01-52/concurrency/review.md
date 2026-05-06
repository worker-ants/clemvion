### 발견사항

- **[WARNING]** MCP 프로바이더 세션 상태 공유 가능성
  - 위치: `ai-agent.handler.ts:388–401` (`cleanupProviders`), `execute()` finally 블록
  - 상세: `AiAgentHandler`는 NestJS DI 싱글턴으로 등록될 가능성이 높으며 `toolProviders` 배열도 함께 공유된다. MCP 프로바이더가 내부에 세션 상태를 유지하는 구조라면 (`// Sessions held by providers (e.g. MCP) are torn down here` 주석이 이를 암시), 동시에 두 실행이 발생할 경우 요청 A의 `cleanupProviders()` finally 호출이 요청 B가 `buildTools()` → `provider.execute()` 중에 사용 중인 세션을 먼저 해제할 수 있다.
  - 제안: 프로바이더가 세션 상태를 내부에 유지한다면, 실행 단위로 프로바이더 인스턴스를 격리하거나(per-request factory), 세션을 `executionId` 키로 맵핑하여 cleanup 시 해당 executionId의 세션만 제거하도록 설계를 보완할 것.

- **[INFO]** LLM이 동일 응답에 다중 프로바이더 툴을 반환해도 순차 실행됨
  - 위치: `ai-agent.handler.ts:552–573` (single-turn), `939–964` (multi-turn)
  - 상세: `for...of` + `await` 루프로 순차 실행된다. 테스트 이름 `"runs parallel kb_ tool calls when LLM emits multiple in one response"` (spec.ts:260)은 "병렬 호출"이라고 표현하지만, 실제 구현은 직렬이다. 동작 정확성 문제는 없으나, 복수 KB 검색의 경우 `Promise.all`을 사용하면 레이턴시를 절반 이하로 줄일 수 있다.
  - 제안: 성능 개선이 필요하면 프로바이더 툴 실행 루프를 `await Promise.all(classification.providerToolCalls.map(...))` 형태로 리팩토링 고려. `RagAccumulatorGroup`에 대한 동시 접근도 각 call 결과를 모은 뒤 일괄 push하면 안전하게 유지된다.

- **[INFO]** WebSocket 이벤트 fire-and-forget
  - 위치: `ai-agent.handler.ts:283–287, 347–351` (`runProviderTool` 내부)
  - 상세: `emitExecutionEvent()`가 Promise를 반환하더라도 `await` 없이 호출된다. 텔레메트리 이벤트의 특성상 이는 허용 가능한 패턴이지만, 이벤트 순서 보장이 필요한 경우 의도치 않은 역전이 발생할 수 있다.
  - 제안: 현재 용도(디버깅 타임라인 표시)에서는 문제 없음. 순서 보장이 필요해질 경우에만 대응.

---

### 요약

세 파일 전반적으로 동시성 설계는 양호하다. 모든 실행 단위(`executeSingleTurn`, `processMultiTurnMessageInner`)가 로컬 상태만 사용하고, 메시지 배열은 `[...state.messages]`로 복사해 원본 변이를 방지하며, cleanup에 `Promise.allSettled`를 사용하는 등 Node.js 싱글스레드 환경에 맞는 패턴을 따르고 있다. 다만 MCP 프로바이더가 내부 세션 상태를 인스턴스에 유지하는 구조라면, 동시 실행 시 한 요청의 cleanup이 다른 요청의 활성 세션을 해제할 위험이 있으며 이 부분의 설계 의도를 명확히 문서화하거나 세션 격리 메커니즘을 보강할 필요가 있다.

### 위험도
**LOW**