---
id: node-cancellation
status: partial
code:
  - codebase/backend/src/nodes/core/node-handler.interface.ts
  - codebase/backend/src/nodes/integration/http-request/http-request.handler.ts
  - codebase/backend/src/nodes/integration/database-query/database-query.handler.ts
  - codebase/backend/src/modules/executions/executions.controller.ts
  - codebase/backend/src/modules/executions/executions.service.ts
  - codebase/backend/src/modules/execution-engine/execution-engine.service.ts
  - codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts
  - codebase/backend/src/modules/execution-engine/retry-turn.service.ts
  - codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx
  - codebase/frontend/src/lib/api/executions.ts
pending_plans:
  - plan/in-progress/node-cancellation-residual-signal-propagation.md
---

# Node Cancellation 컨벤션 (AbortSignal 전파 기반)

> 관련 문서: [ExecutionContext 설계 규약](./execution-context.md) · [노드 Output 규약](./node-output.md) · [parallel-p2-followups.md 결정 A + H](../../plan/complete/parallel-p2-followups.md) · [`node-handler.interface.ts`](../../codebase/backend/src/nodes/core/node-handler.interface.ts) ExecutionContext.abortSignal JSDoc
>
> **SoT 분리**: `abortSignal` 이 `ExecutionContext` 의 어느 분류에 속하는지 (Stable core) 의 **필드 정의 SoT 는 [`execution-context.md`](./execution-context.md) §원칙 1**, 그 **동작 계약 (전파 의무·best-effort·에러 분류) SoT 는 본 문서** 다.

## 1. 목적

장기 외부 I/O 를 수행하는 노드 (HTTP / DB / AI / Email / 이커머스 통합 Cafe24·MakeShop) 가 실행 도중 외부 cancellation 신호를 받을 수 있어야 한다. 그렇지 않으면 다음 기능이 모두 불가능:

- **Parallel `cancel-others-on-fail` errorPolicy** (parallel-p2 결정 A) — 첫 분기 실패 시 다른 분기의 외부 I/O 를 즉시 중단
- **Workflow 단위 timeout** — 실행 시간 한도 초과 시 진행 중 노드의 외부 I/O 중단
- **사용자 cancel 버튼** — 실행 중 워크플로우를 UI 에서 중단 (구현됨, 2026-05-31: 에디터 툴바의 Stop 버튼이 `running` / `waiting_for_input` 상태에서 노출되어 `POST /executions/:id/stop` 호출 → 최종 `cancelled` 전이는 WS `execution.cancelled` 이벤트로 확정. `executions.controller.ts` / `editor-toolbar.tsx`)
- **WorkflowExecution graceful shutdown** — 서버 종료 시 진행 중 노드의 외부 I/O 중단

본 컨벤션은 노드 단계 cancellation 의 단일 메커니즘 — `ExecutionContext.abortSignal` 전파 — 을 정의한다.

## 2. 컨트랙트

`NodeHandler.execute(input, config, context)` 는 `context.abortSignal?: AbortSignal` 을 받는다. 노드 구현체는 다음 의무를 진다:

### 2.1 외부 I/O 노드 (소비자)

장기 외부 I/O 호출에 `context.abortSignal` 을 전파한다. 호출 API 별 패턴:

