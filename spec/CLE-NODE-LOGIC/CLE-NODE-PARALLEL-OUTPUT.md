---
id: "CLE-NODE-PARALLEL-OUTPUT"
title: "Parallel 노드 — 출력 구조"
type: "design"
version: 6
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-PARALLEL"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-LOGIC", "CLE-NODE-PARALLEL"]
area: "CLE-NODE-LOGIC"
content_hash: "03ba14e54ec7b8847105797458e374c01c9d432e257e7b74c7cdc85ea926bd93"
read_as: "approved_fallback"
task: "CLE-T-7JJHF2"
source_paths: []
mirror_sha256: "a3339415139e3a0906767e9433ee72072482f6f65b97065a8cbb4ab69e901903"
etag: "sha256-2784871e8f079c6a4c02286de8442b4501740f431305b625dba4c0ce44a7e062"
---
## 개요

이 문서는 [Parallel 노드](CLE-NODE-PARALLEL.md) 의 하위 문서로 시작 시점과 완료 시점의 출력 구조, 엔진 덮어쓰기 계약, `PARALLEL_ENGINE=off` 되돌림 경로의 출력을 정한다. `branches[i]` 에 담을 결과 노드를 고르는 규칙은 [실행 로직](CLE-NODE-PARALLEL-EXEC.md#병렬-분기의-노드-집합과-위상-순서) 이 정한다.

## 출력 구조

Parallel 은 엔진 덮어쓰기 대상 노드라서 시작 시점(병렬 분기 N개 fan-out)과 완료 시점(`done` 포트) 두 형태로 나눈다. JSON 예시는 `undefined` 필드를 생략했고 5필드 밖의 최상위 키는 쓰지 않는다.

### 시작 시점 (핸들러 반환)

```json
{
  "config": { "branchCount": 3, "maxConcurrency": 0, "waitAll": true, "errorPolicy": "continue" },
  "output": null,
  "port": ["branch_0", "branch_1", "branch_2"]
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.branchCount` | Integer (원래 값) | 설정 에코 | 사용자가 설정한 원래 값(범위 맞추기 전). 핸들러의 출력 포트 수는 맞춘 뒤 길이지만 설정 에코는 원래 값을 지킨다 |
| `config.maxConcurrency` | Integer (원래 값) | 설정 에코 | 사용자 설정 원래 값. 음수·16 초과 같은 잘못된 값도 그대로 싣고 실제 동작은 실행기가 맞춘다 |
| `config.waitAll` | Boolean (원래 값) | 설정 에코 | 사용자 설정 원래 값. 설정하지 않았으면 `undefined` 라 JSON 에서 빠진다. 검증을 통과한 값은 `true` 다 |
| `config.errorPolicy` | String (원래 값) | 설정 에코 | 사용자 설정 원래 값. 설정하지 않았으면 `undefined` 라 JSON 에서 빠지고 엔진은 [설정](CLE-NODE-PARALLEL-CONFIG.md#설정) 2번대로 정책을 고른다 |
| `output` | `null` | 핸들러 반환 | 엔진 덮어쓰기 대상 노드의 핸들러 계약(Loop · ForEach · Map 과 같은 계열). 엔진 안에서만 쓰는 중간 형태다. 다음 노드가 `$node["X"].output.*` 로 보는 값은 완료 시점 형태다. 노드 실행 기록과 rehydration 도 완료 시점 형태를 쓴다([엔진 덮어쓰기 계약](#엔진-덮어쓰기-계약) 1번) |
| `port` | `string[]` | 핸들러 반환 | `branch_0` ~ `branch_{N-1}` 을 모두 활성화한다(fan-out). 병렬 분기 진입점을 여는 신호 |

### 완료 시점 (`done` 포트)

`errorPolicy='continue'` 에서 `branch_2` 가 실패한 예다.

```json
{
  "config": { "branchCount": 3, "maxConcurrency": 0, "waitAll": true, "errorPolicy": "continue" },
  "output": {
    "branches": [
      { "userId": "u-1", "step": "validate", "ok": true },
      { "userId": "u-1", "step": "enrich", "ok": true },
      null
    ],
    "count": 3,
    "skipped": [
      { "index": 2, "error": { "code": "UNKNOWN_ERROR", "message": "notify failed" } }
    ]
  },
  "port": "done"
}
```

예시의 `"UNKNOWN_ERROR"` 는 `code` 가 없는 평범한 Error 를 던졌을 때의 값이다. 실패한 병렬 분기가 없으면 `output.skipped` 필드 자체가 없다.

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | 원래 값 | 설정 에코 | 시작 시점과 같음 |
| `output.branches` | `Array<unknown \| null>` | 엔진 덮어쓰기 | 병렬 분기마다의 결과. `branches[i]` 는 `branch_i` 병렬 분기의 결과 노드 출력이고 고르는 규칙은 [병렬 분기의 노드 집합과 위상 순서](CLE-NODE-PARALLEL-EXEC.md#병렬-분기의-노드-집합과-위상-순서) 가 정한다. 실패한 병렬 분기는 `null` 이다. 컬렉션 키는 `branches` ([Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#반복-결과-출력-구조)) |
| `output.count` | Integer | 엔진 덮어쓰기 | 병렬 분기 수(`branches.length`). 실패한 병렬 분기도 자리를 지키므로 함께 센다. 컬렉션 키와 `count` 를 함께 내는 공통 규칙을 따른다 |
| `output.skipped?` | `Array<{ index, error: { code, message } }>` | 엔진 덮어쓰기 | `errorPolicy='continue'` 에서 실패한 병렬 분기 목록이고 `index` 오름차순이다. `index` 는 병렬 분기 번호(`branch_<index>` 의 index)다. `error.code` 와 `error.message` 는 ForEach · Map 과 같은 규칙으로 고른다([Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#반복-결과-출력-구조) 4 · 5번). `error.code` 는 카탈로그 코드 · `AbortError` · `UNKNOWN_ERROR` 가운데 하나다. 실패가 0건이면 필드 자체를 뺀다. 사용자 취소는 여기에 들어가지 않는다. 실행 상태 `skipped`(실행하지 않고 건너뜀)와는 다른 뜻이다 |
| `port` | `'done'` | 엔진 | 단일 문자열. 모든 병렬 분기 완료 경로 |

완료 출력의 `meta` 는 중첩 Parallel 에서 동시 실행 수를 줄였을 때만 `{ clampedConcurrency }` 로 싣고 그 밖에는 싣지 않는다([놓인 위치와 중첩](CLE-NODE-PARALLEL-NEST.md)). 병렬 분기 수와 실패 수는 `meta` 에 따로 두지 않는다. 다음 노드는 병렬 분기 수를 `output.count` 로, 실패는 `output.skipped` 로 읽는다(실패 수는 `output.skipped.length`). `meta.durationMs` 도 없다. 핸들러와 병렬 분기를 모두 포함한 노드 전체 실행 시간은 노드 실행 기록의 `duration_ms` 로 읽는다([컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md#엔진-덮어쓰기)).

`errorPolicy` 가 `stop` 이나 `cancel-others-on-fail` 이면 병렬 분기가 실패할 때 Parallel 노드가 실패로 전이하고 `done` 포트를 거치지 않는다. 그래서 실패 자리의 `null` 과 `output.skipped` 는 `errorPolicy='continue'` 에서만 보인다.

표현식 접근 예:

- `$node["Parallel"].output.branches[0]` → `branch_0` 병렬 분기의 결과(실패했으면 `null`)
- `$node["Parallel"].output.branches[0].ok` → `branch_0` 결과의 필드
- `$node["Parallel"].output.skipped[0].error.message` → 첫 번째로 모인 실패의 에러 메시지(실패가 있을 때)
- `$node["Parallel"].output.skipped[0].index` → 그 실패가 난 병렬 분기 번호
- `$node["Parallel"].output.branches.length` → 병렬 분기 수(`output.count` 와 같은 값)
- `$node["Parallel"].output.count` → 병렬 분기 수(실패한 병렬 분기 포함)
- `$node["Parallel"].port` → `"done"`
- `$node["Parallel"].port[0]` → `"d"`. `port` 가 문자열이라 첫 글자가 나온다

병렬 분기가 실패했는지는 `output.skipped` 의 `index` 로 확인한다. 성공한 병렬 분기도 결과 노드가 없거나 결과 노드 출력이 `null` 이면 `branches[i]` 가 `null` 이므로 `branches[i]` 만으로는 실패를 가리지 못한다.

### 엔진 덮어쓰기 계약

| 시점 | `output` 형태 | `port` | 출처 |
|------|-------------|------|------|
| 시작(병렬 분기 fan-out 직전) | `output: null` | `string[]` (`branch_0` ~ `branch_{N-1}`) | 핸들러 반환. 병렬 분기 포트를 여는 용도 |
| 완료(모든 병렬 분기 종료 뒤) | `output: { branches: Array<unknown \| null>, count, skipped? }` | `'done'` (단일 문자열) | **엔진 덮어쓰기** |

1. `PARALLEL_ENGINE=v1` 에서 다음 노드가 `$node["Parallel"].output.*` 로 보는 값은 완료 시점 형태다. 노드 실행 기록 · `execution.node.completed` 이벤트 · park 뒤 재개와 크래시 재구동의 rehydration 도 같은 완료 출력을 쓴다([컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md#엔진-덮어쓰기)).
2. 핸들러가 시작 시점에 반환한 `output: null` 은 엔진이 덮어쓰기 전의 중간 단계다(Loop · ForEach · Map 과 같은 방식). 1번의 범위에서는 밖의 표현식 · 노드 실행 기록 · 이벤트에 드러나지 않는다. [단일 노드 실행](../CLE-EXEC/CLE-EXEC-RUN.md)은 병렬 분기를 돌지 않으므로 핸들러 반환값으로 노드 실행 기록을 바로 마감한다.
3. `port` 는 시작 시점에 `string[]` (fan-out)이고 완료 시점에 `'done'` 문자열(단일 포트)이다. 엔진 덮어쓰기 대상 노드 가운데 노드 출력에 `port` 를 직접 싣는 것은 Parallel 뿐이다. 엔진이 연결선을 고르려고 내부 캐시에 두는 `_selectedPort` 도 노드 출력 `port` 와 같은 모양이라([실행 엔진](../CLE-EXEC/CLE-EXEC-ENGINE.md) 의 `_selectedPort` 처리) 완료 시점에 `'done'` 이다.
4. 병렬 분기 입력은 `ParallelExecutor` 가 `ExecutionContext` 얕은 복사본(`variables` 는 깊은 복사)으로 나눠 준다. 핸들러의 시작 시점 `output` 에 기대지 않는다.
5. `PARALLEL_ENGINE=off` 되돌림 경로에서는 완료 시점 덮어쓰기가 없다. 노드 출력은 시작 시점 형태(`output: null`, `port: string[]`)로 남는다([`off` 되돌림 경로는 완료 출력을 만들지 않는다](#off-되돌림-경로는-완료-출력을-만들지-않는다)).
6. 완료 출력은 놓인 위치와 상관없이 `commitParallelDoneOutput` 한 곳이 쓴다. 쓰는 순서는 [완료 출력 쓰기 순서](#완료-출력-쓰기-순서) 가 정한다.

## Rationale

### `done` 출력에 `count` 를 싣는다

결정일: 2026-06-03

한때 이 문서에 "`count` 필드는 제거됨(`branches.length` 가 단일 기준)" 이라는 서술이 있었다. 이는 컨테이너 공통 출력 규칙과 실제 엔진 구현에 어긋났다. 공통 규칙은 엔진 덮어쓰기 대상 노드가 모두 `{ <컬렉션 키>, count }` 를 낸다고 정하고 `ExecutionEngineService` 의 Parallel `done` 덮어쓰기도 `{ branches, count: branchResults.length }` 를 싣는다.

- **(A) 공통 규칙과 코드에서 Parallel 만 `count` 예외로 둔다** (기각): Parallel 은 포트로 나뉘는 병렬 분기라 `count` 의 뜻이 약하다는 논거였다. 그러나 공통 규칙 세 곳, 코드, 다른 엔진 덮어쓰기 대상 노드 셋을 모두 바꿔야 하고 `output.count` 를 쓰는 워크플로우가 깨진다.
- **(B) 이 문서에 `count` 를 되살린다** (채택): 코드·공통 규칙·다른 노드와 곧바로 맞고 변경이 이 문서에 그친다. `branches.length` 와 겹치지만 출력의 균일성(`{ <컬렉션 키>, count }`)을 겹침 제거보다 앞에 둔다. 다음 노드는 노드 종류와 상관없이 `output.count` 로 항목 수를 읽을 수 있다.

### 완료 `meta` 에 병렬 분기 수와 실패 수를 따로 싣지 않는다

결정일: 2026-10-24

옛 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-2-실행-메트릭에는-관측-값만-둔다) 의 컨테이너 행은 `meta.branches?` 를 적었지만 엔진은 `meta.clampedConcurrency` 만 싣는다. 지금 동작을 계약으로 정했다. 병렬 분기 수는 `output.count`, 실패 수는 `output.skipped.length` 로 센다([아래 절](#완료-출력은-병렬-분기-결과를-그대로-두고-실패를-따로-모은다)).

기각한 대안은 완료 `meta` 에 `branches` · `fulfilledCount` · `rejectedCount` 를 더하는 안이다. 엔진 코드를 바꿔야 하고 지금 이 값을 요구하는 화면 · 요구사항이 없다. `meta.durationMs` 는 이 판단에 넣지 않았다. 그때는 노드 전체 실행 시간을 둘 곳을 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 미결 사항 「컨테이너 · Parallel 노드의 실행 시간」 으로 넘겼다.

출력 균일성을 겹침 제거보다 앞에 둔 2026-06-03 결정 B([`done` 출력에 `count` 를 싣는다](#done-출력에-count-를-싣는다))는 `output` 필드에 대한 결정이라 이 판단과 부딪치지 않는다. [Map 노드](CLE-NODE-MAP.md#배열이-아닌-입력을-빈-배열로-바꾸고-meta-로-알린다) 가 완료 `meta` 에 `iterations` · `skippedCount` 를 더한 것은 같은 실행기를 쓰는 ForEach 와 `meta` 를 맞추려는 것이라 이 경우와 다르다.

병렬 분기 수나 실패 수를 `meta` 로 읽어야 하는 화면이나 요구사항이 생기면 다시 본다.

2026-11-15 확정(NERV Task CLE-T-JXD0W5): 완료 `meta.durationMs` 는 싣지 않는다. 일반 노드에서 같은 키는 핸들러가 잰 시간이라 Parallel 에 노드 전체 시간을 실으면 키의 뜻이 노드마다 갈린다. 노드 전체 실행 시간은 노드 실행 기록의 `duration_ms` 와 `execution.node.completed` 이벤트의 `duration` 으로 읽는다. 2026-10-24 구현 확인 때는 이 두 값이 핸들러 실행 시간이라 병렬 분기 시간이 빠진다고 적었다. 시작 시점 표와 엔진 덮어쓰기 계약 1 · 2 도 그때 park · 재구동 없이 이어진 실행으로 범위를 좁혀 적었다. 같은 Task 가 노드 실행 기록을 모든 병렬 분기가 끝난 뒤 완료 출력으로 마감하게 고쳐 그 갭을 닫았고 이 문서도 원래 서술로 돌렸다. 근거와 기각한 대안은 [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md#노드-실행-행은-본문이-끝난-뒤-한-번-마감한다) 에 있다.

### 완료 출력은 병렬 분기 결과를 그대로 두고 실패를 따로 모은다

결정일: 2026-11-01

이 문서는 한때 `branches[i]` 를 `Promise.allSettled` 모양(`{ status: 'fulfilled', value }` / `{ status: 'rejected', error }`)으로 적었다. 엔진은 처음부터 병렬 분기 마지막 노드의 출력을 그대로 `branches[i]` 에 넣었고 그렇게 감싸는 코드는 없었다. `errorPolicy='continue'` 에서 실행기가 모은 실패 목록도 엔진이 읽지 않아 실패한 병렬 분기가 출력에 드러나지 않았다. 사용자 가이드는 지금 구현 모양(`{{ $input.branches[0].data }}`)으로 설명해 왔다.

두 방향을 사람에게 올려 정했다(NERV 질문 `01a19678-6efb`).

- **(A) 스펙대로 allSettled 모양으로 감싼다** (기각): 스펙 수정은 가장 적다. 그러나 `branches[i].<필드>` 로 읽던 기존 워크플로우의 표현식이 에러 없이 `undefined` 가 되고 가이드도 바뀐다. `stop` · `cancel-others-on-fail` 은 병렬 분기가 실패하면 노드가 실패하므로 `done` 에는 성공만 오는데도 모든 읽기에 `.value` 한 단계가 늘어난다.
- **(B) 지금 모양을 지키고 실패를 따로 모은다** (채택): 기존 워크플로우와 가이드가 그대로 동작한다. 병렬 분기는 서로 독립이라 ForEach 의 "독립 항목 반복" 계약과 같다. 그래서 ForEach 와 같은 형태(실패 자리 `null` + 실패 목록 `output.skipped`)를 쓴다. ForEach 와 Map 이 실패를 다르게 적는 이유는 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#foreach-와-map-의-실패-표현을-다르게-둔다) 에 있다. ForEach 는 실패 수를 `meta.skippedCount` 로도 싣지만 Parallel 은 2026-10-24 결정대로 `meta` 에 실패 수를 두지 않는다. 요구하는 화면이나 요구사항이 생기면 ForEach 와 같은 값으로 더한다.

같은 질문에서 정한 필드 이름, 결과 노드, 완료 `port`, `branchCount` 범위 문구, `error.code` 값은 각 절에 따로 적었다(결과 노드는 [실행 로직](CLE-NODE-PARALLEL-EXEC.md#병렬-분기-결과는-실제로-실행된-마지막-노드의-출력이다), 범위 문구는 [설정과 에러](CLE-NODE-PARALLEL-CONFIG.md#branchcount-범위-검사는-경고-규칙-한-곳에-둔다)).

**기존 워크플로우 영향**: 성공한 병렬 분기를 `branches[i].<필드>` 로 읽던 워크플로우는 그대로 동작한다. `errorPolicy='continue'` 에서는 실패 자리가 `null` 이 되고 `output.skipped` 가 생긴다. 결과 노드와 `port` 가 바뀌는 영향은 해당 절에 적었다.

### 실패 목록 필드 이름은 `skipped` 다

결정일: 2026-11-01

ForEach 와 같은 이름을 쓰면 사용자는 "실패한 항목은 `output.skipped` 에 따로 모인다" 하나만 익히면 된다. 질문에서는 Parallel 에 `skip` 정책이 없으니 `failed` 를 쓰는 안도 함께 올렸지만 ForEach 와 이름이 갈려 기각했다. 실행 상태 `skipped`(실행하지 않고 건너뜀)와 철자가 같아서 출력 표에 다른 뜻이라고 적었다.

### 완료 출력 `port` 는 `'done'` 문자열이다

결정일: 2026-11-01

문서는 `'done'`, 엔진의 구조화 출력은 `['done']` 이었다. [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 5 에서 배열은 여러 포트를 동시에 여는 fan-out 이다. 완료 시점은 `done` 하나만 열므로 문자열로 정했다. `['done']` 으로 문서를 맞추는 안은 fan-out 이 아닌 값에 배열을 쓰게 되어 기각했다. 엔진 내부 `_selectedPort` 도 노드 출력 `port` 와 같은 모양이라([실행 엔진](../CLE-EXEC/CLE-EXEC-ENGINE.md)) 함께 `'done'` 이 된다. 연결선 활성화는 문자열과 배열을 모두 받으므로 `done` 연결선만 여는 동작은 그대로다.

**기존 워크플로우 영향**: `$node["Parallel"].port` 가 `["done"]` 에서 `"done"` 으로 바뀌었다. 그래서 `$node["Parallel"].port[0]` 은 첫 글자 `"d"` 를 돌려준다. `port[0]` 으로 완료 경로를 확인하던 표현식은 `port` 로 고쳐야 한다.

### `error.code` 의 값

결정일: 2026-11-01

**2026-11-05 정리**: ForEach · Map 과 함께 규칙을 하나로 모으고 아래 임시 예외를 닫았다. 지금 규칙은 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#반복-결과-출력-구조) 4 · 5번이 정한다. 근거와 기각한 대안은 그 문서의 Rationale [실패한 회차와 병렬 분기의 `error.code`](CLE-NODE-LOGIC-COMMON.md#실패한-회차와-병렬-분기의-errorcode) 에 있다.

그 전 기록: `skipped[].error.code` 는 던진 값이 Error 면 그 `name` 이었고 Error 가 아니면 `'UNKNOWN_ERROR'` 였다. ForEach 도 같은 규칙이었다(`foreach-executor.ts`). 차이는 하나였다. `name` 이 빈 문자열이면 Parallel 은 `'UNKNOWN_ERROR'` 를 냈고 ForEach 는 빈 문자열을 그대로 냈다. 이 값은 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md#규칙) 규칙 2 의 `UPPER_SNAKE_CASE` 표기를 따르지 않았고 `'UNKNOWN_ERROR'` 도 카탈로그에 없었다. 그때는 임시 예외로 두고 이 절을 그 정본으로 삼았다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#92-노드별-최종-출력-값) 9.2 와 [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#반복-결과-출력-구조) 이 이 절을 가리켰다). 두 노드의 규칙 통일, 안정된 코드로 바꿀지, `UNKNOWN_ERROR` 를 카탈로그에 넣을지, [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md#3-예외-등록-코드) §3 예외 등록부에 올릴지는 ForEach 와 함께 정하기로 했다.

기각한 대안은 그때 Parallel 만 `UPPER_SNAKE_CASE` 코드로 바꾸는 안이었다. ForEach 가 같은 값을 내고 있어 Parallel 만 고치면 같은 형태의 `skipped` 에서 `code` 값이 노드마다 갈린다.

### `off` 되돌림 경로는 완료 출력을 만들지 않는다

결정일: 2026-11-02

`PARALLEL_ENGINE=off` 는 v1 엔진(`ParallelExecutor` 와 완료 시점 덮어쓰기)을 끄는 스위치다. 되돌림 경로는 v1 이전의 순차 실행을 그대로 둔다. 병렬 분기를 위상 순서로 차례로 실행하고 Parallel 노드 출력은 핸들러의 시작 시점 출력(`output: null`, `port: ['branch_0', …]`)으로 남는다. 그래서 [Parallel 노드](CLE-NODE-PARALLEL.md#요구사항) 의 `done` 결과 합치기 · `output` 덮어쓰기 요구사항(번호는 부모 문서 [하위 문서](CLE-NODE-PARALLEL.md#하위-문서) 표 아래)과 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#91-계약) 9.1 · [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md#엔진-덮어쓰기-계약) · [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md#엔진-덮어쓰기) 의 덮어쓰기 계약은 이 경로를 예외로 둔다. 「[`waitAll=false` 를 지원하지 않는다](CLE-NODE-PARALLEL-CONFIG.md#waitallfalse-를-지원하지-않는다)」 의 "`done` 포트로 결과를 합쳐 보낸다" 도 v1 엔진에서의 동작이다.

되돌림 경로에서도 핸들러가 `port: ['branch_0', …]` 를 돌려주면 엔진이 `done` 을 포함한 모든 연결선을 활성화한다. 그래서 놓인 위치와 상관없이 `done` 뒤 노드가 실행된다(2026-11-06 실측). 그 노드의 `$input` 은 시작 시점 출력의 `output` 인 `null` 이다([다음 노드가 받는 값](../CLE-NODE/CLE-NODE-OUTPUT-VALUE.md)). 2026-11-19 전에는 설정 에코를 받았다.

기각한 대안은 되돌림 경로에도 완료 출력을 만드는 안이다. 되돌림 경로에 새 동작을 넣으면 v1 엔진을 끄고 예전 동작으로 돌아간다는 스위치의 뜻이 흐려진다. 되돌림 경로에서 `done` 뒤 노드는 병렬 분기 완료를 기다리지 않는다. 실행 순서가 메인 루프의 위상 순서에만 달려 있어 병렬 분기 노드보다 먼저 실행될 수 있다. 이것은 결함으로 보지 않고 되돌림 경로의 한계로 둔다(2026-11-27 사람 결정, NERV Task `CLE-T-7JJHF2`). 기다리게 하려면 되돌림 경로에 새 동작을 넣어야 해서 위와 같은 이유로 기각했다.

### 완료 출력 쓰기 순서

결정일: 2026-11-06

Parallel 이 어디에 놓였든 완료 출력은 `commitParallelDoneOutput` 한 곳이 쓴다. 완료 출력 `{ config, output, port: 'done', meta? }` 를 먼저 만들고 `commitNodeOutput` 한 번으로 다음을 함께 쓴다.

1. 평면 캐시에 `{ _selectedPort: 'done', ...output }` 을, 구조화 캐시에 완료 출력을 쓴다(`setNodeOutputs`).
2. 1에서 쓴 두 항목을 바깥 병렬 분기 사본에 옮긴다(`syncParallelBranchCacheEntry`).

구조화 출력은 평면 출력에서 다시 만들지 않는다. 평면 출력에는 라우팅 표지 `_selectedPort` 가 있어 다시 만들면 `$node["Parallel"].output` 에 그 키가 섞인다. 두 캐시를 한 번에 쓰므로 포트 라우팅과 `$node["Parallel"].output` 과 바깥 병렬 분기 결과가 같은 값을 본다. 2026-11-06 에는 평면 캐시 · 구조화 캐시 · 사본을 세 번에 나눠 쓰고 순서로 이 문제를 막았다. 2026-11-20 에 한 호출로 합쳤다(NERV Task `CLE-T-CE5YR3`).
