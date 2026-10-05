-- V142: 인증 설정을 가리키는 트리거 auth_config_id 의 단일 FK 를 복합 FK 로 바꾼다(NOT VALID)
--
-- NERV CLE-PLAT-DATA Rationale 「워크스페이스 범위 참조를 복합 FK 로도 막는다 (2026-10-05)」, NERV Task CLE-T-QTRRE6.
--
-- 목적 · 삭제 동작 · 이름 · 잠금은 V141 머리의 «공통» 을 따른다. 기존 행 검증은 V147 이다.
--
-- 옛 이름 → 새 이름, 삭제 동작:
--   fk_trigger_auth_config → fk_trigger_auth_config_id  SET NULL (auth_config_id)
SET LOCAL lock_timeout = '3s';

-- 1) 부모 UNIQUE — V136 이 만든 인덱스를 같은 이름의 제약으로 붙인다
ALTER TABLE auth_config ADD CONSTRAINT uq_auth_config_id_workspace_id UNIQUE USING INDEX uq_auth_config_id_workspace_id;

-- 2) 자식 FK
ALTER TABLE trigger
  DROP CONSTRAINT fk_trigger_auth_config,
  ADD CONSTRAINT fk_trigger_auth_config_id FOREIGN KEY (auth_config_id, workspace_id)
    REFERENCES auth_config (id, workspace_id) ON DELETE SET NULL (auth_config_id) NOT VALID;

-- DOWN: 옛 FK 를 NOT VALID 로 되살리고 커밋한 뒤 따로 VALIDATE 한다. 제약을 지우면 인덱스도 지워지므로 V136 DOWN 은 할 일이 없다.
--   SET LOCAL lock_timeout = '3s';
--   ALTER TABLE trigger DROP CONSTRAINT fk_trigger_auth_config_id,
--     ADD CONSTRAINT fk_trigger_auth_config FOREIGN KEY (auth_config_id) REFERENCES auth_config (id) ON DELETE SET NULL NOT VALID;
--   ALTER TABLE auth_config DROP CONSTRAINT uq_auth_config_id_workspace_id;
--   -- 커밋한 뒤
--   ALTER TABLE trigger VALIDATE CONSTRAINT fk_trigger_auth_config;
