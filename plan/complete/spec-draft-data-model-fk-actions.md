---
title: 데이터 모델 §2 의 FK 삭제 동작 · 빠진 컬럼 · §3 Workspace 행, 그리고 통합 만료 알림의 유일 키 — 실제 DB 에 맞춘다
status: complete
owner: project-planner
worktree: spec-fact-fixes-9d2b71
started: 2026-09-19
completed: 2026-09-19
spec_impact:
  - spec/1-data-model.md
  - spec/2-navigation/4-integration.md
---

# 데이터 모델 §2 FK 삭제 동작 · 빠진 컬럼 · 만료 알림 유일 키

## 왜 지금

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 planner 항목 둘을 닫는다(둘 다 2026-09-19 등재).

1. «`spec/1-data-model.md` §2 Workspace `owner_id` 행이 삭제 동작을 적지 않는다» — 같은 항목에 합친 선택 과제: §3 표에
   Workspace 행이 없다 · frontmatter `code:` 에 엔티티 선언 가드 경로를 넣을지.
2. «`spec/2-navigation/4-integration.md` §11.2 «중복 방지» 가 없는 컬럼으로 유일 키를 적는다».

둘 다 **spec 이 실제 DB 와 다르게 적은 사실**이라 결정할 것이 없다.

## 방법 — 한 행이 아니라 §2 의 FK 행 전부

트래커는 Workspace `owner_id` 한 행을 적었다. 같은 클래스(«§2 의 FK 행이 삭제 동작을 적지 않거나 틀리게 적는다»)를 §2 전체로
훑었다. 실제 DB 는 일회용 PostgreSQL 18 에 V001~V132 를 적용한 것(카탈로그 `pg_constraint`).

- §2 에서 «FK» 를 적은 행 77개 중 실제 FK 는 **75개**(나머지 둘은 «FK 없음» 을 적은 행 — `Execution.single_node_id` · `SecretStore.workspace_id`).
  그 75개: 삭제 동작을 **틀리게** 적은 곳 **0** · 맞게 적은 곳 26 · **적지 않은 곳 49**(Workspace `owner_id` 는 그중 하나).
  체커(`--impl-prep` `review/consistency/2026/09/19/08_33_13`)는 «다른 User FK 행은 괄호로 적는 관례» 라 했지만 실측으로는
  적지 않는 쪽이 다수다 — 한 행만 고치면 표기가 더 들쭉날쭉해진다. 그래서 49행 전부에 넣는다.
- DB 에서는 FK 인데 §2 가 FK 로 적지 않은 컬럼 **셋**: `execution.re_run_of`(행은 있으나 `REFERENCES executions(id)` — 테이블명이
  틀렸다, 실제는 `execution`) · `document_chunk.knowledge_base_id` · `node_execution.parent_node_execution_id`(둘은 행 자체가 없다).
- 그래서 컬럼 완결성도 쟀다: §2 가 다루는 테이블의 DB 컬럼 **424개 중 6개**가 §2 에 없다 — 위 FK 둘 + `document_chunk.created_at` ·
  `workflow_assistant_message.auto_resumed` · `auto_resume_reason` · `auto_resume_attempt`. 반대 방향(§2 가 적었는데 DB 에 없는
  컬럼)은 **0**.
- 손대는 §2.22 표 안에서 하나 더: `finish_reason` 값 목록이 provider 값 다섯만 적는다. 서버가 합성해 쓰는 `error` · `auto_resume_pending`
  (`workflow-assistant-message.entity.ts` `FINISH_REASON_AUTO_RESUME_PENDING`, `assistant-turn-persistence.service.ts` JSDoc)이 빠졌다.

## 변경 — `spec/1-data-model.md`

### A. §2 FK 행 49개에 삭제 동작 (설명 칸만, 다른 칸 · 순서 그대로)

표기는 이미 적은 26행의 짧은 형(`(CASCADE)`)을 따른다. 기존 괄호가 있으면 그 안 맨 앞에 `동작 · ` 을 넣는다. 단 `FK →` 가 괄호
**안에** 있는 두 행(431 · 448 — «마지막 등장 청크 (FK → DocumentChunk)»)은 괄호 끝에 ` · 동작` 을 붙인다.

