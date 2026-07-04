# 테스트(Testing) Review — exec-intake-pr4-stalled (RE-REVIEW)

## 리뷰 범위

이번 라운드 `_prompts/testing.md` 페이로드는 spec 문서(`spec/1-data-model.md`,
`spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`,
`spec/conventions/error-codes.md`, `spec/data-flow/3-execution.md`) 5건만 번들되어 있어
(코드 diff 없음), 사용자 지시(RE-REVIEW: 직전 라운드가 지적한 test-hook gating 테스트
갭 검증)에 따라 실제 워크트리의 테스트 코드를 직접 열람·실행해 검증했다. 직전 라운드
(`review/code/2026/07/04/13_08_20/testing.md`)의 WARNING/INFO 대상 파일:

- `codebase/backend/src/modules/executions/executions.controller.ts`
- `codebase/backend/src/modules/executions/executions.controller.spec.ts`
- `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` / `.spec.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`

## 검증 결과

### 1. WARNING (직전 라운드) — `simulateExecutionRunRedeliveryForTest` 게이팅 unit 테스트 부재 → 해소 확인

- 위치: `codebase/backend/src/modules/executions/executions.controller.spec.ts:208-273`
- `describe('simulateExecutionRunRedeliveryForTest (test-only gating + ownership)', ...)` 블록에
  4개 케이스 추가됨:
  1. `NODE_ENV=test + E2E_TEST_HOOKS=1` → `verifyOwnership` 호출 후
     `runExecutionFromQueue(EXEC, {})` 호출, `{ success: true }` 반환 (208-235행)
  2. 소유권 검증 실패(cross-workspace IDOR) → `NotFoundException` 전파, `runExecutionFromQueue`
     미호출 (237-249행) — 자매 엔드포인트(`triggerStuckRecoveryForTest`)에는 없는 **추가**
     케이스로, 신규 엔드포인트가 `:id` 파라미터를 받아 IDOR 표면이 새로 생긴 점을 정확히 반영
  3. `NODE_ENV≠test` → 404, `verifyOwnership`/`runExecutionFromQueue` 둘 다 미호출 (251-261행)
  4. `E2E_TEST_HOOKS` 미설정 → 404, `runExecutionFromQueue` 미호출 (263-272행)
- `mockExecutionEngineService`(controller.spec.ts:30-34)에 `runExecutionFromQueue: jest.fn()`
  mock 추가 확인 — 직전 라운드가 지적한 "mock 없어 즉시 TypeError" 문제 해소.
- 실제 컨트롤러 구현(`executions.controller.ts:236-249`)과 대조: 게이트 체크 → `verifyOwnership`
  → `runExecutionFromQueue(id, {})` 순서이며, 테스트 4케이스의 호출 순서·인자·예외 타입
  단언이 실제 분기와 정확히 일치. mock 인터페이스(`verifyOwnership`, `runExecutionFromQueue`)도
  실제 서비스 메서드 시그니처와 괴리 없음.
- `pnpm exec jest src/modules/executions/executions.controller.spec.ts` 실행 → 전건 pass 확인.

**평가**: 직전 WARNING 은 완전히 해소됐다. 자매 엔드포인트(`triggerStuckRecoveryForTest`) 패턴을
그대로 재사용하면서, 신규 `:id` 라우트에 특화된 IDOR 케이스까지 추가해 오히려 커버리지가
자매 엔드포인트보다 넓다(자매는 파라미터가 없어 ownership 검증 자체가 없음).

### 2. INFO (직전 라운드) — `EXECUTION_RUN_STALLED_INTERVAL_MS` 값 검증 부재 → 해소 확인

