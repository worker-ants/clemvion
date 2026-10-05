-- V141: 워크플로우를 가리키는 범위 참조 넷의 단일 FK 를 복합 FK 로 바꾼다(NOT VALID)
--
-- NERV CLE-PLAT-DATA Rationale 「워크스페이스 범위 참조를 복합 FK 로도 막는다 (2026-10-05)」, NERV Task CLE-T-QTRRE6.
--
-- V141~V146 은 부모마다 한 파일이다. 아래 «공통» 은 여섯 파일 모두에 해당한다. 기존 행 검증은 V147 이다.
--   V141 workflow     ← trigger.workflow_id, alert_rule.workflow_id, workflow_assistant_session.workflow_id,
--                       workflow_test_dataset.workflow_id
--   V142 auth_config  ← trigger.auth_config_id
--   V143 folder       ← workflow.folder_id, folder.parent_id
--   V144 model_config ← workflow_assistant_session.llm_config_id, knowledge_base 의 모델 설정 참조 넷
--   V145 trigger      ← schedule.trigger_id
--   V146 node         ← node.container_id, node.tool_owner_id, edge.source_node_id, edge.target_node_id
--
-- 공통 — 목적: 저장 시점 검사(「참조의 소속」)를 빠뜨린 쓰기 경로가 다른 워크스페이스 · 다른 워크플로우의 행을 가리키지 못하게
-- DB 가 한 번 더 막는다. 자식 `(참조, 범위)` 가 부모 `(id, 범위)` 를 가리킨다. 범위는 워크스페이스 참조가 `workspace_id`, 노드
-- 구조 참조와 연결선 끝점이 `workflow_id` 다. 위반(SQLSTATE 23503)은 저장 시점 검사가 먼저 막지 못한 서버 결함이라 전역 예외
-- 필터가 500 으로 낸다. 검사 뒤에 부모가 동시에 지워지는 경합도 같은 23503 이다(단일 FK 때도 같았다).
--
-- 공통 — 삭제 동작은 바꾸지 않는다. SET NULL 은 `ON DELETE SET NULL (참조 컬럼)` 으로 참조 컬럼만 비운다. 자식의 범위 컬럼은
-- NOT NULL 이라 컬럼 목록 없이 쓰면 부모 삭제가 실패한다. 이 문법은 PostgreSQL 15 부터라 V134 가 서버 버전을 먼저 본다.
-- `ON UPDATE` 는 지금처럼 NO ACTION 이다. 부모 · 자식의 범위 컬럼을 바꾸는 쓰기 경로는 없다.
--
-- 공통 — 이름: FK 는 `fk_<자식 테이블>_<참조 컬럼>`, UNIQUE 는 `uq_<부모 테이블>_id_<범위 컬럼>` 이다. 파일마다 옛 이름과의 대응을
-- 적는다. 옛 FK 는 `IF EXISTS` 없이 지운다. 운영 DB 의 이름이 e2e 와 다르면 조용히 단일 FK 를 남기는 대신 여기서 실패한다.
--
-- 공통 — 잠금: 부모 UNIQUE 를 붙이면 부모에 ACCESS EXCLUSIVE 가, 옛 FK 를 지우면 자식과 부모에 ACCESS EXCLUSIVE 가 잡힌다
-- (2026-10-05 pg_locks 로 확인). 잡은 잠금은 파일이 커밋할 때까지 유지된다. 한 트랜잭션에 모으면 모든 핵심 테이블이 함께
-- 잠기므로 부모마다 파일을 나눴다. NOT VALID 라 기존 행을 읽지 않아 잠금을 쥐는 시간은 카탈로그 갱신뿐이다(노드 · 연결선
-- 10만 행에서 파일마다 2~3 ms, 여섯 합계 약 14 ms. 행을 넣은 직후의 첫 회는 V146 이 416 ms 였다. 2026-10-05 실측).
-- `SET LOCAL lock_timeout = '3s'` 는 잠금 하나를 기다리는 한도이고 파일 전체의 한도가 아니다. 앞서 잡은 잠금을 쥔 채 다음 잠금을
-- 3초까지 기다릴 수 있고 그동안 앞 테이블을 쓰는 요청이 함께 기다린다. 잠그는 순서가 앱 트랜잭션과 엇갈리면 드물게 교착이 나고
-- PostgreSQL 이 한쪽을 중단한다(앱 요청이면 500). 그래서 트래픽이 적을 때 배포한다. 한도를 넘기거나 교착으로 중단되면 그 파일만
-- 바뀌는 것 없이 실패하고 앞 파일의 복합 FK 는 남는다. 남은 참조는 옛 단일 FK 가 그대로 막는다. 다시 돌리면 실패한 파일부터
-- 이어진다. LOCAL 이라 다음 파일에 남지 않는다.
--
-- 옛 이름 → 새 이름, 삭제 동작:
--   trigger_workflow_id_fkey                    → fk_trigger_workflow_id                     CASCADE
--   alert_rule_workflow_id_fkey                 → fk_alert_rule_workflow_id                  CASCADE
--   workflow_assistant_session_workflow_id_fkey → fk_workflow_assistant_session_workflow_id  CASCADE
--   workflow_test_dataset_workflow_id_fkey      → fk_workflow_test_dataset_workflow_id       CASCADE
SET LOCAL lock_timeout = '3s';

