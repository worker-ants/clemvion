---
id: "CLE-NODE-FLOW-COMMON"
title: "Flow 노드 공통"
type: "convention"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-NODE-FLOW"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-FLOW"]
area: "CLE-NODE-FLOW"
content_hash: "d241366d870c717a4b0e01757f7c6d9181732b646bb61a0476d4aa1af5179c9e"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/2-flow/0-common.md"]
mirror_sha256: "6c26e33da08dbdbe1b4258cd173a14bc11e02c87f69db0c9526ce2fd243a2e7b"
etag: "sha256-b858e58a36019a9a1138426de1d5acb7d1b3fc2df4085ec90e0f4be6be3730ac"
---
> 구현 상태: 부분 구현(메타 노출 일부 미구현) · 원문: `spec/4-nodes/2-flow/0-common.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 Flow 카테고리 노드 모두에 공통되는 규약을 정한다. 노드별 동작과 설정은 각 노드 문서가 정한다.

지금 Flow 카테고리 노드는 [워크플로우 호출 노드](CLE-NODE-SUBWF.md) 하나다. 나중에 `parallel_workflow`, `workflow_template` 처럼 워크플로우 사이 연결을 다루는 노드가 더해질 수 있고, 이 문서는 그 공통 기반이다.

Flow 노드도 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md)과 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md)을 따른다. 이 문서는 그 가운데 Flow 카테고리에서만 나타나는 사용 방식을 적는다.

워크플로우 호출 노드 하나에만 해당하는 상세(설정, 출력 예시, 에러 코드 매핑)는 그 노드 문서에 있다.

## 규칙

### 1. 카테고리 정의

1. Flow 노드는 워크플로우 사이 연결을 맡는다. 한 워크플로우가 다른 워크플로우를 서브 워크플로우로 부르거나, 여러 워크플로우 사이의 데이터와 실행 흐름을 잇는다.
2. 한 워크플로우 안의 흐름 제어는 Logic 카테고리가 맡는다. 두 카테고리의 범위는 아래와 같다.

| 카테고리 | 범위 |
| --- | --- |
| Logic | 한 워크플로우 안의 흐름 제어(분기, 반복, 변수, 병렬). [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md) |
| Flow | 여러 워크플로우 사이 연결(서브 워크플로우 호출, 워크플로우 사이 데이터 전달) |
| 트리거 | 워크플로우 진입점. 수동 트리거 노드 하나이고, 수동·웹훅·스케줄 실행이 모두 이 노드로 들어온다. [트리거 노드 공통](../CLE-NODE-TRIG/CLE-NODE-TRIG-COMMON.md) |

### 2. 노드 출력 사용 방식

Flow 노드는 [노드 출력 규약 Principle 0](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-0-노드-출력의-다섯-필드)의 다섯 필드 `{ config, output, meta?, port?, status? }` 를 따른다. Flow 카테고리에서 쓰는 방식은 다음과 같다.

| 필드 | Flow 카테고리의 사용 방식 |
| --- | --- |
| `config` | 원본 설정 에코([Principle 7](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-7-설정-에코-원칙)). `inputMapping[]` 의 표현식 템플릿을 그대로 둔다. `workflowId`, `mode`, `timeout` 등을 싣는다. |
| `output` | 동기 호출은 서브 워크플로우 최종 출력을 `output.result` 에 한 겹 감싼 값이다. 비동기 호출은 `{ executionId, workflowId, status }` 추적 정보를 바로 돌려준다. 두 형태가 분명히 다르므로 노드 문서는 케이스를 나눠 적는다. |
| `meta` | 실행 메트릭만 둔다([Principle 2](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-2-실행-메트릭에는-관측-값만-둔다)). 현재 구현은 동기 호출만 `meta.durationMs` 를 돌려주고 비동기 호출은 `meta` 를 돌려주지 않는다. `recursionDepth` 는 인라인·비동기 호출 인자로만 넘기고 `meta` 에 싣지 않는다(`workflow.handler.ts`). `recursionDepth`, `subExecutionId`, `mode` 를 `meta` 에 싣는 것은 미구현이다. |
| `port` | `out`(성공) 또는 `error`(동기 호출 실패, 비동기 호출의 큐 등록 실패) |
| `status` | Flow 노드는 입력을 기다리지 않으므로 대체로 `undefined` 다. 워크플로우 호출 노드의 비동기 호출은 최상위 `status: 'started'` 를 돌려준다. 이 값을 허용할지는 [워크플로우 호출 노드](CLE-NODE-SUBWF.md#미결-사항)의 미결 사항이다. |

동기 호출한 서브 워크플로우 안에서 블로킹 노드가 park 하면 핸들러는 출력을 돌려주지 않는다. `ParkReleaseSignal` 을 다시 던져 세그먼트를 끝내고, 엔진이 rehydration 으로 재개한다([장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md)). 이때도 핸들러가 `status` 를 내지 않는다.

### 3. 에러 계약

Flow 노드는 [노드 출력 규약 Principle 3](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-3-에러-계약)의 분류를 따른다.

| 상황 | 처리 |
| --- | --- |
| 사전 검증: `workflowId` 가 비었거나 형식이 틀림, 재귀 깊이 초과 | throw |
| 동기 호출: 서브 워크플로우 실행 실패(대상 부재, 타임아웃, 워크스페이스 격리 차단, 그 밖의 실패) | `output.error.{code, message, details: {workflowId, mode}}` 와 `port: 'error'`. 코드는 [워크플로우 호출 노드](CLE-NODE-SUBWF.md#에러-코드)가 정한다. |
| 비동기 호출: 큐 등록 실패 | `output.error.code = 'SUB_WORKFLOW_QUEUE_FAILED'` 와 `port: 'error'`. 드물다. |
| 비동기 호출: 서브 워크플로우 실행 중 에러 | 부모에 전파하지 않는다(fire-and-forget). 서브 실행 로그에만 남는다. |

`error` 포트에 연결선이 없는 상태에서 서브 워크플로우가 실패하면 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md)의 일반 규칙을 따른다.

### 4. 재귀 호출 방지

다른 워크플로우를 부르는 Flow 노드는 재귀 깊이(`recursionDepth`)를 누적하고 한도(기본 10)를 넘으면 throw 한다. 자기 자신을 직접 부르는 것도 한도 안에서는 허용한다. 자세한 규칙은 [워크플로우 호출 노드](CLE-NODE-SUBWF.md#실행-로직)에 있다.

### 5. 출력 구조 색인

| 노드 | 동기 성공 | 동기 에러 | 비동기 | 사전 검증 throw |
| --- | --- | --- | --- | --- |
| `workflow` | [동기 호출 성공](CLE-NODE-SUBWF.md#동기-호출-성공-port-out) | [런타임 에러](CLE-NODE-SUBWF.md#런타임-에러-port-error) | [비동기 호출 성공](CLE-NODE-SUBWF.md#비동기-호출-성공-port-out) | [사전 검증 throw](CLE-NODE-SUBWF.md#사전-검증-throw-포트-라우팅-없음) |

### 6. 설정 요약

1. 캔버스 본문 요약은 노드 메타데이터의 `summaryTemplate` 을 `renderSummaryTemplate` 으로 그린다(`node-config-summary.ts`).
2. blocking 경고 규칙이 나면 `⚠ <message>` 를 요약보다 먼저 보인다.
3. 노드별 요약 형식은 노드 문서가 정한다. 워크플로우 호출 노드는 [설정 요약](CLE-NODE-SUBWF.md#설정-요약)에 있다.

## 구현 위치

- `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts`
- `codebase/backend/src/nodes/flow/workflow/workflow.schema.ts`
- `codebase/frontend/src/lib/utils/node-config-summary.ts`: 설정 요약 렌더링

## Rationale

### 노드가 하나인데 카테고리 공통 문서를 두는 이유

Flow 카테고리는 지금 워크플로우 호출 노드 하나지만, 워크플로우 사이 연결을 다루는 노드가 더해질 수 있다. 그때 새 노드가 따를 공통 기반을 미리 둔다.
