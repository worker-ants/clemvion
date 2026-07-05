-- V106: schedule (trigger_id) 인덱스 — 트리거 목록 cron/nextRunAt enrichment hot-path.
--
-- TriggersService.findAll (V-10) 이 목록 페이지마다 schedule 을
-- WHERE trigger_id IN (...) AND workspace_id = ? 로 배치 조회한다. schedule.trigger_id
-- 는 FK(trigger ON DELETE CASCADE)뿐이고 인덱스가 없어(Postgres 는 FK 에 자동
-- 인덱스를 만들지 않는다) 목록 로드마다 seq scan 에 의존했다(ai-review database INFO).
-- findOneDetail 단건 조회도 동일 갭이었으나 목록 enrichment 로 호출 빈도가 늘어
-- 인덱스를 추가한다. trigger_id 는 트리거당 schedule 1건(1:1)이라 매우 선택적이다.
--
-- CREATE INDEX CONCURRENTLY 는 트랜잭션 밖 실행이라 동봉 .conf 가
-- executeInTransaction=false 를 지정한다. IF NOT EXISTS 로 재실행 idempotent.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_trigger_id
  ON schedule (trigger_id);

-- DOWN(수동 롤백 참고 — Flyway 자동 실행 아님): DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_trigger_id;
