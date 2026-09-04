-- V110: schedule 의 (next_run_at, is_active) 부분 인덱스를 (workspace_id, next_run_at) 로 교체
--
-- spec/1-data-model.md §3 인덱스 전략 (Schedule (workspace_id, next_run_at))
-- spec/data-flow/10-triggers.md §2.1 Schema 매핑 (schedule 행)
-- 실측·기각 근거: plan/in-progress/spec-draft-schedule-index.md
--
-- 종전 인덱스 `idx_schedule_next_run (next_run_at, is_active) WHERE is_active = TRUE` (V002:30) 는
-- 어떤 쿼리도 쓰지 않았다. 스케줄 목록(SchedulesService.findAll)은 `WHERE workspace_id = ?` 로
-- 진입하고 `is_active` 를 전혀 걸지 않으므로, Postgres 가 부분 인덱스를 쓰기 위한 조건
-- (쿼리 술어가 인덱스 술어를 함의) 을 만족하지 못한다. 부팅 재등록(ScheduleRunner.onModuleInit)
-- 의 `WHERE is_active = TRUE` 는 술어를 함의하지만 활성 비율이 높아(실측 70%) 선택도가 낮고,
-- 플래너가 seq scan 을 고른다 — 인덱스 유·무로 계획이 바뀌지 않음을 EXPLAIN 으로 확인했다.
--
-- 실측 (PostgreSQL 18.4, 200,000행 / 워크스페이스 2,000, 5회 반복 median):
--   목록 `WHERE workspace_id = ? ORDER BY next_run_at DESC LIMIT 20`
--     종전 (부분 인덱스)            Parallel Seq Scan   5.99 ms
--     (next_run_at) 만 남기는 안    Index Scan Backward 12.77 ms  ← 오히려 2.2배 느리다
--     (workspace_id, next_run_at)   Index Scan Backward  0.30 ms  ← 20배
--   기본 정렬 `ORDER BY created_at` 도 선두 컬럼 덕에 6.89 → 1.08 ms.
--
-- `(next_run_at)` 만 남기면 더 느려지는 이유: 정렬 컬럼이 선두라 플래너가 인덱스를 집어 든 뒤
-- next_run_at 순으로 훑으며 workspace_id 로 거른다 — 20행을 채우려 39,797 엔트리를 버린다.
-- 이 쿼리의 술어는 workspace_id 등치이고 next_run_at 은 정렬일 뿐이므로 선두는 workspace_id 다.
--
-- 부수 효과: schedule 에는 workspace_id 인덱스가 아예 없어 목록 조회가 정렬 컬럼과 무관하게
-- 매번 전 테이블을 훑고 있었다. 이 인덱스가 그 진입도 함께 준다.
-- 크기: 5,368 kB(부분) → 7,960 kB(전체 행). 200,000행 기준 +2.6 MB.
--
-- 비-트랜잭션 (executeInTransaction=false, 동봉 .conf) — CREATE/DROP INDEX CONCURRENTLY 가
-- transaction block 안에서 실행 불가하기 때문. 교체 순서는 V056 선례를 따른다.
--
-- ## `IF NOT EXISTS` 만으로는 재실행이 안전하지 않다 (23_02_51 W1)
--
-- `CREATE INDEX CONCURRENTLY` 가 중간에 실패하면 `indisvalid = false` 인 **invalid 인덱스가
-- 이름을 점유한 채 남는다**. `IF NOT EXISTS` 는 **이름 존재 여부만 보고 유효성은 보지
-- 않으므로**, 그대로 재실행하면:
--   1) CREATE 가 "이미 있다" 며 건너뛰고
--   2) 뒤이은 DROP 은 정상 수행돼 **옛 인덱스가 사라진다**
-- 결과는 "새 인덱스 invalid + 옛 인덱스 없음" — Postgres 는 invalid 인덱스를 쿼리에 쓰지
-- 않으므로 **이 마이그레이션이 없애려던 seq scan 으로 조용히 회귀**하면서 쓰기 비용만 낸다.
--
-- 그래서 CREATE 앞에 같은 이름의 DROP 을 둔다. 정상 첫 실행에서는 대상이 없어 no-op 이고,
-- 실패 후 재실행에서만 invalid 잔재를 치운다. (선례 V056/V106 은 이 줄이 없다 — 같은
-- 위험이 남아 있으므로 규약 차원의 처리는 후속으로 등재했다.)
--
-- 순서:
--   0) DROP 새 인덱스 이름 CONCURRENTLY — 앞선 실패가 남긴 invalid 잔재 정리 (첫 실행엔 no-op)
--   1) CREATE 새 인덱스 CONCURRENTLY
--   2) DROP 옛 인덱스 CONCURRENTLY
-- 1) 이 실패해도 옛 인덱스는 2) 전이라 그대로 남는다 — 즉 어느 지점에서 멈추든 DB 는
-- 마이그레이션 이전 상태이거나 완료 상태이고, "둘 다 없는" 상태로는 가지 않는다.

DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_workspace_next_run
    ON schedule (workspace_id, next_run_at);

DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_next_run;

-- DOWN(수동 롤백 참고 — Flyway 자동 실행 아님):
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_next_run
--     ON schedule (next_run_at, is_active) WHERE is_active = TRUE;
--   DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;
