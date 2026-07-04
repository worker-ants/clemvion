# 테스트(Testing) Review — PR2b 동시성 cap admission gate (RE-VERIFY, advisory-lock fix 반영)

본 회차는 이전 리뷰(review/code/2026/07/04/16_58_32/testing.md, 위험도 LOW)에서 지적한 항목 중
RESOLUTION.md #7 로 "조치" 표기된 두 가지를 재검증한다:

1. admission 유닛 mock 이 CRITICAL advisory-lock 재작성(조건부 UPDATE 단독 → `manager.transaction` +
   `pg_advisory_xact_lock`)에 맞춰 갱신되었는지.
2. `queuedAt=null`(레거시 row) 방어 분기 유닛 테스트가 추가되었는지.

## 검증 방법

- `execution-engine.service.spec.ts` / `execution-limits.spec.ts` diff 및 현재 파일 상태를 직접 확인.
- `npx jest execution-engine.service.spec.ts execution-limits.spec.ts` 전체 실행 — 2 suites / 367 tests 전부 통과 확인.
- `npx jest execution-engine.service.spec.ts -t "admitExecutionOrDefer / markQueueWaitTimeout"` 단독 실행 — 신규 4건 모두 통과.

## 발견사항

- **[INFO]** 항목 1 (admission mock → `manager.transaction`) — 정상 반영 확인, 실행 검증 완료
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:184-202`(공통 `mockExecutionRepo` 기본 mock), `:3035-3163`(전용 `describe` 블록 내 4개 테스트)
  - 상세: 공통 mock 에 `manager.transaction: jest.fn(async (cb) => cb({ query: jest.fn().mockResolvedValue([{ id: 'x' }]) }))` 이 추가되어, 코드가 `this.executionRepository.manager.transaction(async (m) => { await m.query('SELECT pg_advisory_xact_lock...'); const rows = await m.query('UPDATE ... RETURNING id'); return rows.length === 1; })` 형태로 바뀐 것과 정합한다. 3개 admission 테스트(admitted/deferred/queuedAt=null) 는 `mockExecutionRepo.manager.transaction` 을 개별 재할당해 `query` 가 반환하는 rows 배열(`[{ id: 'e1' }]` vs `[]`)로 admitted/deferred 분기를 결정한다. `markQueueWaitTimeout`(5분 초과 cancel) 테스트만 `createQueryBuilder` 기반 `mkQb(affected)` 를 쓰는데, 이는 실제 구현에서 `markQueueWaitTimeout` 이 (advisory lock 트랜잭션이 아닌) 별도의 단순 조건부 `createQueryBuilder().update()` 를 그대로 쓰기 때문——코드 경로와 mock 경로가 정확히 일치한다. `mockExecutionRepo.manager` 자체가 사전에 정의돼 있지 않으면 `.transaction = jest.fn(...)` 재할당 시 undefined 참조 에러가 날 수 있는데, 공통 mock 에 `manager: { transaction: ... }` 객체가 먼저 정의돼 있어 문제 없다. 실행 결과 4개 테스트 모두 통과, 전체 스위트(367)도 회귀 없이 통과.
  - 제안: 없음 — mock 구조가 실제 구현(advisory lock 트랜잭션 vs 단순 조건부 UPDATE)과 정확히 대응하고 있어 "mock 이 실제 동작과 괴리"되는 문제는 관찰되지 않는다.

- **[INFO]** 항목 2 (`queuedAt=null` 유닛) — 추가 확인, 의도한 분기를 정확히 검증
  - 위치: `execution-engine.service.spec.ts:3137-3153` (`'queuedAt=null(레거시 row) → 5분 검사 skip, admission 진행'`)
  - 상세: `exec.queuedAt: null` 로 `admit()` 을 호출하고 `manager.transaction` 을 rows 1건(`[{ id: 'e4' }]`)으로 세팅해 `'admitted'` 를 assert 한다. 코드의 `if (execution.queuedAt) { ... }` (falsy-skip) 분기를 정확히 겨냥하며, `queuedAt: null` 이 5분 타임아웃 검사를 건너뛰고 정상적으로 cap 검증 단계로 진행함을 실증한다. 다만 이 테스트는 "타임아웃 검사를 건너뛰었다"는 사실 자체(예: `markQueueWaitTimeout` 미호출, 또는 `mockWorkflowRepo.findOne` 이 호출되어 cap 검사 단계까지 도달했다는 것)를 직접 assert 하지 않고 최종 반환값 `'admitted'` 만 확인한다 — `queuedAt=null` 이어도 우연히 다른 경로로 `'admitted'` 가 나오는 회귀는 이론적으로 여전히 놓칠 수 있으나(예: 타임아웃 분기에 진입했는데 그 안에서 실수로 `'admitted'` 를 반환하도록 코드가 바뀌는 극단적 케이스), 현재 구현 구조상 타임아웃 분기는 `'cancelled'` 만 반환하므로 실질 위험은 낮다. 이전 리뷰가 요구한 "5분 검사 skip 후 cap 검증으로 정상 진행" 요건은 충족된 것으로 판단.
  - 제안: 없음(현재 수준으로 충분). 더 엄밀히 하려면 `mockWorkflowRepo.findOne` 이 이 케이스에서 호출됐음을 `expect(...).toHaveBeenCalled()` 로 추가 assert 하면 "타임아웃 분기를 실제로 건너뛰었다"는 근거가 더 명시적으로 남지만, 우선순위는 낮다(INFO).

- **[INFO]** 회귀 확인 — W5/W7 기존 테스트(`admitExecutionOrDefer` mock 고정)도 이번 재작성 이후 정상 통과
  - 위치: `execution-engine.service.spec.ts:15827-15838`, `:15937-15948` (SUMMARY W5/W7 보완 유닛)
  - 상세: `jest.spyOn(svc, 'admitExecutionOrDefer').mockResolvedValue('admitted')` 로 admission gate 를 우회 고정하는 방식이라, `admitExecutionOrDefer` 내부 구현(advisory lock 추가)이 바뀌어도 이 두 테스트는 영향받지 않는 구조——실제로 전체 스위트 실행에서 회귀 없음을 확인.
  - 제안: 없음.

- **[INFO]** (이전 리뷰에서 이미 지적, 이번 재검증 범위 밖) 여전히 미해결로 남아있는 항목 — RESOLUTION.md 에도 명시적으로 "보류" 처리됨
  - 위치: RESOLUTION.md "보류·후속 항목" 섹션
  - 상세: (a) admission 결과가 `deferred`/`cancelled` 일 때 호출부(`execute()` 백그라운드 dispatch)의 `releaseExecutionRouting` 호출·`runExecution` 미호출을 검증하는 통합 유닛은 이번 회차에도 추가되지 않았다(grep 결과 해당 패턴의 신규 테스트 없음) — RESOLUTION.md 가 "e2e 가 실증, 통합 유닛은 후속" 으로 명시적으로 defer 한 것과 일치하므로 이번 재검증에서 새로운 결함으로 취급하지 않는다. (b) workspace/workflow cap 파라미터가 SQL 바인딩에 올바른 순서로 전달되는지에 대한 `query` 호출 인자 assert 도 미추가——역시 기존 리뷰가 INFO 로 남겨둔 항목이며 이번 fix 스코프(advisory lock, queuedAt=null) 밖이다.
  - 제안: 후속 PR 에서 다루면 되며 이번 재검증 결과에 영향 없음.

## 요약

이번 재검증 대상인 두 항목 — (1) admission 유닛 mock 을 advisory-lock 트랜잭션(`manager.transaction`)에 맞춰 갱신, (2) `queuedAt=null` 방어 분기 유닛 추가 — 모두 실제 코드에 반영되어 있고, `execution-engine.service.spec.ts`/`execution-limits.spec.ts` 전체 스위트(367 tests)가 회귀 없이 통과함을 직접 실행으로 확인했다. mock 구조(`manager.transaction` vs `createQueryBuilder` 분리)는 `admitExecutionOrDefer`(advisory lock 트랜잭션 경로)와 `markQueueWaitTimeout`(단순 조건부 UPDATE 경로)이라는 실제 구현의 두 갈래를 정확히 반영하고 있어 mock-실동작 괴리는 없다. `queuedAt=null` 테스트는 목표 분기(falsy-skip)를 정확히 겨냥하나 "타임아웃 검사를 건너뛰었다"는 사실을 반환값만으로 간접 검증하는 점은 아주 사소한 개선 여지(INFO)로 남는다. 이전 리뷰가 지적한 다른 갭들(deferred/cancelled 통합 유닛, workspace/workflow 파라미터 순서 assert)은 RESOLUTION.md 에서 명시적으로 후속 보류 처리되어 이번 재검증 스코프에서 새로운 차단 사유가 되지 않는다. Critical/Warning 신규 발견 없음.

## 위험도
NONE
