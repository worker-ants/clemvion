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
| `$helpers.crypto.hash(algorithm, data)` | 해시 생성. 허용 알고리즘: `sha256` · `sha384` · `sha512` · `sha1` · `md5`. ⚠ `md5`/`sha1` 은 체크섬·레거시 호환 전용이며 **암호학적 용도(서명·비밀번호·무결성 보증) 금지** — 충돌 공격에 취약 |
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
2. 사용자 `code` 를 **2단 async 래퍼**로 감싸 isolate `compileScript` 로 컴파일한다. 외곽은 즉시 실행
   IIFE, 내부는 사용자 코드를 담는 `__user` 화살표 함수이며, 결과 직렬화를 isolate **경계 안에서** 수행한다:
   ```js
   (async () => {
   "use strict";
   const __user = async () => {
   <code>
   };
   const __result = await __user();
   return __result === undefined ? undefined : JSON.stringify(__result);
   })()
   ```
   - `JSON.stringify` 를 isolate 안에서 호출하므로 JSON-안전 데이터만 경계를 넘는다 (live 객체 — 예:
     반환된 dayjs 인스턴스 — 는 `toJSON` 으로 문자열화). `return` 없으면 `undefined` 유지(§5.1).
   - 컴파일 실패 → **pre-flight throw** (`handler.validate` 단계에서 검출, §6 참조).
   - **런타임 에러 라인 오프셋**: 래퍼가 사용자 코드 앞에 헤더 3줄(`(async () => {` · `"use strict";` ·
     `const __user = async () => {`)을 덧붙이므로 isolated-vm 이 보고하는 런타임 에러 라인은 사용자
     원본 기준 **+3** 이다. 표시 계층은 3을 빼 사용자 실제 라인으로 환산한다.
