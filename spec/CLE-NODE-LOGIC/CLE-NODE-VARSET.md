---
id: "CLE-NODE-VARSET"
title: "변수 수정 노드"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-VARSET-001", "REQ-VARSET-002", "REQ-VARSET-003", "REQ-VARSET-004", "REQ-VARSET-005", "REQ-VARSET-006", "REQ-VARSET-007", "REQ-VARSET-008", "REQ-VARSET-009", "REQ-VARSET-010", "REQ-VARSET-011", "REQ-VARSET-012", "REQ-VARSET-013", "REQ-VARSET-014", "REQ-VARSET-015", "REQ-VARSET-016", "REQ-VARSET-017", "REQ-VARSET-018", "REQ-VARSET-019", "REQ-VARSET-020", "REQ-VARSET-021"]
basis_superseded: false
parent: "CLE-NODE-LOGIC"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-LOGIC"]
area: "CLE-NODE-LOGIC"
content_hash: "7d41ceeedbf145979b6677ebd77e6216c9558991fb5b709839150ab00ac27424"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/1-logic/5-variable-modification.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "c7499fffc6945c269dd2e2fe588224ea7c1f684a134f0a751c5a6b7f8df3ef0f"
etag: "sha256-479d48ac3dd8ebf9ca305392e851e97ffbf40ce2a1aa9bb1d4e2e1fccac207a9"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/1-logic/5-variable-modification.md`, `spec/4-nodes/_product-overview.md` (§4.5) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

변수 수정 노드(Variable Modification, `variable_modification`)는 워크플로우 변수 저장소(`$var.*`)의 값을 바꾸는 패스스루 노드다. 부수 효과로 변수를 바꾸고 `modifications[]` 를 순서대로 적용한 뒤 입력은 바꾸지 않고 단일 `out` 포트로 그대로 넘긴다. 캔버스 표시 이름은 "Set Variable" 이다.

이 문서는 변수 수정 노드의 설정, 지원 연산, 포트, 실행 로직, 출력 구조, 값 기록과 마스킹, 에러를 정한다. 시스템 예약 변수(`__` 접두)의 정의와 3계층 강제 규칙은 [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md) 가 정하고 이 문서는 그 강제가 이 노드에서 내는 에러만 적는다. 변수를 처음 등록하는 규칙은 [변수 선언 노드](CLE-NODE-VARDECL.md), 패스스루 규약은 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md) 이 정한다.

## 요구사항

- REQ-VARSET-001 WHEN 변수 수정 노드가 실행되면 THE SYSTEM SHALL 대상 변수의 값을 설정한 연산으로 바꾼다. (원본: ND-VM-01)
- REQ-VARSET-002 WHEN 사용자가 수정 항목을 설정하면 THE SYSTEM SHALL 대상 변수를 드롭다운에서 고르거나 `{{ }}` 표현식으로 지정할 수 있게 한다. (원본: ND-VM-02)
- REQ-VARSET-003 WHEN 사용자가 새 값을 설정하면 THE SYSTEM SHALL 정적 값과 `{{ }}` 표현식을 모두 받는다. (원본: ND-VM-03)
- REQ-VARSET-004 WHEN 사용자가 연산을 고르면 THE SYSTEM SHALL `set`, `increment`, `decrement`, `append`, `push`, `pop` 여섯 연산을 제공한다. (원본: ND-VM-04)
- REQ-VARSET-005 WHEN 수정 항목이 여러 개면 THE SYSTEM SHALL 순서대로 적용해 앞 항목의 결과를 뒤 항목의 입력으로 쓴다.
- REQ-VARSET-006 WHEN 대상 변수가 아직 선언되지 않았으면 THE SYSTEM SHALL 변수 선언 노드 없이도 변수를 새로 만들고 그 이름을 `meta.createdVariables` 에 싣는다.
- REQ-VARSET-007 IF 현재 값의 타입이 연산과 맞지 않으면 THE SYSTEM SHALL 연산별 대체 규칙을 조용히 적용하고 그 항목을 `meta.coercionWarnings` 에 싣는다.
- REQ-VARSET-008 WHEN 연산이 `push` 나 `pop` 이면 THE SYSTEM SHALL 같은 배열 참조를 제자리에서 바꾼다.
- REQ-VARSET-009 WHEN 수정을 마치면 THE SYSTEM SHALL 입력을 바꾸지 않고 `out` 포트로 넘긴다.
- REQ-VARSET-010 WHEN 변수를 바꾸면 THE SYSTEM SHALL 같은 실행의 다른 노드가 `{{ $var.<name> }}` 으로 바뀐 값을 곧바로 읽을 수 있게 한다.
- REQ-VARSET-011 WHEN 노드 출력을 만들면 THE SYSTEM SHALL `config.modifications` 를 `context.rawConfig` 의 원래 형태로 싣는다.
- REQ-VARSET-012 WHEN 수정 항목을 적용하면 THE SYSTEM SHALL 항목마다 `variable`, `operation`, `applied` 를 `meta.modifications` 에 싣고 아무것도 바꾸지 않은 항목은 `applied=false` 로 둔다.
- REQ-VARSET-013 WHEN `recordValues` 가 `true` 면 THE SYSTEM SHALL `meta.modifications[i]` 에 마스킹한 `before` / `after` 값을 싣는다.
- REQ-VARSET-014 WHEN `recordValues` 가 설정되지 않았으면 THE SYSTEM SHALL `before` / `after` 값을 싣지 않는다.
- REQ-VARSET-015 WHEN `before` / `after` 값을 기록하면 THE SYSTEM SHALL 비밀 패턴 변수명은 `'***'`, 4096바이트 넘는 값은 `'[truncated:N bytes]'`, 함수·심볼은 `'[unsupported:...]'` 로 바꾼다.
- REQ-VARSET-016 IF `modifications` 가 빈 배열이면 THE SYSTEM SHALL 캔버스에 경고 배지를 표시하고 `handler.validate` 에서 거부한다.
- REQ-VARSET-017 IF 첫 번째 수정 항목의 대상 변수가 빈 문자열이면 THE SYSTEM SHALL 캔버스에 경고 배지를 표시한다.
- REQ-VARSET-018 IF `modifications` 가 배열이 아니거나 `variable` 이 문자열이 아니거나 `operation` 이 여섯 연산이 아니면 THE SYSTEM SHALL 사전 검증 에러로 실행을 실패시킨다.
- REQ-VARSET-019 IF 대상 변수 이름이 리터럴 `__` 접두로 시작하면 THE SYSTEM SHALL 워크플로우 저장 때 400 `RESERVED_VARIABLE_NAME` 으로 거부하고 사전 검증에서도 `INVALID_NODE_CONFIG` 로 거부한다.
- REQ-VARSET-020 IF 대상 변수 이름이 표현식으로 평가된 뒤 `__` 접두로 시작하면 THE SYSTEM SHALL 여섯 연산 모두에서 `handler.execute` 가 `RESERVED_VARIABLE_NAME` 에러를 던진다.
- REQ-VARSET-021 WHEN 변수 수정 노드를 정의하면 THE SYSTEM SHALL 에러 포트와 동적 포트를 두지 않는다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| modifications | `ModDef[]` | ✓ | `[]` | 적용할 변수 수정 목록. 순서대로 적용한다(앞 항목의 결과가 뒤 항목의 입력) |
| recordValues | Boolean | | `false` | `true` 면 `meta.modifications[i]` 에 `before` / `after` 값(마스킹 적용)을 싣는다. 큰 컬렉션 변수는 실행 로그를 키우고 사용자 데이터가 뜻하지 않게 드러날 수 있어 명시적으로 켜야 한다 |

**수정 항목 구조** (`modifications[i]`):

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| variable | String | ✓ | 대상 변수 이름. 선언하지 않은 변수도 곧바로 만든다(`variable_declaration` 없이 쓸 수 있다). `__` (밑줄 두 개) 접두는 쓸 수 없다. 엔진 시스템 예약 네임스페이스다([실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md)). `{{ }}` 표현식으로 지정한 이름도 평가한 뒤 검사한다([에러](#에러)) |
| operation | Enum | ✓ | 적용할 연산. [지원 연산](#지원-연산) 참조 |
| value | Expression | | 연산에 쓸 값. `{{ }}` 표현식을 쓸 수 있다. `pop`, `increment` (기본 1), `decrement` (기본 -1)에서는 생략할 수 있다 |

코드 기준: `codebase/backend/src/nodes/logic/variable-modification/variable-modification.schema.ts` (export `variableModificationNodeConfigSchema`). 화면 설정·노드 경고 규칙·`validateVariableModificationConfig` 는 프론트엔드 캔버스와 백엔드 `handler.validate` 가 함께 쓰는 단일 기준이다.

### 지원 연산

| 연산 | 적용 타입 | 동작 | 타입이 맞지 않을 때 |
|------|-----------|------|------------------------|
| `set` | 모든 타입 | 값을 덮어쓴다(`null` / `undefined` 도 설정 가능) | 없음 |
| `increment` | number | 현재 값에 `value` 를 더한다(기본 `+1`) | 현재 값이 number 가 아니면 `0` 으로 본다 |
| `decrement` | number | 현재 값에서 `value` 를 뺀다(기본 `-1`) | 현재 값이 number 가 아니면 `0` 으로 본다 |
| `append` | string | 문자열 뒤에 `value` 를 붙인다. `value` 가 문자열이 아니면 `JSON.stringify` 로 바꾼다(`null` / `undefined` 는 `''`) | 현재 값이 string 이 아니면 `''` 로 본다 |
| `push` | array | 배열 끝에 `value` 를 더한다(**제자리 변경**) | 현재 값이 array 가 아니면 `[value]` 로 덮어쓴다 |
| `pop` | array | 배열 끝 요소를 뺀다(**제자리 변경**) | 현재 값이 array 가 아니면 무시한다(변경 없음) |

`push` / `pop` 은 같은 배열 참조를 바꾼다. 다른 노드의 `output` 이나 다른 변수가 같은 배열 참조를 쥐고 있으면 조용히 함께 바뀌어 디버깅이 어렵다. 안전하게 바꾸려면 `set` 으로 새 배열을 넣는다.

## 설정 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|--------------|------|
| 수정 카드 | "Modifications" 제목 아래, 항목마다 한 장 | `Variable` 입력(예 `counter`), `Operation` 드롭다운(예 `increment`), `Value` 입력(예 `1`), 삭제 `[×]` | 수정 항목 하나를 편집하거나 지운다 |
| 항목 추가 | 카드 목록 아래 | `[+ Add Modification]` 버튼 | 수정 카드를 하나 더한다 |
| 값 기록 | 맨 아래 | `Record values in meta` 체크박스(before/after 값, 마스킹, 명시적 켜기) | `recordValues` 를 켜고 끈다 |

## 포트

| 방향 | id | label | type | dynamic | 설명 |
|------|------|-------|------|---------|------|
| 입력 | `in` | Input | data | false | 통과시킬 입력 데이터(1개 필수) |
| 출력 | `out` | Output | data | false | 입력을 바꾸지 않고 넘긴다 |

변수 수정 노드는 동적 포트가 없다(단일 출력).

## 실행 로직

1. **검증**: 스키마 노드 경고 규칙과 `validateVariableModificationConfig` 가 네 가지를 검사한다. 검사 항목은 `modifications` 가 비었는가, 첫 항목의 변수가 빠졌는가, 항목마다 `variable` 이 있는가, `operation` 이 허용 목록에 있는가다. 핸들러는 `modifications` 가 배열이 아닐 때만 따로 거부한다. 모두 사전 검증 에러다.
2. `modifications[]` 를 차례로 돌며 `applyModification` (`variable-modification.handler.ts`)을 부른다.
   - 현재 값(`context.variables[mod.variable]`)을 읽는다.
   - `mod.operation` 에 따라 [지원 연산](#지원-연산) 표의 동작을 적용한다. 타입이 맞지 않으면 대체 규칙을 조용히 적용한다.
   - 결과를 `context.variables[mod.variable]` 에 저장한다(`push` / `pop` 은 제자리 변경).
3. 입력은 바꾸지 않고 그대로 `output` 으로 넘긴다([Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#패스스루-규약)).
4. 바뀐 변수는 같은 실행 전체에서 `{{ $var.<name> }}` 표현식으로 읽을 수 있다. 다른 노드에서도 곧바로 반영된다.

## 출력 구조

변수 수정 노드는 단일 출력 패스스루 노드라서 정상 케이스 하나뿐이다(경로 선택·에러 포트 없음). 검증 실패는 대부분 사전 검증 에러지만 예약 `__` 이름을 평가한 뒤 검사하는 경우만 실행 중에 에러를 던진다([에러](#에러)). JSON 예시는 `undefined` 필드를 생략했고 5필드 밖의 최상위 키는 쓰지 않는다.

### 정상 (단일 출력)

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
| `config.modifications` | `ModDef[]` | 설정 에코 | 사용자가 입력한 원래 수정 목록. `value` 의 `{{ }}` 표현식을 평가 전 형태로 남긴다(`variable-modification.handler.ts` 가 `context.rawConfig.modifications` 를 싣는다) |
| `output` | 입력 전체 | 런타임, 패스스루 | 입력 데이터 그대로. 부수 효과는 `context.variables` 에만 생긴다 |
| `meta.durationMs` | number | 엔진 주입 | 실행 시간(ms). 모든 노드 공통이라 핸들러를 바꾸지 않아도 채워진다 |
| `meta.modifications` | `Array<{ variable: string, operation: string, applied: boolean, before?: unknown, after?: unknown }>` | 핸들러 | 적용한 수정 목록. `variable` 누락이나 배열 아닌 값에 `pop` 처럼 아무것도 바꾸지 않은 항목은 `applied=false` 다(실행 메트릭). `config.recordValues=true` 일 때만 `before` / `after` 가 붙는다. 마스킹 규칙은 아래 표 |
| `meta.coercionWarnings` | `Array<{ variable: string, operation: string, fromType: string, error?: string }>` | 핸들러 | 타입이 맞지 않아 대체 규칙을 쓴 항목(number 아닌 값에 `increment` → `0`, string 아닌 값에 `append` → `''`, array 아닌 값에 `push` / `pop`). 변수가 없어 처음 만든 경우는 경고 대상이 아니다 |
| `meta.createdVariables` | `string[]` | 핸들러 | 이 노드에서 선언 없이 처음 만든 변수 이름. 사용자 오타를 알아채는 데 쓴다 |
| `port` | 생략 | 없음 | 단일 출력이라 `undefined` |
| `status` | 생략 | 없음 | 블로킹하지 않는 노드라 `undefined` |

**`before` / `after` 마스킹** (`codebase/backend/src/nodes/logic/_shared/value-masking.util.ts`):

| 조건 | 기록 값 |
|------|---------|
| 변수 이름이 비밀 패턴(`password` / `token` / `apiKey` 등)에 맞음 | `'***'` |
| JSON 으로 바꾼 크기가 4096바이트를 넘음 | `'[truncated:N bytes]'` |
| 함수 · 심볼 | `'[unsupported:...]'` |
| 그 밖의 원시값 · 작은 컬렉션 | 깊은 복사로 보존(이후 제자리 변경과 무관) |

표현식 접근 예(노드 이름이 `"X"` 일 때):

- `$node["X"].output.user.name` → `"Alice"` (패스스루)
- `$node["X"].config.modifications[0].value` → `"{{ $delta }}"` (평가 전 원래 표현식)
- `$var.counter` → 평가한 `$delta` 만큼 늘어난 값(예: `5`)
- `$var.log` → `"...processing done"` (이전 값 + `" done"`)
- `$node["X"].meta.modifications[0].applied` → `true` (실제로 반영됨)
- `$node["X"].meta.coercionWarnings.length` → `0` (타입 불일치 대체 없음)

## 에러

변수 수정 노드는 에러 포트가 없다. 검증 실패는 대부분 설정 검증 단계의 사전 검증 에러이고 예외는 예약 이름을 런타임에 검사하는 경우 하나다(아래 표의 시점 열).

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `modifications` 가 빈 배열 | `At least one modification must be added.` | 노드 경고 규칙(캔버스 배지) + `handler.validate` |
| `modifications[0].variable` 이 빈 문자열 | `First modification's target variable must be selected.` | 노드 경고 규칙(캔버스 배지) |
| `modifications[i].variable` 없음 또는 문자열 아님 | `modifications[i].variable is required and must be a string` | `handler.validate` (`validateVariableModificationConfig`) |
| `modifications[i].operation` 이 허용 목록에 없음(임의 문자열) | `modifications[i].operation must be one of: set, increment, decrement, append, push, pop` | `handler.validate` |
| `modifications` 가 배열이 아님 | `modifications must be an array` | `handler.validate` |
| `modifications[i].variable` 이 리터럴 `__` 접두 | `modifications[i].variable must not start with reserved prefix "__"` | **L0** 저장 시점(`WorkflowsService.saveCanvas` / `importWorkflow` → 400 `RESERVED_VARIABLE_NAME`) + **L1** `validateVariableModificationConfig` (→ `INVALID_NODE_CONFIG`) |
| `modifications[i].variable` 이 평가 뒤 `__` 접두(`{{ }}` 표현식이 예약 이름으로 평가됨) | `RESERVED_VARIABLE_NAME: modifications[i].variable resolved to "…", which starts with the reserved prefix "__"` | **L2** `handler.execute` (런타임. 예약 강제가 실제로 걸리는 지점) |

