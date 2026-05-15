# Side-Effect Review — Background 본문 모니터링 API
Branch: `claude/bg-monitoring-api-7c2a91` (4 commits ahead of main)

---

## 발견사항

---

### [WARNING] BullMQ 재시도 시 WS 이벤트 중복 발행
- **위치**: `backend/src/modules/execution-engine/queues/background-execution.processor.ts:52–70`
- **상세**: `process()` 진입 직후 `emitRunStarted()` 를 호출하고, catch 에서 `emitRunCompleted('failed')` 를 발행한 뒤 에러를 re-throw 한다. BullMQ 기본 정책에서 `registerQueue` 에 `attempts` 옵션이 없어(무제한 기본값이 아닌 1로 처리됨) 현재는 재시도가 사실상 발생하지 않지만, 누군가 `attempts: N`을 추가하면 한 번의 `backgroundRunId` 에 대해 `STARTED` 이벤트가 N번, `COMPLETED(failed)` 가 N-1+1번 발행된다. 프론트엔드 `use-background-run.ts` 의 `handler` 는 수신마다 `invalidateQueries` 를 호출하므로 UI 과부하는 미미하지만, 이벤트 수신자가 "시작됨" 을 멱등하게 처리하지 않는 외부 훅이 있을 경우 부작용이 생길 수 있다.
- **제안**: `emitRunStarted` 에 `job.attemptsMade === 0` 조건을 추가하거나, 큐 등록 시 `attempts: 1` 을 명시적으로 고정해 의도를 코드로 선언한다.

---

### [WARNING] `background:run:` 채널 guard — 비인증 소켓의 workspaceId 빈 문자열 처리
- **위치**: `backend/src/modules/websocket/websocket.gateway.ts:165–181`
- **상세**: `verifyBackgroundRunOwnership(backgroundRunId, workspaceId)` 를 호출할 때 `workspaceId = enriched.workspaceId ?? ''` 를 사용한다. `handleConnection` 에서 JWT 파싱 실패 시 소켓이 `disconnect()` 되므로 정상 경로에서는 `workspaceId` 가 항상 존재한다. 그러나 `clientSubs` 가 `this.subscriptions.get(client.id)` 에 있음을 이미 확인한(128~133) 후에도 `workspaceId` 는 별도로 검증되지 않는다. `subscriptions` 맵은 `handleConnection` 이후에만 생성되므로 실질적으로 unauthenticated 소켓은 도달하지 못하지만, workspaceId = '' 로 verifyBackgroundRunOwnership 가 호출되면 서비스 내부에서 `!userWorkspaceId` 로 false 반환(보안상 안전)한다는 점이 명시적이지 않아 코드 독자에게 잠재적 오해를 남긴다.
- **제안**: kb 채널 guard 패턴에 이미 같은 구조가 있어 동작은 안전하나, 두 guard 모두 `if (!workspaceId) return { event: 'subscribed', data: { success: false, error: 'Not authenticated' } }` 를 명시적으로 추가해 의도를 명확히 한다.

---

### [WARNING] `BackgroundExecutionJob.backgroundRunId` 필드 추가 — 인-플라이트 큐 메시지 호환성
- **위치**: `backend/src/modules/execution-engine/queues/background-execution.queue.ts:20–26`
- **상세**: BullMQ 는 enqueue 시점에 직렬화된 JSON 을 Redis 에 저장한다. 배포 순간 이미 Redis 에 적재된 구 버전 메시지(`backgroundRunId` 필드 없음)를 새 processor 가 역직렬화하면 `data.backgroundRunId` 가 `undefined` 가 된다. 코드 내 처리는 `if (!data.backgroundRunId) return;` (emitRunStarted, emitRunCompleted) 및 `!!data.backgroundRunId` (dispatchFailureNotification) 로 방어돼 있어 **기능 회귀는 없다**. 다만 배포 롤링 중 큐에 구 메시지가 남아 있는 구간에는 WS 이벤트와 `background_run` attribution 없이 처리된다 — 의도된 fallback 이지만 명시적 모니터링이 없다.
- **제안**: 방어 코드는 적절하나, 배포 runbook 에 "구 메시지 소진까지 WS 이벤트 유실 가능" 을 명시해 운영팀 인지를 확보한다. 코드 수준에서는 현재 구현으로 충분.

---

