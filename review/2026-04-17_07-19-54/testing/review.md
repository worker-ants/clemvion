## 발견사항

### [CRITICAL] integration test에서 `flushPromises()` 대신 `setTimeout(r, 200)` 사용
- 위치: `execution-engine.service.spec.ts:2643` (`await new Promise((r) => setTimeout(r, 200))`)
- 상세: 파일 상단에 `flushPromises()` 헬퍼가 이미 정의되어 있음에도, 병렬 실행 완료 대기에 200ms 타이머를 사용. CI 환경의 리소스 압박이나 느린 실행 시 flaky test가 될 수 있음.
- 제안: `await new Promise((r) => setTimeout(r, 200))` → `await flushPromises()` 또는 서비스 execute 반환값을 직접 await

### [CRITICAL] `mockConfigService.get` 테스트 간 상태 누수
- 위치: `execution-engine.service.spec.ts:2572-2581` (Parallel 테스트 블록)
- 상세: `mockConfigService.get.mockImplementation(...)` 으로 `PARALLEL_ENGINE=v1` 오버라이드 후 `afterEach` 또는 `mockRestore()`로 복원하는 코드 없음. 이 테스트 이후에 실행되는 다른 테스트들이 의도치 않게 `PARALLEL_ENGINE=v1` 상태에서 실행될 위험이 있음.
- 제안: 해당 `it()` 블록 내 `afterEach`나 `beforeAll/afterAll`에 `mockConfigService.get.mockReset()` 추가

### [CRITICAL] `parallel-executor.spec.ts` maxConcurrency 타이밍 의존 테스트
- 위치: `parallel-executor.spec.ts:58-87` (`should respect maxConcurrency limit`)
- 상세: `await new Promise((r) => setTimeout(r, 10))` 으로 2개의 branch가 시작됐는지 확인하는 방식은 Node.js 이벤트 루프 타이밍에 의존. 10ms 이내에 p-limit 스케줄링이 완료되지 않으면 `expect(running).toBe(2)` 실패. 특히 GitHub Actions 등 공유 CI 환경에서 flaky.
- 제안: barrier를 이용해 "2개가 동시에 pending 상태임"을 명시적으로 확인하는 카운터 기반 방식으로 대체

### [WARNING] `MergeHandler` timeout/partialOnTimeout 경고 로직 테스트 누락
- 위치: `merge.handler.ts:47-63` (새로 추가된 warning 블록)
- 상세: `timeout > 0`일 때 Logger.warn이 호출되고, `partialOnTimeout === true`일 때도 Logger.warn이 호출되는 로직이 추가됐으나, 이를 검증하는 단위 테스트가 없음. merge.handler.spec.ts (기존 파일)에 해당 케이스가 없거나 새로 추가되지 않음.
- 제안: `timeout: 30`과 `partialOnTimeout: true` config 케이스를 포함하는 테스트 추가, Logger.warn 호출 여부 spy로 검증

### [WARNING] `planParallelBody` 복잡 로직 단위 테스트 부재
- 위치: `execution-engine.service.ts:2849-3062` (`planParallelBody` 메서드)
- 상세: BFS 기반 branch body 분리, back-edge 감지(`PARALLEL_BACK_EDGE`), 중첩 parallel 거부(`PARALLEL_NESTED_NOT_SUPPORTED`), blocking node 거부(`PARALLEL_INVALID_CHILD`)를 처리하는 200+ 라인의 복잡한 private 메서드에 대한 직접 테스트 없음. 통합 테스트 1개로는 이 로직의 분기를 모두 커버하기 어려움.
- 제안: `planParallelBody`를 별도 모듈/유틸로 추출하거나, 서비스 테스트에 back-edge 시나리오, nested parallel 시나리오, blocking node 시나리오를 각각 테스트로 추가

