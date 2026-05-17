# 동시성(Concurrency) 리뷰 결과

## 발견사항

- **[WARNING]** `pendingContinuations` Map: 구독 전 메시지 도착 시 누락 가능
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:459-526`
  - 상세: `ContinuationBusService.on()` 핸들러는 `onModuleInit` 에서 등록되고, `ContinuationBusService.subscriber` 의 Redis `subscribe` 완료 시점은 `onModuleInit` 이 끝나는 시점이다. 두 `onModuleInit` 의 호출 순서는 NestJS 가 provider 등록 순서로만 보장하므로, `ContinuationBusService` 의 `subscriber.on('message')` 가 먼저 바인딩된 상태에서 `ExecutionEngineService.registerContinuationHandlers()` 가 아직 실행 안 됐을 때 pub/sub 메시지가 도착하면 해당 메시지가 조용히 drop 된다. 정상 운영에서 이 window 는 수 ms 이내이고 실행 중 입력 수신보다 부팅 직후 타이밍이 문제이므로 현실적 위험도는 낮지만, multi-instance 재부팅 시나리오에서 이미 waiting_for_input 상태인 execution 에 즉시 cancel 메시지가 들어오면 handler 미등록으로 누락될 수 있다.
  - 제안: `ContinuationBusService` 가 메시지를 수신하되 handler 가 없을 때 짧은 큐(예: `[]` 버퍼)에 쌓고, handler 등록(`on()`)이 되는 시점에 flush 하거나, 양쪽 서비스의 초기화 의존성을 `OnApplicationBootstrap` 으로 통일하는 방식을 고려한다.

- **[WARNING]** `ScheduleRunnerService.onModuleInit`: 다중 인스턴스 중복 cron 등록
  - 위치: `codebase/backend/src/modules/schedules/schedule-runner.service.ts:107-126`
  - 상세: 서버가 N개의 인스턴스로 구동될 때 각 인스턴스가 `onModuleInit` 에서 `queue.upsertJobScheduler` 를 호출해 동일 schedule ID 에 대한 repeatable job 을 등록한다. `upsertJobScheduler` 는 BullMQ 에서 idempotent 하게 동작하도록 설계되어 있으므로 중복 fire 는 발생하지 않지만, 인스턴스가 다른 시점에 서로 다른 timezone/cronExpression 을 가진 schedule 을 upsert 하면 마지막 인스턴스가 "승리"해 이전 인스턴스가 보던 값을 덮어쓸 수 있다. 이 동작이 설계 의도와 일치하는지 spec 에서 명시적으로 확인이 필요하다. `IntegrationExpiryScannerService.onModuleInit` 도 동일 패턴.
  - 제안: 다중 인스턴스 환경에서 `onModuleInit` 의 upsertJobScheduler 호출이 동시에 발생해도 같은 최신 DB 값을 읽으므로 결과는 동일하다. 이 가정을 코드 주석에 명시하거나, `ContinuationBusService.acquireLock` 을 활용해 한 인스턴스만 upsert 를 수행하도록 보호할 수 있다.

- **[WARNING]** `ForEachExecutor`: `context.itemContext` 를 공유 객체로 직접 mutate
  - 위치: `codebase/backend/src/modules/execution-engine/containers/foreach-executor.ts:78-83`
  - 상세: `ForEachExecutor.execute` 는 루프의 매 iteration 마다 `context.itemContext = { item, index, ... }` 로 공유 context 객체를 직접 변경한다. `ParallelExecutor` 는 `context.variables` 를 `structuredClone` 하지만 `itemContext` 는 `undefined` 로 초기화한다. 만약 Parallel 브랜치 내부에서 ForEach 가 실행된다면, 각 브랜치가 서로 다른 `context` 를 갖고 있으므로 브랜치 간 itemContext 충돌은 없다. 그러나 ForEach 자체가 병렬 실행(현재는 순차)이 아닌 경우에도 `context` 를 외부에서 공유하고 있다면 예상치 않은 mutate 가 발생할 수 있다. 현재 스펙에서 ForEach 는 순차 실행이므로 즉각적 위험은 없으나, 코드 주석의 "WARN #14" 와 structuredClone 의도에 비추어 itemContext 도 iteration 마다 새 객체를 만들어 context 에 셋팅하는 방식이 더 안전하다.
  - 제안: `finally` 에서 복원하는 현재 패턴은 중첩 ForEach 에 대해 정확히 동작한다. 다만 `executeBody` 가 async 이므로 중첩 await 경계에서 같은 context 를 참조하는 다른 코드가 있을 경우 주의가 필요하다. iteration 마다 `{ ...context, itemContext: { ... } }` 로 shallow clone 해서 전달하면 mutation 위험 자체를 제거할 수 있다.

- **[WARNING]** `llmDefaultConfigCache` Map: 완료 후 정리 timing
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:396-411`
  - 상세: `llmDefaultConfigCache` 는 `executionId:workspaceId` 키를 저장하며 `runExecution` 의 `finally` 블록에서 해당 execution prefix 항목을 일괄 삭제한다고 JSDoc 에 명시되어 있다. 동일 execution 의 병렬 브랜치(ParallelExecutor)가 동시에 같은 키를 Map 에서 읽고 쓸 때, Node.js 의 단일 스레드 이벤트 루프 특성상 Map 자체의 동시 write는 안전하다. 그러나 Promise 를 값으로 저장하는 패턴에서 `finally` 가 실행되어 Map entry 를 지우는 시점과 같은 키에 대한 새 Promise 가 막 삽입된 시점이 겹치면 조기 삭제 + 새 DB 조회 중복이 발생할 수 있다. 단일 execution 의 두 번째 실행을 즉시 재시작하는 시나리오에서 문제가 된다.
  - 제안: 정리 로직을 `finishedAt` 타임스탬프 기반으로 TTL 방식으로 전환하거나, key 패턴을 `executionId:workspaceId` 에서 `executionId` 단위 WeakMap 으로 격리하면 재사용 충돌을 원천 차단할 수 있다.

