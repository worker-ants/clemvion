# 성능(Performance) 리뷰 — 삭제 연쇄의 FK 인덱스 다섯 (V112~V116)

## 검토 범위

`codebase/backend/migrations/V112~V116` (5 SQL + 5 conf), `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts`, 그리고 이를 미러하는 `spec/1-data-model.md` · `spec/data-flow/{3-execution,5-integration,7-llm-usage}.md`. `plan/**`·`review/consistency/**` 는 산출물/문서로, 성능 관점의 리뷰 대상(실행되는 코드)이 아니라 참고만 했다.

## 발견사항

- **[INFO]** 이 PR 은 결함 수정이 아니라 실측 기반 성능 개선 자체다 — 알고리즘 복잡도 관점에서 정당함을 확인
  - 위치: `codebase/backend/migrations/V112__node_execution_node_id_index.sql:24-26`, `V113__integration_usage_log_node_execution_id_index.sql:22-24`, `V114__integration_usage_log_workflow_id_index.sql:21-23`, `V115__llm_usage_log_node_execution_id_index.sql:24-27`, `V116__llm_usage_log_execution_id_index.sql:22-25`
  - 상세: 선두 인덱스가 없는 FK 는 부모 행 삭제마다 Postgres FK 트리거가 자식 테이블을 순차 스캔한다 — 즉 삭제 1건당 O(자식 테이블 크기), 연쇄 삭제 시 O(연쇄 행 수 × 자식 테이블 크기). 다섯 인덱스는 이를 각 컬럼당 O(log n) 등치 조회로 낮춘다. `plan/complete/spec-draft-deletion-cascade-indexes.md` 의 800k 규모 실측(워크플로 삭제 2,225 ms → 6.96 ms, 캔버스 노드 삭제 206.6 ms → 0.79 ms)과 코드(`node_execution.node_id` CASCADE, `integration_usage_log.{node_execution_id,workflow_id}` CASCADE, `llm_usage_log.{node_execution_id,execution_id}` SET NULL)가 정확히 대응한다. 별도 수정 요구 없음.
  - 제안: 없음 (참고 기록).

- **[INFO]** `CREATE/DROP INDEX CONCURRENTLY` + `executeInTransaction=false` — 블로킹 I/O 관점에서 올바른 선택
  - 위치: `codebase/backend/migrations/V112__node_execution_node_id_index.conf:4` 등 5개 `.conf` 전부, 대응 `.sql` 의 `DROP/CREATE INDEX CONCURRENTLY` 문
  - 상세: `node_execution`·`integration_usage_log`·`llm_usage_log` 는 각각 INSERT 가 잦은 hot 테이블이다(노드 실행마다, 연동 호출마다, LLM 호출마다 1행). 일반 `CREATE INDEX` 는 빌드 중 해당 테이블에 `SHARE` 락을 걸어 쓰기를 차단하지만, `CONCURRENTLY` 는 그 블로킹을 피한다. 선행 DROP 도 `IF EXISTS` + `CONCURRENTLY` 라 안전하다. 올바른 구현.
  - 제안: 없음.

- **[INFO]** 데이터 구조(파샬 인덱스) 선택이 용도에 맞음
  - 위치: `codebase/backend/migrations/V115__llm_usage_log_node_execution_id_index.sql:25-27`, `V116__llm_usage_log_execution_id_index.sql:23-25`
  - 상세: `llm_usage_log.node_execution_id`/`execution_id` 는 nullable(노드/실행 밖 LLM 호출)이고 FK `ON DELETE SET NULL` 트리거의 조회는 항상 등치(`= $1`)라 `IS NOT NULL` 을 함의한다. `WHERE … IS NOT NULL` 파샬 인덱스로 NULL 행을 제외해 인덱스 크기(3.9 MB, 160k/20k 행 기준)를 줄이면서 트리거 조회에는 그대로 쓰인다 — 기존 `(workflow_id, created_at DESC) WHERE workflow_id IS NOT NULL` 과 동일 패턴. `integration_usage_log`·`node_execution` 쪽 세 컬럼은 NOT NULL 이라 파샬을 안 쓴 것도 맞다.
  - 제안: 없음.

