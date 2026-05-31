---
id: transform
status: implemented
code:
  - codebase/backend/src/nodes/data/transform/transform.handler.ts
  - codebase/backend/src/nodes/data/transform/transform.schema.ts
---

# Spec: Transform

> 관련 문서: [Data 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Filter 노드](../1-logic/8-filter.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [CONVENTIONS](../../conventions/node-output.md)

입력 데이터에 변환 연산(operations)을 순차적으로 적용하여 출력하는 **순수 데이터 변형 노드**. operation 체인은 핸들러 프로세스 내부에서 외부 I/O 없이 실행된다 (Data 공통 §2). 코딩 없이 시각적 빌더 UI를 통해 데이터를 재구조화할 수 있다.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| operations | Operation[] | ✓ | `[]` | 변환 연산 체인. 배열 순서대로 적용되며, 각 연산은 직전 결과를 입력으로 받는다 |

각 Operation 은 `type` 과 타입별 필수 파라미터(`field` / `from` / `to` / `value` / `targetType` / `operation` / `args` / `operand` / `condition` / `keys` / `sortBy` / `order` 등)로 구성된다. 타입별 정의는 §1.1 참조.

표현식(`{{ }}`) 사용 가능 위치:
- `set_field.value` — 임의 표현식
- `math_op.operand` — 숫자 표현식
- 기타 operation 의 `args` 내부 문자열 필드

> Source of truth: `codebase/backend/src/nodes/data/transform/transform.schema.ts` (export `transformNodeConfigSchema`, `validateTransformConfig`)

### 1.1 Operation 정의

| type | params | 설명 |
|------|--------|------|
| `rename_field` | `from` (String, 필수), `to` (String, 필수) | 필드 이름 변경 |
| `remove_field` | `field` (String, 필수) | 필드 제거 |
| `set_field` | `field` (String, 필수), `value` (any, 표현식 허용) | 필드 값 설정 (신규 생성 또는 덮어쓰기) |
| `type_convert` | `field` (String, 필수), `targetType` (`string` / `number` / `boolean` / `array` / `object`) | 타입 변환 |
| `string_op` | `field` (String, 필수), `operation` (`trim` / `uppercase` / `lowercase` / `replace` / `split` / `join`), `args` (Object) | 문자열 조작 |
| `math_op` | `field` (String, 필수), `operation` (`add` / `subtract` / `multiply` / `divide` / `round` / `ceil` / `floor`), `operand` (Number, 표현식 허용) | 수학 연산 |
| `date_op` | `field` (String, 필수), `operation` (`format` / `add` / `subtract` / `diff`), `args` (Object) | 날짜 조작 (`dayjs`) |
| `array_filter` | `field` (String, 필수), `condition` (Condition) | 배열 필터링. 다중 조건 / 매칭·비매칭 분기는 [Filter 노드](../1-logic/8-filter.md) |
| `array_sort` | `field` (String, 필수), `sortBy` (String?), `order` (`asc` / `desc`) | 배열 정렬 |
| `object_pick` | `field` (String?), `keys` (String[], 비어있지 않음) | 특정 키만 선택 (root 또는 `field` 하위) |
| `object_omit` | `field` (String?), `keys` (String[], 비어있지 않음) | 특정 키 제거. `__proto__` / `constructor` / `prototype` 은 차단 |

**string_op.args:**

| operation | args |
|-----------|------|
| trim / uppercase / lowercase | — |
| replace | `search` (String), `replacement` (String), `all` (Boolean, 기본 `true`), `regex` (Boolean, 기본 `false`) |
| split | `separator` (String) |
| join | `separator` (String, 기본 `","`) |

**date_op.args:**

| operation | args |
|-----------|------|
| format | `pattern` (String, 예: `"YYYY-MM-DD HH:mm:ss"`) |
| add | `amount` (Number), `unit` (`years` / `months` / `days` / `hours` / `minutes` / `seconds`) |
| subtract | `amount` (Number), `unit` |
| diff | `compareField` (String), `unit` |

**array_filter.condition** 의 지원 연산자: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `not_contains`, `starts_with`, `ends_with`, `is_empty`, `is_not_empty`, `regex`, `is_null`. ReDoS 방지를 위해 `regex` 패턴 길이는 200자 이내.

`field` / `from` / `to` 파라미터는 dot/bracket 중첩 경로(`user.profile.name`, `items[0].id`)를 지원한다.

## 2. 설정 UI — 시각적 빌더

```
┌──────────────────────────────────────┐
│  Transform Operations                │
│  ────────────────────────────────── │
│  1. [rename_field ▼] from → to       │
│     [user.name___] → [userName___]   │
│                              [✕] [↕] │
│  ────────────────────────────────── │
│  2. [set_field ▼]                    │
│     field: [fullName___]             │
│     value: [{{ $input.first + " "... │
│                              [✕] [↕] │
│  ────────────────────────────────── │
│  3. [remove_field ▼]                 │
│     field: [tempData___]             │
│                              [✕] [↕] │
│  ────────────────────────────────── │
│  [+ Add Operation]                   │
│                                      │
│  ─── Preview ───────────────────── │
│  Input:  { "user": { "name": "Kim" } │
│  Step 1: { "userName": "Kim" }       │
│  Step 2: { "userName": "Kim",        │
│            "fullName": "Kim ..." }   │
│  Step 3: { "userName": "Kim",        │
│            "fullName": "Kim ..." }   │
└──────────────────────────────────────┘
```

- 각 연산을 카드 형태로 표시
- 드래그(`[↕]`)로 순서 변경 / 삭제(`[✕]`)
- `+ Add Operation` 으로 연산 추가
- 하단 Preview: 마지막 실행 데이터 기준 단계별 결과 미리보기

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 변환 대상 데이터 (1개 필수) |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `out` | Output | data | false | 변환 완료된 데이터 (단일 출력) |

> Transform 은 **단일 출력** 노드이며 동적 포트가 없다. runtime 에러 포트도 없다 (Data 공통 §4.1, CONVENTIONS Principle 3.1).

## 4. 실행 로직

1. 입력 데이터를 `structuredClone` 으로 복제 (원본 불변).
2. `operations` 배열을 인덱스 순서대로 순회하며 각 op 적용. 각 연산은 이전 연산의 결과를 입력으로 받는다.
3. 연산별 동작:
   - 대상 `field` / `from` 가 존재하지 않거나 타입이 맞지 않으면 해당 연산은 **no-op** (원값 유지) 으로 다음 연산으로 진행.
   - `math_op.divide` 의 `operand` 가 `0` 이면 no-op.
   - `date_op` 는 `dayjs(value).isValid() === false` 이면 no-op.
   - `type_convert` 의 `array` / `object` 변환은 문자열을 `JSON.parse` 시도하고 실패 시 no-op.
   - `array_filter` / `array_sort` 는 대상이 배열이 아니면 no-op.
   - `string_op.replace` 의 `regex: true` 패턴이 200자를 넘으면 no-op (ReDoS 방지).
   - `object_pick` / `object_omit` 은 `__proto__` / `constructor` / `prototype` 키를 차단.
4. 모든 연산 적용 후 결과를 `output` 으로, raw `operations` 를 `config.operations` 로 echo 하여 반환 (Principle 7).
5. 단일 출력 포트 `out` 만 활성화 — `port` 는 `undefined` (Principle 5).

> 표현식 평가(`{{ }}`)는 엔진이 핸들러 호출 전에 수행하므로, 핸들러는 평가된 `operations` 로 동작하고 `context.rawConfig.operations` 를 echo 한다.

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> Transform 은 단일 출력 노드이고 모든 에러가 pre-flight throw 이므로, §5.1 (정상) / §5.8 (Pre-flight throw) 두 케이스로 구성된다 (별도 runtime 에러 케이스 없음).

### 5.1 Case: 정상 실행 (단일 출력)

```json
{
  "config": {
    "operations": [
      { "type": "rename_field", "from": "user.firstName", "to": "user.name" },
      { "type": "type_convert", "field": "user.age", "targetType": "number" },
      { "type": "string_op", "field": "user.name", "operation": "uppercase" },
      { "type": "array_sort", "field": "items", "order": "asc" }
    ]
  },
  "output": {
    "user": { "name": "ALICE", "age": 30 },
    "items": [1, 2, 3]
  },
  "meta": {
    "durationMs": 3,
    "operationsApplied": 4,
    "operationsSkipped": 0
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.operations` | Operation[] | config echo (Principle 7) | 사용자가 입력한 raw 연산 목록 — 표현식 `{{ }}` 보존 |
| `output` | object | runtime — 변환 결과 | input 에 모든 op 를 순차 적용한 최종 객체. 루트 키는 input + operations 에 따라 가변. 후속 노드는 `$node["X"].output.<변형된 필드>` 로 직접 접근 (Principle 8 예외 — 변형 결과를 root 에 둠) |
| `meta.durationMs` | number | engine inject | 핸들러 실행 시간 (ms). Principle 2 공통 필드 |
| `meta.operationsApplied` | number | runtime — 핸들러 카운트 | 실제 변형이 발생한 op 수. `applied + skipped === config.operations.length` |
| `meta.operationsSkipped` | number | runtime — 핸들러 카운트 | 필드 부재 / 타입 불일치 / `divide` operand=0 / 유효하지 않은 dayjs 입력 / JSON 파싱 실패 / 길이 초과 regex 등으로 silent no-op 처리된 op 수 |
| `port` | `undefined` | — | 단일 출력 (Principle 5 — 기본 단일 출력의 대표 사례) |
| `status` | `undefined` | — | 일반 완료 (비-블로킹 노드, Data 공통 §4) |

**Expression 접근 예** (변형 결과는 root 직접 접근):
- `$node["X"].output.user.name` → `"ALICE"`
- `$node["X"].output.items[0]` → `1`
- `$node["X"].config.operations.length` → `4` (raw 연산 정의 개수)
- `$node["X"].meta.durationMs` → `3` (engine inject)
- `$node["X"].meta.operationsApplied` → `4` (runtime — 실제 변형 발생 op 수)
- `$node["X"].meta.operationsSkipped` → `0` (runtime — silent no-op 처리된 op 수)

### 5.8 Case: Pre-flight throw (config·표현식 검증 실패)

Transform 은 **runtime 에러 포트를 갖지 않는다**. 모든 검증 실패는 pre-flight (config 검증 또는 표현식 평가) 단계에서 throw 되며, 엔진이 실행 실패(execution failed) 로 마킹한다 (CONVENTIONS Principle 3.1, Data 공통 §4.1).

```text
Error: operations[2].operation is invalid
  at validateTransformConfig (transform.schema.ts)
```

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `operations` 가 빈 배열 | `하나 이상의 변환 작업을 추가해야 합니다.` | warningRule (캔버스 배지) + handler.validate |
| `operations` 가 배열이 아님 | `operations is required and must be an array` | handler.validate |
| `operations[i]` 가 객체가 아니거나 `type` 누락 | `operations[i] is invalid` | validateConfig |
| `operations[i].type` 가 화이트리스트 미일치 | `operations[i].type must be one of: rename_field, remove_field, …` | validateConfig |
| `rename_field` 의 `from` / `to` 누락 | `operations[i].from is required` / `operations[i].to is required` | validateConfig |
| `remove_field` / `set_field` / `type_convert` / `string_op` / `math_op` / `date_op` / `array_filter` / `array_sort` 의 `field` 누락 | `operations[i].field is required` | validateConfig |
| `type_convert.targetType` 가 enum 미일치 | `operations[i].targetType is invalid` | validateConfig |
| `string_op.operation` 가 enum 미일치 | `operations[i].operation is invalid` | validateConfig |
| `math_op.operation` 가 enum 미일치 | `operations[i].operation is invalid` | validateConfig |
| `date_op.operation` 가 enum 미일치 | `operations[i].operation is invalid` | validateConfig |
| `array_filter.condition` 누락 / `condition.field` 누락 / `condition.operator` enum 미일치 | `operations[i].condition is invalid` | validateConfig |
| `array_sort.order` 가 `asc` / `desc` 외 | `operations[i].order must be "asc" or "desc"` | validateConfig |
| `object_pick` / `object_omit` 의 `keys` 가 비어있거나 배열 아님 | `operations[i].keys must be a non-empty array` | validateConfig |
| 표현식 문법 오류 (`{{ }}` 파싱 실패) | (engine expression resolver 의 throw 메시지) | engine pre-evaluation |

> Runtime 무결성 실패(존재하지 않는 필드, 타입 불일치, JSON 파싱 실패 등)는 **에러가 아니라 no-op 으로 처리** 된다 (§4 — 원값 유지하고 다음 op 진행). 사용자가 캔버스에서 즉시 알 수 있어야 하는 config 오류만 pre-flight throw 의 대상이다.

## 6. 에러 코드

§5.8 참조. Transform 은 runtime 에러 포트를 갖지 않으므로 `output.error` 표준 형태(Principle 3.2)를 사용하지 않는다.

## 7. 캔버스 요약

[Data 공통 §3](./0-common.md#3-캔버스-요약) — `Transform` 행 인용 (`{N} operations`). `operations` 가 비어있으면 §5.8 의 warningRule 메시지가 캔버스 배지로 표시된다.
