# AI Review SUMMARY — PR2b 동시성 cap enforcement

- **Diff base**: origin/main. **Date**: 2026-07-04 16:58:32. **Reviewers**: 12 (performance·user_guide_sync skip).

## 위험도: MEDIUM — **Critical 1** / Warning 다수

| # | Severity | Reviewer | 발견 | 조치 |
| --- | --- | --- | --- | --- |
| 1 | **CRITICAL** | concurrency | admission 조건부 UPDATE 가 TOCTOU-safe 아님 — 서브쿼리 COUNT 에 락 없어 동시 admit 둘 다 통과 → cap 초과(실 Postgres 재현). | **FIX**: per-workspace `pg_advisory_xact_lock` 트랜잭션으로 admission 직렬화 |
| 2 | Warning | side_effect | admitted 분기가 `recordRunningSegmentStart` 누락 → segmentStartMs 미설정 → §8 active-running 타임아웃(PR2a) 약화 | **FIX**: admitted 분기에 recordRunningSegmentStart 추가 |
| 3 | Warning | concurrency | workspaceId undefined → `w.workspace_id=NULL` → ws COUNT 0 → ws cap fail-open | **FIX**: 방어(lock key fallback + 주석) |
| 4 | Warning | api_contract·documentation | `GET /api/workspaces/:id/settings` 응답·Swagger 에 maxConcurrentExecutions 누락(PATCH 는 저장) | **FIX**: getSettings 응답 + WorkspaceSettingsDto 필드 |
| 5 | Warning | documentation | spec §8 이 "enforcement 구현 후속" 인데 이 PR 이 enforcement → stale | **FIX**: §8 "구현 완료" flip |
| 6 | Warning | database | admission COUNT hot-path 에 `(workflow_id, status)` 인덱스 부재 | **FIX**: V105 인덱스 마이그레이션 |
| 7 | Warning | testing | deferred/cancelled 시 releaseRouting·runExecution 미호출 유닛 + queuedAt=null 분기 유닛 부재 | **FIX**: 유닛 보강 |
| 8 | Warning | architecture | workflow-level cap write API 없음(workspace 만) | workflow settings write 확인 → 후속 or 추가 |
| 9 | Warning | architecture | admitExecutionOrDefer raw SQL 이 Repository 추상화 우회 | **ACCEPT**: updateExecutionStatus 선례 일관(주석 정당화) |

Critical 0 나머지: security·scope·maintainability·dependency = clean(INFO만).

## 조치 순서
1. **#1 CRITICAL advisory lock** (admission 재작성) — 최우선.
2. #2 recordRunningSegmentStart, #3 fail-open 방어 (같은 admission 메서드).
3. #4 GET settings, #5 spec flip, #6 V105 인덱스, #7 유닛.
4. #8 workflow cap write 결정, #9 accept.
5. TEST WORKFLOW 재수행(e2e 포함).
