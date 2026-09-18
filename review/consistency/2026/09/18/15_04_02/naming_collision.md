# 신규 식별자 충돌 검토 — 그래프 RAG 삭제 연쇄 FK 인덱스 V117~V120 (--impl-prep)

## 검토 범위에 대한 메모

프롬프트의 "Target 문서" 절은 `spec/conventions/` 전체 덤프(대부분 컨텍스트 예산 초과로 절단)였으나, 프롬프트 말미의
"(main 추가) 착수할 작업과 scope 밖 spec — 직접 Read 하라" 지시에 따라 실제 검토 대상을 다음으로 특정해 직접 `Read`/`grep` 했다:

- `plan/in-progress/spec-draft-graph-fk-indexes.md` (`## 구현` 절 — developer 턴이 이번에 만들 것)
- `spec/1-data-model.md` §2.12.2·§2.12.3·§3·`## Rationale` 최상단(이미 커밋됨, `dfd4fd783`)
- `spec/5-system/10-graph-rag.md` §2.3·§2.4
- `spec/data-flow/6-knowledge-base.md` sink 표
- `codebase/backend/migrations/` 현재 상태 + `spec/conventions/migrations.md` + `codebase/backend/migrations/README.md`

## 검토 대상 신규 식별자

- 마이그레이션 버전: `V117` · `V118` · `V119` · `V120`
- 인덱스 이름: `idx_entity_last_seen_chunk_id` · `idx_relation_evidence_chunk_id` · `idx_relation_head_entity_id` · `idx_relation_tail_entity_id`
- (파생) 마이그레이션 파일 descriptor: 기존 명명 관례(`V<N>__<table>_<column>_index.sql`, 예 V116 `llm_usage_log_execution_id_index`)를 따르면 `entity_last_seen_chunk_id_index` / `relation_evidence_chunk_id_index` / `relation_head_entity_id_index` / `relation_tail_entity_id_index` 가 된다 — plan 은 정확한 파일명을 아직 명시하지 않았지만 이 형태로도 기존 파일과 겹치지 않음을 확인
- 신규 엔티티/DTO/endpoint/webhook/이벤트/ENV var 없음 (기존 `entity`/`relation` 테이블에 인덱스만 추가)
- 신규 spec 파일 없음 (기존 3개 spec 문서 본문 수정 — 이미 커밋됨)

## 발견사항

### 충돌 없음 확인 (검증 완료)

