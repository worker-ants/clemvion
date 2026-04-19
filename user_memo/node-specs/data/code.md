# Code (`code`)

> 사용자 정의 JavaScript 코드를 Node.js `vm` 기반 sandbox에서 실행하여 변환·계산을 수행합니다.

- **카테고리**: `data`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `language` | `'javascript'` | no | `'javascript'` | 실행 언어 (현재 JS만 지원) | yes |
| `code` | string | yes | `''` | 실행할 코드 본문. `return <값>` 으로 출력값 지정 | **no (raw JS)** |
| `timeout` | number (초) | no | `30` | 실행 타임아웃. `1` 이상 `120` 이하 정수 범위에서만 유효 | yes |

> `code` 필드는 `EXPRESSION_EXCLUSIONS['code']`에 등록되어 **expression resolver가 건너뜁니다**. `{{ ... }}` 구문이 코드에 그대로 전달되므로 외부 값은 반드시 sandbox 내부 전역(`$input`, `$vars`, `$execution`)으로 접근해야 합니다. `language`와 `timeout`은 일반 expression이 적용됩니다.

## Ports

| 방향 | id | label | type | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | `data` | sandbox 내부에서 `$input`으로 노출 |
| Output | `out` | Output | `data` | 코드의 `return` 값 (실패해도 이 포트로 흐름, error 포트 없음) |

## Input

핸들러는 `input`을 그대로 sandbox의 `$input` 전역으로 노출합니다. `config.code` 자체는 expression 처리되지 않으므로, 이전 노드 값이 필요하면 `$input` 또는 `$vars`를 통해 접근해야 합니다.

## Sandbox 환경

코드는 `node:vm`의 `createContext`로 만든 sandbox에서 다음 구조로 감싸져 실행됩니다.

```js
(async () => {
"use strict";
<사용자 코드>
})()
```

### 제공되는 전역

| 전역 | 설명 |
| --- | --- |
| `$input` | 이 노드의 input 값 (원본 참조) |
| `$vars` | `context.variables`의 deep clone. **코드가 성공적으로 끝나면** clone이 `context.variables`로 복사되어 다른 노드의 `$var`에 반영됨. 예외 발생 시에는 원본이 유지됨 |
| `$execution.executionId` | 현재 execution ID |
| `$execution.workflowId` | 현재 워크플로우 ID |
| `console.log` / `console.warn` / `console.error` | 포맷된 문자열을 `meta.logs`에 push. 최대 **100줄**까지만 보관, 초과분 무시 |
| 표준 객체 | `JSON`, `Math`, `Array`, `Object`, `String`, `Number`, `Boolean`, `Date`, `RegExp`, `Map`, `Set`, `Promise`, `Error`, `TypeError`, `RangeError`, `SyntaxError` |
| 표준 함수 | `parseInt`, `parseFloat`, `isNaN`, `isFinite`, `encodeURIComponent`, `decodeURIComponent` |

### 명시적으로 차단된 항목

다음은 sandbox에서 `undefined`로 shadow 처리되어 접근 불가합니다.

- `Reflect`, `Proxy`, `globalThis`, `Symbol`, `WeakMap`, `WeakSet`, `WeakRef`, `FinalizationRegistry`, `Atomics`, `SharedArrayBuffer`, `Intl`

그리고 다음은 Node.js `vm` 옵션 `codeGeneration: { strings: false, wasm: false }` 및 sandbox 구성으로 **불가능**합니다.

- `require`, `import(...)` (dynamic), `process`, `global`, `Buffer`, `fetch`, `setTimeout`/`setInterval`/`setImmediate`
- `eval(...)`, `new Function(...)`
- WebAssembly 컴파일 / 실행

## Output

핸들러는 **성공/실패 모두 예외를 throw하지 않고** `NodeHandlerOutput` 형태로 반환합니다. `port`/`status`는 사용하지 않습니다.

### Case 1: 정상 실행

config: `{ "code": "return $input.x * 2;" }`, input: `{ "x": 21 }`

```json
{
  "config": { "language": "javascript" },
  "output": 42,
  "meta": {
    "success": true,
    "logs": []
  }
}
```

### Case 2: console.log 캡처

config: `{ "code": "console.log('processing', 1); return { ok: true };" }`

```json
{
  "config": { "language": "javascript" },
  "output": { "ok": true },
  "meta": {
    "success": true,
    "logs": ["[log] processing 1"]
  }
}
```

### Case 3: 런타임 에러

config: `{ "code": "throw new Error('boom');" }`

```json
{
  "config": { "language": "javascript" },
  "output": null,
  "meta": {
    "success": false,
    "error": "boom",
    "errorCode": "CODE_RUNTIME_ERROR",
    "stack": "Error: boom\n    at code-node.js:3:7",
    "logs": []
  }
}
```

### Case 4: 구문 에러

config: `{ "code": "this is ( not valid js" }`

