---
id: code
status: implemented
code:
  - codebase/backend/src/nodes/data/code/code.handler.ts
  - codebase/backend/src/nodes/data/code/code.schema.ts
---

# Spec: Code

> 관련 문서: [Data 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [노드 실행 샌드박싱](../0-overview.md#5-노드-실행-샌드박싱) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [CONVENTIONS](../../conventions/node-output.md)

JavaScript 코드를 작성하여 자유로운 데이터 처리를 수행한다. Transform 노드로 표현하기 어려운 복잡한 로직(분기·재귀·복합 변환·해시 등)에 사용한다. 사용자 코드의 throw / 타임아웃은 정상 시나리오의 일부로 간주하여 **runtime 에러 포트(`error`)** 로 분기한다 (Data 공통 §4.1).

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| language | `'javascript'` | ✓ | `javascript` | 실행 언어. 현재 javascript 만 지원 |
| code | String | ✓ | `''` | 실행할 코드 본문. `return` 문으로 출력값을 반환 |
| timeout | Number | | `30` | 실행 타임아웃 (초). 1~120초 범위 |

표현식(`{{ }}`) 은 `code` 본문에서 **사용하지 않는다** — 입력 데이터는 코드 내부에서 `$input` / `$vars` 변수로 직접 참조한다 (Data 공통 §1). 핸들러는 `code` 를 [`expression-exclusions`](../../../codebase/backend/src/modules/execution-engine/expression/expression-exclusions.ts) 에 의해 평가 없이 그대로 받는다.

> Source of truth: `codebase/backend/src/nodes/data/code/code.schema.ts` (export `codeNodeConfigSchema`, `codeNodeMetadata`)

## 2. 설정 UI — 코드 에디터

```
┌──────────────────────────────────────┐
│  Code Node                           │
│  Language: [JavaScript ▼]            │
│  Timeout : [30] sec  (1–120)         │
│  ────────────────────────────────── │
│  ┌──────────────────────────────────┐│
│  │ 1│ // 입력 데이터 가공            ││
│  │ 2│ const items = $input.data;     ││
│  │ 3│                                ││
│  │ 4│ const result = items           ││
│  │ 5│   .filter(i => i.active)       ││
│  │ 6│   .map(i => ({                 ││
│  │ 7│     id: i.id,                  ││
│  │ 8│     name: i.name.trim(),       ││
│  │ 9│     score: i.score * 100       ││
│  │10│   }));                         ││
│  │11│                                ││
│  │12│ return { items: result };      ││
│  └──────────────────────────────────┘│
│                                      │
│  ─── Console Output ────────────── │
│  (마지막 실행의 console.log 출력)    │
│                                      │
│  ─── Result Preview ────────────── │
│  { "items": [ { "id": 1, ... } ] }  │
└──────────────────────────────────────┘
```

- Monaco 스타일 에디터 (구문 강조, 줄 번호, 자동완성).
- `$input`, `$vars`, `$execution`, `$node`, `$helpers` 자동완성 지원.
- 하단 **Console Output**: 마지막 실행의 `console.log` 출력 (최대 100줄).
- 하단 **Result Preview**: 마지막 실행의 `output` JSON.
- 에러 발생 시 에디터 내 인라인 에러 + 스택 트레이스 (개발 환경 한정).

### 2.1 실행 컨텍스트 (사용자 코드 내부 전역)

| 객체 | 타입 | 설명 |
|------|------|------|
| `$input` | Object | 이전 노드의 출력 데이터 |
| `$vars` | Object | 워크플로우 변수 (읽기/쓰기 — §4.5 참조) |
| `$execution` | Object | 실행 컨텍스트 (`{executionId, workflowId}`) |
| `$node` | Object | 현재 노드 메타데이터 (`{id, label}`) |
| `$helpers` | Object | 내장 유틸리티 (§2.2 참조) |
| `console.log/warn/error` | Function | 실행 로그 (최대 100줄 캡처) |

### 2.2 내장 유틸리티 (`$helpers`)

| 유틸리티 | 설명 |
|----------|------|
| `$helpers.date(value)` | 날짜 파싱/포매팅 (dayjs 호환) |
| `$helpers.crypto.hash(algorithm, data)` | 해시 생성 (md5, sha256 등) |
| `$helpers.crypto.uuid()` | UUID v4 생성 |
| `$helpers.base64.encode(data)` | Base64 인코딩 |
| `$helpers.base64.decode(data)` | Base64 디코딩 |

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 사용자 코드의 `$input` 으로 노출되는 데이터 |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `success` | Success | data | false | 사용자 코드 정상 종료 — `output` 은 `return` 값 |
| `error` | Error | data | false | 런타임 에러 — `output.error.{code, message, details?}` |

> Code 노드는 동적 포트가 없다.

## 4. 실행 로직

1. 핸들러는 입력을 `$input` 에, `context.variables` 의 deep clone 을 `$vars` 에 바인딩한다 (§4.5).
2. 사용자 `code` 를 `(async () => { "use strict"; <code> })()` 로 래핑하여 `vm.Script` 로 컴파일한다.
   - 컴파일 실패 → **pre-flight throw** (`handler.validate` 단계에서 검출, §6 참조).
3. `vm.createContext` 로 격리 context 를 만들어 `runInContext` 로 실행. 이중 타임아웃을 적용한다 (§7.2).
4. 정상 종료 → 사용자 `return` 값을 `output` 에 그대로 담고 `port: 'success'` 를 반환 (§5.1).
5. 런타임 throw / 타임아웃 → `port: 'error'` + `output.error` 표준 봉투 (§5.3, [CONVENTIONS Principle 3.2](../../conventions/node-output.md#32-outputerror-표준-형태)).
6. 정상 종료 시 `varsClone` 을 `context.variables` 에 **원자적으로 전체 덮어쓰기** (§4.5). 실행 throw 시 원본 보존(롤백).

### 4.1 코드 작성 규칙

- `return` 문으로 출력 데이터를 반환. `return` 이 없으면 `output` 은 `undefined`.
- 비동기 코드 지원: `async/await` / `Promise` 모두 사용 가능 (top-level await 가능).
- 외부 네트워크 / 파일시스템 / 모듈 로드 불가 (§7).
- `eval` / `new Function` / 동적 `import(...)` 차단.

### 4.5 `$vars` 쓰기 처리 (Deep Clone + 전체 교체)

`$vars` 는 읽기/쓰기 가능하지만, 변경은 격리 context 내 deep clone 에서 이루어지고 실행 완료 후 메인 컨텍스트로 **원자적으로** 동기화된다.

1. **실행 전**: `context.variables` 를 `JSON.parse(JSON.stringify(...))` 로 deep clone 하여 sandbox 의 `$vars` 로 주입.
2. **실행 중**: 격리 context 내에서 자유롭게 수정 (중첩 객체 추가/삭제/수정 포함).
3. **실행 후 (정상)**: clone 된 `$vars` 를 `context.variables` 에 **전체 교체** (부분 병합 아님).
4. **실행 후 (throw)**: 메인 컨텍스트 `$vars` 는 변경되지 않음 (롤백).

> **설계 근거**: Proxy 기반 변경 추적 대비 구현이 단순하며, 실행 중 예외 발생 시 자동 롤백된다. `$vars` 크기가 통상 작아 deep clone 비용은 무시 가능.

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> Code 노드는 정상(§5.1) / 런타임 에러(§5.3) 두 케이스로 구성된다. 사용자 코드 본문의 throw / 타임아웃은 정상 시나리오의 일부로 간주하여 `error` 포트로 분기 (Data 공통 §4.1). **컴파일 실패** (vm.Script 구문 오류) 는 사용자 코드를 한 번도 실행하지 못한 상태이므로 §6 의 **pre-flight throw** 로 처리된다.

### 5.1 Case: 정상 종료 (port `success`)

config: `{ "language": "javascript", "code": "return $input.value * 2;" }`, input: `{ "value": 21 }`

```json
{
  "config": {
    "language": "javascript",
    "code": "return $input.value * 2;",
    "timeout": 30
  },
  "output": 42,
  "meta": {
    "durationMs": 7,
    "success": true,
    "logs": []
  },
  "port": "success"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.language` | `'javascript'` | config echo (Principle 7) | 사용자가 선택한 언어 (default `javascript`) |
| `config.code` | string | config echo | 사용자 코드 본문 raw — expression resolver 에서 제외되므로 `{{ }}` 가 있어도 평가되지 않음. 길이 제한 없음 (Data 공통 §4) |
| `config.timeout` | number? | config echo | 사용자가 설정한 타임아웃 초. 미설정 시 default `30` |
| `output` | any | runtime — 사용자 `return` 값 | primitive (`42`) / object / array / `undefined` (return 없음) 모두 가능. **shape 은 사용자 코드가 결정**한다 (Principle 8 의 `output.result` 래핑은 적용하지 않음) |
| `meta.durationMs` | number | engine inject | 실행 시간 (ms) |
| `meta.success` | `true` | handler return | Code 노드 전용 편의 필드 ([CONVENTIONS Principle 2](../../conventions/node-output.md#principle-2--meta-는-실행-메트릭만-담는다)) |
| `meta.logs` | string[] | handler return | `console.log/warn/error` 캡처. `[level] payload` 형식, 최대 100줄 |
| `port` | `'success'` | handler return | 정상 종료 분기 |

**Expression 접근 예** (input: `{value: 21}`, code: `return $input.value * 2;`):
- `$node["X"].output` → `42` (raw return)
- `$node["X"].meta.success` → `true`
- `$node["X"].meta.logs` → `[]`

**객체 return 예** (code: `console.log('processing', 1); return { ok: true };`):

```json
{
  "config": { "language": "javascript", "code": "console.log('processing', 1); return { ok: true };", "timeout": 30 },
  "output": { "ok": true },
  "meta": { "durationMs": 9, "success": true, "logs": ["[log] processing 1"] },
  "port": "success"
}
```

**`return` 누락 예** (code: `const x = 1;`):

```json
{
  "config": { "language": "javascript", "code": "const x = 1;", "timeout": 30 },
  "meta": { "durationMs": 1, "success": true, "logs": [] },
  "port": "success"
}
```

> `output` 이 `undefined` 이면 JSON 예시에서 생략 (Principle 11). 후속 노드에서 `$node["X"].output` 은 `undefined` 로 평가된다.

### 5.3 Case: 런타임 에러 (port `error`)

#### 5.3.1 사용자 코드 내 throw

config: `{ "code": "throw new Error('boom');" }`

```json
{
  "config": {
    "language": "javascript",
    "code": "throw new Error('boom');",
    "timeout": 30
  },
  "output": {
    "error": {
      "code": "CODE_EXECUTION_FAILED",
      "message": "boom",
      "details": {
        "legacyCode": "CODE_RUNTIME_ERROR",
        "stack": "Error: boom\n    at code-node.js:3:7"
      }
    }
  },
  "meta": {
    "durationMs": 5,
    "success": false,
    "logs": []
  },
  "port": "error"
}
```

#### 5.3.2 타임아웃

config: `{ "code": "while (true) {}", "timeout": 1 }` (또는 `await new Promise(() => {})`)

```json
{
  "config": {
    "language": "javascript",
    "code": "while (true) {}",
    "timeout": 1
  },
  "output": {
    "error": {
      "code": "CODE_TIMEOUT",
      "message": "Code execution timed out",
      "details": {
        "legacyCode": "EXECUTION_TIMEOUT",
        "stack": "..."
      }
    }
  },
  "meta": {
    "durationMs": 1000,
    "success": false,
    "logs": []
  },
  "port": "error"
}
```

#### 5.3 공통 필드 표

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.language` | `'javascript'` | config echo (Principle 7) | 사용자가 선택한 언어 (default `javascript`) |
| `config.code` | string | config echo | 사용자 코드 본문 raw — 정상 케이스와 동일하게 echo (CONVENTIONS Principle 7) |
| `config.timeout` | number? | config echo | 사용자가 설정한 타임아웃 초 |
| `output.error.code` | string | handler return | 정규화된 에러 코드 — `CODE_TIMEOUT` / `CODE_EXECUTION_FAILED` (CONVENTIONS Principle 3.2 — `UPPER_SNAKE_CASE`) |
| `output.error.message` | string | handler return | 사람이 읽는 에러 메시지 (로그/디버깅용 원문) |
| `output.error.details.legacyCode` | string | handler return | 내부 분류용 legacy 코드 (`CODE_RUNTIME_ERROR` / `EXECUTION_TIMEOUT`). 후속 노드는 `output.error.code` 사용 |
| `output.error.details.stack` | string? | handler return | 스택 트레이스. **`NODE_ENV !== 'production'` 일 때만 노출** (프로덕션에서는 내부 파일 경로 노출 방지로 생략) |
| `meta.durationMs` | number | engine inject | 실행 시간 (ms) — 타임아웃 케이스에서는 timeout 값에 근사 |
| `meta.success` | `false` | handler return | 실패 표시. CONVENTIONS Principle 2 의 Code 계열 권장 필드 |
| `meta.logs` | string[] | handler return | console 캡처. 에러 발생 직전까지의 로그 보존 |
| `port` | `'error'` | handler return | 런타임 에러 분기 |

**Expression 접근 예** (런타임 throw):
- `$node["X"].output.error.code` → `"CODE_EXECUTION_FAILED"`
- `$node["X"].output.error.message` → `"boom"`
- `$node["X"].output.error.details.legacyCode` → `"CODE_RUNTIME_ERROR"`
- `$node["X"].port` → `"error"`

> **에러 코드 정규화 매핑** (handler.failure):
>
> | 내부 errorCode (legacy) | `output.error.code` (normalized) |
> |--------------------------|-----------------------------------|
> | `EXECUTION_TIMEOUT` | `CODE_TIMEOUT` |
> | `CODE_RUNTIME_ERROR` | `CODE_EXECUTION_FAILED` |
> | `EXECUTION_MEMORY_EXCEEDED` (로드맵) | `CODE_MEMORY_LIMIT` |

## 6. 에러 코드 (Pre-flight throw)

§5.3 (런타임 → `error` 포트) 외에, 다음 검증 실패는 **pre-flight throw** 로 처리된다 (CONVENTIONS Principle 3.1):

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `code` 가 빈 문자열 / 누락 | `Body of the code to run must be entered.` (warningRule source 문자열; 캔버스 배지는 i18n 렌더) | warningRule (캔버스 배지) + handler.validate |
| `code` 가 string 타입이 아님 | `code is required and must be a string` | handler.validate (zod default `''` 우회한 raw fixture 가드) |
| `timeout` 이 `[1, 120]` 밖 | `timeout must be a number between 1 and 120 seconds` | handler.validate (`validateCodeConfig`) |
| `language` 가 `javascript` 외 | (zod enum) `Invalid enum value. Expected 'javascript', received '...'` | schema parse 시점 |
| **`code` 컴파일 실패** (`vm.Script` 구문 오류) | `code has a syntax error: <V8 SyntaxError 메시지>` | handler.validate (사용자 코드를 한 번도 실행하지 못한 상태) |

> Pre-flight throw 는 사용자 코드를 단 한 번도 실행하지 못한 상태이므로 `error` 포트가 아닌 throw 로 처리한다 (Data 공통 §4.1). 캔버스 배지 / 실행 시작 직전 검증으로 즉시 노출된다.

## 7. 샌드박싱

[노드 실행 샌드박싱 정책](../0-overview.md#5-노드-실행-샌드박싱) 을 동일하게 적용한다 (Data 공통 §2).

### 7.1 격리 방식

| 방식 | 설명 |
|------|------|
| **현재 구현: `node:vm` context** | `vm.createContext({ ... }, { codeGeneration: { strings: false, wasm: false } })` 로 허용된 전역만 주입한 별도 context 에서 코드 실행. `require`/`process`/`global`/`Buffer`/`fetch` 등 미주입. `eval`/`new Function` 은 `codeGeneration.strings: false` 로 차단. 동적 `import(...)` 는 모듈 로더(`importModuleDynamically`) 미설정으로 차단 |
| 로드맵 (선택): `isolated-vm` 또는 컨테이너 | 메모리 하드 리밋(128MB) 또는 프로세스 레벨 격리가 필요해지면 `isolated-vm`(V8 Isolate) 또는 Docker 격리로 전환 |

> **선택 근거**: `node:vm` 은 네이티브 빌드(node-gyp) 의존성이 없어 배포·개발 환경 구성이 단순하고, 전역 미주입 + `codeGeneration` 차단으로 모듈 로드/네트워크/파일 시스템 차단 요구를 달성한다. 단, 메모리 하드 리밋과 완벽한 sandbox escape 방어는 불가하므로 추후 `isolated-vm` 등으로 재검토한다.

### 7.2 리소스 제한

| 항목 | 제한 | 설명 |
|------|------|------|
| 타임아웃 | 기본 30초 (1~120초) | `vm.Script#runInContext` 의 `timeout` (동기 무한루프 보호) + 외부 `Promise.race` (비동기 무한 대기 보호) **이중 적용** |
| 메모리 | 강제 불가 | `node:vm` 한계. `isolated-vm` 전환 시 128MB 적용 예정 (`CODE_MEMORY_LIMIT`) |
| 네트워크 | 완전 차단 | `fetch`, `XMLHttpRequest`, `WebSocket` 미주입 |
| 파일시스템 | 접근 불가 | `fs`, `path`, `child_process` 등 미주입 |
| 모듈 | require/import 불가 | 모듈 로더 미제공. 내장 유틸리티만 전역 주입 |
| 전역 객체 | 제한된 전역만 허용 | §7.3 참조 |

### 7.3 허용 / 차단 API

**허용 (전역 주입)**:

| API | 설명 |
|-----|------|
| `$input`, `$vars`, `$execution`, `$node` | 실행 컨텍스트 객체 |
| `$helpers` | 내장 유틸리티 (§2.2) |
| `console.log/warn/error` | 디버그 로그 (최대 100줄 캡처) |
| `JSON.parse`, `JSON.stringify` | JSON 처리 |
| `Array`, `Object`, `String`, `Number`, `Boolean`, `Date`, `RegExp`, `Map`, `Set` | 기본 내장 객체 |
| `Math`, `parseInt`, `parseFloat`, `isNaN`, `isFinite` | 수학/파싱 |
| `encodeURIComponent`, `decodeURIComponent` | URI 인코딩 |
| `Promise`, `async/await` | 비동기 처리 |
| `Error`, `TypeError`, `RangeError`, `SyntaxError` | 예외 클래스 |

**차단**: 두 가지 차단 방식이 있다 (`buildSandbox`, `code.handler.ts`).
1. **미주입 (sandbox 키 부재 → 참조 시 `ReferenceError`)**: `require`/`import`/`fetch`/`fs`/`process`/`Buffer`/`eval`/`Function` 등. vm context 에 키 자체가 없다 (`eval`/`new Function` 은 추가로 `codeGeneration.strings: false` 로도 차단).
2. **명시 `undefined` 셰도잉 (sandbox 에 `undefined` 로 키 등록)**: `Reflect`/`Proxy`/`globalThis`/`Symbol`/`WeakMap`/`WeakSet`/`WeakRef`/`FinalizationRegistry`/`Atomics`/`SharedArrayBuffer`/`Intl`/`setTimeout`/`setInterval`/`setImmediate`. (vm context 가 이미 생략하지만 계약을 명시적으로 드러내기 위함.)

| API | 차단 방식 | 차단 이유 |
|-----|-----------|-----------|
| `require`, `import` | 미주입 | 외부 모듈 로드 방지 |
| `fetch`, `XMLHttpRequest`, `WebSocket` | 미주입 | 네트워크 접근 차단 |
| `fs`, `path`, `os`, `child_process` 등 Node.js 모듈 | 미주입 | 시스템 접근 차단 |
| `eval`, `Function` 생성자 | 미주입 + `codeGeneration.strings: false` | 동적 코드 실행 추가 방지 |
| `process`, `global`, `Buffer` | 미주입 | 런타임 환경 접근 차단 |
| `globalThis`, `Symbol` | `undefined` 셰도잉 | 런타임 환경 접근 / 메타프로그래밍 방지 |
| `Reflect`, `Proxy` | `undefined` 셰도잉 | 샌드박스 탈출 / 메타프로그래밍 방지 |
| `WeakMap`, `WeakSet`, `WeakRef`, `FinalizationRegistry`, `Atomics`, `SharedArrayBuffer`, `Intl` | `undefined` 셰도잉 | 비결정적 / cross-realm leak 방지 |
| `setTimeout`, `setInterval`, `setImmediate` | `undefined` 셰도잉 | 비결정적 스케줄링 차단 (Promise.race 타임아웃 흐름 단순화) |

## 8. 캔버스 요약

[Data 공통 §3](./0-common.md#3-캔버스-요약) — `Code` 행 인용 (`{language} · {N} lines`).

## Rationale

### `config.code` raw echo — Principle 7 의 "절대 echo 금지" 예외 아님 (2026-06-03 정합화)

`config.code` (사용자 코드 본문) 는 `NodeHandlerOutput.config` 에 **raw 그대로 echo** 한다. 한때 [CONVENTIONS Principle 7](../../conventions/node-output.md) 의 "절대 echo 금지" 목록에 `code.config.code` 가 있어 본 spec(§5.1 config echo) 과 모순됐으나, 이는 두 개념의 혼동이었다:

- **expression 평가 제외** (`expression-exclusions` 등록) — 코드 본문 안의 `{{ }}` 를 평가하지 않는다 (코드가 곧 데이터이므로). 이것이 등록의 의미.
- **echo 금지** — `config` 에 싣지 않는다. 코드 본문은 여기 해당하지 **않는다**.

코드 본문은 `systemPrompt`/`userPrompt`/`body` 와 동일 부류의 사용자 작성 raw 텍스트로, 디버깅·후속 노드 참조를 위해 echo 한다 (비민감 — 사용자 본인 코드, 에디터/UI 로 크기 bounded). 따라서 Principle 7 "항상 echo" 목록에 속한다. (정합화로 `node-output.md` Principle 7 금지 목록에서 `code.config.code` 삭제 + "항상 echo" 로 이동.)

### `output` root 직접 배치 — Principle 8.2 의 `output.result` 래핑 미적용 (2026-06-03 정합화)

Code 노드의 `output` 은 사용자 `return` 값을 **root 에 그대로** 담는다 (§5.1) — `output.result` 래핑을 적용하지 않는다. `output.result` 래핑은 [CONVENTIONS Principle 8.2](../../conventions/node-output.md) 의 **LLM 계열 노드 (ai_agent / text_classifier / information_extractor) 한정** 규칙이다. Code(및 Transform)는 사용자 코드/연산이 출력 shape 을 결정하므로 인위적 `result` 래핑은 다운스트림 expression 만 장황하게 만든다 (`$node["X"].output.result.foo` vs `$node["X"].output.foo`). 한때 Principle 8.2 표의 "코드 실행 결과 → `output.result`" 행이 이 결정과 모순됐으나, 정합화로 해당 행을 "root 직접 배치 (Code/Transform 예외)" 로 정정했다.

**기각된 대안**: Code 출력을 `output.result` 로 래핑 — LLM 계열과의 표면적 일관성은 얻지만, 사용자가 `return { result: ... }` 를 직접 쓰면 `output.result.result` 이중 중첩이 발생하고, primitive return(`return 42`)이 `output.result: 42` 로 어색해진다. 사용자 코드의 자유로운 shape 가 핵심 가치이므로 root 직접 배치를 유지.
