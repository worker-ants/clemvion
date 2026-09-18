# 신규 식별자 충돌 검토 — naming_collision

## 전제 확인

- 검토 대상 scope(`spec/conventions/`) 의 `origin/main` 대비 델타는 **0개 파일**이다 — 본 브랜치는 `spec/conventions/` 를 전혀 건드리지 않았다. 델타 0 자체는 CRITICAL 근거가 아니다(코드 전용 PR).
- 실제 구현 diff(9개 파일 / 241줄, `git diff origin/main...HEAD --stat` 로 워킹트리에서 직접 재확인)는 다음으로 구성된다:
  - 신규 마이그레이션 `codebase/backend/migrations/V117__entity_last_seen_chunk_id_index.{sql,conf}` ~ `V120__relation_tail_entity_id_index.{sql,conf}` (인덱스 4개)
  - `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` 에 4개 `it.each` 케이스 추가
  - `spec/1-data-model.md` §3 · `## Rationale`, `spec/5-system/10-graph-rag.md` §2.3/§2.4, `spec/data-flow/6-knowledge-base.md` 표 갱신 — 이 세 파일은 `spec/conventions/` 밖이라 본 checker 의 배정 scope 밖이지만, 새 식별자가 여기서 도입되므로 대조 대상으로 실측했다.
- `spec/conventions/` 는 자체적으로 새 식별자를 도입하지 않으므로(델타 0), 본 리뷰의 실질 작업은 "이 PR 이 코드/타 spec 영역에 새로 붙인 식별자가 `spec/conventions/` 가 규정한 명명 규약·기존 등재 식별자와 충돌하는가" 이다.

## 대조 결과 (관점별)

### 1. 요구사항 ID 충돌 — 해당 없음
새 requirement/section ID 부여 없음. `1-data-model.md` 에 신설된 Rationale 절 제목 「그래프 RAG 삭제 연쇄의 FK 인덱스 넷 (2026-09-18)」은 기존 「삭제 연쇄의 FK 인덱스 다섯 (2026-09-18)」과 제목 문자열이 겹치지 않는다.

### 2. 엔티티/타입명 충돌 — 해당 없음
새 엔티티·DTO·인터페이스 정의 없음. `Entity`/`Relation` 은 기존 엔티티이며 인덱스만 추가됐다.

### 3. API endpoint 충돌 — 해당 없음
신규 endpoint 없음(DB 인덱스·테스트 변경뿐).

### 4. 이벤트/메시지명 충돌 — 해당 없음
webhook·queue·SSE 이벤트 신설 없음.

### 5. 환경변수·설정키 충돌 — 해당 없음
`V117~V120` 의 `.conf` 는 `executeInTransaction=false` 키를 쓰는데, 이는 V111~V116 등 선례가 동일하게 쓰는 기존 Flyway 설정 키이며 새 키가 아니다(`spec/conventions/migrations.md` §5 각주에 동일 패턴이 이미 규약화돼 있다).

### 6. 파일 경로 충돌 — 충돌 없음, 컨벤션 정합 확인
- **마이그레이션 파일 경로**: `V<번호>__<snake_case_descriptor>.{sql,conf}` — `spec/conventions/migrations.md` §1 명명 규약과 정확히 일치.
- **V번호 연속성/유일성**: 워킹트리 `codebase/backend/migrations/` 전수를 `V[0-9]+` 로 추출해 중복 검사 — V117~V120 은 중복 없음. `origin/main` 의 max 는 `V116`(커밋 `6dbac1f53`)이라 `V117`부터 gap 없이 연속 — `migrations.md` §2 "단조 증가·gap 금지·재사용 금지" 규약 충족.
- **인덱스 이름**: `idx_entity_last_seen_chunk_id` · `idx_relation_evidence_chunk_id` · `idx_relation_head_entity_id` · `idx_relation_tail_entity_id` 를 `git grep`(워킹트리 전체, 신규 파일·plan·review 산출물 제외)한 결과 기존 정의와 충돌 0건. `codebase/backend/migrations/V025__graph_rag.sql`(`idx_relation_kb_head`/`idx_relation_kb_tail`) · `V027__relation_head_tail_index.sql`(`idx_relation_kb_head_tail`) 등 기존 복합 인덱스와 **문자열이 다르다** — 완전 충돌 없음.
  - 단 `idx_relation_head_entity_id`(신규, 단일 컬럼) 와 `idx_relation_kb_head`(기존, 복합 `(knowledge_base_id, head_entity_id)`) 는 접두 `idx_relation_` + `head` 어간을 공유해 육안 스캔 시 혼동 여지가 있다. 다만 (a) 명명 패턴 자체가 `idx_<table>_<column>` vs `idx_<table>_kb_<column>` 로 구조적으로 갈리고, (b) `spec/1-data-model.md` §3·`spec/5-system/10-graph-rag.md` §2.4 양쪽 모두 "위 두 복합 인덱스는 KB 를 아는 검색용" 이라고 병기해 독자가 구분하도록 명시했으며, (c) 이 근접성은 2026-09-18 앞선 두 차례 consistency-check 라운드(`review/consistency/2026/09/18/14_54_15/naming_collision.md`, `15_04_02/naming_collision.md`)에서 이미 동일하게 식별·검토돼 WARNING 미만(비차단)으로 수렴한 사안이다 — 본 라운드 사이 `spec/conventions/`·해당 spec 파일·마이그레이션에 추가 변경이 없어 상태가 악화되지 않았다.

## 발견사항

없음 (CRITICAL/WARNING/INFO 신규 항목 없음). 위 §6 의 접두 근접성은 기록 목적으로만 남기며, 이미 두 차례 독립 라운드에서 비차단으로 판정된 사안의 재확인이다.

## 요약

본 PR 이 실제로 도입하는 신규 식별자(마이그레이션 버전 `V117`~`V120`, 인덱스 이름 4개)는 `spec/conventions/migrations.md` 의 명명·버전 규약(단조 증가·gap 금지·`V<번호>__<descriptor>` 패턴)을 그대로 따르고, 워킹트리 전수 grep 상 기존 인덱스·마이그레이션 식별자와 문자열이 겹치지 않는다. `spec/conventions/` 자체는 이번 변경으로 델타가 없어 새 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수를 도입하지 않았고, 대조 대상이 될 만한 유일한 근접 사례(`idx_relation_head_entity_id` vs 기존 `idx_relation_kb_head`)는 명명 구조·spec 서술로 명확히 구분되며 이미 앞선 두 라운드에서 비차단으로 검토가 끝난 항목이다. 신규 식별자 충돌 관점에서 이 PR 을 막을 사유는 없다.

## 위험도

NONE
