---
title: 쓸 인덱스가 없는 FK 서른하나의 처분 — 인덱스 열, 나머지 스물하나는 근거와 함께 비대상
status: in-progress
owner: project-planner
worktree: fk-index-remaining-cd2eec
started: 2026-09-18
spec_impact:
  - spec/1-data-model.md
  - spec/data-flow/2-auth.md
  - spec/data-flow/6-knowledge-base.md
  - spec/data-flow/7-llm-usage.md
  - spec/data-flow/10-triggers.md
  - spec/data-flow/11-workflow.md
  - spec/data-flow/12-workspace.md
---

# spec draft — 쓸 인덱스가 없는 FK 서른하나의 처분

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 «선두 인덱스가 없는 FK — 부모를 한정하지 않은 전수 37개 중
28개 남음» 을 **닫는다**. 그 28개에 **셈법이 놓친 셋**을 더한 31개 전부에 처분을 매긴다 — **인덱스 열**(V121~V130),
**비대상 스물하나**(근거별 세 갈래). 전수 표는 `plan/complete/spec-draft-deletion-cascade-indexes.md` 부록이고, 이 draft 가 그 «처분» 칸을
모두 채우고 놓친 셋을 더한다.

세 가지를 새로 알게 됐다.

1. **앞 PR 의 «작은 테이블이라 넣지 않았다» 는 측정 구성의 산물이었다.** `edge.target_node_id` 는 그 측정에서 0.022 ms 였는데, 그 프로브는
   실행 이력이 많고 워크플로가 적은 구성(엣지 약 1만)이었다. 워크플로 10만(엣지 90만)이면 **캔버스 저장이 노드 하나를 뺄 때 29 ms**,
   워크플로 삭제 307 ms, 워크스페이스 삭제 3.2 초 중 2.8 초가 이 FK 다.
2. **FK 로는 필요 없는 컬럼 넷이 조회 경로에서 인덱스 없이 쓰인다** — 목록 조회가 요청마다 테넌트 전체 행을 훑는다. «FK 비대상» 으로만
   적고 닫으면 그 컬럼에 대해 틀린 결론을 남기므로 이 PR 이 같이 닫는다.
3. **«전수 37» 은 부분 인덱스를 «있음» 으로 셌다** — `pg_index.indkey[0]` 만 대조해서, 선두 인덱스가 **FK 조회가 쓸 수 없는 부분 인덱스뿐**인
   FK 셋을 빠뜨렸다: `model_config.workspace_id`(`(workspace_id, kind) WHERE is_default = true`) · `workspace.owner_id`(`(owner_id) WHERE
   type = 'personal'`) · `notification.user_id`(`(user_id, is_read, created_at DESC) WHERE dismissed_at IS NULL`). FK 조회(`$1 = col`)가 쓸 수
   있는 부분 인덱스는 조건이 `col IS NOT NULL` 인 것뿐이다(V115~V118 처럼). 보정하면 전수는 **40**, 남은 것은 **31** 이다. 그중
   `model_config.workspace_id` 는 모델 설정 목록(`workspace_id = ? AND kind = ?`)도 순차 스캔했다.

## 실측 (PostgreSQL 18, `pgvector/pgvector:pg18` 일회용 컨테이너, V001~V120 적용)

### 누가 부모를 지우나 (grep)

| 부모 | 앱의 삭제 경로 | 빈도 | 이 부모를 가리키는 31개 중 |
|---|---|---|---|
| `user` | **없다** — spec 의 «탈퇴» 는 워크스페이스 멤버십(`workspace_member` 행) 삭제다. `User` 를 지우는 repository 호출·raw SQL 0건 | — | 12 + 놓친 둘 |
| `node` | 캔버스 저장이 제출 목록에 없는 노드를 지운다 · 워크플로 삭제 · 워크스페이스 삭제의 연쇄 | **캔버스 저장마다** | 1 |
| `folder` | `FoldersService.remove` — 하위 폴더는 `folder.parent_id` CASCADE 로 연쇄 | 관리 동작 | 2 |
| `workflow` | 워크플로 삭제 | 관리 동작 | 1 |
| `auth_config` | `AuthConfigsService.remove` | 관리 동작 | 1 |
| `model_config` | `ModelConfigService.remove` | 관리 동작 | 6 |
| `integration` | `IntegrationsService.remove` | 관리 동작 | 1 |
| `workspace` | `WorkspacesService` 삭제(초대·멤버를 먼저 지우고 워크스페이스 행 — 나머지는 FK 연쇄) | 워크스페이스당 한 번 | 4 + 놓친 하나 |

### 규모

워크스페이스 W 개, 워크스페이스마다: 사용자(소유자) 1 · 멤버 1 · 인증 설정 5 · 모델 설정 3(chat · embedding · rerank) · KB 5(모델 설정
FK 넷 채움) · 폴더 10(루트 5 + 첫 폴더 밑 5) · 워크플로 10(각자 폴더 하나에 · 트리거 1 · 노드 10 · 엣지 9) · 트리거 절반에 인증 설정 ·
알림 규칙 5 · LLM 로그 200(chat · embedding 설정에 반씩) · 어시스턴트 세션 10(chat 설정) · 연동 2 · OAuth state/preview 는 워크스페이스 10개에 1.
W=10,000 이면 엣지 90만 · 노드 100만 · LLM 로그 200만 · 워크플로 · 트리거 · 폴더 · 세션 각 10만 · 인증 설정 · KB · 알림 규칙 각 5만.

