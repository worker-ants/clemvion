# Cross-Spec 일관성 검토 — 그래프 RAG 삭제 연쇄 FK 인덱스 넷 (V117~V120)

## 검토 범위 안내

`--impl-done` scope 는 `spec/conventions/` 이나 그 영역의 델타는 0개다(코드-전용 마이그레이션 PR). 실제 구현이 SoT 로 삼는 spec 은 scope 밖 셋 — `spec/1-data-model.md` §2.12.2/§2.12.3/§3/Rationale, `spec/5-system/10-graph-rag.md` §2.3/§2.4, `spec/data-flow/6-knowledge-base.md` entity/relation sink 행 — 이며, 이 셋이 서로·마이그레이션 파일·`spec/conventions/migrations.md`(scope 내 유일 관련 컨벤션)·e2e·plan 트래커와 맞는지를 절대경로 워킹트리에서 직접 대조했다.

## 발견사항

없음. 아래 8개 축을 전수 대조했고 전부 일치한다.

1. **Entity/Relation 필드·인덱스 정의 (`spec/1-data-model.md` §2.12.2·§2.12.3) ↔ §3 인덱스 전략 표 ↔ 마이그레이션 SQL**: `last_seen_chunk_id`/`evidence_chunk_id`/`head_entity_id`/`tail_entity_id` 컬럼명, partial 조건(`WHERE ... IS NOT NULL`), V번호(V117~V120) 모두 4개 파일(`V117__entity_last_seen_chunk_id_index.sql` 등)의 실제 `CREATE INDEX` 문과 글자 그대로 일치.
2. **`spec/5-system/10-graph-rag.md` §2.3·§2.4 인덱스 목록**: 데이터 모델과 동일 컬럼·V번호로 교차 참조, 상충 없음.
3. **`spec/data-flow/6-knowledge-base.md` entity/relation sink 행**: 동일 인덱스 이름·V번호 인용, 상충 없음.
4. **`spec/conventions/migrations.md` §1·§2·§5 + `codebase/backend/migrations/README.md` §4·§5**: V번호 단조 증가(V116 다음 V117~V120, gap 없음), `.conf` 4개 모두 `executeInTransaction=false`, "신규 추가에도 0) DROP 을 둔다"(README §5, V111 선례) 패턴을 4개 파일 모두 준수(`DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 순서, 파일당 CREATE 정확히 1개).
5. **e2e (`deletion-cascade-indexes.e2e-spec.ts`)**: `EXPECTED` 배열의 `idx_entity_last_seen_chunk_id`/`idx_relation_evidence_chunk_id`/`idx_relation_head_entity_id`/`idx_relation_tail_entity_id` 4건이 실제 인덱스명과 일치.
6. **실측 수치**: 마이그레이션 헤더 주석의 KB 삭제(129,941→48.1ms)·엔티티 삭제(4.25→0.38ms)·재임베딩(1,795.7→2.37ms)·쓰기비용(+2.0%/+10.9%) 수치가 `spec/1-data-model.md` Rationale "그래프 RAG 삭제 연쇄의 FK 인덱스 넷 (2026-09-18)" 절의 표와 정확히 일치. spec 이 코드보다 넓게 말하는 곳 없음.
7. **트래커 정합**: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "선두 인덱스가 없는 FK … 28개 남음"이 `plan/complete/spec-draft-deletion-cascade-indexes.md` 부록 표(전수 37행, `awk` 로 실측: ✅ 9 / 미체크 28)와 정확히 일치. 이 PR 이 닫은 4행(V117~V120)이 반영돼 있다.
8. **인덱스 이름 자체는 spec 본문에 리터럴로 노출되지 않음** (spec 은 "(V117)" 식으로만 인용) — 정합 여부를 판정할 대상 자체가 아니므로 충돌 없음.

이 4개 마이그레이션은 순수 DDL(인덱스 추가)이라 API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 축과는 애초에 접점이 없다 — 해당 축은 전부 해당 없음(N/A)으로 판정.

**참고 (신규 지적 아님)**: `spec/1-data-model.md` Rationale 말미·마이그레이션 헤더·e2e JSDoc 등 6곳이 아직 `plan/in-progress/`에 있는 `spec-draft-graph-fk-indexes.md` 를 `plan/complete/` 경로로 선인용하고 있다. 이는 스펙-스펙 간 모순이 아니라 spec→plan 참조의 시점 문제이며, 이미 동일 세션의 코드 리뷰(`review/code/2026/09/18/15_20_31/SUMMARY.md` WARNING #1)가 "PR 마지막 커밋에서 draft 를 이동 후 전 인용 검증"으로 처분해 두었다 — 중복 flag 하지 않는다.

## 요약

이번 PR 은 순수 DB 마이그레이션(FK 인덱스 4개, `entity`/`relation` 테이블)이며 관련 spec 셋(`1-data-model.md`, `5-system/10-graph-rag.md`, `data-flow/6-knowledge-base.md`)과 `spec/conventions/migrations.md` 컨벤션 전체를 대조한 결과 데이터 모델·인덱스명·V번호·실측 수치·트래커 카운트가 코드·문서 간 한 글자도 어긋나지 않는다. API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 축은 이 변경의 성격상 해당 사항이 없다. Cross-Spec 일관성 관점에서 채택을 막을 결함이 없다.

## 위험도

NONE