- **마이그레이션 버전 `V117~V120`** — 현재 워크트리 `codebase/backend/migrations/` 최댓값은 `V116__llm_usage_log_execution_id_index.sql`. `git fetch origin main` 후 `origin/main` HEAD(`6dbac1f53`, #1350)의 `codebase/backend/migrations/` 트리도 동일하게 V116 이 최댓값 — 병렬 세션이 V117 이상을 선점한 사실 없음. `grep -rn "V117\|V118\|V119\|V120" codebase/ spec/ plan/`(review 산출물 제외) 결과는 이미 반영된 spec 3개 파일 + plan draft 자기 자신에서만 나오고, 다른 마이그레이션 파일·다른 plan 트래커에는 등장하지 않는다.
- **인덱스 이름 넷** — `grep -rn` 전수 검색(review 산출물 제외) 결과 위 spec 3개 파일과 plan draft 를 빼면 0건. `V025__graph_rag.sql`(entity/relation 테이블·기존 인덱스 정의) · `V027__relation_head_tail_index.sql` · `V028__pg_trgm_indexes.sql` 을 직접 열어 기존 인덱스 이름 전체(`idx_entity_kb_type`, `idx_entity_kb_mention`, `idx_entity_name_trgm`, `idx_entity_display_name_trgm`, `idx_relation_kb_head`, `idx_relation_kb_tail`, `idx_relation_kb_head_tail`, `idx_relation_predicate_trgm`, `idx_chunk_entity_entity`)을 대조했으며 신규 넷과 문자열 일치 없음.
  - `idx_relation_head_entity_id`(신규, 단일 컬럼 `head_entity_id`) 와 `idx_relation_kb_head`(기존, 복합 `(knowledge_base_id, head_entity_id)`)는 이름이 유사하지만 **의미상 명확히 구분된다** — plan 의 Rationale 이 "복합 인덱스는 KB 를 아는 검색·skip scan 용, 단일 컬럼은 FK CASCADE 트리거의 KB-무관 조회용"이라고 명시적으로 관계를 서술하고, 두 spec 문서(`1-data-model.md` §3, `10-graph-rag.md` §2.4)도 "위 두 복합 인덱스는 KB 를 아는 검색용이다"라고 병기해 독자가 혼동하지 않도록 되어 있다. 명명 형태(`idx_<table>_<column>` vs `idx_<table>_kb_<column>`)도 겹치지 않으므로 CRITICAL/WARNING 대상 아님.
  - E2E 가드 `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` 의 `EXPECTED` 배열 기존 5건(`idx_node_execution_node_id` 등)과도 문자열 겹침 없음.
- **엔티티/타입명·API endpoint·webhook/이벤트명·ENV/설정키** — 이번 변경은 기존 `Entity`(`GraphEntity`)·`Relation`(`GraphRelation`) 테이블에 인덱스만 추가하며, `## 비대상` 절도 "애플리케이션 코드 변경 없음"을 명시한다. 새 엔티티·DTO·인터페이스·endpoint·이벤트·환경변수가 target 어디에도 없어 이 세 관점은 충돌 표면 자체가 없다.
- **파일 경로** — 신규 spec 파일 없음. plan 파일명 `spec-draft-graph-fk-indexes.md` 는 기존 `plan/complete/spec-draft-deletion-cascade-indexes.md`(V112~V116, 완료) · `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커)와 이름이 겹치지 않고 `spec-draft-*-indexes` 계열을 자연스럽게 잇는다.
- **마이그레이션 명명 규약 정합성** — `spec/conventions/migrations.md` §1(단조 증가 번호·snake_case descriptor)·§5(신규 마이그레이션 절차)와 `codebase/backend/migrations/README.md` §4·§5(`.conf executeInTransaction=false` 페어링, 파일당 `CREATE INDEX CONCURRENTLY` 정확히 1개, 신규 추가에도 `DROP INDEX CONCURRENTLY IF EXISTS` 로 무효 잔재 정리)를 plan 의 "구현" 절이 그대로 인용하고 있으며, V111~V116 선례와 동일 패턴이다. V117~V120 는 base(origin/main V116)+1~4 로 연속이라 §2 "단조 증가·gap 금지" 위반 없음.

### INFO — Rationale 절 제목의 근접 명명(이미 커밋된 상태, 이전 라운드에서 지적·수용됨)

- 신규 식별자: `### 그래프 RAG 삭제 연쇄의 FK 인덱스 넷 (2026-09-18)` — `spec/1-data-model.md:968`
- 기존 사용처: `spec/1-data-model.md:1004` `### 삭제 연쇄의 FK 인덱스 다섯 (2026-09-18)`, `spec/1-data-model.md:1054` `### Trigger \`(workflow_id)\` 인덱스 (2026-09-18)`
- 상세: 세 절 모두 같은 날짜 라벨과 "삭제 연쇄의 FK 인덱스 {다섯/넷}" 형태를 공유한다. 실제 커밋(`dfd4fd783`)을 확인한 결과 이미 이 순서·제목 그대로 반영돼 있다. 의미 충돌은 아니다 — 새 절 본문이 "바로 아래 «삭제 연쇄의 FK 인덱스 다섯» 절이 남긴 32개 중 이 넷을 닫았다"고 관계를 명시하고, 두 절은 서로 다른 테이블 계열(그래프 RAG vs 코어 실행 로그)을 다룬다. 이 항목은 직전 라운드(`review/consistency/2026/09/18/14_54_15/naming_collision.md`)에서 이미 INFO 로 제기됐고 plan 체크리스트에 "S1~S5 반영"으로 수용된 채 그대로 남아 있다 — 이번 라운드(--impl-prep, 마이그레이션 구현 착수 전)에서 새로 발견된 문제는 아니며 실질 차단 사유가 아니다.
- 제안: 그대로 진행 가능. 향후 유사 절이 늘어나면 대상 테이블/도메인 접두어를 유지하는 관례를 계속 적용할 것.

## 요약

이번 라운드가 실제로 새로 도입하는 식별자(마이그레이션 버전 V117~V120, 인덱스 이름 넷)는 워크트리·`origin/main` HEAD(V116, #1350) 양쪽 전수 grep 으로 미점유임을 재확인했고, 명명 형태도 V111~V116 선례·`migrations.md`/`README.md` 규약과 일치한다. `idx_relation_head_entity_id`가 기존 `idx_relation_kb_head`와 접두 유사성을 갖지만 컬럼 구성·용도·spec 서술이 명확히 갈려 실질 혼동 위험은 낮다. 새 엔티티·API endpoint·이벤트명·환경변수·spec 파일 경로는 이번 변경에 존재하지 않아 해당 관점의 충돌 표면이 없다. 유일한 기록 사항인 Rationale 절 제목 근접 명명은 이미 이전 라운드에서 검토·수용되어 커밋에 반영된 상태이며 이번 라운드에서 상태가 악화되지 않았다.

## 위험도

NONE
