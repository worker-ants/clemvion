# Parallel (`parallel`) — Output 일관성 개선안

> **v2**: Principle 1.1 적용으로 `output.count` 제거. `config.branchCount` 와 중복되므로 echo 금지. 실제 완료된 분기 수는 `meta.branches` 로 노출 (`waitAll:false` / 에러 / 취소 시 `config.branchCount` 와 다를 수 있음).

- **카테고리**: logic
- **현 문서**: [../../node-specs/logic/parallel.md](../../node-specs/logic/parallel.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)

## 1. 현재 Output 구조 요약

입력을 N 개 분기 (`branch_0` ~ `branch_{N-1}`) 로 fan-out 시키는 노드. 각 분기는 독립적인 서브그래프를 실행하고, 모든 분기가 끝나면 `done` 포트로 수집 결과를 보냅니다.

### 1단계 (핸들러 반환, fan-out 시점)

```json
{
  "config": { "branchCount": 3, "maxConcurrency": 0, "waitAll": true },
  "output": { "incoming": "data" },
  "port": ["branch_0", "branch_1", "branch_2"]
}
```

### 3단계 (분기 종료 후 엔진 덮어쓰기)

```json
{
  "config": { "branchCount": 3, "maxConcurrency": 0, "waitAll": true },
  "output": [
    "branch_0 terminal output",
    "branch_1 terminal output",
    "branch_2 terminal output"
  ],
  "port": ["done"]
}
```

특징 요약:

- **동적 포트** (`kind: 'parallel-branches'`): `branch_0` ~ `branch_{N-1}`.
- 핸들러는 `port: ['branch_0', ..., 'branch_{N-1}']` **배열** 로 반환 — Principle 5 의 `port: string[]` fan-out.
- 엔진이 최종 `output` 을 **단순 배열** (각 분기의 terminal output) 로 덮어씀.
- `done` 포트 하류 노드의 input 은 `{ branches: [...] }` 구조로 변환되어 전달 (엔진이 `_selectedPort` 제거).
- `waitAll: false` 는 Phase P1 에서 **무시** (fire-and-forget 은 `background` 노드 사용 권장).
- 분기 간 `variables` 는 **shallow clone** 으로 격리.
- `PARALLEL_ENGINE=v1` feature flag off 시 순차 실행 fallback.

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | 최종 `output` 이 단순 배열 | Principle 9.2 | `{ branches: [...] }` 구조 래핑 필요 |
| 2 | 핸들러 1단계 output 이 input pass-through | Principle 9.1 | fan-out 시점의 `output` 은 각 분기의 초기 input 으로 기능하지만, 이후 엔진이 덮어쓰는 로직과 의미 충돌. `null` 반환 + 엔진 덮어쓰기로 통일 |
| 3 | `done` 하류 input 구조 (`{branches: [...]}`) 와 `output` 구조 불일치 | Principle 9.2 / 예측성 | 현재 이미 하류 input 에는 `{branches: [...]}` 구조 — 이 구조를 parallel 노드의 `output` 자체에 적용하면 대칭성 확보 |
| 4 | `meta.branches`, `meta.durationMs`, `meta.concurrency` 부재 | Principle 2 | Container 메트릭 + 병렬 전용 메트릭 누락 |
| 5 | `waitAll: false` dead field | Principle 7 | Phase P1 에서 무시되므로 schema 노출 시 사용자 혼란. 경고 로그만으로는 부족 |
| 6 | 분기 실패 처리 정책 `errorPolicy` 가 config 에 부재 | Principle 3 | 코드에서는 `errorPolicy` 를 참조하지만 schema 에 노출된 필드 확인 필요 (현 문서 언급됨) |
| 7 | 분기별 실패 결과 접근 방법 불명 | Principle 3 | `errorPolicy=continue` 시 실패한 분기의 결과 표현 구조 필요 |
| 8 | `output.count` 로 분기 수 echo 초안 | **Principle 1.1 — config ↔ output 직교성** | 초기 제안 `{ branches, count }` 의 `count` 는 `config.branchCount` 의 단순 echo. 런타임 관점의 "실제 완료된 분기 수" 는 `meta.branches` 로 분리해야 함 |

## 3. 제안된 Output 구조

