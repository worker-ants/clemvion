---
id: "CLE-PLAT-DATA-INDEX"
title: "데이터 모델 개요 — 인덱스 전략"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-PLAT-DATA"
ancestors: ["CLE-VISION", "CLE-PLAT", "CLE-PLAT-DATA"]
area: "CLE-PLAT"
content_hash: "3d592fa379085df2158c85c788733c8972dd7172aeb85e507b2995473fb310df"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "3f3d8143f63ce5d5c46f1473666050173c01ce0aa65c1da627d7886757cbcaaf"
etag: "sha256-d9abdc8c08916b6c8cc216a9a30ebf2f2ca5b97d32993cc13e83ff47399e665a"
---
## 개요

이 문서는 [데이터 모델 개요](CLE-PLAT-DATA.md) 의 하위 문서로 FK 인덱스를 둘지 정하는 원칙, 벡터 인덱스, 영역별 인덱스 목록을 정한다.

## 원칙

1. PostgreSQL 은 FK 에 인덱스를 자동으로 만들지 않는다. FK 마다 삭제 연쇄와 조회 경로를 보고 인덱스를 둘지 정한다.
2. 복합 인덱스는 선두 컬럼이 조회 조건과 맞아야 쓰인다. 선두가 다른 기존 인덱스가 있어도 그 컬럼으로 찾는 조회나 FK 삭제는 인덱스 전체를 훑거나 테이블을 훑는다.
3. FK 삭제가 부모 행마다 부르는 조회(`$1 = col`)가 쓸 수 있는 부분 인덱스는 조건이 `col IS NOT NULL` 인 것뿐이다. 다른 조건이 붙은 부분 인덱스만 있으면 인덱스가 없는 것과 같다.
4. nullable FK 컬럼의 인덱스는 `WHERE col IS NOT NULL` 부분 인덱스로 둔다. NULL 행을 빼서 인덱스를 가볍게 한다.
5. 인덱스를 둘지는 "자식 테이블 크기 × 연쇄로 지워지는 부모 행 수" 가운데 어느 쪽이 사용자 데이터로 자라는지로 가른다. 호출당 ms 문턱 하나로 자르면 규모가 바뀔 때마다 결론이 바뀐다. 기준 세부는 [Rationale](#쓸-인덱스가-없는-fk-서른하나의-처분-2026-09-18) 에 있다.
6. 운영 테이블에 인덱스를 더할 때는 `CREATE INDEX CONCURRENTLY` 를 쓴다. `CONCURRENTLY` 와 `ALTER` 는 한 마이그레이션에 함께 둘 수 없어 파일을 나눈다([DB 마이그레이션 규약](../CLE-ENG/CLE-ENG-MIGRATION.md)).

## 벡터 인덱스

pgvector 인덱스는 차원별로 나눈 부분 인덱스다. 임베딩 차원이 다른 행은 각자의 인덱스에 맞춰진다. 두 벡터 테이블이 같은 방식을 쓴다.

| 테이블 | 인덱스 | 마이그레이션 |
| --- | --- | --- |
| DocumentChunk (지식 저장소 검색) | 차원별 부분 HNSW — 768(V022)·3072 halfvec(V023)·384(V030)·1536(V031)·512(V032)·1024(V033) | V022·V023·V030~V033 |
| AgentMemory (에이전트 메모리 회수) | 차원별 부분 HNSW — 384(V074)·512(V075)·768(V076)·1024(V077)·1536(V078)·3072 halfvec(V079) | V074~V079 |

IVFFlat 인덱스는 두 테이블 모두 쓰지 않는다. 인덱스 정의 상세는 [지식 저장소 데이터와 흐름](../CLE-KB/CLE-KB-DATA.md) 과 [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md) 에 있다. 차원과 임베딩 모델의 관계는 [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) 과 [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md) 가 정한다.

## 인덱스 목록

영역별로 나눈다. "근거" 열의 CONCURRENTLY 는 운영 중 무중단 생성이고, 뒤의 번호는 그 인덱스를 만든 마이그레이션이다.

**계정과 워크스페이스**

| 테이블 | 인덱스 | 목적과 근거 |
| --- | --- | --- |
| Workspace | `(owner_id)` UNIQUE WHERE `type = 'personal'` | 개인 워크스페이스는 소유자당 1개다. DB 가 강제하고 앱(find-or-create)이 이중으로 막는다. 팀 워크스페이스는 한 사용자가 여럿 가질 수 있어 부분 UNIQUE 다([계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md)). CONCURRENTLY, V109 |
| WorkspaceMember | `(user_id)` | 사용자별 워크스페이스 목록(`GET /workspaces`). UNIQUE `(workspace_id, user_id)` 는 선두가 달라 테이블을 훑었다. FK `ON DELETE CASCADE` 도 이 인덱스를 쓴다. CONCURRENTLY, V129 |
| RefreshToken | `(user_id, family_id)` WHERE `is_revoked = false` | 사용자별 활성 로그인 세션 조회 |
| LoginHistory | `(user_id, created_at DESC)` | 사용자별 로그인 이력 조회. V040 |
| LoginHistory | `(email, created_at DESC)` | 가입하지 않은 이메일의 로그인 시도 추적. V040 |
| LoginHistory | `(created_at)` | 보존 배치의 `created_at < cutoff` 스캔 전용. V040 |
| WebAuthnCredential | `(user_id)` | 사용자별 등록 인증기 목록 |
| WebAuthnCredential | `(credential_id)` UNIQUE | 인증할 때 `credential_id` 로 행을 찾는다(WebAuthn 표준 요구) |

**워크플로우**

| 테이블 | 인덱스 | 목적과 근거 |
| --- | --- | --- |
| Workflow | `(workspace_id, is_active)` | 워크스페이스별 활성 워크플로우 조회 |
| Workflow | `(workspace_id, name)` | 이름 검색 |
| Workflow | `(folder_id)` WHERE `folder_id IS NOT NULL` | FK `ON DELETE SET NULL`. 폴더 삭제에서 지워지는 하위 폴더마다 찾는다. 폴더 밖 워크플로우(NULL)는 뺀다. CONCURRENTLY, V123 |
| Folder | `(workspace_id, parent_id)` | 워크스페이스별 폴더 조회 |
| Folder | `(parent_id)` WHERE `parent_id IS NOT NULL` | FK `ON DELETE CASCADE`. 폴더 삭제의 하위 폴더마다 찾는다. `(workspace_id, parent_id)` 는 선두가 달라 인덱스 전체를 훑었다. 루트 폴더(NULL)는 뺀다. CONCURRENTLY, V124 |
| Node | `(workflow_id)` | 워크플로우별 노드 조회 |
| Node | `(container_id)` | 컨테이너별 자식 노드 조회 |
| Node | `(tool_owner_id)` | AI 에이전트별 도구 영역 노드 조회. 도구 영역(Tool Area)은 제거된 기능이다([워크플로우 데이터와 저장 흐름](../CLE-WF/CLE-WF-DATA.md)) |
| Edge | `(workflow_id)` | 워크플로우별 연결선 조회 |
| Edge | `(workflow_id, type)` | 워크플로우별 연결선 유형 조회 |
| Edge | `(source_node_id)` | 노드별 나가는 연결선 |
| Edge | `(target_node_id)` | FK `ON DELETE CASCADE`. 캔버스 저장이나 워크플로우 삭제로 노드가 지워질 때마다 찾는다. UNIQUE `(source_node_id, source_port, target_node_id, target_port)` 는 선두가 달라 쓰이지 않는다. CONCURRENTLY, V121 |
| Workflow | `(id, workspace_id)` UNIQUE | 복합 FK 의 참조 대상(트리거 · 알림 규칙 · 어시스턴트 세션 · 테스트 데이터셋). `id` 가 PK 라 유일성은 이미 참이다. `uq_workflow_id_workspace_id`, CONCURRENTLY, V135 |
| Folder | `(id, workspace_id)` UNIQUE | 복합 FK 의 참조 대상(워크플로우 `folder_id` · 폴더 `parent_id`). `uq_folder_id_workspace_id`, CONCURRENTLY, V137 |
| Node | `(id, workflow_id)` UNIQUE | 복합 FK 의 참조 대상(노드 구조 참조 · 연결선 끝점). 캔버스 저장마다 갱신한다. `uq_node_id_workflow_id`, CONCURRENTLY, V140 |

**실행**

| 테이블 | 인덱스 | 목적과 근거 |
| --- | --- | --- |
| Execution | `(workflow_id, started_at DESC)` | 워크플로우별 실행 내역 |
| Execution | `(status)` | 상태별 실행 조회 |
| Execution | `(re_run_of)` | 재실행의 직계 부모 조회(체인 배지의 부모 표시) |
| Execution | `(chain_id, started_at)` | 재실행 체인 전체 조회(`GET /api/executions/:id/chain`, [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md)) |
| Execution | `(trigger_id, started_at DESC)` WHERE `trigger_id IS NOT NULL` | 인증 설정 사용 내역(`GET /api/auth-configs/:id/usage`, [외부 호출 인증 설정](../CLE-TRIG/CLE-TRIG-AUTHCFG.md))의 `trigger_id IN (...)` + `started_at` 집계(totalCalls·periodCounts·recentCalls) 가속. 인덱스 이름 `idx_execution_trigger_started`. 스케줄·수동 실행(`trigger_id` NULL)을 빼서 가볍게 한다. V096 |
| NodeExecution | `(execution_id)` | 실행별 노드 실행 조회 |
| NodeExecution | `(execution_id, status)` WHERE `status IN ('waiting_for_input','running')` | 끝나지 않은 노드 실행의 조회와 전이. rehydration `resolveWaitingNodeExecutionId` 와 running 조회·UPDATE 가 핫 경로다. 끝난 행은 아래 `(execution_id, node_id, started_at DESC)` 가 덮으므로 활성 행만 인덱싱해 크기와 쓰기 증폭을 줄인다. CONCURRENTLY, V095 |
| NodeExecution | `(execution_id, node_id, started_at DESC)` | 실행·노드별 최신 노드 실행 조회(rehydration `DISTINCT ON`, `findOne ... ORDER BY started_at DESC`). CONCURRENTLY, V034 |
| NodeExecution | `(parent_node_execution_id)` WHERE `parent_node_execution_id IS NOT NULL` | 부모 노드 실행별 자식 조회(서브 워크플로우·Background·Parallel 노드의 자식). V012 |
| NodeExecution | `(parent_node_execution_id, started_at, id)` WHERE `parent_node_execution_id IS NOT NULL` | 부모별 자식 시간순 조회(`ORDER BY started_at ASC, id ASC`). CONCURRENTLY, V048 |
| NodeExecution | `((output_data #>> '{meta,backgroundRunId}'))` WHERE … IS NOT NULL | Background 노드 모니터링 API 의 `backgroundRunId` 단일 행 조회(부분 식 인덱스). CONCURRENTLY, V047 |
| NodeExecution | `(node_id)` | FK `ON DELETE CASCADE` 의 자식 조회. 캔버스 저장이 노드를 뺄 때(저장마다)와 워크플로우 삭제에서 쓴다. 기존 `(execution_id, node_id, started_at DESC)` 는 선두가 달라 쓰이지 않는다. CONCURRENTLY, V112 |
| ExecutionNodeLog | `(execution_id, id)` | 한 실행의 노드 진행 순서 조회 |

실행 영역 FK 인덱스를 둔 근거는 [실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md) 의 Rationale 에 있다.

**트리거와 인증 설정**

| 테이블 | 인덱스 | 목적과 근거 |
| --- | --- | --- |
| Trigger | `(workspace_id, type)` | 유형별 트리거 조회 |
| Trigger | `(endpoint_path)` UNIQUE WHERE `endpoint_path IS NOT NULL` | 웹훅 URL 라우팅. 라우팅 키(`/api/hooks/:endpointPath`)가 워크스페이스와 무관한 전역 키라 유일성도 전역이다. 수신·공개 가드·웹채팅 embed-config 가 이 컬럼 하나로 찾는다. V002 의 `(workspace_id, endpoint_path)` UNIQUE 를 교체했다(V131 중복 정리, V132 CONCURRENTLY). 근거는 [트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md) |
| Trigger | `(workflow_id)` | 워크플로우 삭제 경로. 트리거 자원 정리의 열거 두 번(`WHERE workflow_id = ?`, 하나는 `workflow` 행 잠금 안)과 FK `ON DELETE CASCADE` 가 쓴다. 이 셋 말고 `workflow_id` 로 트리거를 찾는 곳은 없다. CONCURRENTLY, V111 |
| Trigger | `(notification_health)` WHERE `notification_health = 'degraded'` | 발송 건강도가 `degraded` 인 트리거를 전체 스캔 없이 찾으려고 만들었다(부분 인덱스). 지금 코드에는 이 조건으로 트리거를 찾는 조회가 없다. V061 |
| Trigger | `(auth_config_id)` WHERE `auth_config_id IS NOT NULL` | 인증 설정 사용처(`GET /api/auth-configs/:id/usage`)가 이 컬럼 하나로 트리거를 찾는다. 이어서 위 Execution `(trigger_id, started_at DESC)` 를 쓴다. FK `ON DELETE SET NULL`(인증 설정 삭제)도 이 인덱스를 쓴다. CONCURRENTLY, V126 |
| Trigger | `(id, workspace_id)` UNIQUE | 복합 FK 의 참조 대상(스케줄 `trigger_id`). `uq_trigger_id_workspace_id`, CONCURRENTLY, V139 |
| AuthConfig | `(id, workspace_id)` UNIQUE | 복합 FK 의 참조 대상(트리거 `auth_config_id`). `uq_auth_config_id_workspace_id`, CONCURRENTLY, V136 |
| WebhookEndpointReservation | `(endpoint_path)` PK | 웹훅 경로 예약. 같은 새 경로를 동시에 잡는 두 요청을 가르고, 예약 트리거가 주인을 찾는다. V133 |
| WebhookEndpointReservation | `(workspace_id)` WHERE `workspace_id IS NOT NULL` | FK `ON DELETE SET NULL`. 워크스페이스 삭제가 예약을 훑지 않게 한다. 주인 없는 예약은 다시 찾을 일이 없어 부분 인덱스다. V133 |
| AuthConfig | `(workspace_id)` | 워크스페이스별 인증 설정 목록과 트리거 편집의 선택 상자. FK `ON DELETE CASCADE` 도 쓴다. CONCURRENTLY, V127 |
| Schedule | `(workspace_id, next_run_at)` | 스케줄 목록 조회. `WHERE workspace_id = ?` 진입과 `ORDER BY next_run_at` 정렬을 한 인덱스가 함께 준다. 선두가 `workspace_id` 라 다른 정렬 컬럼에서도 진입을 준다. 발사 경로가 아니다. 발사는 BullMQ 반복 작업이 한다([트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md)). 종전 `(next_run_at, is_active) WHERE is_active` 를 대체했다. CONCURRENTLY, V110 |
| Schedule | `(trigger_id)` | 트리거 목록의 Cron 표현식 · 다음 실행 배치 조회(`WHERE trigger_id IN (...)`). CONCURRENTLY, V106 |

**통합**

| 테이블 | 인덱스 | 목적과 근거 |
| --- | --- | --- |
| Integration | `(workspace_id, service_type)` | 서비스별 통합 조회 |
| Integration | `(workspace_id, name)` UNIQUE | 워크스페이스 안 별칭 유일성 |
| Integration | `(workspace_id, status)` | 만료·에러 상태 배지 수 세기, `pending_install` TTL 스캐너 조회, 중복 방지 조회 겸용([통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md)) |
| Integration | `(install_token)` UNIQUE WHERE `install_token IS NOT NULL` | Cafe24 Private App URL(`/3rd-party/cafe24/install/:installToken`)과 MakeShop ShopStore 설치 우선 App URL 의 단일 행 식별. `pending_install` 상태에서 쓴다. NULL 을 저장하지 않는 부분 인덱스로 크기를 줄인다. V043 |
| Integration | `(workspace_id, service_type, mall_id)` UNIQUE WHERE `mall_id IS NOT NULL` | 상점 식별자 중복 방지(`idx_integration_workspace_service_mall`). 서비스 종류와 무관해 새 통합은 인덱스를 더할 필요가 없다. 한 워크스페이스 안에서 같은 `(service_type, mall_id)` 통합은 최대 1행이다(Cafe24 는 `mall_id`, MakeShop 은 `shop_uid` 투영, Public 과 Private 동시 보유 불가). 서비스가 다르면 같은 `mall_id` 값이어도 정상이다. 옛 서비스별 UNIQUE(V046 Cafe24, V071 MakeShop)를 합쳤다. V072(V045 컬럼 추가와 분리. `CONCURRENTLY` 와 `ALTER` 는 한 마이그레이션에 둘 수 없다) |
| Integration | `(service_type, mall_id)` WHERE `mall_id IS NOT NULL` | `mall_id` 조회(`idx_integration_service_mall`). Cafe24 `tryRecoverByMallId` 같은 회복 검색을 모든 서비스로 넓혔다. 옛 Cafe24 전용 조회 인덱스(V051 `idx_integration_cafe24_mall_id_partial`)를 합쳤다. 서비스 종류와 무관해 새 통합은 인덱스를 더할 필요가 없다. V072 |
| Integration | `(token_expires_at)` | 만료 스캐너 배치 조회 |
| IntegrationUsageLog | `(integration_id, at DESC)` | 통합별 최근 호출 내역 |
| IntegrationUsageLog | `(at)` | 보존 기간이 지난 행을 지우는 배치 |
| IntegrationUsageLog | `(node_execution_id)` | FK `ON DELETE CASCADE`. 노드 실행 행이 지워질 때마다(캔버스 노드 삭제, 워크플로우 삭제) 찾는다. CONCURRENTLY, V113 |
| IntegrationUsageLog | `(workflow_id)` | FK `ON DELETE CASCADE`. 워크플로우 삭제. CONCURRENTLY, V114 |

**지식 저장소**

| 테이블 | 인덱스 | 목적과 근거 |
| --- | --- | --- |
| KnowledgeBase | `(workspace_id)` | 워크스페이스별 지식 저장소 목록·선택 상자·어시스턴트 도구 `list_knowledge_bases`. FK `ON DELETE CASCADE` 도 쓴다. CONCURRENTLY, V128 |
| Entity | `(last_seen_chunk_id)` WHERE `last_seen_chunk_id IS NOT NULL` | FK `ON DELETE SET NULL`. 청크가 지워질 때마다(재임베딩, 문서 삭제, 지식 저장소 삭제) 찾는다. 다른 인덱스는 모두 `knowledge_base_id` 가 선두라 쓰이지 않는다. CONCURRENTLY, V117 |
| Relation | `(evidence_chunk_id)` WHERE `evidence_chunk_id IS NOT NULL` | 위와 같다. CONCURRENTLY, V118 |
| Relation | `(head_entity_id)` | FK `ON DELETE CASCADE`. Entity 가 지워질 때마다(Entity 삭제, 지식 저장소 삭제) 찾는다. `(knowledge_base_id, head_entity_id)` 는 PostgreSQL 18 skip scan 으로 쓰이지만 비용이 지식 저장소 수에 비례한다. CONCURRENTLY, V119 |
| Relation | `(tail_entity_id)` | 위와 같다(tail). CONCURRENTLY, V120 |

지식 저장소 삭제 연쇄 인덱스의 근거는 [지식 저장소 데이터와 흐름](../CLE-KB/CLE-KB-DATA.md) 에 있다.

**AI 모델·메모리·어시스턴트**

| 테이블 | 인덱스 | 목적과 근거 |
| --- | --- | --- |
| ModelConfig | `(workspace_id, kind)` | 워크스페이스·종류별 모델 설정 목록과 모델 선택 상자. `(workspace_id, kind) WHERE is_default = true` UNIQUE(V089)는 부분 인덱스라 `is_default` 조건 없는 목록 조회와 FK `ON DELETE CASCADE` 가 쓰지 못했다. CONCURRENTLY, V130 |
| ModelConfig | `(id, workspace_id)` UNIQUE | 복합 FK 의 참조 대상(어시스턴트 세션 · 지식 저장소의 모델 설정 참조). `uq_model_config_id_workspace_id`, CONCURRENTLY, V138 |
| LlmUsageLog | `(workspace_id, created_at DESC)` | 워크스페이스별 LLM 사용량 조회. V014 |
| LlmUsageLog | `(provider, model, created_at DESC)` | 프로바이더×모델별 집계(통계 요약). V014 |
| LlmUsageLog | `(workflow_id, created_at DESC)` WHERE `workflow_id IS NOT NULL` | 워크플로우별 비용 집계. 노드 밖·워크플로우 밖 호출(NULL)을 뺀다. V014 |
| LlmUsageLog | `(node_execution_id)` WHERE `node_execution_id IS NOT NULL` | FK `ON DELETE SET NULL`. 노드 실행 행이 지워질 때마다 찾는다. 노드 밖 호출(NULL)을 뺀다. CONCURRENTLY, V115 |
| LlmUsageLog | `(execution_id)` WHERE `execution_id IS NOT NULL` | FK `ON DELETE SET NULL`. 실행 행이 지워질 때마다(워크플로우 삭제) 찾는다. CONCURRENTLY, V116 |
| LlmUsageLog | `(llm_config_id)` WHERE `llm_config_id IS NOT NULL` | FK `ON DELETE SET NULL`. 모델 설정 삭제. 설정 없이 부른 호출(NULL)을 뺀다. CONCURRENTLY, V122 |
| AgentMemory | `(workspace_id, scope_key, created_at)` | 메모리 범위별 회수와 FIFO/LRU 정리 조회. `created_at` 을 넣어 정리 정렬까지 인덱스가 덮는다. 워크스페이스 격리를 강제한다. V073 |
| AgentMemory | `(workspace_id, scope_key, updated_at)` | 관리 화면 범위 목록(`GET /agent-memories/scopes`)의 `MAX(updated_at)` 정렬을 index-only 로 덮는다. `created_at` 인덱스와 직교한다. CONCURRENTLY, V086 |
| AgentMemory | 차원별 부분 HNSW `(embedding)` | pgvector 유사도 회수. DocumentChunk 와 같은 차원별 부분 인덱스 정책이다([에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md)) |
| AgentMemory | 부분 `(expires_at)` WHERE `expires_at IS NOT NULL` | TTL 만료 정리 스캔 가속. 만료 없는(NULL) 행을 빼서 가볍게 한다. V080 |
| AssistantSession | `(workflow_id, user_id, status, last_interaction_at DESC)` | 워크플로우별 최근 활성 세션 조회 |
| AssistantSession | `(workspace_id, user_id, updated_at DESC)` | 사용자별 세션 목록 |
| AssistantSession | `(llm_config_id)` WHERE `llm_config_id IS NOT NULL` | FK `ON DELETE SET NULL`. 모델 설정 삭제. 세션은 대화마다 생기고 자동 정리가 없어 사용량으로 자란다. CONCURRENTLY, V125 |
| AssistantMessage | `(session_id, created_at ASC)` | 세션 안 메시지 시간순 페이지 조회 |

**관측**

| 테이블 | 인덱스 | 목적과 근거 |
| --- | --- | --- |
| AuditLog | `(workspace_id, created_at DESC)` | 감사 로그 조회 |
| Notification | `(user_id, is_read, created_at DESC)` WHERE `dismissed_at IS NULL` | 사용자별 보이는 안 읽은 알림 조회(벨 배지와 팝오버). 닫은 알림을 인덱스에서 빼서 크기를 작게 유지한다. 수명주기는 [알림](../CLE-OBS/CLE-OBS-NOTIFY.md) |
| Notification | `(workspace_id, created_at DESC)` | 워크스페이스별 알림 조회. 부분 인덱스로 두지 않았다. 나중에 관리·감사 조회가 닫은 알림까지 볼 여지가 있다 |

## 구현 위치

- `codebase/backend/migrations/V*.sql` (인덱스 정의)
- 전용 e2e(`deletion-cascade-indexes` · `trigger-endpoint-path-dedupe` · `webhook-endpoint-reservation`)는 [데이터 모델 개요 「구현 위치」](CLE-PLAT-DATA.md#구현-위치) 에 있다.

## Rationale

### 쓸 인덱스가 없는 FK 서른하나의 처분 (2026-09-18)

앞선 두 조사([실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md) 의 «삭제 연쇄의 FK 인덱스 다섯», [지식 저장소 데이터와 흐름](../CLE-KB/CLE-KB-DATA.md) 의 «그래프 RAG 삭제 연쇄의 FK 인덱스 넷»)가 닫고 남긴 FK 28개와 그 셈이 놓친 셋을 모두 처분했다. 인덱스 열은 V121~V130 으로 만들고, 스물하나는 대상에서 뺐다.

**셈법 보정.** 앞선 조사의 «37개» 는 `pg_index.indkey[0]` 만 대조해 부분 인덱스도 «있음» 으로 셌다. FK 트리거 조회(`$1 = col`)가 쓸 수 있는 부분 인덱스는 조건이 `col IS NOT NULL` 인 것뿐이다. 그래서 다른 조건이 붙은 부분 인덱스만 가진 셋(`model_config.workspace_id` 의 `WHERE is_default = true`, `workspace.owner_id` 의 `WHERE type = 'personal'`, `notification.user_id` 의 `WHERE dismissed_at IS NULL`)은 «없음» 과 같다. 보정한 전수는 40, 남은 것은 31 이었다.

| 부모 | 앱의 삭제 경로 | 빈도 |
| --- | --- | --- |
| `node` | 캔버스 저장이 제출 목록에 없는 노드를 지운다. 워크플로우·워크스페이스 삭제의 연쇄 | 캔버스 저장마다 |
| `folder` | 폴더 삭제. 하위 폴더는 `parent_id` CASCADE 로 연쇄 | 관리 동작 |
| `workflow` · `auth_config` · `model_config` · `integration` | 각자의 삭제 | 관리 동작 |
| `workspace` | 워크스페이스 삭제 | 워크스페이스당 한 번 |
| `user` | 없다. «탈퇴» 는 워크스페이스 멤버십 삭제다 | — |

실측(PostgreSQL 18, V001~V120. 워크스페이스 W 개마다 워크플로우 10(노드 10·연결선 9·트리거 1)·폴더 10·인증 설정 5·모델 설정 3·지식 저장소 5·LLM 로그 200·어시스턴트 세션 10. 새로 만든 데이터, 워밍 뒤 1회):

| 경로 | W=2,500 | W=10,000 | W=10,000 + V121~V129 |
| --- | --- | --- | --- |
| 캔버스 저장이 노드 하나를 뺀다 | 8.2 ms | 29.1 ms | **0.15 ms** |
| 워크플로우 삭제 | 79.5 ms | 306.8 ms | **1.8 ms** |
| 폴더 삭제(하위 5개) | 5.9 ms | 19.5 ms | 0.53 ms |
| 모델 설정 삭제 | 21 ms | 64~74 ms | 12~13 ms |
| 워크스페이스 삭제 | 856 ms | 3,161 ms | **49.6 ms** |

가장 큰 것은 `edge.target_node_id` 였다. 노드 하나에 28.8 ms(연결선 90만 행 순차 스캔. UNIQUE `(source_node_id, …)` 는 선두가 다르다)이고, 워크플로우 삭제에 10회, 워크스페이스 삭제에 100회 불린다. 다음이 `llm_usage_log.llm_config_id`(모델 설정 삭제 1회 50~58 ms, LLM 로그 200만 행)와 `workflow.folder_id`(폴더 삭제에서 하위 폴더마다)였다. `folder.parent_id` 는 `(workspace_id, parent_id)` 를 쓰지만 인덱스 전체를 훑었다(`Index Searches: 1`).

조회 경로도 함께 보았다. FK 기준으로는 아래 «라»·«바» 에 들지만, 그 컬럼으로 목록을 찾는 조회가 인덱스 없이 요청마다 돌던 다섯이 있었다(W=10,000, 전 → 후): `workspace_member.user_id`(`GET /workspaces`, 0.22 → 0.012 ms), `auth_config.workspace_id`(인증 설정 목록·선택 상자, 0.99 → 0.038 ms), `knowledge_base.workspace_id`(지식 저장소 목록·선택 상자, 1.53 → 0.033 ms), `trigger.auth_config_id`(`GET /api/auth-configs/:id/usage`, 2.97 → 0.006 ms), `model_config.workspace_id`(모델 설정 목록 `workspace_id = ? AND kind = ?`, 부분 UNIQUE 를 못 쓴다, 1.55 → 0.022 ms). FK 비대상으로만 적고 닫으면 이 컬럼들에 «인덱스가 필요 없다» 는 틀린 결론이 남는다.

처분 기준은 곱 «자식 테이블 크기 × 연쇄로 지워지는 부모 행 수» 의 어느 쪽이 사용자 데이터로 자라는가다.

- **둔다**
  - **가.** 한 동작의 호출 수가 사용자 데이터로 는다: `edge.target_node_id`, `workflow.folder_id`, `folder.parent_id`.
  - **나.** 자식이 설정 수가 아니라 사용량으로 자란다: `llm_usage_log.llm_config_id`(보존 정리 없음), `workflow_assistant_session.llm_config_id`(자동 정리 없음).
  - **다.** 위 조회 경로 다섯.
- **두지 않는다**
  - **라.** 부모를 지우는 앱 경로가 없다: `user` 를 가리키는 FK(당시 13개). 그중 NO ACTION 여섯은 참조 행이 있는 사용자의 삭제를 거부한다. 사용자 삭제는 지금 스키마가 받아 주지 않는 동작이고, 사용자 삭제를 더하는 변경은 이 FK 들의 처분부터 다시 정해야 한다.
  - **마.** 10분 만료 일시 행: `integration_oauth_state`·`integration_oauth_preview` 의 FK 셋(호출당 0.1 ms 미만).
  - **바.** 설정 테이블을 한 동작에서 한 번 훑고 조회 경로가 없다: `knowledge_base` 의 모델 설정 FK 넷(각 2.2~3.5 ms), `alert_rule.workflow_id`(1.2~1.3 ms).
- 워크스페이스 삭제는 «가» 의 곱에서 뺀다. 모든 행을 지우는 한 번뿐인 동작이라 연쇄가 전부 곱해지는 것이 정상이다. 합은 3,161 → 49.6 ms 이고 남은 것의 대부분이 «바» 다.

쓰기 비용(10만 행 INSERT 5회 median, FK 컬럼을 모두 채운 최악, «있음 → 없음 → 있음» 세 묶음, 묶음마다 VACUUM)은 행당 +0.8~2.6 µs 였다(`workflow` 는 잡음 수준). 가장 자주 쓰는 둘인 `edge`(+1.7~2.2 µs, 캔버스 저장이 연결선을 한꺼번에 넣는다)와 `llm_usage_log`(+1.8~2.1 µs, LLM 호출 한 번에 1행)도 무시할 만하고, 나머지 여덟은 사람이 설정을 만들 때만 쓰인다. `llm_usage_log`·`workflow_assistant_session` 의 `llm_config_id`, `workflow.folder_id`, `folder.parent_id`, `trigger.auth_config_id` 다섯은 nullable 이라 부분 인덱스다(V115~V118 과 같은 이유). `model_config` 만 `(workspace_id, kind)` 두 컬럼인 것은 목록 조회가 늘 `kind` 를 함께 걸기 때문이다.

28개 밖에서 같은 모양으로 찾은 웹훅 트리거 조회(`endpoint_path` 로만 찾는데 인덱스는 `(workspace_id, endpoint_path)`)는 유일성 범위 결정이 걸려 따로 다뤘다. 같은 날 전역 유일로 정했다. 다시 보니 성능보다 워크스페이스를 넘는 가로채기가 먼저였다([트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md)).

구현은 V121~V130 이다.
