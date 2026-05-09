# Fix — ContinuationBusService 부팅 race

## 배경

백엔드 부팅 시 다음 ERROR 가 1회 발생.

```
ERROR [ContinuationBusService] acquireLock(exec:recover:lock) 실패: Cannot read properties of undefined (reading 'set')
```

원인은 같은 모듈(`ExecutionEngineModule`) 내 두 service 의 `OnModuleInit` 호출 순서가 등록 순서를 따른다는 NestJS 동작 — `ExecutionEngineService.onModuleInit` 이 먼저 실행되며 그 안에서 `recoverStuckExecutions()` → `continuationBus.acquireLock()` → `this.publisher.set(...)` 까지 진입할 때, `ContinuationBusService.onModuleInit` 이 아직 호출되지 않아 `publisher` 가 undefined.

`acquireLock` 의 try/catch 가 false 를 반환하기 때문에 부팅은 계속되나, 매번 stuck execution recovery 가 silent skip 되고 ERROR 노이즈가 찍힘. 추가로 `publish` 는 `.catch()` 만 있어 sync TypeError 가 propagate 되던 잠재 버그도 동일 라이프사이클 조건에서 발견.

## 작업 항목

### 1. ContinuationBusService 방어적 가드 (TDD)

- [x] `backend/src/modules/execution-engine/continuation/continuation-bus.service.spec.ts` — `publisher` 가 미초기화일 때 `acquireLock`/`releaseLock`/`publish` 가 안전하게 동작하는지 검증하는 테스트 추가 (헬퍼 `withUninitializedPublisher` 로 정리).
- [x] `backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` — `acquireLock` / `releaseLock` / `publish` 진입부에 publisher 가드 추가. publisher / subscriber 타입을 `Redis | undefined` 로 변경하고 `onModuleInit` 은 로컬 변수 setup 후 마지막에 this 에 할당하는 패턴으로 재정리.
- [x] 가드 / catch 로그에 `sanitizeForLog` 헬퍼 적용 — 제어문자 strip + 길이 제한. `dispatch()` 의 기존 인라인 sanitize 도 같은 헬퍼로 통합 (DRY).
- [x] `acquireLock` / `releaseLock` JSDoc `@returns` 보완 — publisher 미초기화 경로 명시. `publish` JSDoc 도 미초기화 동작 한 단락 추가.

### 2. ExecutionEngineService — recoverStuckExecutions 호출 시점 이동

- [x] `backend/src/modules/execution-engine/execution-engine.service.ts`:
  - `OnApplicationBootstrap` import 추가.
  - `implements OnModuleInit, WorkflowExecutor` → `implements OnModuleInit, OnApplicationBootstrap, WorkflowExecutor`.
  - `onModuleInit` 에서 `await this.recoverStuckExecutions();` 제거 (await 가 사라져 동기 메서드로 단순화).
  - `onApplicationBootstrap()` 메서드 신설 — `await this.recoverStuckExecutions();` 호출.
- [x] `backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `onModuleInit` 은 recovery 미트리거, `onApplicationBootstrap` 은 트리거 + lock 해제, DB 오류 시에도 lock 해제 + 오류 전파 케이스 보강.

### 3. TEST WORKFLOW

- [x] backend lint
- [x] backend unit test (173 suites / 2903 tests, all pass)
- [x] backend build

### 4. REVIEW WORKFLOW

- [x] `ai-review` skill 실행 — `review/2026-05-09_14-51-54/SUMMARY.md`.
- [x] Warning 8건 / Info 13건 검토 후 적용 가능한 항목 모두 조치.
- [x] `review/2026-05-09_14-51-54/RESOLUTION.md` 작성.
- [x] TEST WORKFLOW 재수행 (lint / unit / build 통과).

### 5. 마무리

- [ ] 본 plan 문서를 `plan/complete/` 로 `git mv`.
- [ ] memory 갱신 — 본 사례에서 일반화할 만한 항목 (NestJS 같은 모듈 내 onModuleInit 순서 의존 금지) 이 있으면 `feedback` / `project` 메모로 추가.

## 변경하지 않는 것

- `providers` 배열 순서 재정렬 — NestJS 가 등록 순서를 보장한다는 공식 약속이 없어 fragile.
- `ContinuationBusService` 의 publisher 초기화를 생성자로 이동 — async config + ioredis 연결 setup 은 lifecycle hook 이 자연스러우며 다른 service 와 일관성을 깸.
- `recoverStuckExecutions` 자체 로직 (분산 lock + 30분 stale threshold + 단일 atomic UPDATE) — 변경 불필요.
- DB `(status, started_at)` 복합 인덱스 / `durationMs` NULL 처리 — 본 fix scope 밖. 필요 시 별도 plan.

## 검증 시나리오

1. 수정 전 백엔드 dev 기동 → 위 ERROR 1회 발생 확인 (재현).
2. 수정 후 백엔드 dev 기동 → ERROR 미발생.
3. (수동) DB 에 `WAITING_FOR_INPUT` 이고 `started_at` 이 31분 이상 지난 더미 row 한 건 → 재기동 → `Recovered 1 stale execution(s)` 로그 + status `FAILED` 전환 확인.
