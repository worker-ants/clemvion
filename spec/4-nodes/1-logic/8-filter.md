# Spec: Filter

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Transform 노드](../5-data/1-transform.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [CONVENTIONS](../../../user_memo/node-specs-improvement/CONVENTIONS.md)

배열을 조건에 따라 두 그룹으로 분리하는 **분기 노드**. 입력 배열의 각 항목을 조건으로 평가하여, 매칭 항목은 `match` 포트로, 비매칭 항목은 `unmatched` 포트로 동시에 분배한다.

> **Transform `array_filter` 와의 차이**: [Transform 노드](../5-data/1-transform.md) 의 `array_filter` 는 변환 체인 내에서 특정 필드의 배열을 간단한 조건식으로 필터링하는 인라인 연산이다. Filter 노드는 워크플로우 흐름 상의 독립 노드로, 다중 조건(ConditionGroup) 과 조건 결합(AND/OR) 을 지원하며, 매칭/비매칭 항목을 **양쪽 포트 동시 활성화** 로 분배한다.
>
> **Logic 공통 §10 Pass-through 규약과의 차이**: if_else / switch 같은 pass-through 분기 노드는 input 을 변형 없이 단일 포트로 흘려보내지만, Filter 는 **데이터 변형(부분집합 분리)** 노드다. `output.match` / `output.unmatched` 는 input 배열의 부분집합이지 input 자체가 아니다.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| inputField | Expression | ✓ | `''` | 대상 배열. dot-path 문자열(`"items"`, `"order.items"`) 이면 `$input` 에 적용하고, `{{ $var.a }}` 처럼 inline 표현식이면 expression resolver 가 평가한 값(배열)을 그대로 사용 |
| conditions | ConditionGroup[] | ✓ | `[]` | 필터 조건 목록. 구조는 [공통 §1](./0-common.md#1-conditiongroup-구조). `condition.field` 표현식 안에서 `$item` / `$itemIndex` 로 현재 배열 항목·인덱스를 참조 |
| combineMode | `and` / `or` | ✓ | `and` | 조건 그룹 간 결합 방식 |
| strictComparison | Boolean | | `false` | 엄격 타입 비교 모드. [표현식 §3.2.1](../../5-system/5-expression-language.md#321-strict-모드) |

지원 연산자는 [공통 §2](./0-common.md#2-지원-연산자) 참조.

**`condition.field` 작성 규칙** (handler 구현 §4 참조):

| `field` 값 | 의미 |
|------------|------|
| `undefined` / `''` / `'$item'` | item 자체와 비교 (스칼라 배열 `[1, 2, 3]` 등) |
| `'name'`, `'user.profile.age'` | item 의 dot-path lookup |
| `'{{ $item.<key> }}'` 등 | 인라인 표현식. per-item context (`$item`, `$itemIndex`) 로 평가. workflow context (`$var`, `$input` 등) 도 상속 |

> Source of truth: `backend/src/nodes/logic/filter/filter.schema.ts` (export `filterNodeConfigSchema` / `validateFilterConfig`).

## 2. 설정 UI

```
┌──────────────────────────────────────┐
│  Array Field                         │
│  [$input.items___________________]   │
│                                      │
│  Conditions (AND ▼)                  │
│                                      │
│  ┌──────────────────────────────────┐│
│  │ {{ $item.status }} [equals ▼]   ││
│  │ "active"                    [×] ││
│  └──────────────────────────────────┘│
│  ┌──────────────────────────────────┐│
│  │ {{ $item.age }}  [greater ▼]    ││
│  │ 18                          [×] ││
│  └──────────────────────────────────┘│
│                                      │
│  [+ Add Condition]                   │
│                                      │
│  ☐ Strict type comparison            │
└──────────────────────────────────────┘
```

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 평가 대상 데이터 (1개 필수). `inputField` 로 참조할 배열을 포함 |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `match` | Match | data | false | 조건 만족 항목 배열. 다운스트림 노드는 `$node["X"].output.match` 를 입력으로 받음 |
| `unmatched` | Unmatched | data | false | 조건 불만족 항목 배열. 다운스트림 노드는 `$node["X"].output.unmatched` 를 입력으로 받음 |

> **양쪽 포트 동시 활성화**: Filter 는 `port` 를 반환하지 않는다 (CONVENTIONS Principle 5 의 "기본 단일 출력" 형태이지만 출력 포트가 2개). 두 포트의 엣지는 모두 follow 되며, 각각 `output.match` / `output.unmatched` sub-key 가 다운스트림 input 으로 전달된다.

## 4. 실행 로직

**Per-item expression context**: 조건 평가 시 각 배열 항목마다 다음 변수가 바인딩되며, workflow 전역 컨텍스트 (`$input`, `$var`, `$node["..."]`) 는 그대로 상속된다.

| 변수 | 타입 | 설명 |
|------|------|------|
| `$item` | 현재 항목 | 평가 중인 배열 원소 |
| `$itemIndex` | number (0-based) | 현재 항목의 배열 인덱스 |

**실행 단계**:

1. `inputField` 로 배열을 추출:
   - 문자열이면 `$input` 의 dot-path lookup (`getNestedValue`).
   - 인라인 표현식 평가가 이미 끝난 배열 값이면 그 값을 그대로 사용.
2. **배열이 아니면 throw** (`Filter inputField does not resolve to an array`). 현재 구현은 `null` / `undefined` 도 throw 한다 — Principle 10 의 `[]` fallback 정책은 P1 미구현 (§6 참조).
3. 각 항목에 대해 `$item` / `$itemIndex` 를 expression context 에 바인딩.
4. 각 조건의 `field` / `value` 를 [`condition-eval.util`](../../../backend/src/nodes/logic/_shared/condition-eval.util.ts) 의 `evaluateResolvedCondition` 으로 평가:
   - `field` 가 빈/`$item` 이면 item 자체, 표현식이면 평가, 그 외 dot-path lookup.
   - `value` 가 표현식이면 평가, 그 외 리터럴.
   - `regex` 연산자는 패턴 길이 ≤ 200 인 경우만 컴파일하며, 컴파일 실패 / 길이 초과는 silent `false` 처리 후 패턴별로 캐싱한다.
5. `combineMode === 'or'` 이면 `some`, `'and'` (기본) 이면 `every` 로 결합.
6. 매칭 항목은 `match`, 비매칭 항목은 `unmatched` 배열에 push (입력 순서 보존).
7. 빈 입력 배열 (`[]`) 은 `match: [], unmatched: []` 로 정상 출력.

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> Filter 는 단일 케이스로 두 포트 결과를 동시에 출력한다 (분기 분리 케이스 없음). 빈 배열·전체 매칭·전체 비매칭은 모두 동일한 출력 형태의 특수 값일 뿐이며, 별도 케이스로 분리하지 않는다.

### 5.1 Case: 정상 분리 (양쪽 포트 동시 활성화)

```json
{
  "config": {
    "inputField": "items",
    "conditions": [
      { "field": "{{ $item.status }}", "operator": "eq", "value": "active" }
    ],
    "combineMode": "and",
    "strictComparison": false
  },
  "output": {
    "match": [
      { "name": "Alice", "status": "active" },
      { "name": "Charlie", "status": "active" }
    ],
    "unmatched": [
      { "name": "Bob", "status": "inactive" }
    ]
  },
  "meta": {
    "durationMs": 0
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.inputField` | Expression \| 평가된 배열 | config echo (Principle 7) | 사용자가 입력한 raw 값 — 인라인 표현식이면 평가 전 형태 그대로 echo. `context.rawConfig.inputField` 우선 |
| `config.conditions` | ConditionGroup[] | config echo | raw 조건 — `field` / `value` 의 `{{ }}` 보존 |
| `config.combineMode` | `'and'` / `'or'` | config echo | default `'and'` |
| `config.strictComparison` | boolean | config echo | default `false` |
| `output.match` | Array | handler return | 조건 만족 항목 배열 (입력 순서 보존). 빈 배열도 가능 |
| `output.unmatched` | Array | handler return | 조건 불만족 항목 배열 (입력 순서 보존). 빈 배열도 가능 |
| `meta.durationMs` | number | engine inject | 실행 시간 (ms). 엔진이 모든 노드에 공통 주입 |

> **`port` 필드 없음**: Filter 는 `port` 를 반환하지 않으며 `match` / `unmatched` 두 포트가 모두 활성화된다. 다운스트림 분기는 `output.match` / `output.unmatched` sub-key 로 이뤄진다 (§3.2).

> ⚠ **미구현 (P0 — meta 메트릭)**: 현재 `filter.handler.ts` 는 `meta` 필드를 반환하지 않는다 (`durationMs` 는 엔진 주입). user_memo [logic/filter.md](../../../user_memo/node-specs-improvement/logic/filter.md) §3 의 P0 제안:
>
> ```jsonc
> "meta": {
>   "durationMs": 3,
>   "matchedCount": 1,         // O(1) 카운트 (Principle 2)
>   "unmatchedCount": 1,       // O(1) 카운트
>   "totalCount": 2,           // matched + unmatched
>   "fellBackToEmpty": false,  // null/undefined → [] fallback 발생 여부 (P1 함께)
>   "invalidRegexPatterns": [] // 컴파일 실패 / 길이 초과 패턴 가시화 (P1)
> }
> ```
>
> 코드 반영 시까지 다운스트림은 `$node["X"].output.match.length` 등 배열 `.length` 접근으로 카운트를 얻는다.

**Expression 접근 예**:
- `$node["X"].output.match` → `[{ name: "Alice", ... }, ...]`
- `$node["X"].output.unmatched` → `[{ name: "Bob", ... }, ...]`
- `$node["X"].output.match.length` → 매칭 개수 (P0 구현 후 `meta.matchedCount` 권장)
- `$node["X"].config.conditions` → raw 조건 (표현식 보존)

**특수 값 동작**:

| 입력 | `output.match` | `output.unmatched` |
|------|----------------|---------------------|
| `[]` (빈 배열) | `[]` | `[]` |
| 모든 항목 매칭 | 입력 그대로 | `[]` |
| 모든 항목 비매칭 | `[]` | 입력 그대로 |

## 6. 에러 코드

Filter 는 **runtime 에러 포트를 갖지 않는다**. 모든 검증 실패는 pre-flight 단계에서 throw 된다 (CONVENTIONS Principle 3.1):

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `inputField` 가 빈 문자열 / 누락 | `Input 필드를 입력해야 합니다.` | warningRule (캔버스 배지) + handler.validate |
| `conditions` 가 빈 배열 / 누락 | `최소 1개 이상의 조건을 추가해야 합니다.` | warningRule (캔버스 배지) + handler.validate |
| `conditions[i].field` 가 string 이 아님 | `conditions[i].field must be a string` | handler.validate (필드 누락 / 빈 문자열 / `'$item'` 은 item-self sentinel 이라 허용) |
| `conditions[i].operator` 가 enum 미일치 | `conditions[i].operator must be one of: eq, neq, …` | handler.validate |
| `combineMode` 가 `and`/`or` 외 | `combineMode must be "and" or "or"` | handler.validate |
| `inputField` resolve 결과가 배열이 아님 (string·number·object·null·undefined) | `Filter inputField does not resolve to an array` | execute (런타임 throw) |

> ⚠ **미구현 (P1 — Principle 10 fallback)**: 현재 `null` / `undefined` 입력도 throw 된다. user_memo 개선안은 `null` / `undefined` 만 `[]` fallback 으로 변경하고 `meta.fellBackToEmpty: true` 로 표시하는 정책을 제안 (primitive throw 는 유지). 코드 반영 시 본 §7 의 마지막 행에서 `null` / `undefined` 케이스가 분리된다.

> ⚠ **미구현 (P1 — regex 가시화)**: `regex` 컴파일 실패 / 길이 초과는 현재 silent `false` 처리되어 사용자가 패턴 오류를 감지할 수 없다. user_memo 개선안은 실패 패턴을 `meta.invalidRegexPatterns: string[]` 로 누적해 가시화하는 방식을 제안.

## 7. 캔버스 요약

[공통 §8](./0-common.md#8-캔버스-요약) — `Filter` 행 인용.
