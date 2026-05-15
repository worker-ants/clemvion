### 발견사항

- **[WARNING]** `useBackgroundRun` 의 `useEffect` deps 배열에 `executionId` 누락
  - 위치: `frontend/src/lib/websocket/use-background-run.ts:102`
  - 상세: `// eslint-disable-next-line react-hooks/exhaustive-deps` 로 경고를 억제하면서 `[backgroundRunId]` 만 deps 로 선언. `handler` 클로저는 `queryKey = [QUERY_KEY, executionId, backgroundRunId]` 를 캡처하는데, `executionId` 가 바뀌어도 effect 가 재실행되지 않으므로 WS 이벤트 수신 시 **구 `executionId` 로** `invalidateQueries` 를 호출한다. UUID v4 의 전역 유일성 덕분에 실제 충돌 확률은 거의 0이지만, 같은 `backgroundRunId` 가 다른 `executionId` 의 컨텍스트에서 재조회되는 엣지 케이스에서 캐시 무효화 대상이 잘못된다.
  - 제안: `}, [backgroundRunId, executionId, queryClient]);` 로 deps 를 완성하거나, `queryKey` 를 `useMemo` 로 도출해 deps 에 포함.

- **[WARNING]** `fetchBodyPage` + `aggregateBodyStatus` 간 트랜잭션 부재
  - 위치: `backend/.../background-runs.service.ts:getBackgroundRun()`
  - 상세: 두 쿼리는 별도 DB 왕복으로 실행된다. 첫 번째 페이지 쿼리 이후 두 번째 집계 쿼리 사이에 body NodeExecution 의 상태가 전이되면, `data[].status` 와 응답의 `status('running'/'completed')` 가 순간적으로 불일치할 수 있다. 읽기 전용 모니터링 API 이므로 데이터 손상 위험은 없으나, 클라이언트가 두 필드를 동시에 렌더링할 때 미세한 시각적 불일치가 발생한다.
  - 제안: `READ COMMITTED` 수준 내에서 허용 가능한 수준이라 판단되면 주석으로 명시. 엄격한 일관성이 필요하다면 두 쿼리를 `READ COMMITTED` Snapshot 트랜잭션 안에 묶을 것.

- **[INFO]** `emitRunStarted` 가 `executeBackgroundSubgraph` 보다 먼저 emit
  - 위치: `backend/.../background-execution.processor.ts:48-52`
  - 상세: WS 로 `BACKGROUND_RUN_STARTED` 를 보낸 직후 본문 실행을 시작한다. 클라이언트가 이벤트를 받고 즉시 REST GET 을 폴링하면, body NodeExecution 이 아직 생성되지 않아 `status: 'pending'` + `nodeExecutions.data: []` 를 받는다. 5초 polling fallback 이 있으므로 실용상 문제없으나, 짧은 시간 창에서 WS 이벤트와 REST 응답이 불일치한다.
  - 제안: 현재 설계(fire-and-forget 의도)로 수용 가능하면 그대로 유지. 엄격한 happens-before 보장이 필요하면 `executeBackgroundSubgraph` 첫 NodeExecution INSERT 시점으로 started emit 을 지연할 것.

- **[INFO]** `forwardRef` 순환 주입 + NestJS 초기화 경쟁
  - 위치: `background-execution.processor.ts:37`, `websocket.gateway.ts:59`
  - 상세: `@Inject(forwardRef(() => WebsocketService))` / `@Inject(forwardRef(() => BackgroundRunsService))` 가 모두 circular dependency 해소를 런타임에 위임한다. NestJS IoC 는 lazy proxy 로 처리하지만, 서비스 초기화 순서에 따라 애플리케이션 시작 단계에서 proxy 미해소 상태로 메서드를 호출하면 런타임 오류가 발생할 수 있다. BullMQ worker 가 컨테이너 완전 초기화 전에 첫 job 을 처리하면 위험하다.
  - 제안: 실제 발생 가능성은 낮지만, `onApplicationBootstrap()` 훅이나 `onModuleInit()` 을 통해 초기화 완료 후 worker 를 시작하는 구조로 보강할 것.

---

### 요약

변경 코드의 동시성 설계는 전반적으로 안전하다. DB 인덱스 생성에 `CONCURRENTLY + executeInTransaction=false` 를 올바르게 조합했고, BullMQ 잡은 잡 단위로 격리되어 공유 뮤터블 상태를 사용하지 않는다. `useBackgroundRun` 훅의 `cancelled` 플래그 패턴은 단일 스레드 JS 이벤트 루프를 전제로 하면 cleanup race 를 충분히 막는다. 주요 위험은 두 쿼리 간 트랜잭션 부재로 인한 순간적 읽기 불일치, 그리고 `executionId` 가 `useEffect` deps 에서 빠져 캐시 무효화가 구 키를 참조할 수 있다는 논리 결함이다. 두 항목 모두 데이터 손상이나 교착상태를 유발하지 않으며, WS polling fallback(5s) 이 대부분의 불일치를 자동 복구하므로 실사용 영향은 제한적이다.

### 위험도

LOW