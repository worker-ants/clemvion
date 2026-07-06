---
id: error-codes
status: implemented
code:
  - codebase/backend/src/nodes/core/error-codes.ts
---

# 에러 코드 명명 규약 (Conventions)

## Overview

에러 코드(`error.code`)의 **명명·안정성 규율**만 정의한다. 책임 경계:

- **카탈로그·분류·트리거**: [`5-system/3-error-handling.md §1`](../5-system/3-error-handling.md) (SoT).
- **응답 봉투(envelope) 형식**: [`5-system/3-error-handling.md §2.1`](../5-system/3-error-handling.md) ·
  [`5-system/2-api-convention.md §5.3`](../5-system/2-api-convention.md#53-에러-응답) (SoT).
- **HTTP 상태 코드 선택**: [`5-system/2-api-convention.md §6`](../5-system/2-api-convention.md);
  swagger 데코레이터 패턴은 [`swagger.md §2-4`](./swagger.md).
- **표기(`UPPER_SNAKE_CASE`)**: [`3-error-handling.md §3.2`](../5-system/3-error-handling.md) ·
  [`node-output.md §3.2`](./node-output.md) (SoT). 본 문서는 재선언하지 않는다.

본 문서가 **유일하게 소유**하는 것: ① 의미 기반 명명 원칙, ② rename 안정성 정책,
③ historical-artifact 예외 레지스트리.

**적용 범위**: 본 규율은 `code:` 의 `ErrorCode` enum(`codebase/backend/src/nodes/core/error-codes.ts` —
명명이 중앙화된 **대표 surface**)뿐 아니라 **프로젝트 전체의 에러 코드 문자열**에 적용된다 — API·통합·
OAuth 등에서 인라인 문자열 리터럴로 발행되는 코드(`CAFE24_*`, `OAUTH_*` 등)를 포함한다.

## 1. 의미 기반 명명 (핵심 원칙)

에러 코드 이름은 **조건의 의미(무엇이 잘못되었는가)** 를 기술한다. 구현 세부·전이적 맥락
(어느 코드 경로에서 났는지, 도입 당시의 일시적 범위)을 이름에 박지 않는다.

- **의미를 기술**: `CAFE24_INSTALL_INVALID_HMAC`(HMAC 검증 실패), `INTEGRATION_INCOMPLETE`(통합 미완성),
  `OAUTH_STATE_MISMATCH`(state 불일치). 이름만으로 분기 의미가 드러난다.
- **구현·역사를 박지 않음**: 코드가 리팩토링·범위 확장되어도 이름이 거짓이 되지 않게 한다.
- **클라이언트 계약**: 클라이언트(프론트엔드·통합 사용자)는 **코드의 의미로 분기**하며 이름 토큰 부분
  문자열을 파싱하지 않는다. 코드의 *정의(spec 본문)* 가 진실이고 이름은 그 정의를 읽히게 하는 라벨이다.

**도메인 prefix (권장)**: 도메인 범주화가 의미 있는 코드는 `<DOMAIN>_<CONDITION>` 으로 그룹화한다
(`CAFE24_*`, `OAUTH_*`, `INTEGRATION_*`). 단 `VALIDATION_ERROR` 처럼 **시스템 전역 공용 코드**
([`3-error-handling.md §1.1·§1.3`](../5-system/3-error-handling.md))는 prefix 없이 쓰는 기존 카테고리로,
원칙 위반 예외가 아니라 별개 범주다.

> **prefix-less 공용 코드 — `INVALID_TOOL_ARGUMENTS`**: AI Agent 의 tool_use 인자 검증 실패 코드
> ([`11-mcp-client.md §8.2`](../5-system/11-mcp-client.md#82-에러-코드-vocabulary))는 `MCP_` prefix 를
> 붙이지 않는다 — MCP 전용이 아니라 **AI Agent 의 모든 tool provider 경로에서 공유**되는 LLM 인자
> 검증 category 이기 때문이다(`VALIDATION_ERROR` 와 동류). LLM 이 `tool_result.error` 로 이 값을 보고
> 다음 turn 에 인자를 보정하므로 코드 값이 곧 계약이며, `MCP_INVALID_TOOL_ARGUMENTS` 로의 rename 은
> breaking(§2)일 뿐 의미 이득이 없다. 따라서 prefix-less 유지가 정답이며 domain-prefix 원칙 위반이 아니다.

## 2. 안정성 / rename 정책

- **에러 코드 rename 은 breaking change 다** — 클라이언트가 코드 값으로 분기하므로 deprecated alias·
  이중 발행·마이그레이션 부담이 발생한다.
- 이름 정확성 향상만을 위한 rename 은 **하지 않는다**. 의미가 분기되거나 새 조건이 생기면 **새 코드를 신설**한다.
- 신규 코드는 **처음부터 의미 정확한 이름**을 부여해 후속 rename 압력을 만들지 않는다.

## 3. Historical-artifact 예외 레지스트리

원칙(§1)을 따르지 않는 기존 코드를 명시적으로 등록한다. 신규 코드는 예외를 선례로 삼지 않는다.

| 코드 | HTTP | 이름이 부정확한 이유 | 진실(의미) | 근거 |
|---|---|---|---|---|
| `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` | 409 | `PRIVATE` 토큰은 historical artifact — 신설 당시 Private 한정이었으나 app_type 무관으로 확장 | 동일 `(workspaceId, mall_id)` 에 cafe24 Integration 중복 | [`4-integration.md` Rationale "CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드명 유지 결정"](../2-navigation/4-integration.md#rationale) |
| `invitation_not_found` · `invitation_expired` · `invitation_already_used` · `invitation_email_mismatch` · `forbidden` · `rate_limited` | 404/410/400/403/429 | `lower_snake_case` — §1 `UPPER_SNAKE_CASE` 위반. 워크스페이스 초대 흐름 v1 출하 시 이 형태로 정착, 프론트(`invitations.ts` `INVITATION_ERROR_CODES`)·백엔드(`workspace-invitations.service.ts` / `auth.service.ts`)가 `code` 값으로 분기 → rename = breaking(§2) | 초대 토큰 부재/만료/사용됨/이메일 불일치/권한 부족/rate-limit. **초대 API 한정** — 본 `forbidden`/`rate_limited` (lowercase) 는 초대 흐름 전용 historical artifact 로, 다른 영역의 `UPPER_SNAKE_CASE` 범용 코드와 별개다 | [`1-auth.md §1.5.4`](../5-system/1-auth.md#154-에러-응답) |
| `workspace_type_mismatch` · `already_a_member` · `invitation_already_pending` · `invitation_already_accepted` | 403/409/409/409 | `lower_snake_case` — §1 `UPPER_SNAKE_CASE` 위반. 위 초대 토큰 코드와 **같은 모듈**(`workspace-invitations.service.ts`)이 발행하는 초대 발급·재발송 흐름 코드로 동일 lowercase 컨벤션으로 정착. 프론트는 이 4종에 `code` 분기 없이 `message` 만 표시하나(`workspace/settings/page.tsx`), 정규화 시 같은 모듈의 다른 lowercase 코드(`workspace_not_found` 등)와 mixed-case 를 유발하고 호환 이득이 0이라 모듈 일관성 보존을 위해 lowercase 유지(2026-06-28 결정) | non-team 워크스페이스에 초대 시도 / 이미 멤버 / 동일 이메일 대기 초대 경합(partial UNIQUE) / 이미 수락된 초대 재발송·취소(revoke). **초대 발급·재발송·취소(revoke) API 한정** — `already_a_member`·`workspace_type_mismatch` 는 직접 추가 경로(§1.9)가 발행하는 UPPER_SNAKE `ALREADY_A_MEMBER`·`WORKSPACE_TYPE_MISMATCH` 와 **별개 코드**다(다른 모듈 `workspaces.service.ts`, 다른 케이스 컨벤션 — 동일 의미·별개 wire 코드로 의도적 분리) | [`12-workspace.md §1.2`](../data-flow/12-workspace.md#12-멤버-초대-발급) · [`§1.8`](../data-flow/12-workspace.md#18-초대-재발송--취소) · [`§1.9`](../data-flow/12-workspace.md#19-멤버-직접-추가-기가입-사용자) |
| `workspace_not_found` · `user_not_found` · `admin_required` | 404/404/403 | `lower_snake_case` — §1 `UPPER_SNAKE_CASE` 위반. 위 두 행과 **같은 초대 모듈**(`workspace-invitations.service.ts`)이 lookup·RBAC 단계에서 발행하는 lowercase 코드로 동일 컨벤션. 모듈 내 lowercase 일관성 보존을 위해 유지(레지스트리 completeness 차원의 등재 — 위 행들과 동일 근거) | 워크스페이스 부재 / 대상 사용자 부재 / admin 미만 권한. **초대 모듈 한정** — `workspace_not_found`·`user_not_found` 는 직접 추가·관리 경로(§1.9, `workspaces.service.ts`)의 UPPER_SNAKE `WORKSPACE_NOT_FOUND`·`USER_NOT_FOUND` 와 **별개 코드**다(다른 모듈·케이스 컨벤션, 의도적 분리) | [`12-workspace.md §1.2`](../data-flow/12-workspace.md#12-멤버-초대-발급) · [`§1.3`](../data-flow/12-workspace.md#13-초대-수락-이미-가입한-사용자) |
| `invalid_state` · `token_exchange_failed` · `email_required` · `server_error` (OAuth callback `?error=`) | — (302 redirect) | `lower_snake_case` — 단 이것은 **응답 봉투의 `error.code` 가 아니라 redirect URL 의 query param 값**이다. 로그인 OAuth callback 이 `{frontend_url}/callback?error=<값>` 으로 프론트에 신호하는 URL-level signal 로 v1 정착, 콜백 페이지가 이 값으로 분기 → rename = breaking(§2) | 소셜 로그인 콜백 실패 사유(state 불일치/코드 교환 실패/이메일 미제공/서버 오류). **로그인 OAuth callback URL 한정** — envelope 코드 체계(§1)와 레이어가 다르며, 통합(Integration) OAuth 의 `OAUTH_*` envelope 코드와도 별개다 | [`10-auth-flow.md §5.4`](../2-navigation/10-auth-flow.md#54-oauth-에러-처리) |
| `WORKER_HEARTBEAT_TIMEOUT` | — (HTTP 무관 — 엔진 레벨 `error.code`, execution `failed`) | "HEARTBEAT" 는 워커가 주기적으로 emit 하는 별도 heartbeat 채널을 암시하나 그런 채널은 **신설하지 않는다**(§7.1). 실제 검출 진화: (PR1~PR2) 부팅 시 절대 30분 stale RUNNING 일괄 fail → (**PR3, 2026-07-04**) 부팅 시 stale RUNNING 을 **fail 이 아니라 §7.5 case B rehydration 으로 re-drive** — 이 부팅 re-drive 경로(`recoverStuckExecutions`)는 이 코드를 **쓰지 않는다**(재구동 불가는 `RESUME_CHECKPOINT_MISSING`, 반복 실패는 §8 `EXECUTION_TIME_LIMIT_EXCEEDED`) → (**PR4 구현, 2026-07-04**) BullMQ stalled-job 재배달(`maxStalledCount=1`) attempts 소진 시 `onFailed → finalizeStalledExhausted` 가 `status='running'` 조건부로 발동. 코드명은 **유지·PR4 재정의 발효** (§7.1·§2.13): "30분 절대 stale" → "stalled 재배달 소진". 코드(`execution-engine.service.ts`)·다수 spec 이 값으로 참조 → rename = breaking(§2) | active 세그먼트 워커의 terminal 실패 → Execution `failed` | [`4-execution-engine.md §7.1`](../5-system/4-execution-engine.md#71-워커-크래시-복구--bullmq-stalled-job-target) · [`3-error-handling.md §1.4`](../5-system/3-error-handling.md#14-워크플로우-실행-에러) |

> §3 은 **부정확한 이름이나 *유지*되는 active 코드**의 예외 등록부다. *교체·은퇴된* 구 코드의 rename 이력은 §5 에 둔다 (목적 레이어가 다르다).

## 4. 내부 전용 분류 코드 (정규화 후 발행)

§3 와 달리 본 절의 코드는 **§1 적용 범위 밖**이다 — 클라이언트에 노출되지 않는 구현 내부 명칭이므로
"명명 위반 artifact" 가 아니다.

다음은 Code 노드 핸들러 내부의 **분류 단계 문자열**이다. `classifyCodeNodeError` 가 산출하지만
**노드의 `output.error.code` 로는 직접 발행되지 않는다** — `LEGACY_TO_NORMALIZED` 표가 발행 직전
public 코드로 정규화한다 (`codebase/backend/src/nodes/data/code/code.handler.ts`). 따라서 노드 출력
계약(§2)에 영향을 주지 않으며, 디버깅 용도로만 `output.error.details.legacyCode` 에 보존된다. 정식
public 코드는 우측 열이다 — 명명 정확성 향상을 위한 internal rename 은 안전(클라이언트 미노출).

| 내부 분류 코드 (legacy) | 정규화 → public 코드 (노드 `output.error.code`) | 의미 | 근거 |
|---|---|---|---|
| `EXECUTION_TIMEOUT` | `CODE_TIMEOUT` | Code 노드 스크립트 wall-clock timeout | [`2-code.md §5.3`](../4-nodes/5-data/2-code.md) |
| `EXECUTION_MEMORY_EXCEEDED` | `CODE_MEMORY_LIMIT` | isolate 메모리 하드 리밋 초과 (기본 128MB, `CODE_NODE_MEMORY_LIMIT_MB` env 조정 가능 — isolated-vm hard-kill) | [`2-code.md §5.3.3`](../4-nodes/5-data/2-code.md) |
| `CODE_RUNTIME_ERROR` | `CODE_EXECUTION_FAILED` | 그 외 사용자 코드 런타임 throw (fallback) | [`2-code.md §5.3.1`](../4-nodes/5-data/2-code.md) |

> **레이어 주의 — `EXECUTION_TIMEOUT` 동명 코드**: 본 표의 `EXECUTION_TIMEOUT` 은 **Code 노드 핸들러
> 내부 분류 레이어** 한정이며 노드 출력으로는 `CODE_TIMEOUT` 으로 정규화된다. 이와 **별개로** 엔진 레벨
> EIA `execution.failed.error.code` 에는 동명 `EXECUTION_TIMEOUT` 이 등장한다
> ([`3-error-handling.md §1.4`](../5-system/3-error-handling.md#14-워크플로우-실행-에러) ·
> [`14-external-interaction-api.md §6.4`](../5-system/14-external-interaction-api.md)). 그 엔진 레벨 코드는
> `LEGACY_TO_NORMALIZED`(노드 출력 정규화) 의 관할이 **아니며** 본 절의 내부 분류 문자열과 레이어가 다르다.
> (엔진 레벨 누적 타임아웃은 또 다른 코드 `EXECUTION_TIME_LIMIT_EXCEEDED` 로 구분된다.)

## 5. Rename 이력 (Retired codes)

§2 의 안정성 정책은 rename 을 breaking change 로 규정한다. 그럼에도 아래 코드는 **소비자가 자사 클라이언트뿐**(프론트엔드가 구·신 코드를 양쪽 매핑)이라 breaking 영향이 없음을 확인한 뒤 교체했다. 구 코드는 더 이상 발행되지 않으며(코드베이스에서 완전 제거), **외부 client 코드에 분기로 노출된 적이 없다**(문서 목록에만 노출됐던 코드는 신규 코드로 동기화). rename 배경 추적용 이력으로만 남긴다.

| 구 코드 | 대체 코드 | HTTP | PR | 비고 |
|---|---|---|---|---|
| `LLM_CONFIG_NOT_FOUND` | `MODEL_CONFIG_DEFAULT_MISSING` | 400 | PR4b | id 미지정 시 워크스페이스 default config 부재 경로 — `resolveConfig`(chat/LLM) 전용. id 부재(404)는 `MODEL_CONFIG_NOT_FOUND` 로 별도 분리. `resolveEmbedding` ws-default 부재도 `MODEL_CONFIG_NOT_FOUND`(404) 유지(리소스 부재, 사용자 결정 2026-06-12) ([3-error-handling.md §1.3 Rationale](../5-system/3-error-handling.md#rationale)) |
| `LLM_CONFIG_INVALID` | `MODEL_CONFIG_INVALID` | 400 | PR4b | 접두어를 `MODEL_CONFIG_*` 로 통일 (LLMConfig→ModelConfig 1급 통합). 의미·status 변경 없음 |
| `WORKSPACE_REQUIRED` | `WORKSPACE_ID_REQUIRED` | 400 | #566 | chat-channel `rotate-bot-token` controller 인라인 코드(`401`)를 공용 `@WorkspaceId()` 데코레이터 canonical(`400`)로 통일 (HTTP status 도 401→400 정정). user-docs 목록에만 노출됐고 client 하드코딩 분기 없음 — breaking 영향 0. 경위 [15-chat-channel.md §R-CC-18](../5-system/15-chat-channel.md#r-cc-18-rotate-bot-token-workspace-검증--공용-workspaceid-데코레이터-통일) |

## Rationale

- **왜 의미 기반인가**: 에러 코드는 클라이언트와의 장기 계약이다. 구현/역사를 이름에 박으면 리팩토링마다
  이름이 거짓이 되거나 rename(breaking) 압력이 생긴다. 의미를 기술하면 코드 경로가 바뀌어도 계약이 안정적이다.
- **왜 rename 대신 신설인가**: rename 의 가독성 이득은 작고(클라이언트는 의미로 분기) 호환성 비용은 크다.
  의미가 실제로 갈라질 때만 새 코드로 분기하는 것이 비용 대비 합리적이다.
- **왜 예외 레지스트리인가**: 완벽한 이름을 소급 강제하면 breaking rename 이 양산된다. 부정확하나 안정적인
  기존 코드는 "예외 + 정의 명확화" 로 흡수하고 규율은 신규 코드에만 적용해 점진적으로 일관성을 높인다.
- **§3 흡수 근거에 "모듈 내 일관성 보존" 도 포함되는 이유**: §2 의 breaking 우려가 없는 코드(client 코드
  분기 0)라도, 그 코드가 이미 lowercase 로 정착한 모듈의 일부라면 일부만 `UPPER_SNAKE` 로 정규화하는 것은
  같은 모듈 안에 mixed-case 를 만들어 **국소 일관성을 오히려 해친다**. 이런 코드는 정규화의 가독성 이득(0,
  client 가 의미로 분기)보다 모듈 일관성 보존 이득이 커서 §5(은퇴) 가 아니라 §3(유지 예외) 로 흡수한다
  (워크스페이스 초대 모듈 lowercase 코드군이 이 기준의 적용 — 프론트 `code` 분기는 없으나 모듈 전체가
  lowercase 라 lowercase 를 유지하고 §3 에 등재, 2026-06-28 결정). 즉 §3 흡수 조건은 "rename 이 breaking
  이다" 와 "rename 이 모듈 일관성을 해친다" 의 합집합이다.
- **왜 SoT 를 분리하는가**: 카탈로그(`3-error-handling.md`)·envelope(`api-convention §5.3`)·HTTP status
  (`api-convention §6`)·표기(`node-output §3.2`)를 각 축으로 분리해 독립 진화시키고, 본 문서는 명명 규율만
  소유해 책임 중복을 피한다.
- **§5 진입 기준이 "client 코드 분기 미존재" 인 이유**: §5(Retired codes)의 판단 기준은 "외부 노출
  여부" 가 아니라 **"외부 client 코드에 그 구 코드로 분기하는 지점이 있었는가"** 다. 코드가 user-docs
  목록 등 문서에만 등장했다면 client 가 그 문자열로 동작 분기를 만들지 않으므로 교체의 breaking impact
  는 0 이고, 문서는 신규 코드로 동기화하면 족하다. 반대로 client 코드에 하드코딩 분기가 있었다면 §2 의
  breaking 정책이 적용돼 §5 흡수가 아니라 신설(§3·§4) 또는 정식 마이그레이션을 거친다. 즉 §5 는
  "노출 0" 이 아니라 "client 분기 0" 을 흡수 조건으로 삼는다 (`WORKSPACE_REQUIRED` 등재가 이 기준의
  첫 적용 — user-docs 노출은 있었으나 client 분기는 없었다).
