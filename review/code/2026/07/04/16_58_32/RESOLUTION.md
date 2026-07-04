# RESOLUTION — PR2b enforcement (ai-review 16_58_32)

## 조치 항목

| SUMMARY # | Severity | 조치 |
| --- | --- | --- |
| 1 | **CRITICAL** (concurrency) | admission 을 **per-workspace `pg_advisory_xact_lock` 트랜잭션**으로 직렬화 — 조건부 UPDATE 단독의 서브쿼리 COUNT race(cap 초과) 제거. `execution-engine.service.ts` admitExecutionOrDefer (c). |
| 2 | **CRITICAL** (requirement·side_effect) | admitted 분기에 `recordRunningSegmentStart(executionId)` 추가 — §8 active-running 타임아웃(PR2a) 무력화 회복(choke point 우회 보정, PR4 stalled 분기 선례). |
| 3 | Warning (concurrency) | workspaceId undefined 시 lock key `workflowId` fallback + 주석. (ws COUNT fail-open 은 workflow 미해결이라는 비정상 케이스 한정.) |
| 4 | Warning (api_contract·documentation) | `GET /api/workspaces/:id/settings` 응답 + `WorkspaceSettingsDto`(Swagger)에 `maxConcurrentExecutions` 추가 — PATCH/GET round-trip 정합. |
| 5 | Warning (documentation) | spec §8 "PR2b 정책 정의 완료, enforcement 후속" → **"PR2b 구현 완료"** flip + admission 원자성 서술을 **advisory lock 필수**로 정정(조건부 UPDATE 단독 불충분 명시). |
| 6 | Warning (database) | **V105** `CREATE INDEX CONCURRENTLY idx_execution_workflow_status ON execution (workflow_id, status)` (+ .conf non-transactional) — admission COUNT hot-path 인덱스. |
| 7 | Warning (testing) | admission `queuedAt=null` 방어 분기 유닛 추가. (deferred/cancelled 시 releaseRouting·runExecution 미호출은 e2e 가 실증 — 아래 보류.) |
| 8 | Warning (architecture·requirement) | workflow-level cap validated DTO — **보류(아래)**. |
| 9 | Warning (architecture) | admitExecutionOrDefer raw SQL — **ACCEPT**: `updateExecutionStatus` else-branch raw UPDATE 선례와 일관 + advisory lock 트랜잭션으로 원자성 확보(캡슐화는 저가치). |

INFO/clean: security·scope·maintainability·dependency = 문제 없음(INFO만).

## TEST 결과 (fix 후 재수행)
- lint / unit / build: 재수행 중(admission mock 을 manager.transaction 으로 갱신 — admission 3-way + queuedAt=null 유닛 통과 확인).
- e2e: advisory lock 후 기능 회귀(cap 초과→pending→admitted / 5분 cancel) 재검증 예정.

## 보류·후속 항목
- **workflow-level cap validated write DTO** (#8): `Workflow.settings.maxConcurrentExecutions` 는 현재 `PATCH /api/workflows/:id` 의 unvalidated `settings` Record 로 저장되고, admission 의 `resolveConcurrencyCap` 이 양의 정수만 채택하는 방어로 hard-break 없음. validated nested DTO 는 별도 후속(workspace 는 이번 PR 에서 validated DTO 제공).
- **deferred/cancelled 시 releaseRouting 통합 유닛** (#7): e2e(cap 초과→pending, 5분 cancel)가 실증. 통합 유닛은 회귀 보강 성격 후속.
- **workspace cap 초과 e2e 시나리오**: 이번 e2e 는 per-workflow cap 검증. workspace cap 은 admission SQL 이 동일 join COUNT 라 로직 동일 — 후속 보강.