| 행 | 엔티티.컬럼 | 현재 설명 칸 (앞부분) | 바뀐 설명 칸 (앞부분) |
|---|---|---|---|
| 104 | Workspace.`owner_id` | FK → User | FK → User (CASCADE) |
| 115 | WorkspaceMember.`workspace_id` | FK → Workspace | FK → Workspace (CASCADE) |
| 116 | WorkspaceMember.`user_id` | FK → User | FK → User (CASCADE) |
| 126 | Workflow.`workspace_id` | FK → Workspace | FK → Workspace (CASCADE) |
| 131 | Workflow.`folder_id` | FK → Folder (정리용) | FK → Folder (SET NULL · 정리용) |
| 134 | Workflow.`created_by` | FK → User | FK → User (NO ACTION) |
| 143 | Folder.`workspace_id` | FK → Workspace | FK → Workspace (CASCADE) |
| 145 | Folder.`parent_id` | FK → Folder (중첩 폴더 지원) | FK → Folder (CASCADE · 중첩 폴더 지원) |
| 161 | Node.`workflow_id` | FK → Workflow | FK → Workflow (CASCADE) |
| 170 | Node.`container_id` | FK → Node. 컨테이너 노드(…) | FK → Node (SET NULL). 컨테이너 노드(…) |
| 171 | Node.`tool_owner_id` | FK → Node. AI Agent의 Tool Area에 등록된 경우 | FK → Node (SET NULL). AI Agent의 Tool Area에 등록된 경우 |
| 220 | Edge.`workflow_id` | FK → Workflow | FK → Workflow (CASCADE) |
| 221 | Edge.`source_node_id` | FK → Node (출력 노드) | FK → Node (CASCADE · 출력 노드) |
| 223 | Edge.`target_node_id` | FK → Node (입력 노드) | FK → Node (CASCADE · 입력 노드) |
| 239 | Trigger.`workspace_id` | FK → Workspace | FK → Workspace (CASCADE) |
| 240 | Trigger.`workflow_id` | FK → Workflow | FK → Workflow (CASCADE) |
| 246 | Trigger.`auth_config_id` | FK → AuthConfig (Webhook 인증) | FK → AuthConfig (SET NULL · Webhook 인증) |
| 265 | Schedule.`workspace_id` | FK → Workspace | FK → Workspace (CASCADE) |
| 266 | Schedule.`trigger_id` | FK → Trigger | FK → Trigger (CASCADE) |
| 300 | Integration.`workspace_id` | FK → Workspace | FK → Workspace (CASCADE) |
| 316 | Integration.`created_by` | FK → User | FK → User (NO ACTION) |
| 332 | IntegrationUsageLog.`node_execution_id` | FK → NodeExecution | FK → NodeExecution (CASCADE) |
| 333 | IntegrationUsageLog.`workflow_id` | FK → Workflow (비정규화, 조회 최적화) | FK → Workflow (CASCADE · 비정규화, 조회 최적화) |
| 351 | KnowledgeBase.`workspace_id` | FK → Workspace | FK → Workspace (CASCADE) |
| 354 | KnowledgeBase.`embedding_model_config_id` | FK → ModelConfig (kind=embedding). … | FK → ModelConfig (SET NULL · kind=embedding). … |
| 361 | KnowledgeBase.`extraction_llm_config_id` | FK → ModelConfig (kind=chat). … | FK → ModelConfig (SET NULL · kind=chat). … |
| 369 | KnowledgeBase.`rerank_config_id` | FK → ModelConfig (kind=rerank). … | FK → ModelConfig (SET NULL · kind=rerank). … |
| 372 | KnowledgeBase.`rerank_llm_config_id` | FK → ModelConfig (kind=chat). … | FK → ModelConfig (SET NULL · kind=chat). … |
| 381 | Document.`knowledge_base_id` | FK → KnowledgeBase | FK → KnowledgeBase (CASCADE) |
| 431 | Entity.`last_seen_chunk_id` | 마지막 등장 청크 (FK → DocumentChunk) | 마지막 등장 청크 (FK → DocumentChunk · SET NULL) |
| 445 | Relation.`head_entity_id` | FK → Entity | FK → Entity (CASCADE) |
| 446 | Relation.`tail_entity_id` | FK → Entity | FK → Entity (CASCADE) |
| 448 | Relation.`evidence_chunk_id` | 추출 근거 청크 (FK → DocumentChunk) | 추출 근거 청크 (FK → DocumentChunk · SET NULL) |
| 474 | Execution.`workflow_id` | FK → Workflow | FK → Workflow (CASCADE) |
| 475 | Execution.`trigger_id` | FK → Trigger (트리거에 의한 실행 시) | FK → Trigger (SET NULL · 트리거에 의한 실행 시) |
| 485 | Execution.`executed_by` | FK → User (수동 실행 시) | FK → User (NO ACTION · 수동 실행 시) |
| 486 | Execution.`parent_execution_id` | FK → Execution (서브 워크플로우 실행 시 부모 실행) | FK → Execution (SET NULL · 서브 워크플로우 실행 시 부모 실행) |
| 555 | NodeExecution.`execution_id` | FK → Execution | FK → Execution (CASCADE) |
| 556 | NodeExecution.`node_id` | FK → Node | FK → Node (CASCADE) |
| 583 | WorkflowVersion.`workflow_id` | FK → Workflow | FK → Workflow (CASCADE) |
| 587 | WorkflowVersion.`created_by` | FK → User | FK → User (NO ACTION) |
| 601 | ModelConfig.`workspace_id` | FK → Workspace | FK → Workspace (CASCADE) |
| 628 | AuthConfig.`workspace_id` | FK → Workspace | FK → Workspace (CASCADE) |
| 677 | AuditLog.`workspace_id` | FK → Workspace | FK → Workspace (CASCADE) |
| 678 | AuditLog.`user_id` | FK → User | FK → User (NO ACTION) |
| 733 | Notification.`workspace_id` | FK → Workspace | FK → Workspace (CASCADE) |
| 734 | Notification.`user_id` | FK → User (수신자) | FK → User (NO ACTION · 수신자) |
| 756 | AssistantSession.`user_id` | FK → User — 세션 생성자 | FK → User (CASCADE) — 세션 생성자 |
| 758 | AssistantSession.`llm_config_id` | FK → ModelConfig (kind=chat) — … | FK → ModelConfig (SET NULL · kind=chat) — … |

