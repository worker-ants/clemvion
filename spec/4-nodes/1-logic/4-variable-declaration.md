# Spec: Variable Declaration

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [CONVENTIONS](../../conventions/node-output.md)

워크플로우 실행 컨텍스트(`context.variables`) 에 변수를 등록하는 **pass-through 노드**. 입력은 변형 없이 단일 출력 포트로 그대로 전달되며, 변수 등록은 `context.variables` 에 대한 side-effect 로 수행된다 (Logic 공통 §10 Pass-through 규약). 등록된 값은 후속 노드의 표현식에서 `{{ $var.<name> }}` 으로 참조한다.

**핵심 동작**: 이미 같은 이름의 변수가 존재하면 **덮어쓰지 않는다** (재초기화는 [Variable Modification](./5-variable-modification.md) 의 `set` 으로 수행).

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| variables | VarDef[] | ✓ | `[]` | 선언할 변수 목록 (1개 이상). 순서대로 등록. 같은 이름 변수가 이미 등록되어 있으면 skip |

**VarDef 구조** (`variables[i]`):

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| name | String | ✓ | `''` | 변수 이름. `$var.<name>` 으로 후속 노드 표현식에서 참조. 워크플로우 내 unique 권장 |
| type | `string` / `number` / `boolean` / `array` / `object` | ✓ | `'string'` | 초기값 타입. `coerceToType` 으로 `defaultValue` 를 강제 변환 |
| defaultValue | unknown | | (없음) | 초기값 (raw — `{{ }}` 표현식 가능). 미설정 / `null` / `undefined` → 항상 `null` 로 저장 |

**`coerceToType` 동작**:
- `defaultValue` 가 이미 `type` 과 일치 → 그대로 저장
- 문자열인데 `type='number'` → `Number()` 변환, 실패(`NaN`) 시 `null`
- 문자열인데 `type='boolean'` → `'true'` / `'false'` 매칭, 그 외 `null`
- 문자열인데 `type='array'` / `'object'` → `JSON.parse` 시도, 실패 시 `null`
- 변환 실패는 **silent** — 사용자 의도와 다른 저장이 일어나도 별도 에러 throw 하지 않음

> Source of truth: `backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts` (export `variableDeclarationNodeConfigSchema`, `varDefSchema`) / `backend/src/modules/execution-engine/utils/coerce-type.ts`

## 2. 설정 UI

```
┌──────────────────────────────────────┐
│  Variables                           │
│                                      │
│  ┌──────────────────────────────────┐│
│  │ Name:    counter                 ││
│  │ Type:    [number ▼]              ││
│  │ Default: 0                  [×]  ││
│  └──────────────────────────────────┘│
│  ┌──────────────────────────────────┐│
│  │ Name:    users                   ││
│  │ Type:    [array ▼]               ││
│  │ Default: []                 [×]  ││
│  └──────────────────────────────────┘│
│                                      │
│  [+ Add Variable]                    │
└──────────────────────────────────────┘
```

`Default` 입력은 expression 위젯이며 `{{ }}` 템플릿을 허용한다 (예: `{{ $today }}`). 평가는 핸들러 진입 직전에 expression resolver 가 수행한다.

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 메인 흐름 입력 (1개). 변형 없이 `out` 으로 pass-through |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `out` | Output | data | false | input pass-through. 변수 등록은 `context.variables` 에 side-effect 로 수행되므로 `output` 페이로드와 무관 |

> Variable Declaration 은 동적 포트가 없다 (단일 출력).

## 4. 실행 로직

1. `config.variables` 를 순회하며 각 `variable` 에 대해:
   - `context.variables[variable.name]` 이 `undefined` 인 경우에만 등록 (이미 존재하면 skip).
   - `defaultValue ?? null` 을 `coerceToType(raw, variable.type)` 으로 변환하여 저장.
2. `input` 은 변형 없이 그대로 `output` 에 복사 (Logic 공통 §10 Pass-through 규약).
3. `config` 는 [`context.rawConfig`](../../5-system/4-execution-engine.md) 의 `variables` 를 echo — `defaultValue` 의 `{{ }}` 템플릿이 보존된다 (CONVENTIONS Principle 7). 핸들러는 evaluated `config.variables` 로 동작하지만, 응답 `config.variables` 는 raw 형태로 유지.
4. 등록된 값은 후속 노드의 표현식에서 `{{ $var.<name> }}` 으로 참조 가능.

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> Variable Declaration 은 단일 출력 pass-through 노드이므로 §5.1 단일 케이스로 구성된다 (분기 / 에러 포트 없음 — config 검증 실패는 §6 pre-flight throw).

### 5.1 Case: 정상 (단일 출력 `out`)

