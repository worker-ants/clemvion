# 성능(Performance) 리뷰

## 발견사항

### 발견사항 1
- **[INFO]** `computeChainDepth` N+1 쿼리 → 재귀 CTE 단일 쿼리로 개선 (C-2)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `computeChainDepth`
  - 상세: 기존 구현은 `re_run_of` 링크를 따라 조상당 1회씩 SELECT를 반복하는 직렬 walk였다. 최대 `RERUN_CHAIN_WALK_MAX`(64)번 왕복이 발생할 수 있었다. 신규 구현은 `WITH RECURSIVE chain` CTE 하나로 DB 왕복을 1회로 줄이고, `WHERE c.depth < $2` 가드로 사이클도 차단한다. PK와 V067(`re_run_of`) 인덱스로 커버되므로 추가 마이그레이션이 불필요하며 O(depth) 왕복이 O(1) 왕복으로 전환된 의미 있는 개선이다.
  - 제안: 현재 구현 유지. 단, `RERUN_CHAIN_WALK_MAX`가 CTE 종료 조건(`depth < $2`)으로 사용되므로, 이 상수 값이 깊이 제한(32)과 별개로 관리된다면 명시적 주석으로 두 상수의 관계를 문서화하는 것이 좋다.

### 발견사항 2
- **[INFO]** `integration-expiry-scanner` per-integration N+1 제거 → 배치 단일 쿼리 (M-2)
  - 위치: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts` — `resolveRecipientsForBatch`
  - 상세: 기존 `resolveRecipients`는 루프 내에서 각 integration마다 `workspacesService.findAdminUserIds()`를 호출해 N+1을 유발했다. 신규 `resolveRecipientsForBatch`는 배치 내 고유 workspace ID를 Set으로 수집한 뒤 `findAdminUserIdsByWorkspaces()`로 한 번의 `IN` 쿼리로 처리한다. O(N) DB 왕복이 O(1)로 감소한다.
  - 제안: 현재 구현 유지. `personal` scope integration은 DB 조회 없이 `createdBy`를 직접 사용하므로 불필요한 admin 쿼리 비용도 절감된다.

### 발견사항 3
- **[INFO]** `integration-expiry-scanner` 무제한 SELECT → id keyset 배치 페이징 (m-1)
  - 위치: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts` — `run`
  - 상세: 기존 구현은 단일 `find()`로 만료 대상 전체를 메모리에 적재했다. 신규 구현은 `SCAN_BATCH_SIZE=500`의 keyset cursor 루프로 전환해 임의 규모의 데이터도 일정 메모리로 처리한다. keyset 기준 컬럼이 UUID primary key(`id ASC`)라 정렬 인덱스 스캔이 효율적이다.
  - 제안: 현재 구현 유지. UUID는 바이트 순서로 비교되므로 `ZERO_UUID`(`00000000-...`) 시작점이 올바르다. `SCAN_BATCH_SIZE` 상수를 환경 변수로 노출할 필요는 없으나, 향후 DB 부하 프로파일링 결과에 따라 조정 가능하도록 상수로 격리된 것은 적절하다.

