# Refactor 백로그 — 동시성 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 3 / Major 7 / Minor 5 — **spec 대조(2026-06-10) 후 유효 12건 / 철회 3건(m-1, m-2, m-4)**.
> **spec 대조 판정 분포**: A 3 (C-2, M-1, M-5) / B 6 / C 3 (M-2, M-7 + C-3 부속 드리프트) / D 1 (C-3) / E 3.
> **⚠️ A(의도된 설계)인데 여전히 문제**: C-2 (spec 이 선언한 불변식의 보장 수단이 비원자 — **결정 대기**), M-5·M-1 (✅ 2026-06-10 사용자 승인 — 권고안대로 진행 확정).
> 전반 평가: BullMQ durable queue(Phase 2), park-release 모델, ShutdownState in-flight 추적 등 핵심 설계 양호. C(드리프트) 2건은 "spec 이 옳고 구현이 따라가야 할" 케이스.
> 옵션 비교·권장안 보강 (2026-06-10)

## Critical

### C-1 [Critical] `cancelWaitingExecution` fire-and-forget — 에러 유실

- [ ] 미착수 — `execution-engine.service.ts:4191-4193`

**spec 대조**: B — cancel publish 실패의 caller surface 는 spec 미정의. **단 형제 계약은 명시**: WS §4.2 "`queued: false` 면 publish 단계 실패 (Redis 장애 등) — 재시도 권장" — continuation 4종은 코드도 `ContinuationPublishResult` 반환(:4184/:4207/:4232). cancel 만 `void publish` + REST `stop()` 은 즉시 200 — §1.1 "사용자 취소 → cancelled" 보장·queued 계약의 정신과 어긋나는 예외.

**개선 방안**:

1. `cancelWaitingExecution` 을 async + `ContinuationPublishResult` 반환으로 (4개 resume 메서드와 패턴 통일).
2. REST `stop()` WAITING 분기에서 `queued=false` 시 5xx 또는 응답 body 실패 표시 — 클라이언트 재시도 유도.
3. (선택) publish 실패 시 1회 retry 후 throw. **M-7 (nextSeq fail-fast) 과 함께 적용해야 cancel 경로 일관.**

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. async + `ContinuationPublishResult` 통일, REST `stop()` 이 `queued=false` 시 실패 surface | continuation 4종(:4184/:4207/:4232)과 패턴 통일 — cancel 만 예외인 비대칭 해소. WS §4.2 "`queued: false` → 재시도 권장" 계약 정신과 합치. M-7 과 동일 표면 공유로 cancel 경로 일관 | **REST stop 의 응답 계약 변화** — 기존 무조건 200 이 publish 실패 시 5xx/실패 body 로. 200 을 가정한 클라이언트는 재시도 처리 추가 필요 |
| B. publish 실패 시 1회 retry 후 throw | 일시적 Redis 순단을 caller 노출 없이 흡수 | stop latency 증가. retry 도 실패하면 결국 surface 가 필요해 A 없이 단독 성립 불가 — A 의 보조 수단 |
| C. 현상 유지 (`void publish`) | 응답 계약 무변경, 작업 0 | §1.1 "사용자 취소 → cancelled" 보장이 침묵 실패 가능 — 에러 유실 지속. 형제 계약(§4.2 queued)과의 예외 존속 |

**권장**: A (+선택적으로 B 를 보조 retry 로) — continuation 4종이 이미 `ContinuationPublishResult` 를 반환하므로 cancel 만 예외로 둘 근거가 없고, §4.2 queued 계약의 "실패 시 재시도 권장" 정신을 cancel 에도 준용하는 것이 일관적이다. REST 응답 계약 변화는 호출자가 REST stop 1곳뿐이고 프론트 UX(WS CANCELLED 대기)가 무변경이라 영향이 국소적이다. M-7 과 함께 적용해 fail-fast 표면을 통일한다.

- **검증**: publish reject mock → stop() 에러 surface unit (기존 spec `:1046/:3438` 의 fire-and-forget 가정 테스트 갱신) + Redis down integration.
- **회귀 위험**: 낮음 — 호출자는 REST stop 1곳, 프론트 UX(WS CANCELLED 대기) 무변경.
- **spec 갱신**: §7.4 에 "cancel publish 실패도 caller 에 동기 surface (queued 계약 준용)" 1줄 (planner).

### ⚠️ C-2 [Critical] `rehydrateContext` check-then-act — 동시 worker 의 context OVERWRITE

- [ ] 결정 대기 (사용자) — `execution-engine.service.ts:1250-1344` + `continuation-execution.processor.ts:72-80`

**A — spec 이 "race 를 닫는다" 고 선언했으나 보장 수단이 비원자.**

**spec 대조**: **A** — §7.5 "재검증 가드가 BullMQ 멱등성을 보완해 **정상-경로 race 까지 닫는다**" + Rationale "불변식: 동일 turn 이중 실행 0". §7.4 의 concurrency=1 은 "latency 관측되면 **상향**" — 영구 전제 아님. **그러나** 그 가드는 비원자 SELECT check-then-act 라 멀티 인스턴스(인스턴스당 1이어도 인스턴스 간 병렬)·상향 시 spec 이 선언한 불변식을 기계적으로 보장 못 함 — **spec 의 주장과 보장 메커니즘 사이의 갭**. optimistic claim 은 spec/plan 어디에도 예정돼 있지 않음(신규 제안). **사용자 보고 대상.**