### 비용 (새로 만든 데이터, 워밍 뒤 1회, ROLLBACK)

| 경로 | W=2,500 | W=10,000 | W=10,000 + V121~V129 |
|---|---|---|---|
| 캔버스 저장이 노드 하나를 뺀다 | 8.2 ms | **29.1 ms** | **0.15 ms** |
| 워크플로 삭제 | 79.5 ms | **306.8 ms** | **1.8 ms** |
| 폴더 삭제(하위 5개) | 5.9 ms | 19.5 ms | 0.53 ms |
| 인증 설정 삭제 | 0.94 ms | 3.1 ms | 0.11 ms |
| 모델 설정 삭제(chat / embedding) | 20.9 / 21.0 ms | 74.3 / 64.1 ms | 13.3 / 12.3 ms |
| 연동 삭제 | 0.07 ms | 0.13 ms | 0.16 ms |
| 워크스페이스 삭제 | 856 ms | **3,161 ms** | **49.6 ms** |

규모 4배에 3.3~4.1배 — 테이블 크기에 선형이다. W=10,000 에서 FK 별(전 → 후):

| FK | 경로 · 호출 수 | 전 | 후 |
|---|---|---|---|
| `edge.target_node_id` (CASCADE) | 노드 하나 1회 · 워크플로 삭제 10회 · 워크스페이스 삭제 100회 | 28.8 · 304.7 · 2,835 ms | 0.1 ms 미만 |
| `llm_usage_log.llm_config_id` (SET NULL) | 모델 설정 삭제 1회(로그 100행 갱신 포함) | 58.2 / 49.7 ms | 1.0 / 0.9 ms |
| `workflow.folder_id` (SET NULL) | 폴더 삭제 6회 | 17.4 ms | 0.35 ms |
| `folder.parent_id` (CASCADE) | 폴더 삭제 6회 | 1.96 ms | 0.13 ms |
| `workflow_assistant_session.llm_config_id` (SET NULL) | 모델 설정 삭제 1회 | 3.5 / 3.0 ms | 0.15 ms |
| `trigger.auth_config_id` (SET NULL) | 인증 설정 삭제 1회 | 3.1 ms | 0.09 ms |

계획으로 확인한 메커니즘(인덱스를 빼고 FK 트리거와 같은 모양의 조회를 generic plan 으로): `edge.target_node_id` 는 **순차 스캔**(90만 행 —
기존 UNIQUE `(source_node_id, source_port, target_node_id, target_port)` 는 선두가 다르다). `folder.parent_id` 는 기존
`(workspace_id, parent_id)` 를 쓰지만 `Index Searches: 1` — **인덱스 전체를 훑는다**(폴더 전체 수에 비례).

남은 FK 트리거(V121~V129 뒤, W=10,000, 호출당): `knowledge_base` 의 모델 설정 FK 넷 2.2~3.5 ms(모델 설정 삭제에 각 1회, 합 11~12 ms) ·
`alert_rule.workflow_id` 1.2~1.3 ms(워크플로 삭제에 1회) · `integration_oauth_state.integration_id` 0.06~0.08 ms. 워크스페이스를 부모로 둔
넷은 워크스페이스 삭제에 각 1회 — `knowledge_base.workspace_id` 3.2 ms · `auth_config.workspace_id` 1.2 ms · `integration_oauth_state` ·
`integration_oauth_preview` 의 `workspace_id` 각 0.06 · 0.04 ms(앞의 둘은 아래 조회 경로 인덱스가 함께 닫는다). 셈법 보정으로 나중에 더한
V130 은 따로 쟀다 — 워크스페이스 삭제의 `model_config.workspace_id` 0.88 → 0.04 ms(1회), 목록 조회는 아래 표.

### 조회 경로 (FK 가 아니라 목록 조회 — 31개 컬럼 전수 grep)

| 컬럼 | 조회 | 빈도 | W=10,000 전 → 후 |
|---|---|---|---|
| `workspace_member.user_id` | `GET /workspaces`(`listForUser` — `where: { userId }` 하나) · 개인 워크스페이스가 없는 사용자의 토큰 발급 · JWT fallback | 앱 로드마다 | 0.22 → 0.012 ms (1만 행 순차 스캔 → 인덱스) |
| `auth_config.workspace_id` | `GET /auth-configs` 목록 · 트리거 편집의 인증 설정 선택 상자 | 화면마다 | 0.99 → 0.038 ms (5만 행) |
| `knowledge_base.workspace_id` | `GET /knowledge-bases` 목록 · KB 선택 상자 · 어시스턴트 도구 `list_knowledge_bases` | 화면마다 | 1.53 → 0.033 ms (5만 행) |
| `trigger.auth_config_id` | `GET /auth-configs/:id/usage`(`where: { authConfigId }` 하나) — 이어지는 `execution (trigger_id, started_at)` 조회의 앞 단계 | 관리 화면 | 2.97 → 0.006 ms (10만 행) |
| `model_config.workspace_id` | `GET /model-configs` 목록(`workspace_id = ? AND kind = ?` — `is_default` 조건이 없어 기존 부분 UNIQUE 를 못 쓴다) · 노드 설정 · KB 설정의 모델 선택 상자 | 화면마다 | 1.55 → 0.022 ms (3만 행, `(workspace_id, kind)` 로) |

