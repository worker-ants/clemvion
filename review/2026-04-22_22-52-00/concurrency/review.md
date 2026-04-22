### 발견사항

- **[INFO]** `expressionReferenceCache` 모듈 스코프 뮤터블 변수
  - 위치: `system-prompt.ts:28` — `let expressionReferenceCache: string | null = null`
  - 상세: 모듈 단위 공유 상태이나, `getExpressionReferenceSection()`이 순수 동기 함수이고 Node.js는 단일 이벤트 루프 스레드로 동작하므로 check-then-set 사이에 선점(preemption)이 발생하지 않아 실질적 경쟁 조건은 없음. 단, 미래에 `worker_threads`를 도입하거나 동일 모듈을 여러 Worker에서 공유하는 경우에는 두 Worker가 동시에 `null`을 보고 각자 캐시를 초기화하는 benign race가 발생할 수 있음.
  - 제안: 현재 아키텍처에서는 변경 불필요. Worker 도입 시 `Atomics` 기반 잠금 또는 초기화 로직을 NestJS 모듈 `onModuleInit`으로 이동하여 Worker 생성 전에 한 번만 실행되게 할 것.

- **[INFO]** `assistantText.replace(leak.matched, '')` — 첫 번째 발생만 제거
  - 위치: `workflow-assistant-stream.service.ts` leak 복구 블록
  - 상세: `String.prototype.replace(string, '')`는 첫 번째 일치만 제거함. `recoverLeakedPlan`이 반환하는 `matched`도 텍스트에서 첫 번째로 발견된 블록이므로 동작은 올바름. 그러나 동일 JSON 블록이 두 번 이상 등장하면 두 번째 이후는 잔류함. 동시성 문제는 아니나 엣지 케이스 동작으로 기록.
  - 제안: 명시적으로 `indexOf`로 위치를 특정하거나, 주석으로 "intentionally removes only the first occurrence" 정도를 추가해 미래 독자의 혼동을 방지.

- **[INFO]** `streamMessage` async generator 내 로컬 상태 — 안전
  - 위치: `workflow-assistant-stream.service.ts:streamMessage`
  - 상세: `assistantText`, `pendingToolCalls`, `planForTurn`, `guardState` 등 모든 가변 상태가 호출별 스택 로컬 변수로 선언됨. NestJS는 요청별로 독립된 Promise 체인을 실행하므로 서로 다른 세션 간 공유 없음. `WorkflowAssistantStreamService` 인스턴스 자체에도 뮤터블 인스턴스 필드 없음.

- **[INFO]** `recoverLeakedPlan` 이벤트 루프 블로킹 잠재성
  - 위치: `recover-leaked-plan.ts:recoverLeakedPlan`
  - 상세: O(n) brace 스캔이지만 `{`마다 새 스캔을 시작하는 구조라 worst-case O(n²). 정상 LLM 출력 규모(수 KB)에서는 무시 가능하나, 매우 큰 텍스트가 입력되면 이벤트 루프를 짧게 블로킹할 수 있음. 동시성 버그는 아니며 처리량 관점의 주의사항.
  - 제안: 입력 길이 상한을 호출 전에 적용하거나, 이미 `assistantText`가 LLM 출력 제한에 묶여 있다면 현재 구현으로 충분.

---

### 요약

변경된 코드는 동시성 측면에서 전반적으로 안전하다. 핵심 복구 로직(`recoverLeakedPlan`)은 완전한 순수 함수이고, 스트림 서비스의 모든 가변 상태는 요청별 로컬 변수로 격리되어 있어 동시 요청 간 공유 자원 충돌이 없다. 유일한 모듈 스코프 공유 상태(`expressionReferenceCache`)는 Node.js 단일 스레드 보장 하에 안전하며, 계산 결과가 결정론적이어서 중복 초기화가 발생하더라도 동일한 값이 기록되는 benign race에 불과하다. 현재 배포 환경에서 실질적인 동시성 위험은 없다.

### 위험도

**LOW**