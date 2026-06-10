# Refactor 백로그 — 데이터베이스 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 3 / Major 7 / Minor 5 — **spec 대조(2026-06-10) 후 유효 13건 / 철회 2건(M-6, m-2) / 부분 철회 1건(m-5)**.
> **spec 대조 판정 분포**: A 2 (C-2, m-5) / B 3 / C 0 / D 8 / E 2. ORM: TypeORM 0.3.x, PostgreSQL + pgvector, Flyway SQL (V001–V087, 다음 번호는 PR 시점 재확인).
> **중복 참조**: M-4 본문은 [01-performance.md](./01-performance.md) #1 소유.
> **부수 발견**: `spec/1-data-model.md §3` 인덱스 표가 기존 V012/V034/V047/V048 도 누락한 **stale 상태** — C-3 진행 시 일괄 동기화 권고 (planner).

## Critical

- [ ] **C-1 refresh 토큰 rotation 비원자성 — 세션 소실 가능** — `auth.service.ts:574,582` + `generateTokens():746`
  - **spec 대조**: D — `1-auth.md §2.4` 는 회전 의미만 정의(트랜잭션 경계 무언급). **대비**: 같은 문서 §1.4 WebAuthn 은 "단일 트랜잭션 안에서 처리" 를 명시 — spec 은 원자성이 의도일 때 명시하는 문서이므로, 본 건은 미결정 영역이고 원자화가 spec 비저촉.
  - **개선 방안**: 1. `refresh()` 정상 회전 분기를 `dataSource.transaction(em => { em.update(RefreshToken, {isRevoked:true,...}); /* INSERT */ })` 로 원자화 — `generateTokens()` 에 optional `EntityManager` 파라미터 추가해 INSERT 를 같은 트랜잭션에 (JWT sign 은 DB 무관 — 트랜잭션 밖 선계산). 2. reuse-detection 분기(:545 family 전체 revoke)는 단일 UPDATE 라 자체 원자적 — `loginHistory` 는 §1.4 전례대로 트랜잭션 밖 유지. 3. 스키마 불변 — 마이그레이션 불요.
  - 검증: 트랜잭션 중간 실패 주입 시 구 토큰 `is_revoked=false` 유지 unit + 기존 refresh/reuse 테스트 green. / 회귀 위험: 낮음 — `generateTokens` 는 login/OAuth 공용이라 manager default 를 기존 repository 로. / spec 갱신: `data-flow/2-auth.md §1.4` 시퀀스에 트랜잭션 박스 1개 (planner, 구현 PR 동행).

- [ ] **C-2 `computeChainDepth` — 직렬 SELECT 누적 (한도 32, walk 상한 64)** ⚠️ **(A — spec 이 함수명까지 명시한 설계, 단 교체는 spec 의도 내)** — `executions.service.ts:286-300`
  - **spec 대조**: **A** — `13-replay-rerun.md §9.1:281` "chain 깊이 32 제한은 **애플리케이션 레벨**에서 enforce (`computeChainDepth`, `re_run_of` walk)" — walk 방식까지 spec 등재. 단 Rationale 이 기각한 것은 chain **전체 조회**용 CTE 이고(그래서 chain_id 도입) 깊이 검증 쿼리 형태는 미결정 — "앱 레벨 enforce" 의 본질은 *앱이 거부* 한다는 것이라 재귀 CTE 로 바꿔도 의도 위반 아님. (원안의 "64" 는 사이클 방어 walk 상한 `32*2` — 한도 자체는 spec 대로 32.) **사용자 보고 대상(spec 본문 1줄 동행 갱신 필요).**
  - **개선 방안**: 1. `WITH RECURSIVE chain AS (... WHERE c.depth < 64) SELECT max(depth)` 단일 raw 쿼리 — 가드 64(`RERUN_CHAIN_WALK_MAX`) 의미 보존, 한도 비교(:364)는 기존 그대로. 2. 상수 2개를 쿼리 파라미터로 주입. 3. 마이그레이션 불요 — PK·V067 `(re_run_of)` 로 충분.
  - 검증: `RERUN_CHAIN_DEPTH_EXCEEDED` 회귀(깊이 1/32/33 + 인위 사이클 fixture). / 회귀 위험: 낮음 — `ON DELETE SET NULL` 끊긴 체인은 양 방식 동일. / **spec 갱신: 필요** — §9.1:281 "(walk)" → "(재귀 CTE 단일 쿼리)" 1줄 (planner — 미갱신 시 consistency-check 가 불일치 검출).

