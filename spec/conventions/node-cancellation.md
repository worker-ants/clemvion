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
---

# Node Cancellation 컨벤션 (AbortSignal 전파 기반)

> 관련 문서: [노드 Output 규약](./node-output.md) · [parallel-p2.md 결정 A + H](../../plan/in-progress/parallel-p2.md) · [`node-handler.interface.ts`](../../codebase/backend/src/nodes/core/node-handler.interface.ts) ExecutionContext.abortSignal JSDoc

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
| `fetch(url, init)` | `init.signal = context.abortSignal` (자체 timeout 과 결합 시 cascade — 본 컨벤션 §4) |
| PostgreSQL (`pg`) | `client.cancel()` 호출을 `signal.addEventListener('abort', ...)` 으로 등록 |
| MongoDB | driver 의 `signal` 옵션 직접 전달 |
| Anthropic SDK | `client.messages.create({ ..., signal })` |
| OpenAI SDK | `client.chat.completions.create({ ..., signal })` |
| Email (nodemailer) | connection close 를 signal abort 시 등록 |

abort 시 throw 되는 `AbortError` 류는 노드가 그대로 throw — 엔진의 `errorPolicyHandler` 가 그 에러를 cancelled 의미로 분류한다 (별도 처리 없음).

### 2.2 CPU 바운드 / 즉시 완료 노드

signal 미지원 — best-effort. 자기 작업 완료까지 계속 진행해도 무방. 다만 작업 시작 직전에 `context.abortSignal?.aborted` 체크는 권장 (시작 전 cancel 된 경우 즉시 종료).

### 2.3 생산자 (signal 을 만들고 set 하는 caller)

- **`ParallelExecutor`** (parallel-p2 §5, 후속) — `errorPolicy === 'cancel-others-on-fail'` 일 때 내부 `AbortController` 생성, 첫 branch 실패 시 `controller.abort()` 호출, 각 `branchContext.abortSignal` 에 set
- **향후 Workflow 단위 timeout** — `runExecution` 진입 시 타이머 시작, 한도 초과 시 abort
- **향후 사용자 cancel 버튼** — REST API `POST /executions/:id/cancel` 가 BullMQ job 의 abort 채널을 통해 worker 측 abort
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

노드 핸들러는 abort 시 `error.name === 'AbortError'` 를 throw 또는 propagate. 엔진의 `errorPolicyHandler` 가 이 에러를 다음과 같이 분류:

- `errorPolicy === 'stop'` (default) — Parallel 또는 워크플로우 단위 FAILED 전이 (기존 동작과 동일)
- `errorPolicy === 'continue'` — 그 노드 cancelled 로 기록, 후속 분기 계속
- `errorPolicy === 'cancel-others-on-fail'` (parallel-p2 §5) — 이미 cancellation 중이므로 후속 분기도 cancelled 로 기록

`NodeExecution` 의 상태 분류는 본 컨벤션 범위 밖 — 현 `failed` 상태 + `error.name === 'AbortError'` 로 구분 가능. 별 `cancelled` status 추가는 후속 plan.

## 6. 본 PR 범위 / 후속

| 항목 | 본 PR | 후속 |
|---|---|---|
| `ExecutionContext.abortSignal?: AbortSignal` 신규 필드 | ✓ | — |
| spec convention 신설 | ✓ | — |
| HTTP 노드 signal 전파 | ✓ | — |
| HTTP 단위 테스트 | ✓ | — |
| DB 노드 signal 전파 | — | 후속 PR (driver 별 cancel 메커니즘 조사) |
| AI 노드 signal 전파 | — | 후속 PR (Anthropic / OpenAI SDK 의 signal 지원 확인) |
| Email / chat-channel 노드 signal 전파 | — | 후속 PR (driver / webhook 패턴 조사) |
| ExecutionEngineService 의 사전 abort 체크 (dispatch 직전) | — | 후속 PR |
| `NodeExecution.status = 'cancelled'` 추가 (엔티티 + migration) | — | 후속 plan (별 작업) |
| Parallel `cancel-others-on-fail` 통합 | — | parallel-p2 §5 (본 plan 이 unblock) |

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
