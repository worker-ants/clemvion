-- V103: V102 의 NOT VALID CHECK 제약(chk_trigger_endpoint_path_uuid)을 VALIDATE 로 승격.
-- (PR #750 INFO #1/#5 후속 — V102 NOT VALID 추가 후 운영 전수 검증 완료)
--
-- 배경: V102 는 레거시 row 가 비-UUID 일 가능성(PR #738 이전 free-form endpoint_path)
-- 때문에 NOT VALID 로 추가해 기존 행 검증을 건너뛰었다. 운영 DB 전수 조회 결과
-- `endpoint_path IS NOT NULL` 인 모든 row 가 v4 UUID 형식임을 확인(비-UUID 0건,
-- 2026-06-28)했으므로 이제 안전하게 VALIDATE 로 승격해 제약을 완전 강제한다.
--
-- 운영 안전:
--   - VALIDATE CONSTRAINT 는 짧은 SHARE UPDATE EXCLUSIVE lock 만 사용(ACCESS EXCLUSIVE 아님).
--     기존 행을 1회 스캔 검증하며, 전수 클린 확인 후라 사실상 즉시 완료된다.
--   - 이미 VALID 면(재실행) PostgreSQL 이 no-op 처리 → idempotent.
--
-- 사전 가드: 승격 직전 다시 한번 위반 row 부재를 확인해 (조회~배포 사이 유입 방어)
-- 비-UUID row 가 있으면 VALIDATE 실패 전에 명시적 에러로 차단한다.

DO $$
DECLARE
    invalid_count int;
BEGIN
    SELECT COUNT(*) INTO invalid_count
      FROM trigger
     WHERE endpoint_path IS NOT NULL
       AND endpoint_path !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
    IF invalid_count > 0 THEN
        RAISE EXCEPTION
            'V103 pre-flight failed: % trigger row(s) carry a non-v4-UUID endpoint_path. Backfill these before VALIDATE.',
            invalid_count;
    END IF;
END $$;

ALTER TABLE trigger VALIDATE CONSTRAINT chk_trigger_endpoint_path_uuid;

-- DOWN:
-- VALIDATE 는 제약의 검증 상태만 바꾼다(NOT VALID 로 되돌리는 표준 SQL 은 없음).
-- 롤백이 필요하면 제약을 drop 후 V102 의 NOT VALID 정의로 재생성한다:
--   ALTER TABLE trigger DROP CONSTRAINT IF EXISTS chk_trigger_endpoint_path_uuid;
--   (V102 의 ADD CONSTRAINT ... NOT VALID 블록 재적용)
