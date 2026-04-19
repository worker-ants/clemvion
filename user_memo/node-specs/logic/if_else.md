# If/Else (`if_else`)

> 조건을 평가하여 `true` 또는 `false` 포트로 흐름을 분기합니다. 데이터 자체는 변형하지 않고 input을 그대로 통과시킵니다.

- **카테고리**: `logic`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no (포트는 항상 `true` / `false` 두 개로 고정)

## Config 파라메터

출처: `backend/src/nodes/logic/if-else/if-else.schema.ts`

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `conditions` | `ConditionGroup[]` | yes (1개 이상) | `[]` | 평가할 조건 목록. 각 항목은 `{ field, operator, value }` | 각 항목의 `field` / `value`에서 가능 |
| `combineMode` | `'and' \| 'or'` | no | `'and'` | 여러 조건을 결합하는 방식 | no |
| `strictComparison` | boolean | no | `false` | 스키마상 정의 — 비교 시 타입 강제 변환을 생략 (if_else 핸들러는 읽지 않음) | no |

`ConditionGroup` 항목:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `field` | string (expression) | 평가 대상 값. input 객체 기준 dot-path(`"user.age"`) 또는 `{{ ... }}` 표현식 |
| `operator` | enum | 비교 연산자 (아래 표) |
| `value` | unknown (expression) | 비교 값. 표현식 평가 가능 |

지원 연산자 (schema 기준):

| operator | 핸들러 실제 동작 |
| --- | --- |
| `eq` / `neq` | `===` / `!==` 비교 |
| `gt`, `gte`, `lt`, `lte` | 두 값을 모두 `Number()`로 강제 변환 후 비교 |
| `contains`, `not_contains` | 두 값이 모두 string일 때만 `includes` / `!includes`; 아니면 `contains`는 `false`, `not_contains`는 `true` |
| `starts_with`, `ends_with` | 두 값이 모두 string일 때만 `startsWith` / `endsWith` |
| `is_empty` | `''` / `null` / `undefined` / 빈 배열이면 true |
| `is_not_empty` | 위의 부정 |
| `is_null` | `null` 또는 `undefined` 일 때 true |
| `is_type`, `regex` | **스키마에는 있으나 if_else 핸들러에는 구현되어 있지 않아 항상 `false`를 반환** — Filter 노드에서만 실제 동작 |

## Ports

출처: `backend/src/nodes/logic/if-else/if-else.schema.ts`

| 방향 | id | label | type | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | data | 평가 대상 데이터 |
| Output | `true` | True | data | 조건이 만족될 때 활성화 |
| Output | `false` | False | data | 조건이 만족되지 않을 때 활성화 |

## Input

이전 노드로부터 받은 데이터를 그대로 사용합니다. `conditions[].field`는 dot-path로 input 객체에 대해 평가됩니다 (예: `field: "user.age"` → `input.user.age`). 표현식을 `value`에 쓰면 엔진의 expression resolver가 핸들러 호출 전에 대입합니다.

## Output

핸들러는 `combineMode`에 따라 `every` / `some`으로 결합한 boolean 결과를 만든 다음, 그대로 `port: 'true' | 'false'`에 라우팅합니다. `output`은 항상 input pass-through입니다.

### Case 1: 조건 만족 → `true` 포트

```json
{
  "config": {
    "conditions": [{ "field": "user.age", "operator": "gte", "value": 18 }],
    "combineMode": "and"
  },
  "output": { "user": { "age": 25, "name": "Alice" } },
  "port": "true"
}
```

### Case 2: 조건 불만족 → `false` 포트

```json
{
  "config": {
    "conditions": [{ "field": "user.age", "operator": "gte", "value": 18 }],
    "combineMode": "and"
  },
  "output": { "user": { "age": 12, "name": "Bob" } },
  "port": "false"
}
```

| 필드 | 설명 |
| --- | --- |
| `config.conditions` | 평가에 사용된 조건 목록 (표현식이 해석된 값) |
| `config.combineMode` | 결합 방식 |
| `output` | input과 동일 (pass-through) |
| `port` | `'true'` 또는 `'false'` |

`meta` / `status` 는 사용하지 않습니다.

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Age Check`라고 가정:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Age Check"].output }}` | `{ user: { age: 25, ... } }` | 입력 그대로 (pass-through) |
| `{{ $node["Age Check"].output.user.age }}` | `25` | input 객체의 임의 필드 |
| `{{ $node["Age Check"].port }}` | `"true"` | 어느 분기로 흘렀는지 확인 |
| `{{ $node["Age Check"].config.conditions }}` | `[{...}]` | 평가에 사용된 조건 정의 |
| `{{ $node["Age Check"].config.combineMode }}` | `"and"` | 결합 방식 |

## 주의사항

- `conditions` 배열이 비어있으면 validation 실패. 최소 1개 조건 필수.
- `is_type` / `regex` 는 schema enum에는 포함되지만 if_else 핸들러의 `switch` 분기에 없어 `false` fall-through 됩니다. 실제 동작이 필요하면 Filter 노드를 사용하세요.
- `gt` / `gte` / `lt` / `lte` 는 항상 `Number()` 강제 변환합니다. 문자열 `"10"` 도 10으로 비교됩니다.
- `eq` / `neq` 는 if_else 핸들러에서 항상 `===` / `!==` 로 처리됩니다 (`strictComparison` 값과 무관).
- `not_contains` 의 동작은 Filter와 다릅니다. if_else에서는 두 값 모두 문자열일 때만 평가하고, 아니면 `true` fall-through — Filter의 `_shared/condition-eval.util.ts` 구현(`false` fall-through)과 대칭되지 않으니 주의.
- 데이터는 변형 없이 그대로 흘러가므로, 분기 후에도 input을 그대로 사용 가능합니다.
