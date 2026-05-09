# Fix — ContinuationBusService 부팅 race

> 본 plan 은 [`/Users/gehrig/.claude/plans/sorted-shimmying-wirth.md`](../../sorted-shimmying-wirth.md) 의 분석을 implementation 단위로 분할한 작업 plan 이다. 본문 분석은 해당 plan 에 있고, 여기서는 작업 항목·진행 상태만 추적한다.

## 배경 (요약)

백엔드 부팅 시 다음 ERROR 가 1회 발생.

```
ERROR [ContinuationBusService] acquireLock(exec:recover:lock) 실패: Cannot read properties of undefined (reading 'set')
```

원인은 같은 모듈(`ExecutionEngineModule`) 내 두 service 의 `OnModuleInit` 호출 순서가 등록 순서를 따른다는 NestJS 의 동작 — `ExecutionEngineService.onModuleInit` 이 먼저 실행되며 그 안에서 `recoverStuckExecutions()` → `continuationBus.acquireLock()` → `this.publisher.set(...)` 까지 진입할 때, `ContinuationBusService.onModuleInit` 이 아직 호출되지 않아 `publisher` 가 undefined.

`acquireLock` 의 try/catch 가 false 를 반환하기 때문에 부팅은 계속되나, 매번 stuck execution recovery 가 silent skip 되고 ERROR 노이즈가 찍힘.

## 작업 항목

### 1. ContinuationBusService 방어적 가드 (TDD)

- [ ] `backend/src/modules/execution-engine/continuation/continuation-bus.service.spec.ts` — `publisher` 가 미초기화일 때 `acquireLock`/`releaseLock`/`publish` 가 안전하게 동작하는지 검증하는 테스트 추가.
- [ ] `backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` — `acquireLock`(line 163), `releaseLock`(line 188), `publish`(line 125) 진입부에 `if (!this.publisher) { ... return safe-default }` 가드 추가.

### 2. ExecutionEngineService — recoverStuckExecutions 호출 시점 이동

- [ ] `backend/src/modules/execution-engine/execution-engine.service.ts`:
  - `OnApplicationBootstrap` import 추가 (line 1–7).
  - 클래스 선언(line 319) `implements OnModuleInit, WorkflowExecutor` → `implements OnModuleInit, OnApplicationBootstrap, WorkflowExecutor`.
  - `onModuleInit`(line 377–381) 에서 `await this.recoverStuckExecutions();` 한 줄 제거.
  - `onApplicationBootstrap()` 메서드 신설 — `await this.recoverStuckExecutions();` 호출.
- [ ] `backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `recoverStuckExecutions` 가 `onModuleInit` 이 아니라 `onApplicationBootstrap` 단계에서 호출되는지 검증하는 테스트 한 건 보강 (기존 `recoverStuckExecutions` describe 그룹 내).

### 3. TEST WORKFLOW

- [ ] backend lint
- [ ] backend unit test (`continuation-bus.service.spec`, `execution-engine.service.spec` 우선)
- [ ] backend build

### 4. REVIEW WORKFLOW

- [ ] `ai-review` skill 실행 (변경 diff 기준).
- [ ] Warning 이상 이슈 조치.
- [ ] `review/<timestamp>/RESOLUTION.md` 작성.
- [ ] TEST WORKFLOW 재수행.

### 5. 마무리

- [ ] 본 plan 문서를 `plan/complete/` 로 `git mv`.
- [ ] memory 갱신 (필요 시 `feedback`/`project` 메모 추가).

## 변경하지 않는 것

- `providers` 배열 순서 재정렬 — NestJS 가 등록 순서를 보장한다는 공식 약속이 없어 fragile.
- `ContinuationBusService` 의 publisher 초기화를 생성자로 이동 — async config + ioredis 연결 setup 은 lifecycle hook 이 자연스러우며 다른 service 와 일관성을 깸.
- `recoverStuckExecutions` 자체 로직 (분산 lock + 30분 stale threshold + 단일 atomic UPDATE) — 변경 불필요.

## 검증 시나리오

1. 수정 전 백엔드 dev 기동 → 위 ERROR 1회 발생 확인 (재현).
2. 수정 후 백엔드 dev 기동 → ERROR 미발생.
3. (수동) DB 에 `WAITING_FOR_INPUT` 이고 `started_at` 이 31분 이상 지난 더미 row 한 건 → 재기동 → `Recovered 1 stale execution(s)` 로그 + status `FAILED` 전환 확인.
