# Plan 정합성 검토 — `spec/conventions/` (--impl-prep, kb-fk-cascade-index)

## 발견사항

- **[INFO]** `spec/1-data-model.md` Rationale 이 아직 `plan/in-progress/`에 있는 draft 를 `plan/complete/` 경로로 선인용
  - target 위치: `spec/1-data-model.md` §Rationale "그래프 RAG 삭제 연쇄의 FK 인덱스 넷 (2026-09-18)" 말미 (1001~1002행) — `> 출처: 트래커 ... 실측 절차는 \`plan/complete/spec-draft-graph-fk-indexes.md\`, 구현은 V117~V120.`
  - 관련 plan: `plan/in-progress/spec-draft-graph-fk-indexes.md` (아직 `in-progress/`에 있음, `complete/`로 이동되지 않음)
  - 상세: 이미 커밋된(`dfd4fd783`) spec 문서가 `plan/complete/spec-draft-graph-fk-indexes.md` 를 인용하지만, 실제로는 `plan/in-progress/spec-draft-graph-fk-indexes.md` 로만 존재한다 — 해당 plan 의 체크리스트 마지막 항목("이 draft `complete/` 이동")이 아직 미완료이기 때문이다. 다만 이는 오탐이 아니라 **plan 자신이 의도적으로 예고한 선인용**이다 — 체크리스트에 "spec Rationale · 마이그레이션 헤더가 `plan/complete/` 로 인용한다"고 명시돼 있어, 같은 PR 의 마지막 커밋에서 draft 를 이동시키면 참조가 맞아떨어지도록 설계됐다. 위험은 이 PR 이 중간에 쪼개지거나(예: V117~V120 구현이 별도 PR로 지연) 마지막 이동 커밋이 누락될 경우 이 참조가 영구히 깨진 채 남는다는 점이다. 직전 선례 절("삭제 연쇄의 FK 인덱스 다섯", 1051~1052행)은 실제로 `plan/complete/`로 이동이 완료된 뒤의 상태를 인용해 정합하다 — 이번 절만 아직 미완료 상태에서 완료 후 경로를 미리 적은 차이가 있다.
  - 제안: 별도 조치 불요 — plan 체크리스트의 잔여 항목(V117~V120 구현 → e2e → 리뷰 → `--impl-done` → 트래커 반영 → `complete/` 이동)이 같은 PR 안에서 끝까지 수행되면 자동으로 해소된다. 다만 구현이 여러 PR로 쪼개질 가능성이 생기면 그 시점에 이 인용을 `in-progress/`로 되돌리는 정정이 필요하다.

## 점검했으나 문제 없음 (참고)

- **V번호 충돌 없음**: `codebase/backend/migrations/` 현재 max 는 V116 — plan 이 요구하는 V117~V120 은 `spec/conventions/migrations.md` §2 단조 증가·gap 금지 규칙과 정합하고, `plan/`·`codebase/backend/migrations/` 전수 grep 에서 V117~V120 을 선점한 다른 항목은 없다.
- **트래커 산술 일치**: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "선두 인덱스가 없는 FK … 32개 남음" 항목의 "다음 후보 — 지식 베이스 연쇄" 4건(`entity.last_seen_chunk_id`·`relation.evidence_chunk_id`·`relation.head_entity_id`·`relation.tail_entity_id`)이 target plan 이 닫으려는 항목과 정확히 일치하고, target plan 의 "트래커 반영" 절이 "32개 → 28개"로 갱신을 예고한 것도 산술이 맞는다. 트래커 항목 자체는 아직 "32개 남음"으로 미갱신 상태이나, 이는 plan 체크리스트상 구현 완료 후 처리될 후속 단계로 이미 추적되어 있어 문제가 아니다.
- **인접 미해결 결정과 충돌 없음**: 같은 트래커의 바로 위 항목("캔버스 저장이 노드를 빼면 실행 이력이 사라진다 — 보존 정책 결정 필요")은 `node_execution`/`node_id` 도메인의 별개 미해결 결정이며, target plan 의 entity/relation FK 인덱스 추가와는 스키마·정책 양쪽 모두 겹치지 않는다. `spec/5-system/10-graph-rag.md`·`spec/data-flow/6-knowledge-base.md` 에도 이 변경과 충돌할 만한 미해결(TODO/미정) 마커가 없다.
- **다른 in-progress plan 과의 스키마 충돌 없음**: `last_seen_chunk_id`·`evidence_chunk_id`·`head_entity_id`·`tail_entity_id`·`document_chunk` 등 target 이 건드리는 구체 컬럼/테이블명을 전수 grep 했을 때 `spec-draft-graph-fk-indexes.md` 와 그 트래커(`spec-draft-nullable-notation-followups.md`) 외에는 참조하는 in-progress plan 이 없다 (`rag-quality-improvement.md` 는 entity 추출 재활용을 다루지만 FK/인덱스 스키마와는 무관한 검색 알고리즘 층위).
- **증거 파일 존재 확인**: plan 이 확장 대상으로 지목한 `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` 는 실제로 존재해 참조가 유효하다.

## 요약

`spec/conventions/`(특히 `migrations.md` 의 V번호·명명 규약)와 target plan(`plan/in-progress/spec-draft-graph-fk-indexes.md`, V117~V120 구현 착수 직전 --impl-prep)은 정합하다. V번호 충돌 없음, 선행 트래커(`spec-draft-nullable-notation-followups.md`)와의 항목·산술 일치, 인접 미해결 결정과의 스키마 비중첩을 확인했다. 유일한 지적은 이미 커밋된 spec Rationale 이 아직 `in-progress/`에 있는 plan 파일을 `complete/` 경로로 선인용한 것인데, 이는 plan 체크리스트가 같은 PR 마지막 커밋에서 해소하도록 이미 설계·추적하고 있어 차단 사유가 아니다 (PR 분할 시에만 재점검 필요).

## 위험도

LOW
