---
id: node-cancellation
status: partial
code:
  - codebase/backend/src/nodes/core/node-handler.interface.ts
  - codebase/backend/src/nodes/integration/http-request/http-request.handler.ts
  - codebase/backend/src/modules/executions/executions.controller.ts
  - codebase/backend/src/modules/executions/executions.service.ts
  - codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx
  - codebase/frontend/src/lib/api/executions.ts
pending_plans:
  - plan/in-progress/node-cancellation-infrastructure.md
  - plan/in-progress/spec-draft-node-execution-cancelled.md
---

# Node Cancellation 컨벤션 (AbortSignal 전파 기반)

> 관련 문서: [ExecutionContext 설계 규약](./execution-context.md) · [노드 Output 규약](./node-output.md) · [parallel-p2-followups.md 결정 A + H](../../plan/in-progress/parallel-p2-followups.md) · [`node-handler.interface.ts`](../../codebase/backend/src/nodes/core/node-handler.interface.ts) ExecutionContext.abortSignal JSDoc
>
> **SoT 분리**: `abortSignal` 이 `ExecutionContext` 의 어느 분류에 속하는지 (Stable core) 의 **필드 정의 SoT 는 [`execution-context.md`](./execution-context.md) §원칙 1**, 그 **동작 계약 (전파 의무·best-effort·에러 분류) SoT 는 본 문서** 다.

## 1. 목적

장기 외부 I/O 를 수행하는 노드 (HTTP / DB / AI / Email / chat-channel) 가 실행 도중 외부 cancellation 신호를 받을 수 있어야 한다. 그렇지 않으면 다음 기능이 모두 불가능:

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
| Anthropic SDK | `client.messages.create({ ..., signal })`. **구현됨** (AI 노드 — ai-agent / text-classifier / information-extractor). **단, IE(`information-extractor`) 의 multi-turn resume/continuation 경로(`processMultiTurnMessage`)는 abort 컨텍스트가 없어 signal 미전파 — 초기 실행 경로(`executeMultiTurn`)만 전파.** resume 경로는 turn 경계에서 abort 체크를 도입하는 별도 작업으로 추적 (`node-cancellation-infrastructure.md`). |
| PostgreSQL (`pg`) | `client.cancel()` 호출을 `signal.addEventListener('abort', ...)` 으로 등록. **미구현 (Planned)** — 현재 DB 노드는 진입 직전 `abortSignal?.aborted` 사전 체크만 (in-flight 쿼리 중단 X) |
| MongoDB | driver 의 `signal` 옵션 직접 전달. **미구현 (Planned)** |
| Email (nodemailer) | connection close 를 signal abort 시 등록. **미구현 (Planned)** — 현재 Email 노드는 진입 직전 사전 체크만 |
| OpenAI SDK | `client.chat.completions.create({ ..., signal })` (OpenAI 사용 노드 도입 시) |

abort 시 throw 되는 `AbortError` 류는 노드가 그대로 throw — 엔진의 `errorPolicyHandler` 가 그 에러를 cancelled 의미로 분류한다 (별도 처리 없음).

### 2.2 CPU 바운드 / 즉시 완료 노드

signal 미지원 — best-effort. 자기 작업 완료까지 계속 진행해도 무방. 다만 작업 시작 직전에 `context.abortSignal?.aborted` 체크는 권장 (시작 전 cancel 된 경우 즉시 종료).

### 2.3 생산자 (signal 을 만들고 set 하는 caller)

- **`ParallelExecutor`** (parallel-p2 §5, 구현됨) — `errorPolicy === 'cancel-others-on-fail'` 일 때 내부 `AbortController` 생성, 첫 branch 실패 시 `controller.abort()` 호출, 각 `branchContext.abortSignal` 에 set. 상위 `context.abortSignal` 이 있으면 그 abort 도 그룹 controller 로 cascade (`parallel-executor.ts`).
- **향후 Workflow 단위 timeout** — `runExecution` 진입 시 타이머 시작, 한도 초과 시 abort
- **사용자 cancel 버튼** (구현됨 2026-05-31) — REST API `POST /executions/:id/stop` 가 실행을 중단(running/pending → cancelled, waiting_for_input → continuation 취소). 에디터 툴바 Stop 버튼이 진입점.
- **향후 graceful shutdown** — SIGTERM 수신 시 진행 중 execution 의 abort

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

