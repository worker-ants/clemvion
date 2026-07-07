-- V109: personal 워크스페이스 owner-당-유일성 부분 유니크 인덱스 (defense-in-depth).
--
-- 결정3 = B (spec-sync-data-flow-12-workspace-gaps, 2026-07-07): owner 당 personal
-- 워크스페이스는 최대 1개라는 invariant 를 앱 레이어(`findOrCreatePersonalWorkspace`)에
-- 더해 DB 레벨에서도 강제한다. team 워크스페이스는 owner 당 다수 허용해야 하므로 broad
-- `(owner_id, type)` UNIQUE 가 아니라 `WHERE type = 'personal'` **부분** 유니크 인덱스로
-- personal 에만 제약을 건다.
--
-- 선행 조건: V108 가드가 owner 당 중복 personal 부재를 검증한다(중복 시 배포 중단).
--
-- CREATE UNIQUE INDEX CONCURRENTLY 는 트랜잭션 밖 실행이라 동봉 .conf 가
-- executeInTransaction=false 를 지정한다(운영 중 테이블 락 회피). IF NOT EXISTS 로 재실행
-- idempotent. 명명은 uq_<table>_<qualifier> 관례(uq_entity_kb_name_type 등)를 따른다.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_workspace_personal_owner
  ON workspace (owner_id)
  WHERE type = 'personal';

-- DOWN(수동 롤백 참고 — Flyway 자동 실행 아님):
--   DROP INDEX CONCURRENTLY IF EXISTS uq_workspace_personal_owner;