`NO ACTION` 여섯은 모두 User 를 가리킨다 — 참조가 남아 있으면 유저 삭제가 막힌다. 같은 문서 Rationale «쓸 인덱스가 없는 FK
서른하나의 처분» 이 적은 «user 참조 FK» 의 삭제 동작과 같은 사실이다(유저 삭제 앱 경로가 생기면 그 절이 재처분한다).

### B. FK 표기가 없거나 틀린 컬럼

- **§2.13 Execution `re_run_of` (488행)**: 설명 칸 머리 «`REFERENCES executions(id) ON DELETE SET NULL`.» →
  «FK → Execution (SET NULL).» — 테이블은 `execution`(단수)이다. 뒤 문장은 그대로.

### C. §2 에 없는 컬럼 여섯 — 행 추가

- **§2.12.1 DocumentChunk**, `document_id` 행 아래:
  `| knowledge_base_id | UUID | FK → KnowledgeBase (CASCADE). 청크가 속한 KB — 적재 때 문서의 KB 를 함께 적는다(비정규화, V005 · 인덱스 `idx_document_chunk_kb`) |`
  (근거: `embedding.service.ts` 의 `INSERT INTO document_chunk (document_id, knowledge_base_id, …)` — `kb.id` 는 `doc.knowledgeBaseId` 로 찾은 KB)
- **§2.12.1 DocumentChunk**, `metadata` 행 아래: `| created_at | Timestamp | 생성 시각 |`
- **§2.14 NodeExecution**, `node_id` 행 아래:
  `| parent_node_execution_id | UUID? | FK → NodeExecution (SET NULL). 이 행을 묶는 그룹 노드의 NodeExecution — Sub-Workflow(인라인 실행) · Background(본문 서브그래프) · Parallel(브랜치) 노드가 자기 행 id 를 자식 행에 찍어, 실행 결과 타임라인이 자식을 부모 아래로 묶는다. 부모 행이 지워져도 자식 이력은 남고 묶음만 잃는다(V012) |`
  (근거: V012 헤더 주석. 값을 **새로 정하는** 곳은 `execution-engine.service.ts` 셋 — 인라인 Sub-Workflow(`workflow.handler.ts` 가 넘긴
  `context.nodeExecutionId`) · Background(«Resolve the Background node's NodeExecution id») · Parallel(«mirrors the Background node's
  parentNodeExecutionId stamping»). 나머지 쓰기는 이미 정해진 값을 전달·복원한다(재개 · 폼 · 버튼 · AI 턴). `nodes/` 안에서 이 값을 찍는 핸들러는
  `workflow.handler.ts` 하나 — Loop 는 생산자가 아니다. 이 서술은 `spec/4-nodes/1-logic/12-background.md` 88 · 164행과 맞는다)