| 호출 | signal 전파 |
|---|---|
| `fetch(url, init)` | `init.signal = context.abortSignal` (자체 timeout 과 결합 시 cascade — 본 컨벤션 §4). **구현됨** (HTTP 노드) |
| Anthropic SDK | `client.messages.create({ ..., signal })`. **구현됨** (AI 노드 — ai-agent / text-classifier / information-extractor). **multi-turn resume/continuation 경로(`processMultiTurnMessage`)는 signal 이 아니라 §2.4 의 turn 경계 DB 관측으로 취소를 처리한다** (구현됨 2026-07-27) — 그 경로에는 전파할 signal 이 애초에 존재하지 않기 때문이다. 저장소 전체에서 `AbortController` 를 만드는 곳은 `parallel-executor.ts`(cancel-others-on-fail) 한 곳뿐이고 사용자 Stop 은 signal 을 만들지 않으므로, `ResumableMessageOptions.signal` 은 **현재 항상 `undefined` 인 executor-side plumbing** 이다(향후 abort 소스가 생기면 그때 전파되도록 열어둔 자리이지, 도입이 예정된 것은 아니다). 초기 실행 경로(`executeMultiTurn`)는 `context.abortSignal` 을 그대로 전파. **defense-in-depth timeout (signal 과 독립)**: AI Agent 는 모든 `chat` 호출(single-turn·multi-turn resume 포함)에 app-level 타임아웃(`AI_AGENT_LLM_CALL_TIMEOUT_MS`, 기본 10분)을 적용한다 — `withTimeout` 이 **자체 `AbortController`** 로 동작하므로 signal 유무와 무관하게 무기한 hang 을 상한한다. SoT: [ai-agent §12.16](../4-nodes/3-ai/1-ai-agent.md). |
| PostgreSQL (`pg`) / MySQL (`mysql2`) | `signal.addEventListener('abort', ...)` 로 in-flight 취소 등록. **구현됨** — abort 시 **별도 pool 연결**로 PG `SELECT pg_cancel_backend(<pid>)` / MySQL `KILL QUERY <threadId>` 를 발행해 진행 중 쿼리만 끊는다(연결 유지). 취소로 인한 driver 에러(PG `57014`/MySQL `ER_QUERY_INTERRUPTED`)는 catch 에서 `AbortError` 로 재throw 해 `cancelled` 로 분류(§5). best-effort — 취소 권한(PG owner / MySQL `PROCESS`)·타이밍에 의존하며 실패해도 무해. 정상 완료 시 리스너 해제(누수 방지). |
| MongoDB | driver 의 `signal` 옵션 직접 전달. **미구현 (Planned)** — 현 DB 노드는 pg/mysql 만 지원(mongo 미도입) |
| Email (nodemailer) | **의도적 best-effort — in-flight 미채택**. `transporter.close()` 를 전송 중 호출하면 부분/중복 전송 리스크가 있어 진입 직전 `abortSignal?.aborted` 사전 체크만 유지한다(SMTP 전송은 통상 단시간). 향후 안전한 중단 방식이 확인되면 재검토. |
| OpenAI SDK | `client.chat.completions.create({ ..., signal })` (OpenAI 사용 노드 도입 시) |

abort 시 throw 되는 `AbortError` 류는 노드가 그대로 throw — 엔진의 `errorPolicyHandler` 가 그 에러를 cancelled 의미로 분류한다 (별도 처리 없음).

### 2.2 CPU 바운드 / 즉시 완료 노드

signal 미지원 — best-effort. 자기 작업 완료까지 계속 진행해도 무방. 다만 작업 시작 직전에 `context.abortSignal?.aborted` 체크는 권장 (시작 전 cancel 된 경우 즉시 종료).

### 2.3 생산자 (signal 을 만들고 set 하는 caller)

