# Spec: Code

> 관련 문서: [Data 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [노드 실행 샌드박싱](../0-overview.md#5-노드-실행-샌드박싱) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [CONVENTIONS](../../../user_memo/node-specs-improvement/CONVENTIONS.md)

JavaScript 코드를 작성하여 자유로운 데이터 처리를 수행한다. Transform 노드로 표현하기 어려운 복잡한 로직(분기·재귀·복합 변환·해시 등)에 사용한다. 사용자 코드의 throw / 타임아웃은 정상 시나리오의 일부로 간주하여 **runtime 에러 포트(`error`)** 로 분기한다 (Data 공통 §4.1).

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| language | `'javascript'` | ✓ | `javascript` | 실행 언어. 현재 javascript 만 지원 |
| code | String | ✓ | `''` | 실행할 코드 본문. `return` 문으로 출력값을 반환 |
| timeout | Number | | `30` | 실행 타임아웃 (초). 1~120초 범위 |

표현식(`{{ }}`) 은 `code` 본문에서 **사용하지 않는다** — 입력 데이터는 코드 내부에서 `$input` / `$vars` 변수로 직접 참조한다 (Data 공통 §1). 핸들러는 `code` 를 [`expression-exclusions`](../../../backend/src/modules/execution-engine/expression/expression-exclusions.ts) 에 의해 평가 없이 그대로 받는다.

> Source of truth: `backend/src/nodes/data/code/code.schema.ts` (export `codeNodeConfigSchema`, `codeNodeMetadata`)

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
>
> ⚠ **현 구현 (2026-05 기준)**: 핸들러는 정상 케이스에서 `port` 를 생략 → 엔진 기본 포트 `'out'` 으로 라우팅된다. 본 스펙은 [user_memo 개선안 data/code.md](../../../user_memo/node-specs-improvement/data/code.md) Option A 의 권고에 따라 `'success'` 포트를 명시한다 — 핸들러가 `port: 'success'` 를 반환하고 schema `outputs[]` 에 `success` 가 등록되도록 정렬할 예정. 정렬 전까지 다운스트림은 `port !== 'error'` 로 정상 분기를 식별한다.

## 4. 실행 로직

1. 핸들러는 입력을 `$input` 에, `context.variables` 의 deep clone 을 `$vars` 에 바인딩한다 (§4.5).
2. 사용자 `code` 를 `(async () => { "use strict"; <code> })()` 로 래핑하여 `vm.Script` 로 컴파일한다.
   - 컴파일 실패 → `port: 'error'` + `output.error.code = CODE_EXECUTION_FAILED` (legacy `CODE_SYNTAX_ERROR`).
3. `vm.createContext` 로 격리 context 를 만들어 `runInContext` 로 실행. 이중 타임아웃을 적용한다 (§7.2).
4. 정상 종료 → 사용자 `return` 값을 `output` 에 그대로 담고 `port: 'success'` 를 반환 (§5.1).
5. 런타임 throw / 타임아웃 → `port: 'error'` + `output.error` 표준 봉투 (§5.3, [CONVENTIONS Principle 3.2](../../../user_memo/node-specs-improvement/CONVENTIONS.md#32-outputerror-표준-형태)).
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
| `output` | any | runtime — 사용자 `return` 값 | primitive (`42`) / object / array / `undefined` (return 없음) 모두 가능. **shape 은 사용자 코드가 결정**한다 (Principle 8 의 `output.result` 래핑은 적용하지 않음 — 개선안 §5 근거) |
| `meta.durationMs` | number | engine inject | 실행 시간 (ms) |
| `meta.success` | `true` | handler return | Code 노드 전용 편의 필드 ([CONVENTIONS Principle 2](../../../user_memo/node-specs-improvement/CONVENTIONS.md#principle-2--meta-는-실행-메트릭만-담는다)) |
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

> ⚠ **현 구현 (2026-05 기준)**: §3.2 의 P0 항목과 동일 — 핸들러는 정상 케이스에서 `port` 를 반환하지 않는다 (`{ config, output, meta }` 만). 후속 노드 라우팅은 엔진 기본 포트 `'out'` 으로 흐른다. 본 스펙의 `port: 'success'` 는 forward-looking 형태이며, schema `outputs[]` 정렬과 함께 핸들러를 갱신할 예정. 정렬 전까지 `meta.success === true` 또는 `port !== 'error'` 로 정상 분기를 식별한다.

### 5.3 Case: 런타임 에러 (port `error`)

#### 5.3.1 사용자 코드 내 throw

config: `{ "code": "throw new Error('boom');" }`

```json
{
  "config": { "language": "javascript" },
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
    "error": "boom",
    "errorCode": "CODE_RUNTIME_ERROR",
    "stack": "Error: boom\n    at code-node.js:3:7",
    "logs": []
  },
  "port": "error"
}
```

#### 5.3.2 타임아웃

config: `{ "code": "while (true) {}", "timeout": 1 }` (또는 `await new Promise(() => {})`)

```json
{
  "config": { "language": "javascript" },
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
    "error": "Code execution timed out",
    "errorCode": "EXECUTION_TIMEOUT",
    "logs": []
  },
  "port": "error"
}
```

#### 5.3 공통 필드 표

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.language` | `'javascript'` | config echo | 에러 케이스에서는 핸들러가 `language` 만 echo (코드 본문은 reproduce 가능하므로 메모리 절약). [개선안 §3](../../../user_memo/node-specs-improvement/data/code.md#3-제안된-output-구조) |
| `output.error.code` | string | handler return | 정규화된 에러 코드 — `CODE_TIMEOUT` / `CODE_EXECUTION_FAILED` (CONVENTIONS Principle 3.2 — `UPPER_SNAKE_CASE`) |
| `output.error.message` | string | handler return | 사람이 읽는 에러 메시지 (로그/디버깅용 원문) |
| `output.error.details.legacyCode` | string | handler return | Phase 2 마이그레이션을 위한 legacy 코드 (`CODE_RUNTIME_ERROR` / `CODE_SYNTAX_ERROR` / `EXECUTION_TIMEOUT`) — 다음 메이저 릴리스에서 제거 예정 |
| `output.error.details.stack` | string? | handler return | 스택 트레이스. **`NODE_ENV !== 'production'` 일 때만 노출** (프로덕션에서는 내부 파일 경로 노출 방지로 생략) |
| `meta.durationMs` | number | engine inject | 실행 시간 (ms) — 타임아웃 케이스에서는 timeout 값에 근사 |
| `meta.success` | `false` | handler return | 실패 표시. CONVENTIONS Principle 2 의 Code 계열 권장 필드 |
| `meta.error` | string | handler return (legacy) | `output.error.message` 와 동일. **deprecated** — 후속 노드는 `output.error.message` 사용 권장 |
| `meta.errorCode` | string | handler return (legacy) | `output.error.details.legacyCode` 와 동일. **deprecated** — 후속 노드는 `output.error.code` 사용 권장 |
| `meta.stack` | string? | handler return (legacy) | `output.error.details.stack` 와 동일. **deprecated** |
| `meta.logs` | string[] | handler return | console 캡처. 에러 발생 직전까지의 로그 보존 |
| `port` | `'error'` | handler return | 런타임 에러 분기 |

**Expression 접근 예** (런타임 throw):
- `$node["X"].output.error.code` → `"CODE_EXECUTION_FAILED"`
- `$node["X"].output.error.message` → `"boom"`
- `$node["X"].port` → `"error"`
- `$node["X"].meta.errorCode` → `"CODE_RUNTIME_ERROR"` (legacy, deprecated)

> **에러 코드 정규화 매핑** (handler.failure):
>
> | 내부 errorCode (legacy) | `output.error.code` (normalized) |
> |--------------------------|-----------------------------------|
> | `EXECUTION_TIMEOUT` | `CODE_TIMEOUT` |
> | `CODE_RUNTIME_ERROR` | `CODE_EXECUTION_FAILED` |
> | `EXECUTION_MEMORY_EXCEEDED` (로드맵) | `CODE_MEMORY_LIMIT` |

> ⚠ **마이그레이션 (Phase 2 진행 중)**: `meta.error` / `meta.errorCode` / `meta.stack` 은 한 메이저 릴리스간 deprecated alias 로 유지된다. 신규 워크플로우는 `output.error.{code, message, details.stack}` 만 사용한다 ([개선안 §4 마이그레이션](../../../user_memo/node-specs-improvement/data/code.md#4-마이그레이션-영향도) 참조).

## 6. 에러 코드 (Pre-flight throw)

§5.3 (런타임 → `error` 포트) 외에, 다음 검증 실패는 **pre-flight throw** 로 처리된다 (CONVENTIONS Principle 3.1):

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `code` 가 빈 문자열 / 누락 | `실행할 코드를 입력해야 합니다.` | warningRule (캔버스 배지) + handler.validate |
| `code` 가 string 타입이 아님 | `code is required and must be a string` | handler.validate (zod default `''` 우회한 raw fixture 가드) |
| `timeout` 이 `[1, 120]` 밖 | `timeout must be a number between 1 and 120 seconds` | handler.validate (`validateCodeConfig`) |
| `language` 가 `javascript` 외 | (zod enum) `Invalid enum value. Expected 'javascript', received '...'` | schema parse 시점 |
| **`code` 컴파일 실패** (`vm.Script` 구문 오류) | `Unexpected identifier ...` 등 V8 SyntaxError 메시지 | handler.execute 직전 (사용자 코드를 한 번도 실행하지 못한 상태) |

> Pre-flight throw 는 사용자 코드를 단 한 번도 실행하지 못한 상태이므로 `error` 포트가 아닌 throw 로 처리한다 (Data 공통 §4.1, 개선안 [`data/code.md`](../../../user_memo/node-specs-improvement/data/code.md) §5.근거). 캔버스 배지 / 실행 시작 직전 검증으로 즉시 노출된다.
>
> ⚠ **현 구현 (2026-05 기준)**: 핸들러는 `vm.Script` 컴파일 실패를 throw 하지 않고 `port: 'error'` + `output.error.code: 'CODE_EXECUTION_FAILED'` (legacy `CODE_SYNTAX_ERROR`) 로 반환한다. 본 스펙은 forward-looking 형태이며, [개선안 §3](../../../user_memo/node-specs-improvement/data/code.md#3-제안된-output-구조) 의 Phase 3 cleanup 단계에서 throw 로 정렬할 예정이다. 정렬 전까지 후속 노드는 `output.error.details.legacyCode === 'CODE_SYNTAX_ERROR'` 로 식별 가능.

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

**차단 (주입하지 않음 — `undefined` 로 명시 셰도잉)**:

| API | 차단 이유 |
|-----|-----------|
| `require`, `import` | 외부 모듈 로드 방지 |
| `fetch`, `XMLHttpRequest`, `WebSocket` | 네트워크 접근 차단 |
| `fs`, `path`, `os`, `child_process` 등 Node.js 모듈 | 시스템 접근 차단 |
| `eval`, `Function` 생성자 | 동적 코드 실행 추가 방지 |
| `process`, `global`, `globalThis`, `Buffer` | 런타임 환경 접근 차단 |
| `Reflect`, `Proxy`, `Symbol` | 샌드박스 탈출 / 메타프로그래밍 방지 |
| `WeakMap`, `WeakSet`, `WeakRef`, `FinalizationRegistry`, `Atomics`, `SharedArrayBuffer`, `Intl` | 비결정적 / cross-realm leak 방지 |
| `setTimeout`, `setInterval`, `setImmediate` | 비결정적 스케줄링 차단 (Promise.race 타임아웃 흐름 단순화) |

## 8. 캔버스 요약

[Data 공통 §3](./0-common.md#3-캔버스-요약) — `Code` 행 인용 (`{language} · {N} lines`).