**개선 방안**:

1. 재개 진입을 DB 원자 claim 으로: `UPDATE node_execution SET status='running' WHERE id=$1 AND status='waiting_for_input' RETURNING id` — affected=0 → ack-and-discard. **spec 의 `_retryState` 소비 패턴("affected=1 인 쪽만 진행", §1.3)을 일반화하는 것이라 spec 정신과 정합.**
2. `createContext` OVERWRITE 경로(현재 경고만)를 claim 도입 후 throw 로 강화 (claim 이 단일 진입 보장 → OVERWRITE = 버그 신호).
3. concurrency=1 의존 서술을 코드 주석에서 제거.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. DB 원자 claim 도입 (`UPDATE … WHERE status='waiting_for_input' RETURNING`, affected=0 → ack-and-discard) | §7.5 가 선언한 불변식("동일 turn 이중 실행 0")을 **기계적으로 보장** — 멀티 인스턴스(인스턴스당 concurrency=1 이어도 인스턴스 간 병렬)·§7.4 가 예고한 concurrency 상향 양쪽에 안전. §1.3 `_retryState` "affected=1 인 쪽만 진행" 소비 패턴의 일반화라 spec 정신과 정합 — 새로운 발명이 아님 | **state-machine 정렬 비용**: `waiting_for_input → running` 전이를 재개 시점에 명시 수행 → `ALLOWED_TRANSITIONS`·§1.1 원자성 정책과 정렬 필요. **claim 후 실패 롤백 경로 복잡도**: rehydration 실패 시 status 롤백(RESUME_* 종결) 경로를 신설해야 하며 누락 시 stuck RUNNING — 회귀 위험 중간. §7.5 "재검증 가드" 문구의 spec 개정(planner) 동반 필수 |
| B. concurrency=1 유지 + 한계 문서화 | 코드 무변경 — 롤백 경로·state-machine 정렬 비용 0. 단일 인스턴스 + concurrency=1 에서는 현 check-then-act 가드로 사실상 충분 | spec 이 선언한 불변식이 **운영 구성(단일 인스턴스)에 의존하는 관례 보장**에 머묾 — 멀티 인스턴스 배포 시 즉시 미보장. §7.4 가 "latency 관측되면 상향" 을 이미 예고 — 상향 시점에 결국 A 가 필요해 비용이 이연될 뿐 소멸하지 않음. "spec 주장 vs 보장 수단" 갭 존속 |
| C. 보류 (PR3 context 영속화 등 인접 작업과 묶어 재검토) | state-machine 정렬·롤백 설계를 재개 경로를 건드리는 다른 작업과 묶어 1회 비용으로 처리 가능 | optimistic claim 은 spec/plan 어디에도 예정돼 있지 않은 신규 제안 — 보류 시 추적 항목 망실 위험. 보류 기간 중 멀티 인스턴스 배포·concurrency 상향이 먼저 오면 불변식 위반 창 노출 |

**권장**: A — spec 이 "정상-경로 race 까지 닫는다" 고 이미 선언했으므로, 보장 수단을 선언 수준으로 끌어올리는 것은 spec 변경이 아니라 spec 이행이다. §1.3 의 affected=1 소비 패턴이라는 검증된 선례가 있어 설계 리스크도 낮다. 단 회귀 위험이 중간(claim 후 롤백 누락 → stuck RUNNING)이므로 검증 항목의 동시 호출 unit + dockerized e2e 를 착수 조건으로 하고, **⚠️ 결정 대기 — 사용자 승인 후 착수**.

- **검증**: 동일 (executionId, nodeExecutionId) 로 `rehydrateAndResume` 2회 동시 호출 시 한쪽만 진행 unit + 같은 form park 에 continuation job 2건 인위 enqueue 후 turn 이중 실행 0 dockerized e2e (exec-park 의 기존 e2e 인프라 재사용).
- **회귀 위험**: **중간** — `waiting_for_input → running` 전이를 재개 시점에 명시 수행 → `ALLOWED_TRANSITIONS`·§1.1 원자성 정책과 정렬 필요. claim 후 rehydration 실패 시 status 롤백(RESUME_* 종결) 누락하면 stuck RUNNING.
- **spec 갱신**: **필요** — §7.5 "재검증 가드" 문구를 "DB-level 원자 claim" 으로 (planner, 구현과 동시).

### C-3 [Critical] `ExecutionContextService` in-memory Map — 스케일아웃

- [ ] 미착수 — 기존 plan [exec-intake-queue-impl.md](../exec-intake-queue-impl.md) PR3 연동 (독립 작업화 금지) — `context/execution-context.service.ts:65`

