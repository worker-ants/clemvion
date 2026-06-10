# Refactor 백로그 — 동시성 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 3 / Major 7 / Minor 5 — **spec 대조(2026-06-10) 후 유효 12건 / 철회 3건(m-1, m-2, m-4)**.
> **spec 대조 판정 분포**: A 3 (C-2, M-1, M-5) / B 6 / C 3 (M-2, M-7 + C-3 부속 드리프트) / D 1 (C-3) / E 3.
> **⚠️ A(의도된 설계)인데 여전히 문제 — 사용자 보고 대상**: C-2 (spec 이 선언한 불변식의 보장 수단이 비원자), M-5 (invariant 의 기계 강제 부재).
> 전반 평가: BullMQ durable queue(Phase 2), park-release 모델, ShutdownState in-flight 추적 등 핵심 설계 양호. C(드리프트) 2건은 "spec 이 옳고 구현이 따라가야 할" 케이스.

## Critical

- [ ] **C-1 `cancelWaitingExecution` fire-and-forget — 에러 유실** — `execution-engine.service.ts:4191-4193`
  - **spec 대조**: B — cancel publish 실패의 caller surface 는 spec 미정의. **단 형제 계약은 명시**: WS §4.2 "`queued: false` 면 publish 단계 실패 (Redis 장애 등) — 재시도 권장" — continuation 4종은 코드도 `ContinuationPublishResult` 반환(:4184/:4207/:4232). cancel 만 `void publish` + REST `stop()` 은 즉시 200 — §1.1 "사용자 취소 → cancelled" 보장·queued 계약의 정신과 어긋나는 예외.
  - **개선 방안**: 1. `cancelWaitingExecution` 을 async + `ContinuationPublishResult` 반환으로 (4개 resume 메서드와 패턴 통일). 2. REST `stop()` WAITING 분기에서 `queued=false` 시 5xx 또는 응답 body 실패 표시 — 클라이언트 재시도 유도. 3. (선택) publish 실패 시 1회 retry 후 throw. **M-7 (nextSeq fail-fast) 과 함께 적용해야 cancel 경로 일관.**
  - 검증: publish reject mock → stop() 에러 surface unit (기존 spec `:1046/:3438` 의 fire-and-forget 가정 테스트 갱신) + Redis down integration. / 회귀 위험: 낮음 — 호출자는 REST stop 1곳, 프론트 UX(WS CANCELLED 대기) 무변경. / spec 갱신: §7.4 에 "cancel publish 실패도 caller 에 동기 surface (queued 계약 준용)" 1줄 (planner).

- [ ] **C-2 `rehydrateContext` check-then-act — 동시 worker 의 context OVERWRITE** ⚠️ **(A — spec 이 "race 를 닫는다" 고 선언했으나 보장 수단이 비원자)** — `execution-engine.service.ts:1250-1344` + `continuation-execution.processor.ts:72-80`
  - **spec 대조**: **A** — §7.5 "재검증 가드가 BullMQ 멱등성을 보완해 **정상-경로 race 까지 닫는다**" + Rationale "불변식: 동일 turn 이중 실행 0". §7.4 의 concurrency=1 은 "latency 관측되면 **상향**" — 영구 전제 아님. **그러나** 그 가드는 비원자 SELECT check-then-act 라 멀티 인스턴스(인스턴스당 1이어도 인스턴스 간 병렬)·상향 시 spec 이 선언한 불변식을 기계적으로 보장 못 함 — **spec 의 주장과 보장 메커니즘 사이의 갭**. optimistic claim 은 spec/plan 어디에도 예정돼 있지 않음(신규 제안). **사용자 보고 대상.**
  - **개선 방안**: 1. 재개 진입을 DB 원자 claim 으로: `UPDATE node_execution SET status='running' WHERE id=$1 AND status='waiting_for_input' RETURNING id` — affected=0 → ack-and-discard. **spec 의 `_retryState` 소비 패턴("affected=1 인 쪽만 진행", §1.3)을 일반화하는 것이라 spec 정신과 정합.** 2. `createContext` OVERWRITE 경로(현재 경고만)를 claim 도입 후 throw 로 강화 (claim 이 단일 진입 보장 → OVERWRITE = 버그 신호). 3. concurrency=1 의존 서술을 코드 주석에서 제거.
  - 검증: 동일 (executionId, nodeExecutionId) 로 `rehydrateAndResume` 2회 동시 호출 시 한쪽만 진행 unit + 같은 form park 에 continuation job 2건 인위 enqueue 후 turn 이중 실행 0 dockerized e2e (exec-park 의 기존 e2e 인프라 재사용). / 회귀 위험: **중간** — `waiting_for_input → running` 전이를 재개 시점에 명시 수행 → `ALLOWED_TRANSITIONS`·§1.1 원자성 정책과 정렬 필요. claim 후 rehydration 실패 시 status 롤백(RESUME_* 종결) 누락하면 stuck RUNNING. / **spec 갱신: 필요** — §7.5 "재검증 가드" 문구를 "DB-level 원자 claim" 으로 (planner, 구현과 동시).