- [ ] **C-3 `node_execution (execution_id, status)` 복합 인덱스 — 신규 제안 (spec 약속 아님)** — `execution-engine.service.ts:5192-5199` 등
  - **spec 대조**: B — `1-data-model.md §3` NodeExecution 행은 `(execution_id)` 단 1개 — spec 약속 미구현이 아니라 **spec·코드 모두 없는 신규 성능 제안**. 핫 경로 실재 확인: `resolveWaitingNodeExecutionId` 외에 `(execution_id, status='running')` 조회(:4384)·UPDATE(:4451) 도 동일 패턴 — partial 범위 `IN ('waiting_for_input','running')` 이 실측 쿼리와 부합.
  - **개선 방안**: 1. `V0XX__node_execution_exec_status_partial_index.sql`: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_node_execution_exec_status_active ON node_execution (execution_id, status) WHERE status IN ('waiting_for_input','running');` + 동봉 `.conf` `executeInTransaction=false` (CONCURRENTLY 파일당 1개 규약). 2. 번호는 PR 시점 `scripts/check-migration-versions.py --base origin/main` 재확인 후 +1.
  - 검증: `make e2e-test` Flyway dry-run + `EXPLAIN (ANALYZE)` Index Scan 전환 + `pg_stat_user_indexes` 관측. / 회귀 위험: 거의 없음(partial — completed 행 비포함, write amplification 은 활성 전이 행만). CONCURRENTLY 실패 시 INVALID 인덱스 잔존 — DROP 후 재시도 runbook. / **spec 갱신: 필요** — `1-data-model.md §3` 행 추가 + `data-flow/3-execution.md` 동기화 (stale 누락분 V012/V034/V047/V048 일괄 — planner).

## Major

- [ ] **M-1 `reEmbedAll` — 단일 addBulk 페이로드 폭발 (메모리 전제는 과장 — `select: ['id']`)** — `knowledge-base.service.ts:591-608`
  - **spec 대조**: D — `8-embedding-pipeline.md §7.3.2` 는 CAS 잠금(`reembed_status` 전이)·finalize 불변식만 정의, 큐 적재 전략 무언급. (§5.1 의 "배치 20" 은 LLM embed API 배치 — 별개.) **정정**: 코드는 id 만 적재 — 실위험은 단일 `addBulk` 페이로드/Redis 왕복.
  - **개선 방안**: 1. 단일 `addBulk` 를 `retryFailedDocuments`(:443) 와 동일한 `CHUNK_SIZE=100` 루프로 — 공용 helper `enqueueEmbedJobsChunked()` 추출해 두 메서드 통일. 2. **chunk 실패 보상 필수**: 실패 chunk 문서를 `embedding_status='failed'` 로 되돌리는 기존 패턴(:469-474) 적용 — 미처리 시 'pending'인데 큐에 없는 문서가 §9.3 stuck 회수 대상에서도 제외(`last_attempted_at IS NULL` 제외 규칙)되어 **영구 stuck**. 전 chunk 실패 시 `reembed_status='idle'` 복귀까지. 3. 선행 UPDATE(:583-589)에 `RETURNING id` 부착으로 SELECT 1회 제거.
  - 검증: chunk 경계(0/1/100/101)·중간 실패 보상 unit + finalize(idle reset) 불변식 integration. / 회귀 위험: graph 모드 연쇄(`chainedGraphExtraction`) 분기 동작 불변 확인. / spec 갱신: 불요 (선택: §7.3.2 에 "chunk 단위" 1줄).

- [ ] **M-2 integration-expiry-scanner — workspace 관리자 N+1 (user 로딩은 기일괄화)** — `integration-expiry-scanner.service.ts:344-348,473-478`
  - **spec 대조**: D — §11.2 는 수신자 의미("Org: Admin 전원")만 정의, 조회 전략 무언급. 잔존 N+1 은 `findAdminUserIds(workspaceId)` per-integration 호출.
  - **개선 방안**: 1. (최소) run 스코프 `Map<workspaceId, Promise<string[]>>` memoize. 2. (정공) workspaceId 집합 모아 `findAdminUserIdsByWorkspaces(In(...))` 일괄 버전 신설 — `WHERE workspace_id IN (...) AND role IN ('owner','admin')` 단일 쿼리 + group. 3. 마이그레이션 불요.
  - 검증: 기존 scanner unit + "동일 workspace 3건 → admin 조회 1회" spy. / 회귀 위험: 낮음(run 스코프 한정 — stale 없음). / spec 갱신: 불요.

- [ ] **M-3 `updateExecutionStatus` — full-entity save 의 lost-update 위험 (emit 순서는 spec 정합)** — `execution-engine.service.ts:9184-9187`, COMPLETED 마감 `:3785-3793`
  - **spec 대조**: D — §1.2:67 이 짝 전이(running↔waiting)의 단일 트랜잭션 + emit-after-commit 을 명시 — **"부정합 창" 중 emit 순서 부분은 문제가 아님**. 실문제는 else 분기·COMPLETED 마감의 **full-entity save** 가 stale 엔티티로 동시 cancel/park 전이를 덮어쓰는 lost-update.
  - **개선 방안**: 1. else 분기·COMPLETED 마감을 `cancelParkedExecution`(:985-994) 의 guarded UPDATE 패턴으로: `.set({status, outputData, finishedAt, durationMs}).where(id).andWhere('status IN (:...nonTerminal)')` — terminal 선점 시 affected=0 no-op + **emit 도 skip**(terminal 이벤트 이중 발행 방지). 2. `linkedNodeExec` 분기(spec §1.2 구현)는 변경 범위 제외. 3. emit 은 기존대로 write 후.
  - 검증: COMPLETED 마감 vs cancel race fixture 에서 최종 status 단일성 + 엔진 e2e 전체. / 회귀 위험: **중간** — 호출처 많음(:1998,:2079 등), affected=0 시 emit skip 이 frontend snapshot 로직과 충돌하지 않는지 확인. / spec 갱신: 불요 (선택: §1.2 에 guarded-UPDATE 1줄).

- [ ] **M-4 rehydration 루프 per-nodeId findOne N+1** — [01-performance.md](./01-performance.md) #1 에서 추적 (포인터).
  - **spec 대조**: D — §7.5 는 복원 의미만 통제. `DISTINCT ON (node_id) ... ORDER BY node_id, started_at DESC` 가 V034 인덱스와 정확히 일치 — C-3 partial 인덱스 불요(completed 미포함).

- [ ] **M-5 커넥션 풀 설정 부재 — pg 기본값(max=10)** — `app.module.ts:86-99`
  - **spec 대조**: B — spec 의 pool 언급은 외부 DB 노드(`POOL_MAX_CONNECTIONS=5`)·MCP 한정 — 앱 자체 PG 풀은 전 spec 무언급. 순수 인프라 구성.
  - **개선 방안**: 1. `extra: { max: DB_POOL_MAX(기본 10 유지), idleTimeoutMillis, connectionTimeoutMillis }` — `database.config` namespace 에 env 등록, **기본값을 현 동작과 동일하게** 두어 배포 무변경. 2. 값 상향은 `pg_stat_activity` 피크 측정 → PostgreSQL `max_connections`(인스턴스 수 × pool max 합산) 역산 후.
  - 검증: env 유/무 부팅 + e2e green. / 회귀 위험: 기본값 보존 시 0, 상향 시 max_connections 초과 — 역산 절차 필수. / spec 갱신: 불요 (PROJECT.md/배포 문서에 env 한 줄).

- [x] ~~**M-6 `getChain` — OR 쿼리의 인덱스 활용 제한**~~ — **철회 (2026-06-10 spec 대조)**
  - **사유**: E — ① OR 형태가 spec 정식 문구(`13-replay-rerun.md §9.1:279`, `1-data-model.md §2.13`, V067 헤더). ② 제안의 "chain_id 를 root id 로 채워 정규화" 는 **spec decision F2 가 명시 기각·v2 이연한 결정**(":283 — core 실행 경로 회귀 위험 … v2 에서 검토"). ③ 성능 전제 약함 — PK + V067 `(chain_id, started_at)` 로 planner 가 BitmapOr 처리 가능, 결과 ≤32행. 철회 전 `EXPLAIN` 1회로 BitmapOr 발동 확인 권장. 정규화 욕구는 spec 이 이미 v2 로 추적 중 — 별도 등재 불요.

- [ ] **M-7 vector 컬럼 `ALTER COLUMN TYPE` 재발 방지 — 명문화 위치 정정** — V021 (기배포 — 소급 수정 금지)
  - **spec 대조**: D — `conventions/migrations.md` 가 작성 가이드를 `migrations/README.md` 에 위임 명시 — **명문화 정위치는 codebase README** (developer 쓰기 권한 영역이라 진행 용이). README 에 NOT VALID 2-step 은 있으나 ALTER TYPE rewrite·lock_timeout 선행 규칙은 부재(V036 ad-hoc 사용례만).
  - **개선 방안**: 1. `migrations/README.md` 에 신규 절 "테이블-rewrite 형 ALTER COLUMN TYPE": (a) binary-coercible 여부 먼저 확인 — V021 류(typed→untyped vector)는 사실상 메타데이터성, `SET lock_timeout='3s'` 선행으로 충분; (b) 실제 rewrite 발생 변경은 shadow column 3-step(ADD → 배치 backfill 별도 V번호 → 코드 스위치 후 DROP+RENAME, 각 단계 lock_timeout); (c) HNSW/partial 인덱스는 rewrite 후 CONCURRENTLY 별도 파일. 2. `conventions/migrations.md` "참고" 절 한 줄은 선택 (planner).
  - 검증: 문서 — 다음 vector 류 마이그레이션 PR 리뷰 체크리스트로 동작. / 회귀 위험: 없음. / spec 갱신: 선택.

## Minor

- [ ] **m-1 expiry-scanner candidates SELECT LIMIT 없음** — `:314-325` (우선순위 낮음 — 만료 7일 윈도우 내 행은 통상 소규모)
  - **spec 대조**: D — §11.1 은 대상 술어·cadence 만 정의.
  - **개선 방안**: 1. id keyset cursor 배치(`take: 500, id > lastId`) — threshold dedup 이 DB `INSERT ON CONFLICT`(:465-470) 라 분할해도 중복 발사 없음. 2. M-2 와 같은 PR.
  - 검증: 배치 경계 fixture(0/1/500/501). / 회귀 위험: run 중 신규 만료 진입 행은 다음 daily run — 기존과 동일 의미. / spec 갱신: 불요.

- [x] ~~**m-2 `node.config` JSONB containment 쿼리 GIN 인덱스 없음**~~ — **철회 (2026-06-10 spec 대조)**
  - **사유**: E — 전제 사실 오류: backend 전체에 `@>` containment 쿼리 **0건** (`->>` 동등 비교 2곳뿐 — integrations.service.ts:699, chat-channel.module.ts:97 은 trigger 테이블). `gin(jsonb_path_ops)` 는 `@>` 전용이라 가속 대상이 존재하지 않음. (대체 후보: 통합 사용처 조회가 실측 병목이 되면 expression 인덱스 `((config->>'integrationId'))` 가 정확한 처방 — 현 빈도로는 불요.)

- [ ] **m-3 `workflow_version.snapshot` JSONB over-fetch — select 제한은 유효, 스토리지 이전은 보류** — `workflow-versions.service.ts:36-42`
  - **spec 대조**: D — `5-version-history.md §7.1`(목록) vs §7.2(상세 "+ snapshot 포함") 대비 구조가 '목록 비포함' 의도를 시사. 목록 UI 도 메타만 사용. **"오브젝트 스토리지 + URI" 후반부는 spec 근거 전무 — 분리·보류** (planner 기획 선행).
  - **개선 방안**: 1. `findByWorkflow` 에 select 명시(snapshot 비적재) + creator relation. 2. DTO 분리: `WorkflowVersionListItemDto` / 상세용 기존 DTO — swagger 갱신. 3. **선행 검증**: frontend 가 목록 응답의 snapshot 을 소비하는지 grep — 소비 시 상세 호출 전환 동반.
  - 검증: 목록/상세/복원 e2e + payload 크기 측정. / 회귀 위험: API shape 변경 — 소비자가 frontend 뿐인지 확인(복원 §6 은 상세 기반 — 무영향). / spec 갱신: §7.1 에 "snapshot 비포함" 1줄 권고 (planner).

- [ ] **m-4 `audit_log` resource 기반 조회 인덱스 — 보류 확정 (기능 부재)** —
  - **spec 대조**: B — spec 의 audit 조회 약속(§4.2 기간/사용자/액션 필터)에 resource_id 기반 조회가 없고 **코드 API 에도 필터 자체가 없음**. 불용 인덱스는 write 비용만 발생 — 지금 아무것도 안 하는 게 맞음.
  - **개선 방안**: 1. 보류 확정 — "기능 도입 시점 일괄 처리" 메모. 2. 도입 시 패키지: 리소스 변경 이력 기능 spec(planner) → `(workspace_id, resource_type, resource_id, created_at DESC)` (workspace 선두 — 격리 일관) CONCURRENTLY → data-model §3 동기 갱신. 3. 참고: 현 resourceType 필터는 90일 보존으로 테이블 유계 — post-filter 로 충분.

- [ ] **m-5 schedule-runner 부팅 적재 — 부분 철회 후 배치 페이징만 잔존** ⚠️ **(A — 부팅 전수 재등록은 spec 명시 설계)** — `schedule-runner.service.ts:108-111`
  - **spec 대조**: **A** — `data-flow/10-triggers.md §1.3:87` "Schedule 은 BullMQ repeatable job … 생성/수정/**서버 부팅 시** `upsertJobScheduler` 로 등록. DB polling/sweep 은 존재하지 않는다." **원안 1안 "BullMQ repeatable jobs 활용" 은 이미 구현된 그 설계 — 철회.** 유효 잔여분은 무페이징 `find` 의 배치화뿐 (spec 의미 불변).
  - **개선 방안**: 1. `onModuleInit` 의 `find({ isActive: true, relations: ['trigger'] })` 를 id keyset 배치(take 500)로 — `upsertJobScheduler` 가 idempotent 라 분할 안전. 2. relations 적재가 실제 필요한지 확인 후 불필요 시 제거.
  - 검증: N>배치크기 fixture 에서 전 스케줄 등록 확인(`queue.getJobSchedulers()`). / 회귀 위험: 낮음 — per-item try/catch(:118-124) 유지. / spec 갱신: 불요.
