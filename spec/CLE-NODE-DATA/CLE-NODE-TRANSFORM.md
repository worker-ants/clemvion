---
id: "CLE-NODE-TRANSFORM"
title: "Transform 노드"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-TRANSFORM-001", "REQ-TRANSFORM-002", "REQ-TRANSFORM-003", "REQ-TRANSFORM-004", "REQ-TRANSFORM-005", "REQ-TRANSFORM-006", "REQ-TRANSFORM-007", "REQ-TRANSFORM-008", "REQ-TRANSFORM-009", "REQ-TRANSFORM-010", "REQ-TRANSFORM-011", "REQ-TRANSFORM-012", "REQ-TRANSFORM-013", "REQ-TRANSFORM-014", "REQ-TRANSFORM-015", "REQ-TRANSFORM-016", "REQ-TRANSFORM-017", "REQ-TRANSFORM-018", "REQ-TRANSFORM-019", "REQ-TRANSFORM-020", "REQ-TRANSFORM-021", "REQ-TRANSFORM-022", "REQ-TRANSFORM-023", "REQ-TRANSFORM-024", "REQ-TRANSFORM-025", "REQ-TRANSFORM-026", "REQ-TRANSFORM-027", "REQ-TRANSFORM-028"]
basis_superseded: false
parent: "CLE-NODE-DATA"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-DATA"]
area: "CLE-NODE-DATA"
content_hash: "b05d377f0d3a427e27ad8a45653ed7d3cbd372af43004b264e310da9de922a44"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/5-data/1-transform.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "e121471206960e52f88a35577677557549d77b34543a7ee24a5f60df8bd12e04"
etag: "sha256-d006512789fcf5840a7064de2e1646f3920e3bcca910f86505bf5cca7b81ff15"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/5-data/1-transform.md`, `spec/4-nodes/_product-overview.md` (§8.1) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Transform 노드(`transform`)는 입력 데이터에 변환 연산(`operations[]`)을 차례로 적용해 출력하는 순수 데이터 변형 노드다. 변환 연산 체인은 핸들러 프로세스 안에서 외부 I/O 없이 실행된다. 사용자는 코드를 쓰지 않고 시각적 빌더로 데이터를 다시 구성한다.

Data 노드 공통 규약(표현식 평가 위치, 노드 출력 사용 방식, 에러 계약)은 [Data 노드 공통](CLE-NODE-DATA-COMMON.md)이 정한다. 여러 조건으로 배열을 거르고 일치·불일치로 나누는 일은 [Filter 노드](../CLE-NODE-LOGIC/CLE-NODE-FILTER.md)가 맡는다. 코드로만 표현할 수 있는 변환은 [Code 노드](CLE-NODE-CODE.md)를 쓴다.

## 요구사항

- REQ-TRANSFORM-001 WHEN 노드가 실행되면 THE SYSTEM SHALL 입력 데이터에 변환 연산을 배열 순서대로 적용해 출력한다. (원본: ND-TF-01)
- REQ-TRANSFORM-002 WHEN 변환 연산을 적용하면 THE SYSTEM SHALL 각 연산이 직전 연산의 결과를 입력으로 받게 한다. (원본: ND-TF-01)
- REQ-TRANSFORM-003 WHEN 사용자가 연산을 고르면 THE SYSTEM SHALL 필드 이름 변경(`rename_field`)·필드 제거(`remove_field`)·필드 설정(`set_field`)을 제공한다. (원본: ND-TF-02)
- REQ-TRANSFORM-004 WHEN 사용자가 연산을 고르면 THE SYSTEM SHALL 타입 변환(`type_convert`)을 `string`·`number`·`boolean`·`array`·`object` 대상으로 제공한다. (원본: ND-TF-03)
- REQ-TRANSFORM-005 WHEN 사용자가 연산을 고르면 THE SYSTEM SHALL 문자열 조작(`string_op`)으로 trim·uppercase·lowercase·replace·split·join 을 제공한다. (원본: ND-TF-04)
- REQ-TRANSFORM-006 WHEN 사용자가 연산을 고르면 THE SYSTEM SHALL 수학 연산(`math_op`)으로 add·subtract·multiply·divide·round·ceil·floor 를 제공한다. (원본: ND-TF-05)
- REQ-TRANSFORM-007 WHEN 사용자가 연산을 고르면 THE SYSTEM SHALL 날짜 조작(`date_op`)으로 format·add·subtract·diff 를 `dayjs` 로 제공한다. (원본: ND-TF-06)
- REQ-TRANSFORM-008 WHEN 사용자가 연산을 고르면 THE SYSTEM SHALL 배열 필터(`array_filter`)·배열 정렬(`array_sort`)·객체 키 선택(`object_pick`)·객체 키 제거(`object_omit`)를 제공한다. (원본: ND-TF-07)
- REQ-TRANSFORM-009 WHEN 사용자가 노드를 편집하면 THE SYSTEM SHALL 연산을 카드로 보이고 추가·삭제·드래그 순서 변경을 제공한다. (원본: ND-TF-08)
- REQ-TRANSFORM-010 WHEN 마지막 실행 입력이 있으면 THE SYSTEM SHALL 그 입력으로 연산 단계별 미리보기를 보인다. (원본: ND-TF-09)
- REQ-TRANSFORM-011 IF 실행 데이터가 없으면 THE SYSTEM SHALL 편집할 수 있는 샘플 JSON 입력으로 단계별 미리보기를 보인다. (원본: ND-TF-09)
- REQ-TRANSFORM-012 WHEN 미리보기를 계산하면 THE SYSTEM SHALL 백엔드 핸들러와 같은 no-op·차단 규칙을 적용한다.
- REQ-TRANSFORM-013 WHEN 노드가 실행되면 THE SYSTEM SHALL 입력을 `structuredClone` 으로 복제해 원본을 바꾸지 않는다.
- REQ-TRANSFORM-014 WHEN `field`·`from`·`to` 에 점·대괄호 경로를 쓰면 THE SYSTEM SHALL 중첩 경로로 해석한다.
- REQ-TRANSFORM-015 IF 대상 필드가 없거나 타입이 맞지 않으면 THE SYSTEM SHALL 그 연산을 건너뛰고 다음 연산으로 진행한다.
- REQ-TRANSFORM-016 IF `math_op.divide` 의 `operand` 가 0 이면 THE SYSTEM SHALL 그 연산을 건너뛴다.
- REQ-TRANSFORM-017 IF `date_op` 의 입력이 유효한 날짜가 아니면 THE SYSTEM SHALL 그 연산을 건너뛴다.
- REQ-TRANSFORM-018 IF `type_convert` 의 `array`·`object` 변환에서 JSON 파싱이 실패하면 THE SYSTEM SHALL 그 연산을 건너뛴다.
- REQ-TRANSFORM-019 IF `array_filter`·`array_sort` 의 대상이 배열이 아니면 THE SYSTEM SHALL 그 연산을 건너뛴다.
- REQ-TRANSFORM-020 WHEN 사용자 정규식을 컴파일하면 THE SYSTEM SHALL 200자 이하이고 `safe-regex` 위험 패턴이 아닌 것만 허용한다.
- REQ-TRANSFORM-021 IF `string_op.replace` 의 정규식이 검사를 통과하지 못하면 THE SYSTEM SHALL 그 연산을 건너뛴다.
- REQ-TRANSFORM-022 WHEN `object_omit` 을 적용하면 THE SYSTEM SHALL `__proto__`·`constructor`·`prototype` 키는 제거 대상에서 뺀다.
- REQ-TRANSFORM-023 WHEN 모든 연산을 적용하면 THE SYSTEM SHALL 결과를 `output` 에, 원본 `operations` 를 `config.operations` 에 담고 `port` 를 비워 둔다.
- REQ-TRANSFORM-024 WHEN 실행이 끝나면 THE SYSTEM SHALL 실제로 바꾼 연산 수를 `meta.operationsApplied` 에, 건너뛴 연산 수를 `meta.operationsSkipped` 에 담는다.
- REQ-TRANSFORM-025 WHEN `set_field` 가 prototype 오염 차단으로 무시되면 THE SYSTEM SHALL 그 연산을 applied 로 센다.
- REQ-TRANSFORM-026 IF 설정 형식이 잘못되면 THE SYSTEM SHALL 사전 검증 에러로 실행을 실패시킨다.
- REQ-TRANSFORM-027 IF 표현식 문법이 잘못되면 THE SYSTEM SHALL 실행 전 평가 단계에서 실행을 실패시킨다.
- REQ-TRANSFORM-028 WHEN `operations` 가 비어 있으면 THE SYSTEM SHALL 캔버스에 경고 배지를 보인다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `operations` | Operation[] | ✓ | `[]` | 변환 연산 체인. 배열 순서대로 적용하며 각 연산은 직전 결과를 입력으로 받는다 |

각 연산은 `type` 과 타입별 필수 파라미터(`field`·`from`·`to`·`value`·`targetType`·`operation`·`args`·`operand`·`condition`·`keys`·`sortBy`·`order` 등)로 이뤄진다.

표현식(`{{ }}`)을 쓸 수 있는 자리:

- `set_field.value`: 임의 표현식
- `math_op.operand`: 숫자 표현식
- 그 밖 연산의 `args` 안 문자열 필드

설정 스키마의 단일 기준은 `codebase/backend/src/nodes/data/transform/transform.schema.ts` 의 `transformNodeConfigSchema`·`validateTransformConfig` 다.

### 연산 정의

| type | 파라미터 | 설명 |
|------|----------|------|
| `rename_field` | `from`(String, 필수), `to`(String, 필수) | 필드 이름 변경 |
| `remove_field` | `field`(String, 필수) | 필드 제거 |
| `set_field` | `field`(String, 필수), `value`(any, 표현식 허용) | 필드 값 설정(새로 만들거나 덮어쓰기) |
| `type_convert` | `field`(String, 필수), `targetType`(`string` / `number` / `boolean` / `array` / `object`) | 타입 변환 |
| `string_op` | `field`(String, 필수), `operation`(`trim` / `uppercase` / `lowercase` / `replace` / `split` / `join`), `args`(Object) | 문자열 조작 |
| `math_op` | `field`(String, 필수), `operation`(`add` / `subtract` / `multiply` / `divide` / `round` / `ceil` / `floor`), `operand`(Number, 표현식 허용) | 수학 연산 |
| `date_op` | `field`(String, 필수), `operation`(`format` / `add` / `subtract` / `diff`), `args`(Object) | 날짜 조작(`dayjs`) |
| `array_filter` | `field`(String, 필수), `condition`(Condition) | 배열 필터. 여러 조건이나 일치·불일치 분기는 [Filter 노드](../CLE-NODE-LOGIC/CLE-NODE-FILTER.md) |
| `array_sort` | `field`(String, 필수), `sortBy`(String?), `order`(`asc` / `desc`) | 배열 정렬 |
| `object_pick` | `field`(String?), `keys`(String[], 비어 있으면 안 됨) | 지정한 키만 남긴다(루트 또는 `field` 아래) |
| `object_omit` | `field`(String?), `keys`(String[], 비어 있으면 안 됨) | 지정한 키를 지운다. `__proto__`·`constructor`·`prototype` 은 막는다 |

`string_op.args`:

| operation | args |
|-----------|------|
| trim / uppercase / lowercase | — |
| replace | `search`(String), `replacement`(String), `all`(Boolean, 기본 `true`), `regex`(Boolean, 기본 `false`) |
| split | `separator`(String) |
| join | `separator`(String, 기본 `","`) |

`date_op.args`:

| operation | args |
|-----------|------|
| format | `pattern`(String, 예: `"YYYY-MM-DD HH:mm:ss"`) |
| add | `amount`(Number), `unit`(`years` / `months` / `days` / `hours` / `minutes` / `seconds`) |
| subtract | `amount`(Number), `unit` |
| diff | `compareField`(String), `unit` |

`array_filter.condition` 이 지원하는 연산자는 `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `not_contains`, `starts_with`, `ends_with`, `is_empty`, `is_not_empty`, `regex`, `is_null`, `is_type` 이다. 조건 구조와 연산자 의미는 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md)과 같다. `regex` 패턴은 ReDoS 를 막으려고 단일 헬퍼 `compileUserRegex` 로 컴파일한다. 길이 200자 이하이고 `safe-regex` 위험 패턴(지수 백트래킹)이 아니어야 한다. 길이 제한만으로는 ReDoS 를 막을 수 없어 `safe-regex` 가 1차, 길이가 2차 방어다(refactor 04 M-3). `is_type` 은 [If/Else 노드](../CLE-NODE-LOGIC/CLE-NODE-IFELSE.md)·Switch(표현식 모드)·Filter 와 같게 동작한다.

