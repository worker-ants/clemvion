# Split (`split`)

> 배열을 `{ index, value }` 객체 배열로 변환합니다. 각 항목의 인덱스를 명시적으로 부여한 형태로 노출하고 싶을 때 사용.

- **카테고리**: `logic`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `fieldPath` | string (expression) | yes | `''` | 분리할 배열 경로 (dot-path 또는 inline 표현식) | yes |

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | 배열을 포함한 객체 |
| Output | `out` | Output | `{index, value}[]` 변환 결과 |

## Input

`fieldPath`로 추출한 값:

- 배열이면 → 각 항목을 `{ index: <0-based>, value: <원소> }`로 매핑
- 배열이 아니면 → 빈 배열 `[]` 반환 (에러 없음)

## Output

### Case 1: 정상 변환

input:
```json
{ "items": ["apple", "banana", "cherry"] }
```
config: `{ "fieldPath": "items" }`

output:
```json
{
  "config": { "fieldPath": "items" },
  "output": [
    { "index": 0, "value": "apple" },
    { "index": 1, "value": "banana" },
    { "index": 2, "value": "cherry" }
  ]
}
```

### Case 2: 배열이 아닌 경우

```json
{
  "config": { "fieldPath": "items" },
  "output": []
}
```

| 필드 | 설명 |
| --- | --- |
| `config.fieldPath` | 사용된 fieldPath |
| `output` | `{index, value}` 객체 배열 (배열이 아니면 빈 배열) |

`meta` / `port` / `status` 사용 안 함.

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Index Items`라고 가정:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Index Items"].output }}` | `[{index:0,value:...}, ...]` | 변환된 배열 전체 |
| `{{ $node["Index Items"].output[0].value }}` | `"apple"` | 첫 항목의 value |
| `{{ $node["Index Items"].output[0].index }}` | `0` | 첫 항목의 index |
| `{{ $node["Index Items"].output.length }}` | `3` | 항목 개수 |

## 주의사항

- `fieldPath` 누락 시 validation 실패.
- 배열이 아닌 값에 대해서는 에러를 던지지 않고 빈 배열로 처리.
- ForEach/Map과 달리 컨테이너가 아니므로 본문 서브그래프 없음 — 단순 변환 노드.
- 인덱스 정보가 필요한 후속 처리(예: Transform 노드에서 인덱스를 활용하는 변환)에 유용.
