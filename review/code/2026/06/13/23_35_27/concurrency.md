# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [INFO] guarded UPDATE의 status IN 가드 — 동시성 전이 차단 올바름
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` else 분기 (`updateExecutionStatus`, 라인 ~9308–9333)
- 상세: `status IN ('pending', 'running', 'waiting_for_input')` 조건부 UPDATE + `RETURNING id` 로 동시 cancel/park 가 DB를 이미 terminal 로 옮긴 경우 0행 매칭 → false 반환 → emit skip. 이는 lost-update를 올바르게 차단하며 PostgreSQL의 단일 UPDATE 원자성을 활용하고 있다. 특히 옛 코드의 "엔티티 읽기 → 메모리 수정 → 전체 save" 패턴이 stale 엔티티로 동시 전이를 덮어쓰던 위험을 제거한다.
- 제안: 이 패턴은 올바르다. 단, else 분기 호출 경로가 RUNNING/COMPLETED 전이에만 해당됨을 주석이 명확히 설명하므로 현 상태 유지.

### [INFO] linkedNodeExec 분기(트랜잭션) — 항상 true 반환, 원자성 보장
- 위치: `execution-engine.service.ts`, `updateExecutionStatus` if 분기 (`manager.transaction` 블록)
- 상세: `manager.save(Execution)` + `manager.save(NodeExecution)` 를 단일 트랜잭션으로 묶어 원자성을 보장. 이 분기는 항상 `true`를 반환해 호출부가 조건 분기 없이 emit한다. 두 분기(트랜잭션/guarded UPDATE)의 반환값 의미가 다르다는 점(linkedNodeExec 분기는 "항상 true")을 JSDoc에 명확히 설명하고 있어 호출부 혼동 위험 낮음.
- 제안: 현 상태 유지.

### [INFO] keyset cursor 배치 루프 — 단일 run 내 동시 변경 처리
- 위치: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts`, `run()` 메서드 `for(;;)` 루프
- 상세: `id > lastId` keyset cursor 배치 패턴으로 run 실행 중 새로 만료 진입한 행은 다음 daily run에서 처리된다고 주석이 명시한다. threshold dedup은 `INSERT ON CONFLICT`(claimThreshold)로 DB 레벨 원자성을 보장해 배치 분할에도 중복 발사가 없다. 올바른 접근이다.
- 제안: SCAN_BATCH_SIZE(500) 상수가 충분히 작아 단일 배치 처리 시간이 스케줄러 재호출 간격보다 짧을 것으로 보이지만, 외부 설정으로 노출하거나 실측 후 조정 고려.

### [INFO] enqueueEmbedChunked — 큐 add 실패 시 'pending' stuck 방지 설계 올바름
- 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`, `enqueueEmbedChunked()` + `finalizeReembedIfDrained()`
- 상세: chunk addBulk 실패 시 해당 chunk 문서를 `embedding_status='failed'`로 UPDATE(보상)한 뒤 계속 다음 chunk를 시도한다. 전체 chunk 완료 후 firstError를 집계해 호출부에 반환하는 설계가 'pending'인데 큐에 없는 영구 stuck 문서 방지에 효과적이다. `finalizeReembedIfDrained`의 CAS(`NOT EXISTS pending/processing`) 는 정상 child가 먼저 완료한 경우도 no-op으로 안전히 처리한다.
- 제안: `enqueueEmbedChunked`와 `finalizeReembedIfDrained` 사이에 중간 상태 불일치 윈도우가 있다(일부 chunk 성공 후 실패 → failed 롤백 → 정상 child finalize 레이스). 하지만 CAS 가드가 이를 올바르게 처리하므로 구조적 문제 없음. 다만 큐 add와 DB UPDATE가 비원자적임을 코드 주석이 이미 인지하고("UPDATE/큐 add 비원자성 보완") 적절히 설명하고 있다.

### [INFO] 재귀 CTE `computeChainDepth` — 사이클 방어 및 단일 쿼리 원자성
- 위치: `codebase/backend/src/modules/executions/executions.service.ts`, `computeChainDepth()`
- 상세: `depth < $2` 가드(`RERUN_CHAIN_WALK_MAX`)로 사이클 무한 재귀 차단. 옛 코드는 N번의 SELECT를 직렬로 반복해 중간에 다른 트랜잭션이 re_run_of를 변경할 경우 비일관성이 있었으나, 단일 재귀 CTE는 단일 스냅샷에서 실행되어 일관성 향상. 반환값 `rows[0]?.depth ?? 1`의 null 방어도 올바르다.
- 제안: 이상 없음.

### [INFO] DB 커넥션 풀 설정 노출 (`DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS`)
- 위치: `codebase/backend/.env.example`, `codebase/backend/src/common/config/database.config.ts`, `codebase/backend/src/app.module.ts`
- 상세: 리소스 풀링 관점에서 `DB_POOL_MAX=10`(node-postgres 기본값)을 env로 노출해 배포 무변경을 보장하면서 운영 환경에서 조정 가능하게 한다. `.env.example` 주석에 `(인스턴스 수 × DB_POOL_MAX) < max_connections` 역산 경고가 명시되어 있다. `connectionTimeoutMillis=0`(무한 대기)은 pg 기본값을 유지하지만, 프로덕션에서는 장시간 대기가 요청 큐 적체로 이어질 수 있다.
- 제안: 프로덕션 배포 시 `DB_POOL_CONNECTION_TIMEOUT_MS`를 0이 아닌 유한값(예: 5000ms)으로 설정 고려. 현재 기본값이 0인 것은 기존 동작 보존을 위한 의도적 선택이므로 코드 자체는 문제 없음.

### [INFO] V095 `CREATE INDEX CONCURRENTLY` + `executeInTransaction=false` — 기존 컨벤션 준수
- 위치: `codebase/backend/migrations/V095__node_execution_exec_status_active_index.sql` / `.conf`
- 상세: partial 인덱스 `WHERE status IN ('waiting_for_input','running')`를 CONCURRENTLY로 생성해 운영 테이블 락 회피. INVALID 인덱스 잔존 시 DROP 후 재시도 절차 주석 포함. 컨벤션(파일당 CONCURRENTLY 한 개, executeInTransaction=false 동봉) 완전히 준수.
- 제안: 이상 없음.

## 요약

이번 변경의 핵심 동시성 개선은 `updateExecutionStatus` else 분기의 guarded UPDATE 패턴이다. 기존의 "엔티티 읽기 → 메모리 수정 → save()" 패턴은 동시 cancel/park 전이가 중간에 DB를 terminal로 옮겨도 stale 상태로 덮어쓰는 lost-update 위험이 있었으나, `status IN (비-terminal)` 가드 + `RETURNING id`로 원자적 조건부 전이로 교체함으로써 이 위험을 제거했다. integration-expiry-scanner의 keyset 배치 루프와 knowledge-base의 `enqueueEmbedChunked` + `finalizeReembedIfDrained` CAS 보상 패턴도 동시성 상황에서 안전하게 설계되어 있다. 재귀 CTE `computeChainDepth`는 단일 스냅샷 쿼리로 중간 변경 노출을 줄이고 사이클 방어도 포함하여 올바르다. DB 커넥션 풀 `connectionTimeoutMillis=0` 기본값은 기존 동작 보존 의도이나 프로덕션에서는 유한 타임아웃 설정을 권장한다. 전반적으로 동시성 위험이 낮으며 중요 취약점은 발견되지 않았다.

## 위험도

LOW
