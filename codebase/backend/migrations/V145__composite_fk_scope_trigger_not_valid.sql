-- V145: 트리거를 가리키는 스케줄 trigger_id 의 단일 FK 를 복합 FK 로 바꾼다(NOT VALID)
--
-- NERV CLE-PLAT-DATA Rationale 「워크스페이스 범위 참조를 복합 FK 로도 막는다 (2026-10-05)」, NERV Task CLE-T-QTRRE6.
--
-- 목적 · 삭제 동작 · 이름 · 잠금은 V141 머리의 «공통» 을 따른다. 기존 행 검증은 V147 이다.
--
-- 옛 이름 → 새 이름, 삭제 동작:
--   schedule_trigger_id_fkey → fk_schedule_trigger_id  CASCADE
SET LOCAL lock_timeout = '3s';

-- 1) 부모 UNIQUE — V139 가 만든 인덱스를 같은 이름의 제약으로 붙인다
ALTER TABLE trigger ADD CONSTRAINT uq_trigger_id_workspace_id UNIQUE USING INDEX uq_trigger_id_workspace_id;

-- 2) 자식 FK
ALTER TABLE schedule
  DROP CONSTRAINT schedule_trigger_id_fkey,
  ADD CONSTRAINT fk_schedule_trigger_id FOREIGN KEY (trigger_id, workspace_id)
    REFERENCES trigger (id, workspace_id) ON DELETE CASCADE NOT VALID;

-- DOWN: 옛 FK 를 NOT VALID 로 되살리고 커밋한 뒤 따로 VALIDATE 한다. 제약을 지우면 인덱스도 지워지므로 V139 DOWN 은 할 일이 없다.
--   SET LOCAL lock_timeout = '3s';
--   ALTER TABLE schedule DROP CONSTRAINT fk_schedule_trigger_id,
--     ADD CONSTRAINT schedule_trigger_id_fkey FOREIGN KEY (trigger_id) REFERENCES trigger (id) ON DELETE CASCADE NOT VALID;
--   ALTER TABLE trigger DROP CONSTRAINT uq_trigger_id_workspace_id;
--   -- 커밋한 뒤
--   ALTER TABLE schedule VALIDATE CONSTRAINT schedule_trigger_id_fkey;
