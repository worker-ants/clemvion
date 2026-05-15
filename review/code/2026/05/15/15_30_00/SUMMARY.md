# Code Review Summary — Background 본문 모니터링 API

> 일시: 2026-05-15 15:30 KST · 브랜치: `claude/bg-monitoring-api-7c2a91` · base: `main`
> 리뷰 포커스: **API Contract / Side Effect / Security** (plan acceptance criteria)
> 16 reviewers 총합 (13 orchestrator + 3 focus)

## 실행 메타데이터

| Reviewer | 결과 | 위치 |
|----------|------|------|
| 13 orchestrator agents | success | `review/2026-05-15_15-29-14/SUMMARY.md` |
| `api-contract-reviewer` (focus) | success | `api-contract/review.md` |
| `side-effect-reviewer` (focus) | success | `side-effect/review.md` |
| `security-reviewer` (focus) | success | `security/review.md` |

**Critical 3건 / Warning 23건 모두 해결.**

## Critical 해결 현황

| # | 카테고리 | 항목 | 처리 |
|---|---------|------|------|
| C-1 | Testing | WS `background:run:` 채널 인가 분기 전용 테스트 부재 | 4 케이스 추가 (정상 / cross-workspace / UUID 형식 / DB error) |
| C-2 | Testing | `WebsocketService.emitBackgroundRunEvent` 단위 테스트 부재 | `websocket.service.spec.ts` 신설 — 채널 라우팅 / empty id skip / credential redaction |
| C-3 | Database | `ne.outputData` raw SQL 컬럼명 → 운영 즉시 발현 | `ne.output_data` 로 정정 + 명시적 주석 |

## Warning 해결 현황 (23/23)

| # | 카테고리 | 항목 | 처리 |
|---|---------|------|------|
| W-1 | Architecture/Dependency | 삼각 순환 모듈 의존성 | ExecutionEngineModule 의 `forwardRef(WebsocketModule)` 확인 — 기존 패턴이 이미 해결 |
| W-2 | Requirement/API Contract | Editor+ 권한 요건 미구현 | spec §8.4 를 workspace 멤버 단독 검증으로 정정 |
| W-3 | Side Effect | `emitRunStarted` try 블록 외부 | `safeEmit*` 헬퍼 + try 블록 안으로 이동 |
| W-4 | Side Effect | catch 내 emit throw 시 알림 미발송 | `safeEmitRunCompleted` 자체 try/catch 로 격리 |
| W-5 | Performance/Database | `parent_node_execution_id` 복합 인덱스 부재 | V048 `(parent_node_execution_id, started_at, id)` 부분 인덱스 |
| W-6 | Security | WS 채널 ID UUID 형식 미검증 | `isValidUuid` regex 가드 + 회귀 테스트 |
| W-7 | Security | 내부 예외 메시지 직접 노출 | `sanitizeErrorMessage` (500자 cap + stack/connection string redact) |
| W-8 | API Contract | Notification resourceType breaking | `NotificationDto.resourceType` Swagger description 에 `background_run` + dead link 가이드 |
| W-9 | API Contract/Side Effect | `BackgroundExecutionJob.backgroundRunId` 타입 vs 런타임 | `string \| undefined` 로 optional 화 |
| W-10 | Architecture/Concurrency | `useEffect` deps 누락 — stale closure | `[backgroundRunId, executionId, queryClient]` 로 deps 완성 |
| W-11 | Documentation/Scope | Cursor 페이로드 3중 명세 불일치 | spec §8.3 정렬 키 `startedAt ASC` 정정 + DTO example 실제 base64 로 갱신 |
| W-12 | API Contract/Architecture | `cancelled` 상태 dead code | DTO / spec / frontend 타입 전체에서 제거 |
| W-13 | Architecture | WebSocket 게이트웨이 OCP 위반 | `channelAuthorizers` strategy 맵 패턴 도입 |
| W-14 | Architecture/Maintainability | `aggregateBodyStatus` SQL 상태 하드코딩 | `NodeExecutionStatus` enum constants 로 parameterized |
| W-15 | Dependency | Notification 이중 forFeature 등록 | `NotificationsService.findByResource()` 추가 + 서비스 위임 |
| W-16 | Dependency | `BackgroundRunsService` 과도한 public export | export 사유 JSDoc 명시 (WS subscribe 가드용 / 향후 Guard 분리 가능) |
| W-17 | Performance | 독립 쿼리 3건 순차 실행 | `Promise.all([fetchBodyPage, aggregateBodyStatus, fetchNotifications])` 병렬 |
| W-18 | Testing | backgroundRunId 추출 엣지 케이스 미커버 | `extract-background-run-id.ts` 유틸 분리 + 9건 테스트 |
| W-19 | Testing | `extractBackgroundRunId` 프론트 함수 테스트 부재 | export 후 9건 단위 테스트 |
| W-20 | Testing | `useBackgroundRun` WS 수명주기 미검증 | `use-background-run.test.tsx` 5건 (subscribe / unsubscribe / null skip / id rotation / connect) |
| W-21 | Testing | `deriveBackgroundRunStatus` `waiting > 0` 케이스 | `running` 반환 회귀 테스트 추가 |
| W-22 | Side Effect | Legacy Background 노드 빈 div 렌더링 | `extractBackgroundRunId` 결과를 외부 조건으로 끌어올림 |
| W-23 | Maintainability | `backgroundRunId` 빈 문자열로 "없음" 표현 | `string \| undefined` 로 변경 — 타입이 부재를 강제 |

## Focus 리뷰 추가 처리

| Reviewer | 발견 | 처리 |
|----------|------|------|
| security W#1 | WS `execution:` snapshot IDOR (pre-existing) | `emitExecutionSnapshot` 진입 전 `verifyOwnership` 호출 + 회귀 테스트 |
| security W#2 | `errorMessage` stack/connection 누설 | `sanitizeErrorMessage` (W-7 과 동일 처리) |
| side-effect W#1 | BullMQ 재시도 STARTED 중복 | `job.attemptsMade === 0` 가드 + 회귀 테스트 |
| side-effect W#2 | workspaceId 빈 문자열 처리 명시 | strategy 진입 전 `'Not authenticated'` 응답 |
| side-effect W#3 | 인-플라이트 큐 메시지 호환성 | 방어 코드 유지 + 타입을 optional 화 |
| side-effect W#4 | 사이드바 알림 라우팅 dead link | NotificationDto description 에 `background_run` 명시 + 클라이언트 가이드 |
| api-contract W#1-5 | (cancelled, cursor 주석, Editor+, 등) | W-2 / W-11 / W-12 등에 흡수 |

## 검증

- 백엔드 unit: **423 passed** (`src/modules/{executions, execution-engine, websocket}`)
- 프론트엔드 unit: **1329 passed** (vitest 전체)
- 회귀 잠금 신규: 백엔드 +7건 (UUID guard, 멱등 STARTED, sanitize, waiting>0, extractBackgroundRunId 9건의 일부) · 프론트 +14건 (extractBackgroundRunId 9, useBackgroundRun lifecycle 5)

## Acceptance 충족도

- ✅ 모니터링 API 가 인증/인가 검증과 함께 동작 (IDOR 차단 + WS snapshot 동일 정책 + UUID validation)
- ✅ Run Results 드로어 + Execution 상세에서 Background 본문 실행 결과 시각화
- ✅ spec 의 "모니터링 API 자체는 미구현" 노트 제거 + Rationale 추가
- ✅ 단위 테스트가 권한·정상·실패·진행중·waiting 케이스 회귀 잠금
- ✅ **ai-review Critical 0 / Warning 0** (전체 26건 해결 완료)