### [WARNING] `resourceType='background_run'` — 기존 in_app 알림 패널 미지원
- **위치**: `frontend/src/components/layout/sidebar.tsx:340–353` / `backend/src/modules/execution-engine/queues/background-execution.processor.ts:123`
- **상세**: 사이드바 알림 패널은 `title` / `message` / `isRead` 만 렌더링하며 `resourceType` 나 `resourceId` 를 링크·필터에 사용하지 않는다. 따라서 `resourceType='background_run'` 알림은 패널에 정상 표시된다. 그러나 향후 알림 클릭 시 해당 리소스로 이동하는 기능이 추가될 경우, 기존 `resourceType='execution'` 에 대한 라우팅 로직이 `background_run` 을 인식하지 못해 dead link 가 발생할 수 있다.
- **제안**: 현재는 기능 회귀 없음. 향후 클릭 네비게이션 구현 시 `background_run` resourceType 라우팅을 함께 추가해야 한다는 TODO 를 해당 파일에 주석으로 남긴다.

---

### [WARNING] `verifyBackgroundRunOwnership` — DB 쿼리 시 execution_id 필터 누락
- **위치**: `backend/src/modules/executions/background-runs/background-runs.service.ts:65–84`
- **상세**: `verifyBackgroundRunOwnership` 의 쿼리는 `ne.output_data #>> '{meta,backgroundRunId}' = :backgroundRunId` 만으로 NodeExecution 을 찾고, JOIN 으로 workspace 를 확인한다. `backgroundRunId` 는 UUID v4 이므로 충돌 확률은 극히 낮지만, `executionId` 필터가 없다. `findBackgroundNodeExecution` 에는 `executionId` 필터가 있어 실제 API endpoint 경로에서는 IDOR 차단이 이중으로 적용되나, WS guard 경로(`verifyBackgroundRunOwnership`)는 `executionId` 정보가 없으므로 이 구분이 의도적인지 확인이 필요하다. WS subscribe 시점에 클라이언트는 backgroundRunId 만 전달하기 때문에 executionId 를 추가하는 것은 오버스펙이나, 문서화는 필요하다.
- **제안**: 메서드 JSDoc 에 "executionId 없이 workspaceId 단독 검증" 임을 명시한다.

---

### [INFO] `Notification` Repository — `NotificationsModule` 과 이중 `forFeature` 등록
- **위치**: `backend/src/modules/executions/executions.module.ts:21–26`
- **상세**: `Notification` 엔티티가 `NotificationsModule` 과 `ExecutionsModule` 양쪽에서 `TypeOrmModule.forFeature` 로 등록된다. NestJS + TypeORM 에서 모듈별 Repository token 은 독립적으로 생성되므로 데이터 정합성 문제는 없다. 기존 주석에도 "이중 등록은 단순 token 공유" 라고 설명되어 있다. 다만 이 패턴은 DB 커넥션 풀을 공유하므로 실제 부작용은 없다.
- **제안**: 현재 구현으로 문제없음. 향후 `NotificationsService` 를 `ExecutionsModule` 에서 직접 import 하는 방식으로 리팩토링하면 entity 이중 등록을 줄일 수 있다.

---

### [INFO] `WebsocketModule` — `ExecutionsModule` 을 `forwardRef` import 하지만 역방향 의존 없음
- **위치**: `backend/src/modules/websocket/websocket.module.ts:23` / `backend/src/modules/executions/executions.module.ts`
- **상세**: `WebsocketModule` 이 `forwardRef(() => ExecutionsModule)` 로 `BackgroundRunsService` 를 사용하지만, `ExecutionsModule` 은 `WebsocketModule` 을 import 하지 않는다. 순환 의존이 아님에도 `forwardRef` 를 사용한 것은 과도한 설정이다. 그러나 `ExecutionEngineModule` → `WebsocketModule` → `ExecutionsModule` 의 전이적 경로에서 실질적 순환이 있는지 확인이 필요하다.
- **제안**: `ExecutionEngineModule` ↔ `WebsocketModule` 순환을 추적해 `forwardRef` 의 실제 필요 여부를 검증한다. 불필요하면 단순 `import` 로 전환해 초기화 순서 불확실성을 제거한다.

---

