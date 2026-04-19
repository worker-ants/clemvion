# Filter (`filter`)

> 배열의 각 항목을 조건에 따라 평가해 통과한 항목(`match`)과 미통과 항목(`unmatched`)을 분리합니다. If/Else가 단일 값에 대한 라우팅이라면, Filter는 배열 원소 단위 평가입니다.

- **카테고리**: `logic`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

출처: `backend/src/nodes/logic/filter/filter.schema.ts`

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `inputField` | string \| unknown (expression) | yes | `''` | 필터 대상 배열. 문자열이면 input dot-path, 그 외 타입은 해석된 값 그대로 | yes |
| `conditions` | `ConditionGroup[]` | yes (1개 이상) | `[]` | 각 항목에 대해 평가할 조건 목록 | **conditions 자체는 expression 해석 제외** (`EXPRESSION_EXCLUSIONS.filter = {'conditions'}`). 각 조건의 `field`/`value`는 항목별로 해석 — 아래 주의사항 참고 |
| `combineMode` | `'and' \| 'or'` | no | `'and'` | 조건 결합 방식 | no |
| `strictComparison` | boolean | no | `false` | `eq` / `neq` 비교 시 타입 강제 변환 없이 `===` / `!==` 사용 | no |

`ConditionGroup` 항목: `{ field, operator, value }` — If/Else와 구조 동일. `field`는 **각 배열 항목에 대한 dot-path** 입니다 (input이 아닌 `$item` 기준).

지원 연산자 (`_shared/condition-eval.util.ts` — 실제로 모두 구현됨):

| operator | 의미 |
| --- | --- |
| `eq` / `neq` | `strictComparison=true`면 `===` / `!==`, 아니면 `==` / `!=` |
| `gt`, `gte`, `lt`, `lte` | `Number()` 강제 변환 후 비교 (NaN이면 전부 false) |
| `contains`, `not_contains` | 두 값 모두 string일 때만. 그렇지 않으면 **둘 다 false** (If/Else의 `not_contains`와 다름 — 여기서는 대칭) |
| `starts_with`, `ends_with` | 두 값 모두 string일 때 |
| `is_empty`, `is_not_empty` | `''` / `null` / `undefined` / 빈 배열 기준 |
| `is_null` | `null` 또는 `undefined` |
| `regex` | `value`가 string이고 길이 ≤ 200자(`MAX_REGEX_LENGTH`), 컴파일 가능해야 함. 컴파일 실패·초과 시 false |
| `is_type` | `value`가 `'string' \| 'number' \| 'boolean' \| 'object' \| 'array' \| 'null' \| 'undefined'` 중 하나여야 함 |

## Ports

출처: `backend/src/nodes/logic/filter/filter.schema.ts`

| 방향 | id | label | type | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | data | 배열을 포함한 데이터 |
| Output | `match` | Match | data | 조건 통과 항목 배열 |
| Output | `unmatched` | Unmatched | data | 조건 미통과 항목 배열 |

> Filter는 두 포트를 **동시에 활성화하지 않습니다.** `port` 필드를 반환하지 않고 `output.match` / `output.unmatched` 에 각각 담아 반환하므로, 후속 노드 연결은 그래프에서 `match` / `unmatched` 에지로 연결하더라도 output 구조 내 접근입니다.

## Input

핸들러는 `resolveFieldValue(input, inputField)`로 배열을 해석합니다. **배열이 아니면 에러** (`"Filter inputField does not resolve to an array"`). 이후 각 item에 대해:
- `combineMode === 'or'` 이면 `conditions.some(...)`
- 아니면 `conditions.every(...)`

조건 평가는 각 item을 대상으로 `evaluateCondition(item, cond, strictComparison, compiledRegex)` 호출.

## Output

### Case 1: 일부 통과 / 일부 미통과

```json
{
  "config": {
    "inputField": "items",
    "conditions": [{ "field": "status", "operator": "eq", "value": "active" }],
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
  }
}
```

### Case 2: 배열이 아닌 값 or 경로 miss → 에러

핸들러가 에러를 던집니다: `"Filter inputField does not resolve to an array"` — 기본 에러 정책(stop)에 따라 노드가 FAILED.

| 필드 | 설명 |
| --- | --- |
| `config.inputField` | 원본 `inputField` |
| `config.conditions` | 조건 정의 |
| `config.combineMode` | 결합 방식 |
| `config.strictComparison` | 엄격 비교 여부 |
| `output.match` | 조건 통과 항목 배열 |
| `output.unmatched` | 조건 미통과 항목 배열 |

`meta` / `port` / `status` 는 사용하지 않습니다.

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Active Users`라고 가정:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Active Users"].output.match }}` | `[{...}, {...}]` | 조건 통과 항목 배열 |
| `{{ $node["Active Users"].output.unmatched }}` | `[{...}]` | 미통과 항목 배열 |
| `{{ $node["Active Users"].output.match.length }}` | `2` | 통과 개수 |
| `{{ $node["Active Users"].output.match[0].name }}` | `"Alice"` | 첫 통과 항목의 필드 |
| `{{ $node["Active Users"].config.conditions }}` | `[{...}]` | 조건 정의 |

## 주의사항

- **조건은 expression resolver에서 해석되지 않습니다.** `expression-exclusions.ts` 에서 `filter.conditions` 가 제외되어 있습니다. 즉 `conditions[].field` / `conditions[].value` 에 `{{ ... }}` 같은 inline 표현식을 넣어도 현재 구조에서는 자동 해석되지 않습니다. 대신 `field` 는 "항목(item) 기준 dot-path", `value` 는 리터럴로 작성하세요. item 레벨의 path/constants로 처리하도록 설계됐습니다.
- `inputField` 해석 결과가 배열이 아니면 **에러** 를 던집니다 (`'Filter inputField does not resolve to an array'`). Split/ForEach의 "빈 배열 fallback" 과 다릅니다.
- `regex` 패턴은 200자 초과 또는 컴파일 실패 시 해당 조건은 `false`. 안전상 throw하지 않고 조용히 reject 처리.
- `is_type` 의 `value` 는 정해진 7종 타입 문자열 중 하나여야 하며, `'function'` 같은 값은 false fall-through.
- `contains` / `not_contains` 는 **둘 다 문자열일 때만** 평가하고 그 외에는 둘 다 false를 반환합니다 (If/Else의 `not_contains` 와 다른 점).
- `combineMode` 가 생략되면 기본 `'and'`.
