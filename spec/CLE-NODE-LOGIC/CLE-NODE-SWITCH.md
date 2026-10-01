---
id: "CLE-NODE-SWITCH"
title: "Switch 노드"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-SWITCH-001", "REQ-SWITCH-002", "REQ-SWITCH-003", "REQ-SWITCH-004", "REQ-SWITCH-005", "REQ-SWITCH-006", "REQ-SWITCH-007", "REQ-SWITCH-008", "REQ-SWITCH-009", "REQ-SWITCH-010", "REQ-SWITCH-011", "REQ-SWITCH-012", "REQ-SWITCH-013", "REQ-SWITCH-014", "REQ-SWITCH-015", "REQ-SWITCH-016", "REQ-SWITCH-017", "REQ-SWITCH-018", "REQ-SWITCH-019", "REQ-SWITCH-020", "REQ-SWITCH-021", "REQ-SWITCH-022", "REQ-SWITCH-023", "REQ-SWITCH-024"]
basis_superseded: false
parent: "CLE-NODE-LOGIC"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-LOGIC"]
area: "CLE-NODE-LOGIC"
content_hash: "a9f1c614d3852b2239369d3804ebe6edaeafe5d53275ca06e5b34205da05389f"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/1-logic/2-switch.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "00eaa97df49d85e7f8b205e57b5c415f7a005f8fc3885c3b2f844c0534732f75"
etag: "sha256-569aa7a42a122f9fea514c0cf558fd601eb5fa47d0eca6ba41ecd1f2f13681d7"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/1-logic/2-switch.md`, `spec/4-nodes/_product-overview.md` (§4.2) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Switch 노드(Switch, `switch`)는 입력 값(`switchValue`)이나 케이스별 조건식을 평가해 케이스 포트와 `default` 포트 가운데 하나로 경로를 고르는 패스스루 노드다. 입력은 바꾸지 않고 매칭된 케이스 포트로 그대로 넘긴다. 케이스(case, `CaseDef`) 포트는 동적 포트이고 `config.cases[].id` 가 그대로 포트 ID 가 된다.

이 문서는 Switch 노드의 설정, 케이스 포트 ID 규칙, 실행 로직, 출력 구조, 에러를 정한다. 조건 구조·비교 연산자·정규식 안전 컴파일·동적 포트 ID 불변성·패스스루 규약은 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md) 이 정한다. 동적 포트 ID 의 전체 생성·검증 규칙은 [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md) 가, 노드 출력 5필드의 일반 규칙은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이 정한다.

## 요구사항

- REQ-SWITCH-001 WHEN Switch 노드가 실행되면 THE SYSTEM SHALL 입력 값에 따라 N개의 케이스 경로 가운데 하나로 경로를 선택한다. (원본: ND-SW-01)
- REQ-SWITCH-002 WHEN 사용자가 케이스를 설정하면 THE SYSTEM SHALL 케이스마다 값 매칭(`mode=value`) 또는 조건식(`mode=expression`)을 설정할 수 있게 한다. (원본: ND-SW-02)
- REQ-SWITCH-003 WHEN 어느 케이스도 매칭되지 않고 `hasDefault` 가 `false` 가 아니면 THE SYSTEM SHALL 입력을 `default` 경로로 보낸다. (원본: ND-SW-03)
- REQ-SWITCH-004 WHEN 사용자가 케이스를 추가하거나 지우면 THE SYSTEM SHALL 케이스마다 출력 포트를 하나씩 동적으로 만들거나 없앤다. (원본: ND-SW-04)
- REQ-SWITCH-005 WHEN `mode` 가 `value` 면 THE SYSTEM SHALL `cases` 를 순서대로 돌며 `switchValue` 와 `cases[].value` 를 비교하고 처음 매칭된 케이스를 쓴다.
- REQ-SWITCH-006 WHEN `mode=value` 에서 케이스에 `valueType` 이 있으면 THE SYSTEM SHALL 비교 전에 `case.value` 를 그 타입으로 바꾸고 바꾸지 못하면 원래 값을 쓴다.
- REQ-SWITCH-007 WHEN `strictComparison` 이 `true` 면 THE SYSTEM SHALL `===` 로, 아니면 `==` 로 비교한다.
- REQ-SWITCH-008 WHEN `mode` 가 `expression` 이면 THE SYSTEM SHALL `cases` 를 순서대로 돌며 `case.condition` 을 입력에 대해 평가하고 처음 참이 된 케이스를 쓴다.
- REQ-SWITCH-009 WHEN `mode=expression` 의 케이스가 `regex` 연산자를 쓰면 THE SYSTEM SHALL 케이스마다 정규식을 미리 컴파일하고 컴파일하지 못한 패턴의 케이스는 `false` 로 평가한다.
- REQ-SWITCH-010 WHEN 경로를 선택하면 THE SYSTEM SHALL 입력을 바꾸지 않고 그대로 `output` 에 복사한다.
- REQ-SWITCH-011 IF 어느 케이스도 매칭되지 않고 `hasDefault === false` 면 THE SYSTEM SHALL `No matching case found and no default case configured` 에러를 던져 실행을 실패시킨다.
- REQ-SWITCH-012 WHEN 케이스 포트를 만들면 THE SYSTEM SHALL `config.cases[].id` 를 그대로 출력 포트 ID 로 쓴다.
- REQ-SWITCH-013 IF 케이스 id 가 `^[a-zA-Z0-9_-]+$` 형식이 아니거나 64자를 넘으면 THE SYSTEM SHALL 스키마 단계에서 거부한다.
- REQ-SWITCH-014 IF 같은 노드 안에 케이스 id 가 중복되면 THE SYSTEM SHALL `validateSwitchConfig` 에서 거부한다.
- REQ-SWITCH-015 IF 케이스 id 가 `default`, `out`, `error` 가운데 하나면 THE SYSTEM SHALL `validateSwitchConfig` 에서 예약 포트 이름으로 거부한다.
- REQ-SWITCH-016 WHEN 사용자가 케이스를 추가·삭제·재정렬하면 THE SYSTEM SHALL 기존 케이스 id 를 바꾸지 않아 연결된 연결선을 유지한다.
- REQ-SWITCH-017 IF 케이스 id 가 비었거나 없으면 THE SYSTEM SHALL 백엔드 포트 resolver 에서 `case_${index}` 형태의 대체 id 를 발행한다.
- REQ-SWITCH-018 WHEN 경로를 선택하면 THE SYSTEM SHALL `meta.matchedCase`, `meta.matchedCaseLabel`, `meta.matchedCaseIndex` 와 `mode=value` 일 때의 `meta.resolvedValue` 를 싣는다.
- REQ-SWITCH-019 WHEN 노드 출력을 만들면 THE SYSTEM SHALL `config.switchValue` 를 평가 전 원래 형태로 싣고 평가한 값은 `meta.resolvedValue` 에만 싣는다.
- REQ-SWITCH-020 IF `mode=value` 인데 `switchValue` 가 없거나 공백뿐이면 THE SYSTEM SHALL 캔버스에 경고 배지를 표시하고 `handler.validate` 에서 거부한다.
- REQ-SWITCH-021 IF `cases` 가 빈 배열이거나 배열이 아니면 THE SYSTEM SHALL 캔버스에 경고 배지를 표시하고 `handler.validate` 에서 거부한다.
- REQ-SWITCH-022 IF `mode=expression` 인데 케이스에 `condition` 이 없으면 THE SYSTEM SHALL `validateSwitchConfig` 에서 거부한다.
- REQ-SWITCH-023 WHEN `switchValue` 필드를 표시하면 THE SYSTEM SHALL `mode` 가 `value` 일 때만 필수 표시(asterisk)를 붙인다.
- REQ-SWITCH-024 WHEN Switch 노드를 정의하면 THE SYSTEM SHALL 런타임 에러 포트를 두지 않는다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| mode | `value` / `expression` | | `value` | `value` 는 `switchValue` 와 `cases[].value` 를 직접 비교한다. `expression` 은 `cases[].condition` 을 입력에 대해 평가한다 |
| switchValue | Expression | `mode=value` 일 때 ✓ | `''` | 비교 기준 값. 표현식은 핸들러에 들어가기 전에 원시값으로 평가된다. 화면의 필수 표시는 `ui.requiredWhen: { field: 'mode', equals: ['value'] }` 화이트리스트로 정한다([Rationale](#rationale)) |
| cases | `CaseDef[]` | ✓ | `[]` | 케이스 목록(1개 이상). 순서대로 평가하고 처음 매칭된 케이스를 쓴다 |
| hasDefault | Boolean | | 스키마 `false` / 핸들러 동작 `true` | `default` 포트 사용 여부. 스키마 기본값은 `false` 지만 핸들러는 `hasDefault !== false` 로 확인하므로 명시적으로 `false` 를 두지 않는 한 `default` 로 보낸다([실행 로직](#실행-로직)) |
| strictComparison | Boolean | | `false` | 엄격 비교 모드(`===` / `!==`). 타입 변환 규칙은 [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) 의 strict 모드 절 |

**케이스 구조** (`cases[i]`):

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | String (slug) | ✓ | 케이스 고유 ID. 포트 ID 로 그대로 쓴다. `^[a-zA-Z0-9_-]+$` (최대 64자)만 허용한다. 같은 `cases` 안에서 중복될 수 없다 |
| label | String | | 캔버스와 화면에 보이는 케이스 이름. 포트 경로 선택에는 쓰지 않는다 |
| value | unknown | `mode=value` 일 때 권장 | 매칭 값. 원시값(문자열·숫자·불리언) 또는 표현식 결과 |
| valueType | `string` / `number` / `boolean` | | `mode=value` 에서 `value` 가 문자열일 때 비교 전에 타입을 바꾼다. `'42'` 에 `valueType=number` 면 `42` 가 된다(NaN 이면 원래 값 유지) |
| condition | `Condition` | `mode=expression` 일 때 ✓ | 조건식. 구조는 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#조건-구조) |

코드 기준: `codebase/backend/src/nodes/logic/switch/switch.schema.ts` (export `switchNodeConfigSchema`, `caseDefSchema`)

## 설정 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|--------------|------|
| 모드 | 맨 위 | `Mode` 드롭다운(`Value` / `Expression`) | `mode` 를 바꾼다 |
| 기준 값 | 모드 아래 | `Switch Value` 표현식 입력(예 `{{ $input.user.role }}`) | `switchValue` 를 편집한다 |
| 케이스 카드 | "Cases" 제목 아래, 케이스마다 한 장 | `Label` 입력, `Value` 입력, 삭제 `[×]` | 케이스 하나를 편집하거나 지운다. `mode=expression` 이면 `Value` 입력이 `Condition` (condition-builder 위젯)으로 바뀐다 |
| 케이스 추가 | 카드 목록 아래 | `[+ Add Case]` 버튼 | 케이스를 하나 더한다 |
| 옵션 | 맨 아래 | `Has Default` 체크박스, `Strict Comparison` 체크박스 | `hasDefault`, `strictComparison` 을 켜고 끈다 |

## 포트

| 방향 | id | label | type | dynamic | 설명 |
|------|------|-------|------|---------|------|
| 입력 | `in` | Input | data | false | 평가 대상 데이터(1개 필수). `mode=expression` 에서 `condition.field` 표현식의 평가 대상이다 |
| 출력 | `<case.id>` | `<case.label>` | data | **true** | `config.cases[i]` 마다 하나씩 만든다. 매칭되면 입력을 그대로 넘긴다 |
| 출력 | `default` | Default | data | false | 정적 포트. 매칭되지 않고 `hasDefault !== false` 일 때 입력을 그대로 넘긴다 |

### 케이스 포트 ID 규칙

1. `config.cases[].id` 가 그대로 출력 포트 ID 가 된다([Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#동적-포트-id-불변성)).
2. id 는 slug 형식 `^[a-zA-Z0-9_-]+$`, 최대 64자여야 한다(스키마 `caseDefSchema.id`). 공백·특수문자·HTML 엔티티는 스키마 단계에서 막히므로 경로 선택 키를 주입할 수 없다.
3. 같은 노드 안에서 케이스 id 는 중복될 수 없다(`validateSwitchConfig` 가 거부).
4. `default`, `out`, `error` 는 케이스 id 로 쓸 수 없다. 백엔드 `validateSwitchConfig` 의 `RESERVED_CASE_IDS` 집합이 거부한다(`switch.schema.ts:148,163-166`). 스키마 정규식은 문법(slug)만 검사하고 의미 충돌은 이 명령형 검증이 막는다. 예약어 집합은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 과 정의가 갈린다. [미결 사항](#미결-사항) 참조.
5. 케이스를 추가·삭제·재정렬해도 기존 케이스 id(곧 포트 ID)는 바뀌지 않으므로 연결된 연결선이 유지된다.
6. id 가 비었거나 없으면 백엔드 포트 resolver 가 `case_${index}` 형태의 대체 id 를 발행한다. 이것은 긴급 우회 경로이고 [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md) 와 사용자 입력 모두 명시적인 stable id 를 쓰기를 권한다.

## 실행 로직

1. `mode` 를 정한다(기본 `value`).
2. **`mode=value`**: `cases` 를 차례로 돈다.
   - `valueType` 으로 `case.value` 를 바꾼다(`coerceCaseValue`: number 는 `Number()`, boolean 은 `'true'`/`'false'` 매칭, 실패하면 원래 값 유지).
   - `strictComparison=true` 면 `===`, 아니면 `==` 로 `switchValue` 와 비교한다.
   - 처음 매칭된 케이스를 골라 `port: <case.id>` 로 반환한다.
3. **`mode=expression`**: `regex` 연산자를 쓰는 케이스의 정규식을 케이스마다 `compileRegexCache` (단일 헬퍼 `compileUserRegex`)로 미리 컴파일한다. 컴파일하지 못한 패턴의 케이스는 `false` 다([Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#비교-연산자)). 그다음 `cases` 를 차례로 돌며 `evaluateCondition(input, case.condition, { strict, regex })` 를 평가하고 처음 참이 된 케이스를 골라 `port: <case.id>` 로 반환한다. If/Else 와 같은 평가 경로이므로 `regex` 연산자가 제대로 동작한다.
4. 매칭되지 않으면:
   - `hasDefault !== false` (곧 `true` 이거나 설정 없음)면 `port: 'default'` 로 반환한다.
   - `hasDefault === false` 면 `'No matching case found and no default case configured'` 에러를 던진다.
5. 어느 경로든 `output = input` 이다([Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#패스스루-규약)).

스키마 기본값 `hasDefault.default = false` 와 핸들러의 `hasDefault !== false` 확인은 서로 다르다. 그래서 사용자가 화면에서 토글을 끄지 않는 한 `default` 경로로 간다. 이 차이는 의도한 하위 호환 동작이고 단위 테스트(`falls through to default when hasDefault is omitted`)가 지킨다.

## 출력 구조

Switch 는 경로만 고르는 패스스루 노드라서 출력 케이스가 케이스 매칭과 `default` 대체 두 가지다. 매칭 실패에 `hasDefault=false` 인 경우는 런타임 에러이고 별도 출력 케이스가 없다. JSON 예시는 `undefined` 필드를 생략했고 5필드 밖의 최상위 키는 쓰지 않는다.

### 케이스 매칭 (`port: <case.id>`)

```json
{
  "config": {
    "mode": "value",
    "switchValue": "{{ $input.user.role }}",
    "cases": [
      { "id": "case_admin", "label": "Admin", "value": "admin" },
      { "id": "case_guest", "label": "Guest", "value": "guest" }
    ]
  },
  "output": { "user": { "role": "admin", "name": "Alice" } },
  "meta": {
    "durationMs": 0,
    "mode": "value",
    "matchedCase": "case_admin",
    "matchedCaseLabel": "Admin",
    "matchedCaseIndex": 0,
    "resolvedValue": "admin"
  },
  "port": "case_admin"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.mode` | `'value'` / `'expression'` | 설정 에코 | 매칭 모드(기본 `value`) |
| `config.switchValue` | unknown | 설정 에코 | 원래 형태. 사용자가 `{{ $input.user.role }}` 로 입력했으면 그대로 남는다. 평가한 값은 `meta.resolvedValue` 에 있다 |
| `config.cases` | `CaseDef[]` | 설정 에코 | 사용자가 입력한 원래 케이스 목록. 케이스의 `value` / `condition` 도 원래 형태로 남는다 |
| `output` | 입력 전체 | 런타임, 패스스루 | 입력 데이터 그대로. `output.view` / `output.type` 같은 판별자는 쓰지 않는다 |
| `meta.durationMs` | number | 엔진 주입 | 실행 시간(ms). 엔진이 모든 노드에 주입한다 |
| `meta.mode` | `'value'` / `'expression'` | 핸들러 반환 | 기본값을 적용한 뒤의 모드 |
| `meta.matchedCase` | string | 핸들러 반환 | 매칭된 케이스 id |
| `meta.matchedCaseLabel` | string \| undefined | 핸들러 반환 | 매칭된 케이스의 `label`. 없으면 `undefined` |
| `meta.matchedCaseIndex` | number | 핸들러 반환 | `config.cases` 안의 매칭 인덱스(0부터). `default` 대체면 `-1` |
| `meta.resolvedValue` | unknown | 핸들러 반환 | `mode=value` 일 때만 평가한 `switchValue`. `mode=expression` 에서는 생략한다 |
| `port` | `<case.id>` | 핸들러 반환 | 매칭된 케이스의 동적 포트 ID |

표현식 접근 예:

- `$node["X"].output.user.name` → `"Alice"` (패스스루)
- `$node["X"].port` → `"case_admin"`
- `$node["X"].meta.matchedCase` → `"case_admin"`
- `$node["X"].meta.matchedCaseLabel` → `"Admin"`
- `$node["X"].meta.matchedCaseIndex` → `0`
- `$node["X"].meta.resolvedValue` → `"admin"` (`mode=value` 일 때 평가한 `switchValue`)
- `$node["X"].config.switchValue` → `"{{ $input.user.role }}"` (원래 템플릿)

`meta.value` 라는 별칭 필드는 없다.

### 매칭 실패와 `default` 대체 (`port: 'default'`)

```json
{
  "config": {
    "mode": "value",
    "switchValue": "{{ $input.user.role }}",
    "cases": [
      { "id": "case_admin", "label": "Admin", "value": "admin" },
      { "id": "case_guest", "label": "Guest", "value": "guest" }
    ],
    "hasDefault": true
  },
  "output": { "user": { "role": "viewer", "name": "Charlie" } },
  "meta": {
    "durationMs": 0,
    "mode": "value",
    "matchedCase": "default",
    "matchedCaseIndex": -1,
    "resolvedValue": "viewer"
  },
  "port": "default"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | 케이스 매칭과 같음 + `hasDefault` | 설정 에코 | `hasDefault: true` 도 싣는다 |
| `output` | 입력 전체 | 런타임, 패스스루 | 입력 데이터 그대로 |
| `meta.matchedCase` | `'default'` | 핸들러 반환 | 매칭 실패 때의 고정 문자열 |
| `meta.matchedCaseLabel` | `undefined` | 핸들러 반환 | `default` 대체 때는 항상 `undefined` (전용 label 없음) |
| `meta.matchedCaseIndex` | `-1` | 핸들러 반환 | `default` 대체 표시 값 |
| `meta.resolvedValue` | unknown | 핸들러 반환 | `mode=value` 일 때 평가한 `switchValue`. `default` 대체여도 남긴다 |
| `port` | `'default'` | 핸들러 반환 | 정적 `default` 포트 |

표현식 접근 예:

- `$node["X"].output.user.name` → `"Charlie"` (패스스루)
- `$node["X"].port` → `"default"`
- `$node["X"].meta.matchedCase` → `"default"`
- `$node["X"].meta.matchedCaseIndex` → `-1`

## 에러

Switch 는 런타임 에러 포트가 없다. 검증 실패는 설정 검증 단계의 사전 검증 에러이고 런타임에 던지는 에러는 "매칭 실패 + `hasDefault=false`" 한 가지다. 이 에러에도 `error` 포트가 없어 엔진이 실행 실패로 표시한다. `mode=expression` 에서도 같은 에러를 던진다(단위 테스트 `throws when no condition matches and hasDefault=false`).

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `mode='value'` 인데 `switchValue` 없음 | `In Value mode, Switch Value must be entered.` (노드 경고 규칙 원문. 화면은 i18n 으로 한국어 표시) | 노드 경고 규칙(캔버스 배지) + `handler.validate` (`evaluateMetadataBlockingErrors`) |
| `cases` 가 빈 배열 | `At least one case must be added.` (노드 경고 규칙 원문) | 노드 경고 규칙(캔버스 배지) + `handler.validate` |
| `mode='value'` 인데 `switchValue` 가 공백뿐인 문자열(예 `'  '`) | `switchValue is required` | `handler.validate` (노드 경고 규칙이 잡지 못하는 공백 문자열을 보강) |
| `cases` 가 배열이 아님 | `cases must be a non-empty array` | `handler.validate` |
| `cases[i].id` 없음 / 빈 문자열 / 문자열 아님 | `cases[i].id is required and must be a string` | `validateSwitchConfig` |
| `cases[i].id` 가 slug 형식(`/^[a-zA-Z0-9_-]+$/`) 위반 또는 64자 초과 | zod 스키마 에러(`caseDefSchema.id`) | 스키마 파싱 |
| `cases[i].id` 중복 | `cases[i].id '<id>' is duplicated` | `validateSwitchConfig` |
| `cases[i].id` 가 예약 포트 이름(`default` / `out` / `error`) | `cases[i].id '<id>' is a reserved port name (default / out / error)` | `validateSwitchConfig` (`RESERVED_CASE_IDS`) |
| `cases[i].valueType` 이 enum 값이 아님 | `cases[i].valueType must be one of: string, number, boolean` | `validateSwitchConfig` |
| `mode='expression'` 인데 `cases[i].condition` 없음 | `cases[i].condition is required when mode is "expression"` | `validateSwitchConfig` |
| `mode` 가 `value` / `expression` 이 아님 | `mode must be "value" or "expression"` | `handler.validate` |
| `hasDefault` 가 불리언이 아님 | `hasDefault must be a boolean` | `handler.validate` |
| `strictComparison` 이 불리언이 아님 | `strictComparison must be a boolean` | `handler.validate` |
| **런타임**: 매칭 실패 + `hasDefault === false` | `No matching case found and no default case configured` | `handler.execute` 에서 던짐 |

## 설정 요약

- 형식: `{switchValue} → {N} cases`
- 예: `$input.type → 3 cases`
- 구현: `switch.schema.ts` 의 `summaryTemplate` (`'{{switchValue}} → {{cases.length}} cases'`).
- `switchValue` 가 없으면 `summaryTemplate.warnWhen` (`!switchValue`, 메시지 `Switch value not set`)으로 배지를 표시한다. 배지 표시 규칙은 [워크플로우 에디터와 캔버스](../CLE-WF/CLE-WF-EDITOR.md) 가 정한다. 새 경고 규칙의 기준은 `warningRules` 이고 `summaryTemplate.warnWhen` 은 하위 호환으로 남긴 것이다.

## 미결 사항

- **예약 케이스 id 집합** (warning): 이 문서는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 동적 포트 절을 인용하면서 예약어를 `default` / `out` / `error` 3개로 두고 백엔드 `validateSwitchConfig` 에서 거부한다. [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 은 예약어를 9개(`out`, `error`, `default`, `done`, `user_ended`, `max_turns`, `completed`, `fallback`, `continue`)로 두고 프론트엔드에서 거부한다고 적는다. [텍스트 분류기 노드](../CLE-NODE-AI/CLE-NODE-CLASSIFIER.md) 는 9개를 백엔드 스키마에서 거부한다. 케이스 id `done` 이 허용되는지가 갈린다. 공통 예약어 상수 하나로 모을지 노드별 예약어로 좁힐지 결정 필요.
- **케이스 id 누락 시 대체 id 와 검증 거부** (info): id 가 없으면 포트 resolver 는 `case_${index}` 를 발행하지만 `validateSwitchConfig` 는 같은 설정을 거부한다. 캔버스에는 포트가 보이는데 실행은 검증에서 실패하는 상태가 생길 수 있다. 대체 id 를 쓰는 경로(캔버스 표시, AI 어시스턴트 조립)를 명시해야 한다.

## 구현 위치

- `codebase/backend/src/nodes/logic/switch/switch.*.ts`

## Rationale

### `switchValue` 필수 표시를 화이트리스트로 둔다

`switchValue` 의 필수 표시(asterisk)는 `ui.requiredWhen: { field: 'mode', equals: ['value'] }` 화이트리스트로 구현한다.

블랙리스트(`notEquals: 'expression'`)를 쓰지 않는 이유가 있다. `mode` enum 에 새 값(예: `'range'`, `'literal'`)이 추가되면 블랙리스트는 새 모드에도 자동으로 적용된다. 그러면 의도와 달리 필수 표시가 붙는 숨은 결합이 생긴다. 화이트리스트는 새 모드마다 명시적으로 넣어야 하므로 이 결합이 없다.

`requiredWhen` DSL 은 단일 형태 `{ field, equals: T | readonly T[] }` 로 단순화했다. `equals` 가 값 하나면 동등 비교, 배열이면 화이트리스트(`.includes()`)로 평가한다.

이 정리는 `requiredWhen` DSL 에 한정한다. `visibleWhen` DSL 은 `notEquals` / `oneOf` 형태를 당분간 유지한다. `ai-agent.schema.ts:151` 같은 사용처가 있어서다. `visibleWhen` 정리는 별도 후속 작업이다.

### 새 모드를 추가할 때의 순서

`mode` enum 에 새 값(예: `'range'`)을 추가할 때는 다음 순서를 따른다.

1. `mode: z.enum([...])` 에 값을 추가한다.
2. 새 모드에서 `switchValue` 가 필요하면 `switchValue.requiredWhen.equals` 배열에 넣는다(예: `['value', 'range']`).
3. 새 모드에서 `switchValue` 가 필요 없으면 배열을 그대로 둔다(자동 제외).
4. 노드 경고 규칙의 `when` 식도 화이트리스트 의미와 맞는지 검토한다. 지금의 `'mode != expression && !switchValue'` 는 블랙리스트라서 새 모드를 추가하면 의도와 다르게 경고가 뜰 수 있다. `visibleWhen` 정리 때 함께 처리한다.
5. `visibleWhen` 의 모드 의존 설정도 같은 방식을 적용할지 검토한다. 이것도 별도 후속 작업으로 추적한다.

### 그 밖의 설계 결정

- `meta.value` 별칭은 없앴다. 기존 워크플로우 표현식은 마이그레이션 스크립트(`codebase/backend/src/scripts/migrate-node-output-refs.ts` 의 `RENAMED_META_FIELDS.switch`)가 `meta.resolvedValue` 로 바꿨다.
- `meta.switchPath` 는 두지 않는다. `switchValue` 가 원래 표현식 그대로 `config` 에 실리므로 따로 둘 가치가 낮다.
- `config.strictComparison` 은 현재 구현이 실제로 쓰므로 유지한다.
- 매칭 실패에 `hasDefault=false` 일 때 에러를 던지는 것은 비즈니스 로직 실패가 아니라 설정 실패로 분류한다. 그래서 에러 포트로 보내지 않고 사전 검증 에러와 같은 분류로 실패시킨다.