3. `isolated-vm` isolate(`memoryLimit: 128`) + context 를 만들어 `script.run(..., { promise: true, timeout })` 로 실행. 이중 타임아웃을 적용한다 (§7.2).
4. 정상 종료 → 사용자 `return` 값을 `output` 에 그대로 담고 `port: 'success'` 를 반환 (§5.1).
5. 런타임 throw / 타임아웃 → `port: 'error'` + `output.error` 표준 봉투 (§5.3, [CONVENTIONS Principle 3.2](../../conventions/node-output.md#32-outputerror-표준-형태)).
6. 정상 종료 시 **isolate 안의 최종 `$vars` 를 읽어(`copy: true`) `context.variables` 를 원자적으로
   전체 교체**한다 (§4.5). copy-out 이 실패하면(사용자가 직렬화 불가 값을 `$vars` 에 할당한 경우 등)
   실행 전 스냅샷 `varsClone` 으로 복원한다 — 읽기 실패 시 변수 미갱신 = 원본 보존. 실행 throw 시에도 원본 보존(롤백).

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
> Code 노드는 정상(§5.1) / 런타임 에러(§5.3) 두 케이스로 구성된다. 사용자 코드 본문의 throw / 타임아웃은 정상 시나리오의 일부로 간주하여 `error` 포트로 분기 (Data 공통 §4.1). **컴파일 실패** (isolate `compileScript` 구문 오류) 는 사용자 코드를 한 번도 실행하지 못한 상태이므로 §6 의 **pre-flight throw** 로 처리된다.

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

> `details.stack` 은 **`NODE_ENV !== 'production'` 일 때만** 포함된다 (프로덕션에서는 내부 파일 경로·
> isolate 라인 노출 방지로 생략 — §5.3 공통 필드 표). 위 예시는 비프로덕션 기준이다.

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

#### 5.3.3 메모리 초과 (isolate 128MB 하드 리밋)

config: `{ "code": "const a=[]; while(true){ a.push(new Array(1e6).fill(0)); }", "timeout": 30 }`

```json
{
  "config": {
    "language": "javascript",
    "code": "const a=[]; while(true){ a.push(new Array(1e6).fill(0)); }",
    "timeout": 30
  },
  "output": {
    "error": {
      "code": "CODE_MEMORY_LIMIT",
      "message": "Isolate was disposed during execution due to memory limit",
      "details": {
        "legacyCode": "EXECUTION_MEMORY_EXCEEDED",
        "stack": "..."
      }
    }
  },
  "meta": {
    "durationMs": 42,
    "success": false,
    "logs": []
  },
  "port": "error"
}
```

> `meta.durationMs` 는 메모리 초과 케이스에도 엔진이 주입한다 (§5.3 공통 필드 표) — 핸들러는
> `meta: { success, logs }` 만 반환하고 엔진이 실행 시간을 덧붙인다. 위 `42` 는 예시 값이다.

> isolate 가 `memoryLimit: 128`(MB) 를 초과하면 V8 이 isolate 를 즉시 폐기한다 (§7.2). 핸들러는 이 폐기 에러를 `EXECUTION_MEMORY_EXCEEDED` 로 분류해 `CODE_MEMORY_LIMIT` 로 정규화한다.

#### 5.3 공통 필드 표

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.language` | `'javascript'` | config echo (Principle 7) | 사용자가 선택한 언어 (default `javascript`) |
| `config.code` | string | config echo | 사용자 코드 본문 raw — 정상 케이스와 동일하게 echo (CONVENTIONS Principle 7) |
| `config.timeout` | number? | config echo | 사용자가 설정한 타임아웃 초 |
| `output.error.code` | string | handler return | 정규화된 에러 코드 — `CODE_TIMEOUT` / `CODE_EXECUTION_FAILED` / `CODE_MEMORY_LIMIT` (CONVENTIONS Principle 3.2 — `UPPER_SNAKE_CASE`) |
| `output.error.message` | string | handler return | 사람이 읽는 에러 메시지 (로그/디버깅용 원문) |
| `output.error.details.legacyCode` | string | handler return | 내부 분류용 legacy 코드 (`CODE_RUNTIME_ERROR` / `EXECUTION_TIMEOUT` / `EXECUTION_MEMORY_EXCEEDED`). 후속 노드는 `output.error.code` 사용 |
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
> | `EXECUTION_MEMORY_EXCEEDED` | `CODE_MEMORY_LIMIT` |

## 6. 에러 코드 (Pre-flight throw)

§5.3 (런타임 → `error` 포트) 외에, 다음 검증 실패는 **pre-flight throw** 로 처리된다 (CONVENTIONS Principle 3.1):

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `code` 가 빈 문자열 / 누락 | `Body of the code to run must be entered.` (warningRule source 문자열; 캔버스 배지는 i18n 렌더) | warningRule (캔버스 배지) + handler.validate |
| `code` 가 string 타입이 아님 | `code is required and must be a string` | handler.validate (zod default `''` 우회한 raw fixture 가드) |
| `timeout` 이 `[1, 120]` 밖 | `timeout must be a number between 1 and 120 seconds` | handler.validate (`validateCodeConfig`) |
| `language` 가 `javascript` 외 | (zod enum) `Invalid enum value. Expected 'javascript', received '...'` | schema parse 시점 |
| **`code` 컴파일 실패** (isolate `compileScript` 구문 오류) | `code has a syntax error: <V8 SyntaxError 메시지>` | handler.validate (사용자 코드를 한 번도 실행하지 못한 상태) |

> Pre-flight throw 는 사용자 코드를 단 한 번도 실행하지 못한 상태이므로 `error` 포트가 아닌 throw 로 처리한다 (Data 공통 §4.1). 캔버스 배지 / 실행 시작 직전 검증으로 즉시 노출된다.

## 7. 샌드박싱

[노드 실행 샌드박싱 정책](../0-overview.md#5-노드-실행-샌드박싱) 을 동일하게 적용한다 (Data 공통 §2).

### 7.1 격리 방식

| 방식 | 설명 |
|------|------|
| **현재 구현: `isolated-vm` (V8 Isolate)** | `new ivm.Isolate({ memoryLimit: 128 })` 로 host 와 분리된 별도 V8 Isolate 에서 코드 실행. host 객체·전역(`process`/`require`/`global`/`Buffer`/`fetch`)이 isolate 안에 **존재하지 않으므로** prototype-chain 탈출(`this.constructor.constructor('return process')()` 류)이 구조적으로 차단된다. 데이터(`$input`/`$vars`/`$execution`/`$node`)는 `ExternalCopy` 로 복사 주입, 내장 유틸(`$helpers`)·`console` 은 host 클로저를 `Reference`/`ivm.Callback` 으로 브리지(host realm 실행). 표준 내장(JSON/Math/Array 등)은 isolate 가 기본 제공. `eval`/`new Function` 은 부트스트랩에서 차단, 동적 `import`·모듈 로더 미제공으로 모듈 로드 불가 |
| 로드맵 (선택): 컨테이너 / gVisor | 다중 테넌트 확장으로 V8 자체 버그에 의한 isolate 탈출 가능성까지 차단해야 하면 Docker/gVisor 프로세스·커널 레벨 격리로 추가 강화 |

> **선택 근거**: `isolated-vm` 은 V8 Isolate 로 host 메모리 공간과 분리돼 prototype-chain sandbox escape 를 **구조적으로** 차단하고, isolate 단위 메모리 하드 리밋(128MB)·CPU 타임아웃을 강제할 수 있다. 네이티브 빌드(node-gyp) 의존성이 추가되나 CI 이미지 빌드 시 1회 컴파일로 흡수되어 배포 시점 복잡도는 없다. 상세 위협 모델·이력은 §Rationale 참조.

### 7.2 리소스 제한

| 항목 | 제한 | 설명 |
|------|------|------|
| 타임아웃 | 기본 30초 (1~120초) | isolate `script.run(..., { timeout })` (CPU 동기 무한루프 보호) + 외부 `Promise.race` (비동기 무한 대기 보호) **이중 적용** |
| 메모리 | **128MB 하드 리밋** | `isolated-vm` isolate `memoryLimit: 128`. 초과 시 isolate 가 실행을 중단하고 `CODE_MEMORY_LIMIT` 로 `error` 포트 분기 |
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

**차단**: isolated-vm isolate 에서 두 가지 차단 방식이 있다 (`code.handler.ts` 부트스트랩).
1. **부재 (host realm 미존재 → 참조 시 `ReferenceError`)**: `require`/`import`/`fetch`/`fs`/`process`/`Buffer`/`global` 등 Node host 전역·모듈은 isolate 안에 **애초에 존재하지 않는다** (host realm 객체라 isolate 에 주입하지 않는 한 도달 불가 — escape 차단의 핵심).
2. **부트스트랩 삭제 (`delete`)**: V8 Isolate 가 기본 제공하는 ECMAScript 내장 중 비결정성·메타프로그래밍·동적 실행 위험이 있는 것들(`eval`/`Function`/`Reflect`/`Proxy`/`Symbol`/`WeakMap`/`WeakSet`/`WeakRef`/`FinalizationRegistry`/`Atomics`/`SharedArrayBuffer`/`Intl`/`setTimeout`/`setInterval`/`setImmediate`/`queueMicrotask`)은 코드 실행 전 부트스트랩 스크립트가 globalThis 에서 제거한다.

| API | 차단 방식 | 차단 이유 |
|-----|-----------|-----------|
| `require`, `import` | 부재 (host realm) | 외부 모듈 로드 방지 |
| `fetch`, `XMLHttpRequest`, `WebSocket` | 부재 (host realm) | 네트워크 접근 차단 |
| `fs`, `path`, `os`, `child_process` 등 Node.js 모듈 | 부재 (host realm) | 시스템 접근 차단 |
| `process`, `global`, `Buffer` | 부재 (host realm) | 런타임 환경 접근 차단 (isolate 밖이라 prototype-chain 으로도 도달 불가) |
| `eval`, `Function` 생성자 | 부트스트랩 삭제 | 동적 코드 실행 방지 |
| `globalThis`, `Symbol` | 부트스트랩 삭제 | 런타임 환경 접근 / 메타프로그래밍 방지 |
| `Reflect`, `Proxy` | 부트스트랩 삭제 | 메타프로그래밍 방지 |
| `WeakMap`, `WeakSet`, `WeakRef`, `FinalizationRegistry`, `Atomics`, `SharedArrayBuffer`, `Intl` | 부트스트랩 삭제 | 비결정적 / cross-realm leak 방지 |
| `setTimeout`, `setInterval`, `setImmediate`, `queueMicrotask` | 부트스트랩 삭제 | 비결정적 스케줄링 차단 (Promise.race 타임아웃 흐름 단순화) |

## 8. 캔버스 요약

[Data 공통 §3](./0-common.md#3-캔버스-요약) — `Code` 행 인용 (`{language}`, 대문자 — `summaryTemplate: {{language|upper}}`. 코드 줄 수는 summaryTemplate DSL 미지원으로 미포함).

## Rationale

### `config.code` raw echo — Principle 7 의 "절대 echo 금지" 예외 아님 (2026-06-03 정합화)

`config.code` (사용자 코드 본문) 는 `NodeHandlerOutput.config` 에 **raw 그대로 echo** 한다. 한때 [CONVENTIONS Principle 7](../../conventions/node-output.md) 의 "절대 echo 금지" 목록에 `code.config.code` 가 있어 본 spec(§5.1 config echo) 과 모순됐으나, 이는 두 개념의 혼동이었다:

- **expression 평가 제외** (`expression-exclusions` 등록) — 코드 본문 안의 `{{ }}` 를 평가하지 않는다 (코드가 곧 데이터이므로). 이것이 등록의 의미.
- **echo 금지** — `config` 에 싣지 않는다. 코드 본문은 여기 해당하지 **않는다**.

코드 본문은 `systemPrompt`/`userPrompt`/`body` 와 동일 부류의 사용자 작성 raw 텍스트로, 디버깅·후속 노드 참조를 위해 echo 한다 (비민감 — 사용자 본인 코드, 에디터/UI 로 크기 bounded). 따라서 Principle 7 "항상 echo" 목록에 속한다. (정합화로 `node-output.md` Principle 7 금지 목록에서 `code.config.code` 삭제 + "항상 echo" 로 이동.)

### `output` root 직접 배치 — Principle 8.2 의 `output.result` 래핑 미적용 (2026-06-03 정합화)

Code 노드의 `output` 은 사용자 `return` 값을 **root 에 그대로** 담는다 (§5.1) — `output.result` 래핑을 적용하지 않는다. `output.result` 래핑은 [CONVENTIONS Principle 8.2](../../conventions/node-output.md) 의 **LLM 계열 노드 (ai_agent / text_classifier / information_extractor) 한정** 규칙이다. Code(및 Transform)는 사용자 코드/연산이 출력 shape 을 결정하므로 인위적 `result` 래핑은 다운스트림 expression 만 장황하게 만든다 (`$node["X"].output.result.foo` vs `$node["X"].output.foo`). 한때 Principle 8.2 표의 "코드 실행 결과 → `output.result`" 행이 이 결정과 모순됐으나, 정합화로 해당 행을 "root 직접 배치 (Code/Transform 예외)" 로 정정했다.

**기각된 대안**: Code 출력을 `output.result` 로 래핑 — LLM 계열과의 표면적 일관성은 얻지만, 사용자가 `return { result: ... }` 를 직접 쓰면 `output.result.result` 이중 중첩이 발생하고, primitive return(`return 42`)이 `output.result: 42` 로 어색해진다. 사용자 코드의 자유로운 shape 가 핵심 가치이므로 root 직접 배치를 유지.

### 격리 방식 `isolated-vm` 전환 — 위협 모델과 결정 (2026-06-11)

**위협 모델**: code 노드 작성 권한은 **Editor 이상**이다. 플랫폼은 code 노드의 사용자 코드를 **신뢰할 수 없는 코드(untrusted)** 로 취급한다 (다중 워크스페이스 안전 posture — self-host 단일 테넌트 가정에 기대지 않는다). 따라서 사용자 코드가 호스트(백엔드 프로세스)를 장악하는 경로를 **구조적으로** 차단해야 한다. 호스트 프로세스 메모리에는 DB 자격증명·`ENCRYPTION_KEY`·배포 환경의 서비스 토큰·내부망 접근권이 존재하므로, host realm 도달은 곧 인증 우회·secret 탈취·SSRF 로 직결된다.

**기존 `node:vm` 의 한계**: `node:vm` 은 전역 미주입(`process`/`require`/`Buffer` 등)으로 모듈 로드·네트워크·파일시스템은 차단했으나, sandbox 와 host 가 **동일 V8 realm** 을 공유해 `this.constructor.constructor('return process')()` 류의 prototype-chain 으로 host 의 `Function` 생성자에 도달, host realm 객체(`process` 등)를 획득하는 escape 가 가능했다. (이전 spec §7.1 "선택 근거" 가 "완벽한 sandbox escape 방어는 불가 … 추후 `isolated-vm` 등으로 재검토" 로 이미 인지·기록한 트레이드오프.)

**결정**: 사용자 결정(2026-06-11)으로 spec 로드맵이 지정했던 `isolated-vm`(V8 Isolate) 으로 전환한다 — 이로써 구 §7.1 "선택 근거" 가 "추후 재검토" 로 남겨둔 로드맵 항목을 본 결정으로 **종결**한다. Isolate 는 host 와 **별도의 V8 힙·realm** 을 가져 host 객체가 isolate 안에 존재하지 않으므로 prototype-chain escape 가 성립하지 않는다. 부수적으로 isolate 단위 메모리 하드 리밋(128MB, `CODE_MEMORY_LIMIT`)·CPU 타임아웃 강제가 가능해진다. 동시에 vm sandbox 에 `Promise` 생성자가 노출돼 있던 별도 위험(refactor 04 M-2)도 흡수된다 — Promise(async/await)는 §4.1 의 기능 약속이라 **유지**하되, 격리 계층이 그로 인한 탈출면을 무력화한다.

**기각된 대안**:
- **`worker_threads` 권한 박탈** — worker 는 host 와 동일 프로세스 주소공간을 공유하는 보안 경계가 아니라 격리 강도를 본질적으로 개선하지 못한다.
- **컨테이너/gVisor 즉시 전환** — 격리 강도는 최강이나 노드 실행마다 컨테이너 기동·런타임 의존(self-host 부담)이라 운영 복잡도 대비 과도. V8 자체 버그에 의한 isolate 탈출까지 막아야 할 다중 테넌트 확장 시점의 **후속 강화**로 §7.1 로드맵에 남긴다.
- **현상 유지 + frozen-prototype 단기완화** — 우회 경로가 다수라 근본 차단이 아니며 다중 워크스페이스에서 수용 불가.

**트레이드오프**: 네이티브 빌드(node-gyp) 의존성이 추가된다. CI 이미지 빌드 시 1회 컴파일로 흡수되어 배포 시점 복잡도는 0 이나, 빌드 환경(alpine/musl 포함)에 C++ 툴체인이 필요하다. `$helpers`·`console` 은 host 클로저를 `Reference`/`ivm.Callback` 으로 브리지하므로 host realm 에서 실행되어 기존 사용자 코드(dayjs·crypto·base64) 호환성은 보존된다. isolated-vm 버전은 `node>=22` 를 지원하는 `6.x` 라인을 사용한다 (`7.x` 는 `node>=26` 요구 — Node 26 승급 시 재검토).
