# Variable Declaration (`variable_declaration`)

> 워크플로우 변수 저장소(`$var.*`)에 변수를 선언하고 초기값을 설정합니다. **이미 선언된 변수는 덮어쓰지 않습니다** (최초 1회만 초기화).

- **카테고리**: `logic`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no
- **type(internal)**: `variable_declaration` (라벨은 `Variable`)

## Config 파라메터

출처: `backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts`

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `variables` | `VarDef[]` | yes (1개 이상) | `[]` | 선언할 변수들의 배열 | 각 항목 `defaultValue`에서 가능 |

`VarDef` 항목:

| 필드 | 타입 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| `name` | string | yes | `''` | 변수 이름 (`$var.<name>` 로 접근) |
| `type` | `'string' \| 'number' \| 'boolean' \| 'array' \| 'object'` | yes | `'string'` | 타입. `coerceToType` 으로 초기값을 변환 |
| `defaultValue` | unknown (expression) | no | (없음) | 초기값. 생략/`null`/`undefined`이면 최종적으로 `null`로 저장됨 |

### 타입 강제 변환 규칙 (`coerceToType`)

출처: `backend/src/modules/execution-engine/utils/coerce-type.ts`

| type | 변환 |
| --- | --- |
| `number` | 이미 number면 그대로, 아니면 `Number(value)` — `NaN`이면 `null` |
| `boolean` | 이미 boolean이면 그대로, `'true'` → `true`, `'false'` → `false`, 그 외엔 `Boolean(value)` (진리값 변환) |
| `array` | 이미 배열이면 그대로. 문자열이 `[`로 시작하면 `JSON.parse` 시도 |
| `object` | 이미 object(non-array)면 그대로. 문자열이 `{`로 시작하면 `JSON.parse` 시도 |
| `string` | string이면 그대로, number/boolean이면 `.toString()`, 기타 객체는 `JSON.stringify` |
| (value가 `null` / `undefined`인 경우) | **항상 `null`** 반환 |

## Ports

출처: `backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts`

| 방향 | id | label | type | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | data | pass-through 대상 |
| Output | `out` | Output | data | input을 그대로 전달 |

## Input

이전 노드의 output을 그대로 받아 `output` 으로 다시 내보냅니다. 실제 효과는 **`context.variables`** 에 변수를 쓰는 side-effect 입니다.

## Output

### 일반 케이스

```json
{
  "config": {
    "variables": [
      { "name": "counter", "type": "number", "defaultValue": 0 },
      { "name": "users", "type": "array", "defaultValue": "[]" }
    ]
  },
  "output": { "previous": "node output here" }
}
```

| 필드 | 설명 |
| --- | --- |
| `config.variables` | 선언된 변수 정의 배열 |
| `output` | input 그대로 (pass-through) |

`meta` / `port` / `status` 는 사용하지 않습니다.

### 실행 부수 효과

`context.variables[name]`이 **아직 undefined인 경우에만** `coerceToType(defaultValue ?? null, type)` 의 결과를 대입합니다. 즉 `$var.<name>` 이 이미 설정되어 있으면 건너뜁니다.

```ts
for (const variable of variables) {
  if (context.variables[variable.name] === undefined) {
    const raw = variable.defaultValue ?? null;
    context.variables[variable.name] = coerceToType(raw, variable.type);
  }
}
```

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Declare Vars`라고 가정:

**이 노드의 output 자체**:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Declare Vars"].output }}` | `{...input...}` | input pass-through |
| `{{ $node["Declare Vars"].config.variables }}` | `[{ name, type, defaultValue }, ...]` | 선언 정의 |

**선언된 변수는 전역 `$var.*` 로 접근**:

| 표현식 | 설명 |
| --- | --- |
| `{{ $var.counter }}` | 선언한 `counter` 변수 |
| `{{ $var.users }}` | 선언한 `users` 배열 |
| `{{ $var.users[0].name }}` | 객체·배열 필드 접근 |

## 주의사항

- **이미 존재하는 변수는 덮어쓰지 않습니다.** 다시 초기화하려면 `variable_modification` 노드의 `set` operation을 쓰세요.
- `defaultValue`가 `null` / `undefined` / 생략 → `coerceToType`이 `null`을 반환하므로 **항상 `null`로 저장**됩니다. 타입별 "기본 0/false/[]/{}" 같은 기본값은 자동으로 안 만들어집니다.
- `number` 타입에 문자열이지만 숫자로 변환 불가한 값(`'abc'`)이 들어오면 `null` 저장.
- `array` / `object` 타입에 문자열이 들어오고 JSON으로 파싱되면 파싱 결과 사용, 그렇지 않으면 **원본 값이 그대로 저장됩니다** (타입이 안 맞을 수 있음).
- 변수 범위는 **워크플로우 실행 전체(executionId 기준)** 이며, 서브그래프/컨테이너 내부에서도 동일 저장소를 공유합니다 (Parallel 분기는 예외로 shallow clone).
- 같은 이름을 여러 Variable Declaration 노드에서 선언해도 첫 번째만 적용되고 이후는 무시됩니다.
