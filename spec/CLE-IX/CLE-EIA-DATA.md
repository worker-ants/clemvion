---
id: "CLE-EIA-DATA"
title: "EIA 데이터와 흐름"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-IX"
ancestors: ["CLE-VISION", "CLE-IX"]
area: "CLE-IX"
content_hash: "75ef0a85776df449181f483283fa479165729923f4a8eaeee8fb6f2e10fdb3c8"
read_as: "approved_fallback"
task: "CLE-T-M6PERB"
source_paths: ["spec/1-data-model.md", "spec/5-system/14-external-interaction-api.md", "spec/data-flow/15-external-interaction.md"]
mirror_sha256: "5cd1f4744f6e0acde1851a3c6e5d407d7adaaee1b18bb28dd72d543bcd39d1ab"
etag: "sha256-ff6cdcf8f1ad6c1b0e1a3d5ee5f848415ef36226e46ee125b30c4955caa0e0b1"
---
> 구현 상태: 구현됨 · 원문: `spec/5-system/14-external-interaction-api.md` (§7), `spec/data-flow/15-external-interaction.md`, `spec/1-data-model.md` (§2.13.2) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

External Interaction API(EIA)는 워크플로우 실행을 외부 시스템과 외부 사용자에게 여는 경계 층이다. 데이터는 세 갈래로 흐른다.

1. **인바운드 명령**: 웹훅으로 시작한 실행이 입력 대기에 들어가면 외부 사용자가 `interact`·`cancel` 로 응답한다. 응답은 재개 큐를 거쳐 실행을 잇는다.
2. **SSE 스트림**: 실행의 실시간 이벤트(`execution.*`)를 웹채팅 위젯 같은 외부 클라이언트에 Server-Sent Events 로 보낸다.
3. **EIA 알림 웹훅**: 실행 이벤트를 외부 엔드포인트로 HMAC 서명한 HTTP POST 로 보낸다. BullMQ `notification-webhook` 큐를 거친다.

세 갈래 모두 인증의 바탕은 인터랙션 토큰이다. 실행 단위 토큰(`iext_*`)의 jti 는 실행 토큰 테이블(`ExecutionToken`, `execution_token`)로 영속 추적해 실행이 끝나면 곧바로 무효로 만든다.

이 문서는 EIA 가 더하는 엔티티(트리거 확장 컬럼·설정, 실행 토큰 테이블)와 "데이터가 어디서 생겨 어디로 흐르는가" 를 다룬다. API 필드 계약과 payload 모양은 [External Interaction API](CLE-EIA.md)·[EIA 수신 API와 SSE](CLE-EIA-INBOUND.md)·[EIA 알림 웹훅](CLE-EIA-NOTIFY.md) 이 정한다. 트리거 엔티티의 나머지 컬럼은 [트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md), 실행 엔티티는 [실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md) 이 정한다.

코드 진입점(`codebase/backend/src/modules/external-interaction/`):

- `interaction-token.service.ts`: 두 토큰 계열의 발급·검증·폐기(`InteractionTokenService`)
- `entities/execution-token.entity.ts`: 실행 토큰 테이블
- `interaction.guard.ts`·`interaction.controller.ts`·`interaction.service.ts`: `/api/external/executions/:executionId/*` REST(interact·cancel·refresh-token·상태 조회)
- `idempotency.interceptor.ts`: 멱등 키 24시간 Redis 캐시
- `interaction-stream.controller.ts` + `sse-adapter.service.ts`: SSE 스트림과 5분 재전송 버퍼
- `notification-fanout.service.ts` → `notification-dispatcher.service.ts` → `notification-webhook.processor.ts`: 알림 발송 파이프라인(+ `notification-signature.util.ts` HMAC)
- 발급 쪽 진입: `hooks/hooks.service.ts`(`buildInteractionResponse`), `triggers/triggers.service.ts`(시크릿 교체·`itk_*` 재발급)

## 엔티티

### 트리거 확장

