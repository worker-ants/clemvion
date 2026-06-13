# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 아키텍처 레이어 경계 위반(서비스에 raw SQL 직접 노출)과 타입 안전성 갭이 복수의 reviewer 에서 수렴하여 MEDIUM. 기능 정확성은 양호하며 보안·동시성 위험은 낮다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | Critical 발견사항 없음 | — | — |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `updateExecutionStatus` else 분기에서 raw SQL(`executionRepository.query(...)`)이 서비스 레이어에 직접 노출. 컬럼명 하드코딩으로 DB 리네임 시 컴파일 오류 없이 런타임 버그 발생. 메모리 엔티티 상태와 DB 상태 일관성이 SQL 성공 여부에 달림. | `execution-engine.service.ts` — `updateExecutionStatus` else 분기 | TypeORM `QueryBuilder.update().where('status IN (...)')` 또는 별도 `ExecutionRepository` 클래스로 raw 쿼리 격리 |
| 2 | Architecture | `computeChainDepth` 재귀 CTE raw SQL이 서비스 레이어에 노출. DB 특정 문법(PostgreSQL 재귀 CTE)과 비즈니스 로직 혼재. | `executions.service.ts` — `computeChainDepth` | `ExecutionRepository` 커스텀 클래스 도입, `repository.computeChainDepth(id)` 형태로 호출 |
| 3 | Architecture | `KnowledgeBaseService.enqueueEmbedChunked`가 큐 적재(infrastructure) + DB 롤백 보상(persistence) + 에러 집계(비즈니스 정책)를 단일 메서드에서 수행하여 SRP 위반. 호출부별 에러 처리 정책이 상이해 계약 모호. | `knowledge-base.service.ts` — `enqueueEmbedChunked` | 적재+실패 chunk 식별만 담당하고 보상 DB UPDATE는 호출부가 수행하도록 분리 |
| 4 | Architecture / Side Effect | `WorkflowVersionsService.findByWorkflow` 반환 타입이 `Promise<WorkflowVersion[]>`이지만 실제로는 `snapshot` 제외된 부분 필드만 로드. TypeScript 타입과 런타임 불일치 — `snapshot` 접근 시 컴파일 오류 없이 `undefined` 반환. | `workflow-versions.service.ts` — `findByWorkflow` | 반환 타입을 `Promise<WorkflowVersionListItemDto[]>` 또는 `Pick<WorkflowVersion, ...>[]`으로 좁혀 컴파일 타임에 차단 |
| 5 | Testing | `updateExecutionStatus` else 분기의 기존 6개 assertion이 `status IN (...)` 가드 문자열을 검증하지 않아 lost-update 가드 누락이 있어도 테스트가 통과. | `execution-engine.service.spec.ts` — 6개 교체 사이트 | 6개 사이트에도 `expect.stringMatching(/status IN/)` 또는 공용 matcher 상수 추가 |
| 6 | Testing | `updateExecutionStatus` else 분기의 `PENDING → RUNNING` 전이(선점 케이스, 0행 반환 → false) 테스트 부재. `query()` 자체 reject 케이스도 미검증. | `execution-engine.service.spec.ts` | `PENDING → RUNNING` 동시 선점 케이스 + `query()` reject 케이스 추가 |
| 7 | Testing | `enqueueEmbedChunked` 중간 chunk 실패 시 이후 chunk가 계속 처리되는 설계 계약이 직접 검증되지 않음. 단일 chunk 1개 실패만 테스트. | `knowledge-base.service.spec.ts` | 150개 doc(2 chunk) 중 1번째 chunk 실패 + 2번째 정상 케이스 추가 |
| 8 | Testing | 페이징 테스트의 모든 candidate가 `tokenExpiresAt: null`라 실제 알림 경로 미통과. 배치 경계 idempotency(중복 알림 방지) 미검증. | `integration-expiry-scanner.service.spec.ts` — "paginates candidates" | 배치 경계에 만료 임박 integration 포함 케이스 추가 |
| 9 | Maintainability | `KnowledgeBaseService.EMBED_CHUNK_SIZE = 100`(클래스 상수)과 `retryFailedDocuments` 내부 `const CHUNK_SIZE = 100`(지역 상수)이 동일한 의미의 값을 중복 선언. 한쪽만 변경 시 embedding/graph 경로 배치 크기 불일치 발생. | `knowledge-base.service.ts` — line 57 vs line 519 | `retryFailedDocuments`의 지역 `CHUNK_SIZE` 제거, `EMBED_CHUNK_SIZE` 또는 별도 `GRAPH_CHUNK_SIZE` 참조로 통일 |
| 10 | SPEC-DRIFT | [SPEC-DRIFT] `findByWorkflow` 목록에서 snapshot 제외(m-3)가 spec/3-workflow-editor/5-version-history.md §7.1에 반영되어 있지 않음. 코드가 맞고 spec이 낡은 상태. 코드 revert가 아닌 spec 갱신 필요. | `spec/3-workflow-editor/5-version-history.md` §7.1 | spec §7.1 응답 설명을 `WorkflowVersionListItemDto`(snapshot 제외 명시) + §7.2 상세와 대비 구조로 갱신 |
| 11 | Documentation | `GET /workflows/:wfId/versions` 응답 shape가 snapshot 제외 `WorkflowVersionListItemDto`로 변경됨. Swagger 업데이트됨. 프론트엔드에서 `snapshot` 필드를 직접 소비하는지 확인 필요. | `codebase/frontend` — workflow-version 목록 응답 소비 코드 | `codebase/frontend`에서 `snapshot` 필드 접근 검색 후 영향 없음 확인 또는 타입 업데이트 |
| 12 | Documentation | `computeChainDepth` JSDoc이 spec Rationale에 없는 판단을 서술하여 나중에 spec 리뷰자가 혼동 가능. | `executions.service.ts` JSDoc / `spec/5-system/13-replay-rerun.md` | spec Rationale에 "깊이 검증 CTE 허용" 문장 추가 또는 JSDoc 완화 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `DB_POOL_CONNECTION_TIMEOUT_MS=0`(무한 대기) 기본값 — 커넥션 고갈 시 요청 영구 hang 가능. 기존 pg 기본값과 동일하며 의도적 선택이나 운영 가이드 보강 권장. | `.env.example`, `database.config.ts` | 운영 환경에서 5000ms 등 유한값 설정 권장 |
| 2 | Security | 모든 raw 쿼리가 파라미터 바인딩(`$1~$7`, `ANY($1::uuid[])`) 사용. SQL 인젝션 위험 없음. | 전 raw 쿼리 | 해당 없음 |
| 3 | Performance | `enqueueEmbedChunked` 순차 `for ... await` — 대규모 KB(수천 문서) 시 총 처리 시간 지연 가능. 현재 워크로드에서는 적절. | `knowledge-base.service.ts` — `enqueueEmbedChunked` | 대규모 지원 시 `p-limit` 패턴(concurrency=3) 검토 |
| 4 | Performance | `findAdminUserIdsByWorkspaces`가 `WorkspaceMember` 전 컬럼 조회. `workspaceId`, `userId`만 필요. | `workspaces.service.ts` | `select: { workspaceId: true, userId: true }` 추가 |
| 5 | Database | `integration` 테이블의 `(status, tokenExpiresAt)` 복합 인덱스 존재 여부 미확인. 대량 환경에서 배치 쿼리가 seq scan 전락 가능. | `integration-expiry-scanner.service.ts` | `EXPLAIN`으로 커버리지 확인, 없으면 마이그레이션 추가 검토 |
| 6 | Database | `workspace_member` 테이블의 `(workspace_id, role)` 복합 인덱스 존재 여부 미확인. | `workspaces.service.ts` | 기존 인덱스 확인 권장 |
| 7 | Requirement | `reEmbedAll` `documentCount` 반환값이 "전체 대상 수" → "큐 적재 성공 수"로 변경. 정상 경로에서는 동일하나 실패 시 차이. | `knowledge-base.service.ts` — `reEmbedAll` | 프론트엔드가 전체 대상 수로 가정하면 `{ totalDocuments, enqueuedCount }` 분리 노출 검토 |
| 8 | Requirement | `nonNegativeIntEnv`에서 `'1abc'` 입력 시 parseInt 선두 숫자 파싱으로 1 반환. 운영 실수가 유효값으로 처리됨. | `database.config.ts` — `nonNegativeIntEnv` | 허용 수준. 엄격한 검증 필요 시 `Number(raw)` 또는 정수 패턴 검사 사용 |
| 9 | Scope | `spec/` 파일 수정이 개발자 세션에서 진행됨(구현 사실 동기화 목적). 역할 분리 관행 문제이나 내용은 타당. | `spec/1-data-model.md`, `spec/5-system/13-replay-rerun.md`, `spec/data-flow/3-execution.md` | 향후 spec 동기화는 project-planner 세션에서 별도 처리하거나 CLAUDE.md에 예외 명시 |
| 10 | Testing | `computeChainDepth` — `query` mock이 `[]` 반환 시 depth=1 폴백 케이스 미검증. | `executions-rerun.service.spec.ts` | `execRepo.query.mockResolvedValueOnce([])` 케이스 추가 |
| 11 | Testing | `executions-rerun.service.spec.ts`에 더 이상 소비되지 않는 `getRawOneQueue` 변수 잔류(dead code). | `executions-rerun.service.spec.ts` | 확인 후 제거 |
| 12 | Testing | `resolveRecipientsForBatch` — personal + organization 혼합 배치 케이스 테스트 부재. | `integration-expiry-scanner.service.spec.ts` | 혼합 배치 케이스 추가, `findAdminUserIdsByWorkspaces` 인자에 personal workspaceId 미포함 검증 |
| 13 | Testing | 페이징 테스트에서 `SCAN_BATCH_SIZE=500` 매직 넘버 하드코딩. 상수 변경 시 테스트 깨짐. | `integration-expiry-scanner.service.spec.ts` | 상수 참조로 변경 |
| 14 | Testing | `findOne`이 `relations: ['creator']` 배열 문법, `findByWorkflow`는 `{ creator: true }` 객체 문법 혼용. | `workflow-versions.service.spec.ts` | 객체 문법으로 통일 또는 의도 주석 명시 |
| 15 | Testing | `WorkflowVersionListItemDto` 직렬화 시 `snapshot` 필드가 응답에 미포함됨을 검증하는 e2e/컨트롤러 테스트 부재. | 컨트롤러 레벨 테스트 / e2e | `GET /workflows/:wfId/versions` 응답에 `snapshot` 키 부재 확인 테스트 추가 |
| 16 | Maintainability | `for (;;)` 루프 패턴 — break 조건이 body 두 곳에 분산. | `integration-expiry-scanner.service.ts` — `run()` | `while (true)` 또는 단일 break 조건으로 통일 |
| 17 | SPEC-DRIFT | [SPEC-DRIFT] `computeChainDepth` CTE 구현 관련 spec/5-system/13-replay-rerun.md가 이미 갱신됨 — 추가 조치 불요. | spec/5-system/13-replay-rerun.md | 해소됨 |
| 18 | SPEC-DRIFT | [SPEC-DRIFT] spec/1-data-model.md NodeExecution 인덱스 표 갱신(V095 포함) — 기존 gap 해소, 추가 조치 불요. | spec/1-data-model.md | 해소됨 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| architecture | MEDIUM | 서비스 레이어 raw SQL 노출(updateExecutionStatus, computeChainDepth), enqueueEmbedChunked SRP 위반, findByWorkflow 반환 타입 불일치 |
| testing | LOW | 6개 기존 assertion에 guarded 가드 문자열 미검증, enqueueEmbedChunked 중간 chunk 실패 계약 미검증, 페이징 배치 경계 idempotency 미검증 |
| side_effect | LOW | findByWorkflow 타입-런타임 불일치(snapshot undefined), reEmbedAll documentCount 의미 변경, updateExecutionStatus 반환 타입 void→boolean |
| documentation | LOW | GET /versions 응답 shape 변경 프론트엔드 영향 확인 필요, JSDoc 분기별 계약 drift 위험 |
| maintainability | LOW | EMBED_CHUNK_SIZE vs CHUNK_SIZE 중복 선언(잠재 불일치), for(;;) 패턴 가독성 |
| requirement | LOW | documentCount 의미 변경(정상 경로 무관), SPEC-DRIFT 1건(spec §7.1 갱신 필요) |
| security | LOW | 모든 raw 쿼리 파라미터 바인딩 확인됨. DB_POOL_CONNECTION_TIMEOUT_MS=0 운영 주의 필요 |
| performance | LOW | 다수 N+1 제거 확인됨. enqueueEmbedChunked 순차 처리(대규모 시 검토 필요) |
| database | LOW | 전 raw 쿼리 파라미터화 확인. integration/workspace_member 인덱스 존재 여부 확인 권장 |
| concurrency | LOW | guarded UPDATE 패턴 올바름. lost-update 위험 제거 확인 |
| scope | NONE | 24개 파일 전체 작업 범위 내. 불필요한 변경 없음 |

