---
id: "CLE-NODE-MAP"
title: "Map 노드"
type: "feature"
version: 1
status: "approved"
requirements: ["REQ-MAP-001", "REQ-MAP-002", "REQ-MAP-003", "REQ-MAP-004", "REQ-MAP-005", "REQ-MAP-006", "REQ-MAP-007", "REQ-MAP-008", "REQ-MAP-009", "REQ-MAP-010", "REQ-MAP-011", "REQ-MAP-012", "REQ-MAP-013", "REQ-MAP-014", "REQ-MAP-015", "REQ-MAP-016", "REQ-MAP-017", "REQ-MAP-018"]
basis_superseded: false
parent: "CLE-NODE-LOGIC"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-LOGIC"]
area: "CLE-NODE-LOGIC"
content_hash: "32e41a814d9e87f790352ecd47ea361c3cff281de9a1db110cd21aeb631c9ea4"
read_as: "approved_fallback"
task: "CLE-T-V0JAG1"
source_paths: ["spec/4-nodes/1-logic/7-map.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "0264baacab06c3b5182ddf69a541a7f327e3d165cff23615f158273a17fe4108"
etag: "sha256-411f0674d4f5bf740f2962b34f0c90455a0552fd90711f9a5e8280e20b041be3"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/1-logic/7-map.md`, `spec/4-nodes/_product-overview.md` (§4.7) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Map 노드(Map, `map`)는 배열의 항목마다 컨테이너 본문을 실행하고 반복 회차마다의 `emit` 포트 출력을 모아 새 배열을 만드는 컨테이너다(`executionMetadata.kind = 'container'`). ForEach 와 같은 실행 모델과 실행기(`ForEachExecutor`)를 쓰지만 뜻은 "결과 수집(변환)" 에 맞춰져 있다. 그래서 컬렉션 키도 ForEach 의 `items` 가 아니라 `mapped` 다.

이 문서는 Map 노드의 설정, 포트, 실행 로직, 출력 구조, 에러를 정한다. 컨테이너 패턴(포트 구성, emit 규칙, 본문 제약), 항목 에러 정책, 엔진 덮어쓰기 계약은 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md) 이 정한다. 엔진이 본문을 도는 방식과 결과 인덱스 보존, 중첩 스코프는 [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md) 이 정한다. 항목마다 독립 처리하는 반복은 [ForEach 노드](CLE-NODE-FOREACH.md) 가 맡는다.

## 요구사항

- REQ-MAP-001 WHEN Map 노드가 실행되면 THE SYSTEM SHALL 배열의 항목마다 컨테이너 본문을 실행하고 회차마다의 `emit` 출력을 모아 새 배열을 만든다. (원본: ND-MP-01)
- REQ-MAP-002 WHEN 사용자가 변환을 정의하면 THE SYSTEM SHALL 필드 매핑과 값 변환을 컨테이너 본문 노드로 구성하고 `emit` 에 연결한 본문 노드의 출력을 그 항목의 변환 결과로 쓴다. (원본: ND-MP-02)
- REQ-MAP-003 WHEN 사용자가 대상 배열을 설정하면 THE SYSTEM SHALL `inputField` 에 dot-path 문자열이나 inline 표현식을 받는다.
- REQ-MAP-004 IF `inputField` 로 읽은 값이 배열이 아니면 THE SYSTEM SHALL `[]` 로 처리해 본문을 0회 실행하고 곧바로 `done` 포트를 `{ mapped: [], count: 0 }` 으로 활성화한다.
- REQ-MAP-005 WHILE 컨테이너 본문이 실행되는 동안 THE SYSTEM SHALL 본문 노드가 `$item` 과 `$itemIndex` 로 현재 항목과 인덱스를 읽을 수 있게 한다.
- REQ-MAP-006 WHEN 핸들러가 시작 시점 출력을 반환하면 THE SYSTEM SHALL 해석한 배열을 `output` 으로 반환하고 엔진이 그 항목을 본문으로 나눠 준다.
- REQ-MAP-007 WHEN 모든 반복 회차가 끝나면 THE SYSTEM SHALL 핸들러를 다시 부르지 않고 노드 `output` 을 `{ mapped, count }` 로 덮어쓴 뒤 `done` 포트를 활성화한다.
- REQ-MAP-008 WHEN 결과 배열을 만들면 THE SYSTEM SHALL 원본 배열과 같은 인덱스를 유지한다.
- REQ-MAP-009 IF 본문 회차가 실패하고 항목 에러 정책이 `stop` 이면 THE SYSTEM SHALL 회차의 에러 메시지를 그대로 전파해 실행을 실패시킨다.
- REQ-MAP-010 IF 본문 회차가 실패하고 항목 에러 정책이 `skip` 이나 `continue` 면 THE SYSTEM SHALL 그 인덱스에 `{ _skipped: true, error: { code, message } }` 를 넣고 노드를 정상 종료한다.
- REQ-MAP-011 WHEN 노드 출력을 만들면 THE SYSTEM SHALL 컬렉션 키로 반드시 `mapped` 를 쓴다.
- REQ-MAP-012 WHEN 다음 노드가 Map 노드 출력을 읽으면 THE SYSTEM SHALL 시작 시점의 원래 배열을 드러내지 않고 `{ mapped, count }` 형태만 보여 준다.
- REQ-MAP-013 IF `inputField` 가 없거나 빈 문자열이거나 `null` / `undefined` 면 THE SYSTEM SHALL 캔버스에 경고 배지를 표시하고 `handler.validate` 에서 거부한다.
- REQ-MAP-014 IF `errorPolicy` 가 `stop` / `skip` / `continue` 가 아니면 THE SYSTEM SHALL `handler.validate` 에서 거부한다.
- REQ-MAP-015 IF `emit` 포트에 본문 노드가 없거나 2개 이상이면 THE SYSTEM SHALL 엔진 사전 검증에서 `CONTAINER_MISSING_EMIT` / `CONTAINER_MULTIPLE_EMIT` 로 실행을 실패시킨다.
- REQ-MAP-016 IF 컨테이너 본문 안에 되돌아가는 연결선이나 블로킹 노드가 있으면 THE SYSTEM SHALL 엔진 사전 검증에서 실행을 실패시킨다.
- REQ-MAP-017 WHILE Map 노드가 실행 중인 동안 THE SYSTEM SHALL 컨테이너 헤더에 현재 항목 인덱스(예 `Item 2/5`)를 표시한다.
- REQ-MAP-018 WHEN Map 노드를 정의하면 THE SYSTEM SHALL 별도 `error` 출력 포트와 동적 포트를 두지 않는다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| inputField | Expression | ✓ | `''` | 변환할 배열 필드. dot-path 문자열(`"items"`)이면 `$input` 에 적용하고 inline 표현식(`{{ $var.a }}`)이면 resolver 가 치환한 값을 그대로 쓴다 |
| errorPolicy | `stop` / `skip` / `continue` | | `stop` | 반복 중 항목 에러 정책. [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#항목-에러-정책) |

코드 기준: `codebase/backend/src/nodes/logic/map/map.schema.ts` (export `mapNodeConfigSchema`)

설정 패널은 이 노드의 `config.errorPolicy` 를 에러 처리 정책(`config.errorHandling.policy`)으로 옮기지 않고 저장할 때 지우지도 않는다([노드 포트와 설정 패널](../CLE-WF/CLE-WF-NODEPANEL.md#에러-처리-정책-설정) 의 REQ-NODEUI-041, [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md#레거시-평면-키-이전-범위를-좁힌-이유)).

## 설정 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|--------------|------|
| 입력 필드 | 맨 위 | `Input Field` 입력(예 `$input.items`), 아래 안내 "Dot-path or inline expression returning an array" | `inputField` 를 편집한다 |
| 에러 정책 | 아래 | `Error Policy` 드롭다운(`stop` / `skip` / `continue`) | `errorPolicy` 를 바꾼다 |

## 포트

| 방향 | id | label | type | dynamic | 설명 |
|------|------|-------|------|---------|------|
| 입력 | `in` | Input | data | false | 외부 데이터 진입 |
| 입력 | `emit` | Emit | data | false | 컨테이너 본문에서 결과를 모으는 지점. 본문 노드가 정확히 1개 연결돼야 한다([Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#컨테이너-패턴)) |
| 출력 | `body` | Body | data | false | 항목을 본문 첫 노드로 넘긴다(회차마다 1번) |
| 출력 | `done` | Done | data | false | 모든 반복 회차가 끝난 뒤 `{ mapped, count }` 형태로 다음 노드에 넘긴다 |

Map 은 동적 포트가 없다.

## 실행 로직

1. **입력 해석**: `inputField` 를 `resolveFieldValue(input, inputField)` 로 풀어 배열을 꺼낸다. dot-path 문자열이면 `$input` 의 중첩 경로를 읽고 inline 표현식이면 resolver 가 이미 치환한 값을 그대로 받는다. 결과가 배열이 아니면 `[]` 로 대체한다. 이 처리는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 빈 입력 절과 정의가 갈린다. [미결 사항](#미결-사항) 참조.
2. **시작 시점(본문 진입 직전)**: 핸들러가 `output: items` (해석한 배열)를 반환한다. 엔진의 `ForEachExecutor` 가 항목을 `body` 포트로 나눠 준다.
3. **반복 실행**: 항목마다 `$item` / `$itemIndex` 를 묶고 본문을 위상 순서로 실행한다. `emit` 포트에 연결된 본문 노드의 출력을 그 회차의 변환 결과로 모은다.
4. **항목 에러 정책**: `stop` 은 곧바로 실패한다. `skip` 은 그 인덱스에 `{ _skipped: true, error }` 를 넣는다. `continue` 는 에러 항목도 포함한다. 원본 배열과 같은 인덱스를 유지한다([컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md)).
5. **완료 시점(모든 회차 종료 뒤)**: 엔진이 노드 `output` 을 `{ mapped: [...], count: N }` 으로 덮어쓰고 `done` 포트를 활성화한다([Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#엔진-덮어쓰기-계약)).

## 출력 구조

Map 은 컨테이너라서 핸들러 시점 출력과 엔진 덮어쓰기 뒤 출력이 다르다. 컬렉션 키는 `mapped` 로 ForEach 의 `items` 와 다르다. Loop · ForEach · Map 의 완료 출력에는 `port` 필드가 없고 `done` 포트는 엔진이 연결선을 활성화해 여는 것이다. JSON 예시는 `undefined` 필드를 생략했고 5필드 밖의 최상위 키는 쓰지 않는다.

### 시작 시점 (본문 진입 직전)

핸들러가 해석한 배열을 `output` 으로 반환하면 엔진이 항목을 본문으로 나눠 준다. 이 시점의 노드 출력은 다음과 같다.

```json
{
  "config": {
    "inputField": "{{ $input.items }}",
    "errorPolicy": "stop"
  },
  "output": [
    { "id": 1, "name": "Alice" },
    { "id": 2, "name": "Bob" },
    { "id": 3, "name": "Carol" }
  ],
  "meta": {
    "durationMs": 0
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.inputField` | Expression | 설정 에코 | 사용자가 입력한 원래 표현식. `{{ }}` 을 남긴다 |
| `config.errorPolicy` | `'stop'` / `'skip'` / `'continue'` | 설정 에코 | 항목 에러 정책(기본 `stop`) |
| `output` | unknown[] | 런타임, 핸들러 반환 | 해석한 원래 배열(항목이 본문으로 나뉜다). `inputField` 가 배열이 아니거나 해석되지 않으면 `[]` |
| `meta.durationMs` | number | 엔진 주입 | 핸들러 호출의 실행 시간(ms) |

이 시점의 `output` 은 해석한 원래 배열이다. 본문 반복 입력을 나눠 주는 데만 쓰고 다음 노드가 직접 참조하면 안 된다. 완료 뒤 `{ mapped, count }` 로 덮어써진다. 이 배열을 엔진 내부 표현으로 두는 이유(D2 결정)는 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#rationale) 에 있다.

본문 안에서의 표현식 접근:

- `$item` → 현재 항목(예: `{ id: 1, name: "Alice" }`)
- `$itemIndex` → 현재 인덱스(0부터)

### 완료 시점 (`done` 포트)

모든 회차가 끝나면 엔진이 노드 `output` 을 `{ mapped, count }` 로 덮어쓴다.

```json
{
  "config": {
    "inputField": "{{ $input.items }}",
    "errorPolicy": "stop"
  },
  "output": {
    "mapped": [
      { "id": 1, "label": "user-1: Alice" },
      { "id": 2, "label": "user-2: Bob" },
      { "id": 3, "label": "user-3: Carol" }
    ],
    "count": 3
  },
  "meta": {
    "durationMs": 187
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | 시작 시점과 같음 | 설정 에코 | |
| `output.mapped` | unknown[] | 엔진 덮어쓰기 | 회차마다의 `emit` 포트 출력을 모은 변환 결과 배열. ForEach 의 `items` 가 아니라 `mapped` 키를 쓴다 |
| `output.count` | number | 엔진 덮어쓰기 | 실행한 회차 수(`mapped.length` 와 같음. O(1) 접근) |
| `meta.durationMs` | number | 엔진 주입 | 컨테이너 전체 실행 시간(ms). 완료 출력에 이 값이 실리는지는 ForEach 문서와 서술이 다르다. [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#미결-사항) 참조 |

표현식 접근 예:

- `$node["Map"].output.mapped` → 변환 결과 배열
- `$node["Map"].output.mapped[0].label` → `"user-1: Alice"`
- `$node["Map"].output.count` → `3`

**빈 배열 입력**: `inputField` 해석 결과가 `[]` 이거나 배열이 아니면 본문을 0회 실행하고 `output: { mapped: [], count: 0 }` 으로 `done` 포트를 곧바로 활성화한다.

**`errorPolicy: 'skip' / 'continue'` 일 때**: 인덱스를 지키려고 실패 항목 자리에 `output.mapped[i] = { _skipped: true, error: { code, message } }` 를 넣는다. Map 의 의도는 "같은 타입으로 바꾼 배열" 이므로 다음 노드는 `_skipped` 표시로 정상과 실패를 가려야 한다. ForEach 는 `null` 자리와 별도 `skipped[]` 배열을 쓴다. 두 노드가 형태를 달리하는 이유(D3 결정)는 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#rationale) 에 있다. 현재 구현은 실행기가 따로 모은 실패 목록으로 이 인라인 표시를 다시 만든다(`execution-engine.service.ts` 의 컨테이너 완료 처리).

### 엔진 덮어쓰기 계약

| 시점 | 노드 `output` | 책임 |
|------|----------------|------|
| 핸들러 호출(시작) | `items[]` (해석한 원래 배열) | `MapHandler.execute` 가 반환 |
| 본문 반복 중 | 변경 없음(`body` 포트는 항목을 나눠 주기만 한다) | `ForEachExecutor` |
| 모든 회차 완료(`done`) | `{ mapped: [...], count: N }` | **엔진이 덮어쓴다** |

1. 핸들러는 시작 시점에 한 번만 실행돼 `output: items` (배열)를 반환한다(`map.handler.ts`). 엔진의 `ForEachExecutor` 는 이 배열을 본문 분배 입력으로 쓰고 모든 회차가 끝나면 핸들러를 다시 부르지 않고 `{ mapped, count }` 로 노드 출력의 `output` 을 덮어쓴다.
2. 다음 노드는 항상 완료 시점 형태(`output.mapped[i]` / `output.count`)만 본다. 시작 시점의 원래 배열은 드러나지 않는다.
3. 컬렉션 키는 ForEach 의 `items`, Loop 의 `iterations`, Parallel 의 `branches` 와 모두 다르다. Map 의 컬렉션 키는 반드시 `mapped` 다.

핸들러가 `null` 이 아닌 배열을 반환하는데도 엔진이 덮어쓰는 이 동작은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 덮어쓰기 규칙과 정의가 갈린다. [미결 사항](#미결-사항) 참조.

## 에러

Map 핸들러에는 런타임 에러 포트가 없다. 검증 실패는 설정 검증 단계의 사전 검증 에러이고 컨테이너 본문 에러는 항목 에러 정책으로 흡수하거나 컨테이너 실패로 전파한다. 노드 경고 규칙 메시지는 영문 원문이 기준이고 캔버스에서는 프론트엔드 다국어 매핑이 한국어로 보여 준다.

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `inputField` 없음 / 빈 문자열 / `null` / `undefined` | `Input field must be entered.` | 노드 경고 규칙(캔버스 배지) + `handler.validate` |
| `errorPolicy` 가 `stop` / `skip` / `continue` 가 아님 | `errorPolicy must be one of: stop, skip, continue` | `handler.validate` |
| `emit` 포트 미연결 | `CONTAINER_MISSING_EMIT` | 엔진 사전 검증([Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#컨테이너-패턴)) |
| `emit` 포트에 2개 이상 연결 | `CONTAINER_MULTIPLE_EMIT` | 엔진 사전 검증 |
| 본문 안에 되돌아가는 연결선 / 블로킹 노드(form / buttons / ai_conversation) | 컨테이너 제약 위반 | 엔진 사전 검증 |
| 본문 회차 에러 + `errorPolicy: 'stop'` | 회차 에러 메시지를 그대로 전파 | 런타임, 엔진이 실패로 표시 |
| 본문 회차 에러 + `errorPolicy: 'skip' / 'continue'` | `output.mapped[i]._skipped = true` 로 인라인 기록 | 런타임, 노드는 정상 종료 |

## 설정 요약

- 형식: `{inputField}`
- 예: `$input.items`
- 구현: `map.schema.ts` 의 `summaryTemplate` (`'{{inputField}}'`). `inputField` 가 없으면 `summaryTemplate.warnWhen` (`!inputField`, 메시지 `Input field not set`)으로 배지를 표시한다. 새 경고 규칙의 기준은 `warningRules` 이고 `warnWhen` 은 하위 호환으로 남긴 것이다.
- 이 형식은 옛 캔버스 문서와 현재 구현을 따른 것이다. Logic 공통 원문은 `{N} mappings` 를 적어 정의가 갈린다. [미결 사항](#미결-사항) 참조.
- 실행 중 컨테이너 헤더에는 현재 인덱스를 표시한다(예: `Item 2/5`). 이 표시의 구현 여부는 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#미결-사항) 에 적었다.

## 미결 사항

- **엔진 덮어쓰기 규칙이 노드 출력 규약과 갈린다** (critical): 핸들러가 배열을 반환해도 엔진이 완료 시점에 덮어쓴다. [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 은 `null` 이 아닌 값을 반환하면 덮어쓰지 않는다고 적는다. 결정 항목은 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#미결-사항) 에 모았다. 결정에 따라 REQ-MAP-006 · 007 이 바뀔 수 있다. 정리는 NERV Task `CLE-T-3HJ8MM` 이 맡는다.
- **배열 아닌 입력의 처리가 노드 출력 규약과 갈린다** (critical): 이 문서는 원시값까지 모든 비배열을 `[]` 로 대체한다. [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 은 숫자·문자열이면 에러를 던지라고 정한다. 결정 항목은 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#미결-사항) 에 모았다. 결정에 따라 REQ-MAP-004 가 바뀔 수 있다. 정리는 NERV Task `CLE-T-3HJ8MM` 이 맡는다.
- **설정 요약 형식이 원문끼리 갈린다** (warning): 이 문서의 `{inputField}` 는 옛 캔버스 문서의 형식이고 현재 구현(`map.schema.ts` 의 `summaryTemplate`)과 같다. Logic 공통 원문은 `{N} mappings` 를 적었지만 Map 설정에는 매핑 개수를 담는 필드가 없다. 결정 항목은 [Logic 노드 공통 미결 사항](CLE-NODE-LOGIC-COMMON.md#미결-사항) 의 "Map · Background 의 설정 요약 형식" 에 모았다.
- **에러 처리 정책의 동적 에러 포트와 REQ-MAP-018** (warning): [노드 포트와 설정 패널](../CLE-WF/CLE-WF-NODEPANEL.md#요구사항) 의 REQ-NODEUI-012 는 에러 처리 정책이 `route_to_error_port` 면 노드에 동적 에러 포트를 만든다고 정한다. 이 포트와 REQ-MAP-018(에러 포트 없음)의 관계는 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#미결-사항) 미결 사항의 「Logic 노드에 에러 처리 정책이 적용되는가」 항목에서 정한다.

## 구현 위치

- `codebase/backend/src/nodes/logic/map/map.*.ts`
- `codebase/backend/src/modules/execution-engine/containers/foreach-executor.ts` (ForEach 와 함께 쓰는 실행기)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (완료 시점 덮어쓰기와 `_skipped` 표시 재구성)

## Rationale

### 컬렉션 키를 `mapped` 로 둔다

Map 과 ForEach 는 같은 실행기를 쓰지만 뜻이 다르다. ForEach 는 항목마다의 부수 효과이고 Map 은 변환 결과 수집이다. 그래서 Map 은 컬렉션 키를 `mapped` 로 따로 둔다. 네 엔진 덮어쓰기 대상 노드는 컬렉션 키가 모두 다르다([Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#반복-결과-출력-구조)).

시작 시점 배열을 엔진 내부 표현으로 두는 결정(D2)과 실패 표현을 ForEach 와 다르게 두는 결정(D3)은 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#rationale) 에 있다.

### 설정 패널이 항목 에러 정책을 지우지 않는다 (2026-10-10)

2026-10-10 에 설정 패널이 항목 에러 정책을 지우던 결함을 고쳤다(NERV Task `CLE-T-V0JAG1`). 결정과 근거는 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md#레거시-평면-키-이전-범위를-좁힌-이유) 에 있다.

항목 에러 정책 키를 `itemErrorPolicy` 같은 새 이름으로 바꾸는 안은 저장된 워크플로우의 노드 설정을 옮기는 데이터 마이그레이션이 필요해서 기각했다.
