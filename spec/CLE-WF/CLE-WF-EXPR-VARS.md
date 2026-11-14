---
id: "CLE-WF-EXPR-VARS"
title: "표현식 언어 — 내장 참조 변수"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-WF-EXPR"
ancestors: ["CLE-VISION", "CLE-WF", "CLE-WF-EXPR"]
area: "CLE-WF"
content_hash: "ec7f4bd6885fef82049199b5c8df6075c6f24966bed22e65d4ed66c32a63d68f"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "6d6fd7423c22977471c0acac107c0d531f10ff6f660da503d1fdc1b3536ee08c"
etag: "sha256-423b32de75a3dfaa060d420d31a1a8e1b67e40d5da3947f79fd826b325ebb6f5"
---
## 개요

이 문서는 [표현식 언어](CLE-WF-EXPR.md) 의 하위 문서로 표현식이 읽는 내장 참조 변수(`$input` · `$node` · `$loop` · `$thread` · `$trigger` · `$env` 등)를 정한다. 요구사항과 미결 사항은 부모 문서에 있다.

## 내장 참조 변수

### 변수 목록

| 참조 | 타입 | 설명 | 예 |
| --- | --- | --- | --- |
| `$input` | Object | 직전 연결 노드의 출력 데이터 | `{{ $input.email }}` |
| `$params` | Object | 트리거 파라미터 참조. `$input.parameters`(입력의 `parameters` 객체)의 줄임이다. 수동 트리거 노드가 검증한 입력 파라미터를 읽는다. | `{{ $params.userId }}` |
| `$node["이름"]` | Object | 노드 참조. 특정 노드의 실행 결과다. `.output`(출력 데이터) 말고도 `.config`·`.meta`·`.port`·`.status` 를 읽을 수 있다. UUID 로도 접근한다. | `{{ $node["Fetch User"].output.id }}` |
| `$var` | Object | 워크플로우 변수(workflow variables). [변수 선언 노드](../CLE-NODE-LOGIC/CLE-NODE-VARDECL.md) 로 선언한 값 | `{{ $var.counter }}` |
| `$execution` | Object | 현재 실행 컨텍스트 | `{{ $execution.id }}` |
| `$now` | String | 현재 시각(ISO 8601, UTC) | `{{ $now }}` |
| `$env` | Object | 환경 변수 참조. 운영자가 `EXPRESSION_ENV_ALLOWLIST` 에 적은 키만 노출한다. SaaS 는 설정하지 않으므로 `{}` 다. [웹훅 요청 뷰와 환경 변수 주입](#웹훅-요청-뷰와-환경-변수-주입) 참조 | `{{ $env.API_URL }}` |
| `$loop` | Object | 반복 컨텍스트. Loop 본문 안에서 쓴다. | `{{ $loop.index }}` |
| `$item` | Object·Any | 항목 컨텍스트. ForEach 의 현재 항목 | `{{ $item.name }}` |
| `$itemIndex` | Number | ForEach 의 현재 인덱스 | `{{ $itemIndex }}` |
| `$itemIsFirst` | Boolean | ForEach 첫 항목 여부 | `{{ $itemIsFirst }}` |
| `$itemIsLast` | Boolean | ForEach 마지막 항목 여부 | `{{ $itemIsLast }}` |
| `$trigger` | Object | 웹훅 요청 뷰. 웹훅 요청의 `{ body, headers, query, method }` 평평한 형태이고 민감 헤더 값은 가린다. 수동·스케줄 실행은 `{}` 다. [웹훅 요청 뷰와 환경 변수 주입](#웹훅-요청-뷰와-환경-변수-주입) 참조 | `{{ $trigger.body.event }}` |
| `$thread` | Object | 대화 스레드 변수. 사용자 인터랙션과 AI 대화 턴을 쌓는다. [`$thread` 속성](#thread-속성) 참조 | `{{ $thread.length }}` |

**Table 노드 한정 컨텍스트**: Table 노드 열 셀(`field`) 표현식을 평가할 때 `$sourceItem`(현재 행 항목), `$sourceItemIndex`(행 인덱스), `$dataSource`(원본 데이터 배열)를 넣는다. 라벨(`label`) 표현식(dynamic 모드에서 한 번 평가)에는 행 단위가 아니므로 `$dataSource` 만 넣는다. 자세한 내용은 [Table 노드](../CLE-NODE-PRES/CLE-NODE-TABLE.md) 에 있다.

**Code 노드 런타임과의 차이**: Code 노드는 표현식과 별개인 자체 런타임에서 코드를 실행한다. 그 런타임의 `$execution`(`{executionId, workflowId}`), `$node`(현재 노드 메타 `{id, label}`), `$vars` 는 표현식의 `$execution`(`id` 필드), `$node`(다른 노드 결과), `$var` 와 이름은 비슷하지만 모양과 뜻이 다르다. 기준은 [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md) 다.

### `$execution` 속성

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `id` | String | 실행 UUID |
| `startedAt` | String | 실행 시작 시각(ISO 8601) |
| `mode` | String | 실행 모드(`manual`, `webhook`, `schedule`). 실제 값은 [미결 사항](CLE-WF-EXPR.md#미결-사항) 참조 |
| `workflowId` | String | 워크플로우 UUID |

### `$loop` 속성

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `index` | Number | 현재 반복 인덱스(0부터) |
| `iteration` | Number | 현재 반복 횟수(1부터) |
| `isFirst` | Boolean | 첫 번째 반복인지 |
| `isLast` | Boolean | 마지막 반복인지 |

`$loop` 는 이 네 속성만 노출한다. `$loop.count` 와 바깥 컨테이너를 가리키는 `$parent` 는 표현식에 없다. 반복 변수의 표현식 표면은 이 문서가 정하고 [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md#반복-변수-표면은-표현식-언어를-따른다) 이 이를 따른다. 총 반복 횟수를 읽는 방법은 [Loop 노드](../CLE-NODE-LOGIC/CLE-NODE-LOOP.md) 에 있다.

### `$thread` 속성

대화 스레드(ConversationThread)의 읽기 전용 뷰다. AI 에이전트 노드의 `contextScope` 자동 주입과 별개로 사용자가 직접 참조할 수 있다. 자료구조는 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 가 정한다.

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `turns` | Array | 대화 기록 항목(`ConversationTurn[]`)의 읽기 전용 스냅샷 |
| `length` | Number | 턴 개수 |
| `text` | String | `system_text` 렌더 결과(모든 턴의 머리와 본문) |

- 1차 범위는 단순 인덱싱만 연다. `$thread.last(n)`·`$thread.byNode(name)` 같은 메서드 호출은 후속 범위에서 검토한다.
- 백엔드 실행 엔진이 `$thread` 를 넣고, 에디터 자동완성의 최상위 변수 목록(`ROOT_VARIABLES`)에도 `$thread` 가 있다.

예:

- `{{ $thread.length }}`: 쌓인 턴 개수
- `{{ $thread.text }}`: 스레드 전체를 텍스트로 붙인다(예: Transform 노드에서 가공).
- `{{ $thread.turns[0].data.email }}`: 첫 턴 폼 데이터의 필드. `turn.source` 가 `presentation_user` 일 때 유효하다.

### 웹훅 요청 뷰와 환경 변수 주입

실행 엔진의 컨텍스트 빌더(`ExpressionResolverService.buildExpressionContext`)가 `$trigger` 와 `$env` 를 넣는다. 새 실행(`runExecution`)과 재구동 뒤 컨텍스트 복원(`rehydrateContext`) 두 경로가 똑같이 넣는다.

#### `$trigger`: 웹훅 요청 뷰

웹훅 트리거로 시작한 실행에서 HTTP 요청 구성 요소를 **평평한 형태**로 보여 준다. 데이터 출처는 `Execution.inputData` 에 저장한 `TriggerExecutionInput`([실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md))의 **웹훅 전용 요청 필드**다.

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `$trigger.body` | Any | 요청 본문(JSON 파싱한 payload) |
| `$trigger.headers` | Object | 요청 헤더(소문자 키). **민감 헤더 값은 가린다**(아래). |
| `$trigger.query` | Object | 쿼리스트링 파라미터 |
| `$trigger.method` | String | HTTP 메서드(`POST` 등) |

- **`parameters` 는 `$trigger` 에 없다**: 트리거 스키마로 정규화한 `TriggerExecutionInput.parameters` 는 `$input.parameters`·`$params` 로 노출한다. `$trigger` 는 원본 HTTP 요청(`body`·`headers`·`query`·`method`)만 담는다. [수동 트리거 노드](../CLE-NODE-TRIG/CLE-NODE-MANUAL.md) 의 `output.request.{method,headers,query,body}` 와 **필드 이름 집합**이 같고, **헤더 가림도 양쪽에 똑같이 적용**한다. 가림 시점은 아래 민감 헤더 가림 항목과 [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) 이 정한다.
- **데이터 출처와 재구동**: 웹훅 어댑터(`HooksService`)가 `execute()` 에 `{ parameters, body, headers, query, method }` 와 `{ __triggerSource: 'webhook' }` 을 넘겨 `Execution.inputData` 에 저장한다. 컨텍스트를 만들 때 이 payload 의 요청 필드로 `$trigger` 를 구성한다. 대기 뒤 재개나 장애 뒤 재구동([장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md)) 때도 durable 한 `Execution.inputData` 에서 똑같이 복원한다. `$trigger` 는 메모리 컨텍스트가 아니라 `inputData` 에서 파생한 값이라 복원 뒤에도 `{}` 로 비지 않는다.
- **민감 헤더 가림**: `$trigger.headers` 는 `Authorization`·`Cookie`·`X-Api-Key`·`X-Auth-Token` 같은 인증·비밀 헤더의 **값을 `[REDACTED]` 로 가려** 보여 준다. 키는 남긴다. 통합 노드의 `sanitizeResponseHeaders` 차단 목록을 다시 쓴다(정확히 일치하는 이름과 `auth`·`token`·`secret`·`cookie`·`credential`·`password`·`api-key`·`signature` 부분 일치). **첫 가림은 웹훅을 받는 시점**(`Execution.inputData` 저장 전)이라 `Execution.inputData`, `output.request.headers`, `$trigger.headers` 가 모두 가려져 있다. 그 뒤 `buildTriggerView` 가 다시 가리는 것은 여러 번 해도 같은 결과인 이중 방어다. 웹훅이 아닌 경로가 원본 헤더를 넣더라도 표현식으로 새지 않게 한다.
- **빈 payload 대체**: 수동 실행, 스케줄 실행, 웹훅이 아닌 진입 경로에는 요청 payload 가 없으므로 **`$trigger = {}`** 를 넣는다. 그러면 `{{ $trigger.body.event }}` 는 `EXPR_REFERENCE_ERROR` 대신 `undefined` 로 조용히 떨어진다(optional chaining 과 잘 맞는다).
- **1차 범위**: Background 본문(별도 작업 컨텍스트)은 부모 실행의 payload 를 물려받지 않고 `$trigger = {}` 로 둔다. 물려받는 것은 후속 과제다.

#### `$env`: 환경 변수(셀프 호스팅 전용, 허용 목록)

`process.env` 에는 `DATABASE_URL`, JWT 비밀, API 키 같은 비밀이 많다. 그래서 `$env` 는 **운영자가 명시적으로 허용한 키만** 노출한다.

- **허용 목록**: 환경 변수 `EXPRESSION_ENV_ALLOWLIST`(쉼표로 구분한 키 목록, 예: `API_URL,REGION`)에 적은 키만 `$env` 로 노출한다(`$env = { API_URL: process.env.API_URL, ... }`). 목록에 없는 키는 절대 노출하지 않는다.
- **셀프 호스팅 게이트는 운영자 허용**: `EXPRESSION_ENV_ALLOWLIST` 는 **배포 운영자만** 설정할 수 있다. 테넌트나 워크플로우 작성자는 설정할 수 없다. 그래서 SaaS 멀티테넌트 배포는 이 값을 비워 `$env = {}` 로 두고(비밀 노출 없음), 셀프 호스팅 운영자는 필요한 **비밀이 아닌** 키만 적는다. [Clemvion 제품 개요](../CLE-VISION.md) 의 "SaaS 와 셀프 호스팅을 설정만으로 전환" 을 별도 전역 모드 축 없이 허용 목록으로 이룬다([Rationale](#rationale)).
- **대체값**: `EXPRESSION_ENV_ALLOWLIST` 가 없거나 비어 있으면 `$env = {}` 다. 그때 `{{ $env.API_URL }}` 은 `undefined` 로 조용히 떨어진다.
- **보안 불변식**: 허용하지 않은 키(특히 비밀)는 `$env` 로 샐 수 없다. 허용 목록은 운영자가 배포 단계에서 고른 것이다.

## 구현 위치

- `codebase/backend/src/modules/execution-engine/expression/trigger-data.util.ts` (`$trigger` 뷰 구성 · 헤더 가림)
- `$trigger`·`$env` 를 넣는 컨텍스트 빌더(`expression-resolver.service.ts`)는 [에디터와 실행 엔진 통합](CLE-WF-EXPR-ENGINE.md#구현-위치) 에 있다.

## Rationale

### `$trigger`·`$env` 를 실행 시 넣는다 (2026-07-07)

평가기, 에디터 자동완성, 변수 목록은 이미 `$trigger`·`$env` 를 노출했는데 실행 엔진 컨텍스트 빌더(`ExpressionResolverService.buildExpressionContext`)가 넣지 않았다. 사용자가 입력하면 실행 때 `EXPR_REFERENCE_ERROR` 로 깨지는, "광고했지만 실패하는" 함정이었다. 두 변수를 넣는 계층을 구현해 없앴다.

- **`$trigger` 는 실행 컨텍스트에서 파생한 평평한 형태다**: 트리거 payload 는 이미 durable 한 `Execution.inputData`(`TriggerExecutionInput`)에 저장돼 있다. 그래서 `$trigger` 는 그 웹훅 요청 필드(`body`·`headers`·`query`·`method`)의 파생 뷰다. `ExecutionContext.triggerData` 필드를 두어 새 실행(`runExecution`)과 재구동 뒤 복원(`rehydrateContext`) 두 경로가 각각 `inputData` 에서 뽑아 넣는다. 모든 노드는 트리거 노드를 이름으로 참조하지 않고 `$trigger` 로 읽는다. `ExecutionContext` 필드 추가는 실행 컨텍스트 규약의 경계(핸들러가 읽는 표면을 최소로)와 부딪히지 않는다고 판단했다. `triggerData` 는 어떤 노드 핸들러도 직접 읽지 않고 **`execution-context.service`(넣기)와 `expression-resolver.service`(쓰기)만 접근하는 resolver 전용 파생 출처**이기 때문이다. resolver 가 채우고 일부 핸들러가 골라 쓰는 `ExecutionContext.expressionContext` 와 같은 계열의 최소 표면 필드이고, `$loop`·`$item` 처럼 실행 범위 데이터를 표현식에 노출하는 목적과도 맞는다(다만 `$loop`·`$item` 은 컨테이너 핸들러가 직접 쓴다). `parameters` 는 `$params`·`$input.parameters` 로 이미 노출하므로 `$trigger` 에 중복해 넣지 않는다. 이 필드가 규약의 `_` 접두 규칙을 따르는지는 [미결 사항](CLE-WF-EXPR.md#미결-사항) 에서 다룬다.
- **헤더 가림은 기존 목록을 다시 쓴다**: `$trigger.headers` 의 민감 헤더 가림은 통합 노드가 이미 쓰는 `sanitizeResponseHeaders`(정확 일치와 부분 일치 차단 목록)를 다시 쓴다. 새 가림 목록을 만들지 않아 목록이 서로 어긋나는 것을 막는다.
- **빈 payload 는 `{}` 로 대신한다**: 수동·스케줄·Background 는 웹훅 요청이 없으므로 `$trigger = {}` 다. `undefined` 자체를 넣으면 평가기가 `EXPR_REFERENCE_ERROR` 를 던지므로 빈 객체를 넣어 `$trigger.body` 가 `undefined` 로 조용히 떨어지게 한다(optional chaining 과 잘 맞는다).
- **`$env` 는 허용 목록으로 연다(별도 모드 축을 만들지 않음)**: 결정 4A 는 "셀프 호스팅에서만 열기" 를 요구했다. 전역 `DEPLOYMENT_MODE` 축을 새로 만드는 대신 `EXPRESSION_ENV_ALLOWLIST`(배포 운영자만 설정하는 환경 변수)로 이룬다. SaaS 멀티테넌트는 이 값을 비워 `$env={}` 를 유지하고(비밀 노출 없음), 셀프 호스팅 운영자는 비밀이 아닌 키만 적는다. 운영자 단계의 허용이 곧 셀프 호스팅 게이트다(테넌트나 작성자는 환경 변수를 설정할 수 없다. 동작은 [`$env` 절](#env-환경-변수셀프-호스팅-전용-허용-목록)). "설정만으로 배포 방식 전환" 을 가장 작은 표면으로 만족한다. 허용 목록이라 비밀이 자동으로 노출될 위험이 없어 모드 축을 새로 만들어 얻을 이득이 적다.