```json
{
  "config": { "language": "javascript" },
  "output": null,
  "meta": {
    "success": false,
    "error": "Unexpected identifier ...",
    "errorCode": "CODE_SYNTAX_ERROR",
    "stack": "SyntaxError: ...",
    "logs": []
  }
}
```

### Case 5: 타임아웃

config: `{ "code": "while (true) {}", "timeout": 1 }` 또는 `await new Promise(() => {})`

```json
{
  "config": { "language": "javascript" },
  "output": null,
  "meta": {
    "success": false,
    "error": "Code execution timed out",
    "errorCode": "EXECUTION_TIMEOUT",
    "stack": "...",
    "logs": []
  }
}
```

| 필드 | 설명 |
| --- | --- |
| `config.language` | `config.language ?? 'javascript'`. 성공/실패 경로 모두 포함 |
| `output` | 코드의 `return` 값. 실패 시 **`null`**. `return` 생략 시 `undefined` |
| `meta.success` | `true`(정상 return) / `false`(실패) |
| `meta.logs` | `[level] payload` 형식 문자열 배열. 최대 100줄 |
| `meta.error` | 실패 시 에러 메시지 (`error.message` 또는 override) |
| `meta.errorCode` | `CODE_SYNTAX_ERROR` / `CODE_RUNTIME_ERROR` / `EXECUTION_TIMEOUT` 중 하나 |
| `meta.stack` | 실패 시 스택 트레이스 (있을 경우) |

> sandbox 외부로 나오면서 일부 값은 보존되지 않을 수 있습니다. `output`에는 함수/Symbol/WeakRef/순환 참조 등을 담지 마세요 (엔진 직렬화 시 손실 또는 에러 가능).

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Calculate`라고 가정:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Calculate"].output }}` | `42` 또는 `null` | 코드 return 값 |
| `{{ $node["Calculate"].output.foo }}` | `"bar"` | 객체를 return 한 경우 |
| `{{ $node["Calculate"].config.language }}` | `"javascript"` | 사용된 언어 |
| `{{ $node["Calculate"].meta.success }}` | `true` | 성공 여부 (분기 조건에 활용) |
| `{{ $node["Calculate"].meta.logs }}` | `["[log] processing 1"]` | console 출력 캡처 |
| `{{ $node["Calculate"].meta.error }}` | `"boom"` | 에러 메시지 (실패 시) |
| `{{ $node["Calculate"].meta.errorCode }}` | `"CODE_RUNTIME_ERROR"` | 에러 분류 |
| `{{ $node["Calculate"].meta.stack }}` | `"Error: ...\n at ..."` | 스택 트레이스 (실패 시) |

`port` / `status`는 노출되지 않습니다.

## 주의사항

- **반드시 `return`으로 출력값을 명시**하세요. 생략 시 `output: undefined`.
- 코드는 자동으로 `async` IIFE로 감싸지므로 **top-level `await` 사용 가능** (예: `const v = await Promise.resolve(7); return v + 1;`). `Promise`를 return 해도 자동으로 await됩니다.
- 코드에는 `{{ ... }}` expression이 적용되지 않습니다 (`expression-exclusions.ts`의 `code` 필드). 외부 값은 `$input`, `$vars`, `$execution`, 또는 다른 노드 결과를 `$input`으로 전달해서 접근하세요.
- **네트워크/파일/외부 모듈 접근 전면 차단**: `fetch`, `require`, `import()`, `process`, `Buffer`, `setTimeout` 등 모두 사용 불가.
- `eval`, `new Function()`, WASM 전부 차단 (`codeGeneration` 옵션).
- `$vars` 반영 규칙:
  - 실행 **전**에 `context.variables`를 deep clone하여 sandbox에 주입.
  - 실행 **성공** 시 clone이 `context.variables`로 복사 → 다른 노드에서 `$var.*`로 관찰 가능.
  - **실패** 시 원본 `context.variables` 유지 (atomic replace 보장).
- `console.log` 등은 **100줄 초과분은 무시**. 디버깅 용도로만 사용하고 실제 출력은 `return`으로.
- 타임아웃은 `vm.Script.runInContext`의 `timeout` 옵션(동기 루프 차단)과 `Promise.race` 기반 fallback(비동기 무한대기 차단)으로 **이중 방어**됩니다. 둘 다 `errorCode: 'EXECUTION_TIMEOUT'`으로 귀결.
- `timeout`은 `validate()`에서 1~120(초) + finite number만 허용. 범위 밖이면 검증 단계에서 거부됨 (handler 실행 전 fail).
- 에러 발생 시에도 **노드 자체는 항상 성공 반환**합니다 (throw 안 함). 따라서 error 전용 포트도 없습니다. 분기가 필요하면 후속 `If/Else` 또는 `Switch`에서 `{{ $node["...] ].meta.success }}` / `meta.errorCode`를 조건으로 사용하세요.
