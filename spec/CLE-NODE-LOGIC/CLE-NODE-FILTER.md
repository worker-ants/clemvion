---
id: "CLE-NODE-FILTER"
title: "Filter 노드"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-FILTER-001", "REQ-FILTER-002", "REQ-FILTER-003", "REQ-FILTER-004", "REQ-FILTER-005", "REQ-FILTER-006", "REQ-FILTER-007", "REQ-FILTER-008", "REQ-FILTER-009", "REQ-FILTER-010", "REQ-FILTER-011", "REQ-FILTER-012", "REQ-FILTER-013", "REQ-FILTER-014", "REQ-FILTER-015", "REQ-FILTER-016", "REQ-FILTER-017"]
basis_superseded: false
parent: "CLE-NODE-LOGIC"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-LOGIC"]
area: "CLE-NODE-LOGIC"
content_hash: "a9811ebdc41ba95ef326832ce838416c45a30b024125c7805ae3db5922ffb947"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/1-logic/8-filter.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "23693ad0a173d3514f4852abe1ec069c00ecdc33f06d9f02801cfa7ea5a3f44f"
etag: "sha256-995c19f05053a6869fcca2a00a29d1c65b768aede9b278cce3d5ec81d103f5fc"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/1-logic/8-filter.md`, `spec/4-nodes/_product-overview.md` (§4.8) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Filter 노드(Filter, `filter`)는 배열을 조건에 따라 두 묶음으로 나누는 노드다. 입력 배열의 항목마다 조건을 평가해 맞는 항목은 `match` 포트로, 맞지 않는 항목은 `unmatched` 포트로 동시에 보낸다. Map 이 변환을 맡는다면 Filter 는 부분집합 분리를 맡는다.

Filter 는 패스스루 노드가 아니다. If/Else · Switch 같은 패스스루 노드는 입력을 바꾸지 않고 한 포트로 흘려보내지만 Filter 는 데이터를 바꾸는 노드다. `output.match` / `output.unmatched` 는 입력 배열의 부분집합이지 입력 자체가 아니다.

[Transform 노드](../CLE-NODE-DATA/CLE-NODE-TRANSFORM.md) 의 `array_filter` 와도 다르다. `array_filter` 는 변환 체인 안에서 특정 필드의 배열을 간단한 조건식으로 거르는 인라인 연산이다. Filter 노드는 워크플로우 흐름의 독립 노드로 여러 조건과 조건 결합(AND/OR)을 지원하고 맞는 항목과 맞지 않는 항목을 두 포트로 동시에 보낸다.

이 문서는 Filter 노드의 설정, 항목별 표현식 컨텍스트, 포트, 실행 로직, 출력 구조, 에러를 정한다. 조건 구조·비교 연산자·정규식 안전 컴파일은 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md) 이 정한다.

## 요구사항

- REQ-FILTER-001 WHEN Filter 노드가 실행되면 THE SYSTEM SHALL 입력 배열의 항목마다 조건을 평가해 맞는 항목과 맞지 않는 항목으로 나눈다. (원본: ND-FL-01)
- REQ-FILTER-002 WHEN 사용자가 조건을 설정하면 THE SYSTEM SHALL 여러 조건(`Condition[]`)과 `combineMode` (AND/OR) 결합을 지원한다. (원본: ND-FL-02)
- REQ-FILTER-003 WHEN 항목 분리가 끝나면 THE SYSTEM SHALL 맞는 항목을 `match` 포트로, 맞지 않는 항목을 `unmatched` 포트로 동시에 보낸다. (원본: ND-FL-03)
- REQ-FILTER-004 WHEN 항목마다 조건을 평가하면 THE SYSTEM SHALL `$item` 과 `$itemIndex` 를 표현식 컨텍스트에 묶고 워크플로우 전역 컨텍스트(`$input`, `$var`, `$node["..."]`)도 그대로 물려준다. (원본: ND-FL-04)
- REQ-FILTER-005 WHEN `strictComparison` 이 `true` 면 THE SYSTEM SHALL 타입 변환 없이 엄격 비교로 조건을 평가한다. (원본: ND-FL-05)
- REQ-FILTER-006 WHEN `condition.field` 가 비었거나 `'$item'` 이면 THE SYSTEM SHALL 항목 자체를 비교 대상으로 쓴다.
- REQ-FILTER-007 WHEN `condition.field` 가 dot-path 문자열이면 THE SYSTEM SHALL 항목에서 그 경로의 값을 읽어 비교한다.
- REQ-FILTER-008 WHEN 항목을 나누면 THE SYSTEM SHALL 입력 순서를 지킨다.
- REQ-FILTER-009 IF `inputField` 로 읽은 값이 `null` 이나 `undefined` 면 THE SYSTEM SHALL `[]` 로 대체해 `match: []`, `unmatched: []` 를 내보내고 `meta.fellBackToEmpty` 를 `true` 로 둔다.
- REQ-FILTER-010 IF `inputField` 로 읽은 값이 문자열·숫자·객체처럼 배열이 아니면 THE SYSTEM SHALL `Filter inputField does not resolve to an array` 에러를 던진다.
- REQ-FILTER-011 IF `regex` 패턴을 컴파일하지 못하면 THE SYSTEM SHALL 그 조건을 `false` 로 평가하고 패턴을 중복 없이 `meta.invalidRegexPatterns` 에 싣는다.
- REQ-FILTER-012 WHEN 결과를 내보내면 THE SYSTEM SHALL `meta.matchedCount`, `meta.unmatchedCount`, `meta.totalCount` 를 싣는다.
- REQ-FILTER-013 WHEN 결과를 내보내면 THE SYSTEM SHALL `port` 를 반환하지 않고 `match` 와 `unmatched` 두 포트를 모두 활성화한다.
- REQ-FILTER-014 IF `inputField` 가 빈 문자열이거나 없으면 THE SYSTEM SHALL 캔버스에 경고 배지를 표시하고 `handler.validate` 에서 거부한다.
- REQ-FILTER-015 IF `conditions` 가 빈 배열이거나 없으면 THE SYSTEM SHALL 캔버스에 경고 배지를 표시하고 `handler.validate` 에서 거부한다.
- REQ-FILTER-016 IF `conditions[i].field` 가 문자열이 아니거나 `operator` 가 enum 값이 아니거나 `combineMode` 가 `and`/`or` 가 아니면 THE SYSTEM SHALL 사전 검증 에러로 실행을 실패시킨다.
- REQ-FILTER-017 WHEN Filter 노드를 정의하면 THE SYSTEM SHALL 런타임 에러 포트와 동적 포트를 두지 않는다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| inputField | Expression | ✓ | `''` | 대상 배열. dot-path 문자열(`"items"`, `"order.items"`)이면 `$input` 에 적용한다. `{{ $var.a }}` 같은 inline 표현식이면 표현식 resolver 가 평가한 값(배열)을 그대로 쓴다 |
| conditions | `Condition[]` | ✓ | `[]` | 필터 조건 목록. 구조는 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#조건-구조). `condition.field` 표현식 안에서 `$item` / `$itemIndex` 로 현재 항목과 인덱스를 읽는다 |
| combineMode | `and` / `or` | ✓ | `and` | 조건끼리의 결합 방식 |
| strictComparison | Boolean | | `false` | 엄격 비교 모드. 타입 변환 규칙은 [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) 의 strict 모드 절 |

지원 연산자는 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#비교-연산자) 이 정한다.

**`condition.field` 작성 규칙**:

| `field` 값 | 뜻 |
|------------|------|
| `undefined` / `''` / `'$item'` | 항목 자체와 비교한다(스칼라 배열 `[1, 2, 3]` 등) |
| `'name'`, `'user.profile.age'` | 항목에서 dot-path 로 값을 읽는다 |
| `'{{ $item.<key> }}'` 등 | 인라인 표현식. 항목별 컨텍스트(`$item`, `$itemIndex`)로 평가한다. 워크플로우 컨텍스트(`$var`, `$input` 등)도 물려받는다 |

코드 기준: `codebase/backend/src/nodes/logic/filter/filter.schema.ts` (export `filterNodeConfigSchema`, `validateFilterConfig`)

## 설정 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|--------------|------|
| 배열 필드 | 맨 위 | `Array Field` 입력(예 `$input.items`) | `inputField` 를 편집한다 |
| 결합 방식 | "Conditions" 제목 옆 | `AND` / `OR` 드롭다운 | `combineMode` 를 바꾼다 |
| 조건 카드 | 제목 아래, 조건마다 한 장 | 필드 표현식 입력(예 `{{ $item.status }}`), 연산자 드롭다운(예 equals), 비교 값 입력(예 `"active"`), 삭제 `[×]` | 조건 하나를 편집하거나 지운다 |
| 조건 추가 | 카드 목록 아래 | `[+ Add Condition]` 버튼 | 조건 카드를 하나 더한다 |
| 엄격 비교 | 맨 아래 | `Strict type comparison` 체크박스 | `strictComparison` 을 켜고 끈다 |

## 포트

| 방향 | id | label | type | dynamic | 설명 |
|------|------|-------|------|---------|------|
| 입력 | `in` | Input | data | false | 평가 대상 데이터(1개 필수). `inputField` 로 읽을 배열이 들어 있다 |
| 출력 | `match` | Match | data | false | 조건에 맞는 항목 배열. 다음 노드는 `$node["X"].output.match` 를 입력으로 받는다 |
| 출력 | `unmatched` | Unmatched | data | false | 조건에 맞지 않는 항목 배열. 다음 노드는 `$node["X"].output.unmatched` 를 입력으로 받는다 |

**두 포트 동시 활성화**: Filter 는 `port` 를 반환하지 않는다. 두 포트의 연결선을 모두 따라가고 각 연결선은 `output.match` / `output.unmatched` 하위 키를 다음 노드 입력으로 넘긴다. 이 표현 방식은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 `port` 활성화 모델과 어긋난다. [미결 사항](#미결-사항) 참조.

## 실행 로직

**항목별 표현식 컨텍스트**: 조건을 평가할 때 배열 항목마다 다음 변수를 묶는다. 워크플로우 전역 컨텍스트(`$input`, `$var`, `$node["..."]`)는 그대로 물려받는다.

| 변수 | 타입 | 설명 |
|------|------|------|
| `$item` | 현재 항목 | 평가 중인 배열 원소 |
| `$itemIndex` | number (0부터) | 현재 항목의 배열 인덱스 |

**실행 단계**:

1. `inputField` 로 배열을 꺼낸다.
   - 문자열이면 `$input` 에서 dot-path 로 읽는다(`getNestedValue`).
   - 인라인 표현식 평가가 끝난 배열 값이면 그 값을 그대로 쓴다.
2. 배열이 아니면 나눠서 처리한다.
   - `null` / `undefined` 는 `[]` 로 대체하고 `meta.fellBackToEmpty: true` 로 표시한다.
   - 그 밖의 비배열(문자열·숫자·객체)은 `Filter inputField does not resolve to an array` 에러를 던진다. 이 동작은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 빈 입력 절과 같다.
3. 항목마다 `$item` / `$itemIndex` 를 표현식 컨텍스트에 묶는다.
4. 조건마다 `field` / `value` 를 `evaluateResolvedCondition` (`condition-eval.util.ts`)으로 평가한다.
   - `field` 가 비었거나 `$item` 이면 항목 자체, 표현식이면 평가 결과, 그 밖이면 dot-path 로 읽은 값을 쓴다.
   - `value` 가 표현식이면 평가하고 그 밖이면 리터럴로 쓴다.
   - `regex` 연산자는 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#비교-연산자) 의 안전 컴파일을 따른다. 거부한 패턴은 조건을 `false` 로 평가하고 패턴마다 캐싱하며 `meta.invalidRegexPatterns` 로 드러낸다.
5. `combineMode === 'or'` 면 `some`, `'and'` (기본)면 `every` 로 결합한다.
6. 맞는 항목은 `match`, 맞지 않는 항목은 `unmatched` 배열에 넣는다(입력 순서 유지).
7. 빈 입력 배열(`[]`)은 `match: [], unmatched: []` 로 정상 출력한다.

## 출력 구조

Filter 는 한 케이스로 두 포트 결과를 동시에 낸다. 빈 배열·전체 매칭·전체 불매칭은 같은 출력 형태의 특수 값일 뿐이라 케이스를 나누지 않는다. JSON 예시는 `undefined` 필드를 생략했고 5필드 밖의 최상위 키는 쓰지 않는다.

### 정상 분리 (두 포트 동시 활성화)

```json
{
  "config": {
    "inputField": "items",
    "conditions": [
      { "field": "{{ $item.status }}", "operator": "eq", "value": "active" }
    ],
    "combineMode": "and",
    "strictComparison": false
  },
  "output": {
    "match": [
      { "name": "Alice", "status": "active" },
      { "name": "Charlie", "status": "active" }
    ],
    "unmatched": [
      { "name": "Bob", "status": "inactive" }
    ]
  },
  "meta": {
    "durationMs": 0,
    "matchedCount": 2,
    "unmatchedCount": 1,
    "totalCount": 3,
    "fellBackToEmpty": false,
    "invalidRegexPatterns": []
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.inputField` | Expression \| 평가된 배열 | 설정 에코 | 사용자가 입력한 원래 값. 인라인 표현식이면 평가 전 형태를 싣는다. `context.rawConfig.inputField` 를 먼저 쓴다 |
| `config.conditions` | `Condition[]` | 설정 에코 | 원래 조건. `field` / `value` 의 `{{ }}` 을 남긴다 |
| `config.combineMode` | `'and'` / `'or'` | 설정 에코 | 기본 `'and'` |
| `config.strictComparison` | boolean | 설정 에코 | 기본 `false` |
| `output.match` | Array | 핸들러 반환 | 조건에 맞는 항목 배열(입력 순서 유지). 빈 배열일 수 있다 |
| `output.unmatched` | Array | 핸들러 반환 | 조건에 맞지 않는 항목 배열(입력 순서 유지). 빈 배열일 수 있다 |
| `meta.durationMs` | number | 엔진 주입 | 실행 시간(ms). 엔진이 모든 노드에 주입한다 |
| `meta.matchedCount` | number | 핸들러 반환 | `output.match.length`. O(1) 개수 |
| `meta.unmatchedCount` | number | 핸들러 반환 | `output.unmatched.length`. O(1) 개수 |
| `meta.totalCount` | number | 핸들러 반환 | `matchedCount + unmatchedCount`. 대체 때는 `0` |
| `meta.fellBackToEmpty` | boolean | 핸들러 반환 | `inputField` 가 `null` / `undefined` 로 해석돼 `[]` 로 대체했으면 `true`. 실제 빈 배열 입력은 `false` 로 구분한다 |
| `meta.invalidRegexPatterns` | string[] | 핸들러 반환 | 컴파일 실패·길이 초과·위험 패턴이라 `false` 로 평가한 패턴 목록. 문제가 없으면 `[]`. 같은 패턴은 한 번만 싣는다 |

`port` 필드는 없다. Filter 는 `port` 를 반환하지 않고 `match` / `unmatched` 두 포트를 모두 활성화한다. 다음 노드는 `output.match` / `output.unmatched` 하위 키로 나뉜 데이터를 받는다.

표현식 접근 예:

- `$node["X"].output.match` → `[{ name: "Alice", ... }, ...]`
- `$node["X"].output.unmatched` → `[{ name: "Bob", ... }, ...]`
- `$node["X"].meta.matchedCount` → 맞는 항목 수(`output.match.length` 와 같음)
- `$node["X"].meta.fellBackToEmpty` → `inputField` 의 `null` / `undefined` 대체 여부
- `$node["X"].config.conditions` → 원래 조건(표현식 보존)

**특수 값 동작**:

| 입력 | `output.match` | `output.unmatched` |
|------|----------------|---------------------|
| `[]` (빈 배열) | `[]` | `[]` |
| 모든 항목이 맞음 | 입력 그대로 | `[]` |
| 모든 항목이 맞지 않음 | `[]` | 입력 그대로 |

## 에러

Filter 는 런타임 에러 포트가 없다. 설정 검증 실패는 사전 검증 에러다. 노드 경고 규칙 메시지는 영문 원문이 기준이고 캔버스는 프론트엔드 i18n 으로 한국어를 렌더링한다.

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `inputField` 가 빈 문자열 / 없음 | `Input field must be entered.` | 노드 경고 규칙(캔버스 배지) + `handler.validate` |
| `conditions` 가 빈 배열 / 없음 | `At least one condition must be added.` | 노드 경고 규칙(캔버스 배지) + `handler.validate` |
| `conditions[i].field` 가 문자열이 아님 | `conditions[i].field must be a string` | `handler.validate` (필드 누락·빈 문자열·`'$item'` 은 항목 자체를 뜻하므로 허용) |
| `conditions[i].operator` 가 enum 값이 아님 | `conditions[i].operator must be one of: eq, neq, …` | `handler.validate` |
| `combineMode` 가 `and`/`or` 가 아님 | `combineMode must be "and" or "or"` | `handler.validate` |
| `inputField` 해석 결과가 배열이 아님(문자열·숫자·객체) | `Filter inputField does not resolve to an array` | 실행 중(런타임 에러) |
| `inputField` 해석 결과가 `null` / `undefined` | (에러 없음) `output.match: [], output.unmatched: []` + `meta.fellBackToEmpty: true` | 실행 중(빈 입력 대체) |

정규식 실패는 조건을 `false` 로 평가하고 넘어가지만 그 패턴은 `meta.invalidRegexPatterns` 에 쌓여 다음 노드가 패턴 문제를 알아챌 수 있다(같은 패턴은 한 번만).

## 설정 요약

- 형식: `{inputField} · {N} conditions · {combineMode}`. 조건이 1개면 `combineMode` 를 뺀다.
- 예: `$input.items · 2 conditions · AND`
- 현재 구현은 `filter.schema.ts` 에 `summaryTemplate` 이 없어 캔버스에 이 요약을 표시하지 않는다. [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#미결-사항) 참조.

## 미결 사항

- **출력 포트 2개인데 `port` 를 반환하지 않는다** (info): [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 `port` 활성화 모델은 `port: undefined` 를 출력 포트가 1개인 노드의 기본 출력으로 정하고 여러 포트를 함께 활성화할 때는 `port: string[]` 로 표현하라고 한다. Filter 는 출력이 2개인데 `port` 없이 두 포트를 모두 활성화한다. 엔진의 그래프 순회 규칙으로 보면 Filter 에서 되돌아가는 연결선을 걸면 늘 활성화된다. 규약에 "모든 출력 포트 활성화" 형태를 더할지 Filter 를 `port: ['match', 'unmatched']` 로 표현할지 결정 필요. (관련: [실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md))

## 구현 위치

- `codebase/backend/src/nodes/logic/filter/filter.*.ts`
- `codebase/backend/src/nodes/logic/_shared/condition-eval.util.ts` (`evaluateResolvedCondition`)

## Rationale

### 배열 아닌 입력은 종류에 따라 다르게 처리한다

`null` / `undefined` 는 값이 아직 없는 경우라 빈 배열로 본다. 문자열·숫자·객체처럼 타입이 어긋난 입력은 명백한 사용자 실수로 보고 에러를 던진다. [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 빈 입력 절이 Filter 의 이 동작을 유지한다고 적었다.
