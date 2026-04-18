# Code (`code`)

> 사용자 정의 JavaScript 코드를 안전한 sandbox(Node.js `vm`)에서 실행하여 변환·계산을 수행합니다.

- **카테고리**: `data`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `language` | `'javascript'` | no | `'javascript'` | 언어 (현재 JS만 지원) | no |
| `code` | string | yes | `''` | 실행할 코드 본문 | no |
| `timeout` | number (초) | no | `30` | 실행 타임아웃 (1~120초 범위) | no |

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | 입력 (sandbox에서 `$input`으로 접근) |
| Output | `out` | Output | 코드의 `return` 값 |

## Input

input 값이 sandbox 내부에서 `$input` 전역으로 노출됩니다.

## Sandbox 환경

코드는 다음 환경에서 실행됩니다 (전역 변수):

| 변수 | 설명 |
| --- | --- |
| `$input` | 노드 input 값 |
| `$vars` | `context.variables` 의 deep clone (수정하면 원본도 갱신됨 — 변경된 결과가 다시 context.variables로 복사됨) |
| `$execution.executionId` | 현재 실행 ID |
| `$execution.workflowId` | 현재 워크플로우 ID |
| `console.log/warn/error` | sandbox 콘솔 (최대 100줄까지 `meta.logs`에 캡처) |
| `JSON`, `Math`, `Array`, `Object`, `String`, `Number`, `Boolean`, `Date`, `RegExp`, `Map`, `Set`, `Promise`, `Error` 등 | 표준 객체 |
| `parseInt`, `parseFloat`, `isNaN`, `isFinite`, `encodeURIComponent`, `decodeURIComponent` | 표준 함수 |

명시적으로 **차단된** 항목 (보안):
- `Reflect`, `Proxy`, `globalThis`, `Symbol`, `WeakMap`, `WeakSet`, `WeakRef`, `FinalizationRegistry`, `Atomics`, `SharedArrayBuffer`, `Intl`
- 동적 코드 생성 (`eval`, `new Function()`) — `codeGeneration: { strings: false, wasm: false }`
- WASM 실행

코드는 자동으로 `(async () => { "use strict"; <code> })()` 로 감싸지며, `return <값>`으로 출력값을 명시해야 합니다.

## Output

### Case 1: 정상 실행

config: `{ code: "return $input.x * 2;" }`, input: `{ x: 21 }`

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

### Case 2: console.log 사용

config: `{ code: "console.log('processing'); return { ok: true };" }`

```json
{
  "config": { "language": "javascript" },
  "output": { "ok": true },
  "meta": {
    "success": true,
    "logs": ["[log] processing"]
  }
}
```

### Case 3: 코드 실패 (런타임 에러 / 구문 에러 / 타임아웃)

```json
{
  "config": { "language": "javascript" },
  "output": null,
  "meta": {
    "success": false,
    "error": "Cannot read properties of undefined (reading 'x')",
    "errorCode": "CODE_RUNTIME_ERROR",
    "stack": "TypeError: Cannot read...\n    at code-node.js:2:12",
    "logs": []
  }
}
```

`errorCode` 종류: `CODE_SYNTAX_ERROR`, `CODE_RUNTIME_ERROR`, `EXECUTION_TIMEOUT`.

> 실패 시에도 노드 자체는 throw하지 않고 `output: null` + `meta.success: false`로 반환합니다 — 후속 노드에서 `meta.success`로 분기 가능합니다 (단, 별도 error 포트는 없음).

| 필드 | 설명 |
| --- | --- |
| `output` | 코드의 `return` 값 (실패 시 `null`) |
| `meta.success` | 성공 여부 (`true`/`false`) |
| `meta.logs` | console 호출 캡처 (최대 100줄, `[level] msg` 포맷) |
| `meta.error` | 에러 메시지 (실패 시) |
| `meta.errorCode` | 에러 분류 코드 (실패 시) |
| `meta.stack` | 스택 트레이스 (실패 시) |

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Calculate`라고 가정:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Calculate"].output }}` | `42` 또는 `null` | 코드 return 값 |
| `{{ $node["Calculate"].meta.success }}` | `true` | 성공 여부 (분기에 활용) |
| `{{ $node["Calculate"].meta.logs }}` | `["[log] processing"]` | console 출력 |
| `{{ $node["Calculate"].meta.error }}` | `"Cannot read..."` | 에러 메시지 |
| `{{ $node["Calculate"].meta.errorCode }}` | `"CODE_RUNTIME_ERROR"` | 에러 분류 |

## 주의사항

- **반드시 `return` 문을 사용하여 출력값을 반환**해야 합니다. 미반환 시 `undefined`.
- 코드는 async 함수로 감싸지므로 `await` 사용 가능 (e.g. `await fetch(...)` — 단, fetch는 sandbox에 없음).
- **네트워크/파일/외부 모듈 접근 불가**. sandbox에 `fetch`/`require`/`import` 없음.
- `$vars`는 deep clone이지만, 코드 실행 후 변경된 값이 다시 `context.variables`(`$var`)로 반영됩니다. 다른 노드에 영향 가능.
- console.log 등은 100줄 제한. 초과분은 무시.
- 타임아웃 도달 시 vm script가 중단되고 `EXECUTION_TIMEOUT` 에러로 반환.
- 코드 실행 자체의 에러는 노드 throw가 아닌 `meta.success: false`로 표현 — 후속 노드에서 `{{ $node["X"].meta.success }}` 또는 If/Else로 분기.
- error 포트가 없으므로 강한 분기는 후속 If/Else 노드로 처리해야 합니다.
- 출력값은 sandbox 외부로 나오면서 직렬화 — 함수, Symbol, 순환 참조는 보존되지 않을 수 있습니다.
