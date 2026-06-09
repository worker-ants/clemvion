# Refactor 백로그 — 동시성 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 3 / Major 7 / Minor 5.
> **기존 plan 관계**: C-3 은 [`../exec-park-durable-resume.md`](../exec-park-durable-resume.md)·[`../exec-intake-queue-impl.md`](../exec-intake-queue-impl.md) 가 토대 — 해당 plan 진행과 연동해 닫는다.
> 전반 평가: BullMQ durable queue 전환(Phase 2), park-release 모델, ShutdownStateService in-flight 추적 등 핵심 설계는 양호.

## Critical

- [ ] **C-1 `cancelWaitingExecution` fire-and-forget — 에러 유실** — `backend/src/modules/execution-engine/execution-engine.service.ts:4191-4193` (`void this.continuationBus.publish(...)`)
  Redis 장애 시 cancel 이 조용히 실패, 호출자(REST/WS)는 성공 인식 → WAITING 영구 잔류 가능.
  → async 전환 + `ContinuationPublishResult` 반환 (다른 continuation 메서드들과 패턴 통일), 호출자가 queued=false 를 응답에 반영.

- [ ] **C-2 `rehydrateContext` check-then-act — 동시 worker 의 context OVERWRITE** — `execution-engine.service.ts:1250-1344` + `continuation-execution.processor.ts:72-80`
  `isNodeExecutionWaiting`(SELECT) → `rehydrateAndResume` 진입 사이에 다른 worker 가 같은 nodeExecution 처리 시 `createContext` 가 OVERWRITE **경고만** 내고 in-flight context 를 덮어씀 (2차 상태 재검증 :1094-1148 은 부분 방어).
  → DB-level optimistic claim (`UPDATE ... WHERE status='waiting_for_input' RETURNING`) 으로 단일 진입자 보장, `createContext` OVERWRITE 경로를 throw 또는 기존 context 재사용으로 전환. (worker concurrency=1 유지는 임시 안전장치일 뿐)

- [ ] **C-3 `ExecutionContextService` in-memory Map — 수평 스케일아웃 시 상태 소실** — `execution-engine/context/execution-context.service.ts:65`
  멀티 pod 에서 execution-run worker 와 continuation worker 가 다른 인스턴스에 배정되면 `nodeOutputCache`/`segmentStartMs`/`llmDefaultConfigCache` 가 인스턴스-local → active-running 타임아웃 측정 오류, LLM config single-flight 무력화. 코드 주석에서 "향후 Redis 백킹" 으로 이미 인지.
  → 스케일아웃 전 Redis 기반 분산 스토어 교체 또는 execution 단위 sticky routing 강화. 착수 시 exec-park/exec-intake plan 과 설계 정렬.

## Major

- [ ] **M-1 `resolveWaitingNodeExecutionId` SELECT→publish 간극의 낙관적 ack** — `execution-engine.service.ts:5187-5228`
  enqueue 후 idempotency 가드로 결과 안전하나, WS ack `queued=true` 가 "처리 보장" 으로 오인될 수 있음.
  → ack 의미를 "enqueue 보장" 으로 문서화 + 클라이언트는 `execution.resumed` 이벤트로 최종 확인하는 UX 계약 명시.

- [ ] **M-2 ShutdownState — `shuttingDown` 세팅과 `registerInFlight` 사이 await 경계 race** — `shutdown/shutdown-state.service.ts:46-165`
  shutdown 중 등록된 node execution 이 `markRemainingAsInterrupted` snapshot 에서 누락 → zombie RUNNING row 가능.
  → `onApplicationShutdown` 진입 즉시 BullMQ worker pause, 또는 shuttingDown 이후 진입한 registerInFlight 도 in-flight 추적되게 가드 보강.

- [ ] **M-3 `void client.join(channel)` unawaited** — `websocket/websocket.gateway.ts:292` (leave :192,:358 동일)
  join reject 시 snapshot 이 미구독 클라이언트에 전달되지 않는 경쟁 (Redis adapter 클러스터에서 발생 가능).
  → `await client.join(...)` + 실패 시 구독 실패 응답.

- [ ] **M-4 `executeAsync` fire-and-forget — setup 단계 2차 실패 시 RUNNING 잔류** — `execution-engine.service.ts:3446-3452`
  `failFirstSegmentSetup`(:737) 자체가 throw 하면 `.catch` 로그만 남고 Execution row 미마킹.
  → executeAsync 를 BullMQ execution-run 큐 경유로 통일하거나, fail handler 2차 실패의 fallback DB 마킹 추가.

- [ ] **M-5 parallel branch 의 `nodeOutputCache` shallow clone — 값 객체 mutation 공유 위험** — `containers/parallel-executor.ts:174-176`
  invariant 가 주석 문서화일 뿐 강제 수단 없음 — 값 내부 mutate 핸들러 등장 시 branch 간 last-write-wins 비결정성.
  → 단기: 런타임 `Object.freeze` 또는 lint 강제. 중기: structuredClone deep copy (성능 측정 후).

- [ ] **M-6 frontend 싱글턴 WsClient — 동일 핸들러 참조 중복 등록 위험** — `frontend/src/lib/websocket/use-execution-events.ts:988-1151`
  StrictMode 이중 마운트/빠른 navigation 에서 같은 함수 참조가 두 번 `on()` 가능 (socket.io 는 중복 실행).
  → 등록 직전 `client.off(event, handler)` 선행 호출로 idempotent 화 또는 등록 추적 ref.

- [ ] **M-7 `ContinuationBusService.nextSeq` — Redis INCR 실패 시 random fallback 이 idempotency 붕괴** — `continuation/continuation-bus.service.ts:170-195`
  random 충돌 시 중복 거부, 비충돌 시 중복 resume — 양쪽 다 잘못된 결과.
  → fallback 제거, fail-fast throw 로 caller 가 queued=false 반환.

## Minor

- [ ] **m-1 assistant mid-row persist 실패 시 커서 미reset → 텍스트 중복 저장** — `workflow-assistant-stream.service.ts:1074-1094` (주석으로 인지된 상태)
  → mid-persist try 에 finally 로 커서 reset 일관화.
- [ ] **m-2 StuckDocumentRecovery 주석이 실제 메커니즘(UPDATE RETURNING winner)과 불일치 + 엔진 recovery(Redis 락)와 설계 이원화** — `knowledge-base/queues/stuck-document-recovery.service.ts:25-66`
  → 주석 정정 또는 Redis 락으로 통일.
- [ ] **m-3 `ws-client.ts` 동시 `connect()` 경쟁 — pending connection 가드 없음** — `frontend/src/lib/websocket/ws-client.ts:23-73`
  → 연결 중 플래그 추가 또는 호출부 cancelledRef 검사 강화.
- [ ] **m-4 ForEach/Loop iteration context 의 abortSignal 전파 확인** — `containers/foreach-executor.ts`, `loop-executor.ts`
  parallel-executor(:127-152) 는 명시 전파 — 직렬 컨테이너도 동일 보장 확인/보강.
- [ ] **m-5 snapshot 경고 타이머 — reconnect 루프에서 Toast 깜빡임** — `use-execution-events.ts:1174-1187` → debounce(~1s) 검토.
