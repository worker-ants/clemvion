---
id: "CLE-API-ERRCODES-EXCEPT"
title: "에러 코드 — 예외 · 내부 분류 · 은퇴 코드"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-ERRCODES"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-ERRCODES"]
area: "CLE-API"
content_hash: "a0f9c8464a95b1f0282e1fb4cc52aa0bf6fc00ac409eab0f907e8f9710936f79"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "01f92c9b78d31dc2bbf11a65db50eaff113d90447434f293ae8d2074e714f21c"
etag: "sha256-2b1d5994bf9e92095f53267f98b5e18a205c75eaf19264e81cda47dab61980c0"
---
## 개요

이 문서는 [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 의 하위 문서로 이름 규칙(규칙 1~3)을 따르지 않지만 유지하는 예외 등록 코드, 클라이언트에 나가지 않는 내부 분류 코드의 정규화, 교체한 은퇴 코드를 정한다. 규칙 1~10 은 부모 문서 「규칙」 절이 정한다.

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
| `invitation_not_found` · `invitation_expired` · `invitation_already_used` · `invitation_email_mismatch` · `rate_limited` | 404 · 410 · 410 · 400 · 429 (순서대로) | `lower_snake_case` 로 표기 규칙을 어긴다. 워크스페이스 초대 흐름 v1 에서 이 형태로 굳었고 프론트엔드(`invitations.ts` 의 `INVITATION_ERROR_CODES`)와 백엔드(`workspace-invitations.service.ts`, `auth.service.ts`)가 `code` 값으로 분기한다. 바꾸면 호환이 깨진다(§2) | 초대 토큰 없음·만료·사용됨·이메일 불일치·빈도 제한. **초대 API 한정**이다. 이 소문자 `rate_limited` 는 초대 흐름 전용이고 다른 영역의 `RATE_LIMITED` 와 별개다. 2026-09-25 에 발행처가 없던 `forbidden` 을 이 행에서 뺐다(`code: 'forbidden'` 0건). 초대 권한 부족은 `RolesGuard` 의 `ADMIN_REQUIRED` 다. 소유자가 아닌 요청자의 관리자 역할 초대 거부는 서비스 계층이 내는 대문자 `OWNER_REQUIRED`(§6.2)라 이 예외에 들지 않는다. `rate_limited` 발행처는 [미결 사항](CLE-API-ERRCODES.md#미결-사항) 참조 | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#초대-에러-코드) 의 초대 에러 코드 |
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

## Rationale

### 왜 예외 등록부인가

완벽한 이름을 소급해 강제하면 호환을 깨는 이름 바꾸기가 쏟아진다. 부정확하지만 안정적인 기존 코드는 "예외 등록과 정의 명확화" 로 흡수하고 규율은 새 코드에만 적용해 일관성을 점점 높인다.

### 예외 등록 근거에 "모듈 안 일관성 보존" 도 들어가는 이유

§2 의 호환 우려가 없는 코드라도 이미 소문자로 굳은 모듈의 일부라면 일부만 `UPPER_SNAKE_CASE` 로 바꾸는 것이 모듈 안에 대소문자를 섞어 국소 일관성을 해친다. 이런 코드는 정규화의 가독성 이득(0)보다 모듈 일관성 이득이 커서 §5 가 아니라 §3 으로 흡수한다(워크스페이스 초대 모듈, 2026-06-28 결정). 즉 §3 흡수 조건은 "이름 바꾸기가 호환을 깬다" 와 "이름 바꾸기가 모듈 일관성을 해친다" 의 합집합이다.

### 은퇴 코드의 진입 기준이 "client 코드 분기 없음" 인 이유

§5 의 기준은 "외부 노출 여부" 가 아니라 "외부 client 코드에 옛 코드로 분기하는 지점이 있었는가" 다. 사용자 문서 목록에만 나온 코드는 client 가 그 문자열로 분기하지 않으므로 교체의 호환 영향이 0이고 문서만 맞추면 된다. client 에 하드코딩 분기가 있었다면 §2 가 적용돼 새 코드나 정식 마이그레이션을 거친다(`WORKSPACE_REQUIRED` 가 이 기준의 첫 적용이다).

### 그 이분법에 없던 세 번째 상태를 등급 B 로 적었다 (2026-08-22)

위 기준은 "분기 0 을 확인" 과 "하드코딩 분기 있음" 두 갈래만 다룬다. 워크스페이스 JWT 로 부를 수 있는 내부 REST 는 저장소 밖 호출자를 배제할 수 없어 어느 쪽으로도 판정되지 않고 "찾지 못했다" 만 관측된다. `INVALID_INPUT` 통일이 그 첫 사례라 등급을 A 와 B 로 갈랐다. 갈래가 없으면 근거를 부풀려 A 로 적거나(원칙이 실제보다 강해진다) 위험이 없는데도 정식 마이그레이션을 강제하는 수밖에 없다. 등급을 나누면 각 행이 자기 근거의 강도를 드러낸다.

### 재실행 경로의 코드를 `INVALID_INPUT` 에서 옮긴 경위 (2026-08-22)

옛 카탈로그는 "`RERUN_` prefix 를 붙이지 않고 이름 안정성상 유지한다" 고 적었다. 그 문장이 기각한 것은 `RERUN_INVALID_INPUT` 으로의 개명이었지 세 경로 통일이 아니었다. 통일 결정으로 이름 바꾸기 자체가 뒤집혔다(§5). 재실행은 2026-08-20 에 파라미터 검증 헬퍼의 세 번째 소비처가 됐다. 그전에는 내부 사유를 `errors` 키로 던져 필터가 읽지 못했고 필드별 내역이 응답에 실리지 않았다. `MASKED_VALUE_RESUBMITTED` 를 더하면서 배선을 함께 고쳤다.

### 모델 설정 코드 분리: `MODEL_CONFIG_NOT_FOUND`(404)와 `MODEL_CONFIG_DEFAULT_MISSING`(400)

옛 코드 하나가 "지정한 설정 없음"(404)과 "워크스페이스 기본값 미설정"(400)을 함께 담아 같은 코드가 두 상태를 가졌다. id 경로는 `MODEL_CONFIG_NOT_FOUND`(404, 존재 누설 방지)로 한정하고 기본값 미설정은 설정을 안내하는 `MODEL_CONFIG_DEFAULT_MISSING`(400)으로 나눴다. `resolveEmbedding` 의 기본값 부재는 "설정 미완료 안내" 가 아니라 "이 자원을 지금 해석할 수 없음" 이 더 정확해 404 를 유지한다. 설정 안내(400)는 chat/LLM 기본값 경로(`resolveConfig`)에서만 낸다(사용자 결정 2026-06-12).