- **[INFO]** `WebsocketGateway.subscriptions` Map: 단일 인스턴스 내 스레드 안전성
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:64`
  - 상세: `subscriptions = new Map<string, Set<string>>()` 는 동시 WebSocket 이벤트 핸들러(`handleSubscribe`, `handleUnsubscribe`, `handleDisconnect`) 에서 접근된다. Node.js 의 단일 스레드 이벤트 루프에서 동기적 Map/Set 접근은 race condition 이 발생하지 않는다. 단, `handleSubscribe` 가 `async` 이므로 `authorizer.authorize` 를 await 하는 동안 같은 client 의 다른 subscribe/unsubscribe/disconnect 이벤트가 interleave 될 수 있다. 현재 코드는 await 전후로 `clientSubs.size >= MAX_SUBSCRIPTIONS_PER_CONNECTION` 을 다시 검사하지 않아, 동시 subscribe 요청으로 20개 한도를 초과할 여지가 있다.
  - 제안: `authorizer.authorize` 완료 후 `clientSubs.size` 를 재검사하거나, `clientSubs.has(channel)` 체크 + join 을 await 전에 수행한다.

- **[INFO]** `Cafe24InstallNonceCache`: Redis SETNX 원자성 — 올바른 구현
  - 위치: `codebase/backend/src/modules/integrations/cafe24-install-nonce-cache.service.ts:84-91`
  - 상세: `redis.set(key, '1', 'EX', TTL, 'NX')` 단일 명령으로 check-and-set 을 원자적으로 수행한다. race condition 없이 올바르게 구현됨. graceful degradation (Redis 장애 시 false 반환) 도 spec 에 명시된 동작과 일치한다.
  - 제안: 현재 구현 유지. hmac 앞 8자만 사용하는 키 패턴의 충돌 확률은 주석에 명시된 대로 무시 가능 수준이다.

- **[INFO]** `ContinuationBusService.acquireLock` / `releaseLock`: 분산 락 구현
  - 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts:195-259`
  - 상세: SET NX + EX + Lua script 로 소유자 검증 후 DEL 하는 패턴은 Redis 분산 락의 표준 구현이다. `lockToken = hostname + UUID` 로 컨테이너 환경에서도 고유성을 보장한다. `publisher` connection 을 lock 용도로 재사용하는 것은 subscribe 모드가 아닌 pub/sub 전용 connection 에서 정상 동작한다. 전반적으로 올바른 구현.
  - 제안: 네트워크 파티션으로 lock TTL 이 expire 됐으나 recovery 작업이 아직 진행 중인 edge case 에 대한 멱등성 보장이 DB 레벨(UPDATE WHERE status=WAITING_FOR_INPUT AND started_at < threshold) 에서 이미 처리되므로 추가 조치 불필요.

