# Variable Modification (`variable_modification`) — UI 라벨 "Set Variable"

> 워크플로우 변수(`$var.*`)의 값을 변경합니다. set, increment, push, append 등 다양한 연산을 지원합니다.

- **카테고리**: `logic`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `modifications` | `Modification[]` | yes (1개 이상) | `[]` | 적용할 변경 작업 목록 | `value` 내부 |

`Modification`:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `variable` | string | 변경 대상 변수명 (`$var.<name>`) |
| `operation` | enum | 연산 종류 (아래 표) |
| `value` | unknown | 연산에 사용할 값 (표현식 가능) |

지원 operation:

| operation | 동작 |
| --- | --- |
| `set` | 변수 값을 `value`로 직접 대체 |
| `increment` | `(현재 number 값 또는 0) + Number(value ?? 1)` |
| `decrement` | `(현재 number 값 또는 0) - Number(value ?? 1)` |
| `append` | 문자열 누적: `(현재 string 또는 "") + (value 문자열 또는 JSON.stringify(value))` |
| `push` | 배열에 `value` 추가. 배열이 아니면 `[value]`로 새로 생성 |
| `pop` | 배열의 마지막 항목 제거 |
| `set_field`, `delete_field` | (스키마에는 정의되어 있으나 핸들러는 미구현 — 사용 비권장) |

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | 입력 (그대로 통과) |
| Output | `out` | Output | input 그대로 |

## Input

input은 변형하지 않고 그대로 통과시킵니다. 모든 변경은 `context.variables` (= `$var`)에 발생.

## Output

### Case 1: 여러 변수 갱신

input: `{ orderId: "o_1" }`
config:
```json
{
  "modifications": [
    { "variable": "counter", "operation": "increment", "value": 1 },
    { "variable": "items", "operation": "push", "value": "{{ $input.orderId }}" }
  ]
}
```

```json
{
  "config": {
    "modifications": [
      { "variable": "counter", "operation": "increment", "value": 1 },
      { "variable": "items", "operation": "push", "value": "o_1" }
    ]
  },
  "output": { "orderId": "o_1" }
}
```

(이 노드 실행 후 `$var.counter`는 +1, `$var.items`에는 `"o_1"` 추가)

| 필드 | 설명 |
| --- | --- |
| `config.modifications` | 적용된 변경 작업 (resolved 값 포함) |
| `output` | input 그대로 |

`meta` / `port` / `status` 사용 안 함.

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Update Counter`라고 가정.

**다른 노드에서**:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $var.counter }}` | `5` | 변경된 변수 값 (다른 노드에서 직접 참조) |
| `{{ $var.items }}` | `["o_1", "o_2"]` | push로 누적된 배열 |
| `{{ $node["Update Counter"].output }}` | `{ orderId: "o_1" }` | input pass-through |
| `{{ $node["Update Counter"].config.modifications }}` | `[{...}]` | 적용된 변경 정의 |

## 주의사항

- 변경 대상 변수는 **사전에 Variable Declaration으로 선언**되어 있어야 합니다 (선언되지 않은 변수에 대한 동작은 정의되지 않음).
- `increment`/`decrement`에서 현재값이 number가 아니면 `0`부터 시작합니다.
- `append`에서 현재값이 string이 아니면 빈 문자열에서 시작합니다. value가 string이 아니면 `JSON.stringify`로 변환합니다.
- `push`에서 현재값이 배열이 아니면 새 배열 `[value]`로 대체됩니다.
- `pop`은 배열이 아닐 때 무시됩니다 (no-op).
- `set_field`, `delete_field`는 schema에는 있지만 핸들러에 구현되지 않았습니다. 객체 필드 조작이 필요하면 `set` 연산으로 객체 전체를 교체하세요.
- 변경은 즉시 `$var`에 반영되며, 후속 노드에서 바로 참조 가능합니다.