`field`·`from`·`to` 파라미터는 점·대괄호 중첩 경로(`user.profile.name`, `items[0].id`)를 지원한다.

## 설정 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|---------------|------|
| 연산 목록 | 위 | 연산 카드(번호, `type` 드롭다운, 타입별 파라미터 입력, 삭제 `[✕]`, 이동 `[↕]`) | 카드를 드래그해 순서를 바꾸고 `[✕]` 로 지운다 |
| 연산 추가 | 목록 아래 | `+ Add Operation` 버튼 | 새 연산 카드를 더한다 |
| 미리보기 | 맨 아래 | Input 과 Step 1, Step 2, ... 결과 | 단계별 변환 결과를 보인다 |

미리보기는 **마지막 실행 입력을 먼저** 쓴다. 실행 데이터가 없으면 **편집할 수 있는 샘플 JSON 입력**(textarea, 기본 예시 제공)으로 대신한다. 실행 데이터가 있으면 "마지막 실행 입력 사용" 안내를 보인다. 그래서 한 번도 실행하지 않은 워크플로우에서도 미리보기가 동작한다. 단계별 계산은 백엔드 핸들러 의미를 그대로 옮긴 프론트엔드 구현(`apply-operation.ts`)이 하며, 아래 실행 로직의 no-op·차단 규칙을 똑같이 적용한다.