- **[INFO]** 쓰기 비용(트레이드오프)이 실측됐고 결론이 타당하나, 이미 인덱스가 많은 hot 테이블에 인덱스가 계속 누적되는 추세는 모니터링 대상
  - 위치: `plan/complete/spec-draft-deletion-cascade-indexes.md` (`## 실측 > 쓰기 비용` 절) — 코드 변경 자체는 없음, spec 미러는 `spec/1-data-model.md:990-999`(assembled 문서 기준 gate, 원본 파일 라인 번호는 프롬프트 크기 제한으로 미기재)
  - 상세: `node_execution` 은 이미 6개 인덱스(`(execution_id)`, `(execution_id, node_id, started_at DESC)`, 2개 partial, expression 인덱스, 이번 `(node_id)`)를 갖는 가장 뜨거운 INSERT 경로다. 이번 인덱스로 행당 +0.85 µs(+8.7%), `integration_usage_log`·`llm_usage_log` 는 각각 +1.08 µs(+10.0%)·+1.35 µs(+9.0%). 저자가 "노드 한 번 실행은 ms 단위·외부 호출은 수십~수백 ms" 라 µs 단위 오버헤드는 무시할 만하다고 이미 근거를 댔고, 측정 순서(«없음» 먼저 → «있음» 나중, 캐시 워밍 후라 과소평가 가능성 명시)까지 disclosure 했다 — 근거는 타당하다. 다만 이 테이블에 인덱스가 앞으로도 계속 추가되면 percentage 오버헤드가 선형으로 누적되므로, 다음에 `node_execution`/`llm_usage_log` 에 인덱스를 더할 때는 이번처럼 "행당 절대시간" 기준으로 재측정하는 관례를 유지할 필요가 있다.
  - 제안: 코드 변경 불요. 향후 같은 테이블에 인덱스 추가 시 누적 오버헤드(%) 를 다시 합산해 보는 것을 권장(문서화 참고 사항, 이 PR 을 막을 이유는 아님).

- **[INFO]** 다섯 인덱스가 최대 800k(`node_execution`) 규모까지만 실측됨 — 그 이상 규모의 CONCURRENTLY 빌드 소요시간은 미검증
  - 위치: `plan/complete/spec-draft-deletion-cascade-indexes.md` `## 실측` 절 (배포 절차 자체는 코드 범위 밖)
  - 상세: 조회/쓰기 비용은 800k 규모에서 실측했고 "규모 4배에 비용 4.5~5배" 로 선형성을 확인했다. 그러나 프로덕션 테이블이 실측 규모(수십만~백만 단위 이하로 추정)를 크게 초과하면 `CREATE INDEX CONCURRENTLY` 자체의 빌드 시간(초기 스캔 + 검증 스캔, 총 2회 풀스캔)이 길어질 수 있고, 5개 인덱스가 순차 배포되므로 `integration_usage_log`·`llm_usage_log` 는 각 2회씩 풀스캔이 겹친다. `CONCURRENTLY` 라 쓰기 차단은 없지만, autovacuum 경합·디스크 I/O 는 배포 시점에 늘어날 수 있다.
  - 제안: 이 PR 을 막을 사유는 아님 — 프로덕션 배포 시 각 마이그레이션의 실제 소요 시간을 모니터링하고, 필요하면 트래픽이 낮은 시간대에 순차 적용하는 정도로 충분하다.

- **[INFO]** e2e 테스트의 5회 개별 카탈로그 쿼리 — N+1 형태이나 실질적 영향 없음
  - 위치: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts:55-69` (`it.each(EXPECTED)` 블록, 각 케이스가 `pg_index`/`pg_class` 를 개별 쿼리)
  - 상세: 5개 인덱스 이름에 대해 매번 별도 `SELECT … WHERE c.relname = $1` 을 실행한다. 데이터 크기와 무관하게 고정 N=5 인 테스트 코드라 실질적 성능 문제는 아니다(프로덕션 코드가 아니라 CI 상의 스키마 검증용).
  - 제안: 불요 — 원한다면 `WHERE c.relname = ANY($1)` 로 한 번에 조회해 라운드트립을 줄일 수 있으나 이득이 미미하므로 선택 사항.

## 요약

이 PR 은 결함이 아니라 그 자체로 성능 개선이다 — Postgres FK 트리거가 인덱스 없는 자식 컬럼을 삭제마다 풀스캔하던 O(자식 테이블 크기 × 연쇄 행 수) 비용을 다섯 개의 타겟 인덱스로 O(log n) 등치 조회로 낮췄고, 800k 규모 실측(워크플로 삭제 2,225 ms → 6.96 ms, 캔버스 노드 삭제 206.6 ms → 0.79 ms)으로 뒷받침됐다. `CREATE/DROP INDEX CONCURRENTLY` + 비-트랜잭션 설정으로 hot 테이블의 쓰기 블로킹을 피했고, `llm_usage_log` 두 인덱스는 nullable 컬럼에 맞춰 partial 로 정확히 구성됐다. 쓰기 비용 트레이드오프(행당 +0.85~1.35 µs)도 실측·근거가 명시돼 있어 타당하다. 발견된 항목은 전부 INFO — 이미 많은 인덱스를 가진 hot 테이블의 누적 오버헤드 모니터링, 800k 를 넘는 프로덕션 규모에서의 CONCURRENTLY 빌드 소요시간 관찰, e2e 테스트의 사소한 쿼리 라운드트립 정도이며 머지를 막을 사유는 없다.

## 위험도

NONE
