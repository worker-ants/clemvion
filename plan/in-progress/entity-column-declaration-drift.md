---
title: 엔티티 컬럼 선언이 실제 DB 와 다른 아홉 곳 정정 + 가드를 컬럼 층으로 확장
status: in-progress
owner: developer
worktree: entity-column-drift-b83f15
started: 2026-09-19
spec_impact: none
---

# 엔티티 컬럼 선언 아홉 곳 + 컬럼 층 가드

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목 «엔티티 컬럼 선언이 실제 DB 와 다른 아홉 곳 —
인덱스·제약 층은 닫혔고 컬럼 층이 남았다»(2026-09-19 등재, `plan/complete/entity-schema-declaration-drift.md` «비대상»)를 닫는다.
**사용자 결정(2026-09-19)**: «고치고 가드 확장».

`synchronize: false` 라 동작은 거의 그대로다(아래 «런타임 영향» 한 가지).

## 실측 — TypeORM 스키마 비교기

일회용 PostgreSQL 18 에 V001~V132 를 적용하고 `ds.driver.createSchemaBuilder().log()` 로 synchronize 가 **실행할** SQL 을 계산만 했다
(`log()` 는 카탈로그를 읽은 뒤 `enableSqlMemory()` 로 DDL 을 기록만 한다 — TypeORM 0.3.31 `RdbmsSchemaBuilder.log` 소스로 확인).

- main(`cef3687f2`): 358문. 그중 컬럼 층 — 아래 아홉 곳이 만드는 문 + `embedding` DROP 둘.
- 고친 뒤: 326문. 컬럼 층은 **`embedding` DROP 둘뿐**. 나머지 324문은 이름 차이(DB `*_fkey` · `idx_*` 대 TypeORM 해시 이름)로 FK · 인덱스 ·
  유니크를 지웠다 다시 만드는 것과 DB 에만 있는 `COMMENT ON` 이다 — 선언의 사실과 무관하다.

| # | 파일 | 선언 | 실제 DB | 처분 |
|---|---|---|---|---|
| 1 | `alerts/entities/alert-rule.entity.ts` | `workspace_id` — `@Column({ name })` 만, TypeORM 이 `varchar` 로 추론 | `uuid NOT NULL` | `type: 'uuid'` |
| 2 | `workspaces/entities/workspace-invitation.entity.ts` | `workspace_id` 같음 | `uuid NOT NULL` | `type: 'uuid'` |
| 3 | `integrations/entities/integration-usage-log.entity.ts` | `node_execution_id` 같음 | `uuid NOT NULL` | `type: 'uuid'` |
| 4 | 같은 파일 | `workflow_id` 같음 | `uuid NOT NULL` | `type: 'uuid'` |
| 5 | `llm/entities/llm-usage-log.entity.ts` | `workspace_id` 같음 | `uuid NOT NULL` | `type: 'uuid'` |
| 6 | `nodes/entities/node.entity.ts` | `category` enum, `enumName` 없음 → TypeORM 은 `node_category_enum` | 타입 `node_category` | `enumName: 'node_category'` |
| 7 | `edges/entities/edge.entity.ts` | `type` enum 같음 → `edge_type_enum` | 타입 `edge_type` | `enumName: 'edge_type'` |
| 8 | `model-config/entities/model-config.entity.ts` | `kind` 기본값 없음 | `DEFAULT 'chat'` | `default: 'chat'` |
| 9 | `workflow-assistant/entities/workflow-assistant-session.entity.ts` | `last_interaction_at` 기본값 없음 | `DEFAULT now()` | `default: () => 'now()'` |

`embedding`(`document_chunk` · `agent_memory`, `vector`)은 엔티티가 **선언하지 않는다** — 원시 SQL 로만 다루는 의도된 생략이다
(TypeORM 은 `vector` 타입을 모른다). 가드의 예외 목록에 이름과 이유를 적는다.

**런타임 영향**: `type: 'uuid'` · `enumName` 은 스키마 비교에만 쓰인다. `default` 를 선언하면 TypeORM 이 insert 뒤 그 컬럼을 `RETURNING`
으로 받아 엔티티 객체에 채운다(`ReturningResultsEntityUpdator` — 기본값이 있는 컬럼을 돌려받는다). 값은 DB 기본값 그대로라 의미는 같다.
e2e 전체로 확인한다.

## 가드 — `entity-schema-declarations.e2e-spec.ts` 에 컬럼 층 한 테스트

- 비교기의 `upQueries` 중 **컬럼 층** 문(`ADD "컬럼"` · `DROP COLUMN` · `ALTER COLUMN` · `ALTER/CREATE/DROP TYPE` · `RENAME COLUMN`)이 0 이어야 한다.
- 예외는 선언을 생략한 컬럼 목록(지금 `embedding` 둘) — 문자열 그대로. **예외 목록이 낡지 않았는지도 본다**: 목록의 문이 실제로 나와야 한다
  (누가 `embedding` 을 선언하면 예외가 필요 없어졌다고 실패한다).