## 포트

| 방향 | id | label | type | dynamic | 설명 |
|------|----|-------|------|---------|------|
| 입력 | `in` | Input | data | false | 변환 대상 데이터(1개 필수) |
| 출력 | `out` | Output | data | false | 변환한 데이터(단일 출력) |

단일 출력 노드이며 동적 포트가 없다. 런타임 에러 포트도 없다([Data 노드 공통](CLE-NODE-DATA-COMMON.md) 에러 계약, 노드 출력 규약 Principle 3.1).

## 실행 로직

1. 입력 데이터를 `structuredClone` 으로 복제한다(원본 불변).
2. `operations` 배열을 순서대로 돌며 연산을 적용한다. 각 연산은 앞 연산의 결과를 입력으로 받는다.
3. 연산별 동작:
   - 대상 `field`·`from` 이 없거나 타입이 맞지 않으면 그 연산은 **no-op**(원래 값 유지)이고 다음 연산으로 간다.
   - `math_op.divide` 의 `operand` 가 `0` 이면 no-op.
   - `date_op` 는 `dayjs(value).isValid() === false` 면 no-op.
   - `type_convert` 의 `array`·`object` 변환은 문자열을 `JSON.parse` 해 보고 실패하면 no-op.
   - `array_filter`·`array_sort` 는 대상이 배열이 아니면 no-op.
   - `string_op.replace` 의 `regex: true` 패턴이 `compileUserRegex`(200자 이하 + `safe-regex` 위험 패턴 거부)를 통과하지 못하면 no-op(ReDoS 방지, refactor 04 M-3).
   - `object_omit` 은 `__proto__`·`constructor`·`prototype` 키 제거를 막는다(제거 대상에서 뺀다). `object_pick` 은 막지 않고 지정한 `keys` 를 그대로 복사한다.
