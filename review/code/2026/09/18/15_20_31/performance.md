# 성능(Performance) 리뷰 — 그래프 RAG 삭제 연쇄의 FK 인덱스 넷 (V117~V120)

## 대상 요약

`codebase/backend/migrations/V117__entity_last_seen_chunk_id_index.{sql,conf}`,
`V118__relation_evidence_chunk_id_index.{sql,conf}`,
`V119__relation_head_entity_id_index.{sql,conf}`,
`V120__relation_tail_entity_id_index.{sql,conf}`,
`codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts`(V117~V120 케이스 추가), 및 이를 뒷받침하는
`plan/in-progress/spec-draft-graph-fk-indexes.md` · `spec/1-data-model.md` · `spec/5-system/10-graph-rag.md` ·
`spec/data-flow/6-knowledge-base.md` 문서 갱신. 애플리케이션 코드 변경은 없다. 이 PR 자체가 "FK 트리거의 선두
인덱스 부재로 인한 O(자식 테이블 크기 × 삭제되는 부모 행 수)" 문제를 해소하는 성능 개선 PR이며, 실측(129,941 ms
→ 48.1 ms 등)이 첨부되어 있다.

## 발견사항

- **[INFO]** `relation` 테이블 쓰기 비용 누적 — 이번 PR 로 세 인덱스(V118~V120) 추가, 기존 6개(V025 UNIQUE ·
  V025 idx_relation_kb_head/tail · V027 head+tail 복합 · V028 gin trigram)에 더해짐
  - 위치: `codebase/backend/migrations/V118__relation_evidence_chunk_id_index.sql:18`(쓰기 비용 주석), `spec/1-data-model.md:996`(같은 수치가 Rationale 에 반영)
  - 상세: 헤더 주석 자체가 10만 행 INSERT median 1,879.3 → 2,084.0 ms(행당 +2.05 µs, +10.9%)로 정직하게 측정해 두었다. `relation` 은 그래프 추출 시 청크마다 LLM 호출(수백 ms~초) 뒤에 쓰이므로 이 오버헤드는 무시할 만하다는 근거도 같이 적혀 있어, 트레이드오프가 이미 정량적으로 검증된 상태다.
  - 제안: 조치 불요. 다만 향후 `relation` 에 인덱스를 추가로 붙일 때는 이번 실측 기준선(+10.9%/3개)을 참고해 누적 쓰기비용이 계속 선형으로 늘어나는지 추적할 가치가 있다.

- **[INFO]** `CREATE INDEX CONCURRENTLY` 는 800k+ 규모 테이블에서 백그라운드 빌드 시간이 상당할 수 있음
  - 위치: `codebase/backend/migrations/V117__entity_last_seen_chunk_id_index.sql:24-27`, `V118`/`V119`/`V120` 동일 패턴
  - 상세: CONCURRENTLY 를 정확히 사용해 테이블 잠금 없이 인덱스를 만드는 것은 맞는 설계이고(V111~V116 선례와 일치, `.conf`/`README.md §4~5` 규약 준수), `executeInTransaction=false` 도 올바르게 동봉되어 있다. 다만 운영 규모(엔티티 400k·관계 800k 이상으로 성장 시)에서는 빌드 자체가 수 초~수십 초 걸릴 수 있어 배포 타이밍(트래픽이 적은 시간대)을 고려할 필요가 있다 — 이는 신규 결함이 아니라 CONCURRENTLY 인덱스 생성의 일반적 운영 특성이며, 이번 PR 의 설계 결함은 아니다.
  - 제안: 조치 불요(정보 제공). 배포 절차에 이미 반영되어 있다면 무시.