- **`ParallelExecutor`** (parallel-p2 §5, 구현됨) — `errorPolicy === 'cancel-others-on-fail'` 일 때 내부 `AbortController` 생성, 첫 branch 실패 시 `controller.abort()` 호출, 각 `branchContext.abortSignal` 에 set. 상위 `context.abortSignal` 이 있으면 그 abort 도 그룹 controller 로 cascade (`parallel-executor.ts`).
- **Workflow 단위 시간 한도** (PR2a 구현 완료, 단 노드 abort 미통합) — 확정 설계는 wall-clock 타이머+abort 가 아니라 **active-running 누적 타임아웃**: dispatch loop 가 노드 사이마다 `assertActiveTimeWithinLimit` 를 호출해 누적 active 시간(`waiting_for_input` park 시간 제외)이 한도 초과면 `EXECUTION_TIME_LIMIT_EXCEEDED` 로 종결한다 (SoT: [execution-engine §8](../5-system/4-execution-engine.md#8-동시-실행-제한)). **진행 중 노드의 abortSignal abort 통합** (in-flight 외부 I/O 즉시 중단) 만 잔여 Planned — 현재는 다음 노드 경계에서 판정
- **사용자 cancel 버튼** (구현됨 2026-05-31) — REST API `POST /executions/:id/stop` 가 실행을 중단(running/pending → cancelled, waiting_for_input → continuation 취소). 에디터 툴바 Stop 버튼이 진입점이며 **Editor+ 전용**이다 — viewer 는 버튼이 노출되지 않고(FE `canEdit` 가드) 서버도 `@Roles('editor')` 로 403 을 낸다([1-auth §3.2](../5-system/1-auth.md) "Workflow 실행"·[에디터 실행 §4](../3-workflow-editor/3-execution.md)). **이 경로는 `AbortController` 를 만들지 않고 Execution 행만 UPDATE 한다** — 진행 중 dispatch 의 실제 중단은 §2.4 의 DB 관측 가드가 담당한다(2026-07-26 이전에는 그 가드가 없어 하류 노드가 계속 dispatch 됐다).
- **향후 graceful shutdown** — SIGTERM 수신 시 진행 중 execution 의 abort

### 2.4 DB 관측 취소 가드 (signal 이 아닌 경로)

> §2.3 이 다루는 `AbortSignal` 생산자와 **메커니즘이 다르다.** 이 절은 signal 을 만들지 않는
> 취소(사용자 Stop)를 엔진이 관측하는 방식을 규정한다. 두 절을 섞으면 "signal 사전 체크가
> 있으니 Stop 도 커버된다" 는 오독이 생긴다 — 실제로 그 오독이 결함의 배경이었다.

| | §2.3 `abortSignal` | §2.4 DB 관측 (본 절) |
|---|---|---|
| 신호 | 표준 `AbortSignal` API | Execution 행 `status` 재조회 |
| 관측 | 핸들러가 `signal.aborted` 를 읽거나 SDK/fetch 에 전파 | 엔진이 경계마다 DB 를 다시 읽음 |
| 왜 필요한가 | — | `abortSignal` 은 `ParallelExecutor` 가 branch context 에만 주입 → **선형 경로에선 항상 `undefined`**. 사용자 Stop 은 signal 을 만들지 않으므로 **재조회가 유일한 관측 수단** |
| throw | `error.name === 'AbortError'` (핸들러) | `ExecutionCancelledError` (엔진, `workflow-errors.ts`) |

- **노드 경계 재확인** (구현됨 2026-07-26) — `assertExecutionNotCancelled()` 를 dispatch 순회
  루프 3곳(`runExecution` / `runNodeDispatchLoop` / `executeInline`)과 컨테이너·Parallel 반복
  (`executeContainerBody` 아이템 경계 / `executeParallelBranchBody` 노드 경계)에서 호출해
  외부 cancel 을 관측하고 `ExecutionCancelledError` 로 dispatch 를 중단한다.
- **turn 경계 재확인** (구현됨 2026-07-27) — AI multi-turn 은 turn 마다 park 로 세그먼트가
  끝나 위 노드 경계에 닿지 않는다. 그래서 `AiTurnOrchestrator` 가 **turn 경계**에서 같은
  가드를 직접 호출한다. §5.2 의 오분류를 피하려면 이 호출은 turn 실패를 `FAILED` 로 마감하는
  try/catch **바깥**에 있어야 한다.
- **park↔resume 짝 전이 terminal 가드** (구현됨 2026-07-27) — Execution 과 NodeExecution 을
  한 트랜잭션으로 전이시키는 경로는 같은 트랜잭션 안에서 대상 행을 `SELECT … FOR UPDATE` 로
  잠그고 **비-terminal 을 확인한 뒤에만** 쓴다. 확인 없이 쓰면 턴 진행 중 도착한 Stop 이
  덮여 **취소가 지연되는 게 아니라 소실**된다. 선점이 관측되면 짝 `NodeExecution` 을
  `cancelled` 로 마킹한 뒤 `ExecutionCancelledError` 를 전파한다.
> **terminal 정의의 opt-in 파라미터화 (2026-07-30)**: `execution.retry_last_turn` 재진입에
> 한해 DB 가드의 "비-terminal" 판정에 `failed` 가 조건부로 포함된다(`allowRetryReentry` opt-in).
> 상태머신에만 반영하고 DB 가드에 전파하지 않으면 재진입 전이가 항상 0행이 된다 — 상세는
> [실행 엔진 §1.1](../5-system/4-execution-engine.md#11-execution-상태) 예외 각주.

- **retry 재진입 종결 경로 terminal 가드** (구현됨 2026-07-28) — `execution.retry_last_turn`
  재진입의 종결(`completed`/`failed`/`cancelled`)은 in-memory 엔티티를 신뢰하지 않는다.
  재진입 전이(`failed → running`)가 **다른 엔티티 인스턴스**에 적용되므로 종결 시점의
  in-memory `status` 는 stale 할 수 있다. 그래서 종결 직전 **행을 재조회해 비-terminal 을
  확인**하고, 그 상태에서 목표로의 전이가 불가하거나 조건부 UPDATE 가 0행이면
  **저장·종결 이벤트 발행을 모두 skip** 한다. 확인 없이 쓰면 턴 진행 중 도착한 Stop 이
  `failed`/`completed` 로 덮여 **취소가 소실**된다.

## 3. signal 전파 흐름

```
[producer]                         [ExecutionContext]              [consumer node]
ParallelExecutor                   abortSignal: AbortSignal
  ↓ branch context clone               ↓ injected into clone           ↓ handler.execute
  AbortController.signal     →     context.abortSignal       →      fetch(url, { signal: ... })
                                                                     SDK.call({ signal })
                                                                     ...
```

생산자는 `AbortController` 생성 후 그 `signal` 을 cancellation 컨텍스트 (e.g., branch context) 의 `abortSignal` 에 set. 소비자는 자기 호출에 전파.

## 4. fetch 의 자체 timeout 과의 cascade

HTTP 노드는 자체 timeout (config.`timeout`) 을 위해 별도 `AbortController` 를 사용한다. `context.abortSignal` 과 cascade 패턴:

```ts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeout);
fetchOptions.signal = controller.signal;

const upstream = context.abortSignal;
if (upstream) {
  if (upstream.aborted) {
    controller.abort();
  } else {
    const onAbort = () => controller.abort();
    upstream.addEventListener('abort', onAbort, { once: true });
    controller.signal.addEventListener(
      'abort',
      () => upstream.removeEventListener('abort', onAbort),
      { once: true },
    );
  }
}
```

상하 모두 abort 시 fetch 가 즉시 throw — cleanup 의무는 fetch API 가 보장.

## 5. `AbortError` 분류

노드 핸들러는 abort 시 `error.name === 'AbortError'` 를 throw 또는 propagate. 엔진은 이 에러를 **노드 상태**와 **워크플로 흐름** 두 축으로 분류한다.

### 5.1 NodeExecution 상태 — `cancelled`

> **두 sentinel 이 같은 상태로 귀결된다.** `error.name === 'AbortError'`(§2.3, **핸들러**가 던짐)와
> `ExecutionCancelledError`(§2.4, **엔진 dispatch/turn 경계 가드**가 던짐)는 발생 지점이 다르지만
> 둘 다 `NodeExecution.status = cancelled` / `Execution.status = cancelled` 로 귀결된다.
> 분류는 어느 쪽이든 `instanceof`/`error.name` 으로 하며 에러 문구는 판정에 영향을 주지 않는다.

`error.name === 'AbortError'` 인 throw 는 노드가 **실패한 것이 아니라 중단된 것**이므로, 엔진이 해당 `NodeExecution.status` 를 `failed` 가 아닌 **`cancelled`** 로 기록한다 ([실행 엔진 §1.2](../../spec/5-system/4-execution-engine.md#12-nodeexecution-상태) / [데이터 모델 §2.14](../../spec/1-data-model.md#214-nodeexecution)). dispatch 직전 `context.abortSignal?.aborted` 가 이미 true 면 핸들러를 실행하지 않고 즉시 `cancelled` 로 기록한다 (사전 체크). 종료 시 `execution.node.cancelled` WS 이벤트를 발행해 타임라인이 `running` 에 영구 잔류하지 않도록 한다 ([WebSocket §4.1](../../spec/5-system/6-websocket-protocol.md#41-실행-이벤트-server--client)). `output.error` 는 표준 봉투(`code: 'AbortError'`)로 기록하되 `meta.success = false`.

### 5.2 워크플로 흐름 — `errorPolicy`

노드 상태가 `cancelled` 여도 dispatch 루프 진행은 노드의 `errorPolicy` 가 결정한다:

- `errorPolicy === 'stop'` (default) — abort 가 상위 cancellation 컨텍스트에서 비롯됐으면 워크플로는 그 원인(사용자 cancel → Execution `cancelled`, cancel-others-on-fail → 최초 실패 원인으로 Execution `failed`)으로 마감. 단독 노드의 AbortError 자체가 워크플로를 새로 FAILED 시키지는 않는다.
- `errorPolicy === 'continue'` — 그 노드 `cancelled` 기록 후 후속 분기 계속.
- `errorPolicy === 'cancel-others-on-fail'` (parallel-p2 §5) — 이미 cancellation 중이므로 abort 된 후속 분기도 `cancelled` 로 기록. Root cause(최초 비-abort 실패)는 `ParallelExecutor` 가 별도 surface.

> **두 sentinel 의 governance 가 다르다.** 위 표는 **`AbortError`(§2.3, 핸들러 발생)** 에만
> 적용된다. **`ExecutionCancelledError`(§2.4, 엔진 발생)** 는 `errorPolicy` 와 **무관하게 항상
> 우회 재throw** 된다 — `ForEachExecutor`·`ParallelExecutor` 는 `errorPolicy` 판정 **이전에**
> 이 sentinel 을 재throw 하므로 `skip`/`continue` 여도 계속하지 않는다. 설계 의도는
> "사용자 Stop 을 `continue` 정책이 무효화하면 안 된다" 이며, 그러지 않으면 취소가 노드별
> 정책에 따라 조용히 무시된다.

> **rehydration 실패는 `cancelled` 아님**: §7.5 의 `RESUME_*` 인프라 실패는 abortSignal 경로가 아니므로 NodeExecution 은 `failed` 로 종결한다 ([실행 엔진 Rationale §4](../../spec/5-system/4-execution-engine.md#rationale)).

## 6. 구현 현황 / 후속

> 2026-07-28 코드 대조로 갱신. ✓ = 구현됨, 🚧 = 부분 구현(사전 abort 체크만, in-flight 중단은 미구현), — = 미구현(Planned, 추적 plan: `node-cancellation-residual-signal-propagation.md`), N/A = 범주 오류로 대상에서 철회(애초에 노드가 아님).

| 항목 | 상태 | 비고 |
|---|---|---|
| `ExecutionContext.abortSignal?: AbortSignal` 신규 필드 (필드 분류 SoT = [`execution-context.md`](./execution-context.md) §원칙 1, 동작 계약 SoT = 본 문서) | ✓ | `node-handler.interface.ts:193` |
| spec convention 신설 | ✓ | 본 문서 |
| HTTP 노드 signal 전파 (fetch cascade) | ✓ | `http-request.handler.ts` (§4 cascade 패턴) |
| HTTP 단위 테스트 | ✓ | `http-request.handler.spec.ts` |
| AI 노드 signal 전파 (Anthropic SDK `signal`) | ✓ | `ai-agent.handler.ts` / `text-classifier.handler.ts` / `information-extractor.handler.ts` 의 SDK 호출에 `signal: context.abortSignal` 전파 |
| AI 노드 signal 단위 테스트 | ✓ | `text-classifier.handler.spec.ts` · `information-extractor.handler.spec.ts`(single-turn; multi-turn 초기 경로는 W4) · `ai-agent.handler.spec.ts`(SUMMARY#16) — `context.abortSignal` 이 `llmService.chat` 으로 전파됨을 검증 |
| Parallel `cancel-others-on-fail` 통합 | ✓ | `parallel-executor.ts` — `errorPolicy==='cancel-others-on-fail'` 시 그룹 `AbortController` 생성, 첫 분기 실패 시 abort, upstream cascade (parallel-p2 §5) |
| 사용자 cancel (`POST /executions/:id/stop` + 툴바 Stop) | ✓ | `executions.controller.ts` / `executions.service.ts` / `editor-toolbar.tsx` (§2.3). **Execution 행 UPDATE 까지가 이 행의 범위** — 진행 중 dispatch 의 실제 중단은 아래 §2.4 가드 행이 담당한다(2026-07-26 이전엔 그 가드가 없어 하류 노드가 계속 dispatch 됐다) |
| DB 노드 signal 전파 | ✓ | 사전 abort 체크 + **in-flight 취소** (`database-query.handler.ts` — abort 시 별도 연결로 PG `pg_cancel_backend`/MySQL `KILL QUERY`, 취소 driver 에러→`AbortError` 재throw). 단위 테스트 `database-query.handler.spec.ts` 의 `in-flight cancellation (node-cancellation §2.1)` describe |
| Email 노드 signal 전파 | 🚧 | 사전 abort 체크만 (`send-email.handler.ts`). in-flight SMTP 중단은 **의도적 best-effort(미채택)** — `transporter.close()` 부분/중복 전송 리스크 |
| ~~chat-channel 노드 signal 전파~~ | N/A | **범주 오류로 철회** — chat-channel 은 노드가 아니라 `webhook` 트리거의 `config.chatChannel` 변형이고([데이터 모델 §2.8](../1-data-model.md#28-trigger)), 구현체 `modules/chat-channel/**` 는 `executionEvents$` 를 구독하는 **outbound 어댑터**다 ([Chat Channel](../5-system/15-chat-channel.md) CCH-AD-05 · 별도 노드로 두지 않은 근거는 같은 문서 Rationale R1). 따라서 §4 cascade 대상이 아니며, 취소 시 이 어댑터의 책임은 오히려 `execution.cancelled` 를 **발송**하는 것이다 |
| MakeShop 노드 signal 전파 | ✓ | `makeshop-api.client.ts` 의 §4 cascade(already-aborted 분기 포함) **와** `makeshop.handler.ts` 의 §5.1 `AbortError` 재throw — 둘 다 있어야 엔진이 `cancelled` 로 분류한다. 단위 테스트 `makeshop-api.client.spec.ts` · `makeshop.handler.spec.ts`("rethrows AbortError so the ENGINE can classify") |
| Cafe24 노드 signal 전파 | ✓ | MakeShop 과 동일 구조 (`cafe24-api.client.ts` · `cafe24.handler.ts`). 단위 테스트 `cafe24-api.client.spec.ts` · `cafe24.handler.spec.ts` |
| `NodeExecution.status = 'cancelled'` 추가 (엔티티 + migration) + `AbortError` → `cancelled` 분류 + dispatch 사전 abort 체크 **(노드-레벨 `abortSignal`)** + `execution.node.cancelled` WS 이벤트 | ✓ | `NodeExecutionStatus.CANCELLED` enum + V069 migration + 엔진 분류/WS emit (§5.1). 이 행은 **signal 경로 한정** — 사용자 Stop 커버리지는 아래 §2.4 행을 볼 것 |
| §2.4 노드 경계 Execution-cancel 재확인 가드 (`assertExecutionNotCancelled`) | ✓ | `execution-engine.service.ts` — 선형 3곳(`runExecution`/`runNodeDispatchLoop`/`executeInline`) + 컨테이너(`executeContainerBody`, 아이템 경계, 250ms 스로틀)/Parallel(`executeParallelBranchBody`, 노드 경계) 반복 루프. mutation 검증 완료 |
| §2.4 AI multi-turn **turn 경계** cancel 가드 | ✓ | `ai-turn-orchestrator.service.ts` — park 가 세그먼트를 끝내 노드 경계 가드에 닿지 않으므로 turn 마다 직접 관측. turn 실패를 `FAILED` 로 마감하는 try/catch **바깥**에 배치(안에 두면 취소가 실패로 오분류) |
| §2.4 park↔resume 짝 전이 terminal 가드 | ✓ | `execution-engine.service.ts` — 짝 전이·`finalizeFailedExecution`·`failFirstSegmentSetup`·`executeSync` timeout 이 같은 트랜잭션에서 `SELECT … FOR UPDATE` 로 비-terminal 확인 후에만 쓰기. 선점 시 짝 `NodeExecution` 을 `cancelled` 마킹 후 `ExecutionCancelledError` 전파. mutation 6/6 검증 |
| §2.4 retry 재진입 종결 경로 terminal 가드 | ✓ | `retry-turn.service.ts` — `completeRetryExecution`/`failRetryExecution` 이 공용 `finalizeGuarded` 로 **행을 재조회해 비-terminal 을 확인한 뒤** 전이한다. 선점이 관측되면(전이 불가 또는 조건부 UPDATE `affected=0`) **저장·종결 이벤트 emit 을 모두 skip**. 취소 시각 보존 메커니즘은 짝 전이 행과 다르다 — 아래 Rationale 참조. mutation 13/13 검증 |
| Workflow 단위 timeout / graceful shutdown 의 **노드 abort** | — | 노드 abort 통합 미구현 (Planned). 단 **워크플로 시간 한도 자체는 PR2a 구현 완료** — active-running 누적 타임아웃 (`assertActiveTimeWithinLimit`, 노드 경계 판정, §2.3 / [execution-engine §8](../5-system/4-execution-engine.md#8-동시-실행-제한)) |

## Rationale

### 왜 취소 시각 보존 메커니즘이 두 가지인가 (2026-07-28)

이미 `cancelled` 인 행에 종결 경로가 재도달할 때 `stop()` 이 쓴 `finishedAt`/`durationMs` 를
보존하는 방식이 §2.4 소비자별로 다르다.

- `execution-engine.service.ts` 의 `finalizeCancelledExecution` — **앱 레벨 `??` 병합**
  (in-memory 값이 비어 있을 때만 채우고, guarded UPDATE 가 이미 terminal 인 행을 걸러낸다).
- `retry-turn.service.ts` 의 `finalizeGuarded` — **SQL `COALESCE(col, :new)`**.

후자를 택한 이유는 재조회(`SELECT`)와 `UPDATE` 사이의 창을 신뢰하지 않기 위함이다. UPDATE 문
자체에서 그 순간의 DB 값을 재평가하므로, 그 사이 다른 트랜잭션이 값을 채웠더라도 덮지 않는다.
앱 레벨 병합은 `SELECT` 시점 스냅샷을 근거로 판단하므로 같은 창을 닫지 못한다.

두 방식 모두 "**먼저 커밋된 취소 시각이 정본**" 이라는 동일 계약을 만족한다. 취소 시
`error` 를 저장하지 않는 것도 양쪽 공통이다 — REST 로 내부 예외 메시지가 노출되는 것을 막고,
취소를 실패와 구분하기 위함이다.

본 컨벤션은 parallel-p2 결정 A 의 `cancel-others-on-fail` 요구 사항에서 시작했으나, 노드 단계 cancellation 은 그 외 여러 향후 기능 (Workflow timeout / 사용자 cancel / graceful shutdown) 에 공통으로 재사용되는 인프라다. 별 plan 으로 분리 (parallel-p2 결정 H) 한 근거.

표준 `AbortSignal` API 채택 근거:

- 모든 주요 SDK / fetch / driver 가 표준 지원 — 별도 wrapper 불필요
- 외부 timeout 과의 cascade 가 표준 패턴 (`AbortController` 의 abort 가 cascade)
- 향후 `AbortSignal.any([...])` (Node.js 18+) 또는 `AbortSignal.timeout(ms)` 같은 표준 유틸 활용 가능

`NodeHandler.execute` 시그니처 변경 없이 `ExecutionContext` 필드로 전파한 근거:

- 24개 프로덕션 핸들러의 시그니처 변경 = 모든 모듈 영향. 인프라 변경의 PR 크기 폭증
- ExecutionContext 는 이미 dispatch 직전 엔진이 주입하는 통합 진입점 — 신규 필드 추가 비용 작음
- 모듈별 점진 도입 가능 — 노드 핸들러가 `context.abortSignal` 을 읽는지 여부만 다를 뿐, 시그니처 변경 없음

### 왜 §2.4 는 signal 이 아니라 DB 관측인가 (2026-07-27)

사용자 Stop(`POST /executions/:id/stop`)은 **`AbortController` 를 만들지 않는다** — Execution 행을
UPDATE 할 뿐이다. 그리고 저장소 전체에서 `AbortController` 를 만드는 곳은
`parallel-executor.ts`(cancel-others-on-fail) 한 곳뿐이라, **선형 경로와 resume 경로에서
`context.abortSignal` 은 항상 `undefined`** 다. 따라서 "signal 을 전파하면 된다" 는 접근은
전파할 대상이 없어 성립하지 않는다 — 엔진이 경계마다 행을 다시 읽는 것이 유일한 관측 수단이다.

이 사실은 두 번 반증의 대가로 확정됐다. (1) "선형 경로 cancel 전파" 티켓 초안은
`context.abortSignal?.throwIfAborted()` 를 보장 근거로 들었으나 그 필드가 늘 `undefined` 라
근거가 되지 못했다. (2) IE resume 티켓은 "signal 미전파가 문제이고 타임아웃으로 완화된다" 고
적었으나, 실제 결함은 signal 부재가 아니라 **취소 소실**이었다(아래).

### 왜 짝 전이에 terminal 가드가 필요한가 (2026-07-27)

park↔resume 경로는 Execution 을 메모리에 로드한 뒤 **재로드하지 않는다.** 그래서 턴이 진행되는
동안(LLM 호출은 수 초~수 분) 도착한 Stop 이 DB 를 `cancelled` 로 바꿔도 in-memory 엔티티는
`running` 이고, 상태 전이 검사는 `running → waiting_for_input` 을 정상으로 통과시킨다. 가드가
없으면 그 쓰기가 `cancelled` 를 덮어써 **사용자가 누른 Stop 이 지연되는 게 아니라 사라진다.**

같은 트랜잭션 안에서 행을 잠그는(`SELECT … FOR UPDATE`) 이유는 검사와 쓰기 사이의 창을 없애기
위해서다. 재조회 후 별도 쓰기로 나누면 그 사이에 Stop 이 끼어들 수 있다 — 실제로 그 형태의
잔여 창이 리뷰에서 지적돼 원자화로 다시 닫았다.

### 왜 아이템 경계 가드에 250ms 스로틀을 두나

`assertExecutionNotCancelled` 는 컨테이너(ForEach/Loop/Map) 에서 **노드 경계가 아니라 아이템
경계마다** 호출된다. ForEach 입력 배열에는 길이 상한이 없고 중첩 컨테이너는 곱셈적이라, 무스로틀이면
아이템 수에 선형 비례하는 순차 DB 왕복이 누적된다. `CONTAINER_CANCEL_CHECK_THROTTLE_MS = 250`
이내 재호출은 직전 결과를 재사용한다.

카운트 기반(예: N개마다 1회)을 기각한 이유는 **아이템당 소요 시간이 균일하지 않기 때문**이다 —
빠른 아이템 1000개와 느린 아이템 10개에서 같은 카운트가 전혀 다른 지연을 뜻한다. 시간 기준은
"취소 관측이 최대 250ms 늦어진다" 는 상한을 아이템 특성과 무관하게 보장한다. 노드 경계(선형·
Parallel 브랜치) 호출부는 스로틀을 쓰지 않아 기존과 동일하게 매번 조회한다.