### Before (1단계 - 핸들러 반환)

```json
{
  "output": { "incoming": "data" },
  "port": ["branch_0", "branch_1", "branch_2"]
}
```

### Before (3단계 - 엔진 덮어쓰기 후)

```json
{
  "output": [
    "branch_0 terminal",
    "branch_1 terminal",
    "branch_2 terminal"
  ],
  "port": ["done"]
}
```

### After (1단계 - 핸들러 반환)

```json
{
  "config": { "branchCount": 3, "maxConcurrency": 0 },
  "output": null,
  "port": ["branch_0", "branch_1", "branch_2"]
}
```

### After (3단계 - 엔진 덮어쓰기 후)

```json
{
  "config": { "branchCount": 3, "maxConcurrency": 0 },
  "output": {
    "branches": [
      { "status": "success", "value": "branch_0 terminal" },
      { "status": "success", "value": "branch_1 terminal" },
      { "status": "failure", "error": { "code": "BRANCH_FAILED", "message": "..." } }
    ]
  },
  "meta": {
    "durationMs": 452,
    "branches": 3,
    "concurrency": 3,
    "successCount": 2,
    "failureCount": 1,
    "errorPolicy": "continue"
  },
  "port": "done"
}
```

**핵심 변경점**:

- 핸들러 1단계 output 을 `null` 로 변경 (Principle 9.1). 각 분기의 initial input 은 엔진의 ParallelExecutor 가 context 에서 shallow clone 으로 전달.
- 최종 `output` 을 `{ branches: [...] }` 로 래핑 (Principle 9.2). **Breaking change**.
- **`output.count` 제거** (P1.1). `config.branchCount` 와 중복이며, 배열 길이가 필요하면 `branches.length` 또는 `meta.branches` 사용.
- `branches[i]` 를 `{ status: 'success' | 'failure', value?, error? }` 구조로 표준화 — `errorPolicy=continue` 에서 실패 분기 표현 통일. 이는 `Promise.allSettled` 와 의미적 대응.
- `port` 를 `['done']` 배열 → `'done'` 문자열로 변경 (단일 포트 활성화이므로 Principle 5 에 따라 문자열 적절).
- `meta.branches` 는 **실제로 완료된 분기 수**를 기록. 전 분기 정상 완료 시 `config.branchCount` 와 같지만, `waitAll:false` 혹은 일부 분기 취소/에러 시 값이 달라짐. 런타임 메트릭으로 존재 가치가 있음.
- `meta.durationMs`, `meta.concurrency`, `meta.successCount`, `meta.failureCount`, `meta.errorPolicy` 추가.
- `done` 하류 input 도 `{ branches: [...] }` 로 변경 — parallel 의 `output` 과 동일 구조로 대칭 (하류 input 에서도 `count` 는 제거).
- `waitAll: false` 는 Phase P1 에서 **schema 에서 제거** 또는 validate 단계 warn → reject. fire-and-forget 은 `background` 노드로 명확히 안내.

### 3.1. `config.branchCount` vs `meta.branches` — 구분

| 필드 | 의미 | 예시 |
| --- | --- | --- |
| `config.branchCount` | 사용자가 설정한 **목표 분기 수** (리터럴) | `3` |
| `meta.branches` | **실제로 완료된 분기 수** (런타임 메트릭) | `3` (정상 완료), `2` (1개 취소/미완료), `0` (즉시 에러) |
| `meta.successCount` + `meta.failureCount` | 완료된 분기 중 성공/실패 분해 | `2` + `1` |
| `output.branches.length` | 수집된 결과 배열 길이 (= `meta.branches` 와 동일 값) | `3` |

> `config.branchCount` 의 값을 `output` 에 echo 하지 않고, 런타임 관점의 완료 수만 `meta` 로 분리 (P1.1 직교성).

## 4. 마이그레이션 영향도

