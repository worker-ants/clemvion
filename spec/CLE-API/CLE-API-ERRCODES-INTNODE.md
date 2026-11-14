---
id: "CLE-API-ERRCODES-INTNODE"
title: "에러 코드 카탈로그 — 통합 노드 · MCP"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-ERRCODES"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-ERRCODES"]
area: "CLE-API"
content_hash: "cd1e098489ba358919bebfea9670f476cdef683eb781e4a41012ebc126db24d1"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "6af8a40481fcbf392c9d514dff507fb61d92973159b8cb0282d4cca6e6032380"
etag: "sha256-935f655ddc4c2b232045e4ee87c2a66b25a10f8296d05a44e5f6064d2734565c"
---
## 개요

이 문서는 [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 의 하위 문서로 카탈로그 가운데 통합 노드 · 통합 연결 테스트 · AI 에이전트 도구 호출 코드(§6.22)와 MCP 클라이언트 코드(§6.23)를 정한다.

## 6.22 통합 노드 (도메인 문서 참조)

통합을 쓰는 노드, 통합 연결 테스트, AI 에이전트의 Cafe24 · MakeShop 도구 호출이 내는 코드다. 세 표면 모두 HTTP 응답 봉투가 아니다.

- **노드**: 에러 포트의 `output.error.code` 다([노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md)).
- **연결 테스트**: `POST /api/integrations/:id/test` 와 `POST /api/integrations/preview-test` 는 실패해도 200 과 `{ success: false, code, message }` 로 답한다. 이 `code` 는 노드 코드와 따로 정한 이름이다. 이름과 뜻이 노드 코드와 같은 것은 사설망 차단 셋(`HTTP_BLOCKED` · `DB_HOST_BLOCKED` · `EMAIL_HOST_BLOCKED`, §6.6)뿐이다. `DB_CONNECT_FAILED` · `HTTP_CONNECT_FAILED` 는 노드의 `DB_CONNECTION_ERROR` · `HTTP_TRANSPORT_FAILED` 와 이름만 비슷하다.
- **도구 결과**: Cafe24 · MakeShop 도구는 호출 전에 거절하거나 호출 중 예외가 나면 도구 결과 content 의 `error.code` 에 코드를 싣는다. API 가 2xx 가 아닌 상태로 답하면 content 에는 `status` 와 `response` 만 싣고 코드는 `mcpDiagnostics.errors[].code` 와 활동 로그에 남긴다.

활동 로그에 실패로 남은 코드는 통합의 `last_error.code` 에도 들어간다. HTTP · Database · Email 노드의 고유 코드는 §6.6, `CAFE24_INVALID_MALL_ID` · `MAKESHOP_INVALID_SHOP_UID` 는 §6.21, 외부 MCP 서버의 코드는 §6.23 에 있다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `CAFE24_404` · `CAFE24_422` · `CAFE24_4XX` · `CAFE24_5XX` | 없음 (노드 `output.error.code`) | Cafe24 API 가 2xx 가 아닌 상태로 답함. 상태별 분류와 이름의 경위는 §3. `details` 에 `statusCode` · `mallId` · `resource` · `operation` 을, 응답에 있으면 `cafe24ErrorCode` · `cafe24Message` 도 싣는다. 서버 본문은 `output.response` 에 둔다 | [Cafe24 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-CAFE24.md#에러-코드) |
| `MAKESHOP_404` · `MAKESHOP_422` · `MAKESHOP_4XX` · `MAKESHOP_5XX` | 없음 (노드 `output.error.code`) | MakeShop API 가 2xx 가 아닌 상태로 답함. 상태별 분류와 이름의 경위는 §3. `details` 에 `statusCode` · `shopUid` · `resource` · `operation` 을, 응답에 있으면 `makeshopErrorCode` · `makeshopMessage` 도 싣는다. 서버 본문은 `output.response` 에 둔다 | [MakeShop 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#에러-코드) |
| `CAFE24_AUTH_FAILED` | 없음 (노드 `output.error.code`) · 200 (연결 테스트 결과 `code`) · 없음 (도구 결과 `error.code`) | 노드 · 도구: 403 이거나, 토큰을 갱신하고 다시 보낸 요청도 401 임. 통합은 `error` 가 되고 사유는 403 에 권한 범위 부족 신호가 있으면 `insufficient_scope`, 그 밖은 `auth_failed` 다. 연결 테스트: 토큰 갱신이 401 · 403 으로 거절되거나, 토큰을 갱신하고 다시 보낸 요청도 401 임. 두 경우 모두 통합은 `error(auth_failed)` 가 된다. 401 · 403 이 아닌 상태는 `CAFE24_API_ERROR` 다 | [Cafe24 노드 「인증 실패 처리」](../CLE-NODE-INT/CLE-NODE-CAFE24.md#인증-실패-처리), [서비스별 인증 방식과 자격 증명 「Cafe24」](../CLE-INT/CLE-INT-AUTH.md#cafe24) |
| `MAKESHOP_AUTH_FAILED` | 없음 (노드 `output.error.code`) · 200 (연결 테스트 결과 `code`) · 없음 (도구 결과 `error.code`) | 노드 · 도구: 403 이거나, 토큰을 갱신하고 다시 보낸 요청도 401 임. 통합은 `error(auth_failed)` 가 된다. 연결 테스트: 첫 요청이나 다시 보낸 요청이 403 이거나, 토큰 갱신이 401 · 403 으로 거절되거나, 토큰을 갱신하고 다시 보낸 요청도 401 임. 갱신 거절과 다시 보낸 요청의 401 만 통합 상태를 바꾼다. 그래서 같은 403 에 노드는 통합을 `error(auth_failed)` 로 낮추고 연결 테스트는 낮추지 않는다. 이름은 두 경로가 같은 API 클라이언트를 써서 같다([통합 관리 「연결 테스트」](../CLE-INT/CLE-INT-MANAGE.md#연결-테스트)). 401 · 403 이 아닌 상태는 `MAKESHOP_API_ERROR` 다 | [MakeShop 노드 「인증 실패 처리」](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#인증-실패-처리), [서비스별 인증 방식과 자격 증명 「MakeShop」](../CLE-INT/CLE-INT-AUTH.md#makeshop), [통합 관리 「연결 테스트」](../CLE-INT/CLE-INT-MANAGE.md#연결-테스트) |
| `CAFE24_TRANSPORT_FAILED` · `MAKESHOP_TRANSPORT_FAILED` | 없음 (노드 `output.error.code`) · 200 (연결 테스트 결과 `code`) · 없음 (도구 결과 `error.code`) | 요청이 응답을 받지 못함(DNS · 연결 · 타임아웃). 노드는 API 호출 중 분류되지 않은 예외도 이 코드로 내고 `meta.statusCode` 는 0 이다 | [Cafe24 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-CAFE24.md#에러-코드), [MakeShop 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#에러-코드) |
| `CAFE24_RATE_LIMITED` · `MAKESHOP_RATE_LIMITED` | 없음 (노드 `output.error.code`) · 없음 (도구 결과 `error.code`) | 429 를 받고 재시도를 다 씀. 노드는 `details` 에 `retries` · `lastRetryAfterSec` 를 싣는다. 설치 엔드포인트의 `*_INSTALL_RATE_LIMITED`(§6.21)와 다른 코드다 | [Cafe24 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-CAFE24.md#에러-코드), [MakeShop 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#에러-코드) |
| `CAFE24_UNKNOWN_OPERATION` · `MAKESHOP_UNKNOWN_OPERATION` | 없음 (노드 `output.error.code`) · 없음 (도구 결과 `error.code`) | `operation` 이 메타데이터에 없음. 도구는 도구 이름의 operation 이 그 통합의 도구 목록에 없을 때 낸다 | [Cafe24 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-CAFE24.md#에러-코드), [MakeShop 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#에러-코드) |
| `CAFE24_MISSING_FIELDS` · `MAKESHOP_MISSING_FIELDS` | 없음 (노드 `output.error.code`) · 없음 (도구 결과 `error.code`) | 필수 필드가 비었거나 조건부 필수 제약을 어김. MakeShop 도구는 경로의 자리표시자가 채워지지 않아도 이 코드를 낸다 | [Cafe24 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-CAFE24.md#에러-코드), [MakeShop 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#에러-코드) |
| `MAKESHOP_INVALID_PAGINATION` | 없음 (노드 `output.error.code`) | 외부 호출 전에 `pagination` 이 페이지네이션 변환 규칙을 어긴 것을 거름 | [MakeShop 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#에러-코드) |
| `INTEGRATION_TYPE_MISMATCH` · `INTEGRATION_NOT_CONNECTED` | 없음 (노드 `output.error.code`) | 참조한 통합의 서비스 유형이 노드와 다름 / 통합 상태가 `connected` 가 아님 | [통합 노드 공통 「공통 에러 코드」](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md#공통-에러-코드) |
| `INTEGRATION_INCOMPLETE` | 없음 (노드 `output.error.code`) · 200 (연결 테스트 결과 `code`) | 자격 증명에 서비스별 필수 필드가 없음. 연결 테스트는 설치 대기(`pending_install`) 통합에도 이 코드를 돌려준다 | [통합 노드 공통 「공통 에러 코드」](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md#공통-에러-코드), [통합 관리 「연결 테스트」](../CLE-INT/CLE-INT-MANAGE.md#연결-테스트) |
| `INTEGRATION_CALL_FAILED` | 없음 (노드 `output.error.code`) | 분류되지 않은 그 밖의 실패. `IntegrationError` 가 아닌 예외의 기본 코드다 | [통합 노드 공통 「공통 에러 코드」](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md#공통-에러-코드) |
| `INTEGRATION_SERVICE_UNAVAILABLE` | 없음 (노드 `output.error.code`) | 통합 서비스가 주입되지 않았거나 워크스페이스 컨텍스트가 없음(배포 구성 에러) | [통합 노드 공통 「공통 에러 코드」](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md#공통-에러-코드) |
| `INTEGRATION_AUTH_UNSUPPORTED` | 없음 (노드 `output.error.code`) · 200 (연결 테스트 결과 `code`) | HTTP 통합의 인증 방식을 지원하지 않음 | [서비스별 인증 방식과 자격 증명 「HTTP/REST」](../CLE-INT/CLE-INT-AUTH.md#httprest) |
| `INTEGRATION_CREDENTIALS_UNREADABLE` | 200 (연결 테스트 결과 `code`) | 저장된 자격 증명을 지금 키로 복호화하지 못함. 다시 연결해야 한다 | [통합 관리 「연결 테스트」](../CLE-INT/CLE-INT-MANAGE.md#연결-테스트) |
| `HTTP_AUTH_FAILED` · `HTTP_SERVER_ERROR` · `HTTP_CONNECT_FAILED` | 200 (연결 테스트 결과 `code`) | HTTP 통합 연결 테스트가 401 · 403 을 받음 / 5xx 를 받음 / `base_url` 이 URL 이 아니거나 연결 · 타임아웃으로 실패함. 노드의 `HTTP_*`(§6.6)와 다른 이름이다 | [서비스별 인증 방식과 자격 증명 「HTTP/REST」](../CLE-INT/CLE-INT-AUTH.md#httprest) |
| `DB_AUTH_FAILED` · `DB_CONNECT_FAILED` | 200 (연결 테스트 결과 `code`) | Database 통합 연결 테스트가 인증 거부를 받음 / 그 밖의 이유로 연결하지 못함. 노드의 `DB_CONNECTION_ERROR`(§6.6)와 다른 이름이다 | [서비스별 인증 방식과 자격 증명 「Database」](../CLE-INT/CLE-INT-AUTH.md#database) |
| `EMAIL_CONNECT_FAILED` | 200 (연결 테스트 결과 `code`) | SMTP 통합 연결 테스트가 서버에 연결하거나 인증하지 못함 | [서비스별 인증 방식과 자격 증명 「Email (SMTP)」](../CLE-INT/CLE-INT-AUTH.md#email-smtp) |
| `CAFE24_INSUFFICIENT_SCOPE` | 200 (연결 테스트 결과 `code`) | Cafe24 연결 테스트가 403 을 받음(권한 범위 부족 · 앱 미설치). 통합 상태는 바꾸지 않는다. 노드는 같은 403 을 `CAFE24_AUTH_FAILED` 로 낸다(§6.21 표 아래) | [서비스별 인증 방식과 자격 증명 「Cafe24」](../CLE-INT/CLE-INT-AUTH.md#cafe24) |
| `CAFE24_API_ERROR` · `MAKESHOP_API_ERROR` | 200 (연결 테스트 결과 `code`) | 인증 실패가 아닌 응답 실패다. 401 · 403 은 `*_AUTH_FAILED` · `CAFE24_INSUFFICIENT_SCOPE` 이고 토큰 갱신 요청의 실패는 이 코드가 아니다. Cafe24 · MakeShop 연결 테스트가 2xx 가 아닌 상태 가운데 401 · 403 을 뺀 나머지(429 · 5xx · 404 등)를 받음. 첫 요청이면 토큰을 갱신하지 않는다. 토큰을 갱신하고 다시 보낸 요청이면 더 시도하지 않는다. 통합 상태는 바꾸지 않는다. 받은 상태는 `message` 에 싣는다. 노드는 같은 응답을 `CAFE24_5XX` · `CAFE24_RATE_LIMITED` 같은 노드 코드로 낸다 | [서비스별 인증 방식과 자격 증명 「Cafe24」](../CLE-INT/CLE-INT-AUTH.md#cafe24), [서비스별 인증 방식과 자격 증명 「MakeShop」](../CLE-INT/CLE-INT-AUTH.md#makeshop) |
| `CAFE24_MCP_TOOL_NAME_INVALID` · `MAKESHOP_MCP_TOOL_NAME_INVALID` | 없음 (도구 결과 `error.code`) | LLM 이 부른 도구 이름에서 서버 id 나 operation 을 읽지 못함 | [Cafe24 노드 「AI 에이전트 노출」](../CLE-NODE-INT/CLE-NODE-CAFE24.md#ai-에이전트-노출), [MakeShop 노드 「AI 에이전트 노출」](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#ai-에이전트-노출) |
| `CAFE24_MCP_NO_SESSION` · `MAKESHOP_MCP_NO_SESSION` | 없음 (도구 결과 `error.code`) | 이 실행에서 도구 목록을 만들지 않았는데 도구가 불림 | [Cafe24 노드 「AI 에이전트 노출」](../CLE-NODE-INT/CLE-NODE-CAFE24.md#ai-에이전트-노출), [MakeShop 노드 「AI 에이전트 노출」](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#ai-에이전트-노출) |
| `CAFE24_MCP_INTEGRATION_UNKNOWN` · `MAKESHOP_MCP_INTEGRATION_UNKNOWN` | 없음 (도구 결과 `error.code`) | 도구 이름의 서버 id 에 맞는 통합이 이 실행의 도구 목록에 없음 | [Cafe24 노드 「AI 에이전트 노출」](../CLE-NODE-INT/CLE-NODE-CAFE24.md#ai-에이전트-노출), [MakeShop 노드 「AI 에이전트 노출」](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#ai-에이전트-노출) |
| `CAFE24_MCP_TOOL_ARGS_INVALID` · `MAKESHOP_MCP_TOOL_ARGS_INVALID` | 없음 (도구 결과 `error.code`) | 도구 인자가 JSON 으로 해석되지 않음 | [Cafe24 노드 「AI 에이전트 노출」](../CLE-NODE-INT/CLE-NODE-CAFE24.md#ai-에이전트-노출), [MakeShop 노드 「AI 에이전트 노출」](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#ai-에이전트-노출) |
| `CAFE24_CALL_FAILED` · `MAKESHOP_CALL_FAILED` | 없음 (도구 결과 `error.code`) | 도구 호출 중 분류되지 않은 예외. 도구 경로에서만 쓰는 대체값이다. 노드는 API 호출 중 분류되지 않은 예외를 `*_TRANSPORT_FAILED` 로 낸다 | [Cafe24 노드 「AI 에이전트 노출」](../CLE-NODE-INT/CLE-NODE-CAFE24.md#ai-에이전트-노출), [MakeShop 노드 「AI 에이전트 노출」](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#ai-에이전트-노출) |

- **경로 자리표시자 접두는 코드가 아니다(규칙 9).** Cafe24 · MakeShop 노드는 operation 경로의 자리표시자가 채워지지 않으면 메시지가 `CAFE24_UNRESOLVED_PATH_PARAM: …` · `MAKESHOP_UNRESOLVED_PATH_PARAM: …` 로 시작하는 에러를 던진다. 출력 코드는 `INTEGRATION_CALL_FAILED` 다. 이 접두로 분기하지 않는다(규칙 4). 메시지 전체는 [Cafe24 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-CAFE24.md#에러-코드) · [MakeShop 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#에러-코드) 에 있다.

## 6.23 MCP 클라이언트 (도메인 문서 참조)

외부 MCP 서버 통합이 내는 코드다. 표면은 셋이다. 연결 테스트 결과의 `code`(200, §6.22 머리말), AI 에이전트 노드의 `mcpDiagnostics.errors[].code`, 도구 결과다. 외부 MCP 도구 결과는 content 에 `{ error: <코드>, message }` 를 싣는다. Cafe24 · MakeShop 도구의 `error.code` 객체와 형태가 다르다. 도구 호출(`tools/call`)의 `MCP_TOOL_ERROR` · `MCP_CALL_FAILED` · `MCP_AUTH_FAILED` · `MCP_TIMEOUT` 은 활동 로그와 통합의 `last_error.code` 에도 남는다. 메타 도구의 실패는 활동 로그에 남기지 않는다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `MCP_CONNECT_FAILED` | 200 (연결 테스트 결과 `code`) · 없음 (`mcpDiagnostics.errors[].code`) | 연결 · TLS · DNS 실패나 `initialize` 실패. 도구 목록을 만들 때 통합이 `connected` 가 아니어도 이 코드로 남는다 | [MCP 클라이언트 「에러 코드」](../CLE-INT/CLE-INT-MCP.md#에러-코드), [MCP 클라이언트 「연결 테스트」](../CLE-INT/CLE-INT-MCP.md#연결-테스트) |
| `MCP_LIST_FAILED` | 200 (연결 테스트 결과 `code`) · 없음 (`mcpDiagnostics.errors[].code`) | `tools/list` 등 목록 RPC 실패 | [MCP 클라이언트 「에러 코드」](../CLE-INT/CLE-INT-MCP.md#에러-코드) |
| `MCP_CALL_FAILED` | 없음 (도구 결과 `error`) | `tools/call` 이나 메타 도구(`resources/read` · `prompts/get` · `resources/list` · `prompts/list`) 호출 실패 | [MCP 클라이언트 「에러 코드」](../CLE-INT/CLE-INT-MCP.md#에러-코드) |
| `MCP_TOOL_ERROR` | 없음 (도구 결과 `error`) | `tools/call` 응답이 `isError: true` 임. 도구 결과에 서버 content 를 함께 싣는다 | [MCP 클라이언트 「에러 코드」](../CLE-INT/CLE-INT-MCP.md#에러-코드) |
| `MCP_TIMEOUT` | 200 (연결 테스트 결과 `code`) · 없음 (도구 결과 `error`) | 연결 · 목록 · 호출 단계가 시간 안에 끝나지 않음 | [MCP 클라이언트 「에러 코드」](../CLE-INT/CLE-INT-MCP.md#에러-코드) |
| `MCP_AUTH_FAILED` | 200 (연결 테스트 결과 `code`) · 없음 (도구 결과 `error`) | 자격 증명이 없거나 형식이 틀림, 또는 401 · 403. 도구 호출에서 나면 통합이 `error(auth_failed)` 가 된다 | [MCP 클라이언트 「에러 코드」](../CLE-INT/CLE-INT-MCP.md#에러-코드), [MCP 클라이언트 「인증 실패 상태 전환」](../CLE-INT/CLE-INT-MCP.md#인증-실패-상태-전환) |
| `MCP_HTTPS_REQUIRED` | 200 (연결 테스트 결과 `code`) | URL 이 `https://` 가 아니거나 파싱되지 않거나 사설 · 내부망 호스트임. 이름의 경위는 §3 | [MCP 클라이언트 「에러 코드」](../CLE-INT/CLE-INT-MCP.md#에러-코드), [MCP 클라이언트 「연결 테스트」](../CLE-INT/CLE-INT-MCP.md#연결-테스트) |
| `MCP_UNKNOWN_TOOL` | 없음 (도구 결과 `error`) | 실행에 활성 세션이 없거나 세션이 노출하지 않은 도구를 LLM 이 부름 | [MCP 클라이언트 「에러 코드」](../CLE-INT/CLE-INT-MCP.md#에러-코드) |
| `INVALID_TOOL_ARGUMENTS` | 없음 (도구 결과 `error`) | 도구 이름 형식이 틀림, 인자가 JSON 객체가 아님, 또는 메타 도구 인자에 `uri` · `name` 이 없음. 호출하지 않고 돌려준다. prefix 가 없는 이유는 §1 | [MCP 클라이언트 「에러 코드」](../CLE-INT/CLE-INT-MCP.md#에러-코드) |
| `MCP_RESPONSE_TOO_LARGE` | 없음 (도구 결과 `error`) | 도구 결과 content 가 크기 상한을 넘음. 호출은 성공했고 결과 대신 `originalSizeBytes` 와 `previewBase64` 를 싣는다 | [MCP 클라이언트 「에러 코드」](../CLE-INT/CLE-INT-MCP.md#에러-코드) |

## Rationale

### Cafe24 · MakeShop 연결 테스트의 401 · 403 밖 실패에 `*_API_ERROR` 를 새로 만들었다 (2026-11-06)

NERV Task `CLE-T-H9FQHR` 이다. Cafe24 · MakeShop 연결 테스트는 첫 요청이 401 · 403 이 아닌 상태로 실패해도 401 처럼 토큰을 갱신하고 다시 보냈다. 다시 보낸 요청이 5xx · 429 로 실패하면 `*_AUTH_FAILED` 로 답해 서버 장애나 호출 제한을 인증 실패로 안내했다. 정의는 [서비스별 인증 방식과 자격 증명](../CLE-INT/CLE-INT-AUTH.md#연결-테스트는-401-만-토큰-문제로-본다-2026-11-06) 에 있다.

- **401 · 403 이 아닌 상태는 새 코드로 낸다.** 인증 실패가 아닌 새 조건이라 새 코드를 만들었다(규칙 6). 사용자가 할 일이 상태와 관계없이 «잠시 뒤 다시 시도하거나 상점 쪽 상태를 확인» 으로 같아서 코드를 하나로 묶고 받은 상태는 `message` 에 싣는다.
- `*_TRANSPORT_FAILED` 를 쓰는 안은 기각했다. 그 코드는 응답을 받지 못한 실패다. 응답을 받은 실패까지 담으면 뜻이 갈린다.
- 노드의 `*_RATE_LIMITED` 를 429 에 쓰는 안도 기각했다. 그 코드는 429 재시도를 다 썼다는 뜻인데 연결 테스트는 429 를 다시 시도하지 않는다. §6.21 표 아래 「빈도 제한 코드는 세 부류다」 의 구분도 흐려진다.
- 노드처럼 `*_5XX` · `*_4XX` 로 상태를 나누는 안도 기각했다. 상태 번호 이름은 §3 예외라 새 코드의 선례가 아니다(규칙 7).
- HTTP 통합 연결 테스트처럼 401 · 403 이 아닌 4xx 를 성공으로 보는 안도 기각했다. HTTP 통합은 사용자가 정한 주소를 부르므로 4xx 응답도 서버가 살아 있다는 신호다. Cafe24 · MakeShop 연결 테스트는 정해진 진단 주소를 부르므로 4xx 도 실패다.
- 토큰 갱신 요청 자체가 401 · 403 이 아닌 상태로 실패하면 연결 테스트는 지금도 `*_TRANSPORT_FAILED` 로 답한다. 갱신 경로는 노드와 함께 써서 이 변경에 넣지 않았다. 응답을 받은 실패라 `*_TRANSPORT_FAILED` 의 뜻(응답을 받지 못한 실패)과 어긋난다. 위에서 `*_TRANSPORT_FAILED` 를 기각한 근거와 같은 어긋남이며 NERV Task `CLE-T-DJGSBR` 이 고칠 때까지 남겨 두는 한시 예외다.

### 통합 · MCP · Background Runs 코드를 도메인 참조 절 6.21~6.24 로 등재했다 (2026-11-05)

NERV Task `CLE-T-5BZ3M2` 다. 통합 관리 · OAuth, 통합 노드, MCP 클라이언트, Background Runs REST 가 내는 코드는 도메인 문서에만 있고 이 카탈로그에 행이 없었다(규칙 8). 2026-11-05 에 사람이 구조와 이름을 정했다.

- **§6.1~6.20 은 그대로 두고 §6.21~6.24 를 더했다.** 6.21 과 6.22 를 한 절로 합치는 안, §6 번호를 다시 매기는 안, 도구 결과 코드와 콜백 코드의 등재를 미루는 안은 기각했다. 번호를 다시 매기면 절 앵커와 링크가 깨진다. 코드 주석도 절 제목을 인용한다. 6.21 의 코드는 REST 응답 · 설치 진입점 응답 · 콜백 기록으로 나가고 6.22 의 코드는 노드 출력 · 연결 테스트 결과 · 도구 결과로 나간다. 나가는 곳이 달라 절을 나눴다. 도구 결과 코드와 콜백 코드는 이미 발행 중이라 등재를 미루면 규칙 8 위반이 그대로 남는다.
- **이름은 모두 유지하고 이름이 부정확한 코드를 §3 에 올렸다.** `MCP_HTTPS_REQUIRED` 를 지금 나누는 안, `CAFE24_PRIVATE_APP_INSTALL_PENDING` · `MAKESHOP_INSTALL_PENDING` 의 이름을 지금 바꾸는 안, 상태 번호 코드를 §3 에서 빼는 안은 기각했다. 이름 바꾸기는 규칙 5 에 따라 호환을 깨는 변경이다. 상태 번호 코드를 §3 에서 빼면 규칙 1 에 맞지 않는 이름이 예외 표시 없이 남는다. 그러면 새 코드가 그 이름을 선례로 삼을 수 있다. `MCP_HTTPS_REQUIRED` 를 나누는 일은 코드 변경이라 NERV Task `CLE-T-DDN3MS` 가 맡는다.
