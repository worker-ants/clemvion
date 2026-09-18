---
title: 엔티티의 인덱스·제약 선언이 실제 DB 와 다른 여덟 곳 — 정정 + 회귀 e2e
status: in-progress
owner: developer
worktree: entity-index-drift-4c8e21
started: 2026-09-19
spec_impact: none
---

# 엔티티의 인덱스·제약 선언이 실제 DB 와 다른 여덟 곳

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목
«`WorkflowAssistantSession` 엔티티의 `@Index(['workflowId', 'status', 'lastInteractionAt'])` 에 `userId` 가 빠졌다»
(2026-09-18 등재)를 닫는다. 트래커는 **한 곳**을 적었다. 같은 클래스(엔티티 데코레이터가 DB 에 없는 스키마를
주장한다)를 전수로 훑으니 **여덟 곳**이었다.

`synchronize: false`(`app.module.ts`)라 이 선언들은 DB 를 바꾸지 않는다 — 스키마의 SoT 는 Flyway 마이그레이션이다.
그래서 **동작은 바뀌지 않는다.** 그러나 선언은 코드를 읽는 사람에게 «이 인덱스·제약이 있다» 고 말한다. 그 말이
틀리면 다음 사람이 없는 인덱스를 믿고 쿼리를 짜거나, 없는 CHECK 를 믿고 앱 검사를 뺀다.

## 방법 — 두 가지를 따로 돌려 서로 확인했다

일회용 `pgvector/pgvector:pg18` 에 V001~V132 를 차례로 적용하고(파일당 psql 1회), 엔티티 쪽은 손으로 파싱하지 않고
**TypeORM 이 만든 메타데이터**(`ROOT_ENTITIES` 로 `DataSource` 의 `buildMetadatas()` — DB 연결 없음)를 그대로 뽑았다.

1. **직접 대조** — 엔티티 41개의 선언 104개(`@Index` 24 · `@Unique`/`unique: true` 14 · `@Check` 2 · 관계 FK 64)를
   DB 의 인덱스 182개 · FK 87개 · CHECK 40개와 맞췄다. 인덱스는 테이블 · 컬럼 순서 · 유일성 · 부분 조건 · (선언했으면)
   이름, FK 는 테이블 · 컬럼 · 참조 테이블 · `ON DELETE` · `ON UPDATE`.
2. **TypeORM 비교기** — `driver.createSchemaBuilder().log()` 로 synchronize 가 실행**할** SQL 을 계산만 했다(369문).
   대부분은 이름 차이에서 오는 소음이다(DB 는 `*_fkey` · `idx_*`, TypeORM 은 해시 이름이라 FK 64개를 전부 지웠다
   다시 만든다). 소음이 아닌 것만 골랐다.

두 방법이 인덱스·유니크 다섯을 **똑같이** 냈다. FK 의 `ON DELETE` 차이는 1번만 잡았다 — 2번은 FK 를 이름으로만
비교해 전부 재생성으로 덮는다. `@Check` 둘은 2번의 SQL 을 실제로 돌려 보고서야 **만들 수조차 없다**는 것이 드러났다.

## 발견 — 여덟 곳 (여섯 파일)