- **트래커가 물은 «선언 생략 vs 거짓 선언» 기준은 이것이다**: 비교기가 내는 컬럼 층 문은 전부 결함(거짓 선언 — 생략해 TypeORM 이 추론한
  값이 DB 와 다르면 그 추론값이 곧 거짓 선언이다)이고, **예외는 선언 자체를 두지 않은 컬럼(`embedding` 둘)뿐**이며 그것도 목록에 이유와 함께
  이름을 올려야 한다(`--impl-prep` `review/consistency/2026/09/19/16_54_09` plan_coherence INFO 6).
- 이 층은 **양방향**이다 — 인덱스 · 제약 층(선언이 있으면 DB 에도)과 달리, DB 에만 있는 컬럼도 `DROP COLUMN` 으로 걸린다. 선언 생략은
  예외 목록에 이름과 이유를 적어야 한다. 가드 머리말의 «컬럼 정의는 이 가드 밖» 문장을 고친다.

## 실측 — 가드 뮤턴트 (2026-09-19, 일회용 `pgvector/pgvector:pg18` 에 V001~V132, 예측을 먼저 적고 실행)

같은 e2e 파일을 그 DB 에 대고 jest 로 컬럼 테스트만 돌렸다(`-t «컬럼 — TypeORM»`). 원복은 원본 바이트 되쓰기 + 바이트 일치 단언.

| 뮤턴트 | 예측 | 실측 |
|---|---|---|
| C1~C9 — 아홉 수정을 하나씩 되돌림 | 전부 RED | 전부 RED |
| A1 — 예외 목록에서 `agent_memory.embedding` 빼기 | RED | RED |
| A2 — 없는 문(`node.ghost`)을 예외 목록에 추가 | RED(낡은 예외) | RED |
| R1 — 컬럼 층 패턴에서 `ALTER COLUMN` 제거(단독) | GREEN — 고친 코드엔 걸릴 문이 없다 | GREEN |
| R2 — R1 + C8(기본값 되돌림) | GREEN — 기본값 drift 는 `ALTER COLUMN` 으로만 나온다 | GREEN |

R1 · R2 는 «패턴이 하중을 받는가» 를 가르는 쌍이다 — R1 만으로는 못 가르고, R2 가 그 패턴 없이는 기본값 drift 를 놓친다는 것을 보인다.

**리뷰 1라운드 뒤 보강** (`review/code/2026/09/19/17_04_28` testing WARNING 1 · 2): 다섯 패턴 중 `ADD "…"` · `RENAME COLUMN` 은 위 뮤턴트
어디서도 매치된 적이 없었다. 같은 일회용 DB 에 엔티티 뮤턴트(컬럼 추가 · 이름 변경 · uuid · enum · 기본값)를 걸어 비교기가 **실제로 낸**
문장을 채집해 DB 없이 도는 표본 테스트로 고정했다(RENAME 도 실제로 나온다 — TypeORM 은 열 수가 같고 이름만 하나 다르면 RENAME 을 낸다).
`log()` 의 «DB 를 바꾸지 않는다» 는 호출 전후 카탈로그 해시(컬럼 정의 · enum 타입) 비교로 직접 단언한다.

| 뮤턴트 | 예측 | 실측 |
|---|---|---|
| P1 · P2 — `ADD` · `RENAME COLUMN` 패턴 제거 | RED | RED |
| P3 — `ADD` 패턴을 `ADD CONSTRAINT` 까지 잡게 느슨하게 | RED | RED |
| P4 — 아무것도 못 잡는 패턴 추가 | RED(패턴별 표본 단언) | RED |
| S1 — `log()` 뒤 DDL 한 문 | RED(카탈로그 스냅샷) | RED |

**리뷰 2라운드 뒤 보강** (`review/code/2026/09/19/17_25_09` testing WARNING 1 — 카탈로그 비교는 **탐지**뿐 **예방**이 아니다): `log()` 는
자기 커넥션을 써서 트랜잭션으로 감쌀 수 없다. 비교기 전용 `DataSource` 를 **읽기 전용 세션**(`extra.options: -c default_transaction_read_only=on`)
으로 연다 — 전제가 깨져 DDL 을 실행하려 하면 Postgres 가 거부한다. 카탈로그 비교는 두 번째 방어로 남긴다. 읽기 전용 세션에서도 6건 GREEN
(= `initialize()` · `log()` 가 쓰기를 하지 않는다는 실측).

| 뮤턴트 | 예측 | 실측 |
|---|---|---|
| RO1 — 읽기 전용 `DataSource` 에서 `build()`(DDL 실행) 먼저 호출 | RED + 카탈로그 불변 | RED(`cannot execute ALTER TABLE in a read-only transaction`) · 카탈로그 해시 · 제약 703 · 인덱스 182 그대로 |

