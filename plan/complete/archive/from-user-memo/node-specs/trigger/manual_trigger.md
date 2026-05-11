# Manual Trigger (`manual_trigger`)

> 워크플로우의 시작점. 트리거 어댑터(수동 실행 / webhook / schedule)가 이미 해석한 파라미터를 구조화된 `output.parameters`로 노출하고, 나머지 상위 필드는 평탄하게 병합하여 후속 노드에 전달합니다.

- **카테고리**: `trigger`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no

출처:
- `backend/src/nodes/trigger/manual-trigger/manual-trigger.schema.ts`
- `backend/src/nodes/trigger/manual-trigger/manual-trigger.handler.ts`
- `backend/src/nodes/trigger/manual-trigger/manual-trigger.component.ts`

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `parameters` | `TriggerParameterDefinition[]` | no | `[]` | 트리거가 받을 파라미터 정의 목록 (값이 아닌 **스키마**) | no |

`TriggerParameterDefinition` 항목 구조 (`triggerParameterSchema`):

| 필드 | 타입 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| `name` | string | yes | `""` | 파라미터 키. `/^[A-Za-z_][A-Za-z0-9_]*$/` 식별자 규칙. 같은 배열 내에서 중복 불가 |
| `type` | `'string' \| 'number' \| 'boolean' \| 'object' \| 'array'` | yes | `'string'` | 값 타입 (어댑터가 `coerceToType`으로 강제 변환) |
| `required` | boolean | no | (undefined) | true면 누락 시 어댑터가 `missing_required`로 400 반환 |
| `defaultValue` | unknown | no | (undefined) | 미전달(`undefined`/`null`/`""`)일 때 어댑터가 채워주는 기본값 |
| `description` | string | no | (undefined) | UI 힌트 |

> 핸들러 `validate()`는 `parameters`가 주어진 경우 `validateTriggerParameterSchema`를 호출해 배열 여부 / 이름 식별자 규칙 / 중복 / 허용 타입 여부를 검사합니다.

## Ports

| 방향 | id | label | type | 설명 |
| --- | --- | --- | --- | --- |
| Input | (없음) | — | — | 트리거 노드이므로 입력 포트 없음 |
| Output | `out` | `Output` | `data` | 후속 노드로 파라미터 및 병합된 입력 필드 전달 |

## Input (이전 노드로부터 받는 값)

트리거 어댑터(수동 실행 / webhook / schedule)가 만든 입력 객체가 전달됩니다. 대표적인 형태:

```json
{
  "parameters": { "userId": "u_123", "verbose": true },
  "body":    { "...": "webhook raw body" },
  "headers": { "x-source": "github" },
  "query":   { "q": "1" },
  "method":  "POST"
}
```

핸들러의 input 처리 규칙:

- `input`이 `null`/`undefined`/배열/비객체이면 **모든 필드를 무시**합니다.
- 객체이면 `input.parameters`를 떼어 `output.parameters`로 노출합니다.
  - 단, `input.parameters`가 객체가 아니거나 배열이면 **무시**되고 `{}`로 치환됩니다.
- `input`에서 `parameters`를 제외한 **나머지 최상위 키들은 그대로 `output`에 평탄하게 병합**됩니다 (spread).

**파라미터 값 검증 / 타입 강제 / `defaultValue` 채움은 트리거 어댑터(`resolveTriggerParameters`)에서 사전 처리**되어 들어오므로, 핸들러 자체는 값 검증을 수행하지 않습니다.

## Output

핸들러는 항상 다음 구조의 `NodeHandlerOutput`을 반환합니다 (`meta`, `port`, `status`는 설정하지 않음 → 기본 포트 `out`으로 라우팅).

### Case 1: 수동 실행 (parameters만 전달)

```json
{
  "config": {
    "parameters": [
      { "name": "name", "type": "string" }
    ]
  },
  "output": {
    "parameters": { "name": "Alice", "count": 3 }
  }
}
```

### Case 2: Webhook 실행 (parameters + body/headers/query/method 등 동반)

