---
id: "CLE-NODE-LOGIC-COMMON-OUTPUT"
title: "Logic 노드 공통 — 반복 · 병렬 출력과 엔진 덮어쓰기"
type: "convention"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-LOGIC-COMMON"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-LOGIC", "CLE-NODE-LOGIC-COMMON"]
area: "CLE-NODE-LOGIC"
content_hash: "1d7f92c2460bfde82c56cd631d6f0a5598d13263650009248f43c9963b90d6cb"
read_as: "approved_fallback"
task: "CLE-T-0R8F99"
source_paths: []
mirror_sha256: "7660d9d5fa33b67757d57bfb5a603ae4d7b0f56c711e9852c252d5dab16ac1a4"
etag: "sha256-7ce0a999c0a8178032cb218eb7282fb5c1f75efe16c572cf684684bf6e947a96"
---
## 개요

이 문서는 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md) 의 하위 문서로 Loop · ForEach · Map · Parallel 의 항목 에러 정책 · 반복 결과 출력 구조 · 엔진 덮어쓰기 계약과 Logic 노드의 노드 출력 사용 패턴을 정한다.

## 항목 에러 정책

항목 에러 정책(item error policy, `config.errorPolicy`)은 반복 항목이나 병렬 분기 하나가 실패할 때의 동작이다. enum 값은 노드마다 다르다.

