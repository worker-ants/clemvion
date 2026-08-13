# Rationale 연속성 Review

## 검토 범위 메모

target 프롬프트가 지정한 `spec/5-system/` 범위에는 이번 diff(`origin/main...HEAD`, 11 커밋)로 인한
spec 문서 변경이 **없다** (`git diff origin/main...HEAD --stat -- spec/` 공집합). 실제 diff 는
`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` ·
`codebase/backend/src/modules/executions/executions.service.ts` ·
`codebase/backend/src/common/utils/assert-row-array.ts`(신규) 의 방어적 하드닝
(`EntityManager.query()` 반환이 배열이 아닐 때 `assertRowArray` 로 명시 실패시키는 가드 4곳)
+ `plan/in-progress/**` 문서 갱신이다. 따라서 본 검토는 "코드 diff가 `spec/5-system/` 의
기존 Rationale·설계 원칙과 충돌하는가"를 기준으로 수행했다.

## 발견사항

- **[WARNING]** admission-throw 재전파 경로의 "BullMQ 재배달로 자가 치유" 서술이 `execution-run` 큐의 `attempts:1` 설계 근거와 어긋나고, 같은 함수 내 자매 catch 패턴과도 다른 전략을 무근거로 채택
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3671-3685` (`runExecutionFromQueue`, admission 호출을 감싼 신규 `try { admission = await this.admitExecutionOrDefer(...) } catch (err) { releaseExecutionRouting; throw err; }` 및 그 위 주석 "트랜잭션이 롤백돼 execution 은 pending 으로 남고 **BullMQ 재배달 시 재등록되므로 대개 자가 치유되지만, 재시도가 소진되면** in-memory map 에 영구 잔류한다")
  - 과거 결정 출처:
    1. `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts:64-78` (`EXECUTION_RUN_QUEUE_DEFAULT_OPTS`, PR1 도입 — 이번 diff 로 미변경) — "`attempts: 1` — job **실패(throw)** 시 application-level 재시도는 하지 않는다. 비멱등 노드(Integration write 등) 이중 실행 방지. (stalled 재배달은 attempts 와 **별개 카운터**)"
    2. [Spec 실행 엔진 §9.3 BullMQ 큐 목록](../../../../spec/5-system/4-execution-engine.md#93-bullmq-큐-목록) — `execution-run` 행: `attempts:1`, `maxStalledCount:1` (PR4 — **크래시 세그먼트** 1회 자동 재배달)
    3. [§Rationale "PR4 — BullMQ stalled 자동 재배달 (2026-07-04)"](../../../../spec/5-system/4-execution-engine.md#rationale) — "네이티브 stalled = **같은 job 을 그대로 재처리**(신규 enqueue 아님)" · "`maxStalledCount=1`" 은 **크래시로 인한 lock 소실** 감지 시에만 발동. explicit throw 는 이 경로가 아니다.
    4. 같은 함수의 자매 catch 블록 (`execution-engine.service.ts:3699-3712`, `runExecution` 호출 catch) — "**W7 (ai-review) / M-4** — best-effort 마감 + 2차 실패 흡수. **2차 실패가 BullMQ worker 로 전파되면 동일 continuation 이중 재시도(double-exec)를 유발하므로** 헬퍼가 로그로만 관측한다" (즉 rethrow 하지 않고 `failFirstSegmentSetupBestEffort` 로 삼킨다).
    5. `runExecutionFromQueue` 기존(미변경) JSDoc(:3611-3613) — "실행 실패는 `runExecution` 이 Execution 을 `failed` 로 마킹하고 정상 반환하므로 본 메서드는 setup 단계 미처리 throw 만 catch 해 routing 을 정리한다 (**PR1 은 crash-retry 미도입 — job 을 re-throw 없이 ack 하여 비멱등 노드 이중 실행 방지**)."
  - 상세: `execution-run` 큐는 PR1 때부터 **"명시적 throw 는 재시도하지 않는다"** (`attempts:1`) 는 것과, 그 재시도 부재의 **정확한 이유가 "이중 실행 방지"** 라는 것을 코드·spec 양쪽에서 반복 명문화해 왔다. "재배달(redelivery)"은 오직 **워커 크래시로 인한 BullMQ 네이티브 stalled 감지**(`maxStalledCount`, attempts 와 별개 카운터)에서만 일어난다. 이번 diff 가 admission 단계에 새로 추가한 throw 는 (a) 워커 크래시가 아니라 애플리케이션이 **의도적으로 던지는 예외**이고, (b) `process()`(`execution-run.processor.ts:47-51`)가 이를 그대로 전파해 BullMQ 가 즉시 job 을 `failed`(dead-letter, `removeOnFail:false`)로 마킹한다 — `attempts:1` 이므로 **재시도(redelivery)는 일어나지 않는다.** 그런데 새 주석은 "BullMQ 재배달 시 재등록되므로 대개 자가 치유되지만, 재시도가 소진되면"이라고 적어, 존재하지 않는 attempts-기반 재시도·소진 서사를 전제한다. 이 오서술은 같은 세션의 code-review(`review/code/2026/08/13/18_38_10/security.md:55`)에도 그대로 반복돼 이미 전파됐다.
    같은 함수 안에서 "setup 단계 throw"를 다루는 **자매 catch**(`runExecution` 호출부)는 정반대 전략(swallow + best-effort terminal mark, 명시적으로 "rethrow 하면 BullMQ 가 이중 재시도를 유발한다"는 이유로)을 쓴다. 이번 admission catch 는 그 자매 패턴과 다른 전략(그대로 재throw)을 택하면서도, admission 단계는 아직 노드가 실행되지 않아 "이중 실행" 리스크 자체가 없다는 구분을 **명시적으로 근거화하지 않았다** — 대신 사실과 다른 "재배달로 자가 치유" 서술로 정당화했다.
    실질 영향: `assertRowArray` 가 이 자리에서 실제로 던질 확률은 극히 낮지만(정상 pg 드라이버는 배열을 반환), 발생 시 실제 동작은 "재시도로 자가 치유"가 아니라 — Execution row 가 `pending` 에 멈춘 채, [§Rationale "orphan pending backstop"](../../../../spec/5-system/4-execution-engine.md#rationale) 이 규정한 **boot-only** `recoverOrphanPendingExecutions` 스캔(다음 앱 재기동 후에만 5분 큐대기 초과 시 `cancelled` 로 회수)까지 방치된다. 즉 "대개 자가 치유"가 아니라 "다음 배포까지 좌초 가능"이 실제 계약이다.
  - 제안: 둘 중 하나로 정합화한다.
    (a) **코드 정정** — admission catch 도 자매 `runExecution` catch 처럼 best-effort 로 Execution 을 종결 처리하고 rethrow 하지 않거나(단, admission 단계는 아직 트랜잭션 밖에서 아무 것도 확정되지 않았으므로 `markQueueWaitTimeout`/`cancelled` 류의 명시적 종결이 더 적합할 수 있음 — 구현 판단), 혹은 rethrow 를 유지하려면 최소한 "왜 이 자리는 자매 catch 와 달리 이중 실행 위험이 없는가"(아직 노드 미실행)를 명시.
    (b) **주석·문서 정정만** — 실제로 rethrow 를 유지하기로 한다면, 주석의 "BullMQ 재배달 시 재등록되므로 대개 자가 치유"를 "`attempts:1`이라 재시도되지 않고 job 은 즉시 dead-letter 된다. Execution 은 `pending` 에 남아 다음 앱 재기동의 orphan-pending backstop(§Rationale)이 회수할 때까지 대기한다"로 정정 — 최소한 신규 Rationale/코드 주석이 기존 `attempts:1` 설계와 모순되지 않게 한다.
    어느 쪽이든 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 이번 가드의 결정 이력이 상세히 남아 있으므로, 그 항목에 후속으로 등재하는 것을 권한다.

## 요약

이번 diff(`spec/5-system/` 자체는 무변경, 코드만 변경)는 대체로 기존 spec/코드 Rationale과
정합적이다 — TOCTOU 트랜잭션 롤백 원칙(§PR2b "동시성 cap admission gate")·RR-PL-05 체인 깊이
제한 보존·EIA §9.3 EIA-RL-04 "commit 후에만 emit" 원칙과는 충돌 없이 오히려 각각의 fail-open
결함(진단 불가 crash, chain-depth 우회, 종결 이벤트 조용한 유실)을 메우는 방향의 방어적 강화다.
다만 admission-throw 재전파 경로 하나는, `execution-run` 큐가 PR1 때부터 코드·spec 양쪽에
반복 명문화해 온 "`attempts:1` = 명시적 throw 는 재시도(redelivery) 안 됨, 오직 크래시 기반
stalled 만 재배달, 재시도 부재는 비멱등 노드 이중 실행 방지가 목적"이라는 확립된 설계와 어긋나는
"BullMQ 재배달로 자가 치유" 서술을 새로 도입했고, 같은 함수의 자매 catch 블록이 채택한 반대
전략(swallow + best-effort 종결, 명시적으로 "rethrow 는 이중 실행을 유발"이라는 이유로)과의
차이도 근거 없이 남아 있다. 실제 런타임 안전성(롤백·락 해제)은 다른 리뷰어들이 이미 검증했지만,
"재배달로 자가 치유된다"는 주장 자체는 기존 큐 설계 Rationale과 충돌하는 오서술이며 이미 한 차례
code-review 산출물에도 그대로 전파됐다 — 방치하면 향후 이 경로의 실제 장애(희귀하지만 발생 시
Execution 이 `pending`에 좌초)를 디버깅하는 엔지니어를 오도할 수 있다.

## 위험도

MEDIUM
