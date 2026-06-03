---
id: merge
status: implemented
code:
  - codebase/backend/src/nodes/logic/merge/merge.*.ts
---

# Spec: Merge

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [CONVENTIONS](../../conventions/node-output.md)

여러 입력 경로의 데이터를 하나로 합치는 **데이터 노드**. `strategy` 와 `outputFormat` 의 조합으로 결과 형태를 결정한다. Phase P1 순차 엔진 기준 모든 predecessor 가 이미 해소된 뒤 실행되므로 별도의 fan-in barrier 는 적용되지 않는다.

> **P1 한정 동작**:
> - `timeout` / `partialOnTimeout` 은 schema 에는 노출되어 있으나 P1 에서는 barrier 가 dormant — 0이 아닌 값(`timeout > 0`, `partialOnTimeout === true`)을 설정하면 핸들러가 warn 로그를 남긴다. 동시에 `warningRules` (`merge:timeout-dormant`, `merge:partial-on-timeout-dormant`) 가 발화하며, 이 두 룰은 `severity` 가 명시되지 않아 evaluator 기본값인 **`blocking`** 으로 평가된다 (`packages/node-summary/src/evaluator.ts` `evaluateWarnings`). 따라서 캔버스 배지로 노출될 뿐 아니라 `handler.validate` 의 `evaluateMetadataBlockingErrors` 경로를 통해 **validation 차단 에러**로도 집계된다 (§6 참조). 실제 barrier 는 P2 에서 활성화 예정.
> - `strategy: 'first'` 는 "먼저 도착한 입력" 이 아니라 **predecessor 키 정렬 후 첫 번째** 값을 반환한다 (Phase P1 한정).

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| strategy | `wait_all` / `first` / `append` | ✓ | `wait_all` | 병합 전략. §3.1 표 참조 |
| outputFormat | `array` / `merge_object` / `indexed` | ✓ | `array` | 출력 형식. §3.2 표 참조 |
| timeout | Integer (≥ 0) | | `300` | 입력 대기 타임아웃 (초). `0 = no timeout`. **P1 dormant** |
| partialOnTimeout | Boolean | | `false` | 타임아웃 시 부분 병합 수행 여부. **P1 dormant** |

> Source of truth: `codebase/backend/src/nodes/logic/merge/merge.schema.ts` (export `mergeNodeConfigSchema`).

### 1.1 병합 전략 (`strategy`)

| 값 | 설명 |
|----|------|
| `wait_all` | 모든 입력이 도착한 뒤 전체 병합 (기본) |
| `first` | 첫 번째 입력만 통과. **P1 한정**: 입력 객체의 키를 정렬한 뒤 첫 항목을 사용 (실제 도착 순서 아님) |
| `append` | 도착 순서대로 누적. P1 에서는 `wait_all` 과 동일하게 모든 입력을 그대로 누적 |

### 1.2 출력 형식 (`outputFormat`)

| 값 | output shape |
|----|--------------|
| `array` | `unknown[]` — 각 입력을 배열 요소로 |
| `merge_object` | `Record<string, unknown>` — 객체 입력들을 shallow merge. 비객체 입력은 무시. `__proto__` / `constructor` / `prototype` 키는 prototype pollution 방지를 위해 drop |
| `indexed` | `Record<string, unknown>` — `{ in_0, in_1, ... }` 형태로 인덱스 키 부여 |

> 출력 shape 이 `outputFormat` 에 따라 달라지는 것은 merge 의 본질적 기능이다. 후속 노드는 `$node["X"].config.outputFormat` 으로 shape 를 식별한다.

## 2. 설정 UI

```
┌──────────────────────────────────────┐
│  Strategy        [wait_all ▼]        │
│  Output Format   [array ▼]           │
│  Timeout (s)     [300]               │
│  ☐ Partial on Timeout                │
└──────────────────────────────────────┘
```

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 다중 엣지 수신 가능. 엔진은 predecessor 노드별 결과를 객체(`{ <nodeId>: value }`) 또는 배열로 모아 전달 |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `out` | Output | data | false | 병합 결과 단일 출력 (`port` 미설정 — Principle 5) |

