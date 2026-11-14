---
id: "CLE-TRIG-WEBHOOK-AUTH"
title: "웹훅 — 인증과 워크플로우 입력"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-TRIG-WEBHOOK"
ancestors: ["CLE-VISION", "CLE-TRIG", "CLE-TRIG-WEBHOOK"]
area: "CLE-TRIG"
content_hash: "d3c6ce8cf6c500015d17d4fe28c3b3088debc9e7437ec579bb83cee267f8858f"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "e94383ddb477a71d14bb4b49accddd45cb3b16b6855c09c0c88029555db7cefc"
etag: "sha256-9038203d53981495218aa4d3de5f301328d5ed1978d9c5580e6426b5fa0e9a51"
---
## 개요

이 문서는 [웹훅](CLE-TRIG-WEBHOOK.md) 의 하위 문서로 웹훅 요청의 인증 검증, 워크플로우에 넘기는 입력 구조와 트리거 파라미터 추출 · 400 응답 형식, 수신 헤더 마스킹, 웹훅의 보안 고려사항을 정한다. 이 단계들이 처리 흐름의 어디에 들어가는지는 [웹훅 — 처리 흐름](CLE-TRIG-WEBHOOK-FLOW.md#처리-흐름) 이 정한다.

## 인증

모든 인증 자료는 `trigger.auth_config_id` 가 가리키는 인증 설정의 `config` 에서 복호화해 비교한다. `config` 스키마는 [트리거 데이터와 흐름](CLE-TRIG-DATA.md) 이 정한다.

- 비교는 `crypto.timingSafeEqual` 기반 상수 시간 비교로 해 타이밍 공격을 막는다.
- 인증 실패는 유형과 상관없이 `401 AUTH_FAILED` 하나로 응답한다. 어떤 유형인지, 왜 실패했는지 클라이언트에 알리지 않는다(enumeration·정보 노출 차단). 진단은 서버 로그에만 남긴다.
- 인증 검증, `ip_whitelist` 시행, `last_used_at` 갱신은 모두 `AuthConfigsService.verifyWebhookRequest` 가 맡는다. `HooksService` 는 호출만 한다.
- `ip_whitelist` 는 인증 설정에 딸려 있어 `auth_config_id IS NOT NULL` 일 때만 평가한다. 각 항목은 단일 IP 또는 CIDR 이고 IPv4-mapped IPv6 클라이언트는 IPv4 로 바꿔 비교한다. 클라이언트 IP 를 알 수 없으면 거부한다(fail-closed). 클라이언트 IP 추출 규칙은 [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) 의 클라이언트 IP 항목을 따른다.
- 인증이 성공하면 `AuthConfig.last_used_at = NOW()` 를 트랜잭션 밖에서 fire-and-forget 으로 갱신한다. 경합하면 마지막 쓰기가 이기고 실패하면 갱신하지 않는다.

| 유형 | 요청 헤더 | 검증 방식 |
|------|----------|----------|
| 인증 없음(공개) | 없음 | `auth_config_id IS NULL`. 누구나 부를 수 있고 엔드포인트 경로 UUID 가 사실상 비밀 키 역할을 한다 |
| `hmac` | `{config.header}: {config.algorithm}=<hex-digest>`(기본 헤더 `X-Hub-Signature-256`) | `HMAC-{config.algorithm}(config.secret, rawBody)` 가 헤더 값과 같은지. GitHub 웹훅과 같은 방식이다. `config.algorithm` 은 `sha256`·`sha512` 만 허용하고 다른 값은 인증 실패다. 파싱 전 원본 바이트가 필요하므로 NestJS 부트스트랩에서 `rawBody: true` 를 켜야 한다 |
| `bearer_token` | `Authorization: Bearer <token>` | `token === config.token` |
| `api_key` | `{config.headerName}: <key>`(기본 헤더 `X-API-Key`) | 헤더 값 `=== config.key` |
| `basic_auth` | `Authorization: Basic base64(username:password)` | 디코드한 사용자 이름·비밀번호가 `config.username` / `config.password` 와 같은지 |

표의 기대값(`config.secret` · `config.token` · `config.key` · `config.username` · `config.password`)이 비었으면 요청 값과 상관없이 `401 AUTH_FAILED` 다. 빈 기대값과 빈 요청 값이 같다고 판정되지 않게 막는 규칙이다. 기대값이 문자열이 아니면 빈 기대값과 같이 본다. 헤더 이름(`config.headerName` · `config.header`)이 있는데 문자열이 아니면 요청에서 비교할 헤더를 정할 수 없으므로 역시 `401 AUTH_FAILED` 다. 헤더 이름이 없으면 기본 헤더를 쓴다. 인증 설정이 복호화 불가 표식으로 읽혀도 기대값을 읽지 못하므로 네 유형 모두 `401 AUTH_FAILED` 다. 통합 암호화 키를 바꾸면 그 전에 저장한 인증 설정이 이 표식으로 읽힌다. 표식이 생기는 경우는 [통합 데이터와 흐름 「암호화」](../CLE-INT/CLE-INT-DATA.md#암호화) 가 정한다.

## 워크플로우 입력 구조

웹훅으로 받은 데이터는 다음 구조로 워크플로우에 넘긴다.

```json
{
  "parameters": { "orderId": "abc", "amount": 1000 },
  "body": { "orderId": "abc", "amount": "1000", "extra": "..." },
  "headers": {
    "content-type": "application/json",
    "x-event-type": "order.created"
  },
  "query": { "key": "value" },
  "method": "POST"
}
```

| 키 | 설명 |
|----|------|
| `parameters` | 수동 트리거 노드의 `config.parameters` 에 따라 body 의 같은 이름 최상위 키에서 꺼내 타입을 맞춘 결과. 다운스트림에서 `$params.<name>` 이나 `$input.parameters.<name>` 으로 읽는다 |
| `body` | 파싱한 요청 본문(JSON 또는 form data, 원본 유지) |
| `headers` | 요청 헤더(소문자 키). 민감 헤더 값은 저장 전에 `[REDACTED]` 로 가린다([수신 헤더 마스킹](#수신-헤더-마스킹)). 위 예시의 `content-type`·`x-event-type` 같은 비민감 헤더는 그대로 둔다 |
| `query` | URL 쿼리 파라미터 |
| `method` | HTTP 메서드 |

이 구조는 어댑터가 워크플로우에 넘기는 입력이다. 수동 트리거 노드가 이 입력을 노드 `output` 으로 내보내는 모양(웹훅 출처의 `output.request.*`)과 다운스트림 표현식 경로(`$node["Manual Trigger"].output.request.method` 등)는 [수동 트리거 노드](../CLE-NODE-TRIG/CLE-NODE-MANUAL.md) 가 정한다. `HooksService` 는 입력에 진입 경로 마커 `__triggerSource:'webhook'` 을 붙여 넘긴다([실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md)).

### 파라미터 추출 규칙

1. 워크플로우의 수동 트리거 노드에서 `config.parameters` 스키마를 읽는다.
2. 스키마가 없거나 빈 배열이면 `parameters = {}` 다.
3. 스키마가 있으면 파라미터마다 다음을 적용한다.
   - `body` 가 객체면 그 `name` 의 최상위 키 값을 가져온다.
   - `body` 가 객체가 아니면 모든 값을 지정되지 않은 것으로 본다.
   - 값이 없고 `required=true` 면 누락으로 보고 400 을 응답한다(누락 필드 목록 포함).
   - 값이 없고 `required=false` 면 `defaultValue` 를 쓴다(없으면 `null`).
   - 타입이 맞지 않으면 `coerceToType` 으로 강제 변환하고 실패하면 400 이다.

채팅 채널 경로는 이 추출을 거치지 않는다. 이 경로의 파라미터 정책은 [웹훅 「미결 사항」](CLE-TRIG-WEBHOOK.md#미결-사항)에 적는다.

### 400 응답 형식

required 파라미터 누락이나 타입 강제 변환 실패가 나면 `hooks.service` 가 `BadRequestException({ code, message, details })` 를 던지고 전역 `GlobalExceptionFilter` 가 공식 에러 응답 봉투(`{ error: { code, message, requestId, details? } }`)로 바꿔 응답한다([에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md)). 두 경우 모두 실행 행은 만들지 않는다.

```json
{
  "error": {
    "code": "INVALID_WEBHOOK_PAYLOAD",
    "message": "Invalid webhook payload",
    "requestId": "f3b6d2e0-9d4a-4b77-9d19-7a0f8f4c1e2b",
    "details": [
      { "field": "orderId", "code": "MISSING_REQUIRED_FIELD", "message": "Required parameter is missing" },
      { "field": "amount",  "code": "TYPE_COERCION_FAILED",   "message": "Value could not be coerced to the declared type" }
    ]
  }
}
```

- `error.code`: 도메인 특화 400 override 인 `INVALID_WEBHOOK_PAYLOAD` 다. API 규약의 400 기본값 `VALIDATION_ERROR` 대신 쓴다. EIA 가 같은 방식의 선례다.
- `error.details[]`: 필드별 사유. `field` 는 파라미터 이름, `code` 는 `UPPER_SNAKE_CASE` 필드 코드다. `MISSING_REQUIRED_FIELD` 는 required 누락, `TYPE_COERCION_FAILED` 는 선언 타입으로 변환할 수 없음이다. 헬퍼는 `INVALID_SCHEMA`(스키마 구조 위반)와 `MASKED_VALUE_RESUBMITTED`(마스킹된 값 재제출)도 매핑하지만 웹훅 런타임 경로에서는 둘 다 나오지 않는다. 앞의 것은 저장 시점 검증 코드이고 뒤의 것은 수동 실행 경로 전용이다. 판정 기준이 값의 출처가 아니라 페이로드를 누가 썼는지이고 웹훅 body 는 외부 시스템이 쓴다([응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md)).
- 구현: 내부 분류 문자열(`missing_required` / `coerce_failed` / `invalid_schema` / `masked_value_resubmitted`)을 `toTriggerParameterErrorDetails` 가 위 공개 필드 코드로 바꾼다. 수동 실행·저장·재실행 세 경로의 `INVALID_TRIGGER_PARAMETERS` 도 같은 헬퍼를 쓴다([수동 트리거 노드](../CLE-NODE-TRIG/CLE-NODE-MANUAL.md)). 명명 규약과 카탈로그는 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 가 정한다.

### 수신 헤더 마스킹

웹훅 요청의 인증·시크릿성 헤더 값(`Authorization`·`Cookie`·`X-Api-Key`·`X-Auth-Token` 등)은 `Execution.inputData` 로 저장하기 전, 인증 검증 직후에 `[REDACTED]` 로 가린다. `hooks.service` 의 두 `execute` 진입점(일반 경로, 채팅 채널 경로) 모두 이렇게 한다.

- 가릴 헤더 목록은 통합 노드도 쓰는 `sanitizeResponseHeaders` 를 단일 기준으로 쓴다. 정확히 일치하는 이름(`authorization`·`cookie`·`x-auth-token` 등)과 부분 문자열(`auth`·`token`·`secret`·`cookie`·`credential`·`password`·`api-key`·`signature`)로 판정한다. 키는 남기고 값만 가린다.
- 부분 문자열 `signature` 는 `X-Hub-Signature-256`(웹훅 HMAC)·`X-Slack-Signature`·`X-Signature-Ed25519`(Discord) 같은 서명 헤더까지 덮는다. `content-type`·`x-event-type` 같은 비민감 커스텀 헤더는 그대로 둔다.
- 효과: `Execution.inputData.headers`, 수동 트리거 노드 `output.request.headers`, 표현식 `$trigger.headers`([표현식 언어](../CLE-WF/CLE-WF-EXPR.md)) 세 표면이 모두 가린 값을 본다. 실행 상세·재실행 모달·Background 실행 상세처럼 `inputData`/`output_data` 를 보여 주는 모든 읽기 경로가 자동으로 가려진다.
- 인증에는 영향이 없다. HMAC 서명 검증·IP whitelist·토큰 비교는 가리기 전 원본 헤더로 한다. `sourceIp` 와 인증 설정 사용 내역도 원본으로 기록한다.
- 이 층은 알려진 민감 헤더 키에만 걸린다. body·params 의 자유 텍스트에 박힌 자격 증명(`Bearer …`, 자격 증명을 담은 URI 등)은 이 층이 잡지 못한다. 그 빈틈은 응답 마스킹이 덮는다. `inputData` 도 `outputData`·`error` 처럼 나가는 값 패턴 마스킹의 대상이다([응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md)). 즉 저장 때 키 기준 마스킹과 응답 때 값 패턴 마스킹의 이중 방어다.
- 그래도 이 층은 대체되지 않는다. 표현식 `$trigger.headers` 는 실행 런타임에 주입돼 응답 마스킹을 거치지 않으므로 그 표면을 가리는 것은 이 저장 시점 층뿐이다.
- 정당화는 [수신 헤더 마스킹을 저장 시점에 하는 이유](#수신-헤더-마스킹을-저장-시점에-하는-이유-2026-07-07) 에 있다.

## 보안 고려사항

| 항목 | 대책 |
|------|------|
| 엔드포인트 추측 방지 | UUID 기반 랜덤 경로(무차별 대입 불가). [비밀성](CLE-TRIG-WEBHOOK-API.md#비밀성) |
| 비밀 키 저장 | 웹훅 인증 자료는 모두 `auth_config.config` JSONB 에 AES-256-GCM 으로 암호화 저장한다. 암호화 키는 통합 암호화 키(`INTEGRATION_ENCRYPTION_KEY`)다. 이 보장은 운영 환경에서 새로 쓰는 값 기준이다. 예외는 [통합 데이터와 흐름 「암호화」](../CLE-INT/CLE-INT-DATA.md#암호화) 에 있다. 결정 근거는 [시크릿 저장소 「R13. 통합 암호화 키를 마스터키와 따로 둔다」](../CLE-INT/CLE-INT-SECRET.md#r13-통합-암호화-키-integration_encryption_key-를-마스터키와-따로-두고-production-에서-키-없이-기동하지-않는다-2026-10-10) 에 있다. API 응답에서는 항상 가리고 평문은 생성·재생성·평문 보기 세 경로에서만 나간다([외부 호출 인증 설정](CLE-TRIG-AUTHCFG.md)) |
| 요청 민감 헤더 노출 | 저장 전에 `[REDACTED]` 로 가린다([수신 헤더 마스킹](#수신-헤더-마스킹)) |
| `last_used_at` 갱신 | 인증 성공 직후 fire-and-forget UPDATE([인증](#인증)). 실패하면 활성 가시성만 잃는다 |
| 본문 크기 제한 | 공개 웹훅 32KB, 인증 웹훅과 채팅 채널 트리거 1MB, 그 밖의 라우트 100KB([본문 크기](CLE-TRIG-WEBHOOK-LIMIT.md#본문-크기)) |
| Rate limiting | 전역 throttler 분당 100건 + 공개 웹훅 IP 단위 한도(분당 10·시간당 20 기본). 채팅 채널 트리거의 예외와 IP 를 알 수 없는 요청은 [호출 빈도 제한](CLE-TRIG-WEBHOOK-LIMIT.md#호출-빈도-제한). 서명 참조가 있는 채팅 채널 트리거의 서명 검증 실패 한도와 대화 단위 분당 한도는 [채팅 채널 「인바운드 관문 순서」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-관문-순서) 가 정한다 |
| JWT 제외 | `/api/hooks/*` 는 JWT guard 대상이 아니다 |
| CORS | 웹훅 엔드포인트는 CORS 제한이 없다 |

## 구현 위치

- `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (`verifyWebhookRequest`: 인증 검증, `ip_whitelist`, `last_used_at`)
- 파라미터 추출 · 헤더 마스킹을 부르는 `hooks.service.ts` 는 [웹훅 — 처리 흐름](CLE-TRIG-WEBHOOK-FLOW.md#구현-위치) 에 적는다

## Rationale

### 수신 헤더 마스킹을 저장 시점에 하는 이유 (2026-07-07)

민감 헤더는 저장(ingestion) 시점에 가린다. 대안인 응답(display) 시점 마스킹, 즉 원본을 `Execution.inputData` 에 저장하고 실행·Background 실행 응답 DTO 에서만 가리는 방식은 기각했다.

- 채택 근거: (a) 시크릿이 저장소에 남지 않는다. DB 와 감사 기록에도 원본 인증 헤더가 없다. (b) `inputData`·`output.request.headers`·`$trigger.headers` 와 앞으로 생길 읽기 경로까지 하나의 기준으로 덮어, 표면마다 마스킹을 붙이는 두더지 잡기를 막는다. (c) 인증과 사용 내역은 원본으로 하므로 인증·감사 기능이 줄지 않는다. (d) `output.request.headers` 를 원본으로 쓰는 다운스트림 노드가 없어(조사 확인) 정상 사용이 깨지지 않는다.
- 기각한 대안(응답 시점): 원본 시크릿이 DB 에 남아 유출 표면(DB 접근·백업·새 엔드포인트)이 남고 모든 읽기 경로를 따로 가려야 한다. 실행 읽기는 `verifyOwnership(workspaceId)` 만 확인하므로 워크스페이스 멤버 전원에게 노출될 위험이 있어, 저장 자체를 없애는 편이 안전하다.
- `$trigger.headers` 의 `buildTriggerView` 뷰 마스킹은 지우지 않고 멱등한 심층 방어로 둔다. 웹훅이 아닌 경로가 triggerData 에 원본을 넣더라도 표현식에 새지 않게 한다.

### 인라인 인증 경로 폐지

`auth_config_id` 가 웹훅 인증의 단일 진입점이고 트리거 인라인 인증 경로(`trigger.config.authType` 등)는 쓰지 않는다.

1. 자격 증명 보관소 중복을 피한다. 인증 설정 도메인(인증 메뉴)이 발급·회전(재생성)·통계(`last_used_at`)·권한·마스킹을 이미 맡는다. 인라인은 같은 책임의 축소판이라 두 경로가 함께 있으면 일관성이 깨진다.
2. 회전 수단이 없었다. 인라인 시크릿은 `PATCH /api/triggers/:id` 부분 갱신으로만 바꿀 수 있었고 grace·즉시 무효화·감사가 없었다. 인증 설정은 `regenerate` 하나로 모았다. 2026-11-05 부터 재생성은 제품이 발급하는 비밀(API Key · Bearer Token · HMAC)에만 있다. Basic Auth 비밀번호는 설정을 지우고 다시 만들어 바꾼다([외부 호출 인증 설정 「재생성」](CLE-TRIG-AUTHCFG.md#재생성)).
3. `last_used_at` 을 갱신하지 못했다. 인라인은 사용 통계가 트리거 단위로 묶여 어떤 자격 증명이 마지막으로 쓰였는지 추적할 수 없었다.
4. `ip_whitelist` 가 우회됐다. 인증 설정의 `ip_whitelist` 가 인라인 경로에서는 시행되지 않았다.
5. 권한 모델을 우회했다. 인증 설정은 소유자·관리자만 CRUD 이고 편집자·뷰어는 읽기인데, 인라인은 트리거 CRUD 권한(편집자 이상)으로 자격 증명까지 고칠 수 있었다([워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md)).
6. 평문 시크릿이 JSONB 에 남았다. 평문 `bearerToken`/`secret` 이 `trigger.config` 에 드러나 백업·로그·재현 때 유출 위험이 있었다. `V066__trigger_config_strip_inline_auth.sql` 로 지웠다.

`auth_config_id IS NULL` 인 트리거는 인증 없음으로 동작한다.

### 빈 기대값과 복호화 불가 인증 설정을 거부한다 (2026-10-31)

인증 설정의 기대값이 비었거나 인증 설정이 복호화 불가 표식으로 읽히면 요청 값과 상관없이 `401 AUTH_FAILED` 로 거부한다. 이 규칙은 2026-10-31 에 문서에 적었다(NERV Task `CLE-T-KQ37NJ`).

- 기대값이 비어 있으면 빈 요청 값과 비교했을 때 같다고 판정돼 인증이 통과했다. `basic_auth` 설정의 사용자 이름과 비밀번호가 비어 있으면 빈 사용자 이름과 빈 비밀번호를 담은 `Authorization: Basic Og==` 가 통과했다. `hmac` 설정의 secret 이 비어 있으면 빈 키로 계산한 서명이 통과했다.
- 통합 암호화 키를 바꾸면 같은 구멍이 열린다. 옛 키로 암호화한 인증 설정은 복호화 불가 표식으로 읽히고 기대값을 하나도 읽지 못한다. 그래서 복호화 불가 표식도 빈 기대값과 같이 거부한다. 표식은 [통합 데이터와 흐름 「암호화」](../CLE-INT/CLE-INT-DATA.md#암호화) 가 정한다.
- 코드는 2026-10-10 에 `basic_auth` · `hmac` 에도 빈 기대값 거부를 넣었다. `bearer_token` · `api_key` 는 그 전부터 빈 기대값을 거부했다.
- 같은 개정에서 [보안 고려사항](#보안-고려사항) 의 비밀 키 저장 항목에 운영 환경 한정을 달았다. 운영 환경 밖에서 통합 암호화 키가 없으면 transformer 가 값을 평문으로 저장하고 이미 평문인 행은 그대로 두기 때문이다. 근거는 [시크릿 저장소 「R13. 통합 암호화 키를 마스터키와 따로 둔다」](../CLE-INT/CLE-INT-SECRET.md#r13-통합-암호화-키-integration_encryption_key-를-마스터키와-따로-두고-production-에서-키-없이-기동하지-않는다-2026-10-10) 에 있다.

### 문자열이 아닌 기대값과 헤더 이름도 401 로 거부한다 (2026-11-05)

인증 설정의 기대값이 문자열이 아니면 빈 기대값과 같이 `401 AUTH_FAILED` 로 거부한다. `api_key` 의 `config.headerName` 과 `hmac` 의 `config.header` 가 있는데 문자열이 아니어도 `401 AUTH_FAILED` 다. 이 규칙은 NERV Task `CLE-T-0Q768N` 이 정했다.

- 전에는 이런 설정으로 받은 요청이 500 으로 끝났다. 상수 시간 비교와 HMAC 계산이 문자열을 받는다고 가정해 비교 도중 오류가 났기 때문이다. 헤더 이름도 소문자로 바꾸는 도중 오류가 났다.
- 생성 API 는 Basic Auth 의 문자열이 아닌 사용자 이름·비밀번호를 400 으로 막는다([외부 호출 인증 설정 「Basic Auth」](CLE-TRIG-AUTHCFG.md#basic-auth)). 그래도 그 검증 전에 저장된 행이 남아 있을 수 있다. 다른 유형의 기대값은 제품이 발급하는 문자열이지만 비밀이 아닌 config 의 형식은 저장 때 검사하지 않는다. 그래서 인증 단계가 마지막 방어선이다.
- 500 대신 401 로 거부하는 이유는 두 가지다. 문자열이 아닌 기대값으로는 어떤 요청도 인증될 수 없으므로 빈 기대값과 결과가 같다. 그리고 인증 실패를 유형·원인과 상관없이 401 하나로 응답하는 규칙([인증](#인증))을 지킨다. 500 은 설정이 잘못됐다는 것을 외부 호출자에게 드러낸다.
- 헤더 이름이 없을 때 기본 헤더를 쓰는 동작은 그대로다. 문자열이 아닌 헤더 이름을 기본 헤더로 바꿔 비교하지 않는다. 관리자가 정한 헤더와 다른 헤더로 인증이 통과하면 안 되기 때문이다.
