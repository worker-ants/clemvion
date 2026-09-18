# 데이터베이스(Database) 리뷰

## 대상

- `codebase/backend/migrations/V117__entity_last_seen_chunk_id_index.{conf,sql}`
- `codebase/backend/migrations/V118__relation_evidence_chunk_id_index.{conf,sql}`
- `codebase/backend/migrations/V119__relation_head_entity_id_index.{conf,sql}`
- `codebase/backend/migrations/V120__relation_tail_entity_id_index.{conf,sql}`
- `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` (V112~V116 선례에 V117~V120 4건 추가)
- `spec/1-data-model.md`, `spec/5-system/10-graph-rag.md`, `spec/data-flow/6-knowledge-base.md` (인덱스 문서 반영)
- `plan/in-progress/spec-draft-graph-fk-indexes.md`, `review/consistency/**` (계획/검토 산출물 — DB 코드 아님, 참고만)

애플리케이션 코드 변경은 없다(마이그레이션 + 문서 + e2e 뿐).

## 발견사항

이번 변경에서 CRITICAL/WARNING 급 결함은 발견하지 못했다. 아래는 확인·검증 내역과 INFO 수준 관찰이다.

- **[INFO]** 인덱스 넷의 storage 증가가 누적으로 작지 않다
  - 위치: `codebase/backend/migrations/V117__entity_last_seen_chunk_id_index.sql:16`, `V118__relation_evidence_chunk_id_index.sql:16`, `V119__relation_head_entity_id_index.sql:17`, `V120__relation_tail_entity_id_index.sql:16` (헤더 주석의 실측 크기 인용)
  - 상세: 800k 규모 기준 `entity(last_seen_chunk_id)` 12 MB(테이블 48 MB 대비 +25%), `relation` 세 인덱스 합 24+19+19=62 MB(테이블 108 MB 대비 +57%). 쓰기 비용도 `relation` 쪽은 행당 +2.05 µs(+10.9%)로 `entity`(+2.0%, 잡음 수준)보다 뚜렷하다. 마이그레이션 헤더에 이미 실측·근거가 상세히 기록되어 있고 그래프 추출은 청크당 LLM 호출(수백 ms~초) 뒤에 쓰기가 일어나므로 µs 단위 오버헤드는 무시할 만하다는 판단도 타당하다.
  - 제안: 조치 불요 — 트레이드오프가 이미 계량화·문서화되어 있다. 배포 후 `pg_stat_user_indexes` 로 실사용률을 한 번 확인해 두면(특히 `idx_relation_head_entity_id`/`idx_relation_tail_entity_id` 가 skip scan 대비 실제로 얼마나 쓰이는지) 향후 유사 판단에 참고가 될 것이다.

- **[INFO]** `head_entity_id`/`tail_entity_id` 는 이미 KB-선두 복합 인덱스 `(knowledge_base_id, head_entity_id)`/`(knowledge_base_id, tail_entity_id)` 가 존재하는 컬럼에 단일 컬럼 인덱스를 추가로 둔다(V119/V120)
  - 위치: `codebase/backend/migrations/V119__relation_head_entity_id_index.sql:25-26`, `V120__relation_tail_entity_id_index.sql:24-25` — 참고: `codebase/backend/src/modules/knowledge-base/entities/relation.entity.ts:23-24` (`idx_relation_kb_head`, `idx_relation_kb_tail` 기존 선언)
  - 상세: 언뜻 중복 인덱스처럼 보이지만, FK 트리거 조회(`DELETE ... WHERE head_entity_id = $1`)는 KB 를 모르므로 복합 인덱스는 PG18 skip scan 으로만 쓰이고 비용이 KB 개수에 비례한다(실측: 호출당 0.74 ms@KB100 → 2.1 ms@KB400). 단일 컬럼 인덱스는 이 의존성을 없앤다. `plan/in-progress/spec-draft-graph-fk-indexes.md` Rationale 절에 `EXPLAIN` 의 `Index Searches: 101` 로 skip scan 을 직접 확인했다는 근거가 실려 있어, 중복이 아니라 의도된 설계임이 명확하다.
  - 제안: 조치 불요 — 이미 소명됨.

## 검증한 항목 (결함 없음 확인)

