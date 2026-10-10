---
id: "CLE-API-ERRCODES"
title: "에러 코드 규약과 카탈로그"
type: "convention"
version: 6
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API"
ancestors: ["CLE-VISION", "CLE-API"]
area: "CLE-API"
content_hash: "683c61df46700b7a3e40506cf51fc484ba37c3c335185f344ece8de59aed152e"
read_as: "approved_fallback"
task: "CLE-T-0W7CA7"
source_paths: ["spec/5-system/3-error-handling.md", "spec/conventions/error-codes.md"]
mirror_sha256: "5d2c1a2d7d80aa6fa1d00d676f5052874bc14f03bf406352752166def64e4f32"
etag: "sha256-18cc461cf111f3047418ed40cbf4967d2dacd669f8a549355e846e5520da209e"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/error-codes.md`, `spec/5-system/3-error-handling.md` (§1, Rationale 일부) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 에러 코드(error code, `error.code`)의 이름 규칙과 안정성 규율, 그리고 제품 전체의 에러 코드 카탈로그를 정한다. 이름 규칙을 따르지 않지만 호환 때문에 유지하는 예외 등록 코드(historical artifact)와 더 이상 내보내지 않는 은퇴 코드(retired code)의 기록도 이 문서에 둔다.

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
6. 의미가 갈리거나 새 조건이 생기면 새 코드를 만든다. 새 코드는 처음부터 의미가 정확한 이름을 붙여 뒤에 이름을 바꿀 압력을 만들지 않는다. 다만 같은 표면(같은 엔드포인트) 안에서 구분하면 리소스가 다른 워크스페이스에 있다는 것이 드러나는 조건은 같은 코드를 쓴다([`TRIGGER_NOT_FOUND` 를 다른 워크스페이스의 워크플로우에도 쓰는 이유](#trigger_not_found-를-다른-워크스페이스의-워크플로우에도-쓰는-이유-2026-10-05)). 표면이 다르면 같은 뜻도 다른 코드를 쓰는 카탈로그 관행(§6.19 의 `WORKFLOW_NOT_FOUND`)과는 부딪치지 않는다. 이 단서는 한 표면 안의 조건만 묶는다. 비활성 트리거의 `TRIGGER_INACTIVE`(410)처럼 다른 워크스페이스 소속이 아닌 상태는 이 단서 밖이다.
7. 규칙을 따르지 않지만 유지하는 기존 코드는 §3 예외 등록부에 적는다. 새 코드는 예외를 선례로 삼지 않는다.
8. 발행하는 코드는 모두 §6 카탈로그에 등재한다. 정의·발생 조건이 도메인 문서에 있으면 그 문서를 정의 문서로 적고 카탈로그는 공용 가시성을 위해 등재만 한다.
9. 발행된 적 없는 코드는 등재하지 않는다. 문서 표에만 있고 코드가 한 번도 내지 않은 코드는 이름 바꾸기가 아니라 기록 실수이므로 등재를 지우고 그 자리에 실측을 남긴다.
10. 교체한 옛 코드는 §5 은퇴 코드 표에 흡수 등급과 함께 남긴다.

## 1. 의미 기반 명명

규칙 1 의 예다.

- **의미를 적는다**: `CAFE24_INSTALL_INVALID_HMAC`(HMAC 검증 실패), `INTEGRATION_INCOMPLETE`(통합 미완성), `OAUTH_STATE_MISMATCH`(state 불일치). 이름만으로 분기의 뜻이 드러난다.

**도메인 prefix (규칙 3)**: `VALIDATION_ERROR` 같은 시스템 전역 공용 코드(§6.1, §6.4)는 prefix 없이 쓰는 기존 범주이고 원칙의 예외가 아니다.

**prefix 없는 공용 코드 `INVALID_TOOL_ARGUMENTS`**: AI 에이전트의 tool_use 인자 검증 실패 코드([MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md))는 `MCP_` prefix 를 붙이지 않는다. MCP 전용이 아니라 모든 도구 프로바이더 경로가 함께 쓰는 LLM 인자 검증 범주이기 때문이다(`VALIDATION_ERROR` 와 같은 부류). LLM 이 `tool_result.error` 로 이 값을 보고 다음 턴에 인자를 고치므로 값이 곧 계약이고 이름을 바꾸면 호환만 깨진다.

## 2. 안정성과 이름 바꾸기

규칙 5·6 이 정한다. 이름 바꾸기가 호환성을 깨는 이유는 클라이언트가 코드 값으로 분기하기 때문이다. 바꾸면 deprecated 별칭, 이중 발행, 마이그레이션 부담이 생긴다.

## 3. 예외 등록 코드

§1 원칙을 따르지 않는 기존 코드를 여기에 등록한다. 부정확한 이름이지만 유지하는 활성 코드의 등록부다. 교체·은퇴한 옛 코드는 §5 에 둔다(목적이 다르다). 새 코드는 예외를 선례로 삼지 않는다.

| 코드 | HTTP | 이름이 부정확한 이유 | 실제 뜻 | 정의 문서 |
|---|---|---|---|---|
| `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` | 409 | `PRIVATE` 토큰이 역사적 흔적이다. 처음 만들 때는 Private 앱 한정이었으나 app_type 과 무관하게 넓어졌다 | 같은 `(workspaceId, mall_id)` 에 Cafe24 통합이 중복된다 | [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) 의 "CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드명 유지 결정" Rationale |
| `invitation_not_found` · `invitation_expired` · `invitation_already_used` · `invitation_email_mismatch` · `rate_limited` | 404 · 410 · 410 · 400 · 429 (순서대로) | `lower_snake_case` 로 표기 규칙을 어긴다. 워크스페이스 초대 흐름 v1 에서 이 형태로 굳었고 프론트엔드(`invitations.ts` 의 `INVITATION_ERROR_CODES`)와 백엔드(`workspace-invitations.service.ts`, `auth.service.ts`)가 `code` 값으로 분기한다. 바꾸면 호환이 깨진다(§2) | 초대 토큰 없음·만료·사용됨·이메일 불일치·빈도 제한. **초대 API 한정**이다. 이 소문자 `rate_limited` 는 초대 흐름 전용이고 다른 영역의 `RATE_LIMITED` 와 별개다. 2026-09-25 에 발행처가 없던 `forbidden` 을 이 행에서 뺐다(`code: 'forbidden'` 0건). 초대 권한 부족은 `RolesGuard` 의 `ADMIN_REQUIRED` 다. 소유자가 아닌 요청자의 관리자 역할 초대 거부는 서비스 계층이 내는 대문자 `OWNER_REQUIRED`(§6.2)라 이 예외에 들지 않는다. `rate_limited` 발행처는 [미결 사항](#미결-사항) 참조 | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#초대-에러-코드) 의 초대 에러 코드 |
| `workspace_type_mismatch` · `already_a_member` · `invitation_already_pending` · `invitation_already_accepted` | 403 · 409 · 409 · 409 | `lower_snake_case`. 위 초대 토큰 코드와 같은 모듈(`workspace-invitations.service.ts`)의 초대 발급·재발송 흐름 코드다. 프론트엔드는 `code` 로 분기하지 않고 `message` 만 보이지만 정규화하면 같은 모듈의 다른 소문자 코드와 대소문자가 섞이고 호환 이득이 0이라 소문자를 유지한다(2026-06-28 결정) | non-team 워크스페이스에 초대 / 이미 멤버 / 같은 이메일의 대기 초대 경합(partial UNIQUE) / 이미 수락된 초대의 재발송·취소. **초대 발급·재발송·취소 API 한정**이다. 직접 추가 경로의 대문자 코드와 같은 뜻의 **별개 코드**다(§6.12) | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#초대-에러-코드) 의 초대 에러 코드 |
| `workspace_not_found` · `user_not_found` · `admin_required` | 404 · 404 · 403 | `lower_snake_case`. 위 두 행과 같은 초대 모듈이 조회·RBAC 단계에서 발행한다. 모듈 안 소문자 일관성을 위해 유지한다(등록부 완전성 차원의 등재) | 워크스페이스 없음 / 대상 사용자 없음 / 관리자 미만 권한. 2026-09-25 이후 `admin_required` 는 HTTP 로 나가지 않는다. 초대 라우트가 `RolesGuard` 의 `@Roles('admin')` 를 먼저 거쳐 `ADMIN_REQUIRED` 가 나기 때문이다. 서비스 계층의 `admin_required` 는 가드가 빠졌을 때만 닿는 두 번째 방어선이다. **초대 모듈 한정**이고 직접 추가·관리 경로의 `WORKSPACE_NOT_FOUND`·`USER_NOT_FOUND`(§6.4)와 별개 코드다 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) 의 초대 발급·수락 절 |
| `invalid_state` · `token_exchange_failed` · `email_required` · `server_error` (OAuth 콜백 `?error=`) | 없음 (302 리다이렉트) | `lower_snake_case`. 봉투의 `error.code` 가 아니라 로그인 OAuth 콜백이 `{frontend_url}/callback?error=<값>` 으로 보내는 **URL query 값**이다. v1 에서 굳었고 콜백 페이지가 이 값으로 분기한다(§2) | 소셜 로그인 콜백 실패 사유(state 불일치 / 코드 교환 실패 / 이메일 미제공 / 서버 에러). **로그인 OAuth 콜백 URL 한정**이고 통합 OAuth 의 `OAUTH_*` 봉투 코드와 별개다 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) 의 OAuth 에러 처리 |
| `WORKER_HEARTBEAT_TIMEOUT` | 없음 (HTTP 무관. 엔진 수준 `error.code`, 실행 `failed`) | "HEARTBEAT" 는 워커가 주기적으로 보내는 별도 heartbeat 채널을 암시하지만 그런 채널은 만들지 않는다. 처음에는 부팅 때 30분 넘게 멈춘 `running` 실행을 실패 처리했다. 2026-07-04 에 부팅 경로는 rehydration 재구동(`recoverStuckExecutions`, 이 코드를 쓰지 않음)으로 바꾸고 이 코드는 BullMQ stalled 재배달(`maxStalledCount=1`)을 다 쓸 때 `finalizeStalledExhausted` 가 내도록 뜻을 다시 정의했다. 코드와 여러 문서가 값으로 참조하므로 바꾸면 호환이 깨진다(§2) | 활성 세그먼트 워커의 최종 실패로 실행이 `failed` 가 된다 | [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `AbortError` | 없음 (HTTP 무관. 노드 수준 `error.code`, 노드 실행 `cancelled`) | PascalCase 다. 우리가 정한 코드가 아니라 웹 표준 `AbortSignal` 이 던지는 `DOMException.name` 을 그대로 옮긴 값이다. fetch·SDK·DB 드라이버가 모두 이 이름으로 던지므로 정규화하면 엔진 분류 키(`error.name === 'AbortError'`)와 `code` 가 갈라진다. 여러 핸들러와 테스트가 값으로 참조한다(§2) | 노드의 외부 I/O 가 `abortSignal` 로 중단돼 노드 실행이 `cancelled` 가 된다. 엔진의 `ExecutionCancelledError`(DB 관측 취소 가드)는 같은 상태로 끝나지만 `code` 를 싣지 않는 별개 신호다 | [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) |

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
| `missing_required` | `MISSING_REQUIRED_FIELD` | `required: true` 파라미터 값 누락 | [트리거 노드 공통](../CLE-NODE-TRIG/CLE-NODE-TRIG-COMMON.md) |
| `coerce_failed` | `TYPE_COERCION_FAILED` | 선언한 타입으로 바꿀 수 없음 | [트리거 노드 공통](../CLE-NODE-TRIG/CLE-NODE-TRIG-COMMON.md) |
| `invalid_schema` | `INVALID_SCHEMA` | 파라미터 스키마 구조 위반 | [트리거 노드 공통](../CLE-NODE-TRIG/CLE-NODE-TRIG-COMMON.md) |
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
| `WORKSPACE_REQUIRED` | `WORKSPACE_ID_REQUIRED` | 400 | #566 | 채팅 채널 `rotate-bot-token` 컨트롤러의 인라인 코드(`401`)를 공용 `@WorkspaceId()` 데코레이터 코드(`400`)로 맞췄다(상태 코드도 401 에서 400 으로 바로잡음). 사용자 문서 목록에만 노출됐고 client 하드코딩 분기가 없어 호환 영향은 0이다. 경위는 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 의 「R-CC-18 rotate-bot-token 의 워크스페이스 검증은 공용 데코레이터로 한다」 Rationale 에 있다 |
| `INVALID_PASSWORD` | **조건별 두 코드**: `PASSWORD_REQUIRED`(비밀번호 미설정, OAuth 전용 계정) · `PASSWORD_INVALID`(현재 비밀번호 불일치) | 401 | 비밀번호 변경 코드 분리 작업 | **[등급 B, 잔여 위험 인수]** `POST /users/me/change-password` 가 두 조건에 같은 코드를 던지던 것을 형제 흐름(`verifyPasswordForUser`)과 같은 두 코드로 갈랐다. 새 코드는 만들지 않았다. 새로 만드는 안(`PASSWORD_NOT_SET`)은 비슷한 이름을 넷으로 늘리고 그 이름이 이미 `login_history.failure_reason` 감사값이라 같은 이름 충돌을 다시 만든다. 내부 REST 라 저장소 밖 호출자를 배제할 수 없어 등급 B 다(프론트엔드 분기 0건은 부재가 아니라 미발견). 사용자 결정 2026-09-02. **문자열은 남는다**: `INVALID_PASSWORD` 는 로그인 실패(`AuthService.login`)의 `login_history.failure_reason` 감사값으로 계속 기록된다. 감사값 정리는 `login_history` enum 변경을 동반하는 별개 작업이다([계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md)) |

## 6. 카탈로그

제품 전체의 에러 코드 목록이다. 코드마다 그 코드를 정의하거나 발행하는 문서를 "정의 문서" 열에 적는다. 발생 조건의 상세는 정의 문서가 정하고 이 카탈로그는 제품 전체에서 코드를 찾을 수 있게 등재한다.

**같은 뜻을 표면마다 다른 코드로 적는다.** 상태 불일치는 REST 핵심 API 가 `INVALID_STATE`(422), WebSocket 이 `INVALID_EXECUTION_STATE`, EIA REST `/interact` 가 `STATE_MISMATCH`(409)다. 메시지 길이 초과도 WebSocket 은 `EXECUTION_MESSAGE_TOO_LONG`, EIA REST 는 `MESSAGE_TOO_LONG` 이다. 라우팅 분기를 드러내려고 일부러 나눴다([장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 의 재개 명령 사전 검증 절, [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) 의 「WS 코드와 EIA 코드는 경로마다 다르게 쓴다」 Rationale).

### 6.1 시스템

| 코드 | 이름 | 설명 | 사용자 메시지 | 정의 문서 |
|------|------|------|--------------|-----------|
| `INTERNAL_ERROR` | 내부 서버 에러 | 예상하지 못한 서버 에러. 5xx 기본 코드 | "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) |
| `SERVICE_UNAVAILABLE` | 서비스 불가 | 의존 서비스에 접근할 수 없음. 발행처는 [미결 사항](#미결-사항) 참조 | "서비스를 일시적으로 사용할 수 없습니다." | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) |
| `DATABASE_ERROR` | DB 에러 | 데이터베이스 연결·쿼리 실패. 발행처는 [미결 사항](#미결-사항) 참조 | "데이터 처리 중 오류가 발생했습니다." | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) |
| `RATE_LIMITED` | 요청 빈도 제한 | 요청 빈도 제한 초과. 429 기본 코드 | "요청이 너무 많습니다. {retry_after}초 후 다시 시도해 주세요." | [HTTP API 규약](CLE-API-CONV.md) |

### 6.2 인증·인가

| 코드 | 이름 | 설명 | HTTP | 정의 문서 |
|------|------|------|------|-----------|
| `AUTH_REQUIRED` | 인증 필요 | 토큰 없음. 401 기본 코드. 현재 구현은 만료된 액세스 토큰도 코드 없이 거부해 이 코드가 나간다 | 401 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) |
| `TOKEN_EXPIRED` | 토큰 만료 | 리프레시 토큰 단순 만료. 재사용 감지와 달리 세션 무효화·이력 기록 없이 거부한다(Rationale "`TOKEN_EXPIRED` 설명") | 401 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) |
| `TOKEN_INVALID` | 토큰 무효 | 변조·형식 에러, refresh 토큰이 없거나 소유자가 없음, 또는 refresh 회전 때 조건부 폐기가 0건과 맞음(같은 토큰을 동시에 회전하는 경합) | 401 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md), [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) |
| `FORBIDDEN` | 권한 없음 | 역할 권한 부족(일반). 403 기본 코드 | 403 | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) |
| `ADMIN_REQUIRED` | 관리자 권한 필요 | 워크스페이스 소유자·관리자 역할이 필요할 때 쓰는 `FORBIDDEN` 의 맥락 특화 코드. `RolesGuard` 의 `@Roles('admin')` 미달, `WorkspacesService.assertAdmin()`, `IntegrationsService` 의 조직 통합 변경 판정이 발행한다 | 403 | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md), [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) |
| `EDITOR_REQUIRED` | 편집자 권한 필요 | 편집자 이상 역할이 필요할 때 쓰는 `FORBIDDEN` 의 맥락 특화 코드(`RolesGuard` 의 `@Roles('editor')` 미달) | 403 | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |
| `OWNER_REQUIRED` | 소유자 권한 필요 | 소유자만 하는 동작을 소유자가 아닌 멤버가 요청함. 가드(`@Roles('owner')` 미달)와 서비스 계층(소유자 이양 재검증, 관리자 역할 규칙)이 함께 내고 메시지는 발행처마다 다르다 | 403 | [워크스페이스와 멤버 「가드 거부 에러 코드」](../CLE-ACCT/CLE-ACCT-WS.md#가드-거부-에러-코드), [워크스페이스와 멤버 「관리자 역할 규칙」](../CLE-ACCT/CLE-ACCT-WS.md#관리자-역할-규칙) |
| `LOGIN_FAILED` | 로그인 실패 | 잘못된 자격 증명 | 401 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `ACCOUNT_LOCKED` | 계정 잠김 | 로그인 시도 초과(5회 실패 시 10분). `UnauthorizedException` 이다(Rationale "423 오기 정정") | 401 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `NOT_A_MEMBER` | 워크스페이스 비멤버 | 대상 워크스페이스 멤버십 검증 실패. `RolesGuard` 의 멤버십 거부(헤더 위조, 경로 워크스페이스, 없는 워크스페이스를 구분하지 않고 요구 역할과도 무관)와 전환(`/api/auth/workspaces/:id/switch`)·탈퇴·멤버십 확인 경로(`auth.service`, `workspaces.service`)가 발행한다 | 403 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md), [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) |

`NOT_A_MEMBER`·`EDITOR_REQUIRED`·`ADMIN_REQUIRED`·`OWNER_REQUIRED` 는 가드 거부 코드(guard rejection codes)다. 가드 거부에 전용 코드를 쓰게 된 결정은 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#가드-거부에-에러-코드를-붙인다) 의 「가드 거부에 에러 코드를 붙인다」 Rationale(2026-09-25)에 있고 403 응답 설명에 싣는 규칙은 [OpenAPI 문서화](CLE-API-SWAGGER.md) 의 새 엔드포인트 체크리스트에 있다. 이 가운데 `NOT_A_MEMBER`·`ADMIN_REQUIRED`·`OWNER_REQUIRED` 는 가드를 통과한 뒤 서비스 계층에서도 난다. 서비스 계층은 같은 뜻의 거부에 가드와 같은 코드를 쓴다. 예외는 초대 모듈이다. 초대 모듈(`WorkspaceInvitationsService`)의 서비스 계층 두 번째 방어선은 비멤버와 관리자 미만 멤버를 모두 §3 의 소문자 `admin_required` 로 거부한다. 초대 라우트는 가드가 먼저 `NOT_A_MEMBER` · `ADMIN_REQUIRED` 로 거부하므로 이 코드는 HTTP 로 나가지 않는다.

### 6.3 2FA·WebAuthn·계정 재인증·비밀번호 재확인 (도메인 문서 참조)

2FA(TOTP, WebAuthn/Passkey), 계정 재인증, 비밀번호 재확인 흐름이 함께 쓰는 코드다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `WEBAUTHN_DISABLED` | 503 | WebAuthn 기능이 꺼져 있을 때(환경 변수 미설정이고 폴백을 허용하지 않음) WebAuthn 엔드포인트 전체가 돌려준다 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `WEBAUTHN_VERIFY_FAILED` | 400 | WebAuthn credential 등록 검증 실패 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `INVALID_OPTIONS_TOKEN` | 400 | WebAuthn register·verify 의 optionsToken(짧은 수명의 서명 토큰) 무효 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `CHALLENGE_INVALID` | 401 | WebAuthn authenticate·options 의 challengeToken(mfa_challenge JWT) 검증 실패 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `WEBAUTHN_INVALID` | 401 | WebAuthn 로그인 2FA 검증 실패. counter 역행도 포함하며 세부는 `login_history.failure_reason=WEBAUTHN_COUNTER_REGRESSION` 에 남는다 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `RECOVERY_CODE_INVALID` | 401 | WebAuthn 복구 코드로 2FA 통과 실패 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `REAUTH_NOT_AVAILABLE` | 403 | 비밀번호 해시도 2FA 도 없는 OAuth 전용 계정이라 계정 재인증 수단이 없음. 이메일 변경과 로그인 세션 강제 종료의 재인증이 함께 쓴다 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) |
| `REAUTH_REQUIRED` | 400 | 계정 재인증 자격 증명이 없거나 부족함(비밀번호와 TOTP 어느 것도 검증할 수 없음) | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) |
| `PASSWORD_INVALID` | 401 | 비밀번호 재확인 **불일치**. 계정 재인증(`verifyReauth`), 2FA 비활성화·Passkey 복구 코드 재발급의 재확인(`verifyPasswordForUser`), 비밀번호 변경이 함께 쓴다 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) |
| `PASSWORD_REQUIRED` | 401 | 비밀번호가 **설정되지 않았거나(OAuth 전용) 입력되지 않음**. 2FA 비활성화·Passkey 복구 코드 재발급 같은 민감 동작의 `verifyPasswordForUser` 재확인과 비밀번호 변경이 함께 쓴다. 불일치는 형제 코드 `PASSWORD_INVALID` 다. 계정 재인증의 입력 누락 `REAUTH_REQUIRED`(400, `verifyReauth`)와는 발행 헬퍼도 상태 코드도 다른 별개 코드다 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `TOTP_INVALID` | 401 | TOTP 코드 불일치. 계정 재인증, 로그인 2FA, 2FA 켜기 확인, 2FA 비활성화(`POST /api/auth/2fa/disable`)가 함께 쓴다. 로그인 2FA 와 2FA 비활성화는 6자리 TOTP 코드나 TOTP 복구 코드를 받고 둘 다 맞지 않으면 이 코드다. 2FA 비활성화는 2FA 가 켜져 있지 않을 때도 이 코드를 낸다 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md), [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `TOTP_NOT_ENABLED` | 401 | 로그인 2FA 챌린지(`AuthService.loginWithTotp`)에서 계정의 2FA 가 꺼져 있거나 사용자가 없음. 로그인 2FA 챌린지 전용이고 클라이언트는 다시 로그인하게 안내한다. 2FA 비활성화에서 2FA 가 꺼져 있을 때는 이 코드가 아니라 `TOTP_INVALID` 다 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `TOTP_NOT_INITIALIZED` | 400 | 2FA 켜기 확인(`TotpService.verifyAndEnable`)에서 사용자가 없거나 TOTP secret 이 없음. 설정(`setup`)을 거치지 않고 확인을 부른 경우다 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |

- 이 표는 도메인 문서 본문에 문서화된 코드만 등재한다.
- 로그인 실패 자체는 `LOGIN_FAILED`(§6.2)로 돌려준다(`PASSWORD_INVALID` 아님). 감사 기록은 `login_history` 의 `event`(`totp_failed` 등 소문자 값)와 `failure_reason`(`TOTP_INVALID`, `INVALID_PASSWORD` 등 대문자 사유값)에 남는다([계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md)). 사유값은 응답 코드가 아니다. 알 수 없는 이메일로 로그인하면 `failure_reason` 은 `USER_NOT_FOUND` 이고 응답은 `LOGIN_FAILED`(401)다(`auth.service.ts`).
- **비슷한 이름 주의**: 비밀번호 재확인 계열 에러 코드는 셋이다(`PASSWORD_INVALID`, `PASSWORD_REQUIRED`, `REAUTH_REQUIRED`). 옛 `INVALID_PASSWORD` 는 2026-09-02 에 은퇴해 응답에 나가지 않는다(§5).
- **2FA 비활성화**: `POST /api/auth/2fa/disable` 의 인증 코드 실패는 새 코드 없이 `TOTP_INVALID`(401)를 쓴다. 확인 순서, 복구 코드 소비, 로그인 이력에 남기지 않는 규칙은 [가입과 로그인 「TOTP 끄기」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#totp-끄기) 가 정한다.

### 6.4 유효성 검증

| 코드 | 설명 | HTTP | 정의 문서 |
|------|------|------|-----------|
| `VALIDATION_ERROR` | 요청 데이터 유효성 실패. 400 기본 코드. 발행 지점이 정해진 경우(`X-Workspace-Id` 형식 에러)는 아래 별도 행이다. 요청 본문의 참조 id 가 요청자의 워크스페이스나 같은 워크플로우 밖을 가리킬 때도 이 코드와 `details[].code='INVALID_FIELD'` 배열을 싣는다 | 400 | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md), [데이터 모델 개요 §참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) |
| `PAYLOAD_TOO_LARGE` (요청 본문) | 요청 본문이 body-parser 한도를 넘음. 전역 기본 100KB, `/api/hooks/*` 인증 웹훅 1MB(`createHooksBodyParsers`). `GlobalExceptionFilter` 가 body-parser 의 413 을 표준 봉투로 바꾼다. `message` 는 내부 원문(`"request entity too large"` 등)을 싣지 않고 고정 문구 `"Request payload too large."` 만 돌려준다. 공개 웹훅의 32KB 추가 제한은 별도 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(§6.10) | 413 | [HTTP API 규약](CLE-API-CONV.md) 의 「6. HTTP 상태 코드」, [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) |
| `PAYLOAD_TOO_LARGE` (multipart 업로드) | 업로드 파일이 `FileInterceptor` 의 `limits.fileSize` 를 넘음(아바타 2MB, 지식 저장소 문서 50MB). Nest 가 multer 의 `LIMIT_FILE_SIZE` 를 `PayloadTooLargeException` 으로 바꾸고 `GlobalExceptionFilter` 가 상태 코드로 이 코드를 채운다. `message` 는 고정 문구가 아니라 multer 원문 `"File too large"` 다 | 413 | [내 프로필 「아바타」](../CLE-ACCT/CLE-ACCT-PROFILE.md#아바타), [HTTP API 규약](CLE-API-CONV.md) 의 「9. 파일 업로드」 |
| `FILE_REQUIRED` | 업로드 요청에 파일이 없거나 내용이 비어 있음(`file?.buffer?.length` 가 0). 확장자 불허(`INVALID_FILE_TYPE`)와 다른 코드다. 클라이언트가 취할 행동이 다르기 때문이다("파일을 고르세요" 와 "다른 형식으로 바꾸세요"). 메시지 문자열 파싱이 금지돼 있으므로 코드로 갈라야 분기할 수 있다. 현재 발행처는 아바타 업로드다 | 400 | [내 프로필](../CLE-ACCT/CLE-ACCT-PROFILE.md) |
| `INVALID_FILE_TYPE` | 확장자가 허용 목록에 없음. 지식 저장소 문서 업로드와 아바타 업로드가 함께 쓰고 허용 목록은 도메인마다 정한다(지식 저장소 `txt`·`md`·`pdf`·`csv`, 아바타 `png`·`jpg`·`jpeg`·`webp`·`gif`, SVG 제외) | 400 | [지식 저장소 관리](../CLE-KB/CLE-KB-MANAGE.md), [내 프로필](../CLE-ACCT/CLE-ACCT-PROFILE.md) |
| `WORKSPACE_ID_REQUIRED` | 워크스페이스 컨텍스트가 **없음**. `X-Workspace-Id` 헤더도 JWT `activeWorkspaceId` 클레임(옛 `workspaceId`)도 없다(`workspace.decorator.ts` 발행). 헤더가 있으나 형식이 깨진 경우는 아래 `VALIDATION_ERROR` 행이며 다른 경우다 | 400 | [워크스페이스와 멤버 「`X-Workspace-Id` 형식 검사」](../CLE-ACCT/CLE-ACCT-WS.md#x-workspace-id-형식-검사) |
| `VALIDATION_ERROR` | **`X-Workspace-Id` 형식 에러**. 헤더가 있으나 canonical UUID 형태(8-4-4-4-12 hex)가 아니면 일찍 거부한다. `RolesGuard` 와 `@WorkspaceId()` 가 함께 쓰는 헬퍼(`resolveRequestWorkspaceContext`) 한 곳에서 throw 한다(반환 플래그로 두면 두 경로의 응답이 갈라진다). 일찍 거부하지 않으면 그 값이 멤버십 조회까지 흘러가 `QueryFailedError`(SQLSTATE 22P02)가 되고 500 `INTERNAL_ERROR` 로 가려진다. **JWT 클레임은 검증하지 않는다.** 서버가 서명한 값이라 거기서 400 을 내면 서버 버그를 클라이언트 에러로 보고하게 된다. 검증을 경로 파라미터보다 느슨하게 하는 근거는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#x-workspace-id-헤더는-경로-파라미터보다-느슨하게-검사한다) 의 「`X-Workspace-Id` 헤더는 경로 파라미터보다 느슨하게 검사한다」 Rationale | 400 | [워크스페이스와 멤버 「`X-Workspace-Id` 형식 검사」](../CLE-ACCT/CLE-ACCT-WS.md#x-workspace-id-형식-검사) |
| `INVALID_TRIGGER_PARAMETERS` | 수동 트리거 parameters 스키마 검증 실패. **세 엔드포인트가 함께 쓴다**: 주 실행(`POST /workflows/:id/execute`), 저장(`POST /workflows/:id/save`, `validateManualTrigger`), 재실행의 `inputOverride`(`POST /executions/:id/re-run`). 셋 다 `resolveTriggerParameters` 가 던지는 같은 검증 실패를 감싸므로 같은 코드를 낸다. 필드별 사유는 `details[]`(§4.2, §6.10). 경로별로 `RERUN_` prefix 를 붙이지 않는 것은 의도다. 세 경로를 하나로 모으는 것이 이 코드가 있는 이유다 | 400 | [수동 트리거 노드](../CLE-NODE-TRIG/CLE-NODE-MANUAL.md), [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) |
| `MODEL_CONFIG_INVALID` | 모델 설정 입력 검증 실패. 알 수 없는 `kind`, 필수 프로바이더의 apiKey 누락, 사설망·loopback baseUrl(사설망 차단, tei·local 제외) 등. `model-config.service.ts`, `model-config.controller.ts`, `llm-preview.service.ts`(preview-models) 발행 | 400 | [모델 설정](../CLE-AI/CLE-AI-MODELS.md), [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |
| `RESOURCE_NOT_FOUND` | 리소스 없음. 404 기본 코드 | 404 | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) |
| `ALERT_RULE_NOT_FOUND` | 알림 규칙 없음. 워크스페이스 범위 안에서 규칙 id 를 찾지 못함. `alerts.service.ts` 가 `where: { id, workspaceId }` 로 조회하므로 다른 워크스페이스 규칙에 접근해도 같은 404 다(존재 누설 방지, `MODEL_CONFIG_NOT_FOUND` 의 종류 간 차단과 같은 형태) | 404 | [알림](../CLE-OBS/CLE-OBS-NOTIFY.md) |
| `MODEL_CONFIG_NOT_FOUND` | 지정한 id 의 모델 설정이 없거나 다른 종류(kind)에 접근해 차단됨(존재 누설 방지). id 지정 경로와 `resolveEmbedding` 의 워크스페이스 기본값 부재(지식 저장소 임베딩 설정 부재 = 리소스 부재)에 쓴다. `RESOURCE_NOT_FOUND` 의 모델 설정 특화 코드(`model-config.service.ts` 발행) | 404 | [모델 설정](../CLE-AI/CLE-AI-MODELS.md) |
| `MODEL_CONFIG_DEFAULT_MISSING` | id 를 지정하지 않았는데 워크스페이스 기본 설정이 없음(설정 안내용). `resolveConfig` 의 chat/LLM 기본값 경로 전용이다. `resolveEmbedding` 의 기본값 부재는 `MODEL_CONFIG_NOT_FOUND`(404)를 쓴다(사용자 결정 2026-06-12) | 400 | [모델 설정](../CLE-AI/CLE-AI-MODELS.md) |
| `USER_NOT_FOUND` | 대상 사용자가 없음. `RESOURCE_NOT_FOUND` 의 사용자 특화 코드다. 사용자 API(`users.service.ts`, `users.controller.ts`), 알림 설정(`notifications.service.ts`), TOTP · Passkey(`totp.service.ts`, `webauthn.service.ts`), 멤버 직접 추가의 가입하지 않은 이메일(`workspaces.service.ts`)이 발행한다. 초대 모듈의 소문자 `user_not_found`(§3)와 별개 코드다. 로그인 감사값 `failure_reason='USER_NOT_FOUND'` 와는 문자열만 같다(§6.3) | 404 | [내 프로필](../CLE-ACCT/CLE-ACCT-PROFILE.md), [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md), [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |
| `WORKSPACE_NOT_FOUND` (관리 경로) | 멤버 · 관리자 · 소유자 검사를 통과한 뒤 대상 워크스페이스 행이 없음(`workspaces.service.ts`). 사실상 동시 삭제 경합에서만 난다. `RESOURCE_NOT_FOUND` 의 워크스페이스 특화 코드다. 초대 모듈의 소문자 `workspace_not_found`(§3)와 별개 코드다 | 404 | [워크스페이스와 멤버 「워크스페이스를 찾지 못할 때」](../CLE-ACCT/CLE-ACCT-WS.md#워크스페이스를-찾지-못할-때) |
| `WORKSPACE_NOT_FOUND` (토큰 검증) | 액세스 토큰은 유효한데 사용자가 쓸 워크스페이스가 하나도 없음(`jwt.strategy.ts`). 한 코드가 두 상태로 쓰이는 점은 [미결 사항](#미결-사항) 에 있다 | 401 | [워크스페이스와 멤버 「워크스페이스를 찾지 못할 때」](../CLE-ACCT/CLE-ACCT-WS.md#워크스페이스를-찾지-못할-때) |
| `RESOURCE_CONFLICT` | 리소스 충돌(이름 중복 등). 409 기본 코드 | 409 | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) |
| `DUPLICATE_NODE_LABEL` | 노드 라벨 중복. `RESOURCE_CONFLICT` 의 노드 라벨 특화 코드(`nodes.service.ts` 와 캔버스 일괄 저장 경로의 `workflows.service.ts` 발행) | 409 | [워크플로우 데이터와 저장 흐름](../CLE-WF/CLE-WF-DATA.md) |
| `RESERVED_VARIABLE_NAME` | 변수 선언·변수 수정 노드의 변수 이름이 시스템 예약 `__` prefix 로 시작함(`variables.__*` 는 엔진 시스템 네임스페이스). **이 행은 저장 시점(L0)만 다룬다.** `saveCanvas`·`importWorkflow` 가 `details.offenders[]` 와 함께 HTTP 400 을 낸다(`restoreVersion` 은 옛 데이터 탈출구라 면제). 저장을 우회한 리터럴은 엔진 사전 검증(L1)에서 `INVALID_NODE_CONFIG` 가 된다. 표현식이 예약 이름으로 평가되는 런타임(L2)은 HTTP 와 무관하다. 핸들러가 `RESERVED_VARIABLE_NAME:` 메시지 prefix 로 throw 해 노드 실패로 기록되지만 구조화 `error.code` 는 없다 | 400 (저장) / 없음 (런타임) | [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md), [변수 선언 노드](../CLE-NODE-LOGIC/CLE-NODE-VARDECL.md), [변수 수정 노드](../CLE-NODE-LOGIC/CLE-NODE-VARSET.md) |
| `WORKFLOW_VERSION_CONFLICT` | 캔버스 동시 저장 경합. 같은 워크플로우 버전 번호 unique 위반을 감지해 재시도 권고와 함께 돌려준다(`workflow-versions.service.ts` 발행) | 409 | [버전 기록](../CLE-WF/CLE-WF-VERSION.md) |
| `INVALID_STATE` | 상태 전이 불가(이미 실행 중인 워크플로우 삭제 등). 422 기본 코드. 표면별 같은 뜻 코드는 §6 머리말 | 422 | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md), [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |

**`X-Workspace-Id` 세 갈래**: 같은 헤더 하나가 세 갈래로 갈린다.

1. 헤더와 클레임이 **둘 다 없음**: `WORKSPACE_ID_REQUIRED`(400)
2. 헤더가 **있으나 형식이 깨짐**: `VALIDATION_ERROR`(400)
3. 헤더 **형식은 맞으나 비멤버**: `RolesGuard` 의 `NOT_A_MEMBER`(403)

(2)와 (3)의 경계가 곧 UUID 검증 강도 비대칭이다([워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#x-workspace-id-헤더는-경로-파라미터보다-느슨하게-검사한다) 의 「`X-Workspace-Id` 헤더는 경로 파라미터보다 느슨하게 검사한다」 Rationale). **적용 범위**: (1)과 (2)는 `@Roles()` 나 `@WorkspaceId()` 를 쓰는 인증 라우트에서만 생긴다. 둘 다 없는 워크스페이스 무관 전역 라우트는 `RolesGuard` 가 헤더를 읽기 전에 통과시키므로(`handlerConsumesWorkspaceId` 단축) 형식이 깨진 헤더가 실려도 400 이 아니라 무시된다. 프론트엔드 `apiClient` 가 모든 요청에 이 헤더를 습관처럼 붙이기 때문에 필요한 예외다. 단서가 둘 있다. 경로 파라미터로 워크스페이스를 받는 라우트(`@WorkspaceParam(...)`)는 `@WorkspaceId()` 를 함께 쓸 때만 헤더를 본다. 경로로 받는 워크스페이스가 없는 `@Roles()` 라우트에서 헤더와 클레임이 모두 없으면 (1)이 아니라 가드의 코드 없는 403(기본 코드 `FORBIDDEN`)이 된다. 라우트별 범위의 정본은 [워크스페이스와 멤버 「`X-Workspace-Id` 형식 검사」](../CLE-ACCT/CLE-ACCT-WS.md#x-workspace-id-형식-검사) 다.

### 6.5 워크플로우 실행: 엔진 수준

엔진 수준 에러다. 실행 상태가 `failed` 가 된다.

**이 표는 한 곳에 모여 등재된 코드를 뜻하지 않는다.** 앵커가 셋으로 갈린다. `ErrorCode` const(`EXECUTION_TIME_LIMIT_EXCEEDED`), `EngineErrorCode` const(`WORKER_HEARTBEAT_TIMEOUT`), 에러 클래스의 `readonly code`(`ERROR_PORT_FALLBACK`)다. 나머지 7종은 앵커 없는 맨 문자열이라 오탈자가 `tsc` 를 통과한다. 다른 모듈(`shadow-workflow.ts` 의 union, `execution-failure-classifier.ts` 의 목록)에도 같은 이름이 나오지만 그것은 소비자·분류기 쪽 어휘이지 엔진 발행 경로의 앵커가 아니다.

| 코드 | 앵커 | 설명 | 정의 문서 |
|------|------|------|-----------|
| `EXECUTION_TIMEOUT` | 없음 | Code 노드 스크립트 실행 타임아웃(엔진 수준. 실행 `failed`, EIA `execution.failed.error.code`). 노드 출력 층의 `CODE_TIMEOUT`, 누적 실행 시간 초과와의 구분은 §4.1 | [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md) |
| `EXECUTION_TIME_LIMIT_EXCEEDED` | `ErrorCode` | 실행 하나의 **누적 active-running 시간** 초과(wall-clock 아님, 입력 대기 시간 제외). 실행 `failed` | [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) |
| `WORKER_HEARTBEAT_TIMEOUT` | `EngineErrorCode` | 활성 세그먼트 job 이 BullMQ stalled 재배달(`maxStalledCount=1`) 시도를 다 씀(워커 최종 실패). 실행 `failed`. 2026-07-04 구현. 부팅 시 `recoverStuckExecutions` 재구동은 이 코드를 쓰지 않는다(재구동 불가는 `RESUME_CHECKPOINT_MISSING`). 이름의 경위는 §3 | [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `RECURSION_DEPTH_EXCEEDED` | 없음 | 서브 워크플로우 재귀 깊이 초과. 발행 형태는 [미결 사항](#미결-사항) 참조 | [워크플로우 호출 노드](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md) |
| `MAX_ITERATIONS_EXCEEDED` | 없음 | Loop 노드 최대 반복 횟수(`maxIterations`, 기본 1000) 초과 | [Loop 노드](../CLE-NODE-LOGIC/CLE-NODE-LOOP.md) |
| `CYCLE_DETECTED` | 없음 | 워크플로우 그래프에 순환 감지 | [실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md) |
| `INVALID_EXPRESSION` | 없음 | 표현식 평가 실패 | [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) |
| `VARIABLE_NOT_FOUND` | 없음 | 참조한 변수가 없음 | [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) |
| `TYPE_MISMATCH` | 없음 | 데이터 타입 불일치 | [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) |
| `ERROR_PORT_FALLBACK` | 클래스 `readonly code` | 에러 포트로 보내려 했으나 연결된 연결선이 없어 Stop Workflow 로 폴백 | [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) |

**취소로 끝나는 시스템 코드**(위 `failed` 표와 구분한다). 둘 다 실행이 `cancelled`, `cancelledBy='timeout'` 으로 끝나고 `error.code` 로 원인을 가른다. §6.7 의 `RESUME_*` 와 같은 취소 귀결 부류다.

| 코드 | 설명 | 정의 문서 |
|------|------|-----------|
| `EXECUTION_QUEUE_WAIT_TIMEOUT` | 동시 실행 제한 때문에 intake 큐에서 기다리던 실행이 5분(환경 변수 `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`, 기본 `300000`ms)을 넘김. 노드가 한 번도 시작되지 않은 시스템 취소라 `failed` 가 아니라 `cancelled` 다. 구현됨(advisory lock 입장 게이트의 큐 대기 초과 마감) | [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md), [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `WEBCHAT_IDLE_TIMEOUT` | 공개 웹채팅(`auth_config_id IS NULL`, 실행 단위 토큰)의 입력 대기 실행이 발급된 모든 인터랙션 토큰의 영구 만료와 유예 시간을 넘김. 사용자가 떠나 이어갈 수 없는 세션을 회수하는 backstop 이다 | [External Interaction API 「공개 위젯의 방치된 입력 대기 회수」](../CLE-IX/CLE-EIA.md#공개-위젯의-방치된-입력-대기-회수), 같은 문서의 「공개 위젯 회수 신호는 토큰 만료다」 Rationale |

### 6.6 워크플로우 실행: 노드 수준 런타임

노드 핸들러가 `output.error.code` 로 에러 포트에 싣는 코드다(에러 포트 동작은 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md)). 정식 목록은 `ErrorCode` enum 이고 주요 항목은 아래와 같다.

| 부류 | 코드 | 정의 문서 |
|----------|------|-----------|
| HTTP | `HTTP_TRANSPORT_FAILED` · `HTTP_4XX` · `HTTP_5XX` · `HTTP_TIMEOUT`(발행하지 않음, 아래) · `HTTP_BLOCKED`(사설망 차단, 모든 인증 방식 공통) | [HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md) |
| Database | `DB_QUERY_FAILED` · `DB_CONNECTION_ERROR` · `DB_CONSTRAINT_VIOLATION` · `DB_PERMISSION_DENIED` · `DB_HOST_BLOCKED`(host 가 사설·loopback 이라 사설망 차단. 기본 켬, `ALLOW_PRIVATE_HOST_TARGETS` 로 끔) | [Database Query 노드](../CLE-NODE-INT/CLE-NODE-DBQUERY.md) |
| Email | `EMAIL_SEND_FAILED`(`details.integrationCode` 에 원래 코드 `INTEGRATION_INCOMPLETE`·`INTEGRATION_TYPE_MISMATCH`·`INTEGRATION_NOT_CONNECTED` 를 보존) · `EMAIL_HOST_BLOCKED`(host 가 사설·loopback 이라 사설망 차단. 기본 켬, `ALLOW_PRIVATE_HOST_TARGETS` 로 끔) | [Send Email 노드](../CLE-NODE-INT/CLE-NODE-EMAIL.md) |
| LLM | `LLM_CALL_FAILED` · `LLM_RATE_LIMIT` · `LLM_RESPONSE_INVALID` · `LLM_TIMEOUT`(발행하지 않음, 아래) · `MAX_COLLECTION_RETRIES_EXCEEDED`. LLM 클라이언트 층 코드는 §6.17 | [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md), [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) |
| Code 노드 | `CODE_EXECUTION_FAILED` · `CODE_TIMEOUT` · `CODE_MEMORY_LIMIT`(isolate 메모리 하드 리밋 초과, 기본 128MB, `CODE_NODE_MEMORY_LIMIT_MB` 로 조정) | [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md) |
| 서브 워크플로우 | `SUB_WORKFLOW_FAILED` · `SUB_WORKFLOW_NOT_FOUND` · `SUB_WORKFLOW_TIMEOUT` · `SUB_WORKFLOW_QUEUE_FAILED` · `WORKFLOW_FORBIDDEN_WORKSPACE` | [워크플로우 호출 노드](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md) |
| 노드 취소 | `AbortError` (§3 예외 등록 코드) | [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) |

- **`HTTP_TIMEOUT` 은 발행하지 않는다.** enum 에는 있지만 HTTP Request 핸들러는 타임아웃 때 `AbortController.abort()` 로 fetch 를 멈추고 그 reject 를 다른 전송 에러와 함께 `HTTP_TRANSPORT_FAILED` 로 발행한다(`http-request.handler.ts`). 그래서 `output.error.code` 로 `HTTP_TIMEOUT` 이 보이는 경로는 없다. 앞으로 세분화할 여지와 방어적 매핑을 위해 enum 과 분류 표에 코드를 남긴다.
- **`LLM_TIMEOUT` 도 발행하지 않는다.** enum 에는 있지만 AI 에이전트 경로는 LLM 타임아웃을 재시도 가능한 `LLM_CALL_FAILED` 로 분류하고([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)) LLM 클라이언트의 `withTimeout` 도 전용 코드로 옮기지 않는다([LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md)). enum 에 남길지는 [미결 사항](#미결-사항)이다.
- 옛 코드 `NODE_EXECUTION_FAILED`·`INTEGRATION_ERROR`·`LLM_ERROR` 는 노드 출력에 더 이상 쓰지 않는다. 노드 실패가 Stop Workflow 로 격상된 엔진 수준에서만 `NodeExecution.error.message` 맥락으로 남는다.
- 채팅 채널 어댑터는 이 enum 으로 사용자 안내 메시지를 고른다([채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md)). enum 을 늘리면 분류 표에 행을 더할지 함께 검토한다.
- **워크스페이스 격리 가드 `WORKFLOW_FORBIDDEN_WORKSPACE`**: 다른 워크스페이스(또는 호출자 컨텍스트 누락)의 서브 워크플로우 호출을 막는다(fail-closed). `assertSameWorkspace` 가 typed `WorkflowForbiddenWorkspaceError` 를 던지고 서브 워크플로우 핸들러(`mapSubWorkflowError`)가 이를 `ErrorCode.WORKFLOW_FORBIDDEN_WORKSPACE` 로 바꿔 에러 포트(`output.error.code`)에 싣는다.

### 6.7 WebSocket 명령: 재개 명령과 마지막 턴 재시도 (도메인 문서 참조)

주로 WebSocket ack 에 싣는 코드다. 일부(`SERVER_SHUTTING_DOWN`, `EXECUTION_ENQUEUE_FAILED`)는 HTTP 진입점에서 503 으로 쓴다(진입점은 행마다 적는다). `EXECUTION_ENQUEUE_FAILED` 는 ack 에 싣지 않고 HTTP 진입점에서만 쓴다. 설계 원칙은 [실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md) Rationale 의 `SERVER_SHUTTING_DOWN` 503 선례다. 적용 명령 범위와 ack 형태는 [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) 이 정한다.

| 코드 | 설명 | 정의 문서 |
|------|------|-----------|
| `INVALID_EXECUTION_STATE` | 실행이 기대한 상태가 아님(재개 명령 넷은 입력 대기, `retry_last_turn` 은 `failed` 를 기대). 동기 ack 응답이고 BullMQ 에 넣지 않는다 | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md), [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `INVALID_BUTTON_ID` | 존재하지 않는 버튼 ID(`click_button`) | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `INTERACTION_TIMEOUT` | 이미 타임아웃이 발생한 상태 | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `VALIDATION_ERROR` (ack) | `submit_form` 의 필드 검증 실패. ack 는 평면 `errorCode` 이고 필드별 `details[]` 가 없다. EIA REST 의 `400 VALIDATION_ERROR` 와 같은 뜻, 같은 검증 지점이다 | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `EXECUTION_MESSAGE_TOO_LONG` | `submit_message` 메시지가 최대 길이(10000자)를 넘음. 발행 쪽 동기 검증(typed `MessageTooLongError`) | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md), [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `EXECUTION_INTERNAL_ERROR` | 재개 처리 중 typed `ExecutionError` 가 아닌 내부 에러의 일반 fallback. ack `error` 는 고정 일반 문자열이고 내부 메시지는 클라이언트에 보내지 않는다(서버 로그 전용) | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md), [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `RESUME_CHECKPOINT_MISSING` | rehydration 때 재개에 필요한 영속 상태가 없거나 손상됨(예: `NodeExecution.outputData`, 중첩 재개의 호출 스택 frame). 실행이 `cancelled` 로 끝난다. ack 가 아니라 뒤따르는 `execution.cancelled` 의 `error.code` 로 알린다 | [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `RESUME_FAILED` | 재개 큐의 `RESUME_BULLMQ_ATTEMPTS` 소진. 실행이 `cancelled` 로 끝난다. 뒤따르는 `execution.cancelled` 의 `error.code` 로 알린다 | [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `RESUME_INCOMPATIBLE_STATE` | 멀티턴 AI 의 `_resumeCheckpoint` 가 없음(기능 배포 전에 들어간 대기 행), 손상됨(스키마 변경으로 재구성 실패), 미래 버전임(`schemaVersion` 이 현재 코드가 지원하는 버전보다 큼. 롤링 배포 중 옛 인스턴스가 새 형식을 가져간 경우). 실행이 `cancelled` 로 끝나고 채널에는 "세션 만료" 안내를 보낸다. 정상 경로(checkpoint 가 있고 버전이 호환)는 재구성해 재개하므로 생기지 않는다 | [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `RETRY_STATE_NOT_FOUND` | `retry_last_turn` 대상 행의 `_retryState` 가 없거나 만료됨(TTL 초과 또는 다른 재시도가 이미 소비) | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `NODE_NOT_RETRYABLE` | 대상 노드가 재시도 가능한 에러로 끝나지 않음(`outputData.output.error.details.retryable === false`, 정상 종결, 조건 종결 등) | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `RETRY_TOO_EARLY` | `outputData.output.error.details.retryAfterSec` 카운트다운이 끝나기 전에 호출함(서버 쪽 강제) | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `SERVER_SHUTTING_DOWN` | 서버가 SIGTERM 을 받은 뒤 새 실행을 시작할 수 없음. HTTP 진입점은 503 | [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `EXECUTION_ENQUEUE_FAILED` | 입력 대기 실행에 보내는 취소와 재개 명령(REST `POST /executions/:id/stop`, External Interaction API `/interact` 의 재개 명령 4종과 `cancel`)에서 재개 메시지 발행(BullMQ `queue.add`) 자체가 실패함. `publish` 가 `queued:false`(Redis 장애 등으로 큐에 들어가지 못함)를 돌려준 경우다. HTTP 진입점은 503 이고 실행은 입력 대기 상태를 유지한다(`failed` 아님). 다시 시도를 권한다. 이 코드를 내는 HTTP 진입점은 REST `stop` 과 토큰으로 인증한 External Interaction API 호출(`/interact`, 별칭 `POST .../cancel`)이다. 내부 신뢰 호출(`in_process_trusted`, 채팅 채널 인바운드)의 재개 명령은 이 코드를 내지 않는다([채팅 채널 「인바운드 HTTP 응답 계약」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약)). EIA REST 의 503 은 멱등 캐시에 넣지 않는다(§6.9). WebSocket 재개 명령 4종은 이 코드를 싣지 않는다. 같은 발행 실패는 `errorCode` 없는 실패 ack(`success:false`)로 알린다. `SERVER_SHUTTING_DOWN` 503 선례와 같은 형태이고 큐에 들어간 뒤 재개가 실패하는 워커 쪽 비동기 실패(`RESUME_*`)와 구분한다 | [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md#발행-결과와-ack-에러-표면), [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md#인바운드-명령과-재개) |

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
| `TOO_MANY_CONNECTIONS` | 429 | 실행당 SSE 동시 연결 상한 초과. 429 기본 `RATE_LIMITED` 와 별개인 EIA SSE 전용 코드 | | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) |

`VALIDATION_ERROR`(`submit_form` 필드 검증), `EXECUTION_NOT_FOUND`(404), `TOKEN_INVALID`·`TOKEN_EXPIRED`(401), `EXECUTION_ENQUEUE_FAILED`(503, §6.7)는 표준 코드를 그대로 다시 쓴다(EIA 전용 아님). `EXECUTION_ENQUEUE_FAILED` 는 입력 대기 실행에 보낸 `/interact` 명령(재개 명령 4종과 `cancel`, 별칭 `POST .../cancel` 포함)이 재개 큐에 들어가지 못했을 때(`queued:false`) 낸다. 이 503 은 멱등 캐시(2xx·409·410)에 넣지 않으므로 같은 멱등 키로 다시 보내면 새로 처리한다. `/interact` 의 빈도 제한 초과는 `RATE_LIMITED`(429)다.

### 6.10 웹훅 수신 (도메인 문서 참조)

웹훅 수신 엔드포인트(`POST /api/hooks/:endpointPath`) 전용 코드다.

| 코드 | HTTP | 설명 | 상태 | 정의 문서 |
|------|--------|------|------|-----------|
| `INVALID_WEBHOOK_PAYLOAD` | 400 | required 트리거 파라미터 누락이나 타입 변환 실패. 400 기본 `VALIDATION_ERROR` 대신 쓰는 웹훅 도메인 코드 | 구현 | [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| `PUBLIC_WEBHOOK_RATE_LIMIT` | 429 | 공개 웹훅(`auth_config_id IS NULL`)의 IP 단위(IP 를 식별하지 못하면 공유 버킷 `UNIDENTIFIED_IP_BUCKET`) 분당 시작 한도 초과(`PublicWebhookThrottleGuard`, 기본 분당 10) | 구현 | [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| `PUBLIC_WEBHOOK_HOURLY_LIMIT` | 429 | 공개 웹훅 IP 단위(또는 공유 버킷) 시간당 누적 신규 한도 초과(`PublicWebhookThrottleGuard`·`PublicWebhookQuotaService`, 기본 20) | 구현 | [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| `PUBLIC_WEBHOOK_BODY_TOO_LARGE` | 413 | 공개 웹훅 요청 본문이 32KB(`DEFAULT_MAX_BODY_BYTES`, 설정 `publicWebhook.maxBodyBytes`)를 넘음(`PublicWebhookThrottleGuard`) | 구현 | [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| `AUTH_FAILED` | 401 | 웹훅 인증 실패. 인증 방식과 무관하게 한 응답으로 돌려준다(열거 공격·정보 노출 차단). `is_active=false` 인증 설정, 인증 설정을 트리거의 워크스페이스에서 찾지 못함([데이터 모델 개요 「저장된 교차 행 점검」](../CLE-PLAT/CLE-PLAT-DATA.md#저장된-교차-행-점검)), 서명·토큰 불일치, `ip_whitelist` 불일치가 모두 같은 코드다 | 구현 | [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| `TRIGGER_NOT_FOUND` | 404 | 엔드포인트 경로에 맞는 웹훅 트리거가 없음. 트리거의 워크플로우가 트리거의 워크스페이스에 없을 때도 같은 코드다(채팅 채널 트리거는 `202` ignored). 새 코드를 두지 않은 이유는 [Rationale](#trigger_not_found-를-다른-워크스페이스의-워크플로우에도-쓰는-이유-2026-10-05) 에 있다 | 구현 | [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| `TRIGGER_INACTIVE` | 410 | 트리거가 비활성. 처음부터 없는 404 와 구분한다. 채팅 채널 트리거는 예외로 `202` 와 `{ executionId: 'ignored' }` 를 돌려준다. `410` 에는 기본 코드가 없어 코드를 명시한다([에러 응답과 클라이언트 처리](CLE-API-ERROR.md)) | 구현 | [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) |

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
| `AUTH_CONFIG_NOT_FOUND` | **400** | `authConfigId` 가 호출자 워크스페이스의 인증 설정이 아님(없거나 다른 워크스페이스 소속. 존재 여부 노출을 막으려고 구분하지 않는다). `details: { field: 'authConfigId', code: 'INVALID_FIELD' }` 를 함께 싣는다 | [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) |

- **이름은 `_NOT_FOUND` 지만 404 가 아니다. 이 저장소에서 유일한 예외다.** 다른 `*_NOT_FOUND` 는 모두 404 이고 이 상태 일관성을 위해 코드를 쪼갠 선례도 있다(`MODEL_CONFIG_NOT_FOUND` 404 와 `MODEL_CONFIG_DEFAULT_MISSING` 400).
- 400 인 근거: 다른 워크스페이스 참조는 리소스 부재가 아니라 입력값 유효성 문제다. 그래서 `details.field='authConfigId'` 로 필드를 지목하고 `BadRequestException` 으로 던진다.
- 이름을 바꾸거나 404 로 바꿀지는 소비자 분기에 영향을 주는 별도 결정이며 후속 작업으로 등재돼 있다.
- 특화 코드와 일반 `details[].code` 를 함께 싣는 것이 "겹쳐 쓰지 않는다" 에 걸리지 않는 근거는 [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) 의 판별 기준이다.

### 6.15 채팅 채널 봇 토큰 재발급 (도메인 문서 참조)

`POST /api/triggers/:id/chat-channel/rotate-bot-token` 의 실패 응답이다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `INVALID_BOT_TOKEN` | **400** | `newBotToken` 이 없거나 문자열이 아님(컨트롤러 입력 검증) | [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) |
| `CHAT_CHANNEL_NOT_CONFIGURED` | **400** | `config.chatChannel` 이 설정되지 않은 트리거 | [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) |
| `CHAT_CHANNEL_PROVIDER_UNKNOWN` | **400** | registry 에 등록되지 않은 provider | [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) |
| `CHAT_CHANNEL_ENDPOINT_REQUIRED` | **400** | 트리거 `endpointPath` 없음 | [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) |
| `BOT_TOKEN_INVALID` | **400** | `setupChannel` 이 **자격 증명 거부**로 실패함. provider 가 `401`·`403`, `{ok:false,error:'invalid_auth'}`(HTTP 200), `verify_key` 불일치 중 무엇으로 알리든 같은 분류다. 판별은 어댑터가 선언한다([채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md)) | [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) |
| `CHAT_CHANNEL_SETUP_FAILED` | **502** | 그 밖의 `setupChannel` 실패(provider 5xx, 네트워크, 타임아웃). 이 저장소의 첫 502 다(근거: [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 의 「R-CC-23 setupChannel 실패는 전송 방식이 아니라 원인으로 분류한다」 Rationale) | [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) |

- **이름이 두 갈래라 헷갈리기 쉽다.** `INVALID_BOT_TOKEN`(입력 형식이 틀렸다)과 `BOT_TOKEN_INVALID`(provider 가 거부했다)는 어순만 다르고 뜻이 다르다. 합치거나 바꾸지 않는 이유는 §2 와 같다. 둘 다 이미 응답에 나갔고 프론트엔드 백엔드 라벨 매핑(`backend-labels.ts`)이 각각을 매핑한다.
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
| `LLM_RATE_LIMIT` | 429 (프로바이더 응답) | 프로바이더 속도 제한. 지수 백오프로 최대 3회 다시 시도한다(`withRetry`) | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |
| `LLM_CONNECTION_ERROR` | 없음 | 위에 해당하지 않는 모든 클라이언트 호출 실패의 기본값(인증 실패, 모델 없음, 컨텍스트 초과 포함) | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |
| `LLM_OUTPUT_MALFORMED` | 없음 | gpt-oss 계열 harmony 제어 토큰 노출(OpenAI 스트리밍 경로). 사용자에게는 안내문으로 바꿔 보인다 | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |
| `LLM_CREDENTIALS_REQUIRED` | 400 | 미리보기 요청에서 local 이 아닌 프로바이더의 apiKey 누락 | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |
| `LLM_MODEL_LIST_FAILED` | 400 | 미리보기나 `:id/models` 호출 중 프로바이더 응답 실패. 정리한 메시지를 보인다 | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |
| `LLM_STREAMING_UNSUPPORTED` | 없음 | 스트리밍을 지원하지 않는 프로바이더에 `stream()` 호출 | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |

세분화 코드 `LLM_AUTH_ERROR`(401), `LLM_MODEL_NOT_FOUND`(404), `LLM_CONTEXT_EXCEEDED`(400)는 계획이며 미구현이다. 지금은 `LLM_CONNECTION_ERROR` 로 모인다.

### 6.18 워크스페이스·로그인 세션 관리 (도메인 문서 참조)

도메인 문서가 상태 코드와 함께 적은 코드만 등재한다. 설명 끝의 "현재 구현" 은 도메인 문서가 상태 코드를 구현 근거로 적은 코드다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `CANNOT_REVOKE_CURRENT_SESSION` | 400 | 단일 세션 강제 종료(`POST /api/auth/sessions/:familyId/revoke`)로 현재 요청의 refresh 토큰 쿠키와 맞는 세션 family 를 끝내려 함(자기 세션 종료 차단). 로그아웃을 쓰게 안내한다 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md), [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) |
| `OAUTH_STATE_MISMATCH` | 400 | OAuth state 가 없거나 만료·소비됐거나 provider 가 다름. 로그인 콜백에서는 URL 신호 `invalid_state`(§3)로 바뀐다. 통합 OAuth 도 같은 코드를 쓴다 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md), [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) |
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

## 미결 사항

- **발행처가 없는 등재 코드**: `SERVICE_UNAVAILABLE`·`DATABASE_ERROR`(§6.1)는 백엔드에서 발행처가 확인되지 않는다(grep 0건). 초대 흐름의 소문자 `rate_limited`(§3)도 백엔드·프론트엔드 소스에 문자열이 0건이다. 초대 한도는 `@Throttle` 로 걸리고 전역 필터가 429 를 `RATE_LIMITED` 로 바꾼다([HTTP API 규약](CLE-API-CONV.md)). 초대 에러 표에서 뺄지는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#미결-사항) 의 같은 미결과 함께 정한다. 규칙 9 는 발행된 적 없는 코드의 등재를 지우라고 정하지만 이 판단은 코드 실측에 기대므로 등재를 지울지 결정이 필요하다. 정리는 NERV Task `CLE-T-8WXV7T` 에서 한다.
- **카탈로그에 아직 없는 통합 도메인 코드**: `INTEGRATION_*`, `OAUTH_CONFIG_MISSING`, `INSUFFICIENT_SCOPE`, `CAFE24_*` 등은 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) 의 API 에러 절에만 있고 이 카탈로그에 없다. 도메인 참조 절로 옮겨 등재할지 결정이 필요하다. 발행하는데 행이 없는 코드의 정리는 NERV Task `CLE-T-5BZ3M2` 에서 한다.
- **`LLM_TIMEOUT` 을 enum 에 남길지**: 어느 경로도 발행하지 않는다(§6.6). [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 는 이 enum 의 사용처·범위 정리를 이 문서 소관으로 넘겼다. `HTTP_TIMEOUT` 처럼 남길지 enum 에서 뺄지 결정이 필요하다. [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md) 는 스트리밍 턴 타임아웃에 이 코드를 약속한다. 그 약속은 [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md#미결-사항) 의 LLM 호출 타임아웃 기준 미결과 함께 정한다. 정리는 NERV Task `CLE-T-8WXV7T` 에서 한다.
- **`RECURSION_DEPTH_EXCEEDED` 의 발행 형태**: 카탈로그는 이 코드를 등재하지만 [워크플로우 호출 노드](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md) 는 재귀 깊이 초과를 코드 없이 메시지 `Maximum recursion depth exceeded (limit: 10)` 로 throw 한다고 적는다. 코드를 붙일지 카탈로그에서 뺄지 결정이 필요하다. 정리는 NERV Task `CLE-T-8WXV7T` 에서 한다.
- **가이드 식별자 실재 가드의 소유**: `PROJECT.md` 는 가이드가 인용한 에러 코드·환경 변수가 코드에 실재하는지 보는 가드(`guide-identifier-existence`)의 기준 문서로 이 규약을 지목한다. 원문 규약에는 가이드 인용 규칙도 이 가드도 없어 여기 싣지 않았다. 어느 문서가 이 가드를 소유할지는 [사용자 가이드 근거 규약](../CLE-ENG/CLE-ENG-GUIDEEVIDENCE.md#미결-사항) 의 미결에서 정한다.
- **`WORKSPACE_NOT_FOUND` 의 두 상태**: 워크스페이스 관리 경로는 이 코드를 404 로 내고 액세스 토큰 검증은 401 로 낸다(§6.4). 404 는 대상 워크스페이스가 없다는 뜻이고 401 은 사용자에게 쓸 워크스페이스가 하나도 없다는 뜻이다. 401 경로에 별도 코드를 줄지는 NERV Task `CLE-T-3P4ENZ` 에서 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#미결-사항) 의 같은 미결과 함께 정한다. 결정 필요.

## 구현 위치

- `codebase/backend/src/nodes/core/error-codes.ts` (`ErrorCode`, `EngineErrorCode` 자매 const)
- `codebase/backend/src/nodes/data/code/code.handler.ts` (`LEGACY_TO_NORMALIZED`)
- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` (`toTriggerParameterErrorDetails`)
- `codebase/backend/src/modules/websocket/ws-error-codes.ts` (`WsErrorCode`)
- `codebase/backend/src/common/constants/workspace-roles.ts` (가드와 서비스가 함께 쓰는 거부 본문). 상수 이름은 TS 이름이고 응답의 에러 코드가 아니다. `NOT_A_MEMBER` 는 코드 `NOT_A_MEMBER` 를 낸다. `ROLE_REQUIRED` 는 요구 역할별 본문 표이고 `EDITOR_REQUIRED` · `ADMIN_REQUIRED` · `OWNER_REQUIRED` 를 낸다(`viewer` 는 `NOT_A_MEMBER` 와 같은 본문). `ADMIN_ROLE_CHANGE_REQUIRES_OWNER` 는 코드 `OWNER_REQUIRED` 를 관리자 역할 규칙의 문구로 낸다

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

이 코드의 행은 처음에 REST `POST /executions/:id/stop` 의 입력 대기 취소만 적었다. EIA `/interact` 의 `cancel` 과 그 별칭 `POST .../cancel` 도 같은 `ExecutionsService.stop` 을 불러 이미 이 코드를 냈다. 지금 코드에서 재개 명령 4종은 발행 결과(`queued`)를 보지 않고 202 `accepted:true` 를 낸다. 이 202 는 24시간 멱등 캐시에 들어간다. 그러면 같은 멱등 키로 다시 보내도 캐시된 202 가 돌아오고 명령은 끝내 재개 큐에 들어가지 못한다. 그래서 재개 명령 4종도 `cancel` 과 같이 503 `EXECUTION_ENQUEUE_FAILED` 로 응답하게 정했다. 이 결정은 사용자에게 묻지 않고 기본값으로 정해 알린 뒤 진행했다(2026-10-09). 503 은 멱등 캐시 대상(2xx·409·410)이 아니므로 다시 보내면 새로 처리한다. 반영은 NERV Task `CLE-T-M6PERB` 이고 코드도 같은 Task 에서 고친다. 승인 직후 같은 Task 에서 코드와 미러를 한 PR 로 내기로 해서(사용자 결정, 2026-10-09) 이 문서의 행에는 `(미구현)` 을 붙이지 않았다. 이 전제가 깨져 코드가 같은 PR 에 들어가지 못하면 이 행과 같은 Task 가 고친 요구사항 줄에 `(미구현)` 을 붙이는 초안을 다시 낸다. 결정 이력은 그 Task 의 결정 기록에 있다.

- **새 코드를 만들지 않았다.** 조건의 뜻이 REST `stop` 과 같다. 두 경우 모두 발행 자체가 실패했고 실행은 입력 대기에 남는다. 클라이언트가 할 일도 다시 보내기 하나다. 그래서 규칙 6 의 새 조건이 아니다.
- **표면마다 코드를 나누지 않았다.** §6 머리말은 같은 뜻이라도 표면마다 다른 코드를 쓴다고 적는다. 그러나 EIA `cancel` 은 REST `stop` 과 같은 서비스 메서드를 부르므로 이 코드는 이미 두 표면에서 나가고 있었다. 재개 명령에 EIA 전용 코드를 주면 `/interact` 한 표면 안에서 같은 조건이 두 코드로 갈린다.
- **WebSocket 재개 명령은 바꾸지 않았다.** 이 경로의 발행 실패는 `errorCode` 없는 실패 ack(`success:false`)로 바로 돌아간다. ack 는 요청마다 한 번 보내는 응답이라 어디에도 저장하지 않는다. 그래서 클라이언트는 실패를 보고 다시 보낼 수 있다. EIA REST 는 2xx 응답을 멱등 캐시에 넣으므로 실패를 2xx 로 알리면 재시도로 바로잡을 수 없다. 이 차이 때문에 EIA REST 만 HTTP 상태 코드(503)로 실패를 알린다.
- **내부 신뢰 호출은 이 코드를 내지 않는다.** 채팅 채널 인바운드는 서버 안에서 내부 신뢰 호출(`in_process_trusted`)로 같은 재개 명령을 부른다. 이 경로가 503 을 던지면 웹훅을 보낸 채널 프로바이더에게 5xx 가 나간다. 그 응답은 [채팅 채널 「인바운드 HTTP 응답 계약」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약) 이 따로 정한다. 그래서 503 은 HTTP 진입점의 응답으로 한정했다. 이 범위는 사용자에게 묻지 않고 기본값으로 정해 알렸다.
- **승인 전 초안 두 편의 WebSocket 서술은 코드와 다르다.** [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) 과 [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 은 승인 전 초안이다. 두 문서는 WebSocket 재개 명령의 `queued:false` 를 성공 ack 의 필드로 적는다. 코드(`websocket.gateway.ts`)는 `queued:false` 일 때 실패 ack(`success:false`)를 보낸다. 이 카탈로그는 코드를 따랐다. 두 문서의 정정은 NERV Task `CLE-T-EMB0YG` 가 맡는다.
- **이 코드를 만든 근거가 넓어졌다.** [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 의 Rationale 「발행 실패를 `queued:false` 하나로 알린다 (C-1·M-7)」 은 취소가 WebSocket ack 경로가 아니라 REST 중지 진입점이라서 이 코드로 표기한다고 적는다. 이 코드는 이미 `/interact` 의 `cancel` 에서 나갔고 이번 결정으로 재개 명령 4종에도 쓴다. ack 가 아닌 HTTP 진입점이라는 근거는 `/interact` 에도 그대로 맞는다. «REST 중지 진입점» 으로 좁힌 그 서술의 정정도 `CLE-T-EMB0YG` 가 맡는다.

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
