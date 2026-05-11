# Merge (`merge`)

> 여러 갈래에서 들어온 데이터를 하나로 합칩니다. 합치는 전략(`strategy`)과 출력 형식(`outputFormat`)을 조합해서 선택합니다.

- **카테고리**: `logic`
- **컨테이너**: no
- **Blocking**: no (Phase P2 barrier 도입 전까지는 순차 엔진에서 predecessor가 모두 완료된 뒤 실행)
- **동적 포트**: no

## Config 파라메터

출처: `backend/src/nodes/logic/merge/merge.schema.ts`

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `strategy` | `'wait_all' \| 'first' \| 'append'` | yes | `'wait_all'` | 결합 전략 — 아래 표 참고 | no |
| `outputFormat` | `'array' \| 'merge_object' \| 'indexed'` | yes | `'array'` | 결과 형식 — 아래 표 참고 | no |
| `timeout` | number (초) | no | `300` | **Phase P1에서는 dormant.** Phase P2 barrier 도입 후에만 실제 타임아웃으로 동작. `0` = 무제한 | no |
| `partialOnTimeout` | boolean | no | `false` | **Phase P1에서는 dormant.** Phase P2에서 timeout 시 도착한 것만 merge | no |

### `strategy`

| 값 | 동작 |
| --- | --- |
| `wait_all` | 들어온 모든 값을 그대로 사용 |
| `first` | **정렬된 첫 항목만** 사용 (`formatOutput([inputs[0]], ...)`) — 객체 input인 경우 sort된 key 순으로 첫 값 |
| `append` | `wait_all`과 동일 (순서대로 나열) |

### `outputFormat`

| 값 | 결과 |
| --- | --- |
| `array` | 정규화된 배열 그대로 |
| `merge_object` | 모든 객체 input을 `Object.create(null)` 위에 얕은 merge. 후순위 값이 이전 값을 덮어씀. `__proto__` / `constructor` / `prototype` 키는 블록 (prototype pollution 방지) |
| `indexed` | `{ in_0, in_1, ... }` 형태의 객체 |

## Ports

출처: `backend/src/nodes/logic/merge/merge.schema.ts`

| 방향 | id | label | type | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | data | 여러 갈래로부터 모여든 값 |
| Output | `out` | Output | data | 합쳐진 결과 |

## Input

엔진은 여러 갈래의 결과를 하나의 input으로 밀어넣습니다. 핸들러의 `normalizeInputs`가 다음처럼 정규화:

| 들어온 형태 | 정규화 결과 |
| --- | --- |
| 배열 | 그대로 |
| 객체 | `Object.keys(input).sort()` 순으로 값 배열 (노드 ID 기준 결정적 순서) |
| 그 외 (null 포함) | `[input]` 단일 원소 배열 |

## Output

### Case 1: `strategy=wait_all`, `outputFormat=array`

```json
{
  "config": { "strategy": "wait_all", "outputFormat": "array" },
  "output": [{ "a": 1 }, { "b": 2 }, { "c": 3 }]
}
```

### Case 2: `outputFormat=merge_object`

```json
{
  "config": { "strategy": "wait_all", "outputFormat": "merge_object" },
  "output": { "a": 1, "b": 3, "c": 4 }
}
```

(이전 값이 뒤에 있는 같은 키로 덮어써짐)

### Case 3: `outputFormat=indexed`

```json
{
  "config": { "strategy": "wait_all", "outputFormat": "indexed" },
  "output": { "in_0": "first", "in_1": "second" }
}
```

### Case 4: `strategy=first`

```json
{
  "config": { "strategy": "first", "outputFormat": "array" },
  "output": ["first"]
}
```

| 필드 | 설명 |
| --- | --- |
| `config.strategy` | 선택된 전략 |
| `config.outputFormat` | 선택된 형식 |
| `output` | 위 Case별 결과 |

`meta` / `port` / `status` 는 사용하지 않습니다. `timeout` / `partialOnTimeout` 은 결과 `config`에 포함되지 않습니다 (해당 필드는 Phase P2 대비).

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Combine Results`라고 가정:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Combine Results"].output }}` | `[v0, v1]` 또는 `{ a: 1, b: 3 }` 등 | 합쳐진 값 (config에 따라 형태 다름) |
| `{{ $node["Combine Results"].output[0] }}` | `v0` | array 형식일 때 첫 항목 |
| `{{ $node["Combine Results"].output.a }}` | `1` | merge_object 형식일 때 키 접근 |
| `{{ $node["Combine Results"].output.in_0 }}` | `v0` | indexed 형식일 때 |
| `{{ $node["Combine Results"].config.strategy }}` | `"wait_all"` | 사용된 전략 |
| `{{ $node["Combine Results"].config.outputFormat }}` | `"array"` | 사용된 형식 |

## 주의사항

- `strategy: 'first'` 는 "가장 먼저 도착한" 이 아니라 **정렬된 키의 첫 값** 입니다 (Phase P1 순차 엔진 기준). 실제 fan-in 경합은 Phase P2 이후.
- `timeout` / `partialOnTimeout` 은 config 수용만 하고 실제 동작은 아직 없습니다 (로거 warning 발생).
- `merge_object` 는 **얕은 merge** 이며 prototype pollution 방지를 위해 `__proto__` / `constructor` / `prototype` 키는 무시합니다.
- `null` / `undefined` / 스칼라 input은 단일 원소 배열로 감싼 뒤 포맷팅됩니다.
- 빈 객체 input은 `[]` (길이 0 배열)로 정규화됩니다.