**spec 대조**: D — ① **세그먼트 간 cross-instance 는 이미 아키텍처로 해소**: §4.2 "jobId=executionId dedup 으로 active 세그먼트 항상 1개" + §7.4 "임의 인스턴스 pick up → 항상 §7.5 rehydration" — 세그먼트-로컬 in-memory 는 의도된 설계. ② `segmentStartMs` 소실은 Rationale 이 "PR2a 의도된 trade-off" 로 명시 + "PR3(Redis/DB 영속)에서 자연 해소" 로 **이미 예정**. ③ 단 §6.2 "실행 중 Redis 저장"·§9.2 `:context` 키는 현 구현(in-memory + park 시 DB durable)과 **드리프트** — spec 정직화 필요.

**개선 방안**:

1. [`../exec-intake-queue-impl.md`](../exec-intake-queue-impl.md) PR3 에 cross-link — **독립 작업화하지 않음** (성급한 전면 Redis 스토어는 park-release 모델과 이중화 위험).
2. §6.2/§9.2 의 Redis context 행에 현 구현 상태 banner 추가를 planner 에 위임 (드리프트 정직화).
3. `llmDefaultConfigCache` 인스턴스-로컬 single-flight 는 perf 특성으로 주석 명시 (Redis 화는 측정 후).

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. PR3 cross-link 만 + §6.2/§9.2 드리프트 banner (planner 위임) | `segmentStartMs` 소실은 Rationale 이 "PR2a 의도된 trade-off + PR3 에서 자연 해소" 로 **이미 예정** — 중복 작업 없음. cross-instance 는 §4.2 jobId dedup + §7.4 rehydration 아키텍처로 이미 해소돼 잔여 실결함이 없음 | §6.2 "실행 중 Redis 저장"·§9.2 `:context` 키 드리프트가 PR3 완료까지 문서 banner 로만 남음 — spec 독자가 banner 를 놓치면 오독 가능 |
| B. 독립 착수 (전면 Redis context 스토어 즉시 구현) | §6.2/§9.2 드리프트를 문서가 아닌 코드로 즉시 해소 | **이중화 위험**: park 시 DB durable 경로와 저장이 이원화 — 동일 context 의 진실이 Redis/DB 두 곳으로 갈라져 rehydration 소스가 모호해짐. PR3 설계와 충돌 시 재작업. cross-instance 가 이미 아키텍처로 해소된 상태라 즉시 착수의 실익이 낮음 — 성급한 전면 스토어가 park-release 모델 자체를 흔들 수 있음 |

**권장**: A — 세그먼트-로컬 in-memory 는 의도된 설계이고 유일한 실손실(`segmentStartMs`)은 PR3 가 이미 해소를 예정하고 있어, 독립 착수는 동일 문제를 두 plan 이 풀게 되는 이중화다. 드리프트는 spec 정직화(banner)로 PR3 까지 가시화하면 충분하다.

- **검증**: 기존 park→worker kill→타 인스턴스 재개 dockerized e2e 가 nodeOutputCache 복원 커버, PR3 착수 시 active-running 누적 연속성 테스트 추가.
- **spec 갱신**: **필요** — §6.2/§9.2 드리프트 banner (planner).

## Major

### M-1 [Major] WS resume ack — spec 내부 문구 모순 정리로 성격 축소

- [ ] 진행 확정 — ✅ 2026-06-10 사용자 승인 (확정안: A — 권고안대로 planner 문구 정리 + 프론트 가드 확인) — `websocket.gateway.ts:437/511/584/654`

**spec 대조**: **A** — WS §4.2 가 이미 정의: "`queued` … enqueue 보장 … **관측·디버깅 용도, routing 결정에 사용하지 않는다**" — 원안의 "문서화 필요" 는 소멸. **잔존 모순 2건**: ① §4.2 의 `resumed` = "재개 성공 여부" 정의 ↔ gateway 는 enqueue 성공 시 `resumed: true` 하드코딩 (항상-enqueue 모델에서 동기 ack 는 재개 성공을 알 수 없음). ② 엔진 §7.5 "셋 모두 ack 에 `resumed: false` 노출" ↔ §7.5.1 "RESUME_* 는 후행 이벤트" — spec 내부 충돌.

**개선 방안**:

1. (planner) §4.2 `resumed` 를 "재개 시작 수락(enqueue) 여부 — 최종 재개는 `execution.resumed`/`node.*` 이벤트로 확인" 으로 정정 + 엔진 §7.5 문장을 §7.5.1 과 일치.
2. (frontend) `use-execution-events.ts` 가 ack 의 `resumed` 를 상태 전이 근거로 쓰는 곳이 없는지 확인 — 있으면 이벤트 기반으로 교체.

**옵션 비교** (✅ A 로 확정 — 2026-06-10 사용자 승인, 표는 결정 기록용):

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. spec 정정 (planner) — §4.2 `resumed` 를 "재개 시작 수락(enqueue) 여부" 로 재정의 + §7.5 문장을 §7.5.1 과 일치 + 프론트 가드 확인 | 코드 무변경. §7.5.1 "RESUME_* 는 후행 이벤트" 모델과 정합 — 항상-enqueue 아키텍처의 실제 동작을 spec 이 정직하게 기술. spec 내부 모순 2건 동시 해소 | "ack 만으로 재개 성공 확인 불가" 가 공식화 — 클라이언트는 `execution.resumed`/`node.*` 이벤트 대기가 필수 (단 이는 이미 §7.5.1 의 의도) |
| B. gateway 가 실제 resumed 판정을 반환 (동기 대기) | §4.2 의 원래 정의("재개 성공 여부")를 문구 그대로 보존 | 항상-enqueue 모델에서 동기 ack 시점엔 재개 성공을 알 수 없음 — worker 처리를 동기 대기해야 해 §7.5.1 후행 이벤트 설계와 정면 충돌. ack latency 가 worker 처리 시간에 종속돼 큐 도입 취지 훼손 |

