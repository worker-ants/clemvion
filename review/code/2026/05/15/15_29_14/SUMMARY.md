파일 쓰기 권한이 필요합니다. 허용해 주시면 `review/2026-05-15_15-29-14/SUMMARY.md`에 저장하겠습니다.

권한 승인을 기다리는 동안 아래에 통합 보고서 전문을 출력합니다.

---

# Code Review 통합 보고서

> 리뷰 시각: 2026-05-15 | 브랜치: `claude/bg-monitoring-api-7c2a91`  
> 리뷰어: 13개 전문 에이전트

---

## 전체 위험도

**HIGH** — 삼각 순환 모듈 의존성이 런타임 DI 실패 가능성을 내포하고, WebSocket 채널 인가 분기·WS 서비스 신규 메서드의 테스트 공백이 보안 회귀를 방치하며, `ne.outputData` raw SQL 컬럼명 오류가 운영 환경에서 즉시 발현될 수 있다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| C-1 | Testing | `background:run:` 채널 인가 분기 전용 테스트 없음. ① 소유권 일치 → 구독 허용, ② 불일치 → `success: false`, ③ DB 오류 시 catch 경로 — 3케이스 모두 미검증. IDOR 가드가 회귀 보호 밖에 있음 | `websocket.gateway.spec.ts` | `kb:` 채널과 동일 패턴으로 3케이스 추가. `mockRejectedValue`로 catch 경로 커버 |
| C-2 | Testing | `WebsocketService.emitBackgroundRunEvent` 단위 테스트 없음. 빈 `backgroundRunId` 조기 반환, `sanitizePayloadForWs`, `background:run:<id>` 채널 라우팅 등 독립 검증 필요 로직이 processor mock으로만 호출 여부만 확인 | `websocket.service.ts` (스펙 파일 미존재) | `websocket.service.spec.ts`에 `emitBackgroundRunEvent` describe 추가. `gateway.broadcastToChannel` spy로 채널명·sanitized payload 검증 |
| C-3 | Database | `findBackgroundNodeExecution`의 raw SQL에서 TypeScript 프로퍼티명(`ne.outputData`) 사용. `ne.output_data`(실제 컬럼)와 불일치. mock 기반 단위 테스트에서 잡히지 않고 운영에서 `column "outputData" does not exist` 오류로 발현 가능 | `background-runs.service.ts` — `findBackgroundNodeExecution`, JSONB `#>>` 표현식 | `"ne.outputData #>> ..."` → `"ne.output_data #>> ..."` 수정 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | Architecture/Dependency | **삼각 순환 모듈 의존성**: `ExecutionEngineModule → WebsocketModule → ExecutionsModule → ExecutionEngineModule`. 프로바이더 레벨 `forwardRef`만으로는 NestJS 모듈 그래프 순환을 해결하지 못함. `ExecutionEngineModule` imports에 `forwardRef(() => WebsocketModule)` 누락 여부 즉시 확인 필요 | `background-execution.processor.ts:36–37`, `websocket.gateway.ts:59`, `executions.module.ts` | 단기: 모듈 imports `forwardRef` 확인. 근본 해결: EventEmitter2/NestJS EventBus pub-sub으로 의존성 역전 |
| W-2 | Requirement/API Contract | **역할 기반 인가 미구현**: spec §8.4는 "Editor 이상 멤버 또는 실행 시작자"만 조회 가능하나, `verifyExecutionAccess`·`verifyBackgroundRunOwnership` 모두 워크스페이스 소속 여부만 확인. Viewer 멤버도 HTTP API·WS 채널 구독 허용 | `background-runs.service.ts` — `verifyExecutionAccess()`, `verifyBackgroundRunOwnership()` | 기존 RBAC 가드 패턴 참고해 `member.role >= Editor \|\| execution.executedBy === userId` 조건 추가 또는 spec §8.4 공식 변경 |
| W-3 | Side Effect | **`emitRunStarted`가 try 블록 외부에 위치**: WS 레이어 오류 발생 시 서브그래프 실행 전 BullMQ 잡이 실패 처리됨 | `background-execution.processor.ts:48–49` | try 블록 안으로 이동하거나 `try { } catch {}` 로 WS 오류 격리 |
| W-4 | Side Effect | **catch 내 `emitRunCompleted` throw 시 알림 미발송**: `emitRunCompleted`가 throw하면 `dispatchFailureNotification`이 실행되지 않고 원래 에러가 교체됨 | `background-execution.processor.ts:58–66` | `emitRunCompleted`를 `try { } catch {}` 로 감싸거나 finally로 이동 |
| W-5 | Performance/Database | **`parent_node_execution_id` 복합 인덱스 부재 가능성**: V047은 JSONB expression 인덱스만 추가. `fetchBodyPage`·`aggregateBodyStatus`의 `WHERE ne.parentNodeExecutionId + ORDER BY startedAt, id` 조합에 인덱스 없으면 Sequential Scan | V047 마이그레이션, `background-runs.service.ts` | 기존 마이그레이션에서 인덱스 존재 확인. 미존재 시 V048로 `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ne_parent_started_id ON node_execution (parent_node_execution_id, started_at, id)` |
| W-6 | Security | **WebSocket 채널 ID UUID 형식 미검증**: `channel.slice('background:run:'.length)` 이후 임의 문자열이 그대로 DB 쿼리로 전달. `!backgroundRunId` 가드는 빈 문자열만 처리 | `websocket.gateway.ts:159` | UUID 정규식 검증: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i` |
| W-7 | Security | **내부 예외 메시지 직접 노출**: `err.message`가 WS 페이로드(`errorMessage`)와 인앱 알림 본문에 그대로 포함. DB 에러·내부 경로 등 노출 가능 | `background-execution.processor.ts:75` | 최대 256자 truncate, `QueryFailedError` generic 치환. `sanitizePayloadForWs`에 `errorMessage` 처리 추가 |
| W-8 | API Contract | **알림 `resourceType` 변경 — silent breaking change**: `'execution'` → `'background_run'`. 기존 소비자·레거시 알림이 `fetchNotifications` 조회에서도 누락됨 | `background-execution.processor.ts` — `dispatchFailureNotification()` | 레거시 attribution OR 조건 조회 또는 CHANGELOG 명시적 breaking change 표기 |
| W-9 | API Contract/Side Effect | **`BackgroundExecutionJob.backgroundRunId` 타입 vs 런타임 불일치**: `string` (required)으로 선언되어 있으나 기존 큐 적재 잡은 필드 없어 런타임 `undefined` | `background-execution.queue.ts:17` | `backgroundRunId?: string` 또는 `string \| undefined`로 수정 |
| W-10 | Architecture/Concurrency/Side Effect/Requirement | **`useEffect` deps에서 `executionId` 누락 — stale closure**: `queryKey = [QUERY_KEY, executionId, backgroundRunId]` 캡처하지만 deps는 `[backgroundRunId]`만. `executionId` 변경 시 구 키로 `invalidateQueries` 호출 | `use-background-run.ts:97–103` | deps를 `[backgroundRunId, executionId, queryClient]`로 완성하거나 `queryKey`를 `useMemo`로 안정화 |
| W-11 | Documentation/Scope/API Contract/Maintainability/Requirement | **Cursor 페이로드 명세 3중 불일치**: DTO JSDoc은 `{lastCreatedAt, lastId}`, ApiProperty example은 `{createdAt, id}`, spec §8.3은 `createdAt ASC` 정렬 — 실제 구현은 `{s: startedAt, i: id}` + `startedAt ASC` | `query-background-run.dto.ts:7–9`, `spec/4-nodes/1-logic/12-background.md §8.3` | 3곳 모두 `{s: startedAt ISO8601, i: NodeExecution.id}` / `startedAt ASC`로 일괄 수정 |
| W-12 | API Contract/Architecture/Documentation/Maintainability/Testing/Requirement | **`cancelled` 상태 dead code**: 타입·Swagger enum·spec §8.2에 정의됐으나 `deriveBackgroundRunStatus()`는 절대 반환 안 함. `maxDurationMs` 타임아웃 로직도 미구현 | `background-run-response.dto.ts:6`, `background-runs.service.ts:deriveBackgroundRunStatus` | 현 PR 범위 밖이면 타입·enum·spec에서 제거 후 별도 이슈 추적 |
| W-13 | Architecture | **WebSocket 게이트웨이 OCP 위반**: 채널마다 `if (channel.startsWith(...))` 분기 선형 증가. 새 채널 타입마다 게이트웨이 수정 필요 | `websocket.gateway.ts` — subscribe 핸들러 | `ChannelAuthorizationStrategy` 인터페이스 맵 도입 |
| W-14 | Architecture/Maintainability | **`aggregateBodyStatus` SQL 상태 하드코딩**: `'pending'`, `'running'` 등이 `NodeExecutionStatus` enum과 독립적으로 SQL 내 하드코딩 | `background-runs.service.ts:295–310` | enum 값 참조 패턴으로 교체 |
| W-15 | Dependency | **`Notification` 엔티티 이중 `forFeature` 등록**: `NotificationsModule`과 `ExecutionsModule` 양쪽 등록. `NotificationsService` 비즈니스 로직 우회 | `executions.module.ts:21` | `NotificationsService.findByResourceId()` 추가 후 위임 |
| W-16 | Dependency | **`BackgroundRunsService` 과도한 public export**: WS 채널 권한 검증만을 위해 서비스 전체 노출 | `executions.module.ts:32` | 권한 검증 인터페이스만 분리하거나 NestJS Guard로 이동 |
| W-17 | Performance | **독립 쿼리 3건 순차 실행**: `fetchBodyPage`, `aggregateBodyStatus`, `fetchNotifications`가 순차 실행되어 DB 왕복 5회 발생 | `background-runs.service.ts:getBackgroundRun()` | `Promise.all([...])` 병렬화 |
| W-18 | Testing | **`backgroundRunId` 추출 엣지 케이스 미커버**: `outputData: null`, `meta` 없는 경우, 비정상 타입 등 미검증 | `execution-engine.service.spec.ts` | 케이스별 테스트 추가 |
| W-19 | Testing | **`extractBackgroundRunId` 순수 함수 테스트 없음**: 여러 null/타입 분기 미검증 | `result-detail.tsx` (신규 함수) | `result-detail.test.tsx`에 케이스별 검증 추가 |
| W-20 | Testing | **`useBackgroundRun` WS 구독 수명주기 미검증**: subscribe/unsubscribe/connect 경로, cleanup `cancelled` 플래그 untested | `use-background-run.ts` | hook 전용 테스트 추가 |
| W-21 | Testing | **`deriveBackgroundRunStatus` `waiting > 0` 케이스 미검증** | `background-runs.service.spec.ts` | `waiting > 0` aggregate 케이스 추가 |
| W-22 | Side Effect | **Legacy Background 노드에서 빈 `<div>` 렌더링**: `backgroundRunId === null` 시 `BackgroundRunSection`이 null 반환하지만 컨테이너 `<div>` + 구분선은 남음 | `result-detail.tsx:1075–1083` | 외부 조건에 `extractBackgroundRunId(result.outputData)` null 체크 추가 |
| W-23 | Maintainability | **`backgroundRunId: string` 빈 문자열로 "없음" 표현**: `if (!data.backgroundRunId)` 가드가 4–5곳 분산 | `background-execution.queue.ts`, `execution-engine.service.ts:3695–3703` | `string \| null`로 변경하여 TypeScript가 null 체크 강제 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | Performance/Maintainability | `useMemo(() => nodes, [nodes])` — 실질 변환 없는 no-op 메모이제이션. `sorted` 변수명 오해 유발 | `background-run-section.tsx:NodeExecutionsList` | `const sorted = nodes;` 단순화 |
| I-2 | Scope/Maintainability | `export { NodeExecutionStatus };` 테스트 편의용 re-export로 서비스 API 표면 확장 | `background-runs.service.ts:402` | re-export 제거 |
| I-3 | Security | Cursor 토큰 HMAC 서명 없음. 접근 범위를 벗어나지 않아 즉각적 위협 낮음 | `background-runs.service.ts` — `decodeCursor/encodeCursor` | 필요 시 HMAC-SHA256 서명 추가 |
| I-4 | Security | `console.warn` ack 객체 전체가 프로덕션 브라우저 콘솔에 노출 | `use-background-run.ts:82` | `NODE_ENV === 'development'` 조건부 출력 |
| I-5 | Security | 이중 에러 코드로 execution 존재 여부 추론 가능. UUID 특성상 실효성 낮음 | `background-runs.service.ts` | 강화 필요 시 에러코드 통일 |
| I-6 | Concurrency | `emitRunStarted`가 body NodeExecution INSERT 전 emit. 5초 polling fallback으로 자동 복구됨 | `background-execution.processor.ts:48–52` | 엄격한 happens-before 필요 시 첫 INSERT 시점으로 emit 지연 |
| I-7 | Concurrency | BullMQ worker가 컨테이너 완전 초기화 전 첫 job 처리 시 runtime 오류 가능성 | `background-execution.processor.ts:37` | `onApplicationBootstrap()` 훅으로 초기화 완료 후 worker 시작 |
| I-8 | Database | `CREATE INDEX CONCURRENTLY` 실패 시 INVALID 인덱스 잔류. `IF NOT EXISTS`가 INVALID도 존재로 판단 | `V047__node_execution_background_run_id_index.sql` | 배포 후 `pg_index.indisvalid` 확인 절차를 체크리스트에 추가 |
| I-9 | Database/Architecture | `verifyBackgroundRunOwnership` raw 테이블명 조인 — 같은 서비스 내 패턴 혼용 | `background-runs.service.ts:64–72` | TypeORM 엔티티 참조 방식으로 통일 |
| I-10 | Database | `getBackgroundRun` 5개 쿼리 무트랜잭션. 읽기 전용이므로 데이터 손상 없으나 미세 불일치 가능 | `background-runs.service.ts:getBackgroundRun()` | 모니터링 API 특성상 허용 범위 내 |
| I-11 | Documentation | `getBackgroundRun` 핵심 공개 메서드 JSDoc 부재 | `background-runs.service.ts:92` | brief JSDoc 추가 |
| I-12 | Documentation | `eslint-disable` 사유 미문서화. 의도적 안정화인지 불명확 | `use-background-run.ts:97` | 의도 설명 주석 추가 |
| I-13 | Documentation | `.mdx` 내 `/spec/...` 경로 링크 dead link 가능성 | `logic.en.mdx:418`, `logic.mdx` | docs 라우팅 컨벤션으로 경로 검증 또는 링크 제거 |
| I-14 | Architecture | 소유권 검증 로직 중복 (`ExecutionsService`와 동일 의미) | `background-runs.service.ts:171–183` | 중기: 공통 `AuthorizationService` 추출 |
| I-15 | API Contract | spec §8.7 403 명세 vs 구현 일관 404 불일치. 구현 주석은 IDOR 차단 의도 명시 | spec `12-background.md §8.7` | spec §8.7에서 403 제거하고 "모든 권한 실패 → 404 (IDOR 차단)" 명시 |
| I-16 | Maintainability | `parentNodeExecutionId ?? ''` 빈 문자열 fallback — 이 API에서 null은 논리적으로 발생 불가 | `background-runs.service.ts:261` | `string \| null` 유지하거나 null 시 early throw |
| I-17 | Scope | `plan/in-progress/background-monitoring-api.md` § 1 체크박스 모두 `[ ]`로 미갱신 | `plan/in-progress/background-monitoring-api.md` | 구현 완료된 항목 `[x]`로 갱신 |
| I-18 | Performance | `fetchBodyPage` `.getMany()`로 전체 엔티티(JSONB 3컬럼) 로딩 | `background-runs.service.ts:fetchBodyPage()` | `.select([...필요한 컬럼만])` 선택적 로딩 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Dependency | HIGH | 삼각 순환 모듈 의존성 |
| Testing | HIGH | WebSocket 채널 인가 분기·`emitBackgroundRunEvent` 테스트 없음 |
| Architecture | MEDIUM | `forwardRef` 순환, WebSocket OCP 위반, raw 테이블명 혼용 |
| Performance | MEDIUM | `parentNodeExecutionId` 인덱스 부재 가능성, 순차 쿼리 |
| Documentation | MEDIUM | cursor 페이로드 3중 명세 불일치 |
| API Contract | MEDIUM | `resourceType` breaking change, `cancelled` dead enum, 역할 인가 미구현 |
| Requirement | MEDIUM | Editor+ 인가 미집행, 정렬 키 불일치 |
| Database | MEDIUM | `ne.outputData` raw SQL 컬럼명 오류 (운영 직접 영향) |
| Security | LOW | 예외 메시지 노출, UUID 형식 미검증 |
| Concurrency | LOW | `useEffect` deps 누락, 쿼리 트랜잭션 부재 |
| Scope | LOW | `cancelled` 미생성 경로, plan 문서 미갱신 |
| Side Effect | LOW | `emitRunStarted` try 외부 (MEDIUM 운영 리스크 내포) |
| Maintainability | LOW | `useMemo` 오용, enum 하드코딩 SQL, 빈 문자열 "없음" 패턴 |

---

## 발견 없는 에이전트

없음 — 모든 13개 에이전트가 개선 사항을 발견했음.

---

## 권장 조치사항

**즉시 처리 (Blocker)**

1. **[C-3]** `ne.outputData` → `ne.output_data` 수정 — 운영 배포 즉시 `column does not exist` 오류
2. **[W-1]** `ExecutionEngineModule` imports에 `forwardRef(() => WebsocketModule)` 누락 여부 확인
3. **[W-3, W-4]** `emitRunStarted` / `emitRunCompleted` WS 오류 격리 (try 블록 내 이동 또는 catch 감싸기)

**단기 처리 (이번 PR 또는 바로 다음 PR)**

4. **[C-1, C-2]** `background:run:` 채널 인가 3케이스 + `emitBackgroundRunEvent` 단위 테스트 추가
5. **[W-2]** Editor+ 역할 기반 인가 구현 또는 spec §8.4 공식 변경
6. **[W-5]** `parent_node_execution_id` 복합 인덱스 존재 확인 및 V048 추가
7. **[W-6]** WebSocket 채널 UUID 형식 검증 추가
8. **[W-11]** Cursor 명세 3중 불일치 DTO JSDoc·example·spec §8.3 일괄 수정
9. **[W-12]** `cancelled` 상태 타입·enum·spec에서 제거 또는 구현 완성 결정
10. **[W-17]** 독립 쿼리 `Promise.all` 병렬화
11. **[W-22]** Legacy background 노드 빈 `<div>` 조건 수정

**중기 처리 (기술 부채)**

12. **[W-1]** EventEmitter2 pub-sub으로 순환 의존성 근본 해결
13. **[W-13]** WebSocket 채널 인가 전략 패턴화 (OCP)
14. **[W-14]** `aggregateBodyStatus` SQL 상태 → enum 참조로 교체
15. **[W-15]** `Notification` 리포지토리 이중 등록 해소
16. **[W-23]** `backgroundRunId` 타입 `string | null`로 정비
17. **[I-17]** `plan/in-progress/background-monitoring-api.md` 체크박스 갱신