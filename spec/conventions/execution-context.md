---
id: execution-context
status: implemented
code:
  - codebase/backend/src/nodes/core/node-handler.interface.ts
  - codebase/backend/src/modules/execution-engine/context/execution-context.service.ts
  - codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts
---

# ExecutionContext 설계 규약 (God Object 방지)

> 관련 문서: [Node Cancellation 컨벤션](./node-cancellation.md) · [노드 Output 규약](./node-output.md) · [Parallel 노드 §Rationale 결정 G](../4-nodes/1-logic/10-parallel.md) · [`node-handler.interface.ts`](../../codebase/backend/src/nodes/core/node-handler.interface.ts) `ExecutionContext`
>
> 필드 정의 SoT 는 본 문서, 실제 타입 정의 SoT 는 `node-handler.interface.ts` + [`spec/5-system/4-execution-engine.md`](../5-system/4-execution-engine.md) §5.5 / §6.1.

## Overview (목적)

`ExecutionContext` 는 엔진이 dispatch 직전 모든 노드 핸들러에 주입하는 단일 실행 컨텍스트다. 기능이 추가될 때마다 기능별 필드를 직접 얹으면 (`parentParallelConcurrency`, `abortSignal` 처럼) 시간이 지나며 **God Object** 로 비대해지고, 특정 컨테이너에서만 의미 있는 필드가 전 노드에 노출돼 책임 경계가 흐려진다 (2026-05-30 ai-review SUMMARY#11).

본 규약은 `ExecutionContext` 의 필드 분류 기준과, 새 필드를 추가할 때 따라야 할 결정 규칙을 정의한다. 기존 필드를 소급해 재배치하지 않으며, **앞으로의 변경**에 적용한다.

## 1. 설계 원칙

### 원칙 1 — Stable core

`ExecutionContext` 는 **모든 노드가 공통으로 필요로 하는 최소 필드만** 유지한다.

- **식별**: `workflowId`, `executionId`, `nodeExecutionId`
- **실행 표준**: `variables`, `nodeOutputCache`, `structuredOutputCache`, `rawConfig`, `recursionDepth` (`nodeOutputCache` / `structuredOutputCache` 는 Parallel 분기 진입 시 shallow copy 로 격리 — [10-parallel.md §Rationale "branch cache 격리"](../4-nodes/1-logic/10-parallel.md) 참조)
- **cross-cutting cancellation**: `abortSignal?: AbortSignal` — optional, best-effort 컨벤션 (전 노드 필수 아님). **동작 계약 SoT 는 [`node-cancellation.md`](./node-cancellation.md) §2 에 위임**하고, 본 문서는 필드가 Stable core 에 속한다는 **분류 SoT** 만 보유.

> 위 목록은 본 규약이 직접 거론하는 발췌다. 전체 필드 정의는 `node-handler.interface.ts` 가 SoT (`conversationThread`, `itemContext`, `loopContext`, `expressionContext` 등 포함).

### 원칙 2 — Container-specific fields

특정 컨테이너 노드의 내부에서만 의미 있는 필드는 `ExecutionContext` 에 직접 얹지 않고 **별도 인터페이스로 확장**한다.

```typescript
interface ParallelBranchContext extends ExecutionContext {
  parentParallelConcurrency: number; // required — Parallel 컨테이너 내부에서만 의미
}
```

✅ **결정 (2026-05-30 C-1 옵션 a 채택)**: 중첩 Parallel concurrency 전파용 `parentParallelConcurrency` 는 본 원칙에 따라 `ParallelBranchContext` 로 분리한다. 이는 [Parallel 노드 §Rationale 결정 G](../4-nodes/1-logic/10-parallel.md) 가 본 필드를 `ExecutionContext` 에 직접 추가했던 것을 번복한 결정으로, 같은 문서의 결정 G 갱신과 [`parallel-p2-followups.md`](../../plan/in-progress/parallel-p2-followups.md) §7 (구현 책임 plan) 이 추적한다.

### 원칙 3 — No runtime optional sprawl

**새 cross-cutting 기능을 추가할 때** `ExecutionContext` 에 optional 필드를 직접 늘리는 것을 금지한다.

- **전체 노드 공통 기능** → `ExecutionContext` 에 추가 + `node-handler.interface.ts` 갱신 + 본 문서에 분류 근거 기록.
- **특정 컨테이너/기능 한정** → `ContainerXBranchContext extends ExecutionContext` 로 확장 (원칙 2).

> **소급 적용 대상 아님**: 기존 cross-cutting 필드 (`abortSignal`, `rawConfig`, `recursionDepth` 등) 는 각자 도입 시점의 Rationale 을 보유한다. 본 원칙은 그것들을 재배치하라는 뜻이 아니라, **앞으로 추가되는 필드**가 분류 기준을 통과하도록 한다.

### 원칙 4 — Engine-internal infrastructure fields (`_`-prefix)

노드 핸들러가 **읽지 않고** 엔진의 그래프 순회·컨텍스트 라우팅에만 쓰이는 상태는 `_`-prefix 로 표기해 internal 임을 신호하고, `node-handler.interface.ts` 에 `_`-prefix optional 로 두되 **핸들러 계약 표면에는 포함하지 않는다**. Stable core(전 노드 공통 소비) 도 container-specific(원칙 2) 도 아닌 **엔진 전용** 범주다.

- 선례: `_executedNodes` (sub-workflow inline 순회), `_resumeState` / `_retryState` (재개·리트라이 continuation), `_contextKey` (in-memory Map 라우팅 키 — 아래). 이들은 본 분류 체계 도입 이전에 추가됐으며, 원칙 4 신설과 함께 소급 분류한다.
- `_callStack?: ResumeCallStackFrame[]` — 중첩 `executeInline` 호출 체인을 park/재개하기 위한 엔진 내부 프레임 스택. fresh park 시 durable `Execution.resume_call_stack`(V087) 으로 영속되고, rehydration 이 이 스택으로 sub-workflow 프레임을 frame-by-frame 재진입한다. **핸들러 비소비** — 엔진(`driveCallStackResume`/`driveResumeFrame`)만 참조한다. spec 참조: [execution-engine §7.5](../5-system/4-execution-engine.md#75-resume-after-restart-rehydration).
- `_contextKey?: string` — `ExecutionContextService` 의 in-memory `Map<key, ExecutionContext>` 라우팅 키. **기본값 = `executionId`** (비-background context 는 항상 동일 → 동작 불변). background 서브그래프 한정으로 `bg:<executionId>:<backgroundRunId>` 형태의 별도 키를 쓴다. **in-memory Map 라우팅 전용** — Redis 키 패턴([execution-engine §9.1](../5-system/4-execution-engine.md#91-키-패턴))과 무관하다.

### 원칙 5 — `variables.__*` 시스템 예약 네임스페이스 (double-underscore)

`ExecutionContext.variables` 는 사용자 정의 워크플로 변수 맵이지만, 엔진이 실행 시작 시 **시스템 값**을 `__`(double-underscore) prefix 키로 이 맵에 주입한다. 이 `__*` 는 **예약 prefix 네임스페이스**로 취급한다 — 사용자 변수는 `__` 를 쓰지 않는 것을 규약으로 한다(단, 아래 "강제 갭" 참조).

- 선례(코드 SoT `node-handler.interface.ts` JSDoc): `__workspaceId`(실행 시작 시 `workflow.workspaceId` 주입 — Integration 조회·LLM 설정 등 워크스페이스 단위 리소스 해소), `__workspaceName`(`Workspace.name` 복제 — AI System Context Prefix), `__workspaceTimezone`(`Workspace.settings.timezone`, IANA — System Context Prefix·Schedule default timezone 해소), `__dryRun`(Re-run dry-run 모드 — [replay-rerun §7.2](../5-system/13-replay-rerun.md)). 신규 시스템 주입 값은 반드시 `__` prefix 를 쓴다.
- **top-level `_`-prefix(원칙 4)와 구분**: 원칙 4 는 `ExecutionContext` **최상위**의 엔진 전용 필드(`_resumeState`·`_contextKey` 등, 핸들러 계약 비노출)이고, 본 원칙은 사용자-표면 `variables` **맵 내부**에 주입되는 시스템 값이다 — 스코프(top-level vs. `variables` 맵)와 prefix(단일 `_` vs. 이중 `__`)가 모두 다르다.
- 영속 정책: park durable 영속(`Execution.user_variables`)은 **시스템 `__*` 를 제외**하고(`filterUserVariables` — `!key.startsWith('__')`) 사용자 정의분만 저장하며, 재개 시 엔진이 `__*` 를 재주입한다 ([execution-engine §6.1 컨텍스트 구조 / §6.2 저장 전략](../5-system/4-execution-engine.md#61-컨텍스트-구조)).
- **강제 (3계층)**: 본 예약은 Variable Declaration / Modification 노드에서 `RESERVED_VARIABLE_NAME` 으로 강제된다. `handler.validate` 는 실행 시점에만 돌고 변수 이름 필드는 `{{ }}` 표현식 대상이라(두 노드는 `EXPRESSION_EXCLUSIONS` 에 없다) 어느 한 계층도 단독으로는 충분하지 않다. 세 계층이 함께 예약을 강제한다:
  - **L0 저장 시점** — `WorkflowsService.saveCanvas` / `importWorkflow` 가 리터럴 `__` 이름을 400 (`RESERVED_VARIABLE_NAME`, `details.offenders[]`)으로 거부한다. `restoreVersion` 은 사전-게이트 스냅샷 복원이라 이 게이트를 건너뛴다(`validateManualTrigger` 파라미터 스키마 게이트와 동일한 legacy-data escape).
  - **L1 pre-flight** — 두 노드의 `validateConfig` 가 리터럴 `__` 이름을 반환하고, 엔진이 `INVALID_NODE_CONFIG` 로 실행 직전 차단한다. 저장 게이트를 우회해 들어온 데이터의 backstop.
  - **L2 런타임** — 핸들러 `execute` 가 **해석된** 이름을 재검사해 throw 한다. `{{ }}` 로 만들어진 이름은 오직 여기서만 실제 값이 드러나므로 이 계층이 예약의 **실질 강제 지점**이다. 코드 SoT: [`reserved-variable-name.util.ts`](../../codebase/backend/src/nodes/logic/_shared/reserved-variable-name.util.ts). 선례: carousel `button.id` 의 `__item_` prefix schema-level reject.
- **강제 범위 밖 (잔여 리스크)**: **Code 노드**(`$vars` 전체 atomic replace, `nodes/data/code/code.handler.ts`)는 사용자 코드가 `$vars.__workspaceId` 를 써도 필터 없이 `context.variables` 를 통째로 덮어쓴다. 임의 코드 실행 노드에 이름 화이트리스트를 강제하는 것은 별개 결정이라 본 강제 범위 밖이다(§Rationale). 또한 park 필터(`filterUserVariables` — `!key.startsWith('__')`)는 여전히 `__*` 를 drop 하지만, L0/L1/L2 강제로 사용자 정의 `__*` 변수가 애초에 생기지 않으므로 (b) silent 소실 리스크는 두 변수 노드 경로에서는 해소된다.

## 2. 새 필드 추가 결정 규칙

| 질문 | 예 | 아니오 |
| --- | --- | --- |
| 모든(또는 대다수) 노드가 읽는가? | `ExecutionContext` 에 추가 | ↓ |
| 특정 컨테이너 내부 분기에서만 의미 있는가? | `XBranchContext extends ExecutionContext` 로 분리 (원칙 2) | ↓ |
| cross-cutting 이지만 일부 노드만 소비하는가? (예: cancellation) | `ExecutionContext` 의 **optional** 필드 + best-effort 컨벤션 문서(별 SoT)에 동작 계약 위임 | ↓ |
| 핸들러가 읽지 않고 엔진 순회·라우팅에만 쓰는가? | `_`-prefix 엔진 내부 필드 (원칙 4 — `node-handler.interface.ts` optional, 핸들러 계약 비노출) | 재검토 |

## 3. 진단 정책 (`[ctx-trace]`)

`ExecutionContextService` 는 context 생명주기의 핵심 이벤트를 `[ctx-trace]` prefix 로 구분된 로그로 남긴다 — `createContext` OVERWRITE, `deleteContext`, `setNodeOutput` MISSING, `setStructuredOutput`/`setEngineResolvedConfig` MISSING. production 로그에서 `[ctx-trace]` 로 grep 해 context race·키 라우팅 오류를 추적한다.

setter 의 context 미존재(키 라우팅 오류) 시 동작은 두 정책으로 갈린다:

| setter | context 미존재 시 | 근거 |
| --- | --- | --- |
| `setNodeOutput` (strict) | **throw + `logger.error`** | 핸들러 출력 전달이 보장돼야 함 — 유실을 silent 통과시키지 않는다 |
| `setStructuredOutput` / `setEngineResolvedConfig` (best-effort) | **no-op + `logger.warn`** | 캐시 보조 채널이라 유실해도 실행은 계속 — 단, 잘못된 키 진단을 위해 warn 은 남긴다 (2026-06-03 ai-review INFO#7) |

## Rationale

**왜 `ParallelBranchContext` 분리인가** — `parentParallelConcurrency` 는 중첩 Parallel 의 concurrency 곱셈 cap (결정 #3 / G / D) 을 위해 외부 Parallel 이 자식 분기에 전파하는 값으로, Parallel 컨테이너 내부 분기에서만 의미가 있다. 이를 `ExecutionContext` 의 optional 필드로 두면 HTTP·AI·DB 등 전 노드가 무관한 필드를 보게 되고, 같은 패턴이 향후 Loop/ForEach 전용 필드로 반복되면 God Object 가 누적된다 (ai-review SUMMARY#11). 별 인터페이스로 분리하면 (a) 타입 수준에서 "이 필드는 Parallel 분기에서만 접근 가능" 이 강제되고, (b) Stable core 가 작게 유지된다. 비용은 branchContext 생성처·소비처의 타입 좁히기 한 번뿐이다.

**왜 `abortSignal` 은 Stable core 에 두는가** — cancellation 은 단일 컨테이너 한정이 아니라 Parallel `cancel-others-on-fail`·Workflow timeout·사용자 cancel·graceful shutdown 등 **다수 기능이 공유하는 cross-cutting 인프라**다 ([`node-cancellation.md`](./node-cancellation.md) §1). 컨테이너별 인터페이스로 쪼개면 오히려 소비처마다 타입이 갈라진다. 따라서 optional 필드로 Stable core 에 두되, "전 노드 필수 아님 / best-effort" 라는 **동작 계약은 `node-cancellation.md` 가 단일 SoT** 로 보유해 본 문서(필드 분류 SoT)와 책임을 분리한다.

**왜 "No sprawl" 를 신규 필드에만 적용하는가** — 기존 필드를 일괄 재배치하면 24개 프로덕션 핸들러 + 엔진 주입부의 광범위 변경과 회귀 위험을 동반한다 ([`node-cancellation.md`](./node-cancellation.md) §Rationale 의 시그니처 변경 회피 근거와 동일 맥락). 본 규약의 가치는 "이미 있는 것의 정리" 가 아니라 "앞으로의 누적 방지" 이므로, 적용 범위를 신규 변경으로 한정해 비용 대비 효과를 확보한다.

**왜 `_contextKey` 를 엔진 내부 필드(원칙 4)로 두는가** (이 결정의 주 SoT — [Background §Rationale](../4-nodes/1-logic/12-background.md#rationale) · [execution-engine §6.1](../5-system/4-execution-engine.md#61-컨텍스트-구조) 가 상호 참조) — context 의 in-memory Map 키는 어떤 노드 핸들러도 소비하지 않는 순수 라우팅 식별자다. Stable core 에 넣으면 전 핸들러에 무관 필드가 노출되지만, `_`-prefix 엔진 내부 필드(선례 `_executedNodes`)로 두면 핸들러 표면 오염 없이 엔진만 참조한다. God Object 우려(원칙 1·3)는 "핸들러가 보는 필드의 비대화" 가 본질이므로, 핸들러 비노출 internal 필드에는 비해당이다. 도입 동기는 background 본문이 부모와 **동일한 `executionId` 를 Map 키로 공유**해, 먼저 종료한 부모의 `deleteContext(executionId)` 가 fire-and-forget 본문이 쓰던 context 를 같은 키로 삭제하던 race ("Execution context not found") 해소다. `executionId` 자체는 NodeExecution 그룹핑·WS 채널·권한 1차 키이므로 원본 유지하고, **in-memory Map 키만** background 한정 `bg:*` 로 분리한다. 이 원칙 4 신설은 기존 §2 표 "재검토" 케이스를 닫는 것이 아니라 핸들러 비소비 엔진 필드를 위한 **새 분기를 추가**하는 것이다.

**기각된 대안 — `ExecutionOptions` 추출** — 모든 부가 필드를 단일 `options` 객체로 묶는 방안도 검토됐으나 (ai-review SUMMARY#11 제안), 이는 컨테이너별 의미 차이를 타입으로 표현하지 못하고 (`options.parentParallelConcurrency` 가 비 Parallel 컨텍스트에도 노출) optional sprawl 을 객체 내부로 옮길 뿐이다. 컨테이너별 `extends` 분리가 타입 안전성과 책임 경계 모두에서 우월해 채택하지 않았다.

**왜 `variables.__*` 예약을 3계층으로 강제하는가 (2026-07-11)** — 원칙 5 는 원래 규약일 뿐이었고 강제가 없었다. 강제 도입 시 단일 지점으로는 부족하다는 것이 설계의 핵심이다: (1) `handler.validate`(pre-flight)는 실행 시점에만 돌아 잘못된 저장이 실행 직전까지 조용히 통과하고, (2) 두 변수 노드의 이름 필드는 `{{ }}` 표현식 대상이라(`EXPRESSION_EXCLUSIONS` 미등재) pre-flight 는 **해석 전 원본**만 본다 — `name: "{{ $input.x }}"` 가 런타임에 `__workspaceId` 로 평가되면 원본 검사를 우회한다. 따라서 저장 시점(L0, 즉시 400)·pre-flight(L1, backstop)·런타임 해석 후(L2, 실질 강제)의 세 계층을 둔다. L2 가 없으면 강제가 성립하지 않는다.

**왜 breaking 을 감수하는가** — 이 강제로 기존에 `__foo` 변수를 쓰던 워크플로는 저장(L0)에서 400, 또는 실행(L2)에서 실패한다. 그러나 그런 변수는 이미 반쯤 깨져 있었다 — park durable 영속의 `filterUserVariables`(`!key.startsWith('__')`)가 `__*` 를 **관찰 불가능하게 drop** 해, 재개 후 조용히 소실됐다. 이는 §variable-declaration §6 이 **의도적으로 채택한** silent skip / silent fallback(둘 다 `meta.skipped` / `meta.coercionWarnings` 로 **관찰 가능**)과는 다른 종류의 침묵이다. "관찰 가능한 silent" 는 유지하고, "관찰 불가능한 opaque silent(park drop)" 는 명시적 실패로 바꾼다. 조용한 데이터 손실보다 명시적 실패가 낫다.

**왜 Code 노드는 강제 범위 밖인가** — Code 노드는 `$vars` 를 통째로 atomic replace 하므로(`nodes/data/code/code.handler.ts`) 사용자 코드가 `$vars.__workspaceId` 를 쓰면 예약 키를 덮어쓴다. 그러나 (a) 임의 코드 실행 노드에 변수-이름 화이트리스트를 강제하려면 사용자 JS 출력 전체를 스캔·거부해야 해 두 선언형 노드의 필드 검증과 성격이 다르고, (b) 그것은 Code 노드의 격리·계약에 대한 별개 결정이다. 본 강제는 사용자가 **폼으로 이름을 직접 지정하는** 두 노드로 한정하고, Code 노드 경로는 잔여 리스크로 정직하게 남긴다.

> **주의 — 기각 범위**: 본 기각은 핸들러에 주입되는 `ExecutionContext` 필드 집합을 단일 options 객체로 묶는 안에 대한 것이다. `ExecutionContextService.createContext()` 메서드 인자 시그니처를 options-bag(`createContext(executionId, workflowId, options?: { initialVariables?, recursionDepth?, contextKey?, conversationThread?, ... }` — 비망라. 예: `conversationThread?` 는 [execution-engine §7.5](../5-system/4-execution-engine.md) rehydration 이 `Execution.conversation_thread` 스냅샷으로 thread 를 무손실 복원 초기화하는 옵션)으로 구성하는 것은 핸들러 소비 표면을 건드리지 않는 별개 사안으로 본 기각의 적용 범위 밖이다 (2026-06-03, ai-review INFO#3).