| # | 파일 | 선언 | 실제 DB | 처분 |
|---|---|---|---|---|
| 1 | `workflow-assistant/entities/workflow-assistant-session.entity.ts` | `@Index(['workflowId', 'status', 'lastInteractionAt'])` | `idx_workflow_assistant_session_wf_user_active (workflow_id, user_id, status, last_interaction_at DESC)` (V019) — `user_id` 가 빠졌다 | 컬럼 정정 + 이름 명시(같은 파일의 짝 `…_user_recent` 도 이름 명시) |
| 2 | `node-executions/entities/node-execution.entity.ts` | `@Index(['executionId', 'status'])` — 전체 인덱스 | `idx_node_execution_exec_status_active (execution_id, status) WHERE status IN ('waiting_for_input', 'running')` (V095) — **부분** 인덱스. 바로 위 JSDoc 은 V095 의 부분 인덱스를 «이 데코레이터로 인식만 선언» 한다고 적었지만 `where` 가 빠졌다 | `where` + 이름 추가 |
| 3 | `nodes/entities/node.entity.ts` | `@Index('IDX_node_workflow_label', ['workflowId', 'label'])` | **없다.** `node` 의 `workflow_id` 인덱스는 `idx_node_workflow (workflow_id)` 하나. 바로 위 주석이 «대응 마이그레이션이 없는 `@Unique('UQ_node_workflow_label')` 를 오해성 선언이라 제거했다» 고 적었는데, 같은 이름 계열의 `@Index` 가 남았다 | 제거 |
| 4 | `workspaces/entities/workspace.entity.ts` | `@Index(['ownerId', 'type'])` | **없다.** 실제는 `uq_workspace_personal_owner (owner_id) UNIQUE WHERE type = 'personal'` (V109). 바로 위 주석도 «DB 강제가 필요하면 … 도입한다» 로 V109 이전에 멈춰 있다 | V109 인덱스로 교체 + 주석 정정 |
| 5 | `integrations/entities/integration-expiry-dispatch.entity.ts` | `@Unique('integration_expiry_dispatch_key', [...])` | 컬럼은 맞다. 이름은 Postgres 자동 이름 `integration_expiry_dispatch_integration_id_threshold_token__key` (V009 의 이름 없는 `UNIQUE (...)`). 이 이름을 참조하는 코드는 없다 — 삽입은 대상 없는 `ON CONFLICT DO NOTHING`(`orIgnore()`) | 이름 제거 — 다른 `@Unique` 여섯처럼 이름 없이 |
| 6 | `edges/entities/edge.entity.ts` | ``@Check(`"source_node_id != target_node_id"`)`` | `chk_no_self_loop CHECK (source_node_id <> target_node_id)` (V001). 선언은 식 **전체**를 큰따옴표로 감쌌다 — SQL 로는 `source_node_id != target_node_id` 라는 **이름의 컬럼**이다. 실측: `ERROR: column "source_node_id != target_node_id" does not exist` | 따옴표 제거 + 이름 명시 |
| 7 | `nodes/entities/node.entity.ts` | ``@Check(`"NOT (container_id IS NOT NULL AND tool_owner_id IS NOT NULL)"`)`` | `chk_node_placement` (V001) — 6 과 같은 결함 | 따옴표 제거 + 이름 명시 |
| 8 | `workspaces/entities/workspace.entity.ts` | `@ManyToOne(() => User)` — `onDelete` 없음 = `NO ACTION` | `owner_id … REFERENCES "user"(id) ON DELETE CASCADE` (V001). spec `1-data-model.md` §2 Workspace 표는 `FK → User` 만 적는다 | `{ onDelete: 'CASCADE' }` |

6·7 을 고친 식은 임시 테이블(`CREATE TEMP TABLE … (LIKE public.edge)`)에서 실제 제약과 `pg_get_constraintdef` 까지 같다.

맞는 것: 나머지 선언 96개. 방향(`DESC`)은 TypeORM `@Index` 가 표현하지 못해 비교하지 않았다(`entity.entity.ts`
주석이 이미 적은 관례). FK `ON UPDATE` 64개는 모두 `NO ACTION` 으로 일치.

## 규칙 — 선언은 실재하는 것만, 실재하면 그대로

- DB 에 **없는** 인덱스·제약은 선언하지 않는다(선례: 같은 파일들의 `@Unique` 제거 둘, `data-flow/7-llm-usage.md`
  «이력» 의 `llm_config_workspace_default_unique`).
- DB 에 **있는** 것을 선언하면 컬럼 순서 · 유일성 · 부분 조건을 맞추고, 이름을 적으면 실제 이름을 적는다.
- DB 에 있는 인덱스를 **선언하지 않는 것**은 결함이 아니다(DB 인덱스 182개 중 선언된 것은 소수 — `integration-usage-log.entity.ts`
  는 방향 drift 를 피하려 일부러 생략했다). 이 PR 은 **거짓 선언**만 다룬다.

## 회귀 방지 — e2e 가드

이 클래스는 이미 세 번 사람이 손으로 고쳤다(`node` 의 `@Unique` · `workspace` 의 `@Unique` · `llm_config` 의 `@Index`).
그래도 여덟이 남았다 — 산문 규율로는 못 막는다. 그래서 위 «직접 대조» 를 e2e 로 옮긴다:
`codebase/backend/test/entity-schema-declarations.e2e-spec.ts`.

- 엔티티 쪽은 `ROOT_ENTITIES` 로 만든 `DataSource` 의 메타데이터, DB 쪽은 카탈로그(`pg_index` · `pg_constraint`).
- 부분 조건 · CHECK 식은 문자열로 비교하지 않는다 — 선언의 식으로 **임시 테이블**에 같은 인덱스 · 제약을 실제로 만들어
  Postgres 가 정규화한 정의(`pg_get_expr` · `pg_get_constraintdef`)를 비교한다. 만들 수 없는 식(6 · 7)은 그 자체로 실패다.
