---
title: 워크플로 삭제·캔버스 노드 삭제의 FK 연쇄 인덱스 — 실행 이력 행마다 로그 테이블을 전부 훑는다
status: complete
owner: project-planner
worktree: usage-log-workflow-index-5b1e07
started: 2026-09-18
completed: 2026-09-18
spec_impact:
  - spec/1-data-model.md
  - spec/data-flow/3-execution.md
  - spec/data-flow/5-integration.md
  - spec/data-flow/7-llm-usage.md
---

# spec draft — 삭제 연쇄의 FK 인덱스 다섯

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 «`workflow`·`workspace` 를 참조하는 FK 중 선두 인덱스가
없는 여섯»(2026-09-18 등재, `plan/complete/spec-draft-trigger-workflow-index.md`) 중 **`integration_usage_log` 우선**으로 착수했다.
재 보니 **그 항목의 전제가 좁았다** — 등재한 여섯은 부모를 `workflow`·`workspace` 둘로 한정한 전수였고, 실제 비용은 그 밖의
FK(`node_execution` 을 가리키는 것)에 있었다. 등재 대상이던 `integration_usage_log.workflow_id` 는 삭제 한 번에 0.55 ms 다.

## 실측 (PostgreSQL 18, `pgvector/pgvector:pg18` 일회용 컨테이너, V001~V111 적용)

### 전수 — 부모를 한정하지 않는다

단일 컬럼 FK **87개** 중 `ON DELETE CASCADE`·`SET NULL`·`NO ACTION` 이면서 그 컬럼을 선두로 가진 인덱스가 없는 것이 **37개**다
(`pg_index.indkey[0]` 대조). 부모 행을 지울 때 Postgres 의 FK 트리거는 **지워지는 부모 행마다** 자식을 한 번씩 찾으므로, 인덱스
없는 FK 의 비용은 «자식 테이블 크기 × 연쇄로 지워지는 부모 행 수» 다.

### 어느 경로가 그 FK 를 부르나

| 삭제 경로 | 빈도 | 연쇄 |
|---|---|---|
| 캔버스 저장이 노드를 뺀다 (`WorkflowsService` 캔버스 저장 — 제출 목록에 없는 `Node` 를 `manager.remove`) | **캔버스 저장마다** | `node` → `node_execution`(CASCADE, `node_id`) → 지워지는 실행 이력 **행마다** `integration_usage_log`(CASCADE, `node_execution_id`) · `llm_usage_log`(SET NULL, `node_execution_id`) |
| 워크플로 삭제 | 관리 동작 | `workflow` → `node`·`execution`·`integration_usage_log`(`workflow_id`) … → 위 연쇄 + `execution` 행마다 `llm_usage_log`(SET NULL, `execution_id`) |

실행 이력 보존 정리는 **없다**(보존 배치는 `integration_usage_log` 의 90일 `at` 기준 하나 — `integration-expiry-scanner.service.ts`). 그래서
`node_execution` 은 위 두 경로로만 지워진다.

### 비용 (워크플로마다 노드 10 · 실행 20 · 실행당 노드 실행 10 · 연동 로그 20 · LLM 로그 40, 워밍 뒤 1회, ROLLBACK)

| 규모 (`node_execution` / 연동 로그 / LLM 로그) | 캔버스 노드 하나 삭제 | 워크플로 삭제 |
|---|---|---|
| 200k / 20k / 40k | **45.7 ms** | **444.7 ms** |
| 800k / 80k / 160k | **206.6 ms** | **2,225 ms** |
| 800k + 인덱스 넷 | **0.79 ms** | **6.96 ms** |

800k 에서 워크플로 삭제의 FK 별 시간(인덱스 전 → 후):