-- 1) 부모 UNIQUE — V135 가 만든 인덱스를 같은 이름의 제약으로 붙인다
ALTER TABLE workflow ADD CONSTRAINT uq_workflow_id_workspace_id UNIQUE USING INDEX uq_workflow_id_workspace_id;

-- 2) 자식 FK — 자식 테이블마다 한 문장으로 옛 FK 를 지우고 복합 FK 를 더한다
ALTER TABLE trigger
  DROP CONSTRAINT trigger_workflow_id_fkey,
  ADD CONSTRAINT fk_trigger_workflow_id FOREIGN KEY (workflow_id, workspace_id)
    REFERENCES workflow (id, workspace_id) ON DELETE CASCADE NOT VALID;

ALTER TABLE alert_rule
  DROP CONSTRAINT alert_rule_workflow_id_fkey,
  ADD CONSTRAINT fk_alert_rule_workflow_id FOREIGN KEY (workflow_id, workspace_id)
    REFERENCES workflow (id, workspace_id) ON DELETE CASCADE NOT VALID;

ALTER TABLE workflow_assistant_session
  DROP CONSTRAINT workflow_assistant_session_workflow_id_fkey,
  ADD CONSTRAINT fk_workflow_assistant_session_workflow_id FOREIGN KEY (workflow_id, workspace_id)
    REFERENCES workflow (id, workspace_id) ON DELETE CASCADE NOT VALID;

ALTER TABLE workflow_test_dataset
  DROP CONSTRAINT workflow_test_dataset_workflow_id_fkey,
  ADD CONSTRAINT fk_workflow_test_dataset_workflow_id FOREIGN KEY (workflow_id, workspace_id)
    REFERENCES workflow (id, workspace_id) ON DELETE CASCADE NOT VALID;

-- DOWN: 복합 FK 를 지우고 옛 단일 FK 를 같은 이름 · 같은 삭제 동작으로 NOT VALID 로 되살린 뒤 따로 VALIDATE 한다
--   (migrations/README.md §1). 마지막에 부모 UNIQUE 제약을 지우면 그 인덱스도 함께 지워지므로 V135 DOWN 은 할 일이 없다.
--   SET LOCAL lock_timeout = '3s';
--   ALTER TABLE workflow_test_dataset DROP CONSTRAINT fk_workflow_test_dataset_workflow_id,
--     ADD CONSTRAINT workflow_test_dataset_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES workflow (id)
--       ON DELETE CASCADE NOT VALID;
--   ALTER TABLE workflow_assistant_session DROP CONSTRAINT fk_workflow_assistant_session_workflow_id,
--     ADD CONSTRAINT workflow_assistant_session_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES workflow (id)
--       ON DELETE CASCADE NOT VALID;
--   ALTER TABLE alert_rule DROP CONSTRAINT fk_alert_rule_workflow_id,
--     ADD CONSTRAINT alert_rule_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES workflow (id) ON DELETE CASCADE NOT VALID;
--   ALTER TABLE trigger DROP CONSTRAINT fk_trigger_workflow_id,
--     ADD CONSTRAINT trigger_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES workflow (id) ON DELETE CASCADE NOT VALID;
--   ALTER TABLE workflow DROP CONSTRAINT uq_workflow_id_workspace_id;   -- 제약과 함께 인덱스도 지워진다
--   -- 커밋한 뒤 별도 트랜잭션에서
--   ALTER TABLE workflow_test_dataset VALIDATE CONSTRAINT workflow_test_dataset_workflow_id_fkey;
--   ALTER TABLE workflow_assistant_session VALIDATE CONSTRAINT workflow_assistant_session_workflow_id_fkey;
--   ALTER TABLE alert_rule VALIDATE CONSTRAINT alert_rule_workflow_id_fkey;
--   ALTER TABLE trigger VALIDATE CONSTRAINT trigger_workflow_id_fkey;
