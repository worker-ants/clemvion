-- V102: trigger.endpoint_path 에 v4 UUID 형식 CHECK 제약 추가 (NOT VALID).
-- (ai-review 2026-06-27 PR #738 INFO #3 후속 —
--  plan/in-progress/trigger-endpoint-path-review-carryover.md)
--
-- 배경: webhook endpoint_path 는 워크스페이스 무관 전역 라우팅 키이자 공개
-- (auth_config_id IS NULL) 트리거의 사실상 비밀 키다(Spec Webhook WH-SC-01).
-- DTO 가 @IsUUID('4') 로 형식을 강제하지만(WH-MG-02), ValidationPipe 를 우회하는
-- 경로(직접 repository write 등)로 비-UUID 값이 DB 에 기록되는 것을 DB 레벨에서도
-- 차단해 이중 방어한다.
--
-- 운영 안전 — NOT VALID (VALIDATE 생략):
--   PR #738 이전 endpoint_path 는 free-form(@IsString/@MaxLength(255)) 이었으므로
--   레거시 row 에 비-UUID 값(슬러그 등)이 남아 있을 수 있다. NOT VALID 로 추가하면
--   짧은 ACCESS EXCLUSIVE lock 만 사용하고 **신규 INSERT/UPDATE 에만** 제약을 강제하며
--   기존 행은 검증하지 않아 배포가 안전하다 (운영 DB 사전 전수 조회 불가).
--   → 추후 운영에서 endpoint_path 전수 UUID 클린을 확인한 뒤 별도 마이그레이션으로
--     `ALTER TABLE trigger VALIDATE CONSTRAINT chk_trigger_endpoint_path_uuid;` 승격 가능.
--
-- NULL 허용: schedule·manual 타입 트리거는 endpoint_path 가 NULL 이다.
--
-- v4 UUID 정규식: version nibble(3번째 그룹 첫 char)=4, variant nibble(4번째 그룹
-- 첫 char)∈{8,9,a,b}. class-validator 의 isUUID('4') 와 동일 형식. 대소문자 무시(~*).
--
-- IF EXISTS / IF NOT EXISTS 가드로 재실행(부분 적용 복구) 안전.

ALTER TABLE trigger DROP CONSTRAINT IF EXISTS chk_trigger_endpoint_path_uuid;

ALTER TABLE trigger
    ADD CONSTRAINT chk_trigger_endpoint_path_uuid
    CHECK (
        endpoint_path IS NULL
        OR endpoint_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
    NOT VALID;

-- DOWN:
-- ALTER TABLE trigger DROP CONSTRAINT IF EXISTS chk_trigger_endpoint_path_uuid;
