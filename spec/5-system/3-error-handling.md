---
id: error-handling
status: implemented
code:
  - codebase/backend/src/common/filters/http-exception.filter.ts
  - codebase/backend/src/common/pipes/validation.pipe.ts
  - codebase/backend/src/common/swagger/error-response.dto.ts
  - codebase/backend/src/nodes/core/error-codes.ts
  - codebase/backend/src/modules/execution-engine/error/error-policy.handler.ts
  - codebase/backend/src/modules/health/**/*.ts
---

# Spec: 에러 처리 정책

> 관련 문서: [PRD 비기능 요구사항](./_product-overview.md) · [Spec API 규칙](./2-api-convention.md) · [Spec 실행/디버깅](../3-workflow-editor/3-execution.md) · [Spec 노드 공통](../3-workflow-editor/1-node-common.md)

---

## Overview

본 문서는 제품 전반의 **에러 처리 정책**을 단일 진실로 정의한다 — 에러 코드 분류 체계(시스템·인증/인가·유효성·실행·WS commands·EIA REST·webhook 도메인, §1), 공식 에러 응답 봉투(`{ error: { code, message, requestId, details? } }`, §2), 노드 레벨 에러 처리 정책(Stop Workflow / Skip / Default Output / Retry / Route to Error Port, §3), 워크플로우 레벨 자동 재시도(§4), 클라이언트 에러 처리 흐름·토스트(§5), 로깅 레벨·민감정보 마스킹(§6), 헬스 체크(§7)다.

