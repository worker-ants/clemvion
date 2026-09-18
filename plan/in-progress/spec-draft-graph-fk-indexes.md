---
title: 그래프 RAG 삭제 연쇄의 FK 인덱스 넷 — KB 하나 삭제가 130초 걸렸다
status: in-progress
owner: project-planner
worktree: kb-fk-cascade-index-9e4c21
started: 2026-09-18
spec_impact:
  - spec/1-data-model.md
  - spec/5-system/10-graph-rag.md
  - spec/data-flow/6-knowledge-base.md
---

# spec draft — 그래프 RAG 삭제 연쇄의 FK 인덱스 넷

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 «선두 인덱스가 없는 FK — 부모를 한정하지 않은 전수 37개 중
32개 남음»(2026-09-18, `plan/complete/spec-draft-deletion-cascade-indexes.md`)이 **다음 후보**로 적은 지식 베이스 연쇄를 닫는다.
트래커는 «문서 재색인 빈도에 따라 뜨거울 수 있다» 고 예측만 했다 — 재 보니 가장 무거운 경로는 재색인이 아니라 **KB 삭제**였다.

## 실측 (PostgreSQL 18, `pgvector/pgvector:pg18` 일회용 컨테이너, V001~V116 적용)

### 누가 청크·엔티티를 지우나 (grep)

| 경로 | 코드 | 연쇄 |
|---|---|---|
| 재임베딩 (수동 재실행 · 2차 이상 재시도) | `embedding.service.ts` — `chunkRepository.delete({ documentId })` | 문서의 청크 전부 → 청크 **하나마다** `entity.last_seen_chunk_id` · `relation.evidence_chunk_id` (SET NULL) |
| 문서 삭제 | `document` → `document_chunk` FK CASCADE | 위와 같음 |
| 엔티티 하나 삭제 (관리 API) | `graph-query.service.ts` — `entityRepository.remove` | `relation.head_entity_id` · `relation.tail_entity_id` (CASCADE) |
| KB 삭제 | `knowledge_base` → `document`·`document_chunk`·`entity`·`relation` FK CASCADE | 청크 **전부**에 대해 위 첫째 연쇄 + 엔티티 **전부**에 대해 셋째 연쇄 |

그래프 추출(`graph-extraction.service.ts`)이 `entity`·`relation` 에 실제로 쓴다 — 그래프 모드 KB 에서 이 두 테이블은 청크에 비례해 커진다.

### 선두 인덱스 현황

`entity` · `relation` 의 인덱스는 전부 `knowledge_base_id` 가 선두다(`(kb, type)` · `(kb, mention_count DESC)` · `(kb, name, type) UNIQUE` ·
`(kb, head)` · `(kb, tail)` · `(kb, head, tail)` · `(kb, head, predicate, tail) UNIQUE`). FK 트리거의 조회는 `WHERE last_seen_chunk_id = $1`
처럼 KB 를 모르므로, `last_seen_chunk_id` · `evidence_chunk_id` 는 전 테이블을 훑고, `head_entity_id` · `tail_entity_id` 는 PG18 의 **skip
scan** 으로 `(kb, head)` 를 KB 값마다 건너뛰며 쓴다 — 그래서 후자는 싸지만 **KB 수에 비례**한다(아래 표 B).

### 비용 (KB 마다 문서 50 × 청크 40 = 청크 2,000 · 엔티티 1,000 · 관계 2,000 · 청크-엔티티 연결 청크당 2, 워밍 뒤 1회, ROLLBACK)

| 규모 (청크 / 엔티티 / 관계) | A 재임베딩(문서 하나, 청크 40) | B 엔티티 하나 삭제 | C KB 하나 삭제 |
|---|---|---|---|
| 200k / 100k / 200k (KB 100) | 434.4 ms | 1.47 ms | **20,841 ms** |
| 800k / 400k / 800k (KB 400) | 1,795.7 ms | 4.25 ms | **129,941 ms** |
| 800k + 청크 쪽 둘(`last_seen` · `evidence`) | **2.37 ms** | — | 1,238.5 ms |
| 800k + 넷 모두 | — | **0.38 ms** | **48.1 ms** |

