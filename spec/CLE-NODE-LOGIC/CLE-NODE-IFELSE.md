---
id: "CLE-NODE-IFELSE"
title: "If/Else 노드"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-IFELSE-001", "REQ-IFELSE-002", "REQ-IFELSE-003", "REQ-IFELSE-004", "REQ-IFELSE-005", "REQ-IFELSE-006", "REQ-IFELSE-007", "REQ-IFELSE-008", "REQ-IFELSE-009", "REQ-IFELSE-010", "REQ-IFELSE-011", "REQ-IFELSE-012", "REQ-IFELSE-013", "REQ-IFELSE-014", "REQ-IFELSE-015"]
basis_superseded: false
parent: "CLE-NODE-LOGIC"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-LOGIC"]
area: "CLE-NODE-LOGIC"
content_hash: "20b66085b7730d6ebf630d4b6936a9e09b05136b97888618a15ea59e03ad7149"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/1-logic/1-if-else.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "08d251925105f35630bb07592144f8a45642694fdb7fa15cfe2572a7f78144bd"
etag: "sha256-dbaaf779a4784db0d5728cf6eb9886c791b1188c20876ea664d5a7fce8fb251c"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/1-logic/1-if-else.md`, `spec/4-nodes/_product-overview.md` (§4.1) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

If/Else 노드(If/Else, `if_else`)는 조건식을 평가해 `true` / `false` 두 포트 가운데 하나로 경로를 고르는 패스스루 노드다. 입력은 바꾸지 않고 고른 포트로 그대로 넘긴다.

이 문서는 If/Else 노드의 설정, 포트, 실행 로직, 출력 구조, 에러를 정한다. 조건 구조·비교 연산자·정규식 안전 컴파일·패스스루 규약은 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md) 이 정한다. 조건 안의 표현식 문법과 엄격 비교의 타입 변환은 [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) 가, 노드 출력 5필드의 일반 규칙은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이 정한다.

## 요구사항

- REQ-IFELSE-001 WHEN If/Else 노드가 실행되면 THE SYSTEM SHALL 조건식을 평가해 `true` 포트나 `false` 포트 가운데 하나로 경로를 선택한다. (원본: ND-IF-01)
- REQ-IFELSE-002 WHEN 사용자가 조건을 설정하면 THE SYSTEM SHALL `eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `contains`, `starts_with`, `ends_with` 를 비롯한 공통 비교 연산자를 제공한다. (원본: ND-IF-02)
- REQ-IFELSE-003 WHEN 조건이 여러 개면 THE SYSTEM SHALL `combineMode` 로 결과를 결합한다(`and` 는 모두 참일 때 참, `or` 는 하나라도 참이면 참). (원본: ND-IF-03)
- REQ-IFELSE-004 WHEN If/Else 노드를 배치하면 THE SYSTEM SHALL 출력 포트를 `true` 와 `false` 두 개로 제공한다. (원본: ND-IF-04)
- REQ-IFELSE-005 WHEN 사용자가 `condition.field` 나 `condition.value` 에 표현식을 쓰면 THE SYSTEM SHALL 이전 노드 출력 필드를 참조해 평가한다. (원본: ND-IF-05)
- REQ-IFELSE-006 WHEN 경로를 선택하면 THE SYSTEM SHALL 입력을 바꾸지 않고 그대로 `output` 에 복사한다.
- REQ-IFELSE-007 WHEN `strictComparison` 이 `true` 면 THE SYSTEM SHALL 타입 변환 없이 엄격 비교로 조건을 평가한다.
- REQ-IFELSE-008 WHEN 조건이 `regex` 연산자를 쓰면 THE SYSTEM SHALL `compileRegexCache` 로 조건마다 정규식을 미리 컴파일해 평가기에 넘긴다.
- REQ-IFELSE-009 IF `regex` 패턴이 문법 에러이거나 200자를 넘거나 `safe-regex` 위험 패턴이면 THE SYSTEM SHALL 컴파일을 건너뛰고 그 조건을 `false` 로 평가한다.
- REQ-IFELSE-010 WHEN 조건이 `is_type` 연산자를 쓰면 THE SYSTEM SHALL 비교 값이 `string` / `number` / `boolean` / `object` / `array` / `null` / `undefined` 가운데 하나일 때만 타입을 확인하고 그 밖의 값이면 `false` 로 평가한다.
- REQ-IFELSE-011 WHEN 평가가 끝나면 THE SYSTEM SHALL 최종 결과를 `meta.conditionResult` 에, 조건별 결과를 `meta.matchedConditions` 에 싣는다.
- REQ-IFELSE-012 IF `conditions` 가 빈 배열이면 THE SYSTEM SHALL 캔버스에 경고 배지를 표시하고 `handler.validate` 에서 실행을 거부한다.
- REQ-IFELSE-013 IF 첫 번째 조건의 `field` 가 빈 문자열이면 THE SYSTEM SHALL 캔버스에 경고 배지를 표시한다.
- REQ-IFELSE-014 IF `conditions[i].field` 가 없거나 `operator` 가 enum 값이 아니거나 `combineMode` 가 `and`/`or` 가 아니거나 `strictComparison` 이 불리언이 아니면 THE SYSTEM SHALL 사전 검증 에러로 실행을 실패시킨다.
- REQ-IFELSE-015 WHEN If/Else 노드를 정의하면 THE SYSTEM SHALL 런타임 에러 포트를 두지 않고 설정 검증 실패를 모두 사전 검증 에러로 처리한다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| conditions | `Condition[]` | ✓ | `[]` | 조건 목록. 구조는 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#조건-구조) |
| combineMode | `and` / `or` | ✓ | `and` | 조건끼리의 결합 방식 |
| strictComparison | Boolean | | `false` | 엄격 비교 모드. 타입 변환 규칙은 [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) 의 strict 모드 절 |

