# 테스트(Testing) 리뷰

## 발견사항

### [WARNING] `applyCancellation` 단위 테스트가 새 async 시그니처를 검증하지 않음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` L1233
- 상세: 기존 테스트 `'applyCancellation — 로컬 Map 키 없으면 silent skip (review W12)'` 는 `sync` 시절 작성된 것으로 `expect(() => service.applyCancellation('exec-not-here')).not.toThrow()` 패턴을 그대로 사용한다. `applyCancellation` 은 이번 PR-B1 에서 `async` 로 변경됐고 내부에서 `cancelParkedExecution` 을 호출(DB 쿼리)하므로, 이 테스트는 반환된 Promise 를 `await` 하지 않아 DB 분기 경로를 사실상 검증하지 못한다. `cancelParkedExecution` 의 `createQueryBuilder` mock 이 준비되지 않은 채 동기 완료처럼 단언하므로 실제 오류가 있어도 테스트가 통과한다.
- 제안: 테스트를 `async` 로 전환하고 `await service.applyCancellation(...)` 로 수정. `mockExecutionRepo.createQueryBuilder` mock 을 armして `affected: 0` 반환(기존 'silent skip' 의미 유지) → `EXECUTION_CANCELLED` emit 이 호출되지 않음을 단언하도록 보완한다.

### [WARNING] `cancelParkedExecution` 전용 단위 테스트 부재 — 핵심 신규 경로 커버리지 갭
- 위치: `execution-engine.service.spec.ts` — `applyCancellation` describe 블록
- 상세: `cancelParkedExecution` 은 Phase B 신규 critical 경로다. 이 메서드는 (1) `createQueryBuilder` chain 실행, (2) `affected > 0` 시 `finalizeRehydrationCleanup` 호출, (3) `EXECUTION_CANCELLED` emit, (4) `affected === 0` 시 no-op(멱등), (5) emit 실패 시 warn-log + cancel 은 DB 반영 유지 — 총 5개 분기를 포함한다. 현재 변경에서 통합 테스트(L3394~3413)가 cancel 이벤트 발생을 간접 검증하지만, `affected === 0` 멱등 경로, emit 예외 catch 경로, `finalizeRehydrationCleanup` 호출 여부는 테스트되지 않는다.
- 제안: `describe('cancelParkedExecution — durable WAITING cancel')` 블록을 추가하고 (a) `affected:1` → emit 발생, (b) `affected:0` → emit 미발생(멱등), (c) emit throw → warn log만, DB 반영 유지 세 케이스를 커버한다.

### [WARNING] `applyCancellation` 의 "in-memory 코루틴 있을 때 cancelParkedExecution 미호출" 분기 미검증
- 위치: `execution-engine.service.ts` L1044–1049 / `execution-engine.service.spec.ts`
- 상세: `applyCancellation` 의 첫 분기는 `pendingContinuations.has(executionId)` 가 true 일 때 `rejectPending` 만 호출하고 `cancelParkedExecution` 을 건너뛰는 것이다. 이 분기는 기존 in-memory 코루틴 생존 경우(멀티턴 AI / 중첩 executeInline)에 해당한다. 현재 변경 코드에 이 분기에 대한 전용 단언이 없다. fast-path 경로에서 DB write(`cancelParkedExecution`)가 잘못 호출되면 중복 CANCELLED 마킹 위험이 있다.
- 제안: `pendingContinuations` 에 항목을 삽입 후 `applyCancellation` 호출 → `mockExecutionRepo.createQueryBuilder` 가 호출되지 않음을 단언하는 케이스를 추가한다.

### [WARNING] `flushResumeDrive(ms = 40)` 는 실제 타이머 의존 — 테스트 환경에 따라 flaky 위험
- 위치: `execution-engine.service.spec.ts` L82, L3143, L3189, L3293, L3325, L3352, L3413, L3754 등 다수
- 상세: `flushResumeDrive` 는 `setTimeout(resolve, ms)` 로 40ms(또는 20ms) 실제 clock 을 소비한다. 이 함수의 docstring 이 "firePayload 는 setTimeout(0) 시작 + 20ms 폴링이므로 40ms 면 첫 fire+그래프 구동을 덮는다" 고 설명하는데, 이는 구현 내부 타이밍에 대한 강한 가정이다. CI 환경(특히 고부하 컨테이너)에서 40ms 가 충분하지 않을 경우 false negative 가 발생한다. L3816 에서는 50회 × 20ms = 최대 1000ms polling 루프를 직접 작성했는데, 이는 같은 문제를 더 강하게 드러낸다.
- 제안: `firePayload`/`driveResumeDetached` 의 내부 스케줄러를 테스트에서 직접 제어할 수 있도록 dependency injection 또는 scheduler 추상화를 검토한다. 단기적으로는 `flushResumeDrive` 의 대기 시간을 넉넉하게(예: 200ms) 높이거나, jest fake timers 와 실제 clock 을 혼합하는 패턴 대신 `driveResumeDetached` 완료 신호를 명시적으로 기다리는 hook 을 서비스에 추가하는 것이 더 안정적이다.