`workspace_id` 컬럼이 있는 테이블 20개 중 그것을 선두로 가진 **비부분** 인덱스가 없는 것은 다섯이다(카탈로그) — `knowledge_base` · `auth_config`
(PK 만) · `model_config`(부분 UNIQUE 만) · `integration_oauth_state` · `integration_oauth_preview`(10분 만료 일시 행, 아래 «마»). 나머지 열다섯은
있다. `workspace_member` 는 UNIQUE `(workspace_id, user_id)` 뿐이라 «이 사용자의 워크스페이스» 는 테이블을 훑는다.

`user` 를 가리키는 나머지 컬럼의 조회는 모두 다른 인덱스를 쓸 조건과 함께 걸린다 — `audit_log.user_id`(늘 `workspace_id` 와 함께, 관리자
화면) · `workflow.created_by`(`ownership` 필터, 늘 `workspace_id` 와 함께) · `workflow_assistant_session.user_id`(`workspace_id`/`workflow_id`
선두 복합 인덱스) · `integration_oauth_preview.user_id`(PK `preview_token` 과 함께) · `workspace.owner_id`(늘 `type = 'personal'` 과 함께 — 부분
UNIQUE 를 쓴다) · `notification.user_id`(늘 `workspace_id` 또는 `dismissed_at IS NULL` 과 함께 — 두 인덱스를 쓴다). 나머지는 조회 없음(FK 전용).

### 쓰기 비용 (10만 행 INSERT 5회 median, FK 컬럼을 전부 채운 최악, «있음 → 없음 → 있음» 세 묶음 · 묶음마다 VACUUM)

| 테이블 | 인덱스 | 있음 | 없음 | 있음(재) | 행당 |
|---|---|---|---|---|---|
| `edge` | `(target_node_id)` | 2,371.3 | 2,156.8 | 2,328.2 ms | +1.71~2.15 µs (+7.9~9.9%) |
| `llm_usage_log` | 부분 `(llm_config_id)` | 1,545.3 | 1,368.6 | 1,582.2 ms | +1.77~2.14 µs (+12.9~15.6%) |
| `workflow_assistant_session` | 부분 `(llm_config_id)` | 2,227.0 | 1,968.2 | 2,100.4 ms | +1.32~2.59 µs (+6.7~13.1%) |
| `workflow` | 부분 `(folder_id)` | 1,815.2 | 1,784.3 | 1,740.8 ms | −0.44~+0.31 µs (잡음 수준) |
| `folder` | 부분 `(parent_id)` | 1,490.6 | 1,393.7 | 1,554.2 ms | +0.97~1.60 µs |
| `trigger` | 부분 `(auth_config_id)` | 1,863.2 | 1,734.9 | 1,885.8 ms | +1.28~1.51 µs |
| `workspace_member` | `(user_id)` | 1,348.4 | 1,199.5 | 1,334.3 ms | +1.35~1.49 µs |
| `auth_config` | `(workspace_id)` | 778.7 | 684.4 | 769.7 ms | +0.85~0.94 µs |
| `knowledge_base` | `(workspace_id)` | 992.4 | 839.6 | 923.8 ms | +0.84~1.53 µs |
| `model_config` | `(workspace_id, kind)` | 836.0 | 695.3 | 829.1 ms | +1.34~1.41 µs |

행당 µs 대다. 가장 자주 쓰는 둘 — 엣지(캔버스 저장이 엣지를 한꺼번에 넣는다, 수십 개면 수십~백 µs)와 LLM 로그(LLM 호출 한 번에 1행,
호출은 수백 ms~초) — 도 무시할 만하다. 나머지 여덟은 사람이 설정을 만들 때만 쓰인다.

**측정 순서 한계**: 처음엔 ROLLBACK 한 INSERT 의 죽은 튜플이 묶음마다 쌓여 뒤 묶음이 불리했다(테이블이 부풀어 «있음(재)» 가 «없음» 보다 최대 +38% — `workflow` 1,772.6 → 2,449.7 ms).
묶음마다 VACUUM 을 넣어 다시 쟀고, 위 표가 그 값이다. 삭제·조회 비용도 같은 이유로 **새로 만든 데이터**에서 전·후를 한 번에 다시 쟀다.

크기(W=10,000): `edge(target_node_id)` 27 MB(테이블 108 MB) · `llm_usage_log(llm_config_id)` 14 MB(223 MB) · `workflow(folder_id)` 3.0 MB ·
`trigger(auth_config_id)` 1.5 MB · `workflow_assistant_session(llm_config_id)` 1.0 MB · `folder(parent_id)` · `auth_config(workspace_id)` ·
`knowledge_base(workspace_id)` 각 0.66 MB · `model_config(workspace_id, kind)` 1.3 MB · `workspace_member(user_id)` 0.32 MB. 부분 인덱스 둘(LLM 로그 · 세션)이 행 수보다 작은 것은 같은 설정을
가리키는 행이 많아 B-tree 중복 제거가 먹기 때문이다.

## 처분 — 31개