800k 에서 KB 삭제의 FK 별: `relation.evidence_chunk_id` 76,220 ms(2,000회) · `entity.last_seen_chunk_id` 52,323 ms(2,000회) ·
`relation.head_entity_id` 611.8 ms(1,000회) · `relation.tail_entity_id` 606.4 ms(1,000회). 청크 쪽 둘을 더하면 앞의 둘이 각 6~7 ms 가 되고
`head`·`tail` 이 각 600 ms 로 남는다 — 넷을 다 더하면 각 4~10 ms.

B 의 `head`·`tail` 은 호출당 0.74 ms(KB 100) → 2.1 ms(KB 400)로 KB 수에 따라 늘었다 — skip scan 이 KB 값 수만큼 건너뛰기 때문이다.

**skip scan 은 추론이 아니라 계획으로 확인했다** — FK 트리거와 같은 모양의 조회(`DELETE FROM ONLY relation WHERE $1 = head_entity_id`)가
KB 100 규모에서 `Index Scan using idx_relation_kb_head` · `Index Cond: (head_entity_id = …)` · **`Index Searches: 101`**(KB 값 100 + 1)로 나왔다.
spec 에 메커니즘을 적기 전에 호출당 비용만 보고 추론했던 것을 계획으로 확인한 것이다.

### 쓰기 비용 (10만 행 INSERT 5회 median, FK 컬럼을 전부 채운 최악)

| 테이블 | 더하는 인덱스 | 없음 | 있음 | 행당 |
|---|---|---|---|---|
| `entity` | 부분 `(last_seen_chunk_id)` | 1,438.8 ms | 1,467.9 ms | +0.29 µs (+2.0% — 잡음 수준) |
| `relation` | 부분 `(evidence_chunk_id)` · `(head_entity_id)` · `(tail_entity_id)` | 1,879.3 ms | 2,084.0 ms | +2.05 µs (+10.9%) |

이번에는 «있음» 을 먼저 쟀다(지난 PR 과 반대) — 캐시 효과가 오버헤드를 **과대** 평가하는 방향이다. 그래프 추출은 청크마다 LLM 호출
(수백 ms~초)을 한 뒤 엔티티·관계를 쓰므로 행당 µs 대는 무시할 만하다. `relation` 은 이미 btree 다섯 · gin 하나가 있어 상대 비용이 작다.

크기(800k 규모): `entity(last_seen_chunk_id)` 12 MB(테이블 48 MB) · `relation(evidence_chunk_id)` 24 MB · `relation(head_entity_id)` ·
`relation(tail_entity_id)` 각 19 MB(테이블 108 MB).

## 변경안

### S1. `spec/1-data-model.md` 본문 «인덱스» 줄

- §2.12.2 Entity: `**인덱스**: \`(knowledge_base_id, type)\`, \`(knowledge_base_id, mention_count DESC)\`` 뒤에
  `, \`(last_seen_chunk_id) WHERE last_seen_chunk_id IS NOT NULL\` — 청크 삭제의 FK SET NULL 용 (V117, §3)` 을 더한다.
- §2.12.3 Relation: `**인덱스**: \`(knowledge_base_id, head_entity_id)\`, \`(knowledge_base_id, tail_entity_id)\`` 뒤에
  `, \`(evidence_chunk_id) WHERE evidence_chunk_id IS NOT NULL\` · \`(head_entity_id)\` · \`(tail_entity_id)\` — 청크·엔티티 삭제의 FK 용 (V118~V120, §3)` 을 더한다.

### S2. `spec/1-data-model.md` §3 인덱스 전략 — `LlmUsageLog | (execution_id)` 행 뒤에 네 행

