# Spec: Parallel

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md) · [CONVENTIONS](../../../user_memo/node-specs-improvement/CONVENTIONS.md)

입력을 동일하게 받는 N개의 분기를 동시에(병렬로) 실행하는 **컨테이너 노드** (`executionMetadata.kind = 'parallel'`). 핸들러는 `branch_0` ~ `branch_{N-1}` 동적 출력 포트를 fan-out 활성화하고, 모든 분기가 종료된 후 엔진이 `done` 포트로 `{ branches: [...] }` 결과를 내보낸다. `branches[i]` 는 `Promise.allSettled` 모델을 따른다 — `{ status: 'fulfilled', value }` 또는 `{ status: 'rejected', error: { code, message } }` (CONVENTIONS Principle 9, [공통 §9.1](./0-common.md#91-컨테이너-노드-핸들러--엔진-오버라이트-컨트랙트)).

> **🚧 P1 구현 상태**: `PARALLEL_ENGINE=v1` 환경변수로 활성화 시 `ParallelExecutor` 가 `p-limit` + `Promise.allSettled` 로 분기를 동시 실행한다. 기본값(`off`)이면 엔진이 토폴로지 순서로 순차 진행한다. 분기 간 `variables` 는 `structuredClone` 으로 deep clone, `nodeOutputCache` 는 shallow copy 로 격리된다.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| branchCount | Integer | ✓ | `2` | 분기 수 (출력 포트 수). `2` ~ `16`. handler 가 16 초과/2 미만 값을 클램프 |
| maxConcurrency | Integer | | `0` | 동시 실행 제한. `0` = `branchCount` 와 동일 (제한 없음), `1`~`16` = 동시 실행 슬롯 수. [공통 §6](./0-common.md#6-리소스-제한) |
| waitAll | Boolean | | `true` | 모든 분기 완료 대기 여부. **P1 에서는 항상 `true` 로 동작** (`false` 는 dead field — fire-and-forget 은 [Background 노드](./12-background.md) 사용) |
| errorPolicy | `stop` / `continue` | | `stop` | 분기 에러 정책. [공통 §4](./0-common.md#4-에러-정책-errorpolicy). `stop` = 첫 실패 시 즉시 throw, `continue` = 모든 분기 종료 대기 후 실패 정보 수집 |

> Source of truth: `backend/src/nodes/logic/parallel/parallel.schema.ts` (export `parallelNodeConfigSchema`)
>
> ⚠ **미구현 (P1)**: `errorPolicy` 는 `ParallelExecutor` 에는 구현되어 있으나 현재 `parallelNodeConfigSchema` 에는 노출되지 않았다 ([user_memo 개선안 logic/parallel.md §2 항목 6](../../../user_memo/node-specs-improvement/logic/parallel.md#2-식별된-불일치)). schema 노출 시까지 다운스트림은 기본값(`stop`)으로 동작한다.
>
> ⚠ **미구현 (P1)**: `waitAll: false` 는 schema 에 노출되어 있으나 엔진 단계에서 무시된다. user_memo 개선안은 schema 제거 또는 validate 단계 reject 를 제안한다 ([logic/parallel.md §3](../../../user_memo/node-specs-improvement/logic/parallel.md#3-제안된-output-구조)).

## 2. 설정 UI

```
┌──────────────────────────────────────┐
│  Branch Count        [3            ] │
│  병렬 실행할 분기 수 (2~16)          │
│                                      │
│  Max Concurrency     [0            ] │
│  0 = 제한 없음 (branchCount 와 동일) │
│                                      │
│  Wait for All Branches      [✓]      │
│  P1 에서는 항상 true 로 동작         │
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
3. `PARALLEL_ENGINE=v1` 인 경우 엔진의 `ParallelExecutor` 가 `p-limit(effectiveConcurrency)` 로 동시 실행 슬롯을 제한하면서 `Promise.allSettled` 로 모든 분기의 서브그래프를 병렬 실행. `effectiveConcurrency` = `maxConcurrency > 0 ? maxConcurrency : branchCount`. flag off 시 엔진이 토폴로지 순서로 순차 실행.
4. 각 분기는 `ExecutionContext` 의 shallow clone 을 받으며, `variables` 는 `structuredClone` 으로 deep clone, `itemContext` / `loopContext` 는 분기 진입 시 `undefined` 로 클리어 (중첩 ForEach/Loop 의 상태 누출 방지).
5. `errorPolicy` 적용:
   - `stop` (기본): 첫 분기 실패 시 즉시 throw → Parallel 노드 FAILED 전이.
   - `continue`: 모든 분기 종료 대기 후 실패 분기 정보를 수집해 §5.2 의 결과에 포함.
6. 전체 완료 후 엔진이 `output` 을 `{ branches: [...] }` 로 **오버라이트** (Principle 9.2) → `done` 포트 (`port: 'done'`, 단일 문자열) 로 전달. `branches[i]` 는 `Promise.allSettled` 모델 (`{ status: 'fulfilled', value }` 또는 `{ status: 'rejected', error: { code, message } }`).

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> Parallel 은 컨테이너 노드이므로 §5.1 (시작 — N분기 fan-out) / §5.2 (완료 — `done` 포트) 두 시점으로 분리하고, §5.7 에 엔진 오버라이트 컨트랙트를 명시한다.

### 5.1 Case: 시작 — 핸들러 반환 (N분기 fan-out 시점)

```json
{
  "config": { "branchCount": 3, "maxConcurrency": 0, "waitAll": true },
  "output": null,
  "port": ["branch_0", "branch_1", "branch_2"]
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.branchCount` | Integer (raw) | config echo (Principle 7) | 사용자가 설정한 raw 값 (clamp 전). Handler 의 출력 포트 수는 클램프 후 길이지만 `config` echo 는 raw 보존 |
| `config.maxConcurrency` | Integer (raw) | config echo | 사용자 설정 raw 값. 음수/16 초과 등 invalid 값도 그대로 echo 되며 실제 동작은 executor 가 클램프 |
| `config.waitAll` | Boolean (raw) | config echo | 사용자 설정 raw 값 (P1 에서는 의미 없음 — §1 미구현 마킹) |
| `output` | `null` | handler return | 컨테이너 핸들러 컨트랙트 (loop/foreach/map 과 동일). 외부 expression 으로 노출되지 않는 중간 형태 — 다운스트림이 `$node["X"].output.*` 로 관찰하는 값은 §5.2 의 완료 형태 (엔진 오버라이트 후) |
| `port` | `string[]` | handler return | `branch_0` ~ `branch_{N-1}` 모두 활성화 (CONVENTIONS Principle 5 의 fan-out). 각 분기 서브그래프의 진입점 트리거 |

### 5.2 Case: 완료 — `done` 포트 (엔진 오버라이트 후)

```json
{
  "config": { "branchCount": 3, "maxConcurrency": 0, "waitAll": true },
  "output": {
    "branches": [
      { "status": "fulfilled", "value": { "userId": "u-1", "step": "validate", "ok": true } },
      { "status": "fulfilled", "value": { "userId": "u-1", "step": "enrich", "ok": true } },
      { "status": "rejected",  "error": { "code": "Error", "message": "notify failed" } }
    ]
  },
  "port": "done"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.branchCount` | Integer (raw) | config echo | (§5.1 과 동일) |
| `config.maxConcurrency` | Integer (raw) | config echo | (§5.1 과 동일) |
| `config.waitAll` | Boolean (raw) | config echo | (§5.1 과 동일) |
| `output.branches` | `Array<BranchResult>` | engine override (Principle 9.2) | 각 분기 결과 (`Promise.allSettled` 모델). `branches[i]` 는 `branch_i` 분기의 결과. 컬렉션 키 = `branches` ([공통 §5](./0-common.md#5-반복분기-출력-구조-conventions-92)) |
| `output.branches[i].status` | `'fulfilled' \| 'rejected'` | engine | 분기 종료 상태 |
| `output.branches[i].value` | unknown | engine | (`status: 'fulfilled'` 시) 분기의 terminal 노드 출력 |
| `output.branches[i].error` | `{ code, message }` | engine | (`status: 'rejected'` 시) `errorPolicy='continue'` 모드에서 실패한 분기의 에러 정보. `code` = `error.name` (없으면 `'UNKNOWN_ERROR'`), `message` = `error.message` |
| `port` | `'done'` | engine | 단일 문자열 (Principle 5). 모든 분기 완료 분기 |

> **`count` 필드는 제거됨** (P1.1 직교성 — `branches.length` 가 SSOT). `errorPolicy='stop'` 모드에서는 첫 실패 시 즉시 throw 되어 `done` 포트를 거치지 않으므로 `branches[i]` 는 모두 `fulfilled` 다 (Parallel 노드는 FAILED 로 전이). `rejected` 항목은 `errorPolicy='continue'` 모드에서만 관찰된다.

**Expression 접근 예**:
- `$node["Parallel"].output.branches[0].value` → `branch_0` 분기의 terminal 출력 (성공 시)
- `$node["Parallel"].output.branches[2].error.message` → `branch_2` 의 에러 메시지 (실패 시)
- `$node["Parallel"].output.branches.length` → 분기 수
- `$node["Parallel"].port` → `"done"`

### 5.7 Case: 엔진 오버라이트 컨트랙트 (Principle 9)

Parallel 핸들러는 두 시점에 두 가지 다른 `output` 을 낸다 ([공통 §9.1](./0-common.md#91-컨테이너-노드-핸들러--엔진-오버라이트-컨트랙트)):

| 시점 | output 형태 | port | 출처 |
|------|-------------|------|------|
| 시작 (N분기 fan-out 직전) | `output: null` | `string[]` (`branch_0`~`branch_{N-1}`) | handler return — 분기 포트 트리거용 |
| 완료 (모든 분기 종료 후) | `output: { branches: Array<{ status, value? \| error? }> }` | `'done'` (단일 문자열) | **엔진 오버라이트** |

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
| `waitAll` 이 boolean 아님 | `waitAll는 boolean이어야 합니다.` | handler.validate |
| 분기 서브그래프 에러 (errorPolicy=`stop`) | 첫 실패 분기의 에러를 throw — Parallel 노드 FAILED | 엔진 runtime ([공통 §4](./0-common.md#4-에러-정책-errorpolicy)) |
| 분기 서브그래프 에러 (errorPolicy=`continue`) | 실패 정보를 수집해 NodeExecution 에 기록 (모든 분기 종료 대기) | 엔진 runtime |
| 분기 내부에 blocking 노드 (form / buttons / ai_conversation) | (graph 검증 에러) | 엔진 graph 검증 ([공통 §3](./0-common.md#3-컨테이너-노드-패턴-loop--map--foreach)) |
| 분기 내부에 back-edge / 중첩 Parallel | (graph 검증 에러) | 엔진 graph 검증 (중첩 Parallel 은 P2 예정) |

## 7. 캔버스 요약

[공통 §8](./0-common.md#8-캔버스-요약) — `Parallel` 행 인용. (`{N} branches`, 예: `3 branches`)
