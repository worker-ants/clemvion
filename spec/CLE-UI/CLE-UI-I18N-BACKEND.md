---
id: "CLE-UI-I18N-BACKEND"
title: "다국어와 화면 문구 — 백엔드 문구 매핑"
type: "convention"
version: 5
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-UI-I18N"
ancestors: ["CLE-VISION", "CLE-UI", "CLE-UI-I18N"]
area: "CLE-UI"
content_hash: "6322857e4bbe6d6b150f6be673297b43119fc6ce4eb946b62e7daa73e58e3338"
read_as: "approved_fallback"
task: "CLE-T-72BN09"
source_paths: []
mirror_sha256: "e933a83c6e612c60028fdbb808575bd5e4d7ac18a369766bdf3c9bf46b9d8191"
etag: "sha256-a400501553d5c8b0914b83751309a24850ae32fdbad6c586b114d47a6f3521e6"
---
## 개요

이 문서는 [다국어와 화면 문구](CLE-UI-I18N.md) 의 하위 문서로 백엔드가 내보내는 사용자 노출 문자열을 프론트엔드가 지역화하는 규칙(부모 [규칙](CLE-UI-I18N.md#규칙) 3 · 4 · 5 의 세부)을 정한다. 가드는 부모 [자동 가드 요약](CLE-UI-I18N.md#자동-가드-요약), 갱신 의무는 [동반 갱신 규율](CLE-UI-I18N.md#동반-갱신-규율) 에 있다. "규칙 N" 은 부모 규칙 목록의 번호다.

## 백엔드 영문 원문과 정적 매핑 (규칙 3)

백엔드(`codebase/backend/`)가 사용자에게 보이는 응답으로 내보내는 `warningRules[].message` 와 노드 스키마 `label`·`description` 은 영문 원문으로 둔다. 한국어는 프론트엔드 `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 매핑 표(`WARNING_KO`, `NODE_LABEL_KO`, `NODE_DESCRIPTION_KO`)에 등록한다. 이것은 영문 문자열 전체를 키로 쓰는 정적 매핑이다. 정적 문자열 키로 나타낼 수 없는 코드 기반·동적 메시지는 규칙 5 가 다룬다.

- 금지: 백엔드 응답에 한국어를 직접 넣는 것. 지역화할 수 없게 된다.
- 금지: 백엔드만 새 경고 문구(`warningRules[].message`)나 라벨을 내보내고 프론트엔드 매핑을 빠뜨리는 것.
- 매핑이 없으면 `pickKo` 같은 폴백으로 영문이 그대로 보인다. 이것은 의도한 안전장치이지만 매핑 누락은 규칙 위반이다.
- 어시스턴트 SSE `error` 이벤트의 `message` 도 영문 원문이다. 서버는 코드별 고정 영문만 보낸다. 한국어 문구는 프론트엔드가 코드로 고른 `assistant.*` 사전 키에서 온다(규칙 5).
- 매핑 대상이 아닌 값: 트리거의 `chat_channel_last_error` 다. 서버가 저장한 진단 원문을 번역하지 않고 보여 주는 필드다. 자격 증명 모양은 서버가 응답에서 가린다([응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md#310-트리거-응답의-마지막-오류)). 어댑터 에러 메시지와 서버 문구가 섞이고 값이 끼는 문구(`Inbound rate limit exceeded (N/min)`)도 있어 키로 쓸 코드가 없다. 코드로 저장하는 진단 필드는 규칙 5 를 따른다. 화면에는 보이되 번역하지 않는다. 화면은 고정폭 글꼴로 원문임을 드러내고 곁의 안내 문구만 화면 문구 사전을 거친다. 이 면제를 지키는 가드는 없다([진단 원문을 매핑하지 않는 이유](#진단-원문을-매핑하지-않는-이유-2026-10-05)).

## zod ui 메타 매핑 (규칙 4)

백엔드 `*ConfigSchema` 가 `z.toJSONSchema` 로 내보내는 `ui.*` 메타는 그 자체가 사용자에게 보이는 영문이다. AI 에이전트 노드의 `Presentation Tools` 그룹, `Description override`, `Defaults overlay` 라벨이 번역되지 않던 회귀를 막으려고 다음 다섯 키에도 같은 매핑 의무를 둔다.

| 백엔드 `ui` 키(영문 원문) | 프론트엔드 `backend-labels.ts` 매핑 표 |
| --- | --- |
| `ui.label` | `LABEL_KO` |
| `ui.hint` | `HINT_KO` |
| `ui.group` | `GROUP_KO` |
| `ui.itemLabel`(field-array) | `ITEM_LABEL_KO` |
| `ui.options[].label`(select 위젯) | `OPTION_LABEL_KO` |

`ui.placeholder` 도 별도 매핑 표(`PLACEHOLDER_KO`, `translateBackendPlaceholder`)가 있다. 그러나 지금 placeholder 값은 대부분 표현식 예시(`$input.items`, `{{ ... }}`)라 강제 매핑 대상에서 뺀다(`EXCLUDE_VALUE_PREFIXES`). 위 다섯은 빌드에서 강제하고 placeholder 는 폴백만 적용한다.

## 코드와 동적 메시지 매핑 (규칙 5)

일부 백엔드 메시지는 (a) 코드만 안정적이고 메시지는 던지는 자리마다 다르거나(`ErrorCode` enum, `GRAPH_VALIDATION_FAILED`), (b) `Parallel "${node.label}" ... depth > 2` 처럼 실행 중 값을 끼운 동적 문자열이라 문자열 키로 번역할 수 없다. 이 두 부류는 코드나 규칙 ID 를 안정 키로 쓰고, 끼운 값은 따로 받는다.

| 원천(영문 원문) | 키 | 프론트엔드 매핑 표 | 번역 함수 |
| --- | --- | --- | --- |
| API 에러 응답 봉투 코드(`GRAPH_VALIDATION_FAILED` 등), 노드 `output.error.code`(`ErrorCode` enum) | 에러 코드(UPPER_SNAKE) | `ERROR_KO` | `translateBackendError(code, params, locale, fallback)` |
| `graphWarningRules[].message`(노드를 넘는 동적 경고) | 규칙 ID(`ruleId`, 예: `parallel:nested-depth-exceeded`) | `GRAPH_WARNING_KO` | `translateGraphWarning(result, locale)` |
| AI 어시스턴트 SSE `error` 이벤트의 `code`: `ASSISTANT_NO_LLM_CONFIG` · `ASSISTANT_STREAM_FAILED` · `ASSISTANT_TOO_MANY_TOOL_CALLS` · `LLM_RATE_LIMIT` · `LLM_CONNECTION_ERROR` · `LLM_OUTPUT_MALFORMED` · `LLM_STREAMING_UNSUPPORTED`([에러 코드 규약과 카탈로그 §6.25](../CLE-API/CLE-API-ERRCODES.md#625-ai-어시스턴트-스트림-도메인-문서-참조)) | 에러 코드(UPPER_SNAKE) | 어시스턴트 패널 모듈의 `ERROR_MESSAGE_KEYS`(`ReadonlyMap`, 코드 → `assistant.*` 사전 키). 사전 키에는 ko/en 짝이 있다. `ERROR_KO` 에는 올리지 않는다 | `t(key)` |
| 통합 화면 에러 응답 코드(REST 봉투): `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` · `CAFE24_PRIVATE_APP_INSTALL_PENDING` · `MAKESHOP_INSTALL_PENDING` · `EDITOR_REQUIRED` · `ADMIN_REQUIRED` · `INTEGRATION_NAME_TAKEN` · `INTEGRATION_OWNER_NOT_MEMBER`([통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드)) | 에러 코드(UPPER_SNAKE) | `integration-error-codes.ts` 의 `INTEGRATION_ERROR_CODE_TO_I18N`(코드 → `integrations.*` 사전 키). 사전 키에는 ko/en 짝이 있다. `ERROR_KO` 에는 올리지 않는다 | `formatIntegrationErrorToast(err, t, fallbackKey)` |
| 여러 화면이 같은 뜻으로 받는 에러 응답 코드(REST 봉투): 인증 · 세션 · 2단계 · 패스키 코드(`PASSWORD_INVALID` · `SESSION_NOT_FOUND` · `RATE_LIMITED` 등)와 워크스페이스 가드 코드(`NOT_A_MEMBER` · `EDITOR_REQUIRED` · `ADMIN_REQUIRED` · `OWNER_REQUIRED` · `WORKSPACE_NOT_FOUND`) | 에러 코드(UPPER_SNAKE) | `server-error-messages.ts` 의 `SERVER_ERROR_CODE_TO_I18N`(코드 → 사전 키). 사전 키에는 ko/en 짝이 있다. `ERROR_KO` 에는 올리지 않는다 | `serverErrorMessage(err, t, fallback)` |

- **끼워 넣기 계약**: 1행 · 2행의 백엔드는 영문 `message`(원문이자 폴백)와 함께 동적 값을 `params: Record<string, string | number>` 로 보낸다. 그래프 경고는 `GraphWarningRule.evaluate` 의 반환 타입 `{ message, params? }` 가 그 계약이다([그래프 경고 규칙](../CLE-WF/CLE-WF-WARN.md)). 프론트엔드 템플릿은 기존 `core.ts` 의 `interpolate()` 와 `{{name}}` 이중 중괄호를 그대로 쓴다. 새 끼워 넣기 문법을 만들지 않는다. `ERROR_KO` · `GRAPH_WARNING_KO` 에 매핑이 없거나 한국어가 아닌 로케일이면 영문 `message` 로 폴백한다. 3행(어시스턴트)은 `params` 를 쓰지 않는다. 3행에서는 표에 없는 코드만 서버가 보낸 영문 `message` 로 폴백한다. 그 `message` 는 백엔드 문구 표에 있는 코드면 코드별 고정 영문이고 없는 코드면 공통 폴백 문구다([워크플로우 AI 어시스턴트 §에러 처리](../CLE-WF/CLE-WF-ASSIST.md#에러-처리)). 4행(통합 화면)도 `params` 를 쓰지 않는다. 4행이 끼워 넣는 값은 설치 대기 409 의 `details.pendingInstallExpiresAt` 하나다. 그 값이 있으면 화면 시각으로 바꿔 `integrations.retryAfterPendingInstallExpiry` 문구의 `{{expiresAt}}` 에 넣고 사전 문구 뒤에 붙인다. 4행은 표에 있는 코드면 사전 문구 뒤 괄호에 서버 `message` 를 붙인다. 표에 없는 코드면 5행 표의 사전 문구를 고르고 거기에도 없으면 서버 `message` 로 폴백한다. 5행도 `params` 를 쓰지 않는다. 화면이 따로 고르는 문구가 있으면 그것이 먼저이고, 없으면 5행 표의 사전 문구, 표에 없는 코드면 서버 `message`, 응답 본문이 없으면(네트워크 에러 포함) 화면이 넘긴 실패 문구다. 5행은 서버 `message` 를 괄호에 붙이지 않는다.
- **세션 REST 코드**: 어시스턴트 세션 REST API 의 에러 코드(`ASSISTANT_SESSION_*`)는 1행을 따른다. 3행은 SSE `error` 이벤트만 다룬다.
- **도메인별로 표를 나눈다**: 에러 코드(UPPER_SNAKE)와 규칙 ID(`domain:kebab`)는 네임스페이스가 다르다. 한 표에 섞으면 출처 구분과 동등성 가드가 흐려진다. 표시 면이 다른 어시스턴트 SSE 코드도 같은 이유로 따로 둔다. 도메인별로 표를 나눈 기존 방식(`LABEL_KO`, `HINT_KO` …)과 같다.
- **어시스턴트 에러 코드는 `ERROR_KO` 밖에 둔다(2026-10-24)**: 어시스턴트 에러 안내에는 ko/en 문구가 모두 있어야 해서 ko/en 짝이 있는 `assistant.*` 사전 키를 쓴다. 문구는 표시 면마다 하나다. 코드 문자열이 같아도 면이 다르면 표도 다르다. 어시스턴트 코드 가운데 노드 `output.error.code` 와 같은 문자열은 `LLM_RATE_LIMIT` 하나다. 노드 화면용으로 이 코드를 `ERROR_KO` 에 등록하는 것은 따로 허용한다. 그 등록은 어시스턴트 에러 버블의 문구를 바꾸지 않는다. 코드와 사전 키의 대응은 [워크플로우 AI 어시스턴트 §에러 처리](../CLE-WF/CLE-WF-ASSIST.md#에러-처리) 가 정본이다. 근거는 [어시스턴트 에러 코드를 컴포넌트 지역 표로 매핑하는 이유](#어시스턴트-에러-코드를-컴포넌트-지역-표로-매핑하는-이유-2026-10-24) 에 있다.
- **통합 화면 에러 코드도 `ERROR_KO` 밖에 둔다(2026-10-30)**: 통합 화면의 에러 토스트에는 ko/en 문구가 모두 있어야 해서 ko/en 짝이 있는 `integrations.*` 사전 키를 쓴다. 이 표를 읽는 곳은 통합 화면뿐이다. 코드의 뜻과 화면 동작은 [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) 가 정본이다. 근거는 [통합 화면 에러 코드를 통합 화면 모듈의 표로 매핑하는 이유](#통합-화면-에러-코드를-통합-화면-모듈의-표로-매핑하는-이유-2026-10-30) 에 있다.
- **공용 코드 매핑도 `ERROR_KO` 밖에 둔다(2026-11-27)**: 5행 코드는 로그인 · 세션 · 설정 화면처럼 여러 화면이 같은 뜻으로 받는다. 안내에는 ko/en 문구가 모두 있어야 해서 ko/en 짝이 있는 사전 키를 쓴다. 한 화면에서만 다르게 읽어야 하는 코드는 그 화면이 먼저 고른다(로그인 2단계의 `TOTP_INVALID`, 소유자 이양의 `OWNER_REQUIRED`). 근거는 [여러 화면이 같이 받는 코드는 공용 코드 매핑에서 고른다](#여러-화면이-같이-받는-코드는-공용-코드-매핑에서-고른다) 에 있다.
- **5행 폴백에 보이는 서버 `message`**: 5행 표에 없는 코드는 서버 `message` 가 화면에 그대로 보인다. 그래서 5행 화면이 받는 코드의 서버 `message` 는 던지는 자리의 코드별 고정 영문이어야 하고 예외 원문을 넣지 않는다. 처리하지 못한 예외는 전역 필터가 고정 문구로 바꾼다([에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md)). CLE-API-ERROR 는 5xx 를 일반 500 으로 가린다고 정하지만 지금 필터는 `HttpException` 으로 던진 5xx 의 `message` 를 그대로 낸다. 이 갭은 `HttpException` 경로에만 있고 NERV Task `CLE-T-KKJ2A0` 가 메운다.
- **4행 괄호에 붙는 서버 `message`**: 4행 표에 올리는 코드의 서버 `message` 는 코드별 고정 문구여야 한다. 예외 원문, 다른 사용자의 식별자, 통합 ID 를 넣지 않는다. 서버 `message` 에 넣어도 되는 값은 요청자가 그 요청에 넣은 값뿐이고 지금은 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 의 상점 식별자 하나다. 표에 코드를 더할 때 리뷰에서 이 조건을 확인한다. 가드는 없다. 근거는 [통합 화면 에러 토스트는 표에 있는 코드도 서버 `message` 를 괄호에 붙인다](#통합-화면-에러-토스트는-표에-있는-코드도-서버-message-를-괄호에-붙인다-2026-10-30) 에 있다.
- 금지: 백엔드 응답에 한국어를 직접 넣는 것, `Accept-Language` 로 서버에서 지역화하는 것. 규칙 3 의 영문 원문 원칙을 어기고 사전이 둘로 갈린다.
- **알려진 예외: 워크스페이스 · 초대 · 사용자 서비스의 한국어 서버 문구**: `modules/workspaces`(워크스페이스 · 초대 서비스)와 `modules/users` 의 `message` 일부가 아직 한국어다. 바로 위 금지와 규칙 3 에 어긋나는 기존 문구이고 NERV Task `CLE-T-MBMPX5` 가 옮긴다. 워크스페이스 가드와 역할 하한 코드(`NOT_A_MEMBER` · `EDITOR_REQUIRED` · `ADMIN_REQUIRED` · `OWNER_REQUIRED`)와 워크스페이스 관리 경로의 `WORKSPACE_NOT_FOUND` 는 2026-11-27 에 영문 고정 문구로 옮겼다(NERV Task `CLE-T-CHP94Z`, [워크스페이스 가드 「가드 거부 에러 코드」](../CLE-ACCT/CLE-ACCT-WS-AUTHZ.md#가드-거부-에러-코드)). 인증 · 트리거 모듈과 가드 거부 본문은 백엔드 테스트(`server-message-language.spec.ts`)가 한국어 응답 문구를 막는다.
- **의무와 점진의 경계**: 등록된 모든 `GraphWarningRule.id` 는 `GRAPH_WARNING_KO` 매핑과 동적 값 `params` 노출이 의무다(새 규칙을 더하면 같은 변경 안에서). `GRAPH_VALIDATION_FAILED` 의 `ERROR_KO` 매핑도 의무다. `ErrorCode` enum 전체의 `ERROR_KO` 매핑은 한꺼번에 강제하지 않는다. 영문 폴백 상태에서 사용자에게 자주 보이는 순서로 늘린다. 동등성을 강제하는 집합은 셋이다. 그래프 경고 규칙 전체, 사용자 노출용으로 명시 등록한 API 에러 코드 집합, 어시스턴트 SSE `error` 코드 집합(백엔드 문구 표와 `ERROR_MESSAGE_KEYS` 가 같은 코드를 가진다)이다. 통합 화면 에러 코드는 백엔드 코드 집합과의 동등성이 아니라 매핑 완결성만 강제한다. `INTEGRATION_ERROR_CODE_TO_I18N` 에 올린 코드마다 사전 키가 있어야 한다. 백엔드가 통합 화면에 보일 코드를 새로 내도 이 표에 저절로 들어오지 않는다. 5행 공용 코드 매핑은 두 가지를 강제한다. 표에 올린 코드마다 ko/en 사전 키가 있어야 하고, 백엔드 `modules/auth` 가 내는 코드는 표에 있거나 매핑하지 않는 코드 목록에 있어야 한다(`server-error-messages.test.ts`). 그 밖의 코드는 점진 대상이다. `ERROR_KO` 는 `backend-labels.ts` 에 구현돼 있다.
- **정적 매핑 가드와의 경계**: 규칙 3 의 가드(P1-B)는 `*.schema.ts` 의 정적 `warningRules[].message` 만 본다. 동적 `graphWarningRules` 메시지와 에러 코드는 그 가드 밖이다. 이것은 규칙 5 의 가드(P3-C-1, P3-C-2)가 맡는다. 어시스턴트 SSE 코드와 통합 화면 에러 코드를 보는 테스트는 [자동 가드 요약](CLE-UI-I18N.md#자동-가드-요약) 의 5 행에 있다.

## 구현 위치

- `codebase/frontend/src/components/editor/assistant-panel/assistant-message.tsx` (어시스턴트 에러 버블, `ERROR_MESSAGE_KEYS`)
- `codebase/frontend/src/components/editor/assistant-panel/assistant-message-error.test.tsx`
- `codebase/frontend/src/lib/api/integration-error-codes.ts` (통합 화면 에러 코드 매핑, `INTEGRATION_ERROR_CODE_TO_I18N` · `formatIntegrationErrorToast`)
- `codebase/frontend/src/lib/api/__tests__/integration-error-codes.test.ts`
- `codebase/frontend/src/lib/api/server-error-messages.ts` (공용 코드 매핑, `SERVER_ERROR_CODE_TO_I18N` · `serverErrorMessage`)
- `codebase/frontend/src/lib/api/__tests__/server-error-messages.test.ts`
- `codebase/backend/src/repo-guards/__tests__/server-message-language.spec.ts` (영문으로 옮긴 범위의 한국어 응답 문구 가드)
- `codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream-errors.ts` (어시스턴트 SSE `error` 이벤트의 코드별 고정 영문)
- `codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream-errors.spec.ts`

## Rationale

### 백엔드 문자열을 영문 원문으로 두는 이유

백엔드 응답에 한국어를 직접 넣으면 (a) 로케일을 더할 때 백엔드 코드를 한꺼번에 고쳐야 하고, (b) 프론트엔드 다국어 체계와 떨어진 섬이 생기고, (c) 백엔드 테스트가 한국어 문자열에 매달려 회귀 부담이 는다. 영문 원문과 프론트엔드 매핑은 백엔드 코드를 언어와 무관하게 두고, 프론트엔드 사전이 모든 사용자 언어를 한곳에서 관리하게 한다.

### 진단 원문을 매핑하지 않는 이유 (2026-10-05)

`chat_channel_last_error` 는 [채팅 채널 「채널 건강도」](../CLE-CHAT/CLE-CHAT-CORE.md#채널-건강도) 의 원인마다 다른 출처의 문구를 담는다. 어댑터 실패면 그 에러 메시지(프로바이더 응답 포함)이고 그 밖의 원인은 서버가 정한 문구다. 필드 하나에 출처 둘이 섞여 있어 필드 전체를 면제한다. 정적 키로 옮길 수 있는 고정 문구(`Workflow not found for this trigger`)도 같이 면제한다. 규칙 3 의 정적 키로는 프로바이더 메시지와 값이 끼는 문구를 잡지 못한다. 규칙 5 로 옮기려면 서버가 코드와 `params` 를 따로 저장해야 해 동작이 바뀐다. [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-25-워크플로우가-다른-워크스페이스에-있으면-202-ignored-와-degraded-로-답한다) 의 「워크플로우가 다른 워크스페이스에 있으면 202 ignored 와 degraded 로 답한다」 가 이 필드를 «화면에 보이는 필드» 로 보고 고정 문구를 고른 것과는 부딪치지 않는다. 보이되 진단용 원문이라 번역하지 않는다. 저장할 때 원문을 바꾸지 않는 점은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 의 «진단용 필드» 와 같다(시크릿 저장소 평문(봇 토큰)만은 프로바이더 API 클라이언트가 원문을 만들 때 지운다). 트리거 응답은 그 문서의 표면 목록에 있고 자격 증명 모양만 가린다. 화면은 가려진 값을 번역하지 않고 그대로 보여 주며, 화면 안내 문구는 원인을 나열하지 않고 «마지막 오류» 를 가리킨다.

### 어시스턴트 에러 코드를 컴포넌트 지역 표로 매핑하는 이유 (2026-10-24)

[워크플로우 AI 어시스턴트 §에러 처리](../CLE-WF/CLE-WF-ASSIST.md#에러-처리) 의 에러 버블은 SSE `error` 이벤트의 코드로 안내 문구를 고른다. 이 원천은 규칙 5 의 원천 표 3행이다. 매핑은 어시스턴트 패널 모듈의 `ERROR_MESSAGE_KEYS` 와 `assistant.*` 사전 키가 맡는다. 코드와 사전 키의 대응은 그 문서가 정본이다.

규칙 5 의 불변 조건은 그대로 지킨다. 문구는 코드를 키로 고른다. 서버에서 지역화하지 않는다. 사전 키를 쓰므로 규칙 1 · 2 의 사전 경유와 ko/en 동등성 가드도 함께 받는다.

- **표에 없는 코드는 서버 영문으로 폴백한다.** 에러 버블이 비지 않게 하려는 것이다. 서버 `message` 는 코드별 고정 영문이거나 공통 폴백 문구라 예외 원문은 나가지 않는다.
- **기각: 어시스턴트 코드를 `ERROR_KO` 에 더한다.** `ERROR_KO` 에는 한국어 템플릿만 있어 영어 로케일에서는 서버 영문이 보인다. 또 문구는 표시 면마다 하나다(규칙 5 의 「어시스턴트 에러 코드는 `ERROR_KO` 밖에 둔다」). 노드가 내는 LLM 오류 코드는 `LLM_CALL_FAILED` · `LLM_RATE_LIMIT` · `LLM_RESPONSE_INVALID` 이다. `LLM_CONNECTION_ERROR` · `LLM_OUTPUT_MALFORMED` 는 LLM 클라이언트 층의 코드라 노드에서는 `LLM_CALL_FAILED` 로 나타난다([에러 코드 규약과 카탈로그 §6.17](../CLE-API/CLE-API-ERRCODES.md#617-llm-클라이언트-도메인-문서-참조)). 노드 화면용 `ERROR_KO` 등록은 따로 허용한다.
- **기각: `backend-labels.ts` 안에 어시스턴트 전용 표를 둔다.** 이 표를 읽는 곳은 어시스턴트 에러 버블 하나다. 같은 모듈에는 코드로 이어서 진행 버튼을 보일지 정하는 지역 집합 `RESUMABLE_ERROR_CODES` 가 이미 있다. 문구는 표시 면마다 정하므로 그 면의 모듈에 두는 편이 찾기 쉽다.
- **두 표의 코드 집합은 백엔드 테스트가 프론트엔드 리터럴을 읽어 맞춘다(2026-11-12).** 양쪽 테스트가 같은 코드 목록을 따로 적으면 한쪽의 표와 테스트를 함께 고쳤을 때 다른 쪽 테스트가 깨지지 않는다. 그래서 백엔드 테스트(`workflow-assistant-stream-errors.spec.ts`)가 프론트엔드 소스의 `ERROR_MESSAGE_KEYS` 리터럴에서 코드를 뽑아 백엔드 문구 표와 맞춘다. 프론트엔드만 바꾼 변경에서도 이 테스트가 돌도록 그 프론트엔드 파일을 `backend-checks` 의 경로 목록에 올렸고(NERV Task `CLE-T-GXCJAB`) 하네스 테스트(`test_assistant_error_codes_ci_coverage.py`)가 등재를 고정한다. 프론트엔드 테스트(`assistant-message-error.test.tsx`)는 코드마다 사전 문구가 나오는지 따로 본다.
- **대조의 남은 한계.** 백엔드 테스트는 프론트엔드 소스를 문자열로 읽는다. `export const ERROR_MESSAGE_KEYS` 선언 줄에서 시작하는 `new Map([["CODE", "assistant.key"], ...])` 리터럴에서만 코드를 뽑는다. 표 모양을 바꾸면(다른 파일로 옮기기, 객체 리터럴로 바꾸기 등) 추출식도 같은 변경에서 고쳐야 한다. 선언을 못 찾거나 코드를 하나도 뽑지 못하면 테스트는 통과하지 않고 지켜야 할 리터럴 모양을 적어 실패한다. 프론트엔드 테스트의 코드 목록은 여전히 사람이 적고 `ERROR_MESSAGE_KEYS` 와만 맞춘다.
- **기각: 두 패키지가 함께 쓰는 상수 패키지(`codebase/packages/*`)에 코드 집합을 둔다(2026-11-12).** 공유 패키지가 줄 수 있는 것은 코드 집합 하나다. 문구 표는 양쪽에 그대로 남는다(백엔드는 코드별 고정 영문, 프론트엔드는 사전 키). 코드 가운데 셋(`LLM_*`)은 백엔드 LLM 클라이언트 층의 스트림 에러 코드다([LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md#스트리밍-에러-매핑)). 공유 패키지로 옮기면 그 층의 코드 정의가 백엔드 밖으로 나가거나 두 곳에 적힌다. 백엔드 테스트가 이미 한쪽만 바뀐 변경을 잡으므로 그 비용을 들이지 않았다. 대조의 한계가 실제 누락으로 이어지면 다시 본다.
- **규칙 3 과의 관계.** `LLM_OUTPUT_MALFORMED` · `ASSISTANT_TOO_MANY_TOOL_CALLS` 도 다른 코드와 같이 고정 영문을 보낸다. 서버 `message` 의 문구는 [워크플로우 AI 어시스턴트 §에러 처리](../CLE-WF/CLE-WF-ASSIST.md#에러-처리) 가 정한다. LLM 클라이언트 안내문을 코드별 허용 목록으로 통과시키는 안은 기각했다. 그 목록이 `LLM_OUTPUT_MALFORMED` 의 한국어 안내문을 그대로 내보내 규칙 3 과 어긋났기 때문이다.
- **LLM 클라이언트 쪽 정정은 따로 했다.** LLM 클라이언트가 쓰던 `LLM_OUTPUT_MALFORMED` 한국어 안내문과 [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) · [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 의 해당 서술은 NERV Task `CLE-T-V73FFA` 가 2026-11-13 에 고쳤다. 지금 클라이언트는 고정 영문 진단 문장을 싣고 어시스턴트 SSE 는 그 문장을 서버 로그에만 남긴다. 백엔드 응답의 한국어가 하나 줄어 규칙 3 과도 맞는다.
- **함께 승인한다.** 이 개정판과 [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md) · [AI 어시스턴트 스트리밍과 세션 API](../CLE-WF/CLE-WF-ASSIST-PROTO.md) 의 개정판은 NERV Task `CLE-T-MX8PSE` 의 한 변경이라 함께 승인한다.

### 통합 화면 에러 코드를 통합 화면 모듈의 표로 매핑하는 이유 (2026-10-30)

통합 화면(목록 · 추가 · 상세)은 통합 API 의 에러 코드로 에러 토스트 문구를 고른다. 이 매핑(`INTEGRATION_ERROR_CODE_TO_I18N`)은 Cafe24 · MakeShop 설치 코드와 역할 하한 코드를 ko/en 짝으로 바꿔 왔지만 규칙 5 의 원천 표에는 없었다. 이 원천은 규칙 5 의 원천 표 4행이다. 표에는 `INTEGRATION_OWNER_NOT_MEMBER` 와 `INTEGRATION_NAME_TAKEN` 도 들어 있다(NERV Task `CLE-T-PS7JQY`).

- **어시스턴트 예외와 같은 이유다.** 에러 안내에는 ko/en 문구가 모두 있어야 하고 표시 면은 통합 화면 하나다. 사전 키를 쓰므로 규칙 1 · 2 의 사전 경유와 ko/en 동등성 가드도 함께 받는다.
- **기각: 두 코드를 `ERROR_KO` 에 더한다.** `ERROR_KO` 에는 한국어 템플릿만 있어 영어 로케일에서는 서버 영문이 보인다. 같은 토스트 도우미 안에서 이 두 코드만 영어 문구가 서버 영문이 되고 통합 화면의 매핑 경로가 둘이 된다.
- **매핑 완결성은 매핑 단위 테스트와 사전 키 타입이 본다.** `integration-error-codes.test.ts` 가 코드마다 사전 키를 단언한다. 매핑 값의 타입이 `TranslationKey` 라 사전에 없는 키는 타입 검사에서 막힌다. 백엔드가 통합 화면에 보일 코드를 새로 낼 때 이 표를 함께 고치는 일은 가드가 막지 않는다. 표에 없는 코드는 서버 `message` 로 폴백한다.

### 통합 화면 에러 토스트는 표에 있는 코드도 서버 `message` 를 괄호에 붙인다 (2026-10-30)

통합 화면의 에러 토스트는 4행 표에 있는 코드면 사전 문구를 보이고 그 뒤 괄호에 서버 `message` 를 붙인다. `formatIntegrationErrorToast` 의 지금 동작이고 서버 문구는 괄호 안의 보조 정보다.

- **사전 문구가 주 안내다.** 어시스턴트 3행은 표에 있는 코드면 사전 문구만 보인다. 그래서 [통합 화면 에러 코드를 통합 화면 모듈의 표로 매핑하는 이유](#통합-화면-에러-코드를-통합-화면-모듈의-표로-매핑하는-이유-2026-10-30) 의 «어시스턴트 예외와 같은 이유다» 는 표를 둘 자리와 사전 경유를 다룬다. 서버 문구를 보이는 방식까지 같다는 뜻은 아니다.
- **서버 `message` 를 보여도 되는 전제.** 이 표의 코드는 모두 백엔드 상수나 예외 생성 자리에 둔 코드별 고정 문구를 보낸다. 예외 원문이나 다른 사용자의 식별자 · 통합 ID 는 들어가지 않는다. 서버 `message` 에 넣는 값은 Cafe24 `oauth/begin` 이 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에 넣는 상점 식별자 하나이고 요청자가 방금 입력한 값이다. `INTEGRATION_OWNER_NOT_MEMBER` 는 `message` 에 통합을 만든 사람을 넣지 않는다([통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드)). 표에 코드를 더할 때 지킬 조건은 규칙 5 의 «4행 괄호에 붙는 서버 `message`» 에 두었다. 가드로 막지 않고 리뷰에서 확인한다.
- **받아들인 잔여.** 영어 로케일에서는 사전 문구와 비슷한 영문이 괄호에 한 번 더 보인다. 역할 하한 코드의 서버 문구는 2026-11-27 부터 영문이라(NERV Task `CLE-T-CHP94Z`) 한국어 로케일에서는 괄호 안만 영문이다. 표에 없는 가드 코드(`NOT_A_MEMBER` 등)는 5행 표의 사전 문구로 보인다. 3행처럼 사전 문구만 보이게 바꾸는 것은 화면 동작 변경이라 하지 않았다.

### 여러 화면이 같이 받는 코드는 공용 코드 매핑에서 고른다

결정일: 2026-11-27

인증 · 트리거 모듈과 워크스페이스 가드 거부의 서버 `message` 를 영문으로 옮기면서(NERV Task `CLE-T-MNX9KP` · `CLE-T-1K5CWP` · `CLE-T-CHP94Z`) 그 문구를 그대로 보이던 화면은 한국어 로케일에서도 영문을 보이게 됐다. 규칙 3 은 서버가 영문을 내게 하고 규칙 5 는 코드로 문구를 고르게 하므로 화면 쪽에 코드 매핑이 있어야 한다. 로그인 · 가입 · 초대 수락 · 세션 · 비밀번호 변경 · 이메일 변경 · 워크스페이스 설정 화면은 같은 코드를 같은 뜻으로 받아서 매핑 하나를 함께 쓴다(5행). 폴백 순서는 화면 고유 문구, 5행 표, 서버 `message`, 화면 실패 문구다. 화면 고유 문구를 먼저 두어 한 화면만 다르게 읽는 코드를 그 화면이 정한다. 서버 `message` 폴백은 표에 아직 없는 코드에서도 안내가 비지 않게 하려는 것이다. 통합 화면(4행)도 표에 없는 코드는 5행 표를 먼저 본다. 그래야 통합 화면에서 받은 가드 거부가 한국어 화면에 영문으로 보이지 않는다.

- **기각: 서버가 한국어 문구를 보낸다.** 규칙 3 과 규칙 5 의 `Accept-Language` 금지에 어긋나고 사전이 둘로 갈린다. 영어 로케일 사용자는 계속 한국어를 본다.
- **기각: 화면마다 자기 매핑만 둔다.** 같은 코드(`RATE_LIMITED` · `SESSION_NOT_FOUND` · 가드 코드)를 여러 화면이 받는다. 공용 매핑을 쓰는 화면이 지금 일곱이다. 화면마다 표를 두면 한 화면에서 매핑을 빠뜨린 코드가 영문으로 보이고 사전 키도 흩어진다.
- **기각: 5행 코드를 `ERROR_KO` 에 더한다.** `ERROR_KO` 에는 한국어 템플릿만 있어 영어 로케일에서는 서버 영문이 보인다. 어시스턴트(3행) · 통합 화면(4행)을 `ERROR_KO` 밖에 둔 이유와 같다.
- **받아들인 한계.** 백엔드 대조 테스트는 `modules/auth` 의 코드만 본다. 다른 모듈의 코드는 5행 표에 저절로 들어오지 않고 서버 문구로 폴백한다. 그 모듈의 문구를 영문으로 옮기는 Task 가 표와 대조 범위를 함께 넓힌다.