1. `config.errorPolicy` 는 ForEach · Map · Parallel 전용이다. Loop 에는 이 필드가 없다.
2. 일반 노드의 에러 처리 정책은 별개 설정인 `config.errorHandling.{policy, retryConfig, defaultOutput}` (5값 enum)이다. 자세한 규칙은 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) 이 정한다.
3. 한 노드에서 `config.errorPolicy` 와 `config.errorHandling` 을 같은 뜻으로 섞어 쓰지 않는다. ForEach · Map · Parallel 에는 두 키가 함께 있을 수 있다. 현재 구현은 이 세 노드의 `config.errorHandling` 을 그 노드의 핸들러 호출이 실패할 때만 적용한다. 반복 회차나 병렬 분기를 실행하는 단계에서 그 노드 자신이 실패하면 `config.errorHandling` 을 적용하지 않는다. 다만 Parallel 은 `config.errorPolicy` 가 비었을 때만 `config.errorHandling.policy` 를 읽어 항목 에러 정책 값으로 바꿔 쓴다([Parallel 노드](CLE-NODE-PARALLEL.md)). Logic 노드도 다른 노드처럼 에러 처리 정책 다섯 가지를 모두 고를 수 있다. 카테고리로 선택지를 막지 않는다([Logic 노드의 에러 처리 정책 선택지를 막지 않는다](CLE-NODE-LOGIC-COMMON.md#logic-노드의-에러-처리-정책-선택지를-막지-않는다-2026-10-24)).
4. 설정 패널은 ForEach · Map · Parallel 의 `config.errorPolicy` 를 에러 처리 정책으로 옮기지 않는다. 저장할 때 지우지도 않는다(`node-settings-panel.tsx` 의 `ITEM_ERROR_POLICY_NODE_TYPES`). 다른 노드에서 이 키를 옛 키로 보고 옮기는 규칙과 결정 근거는 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md#레거시-평면-키-이전-범위를-좁힌-이유) 에 있다.
5. 에러 처리 정책이 "에러 포트로 라우팅" 일 때 노드에 생기는 동적 에러 포트는 노드 공통 규칙이고 [노드 포트와 설정 패널](../CLE-WF/CLE-WF-NODEPANEL.md) 이 정한다. 이 동적 에러 포트는 아직 구현되지 않았다. Logic 노드에는 고정 `error` 포트도 없으므로 지금은 `error` 연결선을 이을 수 없다. 이 정책을 고른 Logic 노드가 실패하면 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md#2-에러-포트로-라우팅) 의 연결선이 없을 때 규칙대로 워크플로우 중단으로 대신 처리한다. 각 Logic 노드 문서의 "에러 포트 · 동적 포트를 두지 않는다" 요구는 노드 정의에 둔 고정 포트와 데이터 동적 포트만 가리킨다. 에러 처리 정책으로 생기는 동적 에러 포트는 이 규칙과 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) 을 따른다.

**Map / ForEach** — `stop` / `skip` / `continue` (`map.schema.ts`, `foreach.schema.ts`):

| 값 | 동작 |
|------|------|
| `stop` (기본) | 즉시 실행 실패 |
| `skip` | 실패한 인덱스에 자리를 지키는 값을 두고 실패 정보는 노드별 위치로 보낸다. ForEach 는 `output.items[i] = null` 과 `output.skipped[]`, Map 은 `output.mapped[i] = { _skipped: true, error }` 인라인 표시다 |
| `continue` | 에러가 난 항목도 결과에 포함하고 `skip` 과 같은 위치로 정보를 보낸다. 노드 실행 기록에도 에러를 남긴다 |

**Parallel** — `stop` / `continue` / `cancel-others-on-fail` (`parallel.schema.ts`, `skip` 없음):

| 값 | 동작 |
|------|------|
| `stop` (기본) | 모든 병렬 분기가 끝나기를 기다린 뒤 실패한 병렬 분기 가운데 번호(`branch_i` 의 `i`)가 가장 작은 것의 에러를 던진다(Parallel 노드 실패). 실패 뒤에도 다른 병렬 분기를 멈추지 않는다 |
| `continue` | 모든 병렬 분기가 끝나기를 기다린다. 실패한 병렬 분기 자리는 `output.branches[i] = null` 로 두고 실패 정보는 `output.skipped[]` 로 따로 모은다(ForEach 와 같은 형태) |
| `cancel-others-on-fail` | 첫 실패에서 진행 중인 다른 병렬 분기를 `AbortSignal` 로 중단한다. signal 을 받는 노드만 일찍 정리하는 best-effort 동작이다 |

ForEach 의 결과 분리 형태는 [ForEach 노드](CLE-NODE-FOREACH.md), Map 의 인라인 표시 형태는 [Map 노드](CLE-NODE-MAP.md), Parallel 의 결과 분리 형태는 [Parallel 노드](CLE-NODE-PARALLEL.md#출력-구조) 가 정한다. ForEach 와 Map 이 다른 형태를 쓰는 이유와 Parallel 이 ForEach 형태를 따르는 이유는 [ForEach 와 Map 의 실패 표현을 다르게 둔다](#foreach-와-map-의-실패-표현을-다르게-둔다) 에 있다. 결과 배열이 원본 인덱스를 지키는 규칙은 [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md) 이 정한다.

## 반복 결과 출력 구조

엔진 덮어쓰기 대상 노드는 `{ <컬렉션 키>, count }` 형태로 결과를 내보낸다 ([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-9-컨테이너와-parallel-의-출력-덮어쓰기) 의 Principle 9). 컬렉션 키는 Loop `iterations`, Map `mapped`, ForEach `items`, Parallel `branches` 다(시점별 형태는 [엔진 덮어쓰기 계약](#엔진-덮어쓰기-계약) 표).

1. 다음 노드는 `$node["X"].output.<컬렉션 키>[i]` 로 개별 결과를, `$node["X"].output.count` 로 실행된 개수를 읽는다.
2. 컬렉션 키는 네 노드가 모두 다르다. 같은 키를 두 노드가 함께 쓰지 않는다.
3. ForEach 와 Parallel 은 실패한 항목이나 병렬 분기가 있을 때만 `output.skipped` 를 더 싣는다. 항목은 `{ index, error: { code, message } }` 이고 실패 자리는 컬렉션에서 `null` 이다. Map 은 `skipped` 를 싣지 않고 `mapped[i] = { _skipped: true, error: { code, message } }` 로 실패를 인라인으로 표시한다([항목 에러 정책](#항목-에러-정책)).
4. 세 노드는 실패한 회차와 병렬 분기의 `error.code` 를 한 규칙(`resolveIterationErrorCode`, `containers/iteration-error-code.ts`)으로 고른다. 위 조건부터 차례로 본다.
   - 던진 값이 Error 가 아니면 `UNKNOWN_ERROR` 다.
   - Error 의 `name` 이 `AbortError` 면 `AbortError` 다. 취소로 끝난 회차와 병렬 분기이고 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md#3-예외-등록-코드) §3 의 예외 코드다. 에러 객체의 `code` 보다 먼저 본다.
   - Error 의 `code` 가 문자열이고 백엔드가 직접 싣는 코드면 그 값이다. 백엔드가 직접 싣는 코드는 `ErrorCode` · `EngineErrorCode` · `MCP_ERROR_CODES` 의 값과 에러 클래스가 `code` 로 싣는 리터럴(예 `MAKESHOP_RATE_LIMITED`)이다. 모두 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 에 있다.
   - 그 밖은 `UNKNOWN_ERROR` 다. `code` 가 없는 평범한 `Error` · `TypeError` 와 Node 런타임 · DB 드라이버가 싣는 `ECONNREFUSED` · `ER_DUP_ENTRY` 같은 `code` 가 여기에 든다.
5. `error.message` 는 에러 메시지다. 던진 값이 Error 가 아니면 문자열로 바꾼 값이다. `PARALLEL_INVALID_CHILD` 같은 메시지 접두사는 `error.message` 앞에 남고 `error.code` 가 되지 않는다. 4 · 5번의 근거는 [실패한 회차와 병렬 분기의 `error.code`](#실패한-회차와-병렬-분기의-errorcode-2026-11-05) 에 있다.

## 노드 출력 사용 패턴

Logic 노드는 모두 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 노드 출력(`NodeHandlerOutput`) 5필드 `{ config, output, meta?, port?, status? }` 를 따른다. Logic 카테고리에서 각 필드를 쓰는 방식은 다음과 같다.

| 필드 | Logic 카테고리에서의 사용 |
|------|---------------------------|
| `config` | 설정 에코(config echo). `conditions[]` 같은 표현식 `{{ }}` 은 평가 전 형태로 남긴다. Logic 카테고리에는 자격 증명·민감 필드가 없다 |
| `output` | If/Else · Switch · 변수 선언 · 변수 수정 · Background(`main` 포트)는 입력을 그대로 넘긴다([패스스루 규약](CLE-NODE-LOGIC-COMMON.md#패스스루-규약)). Filter 는 입력 배열을 두 부분집합으로 나눈 결과다. 엔진 덮어쓰기 대상 노드(loop, foreach, map, parallel)는 [엔진 덮어쓰기 계약](#엔진-덮어쓰기-계약) 을 따른다. Split · Merge 는 계산 결과다 |
| `meta` | 실행 메트릭만 싣는다. Loop · ForEach · Map 은 완료 시점에 `meta.iterations` 를 싣는다. ForEach · Map 은 실패 항목이 있을 때 `meta.skippedCount` 를 더 싣는다. Loop 는 `meta.maxIterationsReached` · `meta.exitReason` 을 더 싣는다. Split · ForEach · Map · Filter 는 `meta.fellBackToEmpty` 를 싣는다([배열이 아닌 입력 처리](CLE-NODE-LOGIC-COMMON.md#배열이-아닌-입력-처리)). Filter 는 `meta.matchedCount` · `unmatchedCount` · `totalCount` 도 싣는다([Filter 노드](CLE-NODE-FILTER.md)). Parallel 은 중첩 Parallel 에서 동시 실행 수를 줄였을 때만 `meta.clampedConcurrency` 를 싣는다. 조건 노드는 `meta.conditionResult?` / `matchedConditions?` 를 싣는다. `meta.durationMs` 를 누가 채우는지는 노드 문서가 정한다. 엔진 덮어쓰기 대상 노드의 완료 `meta` 에는 `meta.durationMs` 가 없다. `node_execution.duration_ms` 와 `execution.node.completed` 이벤트의 `duration` 은 핸들러 실행 시간이고 노드 전체 실행 시간을 둘 곳은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#미결-사항) 의 미결 사항에서 정한다 |
| `port` | If/Else 는 `'true'` / `'false'`, Switch 는 케이스 ID 또는 `'default'`, Background 는 `'main'`. Parallel 은 시작할 때 `string[]`(병렬 분기 전부), 끝날 때 `'done'`. Loop · ForEach · Map 은 노드 출력에 `port` 를 싣지 않고 엔진이 `done` 연결선을 활성화한다. Filter 는 `port` 없이 두 포트를 모두 활성화한다. 출력이 하나인 노드는 `undefined` |
| `status` | Logic 노드는 모두 블로킹하지 않으므로 `undefined` 다 |

## 엔진 덮어쓰기 계약

엔진 덮어쓰기(engine override)를 받는 노드는 Loop · ForEach · Map · Parallel 이다(`execution-engine.service.ts`). 이 노드들의 노드 출력은 시점마다 `output` 이 다르다.

1. **시작 시점**(본문 진입 직전): 핸들러가 한 번 실행된다. ForEach 와 Map 은 `output: items[]` 를 반환하고 엔진은 이 배열을 본문 반복 회차 입력으로 나눠 준다. Loop 와 Parallel 은 `output: null` 을 반환한다.
2. **완료 시점**(모든 반복 회차가 끝난 뒤): 엔진이 핸들러를 다시 부르지 않고 `output` 을 `{ <컬렉션 키>: [...], count: N }` 으로 직접 덮어쓴다. 핸들러는 두 번째로 호출되지 않는다. ForEach 와 Parallel 은 실패가 있을 때 `skipped` 를 더 싣는다([반복 결과 출력 구조](#반복-결과-출력-구조) 3번).
3. 시작 시점의 `output: items[]` 는 엔진 안에서만 쓰는 중간 표현이다. 완료 시점에 엔진이 실행 컨텍스트의 출력을 덮어쓰므로 park · 재구동 없이 이어진 실행에서는 다음 노드 표현식(`$node["X"].output.*`)에 이 배열이 드러나지 않는다. 실행 내역 API 가 읽는 노드 실행 기록(`node_execution.output_data`)과 `execution.node.completed` 이벤트(엔진 상수 `NODE_COMPLETED`)에는 아직 시작 시점 배열이 남는다. 재개 · 재구동 때는 이 저장값으로 실행 컨텍스트를 rehydration 하므로 그 뒤 노드 표현식도 시작 시점 배열을 읽는다. 이 부분은 구현되지 않았고 부모 문서의 [미결 사항](CLE-NODE-LOGIC-COMMON.md#미결-사항) 에서 다룬다. (부분 구현)
4. 다음 노드는 `done` 포트 뒤에서 `{ <컬렉션 키>, count }` 형태를 본다. 지금은 규칙 3 대로 park · 재구동 없이 이어진 실행에서만 그렇다.
5. 덮어쓰기는 `output` 을 바꾼다. `meta` 는 규칙 6 대로 합친다. `config` 는 핸들러가 반환한 그대로 남는다. Parallel 은 `port` 도 `'done'` 문자열로 바꾼다. Loop · ForEach · Map 은 노드 출력에 `port` 를 싣지 않는다.
6. Loop · ForEach · Map 의 완료 시점 `meta` 는 핸들러가 시작 시점에 돌려준 `meta` 에 엔진이 잰 반복 메트릭을 합친 값이다. 같은 키가 겹치면 엔진 값을 쓴다. 그래서 ForEach · Map 의 `meta.fellBackToEmpty` 는 완료 출력에도 남는다. Parallel 은 핸들러 `meta` 를 합치지 않고 `clampedConcurrency` 만 싣는다. 이 값도 중첩 Parallel 에서 동시 실행 수를 줄였을 때만 싣는다.
7. Parallel 은 `PARALLEL_ENGINE=off` 되돌림 경로에서 덮어쓰기를 받지 않는다. 노드 출력은 시작 시점 형태(`output: null`, `port: string[]`)로 남는다([Parallel 노드](CLE-NODE-PARALLEL.md#off-되돌림-경로는-완료-출력을-만들지-않는다-2026-11-02)).

| 노드 | 컬렉션 키 | 시작 시점 `output` (핸들러 반환) | 완료 시점 `output` (엔진 덮어쓰기) |
|------|-----------|--------------------|----------------------------------------|
| `loop` | `iterations` | `null` (Loop 는 입력을 나눠 주지 않는다) | `{ iterations: [...], count }` |
| `foreach` | `items` | `items[]` (본문 입력 분배) | `{ items: [...], count, skipped? }` |
| `map` | `mapped` | `items[]` (본문 입력 분배) | `{ mapped: [...], count }` |
| `parallel` | `branches` | `null` (병렬 분기마다 같은 입력) | `{ branches: [...], count, skipped? }` |

```mermaid
flowchart LR
  A[핸들러 한 번 호출] --> B[시작 시점 output]
  B --> C[엔진이 반복 회차나 병렬 분기 실행]
  C --> D[엔진이 output 덮어쓰기]
  D --> E[done 연결선 활성화]
  E --> F[다음 노드가 컬렉션 키와 count 를 읽음]
```

ForEach 와 Map 은 `null` 이 아닌 배열을 반환하지만 엔진은 완료 시점에 반환값과 상관없이 덮어쓴다. 이 규칙은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#91-계약) 의 9.1 이 정한다.

## 구현 위치

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (엔진 덮어쓰기)
- `codebase/backend/src/modules/execution-engine/containers/iteration-error-code.ts` (실패한 회차와 병렬 분기의 `error.code` 규칙 `resolveIterationErrorCode`)
- `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` (`ITEM_ERROR_POLICY_NODE_TYPES`: 레거시 평면 키 이전에서 뺄 노드 유형)

## Rationale

### 시작 시점 배열을 엔진 내부 표현으로 둔다

ForEach · Map 핸들러는 시작 시점에 `output: items[]` 를 반환하고 다음 노드 표현식에 드러나게 하려는 형태는 `{ <컬렉션 키>, count }` 다. 핸들러 시그니처와 외부 노출 형태가 다른 것은 의도한 설계다. 노드 출력 5필드를 깨지 않고 나눠 줄 데이터를 엔진에 넘기는 방법이 이것이기 때문이다.

이 배열을 다음 노드 표현식과 외부에 드러내지 않는 것은 지금도 목표다. 2026-10-24 에 확인한 범위에서 park · 재구동 없이 이어진 실행의 다음 노드 표현식에는 이 배열이 드러나지 않는다. 노드 실행 기록 · 실행 이벤트와 rehydration 한 실행 컨텍스트에는 아직 남는다. 이 구현 갭은 부모 문서의 [미결 사항](CLE-NODE-LOGIC-COMMON.md#미결-사항) 이 맡는다.

기각한 대안은 핸들러가 `null` 을 반환하고 별도 엔진 내부 채널로 배열을 넘기는 방식이다. 동작은 같은데 5필드 계약을 바꾸는 비용이 더 커서 채택하지 않았다.

### ForEach 와 Map 의 실패 표현을 다르게 둔다

`skip` / `continue` 때 ForEach 는 실패를 `skipped[]` 로 나누고 Map 은 `mapped[]` 안에 표시한다([항목 에러 정책](#항목-에러-정책)). 두 노드의 의미가 다르기 때문이다.

- **Map** 은 "같은 타입으로 바꾼 배열" 계약이다. 다음 노드가 `mapped.map(...)` 처럼 배열 전체를 한 번에 다루므로 실패 항목도 같은 배열에 두는 편이 자연스럽다. `_skipped` 표시로 정상과 실패를 가른다.
- **ForEach** 는 "독립 항목 반복" 계약이다. 반복 회차가 서로 독립이므로 성공과 실패가 한 배열에 섞이지 않는 편이 뜻이 분명하다. `items[]` 에는 성공과 `null` 만, `skipped[]` 에는 실패만 둔다.

그래서 두 형태를 하나로 합치지 않고 현재 정책을 유지한다.

Parallel 의 `continue` 도 병렬 분기가 서로 독립이라 ForEach 형태를 따른다. `branches[]` 에는 병렬 분기 결과와 실패 자리의 `null` 만, `skipped[]` 에는 실패만 둔다(2026-11-01, [Parallel 노드](CLE-NODE-PARALLEL.md#완료-출력은-병렬-분기-결과를-그대로-두고-실패를-따로-모은다-2026-11-01)).

### 실패한 회차와 병렬 분기의 `error.code` (2026-11-05)

ForEach · Map · Parallel 은 실패한 회차와 병렬 분기의 `error.code` 에 던진 Error 의 `name` 을 실어 왔다. 실제 값은 대부분 `Error` · `TypeError` 였고 일부는 `MakeshopRateLimitedError` 같은 클래스 이름이었다. 이 값은 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md#규칙) 규칙 2 의 `UPPER_SNAKE_CASE` 를 따르지 않았다. Error 가 아닌 값에 쓰던 `UNKNOWN_ERROR` 는 카탈로그에 없었다. 그래서 [Parallel 노드](CLE-NODE-PARALLEL.md#errorcode-의-값-2026-11-01) 가 임시 예외로 적어 두었고 사람의 결정 두 번으로 이 예외를 닫았다(2026-11-05).

- 세 노드가 한 함수를 쓴다. 전에는 `name` 이 빈 문자열일 때 ForEach 는 빈 문자열을, Parallel 은 `UNKNOWN_ERROR` 를 냈다. 같은 모양의 실패 정보에서 값이 노드마다 갈리지 않게 했다.
- 문자열 `code` 는 백엔드가 직접 싣는 코드의 허용 목록에 있을 때만 그대로 낸다. 첫 결정은 `UPPER_SNAKE_CASE` 모양이면 그대로 내는 안이었다. 구현하면서 Node 런타임 · DB 드라이버의 에러도 `ECONNREFUSED` · `ERR_INVALID_URL` · `ER_DUP_ENTRY` 처럼 같은 모양의 `code` 를 싣는다는 것을 찾았다. 이 값은 카탈로그에 없어 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md#규칙) 규칙 8 과 어긋난다. 그래서 다시 물어 허용 목록으로 좁혔다. 나가는 값은 늘 카탈로그 안에 있다.
- 새 에러 클래스를 허용 목록에 빠뜨리면 그 값이 `UNKNOWN_ERROR` 로 바뀐다. 그래서 단위 테스트(`iteration-error-code.spec.ts`)가 소스의 에러 클래스 `code` 리터럴이 모두 목록에 있는지, 목록의 값이 아직 소스에 있는지 본다.
- `AbortError` 는 `name` 으로 먼저 본다. Node 의 AbortError 는 `code: 'ABORT_ERR'` 를 싣지만 취소된 회차는 §3 예외 코드 `AbortError` 하나로 모은다.
- 대체값은 `UNKNOWN_ERROR` 로 두고 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md#66-워크플로우-실행-노드-수준-런타임) §6.6 에 올린다. 옛 코드 `NODE_EXECUTION_FAILED` 는 §6.6 이 노드 출력에 더 이상 쓰지 않는다고 적은 이름이라 다시 쓰지 않았다.
- `PARALLEL_*` · `CONTAINER_*` 메시지 접두사는 코드로 올리지 않았다. 이 결정은 `error.code` 값만 다룬다.

**기존 워크플로우 영향**: `skipped[i].error.code == "Error"` 처럼 클래스 이름으로 분기하던 표현식은 더 맞지 않는다. 코드가 없는 에러는 `UNKNOWN_ERROR` 로 비교한다. 바뀐 값은 사용자 가이드(Logic 노드)에 적었다. 에러 처리 정책 「에러 포트로 라우팅」 의 `output.error.code` 도 2026-11-13 에 같은 규칙으로 바꿨다([에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md#throw-한-실패의-errorcode-를-반복-결과와-같은-규칙으로-고른다-2026-11-13), NERV Task `CLE-T-KXARNK`).

기각한 대안은 두 가지다.

- `UPPER_SNAKE_CASE` 모양이면 출처를 가리지 않고 그대로 내는 안. 런타임 · 드라이버 `code` 가 카탈로그 밖 값으로 나가 규칙 8 의 예외로 남는다.
- 런타임 · 드라이버 모양을 걸러 내는 안(`errno` · `syscall` 속성, `ERR_` · `ER_` 접두사, `E` 로 시작하는 한 단어). 목록을 관리하지 않아도 되지만 휴리스틱이라 다른 드라이버의 값이 새어 나갈 수 있다.

### Parallel `stop` 설명을 실행기 동작에 맞춘다 (2026-11-06)

이 표는 Parallel 의 `stop` 을 "첫 병렬 분기가 실패하면 에러를 던진다" 로 적었다. 실행기는 모든 병렬 분기가 끝나기를 기다린 뒤 실패한 병렬 분기 가운데 번호가 가장 작은 것의 에러를 던진다. [Parallel 노드](CLE-NODE-PARALLEL.md#stop-은-모든-병렬-분기를-기다린-뒤-실패를-던진다-2026-11-06) 가 같은 날 요구사항 문장을 이 동작에 맞췄고 이 표도 같은 말로 고쳤다. 동작을 바꾸지 않은 이유와 기각한 대안은 그 Rationale 에 있다. 기존 워크플로우 영향은 없다.
