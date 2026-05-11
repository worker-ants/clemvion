# Spec: If/Else

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [CONVENTIONS](../../../user_memo/node-specs-improvement/CONVENTIONS.md)

조건식을 평가하여 `true` / `false` 두 포트로 분기하는 **pass-through 노드**. 입력은 변형 없이 선택된 포트로 그대로 전달된다 (Logic 공통 §Pass-through 규약).

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| conditions | ConditionGroup[] | ✓ | `[]` | 조건 그룹 목록. 구조는 [공통 §1](./0-common.md#1-conditiongroup-구조) |
| combineMode | `and` / `or` | ✓ | `and` | 조건 그룹 간 결합 방식 |
| strictComparison | Boolean | | `false` | 엄격 타입 비교 모드. [표현식 §3.2.1](../../5-system/5-expression-language.md#321-strict-모드) |

지원 연산자는 [공통 §2](./0-common.md#2-지원-연산자) 참조. 표현식(`{{ }}`)은 `condition.field`·`condition.value`에서 사용 가능.

> Source of truth: `backend/src/nodes/logic/if-else/if-else.schema.ts` (export `ifElseConfigSchema`)

## 2. 설정 UI

```
┌──────────────────────────────────────┐
│  Conditions (AND ▼)                  │
│                                      │
│  ┌──────────────────────────────────┐│
│  │ {{ $input.role }} [equals ▼]    ││
│  │ "admin"                     [×] ││
│  └──────────────────────────────────┘│
│  ┌──────────────────────────────────┐│
│  │ {{ $input.age }}  [greater ▼]   ││
│  │ 18                          [×] ││
│  └──────────────────────────────────┘│
│                                      │
│  [+ Add Condition]                   │
└──────────────────────────────────────┘
```

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 평가 대상 데이터 (1개 필수) |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `true` | True | data | false | 조건 만족 시 input pass-through |
| `false` | False | data | false | 조건 불만족 시 input pass-through |

> If/Else는 동적 포트가 없다.

## 4. 실행 로직

1. `input` 데이터에 대해 모든 `conditions[i]` 를 [`evaluateCondition`](../../../backend/src/nodes/core/condition-evaluator.util.ts) 으로 평가 (`strictComparison` 옵션 적용)
2. `combineMode` 에 따라 결과를 결합: `and` → 모두 true / `or` → 하나라도 true
3. 결과가 true → §5.1 (`port: 'true'`) / false → §5.2 (`port: 'false'`)
4. `input` 은 변형 없이 그대로 `output` 에 복사 (Logic 공통 §Pass-through 규약)

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> If/Else는 분기만 수행하는 pass-through 노드이므로 §5.1/§5.2 두 분기 케이스로 구성된다 (별도 에러 케이스 없음 — config 검증 실패는 §3.1 pre-flight throw).

### 5.1 Case: 조건 만족 (port `true`)

```json
{
  "config": {
    "conditions": [
      { "field": "{{ $input.user.age }}", "operator": "gte", "value": 18 }
    ],
    "combineMode": "and"
  },
  "output": { "user": { "age": 25, "name": "Alice" } },
  "meta": {
    "durationMs": 0,
    "conditionResult": true,
    "matchedConditions": [
      { "index": 0, "field": "user.age", "operator": "gte", "value": 18, "result": true }
    ]
  },
  "port": "true"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.conditions` | ConditionGroup[] | config echo (Principle 7) | 사용자가 입력한 raw 조건 — 표현식 `{{ }}` 보존 |
| `config.combineMode` | `'and'` / `'or'` | config echo | 결합 모드 (default `and`) |
| `output` | (input 전체) | runtime — pass-through | input 데이터 그대로 (변형 없음) |
| `meta.durationMs` | number | engine inject | 실행 시간 (ms) |
| `meta.conditionResult` | boolean | handler return | 조건 평가의 최종 boolean — `port` 문자열 비교 없이 boolean으로 읽기 |
| `meta.matchedConditions` | Array | handler return | 각 조건의 평가 결과 (`combineMode='or'` 디버깅용) |
| `port` | `'true'` | handler return | 조건 만족 분기 |

> `meta.durationMs` 는 엔진이 모든 노드에 공통 주입하는 값으로, 핸들러는 별도로 채우지 않는다.

**Expression 접근 예**:
- `$node["X"].output.user.age` → 25 (pass-through)
- `$node["X"].port` → `"true"`
- `$node["X"].meta.conditionResult` → `true`

### 5.2 Case: 조건 불만족 (port `false`)

```json
{
  "config": {
    "conditions": [
      { "field": "{{ $input.user.age }}", "operator": "gte", "value": 18 }
    ],
    "combineMode": "and"
  },
  "output": { "user": { "age": 15, "name": "Bob" } },
  "meta": {
    "durationMs": 0,
    "conditionResult": false,
    "matchedConditions": [
      { "index": 0, "field": "user.age", "operator": "gte", "value": 18, "result": false }
    ]
  },
  "port": "false"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | (§5.1과 동일) | config echo | |
| `output` | (input 전체) | runtime — pass-through | input 데이터 그대로 |
| `meta.conditionResult` | boolean | handler return | `false` |
| `port` | `'false'` | handler return | 조건 불만족 분기 |

**Expression 접근 예**:
- `$node["X"].output.user.age` → 15 (pass-through)
- `$node["X"].port` → `"false"`

## 6. 에러 코드

If/Else는 **runtime 에러 포트를 갖지 않는다**. 모든 검증 실패는 pre-flight (config 검증) 단계에서 throw 된다 (CONVENTIONS Principle 3.1):

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `conditions` 가 빈 배열 | `최소 1개 이상의 조건을 추가해야 합니다.` | warningRule (캔버스 배지) + handler.validate |
| `conditions[0].field` 가 빈 문자열 | `첫 번째 조건의 필드를 입력해야 합니다.` | warningRule (캔버스 배지) |
| `conditions[i].field` 누락 | `conditions[i].field is required and must be a string` | handler.validate |
| `conditions[i].operator` 가 enum 미일치 | `conditions[i].operator must be one of: eq, neq, …` | handler.validate |
| `combineMode` 가 `and`/`or` 외 | `combineMode must be "and" or "or"` | handler.validate |
| `strictComparison` 가 boolean 아님 | `strictComparison must be a boolean` | handler.validate |

> `is_type` / `regex` 연산자는 If/Else / Switch (expression mode) / Filter / Transform.array_filter 모두에서 동일하게 동작한다 (`core/condition-evaluator.util.ts`). `regex` 는 schema 가 string literal 만 허용하며, `is_type` 은 `string` / `number` / `boolean` / `object` / `array` / `null` / `undefined` 중 하나여야 한다 (그 외 값은 `false`). 본 문서 §1 표는 [공통 §2 지원 연산자](./0-common.md#2-지원-연산자) 인용에 의존한다.

## 7. 캔버스 요약

[공통 §8](./0-common.md#8-캔버스-요약) — `If/Else` 행 인용.
