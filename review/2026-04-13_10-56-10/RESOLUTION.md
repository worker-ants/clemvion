# Code Review 조치 내역 (2026-04-13)

대상 리뷰: `review/2026-04-13_10-56-10/` — Trigger Input Parameters 확장 작업에 대한 AI 리뷰.

## Critical 이슈

| # | 이슈 | 조치 |
|---|------|------|
| 1 | `WorkflowsModule`에 `Node` 엔티티 미등록 (런타임 오류) | **False positive** — `workflows.module.ts:12`에 `TypeOrmModule.forFeature([Workflow, Node, Edge])`로 이미 등록되어 있음을 확인. 조치 불필요. |

## Warning 이슈

| # | 이슈 | 조치 |
|---|------|------|
| 1 | `loadTriggerParameterSchema` 3중 중복 | **해결** — `backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.ts` 신규 유틸로 추출. `hooks.service.ts`, `schedule-runner.service.ts`, `workflows.controller.ts` 모두 공용 함수 사용. |
| 2 | `WorkflowsController`가 Repository 직접 주입 | 공용 유틸을 도입하면서 Controller는 `Node` repository만 주입하고 유틸에 위임하는 형태로 축소. 서비스 레이어 추출은 범위 밖으로 유지. |
| 3 | `SchedulesService` → `ScheduleRunnerService` 역방향 의존 | 범위 외로 판단 — 기존 `registerJob/removeJob` 호출도 같은 의존이며 스코프가 비대해짐. 추후 별도 리팩토링 과제로 이관. |
| 4 | `ScheduleRunnerService`가 `ExpressionResolverService`를 우회하여 `evaluate()` 직접 호출 | 본 작업의 스케줄 컨텍스트(`$now`, `$schedule`)는 `ExecutionContext`가 없는 상태에서 실행되므로 `ExpressionResolverService.buildExpressionContext()`의 서명과 맞지 않음. 공용 평가 진입점이 필요하지만 스펙 확장이 동반되어야 하므로 범위 외. |
| 5 | 표현식 엔진 sandbox 보안 | `packages/expression-engine/src/evaluator.ts`는 tree-walking evaluator(`Function()`/`eval` 미사용)임을 확인. sandbox escape 경로 없음. |
| 6 | `parameterValues` DTO 크기·깊이 제한 | 범위 외 — 본 엔드포인트는 기존 JWT 보호된 `/schedules` 경로 뒤에 있어 외부 공격면에 포함되지 않음. 전역 정책 도입 시 일괄 처리 권장. |
| 7 | `object`/`array` coerce 실패 스펙(§5.2) 위반 | **해결** — `resolve-trigger-parameters.ts`에 `isCoerceFailure()` 도입. `object` 타입에 비객체 문자열이 들어오거나 `array` 타입에 비배열이 들어오면 `coerce_failed` 반환. 테스트 4건 추가. |
| 8 | `WorkflowsController` 무테스트 | **해결** — `workflows.controller.spec.ts` 신규 작성. parameter 해석, required 누락 400, `input.parameters` 폴백, 워크스페이스 검증 4개 케이스. |
| 9 | `SchedulesService.runNow()` 미테스트 | **해결** — `schedules.service.spec.ts` 신규 작성. runner를 통한 파라미터 해석 후 execute 호출 검증. |
| 10 | `schedule-runner.spec.ts` 폴백·표현식 실패 경로 미테스트 | **해결** — required 누락 시 빈 파라미터 폴백, `$forbidden.access` 같은 평가 실패 시 원문 보존 테스트 추가. |
| 11 | `hooks.service.spec.ts` `coerce_failed` 미테스트 | **해결** — `amount: 'not-a-number'` 케이스로 400 응답 + `coerce_failed` 검증 추가. |
| 12 | `lastTriggeredAt` 비원자적 갱신 | 범위 외(기존 동작 유지). 별도 Atomic-update 리팩토링 이슈 필요. |
| 13 | BullMQ 중복 잡 실행 위험 | 범위 외 — 현재 `upsertJobScheduler`가 동일 스케줄에 대해 idempotent하지만 분산 워커 환경의 race는 별도 이슈로. |
| 14 | `/execute` soft breaking change · 400 응답 `code` 필드 통일 | 본 작업은 `parameterValues` 신규 추가이며 기존 `input` 필드 호환성 유지(테스트로 확인). 통일된 에러 response factory는 범위 외. |
| 15 | `(workflow_id, category)` 복합 인덱스 누락 | 범위 외 — 마이그레이션 `V012`로 후속 처리 권장. 현재 쿼리는 trigger 1회/실행만 수행하여 핫스팟 아님. |
| 16 | 스펙 문서 함수 시그니처 불일치 | **해결** — `spec/5-system/4-execution-engine.md` 6.1.1의 `resolveTriggerParameters(workflow, rawValues)` 표기는 개념 요약으로, 실제 코드는 `(schema, rawSource)` 분리. 스펙은 "워크플로우의 trigger 노드 config를 조회한다"는 책임 기술이며 신규 `loadTriggerParameterSchema` 유틸 명세와 일치. 추가 조치 불필요. |

## TEST WORKFLOW 재실행 결과

- backend: lint `422 problems (57 errors, 365 warnings)` — 모두 본 작업 이전 존재 · 본 작업으로는 **오류 순증 없음**(사실상 5 감소). 862+31 = 893/893 tests pass. build ✅
- frontend: lint ✅ · 427/427 tests pass · build ✅

## 범위 외 이관 항목

- 역방향 의존(Service↔Runner) 해소를 위한 `TriggerParameterService` 추출
- `ExpressionResolverService`에 제한 컨텍스트 평가 API 추가
- `parameterValues` 크기/깊이 정책
- `lastTriggeredAt` 원자적 갱신 및 BullMQ 중복 실행 방지
- `(workflow_id, category)` 복합 인덱스 마이그레이션
- 전역 400 응답 형식 통일(`code`/`errors`)

이상 항목은 본 기능 스코프를 초과하므로 별도 티켓으로 관리 권장.
