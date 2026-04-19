# Variable Modification (`variable_modification`) — UI 라벨 "Set Variable"

> 워크플로우 변수 저장소(`$var.*`)의 값을 변경합니다. `set` / `increment` / `decrement` / `append` / `push` / `pop` 을 지원하며, 여러 개의 변경을 순서대로 적용합니다.

- **카테고리**: `logic`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no
- **type(internal)**: `variable_modification` (라벨은 `Set Variable`)

## Config 파라메터

출처: `backend/src/nodes/logic/variable-modification/variable-modification.schema.ts`

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `modifications` | `Modification[]` | yes (1개 이상) | `[]` | 순서대로 적용할 변경 작업 배열 | 각 항목 `value`에서 가능 |

`Modification` 항목:

| 필드 | 타입 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| `variable` | string | yes | `''` | 대상 변수 이름 (`$var.<variable>`) |
| `operation` | enum (아래) | yes | `'set'` | 적용할 연산 |
| `value` | unknown (expression) | no | (없음) | 연산에 사용할 값 |

### 지원 operation (핸들러 코드 기준)

출처: `backend/src/nodes/logic/variable-modification/variable-modification.handler.ts`. 핸들러의 `VALID_OPERATIONS` 는 다음 **6개** 입니다. (schema 의 `modOperationSchema`에는 `set_field` / `delete_field` 도 enum에 포함되지만 **핸들러에는 구현되지 않아** 적용 시 무시되며 validate에서도 reject 됩니다.)

| operation | 동작 |
| --- | --- |
| `set` | `variables[variable] = value` (null/undefined도 그대로 저장) |
| `increment` | `(현재 값이 number면 그 값, 아니면 0) + Number(value ?? 1)` — 변수가 없어도 생성 |
| `decrement` | `(현재 값이 number면 그 값, 아니면 0) - Number(value ?? 1)` — 변수가 없어도 생성 |
| `append` | 문자열 덧붙이기. 현재 값이 string이 아니면 `''` 기준. `value`가 string이면 그대로, null/undefined면 `''`, 그 외 객체는 `JSON.stringify(value)` |
| `push` | 현재 값이 배열이면 `push(value)` (**in-place 변경**). 아니면 `[value]` 로 새 배열 생성 |
| `pop` | 현재 값이 배열이면 `pop()` (in-place), 아니면 무시 |

## Ports

출처: `backend/src/nodes/logic/variable-modification/variable-modification.schema.ts`

| 방향 | id | label | type | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | data | pass-through 대상 |
| Output | `out` | Output | data | input을 그대로 전달 |

## Input

이전 노드의 output을 그대로 받아 `output` 에 넣습니다. 실제 효과는 `context.variables` 에 대한 side-effect.

## Output

### 일반 케이스

```json
{
  "config": {
    "modifications": [
      { "variable": "counter", "operation": "increment", "value": 1 },
      { "variable": "log",     "operation": "append",    "value": " done" },
      { "variable": "items",   "operation": "push",      "value": { "id": 42 } }
    ]
  },
  "output": { "previous": "node output here" }
}
```

| 필드 | 설명 |
| --- | --- |
| `config.modifications` | 적용된 변경 정의 배열 |
| `output` | input 그대로 (pass-through) |

`meta` / `port` / `status` 는 사용하지 않습니다.

### 실행 부수 효과

```ts
for (const mod of modifications) {
  applyModification(context, mod);
}
```

변경은 **배열 순서대로** 적용됩니다. 같은 변수를 여러 번 다루면 뒤의 연산이 앞의 결과를 기반으로 동작.

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Update Counter`라고 가정:

**이 노드의 output 자체**:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Update Counter"].output }}` | `{...input...}` | pass-through |
| `{{ $node["Update Counter"].config.modifications }}` | `[{ variable, operation, value }, ...]` | 적용된 변경 목록 |

**변경된 값은 전역 `$var.*` 에서**:

| 표현식 | 설명 |
| --- | --- |
| `{{ $var.counter }}` | 변경된 counter |
| `{{ $var.items }}` | push / pop 결과 배열 |
| `{{ $var.log }}` | append 결과 문자열 |

## 주의사항

- 핸들러는 **`set`, `increment`, `decrement`, `append`, `push`, `pop`** 만 실제로 처리합니다. schema enum 에 있는 `set_field` / `delete_field` 는 validate에서 거부됩니다 (에러 메시지에 `operation must be one of: set, increment, decrement, append, push, pop`).
- `increment` / `decrement` 의 `value` 생략 시 기본 `+1` / `-1`.
- 현재 값이 숫자가 아닌데 `increment` / `decrement` 하면 0 부터 다시 계산 (기존 값 무시).
- `append` 시 현재 값이 문자열이 아니면 `''`로 시작합니다 (기존 비문자열 값은 버려짐).
- `push` 시 변수가 없거나 배열이 아니면 `[value]`로 새 배열을 만들어 대입합니다 (기존 비배열 값 덮어씀).
- `push` / `pop` 은 현재 배열을 **in-place mutation** 합니다. 동일 배열 참조를 다른 변수나 노드 output에서도 보는 경우 주의.
- `set` 은 `null` / `undefined` 도 그대로 저장합니다 (덮어쓰기 허용).
- 변수 범위는 `variable_declaration`과 동일하게 워크플로우 실행 전역입니다 (Parallel 분기는 shallow clone).
- `variable_modification` 은 **선언되지 않은 변수도 자유롭게 만들 수 있습니다.** 필요하다면 Declaration 없이 바로 `set` 해도 동작합니다.
