---
id: parallel
status: implemented
code:
  - codebase/backend/src/nodes/logic/parallel/parallel.*.ts
---

# Spec: Parallel

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md) · [CONVENTIONS](../../conventions/node-output.md)

입력을 동일하게 받는 N개의 분기를 동시에(병렬로) 실행하는 **컨테이너 노드** (`executionMetadata.kind = 'parallel'`). 핸들러는 `branch_0` ~ `branch_{N-1}` 동적 출력 포트를 fan-out 활성화하고, 모든 분기가 종료된 후 엔진이 `done` 포트로 `{ branches: [...] }` 결과를 내보낸다. `branches[i]` 는 `Promise.allSettled` 모델을 따른다 — `{ status: 'fulfilled', value }` 또는 `{ status: 'rejected', error: { code, message } }` (CONVENTIONS Principle 9, [공통 §9.1](./0-common.md#91-컨테이너-노드-핸들러--엔진-오버라이트-컨트랙트)).

> **P1 구현 상태**: `ParallelExecutor` 가 `p-limit` + `Promise.allSettled` 로 분기를 동시 실행한다 (default ON — `PARALLEL_ENGINE=v1` 가 기본값). `PARALLEL_ENGINE=off` 로 명시 설정 시 엔진이 토폴로지 순서로 순차 진행 (rollback card). 분기 간 `variables` 는 `structuredClone` 으로 deep clone, `nodeOutputCache` 는 shallow copy 로 격리된다.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| branchCount | Integer | ✓ | `2` | 분기 수 (출력 포트 수). `2` ~ `16`. handler 가 16 초과/2 미만 값을 클램프 |
| maxConcurrency | Integer | | `0` | 동시 실행 제한. `0` = `branchCount` 와 동일 (제한 없음), `1`~`16` = 동시 실행 슬롯 수. [공통 §6](./0-common.md#6-리소스-제한) |
| errorPolicy | `stop` / `continue` / `cancel-others-on-fail` | | `stop` | 분기 에러 정책. [공통 §4](./0-common.md#4-에러-정책-errorpolicy). `stop` = 첫 실패 시 즉시 throw. `continue` = 모든 분기 종료 대기 후 실패 정보 수집. `cancel-others-on-fail` (2026-05-30 §5) = 첫 실패 시 자기 그룹의 `ExecutionContext.abortSignal` 을 abort 시켜 다른 분기의 외부 I/O 를 즉시 중단 (signal-aware 노드 best-effort cleanup) + root cause 를 Parallel 노드의 throw 로 재현. cancellation 컨벤션: [`spec/conventions/node-cancellation.md`](../../conventions/node-cancellation.md) |

> Source of truth: `codebase/backend/src/nodes/logic/parallel/parallel.schema.ts` (export `parallelNodeConfigSchema`)
>
> `errorPolicy` 는 `parallelNodeConfigSchema` 에 직접 노출된 parallel-specific 필드다 (공통 `errorHandling.policy` 와 별개). 엔진은 `config.errorPolicy` 가 명시되면 그 값을 그대로 사용하고, 미지정 시 공통 `errorHandling.policy` 의 매핑(`skip_node`/`use_default_output`/`route_to_error_port` → `continue`, 그 외 → `stop`)으로 fallback 한다 (옛 동선 호환).
>
> ⚠ **`waitAll: false` 는 지원하지 않는다** (2026-05-30 결정 K — spec out). `validateParallelConfig` 가 `waitAll === false` 를 reject. Parallel 은 항상 모든 분기가 종료된 후 `done` 포트로 합산 emit 한다. 분기 완료 즉시 다운스트림으로 진행하는 fire-and-forget 의미가 필요하면 [Background 노드](./12-background.md) 사용. 옛 워크플로우의 `config.waitAll: false` 는 schema validate 에서 reject → 사용자가 워크플로우 편집기에서 수정 필요. 근거: § Rationale.

## 2. 설정 UI

```
┌──────────────────────────────────────┐
│  Branch Count        [3            ] │
│  병렬 실행할 분기 수 (2~16)          │
│                                      │
│  Max Concurrency     [0            ] │
│  0 = 제한 없음 (branchCount 와 동일) │
│                                      │
│  Error Policy        [stop       ▾]  │
│  stop / continue                     │
└──────────────────────────────────────┘
```

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 외부 데이터 진입. 모든 분기에 동일 input 이 복제 전달됨 |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `branch_0` ~ `branch_{N-1}` | Branch i | data | true | `branchCount` 에 따라 동적 생성 (`dynamicPorts.kind = 'parallel-branches'`). 각 분기의 진입점 |
| `done` | Done | data | false | 모든 분기 완료 후 `{ branches }` 전달 (`branches[i]` 는 allSettled-shape) |

> 동적 포트 ID 는 `branch_<index>` 형식 (CONVENTIONS Principle 6 의 `<prefix>_<index>` 규칙). 동적 포트도 [공통 §7](./0-common.md#7-포트-id-불변성-동적-포트) 의 ID 불변성을 따른다 — branchCount 변경으로 포트가 재구성되어도 기존 인덱스의 포트 ID 는 유지된다.

## 4. 실행 로직

1. `branchCount` 를 정수 + `[2, 16]` 범위로 클램프 (handler 와 executor 양쪽에서 방어).
2. 핸들러는 `branch_0` ~ `branch_{N-1}` 포트를 모두 활성화하는 형태로 §5.1 을 반환 — `port: string[]` (CONVENTIONS Principle 5 의 fan-out 형태).
3. 엔진의 `ParallelExecutor` 가 `p-limit(effectiveConcurrency)` 로 동시 실행 슬롯을 제한하면서 `Promise.allSettled` 로 모든 분기의 서브그래프를 병렬 실행. `effectiveConcurrency` = `maxConcurrency > 0 ? maxConcurrency : branchCount`. `PARALLEL_ENGINE=off` 명시 시 엔진이 토폴로지 순서로 순차 실행 (rollback card).
4. 각 분기는 `ExecutionContext` 의 shallow clone 을 받으며, `variables` 는 `structuredClone` 으로 deep clone, `itemContext` / `loopContext` 는 분기 진입 시 `undefined` 로 클리어 (중첩 ForEach/Loop 의 상태 누출 방지).
5. `errorPolicy` 적용:
   - `stop` (기본): 첫 분기 실패 시 즉시 throw → Parallel 노드 FAILED 전이.
   - `continue`: 모든 분기 종료 대기 후 실패 분기 정보를 수집해 §5.2 의 결과에 포함.
   - `cancel-others-on-fail`: 자기 그룹용 `AbortController` 생성 + branch context 의 `abortSignal` 에 set. 첫 분기 실패 시 `controller.abort()` 호출 → 다른 분기의 외부 I/O 노드 (HTTP / DB / AI / Email 등 cancellation 컨벤션 소비자) 가 best-effort cleanup. 모든 분기 종료 후 root cause 를 Parallel 노드의 throw 로 재현 (Parallel 노드 FAILED 전이). 상위 `context.abortSignal` 이 있으면 그 abort 도 cascade. 메커니즘: [`spec/conventions/node-cancellation.md`](../../conventions/node-cancellation.md).
6. 전체 완료 후 엔진이 `output` 을 `{ branches: [...] }` 로 **오버라이트** (Principle 9.2) → `done` 포트 (`port: 'done'`, 단일 문자열) 로 전달. `branches[i]` 는 `Promise.allSettled` 모델 (`{ status: 'fulfilled', value }` 또는 `{ status: 'rejected', error: { code, message } }`).

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> Parallel 은 컨테이너 노드이므로 §5.1 (시작 — N분기 fan-out) / §5.2 (완료 — `done` 포트) 두 시점으로 분리하고, §5.7 에 엔진 오버라이트 컨트랙트를 명시한다.

### 5.1 Case: 시작 — 핸들러 반환 (N분기 fan-out 시점)

```json
{
  "config": { "branchCount": 3, "maxConcurrency": 0 },
  "output": null,
  "port": ["branch_0", "branch_1", "branch_2"]
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.branchCount` | Integer (raw) | config echo (Principle 7) | 사용자가 설정한 raw 값 (clamp 전). Handler 의 출력 포트 수는 클램프 후 길이지만 `config` echo 는 raw 보존 |
| `config.maxConcurrency` | Integer (raw) | config echo | 사용자 설정 raw 값. 음수/16 초과 등 invalid 값도 그대로 echo 되며 실제 동작은 executor 가 클램프 |
| `output` | `null` | handler return | 컨테이너 핸들러 컨트랙트 (loop/foreach/map 과 동일). 외부 expression 으로 노출되지 않는 중간 형태 — 다운스트림이 `$node["X"].output.*` 로 관찰하는 값은 §5.2 의 완료 형태 (엔진 오버라이트 후) |
| `port` | `string[]` | handler return | `branch_0` ~ `branch_{N-1}` 모두 활성화 (CONVENTIONS Principle 5 의 fan-out). 각 분기 서브그래프의 진입점 트리거 |

### 5.2 Case: 완료 — `done` 포트 (엔진 오버라이트 후)

```json
{
  "config": { "branchCount": 3, "maxConcurrency": 0 },
  "output": {
    "branches": [
      { "status": "fulfilled", "value": { "userId": "u-1", "step": "validate", "ok": true } },
      { "status": "fulfilled", "value": { "userId": "u-1", "step": "enrich", "ok": true } },
      { "status": "rejected",  "error": { "code": "Error", "message": "notify failed" } }
    ],
    "count": 3
  },
  "port": "done"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.branchCount` | Integer (raw) | config echo | (§5.1 과 동일) |
| `config.maxConcurrency` | Integer (raw) | config echo | (§5.1 과 동일) |
| `output.branches` | `Array<BranchResult>` | engine override (Principle 9.2) | 각 분기 결과 (`Promise.allSettled` 모델). `branches[i]` 는 `branch_i` 분기의 결과. 컬렉션 키 = `branches` ([공통 §5](./0-common.md#5-반복분기-출력-구조-conventions-92)) |
| `output.branches[i].status` | `'fulfilled' \| 'rejected'` | engine | 분기 종료 상태 |
| `output.branches[i].value` | unknown | engine | (`status: 'fulfilled'` 시) 분기의 terminal 노드 출력 |
| `output.branches[i].error` | `{ code, message }` | engine | (`status: 'rejected'` 시) `errorPolicy='continue'` 모드에서 실패한 분기의 에러 정보. `code` = `error.name` (없으면 `'UNKNOWN_ERROR'`), `message` = `error.message` |
| `output.count` | Integer | engine override (Principle 9.2) | 종료된 분기 수 (= `branches.length`). 컨테이너 공통 출력 규약 `{ <컬렉션>, count }` 준수 ([공통 §5](./0-common.md#5-반복분기-출력-구조-conventions-92) / [§9.1](./0-common.md#91-컨테이너-노드-핸들러--엔진-오버라이트-컨트랙트), [node-output.md Principle 9.2](../../conventions/node-output.md)) |
| `port` | `'done'` | engine | 단일 문자열 (Principle 5). 모든 분기 완료 분기 |

> **`count` 필드는 컨테이너 공통 규약(`{ <컬렉션>, count }`)에 따라 포함된다** — `count = branches.length`. 엔진 오버라이트가 Loop/ForEach/Map 과 동일하게 `count` 를 부여한다 (engine: `{ branches, count }`). `errorPolicy='stop'` 모드에서는 첫 실패 시 즉시 throw 되어 `done` 포트를 거치지 않으므로 `branches[i]` 는 모두 `fulfilled` 다 (Parallel 노드는 FAILED 로 전이). `rejected` 항목은 `errorPolicy='continue'` 모드에서만 관찰된다.

**Expression 접근 예**:
- `$node["Parallel"].output.branches[0].value` → `branch_0` 분기의 terminal 출력 (성공 시)
- `$node["Parallel"].output.branches[2].error.message` → `branch_2` 의 에러 메시지 (실패 시)
- `$node["Parallel"].output.branches.length` → 분기 수 (`output.count` 와 동일 값)
- `$node["Parallel"].output.count` → 종료된 분기 수
- `$node["Parallel"].port` → `"done"`

### 5.7 Case: 엔진 오버라이트 컨트랙트 (Principle 9)

Parallel 핸들러는 두 시점에 두 가지 다른 `output` 을 낸다 ([공통 §9.1](./0-common.md#91-컨테이너-노드-핸들러--엔진-오버라이트-컨트랙트)):

| 시점 | output 형태 | port | 출처 |
|------|-------------|------|------|
| 시작 (N분기 fan-out 직전) | `output: null` | `string[]` (`branch_0`~`branch_{N-1}`) | handler return — 분기 포트 트리거용 |
| 완료 (모든 분기 종료 후) | `output: { branches: Array<{ status, value? \| error? }>, count }` | `'done'` (단일 문자열) | **엔진 오버라이트** |

**컨트랙트 핵심**:
- 다운스트림 노드가 `$node["Parallel"].output.*` 로 관찰하는 값은 **항상 §5.2 의 완료 형태**.
- 핸들러가 시작 시점에 반환한 `output: null` 은 외부 expression 으로 노출되지 않는다 (엔진이 덮어쓰기 전 중간 단계 — loop/foreach/map 과 동일 패턴).
- `port` 는 시작 시점에 `string[]` (fan-out, Principle 5) → 완료 시점에 `'done'` 문자열 (단일 포트).
- 각 분기 서브그래프의 입력은 `ParallelExecutor` 가 `ExecutionContext` shallow clone (variables 는 deep clone) 으로 분배하며, 핸들러의 시작 시점 `output` 자체에 의존하지 않는다.

## 6. 에러 코드

Parallel 은 **runtime 에러 포트를 갖지 않는다**. config 검증 실패는 pre-flight 단계에서 throw 되고, 분기 서브그래프 실행 중 발생한 에러는 `errorPolicy` 로 처리된다 (CONVENTIONS Principle 3.1).

| 발생 조건 | 메시지 / 코드 | 시점 |
|-----------|--------------|------|
| `branchCount` 가 2 미만 또는 16 초과 | `branchCount 는 2 이상 16 이하여야 합니다.` | warningRule (캔버스 배지) |
| `branchCount` 가 정수 아님 | `branchCount는 정수여야 합니다.` | handler.validate |
| `branchCount` 가 `[2, 16]` 외 | `branchCount는 2 이상 16 이하의 값이어야 합니다.` | handler.validate |
| `maxConcurrency` 가 숫자 아님 | `maxConcurrency는 숫자여야 합니다.` | handler.validate |
| `maxConcurrency` 가 정수 아님 | `maxConcurrency는 정수여야 합니다.` | handler.validate |
| `maxConcurrency` 가 `[0, 16]` 외 | `maxConcurrency는 0 이상 16 이하의 값이어야 합니다 (0 = 제한 없음).` | handler.validate |
| `waitAll` 이 boolean 아님 | `waitAll must be a boolean.` | handler.validate |
| `waitAll === false` (결정 K, 2026-05-30 — spec out) | `waitAll=false is not supported. Use waitAll=true (default) or the Background node for fire-and-forget semantics.` | handler.validate |
| 분기 서브그래프 에러 (errorPolicy=`stop`) | 첫 실패 분기의 에러를 throw — Parallel 노드 FAILED | 엔진 runtime ([공통 §4](./0-common.md#4-에러-정책-errorpolicy)) |
| 분기 서브그래프 에러 (errorPolicy=`continue`) | 실패 정보를 수집해 NodeExecution 에 기록 (모든 분기 종료 대기) | 엔진 runtime |
| 분기 서브그래프 에러 (errorPolicy=`cancel-others-on-fail`) | 자기 그룹 `AbortController.abort()` → 다른 분기 외부 I/O abort + root cause throw → Parallel FAILED. 메커니즘: [`node-cancellation.md`](../../conventions/node-cancellation.md) | runtime (ParallelExecutor — §5, 2026-05-30) |
| 분기 내부에 blocking 노드 (form / buttons / ai_conversation) | `PARALLEL_INVALID_CHILD` | 엔진 graph 검증 ([공통 §3](./0-common.md#3-컨테이너-노드-패턴-loop--map--foreach)) |
| 분기 내부에 back-edge | `PARALLEL_BACK_EDGE` | 엔진 graph 검증 (planParallelBody) |
| 중첩 Parallel 깊이 > 2 (depth=2 의 분기에 또 Parallel 노드) | `PARALLEL_NESTED_DEPTH_EXCEEDED` | 엔진 graph 검증 (planParallelBody — 결정 #3, 2026-05-30) |
| 중첩 Parallel concurrency 곱셈 cap = 32 초과 | (silent clamp + `meta.clampedConcurrency` 기록 + debug 로그) | runtime (ParallelExecutor — 결정 #3 + G + D) |

## 7. 캔버스 요약

[공통 §8](./0-common.md#8-캔버스-요약) — `Parallel` 행 인용. (`{N} branches`, 예: `3 branches`)

## Rationale

### `done` 출력의 `count` 필드 — 컨테이너 공통 규약 정합 (2026-06-03 spec-drift 결정 B)

한때 §5.2 에 "`count` 필드는 제거됨 (P1.1 직교성 — `branches.length` 가 SSOT)" 라는 노트가 있었으나, 이는 컨테이너 공통 규약 ([공통 §5·§9.1·§11](./0-common.md), [node-output.md Principle 9.2](../../conventions/node-output.md)) 및 실제 엔진 구현과 모순되는 **drift** 였다. 공통 규약은 모든 컨테이너(loop/foreach/map/parallel)가 `{ <컬렉션>, count }` 를 방출한다고 명시하며, `ExecutionEngineService` 의 Parallel `done` 오버라이트도 `{ branches, count: branchResults.length }` 를 부여한다.

drift 해소 시 두 방향이 검토됐다:
- **(A) 공통 규약·코드에서 Parallel 만 `count` 예외 처리** — Parallel 은 포트 기반 분기라 `count` 의미가 약하다는 논거. 그러나 공통 규약 3곳 + 코드 + 다른 컨테이너 3종을 모두 바꿔야 하고, downstream expression(`output.count`)을 쓰는 워크플로우를 깨뜨린다.
- **(B) §5.2 에 `count` 복원** ← **채택**. 코드·공통 규약·다른 컨테이너와 즉시 일치하며 변경 최소(본 문서 한정). `branches.length` 와 중복이지만 컨테이너 출력의 균일성(`{<컬렉션>, count}`)이 직교성보다 우선한다 — 다운스트림이 컨테이너 종류와 무관하게 `output.count` 로 항목 수에 접근하는 일관 패턴을 보장.

### waitAll=false 가 spec out 된 근거 (2026-05-30 결정 K)

본 spec 의 초기 P1 단계에서는 `waitAll: false` 가 schema 에 노출되어 있었으나 엔진 단계에서 무시되는 dead field 상태였다. P2 단계의 결정 사항으로 활성화 또는 제거가 검토됐고, 다음 분석을 거쳐 **spec out (지원 안 함)** 으로 결정됐다.

**`waitAll=false` 의 의도된 의미**: 각 분기 (`branch_i`) 가 완료되는 즉시 자기 분기의 외부 다운스트림이 트리거된다 — 예를 들어 branch 0 이 1초에 끝나고 branch 1 이 5초 걸린다면, branch 0 의 외부 다운스트림이 1초 시점에 실행 시작.

**기각 근거 — 엔진 구조 제약**: 현 `ExecutionEngineService` 는 Node.js single-threaded main loop pattern 으로 dispatch 한다. `runParallel` 은 main loop 가 `await` 으로 기다리는 함수이고, main loop pointer 는 `runParallel` 이 return 한 뒤에야 다음 노드로 진행한다. 따라서 branch 완료 콜백 안에서 `propagateReachability` 를 호출해도 외부 노드의 실제 dispatch 는 모든 branch 가 완료된 뒤에야 가능하다.

이 의미를 살리려면 branch 완료 시점마다 외부 다운스트림을 별도 sub-loop 로 dispatch 해야 하는데, 이는 다음 risk 를 동반한다:

- main dispatch loop 와 별도 sub-loop 의 동시 진행 — race / executedNodes set 동시 mutation
- Loop / ForEach / Map 등 다른 컨테이너 노드의 fan-out 패턴 (`runContainer` 경로) 과 의 cross-impact
- Parallel branch 안에 ForEach / Loop / Map 이 들어가는 cross-container 시나리오의 회귀 위험

**대안 — Background 노드**: fire-and-forget 의미는 [Background 노드](./12-background.md) 가 명시적으로 지원한다. BullMQ enqueue 모델로 worker 단의 분리가 이미 구현돼 있고, 본 컨텍스트보다 안전.

**결정**: Parallel 노드는 항상 `waitAll=true` (default) 로 동작 — 모든 분기 종료 후 `done` 포트로 합산 emit. `waitAll=false` 를 명시한 워크플로우는 schema validate 에서 reject (위 §6 에러 코드 표 참조).

> 옛 워크플로우 호환: DB 에 `config.waitAll: false` 가 저장된 케이스는 실행 시점에 schema validate 가 reject — 사용자가 워크플로우 편집기에서 수정 필요. 별도 마이그레이션 작업은 [`plan/in-progress/parallel-p2-followups.md`](../../../plan/in-progress/parallel-p2-followups.md) §2-E 의 후속 항목.

### 중첩 Parallel 허용 (깊이 ≤ 2, concurrency 곱셈 cap = 32, 2026-05-30 결정 #3 + G + D)

P1 단계에서는 `PARALLEL_NESTED_NOT_SUPPORTED` 로 모든 중첩을 reject 했다. P2 에서 다음 결정으로 제한적 중첩 허용으로 전환됐다.

**왜 깊이 ≤ 2 인가** — 외부 Parallel 의 분기 body 안에 내부 Parallel 한 단계만 허용. 3중 (`PARALLEL_NESTED_DEPTH_EXCEEDED`) 부터 reject. 워크플로우 작성자가 워크플로우를 분해하기 어려운 상황이 있어 부분 허용은 가치 있지만, 임의 깊이는 동시 worker 수 폭발 + DAG 구조 복잡도가 사용자 mental model 을 넘어선다. 두 단계는 "분기 안에서 또 분기" 라는 가장 자주 요구되는 case 를 cover.

**왜 concurrency 곱셈 cap = 32 인가** — 외부 maxConcurrency 16 × 내부 16 = 최대 256 worker 동시 실행 가능. 운영 환경에서 OOM / event loop 스로틀링 위험. cap=32 는 외부 4 × 내부 8 / 외부 8 × 내부 4 / 외부 16 × 내부 2 같은 합리적 조합을 모두 허용하면서 worker 수 상한을 보수적으로 유지한다.

**왜 silent clamp 인가** — cap 초과 시 reject 대신 `effectiveConcurrency = floor(32 / parentEffective)` 로 자동 축소. 워크플로우 작성자가 외부 / 내부 maxConcurrency 의 곱을 항상 정확히 계산하길 기대하기 어렵다. 의도와 실제의 차이는 두 경로로 가시화:

1. **runtime** — `ParallelExecutor` 가 clamp 발생 시 결과의 `clampedConcurrency` 를 set, 엔진이 그 값을 Parallel 노드의 `meta.clampedConcurrency = { intended, actual, parentEffective, cap }` 에 기록. expression `$node["Parallel"].meta.clampedConcurrency` 로 다운스트림 노드가 관찰 가능 + run-results timeline 에서 사용자 즉시 확인 가능. 추가로 `Logger.debug` 로 운영 로그.
2. **frontend 사전 경고** — `cross-node-warning-rules.md` (선행 plan) 의 cross-node warningRule 인프라가 완료되면 canvas 가 외부 × 내부 maxConcurrency > 32 시 사전 배지로 알림 (저장은 통과 — clamp 가 안전망).

**3중 가드** (결정 E) — 깊이 검증은 runtime `planParallelBody` 단계 (본 spec) + 향후 workflow save endpoint validate + frontend canvas warningRule 의 3중 가드로 강화된다 (후 2개는 [`cross-node-warning-rules.md`](../../../plan/complete/cross-node-warning-rules.md) 의 책임).

**전파 메커니즘 (결정 G)** — `parentParallelConcurrency: number` 필드를 `ParallelBranchContext extends ExecutionContext` 에 둔다. 외부 Parallel 의 `ParallelExecutor` 가 branch context clone 시 자기 `effectiveConcurrency` 를 이 필드에 set. 내부 Parallel 이 자기 `effectiveConcurrency` 를 계산할 때 이 값을 읽어 cap 적용. 깊이 ≤ 2 가드 하에서 한 단계만 누적. 미설정 (= outermost Parallel) 이면 clamp 없이 자기 effective 그대로 사용.

> **2026-05-31 갱신 (결정 G 번복)** — 초안 결정 G 는 본 필드를 `ExecutionContext` 의 optional 필드 (`parentParallelConcurrency?`) 로 직접 추가했으나, 2026-05-30 ai-review SUMMARY#11 의 God Object 우려 + consistency-check C-1 (옵션 a 채택) 에 따라 **Parallel 컨테이너 한정 필드를 `ParallelBranchContext` 로 분리**하도록 번복한다. 분류 근거·결정 규칙은 [`spec/conventions/execution-context.md`](../../conventions/execution-context.md) §원칙 2 가 SoT. 구현은 [`parallel-p2-followups.md`](../../../plan/in-progress/parallel-p2-followups.md) §7 (별 PR) 이 추적.

### `cancel-others-on-fail` errorPolicy (2026-05-30 §5, 결정 A + H)

**의미**: 첫 분기 실패 시 다른 분기의 장기 외부 I/O (HTTP / DB / AI / Email 등) 를 즉시 중단해 worker 자원 낭비를 막는다. `stop` 의 의미 ("Parallel FAILED 전이") 를 유지하면서, 실패 직후 다른 분기를 `errorPolicy=continue` 처럼 끝까지 기다리지 않고 abort.

**기각된 대안**: `errorPolicy=stop` 의 동작을 변경해 항상 abort 시키는 방안 — 옛 워크플로우의 의미를 깨므로 별 옵션으로 분리.

**메커니즘**: 자기 그룹용 `AbortController` 생성 → branch context 의 `abortSignal` 에 set. 첫 실패 발생 분기의 `runBranch` rejection 직후 `controller.abort()` 호출 → 다른 분기의 외부 I/O 노드가 그 signal 을 받아 cleanup. 외부 (상위) `context.abortSignal` 이 있으면 cascade — 상위 cancellation 도 본 그룹에 전파.

**best-effort 컨트랙트** ([`spec/conventions/node-cancellation.md`](../../conventions/node-cancellation.md)) — signal 미지원 노드 (CPU 바운드 / 즉시 완료) 는 자기 작업 완료까지 계속. 본 PR 기준 signal-aware 는 HTTP 노드만 — DB / AI / Email / chat-channel 은 후속 PR. 따라서 cancel-others-on-fail 의 효과는 노드 별로 점진 강화된다.

**에러 분류**: 모든 분기 종료 후 root cause (`error.name !== 'AbortError'` 인 첫 실패) 를 Parallel 노드의 throw 로 재현. AbortError 는 후속 분기의 cleanup 결과이므로 사용자 메시지 신호 대 잡음을 위해 노출 안 함.
