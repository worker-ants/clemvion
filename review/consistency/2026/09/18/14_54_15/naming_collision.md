# 신규 식별자 충돌 검토 — spec-draft-graph-fk-indexes.md

## 검토 대상 신규 식별자

- 마이그레이션 버전: `V117` · `V118` · `V119` · `V120`
- 인덱스 이름: `idx_entity_last_seen_chunk_id` · `idx_relation_evidence_chunk_id` · `idx_relation_head_entity_id` · `idx_relation_tail_entity_id`
- Rationale 절 제목: «그래프 RAG 삭제 연쇄의 FK 인덱스 넷 (2026-09-18)»
- 트래커 문구 갱신: «32개 남음» → «28개 남음»
- 신규 spec 파일 없음(기존 4개 파일 본문 수정), 신규 엔티티/DTO/endpoint/webhook/env var 없음

## 발견사항

### 충돌 없음 확인 (검증 완료)

- **마이그레이션 버전 `V117~V120`** — `codebase/backend/migrations/` 최신 파일은 `V116__llm_usage_log_execution_id_index.sql`(HEAD 워크트리)이고 `origin/main` 최신 커밋(`6dbac1f53`, #1350)도 동일하게 V116 이 최댓값이다. `grep -rn "V117\|V118\|V119\|V120" codebase/ spec/ plan/` 은 target 자기 자신(`plan/in-progress/spec-draft-graph-fk-indexes.md`)만 히트하며, `origin/main` 트리에서도 `git grep V117 -- codebase/backend/migrations` 0건. 병렬 세션이 같은 버전 번호를 선점했을 가능성도 없다.
- **인덱스 이름 넷** — 전부 `codebase/`·`spec/`·`plan/` grep 0건(target 자신 제외). 기존 그래프 인덱스 명명 관례(`spec/data-flow/6-knowledge-base.md:258-260` 의 `idx_entity_kb_type` · `idx_entity_kb_mention` · V027 `(kb, head)`/`(kb, tail)`)와도, V111~V116 선례(`idx_trigger_workflow_id`, `idx_node_execution_node_id`, `idx_llm_usage_log_execution_id` 등)의 `idx_<table>_<컬럼>` 규약과도 형태가 일치해 새 이름이 기존 규약을 깨지 않는다.
- **엔티티/타입명·API endpoint·webhook/이벤트명·ENV/설정키** — target 은 기존 `Entity`·`Relation` 테이블에 인덱스만 추가할 뿐 새 엔티티·DTO·인터페이스·endpoint·이벤트·환경변수를 하나도 도입하지 않는다. 해당 없음.
- **파일 경로** — 신규 spec 파일 없음. plan 파일명 `spec-draft-graph-fk-indexes.md` 는 `find plan -iname "*fk-index*" -o -iname "*graph-fk*"` 결과 자기 자신만 나와 기존 `spec-draft-deletion-cascade-indexes.md`(완료, V112~V116) · `spec-draft-nullable-notation-followups.md`(트래커, V001~V111 계열 항목)와 겹치지 않고 동일 명명 계열(`spec-draft-*-indexes`)을 자연스럽게 잇는다.

### INFO — Rationale 절 제목의 근접 명명은 의도된 계열이나 목록에서 시각적으로 혼동 가능

- target 신규 식별자: `### 그래프 RAG 삭제 연쇄의 FK 인덱스 넷 (2026-09-18)` (S3, `spec/1-data-model.md` `## Rationale` 최상단에 삽입 예정)
- 기존 사용처: `spec/1-data-model.md:964` `### 삭제 연쇄의 FK 인덱스 다섯 (2026-09-18)`, 바로 아래 `spec/1-data-model.md:1013` `### Trigger \`(workflow_id)\` 인덱스 (2026-09-18)`
- 상세: 세 절 모두 같은 날짜(2026-09-18) 라벨을 달고 "삭제 연쇄의 FK 인덱스 {다섯/넷}" 형태를 공유한다. 의미 충돌은 아니다 — target 자신이 "바로 아래 «삭제 연쇄의 FK 인덱스 다섯» 절이 남긴 32개 중 이 넷을 닫았다"고 명시적으로 관계를 서술하므로 계열 구성원임이 분명하고, 두 절은 서로 다른 테이블(코어 실행 로그 계열 vs 그래프 RAG 계열)을 다룬다. 다만 목차나 grep 결과만 보는 독자에게는 "다섯"과 "넷"이라는 숫자 접미사만으로 구분해야 해 오독 여지가 있다.
- 제안: 차단 사유는 아니므로 그대로 진행 가능. 다만 향후 유사 절이 더 늘어나면(예: 다음 후보 "부모 삭제가 드문 큰 테이블 셋") 절 제목에 대상 테이블/도메인을 좀 더 명시(target 은 이미 "그래프 RAG" 접두어로 이를 하고 있어 현재로선 충분)하는 관례를 유지할 것을 권장.

## 요약

target 이 새로 도입하는 식별자(마이그레이션 버전 V117~V120, 인덱스 이름 넷, Rationale 절 제목)는 `codebase/`·`spec/`·`plan/` 전수 grep 과 `origin/main` HEAD(V116, #1350) 대조로 전부 미점유임을 확인했고, 명명 형태도 V111~V116·기존 그래프 인덱스 관례와 일치한다. 새 엔티티·API endpoint·이벤트명·환경변수·spec 파일 경로는 target 에 존재하지 않아 해당 관점의 충돌 표면 자체가 없다. 유일하게 짚을 점은 Rationale 절 제목의 "삭제 연쇄의 FK 인덱스 {다섯/넷}" 근접 명명인데, target 자신이 관계를 명시적으로 서술하고 있어 실질 혼선 위험은 낮다(INFO).

## 위험도

NONE