### 발견사항 4
- **[INFO]** `reEmbedAll` UPDATE RETURNING으로 SELECT 1회 제거 + addBulk 청크 분할 (M-1)
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` — `reEmbedAll`, `enqueueEmbedChunked`
  - 상세: 기존 구현은 `UPDATE document SET embedding_status='pending' WHERE kb_id=$1` 후 별도 `SELECT id`를 실행해 2번의 DB 왕복이 발생했다. 신규 구현은 `UPDATE ... RETURNING id`로 1회로 통합한다. 또한 단일 `addBulk(전체 문서 배열)` 호출이 Redis 페이로드 크기를 문서 수에 비례해 증가시키던 문제를 `EMBED_CHUNK_SIZE=100` 단위 분할로 해소한다.
  - 제안: 현재 구현 유지.

### 발견사항 5
- **[INFO]** `updateExecutionStatus` else 분기: full-entity save → guarded partial UPDATE (M-3)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `updateExecutionStatus`
  - 상세: 기존 `executionRepository.save(execution)`은 엔티티 전 컬럼을 UPDATE해 `conversation_thread`, `user_variables` 등 동시 park가 기록한 컬럼을 덮어쓸(lost-update) 위험이 있었다. 신규 raw `UPDATE ... SET status=$2, active_running_ms=$3, finished_at=$4, duration_ms=$5, output_data=$6::jsonb, resume_call_stack=$7::jsonb WHERE id=$1 AND status IN ('pending','running','waiting_for_input') RETURNING id`는 lifecycle 관련 컬럼만 써서 불필요한 컬럼 전송을 줄이고 동시 terminal 전이 시 0행 매칭으로 no-op 처리한다. 성능 측면에서도 네트워크 페이로드와 인덱스 업데이트 범위가 줄어든다.
  - 제안: 현재 구현 유지. `JSON.stringify` 호출이 `outputData`/`resumeCallStack`에 대해 발생하는 것은 TypeORM raw query에서 jsonb를 다루는 관용 패턴으로 적절하다.

### 발견사항 6
- **[INFO]** `findByWorkflow` snapshot 컬럼 over-fetch 제거 (m-3)
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `findByWorkflow`
  - 상세: 기존 구현은 `relations: ['creator']`만 지정해 `snapshot`(워크플로 전체 노드/엣지 JSONB, 잠재적으로 수십~수백 KB)을 목록 전체에 걸쳐 적재했다. 신규 구현은 `select`에 `snapshot`을 명시하지 않아 DB→앱 전송 데이터량과 메모리 사용량을 대폭 줄인다. 목록 UI는 메타데이터만 필요하며 상세(`findOne`)는 여전히 전체를 반환한다.
  - 제안: 현재 구현 유지.

### 발견사항 7
- **[INFO]** `V095` 부분 복합 인덱스: 활성 NodeExecution 조회 핫 경로 커버
  - 위치: `codebase/backend/migrations/V095__node_execution_exec_status_active_index.sql`
  - 상세: `node_execution (execution_id, status) WHERE status IN ('waiting_for_input', 'running')` partial 인덱스를 CONCURRENTLY로 추가한다. 실행 엔진의 `resolveWaitingNodeExecutionId`(WAITING_FOR_INPUT 조회)와 running 조회/UPDATE가 이 인덱스로 커버된다. completed/failed/cancelled/skipped(대다수)는 인덱스 범위 밖이므로 인덱스 크기와 write amplification이 최소화된다. `.conf executeInTransaction=false`로 운영 무중단 적용을 보장한다.
  - 제안: 현재 구현 적절. `IF NOT EXISTS`로 재시도 안전성도 확보되어 있다.

### 발견사항 8
- **[INFO]** DB 커넥션 풀 설정 외부화 (M-5)
  - 위치: `codebase/backend/src/common/config/database.config.ts`, `codebase/backend/src/app.module.ts`
  - 상세: 기존에는 node-postgres 풀 설정이 코드에 고정(또는 pg 내부 기본값에 의존)되어 운영 환경에서 `pg_stat_activity` 피크를 측정한 뒤 풀 크기를 조정하려면 재배포가 필요했다. 신규 구현은 `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS`를 환경 변수로 노출하고 `nonNegativeIntEnv` 헬퍼로 음수/NaN을 기본값으로 폴백한다.
  - 제안: `DB_POOL_CONNECTION_TIMEOUT_MS=0`(무한 대기) 기본값은 커넥션 고갈 시 요청이 영구 hang할 수 있는 리스크가 있다. 운영 환경에서는 적절한 타임아웃(예: 5000ms)을 설정하도록 운영 가이드 또는 주석에서 권고하는 것이 좋다. 현재 `.env.example`에 `0 = wait indefinitely` 설명이 있으나, 운영 권장값을 예시로 추가하면 실수를 줄일 수 있다.

### 발견사항 9
- **[WARNING]** `enqueueEmbedChunked` 내 순차 `await` — 청크 간 병렬화 기회 없음
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` — `enqueueEmbedChunked` (라인 621-643)
  - 상세: 현재 구현은 청크를 순차(`for ... await`)로 처리한다. 각 청크는 독립적이므로 원칙적으로 병렬 처리가 가능하다. 그러나 Redis/BullMQ 부하 완화가 분할의 핵심 목적(`M-1`)이므로 순차 처리가 의도적인 백프레셔 제어일 수 있다. 문서 수가 수천 건을 넘어 청크가 많아질 경우 총 처리 시간이 지연될 수 있다.
  - 제안: 현재 워크로드(일반 KB 크기)에서는 순차가 적절하다. 향후 대규모 KB(수천 문서) 지원 시 제한된 동시성(`p-limit` 패턴, 예: concurrency=3)을 고려할 수 있다. 단, 청크 실패 시 rollback 로직이 순차 가정으로 설계되어 있으므로 병렬화 시 오류 집계 로직도 함께 재검토가 필요하다.