- **§2.22 AssistantMessage**, `finish_reason` 행 아래 셋 (근거: V020, `spec/3-workflow-editor/4-ai-assistant.md` §6.0):
  - `| auto_resumed | Boolean | stall 자동 복구로 **새로 시작된** assistant row 면 true(기본 false). 복구 직전까지의 row 는 false — 응답 필드 `autoResumed` (V020) |`
  - `| auto_resume_reason | String? | `auto_resumed=true` row 에서만. 현재 `stall_pending_steps` 한 종류 (V020) |`
  - `| auto_resume_attempt | Integer? | `auto_resumed=true` row 에서만. 턴 안의 복구 시도 순번(1부터) (V020) |`

### D. §2.22 `finish_reason` 값 목록 (817행)

«`stop` / `tool_calls` / `length` / `content_filter` / `aborted` — role=assistant에만» →
«provider 값 `stop` / `tool_calls` / `length` / `content_filter` / `aborted` 와 서버 합성 마커 `error`(턴이 에러로 끝남 — 예: 라운드
한도 초과) · `auto_resume_pending`(stall 복구로 쪼개진 턴의 중간 row) — role=assistant에만»
(근거: `workflow-assistant-stream.service.ts` 가 라운드 한도 초과 때 `persistAssistantTurn(…, 'error', …)` 로 저장한다)

### E. §3 «인덱스 전략» 표 — Workspace 행 추가 (표 첫 행, WorkspaceMember 행 **위** — §2 선언 순서를 따른다)

`| Workspace | (owner_id) UNIQUE WHERE type = 'personal' | personal 워크스페이스는 owner 당 1개 — DB 가 강제하고 앱(find-or-create)이 이중 방어한다. team 은 한 사용자가 여럿 가질 수 있어 부분 UNIQUE 다([data-flow §personal 유일성](./data-flow/12-workspace.md)). CONCURRENTLY, V109 |`

### F. §3 NodeExecution `(parent_node_execution_id)` 행의 목적 (921행) — `--spec` `09_59_18` WARNING 1 의 근거를 따라가다 찾음

«부모 NodeExecution 별 자식 조회 (sub-workflow/loop 등). V012» → «부모 NodeExecution 별 자식 조회 (Sub-Workflow · Background ·
Parallel 노드의 자식). V012». Loop 는 이 값을 찍지 않는다(위 C 의 근거).

### G. `## Rationale` 맨 위에 «§2 FK 삭제 동작 · 빠진 컬럼 (2026-09-19)» — 방법 · 결과(틀림 0 · 누락 49) · 표기 규칙 · 통일하지 않은
기존 표기 · 대조하지 않은 범위를 짧게 적는다(`--spec` `09_59_18` INFO 5 — 비대상 결정을 spec 에 남겨 재작업을 막는다).

## 변경 — `spec/2-navigation/4-integration.md` §11.2 (1006행)

«**중복 방지**: `(integration_id, threshold_key)`로 유니크 판정. 임계치별 최대 1회.» →
«**중복 방지**: `integration_expiry_dispatch` 의 `UNIQUE (integration_id, threshold, token_expires_at)`(V009)로 판정한다 — 임계
(`7d`·`3d`·`0d`)마다 **같은 만료 시각에 대해** 최대 1회. 재인증으로 `token_expires_at` 이 바뀌면 새 만료 시각의 임계가 다시 발사된다.
발사 전 `INSERT … ON CONFLICT DO NOTHING` 으로 claim 하고, 충돌하면 그 임계를 건너뛴다(`[data-flow §1.4](../data-flow/5-integration.md#14-oauth-만료-스캐너-bullmq-integration-expiry-scanner)`).»