### [INFO] `armSlowPathResume` 헬퍼의 `mockNodeExecutionRepo.findOneBy` 전역 교체 — 테스트 격리 위험
- 위치: `execution-engine.service.spec.ts` L301: `mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue(...)`
- 상세: `armSlowPathResume` 내에서 `mockNodeExecutionRepo.findOneBy` 를 jest.fn() 으로 **전역 교체**한다. 이는 해당 테스트 블록 이후 동일 describe 스코프에서 실행되는 다른 테스트에 영향을 줄 수 있다. `beforeEach` 에서 초기화되지 않으면 이전 테스트의 mock 이 잔류한다. 마찬가지로 `mockNodeRepo.findOneBy = jest.fn().mockResolvedValue(...)` 도 L310 에서 전역 교체된다.
- 제안: `armSlowPathResume` 내에서 `mockResolvedValueOnce` 를 사용하거나, 교체된 mock 을 테스트 후 `afterEach` 에서 복원하도록 한다. 혹은 `jest.spyOn` 으로 교체해 `afterEach` 에서 `mockRestore` 를 호출한다.

### [INFO] e2e 테스트가 `button` park-release 시나리오를 포함하지 않음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/test/execution-park-resume.e2e-spec.ts`
- 상세: e2e 파일은 form park → cold rehydration → completed 단일 시나리오만 검증한다. PR-B1 에서 `waitForButtonInteraction` 도 동일 park-release 모델로 전환됐으나, button 인터랙션의 durable park + cold resume e2e 는 없다. plan에서 "form/button park-release"를 함께 PR-B1 범위로 명시했음에도 e2e 회귀 범위가 form 전용이다.
- 제안: button(carousel/button click) park → `POST .../button-click` 재개 → completed 시나리오를 별도 `it` 블록으로 추가하거나, 최소한 `TODO` 주석으로 PR-B2 또는 후속 작업 추적을 명시한다.

### [INFO] `applyCancellation — 로컬 Map 키 없으면 silent skip` 테스트 설명이 새 동작과 불일치
- 위치: `execution-engine.service.spec.ts` L1233
- 상세: 테스트 이름이 "silent skip" 인데, Phase B 이후 키 미존재 시 `cancelParkedExecution` (DB write)이 호출된다. 즉 "silent skip" 은 더 이상 정확한 설명이 아니다. 테스트 의도와 실제 동작이 다른 이름으로 남아 코드 독자를 혼란스럽게 한다.
- 제안: 테스트 이름을 "pendingContinuations 키 없을 때 cancelParkedExecution(DB) 경로로 폴백" 등으로 갱신하고 실제 동작을 검증한다.

### [INFO] W4 form downstream 테스트에서 `retryPromise` 단독 await 후 형식 검증만 남아 — resume 완료 단언 제거됨
- 위치: `execution-engine.service.spec.ts` L11628 (diff context L11839~11911 구간)
- 상세: Phase B 이전에는 "continueExecution → COMPLETED" 단언이 있었으나, Phase B 이후 해당 단언이 `completed.length === 0` 으로 역전됐다. 이는 새 불변식(re-park)에 맞지만, re-park 이후의 slow-path resume 완료 경로는 이 테스트에서 검증되지 않는다. "downstream form re-park 후 rehydration 으로 completed 까지" 흐름의 단위 커버리지가 부재하다.
- 제안: 해당 테스트에서 `armSlowPathResume` + `flushResumeDrive` 를 이용해 re-park 이후 completed 도달까지 단언하는 후속 단계를 추가하거나, 별도 통합 테스트로 추가한다.

---

## 요약

Phase B PR-B1 변경은 기존 fast-path 기반 in-memory 단언을 slow-path(rehydration) 모델로 전환하고 `armSlowPathResume` 헬퍼를 통해 DB mock 을 체계적으로 무장하는 방식으로 테스트를 갱신했다. 전반적인 테스트 구조는 새 불변식(resolver 미잔류, WAITING_FOR_INPUT DB 영속)을 명확히 반영하고 있으며, e2e 도 form park → cold rehydration 핵심 경로를 신규 추가해 회귀 가드를 갖췄다. 그러나 핵심 신규 메서드인 `cancelParkedExecution` 의 복수 분기(멱등, emit 예외, cleanup 호출)에 대한 전용 단위 테스트가 없고, `applyCancellation` 의 기존 단위 테스트가 async 전환 후 실질 검증력을 잃었다. `flushResumeDrive` 의 실제 타이머 의존은 CI flaky 위험 요소다. `armSlowPathResume` 의 전역 mock 교체는 테스트 격리를 약화시키며, button park 의 e2e 커버리지도 누락되어 있다.

## 위험도

MEDIUM

STATUS: SUCCESS
