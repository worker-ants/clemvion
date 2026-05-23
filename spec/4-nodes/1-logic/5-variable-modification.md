---
id: variable-modification
status: spec-only
code: []
---

# Spec: Variable Modification

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [CONVENTIONS](../../conventions/node-output.md)

워크플로우 변수 저장소 (`$var.*`) 의 값을 수정하는 **pass-through + side-effect 노드**. `modifications[]` 배열을 순서대로 적용한 뒤 입력은 변형 없이 단일 `out` 포트로 그대로 전달된다 (Logic 공통 §10 Pass-through 규약). UI 라벨은 "Set Variable".

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| modifications | ModDef[] | ✓ | `[]` | 적용할 변수 수정 목록. 순서대로 적용 (앞 수정의 결과가 뒤 수정의 입력) |
| recordValues | Boolean | | `false` | `true` 이면 `meta.modifications[i]` 에 `before` / `after` 스냅샷이 추가된다 (마스킹 적용). default `false` — 큰 컬렉션 변수는 run log 부피를 키우고 사용자 데이터가 의도치 않게 노출될 수 있으므로 명시적 opt-in 필요 |

### 1.1 ModDef 구조

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| variable | String | ✓ | 대상 변수 이름. 선언되지 않은 변수도 즉시 생성 가능 (`variable_declaration` 없이 사용 가능) |
| operation | Enum | ✓ | 적용할 연산. 아래 §1.2 표 참조 |
| value | Expression | | 연산에 사용할 값. `{{ }}` 표현식 지원. `pop` / `increment(default=1)` / `decrement(default=-1)` 에서는 생략 가능 |

### 1.2 지원 연산

| 연산 | 적용 타입 | 동작 | 비-매칭 타입 fallback |
|------|-----------|------|------------------------|
| `set` | 모든 타입 | 값 덮어쓰기 (`null` / `undefined` 도 설정 가능) | — |
| `increment` | number | 현재 값에 `value` 더함 (default `+1`) | 현재 값이 number 가 아니면 `0` 으로 간주 |
| `decrement` | number | 현재 값에서 `value` 뺌 (default `-1`) | 현재 값이 number 가 아니면 `0` 으로 간주 |
| `append` | string | 문자열 뒤에 `value` 이어붙임. `value` 가 비-문자열이면 `JSON.stringify` 코어션 (`null`/`undefined` → `''`) | 현재 값이 string 이 아니면 `''` 으로 간주 |
| `push` | array | 배열 끝에 `value` 추가 (**in-place mutation**) | 현재 값이 array 가 아니면 `[value]` 로 덮어쓰기 |
| `pop` | array | 배열 끝 요소 제거 (**in-place mutation**) | 현재 값이 array 가 아니면 무시 (mutation 없음) |

> ⚠ **In-place mutation 주의**: `push` / `pop` 은 동일 배열 참조를 변경한다. 다른 노드의 `output` 또는 다른 변수가 같은 배열 참조를 보유하면 조용히 함께 변경되므로 디버깅이 어렵다. 안전한 변경이 필요하면 `set` 으로 새 배열을 할당한다.

> Source of truth: `codebase/backend/src/nodes/logic/variable-modification/variable-modification.schema.ts` (export `variableModificationNodeConfigSchema`). UI 메타데이터 / warningRules / `validateVariableModificationConfig` 는 frontend canvas 와 backend `handler.validate` 가 공유하는 SSOT.

## 2. 설정 UI

```
┌─────────────────────────────────────────────┐
│  Modifications                              │
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │ Variable: counter                       ││
│  │ Operation: [increment ▼]                ││
│  │ Value: 1                          [×]   ││
│  └─────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────┐│
│  │ Variable: log                           ││
│  │ Operation: [append ▼]                   ││
│  │ Value: " done"                    [×]   ││
│  └─────────────────────────────────────────┘│
│                                             │
│  [+ Add Modification]                       │
└─────────────────────────────────────────────┘
```

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 통과시킬 입력 데이터 (1개 필수) |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `out` | Output | data | false | input pass-through (변형 없음) |

> Variable Modification 은 동적 포트가 없다 (단일 출력).

## 4. 실행 로직

1. `validate` — schema warningRules + `validateVariableModificationConfig` 가 `modifications` 비어 있음 / 첫 항목 변수 누락 / 항목별 `variable` 미지정 / `operation` 화이트리스트 미일치를 검사. 핸들러는 `modifications` 가 배열이 아닌 경우만 추가로 reject (Pre-flight throw, CONVENTIONS Principle 3.1).
2. `modifications[]` 를 순서대로 순회하며 [`applyModification`](../../../codebase/backend/src/nodes/logic/variable-modification/variable-modification.handler.ts) 호출:
   - 현재 값 (`context.variables[mod.variable]`) 조회
   - `mod.operation` 에 따라 §1.2 표 동작 적용. 비-매칭 타입은 fallback 적용 (silent coercion)
   - 결과를 `context.variables[mod.variable]` 에 저장 (`push` / `pop` 은 in-place mutation)
