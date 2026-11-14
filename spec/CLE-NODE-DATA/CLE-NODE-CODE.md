---
id: "CLE-NODE-CODE"
title: "Code 노드"
type: "feature"
version: 3
status: "approved"
requirements: ["REQ-CODE-001", "REQ-CODE-002", "REQ-CODE-003", "REQ-CODE-004", "REQ-CODE-005", "REQ-CODE-006", "REQ-CODE-007", "REQ-CODE-008", "REQ-CODE-009", "REQ-CODE-010", "REQ-CODE-011", "REQ-CODE-012", "REQ-CODE-013", "REQ-CODE-014", "REQ-CODE-015", "REQ-CODE-016", "REQ-CODE-017", "REQ-CODE-018", "REQ-CODE-019", "REQ-CODE-020", "REQ-CODE-021", "REQ-CODE-022", "REQ-CODE-023", "REQ-CODE-024", "REQ-CODE-025", "REQ-CODE-026", "REQ-CODE-027", "REQ-CODE-028", "REQ-CODE-029", "REQ-CODE-030"]
basis_superseded: false
parent: "CLE-NODE-DATA"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-DATA"]
area: "CLE-NODE-DATA"
content_hash: "03ffbddd876ccd5c609e53b5f50ba5d3a21be99262b1c0b20a00466a65cc26f4"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/4-nodes/5-data/2-code.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "9a6fd2e4f0b880df3a8e15ac6e47e6eeebf3bb1841a60b4f277fdc1f8bc6a7d2"
etag: "sha256-ec0cebd7aea29c9c205d4a5fe853b567fc9776e566722e786321192ee8048d2a"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/5-data/2-code.md`, `spec/4-nodes/_product-overview.md` (§8.2) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Code 노드(`code`)는 사용자가 쓴 JavaScript 로 데이터를 자유롭게 처리하는 노드다. [Transform 노드](CLE-NODE-TRANSFORM.md)로 표현하기 어려운 로직(분기, 재귀, 복합 변환, 해시 등)에 쓴다. 사용자 코드의 throw·타임아웃은 정상 시나리오의 일부로 보고 런타임 에러 포트(`error`)로 보낸다.

사용자 코드는 노드 샌드박스(`isolated-vm`)에서 실행한다. 샌드박스의 격리 방식, 리소스 제한, 허용·차단 API 는 하위 문서 [Code 노드 — 샌드박스](CLE-NODE-CODE-SANDBOX.md)가 정한다. 노드 샌드박스를 어느 노드에 적용하는지는 [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md), Data 노드 공통 규약은 [Data 노드 공통](CLE-NODE-DATA-COMMON.md)이 정한다. 워크플로우 변수의 시스템 예약 변수 규칙은 [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md)가 정한다.

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

## 하위 문서

| 문서 | 맡는 내용 | 요구사항 |
|------|-----------|----------|
| [Code 노드 — 샌드박스](CLE-NODE-CODE-SANDBOX.md) | `isolated-vm` 격리 방식, dayjs 힙 스냅샷, 타임아웃·메모리 등 리소스 제한, 허용·차단 API, 격리 관련 결정 근거 | REQ-CODE-006, REQ-CODE-007, REQ-CODE-008, REQ-CODE-009, REQ-CODE-012, REQ-CODE-013, REQ-CODE-016, REQ-CODE-027, REQ-CODE-028 |

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

이 변수들은 Code 노드 런타임 전용이며 이름이 같은 표현식 내장 변수([표현식 언어](../CLE-WF/CLE-WF-EXPR.md))와 모양이 다르다. 차이와 통일 여부는 [미결 사항](#미결-사항)에 적었다.

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
3. `isolated-vm` isolate(`memoryLimit` 기본 128MB, `CODE_NODE_MEMORY_LIMIT_MB` 로 조정)와 context 를 dayjs 힙 스냅샷에서 만든다(스냅샷을 쓸 수 없으면 dayjs 를 매번 컴파일한다. [샌드박스](CLE-NODE-CODE-SANDBOX.md#격리-방식)). 그다음 `script.run(..., { promise: true, timeout })` 으로 실행하며 타임아웃을 두 겹으로 건다.
4. 정상 종료하면 사용자 `return` 값을 `output` 에 그대로 담고 `port: 'success'` 를 돌려준다.
5. 런타임 throw·타임아웃이면 `port: 'error'` 와 `output.error`([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 3.2)를 돌려준다.
6. 정상 종료하면 **isolate 안의 최종 `$vars` 를 읽어(`copy: true`) `context.variables` 를 통째로 한 번에 바꾼다**. 꺼내 오기에 실패하면(사용자가 직렬화할 수 없는 값을 `$vars` 에 넣은 경우 등) 실행 전 스냅샷 `varsClone` 으로 되돌린다. 읽기에 실패하면 변수를 바꾸지 않으므로 원본이 남는다. 실행이 throw 해도 원본이 남는다(롤백).

### 코드 작성 규칙

- `return` 으로 출력 데이터를 돌려준다. `return` 이 없으면 `output` 은 `undefined` 다.
- 비동기 코드를 쓸 수 있다. `async`·`await`·`Promise` 모두 되고 최상위 `await` 도 된다.
- 외부 네트워크·파일시스템·모듈 로드는 안 된다([샌드박스](CLE-NODE-CODE-SANDBOX.md)).
- `eval`·`new Function`·동적 `import(...)` 는 막는다.

### `$vars` 쓰기 처리 (깊은 복사 + 통째 교체)

`$vars` 는 읽고 쓸 수 있다. 변경은 격리 context 안의 깊은 복사본에서 일어나고, 실행이 끝난 뒤 메인 컨텍스트로 **한 번에** 반영한다.

1. 실행 전: `context.variables` 를 `JSON.parse(JSON.stringify(...))` 로 깊은 복사해 샌드박스의 `$vars` 로 넣는다.
2. 실행 중: 격리 context 안에서 자유롭게 바꾼다(중첩 객체 추가·삭제·수정 포함).
3. 정상 종료 후: 복사본 `$vars` 로 `context.variables` 를 **통째로 바꾼다**(부분 병합이 아님).
4. throw 후: 메인 컨텍스트 `$vars` 는 바뀌지 않는다(롤백).

통째로 바꾸므로 사용자 코드가 시스템 예약 변수(`__` 로 시작, 예: `__workspaceId`)까지 덮어쓸 수 있다. 이 때문에 워크스페이스 신뢰 경계가 위조될 수 있다는 잔여 위험과 그에 대한 강제 계층은 [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md)의 시스템 예약 변수 규칙이 정한다.

## 출력 구조

노드 출력은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 11 형식을 따른다. JSON 예시는 `undefined` 필드를 생략하고, 다섯 필드 밖의 최상위 키는 두지 않는다. 케이스는 정상 종료와 런타임 에러 둘이다. 컴파일 실패는 사전 검증 에러다([에러 코드](#에러-코드)).

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

`details.stack` 은 `NODE_ENV !== 'production'` 일 때만 넣는다. 프로덕션에서는 내부 파일 경로와 isolate 줄이 드러나지 않게 생략한다. 위 예시는 프로덕션이 아닌 환경 기준이다. 스택 노출은 `NODE_ENV` 의 production·그 외 이분법을 따르므로, 외부에 노출되는 스테이징 환경은 `NODE_ENV=production` 으로 운영해 스택이 응답에 실리지 않게 한다. 운영과 같은 동작이 돼 환경 차이 버그도 줄어든다. 스테이징에서 스택을 봐야 하는 실무 요구가 확인되면 환경 이름과 분리된 별도 플래그를 다시 검토한다.

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

isolate 가 `memoryLimit` 을 넘으면 V8 이 isolate 를 즉시 버린다. 핸들러는 이 에러를 `EXECUTION_MEMORY_EXCEEDED` 로 분류하고 `CODE_MEMORY_LIMIT` 로 정규화한다. 핸들러는 `meta: { success, logs }` 만 돌려주고 엔진이 `durationMs` 를 덧붙인다. 위 `42` 는 예시 값이다.

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

## 캔버스 요약

[Data 노드 공통](CLE-NODE-DATA-COMMON.md) 캔버스 요약 표의 Code 행을 따른다(`{{language|upper}}`). 코드 줄 수는 `summaryTemplate` DSL 이 지원하지 않아 넣지 않는다.

## 미결 사항

- **`error` 포트의 type 이 `data`**: 이 노드의 `error` 포트는 스펙과 스키마(`code.schema.ts`) 모두 type `data` 로 선언돼 있다. HTTP Request 등 다른 노드 대부분은 에러 포트를 type `error` 로 선언한다. 연결선 문서는 에러 포트 연결선을 빨간색으로 그린다고 적는데, 현재 구현(`edge-utils` 의 `resolvePortType`)은 포트 type 이 `error` 이거나 id 가 `error` 일 때 빨간색이라 이 노드도 id 덕분에 빨간색이 된다. 다른 소비처에 영향이 있는지는 확인되지 않았다. 포트 type 규칙을 정해 이 노드(와 AI 에이전트 노드)를 맞출지 결정 필요(관련: [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md), [연결선](../CLE-WF/CLE-WF-EDGE.md)).
- **표현식 내장 변수와 이름이 같은 런타임 변수의 모양**: Code 런타임의 `$execution` 은 `executionId`, 표현식의 `$execution` 은 `id` 필드를 쓴다. `$node` 는 Code 에서 현재 노드 메타데이터, 표현식에서 다른 노드의 노드 출력이다. 워크플로우 변수는 `$vars` 와 `$var` 로 갈린다. 이름과 필드를 통일할지 결정 필요(관련: [표현식 언어](../CLE-WF/CLE-WF-EXPR.md)).

## 구현 위치

- `codebase/backend/src/nodes/data/code/code.handler.ts` (isolate 생성·부트스트랩·래퍼·에러 정규화)
- `codebase/backend/src/nodes/data/code/code.schema.ts`

isolate 생성·부트스트랩의 세부는 [Code 노드 — 샌드박스](CLE-NODE-CODE-SANDBOX.md)가 정한다.

## Rationale

### `config.code` 를 원본 그대로 에코 (2026-06-03 정합화)

`config.code`(사용자 코드 본문)는 노드 출력 `config` 에 **원본 그대로** 에코한다. 아래 두 개념을 구분한다.

- **표현식 평가 제외**(`expression-exclusions` 등록): 코드 본문 안의 `{{ }}` 를 평가하지 않는다. 코드가 곧 데이터이기 때문이며, 등록의 뜻은 이것이다.
- **에코 금지**: `config` 에 싣지 않는다. 코드 본문은 여기에 해당하지 **않는다**.

코드 본문은 `systemPrompt`·`userPrompt`·`body` 와 같은 부류의 사용자 원본 텍스트라서 디버깅과 뒤쪽 노드 참조를 위해 에코한다. 사용자 본인의 코드라 민감하지 않고, 에디터·UI 로 크기가 제한된다. 그래서 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 7 의 "항상 에코" 목록에 속한다(정합화 때 금지 목록에서 옮겼다).

### `output` 루트에 바로 배치 (2026-06-03 정합화)

Code 노드의 `output` 은 사용자 `return` 값을 **루트에 그대로** 담고 `output.result` 로 감싸지 않는다. `output.result` 감싸기는 노드 출력 규약 Principle 8.2 의 **AI 노드(`ai_agent`·`text_classifier`·`information_extractor`) 한정** 규칙이다. Code(와 Transform)는 사용자 코드·연산이 출력 모양을 정하므로 인위적인 `result` 감싸기는 뒤쪽 표현식만 길게 만든다(`$node["X"].output.result.foo` 대 `$node["X"].output.foo`). Principle 8.2 표는 이를 "루트 직접 배치(Code·Transform 예외)" 로 적는다.

기각한 대안: Code 출력을 `output.result` 로 감싸기. AI 노드와 겉모습은 맞지만, 사용자가 `return { result: ... }` 를 쓰면 `output.result.result` 로 이중 중첩되고 원시값 반환(`return 42`)이 `output.result: 42` 로 어색해진다. 사용자 코드의 자유로운 모양이 핵심 가치이므로 루트 배치를 유지한다.

### `$helpers` 입력 타입 계약 정렬 (2026-06-12)

`$helpers.crypto.hash` 는 이미 문자열이 아닌 `data` 에 `TypeError` 를 던졌다(허용 목록 + 타입 가드). `$helpers.base64.encode/decode` 만 문자열이 아닌 값을 `String(data)` 로 조용히 바꿔서 `base64.encode(42)` 가 `"42"` 를 인코딩했고 타입 버그를 숨겼다. base64 도 문자열이 아닌 값에 `TypeError` 를 던지게 맞춰 계약을 명시적으로 만들었다.

하위 호환 영향: base64 에 문자열이 아닌 값을 넘기던 기존 코드는 이제 `error` 포트로 간다(전에는 조용히 처리). 입력은 대부분 문자열이라 영향이 작고, 숨은 타입 버그를 일찍 드러내는 이득이 크다고 판단했다. 유효하지 않은 base64 문자열의 decode(타입은 문자열)는 타입 에러와 구분해 기존 best-effort 반환을 유지한다. 기각: 현상 유지는 hash 와의 비대칭을 굳히고 타입 버그를 숨긴다.