> Merge 는 동적 포트가 없다. 분기 / 에러 포트도 없다.

## 4. 실행 로직

1. `input` 을 `unknown[]` 로 정규화 (§4.1).
2. `strategy === 'first'` 이면 정규화 배열의 첫 항목만 남기고 (`[inputs[0]]`), 그 외 (`wait_all` / `append`) 는 전체 배열을 사용.
3. `outputFormat` 에 따라 결과를 포맷 (§4.2). `merge_object` 에서 prototype-pollution 으로 drop 된 키는 별도로 수집한다 (정렬·중복 제거 → `meta.skippedKeys`).
4. `timeout > 0` 이거나 `partialOnTimeout === true` 이면 **warn 로그**를 남긴다 (실행 결과에는 영향 없음 — barrier 가 P1 dormant). 해당 필드는 `meta.dormantFields` 에 누적된다. (단, 같은 조건의 `warningRules` 는 blocking 으로 평가되어 `handler.validate` 를 차단한다 — §6.)
5. `config` 는 dormant 여부와 무관하게 schema 4필드를 모두 echo 한다 (Principle 7; handler.ts D1 baseline — "Echo every non-sensitive schema field"). `strategy` / `outputFormat` 은 `context.rawConfig` 값에 DEFAULT 폴백(`?? 'wait_all'` / `?? 'array'`)을 적용하고, `timeout` / `partialOnTimeout` 은 `rawConfig` 값을 폴백 없이 그대로 echo 한다 (미설정 시 `undefined` → JSON 직렬화에서 생략).
6. `meta` 에 `inputCount` / `strategy` / `outputFormat` / `skippedKeys` / `dormantFields` 를 채워 반환 (Principle 2). `durationMs` 는 엔진이 주입.

### 4.1 입력 정규화 (Principle 10)

| 입력 형태 | 정규화 결과 |
|-----------|--------------|
| `Array` | 그대로 사용 |
| `Object`(non-null) | `Object.keys(input).sort()` 순으로 값 배열화 (deterministic) |
| `null` / `undefined` / primitive | `[input]` 으로 wrap (throw 하지 않음) |
| `{}` (빈 객체) | `[]` |
| `[]` (빈 배열) | `[]` |

### 4.2 outputFormat 별 포맷

| outputFormat | 동작 |
|--------------|------|
| `array` | 정규화된 배열을 그대로 반환 |
| `merge_object` | `Object.create(null)` 위에 객체 입력만 shallow merge. 후순위 키가 선순위 키를 덮어씀. `__proto__` / `constructor` / `prototype` 키는 drop. 비객체 항목은 skip |
| `indexed` | `{ in_0: inputs[0], in_1: inputs[1], ... }` 로 변환 |

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> Merge 는 단일 출력 데이터 노드이므로 §5.1 정상 케이스만 존재한다. 에러 포트는 없으며 (Principle 3.3 의 에러 포트 보유 노드가 아님), 모든 검증 실패는 pre-flight (config 검증) 단계에서 throw 된다.

### 5.1 Case: 정상 (단일 출력 — `out`)