| 부모 | FK | 처분 | 근거(아래 «처분 기준») |
|---|---|---|---|
| node | `edge.target_node_id` | **V121** `(target_node_id)` | 가 — 지워지는 노드마다, 캔버스 저장마다 |
| model_config | `llm_usage_log.llm_config_id` | **V122** 부분 `(llm_config_id)` | 나 — LLM 호출마다 1행 |
| folder | `workflow.folder_id` | **V123** 부분 `(folder_id)` | 가 — 지워지는 하위 폴더마다 |
| folder | `folder.parent_id` | **V124** 부분 `(parent_id)` | 가 — 지워지는 하위 폴더마다 |
| model_config | `workflow_assistant_session.llm_config_id` | **V125** 부분 `(llm_config_id)` | 나 — 대화마다 1행, 자동 정리 없음(사용자가 직접 지울 때만 지워진다) |
| auth_config | `trigger.auth_config_id` | **V126** 부분 `(auth_config_id)` | 다 — 사용처 조회 + FK |
| workspace | `auth_config.workspace_id` | **V127** `(workspace_id)` | 다 — 목록 조회 |
| workspace | `knowledge_base.workspace_id` | **V128** `(workspace_id)` | 다 — 목록 조회 |
| user | `workspace_member.user_id` | **V129** `(user_id)` | 다 — 워크스페이스 목록 조회 |
| workspace | `model_config.workspace_id` *(셈법이 놓친 셋)* | **V130** `(workspace_id, kind)` | 다 — 모델 설정 목록 조회 |
| user | `alert_rule.created_by` · `audit_log.user_id` · `execution.executed_by` · `integration.created_by` · `integration_oauth_preview.user_id` · `integration_oauth_state.user_id` · `workflow.created_by` · `workflow_assistant_session.user_id` · `workflow_version.created_by` · `workspace_invitation.invited_by` · `workspace_invitation.accepted_by` (11) · *(셈법이 놓친 셋)* `workspace.owner_id` · `notification.user_id` (2) | 비대상 | 라 — 사용자를 지우는 앱 경로 없음 |
| integration · workspace | `integration_oauth_state.integration_id` · `integration_oauth_state.workspace_id` · `integration_oauth_preview.workspace_id` (3) | 비대상 | 마 — 10분 만료 일시 행 |
| model_config | `knowledge_base.extraction_llm_config_id` · `embedding_model_config_id` · `rerank_config_id` · `rerank_llm_config_id` (4) | 비대상 | 바 — 설정 테이블, 한 동작에 1회 |
| workflow | `alert_rule.workflow_id` | 비대상 | 바 — 설정 테이블, 한 동작에 1회 |

10 + 13 + 3 + 4 + 1 = 31.

## 변경안

### S1. `spec/1-data-model.md` §3 인덱스 전략 — 열 행 + 기존 한 행 정정

같은 테이블(또는 관련 테이블)의 기존 행 곁에 넣는다:

- 표 맨 앞(`Workflow | (workspace_id, is_active)` 행 앞):
  `| WorkspaceMember | (user_id) | 사용자별 워크스페이스 목록(`GET /workspaces`) — UNIQUE `(workspace_id, user_id)` 는 선두가 달라 테이블을 훑었다. FK `ON DELETE CASCADE` 도 이것을 쓴다. CONCURRENTLY, V129 |`
- `Workflow | (workspace_id, name)` 행 뒤:
  `| Workflow | (folder_id) WHERE folder_id IS NOT NULL | FK `ON DELETE SET NULL` — 폴더 삭제에서 지워지는 하위 폴더마다. partial 로 폴더 밖 워크플로(NULL) 제외. CONCURRENTLY, V123 |`
- `Edge | (source_node_id)` 행 뒤:
  `| Edge | (target_node_id) | FK `ON DELETE CASCADE` — 노드가 지워질 때마다(캔버스 저장 · 워크플로 삭제). UNIQUE `(source_node_id, source_port, target_node_id, target_port)` 는 선두가 달라 쓰이지 않는다. CONCURRENTLY, V121 |`
- `Trigger | (notification_health) …` 행 뒤:
  `| Trigger | (auth_config_id) WHERE auth_config_id IS NOT NULL | 인증 설정 사용처(`GET /api/auth-configs/:id/usage`)가 이 컬럼 하나로 트리거를 찾는다(이어서 위 `Execution (trigger_id, started_at DESC)`). FK `ON DELETE SET NULL`(인증 설정 삭제)도 이것을 쓴다. CONCURRENTLY, V126 |`
  `| AuthConfig | (workspace_id) | 워크스페이스별 인증 설정 목록 · 트리거 편집의 선택 상자. FK `ON DELETE CASCADE` 도 이것을 쓴다. CONCURRENTLY, V127 |`
  `| ModelConfig | (workspace_id, kind) | 워크스페이스·종류별 모델 설정 목록 · 모델 선택 상자. `(workspace_id, kind) WHERE is_default = true` UNIQUE(V089)는 부분이라 `is_default` 조건 없는 목록 조회와 FK `ON DELETE CASCADE` 가 쓰지 못했다. CONCURRENTLY, V130 |`
