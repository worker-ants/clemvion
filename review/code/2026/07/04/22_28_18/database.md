# 데이터베이스(Database) 리뷰 — orphan pending backstop (재검토)

세션: `review/code/2026/07/04/22_28_18` · 재검토 대상: 이전 세션(`22_12_26`)의 database WARNING(W1, "`(status,queued_at)` 전용 인덱스 미추가")에 대한 인라인 정당화 주석 적용 결과.

## 검증 절차

- `codebase/backend/migrations/V002__indexes.sql:19` 확인 — `idx_execution_status`는 `execution(status)` 단일 컬럼 인덱스(V002, 최초 스키마부터 존재).
- 신규 `recoverOrphanPendingExecutions`(`execution-engine.service.ts:2913` 부근)의 `find({ where: { status: PENDING, queuedAt: LessThan(staleThreshold) } })` 쿼리와, 기존 `reclaimStuckRunningExecution`(`status='running' AND started_at < :threshold`, 단일 UPDATE...RETURNING)의 쿼리 shape을 직접 대조.
- `resolveQueueWaitTimeoutMs()`(`execution-limits.ts:79`, 기본 5분) 참조 확인 — PENDING 상태는 admission cap + 이 timeout으로 체류 시간이 구조적으로 bound됨(consumer가 pick up하면 이 이전 timeout 검사로 곧 admitted/cancelled 전이).
- `markQueueWaitTimeout`(`execution-engine.service.ts:2560`)이 파라미터 바인딩 조건부 UPDATE(`WHERE id=:id AND status='pending'`)로 멱등함을 재확인.

## 발견사항

- **[INFO]** 인덱스 미추가 정당화는 구조적으로 타당함
  - 위치: `execution-engine.service.ts` `recoverOrphanPendingExecutions` 인라인 주석 (find 쿼리 직전)
  - 상세: "boot-only cold query + sparse pending + 기존 RUNNING backstop과 대칭" 근거를 코드로 직접 대조한 결과 사실과 일치한다. (1) `reclaimStuckRunningExecution`도 `idx_execution_status` 단일 컬럼 인덱스에만 의존하며 실제로 기존에 전용 `(status, started_at)` 복합 인덱스 없이 운영 중인 선례다 — "대칭"이라는 주장은 과장이 아니라 코드 사실이다. (2) PENDING 상태는 `resolveQueueWaitTimeoutMs()`(기본 5분) 내에 admitted 또는 cancelled로 전이되도록 설계되어 있어(§8 admission 경로), 정상 운영 시 PENDING 행 자체가 순간 스냅샷 기준 소수(sparse)로 유지된다 — "sparse pending" 주장도 설계상 근거가 있다. (3) 트리거 경로가 `onApplicationBootstrap` + test-hook 뿐으로 hot-path 쿼리가 아니라는 점도 코드로 확인된다(요청 경로·admission 경로 어디에도 이 스캔이 걸려 있지 않음).
  - 결론: `idx_execution_status`(status 단일 컬럼) 스캔 후 `queued_at` 필터는 인덱스 스캔 → 소수 후보 → 메모리 필터로, 부팅 1회성 쿼리에 대해 실행계획/성능 리스크가 실질적으로 없다. 신규 복합 인덱스를 추가하지 않기로 한 결정은 write-path 인덱스 유지비(execution은 INSERT/UPDATE 빈도가 높은 hot 테이블) 대비 이익이 낮아 합리적이다.
  - 제안 (선택적, 비차단): 이 "sparse/bounded" 가정이 무너지는 경우 — 예: 대규모 admission 실패로 job이 대량 유실되는 장애 시나리오, 또는 워크스페이스 cap이 매우 크게 설정되어 PENDING 누적이 구조적으로 커지는 경우 — 부팅 스캔이 순차 `find()` 후 순차 `await markQueueWaitTimeout(id)` 루프이므로 orphan 건수가 수천 단위로 커지면 부팅 지연 요인이 될 수 있다. 현재는 발생 확률이 낮고(admission cap + 5분 timeout이 구조적으로 억제) best-effort/boot-only로 명시돼 있어 즉각 조치 불필요. 다만 향후 실제 운영 중 orphan 누적이 관측되면 (a) 배치 크기 상한(`.take(N)`) 또는 (b) 복합 인덱스 추가를 재검토할 트리거 조건으로 plan에 남겨두는 것을 권장.

- **[INFO]** `find()` → 순차 루프는 N+1 형태이나 실질 영향 없음
  - 위치: `recoverOrphanPendingExecutions` (find 후 `for (const { id } of orphans) await this.markQueueWaitTimeout(id)`)
  - 상세: 형태상 N+1(대상 목록 조회 1회 + 대상별 UPDATE N회)이나, (1) 각 UPDATE는 독립 idempotent cancel이라 배치 트랜잭션으로 묶을 정합성 요구가 없고, (2) 대상 집합이 위에서 검증한 대로 sparse·bounded, (3) boot-only 트리거라 지연이 사용자 요청 경로에 영향을 주지 않는다. 트랜잭션 미사용도 각 row가 독립적으로 cancel 가능한 상태이므로 적절하다(all-or-nothing이 필요 없음).
  - 제안: 없음. 현행 유지 타당.

## 재확인된 기존 항목 (회귀 없음)

- 파라미터 바인딩: `LessThan(staleThreshold)`(TypeORM `find`) 및 `markQueueWaitTimeout`의 QueryBuilder `:id`/`:pending` named parameter 모두 파라미터화 — SQL 인젝션 경로 없음.
- 마이그레이션: 신규 컬럼/인덱스/마이그레이션 없음(기존 V104 `queued_at`, V002 `idx_execution_status` 재사용) — 무중단 배포 관점 리스크 없음.
- 트랜잭션/커넥션: 신규 커넥션 풀 사용 없음, 기존 `executionRepository` 재사용. `markQueueWaitTimeout` 자체 try/catch로 개별 실패 격리.
- race: `WHERE status='pending'` 조건부 UPDATE라 동시 admission(다른 프로세스가 먼저 admitted로 전이)과의 TOCTOU에 안전(affected=0이면 no-op).

## 요약

이전 세션 database WARNING(W1: 전용 `(status,queued_at)` 복합 인덱스 부재)에 대해 추가된 인라인 정당화 주석을 코드베이스 사실과 직접 대조 검증했다. `idx_execution_status`가 실제로 단일 컬럼 인덱스이며, 기존 RUNNING 재구동 스캔(`reclaimStuckRunningExecution`)도 동일하게 전용 복합 인덱스 없이 이 단일 컬럼 인덱스에만 의존해 운영 중이라는 "대칭 선례" 주장이 사실로 확인됐다. 또한 PENDING 체류 시간이 admission cap과 `resolveQueueWaitTimeoutMs()`(기본 5분)로 구조적으로 bound되어 "sparse pending" 전제도 타당하다. 트리거가 boot-only/on-demand test-hook에 한정돼 hot-path 성능에 영향이 없다는 점까지 종합하면, 신규 인덱스를 추가하지 않기로 한 판단은 근거가 충분하며 신규 인덱스 없이도 안전하다. 순차 loop UPDATE(N+1 형태)와 트랜잭션 미사용도 각 cancel이 독립 idempotent 연산이라는 점에서 적절하다. 재확인 결과 새로운 CRITICAL/WARNING 없음 — 이전 WARNING은 유효하게 해소됐다.

### 위험도
NONE

STATUS: SUCCESS