- 트랜잭션 안에서 하고 ROLLBACK 한다(임시 테이블 · 인덱스는 남지 않는다).

## 비대상 — 컬럼 층 (트래커에 등재)

TypeORM 비교기는 인덱스·제약 말고 **컬럼** 차이도 냈다. 이 PR 의 클래스(«없는 인덱스·제약을 주장») 와 층이 달라 트래커에
올린다 — 대부분은 선언이 **생략**해서 TypeORM 이 기본값을 추론한 것이다.

- uuid 컬럼을 varchar 로 추론 5 — 관계 없이 `@Column({ name })` 만 둔 FK 컬럼: `alert_rule.workspace_id` ·
  `workspace_invitation.workspace_id` · `integration_usage_log.node_execution_id` · `integration_usage_log.workflow_id` ·
  `llm_usage_log.workspace_id`(모두 DB 는 `uuid NOT NULL`).
- enum 타입 이름 2 — `node.category`(DB `node_category`) · `edge.type`(DB `edge_type`), 엔티티는 `enumName` 없음.
- 기본값 생략 2 — `model_config.kind`(DB `'chat'`) · `workflow_assistant_session.last_interaction_at`(DB `now()`).
- 선언하지 않은 컬럼 2 — `document_chunk.embedding` · `agent_memory.embedding`(`vector`, 원시 SQL 로만 다룬다 — 의도된 생략으로 보인다).

## 착수 전 검토

- **1차 `--impl-prep spec/3-workflow-editor/`** `review/consistency/2026/09/19/08_07_50` — **BLOCK: YES**. Critical 은 이 작업이
  아니라 scope 안에 원래 있던 결함(§13 i18n 표의 금지어 «엣지»)이었다. spec 이라 planner 턴으로 고쳤다 — 표 41행을 사전과
  전수 비교해 13행 + 같은 divider 사실을 적는 넷(`plan/complete/spec-draft-assistant-i18n-table-sync.md`, `--spec`
  `08_23_02` BLOCK: NO, 커밋 `ff530fc8a`).
- **2차 `--impl-prep spec/3-workflow-editor/`** `review/consistency/2026/09/19/08_33_13` — **BLOCK: NO** (Critical 0 · WARNING 2 · INFO 6).
  - WARNING 1: `spec/1-data-model.md` §2 Workspace `owner_id` 행이 삭제 동작(`ON DELETE CASCADE`, V001)을 적지 않는다 — 이 PR 이
    엔티티에 CASCADE 를 적으면 «코드는 명시, spec 은 침묵» 이 된다. spec 이라 트래커에 등재(planner). 동작 변화는 없다.
  - WARNING 2: scope 가 여섯 파일 중 둘(workspace · integration)의 소유 spec(`spec/2-navigation/9-user-profile.md` ·
    `4-integration.md`)을 덮지 못했다. 두 문서를 직접 grep 했다 — 인덱스·제약 이름이나 Workspace 소유자 FK 의 삭제 동작을 적는
    곳이 없다(9-user-profile 209행의 «유일한 owner 는 차단» 은 멤버 나가기 규칙). `--impl-done` 은 `spec/2-navigation/` 로도 돌린다.
  - INFO 3 (rationale_continuity, 1차): Workspace→User FK 정정은 선언을 실재에 맞출 뿐 «유저 삭제 기능 추가» 가 아니므로
    `spec/1-data-model.md` Rationale «FK 서른하나의 처분» 의 «user 참조 FK 13개 재처분» 게이트를 발동시키지 않는다.

## 체크리스트

- [x] `--impl-prep spec/3-workflow-editor/` — 2차 `08_33_13` BLOCK: NO (위 «착수 전 검토»)
- [ ] e2e 가드 선작성 — 현재 코드에서 여덟 곳 RED 확인
- [ ] 여섯 파일 정정 — 가드 GREEN
- [ ] 가드 뮤턴트 — 정정을 하나씩 되돌려 RED
- [ ] TEST WORKFLOW (lint · unit · build · e2e) + 백엔드 타입체크 ratchet
- [ ] `/ai-review`
- [ ] `--impl-done` — `spec/3-workflow-editor/` 와 `spec/2-navigation/` 둘 다
- [ ] 트래커 반영(항목 닫기 + 컬럼 층 등재) · 이 plan `complete/` 이동
