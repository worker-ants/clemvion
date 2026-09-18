-- V111: trigger (workflow_id) 인덱스 — 워크플로 삭제 경로
--
-- spec/1-data-model.md §3 인덱스 전략 (Trigger (workflow_id)) · ## Rationale «Trigger `(workflow_id)` 인덱스»
-- spec/data-flow/10-triggers.md §2.1 Schema 매핑 (trigger 행)
-- 실측·같은 클래스 전수: plan/complete/spec-draft-trigger-workflow-index.md
--
-- 워크플로 삭제 한 번이 trigger 를 세 번 찾는다 — 트리거 자원 정리의 외부 해제용 열거(트랜잭션 밖),
-- 비밀 정리 대상 열거(workflow 행 잠금 안), FK trigger_workflow_id_fkey 의 ON DELETE CASCADE.
-- workflow_id 를 선두로 가진 인덱스가 없어(Postgres 는 FK 에 인덱스를 자동 생성하지 않는다) 세 번 다
-- 전 테이블을 훑었다. 이 셋 말고 workflow_id 로 트리거를 찾는 곳은 없다.
--
-- 실측 (PostgreSQL 18, V001~V110, 워크플로당 트리거 4, 워밍 뒤 1회):
--   트리거 수     열거 SELECT id … WHERE workflow_id = ?     CASCADE
--   20,000        Seq Scan           0.63 ms                0.67 ms
--   80,000        Seq Scan           2.26 ms                2.19 ms
--   320,000       Parallel Seq Scan  7.52 ms               11.05 ms
--   320,000 + 이 인덱스  Bitmap Index Scan 0.04 ms          0.05 ms
-- 크기: 320,000행에서 4.5 MB (테이블 41 MB). workflow_id 는 v1 에서 바뀌지 않아 쓰기 비용은 INSERT 때뿐.
--
-- 비-트랜잭션 (executeInTransaction=false, 동봉 .conf) — CREATE/DROP INDEX CONCURRENTLY 는 transaction
-- block 안에서 실행할 수 없다.
--
-- ## CREATE 앞에 DROP 을 두는 이유 (신규 추가인데도)
--
-- CREATE INDEX CONCURRENTLY 가 중간에 실패하면 indisvalid = false 인 인덱스가 이름을 점유한 채 남는다.
-- IF NOT EXISTS 는 이름만 보므로 repair 뒤 재실행이 CREATE 를 건너뛰고, 그 invalid 인덱스는 **영영
-- 유효해지지 않는다** — 쿼리는 계속 seq scan 이면서 쓰기 비용만 낸다. V106 이 이 형태(CREATE 만)다
-- (migrations/README.md §5 표). 그래서 V110 의 0) 단계처럼 invalid 잔재를 먼저 지운다.
-- 이 DROP 은 잔재와 정상 인덱스를 가리지 않지만, 신규 추가라 잃을 옛 인덱스가 없어 성공 뒤 재실행의
-- 비용은 재빌드 동안의 seq scan 뿐이다.
DROP INDEX CONCURRENTLY IF EXISTS idx_trigger_workflow_id;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trigger_workflow_id
  ON trigger (workflow_id);

-- DOWN(수동 롤백 참고 — Flyway 자동 실행 아님): DROP INDEX CONCURRENTLY IF EXISTS idx_trigger_workflow_id;
