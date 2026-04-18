# Filter (`filter`)

> 배열을 조건에 따라 필터링하여 통과한 항목과 미통과 항목을 분리합니다. If/Else와 다르게 **각 항목 별로** 조건을 평가합니다.

- **카테고리**: `logic`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `inputField` | string (expression) | yes | `''` | 필터링할 배열 경로 | yes |
| `conditions` | `ConditionGroup[]` | yes (1개 이상) | `[]` | 평가할 조건 목록 (각 항목에 대해 적용) | `field`/`value` 내부 |
| `combineMode` | `'and' \| 'or'` | no | `'and'` | 조건들의 결합 방식 | no |
| `strictComparison` | boolean | no | `false` | `eq`/`neq` 시 타입 강제 변환 없이 비교 (`===` vs `==`) | no |

`ConditionGroup` 구조 및 연산자는 If/Else와 공통:

| operator | 의미 |
| --- | --- |
| `eq`, `neq`, `gt`, `gte`, `lt`, `lte` | 비교 |
| `contains`, `not_contains`, `starts_with`, `ends_with` | 문자열 |
| `is_empty`, `is_not_empty`, `is_null` | 빈/null 체크 |
| `regex` | 정규식 (200자 이하; 컴파일 실패 시 false) |
| `is_type` | 타입 체크 (`'string'`, `'number'`, `'boolean'`, `'object'`, `'array'`, `'null'`, `'undefined'`) |

> Filter의 조건은 If/Else와 달리 **각 항목**에 대해 평가됩니다. `condition.field`는 `$item`에 대한 dot-path로 해석됩니다.

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | 배열을 포함한 객체 |
| Output | `match` | Match | 조건 통과 항목들 (`output.match`) |
| Output | `unmatched` | Unmatched | 조건 미통과 항목들 (`output.unmatched`) |

> Filter는 단일 output 객체에 두 배열을 모두 담아 반환합니다. 두 포트로 라우팅하지 않고, **양쪽 후속 노드 모두 같은 output 객체에서 자기 키를 꺼내** 사용하는 패턴입니다.

## Input

`inputField` dot-path 또는 inline 표현식으로 배열을 추출합니다. **배열이 아니면 에러를 던집니다** (`Filter inputField does not resolve to an array`).

## Output

### Case 1: 정상 필터링

input: `{ items: [{ age: 25 }, { age: 12 }, { age: 30 }] }`
config: `{ inputField: "items", conditions: [{ field: "age", operator: "gte", value: 18 }], combineMode: "and" }`

```json
{
  "config": {
    "inputField": "items",
    "conditions": [{ "field": "age", "operator": "gte", "value": 18 }],
    "combineMode": "and",
    "strictComparison": false
  },
  "output": {
    "match": [{ "age": 25 }, { "age": 30 }],
    "unmatched": [{ "age": 12 }]
  }
}
```

### Case 2: 모두 통과

```json
{
  "config": { ... },
  "output": {
    "match": [{...}, {...}, {...}],
    "unmatched": []
  }
}
```

### Case 3: `inputField`가 배열이 아님 → 에러

핸들러가 throw → 노드 실패.

| 필드 | 설명 |
| --- | --- |
| `output.match` | 조건 통과 항목 배열 |
| `output.unmatched` | 조건 미통과 항목 배열 |

`meta` / `port` / `status` 사용 안 함.

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Adults`라고 가정:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Adults"].output.match }}` | `[{age:25}, {age:30}]` | 통과한 항목 배열 |
| `{{ $node["Adults"].output.unmatched }}` | `[{age:12}]` | 통과하지 못한 항목 배열 |
| `{{ $node["Adults"].output.match.length }}` | `2` | 통과 개수 |
| `{{ $node["Adults"].config.combineMode }}` | `"and"` | 결합 방식 |

## 주의사항

- `inputField`는 배열로 해석되어야 합니다. 배열이 아닐 가능성이 있으면 사전에 보장하세요.
- `conditions[].field`는 **각 항목**에 대한 dot-path입니다. 항목 객체의 필드 경로를 적습니다 (예: `"age"`, `"profile.email"`).
- If/Else와 같은 연산자를 사용하지만 evaluator는 다른 모듈(`condition-eval.util.ts`)을 사용 — `regex`, `is_type` 도 정상 동작합니다 (If/Else와 다른 점).
- `regex`는 200자 초과 시 무시됨 (false 반환). 정규식 컴파일 실패 시에도 false.
- `strictComparison: true`이면 `eq`/`neq`가 `===`/`!==` 사용. 기본은 `==`/`!=`.
- 출력은 두 배열이 모두 들어있는 단일 객체. 후속 노드는 `output.match` 또는 `output.unmatched`로 자신이 원하는 쪽을 골라 사용.