- `| Entity | (last_seen_chunk_id) WHERE last_seen_chunk_id IS NOT NULL | FK `ON DELETE SET NULL` — 청크가 지워질 **때마다** 한 번씩 찾는다(재임베딩 · 문서 삭제 · KB 삭제). 다른 인덱스는 전부 `knowledge_base_id` 선두라 쓰이지 않는다. CONCURRENTLY, V117 |`
- `| Relation | (evidence_chunk_id) WHERE evidence_chunk_id IS NOT NULL | FK `ON DELETE SET NULL` — 위와 같다. CONCURRENTLY, V118 |`
- `| Relation | (head_entity_id) | FK `ON DELETE CASCADE` — 엔티티가 지워질 때마다(엔티티 삭제 · KB 삭제). `(knowledge_base_id, head_entity_id)` 는 PG18 skip scan 으로 쓰이지만 KB 수에 비례한다. CONCURRENTLY, V119 |`
- `| Relation | (tail_entity_id) | 위와 같다(tail). CONCURRENTLY, V120 |`

### S3. `spec/1-data-model.md` `## Rationale` 맨 위 새 절 — «그래프 RAG 삭제 연쇄의 FK 인덱스 넷 (2026-09-18)»

위 «실측» 의 경로 표 · 비용 표 · 쓰기 비용 표를 옮긴다. 바로 아래 «삭제 연쇄의 FK 인덱스 다섯» 절이 남긴 32개 중 **이 넷을 닫았다**는 것과,
그 절(트래커)이 «재색인 빈도에 따라 뜨거울 수 있다» 고 예측했지만 실제로 가장 무거운 것은 KB 삭제였다는 것을 적는다. `head`·`tail` 은 기존
복합 인덱스가 skip scan 으로 쓰이므로 «인덱스가 없어 전 테이블을 훑는다» 가 아니라 «KB 수에 비례한다» 가 근거임을 구분해 적는다.

### S4. `spec/5-system/10-graph-rag.md` §2.3 · §2.4 «인덱스» 목록

- §2.3 Entity: `- (last_seen_chunk_id) WHERE last_seen_chunk_id IS NOT NULL — 청크 삭제의 FK SET NULL (V117, [데이터 모델 §3](../1-data-model.md#3-인덱스-전략))` 를 더한다.
- §2.4 Relation: `- (evidence_chunk_id) WHERE evidence_chunk_id IS NOT NULL — 청크 삭제의 FK SET NULL (V118)` ·
  `- (head_entity_id) · (tail_entity_id) — 엔티티 삭제의 FK CASCADE (V119 · V120). 위 두 복합 인덱스는 KB 를 아는 검색용이다` 를 더한다.

### S5. `spec/data-flow/6-knowledge-base.md` sink 표

- `entity` 행 인덱스 칸 끝에 `, V117 \`(last_seen_chunk_id)\` partial (FK SET NULL — 청크 삭제)`.
- `relation` 행 인덱스 칸 끝에 `. V118 \`(evidence_chunk_id)\` partial · V119 \`(head_entity_id)\` · V120 \`(tail_entity_id)\` (FK — 청크·엔티티 삭제)`.

## 구현 (같은 PR, developer 턴)

- **V117~V120** — 파일당 `DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS` + `.conf executeInTransaction=false`
  (README §5 «신규 추가에도 0) 을 둡니다», 선례 V111~V116). 이름: `idx_entity_last_seen_chunk_id` · `idx_relation_evidence_chunk_id` ·
  `idx_relation_head_entity_id` · `idx_relation_tail_entity_id` — `codebase/`·`spec/`·`plan/` grep 0건, `V117~V120` 도 0건.
- **증거** — `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts`(V112~V116 선례)의 `EXPECTED` 에 네 건을 더한다(실재 · `indisvalid` ·
  정의 대조). 파일 머리말을 «두 PR 의 인덱스» 로 넓힌다.
- 애플리케이션 코드 변경 없음.

## 비대상

