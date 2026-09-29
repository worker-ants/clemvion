---
id: "CLE-NODE-VARDECL"
title: "변수 선언 노드"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-VARDECL-001", "REQ-VARDECL-002", "REQ-VARDECL-003", "REQ-VARDECL-004", "REQ-VARDECL-005", "REQ-VARDECL-006", "REQ-VARDECL-007", "REQ-VARDECL-008", "REQ-VARDECL-009", "REQ-VARDECL-010", "REQ-VARDECL-011", "REQ-VARDECL-012", "REQ-VARDECL-013", "REQ-VARDECL-014", "REQ-VARDECL-015", "REQ-VARDECL-016", "REQ-VARDECL-017", "REQ-VARDECL-018"]
basis_superseded: false
parent: "CLE-NODE-LOGIC"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-LOGIC"]
area: "CLE-NODE-LOGIC"
content_hash: "3e782bd0b40039bac1e9b198bcc3b77ae2eb281b052610605dda4a491bd3d9c9"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/1-logic/4-variable-declaration.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "5543ac2baefb1f78270a9f11d75ec15c7b064b3a011f1a486e720ee1ed8335d6"
etag: "sha256-38ff329eaee53c52f5df85bf091325df49c29baa87184d9d955590473805760a"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/1-logic/4-variable-declaration.md`, `spec/4-nodes/_product-overview.md` (§4.4) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

변수 선언 노드(Variable Declaration, `variable_declaration`)는 실행 컨텍스트의 워크플로우 변수(`context.variables`)에 변수를 등록하는 패스스루 노드다. 입력은 바꾸지 않고 단일 출력 포트로 그대로 넘긴다. 변수 등록은 `context.variables` 에 대한 부수 효과로 일어나고 등록한 값은 뒤 노드 표현식에서 `{{ $var.<name> }}` 으로 읽는다. 캔버스 표시 이름은 "Variable" 이다.

핵심 동작은 이미 같은 이름의 변수가 있으면 덮어쓰지 않는다는 것이다. 값을 다시 초기화하려면 [변수 수정 노드](CLE-NODE-VARSET.md) 의 `set` 을 쓴다.

이 문서는 변수 선언 노드의 설정, 타입 변환, 포트, 실행 로직, 출력 구조, 에러를 정한다. 시스템 예약 변수(`__` 접두)의 정의와 3계층 강제 규칙은 [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md) 가 정하고 이 문서는 그 강제가 이 노드에서 내는 에러만 적는다. 패스스루 규약은 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md), `$var` 표현식은 [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) 가 정한다.

## 요구사항

- REQ-VARDECL-001 WHEN 변수 선언 노드가 실행되면 THE SYSTEM SHALL 설정한 변수를 워크플로우 실행 컨텍스트(`context.variables`)에 등록한다. (원본: ND-VD-01)
- REQ-VARDECL-002 WHEN 사용자가 변수를 정의하면 THE SYSTEM SHALL 변수마다 이름, 타입, 초기값을 설정할 수 있게 한다. (원본: ND-VD-02)
- REQ-VARDECL-003 WHEN 사용자가 변수 타입을 고르면 THE SYSTEM SHALL `string`, `number`, `boolean`, `array`, `object` 다섯 타입을 제공한다. (원본: ND-VD-03)
- REQ-VARDECL-004 WHEN 변수를 등록하면 THE SYSTEM SHALL 뒤 노드가 `{{ $var.<name> }}` 표현식으로 그 값을 읽을 수 있게 한다. (원본: ND-VD-04)
- REQ-VARDECL-005 IF 같은 이름의 변수가 이미 등록돼 있으면 THE SYSTEM SHALL 새 초기값으로 덮어쓰지 않고 건너뛴 뒤 그 이름을 `meta.skipped` 에 싣는다.
- REQ-VARDECL-006 WHEN 변수를 등록하면 THE SYSTEM SHALL `defaultValue ?? null` 을 `coerceToType` 으로 선언 타입에 맞춰 바꾼 뒤 저장한다.
- REQ-VARDECL-007 IF `defaultValue` 가 없거나 `null` / `undefined` 면 THE SYSTEM SHALL 변수 값을 `null` 로 저장한다.
- REQ-VARDECL-008 IF `number` / `boolean` 타입 변환이 실패하면 THE SYSTEM SHALL 에러를 던지지 않고 `null` 을 저장하고 그 항목을 `meta.coercionWarnings` 에 싣는다.
- REQ-VARDECL-009 IF `array` / `object` 타입 변환이 실패하면 THE SYSTEM SHALL 원래 값을 그대로 저장하고 `meta.coercionWarnings` 에 싣지 않는다.
- REQ-VARDECL-010 WHEN 변수 등록을 마치면 THE SYSTEM SHALL 입력을 바꾸지 않고 `out` 포트로 넘긴다.
- REQ-VARDECL-011 WHEN 노드 출력을 만들면 THE SYSTEM SHALL `config.variables` 를 `context.rawConfig` 의 원래 형태로 싣고 평가한 값은 `context.variables` 에만 저장한다.
- REQ-VARDECL-012 WHEN 변수를 새로 등록하면 THE SYSTEM SHALL 이번 실행에서 등록한 이름을 `meta.declared` 에 싣는다.
- REQ-VARDECL-013 IF `variables` 가 빈 배열이면 THE SYSTEM SHALL 캔버스에 경고 배지를 표시하고 `handler.validate` 에서 거부한다.
- REQ-VARDECL-014 IF 첫 번째 변수 이름이 빈 문자열이면 THE SYSTEM SHALL 캔버스에 경고 배지를 표시한다.
- REQ-VARDECL-015 IF `variables` 가 배열이 아니거나 `variables[i].name` · `variables[i].type` 이 문자열이 아니면 THE SYSTEM SHALL 사전 검증 에러로 실행을 실패시킨다.
- REQ-VARDECL-016 IF 변수 이름이 리터럴 `__` 접두로 시작하면 THE SYSTEM SHALL 워크플로우 저장 때 400 `RESERVED_VARIABLE_NAME` 으로 거부하고 사전 검증에서도 `INVALID_NODE_CONFIG` 로 거부한다.
- REQ-VARDECL-017 IF 변수 이름이 표현식으로 평가된 뒤 `__` 접두로 시작하면 THE SYSTEM SHALL `handler.execute` 에서 `RESERVED_VARIABLE_NAME` 에러를 던진다.
- REQ-VARDECL-018 WHEN 변수 선언 노드를 정의하면 THE SYSTEM SHALL 에러 포트와 동적 포트를 두지 않는다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| variables | `VarDef[]` | ✓ | `[]` | 선언할 변수 목록(1개 이상). 순서대로 등록한다. 같은 이름 변수가 이미 있으면 건너뛴다 |

**변수 정의 구조** (`variables[i]`):

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| name | String | ✓ | `''` | 변수 이름. 뒤 노드 표현식에서 `$var.<name>` 으로 읽는다. 워크플로우 안에서 고유하게 짓기를 권한다. `__` (밑줄 두 개) 접두는 쓸 수 없다. 엔진 시스템 예약 네임스페이스다([실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md)). `{{ }}` 표현식으로 지정한 이름도 평가한 뒤 검사한다([에러](#에러)) |
| type | `string` / `number` / `boolean` / `array` / `object` | ✓ | `'string'` | 초기값 타입. `coerceToType` 으로 `defaultValue` 를 이 타입에 맞춘다 |
| defaultValue | unknown | | (없음) | 초기값. 원래 형태이고 `{{ }}` 표현식을 쓸 수 있다. 없거나 `null` / `undefined` 면 항상 `null` 로 저장한다 |

코드 기준: `codebase/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts` (export `variableDeclarationNodeConfigSchema`, `varDefSchema`), `codebase/backend/src/modules/execution-engine/utils/coerce-type.ts`

### 타입 변환 (`coerceToType`)

| 입력 | 결과 |
|------|------|
| `defaultValue` 가 이미 `type` 과 같음 | 그대로 저장 |
| 문자열, `type='number'` | `Number()` 로 변환. 실패(`NaN`)하면 `null` |
| 문자열, `type='boolean'` | `'true'` / `'false'` 매칭. 그 밖이면 `null` |
| 문자열, `type='array'` | `'['` 로 시작하면 `JSON.parse` 를 시도하고 결과가 배열이면 그 값. 파싱에 실패하거나 `'['` 로 시작하지 않으면 원래 값을 그대로 반환(`null` 아님) |
| 문자열, `type='object'` | `'{'` 로 시작하면 `JSON.parse` 를 시도하고 결과가 객체면 그 값. 파싱에 실패하거나 `'{'` 로 시작하지 않으면 원래 값을 그대로 반환(`null` 아님) |

1. 변환 실패는 조용히 넘어간다. 사용자 의도와 다른 값이 저장돼도 에러를 던지지 않는다.
2. 실패했을 때 `null` 로 바뀌는 것은 `number` / `boolean` 뿐이다. `array` / `object` 는 원래 값을 지킨다. 그래서 `meta.coercionWarnings` 는 `number` / `boolean` 변환 실패만 잡는다.

## 설정 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|--------------|------|
| 변수 카드 | "Variables" 제목 아래, 변수마다 한 장 | `Name` 입력(예 `counter`), `Type` 드롭다운(예 `number`), `Default` 입력(예 `0`), 삭제 `[×]` | 변수 하나를 편집하거나 지운다 |
| 변수 추가 | 카드 목록 아래 | `[+ Add Variable]` 버튼 | 변수 카드를 하나 더한다 |

`Default` 입력은 표현식 위젯이고 `{{ }}` 템플릿을 받는다(예: `{{ $today }}`). 평가는 핸들러에 들어가기 직전에 표현식 resolver 가 한다.

## 포트

| 방향 | id | label | type | dynamic | 설명 |
|------|------|-------|------|---------|------|
| 입력 | `in` | Input | data | false | 메인 흐름 입력(1개). 바꾸지 않고 `out` 으로 넘긴다 |
| 출력 | `out` | Output | data | false | 입력을 그대로 넘긴다. 변수 등록은 `context.variables` 에 대한 부수 효과라서 `output` 과 무관하다 |

변수 선언 노드는 동적 포트가 없다(단일 출력).

## 실행 로직

1. `config.variables` 를 차례로 돌며 변수마다 다음을 한다.
   - `context.variables[variable.name]` 이 `undefined` 일 때만 등록한다. 이미 있으면 건너뛴다.
   - `defaultValue ?? null` 을 `coerceToType(raw, variable.type)` 으로 바꿔 저장한다.
2. 입력은 바꾸지 않고 그대로 `output` 에 복사한다([Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#패스스루-규약)).
3. `config` 에는 `context.rawConfig` 의 `variables` 를 싣는다. 그래서 `defaultValue` 의 `{{ }}` 템플릿이 남는다. 핸들러는 평가한 `config.variables` 로 동작하지만 응답의 `config.variables` 는 원래 형태를 유지한다. `context.rawConfig` 는 [실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md) 가 정한다.
4. 등록한 값은 뒤 노드 표현식에서 `{{ $var.<name> }}` 으로 읽는다.

## 출력 구조

변수 선언 노드는 단일 출력 패스스루 노드라서 정상 케이스 하나뿐이다(경로 선택·에러 포트 없음). 검증 실패는 대부분 사전 검증 에러지만 예약 `__` 이름을 평가한 뒤 검사하는 경우만 실행 중에 에러를 던진다([에러](#에러)). JSON 예시는 `undefined` 필드를 생략했고 5필드 밖의 최상위 키는 쓰지 않는다.

### 정상 (단일 출력 `out`)

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
| `config.variables` | `VarDef[]` | 설정 에코 | 사용자가 입력한 원래 변수 정의. `defaultValue` 의 `{{ }}` 템플릿을 남긴다. 평가한 값은 `context.variables` 에만 저장하고 `output` 에 싣지 않는다 |
| `output` | 입력 전체 | 런타임, 패스스루 | 입력 데이터 그대로. `output.view` / `output.type` 같은 판별자는 쓰지 않는다 |
| `meta.durationMs` | number | 엔진 주입 | 실행 시간(ms). 엔진이 모든 노드에 주입한다 |
| `meta.declared` | string[] | 런타임 메트릭 | 이번 실행에서 새로 등록한 변수 이름(건너뛰지 않은 항목). 이미 있으면 건너뛰는 동작을 보여 준다 |
| `meta.skipped` | string[] | 런타임 메트릭 | 같은 이름 변수가 이미 있어 등록을 건너뛴 변수 이름. 의도한 초기화가 조용히 빠진 경우를 진단할 때 쓴다 |
| `meta.coercionWarnings` | `Array<{ name: string, attemptedType: string, error?: string }>` | 런타임 메트릭 | `coerceToType` 이 조용히 `null` 로 바꾼 항목. 핸들러는 `raw !== null && coerced === null` 일 때만 넣는다. 그래서 `number` (`Number()` 가 `NaN`) / `boolean` 변환 실패만 잡힌다. `array` / `object` 는 실패하면 원래 값을 반환하므로 여기에 들어가지 않는다. `defaultValue` 를 두지 않아 `null` 로 저장한 경우도 의도한 초기화라서 들어가지 않는다 |
| `port` | `undefined` | 없음 | 단일 출력이라 설정하지 않는다 |

표현식 접근 예:

- `$node["X"].output.user.name` → `"Alice"` (패스스루)
- `$node["X"].config.variables[0].name` → `"counter"` (설정 에코)
- `$node["X"].config.variables[2].defaultValue` → `"{{ $today }}"` (원래 템플릿)
- `$node["X"].meta.declared` → `["counter","users","today"]` (이번 실행에 등록한 변수)
- `$node["X"].meta.coercionWarnings[0].name` → 변환에 실패한 첫 변수 이름
- `$var.counter` → `0` (등록한 변수 값)
- `$var.users` → `[]` (JSON 문자열을 배열로 바꾼 값)
- `$var.today` → `"2026-05-10"` (표현식 resolver 가 평가한 값)

## 에러

변수 선언 노드는 에러 포트가 없다. 검증 실패는 대부분 설정 검증 단계의 사전 검증 에러이고 예외는 예약 이름을 런타임에 검사하는 경우 하나다(아래 표의 시점 열). 노드 경고 규칙 메시지는 영문 원문이 기준이고(`variable-declaration.schema.ts` 의 `warningRules[].message`), 한국어는 프론트엔드 i18n(`WARNING_KO`)이 렌더링한다.

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `variables` 가 빈 배열 | `At least one variable must be defined.` | 노드 경고 규칙(캔버스 배지) + `handler.validate` (`evaluateMetadataBlockingErrors`) |
| `variables[0].name` 이 빈 문자열 | `First variable's name must be entered.` | 노드 경고 규칙(캔버스 배지) |
| `variables` 가 배열이 아님(원시 fixture · zod 우회) | `variables must be an array` | `handler.validate` |
| `variables[i].name` 없음 / 문자열 아님 | `variables[i].name is required and must be a string` | `validateVariableDeclarationConfig` |
| `variables[i].type` 없음 / 문자열 아님 | `variables[i].type is required and must be a string` | `validateVariableDeclarationConfig` |
| `variables[i].type` 이 enum 밖(`string`/`number`/`boolean`/`array`/`object` 외) | zod 스키마 에러(`varDefSchema.type`) | 스키마 파싱 |
| `variables[i].name` 이 리터럴 `__` 접두 | `variables[i].name must not start with reserved prefix "__"` | **L0** 저장 시점(`WorkflowsService.saveCanvas` / `importWorkflow` → 400 `RESERVED_VARIABLE_NAME`) + **L1** `validateVariableDeclarationConfig` (→ `INVALID_NODE_CONFIG`) |
| `variables[i].name` 이 평가 뒤 `__` 접두(`{{ }}` 표현식이 예약 이름으로 평가됨) | `RESERVED_VARIABLE_NAME: variables[i].name resolved to "…", which starts with the reserved prefix "__"` | **L2** `handler.execute` (런타임. 예약 강제가 실제로 걸리는 지점) |