### [INFO] Migration V047 — `CONCURRENTLY` + WHERE 절 — 운영 트래픽 중 안전성
- **위치**: `backend/migrations/V047__node_execution_background_run_id_index.sql:17–19` / `backend/migrations/V047__node_execution_background_run_id_index.conf:3`
- **상세**: `CREATE INDEX CONCURRENTLY` 는 테이블 쓰기 락을 회피하고 행 단위 MVCC 스냅샷으로 빌드한다. `WHERE output_data #>> '{meta,backgroundRunId}' IS NOT NULL` 부분 인덱스이므로 기존 inserts 에 대한 인덱스 유지 비용은 Background 노드 NodeExecution 에만 발생한다. `executeInTransaction=false` 도 설정되어 있어 Flyway 트랜잭션 래핑 문제도 없다. 단, `CONCURRENTLY` 실행 중 두 번째 pass 에서 long-running transaction 이 있으면 해당 트랜잭션 종료를 대기하며 블로킹 없이 지연될 수 있다 — deadlock 은 발생하지 않음.
- **제안**: 현재 구현은 안전함. 운영 배포 시 `pg_stat_progress_create_index` 로 진행 상황을 모니터링하는 절차를 runbook 에 추가 권장.

---

### [INFO] `use-background-run.ts` — `queryKey` deps 배열에 `queryKey` 미포함 (eslint-disable)
- **위치**: `frontend/src/lib/websocket/use-background-run.ts:104`
- **상세**: `useEffect` deps 배열이 `[backgroundRunId]` 만 포함하고 `queryKey` 는 제외되어 있으며 `eslint-disable-next-line react-hooks/exhaustive-deps` 로 억제된다. `queryKey` 는 `[QUERY_KEY, executionId, backgroundRunId]` 로 구성되므로 `executionId` 변경 시 WS 채널이 갱신되지 않는다 — 단, `backgroundRunId` 는 execution 간 고유 UUID 이므로 실질적 버그 발생 경로는 없다.
- **제안**: `eslint-disable` 주석에 이유를 인라인으로 명시한다: "queryKey is derived from backgroundRunId which is already in deps; executionId change always accompanied by backgroundRunId change."

---

### [INFO] `BackgroundRunSection` — `backgroundRunId` null 체크 순서
- **위치**: `frontend/src/components/editor/run-results/background-run-section.tsx:36–40`
- **상세**: `useBackgroundRun(executionId, backgroundRunId)` 를 props 수신 즉시 호출한 뒤 `if (!backgroundRunId) return null` 을 한다. `useBackgroundRun` 내부에서 `queryEnabled = !!(executionId && backgroundRunId)` 로 가드하므로 실제 쿼리는 발생하지 않으나, 훅 호출 후 early return 은 React hooks 규칙상 허용되지 않는 조건부 early return 이 아니라 렌더 결과 조건부 반환이므로 규칙 위반은 아니다. 다만 코드 독자가 혼란스러울 수 있다.
- **제안**: `if (!backgroundRunId) return null` 을 컴포넌트 최상단(훅 호출 전)으로 이동하면 가독성이 향상된다. 단 React 는 조건부 훅 호출을 금지하므로 이 경우 상위 컴포넌트에서 `null` 처리를 해야 한다 — 현재 구조 그대로 두되 주석으로 의도를 명시하는 것이 더 현실적이다.

---

## 요약

전체적으로 부작용 격리 설계는 양호하다. `BackgroundExecutionJob` 의 `backgroundRunId` 신규 필드는 `''` fallback 처리가 일관되게 적용되어 인-플라이트 메시지와 레거시 행 호환성을 유지한다. WS 채널 `background:run:<id>` 에 대한 소유권 guard 는 `verifyBackgroundRunOwnership` 로 workspace 검증이 수행되어 채널 하이재킹을 차단한다. `BackgroundRunsService.getBackgroundRun` 은 순수 read 경로로 DB 외 외부 호출이 없다. 주요 리스크는 두 가지다: (1) BullMQ retry 가 활성화될 경우 WS `STARTED` 이벤트가 중복 발행될 수 있는 구조적 취약점, (2) `resourceType='background_run'` 알림이 기존 in_app 패널에서 클릭 네비게이션을 지원하지 않아 향후 기능 확장 시 누락될 수 있는 점. Migration V047 은 `CONCURRENTLY` + `executeInTransaction=false` 조합으로 운영 중 적용에 안전하다.

## 위험도

**LOW**
