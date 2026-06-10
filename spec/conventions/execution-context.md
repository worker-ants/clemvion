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

> **주의 — 기각 범위**: 본 기각은 핸들러에 주입되는 `ExecutionContext` 필드 집합을 단일 options 객체로 묶는 안에 대한 것이다. `ExecutionContextService.createContext()` 메서드 인자 시그니처를 options-bag(`createContext(executionId, workflowId, options?: { initialVariables?, recursionDepth?, contextKey?, conversationThread?, ... }` — 비망라. 예: `conversationThread?` 는 [execution-engine §7.5](../5-system/4-execution-engine.md) rehydration 이 `Execution.conversation_thread` 스냅샷으로 thread 를 무손실 복원 초기화하는 옵션)으로 구성하는 것은 핸들러 소비 표면을 건드리지 않는 별개 사안으로 본 기각의 적용 범위 밖이다 (2026-06-03, ai-review INFO#3).
