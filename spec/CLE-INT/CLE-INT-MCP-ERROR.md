---
id: "CLE-INT-MCP-ERROR"
title: "MCP 클라이언트 — 에러 처리"
type: "design"
version: 8
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT-MCP"
ancestors: ["CLE-VISION", "CLE-INT", "CLE-INT-MCP"]
area: "CLE-INT"
content_hash: "079af7230e0353a8855fe899f0085f043ddda11a2e05afa5cd057df3d6971ecf"
read_as: "approved_fallback"
task: "CLE-T-22PSME"
source_paths: []
mirror_sha256: "9c6140f71857a6d47e30f6b3564627f10137a5e940c4ddc88db167dcd89e2b6b"
etag: "sha256-c1ff9ebceb3ae9da13d13ee539529db48ed88e89b0c9ab887735841502212764"
---
## 개요

이 문서는 [MCP 클라이언트](CLE-INT-MCP.md) 의 하위 문서로 MCP 도구의 에러 격리, 에러 코드, 활동 로그, 인증 실패 상태 전환을 정한다. 내부 MCP 브리지와 다른 점은 절마다 적는다.

## 격리 원칙

MCP 서버 하나가 장애를 내도 AI 에이전트 노드 전체가 죽지 않는다. 실패한 서버만 빼고 나머지 서버로 계속 실행한다. 지식 저장소 검색도 같은 방식이다.

