# Plan 정합성 검토 — `spec/conventions/` (impl-done)

## 검토 범위 확인

- `spec/conventions/` 델타: 0개 파일 (`origin/main` 대비). 이 PR 은 그 영역을 바꾸지 않았다 — 정상(코드+`spec/1-data-model.md`·`spec/5-system/10-graph-rag.md`·`spec/data-flow/6-knowledge-base.md` 만 건드린 spec draft).
- 실제 구현 diff(9파일/241줄) 는 `codebase/backend/migrations/V117~V120__*.{sql,conf}` 4쌍 + `deletion-cascade-indexes.e2e-spec.ts` — 워킹트리에서 절대경로로 확인, 실재함.
- 관련 진행 중 plan: `plan/in-progress/spec-draft-graph-fk-indexes.md`(본 PR 의 draft, 아직 `--impl-done`·`complete/` 이동 전) · `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커, «선두 인덱스가 없는 FK» 항목) · `plan/complete/spec-draft-deletion-cascade-indexes.md`(전수 부록의 SoT, 본 PR 이 부록 행 4개에 ✅ 를 추가하도록 수정).

## 발견사항

없음.

- **미해결 결정과의 충돌 (관점 1)**: `spec/conventions/` 안에 이 PR 의 결정과 충돌하는 "결정 필요" 항목이 없다. `conventions/conversation-thread.md` 의 미해결 항목(Parallel 컨테이너 thread 정책)은 무관한 도메인. `plan/in-progress/spec-draft-nullable-notation-followups.md:4609` 의 열린 결정 항목("캔버스 저장이 노드를 빼면 그 노드의 실행 이력이 사라진다 — 보존 정책 결정 필요", `node.id → node_execution.node_id CASCADE`)은 이 PR 이 건드리는 `entity.last_seen_chunk_id`/`relation.evidence_chunk_id`(SET NULL)·`relation.head_entity_id`/`tail_entity_id`(CASCADE) 와 다른 FK 이며, 이 PR 은 그 열린 항목의 CASCADE/SET NULL **동작을 바꾸지 않고 인덱스만 추가**했다 — 기존 결정을 우회하지 않는다.
- **선행 plan 미해소 (관점 2)**: 이 PR 이 가정하는 선행 조건 — `plan/complete/spec-draft-deletion-cascade-indexes.md` 의 V112~V116 선례(`DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS` + `.conf executeInTransaction=false` 패턴, `spec/conventions/migrations.md` §5 의 "인덱스 마이그레이션은 DROP 먼저" 규약) — 는 이미 complete 로 닫혀 있고, 실제 `V117~V120__*.conf` 가 그 패턴을 그대로 따른다(확인됨). `spec/conventions/migrations.md` 의 V번호 정책(단조 증가·gap 금지·재사용 금지)도 위반 없음 — `check-migration-versions.py --base origin/main` 이 `OK: 120 migration(s), max V120` 로 통과했다고 plan 체크리스트에 기록돼 있고 실제 마이그레이션 파일 V117~V120 이 연속.
- **후속 항목 누락 (관점 3)**: 이 PR 의 변경이 다른 plan 의 후속 항목을 무효화하는 곳은 없다. 오히려 후속 갱신이 이미 반영돼 있다 — `plan/complete/spec-draft-deletion-cascade-indexes.md` 부록 표의 4개 행(«다음 후보(지식 베이스)»)이 «✅ V117~V120 (`plan/complete/spec-draft-graph-fk-indexes.md`)»로, `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 트래커 항목이 «32개 남음»→«28개 남음» + «다음 후보 — 부모 삭제가 드문 큰 테이블 셋»으로 동기 갱신됐다. 두 파일의 인용 경로(`plan/complete/spec-draft-graph-fk-indexes.md`)는 아직 실재하지 않는다 — draft 가 아직 `plan/in-progress/`에 있고 체크리스트 마지막 두 항목(`--impl-done`, `complete/` 이동)이 미완료이기 때문이다. 이는 결함이 아니라 **plan 자신이 명시한 마무리 순서**(체크리스트: `--impl-done` → 트래커 반영·이 draft 를 `complete/` 로 이동 → 이동 뒤 인용 전수 grep 확인)이고, 지금 이 검토(plan_coherence, `--impl-done`)가 그 순서의 다음 단계다. `plan/in-progress/rag-quality-improvement.md`(그래프 entity-extraction 을 vector 모드 KB 로 확장 예정)는 이번 인덱스 작업과 상충하지 않고 오히려 그 확장이 늘릴 entity/relation 삭제 부하를 미리 낮추는 방향이라 후속 무효화도 없다.

## 요약

target(`spec/conventions/`)은 이번 PR 에서 델타가 없고, 실제로 참조되는 유일한 관련 컨벤션(`migrations.md` — V번호 정책·CONCURRENTLY 인덱스 패턴)은 워킹트리의 V117~V120 마이그레이션과 정확히 일치한다. `plan/in-progress/spec-draft-graph-fk-indexes.md` 는 자신이 전제한 선행 plan(`spec-draft-deletion-cascade-indexes.md` complete)을 정확히 인용·갱신했고, 트래커(`spec-draft-nullable-notation-followups.md`)의 카운트·"다음 후보" 서술을 같은 커밋에서 동기 갱신했으며, 별도로 열려 있는 "노드 삭제 실행 이력 보존 정책" 결정 항목과도 충돌하지 않는다. 아직 남은 `plan/complete/spec-draft-graph-fk-indexes.md` 인용(현재는 미실재 경로)은 plan 자신이 정한 마무리 순서(`--impl-done` → 트래커 반영 → `complete/` 이동)의 다음 단계일 뿐 정합성 결함이 아니다.

## 위험도

NONE