- `AssistantSession | (workflow_id, status, last_interaction_at DESC)` 행을 **`(workflow_id, user_id, status, last_interaction_at DESC)`** 로 정정
  (V019 가 처음부터 `user_id` 를 넣어 만들었다 — 카탈로그 대조. `data-flow/11-workflow.md` 는 이미 맞게 적었다). 둘째 AssistantSession 행 뒤:
  `| AssistantSession | (llm_config_id) WHERE llm_config_id IS NOT NULL | FK `ON DELETE SET NULL` — 모델 설정 삭제. 세션은 대화마다 생기고 자동 정리가 없어 사용량으로 자란다. CONCURRENTLY, V125 |`
- `LlmUsageLog | (execution_id) …` 행 뒤:
  `| LlmUsageLog | (llm_config_id) WHERE llm_config_id IS NOT NULL | FK `ON DELETE SET NULL` — 모델 설정 삭제. partial 로 설정 없이 부른 호출(NULL) 제외. CONCURRENTLY, V122 |`
  `| KnowledgeBase | (workspace_id) | 워크스페이스별 KB 목록 · KB 선택 상자 · 어시스턴트 도구 `list_knowledge_bases`. FK `ON DELETE CASCADE` 도 이것을 쓴다. CONCURRENTLY, V128 |`
- `Folder | (workspace_id, parent_id)` 행 뒤:
  `| Folder | (parent_id) WHERE parent_id IS NOT NULL | FK `ON DELETE CASCADE` — 폴더 삭제의 하위 폴더마다. 위 `(workspace_id, parent_id)` 는 선두가 달라 인덱스 전체를 훑었다. partial 로 루트 폴더(NULL) 제외. CONCURRENTLY, V124 |`

### S2. `spec/1-data-model.md` §2.24 LlmUsageLog «인덱스» 줄

`FK SET NULL 용 partial `(node_execution_id)` · `(execution_id)` (V115 · V116, §3)` →
`FK SET NULL 용 partial `(node_execution_id)` · `(execution_id)` · `(llm_config_id)` (V115 · V116 · V122, §3)`.

### S3. `spec/1-data-model.md` `## Rationale` 맨 위 새 절 — «쓸 인덱스가 없는 FK 서른하나의 처분 (2026-09-18)»

위 «실측» 의 경로 표 · 비용 표 · 조회 경로 표 · 쓰기 비용 요약과 «처분 기준»(아래 Rationale 의 그것), 셈법 보정(위 «새로 알게 된 것» 3)을
옮긴다. 31개 전수 표는 옮기지 않고 이 draft 의 «처분» 표를 출처로 인용한다(`plan/complete/spec-draft-fk-remaining-dispositions.md`).

**앞 절 정정 네 곳**(무근거 번복이 되지 않도록 명시):
- «삭제 연쇄의 FK 인덱스 다섯» 의 «그중 선두 인덱스가 없는 `alert_rule.workflow_id` · `edge.target_node_id` 는 작은 테이블이라 넣지 않았다»
  뒤에 — «**그 측정의 엣지는 약 1만 행이었다**(실행 이력이 많고 워크플로가 적은 구성). 워크플로 10만 규모에서는 `edge.target_node_id` 가
  캔버스 저장 경로의 가장 큰 비용이라 위 «쓸 인덱스가 없는 FK 서른하나의 처분» 절이 넣었다(V121). `alert_rule.workflow_id` 는 그 규모에서도
  1.3 ms 라 비대상 그대로다.»
- 같은 절 첫 문단 «단일 컬럼 FK 87개 중 그런 것이 37개이고(카탈로그 `pg_index.indkey[0]` 대조, 부모를 한정하지 않은 전수)» 뒤에 —
  «(**부분 인덱스도 «있음» 으로 센 수다** — FK 조회가 쓸 수 없는 부분 인덱스만 가진 셋을 더하면 40개다. 위 «쓸 인덱스가 없는 FK 서른하나의
  처분» 절)».
- 같은 절 끝 «나머지 32개 FK 는 트래커에 전수로 남겼다(… 28개가 남았다**)» 뒤에 — «그 28개와 셈법이 놓친 셋은 위 «쓸 인덱스가 없는 FK
  서른하나의 처분» 절이 모두 처분했다(인덱스 열 · 비대상 스물하나).»
- «Trigger `(workflow_id)` 인덱스» 절의 «같은 클래스 전수 — 나머지 여섯은 이 결정에 넣지 않았다» 문단 끝에 — 그 여섯의 처분
  (`integration_usage_log.workflow_id` 는 «다섯» 절 V114 · `auth_config.workspace_id` · `knowledge_base.workspace_id` 는 이 절 V127 · V128 ·
  `alert_rule.workflow_id` 와 OAuth 두 테이블의 `workspace_id` 는 비대상)과 «이 문단은 V111 시점 결정 범위에서 그대로 참이다» (`--spec`
  WARNING 1).

### S4. data-flow sink 행