1. **예약 이름 강제**: `variables.__*` 는 엔진 시스템 네임스페이스라 사용자 변수로 쓸 수 없다. 이름 필드는 표현식 대상이라 저장·사전 검증 검사(L0/L1)는 리터럴만 잡는다. 표현식으로 만들어지는 예약 이름은 `handler.execute` (L2)가 평가한 뒤 잡는다. 계층 정의는 [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md) 가 정한다.
2. **조용한 대체**: `type='number'` / `type='boolean'` 에서 `defaultValue` 변환이 실패하면 `null` 을 저장한다(예: `type='number'` 에 `defaultValue='abc'`). 에러는 던지지 않지만 `meta.coercionWarnings` 에 항목이 추가된다. `type='array'` / `type='object'` 는 변환에 실패하면 원래 값을 저장하고 `coercionWarnings` 에도 잡히지 않는다.
3. **조용한 건너뛰기**: 같은 이름 변수가 이미 있으면 새 `defaultValue` 를 무시한다(덮어쓰기 금지). 건너뛴 항목은 `meta.skipped` 에서 볼 수 있다. 다시 초기화하려면 [변수 수정 노드](CLE-NODE-VARSET.md) 의 `set` 을 쓴다.

## 설정 요약

- 형식: 선언한 변수 이름을 쉼표로 나열한다(최대 3개, 넘으면 `+N`).
- 예: `counter, total, +1`
- 현재 구현은 `variable-declaration.schema.ts` 에 `summaryTemplate` 이 없어 캔버스에 이 요약을 표시하지 않는다. [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#미결-사항) 참조.

## 구현 위치

- `codebase/backend/src/nodes/logic/variable-declaration/variable-declaration.*.ts`
- `codebase/backend/src/modules/execution-engine/utils/coerce-type.ts` (`coerceToType`)
- `codebase/backend/src/nodes/logic/_shared/reserved-variable-name.util.ts` (예약 이름 검사)

## Rationale

### 예약 이름 강제는 호환성을 깨는 변경이었다

`__` 접두 변수 이름을 거부하면서 이전에 `__foo` 변수를 저장한 워크플로우는 다시 저장할 때 400 을 받거나 실행 때 에러를 던지게 됐다. 이런 변수는 그 전에도 입력 대기 뒤 재개할 때 `filterUserVariables` 가 걸러 내 보이지 않게 사라지던, 반쯤 깨진 상태였다.
