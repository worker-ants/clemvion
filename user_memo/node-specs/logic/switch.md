# Switch (`switch`)

> 입력 값을 여러 케이스와 매칭시켜 각 케이스에 해당하는 동적 출력 포트로 분기합니다. 어느 케이스와도 일치하지 않으면 `default` 포트로 보냅니다.

- **카테고리**: `logic`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: **yes** (`kind: 'switch-cases'`)

## Config 파라메터

출처: `backend/src/nodes/logic/switch/switch.schema.ts`

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `mode` | `'value' \| 'expression'` | no | `'value'` | UI 모드 플래그. 엔진 동작에는 영향 없음 | no |
| `switchValue` | unknown (expression) | yes | `''` | 매칭할 대상. 문자열이면 input에 대한 dot-path로 평가, 그 외 타입은 값 그대로 사용 | yes (`{{ ... }}` 전체 표현식이면 타입 보존) |
| `cases` | `Case[]` | yes (1개 이상) | `[]` | 매칭 대상 케이스 배열 | 각 항목 `value`에서 가능 |
| `hasDefault` | boolean | no | `false` | `true` 또는 생략 시 fallthrough로 `default` 포트 사용. `false`면 매칭 실패를 에러로 처리 | no |
| `strictComparison` | boolean | no | `false` | 스키마상 정의 — switch 핸들러 본체에서는 사용되지 않음 (항상 `===`) | no |

`Case` 항목:

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `id` | string | yes | 이 케이스가 활성화될 때 라우팅되는 출력 포트 id. **유일해야 함** |
| `label` | string | no | UI 표시 라벨 |
| `value` | unknown | no | 매칭 값 |
| `valueType` | `'string' \| 'number' \| 'boolean'` | no | `value`(UI 입력은 보통 string)를 어느 타입으로 강제 변환할지. 생략 또는 `'string'` 이면 변환 없음. `'number'` 변환이 `NaN` 이거나 `'boolean'` 변환이 `'true'/'false'`가 아니면 원래 문자열을 유지 |

## Ports

출처: `backend/src/nodes/logic/switch/switch.schema.ts`, 동적 포트는 `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts`의 `switchPorts`

| 방향 | id | label | type | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | data | 매칭 대상 데이터 |
| Output (정적) | `default` | Default | data | 어떤 케이스와도 일치하지 않을 때 (또는 중간 경로가 null일 때) 활성화 |
| Output (동적) | `<cases[i].id>` | `cases[i].label \|\| 'Case'` | data | `cases` 배열의 각 항목마다 생성 |

평가 순서: `cases` 배열을 순회하며 **가장 먼저 매칭되는 항목**이 선택됩니다 (`Array.prototype.find`). 값 동일성은 `coerceCaseValue(c.value, c.valueType) === actualValue` 로 `===` 비교입니다.

## Input

이전 노드로부터 받은 데이터를 사용합니다. `switchValue`가 **문자열**이면 `getNestedValue(input, switchValue)`로 dot-path 탐색. 그 외 타입(number / boolean / null 등)은 이미 표현식 해석이 끝난 값으로 간주하고 그대로 비교합니다.

## Output

### Case 1: 케이스 매칭 성공

```json
{
  "config": {
    "switchValue": "user.role",
    "cases": [
      { "id": "admin", "label": "Admin", "value": "admin" },
      { "id": "guest", "label": "Guest", "value": "guest" }
    ]
  },
  "output": { "user": { "role": "admin" } },
  "meta": { "expression": "user.role", "value": "admin", "matchedCase": "admin" },
  "port": "admin"
}
```

### Case 2: 매칭 실패 → default

`hasDefault`가 `true`거나 생략된 경우:

```json
{
  "config": { "switchValue": "user.role", "cases": [/* ... */] },
  "output": { "user": { "role": "unknown" } },
  "meta": { "expression": "user.role", "value": "unknown", "matchedCase": "default" },
  "port": "default"
}
```

### Case 3: 매칭 실패 + `hasDefault: false`

핸들러가 에러를 던집니다: `"No matching case found and no default case configured"`.

| 필드 | 설명 |
| --- | --- |
| `config.switchValue` | 원본 `switchValue` (문자열 path 또는 해석된 값) |
| `config.cases` | 케이스 정의 배열 |
| `meta.expression` | `switchValue`가 문자열일 때만 해당 path, 아니면 `undefined` |
| `meta.value` | 실제 비교에 사용된 값 |
| `meta.matchedCase` | 매칭된 케이스 id (또는 `'default'`) |
| `port` | 매칭된 케이스 id 또는 `'default'` |

`status`는 사용하지 않습니다.

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Role Router`라고 가정:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Role Router"].output }}` | `{ user: { role: "admin" } }` | 입력 그대로 |
| `{{ $node["Role Router"].port }}` | `"admin"` | 활성화된 포트 id (= 매칭된 케이스 id) |
| `{{ $node["Role Router"].meta.value }}` | `"admin"` | 실제 비교에 사용된 값 |
| `{{ $node["Role Router"].meta.matchedCase }}` | `"admin"` 또는 `"default"` | 매칭 결과 |
| `{{ $node["Role Router"].meta.expression }}` | `"user.role"` / `undefined` | path 모드일 때만 채워짐 |
| `{{ $node["Role Router"].config.cases }}` | `[{...}]` | 케이스 정의 |

## 주의사항

- 케이스 배열이 비어있거나 `id`가 비어있거나 중복이면 validation 실패.
- UI로 입력된 case `value`는 기본적으로 문자열입니다. 숫자/불리언 비교가 필요하면 `valueType`을 지정하세요 (`'number'` 또는 `'boolean'`).
- `valueType: 'number'` 변환이 `NaN`, `valueType: 'boolean'` 변환이 `'true'/'false'`가 아닐 때는 변환이 실패하여 **원본 문자열과 비교**되므로 예기치 않게 매칭될 수 있습니다.
- `getNestedValue`는 prototype 키(`__proto__`, `constructor` 등)를 탐색하지 않습니다. `switchValue: '__proto__.constructor'` 같은 path는 항상 `undefined`로 해석됩니다.
- 같은 값을 가진 케이스가 여러 개면 **먼저 나온 케이스**가 매칭됩니다.
- `default` 포트는 정적이므로 `cases`에 `id: 'default'`를 쓰면 포트 id가 충돌합니다.
