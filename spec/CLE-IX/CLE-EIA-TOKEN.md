---
id: "CLE-EIA-TOKEN"
title: "External Interaction API — 트리거 설정과 인터랙션 토큰"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EIA"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-EIA"]
area: "CLE-IX"
content_hash: "88257a2045270b87d1a28039067571400b2842d26d577603113fdcd450ed8455"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "869b976b49d59ccb6421663ccf5146d1f26118cb31a78936a37476cd2487c2ca"
etag: "sha256-22a3ac1bf2fc06d90409d9a92ffff11066a0d49308b3d1f0359638c9f7aac6c1"
---
## 개요

이 문서는 [External Interaction API](CLE-EIA.md) 의 하위 문서로 트리거 등록 페이로드의 EIA 그룹, 생성 · PATCH 응답의 일회성 비밀, 웹훅 호출 응답의 인터랙션 블록, 인터랙션 토큰(실행 단위 · 트리거 단위)과 서명 비밀, 내부 신뢰 호출을 정한다. 요구사항은 부모 문서의 [요구사항](CLE-EIA.md#요구사항) 절에 있다.

## 트리거 등록 페이로드 확장

트리거 생성·수정 페이로드([트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md), [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md))에 선택 그룹 두 개를 더한다.

```jsonc
POST /api/triggers
{
  "type": "webhook",
  "workflowId": "uuid",
  "endpointPath": "uuid-or-slug",
  "authConfigId": null,   // 인증 연결(없으면 무인증). 옛 authType 필드는 V066 에서 폐기

  // 알림 웹훅
  "notification": {
    "url": "https://customer.example/webhook/wf-callback",
    "events": [
      "execution.waiting_for_input",
      "execution.completed",
      "execution.failed",
      "execution.cancelled"
      // "execution.ai_message"  // 선택. 양이 많아 명시 구독할 때만
    ],
    "signing": { "algorithm": "hmac-sha256" },
    "retry": { "maxAttempts": 5, "backoff": "exponential" }  // 뜻과 범위: EIA 알림 웹훅 「재시도와 실패 처리」
  },

  // 인바운드 인터랙션
  "interaction": {
    "enabled": true,
    "tokenStrategy": "per_execution",  // "per_execution"(기본) | "per_trigger"
    // 선택: 웹채팅 운영 콘솔이 저장하는 위젯 외형. 토큰·실행과 무관한 표시용 값
    "appearance": {
      "locale": "ko",
      "primaryColor": "#5B4FE9",
      "position": "bottom-right",
      "headerTitle": "AI 어시스턴트",
      "welcomeText": "...",
      "suggestions": "...",
      "disclaimer": "..."
    }
  }
}
```

`notification.retry` 의 뜻과 허용 범위는 [EIA 알림 웹훅 「재시도와 실패 처리」](CLE-EIA-NOTIFY.md#재시도와-실패-처리) 가 정한다. `backoff: "exponential"` 은 그 절이 정한 간격을 뜻한다. BullMQ 내장 `exponential` 과는 이름만 같다.

`interaction.appearance` 는 웹채팅 운영 콘솔 전용 선택 필드로, 인터랙션 토큰 발급·검증과 관계없는 표시용 값이다. 필드 허용 목록(enum·hex·길이)은 `WebChatAppearanceDto`(`web-chat-appearance.dto.ts`)가 강제한다. 외형 자체의 의미는 [웹채팅 운영 콘솔](../CLE-WEBCHAT/CLE-WEBCHAT-CONSOLE.md) 이 정한다.

PATCH 는 `mergeExternalConfig` 로 `interaction` 키를 통째로 바꾼다. 그래서 `appearance` 만 고칠 때도 `enabled`·`tokenStrategy` 를 함께 보내야 한다. 반대로 외부 API 호출자가 `appearance` 없이 `interaction` 을 PATCH 하면 저장된 외형이 경고 없이 사라진다. 외형을 지키려면 `appearance` 를 함께 보내거나, `GET /api/triggers/:id` 로 현재 값을 읽어 합친 뒤 PATCH 한다.

서버가 만든 트리거 단위 토큰(`interaction.triggerToken`)은 이 통째 교체에서 빠진다. 호출자가 top-level `interaction` 에 이 필드를 실으면 400 `VALIDATION_ERROR` 다. 원시 `config`(요청 본문의 `config` 키) 바로 아래에는 `interaction` 키를 실을 수 없다. 생성과 PATCH 모두 이 키가 있으면 값과 상관없이 400 `VALIDATION_ERROR` 다. 그래서 인터랙션 설정은 top-level `interaction` 으로만 바꿀 수 있다. 서버는 PATCH 결과에 따라 저장된 토큰을 이어받거나 새로 발급하거나 지운다([부모 「인터랙션 토큰」 요구사항](CLE-EIA.md#인터랙션-토큰)). 원시 `config` 계약과 이 규칙의 기준은 [트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약) 이고, 발급 요구사항은 [트리거 관리 「요구사항」](../CLE-TRIG/CLE-TRIG-MANAGE.md#요구사항) 에 있다(생성 · PATCH 각 한 줄).

생성 응답(`201 Created`)은 다음과 같다. 전역 `TransformInterceptor` 가 트리거 리소스를 응답 봉투 `data` 로 감싼다.

```jsonc
{
  "data": {
    "id": "uuid",
    "type": "webhook",
    "endpointPath": "...",
    "config": {
      "notification": {
        "url": "...",
        "events": [...],
        "signing": { "algorithm": "hmac-sha256" },  // secret · secretRef 는 응답에서 뺀다
        "retry": { "maxAttempts": 5, "backoff": "exponential" }
      },
      "interaction": { "enabled": true, "tokenStrategy": "per_trigger" }  // triggerToken 은 응답에서 뺀다
    },
    // ... 그 밖의 트리거 필드

    // 이 요청에서 서버가 발급한 비밀의 평문. 이후 응답에는 없다
    "secrets": {
      "notificationSigningSecret": "wsk_...",  // 알림 서명 시크릿을 발급했을 때만
      "interactionToken": "itk_..."            // 트리거 단위 토큰을 발급했을 때만
    }
  }
}
```

`data.secrets` 는 서버가 그 요청에서 새 비밀을 만든 응답에만 있다. 안의 두 키도 각각 그 비밀을 발급했을 때만 있다. 발급하지 않은 응답에는 `null` 을 싣지 않고 키를 생략한다([HTTP API 규약 §5.5](../CLE-API/CLE-API-CONV.md#55-부재-표현-null-과-키-생략) 기준 (b)). 두 비밀의 발급 조건은 부모의 [트리거 등록과 웹훅 응답](CLE-EIA.md#트리거-등록과-웹훅-응답) · [인터랙션 토큰](CLE-EIA.md#인터랙션-토큰) 요구사항이 정한다. PATCH 응답도 같은 자리를 쓴다. 이 일회성 응답은 [시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 규칙 4 의 예외에 든다. 발급 사실은 `trigger.created` · `trigger.updated` 감사 기록의 메타데이터에 남고 평문은 남지 않는다. 메타데이터 필드는 [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md) 가 정한다.

알림 서명 시크릿 교체(`POST /api/triggers/:id/notification/rotate-secret`)는 [EIA 알림 웹훅](CLE-EIA-NOTIFY.md), 트리거 설정의 저장 형태는 [EIA 데이터와 흐름](CLE-EIA-DATA.md) 에서 정한다. 트리거 단위 토큰 재발급(`POST /api/triggers/:id/interaction/revoke-token`)의 응답은 `{ data: { token } }` 이다([트리거 관리 「API」](../CLE-TRIG/CLE-TRIG-MANAGE.md#api)).

## 웹훅 호출 응답 확장

웹훅 202 응답 모양의 기준은 [웹훅 「수신 API」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#수신-api) 다. 아래는 인터랙션을 켠 `per_execution` 트리거의 응답 예시다.

```jsonc
{
  "data": {
    "executionId": "uuid",
    "message": "Webhook received, workflow execution started",
    "status": "pending",

    // interaction.enabled=true 일 때만 있다
    "interaction": {
      "token":     "iext_<short-lived-jwt>",  // per_execution 일 때만
      "expiresAt": "ISO8601",                 // per_execution 일 때만
      "endpoints": {
        "stream":  "/api/external/executions/{id}/stream",
        "submit":  "/api/external/executions/{id}/interact",
        "status":  "/api/external/executions/{id}",
        "cancel":  "/api/external/executions/{id}/cancel",
        "refresh": "/api/external/executions/{id}/refresh-token"
      }
    }
  }
}
```

인터랙션을 켠 `per_trigger` 트리거의 응답은 다음과 같다. `interaction` 에 `endpoints` 만 있다.

```jsonc
{
  "data": {
    "executionId": "uuid",
    "message": "Webhook received, workflow execution started",
    "status": "pending",
    "interaction": {
      "endpoints": { "stream": "...", "submit": "...", "status": "...", "cancel": "...", "refresh": "..." }
    }
  }
}
```

응답 봉투(`{ "data": { ... } }`)는 전역 `TransformInterceptor` 가 씌운다([HTTP API 규약](../CLE-API/CLE-API-CONV.md)). 클라이언트는 `res.data` 를 풀어 읽는다. SSE 프레임은 인터셉터를 거치지 않아 응답 봉투가 없다.

`message` 는 어느 경우에나 있다. 인터랙션을 켜지 않은 트리거의 응답 `data` 에는 `executionId` 와 `message` 만 있고 `status` 와 `interaction` 키는 `null` 없이 생략한다([HTTP API 규약 §5.5](../CLE-API/CLE-API-CONV.md#55-부재-표현-null-과-키-생략) 기준 (b)). 인터랙션을 켜면 두 키가 더해진다(하위 호환). 트리거 단위 토큰 전략이면 호출자에게 이미 토큰이 있으므로 `interaction` 에 `token` · `expiresAt` 키가 없다.

## 인터랙션 토큰

인바운드 요청은 인터랙션 토큰(interaction token)으로 인증한다. 토큰 전략(`tokenStrategy`)으로 두 가지 중 하나를 고른다.

| 구분 | 실행 단위 토큰(per_execution token, `iext_*`) | 트리거 단위 토큰(per_trigger token, `itk_*`) |
|---|---|---|
| 형태 | 단명 JWT(HS256). payload `{ sub: executionId, aud: 'interaction', jti, exp }` | trigger 별 opaque 토큰(32바이트 무작위 hex) |
| 범위 | 실행 하나 | 그 트리거가 만든 모든 실행 |
| 수명 | 기본 1시간. 만료 30분 이내에 갱신할 수 있다 | 영구. 재발급(`revoke-token`), 전략을 `per_trigger` 에서 다른 값으로 바꾸는 PATCH, 트리거 삭제 때 무효가 된다 |
| 발급 | 웹훅 호출 응답에 새로 싣는다 | 서버가 발급해 생성 응답이나 PATCH 응답의 `data.secrets.interactionToken` 에 한 번 싣는다. 새 토큰으로 바꿀 때는 재발급(`revoke-token`) 응답의 `data.token` 으로 받는다 |
| 인터랙션을 끄면 | 새 웹훅 호출 응답에 토큰을 싣지 않는다. 이미 발급한 토큰은 실행에 묶여 있어 만료나 실행 종료까지 쓸 수 있다 | 토큰 값은 남는다. 가드가 그 토큰을 401 `TOKEN_INVALID` 로 거부한다. 그 토큰으로 연 SSE 스트림은 모든 서버 인스턴스에서 닫힌다. 다시 켜면 같은 토큰을 쓴다 |
| 서명 비밀 | 전역 비밀 하나(`INTERACTION_JWT_SECRET`, 없으면 `JWT_SECRET`) | trigger 별로 분리돼 다른 trigger 의 토큰과 교차 검증할 수 없다 |
| 폐기 | 실행 종료 때 jti 를 Redis 블랙리스트에 올린다 | 가드가 요청마다 트리거 설정의 현재 값과만 비교한다. 그래서 바꾸거나 지우는 즉시 옛 값은 새 요청에 대해 무효다 |
| 열린 SSE 스트림 | 토큰이 만료되거나 갱신돼도 닫지 않는다. 그 실행의 종료 이벤트까지 이어진다 | 토큰이 무효가 되거나 인터랙션을 끄면 서버가 닫는다. 어느 서버 인스턴스에 붙은 스트림이든 닫는다 |

기본값은 실행 단위다. 실행 단위 토큰은 trigger 별로 비밀을 나누지 않지만, payload 가 실행 하나에 묶여 있고 jti 를 블랙리스트로 폐기할 수 있어 실행 범위로 한정된다.

트리거 단위 토큰으로 연 스트림을 서버가 닫을 때 따로 보내는 이벤트는 없다. 클라이언트가 옛 토큰으로 다시 연결하면 가드가 401 로 거부하고, 이 401 이 토큰을 더 쓸 수 없다는 신호다. `itk_*` 를 쓰는 서버 간 자동화는 이 401 을 받으면 같은 토큰으로 다시 연결하지 않는다. 401 의 코드와 재연결 규칙은 [EIA 수신 API와 SSE 「스트림 규칙」](CLE-EIA-INBOUND.md#스트림-규칙), 닫는 방식은 [EIA 데이터와 흐름 「트리거 단위 토큰」](CLE-EIA-DATA.md#트리거-단위-토큰) 이 정한다.

서명 비밀은 설정 네임스페이스 `interaction.jwtSecret`(= `INTERACTION_JWT_SECRET`)을 먼저 보고, 없으면 `jwt.secret`(= `JWT_SECRET`)을 쓴다. 서비스 코드는 `process.env` 를 직접 읽지 않고 `registerAs` 네임스페이스로 읽는다. 두 값이 모두 없을 때의 동작은 환경마다 다르다.

- 개발 환경: 프로세스 시작 때 한 번 만든 임시 무작위 키(`randomBytes(32)`)로 서명한다. 예측 가능한 고정 비밀이 버전 기록에 남지 않고, 재시작하면 개발용 토큰이 모두 무효가 된다.
- 운영 환경(`NODE_ENV=production`): `main.ts` 가 부팅 첫 단계에서 부르는 `assertProductionConfig`(`common/config/production-guards.ts`)가 기동을 막는다. `JWT_SECRET` 은 원래 이 함수가 검사한다. `INTERACTION_JWT_SECRET` 을 설정했으면 그 값도 같은 규칙으로 검사한다. 무엇을 막는지는 [세션과 토큰 「운영 환경 가드」](../CLE-ACCT/CLE-ACCT-SESSION.md#운영-환경-가드) 에 있다. `InteractionTokenService` 생성자도 두 값이 모두 없으면 예외를 던진다. 이 예외는 `main.ts` 를 거치지 않고 모듈을 띄우는 경로를 위해 남긴다.

서명 비밀을 바꾸면 이미 발급한 실행 단위 토큰(`iext_*`)은 모두 검증에 실패한다. 운영 환경 가드에 걸려 서명 비밀을 새로 만든 배포도 같다.

토큰의 저장·폐기 흐름과 상태 전이(발급 → 갱신 → 폐기·만료)는 [EIA 데이터와 흐름](CLE-EIA-DATA.md), 갱신 엔드포인트와 검증 실패 응답은 [EIA 수신 API와 SSE](CLE-EIA-INBOUND.md), 종료 시 폐기 경로는 [종료 시 토큰 폐기](CLE-EIA-FLOW.md#종료-시-토큰-폐기) 가 정한다.

## 내부 신뢰 호출

서버 프로세스 안의 신뢰 호출자(예: [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 어댑터)는 내부 신뢰 호출(`in_process_trusted`)로 토큰 발급·검증을 건너뛸 수 있다. 이 예외는 `InteractionService.interact()` 를 서버 안에서 직접 부르는 경로에만 있다. HTTP 로 들어온 요청은 언제나 인터랙션 토큰 인증을 따른다.

`scope: 'in_process_trusted'` 는 토큰 검증을 통째로 건너뛰는 플래그다. 그래서 외부 HTTP 입력이 이 값을 설정할 수 없도록 구조로 막는다.

1. HTTP 진입점 가드(`InteractionGuard`)가 합성하는 컨텍스트는 `scope` 를 설정하지 않는다. HTTP 요청에서 만든 컨텍스트는 언제나 `scope === undefined` 다.
2. HTTP 본문·헤더·쿼리·경로 값을 역직렬화할 때 `scope` 를 반드시 걷어 낸다. DTO 는 `class-transformer` 의 `@Exclude({ toClassOnly: true })`, 또는 `excludeExtraneousValues: true` 와 `@Expose()` 허용 목록으로 외부 입력을 막는다.
3. `scope: 'in_process_trusted'` 는 서버 내부 모듈(`ChatChannelDispatcher`, `HooksService` 의 채팅 채널 전달 등)이 컨텍스트를 직접 만들 때만 쓸 수 있다. 호출 위치는 `grep -r "scope: 'in_process_trusted'" codebase/backend/src/` 로 언제든 확인할 수 있어야 한다.

컴파일러가 이 불변식을 지키도록 요청 컨텍스트를 두 타입의 union 으로 나눴다(구현됨, `interaction.guard.ts`).

```typescript
// HTTP 가드가 만드는 컨텍스트 (scope 없음)
interface ExternalInteractionRequestContext {
  executionId: string;
  tokenFamily: 'iext' | 'itk';  // 필수
  triggerId?: string | null;
}

// 서버 내부 모듈만 만든다. scope 필수
interface InternalInteractionRequestContext {
  executionId: string;
  triggerId?: string | null;
  scope: 'in_process_trusted';  // literal type
  // tokenFamily 없음. 내부 호출에는 토큰 자체가 없다
}

type InteractionRequestContext =
  | ExternalInteractionRequestContext
  | InternalInteractionRequestContext;
```

`InteractionGuard` 는 첫 번째 타입만 돌려준다. `InteractionService.interact()` 는 `isInternalCtx()` 타입 가드로 좁힌 경우에만 토큰 검증을 건너뛴다.

## 구현 위치

- `codebase/backend/src/modules/external-interaction/`
  - `interaction.guard.ts` (HTTP 진입점 가드, `scope` 설정 금지)
  - `interaction-token.service.ts` (`iext_*`·`itk_*` 발급·검증·블랙리스트, `reconcileTerminalRevocations`)
- `codebase/backend/src/modules/hooks/hooks.controller.ts`, `hooks.service.ts` (웹훅 응답에 인터랙션 블록, `buildInteractionResponse`)
- `codebase/backend/src/modules/triggers/triggers.controller.ts`, `triggers.service.ts` (`rotate-secret`·`revoke-token`, 생성·PATCH 응답의 일회성 비밀 발급, 알림·인터랙션 설정 검증)
- `codebase/backend/src/modules/triggers/dto/create-trigger.dto.ts`, `dto/interaction-config.dto.ts`, `dto/web-chat-appearance.dto.ts`

## Rationale

### 실행 단위 토큰을 기본값으로

`tokenStrategy: "per_execution"` 이 기본이고, 명시할 때만 `per_trigger` 를 쓴다.

- 최소 권한: 토큰이 새어도 영향이 실행 하나에 그친다.
- 자동 폐기: 실행이 끝나면 저절로 폐기되므로 별도 폐기 절차가 필요 없다.
- 짧은 수명(기본 1시간, 갱신 가능): 만료된 토큰이 악용될 창이 작다.

트리거 단위 토큰이 편한 경우도 있다. 여러 실행을 동시에 다루는 봇(Telegram 봇 등)은 실행마다 토큰을 주고받는 비용을 피할 수 있다. 다만 이 경우는 사용자가 변환층을 직접 만드는 경우에 한한다. 서버 어댑터([채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md))를 쓰면 내부 신뢰 호출로 토큰 사이클 자체가 없다. 모든 실행의 토큰을 따로 보관해야 하는 클라이언트도 트리거 단위가 편하다. 그래서 기본은 안전한 쪽, 선택지로 편한 쪽을 둔다.

### 생성과 PATCH 응답에 싣는 일회성 비밀 (2026-10-17)

생성과 PATCH 응답의 `data` 는 트리거 리소스다. 서버가 그 요청에서 새로 만든 비밀의 평문은 리소스 필드와 섞이지 않게 `data.secrets` 아래에 둔다. 재발급과 교체의 응답은 그 동작만의 응답이라 평문을 `data.token` · `data.secret` 에 바로 둔다([트리거 관리 「API」](../CLE-TRIG/CLE-TRIG-MANAGE.md#api)).

알림 서명 시크릿(`wsk_*`)의 서버 발급과 웹훅 202 응답의 `message` 는 2026-10-09 에 정했다. 근거는 [EIA 데이터와 흐름 「재검토에서 갈린 EIA 동작을 정한다」](CLE-EIA-DATA.md#재검토에서-갈린-eia-동작을-정한다-2026-10-09) 와 [웹훅 「웹훅 202 응답 모양을 지금 코드에 맞춘다」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#웹훅-202-응답-모양을-지금-코드에-맞춘다-2026-10-09) 에 있다.

트리거 단위 토큰(`itk_*`)의 발급은 2026-10-17 에 사용자가 정했다. 인터랙션을 켠 `per_trigger` 트리거를 만들면 서버가 발급한다. PATCH 결과가 인터랙션을 켠 `per_trigger` 이고 저장된 토큰이 없을 때도 발급한다. 저장된 토큰이 있으면 이어받는다. 그래서 인터랙션을 껐다가 다시 켜면 같은 토큰을 쓴다. 이유는 두 가지다. 생성 때 발급하지 않으면 `per_trigger` 로 만든 트리거는 재발급을 한 번 더 불러야 인바운드 경로를 쓸 수 있다. 또 서버가 만든 비밀을 그 비밀이 생긴 응답에서 한 번 보여 준다는 규칙이 알림 서명 시크릿과 같아진다. 저장과 잠금의 근거는 [EIA 데이터와 흐름 「트리거 단위 토큰을 생성과 PATCH 에서 발급한다」](CLE-EIA-DATA.md#트리거-단위-토큰을-생성과-patch-에서-발급한다-2026-10-17) 에 있다.

2026-10-17 당시에는 원시 `config` 로 바꾼 PATCH 도 같은 규칙을 따랐다. 2026-10-31 부터 원시 `config` 는 `interaction` 키를 받지 않으므로 그 갈래는 없어졌고, 발급 요구사항은 최상위 `interaction` 을 바꾼 PATCH 만 적는다. 결정과 근거는 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) Rationale 의 「원시 `config` 계약 (2026-10-31)」 에 있다.

인터랙션을 끄는 것은 토큰 폐기가 아니고 중지다. 그래서 다시 켜면 같은 토큰이 통한다. 토큰 전략을 바꾸면 값을 지운다. 이 경우는 [EIA 데이터와 흐름 「재검토에서 갈린 EIA 동작을 정한다」](CLE-EIA-DATA.md#재검토에서-갈린-eia-동작을-정한다-2026-10-09) 의 범위이고, 끄기와 전략 변경을 가르는 근거 전문은 [EIA 데이터와 흐름 「트리거 단위 토큰을 생성과 PATCH 에서 발급한다」](CLE-EIA-DATA.md#트리거-단위-토큰을-생성과-patch-에서-발급한다-2026-10-17) 에 있다.

기각한 대안:

- `itk_*` 를 재발급(`revoke-token`)으로만 받는 안(이전 동작): `per_trigger` 로 만든 트리거에는 재발급을 부르기 전까지 쓸 수 있는 토큰이 없다. 서버가 발급하는 알림 서명 시크릿과 규칙도 갈린다.
- 생성 때만 발급하는 안: PATCH 로 `per_trigger` 로 바꾼 트리거에는 토큰이 없다. 알림 서명 시크릿을 생성 때만 발급하는 안을 기각한 것과 같은 이유다.
- 인터랙션을 켤 때마다 새로 발급하는 안: 인터랙션을 꺼도 토큰 값을 남긴다는 결정(2026-10-09 사용자 결정)과 어긋난다. 호출자가 쓰던 토큰도 알림 없이 바뀐다.
- 전략을 `per_trigger` 로 되돌릴 때 재발급(`revoke-token`)으로 새 토큰을 받는 규칙(2026-10-09, [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) 의 「서버가 만든 EIA 값의 발급 · 보존 · 교체 잠금」): 이제 그 PATCH 가 새 토큰을 발급한다. 옛 규칙의 목적은 지운 옛 토큰이 다시 살아나지 않게 하는 것이었고, PATCH 가 발급하는 토큰도 새 값이므로 그 목적은 지켜진다. 바꾼 이유는 생성 때 발급하는 것과 같다. 되돌린 트리거도 재발급을 따로 부르지 않고 바로 쓸 수 있어야 한다.

### 운영 환경 가드 목록은 링크로 둔다 (2026-10-31)

「인터랙션 토큰」 절에는 `assertProductionConfig` 의 가드를 나열하지 않고 [세션과 토큰 「운영 환경 가드」](../CLE-ACCT/CLE-ACCT-SESSION.md#운영-환경-가드) 링크만 둔다. 이전 본문의 사본에는 `INTEGRATION_ENCRYPTION_KEY` · `MCP_ALLOW_INSECURE_URL` 가드가 빠져 있었다. 가드가 늘 때마다 사본은 낡으므로 목록은 한 곳에만 둔다.

### 인터랙션 서명 비밀도 운영 환경 가드가 검사한다 (2026-11-06)

- 예전 가드는 `INTERACTION_JWT_SECRET` 과 `JWT_SECRET` 이 모두 없을 때만 부팅을 막았다. `INTERACTION_JWT_SECRET` 을 설정했으면 값이 `.env.example` 의 예시 값이든 공백뿐이든 짧든 그 값으로 `iext_*` 에 서명했다. 알려진 값으로 서명하면 누구나 실행 단위 토큰을 위조해 남의 실행에 입력을 보내거나 실행을 취소할 수 있다. 같은 위험의 `JWT_SECRET` 은 이미 예시 값 · 공백 · 32자 하한을 막고 있었다.
- 예전 본문은 이 가드가 모듈 안 컨텍스트가 필요해 생성자에 남는다고 적었다. 실제 판정에는 환경 변수 둘이면 충분하다. 그래서 `assertProductionConfig` 로 옮겨 `JWT_SECRET` 과 같은 규칙을 쓴다. 위치를 정한 이유와 기각한 대안은 [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) 의 Rationale 「`INTERACTION_JWT_SECRET` 을 운영 환경 가드에 더했다 (2026-11-06)」 에 있다. [운영 환경 가드 목록은 링크로 둔다](#운영-환경-가드-목록은-링크로-둔다-2026-10-31) 결정을 따라 이 문서에는 막는 값을 옮겨 적지 않는다.
- 서명 방식(HS256)과 대체 순서(`INTERACTION_JWT_SECRET`, 없으면 `JWT_SECRET`)는 바꾸지 않았다. 빈 문자열을 `JWT_SECRET` 으로 대신하게 바꾸는 안은 대체 순서를 바꾸는 일이라 택하지 않았다. 빈 값은 지금처럼 운영 부팅을 막는다.
