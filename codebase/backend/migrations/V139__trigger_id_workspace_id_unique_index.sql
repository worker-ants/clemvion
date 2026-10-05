-- V139: trigger (id, workspace_id) UNIQUE 인덱스 — 복합 FK(V141)가 가리킬 부모 키
--
-- NERV CLE-PLAT-DATA Rationale 「워크스페이스 범위 참조를 복합 FK 로도 막는다 (2026-10-05)」, NERV Task CLE-T-QTRRE6.
--
-- 자식이 `(참조, workspace_id)` 로 이 trigger 행을 가리키려면 부모에 `(id, workspace_id)` UNIQUE 가 있어야 한다. `id` 가 PK 라 유일성은
-- 이미 참이고, 이 인덱스는 복합 FK 의 참조 대상이 되려고 둔다. 제약으로 붙이는 일(`ADD CONSTRAINT … UNIQUE USING INDEX`)은
-- V141 이 한다. 같은 워크스페이스 범위의 자식 FK 검사가 이 인덱스로 부모를 찾는다.
--
-- 비-트랜잭션(동봉 .conf, migrations/README.md §4 · §5). 신규 추가 형태: 0) 앞선 실패의 invalid 잔재를 지운 뒤 만든다(선례 V111).
-- V141 이 이 인덱스를 제약에 붙인 뒤에 이 파일을 손으로 다시 돌리면 0) 의 DROP 이 «제약이 쓰는 인덱스» 라 실패한다. 정상 흐름의
-- Flyway 는 성공한 파일을 다시 돌리지 않는다.
DROP INDEX CONCURRENTLY IF EXISTS uq_trigger_id_workspace_id;
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_trigger_id_workspace_id
  ON trigger (id, workspace_id);

-- DOWN: V141 DOWN 을 먼저 돌린 뒤(제약에서 떼어 낸 뒤)
--   DROP INDEX CONCURRENTLY IF EXISTS uq_trigger_id_workspace_id;