| FK | 호출 수 | 전 | 후 |
|---|---|---|---|
| `llm_usage_log.node_execution_id` (SET NULL) | 200 | 1,296.9 ms | 0.80 ms |
| `integration_usage_log.node_execution_id` (CASCADE) | 200 | 530.6 ms | 0.50 ms |
| `node_execution.node_id` (CASCADE) | 10 | 271.3 ms | 0.19 ms |
| `llm_usage_log.execution_id` (SET NULL) | 20 | 116.9 ms | 0.39 ms |
| `integration_usage_log.workflow_id` (CASCADE) | 1 | 2.56 ms | 0.028 ms (다섯째 인덱스) |

규모 4배에 비용 4.5~5배 — 테이블 크기에 선형이고 연쇄 행 수만큼 곱해진다.

### 쓰기 비용

`node_execution` 은 노드가 실행될 때마다 1행이 들어가는 가장 뜨거운 INSERT 경로다. 10만 행 INSERT 5회: `(node_id)` 인덱스 **있음
median 1,060 ms · 없음 975 ms** — 행당 약 0.85 µs(+8.7%). 노드 한 번 실행이 ms 단위라 무시할 만하다. `node_id` 는 바뀌지 않는 컬럼이라
상태 전이 UPDATE 의 HOT 갱신을 막지 않는다.

두 로그 테이블도 같은 절차로 쟀다(`--spec` WARNING 1 — 선행 Rationale 이 «따로 잰다» 고 예고했다). FK 컬럼을 전부 채워 부분 인덱스에도
모두 들어가는 최악 조건, 10만 행 INSERT 5회 median:

| 테이블 | 더하는 인덱스 | 없음 | 있음 | 행당 |
|---|---|---|---|---|
| `node_execution` | `(node_id)` | 975 ms | 1,060 ms | +0.85 µs (+8.7%) |
| `integration_usage_log` | `(node_execution_id)` · `(workflow_id)` | 1,080.7 ms | 1,188.6 ms | +1.08 µs (+10.0%) |
| `llm_usage_log` | 부분 `(node_execution_id)` · `(execution_id)` | 1,500.5 ms | 1,635.3 ms | +1.35 µs (+9.0%) |

두 로그 테이블은 외부 호출(연동 API · LLM, 수십~수백 ms) 한 번에 1행이라 행당 1 µs 대는 무시할 만하다. **측정 순서 한계**: «없음» 을 먼저,
«있음» 을 나중에 쟀다 — 캐시가 데워진 뒤라 오버헤드가 약간 과소평가됐을 수 있다.

크기(800k 규모): `node_execution(node_id)` 6.4 MB(테이블 89 MB) · `integration_usage_log(node_execution_id)` 2.5 MB ·
`integration_usage_log(workflow_id)` 0.6 MB · `llm_usage_log` 부분 인덱스 둘 각 3.9 MB(테이블 23 MB).

## 변경안

### S1. `spec/1-data-model.md` §3 인덱스 전략 — 다섯 행

- `NodeExecution | (node_id)` 행을 기존 NodeExecution 행들 뒤에:
  `| NodeExecution | (node_id) | FK `ON DELETE CASCADE` 의 자식 조회 — 캔버스 저장이 노드를 뺄 때(저장마다)와 워크플로 삭제. 기존 `(execution_id, node_id, started_at DESC)` 는 선두가 달라 쓰이지 않는다. CONCURRENTLY, V112 |`
- `IntegrationUsageLog` 두 행을 기존 두 행 뒤에:
  `| IntegrationUsageLog | (node_execution_id) | FK `ON DELETE CASCADE` — 실행 이력 행이 지워질 **때마다** 한 번씩 찾는다(캔버스 노드 삭제 · 워크플로 삭제). CONCURRENTLY, V113 |`
  `| IntegrationUsageLog | (workflow_id) | FK `ON DELETE CASCADE` — 워크플로 삭제. CONCURRENTLY, V114 |`