- [ ] **C-3 `ExecutionContextService` in-memory Map — 스케일아웃 (기존 plan PR3 연동, 독립 작업화 금지)** — `context/execution-context.service.ts:65`
  - **spec 대조**: D — ① **세그먼트 간 cross-instance 는 이미 아키텍처로 해소**: §4.2 "jobId=executionId dedup 으로 active 세그먼트 항상 1개" + §7.4 "임의 인스턴스 pick up → 항상 §7.5 rehydration" — 세그먼트-로컬 in-memory 는 의도된 설계. ② `segmentStartMs` 소실은 Rationale 이 "PR2a 의도된 trade-off" 로 명시 + "PR3(Redis/DB 영속)에서 자연 해소" 로 **이미 예정**. ③ 단 §6.2 "실행 중 Redis 저장"·§9.2 `:context` 키는 현 구현(in-memory + park 시 DB durable)과 **드리프트** — spec 정직화 필요.
  - **개선 방안**: 1. [`../exec-intake-queue-impl.md`](../exec-intake-queue-impl.md) PR3 에 cross-link — **독립 작업화하지 않음** (성급한 전면 Redis 스토어는 park-release 모델과 이중화 위험). 2. §6.2/§9.2 의 Redis context 행에 현 구현 상태 banner 추가를 planner 에 위임 (드리프트 정직화). 3. `llmDefaultConfigCache` 인스턴스-로컬 single-flight 는 perf 특성으로 주석 명시 (Redis 화는 측정 후).
  - 검증: 기존 park→worker kill→타 인스턴스 재개 dockerized e2e 가 nodeOutputCache 복원 커버, PR3 착수 시 active-running 누적 연속성 테스트 추가. / **spec 갱신: 필요** — §6.2/§9.2 드리프트 banner (planner).

## Major

- [ ] **M-1 WS resume ack — spec 내부 문구 모순 정리로 성격 축소** ⚠️ **(A — "ack=enqueue 보장" 은 이미 spec 정의)** — `websocket.gateway.ts:437/511/584/654`
  - **spec 대조**: **A** — WS §4.2 가 이미 정의: "`queued` … enqueue 보장 … **관측·디버깅 용도, routing 결정에 사용하지 않는다**" — 원안의 "문서화 필요" 는 소멸. **잔존 모순 2건**: ① §4.2 의 `resumed` = "재개 성공 여부" 정의 ↔ gateway 는 enqueue 성공 시 `resumed: true` 하드코딩 (항상-enqueue 모델에서 동기 ack 는 재개 성공을 알 수 없음). ② 엔진 §7.5 "셋 모두 ack 에 `resumed: false` 노출" ↔ §7.5.1 "RESUME_* 는 후행 이벤트" — spec 내부 충돌.
  - **개선 방안**: 1. (planner) §4.2 `resumed` 를 "재개 시작 수락(enqueue) 여부 — 최종 재개는 `execution.resumed`/`node.*` 이벤트로 확인" 으로 정정 + 엔진 §7.5 문장을 §7.5.1 과 일치. 2. (frontend) `use-execution-events.ts` 가 ack 의 `resumed` 를 상태 전이 근거로 쓰는 곳이 없는지 확인 — 있으면 이벤트 기반으로 교체.
  - 검증: ack `resumed:true` 만으로 waiting UI 를 해제하지 않음 unit + 기존 resume e2e. / 회귀 위험: 없음(문서·프론트 가드 수준). / **spec 갱신: 본 항목의 본체** (planner).

