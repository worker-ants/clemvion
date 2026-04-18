# Merge (`merge`)

> 여러 입력(또는 배열/객체)을 하나의 결과로 합칩니다. 합쳐지는 형태(format)와 합치는 전략(strategy)을 선택할 수 있습니다.

- **카테고리**: `logic`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `strategy` | `'wait_all' \| 'first' \| 'append'` | yes | `'wait_all'` | 합치는 방식 (현 단계에서 `wait_all`/`append`는 동일 동작) | no |
| `outputFormat` | `'array' \| 'merge_object' \| 'indexed'` | yes | `'array'` | 출력 형태 | no |
| `timeout` | number (초) | no | `300` | (현재 dormant) 후속 Phase P2 fan-in barrier에서 사용 예정 | no |
| `partialOnTimeout` | boolean | no | `false` | (현재 dormant) timeout 도달 시 도착한 input만 합칠지 | no |

`strategy`:

| 값 | 동작 |
| --- | --- |
| `wait_all` | 모든 input 합침 (현재 sequential engine에서는 자동) |
| `first` | 첫 번째 input만 사용 |
| `append` | `wait_all`과 동일 (현재 단계) |

`outputFormat`:

| 값 | 결과 |
| --- | --- |
| `array` | input들을 배열 그대로 |
| `merge_object` | input 객체들을 얕은 병합 (뒤 키가 앞 키 덮어씀, prototype 보호) |
| `indexed` | `{ in_0: <첫 input>, in_1: <둘째>, ... }` |

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | 합칠 입력 (배열, 객체, 또는 단일값) |
| Output | `out` | Output | `outputFormat`에 따라 가공된 결과 |

## Input

핸들러는 input을 다음과 같이 정규화한 후 처리합니다.

- input이 배열 → 그대로 입력 목록으로 사용
- input이 객체 → 키를 정렬하여 그 값들을 배열로 사용
- 그 외 → `[input]` 단일 항목 배열

## Output

### Case 1: `outputFormat: "array"`, `strategy: "wait_all"`

input: `[{ a: 1 }, { b: 2 }]`

```json
{
  "config": { "strategy": "wait_all", "outputFormat": "array" },
  "output": [{ "a": 1 }, { "b": 2 }]
}
```

### Case 2: `outputFormat: "merge_object"`

input: `[{ a: 1 }, { b: 2 }]`

```json
{
  "config": { "strategy": "wait_all", "outputFormat": "merge_object" },
  "output": { "a": 1, "b": 2 }
}
```

### Case 3: `outputFormat: "indexed"`

input: `[{a:1}, {b:2}]`

```json
{
  "config": { "strategy": "wait_all", "outputFormat": "indexed" },
  "output": { "in_0": { "a": 1 }, "in_1": { "b": 2 } }
}
```

### Case 4: `strategy: "first"`

input: `[{a:1}, {b:2}]`

```json
{
  "config": { "strategy": "first", "outputFormat": "array" },
  "output": [{ "a": 1 }]
}
```

| 필드 | 설명 |
| --- | --- |
| `config.strategy`, `config.outputFormat` | 사용된 설정값 |
| `output` | `outputFormat`에 따라 다른 모양 |

`meta` / `port` / `status` 사용 안 함.

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Combine`이라고 가정:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Combine"].output }}` | (configFormat에 따라 다름) | 합쳐진 결과 |
| `{{ $node["Combine"].output.a }}` | `1` | merge_object 모드에서 특정 키 |
| `{{ $node["Combine"].output[0] }}` | `{a:1}` | array 모드에서 첫 항목 |
| `{{ $node["Combine"].output.in_0 }}` | `{a:1}` | indexed 모드에서 첫 항목 |
| `{{ $node["Combine"].config.outputFormat }}` | `"array"` | 사용된 형태 |

## 주의사항

- 현재(Phase P1) 엔진은 sequential 처리이므로 `timeout`, `partialOnTimeout`은 동작하지 않고 경고 로그만 남김. Phase P2에서 진정한 fan-in barrier가 적용될 예정.
- `merge_object` 모드는 키 충돌 시 뒤 input이 앞 input 덮어씀. `__proto__`, `constructor`, `prototype` 키는 prototype pollution 방지를 위해 무시됨.
- input이 단일 객체인 경우 키 알파벳순으로 정렬해서 값들을 추출 — 같은 객체에 여러 키가 있을 때 순서가 결정적임.
- `strategy: "first"` + `outputFormat: "array"`는 `[<첫 input>]` 형태(길이 1 배열)임을 주의.
