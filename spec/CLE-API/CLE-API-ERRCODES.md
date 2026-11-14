---
id: "CLE-API-ERRCODES"
title: "에러 코드 규약과 카탈로그"
type: "convention"
version: 37
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API"
ancestors: ["CLE-VISION", "CLE-API"]
area: "CLE-API"
content_hash: "98e893007047d0867861c8d5eb8645f839eacc7e077f687ecd67ccd792a3f227"
read_as: "approved_fallback"
task: "CLE-T-9KCQ7Y"
source_paths: ["spec/5-system/3-error-handling.md", "spec/conventions/error-codes.md"]
mirror_sha256: "c6dd12e9aab6d3f931bb7579772a5e48f44c04ad0022f404eb72b0b5d77fdfc5"
etag: "sha256-0847ffc1ed1bb99e4ef54846a8f275bcc4391cb45747970b6f2b6b920a8cdb67"
---
> 구현 상태: 부분 구현 (LLM 세분화 코드 `LLM_AUTH_ERROR` · `LLM_MODEL_NOT_FOUND` · `LLM_CONTEXT_EXCEEDED` 는 미구현) · 원문: `spec/conventions/error-codes.md`, `spec/5-system/3-error-handling.md` (§1, Rationale 일부) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 에러 코드(error code, `error.code`)의 이름 규칙과 안정성 규율, 그리고 제품 전체의 에러 코드 카탈로그를 정한다. 이름 규칙(규칙 1~3)을 따르지 않지만 호환 때문에 유지하는 예외 등록 코드(historical artifact)와 더 이상 내보내지 않는 은퇴 코드(retired code)의 기록도 이 문서에 둔다.

**적용 범위**: 이 규율은 `ErrorCode` const 뿐 아니라 프로젝트 전체의 에러 코드 문자열에 적용한다. API·통합·OAuth 등에서 인라인 문자열로 발행하는 코드(`CAFE24_*`, `OAUTH_*` 등)도 포함한다.

**대표 표면은 둘이다.** 같은 파일(`nodes/core/error-codes.ts`)에 `ErrorCode` 와 `EngineErrorCode` 가 자매 const 로 있고 키가 겹치지 않는다(테스트로 고정). 파일 하나에 const 둘이라는 점이 설계의 핵심이다. `EngineErrorCode` 는 엔진만 발행하고 `ErrorCode` 는 주로 노드 핸들러가 쓰지만 엔진도 쓴다(예: `EXECUTION_TIME_LIMIT_EXCEEDED`). 그래서 카탈로그의 "엔진 수준 에러" 부류로 const 소속을 추론하지 않는다.

예외 · 은퇴 기록과 카탈로그 표는 하위 문서가 맡는다(「하위 문서」 절). 이 문서가 정하지 않는 것은 아래 문서가 정한다.

- 에러 응답 봉투, 상태 코드별 기본 코드, `details` 규칙: [에러 응답과 클라이언트 처리](CLE-API-ERROR.md)
- HTTP 상태 코드를 고르는 기준: [HTTP API 규약](CLE-API-CONV.md). 데코레이터로 적는 방법은 [OpenAPI 문서화](CLE-API-SWAGGER.md)
- 노드 출력 `output.error` 의 형태: [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md)
- 각 코드의 발생 조건: 카탈로그 행마다 적은 정의 문서

## 규칙