`error.name === 'AbortError'` 인 throw 는 노드가 **실패한 것이 아니라 중단된 것**이므로, 엔진이 해당 `NodeExecution.status` 를 `failed` 가 아닌 **`cancelled`** 로 기록한다 ([실행 엔진 §1.2](../../spec/5-system/4-execution-engine.md#12-nodeexecution-상태) / [데이터 모델 §2.14](../../spec/1-data-model.md#214-nodeexecution)). dispatch 직전 `context.abortSignal?.aborted` 가 이미 true 면 핸들러를 실행하지 않고 즉시 `cancelled` 로 기록한다 (사전 체크). 종료 시 `execution.node.cancelled` WS 이벤트를 발행해 타임라인이 `running` 에 영구 잔류하지 않도록 한다 ([WebSocket §4.4](../../spec/5-system/6-websocket-protocol.md#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input)). `output.error` 는 표준 봉투(`code: 'AbortError'`)로 기록하되 `meta.success = false`.

### 5.2 워크플로 흐름 — `errorPolicy`

노드 상태가 `cancelled` 여도 dispatch 루프 진행은 노드의 `errorPolicy` 가 결정한다:

- `errorPolicy === 'stop'` (default) — abort 가 상위 cancellation 컨텍스트에서 비롯됐으면 워크플로는 그 원인(사용자 cancel → Execution `cancelled`, cancel-others-on-fail → 최초 실패 원인으로 Execution `failed`)으로 마감. 단독 노드의 AbortError 자체가 워크플로를 새로 FAILED 시키지는 않는다.
- `errorPolicy === 'continue'` — 그 노드 `cancelled` 기록 후 후속 분기 계속.
- `errorPolicy === 'cancel-others-on-fail'` (parallel-p2 §5) — 이미 cancellation 중이므로 abort 된 후속 분기도 `cancelled` 로 기록. Root cause(최초 비-abort 실패)는 `ParallelExecutor` 가 별도 surface.

> **rehydration 실패는 `cancelled` 아님**: §7.5 의 `RESUME_*` 인프라 실패는 abortSignal 경로가 아니므로 NodeExecution 은 `failed` 로 종결한다 ([실행 엔진 Rationale §4](../../spec/5-system/4-execution-engine.md#rationale)).

## 6. 구현 현황 / 후속

> 2026-06-03 코드 대조로 갱신. ✓ = 구현됨, 🚧 = 부분 구현(사전 abort 체크만, in-flight 중단은 미구현), — = 미구현(Planned, 추적 plan: `node-cancellation-infrastructure.md`).

| 항목 | 상태 | 비고 |
|---|---|---|
| `ExecutionContext.abortSignal?: AbortSignal` 신규 필드 (필드 분류 SoT = [`execution-context.md`](./execution-context.md) §원칙 1, 동작 계약 SoT = 본 문서) | ✓ | `node-handler.interface.ts:193` |
| spec convention 신설 | ✓ | 본 문서 |
| HTTP 노드 signal 전파 (fetch cascade) | ✓ | `http-request.handler.ts` (§4 cascade 패턴) |
| HTTP 단위 테스트 | ✓ | `http-request.handler.spec.ts` |
| AI 노드 signal 전파 (Anthropic SDK `signal`) | ✓ | `ai-agent.handler.ts` / `text-classifier.handler.ts` / `information-extractor.handler.ts` 의 SDK 호출에 `signal: context.abortSignal` 전파 |
| Parallel `cancel-others-on-fail` 통합 | ✓ | `parallel-executor.ts` — `errorPolicy==='cancel-others-on-fail'` 시 그룹 `AbortController` 생성, 첫 분기 실패 시 abort, upstream cascade (parallel-p2 §5) |
| 사용자 cancel (`POST /executions/:id/stop` + 툴바 Stop) | ✓ | `executions.controller.ts` / `executions.service.ts` / `editor-toolbar.tsx` (§2.3) |
| DB 노드 signal 전파 | 🚧 | 사전 abort 체크만 (`database-query.handler.ts` — 진입 직전 `abortSignal?.aborted` → AbortError). in-flight `pg.client.cancel` 은 미구현 (Planned) |
| Email 노드 signal 전파 | 🚧 | 사전 abort 체크만 (`send-email.handler.ts`). in-flight SMTP `transporter.close()` 는 미구현 (Planned) |
| chat-channel 노드 signal 전파 | — | 미구현 (Planned) |
| `NodeExecution.status = 'cancelled'` 추가 (엔티티 + migration) + `AbortError` → `cancelled` 분류 + dispatch 사전 abort 체크 + `execution.node.cancelled` WS 이벤트 | ✓ | `NodeExecutionStatus.CANCELLED` enum + V069 migration + 엔진 분류/WS emit (§5.1) |
| Workflow 단위 timeout / graceful shutdown 의 노드 abort | — | 미구현 (Planned) |

## Rationale

본 컨벤션은 parallel-p2 결정 A 의 `cancel-others-on-fail` 요구 사항에서 시작했으나, 노드 단계 cancellation 은 그 외 여러 향후 기능 (Workflow timeout / 사용자 cancel / graceful shutdown) 에 공통으로 재사용되는 인프라다. 별 plan 으로 분리 (parallel-p2 결정 H) 한 근거.

표준 `AbortSignal` API 채택 근거:

- 모든 주요 SDK / fetch / driver 가 표준 지원 — 별도 wrapper 불필요
- 외부 timeout 과의 cascade 가 표준 패턴 (`AbortController` 의 abort 가 cascade)
- 향후 `AbortSignal.any([...])` (Node.js 18+) 또는 `AbortSignal.timeout(ms)` 같은 표준 유틸 활용 가능

`NodeHandler.execute` 시그니처 변경 없이 `ExecutionContext` 필드로 전파한 근거:

- 24개 프로덕션 핸들러의 시그니처 변경 = 모든 모듈 영향. 인프라 변경의 PR 크기 폭증
- ExecutionContext 는 이미 dispatch 직전 엔진이 주입하는 통합 진입점 — 신규 필드 추가 비용 작음
- 모듈별 점진 도입 가능 — 노드 핸들러가 `context.abortSignal` 을 읽는지 여부만 다를 뿐, 시그니처 변경 없음