### [WARNING] `appendExecutionPath` 직렬화 로직 테스트 부재
- 위치: `execution-engine.service.ts:1163-1190` (`appendExecutionPath` 메서드)
- 상세: 병렬 branch들이 동시에 실행 경로를 append할 때의 race condition을 방지하기 위한 promise-chaining 기반 뮤텍스가 추가됐으나, 실제로 concurrent write 시 데이터 무결성이 보장되는지 검증하는 테스트 없음.
- 제안: 2~3개의 branch가 동시에 `appendExecutionPath`를 호출하는 시나리오에서 `executionPath`에 중복 없이 모든 nodeId가 기록되는지 검증하는 테스트 추가

### [WARNING] `errorPolicy=stop` 케이스의 integration test 누락
- 위치: `execution-engine.service.spec.ts` (Parallel 테스트 블록)
- 상세: `PARALLEL_ENGINE=v1` 통합 테스트가 정상 실행 케이스 1개만 존재. branch 실패 시 `ExecutionStatus.FAILED`로 완료되는지, errorPolicy가 올바르게 작동하는지 검증하는 케이스 없음.
- 제안: `branchHandler`에서 throw하는 케이스 추가, `mockExecutionRepo.save`가 `{ status: ExecutionStatus.FAILED }`로 호출되는지 검증

### [WARNING] `waitAll=false`의 현재 동작 명시적 테스트 부재
- 위치: `parallel-executor.spec.ts`, `parallel.handler.ts`
- 상세: `waitAll=false`는 Phase P2로 예정된 기능이고 현재 항상 `waitAll=true`처럼 동작함. `ParallelExecutor`가 `waitAll` 필드를 실제로 읽지 않고 무시하는데(`effectiveConcurrency` 계산에도 사용 안 함), 이를 명시적으로 검증하는 테스트 없음.
- 제안: `waitAll=false`로 전달해도 모든 branch가 settle될 때까지 대기하는지 검증하는 테스트 추가

### [WARNING] 프론트엔드 `parallelBranchPorts` 테스트 누락
- 위치: `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts:23-32`
- 상세: `parallelBranchPorts` 함수와 `resolveDynamicPorts`의 `parallel-branches` 케이스가 추가됐으나, 프론트엔드 단위 테스트(spec) 없음. `branchCount=NaN`, 소수, 범위 초과 값 처리가 올바른지 검증 불가.
- 제안: `resolve-dynamic-ports.spec.ts`에 `parallel-branches` 케이스 테스트 추가

### [INFO] `errorPolicy=continue`로 모든 branch 실패 시 케이스 누락
- 위치: `parallel-executor.spec.ts`
- 상세: 1개 branch 실패 케이스만 존재. 모든 branch가 실패하는 경우 `failures.length === branchCount`이고 `settled`에서 `fulfilled`가 0인지 검증하는 테스트 없음.
- 제안: `branchCount: 3`이고 모든 branch throw하는 케이스 추가

### [INFO] `parallel-executor.spec.ts`에서 `maxConcurrency=0` 실제 동시 실행 미검증
- 위치: `parallel-executor.spec.ts:15-32`
- 상세: 첫 번째 테스트는 `calls`에 index가 모두 쌓이는지만 확인. 실제로 동시 실행됐는지(모두 같은 틱에 시작됐는지)는 검증하지 않음. INFO 수준이지만 concurrency contract를 명시하는 데 유용.

---

## 요약

`ParallelExecutor`와 `ParallelHandler` 자체의 단위 테스트 커버리지는 대체로 양호하나, **타이밍 의존 테스트 2건**(executor의 maxConcurrency 테스트, service의 200ms 대기)이 flaky 위험을 내포하고 있고, **통합 테스트에서 mockConfigService 상태가 테스트 간 누수**될 수 있는 구조적 문제가 있습니다. 핵심 비즈니스 로직인 `planParallelBody`(back-edge 감지, nested parallel 거부 등)와 `appendExecutionPath`의 동시성 보장 로직은 직접 검증하는 테스트가 없어 향후 리팩터링 시 회귀 탐지가 어렵습니다. `MergeHandler`의 신규 warning 경로, 프론트엔드 `parallelBranchPorts`, `waitAll=false` no-op 보장도 테스트로 명시적으로 문서화할 필요가 있습니다.

## 위험도

**MEDIUM**