1. 에러 코드 이름은 조건의 의미(무엇이 잘못됐는가)를 적는다. 어느 코드 경로에서 났는지, 도입 당시의 일시적 범위 같은 구현·역사 정보를 이름에 넣지 않는다.
2. 표기는 `UPPER_SNAKE_CASE` 다. 노드 출력의 `output.error.code` 도 같다. 이 표기를 어긴 코드는 §3 예외 등록부에 있는 것뿐이다.
3. 도메인 범주가 의미 있는 코드는 `<DOMAIN>_<CONDITION>` 으로 묶는 것을 권장한다(`CAFE24_*`, `OAUTH_*`, `INTEGRATION_*`). 시스템 전역 공용 코드는 prefix 없이 쓴다.
4. 클라이언트는 코드의 의미로 분기한다. 이름의 부분 문자열이나 `message` 문자열을 파싱해 분기하지 않는다. 코드의 정의(문서 본문)가 기준이고 이름은 그 정의를 읽히게 하는 라벨이다.
5. 에러 코드 이름 바꾸기는 호환성을 깨는 변경이다. 이름을 더 정확하게 하려는 목적만으로 바꾸지 않는다.
6. 의미가 갈리거나 새 조건이 생기면 새 코드를 만든다. 새 코드는 처음부터 의미가 정확한 이름을 붙여 뒤에 이름을 바꿀 압력을 만들지 않는다. 다만 같은 표면(같은 엔드포인트) 안에서 구분하면 리소스가 다른 워크스페이스에 있다는 것이 드러나는 조건은 같은 코드를 쓴다([`TRIGGER_NOT_FOUND` 를 다른 워크스페이스의 워크플로우에도 쓰는 이유](CLE-API-ERRCODES-TRIGGER.md#trigger_not_found-를-다른-워크스페이스의-워크플로우에도-쓰는-이유-2026-10-05)). 표면이 다르면 같은 뜻도 다른 코드를 쓰는 카탈로그 관행(§6.19 의 `WORKFLOW_NOT_FOUND`)과는 부딪치지 않는다. 이 단서는 한 표면 안의 조건만 묶는다. 비활성 트리거의 `TRIGGER_INACTIVE`(410)와 비활성 워크플로우의 `WORKFLOW_INACTIVE`(410)처럼 다른 워크스페이스 소속이 아닌 상태는 이 단서 밖이다. 이 규칙에는 예외가 하나 있다. 웹훅 인증(§6.10)에서 인증 설정의 기대값이 비었거나 문자열이 아니거나 읽지 못하는 경우와 헤더 이름이 문자열이 아닌 경우는 새 코드를 만들지 않고 `AUTH_FAILED` 를 쓴다. 이 예외는 그 경우에만 쓰고 다른 조건이나 다른 표면으로 넓히지 않는다. 근거는 [웹훅 인증 설정의 기대값이 비었거나 읽지 못해도 `AUTH_FAILED` 를 쓴다](CLE-API-ERRCODES-TRIGGER.md#웹훅-인증-설정의-기대값이-비었거나-읽지-못해도-auth_failed-를-쓴다-2026-10-31) 에 있다.
7. 이름 규칙(규칙 1~3)을 따르지 않지만 유지하는 기존 코드는 §3 예외 등록부에 적는다. 새 코드는 예외를 선례로 삼지 않는다.
8. 발행하는 코드는 모두 §6 카탈로그에 등재한다. 정의·발생 조건이 도메인 문서에 있으면 그 문서를 정의 문서로 적고 카탈로그는 공용 가시성을 위해 등재만 한다.
9. 발행된 적 없는 코드는 등재하지 않는다. 문서 표에만 있고 코드가 한 번도 내지 않은 코드는 이름 바꾸기가 아니라 기록 실수이므로 등재를 지우고 그 자리에 실측을 남긴다. 사람이 정했지만 아직 구현하지 않은 코드는 표에 넣지 않는다. 해당 절의 표 아래 문장에 상태 코드와 조건을 적고 구현 Task 가 있으면 함께 적는다. 발행과 함께 표에 등재한다. 그 코드를 정의하는 영역 문서는 자기 표에 미구현 표시를 붙여 먼저 적을 수 있다.
10. 교체한 옛 코드는 §5 은퇴 코드 표에 흡수 등급과 함께 남긴다.

## 1. 의미 기반 명명

규칙 1 의 예다.

- **의미를 적는다**: `CAFE24_INSTALL_INVALID_HMAC`(HMAC 검증 실패), `INTEGRATION_INCOMPLETE`(통합 미완성), `OAUTH_STATE_MISMATCH`(state 불일치). 이름만으로 분기의 뜻이 드러난다.

**도메인 prefix (규칙 3)**: `VALIDATION_ERROR` 같은 시스템 전역 공용 코드(§6.1, §6.4)는 prefix 없이 쓰는 기존 범주다. 규칙 3 이 공용 코드는 prefix 없이 쓴다고 정했으므로 이름 규칙의 예외가 아니고 §3 에 올리지 않는다.

**prefix 없는 공용 코드 `INVALID_TOOL_ARGUMENTS`**: AI 에이전트의 tool_use 인자 검증 실패 코드([MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md))는 `MCP_` prefix 를 붙이지 않는다. MCP 전용이 아니라 어느 도구 프로바이더든 쓸 수 있는 LLM 인자 검증 범주로 정했기 때문이다(`VALIDATION_ERROR` 와 같은 부류). LLM 이 `tool_result.error` 로 이 값을 보고 다음 턴에 인자를 고치므로 값이 곧 계약이고 이름을 바꾸면 호환만 깨진다. 등재 행은 §6.23 이다. 지금 이 값을 내는 곳은 외부 MCP 서버의 도구 프로바이더(`McpToolProvider`) 하나다. Cafe24 · MakeShop 도구 프로바이더는 인자 JSON 을 해석하지 못하면 `CAFE24_MCP_TOOL_ARGS_INVALID` · `MAKESHOP_MCP_TOOL_ARGS_INVALID` 를, 필수 필드가 비면 `CAFE24_MISSING_FIELDS` · `MAKESHOP_MISSING_FIELDS` 를 낸다(§6.22).

## 2. 안정성과 이름 바꾸기

규칙 5·6 이 정한다. 이름 바꾸기가 호환성을 깨는 이유는 클라이언트가 코드 값으로 분기하기 때문이다. 바꾸면 deprecated 별칭, 이중 발행, 마이그레이션 부담이 생긴다.

## 3. 예외 등록 코드

→ [에러 코드 — 예외 · 내부 분류 · 은퇴 코드](CLE-API-ERRCODES-EXCEPT.md#3-예외-등록-코드). §4 내부 분류 코드의 정규화와 §5 은퇴 코드도 같은 하위 문서에 있다.

## 하위 문서

이 문서는 규칙과 공통 결정을 맡고 예외 · 은퇴 기록과 카탈로그 표는 아래 하위 문서가 맡는다. 이 문서와 하위 문서가 소유한 요구사항 줄은 없다. 하위 문서가 근거로 참조하는 다른 문서의 요구사항만 함께 적는다.

- [예외 · 내부 분류 · 은퇴 코드](CLE-API-ERRCODES-EXCEPT.md): §3 예외 등록 코드, §4 내부 분류 코드의 정규화, §5 은퇴 코드
- [시스템 · 유효성 검증](CLE-API-ERRCODES-SYSVAL.md): §6.1 · §6.4 · §6.11
- [인증 · 인가 · 워크스페이스](CLE-API-ERRCODES-AUTH.md): §6.2 · §6.12 · §6.18. 참조 요구사항(다른 문서 소유): REQ-INTOAUTH-026 · REQ-INTOAUTH-062 · REQ-INTOAUTH-063 · REQ-INTOAUTH-064([OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md))
- [2FA · Passkey · 재인증](CLE-API-ERRCODES-MFA.md): §6.3
- [워크플로우 실행](CLE-API-ERRCODES-EXEC.md): §6.5 · §6.6 · §6.16
- [WebSocket · EIA · Background Runs](CLE-API-ERRCODES-WSEIA.md): §6.7 · §6.8 · §6.9 · §6.24. 참조 요구사항(다른 문서 소유): REQ-CHAT-064([채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md))
- [웹훅 · 트리거 · 채팅 채널](CLE-API-ERRCODES-TRIGGER.md): §6.10 · §6.13 · §6.14 · §6.15 · §6.20
- [LLM 클라이언트 · AI 어시스턴트](CLE-API-ERRCODES-LLM.md): §6.17 · §6.19 · §6.25
- [통합 관리 · OAuth](CLE-API-ERRCODES-INTMGMT.md): §6.21. 참조 요구사항(다른 문서 소유): REQ-INTOAUTH-061 · REQ-INTOAUTH-065([OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md))
- [통합 노드 · MCP](CLE-API-ERRCODES-INTNODE.md): §6.22 · §6.23

절 번호(§3 ~ §6.25)는 하위 문서로 옮긴 뒤에도 그대로 쓴다. 본문의 「§6.x」 는 위 목록에서 맡은 하위 문서를 찾는다.

## 6. 카탈로그

제품 전체의 에러 코드 목록이다. 코드마다 그 코드를 정의하거나 발행하는 문서를 "정의 문서" 열에 적는다. 발생 조건의 상세는 정의 문서가 정하고 이 카탈로그는 제품 전체에서 코드를 찾을 수 있게 등재한다.

**표의 열은 절마다 다르다.** 기본은 `코드 | HTTP | 설명 | 정의 문서` 다. §6.1 은 HTTP 열 대신 `이름` · `사용자 메시지` 열을 둔다. §6.2 는 `이름` 열을 더하고 HTTP 를 설명 뒤에 둔다. §6.4 도 HTTP 를 설명 뒤에 둔다. §6.5 ~ §6.8 에는 HTTP 열이 없다. 실행 상태나 WebSocket 으로 나가는 코드이기 때문이다. §6.25 도 SSE 이벤트로 나가는 코드라 HTTP 열이 없다. HTTP 로도 나가는 행은 설명에 상태 코드를 적는다(§6.7 의 `SERVER_SHUTTING_DOWN` · `EXECUTION_ENQUEUE_FAILED`). 더하는 열은 §6.5 첫 표의 `앵커`, §6.6 의 `부류`, §6.9 의 `비고`, §6.10 의 `상태` 다. §6.13 은 세부 코드(`details.code`)를 행으로 두고 봉투 `code` 와 HTTP 를 한 열에 적는다.

**같은 뜻을 표면마다 다른 코드로 적는다.** 상태 불일치는 REST 핵심 API 가 `INVALID_STATE`(422), WebSocket 이 `INVALID_EXECUTION_STATE`, EIA REST `/interact` 가 `STATE_MISMATCH`(409)다. 메시지 길이 초과도 WebSocket 은 `EXECUTION_MESSAGE_TOO_LONG`, EIA REST 는 `MESSAGE_TOO_LONG` 이다. 라우팅 분기를 드러내려고 일부러 나눴다([큐 워커와 동시 실행 제한 「발행 전 사전 검증」](../CLE-EXEC/CLE-EXEC-WORKER.md#발행-전-사전-검증), [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) 의 「WS 코드와 EIA 코드는 경로마다 다르게 쓴다」 Rationale).

**HTTP 진입점에서만 쓰는 `EXECUTION_ENQUEUE_FAILED` 는 표면마다 나누지 않는다.** REST `stop`, EIA REST `/interact`, 채팅 채널 인바운드의 `/start` 가 이 503 을 같은 코드로 낸다(§6.7). 세 진입점 모두 재개 메시지를 큐에 넣지 못했다는 같은 뜻이다. 클라이언트가 할 일도 다시 보내기 하나다. 이 코드는 실행 엔진 사전 검증의 결과가 아니라 큐 상태를 알린다. 그래서 위에서 표면마다 나눈 코드와 부류가 다르다. 같은 503 선례인 `SERVER_SHUTTING_DOWN`(§6.7)은 REST 의 실행 시작 진입점만 낸다. 근거는 [`EXECUTION_ENQUEUE_FAILED` 를 EIA `/interact` 재개 명령에도 쓴다](CLE-API-ERRCODES-WSEIA.md#execution_enqueue_failed-를-eia-interact-재개-명령에도-쓴다-2026-10-09) Rationale 에 있다.

다른 문서가 절 앵커로 가리키는 절은 아래에 제목을 남기고 하위 문서로 잇는다. 나머지 절은 「하위 문서」 절의 목록에서 찾는다.

### 6.4 유효성 검증

→ [에러 코드 카탈로그 — 시스템 · 유효성 검증](CLE-API-ERRCODES-SYSVAL.md#64-유효성-검증)

### 6.5 워크플로우 실행: 엔진 수준

→ [에러 코드 카탈로그 — 워크플로우 실행](CLE-API-ERRCODES-EXEC.md#65-워크플로우-실행-엔진-수준)

### 6.6 워크플로우 실행: 노드 수준 런타임

→ [에러 코드 카탈로그 — 워크플로우 실행](CLE-API-ERRCODES-EXEC.md#66-워크플로우-실행-노드-수준-런타임)

### 6.7 WebSocket 명령: 재개 명령과 마지막 턴 재시도 (도메인 문서 참조)

→ [에러 코드 카탈로그 — WebSocket · EIA · Background Runs](CLE-API-ERRCODES-WSEIA.md#67-websocket-명령-재개-명령과-마지막-턴-재시도-도메인-문서-참조)

### 6.8 WebSocket 전송 (도메인 문서 참조)

→ [에러 코드 카탈로그 — WebSocket · EIA · Background Runs](CLE-API-ERRCODES-WSEIA.md#68-websocket-전송-도메인-문서-참조)

### 6.9 EIA REST 외부 표면 (도메인 문서 참조)

→ [에러 코드 카탈로그 — WebSocket · EIA · Background Runs](CLE-API-ERRCODES-WSEIA.md#69-eia-rest-외부-표면-도메인-문서-참조)

### 6.14 트리거 인증 설정 연결 (도메인 문서 참조)

→ [에러 코드 카탈로그 — 웹훅 · 트리거 · 채팅 채널](CLE-API-ERRCODES-TRIGGER.md#614-트리거-인증-설정-연결-도메인-문서-참조)

### 6.15 채팅 채널 봇 토큰 재발급 (도메인 문서 참조)

→ [에러 코드 카탈로그 — 웹훅 · 트리거 · 채팅 채널](CLE-API-ERRCODES-TRIGGER.md#615-채팅-채널-봇-토큰-재발급-도메인-문서-참조)

### 6.17 LLM 클라이언트 (도메인 문서 참조)

→ [에러 코드 카탈로그 — LLM 클라이언트 · AI 어시스턴트](CLE-API-ERRCODES-LLM.md#617-llm-클라이언트-도메인-문서-참조)

### 6.19 AI 어시스턴트 세션 API (도메인 문서 참조)

→ [에러 코드 카탈로그 — LLM 클라이언트 · AI 어시스턴트](CLE-API-ERRCODES-LLM.md#619-ai-어시스턴트-세션-api-도메인-문서-참조)

### 6.22 통합 노드 (도메인 문서 참조)

→ [에러 코드 카탈로그 — 통합 노드 · MCP](CLE-API-ERRCODES-INTNODE.md#622-통합-노드-도메인-문서-참조)

### 6.25 AI 어시스턴트 스트림 (도메인 문서 참조)

→ [에러 코드 카탈로그 — LLM 클라이언트 · AI 어시스턴트](CLE-API-ERRCODES-LLM.md#625-ai-어시스턴트-스트림-도메인-문서-참조)

## 미결 사항

- **발행처가 없는 등재 코드**: `DATABASE_ERROR`(§6.1)는 백엔드에서 발행처가 확인되지 않는다(grep 0건). 초대 흐름의 소문자 `rate_limited`(§3)도 백엔드·프론트엔드 소스에 문자열이 0건이다. 초대 한도는 `@Throttle` 로 걸리고 전역 필터가 429 를 `RATE_LIMITED` 로 바꾼다([HTTP API 규약](CLE-API-CONV.md)). 초대 에러 표에서 뺄지는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#미결-사항) 의 같은 미결과 함께 정한다. 규칙 9 는 발행된 적 없는 코드의 등재를 지우라고 정하지만 이 판단은 코드 실측에 기대므로 등재를 지울지 결정이 필요하다. `INTERACTION_TIMEOUT`(§6.7)도 `error-codes.ts` 에 정의만 있고 발행처가 없다(2026-11-12 grep 0건). [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) 의 재개 명령 에러 표에도 있어 함께 정한다. 정리는 NERV Task `CLE-T-8WXV7T` 에서 한다.
- **어시스턴트 스트림 코드의 프로바이더 분기**: §6.25 의 코드에는 규칙과 맞지 않는 점이 두 가지 있다. 규칙 4 와는 같은 429 와 SDK 요청 타임아웃이 프로바이더에 따라 다른 코드로 나가는 점이 어긋난다(429 는 Anthropic·Google 이면 `LLM_RATE_LIMIT`, OpenAI 계열이면 `ASSISTANT_STREAM_FAILED`). 규칙 6 과는 `ASSISTANT_STREAM_FAILED` 한 코드가 429 · SDK 타임아웃 · 모델 설정 조회 실패 · 서비스 내부 실패를 함께 담는 점이 어긋난다. 프로바이더 분기를 통일할지는 NERV Task `CLE-T-0R5SYN` 이 정한다.
- **비밀번호 재설정 실패의 두 원인**: `POST /api/auth/reset-password` 는 토큰 무효 · 만료와 새 비밀번호 규칙 위반을 모두 400 `VALIDATION_ERROR` 로 돌려준다. 원인이 갈리면 코드로 가르는 규칙 4 · 6 과 맞지 않는다. 코드를 나눌지는 NERV Task `CLE-T-DTVTM9` 에서 정한다([가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) 「미결 사항」).
- **`LLM_TIMEOUT` 의 등재**: 2026-10-10 에 LLM 타임아웃을 이 코드로 내지 않기로 정했고 [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md) 의 약속도 거뒀다(§6.6). 남은 것은 `HTTP_TIMEOUT` 처럼 enum 에 남길지, 규칙 9 에 따라 등재를 지울지다. 정리는 NERV Task `CLE-T-8WXV7T` 가 다른 미발행 코드와 함께 한다. [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) §3.2 예시와 [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md) 분류 표의 행도 그때 함께 정리한다.
- **`RECURSION_DEPTH_EXCEEDED` 의 발행 형태**: 카탈로그는 이 코드를 등재하지만 [워크플로우 호출 노드](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md) 는 재귀 깊이 초과를 코드 없이 메시지 `Maximum recursion depth exceeded (limit: 10)` 로 throw 한다고 적는다. 코드를 붙일지 카탈로그에서 뺄지 결정이 필요하다. 정리는 NERV Task `CLE-T-8WXV7T` 에서 한다.
- **가이드 식별자 실재 가드의 소유**: `PROJECT.md` 는 가이드가 인용한 에러 코드·환경 변수가 코드에 실재하는지 보는 가드(`guide-identifier-existence`)의 기준 문서로 이 규약을 지목한다. 원문 규약에는 가이드 인용 규칙도 이 가드도 없어 여기 싣지 않았다. 어느 문서가 이 가드를 소유할지는 [사용자 가이드 근거 규약](../CLE-ENG/CLE-ENG-GUIDEEVIDENCE.md#미결-사항) 의 미결에서 정한다. 소유와 별개로 이 가드는 지금 이 문서 미러의 `## 6. 카탈로그` 절 제목을 찾아 그 아래 행을 읽는다(`guide-identifier-existence.test.ts` 의 `CATALOG_SECTION_HEADING`). 제목이 없으면 가드가 멈춘다. 그래서 이 절 제목을 바꾸는 초안은 `CATALOG_SECTION_HEADING` 을 함께 고치는 구현 PR 을 낸다.

## 구현 위치

- `codebase/backend/src/nodes/core/error-codes.ts` (`ErrorCode`, `EngineErrorCode` 자매 const)
- `codebase/backend/src/modules/execution-engine/containers/iteration-error-code.ts` (`resolveIterationErrorCode`. 반복 · 병렬 실패 회차의 `error.code` 와 그 허용 목록. 목록과 소스의 일치는 `iteration-error-code.spec.ts` 가 본다)
- `codebase/backend/src/nodes/data/code/code.handler.ts` (`LEGACY_TO_NORMALIZED`)
- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` (`toTriggerParameterErrorDetails`)
- `codebase/backend/src/modules/websocket/ws-error-codes.ts` (`WsErrorCode`)
- `codebase/backend/src/common/constants/workspace-roles.ts` (가드와 서비스가 함께 쓰는 거부 본문). 상수 이름은 TS 이름이고 응답의 에러 코드가 아니다. `NOT_A_MEMBER` 는 코드 `NOT_A_MEMBER` 를 낸다. `ROLE_REQUIRED` 는 요구 역할별 본문 표이고 `EDITOR_REQUIRED` · `ADMIN_REQUIRED` · `OWNER_REQUIRED` 를 낸다(`viewer` 는 `NOT_A_MEMBER` 와 같은 본문). `ADMIN_ROLE_CHANGE_REQUIRES_OWNER` 는 코드 `OWNER_REQUIRED` 를 관리자 역할 규칙의 문구로 낸다
- `codebase/backend/src/modules/hooks/hooks.service.ts` (웹훅 수신의 `TRIGGER_INACTIVE` · `WORKFLOW_INACTIVE` 발행)
- `codebase/backend/src/modules/auth/auth.service.ts` (로그인의 `EMAIL_VERIFICATION_REQUIRED` · `WEBAUTHN_DISABLED` 발행)
- `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (인증 설정 재생성의 `AUTH_CONFIG_REGENERATE_UNSUPPORTED` 발행, 웹훅 인증의 `AUTH_FAILED` 판정)

## Rationale

### 왜 의미 기반인가

에러 코드는 클라이언트와 맺는 장기 계약이다. 구현이나 역사를 이름에 박으면 리팩터링마다 이름이 거짓이 되거나 이름을 바꿔야 한다는 압력이 생긴다. 의미를 적으면 코드 경로가 바뀌어도 계약이 안정적이다.

### 왜 이름 바꾸기 대신 새 코드인가

이름 바꾸기의 가독성 이득은 작고(클라이언트는 의미로 분기한다) 호환 비용은 크다. 의미가 실제로 갈릴 때만 새 코드로 나누는 것이 비용 대비 합리적이다.

### 책임을 나누는 이유

이 문서는 이름 규율과 카탈로그만 맡고 응답 봉투·상태 코드 선택·노드 출력 형태는 개요에 적은 문서가 맡는다. 각 축을 나눠 따로 발전시키고 책임이 겹치지 않게 한다. 원문에서는 이름 규율과 카탈로그가 서로 다른 문서에 있어 표기 규칙(`UPPER_SNAKE_CASE`)의 기준을 두 문서가 서로 가리켰다. 두 내용을 이 문서에 모으면서 표기 규칙을 규칙 2 로 한 번만 적었다.

### 카탈로그 완결성 작업의 경위

카탈로그가 제품 전체 목록이라고 선언하면서도 도메인 문서의 코드가 빠져 있어 여러 번에 걸쳐 채웠다. 방식은 늘 같았다. 정의 기준은 도메인 문서에 두고 카탈로그에는 공용 가시성을 위해 등재만 한다. 새 원칙도 코드 재정의도 아니다.

- 코드에만 있고 도메인 문서에 없던 코드(재인증 세부 코드, 역할 · 멤버십 관리 코드)는 "문서화 → 등재" 순서를 지켜 도메인 문서가 상태 코드를 적은 뒤 등재했다. 재인증 세부 코드를 등재할 때 옛 주석의 상태 오기(`REAUTH_REQUIRED` 403 → 400, `PASSWORD_INVALID` 400 → 401)를 코드 기준으로 고쳤다.
- 인증 문서의 "강제 종료 재인증" 행이 구현(`verifyReauth` = 비밀번호 또는 TOTP)보다 부풀려져 있어(WebAuthn·이메일 OTP 대체) 실제 지원으로 맞추고 나머지를 미지원으로 명시했다([세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md)).
- `INVALID_PASSWORD` 는 등재 뒤 2026-09-02 에 은퇴해 응답에 나가지 않는다(§5 등급 B). 등재를 되돌린 것이 아니라 등재가 기록하던 비슷한 이름의 원인을 없앤 것이다.
- `USER_NOT_FOUND` 는 여러 모듈이 같이 쓰는 일반 코드라 §6.12 가 아니라 §6.4 에 두었다. `WORKSPACE_NOT_FOUND` 는 관리 경로의 404 와 토큰 검증의 401 이 상태도 뜻도 달라 두 행으로 적었다. 2026-11-14 에 토큰 검증의 401 을 `NO_WORKSPACE_AVAILABLE`(§6.4)로 나눠 지금은 404 행만 남았다. 두 코드의 발행 자리는 [워크스페이스와 멤버 「워크스페이스를 찾지 못할 때」](../CLE-ACCT/CLE-ACCT-WS.md#워크스페이스를-찾지-못할-때) 가 정한다.

### 규칙 7 의 「규칙」 을 이름 규칙으로 좁혔다 (2026-11-01)

규칙 7 은 「규칙을 따르지 않지만 유지하는 기존 코드」 를 §3 에 적게 했다. 그런데 개요 · 규칙 2 · §3 첫 문단은 §3 을 이름 규칙을 따르지 않는 코드의 등록부로 적는다. 규칙 7 만 넓게 읽혀서 규칙 6 의 예외를 §3 에 올릴지 판단할 근거가 둘로 갈렸다. 그래서 규칙 7 을 이름 규칙(규칙 1~3)으로 좁히고 개요 · 규칙 7 · §3 첫 문단을 같은 말로 맞췄다(NERV Task `CLE-T-H9QJTA`). 기존 코드를 다시 쓰는 결정은 이름을 정하는 결정이 아니어서 §3 에 올리지 않는다. prefix 없는 공용 코드도 규칙 3 을 따른 것이라 §3 에 올리지 않는다(§1).

기각한 대안은 규칙 7 을 넓게 두고 개요 · 규칙 2 · §3 첫 문단을 그 범위로 넓히는 안이다. 그러면 기존 코드를 다시 쓰는 결정도 §3 에 올려야 해서 이름이 부정확한 코드를 찾는 표에 이름이 정확한 코드(`AUTH_FAILED` 등)가 섞인다.

### 규칙 9 에 정했지만 아직 발행하지 않은 코드의 자리를 적었다 (2026-11-05)

규칙 9 는 발행한 적 없는 코드를 등재하지 않는다고만 적었다. 그런데 사람이 정했고 아직 구현하지 않은 코드를 표 아래 문장으로 적는 관행이 있었다(§6.2 의 `EMAIL_VERIFICATION_REQUIRED`, §6.17 의 LLM 세분화 코드). NERV Task `CLE-T-693G4E` 에서 이 관행을 규칙 9 의 단서로 올렸다.

- **표에 미리 넣지 않는다.** 표는 지금 응답에 나가는 코드의 목록이다. 정한 코드를 미리 넣으면 클라이언트가 아직 오지 않는 코드로 분기를 만든다. 규칙 9 가 막는 기록 실수와 결과가 같다.
- **문장으로는 남긴다.** 결정을 적지 않으면 같은 조건에 다른 코드를 또 정할 수 있다. 상태 코드와 조건을 적어 두면 구현하는 쪽이 그대로 옮긴다.
- **영역 문서는 미구현 표시로 먼저 적을 수 있다.** 영역 문서의 에러 표는 그 영역의 동작을 정하는 곳이라 정한 코드를 미구현 표시와 함께 둔다. [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) 이 두 로그인 코드를 이렇게 적었다.

### `TOKEN_EXPIRED` 설명을 리프레시 토큰 만료로 맞춘 이유

→ [에러 코드 카탈로그 — 인증 · 인가 · 워크스페이스](CLE-API-ERRCODES-AUTH.md#token_expired-설명을-리프레시-토큰-만료로-맞춘-이유)

### 트리거 단위 토큰 경로의 부재는 401 `EXECUTION_NOT_FOUND` 로 적는다 (2026-10-17)

→ [에러 코드 카탈로그 — WebSocket · EIA · Background Runs](CLE-API-ERRCODES-WSEIA.md#트리거-단위-토큰-경로의-부재는-401-execution_not_found-로-적는다-2026-10-17)

### 설치 엔드포인트의 예상 밖 예외를 500 으로 가리고 `requestId` 를 싣는다 (2026-11-06)

→ [에러 코드 카탈로그 — 통합 관리 · OAuth](CLE-API-ERRCODES-INTMGMT.md#설치-엔드포인트의-예상-밖-예외를-500-으로-가리고-requestid-를-싣는다-2026-11-06)

### Cafe24 · MakeShop 연결 테스트의 401 · 403 밖 실패에 `*_API_ERROR` 를 새로 만들었다 (2026-11-06)

→ [에러 코드 카탈로그 — 통합 노드 · MCP](CLE-API-ERRCODES-INTNODE.md#cafe24--makeshop-연결-테스트의-401--403-밖-실패에-_api_error-를-새로-만들었다-2026-11-06)

### `new` 가 아닌 모드의 begin 이 대상 통합과 맞지 않는 요청에 `OAUTH_TARGET_MISMATCH` 를 새로 만들었다 (2026-11-06)

→ [에러 코드 카탈로그 — 통합 관리 · OAuth](CLE-API-ERRCODES-INTMGMT.md#new-가-아닌-모드의-begin-이-대상-통합과-맞지-않는-요청에-oauth_target_mismatch-를-새로-만들었다-2026-11-06)