- `LlmUsageLog` 두 행을 기존 세 행 뒤에:
  `| LlmUsageLog | (node_execution_id) WHERE node_execution_id IS NOT NULL | FK `ON DELETE SET NULL` — 실행 이력 행이 지워질 때마다. partial 로 노드 밖 caller(NULL) 제외. CONCURRENTLY, V115 |`
  `| LlmUsageLog | (execution_id) WHERE execution_id IS NOT NULL | FK `ON DELETE SET NULL` — 실행 행이 지워질 때마다(워크플로 삭제). CONCURRENTLY, V116 |`

### S2. `spec/1-data-model.md` 본문 «인덱스» 줄

- §2.10.1 IntegrationUsageLog: `**인덱스**: \`(integration_id, at DESC)\` — 상세 페이지 최근 활동 조회용.` 뒤에
  ` \`(node_execution_id)\` · \`(workflow_id)\` — 부모 삭제의 FK CASCADE 용 (V113 · V114, §3).` 를 더한다.
- §2.24 LlmUsageLog: `(통계용 partial).` 뒤에 ` FK SET NULL 용 partial \`(node_execution_id)\` · \`(execution_id)\` (V115 · V116, §3).` 를 더한다.

### S3. `spec/1-data-model.md` `## Rationale` 맨 위 새 절 — «삭제 연쇄의 FK 인덱스 다섯 (2026-09-18)»

위 «실측» 의 전수 · 경로 표 · 비용 두 표 · 쓰기 비용 표(세 테이블 모두 실측)를 옮긴다. 선행 절이 «`integration_usage_log` 는 …
쓰기 비용과 맞바꾸는 판단이라 따로 잰다» 고 예고한 **그 검토가 이 절**임을 한 문장으로 잇는다. 그리고 **바로 아래 절(«Trigger `(workflow_id)` 인덱스»)의 «같은 클래스
전수» 가 부모를 둘로 한정했음**을 적는다 — 그 절의 문장은 그 범위에서 참이라 고치지 않고, 새 절이 넓힌 전수를 가리킨다.

### S4. data-flow 세 문서의 sink 표 «인덱스» 칸

- `spec/data-flow/3-execution.md` `node_execution` 노드 실행 시작 행: `… (활성 노드 조회/전이)` 뒤에 ` · V112 \`(node_id)\` (FK CASCADE — 캔버스 노드 삭제 · 워크플로 삭제)`.
- `spec/data-flow/5-integration.md` `integration_usage_log` 행: `V008 \`(integration_id, at DESC)\`.` 뒤에 ` V113 \`(node_execution_id)\` · V114 \`(workflow_id)\` (FK CASCADE).`.
- `spec/data-flow/7-llm-usage.md` `llm_usage_log` 행: `… 통계용` 뒤에 `. V115 \`(node_execution_id)\` · V116 \`(execution_id)\` partial (FK SET NULL)`.

## 구현 (같은 PR, developer 턴)

- **V112~V116** — 파일당 `CREATE INDEX CONCURRENTLY` 하나(README §5 «한 statement»), 각각 `.conf executeInTransaction=false`,
  **앞에 invalid 잔재 정리 `DROP INDEX CONCURRENTLY IF EXISTS <이름>`**(README §5 «신규 추가에도 0) 을 둡니다», V111 선례), 수동 롤백 주석.
  이름: `idx_node_execution_node_id` · `idx_integration_usage_log_node_execution_id` · `idx_integration_usage_log_workflow_id` ·
  `idx_llm_usage_log_node_execution_id` · `idx_llm_usage_log_execution_id` — `codebase/`·`spec/`·`plan/` grep 0건, `V112~V116` 도 0건.
- **증거** — 새 e2e `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts`: 다섯 인덱스 각각 실재 · `indisvalid` · 정의 대조
  (`pg_get_indexdef` 출력은 일회용 pg18 로 확인 — 부분 인덱스는 `… USING btree (node_execution_id) WHERE (node_execution_id IS NOT NULL)`).
- 애플리케이션 코드 변경 없음.