- **[INFO]** `ParallelExecutor`: `nodeOutputCache` shallow copy — 잔류 위험 명시
  - 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts:83-85`
  - 상세: 코드 주석에서 `nodeOutputCache` 의 shallow copy 가 "branch 가 cache 값의 내부를 mutate 하면 안 된다는 invariant" 라고 명시하고 있다. 이 invariant 를 실행 엔진 전체에서 유지하는지에 대한 런타임 검증이 없다. 향후 새 노드 핸들러 작성자가 이 제약을 모르고 cache 값 내부를 mutate 하면 브랜치 간 비결정적 상태 오염이 발생한다.
  - 제안: `nodeOutputCache` 값에 `Object.freeze` 를 적용하거나, 핸들러에 값 반환 전 deep freeze 를 강제하는 단위 테스트를 추가해 regression 을 방지한다.

- **[INFO]** 프론트엔드 `useExecutionEvents`: 동일 이벤트 핸들러 이중 등록
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:659,728`
  - 상세: `client.on("connect", onConnect)` 와 `client.on("connect", onReconnect)` 두 핸들러가 모두 등록된다. `onReconnect` 가 `trySubscribe` 를 호출하고, 최초 `trySubscribe` 도 바로 `void` 호출된다. 정상 최초 연결 시 `connect` 이벤트가 발화하면 `onConnect` + `onReconnect` 둘 다 실행되어 `trySubscribe` 가 두 번 호출될 수 있다. socket.io 의 subscribe 는 서버 측에서 이미 구독된 채널에 대한 중복 subscribe 를 멱등하게 처리하고, 서버는 `isNewSubscription` 플래그로 snapshot 중복 발송을 차단하므로 현재는 무해하다. 그러나 명시적으로 최초 연결과 재연결을 구분하는 것이 더 명확하다.
  - 제안: 최초 `trySubscribe()` 호출은 `onReconnect` 로 대체하거나, `onConnect` 에서 `isFirstConnect` 플래그를 두어 분기한다.

### 요약

전반적으로 동시성 설계가 정교하다. Redis SETNX 를 활용한 nonce replay 방어, Lua script 기반 분산 락, BullMQ 를 통한 큐 격리, Node.js 이벤트 루프의 단일 스레드 특성을 이용한 Map/Set 접근 등 주요 동시성 패턴이 올바르게 구현되어 있다. 코드 주석에도 WARN/INFO 태그로 동시성 고려 사항이 세밀하게 기술되어 있다. 다만 (1) `ContinuationBusService` 핸들러 등록 타이밍과 Redis 메시지 도착 간의 짧은 race window, (2) `handleSubscribe` 의 async await 경계에서 MAX_SUBSCRIPTIONS 한도 재검사 누락, (3) `ForEachExecutor` 의 context 직접 mutation 이 Parallel 조합 시나리오에서 잠재적 위험을 가지는 점은 부하 증가나 특수 시나리오에서 문제가 될 수 있다. 즉각적 데이터 손상이나 권한 우회 수준의 CRITICAL 이슈는 없다.

### 위험도
MEDIUM
