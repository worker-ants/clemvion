# If/Else (`if_else`)

> 조건을 평가하여 `true` 또는 `false` 포트로 흐름을 분기합니다. 데이터 자체는 변형하지 않고 input을 그대로 통과시킵니다.

- **카테고리**: `logic`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no (포트는 항상 `true` / `false` 두 개로 고정)

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `conditions` | `ConditionGroup[]` | yes (1개 이상) | `[]` | 평가할 조건 목록. 각 항목: `{ field, operator, value }` | `field`/`value` 내부에서 가능 |
| `combineMode` | `'and' \| 'or'` | no | `'and'` | 여러 조건의 결합 방식 | no |
| `strictComparison` | boolean | no | `false` | 타입 강제 변환 없이 엄격히 비교할지 여부 | no |

`ConditionGroup` 항목:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `field` | string (expression) | 평가 대상 값. dot-path(`"user.age"`) 또는 `{{ ... }}` 표현식 사용 |
| `operator` | enum | 비교 연산자 (아래 표 참고) |
| `value` | unknown (expression) | 비교 값. 표현식 평가 가능 |

지원 연산자:

| operator | 의미 |
| --- | --- |
| `eq` | 같음 (`===`) |
| `neq` | 다름 (`!==`) |
| `gt`, `gte`, `lt`, `lte` | 숫자 비교 (값을 `Number()` 강제 변환) |
| `contains`, `not_contains` | 문자열 포함 여부 |
| `starts_with`, `ends_with` | 접두/접미사 |
| `is_empty`, `is_not_empty` | 빈 값(`''`/`null`/`undefined`/빈 배열) 여부 |
| `is_null` | `null` 또는 `undefined` |
| `is_type`, `regex` | (스키마는 정의되어 있으나 핸들러는 `false` 반환 — 사용 비권장) |

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | 평가 대상 데이터 |
| Output | `true` | True | 조건이 만족되면 라우팅 |
| Output | `false` | False | 조건이 만족되지 않으면 라우팅 |

## Input

이전 노드로부터 받은 데이터를 그대로 사용합니다. `conditions[].field`의 dot-path가 input 객체에 적용됩니다 (예: `field: "user.age"` → `input.user.age`).

## Output

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
| `config.conditions` | 평가에 사용된 조건 목록 |
| `config.combineMode` | 결합 방식 |
| `output` | input과 동일 (pass-through) |
| `port` | `'true'` 또는 `'false'` |

`meta` / `status` 는 사용하지 않습니다.

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Age Check`라고 가정:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Age Check"].output }}` | `{ user: { age: 25, ... } }` | 입력 그대로 (pass-through) |
| `{{ $node["Age Check"].output.user.age }}` | `25` | 입력 객체의 임의 필드 |
| `{{ $node["Age Check"].port }}` | `"true"` | 어느 분기로 흘렀는지 후속 노드에서 체크 |
| `{{ $node["Age Check"].config.conditions }}` | `[{...}]` | 평가에 사용된 조건 정의 |

## 주의사항

- `conditions` 배열이 비어있으면 validation 실패. 최소 1개 조건 필수.
- `is_type`, `regex` 연산자는 schema에는 있으나 handler에서 `false`로 fall-through 됩니다. 사용하지 마세요.
- `gt`/`gte`/`lt`/`lte`는 항상 `Number()`로 강제 변환합니다. 문자열 `"10"`도 비교됩니다. 엄격 비교가 필요하면 `strictComparison`을 켜세요(현 핸들러는 미반영, 향후 확장 예정).
- 데이터는 변형하지 않고 그대로 흘러가므로, 분기 후에도 input 그대로 사용 가능합니다.