## 비대상

| 자리 | 판정 |
|---|---|
| 나머지 32개 FK | 이 PR 은 **경로**로 범위를 정했다 — 워크플로 삭제·캔버스 노드 삭제의 연쇄에서 측정으로 드러난 다섯. 나머지는 트래커 항목을 이 전수로 갈아 끼운다. 그중 **지식 베이스** 쪽(`document_chunk` 삭제 → `entity.last_seen_chunk_id`·`relation.evidence_chunk_id` SET NULL, `entity` 삭제 → `relation.head/tail_entity_id` CASCADE)은 문서 재색인 빈도에 따라 뜨거울 수 있어 다음 후보다. `user` 삭제 계열은 드물다 |
| `integration_oauth_state` 등 워크스페이스 CASCADE 넷 · `alert_rule.workflow_id` · `edge.target_node_id` | 소형 테이블 — 전수 목록에 남긴다. 뒤 둘은 이 PR 의 두 경로에 걸리지만 200k 측정에서 0.1 ms 미만이다 |
| 캔버스 저장이 노드를 지울 때 그 노드의 실행 이력까지 CASCADE 로 사라지는 것 | 데이터 보존 정책 질문이지 인덱스 문제가 아니다 — 이 draft 는 비용만 다룬다 |

## 트래커 반영

- «`workflow`·`workspace` 를 참조하는 FK 중 선두 인덱스가 없는 여섯» 을 **전제 정정**으로 갱신: 전수는 부모를 한정하지 않으면
  37개이고, 이 PR 이 다섯(V112~V116)을 닫는다. 나머지 32개는 목록 그대로 남기고 다음 후보(지식 베이스 연쇄)를 적는다.

## 체크리스트

- [x] `--spec` `review/consistency/2026/09/18/13_44_08` BLOCK: NO → S1~S4 반영 (WARNING 1 처방대로 로그 테이블 쓰기 비용 실측을 S3 에 포함)
- [x] `--impl-prep spec/conventions/` — `review/consistency/2026/09/18/13_55_55` **BLOCK: NO** (WARNING 1 번들 예산 절단 — 트래커 기존 항목
  «`--impl-prep`/`--spec` 번들이 `spec/` 코퍼스를 통째로 절단한다» 의 재발, checker 가 직접 Read 로 보완 · WARNING 2 · INFO 1·3 은 무관한 cafe24
  카탈로그 위생 → `plan/in-progress/cafe24-backlog-residual.md` 에 등재 · INFO 2 는 같은 plan 에 이미 있음 · INFO 4·5 조치 불요)
- [x] V112~V116 · e2e 스키마 단언 · `python3 scripts/check-migration-versions.py --base origin/main` OK(max V116) — 일회용 pg18 에 V001~V116 을
  적용해 다섯 인덱스가 `indisvalid = true` 로 생기고 정의가 e2e 정규식과 맞음을 먼저 확인
- [x] lint · unit · build(타입체크 ratchet — backend 197 · frontend 52, baseline 일치) · e2e backend **327**(직전 322 + 새 파일의
  `it.each` 다섯 — 인덱스가 유효하게 있어야만 통과하므로 Flyway 가 V112~V116 을 적용했다는 증거). e2e 정규식의 판별력은 오답 정의 넷
  (부분 조건 누락 · 부분 조건 붙음 · 선두 다름 · 복합)에 대해 node 로 확인했다