- [ ] **M-2 ShutdownState — shutdown 중 시작된 노드의 추적 포기 → §11.4 마킹 약속 위반** — `shutdown-state.service.ts:107-109`
  - **spec 대조**: **C(드리프트)** — §11.4 "미완료 RUNNING NodeExecution 을 `failed` + `SERVER_INTERRUPTED` 마킹" 약속 vs 구현의 `if (this.shuttingDown) return` 은 추적 포기. §11.2 "현재 세그먼트를 완료까지 진행" = 세그먼트 내 in-process dispatch 가 **다음 노드를 계속 시작**하므로(세그먼트=다중 노드, §4.2) 그 노드들이 snapshot 에서 누락 — zombie RUNNING row. 코드 주석의 "새 진입 없음" 전제가 spec 모델과 모순.
  - **개선 방안**: 1. `registerInFlight` 의 early-return 제거 — shutdown 중에도 등록·drain 대상 포함 (마킹 약속 보존, 최소 변경). 2. (보강) `onApplicationShutdown` 진입 즉시 BullMQ worker `pause()` — §11.2 "신규 job consume 중단" 의 명시 구현. 3. 노드 경계의 자발적 조기 중단은 §11 "세그먼트 완료까지 진행" 정책과 충돌 — 채택 안 함.
  - 검증: shutdown 직후 tick 의 registerInFlight → grace 만료 시 `SERVER_INTERRUPTED` 마킹 fake-timer unit + 다노드 SIGTERM e2e 에서 RUNNING 잔류 0. / 회귀 위험: 낮음 — drain 집합 증가로 종료가 grace 한도까지 길어질 수 있으나 한도 불변. / spec 갱신: 불요 (spec 이 옳고 구현이 따라감).

- [ ] **M-3 `void client.join(channel)` unawaited — 현 토폴로지 미발현, 저비용 선제 수정** — `websocket.gateway.ts:292` (leave :192/:283-287/:358)
  - **spec 대조**: B — join await 여부 spec 무언급. **사실관계 보정**: 현재 Redis adapter 부재 — 기본 in-memory adapter 에서 `join` 은 동기 완결이라 race 미발생, snapshot 도 `client.emit` 직접 발송이라 join 과 무관. **Redis adapter 도입 시점에 실결함** — 원안의 단서가 정확.
  - **개선 방안**: 1. `await client.join(channel)` + try/catch — 실패 시 `clientSubs` 롤백 + `{success:false, error}` ack (§3.3 기존 shape 재사용). 2. leave 도 await (실패는 warn — best-effort). 3. (별건 기록) 멀티 인스턴스 WS 전파에 adapter 자체가 부재한 갭을 `spec-sync-websocket-protocol-gaps.md` 에 메모.
  - 검증: join reject mock 시 ack `success:false` + Set 미오염 unit. / 회귀 위험: 매우 낮음(handler 이미 async). / spec 갱신: 불요.

- [ ] **M-4 `executeAsync` fire-and-forget — setup 2차 실패 시 RUNNING 잔류** — `execution-engine.service.ts:3415 부근`
  - **spec 대조**: B — §4 의 "execute() 는 execution-run 큐 발행" 모델에서 executeAsync(sub-workflow 비동기)는 대상 명시 없음 — 드리프트는 아니나 §4 intake 모델과 비대칭인 잔여 fire-and-forget. 큐 경유 경로는 W7 fix 로 2차 실패까지 격리(:2883-2890)돼 있으나 이 분기는 단순 로그 catch. 최후 방어는 §7.1 stale fail(30분, `started_at` 채워진 RUNNING 한정)이 부분 커버.
  - **개선 방안**: 1. (정공) `executeAsync` 를 execution-run 큐 enqueue 로 통일 — §4.2 직렬화·§8 cap·§7.1 stalled 재배달 수혜 동일 적용, recursionDepth 는 job payload 운반. 2. (단기) 큐 통일 전이면 catch 에 `failFirstSegmentSetup` + 2차 실패 격리를 큐 경로와 동일 복제. 3. PR2b admission gate 와의 상호작용(중첩 sub-workflow 의 cap 점유 self-starvation)을 exec-intake plan 의 "Admission 대상 한정" 결정과 함께 검토.
  - 검증: setup throw + fail handler throw 이중 실패 시 FAILED 마킹 unit (현재는 잔류) + 큐 통일 시 sub-workflow 가 execution-run job 으로 관측. / 회귀 위험: **중간** — 큐 경유 시 시작 latency 증가로 타이밍 의존 테스트 흔들림 가능(단기안은 위험 거의 없음). / spec 갱신: 큐 통일 채택 시 §4 에 executeAsync 경로 명시 (planner).