- **[INFO]** `V119`/`V120` 은 partial 조건 없는 전체 인덱스 — 설계 근거가 명확함
  - 위치: `codebase/backend/migrations/V119__relation_head_entity_id_index.sql:25-26`, `codebase/backend/migrations/V120__relation_tail_entity_id_index.sql:24-25`
  - 상세: `head_entity_id`/`tail_entity_id` 는 NOT NULL 이므로(주석·`spec/1-data-model.md` Rationale 명시) partial 조건이 불필요하다는 판단이 맞다. 반대로 `V117`/`V118` 은 nullable 컬럼이라 partial(`WHERE ... IS NOT NULL`)로 인덱스 크기를 줄인 것도 일관적이다(V115·V116 선례와 동일 패턴). 알고리즘/자료구조 선택이 용도에 맞다.
  - 제안: 조치 불요.

- **[INFO]** 기존 복합 인덱스와의 관계 — 중복이 아니라 skip scan 비용을 KB 수에 비례에서 O(1)로 낮추는 목적
  - 위치: `plan/in-progress/spec-draft-graph-fk-indexes.md` §Rationale "왜 head·tail 도 넣나", `codebase/backend/migrations/V119__relation_head_entity_id_index.sql:15-16`
  - 상세: `(knowledge_base_id, head_entity_id)`가 이미 있어 언뜻 새 단일 컬럼 인덱스가 중복으로 보일 수 있으나, PG18 skip scan 이 KB 값 수만큼 인덱스를 건너뛰며 쓰기 때문에 호출당 비용이 KB 수에 비례해 증가한다는 것을 계획(`Index Searches: 101`)으로 직접 확인했다. 이 근거는 검증 가능한 주장이고 실측(EXPLAIN)까지 첨부되어 있어 신뢰할 만하다.
  - 제안: 조치 불요.

- **[INFO]** e2e 테스트는 `it.each` 로 9개(V112~V120) 인덱스에 대해 각각 별도 쿼리를 순차 실행 — 성능상 무시 가능한 수준
  - 위치: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts:76-90`
  - 상세: 케이스마다 `db.query` 1회, 단일 `Client` 재사용. `pg_index`/`pg_class` 조회는 각각 인덱스형 스캔 몇 ms 수준이라 N+1 문제로 볼 정도는 아니다(테스트 스키마 조회이지 프로덕션 hot path 아님).
  - 제안: 조치 불요.

CRITICAL/WARNING 급 성능 결함은 발견되지 않았다.

## 요약

이번 PR 은 그 자체가 성능 개선 목적의 DB 마이그레이션이다. FK `ON DELETE SET NULL`/`CASCADE` 트리거가 선두 인덱스 없이 자식 테이블(엔티티 400k·관계 800k 규모)을 전수 스캔하던 O(n) 경로를 부분/전체 B-tree 인덱스 넷으로 O(log n) 으로 낮췄고, KB 삭제 129,941 ms → 48.1 ms, 재임베딩 1,795.7 ms → 2.37 ms 등 정량 실측이 마이그레이션 헤더·spec Rationale·plan 문서 세 군데에 일관되게 기록되어 있다. `head_entity_id`/`tail_entity_id` 는 기존 복합 인덱스의 skip-scan 비용이 KB 수에 비례한다는 점을 EXPLAIN 으로 직접 검증해 "중복 인덱스"가 아님을 뒷받침했고, nullable 컬럼(V117/V118)에는 partial 인덱스로 크기를 최소화했으며, NOT NULL 컬럼(V119/V120)에는 partial 조건을 넣지 않아 자료구조 선택이 용도에 정확히 맞는다. `CREATE/DROP INDEX CONCURRENTLY` + `.conf executeInTransaction=false` + "신규에도 DROP-먼저" 패턴은 기존 V111~V116 선례·`migrations/README.md §4~5` 규약과 일치한다. 쓰기 비용 증가(`relation` +10.9%/행)도 측정해 LLM 호출 대비 무시 가능함을 근거로 남겼다. 발견된 항목은 모두 INFO 수준의 참고 사항(누적 인덱스 쓰기비용 추적, 대규모 CONCURRENTLY 빌드 시간)이며 조치가 필요한 CRITICAL/WARNING 은 없다.

## 위험도
NONE