- [x] `/ai-review` — **정지 규칙(1라운드 결과를 보기 전에 적는다)**: Critical 0 이고 남은 Warning 이 동작 결함이 아니면서 `codebase/**`
  문서·주석(마이그레이션 헤더 포함)이면 developer SKILL «수렴 예외»(a)~(d)로 트래커 등재하고 2라운드를 돌지 않는다 — 단 `codebase/**` 를
  건드리지 않고 닫히는 Warning(spec · plan)은 고친다. Critical 이거나 동작 결함이면 고치고 다시 돈다
  → **1라운드 `review/code/2026/09/18/14_12_53` LOW · Critical 0 · Warning 0** (forced 8 전원 확보) — 2라운드 없음. INFO 12 처분:
  1 `plan/complete/` 선인용 → 마지막 커밋에서 draft 이동 · 2 헤더 수치 5중 복제 → 선례(Flyway 자기완결) · 3 정규식 앞 앵커 없음 → 인덱스 이름
  바인딩 + `indisvalid` 와 결합, 오답 정의 넷으로 판별력 확인 · 4 EXPLAIN 미검증 → 800k 실측이 대신 · 5 cafe24 등재 동반 → 발견 즉시 등재 관례 ·
  6 DROP-먼저 재실행 비용 → README §5 의 감수하는 비대칭 · 7 인덱스 누적 → 다음 추가 때 합산(이 PR 의 %는 표에 있다) · **8 800k 보다 큰 운영 규모의
  CONCURRENTLY 빌드 시간은 재지 않았다 → PR 설명에 적는다** · 9 e2e 쿼리 다섯 → 고정 N · 10 e2e 건수 미재현 → CI 가 재검증 · 11 e2e 파일 조직 →
  조치 불요 · 12 쓰기 비용 WARNING 해소 확인
- [x] `--impl-done spec/conventions/` — `review/consistency/2026/09/18/14_23_35` **BLOCK: NO** (Critical·Warning 0 · INFO 3 — 1 선인용은
  이 draft 이동으로 해소 · 2 캔버스 노드 삭제의 실행 이력 CASCADE 소실을 트래커에 제품 결정 항목으로 등재 · 3 번들 예산은 트래커 기존 항목)
- [x] 트래커 반영(«여섯» → «전수 37개 중 32개 남음» 전제 정정 · 보존 정책 항목 신설) · 이 draft `complete/` 이동 — spec Rationale ·
  마이그레이션 헤더 다섯 · e2e JSDoc 이 인용하는 `plan/complete/` 경로가 이 커밋에서 참이 된다

## Rationale

### 왜 범위를 트래커 항목보다 넓혔나 — 그리고 왜 다섯에서 멈추나

트래커 항목은 «`integration_usage_log.workflow_id` 우선» 이었는데, 재 보니 그 FK 는 삭제 한 번에 0.55 ms(200k 규모)였다. 같은 삭제의
444.7 ms 는 `node_execution` 을 가리키는 FK 가 **실행 이력 행마다** 한 번씩 로그 테이블을 훑는 데서 왔다. 등재 대상만 고치면 문제의
0.1% 를 고치고 «해소» 라 적게 된다. 반대로 37개 전부를 한 PR 에 넣으면 각 테이블의 쓰기 패턴을 따로 따지지 못한다. 그래서 **측정한
두 경로의 연쇄에 걸리는 것 전부**로 경계를 그었다 — 캔버스 노드 삭제와 워크플로 삭제에서 비용을 낸 FK 다섯이다. 두 경로의
나머지 FK 트리거는 200k 측정에서 각 0.5 ms 미만이었다(800k 인덱스 뒤 측정은 다섯 FK 만 따로 봤다). 그중 선두 인덱스가 **없는**
것은 `alert_rule.workflow_id`(워크플로 삭제, 0.095 ms) · `edge.target_node_id`(노드 삭제, 0.022 ms) 둘이다 — 둘 다 작은 테이블이라 비대상(위 표).

### 왜 `llm_usage_log` 두 인덱스만 partial 인가

두 컬럼은 nullable(노드 밖·실행 밖 LLM 호출은 NULL)이고, FK 트리거의 쿼리 `… WHERE $1 = node_execution_id` 는 `IS NOT NULL` 을 함의하므로
부분 인덱스를 쓸 수 있다 — 기존 `(workflow_id, created_at DESC) WHERE workflow_id IS NOT NULL` 과 같은 이유다. `integration_usage_log`
의 두 컬럼과 `node_execution.node_id` 는 NOT NULL 이라 부분 조건이 줄 것이 없다.