```json
{
  "config": {
    "parameters": [
      { "name": "orderId", "type": "string" }
    ]
  },
  "output": {
    "parameters": { "orderId": "abc" },
    "body":    { "raw": true },
    "headers": { "x-source": "github" },
    "query":   { "q": "1" },
    "method":  "POST"
  }
}
```

### Case 3: input이 비어있거나 객체가 아님

```json
{
  "config": { "parameters": [] },
  "output": {
    "parameters": {}
  }
}
```

### 필드 설명

| 필드 | 값 | 설명 |
| --- | --- | --- |
| `config.parameters` | `TriggerParameterDefinition[]` | 노드 config에 선언된 파라미터 스키마 배열. 미선언 시 `[]` |
| `output.parameters` | `Record<string, unknown>` | 어댑터가 해석해 넘긴 실제 파라미터 값 객체. 없으면 `{}` |
| `output.<나머지 키>` | unknown | `input`에서 `parameters`를 제외한 상위 키들(예: webhook의 `body`, `headers`, `query`, `method` 등)이 그대로 병합됨 |
| `meta` | — | 사용 안 함 |
| `port` | — | 사용 안 함 (기본 포트 `out`으로 흐름) |
| `status` | — | 사용 안 함 |

## 변수로 접근 가능한 항목

라벨이 `Manual Trigger`라고 가정합니다.

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Manual Trigger"].output.parameters.userId }}` | `"u_123"` | 특정 파라미터 값 |
| `{{ $node["Manual Trigger"].output.parameters }}` | `{ "userId": "u_123", "verbose": true }` | 파라미터 객체 전체 |
| `{{ $node["Manual Trigger"].output.body }}` | `{ "raw": true }` | webhook 어댑터가 실은 상위 키 (존재할 때만) |
| `{{ $node["Manual Trigger"].output.headers["x-source"] }}` | `"github"` | webhook 헤더 |
| `{{ $node["Manual Trigger"].output.method }}` | `"POST"` | webhook HTTP 메서드 |
| `{{ $node["Manual Trigger"].config.parameters }}` | `[{ "name": "userId", "type": "string", ... }]` | 파라미터 스키마 배열 |
| `{{ $node["Manual Trigger"].config.parameters[0].name }}` | `"userId"` | 스키마 내 특정 정의 접근 (dot-path 지원) |

트리거 직후의 노드는 다음 단축 표현도 사용 가능합니다 (전역 컨텍스트).

| 표현식 | 설명 |
| --- | --- |
| `{{ $input.parameters.userId }}` | 현재 노드 input(= 트리거 output)의 파라미터 |
| `{{ $params.userId }}` | `$input.parameters`의 단축 |

## 주의사항

- 파라미터 값 검증(필수 누락, 타입 강제 실패)은 **어댑터 단계**에서 `TriggerParameterValidationException`으로 거르므로, 실행 레코드가 생성되기 전에 400으로 응답됩니다. 핸들러는 값 에러를 발생시키지 않습니다.
- 스키마 검증(`validate()`)은 `parameters`가 **배열이고, 각 항목의 `name`이 식별자 규칙을 만족하며, 중복 이름이 없고, `type`이 허용된 5종 중 하나**인지만 확인합니다. `parameters`가 `undefined`이면 백워드 호환으로 `valid: true`.
- `input.parameters`가 객체가 아니면(배열/문자열 등) 조용히 `{}`로 대체됩니다. 따라서 `output.parameters`는 **항상 객체**임이 보장됩니다.
- `output`에 `parameters` 외의 키가 나타날 수 있는지는 **트리거 어댑터에 따라 다릅니다**. Webhook 어댑터는 보통 `body`/`headers`/`query`/`method`를 포함하고, 수동 실행 어댑터는 `parameters`만 보낼 수 있습니다. 실제 흐름에서 한 번 확인하세요.
- 같은 라벨의 노드가 여러 개 있을 경우 두 번째부터 `Manual Trigger#2` 형태로 자동 disambiguation 됩니다. UUID로도 접근 가능합니다.
- 핸들러 `execute()`는 에러 경로를 가지지 않습니다(try/catch 없음). 입력 형태가 예상 밖이어도 위의 규칙대로 정상 output을 반환합니다.
