# 문서화(Documentation) 리뷰 — 그래프 RAG 삭제 연쇄의 FK 인덱스 넷 (V117~V120)

## 발견사항

- **[WARNING]** `plan/complete/spec-draft-graph-fk-indexes.md` 로의 선인용(forward reference)이 6곳에 있는데, 해당 파일은 아직 `plan/in-progress/`에 있다
  - 위치:
    - `codebase/backend/migrations/V117__entity_last_seen_chunk_id_index.sql:5`
    - `codebase/backend/migrations/V118__relation_evidence_chunk_id_index.sql:5`
    - `codebase/backend/migrations/V119__relation_head_entity_id_index.sql:5`
    - `codebase/backend/migrations/V120__relation_tail_entity_id_index.sql:5`
    - `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts:15` (JSDoc)
    - `spec/1-data-model.md:1002` (`## Rationale` "그래프 RAG 삭제 연쇄의 FK 인덱스 넷" 절 말미)
  - 상세: 위 6개 지점 전부가 `plan/complete/spec-draft-graph-fk-indexes.md` 를 근거·실측 출처로 인용하지만, 실제로는 `git status` 기준 이 파일이 `plan/in-progress/spec-draft-graph-fk-indexes.md` 에 있다. 지금 시점에 PR 이 머지되면 6개 링크가 모두 깨진 채로 codebase/spec 에 영구히 남는다. 직전 선례(V112~V116, 커밋 `6dbac1f53`)는 인용과 `complete/` 이동을 같은 커밋에서 원자적으로 처리해 이 창(window)이 없었다 — 이번 PR 은 아직 그 마지막 커밋 전 단계다. 이미 `review/consistency/2026/09/18/15_04_02/SUMMARY.md`(convention_compliance·plan_coherence, WARNING #1)가 동일 이슈를 지적했고, `plan/in-progress/spec-draft-graph-fk-indexes.md` 체크리스트 마지막 항목("트래커 반영 · 이 draft `complete/` 이동... 이동 뒤 `grep -rln` 로 확인")이 이를 추적 중이다. 즉 새로 발견한 결함이 아니라 **아직 닫히지 않은, 이미 알려진 창**이다.
  - 제안: 이 PR 의 마지막 커밋에서 (1) `plan/in-progress/spec-draft-graph-fk-indexes.md` → `plan/complete/`로 이동하고, (2) 체크리스트에 이미 적힌 대로 `grep -rln "plan/complete/spec-draft-graph-fk-indexes.md" spec codebase`로 6곳 전부가 실재 경로를 가리키는지 재확인한 뒤 머지한다. 그 전에 머지되는 경로(예: PR 분할)가 생기면 인용이 영구히 깨지므로, 이동 커밋 없이 별도로 머지하지 않는다.

- **[INFO]** e2e 스펙 파일 JSDoc·`spec/1-data-model.md` Rationale·마이그레이션 헤더 간 수치·문구는 상호 일치함 (결함 아님, 확인 결과 기록)
  - 위치: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts:6-22`, `spec/1-data-model.md:968-1003`, `V117~V120` SQL 헤더
  - 상세: FK 트리거 설명("부모 행마다 자식을 한 번씩 찾는다"), 실측 수치(KB 하나 삭제 129,941 ms → 48.1 ms, 엔티티 하나 삭제 4.25 ms → 0.38 ms 등), `§2.3`/`§2.4` 앵커, `idx_<table>_<column>` 명명 패턴, FK 제약 이름(`entity_last_seen_chunk_id_fkey` 등, `V025__graph_rag.sql`의 unnamed `REFERENCES` 컬럼 제약에서 Postgres 가 자동 생성하는 이름과 일치), README §5 "신규 추가에도 0) 을 둡니다" 인용 문구까지 원문(`codebase/backend/migrations/README.md:177`)과 정확히 일치한다. 새로 만든 네 파일의 `-- DOWN(...)：` 한 줄 형식도 V111~V116 선례와 동일해 이번 PR 이 새로 도입한 편차가 아니다.
  - 제안: 조치 불요.

- **[INFO]** README·CHANGELOG 갱신 불필요 확인
  - 상세: `codebase/backend/migrations/README.md`는 이미 CONCURRENTLY/`.conf`/DROP-먼저/"신규 추가에도 0) 을 둡니다" 패턴을 §4·§5에서 규정하고 있고, 이번 V117~V120 은 그 기존 패턴을 그대로 따르는 것이라 README 본문 변경이 필요 없다. `CHANGELOG.md` 는 선행 PR(V112~V116, 커밋 `6dbac1f53`)도 항목을 추가하지 않은 순수 DB 성능 마이그레이션이며, 이번 PR 도 같은 성격이라 선례와 일관되게 CHANGELOG 항목이 없다.
  - 제안: 조치 불요.

## 요약

이번 변경은 마이그레이션 SQL/`.conf` 헤더, e2e 스펙 JSDoc, spec 3파일(`1-data-model.md`/`10-graph-rag.md`/`6-knowledge-base.md`)에 걸쳐 실측 수치·경로·앵커를 빠짐없이 갱신했고, 직전 선례(V111~V116)의 문서화 관례(헤더 형식·DOWN 주석·README 인용·표 포맷)를 정확히 복제해 새로운 편차가 없다. 유일한 실질적 문서화 리스크는 `plan/complete/spec-draft-graph-fk-indexes.md`를 가리키는 6곳의 선인용이 그 파일이 아직 `plan/in-progress/`에 있는 현재 시점엔 깨져 있다는 점인데, 이는 이미 consistency checker(WARNING)와 plan 체크리스트 양쪽에 기록된 알려진 창이라 이 PR의 마지막 이동 커밋에서 해소하면 된다. README·CHANGELOG는 기존 관례상 갱신 불요이고, API 문서·설정 문서·예제 코드 항목은 이번 변경 범위(순수 DB 인덱스) 밖이라 해당 없음.

## 위험도

LOW