- 지원 연산자는 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#비교-연산자) 이 정한다.
- 표현식(`{{ }}`)은 `condition.field` 와 `condition.value` 에 쓸 수 있다.
- 코드 기준: `codebase/backend/src/nodes/logic/if-else/if-else.schema.ts` (export `ifElseConfigSchema`)

## 설정 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|--------------|------|
| 결합 방식 | 상단 "Conditions" 제목 옆 | `AND` / `OR` 드롭다운 | `combineMode` 를 바꾼다 |
| 조건 카드 | 제목 아래, 조건마다 한 장 | 필드 표현식 입력(예 `{{ $input.role }}`), 연산자 드롭다운(예 equals), 비교 값 입력(예 `"admin"`), 삭제 `[×]` | 조건 하나를 편집하거나 지운다 |
| 조건 추가 | 카드 목록 아래 | `[+ Add Condition]` 버튼 | 빈 조건 카드를 하나 더한다 |

## 포트

| 방향 | id | label | type | dynamic | 설명 |
|------|------|-------|------|---------|------|
| 입력 | `in` | Input | data | false | 평가 대상 데이터(1개 필수) |
| 출력 | `true` | True | data | false | 조건을 만족하면 입력을 그대로 넘긴다 |
| 출력 | `false` | False | data | false | 조건을 만족하지 않으면 입력을 그대로 넘긴다 |

If/Else 는 동적 포트가 없다.

## 실행 로직