| 문서 · 행 | 인덱스 칸에 더할 것 |
|---|---|
| `data-flow/11-workflow.md` `edge` 추가 | `· V121 `(target_node_id)` (FK CASCADE — 노드 삭제)` |
| `data-flow/11-workflow.md` `workflow` 생성 | `· V123 `(folder_id)` partial (FK SET NULL — 폴더 삭제)` |
| `data-flow/11-workflow.md` `workflow_assistant_session` 세션 생성 | `· V125 `(llm_config_id)` partial (FK SET NULL — 모델 설정 삭제)` |
| `data-flow/7-llm-usage.md` `llm_usage_log` | `V115 `(node_execution_id)` · V116 `(execution_id)`` 뒤에 `· V122 `(llm_config_id)`` (같은 괄호 «FK SET NULL — 부모 삭제») |
| `data-flow/7-llm-usage.md` `model_config` 생성·갱신 | V089 부분 UNIQUE 문장 뒤에 «V130 `(workspace_id, kind)` — 목록 조회(`kind` 별)와 FK CASCADE 용. 위 부분 UNIQUE 는 `is_default` 조건 없는 조회가 쓰지 못한다.» |
| `data-flow/10-triggers.md` `trigger` 생성 | `(auth_config_id)` partial 은 인증 설정 사용처 조회 · FK SET NULL 용이다 (V126). |
| `data-flow/6-knowledge-base.md` `knowledge_base` 생성 | `FK CASCADE on workspace_id` → `FK CASCADE on workspace_id · V128 `(workspace_id)` (목록 조회 · FK)` |
| `data-flow/12-workspace.md` `workspace_member` 가입·초대 수락·직접 추가 | `(workspace_id, user_id) UNIQUE` → `… · V129 `(user_id)` (사용자별 워크스페이스 목록 · FK)` |
| `data-flow/2-auth.md` `workspace_member` 회원가입 | 위와 같다 |

`folder` · `auth_config` 는 data-flow 에 생성 sink 행이 없어 §3 표에만 적는다.

## 구현 (같은 PR, developer 턴)

- **V121~V130** — 파일당 `DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS` + `.conf executeInTransaction=false`
  (`migrations/README.md` §5 «신규 추가에도 0) 을 둡니다», 선례 V111~V120). 이름: `idx_edge_target_node_id` · `idx_llm_usage_log_llm_config_id` ·
  `idx_workflow_folder_id` · `idx_folder_parent_id` · `idx_workflow_assistant_session_llm_config_id` · `idx_trigger_auth_config_id` ·
  `idx_auth_config_workspace_id` · `idx_knowledge_base_workspace_id` · `idx_workspace_member_user_id` · `idx_model_config_workspace_kind` —
  `codebase/`·`spec/`·`plan/` grep 0건, `V121~V130` 파일 0건(착수 시점 main `6f97cb619`).
- `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` 의 `EXPECTED` 에 열 건(실재 · `indisvalid` · 정의 대조). 머리말을 «세 PR 의
  인덱스» 로 넓힌다 — 이번 묶음은 조회 경로 인덱스도 담는다.

## 비대상

| 대상 | 이유 |
|---|---|
| 위 «처분» 표의 비대상 스물하나 | 아래 «처분 기준» 라 · 마 · 바 |
| 웹훅 트리거 조회 `trigger WHERE endpoint_path = ? AND type = 'webhook'` (웹훅 POST 마다 · 웹챗 `embed-config` 부팅마다) | **31개 밖**(FK 가 아니다). 인덱스가 `(workspace_id, endpoint_path)` UNIQUE 뿐이라 `workspace_id` 를 모르는 조회가 인덱스 전체를 훑는다 — W=10,000(웹훅 트리거 5만)에서 0.9 ms(`Index Searches: 1`). 고치는 방법이 «`endpoint_path` 유일성 범위를 전역으로» 냐 «비유일 보조 인덱스» 냐의 결정이라 트래커에 따로 올린다 |
| `WorkflowAssistantSession` 엔티티의 `@Index(['workflowId', 'status', 'lastInteractionAt'])` | S1 이 정정하는 §3 행과 같은 사실(`user_id` 누락)의 코드 사본. `synchronize: false` 라 DB 에 영향이 없고, 고치면 `--impl-done` 범위가 `spec/3-workflow-editor/` 로 늘어난다 — 트래커에 한 줄로 올린다 |

## 트래커 반영

- «선두 인덱스가 없는 FK — … 28개 남음» → **`[x]` 해소**(셈법 보정으로 31개 — 인덱스 열 V121~V130 · 비대상 스물하나, 이 draft). 다음 후보 줄은 지운다.
- 새 항목: «웹훅 트리거 조회가 `endpoint_path` 인덱스 전체를 훑는다» (위 비대상 표 둘째 줄의 실측과 두 해법).
- 새 한 줄: `WorkflowAssistantSession` `@Index` 데코레이터의 `userId` 누락(위 비대상 표 셋째 줄).
- 새 planner 항목: `spec/conventions/` 3섹션 구조 편차(`--impl-prep` WARNING 1 · 2 — `migrations.md` Rationale 배치 · Overview 생략 13개).
- 전수 부록(`plan/complete/spec-draft-deletion-cascade-indexes.md`) «처분» 칸 28행 전부 — ✅ V121~V129 또는 «비대상(라/마/바)». 표 아래에
  셈법이 놓친 셋을 따로 적는다(표 자체는 V111 시점 카탈로그 출력이라 행을 끼워 넣지 않는다).

## 체크리스트