| 상황 | 처리 |
|------|------|
| `initialize` 실패, `tools/list` 실패, connect 타임아웃 | 그 서버 도구는 LLM 에 노출하지 않는다. `meta.mcpDiagnostics.errors` 에 세분 코드([에러 코드](#에러-코드))와 `phase` 로 남긴다. 다른 서버·지식 저장소 도구는 정상 노출한다 |
| `tools/call` 실패(네트워크, 5xx, RPC error) | 그 호출만 실패한다. LLM 에 `tool_result` 로 실패를 넘겨 LLM 이 응답 방법을 정하게 한다. 모양은 [도구 결과의 `error` 모양](#도구-결과의-error-모양)을 따른다. [활동 로그](#활동-로그)와 `mcpDiagnostics.errors[]`(`phase='tools/call'`, 세분 코드)에 남긴다 |
| 401·403(인증 실패) | 위와 같고, 추가로 `Integration.status` 를 `error(auth_failed)` 로 바꾸고(이미 `error(auth_failed)` 면 그대로 둔다) `last_error` 를 남긴다. 바꾸는 주체와 알림 계기는 외부 MCP 서버와 내부 MCP 브리지가 다르다. 사용자에게 복구를 권한다. 외부 MCP 는 자격 증명 교체나 OAuth 통합 재인증이고 Cafe24 · MakeShop 은 프로바이더마다 경로가 다르다([인증 실패 상태 전환](#인증-실패-상태-전환), [재인증과 추가 권한 요청](CLE-INT-OAUTH-REAUTH.md#통합-재인증과-추가-권한-요청)) |
| 도구 인자 검증 실패 | LLM 이 보낸 인자가 틀리면 호출하지 않고 `tool_result` 의 `error` 를 `INVALID_TOOL_ARGUMENTS` 로 돌려준다. LLM 이 다음 턴에 고친다. 지금 확인하는 범위는 아래 `INVALID_TOOL_ARGUMENTS` 행이 정한다 |
| 도구 결과가 너무 큼(JSON 으로 직렬화한 길이가 상한 초과) | 결과 대신 `{ "error": "MCP_RESPONSE_TOO_LARGE", "originalSizeBytes": <길이>, "previewBase64": "..." }` 를 넘긴다. `previewBase64` 는 앞에서부터 상한 길이만큼을 base64 로 바꾼 값이다. 상한은 102,400(환경 변수 `MCP_MAX_RESPONSE_BYTES` 로 바꾼다. `ConfigService` 를 거치지 않고 `process.env` 를 직접 읽는다)이고 텍스트와 바이너리를 나누지 않는다. 호출은 성공으로 치므로 활동 로그는 `success` 이고 `mcpDiagnostics.errors` 에 남기지 않는다. 외부 MCP 도구에만 적용한다 |

### 도구 결과의 `error` 모양

도구 결과(`tool_result.content`)의 JSON 에서 실패를 싣는 자리는 경로마다 다르다.

- 외부 MCP 서버: `error` 가 코드 문자열이다. `{ "error": "<code>", "message": "..." }` 이고 `MCP_TOOL_ERROR` 는 서버 content 를 `content` 에 더 싣는다.
- 내부 MCP 브리지(Cafe24 · MakeShop): `error` 가 객체다. `{ "error": { "code": "<code>", "message": "..." } }` 이고 프로바이더 응답 본문이 있으면 `error.response` 에 싣는다.

이 문서가 `tool_result` 의 `error` 라고 쓰면 외부 MCP 는 `error`, 내부 MCP 브리지는 `error.code` 를 뜻한다.

## 에러 코드

`tool_result` 의 `error`([모양](#도구-결과의-error-모양))나 `mcpDiagnostics.errors[].code` 에 쓴다. 단일 기준은 `codebase/backend/src/modules/mcp/mcp-error-codes.ts` 의 `MCP_ERROR_CODES` 상수다.

| 코드 | 뜻 |
|------|------|
| `MCP_CONNECT_FAILED` | TCP·TLS·DNS 실패, HTTPS 강제 위반과 SSRF 차단(connect 직전 해석 주소 검사 포함), `initialize` RPC 실패(프로토콜 버전 불일치 포함). connect 단계 실패를 모두 하나로 모은다. SDK 가 connect 와 initialize 를 한 호출로 묶어 두 단계를 뜻으로 나누기 어렵기 때문이다. 내는 곳은 [연결 테스트](CLE-INT-MCP-CONN.md#연결-테스트)(`McpTestConnectionService`)와 노드 실행 `buildTools`(`McpToolProvider.openServer`)다. `buildTools` 의 connect 실패(status 사전 검사 포함)는 `mcpDiagnostics.errors[].code = MCP_CONNECT_FAILED`(`phase='connect'`)로 드러난다 |
| `MCP_LIST_FAILED` | `tools/list` 등 list RPC 실패. 내는 곳은 연결 테스트와 `buildTools` 다. `buildTools` 의 `tools/list` 실패는 `mcpDiagnostics.errors[].code = MCP_LIST_FAILED`(`phase='tools/list'`)로 드러난다 |
| `MCP_CALL_FAILED` | `tools/call`·`resources/read`·`prompts/get`·`resources/list`·`prompts/list` 실패. 노드 실행 `execute` 경로에서 낸다. `tool_result` 와 `mcpDiagnostics.errors[]`(phase 별) 양쪽에 드러난다 |
| `MCP_TOOL_ERROR` | `tools/call` 응답이 MCP `isError: true` 인 도구 수준 실패. 전송은 성공했지만 도구가 에러를 보고했다. `tool_result.content` 에 서버 content 를 함께 싣고 `mcpDiagnostics.errors[]`(`phase='tools/call'`)에도 남긴다 |
| `MCP_TIMEOUT` | [타임아웃](CLE-INT-MCP-CONN.md#타임아웃) 초과. `withTimeout` 의 `TimeoutError`(와 connect 단계 AbortController 만료, connect 직전 DNS 해석의 시간 초과)로 판정하며 모든 단계에서 드러난다. 도구 목록 구성 단계(connect·`tools/list`)와 호출 단계(`tools/call`·`resources/read`·`prompts/get` 등)는 `mcpDiagnostics.errors[].code = MCP_TIMEOUT`(해당 phase), 연결 테스트는 응답 `code = MCP_TIMEOUT` 이다 |
| `MCP_AUTH_FAILED` | 자격 증명 누락·형식 오류, 또는 401·403. `Integration.status` 변경이 따른다 |
| `MCP_HTTPS_REQUIRED` | URL 이 `https://` 가 아니거나 파싱할 수 없다. 연결 테스트(`preview-test` · `:id/test`)에서 낸다. 노드 실행 `buildTools` 에서는 같은 실패가 `MCP_CONNECT_FAILED` 로 모인다 |
| `MCP_HOST_BLOCKED` | 호스트가 사설 · 내부망 · 메타데이터 주소라 막았다(SSRF 차단). 리터럴 판정, connect 직전 해석 주소 검사, 연결 시점 판정 세 곳이 낸다([자격 증명과 URL 검증](CLE-INT-MCP-CONN.md#자격-증명과-url-검증) 2 · 3항). message 에는 호스트 이름만 싣는다. 연결 테스트에서 낸다. 노드 실행 `buildTools` 에서는 같은 실패가 `MCP_CONNECT_FAILED` 로 모인다 |
| `MCP_UNKNOWN_TOOL` | `execute` 단계에서 `<sid>` 에 맞는 활성 세션이 없거나, 세션이 노출하지 않은 도구 이름을 LLM 이 불렀다(`buildTools` 미실행, 도구 없음) |
| `INVALID_TOOL_ARGUMENTS` | 도구 이름 형식이 틀렸거나, 인자가 JSON 객체가 아니거나, 메타 도구 인자에 `uri` · `name` 이 없다. 호출하지 않고 돌려준다. 외부 MCP 도구 인자의 `inputSchema` 검증은 미구현이다([미결 사항](CLE-INT-MCP.md#미결-사항) 참조). 내부 MCP 브리지는 이 코드 대신 프로바이더 코드(`CAFE24_MCP_TOOL_ARGS_INVALID` · `CAFE24_MISSING_FIELDS` 등)를 쓴다 |
| `MCP_RESPONSE_TOO_LARGE` | 도구 결과가 크기 상한을 넘었다. 호출은 성공했고 결과 대신 `originalSizeBytes` 와 `previewBase64` 를 싣는다([격리 원칙](#격리-원칙)) |

`tools/call` 이 실패하면 코드가 무엇이든 `Integration.last_error` 를 그 실패로 고친다. `last_error` 는 통합 행의 열이고 모양은 `{ code, message, at }` 이다. 활동 로그 행의 `error` 열(`{ code, message }`)과는 다른 열이고 실패 시각 `at` 이 더 붙는다. 외부 MCP 에서 상태까지 바꾸는 코드는 `MCP_AUTH_FAILED` 뿐이다. 내부 MCP 브리지는 API 클라이언트가 상태를 바꾼다([인증 실패 상태 전환](#인증-실패-상태-전환)). 성공한 호출은 `last_error` 를 지우지 않는다. 실패마다의 자세한 기록은 활동 로그와 `mcpDiagnostics.errors` 에 있다.

## 활동 로그

통합 노드의 활동 로그(`IntegrationUsageLog`) 기록 방식은 AI 에이전트의 MCP 호출에도 적용한다. `tools/call` 1회당 1행을 쓰고, `node_execution_id` 는 호출 시점의 AI 에이전트 노드 실행이다. 컬럼 정의는 [통합 데이터와 흐름](CLE-INT-DATA.md#활동-로그-integration_usage_log)이 정한다.

| 필드 | 타입 | MCP 호출의 값 |
|------|------|----|
| `status` | enum | `success` / `failed` |
| `error` | jsonb? | 실패 때 `{ code, message }`([에러 코드](#에러-코드) 어휘). `message` 는 자격 증명 모양의 문자열을 가린 뒤 2KB 로 자른다. 가리는 대상은 Bearer 토큰, `Authorization` 헤더, URL userinfo(scheme 을 남겨 `scheme://***@host`), bare JWT, 이름이 붙은 `api_key`·`secret`·`token` 계열(`token`·`access_token`·`csrf_token`·`csrfToken`) key-value 등이다. 모두 공용 `SECRET_LEAK_PATTERNS`(`shared/utils/sanitize-error-message`)로 처리한다. MCP 전용 추가 패턴은 2026-08-17 기준 없다. `mcpDiagnostics.errors[].message` 와 `Integration.last_error` 의 `message` 도 같은 방식(`sanitizeMcpErrorMessage`)이다 |
| `duration_ms` | int | RPC 호출 단위 소요 시간 |
| `api_label` | `varchar(128)?` | 내부 MCP 브리지 경로는 카탈로그 키를 채운다(Cafe24 `cafe24.<resource>.<operation>`, MakeShop `makeshop.<resource>.<operation>`). 외부 MCP 서버 경로는 서버가 알린 원래 도구 이름 |
| `api_method` | `varchar(8)?` | 내부 MCP 브리지는 operation 의 HTTP 메서드, 외부 MCP 경로는 NULL |
| `api_path` | `varchar(256)?` | 내부 MCP 브리지는 operation 경로 템플릿, 외부 MCP 경로는 NULL |

`api_*` 세 컬럼의 채우기 규칙과 길이 한도는 [통합 데이터와 흐름](CLE-INT-DATA.md#호출-api-식별-채우기-규칙)이 단일 기준이다.

**API 식별 채우기는 호출하는 쪽의 명시 의무다**: 내부 MCP 브리지 경로는 노드 핸들러의 `IntegrationHandlerBase.logUsage`(api 인자를 자동으로 넘김)를 거치지 않는다. 도구 프로바이더(`Cafe24McpToolProvider`, `MakeshopMcpToolProvider`)가 `IntegrationsService.logUsage` 를 직접 부르므로 `api` 식별 정보를 직접 채워야 한다. 빠뜨려도 노드 핸들러 테스트는 통과하므로 사각지대가 된다. 채우는 값은 노드 핸들러와 같은 형식(카탈로그 키 + operation 메서드 + operation 경로)이다. 외부 MCP 서버 경로(`McpToolProvider`)도 같은 이유로 도구 이름을 직접 넘긴다.

메타 도구(`list_resources`·`read_resource`·`list_prompts`·`get_prompt`)는 활동 로그에 남기지 않는다. 외부 API 호출이라기보다 MCP 세션 안의 탐색 흐름이고, 매번 남기면 활동 탭의 신호보다 잡음이 커진다. 따로 대시보드가 필요해지면 별도 trace 로 들인다. `tools/list`·`resources/list`·`prompts/list` 같은 `buildTools` 단계의 준비 RPC 도 남기지 않는다.

dry-run 재실행에서 모의 응답으로 대신한 호출은 남기지 않고 실제로 부른 GET 내부 MCP 브리지 operation 은 남긴다([dry-run 재실행](CLE-INT-MCP-DRYRUN.md#기록과-집계)).

활동 로그 쓰기는 fire-and-forget 이다. `tools/call` 응답을 돌려준 직후 비동기로 보내 주 경로를 막지 않는다. DB 쓰기가 실패하면 삼키고 warn 로그만 남긴다.

## 인증 실패 상태 전환

`tools/call` 응답이 401·403(또는 `unauthorized`·`forbidden` 메시지)이면 다음을 함께 한다.

1. `tool_result` 의 `error` 를 `MCP_AUTH_FAILED` 로 LLM 에 넘긴다. 사용자 경험을 위해 호출 자체는 부드럽게 실패시킨다.
2. 활동 로그 `error.code = MCP_AUTH_FAILED` 로 남긴다.
3. 통합이 `error(auth_failed)` 가 아니면 `Integration.status` 를 `error` 로, `status_reason` 을 `auth_failed` 로 바꾼다. 다른 사유로 `error` 인 통합도 사유가 `auth_failed` 로 바뀐다. 조건(`status <> 'error' OR status_reason IS DISTINCT FROM 'auth_failed'`)을 건 UPDATE 한 번으로 `last_used_at` · `last_error` 와 함께 쓴다. 그러면 통합 관리 화면에 «주의 필요» 배너가 자동으로 뜬다([통합 상태와 만료 알림](CLE-INT-STATUS.md#주의-필요-배너)). 이미 `error(auth_failed)` 인 통합은 `last_used_at` · `last_error` 만 고친다.
4. 3단계의 UPDATE 가 행을 바꿨을 때만 조치 필요 알림(`integration_action_required`)을 보낸다. 이미 `error(auth_failed)` 였으면 보내지 않는다. 문구 · 수신자 · 중복 방지는 [만료 스캐너와 알림](CLE-INT-STATUS-SCAN.md#조치-필요-알림-integration_action_required) 이 정한다.

이 정책은 refresh token 이 없는 토큰 모델인 외부 MCP 서버에만 적용한다. `error → connected` 자동 복구는 하지 않는다. 토큰이 다시 유효해지면 사용자가 자격 증명 교체나 OAuth 통합 재인증으로 `connected` 로 되돌린다. 자동 복구를 들이면 만료된 토큰이 잠깐 살아나는 시각 경쟁(race-of-clock) 상황에서 상태가 깜빡여 운영 가시성을 해친다.

**내부 MCP 브리지 예외(refresh token 이 있는 프로바이더)**: Cafe24 처럼 자체 OAuth refresh token 이 있는 프로바이더의 401 은 이 정책 대신 [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md#인증-실패-처리)의 «토큰 갱신 + 1회 재시도» 자가 회복 정책을 쓴다([MCP 클라이언트 Rationale](CLE-INT-MCP.md#내부-mcp-브리지와-자가-회복-예외)). 403(권한 범위·권한 부족)은 내부 MCP 브리지도 이 절과 똑같이 즉시 격하한다. 다만 위 1~4단계를 거치지 않는다. Cafe24 · MakeShop API 클라이언트의 `markAuthFailed` 가 상태를 바꾸고 조치 필요 알림을 계기 `api_call` 로 보낸다([만료 스캐너와 알림](CLE-INT-STATUS-SCAN.md#조치-필요-알림-integration_action_required)). 도구 결과와 활동 로그의 코드는 `MCP_AUTH_FAILED` 가 아니라 `CAFE24_AUTH_FAILED` · `MAKESHOP_AUTH_FAILED` 다. 계기 `mcp_call` 은 외부 MCP 서버의 `tools/call` 에만 쓴다. 이 분기의 결정 근거는 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md#401-을-받으면-갱신하고-한-번-다시-보낸다)에 있다.

실패 한 번으로 상태를 바꾸는 것은 기존 OAuth 통합 정책과 같고 의도한 것이다. 외부 MCP 서버에만 해당한다. 임계값(예: 연속 3회)을 들일지는 반복 실패 비용과 상태 가시성 사이의 trade-off 를 분석한 뒤 따로 정한다.

## Rationale

### 타임아웃을 `TimeoutError` 로 분류한다

`withTimeout` 의 soft deadline 과 connect 단계 AbortController 만료를 모두 `TimeoutError` 하위 클래스로 맞췄다. 호출하는 쪽은 message 문자열을 맞춰 보지 않고 `instanceof` 로 타임아웃과 다른 실패를 확실히 가른다(`MCP_TIMEOUT` 대 `MCP_CONNECT_FAILED`·`MCP_CALL_FAILED`). 하위 호환을 위해 여전히 `Error` 이고 message 형식도 그대로다.

### 에러 message 가리기는 공용 패턴을 다시 쓴다

사용자에게 보이는 곳(`mcpDiagnostics.errors[].message` 등)으로 나가는 외부 MCP 에러 문자열의 비밀 가리기는 공용 `SECRET_LEAK_PATTERNS`(`shared/utils/sanitize-error-message`)를 다시 쓴다. 공용이 다루지 않는 MCP 특화 경우만 얇게 얹는 훅(`MCP_EXTRA_SECRET_PATTERNS`)을 둔다. 별도 가리기 로직을 새로 두지 않은 이유는 이렇다. 비밀 패턴은 보안상 민감한 단일 기준이라, 나뉘면 «공용에 새 패턴을 더했는데 MCP 는 빠짐» 같은 유지보수 위험이 커진다. 길이 상한만 MCP 는 2048(공용 200 과 별개)로 다르게 둔다. MCP 서버 에러가 더 길 수 있어 진단성을 지키려는 것이다.

URL userinfo(`scheme://user:pass@host`) 패턴과 쿼리의 bare `token=` 은 원래 MCP 전용 목록에 있었다. 공용 패턴이 같은 형태를 흡수하면서 MCP 전용 목록에서 뺐다(2026-07-10, 2026-08-17). 공용 이름 붙은 패턴이 `token` 계열 전체(`[A-Za-z0-9_-]*token`: bare `token`·`access_token`·`csrf_token`·`csrfToken`)로 넓어졌기 때문이다. `?token=abc&foo=bar` 가 공용 패턴만으로 `?***&foo=bar` 가 되는 것을 확인했다. 그래서 `MCP_EXTRA_SECRET_PATTERNS` 는 비었지만 훅은 남긴다. MCP 서버는 제3자 구현이라 공용이 모르는 형태를 언제든 돌려줄 수 있다. 그때 여기에 한 줄 얹는 편이 공용 단일 기준을 MCP 사정으로 넓히는 것보다 안전하다.

### 인증 실패는 상태를 바꾼 호출만 알린다

결정일: 2026-11-14

3단계를 조건부 UPDATE 로 하고 행이 바뀐 호출만 알리는 근거는 [만료 스캐너와 알림](CLE-INT-STATUS-SCAN.md#mcp-도구-호출의-인증-실패도-조치-필요-알림을-보낸다) 에 있다. 동시에 실패한 두 호출이 알림을 두 번 보내지 않게 하려는 것이다. 다른 사유의 `error` 도 `auth_failed` 로 바꾸는 근거도 같은 절에 있다.

### `last_error` 는 모든 `tools/call` 실패를 남긴다

결정일: 2026-11-14

승인본(v1)은 `Integration.last_error` 에 상태 전이를 일으킨 에러만 남기고 일반 호출 실패는 활동 로그와 `mcpDiagnostics.errors` 로 충분하다고 적었다. 그런데 `IntegrationsService.logUsage` 는 실패한 호출마다 `last_error` 를 `{ code, message, at }` 로 고친다. 코드 이력으로 보면 2026-05 저장소 재배치 이전부터 그랬다. 옛 서술은 처음부터 구현과 어긋나 있었다. 이번 개정에서 스펙을 구현에 맞췄다(NERV Task `CLE-T-184JJD`).

- **기각한 안**: 구현을 옛 서술에 맞춰 상태 전이를 일으킨 에러만 남기는 안. 기존 동작을 바꾸는 일이라 이번 Task 범위 밖이다.
- **가림과 자르기는 활동 로그와 같다**: MCP 도구 프로바이더(`mcp-tool-provider.ts`)가 `sanitizeMcpErrorMessage`(공용 `SECRET_LEAK_PATTERNS`)로 가린 message 를 `logUsage` 에 넘긴다. `logUsage` 는 그 message 를 `clampMessage` 로 `MCP_ERROR_MESSAGE_MAX_LEN`(2048자)에서 자른다. 그래서 [활동 로그](#활동-로그) `error` 행에 적은 가림과 2KB 자르기가 `last_error` 에도 똑같이 적용된다.

### 크기 상한 서술을 구현에 맞췄다

결정일: 2026-11-26

승인본(v5)까지는 크기 상한을 텍스트 100KB · 바이너리 1MB 로 나누고, 잘라 낸 결과 끝에 `[truncated: original_size_bytes]` 를 붙이고 `mcpDiagnostics` 에 경고를 남긴다고 적었다. 구현(`McpToolProvider.successResult`)은 처음부터 직렬화한 길이 하나로 판정하고 결과를 `MCP_RESPONSE_TOO_LARGE` 와 미리보기로 바꾸며 진단 경고는 남기지 않는다. [API 에러 코드 — 통합 노드](../CLE-API/CLE-API-ERRCODES-INTNODE.md) 카탈로그도 구현 쪽 설명이었다. 이번 개정에서 이 문서를 구현과 카탈로그에 맞췄다(NERV Task `CLE-T-EPJQS7`).

- **기각한 안**: 구현을 옛 서술에 맞춰 바이너리 상한과 진단 경고를 더하는 안. 기존 동작을 바꾸는 일이라 이 Task 범위 밖이다. 필요해지면 따로 Task 로 연다.

### 내부 MCP 브리지의 인증 실패는 API 클라이언트가 맡는다

결정일: 2026-11-26

내부 MCP 브리지 도구는 Cafe24 · MakeShop API 클라이언트를 거쳐 부른다. 클라이언트가 401 갱신 재시도와 403 격하를 노드 실행과 같은 경로로 처리하므로 상태 전환과 알림도 클라이언트의 `markAuthFailed` 한 곳에서 한다. 그래서 노드로 부른 실패와 도구로 부른 실패가 같은 상태 · 같은 `last_error` 코드 · 같은 알림 문구로 남는다. 이 문서의 1~4단계(`logUsage` 의 `MCP_AUTH_FAILED` 전환과 계기 `mcp_call`)는 외부 MCP 서버에만 해당한다([만료 스캐너와 알림](CLE-INT-STATUS-SCAN.md#조치-필요-알림-integration_action_required)).

- **기각한 안**: 브리지 도구에도 1~4단계를 적용해 `MCP_AUTH_FAILED` 로 전환하는 안. 같은 통합의 실패가 노드로 부르면 `CAFE24_AUTH_FAILED`, 도구로 부르면 `MCP_AUTH_FAILED` 로 갈리고 알림이 두 번 나갈 수 있다. 구현도 그렇게 되어 있지 않다.

### 외부 MCP 도구 호출의 `api_label` 은 도구 이름이다

결정일: 2026-11-28

전에는 외부 MCP 도구 호출이 `api` 를 넘기지 않아 `api_label` 이 NULL 이었다. NERV Task `CLE-T-22PSME` 에서 사람이 서버가 알린 원래 도구 이름을 남기는 안을 골랐다. 채우기 규칙과 근거는 [통합 데이터 엔티티 「외부 MCP 도구 호출은 `api_label` 에 도구 이름을 남긴다」](CLE-INT-DATA-ENTITY.md#외부-mcp-도구-호출은-api_label-에-도구-이름을-남긴다) 에 있다.

- **기각한 안**: NULL 로 두는 이전 동작. 활동 탭에서 어떤 도구를 불렀는지 알 수 없다.