**권장**: A (✅ 확정안) — `resumed` 의 "재개 성공" 정의는 항상-enqueue 모델에서 동기적으로 충족 불가능한 약속이므로, 충족 가능한 정의("enqueue 수락")로 정정하고 최종 확인을 후행 이벤트로 일원화하는 것이 §7.5.1 과의 유일한 일관 해법이다. B 는 아키텍처를 spec 문구에 역행시키는 안이라 기각.

- **검증**: ack `resumed:true` 만으로 waiting UI 를 해제하지 않음 unit + 기존 resume e2e.
- **회귀 위험**: 없음(문서·프론트 가드 수준).
- **spec 갱신**: **본 항목의 본체** (planner).

### M-2 [Major] ShutdownState — shutdown 중 시작된 노드의 추적 포기 → §11.4 마킹 약속 위반

- [ ] 미착수 — `shutdown-state.service.ts:107-109`

**spec 대조**: **C(드리프트)** — §11.4 "미완료 RUNNING NodeExecution 을 `failed` + `SERVER_INTERRUPTED` 마킹" 약속 vs 구현의 `if (this.shuttingDown) return` 은 추적 포기. §11.2 "현재 세그먼트를 완료까지 진행" = 세그먼트 내 in-process dispatch 가 **다음 노드를 계속 시작**하므로(세그먼트=다중 노드, §4.2) 그 노드들이 snapshot 에서 누락 — zombie RUNNING row. 코드 주석의 "새 진입 없음" 전제가 spec 모델과 모순.

**개선 방안**:

1. `registerInFlight` 의 early-return 제거 — shutdown 중에도 등록·drain 대상 포함 (마킹 약속 보존, 최소 변경).
2. (보강) `onApplicationShutdown` 진입 즉시 BullMQ worker `pause()` — §11.2 "신규 job consume 중단" 의 명시 구현.
3. 노드 경계의 자발적 조기 중단은 §11 "세그먼트 완료까지 진행" 정책과 충돌 — 채택 안 함.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. `registerInFlight` early-return 제거만 | §11.4 마킹 약속(`failed` + `SERVER_INTERRUPTED`) 보존을 최소 변경으로 달성 — shutdown 중 시작된 노드도 snapshot 에 포함돼 zombie RUNNING 제거 | drain 집합 증가로 종료가 grace 한도까지 길어질 수 있음(한도 자체는 불변). 신규 job consume 은 여전히 열려 있어 shutdown 중 새 세그먼트 유입 가능 — drain 집합 상한 없음 |
| B. A + `onApplicationShutdown` 진입 즉시 BullMQ worker `pause()` 병행 | §11.2 "신규 job consume 중단" 의 명시 구현 — 새 세그먼트 유입을 입구에서 차단해 drain 집합에 상한. A 의 마킹 보존과 합쳐 §11.2/§11.4 양쪽 약속 동시 충족 | 변경 범위 소폭 증가 — pause 실패/timeout 처리 분기 추가 필요 |
| C. 노드 경계에서 자발적 조기 중단 (**기각**) | 종료 시간 최단 — drain 대기 최소화 | **기각 사유**: §11.2 "현재 세그먼트를 완료까지 진행" 정책과 정면 충돌 — 세그먼트(=다중 노드, §4.2) 중간에서 멈추는 것은 spec 이 명시적으로 배제한 동작. 채택하려면 §11 정책 자체의 개정이 선행돼야 함 |

**권장**: B — A 만으로는 마킹 약속은 지키지만 shutdown 중 신규 consume 이 drain 집합을 계속 키울 수 있어, §11.2 가 이미 약속한 "신규 job consume 중단" 을 `pause()` 로 명시 구현하는 것이 spec 양쪽 조항의 완결 이행이다. C 는 spec 충돌로 기각.

- **검증**: shutdown 직후 tick 의 registerInFlight → grace 만료 시 `SERVER_INTERRUPTED` 마킹 fake-timer unit + 다노드 SIGTERM e2e 에서 RUNNING 잔류 0.
- **회귀 위험**: 낮음 — drain 집합 증가로 종료가 grace 한도까지 길어질 수 있으나 한도 불변.
- **spec 갱신**: 불요 (spec 이 옳고 구현이 따라감).

### M-3 [Major] `void client.join(channel)` unawaited — 현 토폴로지 미발현, 저비용 선제 수정

- [ ] 미착수 — `websocket.gateway.ts:292` (leave :192/:283-287/:358)

**spec 대조**: B — join await 여부 spec 무언급. **사실관계 보정**: 현재 Redis adapter 부재 — 기본 in-memory adapter 에서 `join` 은 동기 완결이라 race 미발생, snapshot 도 `client.emit` 직접 발송이라 join 과 무관. **Redis adapter 도입 시점에 실결함** — 원안의 단서가 정확.