| 자리 | 판정 |
|---|---|
| `chunk_entity` | `(chunk_id, entity_id)` PK · `(entity_id)` 인덱스가 둘 다 선두라 FK 가 쓴다 — KB 삭제에서 161.6 ms(2,000회)·12.8 ms(1,000회)로 선형 스캔이 아니다 |
| 나머지 28개 FK | 트래커 항목(전수 표는 `plan/complete/spec-draft-deletion-cascade-indexes.md` 부록)에 남긴다 — 큰 테이블을 훑지만 부모 삭제가 드문 것(`model_config` → `llm_usage_log.llm_config_id`, `user` → `audit_log.user_id` · `execution.executed_by`)과 작은 테이블 |

## 트래커 반영

- «선두 인덱스가 없는 FK — … 32개 남음» → «28개 남음». 지식 베이스 연쇄 넷 해소 표시(V117~V120), 다음 후보를 «부모 삭제가 드문 큰 테이블
  셋» 으로 바꾼다(재지 않으면 우선순위가 없다고 적는다).

## 체크리스트

- [x] `--spec` `review/consistency/2026/09/18/14_54_15` BLOCK: NO → S1~S5 반영 (+ WARNING 1: 아래 «다섯» 절의 «32개 남음 · 다음 후보» 에 현재 상태를 덧붙였다)
- [ ] `--impl-prep`
- [ ] V117~V120 · e2e 네 건 · `python3 scripts/check-migration-versions.py --base origin/main`
- [ ] lint · unit · build · e2e
- [ ] `/ai-review`
- [ ] `--impl-done`
- [ ] 트래커 반영 · 이 draft `complete/` 이동(이 PR 의 마지막 커밋 — spec Rationale · 마이그레이션 헤더가 `plan/complete/` 로 인용한다)

## Rationale

### 왜 `head`·`tail` 도 넣나 — 기존 복합 인덱스가 쓰이는데

엔티티 하나 삭제에서 `head`·`tail` 은 각 0.7~2.1 ms 로 싸 보인다. 그러나 PG18 skip scan 은 `(knowledge_base_id, head_entity_id)` 를 **KB 값마다**
건너뛰므로 비용이 KB 수에 비례하고(100 → 400 개에서 2.8배), KB 삭제는 엔티티 **전부**에 대해 부르므로 1,000 엔티티 KB 에서 각 600 ms 가 된다.
청크 쪽 둘만 더하면 KB 삭제가 1.24 초로 남는데 그중 1.2 초가 이 둘이다. 쓰기 비용은 `relation` 세 인덱스 합쳐 행당 2 µs 다.

### 왜 `last_seen_chunk_id` · `evidence_chunk_id` 만 partial 인가

두 컬럼은 nullable(근거 청크를 모르는 엔티티·관계)이고 FK 트리거의 등치 조회는 `IS NOT NULL` 을 함의한다 — V115·V116 과 같은 이유.
`head_entity_id` · `tail_entity_id` 는 NOT NULL 이다.

### `--spec` 처분 (`review/consistency/2026/09/18/14_54_15` — **BLOCK: NO**, Critical 0 · WARNING 1 · INFO 3)

- **WARNING 1** 새 절이 바로 아래 «삭제 연쇄의 FK 인덱스 다섯» 절의 «나머지 32개 FK … 지식 베이스 연쇄가 다음 후보» 를 거짓으로 만든다 →
  그 문장을 지우지 않고 **현재 상태를 덧붙였다**(«같은 날 위 … 절이 그 넷을 닫아 28개가 남았다»). 그 절 자신이 «선행 절의 문장은 그 범위에서
  참이라 고치지 않는다» 는 방식을 쓰는데, 이 문장은 범위가 아니라 **상태**(남은 개수·다음 후보)를 말하므로 갱신이 맞다.
- **INFO 1** `head`·`tail` 이 아래 절 공식의 반례로 읽힐 수 있다 → 새 절에 «그 공식의 전제 밖이다 — skip scan 으로 KB 수에 비례» 를 명시했다.
- **INFO 2·3** 조치 불요(draft 안 코드 스팬 표기 · 절 제목은 «그래프 RAG» 접두로 구분).
