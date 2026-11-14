---
id: "CLE-PLAT-DATA-FK"
title: "데이터 모델 개요 — 외래 키와 범위 제약"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-PLAT-DATA"
ancestors: ["CLE-VISION", "CLE-PLAT", "CLE-PLAT-DATA"]
area: "CLE-PLAT"
content_hash: "f706a38488dd60a0c1365fd8c57fb897e3ab70d8803e399d90f9fdeffb080218"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "e6e31c95b368edbfcd851696fd51e710b33019a9b8a135282ea49e9d71f05f4c"
etag: "sha256-6883f522c58a51dba1d4a1d90a05471875180ae11f9260e7a3c27f8e40778a7c"
---
## 개요

이 문서는 [데이터 모델 개요](CLE-PLAT-DATA.md) 의 하위 문서로 범위 참조 열일곱을 막는 복합 FK 와 부모별 FK 삭제 동작을 정한다. 요청 본문 참조의 저장 시점 검사는 [참조의 소속](CLE-PLAT-DATA-REFSCOPE.md#참조의-소속) 이 정한다.

## 범위 참조의 DB 제약

저장 시점 검사 뒤에 DB 가 범위 참조 열일곱을 복합 FK 로 한 번 더 막는다. 자식의 `(참조, 범위 컬럼)` 이 부모의 `(id, 범위 컬럼)` 을 가리킨다. 범위 컬럼은 워크스페이스 범위가 `workspace_id`, 같은 워크플로우 범위가 `workflow_id` 다. 위반(SQLSTATE 23503)은 저장 시점 검사가 먼저 막지 못한 서버 결함이라 500 `INTERNAL_ERROR` 로 응답하고 서버 로그에 제약 이름을 남긴다. 새 에러 코드는 없다. 삭제 동작은 [FK 삭제 동작](#fk-삭제-동작) 그대로다. SET NULL 은 `ON DELETE SET NULL (참조 컬럼)` 으로 참조 컬럼만 비운다(PostgreSQL 15 이상).

| 자식 · 참조 컬럼 | 부모 | 범위 컬럼 | 삭제 동작 | 제약 |
| --- | --- | --- | --- | --- |
| Trigger `workflow_id` | Workflow | `workspace_id` | CASCADE | `fk_trigger_workflow_id` |
| Trigger `auth_config_id` | AuthConfig | `workspace_id` | SET NULL | `fk_trigger_auth_config_id` |
| Schedule `trigger_id` | Trigger | `workspace_id` | CASCADE | `fk_schedule_trigger_id` |
| AlertRule `workflow_id` | Workflow | `workspace_id` | CASCADE | `fk_alert_rule_workflow_id` |
| Workflow `folder_id` | Folder | `workspace_id` | SET NULL | `fk_workflow_folder_id` |
| Folder `parent_id` | Folder | `workspace_id` | CASCADE | `fk_folder_parent_id` |
| AssistantSession `workflow_id` | Workflow | `workspace_id` | CASCADE | `fk_workflow_assistant_session_workflow_id` |
| AssistantSession `llm_config_id` | ModelConfig | `workspace_id` | SET NULL | `fk_workflow_assistant_session_llm_config_id` |
| KnowledgeBase `embedding_model_config_id` | ModelConfig | `workspace_id` | SET NULL | `fk_knowledge_base_embedding_model_config_id` |
| KnowledgeBase `extraction_llm_config_id` | ModelConfig | `workspace_id` | SET NULL | `fk_knowledge_base_extraction_llm_config_id` |
| KnowledgeBase `rerank_config_id` | ModelConfig | `workspace_id` | SET NULL | `fk_knowledge_base_rerank_config_id` |
| KnowledgeBase `rerank_llm_config_id` | ModelConfig | `workspace_id` | SET NULL | `fk_knowledge_base_rerank_llm_config_id` |
| WorkflowTestDataset `workflow_id` | Workflow | `workspace_id` | CASCADE | `fk_workflow_test_dataset_workflow_id` |
| Node `container_id` | Node | `workflow_id` | SET NULL | `fk_node_container_id` |
| Node `tool_owner_id` | Node | `workflow_id` | SET NULL | `fk_node_tool_owner_id` |
| Edge `source_node_id` | Node | `workflow_id` | CASCADE | `fk_edge_source_node_id` |
| Edge `target_node_id` | Node | `workflow_id` | CASCADE | `fk_edge_target_node_id` |

부모 여섯에는 `(id, 범위 컬럼)` UNIQUE 가 있다([인덱스 목록](CLE-PLAT-DATA-INDEX.md#인덱스-목록)). 이 열일곱과 여섯의 제약 이름은 FK 가 `fk_<자식 테이블>_<참조 컬럼>`, UNIQUE 가 `uq_<부모 테이블>_id_<범위 컬럼>` 이다. DB 제약이 보지 않는 것은 저장 시점 검사만 본다. 모델 설정의 `kind`, 캔버스 저장의 «이번 페이로드의 노드», 같은 워크플로우의 다른 노드를 가리키는 구조 참조가 그렇다. 표의 열일곱 가운데 스케줄 `trigger_id` 는 서버가 채우고 테스트 데이터셋 `workflow_id` 는 경로 파라미터로 정해져 [참조의 소속](CLE-PLAT-DATA-REFSCOPE.md#참조의-소속) 의 요청 본문 표에 없다. 테스트 데이터셋 서비스는 그 워크플로우가 요청의 워크스페이스에 없으면 404 `RESOURCE_NOT_FOUND` 를 낸다. 결정의 근거는 [Rationale](#워크스페이스-범위-참조를-복합-fk-로도-막는다-2026-10-05) 에 있다.

## FK 삭제 동작

부모 행을 지울 때 자식 행이 어떻게 되는지를 부모별로 모은다. CASCADE 는 함께 지워지고, SET NULL 은 FK 만 비워지고, NO ACTION 은 참조하는 행이 있으면 부모 삭제를 거부한다.

| 부모 | CASCADE | SET NULL | NO ACTION |
| --- | --- | --- | --- |
| User | Workspace.`owner_id` · WorkspaceMember.`user_id` · WorkflowTestDataset.`owner_id` · RefreshToken.`user_id` · LoginHistory.`user_id` · AssistantSession.`user_id` · WebAuthnCredential.`user_id` | AlertRule.`created_by` · WorkspaceInvitation.`invited_by` · WorkspaceInvitation.`accepted_by` | Workflow.`created_by` · Integration.`created_by` · Execution.`executed_by` · WorkflowVersion.`created_by` · AuditLog.`user_id` · Notification.`user_id` |
| Workspace | WorkspaceMember · Workflow · Folder · Trigger · Schedule · Integration · KnowledgeBase · WorkflowTestDataset · ModelConfig · AuthConfig · AuditLog · Notification · AssistantSession · AgentMemory · LlmUsageLog · AlertRule · WorkspaceInvitation (모두 `workspace_id`) | WebhookEndpointReservation.`workspace_id` | — |
| Folder | Folder.`parent_id` | Workflow.`folder_id` | — |
| Workflow | Node · Edge · Trigger · WorkflowVersion · Execution · WorkflowTestDataset · AssistantSession · IntegrationUsageLog · AlertRule (모두 `workflow_id`) | LlmUsageLog.`workflow_id` | — |
| Node | Edge.`source_node_id` · Edge.`target_node_id` · NodeExecution.`node_id` | Node.`container_id` · Node.`tool_owner_id` | — |
| Trigger | Schedule.`trigger_id` | Execution.`trigger_id` | — |
| AuthConfig | — | Trigger.`auth_config_id` | — |
| Integration | IntegrationUsageLog.`integration_id` · `integration_oauth_state.integration_id` · `integration_expiry_dispatch.integration_id` | — | — |
| KnowledgeBase | Document · DocumentChunk · Entity · Relation (모두 `knowledge_base_id`) | — | — |
| Document | DocumentChunk.`document_id` | — | — |
| DocumentChunk | ChunkEntity.`chunk_id` | Entity.`last_seen_chunk_id` · Relation.`evidence_chunk_id` | — |
| Entity | Relation.`head_entity_id` · Relation.`tail_entity_id` · ChunkEntity.`entity_id` | — | — |
| Execution | NodeExecution.`execution_id` · ExecutionNodeLog.`execution_id` · ExecutionToken.`execution_id` | Execution.`parent_execution_id` · Execution.`re_run_of` · LlmUsageLog.`execution_id` | — |
| NodeExecution | IntegrationUsageLog.`node_execution_id` | NodeExecution.`parent_node_execution_id` · LlmUsageLog.`node_execution_id` | — |
| ModelConfig | — | KnowledgeBase.`embedding_model_config_id` · `extraction_llm_config_id` · `rerank_config_id` · `rerank_llm_config_id` · AssistantSession.`llm_config_id` · LlmUsageLog.`llm_config_id` | — |
| AssistantSession | AssistantMessage.`session_id` | — | — |

다음 사실을 함께 본다.

- **NO ACTION 여섯은 모두 사용자를 가리킨다.** 앱에는 사용자를 지우는 경로가 없다. "탈퇴" 는 워크스페이스 멤버십(`workspace_member` 행) 삭제다. 참조 행이 있는 사용자의 삭제는 지금 스키마가 거부한다. 사용자 삭제를 더하는 변경은 사용자를 가리키는 FK 전체의 처분부터 다시 정해야 한다.
- **범위 참조 열일곱은 복합 FK 다.** 삭제 동작은 위 표 그대로이고 SET NULL 은 참조 컬럼만 비운다([범위 참조의 DB 제약](#범위-참조의-db-제약)).
- **시크릿 저장소의 `workspace_id` 에는 FK 가 없다.** 이 컬럼을 조건으로 지우는 경로는 없고, 정리는 트리거 단위 접두 삭제로 한다([트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md)).
- **워크스페이스 초대(`workspace_invitation`)** 는 코드 엔티티에 관계가 선언되지 않아 워크스페이스 삭제 트랜잭션이 멤버와 함께 명시적으로 지운다. DB 에는 `workspace_id` FK(CASCADE, V017)도 있다([계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md)).
- 통합 OAuth 일시 행 두 테이블의 FK 는 [통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md) 이 정한다. 위 표의 `integration_oauth_state`·`integration_expiry_dispatch` 행은 그 문서의 매핑 표에서 옮겼다.

## 구현 위치

- `codebase/backend/migrations/V134*.sql` ~ `V147*.sql` (부모 UNIQUE · 복합 FK 교체 · 사전 점검 가드)
- 전용 e2e(`composite-fk-scope`)는 [데이터 모델 개요 「구현 위치」](CLE-PLAT-DATA.md#구현-위치) 에 있다.

## Rationale

### 워크스페이스 범위 참조를 복합 FK 로도 막는다 (2026-10-05)

[본문 참조 id 도 저장 전에 소속을 본다](CLE-PLAT-DATA-REFSCOPE.md#본문-참조-id-도-저장-전에-소속을-본다-2026-09-27) 는 새 쓰기 경로가 검사를 빠뜨리는 것을 막는 정적 가드가 없다고 적었다. 그 가드는 2026-11-07 에 더했다(그 결정의 «왜 저장 시점인가»). 운영 점검은 저장 경계 이전의 행을 찾으려고 둔 것이지만 어떤 경로로 생긴 교차 행이든 결과에 나왔다. 그 점검을 [저장된 교차 행 결정](CLE-PLAT-DATA-REFSCOPE.md#저장된-교차-행은-실행-때-한-번-더-막고-운영-점검으로-찾는다-2026-10-05) 에서 걷었으므로 검사를 빠뜨린 경로가 만든 교차 행은 이제 찾을 수단이 없다. 이 공백 가운데 걷은 점검이 보던 열여섯 참조를 DB 가 막도록 복합 외래 키(복합 FK)를 더하기로 했다(사람 결정). 2026-10-05 에 마이그레이션 V134~V147 로 구현했다. 구현 착수 때 대상을 열일곱으로 넓혔다(아래 «대상»).

- **대상**: 걷은 점검 SQL 의 `check_name` 열여섯과 같은 참조 컬럼이다. [참조의 소속](CLE-PLAT-DATA-REFSCOPE.md#참조의-소속) 표에 있는 참조 컬럼 열넷과 표 밖의 둘이다. 표 밖의 둘은 서버가 채우는 스케줄 `trigger_id` 와 어시스턴트 세션 `workflow_id` 다. 세션 `workflowId` 는 구현 때 표에 올리고 이미 나가던 404 `WORKFLOW_NOT_FOUND` 를 예외 3 으로 적었다(사람 결정. 지금 표의 참조 컬럼은 열다섯이다). 워크스페이스 범위 열둘은 트리거 `workflow_id` · `auth_config_id`, 스케줄 `trigger_id`, 알림 규칙 `workflow_id`, 워크플로우 `folder_id`, 폴더 `parent_id`, 어시스턴트 세션 `workflow_id` · `llm_config_id`, 지식 저장소 모델 설정 넷이다. 같은 워크플로우 범위 넷은 노드 `container_id` · `tool_owner_id` 와 연결선 끝점 둘이다. 부모 여섯(워크플로우, 인증 설정, 폴더, 모델 설정, 트리거, 노드)에 `UNIQUE (id, workspace_id)` 나 `UNIQUE (id, workflow_id)` 를 둔다. 구현 착수 때 워크플로우 테스트 데이터셋 `workflow_id` 를 더해 **열일곱**이 됐다(사람 결정). 이 테이블은 `workspace_id` 를 비정규화해 두므로([공통 컬럼 규칙](CLE-PLAT-DATA.md#공통-컬럼-규칙) 6) 두 값이 맞는지가 곧 이 불변식이다. 부모 `workflow` 의 UNIQUE 는 어차피 생기므로 더해지는 비용은 FK 교체 하나다. LLM 사용량 기록(`LlmUsageLog`)의 `workflow_id` · `llm_config_id` 는 넣지 않았다. 서버만 쓰는 기록이라는 이유를 적은 선택지를 사람이 골랐다. 공통 컬럼 규칙 6 의 다른 비정규화 컬럼 가운데 활동 로그의 `workflow_id` 는 부모(노드 실행)에 같은 범위 컬럼이 없어 복합 FK 를 만들 수 없다. 청크의 `knowledge_base_id` 는 문서 `(id, knowledge_base_id)` 로 만들 수 있지만 지식 저장소 범위라 이 결정(워크스페이스 · 워크플로우 범위)에 넣지 않았다. 테스트 데이터셋은 2026-10-05 운영 점검 밖이라 V134 가 처음 본다.
- **견준 안**: 사람에게 세 안을 물었다. (a) 열여섯 모두 바꾼다. (b) 워크스페이스 범위 열둘만 바꾸고 쓰기가 잦은 노드 테이블에 UNIQUE 를 더하지 않는다. (c) 채택하지 않고 공백을 받아들인다. (a) 를 골랐다. (b) 는 2026-09-27 사고가 난 노드 · 연결선 참조를 저장 시점 검사에만 맡기고, (c) 는 탐지 수단도 없는 공백을 남긴다. 앱 불변식을 DB 로 한 번 더 막은 선례는 [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) 의 개인 워크스페이스 부분 유니크 인덱스(V109)다.
- **기존 단일 FK 를 바꾼다**: 같은 참조에 FK 를 둘 두지 않는다. 삭제 동작은 지금과 같다. SET NULL 참조는 `ON DELETE SET NULL (참조 컬럼)` 으로 참조 컬럼만 비운다. 자식의 `workspace_id` · `workflow_id` 가 NOT NULL 이기 때문이다. 이 문법은 PostgreSQL 15 부터 있다. 운영 DB 는 16 이상이고(사람 확인, 2026-10-05) 개발 · e2e 기본 이미지는 pg18 이다. 최소 15 는 [시스템 아키텍처](CLE-PLAT-ARCH.md) 와 저장소 README · `.env.example` · `migrations/README.md` 에 적었다. V134 가 스키마를 바꾸기 전에 서버 버전을 보고 15 미만이면 멈춘다. 그 확인이 없으면 부모 인덱스 여섯을 만든 뒤에 FK 파일이 실패한다. 제약 이름은 FK 가 `fk_<자식 테이블>_<참조 컬럼>`, UNIQUE 가 `uq_<부모 테이블>_id_<범위 컬럼>` 이다. 옛 이름에는 시스템 생성 `_fkey` 와 줄인 `fk_kb_*` 가 섞여 있어 이 열일곱과 여섯은 한 규칙으로 다시 지었다. 다른 FK 의 이름은 그대로다. 옛 이름과의 대응은 V141~V146 머리 주석에 있다. 소유 문서의 FK 표기에 범위를 덧붙이는 방식은 「모든 FK 행에 삭제 동작을 적는 이유」 의 표기를 넓힌 것이다.
- **추가 방식**: 부모 UNIQUE 는 [인덱스 전략](CLE-PLAT-DATA-INDEX.md#원칙) 원칙 6 과 [DB 마이그레이션 규약](../CLE-ENG/CLE-ENG-MIGRATION.md) 규칙 13 을 따라 `CREATE UNIQUE INDEX CONCURRENTLY` 로 만든 뒤 제약에 붙인다. 복합 FK 는 `NOT VALID` 로 더한 뒤 `VALIDATE` 한다. FK 교체는 부모마다 한 파일(V141~V146)이다. 파일 하나가 그 부모의 UNIQUE 를 붙이고 그 부모를 가리키는 FK 를 바꾼다. UNIQUE 를 붙이면 부모가, 옛 FK 를 지우면 자식과 부모가 ACCESS EXCLUSIVE 로 잠기고 그 잠금은 파일이 커밋할 때까지 남는다. 한 트랜잭션에서 열일곱을 모두 바꾸면 워크플로우 · 노드 · 트리거 같은 핵심 테이블이 함께 잠긴 채 다른 테이블의 잠금을 기다릴 수 있어 나눴다. 기존 행을 읽지 않아 노드 · 연결선 10만 행에서 파일마다 2~3 ms, 여섯 합계 약 14 ms 잠갔다(2026-10-05 실측). 행을 넣은 직후의 첫 회는 V146 이 416 ms 였다. `SET LOCAL lock_timeout = '3s'` 는 잠금 하나를 기다리는 한도라서 파일 전체의 시간을 묶지 못하고, 잠그는 순서가 엇갈린 요청과 드물게 교착할 수 있다. 그래서 트래픽이 적을 때 배포한다. 한도를 넘기면 그 파일만 바뀌는 것 없이 실패하고 다시 돌리면 그 파일부터 이어진다. 그 사이 아직 바꾸지 않은 참조는 옛 단일 FK 가 막는다.
- **바꿀 수 있는 이유**: 정상 경로에는 부모나 자식의 `workspace_id` · `workflow_id` 를 바꾸는 쓰기가 없다. 복제 · 가져오기 · 버전 복원은 새 행을 만들거나 캔버스 저장을 그대로 부른다. 2026-09-27 에 재현된 노드 행 이동(캔버스 저장이 다른 워크플로우의 노드 id 로 `save` 해 그 행의 `workflow_id` 를 바꿨다)은 새 노드 id 검사가 막는다. 캔버스 저장은 한 워크플로우의 노드만 다루므로 복합 FK 가 지금의 단일 FK 보다 더 막는 정상 요청이 없다.
- **역할 분담**: 저장 시점 검사가 첫 방어선이고 그 응답(400 `VALIDATION_ERROR`, 예외 404 · 400)은 그대로다. DB 제약은 검사를 빠뜨린 경로에서 닿는다. 사용자가 고칠 수 없는 서버 결함이므로 위반(SQLSTATE 23503)은 500 `INTERNAL_ERROR` 이고 서버 로그에 제약 이름이 남는다(사람 결정). 검사 뒤에 부모가 동시에 지워지는 경합도 23503 을 내는데, 이 경합은 단일 FK 때도 같은 500 이었고 이번에 바꾸지 않았다. 클라이언트가 분기할 조건이 아니라서 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 규칙 6(새 조건이 생기면 새 코드를 만든다)에 따른 새 코드를 만들지 않는다. 상태 코드를 누가 고칠 수 있는가로 고르는 기준은 [시크릿 저장소 «저장된 참조는 읽는 쪽도 다시 만든다»](../CLE-INT/CLE-INT-SECRET.md#r10-저장된-참조는-읽는-쪽도-다시-만들고-rotate-는-다른-워크스페이스의-행을-덮어쓰지-않는다-2026-10-04) 와 같다.
- **막지 않는 것**: 모델 설정 참조의 `kind` 는 복합 FK 가 보지 않는다. 저장 시점 검증기(`findEntity(id, workspaceId, kind)`)만 본다. 노드 행이 다른 워크플로우로 옮겨지는 것은 그 노드를 가리키는 연결선 · 구조 참조가 있을 때만 막힌다(ON UPDATE NO ACTION). 가리키는 행이 없는 노드의 이동은 새 노드 id 검사만 막는다. 캔버스 저장의 «이번 페이로드의 노드» 규칙(저장 뒤 노드 집합이 페이로드와 같다)도 복합 FK 가 보지 않는다. 같은 워크플로우의 다른 노드를 가리키는 것은 막지 않기 때문이다. 트리거 `config` 안의 비밀 참조는 컬럼이 아니라서 FK 대상이 아니다. 비밀 저장소 행에도 FK 를 두지 않는다([시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md#r4-fk-를-두지-않는다) 의 「FK 를 두지 않는다」).
- **사전 점검은 마이그레이션이 한다**: 위반 행이 있으면 마이그레이션이 참조마다 행 수와 행 id 를 알리고 멈춘다. `NOT VALID` 로 더한 FK 는 위반 행이 있어도 만들어지지만 이어지는 `VALIDATE` 가 실패해 NOT VALID 제약이 남은 반쯤 적용된 상태가 되고, 첫 위반의 키 하나만 알린다. V134 는 스키마를 바꾸기 전에 위반을 참조마다 모두 알리고 멈춘다. 걷은 점검 SQL 이 하던 일을 마이그레이션 앞의 가드가 맡는다. 선례는 [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) 의 V108 사전 검증 가드다. 이 가드는 옮겨진 노드를 가리키던 연결선 · 구조 참조도 위반으로 잡는다. 정리 SQL 은 두지 않고 처분은 사람이 결과를 보고 정한다([저장된 교차 행 결정](CLE-PLAT-DATA-REFSCOPE.md#저장된-교차-행은-실행-때-한-번-더-막고-운영-점검으로-찾는다-2026-10-05) 의 «정리 SQL 을 두지 않는다»). [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md#r10-저장된-참조는-읽는-쪽도-다시-만들고-rotate-는-다른-워크스페이스의-행을-덮어쓰지-않는다-2026-10-04) 는 덮어써진 비밀을 SQL 로 되살릴 수 없어 멈춰도 소유자의 재발급이 필요했으므로 마이그레이션을 멈추지 않았다. 여기서는 위반 행이 남으면 `VALIDATE` 를 마칠 수 없으므로 멈춘다. 2026-10-05 점검은 0 행이었지만 옮겨진 노드를 가리키던 행처럼 그 점검이 다 보지 못한 부류는 가드에서 처음 나올 수 있다.
- **멈춘 뒤의 처분**: 운영자가 행마다 정하고 다시 배포한다(V108 과 같다). 걷기 전 본문의 처분 지침을 따른다. 트리거 `workflow_id` 는 그 워크스페이스 관리자와 상의해 트리거를 지우고 같은 워크스페이스의 워크플로우로 새로 만든다. NULL 을 허용하는 참조는 끊거나 같은 워크스페이스의 행으로 바꾼다. 연결선 끝점은 그 워크플로우를 다시 저장하고 어시스턴트 세션 `workflow_id` 는 세션을 지운다. 스케줄 `trigger_id` 는 정상 경로로 생기지 않으므로 경위부터 확인한다.
- **엔티티 선언은 단일 컬럼으로 둔다**: 엔티티에 복합 `@JoinColumn` 을 선언하면 TypeORM 이 관계 값으로 `workspace_id` 를 쓴다. 프로브로 확인했다(2026-10-05, TypeORM 1). `workspaceId` 를 A 로 두고 B 의 부모를 관계에 걸자 `workspace_id` 가 B 로 저장됐고, 관계를 비우자 `workspace_id` 까지 NULL 로 보내 23502 가 났다. 그래서 `@ManyToOne` 선언은 그대로 두고 `entity-schema-declarations` e2e 가 그 선언을 복합 FK 로도 인정하게 고쳤다. 인정하는 것은 선두 컬럼 · 참조 테이블 · 삭제 동작이 같고 둘째 컬럼이 자식 · 부모 모두 같은 `workspace_id` 나 `workflow_id` 인 복합 FK 뿐이다. 그 대신 그런 복합 FK 의 SET NULL 이 참조 컬럼만 비우는지도 본다. 판별력 대조군이 DB 를 읽지 않는 고정 입력으로 이 경계를 지킨다.
- **비용**: 부모 테이블마다 인덱스가 하나 늘고 노드는 캔버스 저장마다 그 인덱스를 갱신한다. [쓸 인덱스가 없는 FK 서른하나의 처분](CLE-PLAT-DATA-INDEX.md#쓸-인덱스가-없는-fk-서른하나의-처분-2026-09-18) 과 같은 방식(10만 행 INSERT 5회 중앙값, FK 컬럼을 채운 최악, «있음 → 없음 → 있음» 세 묶음, 묶음마다 VACUUM)으로 쟀다(2026-10-05, pg18). 노드 INSERT 는 행당 9.08 µs 에서 11.05 · 10.36 µs(+1.3~2.0), 연결선 INSERT 는 11.95 µs 에서 13.53 · 12.19 µs(+0.2~1.6)였다. 그 절의 +0.8~2.6 µs 와 같은 범위라 받아들였다.
- **실행 시점 방어선은 남긴다**: V147 뒤로는 트리거 · 스케줄의 교차 행이 DB 에 생기지 않는다. 엔진 대조는 저장 검사와 DB 제약을 함께 지나친 행(FK 트리거를 끄는 복제 모드의 쓰기 등)을 막는 방어선으로 남긴다. e2e `stored-cross-workspace-workflow-refs` 는 그 행을 복제 모드로 만들어 잰다.
- **V134 와 V147 사이**: 인덱스를 만드는 동안 검사를 빠뜨린 쓰기가 끼어들면 V147 의 `VALIDATE` 가 첫 위반의 키를 알리며 실패한다. V141~V146 의 NOT VALID 제약이 이미 새 쓰기를 막으므로 행을 고친 뒤 `repair` → `migrate` 로 다시 돈다.

### 모든 FK 행에 삭제 동작을 적는 이유 (2026-09-19)

엔티티 표의 FK 행은 삭제 동작을 적기도 하고 안 적기도 했다. 실제 DB(V001~V132)와 전수 대조하니 FK 75행 중 틀린 곳은 0, 적은 곳 26, 안 적은 곳 49 였다. 49행 모두에 적었다. 적은 행과 안 적은 행의 구분은 우연이었고, 한 행만 채우면 그 구분에 뜻이 있는 것처럼 읽힌다.

- **표기**: 적은 26행의 다수형인 짧은 형 `(CASCADE)` 를 따른다. 이미 괄호가 있으면 괄호 맨 앞에 동작을 넣는다. 이미 다른 표기로 적은 행(`(ON DELETE CASCADE)`, `(cascade 삭제)` 등)은 사실이 맞아 그대로 두었다.
- **같은 대조가 찾은 것**: 엔티티 표에 없던 컬럼 여섯(FK 둘 포함, DB 컬럼 424개 중), FK 표기의 테이블명 오류 하나(`re_run_of`), `parent_node_execution_id` 인덱스 목적 서술의 오류(Loop 는 이 값을 찍지 않는다). 엔티티 표가 DB 에 없는 컬럼을 적은 곳은 0 이었다.
- **대조하지 않은 것**: 엔티티 표 밖(데이터 흐름 문서 등)의 FK 서술, 엔티티 표의 값 목록(enum·마커) 전체.

NO ACTION 여섯이 모두 사용자를 가리킨다는 사실은 [쓸 인덱스가 없는 FK 서른하나의 처분](CLE-PLAT-DATA-INDEX.md#쓸-인덱스가-없는-fk-서른하나의-처분-2026-09-18) 이 적은 사용자 참조 FK 의 처분과 같다.
