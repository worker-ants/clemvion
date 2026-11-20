-- V157: audit_log (created_at) — 감사 로그 보존 배치의 삭제 조건 전용 인덱스
--
-- CLE-OBS-AUDIT 「감사 로그 보존 배치」(REQ-AUDIT-019), NERV Task CLE-T-28MDF3.
-- 보존 배치(AuditLogsService.pruneOlderThanRetention)는 워크스페이스를 가리지 않고
-- `created_at < cutoff` 로 고른다. 지금 인덱스 idx_audit_log_workspace_created(V002)는 선두가
-- workspace_id 라 이 조건에 쓰이지 않아 매일 테이블 전체를 훑게 된다. 로그인 이력의
-- idx_login_history_created(V040)와 같은 꼴의 단독 인덱스를 더한다.
--
-- 비-트랜잭션 (executeInTransaction=false, 동봉 .conf) — CREATE/DROP INDEX CONCURRENTLY 는 transaction
-- block 안에서 실행할 수 없다. CREATE 앞의 DROP 은 앞선 실패의 invalid 잔재 정리다 — IF NOT EXISTS 는 이름만
-- 봐서, 그것 없이는 repair 뒤 재실행이 invalid 인덱스를 건너뛰어 영영 유효해지지 않는다
-- (migrations/README.md §5, CLE-ENG-MIGRATION 규칙 13).
DROP INDEX CONCURRENTLY IF EXISTS idx_audit_log_created;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_created
  ON audit_log (created_at);

-- DOWN(수동 롤백 참고 — Flyway 자동 실행 아님): DROP INDEX CONCURRENTLY IF EXISTS idx_audit_log_created;