3. `input` 은 변형 없이 그대로 `output` 으로 전달 (Logic 공통 §10 Pass-through 규약).
4. 변수 변경은 워크플로우 실행 전체에서 `{{ $var.<name> }}` 표현식으로 참조 가능 (다른 노드에서도 즉시 반영).

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> Variable Modification 은 단일 출력 pass-through 노드이므로 단일 케이스 (§5.1) 로 구성된다 (별도 분기·에러 케이스 없음 — config 검증 실패는 §1 / §4 의 pre-flight throw).

### 5.1 Case: 정상 (단일 출력)

```json
{
  "config": {
    "modifications": [
      { "variable": "counter", "operation": "increment", "value": "{{ $delta }}" },
      { "variable": "log",     "operation": "append",    "value": " done" }
    ]
  },
  "output": { "user": { "id": 7, "name": "Alice" } },
  "meta": {
    "durationMs": 1,
    "modifications": [
      { "variable": "counter", "operation": "increment", "applied": true },
      { "variable": "log",     "operation": "append",    "applied": true }
    ],
    "coercionWarnings": [],
    "createdVariables": []
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.modifications` | ModDef[] | config echo (Principle 7) | 사용자가 입력한 raw 수정 목록 — `value` 의 `{{ }}` 표현식은 평가 전 형태로 보존 (`codebase/backend/src/nodes/logic/variable-modification/variable-modification.handler.ts` 가 `context.rawConfig.modifications` 를 echo) |
| `output` | (input 전체) | runtime — pass-through | input 데이터 그대로 (변형 없음). side-effect 는 `context.variables` 로만 발생 |
| `meta.durationMs` | number | engine inject | 실행 시간 (ms). 모든 노드 공통 |
| `meta.modifications` | `Array<{ variable: string, operation: string, applied: boolean, before?: unknown, after?: unknown }>` | handler | 적용된 modification 목록. `variable` 누락이나 `pop` on non-array 등 no-op 인 경우 `applied=false` (CONVENTIONS Principle 2 — 실행 메트릭). `config.recordValues=true` 일 때만 `before`/`after` 가 추가되며, 다음 마스킹 정책이 적용된다 (`codebase/backend/src/nodes/logic/_shared/value-masking.util.ts`): (1) 변수명이 secret 패턴 (`password`/`token`/`apiKey` 등) 매칭 시 `'***'`, (2) JSON 직렬화 4096 byte 초과 시 `'[truncated:N bytes]'`, (3) 함수/심볼은 `'[unsupported:...]'`, (4) 그 외 primitive·소형 컬렉션은 deep-clone 으로 보존 (이후 mutation 무관). default `false` |
| `meta.coercionWarnings` | `Array<{ variable: string, operation: string, fromType: string, error?: string }>` | handler | 비-매칭 타입 fallback (`increment` on non-number → `0`, `append` on non-string → `''`, `push` / `pop` on non-array) 이 발생한 항목. 변수 미존재 (initial create) 는 경고 대상이 아니다 |
| `meta.createdVariables` | `string[]` | handler | 본 modification 에서 선언 없이 처음 생성된 변수 이름 (사용자 오탈자 감지) |
| `port` | (생략) | — | 단일 출력 노드이므로 `undefined` (CONVENTIONS Principle 5) |
| `status` | (생략) | — | 비-블로킹 노드이므로 `undefined` |

> `meta.durationMs` 는 엔진이 모든 노드에 공통 주입하는 값으로, 별도 핸들러 변경 없이 채워진다.

**Expression 접근 예** (위 예시의 노드 이름이 `"X"` 일 때):
- `$node["X"].output.user.name` → `"Alice"` (input pass-through)
- `$node["X"].config.modifications[0].value` → `"{{ $delta }}"` (raw — 평가 전 표현식 보존)
- `$var.counter` → 평가된 `$delta` 만큼 증가된 값 (예: `5`)
- `$var.log` → `"...processing done"` (이전 값 + `" done"`)
- `$node["X"].meta.modifications[0].applied` → `true` (해당 변경이 실제 반영됨)
- `$node["X"].meta.coercionWarnings.length` → `0` (타입 mismatch fallback 미발생)

## 6. 에러 코드

Variable Modification 은 **runtime 에러 포트를 갖지 않는다**. 모든 검증 실패는 pre-flight (config 검증) 단계에서 throw 된다 (CONVENTIONS Principle 3.1):

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `modifications` 가 빈 배열 | `최소 1개 이상의 변경을 추가해야 합니다.` | warningRule (캔버스 배지) + handler.validate |
| `modifications[0].variable` 가 빈 문자열 | `첫 번째 변경의 대상 변수를 선택해야 합니다.` | warningRule (캔버스 배지) |
| `modifications[i].variable` 누락 또는 비-string | `modifications[i].variable is required and must be a string` | handler.validate (`validateVariableModificationConfig`) |
| `modifications[i].operation` 가 화이트리스트 미일치 (임의 문자열) | `modifications[i].operation must be one of: set, increment, decrement, append, push, pop` | handler.validate |
| `modifications` 가 배열이 아님 | `modifications must be an array` | handler.validate |

## 7. 캔버스 요약

[공통 §8](./0-common.md#8-캔버스-요약) — `Variable Modification` 행 인용 (`{variable} {operation}` — 첫 번째 수정 기준).
