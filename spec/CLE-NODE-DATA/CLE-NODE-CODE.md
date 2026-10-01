---
id: "CLE-NODE-CODE"
title: "Code 노드"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-CODE-001", "REQ-CODE-002", "REQ-CODE-003", "REQ-CODE-004", "REQ-CODE-005", "REQ-CODE-006", "REQ-CODE-007", "REQ-CODE-008", "REQ-CODE-009", "REQ-CODE-010", "REQ-CODE-011", "REQ-CODE-012", "REQ-CODE-013", "REQ-CODE-014", "REQ-CODE-015", "REQ-CODE-016", "REQ-CODE-017", "REQ-CODE-018", "REQ-CODE-019", "REQ-CODE-020", "REQ-CODE-021", "REQ-CODE-022", "REQ-CODE-023", "REQ-CODE-024", "REQ-CODE-025", "REQ-CODE-026", "REQ-CODE-027", "REQ-CODE-028", "REQ-CODE-029", "REQ-CODE-030"]
basis_superseded: false
parent: "CLE-NODE-DATA"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-DATA"]
area: "CLE-NODE-DATA"
content_hash: "a418e51316afe195b9b2cc02bafe880f331ef6e218b1c0cf4bc92c80bfffff85"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/5-data/2-code.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "099dd30fbc2e93e5fec8a23f72fafd3bec1569c2d2b9d04948839b2a83acd7bf"
etag: "sha256-c93250b5aef7713d93d21dd5f571200c42292d7791c8884eed8e5a041e0b0bd0"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/5-data/2-code.md`, `spec/4-nodes/_product-overview.md` (§8.2) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Code 노드(`code`)는 사용자가 쓴 JavaScript 로 데이터를 자유롭게 처리하는 노드다. [Transform 노드](CLE-NODE-TRANSFORM.md)로 표현하기 어려운 로직(분기, 재귀, 복합 변환, 해시 등)에 쓴다. 사용자 코드의 throw·타임아웃은 정상 시나리오의 일부로 보고 런타임 에러 포트(`error`)로 보낸다.

사용자 코드는 노드 샌드박스(`isolated-vm`)에서 실행한다. 샌드박스의 격리 방식, 리소스 제한, 허용·차단 API 는 이 문서가 정한다. 노드 샌드박스를 어느 노드에 적용하는지는 [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md), Data 노드 공통 규약은 [Data 노드 공통](CLE-NODE-DATA-COMMON.md)이 정한다. 워크플로우 변수의 시스템 예약 변수 규칙은 [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md)가 정한다.

## 요구사항

- REQ-CODE-001 WHEN 노드가 실행되면 THE SYSTEM SHALL 사용자가 쓴 JavaScript 코드를 실행하고 `return` 값을 `output` 에 담는다. (원본: ND-CD-01, ND-CD-04)
- REQ-CODE-002 WHEN 코드가 실행되면 THE SYSTEM SHALL 앞 노드의 출력 데이터를 `$input` 으로 노출한다. (원본: ND-CD-02)
- REQ-CODE-003 WHEN 코드가 실행되면 THE SYSTEM SHALL 워크플로우 변수를 `$vars` 로 읽고 쓰게 한다. (원본: ND-CD-03)
- REQ-CODE-004 IF 코드에 `return` 이 없으면 THE SYSTEM SHALL `output` 을 `undefined` 로 둔다. (원본: ND-CD-04)
- REQ-CODE-005 WHEN 사용자가 코드를 편집하면 THE SYSTEM SHALL 구문 강조·줄 번호·자동완성이 있는 Monaco 스타일 에디터를 제공하고 `$input`·`$vars`·`$execution`·`$node`·`$helpers` 를 자동완성한다. (원본: ND-CD-05)
- REQ-CODE-006 WHEN 코드가 실행되면 THE SYSTEM SHALL 호스트와 분리된 `isolated-vm` isolate 에서 실행한다. (원본: ND-CD-06)
- REQ-CODE-007 WHEN 코드가 실행되면 THE SYSTEM SHALL `timeout`(기본 30초, 1~120초)을 isolate 실행 타임아웃과 바깥 `Promise.race` 두 겹으로 건다. (원본: ND-CD-06)
- REQ-CODE-008 WHEN isolate 를 만들면 THE SYSTEM SHALL 메모리 한도를 기본 128MB 로 걸고 `CODE_NODE_MEMORY_LIMIT_MB` 로 조정하되 512MB 를 넘으면 512MB 로 자른다. (원본: ND-CD-06)
- REQ-CODE-009 WHEN 코드가 실행되면 THE SYSTEM SHALL 네트워크·파일시스템·모듈 로드를 막는다. (원본: ND-CD-06)
- REQ-CODE-010 WHILE `NODE_ENV` 가 `production` 이 아닌 동안 THE SYSTEM SHALL 런타임 에러의 스택 트레이스를 `output.error.details.stack` 과 에디터 인라인에 보인다. (원본: ND-CD-07)
- REQ-CODE-011 WHILE `NODE_ENV` 가 `production` 인 동안 THE SYSTEM SHALL 스택 트레이스를 응답에 싣지 않는다.
- REQ-CODE-012 WHEN 코드가 실행되면 THE SYSTEM SHALL `async`·`await`·`Promise` 와 최상위 `await` 를 허용한다.
- REQ-CODE-013 WHEN 코드가 실행되면 THE SYSTEM SHALL `eval`·`new Function`·동적 `import(...)` 를 막는다.
- REQ-CODE-014 IF 사용자 코드가 throw 하면 THE SYSTEM SHALL `CODE_EXECUTION_FAILED` 로 에러 포트에 보낸다.
- REQ-CODE-015 IF 실행이 타임아웃되면 THE SYSTEM SHALL `CODE_TIMEOUT` 으로 에러 포트에 보낸다.
- REQ-CODE-016 IF isolate 가 메모리 한도를 넘으면 THE SYSTEM SHALL `CODE_MEMORY_LIMIT` 로 에러 포트에 보낸다.
- REQ-CODE-017 IF 코드 컴파일이 실패하면 THE SYSTEM SHALL 사전 검증 에러로 실행을 실패시킨다.
- REQ-CODE-018 IF `timeout` 이 1~120 밖이거나 `code` 가 비었거나 문자열이 아니면 THE SYSTEM SHALL 사전 검증 에러로 실행을 실패시킨다.
- REQ-CODE-019 WHEN 코드가 실행되기 전이면 THE SYSTEM SHALL `context.variables` 를 깊은 복사해 `$vars` 로 넣는다.
- REQ-CODE-020 WHEN 코드가 정상 종료하면 THE SYSTEM SHALL isolate 안의 최종 `$vars` 로 `context.variables` 를 통째로 한 번에 바꾼다.
- REQ-CODE-021 IF 코드가 throw 하면 THE SYSTEM SHALL `context.variables` 를 바꾸지 않는다.
- REQ-CODE-022 IF 최종 `$vars` 를 꺼내 오지 못하면 THE SYSTEM SHALL 실행 전 스냅샷으로 되돌린다.
- REQ-CODE-023 WHEN 반환 값을 넘기면 THE SYSTEM SHALL isolate 안에서 `JSON.stringify` 해 JSON 으로 안전한 데이터만 경계를 넘긴다.
- REQ-CODE-024 WHEN 코드가 `console.log`·`warn`·`error` 를 부르면 THE SYSTEM SHALL `[level] payload` 형식으로 최대 100줄을 `meta.logs` 에 담는다.
- REQ-CODE-025 IF `$helpers.crypto.hash`·`$helpers.base64.encode`·`$helpers.base64.decode` 에 문자열이 아닌 값이 들어오면 THE SYSTEM SHALL `TypeError` 를 던진다.
- REQ-CODE-026 WHEN `$helpers.base64.decode` 가 유효하지 않은 base64 문자열을 받으면 THE SYSTEM SHALL 예외 없이 best-effort 결과를 돌려준다.
- REQ-CODE-027 WHEN 실행마다 isolate 를 만들면 THE SYSTEM SHALL 모듈 로드 때 한 번 만든 dayjs 힙 스냅샷에서 만들고, 스냅샷을 쓸 수 없으면 dayjs 를 매번 컴파일한다.
- REQ-CODE-028 WHEN 실행이 끝나면 THE SYSTEM SHALL isolate 를 버리고 실행 사이에 상태를 공유하지 않는다.
- REQ-CODE-029 WHEN 런타임 에러 줄 번호를 보이면 THE SYSTEM SHALL 래퍼 머리 3줄을 빼서 사용자 원본 기준 줄로 바꾼다.
- REQ-CODE-030 WHEN 설정을 에코하면 THE SYSTEM SHALL `code` 본문을 평가하지 않은 원본 그대로 길이 제한 없이 싣는다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `language` | `'javascript'` | ✓ | `javascript` | 실행 언어. 지금은 javascript 만 지원 |
| `code` | String | ✓ | `''` | 실행할 코드 본문. `return` 으로 출력 값을 돌려준다 |
| `timeout` | Number | | `30` | 실행 타임아웃(초). 1~120초 |

`code` 본문에서는 표현식(`{{ }}`)을 **쓰지 않는다**. 입력 데이터는 코드 안에서 `$input`·`$vars` 변수로 직접 읽는다. 엔진은 표현식 제외 키(`EXPRESSION_EXCLUSIONS`, `codebase/backend/src/modules/execution-engine/expression/expression-exclusions.ts`)에 따라 `code` 를 평가하지 않고 그대로 넘긴다.

설정 스키마의 단일 기준은 `codebase/backend/src/nodes/data/code/code.schema.ts` 의 `codeNodeConfigSchema`·`codeNodeMetadata` 다.

## 설정 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|---------------|------|
| 머리 | 위 | Language 드롭다운, Timeout 입력(1–120초) | |
| 코드 에디터 | 가운데 | Monaco 스타일 에디터 | 구문 강조·줄 번호·자동완성. `$input`·`$vars`·`$execution`·`$node`·`$helpers` 자동완성 |
| Console Output | 에디터 아래 | 마지막 실행의 `console.log` 출력 | 최대 100줄 |
| Result Preview | 맨 아래 | 마지막 실행의 `output` JSON | |

에러가 나면 에디터 안에 인라인 에러와 스택 트레이스를 보인다(개발 환경 한정).

### 사용자 코드의 실행 컨텍스트

| 객체 | 타입 | 설명 |
|------|------|------|
| `$input` | Object | 앞 노드의 출력 데이터 |
| `$vars` | Object | 워크플로우 변수(읽기·쓰기, 아래 "`$vars` 쓰기 처리") |
| `$execution` | Object | 실행 컨텍스트 `{executionId, workflowId}` |
| `$node` | Object | 현재 노드 메타데이터 `{id, label}` |
| `$helpers` | Object | 내장 유틸리티(아래 표) |
| `console.log/warn/error` | Function | 실행 로그(최대 100줄 캡처) |

이 변수들은 Code 노드 런타임 전용이며 이름이 같은 표현식 내장 변수와 모양이 다르다. 표현식에서 워크플로우 변수는 `$var` 로 읽고, `$execution` 은 `id` 필드를 쓰며, `$node` 는 다른 노드의 노드 출력을 가리킨다([표현식 언어](../CLE-WF/CLE-WF-EXPR.md)). Code 노드는 `$vars` 를 쓰고, `$execution` 은 `executionId` 필드를 쓰며, `$node` 는 현재 노드 메타데이터다. 필드 이름을 통일할지는 [미결 사항](#미결-사항)이다.

### 내장 유틸리티 (`$helpers`)

| 유틸리티 | 설명 |
|----------|------|
| `$helpers.date(value)` | 날짜 파싱·포맷(dayjs 호환) |
| `$helpers.crypto.hash(algorithm, data)` | 해시 생성. 허용 알고리즘은 `sha256`·`sha384`·`sha512`·`sha1`·`md5`. `md5`·`sha1` 은 체크섬·옛 시스템 호환 전용이며 서명·비밀번호·무결성 보증 같은 암호학적 용도에는 쓰지 않는다(충돌 공격에 취약) |
| `$helpers.crypto.uuid()` | UUID v4 생성 |
| `$helpers.base64.encode(data)` | Base64 인코딩. `data` 는 문자열이어야 하며 문자열이 아니면 `TypeError`(런타임 에러 → `error` 포트) |
| `$helpers.base64.decode(data)` | Base64 디코딩. `data` 는 문자열이어야 하며 문자열이 아니면 `TypeError`. 유효하지 않은 base64 문자열은 예외 없이 best-effort 디코딩 결과를 돌려준다(Buffer 의 관대한 디코딩) |

`$helpers` 입력 타입 계약: `crypto.hash`·`base64.encode`·`base64.decode` 는 문자열이 아닌 인자에 `TypeError` 를 던진다(`error` 포트, `CODE_EXECUTION_FAILED`). 조용한 강제 변환이 숨기는 타입 버그를 드러내기 위해서다. 유효하지 않은 base64 문자열은 타입이 문자열이라 타입 에러가 아니므로 예외 없이 결과를 돌려준다.

## 포트

| 방향 | id | label | type | dynamic | 설명 |
|------|----|-------|------|---------|------|
| 입력 | `in` | Input | data | false | 사용자 코드의 `$input` 으로 노출되는 데이터 |
| 출력 | `success` | Success | data | false | 사용자 코드 정상 종료. `output` 은 `return` 값 |
| 출력 | `error` | Error | data | false | 런타임 에러. `output.error.{code, message, details?}` |

동적 포트는 없다. `error` 포트의 type 이 다른 노드들과 달리 `data` 로 선언돼 있다. [미결 사항](#미결-사항) 참조.

## 실행 로직

1. 핸들러가 입력을 `$input` 에, `context.variables` 의 깊은 복사본을 `$vars` 에 바인딩한다(아래 "`$vars` 쓰기 처리").
2. 사용자 `code` 를 **2단 async 래퍼**로 감싸 isolate `compileScript` 로 컴파일한다. 바깥은 즉시 실행하는 IIFE, 안쪽은 사용자 코드를 담은 `__user` 화살표 함수이며, 결과 직렬화를 isolate **경계 안에서** 한다.
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
   - `JSON.stringify` 를 isolate 안에서 부르므로 JSON 으로 안전한 데이터만 경계를 넘는다. 반환된 dayjs 인스턴스 같은 살아 있는 객체는 `toJSON` 으로 문자열이 된다. `return` 이 없으면 `undefined` 를 유지한다.
   - 컴파일에 실패하면 사전 검증 에러다(`handler.validate` 단계에서 잡는다).
   - **런타임 에러 줄 오프셋**: 래퍼가 사용자 코드 앞에 머리 3줄(`(async () => {` · `"use strict";` · `const __user = async () => {`)을 붙이므로 isolated-vm 이 보고하는 런타임 에러 줄은 사용자 원본 기준 **+3** 이다. 표시 층이 3을 빼서 사용자 실제 줄로 바꾼다.
3. `isolated-vm` isolate(`memoryLimit` 기본 128MB, `CODE_NODE_MEMORY_LIMIT_MB` 로 조정)와 context 를 만든다. `$helpers.date` 가 쓰는 dayjs 는 매 실행마다 다시 컴파일하지 않고 **모듈 로드 때 한 번 만든 힙 스냅샷(`createSnapshot`)에서 복원**한다. 스냅샷을 지원하지 않는 플랫폼에서는 실행마다 dayjs 소스를 컴파일하는 대체 경로로 동작한다. 그다음 `script.run(..., { promise: true, timeout })` 으로 실행하며 타임아웃을 두 겹으로 건다.
4. 정상 종료하면 사용자 `return` 값을 `output` 에 그대로 담고 `port: 'success'` 를 돌려준다.
5. 런타임 throw·타임아웃이면 `port: 'error'` 와 `output.error`([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 3.2)를 돌려준다.
6. 정상 종료하면 **isolate 안의 최종 `$vars` 를 읽어(`copy: true`) `context.variables` 를 통째로 한 번에 바꾼다**. 꺼내 오기에 실패하면(사용자가 직렬화할 수 없는 값을 `$vars` 에 넣은 경우 등) 실행 전 스냅샷 `varsClone` 으로 되돌린다. 읽기에 실패하면 변수를 바꾸지 않으므로 원본이 남는다. 실행이 throw 해도 원본이 남는다(롤백).

### 코드 작성 규칙

- `return` 으로 출력 데이터를 돌려준다. `return` 이 없으면 `output` 은 `undefined` 다.
- 비동기 코드를 쓸 수 있다. `async`·`await`·`Promise` 모두 되고 최상위 `await` 도 된다.
- 외부 네트워크·파일시스템·모듈 로드는 안 된다(아래 "샌드박스").
- `eval`·`new Function`·동적 `import(...)` 는 막는다.

### `$vars` 쓰기 처리 (깊은 복사 + 통째 교체)

`$vars` 는 읽고 쓸 수 있다. 변경은 격리 context 안의 깊은 복사본에서 일어나고, 실행이 끝난 뒤 메인 컨텍스트로 **한 번에** 반영한다.

1. 실행 전: `context.variables` 를 `JSON.parse(JSON.stringify(...))` 로 깊은 복사해 샌드박스의 `$vars` 로 넣는다.
2. 실행 중: 격리 context 안에서 자유롭게 바꾼다(중첩 객체 추가·삭제·수정 포함).
3. 정상 종료 후: 복사본 `$vars` 로 `context.variables` 를 **통째로 바꾼다**(부분 병합이 아님).
4. throw 후: 메인 컨텍스트 `$vars` 는 바뀌지 않는다(롤백).

통째로 바꾸므로 사용자 코드가 시스템 예약 변수(`__` 로 시작, 예: `__workspaceId`)까지 덮어쓸 수 있다. 이 때문에 워크스페이스 신뢰 경계가 위조될 수 있다는 잔여 위험과 그에 대한 강제 계층은 [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md)의 시스템 예약 변수 규칙이 정한다.

## 출력 구조

노드 출력은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 11 형식을 따른다. JSON 예시는 `undefined` 필드를 생략하고, 다섯 필드 밖의 최상위 키는 두지 않는다. 케이스는 정상 종료와 런타임 에러 둘이다. 컴파일 실패(isolate `compileScript` 구문 에러)는 사용자 코드를 한 번도 실행하지 못한 상태이므로 사전 검증 에러로 처리한다.

### 정상 종료 (`success`)

설정 `{ "language": "javascript", "code": "return $input.value * 2;" }`, 입력 `{ "value": 21 }`:

```json
{
  "config": {
    "language": "javascript",
    "code": "return $input.value * 2;",
    "timeout": 30
  },
  "output": 42,
  "meta": { "durationMs": 7, "success": true, "logs": [] },
  "port": "success"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.language` | `'javascript'` | 설정 에코 | 사용자가 고른 언어(기본 `javascript`) |
| `config.code` | string | 설정 에코 | 사용자 코드 원본. 표현식 평가에서 빠지므로 `{{ }}` 가 있어도 평가하지 않는다. 길이 제한 없음 |
| `config.timeout` | number? | 설정 에코 | 사용자가 정한 타임아웃(초). 없으면 기본 `30` |
| `output` | any | 런타임(사용자 `return` 값) | 원시값(`42`)·객체·배열·`undefined`(`return` 없음) 모두 가능. 모양은 사용자 코드가 정한다(Principle 8 의 `output.result` 감싸기를 쓰지 않는다) |
| `meta.durationMs` | number | 엔진 주입 | 실행 시간(ms) |
| `meta.success` | `true` | 핸들러 반환 | Code 노드 전용 편의 필드(Principle 2) |
| `meta.logs` | string[] | 핸들러 반환 | `console.log/warn/error` 캡처. `[level] payload` 형식, 최대 100줄 |
| `port` | `'success'` | 핸들러 반환 | 정상 종료 분기 |

표현식 접근 예: `$node["X"].output` → `42`, `$node["X"].meta.success` → `true`, `$node["X"].meta.logs` → `[]`.

객체를 돌려주는 예(코드 `console.log('processing', 1); return { ok: true };`):

```json
{
  "config": { "language": "javascript", "code": "console.log('processing', 1); return { ok: true };", "timeout": 30 },
  "output": { "ok": true },
  "meta": { "durationMs": 9, "success": true, "logs": ["[log] processing 1"] },
  "port": "success"
}
```

`return` 이 없는 예(코드 `const x = 1;`). `output` 이 `undefined` 라서 생략하고, 뒤쪽 노드에서 `$node["X"].output` 은 `undefined` 로 평가된다.

```json
{
  "config": { "language": "javascript", "code": "const x = 1;", "timeout": 30 },
  "meta": { "durationMs": 1, "success": true, "logs": [] },
  "port": "success"
}
```

### 런타임 에러 (`error`)

사용자 코드 안의 throw(설정 `{ "code": "throw new Error('boom');" }`):

```json
{
  "config": { "language": "javascript", "code": "throw new Error('boom');", "timeout": 30 },
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
  "meta": { "durationMs": 5, "success": false, "logs": [] },
  "port": "error"
}
```

`details.stack` 은 `NODE_ENV !== 'production'` 일 때만 넣는다. 프로덕션에서는 내부 파일 경로와 isolate 줄이 드러나지 않게 생략한다. 위 예시는 프로덕션이 아닌 환경 기준이다. 스택 노출은 `NODE_ENV` 의 production·그 외 이분법을 따르므로, 외부에 노출되는 스테이징 환경은 `NODE_ENV=production` 으로 운영해 스택이 응답에 실리지 않게 한다(refactor 04 m-2). 운영과 같은 동작이 돼 환경 차이 버그도 줄어든다. 스테이징에서 스택을 봐야 하는 실무 요구가 확인되면 환경 이름과 분리된 별도 플래그를 다시 검토한다.

타임아웃(설정 `{ "code": "while (true) {}", "timeout": 1 }` 또는 `await new Promise(() => {})`):

```json
{
  "config": { "language": "javascript", "code": "while (true) {}", "timeout": 1 },
  "output": {
    "error": {
      "code": "CODE_TIMEOUT",
      "message": "Code execution timed out",
      "details": { "legacyCode": "EXECUTION_TIMEOUT", "stack": "..." }
    }
  },
  "meta": { "durationMs": 1000, "success": false, "logs": [] },
  "port": "error"
}
```

메모리 초과(isolate 기본 128MB 하드 리밋, 설정 `{ "code": "const a=[]; while(true){ a.push(new Array(1e6).fill(0)); }", "timeout": 30 }`):

```json
{
  "config": { "language": "javascript", "code": "const a=[]; while(true){ a.push(new Array(1e6).fill(0)); }", "timeout": 30 },
  "output": {
    "error": {
      "code": "CODE_MEMORY_LIMIT",
      "message": "Isolate was disposed during execution due to memory limit",
      "details": { "legacyCode": "EXECUTION_MEMORY_EXCEEDED", "stack": "..." }
    }
  },
  "meta": { "durationMs": 42, "success": false, "logs": [] },
  "port": "error"
}
```

isolate 가 `memoryLimit` 을 넘으면 V8 이 isolate 를 즉시 버린다. 핸들러는 이 에러를 `EXECUTION_MEMORY_EXCEEDED` 로 분류하고 `CODE_MEMORY_LIMIT` 로 정규화한다. 핸들러는 `meta: { success, logs }` 만 돌려주고 엔진이 실행 시간(`durationMs`)을 덧붙인다. 위 `42` 는 예시 값이다.

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | 정상 케이스와 같음 | 설정 에코 | 사용자 코드 원본을 정상 케이스와 같게 에코 |
| `output.error.code` | string | 핸들러 반환 | 정규화한 에러 코드 `CODE_TIMEOUT`·`CODE_EXECUTION_FAILED`·`CODE_MEMORY_LIMIT` (UPPER_SNAKE_CASE) |
| `output.error.message` | string | 핸들러 반환 | 사람이 읽는 에러 메시지(로그·디버깅용 원문) |
| `output.error.details.legacyCode` | string | 핸들러 반환 | 내부 분류용 옛 코드(`CODE_RUNTIME_ERROR`·`EXECUTION_TIMEOUT`·`EXECUTION_MEMORY_EXCEEDED`). 뒤쪽 노드는 `output.error.code` 를 쓴다 |
| `output.error.details.stack` | string? | 핸들러 반환 | 스택 트레이스. `NODE_ENV !== 'production'` 일 때만 |
| `meta.durationMs` | number | 엔진 주입 | 실행 시간(ms). 타임아웃이면 timeout 값에 가깝다 |
| `meta.success` | `false` | 핸들러 반환 | 실패 표시 |
| `meta.logs` | string[] | 핸들러 반환 | 에러 직전까지의 console 캡처 |
| `port` | `'error'` | 핸들러 반환 | 런타임 에러 분기 |

표현식 접근 예(런타임 throw): `$node["X"].output.error.code` → `"CODE_EXECUTION_FAILED"`, `$node["X"].output.error.message` → `"boom"`, `$node["X"].output.error.details.legacyCode` → `"CODE_RUNTIME_ERROR"`, `$node["X"].port` → `"error"`.

내부 코드를 정규화하는 매핑(`EXECUTION_TIMEOUT` → `CODE_TIMEOUT`, `CODE_RUNTIME_ERROR` → `CODE_EXECUTION_FAILED`, `EXECUTION_MEMORY_EXCEEDED` → `CODE_MEMORY_LIMIT`)의 단일 기준은 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md)의 내부 전용 분류 코드 절이다.

## 에러 코드

런타임 에러는 위 "런타임 에러" 표를 본다. 다음 검증 실패는 사전 검증 에러로 처리한다(노드 출력 규약 Principle 3.1).

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `code` 가 빈 문자열이거나 없음 | `Body of the code to run must be entered.` (경고 규칙 원문. 캔버스 배지는 i18n 으로 렌더) | 경고 규칙(캔버스 배지) + handler.validate |
| `code` 가 문자열이 아님 | `code is required and must be a string` | handler.validate (zod 기본값 `''` 를 우회한 원본 fixture 가드) |
| `timeout` 이 `[1, 120]` 밖 | `timeout must be a number between 1 and 120 seconds` | handler.validate (`validateCodeConfig`) |
| `language` 가 `javascript` 가 아님 | (zod enum) `Invalid enum value. Expected 'javascript', received '...'` | 스키마 파싱 |
| `code` 컴파일 실패(isolate `compileScript` 구문 에러) | `code has a syntax error: <V8 SyntaxError 메시지>` | handler.validate (사용자 코드를 한 번도 실행하지 못한 상태) |

사전 검증 에러는 사용자 코드를 한 번도 실행하지 못한 상태이므로 `error` 포트가 아니라 throw 로 처리한다. 캔버스 배지나 실행 직전 검증으로 바로 드러난다.

## 샌드박스

노드 샌드박스 정책([노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md))을 이 노드에 적용한 세부 규칙이다.

### 격리 방식

| 방식 | 설명 |
|------|------|
| **현재 구현: `isolated-vm`(V8 Isolate)** | `new ivm.Isolate({ memoryLimit: ISOLATE_MEMORY_LIMIT_MB })`(`resolveMemoryLimitMb()`, 기본 128MB, `CODE_NODE_MEMORY_LIMIT_MB` 로 조정·상한 512)로 호스트와 분리한 별도 V8 Isolate 에서 코드를 실행한다. 호스트 객체와 전역(`process`·`require`·`global`·`Buffer`·`fetch`)이 isolate 안에 **없으므로** prototype chain 탈출(`this.constructor.constructor('return process')()` 류)이 구조적으로 막힌다. 데이터(`$input`·`$vars`·`$execution`·`$node`)는 `ExternalCopy` 로 복사해 넣고, 내장 유틸(`$helpers`)과 `console` 은 호스트 클로저를 `Reference`·`ivm.Callback` 으로 잇는다(호스트 realm 에서 실행). 표준 내장(JSON·Math·Array 등)은 isolate 가 기본 제공한다. `eval`·`new Function` 은 부트스트랩에서 막고, 동적 `import`·모듈 로더를 제공하지 않아 모듈을 로드할 수 없다 |
| 로드맵(선택): 컨테이너·gVisor | 다중 테넌트로 넓혀 V8 자체 버그에 의한 isolate 탈출까지 막아야 하면 Docker·gVisor 프로세스·커널 수준 격리로 더 강화한다 |

**dayjs 스냅샷 최적화**: `$helpers.date` 가 쓰는 dayjs 런타임은 매 실행마다 다시 컴파일하지 않는다. 모듈 로드 때 `ivm.Isolate.createSnapshot()` 으로 **한 번 힙 스냅샷**을 만들고, 실행마다 그 스냅샷에서 isolate 를 만든다. 스냅샷에는 **순수 JS(dayjs)만** 들어간다. 호스트 콜백(`$helpers` crypto·base64, `console`) 연결과 아래 전역 차단은 실행마다 부트스트랩에서 그대로 한다(스냅샷은 호스트 바인딩을 담지 않는다). **실행마다 isolate 를 만들고, 메모리 하드 리밋을 걸고, 끝나면 버리고, 실행 사이에 상태를 공유하지 않는다는 불변식은 같다.** `createSnapshot` 을 지원하지 않거나 실패하는 플랫폼에서는 실행마다 dayjs 를 컴파일하는 경로로 투명하게 돌아간다.

### 리소스 제한

| 항목 | 제한 | 설명 |
|------|------|------|
| 타임아웃 | 기본 30초(1~120초) | isolate `script.run(..., { timeout })`(CPU 동기 무한 루프 보호)과 바깥 `Promise.race`(비동기 무한 대기 보호)를 **둘 다** 건다 |
| 메모리 | **기본 128MB 하드 리밋(환경 변수로 조정)** | isolate `memoryLimit`. 운영자는 `CODE_NODE_MEMORY_LIMIT_MB` 로 조정한다(기본 `128`, **안전 상한 `512`**, 넘으면 512 로 자른다). 넘으면 isolate 가 실행을 멈추고 `CODE_MEMORY_LIMIT` 로 `error` 포트에 보낸다 |
| 네트워크 | 완전 차단 | `fetch`·`XMLHttpRequest`·`WebSocket` 을 넣지 않는다 |
| 파일시스템 | 접근 불가 | `fs`·`path`·`child_process` 등을 넣지 않는다 |
| 모듈 | require·import 불가 | 모듈 로더를 제공하지 않는다. 내장 유틸리티만 전역에 넣는다 |
| 전역 객체 | 제한된 전역만 허용 | 아래 "허용·차단 API" |

### 허용·차단 API

허용(전역 주입):

| API | 설명 |
|-----|------|
| `$input`, `$vars`, `$execution`, `$node` | 실행 컨텍스트 객체 |
| `$helpers` | 내장 유틸리티 |
| `console.log/warn/error` | 디버그 로그(최대 100줄 캡처) |
| `JSON.parse`, `JSON.stringify` | JSON 처리 |
| `Array`, `Object`, `String`, `Number`, `Boolean`, `Date`, `RegExp`, `Map`, `Set` | 기본 내장 객체 |
| `Math`, `parseInt`, `parseFloat`, `isNaN`, `isFinite` | 수학·파싱 |
| `encodeURIComponent`, `decodeURIComponent` | URI 인코딩 |
| `Promise`, `async/await` | 비동기 처리 |
| `Error`, `TypeError`, `RangeError`, `SyntaxError` | 예외 클래스 |

차단은 두 방식이다(`code.handler.ts` 부트스트랩).

1. **부재**(호스트 realm 에 있어 참조하면 `ReferenceError`): `require`·`import`·`fetch`·`fs`·`process`·`Buffer`·`global` 같은 Node 호스트 전역과 모듈은 isolate 안에 **처음부터 없다**. isolate 에 넣지 않는 한 닿을 수 없다(탈출 차단의 핵심).
2. **부트스트랩 삭제**(`delete`): V8 Isolate 가 기본 제공하는 ECMAScript 내장 중 비결정성·메타프로그래밍·동적 실행 위험이 있는 것(`eval`·`Function`·`Reflect`·`Proxy`·`Symbol`·`WeakMap`·`WeakSet`·`WeakRef`·`FinalizationRegistry`·`Atomics`·`SharedArrayBuffer`·`Intl`·`setTimeout`·`setInterval`·`setImmediate`·`queueMicrotask`·`globalThis`)은 코드 실행 전에 부트스트랩 스크립트가 전역에서 지운다.

| API | 차단 방식 | 차단 이유 |
|-----|-----------|-----------|
| `require`, `import` | 부재(호스트 realm) | 외부 모듈 로드 방지 |
| `fetch`, `XMLHttpRequest`, `WebSocket` | 부재(호스트 realm) | 네트워크 접근 차단 |
| `fs`, `path`, `os`, `child_process` 등 Node.js 모듈 | 부재(호스트 realm) | 시스템 접근 차단 |
| `process`, `global`, `Buffer` | 부재(호스트 realm) | 런타임 환경 접근 차단(isolate 밖이라 prototype chain 으로도 닿지 않음) |
| `eval`, `Function` 생성자 | 부트스트랩 삭제 | 동적 코드 실행 방지 |
| `globalThis`, `Symbol` | 부트스트랩 삭제 | 런타임 환경 접근·메타프로그래밍 방지 |
| `Reflect`, `Proxy` | 부트스트랩 삭제 | 메타프로그래밍 방지 |
| `WeakMap`, `WeakSet`, `WeakRef`, `FinalizationRegistry`, `Atomics`, `SharedArrayBuffer`, `Intl` | 부트스트랩 삭제 | 비결정성·realm 사이 누출 방지 |
| `setTimeout`, `setInterval`, `setImmediate`, `queueMicrotask` | 부트스트랩 삭제 | 비결정적 스케줄링 차단(`Promise.race` 타임아웃 흐름 단순화) |

## 캔버스 요약

[Data 노드 공통](CLE-NODE-DATA-COMMON.md) 캔버스 요약 표의 Code 행을 따른다(`{{language|upper}}`). 코드 줄 수는 `summaryTemplate` DSL 이 지원하지 않아 넣지 않는다.

## 미결 사항

- **`error` 포트의 type 이 `data`**: 이 노드의 `error` 포트는 스펙과 스키마(`code.schema.ts`) 모두 type `data` 로 선언돼 있다. HTTP Request 등 다른 노드 대부분은 에러 포트를 type `error` 로 선언한다. 연결선 문서는 에러 포트 연결선을 빨간색으로 그린다고 적는데, 현재 구현(`edge-utils` 의 `resolvePortType`)은 포트 type 이 `error` 이거나 id 가 `error` 일 때 빨간색이라 이 노드도 id 덕분에 빨간색이 된다. 다른 소비처에 영향이 있는지는 확인되지 않았다. 포트 type 규칙을 정해 이 노드(와 AI 에이전트 노드)를 맞출지 결정 필요(관련: [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md), [연결선](../CLE-WF/CLE-WF-EDGE.md)).
- **표현식 내장 변수와 이름이 같은 런타임 변수의 모양**: Code 런타임의 `$execution` 은 `executionId`, 표현식의 `$execution` 은 `id` 필드를 쓴다. `$node` 는 Code 에서 현재 노드 메타데이터, 표현식에서 다른 노드의 노드 출력이다. 워크플로우 변수는 `$vars` 와 `$var` 로 갈린다. 이름과 필드를 통일할지 결정 필요(관련: [표현식 언어](../CLE-WF/CLE-WF-EXPR.md)).

## 구현 위치

- `codebase/backend/src/nodes/data/code/code.handler.ts` (isolate 생성·부트스트랩·래퍼·에러 정규화)
- `codebase/backend/src/nodes/data/code/code.schema.ts`

## Rationale

### `config.code` 를 원본 그대로 에코 (2026-06-03 정합화)

`config.code`(사용자 코드 본문)는 노드 출력 `config` 에 **원본 그대로** 에코한다. 한때 노드 출력 규약 Principle 7 의 "절대 에코 금지" 목록에 `code.config.code` 가 있어 이 스펙과 모순됐는데, 두 개념을 혼동한 것이었다.

- **표현식 평가 제외**(`expression-exclusions` 등록): 코드 본문 안의 `{{ }}` 를 평가하지 않는다. 코드가 곧 데이터이기 때문이며, 등록의 뜻은 이것이다.
- **에코 금지**: `config` 에 싣지 않는다. 코드 본문은 여기에 해당하지 **않는다**.

코드 본문은 `systemPrompt`·`userPrompt`·`body` 와 같은 부류의 사용자 원본 텍스트라서 디버깅과 뒤쪽 노드 참조를 위해 에코한다. 사용자 본인의 코드라 민감하지 않고, 에디터·UI 로 크기가 제한된다. 그래서 Principle 7 의 "항상 에코" 목록에 속한다. 정합화 때 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md)의 금지 목록에서 지우고 "항상 에코" 로 옮겼다.

### `output` 루트에 바로 배치 (2026-06-03 정합화)

Code 노드의 `output` 은 사용자 `return` 값을 **루트에 그대로** 담고 `output.result` 로 감싸지 않는다. `output.result` 감싸기는 노드 출력 규약 Principle 8.2 의 **AI 노드(`ai_agent`·`text_classifier`·`information_extractor`) 한정** 규칙이다. Code(와 Transform)는 사용자 코드·연산이 출력 모양을 정하므로 인위적인 `result` 감싸기는 뒤쪽 표현식만 길게 만든다(`$node["X"].output.result.foo` 대 `$node["X"].output.foo`). 한때 Principle 8.2 표의 "코드 실행 결과 → `output.result`" 행이 이 결정과 모순됐고, 정합화로 "루트 직접 배치(Code·Transform 예외)" 로 고쳤다.

기각한 대안: Code 출력을 `output.result` 로 감싸기. AI 노드와 겉모습은 맞지만, 사용자가 `return { result: ... }` 를 쓰면 `output.result.result` 로 이중 중첩되고 원시값 반환(`return 42`)이 `output.result: 42` 로 어색해진다. 사용자 코드의 자유로운 모양이 핵심 가치이므로 루트 배치를 유지한다.

### 격리 방식을 `isolated-vm` 으로 전환 (2026-06-11)

**위협 모델**: Code 노드를 만들 권한은 편집자 이상이다. 플랫폼은 Code 노드의 사용자 코드를 **신뢰할 수 없는 코드**로 다룬다(여러 워크스페이스에서 안전해야 하며 셀프 호스팅 단일 테넌트 가정에 기대지 않는다). 그래서 사용자 코드가 호스트(백엔드 프로세스)를 장악하는 경로를 구조적으로 막아야 한다. 호스트 프로세스 메모리에는 DB 자격 증명, `ENCRYPTION_KEY`, 배포 환경의 서비스 토큰, 내부망 접근권이 있으므로 호스트 realm 에 닿으면 곧 인증 우회·시크릿 탈취·SSRF 로 이어진다.

**기존 `node:vm` 의 한계**: `node:vm` 은 전역을 넣지 않아(`process`·`require`·`Buffer` 등) 모듈 로드·네트워크·파일시스템을 막았다. 하지만 샌드박스와 호스트가 **같은 V8 realm** 을 공유해 `this.constructor.constructor('return process')()` 같은 prototype chain 으로 호스트의 `Function` 생성자에 닿고, 호스트 realm 객체(`process` 등)를 얻는 탈출이 가능했다. 이전 스펙이 "완벽한 탈출 방어는 불가하며 나중에 `isolated-vm` 등으로 재검토" 라고 이미 적어 둔 트레이드오프다.

**결정**: 사용자 결정(2026-06-11)으로 스펙 로드맵이 지목한 `isolated-vm`(V8 Isolate)으로 바꿨다. 이 결정으로 "나중에 재검토" 로 남아 있던 로드맵 항목을 **끝냈다**. Isolate 는 호스트와 **별도의 V8 힙·realm** 을 가지므로 호스트 객체가 isolate 안에 없고, prototype chain 탈출이 성립하지 않는다. 덤으로 isolate 단위 메모리 하드 리밋(128MB, `CODE_MEMORY_LIMIT`)과 CPU 타임아웃을 강제할 수 있다. vm 샌드박스에 `Promise` 생성자가 노출돼 있던 별도 위험(refactor 04 M-2)도 함께 흡수했다. `Promise`(async/await)는 기능 약속이라 **유지**하고, 격리 층이 그로 인한 탈출 경로를 무력화한다.

기각한 대안:

- **`worker_threads` 권한 박탈**: worker 는 호스트와 같은 프로세스 주소 공간을 공유하는 보안 경계가 아니라서 격리 강도를 본질적으로 높이지 못한다.
- **컨테이너·gVisor 즉시 전환**: 격리는 가장 강하지만 노드를 실행할 때마다 컨테이너를 띄워야 하고 런타임 의존(셀프 호스팅 부담)이 커서 운영 복잡도에 비해 과하다. V8 자체 버그에 의한 isolate 탈출까지 막아야 하는 다중 테넌트 확장 때의 후속 강화로 로드맵에 남긴다.
- **현상 유지 + frozen prototype 임시 완화**: 우회 경로가 많아 근본 차단이 아니고 여러 워크스페이스 환경에서 받아들일 수 없다.

**트레이드오프**: 네이티브 빌드(node-gyp) 의존성이 생긴다. CI 이미지 빌드 때 한 번 컴파일하면 되므로 배포 시점 복잡도는 없지만, 빌드 환경(alpine·musl 포함)에 C++ 툴체인이 필요하다. `$helpers`·`console` 은 호스트 클로저를 `Reference`·`ivm.Callback` 으로 이어 호스트 realm 에서 실행하므로 기존 사용자 코드(dayjs·crypto·base64)와의 호환이 유지된다. isolated-vm 은 `node>=22` 를 지원하는 `6.x` 를 쓴다(`7.x` 는 `node>=26` 요구, Node 26 으로 올릴 때 다시 본다). 여기서 `node>=22` 는 라이브러리 지원 범위일 뿐이며, 프로젝트 런타임 하한은 `PROJECT.md` 버전·도구 정책(내부 앱 `>=24`)을 따른다.

### dayjs 매 실행 재컴파일을 힙 스냅샷으로 교체 (2026-06-12)

동시 실행이 많을 때 실행마다 dayjs UMD 를 isolate 안에서 다시 컴파일하는 것이 고정 비용이었다. `ivm.Isolate.createSnapshot()` 으로 **정적 dayjs 만** 모듈 로드 때 한 번 힙 스냅샷하고 실행마다 그 스냅샷에서 isolate 를 만들어 재컴파일을 없앴다(모듈 로드 한 번에 약 4ms, 평상시 요청 지연에는 영향 없음). 스냅샷에 호스트 참조나 실행별 상태를 넣지 않으므로 격리·보안·출력 계약은 그대로다. 위 전환 결정이 세운 **실행마다 isolate 를 버리는(메모리 격리) 불변식**도 그대로다. 스냅샷은 dayjs 준비 비용만 줄이고 isolate 수명 모델을 바꾸지 않는다.

기각한 대안:

- **isolate 풀 재사용**: 실행마다 버리는(실행 사이 메모리·상태 격리) 불변식을 깬다. 스냅샷은 새 isolate 를 유지하면서 준비 비용만 줄이므로 격리 강도를 잃지 않는다.
- **부트스트랩(`$helpers`·`console` 연결 + 전역 삭제)까지 스냅샷**: 호스트 콜백은 실행별 상태(예: `console` 의 로그 버퍼)와 호스트 realm 함수에 묶여 있다. 전역 삭제는 실행별 부트스트랩 시점에 해야 "캡처한 뒤 삭제" 순서(W13)가 성립한다. `createSnapshot` 은 호스트 바인딩이 없는 빈 isolate 에서 돌아서 이 둘을 담을 수 없다.

### `$helpers` 입력 타입 계약 정렬 (2026-06-12)

`$helpers.crypto.hash` 는 이미 문자열이 아닌 `data` 에 `TypeError` 를 던졌다(허용 목록 + 타입 가드). `$helpers.base64.encode/decode` 만 문자열이 아닌 값을 `String(data)` 로 조용히 바꿔서 `base64.encode(42)` 가 `"42"` 를 인코딩했고 타입 버그를 숨겼다. base64 도 문자열이 아닌 값에 `TypeError` 를 던지게 맞춰 계약을 명시적으로 만들었다.

하위 호환 영향: base64 에 문자열이 아닌 값을 넘기던 기존 코드는 이제 `error` 포트로 간다(전에는 조용히 처리). 입력은 대부분 문자열이라 영향이 작고, 숨은 타입 버그를 일찍 드러내는 이득이 크다고 판단했다. 유효하지 않은 base64 문자열의 decode(타입은 문자열)는 타입 에러와 구분해 기존 best-effort 반환을 유지한다. 기각: 현상 유지는 hash 와의 비대칭을 굳히고 타입 버그를 숨긴다.

### 메모리 한도를 환경 변수로 조정 (2026-06-12)

배포 환경마다 메모리 여유가 달라 운영 조정 여지가 필요했다(코드 W15 주석이 예고). 기본 128MB 는 그대로 두고 `CODE_NODE_MEMORY_LIMIT_MB` 로 조정한다. 128MB 결정의 **의도는 실행 하나의 메모리 상한을 두는 것**이었으므로, 512MB 상한을 둔 환경 변수 조정은 그 결정의 번복이 아니라 운영 확장이다. 안전 상한 512MB 로 실행 하나가 호스트 메모리를 독차지하지 못하게 한다. backend-labels 의 `128MB` 메시지는 코드 PR 에서 함께 고친다. 기각: 상한 없는 환경 변수는 노드 하나가 호스트 OOM 을 일으킬 수 있다.