**개선 방안**:

1. `await client.join(channel)` + try/catch — 실패 시 `clientSubs` 롤백 + `{success:false, error}` ack (§3.3 기존 shape 재사용).
2. leave 도 await (실패는 warn — best-effort).
3. (별건 기록) 멀티 인스턴스 WS 전파에 adapter 자체가 부재한 갭을 `spec-sync-websocket-protocol-gaps.md` 에 메모.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. `await client.join` + try/catch + `clientSubs` 롤백 + 실패 ack (§3.3 기존 shape 재사용) | Redis adapter 도입 시점의 실결함을 선제 차단 — handler 가 이미 async 라 변경 비용 극소. 실패 시 클라이언트가 ack 로 인지·재시도 가능 | 현 in-memory adapter 에선 `join` 이 동기 완결이라 동작 차이 없음 — 순수 선제 투자 |
| B. 현상 유지, Redis adapter 도입 PR 에서 함께 수정 | 지금 변경 0 | adapter 도입 PR 의 체크리스트에 의존 — 누락 시 도입 시점에 곧바로 race 실결함화. 수정 자체는 지금이나 그때나 동일 비용이라 미루는 실익 없음 |

**권장**: A — 수정 비용이 거의 0(이미 async handler)인 반면 미루면 adapter 도입 시 잊힐 위험만 남는 비대칭이라 선제 적용이 합리적이다. adapter 부재 자체의 갭은 별건으로 spec-sync 메모에 기록한다.

- **검증**: join reject mock 시 ack `success:false` + Set 미오염 unit.
- **회귀 위험**: 매우 낮음(handler 이미 async).
- **spec 갱신**: 불요.

### M-4 [Major] `executeAsync` fire-and-forget — setup 2차 실패 시 RUNNING 잔류

- [ ] 미착수 — `execution-engine.service.ts:3415 부근`

**spec 대조**: B — §4 의 "execute() 는 execution-run 큐 발행" 모델에서 executeAsync(sub-workflow 비동기)는 대상 명시 없음 — 드리프트는 아니나 §4 intake 모델과 비대칭인 잔여 fire-and-forget. 큐 경유 경로는 W7 fix 로 2차 실패까지 격리(:2883-2890)돼 있으나 이 분기는 단순 로그 catch. 최후 방어는 §7.1 stale fail(30분, `started_at` 채워진 RUNNING 한정)이 부분 커버.

**개선 방안**:

1. (정공) `executeAsync` 를 execution-run 큐 enqueue 로 통일 — §4.2 직렬화·§8 cap·§7.1 stalled 재배달 수혜 동일 적용, recursionDepth 는 job payload 운반.
2. (단기) 큐 통일 전이면 catch 에 `failFirstSegmentSetup` + 2차 실패 격리를 큐 경로와 동일 복제.
3. PR2b admission gate 와의 상호작용(중첩 sub-workflow 의 cap 점유 self-starvation)을 exec-intake plan 의 "Admission 대상 한정" 결정과 함께 검토.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. 큐 통일 (정공) — `executeAsync` 를 execution-run 큐 enqueue 로 | §4.2 직렬화·§8 cap·§7.1 stalled 재배달 수혜를 sub-workflow 에도 동일 적용. W7 의 2차 실패 격리(:2883-2890)를 자동 수혜 — 로직 단일화. §4 intake 모델과의 비대칭(잔여 fire-and-forget) 근본 해소 | 시작 **latency 증가** → 타이밍 의존 테스트 흔들림 (회귀 위험 중간). 중첩 sub-workflow 의 cap 점유 self-starvation — PR2b admission gate "대상 한정" 결정과 동시 검토 필수라 단독 착수 불가. §4 spec 갱신(planner) 동반 |
| B. 단기 fallback 복제 — catch 에 `failFirstSegmentSetup` + 2차 실패 격리를 큐 경로와 동일 복제 | 회귀 위험 거의 없음(latency·타이밍 불변). RUNNING 잔류 결함을 즉시 해소 — §7.1 stale fail(30분) 대기 불요 | 큐 경로와 실패 처리 로직 **이중 유지** — W7 류 수정 발생 시 양쪽 동기화 부담. §4 비대칭 자체는 존속 |

**권장**: B 를 즉시 적용하고 A 는 PR2b admission "대상 한정" 결정과 묶어 후속 — RUNNING 잔류는 지금 닫을 수 있는 결함인 반면, 큐 통일은 self-starvation 검토가 선행돼야 해 단독으로 안전하게 결정할 수 없다. B 의 복제 코드는 A 채택 시 큐 경로로 흡수되므로 일시 부채로 관리한다.

- **검증**: setup throw + fail handler throw 이중 실패 시 FAILED 마킹 unit (현재는 잔류) + 큐 통일 시 sub-workflow 가 execution-run job 으로 관측.
- **회귀 위험**: **중간** — 큐 경유 시 시작 latency 증가로 타이밍 의존 테스트 흔들림 가능(단기안은 위험 거의 없음).
- **spec 갱신**: 큐 통일 채택 시 §4 에 executeAsync 경로 명시 (planner).

### M-5 [Major] parallel branch `nodeOutputCache` shallow clone

