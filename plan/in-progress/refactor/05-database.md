# Refactor 백로그 — 데이터베이스 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 3 / Major 7 / Minor 5. ORM: TypeORM 0.3.x, PostgreSQL + pgvector, Flyway SQL (V001–V087).
> **중복 참조**: M-4 (rehydration N+1) 본문은 [01-performance.md](./01-performance.md) #1 소유.
> **기존 plan 관계**: [`../integration-index-unify.md`](../integration-index-unify.md) 는 integration 테이블 인덱스 통일 — C-3 (node_execution) 과 별개.
> 전반 평가: 목록 쿼리 페이지네이션, 마이그레이션 lock_timeout/IF EXISTS 가드는 양호.

## Critical

- [ ] **C-1 refresh 토큰 rotation 비원자성 — 세션 소실 가능** — `backend/src/modules/auth/auth.service.ts:574,582` + `generateTokens():746`
  구 토큰 revoke(UPDATE) 와 신규 토큰 INSERT 가 별도 연결 순차 실행 — 첫 write 커밋 후 장애 시 구 토큰만 무효화되고 신규 미생성. reuse-detection 분기(:545)도 동일 패턴.
  → `dataSource.transaction()` 으로 revoke+INSERT 원자화.

- [ ] **C-2 `computeChainDepth` — 최대 64회 직렬 SELECT** — `backend/src/modules/executions/executions.service.ts:286-300`
  re-run 체인 깊이 검증을 cursor 순회 N+1 로 수행.
  → `WITH RECURSIVE chain AS (...)` 재귀 CTE 단일 쿼리로 대체 (depth < 65 가드 포함).

- [ ] **C-3 `node_execution (execution_id, status)` 복합 인덱스 누락** — `migrations/V002__indexes.sql:22` vs `execution-engine.service.ts:5192-5199`
  `resolveWaitingNodeExecutionId()` 가 `WHERE execution_id=$1 AND status='waiting_for_input'` 핫 경로(버튼/폼/AI 멀티턴 재개 전부)에서 post-filter heap scan. 현존 인덱스는 `(execution_id)`, `(execution_id, node_id, started_at DESC)` 뿐.
  → `CREATE INDEX CONCURRENTLY ... ON node_execution (execution_id, status) WHERE status IN ('waiting_for_input','running')` partial 인덱스 추가.

## Major

- [ ] **M-1 `reEmbedAll` — 전체 document 메모리 적재 후 일괄 큐잉** — `knowledge-base.service.ts:591-608`
  unbounded `find()` + 단일 `addBulk` 페이로드 폭발 위험.
  → `retryFailedDocuments`(:443) 의 `UPDATE ... RETURNING id` + CHUNK_SIZE=100 패턴으로 통일.

- [ ] **M-2 integration-expiry-scanner — org-scoped 통합마다 workspace 관리자 N+1 조회** — `integration-expiry-scanner.service.ts:344-348,473-478`
  → workspace_id 별 memoize(Map) 또는 `IN (...)` 일괄 적재.

- [ ] **M-3 `updateExecutionStatus` — linkedNodeExec 없는 분기의 비원자 save + 이벤트 발행 간 부정합 창** — `execution-engine.service.ts:9184-9187` (COMPLETED 저장 :3791 vs emit :3795)
  → `stop()`(:726-738) 의 atomic UPDATE(createQueryBuilder.update) 패턴으로 status+outputData+finishedAt 단일 UPDATE 화.

- [ ] **M-4 rehydration 루프 per-nodeId findOne N+1** — `execution-engine.service.ts:1310-1320` → [01-performance.md](./01-performance.md) #1 에서 추적 (동일 항목).

- [ ] **M-5 커넥션 풀 설정 부재 — pg 기본값(max=10)** — `backend/src/app.module.ts:86-99`
  병렬 엔진 + 임베딩 워커(concurrency 3) + 스케줄러 동시 수요 시 풀 고갈 가능.
  → `extra: { max, idleTimeoutMillis, connectionTimeoutMillis }` 를 env(`DB_POOL_MAX` 등)로 노출, pg_stat_activity 관측 후 값 결정.

- [ ] **M-6 `getChain` — `id = :rootId OR chainId = :rootId` 쿼리의 인덱스 활용 제한** — `executions.service.ts:498-503`
  → 조건 명시 재작성 또는 chain_id 를 root 자신 id 로 채워 `WHERE chain_id = :rootId` 단순화 (schema 정규화).

- [ ] **M-7 vector 컬럼 `ALTER COLUMN TYPE` 재발 방지** — `migrations/V021__variable_embedding_dimension.sql:11` (기배포 — 소급 수정 아님)
  → 향후 동일 변경 시 lock_timeout + shadow column(add→backfill→drop) 패턴을 마이그레이션 규약으로 명문화.

## Minor

- [ ] **m-1 expiry-scanner candidates SELECT LIMIT 없음** — `integration-expiry-scanner.service.ts:314-325` → 배치/cursor 또는 `take` 추가.
- [ ] **m-2 `node.config` JSONB containment 쿼리 GIN 인덱스 없음** — `V001:106` + `nodes/**` 의 `config @> ...` 패턴 → 빈번 경로 확인 후 `gin(config jsonb_path_ops)` 추가.
- [ ] **m-3 `workflow_version.snapshot` JSONB over-fetch** — `V001:256` → 목록 SELECT 에서 snapshot 제외(select 명시), 장기적으로 오브젝트 스토리지 + URI 참조 검토.
- [ ] **m-4 `audit_log` resource 기반 조회 인덱스 없음** — `V001:321`, `V002:33` → `(resource_type, resource_id, created_at DESC)` 추가 (해당 조회 기능 도입 시).
- [ ] **m-5 schedule-runner 부팅 시 active schedule 전량 적재** — `schedule-runner.service.ts:108-111` → BullMQ repeatable jobs 또는 배치 페이징 등록.
