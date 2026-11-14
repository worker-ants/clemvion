---
id: "CLE-API-ERRCODES-TRIGGER"
title: "에러 코드 카탈로그 — 웹훅 · 트리거 · 채팅 채널"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-ERRCODES"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-ERRCODES"]
area: "CLE-API"
content_hash: "2a6d8024b0cbaf75a60e7c3549f8ffad70d21dd22e001a04a9cf5f86ff0068d2"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "a3136eb21ff6ae59aefe4a0d44db09d86cfddccca023393625dbc2432c24ca08"
etag: "sha256-41e7dce6ebc3c898c60fb282504d7ba8009e36fe22451bd95bbf7e6161c74bd7"
---
## 개요

이 문서는 [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 의 하위 문서로 카탈로그 가운데 웹훅 수신 코드(§6.10), 트리거 endpointPath 충돌(§6.13), 트리거 인증 설정 연결(§6.14), 채팅 채널 봇 토큰 재발급(§6.15), 인증 설정 재생성(§6.20) 코드를 정한다.

## 6.10 웹훅 수신 (도메인 문서 참조)

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

## 6.13 트리거 endpointPath 충돌 (도메인 문서 참조)

`POST /api/triggers`·`PATCH /api/triggers/:id` 가 `(endpoint_path)` 전역 UNIQUE 제약을 어기거나 다른 워크스페이스가 예약한 경로([트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md))를 쓸 때 발행한다. 두 경우를 한 코드로 묶었다. "예약됨" 을 따로 알리면 그 경로가 한때 쓰였다는 사실이 샌다. top-level `code` 는 기본값 `RESOURCE_CONFLICT` 를 유지하고 세부 사유는 `details` 에 싣는다. 어느 필드가 충돌했는지가 정보의 일부이기 때문이다.

| 세부 코드 (`details.code`) | 봉투 `code` / HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `TRIGGER_ENDPOINT_PATH_CONFLICT` | `RESOURCE_CONFLICT` / 409 | 같은 `endpointPath` 를 쓰는 트리거가 이미 있거나(다른 워크스페이스의 트리거 포함, 전역 유일), 다른 워크스페이스가 예약한 경로다(지웠거나 바꾼 경로). 둘을 구분하지 않는다. `details.field='endpoint_path'` | [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) |

`details` 가 **객체 형태**인 사례다(배열 아님). 같은 경로의 길이·이름 검증 실패는 400 `VALIDATION_ERROR` 로 §6.4 소관이다.

## 6.14 트리거 인증 설정 연결 (도메인 문서 참조)

`POST /api/triggers`·`PATCH /api/triggers/:id` 가 `authConfigId` 를 받을 때 그 인증 설정이 호출자의 워크스페이스에 속하는지 검증한다(`TriggersService.assertAuthConfigInWorkspace`). 다른 워크스페이스의 자격 증명에 트리거를 연결하는 것을 막는다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `AUTH_CONFIG_NOT_FOUND` | **400** | `authConfigId` 가 호출자 워크스페이스의 인증 설정이 아님(없거나 다른 워크스페이스 소속. 존재 여부 노출을 막으려고 구분하지 않는다). `details: { field: 'authConfigId', code: 'INVALID_FIELD' }` 를 함께 싣는다(`INVALID_FIELD` 행은 §6.4) | [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) |

- **이름은 `_NOT_FOUND` 지만 404 가 아니다.** 이 카탈로그에서 HTTP 로 나가는 `*_NOT_FOUND` 가운데 404 가 아닌 코드는 이 코드 말고 셋이다. 액세스 토큰 검증의 `WORKSPACE_NOT_FOUND`(401, §6.4), 로그인 2단계 Passkey 검증의 `WEBAUTHN_CREDENTIAL_NOT_FOUND`(401, §6.3), 트리거 단위 토큰 경로의 `EXECUTION_NOT_FOUND`(401, [§6.9 의 「트리거 단위 토큰」 행](CLE-API-ERRCODES-WSEIA.md#69-eia-rest-외부-표면-도메인-문서-참조))다. 앞의 두 401 은 다른 코드로 옮기기로 정했다(NERV Task `CLE-T-ZPPWK4`). 나머지는 모두 404 이고 이 상태 일관성을 위해 코드를 쪼갠 선례도 있다(`MODEL_CONFIG_NOT_FOUND` 404 와 `MODEL_CONFIG_DEFAULT_MISSING` 400).
- 400 인 근거: 다른 워크스페이스 참조는 리소스 부재가 아니라 입력값 유효성 문제다. 그래서 `details.field='authConfigId'` 로 필드를 지목하고 `BadRequestException` 으로 던진다.
- **이름과 400 을 그대로 둔다.** 2026-11-12 에 NERV Task `CLE-T-3P4ENZ` 에서 정했다. 이름을 더 정확하게 하려는 목적만으로는 바꾸지 않고(규칙 5), 뜻과 상태가 하나라 새 코드도 만들지 않는다(규칙 6). 이유는 Rationale 에 있다.
- 특화 코드와 일반 `details[].code` 를 함께 싣는 것이 "겹쳐 쓰지 않는다" 에 걸리지 않는 근거는 [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) 의 판별 기준이다.

## 6.15 채팅 채널 봇 토큰 재발급 (도메인 문서 참조)

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
| `INTERNAL_ERROR` | **500** | [§6.1](CLE-API-ERRCODES-SYSVAL.md#61-시스템) 의 `INTERNAL_ERROR` 와 같은 코드다. 트리거의 비밀 참조에 다른 워크스페이스가 소유한 시크릿 저장소 행이 남아 있어 `rotate` 가 거부함([시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 25). `message` 는 5xx 가림 문구다 | [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) |
| `CHAT_CHANNEL_SETUP_FAILED` | **502** | 그 밖의 `setupChannel` 실패(provider 5xx, 네트워크, 타임아웃). 이 저장소의 첫 502 다(근거: [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 의 「R-CC-23 setupChannel 실패는 전송 방식이 아니라 원인으로 분류한다」 Rationale) | [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) |

- **이름이 두 갈래라 헷갈리기 쉽다.** `INVALID_BOT_TOKEN`(입력 형식이 틀렸다)과 `BOT_TOKEN_INVALID`(provider 가 거부했다)는 어순만 다르고 뜻이 다르다. 합치거나 바꾸지 않는 이유는 §2 와 같다. 둘 다 이미 응답에 나갔고 프론트엔드 백엔드 라벨 매핑(`backend-labels.ts`)이 각각을 매핑한다.
- **생성 경로의 같은 입력 오류는 `VALIDATION_ERROR` 다.** 트리거 생성(`POST /api/triggers` 의 `chatChannel.botToken`)은 DTO 검증이라 같은 형식 오류가 `400 VALIDATION_ERROR` 로 나간다.
- **응답 본문에 provider 원문을 싣지 않는다.** `message` 는 고정된 클라이언트용 문자열이고 원문은 서버 로그에만 남긴다. 재개 명령 ack 의 내부 메시지 차단과 같은 이유다.

## 6.20 인증 설정 재생성 (도메인 문서 참조)

`POST /api/auth-configs/:id/regenerate` 의 실패 응답이다. 없는 인증 설정과 권한 부족은 공용 코드(§6.4 `RESOURCE_NOT_FOUND` · §6.2 `ADMIN_REQUIRED`)를 쓴다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `AUTH_CONFIG_REGENERATE_UNSUPPORTED` | 400 | 재생성할 수 없는 유형(Basic Auth)의 인증 설정에 재생성을 요청함. 사용자 이름과 비밀번호는 사용자가 입력한 값이라 새로 발급할 값이 없다. 설정을 저장하지 않고 감사 로그도 남기지 않는다. `details` 는 싣지 않는다 | [외부 호출 인증 설정 「재생성」](../CLE-TRIG/CLE-TRIG-AUTHCFG.md#재생성) |

- `AUTH_CONFIG_NOT_FOUND`(§6.14)와 앞부분이 같지만 표면이 다르다. 그쪽은 트리거를 저장할 때 `authConfigId` 를 검증한다.

## Rationale

### `TRIGGER_NOT_FOUND` 를 다른 워크스페이스의 워크플로우에도 쓰는 이유 (2026-10-05)

웹훅 트리거는 있으나 그 워크플로우가 트리거의 워크스페이스에 없을 때(저장 경계 이전의 교차 행)도 `TRIGGER_NOT_FOUND` 다. 규칙 6 은 새 조건에 새 코드를 만들게 한다. 이 조건은 클라이언트가 가를 조건이 아니고 엔드포인트가 없을 때와 구분하지 않는 것이 목적이다. 새 코드를 만들면 그 워크플로우가 다른 워크스페이스에 있다는 것이 드러난다. 같은 카탈로그의 `ALERT_RULE_NOT_FOUND` · `RERUN_EXECUTION_NOT_FOUND`(없거나 다른 워크스페이스는 같은 404)와 `TRIGGER_ENDPOINT_PATH_CONFLICT`(예약과 중복을 한 코드로 묶음)도 같은 방식이다. 선례는 두 부류다. `ALERT_RULE_NOT_FOUND` · `RERUN_EXECUTION_NOT_FOUND` 는 요청한 리소스 자체가 없거나 다른 워크스페이스에 있는 부재다. `TRIGGER_ENDPOINT_PATH_CONFLICT` 는 부재가 아니라 두 조건(예약 · 중복)을 한 코드로 묶어 예약을 감추는 은닉이다. 이번은 요청한 트리거는 있고 연결된 리소스(트리거의 워크플로우)가 다른 워크스페이스에 있는 경우라 부재 선례를 한 칸 넓힌 해석이다. 연결된 리소스의 부재에 따로 코드를 둔 `AUTH_CONFIG_NOT_FOUND`(400)와는 시점이 다르다. 그쪽은 트리거를 저장할 때 소유자에게 알리는 코드라 소유자가 고칠 수 있게 구분해 알린다. 이쪽은 실행 때 워크스페이스 밖의 호출자에게 나가는 응답이라 감춘다. 2026-10-05 에 이 방식을 규칙 6 의 단서로 올렸다(NERV Task `CLE-T-K9S0TE`). 호출자에게 보이는 뜻은 그 엔드포인트의 트리거가 없다는 것이라 §3 예외 등록부에 올리지 않는다. 근거는 [데이터 모델 개요 「참조의 소속」](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) 의 «없는 id 와 다른 워크스페이스의 id 를 구분하지 않는다» 이고 동작은 [웹훅 「에러 처리」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#에러-처리) 가 정한다(NERV Task `CLE-T-XYR067`).

### 꺼진 워크플로우의 웹훅에 `WORKFLOW_INACTIVE` 를 새로 만들었다 (2026-10-10)

NERV Task `CLE-T-XRWFMJ` 에서 사람이 정한 결정이다. 웹훅 트리거는 활성인데 그 워크플로우가 비활성이면 `410` 과 `WORKFLOW_INACTIVE` 를 돌려준다. 확인 순서와 경로별 동작은 [트리거 데이터와 흐름 「워크플로우 활성 관문」](../CLE-TRIG/CLE-TRIG-DATA.md#워크플로우-활성-관문) 이 정한다.

- **규칙 6 의 새 조건으로 보고 새 코드를 만들었다(사용자 결정).** 비활성인 것이 트리거가 아니라 워크플로우다.
- **규칙 6 의 단서에 걸리지 않는다.** 관문은 트리거의 워크스페이스 안에서만 워크플로우를 찾는다. 그 워크스페이스에 워크플로우가 없으면 이 코드가 아니라 `TRIGGER_NOT_FOUND`(404)다. 그래서 이 코드로 다른 워크스페이스 워크플로우의 활성 상태가 드러나지 않는다.
- **코드를 명시한다.** `410` 에는 기본 코드가 없다([에러 응답과 클라이언트 처리](CLE-API-ERROR.md)).

기각한 대안: **`TRIGGER_INACTIVE` 를 다시 쓰는 안**. 트리거는 활성이므로 코드의 뜻(트리거가 비활성)과 실제 조건이 어긋난다(규칙 1).

### 웹훅 인증 설정의 기대값이 비었거나 읽지 못해도 `AUTH_FAILED` 를 쓴다 (2026-10-31)

NERV Task `CLE-T-KQ37NJ` 에서 정했다. 전에는 `basic_auth` 의 사용자 이름 · 비밀번호나 `hmac` 의 secret 이 비어 있으면 빈 값끼리 비교해 요청이 통과했다. `bearer_token` · `api_key` 는 그 전부터 빈 기대값을 거부했다. 복호화 불가 표식이 담긴 인증 설정은 기대값을 읽지 못해 네 유형 모두 같은 401 로 거부한다.

- **결정: 새 코드를 만들지 않는다(규칙 6 의 예외).** 웹훅 인증에서 인증 설정의 기대값이 비었거나 읽지 못하는 경우는 §6.10 `AUTH_FAILED` 로 거부한다.
- **근거: 한 응답 정책에 든다.** 이 경우는 §6.10 `AUTH_FAILED` 행의 한 응답 정책(열거 공격 · 정보 노출 차단)에 든다. 웹훅 호출자는 아직 인증을 통과하지 않은 상대라 서버 쪽 인증 설정의 상태를 가려서 알리지 않는다. 그래서 이 경우도 `is_active=false` 인증 설정이나 서명 · 토큰 불일치와 같은 `AUTH_FAILED` 한 응답으로 둔다.
- **선례**: 서버 쪽 데이터 문제를 `AUTH_FAILED` 로 감춘 선례는 §6.10 `AUTH_FAILED` 행에 먼저 있다. 트리거가 저장 경계 이전에 남은 교차 행이라 인증 설정을 트리거의 워크스페이스에서 찾지 못하는 경우다([데이터 모델 개요 「저장된 교차 행 점검」](../CLE-PLAT/CLE-PLAT-DATA.md#저장된-교차-행-점검)). 웹훅 수신에서 호출자에게 서버 쪽 사정을 감추는 선례는 [`TRIGGER_NOT_FOUND` 를 다른 워크스페이스의 워크플로우에도 쓰는 이유](#trigger_not_found-를-다른-워크스페이스의-워크플로우에도-쓰는-이유-2026-10-05) 에도 있다.
- **규칙 6 의 단서에 들지 않아 예외로 둔다.** 규칙 6 은 새 조건에 새 코드를 만들게 한다. 그 단서는 리소스가 다른 워크스페이스에 있다는 것이 드러나는 조건만 묶는다. 이 경우는 그 단서에 들지 않는다.
- **예외의 범위**: 웹훅 인증에서 인증 설정의 기대값이 비었거나 읽지 못하는 경우뿐이다. 다른 조건이나 다른 표면으로 넓히지 않는다. 2026-11-05 에 기대값이나 헤더 이름이 문자열이 아닌 경우를 이 범위에 더했다([웹훅 인증의 `AUTH_FAILED` 예외에 문자열이 아닌 기대값과 헤더 이름을 더했다](#웹훅-인증의-auth_failed-예외에-문자열이-아닌-기대값과-헤더-이름을-더했다-2026-11-05)).
- **§3 예외 등록부에 올리지 않는다.** 이 예외는 이름을 정하는 결정이 아니라 기존 코드를 다시 쓰는 결정이다. §3 은 이름 규칙(규칙 1~3)을 따르지 않는 기존 코드를 적는 등록부다(규칙 7 · §3 첫 문단). `AUTH_FAILED` 는 이름 규칙을 따른다.
- **`WEBAUTHN_INVALID` 선례와 경우가 다르다.** [2FA · Passkey 코드](CLE-API-ERRCODES-MFA.md) 의 「구현 반영 (2026-10-30, NERV Task `CLE-T-GK9J2B`)」 은 다시 시도하면 풀리는 Redis 장애를 인증 실패와 갈랐지만 이번 경우는 사람이 인증 설정을 바로잡기 전에는 다시 보내도 풀리지 않아 호출자가 재시도를 판단할 일이 없다.

### 웹훅 인증의 `AUTH_FAILED` 예외에 문자열이 아닌 기대값과 헤더 이름을 더했다 (2026-11-05)

NERV Task `CLE-T-0Q768N` 에서 정했다. 웹훅 인증에서 인증 설정의 기대값이 문자열이 아니거나 헤더 이름(`headerName` · `header`)이 문자열이 아니면 §6.10 `AUTH_FAILED` 로 거부한다. 전에는 비교 도중 오류가 나 500 이 나갔다. 동작의 정본은 [웹훅 「문자열이 아닌 기대값과 헤더 이름도 401 로 거부한다」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#문자열이-아닌-기대값과-헤더-이름도-401-로-거부한다-2026-11-05) 다.

- **2026-10-31 예외의 범위를 넓혔다.** [웹훅 인증 설정의 기대값이 비었거나 읽지 못해도 `AUTH_FAILED` 를 쓴다](#웹훅-인증-설정의-기대값이-비었거나-읽지-못해도-auth_failed-를-쓴다-2026-10-31) 는 예외를 빈 기대값과 읽지 못하는 설정으로 한정하고 넓히지 않는다고 적었다. 이번 결정으로 그 범위에 두 경우를 더했다. 그 절의 범위 불릿에도 적었다.
- **같은 응답 정책에 든다.** 문자열이 아닌 기대값으로는 어떤 요청도 인증될 수 없어 빈 기대값과 결과가 같다. 문자열이 아닌 헤더 이름은 비교할 헤더를 정할 수 없게 한다. 둘 다 서버 쪽 인증 설정의 상태이고 아직 인증을 통과하지 않은 호출자에게 가려서 알리지 않는다는 2026-10-31 결정의 근거가 그대로 적용된다.
- **기각한 대안**: 500 을 그대로 두는 안과 새 코드(예: 인증 설정이 잘못됐다는 코드)를 만드는 안이다. 둘 다 서버 쪽 설정이 잘못됐다는 것을 외부 호출자에게 드러내고 인증 실패를 한 응답으로 돌려주는 §6.10 의 정책과 맞지 않는다.
- **§3 예외 등록부에 올리지 않는다.** 2026-10-31 결정과 같은 이유다. 기존 코드를 다시 쓰는 결정이고 `AUTH_FAILED` 는 이름 규칙을 따른다.

### 인증 설정 재생성 거부에 `AUTH_CONFIG_REGENERATE_UNSUPPORTED` 를 새로 만들었다 (2026-11-05)

NERV Task `CLE-T-SCDNDC` 에서 정했다. Basic Auth 인증 설정에 재생성을 요청하면 400 `AUTH_CONFIG_REGENERATE_UNSUPPORTED` 로 거부한다(§6.20). 전에는 발급할 값이 없는데도 요청이 성공했고 저장된 비밀번호를 평문으로 응답했다. 동작과 근거의 정본은 [외부 호출 인증 설정 「Basic Auth 재생성을 거부한다」](../CLE-TRIG/CLE-TRIG-AUTHCFG.md#basic-auth-재생성을-거부한다-2026-11-05) 다.

- **새 조건이라 새 코드를 만든다(규칙 6).** 이 API 에 전에 없던 거부 조건이다.
- **`VALIDATION_ERROR` 를 쓰지 않는다.** 재생성 요청에는 본문이 없어 `details` 로 가리킬 필드가 없다. 요청 형식이 틀린 것이 아니라 대상 설정의 유형이 이 동작을 지원하지 않는 것이다.
- **409 나 `INVALID_STATE`(422)를 쓰지 않는다.** 유형은 바꿀 수 없는 값이라 기다리거나 상태를 바꿔도 풀리지 않는다. 같은 요청을 다시 보내도 결과가 같은 클라이언트 오류라 400 이다.
- **이름은 `<DOMAIN>_<CONDITION>` 이다(규칙 1 · 3).** 도메인은 인증 설정(`AUTH_CONFIG`)이고 조건은 재생성을 지원하지 않는다는 것이다. 유형 이름을 넣지 않은 것은 재생성할 수 없는 유형이 늘어도 같은 뜻이기 때문이다.
- **`AUTH_CONFIG_*` 접두는 도메인 이름이다.** 트리거 API 의 `AUTH_CONFIG_NOT_FOUND`(§6.14)와 인증 설정 API 의 이 코드는 표면이 달라도 같은 접두를 쓴다. 접두는 코드가 나오는 표면이 아니라 조건이 속한 도메인을 가리킨다.

### `INVALID_BOT_TOKEN` 의 뜻을 길이 상한과 보이는 ASCII 위반까지 넓혔다 (2026-11-06)

NERV Task `CLE-T-FX354C` 이다. 봇 토큰 재발급은 `newBotToken` 이 있는지와 문자열인지만 봤다. 공백 · 제어 문자 · ASCII 밖 문자가 든 토큰은 헤더에 실을 수 없어 fetch 가 요청을 만들지 못했고 응답은 `502 CHAT_CHANNEL_SETUP_FAILED` 였다. 사용자가 고칠 입력 오류이므로 400 으로 거부한다. 정의는 [채팅 채널 「R-CC-32 봇 토큰 입력은 보이는 ASCII 만 받는다」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-32-봇-토큰-입력은-보이는-ascii-만-받는다) 에 있다.

- 새 코드는 만들지 않았다. `INVALID_BOT_TOKEN` 은 처음부터 입력 형식이 틀렸다는 뜻이고 길이 · 문자 집합 위반도 같은 뜻이다(규칙 6 의 새 조건이 아니다).
- 재발급에도 생성과 같은 256자 상한을 둔다.
- 생성 경로는 DTO 검증이라 같은 입력 오류가 `400 VALIDATION_ERROR` 다.
- 입력 형식 오류는 400(`INVALID_BOT_TOKEN` · `VALIDATION_ERROR`)이고 프로바이더 장애는 502(`CHAT_CHANNEL_SETUP_FAILED`)다. 형식이 맞는데 프로바이더가 거부하면 `BOT_TOKEN_INVALID`(400)다.

### 404 가 아닌 `*_NOT_FOUND` 세 코드를 정리했다 (2026-11-12)

NERV Task `CLE-T-3P4ENZ` 에서 사람이 정했다. 이름은 `_NOT_FOUND` 인데 404 가 아닌 코드를 하나씩 따졌다.

- **`AUTH_CONFIG_NOT_FOUND` 는 이름과 400 을 그대로 둔다.** 발행처는 트리거 생성 · 수정의 `authConfigId` 검증 한 곳이고 뜻도 상태도 하나다. 규칙 5 는 이름을 더 정확하게 하려는 목적만으로 바꾸지 않는다고 정한다. 뜻이 갈리지 않으니 규칙 6 에도 걸리지 않는다. 프런트엔드에 이 코드로 분기하는 곳이 없어서 바꿔도 얻는 것이 없다. 「`_NOT_FOUND` 는 404」 라는 기대는 이름의 부분 문자열로 상태를 짐작하는 읽기라서 규칙 4 가 막는다. 그래서 §6.14 의 설명으로 밝히는 데 그쳤다. [예외 · 내부 분류 · 은퇴 코드](CLE-API-ERRCODES-EXCEPT.md#모델-설정-코드-분리-model_config_not_found404와-model_config_default_missing400) 의 「모델 설정 코드 분리」 선례와는 경우가 다르다. 그 선례는 한 코드가 두 뜻과 두 상태를 가져서 나눴다.
- **기각: `AUTH_CONFIG_NOT_FOUND` 를 404 로 바꾸거나 이름을 바꾼다.** 404 로 바꾸면 입력 필드를 지목하는 `details` 와 맞지 않는다. 다른 워크스페이스 참조는 리소스 부재가 아니라 입력값 문제로 봤다(§6.14). 이름 바꾸기는 규칙 5 에 어긋난다.
- **로그인 검증의 `WEBAUTHN_CREDENTIAL_NOT_FOUND`(401)는 `WEBAUTHN_INVALID` 로 옮긴다.** 같은 이름이 credential 이름 변경 · 삭제에서는 대상이 없다는 404 이고 로그인 2단계 검증에서는 인증이 실패했다는 401 이다. 뜻이 갈리므로 규칙 6 에 따라 나눈다. 로그인 쪽은 새 코드를 만들지 않고 기존 `WEBAUTHN_INVALID` 로 옮긴다. 서명이 틀린 응답과 이미 쓴 챌린지를 이 코드로 묶은 이유와 같다. 사용자가 할 일은 「Passkey 로 다시 시도」 하나다. credential 이 없다는 사실을 서명 실패와 구별해 알려 줄 이유도 없다. 로그인 화면도 `WEBAUTHN_INVALID` 만 안내 문구로 바꾼다. 자세한 근거는 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) 의 Rationale 에 있다.
- **토큰 검증의 `WORKSPACE_NOT_FOUND`(401)는 새 코드 `NO_WORKSPACE_AVAILABLE` 로 옮긴다.** 404 는 대상 워크스페이스가 없다는 뜻이고 401 은 사용자에게 쓸 워크스페이스가 하나도 없다는 뜻이다. 뜻이 갈리므로 규칙 6 에 따라 나눈다. 이름은 조건이 워크스페이스 하나가 아니라 사용자의 상태라는 점이 읽히게 골랐다. 규칙 3 의 `<DOMAIN>_<CONDITION>` 은 권장이라 이 이름에서는 따르지 않았다. 다른 후보를 고르지 않은 이유는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) 의 Rationale 에 있다.
- **두 이동은 구현 전이라 표 아래 문장으로 적었다(규칙 9).** 지금 응답에 나가는 401 은 행으로 그대로 둔다(규칙 8). 구현하는 NERV Task `CLE-T-ZPPWK4` 가 발행과 함께 표를 고친다.

### 봇 토큰 재발급 실패 코드와 공개 웹훅 범위를 도메인 문서에 맞췄다 (2026-11-13)

NERV Task `CLE-T-GNTWP9` 에서 도메인 문서와 어긋난 행을 맞췄다.

- §6.15 의 403 세 행과 500 행은 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 「봇 토큰 재발급 API」 의 에러 표를 옮겼다. §5 `WORKSPACE_REQUIRED` 행의 단서는 같은 문서 「R-CC-18 rotate-bot-token 의 워크스페이스 검증은 공용 데코레이터로 한다」 Rationale 의 2026-11-12 정정을 따른다.
- `INTERNAL_ERROR` 에 더한 문장은 [시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 25 · 27 이 거부 전용 코드 없이 일반 500 으로 보낸다고 정한 데서 왔다. 이 거부는 예상된 경우라 「예상하지 못한 서버 에러」 라는 설명만으로는 맞지 않았다.
- 공개 웹훅 정의와 `PAYLOAD_TOO_LARGE`(요청 본문) 행은 [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) 에 맞췄다. 사람 결정(2026-11-12)에 따라 공개 웹훅 한도에서 채팅 채널 트리거를 뺐고 §6.10 의 분당 · 시간당 한도와 본문 크기 행에 같은 범위를 적었다. 이 제외는 `PublicWebhookThrottleGuard` 에 구현됐으므로(NERV Task `CLE-T-QKJ2TZ`) 세 행의 상태는 «구현» 이다.
- §6.4 `WORKSPACE_ID_REQUIRED` 행에는 경로로 워크스페이스를 받지 않는 `@Roles()` 라우트가 이 코드 대신 `403 FORBIDDEN` 을 낸다는 단서를 더했다([워크스페이스와 멤버 「`X-Workspace-Id` 형식 검사」](../CLE-ACCT/CLE-ACCT-WS.md#x-workspace-id-형식-검사)).
