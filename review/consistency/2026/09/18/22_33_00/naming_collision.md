# 신규 식별자 충돌 검토 — spec-draft-fk-remaining-dispositions

## 검토 방법

target draft 가 새로 도입하는 식별자를 6개 관점(요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수/설정키·파일 경로)으로
분류하고, 각각을 저장소 전체(codebase/spec/plan, `origin/main` 포함)에서 직접 grep 대조했다. draft 본문이 "그 항목들은
`codebase/`·`spec/`·`plan/` grep 0건" 이라 자체 주장하고 있어, 그 주장 자체를 독립적으로 재현했다.

## 새로 도입되는 식별자 목록

1. 마이그레이션 버전 `V121`~`V130` (파일명 `V1XX__*.sql`/`.conf`)
2. 인덱스 이름 10개: `idx_edge_target_node_id` · `idx_llm_usage_log_llm_config_id` · `idx_workflow_folder_id` ·
   `idx_folder_parent_id` · `idx_workflow_assistant_session_llm_config_id` · `idx_trigger_auth_config_id` ·
   `idx_auth_config_workspace_id` · `idx_knowledge_base_workspace_id` · `idx_workspace_member_user_id` ·
   `idx_model_config_workspace_kind`
3. Rationale 새 절 제목 `쓸 인덱스가 없는 FK 서른하나의 처분 (2026-09-18)`
4. plan draft 파일 경로 `plan/in-progress/spec-draft-fk-remaining-dispositions.md` (완료 시 `plan/complete/` 이동 예정)
5. 트래커에 새로 올리는 항목 제목 둘 — 「웹훅 트리거 조회가 `endpoint_path` 인덱스 전체를 훑는다」·「`WorkflowAssistantSession`
   `@Index` 데코레이터의 `userId` 누락」

(신규 API endpoint·엔티티/DTO·webhook/queue/sse 이벤트명·ENV var 는 이 draft 가 도입하지 않는다 — 순수 DB 인덱스·spec 정정.)

## 발견사항

- **[INFO]** 새 식별자 전수 — grep 0건 확인, 충돌 없음
  - target 신규 식별자: 위 목록 1~4 전부
  - 기존 사용처: 없음 (실측)
  - 상세:
    - `V121`~`V130` — `ls codebase/backend/migrations`(sorted -V) 로 실측한 현재 최신은 `V120__relation_tail_entity_id_index.{sql,conf}`.
      `origin/main`(`6f97cb619`, 이 draft 가 착수 시점으로 인용한 커밋과 동일 SHA)의 `git ls-tree` 도 `V120` 이 최신이다. 저장소 전체
      grep(`grep -rn "V12[1-9]\|V130"`)에 이 draft 파일 밖에서 매치되는 곳이 없다. 다른 `plan/in-progress/*` 문서도 `V121` 을
      언급하지 않는다 — 병렬 세션이 같은 번호를 먼저 점유했을 위험도 현재로선 없다.
    - 인덱스 이름 10개 — `grep -rn` 을 `codebase`·`spec`·`plan` 전체에 걸었고, 매치는 이 draft 파일 한 줄뿐이다. 기존
      `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` 의 `EXPECTED` 배열(V111~V120 계열 9개: `idx_node_execution_node_id` ·
      `idx_integration_usage_log_node_execution_id` · `idx_integration_usage_log_workflow_id` · `idx_llm_usage_log_node_execution_id` ·
      `idx_llm_usage_log_execution_id` · `idx_entity_last_seen_chunk_id` · `idx_relation_evidence_chunk_id` · `idx_relation_head_entity_id` ·
      `idx_relation_tail_entity_id`)와도 컬럼 조합이 겹치지 않는다(예: `idx_llm_usage_log_llm_config_id` 는 기존
      `idx_llm_usage_log_{node_execution_id,execution_id}` 와 다른 컬럼). 이름 규약(`idx_<table>_<col…>`, V111~V120 이 세운 선례)도
      그대로 따른다 — `idx_model_config_workspace_kind` 는 기존 부분 UNIQUE `model_config_workspace_kind_default_unique`(V089, `idx_`
      접두 없음·조건 다름)와 문자열도 의미도 겹치지 않는다.
    - Rationale 절 제목 — `spec/1-data-model.md` 의 `### ` 제목 전수(`### 2.1 User` ~ `### install_token 형식`, `그래프 RAG 삭제 연쇄의
      FK 인덱스 넷` · `삭제 연쇄의 FK 인덱스 다섯` · `Trigger (workflow_id) 인덱스` 포함) 중 겹치는 것이 없다.
    - plan 파일 경로 — `plan/in-progress/`·`plan/complete/` 어디에도 `spec-draft-fk-remaining-dispositions.md` 동명 파일이 없다
      (완료 이동 목적지도 비어 있음을 확인).
  - 제안: 없음 — 현 상태 유지.

- **[INFO]** 트래커 신규 항목 제목 — 근접 항목과 구별되지만 위치 확인 권장
  - target 신규 식별자: 「웹훅 트리거 조회가 `endpoint_path` 인덱스 전체를 훑는다」 · 「`WorkflowAssistantSession` `@Index` 데코레이터의
    `userId` 누락」 (두 항목 모두 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 신설 예정)
  - 기존 사용처: 같은 트래커 안에 `endpoint_path` 409 충돌 e2e 항목(트래커 681행 부근, «트리거 `endpoint_path` 409 충돌에 e2e 가 없다»
    — 이미 `[x]` 완료)과 트리거 `(workflow_id)` 인덱스 항목(트래커 4589행 부근, 이미 `[x]` V111 로 해소)이 존재하지만, 둘 다 이
    draft 가 올리려는 항목(«`workspace_id` 를 모르는 조회가 `endpoint_path` 인덱스 전체를 스캔한다»)과 주제·컬럼 조합이 다르다 —
    이름·의미 충돌 아님.
  - 상세: 신규 항목 자체는 트래커 안에서 유일한 제목이라 텍스트 충돌은 없다. 다만 이 트래커 파일이 5,000줄에 근접하는 대형 문서라
    (draft S4/트래커 반영 절 자체는 grep 으로 자동 검증하지 않았음) 새 항목을 추가하는 시점에 사람이 직접 위치를 골라야 하며, 이건
    naming collision 범위 밖(구조/배치 이슈)이라 이 checker 의 판정 대상은 아니다.
  - 제안: 별도 검토자(구조/스코프)에게 배치 확인을 맡기고, naming 관점에서는 조치 불필요.

## 요약

이 draft 는 순수 DB 인덱스 신설 + spec 정정 draft 로, 신규 API endpoint·엔티티/DTO·이벤트명·환경변수를 전혀 도입하지 않는다.
도입하는 새 식별자는 마이그레이션 번호(V121~V130), 인덱스 이름 10개, Rationale 절 제목 하나, plan 파일 경로 하나로 좁게
한정되며, 저장소 전체(codebase/spec/plan, `origin/main` 포함)를 grep 으로 전수 대조한 결과 기존 사용처와 겹치는 것이 하나도
없었다 — draft 본문의 자체 검증 주장("grep 0건")이 독립적으로 재현됐다. 명명 규약(`idx_<table>_<column>`)도 V111~V120 선례를
그대로 따라 일관성을 해치지 않는다. 신규 식별자 충돌 관점에서 이 draft 는 문제가 없다.

## 위험도

NONE
