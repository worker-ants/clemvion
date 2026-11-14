---
id: "CLE-NODE-BACKGROUND-RUNS"
title: "Background 노드 — 본문 실행 모니터링"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-BACKGROUND"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-LOGIC", "CLE-NODE-BACKGROUND"]
area: "CLE-NODE-LOGIC"
content_hash: "62811909bcbd507535f2e821922b255db3b4a222eed719ecaaef24f34d5e758c"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "9a491084ab086904b131482425055ec8344251390d53a07494d4068b794924cf"
etag: "sha256-068a6d578a04c91a3f828ecb7e37934a9c719c265b99ff465ea5ad215e99866f"
---
> 구현 상태: 부분 구현 (AI 어시스턴트 조회 도구는 미구현) · 상위 문서: [Background 노드](CLE-NODE-BACKGROUND.md)

## 개요

이 문서는 [Background 노드](CLE-NODE-BACKGROUND.md) 의 하위 문서로 Background 본문 실행(background run, `backgroundRunId`)의 모니터링 API · 권한 · 페이지네이션 · WebSocket 구독 채널 · AI 어시스턴트 도구 노출 계획을 정한다.

핸들러가 [메인 통과](CLE-NODE-BACKGROUND.md#메인-통과-port-main-패스스루) 케이스에서 발급한 `meta.backgroundRunId` 를 키로, 메인 흐름의 뒤 노드나 실행 결과 화면이 Background 본문 실행 상태를 조회한다. 격리 계약은 그대로 유지한다. 이 API 는 읽기 전용이고 본문 결과를 메인 흐름에 합류시키지 않는다.

## 엔드포인트

```
GET /api/executions/:executionId/background-runs/:backgroundRunId
```

| 파라미터 | 위치 | 타입 | 설명 |
|----------|------|------|------|
| `executionId` | path | UUID | 메인 워크플로우 실행 ID. 권한 확인의 1차 키(워크스페이스 소속 확인) |
| `backgroundRunId` | path | UUID v4 | `meta.backgroundRunId`. 그 실행 안에서 Background 노드의 본문 실행 식별자 |
| `cursor` | query | string | `nodeExecutions` 페이지네이션 cursor(불투명 값). 없으면 첫 페이지 |
| `limit` | query | int (1~200) | 페이지 크기(기본 50). `nodeExecutions` 만 페이지네이션 대상 |

URL 은 중첩 구조(`executions/:id/background-runs/:id`)를 쓴다. 이유는 [Rationale](#rationale) 에 있다.

## 응답

```json
{
  "backgroundRunId": "8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234",
  "executionId": "5d8e7f2a-...",
  "parentNodeExecutionId": "a1b2c3d4-...",
  "status": "running",
  "startedAt": "2026-05-15T05:04:37.123Z",
  "completedAt": null,
  "durationMs": null,
  "nodeExecutions": {
    "data": [ /* NodeExecution[] */ ],
    "nextCursor": "eyJpZCI6IjEyMyJ9",
    "hasMore": true
  },
  "notifications": [ /* Notification[] */ ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `backgroundRunId` | string (UUID v4) | 요청 값 |
| `executionId` | string (UUID) | 메인 실행 ID |
| `parentNodeExecutionId` | string (UUID) | Background 노드 자신의 `NodeExecution.id`. 본문 노드들이 이 ID 를 `parentNodeExecutionId` 로 받는다 |
| `status` | `'pending' \| 'running' \| 'completed' \| 'failed'` | 본문 집계 상태. `pending` 은 본문 노드가 아직 실행 전, `running` 은 일부 본문 노드가 진행 중이거나 기다리는 중, `completed` 는 모든 본문 노드가 completed / skipped, `failed` 는 하나 이상 failed (메인 상태와 무관). `cancelled` 상태는 내지 않는다. 원문은 메인 실행 취소가 본문 실행으로 전파되는 흐름이 없기 때문이라고 적지만 현재 구현은 다르다([미결 사항](#미결-사항)) |
| `startedAt` | ISO8601 | 본문 enqueue 시각(`meta.forkedAt` 과 같은 기준) |
| `completedAt` | ISO8601 \| null | 본문 종료 시각. `status` 가 `running` / `pending` 이면 null |
| `durationMs` | number \| null | `completedAt - startedAt` (서버 계산). 진행 중이면 null |
| `nodeExecutions.data` | NodeExecution[] | 본문 노드들의 노드 실행 기록. `parentNodeExecutionId = <Background 노드의 NodeExecution.id>` 로 거른다. 모양은 [에디터 실행과 디버깅](../CLE-EXEC/CLE-EXEC-RUN.md) 의 노드별 입출력 데이터와 같다. `error` · `outputData` · `inputData` 는 응답에서 값 패턴 마스킹을 거친다(자격 증명 모양 부분 문자열 → `***`, DB 에는 원문 보존). 실행 상세(`GET /api/executions/:id`)의 `nodeExecutions[]` 와 같은 관문이고 기준은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이다. 여기서 `inputData` 도 마스킹 대상이다. 지금은 실행 수준과 노드 수준 모두 마스킹한다 |
| `nodeExecutions.nextCursor` | string \| null | 다음 페이지 cursor. `hasMore: false` 면 null |
| `nodeExecutions.hasMore` | boolean | 다음 페이지가 있는지 |
| `notifications` | Notification[] | 이 본문 실행과 관련된 알림. `type: background_failed` (`config.notifyOnFailure: true` 면 발행. 노드 실패와 `maxDurationMs` 시간 초과를 모두 포함). 관련 여부는 알림의 `background_run_id` 컬럼(본문 실행별 귀속 전용)으로 조회한다. 딥링크용 `resource_type` / `resource_id` (워크플로우)와 따로 둔다([알림](../CLE-OBS/CLE-OBS-NOTIFY.md)) |

## 페이지네이션

`nodeExecutions` 만 cursor 페이지네이션 대상이다. `notifications` 는 본문 실행마다 보통 0~몇 건이라 전부 반환한다.

1. 정렬 키는 `NodeExecution.startedAt ASC, id ASC` 다(안정 순서. 노드 실행 엔티티에 `createdAt` 컬럼이 없어 `startedAt` 을 쓴다).
2. cursor 는 불투명한 base64 값이다. 클라이언트는 해석하지 않고 응답의 `nextCursor` 를 다음 요청에 그대로 넘긴다.
3. `limit` 기본값은 50, 최대 200 이다.
4. 빈 페이지는 `data: [], nextCursor: null, hasMore: false` 다.

## 권한

1. `executionId` 가 가리키는 메인 실행의 워크스페이스 멤버만 조회할 수 있다.
2. 멤버가 아니거나 `executionId` 가 없으면 404 로 응답한다. 403 으로 응답하면 공격자가 ID 존재 여부를 추론할 수 있어 IDOR 차단을 위해 404 로 통일한다(`ExecutionsController.findOne` 과 같은 방식).
3. `backgroundRunId` 가 그 실행 안에 없으면 404 다.
4. 역할 기반 추가 제한(뷰어 차단 등)은 지금 두지 않는다. 기존 `ExecutionsController` 단건 조회도 워크스페이스 멤버면 허용하므로 맞춘다. 역할 기반 차단이 필요해지면 두 엔드포인트에 `RolesGuard` 를 함께 적용한다. 권한 매트릭스는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) 가 정한다.
5. [에디터 실행과 디버깅](../CLE-EXEC/CLE-EXEC-RUN.md#background-본문-결과) 의 Background 본문 결과 섹션도 이 권한 규칙을 따른다.

## 실시간 갱신 (WebSocket 구독 채널)

본문 진행을 실시간으로 받으려면 별도 구독 채널 `background:run:<backgroundRunId>` 를 구독한다. 이 채널은 `execution.background_run.started` 와 `execution.background_run.completed` 두 이벤트를 보낸다. 이벤트별 payload 와 봉투 필드(`backgroundRunId`·`timestamp`, `seq` 없음)의 정본은 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) §8 이다. 이 절은 채널의 동작 규칙을 정한다.

1. 본문 안의 노드 이벤트(`execution.node.started` 등)는 기존 `execution:<id>` 구독 채널에 그대로 보낸다. 본문 노드의 `parentNodeExecutionId` 가 Background 노드의 `NodeExecution.id` 와 같으므로 클라이언트가 그 키로 걸러 본문 카드 안 타임라인을 갱신한다.
2. `background:run:<id>` 채널은 본문 실행 수명 주기 이벤트만 보낸다. 채널 책임을 좁혀 메인 채널과 데이터가 겹치지 않게 한다.
3. 이 채널은 기존 `execution:<id>` 와 격리된다. 메인 흐름 구독자에게 본문 실행 수준 이벤트가 가지 않고 반대도 같다(격리 계약의 사용자 가시 표현).
4. 구독 권한은 [권한](#권한) 과 같다. `backgroundRunId` 로 `executionId` 를 역조회해 워크스페이스를 확인한다.
5. 본문이 끝나면 채널은 더 이벤트를 보내지 않는다. 다시 구독해도 서버가 마지막 상태 스냅샷을 보내지 않으므로 REST GET 으로 조회한다.
6. `execution.background_run.completed` 의 `status` 는 `completed` 와 `failed` 두 값이다. `cancelled` 값은 보내지 않는다. 현재 구현(`background-execution.processor.ts`)은 본문 실행 함수가 정상 반환하면 `completed`, 예외로 끝나면 `failed` 를 보낸다. 입력 대기로 조용히 끝난 본문과 메인 실행 중지를 알아채고 멈춘 본문은 모두 `completed` 로 보낸다. 본문 취소를 어떻게 표시할지는 정의가 갈린다. [미결 사항](#미결-사항) 참조.
7. 이 채널의 발행에는 `execution:` wire 와 같은 값 마스킹을 건다. 구독 인가가 역할을 보지 않아 뷰어도 받으므로 수신 인구가 `execution:` 과 같기 때문이다. 규칙은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) §3.11 에 있다.

## AI 어시스턴트 도구 노출 (계획)

AI 어시스턴트의 읽기 전용 실행 조회 도구(`ED-AI-35~38`)가 이 API 로 Background 본문 실행도 조회하게 하는 계획(Planned)이다. 에디터 PRD 의 "직계 자식 실행(서브 워크플로우 1단계)" 정책을 Background 에 적용해, 어시스턴트가 "왜 background 가 실패했나" 같은 질문에 답할 수 있게 한다.

| 도구(가칭) | 대응 |
|-------------|------|
| `get_background_run(executionId, backgroundRunId)` | 위 GET 단건 조회. cursor 페이지네이션 옵션 |
| `list_background_runs(executionId)` | 실행의 모든 Background 노드 노드 실행 기록을 돌며 `meta.backgroundRunId` 목록 반환. `ED-AI-35` 직계 자식 확장 |

도구 상세는 [AI 어시스턴트 도구](../CLE-WF/CLE-WF-ASSIST-TOOLS.md) 가 정한다. 두 도구는 아직 없어서 도입이 결정되기 전까지 이 절은 계획이다([미결 사항](#미결-사항)).

## API 에러 코드

| HTTP | 코드 | 발생 조건 |
|------|------|-----------|
| 400 | `INVALID_CURSOR` | cursor 디코딩 실패 |
| 400 | `INVALID_LIMIT` | `limit` 이 1 미만 또는 200 초과 |
| 401 | (인증 미들웨어) | 토큰 없음 / 만료 |
| 404 | `EXECUTION_NOT_FOUND` | `executionId` 없음 또는 워크스페이스 불일치(IDOR 차단. 403 으로 새지 않는다) |
| 404 | `BACKGROUND_RUN_NOT_FOUND` | `backgroundRunId` 가 그 실행에 없음 |

이 API 는 외부 부수 효과가 없으므로 5xx 는 표준 NestJS 핸들러에 맡긴다(DB 장애 등).

## 미결 사항

- **AI 어시스턴트 조회 도구의 도입 여부** (warning): 이 문서는 `get_background_run` · `list_background_runs` 를 어시스턴트가 쓸 수 있고 상세는 어시스턴트 문서가 정한다고 적었다. [AI 어시스턴트 도구](../CLE-WF/CLE-WF-ASSIST-TOOLS.md) 와 [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md) 의 탐색 도구 목록에는 두 도구가 없고 에디터 PRD `ED-AI-35` 는 도구 2종만 정의한다. 현재 구현(`TOOL_KIND_BY_NAME`)에도 없다. 결정 전까지 이 문서는 해당 절을 계획으로 둔다. 결정은 [AI 어시스턴트 도구 미결 사항](../CLE-WF/CLE-WF-ASSIST-TOOLS.md#미결-사항) 에서 한다.
- **본문 취소를 종결 상태로 표시할지** (warning): 이 문서의 원문은 본문 실행 종결 상태를 `completed` · `failed` 로만 정하고, 메인 실행 취소가 본문으로 전파되지 않아 `cancelled` 를 보내지 않는다고 적는다. 에디터 실행 원문은 `execution.background_run.completed` 를 받으면 카드 배지를 `completed` · `failed` · `cancelled` 가운데 최종 상태로 바꾼다고 적었다. [에디터 실행과 디버깅](../CLE-EXEC/CLE-EXEC-RUN.md#background-본문-결과) 은 이 문서의 이벤트 정의를 따르도록 값 나열을 지웠다. 현재 구현은 원문과 달리 메인 실행 중지를 본문도 알아챈다. 본문이 메인과 같은 `executionId` 를 쓰므로 [노드 취소 §DB 관측 취소 가드](../CLE-EXEC/CLE-EXEC-CANCEL.md#db-관측-취소-가드) 가 본문 안에서도 중지를 관측하고 `ExecutionCancelledError` 로 본문을 멈춘다. `executeBackgroundSubgraph` 는 이 에러를 입력 대기 종료처럼 조용히 삼킨다. 그래서 이벤트는 `completed` 로 가고 실패 알림과 큐 재시도는 없다(`execution-engine.service.ts`). REST 응답 타입(`BackgroundRunStatus`)에도 `cancelled` 가 없다. 중지로 멈춘 본문을 `completed` 로 둘지, REST `status` 와 이벤트 `status` 에 `cancelled` 를 더할지 결정 필요.

## 구현 위치

- `codebase/backend/src/modules/executions/background-runs/**` (모니터링 API)
- `codebase/frontend/src/lib/websocket/use-background-run.ts` (구독 채널 클라이언트)
- `codebase/backend/src/shared/utils/redact-stored-error.ts` (응답 `error` 마스킹)

## Rationale

### URL 을 중첩 구조로 둔다

`GET /api/executions/:executionId/background-runs/:backgroundRunId` 로 중첩한 이유는 다음과 같다.

- `backgroundRunId` 는 UUID v4 라 전역에서 유일하므로 `GET /api/background-runs/:backgroundRunId` 같은 평평한 URL 도 기술적으로는 가능하다.
- 그러나 `meta.backgroundRunId` 는 별도 컬럼이 아니라 `NodeExecution.outputData` JSONB 안에 있다. 평평한 URL 로 따로 조회하면 JSONB 전체 스캔 위험이 있다. `executionId` 범위 안에서 조회해 검색 범위를 좁힌다.
- 권한 확인이 단순해진다. `executionId` 1차 키로 워크스페이스를 확인한 뒤 `backgroundRunId` 를 확인한다. 평평한 URL 은 backgroundRunId → NodeExecution → executionId → 워크스페이스 사슬이 필요하다.
- REST 의미로도 본문 실행은 실행에 딸린 자원이다.

조회 성능은 `NodeExecution.outputData` JSONB 의 `meta.backgroundRunId` 경로에 대한 부분 식 B-tree 인덱스(`output_data #>> '{meta,backgroundRunId}'`, `WHERE ... IS NOT NULL`)로 보강한다. Background 노드의 노드 실행 행만 색인해 크기를 줄인다(`migrations/V047__node_execution_background_run_id_index.sql`). 조회는 `executionId` 범위와 이 식 인덱스를 함께 쓴다.

### 페이지네이션을 처음부터 둔다

`nodeExecutions` 에 처음부터 cursor 페이지네이션을 넣었다.

- 본문이 수십 노드 이하면 단순 응답으로도 충분하다. 그러나 본문에 Loop · ForEach 가 있으면 노드 실행 기록이 수백 건으로 늘 수 있다.
- 나중에 `?limit=` 만 더하는 것은 호환을 깨지 않는다. 하지만 클라이언트가 `data: [...]` 단순 배열을 가정하면 응답 모양을 바꿀 때 호환이 깨진다. 그래서 처음부터 `{ data, nextCursor, hasMore }` 로 고정했다.
- 정렬 키 `(startedAt ASC, id ASC)` 는 안정 순서라 같은 시각에 시작한 노드의 순서가 흔들리지 않는다.

### 본문 실행 수명 주기 이벤트를 별도 구독 채널로 나눈다

`background:run:<id>` 채널을 `execution:<id>` 와 따로 운영한다.

- 본문 실행 수준 이벤트(시작·종료)를 메인 흐름 구독자에게 보내면 클라이언트의 이벤트 라우팅과 카운터가 오염된다. 격리 계약의 사용자 가시 표현이다. 본문 노드 이벤트는 `parentNodeExecutionId` 로 거를 수 있어 메인 채널에 그대로 둔다.
- 메인 실행이 끝나도 Background 구독이 살아 있을 수 있다(메인 뒤 노드가 `backgroundRunId` 만 받고 실시간 관찰을 시작하는 경우). 본문이 끝나면 채널은 더 이벤트를 보내지 않는다.
- 사용자가 `backgroundRunId` 를 알아야 구독할 수 있다. 메인 실행자만 알 수 있는 키라서 권한이 더 드러날 위험이 없다.

### AI 어시스턴트에 읽기 전용 도구로만 노출한다 (계획)

이 절은 도구를 도입할 때의 설계 방향이다. 도입 여부는 [AI 어시스턴트 도구 미결 사항](../CLE-WF/CLE-WF-ASSIST-TOOLS.md#미결-사항) 에서 정한다. 에디터 PRD 의 "직계 자식 실행(서브 워크플로우 1단계)" 정책을 Background 본문 실행에 적용한다.

- Background 는 fire-and-forget 이지만 사용자에게는 "메인 실행의 비동기 자식" 이다. 어시스턴트가 "왜 background 가 실패했나" 에 답하려면 본문 노드 실행 기록을 읽어야 한다.
- 읽기 전용 도구로만 노출한다. 어시스턴트가 Background 재실행이나 취소 같은 부수 효과를 일으킬 수 없다.
- 깊이 1로 제한한다. Background 본문 안의 서브 워크플로우까지는 노출하지 않는다(토큰·권한 폭증 차단).