### `--spec` 처분 (`review/consistency/2026/09/18/13_44_08` — **BLOCK: NO**, Critical 0 · WARNING 1 · INFO 7)

- **WARNING 1** 로그 테이블 쓰기 비용이 추론이었다 — 선행 Rationale(«Trigger `(workflow_id)` 인덱스» 절)이 «따로 잰다» 고 예고한 것을
  추론으로 갈음하려 했다. **쟀다**(위 쓰기 비용 표 — `node_execution` 과 같은 절차). S3 가 그 표를 옮기고 선행 절의 예고와 잇는다.
- **INFO 3** 선행 절의 예고를 인용 → S3 에 반영. **INFO 4** 마이그레이션 번호 가드 → 체크리스트에 명시.
- **INFO 1·2·5·6·7** 조치 불요(비대상 표가 이미 다룸 · 앵커는 유일 · 명명 규칙 성문화는 범위 밖 · 트래커 존치 항목은 반영 때 확인 · 제목은 다름).

## 부록 — 선두 인덱스가 없는 FK 전수 37개 (카탈로그 출력, V001~V111 적용 DB)

단일 컬럼 FK 87개 중 그 컬럼을 선두로 가진 인덱스가 없는 것. 트래커 항목이 이 표를 SoT 로 가리킨다. «처분» 칸이 빈 것은 작은 테이블이거나
부모 삭제가 드물어 이번에 재지 않은 것이다. «처분» 칸은 뒤 PR 이 처분한 것까지 갱신한다(표 자체는 V111 시점 카탈로그 그대로 —
행을 지우지 않는다). **2026-09-18 전부 처분됐다** — 비대상의 라 · 마 · 바 는 `plan/complete/spec-draft-fk-remaining-dispositions.md` 의 «처분 기준».

**이 표의 셈은 부분 인덱스도 «있음» 으로 셌다**(`indkey[0]` 만 대조). FK 조회(`$1 = col`)가 쓸 수 없는 부분 인덱스만 가진 셋이 빠졌고,
아래 표 뒤에 따로 적는다(전수 40).