---

## 발견 없는 에이전트

없음 (전 에이전트가 발견사항 기록).

---

## 권장 조치사항

1. **[WARNING #4 — 타입 안전성]** `WorkflowVersionsService.findByWorkflow` 반환 타입을 `Promise<WorkflowVersionListItemDto[]>`로 변경. `snapshot` 접근을 컴파일 타임에 차단.
2. **[WARNING #5 — 테스트 커버리지]** `execution-engine.service.spec.ts` 기존 6개 assertion에 `expect.stringMatching(/status IN/)` 추가. lost-update 가드 누락 시 테스트로 탐지 가능하게.
3. **[WARNING #9 — 유지보수성]** `retryFailedDocuments` 내 `const CHUNK_SIZE = 100` 제거, `KnowledgeBaseService.EMBED_CHUNK_SIZE` 참조로 통일.
4. **[WARNING #10 — SPEC-DRIFT]** `spec/3-workflow-editor/5-version-history.md` §7.1 응답 설명을 `WorkflowVersionListItemDto`(snapshot 제외 명시) + §7.2 상세 조회 대비 구조로 갱신. (코드 revert 불가, spec 갱신이 정답)
5. **[WARNING #11 — 문서/Side Effect]** `codebase/frontend`에서 workflow-version 목록 응답의 `snapshot` 필드 접근 코드 검색, 영향 없음 확인 또는 타입 업데이트.
6. **[WARNING #7 — 테스트]** `knowledge-base.service.spec.ts`에 2 chunk 중 1번째 실패 + 2번째 정상 케이스 추가(enqueueEmbedChunked 계속 처리 계약 검증).
7. **[WARNING #8 — 테스트]** `integration-expiry-scanner.service.spec.ts` 페이징 테스트에 만료 임박 integration을 포함한 배치 경계 idempotency 테스트 추가.
8. **[WARNING #6 — 테스트]** `execution-engine.service.spec.ts`에 `PENDING → RUNNING` 동시 선점 케이스 + `query()` reject 케이스 추가.
9. **[WARNING #1/#2 — 아키텍처]** `ExecutionRepository` 커스텀 클래스 도입(raw SQL을 data 레이어로 격리). 기능에는 문제 없으나 향후 리팩터 시 회귀 진원지. 후속 작업으로 계획.
10. **[WARNING #3 — 아키텍처]** `enqueueEmbedChunked` SRP 분리 — 큐 적재와 DB 보상을 분리. 후속 작업으로 계획.
11. **[INFO #5/#6 — 데이터베이스]** `integration` 테이블의 `(status, tokenExpiresAt)`, `workspace_member`의 `(workspace_id, role)` 인덱스 존재 여부를 `EXPLAIN`으로 확인.

---

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행**: `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `database`, `concurrency` (11명)
- **강제 포함 (router_safety)**: `database`, `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (8명)
- **제외**: 3명

| 제외된 reviewer | 이유 |
|------------------|------|
| dependency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |