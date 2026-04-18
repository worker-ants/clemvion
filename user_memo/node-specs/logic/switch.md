# Switch (`switch`)

> 단일 값을 여러 case와 비교하여 일치하는 case의 포트로 분기합니다. 데이터 자체는 변형하지 않고 통과시킵니다.

- **카테고리**: `logic`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: yes (`switch-cases`) — `config.cases[].id`마다 포트 생성 + 정적 `default` 포트

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `mode` | `'value' \| 'expression'` | no | `'value'` | 비교 방식 (현재 핸들러는 `value` 모드만 사용) | no |
| `switchValue` | string (expression) | yes | `''` | 비교할 값. dot-path 또는 `{{ ... }}` 표현식 | yes |
| `cases` | `Case[]` | yes (1개 이상) | `[]` | 비교할 case 목록. 각 항목: `{ id, label?, value, valueType? }` | `value` 내부 |
| `hasDefault` | boolean | no | `false` | `false`로 명시하면 매칭 실패 시 에러를 던지고, 기본값 또는 `true`이면 `default` 포트로 라우팅 |
| `strictComparison` | boolean | no | `false` | (현 핸들러 미반영) 타입 강제 변환 없이 비교 |

`Case` 항목:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | string | 출력 포트 ID (workflow 내에서 케이스 식별, 중복 불가) |
| `label` | string | UI에 표시할 케이스 이름 |
| `value` | unknown | 비교할 값 |
| `valueType` | `'string' \| 'number' \| 'boolean'` | 비교 시 case 값 강제 변환 타입 |

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | 평가 대상 데이터 |
| Output | `<case.id>` | `<case.label>` | 동적 — 매칭된 case로 라우팅 |
| Output | `default` | Default | 매칭 실패 + `hasDefault !== false` 일 때 라우팅 |

> **동적 포트 생성 규칙** (`resolve-dynamic-ports.ts`):
> `cases.filter(id 있음).map({ id: c.id, label: c.label || "Case", type: "data" })` + `{ id: "default", ... }`

## Input

핸들러는 `switchValue`를 **input 객체에 대한 dot-path** 로 해석합니다. 예: `switchValue: "user.tier"` → `input.user.tier` 값을 추출.

`switchValue`가 비-문자열이라면 그 값 자체를 비교 대상으로 사용합니다 (드물게 사용).

## Output

### Case 1: 일치하는 case로 라우팅

```json
{
  "config": {
    "switchValue": "user.tier",
    "cases": [
      { "id": "premium", "label": "Premium", "value": "premium" },
      { "id": "basic", "label": "Basic", "value": "basic" }
    ]
  },
  "output": { "user": { "tier": "premium", "id": "u_1" } },
  "meta": {
    "expression": "user.tier",
    "value": "premium",
    "matchedCase": "premium"
  },
  "port": "premium"
}
```

### Case 2: 매칭 실패 → `default` 포트

```json
{
  "config": { "switchValue": "user.tier", "cases": [...] },
  "output": { "user": { "tier": "vip" } },
  "meta": {
    "expression": "user.tier",
    "value": "vip",
    "matchedCase": "default"
  },
  "port": "default"
}
```

### Case 3: 매칭 실패 + `hasDefault: false`

핸들러가 에러 throw → 노드 실행 실패 (`No matching case found and no default case configured`).

| 필드 | 설명 |
| --- | --- |
| `config.switchValue` | 평가에 사용된 expression 또는 값 |
| `config.cases` | case 정의 배열 |
| `output` | input 그대로 (pass-through) |
| `meta.expression` | dot-path로 사용된 switchValue 문자열 |
| `meta.value` | 추출된 실제 비교 대상 값 |
| `meta.matchedCase` | 매칭된 case의 id (또는 `'default'`) |
| `port` | 매칭된 case id 또는 `'default'` |

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Tier Router`라고 가정:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Tier Router"].output }}` | `{ user: { tier: "premium" } }` | input pass-through |
| `{{ $node["Tier Router"].port }}` | `"premium"` | 어느 케이스로 분기되었는지 |
| `{{ $node["Tier Router"].meta.matchedCase }}` | `"premium"` | port와 동일 |
| `{{ $node["Tier Router"].meta.value }}` | `"premium"` | 실제로 비교에 사용된 값 |
| `{{ $node["Tier Router"].meta.expression }}` | `"user.tier"` | switchValue 표현식 |

## 주의사항

- `cases[].id`는 **중복 불가**, 비어 있을 수 없음. validation에서 거름.
- `cases[].valueType`을 지정하면 case의 `value`(문자열)를 자동으로 number/boolean으로 변환한 뒤 `===` 비교합니다. 미지정이거나 `'string'`이면 그대로 비교.
- `switchValue`가 dot-path가 아닌 `{{ ... }}` 표현식이면 expression resolver가 미리 평가한 결과 값이 들어옵니다.
- `hasDefault` 명시적으로 `false`인 경우에만 매칭 실패 시 에러를 던집니다. 기본값(`false`)이라도 핸들러는 `!== false` 체크라 default로 흘러갑니다 — 즉 schema default값과 handler 동작이 약간 모순됩니다. 기본 동작은 default 포트로 fall-through입니다.