### 발견사항 10
- **[INFO]** `findAdminUserIdsByWorkspaces` 결과 메모리 사용
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `findAdminUserIdsByWorkspaces`
  - 상세: `IN(workspaceIds)` 쿼리로 admin/owner 멤버 전체를 앱 메모리에 로드 후 Map으로 그룹화한다. 배치 크기(`SCAN_BATCH_SIZE=500`)와 workspace당 admin 수가 제한적이므로 실용적 범위에서 메모리 문제는 없다. TypeORM `find`는 `select` 옵션 없이 호출되어 `WorkspaceMember` 엔티티의 모든 컬럼을 가져오지만, 필요한 것은 `workspaceId`와 `userId`만이다.
  - 제안: 불필요한 컬럼 전송을 줄이기 위해 `select: { workspaceId: true, userId: true }`를 추가하는 것이 좋다. 성능 임팩트는 소규모에서 미미하지만 best practice이다.

### 발견사항 11
- **[INFO]** `processCandidateBatch` 내 `allRecipientIds` Set 순회 — 적절한 자료구조
  - 위치: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts` — `processCandidateBatch` (라인 379-382)
  - 상세: 중복 user ID 제거에 `Set<string>`을 사용하고, `userRepository.find({ where: { id: In([...allRecipientIds]) } })`로 일괄 조회한다. 자료구조 선택이 적절하다. 단, `allRecipientIds`를 spread로 배열화(`[...allRecipientIds]`)하는 것은 O(n)으로 문제없다.
  - 제안: 현재 구현 유지.

## 요약

이번 변경은 성능 측면에서 일관되게 긍정적이다. `computeChainDepth`의 N+1 walk를 재귀 CTE 단일 쿼리로 교체하고, integration expiry scanner의 per-integration admin 조회 N+1을 배치 단일 쿼리로 해소하며, 무제한 전체 로딩을 keyset 배치 페이징으로 전환한 것이 핵심 개선이다. `reEmbedAll`의 UPDATE RETURNING 통합과 addBulk 청크 분할, `updateExecutionStatus`의 partial guarded UPDATE, 버전 목록의 snapshot over-fetch 제거, V095 partial 복합 인덱스 추가까지 데이터 흐름 전반의 불필요한 DB 왕복과 메모리 비효율이 체계적으로 제거되었다. 유일한 주의 사항은 DB 커넥션 타임아웃 기본값 0(무한 대기)과 `findAdminUserIdsByWorkspaces`의 미지정 select로, 운영 환경에서 사소한 리스크가 될 수 있다.

## 위험도

LOW