4. 모든 연산을 적용한 결과를 `output` 으로, 원본 `operations` 를 `config.operations` 로 에코해 돌려준다(Principle 7).
5. 단일 출력 포트 `out` 만 쓰므로 `port` 는 비워 둔다(Principle 5).

표현식 평가(`{{ }}`)는 엔진이 핸들러를 부르기 전에 한다. 핸들러는 평가된 `operations` 로 동작하고 `context.rawConfig.operations` 를 에코한다.

## 출력 구조

노드 출력은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 11 형식을 따른다. JSON 예시는 `undefined` 필드를 생략하고, 다섯 필드 밖의 최상위 키는 두지 않는다. 단일 출력 노드이고 모든 에러가 사전 검증 에러이므로 케이스는 정상 실행과 사전 검증 에러 둘이다(별도 런타임 에러 케이스 없음).

### 정상 실행 (단일 출력)

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
| `config.operations` | Operation[] | 설정 에코 | 사용자가 입력한 원본 연산 목록(표현식 보존) |
| `output` | object | 런타임(변환 결과) | 입력에 모든 연산을 차례로 적용한 최종 객체. 루트 키는 입력과 연산에 따라 달라진다. 뒤쪽 노드는 `$node["X"].output.<변형된 필드>` 로 바로 읽는다(Principle 8 예외, 변형 결과를 루트에 둔다) |
| `meta.durationMs` | number | 엔진 주입 | 핸들러 실행 시간(ms). Principle 2 공통 필드 |
| `meta.operationsApplied` | number | 핸들러 집계 | 실제로 바꾼 연산 수. `applied + skipped === config.operations.length`. `set_field` 는 언제나 applied 로 센다. `setNestedValue` 가 prototype 오염 차단으로 무시했어도 사용자가 의도한 변형 시도이기 때문이다(skipped 는 필드·타입 부재에 한정) |
| `meta.operationsSkipped` | number | 핸들러 집계 | 필드 부재, 타입 불일치, `divide` operand 0, 유효하지 않은 dayjs 입력, JSON 파싱 실패, 검사를 통과하지 못한 정규식 등으로 조용히 no-op 처리한 연산 수 |
| `port` | `undefined` | — | 단일 출력(Principle 5 의 대표 사례) |
| `status` | `undefined` | — | 일반 완료(비블로킹) |