```json
{
  "config": {
    "strategy": "wait_all",
    "outputFormat": "array"
  },
  "output": [{ "a": 1 }, { "b": 2 }],
  "meta": {
    "durationMs": 0,
    "inputCount": 2,
    "strategy": "wait_all",
    "outputFormat": "array",
    "skippedKeys": [],
    "dormantFields": []
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.strategy` | `'wait_all'` / `'first'` / `'append'` | config echo (Principle 7) | 사용자가 설정한 전략. `rawConfig.strategy ?? 'wait_all'` (DEFAULT 폴백) |
| `config.outputFormat` | `'array'` / `'merge_object'` / `'indexed'` | config echo | 출력 형식. `rawConfig.outputFormat ?? 'array'` (DEFAULT 폴백) |
| `config.timeout` | number | config echo | `rawConfig.timeout` 을 폴백 없이 그대로 echo (미설정 시 `undefined` → JSON 생략). 위 정상 예시는 미설정이라 생략됨 |
| `config.partialOnTimeout` | boolean | config echo | `rawConfig.partialOnTimeout` 을 폴백 없이 그대로 echo (미설정 시 `undefined` → JSON 생략) |
| `output` | `unknown[]` / `Record<string, unknown>` | runtime — `outputFormat` 별 분기 | 병합 결과. shape 은 §4.2 |
| `meta.durationMs` | number | engine inject | 실행 시간 (ms) |
| `meta.inputCount` | number | runtime | 실제 병합된 입력 수. `strategy: 'first'` 일 때는 1 (정규화 + slicing 후 길이) |
| `meta.strategy` | `'wait_all'` / `'first'` / `'append'` | runtime — resolved | 적용된 전략 (default 폴백 후 값). config echo 와 의미 동일하나 meta 측에서도 분기 키로 사용 가능 |
| `meta.outputFormat` | `'array'` / `'merge_object'` / `'indexed'` | runtime — resolved | 적용된 출력 형식 (default 폴백 후 값) |
| `meta.skippedKeys` | `string[]` | runtime — `merge_object` 한정 | prototype pollution 방지로 drop 된 키 (정렬·중복 제거). 다른 outputFormat 에서는 항상 `[]` |
| `meta.dormantFields` | `string[]` | runtime | P1 에서 dormant 처리된 config 필드 목록. `timeout > 0` 이면 `'timeout'`, `partialOnTimeout === true` 이면 `'partialOnTimeout'` 포함. 활성 상태가 아니면 `[]` |

> **shape 가변성 주의**: `output` 의 타입 자체가 `outputFormat` 에 따라 달라진다 (`array` → 배열 / `merge_object` · `indexed` → 객체). 후속 노드가 안전하게 분기하려면 `$node["X"].config.outputFormat` 을 키로 사용한다.

#### 5.1.1 outputFormat 별 output 예시

**`array`** — 정규화 배열을 그대로 노출
```json
{
  "config": { "strategy": "wait_all", "outputFormat": "array" },
  "output": [{ "a": 1 }, { "b": 2 }]
}
```

**`merge_object`** — 객체 입력 shallow merge, 후순위가 선순위 덮어씀
```json
{
  "config": { "strategy": "wait_all", "outputFormat": "merge_object" },
  "output": { "a": 1, "b": 3, "c": 4 },
  "meta": {
    "inputCount": 2,
    "strategy": "wait_all",
    "outputFormat": "merge_object",
    "skippedKeys": [],
    "dormantFields": []
  }
}
```
> Input `{ nodeA: { a: 1, b: 2 }, nodeB: { b: 3, c: 4 } }` 기준. `__proto__` / `constructor` / `prototype` 키를 가진 입력은 drop 되고 dropped 된 키는 `meta.skippedKeys` 에 정렬·중복 제거된 형태로 노출된다 (Principle 3 — silent failure 해소).

**`indexed`** — `in_<i>` 키로 인덱스 부여
```json
{
  "config": { "strategy": "wait_all", "outputFormat": "indexed" },
  "output": { "in_0": "first", "in_1": "second" }
}
```
> 현재 코드는 `in_<i>` 키 형태를 유지한다. 다운스트림은 `$node["X"].output.in_0` 등으로 접근. (후속으로 `{ items: [{ index, value }], count }` 형태로의 breaking 전환이 검토 대상)

**`strategy: 'first'`** — 정규화 배열의 첫 항목만 남기고 outputFormat 적용
```json
{
  "config": { "strategy": "first", "outputFormat": "array" },
  "output": ["first"]
}
```