1. **예약 이름 강제**: `variables.__*` 는 엔진 시스템 네임스페이스라 대상 변수로 쓸 수 없다. 이름 필드는 표현식 대상이라 저장·사전 검증 검사(L0/L1)는 리터럴만 잡는다. 표현식으로 만들어지는 예약 이름은 `handler.execute` (L2)가 평가한 뒤 잡는다. 여섯 연산이 모두 막힌다. 계층 정의는 [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md) 가 정한다.
2. 위 메시지는 기준이 되는 영문 원문이다(노드 경고 규칙은 `variable-modification.schema.ts` 의 `warningRules[].message`, `handler.validate` 는 `validateVariableModificationConfig` 반환 문자열). 캔버스에서는 프론트엔드 i18n(`codebase/frontend/src/lib/i18n/backend-labels.ts`)이 한국어로 렌더링한다. 예: "최소 1개 이상의 변경을 추가해야 합니다." / "첫 번째 변경의 대상 변수를 선택해야 합니다."

## 설정 요약

- 형식: `{variable} {operation}` (첫 번째 수정 항목 기준)
- 예: `counter increment`
- 현재 구현은 `variable-modification.schema.ts` 에 `summaryTemplate` 이 없어 캔버스에 이 요약을 표시하지 않는다. [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#미결-사항) 참조.

## 구현 위치

- `codebase/backend/src/nodes/logic/variable-modification/variable-modification.*.ts`
- `codebase/backend/src/nodes/logic/_shared/value-masking.util.ts` (`before` / `after` 마스킹)
- `codebase/backend/src/nodes/logic/_shared/reserved-variable-name.util.ts` (예약 이름 검사)

## Rationale

### 값 기록은 명시적으로 켠다

`recordValues` 기본값은 `false` 다. 큰 컬렉션 변수의 `before` / `after` 를 매번 남기면 실행 로그가 커지고 사용자 데이터가 뜻하지 않게 드러날 수 있다. 그래서 필요한 워크플로우에서만 켜게 하고 켜더라도 비밀 패턴·크기·지원하지 않는 타입을 마스킹한다.

### 예약 이름 강제는 호환성을 깨는 변경이었다

`__` 접두 대상 변수를 거부하면서 이전에 `__foo` 를 수정하던 워크플로우는 다시 저장할 때 400 을 받거나 실행 때 에러를 던지게 됐다.
