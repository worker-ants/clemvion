# Variable Declaration (`variable_declaration`)

> 워크플로우 변수(`$var.*`)를 선언하고 초기값을 설정합니다. 이미 선언된 변수는 덮어쓰지 않습니다.

- **카테고리**: `logic`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `variables` | `VariableDefinition[]` | yes (1개 이상) | `[]` | 선언할 변수 목록 | `defaultValue` 내부 |

`VariableDefinition`:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `name` | string | 변수 이름 (`$var.<name>`로 접근) |
| `type` | `'string' \| 'number' \| 'boolean' \| 'array' \| 'object'` | 강제 변환 대상 타입 |
| `defaultValue` | unknown | 초기값 (표현식 가능). 미지정/null이면 `null`로 시작 |

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | 입력 (그대로 통과) |
| Output | `out` | Output | input 그대로 |

## Input

input은 변형하지 않고 그대로 output으로 통과시킵니다.

## Output

### Case 1: 변수 선언

input: `{ userId: "u_1" }`
config:
```json
{
  "variables": [
    { "name": "counter", "type": "number", "defaultValue": 0 },
    { "name": "items", "type": "array", "defaultValue": [] }
  ]
}
```

```json
{
  "config": {
    "variables": [
      { "name": "counter", "type": "number", "defaultValue": 0 },
      { "name": "items", "type": "array", "defaultValue": [] }
    ]
  },
  "output": { "userId": "u_1" }
}
```

선언 후 `context.variables` (= `$var`)는 다음과 같이 갱신됩니다:

```json
{
  "counter": 0,
  "items": []
}
```

| 필드 | 설명 |
| --- | --- |
| `config.variables` | 선언된 변수 정의 목록 |
| `output` | input 그대로 (pass-through) |

`meta` / `port` / `status` 사용 안 함.

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Init State`라고 가정.

**다른 노드에서 — `$var` 참조** (이 노드의 선언 결과):

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $var.counter }}` | `0` | 선언된 변수에 직접 접근 |
| `{{ $var.items }}` | `[]` | 배열 변수 |

**이 노드 자체의 출력**:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Init State"].output }}` | `{ userId: "u_1" }` | input pass-through |
| `{{ $node["Init State"].config.variables }}` | `[{ name: "counter", ... }]` | 선언된 변수 정의 |

## 주의사항

- **이미 같은 이름의 변수가 선언되어 있으면 덮어쓰지 않습니다** (`if (context.variables[variable.name] === undefined)`). 재초기화가 필요하면 Variable Modification 노드를 사용하세요.
- `defaultValue`는 `coerceToType()`을 통해 지정된 `type`으로 강제 변환됩니다 (예: `"5"` → number `5`, `"true"` → boolean `true`).
- `name` 또는 `type`이 누락되면 validation 실패. 빈 배열도 실패.
- 변수는 워크플로우 실행 전체에서 공유됩니다 (Loop, ForEach 내부에서도 같은 `$var` 인스턴스).
- `defaultValue`에 `{{ ... }}` 표현식을 쓰면 노드 실행 시점의 값으로 초기화됩니다.