**Expression 접근 예**:
- `$node["X"].output[0]` → 첫 번째 입력 (`outputFormat: array`)
- `$node["X"].output.a` → merge 된 키 값 (`outputFormat: merge_object`)
- `$node["X"].output.in_0` → 첫 번째 입력 (`outputFormat: indexed`)
- `$node["X"].config.outputFormat` → shape 판별용 (config echo)
- `$node["X"].meta.outputFormat` → shape 판별용 (meta echo, 동일한 값)
- `$node["X"].meta.inputCount` → 실제 병합된 입력 수
- `$node["X"].meta.skippedKeys` → `merge_object` 에서 drop 된 키 목록
- `$node["X"].meta.dormantFields` → P1 에서 dormant 처리된 config 필드 목록 (`timeout` / `partialOnTimeout`)

> `meta.durationMs` 는 엔진이 모든 노드에 공통 주입한다. 그 외 위 meta 필드는 핸들러가 직접 채우며 (CONVENTIONS Principle 2), `meta.skippedKeys` / `meta.dormantFields` 는 비활성 상태에서도 항상 `[]` 로 노출되어 후속 노드의 옵셔널 가드를 단순화한다.

## 6. 에러 코드

Merge 는 **runtime 에러 포트를 갖지 않는다**. 모든 검증 실패는 pre-flight (config 검증) 단계에서 throw 된다 (CONVENTIONS Principle 3.1):

메시지 SoT 는 영문(`merge.schema.ts` warningRules / handler 가드 문자열)이며, 프론트는 `WARNING_KO` 로 한국어 렌더한다.

| 발생 조건 | 메시지 (영문 SoT) | 시점 |
|-----------|--------|------|
| `strategy` 누락 / 빈 값 (`!strategy`) | `Merge strategy must be selected.` | warningRule `merge:no-strategy` (캔버스 배지) + handler.validate (`evaluateMetadataBlockingErrors`) |
| `strategy` enum 미일치 | `strategy must be one of: wait_all, first, append` | handler.validate |
| `outputFormat` enum 미일치 | `outputFormat must be one of: array, merge_object, indexed` | handler.validate |
| `timeout` 이 음수 또는 number 아님 | `timeout must be a non-negative number (0 = no timeout)` | handler.validate |
| `partialOnTimeout` 이 boolean 아님 | `partialOnTimeout must be a boolean` | handler.validate |
| `timeout > 0` (P1 dormant) | `Merge timeout is dormant in Phase P1 — value is logged but no barrier is enforced. The Phase P2 barrier will honor it.` | warningRule `merge:timeout-dormant` — `severity` 미명시 → 기본 `blocking` → handler.validate 차단 (캔버스 배지 + 차단 에러) |
| `partialOnTimeout` (truthy, P1 dormant) | `Merge partialOnTimeout is dormant in Phase P1 — only takes effect alongside the Phase P2 barrier.` | warningRule `merge:partial-on-timeout-dormant` — `severity` 미명시 → 기본 `blocking` → handler.validate 차단 |

> **dormant 필드의 이중 성격 주의**: `timeout` / `partialOnTimeout` 은 *실행(execute)* 에서는 결과에 영향 없는 dormant 이지만, *검증(validate)* 에서는 위 두 warningRule 이 `blocking` 으로 평가되어 차단 에러로 집계된다 (evaluator 기본 severity = `blocking`). 즉 dormant = "런타임 무영향" 이지 "검증 무영향" 이 아니다.

> **Phase P2 예정**: `timeout` 이 활성화되면 `MERGE_TIMEOUT` 코드와 함께 `error` 포트 / `output.error` 가 추가될 가능성이 있다. 현 P1 에서는 미구현.

## 7. 캔버스 요약

[공통 §8](./0-common.md#8-캔버스-요약) — `Merge` 행 인용 (`{N} inputs · {strategy}`).
