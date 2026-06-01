# 동시성(Concurrency) 리뷰 결과

## 발견사항

### **[INFO]** `cancelController.abort()` 의 idempotent 보장 — 올바름

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/parallel-p2-w1w2/codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` L998–L1000
- 상세: `cancelController.signal.aborted` 를 확인한 뒤에만 `abort()` 를 호출함으로써 중복 발화를 막는다. `AbortController.abort()` 자체는 스펙상 idempotent 하지만, 경쟁적 throw 가 동시에 발생하더라도 guard 조건이 있어 불필요한 이벤트 재발화를 억제한다. 현재 구현 정확.
- 제안: 해당 없음.

### **[INFO]** `Promise.allSettled` 완료 후 `failures` 배열 순서 — race-free

- 위치: `parallel-executor.ts` L1008–L1018 (settled 배열 순회)
- 상세: `Promise.allSettled` 는 인덱스 순서를 보존한다. `failures` 가 `settled[i]` 를 순서대로 push 하므로 `failures[0]` 이 항상 인덱스가 가장 낮은 실패다. `cancel-others-on-fail` 의 root-cause 선택(`failures.find(f => f.error.name !== 'AbortError')`)은 AbortError 이전의 실제 실패를 올바르게 우선한다. 구현 정확.
- 제안: 해당 없음.

### **[INFO]** upstream abort cascade listener cleanup — 올바름

- 위치: `parallel-executor.ts` L943–L957 (cancelController + upstreamSignal 연결 구간)
- 상세: upstream signal 에 등록한 `onUpstreamAbort` listener 를 cancelController.signal 의 `abort` 이벤트에서 제거한다. 양방향 구독 정리가 이루어지므로 listener 누수가 없다. `{ once: true }` 옵션 사용으로 단일 발화도 보장된다.
- 제안: 해당 없음.

### **[INFO]** `variables` deep clone + cache shallow copy 격리 — 적절

- 위치: `parallel-executor.ts` L973–L983 (branchContext 구성 구간)
- 상세: 코드 주석(WARN #14, INFO #9)이 설계 의도를 명확히 기술하고 있다. `variables` 는 `structuredClone` 으로 완전 격리, `nodeOutputCache` / `structuredOutputCache` 는 키 충돌이 spec 상 불가능하다는 invariant 하에 shallow copy 사용. 현재 spec 제약 내에서 타당한 절충.
- 제안: invariant(배타적 nodeId 집합) 가 향후 sub-workflow 중첩 시 깨질 가능성을 INFO #9 주석에서 이미 인식하고 있음. 해당 시점에 deep clone 전환 필요.

### **[INFO]** `llmDefaultConfigCache` 단일 비행(single-flight) 패턴 — 올바름

- 위치: `execution-engine.service.ts` L1717 (`llmDefaultConfigCache`)
- 상세: `Promise<boolean>` 를 캐시해 동일 키 동시 호출 시 DB 단 1회 조회. Node.js 단일 이벤트 루프 환경에서 Map 읽기·쓰기는 원자적이므로 별도 락 불필요. `runExecution` finally 에서 executionId prefix 항목 일괄 삭제로 메모리 누수 방지. 구현 정확.
- 제안: 해당 없음.

### **[INFO]** `execute` 메서드 시그니처 변경 (`parentParallelConcurrency?: number` → `number | undefined`) — 동시성 안전성 영향 없음

- 위치: `parallel-executor.ts` L894 (시그니처 변경)
- 상세: optional parameter 를 explicit `number | undefined` 로 바꾼 변경은 타입 강제만 목적이며 런타임 동작 변화 없다. 기존 호출처가 `undefined` 를 명시적으로 전달하도록 강제함으로써 중첩 Parallel 의 clamp 로직 누락 회귀를 컴파일 타임에 잡는 안전 장치다.
- 제안: 해당 없음.

### **[INFO]** 테스트의 `currentRunning` / `maxRunning` 공유 변수 — 단일 이벤트 루프 내 안전

- 위치: `parallel-executor.spec.ts` L403–L444 (maxConcurrency 검증 테스트), `parallel-p2-integration.spec.ts` L162–L186 (nested clamp 테스트)
- 상세: `currentRunning++` / `currentRunning--` 같은 복합 연산은 멀티스레드 환경에서 경쟁 조건이 되지만, Node.js 는 단일 이벤트 루프 + 협력적 멀티태스킹이다. `await` 경계(microtask/macrotask 전환) 가 유일한 양보 지점이며 두 줄의 `++` / `--` 사이에는 `await` 가 없으므로 중간 값 관측은 불가능하다. 테스트 신뢰도 유지됨.
- 제안: 해당 없음.

---

## 요약

이번 변경의 핵심은 (1) `ParallelExecutor.execute` 의 `parentParallelConcurrency` 파라미터를 optional에서 `number | undefined` 명시 필수로 바꿔 중첩 Parallel의 silent-clamp 누락을 컴파일 타임에 차단하고, (2) `cancel-others-on-fail` 정책에서 AbortController를 통해 분기 abort를 올바르게 전파하는 구현이다. 공유 자원 접근 (`variables` deep clone, cache shallow copy, abort 이벤트 리스너 정리) 모두 Node.js 단일 이벤트 루프 모델에 맞게 적절히 처리되어 있다. 경쟁 조건·데드락·동기화 누락·await 오용 등 실질적인 동시성 결함은 발견되지 않았다.

## 위험도

NONE