- [ ] 진행 확정 — ✅ 2026-06-10 사용자 승인 (확정안: 단기 1안 — dev/test deep freeze, spec 불변) — `containers/parallel-executor.ts:166-176`

**spec 대조**: **A** — `10-parallel.md:14` "variables 는 structuredClone, **nodeOutputCache 는 shallow copy 로 격리**" (:69·:149 동일) — deep clone 비용 회피 결정 포함 spec·코드 모두 의도. **단 "값 내부 mutate 금지" invariant 가 JSDoc 합의뿐** — 위반 핸들러 등장 시 last-write-wins 비결정성이 조용히 발생. (structuredClone 전환[3안]은 승인 범위 밖 — spec 개정 선행 조건 유지.)

**개선 방안**:

1. (단기, spec 불변) dev/test 한정 branch clone 직후 `nodeOutputCache` 값 deep `Object.freeze` — mutate 시도가 테스트에서 즉시 TypeError (production 미적용).
2. (대안) 엔진 `setNodeOutput` 저장 시점 freeze 일원화 — 적용 범위가 넓어지므로 별도 측정 후.
3. **structuredClone 전환은 spec :14 명시 결정의 번복 — 성능 측정 + planner spec 개정 선행 필수 (단독 구현 금지).**

**옵션 비교** (✅ A 로 확정 — 2026-06-10 사용자 승인, 표는 결정 기록용):

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. dev/test 한정 branch clone 직후 deep `Object.freeze` | spec `10-parallel.md:14` 의 shallow copy 결정 불변 — production 런타임 비용 0. "값 내부 mutate 금지" invariant 를 JSDoc 합의에서 테스트 시 즉시 TypeError 로 격상 — 위반 핸들러가 CI 에서 잡힘 | production 에선 여전히 미보호 — 테스트 커버리지가 닿지 않는 핸들러 경로의 mutate 는 잔존 가능. 적용 지점을 branch clone 직후로 한정하지 않으면 엔진의 합법적 cache 갱신을 차단할 위험 |
| B. 엔진 `setNodeOutput` 저장 시점 freeze 일원화 | 보호가 parallel branch 에 국한되지 않고 모든 cache 소비 경로로 일원화 | 적용 범위가 엔진 전역으로 넓어짐 — 엔진 자신의 정당한 갱신 패턴과 충돌 여부를 별도 측정·조사 후에만 안전. A 대비 회귀 표면이 큼 |
| C. branch 격리를 structuredClone 으로 전환 | mutate 자체가 무해해짐 — invariant 의존 제거 | spec :14 가 deep clone 비용 회피를 **명시 결정** (:69·:149 동일) — 번복은 성능 측정 + planner spec 개정 선행 필수, 단독 구현 금지. 승인 범위 밖 |

**권장**: A (✅ 확정안) — spec 결정을 건드리지 않으면서 invariant 를 "합의" 에서 "기계 검출" 로 끌어올리는 최소 비용 안이다. B 는 적용 범위 측정 후 후속 후보로 남기고, C 는 spec 개정이 선행되지 않는 한 금지 상태를 유지한다.

- **검증**: branch 핸들러가 공유 cache 값 mutate 시 freeze 환경 throw unit + mutate 허용 상태 100회 반복 결과 분산 회귀 게이트.
- **회귀 위험**: freeze 가 엔진 자신의 합법적 cache 갱신을 막지 않도록 적용 지점을 branch clone 직후로 한정.
- **spec 갱신**: 1·2 불요, 3 채택 시에만.

### M-6 [Major] frontend 싱글턴 WsClient — 핸들러 중복 등록 위험

- [ ] 미착수 — `use-execution-events.ts:988-1151`

**spec 대조**: B — 중복 등록 방어 spec 무언급. cleanup 은 정상 구현(:1101-1119) — 이중 mount·cleanup 누락 경로의 견고성 이슈.

**개선 방안**:

1. 등록 직전 `client.off(event, handler)` 선행(동일 참조 한정 제거 — 부작용 없음) 또는 등록 추적 ref.
2. 동일 executionId 이중 mount 는 store 멱등성(snapshot 모델)으로 2차 방어 — 이벤트 적용 idempotency 확인.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. 등록 직전 `client.off(event, handler)` 선행 | 동일 참조 한정 제거라 타 구독자에 부작용 없음 — 멱등 등록을 1줄로 보장. cleanup(:1101-1119) 정상 경로와 충돌 없음 | 핸들러 **참조 동일성** 전제 — 리렌더로 참조가 바뀌는 경우엔 무력 (그 경우는 기존 cleanup 이 주방어) |
| B. 등록 추적 ref (registered flag/Set) | 참조가 바뀌어도 등록 상태를 추적 가능 | 추적 상태 자체의 동기화(unmount·재연결 시 리셋)가 새 관리 대상 — A 대비 복잡도 증가가 위험 대비 과함 |
| C. store 멱등성에만 의존 (변경 없음) | 변경 0 — snapshot 모델이 이중 적용을 흡수 | listener 중복 자체는 남음 — 이벤트당 N회 핸들러 실행 비용 + 멱등성이 보장 안 되는 이벤트 유형이 추가되면 조용히 깨짐 |