에러 코드의 **명명 규율**(의미 기반 명명·rename 안정성·`UPPER_SNAKE_CASE`)의 SoT 는 [conventions/error-codes.md](../conventions/error-codes.md) 이고, 본 문서는 표기·카탈로그·응답 envelope·처리 정책을 정의한다. 외부 표면(EIA `/api/external/*` §1.6·webhook `/api/hooks/*` §1.7)이 API 규약 기본 코드([API 규약 §5.3](./2-api-convention.md#53-에러-응답))를 의도적으로 override 하는 항목은 해당 도메인 spec 참조로 등재한다. 응답 봉투 형식의 cross-cutting 정의는 [API 규약 §5.3](./2-api-convention.md#53-에러-응답) 와 정합한다.

---

## 1. 에러 분류

### 1.1 시스템 에러

| 코드 | 이름 | 설명 | 사용자 메시지 |
|------|------|------|--------------|
| `INTERNAL_ERROR` | 내부 서버 오류 | 예상하지 못한 서버 오류 | "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." |
| `SERVICE_UNAVAILABLE` | 서비스 불가 | 의존 서비스 접근 불가 | "서비스를 일시적으로 사용할 수 없습니다." |
| `DATABASE_ERROR` | DB 오류 | 데이터베이스 연결/쿼리 실패 | "데이터 처리 중 오류가 발생했습니다." |
| `RATE_LIMITED` | 요청 제한 | Rate limit 초과 | "요청이 너무 많습니다. {retry_after}초 후 다시 시도해 주세요." |

### 1.2 인증/인가 에러

| 코드 | 이름 | 설명 | HTTP |
|------|------|------|------|
| `AUTH_REQUIRED` | 인증 필요 | 토큰 없음 | 401 |
| `TOKEN_EXPIRED` | 토큰 만료 | Access Token 만료 | 401 |
| `TOKEN_INVALID` | 토큰 무효 | 변조/형식 오류, refresh 토큰 미존재/소유자 부재, 또는 refresh 회전 시 조건부 revoke 매칭 0건(동일 토큰 동시 회전 경합 — [data-flow §1.4](../data-flow/2-auth.md#14-refresh-token-회전)) | 401 |
| `FORBIDDEN` | 권한 없음 | 역할 권한 부족(generic) | 403 |
| `ADMIN_REQUIRED` | Admin 권한 필요 | 워크스페이스 Owner/Admin 역할 필요 시 발행되는 `FORBIDDEN` 의 컨텍스트 특화 코드(`WorkspacesService.assertAdmin()` 발행) | 403 |
| `LOGIN_FAILED` | 로그인 실패 | 잘못된 자격 증명 | 401 |
| `ACCOUNT_LOCKED` | 계정 잠김 | 로그인 시도 초과 | 423 |

### 1.3 유효성 검증 에러

| 코드 | 설명 | HTTP |
|------|------|------|
| `VALIDATION_ERROR` | 요청 데이터 유효성 실패 | 400 |
| `PAYLOAD_TOO_LARGE` | 요청 본문 크기가 body-parser 한도 초과 — 전역 100KB 기본, `/api/hooks/*` 인증 webhook 1MB(`createHooksBodyParsers`). `GlobalExceptionFilter` 가 body-parser 의 413 을 표준 봉투로 매핑. **`message` 는 내부 원문(`"request entity too large"` 등)을 echo 하지 않고 고정 문구 `"Request payload too large."` 만 반환한다(CWE-209 — 비-413 4xx http-error 는 `"The request could not be processed."`, 원문은 서버 로그에만)**. 공개 webhook 의 32KB 추가 제한은 별도 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(§1.7) | 413 |
| `WORKSPACE_ID_REQUIRED` | 워크스페이스 컨텍스트 부재 — `X-Workspace-Id` 헤더와 JWT `workspaceId` 둘 다 없음 (`common/decorators/workspace.decorator.ts` 발행) | 400 |
| `MODEL_CONFIG_INVALID` | ModelConfig 입력 검증 실패 — 알 수 없는 `kind`, 필수 provider 의 apiKey 누락, 사설망/loopback baseUrl(SSRF 가드, tei/local 외) 등 (`model-config.service.ts`·`model-config.controller.ts`·`llm-preview.service.ts`(preview-models, C-2 cluster 4 이후 llm 모듈) 발행) | 400 |
| `RESOURCE_NOT_FOUND` | 리소스 없음 | 404 |
| `MODEL_CONFIG_NOT_FOUND` | 지정 id 의 ModelConfig 부재 또는 cross-kind 접근 차단(존재 누설 방지) — id 지정 경로 + `resolveEmbedding` 의 ws-default 부재(KB 임베딩 config 부재 = 리소스 부재). `RESOURCE_NOT_FOUND` 의 ModelConfig 특화 코드 (`model-config.service.ts` 발행) | 404 |
| `MODEL_CONFIG_DEFAULT_MISSING` | id 미지정 시 워크스페이스 default config 없음(setup 안내용) — `resolveConfig` 의 ws default(chat/LLM) 경로 전용. `resolveEmbedding` 의 ws-default 부재는 `MODEL_CONFIG_NOT_FOUND`(404) 를 사용한다(임베딩 config 부재 = 리소스 부재, setup 안내와 구분; 사용자 결정 2026-06-12) (`model-config.service.ts` 발행) | 400 |
| `RESOURCE_CONFLICT` | 리소스 충돌 (이름 중복 등) | 409 |
| `DUPLICATE_NODE_LABEL` | 노드 라벨 중복 — `RESOURCE_CONFLICT` 의 노드 라벨 특화 코드 (`nodes.service.ts`·캔버스 bulk save 경로의 `workflows.service.ts` 발행) | 409 |
| `WORKFLOW_VERSION_CONFLICT` | 동시 캔버스 저장 경합 — 동일 워크플로우 버전 번호 unique 위반을 감지해 재시도 권고와 함께 반환 (`workflow-versions.service.ts` 발행) | 409 |
| `INVALID_STATE` | 상태 전이 불가 (이미 실행 중인 워크플로우 삭제 등) | 422 |

> WS commands 에서는 동일 의미를 `INVALID_EXECUTION_STATE` 코드로 표기 ([WS Protocol §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server) / [실행 엔진 §7.5.1](./4-execution-engine.md#751-publisher-측-사전-검증--invalid_execution_state)). EIA REST `/interact` 진입점에서는 continuation 명령이 현재 노드/실행 상태와 불일치할 때 같은 의미를 `STATE_MISMATCH`(409) 로 표기한다 (External Interaction API §5.1 에러 표 + §R13 표면별 코드명 매핑 원칙, [14-external-interaction-api.md](./14-external-interaction-api.md)). REST core(`INVALID_STATE`/422) · WS(`INVALID_EXECUTION_STATE`) · EIA REST(`STATE_MISMATCH`/409) 의 표면별 코드 분리는 routing 분기 가시성을 위한 의도적 결정.

### 1.4 워크플로우 실행 에러

엔진 수준 에러 (execution status → `failed`):

| 코드 | 설명 |
|------|------|
| `EXECUTION_TIMEOUT` | **Code 노드 스크립트 실행 타임아웃** (엔진 레벨 — execution status → `failed`, EIA `execution.failed.error.code`). **노드 출력 레이어**는 동일 타임아웃을 노드의 `output.error.code = CODE_TIMEOUT` 으로 발행한다 (핸들러 내부 분류 문자열 `EXECUTION_TIMEOUT` → `CODE_TIMEOUT` 정규화) — 두 레이어 구분 SoT: [`conventions/error-codes.md §4`](../conventions/error-codes.md#4-내부-전용-분류-코드-정규화-후-발행). 엔진 레벨 누적 실행시간 초과는 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 쓴다 |
| `EXECUTION_TIME_LIMIT_EXCEEDED` | 엔진 레벨 — 단일 Execution 의 **누적 active-running 시간**(wall-clock 아님, `waiting_for_input` 대기 제외) 초과 → `failed` ([4-execution-engine §8](./4-execution-engine.md#8-동시-실행-제한)) |
| `WORKER_HEARTBEAT_TIMEOUT` | active 세그먼트 job 이 BullMQ stalled 재배달(`maxStalledCount=1`) attempts 를 모두 소진(terminal worker failure) → `failed`. **PR4 구현(2026-07-04)** — 부팅 `recoverStuckExecutions` re-drive(§7.5 case B)는 이 코드 미사용(재구동 불가=`RESUME_CHECKPOINT_MISSING`) ([4-execution-engine §7.1](./4-execution-engine.md#71-워커-크래시-복구--bullmq-stalled-job-target)) |
| `RECURSION_DEPTH_EXCEEDED` | 서브 워크플로우 재귀 깊이 초과 |
| `MAX_ITERATIONS_EXCEEDED` | Loop/ForEach 최대 반복 횟수 초과 |
| `CYCLE_DETECTED` | 워크플로우 그래프에 순환 감지 |
| `INVALID_EXPRESSION` | 표현식 평가 실패 |
| `VARIABLE_NOT_FOUND` | 참조된 변수 없음 |
| `TYPE_MISMATCH` | 데이터 타입 불일치 |
| `ERROR_PORT_FALLBACK` | 에러 포트로 라우팅 시도했으나 연결된 엣지 없음 → Stop Workflow 폴백 |

노드 수준 런타임 에러 (`output.error.code` 로 라우팅, §3.2 참조) — 정식 목록은 `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum. 주요 항목:

| 카테고리 | 코드 |
|----------|------|
| HTTP | `HTTP_TRANSPORT_FAILED` · `HTTP_4XX` · `HTTP_5XX` · `HTTP_TIMEOUT`(미발행 — 아래 註) · `HTTP_BLOCKED` (SSRF 차단 — 전 인증 방식 공통) |
| Database | `DB_QUERY_FAILED` · `DB_CONNECTION_ERROR` · `DB_CONSTRAINT_VIOLATION` · `DB_PERMISSION_DENIED` · `DB_HOST_BLOCKED` (SSRF 차단 — host 가 사설/loopback, 기본 ON·`ALLOW_PRIVATE_HOST_TARGETS` opt-out) |
| Email | `EMAIL_SEND_FAILED` (+ `details.integrationCode` 로 원본 `INTEGRATION_INCOMPLETE` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` 보존) · `EMAIL_HOST_BLOCKED` (SSRF 가드 차단 — host 가 사설/loopback, 기본 ON·`ALLOW_PRIVATE_HOST_TARGETS` opt-out) |
| LLM | `LLM_CALL_FAILED` · `LLM_RATE_LIMIT` · `LLM_RESPONSE_INVALID` · `LLM_TIMEOUT` · `MAX_COLLECTION_RETRIES_EXCEEDED` |
| Code 노드 | `CODE_EXECUTION_FAILED` · `CODE_TIMEOUT` · `CODE_MEMORY_LIMIT` (isolate 메모리 하드 리밋 초과 — 기본 128MB, `CODE_NODE_MEMORY_LIMIT_MB` env 조정 가능) |
| Sub-workflow | `SUB_WORKFLOW_FAILED` · `SUB_WORKFLOW_NOT_FOUND` · `SUB_WORKFLOW_TIMEOUT` · `SUB_WORKFLOW_QUEUE_FAILED` · `WORKFLOW_FORBIDDEN_WORKSPACE` (분기 매핑 SoT [workflow §6](../4-nodes/2-flow/1-workflow.md#6-에러-코드)) |

> **`HTTP_TIMEOUT`(미발행)**: enum 에는 정의돼 있으나 현재 HTTP Request 핸들러는 timeout 시 `AbortController.abort()` 로 fetch 를 중단하고, 그 reject 를 다른 전송 오류와 함께 `HTTP_TRANSPORT_FAILED` 로 통합 발행한다 (`http-request.handler.ts`). 따라서 `output.error.code` 로 `HTTP_TIMEOUT` 이 관측되는 경로는 없다. enum·분류 표(§3.1)에는 향후 세분화 여지와 방어적 매핑을 위해 코드를 보존한다.

> 구 에러 코드 `NODE_EXECUTION_FAILED` / `INTEGRATION_ERROR` / `LLM_ERROR` 는 노드 수준 envelope 에 더 이상 사용하지 않는다. 엔진 레벨(노드 실패가 Stop Workflow 로 격상된 경우)에서만 `NodeExecution.error.message` 컨텍스트로 남는다.

> Chat Channel 어댑터의 사용자 안내 메시지 분류는 본 enum 을 입력으로 사용한다 — 분류 표 SoT 는 [`spec/conventions/chat-channel-adapter.md §3.1`](../conventions/chat-channel-adapter.md#31-execution-failed-분류-알고리즘). 본 enum 확장 (예: MCP 도구 카테고리) 시 분류 표 행 추가 검토 의무.

> **W-6 워크스페이스 격리 guard (`WORKFLOW_FORBIDDEN_WORKSPACE`)**: cross-workspace(또는 호출자 컨텍스트 누락) sub-workflow 호출 차단(fail-closed, [workflow §2 W-6](../4-nodes/2-flow/1-workflow.md#2-설정-ui))은 `assertSameWorkspace` 가 typed `WorkflowForbiddenWorkspaceError` 를 throw 하고, Sub-Workflow 핸들러(`mapSubWorkflowError`)가 이를 `ErrorCode.WORKFLOW_FORBIDDEN_WORKSPACE` 로 매핑해 error 포트(`output.error.code`)에 surface 한다. (코드 명명·등재 원칙: [`conventions/error-codes.md`](../conventions/error-codes.md).)

> **큐 대기 초과 — `cancelled` 귀결 (위 failed 표와 구분)**: `EXECUTION_QUEUE_WAIT_TIMEOUT` — 동시 실행 cap 으로 intake 큐에서 대기하던 Execution 이 5분(env `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`, 기본 `300000`ms) 초과 시 Execution `cancelled` + `error.code='EXECUTION_QUEUE_WAIT_TIMEOUT'`. 노드 실행이 **시작되지 않은 시스템 취소**라 `failed` 가 아니라 `cancelled`(`cancelledBy='timeout'`)로 종결한다 — 아래 §1.5 `RESUME_*` 와 같은 cancelled 귀결 그룹. **PR2b(정책 정의, enforcement 후속)**. [4-execution-engine §8](./4-execution-engine.md#8-동시-실행-제한) / [WS Protocol §4.1](./6-websocket-protocol.md#41-실행-이벤트-server--client).

### 1.5 WS commands 에러 코드 (도메인 spec 참조)

다음 에러 코드는 주로 WebSocket ack 응답 전용이다. 일부 코드(`SERVER_SHUTTING_DOWN`·`EXECUTION_ENQUEUE_FAILED`)는 REST 실행 제어 진입점에서 HTTP **503** 으로도 표기된다 — 행별로 명시한다 (설계 원칙: [실행 엔진 §Rationale](./4-execution-engine.md#rationale) 의 `SERVER_SHUTTING_DOWN` 503 선례). 각 코드의 정의·트리거 조건·적용 명령 범위는 해당 도메인 spec 이 SoT 이고, 본 §1.5 는 공용 카탈로그 가시성을 위한 등재 목적이다.

| 코드 | 설명 | 도메인 SoT |
|------|------|-----------|
| `INVALID_EXECUTION_STATE` | 실행이 기대 상태가 아님 (`waiting_for_input` 또는 `failed` 기대). 동기 ack 응답 — BullMQ enqueue 시도 없음 | [WS Protocol §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server) / [실행 엔진 §7.5.1](./4-execution-engine.md#751-publisher-측-사전-검증--invalid_execution_state) |
| `RESUME_CHECKPOINT_MISSING` | rehydration 시 `NodeExecution.outputData` 부재 또는 손상. Execution `cancelled` 로 종결 | [WS Protocol §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server) / [실행 엔진 §7.5](./4-execution-engine.md#75-resume-after-restart-rehydration) |
| `RESUME_FAILED` | continuation-queue `RESUME_BULLMQ_ATTEMPTS` 소진. Execution `cancelled` 로 종결 | [WS Protocol §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server) / [실행 엔진 §7.5](./4-execution-engine.md#75-resume-after-restart-rehydration) |
| `RESUME_INCOMPATIBLE_STATE` | Multi-turn AI 의 `_resumeCheckpoint` 가 부재(기능 배포 이전 진입한 waiting row)·손상(schema drift 로 재구성 실패)·미래 버전(`schemaVersion` 이 현재 코드 지원 버전 초과 — 롤링 배포 중 구 인스턴스가 신 포맷 pickup). Execution `cancelled` 로 종결 — 채널은 graceful "세션 만료" 안내. **정상 경로(checkpoint 존재 + 버전 호환)는 재구성 재개되어 미발생** | [WS Protocol §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server) / [실행 엔진 §7.5](./4-execution-engine.md#75-resume-after-restart-rehydration) |
| `SERVER_SHUTTING_DOWN` | 서버 SIGTERM 수신 후 새 Execution 시작 불가. HTTP 진입점은 503 으로 표기 ([실행 엔진 §11](./4-execution-engine.md#11-graceful-shutdown)) | [실행 엔진 §11](./4-execution-engine.md#11-graceful-shutdown) |
| `EXECUTION_MESSAGE_TOO_LONG` | `submit_message` 의 메시지가 최대 길이 초과 (publisher 측 동기 검증, typed `MessageTooLongError`) | [WS Protocol §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server) / [실행 엔진 §7.5.2](./4-execution-engine.md#752-continuation-ack-에러-표면--typed-executionerror-와-내부-메시지-누출-차단) |
| `EXECUTION_INTERNAL_ERROR` | continuation 처리 중 typed `ExecutionError` 가 아닌 내부 에러의 generic fallback. ack `error` 는 고정 generic 문자열이며 내부 message 는 client 미전달(서버 로그 전용) — 누출 차단 게이트 | [WS Protocol §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server) / [실행 엔진 §7.5.2](./4-execution-engine.md#752-continuation-ack-에러-표면--typed-executionerror-와-내부-메시지-누출-차단) |
| `EXECUTION_ENQUEUE_FAILED` | REST `POST /executions/:id/stop` 의 WAITING cancel 경로에서 continuation publish(BullMQ `queue.add`) 자체가 실패한 케이스 — `publish` 가 `queued:false`(Redis 장애 등 **enqueue 미진입**)를 반환. HTTP 진입점은 **503** 으로 표기하고 Execution 은 `waiting_for_input` 유지(failed 아님), 재시도 권장. `SERVER_SHUTTING_DOWN` 503 선례와 동형이며, worker 측 **비동기** 실패(`RESUME_*` — enqueue 수락 후 재개 실패)와 구별된다 | [실행 엔진 §7.4](./4-execution-engine.md#74-분산-실행-multi-instance) |

> `INVALID_EXECUTION_STATE` 와 동일 의미의 REST 코드는 §1.3 의 `INVALID_STATE` (422) — 두 layer 의 routing 분기 가시성을 위해 의도적으로 분리. 상세: [실행 엔진 §7.5.1](./4-execution-engine.md#751-publisher-측-사전-검증--invalid_execution_state).

### 1.6 EIA REST 외부 표면 에러 코드 (도메인 spec 참조)

다음 에러 코드는 **External Interaction API**(`/api/external/*`) 전용이며, 외부 호출자 표면이라 API 규약 기본값(§1.3 / [API 컨벤션 §5.3](./2-api-convention.md#53-에러-응답))을 **의도적으로 override** 한다. 정의·status·트리거 조건의 SoT 는 [EIA §5.1 에러 표](./14-external-interaction-api.md)이고, 본 §1.6 은 공용 카탈로그 가시성을 위한 등재다.

| 코드 | status | 설명 | 비고 |
|------|--------|------|------|
| `INVALID_COMMAND` | 400 | 지원하지 않는 command 또는 필수 필드 누락 | API 규약 400 기본 `VALIDATION_ERROR` 대신 명령 분기 전용 |
| `MESSAGE_TOO_LONG` | 400 | `submit_message` 메시지 최대 길이 초과. WS 평면 ack `EXECUTION_MESSAGE_TOO_LONG`(§1.5)과 동일 의미를 REST layer 코드로 표기 ([EIA §R13](./14-external-interaction-api.md)) | 내부 길이 수치 미노출 |
| `STATE_MISMATCH` | 409 | continuation 명령이 현재 노드/실행 상태와 불일치. WS `INVALID_EXECUTION_STATE`·REST core `INVALID_STATE`(422)와 동형(§1.3·§1.5) | publisher 측 사전 검증 |
| `IDEMPOTENCY_KEY_CONFLICT` | 409 | 같은 `Idempotency-Key` + 다른 body | |
| `EXECUTION_TERMINATED` | 410 | execution 이 이미 completed/failed/cancelled | |
| `TOKEN_REVOKED` / `TOKEN_SCOPE_MISMATCH` / `TOKEN_AUDIENCE_MISMATCH` | 401 | interaction token(`iext_*`/`itk_*`) 실패. 모든 토큰류 실패는 **단일 401**(§8.2 정보 노출 최소화, [EIA §R14](./14-external-interaction-api.md)). §1.2 의 워크스페이스 JWT 계층 `TOKEN_INVALID`/`TOKEN_EXPIRED` 와 같은 문자열이나 진입점(`/api/external/*`)·토큰 family 로 레이어 구분 | revoke = terminal 시 즉시 무효화(at-least-once, EIA §3.4 EIA-RL-06) |
| `TOO_MANY_CONNECTIONS` | 429 | execution 당 SSE 동시연결 상한 초과 (§8.4). API 규약 429 기본 `RATE_LIMITED` 와 별개의 EIA-SSE 전용 코드 | |

> `VALIDATION_ERROR`(submit_form field 검증)·`EXECUTION_NOT_FOUND`(404)·`TOKEN_INVALID`/`TOKEN_EXPIRED`(401)는 API 규약/§1.2~§1.3 표준 코드를 그대로 재사용한다(EIA 전용 아님).

### 1.7 Webhook 수신 에러 코드 (도메인 spec 참조)

다음 코드는 Webhook 수신 엔드포인트(`POST /api/hooks/:endpointPath`) 전용이다. 정의·트리거 조건의 SoT 는 [Spec Webhook](./12-webhook.md)이고, 본 §1.7 은 공용 카탈로그 가시성을 위한 등재다. 모두 `UPPER_SNAKE_CASE` 규약([conventions/error-codes.md](../conventions/error-codes.md))을 따른다.

| 코드 | status | 설명 | 상태 |
|------|--------|------|------|
| `INVALID_WEBHOOK_PAYLOAD` | 400 | required 트리거 파라미터 누락·타입 강제 변환 실패. API 규약 400 기본 `VALIDATION_ERROR` 대신 webhook 도메인 특화 override ([Spec Webhook §5.2](./12-webhook.md#52-400-응답-형식)) | 구현 |
| `PUBLIC_WEBHOOK_RATE_LIMIT` | 429 | 공개 webhook(`auth_config_id IS NULL`) IP 단위(또는 IP 미식별 시 공유 버킷 `UNIDENTIFIED_IP_BUCKET`) 분당 시작 한도 초과 (`PublicWebhookThrottleGuard`, 기본 분당 10) ([Spec Webhook §6](./12-webhook.md#6-구현-파일-구조)) | 구현 |
| `PUBLIC_WEBHOOK_HOURLY_LIMIT` | 429 | 공개 webhook IP 단위(또는 IP 미식별 시 공유 버킷) 시간당 누적 신규 상한 초과 (`PublicWebhookThrottleGuard`/`PublicWebhookQuotaService`, 기본 20) ([Spec Webhook §6](./12-webhook.md#6-구현-파일-구조)) | 구현 |
| `PUBLIC_WEBHOOK_BODY_TOO_LARGE` | 413 | 공개 webhook(`auth_config_id IS NULL`) 요청 본문이 32KB(`DEFAULT_MAX_BODY_BYTES`, config `publicWebhook.maxBodyBytes`) 초과 (`PublicWebhookThrottleGuard`) ([Spec Webhook §8](./12-webhook.md#8-보안-고려사항)) | 구현 |
| `AUTH_FAILED` | 401 | webhook 인증 실패 — type 무관 단일 응답(enumeration·정보 노출 차단, [Spec Webhook §4](./12-webhook.md#4-인증-방식)). `is_active=false` AuthConfig·서명/토큰 불일치·`ip_whitelist` 불일치 모두 동일 코드 ([WH-SC-04·WH-SC-09](./12-webhook.md#인증-및-보안)) | 구현 |

> **`error.details[].code` (필드별 사유, 구현)**: `MISSING_REQUIRED_FIELD`(required 파라미터 누락)·`TYPE_COERCION_FAILED`(선언 타입으로 coerce 불가)·`INVALID_SCHEMA`(스키마 구조 위반)는 `INVALID_WEBHOOK_PAYLOAD` 봉투의 `details[]` 항목 코드다. 내부 분류 문자열(`missing_required`/`coerce_failed`/`invalid_schema`)을 `toTriggerParameterErrorDetails`(`execution-engine/types/trigger-parameter.types.ts`)가 위 public field code 로 정규화해 throw 하고 `GlobalExceptionFilter` 가 `details` 를 봉투로 전달한다 — [Spec Webhook §5.2](./12-webhook.md#52-400-응답-형식). Manual 실행 경로의 `INVALID_TRIGGER_PARAMETERS` 도 동일 헬퍼를 쓴다. §2.1 의 generic `details[].code`(`INVALID_FIELD`)와 동일 레이어다.

---

## 2. 에러 응답 형식

### 2.1 기본 형식

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input validation failed",
    "details": [
      {
        "field": "name",
        "message": "name should not be empty",
        "code": "INVALID_FIELD"
      },
      {
        "field": "nodes[3].type",
        "message": "type must be a string",
        "code": "INVALID_FIELD"
      }
    ],
    "requestId": "req_abc123"
  }
}
```

> 현재 구현(`common/pipes/validation.pipe.ts` `CustomValidationPipe`)은 `message` 로 고정 문자열 `"Input validation failed"`, `details[].message` 로 class-validator constraint 원문(영문), `details[].code` 로 단일 값 `"INVALID_FIELD"` 만 방출한다. `details[].field` 는 중첩/배열 경로를 `nodes[3].type` 형식으로 유지한다. 위 표의 사용자향 한국어 메시지·세분화 코드(`REQUIRED`/`INVALID_FORMAT`)는 **계획(Planned)** 이며 미구현이다.

### 2.2 실행 에러 형식

```json
{
  "error": {
    "code": "LLM_TIMEOUT",
    "message": "Node 'AI Agent' failed: LLM connection timeout",
    "nodeId": "uuid-of-node",
    "nodeName": "AI Agent",
    "nodeType": "ai_agent",
    "executionId": "uuid-of-execution",
    "stack": "...",
    "requestId": "req_abc123"
  }
}
```

---

## 3. 노드 에러 처리 정책

개별 노드 설정에서 지정하는 에러 처리 방식. ([Spec 노드 공통](../3-workflow-editor/1-node-common.md#24-에러-처리-정책) 참조)

### 3.1 정책별 동작

```
[실행 중] → [노드 에러 발생]
                │
                ├─ Stop Workflow (기본)
                │   → Execution.status = "failed"
                │   → 에러 노드 하이라이트
                │   → 이후 노드 미실행
                │
                ├─ Skip Node
                │   → NodeExecution.status = "skipped"
                │   → NodeExecution.error = { message: "..." } (에러 정보 보존)
                │   → 출력 = null
                │   → 다음 노드는 null 입력으로 실행
                │
                ├─ Use Default Output
                │   → NodeExecution.status = "completed" (경고 포함)
                │   → 출력 = 미리 설정된 기본값
                │   → 다음 노드는 기본값으로 실행
                │
                ├─ Retry
                │   → 재시도 (maxRetries, retryInterval)
                │   → 모든 재시도 실패 시 Stop Workflow
                │
                └─ Route to Error Port
                    → 에러 데이터를 error 포트로 전달
                    → 연결된 다음 노드가 에러 데이터를 입력으로 실행
                    → error 포트에 엣지가 없으면 Stop Workflow 폴백
```

### 3.2 Route to Error Port 상세

노드 핸들러가 **런타임 실패**를 `port: 'error'` 로 라우팅할 때의 통일된 envelope 규격 (CONVENTIONS §3.2). Pre-flight(config) 에러는 이 envelope 으로 래핑하지 않고 그대로 throw 되어 Execution 전체를 `failed` 로 전이시킨다.

```json
{
  "config": { /* 해석된 노드 config echo (credentials 제외) */ },
  "output": {
    "error": {
      "code": "HTTP_5XX",
      "message": "HTTP 502 Bad Gateway",
      "details": { "statusCode": 502, "url": "https://api.example.com/data", "method": "GET" }
    }
  },
  "meta": { "durationMs": 812, "statusCode": 502 },
  "port": "error",
  "status": "ended"
}
```

**필드 정의** (`NodeHandlerOutput.output.error`):

| 필드 | 타입 | 설명 |
|------|------|------|
| code | String | UPPER_SNAKE_CASE 에러 코드 (`codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 참조). 코드 **명명 규율**(의미 기반 명명·rename 안정성·historical-artifact 예외)의 SoT 는 [`conventions/error-codes.md`](../conventions/error-codes.md) — 본 문서는 표기(`UPPER_SNAKE_CASE`)·카탈로그·envelope 만 정의한다 |
| message | String | 사람이 읽을 수 있는 에러 메시지 (국제화 없음) |
| details | Object? | 노드별 부가 정보 — stack / originalInput / attempts / missingFields 등. JSON 직렬화 가능해야 함 |

**LLM 계열 노드의 특이 케이스** — `max_retries` / `max_turns` 같은 부분 성공 시나리오에서는 `output.error` 와 `output.result` 가 **공존** 한다. `output.error` 존재 여부로 에러/정상 분기를 판정하고, 부분 수집된 결과는 `output.result` 에서 소비한다.

**대표 에러 코드** (후속 PR 에서 enum 확장):

| 노드 카테고리 | 코드 |
|----------------|------|
| HTTP | `HTTP_TRANSPORT_FAILED`, `HTTP_4XX`, `HTTP_5XX`, `HTTP_TIMEOUT`(미발행 — §1.4 註), `HTTP_BLOCKED` |
| Database | `DB_QUERY_FAILED`, `DB_CONNECTION_ERROR`, `DB_CONSTRAINT_VIOLATION`, `DB_PERMISSION_DENIED`, `DB_HOST_BLOCKED` |
| Email | `EMAIL_SEND_FAILED` |
| LLM | `LLM_CALL_FAILED`, `LLM_RATE_LIMIT`, `LLM_RESPONSE_INVALID`, `LLM_TIMEOUT`, `MAX_COLLECTION_RETRIES_EXCEEDED` |
| Code | `CODE_EXECUTION_FAILED`, `CODE_TIMEOUT`, `CODE_MEMORY_LIMIT` |
| Sub-workflow | `SUB_WORKFLOW_FAILED` · `SUB_WORKFLOW_NOT_FOUND` · `SUB_WORKFLOW_TIMEOUT` · `SUB_WORKFLOW_QUEUE_FAILED` · `WORKFLOW_FORBIDDEN_WORKSPACE` (분기 매핑 SoT [workflow §6](../4-nodes/2-flow/1-workflow.md#6-에러-코드)) |

**에러 포트 보유 노드** (기본):

`http_request`, `database_query`, `send_email`, `code`, `ai_agent`, `text_classifier`, `information_extractor`, `workflow`.

`transform`, `if_else`, `switch` 등은 pre-flight 검증만 수행 → throw (런타임 에러 포트 없음).

**동작 규칙:**
- error 포트에 엣지가 연결되어 있으면 → `output.error` 를 포함한 `output` 전체를 해당 엣지로 전달, 다음 노드 실행
- error 포트에 엣지가 없으면 → `ERROR_PORT_FALLBACK` 에러 로깅 후 Stop Workflow 폴백
- NodeExecution.status 는 `failed` 로 기록하되, Execution 은 계속 진행
- 다운스트림 노드는 `$node["X"].output.error?.code` 로 분기하거나 `$node["X"].port === 'error'` 로 판정

### 3.3 Retry 설정

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| maxRetries | Integer | 3 | 최대 재시도 횟수 |
| retryInterval | Integer | 1000 | 재시도 간격 (ms) |
| backoffMultiplier | Float | 2.0 | 지수 백오프 배수 |
| maxInterval | Integer | 30000 | 최대 재시도 간격 (ms) — **계획(Planned), 미구현**: 현재 `RetryConfig`(`execution-engine/error/error-policy.handler.ts`)는 이 필드를 두지 않으며 백오프 간격에 상한 클램프가 없다 |

> 위 필드는 `config.errorHandling.retryConfig.*` 경로에 저장된다 (설정 패널 SoT: [Spec 노드 공통 §2.4](../3-workflow-editor/1-node-common.md#24-에러-처리-정책)).

**재시도 간격 계산** (현재 구현 — 상한 클램프 없음):
```
interval = retryInterval × backoffMultiplier^attempt
```

> `maxInterval` 클램프(`min(..., maxInterval)`)는 **계획**이다. 현재 `error-policy.handler.ts` 와 `execution-engine.service.ts` 의 retry 경로 모두 무제한으로 증가하는 지수 백오프를 사용한다.

---

## 4. 자동 재시도 정책 (워크플로우 레벨)

트리거/스케줄에 의한 자동 실행 시 워크플로우 레벨 재시도.

| 항목 | 설명 |
|------|------|
| 적용 대상 | Trigger/Schedule에 의한 자동 실행만 (수동 실행 제외) |
| 재시도 횟수 | 워크플로우 설정에서 지정 (기본: 0, 최대: 5) |
| 재시도 간격 | 고정 또는 지수 백오프 |
| 재시도 대상 에러 | 시스템 에러, Integration 에러, 타임아웃만 재시도 (유효성 에러는 재시도하지 않음) |

---

## 5. 클라이언트 에러 처리

### 5.1 API 에러 처리 흐름

```
API 호출 → 응답 확인
  │
  ├─ 200/201/204 → 정상 처리
  │
  ├─ 400 → 유효성 에러 표시 (필드별 에러 메시지)
  │
  ├─ 401 → 토큰 갱신 시도
  │   ├─ 갱신 성공 → 원래 요청 재시도
  │   └─ 갱신 실패 → 로그인 페이지 이동
  │
  ├─ 403 → "권한이 없습니다" 토스트
  │
  ├─ 404 → "리소스를 찾을 수 없습니다" 토스트 또는 404 페이지
  │
  ├─ 409 → 충돌 해결 안내 (예: 이름 변경)
  │
  ├─ 429 → "요청이 너무 많습니다" 토스트 + Retry-After 후 자동 재시도
  │
  └─ 500 → "서버 오류가 발생했습니다" 토스트 + 에러 리포트 옵션
```

### 5.2 토스트 알림

| 유형 | 스타일 | 자동 닫힘 |
|------|--------|-----------|
| 성공 | 초록 | 3초 |
| 정보 | 파랑 | 5초 |
| 경고 | 노랑 | 수동 닫기 |
| 에러 | 빨강 | 수동 닫기 |

---

## 6. 로깅 정책

### 6.1 로그 레벨

| 레벨 | 용도 |
|------|------|
| ERROR | 시스템 에러, 미처리 예외 |
| WARN | 비정상적이지만 복구 가능한 상황 (재시도, 폴백) |
| INFO | 주요 비즈니스 이벤트 (실행 시작/완료, 로그인) |
| DEBUG | 상세 디버깅 (요청/응답 데이터, 쿼리) |

### 6.2 로그 형식

```json
{
  "timestamp": "2026-03-26T12:00:00.000Z",
  "level": "ERROR",
  "service": "execution-engine",
  "message": "Node execution failed",
  "requestId": "req_abc123",
  "userId": "uuid",
  "workspaceId": "uuid",
  "context": {
    "workflowId": "uuid",
    "executionId": "uuid",
    "nodeId": "uuid",
    "error": "Connection timeout"
  }
}
```

### 6.3 민감 정보 마스킹

로그에 다음 정보가 포함되지 않도록 자동 마스킹:
- API Key, Bearer Token, 비밀번호
- OAuth 토큰
- 개인 식별 정보 (이메일은 부분 마스킹: `g***@example.com`)

---

## 7. 헬스 체크

### 7.1 엔드포인트

```
GET /api/health
```

### 7.2 응답

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 86400,
  "checks": {
    "database": { "status": "healthy", "latency": 5 },
    "redis": { "status": "healthy", "latency": 2 }
  }
}
```

현재 구현(`modules/health/health.service.ts` `HealthService.check()`)은 **database 와 redis 두 항목만** 점검한다. 전체 `status` 는 **binary** 이며 두 항목 중 하나라도 비정상이면 `unhealthy` 다.

| 전체 상태 | 조건 |
|-----------|------|
| `healthy` | database·redis 두 checks 모두 healthy |
| `unhealthy` | database 또는 redis 비정상 — Redis config 누락 시 redis 체크는 `unconfigured` 로 표기되고 전체 status 는 `unhealthy` 로 내려 미구성 상태를 외부 모니터가 감지하게 한다 |

> **계획(Planned)**: `vectorDb` 체크 항목과 `degraded`(비필수 checks 일부 실패) 3-state 어휘는 아직 미구현이다. 현재는 database·redis(필수)만 점검하는 binary 판정이다.

> **참고 — probe 역할 분리 (구 "liveness probe 용" 결정 번복)**: 초기에는 `/api/health` 하나를
> liveness probe 용으로 썼으나, 현재는 **readiness probe 전용**으로 재정의한다. 의존성 점검 결과를 HTTP
> status code 로도 신호하며 — 전체 `status === 'healthy'` → **200**, 그 외(`unhealthy`/redis `unconfigured`)
> → **503** — 503 일 때도 위 응답 body(`{ status, version, uptime, checks }`)는 그대로 유지된다(body 의
> `status` 어휘는 여전히 binary `healthy|unhealthy`). liveness probe 는 의존성을 점검하지 않고 프로세스
> 생존만 확인하는 신규 엔드포인트 **`/api/health/live`**(항상 200)를 쓴다. HTTP status code·probe 역할 분리의
> 단일 진실(SoT)은 [`data-flow/9-observability.md §1.1`](../data-flow/9-observability.md#11-health-check) 다.
>
> 큐 적체 상태를 보여주는 시스템 상태 API(`/api/system-status/overview`)는 "처리 중이나 적체(degraded)" 와
> "처리 정지(down)" 를 구분할 가치가 있어 별도 어휘 `healthy/degraded/down` 을 사용한다 — 근거는
> [16-system-status-api.md Rationale R-4](./16-system-status-api.md#r-4-health-어휘를-healthydegradeddown-으로-둔-이유).

## Rationale

- **`MODEL_CONFIG_NOT_FOUND`(404) 와 `MODEL_CONFIG_DEFAULT_MISSING`(400) 분리 (PR4b)**: 구 단일 코드는
  id 지정 경로의 "지정 config 부재"(404)와 id 미지정 경로의 "워크스페이스 default 미설정"(400)을 한
  코드로 묶어 동일 코드가 404/400 두 status 를 갖는 모호성이 있었다. id 경로는 `MODEL_CONFIG_NOT_FOUND`(404,
  존재 누설 방지 — cross-kind 접근도 동일 코드)로 한정하고, default 미설정은 setup 을 안내하는 별도
  `MODEL_CONFIG_DEFAULT_MISSING`(400)로 분리해 status 일관성과 클라이언트 분기 명확성을 확보했다.
  `resolveEmbedding` 의 ws-default 부재는 `MODEL_CONFIG_DEFAULT_MISSING`(400) 이 아닌 `MODEL_CONFIG_NOT_FOUND`(404)
  를 유지한다. KB 임베딩 해석 실패는 "setup 미완료 안내"가 아니라 "이 자원을 현재 resolve 할 수 없음" 으로
  취급하는 것이 의미적으로 더 정확하기 때문이다. setup 안내(400, `MODEL_CONFIG_DEFAULT_MISSING`)는 chat/LLM
  default 경로(`resolveConfig`)에서만 발행한다 (사용자 결정 2026-06-12).
- **413 `PAYLOAD_TOO_LARGE`(전역) 와 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(도메인) 공존**: 둘 다 413 이나
  발행 레이어·임계가 다르다. `PAYLOAD_TOO_LARGE`(§1.3)는 **body-parser 레이어**의 전역 표준 코드로,
  본문이 라우트 한도(전역 100KB·`/api/hooks/*` 1MB)를 넘으면 `GlobalExceptionFilter` 가 발행한다 — 모든
  라우트 공통. `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(§1.7)는 **공개 webhook 전용 도메인 Guard**
  (`PublicWebhookThrottleGuard`)가 파싱 후 32KB 보수 한도로 추가 제한할 때만 발행한다. 즉 일반 신규 코드는
  전역 `PAYLOAD_TOO_LARGE` 를 쓰고, 도메인 특화 한도가 있을 때만 별도 코드를 신설한다 ([Spec Webhook WH-NF-02](./12-webhook.md#비기능-요구사항)).
- **4xx http-error `message` 고정 문구 — CWE-209 방지**: body-parser 등 http-errors 미들웨어가 던지는
  4xx 오류(예: 413 `request entity too large`)는 `GlobalExceptionFilter` 가 **내부 원문을 echo 하지 않고**
  상태 기반 고정 문구(413 → `"Request payload too large."`, 그 외 4xx → `"The request could not be
  processed."`)로 직렬화한다. 라이브러리 원문에는 경로·버퍼 한계·미들웨어 힌트 등 구현 세부가 섞일 수
  있어 그대로 노출하면 정보 누출(CWE-209)이 된다. 운영 가시성은 원문을 `logger.warn` 으로만 남겨 확보한다
  (클라이언트 응답과 분리). 이는 WebSocket `EXECUTION_INTERNAL_ERROR` 의 고정 문구 결정(내부 예외 message
  비노출)과 동일한 원칙이며, 5xx 마스킹(generic 500)과 일관된다.