| 부모 | 자식.컬럼 | 삭제 동작 | 처분 |
|---|---|---|---|
| auth_config | `trigger.auth_config_id` | SET NULL | ✅ V126 (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| document_chunk | `entity.last_seen_chunk_id` | SET NULL | ✅ V117 (`plan/complete/spec-draft-graph-fk-indexes.md`) |
| document_chunk | `relation.evidence_chunk_id` | SET NULL | ✅ V118 (`plan/complete/spec-draft-graph-fk-indexes.md`) |
| entity | `relation.head_entity_id` | CASCADE | ✅ V119 (`plan/complete/spec-draft-graph-fk-indexes.md`) |
| entity | `relation.tail_entity_id` | CASCADE | ✅ V120 (`plan/complete/spec-draft-graph-fk-indexes.md`) |
| execution | `llm_usage_log.execution_id` | SET NULL | ✅ V116 |
| folder | `folder.parent_id` | CASCADE | ✅ V124 (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| folder | `workflow.folder_id` | SET NULL | ✅ V123 (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| integration | `integration_oauth_state.integration_id` | CASCADE | 비대상 — 마(10분 만료 일시 행) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| model_config | `knowledge_base.extraction_llm_config_id` | SET NULL | 비대상 — 바(설정 테이블 · 한 동작에 1회) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| model_config | `knowledge_base.embedding_model_config_id` | SET NULL | 비대상 — 바(설정 테이블 · 한 동작에 1회) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| model_config | `knowledge_base.rerank_config_id` | SET NULL | 비대상 — 바(설정 테이블 · 한 동작에 1회) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| model_config | `knowledge_base.rerank_llm_config_id` | SET NULL | 비대상 — 바(설정 테이블 · 한 동작에 1회) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| model_config | `llm_usage_log.llm_config_id` | SET NULL | ✅ V122 (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| model_config | `workflow_assistant_session.llm_config_id` | SET NULL | ✅ V125 (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| node | `edge.target_node_id` | CASCADE | ✅ V121 (앞의 «200k 에서 0.022 ms» 는 엣지 약 1만 행 측정이었다 — 엣지 90만이면 노드 하나에 28.8 ms) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| node | `node_execution.node_id` | CASCADE | ✅ V112 |
| node_execution | `integration_usage_log.node_execution_id` | CASCADE | ✅ V113 |
| node_execution | `llm_usage_log.node_execution_id` | SET NULL | ✅ V115 |
| user | `alert_rule.created_by` | SET NULL | 비대상 — 라(사용자 삭제 경로 없음) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| user | `audit_log.user_id` | NO ACTION | 비대상 — 라(사용자 삭제 경로 없음) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| user | `execution.executed_by` | NO ACTION | 비대상 — 라(사용자 삭제 경로 없음) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| user | `integration.created_by` | NO ACTION | 비대상 — 라(사용자 삭제 경로 없음) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| user | `integration_oauth_preview.user_id` | CASCADE | 비대상 — 라(사용자 삭제 경로 없음) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| user | `integration_oauth_state.user_id` | CASCADE | 비대상 — 라(사용자 삭제 경로 없음) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| user | `workflow.created_by` | NO ACTION | 비대상 — 라(사용자 삭제 경로 없음) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| user | `workflow_assistant_session.user_id` | CASCADE | 비대상 — 라(사용자 삭제 경로 없음) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| user | `workflow_version.created_by` | NO ACTION | 비대상 — 라(사용자 삭제 경로 없음) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| user | `workspace_invitation.invited_by` | SET NULL | 비대상 — 라(사용자 삭제 경로 없음) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| user | `workspace_invitation.accepted_by` | SET NULL | 비대상 — 라(사용자 삭제 경로 없음) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| user | `workspace_member.user_id` | CASCADE | ✅ V129 (FK 가 아니라 워크스페이스 목록 조회가 이유) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| workflow | `alert_rule.workflow_id` | CASCADE | 비대상 — 바(워크플로 1만 규모에서도 1.2~1.3 ms) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| workflow | `integration_usage_log.workflow_id` | CASCADE | ✅ V114 |
| workspace | `auth_config.workspace_id` | CASCADE | ✅ V127 (목록 조회가 이유) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| workspace | `integration_oauth_preview.workspace_id` | CASCADE | 비대상 — 마(10분 만료 일시 행) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| workspace | `integration_oauth_state.workspace_id` | CASCADE | 비대상 — 마(10분 만료 일시 행) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| workspace | `knowledge_base.workspace_id` | CASCADE | ✅ V128 (목록 조회가 이유) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |

셈법 보정으로 더한 셋(V001~V120 카탈로그, 선두 인덱스가 조건이 다른 부분 인덱스뿐):

| 부모 | 자식.컬럼 | 삭제 동작 | 선두 인덱스(부분) | 처분 |
|---|---|---|---|---|
| workspace | `model_config.workspace_id` | CASCADE | `(workspace_id, kind) WHERE is_default = true` | ✅ V130 `(workspace_id, kind)` — 목록 조회가 이유 (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| user | `workspace.owner_id` | CASCADE | `(owner_id) WHERE type = 'personal'` | 비대상 — 라(사용자 삭제 경로 없음) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
| user | `notification.user_id` | NO ACTION | `(user_id, is_read, created_at DESC) WHERE dismissed_at IS NULL` | 비대상 — 라(사용자 삭제 경로 없음) (`plan/complete/spec-draft-fk-remaining-dispositions.md`) |
