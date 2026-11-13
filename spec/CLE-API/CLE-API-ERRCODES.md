---
id: "CLE-API-ERRCODES"
title: "에러 코드 규약과 카탈로그"
type: "convention"
version: 35
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API"
ancestors: ["CLE-VISION", "CLE-API"]
area: "CLE-API"
content_hash: "ec0baf0daf72ff2dd117efb0a8a91a87f563f00df07de87dca9ef1448b44a422"
read_as: "approved_fallback"
task: "CLE-T-YFDSY7"
source_paths: ["spec/5-system/3-error-handling.md", "spec/conventions/error-codes.md"]
mirror_sha256: "1196f85cbe35c044ec81799d405bda9a95e3fac911d5707f5d4c3bd1368950b7"
etag: "sha256-f8b0def8af11a5813e423a69ef98d1f463f6114359f4742d47c6699e0370b3eb"
---
> 구현 상태: 부분 구현 (LLM 세분화 코드 `LLM_AUTH_ERROR` · `LLM_MODEL_NOT_FOUND` · `LLM_CONTEXT_EXCEEDED` 는 미구현) · 원문: `spec/conventions/error-codes.md`, `spec/5-system/3-error-handling.md` (§1, Rationale 일부) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 에러 코드(error code, `error.code`)의 이름 규칙과 안정성 규율, 그리고 제품 전체의 에러 코드 카탈로그를 정한다. 이름 규칙(규칙 1~3)을 따르지 않지만 호환 때문에 유지하는 예외 등록 코드(historical artifact)와 더 이상 내보내지 않는 은퇴 코드(retired code)의 기록도 이 문서에 둔다.

**적용 범위**: 이 규율은 `ErrorCode` const 뿐 아니라 프로젝트 전체의 에러 코드 문자열에 적용한다. API·통합·OAuth 등에서 인라인 문자열로 발행하는 코드(`CAFE24_*`, `OAUTH_*` 등)도 포함한다.

**대표 표면은 둘이다.** 같은 파일(`nodes/core/error-codes.ts`)에 `ErrorCode` 와 `EngineErrorCode` 가 자매 const 로 있고 키가 겹치지 않는다(테스트로 고정). 파일 하나에 const 둘이라는 점이 설계의 핵심이다. `EngineErrorCode` 는 엔진만 발행하고 `ErrorCode` 는 주로 노드 핸들러가 쓰지만 엔진도 쓴다(예: `EXECUTION_TIME_LIMIT_EXCEEDED`). 그래서 카탈로그의 "엔진 수준 에러" 부류로 const 소속을 추론하지 않는다.