- **파티셜 인덱스 조건 vs nullable 여부**: `entity.last_seen_chunk_id`(`entity.entity.ts:67`, `nullable: true`, `onDelete: 'SET NULL'`)·`relation.evidence_chunk_id`(`relation.entity.ts:53`, 동일)는 `WHERE ... IS NOT NULL` 파티셜로, `relation.head_entity_id`/`tail_entity_id`(둘 다 `nullable` 미지정 = NOT NULL, `onDelete: 'CASCADE'`)는 비-파티셜로 정의되어 있다 — 컬럼 정의와 인덱스 조건이 정확히 일치한다.
- **무중단 배포 안전성**: 넷 모두 `CREATE/DROP INDEX CONCURRENTLY` + 동봉 `.conf`(`executeInTransaction=false`)를 사용해 테이블 lock 을 피한다. `DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 순서는 `migrations/README.md` §5 「신규 추가에도 0) 을 둡니다」 규약(재실행 시 invalid 잔재가 영구히 남는 것을 방지)과 정확히 일치하며, 파일당 `CREATE` 를 정확히 1개만 두어 §5 "한 statement 만" 컨벤션도 지킨다. 새 인덱스 이름(`idx_entity_last_seen_chunk_id` 등 4개)이 `codebase/`·`spec/`·`plan/` 전수에서 자신을 제외하고 grep 0건임을 plan 문서가 이미 확인했다.
- **버전 단조성**: `ls codebase/backend/migrations | grep V11[7-9]` 로 확인 — V117~V120 이 기존 파일과 충돌 없이 이어진다(plan 체크리스트의 `check-migration-versions.py` 결과 `OK: 120 migration(s), max V120` 과 일치).
- **SQL 인젝션**: 마이그레이션은 정적 DDL, e2e 테스트(`deletion-cascade-indexes.e2e-spec.ts:79-85`)의 `pg_index`/`pg_class` 조회는 `$1` 파라미터 바인딩을 사용한다 — 문자열 결합 없음.
- **e2e 검증 품질**: 단순 존재 확인이 아니라 `indisvalid = true` 와 `pg_get_indexdef` 정규식 대조(선두 컬럼·파티셜 조건까지) 둘 다 단언한다 — `CREATE INDEX CONCURRENTLY` 실패 시 남는 invalid 인덱스를 그린으로 통과시키는 vacuous 함정을 피한다. `beforeAll`/`afterAll` 로 커넥션을 정상 해제한다.
- **N+1 / 대량 데이터 성능**: 이 변경 자체가 FK 트리거의 암묵적 N+1(부모 행마다 자식 테이블 전체 스캔 또는 KB 수에 비례한 skip scan)을 인덱스로 해소하는 성능 개선이다. 실측(800k 청크/400k 엔티티/800k 관계): KB 삭제 129,941 ms → 48.1 ms, 엔티티 삭제 4.25 ms → 0.38 ms. 애플리케이션 코드에 반복문 내 개별 쿼리는 도입되지 않았다.
- **트랜잭션**: 애플리케이션 트랜잭션 로직 변경 없음. `CONCURRENTLY` 두 명령을 트랜잭션 밖에서 실행하는 것은 PostgreSQL 제약상 필수이며 올바르게 처리되었다.
- **커넥션 관리**: 변경 없음(e2e 테스트의 `pg.Client` 생성/해제만 확인, 이상 없음).

## 뮤테이션 검증

이번 리뷰에서는 저장소 파일을 뮤테이션하지 않았다(코드 대조·grep·`ls` 확인만 수행). `git status --short` 로 저장소가 클린한 상태임을 별도로 확인할 필요는 없었다 — Read/Bash(읽기 전용 명령)만 사용했다.

## 요약

그래프 RAG 삭제 연쇄(재임베딩·문서 삭제·엔티티 삭제·KB 삭제)에서 FK 트리거가 선두 인덱스 부재로 전체 테이블을 스캔하거나 KB 수에 비례해 비용이 느는 문제를, `entity.last_seen_chunk_id`·`relation.evidence_chunk_id`(파티셜, nullable 컬럼) 와 `relation.head_entity_id`·`relation.tail_entity_id`(비-파티셜, NOT NULL 컬럼)에 `CREATE/DROP INDEX CONCURRENTLY` 로 추가하는 순수 마이그레이션 PR이다. 컬럼 nullable 여부와 파티셜 조건이 정확히 대응하고, 무중단 배포 컨벤션(`.conf executeInTransaction=false`, DROP-먼저 재실행 안전 패턴, 파일당 CREATE 1개)을 기존 V111~V116 선례와 동일하게 준수하며, 버전 번호·인덱스 이름 충돌도 없다. e2e 테스트는 `indisvalid`와 인덱스 정의(선두 컬럼·파티셜 조건)를 함께 단언해 invalid 인덱스를 그린으로 통과시키는 함정을 피했고, SQL 인젝션 위험도 없다(파라미터 바인딩). 800k 규모 실측으로 KB 삭제 129,941 ms → 48.1 ms 등 대량 데이터 성능 개선이 구체적으로 입증되어 있으며, 인덱스 storage 증가(+25~57%)·쓰기 비용 증가(+2~11%)라는 트레이드오프도 헤더 주석과 spec Rationale 에 정량적으로 기록되어 있다. CRITICAL/WARNING 없음.

## 위험도

LOW — 결함은 없으나 프로덕션 스키마에 새 인덱스 4개를 추가하는 변경이며 storage/쓰기비용 증가가 실측상 0은 아니므로(트레이드오프는 충분히 정당화됨) NONE 대신 LOW로 표기한다.