- [ ] **M-5 parallel branch `nodeOutputCache` shallow clone** ⚠️ **(A — spec 명시 설계, invariant 기계 강제만 부재)** — `containers/parallel-executor.ts:166-176`
  - **spec 대조**: **A** — `10-parallel.md:14` "variables 는 structuredClone, **nodeOutputCache 는 shallow copy 로 격리**" (:69·:149 동일) — deep clone 비용 회피 결정 포함 spec·코드 모두 의도. **단 "값 내부 mutate 금지" invariant 가 JSDoc 합의뿐** — 위반 핸들러 등장 시 last-write-wins 비결정성이 조용히 발생. **사용자 보고 대상.**
  - **개선 방안**: 1. (단기, spec 불변) dev/test 한정 branch clone 직후 `nodeOutputCache` 값 deep `Object.freeze` — mutate 시도가 테스트에서 즉시 TypeError (production 미적용). 2. (대안) 엔진 `setNodeOutput` 저장 시점 freeze 일원화 — 적용 범위가 넓어지므로 별도 측정 후. 3. **structuredClone 전환은 spec :14 명시 결정의 번복 — 성능 측정 + planner spec 개정 선행 필수 (단독 구현 금지).**
  - 검증: branch 핸들러가 공유 cache 값 mutate 시 freeze 환경 throw unit + mutate 허용 상태 100회 반복 결과 분산 회귀 게이트. / 회귀 위험: freeze 가 엔진 자신의 합법적 cache 갱신을 막지 않도록 적용 지점을 branch clone 직후로 한정. / spec 갱신: 1·2 불요, 3 채택 시에만.

- [ ] **M-6 frontend 싱글턴 WsClient — 핸들러 중복 등록 위험** — `use-execution-events.ts:988-1151`
  - **spec 대조**: B — 중복 등록 방어 spec 무언급. cleanup 은 정상 구현(:1101-1119) — 이중 mount·cleanup 누락 경로의 견고성 이슈.
  - **개선 방안**: 1. 등록 직전 `client.off(event, handler)` 선행(동일 참조 한정 제거 — 부작용 없음) 또는 등록 추적 ref. 2. 동일 executionId 이중 mount 는 store 멱등성(snapshot 모델)으로 2차 방어 — 이벤트 적용 idempotency 확인.
  - 검증: StrictMode 래퍼에서 listener count 가 이벤트당 1 단언 + 동일 이벤트 2회 적용 store 멱등성 unit. / 회귀 위험: 매우 낮음. / spec 갱신: 불요.

- [ ] **M-7 `ContinuationBusService.nextSeq` — Redis INCR 실패 시 random fallback** — `continuation-bus.service.ts:188-196`
  - **spec 대조**: **C(드리프트)** — §7.4 "seq 는 Redis INCR per executionId — **idempotency key**" + §9.2 "seq 단조성은 활성 구간 내내 보존" 의 결정적 계약에서 random fallback 이 이탈. BullMQ 자체가 Redis 라 INCR 실패 장애에선 직후 `queue.add` 도 실패할 공산 — fallback 실익 거의 없음. fail-fast 가 WS §4.2 의 `queued:false` 경로와 정확히 합치.
  - **개선 방안**: 1. random fallback 제거, `nextSeq` 실패를 throw 전파 → `publish` 가 `queued:false` 반환 → WS ack/REST 5xx surface (**C-1 과 동일 표면 공유 — 함께 적용**). 2. caller 재시도 안내는 기존 spec 문구 그대로.
  - 검증: incr reject mock → publish 가 enqueue 시도 없이 실패 반환 + ack `queued:false` unit, Redis 단절 중 submit_form 시 재시도 가능 에러 integration. / 회귀 위험: 낮음 — silent 진행이 명시 실패로 바뀌는 것뿐. / spec 갱신: 불요 (spec 이 옳음).

## Minor

