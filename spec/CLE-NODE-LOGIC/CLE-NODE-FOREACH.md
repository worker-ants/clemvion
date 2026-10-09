---
id: "CLE-NODE-FOREACH"
title: "ForEach 노드"
type: "feature"
version: 1
status: "approved"
requirements: ["REQ-FOREACH-001", "REQ-FOREACH-002", "REQ-FOREACH-003", "REQ-FOREACH-004", "REQ-FOREACH-005", "REQ-FOREACH-006", "REQ-FOREACH-007", "REQ-FOREACH-008", "REQ-FOREACH-009", "REQ-FOREACH-010", "REQ-FOREACH-011", "REQ-FOREACH-012", "REQ-FOREACH-013", "REQ-FOREACH-014", "REQ-FOREACH-015", "REQ-FOREACH-016", "REQ-FOREACH-017", "REQ-FOREACH-018", "REQ-FOREACH-019", "REQ-FOREACH-020", "REQ-FOREACH-021"]
basis_superseded: false
parent: "CLE-NODE-LOGIC"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-LOGIC"]
area: "CLE-NODE-LOGIC"
content_hash: "964b41bce7eb819967a7e48e32d2b9eaee48be7a19fd2ff1929a7f467f8bf1dc"
read_as: "approved_fallback"
task: "CLE-T-V0JAG1"
source_paths: ["spec/4-nodes/1-logic/9-foreach.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "bfc9768961c22f30ebae2faf93e0eb57485cf880003626eede50bd8d054e830b"
etag: "sha256-8f697da939d274c7b12538ce17740f554b16a9d7f3478584d393f2a123ec7dc0"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/1-logic/9-foreach.md`, `spec/4-nodes/_product-overview.md` (§4.9) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

ForEach 노드(ForEach, `foreach`)는 배열의 항목마다 컨테이너 본문을 차례로 실행하고 반복 회차마다의 `emit` 포트 출력을 모아 배열로 내보내는 컨테이너다(`executionMetadata.kind = 'container'`).

핸들러는 시작 시점에 해석한 배열을 `output: items[]` 로 반환하고 엔진이 항목을 본문 반복 회차 입력으로 나눠 준다. 모든 회차가 끝나면 엔진이 `output` 을 `{ items: [...], count: N }` 으로 덮어쓴다.

이 문서는 ForEach 노드의 설정, 포트, 본문 안 컨텍스트 변수, 실행 로직, 출력 구조, 실패 항목 분리, 에러를 정한다. 컨테이너 패턴(포트 구성, emit 규칙, 본문 제약), 항목 에러 정책, 엔진 덮어쓰기 계약은 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md) 이 정한다. 엔진이 본문을 도는 방식과 결과 인덱스 보존, 중첩 컨테이너 스코프는 [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md) 이 정한다. 변환 결과를 모으는 반복은 [Map 노드](CLE-NODE-MAP.md) 가 맡는다.

## 요구사항

- REQ-FOREACH-001 WHEN ForEach 노드가 실행되면 THE SYSTEM SHALL 배열의 항목마다 컨테이너 본문을 차례로 실행한다. (원본: ND-FE-01)
- REQ-FOREACH-002 WHILE 컨테이너 본문이 실행되는 동안 THE SYSTEM SHALL 본문 노드가 `$item` 과 `$itemIndex` 로 현재 항목과 인덱스를 읽을 수 있게 한다. (원본: ND-FE-02)
- REQ-FOREACH-003 WHEN 모든 반복 회차가 끝나면 THE SYSTEM SHALL 회차마다의 `emit` 출력을 배열로 모아 `{ items, count }` 로 내보낸다. (원본: ND-FE-03)
- REQ-FOREACH-004 WHEN 사용자가 항목 에러 정책을 고르면 THE SYSTEM SHALL `stop` (중단), `skip` (건너뛰기), `continue` (계속) 세 값을 제공한다. (원본: ND-FE-04)
- REQ-FOREACH-005 WHEN ForEach 노드를 캔버스에 그리면 THE SYSTEM SHALL 자식 노드를 감싸는 그룹 박스 없이 일반 노드와 같은 크기의 컨테이너로 그린다. (원본: ND-FE-05)
- REQ-FOREACH-006 WHILE 컨테이너 본문이 실행되는 동안 THE SYSTEM SHALL `$itemIsFirst` 와 `$itemIsLast` 최상위 변수로 첫 항목·마지막 항목 여부를 노출한다.
- REQ-FOREACH-007 WHEN 사용자가 대상 배열을 설정하면 THE SYSTEM SHALL `arrayField` 에 dot-path 문자열이나 inline 표현식을 받는다.
- REQ-FOREACH-008 IF `arrayField` 로 읽은 값이 배열이 아니거나 경로가 없으면 THE SYSTEM SHALL `[]` 로 처리한다.
- REQ-FOREACH-009 WHEN 핸들러가 시작 시점 출력을 반환하면 THE SYSTEM SHALL 해석한 배열을 `output` 으로 반환하고 엔진이 그 항목을 본문으로 나눠 준다.
- REQ-FOREACH-010 WHEN 모든 반복 회차가 끝나면 THE SYSTEM SHALL 핸들러를 다시 부르지 않고 노드 `output` 을 `{ items, count, skipped? }` 로 덮어쓴 뒤 `done` 포트로 보낸다.
- REQ-FOREACH-011 WHEN 결과 배열을 만들면 THE SYSTEM SHALL 원본 배열과 같은 인덱스를 유지한다.
- REQ-FOREACH-012 IF 본문 회차가 실패하고 항목 에러 정책이 `stop` 이면 THE SYSTEM SHALL 곧바로 실행을 실패시킨다.
- REQ-FOREACH-013 IF 본문 회차가 실패하고 항목 에러 정책이 `skip` 이나 `continue` 면 THE SYSTEM SHALL 그 인덱스의 `output.items[i]` 를 `null` 로 두고 실패 정보를 `output.skipped` 에 `{ index, error: { code, message } }` 로 더한다.
- REQ-FOREACH-014 WHEN 분리한 실패 항목이 있으면 THE SYSTEM SHALL 그 수를 `meta.skippedCount` 에 싣는다.
- REQ-FOREACH-015 IF 분리한 실패 항목이 없으면 THE SYSTEM SHALL `output.skipped` 와 `meta.skippedCount` 를 싣지 않는다.
- REQ-FOREACH-016 WHEN 반복이 끝나면 THE SYSTEM SHALL 본문 실행 횟수를 `meta.iterations` 에 싣는다.
- REQ-FOREACH-017 WHEN 다음 노드가 ForEach 노드 출력을 읽으면 THE SYSTEM SHALL 시작 시점의 원래 배열을 드러내지 않고 완료 형태만 보여 준다.
- REQ-FOREACH-018 IF `arrayField` 가 빈 문자열이거나 없으면 THE SYSTEM SHALL 캔버스에 경고 배지를 표시하고 `handler.validate` 에서 거부한다.
- REQ-FOREACH-019 IF `errorPolicy` 가 `stop` / `skip` / `continue` 가 아니면 THE SYSTEM SHALL `handler.validate` 에서 거부한다.
- REQ-FOREACH-020 IF `emit` 포트에 본문 노드가 없거나 2개 이상이거나 본문 안에 되돌아가는 연결선이나 블로킹 노드가 있으면 THE SYSTEM SHALL 엔진 그래프 검증에서 실행을 실패시킨다.
- REQ-FOREACH-021 WHEN ForEach 노드를 정의하면 THE SYSTEM SHALL 런타임 에러 포트와 동적 포트를 두지 않는다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| arrayField | Expression | ✓ | `''` | 대상 배열 필드 경로. dot-path 문자열(`"items"`)이면 `$input` 에 적용하고 inline 표현식(`{{ $var.a }}`)이면 resolver 가 치환한 값을 그대로 쓴다 |
| errorPolicy | `stop` / `skip` / `continue` | | `stop` | 항목 에러 정책. [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#항목-에러-정책) |

코드 기준: `codebase/backend/src/nodes/logic/foreach/foreach.schema.ts` (export `foreachNodeConfigSchema`)

설정 패널은 이 노드의 `config.errorPolicy` 를 에러 처리 정책(`config.errorHandling.policy`)으로 옮기지 않고 저장할 때 지우지도 않는다([노드 포트와 설정 패널](../CLE-WF/CLE-WF-NODEPANEL.md#에러-처리-정책-설정) 의 REQ-NODEUI-041, [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md#레거시-평면-키-이전-범위를-좁힌-이유)).

빈 입력과 `null` 입력: `arrayField` 해석 결과가 배열이 아니면 `[]` 로 처리한다. 이 처리는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 빈 입력 절과 정의가 갈린다. [미결 사항](#미결-사항) 참조.

## 설정 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|--------------|------|
| 배열 필드 | 맨 위 | `Array Field` 입력(예 `{{ $input.items }}`), 아래 안내 "Dot-path or inline expression returning an array" | `arrayField` 를 편집한다 |
| 에러 정책 | 아래 | `Error Policy` 드롭다운(기본 `stop`) | `errorPolicy` 를 바꾼다 |

## 포트

| 방향 | id | label | type | dynamic | 설명 |
|------|------|-------|------|---------|------|
| 입력 | `in` | Input | data | false | 외부 데이터 진입 |
| 입력 | `emit` | Emit | data | false | 컨테이너 본문에서 결과를 모으는 지점(본문 노드가 정확히 1개 연결돼야 한다) |
| 출력 | `body` | Body | data | false | 항목마다 본문에 들어간다. `$item` / `$itemIndex` 를 묶는다 |
| 출력 | `done` | Done | data | false | 모든 회차가 끝난 뒤 `{ items, count }` 를 넘긴다 |

ForEach 는 동적 포트가 없다.

### 본문 안 컨텍스트 변수

| 변수 | 설명 |
|------|------|
| `$item` | 현재 배열 항목(원래 값. 입력 배열 원소 그대로) |
| `$itemIndex` | 현재 인덱스(0부터) |
| `$itemIsFirst` | 첫 항목 여부(boolean) |
| `$itemIsLast` | 마지막 항목 여부(boolean) |

첫·마지막 항목 표시는 최상위 변수 `$itemIsFirst` / `$itemIsLast` 로 노출한다. `expression-resolver.service.ts` 가 `itemContext.isFirst` / `isLast` 를 그대로 넘긴다. `$item` 은 원래 값(문자열·숫자일 수 있음)이라 `$item.isFirst` 처럼 속성을 붙일 수 없어서 따로 둔다.

## 실행 로직

1. `arrayField` 로 배열을 꺼낸다(`resolveFieldValue`, `nested-value.util.ts`). dot-path 문자열이면 `$input` 에 적용하고 inline 표현식이면 resolver 가 치환한 값을 그대로 쓴다. 배열이 아니거나 경로가 없으면 `[]` 로 대체한다.
2. 핸들러는 [시작 시점](#시작-시점-핸들러-반환) 형태로 `output: items[]` 를 반환한다. 엔진이 항목을 본문 반복 회차 입력으로 나눠 준다.
3. 엔진은 항목마다 다음을 한다.
   - `$item` / `$itemIndex` 를 묶고 본문을 위상 순서로 실행한다.
   - `emit` 포트에 연결된 본문 노드의 출력을 그 회차 결과로 모은다.
4. 항목 에러 정책에 따라 에러를 처리한다(원본 배열과 같은 인덱스 유지).
   - `stop`: 곧바로 실행 실패.
   - `skip` / `continue`: 실패한 인덱스의 `output.items[i]` 를 `null` 로 채워 인덱스를 지키고 실패 정보는 `output.skipped: [{ index, error: { code, message } }]` 로 따로 모은다([실패 항목 분리](#실패-항목-분리-errorpolicy-skip--continue)). `meta.skippedCount` 에 분리한 항목 수를 싣는다.
5. 모든 회차가 끝나면 엔진이 `output` 을 `{ items: [...], count: N, skipped?: [...] }` 로 덮어쓰고 `done` 포트로 보낸다.

결과 배열 인덱스 보존과 중첩 컨테이너 스코프는 [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md) 이 정한다.

## 출력 구조

ForEach 는 컨테이너라서 시작 시점(본문 진입)과 완료 시점(`done` 포트) 두 형태로 나눈다. JSON 예시는 `undefined` 필드를 생략했고 5필드 밖의 최상위 키는 쓰지 않는다.

### 시작 시점 (핸들러 반환)

```json
{
  "config": { "arrayField": "{{ $input.items }}" },
  "output": [
    { "id": "a", "name": "Alice" },
    { "id": "b", "name": "Bob" }
  ]
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.arrayField` | Expression (원래 값) | 설정 에코 | 사용자가 입력한 원래 경로·표현식. `{{ }}` 을 남긴다 |
| `output` | unknown[] | 핸들러 반환 | 해석한 배열. 엔진이 항목을 본문 반복 회차 입력으로 나눠 준다. 밖에서 직접 보이지 않는 중간 형태다 |

이 시점의 `output` 은 엔진 덮어쓰기 직전 단계다. 다음 노드 표현식(`$node["X"].output.*`)에 드러나는 값은 [완료 시점](#완료-시점-done-포트) 형태다. 이 배열을 엔진 내부 표현으로 두는 이유(D2 결정)는 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#rationale) 에 있다.

### 완료 시점 (`done` 포트)

```json
{
  "config": { "arrayField": "{{ $input.items }}", "errorPolicy": "stop" },
  "output": {
    "items": [
      { "userId": "a", "ok": true },
      { "userId": "b", "ok": true }
    ],
    "count": 2
  },
  "meta": {
    "iterations": 2
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.arrayField` | Expression (원래 값) | 설정 에코 | 사용자 입력 원래 값. `{{ }}` 을 남긴다 |
| `config.errorPolicy` | `'stop'` / `'skip'` / `'continue'` | 설정 에코 | 기본 `stop` |
| `output.items` | unknown[] | 엔진 덮어쓰기 | 회차마다의 `emit` 포트 출력 배열. `errorPolicy` 가 `skip` / `continue` 면 실패 인덱스는 `null` 자리 |
| `output.count` | number | 엔진 덮어쓰기 | 반복 실행한 항목 수(입력 배열 길이와 같음. 인덱스 유지) |
| `output.skipped` | `Array<{index, error}>` | 엔진 덮어쓰기 | `errorPolicy` 가 `skip` / `continue` 일 때 따로 모은 실패 항목. 실패가 0건이면 필드 자체를 뺀다 |
| `meta.skippedCount` | number | 엔진 주입 | `output.skipped.length`. 실패가 0건이면 필드 자체를 뺀다 |
| `meta.iterations` | number | 엔진 주입 | 본문 실행 횟수(반복 메트릭). 현재 구현은 실패로 `null` 이 된 인덱스도 본문이 돌았으므로 센다 |

ForEach 의 완료 출력은 `config` / `output` / `meta` 세 키만 싣는다(`execution-engine.service.ts` 의 컨테이너 완료 처리는 `port` 키를 쓰지 않는다). `done` 포트는 노드 출력의 `port` 필드가 아니라 엔진의 연결선 활성화로 열린다. 노드 출력에 `port` 를 직접 싣는 것은 엔진 덮어쓰기 대상 노드 가운데 Parallel 뿐이다. 또 이 문서는 완료 출력 `meta` 에 `durationMs` 가 없고 실행 시간은 노드 실행 기록과 WebSocket 이벤트 수준에서만 보인다고 적는다. Map 문서와 서술이 다른 점은 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#미결-사항) 에 적었다.

표현식 접근 예:

- `$node["ForEach"].output.items[0]` → 첫 회차의 emit 출력
- `$node["ForEach"].output.count` → 처리한 항목 수(O(1))

### 실패 항목 분리 (`errorPolicy` `skip` / `continue`)

항목 에러 정책이 `skip` 이나 `continue` 면 실패한 회차를 다음 세 곳으로 나눈다.

1. `output.items[i]` 는 `null` 자리다. 입력 배열의 인덱스를 지키기 위해 둔다.
2. `output.skipped: [{ index, error: { code, message } }]` 에는 실패한 회차의 인덱스와 에러 정보가 들어간다. 성공과 실패가 한 배열에 섞이지 않도록 나눈다.
3. `meta.skippedCount: number` 는 `output.skipped.length` 를 비춘다. 다음 노드가 배열을 돌지 않고 분기·메트릭에 쓸 수 있다.

```json
{
  "config": { "arrayField": "{{ $input.items }}", "errorPolicy": "skip" },
  "output": {
    "items": [
      { "userId": "a", "ok": true },
      null,
      { "userId": "c", "ok": true }
    ],
    "count": 3,
    "skipped": [
      { "index": 1, "error": { "code": "VALIDATION_FAILED", "message": "..." } }
    ]
  },
  "meta": {
    "iterations": 3,
    "skippedCount": 1
  }
}
```

실패가 0건이면 `output.skipped` 와 `meta.skippedCount` 둘 다 필드 자체를 뺀다(`undefined` 필드는 싣지 않는다). 다음 노드는 `output.items.filter(x => x !== null)` 로 성공만 골라내거나 `output.skipped` 가 있을 때만 실패 처리 분기로 들어가면 된다.

Map 은 실패 항목을 `output.mapped[i] = { _skipped: true, error }` 인라인 표시로 둔다. 두 노드가 형태를 달리하는 이유(D3 결정)는 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#rationale) 에 있다.

### 엔진 덮어쓰기 계약

| 시점 | `output` 형태 | 출처 |
|------|-------------|------|
| 시작(본문 진입 직전) | `output: items[]` (해석한 원래 배열) | 핸들러 반환. 본문 반복 회차에 나눠 줄 입력 |
| 완료(모든 회차 종료 뒤) | `output: { items: [...], count: N, skipped?: [...] }` | **엔진 덮어쓰기**(핸들러 다시 부르지 않음) |

1. 다음 노드가 `$node["ForEach"].output.*` 로 보는 값은 항상 완료 시점 형태다.
2. 핸들러가 시작 시점에 반환한 `output: items[]` 는 밖의 표현식에 드러나지 않는다(엔진이 덮어쓰기 전 중간 단계).
3. 핸들러는 한 번만 실행되고 완료 시점 덮어쓰기는 엔진이 핸들러 호출 없이 한다.

핸들러가 `null` 이 아닌 배열을 반환하는데도 엔진이 덮어쓰는 이 동작은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 덮어쓰기 규칙과 정의가 갈린다. [미결 사항](#미결-사항) 참조.

## 에러

ForEach 는 런타임 에러 포트가 없다. 컨테이너 구조 검증 실패는 사전 검증 에러로 던지고 본문 회차 중의 에러는 항목 에러 정책으로 처리한다.

| 발생 조건 | 메시지 / 코드 | 시점 |
|-----------|--------------|------|
| `arrayField` 가 빈 문자열이거나 없음 | `Array field must be entered.` (기준: `foreach.schema.ts` 노드 경고 규칙 `foreach:no-array-field`. 캔버스 배지는 i18n 으로 번역) | 노드 경고 규칙(캔버스 배지) + `handler.validate` |
| `errorPolicy` 가 enum 밖의 값 | `errorPolicy must be one of: stop, skip, continue` | `handler.validate` |
| `emit` 포트에 본문 노드 연결 없음 | `CONTAINER_MISSING_EMIT` | 엔진 그래프 검증([Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#컨테이너-패턴)) |
| `emit` 포트에 본문 노드 2개 이상 | `CONTAINER_MULTIPLE_EMIT` | 엔진 그래프 검증 |
| 본문 안에 되돌아가는 연결선 / 블로킹 노드(form / buttons / ai_conversation) | 그래프 검증 에러 | 엔진 그래프 검증 |
| 본문 회차 중 에러(`errorPolicy=stop`) | 곧바로 실행 실패(에러를 던짐) | 엔진 런타임 |
| 본문 회차 중 에러(`errorPolicy=skip` / `continue`) | `output.items[i] = null` + `output.skipped[]` 에 `{ index, error: { code, message } }` 추가 + `meta.skippedCount` 증가 | 엔진 런타임([실패 항목 분리](#실패-항목-분리-errorpolicy-skip--continue)) |

## 설정 요약

- 형식: `{arrayField}`. `errorPolicy` 가 `stop` 이 아니면 `· {policy}` 를 붙인다.
- 예: `$input.items · skip errors`
- 현재 구현은 `foreach.schema.ts` 에 `summaryTemplate` 이 없어 캔버스에 이 요약을 표시하지 않는다. [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#미결-사항) 참조.

## 미결 사항

- **엔진 덮어쓰기 규칙이 노드 출력 규약과 갈린다** (critical): 핸들러가 배열을 반환해도 엔진이 완료 시점에 덮어쓴다. [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 은 `null` 이 아닌 값을 반환하면 덮어쓰지 않는다고 적는다. 결정 항목은 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#미결-사항) 에 모았다.
- **배열 아닌 입력의 처리가 노드 출력 규약과 갈린다** (critical): 이 문서는 원시값까지 모든 비배열을 `[]` 로 대체한다. [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 은 숫자·문자열이면 에러를 던지라고 정한다. 결정 항목은 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#미결-사항) 에 모았다.
- **시작 시점 설정 에코에 `errorPolicy` 가 빠져 있다** (info): 시작 시점 예시의 `config` 에는 `arrayField` 만 있다. [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 설정 에코 규칙은 `foreach.errorPolicy` 를 보강할 누락 필드로 든다. Loop 의 `breakCondition` 과 함께 예외로 둘지 보강할지 결정 필요([Loop 노드](CLE-NODE-LOOP.md)).
- **에러 처리 정책의 동적 에러 포트와 REQ-FOREACH-021** (warning): [노드 포트와 설정 패널](../CLE-WF/CLE-WF-NODEPANEL.md#요구사항) 의 REQ-NODEUI-012 는 에러 처리 정책이 `route_to_error_port` 면 노드에 동적 에러 포트를 만든다고 정한다. 이 포트와 REQ-FOREACH-021(에러 포트 없음)의 관계는 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#미결-사항) 미결 사항의 「Logic 노드에 에러 처리 정책이 적용되는가」 항목에서 정한다.

## 구현 위치

- `codebase/backend/src/nodes/logic/foreach/foreach.*.ts`
- `codebase/backend/src/modules/execution-engine/containers/foreach-executor.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (완료 시점 덮어쓰기, `skipped` · `meta.iterations`)

## Rationale

### `$itemIsFirst` / `$itemIsLast` 를 최상위 변수로 노출한다 (2026-06-03)

처음에는 `itemContext.isFirst` / `isLast` 를 "컨테이너 실행 제어용 내부 상태라 표현식에 노출하지 않는다" 고 정했다. 그런데 본문 표현식에서 첫·마지막 항목으로 나누려는 수요가 확인됐고 `$itemIndex === 0` 으로 우회하는 방식은 읽기 어려웠다. 그래서 노출로 바꿨다.

- **최상위 변수로 둔다**: `$item` 은 원래 입력 원소라 문자열·숫자 같은 원시값일 수 있다. `$item.isFirst` 처럼 속성을 붙이면 `$item` 의 뜻이 깨진다. 그래서 `$loop.isFirst` 와 비슷하지만 별개인 최상위 변수로 둔다.
- 엔진이 이미 `itemContext.isFirst` / `isLast` 를 계산하므로 `expression-resolver.service.ts` 가 그대로 넘기는 최소 변경으로 구현했다(새 계산 없음).
- 기각한 대안: (a) `$item` 을 감싸기. 원시값 항목을 망가뜨려 기각했다. (b) `$loop` 재사용. ForEach 는 `$loop` 컨텍스트가 아니라서 뜻이 헷갈려 기각했다.

### 캔버스에서 그룹 박스로 그리지 않는다

노드 요구사항 ND-FE-05 는 ForEach 를 "자식 노드를 배치할 수 있는 확장 가능 그룹 박스" 로 그린다고 적었다. 캔버스는 시각 containment 를 쓰지 않기로 정했다. 컨테이너는 일반 노드와 같은 크기로 그리고 자식 노드는 캔버스 어디에나 놓는다. 자식 노드의 소속은 `containerId` 와 자식 헤더 아래 `in <컨테이너 레이블>` 배지로만 나타낸다([워크플로우 에디터와 캔버스 §시각 표현](../CLE-WF/CLE-WF-EDITOR.md#시각-표현)). REQ-FOREACH-005 는 [Loop 노드](CLE-NODE-LOOP.md) 의 REQ-LOOP-006 과 같이 이 결정에 맞춰 적었다.

### 설정 패널이 항목 에러 정책을 지우지 않는다 (2026-10-10)

2026-10-10 에 설정 패널이 항목 에러 정책을 지우던 결함을 고쳤다(NERV Task `CLE-T-V0JAG1`). 결정과 근거는 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md#레거시-평면-키-이전-범위를-좁힌-이유) 에 있다.

항목 에러 정책 키를 `itemErrorPolicy` 같은 새 이름으로 바꾸는 안은 저장된 워크플로우의 노드 설정을 옮기는 데이터 마이그레이션이 필요해서 기각했다.