- [x] `--spec` `review/consistency/2026/09/18/22_33_00` **BLOCK: NO** (Critical 0 · WARNING 1 · INFO 5) — 처분은 아래 Rationale «`--spec` 처분»
- [x] S1~S4 반영 (+ WARNING 1 넷째 정정 · INFO 3 «라» 재개 조건)
- [x] `--impl-prep spec/conventions/` — `review/consistency/2026/09/18/22_44_08` **BLOCK: NO** (Critical 0 · WARNING 2 · INFO 7).
  WARNING 1 · 2 는 이 작업과 무관한 `spec/conventions/` 기존 구조(`migrations.md` 의 `## 7. 폐기 대안 (Rationale)` 뒤에 `## 참고` 가 오는 배치 ·
  최상위 23개 중 13개의 `## Overview` 생략) — planner 영역이라 트래커에 올린다(아래 «트래커 반영»). INFO 2 · 3 은 `--impl-done` 에서 확인할
  것(파일 열 개의 DROP 선행 패턴 · `plan/complete/` 선인용이 이동 뒤 실재하는지) — 마지막 체크 항목의 grep 과 같다
- [x] V121~V130 · e2e 열 건 · `python3 scripts/check-migration-versions.py --base origin/main` → `OK: 130 migration(s), max V130`.
  일회용 pg18 에 파일 그대로 두 번 적용(멱등) → 열 개 모두 `indisvalid`. e2e 정규식 판별력: 실제 정의 10/10 맞음 · 오답 22개(조건 누락 ·
  조건 추가 · 선두 변경 · 기존 부분 UNIQUE · 컬럼 순서) 전부 거부
- [ ] lint · unit · build · e2e
- [ ] `/ai-review`
- [ ] `--impl-done`
- [ ] 트래커 · 부록 반영 · 이 draft `complete/` 이동(마지막 커밋). 이동 뒤 `grep -rln "plan/complete/spec-draft-fk-remaining-dispositions.md" spec codebase`
  로 인용 전부가 실재 경로를 가리키는지 확인

## Rationale

### 처분 기준

FK 트리거 비용은 «자식 테이블 크기 × 연쇄로 지워지는 부모 행 수» 다(«삭제 연쇄의 FK 인덱스 다섯» 절). 남은 31개는 한 동작에 한 번
불리는 것이 대부분이라, 곱의 **어느 쪽이 사용자 데이터로 자라는가**로 갈랐다 — 호출당 ms 문턱 하나로 자르면 규모가 바뀔 때마다 결론이
바뀐다.

인덱스를 둔다:
- **가. 한 동작의 호출 수가 사용자 데이터로 는다** — 지워지는 노드마다(`edge.target_node_id`: 캔버스 저장 · 워크플로 삭제), 지워지는 하위
  폴더마다(`workflow.folder_id` · `folder.parent_id`: 폴더 삭제).
- **나. 자식 테이블이 설정 수가 아니라 사용량으로 자란다** — LLM 호출마다 1행(`llm_usage_log.llm_config_id` — 보존 정리 없음), 어시스턴트
  대화마다 1행(`workflow_assistant_session.llm_config_id` — 자동 정리가 없다. archived 로 숨기고, 행이 지워지는 것은 사용자가 세션을 직접
  지울 때뿐이다).
- **다. 그 컬럼으로 목록을 찾는 조회가 쓸 인덱스 없이 요청마다 돈다** — 테넌트 전체 행 수에 비례한다(`workspace_member.user_id` ·
  `auth_config.workspace_id` · `knowledge_base.workspace_id` · `trigger.auth_config_id` · `model_config.workspace_id`). FK 비용이 작아도 조회가
  이유가 된다.

두지 않는다:
- **라. 부모를 지우는 앱 경로가 없다** — `user` 를 가리키는 13개. 그중 NO ACTION 여섯(`audit_log.user_id` · `execution.executed_by` · `notification.user_id` ·
  `integration.created_by` · `workflow.created_by` · `workflow_version.created_by`)은 참조 행이 있는 사용자의 삭제를 거부한다 — 사용자 삭제는
  지금 스키마가 받아 주지 않는 동작이다. 사용자 삭제를 더하는 변경은 이 13개의 처분부터 다시 정해야 한다(`--spec` INFO 3).
- **마. 자식이 만료로 쓸려 나가는 일시 행** — `integration_oauth_state` · `integration_oauth_preview`(`STATE_TTL_MS` · `PREVIEW_TTL_MS` 10분,
  OAuth 시작 때 만료 행을 지운다). W=10,000 에 2,000행,
  호출당 0.1 ms 미만.
- **바. 자식이 설정 테이블이고 한 동작에서 한 번 불리며, 그 컬럼의 조회 경로가 없다**(grep — FK 전용) — `knowledge_base` 의 모델 설정 FK 넷
  (모델 설정 삭제에 각 1회, W=10,000 에서 2.2~3.5 ms · 합 11~12 ms), `alert_rule.workflow_id`(워크플로 삭제에 1회, 1.2~1.3 ms).

**워크스페이스 삭제는 «가» 의 곱에서 뺀다.** 워크스페이스의 모든 행을 지우는 한 번뿐인 동작이라 모든 연쇄가 곱해지는 것이 정상이고,
그 기준을 넣으면 워크스페이스 단위 설정 FK 가 전부 대상이 된다. 대신 합을 쟀다: W=10,000 에서 3,161 → 49.6 ms, 남은 것의 대부분이 «바» 다.

### 왜 FK 항목에서 조회 경로 인덱스까지 넣나