`threshold_key` 컬럼은 없다. `spec/data-flow/5-integration.md` 341행 · `8-notifications.md` 90행은 이미 세 컬럼과 «재인증 시 재발사» 를
맞게 적는다 — 이 줄만 어긋났다(`grep -rn threshold_key spec/` 1건).

## 비대상

- **표기 통일**: 이미 적은 26행은 짧은 형 `(CASCADE)` · 긴 형 `(ON DELETE CASCADE)` · `(cascade 삭제)` · `**SET NULL** — …` 가 섞여
  있다. 사실이 맞으므로 이번에 손대지 않는다 — 새로 넣는 49행만 다수형(짧은 형)을 따른다.
- **§2 밖의 FK 삭제 동작 서술**(`data-flow/*` 등)은 대조하지 않았다. 이번 대조의 범위는 §2 표다.
- **§2 의 값 목록(enum · 마커) 전수 대조**는 하지 않았다. D 는 손대는 §2.22 표 안에서 본 한 건이다.
- **frontmatter `code:` 에 `entity-schema-declarations.e2e-spec.ts` 넣기**: 넣지 않는다. 이 문서의 `code:` 는 엔티티 · 마이그레이션 glob
  둘뿐이고, 이 문서를 지키는 e2e 가 이미 셋이다(`deletion-cascade-indexes` · `trigger-endpoint-path-dedupe` · 새 가드) — 하나만 넣으면
  어긋나고, 셋을 넣으면 그 파일들의 변경이 `--impl-done` 을 부르게 되는 게이트 범위 결정이 된다. 사실 정정 PR 에서 정할 일이 아니다.

## Rationale

- **49행 전부인 이유**: 트래커의 근거(«다른 행은 적는 관례») 가 실측으로 반증됐다(26 대 49). 한 행만 고치면 «CASCADE 를 적은 행과
  안 적은 행» 의 구분에 의미가 있는 것처럼 읽힌다 — 실제로는 우연이다. 전부 적으면 §2 만 보고 삭제 연쇄를 따라갈 수 있다.
- **틀린 곳이 0 이라는 것도 기록한다**: 적은 26행은 모두 맞았다. 이 PR 은 누락을 메울 뿐 기존 서술을 반박하지 않는다.
- **표기는 다수형**: 짧은 형이 이미 적은 26행의 다수다. 기존 괄호 안에 넣는 형(`(SET NULL · 정리용)`)은 괄호 겹침을 피하려는 것이다.

## 체크리스트

- [x] `--spec` 이 draft — `review/consistency/2026/09/19/09_59_18` **BLOCK: NO** (Critical 0 · WARNING 1 · INFO 11). 반영:
      WARNING 1(`parent_node_execution_id` 생산자를 Sub-Workflow 로만 적음) → C 를 셋으로 넓히고, 그 근거를 따라가다 §3 의 «loop» 가
      틀린 것을 찾아 F 로 고쳤다(체커는 §3 을 «이미 열려 있다» 고 읽었다 — 열린 게 아니라 틀렸다). INFO 4(77 ≠ 26+49) → «방법» 에
      FK 75 + «FK 없음» 2 로 적었다 · INFO 6(괄호 안 두 행 예외) → A 머리말 · INFO 11(§3 행 위치) → E 를 표 첫 행으로 · INFO 5 → G ·
      INFO 10(`code:` 보류가 트래커에서 사라짐) → 트래커 새 항목. INFO 3 · 7 · 8 · 9 는 이 PR 밖(§6.0 요약 문구 · 표기 규약 승격 ·
      다른 plan 의 줄 번호 인용 · 문서 크기 추세)
- [x] spec 반영 · 적용 뒤 대조 재실행 — FK 행 삭제 동작 틀림 0 · 누락 0 · 맞음 78(75 + 새로 FK 로 적은 셋) · DB FK 중 §2 가 FK 로
      적지 않은 것 0 · 컬럼 누락은 파서가 합친 행(`created_at / updated_at`)을 못 읽은 둘뿐 · `threshold_key` 0건
- [x] 트래커 두 항목 닫기(해소 기록) · `code:` 등재 결정을 새 항목으로 · 이 draft `plan/complete/` 로