표현식 접근 예(변형 결과는 루트에서 바로 읽는다):

- `$node["X"].output.user.name` → `"ALICE"`
- `$node["X"].output.items[0]` → `1`
- `$node["X"].config.operations.length` → `4`
- `$node["X"].meta.durationMs` → `3`
- `$node["X"].meta.operationsApplied` → `4`
- `$node["X"].meta.operationsSkipped` → `0`

### 사전 검증 에러 (설정·표현식 검증 실패)

Transform 은 런타임 에러 포트가 없다. 모든 검증 실패는 설정 검증이나 표현식 평가 단계에서 throw 되고 엔진이 실행을 실패로 끝낸다(노드 출력 규약 Principle 3.1, [Data 노드 공통](CLE-NODE-DATA-COMMON.md)).

```text
Error: operations[2].operation is invalid
  at validateTransformConfig (transform.schema.ts)
```

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `operations` 가 빈 배열 | `At least one transform operation must be added.` (경고 규칙이 단일 기준, `transform.schema.ts` `warningRules`. 옛 `summaryTemplate.warnMessage` 는 `No operations defined`) | 경고 규칙(캔버스 배지) + handler.validate |
| `operations` 가 배열이 아님 | `operations is required and must be an array` | handler.validate |
| `operations[i]` 가 객체가 아니거나 `type` 이 없음 | `operations[i] is invalid` | validateConfig |
| `operations[i].type` 이 허용 목록에 없음 | `operations[i].type must be one of: rename_field, remove_field, …` | validateConfig |
| `rename_field` 의 `from`·`to` 누락 | `operations[i].from is required` / `operations[i].to is required` | validateConfig |
| `remove_field`·`set_field`·`type_convert`·`string_op`·`math_op`·`date_op`·`array_filter`·`array_sort` 의 `field` 누락 | `operations[i].field is required` | validateConfig |
| `type_convert.targetType` 이 enum 밖 | `operations[i].targetType is invalid` | validateConfig |
| `string_op.operation` 이 enum 밖 | `operations[i].operation is invalid` | validateConfig |
| `math_op.operation` 이 enum 밖 | `operations[i].operation is invalid` | validateConfig |
| `date_op.operation` 이 enum 밖 | `operations[i].operation is invalid` | validateConfig |
| `array_filter.condition` 누락, `condition.field` 누락, `condition.operator` 가 enum 밖 | `operations[i].condition is invalid` | validateConfig |
| `array_sort.order` 가 `asc`·`desc` 밖 | `operations[i].order must be "asc" or "desc"` | validateConfig |
| `object_pick`·`object_omit` 의 `keys` 가 비었거나 배열이 아님 | `operations[i].keys must be a non-empty array` | validateConfig |
| 표현식 문법 오류(`{{ }}` 파싱 실패) | 엔진 표현식 평가기의 throw 메시지 | 엔진 사전 평가 |

