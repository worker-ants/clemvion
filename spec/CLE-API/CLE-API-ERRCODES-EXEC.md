---
id: "CLE-API-ERRCODES-EXEC"
title: "에러 코드 카탈로그 — 워크플로우 실행"
type: "convention"
version: 4
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-ERRCODES"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-ERRCODES"]
area: "CLE-API"
content_hash: "6805c10cb5f070cb773c369fce738ed1c3ea383840b330665c36c69b170e97af"
read_as: "approved_fallback"
task: "CLE-T-CPZBVH"
source_paths: []
mirror_sha256: "9f9af47d4e375019f8144b18b287800f0c639f8c82c95f5db2ba10ad1a1c8c89"
etag: "sha256-0ef373821d93699337c6cb33d0ad954ad7bd591f3db16a26574f629a676b1abd"
---
## 개요

이 문서는 [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 의 하위 문서로 카탈로그 가운데 워크플로우 실행의 엔진 수준 코드(§6.5), 노드 수준 런타임 코드(§6.6), 재실행 코드(§6.16)를 정한다.

## 6.5 워크플로우 실행: 엔진 수준

엔진 수준 에러다. 실행 상태가 `failed` 가 된다.

**이 표는 한 곳에 모여 등재된 코드를 뜻하지 않는다.** 앵커가 셋으로 갈린다. `ErrorCode` const(`EXECUTION_TIME_LIMIT_EXCEEDED`), `EngineErrorCode` const(`WORKER_HEARTBEAT_TIMEOUT` · `SERVER_INTERRUPTED`), 에러 클래스의 `readonly code`(`ERROR_PORT_FALLBACK`)다. 앵커 열이 `없음` 인 나머지 코드는 맨 문자열이라 오탈자가 `tsc` 를 통과한다. 앵커 열이 `메시지 접두` 인 행은 코드가 아니다. 엔진이 그 이름을 코드 필드에 싣지 않고 에러 메시지 앞에 쌍점과 함께 붙인다. 이 접두로 분기하지 않는다(규칙 4). 다른 모듈(`shadow-workflow.ts` 의 union, `execution-failure-classifier.ts` 의 목록)에도 같은 이름이 나오지만 그것은 소비자·분류기 쪽 어휘이지 엔진 발행 경로의 앵커가 아니다.

| 코드 | 앵커 | 설명 | 정의 문서 |
|------|------|------|-----------|
| `EXECUTION_TIMEOUT` | 없음 | Code 노드 스크립트 실행 타임아웃(엔진 수준. 실행 `failed`, EIA `execution.failed.error.code`). 노드 출력 층의 `CODE_TIMEOUT`, 누적 실행 시간 초과와의 구분은 §4.1 | [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md) |
| `EXECUTION_TIME_LIMIT_EXCEEDED` | `ErrorCode` | 실행 하나의 **누적 active-running 시간** 초과(wall-clock 아님, 입력 대기 시간 제외). 실행 `failed` | [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) |
| `WORKER_HEARTBEAT_TIMEOUT` | `EngineErrorCode` | 활성 세그먼트 job 이 BullMQ stalled 재배달(`maxStalledCount=1`) 시도를 다 씀(워커 최종 실패). 실행 `failed`. 2026-07-04 구현. 부팅 시 `recoverStuckExecutions` 재구동은 이 코드를 쓰지 않는다(재구동 불가는 `RESUME_CHECKPOINT_MISSING`). 이름의 경위는 §3 | [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `RECURSION_DEPTH_EXCEEDED` | 없음 | 서브 워크플로우 재귀 깊이 초과. 발행 형태는 [미결 사항](CLE-API-ERRCODES.md#미결-사항) 참조 | [워크플로우 호출 노드](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md) |
| `MAX_ITERATIONS_EXCEEDED` | 메시지 접두 | 코드가 아니다. Loop 노드가 최대 반복 횟수(`maxIterations`, 기본 1000)를 넘으면 메시지 앞에 붙는 접두다. 메시지는 `MAX_ITERATIONS_EXCEEDED: Loop count <count> exceeds maximum <maxIterations>` 나 `MAX_ITERATIONS_EXCEEDED: Loop iteration <i> exceeds maximum <maxIterations>` 다. 행을 남긴 이유는 Rationale 에 있다 | [Loop 노드 「에러」](../CLE-NODE-LOGIC/CLE-NODE-LOOP.md#에러) |
| `CYCLE_DETECTED` | 없음 | 워크플로우 그래프에 순환 감지 | [실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md) |
| `INVALID_EXPRESSION` | 없음 | 표현식 평가 실패 | [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) |
| `VARIABLE_NOT_FOUND` | 없음 | 참조한 변수가 없음 | [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) |
| `TYPE_MISMATCH` | 없음 | 데이터 타입 불일치 | [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) |
| `ERROR_PORT_FALLBACK` | 클래스 `readonly code` | 에러 포트로 보내려 했으나 연결된 연결선이 없어 Stop Workflow 로 폴백 | [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) |
| `SERVER_INTERRUPTED` | `EngineErrorCode` | 서버가 안전 종료(SIGTERM)할 때 유예 시간(`SIGTERM_GRACE_MS`, 기본 30초)이 지나도 이 인스턴스가 맡은 노드 실행과 실행이 `running` 이면 `failed` 로 닫는다. 입력 대기 중인 실행은 건드리지 않는다 | [안전 종료와 영속 재개 큐 「안전 종료」](../CLE-EXEC/CLE-EXEC-RECOVERY-SHUTDOWN.md#안전-종료) |

**`INVALID_NODE_CONFIG` 는 행이 없다.** 엔진은 노드를 실행하기 전에 노드 설정을 검사한다(`handler.validate`). 검사에 실패하면 메시지가 `INVALID_NODE_CONFIG: ` 로 시작하는 에러를 던진다. 구조화된 `error.code` 는 없고 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) 을 따른다. 코드가 아니라 메시지 접두라서 행을 두지 않는다. 이 접두로 분기하지 않는다(규칙 4).

**컨테이너 구조 검사의 접두도 행이 없다.** 엔진은 Loop · ForEach · Map 본문을 실행하기 전에 구조를 검사한다. 어기면 메시지가 `CONTAINER_CYCLE: ` · `CONTAINER_INVALID_CHILD: ` · `CONTAINER_MISSING_EMIT: ` · `CONTAINER_MULTIPLE_EMIT: ` 로 시작하는 에러를 던진다. `INVALID_NODE_CONFIG: ` 와 같은 메시지 접두라서 행을 두지 않는다. 메시지 전체는 [컨테이너 실행 「공통 실행 모델」](../CLE-EXEC/CLE-EXEC-CONTAINER.md#공통-실행-모델) 에 있다. AI 어시스턴트 도구가 트리거 노드를 컨테이너 안에 넣으려 할 때 돌려주는 `error: 'CONTAINER_INVALID_CHILD'` 는 이 접두와 다른 도구 결과 값이다([워크플로우 어시스턴트 도구](../CLE-WF/CLE-WF-ASSIST-TOOLS.md)).

**취소로 끝나는 시스템 코드**(위 `failed` 표와 구분한다). 둘 다 실행이 `cancelled`, `cancelledBy='timeout'` 으로 끝나고 `error.code` 로 원인을 가른다. §6.7 의 `RESUME_*` 와 같은 취소 귀결 부류다. 두 코드의 앵커는 모두 `EngineErrorCode` const 다. 그래서 `EngineErrorCode` 의 네 값은 위 `failed` 표의 `WORKER_HEARTBEAT_TIMEOUT` · `SERVER_INTERRUPTED` 와 이 표의 두 코드다.

| 코드 | 설명 | 정의 문서 |
|------|------|-----------|
| `EXECUTION_QUEUE_WAIT_TIMEOUT` | 동시 실행 제한 때문에 intake 큐에서 기다리던 실행이 5분(환경 변수 `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`, 기본 `300000`ms)을 넘김. 노드가 한 번도 시작되지 않은 시스템 취소라 `failed` 가 아니라 `cancelled` 다. 구현됨(advisory lock 입장 게이트의 큐 대기 초과 마감) | [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md), [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `WEBCHAT_IDLE_TIMEOUT` | 공개 웹채팅(`auth_config_id IS NULL`, 실행 단위 토큰)의 입력 대기 실행이 발급된 모든 인터랙션 토큰의 영구 만료와 유예 시간을 넘김. 사용자가 떠나 이어갈 수 없는 세션을 회수하는 backstop 이다 | [External Interaction API 「공개 위젯의 방치된 입력 대기 회수」](../CLE-IX/CLE-EIA.md#공개-위젯의-방치된-입력-대기-회수), 같은 문서의 「공개 위젯 회수 신호는 토큰 만료다」 Rationale |

## 6.6 워크플로우 실행: 노드 수준 런타임

노드 핸들러가 `output.error.code` 로 에러 포트에 싣는 코드다(에러 포트 동작은 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md)). ForEach · Map · Parallel 이 실패한 회차 · 병렬 분기를 결과 항목의 `error.code` 에 담을 때 쓰는 대체값 `UNKNOWN_ERROR` 도 이 절에 둔다. 핸들러가 throw 한 실패를 에러 처리 정책 `route_to_error_port` 로 에러 포트에 보낼 때도 `output.error.code` 에 같은 대체값을 쓴다(아래). 정식 목록은 `ErrorCode` enum 이고 주요 항목은 아래와 같다.

| 부류 | 코드 | 정의 문서 |
|----------|------|-----------|
| HTTP | `HTTP_TRANSPORT_FAILED` · `HTTP_4XX`(따라가지 않은 3xx 포함, 아래) · `HTTP_5XX` · `HTTP_TIMEOUT`(발행하지 않음, 아래) · `HTTP_BLOCKED`(사설망 차단, 모든 인증 방식 공통. `integration` 인증의 리다이렉트 한도 초과도 이 코드다, 아래) | [HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md) |
| Database | `DB_QUERY_FAILED` · `DB_CONNECTION_ERROR` · `DB_CONSTRAINT_VIOLATION` · `DB_PERMISSION_DENIED` · `DB_HOST_BLOCKED`(host 가 사설·loopback 이라 사설망 차단. 기본 켬, `ALLOW_PRIVATE_HOST_TARGETS` 로 끔) · `INVALID_PARAMETERS`(`parameters` 가 배열도 JSON 배열 문자열도 아님) | [Database Query 노드](../CLE-NODE-INT/CLE-NODE-DBQUERY.md) |
| Email | `EMAIL_SEND_FAILED`(`IntegrationError` 가 아닌 예외. `details.integrationCode` 는 넣지 않는다) · `EMAIL_HOST_BLOCKED`(host 가 사설·loopback 이라 사설망 차단. 기본 켬, `ALLOW_PRIVATE_HOST_TARGETS` 로 끔) · `EMAIL_NO_RECIPIENTS`(정규화한 수신자 `to` 가 비어 보낼 곳이 없음). `IntegrationError` 의 코드(`INTEGRATION_*` · `EMAIL_HOST_BLOCKED` · `EMAIL_NO_RECIPIENTS`)는 그대로 `output.error.code` 로 나오고 `details.integrationCode` 에도 같은 값이 들어간다 | [Send Email 노드](../CLE-NODE-INT/CLE-NODE-EMAIL.md) |
| LLM | `LLM_CALL_FAILED` · `LLM_RATE_LIMIT` · `LLM_RESPONSE_INVALID` · `LLM_TIMEOUT`(발행하지 않음, 아래) · `MAX_COLLECTION_RETRIES_EXCEEDED` · `TOOL_DEFINITION_PAYLOAD_EXCEEDED`(AI 에이전트 도구 정의가 크기 · 개수 상한을 넘음). LLM 클라이언트 층 코드는 §6.17 | [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md), [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) |
| Code 노드 | `CODE_EXECUTION_FAILED` · `CODE_TIMEOUT` · `CODE_MEMORY_LIMIT`(isolate 메모리 하드 리밋 초과, 기본 128MB, `CODE_NODE_MEMORY_LIMIT_MB` 로 조정) | [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md) |
| 서브 워크플로우 | `SUB_WORKFLOW_FAILED` · `SUB_WORKFLOW_NOT_FOUND` · `SUB_WORKFLOW_TIMEOUT` · `SUB_WORKFLOW_QUEUE_FAILED` · `WORKFLOW_FORBIDDEN_WORKSPACE` | [워크플로우 호출 노드](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md) |
| 통합 공통 · Cafe24 · MakeShop | 통합 노드 공통 코드 `INTEGRATION_*` 와 `CAFE24_*` · `MAKESHOP_*`. 코드 목록은 §6.22 | [통합 노드 공통 「공통 에러 코드」](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md#공통-에러-코드), [Cafe24 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-CAFE24.md#에러-코드), [MakeShop 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#에러-코드) |
| 노드 취소 | `AbortError` (§3 예외 등록 코드) | [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) |
| 반복 · 병렬 실패 회차 · 에러 포트 라우팅 | `UNKNOWN_ERROR`(`errorPolicy='continue'` 의 `skipped[].error.code` · Map `mapped[i].error.code` 대체값. 핸들러가 throw 한 실패를 `route_to_error_port` 로 보낼 때의 `output.error.code` 대체값, 아래) | [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#반복-결과-출력-구조), [노드 에러 처리 정책 「2. 에러 포트로 라우팅」](../CLE-NODE/CLE-NODE-ERROR.md#2-에러-포트로-라우팅) |

- **`HTTP_TIMEOUT` 은 발행하지 않는다.** enum 에는 있지만 HTTP Request 핸들러는 타임아웃 때 `AbortController.abort()` 로 fetch 를 멈추고 그 reject 를 다른 전송 에러와 함께 `HTTP_TRANSPORT_FAILED` 로 발행한다(`http-request.handler.ts`). 그래서 `output.error.code` 로 `HTTP_TIMEOUT` 이 보이는 경로는 없다. 앞으로 세분화할 여지와 방어적 매핑을 위해 enum 과 분류 표에 코드를 남긴다.
- **`HTTP_4XX` 에는 따라가지 않은 3xx 도 든다.** HTTP Request 핸들러는 상태가 500 이상이면 `HTTP_5XX`, 그 밖의 2xx 아닌 응답은 `HTTP_4XX` 를 낸다. 3xx 와 4xx 는 `output.error.details.statusCode` 로 가른다. 이름이 이 범위를 다 담지 못해 [예외 등록 코드](CLE-API-ERRCODES-EXCEPT.md#3-예외-등록-코드) 에 올렸다(아래 Rationale).
- **`HTTP_BLOCKED` 는 리다이렉트 한도 초과에도 나간다.** `integration` 인증의 HTTP Request 노드는 리다이렉트를 직접 따라간다. 5홉을 따라간 뒤에도 `Location` 이 있는 3xx 가 오면 사설망 차단 판정 없이 `HTTP_BLOCKED` 를 낸다. `output.error.message` 도 사설망 차단과 같은 `Request blocked by SSRF policy.` 다. 차단 코드를 판정에만 쓴다는 [통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md) 규칙 9 의 예외이고, 새 조건에 기존 코드를 쓰므로 카탈로그 규칙 6 의 예외다. 2026-11-14 에 사람이 전용 코드를 만들지 않고 이 예외를 받아들였다(아래 Rationale).
- **HTTP Request 노드의 활동 로그 `error.code` 는 상태 코드별 `HTTP_{status}` 다.** `integration` 인증일 때 노드는 호출마다 통합 활동 로그를 남긴다. 응답이 2xx 가 아니면(3xx · 4xx · 5xx) `HTTP_404` · `HTTP_502` 처럼 상태 번호를 붙인 값을 싣고 통합의 `last_error.code` 에도 같은 값이 남는다. 노드 출력의 `output.error.code` 는 위 표의 `HTTP_4XX` · `HTTP_5XX` 다. 이름이 규칙 1 을 따르지 않아 [예외 등록 코드](CLE-API-ERRCODES-EXCEPT.md#3-예외-등록-코드) 에 올렸다. 정의는 [HTTP Request 노드 — 실행 로직 「활동 로그」](../CLE-NODE-INT/CLE-NODE-HTTP-EXEC.md#활동-로그) 다.
- **`LLM_TIMEOUT` 도 발행하지 않는다.** enum 에는 있지만 어느 LLM 호출 경로도 이 코드를 내지 않는다(2026-10-10 결정). LLM 타임아웃은 `LLM_CALL_FAILED` 나 스트림 에러 코드로 온다. 단일 턴 AI 에이전트의 롤링 요약 호출에는 앱 타임아웃이 없어 `LLM_TIMEOUT` 이 나오지 않는다. 이 호출이 실패하면 첫 호출과 같은 분류로 `error` 포트에 나간다. LLM 클라이언트의 `withTimeout` 도 전용 코드로 옮기지 않는다([LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md)). 호출 경로별 결과는 [AI 노드 공통 「LLM 호출 경로별 타임아웃」](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md#llm-호출-경로별-타임아웃) 이 모아 적는다. [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md) 의 실패 분류 표는 `HTTP_TIMEOUT` 처럼 이 코드를 «발행 안 됨» 으로 표시해 남긴다. 등재를 지울지는 [미결 사항](CLE-API-ERRCODES.md#미결-사항)이다.
- 옛 코드 `NODE_EXECUTION_FAILED`·`INTEGRATION_ERROR`·`LLM_ERROR` 는 노드 출력에 더 이상 쓰지 않는다. 노드 실패가 Stop Workflow 로 격상된 엔진 수준에서만 `NodeExecution.error.message` 맥락으로 남는다.
- **`UNKNOWN_ERROR` 는 반복 · 병렬 결과와 에러 포트 라우팅에 쓰는 대체값이다.** ForEach · Map · Parallel 이 실패한 회차 · 병렬 분기를 결과에 담을 때 던진 에러에 백엔드가 직접 싣는 카탈로그 코드가 없으면 이 값을 쓴다. 평범한 `Error` · `TypeError`, Node 런타임 · DB 드라이버의 `code`(`ECONNREFUSED` 등), Error 가 아닌 값이 여기에 든다. 규칙은 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#반복-결과-출력-구조) 4번이 정한다. 그대로 내는 코드는 허용 목록에 있는 값뿐이다. 목록은 `ErrorCode` · `EngineErrorCode` · MCP 코드 상수의 값과 에러 클래스가 싣는 `code` 리터럴로 만든다. 단위 테스트(`iteration-error-code.spec.ts`)가 소스의 에러 클래스 `code` 리터럴과 목록이 맞는지 본다. 핸들러가 throw 한 실패를 에러 처리 정책 `route_to_error_port` 로 보낼 때도 `output.error.code` 를 같은 함수(`resolveIterationErrorCode`)로 고른다(NERV Task `CLE-T-KXARNK`). 정책 쪽 규칙은 [노드 에러 처리 정책 「2. 에러 포트로 라우팅」](../CLE-NODE/CLE-NODE-ERROR.md#2-에러-포트로-라우팅) 에 있다.
- 채팅 채널 어댑터는 이 enum 으로 사용자 안내 메시지를 고른다([채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md)). enum 을 늘리면 분류 표에 행을 더할지 함께 검토한다.
- **워크스페이스 격리 가드 `WORKFLOW_FORBIDDEN_WORKSPACE`**: 다른 워크스페이스(또는 호출자 컨텍스트 누락)의 서브 워크플로우 호출을 막는다(fail-closed). `assertSameWorkspace` 가 typed `WorkflowForbiddenWorkspaceError` 를 던지고 서브 워크플로우 핸들러(`mapSubWorkflowError`)가 이를 `ErrorCode.WORKFLOW_FORBIDDEN_WORKSPACE` 로 바꿔 에러 포트(`output.error.code`)에 싣는다.

## 6.16 재실행 (도메인 문서 참조)

`POST /executions/:id/re-run` 의 실패 응답이다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `RERUN_PERMISSION_DENIED` | 403 | 다른 사용자의 실행이고 호출자가 소유자·관리자가 아님(서비스 판정). 비멤버와 뷰어는 가드가 먼저 막는다 | [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) |
| `RERUN_EXECUTION_NOT_FOUND` | 404 | `executionId` 가 없거나 다른 워크스페이스의 실행 | [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) |
| `RERUN_WORKFLOW_DELETED` | 404 | 원본 실행의 워크플로우가 삭제됨 | [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) |
| `RERUN_CHAIN_DEPTH_EXCEEDED` | 409 | 재실행 체인 깊이 32 초과 | [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) |
| `RERUN_DRY_RUN_NOT_APPLICABLE` | 400 | dry-run 요청인데 워크플로우에 dry-run 을 지원하지 않는 노드(`supportsDryRun: false`)가 있음 | [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) |

입력 파라미터 검증 실패는 `INVALID_TRIGGER_PARAMETERS`(§6.4)다.

## Rationale

### `RESUME_CHECKPOINT_MISSING` 정의에 중첩 재개의 호출 스택을 더한 이유 (2026-10-04)

카탈로그 행은 `NodeExecution.outputData` 결손만 적었다. 엔진은 그 전부터 중첩 재개의 빈 frame 목록, 호출 노드 부재, frame 에서 재개를 시작할 노드의 부재에도 이 코드를 냈다. 2026-10-04 에 frame 의 `workflowId` · `invokerNodeId` 결손도 조회 전에 이 코드로 마감하도록 했다(NERV Task `CLE-T-BV4YXZ`, [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 의 「rehydration 실패」). 그래서 행을 넓혔다.

- **규칙 6 의 새 조건으로 보지 않았다**: 네 경우 모두 park 때 커밋한 영속 컨텍스트가 깨져 재구동할 수 없다는 같은 뜻이다. 종결(실행 `cancelled`, 짝 노드 실행 `failed`)과 클라이언트 처리(`execution.cancelled` 의 `RESUME_*` 분기, 채팅 채널의 세션 만료 안내)도 같다. 문서가 기존 경우를 빠뜨렸던 것을 바로잡았다.
- **§3 에 등재하지 않았다**: 이름의 `CHECKPOINT` 는 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 「체크포인트」 절의 뜻이다. 그 절은 park 때 커밋하는 영속 컨텍스트를 체크포인트에 넣는다. 그 목록([실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md))에 호출 스택(`Execution.resume_call_stack`)이 있다. 이름이 뜻과 어긋나지 않는다.
- 같은 코드를 영속 상태 손상 밖의 재개 불변식 위반에도 쓴다. 맞는 처리기가 없을 때가 그 예다([큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) Rationale). 행의 괄호를 "예:" 로 적은 이유다.
- 호출 스택의 버전이 지원 범위보다 크면 이 코드가 아니라 `RESUME_INCOMPATIBLE_STATE` 다. 경계는 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 「rehydration 실패」 에 적었다.

### LLM 타임아웃에 `LLM_TIMEOUT` 을 쓰지 않는다 (2026-10-10)

`LLM_TIMEOUT` 은 enum 에 있지만 발행처가 없었다. [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md) 만 스트리밍 턴 타임아웃에 이 코드를 약속했다. 2026-10-10 에 사람이 LLM 호출 타임아웃 문서를 코드에 맞추기로 정하면서 이 코드도 내지 않기로 했다. LLM 타임아웃은 `LLM_CALL_FAILED` 나 스트림 에러 코드로 온다. 결정 근거는 [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md) 의 Rationale 에 있다. enum 과 등재를 지울지는 규칙 9 정리와 함께 NERV Task `CLE-T-8WXV7T` 가 정한다.

- 단일 턴 AI 에이전트의 LLM 호출(첫 호출 · 도구 루프 호출 · 롤링 요약 호출)이 실패하면 노드는 멀티턴과 같은 분류의 에러를 `error` 포트로 낸다(NERV Task `CLE-T-ZHBMAC` · `CLE-T-Q38K9F`). 타임아웃은 재시도할 수 있는 `LLM_CALL_FAILED` 다. 롤링 요약 `chat` 실패는 첫 호출과 같은 HTTP status 기준으로 나뉜다. 요약 모델 설정(`summaryModelConfigId`)을 찾지 못한 실패는 429 · 5xx · 네트워크 신호가 없어 재시도할 수 없는 `LLM_CALL_FAILED` 로 나온다. 멀티턴 재개와 같은 분류다.
- 남은 공백은 노드 LLM 설정(`llmConfigId`)을 해석하지 못하는 경우다. 이때는 아직 에러 코드 없이 노드가 실패한다.

### 반복 · 병렬 실패 회차의 대체 코드 `UNKNOWN_ERROR` 를 새로 만들었다 (2026-11-05)

ForEach · Map · Parallel 은 `errorPolicy='continue'` 에서 실패한 회차 · 병렬 분기를 `skipped[].error.code`(Map 은 `mapped[i].error.code`)에 담는다. 그전에는 던진 에러의 `name`(`Error` · `TypeError` 등)을 그대로 실어 규칙 2 와 맞지 않았다. Error 가 아닌 값에 쓰던 `UNKNOWN_ERROR` 는 카탈로그에 없었다(규칙 8). NERV Task `CLE-T-REC4X3` 이 세 노드의 규칙을 하나로 모았다. 정의는 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#반복-결과-출력-구조) 4 · 5번이다.

- 백엔드가 직접 싣는 카탈로그 코드는 그대로 내고 `name` 이 `AbortError` 면 §3 의 `AbortError` 를 낸다. 그 밖은 `UNKNOWN_ERROR` 로 모으고 §6.6 에 등재했다.
- 대체값에 옛 코드 `NODE_EXECUTION_FAILED` 를 다시 쓰지 않았다. §6.6 이 노드 출력에 더 이상 쓰지 않는다고 적은 이름이라 다시 쓰면 그 결정과 어긋난다.
- 이름에 도메인 접두를 붙이지 않았다. 세 노드가 함께 쓰는 대체값이라 한 도메인의 조건이 아니다(규칙 3). Parallel 이 Error 가 아닌 값에 이미 내던 문자열이어서 그대로 썼다.
- 클라이언트 대화 화면 코드(`conversation-utils.ts`)가 코드가 없는 에러에 같은 문자열을 화면 대체값으로 쓴다. 서버가 내는 값이 아니어서 이 행과 겹치지 않는다.
- 허용 목록을 카탈로그와 대조하다가 §6.6 표에 없던 에러 포트 코드 둘(`INVALID_PARAMETERS`([Database Query 노드](../CLE-NODE-INT/CLE-NODE-DBQUERY.md)), `TOOL_DEFINITION_PAYLOAD_EXCEEDED`([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)))을 더했다(규칙 8). `USER_CANCELLED` 는 `ErrorCode` 에 정의만 있고 내보내는 곳이 없어 표에 올리지 않았다. 목록과 카탈로그를 대조하는 테스트는 두지 않았다. 새 코드는 규칙 8 에 따라 등재한다.
- 기각한 대안은 두 가지다. 하나는 `UPPER_SNAKE_CASE` 모양이면 그대로 내는 안이다. 런타임 · 드라이버의 `code`(`ECONNREFUSED` 등)가 카탈로그 밖 값으로 나간다. 다른 하나는 런타임 · 드라이버 모양을 걸러 내는 안이다. 휴리스틱이라 다른 드라이버의 값이 새어 나갈 수 있다. 자세한 근거는 [Logic 노드 공통 「실패한 회차와 병렬 분기의 `error.code`」](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#실패한-회차와-병렬-분기의-errorcode-2026-11-05) 에 있다.

### Send Email 의 빈 수신자에 `EMAIL_NO_RECIPIENTS` 를 등재했다 (2026-11-06)

NERV Task `CLE-T-3PRYB4` 이다. Send Email 노드는 정규화한 수신자(`to`)가 비면 실행을 실패시키지 않고 에러 포트로 `EMAIL_NO_RECIPIENTS` 를 낸다. 이 코드를 발행하기 시작해 규칙 9 에 따라 §6.6 Email 행에 등재했다.

- 같은 행의 `EMAIL_SEND_FAILED` 설명을 구현에 맞췄다. 실제로는 `IntegrationError` 의 코드가 그대로 `output.error.code` 로 나오고 `details.integrationCode` 에도 같은 값이 들어간다. `EMAIL_SEND_FAILED` 는 `IntegrationError` 가 아닌 예외에만 쓰고 이때 `details.integrationCode` 는 없다. [통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md) 의 서술과 같다.
- 빈 수신자를 에러 포트로 보내는 결정과 이유의 정본은 [Send Email 노드](../CLE-NODE-INT/CLE-NODE-EMAIL.md) Rationale 「빈 수신자를 에러 포트로 보낸다」 다.

### 컨테이너 구조 검사의 접두를 행 없이 메시지 접두로 적었다 (2026-11-12)

NERV Task `CLE-T-1W44RD` 의 결정이다.

- **`CONTAINER_*` 행을 두지 않았다.** 엔진은 컨테이너 구조 검사에 실패하면 `new Error()` 메시지 앞에 `CONTAINER_CYCLE: ` · `CONTAINER_INVALID_CHILD: ` · `CONTAINER_MISSING_EMIT: ` · `CONTAINER_MULTIPLE_EMIT: ` 를 붙이고 코드 필드에는 싣지 않는다. 행으로 등재하면 클라이언트가 분기할 코드처럼 읽혀 규칙 4 와 부딪친다. 그래서 `INVALID_NODE_CONFIG: ` 처럼 행 없이 §6.5 에 메시지 접두로 적었다. 노드 문서들의 에러 표도 이름만 적던 것을 [Loop 노드](../CLE-NODE-LOGIC/CLE-NODE-LOOP.md) 처럼 메시지 전체로 바꿨다([컨테이너 실행 「공통 실행 모델」](../CLE-EXEC/CLE-EXEC-CONTAINER.md#공통-실행-모델)).
- **`MAX_ITERATIONS_EXCEEDED` 는 행을 남기고 앵커 열에 `메시지 접두` 를 적었다.** 이 이름도 Loop 실행기가 메시지 앞에 붙이는 접두다. 규칙 9 는 이런 등재를 지우고 그 자리에 실측을 남기라고 한다. 이 행은 앵커 열과 설명에 실측(메시지 접두와 메시지 전체)을 적어 그 자리 구실을 한다. 행을 지우지 않은 것은 사용자 가이드 실행 결과 페이지의 에러 코드 표와 채팅 채널의 실행 실패 분류기(`execution-failure-classifier.ts`)가 이 이름을 코드로 싣고 있어서다. 독자는 그 이름을 이 카탈로그에서 찾는다. 가이드와 분류기를 고친 뒤 행을 지울지는 NERV Task `CLE-T-82M3MB` 가 정한다.
- **경로 자리표시자 접두는 출력 코드를 바꾸지 않았다.** Cafe24 · MakeShop 노드가 경로 자리표시자를 채우지 못하면 던지는 `CAFE24_UNRESOLVED_PATH_PARAM: ` · `MAKESHOP_UNRESOLVED_PATH_PARAM: ` 은 노드의 바깥 catch 에서 `INTEGRATION_CALL_FAILED` 가 된다. `IntegrationError` 로 바꿔 서비스별 코드를 주는 안도 견줬다. 이 실패는 메타데이터나 입력 매핑의 오류라 흐름에서 따로 분기할 일이 없고, 그 안은 코드 변경과 새 코드 등재가 함께 필요하다. 그래서 출력은 그대로 두고 노드 문서의 에러 코드 절에 메시지 전체와 출력 코드를 적었다.
- **가이드 식별자 가드의 주석과 탈출구** (`guide-identifier-scan.ts` 의 «`CONTAINER_*` 를 6.5 에 등재하면 카탈로그 탈출구가 발화한다») 의 처분도 NERV Task `CLE-T-82M3MB` 가 맡는다.

### `route_to_error_port` 의 `output.error.code` 대체값도 `UNKNOWN_ERROR` 로 적었다 (2026-11-14)

NERV Task `CLE-T-14VQC2` 다. 핸들러가 throw 한 실패를 `route_to_error_port` 로 보낼 때 엔진은 2026-11-13 부터 `output.error.code` 를 반복 결과와 같은 함수로 고른다(NERV Task `CLE-T-KXARNK`). 그래서 카탈로그 코드가 없는 실패는 이 경로에서도 `UNKNOWN_ERROR` 로 나간다. §6.6 머리말 · 표 · 설명이 아직 반복 · 병렬 결과만 적고 있어 이 경로를 더했다.

- **규칙 6 의 새 조건으로 보지 않았다**: 던진 에러에 백엔드가 직접 싣는 카탈로그 코드가 없다는 같은 뜻이다. 고르는 함수도 같아서 새 코드를 만들지 않았다.
- 결정과 기각한 대안의 정본은 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) Rationale 「throw 한 실패의 `error.code` 를 반복 결과와 같은 규칙으로 고른다」 다.

### HTTP Request 노드의 리다이렉트 한도 초과와 활동 로그 코드를 적었다 (2026-11-14)

NERV Task `CLE-T-6G3084` 다. 두 경우 모두 동작은 그대로 두고 카탈로그를 지금 동작에 맞췄다.

- **`HTTP_BLOCKED` 의 리다이렉트 한도 초과**: HTTP 행은 이 코드를 사설망 차단으로만 적었다. 실제로는 한도를 넘긴 리다이렉트에도 판정 없이 같은 코드가 나간다. [통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md) 규칙 9 와 [HTTP Request 노드 — 출력과 에러](../CLE-NODE-INT/CLE-NODE-HTTP-OUTPUT.md) 에는 이 예외가 이미 있고 이 카탈로그에만 없었다. 새 조건에 기존 코드를 쓰는 것이라 규칙 6 과 맞지 않는다. 규칙 6 의 예외로 정한 결정이 없어서 예외로 적지 않았다. 전용 코드를 새로 만들지는 NERV Task `CLE-T-43KCNP` 에 넘겼고, 같은 날 만들지 않기로 정했다(아래 절).
- **활동 로그의 `HTTP_{status}`**: 통합 활동 로그와 통합 `last_error.code` 로 나가는 코드인데 카탈로그에 없었다(규칙 8). 이름이 조건의 뜻 대신 상태 번호를 적어 규칙 1 을 어기므로 [예외 등록 코드](CLE-API-ERRCODES-EXCEPT.md#3-예외-등록-코드) 에 행을 두고 이 절에는 그 행을 가리키는 설명만 두었다. `CAFE24_404` 등이 §6.22 와 §3 에 함께 있는 것과 같은 배치다.

### HTTP Request 노드의 3xx 와 리다이렉트 한도 초과에 새 코드를 만들지 않았다 (2026-11-14)

NERV Task `CLE-T-43KCNP` 에서 사람이 정했다. 근거와 기각한 대안의 정본은 [HTTP Request 노드 — 출력과 에러 「3xx 와 리다이렉트 한도 초과의 코드를 바꾸지 않는다」](../CLE-NODE-INT/CLE-NODE-HTTP-OUTPUT.md#3xx-와-리다이렉트-한도-초과의-코드를-바꾸지-않는다-2026-11-14) 다.

- **리다이렉트 한도 초과**: `HTTP_BLOCKED` 를 규칙 6 의 받아들인 예외로 둔다. 기존 코드를 다시 쓰는 결정이라 §3 에는 올리지 않는다(부모 문서 Rationale 「규칙 7 의 「규칙」 을 이름 규칙으로 좁혔다」). 부모 문서 규칙 6 의 예외 목록에 이 경우를 더하는 일은 NERV Task `CLE-T-J6M2JG` 가 맡는다.
- **`HTTP_4XX` 의 3xx**: 2xx 도 5xx 도 아닌 응답이라는 같은 조건이라 새 조건으로 보지 않았다. 그래도 이름이 4xx 만 말하고 조건의 뜻 대신 상태 범주를 적어 규칙 1 과 맞지 않는다. 그래서 `CAFE24_4XX` 처럼 `HTTP_4XX` · `HTTP_5XX` 를 §3 에 올렸다.
