### 발견사항

---

- **[WARNING]** `nodeOutputCache` / `structuredOutputCache` 공유 참조 — 부분 실패 시 잔류 상태
  - 위치: `parallel-executor.ts:59–62`, `execution-engine.service.ts` `runParallel` 호출부
  - 상세: `ParallelExecutor`의 shallow clone은 `nodeOutputCache`와 `structuredOutputCache`를 **동일 객체 참조**로 공유한다. Node.js 단일 스레드 모델에서 서로 다른 key에 대한 동시 쓰기는 안전하지만, Branch A가 중간에 실패할 경우 해당 브랜치가 이미 기록한 `nodeOutputCache` 항목이 남아 있어 이후 main loop의 `gatherNodeInput`에서 잘못된 출력을 읽을 수 있다. 롤백 메커니즘이 없다.
  - 제안: 실패한 브랜치의 노드 ID를 추적하고, `errorPolicy=stop` 시 해당 키를 `nodeOutputCache`에서 제거하거나, 각 브랜치에 독립적인 캐시 레이어를 도입하고 성공 후 병합하는 copy-on-write 패턴 적용.

---

- **[WARNING]** `executedNodes: Set<string>` 공유 뮤테이션 — 플래닝 오류 시 이중 실행
  - 위치: `execution-engine.service.ts` `executeParallelBranchBody` 호출부 (`executedNodes` 인자)
  - 상세: 모든 브랜치가 동일한 `executedNodes` Set을 공유한다. 현재는 `planParallelBody`의 BFS로 각 브랜치 body가 서로소(disjoint)임을 보장하지만, 플래닝 로직 버그나 forward edge 누락 시 두 브랜치가 동일 노드 ID를 `executeNode`로 동시 실행할 수 있다. 이 경우 `executedNodes.has()` 체크 없이 중복 실행될 가능성이 있다.
  - 제안: `executeParallelBranchBody` 진입 시 `plan.bodyNodeIds`와 `executedNodes`의 교집합을 assert하거나, 각 브랜치에 브랜치-로컬 `executedNodes` 뷰(proxy)를 제공하고 완료 후 병합.

---

- **[WARNING]** 통합 테스트의 `setTimeout(200)` — 타이밍 의존적 플래키 테스트
  - 위치: `execution-engine.service.spec.ts:2668` (`await new Promise((r) => setTimeout(r, 200))`)
  - 상세: 병렬 실행 완료를 200ms sleep으로 대기한다. CI 환경에서 느린 실행 시 타임아웃 내에 완료되지 않아 테스트가 간헐적으로 실패할 수 있다. 동일 파일에 이미 `flushPromises()` 헬퍼가 정의되어 있어 사용하지 않을 이유가 없다.
  - 제안: `await new Promise((r) => setTimeout(r, 200))` → `await flushPromises()` (또는 여러 번 호출)로 교체. 비결정적 대기 제거.

---

- **[WARNING]** `appendExecutionPath` 체인 — 실행 종료 전 오류 전파 누락
  - 위치: `execution-engine.service.ts` `appendExecutionPath`, `finally` 블록
  - 상세: 체인 패턴 자체는 JavaScript 단일 스레드 모델에서 정확하다. 그러나 `finally`에서 `await pending.catch(() => undefined)`로 체인을 소비할 때, 체인 중간의 실패(DB write error)가 `catch`로 묵살된다. 그 결과 `executionPath`가 불완전한 상태로 커밋될 수 있으며, 오류가 상위로 전달되지 않아 운영 이슈 추적이 어렵다.
  - 제안: `catch` 내에서 단순히 무시하지 말고 metric/alert로 기록하거나, 실패 시 `executionPath` 불일치를 명시적으로 마킹.

---

- **[INFO]** `PARALLEL_DISPATCHED_PORT` 센티넬 — main loop과의 암묵적 결합
  - 위치: `execution-engine.service.ts:1012–1020`, `PARALLEL_DISPATCHED_PORT` 상수
  - 상세: `runParallel` 이후 `_selectedPort`에 sentinel 값을 주입해 main loop의 `propagateReachability`가 브랜치 에지를 무시하도록 의존한다. `propagateReachability`의 port 필터링 로직이 변경될 경우 이중 실행이 컴파일 오류 없이 발생한다.
  - 제안: `propagateReachability`에 "이미 ParallelExecutor가 처리한 노드" 체크를 `executedNodes` 기반으로 추가해 sentinel에 대한 의존을 보조 안전장치로 격하.

---

- **[INFO]** `waitAll=false` 미구현 — 사용자에게 silent divergence
  - 위치: `execution-engine.service.ts` `runParallel`, `parallel-executor.ts`
  - 상세: `waitAll=false` 설정 시 경고 로그만 출력하고 실제로는 `true`처럼 동작한다. UI(`ParallelConfig`)에서 `waitAll=false` 선택 가능하므로 사용자는 fire-and-forget을 기대하지만 실제로는 차단된다.
  - 제안: UI에서 `waitAll=false` 선택을 비활성화(disabled + tooltip)하거나, 스키마 수준에서 `waitAll: z.literal(true)`으로 강제해 설정 불일치를 사전 차단.

---

### 요약

이번 변경은 JavaScript 단일 스레드 이벤트 루프 모델을 올바르게 이해하고 설계된 병렬 실행 시스템이다. `p-limit` 세마포어, `Promise.allSettled` 기반 합류, promise-chain 직렬화 뮤텍스 모두 단일 스레드 환경에서 의도대로 동작한다. 그러나 `nodeOutputCache`와 `executedNodes`의 공유 참조는 **브랜치 플래닝의 정확성에 전적으로 의존**하며, 플래닝 버그나 부분 실패 시 잔류 상태가 메인 실행 흐름에 영향을 줄 수 있는 구조적 취약점이 존재한다. 타이밍 기반 테스트(`setTimeout(200)`)는 CI 안정성을 저해할 수 있으며 즉시 수정이 권장된다.

### 위험도

**MEDIUM**