1. 입력 데이터에 대해 모든 `conditions[i]` 를 `evaluateCondition` (`condition-evaluator.util.ts`)으로 평가한다. `strictComparison` 설정을 적용한다.
2. `combineMode` 에 따라 결과를 결합한다. `and` 는 모두 참일 때, `or` 는 하나라도 참일 때 참이다.
3. 결과가 참이면 `port: 'true'`, 거짓이면 `port: 'false'` 를 반환한다.
4. 입력은 바꾸지 않고 그대로 `output` 에 복사한다([Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#패스스루-규약) 의 패스스루 규약).

## 출력 구조

If/Else 는 경로만 고르는 패스스루 노드라서 출력 케이스가 참·거짓 두 가지뿐이다. 별도 에러 케이스는 없고 설정 검증 실패는 사전 검증 에러로 끝난다. JSON 예시는 `undefined` 필드를 생략했고 5필드(`config` / `output` / `meta?` / `port?` / `status?`) 밖의 최상위 키는 쓰지 않는다.

### 조건 만족 (`port: 'true'`)

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
| `config.conditions` | `Condition[]` | 설정 에코 | 사용자가 입력한 원래 조건. 표현식 `{{ }}` 을 그대로 남긴다 |
| `config.combineMode` | `'and'` / `'or'` | 설정 에코 | 결합 방식(기본 `and`) |
| `output` | 입력 전체 | 런타임, 패스스루 | 입력 데이터를 바꾸지 않고 담는다 |
| `meta.durationMs` | number | 엔진 주입 | 실행 시간(ms). 엔진이 모든 노드에 주입하므로 핸들러는 채우지 않는다 |
| `meta.conditionResult` | boolean | 핸들러 반환 | 조건 평가의 최종 결과. `port` 문자열을 비교하지 않고 불리언으로 읽을 수 있다 |
| `meta.matchedConditions` | Array | 핸들러 반환 | 조건마다의 평가 결과. `combineMode='or'` 일 때 어떤 조건이 참이었는지 확인하는 데 쓴다 |
| `port` | `'true'` | 핸들러 반환 | 조건 만족 경로 |

표현식 접근 예:

- `$node["X"].output.user.age` → `25` (패스스루)
- `$node["X"].port` → `"true"`
- `$node["X"].meta.conditionResult` → `true`

### 조건 불만족 (`port: 'false'`)

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
| `config.*` | 조건 만족 케이스와 같음 | 설정 에코 | |
| `output` | 입력 전체 | 런타임, 패스스루 | 입력 데이터 그대로 |
| `meta.conditionResult` | boolean | 핸들러 반환 | `false` |
| `port` | `'false'` | 핸들러 반환 | 조건 불만족 경로 |

표현식 접근 예:

- `$node["X"].output.user.age` → `15` (패스스루)
- `$node["X"].port` → `"false"`

## 에러

If/Else 는 런타임 에러 포트가 없다. 검증 실패는 모두 설정 검증 단계의 사전 검증 에러다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 에러 분류). 메시지는 영문 원문이 기준이다.

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `conditions` 가 빈 배열 | `At least one condition must be added.` | 노드 경고 규칙(캔버스 배지) + `handler.validate` |
| `conditions[0].field` 가 빈 문자열 | `First condition's field must be entered.` | 노드 경고 규칙(캔버스 배지) |
| `conditions[i].field` 누락 | `conditions[i].field is required and must be a string` | `handler.validate` |
| `conditions[i].operator` 가 enum 값이 아님 | `conditions[i].operator must be one of: eq, neq, …` | `handler.validate` |
| `combineMode` 가 `and`/`or` 가 아님 | `combineMode must be "and" or "or"` | `handler.validate` |
| `strictComparison` 이 불리언이 아님 | `strictComparison must be a boolean` | `handler.validate` |

## 설정 요약

- 형식: 첫 번째 조건의 `{field} {operator} {value}`. 조건이 2개 이상이면 `{combineMode}` 를 붙이고 뒤를 자른다.
- 예: `role == "admin" AND ...`
- 현재 구현은 `if-else.schema.ts` 에 `summaryTemplate` 이 없어 캔버스에 이 요약을 표시하지 않는다. [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#미결-사항) 참조.

## 구현 위치

- `codebase/backend/src/nodes/logic/if-else/if-else.*.ts`
- `codebase/backend/src/nodes/core/condition-evaluator.util.ts` (`evaluateCondition`, `compileRegexCache`)

## Rationale

### 패스스루로 둔다

If/Else 의 결과물은 입력을 바꾼 값이 아니라 경로가 나뉜 흐름이다. 그래서 입력은 그대로 넘기고 경로와 평가 결과만 `port` · `meta` 에 싣는다. 이 규약의 공통 근거는 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#rationale) 에 있다.
