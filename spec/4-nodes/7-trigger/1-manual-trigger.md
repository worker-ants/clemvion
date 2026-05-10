# Spec: Manual Trigger

> 관련 문서: [Trigger 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [PRD 노드 시스템](../../../prd/3-node-system.md#3-trigger-노드-1종) · [Spec 실행 엔진](../../5-system/4-execution-engine.md) · [CONVENTIONS](../../../user_memo/node-specs-improvement/CONVENTIONS.md)

워크플로우의 **시작 노드(진입점)**. 사용자가 정의한 파라미터 스키마(`config.parameters`)를 기준으로, 실행 어댑터(Run 버튼/HTTP API)가 전달한 원시 입력을 해석·검증하여 `output.parameters` 로 노출한다. 워크플로우당 정확히 1개 존재하며 자동 생성·삭제 불가. 입력 포트가 없는 비-블로킹 즉시 완료 노드.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| parameters | `TriggerParameterDefinition[]` | | `[]` | 입력 파라미터 스키마 배열. 정의는 [Trigger 공통 §1](./0-common.md#1-트리거-진입-파라미터-공통-계약) |

`parameters[i]` 는 `{ name, type, required?, defaultValue?, description? }` 형태의 **스키마 정의**(값이 아님). 빈 배열이면 파라미터 기능 비활성.

> ⚠ `config.parameters` 와 `output.parameters` 는 **이름은 같지만 shape이 다르다** (CONVENTIONS Principle 1.1 직교성):
> - `config.parameters` = `Array<{name, type, ...}>` — UI/schema 로 정의한 **스키마** (실행 없이 존재).
> - `output.parameters` = `Record<string, unknown>` — 어댑터 입력 + `defaultValue` 병합 결과로 해석된 **런타임 값** (실행 시점에만 존재).
> 두 필드는 echo 관계가 아니다.

> Source of truth: `backend/src/nodes/trigger/manual-trigger/manual-trigger.schema.ts` (export `manualTriggerConfigSchema`)

## 2. 설정 UI

```
┌──────────────────────────────────────┐
│  Parameters                          │
│                                      │
│  ┌──────────────────────────────────┐│
│  │ Name:    orderId                ││
│  │ Type:    [string ▼]             ││
│  │ Required: [✓]                   ││
│  │ Default:  ""                [×] ││
│  └──────────────────────────────────┘│
│  ┌──────────────────────────────────┐│
│  │ Name:    count                  ││
│  │ Type:    [number ▼]             ││
│  │ Required: [ ]                   ││
│  │ Default:  0                 [×] ││
│  └──────────────────────────────────┘│
│                                      │
│  [+ Add Parameter]                   │
└──────────────────────────────────────┘
```

설정 패널에서는 Label, Notes, Parameters 만 편집 가능. 워크플로우당 1개·삭제 불가 제약은 노드 캔버스 컨텍스트 메뉴 차원에서 강제된다.

## 3. 포트

### 3.1 입력 포트

Manual Trigger는 워크플로우 **진입점**이므로 입력 포트를 갖지 않는다 (`inputs: []`). [Trigger 공통 §3.1](./0-common.md#31-입력-부재) 참조.

`execute(input, config, context)` 에 주입되는 `input` 은 어댑터가 전달하는 외부 진입 데이터다 — Manual: `{ parameters }`, Webhook: `{ parameters, body, headers, query, method }`, Schedule: `{ parameters }`.

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `out` | Output | data | false | 해석된 파라미터 값 — 다운스트림 노드 진입 |

> Manual Trigger는 동적 포트가 없다.

## 4. 실행 로직

1. **사전 해석 (어댑터 단계)**: 엔진의 트리거 어댑터(`resolveTriggerParameters`)가 어댑터별 원시 값을 `config.parameters` 스키마로 검증·default 적용·타입 coerce 하여 `input.parameters` 로 전달한다. required 누락은 이 단계에서 400 또는 즉시 실패로 끝난다.
2. **핸들러 진입**: `input.parameters` 가 객체이면 그대로 채택, 아니면 `{}` 로 fallback (CONVENTIONS Principle 10).
3. **config echo**: `context.rawConfig?.parameters ?? []` 를 `config.parameters` 로 echo (Principle 7 — `defaultValue` 의 `{{ }}` 템플릿 보존).
4. **output 구성**: `output.parameters = resolvedParameters`. 추가로 어댑터가 함께 전달한 형제 키(`body`/`headers`/`query`/`method` 등 webhook 컨텍스트)는 `output` 최상위에 spread merge.
5. **즉시 완료**: 외부 호출 없음 → `meta` / `port` / `status` 미설정. 엔진이 기본 포트 `out` 으로 라우팅.

> ⚠ **개선 예정 (P1)**: webhook 어댑터가 전달하는 `body`/`headers`/`query`/`method` 가 현재 `output` 최상위에 평탄 병합되어 사용자 정의 파라미터 이름과 충돌 여지가 있다. [user_memo 개선안 §3.2](../../../user_memo/node-specs-improvement/trigger/manual_trigger.md#32-before--after) 는 `output.request.{method,headers,query,body}` 로 묶고 `meta.source: 'manual'|'webhook'|'schedule'` 추가를 제안한다. 본 spec 의 §5.1 은 현재 핸들러 동작을 기술한다.

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> Manual Trigger는 비-블로킹 즉시 완료 노드이며 핸들러 단계에서 에러 포트가 없다 (검증 실패는 어댑터 단계의 pre-flight throw). 따라서 단일 정상 케이스(§5.1)만 존재한다.

### 5.1 Case: 정상 (port `out`)

```json
{
  "config": {
    "parameters": [
      { "name": "orderId", "type": "string", "required": true },
      { "name": "count", "type": "number", "defaultValue": 0 }
    ]
  },
  "output": {
    "parameters": { "orderId": "abc-123", "count": 3 }
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.parameters` | `TriggerParameterDefinition[]` | config echo (Principle 7) | 사용자가 UI 에서 정의한 raw 스키마 — `defaultValue` 의 `{{ }}` 템플릿 보존 |
| `output.parameters` | `Record<string, unknown>` | runtime — adapter resolved | 어댑터가 입력 + `defaultValue` 병합으로 해석한 런타임 값. `config.parameters` 의 echo 가 **아님** (Principle 1.1 직교) |

**Webhook 어댑터에서의 추가 spread (현재 동작)**:

webhook 진입 시 어댑터가 `input` 으로 `{ parameters, body, headers, query, method }` 를 전달하면, 핸들러는 `parameters` 외 나머지 키를 `output` 최상위에 spread merge 한다:

```json
{
  "config": {
    "parameters": [
      { "name": "orderId", "type": "string", "required": true }
    ]
  },
  "output": {
    "parameters": { "orderId": "abc-123" },
    "body":    { "raw": true },
    "headers": { "x-source": "github" },
    "query":   { "q": "1" },
    "method":  "POST"
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `output.body` | object | runtime — webhook adapter | webhook HTTP body. Manual/Schedule 어댑터에서는 부재 |
| `output.headers` | object | runtime — webhook adapter | webhook HTTP headers |
| `output.query` | object | runtime — webhook adapter | webhook URL query string parsed |
| `output.method` | string | runtime — webhook adapter | webhook HTTP method |

> ⚠ 위 4개 필드는 어댑터 종류에 따라 **존재 여부가 달라진다**. 다운스트림 expression 은 `$node["Manual Trigger"].output.body` 등으로 접근하되 부재 가능성을 고려해야 한다. [user_memo 개선안 §3.2](../../../user_memo/node-specs-improvement/trigger/manual_trigger.md#32-before--after) 의 `output.request.*` 묶음 + `meta.source` 도입이 P1 후속 과제.

**Expression 접근 예**:
- `$node["Manual Trigger"].output.parameters.orderId` → `"abc-123"`
- `$input.parameters.orderId` → `"abc-123"` (단축 — 다운스트림 첫 노드 한정)
- `$params.orderId` → `"abc-123"` (단축 — `$input.parameters` 별칭)
- `$node["Manual Trigger"].config.parameters[0].name` → `"orderId"` (스키마 정의)
- `$node["Manual Trigger"].output.method` → `"POST"` (webhook 한정)

## 6. 에러 코드

Manual Trigger 핸들러는 **runtime 에러 포트를 갖지 않는다**. 모든 검증 실패는 핸들러 진입 이전(어댑터 또는 config 검증) pre-flight 단계에서 처리된다 (CONVENTIONS Principle 3.1):

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `parameters[i].name` 가 빈 문자열 또는 식별자 규칙(`^[A-Za-z_][A-Za-z0-9_]*$`) 위반 | `parameters.<name>: name must be a valid identifier` | handler.validate (저장 시점) |
| `parameters` 내 `name` 중복 | `parameters.<name>: duplicate parameter name` | handler.validate |
| `parameters` 가 배열 아님 | `parameters: must be an array` | handler.validate |
| `parameters[i].type` 가 enum (`string`/`number`/`boolean`/`object`/`array`) 미일치 | `parameters.<name>: type must be one of: string, number, ...` | handler.validate |
| required 파라미터의 값 누락 (Manual API) | `400 INVALID_INPUT` (Execution 미생성) | adapter `resolveTriggerParameters` (실행 시점) |
| required 파라미터의 값 누락 (Webhook) | `400 Bad Request` (Execution 미생성) | HooksService (실행 시점) |
| required 파라미터의 값 누락 (Schedule) | DTO 검증 실패 (스케줄 등록/수정 시) 또는 런타임 default 채움 | Schedule 모듈 |

세 어댑터의 공통 검증 시점·실패 응답은 [Trigger 공통 §1](./0-common.md#1-트리거-진입-파라미터-공통-계약) 참조.

## 7. 캔버스 요약

[공통 §2](./0-common.md#2-캔버스-요약) — `Manual Trigger` 행 인용 (`Parameters: N` 또는 `(none)`).