**권장**: A + store 멱등성 확인(2차 방어) — `off` 선행은 부작용 없는 최소 변경으로 이중 등록을 차단하고, 이벤트 적용 idempotency 를 단언 테스트로 잠그면 참조 변경 경로까지 이중 방어가 된다. B 는 동일 효과에 관리 비용만 더한다.

- **검증**: StrictMode 래퍼에서 listener count 가 이벤트당 1 단언 + 동일 이벤트 2회 적용 store 멱등성 unit.
- **회귀 위험**: 매우 낮음.
- **spec 갱신**: 불요.

### M-7 [Major] `ContinuationBusService.nextSeq` — Redis INCR 실패 시 random fallback

- [ ] 미착수 — `continuation-bus.service.ts:188-196`

**spec 대조**: **C(드리프트)** — §7.4 "seq 는 Redis INCR per executionId — **idempotency key**" + §9.2 "seq 단조성은 활성 구간 내내 보존" 의 결정적 계약에서 random fallback 이 이탈. BullMQ 자체가 Redis 라 INCR 실패 장애에선 직후 `queue.add` 도 실패할 공산 — fallback 실익 거의 없음. fail-fast 가 WS §4.2 의 `queued:false` 경로와 정확히 합치.

**개선 방안**:

1. random fallback 제거, `nextSeq` 실패를 throw 전파 → `publish` 가 `queued:false` 반환 → WS ack/REST 5xx surface (**C-1 과 동일 표면 공유 — 함께 적용**).
2. caller 재시도 안내는 기존 spec 문구 그대로.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. random fallback 제거 + fail-fast (throw → `queued:false` → WS ack/REST 5xx) | §7.4 "seq = idempotency key"·§9.2 "seq 단조성 보존" 의 결정적 계약 복원. **BullMQ 자체가 Redis** — INCR 가 실패하는 장애에선 직후 `queue.add` 도 실패할 공산이 커 fallback 의 실익이 거의 없음. WS §4.2 `queued:false` 재시도 경로와 정확히 합치, C-1 과 동일 표면 공유 | silent 진행이 명시 실패로 바뀜 — 일시 Redis 순단 시 사용자 가시 에러 증가 (기존 spec 의 재시도 안내 문구로 완화) |
| B. random fallback 유지 | INCR 만 단독 실패하는 (드문) 상황에서 publish 시도가 지속됨 | random seq 는 **idempotency key 계약 위반** — 중복 publish 시 멱등 dedup 이 무력화되고 §9.2 단조성도 깨짐. 게다가 Redis 동반 장애에선 어차피 `queue.add` 가 실패 — 계약을 깨면서 얻는 가용성이 사실상 없음 |

**권장**: A — fallback 이 방어하는 시나리오(INCR 만 실패, queue.add 는 성공)는 BullMQ=Redis 동반 구조상 거의 성립하지 않는 반면, random seq 의 비용(멱등성·단조성 계약 파괴)은 확정적이다. C-1 과 함께 적용해 publish 실패 표면을 `queued:false` 하나로 통일한다.

- **검증**: incr reject mock → publish 가 enqueue 시도 없이 실패 반환 + ack `queued:false` unit, Redis 단절 중 submit_form 시 재시도 가능 에러 integration.
- **회귀 위험**: 낮음 — silent 진행이 명시 실패로 바뀌는 것뿐.
- **spec 갱신**: 불요 (spec 이 옳음).

## Minor

### ~~m-1 [Minor] assistant mid-row persist 실패 시 커서 미reset~~ — 철회

- [x] 철회 (2026-06-10 spec 대조)

**사유**: E — 제안한 try/finally 리셋이 **이미 구현돼 있음** (`workflow-assistant-stream.service.ts:1076-1098` — "try/finally 로 리셋을 보장한다 (review W-14)" + 실제 finally 블록 실존). 원안이 인용한 주석은 위험 인지가 아니라 적용된 fix 의 설명.

**선택 잔여**: mid-persist throw 시 중복 저장 없음을 단언하는 unit 1건 추가 — 저비용.

### ~~m-2 [Minor] StuckDocumentRecovery 주석 불일치 + 설계 이원화~~ — 철회

- [x] 철회 (2026-06-10 spec 대조)

**사유**: E — ① 주석(:26-31)은 실제 `UPDATE … RETURNING` 메커니즘(row-level lock, 패자는 빈 RETURNING)을 **정확히** 기술. ② 이원화는 양쪽 다 각자 spec 에 명시된 의도(엔진 = §7.4 Redis 분산 lock / KB = `8-embedding-pipeline.md §9.3`) — 대상·격리 요구가 달라 합리적 분화.

**선택 잔여**: §9.3 예시 SQL 이 2-step 형이라 구현의 원자형과 표현 상이 — spec 문서만 미세 갱신, planner 저우선.

### m-3 [Minor] `ws-client.ts` 동시 `connect()` 경쟁 — pending 가드 없음

- [ ] 미착수 — `ws-client.ts:23-30`

**spec 대조**: B — §6.1 은 reconnection 파라미터만 명세. `if (socket?.connected)` 는 연결 **완료 후**만 가드 — connecting 중 재호출 시 disconnect+재생성으로 churn·listener 누수 가능.

**개선 방안**:

1. `socket && (socket.connected || socket.active)` pending 가드 (socket.io 의 `active` 가 시도 중 포함) 또는 `connecting` 플래그.
2. 토큰 갱신 재연결은 기존 인스턴스 `auth` 갱신 + `connect()` 재호출로 통일 (connect_error 핸들러의 기존 패턴).

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. pending 가드 — `socket && (socket.connected \|\| socket.active)` (socket.io `active` 가 시도 중 포함) 또는 `connecting` 플래그 | connecting 중 재호출의 disconnect+재생성 churn·listener 누수 차단 — 변경이 가드 조건 1곳으로 국소적. §6.1 reconnection 파라미터 명세와 무충돌 | 토큰 교체 재연결 경로가 가드에 막히지 않도록 분기 확인 필요 — 기존 인스턴스 `auth` 갱신 + `connect()` 재호출 패턴과의 정합 검증이 동반돼야 함 |
| B. 현상 유지 (`connected` 만 가드) | 변경 0 | StrictMode 이중 mount·빠른 연속 호출에서 시도 중 socket 을 버리고 재생성 — churn 과 구 socket 의 listener 누수 가능성 잔존 |

**권장**: A — 가드 1곳 추가로 churn 경로를 닫을 수 있고, 유일한 주의점(토큰 갱신 재연결)은 기존 connect_error 패턴(`auth` 갱신 후 동일 인스턴스 `connect()`)으로 통일하면 가드와 충돌하지 않는다. 검증 항목의 io() 팩토리 1회 단언이 양쪽을 함께 잠근다.

- **검증**: connect() 2연속 호출 시 io() 팩토리 1회 단언 + StrictMode 조합.
- **회귀 위험**: 낮음 — 토큰 교체 재연결 경로가 가드에 막히지 않는지 분기 확인.
- **spec 갱신**: 불요.

### ~~m-4 [Minor] ForEach/Loop iteration context 의 abortSignal 전파 확인~~ — 철회 (= 확인 완료)

- [x] 철회 (2026-06-10 spec 대조)

**사유**: E — 직렬 컨테이너는 context 를 clone 하지 않고 **같은 객체를 mutate** 사용(ForEach JSDoc 명시) → `abortSignal` 구조적 상속. 사전 abort 체크는 공통 dispatch 에 엔진-전역 구현(`:7468-7472` `throwIfAborted` — `node-cancellation.md §5.1` 정합). parallel 만 명시 전파가 필요한 이유는 clone+그룹 controller(§2.3) 때문. 잔여 갭(IE multi-turn resume signal 등)은 [`../node-cancellation-infrastructure.md`](../node-cancellation-infrastructure.md) 가 이미 추적.

**선택 잔여**: ForEach 진행 중 abort 시 다음 iteration 노드가 `cancelled` 로 기록되는 회귀 잠금 테스트 1건.

### m-5 [Minor] snapshot 경고 타이머 — reconnect 루프 Toast 깜빡임 (발현 조건 좁음)

- [ ] 미착수 — `use-execution-events.ts:1175-1188`

**spec 대조**: B — spec 외 프론트 UX. **보정**: 10초 임계가 이미 있어 1초 내 재연결 루프에선 미발생 — **10초 이상 단절 반복 시에만** show/dismiss 반복. 원안의 "debounce 1s" 는 사실상 기충족 — 잔여는 dismiss 측 hysteresis.

**개선 방안**:

1. dismiss 를 짧은 지연(~1s) 후 수행하거나 최소 표시 시간 hysteresis.
2. 또는 연속 N회 cycle 감지 시 "연결 불안정" 고정 배너로 승격.

**옵션 비교**:

| 옵션 | 장점 | 단점 / 트레이드오프 |
| --- | --- | --- |
| A. dismiss 측 hysteresis (~1s 지연 또는 최소 표시 시간) | 잔여 발현 조건(10초 이상 단절 반복)의 깜빡임을 국소 변경으로 제거 — show 측 10초 임계는 이미 충분해 dismiss 만 보완하면 됨 | dismiss 지연만큼 이미 복구된 연결에 대한 경고가 잠깐 더 노출 — 1s 수준이라 실질 영향 미미 |
| B. 연속 N회 cycle 감지 시 "연결 불안정" 고정 배너 승격 | 반복 단절이라는 상태 정보를 명시 전달 — 깜빡임을 UX 신호로 승화 | 신규 UI 상태·문구·해제 조건 설계 필요 — 발현 조건이 좁은(10초 이상 단절 반복) 이슈 대비 투자 과대 가능 |
| C. 현상 유지 | 10초 show 임계로 1초 내 재연결 루프에선 이미 미발생 — 변경 0 | 장기 단절 반복 시 show/dismiss 깜빡임 잔존 |

**권장**: A — 원안의 "debounce 1s" 가 show 측에선 기충족이므로 잔여는 dismiss 측 hysteresis 뿐이고, 이는 타이머 1개 수준의 변경이다. B 는 반복 단절이 실측으로 관찰될 때 승격 후보로 보류한다.

- **검증**: RTL + fake timers 로 토글 시퀀스별 toast 호출 횟수 단언.
- **회귀 위험**: 매우 낮음.
- **spec 갱신**: 불요.