실행 중 무결성 실패(없는 필드, 타입 불일치, JSON 파싱 실패 등)는 에러가 아니라 **no-op** 으로 처리한다(원래 값을 두고 다음 연산으로). 사용자가 캔버스에서 바로 알아야 하는 설정 오류만 사전 검증 에러 대상이다.

## 에러 코드

위 사전 검증 에러 표를 본다. 런타임 에러 포트가 없으므로 `output.error` 표준 형태(Principle 3.2)를 쓰지 않는다.

## 캔버스 요약

[Data 노드 공통](CLE-NODE-DATA-COMMON.md) 캔버스 요약 표의 Transform 행(`{N} operations`)을 따른다. `operations` 가 비어 있으면 사전 검증 에러 표의 경고 규칙 메시지가 캔버스 배지로 보인다.

## 구현 위치

- `codebase/backend/src/nodes/data/transform/transform.handler.ts`
- `codebase/backend/src/nodes/data/transform/transform.schema.ts`
- `codebase/frontend/src/lib/transform/apply-operation.ts` (미리보기 계산)
- `codebase/frontend/src/types/transform.ts`

## Rationale

### 런타임 무결성 실패를 no-op 으로 처리

필드가 없거나 타입이 맞지 않는 경우를 에러로 멈추지 않고 건너뛴다. 사용자가 캔버스에서 바로 알아야 하는 설정 오류만 사전 검증 에러로 던진다. 건너뛴 연산 수는 `meta.operationsSkipped` 로 드러나므로 조용히 사라지지 않는다. 공통 배경은 [Data 노드 공통](CLE-NODE-DATA-COMMON.md) Rationale 에 있다.

### 사용자 정규식 검사 강화 (refactor 04 M-3)

정규식 길이 제한만으로는 지수 백트래킹 패턴을 막을 수 없다. 그래서 `compileUserRegex` 한 곳에서 `safe-regex` 위험 패턴 검사를 1차로, 200자 길이 제한을 2차로 적용한다. `array_filter` 의 `regex` 연산자와 `string_op.replace` 의 정규식 모드가 같은 헬퍼를 쓴다.