## 착수 순서 기록

기준선(비교기 결과가 트래커의 아홉과 같은지)을 확인하느라 아홉 곳의 수정을 `--impl-prep` 보다 **먼저** 했다. 고치기 전 코드의 RED 는
뮤턴트(수정을 하나씩 되돌림)로 대신 보인다.

## 착수 전 검토 — (해소) 대기했던 것

- **1차 `--impl-prep spec/2-navigation/`** `review/consistency/2026/09/19/10_58_34` — **BLOCK: YES**. Critical 은 이 작업이 아니라 scope 안의
  기존 결함이다: `spec/2-navigation/4-integration.md` §5.4 가 `IntegrationTestResult.code` 를 소문자(`auth_failed` · `network` ·
  `unknown_error`)로 적어 `spec/conventions/error-codes.md` §1 UPPER_SNAKE_CASE 를 어긴다. 확인해 보니 더 컸다 — Database 를 포함한
  다섯 서비스(Google · GitHub · HTTP · Database · Webhook)의 연결 테스트가 **구현돼 있지 않다**(`dispatchTest` 의 transport tester 는
  mcp · email 뿐, entity tester 는 cafe24 · makeshop 뿐 → 나머지는 구조 검증만 하고 «Connection successful»).
- **사용자 결정(2026-09-19)**: «다섯 테스터를 구현». 먼저 planner spec PR 로 다섯 서비스의 테스트 동작 · 실패 코드(UPPER_SNAKE)를 정하고
  (이것이 위 Critical 도 해소한다), 그 PR 이 머지되면 이 브랜치를 rebase 해 `--impl-prep` 을 다시 돌린다. 지난 PR(#1354)처럼
  무관한 spec 정정을 이 브랜치에 섞지 않는다(`review/code/2026/09/19/09_16_00` scope WARNING 의 교훈).
- **해소(2026-09-19)** — 결정은 뒤에 «DB · HTTP 만 구현» 으로 좁혀졌고(Google · GitHub · Webhook 은 쓰는 노드가 없어 «구조 검증만» 으로
  사실대로 적음), 그 spec · 구현이 #1357 로 머지됐다(`plan/complete/spec-draft-integration-connection-tests.md` ·
  `plan/complete/integration-db-http-testers.md`). §5.4 는 UPPER_SNAKE `DB_*` 코드로 다시 쓰였다 — 위 Critical 이 사라졌다. 이 브랜치를
  `origin/main`(`0a040b96c`) 위로 rebase 하고 `--impl-prep` 을 다시 돌린다.
- WARNING 2(scope 에 `spec/1-data-model.md` 누락): scope 는 디렉터리여야 해 루트 파일을 줄 수 없다 — 두 세션 모두 `1-data-model.md` 를
  직접 Read 블록으로 붙였다. `--impl-done` 은 `spec/2-navigation/` · `spec/3-workflow-editor/` 둘 다 돌리고 같은 블록을 붙인다.

## 체크리스트

- [x] `--impl-prep spec/2-navigation/` — 1차 BLOCK: YES(위), #1357 머지 뒤 재실행 `review/consistency/2026/09/19/16_54_09` **BLOCK: NO**
      (Critical 0 · WARNING 1 · INFO 10). 번들이 예산 초과라 다섯 프롬프트에 «직접 읽을 것» 블록(`spec/1-data-model.md` · 브랜치 diff · plan)을
      덧붙여 돌렸다. WARNING 1(`entity-schema-` / `entity-column-` plan 이름이 한 단어 차이) → 커밋 · 트래커에 «인덱스 · 제약 층(#1354)» /
      «컬럼 층(이 작업)» 으로 층을 붙여 쓴다. INFO 6 · 7 → 위 가드 절 · 아래 `--impl-done` 항목. INFO 2(`spec/0-overview.md` Rationale 의
      Prisma 서술)는 이 작업과 무관 — 트래커
- [x] 가드 테스트 — GREEN · 뮤턴트(아홉 수정 각각 되돌림 + 예외 목록 둘) RED, 패턴 하중 쌍(R1 · R2) 예측대로 — 위 «가드 뮤턴트» 표
- [x] TEST WORKFLOW (lint · unit · build · e2e) + 백엔드 타입체크 ratchet — 커밋 `3c2b39305` 기준 lint · unit · build(ratchet 포함) PASS,
      e2e PASS(backend 354 — 새 컬럼 가드 포함 · Playwright 51). `default` 선언으로 insert 뒤 RETURNING 이 늘어나는 런타임 변화도 전체 e2e 로 확인
- [ ] `/ai-review`
- [ ] `--impl-done` — `spec/2-navigation/` · `spec/3-workflow-editor/` (각각 `spec/1-data-model.md` · 브랜치 diff 를 직접 Read 블록으로 첨부)
- [ ] 트래커 반영 · 이 plan `complete/` 이동