이 문서가 정하지 않는 것은 아래 문서가 정한다.

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
6. 의미가 갈리거나 새 조건이 생기면 새 코드를 만든다. 새 코드는 처음부터 의미가 정확한 이름을 붙여 뒤에 이름을 바꿀 압력을 만들지 않는다. 다만 같은 표면(같은 엔드포인트) 안에서 구분하면 리소스가 다른 워크스페이스에 있다는 것이 드러나는 조건은 같은 코드를 쓴다([`TRIGGER_NOT_FOUND` 를 다른 워크스페이스의 워크플로우에도 쓰는 이유](#trigger_not_found-를-다른-워크스페이스의-워크플로우에도-쓰는-이유-2026-10-05)). 표면이 다르면 같은 뜻도 다른 코드를 쓰는 카탈로그 관행(§6.19 의 `WORKFLOW_NOT_FOUND`)과는 부딪치지 않는다. 이 단서는 한 표면 안의 조건만 묶는다. 비활성 트리거의 `TRIGGER_INACTIVE`(410)와 비활성 워크플로우의 `WORKFLOW_INACTIVE`(410)처럼 다른 워크스페이스 소속이 아닌 상태는 이 단서 밖이다. 이 규칙에는 예외가 하나 있다. 웹훅 인증(§6.10)에서 인증 설정의 기대값이 비었거나 문자열이 아니거나 읽지 못하는 경우와 헤더 이름이 문자열이 아닌 경우는 새 코드를 만들지 않고 `AUTH_FAILED` 를 쓴다. 이 예외는 그 경우에만 쓰고 다른 조건이나 다른 표면으로 넓히지 않는다. 근거는 [웹훅 인증 설정의 기대값이 비었거나 읽지 못해도 `AUTH_FAILED` 를 쓴다](#웹훅-인증-설정의-기대값이-비었거나-읽지-못해도-auth_failed-를-쓴다-2026-10-31) 에 있다.
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

이름 규칙(규칙 1~3)을 따르지 않는 기존 코드를 여기에 등록한다. 부정확한 이름이지만 유지하는 활성 코드의 등록부다. 교체·은퇴한 옛 코드는 §5 에 둔다(목적이 다르다). 새 코드는 예외를 선례로 삼지 않는다. 기존 코드를 다시 쓰는 결정은 이름을 정하는 결정이 아니어서 이 등록부에 올리지 않는다. 예를 들어 규칙 6 의 예외(웹훅 인증의 `AUTH_FAILED`), 규칙 6 의 단서(같은 표면 안의 다른 워크스페이스 조건), 뜻이 같아 새 조건이 아닌 재사용이 그렇다.

| 코드 | HTTP | 이름이 부정확한 이유 | 실제 뜻 | 정의 문서 |
|---|---|---|---|---|
| `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` | 409 | `PRIVATE` 토큰이 역사적 흔적이다. 처음 만들 때는 Private 앱 한정이었으나 app_type 과 무관하게 넓어졌다 | 같은 `(workspaceId, mall_id)` 에 Cafe24 통합이 중복된다 | [OAuth 연결과 토큰 갱신 「`CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 이름을 유지한다」](../CLE-INT/CLE-INT-OAUTH.md#cafe24_private_app_already_connected-이름을-유지한다) |
| `CAFE24_PRIVATE_APP_USE_TEST_RUN` · `MAKESHOP_USE_SHOPSTORE_INSTALL` | 400 · 400 | 이름이 거절 조건이 아니라 사용자가 할 일을 적는다(Cafe24 Developers 의 「테스트 실행」, MakeShop 샵스토어 설치). 바꾸면 호환이 깨진다(§2) | 이 통합은 이 요청으로 OAuth 를 시작하지 않는다는 거절이다. Cafe24 코드는 Private 앱의 `oauth/begin` 이 `new` 가 아닌 모드로 오거나, 설치 대기 중인 Private 통합에 재인증(`POST /api/integrations/:id/reauthorize`)을 요청할 때 난다. MakeShop 코드는 본문에 자격 증명을 실은 `oauth/begin` 이 `new` 가 아닌 모드로 올 때 난다 | [OAuth 연결과 토큰 갱신 「`CAFE24_PRIVATE_APP_USE_TEST_RUN`·`MAKESHOP_USE_SHOPSTORE_INSTALL` 이름을 유지한다」](../CLE-INT/CLE-INT-OAUTH.md#cafe24_private_app_use_test_runmakeshop_use_shopstore_install-이름을-유지한다) |
| `CAFE24_PRIVATE_APP_INSTALL_PENDING` | 409 | `PRIVATE_APP` 토큰은 흔적이다. 거절을 가르는 것은 앱 유형이 아니라 설치 대기 행의 주인이다. 이름이 상태 값 `pending_install` 처럼 읽히지만 이 코드는 거절이다. 프론트엔드가 이 코드로 안내 문구를 고르므로 바꾸면 호환이 깨진다(§2) | `oauth/begin`(`new`)이 같은 mall 의 설치 대기 행을 다시 쓰려는데 그 행이 남의 개인 통합이다. `details` 에는 `pendingInstallExpiresAt` 만 싣고 통합 ID 와 App URL 은 싣지 않는다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드), [OAuth 연결과 토큰 갱신 「남의 개인 설치 대기 행은 409 로 거절한다」](../CLE-INT/CLE-INT-OAUTH.md#남의-개인-설치-대기-행은-409-로-거절한다-2026-10-24) |
| `MAKESHOP_INSTALL_PENDING` | 409 | 설치 엔드포인트 코드(`MAKESHOP_INSTALL_REPLAY` 등)와 같은 `MAKESHOP_INSTALL_` 접두를 쓰지만 설치 엔드포인트가 아니라 `oauth/begin` 이 낸다. 프론트엔드가 이 코드로 안내 문구를 고르므로 바꾸면 호환이 깨진다(§2) | `oauth/begin`(`new`)이 같은 `client_id` 의 설치 대기 행을 다시 쓰려는데 그 행이 남의 개인 통합이다. `details` 는 `CAFE24_PRIVATE_APP_INSTALL_PENDING` 과 같다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드), [OAuth 연결과 토큰 갱신 「설치 대기 행 재사용의 권한」](../CLE-INT/CLE-INT-OAUTH.md#설치-대기-행-재사용의-권한) |
| `CAFE24_404` · `CAFE24_422` · `CAFE24_4XX` · `CAFE24_5XX` · `MAKESHOP_404` · `MAKESHOP_422` · `MAKESHOP_4XX` · `MAKESHOP_5XX` | 없음 (노드 `output.error.code`) | 이름이 조건의 뜻 대신 HTTP 상태 번호를 적는다(규칙 1). 노드 출력 값이라 워크플로우가 이 값으로 분기할 수 있고 바꾸면 호환이 깨진다(§2) | Cafe24 · MakeShop API 가 2xx 가 아닌 상태로 답했다. `*_404` · `*_422` 는 그 상태이고 `*_5XX` 는 500~599, `*_4XX` 는 그 밖의 4xx 다. 401 · 403 · 429 는 API 클라이언트가 먼저 처리해 인증 실패 · 빈도 제한 코드가 된다(§6.22). AI 에이전트 도구 호출에서는 이 코드를 도구 결과에 싣지 않고 `mcpDiagnostics.errors[].code` 와 활동 로그, 통합 `last_error.code` 에 남긴다 | [Cafe24 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-CAFE24.md#에러-코드), [MakeShop 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#에러-코드) |
| `MCP_HTTPS_REQUIRED` | 200 (연결 테스트 결과 `code`) | 이름은 `https://` 가 아닌 URL 만 말한다. 실제로는 파싱할 수 없는 URL 과 사설 · loopback · 메타데이터 호스트(SSRF 차단)에도 난다. 코드를 나누는 일은 NERV Task `CLE-T-DDN3MS` 가 한다 | MCP 서버 URL 이 안전한 HTTPS 주소가 아니다. 두 연결 테스트(`POST /api/integrations/:id/test` · `POST /api/integrations/preview-test`)가 이 코드를 돌려준다. 노드 실행의 도구 목록 구성(`buildTools`)에서는 같은 실패가 `MCP_CONNECT_FAILED` 로 남는다 | [MCP 클라이언트 「에러 코드」](../CLE-INT/CLE-INT-MCP.md#에러-코드), [MCP 클라이언트 「연결 테스트」](../CLE-INT/CLE-INT-MCP.md#연결-테스트) |
| `invitation_not_found` · `invitation_expired` · `invitation_already_used` · `invitation_email_mismatch` · `rate_limited` | 404 · 410 · 410 · 400 · 429 (순서대로) | `lower_snake_case` 로 표기 규칙을 어긴다. 워크스페이스 초대 흐름 v1 에서 이 형태로 굳었고 프론트엔드(`invitations.ts` 의 `INVITATION_ERROR_CODES`)와 백엔드(`workspace-invitations.service.ts`, `auth.service.ts`)가 `code` 값으로 분기한다. 바꾸면 호환이 깨진다(§2) | 초대 토큰 없음·만료·사용됨·이메일 불일치·빈도 제한. **초대 API 한정**이다. 이 소문자 `rate_limited` 는 초대 흐름 전용이고 다른 영역의 `RATE_LIMITED` 와 별개다. 2026-09-25 에 발행처가 없던 `forbidden` 을 이 행에서 뺐다(`code: 'forbidden'` 0건). 초대 권한 부족은 `RolesGuard` 의 `ADMIN_REQUIRED` 다. 소유자가 아닌 요청자의 관리자 역할 초대 거부는 서비스 계층이 내는 대문자 `OWNER_REQUIRED`(§6.2)라 이 예외에 들지 않는다. `rate_limited` 발행처는 [미결 사항](#미결-사항) 참조 | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#초대-에러-코드) 의 초대 에러 코드 |
| `workspace_type_mismatch` · `already_a_member` · `invitation_already_pending` · `invitation_already_accepted` | 403 · 409 · 409 · 409 | `lower_snake_case`. 위 초대 토큰 코드와 같은 모듈(`workspace-invitations.service.ts`)의 초대 발급·재발송 흐름 코드다. 프론트엔드는 `code` 로 분기하지 않고 `message` 만 보이지만 정규화하면 같은 모듈의 다른 소문자 코드와 대소문자가 섞이고 호환 이득이 0이라 소문자를 유지한다(2026-06-28 결정) | non-team 워크스페이스에 초대 / 이미 멤버 / 같은 이메일의 대기 초대 경합(partial UNIQUE) / 이미 수락된 초대의 재발송·취소. **초대 발급·재발송·취소 API 한정**이다. 직접 추가 경로의 대문자 코드와 같은 뜻의 **별개 코드**다(§6.12) | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#초대-에러-코드) 의 초대 에러 코드 |
| `workspace_not_found` · `user_not_found` · `admin_required` | 404 · 404 · 403 | `lower_snake_case`. 위 두 행과 같은 초대 모듈이 조회·RBAC 단계에서 발행한다. 모듈 안 소문자 일관성을 위해 유지한다(등록부 완전성 차원의 등재) | 워크스페이스 없음 / 대상 사용자 없음 / 관리자 미만 권한. 2026-09-25 이후 `admin_required` 는 HTTP 로 나가지 않는다. 초대 라우트가 `RolesGuard` 의 `@Roles('admin')` 를 먼저 거쳐 `ADMIN_REQUIRED` 가 나기 때문이다. 서비스 계층의 `admin_required` 는 가드가 빠졌을 때만 닿는 두 번째 방어선이다. **초대 모듈 한정**이고 직접 추가·관리 경로의 `WORKSPACE_NOT_FOUND`·`USER_NOT_FOUND`(§6.4)와 별개 코드다 | [계정과 워크스페이스 데이터 흐름 「초대 발급」](../CLE-ACCT/CLE-ACCT-DATA.md#초대-발급). 세 코드는 도메인 문서에 적혀 있지 않아 이 행이 유일한 등재다 |
| `invalid_state` · `token_exchange_failed` · `email_required` · `server_error` (OAuth 콜백 `?error=`) | 없음 (302 리다이렉트) | `lower_snake_case`. 봉투의 `error.code` 가 아니라 로그인 OAuth 콜백이 `{frontend_url}/callback?error=<값>` 으로 보내는 **URL query 값**이다. v1 에서 굳었고 콜백 페이지가 이 값으로 분기한다(§2) | 소셜 로그인 콜백 실패 사유(state 불일치 / 코드 교환 실패 / 이메일 미제공 / 서버 에러). **로그인 OAuth 콜백 URL 한정**이고 통합 OAuth 의 `OAUTH_*` 봉투 코드와 별개다. `invalid_state` 는 §6.4 의 봉투 코드 `INVALID_STATE`(422, 상태 전이 불가)와 대소문자만 같고 뜻이 다른 별개 값이다 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) 의 OAuth 에러 처리 |
| `WORKER_HEARTBEAT_TIMEOUT` | 없음 (HTTP 무관. 엔진 수준 `error.code`, 실행 `failed`) | "HEARTBEAT" 는 워커가 주기적으로 보내는 별도 heartbeat 채널을 암시하지만 그런 채널은 만들지 않는다. 처음에는 부팅 때 30분 넘게 멈춘 `running` 실행을 실패 처리했다. 2026-07-04 에 부팅 경로는 rehydration 재구동(`recoverStuckExecutions`, 이 코드를 쓰지 않음)으로 바꾸고 이 코드는 BullMQ stalled 재배달(`maxStalledCount=1`)을 다 쓸 때 `finalizeStalledExhausted` 가 내도록 뜻을 다시 정의했다. 코드와 여러 문서가 값으로 참조하므로 바꾸면 호환이 깨진다(§2) | 활성 세그먼트 워커의 최종 실패로 실행이 `failed` 가 된다 | [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `AbortError` | 없음 (HTTP 무관. 노드 수준 `error.code`, 노드 실행 `cancelled`) | PascalCase 다. 우리가 정한 코드가 아니라 웹 표준 `AbortSignal` 이 던지는 `DOMException.name` 을 그대로 옮긴 값이다. fetch·SDK·DB 드라이버가 모두 이 이름으로 던지므로 정규화하면 엔진 분류 키(`error.name === 'AbortError'`)와 `code` 가 갈라진다. 여러 핸들러와 테스트가 값으로 참조한다(§2) | 노드의 외부 I/O 가 `abortSignal` 로 중단돼 노드 실행이 `cancelled` 가 된다. 엔진의 `ExecutionCancelledError`(DB 관측 취소 가드)는 같은 상태로 끝나지만 `code` 를 싣지 않는 별개 신호다. ForEach · Map · Parallel 이 실패한 회차 · 병렬 분기를 결과에 담을 때도 `name` 이 `AbortError` 인 에러는 이 값이다([Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#반복-결과-출력-구조)) | [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) |

## 4. 내부 분류 코드의 정규화

이 절의 코드는 §1 적용 범위 밖이다. 클라이언트에 나가지 않는 구현 내부 이름이므로 명명 위반 예외가 아니다.

이 절에는 서로 독립한 정규화 파이프라인 둘이 있다. 둘 다 "내부 분류 문자열을 발행 직전에 public 코드로 정규화한다" 는 형태는 같다. 그러나 정규화 함수도 목적지 필드도 다르므로 한쪽 표를 다른 쪽의 근거로 읽지 않는다.

| 절 | 파이프라인 | 정규화 함수 | 목적지 필드 |
|---|---|---|---|
| §4.1 | Code 노드 핸들러 내부 분류 | `LEGACY_TO_NORMALIZED` | 노드 `output.error.code` |
| §4.2 | 수동 트리거·웹훅 트리거 파라미터 검증 사유 | `toTriggerParameterErrorDetails` | 에러 응답 봉투의 `error.details[].code` |

### 4.1 Code 노드 내부 분류 → 노드 `output.error.code`

`classifyCodeNodeError` 가 내는 분류 문자열은 노드의 `output.error.code` 로 바로 나가지 않는다. `LEGACY_TO_NORMALIZED` 표가 발행 직전에 public 코드로 바꾼다(`code.handler.ts`). 그래서 노드 출력 계약에 영향이 없고 디버깅용으로 `output.error.details.legacyCode` 에만 남는다. 정식 public 코드는 가운데 열이다. 내부 이름을 더 정확하게 바꾸는 것은 클라이언트에 보이지 않으므로 안전하다.

| 내부 분류 코드 | 정규화한 public 코드 (노드 `output.error.code`) | 뜻 | 정의 문서 |
|---|---|---|---|
| `EXECUTION_TIMEOUT` | `CODE_TIMEOUT` | Code 노드 스크립트의 wall-clock 타임아웃 | [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md) |
| `EXECUTION_MEMORY_EXCEEDED` | `CODE_MEMORY_LIMIT` | isolate 메모리 하드 리밋 초과 (기본 128MB, `CODE_NODE_MEMORY_LIMIT_MB` 로 조정. isolated-vm 강제 종료) | [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md) |
| `CODE_RUNTIME_ERROR` | `CODE_EXECUTION_FAILED` | 그 밖의 사용자 코드 런타임 throw | [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md) |

**층 주의: 같은 이름 `EXECUTION_TIMEOUT`.** 이 표의 `EXECUTION_TIMEOUT` 은 Code 노드 핸들러 내부 분류 층 한정이고 노드 출력으로는 `CODE_TIMEOUT` 이 된다. 이와 별개로 엔진 수준의 EIA `execution.failed.error.code` 에는 같은 이름 `EXECUTION_TIMEOUT` 이 나온다(§6.5, [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md)). 그 엔진 수준 코드는 `LEGACY_TO_NORMALIZED` 관할이 아니다. 엔진 수준 누적 실행 시간 초과는 또 다른 코드 `EXECUTION_TIME_LIMIT_EXCEEDED` 다.

### 4.2 트리거 파라미터 검증 사유 → 봉투 `error.details[].code`

수동 트리거 파라미터 스키마 검증(`resolveTriggerParameters`)이 내는 내부 사유 문자열이다. `output.error.code` 가 아니라 에러 응답 봉투의 `error.details[].code` 로 정규화해 나가며 정규화 함수는 `toTriggerParameterErrorDetails`(`trigger-parameter.types.ts`)다.

| 내부 사유 | 정규화한 항목 코드 (`error.details[].code`) | 뜻 | 정의 문서 |
|---|---|---|---|
| `missing_required` | `MISSING_REQUIRED_FIELD` | `required: true` 파라미터 값 누락 | [수동 트리거 노드 「실행할 때의 검증」](../CLE-NODE-TRIG/CLE-NODE-MANUAL.md#실행할-때의-검증) |
| `coerce_failed` | `TYPE_COERCION_FAILED` | 선언한 타입으로 바꿀 수 없음 | [수동 트리거 노드 「실행할 때의 검증」](../CLE-NODE-TRIG/CLE-NODE-MANUAL.md#실행할-때의-검증) |
| `invalid_schema` | `INVALID_SCHEMA` | 파라미터 스키마 구조 위반 | [수동 트리거 노드 「실행할 때의 검증」](../CLE-NODE-TRIG/CLE-NODE-MANUAL.md#실행할-때의-검증) |
| `masked_value_resubmitted` | `MASKED_VALUE_RESUBMITTED` | 마스킹 마커가 그대로 다시 제출됨 | [응답 자격 증명 마스킹](CLE-API-EGRESS.md) |

**최상위 봉투 코드는 진입점이 정한다.** 이 표는 `details[]` 항목 코드만 다룬다. 같은 사유가 수동 트리거 세 경로에서는 `INVALID_TRIGGER_PARAMETERS`, 웹훅 진입점에서는 `INVALID_WEBHOOK_PAYLOAD` 로 감싸진다([수동 트리거 노드](../CLE-NODE-TRIG/CLE-NODE-MANUAL.md), [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md)).

## 5. 은퇴 코드

§2 는 이름 바꾸기를 호환성 파괴로 규정한다. 그래도 아래 코드는 흡수 조건을 충족해 교체했다. 옛 코드는 더 이상 발행하지 않고(코드베이스에서 완전히 제거) 이름 바꾸기 배경을 추적하는 이력으로만 남긴다.

- **"제거" 는 에러 코드로 내보내지 않는다는 뜻이다.** 같은 문자열이 다른 층(감사 사유값, 엔진 내부 분류 등)에 계속 살아 있을 수 있고 그런 잔존은 각 행의 비고에 적는다. 머리말에 일반화해 적으면 그 사실이 없는 행까지 매번 다시 확인하게 된다.
- 교체가 1:1 이 아닐 수 있다. 옛 코드 하나가 조건별로 여러 코드로 갈리면 대체 코드 칸에 조건을 함께 적는다.

**흡수 조건은 두 등급이다.** 어느 등급으로 들어왔는지 각 행의 비고에 적는다.

| 등급 | 조건 | 근거의 성격 |
|---|---|---|
| **A. 영향 부재 확인** | 소비자가 자사 클라이언트뿐이고(프론트엔드가 옛 코드와 새 코드를 모두 매핑) 외부 client 코드에 분기로 노출된 적이 없다. 문서 목록에만 노출된 코드는 새 코드로 맞춘다 | 배제 |
| **B. 잔여 위험 인수** | 저장소 밖 호출자를 원리적으로 배제할 수 없는 표면(워크스페이스 JWT 로 부를 수 있는 내부 REST 등)이지만 관측 가능한 범위(자사 프론트엔드 코드와 저장소 전수 grep)에서 분기 지점이 발견되지 않았고 남는 위험을 명시적으로 인수했다 | 미발견과 인수 |

- **현재 B 등급 행은 2건이다**: `INVALID_INPUT` → `INVALID_TRIGGER_PARAMETERS`(2026-08-22, `#1193`)와 `INVALID_PASSWORD` → `PASSWORD_REQUIRED`·`PASSWORD_INVALID`(2026-09-02). 개수를 세어 두는 자리이고 새 B 행을 더하는 사람은 이 숫자도 함께 고친다.
- **B 는 A 를 완화한 것이 아니라 별개 등급이다.** A 는 "영향이 없다" 를, B 는 "영향을 관측하지 못했다" 를 주장한다. 뒤의 것은 반증될 수 있으므로 사용자 결정이 필요하고 그 결정 사실을 행에 남긴다. B 행이 늘면 §2 의 안정성 보장이 실제로 약해지므로 B 는 예외로 세어야 하고 관행으로 굳히지 않는다.

| 옛 코드 | 대체 코드 | HTTP | 변경 | 비고 |
|---|---|---|---|---|
| `LLM_CONFIG_NOT_FOUND` | `MODEL_CONFIG_DEFAULT_MISSING` | 400 | 모델 설정 통합 작업 | id 를 지정하지 않았을 때 워크스페이스 기본 설정이 없는 경로. `resolveConfig`(chat/LLM) 전용이다. id 로 찾지 못한 경우(404)는 `MODEL_CONFIG_NOT_FOUND` 로 따로 나눴다. `resolveEmbedding` 의 워크스페이스 기본값 부재도 `MODEL_CONFIG_NOT_FOUND`(404)를 유지한다(리소스 부재, 사용자 결정 2026-06-12). 근거는 Rationale 의 모델 설정 코드 분리 항목 |
| `LLM_CONFIG_INVALID` | `MODEL_CONFIG_INVALID` | 400 | 모델 설정 통합 작업 | 접두어를 `MODEL_CONFIG_*` 로 맞췄다(LLMConfig 를 ModelConfig 로 1급 통합). 뜻과 상태 코드는 그대로다 |
| `INVALID_INPUT` | `INVALID_TRIGGER_PARAMETERS` | 400 | #1193 | **[등급 B, 잔여 위험 인수]** 수동 재실행(`POST /executions/:id/re-run`)의 `inputOverride` 검증 실패 봉투. 같은 검증을 쓰는 자매 두 경로(주 실행·저장)는 처음부터 `INVALID_TRIGGER_PARAMETERS` 였고 이 경로만 달랐던 어긋남을 맞췄다. **이 표에서 위험 등급이 가장 높다.** 근거는 등급 B 정의대로 관측 범위의 미발견이다(프론트엔드 `rerun-modal.tsx` 는 `RERUN_*` 넷만 매핑하고 이 코드는 일반 fallback, 나머지 노출은 사용자 가이드 두 곳). 잔여 위험을 명시 인수한 첫 사례(사용자 결정 2026-08-22)이므로 "공개 API 도 이름 바꾸기가 안전하다" 로 일반화하지 않는다 |
| `WORKSPACE_REQUIRED` | `WORKSPACE_ID_REQUIRED` | 400 | #566 | 채팅 채널 `rotate-bot-token` 컨트롤러의 인라인 코드(`401`)를 공용 `@WorkspaceId()` 데코레이터 코드(`400`)로 맞췄다(상태 코드도 401 에서 400 으로 바로잡음). 사용자 문서 목록에만 노출됐고 client 하드코딩 분기가 없어 호환 영향은 0이다. 2026-08-08 에 이 엔드포인트에 `@Roles('editor')` 가 붙은 뒤로는 워크스페이스 문맥이 없으면 전역 가드 `RolesGuard` 가 먼저 돌아 `403 FORBIDDEN` 으로 거부한다. 그래서 대체 코드 `400 WORKSPACE_ID_REQUIRED` 도 이 엔드포인트에서는 나지 않는다(§6.15, 2026-11-12 정정). 경위는 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 의 「R-CC-18 rotate-bot-token 의 워크스페이스 검증은 공용 데코레이터로 한다」 Rationale 에 있다 |
| `INVALID_PASSWORD` | **조건별 두 코드**: `PASSWORD_REQUIRED`(비밀번호 미설정, OAuth 전용 계정) · `PASSWORD_INVALID`(현재 비밀번호 불일치) | 401 | 비밀번호 변경 코드 분리 작업 | **[등급 B, 잔여 위험 인수]** `POST /users/me/change-password` 가 두 조건에 같은 코드를 던지던 것을 형제 흐름(`verifyPasswordForUser`)과 같은 두 코드로 갈랐다. 새 코드는 만들지 않았다. 새로 만드는 안(`PASSWORD_NOT_SET`)은 비슷한 이름을 넷으로 늘리고 그 이름이 이미 `login_history.failure_reason` 감사값이라 같은 이름 충돌을 다시 만든다. 내부 REST 라 저장소 밖 호출자를 배제할 수 없어 등급 B 다(프론트엔드 분기 0건은 부재가 아니라 미발견). 사용자 결정 2026-09-02. **문자열은 남는다**: `INVALID_PASSWORD` 는 로그인 실패(`AuthService.login`)의 `login_history.failure_reason` 감사값으로 계속 기록된다. 감사값 정리는 `login_history` enum 변경을 동반하는 별개 작업이다([계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md)) |

## 6. 카탈로그

제품 전체의 에러 코드 목록이다. 코드마다 그 코드를 정의하거나 발행하는 문서를 "정의 문서" 열에 적는다. 발생 조건의 상세는 정의 문서가 정하고 이 카탈로그는 제품 전체에서 코드를 찾을 수 있게 등재한다.

**표의 열은 절마다 다르다.** 기본은 `코드 | HTTP | 설명 | 정의 문서` 다. §6.1 은 HTTP 열 대신 `이름` · `사용자 메시지` 열을 둔다. §6.2 는 `이름` 열을 더하고 HTTP 를 설명 뒤에 둔다. §6.4 도 HTTP 를 설명 뒤에 둔다. §6.5 ~ §6.8 에는 HTTP 열이 없다. 실행 상태나 WebSocket 으로 나가는 코드이기 때문이다. §6.25 도 SSE 이벤트로 나가는 코드라 HTTP 열이 없다. HTTP 로도 나가는 행은 설명에 상태 코드를 적는다(§6.7 의 `SERVER_SHUTTING_DOWN` · `EXECUTION_ENQUEUE_FAILED`). 더하는 열은 §6.5 첫 표의 `앵커`, §6.6 의 `부류`, §6.9 의 `비고`, §6.10 의 `상태` 다. §6.13 은 세부 코드(`details.code`)를 행으로 두고 봉투 `code` 와 HTTP 를 한 열에 적는다.

**같은 뜻을 표면마다 다른 코드로 적는다.** 상태 불일치는 REST 핵심 API 가 `INVALID_STATE`(422), WebSocket 이 `INVALID_EXECUTION_STATE`, EIA REST `/interact` 가 `STATE_MISMATCH`(409)다. 메시지 길이 초과도 WebSocket 은 `EXECUTION_MESSAGE_TOO_LONG`, EIA REST 는 `MESSAGE_TOO_LONG` 이다. 라우팅 분기를 드러내려고 일부러 나눴다([큐 워커와 동시 실행 제한 「발행 전 사전 검증」](../CLE-EXEC/CLE-EXEC-WORKER.md#발행-전-사전-검증), [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) 의 「WS 코드와 EIA 코드는 경로마다 다르게 쓴다」 Rationale).

**HTTP 진입점에서만 쓰는 `EXECUTION_ENQUEUE_FAILED` 는 표면마다 나누지 않는다.** REST `stop`, EIA REST `/interact`, 채팅 채널 인바운드의 `/start` 가 이 503 을 같은 코드로 낸다(§6.7). 세 진입점 모두 재개 메시지를 큐에 넣지 못했다는 같은 뜻이다. 클라이언트가 할 일도 다시 보내기 하나다. 이 코드는 실행 엔진 사전 검증의 결과가 아니라 큐 상태를 알린다. 그래서 위에서 표면마다 나눈 코드와 부류가 다르다. 같은 503 선례인 `SERVER_SHUTTING_DOWN`(§6.7)은 REST 의 실행 시작 진입점만 낸다. 근거는 [`EXECUTION_ENQUEUE_FAILED` 를 EIA `/interact` 재개 명령에도 쓴다](#execution_enqueue_failed-를-eia-interact-재개-명령에도-쓴다-2026-10-09) Rationale 에 있다.

### 6.1 시스템

| 코드 | 이름 | 설명 | 사용자 메시지 | 정의 문서 |
|------|------|------|--------------|-----------|
| `INTERNAL_ERROR` | 내부 서버 에러 | 예상하지 못한 서버 에러. 5xx 기본 코드. 클라이언트가 분기할 수 없는 예상된 내부 거부도 이 코드로 보낸다([시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 25 · 27) | "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) |
| `SERVICE_UNAVAILABLE` | 서비스 불가 | 의존 서비스에 접근할 수 없음. 로그인 2단계 Passkey 인증 검증(`POST /api/auth/2fa/webauthn/authenticate/verify`)에서 Passkey 인증 챌린지를 기록하지 못할 때 낸다. 기록하지 못하는 조건은 [가입과 로그인 「Passkey 등록·인증 흐름」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#passkey-등록인증-흐름) 이 정한다 | "서비스를 일시적으로 사용할 수 없습니다." | [HTTP API 규약](CLE-API-CONV.md) 의 「6. HTTP 상태 코드」, [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `DATABASE_ERROR` | DB 에러 | 데이터베이스 연결·쿼리 실패. 발행처는 [미결 사항](#미결-사항) 참조 | "데이터 처리 중 오류가 발생했습니다." | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) |
| `RATE_LIMITED` | 요청 빈도 제한 | 요청 빈도 제한 초과. 429 기본 코드 | "요청이 너무 많습니다. {retry_after}초 후 다시 시도해 주세요." | [HTTP API 규약](CLE-API-CONV.md) |

### 6.2 인증·인가

| 코드 | 이름 | 설명 | HTTP | 정의 문서 |
|------|------|------|------|-----------|
| `AUTH_REQUIRED` | 인증 필요 | 토큰 없음. 401 기본 코드. 현재 구현은 만료된 액세스 토큰도 코드 없이 거부해 이 코드가 나간다 | 401 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) |
| `TOKEN_EXPIRED` | 토큰 만료 | 리프레시 토큰 단순 만료. 재사용 감지와 달리 세션 무효화·이력 기록 없이 거부한다(Rationale "`TOKEN_EXPIRED` 설명") | 401 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) |
| `TOKEN_INVALID` | 토큰 무효 | 변조·형식 에러, refresh 토큰이 없거나 소유자가 없음, 또는 refresh 회전 때 조건부 폐기가 0건과 맞음(같은 토큰을 동시에 회전하는 경합) | 401 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md), [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) |
| `FORBIDDEN` | 권한 없음 | 역할 권한 부족(일반). 403 기본 코드 | 403 | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) |
| `ADMIN_REQUIRED` | 관리자 권한 필요 | 워크스페이스 소유자·관리자 역할이 필요할 때 쓰는 `FORBIDDEN` 의 맥락 특화 코드. `RolesGuard` 의 `@Roles('admin')` 미달, `WorkspacesService.assertAdmin()`, `IntegrationsService` 의 조직 통합 변경 판정이 발행한다. 통합 OAuth 에서도 세 곳이 낸다. 관리자 미만 요청자가 조직 공개 범위로 `oauth/begin`(`new`)을 부를 때(다시 쓸 설치 대기 행을 찾기 전, REQ-INTOAUTH-064), `oauth/begin`(`new`)으로 조직 통합의 설치 대기 행을 다시 쓰려 할 때(REQ-INTOAUTH-062), 콜백의 커밋 직전 재판정(`assertOrgScopeModifiable`, REQ-INTOAUTH-026)이다. 콜백은 HTML 로 답하고 코드는 통합의 `last_error.code` 에 남긴다(§6.21) | 403 | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md), [통합 관리](../CLE-INT/CLE-INT-MANAGE.md), [OAuth 연결과 토큰 갱신 「설치 대기 행 재사용의 권한」](../CLE-INT/CLE-INT-OAUTH.md#설치-대기-행-재사용의-권한), [OAuth 연결과 토큰 갱신 「에러 매핑」](../CLE-INT/CLE-INT-OAUTH.md#에러-매핑) |
| `EDITOR_REQUIRED` | 편집자 권한 필요 | 편집자 이상 역할이 필요할 때 쓰는 `FORBIDDEN` 의 맥락 특화 코드(`RolesGuard` 의 `@Roles('editor')` 미달). 통합 관리에서는 뷰어가 쓰기 라우트(생성 · 별칭 수정 · 자격 증명 교체 · 통합 재인증 · 추가 권한 요청 · 저장 전 연결 테스트)나 `oauth/begin`(REQ-INTOAUTH-063)을 부르면 라우트 가드가 대상의 공개 범위와 상관없이 이 코드를 낸다. 통합 OAuth 콜백의 커밋 직전 재판정(`assertPersonalWriteRole`, REQ-INTOAUTH-026)도 낸다. 개인 통합을 재인증하는 요청자의 역할이 편집자 미만이거나 역할을 모를 때(멤버가 아니게 됐거나 조회하지 못함)다. 콜백은 HTML 로 답하고 코드는 통합의 `last_error.code` 에 남긴다(§6.21) | 403 | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md), [통합 관리 「권한」](../CLE-INT/CLE-INT-MANAGE.md#권한), [OAuth 연결과 토큰 갱신 「에러 매핑」](../CLE-INT/CLE-INT-OAUTH.md#에러-매핑) |
| `OWNER_REQUIRED` | 소유자 권한 필요 | 소유자만 하는 동작을 소유자가 아닌 멤버가 요청함. 가드(`@Roles('owner')` 미달)와 서비스 계층(소유자 이양 재검증, 관리자 역할 규칙)이 함께 내고 메시지는 발행처마다 다르다 | 403 | [워크스페이스와 멤버 「가드 거부 에러 코드」](../CLE-ACCT/CLE-ACCT-WS.md#가드-거부-에러-코드), [워크스페이스와 멤버 「관리자 역할 규칙」](../CLE-ACCT/CLE-ACCT-WS.md#관리자-역할-규칙) |
| `LOGIN_FAILED` | 로그인 실패 | 잘못된 자격 증명 | 401 | [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-코드) |
| `ACCOUNT_LOCKED` | 계정 잠김 | 로그인 시도 초과(5회 실패 시 10분). `UnauthorizedException` 이다(Rationale "423 오기 정정") | 401 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `EMAIL_VERIFICATION_REQUIRED` | 이메일 인증 필요 | 비밀번호는 맞지만 이메일 인증을 마치지 않은 계정의 로그인. 비밀번호가 틀리면 `LOGIN_FAILED` 다 | 401 | [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-코드) |
| `NOT_A_MEMBER` | 워크스페이스 비멤버 | 대상 워크스페이스 멤버십 검증 실패. `RolesGuard` 의 멤버십 거부(헤더 위조, 경로 워크스페이스, 없는 워크스페이스를 구분하지 않고 요구 역할과도 무관)와 전환(`/api/auth/workspaces/:id/switch`)·탈퇴·멤버십 확인 경로(`auth.service`, `workspaces.service`)가 발행한다. 통합 행을 만드는 트랜잭션의 첫 잠금(`integration-owner-write-lock.ts`)도 이 코드를 낸다. 통합 생성과 Cafe24 Private · MakeShop `oauth/begin` 의 설치 대기 행 쓰기에서 개인 통합을 만드는 요청자가 그 사이 나갔거나 제거됐을 때와 워크스페이스가 그 사이 지워졌을 때다. 워크스페이스가 지워진 경우는 조직 통합에도 해당한다 | 403 | [워크스페이스와 멤버 「가드 거부 에러 코드」](../CLE-ACCT/CLE-ACCT-WS.md#가드-거부-에러-코드), [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md), [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |

`NOT_A_MEMBER`·`EDITOR_REQUIRED`·`ADMIN_REQUIRED`·`OWNER_REQUIRED` 는 가드 거부 코드(guard rejection codes)다. 가드 거부에 전용 코드를 쓰게 된 결정은 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#가드-거부에-에러-코드를-붙인다) 의 「가드 거부에 에러 코드를 붙인다」 Rationale(2026-09-25)에 있고 403 응답 설명에 싣는 규칙은 [OpenAPI 문서화](CLE-API-SWAGGER.md) 의 새 엔드포인트 체크리스트에 있다. 이 가운데 `NOT_A_MEMBER`·`ADMIN_REQUIRED`·`OWNER_REQUIRED` 는 가드를 통과한 뒤 서비스 계층에서도 난다. 서비스 계층은 같은 뜻의 거부에 가드와 같은 코드를 쓴다. `EDITOR_REQUIRED` 도 서비스 계층에서 한 곳 난다. 라우트 가드를 거치지 않는 통합 OAuth 콜백의 커밋 직전 재판정이다. 예외는 초대 모듈이다. 초대 모듈(`WorkspaceInvitationsService`)의 서비스 계층 두 번째 방어선은 비멤버와 관리자 미만 멤버를 모두 §3 의 소문자 `admin_required` 로 거부한다. 초대 라우트는 가드가 먼저 `NOT_A_MEMBER` · `ADMIN_REQUIRED` 로 거부하므로 이 코드는 HTTP 로 나가지 않는다.

### 6.3 2FA·WebAuthn·계정 재인증·비밀번호 재확인 (도메인 문서 참조)

2FA(TOTP, WebAuthn/Passkey), 계정 재인증, 비밀번호 재확인 흐름이 함께 쓰는 코드다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `WEBAUTHN_DISABLED` | 503 | Passkey 기능이 꺼져 있을 때(환경 변수 미설정이고 폴백을 허용하지 않음) 가용성 조회(`GET /api/auth/2fa/webauthn/availability`)와 credential 목록 조회(`GET /api/auth/2fa/webauthn/credentials`)를 뺀 Passkey 엔드포인트 전체가 돌려준다. 목록 조회는 200 빈 목록이다. 로그인(`POST /api/auth/login`)도 Passkey 만 등록하고 TOTP 가 꺼진 계정이 로그인 1단계를 통과하면 이 코드로 거부한다. 운영자가 설정을 바꿀 때까지 회복되지 않으므로 재시도 대상이 아니다. 일시 장애가 아닌데 `503` 을 쓰는 예외는 [HTTP API 규약](CLE-API-CONV.md) 규칙 11 에 있다 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md#passkey-기능-켜기와-환경-변수) |
| `WEBAUTHN_VERIFY_FAILED` | 400 | Passkey 등록 검증 실패. 허용 목록 밖 알고리즘의 공개 키와 형식이 틀린 transport 목록(문자열 배열이 아니거나 NUL 문자가 든 경우)도 이 코드다 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `INVALID_OPTIONS_TOKEN` | 400 | WebAuthn register·verify 의 optionsToken(짧은 수명의 서명 토큰) 무효 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `CHALLENGE_INVALID` | 401 | 로그인 2단계의 챌린지 토큰(`challengeToken`, `mfa_challenge` JWT)이 만료 · 위조됐거나 2단계용 토큰이 아님. TOTP 검증(`POST /api/auth/login/totp`)과 Passkey 옵션 · 검증 · 복구 코드 경로가 함께 쓴다 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `CHALLENGE_METHOD_MISMATCH` | 401 | 로그인 2단계에서 챌린지 토큰(`challengeToken`)이 정한 방식과 다른 경로를 부름. TOTP 챌린지(`methods: ['totp']`)로 받은 토큰을 Passkey 옵션 · 검증 · 복구 코드 경로에 보낸 경우다 | [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-코드) |
| `WEBAUTHN_INVALID` | 401 | Passkey 로그인 2단계 검증 실패. 서명이 맞지 않는 응답과 이미 쓴 Passkey 인증 챌린지(`optionsToken` 의 `challenge`)로 온 검증도 이 코드이고 credential 을 지우지 않는다. counter 역행은 별도 코드 `WEBAUTHN_COUNTER_REGRESSION` 이다 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `WEBAUTHN_COUNTER_REGRESSION` | 401 | Passkey 로그인 2단계에서 처음 쓰는 Passkey 인증 챌린지로 온 응답이 서명 검증을 통과했는데 인증기의 sign counter 가 저장값 이하로 돌아감(저장값과 응답 값이 모두 0 이면 역행이 아니다). 서버가 그 credential 을 지우고 사용자의 리프레시 토큰을 모두 무효화한 뒤 이 코드로 거부한다. 로그인 이력 `failure_reason` 에는 같은 이름의 사유값이 남는다 | [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-코드) |
| `WEBAUTHN_REQUIRED` | 401 | TOTP 가 켜져 있고 Passkey 도 등록된 계정이 로그인 2단계 TOTP 검증(`POST /api/auth/login/totp`)을 부름. Passkey 가 있으면 TOTP 로 로그인할 수 없다. TOTP 가 꺼진 계정은 Passkey 가 있어도 먼저 `TOTP_NOT_ENABLED` 를 받는다. Passkey 기능이 꺼져 있으면 TOTP 로 로그인하므로 나지 않는다 | [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-코드) |
| `WEBAUTHN_CREDENTIAL_NOT_FOUND` (이름 변경 · 삭제) | 404 | 등록한 Passkey 의 이름 변경(`PATCH /api/auth/2fa/webauthn/credentials/:id`)이나 삭제(`DELETE` 같은 경로)에서 대상 credential 이 없거나 호출자의 것이 아님. 둘을 구분하지 않는다(존재 노출 방지) | [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-코드) |
| `WEBAUTHN_CREDENTIAL_NOT_FOUND` (로그인 검증) | 401 | 로그인 2단계 Passkey 검증(`POST /api/auth/2fa/webauthn/authenticate/verify`)에서 응답의 credential 이 그 사용자의 것이 아님. 이 401 은 `WEBAUTHN_INVALID` 로 옮기기로 정했다(표 아래) | [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-코드) |
| `RECOVERY_CODE_INVALID` | 401 | WebAuthn 복구 코드로 2FA 통과 실패 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `REAUTH_NOT_AVAILABLE` | 403 | 비밀번호 해시도 TOTP 도 없는 OAuth 전용 계정이라 계정 재인증 수단이 없음. Passkey 만 등록한 계정도 여기에 든다. 이메일 변경과 로그인 세션 강제 종료의 계정 재인증이 함께 쓴다 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) |
| `REAUTH_REQUIRED` | 400 | 계정 재인증 자격 증명이 없거나 부족함(비밀번호와 TOTP 어느 것도 검증할 수 없음. 비밀번호가 없는 계정에 비밀번호만 보낸 경우 포함) | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) |
| `PASSWORD_INVALID` | 401 | 비밀번호 재확인 **불일치**. 계정 재인증(`verifyReauth`), TOTP 설정 시작·2FA 비활성화·Passkey 등록 옵션(`POST /api/auth/2fa/webauthn/register/options`)·Passkey 복구 코드 재발급의 재확인(`verifyPasswordForUser`), 비밀번호 변경이 함께 쓴다 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) |
| `PASSWORD_REQUIRED` | 401 | 비밀번호가 **설정되지 않았거나(OAuth 전용) 입력되지 않음**. TOTP 설정 시작·2FA 비활성화·Passkey 등록 옵션(`POST /api/auth/2fa/webauthn/register/options`)·Passkey 복구 코드 재발급 같은 민감 동작의 `verifyPasswordForUser` 재확인과 비밀번호 변경이 함께 쓴다. 이 네 민감 동작의 라우트에서는 본문 검증이 미입력을 먼저 400 `VALIDATION_ERROR` 로 거른다. 그래서 그 라우트가 내는 `PASSWORD_REQUIRED` 는 계정에 비밀번호가 없다는 뜻이다. 불일치는 형제 코드 `PASSWORD_INVALID` 다. 계정 재인증의 입력 누락 `REAUTH_REQUIRED`(400, `verifyReauth`)와는 발행 헬퍼도 상태 코드도 다른 별개 코드다 | [세션과 토큰 「본인 확인 에러 코드」](../CLE-ACCT/CLE-ACCT-SESSION.md#본인-확인-에러-코드) |
| `TOTP_INVALID` | 401 | TOTP 코드 불일치. 계정 재인증, 로그인 2FA, TOTP 활성화 검증(`POST /api/auth/2fa/verify`), 2FA 비활성화(`POST /api/auth/2fa/disable`)가 함께 쓴다. 로그인 2FA 와 2FA 비활성화는 6자리 TOTP 코드나 TOTP 복구 코드를 받고 둘 다 맞지 않으면 이 코드다. 2FA 비활성화는 2FA 가 켜져 있지 않을 때도 이 코드를 낸다. TOTP 활성화 검증은 코드를 확인한 뒤 저장하기 전에 다른 TOTP 설정 시작 요청이 secret 을 바꾼 경우에도 이 코드를 내고 TOTP 를 켜지 않는다 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md), [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-코드) |
| `TOTP_NOT_ENABLED` | 401 | 로그인 2FA 챌린지(`AuthService.loginWithTotp`)에서 계정의 TOTP 가 꺼져 있거나 사용자가 없음. Passkey 만 등록하고 TOTP 를 켜지 않은 계정도 이 코드다. 로그인 2FA 챌린지 전용이고 클라이언트는 다시 로그인하게 안내한다. 2FA 비활성화에서 2FA 가 꺼져 있을 때는 이 코드가 아니라 `TOTP_INVALID` 다 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `TOTP_NOT_INITIALIZED` | 400 | TOTP 활성화 검증(`POST /api/auth/2fa/verify`, `TotpService.verifyAndEnable`)에서 사용자가 없거나 TOTP secret 이 없음. TOTP 설정 시작(`POST /api/auth/2fa/setup`)을 거치지 않고 활성화 검증을 부른 경우다. 설정 시작 뒤 10분이 지나 [대기 중인 TOTP secret](../CLE-ACCT/CLE-ACCT-SIGNIN.md#totp-켜기) 이 만료된 경우도 이 코드다. 이때 서버는 그 secret 과 설정 시작 시각을 비우고 인증 코드를 확인하지 않는다. 설정 시작 시각이 없는 대기 secret 도 만료로 본다. 클라이언트는 만료 안내를 보이고 설정 시작 단계로 돌아간다 | [가입과 로그인 「TOTP 켜기」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#totp-켜기) |
| `TOTP_ALREADY_ENABLED` | 409 | TOTP 가 이미 켜진 계정의 설정 시작(`POST /api/auth/2fa/setup`)과 활성화 검증(`POST /api/auth/2fa/verify`). secret 과 TOTP 복구 코드를 바꾸지 않는다. 바꾸려면 TOTP 를 끄고 다시 켠다 | [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-코드) |

- 이 표는 도메인 문서 본문에 문서화된 코드만 등재한다.
- 로그인 실패 자체는 `LOGIN_FAILED`(§6.2)로 돌려준다(`PASSWORD_INVALID` 아님). 감사 기록은 `login_history` 의 `event`(`totp_failed` 등 소문자 값)와 `failure_reason`(`TOTP_INVALID`, `INVALID_PASSWORD` 등 대문자 사유값)에 남는다([계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md)). 사유값과 응답 에러 코드는 별개 층이다. `TOTP_INVALID` · `WEBAUTHN_COUNTER_REGRESSION` 처럼 이름이 같은 값도 있고 `INVALID_PASSWORD` 처럼 응답에서는 다른 코드(`LOGIN_FAILED`)로 나가는 값도 있다. 알 수 없는 이메일로 로그인하면 `failure_reason` 은 `USER_NOT_FOUND` 이고 응답은 `LOGIN_FAILED`(401)다(`auth.service.ts`).
- **비슷한 이름 주의**: 비밀번호 재확인 계열 에러 코드는 셋이다(`PASSWORD_INVALID`, `PASSWORD_REQUIRED`, `REAUTH_REQUIRED`). 옛 `INVALID_PASSWORD` 는 2026-09-02 에 은퇴해 응답에 나가지 않는다(§5). 접미사가 같은 `WEBAUTHN_REQUIRED`(§6.3)는 이 계열이 아니다. 입력이 빠진 것이 아니라 TOTP 와 Passkey 가 모두 있는 계정의 TOTP 로그인을 막는 코드다. 로그인의 `EMAIL_VERIFICATION_REQUIRED`(§6.2)는 응답 에러 코드다. `EMAIL_NOT_VERIFIED` 는 같은 경우에 로그인 이력 `failure_reason` 에 남는 사유값이고 응답에는 나가지 않는다.
- **비슷한 이름 주의(TOTP 상태 코드)**: TOTP 상태 때문에 거부하는 코드는 셋이고 클라이언트가 할 일이 서로 다르다. `TOTP_ALREADY_ENABLED`(409)는 TOTP 가 이미 켜진 계정의 TOTP 설정 시작 · 활성화 검증이다. 클라이언트는 입력을 고치지 않고 켜진 상태를 다시 읽는다. `TOTP_NOT_ENABLED`(401)는 로그인 2단계 TOTP 검증 전용이고 클라이언트는 다시 로그인하게 안내한다. `TOTP_NOT_INITIALIZED`(400)는 대기 secret 없이(설정 시작 전이거나 10분이 지나 버림) 활성화 검증을 부른 경우이고 클라이언트는 설정 시작 단계로 돌아간다. 코드 불일치는 셋 가운데 어느 것도 아니고 `TOTP_INVALID`(401)다.
- **2FA 비활성화**: `POST /api/auth/2fa/disable` 의 인증 코드 실패는 새 코드 없이 `TOTP_INVALID`(401)를 쓴다. 확인 순서, 복구 코드 소비, 로그인 이력에 남기지 않는 규칙은 [가입과 로그인 「TOTP 끄기」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#totp-끄기) 가 정한다.
- **로그인 검증의 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 는 `WEBAUTHN_INVALID` 로 옮긴다.** 2026-11-12 에 정했고 아직 구현하지 않았다(NERV Task `CLE-T-ZPPWK4`). 구현되면 로그인 2단계 Passkey 검증은 응답의 credential 이 그 사용자의 것이 아닐 때도 401 `WEBAUTHN_INVALID` 를 낸다. 그러면 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 는 이름 변경 · 삭제의 404 하나만 남고 「(로그인 검증)」 행을 지운다.

### 6.4 유효성 검증

| 코드 | 설명 | HTTP | 정의 문서 |
|------|------|------|-----------|
| `VALIDATION_ERROR` | 요청 데이터 유효성 실패. 400 기본 코드. 발행 지점이 정해진 경우(`X-Workspace-Id` 형식 에러)는 아래 별도 행이다. 요청 본문의 참조 id 가 요청자의 워크스페이스나 같은 워크플로우 밖을 가리킬 때도 이 코드와 `details[].code='INVALID_FIELD'` 배열(아래 `INVALID_FIELD` 행)을 싣는다. 노드 생성 · 수정과 캔버스 저장에서 노드 `config` 의 통합 참조 자리에 쓸 수 없는 값(문자열이 아닌 값, 없는 통합, 이 워크플로우에서 쓸 수 없는 개인 통합)이 와도 같은 코드와 배열로 거절한다(`node-integration-ref-check.ts`) | 400 | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md), [데이터 모델 개요 §참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속), [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) |
| `PAYLOAD_TOO_LARGE` (요청 본문) | 요청 본문이 body-parser 한도를 넘음. 전역 기본 100KB, `/api/hooks/*` 인증 웹훅과 채팅 채널 트리거 1MB(`createHooksBodyParsers`). 채팅 채널 트리거는 `auth_config_id` 가 없어도 공개 웹훅의 32KB 추가 제한을 받지 않는다([웹훅 「요청 제한과 남용 방어」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#요청-제한과-남용-방어)). `GlobalExceptionFilter` 가 body-parser 의 413 을 표준 봉투로 바꾼다. `message` 는 내부 원문(`"request entity too large"` 등)을 싣지 않고 고정 문구 `"Request payload too large."` 만 돌려준다. 공개 웹훅의 32KB 추가 제한은 별도 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(§6.10) | 413 | [HTTP API 규약](CLE-API-CONV.md) 의 「6. HTTP 상태 코드」, [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) |
| `PAYLOAD_TOO_LARGE` (multipart 업로드) | 업로드 파일이 `FileInterceptor` 의 `limits.fileSize` 를 넘음(아바타 2MB, 지식 저장소 문서 50MB). Nest 가 multer 의 `LIMIT_FILE_SIZE` 를 `PayloadTooLargeException` 으로 바꾸고 `GlobalExceptionFilter` 가 상태 코드로 이 코드를 채운다. `message` 는 multer 원문(`"File too large"`)을 싣지 않고 요청 본문 행과 같은 고정 문구 `"Request payload too large."` 를 돌려준다([에러 응답과 클라이언트 처리](CLE-API-ERROR.md) 의 「`message` 에 내부 원문을 싣지 않는다」) | 413 | [내 프로필 「아바타」](../CLE-ACCT/CLE-ACCT-PROFILE.md#아바타), [HTTP API 규약](CLE-API-CONV.md) 의 「9. 파일 업로드」 |
| `FILE_REQUIRED` | 업로드 요청에 파일이 없거나 내용이 비어 있음(`file?.buffer?.length` 가 0). 확장자 불허(`INVALID_FILE_TYPE`)와 다른 코드다. 클라이언트가 취할 행동이 다르기 때문이다("파일을 고르세요" 와 "다른 형식으로 바꾸세요"). 메시지 문자열 파싱이 금지돼 있으므로 코드로 갈라야 분기할 수 있다. 현재 발행처는 아바타 업로드다 | 400 | [내 프로필](../CLE-ACCT/CLE-ACCT-PROFILE.md) |
| `INVALID_FILE_TYPE` | 확장자가 허용 목록에 없음. 지식 저장소 문서 업로드와 아바타 업로드가 함께 쓰고 허용 목록은 도메인마다 정한다(지식 저장소 `txt`·`md`·`pdf`·`csv`, 아바타 `png`·`jpg`·`jpeg`·`webp`·`gif`, SVG 제외) | 400 | [파일 저장소 「지식 저장소 문서」](../CLE-PLAT/CLE-PLAT-STORAGE.md#지식-저장소-문서), [파일 저장소 「아바타」](../CLE-PLAT/CLE-PLAT-STORAGE.md#아바타), [내 프로필](../CLE-ACCT/CLE-ACCT-PROFILE.md) |
| `WORKSPACE_ID_REQUIRED` | 워크스페이스 컨텍스트가 **없음**. `X-Workspace-Id` 헤더도 JWT `activeWorkspaceId` 클레임(옛 `workspaceId`)도 없다(`workspace.decorator.ts` 발행). 헤더가 있으나 형식이 깨진 경우는 아래 `VALIDATION_ERROR` 행이며 다른 경우다. 경로로 워크스페이스를 받지 않는 `@Roles()` 라우트(예: 채팅 채널 `rotate-bot-token`)는 가드가 먼저 돌아 이 코드 대신 403 `FORBIDDEN` 을 낸다([§6.15](#615-채팅-채널-봇-토큰-재발급-도메인-문서-참조)) | 400 | [워크스페이스와 멤버 「`X-Workspace-Id` 형식 검사」](../CLE-ACCT/CLE-ACCT-WS.md#x-workspace-id-형식-검사) |
| `VALIDATION_ERROR` | **`X-Workspace-Id` 형식 에러**. 헤더가 있으나 canonical UUID 형태(8-4-4-4-12 hex)가 아니면 일찍 거부한다. `RolesGuard` 와 `@WorkspaceId()` 가 함께 쓰는 헬퍼(`resolveRequestWorkspaceContext`) 한 곳에서 throw 한다(반환 플래그로 두면 두 경로의 응답이 갈라진다). 일찍 거부하지 않으면 그 값이 멤버십 조회까지 흘러가 `QueryFailedError`(SQLSTATE 22P02)가 되고 500 `INTERNAL_ERROR` 로 가려진다. **JWT 클레임은 검증하지 않는다.** 서버가 서명한 값이라 거기서 400 을 내면 서버 버그를 클라이언트 에러로 보고하게 된다. 검증을 경로 파라미터보다 느슨하게 하는 근거는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#x-workspace-id-헤더는-경로-파라미터보다-느슨하게-검사한다) 의 「`X-Workspace-Id` 헤더는 경로 파라미터보다 느슨하게 검사한다」 Rationale | 400 | [워크스페이스와 멤버 「`X-Workspace-Id` 형식 검사」](../CLE-ACCT/CLE-ACCT-WS.md#x-workspace-id-형식-검사) |
| `INVALID_TRIGGER_PARAMETERS` | 수동 트리거 parameters 스키마 검증 실패. **세 엔드포인트가 함께 쓴다**: 주 실행(`POST /workflows/:id/execute`), 저장(`POST /workflows/:id/save`, `validateManualTrigger`), 재실행의 `inputOverride`(`POST /executions/:id/re-run`). 셋 다 `resolveTriggerParameters` 가 던지는 같은 검증 실패를 감싸므로 같은 코드를 낸다. 필드별 사유는 `details[]`(§4.2, §6.10). 경로별로 `RERUN_` prefix 를 붙이지 않는 것은 의도다. 세 경로를 하나로 모으는 것이 이 코드가 있는 이유다. 최상위는 이 특화 코드이고 `details[].code` 에는 필드별 사유를 싣는다. [에러 응답과 클라이언트 처리 「2.6 top-level 이 이미 특화 코드일 때」](CLE-API-ERROR.md#26-top-level-이-이미-특화-코드일-때-2026-09-11) 의 판별 기준은 사유의 중복이다. 최상위는 "파라미터 검증 실패" 라는 묶음 사유이고 필드별 사유와 겹치지 않아 이 기준에 걸리지 않는다. 규칙 6 도 지킨다. 새 검증 사유가 생기면 최상위 코드는 그대로 두고 §4.2 에 새 항목 코드를 더한다 | 400 | [수동 트리거 노드](../CLE-NODE-TRIG/CLE-NODE-MANUAL.md), [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) |
| `MODEL_CONFIG_INVALID` | 모델 설정 입력 검증 실패. 알 수 없는 `kind`, 필수 프로바이더의 apiKey 누락, 사설망·loopback baseUrl(사설망 차단, tei·local 제외) 등. `model-config.service.ts`, `model-config.controller.ts`, `llm-preview.service.ts`(preview-models) 발행 | 400 | [모델 설정](../CLE-AI/CLE-AI-MODELS.md), [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |
| `RESOURCE_NOT_FOUND` | 리소스 없음. 404 기본 코드 | 404 | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) |
| `ALERT_RULE_NOT_FOUND` | 알림 규칙 없음. 워크스페이스 범위 안에서 규칙 id 를 찾지 못함. `alerts.service.ts` 가 `where: { id, workspaceId }` 로 조회하므로 다른 워크스페이스 규칙에 접근해도 같은 404 다(존재 누설 방지, `MODEL_CONFIG_NOT_FOUND` 의 종류 간 차단과 같은 형태) | 404 | [알림](../CLE-OBS/CLE-OBS-NOTIFY.md) |
| `MODEL_CONFIG_NOT_FOUND` | 지정한 id 의 모델 설정이 없거나 다른 종류(kind)에 접근해 차단됨(존재 누설 방지). id 지정 경로와 `resolveEmbedding` 의 워크스페이스 기본값 부재(지식 저장소 임베딩 설정 부재 = 리소스 부재)에 쓴다. `RESOURCE_NOT_FOUND` 의 모델 설정 특화 코드(`model-config.service.ts` 발행) | 404 | [모델 설정](../CLE-AI/CLE-AI-MODELS.md), [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md), [문서 임베딩 「임베딩 모델 해석」](../CLE-KB/CLE-KB-EMBED.md#임베딩-모델-해석) |
| `MODEL_CONFIG_DEFAULT_MISSING` | id 를 지정하지 않았는데 워크스페이스 기본 설정이 없음(설정 안내용). `resolveConfig` 의 chat/LLM 기본값 경로 전용이다. `resolveEmbedding` 의 기본값 부재는 `MODEL_CONFIG_NOT_FOUND`(404)를 쓴다(사용자 결정 2026-06-12) | 400 | [모델 설정](../CLE-AI/CLE-AI-MODELS.md). 이 코드는 도메인 문서에 적혀 있지 않다. [지식 저장소 관리](../CLE-KB/CLE-KB-MANAGE.md) 는 임베딩 기본값 부재(404)와 구분할 때만 이름을 든다 |
| `USER_NOT_FOUND` | 대상 사용자가 없음. `RESOURCE_NOT_FOUND` 의 사용자 특화 코드다. 사용자 API(`users.service.ts`, `users.controller.ts`), 알림 설정(`notifications.service.ts`), TOTP · Passkey(`totp.service.ts`, `webauthn.service.ts`), 멤버 직접 추가의 가입하지 않은 이메일(`workspaces.service.ts`)이 발행한다. 초대 모듈의 소문자 `user_not_found`(§3)와 별개 코드다. 로그인 감사값 `failure_reason='USER_NOT_FOUND'` 와는 문자열만 같다(§6.3) | 404 | [내 프로필](../CLE-ACCT/CLE-ACCT-PROFILE.md), [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md), [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |
| `WORKSPACE_NOT_FOUND` (관리 경로) | 멤버 · 관리자 · 소유자 검사를 통과한 뒤 대상 워크스페이스 행이 없음(`workspaces.service.ts`). 사실상 동시 삭제 경합에서만 난다. `RESOURCE_NOT_FOUND` 의 워크스페이스 특화 코드다. 초대 모듈의 소문자 `workspace_not_found`(§3)와 별개 코드다 | 404 | [워크스페이스와 멤버 「워크스페이스를 찾지 못할 때」](../CLE-ACCT/CLE-ACCT-WS.md#워크스페이스를-찾지-못할-때) |
| `WORKSPACE_NOT_FOUND` (토큰 검증) | 액세스 토큰은 유효한데 사용자가 쓸 워크스페이스가 하나도 없음(`jwt.strategy.ts`). 이 401 은 새 코드로 옮기기로 정했다(표 아래) | 401 | [워크스페이스와 멤버 「워크스페이스를 찾지 못할 때」](../CLE-ACCT/CLE-ACCT-WS.md#워크스페이스를-찾지-못할-때) |
| `RESOURCE_CONFLICT` | 리소스 충돌(이름 중복 등). 409 기본 코드 | 409 | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) |
| `DUPLICATE_NODE_LABEL` | 노드 라벨 중복. `RESOURCE_CONFLICT` 의 노드 라벨 특화 코드(`nodes.service.ts` 와 캔버스 일괄 저장 · 버전 복원 경로의 `workflows.service.ts` 발행). 버전 복원은 캔버스 저장과 같은 쓰기를 거친다 | 409 | [워크플로우 데이터와 저장 흐름](../CLE-WF/CLE-WF-DATA.md), [버전 기록](../CLE-WF/CLE-WF-VERSION.md) |
| `RESERVED_VARIABLE_NAME` | 변수 선언·변수 수정 노드의 변수 이름이 시스템 예약 `__` prefix 로 시작함(`variables.__*` 는 엔진 시스템 네임스페이스). **이 행은 저장 시점(L0)만 다룬다.** `saveCanvas`·`importWorkflow` 가 `details.offenders[]` 와 함께 HTTP 400 을 낸다(`restoreVersion` 은 옛 데이터 탈출구라 면제). 저장을 우회한 리터럴은 엔진 사전 검증(L1)에서 `INVALID_NODE_CONFIG` 가 된다(§6.5 표 아래). 표현식이 예약 이름으로 평가되는 런타임(L2)은 HTTP 와 무관하다. 핸들러가 `RESERVED_VARIABLE_NAME:` 메시지 prefix 로 throw 해 노드 실패로 기록되지만 구조화 `error.code` 는 없다 | 400 (저장) / 없음 (런타임) | [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md), [변수 선언 노드](../CLE-NODE-LOGIC/CLE-NODE-VARDECL.md), [변수 수정 노드](../CLE-NODE-LOGIC/CLE-NODE-VARSET.md) |
| `WORKFLOW_VERSION_CONFLICT` | 캔버스 저장이나 버전 복원이 같은 워크플로우에 동시에 버전을 만드는 경합. 버전 복원도 캔버스 저장과 같은 쓰기를 거쳐 버전을 만든다. 같은 워크플로우 버전 번호 unique 위반을 감지해 재시도 권고와 함께 돌려준다(`workflow-versions.service.ts` 발행) | 409 | [버전 기록](../CLE-WF/CLE-WF-VERSION.md) |
| `INVALID_VERSION_SNAPSHOT` | 버전 복원 때 버전 스냅샷 형식이 잘못됐다(`nodes` · `edges` 가 배열이 아니거나 `name` 이 있는데 문자열이 아니다). `workflows.service.ts` 의 `restoreVersion` 발행. 상태 코드는 등재 전부터 내던 400 을 그대로 적었다. 요청이 아니라 저장된 버전 스냅샷의 결함이라 [HTTP API 규약](CLE-API-CONV.md) 「6. HTTP 상태 코드」 의 422 · 500 과 결이 다르다. 상태 코드를 바꾸면 API 계약이 바뀌므로 등재와 함께 바꾸지 않았다 | 400 | [버전 기록](../CLE-WF/CLE-WF-VERSION.md) |
| `GRAPH_VALIDATION_FAILED` | 캔버스 저장(`POST /workflows/:id/save`)이나 버전 복원(`POST /workflows/:id/versions/:versionId/restore`)에서 심각도 `error` 인 그래프 경고 규칙이 하나 이상 걸림. 노드 · 연결선을 쓴 트랜잭션 안에서 평가하고 이 코드를 던져 저장을 되돌린다(`workflows.service.ts` 발행). 버전 복원은 옛 데이터 호환 게이트(수동 트리거 parameters 스키마, 예약 변수 이름)를 건너뛰지만 이 평가는 건너뛰지 않는다. `message` 는 `Graph validation failed: ` 뒤에 걸린 첫 규칙의 메시지를 싣고 `details.errors` 는 그 평가에서 심각도 `error` 인 결과를 모두 싣는다. AI 에이전트 노드의 도구 payload 예산 규칙은 `AI_AGENT_TOOL_BUDGET_STRICT_SAVE=true` 일 때만 `error` 로 올라 이 코드로 막힌다 | 400 | [그래프 경고 규칙](../CLE-WF/CLE-WF-WARN.md), [워크플로우 데이터와 저장 흐름](../CLE-WF/CLE-WF-DATA.md), [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) |
| `INVALID_STATE` | 상태 전이 불가(이미 실행 중인 워크플로우 삭제 등). 422 기본 코드. 표면별 같은 뜻 코드는 §6 머리말. 로그인 OAuth 콜백의 소문자 URL 값 `invalid_state`(§3, state 불일치)와 별개 코드다 | 422 | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md), [큐 워커와 동시 실행 제한 「발행 전 사전 검증」](../CLE-EXEC/CLE-EXEC-WORKER.md#발행-전-사전-검증), [실행 데이터와 흐름 「입력으로 재개」](../CLE-EXEC/CLE-EXEC-DATA.md#입력으로-재개) |
| `INVALID_FIELD` | 응답의 최상위 코드가 아니다. 400 응답의 `details` 안에서 문제 필드를 가리키는 필드 단위 표시다. `details` 가 배열이면 원소마다, 객체이면 그 객체에 `field` 와 `code: 'INVALID_FIELD'` 를 싣는다. 최상위 코드는 `VALIDATION_ERROR` 이고 트리거 인증 설정 연결만 `AUTH_CONFIG_NOT_FOUND`(§6.14)다. 클라이언트는 최상위 코드로 분기한다 | 없음 (400 응답 `details` 안의 `code`) | [에러 응답과 클라이언트 처리 「2.4 `details` 의 형태」](CLE-API-ERROR.md#24-details-의-형태), [에러 응답과 클라이언트 처리 「2.5 `field` 를 실으면 `code` 도 싣는다」](CLE-API-ERROR.md#25-field-를-실으면-code-도-싣는다-2026-09-11) |
| `INVALID_NOTIFICATION_URL` | 트리거 생성(`POST /api/triggers`)이나 수정(`PATCH /api/triggers/:id`) 본문의 `notification.url` 이 알림 URL 안전 검사를 통과하지 못함. `message` 에 거절 사유를 싣는다. 보내기 직전 검사에 걸린 알림은 이 코드를 내지 않는다. 보내지 않고 발송 건강도를 `degraded` 로 둔다 | 400 | [EIA 알림 웹훅 「SSRF 방지」](../CLE-IX/CLE-EIA-NOTIFY.md#ssrf-방지) |

**토큰 검증의 401 은 `NO_WORKSPACE_AVAILABLE` 로 옮긴다.** 2026-11-12 에 정했고 아직 구현하지 않았다(NERV Task `CLE-T-ZPPWK4`). 구현되면 액세스 토큰 검증은 쓸 워크스페이스가 하나도 없을 때 401 `NO_WORKSPACE_AVAILABLE` 을 낸다. 조건은 지금의 「`WORKSPACE_NOT_FOUND` (토큰 검증)」 행과 같다. 발행과 함께 이 코드를 표에 등재하고 그 행을 지운다. 관리 경로의 404 `WORKSPACE_NOT_FOUND` 는 그대로다. 이름을 고른 이유는 Rationale 에 있다.

**`X-Workspace-Id` 세 갈래**: 같은 헤더 하나가 세 갈래로 갈린다.

1. 헤더와 클레임이 **둘 다 없음**: `WORKSPACE_ID_REQUIRED`(400)
2. 헤더가 **있으나 형식이 깨짐**: `VALIDATION_ERROR`(400)
3. 헤더 **형식은 맞으나 비멤버**: `RolesGuard` 의 `NOT_A_MEMBER`(403)

(2)와 (3)의 경계가 곧 UUID 검증 강도 비대칭이다([워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#x-workspace-id-헤더는-경로-파라미터보다-느슨하게-검사한다) 의 「`X-Workspace-Id` 헤더는 경로 파라미터보다 느슨하게 검사한다」 Rationale). **적용 범위**: (1)과 (2)는 `@Roles()` 나 `@WorkspaceId()` 를 쓰는 인증 라우트에서만 생긴다. 둘 다 없는 워크스페이스 무관 전역 라우트는 `RolesGuard` 가 헤더를 읽기 전에 통과시키므로(`handlerConsumesWorkspaceId` 단축) 형식이 깨진 헤더가 실려도 400 이 아니라 무시된다. 프론트엔드 `apiClient` 가 모든 요청에 이 헤더를 습관처럼 붙이기 때문에 필요한 예외다. 단서가 둘 있다. 경로 파라미터로 워크스페이스를 받는 라우트(`@WorkspaceParam(...)`)는 `@WorkspaceId()` 를 함께 쓸 때만 헤더를 본다. 경로로 받는 워크스페이스가 없는 `@Roles()` 라우트에서 헤더와 클레임이 모두 없으면 (1)이 아니라 가드의 코드 없는 403(기본 코드 `FORBIDDEN`)이 된다. 라우트별 범위의 정본은 [워크스페이스와 멤버 「`X-Workspace-Id` 형식 검사」](../CLE-ACCT/CLE-ACCT-WS.md#x-workspace-id-형식-검사) 다.

### 6.5 워크플로우 실행: 엔진 수준

엔진 수준 에러다. 실행 상태가 `failed` 가 된다.

**이 표는 한 곳에 모여 등재된 코드를 뜻하지 않는다.** 앵커가 셋으로 갈린다. `ErrorCode` const(`EXECUTION_TIME_LIMIT_EXCEEDED`), `EngineErrorCode` const(`WORKER_HEARTBEAT_TIMEOUT` · `SERVER_INTERRUPTED`), 에러 클래스의 `readonly code`(`ERROR_PORT_FALLBACK`)다. 앵커 열이 `없음` 인 나머지 코드는 맨 문자열이라 오탈자가 `tsc` 를 통과한다. 앵커 열이 `메시지 접두` 인 행은 코드가 아니다. 엔진이 그 이름을 코드 필드에 싣지 않고 에러 메시지 앞에 쌍점과 함께 붙인다. 이 접두로 분기하지 않는다(규칙 4). 다른 모듈(`shadow-workflow.ts` 의 union, `execution-failure-classifier.ts` 의 목록)에도 같은 이름이 나오지만 그것은 소비자·분류기 쪽 어휘이지 엔진 발행 경로의 앵커가 아니다.

| 코드 | 앵커 | 설명 | 정의 문서 |
|------|------|------|-----------|
| `EXECUTION_TIMEOUT` | 없음 | Code 노드 스크립트 실행 타임아웃(엔진 수준. 실행 `failed`, EIA `execution.failed.error.code`). 노드 출력 층의 `CODE_TIMEOUT`, 누적 실행 시간 초과와의 구분은 §4.1 | [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md) |
| `EXECUTION_TIME_LIMIT_EXCEEDED` | `ErrorCode` | 실행 하나의 **누적 active-running 시간** 초과(wall-clock 아님, 입력 대기 시간 제외). 실행 `failed` | [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) |
| `WORKER_HEARTBEAT_TIMEOUT` | `EngineErrorCode` | 활성 세그먼트 job 이 BullMQ stalled 재배달(`maxStalledCount=1`) 시도를 다 씀(워커 최종 실패). 실행 `failed`. 2026-07-04 구현. 부팅 시 `recoverStuckExecutions` 재구동은 이 코드를 쓰지 않는다(재구동 불가는 `RESUME_CHECKPOINT_MISSING`). 이름의 경위는 §3 | [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `RECURSION_DEPTH_EXCEEDED` | 없음 | 서브 워크플로우 재귀 깊이 초과. 발행 형태는 [미결 사항](#미결-사항) 참조 | [워크플로우 호출 노드](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md) |
| `MAX_ITERATIONS_EXCEEDED` | 메시지 접두 | 코드가 아니다. Loop 노드가 최대 반복 횟수(`maxIterations`, 기본 1000)를 넘으면 메시지 앞에 붙는 접두다. 메시지는 `MAX_ITERATIONS_EXCEEDED: Loop count <count> exceeds maximum <maxIterations>` 나 `MAX_ITERATIONS_EXCEEDED: Loop iteration <i> exceeds maximum <maxIterations>` 다. 행을 남긴 이유는 Rationale 에 있다 | [Loop 노드 「에러」](../CLE-NODE-LOGIC/CLE-NODE-LOOP.md#에러) |
| `CYCLE_DETECTED` | 없음 | 워크플로우 그래프에 순환 감지 | [실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md) |
| `INVALID_EXPRESSION` | 없음 | 표현식 평가 실패 | [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) |
| `VARIABLE_NOT_FOUND` | 없음 | 참조한 변수가 없음 | [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) |
| `TYPE_MISMATCH` | 없음 | 데이터 타입 불일치 | [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) |
| `ERROR_PORT_FALLBACK` | 클래스 `readonly code` | 에러 포트로 보내려 했으나 연결된 연결선이 없어 Stop Workflow 로 폴백 | [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) |
| `SERVER_INTERRUPTED` | `EngineErrorCode` | 서버가 안전 종료(SIGTERM)할 때 유예 시간(`SIGTERM_GRACE_MS`, 기본 30초)이 지나도 이 인스턴스가 맡은 노드 실행과 실행이 `running` 이면 `failed` 로 닫는다. 입력 대기 중인 실행은 건드리지 않는다 | [장애 복구와 안전 종료 「안전 종료」](../CLE-EXEC/CLE-EXEC-RECOVERY.md#안전-종료) |

**`INVALID_NODE_CONFIG` 는 행이 없다.** 엔진은 노드를 실행하기 전에 노드 설정을 검사한다(`handler.validate`). 검사에 실패하면 메시지가 `INVALID_NODE_CONFIG: ` 로 시작하는 에러를 던진다. 구조화된 `error.code` 는 없고 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) 을 따른다. 코드가 아니라 메시지 접두라서 행을 두지 않는다. 이 접두로 분기하지 않는다(규칙 4).

**컨테이너 구조 검사의 접두도 행이 없다.** 엔진은 Loop · ForEach · Map 본문을 실행하기 전에 구조를 검사한다. 어기면 메시지가 `CONTAINER_CYCLE: ` · `CONTAINER_INVALID_CHILD: ` · `CONTAINER_MISSING_EMIT: ` · `CONTAINER_MULTIPLE_EMIT: ` 로 시작하는 에러를 던진다. `INVALID_NODE_CONFIG: ` 와 같은 메시지 접두라서 행을 두지 않는다. 메시지 전체는 [컨테이너 실행 「공통 실행 모델」](../CLE-EXEC/CLE-EXEC-CONTAINER.md#공통-실행-모델) 에 있다. AI 어시스턴트 도구가 트리거 노드를 컨테이너 안에 넣으려 할 때 돌려주는 `error: 'CONTAINER_INVALID_CHILD'` 는 이 접두와 다른 도구 결과 값이다([워크플로우 어시스턴트 도구](../CLE-WF/CLE-WF-ASSIST-TOOLS.md)).

**취소로 끝나는 시스템 코드**(위 `failed` 표와 구분한다). 둘 다 실행이 `cancelled`, `cancelledBy='timeout'` 으로 끝나고 `error.code` 로 원인을 가른다. §6.7 의 `RESUME_*` 와 같은 취소 귀결 부류다. 두 코드의 앵커는 모두 `EngineErrorCode` const 다. 그래서 `EngineErrorCode` 의 네 값은 위 `failed` 표의 `WORKER_HEARTBEAT_TIMEOUT` · `SERVER_INTERRUPTED` 와 이 표의 두 코드다.

| 코드 | 설명 | 정의 문서 |
|------|------|-----------|
| `EXECUTION_QUEUE_WAIT_TIMEOUT` | 동시 실행 제한 때문에 intake 큐에서 기다리던 실행이 5분(환경 변수 `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`, 기본 `300000`ms)을 넘김. 노드가 한 번도 시작되지 않은 시스템 취소라 `failed` 가 아니라 `cancelled` 다. 구현됨(advisory lock 입장 게이트의 큐 대기 초과 마감) | [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md), [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `WEBCHAT_IDLE_TIMEOUT` | 공개 웹채팅(`auth_config_id IS NULL`, 실행 단위 토큰)의 입력 대기 실행이 발급된 모든 인터랙션 토큰의 영구 만료와 유예 시간을 넘김. 사용자가 떠나 이어갈 수 없는 세션을 회수하는 backstop 이다 | [External Interaction API 「공개 위젯의 방치된 입력 대기 회수」](../CLE-IX/CLE-EIA.md#공개-위젯의-방치된-입력-대기-회수), 같은 문서의 「공개 위젯 회수 신호는 토큰 만료다」 Rationale |

### 6.6 워크플로우 실행: 노드 수준 런타임

노드 핸들러가 `output.error.code` 로 에러 포트에 싣는 코드다(에러 포트 동작은 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md)). ForEach · Map · Parallel 이 실패한 회차 · 병렬 분기를 결과 항목의 `error.code` 에 담을 때 쓰는 대체값 `UNKNOWN_ERROR` 도 이 절에 둔다(아래). 정식 목록은 `ErrorCode` enum 이고 주요 항목은 아래와 같다.

| 부류 | 코드 | 정의 문서 |
|----------|------|-----------|
| HTTP | `HTTP_TRANSPORT_FAILED` · `HTTP_4XX` · `HTTP_5XX` · `HTTP_TIMEOUT`(발행하지 않음, 아래) · `HTTP_BLOCKED`(사설망 차단, 모든 인증 방식 공통) | [HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md) |
| Database | `DB_QUERY_FAILED` · `DB_CONNECTION_ERROR` · `DB_CONSTRAINT_VIOLATION` · `DB_PERMISSION_DENIED` · `DB_HOST_BLOCKED`(host 가 사설·loopback 이라 사설망 차단. 기본 켬, `ALLOW_PRIVATE_HOST_TARGETS` 로 끔) · `INVALID_PARAMETERS`(`parameters` 가 배열도 JSON 배열 문자열도 아님) | [Database Query 노드](../CLE-NODE-INT/CLE-NODE-DBQUERY.md) |
| Email | `EMAIL_SEND_FAILED`(`IntegrationError` 가 아닌 예외. `details.integrationCode` 는 넣지 않는다) · `EMAIL_HOST_BLOCKED`(host 가 사설·loopback 이라 사설망 차단. 기본 켬, `ALLOW_PRIVATE_HOST_TARGETS` 로 끔) · `EMAIL_NO_RECIPIENTS`(정규화한 수신자 `to` 가 비어 보낼 곳이 없음). `IntegrationError` 의 코드(`INTEGRATION_*` · `EMAIL_HOST_BLOCKED` · `EMAIL_NO_RECIPIENTS`)는 그대로 `output.error.code` 로 나오고 `details.integrationCode` 에도 같은 값이 들어간다 | [Send Email 노드](../CLE-NODE-INT/CLE-NODE-EMAIL.md) |
| LLM | `LLM_CALL_FAILED` · `LLM_RATE_LIMIT` · `LLM_RESPONSE_INVALID` · `LLM_TIMEOUT`(발행하지 않음, 아래) · `MAX_COLLECTION_RETRIES_EXCEEDED` · `TOOL_DEFINITION_PAYLOAD_EXCEEDED`(AI 에이전트 도구 정의가 크기 · 개수 상한을 넘음). LLM 클라이언트 층 코드는 §6.17 | [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md), [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) |
| Code 노드 | `CODE_EXECUTION_FAILED` · `CODE_TIMEOUT` · `CODE_MEMORY_LIMIT`(isolate 메모리 하드 리밋 초과, 기본 128MB, `CODE_NODE_MEMORY_LIMIT_MB` 로 조정) | [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md) |
| 서브 워크플로우 | `SUB_WORKFLOW_FAILED` · `SUB_WORKFLOW_NOT_FOUND` · `SUB_WORKFLOW_TIMEOUT` · `SUB_WORKFLOW_QUEUE_FAILED` · `WORKFLOW_FORBIDDEN_WORKSPACE` | [워크플로우 호출 노드](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md) |
| 통합 공통 · Cafe24 · MakeShop | 통합 노드 공통 코드 `INTEGRATION_*` 와 `CAFE24_*` · `MAKESHOP_*`. 코드 목록은 §6.22 | [통합 노드 공통 「공통 에러 코드」](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md#공통-에러-코드), [Cafe24 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-CAFE24.md#에러-코드), [MakeShop 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#에러-코드) |
| 노드 취소 | `AbortError` (§3 예외 등록 코드) | [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) |
| 반복 · 병렬 실패 회차 | `UNKNOWN_ERROR`(`errorPolicy='continue'` 의 `skipped[].error.code` · Map `mapped[i].error.code` 대체값, 아래) | [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#반복-결과-출력-구조) |

- **`HTTP_TIMEOUT` 은 발행하지 않는다.** enum 에는 있지만 HTTP Request 핸들러는 타임아웃 때 `AbortController.abort()` 로 fetch 를 멈추고 그 reject 를 다른 전송 에러와 함께 `HTTP_TRANSPORT_FAILED` 로 발행한다(`http-request.handler.ts`). 그래서 `output.error.code` 로 `HTTP_TIMEOUT` 이 보이는 경로는 없다. 앞으로 세분화할 여지와 방어적 매핑을 위해 enum 과 분류 표에 코드를 남긴다.
- **`LLM_TIMEOUT` 도 발행하지 않는다.** enum 에는 있지만 어느 LLM 호출 경로도 이 코드를 내지 않는다(2026-10-10 결정). LLM 타임아웃은 `LLM_CALL_FAILED` 나 스트림 에러 코드로 온다. 단일 턴 AI 에이전트의 롤링 요약 호출에는 앱 타임아웃이 없어 `LLM_TIMEOUT` 이 나오지 않는다. 이 호출이 실패하면 첫 호출과 같은 분류로 `error` 포트에 나간다. LLM 클라이언트의 `withTimeout` 도 전용 코드로 옮기지 않는다([LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md)). 호출 경로별 결과는 [AI 노드 공통 「LLM 호출 경로별 타임아웃」](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md#llm-호출-경로별-타임아웃) 이 모아 적는다. [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md) 의 실패 분류 표는 `HTTP_TIMEOUT` 처럼 이 코드를 «발행 안 됨» 으로 표시해 남긴다. 등재를 지울지는 [미결 사항](#미결-사항)이다.
- 옛 코드 `NODE_EXECUTION_FAILED`·`INTEGRATION_ERROR`·`LLM_ERROR` 는 노드 출력에 더 이상 쓰지 않는다. 노드 실패가 Stop Workflow 로 격상된 엔진 수준에서만 `NodeExecution.error.message` 맥락으로 남는다.
- **`UNKNOWN_ERROR` 는 반복 · 병렬 결과에 쓰는 대체값이다.** ForEach · Map · Parallel 이 실패한 회차 · 병렬 분기를 결과에 담을 때 던진 에러에 백엔드가 직접 싣는 카탈로그 코드가 없으면 이 값을 쓴다. 평범한 `Error` · `TypeError`, Node 런타임 · DB 드라이버의 `code`(`ECONNREFUSED` 등), Error 가 아닌 값이 여기에 든다. 규칙은 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#반복-결과-출력-구조) 4번이 정한다. 그대로 내는 코드는 허용 목록에 있는 값뿐이다. 목록은 `ErrorCode` · `EngineErrorCode` · MCP 코드 상수의 값과 에러 클래스가 싣는 `code` 리터럴로 만든다. 단위 테스트(`iteration-error-code.spec.ts`)가 소스의 에러 클래스 `code` 리터럴과 목록이 맞는지 본다. 에러 처리 정책 `route_to_error_port` 의 `output.error.code` 를 같은 규칙으로 맞추는 일은 NERV Task `CLE-T-KXARNK` 가 맡는다.
- 채팅 채널 어댑터는 이 enum 으로 사용자 안내 메시지를 고른다([채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md)). enum 을 늘리면 분류 표에 행을 더할지 함께 검토한다.
- **워크스페이스 격리 가드 `WORKFLOW_FORBIDDEN_WORKSPACE`**: 다른 워크스페이스(또는 호출자 컨텍스트 누락)의 서브 워크플로우 호출을 막는다(fail-closed). `assertSameWorkspace` 가 typed `WorkflowForbiddenWorkspaceError` 를 던지고 서브 워크플로우 핸들러(`mapSubWorkflowError`)가 이를 `ErrorCode.WORKFLOW_FORBIDDEN_WORKSPACE` 로 바꿔 에러 포트(`output.error.code`)에 싣는다.

### 6.7 WebSocket 명령: 재개 명령과 마지막 턴 재시도 (도메인 문서 참조)

주로 WebSocket ack 에 싣는 코드다. 예외는 `SERVER_SHUTTING_DOWN` 과 `EXECUTION_ENQUEUE_FAILED` 다. 두 코드는 ack 에 싣지 않고 HTTP 진입점에서만 503 으로 쓴다(진입점은 행마다 적는다). 설계 원칙은 [실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md) Rationale 의 `SERVER_SHUTTING_DOWN` 503 선례다. 두 코드를 이 절에 둔 이유는 [Rationale](#execution_enqueue_failed-를-eia-interact-재개-명령에도-쓴다-2026-10-09) 에 있다. 적용 명령 범위와 ack 형태는 [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) 이 정한다.

| 코드 | 설명 | 정의 문서 |
|------|------|-----------|
| `INVALID_EXECUTION_STATE` | 실행이 기대한 상태가 아님(재개 명령 넷(`submit_form` · `click_button` · `submit_message` · `end_conversation`)은 입력 대기, `retry_last_turn` 은 `failed` 를 기대). 동기 ack 응답이고 BullMQ 에 넣지 않는다 | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md), [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `INVALID_BUTTON_ID` | 존재하지 않는 버튼 ID(`click_button`) | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `INTERACTION_TIMEOUT` | 이미 타임아웃이 발생한 상태 | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `VALIDATION_ERROR` (ack) | `submit_form` 의 필드 검증 실패. ack 는 평면 `errorCode` 이고 필드별 `details[]` 가 없다. EIA REST 의 `400 VALIDATION_ERROR` 와 같은 뜻, 같은 검증 지점이다 | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `EXECUTION_MESSAGE_TOO_LONG` | `submit_message` 메시지가 최대 길이(10000자)를 넘음. 발행 쪽 동기 검증(typed `MessageTooLongError`) | [WebSocket 이벤트와 명령 「2.3 재개 명령의 에러」](CLE-API-WS-EVENTS.md#23-재개-명령의-에러), [큐 워커와 동시 실행 제한 「발행 결과와 ack 에러 표면」](../CLE-EXEC/CLE-EXEC-WORKER.md#발행-결과와-ack-에러-표면) |
| `EXECUTION_INTERNAL_ERROR` | 재개 처리 중 typed `ExecutionError` 가 아닌 내부 에러의 일반 fallback. ack `error` 는 고정 일반 문자열이고 내부 메시지는 클라이언트에 보내지 않는다(서버 로그 전용) | [WebSocket 이벤트와 명령 「2.3 재개 명령의 에러」](CLE-API-WS-EVENTS.md#23-재개-명령의-에러), [큐 워커와 동시 실행 제한 「발행 결과와 ack 에러 표면」](../CLE-EXEC/CLE-EXEC-WORKER.md#발행-결과와-ack-에러-표면) |
| `RESUME_CHECKPOINT_MISSING` | rehydration 때 재개에 필요한 영속 상태가 없거나 손상됨(예: `NodeExecution.outputData`, 중첩 재개의 호출 스택 frame). 실행이 `cancelled` 로 끝난다. ack 가 아니라 뒤따르는 `execution.cancelled` 의 `error.code` 로 알린다 | [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `RESUME_FAILED` | 재개 큐의 `RESUME_BULLMQ_ATTEMPTS` 소진. 실행이 `cancelled` 로 끝난다. 뒤따르는 `execution.cancelled` 의 `error.code` 로 알린다 | [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `RESUME_INCOMPATIBLE_STATE` | 멀티턴 AI 의 `_resumeCheckpoint` 가 없음(기능 배포 전에 들어간 대기 행), 손상됨(스키마 변경으로 재구성 실패), 미래 버전임(`schemaVersion` 이 현재 코드가 지원하는 버전보다 큼. 롤링 배포 중 옛 인스턴스가 새 형식을 가져간 경우). 실행이 `cancelled` 로 끝나고 채널에는 "세션 만료" 안내를 보낸다. 정상 경로(checkpoint 가 있고 버전이 호환)는 재구성해 재개하므로 생기지 않는다 | [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `RETRY_STATE_NOT_FOUND` | `retry_last_turn` 대상 행의 `_retryState` 가 없거나 만료됨(TTL 초과 또는 다른 재시도가 이미 소비) | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `NODE_NOT_RETRYABLE` | 대상 노드가 재시도 가능한 에러로 끝나지 않음(`outputData.output.error.details.retryable === false`, 정상 종결, 조건 종결 등) | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `RETRY_TOO_EARLY` | `outputData.output.error.details.retryAfterSec` 카운트다운이 끝나기 전에 호출함(서버 쪽 강제) | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `SERVER_SHUTTING_DOWN` | 서버가 SIGTERM 을 받은 뒤 새 실행을 시작할 수 없음. 새 실행을 시작하는 HTTP 진입점(`POST /api/workflows/:id/execute`, 단일 노드 실행 `POST /api/workflows/:id/nodes/:nodeId/execute`)이 503 으로 낸다 | [장애 복구와 안전 종료 「안전 종료」](../CLE-EXEC/CLE-EXEC-RECOVERY.md#안전-종료) |
| `EXECUTION_ENQUEUE_FAILED` | 입력 대기 실행에 보내는 취소와 재개 명령에서 재개 메시지 발행(BullMQ `queue.add`) 자체가 실패함. `publish` 가 `queued:false`(Redis 장애 등으로 큐에 들어가지 못함)를 돌려준 경우다. HTTP 진입점은 503 이고 실행은 입력 대기 상태를 유지한다(`failed` 아님). 다시 시도를 권한다. 이 코드를 내는 HTTP 진입점은 셋이다. REST `POST /executions/:id/stop`, External Interaction API `/interact`(별칭 `POST .../cancel` 포함), 채팅 채널 인바운드의 `/start` 다. External Interaction API 에서 어느 요청이 이 코드를 받는지는 [EIA 수신 API와 SSE 「명령 에러」](../CLE-IX/CLE-EIA-INBOUND.md#명령-에러) 가 정한다. 채팅 채널의 `/start` 는 활성 실행을 취소할 때 `ExecutionsService.stop` 을 직접 부르고 이 503 을 그대로 돌려준다. 이때 새 실행은 시작하지 않고 프로바이더는 non-2xx 를 받아 같은 update 를 다시 보낼 수 있다([채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) REQ-CHAT-064). 채팅 채널 인바운드의 `/cancel` 과 재개 입력은 이 코드를 내지 않는다. 큐에 넣지 못해도 `202` 로 응답하고 채널 건강도를 `degraded` 로 바꾼다([채팅 채널 「인바운드 HTTP 응답 계약」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약)). WebSocket 재개 명령 4종은 이 코드를 싣지 않는다. 같은 발행 실패는 `errorCode` 없는 실패 ack(`success:false`)로 알린다. `SERVER_SHUTTING_DOWN` 503 선례와 같은 형태이고 큐에 들어간 뒤 재개가 실패하는 워커 쪽 비동기 실패(`RESUME_*`)와 구분한다 | [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md#발행-결과와-ack-에러-표면), [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md#인바운드-명령과-재개), [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) |

### 6.8 WebSocket 전송 (도메인 문서 참조)

`ws-error-codes.ts` 의 `WsErrorCode` 가 정의하는 전송·구독 층 코드다. 형태와 전달 경로는 [WebSocket 연결과 채널 구독](CLE-API-WS.md) 의 에러 절이 정한다.

| 코드 | 설명 | 정의 문서 |
|------|------|-----------|
| `UNAUTHENTICATED` | 소켓에 사용자 ID 가 없음(구독 ack 의 `code`) | [WebSocket 연결과 채널 구독](CLE-API-WS.md) |
| `FORBIDDEN` (WebSocket) | 권한 없음(일반) | [WebSocket 연결과 채널 구독](CLE-API-WS.md) |
| `NOT_FOUND` (WebSocket) | 리소스가 없거나 소유 검증 실패 | [WebSocket 연결과 채널 구독](CLE-API-WS.md) |
| `INTERNAL_ERROR` (WebSocket) | 서버·전송 내부 실패(큐 적재 실패 등). `retry_last_turn` 의 중첩 `error.code` 등에 쓴다. 재개 명령 평면 ack 의 `EXECUTION_INTERNAL_ERROR`(§6.7)와 별개 범위다 | [WebSocket 연결과 채널 구독](CLE-API-WS.md) |
| `INVALID_MESSAGE` | 구독 등 WebSocket 메시지의 채널이 유효하지 않거나 필수 필드가 없음. 구독 ack 의 `code`(평문 `error` 에 더해 싣는다) | [WebSocket 연결과 채널 구독](CLE-API-WS.md) |
| `UNKNOWN_TYPE` | 등록되지 않은 이벤트 이름. 게이트웨이 `onAny` 가 `error` 이벤트 `{ code, message }` 로 알린다(Socket.IO 가 조용히 버리는 것을 보완) | [WebSocket 연결과 채널 구독](CLE-API-WS.md) |
| `SUBSCRIPTION_LIMIT_EXCEEDED` | 소켓당 구독 한도(20) 초과. 구독 ack 의 `code` | [WebSocket 연결과 채널 구독](CLE-API-WS.md) |
| `RATE_LIMITED` (WebSocket) | WebSocket 명령 빈도 제한(소켓당 분당 60건) 초과. `WsRateLimitGuard` 가 `WsException` 을 던지고 클라이언트는 `exception` 이벤트 `{ code, message }` 로 받는다. EIA REST `/interact` 의 같은 이름 `RATE_LIMITED`(HTTP 429)와는 표면과 전송이 다른 별개 발행이다 | [WebSocket 연결과 채널 구독](CLE-API-WS.md) |

### 6.9 EIA REST 외부 표면 (도메인 문서 참조)

External Interaction API(`/api/external/*`) 전용 코드다. 외부 호출자 표면이라 [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) 의 기본 코드를 의도적으로 바꾼다.

| 코드 | HTTP | 설명 | 비고 | 정의 문서 |
|------|--------|------|------|-----------|
| `INVALID_COMMAND` | 400 | 지원하지 않는 command 이거나 필수 필드 누락 | 400 기본 `VALIDATION_ERROR` 대신 쓰는 명령 분기 전용 코드 | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) |
| `MESSAGE_TOO_LONG` | 400 | `submit_message` 메시지가 최대 길이를 넘음 | 내부 길이 수치를 드러내지 않는다 | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) |
| `STATE_MISMATCH` | 409 | 재개 명령이 현재 노드·실행 상태와 맞지 않음 | 발행 쪽 사전 검증 | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) |
| `IDEMPOTENCY_KEY_CONFLICT` | 409 | 같은 멱등 키(`Idempotency-Key`)에 다른 본문 | | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) |
| `EXECUTION_TERMINATED` | 410 | 실행이 이미 completed·failed·cancelled 다. 토큰 갱신(`POST .../refresh-token`)에서는 없는 실행도 이 코드로 합친다(404 아님) | | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) |
| `TOKEN_REFRESH_NOT_IN_WINDOW` | 400 | 토큰 갱신 전용. 만료까지 30분(`IEXT_REFRESH_WINDOW_SEC`)보다 많이 남아 아직 갱신할 때가 아님 | | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) |
| `TOKEN_REFRESH_FAILED` | 400 | 토큰 갱신 전용. 갱신이 토큰을 돌려주지 못함(안전망) | | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) |
| `TOKEN_REFRESH_FORBIDDEN` | 403 | 토큰 갱신 전용. 트리거 단위 토큰(`itk_*`)은 영구 토큰이라 갱신 대상이 아님. 아래 401 통일의 **예외**다. 토큰 검증 실패가 아니라 검증을 통과한 토큰을 잘못된 표면에 쓴 경우다 | EIA 표면의 유일한 403 | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) |
| `TOKEN_REVOKED` · `TOKEN_SCOPE_MISMATCH` · `TOKEN_AUDIENCE_MISMATCH` | 401 | 인터랙션 토큰(`iext_*`, `itk_*`) **검증** 실패. 모든 토큰 검증 실패는 정보 노출을 줄이려고 401 하나로 돌려준다. 여기서 "검증 실패" 는 `InteractionGuard` 가 핸들러 전에 판정하는 집합이고 위 `TOKEN_REFRESH_FORBIDDEN` 은 그 뒤 서비스 계층 판정이라 대상이 아니다. §6.2 의 워크스페이스 JWT 층 `TOKEN_INVALID`·`TOKEN_EXPIRED` 와 같은 문자열도 쓰지만 진입점(`/api/external/*`)과 토큰 family 로 층이 갈린다 | 폐기는 종결 시 즉시 무효화한다(최소 한 번, [External Interaction API 「종료 시 토큰 폐기」](../CLE-IX/CLE-EIA.md#종료-시-토큰-폐기)) | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) 의 「토큰 검증 실패는 모두 401」 Rationale |
| `EXECUTION_NOT_FOUND` (트리거 단위 토큰) | 401 | 트리거 단위 토큰(`itk_*`)으로 보낸 요청이나 연 스트림에서 실행이 없거나 그 실행의 트리거가 지워짐. 가드(`InteractionGuard`)가 핸들러 전에 판정해 401 로 돌려준다. 다른 엔드포인트의 404 `EXECUTION_NOT_FOUND` 와 뜻은 같고 상태만 다르다. 이 행을 둔 이유는 [Rationale](#트리거-단위-토큰-경로의-부재는-401-execution_not_found-로-적는다-2026-10-17) 에 있다 | EIA 전용 코드가 아니다. 표준 코드를 401 로 쓴다 | [EIA 수신 API와 SSE 「명령 에러」](../CLE-IX/CLE-EIA-INBOUND.md#명령-에러), [EIA 수신 API와 SSE 「스트림 연결 오류」](../CLE-IX/CLE-EIA-INBOUND.md#스트림-연결-오류) |
| `TOO_MANY_CONNECTIONS` | 429 | 실행당 SSE 동시 연결 상한 초과. 429 기본 `RATE_LIMITED` 와 별개인 EIA SSE 전용 코드 | | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) |

`VALIDATION_ERROR`(`submit_form` 필드 검증), `EXECUTION_NOT_FOUND`(404 행은 §6.24, 트리거 단위 토큰 경로는 위 표의 401 행), `TOKEN_INVALID`·`TOKEN_EXPIRED`(401), `EXECUTION_ENQUEUE_FAILED`(503, §6.7)는 표준 코드를 그대로 다시 쓴다(EIA 전용 아님). EIA 에서 어느 요청이 `EXECUTION_ENQUEUE_FAILED` 를 받는지와 이 503 의 멱등 캐시 처리는 [EIA 수신 API와 SSE 「명령 에러」](../CLE-IX/CLE-EIA-INBOUND.md#명령-에러) 가 정한다. `/interact` · `/cancel` · 상태 조회의 빈도 제한 초과는 `RATE_LIMITED`(429)다. `/cancel` 은 `/interact` 와 같은 카운터를 세고 수치는 [HTTP API 규약 「7. 요청 빈도 제한」](CLE-API-CONV.md#7-요청-빈도-제한) 이 정한다.

### 6.10 웹훅 수신 (도메인 문서 참조)

웹훅 수신 엔드포인트(`POST /api/hooks/:endpointPath`) 전용 코드다.

| 코드 | HTTP | 설명 | 상태 | 정의 문서 |
|------|--------|------|------|-----------|
| `INVALID_WEBHOOK_PAYLOAD` | 400 | required 트리거 파라미터 누락이나 타입 변환 실패. 400 기본 `VALIDATION_ERROR` 대신 쓰는 웹훅 도메인 코드 | 구현 | [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| `PUBLIC_WEBHOOK_RATE_LIMIT` | 429 | 공개 웹훅(`auth_config_id IS NULL` 이고 채팅 채널 트리거가 아닌 웹훅)의 IP 단위(IP 를 식별하지 못하면 공유 버킷 `UNIDENTIFIED_IP_BUCKET`) 분당 시작 한도 초과(`PublicWebhookThrottleGuard`, 기본 분당 10) | 구현 | [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| `PUBLIC_WEBHOOK_HOURLY_LIMIT` | 429 | 공개 웹훅(채팅 채널 트리거 제외) IP 단위(또는 공유 버킷) 시간당 누적 신규 한도 초과(`PublicWebhookThrottleGuard`·`PublicWebhookQuotaService`, 기본 20) | 구현 | [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| `PUBLIC_WEBHOOK_BODY_TOO_LARGE` | 413 | 공개 웹훅(채팅 채널 트리거 제외) 요청 본문이 32KB(`DEFAULT_MAX_BODY_BYTES`, 설정 `publicWebhook.maxBodyBytes`)를 넘음(`PublicWebhookThrottleGuard`) | 구현 | [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| `AUTH_FAILED` | 401 | 웹훅 인증 실패. 인증 방식과 무관하게 한 응답으로 돌려준다(열거 공격·정보 노출 차단). `is_active=false` 인증 설정, 인증 설정을 트리거의 워크스페이스에서 찾지 못함([데이터 모델 개요 「저장된 교차 행 점검」](../CLE-PLAT/CLE-PLAT-DATA.md#저장된-교차-행-점검)), 서명·토큰 불일치, 인증 설정의 기대값(key · token · 사용자 이름 · 비밀번호 · secret)이 비어 있거나 문자열이 아니거나 복호화 불가 표식이라 읽지 못함, 인증 설정의 헤더 이름(`headerName` · `header`)이 문자열이 아님([웹훅 「인증」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#인증)), `ip_whitelist` 불일치가 모두 같은 코드다 | 구현 | [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| `TRIGGER_NOT_FOUND` | 404 | 엔드포인트 경로에 맞는 웹훅 트리거가 없음. 트리거의 워크플로우가 트리거의 워크스페이스에 없을 때도 같은 코드다(채팅 채널 트리거는 `202` ignored). 새 코드를 두지 않은 이유는 [Rationale](#trigger_not_found-를-다른-워크스페이스의-워크플로우에도-쓰는-이유-2026-10-05) 에 있다 | 구현 | [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| `TRIGGER_INACTIVE` | 410 | 트리거가 비활성. 처음부터 없는 404 와 구분한다. 채팅 채널 트리거는 예외로 `202` 와 `{ executionId: 'ignored' }` 를 돌려준다. `410` 에는 기본 코드가 없어 코드를 명시한다([에러 응답과 클라이언트 처리](CLE-API-ERROR.md)) | 구현 | [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| `WORKFLOW_INACTIVE` | 410 | 트리거는 활성인데 그 트리거의 워크플로우가 비활성임(`workflow.is_active=false`). 채팅 채널 트리거는 이 코드를 내지 않는다. 확인 순서와 경로별 응답은 [트리거 데이터와 흐름 「워크플로우 활성 관문」](../CLE-TRIG/CLE-TRIG-DATA.md#워크플로우-활성-관문) 이 정한다. `410` 에는 기본 코드가 없어 코드를 명시한다([에러 응답과 클라이언트 처리](CLE-API-ERROR.md)) | 구현 | [트리거 데이터와 흐름 「워크플로우 활성 관문」](../CLE-TRIG/CLE-TRIG-DATA.md#워크플로우-활성-관문), [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) |

**`MASKED_VALUE_RESUBMITTED` 는 수동 실행 경로 한정이다.** 다시 제출한 값뿐 아니라 사용자가 직접 입력한 마커도 대상이다(그 표면에서 마스킹 마커 세 문자열은 예약어다). 웹훅 수신과 스케줄은 외부 시스템이 쓰는 임의 페이로드라 대상이 아니다. 판정 기준은 값의 출처가 아니라 페이로드를 쓰는 주체다. 범위 근거는 [응답 자격 증명 마스킹](CLE-API-EGRESS.md) 에 있다.

### 6.11 지식 저장소·Graph RAG (도메인 문서 참조)

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `KB_REEXTRACT_IN_PROGRESS` | 409 | 지식 저장소 전체 재추출(`re-extract`)의 동시 호출을 `reextract_status` 컬럼 원자 compare-and-swap 으로 막음(재임베딩 잠금과 같은 형태) | [Graph RAG](../CLE-KB/CLE-KB-GRAPH.md) |
| `KB_REEMBED_IN_PROGRESS` | 409 | 지식 저장소 전체 재임베딩(`re-embed`)의 동시 호출을 `reembed_status` 컬럼 원자 compare-and-swap 으로 막음(`embedding_dimension` 도 NULL 로 초기화) | [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) |

### 6.12 워크스페이스 멤버 직접 추가 (도메인 문서 참조)

`POST /api/workspaces/:id/members`(`WorkspacesService.addMemberByEmail`, 이미 가입한 사용자를 바로 합류시킴) 전용 코드다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `CANNOT_ASSIGN_OWNER` | 403 | 직접 추가로 `role=owner` 를 줄 수 없음(소유자는 소유자 이양 경로로만) | [워크스페이스와 멤버 「직접 추가」](../CLE-ACCT/CLE-ACCT-WS.md#직접-추가) |
| `ALREADY_A_MEMBER` | 409 | 이미 멤버인 사용자를 다시 추가함 | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |
| `WORKSPACE_TYPE_MISMATCH` | 403 | team 이 아닌 워크스페이스에 직접 추가를 시도함 | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |

이 대문자 코드는 초대 흐름(`workspace-invitations.service.ts`)의 소문자 `already_a_member`·`workspace_type_mismatch`(§3)와 **같은 뜻이지만 별개 코드**다. 모듈과 대소문자 관례가 다르고 일부러 나눴으므로 합치지 않는다. 같은 경로의 `USER_NOT_FOUND`(404, 가입하지 않은 이메일)와 `WORKSPACE_NOT_FOUND`(404, 워크스페이스 없음)는 `workspaces.service` 전역 CRUD 가 함께 쓰는 일반 코드라 직접 추가 전용이 아니어서 이 절에 두지 않고 §6.4 에 등재했다. 같은 경로에서 소유자가 아닌 요청자가 `role=admin` 을 지정하면 §6.2 의 `OWNER_REQUIRED`(403)다. 전환·탈퇴 경로의 `NOT_A_MEMBER`(403)는 §6.2 다.

### 6.13 트리거 endpointPath 충돌 (도메인 문서 참조)

`POST /api/triggers`·`PATCH /api/triggers/:id` 가 `(endpoint_path)` 전역 UNIQUE 제약을 어기거나 다른 워크스페이스가 예약한 경로([트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md))를 쓸 때 발행한다. 두 경우를 한 코드로 묶었다. "예약됨" 을 따로 알리면 그 경로가 한때 쓰였다는 사실이 샌다. top-level `code` 는 기본값 `RESOURCE_CONFLICT` 를 유지하고 세부 사유는 `details` 에 싣는다. 어느 필드가 충돌했는지가 정보의 일부이기 때문이다.

| 세부 코드 (`details.code`) | 봉투 `code` / HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `TRIGGER_ENDPOINT_PATH_CONFLICT` | `RESOURCE_CONFLICT` / 409 | 같은 `endpointPath` 를 쓰는 트리거가 이미 있거나(다른 워크스페이스의 트리거 포함, 전역 유일), 다른 워크스페이스가 예약한 경로다(지웠거나 바꾼 경로). 둘을 구분하지 않는다. `details.field='endpoint_path'` | [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) |

`details` 가 **객체 형태**인 사례다(배열 아님). 같은 경로의 길이·이름 검증 실패는 400 `VALIDATION_ERROR` 로 §6.4 소관이다.

### 6.14 트리거 인증 설정 연결 (도메인 문서 참조)

`POST /api/triggers`·`PATCH /api/triggers/:id` 가 `authConfigId` 를 받을 때 그 인증 설정이 호출자의 워크스페이스에 속하는지 검증한다(`TriggersService.assertAuthConfigInWorkspace`). 다른 워크스페이스의 자격 증명에 트리거를 연결하는 것을 막는다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `AUTH_CONFIG_NOT_FOUND` | **400** | `authConfigId` 가 호출자 워크스페이스의 인증 설정이 아님(없거나 다른 워크스페이스 소속. 존재 여부 노출을 막으려고 구분하지 않는다). `details: { field: 'authConfigId', code: 'INVALID_FIELD' }` 를 함께 싣는다(`INVALID_FIELD` 행은 §6.4) | [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) |

- **이름은 `_NOT_FOUND` 지만 404 가 아니다.** 이 카탈로그에서 HTTP 로 나가는 `*_NOT_FOUND` 가운데 404 가 아닌 코드는 이 코드 말고 셋이다. 액세스 토큰 검증의 `WORKSPACE_NOT_FOUND`(401, §6.4), 로그인 2단계 Passkey 검증의 `WEBAUTHN_CREDENTIAL_NOT_FOUND`(401, §6.3), 트리거 단위 토큰 경로의 `EXECUTION_NOT_FOUND`(401, [§6.9 의 「트리거 단위 토큰」 행](#69-eia-rest-외부-표면-도메인-문서-참조))다. 앞의 두 401 은 다른 코드로 옮기기로 정했다(NERV Task `CLE-T-ZPPWK4`). 나머지는 모두 404 이고 이 상태 일관성을 위해 코드를 쪼갠 선례도 있다(`MODEL_CONFIG_NOT_FOUND` 404 와 `MODEL_CONFIG_DEFAULT_MISSING` 400).
- 400 인 근거: 다른 워크스페이스 참조는 리소스 부재가 아니라 입력값 유효성 문제다. 그래서 `details.field='authConfigId'` 로 필드를 지목하고 `BadRequestException` 으로 던진다.
- **이름과 400 을 그대로 둔다.** 2026-11-12 에 NERV Task `CLE-T-3P4ENZ` 에서 정했다. 이름을 더 정확하게 하려는 목적만으로는 바꾸지 않고(규칙 5), 뜻과 상태가 하나라 새 코드도 만들지 않는다(규칙 6). 이유는 Rationale 에 있다.
- 특화 코드와 일반 `details[].code` 를 함께 싣는 것이 "겹쳐 쓰지 않는다" 에 걸리지 않는 근거는 [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) 의 판별 기준이다.

### 6.15 채팅 채널 봇 토큰 재발급 (도메인 문서 참조)

`POST /api/triggers/:id/chat-channel/rotate-bot-token` 의 실패 응답이다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `INVALID_BOT_TOKEN` | **400** | `newBotToken` 이 없거나 문자열이 아니거나 256자를 넘거나 보이는 ASCII(U+0021~U+007E) 밖의 문자가 있음(컨트롤러 입력 검증) | [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) |
| `CHAT_CHANNEL_NOT_CONFIGURED` | **400** | `config.chatChannel` 이 설정되지 않은 트리거 | [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) |
| `CHAT_CHANNEL_PROVIDER_UNKNOWN` | **400** | registry 에 등록되지 않은 provider | [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) |
| `CHAT_CHANNEL_ENDPOINT_REQUIRED` | **400** | 트리거 `endpointPath` 없음 | [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) |
| `BOT_TOKEN_INVALID` | **400** | `setupChannel` 이 **자격 증명 거부**로 실패함. provider 가 `401`·`403`, `{ok:false,error:'invalid_auth'}`(HTTP 200), `verify_key` 불일치 중 무엇으로 알리든 같은 분류다. 판별은 어댑터가 선언한다([채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md)) | [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) |
| `FORBIDDEN` | **403** | 워크스페이스 문맥이 없음(`X-Workspace-Id` 헤더와 JWT `activeWorkspaceId` 클레임(옛 `workspaceId`)이 둘 다 없음). 전역 가드 `RolesGuard` 가 `@WorkspaceId()` 보다 먼저 돌아 `code` 없이 거부하므로 기본 코드가 실린다 | [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md), [워크스페이스와 멤버 「`X-Workspace-Id` 형식 검사」](../CLE-ACCT/CLE-ACCT-WS.md#x-workspace-id-형식-검사) |
| `NOT_A_MEMBER` | **403** | 요청자가 그 워크스페이스의 멤버가 아님 | [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md), [워크스페이스와 멤버 「가드 거부 에러 코드」](../CLE-ACCT/CLE-ACCT-WS.md#가드-거부-에러-코드) |
| `EDITOR_REQUIRED` | **403** | 요청자의 역할이 편집자보다 낮음(뷰어) | [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md), [워크스페이스와 멤버 「가드 거부 에러 코드」](../CLE-ACCT/CLE-ACCT-WS.md#가드-거부-에러-코드) |
| `INTERNAL_ERROR` | **500** | [§6.1](#61-시스템) 의 `INTERNAL_ERROR` 와 같은 코드다. 트리거의 비밀 참조에 다른 워크스페이스가 소유한 시크릿 저장소 행이 남아 있어 `rotate` 가 거부함([시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 25). `message` 는 5xx 가림 문구다 | [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) |
| `CHAT_CHANNEL_SETUP_FAILED` | **502** | 그 밖의 `setupChannel` 실패(provider 5xx, 네트워크, 타임아웃). 이 저장소의 첫 502 다(근거: [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 의 「R-CC-23 setupChannel 실패는 전송 방식이 아니라 원인으로 분류한다」 Rationale) | [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) |

- **이름이 두 갈래라 헷갈리기 쉽다.** `INVALID_BOT_TOKEN`(입력 형식이 틀렸다)과 `BOT_TOKEN_INVALID`(provider 가 거부했다)는 어순만 다르고 뜻이 다르다. 합치거나 바꾸지 않는 이유는 §2 와 같다. 둘 다 이미 응답에 나갔고 프론트엔드 백엔드 라벨 매핑(`backend-labels.ts`)이 각각을 매핑한다.
- **생성 경로의 같은 입력 오류는 `VALIDATION_ERROR` 다.** 트리거 생성(`POST /api/triggers` 의 `chatChannel.botToken`)은 DTO 검증이라 같은 형식 오류가 `400 VALIDATION_ERROR` 로 나간다.
- **응답 본문에 provider 원문을 싣지 않는다.** `message` 는 고정된 클라이언트용 문자열이고 원문은 서버 로그에만 남긴다. 재개 명령 ack 의 내부 메시지 차단과 같은 이유다.

### 6.16 재실행 (도메인 문서 참조)

`POST /executions/:id/re-run` 의 실패 응답이다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `RERUN_PERMISSION_DENIED` | 403 | 다른 사용자의 실행이고 호출자가 소유자·관리자가 아님(서비스 판정). 비멤버와 뷰어는 가드가 먼저 막는다 | [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) |
| `RERUN_EXECUTION_NOT_FOUND` | 404 | `executionId` 가 없거나 다른 워크스페이스의 실행 | [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) |
| `RERUN_WORKFLOW_DELETED` | 404 | 원본 실행의 워크플로우가 삭제됨 | [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) |
| `RERUN_CHAIN_DEPTH_EXCEEDED` | 409 | 재실행 체인 깊이 32 초과 | [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) |
| `RERUN_DRY_RUN_NOT_APPLICABLE` | 400 | dry-run 요청인데 워크플로우에 dry-run 을 지원하지 않는 노드(`supportsDryRun: false`)가 있음 | [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) |

입력 파라미터 검증 실패는 `INVALID_TRIGGER_PARAMETERS`(§6.4)다.

### 6.17 LLM 클라이언트 (도메인 문서 참조)

LLM 클라이언트 층(`*.client.ts`)이 프로바이더 원본 에러를 좁혀 매핑하는 코드와 모델 설정 미리보기 경로의 코드다. 노드 출력의 LLM 부류(§6.6)와 층이 다르다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `LLM_RATE_LIMIT` | 429 (프로바이더 응답) | 프로바이더 속도 제한. `chat` 은 지수 백오프로 최대 3회 다시 시도한다(`withRetry`). `chatStream` 은 앱 수준 재시도를 거치지 않는다. 스트림을 열 때의 프로바이더별 분기는 [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md#스트리밍-에러-매핑) | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |
| `LLM_CONNECTION_ERROR` | 없음 | 위에 해당하지 않는 모든 클라이언트 호출 실패의 기본값(인증 실패, 모델 없음, 컨텍스트 초과 포함). 스트림을 열 때의 프로바이더별 분기는 [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md#스트리밍-에러-매핑) | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |
| `LLM_OUTPUT_MALFORMED` | 없음 | gpt-oss 계열 harmony 제어 토큰 노출(OpenAI 스트리밍 경로). `message` 는 고정 영문 진단 문장이다. 사용자에게 보일 문구는 호출하는 쪽이 코드로 고른다 | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |
| `LLM_CREDENTIALS_REQUIRED` | 400 | 미리보기 요청에서 local 이 아닌 프로바이더의 apiKey 누락 | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |
| `LLM_MODEL_LIST_FAILED` | 400 | 미리보기나 `:id/models` 호출 중 프로바이더 응답 실패. 정리한 메시지를 보인다 | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |
| `LLM_STREAMING_UNSUPPORTED` | 없음 | 스트리밍을 지원하지 않는 프로바이더에 `stream()` 호출 | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |

세분화 코드 `LLM_AUTH_ERROR`(401), `LLM_MODEL_NOT_FOUND`(404), `LLM_CONTEXT_EXCEEDED`(400)는 계획이며 미구현이다. 지금은 `LLM_CONNECTION_ERROR` 로 모인다.

### 6.18 워크스페이스·로그인 세션 관리 (도메인 문서 참조)

도메인 문서가 상태 코드와 함께 적은 코드만 등재한다. 설명 끝의 "현재 구현" 은 도메인 문서가 상태 코드를 구현 근거로 적은 코드다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `CANNOT_REVOKE_CURRENT_SESSION` | 400 | 단일 세션 강제 종료(`POST /api/auth/sessions/:familyId/revoke`)로 현재 요청의 refresh 토큰 쿠키와 맞는 세션 family 를 끝내려 함(자기 세션 종료 차단). 로그아웃을 쓰게 안내한다 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md), [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) |
| `OAUTH_STATE_MISMATCH` | 400 | OAuth state 가 없거나 만료·소비됐거나 provider 가 다름. 로그인 콜백에서는 URL 신호 `invalid_state`(§3)로 바뀐다. 통합 OAuth 콜백도 같은 코드를 쓴다. 통합 콜백에서 이 코드가 어디에 남는지는 §6.21 표 아래에 있다 | [가입과 로그인 「에러 처리」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-처리), [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md), [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) |
| `CANNOT_DELETE_PERSONAL` | 403 | personal 워크스페이스는 삭제할 수 없음(team 전용) | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |
| `CANNOT_LEAVE_PERSONAL` | 403 | personal 워크스페이스는 탈퇴할 수 없음(team 전용) | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |
| `SOLE_OWNER_CANNOT_LEAVE` | 403 | 유일한 소유자는 탈퇴할 수 없음 | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |
| `TARGET_IS_SELF` | 400 | 소유자 이양 대상으로 자기 자신을 지정함 | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |
| `TARGET_ALREADY_OWNER` | 409 | 소유자 이양 대상이 이미 소유자임 | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |
| `CURRENT_SESSION_REQUIRED` | 400 | 다른 세션 일괄 종료(`POST /api/auth/sessions/revoke-others`)에서 리프레시 쿠키가 없거나 그 쿠키로 현재 세션을 찾지 못함. 현재 구현 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md#세션-강제-종료) |
| `MEMBER_NOT_FOUND` | 404 | 역할 변경·소유자 이양·멤버 제거의 대상 멤버가 없음. 현재 구현 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md#멤버-변경과-직접-추가) |
| `OWNER_ROLE_PROTECTED` | 403 | 역할 변경 대상이나 새 역할이 소유자임. 소유자 부여·박탈은 소유자 이양으로만 한다. 현재 구현 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md#멤버-변경과-직접-추가), [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |
| `CANNOT_TRANSFER_PERSONAL` | 403 | personal 워크스페이스는 소유자를 이양할 수 없음. 현재 구현 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md#멤버-변경과-직접-추가) |
| `CANNOT_REMOVE_OWNER` | 403 | 소유자를 멤버에서 제거하려 함. 현재 구현 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md#멤버-변경과-직접-추가), [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |

- 세션 API 의 경로는 `/api/auth/sessions` 다. 이 경로에 둔 근거는 [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) 과 [HTTP API 규약](CLE-API-CONV.md) 의 「세션 API 를 `/api/auth/sessions` 에 둔 이유」 Rationale 에 있다.
- **비슷한 이름 주의**: 소유자가 들어간 403 코드는 두 부류다. `OWNER_REQUIRED`(§6.2)는 요청자의 역할이 부족할 때 난다. `OWNER_ROLE_PROTECTED` · `CANNOT_ASSIGN_OWNER`(§6.12) · `CANNOT_REMOVE_OWNER` 는 대상 멤버나 부여하려는 역할 값이 소유자일 때 난다. 한 요청이 두 부류에 다 걸리면 소유자 대상 검사가 관리자 역할 규칙의 `OWNER_REQUIRED` 보다 먼저다. 동작마다 검사 순서는 [워크스페이스와 멤버 「관리자 역할 규칙」](../CLE-ACCT/CLE-ACCT-WS.md#관리자-역할-규칙) 이 정한다.

### 6.19 AI 어시스턴트 세션 API (도메인 문서 참조)

어시스턴트 세션 REST API 가 내는 코드다. 이 표의 `WORKFLOW_NOT_FOUND` 는 이 API 에서만 쓴다. 워크플로우 · 노드 · 연결선 경로의 없는 워크플로우는 404 `RESOURCE_NOT_FOUND` 이고, 어시스턴트의 탐색 도구가 모델에게 돌려주는 같은 이름의 문자열은 HTTP 응답이 아니라 도구 결과 값이다. 서브 워크플로우 노드의 `SUB_WORKFLOW_NOT_FOUND`(§6.6)와도 다른 표면이다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `WORKFLOW_NOT_FOUND` | 404 | 세션 생성 본문이나 세션 목록 조회의 `workflowId` 가 요청의 워크스페이스에 없음. 없는 id 와 다른 워크스페이스의 id 를 구분하지 않는다. 「참조의 소속」 의 예외 3 이다 | [AI 어시스턴트 스트리밍과 세션 API](../CLE-WF/CLE-WF-ASSIST-PROTO.md#세션-rest-api), [데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) |
| `ASSISTANT_SESSION_NOT_FOUND` | 404 | 세션이 없거나 요청의 워크스페이스 세션이 아님 | [AI 어시스턴트 스트리밍과 세션 API](../CLE-WF/CLE-WF-ASSIST-PROTO.md#세션-rest-api) |
| `ASSISTANT_SESSION_NOT_YOURS` | 403 | 같은 워크스페이스의 다른 사용자가 만든 세션임. 다른 워크스페이스의 세션은 위 404 로 가린다 | [AI 어시스턴트 스트리밍과 세션 API](../CLE-WF/CLE-WF-ASSIST-PROTO.md#세션-rest-api) |

### 6.20 인증 설정 재생성 (도메인 문서 참조)

`POST /api/auth-configs/:id/regenerate` 의 실패 응답이다. 없는 인증 설정과 권한 부족은 공용 코드(§6.4 `RESOURCE_NOT_FOUND` · §6.2 `ADMIN_REQUIRED`)를 쓴다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `AUTH_CONFIG_REGENERATE_UNSUPPORTED` | 400 | 재생성할 수 없는 유형(Basic Auth)의 인증 설정에 재생성을 요청함. 사용자 이름과 비밀번호는 사용자가 입력한 값이라 새로 발급할 값이 없다. 설정을 저장하지 않고 감사 로그도 남기지 않는다. `details` 는 싣지 않는다 | [외부 호출 인증 설정 「재생성」](../CLE-TRIG/CLE-TRIG-AUTHCFG.md#재생성) |

- `AUTH_CONFIG_NOT_FOUND`(§6.14)와 앞부분이 같지만 표면이 다르다. 그쪽은 트리거를 저장할 때 `authConfigId` 를 검증한다.

### 6.21 통합 관리 · OAuth (도메인 문서 참조)

통합 관리 API(`/api/integrations/*`, `POST /api/integrations/oauth/begin` 포함), 설치 엔드포인트(`GET /api/3rd-party/cafe24/install/:installToken` · `GET /api/3rd-party/makeshop/install/:installToken`), 통합 OAuth 콜백(`GET /api/3rd-party/:provider/callback`)이 내는 코드다. 이 경로들도 내는 공용 코드(§6.2 `NOT_A_MEMBER` · `EDITOR_REQUIRED` · `ADMIN_REQUIRED`, §6.4 `VALIDATION_ERROR` · `RESOURCE_NOT_FOUND`)는 다시 적지 않는다. 통합 노드 · 연결 테스트 · AI 에이전트 도구의 코드는 §6.22 에 있다.

- **설치 엔드포인트도 표준 봉투 `{ error: { code, message, requestId } }` 로 답한다.** 전역 예외 필터를 거치지 않으므로 컨트롤러가 본문을 직접 조립하고 `requestId` 를 응답마다 새로 발급한다. 빈도 제한 · 토큰 형식 · 필수 query 검사는 늘 JSON 으로 답한다. 그 뒤 서비스가 거절하면 `Accept` 에 `text/html` 이 있을 때 코드 · 메시지 · `requestId` 를 담은 HTML 페이지로 답한다.
- **콜백 코드는 HTTP 봉투에 실리지 않는다.** 서비스가 거절하면 콜백은 상태 200 의 HTML 페이지를 그린다. 페이지에는 메시지만 있고 코드는 없다. 콜백이 대상 통합을 알면 코드를 그 통합의 `last_error.code` 에 남긴다. state 를 소비하지 못한 실패, `new` 모드(아직 통합 행이 없다), 상점 자리를 놓은 만료 설치 대기 행, 커밋 직전 재판정의 `RESOURCE_NOT_FOUND` 는 남기지 않는다. 그래서 아래 표는 콜백 코드의 HTTP 칸을 「없음 (통합 `last_error.code`)」 와 「없음 (콜백 HTML)」 로 나눠 적는다. `last_error.code` 에는 노드와 도구 호출의 실패 코드도 들어온다(§6.22).
- **소셜 로그인 콜백**(`GET /api/auth/oauth/:provider/callback`)의 내부 코드는 행을 두지 않는다. 실패는 모두 §3 의 소문자 URL 값(`invalid_state` · `token_exchange_failed` · `email_required` · `server_error`)으로 바뀐다. 소셜 로그인 시작(`GET /api/auth/oauth/:provider`)은 OAuth 앱 설정이 없으면 표준 봉투로 `OAUTH_CONFIG_MISSING`(500)을 낸다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `INTEGRATION_INVALID_SERVICE` | 400 | 지원하지 않는 서비스와 인증 방식 조합으로 통합을 만들거나 미리보기 연결 테스트를 요청함 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `INTEGRATION_INVALID_CREDENTIALS` | 400 | 통합 생성이나 자격 증명 교체(`POST /api/integrations/:id/rotate`)의 자격 증명이 서비스의 필드 규칙(필수 필드 · 형식)에 맞지 않음. `message` 는 어긋난 항목을 `; ` 로 이어 적는다. 이름이 비슷한 `INTEGRATION_CREDENTIALS_INVALID` 와 다른 코드다(표 아래) | [서비스별 인증 방식과 자격 증명](../CLE-INT/CLE-INT-AUTH.md) |
| `INTEGRATION_CREDENTIALS_INVALID` | 400 | `previewToken` 으로 통합을 만들 때(`POST /api/integrations`) 저장된 미리보기 자격 증명이 암호화되지 않은 문자열이라 쓰지 않음 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `OAUTH_PREVIEW_INVALID` · `OAUTH_PREVIEW_EXPIRED` · `OAUTH_PREVIEW_MISMATCH` | 400 | `previewToken` 으로 통합을 만들 때 미리보기 토큰을 쓸 수 없음. 순서대로 토큰이 없거나 이미 썼거나 요청자(워크스페이스 · 사용자)의 것이 아님, 발급 뒤 10분이 지남, 요청의 서비스 유형이 미리보기와 다름. 미리보기 토큰은 `new` 모드 콜백이 발급한다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `OAUTH_TARGET_MISMATCH` | 400 | `new` 가 아닌 모드의 `oauth/begin` 본문이 대상 통합(`integrationId`)과 맞지 않음. 서비스가 대상 통합의 서비스 유형과 다르거나 Cafe24 상점 식별자 · 앱 유형이 대상 통합의 값과 다름 | [OAuth 연결과 토큰 갱신 「`oauth/begin` 요청과 응답」](../CLE-INT/CLE-INT-OAUTH.md#oauthbegin-요청과-응답) |
| `INTEGRATION_OAUTH_UNSUPPORTED` | 400 | OAuth 를 쓰지 않는 서비스로 `oauth/begin` 을 요청함 | [OAuth 연결과 토큰 갱신 「`oauth/begin` 요청과 응답」](../CLE-INT/CLE-INT-OAUTH.md#oauthbegin-요청과-응답) |
| `OAUTH_CONFIG_MISSING` | 500 · 없음 (통합 `last_error.code`) | OAuth 앱 설정(서버 환경 변수)이 없음. `oauth/begin`(Cafe24 Public 과 환경 변수로 설정하는 프로바이더)과 소셜 로그인 시작(`GET /api/auth/oauth/:provider`)은 500 으로 답한다. 통합 콜백의 토큰 교환에서 나면 통합의 `last_error.code` 에 남는다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드), [가입과 로그인 「소셜 로그인」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#소셜-로그인) |
| `CAFE24_INVALID_MALL_ID` | 400 · 없음 (통합 `last_error.code`) · 없음 (노드 `output.error.code`) | `mall_id` 가 형식(소문자 영숫자 · 하이픈, 3~50자)에 맞지 않거나 없음. `oauth/begin` 은 400 으로 답하고, 콜백의 토큰 교환에서 state 에 `mall_id` 가 없으면 통합의 `last_error.code` 에 남는다. Cafe24 노드는 통합의 `mall_id` 가 형식에 맞지 않으면 에러 포트로 낸다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드), [Cafe24 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-CAFE24.md#에러-코드) |
| `CAFE24_INVALID_APP_TYPE` | 400 | `oauth/begin` 의 Cafe24 앱 유형이 `public` · `private` 가 아님 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `CAFE24_PRIVATE_APP_CREDENTIALS_REQUIRED` | 400 · 없음 (통합 `last_error.code`) | Cafe24 Private 앱의 `oauth/begin` 에 `client_id` · `client_secret` 이 없음. 콜백의 토큰 교환에서 state 에 자격 증명이 없어도 나고 이때는 통합의 `last_error.code` 에 남는다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `CAFE24_PRIVATE_APP_USE_TEST_RUN` | 400 | Cafe24 Private 앱은 이 요청으로 OAuth 를 시작하지 않음. `oauth/begin` 이 `new` 가 아닌 모드로 오거나 설치 대기 중인 Private 통합에 재인증을 요청함. 이름의 경위는 §3 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `CAFE24_PRIVATE_APP_INSTALL_TOKEN_MISSING` | 400 | 설치 토큰(App URL)이 없는 Cafe24 Private 통합에 재인증(`POST /api/integrations/:id/reauthorize`)이나 추가 권한 요청(`POST /api/integrations/:id/request-scopes`)을 보냄. 복구는 통합을 지우고 다시 등록하는 것이다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` | 409 | 같은 워크스페이스에 같은 `mall_id` 의 Cafe24 통합이 이미 있음. `oauth/begin` 의 사전 검사, Private 설치 대기 행 쓰기, 통합 저장의 상점 식별자 UNIQUE 경합에서 난다. 응답에 기존 통합의 ID 를 싣지 않는다(REQ-INTOAUTH-065). 이름의 경위는 §3 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드), [OAuth 연결과 토큰 갱신 「`CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 이름을 유지한다」](../CLE-INT/CLE-INT-OAUTH.md#cafe24_private_app_already_connected-이름을-유지한다) |
| `MAKESHOP_CREDENTIALS_REQUIRED` | 400 · 없음 (통합 `last_error.code`) | MakeShop `oauth/begin` 에 `client_id` · `client_secret` 이 없음. 본문 없이 begin 을 다시 부르는 MakeShop 재인증도 이 코드로 끝난다. 콜백의 토큰 교환에서 state 에 자격 증명이 없어도 나고 이때는 통합의 `last_error.code` 에 남는다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `MAKESHOP_USE_SHOPSTORE_INSTALL` | 400 | 본문에 자격 증명을 실은 MakeShop `oauth/begin` 이 `new` 가 아닌 모드로 옴. 이름의 경위는 §3 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `CAFE24_PRIVATE_APP_INSTALL_PENDING` · `MAKESHOP_INSTALL_PENDING` | 409 | `oauth/begin`(`new`)이 같은 상점의 설치 대기 행을 다시 쓰려는데 그 행이 남의 개인 통합임. `details` 에는 `pendingInstallExpiresAt` 만 싣는다(REQ-INTOAUTH-061). 조직 통합의 설치 대기 행이고 요청자가 관리자 미만이면 `ADMIN_REQUIRED`(§6.2)다. 이름의 경위는 §3 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드), [OAuth 연결과 토큰 갱신 「설치 대기 행 재사용의 권한」](../CLE-INT/CLE-INT-OAUTH.md#설치-대기-행-재사용의-권한) |
| `INTEGRATION_NAME_TAKEN` | 409 | 통합 생성 · 수정이나 `oauth/begin` 의 설치 대기 행 쓰기에서 같은 워크스페이스에 같은 이름의 통합이 있음 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `INTEGRATION_OWNER_NOT_MEMBER` | 409 | 통합 범위 변경(`PATCH /api/integrations/:id/scope`)으로 조직 통합을 개인 통합으로 바꾸려는데 통합을 만든 사람이 워크스페이스 멤버가 아님 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `INTEGRATION_IN_USE` | 409 | 워크플로우 노드가 아직 참조하는 통합을 지우려 함(`DELETE /api/integrations/:id`). 서비스는 예외에 사용처 목록(`usages`)을 함께 넣지만 전역 예외 필터가 `code` · `message` · `details` 만 남겨 응답에는 실리지 않는다 | [통합 관리 「사용처 추적과 삭제 차단」](../CLE-INT/CLE-INT-MANAGE.md#사용처-추적과-삭제-차단), [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `INTEGRATION_ROTATE_UNSUPPORTED` | 400 | OAuth2 통합에 자격 증명 교체(`POST /api/integrations/:id/rotate`)를 요청함. OAuth2 통합은 재인증을 쓴다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `INTEGRATION_TEST_FAILED` | 400 | 자격 증명 교체가 새 자격 증명으로 연결 테스트를 했는데 실패함. 상태는 400 이다([통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드)). `message` 는 연결 테스트 결과의 메시지다. 결과에 `code` 가 있으면 `details: { testCode }` 로 싣는다. 이 값은 에러 코드가 아니라 연결 테스트 결과의 코드다. 지금 구현은 `testCode` 를 싣지 않는다(NERV Task `CLE-T-XCMNP6`) | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `INTEGRATION_SCOPE_UNSUPPORTED` | 400 | OAuth2 가 아닌 통합에 추가 권한 요청(`POST /api/integrations/:id/request-scopes`)을 보냄 | [OAuth 연결과 토큰 갱신 「통합 재인증과 추가 권한 요청」](../CLE-INT/CLE-INT-OAUTH.md#통합-재인증과-추가-권한-요청) |
| `CAFE24_INSTALL_RATE_LIMITED` · `MAKESHOP_INSTALL_RATE_LIMITED` | 429 | 설치 엔드포인트에서 같은 IP 의 실패가 쌓여 잠김. `details` 와 `Retry-After` 는 없다. 노드의 `CAFE24_RATE_LIMITED` · `MAKESHOP_RATE_LIMITED`(§6.22)와 다른 코드다 | [OAuth 연결과 토큰 갱신 「설치 엔드포인트 (App URL)」](../CLE-INT/CLE-INT-OAUTH.md#설치-엔드포인트-app-url) |
| `CAFE24_INSTALL_INVALID_TOKEN` · `MAKESHOP_INSTALL_INVALID_TOKEN` | 404 | 설치 토큰의 형식이 틀렸거나 그 토큰의 통합이 없음. IP 실패로 센다 | [OAuth 연결과 토큰 갱신 「설치 엔드포인트 (App URL)」](../CLE-INT/CLE-INT-OAUTH.md#설치-엔드포인트-app-url) |
| `CAFE24_INSTALL_MISSING_PARAMS` · `MAKESHOP_INSTALL_MISSING_PARAMS` | 400 | 설치 요청에 필수 query 가 없음. Cafe24 는 `mall_id` · `timestamp` · `hmac`, MakeShop 은 `shop_uid` · `timestamp` · `hmac` 이다 | [OAuth 연결과 토큰 갱신 「설치 엔드포인트 (App URL)」](../CLE-INT/CLE-INT-OAUTH.md#설치-엔드포인트-app-url) |
| `CAFE24_INSTALL_REPLAY` · `MAKESHOP_INSTALL_REPLAY` | 400 | 설치 요청의 `timestamp` 가 ±5분 밖이거나 해석되지 않음, 또는 같은 요청을 다시 보냄(nonce 재사용) | [OAuth 연결과 토큰 갱신 「설치 엔드포인트 (App URL)」](../CLE-INT/CLE-INT-OAUTH.md#설치-엔드포인트-app-url), [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `CAFE24_INSTALL_INVALID_HMAC` | 403 | HMAC 검증 실패, 통합에 `client_secret` 이 없음, 또는 요청의 `mall_id` · 앱 유형이 토큰의 통합과 다름. IP 실패로 센다 | [OAuth 연결과 토큰 갱신 「설치 엔드포인트 (App URL)」](../CLE-INT/CLE-INT-OAUTH.md#설치-엔드포인트-app-url), [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |
| `MAKESHOP_INSTALL_INVALID_HMAC` | 403 | HMAC 검증 실패, 통합에 시크릿이 없음, 또는 요청의 `shop_uid` 가 토큰의 통합과 다름. IP 실패로 센다 | [OAuth 연결과 토큰 갱신 「설치 엔드포인트 (App URL)」](../CLE-INT/CLE-INT-OAUTH.md#설치-엔드포인트-app-url) |
| `CAFE24_INSTALL_FAILED` · `MAKESHOP_INSTALL_FAILED` | 예외의 상태 · 500 | 설치 처리 중 코드가 없는 실패가 남. 코드가 없는 `HttpException` 이면 그 상태와 메시지를 싣는다. 그 밖의 예외(DB · 런타임 오류 등)는 500 과 고정 문구로 답하고 예외 원문은 `requestId` 와 함께 서버 로그에만 남긴다. IP 실패로 세지 않는다 | [OAuth 연결과 토큰 갱신 「설치 엔드포인트 (App URL)」](../CLE-INT/CLE-INT-OAUTH.md#설치-엔드포인트-app-url) |
| `MAKESHOP_ALREADY_CONNECTED` | 409 | MakeShop 설치에서 같은 워크스페이스에 같은 `shop_uid` 의 연결된 MakeShop 통합이 이미 있음. 사전 검사와 상점 식별자 UNIQUE 경합에서 난다. 응답에 기존 통합의 ID 를 싣지 않는다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드), [OAuth 연결과 토큰 갱신 「설치 엔드포인트 (App URL)」](../CLE-INT/CLE-INT-OAUTH.md#설치-엔드포인트-app-url) |
| `MAKESHOP_INVALID_SHOP_UID` | 400 · 없음 (노드 `output.error.code`) | `shop_uid` 형식 위반. 설치 엔드포인트는 400 으로 답하고 MakeShop 노드는 에러 포트로 낸다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드), [MakeShop 노드 「에러 코드」](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#에러-코드) |
| `OAUTH_STATE_EXPIRED` | 없음 (통합 `last_error.code`) | 콜백의 state 가 만료됨. `new` 모드 state 는 통합이 없어 HTML 로만 끝난다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드), [OAuth 연결과 토큰 갱신 「에러 매핑」](../CLE-INT/CLE-INT-OAUTH.md#에러-매핑) |
| `OAUTH_INVALID_SCOPE` | 없음 (통합 `last_error.code`) | Cafe24 authorize 단계가 `?error=invalid_scope` 로 돌아옴. `last_error.details.requiresCafe24Approval` 에 별도 승인 권한 범위가 원인인지 싣는다. 연결된 통합은 상태를 그대로 두고 사유를 `oauth_invalid_scope` 로 둔다 | [OAuth 연결과 토큰 갱신 「에러 매핑」](../CLE-INT/CLE-INT-OAUTH.md#에러-매핑) |
| `OAUTH_TOKEN_EXCHANGE_FAILED` | 없음 (통합 `last_error.code`) | 콜백의 토큰 교환 실패. 연결된 통합의 재인증이면 통합이 `error(auth_failed)` 가 된다. 다만 Cafe24 Private 재설치 대기 표시가 살아 있으면 상태를 바꾸지 않는다. 설치 대기 행은 상태를 그대로 두고 사유만 적는다 | [OAuth 연결과 토큰 갱신 「에러 매핑」](../CLE-INT/CLE-INT-OAUTH.md#에러-매핑) |
| `OAUTH_CALLBACK_FAILED` | 없음 (통합 `last_error.code`) | 콜백 처리 중 코드가 없는 예외가 났을 때 `last_error.code` 에 적는 대체값. 이 코드로 던지는 곳은 없다 | [OAuth 연결과 토큰 갱신 「에러 매핑」](../CLE-INT/CLE-INT-OAUTH.md#에러-매핑) |
| `OAUTH_DENIED` | 없음 (콜백 HTML) | OAuth 제공자가 `error` query 로 돌아옴(사용자 거부 등). Cafe24 의 `invalid_scope` 는 위 `OAUTH_INVALID_SCOPE` 다 | [OAuth 연결과 토큰 갱신 「에러 매핑」](../CLE-INT/CLE-INT-OAUTH.md#에러-매핑), [OAuth 연결과 토큰 갱신 「OAuth 콜백 엔드포인트」](../CLE-INT/CLE-INT-OAUTH.md#oauth-콜백-엔드포인트) |
| `OAUTH_STATE_MISSING` · `OAUTH_CODE_MISSING` | 없음 (콜백 HTML) | 콜백 query 에 `state` 나 `code` 가 없음 | [OAuth 연결과 토큰 갱신 「에러 매핑」](../CLE-INT/CLE-INT-OAUTH.md#에러-매핑), [OAuth 연결과 토큰 갱신 「OAuth 콜백 엔드포인트」](../CLE-INT/CLE-INT-OAUTH.md#oauth-콜백-엔드포인트) |
| `OAUTH_STATE_INVALID` | 없음 (콜백 HTML) | `new` 모드가 아닌 state 에 대상 통합이 없음 | [OAuth 연결과 토큰 갱신 「에러 매핑」](../CLE-INT/CLE-INT-OAUTH.md#에러-매핑), [OAuth 연결과 토큰 갱신 「OAuth 콜백 엔드포인트」](../CLE-INT/CLE-INT-OAUTH.md#oauth-콜백-엔드포인트) |
| `INTEGRATION_INSTALL_EXPIRED` | 없음 (콜백 HTML) | state 는 유효하지만 대상 통합이 설치 기한을 넘겨 만료되고 상점 자리를 놓았음. 예외는 400 이지만 콜백은 HTML 로 답하고 통합 행과 `last_error` 를 바꾸지 않는다 | [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드), [OAuth 연결과 토큰 갱신 「만료된 설치 대기 행은 상점 자리를 놓는다」](../CLE-INT/CLE-INT-OAUTH.md#만료된-설치-대기-행은-상점-자리를-놓는다-2026-10-29) |

- **`OAUTH_STATE_MISMATCH` 는 §6.18 행이다.** 통합 콜백에서 state 를 찾지 못하면 HTML 로만 끝난다. 소비한 state 의 provider 가 다르면 대상 통합의 `last_error.code` 에도 남는다.
- **비슷한 이름 주의**: `INTEGRATION_INVALID_CREDENTIALS` 와 `INTEGRATION_CREDENTIALS_INVALID` 는 다른 코드다. 앞의 것은 입력한 자격 증명이 필드 규칙에 맞지 않을 때, 뒤의 것은 저장된 미리보기 자격 증명을 쓸 수 없을 때 난다. 두 코드를 하나로 묶어 분기하지 않는다(규칙 4).
- **빈도 제한 코드는 세 부류다.** 설치 엔드포인트의 IP 실패 잠금은 `CAFE24_INSTALL_RATE_LIMITED` · `MAKESHOP_INSTALL_RATE_LIMITED` 다. 노드와 도구의 429 재시도 소진은 `CAFE24_RATE_LIMITED` · `MAKESHOP_RATE_LIMITED`(§6.22)다. 요청 빈도 제한(`@Throttle`) 초과는 `RATE_LIMITED`(§6.1)이고 설치 엔드포인트와 콜백에도 걸린다.
- **`INSUFFICIENT_SCOPE` 는 행이 없다(규칙 9).** [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) 는 이 코드를 403 과 `details.missingScopes` 로 적지만 내는 곳이 없다. Cafe24 노드와 도구는 403 을 `CAFE24_AUTH_FAILED` 로 낸다. 권한 범위 부족 신호가 있으면 통합이 `error(insufficient_scope)`, 없으면 `error(auth_failed)` 가 되고 `last_error.code` 는 둘 다 `CAFE24_AUTH_FAILED` 다. 연결 테스트는 403 을 `CAFE24_INSUFFICIENT_SCOPE` 로 돌려준다(§6.22). 어느 코드로 맞출지는 [통합 관리 「미결 사항」](../CLE-INT/CLE-INT-MANAGE.md#미결-사항) 에서 정한다.
- **코드에 있지만 닿지 않는 이름 셋은 행이 없다(규칙 9).** `MAKESHOP_PKCE_REQUIRED` 는 내부 안전망이고 지금 흐름에서는 나지 않는다. `OAUTH_PROVIDER_UNKNOWN` 은 통합 콜백에서는 컨트롤러가 먼저 코드 없는 400 HTML 로 거절하고, 소셜 로그인에서는 경로 파라미터 검사가 먼저 거절한다. `INTEGRATION_ALREADY_CONNECTED` 는 상점 식별자 UNIQUE 경합의 범용 대체값인데 상점 식별자를 쓰는 두 서비스(Cafe24 · MakeShop)가 모두 전용 코드로 바뀐다.

### 6.22 통합 노드 (도메인 문서 참조)

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

### 6.23 MCP 클라이언트 (도메인 문서 참조)

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

### 6.24 Background Runs REST (도메인 문서 참조)

`GET /api/executions/:executionId/background-runs/:backgroundRunId`(`cursor` · `limit` query)가 내는 코드다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `INVALID_LIMIT` | 400 | `limit` 이 1~200 밖임. 이 경로에서는 요청 DTO 검증이 먼저 `VALIDATION_ERROR` 로 답한다. 지금 이 코드가 응답에 나가는 곳은 지식 저장소 그래프 시각화(`GET /api/knowledge-bases/:id/graph/visualization`)의 `limit` 검사다 | [Background 노드 「API 에러 코드」](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md#api-에러-코드), [Graph RAG 「API」](../CLE-KB/CLE-KB-GRAPH.md#api) |
| `INVALID_CURSOR` | 400 | `cursor` 를 해석하지 못함. 실행 소유권 검사보다 먼저 판정한다 | [Background 노드 「API 에러 코드」](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md#api-에러-코드) |
| `EXECUTION_NOT_FOUND` | 404 | 실행이 없거나 그 워크플로우가 요청자의 워크스페이스에 없음. EIA REST 도 같은 404 를 쓴다(§6.9 표 아래). 트리거 단위 토큰 경로의 401 은 §6.9 행이다 | [Background 노드 「API 에러 코드」](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md#api-에러-코드) |
| `BACKGROUND_RUN_NOT_FOUND` | 404 | `backgroundRunId` 가 그 실행에 없음 | [Background 노드 「API 에러 코드」](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md#api-에러-코드) |

### 6.25 AI 어시스턴트 스트림 (도메인 문서 참조)

어시스턴트 메시지 스트림(`POST /api/workflow-assistant/sessions/{id}/messages`)의 SSE `error` 이벤트가 내는 코드다. 이벤트 데이터는 `{code, message}` 이고 HTTP 에러 응답 봉투가 아니다([AI 어시스턴트 스트리밍과 세션 API](../CLE-WF/CLE-WF-ASSIST-PROTO.md#sse-이벤트)). `message` 는 코드별 고정 영문이고 화면 문구는 프론트엔드가 코드로 고른다. 같은 API 의 세션 REST 코드는 §6.19 다.

| 코드 | 설명 | 정의 문서 |
|------|------|-----------|
| `ASSISTANT_NO_LLM_CONFIG` | 쓸 모델 설정이 없음. 지정한 설정이 없는데 워크스페이스 기본 설정도 없거나, 지정한 설정을 찾지 못해 기본 설정으로 대신하려 했는데 기본 설정도 없음. 기본 설정이 있으면 에러 없이 대신하고 `config_fallback` 이벤트로 알린다 | [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md#에러-처리) |
| `ASSISTANT_STREAM_FAILED` | 스트림을 열기 전 실패(OpenAI 계열의 429 · SDK 요청 타임아웃 포함), 모델 설정 조회 실패(DB 장애 등), 턴 처리 중 서비스 내부 실패. 원인을 나누지 않는다 | [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md#에러-처리) |
| `ASSISTANT_TOO_MANY_TOOL_CALLS` | 한 턴의 LLM 호출 라운드 상한이나 도구 호출 예산을 넘음. `message` 에 한도 숫자가 들어간다 | [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md#어시스턴트-도구-호출-한도) |

LLM 클라이언트 스트림의 `LLM_RATE_LIMIT` · `LLM_CONNECTION_ERROR` · `LLM_OUTPUT_MALFORMED`(§6.17)도 같은 이벤트에 코드 그대로 실린다. 다만 `message` 는 클라이언트의 진단 문구가 아니라 어시스턴트의 코드별 고정 영문이다. 정의는 §6.17 행이라 이 표에 다시 두지 않는다. 스트리밍을 지원하지 않는 프로바이더의 `LLM_STREAMING_UNSUPPORTED`(§6.17)도 그대로 넘기기로 정했지만 아직 구현하지 않았다(미구현, NERV Task `CLE-T-EK4DMX`). 지금은 `ASSISTANT_STREAM_FAILED` 로 나가고, 다섯 프로바이더가 모두 스트리밍을 지원해 발동 경로는 없다.

편집 도구 실패는 에러 코드가 아니다. `tool_call` 이벤트의 `result.ok: false` 로 오고 턴은 이어진다. 설계 단계에 있던 `ASSISTANT_TOOL_FAILED` · `ASSISTANT_LLM_CONFIG_INVALID` · `ASSISTANT_STREAMING_UNSUPPORTED` 는 발행된 적이 없어 등재하지 않는다(규칙 9).

## 미결 사항

- **발행처가 없는 등재 코드**: `DATABASE_ERROR`(§6.1)는 백엔드에서 발행처가 확인되지 않는다(grep 0건). 초대 흐름의 소문자 `rate_limited`(§3)도 백엔드·프론트엔드 소스에 문자열이 0건이다. 초대 한도는 `@Throttle` 로 걸리고 전역 필터가 429 를 `RATE_LIMITED` 로 바꾼다([HTTP API 규약](CLE-API-CONV.md)). 초대 에러 표에서 뺄지는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#미결-사항) 의 같은 미결과 함께 정한다. 규칙 9 는 발행된 적 없는 코드의 등재를 지우라고 정하지만 이 판단은 코드 실측에 기대므로 등재를 지울지 결정이 필요하다. `INTERACTION_TIMEOUT`(§6.7)도 `error-codes.ts` 에 정의만 있고 발행처가 없다(2026-11-12 grep 0건). [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) 의 재개 명령 에러 표에도 있어 함께 정한다. 정리는 NERV Task `CLE-T-8WXV7T` 에서 한다.
- **어시스턴트 스트림 코드의 프로바이더 분기**: §6.25 의 코드에는 규칙과 맞지 않는 점이 두 가지 있다. 규칙 4 와는 같은 429 와 SDK 요청 타임아웃이 프로바이더에 따라 다른 코드로 나가는 점이 어긋난다(429 는 Anthropic·Google 이면 `LLM_RATE_LIMIT`, OpenAI 계열이면 `ASSISTANT_STREAM_FAILED`). 규칙 6 과는 `ASSISTANT_STREAM_FAILED` 한 코드가 429 · SDK 타임아웃 · 모델 설정 조회 실패 · 서비스 내부 실패를 함께 담는 점이 어긋난다. 프로바이더 분기를 통일할지는 NERV Task `CLE-T-0R5SYN` 이 정한다.
- **발행 중인데 등재되지 않은 Passkey 코드**: 백엔드는 `WEBAUTHN_CREDENTIAL_EXISTS` · `WEBAUTHN_NOT_REGISTERED` 를 발행한다. 그런데 §6.3 과 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) 의 에러 코드 표에 없다(규칙 8). NERV Task `CLE-T-9KCQ7Y` 가 Passkey 등록 저장의 원자성과 함께 등재한다. 같은 처지였던 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 는 2026-11-12 에 등재했다(NERV Task `CLE-T-3P4ENZ`).
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

### 왜 예외 등록부인가

완벽한 이름을 소급해 강제하면 호환을 깨는 이름 바꾸기가 쏟아진다. 부정확하지만 안정적인 기존 코드는 "예외 등록과 정의 명확화" 로 흡수하고 규율은 새 코드에만 적용해 일관성을 점점 높인다.

### 예외 등록 근거에 "모듈 안 일관성 보존" 도 들어가는 이유

§2 의 호환 우려가 없는 코드라도 이미 소문자로 굳은 모듈의 일부라면 일부만 `UPPER_SNAKE_CASE` 로 바꾸는 것이 모듈 안에 대소문자를 섞어 국소 일관성을 해친다. 이런 코드는 정규화의 가독성 이득(0)보다 모듈 일관성 이득이 커서 §5 가 아니라 §3 으로 흡수한다(워크스페이스 초대 모듈, 2026-06-28 결정). 즉 §3 흡수 조건은 "이름 바꾸기가 호환을 깬다" 와 "이름 바꾸기가 모듈 일관성을 해친다" 의 합집합이다.

### 책임을 나누는 이유

이 문서는 이름 규율과 카탈로그만 맡고 응답 봉투·상태 코드 선택·노드 출력 형태는 개요에 적은 문서가 맡는다. 각 축을 나눠 따로 발전시키고 책임이 겹치지 않게 한다. 원문에서는 이름 규율과 카탈로그가 서로 다른 문서에 있어 표기 규칙(`UPPER_SNAKE_CASE`)의 기준을 두 문서가 서로 가리켰다. 두 내용을 이 문서에 모으면서 표기 규칙을 규칙 2 로 한 번만 적었다.

### 은퇴 코드의 진입 기준이 "client 코드 분기 없음" 인 이유

§5 의 기준은 "외부 노출 여부" 가 아니라 "외부 client 코드에 옛 코드로 분기하는 지점이 있었는가" 다. 사용자 문서 목록에만 나온 코드는 client 가 그 문자열로 분기하지 않으므로 교체의 호환 영향이 0이고 문서만 맞추면 된다. client 에 하드코딩 분기가 있었다면 §2 가 적용돼 새 코드나 정식 마이그레이션을 거친다(`WORKSPACE_REQUIRED` 가 이 기준의 첫 적용이다).

### 그 이분법에 없던 세 번째 상태를 등급 B 로 적었다 (2026-08-22)

위 기준은 "분기 0 을 확인" 과 "하드코딩 분기 있음" 두 갈래만 다룬다. 워크스페이스 JWT 로 부를 수 있는 내부 REST 는 저장소 밖 호출자를 배제할 수 없어 어느 쪽으로도 판정되지 않고 "찾지 못했다" 만 관측된다. `INVALID_INPUT` 통일이 그 첫 사례라 등급을 A 와 B 로 갈랐다. 갈래가 없으면 근거를 부풀려 A 로 적거나(원칙이 실제보다 강해진다) 위험이 없는데도 정식 마이그레이션을 강제하는 수밖에 없다. 등급을 나누면 각 행이 자기 근거의 강도를 드러낸다.

### 재실행 경로의 코드를 `INVALID_INPUT` 에서 옮긴 경위 (2026-08-22)

옛 카탈로그는 "`RERUN_` prefix 를 붙이지 않고 이름 안정성상 유지한다" 고 적었다. 그 문장이 기각한 것은 `RERUN_INVALID_INPUT` 으로의 개명이었지 세 경로 통일이 아니었다. 통일 결정으로 이름 바꾸기 자체가 뒤집혔다(§5). 재실행은 2026-08-20 에 파라미터 검증 헬퍼의 세 번째 소비처가 됐다. 그전에는 내부 사유를 `errors` 키로 던져 필터가 읽지 못했고 필드별 내역이 응답에 실리지 않았다. `MASKED_VALUE_RESUBMITTED` 를 더하면서 배선을 함께 고쳤다.

### `ACCOUNT_LOCKED` 423 → 401 오기 정정 (2026-08-31)

카탈로그는 423, 구현(`auth.service.ts` 의 `UnauthorizedException`)과 계정 데이터 흐름 문서의 두 표는 401 이었다. 낡은 것이 아니라 처음부터 틀렸다. `git log -S "LockedException"` 이 백엔드 auth 에서 0건이라 423 을 던진 적이 없고 그 행은 최초 초안부터 그대로였다.

**기각한 대안: 구현을 423 으로 바꾸기.** 상태 코드는 API 계약이라 클라이언트가 401 로 분기해 재로그인을 유도하고 있을 수 있다. 문서가 틀렸다는 근거가 실측으로 확정됐으므로 문서를 고치는 쪽이 위험이 없다. 423 이 의미상 낫다는 판단은 별개 제품 결정이다.

### `TOKEN_EXPIRED` 설명을 리프레시 토큰 만료로 맞춘 이유

원문 카탈로그는 이 코드를 액세스 토큰 만료로 설명했다. 인증 흐름 문서는 리프레시 토큰 단순 만료에 이 코드를 쓴다고 정하고([세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md)) 현재 구현도 갱신 경로에서만 던진다. 카탈로그는 정의 문서를 따르므로(규칙 8) 설명을 정의 문서에 맞췄다. 만료된 액세스 토큰에 전용 코드를 줄지는 이 정렬과 별개인 제품 결정이다.

### `ALERT_RULE_NOT_FOUND` 를 직접 등재한 이유 (2026-08-31)

`alerts.service.ts` 가 발행하는데 카탈로그에 0건이었고 문서화는 기능 문서에만 있었다. 도메인 참조 절이 아니라 §6.4 에 직접 등재했다. 같은 절 `MODEL_CONFIG_NOT_FOUND` 의 직접 등재 선례를 따른 것이다.

### 카탈로그 완결성 작업의 경위

카탈로그가 제품 전체 목록이라고 선언하면서도 도메인 문서의 코드가 빠져 있어 여러 번에 걸쳐 채웠다. 방식은 늘 같았다. 정의 기준은 도메인 문서에 두고 카탈로그에는 공용 가시성을 위해 등재만 한다. 새 원칙도 코드 재정의도 아니다.

- 2FA·WebAuthn(§6.3)과 지식 저장소·Graph RAG(§6.11) 코드를 등재했다. 코드에만 있고 도메인 문서에 없던 재인증 세부 코드는 "문서화 → 등재" 순서를 지키려고 뒤로 미뤘다.
- 인증 문서의 "강제 종료 재인증" 행이 구현(`verifyReauth` = 비밀번호 또는 TOTP)보다 부풀려져 있어(WebAuthn·이메일 OTP 대체) 실제 지원으로 맞추고 나머지를 미지원으로 명시했다([세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md)). 그 뒤 재인증 세부 코드 셋을 §6.3 에 등재하고 옛 주석의 상태 오기(`REAUTH_REQUIRED` 403 → 400, `PASSWORD_INVALID` 400 → 401)를 코드 기준으로 고쳤다.
- 미뤘던 `NOT_A_MEMBER`, `INVALID_PASSWORD`, `PASSWORD_REQUIRED` 를 등재했다. 2026-09-02 에 `INVALID_PASSWORD` 는 은퇴해 응답에 나가지 않는다(§5 등급 B). 등재를 되돌린 것이 아니라 등재가 기록하던 비슷한 이름의 원인을 없앤 것이다.
- 워크스페이스 멤버 직접 추가 코드(§6.12)를 등재했다. 그 밖의 역할·멤버십 관리 코드는 도메인 문서에 상태 코드가 없어 미뤘다가, 도메인 문서가 현재 구현 근거로 상태 코드를 적은 뒤 §6.18 에 등재했다.
- 2026-10-10 에 코드가 이미 내던 `USER_NOT_FOUND` · `WORKSPACE_NOT_FOUND`(§6.4)와 `TOTP_NOT_ENABLED` · `TOTP_NOT_INITIALIZED`(§6.3)를 등재했다. `USER_NOT_FOUND` 는 여러 모듈이 같이 쓰는 일반 코드라 §6.12 가 아니라 §6.4 에 두었다. `WORKSPACE_NOT_FOUND` 는 관리 경로의 404 와 토큰 검증의 401 이 상태도 뜻도 달라 두 행으로 적었다. 두 발행 자리는 [워크스페이스와 멤버 「워크스페이스를 찾지 못할 때」](../CLE-ACCT/CLE-ACCT-WS.md#워크스페이스를-찾지-못할-때) 가 정한다.

### 모델 설정 코드 분리: `MODEL_CONFIG_NOT_FOUND`(404)와 `MODEL_CONFIG_DEFAULT_MISSING`(400)

옛 코드 하나가 "지정한 설정 없음"(404)과 "워크스페이스 기본값 미설정"(400)을 함께 담아 같은 코드가 두 상태를 가졌다. id 경로는 `MODEL_CONFIG_NOT_FOUND`(404, 존재 누설 방지)로 한정하고 기본값 미설정은 설정을 안내하는 `MODEL_CONFIG_DEFAULT_MISSING`(400)으로 나눴다. `resolveEmbedding` 의 기본값 부재는 "설정 미완료 안내" 가 아니라 "이 자원을 지금 해석할 수 없음" 이 더 정확해 404 를 유지한다. 설정 안내(400)는 chat/LLM 기본값 경로(`resolveConfig`)에서만 낸다(사용자 결정 2026-06-12).

### 413 `PAYLOAD_TOO_LARGE`(전역)와 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(도메인)를 함께 두는 이유

둘 다 413 이지만 발행 층과 한도가 다르다. `PAYLOAD_TOO_LARGE` 는 413 의 전역 코드로 모든 라우트에 공통이다. body-parser 의 본문 한도와 multipart 업로드의 파일 크기 한도(`FileInterceptor`)가 이 코드로 나간다. `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 는 공개 웹훅 전용 가드가 파싱 뒤 32KB 보수 한도로 추가 제한할 때만 낸다. 일반 신규 코드는 전역 코드를 쓰고 도메인 특화 한도가 있을 때만 별도 코드를 만든다([웹훅 「본문 크기」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#본문-크기)).

### `TRIGGER_NOT_FOUND` 를 다른 워크스페이스의 워크플로우에도 쓰는 이유 (2026-10-05)

웹훅 트리거는 있으나 그 워크플로우가 트리거의 워크스페이스에 없을 때(저장 경계 이전의 교차 행)도 `TRIGGER_NOT_FOUND` 다. 규칙 6 은 새 조건에 새 코드를 만들게 한다. 이 조건은 클라이언트가 가를 조건이 아니고 엔드포인트가 없을 때와 구분하지 않는 것이 목적이다. 새 코드를 만들면 그 워크플로우가 다른 워크스페이스에 있다는 것이 드러난다. 같은 카탈로그의 `ALERT_RULE_NOT_FOUND` · `RERUN_EXECUTION_NOT_FOUND`(없거나 다른 워크스페이스는 같은 404)와 `TRIGGER_ENDPOINT_PATH_CONFLICT`(예약과 중복을 한 코드로 묶음)도 같은 방식이다. 선례는 두 부류다. `ALERT_RULE_NOT_FOUND` · `RERUN_EXECUTION_NOT_FOUND` 는 요청한 리소스 자체가 없거나 다른 워크스페이스에 있는 부재다. `TRIGGER_ENDPOINT_PATH_CONFLICT` 는 부재가 아니라 두 조건(예약 · 중복)을 한 코드로 묶어 예약을 감추는 은닉이다. 이번은 요청한 트리거는 있고 연결된 리소스(트리거의 워크플로우)가 다른 워크스페이스에 있는 경우라 부재 선례를 한 칸 넓힌 해석이다. 연결된 리소스의 부재에 따로 코드를 둔 `AUTH_CONFIG_NOT_FOUND`(400)와는 시점이 다르다. 그쪽은 트리거를 저장할 때 소유자에게 알리는 코드라 소유자가 고칠 수 있게 구분해 알린다. 이쪽은 실행 때 워크스페이스 밖의 호출자에게 나가는 응답이라 감춘다. 2026-10-05 에 이 방식을 규칙 6 의 단서로 올렸다(NERV Task `CLE-T-K9S0TE`). 호출자에게 보이는 뜻은 그 엔드포인트의 트리거가 없다는 것이라 §3 예외 등록부에 올리지 않는다. 근거는 [데이터 모델 개요 「참조의 소속」](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) 의 «없는 id 와 다른 워크스페이스의 id 를 구분하지 않는다» 이고 동작은 [웹훅 「에러 처리」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#에러-처리) 가 정한다(NERV Task `CLE-T-XYR067`).

### `RESUME_CHECKPOINT_MISSING` 정의에 중첩 재개의 호출 스택을 더한 이유 (2026-10-04)

카탈로그 행은 `NodeExecution.outputData` 결손만 적었다. 엔진은 그 전부터 중첩 재개의 빈 frame 목록, 호출 노드 부재, frame 에서 재개를 시작할 노드의 부재에도 이 코드를 냈다. 2026-10-04 에 frame 의 `workflowId` · `invokerNodeId` 결손도 조회 전에 이 코드로 마감하도록 했다(NERV Task `CLE-T-BV4YXZ`, [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 의 「rehydration 실패」). 그래서 행을 넓혔다.

- **규칙 6 의 새 조건으로 보지 않았다**: 네 경우 모두 park 때 커밋한 영속 컨텍스트가 깨져 재구동할 수 없다는 같은 뜻이다. 종결(실행 `cancelled`, 짝 노드 실행 `failed`)과 클라이언트 처리(`execution.cancelled` 의 `RESUME_*` 분기, 채팅 채널의 세션 만료 안내)도 같다. 문서가 기존 경우를 빠뜨렸던 것을 바로잡았다.
- **§3 에 등재하지 않았다**: 이름의 `CHECKPOINT` 는 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 「체크포인트」 절의 뜻이다. 그 절은 park 때 커밋하는 영속 컨텍스트를 체크포인트에 넣는다. 그 목록([실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md))에 호출 스택(`Execution.resume_call_stack`)이 있다. 이름이 뜻과 어긋나지 않는다.
- 같은 코드를 영속 상태 손상 밖의 재개 불변식 위반에도 쓴다. 맞는 처리기가 없을 때가 그 예다([큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) Rationale). 행의 괄호를 "예:" 로 적은 이유다.
- 호출 스택의 버전이 지원 범위보다 크면 이 코드가 아니라 `RESUME_INCOMPATIBLE_STATE` 다. 경계는 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 「rehydration 실패」 에 적었다.

### 어시스턴트 세션 코드를 도메인 참조 절로 올렸다 (2026-10-05)

어시스턴트 세션 REST API 의 `WORKFLOW_NOT_FOUND` · `ASSISTANT_SESSION_NOT_FOUND` · `ASSISTANT_SESSION_NOT_YOURS` 는 구현이 이미 내던 코드인데 카탈로그에 없었다. [데이터 모델 개요 「참조의 소속」](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) 이 세션 생성 `workflowId` 를 표에 올리고 404 `WORKFLOW_NOT_FOUND` 를 예외로 적으면서(사람 결정, NERV Task `CLE-T-QTRRE6`) 같은 API 의 세 코드를 §6.19 에 함께 등재했다. 발행하는 코드는 등재한다는 규칙 8 을 따랐다.

- **`WORKFLOW_NOT_FOUND` 를 `RESOURCE_NOT_FOUND` 로 바꾸지 않았다.** 이미 나가던 코드이고 이름을 바꾸면 규칙 5 의 이름 바꾸기 비용이 든다. 같은 본문의 `llmConfigId` 도 도메인 코드(404 `MODEL_CONFIG_NOT_FOUND`)라 이 API 안에서는 도메인 코드가 일관된다. 다른 워크플로우 경로의 `RESOURCE_NOT_FOUND` 와 갈리는 점은 §6.19 머리말에 적어 이 API 한정으로 묶었다.
- **세션 코드 둘의 뜻은 구현을 따랐다.** 정의 문서가 «워크스페이스 · 사용자 경계» 를 모두 `ASSISTANT_SESSION_NOT_YOURS` 로 적었으나 구현은 다른 워크스페이스의 세션을 404 `ASSISTANT_SESSION_NOT_FOUND` 로 가린다. 없는 것과 다른 워크스페이스의 것을 구분하지 않는 규칙과 맞는 쪽이 구현이라 정의 문서를 같은 변경에서 고쳤다.

### `EXECUTION_ENQUEUE_FAILED` 를 EIA `/interact` 재개 명령에도 쓴다 (2026-10-09)

이 코드의 행은 처음에 REST `POST /executions/:id/stop` 의 입력 대기 취소만 적었다. EIA `/interact` 의 `cancel` 과 그 별칭 `POST .../cancel` 도 같은 `ExecutionsService.stop` 을 불러 이미 이 코드를 냈다. 그때 코드에서 재개 명령 4종은 발행 결과(`queued`)를 보지 않고 202 `accepted:true` 를 냈다. 이 202 는 24시간 멱등 캐시에 들어간다. 그러면 같은 멱등 키로 다시 보내도 캐시된 202 가 돌아오고 명령은 끝내 재개 큐에 들어가지 못한다. 그래서 재개 명령 4종도 `cancel` 과 같이 503 `EXECUTION_ENQUEUE_FAILED` 로 응답하게 정했다. 이 결정은 사용자에게 묻지 않고 기본값으로 정해 알린 뒤 진행했다(2026-10-09). 503 은 멱등 캐시 대상(2xx·409·410)이 아니므로 다시 보내면 새로 처리한다. 반영과 코드 수정은 NERV Task `CLE-T-M6PERB` 에서 했다. 결정 이력은 그 Task 의 결정 기록에 있다.

- **새 코드를 만들지 않았다.** 조건의 뜻이 REST `stop` 과 같다. 두 경우 모두 발행 자체가 실패했고 실행은 입력 대기에 남는다. 클라이언트가 할 일도 다시 보내기 하나다. 그래서 규칙 6 의 새 조건이 아니다.
- **표면마다 코드를 나누지 않았다.** §6 머리말은 같은 뜻이라도 표면마다 다른 코드를 쓴다고 적는다. 그러나 EIA `cancel` 은 REST `stop` 과 같은 서비스 메서드를 부르므로 이 코드는 이미 두 표면에서 나가고 있었다. 재개 명령에 EIA 전용 코드를 주면 `/interact` 한 표면 안에서 같은 조건이 두 코드로 갈린다. 이 예외는 2026-10-17 에 §6 머리말에도 적었다(NERV Task `CLE-T-G0Y6MW`).
- **외부 API 를 내부 구현 식별자에 묶지 않는다는 원칙과 부딪치지 않는다(2026-10-17).** [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) 의 「WS 코드와 EIA 코드는 경로마다 다르게 쓴다」 Rationale 은 EIA REST 가 `EXECUTION_*` 를 그대로 드러내면 외부 API 가 내부 구현 식별자에 묶인다고 적는다. 그 Rationale 이 다루는 것은 WebSocket ack 와 EIA REST 가 함께 쓰는 실행 엔진 사전 검증의 코드다(`INVALID_EXECUTION_STATE` · `EXECUTION_MESSAGE_TOO_LONG`). `EXECUTION_ENQUEUE_FAILED` 는 그 부류가 아니다. WebSocket ack 에 싣지 않는 HTTP 진입점의 표준 코드이고 EIA `cancel` 이 먼저 내고 있었다. 뜻도 «명령을 큐에 넣지 못했으니 다시 보내라» 하나라 실행 엔진의 내부 상태나 typed error 를 드러내지 않는다. EIA REST 는 표준 코드 `EXECUTION_NOT_FOUND`(404)와 EIA 전용 `EXECUTION_TERMINATED`(410)도 이미 쓴다(§6.9). 그래서 `EXECUTION_` 접두어만으로 내부 식별자라고 보지 않는다(NERV Task `CLE-T-G0Y6MW`, finding 01a11f6e-11e0-75e5-8919-141118c39235).
- **202 의 `accepted: true` 는 큐에 들어간 명령에만 붙는다(2026-10-17).** [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) 의 「`interact`·`cancel` 은 202 와 ack 본문」 Rationale 은 `accepted: true` 가 큐 적재 성공을 명시한다고 적는다. 발행 결과를 보지 않고 202 를 내던 옛 재개 명령은 이 약속과 어긋났다. 큐에 넣지 못하면 503 으로 응답하므로 이제 202 와 `accepted: true` 가 큐 적재 성공과 맞는다.
- **WebSocket 재개 명령은 바꾸지 않았다.** 이 경로의 발행 실패는 `errorCode` 없는 실패 ack(`success:false`)로 바로 돌아간다. ack 는 요청마다 한 번 보내는 응답이라 어디에도 저장하지 않는다. 그래서 클라이언트는 실패를 보고 다시 보낼 수 있다. EIA REST 는 2xx 응답을 멱등 캐시에 넣으므로 실패를 2xx 로 알리면 재시도로 바로잡을 수 없다. 이 차이 때문에 EIA REST 만 HTTP 상태 코드(503)로 실패를 알린다.
- **채팅 채널 인바운드의 재개 명령은 이 코드를 내지 않는다.** 채팅 채널 인바운드는 서버 안에서 내부 신뢰 호출(`in_process_trusted`)로 같은 재개 명령을 부른다. 이 경로가 503 을 던지면 웹훅을 보낸 채널 프로바이더에게 5xx 가 나간다. 그 응답은 [채팅 채널 「인바운드 HTTP 응답 계약」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약) 이 따로 정한다. 그래서 재개 명령의 503 은 HTTP 진입점의 응답으로 한정했다. 이 범위는 사용자에게 묻지 않고 기본값으로 정해 알렸다. 2026-10-17 에 사람이 이 경로의 큐 적재 실패를 `202` 와 채널 건강도 `degraded` 로 처리하기로 정했다(NERV Task `CLE-T-EQDYC1`).
- **예외는 채팅 채널 `/start` 의 기존 실행 취소다.** `/start` 는 활성 실행을 취소할 때 재개 명령을 거치지 않고 `ExecutionsService.stop` 을 직접 부른다. 그래서 취소 메시지를 큐에 넣지 못하면 이 503 을 그대로 돌려주고 새 실행은 시작하지 않는다([채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) REQ-CHAT-064, NERV Task `CLE-T-V4WVF2`). 프로바이더는 non-2xx 를 받아 같은 update 를 다시 보낼 수 있다. 5xx 를 받아들인 이유는 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 의 「R-CC-27 활성 실행 중 /start 는 기존 실행을 취소하고 새로 시작한다」 Rationale 에 있다.
- **`/start` 의 취소 실패에도 새 코드를 만들지 않았다.** 조건의 뜻이 REST `stop` 과 같다. 취소 메시지 발행 자체가 실패했고 실행은 입력 대기에 남는다. 할 일도 다시 보내기 하나다. 그래서 규칙 6 의 새 조건이 아니다.
- **채팅 채널 `/cancel` 은 이 코드를 내지 않는다(2026-10-17).** `/cancel` 도 `/start` 처럼 `ExecutionsService.stop` 을 직접 부른다. 취소 메시지를 큐에 넣지 못하면 `stop` 이 이 503 을 던진다. 채팅 채널 인바운드는 이 503 을 프로바이더에 돌려주지 않고 `202` 로 응답한다. 채널 건강도는 `degraded` 가 되고 실행은 입력 대기에 그대로 있다. 응답과 건강도 규칙은 [채팅 채널 「인바운드 HTTP 응답 계약」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약) 이 정한다(사람 결정, NERV Task `CLE-T-EQDYC1`, finding 01a11f6d-e217-7753-90d0-b35549d99d76). 이 결정 전에는 `/cancel` 이 이 503 을 그대로 프로바이더에 내보냈고 이 카탈로그는 그 발행 지점을 적지 않았다. 기각한 대안은 `/start` 처럼 503 을 돌려주는 안이다. `/start` 의 503 은 옛 실행을 남긴 채 새 실행을 시작하지 않으려는 예외다. `/cancel` 에는 그런 이유가 없고 인바운드 응답의 `202` 고정 규칙에 예외만 늘어난다. 실패는 채널 건강도와 경고 로그에 남고 사용자는 `/cancel` 을 다시 보낼 수 있다.
- **WebSocket 재개 명령의 발행 실패는 실패 ack 로 알린다.** 코드(`websocket.gateway.ts`)는 `queued:false` 일 때 `errorCode` 없는 실패 ack(`success:false`)를 보낸다. 이 카탈로그는 처음부터 코드를 따랐다. [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) 과 [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 은 2026-10-11 에 승인된 판에서 이 경우를 성공 ack 의 `queued:false` 로 적었다. 2026-10-17 에 두 문서를 코드에 맞췄다(NERV Task `CLE-T-EMB0YG`).
- **이 코드를 쓰는 진입점이 넓어졌다.** [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 의 Rationale 「발행 실패를 `queued:false` 하나로 알린다 (C-1·M-7)」 은 처음에 취소가 WebSocket ack 경로가 아니라 REST 중지 진입점이라서 이 코드로 표기한다고 적었다. 이 코드는 이미 `/interact` 의 `cancel` 에서 나갔고 이번 결정으로 재개 명령 4종에도 쓴다. ack 가 아닌 HTTP 진입점이라는 근거는 `/interact` 에도 그대로 맞는다. 그 Rationale 에는 이 코드가 2026-10-09 에 EIA `/interact` 의 재개 명령과 취소로 넓어졌다는 사실(NERV Task `CLE-T-M6PERB`)을 2026-10-17 에 덧붙였다(NERV Task `CLE-T-EMB0YG`). 근거 문장은 바꾸지 않았다. 이 코드가 모든 HTTP 진입점에 쓰이지는 않는다. 채팅 채널 인바운드의 `/cancel` 과 재개 입력에는 `202` 로 응답한다. 채팅 채널에서 이 코드가 나가는 곳은 `/start` 뿐이다.
- **두 503 코드를 §6.7 에 둔 이유(2026-10-17).** `EXECUTION_ENQUEUE_FAILED` 와 `SERVER_SHUTTING_DOWN` 은 WebSocket ack 에 싣지 않는데 «WebSocket 명령» 절에 있다. `EXECUTION_ENQUEUE_FAILED` 는 재개 명령의 발행 결과를 알리는 코드다. 그래서 같은 명령의 다른 실패 코드(`INVALID_EXECUTION_STATE` · `RESUME_*`)와 한곳에서 찾게 했다. `SERVER_SHUTTING_DOWN` 은 이 절 머리말이 설계 원칙으로 가리키는 503 선례라 그 자리에 둔다. 대신 §6 머리말과 §6.7 머리말에 두 코드가 HTTP 진입점 전용이라고 적었다(NERV Task `CLE-T-G0Y6MW`). 기각한 대안은 두 코드를 HTTP 진입점용 새 절로 옮기는 안이다. [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 이 이 코드를 §6.7 의 제목 앵커로 가리키므로 옮기면 그 링크가 끊긴다. 재개 명령의 실패 코드도 두 절로 나뉜다.
- **EIA 에서 이 코드를 받는 범위는 EIA 문서가 정한다(2026-10-17).** 이 카탈로그는 코드의 뜻과 이 코드를 내는 진입점만 적는다. §6.7 행과 §6.9 는 EIA 의 범위를 다시 적지 않고 [EIA 수신 API와 SSE 「명령 에러」](../CLE-IX/CLE-EIA-INBOUND.md#명령-에러) 를 가리킨다. 그 문서의 503 행은 코드의 정의를 이 카탈로그에 맡긴다. 같은 범위를 두 문서에 적으면 한쪽만 고쳤을 때 두 문서가 어긋난다. 그래서 각 문서가 맡는 몫을 나눠 서로를 기준으로 가리키지 않게 했다.

### 관리자 역할 규칙의 거부에 `OWNER_REQUIRED` 를 다시 쓴다 (2026-10-10)

2026-10-10 에 관리자 역할을 주고 빼는 일을 소유자 전용으로 정했다(NERV Task `CLE-T-0W7CA7`, [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#관리자-역할을-주고-빼는-일은-소유자만-한다)). 소유자가 아닌 요청자의 요청은 가드를 통과한 뒤 서비스 계층이 403 `OWNER_REQUIRED` 로 거부한다. 거부 본문은 `workspace-roles.ts` 의 `ADMIN_ROLE_CHANGE_REQUIRES_OWNER` 이고 코드 값은 가드의 소유자 미달 코드(`ROLE_REQUIRED.owner.code`)를 그대로 쓴다. 메시지만 «관리자 역할은 소유자만 주거나 뺄 수 있습니다.» 로 이 동작에 맞췄다.

- **규칙 6 의 새 조건으로 보지 않았다.** 뜻이 "이 동작은 소유자만 한다" 로 가드의 소유자 미달과 같다. 클라이언트가 할 일도 소유자에게 맡기는 것 하나다. 서비스 계층이 가드 코드를 다시 쓰는 선례도 있다. 소유자 이양의 서비스 재검증이 같은 코드를 낸다.
- **초대 모듈의 소문자 관례를 따르지 않았다.** 「예외 등록 근거에 "모듈 안 일관성 보존" 도 들어가는 이유」 는 이미 소문자로 굳은 코드를 지키는 근거다. 새 코드를 소문자로 만들라는 규칙이 아니다(규칙 7). 초대 라우트는 2026-09-25 부터 가드의 대문자 코드(`NOT_A_MEMBER`, `ADMIN_REQUIRED`)를 이미 낸다. 그래서 대문자 `OWNER_REQUIRED` 가 더해져도 그 엔드포인트 응답에 새로운 대소문자 혼재는 생기지 않는다.
- **같은 코드의 메시지는 발행처마다 다르다.** 규칙 4 대로 클라이언트는 메시지가 아니라 코드와 요청한 동작으로 안내를 고른다. 프론트엔드는 소유자 이양 대화 상자에서만 이 코드로 토스트를 가르고 초대와 역할 변경은 서버 메시지를 그대로 보여 준다. 그래서 코드를 다시 써도 안내가 섞이지 않는다.

기각한 대안은 다음과 같다.

- 관리자 역할 변경 전용 코드를 새로 만든다: `OWNER_REQUIRED` 와 뜻이 같은 쌍둥이 코드가 된다.
- 초대 모듈만 소문자 `owner_required` 를 쓴다: 위 둘째 항목의 이유로 기각했다. 같은 거부가 직접 추가·역할 변경과 초대에서 다른 코드가 된다.
- `ADMIN_REQUIRED` 를 쓴다: 요청자는 이미 관리자라 틀린 안내가 된다.
- 기본 코드 `FORBIDDEN` 을 쓴다: 맥락 특화 코드가 있는데 일반 코드로 내리면 클라이언트가 소유자에게 맡기라는 안내를 고를 수 없다.

### 2FA 비활성화 실패에 기존 코드를 쓴다 (2026-10-10)

2026-10-10 에 2FA(TOTP) 비활성화가 비밀번호와 인증 코드를 함께 받게 됐다(NERV Task `CLE-T-75TDTN`). 인증 코드가 틀리면 새 코드 없이 `TOTP_INVALID` 를 쓴다. 확인 순서와 코드 선택의 근거는 [가입과 로그인 「TOTP 끄기」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#totp-끄기) 와 같은 문서의 「TOTP 끄기에 비밀번호와 인증 코드를 함께 받는다」 Rationale 이 정한다.

그 Rationale 에 없는 기각 대안 하나는 여기 남긴다.

- TOTP 복구 코드 불일치에 `RECOVERY_CODE_INVALID` 를 쓴다: 그 코드는 Passkey 복구 코드의 실패 코드다. 비활성화는 입력란 하나로 TOTP 코드와 TOTP 복구 코드를 함께 받으므로 어느 쪽이 틀렸는지 가르지 않는다. 로그인 2FA 도 같다.

### 꺼진 워크플로우의 웹훅에 `WORKFLOW_INACTIVE` 를 새로 만들었다 (2026-10-10)

NERV Task `CLE-T-XRWFMJ` 에서 사람이 정한 결정이다. 웹훅 트리거는 활성인데 그 워크플로우가 비활성이면 `410` 과 `WORKFLOW_INACTIVE` 를 돌려준다. 확인 순서와 경로별 동작은 [트리거 데이터와 흐름 「워크플로우 활성 관문」](../CLE-TRIG/CLE-TRIG-DATA.md#워크플로우-활성-관문) 이 정한다.

- **규칙 6 의 새 조건으로 보고 새 코드를 만들었다(사용자 결정).** 비활성인 것이 트리거가 아니라 워크플로우다.
- **규칙 6 의 단서에 걸리지 않는다.** 관문은 트리거의 워크스페이스 안에서만 워크플로우를 찾는다. 그 워크스페이스에 워크플로우가 없으면 이 코드가 아니라 `TRIGGER_NOT_FOUND`(404)다. 그래서 이 코드로 다른 워크스페이스 워크플로우의 활성 상태가 드러나지 않는다.
- **코드를 명시한다.** `410` 에는 기본 코드가 없다([에러 응답과 클라이언트 처리](CLE-API-ERROR.md)).

기각한 대안: **`TRIGGER_INACTIVE` 를 다시 쓰는 안**. 트리거는 활성이므로 코드의 뜻(트리거가 비활성)과 실제 조건이 어긋난다(규칙 1).

### 로그인 2단계에서 발행하던 미등재 코드 셋을 등재했다 (2026-10-17)

NERV Task `CLE-T-D331TT` 에서 바로잡았다. `WEBAUTHN_COUNTER_REGRESSION` · `CHALLENGE_METHOD_MISMATCH` · `WEBAUTHN_REQUIRED` 는 모두 401 로 발행되고 있었다. 그런데 §6.3 에도 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) 의 에러 코드 표에도 없었다. 규칙 8 위반이다.

- 도메인 문서에 먼저 적고 이 표에 등재했다. 세 이름 모두 조건의 뜻을 적고 있어 규칙 1 에 맞는다.
- `WEBAUTHN_INVALID` 행은 counter 역행도 이 코드에 든다고 적었다. 구현은 counter 역행에 응답 코드 `WEBAUTHN_COUNTER_REGRESSION` 을 돌려준다. 로그인 이력의 사유값과 같은 이름이다. 그래서 행을 구현에 맞췄다. counter 역행이면 서버가 그 credential 을 지우므로 사용자가 할 일이 다르다. 같은 Passkey 로는 다시 로그인할 수 없고 Passkey 를 다시 등록해야 한다. 그래서 별개 조건으로 본다(규칙 6).
- 이 Task 본문은 등재와 구현 변경 두 안을 올렸다. 구현 변경은 counter 역행의 응답 코드를 `WEBAUTHN_INVALID` 로 합치는 안이다. 등재를 골랐다. 구현이 처음부터 이 코드를 내보내므로 이름을 바꾸면 규칙 5 에 어긋난다. 이 응답은 비밀번호 확인을 통과해 챌린지 토큰을 받은 호출자에게만 간다. 그 호출자가 더 알게 되는 것은 방금 쓴 credential 이 역행으로 지워졌다는 사실이다. 이 코드는 처음 쓰는 Passkey 인증 챌린지에 서명이 맞는 응답에만 나간다([가입과 로그인 「역행은 서명 검증을 통과한 응답에서만 판정한다」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#역행은-서명-검증을-통과한-응답에서만-판정한다-2026-10-30)). 그래서 이 사실을 알게 되는 쪽은 인증기를 가진 사람이나 인증기를 복제한 사람뿐이다. 복제한 쪽은 들켰다는 것을 알게 되지만 그 credential 은 이미 지워져 더 쓸 수 없다. 이 노출은 받아들이고 코드를 그대로 둔다(NERV Task `CLE-T-693G4E`).
- Passkey 의 나머지 미등재 코드(`WEBAUTHN_CREDENTIAL_EXISTS` · `WEBAUTHN_CREDENTIAL_NOT_FOUND` · `WEBAUTHN_NOT_REGISTERED`)는 이번에 넣지 않았다. NERV Task `CLE-T-9KCQ7Y` 가 등록 저장의 원자성과 함께 다룬다. 그때까지 「미결 사항」 에 올려 둔다.
- §6.3 끝 불릿의 "사유값은 응답 코드가 아니다" 를 "별개 층이다" 로 고쳤다. `TOTP_INVALID` 처럼 사유값과 응답 코드의 이름이 같은 경우가 전부터 있어서 옛 문장은 맞지 않았다. 이름은 바꾸지 않았다(규칙 5).
- §5 `INVALID_PASSWORD` 행은 새 코드 `PASSWORD_NOT_SET` 을 만들지 않은 이유로 감사 사유값과의 이름 충돌을 들었다. 이번 등재와 어긋나 보이지만 두 판단은 대상이 다르다. 그 행은 새 이름을 만들지 말지를 정했고 이번 등재는 이미 발행 중인 `WEBAUTHN_COUNTER_REGRESSION` 을 다뤘다. 발행 중인 이름은 사유값과 같아도 규칙 5 로 바꾸지 않는다. 사유값과 겹치는 이름을 피할지는 규칙 1~10 에 없고 새 코드를 만들 때마다 따진다. 2026-09-02 결정은 바뀌지 않았다.
- §6.3 끝의 「비슷한 이름 주의」 불릿에 `WEBAUTHN_REQUIRED` 를 더했다. 접미사가 `PASSWORD_REQUIRED` · `REAUTH_REQUIRED` 와 같지만 뜻이 다르다.
- 비밀번호 재설정 실패의 두 원인이 같은 코드인 문제를 「미결 사항」 에 올렸다. 코드를 나눌지는 NERV Task `CLE-T-DTVTM9` 가 정한다.
- `LOGIN_FAILED` 행에는 어떤 경우를 이 코드로 거부하는지 적지 않았다. 그 목록은 정의 문서인 [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-코드) 한 곳에 둔다(규칙 8). 이메일 인증 전 계정의 로그인 응답은 처음에 정해지지 않았다. 그 뒤 사람 결정이 나서 아래 「로그인 결정 셋을 카탈로그에 옮겼다」 에 적었다.

### 로그인 결정 셋을 카탈로그에 옮겼다 (2026-10-17)

NERV Task `CLE-T-D331TT` 에서 사람이 정한 로그인 결정 셋을 이 카탈로그에 옮겼다. 결정과 이유의 정본은 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) Rationale 이다. 처음에는 셋 다 구현되지 않았다. Passkey 인증 챌린지는 2026-10-30 에 구현됐다(아래 「구현 반영 (2026-10-30, NERV Task `CLE-T-GK9J2B`)」). 나머지 둘(`EMAIL_VERIFICATION_REQUIRED`, 로그인의 `WEBAUTHN_DISABLED`)은 NERV Task `CLE-T-AYT4VB` · `CLE-T-RFSJXQ` 가 구현했다.

- **이메일 인증 전 계정**: 비밀번호가 맞을 때만 새 코드 `EMAIL_VERIFICATION_REQUIRED`(401)로 알린다. 처음에는 발행하지 않아 §6.2 표 아래 문장에 적었고 구현과 함께 표에 등재했다(규칙 9). 사용자가 할 일이 자격 증명 확인과 달라 규칙 6 의 새 조건이다. 규칙 6 단서(다른 워크스페이스의 리소스가 드러나는 조건)에는 해당하지 않는다. 이 응답은 비밀번호가 맞을 때만 나서 비밀번호를 모르는 사람에게 계정 상태를 드러내지도 않는다. 클라이언트는 이 코드로 안내 문구를 고른다(규칙 4). 이름은 감사 사유값 `EMAIL_NOT_VERIFIED` 와 겹치지 않게 골랐다. 처음 초안은 `LOGIN_FAILED` 에 메시지만 다르게 두었다. 그러면 규칙 4 · 6 과 어긋나 사람이 다시 정했다. `LOGIN_FAILED` 행의 「잘못된 자격 증명」 은 그대로 맞다([가입과 로그인 「이메일 인증 전 계정은 비밀번호가 맞을 때만 알린다」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#이메일-인증-전-계정은-비밀번호가-맞을-때만-알린다-2026-10-17)).
- **Passkey 기능이 꺼졌을 때의 로그인**: Passkey 만 등록하고 TOTP 가 꺼진 계정의 로그인도 `WEBAUTHN_DISABLED`(503)를 받는다. 그래서 그 행에 로그인을 더하고 `WEBAUTHN_REQUIRED` 행의 이유를 고쳤다. 기능이 꺼지면 credential 을 0개로 본다는 이유는 이 결정으로 맞지 않게 됐다([가입과 로그인 「Passkey 기능이 꺼지면 Passkey 만 등록한 계정의 로그인을 막는다」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#passkey-기능이-꺼지면-passkey-만-등록한-계정의-로그인을-막는다-2026-10-17)).
- **Passkey 인증 챌린지**: 이미 쓴 챌린지와 서명이 틀린 응답은 `WEBAUTHN_INVALID` 이고 credential 을 지우지 않는다. `WEBAUTHN_COUNTER_REGRESSION` 은 처음 쓰는 챌린지에서 서명이 맞는 응답에만 난다. 새 코드는 만들지 않았다. 두 경우 모두 사용자가 할 일은 Passkey 로 다시 시도하는 것이라 `WEBAUTHN_INVALID` 의 뜻에 든다([가입과 로그인 「Passkey 인증 챌린지는 한 번만 쓴다」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#passkey-인증-챌린지는-한-번만-쓴다-2026-10-17)). 2026-10-30 에 NERV Task `CLE-T-GK9J2B` 가 구현했다.

### 트리거 단위 토큰 경로의 부재는 401 `EXECUTION_NOT_FOUND` 로 적는다 (2026-10-17)

[EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) 는 트리거 단위 토큰(`itk_*`)으로 보낸 요청과 연 스트림에서 실행이 없거나 그 실행의 트리거가 지워졌으면 `EXECUTION_NOT_FOUND` 를 401 로 돌려준다고 적는다(「명령 에러」, 「스트림 연결 오류」). 가드가 핸들러 전에 이 판정을 한다. 이 카탈로그는 이 코드를 404 로만 적어 두 문서의 상태가 갈렸다. 2026-10-17 스펙 일관성 검토에서 드러난 어긋남이다. 그래서 §6.9 에 401 행을 더했다.

- **규칙 6 의 새 조건으로 보지 않았다.** 정의 문서는 이 401 도 부재(실행이 없거나 트리거가 지워짐)를 뜻한다고 적는다. 뜻은 404 와 같고 상태만 다르다. 워크스페이스 · 범위 경계 위반은 먼저 `TOKEN_SCOPE_MISMATCH`(401)가 되므로 이 코드에 들지 않는다.
- **위 「모델 설정 코드 분리」 선례와 다르다.** 그 선례에서는 같은 코드가 두 상태를 가져 코드를 나눴다. 두 상태가 서로 다른 뜻(지정한 설정 없음, 기본값 미설정)을 담았기 때문이다. 이번에는 뜻이 하나다. 두 상태는 판정하는 자리만 다르다. 트리거 단위 토큰 경로에서는 핸들러가 아니라 가드가 부재를 판정한다.
- **`WORKSPACE_NOT_FOUND` 의 두 상태와도 다르다.** 그 코드의 404 와 401 은 뜻이 달라 「미결 사항」 에 올렸다(2026-11-12 에 401 을 새 코드로 나누기로 정했다). 이 코드의 두 상태는 뜻이 같아 미결로 올리지 않았다.
- **상태를 하나로 맞출지는 정의 문서가 정한다.** 카탈로그는 정의 문서를 따른다(규칙 8). 그래서 정의 문서의 401 을 그대로 적었다.

### LLM 타임아웃에 `LLM_TIMEOUT` 을 쓰지 않는다 (2026-10-10)

`LLM_TIMEOUT` 은 enum 에 있지만 발행처가 없었다. [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md) 만 스트리밍 턴 타임아웃에 이 코드를 약속했다. 2026-10-10 에 사람이 LLM 호출 타임아웃 문서를 코드에 맞추기로 정하면서 이 코드도 내지 않기로 했다. LLM 타임아웃은 지금처럼 `LLM_CALL_FAILED` 나 스트림 에러 코드로 온다. 그때 단일 턴 AI 에이전트는 코드 없이 실패했다(구현 공백). 그 뒤의 변화는 아래 「구현 반영 (2026-11-01, NERV Task `CLE-T-ZHBMAC`)」 에 적었다. 결정 근거는 [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md) 의 Rationale 에 있다. enum 과 등재를 지울지는 규칙 9 정리와 함께 NERV Task `CLE-T-8WXV7T` 가 정한다.

### 구현 반영 (2026-10-30, NERV Task `CLE-T-PS7JQY`)

통합 행을 만드는 트랜잭션의 첫 잠금이 `NOT_A_MEMBER` 를 내게 되어 §6.2 행의 발행처에 더하고 구현과 함께 더한다던 표 아래 문단을 지웠다. 워크스페이스가 그 사이 지워진 경우도 구현이 같은 코드로 거절하므로 행에 함께 적었다.

### 구현 반영 (2026-10-30, NERV Task `CLE-T-GK9J2B`)

- 이미 쓴 Passkey 인증 챌린지를 거부하는 동작이 구현되어 §6.3 `WEBAUTHN_INVALID` · `WEBAUTHN_COUNTER_REGRESSION` 행의 미구현 표시를 걷었다.
- 로그인 2단계 Passkey 인증 검증은 Passkey 인증 챌린지를 기록하지 못하면 503 `SERVICE_UNAVAILABLE` 로 거부한다. 이 코드의 첫 발행처라 §6.1 행에 적고 「미결 사항」 의 발행처가 없는 등재 코드에서 뺐다.
- 상태 코드는 503 이다. [HTTP API 규약](CLE-API-CONV.md) 규칙 11 이 503 을 우리 인프라 의존성의 일시 장애에 쓴다고 정했고 Redis 는 우리 인프라다. 그래서 `WEBAUTHN_DISABLED` 처럼 규칙 11 의 예외로 적을 필요가 없다.
- 새 코드를 만들지 않았다. 카탈로그에 같은 뜻의 `SERVICE_UNAVAILABLE` 이 이미 있어 규칙 6 의 새 조건이 아니다.
- 저장소 장애를 `WEBAUTHN_INVALID` 로 합치지 않았다. 인증 실패와 인프라 장애는 뜻이 갈린다. 합치면 클라이언트가 다시 시도할지 판단할 수 없다(규칙 6).

### 구현 반영 (2026-10-31, NERV Task `CLE-T-KQ37NJ`)

NERV Task `CLE-T-2V7SBC`(PR #1521, main 커밋 `6cbf22acb`)가 웹훅 인증에서 인증 설정의 빈 기대값을 거부하게 했다. 그 동작을 §6.10 `AUTH_FAILED` 행의 조건에 적었다. 전에는 `basic_auth` 의 사용자 이름 · 비밀번호나 `hmac` 의 secret 이 비어 있으면 빈 값끼리 비교해 요청이 통과했다. `bearer_token` · `api_key` 는 그 전부터 빈 기대값을 거부했다. 복호화 불가 표식이 담긴 인증 설정은 기대값을 읽지 못해 네 유형 모두 같은 401 로 거부한다.

새 코드를 만들지 않은 이유와 예외의 범위는 [웹훅 인증 설정의 기대값이 비었거나 읽지 못해도 `AUTH_FAILED` 를 쓴다](#웹훅-인증-설정의-기대값이-비었거나-읽지-못해도-auth_failed-를-쓴다-2026-10-31) 에 있다.

### 웹훅 인증 설정의 기대값이 비었거나 읽지 못해도 `AUTH_FAILED` 를 쓴다 (2026-10-31)

NERV Task `CLE-T-KQ37NJ` 에서 정했다. 처음에는 「구현 반영 (2026-10-31, NERV Task `CLE-T-KQ37NJ`)」 절의 한 불릿에 적었고 2026-11-01 에 NERV Task `CLE-T-YKA9CJ` 가 이 제목으로 옮겨 나눴다. 결정의 내용은 바꾸지 않았다.

- **결정: 새 코드를 만들지 않는다(규칙 6 의 예외).** 웹훅 인증에서 인증 설정의 기대값이 비었거나 읽지 못하는 경우는 §6.10 `AUTH_FAILED` 로 거부한다.
- **근거: 한 응답 정책에 든다.** 이 경우는 §6.10 `AUTH_FAILED` 행의 한 응답 정책(열거 공격 · 정보 노출 차단)에 든다. 웹훅 호출자는 아직 인증을 통과하지 않은 상대라 서버 쪽 인증 설정의 상태를 가려서 알리지 않는다. 그래서 이 경우도 `is_active=false` 인증 설정이나 서명 · 토큰 불일치와 같은 `AUTH_FAILED` 한 응답으로 둔다.
- **선례**: 서버 쪽 데이터 문제를 `AUTH_FAILED` 로 감춘 선례는 §6.10 `AUTH_FAILED` 행에 먼저 있다. 트리거가 저장 경계 이전에 남은 교차 행이라 인증 설정을 트리거의 워크스페이스에서 찾지 못하는 경우다([데이터 모델 개요 「저장된 교차 행 점검」](../CLE-PLAT/CLE-PLAT-DATA.md#저장된-교차-행-점검)). 웹훅 수신에서 호출자에게 서버 쪽 사정을 감추는 선례는 [`TRIGGER_NOT_FOUND` 를 다른 워크스페이스의 워크플로우에도 쓰는 이유](#trigger_not_found-를-다른-워크스페이스의-워크플로우에도-쓰는-이유-2026-10-05) 에도 있다.
- **규칙 6 의 단서에 들지 않아 예외로 둔다.** 규칙 6 은 새 조건에 새 코드를 만들게 한다. 그 단서는 리소스가 다른 워크스페이스에 있다는 것이 드러나는 조건만 묶는다. 이 경우는 그 단서에 들지 않는다.
- **예외의 범위**: 웹훅 인증에서 인증 설정의 기대값이 비었거나 읽지 못하는 경우뿐이다. 다른 조건이나 다른 표면으로 넓히지 않는다. 2026-11-05 에 기대값이나 헤더 이름이 문자열이 아닌 경우를 이 범위에 더했다([웹훅 인증의 `AUTH_FAILED` 예외에 문자열이 아닌 기대값과 헤더 이름을 더했다](#웹훅-인증의-auth_failed-예외에-문자열이-아닌-기대값과-헤더-이름을-더했다-2026-11-05)).
- **§3 예외 등록부에 올리지 않는다.** 이 예외는 이름을 정하는 결정이 아니라 기존 코드를 다시 쓰는 결정이다. §3 은 이름 규칙(규칙 1~3)을 따르지 않는 기존 코드를 적는 등록부다(규칙 7 · §3 첫 문단). `AUTH_FAILED` 는 이름 규칙을 따른다.
- **`WEBAUTHN_INVALID` 선례와 경우가 다르다.** 「구현 반영 (2026-10-30, NERV Task `CLE-T-GK9J2B`)」 은 다시 시도하면 풀리는 Redis 장애를 인증 실패와 갈랐지만 이번 경우는 사람이 인증 설정을 바로잡기 전에는 다시 보내도 풀리지 않아 호출자가 재시도를 판단할 일이 없다.

### 구현 반영 (2026-11-01, NERV Task `CLE-T-ZHBMAC`)

- 단일 턴 AI 에이전트의 LLM 호출(첫 호출과 도구 루프 호출)이 실패하면 노드는 멀티턴과 같은 분류의 에러를 `error` 포트로 낸다. 타임아웃은 재시도할 수 있는 `LLM_CALL_FAILED` 다. 2026-10-10 결정대로 `LLM_TIMEOUT` 은 내지 않는다.
- 「LLM 타임아웃에 `LLM_TIMEOUT` 을 쓰지 않는다 (2026-10-10)」 에 적은 단일 턴의 구현 공백은 이 구현으로 없어졌다.
- 단일 턴의 롤링 요약 호출(`summary_buffer` · `persistent` 메모리 전략의 요약 호출)은 LLM 호출 실패를 `error` 포트로 내는 처리 밖에 있다. 이 호출이 실패하거나 요약 모델 설정(`summaryModelConfigId`)을 해석하지 못하면 아직 에러 코드 없이 노드가 실패한다(후속 NERV Task `CLE-T-Q38K9F`).
- §6.6 `LLM_TIMEOUT` 불릿에는 「경로에 따라서는」 대신 이 경로의 이름을 적었다. 경로별 결과의 링크는 [AI 노드 공통 「LLM 호출 경로별 타임아웃」](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md#llm-호출-경로별-타임아웃) 으로 바꿨다.

### 규칙 7 의 「규칙」 을 이름 규칙으로 좁혔다 (2026-11-01)

NERV Task `CLE-T-H9QJTA` 에서 고쳤다. 규칙 7 은 「규칙을 따르지 않지만 유지하는 기존 코드」 를 §3 에 적게 했다. 그런데 개요 · 규칙 2 · §3 첫 문단은 §3 을 이름 규칙을 따르지 않는 코드의 등록부로 적는다. 규칙 7 만 넓게 읽혀서 규칙 6 의 예외를 §3 에 올릴지 판단할 근거가 둘로 갈렸다. 그래서 규칙 7 을 이름 규칙(규칙 1~3)으로 좁히고 개요 · 규칙 7 · §3 첫 문단을 같은 말로 맞췄다. 기존 코드를 다시 쓰는 결정은 이름을 정하는 결정이 아니어서 §3 에 올리지 않는다는 것도 §3 첫 문단에 적었다. 등록부의 코드와 다른 결정은 바꾸지 않았다.

- 「웹훅 인증 설정의 기대값이 비었거나 읽지 못해도 `AUTH_FAILED` 를 쓴다 (2026-10-31)」 첫 문단에 있던 「규칙 7 의 「규칙」 은 명명 규칙만 가리키지 않는다」 는 문장을 지웠다. NERV Task `CLE-T-YKA9CJ` 에서 그 항목을 옮기며 더한 문장인데 규칙 7 을 좁히면서 맞지 않게 됐다.
- §1 「도메인 prefix (규칙 3)」 의 「원칙의 예외가 아니다」 를 규칙 3 과 §3 을 직접 가리키는 문장으로 고쳤다. §3 첫 문단이 「§1 원칙」 대신 「이름 규칙(규칙 1~3)」 을 쓰게 되면서 「원칙」 이 무엇을 가리키는지 흐려졌기 때문이다. prefix 없는 공용 코드는 규칙 3 을 따른 것이라 §3 에 올리지 않는다.
- 「구현 반영 (2026-10-30, NERV Task `CLE-T-GK9J2B`)」 셋째 불릿의 「예외로 등록할 필요가 없다」 를 「규칙 11 의 예외로 적을 필요가 없다」 로 고쳤다. 그 예외는 [HTTP API 규약](CLE-API-CONV.md) 규칙 11 의 예외이고 §3 등록과 다르다.
- 기각한 대안은 규칙 7 을 넓게 두고 개요 · 규칙 2 · §3 첫 문단을 그 범위로 넓히는 안이다. 그러면 기존 코드를 다시 쓰는 결정도 §3 에 올려야 해서 이름이 부정확한 코드를 찾는 표에 이름이 정확한 코드(`AUTH_FAILED` 등)가 섞인다.

### Passkey 등록 옵션의 비밀번호 재확인과 TOTP 대기 secret 만료에 기존 코드를 쓴다 (2026-11-02)

NERV Task `CLE-T-FRCRF7` 에서 사람이 정한 결정 세 건 가운데 코드 선택에 걸리는 둘을 §6.3 에 옮겼다. 동작과 근거의 정본은 [가입과 로그인 「Passkey 등록에도 비밀번호 재확인을 두고 TOTP 대기 secret 은 10분 뒤 버린다 (2026-11-02)」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#passkey-등록에도-비밀번호-재확인을-두고-totp-대기-secret-은-10분-뒤-버린다-2026-11-02) 다. 나머지 한 건은 비밀번호 재확인 라우트의 요청 빈도 제한이다. 한도를 넘으면 기존 `RATE_LIMITED`(429)를 쓰고 한도 수치는 [HTTP API 규약 「7. 요청 빈도 제한」](CLE-API-CONV.md#7-요청-빈도-제한) 이 정한다.

- **Passkey 등록 옵션**: 옵션을 만들기 전에 TOTP 설정 시작과 같은 `verifyPasswordForUser` 로 비밀번호를 다시 확인한다. 그래서 `PASSWORD_INVALID` · `PASSWORD_REQUIRED` 행의 발행처에 더했다. 새 코드는 만들지 않았다. 다른 민감 동작의 재확인과 뜻이 같고 클라이언트가 할 일도 같다. Passkey 기능이 꺼져 있으면 비밀번호를 확인하기 전에 `WEBAUTHN_DISABLED`(503)로 거부한다. Passkey 복구 코드 재발급도 같다.
- **TOTP 대기 secret 만료**: 설정 시작 뒤 10분이 지난 대기 secret 으로 활성화 검증을 부르면 서버가 그 secret 을 비우고 `TOTP_NOT_INITIALIZED`(400)로 거부한다. 응답 코드도 사람이 고른 안에 있었다. NERV 질문 `01a199f3-42c1-721b-a0d6-dc853234191a` 의 A안에 「400 `TOTP_NOT_INITIALIZED`(기존 코드)」 가 적혀 있다.
- **상태 코드는 기존 400 을 따른다.** 만료 조건을 더해도 이 코드의 기존 응답은 바꾸지 않는다. 상태 코드를 바꾸면 API 계약이 바뀐다. 이름 바꾸기를 막는 규칙 5 와 같은 이유다.
- **규칙 6 의 새 조건으로 보지 않았다.** 서버가 만료된 secret 을 비운 뒤의 상태는 설정을 시작하지 않은 상태와 같다. 사용자가 할 일도 설정 시작부터 다시 하는 것 하나다. 클라이언트는 설정 시작을 거친 뒤에만 활성화 검증을 부르므로 이 코드를 받으면 만료 안내를 보인다.

### 인증 설정 재생성 거부에 `AUTH_CONFIG_REGENERATE_UNSUPPORTED` 를 새로 만들었다 (2026-11-05)

NERV Task `CLE-T-SCDNDC` 에서 정했다. Basic Auth 인증 설정에 재생성을 요청하면 400 `AUTH_CONFIG_REGENERATE_UNSUPPORTED` 로 거부한다(§6.20). 전에는 발급할 값이 없는데도 요청이 성공했고 저장된 비밀번호를 평문으로 응답했다. 동작과 근거의 정본은 [외부 호출 인증 설정 「Basic Auth 재생성을 거부한다」](../CLE-TRIG/CLE-TRIG-AUTHCFG.md#basic-auth-재생성을-거부한다-2026-11-05) 다.

- **새 조건이라 새 코드를 만든다(규칙 6).** 이 API 에 전에 없던 거부 조건이다.
- **`VALIDATION_ERROR` 를 쓰지 않는다.** 재생성 요청에는 본문이 없어 `details` 로 가리킬 필드가 없다. 요청 형식이 틀린 것이 아니라 대상 설정의 유형이 이 동작을 지원하지 않는 것이다.
- **409 나 `INVALID_STATE`(422)를 쓰지 않는다.** 유형은 바꿀 수 없는 값이라 기다리거나 상태를 바꿔도 풀리지 않는다. 같은 요청을 다시 보내도 결과가 같은 클라이언트 오류라 400 이다.
- **이름은 `<DOMAIN>_<CONDITION>` 이다(규칙 1 · 3).** 도메인은 인증 설정(`AUTH_CONFIG`)이고 조건은 재생성을 지원하지 않는다는 것이다. 유형 이름을 넣지 않은 것은 재생성할 수 없는 유형이 늘어도 같은 뜻이기 때문이다.
- **`AUTH_CONFIG_*` 접두는 도메인 이름이다.** 트리거 API 의 `AUTH_CONFIG_NOT_FOUND`(§6.14)와 인증 설정 API 의 이 코드는 표면이 달라도 같은 접두를 쓴다. 접두는 코드가 나오는 표면이 아니라 조건이 속한 도메인을 가리킨다.

### 웹훅 인증의 `AUTH_FAILED` 예외에 문자열이 아닌 기대값과 헤더 이름을 더했다 (2026-11-05)

NERV Task `CLE-T-0Q768N` 에서 정했다. 웹훅 인증에서 인증 설정의 기대값이 문자열이 아니거나 헤더 이름(`headerName` · `header`)이 문자열이 아니면 §6.10 `AUTH_FAILED` 로 거부한다. 전에는 비교 도중 오류가 나 500 이 나갔다. 동작의 정본은 [웹훅 「문자열이 아닌 기대값과 헤더 이름도 401 로 거부한다」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#문자열이-아닌-기대값과-헤더-이름도-401-로-거부한다-2026-11-05) 다.

- **2026-10-31 예외의 범위를 넓혔다.** [웹훅 인증 설정의 기대값이 비었거나 읽지 못해도 `AUTH_FAILED` 를 쓴다](#웹훅-인증-설정의-기대값이-비었거나-읽지-못해도-auth_failed-를-쓴다-2026-10-31) 는 예외를 빈 기대값과 읽지 못하는 설정으로 한정하고 넓히지 않는다고 적었다. 이번 결정으로 그 범위에 두 경우를 더했다. 그 절의 범위 불릿에도 적었다.
- **같은 응답 정책에 든다.** 문자열이 아닌 기대값으로는 어떤 요청도 인증될 수 없어 빈 기대값과 결과가 같다. 문자열이 아닌 헤더 이름은 비교할 헤더를 정할 수 없게 한다. 둘 다 서버 쪽 인증 설정의 상태이고 아직 인증을 통과하지 않은 호출자에게 가려서 알리지 않는다는 2026-10-31 결정의 근거가 그대로 적용된다.
- **기각한 대안**: 500 을 그대로 두는 안과 새 코드(예: 인증 설정이 잘못됐다는 코드)를 만드는 안이다. 둘 다 서버 쪽 설정이 잘못됐다는 것을 외부 호출자에게 드러내고 인증 실패를 한 응답으로 돌려주는 §6.10 의 정책과 맞지 않는다.
- **§3 예외 등록부에 올리지 않는다.** 2026-10-31 결정과 같은 이유다. 기존 코드를 다시 쓰는 결정이고 `AUTH_FAILED` 는 이름 규칙을 따른다.

### 규칙 9 에 정했지만 아직 발행하지 않은 코드의 자리를 적었다 (2026-11-05)

NERV Task `CLE-T-693G4E` 에서 정리했다. 규칙 9 는 발행한 적 없는 코드를 등재하지 않는다고만 적었다. 그런데 사람이 정했고 아직 구현하지 않은 코드를 표 아래 문장으로 적는 관행이 두 곳에 있었다. §6.2 의 `EMAIL_VERIFICATION_REQUIRED` 와 §6.17 의 LLM 세분화 코드다. 이 관행을 규칙 9 의 단서로 올렸다.

- **표에 미리 넣지 않는다.** 표는 지금 응답에 나가는 코드의 목록이다. 정한 코드를 미리 넣으면 클라이언트가 아직 오지 않는 코드로 분기를 만든다. 규칙 9 가 막는 기록 실수와 결과가 같다.
- **문장으로는 남긴다.** 결정을 적지 않으면 같은 조건에 다른 코드를 또 정할 수 있다. 상태 코드와 조건을 적어 두면 구현하는 쪽이 그대로 옮긴다.
- **영역 문서는 미구현 표시로 먼저 적을 수 있다.** 영역 문서의 에러 표는 그 영역의 동작을 정하는 곳이라 정한 코드를 미구현 표시와 함께 둔다. [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) 이 두 로그인 코드를 이렇게 적었다.

같은 Task 에서 로그인 코드 둘의 구현을 반영했다.

- **`EMAIL_VERIFICATION_REQUIRED` 를 §6.2 표에 등재했다.** NERV Task `CLE-T-AYT4VB` 가 로그인에서 이 코드를 내기 시작했다. 표 아래 문장은 지웠다.
- **로그인의 `WEBAUTHN_DISABLED` 에서 미구현 문장을 지웠다.** NERV Task `CLE-T-RFSJXQ` 가 구현했다.
- **`WEBAUTHN_DISABLED` 행에 credential 목록 조회 예외를 더했다.** 기능이 꺼져도 목록 조회는 200 빈 목록이다. 2026-10-17 에 사람이 구현을 유지하고 스펙을 고치기로 정했다([가입과 로그인 「Passkey 기능이 꺼져도 credential 목록 조회는 빈 목록을 준다」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#passkey-기능이-꺼져도-credential-목록-조회는-빈-목록을-준다-2026-11-05)).
- **머리 줄을 「부분 구현」 으로 바꿨다.** 본문에 남은 미구현은 §6.17 의 LLM 세분화 코드 셋이다.

### 구현 반영 (2026-11-05, NERV Task `CLE-T-Q38K9F`)

- 단일 턴 AI 에이전트의 롤링 요약 호출(`summary_buffer` · `persistent` 메모리 전략의 요약 호출)이 실패하거나 요약 모델 설정(`summaryModelConfigId`)을 해석하지 못하면 노드는 첫 호출 · 도구 루프 호출과 같은 분류의 에러를 `error` 포트로 낸다. 롤링 요약 `chat` 실패는 첫 호출과 같은 HTTP status 기준으로 나뉜다. 요약 모델 설정을 찾지 못한 실패는 429 · 5xx · 네트워크 신호가 없어 재시도할 수 없는 `LLM_CALL_FAILED` 로 나온다. 멀티턴 재개와 같은 분류다.
- 「구현 반영 (2026-11-01, NERV Task `CLE-T-ZHBMAC`)」 에 적은 롤링 요약 공백은 이 구현으로 없어졌다. 남은 공백은 노드 LLM 설정(`llmConfigId`)을 해석하지 못하는 경우이고 이때는 아직 에러 코드 없이 노드가 실패한다.
- §6.6 `LLM_TIMEOUT` 불릿의 롤링 요약 문장을 이 구현에 맞게 고쳤다.

### 통합 · MCP · Background Runs 코드를 도메인 참조 절 6.21~6.24 로 등재했다 (2026-11-05)

NERV Task `CLE-T-5BZ3M2` 다. 통합 관리 · OAuth, 통합 노드, MCP 클라이언트, Background Runs REST 가 내는 코드는 도메인 문서에만 있고 이 카탈로그에 행이 없었다(규칙 8). 2026-11-05 에 사람이 구조와 이름을 정했다.

- **§6.1~6.20 은 그대로 두고 §6.21~6.24 를 더했다.** 6.21 과 6.22 를 한 절로 합치는 안, §6 번호를 다시 매기는 안, 도구 결과 코드와 콜백 코드의 등재를 미루는 안은 기각했다. 세 안은 사람에게 올린 질문에서 고르지 않은 선택지였다. 번호를 다시 매기면 절 앵커와 링크가 깨진다. 코드 주석도 절 제목을 인용한다. 6.21 의 코드는 REST 응답 · 설치 진입점 응답 · 콜백 기록으로 나가고 6.22 의 코드는 노드 출력 · 연결 테스트 결과 · 도구 결과로 나간다. 나가는 곳이 달라 절을 나눴다. 도구 결과 코드와 콜백 코드는 이미 발행 중이라 등재를 미루면 규칙 8 위반이 그대로 남는다.
- **이름은 모두 유지하고 이름이 부정확한 코드를 §3 에 올렸다.** `MCP_HTTPS_REQUIRED` 를 지금 나누는 안, `CAFE24_PRIVATE_APP_INSTALL_PENDING` · `MAKESHOP_INSTALL_PENDING` 의 이름을 지금 바꾸는 안, 상태 번호 코드를 §3 에서 빼는 안은 기각했다. 세 안도 질문에서 고르지 않은 선택지였다. 이름 바꾸기는 규칙 5 에 따라 호환을 깨는 변경이다. 상태 번호 코드를 §3 에서 빼면 규칙 1 에 맞지 않는 이름이 예외 표시 없이 남는다. 그러면 새 코드가 그 이름을 선례로 삼을 수 있다. `MCP_HTTPS_REQUIRED` 를 나누는 일은 코드 변경이라 NERV Task `CLE-T-DDN3MS` 가 맡는다.
- 「카탈로그에 아직 없는 통합 도메인 코드」 미결은 이 등재로 닫혀 지웠다.

### 반복 · 병렬 실패 회차의 대체 코드 `UNKNOWN_ERROR` 를 새로 만들었다 (2026-11-05)

ForEach · Map · Parallel 은 `errorPolicy='continue'` 에서 실패한 회차 · 병렬 분기를 `skipped[].error.code`(Map 은 `mapped[i].error.code`)에 담는다. 그전에는 던진 에러의 `name`(`Error` · `TypeError` 등)을 그대로 실어 규칙 2 와 맞지 않았다. Error 가 아닌 값에 쓰던 `UNKNOWN_ERROR` 는 카탈로그에 없었다(규칙 8). NERV Task `CLE-T-REC4X3` 이 세 노드의 규칙을 하나로 모았다. 정의는 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#반복-결과-출력-구조) 4 · 5번이다.

- 백엔드가 직접 싣는 카탈로그 코드는 그대로 내고 `name` 이 `AbortError` 면 §3 의 `AbortError` 를 낸다. 그 밖은 `UNKNOWN_ERROR` 로 모으고 §6.6 에 등재했다.
- 대체값에 옛 코드 `NODE_EXECUTION_FAILED` 를 다시 쓰지 않았다. §6.6 이 노드 출력에 더 이상 쓰지 않는다고 적은 이름이라 다시 쓰면 그 결정과 어긋난다.
- 이름에 도메인 접두를 붙이지 않았다. 세 노드가 함께 쓰는 대체값이라 한 도메인의 조건이 아니다(규칙 3). Parallel 이 Error 가 아닌 값에 이미 내던 문자열이어서 그대로 썼다.
- 클라이언트 대화 화면 코드(`conversation-utils.ts`)가 코드가 없는 에러에 같은 문자열을 화면 대체값으로 쓴다. 서버가 내는 값이 아니어서 이 행과 겹치지 않는다.
- 허용 목록 76개를 카탈로그와 대조했다(2026-11-05). 그러다가 §6.6 표에 없던 에러 포트 코드 둘을 찾아 더했다. `INVALID_PARAMETERS`([Database Query 노드](../CLE-NODE-INT/CLE-NODE-DBQUERY.md))와 `TOOL_DEFINITION_PAYLOAD_EXCEEDED`([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md))는 이미 에러 포트로 나가고 있었다(규칙 8). 남은 `USER_CANCELLED` 는 `ErrorCode` 에 정의만 있고 내보내는 곳이 없어 표에 올리지 않았다. 목록과 카탈로그를 대조하는 테스트는 두지 않았다. 새 코드는 규칙 8 에 따라 등재한다.
- 기각한 대안은 두 가지다. 하나는 `UPPER_SNAKE_CASE` 모양이면 그대로 내는 안이다. 런타임 · 드라이버의 `code`(`ECONNREFUSED` 등)가 카탈로그 밖 값으로 나간다. 다른 하나는 런타임 · 드라이버 모양을 걸러 내는 안이다. 휴리스틱이라 다른 드라이버의 값이 새어 나갈 수 있다. 자세한 근거는 [Logic 노드 공통 「실패한 회차와 병렬 분기의 `error.code`」](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#실패한-회차와-병렬-분기의-errorcode-2026-11-05) 에 있다.

### 설치 엔드포인트의 예상 밖 예외를 500 으로 가리고 `requestId` 를 싣는다 (2026-11-06)

NERV Task `CLE-T-909H23` 이다. 설치 엔드포인트는 `@Res` 로 응답을 직접 써서 전역 예외 필터를 거치지 않는다. 그래서 코드가 없는 예외를 400 `*_INSTALL_FAILED` 로 바꾸면서 예외 메시지를 그대로 실었다. DB · 런타임 오류의 원문이 Cafe24 · MakeShop 콘솔에서 연 브라우저에 보였다([에러 응답과 클라이언트 처리](CLE-API-ERROR.md) 규칙 2). 실패 본문에 `requestId` 가 없어 서버 로그와 이을 수도 없었다(같은 문서 규칙 3).

- **코드 이름은 그대로 쓰고 상태와 문구만 바꿨다.** 코드가 없는 실패라는 뜻은 바뀌지 않는다. `INTERNAL_ERROR` 로 바꾸는 안은 기각했다. 이름 바꾸기는 호환을 깨는 변경이다(규칙 5).
- **상태는 예외 종류로 가른다.** 코드가 없는 `HttpException` 의 상태와 문구는 작성자가 정한 값이라 전역 필터처럼 그대로 싣는다. 그 밖의 예외는 500 과 고정 문구로 가리고 원문은 `requestId` 와 함께 `logger.error` 로만 남긴다.
- **예외를 전역 필터로 다시 던지는 안은 기각했다.** 필터는 JSON 만 그려서 콘솔에서 연 브라우저에 HTML 안내 페이지를 보일 수 없다. 열거 공격 실패 카운트도 컨트롤러가 해야 한다.
- **앞단 가드(빈도 제한 · 토큰 형식 · 필수 query)의 JSON 에도 `requestId` 를 싣는다.** 한 엔드포인트의 실패 본문을 한 모양으로 맞췄다. §6.21 머리말의 「표준 봉투를 쓰지 않는다」 불릿은 이 변경에 맞춰 고쳤다. 그 불릿은 사실만 적었고 까닭을 적은 Rationale 은 없다. 응답을 `@Res` 로 직접 써서 전역 필터가 봉투와 `requestId` 를 채우지 못한 결과였다. 이제 컨트롤러가 봉투를 조립하고 `requestId` 를 발급하므로 표준 봉투로 맞췄다.
- 열거 공격 실패 카운트는 바꾸지 않았다. `*_INSTALL_INVALID_TOKEN` · `*_INSTALL_INVALID_HMAC` 만 센다.

### Cafe24 · MakeShop 연결 테스트의 401 · 403 밖 실패에 `*_API_ERROR` 를 새로 만들었다 (2026-11-06)

NERV Task `CLE-T-H9FQHR` 이다. Cafe24 · MakeShop 연결 테스트는 첫 요청이 401 · 403 이 아닌 상태로 실패해도 401 처럼 토큰을 갱신하고 다시 보냈다. 다시 보낸 요청이 5xx · 429 로 실패하면 `*_AUTH_FAILED` 로 답해 서버 장애나 호출 제한을 인증 실패로 안내했다. 정의는 [서비스별 인증 방식과 자격 증명](../CLE-INT/CLE-INT-AUTH.md#연결-테스트는-401-만-토큰-문제로-본다-2026-11-06) 에 있다.

- **401 · 403 이 아닌 상태는 새 코드로 낸다.** 인증 실패가 아닌 새 조건이라 새 코드를 만들었다(규칙 6). 사용자가 할 일이 상태와 관계없이 «잠시 뒤 다시 시도하거나 상점 쪽 상태를 확인» 으로 같아서 코드를 하나로 묶고 받은 상태는 `message` 에 싣는다.
- `*_TRANSPORT_FAILED` 를 쓰는 안은 기각했다. 그 코드는 응답을 받지 못한 실패다. 응답을 받은 실패까지 담으면 뜻이 갈린다.
- 노드의 `*_RATE_LIMITED` 를 429 에 쓰는 안도 기각했다. 그 코드는 429 재시도를 다 썼다는 뜻인데 연결 테스트는 429 를 다시 시도하지 않는다. §6.21 표 아래 「빈도 제한 코드는 세 부류다」 의 구분도 흐려진다.
- 노드처럼 `*_5XX` · `*_4XX` 로 상태를 나누는 안도 기각했다. 상태 번호 이름은 §3 예외라 새 코드의 선례가 아니다(규칙 7).
- HTTP 통합 연결 테스트처럼 401 · 403 이 아닌 4xx 를 성공으로 보는 안도 기각했다. HTTP 통합은 사용자가 정한 주소를 부르므로 4xx 응답도 서버가 살아 있다는 신호다. Cafe24 · MakeShop 연결 테스트는 정해진 진단 주소를 부르므로 4xx 도 실패다.
- 토큰 갱신 요청 자체가 401 · 403 이 아닌 상태로 실패하면 연결 테스트는 지금도 `*_TRANSPORT_FAILED` 로 답한다. 갱신 경로는 노드와 함께 써서 이 변경에 넣지 않았다. 응답을 받은 실패라 `*_TRANSPORT_FAILED` 의 뜻(응답을 받지 못한 실패)과 어긋난다. 위에서 `*_TRANSPORT_FAILED` 를 기각한 근거와 같은 어긋남이며 NERV Task `CLE-T-DJGSBR` 이 고칠 때까지 남겨 두는 한시 예외다.

### `new` 가 아닌 모드의 begin 이 대상 통합과 맞지 않는 요청에 `OAUTH_TARGET_MISMATCH` 를 새로 만들었다 (2026-11-06)

NERV Task `CLE-T-9J6W7H` 다. `oauth/begin` 을 `new` 가 아닌 모드로 부르면서 본문의 서비스나 Cafe24 상점 식별자 · 앱 유형을 `integrationId` 의 대상 통합과 다르게 실으면 400 `OAUTH_TARGET_MISMATCH` 로 거절한다(§6.21). 전에는 거절하지 않아 콜백이 다른 상점이나 다른 서비스의 토큰을 대상 통합에 쓸 수 있었다. 동작과 근거의 정본은 [OAuth 연결과 토큰 갱신 「`new` 가 아닌 모드의 begin 은 본문이 대상 통합과 다르면 거절한다」](../CLE-INT/CLE-INT-OAUTH.md#new-가-아닌-모드의-begin-은-본문이-대상-통합과-다르면-거절한다-2026-11-06) 다.

- **새 조건이라 새 코드를 만든다(규칙 6).** 이 엔드포인트에 전에 없던 거절 조건이다.
- **`VALIDATION_ERROR` 를 쓰지 않는다.** 본문 하나만 보면 형식이 맞는 요청이다. 대상 행과 견준 결과를 형식 검증 코드에 담으면 뜻이 갈린다.
- **409 를 쓰지 않는다.** 대상 행의 상태와 부딪힌 것이 아니라 요청이 대상을 잘못 가리킨 것이다. 같은 요청을 다시 보내도 결과가 같은 클라이언트 오류라 400 이다.
- **이름은 `<DOMAIN>_<CONDITION>` 이다(규칙 1 · 3).** 조건이 OAuth 흐름의 시작 요청에 속해 `OAUTH_*` 를 붙였다. 미리보기 토큰과 요청의 서비스 유형이 다를 때 쓰는 `OAUTH_PREVIEW_MISMATCH` 와 같은 꼴이다. 서비스와 상점 식별자를 나눠 코드 둘로 만드는 안은 기각했다. 클라이언트가 할 일이 «대상 통합의 값으로 다시 보낸다» 로 같다.

### multipart 업로드 413 의 `message` 를 고정 문구로 바꿨다 (2026-11-06)

NERV Task `CLE-T-8MQMGQ` 이다. 이전 판은 multipart 업로드 413 의 `message` 를 multer 원문 `"File too large"` 로 적었다. 전역 예외 필터가 http-errors 미들웨어(body-parser)의 4xx 만 고정 문구로 바꾸고, Nest 가 multer `LIMIT_FILE_SIZE` 를 바꾼 `PayloadTooLargeException` 은 `HttpException` 이라 원문이 그대로 나갔기 때문이다. 필터가 `code` 를 지정하지 않은 `HttpException` 413 도 `"Request payload too large."` 로 바꾸게 되어 행을 고쳤다.

- 같은 코드의 두 행이 서로 다른 `message` 규칙을 갖지 않게 했다. 클라이언트는 `code` 로 분기하지만 `message` 를 그대로 보여 주는 화면도 있어서, 한도를 넘은 원인에 따라 문구가 달라질 이유가 없다.
- 라이브러리 원문을 응답에 싣지 않는 규칙과 그 범위는 [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) 가 정한다. 이 문서는 카탈로그 행만 그 규칙에 맞춘다.
- `code` 를 지정한 413(공개 웹훅 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`)은 그 코드와 문구를 그대로 둔다.
- 같은 날 더한 「설치 엔드포인트의 예상 밖 예외를 500 으로 가리고 `requestId` 를 싣는다」 절은 코드가 없는 `HttpException` 의 문구를 「전역 필터처럼 그대로 싣는다」고 적었다. 이 변경 뒤 전역 필터는 코드가 없는 413 의 문구를 고정 문구로 바꾸므로 그 비교는 413 을 뺀 상태에만 맞다. 설치 엔드포인트는 전역 필터를 거치지 않아 이 변경의 영향을 받지 않는다.

### Send Email 의 빈 수신자에 `EMAIL_NO_RECIPIENTS` 를 등재했다 (2026-11-06)

NERV Task `CLE-T-3PRYB4` 이다. Send Email 노드는 정규화한 수신자(`to`)가 비면 실행을 실패시키지 않고 에러 포트로 `EMAIL_NO_RECIPIENTS` 를 낸다. 이 코드를 발행하기 시작해 규칙 9 에 따라 §6.6 Email 행에 등재했다.

- 같은 행의 `EMAIL_SEND_FAILED` 설명을 구현에 맞췄다. 이전 판은 `INTEGRATION_INCOMPLETE` 같은 원래 코드를 `EMAIL_SEND_FAILED` 의 `details.integrationCode` 에 보존한다고 적었다. 실제로는 `IntegrationError` 의 코드가 그대로 `output.error.code` 로 나오고 `details.integrationCode` 에도 같은 값이 들어간다. `EMAIL_SEND_FAILED` 는 `IntegrationError` 가 아닌 예외에만 쓰고 이때 `details.integrationCode` 는 없다. [통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md) 의 서술과 같다.
- 빈 수신자를 에러 포트로 보내는 결정과 이유의 정본은 [Send Email 노드](../CLE-NODE-INT/CLE-NODE-EMAIL.md) Rationale 「빈 수신자를 에러 포트로 보낸다」 다.

### `INVALID_BOT_TOKEN` 의 뜻을 길이 상한과 보이는 ASCII 위반까지 넓혔다 (2026-11-06)

NERV Task `CLE-T-FX354C` 이다. 봇 토큰 재발급은 `newBotToken` 이 있는지와 문자열인지만 봤다. 공백 · 제어 문자 · ASCII 밖 문자가 든 토큰은 헤더에 실을 수 없어 fetch 가 요청을 만들지 못했고 응답은 `502 CHAT_CHANNEL_SETUP_FAILED` 였다. 사용자가 고칠 입력 오류이므로 400 으로 거부한다. 정의는 [채팅 채널 「R-CC-32 봇 토큰 입력은 보이는 ASCII 만 받는다」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-32-봇-토큰-입력은-보이는-ascii-만-받는다) 에 있다.

- 새 코드는 만들지 않았다. `INVALID_BOT_TOKEN` 은 처음부터 입력 형식이 틀렸다는 뜻이고 길이 · 문자 집합 위반도 같은 뜻이다(규칙 6 의 새 조건이 아니다).
- 재발급에도 생성과 같은 256자 상한을 둔다.
- 생성 경로는 DTO 검증이라 같은 입력 오류가 `400 VALIDATION_ERROR` 다.
- 입력 형식 오류는 400(`INVALID_BOT_TOKEN` · `VALIDATION_ERROR`)이고 프로바이더 장애는 502(`CHAT_CHANNEL_SETUP_FAILED`)다. 형식이 맞는데 프로바이더가 거부하면 `BOT_TOKEN_INVALID`(400)다.

### `ADMIN_REQUIRED` · `EDITOR_REQUIRED` 행에 통합의 발행 경로를 더했다 (2026-11-07)

NERV Task `CLE-T-B4WH9N`(통합 스펙 정리)이 최신 승인본과 대조해 넘긴 두 건이다. 이 초안은 `CLE-T-5GYWFA` 를 맡은 세션이 함께 열었다. 코드 변경은 없다. 이미 있는 발행 경로를 카탈로그가 빠뜨렸던 것을 채웠다.

- **`ADMIN_REQUIRED`**: 관리자 미만이 조직 공개 범위로 `oauth/begin` 을 `new` 모드로 부르면 다시 쓸 설치 대기 행을 찾기 전에 이 코드로 거절한다(REQ-INTOAUTH-064). 컨트롤러가 통합 생성과 같은 판정(`IntegrationsService.assertCanCreate`)을 부른다. 통합 OAuth 의 발행 자리를 두 곳에서 세 곳으로 고쳤다.
- **`EDITOR_REQUIRED`**: 통합 쓰기 라우트와 `oauth/begin`(REQ-INTOAUTH-063)에는 편집자 이상 라우트 가드가 붙는다. 뷰어가 부르면 대상의 공개 범위와 상관없이 이 코드다. 기준은 [통합 관리 「권한」](../CLE-INT/CLE-INT-MANAGE.md#권한) 의 «역할 거부 코드는 라우트 가드가 먼저 정한다» 다. 관련 문서 칸에 그 문서를 더했다.

### `GRAPH_VALIDATION_FAILED` 를 §6.4 에 직접 등재했다 (2026-11-12)

NERV Task `CLE-T-PA0EMN` 에서 더했다. `workflows.service.ts` 가 캔버스 저장과 버전 복원에서 400 으로 내고 프론트엔드도 이 코드의 안내 문구를 두는데(`backend-labels.ts`) 카탈로그에 없어 규칙 8 을 어겼다. 도메인 참조 절을 새로 만들지 않고 §6.4 에 직접 등재했다. `ALERT_RULE_NOT_FOUND` 의 직접 등재 선례를 따랐다. 정의 문서는 규칙과 심각도를 정하는 [그래프 경고 규칙](../CLE-WF/CLE-WF-WARN.md)과 저장 흐름을 정하는 [워크플로우 데이터와 저장 흐름](../CLE-WF/CLE-WF-DATA.md)이다.

- **새 코드가 아니다.** 이미 내던 코드를 등재만 했다. 이름 · 상태 코드 · `details.errors` 형태는 그대로다.
- **`VALIDATION_ERROR` 로 합치지 않는다.** 요청 본문 형식이 틀린 경우가 아니라 저장하려는 그래프가 규칙에 걸린 경우다. 클라이언트는 이 코드로 캔버스의 오류 배지를 보라는 안내를 고른다.
- **도구 payload 예산 규칙도 이 코드를 쓴다.** 그래프 규칙 평가를 통과한 뒤 따로 평가하고 `AI_AGENT_TOOL_BUDGET_STRICT_SAVE=true` 일 때만 저장을 막는다. 막는 이유가 같아(저장할 그래프의 규칙 위반) 코드를 나누지 않았다.

### 자격 증명 교체의 연결 테스트 실패를 통합 관리 결정에 맞췄다 (2026-11-12)

NERV Task `CLE-T-HGBHF2` 에서 옮겼다. 결정의 정본은 [통합 관리 「자격 증명 교체의 연결 테스트 실패는 400 이다 (2026-11-12)」](../CLE-INT/CLE-INT-MANAGE.md#자격-증명-교체의-연결-테스트-실패는-400-이다-2026-11-12) 다(NERV Task `CLE-T-J6TZGK`).

- **`INTEGRATION_TEST_FAILED` 의 상태는 400 이다.** 이 카탈로그는 통합 관리가 상태를 미결로 둔다고 적었다. 그 미결이 400 으로 닫혀서 행의 문장을 결정으로 바꿨다. 이름과 상태는 그대로라 새 코드가 아니다.
- **테스트 결과 코드는 `details.testCode` 에 싣는다.** 값은 연결 테스트 결과의 이름공간이라 이 카탈로그에 등재하지 않는다. `details.code` 로 두지 않은 이유는 [에러 응답과 클라이언트 처리 2.5](CLE-API-ERROR.md#25-field-를-실으면-code-도-싣는다-2026-09-11) 에 적었다. 구현은 NERV Task `CLE-T-XCMNP6` 이다.
- **`MAKESHOP_AUTH_FAILED` 행에 연결 테스트와 노드의 차이를 적었다.** 행의 조건 문장은 이미 연결 테스트의 403 이 통합 상태를 바꾸지 않는다고 적었다. 노드와 같은 이름이 다른 결과를 낸다는 것을 한 문장으로 드러내고 통합 관리의 정의 자리를 링크했다.

### 컨테이너 구조 검사의 접두를 행 없이 메시지 접두로 적었다 (2026-11-12)

NERV Task `CLE-T-1W44RD` 의 결정이다.

- **`CONTAINER_*` 행을 두지 않았다.** 엔진은 컨테이너 구조 검사에 실패하면 `new Error()` 메시지 앞에 `CONTAINER_CYCLE: ` · `CONTAINER_INVALID_CHILD: ` · `CONTAINER_MISSING_EMIT: ` · `CONTAINER_MULTIPLE_EMIT: ` 를 붙이고 코드 필드에는 싣지 않는다. 행으로 등재하면 클라이언트가 분기할 코드처럼 읽혀 규칙 4 와 부딪친다. 그래서 `INVALID_NODE_CONFIG: ` 처럼 행 없이 §6.5 에 메시지 접두로 적었다. 노드 문서들의 에러 표도 이름만 적던 것을 [Loop 노드](../CLE-NODE-LOGIC/CLE-NODE-LOOP.md) 처럼 메시지 전체로 바꿨다([컨테이너 실행 「공통 실행 모델」](../CLE-EXEC/CLE-EXEC-CONTAINER.md#공통-실행-모델)).
- **`MAX_ITERATIONS_EXCEEDED` 는 행을 남기고 앵커 열에 `메시지 접두` 를 적었다.** 이 이름도 Loop 실행기가 메시지 앞에 붙이는 접두다. 규칙 9 는 이런 등재를 지우고 그 자리에 실측을 남기라고 한다. 이 행은 앵커 열과 설명에 실측(메시지 접두와 메시지 전체)을 적어 그 자리 구실을 한다. 행을 지우지 않은 것은 사용자 가이드 실행 결과 페이지의 에러 코드 표와 채팅 채널의 실행 실패 분류기(`execution-failure-classifier.ts`)가 이 이름을 코드로 싣고 있어서다. 독자는 그 이름을 이 카탈로그에서 찾는다. 가이드와 분류기를 고친 뒤 행을 지울지는 NERV Task `CLE-T-82M3MB` 가 정한다.
- **경로 자리표시자 접두는 출력 코드를 바꾸지 않았다.** Cafe24 · MakeShop 노드가 경로 자리표시자를 채우지 못하면 던지는 `CAFE24_UNRESOLVED_PATH_PARAM: ` · `MAKESHOP_UNRESOLVED_PATH_PARAM: ` 은 노드의 바깥 catch 에서 `INTEGRATION_CALL_FAILED` 가 된다. `IntegrationError` 로 바꿔 서비스별 코드를 주는 안도 견줬다. 이 실패는 메타데이터나 입력 매핑의 오류라 흐름에서 따로 분기할 일이 없고, 그 안은 코드 변경과 새 코드 등재가 함께 필요하다. 그래서 출력은 그대로 두고 노드 문서의 에러 코드 절에 메시지 전체와 출력 코드를 적었다.
- **가이드 식별자 가드의 주석이 이 결정을 기다리고 있었다.** `guide-identifier-scan.ts` 는 «`CONTAINER_*` 를 6.5 에 등재하면 카탈로그 탈출구가 발화한다» 를 근거로 그 탈출구를 남겨 두었다. 등재하지 않기로 했으므로 주석과 탈출구의 처분도 NERV Task `CLE-T-82M3MB` 가 맡는다.

### 404 가 아닌 `*_NOT_FOUND` 세 코드를 정리했다 (2026-11-12)

NERV Task `CLE-T-3P4ENZ` 에서 사람이 정했다. 이름은 `_NOT_FOUND` 인데 404 가 아닌 코드를 하나씩 따졌다.

- **`AUTH_CONFIG_NOT_FOUND` 는 이름과 400 을 그대로 둔다.** 발행처는 트리거 생성 · 수정의 `authConfigId` 검증 한 곳이고 뜻도 상태도 하나다. 규칙 5 는 이름을 더 정확하게 하려는 목적만으로 바꾸지 않는다고 정한다. 뜻이 갈리지 않으니 규칙 6 에도 걸리지 않는다. 프런트엔드에 이 코드로 분기하는 곳이 없어서 바꿔도 얻는 것이 없다. 「`_NOT_FOUND` 는 404」 라는 기대는 이름의 부분 문자열로 상태를 짐작하는 읽기라서 규칙 4 가 막는다. 그래서 §6.14 의 설명으로 밝히는 데 그쳤다. 위 「모델 설정 코드 분리」 선례와는 경우가 다르다. 그 선례는 한 코드가 두 뜻과 두 상태를 가져서 나눴다.
- **기각: `AUTH_CONFIG_NOT_FOUND` 를 404 로 바꾸거나 이름을 바꾼다.** 404 로 바꾸면 입력 필드를 지목하는 `details` 와 맞지 않는다. 다른 워크스페이스 참조는 리소스 부재가 아니라 입력값 문제로 봤다(§6.14). 이름 바꾸기는 규칙 5 에 어긋난다.
- **로그인 검증의 `WEBAUTHN_CREDENTIAL_NOT_FOUND`(401)는 `WEBAUTHN_INVALID` 로 옮긴다.** 같은 이름이 credential 이름 변경 · 삭제에서는 대상이 없다는 404 이고 로그인 2단계 검증에서는 인증이 실패했다는 401 이다. 뜻이 갈리므로 규칙 6 에 따라 나눈다. 로그인 쪽은 새 코드를 만들지 않고 기존 `WEBAUTHN_INVALID` 로 옮긴다. 서명이 틀린 응답과 이미 쓴 챌린지를 이 코드로 묶은 이유와 같다. 사용자가 할 일은 「Passkey 로 다시 시도」 하나다. credential 이 없다는 사실을 서명 실패와 구별해 알려 줄 이유도 없다. 로그인 화면도 `WEBAUTHN_INVALID` 만 안내 문구로 바꾼다. 자세한 근거는 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) 의 Rationale 에 있다.
- **토큰 검증의 `WORKSPACE_NOT_FOUND`(401)는 새 코드 `NO_WORKSPACE_AVAILABLE` 로 옮긴다.** 404 는 대상 워크스페이스가 없다는 뜻이고 401 은 사용자에게 쓸 워크스페이스가 하나도 없다는 뜻이다. 뜻이 갈리므로 규칙 6 에 따라 나눈다. 이름은 조건이 워크스페이스 하나가 아니라 사용자의 상태라는 점이 읽히게 골랐다. 규칙 3 의 `<DOMAIN>_<CONDITION>` 은 권장이라 이 이름에서는 따르지 않았다. 다른 후보를 고르지 않은 이유는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) 의 Rationale 에 있다.
- **두 이동은 구현 전이라 표 아래 문장으로 적었다(규칙 9).** 지금 응답에 나가는 401 은 행으로 그대로 둔다(규칙 8). 구현하는 NERV Task `CLE-T-ZPPWK4` 가 발행과 함께 표를 고친다.
- **`WEBAUTHN_CREDENTIAL_NOT_FOUND` 를 이번에 등재했다.** 「미결 사항」 의 Passkey 미등재 코드 셋 가운데 이번 결정과 직접 걸리는 것은 이 코드뿐이다. 나머지 `WEBAUTHN_CREDENTIAL_EXISTS` · `WEBAUTHN_NOT_REGISTERED` 는 NERV Task `CLE-T-9KCQ7Y` 에 남긴다.

### 봇 토큰 재발급 실패 코드와 공개 웹훅 범위를 도메인 문서에 맞췄다 (2026-11-13)

NERV Task `CLE-T-GNTWP9` 에서 도메인 문서와 어긋난 행을 맞췄다. §6.15 에 더한 403 세 행과 500 행은 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 「봇 토큰 재발급 API」 의 에러 표를 옮겼다. §5 `WORKSPACE_REQUIRED` 행의 단서는 같은 문서 「R-CC-18 rotate-bot-token 의 워크스페이스 검증은 공용 데코레이터로 한다」 Rationale 의 2026-11-12 정정을 따른다. `INTERNAL_ERROR` 에 더한 문장은 [시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 25 · 27 이 거부 전용 코드 없이 일반 500 으로 보낸다고 정한 데서 왔다. 이 거부는 예상된 경우라 「예상하지 못한 서버 에러」 라는 설명만으로는 맞지 않았다. 공개 웹훅 정의와 `PAYLOAD_TOO_LARGE`(요청 본문) 행은 [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) 에 맞췄다. 웹훅 문서는 사람 결정(2026-11-12)에 따라 공개 웹훅 한도에서 채팅 채널 트리거를 뺐다. §6.10 의 분당 · 시간당 한도와 본문 크기 행에 같은 범위를 적었다. 이 제외는 NERV Task `CLE-T-QKJ2TZ`(#1692)가 `PublicWebhookThrottleGuard` 에 구현했으므로 세 행의 상태는 «구현» 그대로 둔다. §6.4 `WORKSPACE_ID_REQUIRED` 행에는 경로로 워크스페이스를 받지 않는 `@Roles()` 라우트가 이 코드 대신 `403 FORBIDDEN` 을 낸다는 단서를 더했다([워크스페이스와 멤버 「`X-Workspace-Id` 형식 검사」](../CLE-ACCT/CLE-ACCT-WS.md#x-workspace-id-형식-검사)).

### 어시스턴트 스트림 코드를 도메인 참조 절 6.25 로 등재했다 (2026-11-13)

NERV Task `CLE-T-YFDSY7` 이다. 어시스턴트 메시지 스트림의 SSE `error` 이벤트는 `ASSISTANT_NO_LLM_CONFIG` · `ASSISTANT_STREAM_FAILED` · `ASSISTANT_TOO_MANY_TOOL_CALLS` 를 내는데 이 카탈로그에 행이 없었다(규칙 8). §6.21~6.24 를 더한 2026-11-05 결정의 구조를 따랐다.

- **§6.1~6.24 는 그대로 두고 §6.25 를 더했다.** §6.19 에 합치는 안은 택하지 않았다. §6.19 의 코드는 HTTP 에러 응답으로, §6.25 의 코드는 SSE 이벤트로 나가 나가는 곳이 다르다. 번호를 다시 매기면 절 앵커와 링크가 깨진다.
- **LLM 클라이언트 코드는 행을 두 번 두지 않았다.** 스트림이 그대로 넘기는 세 코드의 정의는 §6.17 행이다. §6.25 는 넘긴다는 사실과 `message` 가 바뀐다는 점만 적는다.
- **발행된 적 없는 세 코드는 등재하지 않았다(규칙 9).** `ASSISTANT_LLM_CONFIG_INVALID` 자리는 기본 설정으로 대신하고 `config_fallback` 이벤트로 알리는 동작이 맡는다(사람 결정, 2026-11-13. 구현은 NERV Task `CLE-T-1K2BM4`). `ASSISTANT_STREAMING_UNSUPPORTED` 자리는 LLM 클라이언트의 `LLM_STREAMING_UNSUPPORTED` 를 그대로 넘기는 것으로 정했다(사람 결정, 2026-11-13). 같은 뜻의 코드를 하나 더 두지 않기 위해서다. `ASSISTANT_TOOL_FAILED` 는 편집 도구 실패가 `tool_call` 결과로 오므로 코드가 아니다.
- 「발행하는데 행이 없는 어시스턴트 스트림 코드」 미결은 이 등재로 닫혀 지웠다. 규칙 4 · 6 과 어긋나는 프로바이더 분기는 미결로 남긴다.
- §6.17 `LLM_OUTPUT_MALFORMED` 행의 «사용자에게는 안내문으로 바꿔 보인다» 는 NERV Task `CLE-T-V73FFA` 에서 고쳤다. LLM 클라이언트는 이제 사용자 문구를 정하지 않고 고정 영문 진단 문장만 싣는다([LLM 클라이언트 「스트림 오류 `message` 는 진단용으로 둔다」](../CLE-AI/CLE-AI-LLM.md#스트림-오류-message-는-진단용으로-둔다-2026-11-13)).