트래커 항목은 FK 비용이었고, `workspace_member.user_id` · `auth_config.workspace_id` · `knowledge_base.workspace_id` · `model_config.workspace_id`
는 FK 로는 «라» · «바» 에 해당한다. 그런데 그 넷은 조회 경로가 인덱스 없이 쓴다 — FK 비대상으로 적고 항목을 닫으면 **그 컬럼에 대해 «인덱스가 필요 없다» 는 틀린
결론**을 SoT(부록 «처분» 칸)에 남긴다. 별 항목으로 떼면 같은 컬럼을 곧바로 다시 여는 셈이라 여기서 같이 닫는다. 31개 **밖**에서 같은
모양으로 찾은 웹훅 조회는 이 논리가 적용되지 않아(범위 밖 컬럼 · 유일성 범위 결정이 걸린다) 트래커로 보낸다.

### 왜 다섯은 partial 이고 다섯은 아닌가

`llm_usage_log.llm_config_id` · `workflow_assistant_session.llm_config_id` · `workflow.folder_id` · `folder.parent_id` · `trigger.auth_config_id` 는
nullable 이고, FK 트리거의 등치 조회(`$1 = col`)와 사용처 조회(`auth_config_id = $1`)는 `IS NOT NULL` 을 함의해 부분 인덱스를 쓸 수 있다
(V115 · V116 · V117 · V118 과 같은 이유). `edge.target_node_id` · `workspace_member.user_id` · `auth_config.workspace_id` · `knowledge_base.workspace_id` ·
`model_config.workspace_id` 는 NOT NULL 이다. `model_config` 만 두 컬럼 `(workspace_id, kind)` 인 것은 목록 조회가 늘 `kind` 를 함께 걸기
때문이다 — FK 조회는 선두 `workspace_id` 만으로 쓴다.

### 측정을 다시 한 이유

쓰기 비용을 잴 때 ROLLBACK 한 INSERT 가 테이블을 부풀렸고(VACUUM 은 파일을 줄이지 않는다), 그 뒤에 잰 «후» 수치 일부가 부푼 테이블
위의 값이었다 — `folder.parent_id` 가 호출당 0.33 ms(새 데이터)에서 약 3 ms(부푼 데이터)로 보였고, 같은 조회의 계획도 인덱스 전체 스캔에서
순차 스캔으로 바뀌었다. 그래서 삭제 · 조회의 전 · 후는 새로 만든 데이터에서 한 번에 다시 쟀고, 쓰기 비용은 묶음마다 VACUUM 을 넣어 다시 쟀다.
위 표는 모두 다시 잰 값이다.

### 왜 셈법을 고쳤나 — 부분 인덱스는 «있음» 이 아니다

«전수 37» 은 `pg_index.indkey[0] = FK 컬럼` 인 인덱스가 **하나라도** 있으면 «있음» 으로 셌다. 부분 인덱스의 조건은 보지 않았다. FK
트리거의 조회는 `$1 = col` 하나라, 조건이 `col IS NOT NULL` 인 부분 인덱스만 쓸 수 있다 — 다른 조건(`is_default = true` ·
`type = 'personal'` · `dismissed_at IS NULL`)이 붙은 부분 인덱스는 «없음» 과 같다. 셈을 «`indpred` 가 없거나 `col IS NOT NULL` 인 것만 있음»
으로 고쳐 같은 프로브(V001~V120)에서 전수를 다시 뽑으니 셋이 더 나왔다. 이 항목을 «해소» 로 닫으려면 놓친 셋까지 처분해야 해서 이
PR 이 함께 다룬다.

### `--spec` 처분 (`review/consistency/2026/09/18/22_33_00` — **BLOCK: NO**, Critical 0 · WARNING 1 · INFO 5)

번들이 예산에 잘려 다섯 프롬프트 모두 `spec/1-data-model.md` §3 과 `spec/conventions/migrations.md` 가 빠져 있었다(main 실측: `## 3. 인덱스
전략` 0건 · `id: migrations` 0건). 절대경로로 직접 Read 하라는 블록을 붙여 돌렸다.

- **WARNING 1** «Trigger `(workflow_id)` 인덱스» 절의 «나머지 여섯» 중 넷을 이 draft 가 처분하는데 그 절에 상호 참조가 없다 → S3 에 넷째 정정을
  더했다(여섯 전부의 처분 · «V111 시점 범위에서 그대로 참»). «다섯» 절이 세운 관계 addendum 관례를 이 절에도 적용한 것이다.
- **INFO 1** 정정을 각주가 아니라 결론 문장 옆에 — 정정 문장을 «작은 테이블이라 넣지 않았다» **바로 뒤**에 이어 붙이므로 이미 인라인이다. 원문은
  그 측정 범위에서 참이라 지우지 않는다(앞 두 절과 같은 관례).
- **INFO 2** draft 의 중첩 backtick 이 draft 렌더링을 깬다 — spec 에는 전이되지 않는다. 조치 불요.
- **INFO 3** «라» 의 재개 조건이 어디에도 없다 → Rationale «라» 와 S3 에 «사용자 삭제를 더하는 변경은 이 13개의 처분부터 다시 정해야 한다» 를
  넣었다(조건문이라 예측이 아니다).
- **INFO 4 · 5** 새 식별자 충돌 0건 · 트래커 새 항목 배치 — 조치 불요(배치는 트래커 반영 때 기존 항목 옆에 둔다).
