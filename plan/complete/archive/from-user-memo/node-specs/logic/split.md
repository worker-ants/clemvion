# Split (`split`)

> 배열의 각 항목에 명시적인 인덱스를 붙여 `{ index, value }[]` 로 변환합니다. 병렬 fan-out이나 인덱스 추적이 필요한 후속 처리에서 사용.

- **카테고리**: `logic`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

출처: `backend/src/nodes/logic/split/split.schema.ts`

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `fieldPath` | string \| unknown (expression) | yes | `''` | 배열 대상. 문자열이면 input에 대한 dot-path, 그 외 타입은 이미 해석된 값으로 간주 | yes (전체 `{{ ... }}`이면 배열 자체를 바로 받음) |

## Ports

출처: `backend/src/nodes/logic/split/split.schema.ts`

| 방향 | id | label | type | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | data | 배열을 포함하는 데이터 |
| Output | `out` | Output | data | 인덱스+값 쌍으로 변환된 배열 |

## Input

핸들러는 `resolveFieldValue(input, fieldPath)`로 배열을 해석합니다:
- `fieldPath`가 문자열이면 dot-path 탐색
- 이미 배열/값이 들어오면 그대로 사용
- 결과가 배열이 아니면 빈 배열로 fallback (**에러 아님**)

## Output

### Case 1: 배열이 정상 해석된 경우

```json
{
  "config": { "fieldPath": "items" },
  "output": [
    { "index": 0, "value": { "sku": "X1" } },
    { "index": 1, "value": { "sku": "X2" } }
  ]
}
```

### Case 2: 배열이 아닌 값 또는 경로 miss

```json
{
  "config": { "fieldPath": "items" },
  "output": []
}
```

| 필드 | 설명 |
| --- | --- |
| `config.fieldPath` | 원본 `fieldPath` (path 문자열 또는 해석된 배열) |
| `output[i].index` | 0-based 원본 인덱스 |
| `output[i].value` | 원본 배열의 항목 값 (객체든 스칼라든 그대로) |

`meta` / `port` / `status` 는 사용하지 않습니다 (단일 `out` 포트).

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Split Items`라고 가정:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Split Items"].output }}` | `[{ index: 0, value: {...} }, ...]` | 변환된 배열 전체 |
| `{{ $node["Split Items"].output.length }}` | `2` | 항목 수 |
| `{{ $node["Split Items"].output[0].index }}` | `0` | 첫 항목의 인덱스 |
| `{{ $node["Split Items"].output[0].value }}` | `{ sku: "X1" }` | 첫 항목의 원본 값 |
| `{{ $node["Split Items"].config.fieldPath }}` | `"items"` | 원본 경로 |

## 주의사항

- 경로가 배열이 아니면 **에러가 아니라 빈 배열** 을 반환합니다. 후속 노드에서 길이 검사 필요.
- 매 스칼라 값도 `{ index, value: '...' }` 로 감싸지므로 이후 사용할 때 `.value` 로 풀어주세요.
- Split 자체는 분기 포트를 만들지 않습니다. 실제 병렬 실행이 필요하면 Split 결과를 ForEach/Map에 연결하거나, `parallel` 노드를 써야 합니다.
- 빈 배열에 대해서도 정상 실행됩니다 (`output: []`).