| Expression 경로 (Before) | Expression 경로 (After) | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["X"].output` | `$node["X"].output.branches` | **Yes** | 배열이 서브필드로 이동 |
| `$node["X"].output[0]` | `$node["X"].output.branches[0].value` | **Yes** | status/value 래핑 |
| `$node["X"].output[0].foo` | `$node["X"].output.branches[0].value.foo` | **Yes** | 중첩 필드 접근 |
| `$node["X"].output.length` | `$node["X"].output.branches.length` 또는 `$node["X"].meta.branches` | **Yes** | **`output.count` 제거**. 의도가 "실제 완료된 분기 수" 이면 `meta.branches` |
| `$node["X"].config.branchCount` | `$node["X"].config.branchCount` | No | 설정값은 `config` 로만 참조 (P1.1) |
| `$node["X"].port` === `["done"]` | `$node["X"].port` === `"done"` | **Yes** | 배열 → 문자열 |
| `$input.branches` (done 하류) | `$input.branches` | No | 이미 동일 구조 유지 |
| `$input.branches[0]` (done 하류) | `$input.branches[0].value` | **Yes** | branches 원소 래핑 변경 |
| (없음) | `$node["X"].meta.branches` | No (추가) | 신규 — 완료된 분기 수 |
| (없음) | `$node["X"].meta.successCount` | No (추가) | 신규 |
| (없음) | `$node["X"].meta.failureCount` | No (추가) | 신규 |
| (없음) | `$node["X"].meta.durationMs` | No (추가) | 공통 |
| `$node["X"].config.waitAll` | (제거 또는 deprecated) | **Yes** | dead field |

**권장 전략**:

1. P0: 엔진의 `ParallelExecutor` + `runContainerInner` 에서 parallel/loop/foreach/map 동시 래핑 변경 (loop/parallel 은 `count` 없이, foreach/map 은 input 길이 기반 런타임 값이므로 `count` 유지 — 축 7.5 "보존" 참조).
2. P0: 분기별 결과를 `{status, value|error}` 로 래핑 — `errorPolicy=continue` 에서의 표현 통일.
3. P0: Migration script — `$node["X"].output[i]` → `$node["X"].output.branches[i].value`.
4. P1: `waitAll: false` schema 제거. migration notice: fire-and-forget 은 `background` 노드로.
5. P1: `done` 하류 input 구조를 노드 output 과 동일하게 유지하여 "parallel 결과를 어디서 보든 같은 구조" 를 보장 (역시 `count` 필드 없음).

## 5. 근거

- **Principle 9.2 (Container 최종 output)**: `parallel` 의 결과는 `{ branches: [...] }` 로 구조화. CONVENTIONS 표의 기조를 따르되 P1.1 적용으로 `count` 제거.
- **Principle 1.1 (config ↔ output 직교성, 신규 적용)**: `config.branchCount` 는 사용자가 UI 에서 설정한 리터럴 값이므로 `config` 에만 존재. `output.count` 로 echo 하면 직교성 위반. 런타임 관점의 "실제 완료된 분기 수" 는 `meta.branches` 로 분리하여 `waitAll:false`/취소/에러 시나리오에서 의미 있는 값을 가지도록 함.
- **Principle 9.1 (오버라이트 규칙)**: 핸들러 `output: null` + 엔진 덮어쓰기 패턴으로 loop/foreach/map 과 통일.
- **Principle 5 (port 활성화 모델)**: 1단계의 `port: string[]` 은 fan-out 정당. 3단계의 `port: 'done'` (단일) 로 의미 명확화.
- **Principle 3 (에러 컨트랙트)**: 분기별 `{status, value|error}` 래핑은 `errorPolicy=continue` 에서의 실패 표현을 통일하며 `Promise.allSettled` 의 `{status, value|reason}` 모델과 자연스럽게 대응.
- **Principle 2 (meta)**: `successCount`, `failureCount`, `concurrency`, `durationMs` 는 모두 실행 메트릭. Container 카테고리 `meta.branches` 는 CONVENTIONS Principle 2 에 명시. 이 필드가 `output.count` 를 대체하는 위치.
- **Principle 7 (Config echo)**: dead field `waitAll` 은 echo 가치가 없으며 사용자 혼란 유발.
- **대칭성**: `$node["X"].output.branches` 와 `done` 하류 `$input.branches` 가 동일 구조 — "parallel 의 결과는 어디서 보든 `.branches`" 라는 한 문장으로 정리.
- INCONSISTENCY_MATRIX 축 5 / 축 7.5: parallel 의 단순 배열 → `{branches}` 전환 + `count` 제거.