트리거 테이블에 컬럼 네 개를 더한다. 발송 건강도와 시크릿 교체 추적에는 별도 컬럼이 필요하다. 나머지 설정은 새 컬럼을 만들지 않고 `Trigger.config` JSONB 에 둔다(마이그레이션 비용 최소화).

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `notification_health` | VARCHAR(16) NOT NULL DEFAULT `'unknown'` | 발송 건강도. `unknown`·`healthy`·`degraded` 만 받는다(CHECK `chk_trigger_notification_health`, V059) |
| `notification_last_error` | TEXT NULL | 마지막 발송 실패나 폭주 사유(500자로 자름). 응답에서는 자격 증명 모양을 가린다([응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md#310-트리거-응답의-마지막-오류-2026-10-05)) |
| `notification_secret_v2` | TEXT NULL | 시크릿 교체의 24시간 유예 동안 쓰는 새 알림 서명 시크릿의 평문 |
| `notification_rotated_at` | TIMESTAMPTZ NULL | 시크릿 교체 시각 |

트리거 테이블의 인덱스 목록은 [데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md#인덱스-목록) 가 기준이다. 위 EIA 컬럼에 걸린 인덱스는 발송 건강도가 `degraded` 인 트리거만 담는 부분 인덱스 `idx_trigger_notification_degraded`(V061) 하나다.

`Trigger.config` 에 더하는 필드:

```jsonc
{
  // 인증은 trigger.auth_config_id(FK → AuthConfig) 하나로 들어간다.
  // 옛 인라인 인증 필드(authType·secret·bearerToken·hmacHeader·hmacAlgorithm)는 폐지됐고
  // V066 정리 마이그레이션이 지운다. 남은 행에 있어도 코드는 무시한다

  "notification": {
    "url":     "https://...",
    "events":  ["execution.waiting_for_input", "execution.completed", ...],
    "signing": { "algorithm": "hmac-sha256", "secretRef": "secret://triggers/{triggerId}/notification-signing" },
    "retry":   { "maxAttempts": 5, "backoff": "exponential" }
  },
  "interaction": {
    "enabled":       true,
    "tokenStrategy": "per_execution" | "per_trigger",
    "triggerToken":  "itk_xxx",   // per_trigger 일 때만
    "appearance": {               // 선택. 웹채팅 운영 콘솔이 저장하는 위젯 외형(평면 저장)
      "locale":       "ko",          // "ko" | "en"
      "primaryColor": "#5B4FE9",     // #RRGGBB
      "position":     "bottom-right",// "bottom-right" | "bottom-left"
      "headerTitle":  "...",         // 80자 이하
      "welcomeText":  "...",         // 500자 이하
      "suggestions":  "...",         // 줄바꿈으로 나눈 추천 질문 문자열 하나, 1000자 이하
      "disclaimer":   "..."          // 500자 이하
    }
  }
}
```

- `interaction.appearance` 는 [External Interaction API](CLE-EIA.md) 의 트리거 등록 페이로드로 받아 저장하는 표시용 값이다. 토큰 발급·검증과 관계없다. 필드는 위 일곱 개이고 모두 선택이다. 허용 값(enum·hex·길이)은 현재 구현의 `WebChatAppearanceDto`(`web-chat-appearance.dto.ts`)가 강제한다. 콘솔 폼과 같은 평면 모양(`welcomeText`, 추천 질문 문자열 하나)으로 저장하고, 위젯 부팅 설정의 중첩 모양(`welcome.text`, `welcome.suggestions[]`)으로 옮기는 일은 클라이언트가 한다. 필드의 뜻과 변환은 [웹채팅 운영 콘솔](../CLE-WEBCHAT/CLE-WEBCHAT-CONSOLE.md) 이 정한다. PATCH 는 `interaction` 객체를 통째로 바꾸므로 `appearance` 없이 보내면 저장된 외형이 사라진다. 서버가 만든 `triggerToken` 을 PATCH 가 어떻게 다루는지는 다음 항목에 있다.
- **PATCH 와 서버가 만든 값**: PATCH 가 `config.interaction` 이나 `config.notification` 을 통째로 바꿀 때 서버가 만든 두 값은 트리거 설정 잠금(`acquireTriggerConfigLock`) 안에서 다시 읽은 행을 기준으로 다룬다.
  - `notification.signing.secretRef` 는 잠금 안에서 다시 읽은 행에 참조가 있으면 행의 값을 복사하지 않고 트리거 id 로 다시 만든 참조(`notificationSigningSecretRef(triggerId)`)를 싣는다. 참조가 있는지는 [시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 24 로 판정한다. 참조가 없을 때 옛 평문을 옮길지 첫 시크릿을 발급할지는 [EIA 알림 웹훅 「시크릿 교체」](CLE-EIA-NOTIFY.md#시크릿-교체) 가 정한다. 발급하는 경우가 EIA 알림 웹훅 설정을 처음 붙이는 것이고 그때는 아래 「저장 형태」 의 알림 서명 시크릿 항목대로 한다. 판정, 시크릿 저장소 쓰기(발급이나 옮기기), `config` 쓰기는 같은 트리거 설정 잠금 안에서 한다.
  - `interaction.triggerToken`(`itk_*`)은 PATCH 결과의 `interaction.tokenStrategy` 가 `per_trigger` 일 때만 이어받는다. 전략이 `per_trigger` 가 아니게 되면 저장된 `itk_*` 를 지운다. 그 토큰으로 연 SSE 스트림도 닫는다([트리거 단위 토큰](#트리거-단위-토큰)). 다시 `per_trigger` 로 바꾸면 트리거 단위 토큰 재발급(`revoke-token`)으로 새 토큰을 받는다. 옛 토큰은 다시 살아나지 않는다.
  - 두 값은 요청 본문으로 받지 않는다. top-level `interaction` · `notification` 본문에 실으면 전역 검증 파이프(`whitelist` + `forbidNonWhitelisted`)가 400 `VALIDATION_ERROR` 로 거부한다.
  - 채팅 채널 `botTokenRef` 보존과 목적이 같다([트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약)). 방식도 같다. 두 참조 모두 행의 값을 쓰지 않고 트리거 id 로 다시 만든다.
  - 원시 `config` 경로의 틈은 아래 「저장 형태」 의 `config.interaction.triggerToken` 항목에 있다.
- **`notification.retry`**: 발송할 때 `maxAttempts` 를 발송 큐 작업의 BullMQ `attempts` 로 넘긴다. `maxAttempts` 와 `backoff` 의 뜻은 [EIA 알림 웹훅](CLE-EIA-NOTIFY.md#재시도와-실패-처리) 의 「재시도와 실패 처리」 가 정한다.
- 설정 JSONB 는 키가 없으면 쓰지 않는 것으로 읽는다. 그래서 기존 트리거에 영향이 없다.

저장 형태:

- **알림 서명 시크릿**: `config.notification.signing.secretRef` 의 평문은 `SecretResolver` 가 관리하는 `secret_store` 테이블에 백엔드 AES-256-GCM 으로 암호화해 둔다. 정상 경로에서는 DB 에 암호문만 있고 설정 JSONB 에는 참조만 있다. 첫 시크릿은 서버가 발급한다. 발급하는 때는 `config.notification` 이 있는 트리거를 만들 때와 PATCH 가 `notification` 을 처음 붙일 때 두 가지다. 처음 붙이는지 판정하는 기준과 잠금은 위 「PATCH 와 서버가 만든 값」 에 있다. 서버는 `wsk_<64hex>` 를 만들어 트리거 id 로 정해지는 정식 참조(`secret://triggers/{triggerId}/notification-signing`)에 넣는다. `config` 에는 `signing.secretRef` 만 남긴다. 평문은 발급한 그 응답에만 한 번 싣는다. 응답 위치(`data.secrets.notificationSigningSecret`)는 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md#api) 가 정한다. 생성 때 발급은 [External Interaction API](CLE-EIA.md#트리거-등록과-웹훅-응답) 의 요구사항(승인 전 초안)을 따른다. 호출자가 원시 `config` 로 평문 `signing.secret` 을 보냈으면 서버는 그 값을 쓰고 발급하지 않는다. 이 평문은 만들거나 고칠 때 시크릿 저장소로 옮긴다(`normalizeNotificationSecretRef`). `signing.secret` 은 옛 키다. 타입 필드 `notification.signing` 은 `algorithm` 만 받으므로 이 평문은 원시 `config` 로만 들어온다. 서버는 그 `config` 를 먼저 저장하고 나서 시크릿 저장소로 옮긴다. 그래서 옮기기 전이나 옮기다 실패하면 JSONB 에 평문이 남는다. 원시 `config` 경로의 이 예외는 NERV Task `CLE-T-EA7B5M` 이 맡는다([트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md#미결-사항)).
- **`notification_secret_v2`**: 참조 대신 새 시크릿 평문 자체를 담는다. `rotateNotificationSecret` 이 `` `wsk_${randomBytes(32).toString('hex')}` `` 를 그대로 저장하고, 발송 쪽 `notification-webhook.processor.ts` 는 그 값을 `SecretResolver` 를 거치지 않고 보조 HMAC 키로 쓴다(주 키만 `resolveSigningSecret` 을 거친다). 같은 역할의 채팅 채널 컬럼 `chat_channel_token_v2` 는 참조를 담아 일부러 다르다. 두 컬럼은 뜻이 다르다(서명 시크릿 대 외부 봇 토큰). 컬럼 이름에 관한 결정은 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md), 저장 형태 예외의 기준은 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 가 정한다. 유예가 끝나 승격하면 값을 `secrets.rotate(canonical ref, v2)` 로 시크릿 저장소에 옮기고 컬럼을 `null` 로 비운다. 이 컬럼은 비밀이 잠시 머무는 경유지다.
- **`config.interaction.triggerToken`**: 설정 JSONB 에 평문으로 둔다. [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 가 정한 명시적 예외다(결정 2026-08-16). 이 예외는 값이 서버가 발급한 무작위 hex 로만 채워진다는 전제에 기댄다. 그런데 원시 `config` 로는 아직 호출자가 값을 정할 수 있다. 그래서 지금 구현은 이 전제를 강제하지 않는다. 이 틈은 NERV Task `CLE-T-EA7B5M` 이 닫는다. 이 예외를 다른 필드를 평문으로 두는 선례로 쓰지 않는다.
- **응답 비노출**: 위 평문 값들은 응답에 나가지 않는다. 어느 필드·컬럼이 대상인지와 시행 방식은 [시크릿 저장소 §규칙](../CLE-INT/CLE-INT-SECRET.md#규칙) 4~6 이 기준이라 여기서 목록을 되풀이하지 않는다. 현재 구현은 `TriggersService` 의 `TRIGGER_RESPONSE_STRIP_COLUMNS` 가 응답 경계에서 걷어 내고, `shared/testing/schedule-trigger-ref.ts`(스케줄 조인)와 `shared/testing/trigger-workflow-ref.ts`(트리거 직접 조회)가 부재를 단언한다. 저장 형태 예외(평문 보관)와 노출은 다른 문제다.
- 서버가 첫 시크릿을 발급한 트리거 생성 · 수정 응답과 시크릿 교체 응답이 새 시크릿을 한 번 평문으로 싣는 것([EIA 알림 웹훅](CLE-EIA-NOTIFY.md))과 이 컬럼이 유예 동안 평문인 것은 서로 다른 이야기다. 앞의 것은 응답이고 뒤의 것은 DB 저장이다.

### 실행

실행 엔티티에 새 컬럼은 없다. 이벤트 순번은 Redis 카운터(`exec:seq:<executionId>`)로 발급해 WebSocket 이벤트와 함께 쓴다. EIA 는 [대화 스레드](CLE-IX-THREAD.md) 가 둔 `Execution.conversation_thread` 를 읽는다. 상태 조회가 입력 대기일 때 이 스냅샷을 싣기 때문이다([EIA 수신 API와 SSE](CLE-EIA-INBOUND.md)). 컬럼 정의는 [실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md) 에 있다.

### 실행 토큰 테이블

실행 토큰 테이블(`ExecutionToken`, `execution_token`, V060)은 실행 단위 토큰(`iext_*`)의 발급 jti 를 영속 추적한다. 토큰 인증 자체는 JWT 무상태 검증이다. 그런데 실행이 끝날 때 그 실행이 발급한 토큰을 모두 찾아 한꺼번에 폐기하려면 발급 jti 목록이 필요하다. 폐기는 jti 를 Redis 블랙리스트에 올리고 이 행을 지우는 것이다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `jti` | TEXT | PK. JWT jti. Redis 블랙리스트 키 |
| `execution_id` | UUID | FK → Execution(ON DELETE CASCADE) |
| `issued_at` | TimestampTZ | 발급 시각(기본 `NOW()`) |
| `exp_at` | TimestampTZ | JWT 만료 시각. 종료 폐기 때 `(exp_at - now)` 를 Redis TTL 로 쓴다. 이미 만료된 jti 는 올리지 않는다 |

인덱스 `idx_execution_token_execution_id (execution_id)` 는 실행별 발급 토큰 일괄 폐기(`revokeAllForExecution`)와 종료 토큰 정리 작업(`execution_token ⋈ 종료된 execution`)에 쓴다. 한 실행은 갱신 흐름으로 jti 여러 개를 가질 수 있다(옛 jti 를 블랙리스트에 올린 뒤 새 jti 발급).

### 인터랙션 토큰 저장

- **실행 단위 토큰**: 검증에 필요한 값을 JWT 자체에 담아 무상태로 검증한다(`sub`=executionId, `aud`='interaction', `exp`, `jti`). 발급한 jti 는 실행 토큰 테이블에 기록한다. 폐기는 jti 마다 Redis 블랙리스트에 올리고(TTL = 만료까지) 행을 지운다. `InteractionGuard` 는 검증할 때 블랙리스트를 조회해 폐기된 토큰을 `TOKEN_REVOKED`(401)로 거부한다.
- **트리거 단위 토큰**: `Trigger.config.interaction.triggerToken` 에 둔다. 재발급하면 새 값으로 바꾼다.

## 데이터 흐름

### 토큰 발급

`config.interaction.enabled === true` 인 웹훅 트리거가 호출되면, 웹훅 진입 흐름([트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md))의 끝에서 `HooksService.buildInteractionResponse` 가 응답에 인터랙션 블록을 싣는다.

```mermaid
sequenceDiagram
  autonumber
  participant Ext as 외부 호출자
  participant Hk as HooksService
  participant Tok as InteractionTokenService
  participant PG as Postgres

  Ext->>Hk: POST /api/hooks/:endpointPath
  Hk->>Hk: execute(workflowId, ...) 로 executionId 생성
  alt tokenStrategy = per_execution (기본)
    Hk->>Tok: issuePerExecution(executionId)
    Tok->>Tok: HS256 JWT 서명 sub executionId, aud interaction, jti, exp now+1h
    Tok->>PG: INSERT execution_token (jti, execution_id, exp_at), 실패하면 경고 후 진행
    Tok-->>Hk: token iext_jwt, expiresAt, jti
    Hk-->>Ext: 202 data 안에 executionId, message, status pending, interaction token·expiresAt·endpoints
  else tokenStrategy = per_trigger
    Hk-->>Ext: 202 data 안에 executionId, message, status pending, interaction endpoints (토큰 없음, 호출자가 itk 보유)
  end
```

- 202 응답 모양 전체는 [웹훅 「수신 API」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#수신-api) 가 정한다. 인터랙션을 켠 트리거의 응답 `data` 에는 `status: "pending"` 과 인터랙션 블록 `interaction` 이 더해진다. 인터랙션 블록의 내용은 토큰 전략마다 다르다. `per_execution` 이면 `token`(이번 실행의 `iext_*`) · `expiresAt`(그 토큰의 만료 시각) · `endpoints` 를 싣는다. `per_trigger` 면 `endpoints` 만 싣는다. 호출자에게 트리거 단위 토큰이 이미 있기 때문이다.
- `endpoints` 는 `stream`·`submit`·`status`·`cancel`·`refresh` 다섯 개의 `/api/external/executions/:executionId/*` 경로다.
- 트리거 단위 토큰(`itk_*`, 32바이트 무작위 hex)은 트리거 단위 토큰 재발급 엔드포인트 `POST /api/triggers/:id/interaction/revoke-token`(`TriggersService.revokePerTriggerToken`)으로 발급·재발급한다. 새 토큰을 `trigger.config.interaction.triggerToken` 에 저장하고 평문은 응답에 한 번만 보인다. 가드가 요청마다 설정의 현재 값과만 비교하므로 바꾸는 즉시 옛 토큰은 새 요청에 대해 무효다. 옛 토큰으로 연 SSE 스트림은 서버가 닫는다([트리거 단위 토큰](#트리거-단위-토큰)). 트리거를 만들 때 서버가 `itk_*` 를 발급하는지는 [External Interaction API](CLE-EIA.md#미결-사항) 의 미결 사항이다.

### 인바운드 명령과 재개

```mermaid
sequenceDiagram
  autonumber
  participant Ext as 외부 클라이언트
  participant G as InteractionGuard
  participant Idem as IdempotencyInterceptor
  participant Svc as InteractionService
  participant Eng as ExecutionEngineService
  participant Q as Redis와 BullMQ

  Ext->>G: POST /api/external/executions/:id/interact (Bearer, Idempotency-Key 선택)
  alt iext 토큰
    G->>G: JWT 검증 HS256, aud interaction, sub 일치, 블랙리스트 GET iext:blacklist:jti
  else itk 토큰
    G->>G: execution.trigger_id 의 config.interaction.triggerToken 과 타이밍 안전 비교
  end
  G-->>Ext: 실패하면 401 TOKEN_* 와 X-Refresh-Token-Url
  Idem->>Q: GET interaction:idempotency:executionId:route:key
  Idem-->>Ext: 캐시 적중이면 같은 응답, 본문 해시가 다르면 409
  Idem->>Svc: 캐시 미스면 본 처리
  Svc->>Svc: 실행 조회, 종료면 410, 입력 대기가 아니면 409
  Svc->>Eng: 명령별 위임
  Eng->>Q: execution-continuation 큐에 적재
  alt 재개 큐 적재 실패 queued=false
    Svc-->>Ext: 503 EXECUTION_ENQUEUE_FAILED, 캐시하지 않음
    Note over Svc: HTTP 진입점만 503, 내부 신뢰 호출은 503 없음
  else 적재 성공
    Svc->>Q: 2xx·409·410 응답을 24시간 캐시
    Svc-->>Ext: 202 data 안에 executionId, accepted, currentStatus
  end
```

명령별 위임(`interaction.service.ts`). 외부 호출은 `expectedNodeId`(=`dto.nodeId`)를 함께 넘겨 publisher 가 실제 대기 노드와 맞춰 본다. 내부 신뢰 호출(채팅 채널)은 `undefined` 를 넘긴다.

| 명령 | 위임 대상 | 비고 |
|---|---|---|
| `submit_form` | `ExecutionEngineService.continueExecution(executionId, data, expectedNodeId)` | `nodeId`·`data` 필수 |
| `click_button` | `ExecutionEngineService.continueButtonClick(executionId, buttonId, expectedNodeId)` | `buttonId` 필수 |
| `submit_message` | `ExecutionEngineService.continueAiConversation(executionId, message, expectedNodeId)` | 멀티턴 AI 대화 |
| `end_conversation` | `ExecutionEngineService.endAiConversation(executionId, expectedNodeId)` | 없음 |
| `cancel`(또는 `POST /:id/cancel` 별칭) | `ExecutionsService.stop(executionId)` | 입력 대기가 아니어도 된다 |

- 위 네 진입점은 엔진에 남은 얇은 위임자로, 재개 큐에 명령을 발행한다. 큐를 소비한 뒤 재개 턴 처리는 협력 서비스가 맡는다(`processAiResumeTurn` → `AiTurnOrchestrator`, `processButtonResumeTurn` → `ButtonInteractionService`, `processFormResumeTurn` → `FormInteractionService`). 엔진 분할 결정은 [실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md) 에 있다.
- 모든 재개 명령은 영속 큐 `execution-continuation`(재개 큐)으로 들어간다. 발행자는 `ContinuationBusService` 이고, 큐와 워커는 [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md)·[실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md) 이 정한다. publisher 쪽 명령 사전 검증이 던지는 `InvalidExecutionStateError` 는 `409 STATE_MISMATCH` 로 바뀐다.
- 재개 큐 적재 실패: 발행자가 `queued:false` 를 돌려주면 명령은 503 `EXECUTION_ENQUEUE_FAILED` 로 응답한다. 네 재개 명령(`submit_form`·`click_button`·`submit_message`·`end_conversation`)과 입력 대기 실행의 `cancel` 이 모두 같다. `cancel` 은 `ExecutionsService.stop` 이 이미 이렇게 응답한다. 이 503 은 멱등 캐시에 넣지 않는다. 그래서 같은 멱등 키로 다시 보내면 새로 처리한다. 503 은 토큰으로 인증한 HTTP 진입점의 응답이다. 내부 신뢰 호출(`in_process_trusted`, 아래 항목)로 부른 재개 명령은 `queued:false` 여도 503 을 던지지 않는다. 그 웹훅 호출자에게 가는 응답은 [채팅 채널 「인바운드 HTTP 응답 계약」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약) 을 따른다. 발행 결과(`queued`)의 뜻은 [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md#발행-결과와-ack-에러-표면) 이 정한다. 이 에러 코드의 적용 범위는 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 가 정한다.
- 내부 신뢰 호출: 채팅 채널 인바운드(`hooks.service.ts` 의 `handleChatChannelWebhook`)는 HTTP 를 거치지 않고 `scope: 'in_process_trusted'` 컨텍스트를 직접 만들어 같은 위임을 부른다. 토큰 검증을 건너뛰는 것은 서버 내부 모듈만 할 수 있다(타입 union 으로 컴파일러가 강제). 흐름은 [채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md) 에 있다.
- 토큰 갱신: `POST /:id/refresh-token` 은 `iext_*` 만 받는다(`itk_*` 는 403). 만료 30분 이내(`IEXT_REFRESH_WINDOW_SEC`)에만 새로 발급한다. 옛 jti 를 곧바로 블랙리스트에 올리고 실행 토큰 테이블에서 지운 뒤 새 jti 를 넣는다. 종료된 실행은 410 이다.
- 종료된 실행의 응답 코드: 위 시퀀스의 410 과 토큰 갱신의 410 은 서비스가 내는 코드다. 실행이 끝나면 그 실행의 `iext_*` 를 바로 폐기한다. 그래서 `iext_*` 로 보낸 요청은 보통 가드에서 401 `TOKEN_REVOKED` 로 먼저 막힌다. 410 은 폐기가 빠졌을 때나 `itk_*` 로 보낸 명령에서 나온다. 어느 코드를 정상 경로 코드로 둘지는 [External Interaction API](CLE-EIA.md#미결-사항) 의 미결 사항이다.
- 상태 조회: `GET /:id` 는 실행 행과 대기 중인 노드 실행 출력, 영속 대화 스레드를 읽는 읽기 전용 경로다. 응답 모양은 [EIA 수신 API와 SSE](CLE-EIA-INBOUND.md) 가 정한다. `seq` 는 늘 `0` 이고 순번은 SSE `Last-Event-Id` 로 맞춘다.

### SSE 스트림

원천은 실행 엔진이 내는 WebSocket 이벤트 단일 싱크(`WebsocketService`)다. SSE 는 그 흐름의 어댑터일 뿐 이벤트를 스스로 만들지 않는다.

```mermaid
flowchart TD
  A[실행 엔진] -->|emitExecutionEvent·emitNodeEvent| B[WebsocketService]
  B -->|순번 발급 Redis INCR exec:seq| C[executionEvents 서버 안 RxJS Subject]
  C --> D[SseAdapter 실행별 메모리 버퍼 5분·최대 1000건]
  C --> E[NotificationFanout 알림 발송]
  F[외부 클라이언트 GET stream] --> G{InteractionGuard 토큰 검증}
  G -->|동시 연결 상한 초과| H[429 TOO_MANY_CONNECTIONS]
  G -->|통과| I{Last-Event-Id 이후 구간이 버퍼에 온전한가}
  I -->|예| J[버퍼에서 재전송 후 실시간 합류]
  I -->|아니오| K[execution.replay_unavailable 한 번 전송, id 줄 생략]
  D --> J
  J --> L[종료 이벤트 전송 후 연결 종료]
  K --> J
```

- 프레임은 `event: <eventType>` / `id: <seq>` / `data: <JSON payload>` 이고 15초마다 heartbeat 주석을 보낸다. 제어 프레임(`execution.replay_unavailable`, 순번 0 이하)은 `id:` 줄을 생략한다.
- EventSource 호환을 위해 `?token=` 쿼리를 허용한다.
- 스트림은 열 때 토큰을 검증한다. 스트림은 그 실행의 종료 이벤트를 보낸 뒤 끝난다. 트리거 단위 토큰으로 연 스트림은 종료 이벤트 전이라도 그 토큰이 무효가 되면 서버가 닫는다([트리거 단위 토큰](#트리거-단위-토큰)). 실행 단위 토큰으로 연 스트림은 토큰이 만료되거나 갱신돼도 닫지 않는다([실행 단위 토큰](#실행-단위-토큰)).
- 동시 연결 상한의 수치는 [HTTP API 규약](../CLE-API/CLE-API-CONV.md#7-요청-빈도-제한) 의 요청 빈도 제한 표가 정한다.
- SSE 의 `id:` 와 알림 웹훅의 `seq` 는 같은 카운터(Redis `exec:seq:<id>`)를 쓴다. 클라이언트는 SSE 와 EIA 알림 웹훅으로 받은 이벤트를 한 순서로 정렬할 수 있다.
- 1차 범위의 버퍼는 서버 인스턴스 하나의 메모리다. 서버 인스턴스가 둘 이상이면 다른 서버 인스턴스가 낸 이벤트는 이 버퍼에 들어오지 않는다([SSE 버퍼를 단일 인스턴스 메모리에 둔다](#sse-버퍼를-단일-인스턴스-메모리에-둔다)). 분산 fan-out 은 후속 작업이다(`sse-adapter.service.ts` 주석). 이 작업은 NERV Task `CLE-T-Z35F7P` 가 맡는다.
- 대표 소비자는 웹채팅 위젯이다(`codebase/channel-web-chat/src/lib/eia-client.ts` 가 EventSource 로 이 경로를 구독). 위젯 부팅과 CORS 판정(`WebChatCorsOriginResolver` 가 실행 → 임베드 허용 도메인 `workspace.settings.interactionAllowedOrigins` 를 풀고 60초 캐시)은 [웹채팅 구조](../CLE-WEBCHAT/CLE-WEBCHAT-ARCH.md)·[웹채팅 보안](../CLE-WEBCHAT/CLE-WEBCHAT-SECURITY.md) 이 다룬다.

### 알림 웹훅 발송

```mermaid
sequenceDiagram
  autonumber
  participant WS as WebsocketService 단일 싱크
  participant Fan as NotificationFanout
  participant Tok as InteractionTokenService
  participant Disp as NotificationDispatcher
  participant Proc as NotificationWebhookProcessor
  participant PG as Postgres
  participant Ext as 외부 엔드포인트

  WS->>Fan: execution.* 이벤트
  alt 종료 이벤트 completed·failed·cancelled
    Fan->>Tok: revokeAllForExecution, 실행 토큰 jti 전부 블랙리스트와 행 삭제
  end
  Fan->>Fan: triggerId 없으면 건너뜀(수동 실행), events 구독 확인
  Fan->>Disp: enqueue(envelope), 커밋 뒤 시점
  Disp->>Proc: notification-webhook 큐 jobId=deliveryId, attempts = retry.maxAttempts(기본 5), base-4 backoff
  Proc->>PG: 트리거 다시 조회(삭제됐으면 건너뜀), SSRF 검사, 낡은 알림 검사
  Proc->>Proc: 시크릿 가져오기(secretRef, v2 보조) 후 HMAC 서명
  Proc->>Ext: HTTP POST 10초 제한, X-Clemvion-* 헤더와 서명
  alt 2xx
    Proc->>Proc: 트리거당 분당 발송 수 세기(Redis, fail-open)
    alt 분당 60 초과
      Proc->>PG: notification_health degraded, 폭주 전용 last_error (발송은 계속)
    else 정상
      Proc->>PG: notification_health healthy, last_error NULL
    end
  else 실패
    Proc-->>Disp: 예외로 backoff 재시도, 마지막 시도도 실패하면 degraded 와 last_error
  end
```

단계별 사실(`notification-fanout.service.ts`·`notification-webhook.processor.ts`):

- **fanout 대상 이벤트 다섯 가지**: `execution.waiting_for_input`·`completed`·`failed`·`cancelled`·`ai_message`. 종료 때의 jti 폐기는 EIA 알림 웹훅 설정(`config.notification`) 유무와 관계없다. 인터랙션만 켠 트리거도 종료 때 토큰이 무효가 된다.
- **낡은 알림 차단**: 진행 중 성격의 `waiting_for_input`·`ai_message` 는 보내기 직전 실행 상태를 다시 확인해 이미 종료면 건너뛴다(재시도해도 의미 없음).
- **SSRF**: 등록 때(`TriggersService.assertNotificationUrlSafe`)와 발송 직전(`checkSsrfSafeUrl`) 두 번 검증한다. DNS rebinding 가드는 `NOTIFICATION_ENFORCE_DNS_REBIND_GUARD=1` 일 때만 켠다(기본 꺼짐).
- **서명**: `X-Clemvion-Signature: t=<unix>,v1=<hex>[,v1=<v2hex>]`(`notification-signature.util.ts`). 정규형 `{timestamp}.{rawBody}`, 알고리즘 `hmac-sha256`(기본)·`hmac-sha512`. 시크릿이 없거나 가져오지 못하면 서명 없이 보내지 않고 저하로 처리한다. 주 시크릿이 없으면 v2 가 있어도 같다. v2 는 주 시크릿이 있을 때 보조 서명으로만 쓴다. 교체 유예 중에는 `notification_secret_v2` 로도 서명해 `v1=` 를 두 개 싣는다.
- **실패 정책**: 마지막 시도가 실패해도 트리거를 끄지 않는다. `notification_health`·`notification_last_error`(500자로 자름)만 갱신한다. BullMQ `removeOnComplete` 24시간, `removeOnFail` 7일이다.
- **폭주 감지**: 발송 성공(2xx)마다 `OutboundNotificationRateLimiterService.consume`(Redis 고정 윈도우 `INCR`+`EXPIRE NX`, fail-open)이 트리거당 분당 발송 수를 센다. 60건을 넘으면 `healthy` 대신 `degraded` 와 폭주 전용 `notification_last_error` 로 표시한다(발송 실패 저하와 원인 구분). 초과분도 계속 보낸다([EIA 알림 웹훅](CLE-EIA-NOTIFY.md)).

### 서명 시크릿 교체와 승격

```mermaid
flowchart TD
  A[POST /api/triggers/:id/notification/rotate-secret] --> B[새 시크릿 wsk_64hex 생성]
  B --> C[트리거 설정 잠금 안에서 notification_secret_v2 에 평문, notification_rotated_at = NOW, 유예 중이면 앞의 v2 를 덮음]
  C --> D[응답에 평문 한 번 반환]
  C --> E[24시간 유예: 주 시크릿과 v2 로 두 번 서명]
  E --> F[notification-secret-rotator 매시 정각 승격 작업]
  F --> G{rotated_at 이 24시간 지났나}
  G -->|예| H{잠금 안에서 승격 조건을 확인했나}
  H -->|예| I[같은 잠금 안에서 secrets.rotate 로 정식 참조 내용 교체, signing.secretRef 연결, notification_secret_v2·notification_rotated_at 비움]
  H -->|아니오| E
  G -->|아니오| E
```

- 승격은 `TriggersService.promoteRotatedNotificationSecrets` 가 한다. `rotated_at ≤ now-24h` 인 트리거의 v2 를 시크릿 저장소 정식 참조(`secret://triggers/<id>/notification-signing`) 내용으로 바꾸고 `signing.secretRef` 를 연결한다.
- 승격은 평문을 설정에 쓰지 않는다. `secrets.rotate(canonical ref, v2)` 로 시크릿 저장소 내용을 바꾸고, `signing.secretRef` 를 정식 참조로 맞추고, 옛 `signing.secret` 평문 키를 지운다(`normalizeNotificationSecretRef` 와 같은 참조 규약). 발송 쪽 `resolveSigningSecret` 이 `secretRef` 를 먼저 보므로, 승격 즉시 새 시크릿으로 주 서명이 바뀐다.
- 교체와 승격은 같은 트리거 설정 잠금(`acquireTriggerConfigLock`)을 잡는다([트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md#동시-쓰기-직렬화)). 유예 중에 `rotate-secret` 을 다시 부르면 앞의 새 시크릿(v2)을 덮고 `notification_rotated_at` 을 지금 시각으로 바꾼다. 그래서 24시간 유예를 처음부터 다시 센다. 승격은 대상 트리거의 v2 를 먼저 고른다. 그 뒤 잠금 안에서 승격 조건을 확인한다. 조건이 맞을 때만 같은 잠금 안에서 v2 를 정식 참조로 옮기고 v2 와 `notification_rotated_at` 을 비운다. 확인보다 먼저 옮기면 그사이 재교체로 덮인 옛 v2 가 주 시크릿이 된다. 승격 조건은 [EIA 알림 웹훅 「시크릿 교체」](CLE-EIA-NOTIFY.md#시크릿-교체) 가 정한다.
- EIA 알림 웹훅 설정(`config.notification`)이 없는 트리거는 승격하지 않는다. 서명할 대상이 없으므로 v2 와 `notification_rotated_at` 을 비운다. 이때 경고 로그를 남긴다.

## 저장소 매핑

### Postgres

| 테이블 | 흐름 | 읽고 쓰는 컬럼 | 비고 |
|---|---|---|---|
| `execution_token` | `iext_*` 발급 | INSERT `(jti, execution_id, issued_at, exp_at)` | 한 실행이 갱신으로 jti 여러 개를 가질 수 있다. INSERT 실패는 경고 후 진행 |
| `execution_token` | 갱신·종료 폐기 | DELETE `WHERE jti=?`(갱신) / `WHERE execution_id=?`(종료 일괄) | `idx_execution_token_execution_id` 단일 조회. `iext_*` 를 발급하지 않은 실행은 아무 일도 없다 |
| `trigger.config`(JSONB) | 인터랙션 설정 | `interaction.enabled`·`interaction.tokenStrategy`·`interaction.triggerToken`(`itk_*` 평문)·`interaction.appearance` | 1급 컬럼이 아니다. PATCH 는 결과 전략이 `per_trigger` 일 때만 `triggerToken` 을 다시 읽은 행에서 이어받고 아니면 지운다 |
| `trigger.config`(JSONB) | EIA 알림 웹훅 설정 | `notification.url`·`notification.events[]`·`notification.signing.{algorithm, secretRef, secret(옛 키)}`·`notification.retry.{maxAttempts, backoff}` | 생성이나 EIA 알림 웹훅 설정을 처음 붙이는 PATCH 때 서버가 발급한 `wsk_*` 의 참조를 `secretRef` 에 둔다. PATCH 는 다시 읽은 행에 `secretRef` 가 있으면 트리거 id 로 다시 만들어 싣는다. 원시 `config` 로 받은 평문 `signing.secret` 은 만들거나 고칠 때 시크릿 저장소로 옮긴다. 이때는 서버가 발급하지 않는다 |
| `trigger` | 발송 건강도 | UPDATE `notification_health`(`healthy`·`degraded`), `notification_last_error` | 발송 프로세서가 성공·최종 실패 때 |
| `trigger` | 시크릿 교체 | 트리거 설정 잠금 안에서 UPDATE `notification_secret_v2`(평문), `notification_rotated_at`. 승격 때 NULL 로 비움 | [서명 시크릿 교체와 승격](#서명-시크릿-교체와-승격) |
| `execution` | 인바운드 검증 | SELECT `status`(종료·입력 대기 검사, `itk_*` 의 `trigger_id` 대조). interact 는 실행 행을 직접 쓰지 않는다(재개 워커가 갱신) | 없음 |
| `execution` | 상태 조회 | SELECT `status`·`result`·`error`·`duration_ms`·`conversation_thread` | 대기 노드 실행 출력도 읽는다 |

### Redis 와 BullMQ

키 형태 규칙은 [Redis 키 명명 규약](../CLE-ENG/CLE-ENG-REDIS.md), 저장소 전체 목록은 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 이 기준이다. 아래 표는 EIA 가 소유한 키와 큐의 상세(용도·TTL·정책)다.

| 저장소 | 키·큐 | 흐름 | TTL·정책 |
|---|---|---|---|
| Redis | `iext:blacklist:<jti>` | 종료 이벤트·갱신 때 SET | TTL = 원래 JWT 만료까지. Redis 를 못 쓰면 fail-open(검증도 fail-open + 경고) |
| Redis | `interaction:idempotency:<executionId>:<route>:<key>` | 명령 응답 캐시 `{ bodyHash, responseJson, statusCode }` | 24시간. 캐시 대상은 `2xx`·`409`·`410` 뿐이다. 같은 키에 다른 본문은 409. 항목이 손상되면(형태 불일치·`responseJson` 파싱 실패) 버리고 새로 처리하며 경고한다(500 아님). 키는 가드가 검증한 `executionId` 와 경로(`interact`·`cancel`)로 묶는다([EIA 수신 API와 SSE](CLE-EIA-INBOUND.md)) |
| Redis | `exec:seq:<executionId>` | `INCR`. SSE `id:`·EIA 알림 웹훅 `seq` 공용 카운터 | 발급마다 만료를 늘리는 슬라이딩 TTL 이다. 종료 이벤트 뒤에는 가능하면 지운다. 기본값과 해제 규칙은 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md)·[WebSocket 연결과 채널 구독](../CLE-API/CLE-API-WS.md) 이 정한다 |
| Redis | `eia:rl:interact:<executionId>`, `eia:rl:status:<executionId>`, `eia:notif:rl:<triggerId>` | 인바운드 명령·상태 조회의 요청 빈도 제한, EIA 알림 웹훅 발송의 폭주 감지 | 고정 윈도우, fail-open. 한도는 [External Interaction API](CLE-EIA.md) |
| BullMQ | `notification-webhook` | `NotificationDispatcher.enqueue` → `NotificationWebhookProcessor` | `jobId`=deliveryId 로 중복 제거, `attempts` 는 트리거의 `notification.retry.maxAttempts`(뜻은 [EIA 알림 웹훅](CLE-EIA-NOTIFY.md#재시도와-실패-처리)), base-4 사용자 정의 backoff(워커 `settings.backoffStrategy`, 1초에서 4배씩 늘어나는 간격), `removeOnComplete` 24시간, `removeOnFail` 7일 |
| BullMQ | `notification-secret-rotator` | 매시 반복(`0 * * * *`) → v2 승격 | `upsertJobScheduler` 멱등. 여러 서버 인스턴스에서 전역 한 번 |
| BullMQ | `terminal-revoke-reconcile` | 분마다 반복(`* * * * *`) → 종료된 실행에 남은 실행 토큰 정리 → `revokeAllForExecution`(`TerminalRevokeReconcilerService`) | `upsertJobScheduler` 멱등. 전역 한 번. 즉시 경로 누락분을 최소 한 번 보강한다. 실행 토큰 테이블이 영속 outbox 역할을 하므로 전용 테이블이 없다 |
| BullMQ | `webchat-idle-reaper` | 분마다 반복 → 공개 웹훅(`auth_config_id IS NULL`)이 시작한 입력 대기 실행 가운데 실행 토큰 행이 하나 이상 있고 가장 늦은 `execution_token.exp_at` 뒤로 유예 시간(`WEBCHAT_IDLE_REAP_GRACE_MS`)이 지난 실행 → 엔진 `markWebChatIdleTimeout`(조건부 UPDATE `cancelled`·`cancelledBy='timeout'`·`error.code='WEBCHAT_IDLE_TIMEOUT'`) + `revokeAllForExecution`(`WebChatIdleReaperService`) | `upsertJobScheduler` 멱등. 전역 한 번. 종료 토큰 정리 작업의 형제(같은 원천, 다른 큐·서비스). 판정이 실행 토큰 행에서 시작하므로 토큰 행이 없는 실행은 대상이 아니다. 채팅 채널 실행, 인터랙션을 끈 웹훅 실행, 트리거 단위 토큰을 쓰는 실행이 여기 든다. 웹채팅 위젯 유휴 실행 회수 전용 |
| BullMQ | `execution-continuation` | 인바운드 명령 위임의 도착지(발행자 ContinuationBus) | 큐 기준은 [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) |
| 메모리 | `SseAdapter.buffers` | 실행별 링 버퍼 | 5분 보관, 최대 1000건. 단일 서버 인스턴스 한정 |

## 상태 전이

### 실행 단위 토큰

```mermaid
stateDiagram-v2
  state "유효" as Valid
  state "폐기됨" as Revoked
  state "만료됨" as Expired
  [*] --> Valid: 웹훅 응답에 담아 발급, execution_token INSERT
  Valid --> Valid: 만료 30분 이내 갱신, 옛 jti 블랙리스트와 삭제 뒤 새 jti 발급
  Valid --> Revoked: 실행 종료 이벤트, 즉시 경로와 분 단위 정리
  Valid --> Expired: exp 경과, 기본 1시간
  Revoked --> [*]: Redis TTL 만료, 원래 exp
  Expired --> [*]
```

- 검증 실패 사유는 401 코드로 이렇게 바뀐다(`interaction.guard.ts`). `expired` → `TOKEN_EXPIRED`, `blacklisted` → `TOKEN_REVOKED`, `scope_mismatch` → `TOKEN_SCOPE_MISMATCH`, `audience_mismatch` → `TOKEN_AUDIENCE_MISMATCH`, 그 밖 → `TOKEN_INVALID`.
- 종료 폐기는 최소 한 번이다. 즉시 경로(`NotificationFanout` 의 종료 이벤트 구독)가 프로세스 재시작·장애로 빠지면 `terminal-revoke-reconcile` 정리 작업(분 단위)이 종료된 실행에 남은 실행 토큰을 정리한다. 그래서 누락 때 최악의 폐기 지연은 즉시 경로만 있을 때의 토큰 수명(1시간)에서 1분 이하로 줄어든다([External Interaction API](CLE-EIA.md)).
- 다만 Redis(블랙리스트 SET·BullMQ) 전면 장애 중에는 두 경로 모두 fail-open 이라 다음 회차나 복구 시점까지 폐기가 늦어진다. 블랙리스트 조회도 fail-open 이므로 그 창에서 토큰이 통과할 수 있다. 새 요청에 대한 최종 안전망은 만료다(보안 trade-off 는 `interaction-token.service.ts` 클래스 주석).
- 실행 단위 토큰으로 연 SSE 스트림은 토큰이 스트림 도중 만료되거나 갱신돼도 닫지 않는다. 스트림은 그 실행의 종료 이벤트까지 이어진다. 공개 웹훅(`auth_config_id IS NULL`)이 시작한 입력 대기 실행은 토큰이 만료되고 유예 시간이 지나면 웹채팅 위젯 유휴 실행 회수(`webchat-idle-reaper`)가 취소한다. 그때 종료 이벤트로 스트림도 닫힌다. 인증 설정이 연결된 웹훅이 시작한 입력 대기 실행은 기한 없이 멈춰 있을 수 있어 그 스트림에는 정해진 상한이 없다. 대응은 실행 취소다. 취소하면 `execution.cancelled` 종료 이벤트로 스트림이 닫힌다. 이유는 [재검토에서 갈린 EIA 동작을 정한다](#재검토에서-갈린-eia-동작을-정한다-2026-10-09) 에 있다.

### 트리거 단위 토큰

재발급 엔드포인트로 발급하면 `config.interaction.triggerToken` 이 바뀌고 옛 토큰은 새 요청에 대해 곧바로 무효다. PATCH 결과의 전략이 `per_trigger` 이면 값은 그대로 남는다. 전략이 `per_trigger` 가 아니게 되면 PATCH 가 값을 지운다. 다시 `per_trigger` 로 바꾸면 재발급 엔드포인트로 새 토큰을 받는다. 옛 토큰은 다시 살아나지 않는다. 트리거를 지우면 설정과 함께 사라진다. 수명과 갱신 개념이 없다. 가드는 설정의 `tokenStrategy` 가 `per_trigger` 일 때만 이 값을 쓴다. 이때 요청마다 현재 설정 값과 타이밍 안전 비교를 한다(SHA-256 해시 뒤 `timingSafeEqual`, 길이 노출 차단). SSE 스트림은 열 때 토큰을 검증한다. 트리거 단위 토큰이 무효가 되면 서버는 그 토큰으로 연 SSE 스트림을 닫는다. 무효가 되는 경우는 세 가지다. 재발급 엔드포인트로 새 토큰을 발급할 때, PATCH 가 전략을 바꿔 값을 지울 때, 트리거를 지울 때다. 서버는 SSE 응답을 끝내 스트림을 닫는다. 새 이벤트 이름은 만들지 않는다. 클라이언트가 옛 토큰으로 다시 연결하면 가드가 401 로 거부한다. 지금은 토큰을 무효로 만든 요청을 처리한 서버 인스턴스에 붙은 스트림만 닫는다. SSE 버퍼가 서버 인스턴스 하나를 전제로 하기 때문이다([SSE 버퍼를 단일 인스턴스 메모리에 둔다](#sse-버퍼를-단일-인스턴스-메모리에-둔다)). 여러 서버 인스턴스로 넓히는 일은 NERV Task `CLE-T-Z35F7P` 가 맡는다. 실행 단위 토큰으로 연 스트림은 만료나 갱신으로 닫지 않는다([실행 단위 토큰](#실행-단위-토큰)). WebSocket 은 소켓 수명을 토큰 수명에 묶는다([WebSocket 연결과 채널 구독](../CLE-API/CLE-API-WS.md#소켓-수명을-토큰-수명에-묶는다-2026-09-02)). 두 방식의 관계는 [재검토에서 갈린 EIA 동작을 정한다](#재검토에서-갈린-eia-동작을-정한다-2026-10-09) 에 있다.

### 알림 서명 시크릿

```mermaid
stateDiagram-v2
  state "주 시크릿만" as Primary
  state "유예: 주 시크릿과 v2 이중 서명" as Grace
  [*] --> Primary: 트리거 생성이나 EIA 알림 웹훅 설정을 처음 붙이는 PATCH 때 서버가 wsk 시크릿 발급
  Primary --> Grace: rotate-secret 호출
  Grace --> Grace: 유예 중 rotate-secret 재호출, 앞의 v2 를 덮고 유예를 다시 시작
  Grace --> Primary: 매시 승격 작업이 24시간 지난 v2 를 승격하고 비움
```

유예 동안에는 주 시크릿과 v2 로 두 번 서명한다.

## 외부 의존

| 의존 | 방향 | 참고 |
|---|---|---|
| 외부 웹훅 엔드포인트 | 내부 → 외부 HTTP POST | `2xx` 만 성공. 10초 제한. SSRF 이중 검증. 검증 쪽 헬퍼 `verifySignatureHeader`(±5분 허용)는 EIA 클라이언트 SDK 와 테스트가 다시 쓰도록 export |
| 외부 클라이언트(EventSource·fetch) | 외부 → 내부 | 웹채팅 위젯(`channel-web-chat`)이 대표 소비자 |
| Redis | 내부 | 블랙리스트·멱등 캐시·순번·요청 빈도 제한·BullMQ. 못 쓰거나 캐시가 손상되면 fail-open(가용성 우선). 경로마다 경고를 남기되 기동 때 미주입(설정 상태)만 예외다. EIA 키는 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 에 올라 있다. 실행 엔진 표는 엔진 소유 키 전용이라 EIA 키가 없는 것이 정상이다 |
| Telegram·Slack·Discord 같은 메신저 | 간접 | 내부 신뢰 호출의 상류([채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md)) |

## 구현 위치

- `codebase/backend/src/modules/external-interaction/entities/execution-token.entity.ts`
- `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` (발급·검증·`revokeAllForExecution`·`reconcileTerminalRevocations`)
- `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.ts`
- `codebase/backend/src/modules/external-interaction/webchat-idle-reaper.service.ts`
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` (명령 위임, 재개 큐 적재 실패 응답)
- `codebase/backend/src/modules/external-interaction/sse-adapter.service.ts`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
- `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts`
- `codebase/backend/src/modules/external-interaction/notification-dispatcher.service.ts`
- `codebase/backend/src/modules/external-interaction/notification-dispatcher.types.ts` (base-4 backoff)
- `codebase/backend/src/modules/external-interaction/notification-webhook.processor.ts`
- `codebase/backend/src/modules/external-interaction/notification-signature.util.ts`
- `codebase/backend/src/modules/external-interaction/outbound-notification-rate-limiter.service.ts`
- `codebase/backend/src/modules/hooks/hooks.controller.ts` (웹훅 202 응답의 `message`)
- `codebase/backend/src/modules/hooks/hooks.service.ts` (`buildInteractionResponse`, `handleChatChannelWebhook`)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (`create`, `mergeExternalConfig`, `revokePerTriggerToken`, `rotateNotificationSecret`, `promoteRotatedNotificationSecrets`, `normalizeNotificationSecretRef`, `TRIGGER_RESPONSE_STRIP_COLUMNS`)
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (`acquireTriggerConfigLock`)
- `codebase/backend/src/shared/testing/schedule-trigger-ref.ts` (응답 비노출 단언)
- `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` (응답 비노출 단언)
- `codebase/backend/migrations/V059` (트리거 확장 컬럼과 `notification_health` CHECK)
- `codebase/backend/migrations/V060` (실행 토큰 테이블)
- `codebase/backend/migrations/V061` (발송 건강도 부분 인덱스)

## Rationale

### EIA 흐름을 실행 흐름과 나눠 적는다

인바운드 REST·SSE·알림 웹훅 세 흐름은 하나의 토큰·이벤트 라이프사이클을 함께 쓴다. 종료 이벤트 하나가 SSE 종료·토큰 폐기·알림 발송을 동시에 일으킨다. [실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md) 에 합치면 실행 엔진 내부 흐름과 경계 층 흐름이 섞인다. 인앱 알림 흐름([알림](../CLE-OBS/CLE-OBS-NOTIFY.md))은 인앱 `notification` 테이블 영역이라 외부 웹훅 발송과 어휘만 겹칠 뿐 도착지가 전혀 다르다. 모듈 응집도에 맞춰 한 문서에 둔다.

### 모든 흐름이 단일 싱크에서 출발한다

SSE 와 알림 흐름이 모두 `WebsocketService.executionEvents$` 에서 출발하는 것은 구현 사실이자 설계 결정이다([External Interaction API](CLE-EIA.md) 의 단일 싱크 결정). 엔진은 여전히 `WebsocketService` 만 부르고, SSE 어댑터와 `NotificationFanout` 은 그 Subject 의 구독자로 떨어져 있다. 데이터 흐름으로 보면 "이벤트 원천이 하나" 라서 순번 공유와 종료 때 일괄 후처리(토큰 폐기)가 자연스럽게 한 지점에 묶인다.

### 인프라 장애에는 fail-open 한다

토큰 블랙리스트·멱등 캐시·jti 추적·알림 적재는 모두 Redis·DB 를 못 쓸 때 fail-open 이다(기능 저하 + 경고 로그). 멱등 캐시는 적재된 항목 자체가 손상된 경우에도 fail-open 이다.

- 원인은 두 축이다. "미가용"(Redis 가 죽었다)과 "손상"(Redis 는 살아 있는데 값이 오염됐다)은 다른 실패다. 손상은 항목 형태 불일치나 `responseJson` 파싱 실패로 나타난다. 예전에는 그 예외가 그대로 올라가 500 이 됐는데, 이는 fail-open 원칙과 정반대였다. 지금은 손상 항목을 버리고 새 처리로 내린다.
- 경고는 다섯 경로 중 넷에 붙는다. `IdempotencyInterceptor` 의 (1) 기동 때 미주입, (2) 조회 실패, (3) 적재 실패, (4) 직렬화 실패, (5) 항목·payload 손상 가운데 (1)만 경고하지 않는다. Redis 를 붙이지 않은 것은 장애로 보지 않고 설정 상태로 본다. 나머지는 운영자가 저하 구간을 알아야 하므로 반드시 로그를 남긴다.
- 근거는 "인터랙션·알림은 워크플로우 실행의 부수 채널이며, 인프라 장애가 실행 자체를 멈추면 안 된다" 는 모듈 전체의 결정이다(`interaction-token.service.ts`·`notification-dispatcher.service.ts` 주석). 표마다 정책을 적어 운영자가 저하 모드의 남은 위험을 추적하게 했다. 블랙리스트 미적용이면 만료까지 토큰이 유효하고, 멱등 저하면 같은 멱등 키 재요청이 모두 캐시 미스가 되어 다운스트림이 중복 실행될 수 있다.
- 멱등 쪽 남은 위험은 창 크기가 다르다. 정상일 때도 GET 과 SET 이 원자적이지 않아 좁은 창이 있지만, Redis 장애가 이어지는 동안에는 그 창이 장애 구간 전체로 넓어진다. 그래서 "같은 응답 24시간 재현" 은 정상 경로의 계약이고 저하 구간의 멱등성은 최선 노력이다. 운영자는 이 구간을 알아챌 수단(Redis 실패율 관측)이 필요하다.
- 블랙리스트 조회의 fail-open 은 위 근거만으로는 설명되지 않는다. 토큰 검증이 요청을 거부해도 실행은 멈추지 않기 때문이다. 이 조회의 근거는 [External Interaction API](CLE-EIA.md#종료-토큰-폐기는-실행-토큰-테이블로-정리한다) 의 「종료 토큰 폐기는 실행 토큰 테이블로 정리한다」 가 받아들인 위험 판단이다. 실행 단위 토큰은 수명이 짧고 그 실행에만 쓰이므로 장애 창에서 폐기된 토큰이 통과해도 위험이 낮다고 본다. «수명이 짧다» 는 근거는 실행 단위 토큰(`iext_*`)에만 쓴다. 블랙리스트의 대상도 이 토큰뿐이다. 트리거 단위 토큰(`itk_*`)에는 수명이 없어 이 근거를 쓸 수 없다. 또 이 근거는 새 요청의 검증에 대한 것이다. 이미 열린 SSE 스트림은 실행 단위 토큰이 만료돼도 닫지 않는다. 그 남은 위험은 [재검토에서 갈린 EIA 동작을 정한다](#재검토에서-갈린-eia-동작을-정한다-2026-10-09) 에 있다.

### 승격 때 시크릿 저장소 참조를 교체한다

시크릿 승격은 평문을 설정에 쓰지 않고 시크릿 저장소 정식 참조를 `secrets.rotate` 로 교체한다. 발송 쪽 `resolveSigningSecret` 이 `secretRef` 를 먼저 보기 때문에, 평문을 설정에 쓰면 교체한 시크릿이 실제 서명에 쓰이지 않는 어긋남이 생긴다. 이 어긋남은 "교체한 시크릿이 실제로 쓰이는가" 라는 보안 운영에 직접 닿는다. 한때 코드 주석과 명세가 말한 "v2 → secretRef 승격" 과 실제 코드가 갈라졌던 적이 있어 지금의 방식으로 맞췄다.

### SSE 버퍼를 단일 인스턴스 메모리에 둔다

`SseAdapter.buffers` 는 1차 범위에서 서버 프로세스 하나의 메모리에 둔 링 버퍼다.

- 지연과 신뢰성의 trade-off: 실행 이벤트는 SSE 스트림의 실시간성이 중요하고, Redis Pub/Sub 을 거치면 직렬화와 네트워크 홉이 더해진다.
- 단일 서버 인스턴스 가정: 1차 범위는 백엔드 서버 인스턴스 하나로 배포하는 것을 전제로 한다. SSE 클라이언트는 연결한 서버 인스턴스가 낸 이벤트만 받는다. 그래서 이벤트를 낸 서버 인스턴스와 SSE 연결을 받은 서버 인스턴스가 같아야 한다. sticky-session 로드밸런서로는 이 조건을 채우지 못한다. sticky-session 은 클라이언트를 서버 인스턴스 하나에 묶을 뿐 실행을 묶지 않는다. 실행 세그먼트와 재개는 아무 서버 인스턴스의 워커에서나 돈다([큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md#수평-확장) · [시스템 아키텍처](../CLE-PLAT/CLE-PLAT-ARCH.md#다중-인스턴스와-동시성-모델)).
- 2026-10-09 정정(NERV Task `CLE-T-M6PERB`): 이전 서술은 서버 인스턴스 하나나 sticky-session 로드밸런서를 전제로 하면 충분하다고 적었다. 실행 세그먼트와 재개가 아무 서버 인스턴스의 워커에서나 돈다는 점을 놓친 서술이라 전제를 서버 인스턴스 하나로 좁혔다.

남은 위험은 다중 인스턴스 배포다. 서버 인스턴스가 둘 이상이면 sticky-session 을 써도 클라이언트가 연결한 서버 인스턴스와 이벤트를 낸 서버 인스턴스가 다를 수 있다. 그러면 클라이언트는 그 이벤트를 받지 못한다. 아무 서버 인스턴스에나 SSE 클라이언트가 붙게 하려면 Redis Pub/Sub 이 필요하다. 이 판단은 [External Interaction API](CLE-EIA.md#단일-싱크와-외부-facade) 의 「단일 싱크와 외부 facade」 와 같다. 서버 인스턴스를 늘릴 때 `SseAdapter` 를 Redis Pub/Sub 기반 fan-out 으로 바꾼다. 이 전환은 NERV Task `CLE-T-Z35F7P` 가 맡는다. 트리거 단위 토큰이 무효가 될 때 SSE 스트림을 닫는 범위도 지금은 같은 서버 인스턴스에 붙은 스트림이다. 같은 Task 에서 이 범위를 넓힌다. [시스템 아키텍처](../CLE-PLAT/CLE-PLAT-ARCH.md#배포-환경-분리) 는 SaaS 의 목표 구성을 자동 수평 확장으로 둔다. 서버 인스턴스 하나라는 1차 범위의 전제는 이 목표 구성과 부딪친다. 그래서 SaaS 에서 서버 인스턴스를 늘리기 전에 이 전환을 마쳐야 한다. 단일 싱크 구조 자체의 결정은 [External Interaction API](CLE-EIA.md) 가 정한다. 이 항목은 그 싱크의 SSE 소비자가 왜 서버 인스턴스 하나의 메모리에 버퍼를 두는지에 한한다.

### 실행 토큰 테이블을 따로 둔다

JWT 는 무상태로 검증할 수 있어 저장소가 필요 없어 보인다. 그러나 실행이 끝날 때 그 실행이 발급한 토큰을 빠짐없이 폐기하려면 발급 jti 목록이 있어야 한다. 그래서 jti 를 실행별로 기록하는 테이블을 두고, 같은 테이블을 종료 토큰 정리 작업과 웹채팅 위젯 유휴 실행 회수의 원천으로 함께 쓴다. 이미 만료된 jti 는 블랙리스트에 올릴 필요가 없으므로 `exp_at` 을 함께 둔다.

### 재검토에서 갈린 EIA 동작을 정한다 (2026-10-09)

승인된 스펙의 일관성 재검토에서 스펙과 구현이 갈리거나 스펙이 정하지 않은 EIA 동작 여섯 가지가 나왔다. 그 결정을 반영한 초안의 일관성 검토에서 열린 SSE 스트림과 토큰의 관계가 하나 더 나왔다. 아래 처음 일곱 항목이 그 결정이다. 그 가운데 다섯 가지는 사용자 결정(2026-10-09)이다. 재개 큐 적재 실패의 응답과 웹훅 202 응답 모양은 사용자에게 묻지 않고 기본값으로 정해 알린 뒤 진행했다. PATCH 의 트리거 단위 토큰 처리와 첫 시크릿 발급 시점은 첫 초안의 검토 뒤 사용자가 다시 정했다. SSE 스트림은 두 번째 초안의 검토 뒤 사용자가 다시 정했다. 사용자 결정 항목에도 사용자에게 묻지 않고 기본값으로 정한 부분이 있다. 그 부분은 항목마다 밝힌다. 마지막 항목은 결정이 아니고 승인본 서술을 코드에 맞춘 정정이다. 사용자에게 제시한 선택지와 답은 NERV Task `CLE-T-M6PERB` 의 결정 기록에 있다. 반영 작업도 같은 Task 다. 일곱 결정 가운데 웹훅 202 응답 모양을 뺀 여섯 가지는 지금 코드와 다르고 같은 Task 에서 코드를 고친다.

- **PATCH 가 서버가 만든 값을 다룬다.** 지금 코드(`mergeExternalConfig`)는 PATCH 가 `config.interaction` 이나 `config.notification` 을 통째로 바꿀 때 `triggerToken` 과 `signing.secretRef` 까지 지운다. 그러면 평문이 한 번만 보이는 `itk_*` 가 조용히 무효가 된다. 다음 EIA 알림 웹훅 발송은 시크릿이 없어 저하로 끝난다. 두 값은 요청 본문으로 받지 않으므로 호출자가 "전체 객체" 를 다시 보내 지킬 방법도 없다. 그래서 서버가 다시 읽은 행을 보고 정한다. 채팅 채널 `botTokenRef` 보존과 목적이 같다. `secretRef` 는 다시 읽은 행에 참조가 있으면 늘 싣는다. 싣는 값은 행의 값을 복사하지 않고 `botTokenRef` 처럼 트리거 id 로 다시 만든다. 요청 본문으로 참조를 받지 않게 되기 전에 저장된 행에는 다른 값이 있을 수 있어서다. 참조가 있는지는 `secret://` 형식인지로 판정한다. 형식이 틀린 값을 있다고 보면 첫 시크릿을 발급하지 않아 발송이 계속 저하로 끝나기 때문이다. 근거 규칙은 [시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 23 · 24 다. 참조가 없는 행에 옛 평문 `signing.secret` 이 남아 있으면 PATCH 는 발급하지 않고 그 평문을 시크릿 저장소로 옮긴다. 통째 교체로 그 평문이 사라지면 수신 측이 쓰던 시크릿이 유예 없이 바뀌기 때문이다. 다시 만들기, 있음 판정, 옛 평문 옮기기는 사용자에게 묻지 않고 기본값으로 정해 알렸다. `triggerToken` 은 PATCH 결과의 전략이 `per_trigger` 일 때만 이어받고 그 밖에는 지운다. 늘 이어받으면 전략을 바꿨다가 `per_trigger` 로 되돌릴 때 폐기했다고 여긴 영구 토큰이 재발급 없이 다시 유효해지기 때문이다. 기각한 안은 «지워지는 것이 의도라고 스펙에 적기» 와 «남겨 두고 되살아남을 명시하기» 다. 앞의 안은 PATCH 한 번으로 토큰과 서명이 끊기는 동작을 계약으로 남긴다. 뒤의 안은 사용자가 폐기했다고 여긴 영구 토큰이 다시 살아나는 경로를 남긴다.
- **첫 알림 서명 시크릿은 서버가 발급한다.** [External Interaction API](CLE-EIA.md#트리거-등록과-웹훅-응답) 의 요구사항(승인 전 초안)은 트리거를 만들면 `wsk_*` 를 생성 응답에서 한 번 보여 준다고 정한다. 지금 코드는 생성 때 시크릿을 발급하지 않는다. 호출자가 원시 `config` 로 평문을 보내지 않으면 주 시크릿이 없다. 그러면 발송은 늘 저하로 끝난다. 그래서 서버가 발급한다. 발급하는 때는 트리거를 만들 때와 PATCH 가 `notification` 을 처음 붙일 때다. 생성 때만 발급하면 나중에 붙인 EIA 알림 웹훅 설정이 같은 이유로 저하로 끝난다. 호출자가 원시 `config` 로 보낸 평문 `signing.secret`(옛 키)이 있으면 그 값을 쓰고 발급하지 않는다. 기각한 안은 «발급하지 않고 요구사항을 지금 동작에 맞춰 고치기» 와 «생성 때만 발급하기» 다.
- **`notification.retry` 를 발송에 반영한다.** 사용자가 저장한 `retry.maxAttempts` 를 지금 발송 큐는 읽지 않고 5회로 고정한다. 그래서 설정 값을 발송 큐에 넘긴다. `backoff: "exponential"` 은 이름이 BullMQ 내장 지수 백오프와 같지만 실제 간격은 다르다. 두 값의 뜻은 [EIA 알림 웹훅](CLE-EIA-NOTIFY.md#재시도와-실패-처리) 한 곳에서 정한다. 뜻을 두 문서에 적으면 한쪽만 고쳐질 수 있어서 이 문서는 그곳을 가리킨다. 기각한 안은 «`retry` 를 입력에서 빼기» 다.
- **유예 중 재교체는 덮어쓴다.** 지금 교체는 잠금 없이 v2 와 교체 시각만 쓴다. 승격은 잠금 밖에서 고른 v2 를 잠금 안에서 같은 값인지 보지 않고 비운다. 그래서 승격 도중에 교체가 끼어들면 응답으로 나간 새 시크릿이 어디에도 남지 않는다. 교체와 승격이 같은 트리거 설정 잠금을 잡고 승격은 같은 값일 때만 비우면 이 경쟁이 닫힌다. 정식 참조로 옮기는 것도 조건을 확인한 뒤 같은 잠금 안에서 한다. 지금 코드는 잠금 밖에서 먼저 옮긴다. 그래서 재교체가 끼면 덮인 옛 v2 가 주 시크릿이 된다. 유예 중 재교체는 앞의 v2 를 덮고 유예를 다시 시작한다(`Grace → Grace`). 기각한 안은 «유예 중 재교체 거부(409)» 다.
- **재개 큐 적재 실패는 503 으로 응답한다.** 지금 `/interact` 는 발행이 `queued:false` 여도 202 `accepted:true` 를 내고 24시간 멱등 캐시에 넣는다. 그러면 같은 멱등 키로 다시 보내도 캐시된 202 가 돌아오고 명령은 끝내 적재되지 않는다. `cancel` 은 이미 503 `EXECUTION_ENQUEUE_FAILED` 로 응답하므로 네 재개 명령도 같은 규칙을 따른다. 503 은 멱등 캐시 대상이 아니므로 다시 보내면 새로 처리한다. WebSocket 재개 명령은 같은 실패를 `errorCode` 없는 실패 ack(`success:false`)로 바로 돌려준다. ack 는 저장하지 않으므로 클라이언트가 실패를 보고 다시 보낼 수 있다. EIA REST 는 202 를 멱등 캐시에 넣으므로 같은 실패를 503 으로 응답한다. 승인 전 초안 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) · [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 은 `queued:false` 를 성공 ack 의 필드로 적는다. 코드(`websocket.gateway.ts`)는 실패 ack 를 보낸다. 그 정정은 NERV Task `CLE-T-EMB0YG` 가 맡는다. 503 은 토큰으로 인증한 HTTP 진입점의 응답이다. 채팅 채널 인바운드처럼 내부 신뢰 호출로 부른 재개 명령은 503 을 던지지 않는다. 채팅 채널 인바운드 웹훅의 응답은 [채팅 채널 「인바운드 HTTP 응답 계약」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약) 에서 `202` 로 고정했기 때문이다. 이 범위도 사용자에게 묻지 않고 기본값으로 정해 알렸다.
- **웹훅 202 응답 모양은 지금 코드를 따른다.** `message` 필드와 `per_trigger` 응답의 모양이 문서마다 달랐다. 와이어 본문을 지금 코드의 `{ data: { executionId, message } }` 와 인터랙션 블록으로 정했다. 모양은 [웹훅 「수신 API」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#수신-api) 가 정한다. 이 문서의 「토큰 발급」 은 토큰 전략별 인터랙션 블록의 내용만 적는다.
- **트리거 단위 토큰이 무효가 되면 그 토큰으로 연 SSE 스트림을 닫는다.** SSE 스트림은 열 때 토큰을 검증한다. 첫 초안의 검토 뒤 사용자는 이미 열린 스트림을 그 실행이 끝날 때까지 유지하기로 했다. 토큰을 바꾸기 전에 시작한 실행이라는 것이 사용자가 든 이유다. 그때 함께 제시한 안은 «문서화하고 후속에서 정하기» 와 «이번에 막기»(SSE 스트림을 토큰 수명에 묶기)였다. 두 번째 초안의 검토에서 입력 대기 실행과 멀티턴 AI 대화 실행은 기한 없이 멈춰 있을 수 있다는 지적이 나왔다. 그러면 재발급으로 폐기한 영구 토큰으로 연 스트림이 끝없이 남는다. 사용자는 이 사실을 알고 재발급 때 스트림을 닫는 쪽으로 결정을 바꿨다. 이번에 함께 제시한 안은 «유지하고 위험을 적기»(추천으로 제시했다)와 «위험만 적고 후속 Task 로» 다.
  - 범위: 사용자가 고른 범위는 재발급(`revoke-token`)이다. PATCH 가 전략을 바꿔 `itk_*` 를 지울 때와 트리거를 지울 때도 같은 이유로 닫는다. 이 두 경우는 사용자에게 묻지 않고 기본값으로 정해 알렸다. 만료로는 닫지 않는다. 그래서 처음에 택하지 않은 «이번에 막기» 를 되살린 것이 아니다.
  - WebSocket 원칙과의 관계: [WebSocket 연결과 채널 구독](../CLE-API/CLE-API-WS.md#소켓-수명을-토큰-수명에-묶는다-2026-09-02) 은 두 안을 택하지 않았다. «알리기만 하고 끊지 않음» 은 틈을 문서화할 뿐 닫지 않기 때문이다. «명령마다 다시 검증» 은 수신을 못 막기 때문이다. 구독만 하는 소켓은 만료된 토큰으로 계속 데이터를 받는다. 둘 다 인가 틈을 알고도 두는 것이라는 판단이다. 수신 전용인 SSE 스트림에도 같은 논리가 적용된다. 그래서 만료가 없는 영구 토큰인 트리거 단위 토큰은 무효가 되면 그 스트림을 닫는다. WebSocket 도 명시적 폐기로는 끊지 않지만 소켓은 토큰 만료 때까지 최대 15분만 남는다. 트리거 단위 토큰에는 그런 끝이 없어서 무효가 되는 때 닫아야 틈에 끝이 생긴다.
  - 실행 단위 토큰은 예외로 둔다: 실행 단위 토큰(`iext_*`)으로 연 스트림은 토큰이 만료되거나 갱신돼도 닫지 않는다. WebSocket 이 택하지 않은 인가 틈을 실행 단위 토큰의 SSE 에 한해 의도적으로 받아들이는 것이다. 근거는 SSE 쪽 사실이다. 이 토큰은 수명이 짧아 새 요청은 곧 막힌다. 스트림은 실행 하나에 묶이고 그 실행의 종료 이벤트로 끝난다. 공개 웹훅(`auth_config_id IS NULL`)이 시작한 입력 대기 실행은 토큰이 만료되고 유예 시간이 지나면 웹채팅 위젯 유휴 실행 회수가 취소하므로 그 스트림에도 끝이 있다. 인증 설정이 연결된 웹훅이 시작한 입력 대기 실행은 기한 없이 멈춰 있을 수 있어 그 스트림에는 틈이 남는다. 대응은 실행 취소다. 취소하면 `execution.cancelled` 종료 이벤트로 스트림이 닫힌다. 만료로 닫지 않는 것은 사용자가 고른 안의 설명(«만료로는 닫지 않는다»)에 들어 있었다. 갱신으로 닫지 않는 것은 사용자에게 묻지 않고 기본값으로 정해 알렸다.
  - 닫는 방식: 서버가 SSE 응답을 끝낸다. 클라이언트가 옛 토큰으로 다시 연결하면 가드가 401 로 거부한다. 그래서 새 이벤트 이름을 만들지 않았다. 지금은 같은 서버 인스턴스에 붙은 스트림만 닫는다. SSE 버퍼가 서버 인스턴스 하나를 전제로 하기 때문이다([SSE 버퍼를 단일 인스턴스 메모리에 둔다](#sse-버퍼를-단일-인스턴스-메모리에-둔다)). 여러 서버 인스턴스로 넓히는 일은 NERV Task `CLE-T-Z35F7P` 가 맡는다.
- **EIA 알림 웹훅 설정이 없는 트리거의 승격은 v2 를 비운다.** 승인본은 이런 트리거의 승격을 건너뛰고 v2 는 다음 교체 때 덮어쓴다고 적었다. 지금 코드(`promoteRotatedNotificationSecrets`)는 v2 와 `notification_rotated_at` 을 비우고 경고 로그를 남긴다. 이 항목은 승인본 서술을 코드에 맞춘 정정이다. 매 주기 건너뛰면 v2 평문이 DB 에 계속 남는다. 이 컬럼에 평문을 둘 수 있는 근거 가운데 하나는 평문이 잠시 머물다 비워지는 경유지라는 점이다([시크릿 저장소 「저장소 예외 필드」](../CLE-INT/CLE-INT-SECRET.md#저장소-예외-필드) 의 `Trigger.notification_secret_v2`). 계속 남는 평문은 이 근거와 맞지 않는다.