- [x] ~~**m-1 assistant mid-row persist 실패 시 커서 미reset**~~ — **철회 (2026-06-10 spec 대조)**
  - **사유**: E — 제안한 try/finally 리셋이 **이미 구현돼 있음** (`workflow-assistant-stream.service.ts:1076-1098` — "try/finally 로 리셋을 보장한다 (review W-14)" + 실제 finally 블록 실존). 원안이 인용한 주석은 위험 인지가 아니라 적용된 fix 의 설명. (선택 잔여: mid-persist throw 시 중복 저장 없음을 단언하는 unit 1건 추가 — 저비용.)

- [x] ~~**m-2 StuckDocumentRecovery 주석 불일치 + 설계 이원화**~~ — **철회 (2026-06-10 spec 대조)**
  - **사유**: E — ① 주석(:26-31)은 실제 `UPDATE … RETURNING` 메커니즘(row-level lock, 패자는 빈 RETURNING)을 **정확히** 기술. ② 이원화는 양쪽 다 각자 spec 에 명시된 의도(엔진 = §7.4 Redis 분산 lock / KB = `8-embedding-pipeline.md §9.3`) — 대상·격리 요구가 달라 합리적 분화. (선택 잔여: §9.3 예시 SQL 이 2-step 형이라 구현의 원자형과 표현 상이 — spec 문서만 미세 갱신, planner 저우선.)

- [ ] **m-3 `ws-client.ts` 동시 `connect()` 경쟁 — pending 가드 없음** — `ws-client.ts:23-30`
  - **spec 대조**: B — §6.1 은 reconnection 파라미터만 명세. `if (socket?.connected)` 는 연결 **완료 후**만 가드 — connecting 중 재호출 시 disconnect+재생성으로 churn·listener 누수 가능.
  - **개선 방안**: 1. `socket && (socket.connected || socket.active)` pending 가드 (socket.io 의 `active` 가 시도 중 포함) 또는 `connecting` 플래그. 2. 토큰 갱신 재연결은 기존 인스턴스 `auth` 갱신 + `connect()` 재호출로 통일 (connect_error 핸들러의 기존 패턴).
  - 검증: connect() 2연속 호출 시 io() 팩토리 1회 단언 + StrictMode 조합. / 회귀 위험: 낮음 — 토큰 교체 재연결 경로가 가드에 막히지 않는지 분기 확인. / spec 갱신: 불요.

- [x] ~~**m-4 ForEach/Loop iteration context 의 abortSignal 전파 확인**~~ — **철회 = 확인 완료 (2026-06-10 spec 대조)**
  - **사유**: E — 직렬 컨테이너는 context 를 clone 하지 않고 **같은 객체를 mutate** 사용(ForEach JSDoc 명시) → `abortSignal` 구조적 상속. 사전 abort 체크는 공통 dispatch 에 엔진-전역 구현(`:7468-7472` `throwIfAborted` — `node-cancellation.md §5.1` 정합). parallel 만 명시 전파가 필요한 이유는 clone+그룹 controller(§2.3) 때문. 잔여 갭(IE multi-turn resume signal 등)은 [`../node-cancellation-infrastructure.md`](../node-cancellation-infrastructure.md) 가 이미 추적. (선택 잔여: ForEach 진행 중 abort 시 다음 iteration 노드가 `cancelled` 로 기록되는 회귀 잠금 테스트 1건.)

- [ ] **m-5 snapshot 경고 타이머 — reconnect 루프 Toast 깜빡임 (발현 조건 좁음)** — `use-execution-events.ts:1175-1188`
  - **spec 대조**: B — spec 외 프론트 UX. **보정**: 10초 임계가 이미 있어 1초 내 재연결 루프에선 미발생 — **10초 이상 단절 반복 시에만** show/dismiss 반복. 원안의 "debounce 1s" 는 사실상 기충족 — 잔여는 dismiss 측 hysteresis.
  - **개선 방안**: 1. dismiss 를 짧은 지연(~1s) 후 수행하거나 최소 표시 시간 hysteresis. 2. 또는 연속 N회 cycle 감지 시 "연결 불안정" 고정 배너로 승격.
  - 검증: RTL + fake timers 로 토글 시퀀스별 toast 호출 횟수 단언. / 회귀 위험: 매우 낮음. / spec 갱신: 불요.
