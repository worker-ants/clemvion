-- V035b: execution.execution_path 컬럼 DROP
--
-- V035a 가 신규 테이블 + 데이터 이행을 끝낸 뒤 별도 배포에서 적용한다.
-- 본 마이그레이션 직전에 application 코드는 이미 execution_path 컬럼을
-- 읽지 않는 상태여야 한다 (V035a 시점에 새 코드도 함께 배포되므로 이행
-- 직후부터 컬럼은 application 차원에서 dead column).
--
-- DROP COLUMN 은 PostgreSQL 에서 AccessExclusiveLock 을 걸지만 메타데이터
-- 변경만 하고 끝나므로 (실제 row rewrite 없음) 짧다. 다만 lock 대기에
-- 걸린 다른 트랜잭션이 길면 본 DROP 도 따라서 대기하므로 lock_timeout 을
-- 짧게 두어 운영 영향을 최소화한다 — 실패 시 다음 배포 재시도.

SET lock_timeout = '3s';
ALTER TABLE execution DROP COLUMN IF EXISTS execution_path;