```json
{
  "config": {
    "variables": [
      { "name": "counter", "type": "number", "defaultValue": 0 },
      { "name": "users", "type": "array", "defaultValue": "[]" },
      { "name": "today", "type": "string", "defaultValue": "{{ $today }}" }
    ]
  },
  "output": { "user": { "id": "u-1", "name": "Alice" } },
  "meta": {
    "durationMs": 0,
    "declared": ["counter", "users", "today"],
    "skipped": [],
    "coercionWarnings": []
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.variables` | VarDef[] | config echo (Principle 7) | 사용자가 입력한 raw 변수 정의 — `defaultValue` 의 `{{ }}` 템플릿 보존. evaluated 값은 `context.variables` 에만 저장되며 `output` 에 echo 되지 않는다 (Principle 1.1) |
| `output` | (input 전체) | runtime — pass-through | input 데이터 그대로 (변형 없음). Principle 1.1.4 — `output.view` / `output.type` 등 판별자 사용 금지 |
| `meta.durationMs` | number | engine inject | 실행 시간 (ms). 엔진이 모든 노드에 공통 주입 |
| `meta.declared` | string[] | runtime metric (Principle 2) | 이번 실행에서 신규 등록된 변수 이름들 (skip 되지 않은 항목). skip-if-exists 동작 가시화 |
| `meta.skipped` | string[] | runtime metric (Principle 2) | 이미 같은 이름의 변수가 존재하여 등록이 skip 된 변수 이름들. 사용자 의도한 초기화가 silent 로 누락된 경우 진단 |
| `meta.coercionWarnings` | `Array<{ name: string, attemptedType: string, error?: string }>` | runtime metric (Principle 2) | `coerceToType` 이 silent `null` fallback 한 항목들 (예: `type='number'` + `defaultValue='abc'`). 명시적 `defaultValue` 미설정으로 `null` 저장된 경우는 포함되지 않는다 (의도된 null-init) |
| `port` | `undefined` | — | 단일 출력이므로 미설정 (Principle 5: `port: undefined` = 기본 단일 출력) |

**Expression 접근 예**:
- `$node["X"].output.user.name` → `"Alice"` (pass-through)
- `$node["X"].config.variables[0].name` → `"counter"` (raw echo)
- `$node["X"].config.variables[2].defaultValue` → `"{{ $today }}"` (raw template, Principle 7)
- `$node["X"].meta.declared` → `["counter","users","today"]` (이번 실행에 등록된 변수)
- `$node["X"].meta.coercionWarnings[0].name` → coerce 실패한 첫 변수 이름
- `$var.counter` → `0` (등록된 변수 값)
- `$var.users` → `[]` (JSON 문자열이 array 로 coerce 됨)
- `$var.today` → `"2026-05-10"` (expression resolver 가 evaluate 한 값)

## 6. 에러 코드

Variable Declaration 은 **runtime 에러 포트를 갖지 않는다**. 모든 검증 실패는 pre-flight (config 검증) 단계에서 throw 된다 (CONVENTIONS Principle 3.1):

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `variables` 가 빈 배열 | `최소 1개 이상의 변수를 정의해야 합니다.` | warningRule (캔버스 배지) + handler.validate (`evaluateMetadataBlockingErrors`) |
| `variables[0].name` 이 빈 문자열 | `첫 번째 변수의 이름을 입력해야 합니다.` | warningRule (캔버스 배지) |
| `variables` 가 array 아님 (raw fixture / zod 우회) | `variables must be an array` | handler.validate |
| `variables[i].name` 미설정 / 비-string | `variables[i].name is required and must be a string` | `validateVariableDeclarationConfig` |
| `variables[i].type` 미설정 / 비-string | `variables[i].type is required and must be a string` | `validateVariableDeclarationConfig` |
| `variables[i].type` 가 enum 외 (`string`/`number`/`boolean`/`array`/`object` 외) | zod schema error (`varDefSchema.type`) | schema parse |

> ⚠ **silent fallback** (런타임 throw 아님): `defaultValue` 가 `type` 으로 coerce 실패하면 `null` 이 저장된다 (예: `type='number'` + `defaultValue='abc'`). 별도 throw 는 없지만 §5.1 `meta.coercionWarnings` 에 항목이 추가되어 가시화된다.
>
> ⚠ **silent skip**: 같은 이름 변수가 이미 등록되어 있으면 신규 `defaultValue` 가 무시된다 (덮어쓰기 금지). skip 된 항목은 §5.1 `meta.skipped` 에서 관찰 가능하며, 재초기화가 필요하면 [Variable Modification](./5-variable-modification.md) 의 `set` 작업을 사용한다.

## 7. 캔버스 요약

[공통 §8](./0-common.md#8-캔버스-요약) — `Variable Declaration` 행 인용. 형식: 선언된 변수명 쉼표 구분 (최대 3개, 초과 시 `+N`), 예: `counter, total, +1`.