- 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.spec.ts:63-65`
- `expect(EXECUTION_RUN_STALLED_INTERVAL_MS).toBe(30_000)` 추가됨 — 같은 파일 60행의
  `EXECUTION_RUN_MAX_STALLED_COUNT` 값 검증과 대칭을 이룸.
- `pnpm exec jest src/modules/execution-engine/queues/execution-run.queue.spec.ts` 실행 →
  pass 확인.

**평가**: 직전 INFO 도 해소.

### 3. `runExecutionFromQueue` RUNNING-분기 mock — 회귀 없이 유효

- 위치: `execution-engine.service.spec.ts:3163-3210` (`'RUNNING (stalled 재배달) →
  recordRunningSegmentStart + redriveStuckExecution (runExecution 아님)'`)
- `recordRunningSegmentStart`/`redriveStuckExecution` 을 `jest.spyOn` 으로 스텁하고
  `runExecution` 이 호출되지 않음을 검증 — §7.5 case B 재구동과 신규 실행 경로의 분기를
  정확히 구분. 직전 라운드가 "긍정 확인"으로 이미 인정한 내용이며 이번에도 회귀 없음
  (365 tests pass, `execution-engine.service.spec.ts` 포함).

## 잔존 갭 (직전 INFO, 여전히 미해소 — 차단 아님)

- **[INFO]** `finalizeStalledExhausted` cascade UPDATE 의 `nodeQb.where`/`andWhere` 인자
  미검증 — 여전히 `nodeQb.set` 호출 인자만 확인 (`execution-engine.service.spec.ts:3069-3071`).
  execution 쪽(`execQb.andWhere`, 3065-3067행)은 인자까지 검증하는 것과 비대칭 유지.
- **[INFO]** `finalizeStalledExhausted` RUNNING 케이스의 `emitSpy` 가 `toHaveBeenCalled()`
  만 확인, payload(이벤트 타입/필드) 미검증 (`execution-engine.service.spec.ts:3072`).
- **[INFO]** `finalizeStalledExhausted`/`onFailed` 에러 전파(reject) 경로 테스트 여전히 부재.

이 3건은 직전 라운드에서도 INFO(저위험)로 분류됐고 이번 라운드 지시(WARNING 해소 검증)
범위 밖이라 재차 INFO 로 유지 — 차단 사유 아님.

## 회귀·격리 재확인

- `pnpm exec jest` 로 `executions.controller.spec.ts`(29 tests),
  `execution-run.queue.spec.ts`(포함 29 tests 합산),
  `execution-engine.service.spec.ts` + `execution-run.processor.spec.ts` +
  `execution-run-dlq-monitor.service.spec.ts`(365 tests) 전건 실행 → 전부 pass.
  테스트 간 `process.env.NODE_ENV`/`E2E_TEST_HOOKS` 를 건드리는 신규 블록도 `afterEach` 로
  원복하므로 다른 describe 블록에 leak 되지 않음(격리 양호).

## 요약

직전 라운드가 WARNING 으로 지적한 `simulateExecutionRunRedeliveryForTest` 게이팅 테스트
부재는 이번 라운드에서 완전히 해소됐다 — 자매 엔드포인트와 동일한 3케이스(정상/NODE_ENV
오설정/E2E_TEST_HOOKS 미설정)에 더해 신규 `:id` 라우트 특유의 IDOR(cross-workspace 소유권
실패) 케이스까지 추가되어 오히려 자매 엔드포인트보다 커버리지가 넓다. `mockExecutionEngineService`
에 `runExecutionFromQueue` mock 도 추가되어 테스트 용이성 문제도 해결됐다. 실제 컨트롤러
구현과 대조한 결과 mock 인터페이스·호출 순서·인자가 모두 정합적이며, 관련 테스트 스위트
전체(394+ tests)가 pass 한다. `EXECUTION_RUN_STALLED_INTERVAL_MS` 값 검증도 신규 추가되어
직전 INFO 도 해소됐다. 잔여 3건(cascade WHERE 인자 미검증·emit payload 미검증·에러 전파
경로 미검증)은 여전히 저위험 INFO 로, 이번 라운드가 검증 대상으로 지정한 항목이 아니며
차단 사유가 아니다.

## 위험도

NONE

STATUS: SUCCESS
