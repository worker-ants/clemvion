---
id: "CLE-EIA-DATA-STORE"
title: "EIA 데이터와 흐름 — 엔티티와 저장소"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EIA-DATA"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-EIA-DATA"]
area: "CLE-IX"
content_hash: "f60e8268f4161ae5104a913138be28a8dc91aca030b7235dc7b05c84889fcfef"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "9fd5b683b5c8f4f0b26ff79860aa627170f699528ab7040ec5561418901c5c3a"
etag: "sha256-1b7d212d9c02f7470a0fcec5ad9ac721c05aeab1c3f36df01bcf11f22daa0116"
---
## 개요

이 문서는 [EIA 데이터와 흐름](CLE-EIA-DATA.md) 의 하위 문서로 EIA 가 더하는 엔티티(트리거 확장 컬럼 · 설정, 실행 토큰 테이블)와 Postgres · Redis · BullMQ 저장소 매핑을 정한다.

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
    "triggerToken":  "itk_xxx",   // per_trigger 일 때만. 서버가 만든 값
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

- `interaction.appearance` 는 [External Interaction API](CLE-EIA.md) 의 트리거 등록 페이로드로 받아 저장하는 표시용 값이다. 토큰 발급·검증과 관계없다. 필드는 위 일곱 개이고 모두 선택이다. 허용 값(enum·hex·길이)은 현재 구현의 `WebChatAppearanceDto`(`web-chat-appearance.dto.ts`)가 강제한다. 콘솔 폼과 같은 평면 모양(`welcomeText`, 추천 질문 문자열 하나)으로 저장하고, 위젯 부팅 설정의 중첩 모양(`welcome.text`, `welcome.suggestions[]`)으로 옮기는 일은 클라이언트가 한다. 필드의 뜻과 변환은 [웹채팅 운영 콘솔](../CLE-WEBCHAT/CLE-WEBCHAT-CONSOLE.md) 이 정한다. PATCH 는 `interaction` 객체를 통째로 바꾸므로 `appearance` 없이 보내면 저장된 외형이 사라진다.
- **PATCH 와 서버가 만든 값**: PATCH 가 `config.interaction` 이나 `config.notification` 을 통째로 바꿀 때 서버가 만든 두 값은 트리거 설정 잠금(`acquireTriggerConfigLock`) 안에서 다시 읽은 행을 기준으로 다룬다.
  - `notification.signing.secretRef` 는 잠금 안에서 다시 읽은 행에 참조가 있으면 행의 값을 복사하지 않고 트리거 id 로 다시 만든 참조(`notificationSigningSecretRef(triggerId)`)를 싣는다. 참조가 있는지는 [시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 24 로 판정한다. 참조가 없을 때 옛 평문을 옮길지 첫 시크릿을 발급할지는 [EIA 알림 웹훅 「시크릿 교체」](CLE-EIA-NOTIFY.md#시크릿-교체) 가 정한다. 판정, 시크릿 저장소 쓰기(발급이나 옮기기), `config` 쓰기는 같은 트리거 설정 잠금 안에서 한다.
  - `interaction.triggerToken`(`itk_*`)은 PATCH 가 top-level `interaction` 을 실을 때 정한다. 결과의 `interaction.tokenStrategy` 가 `per_trigger` 이면 저장된 토큰을 이어받는다. 결과가 인터랙션 켜짐(`enabled === true`)과 `per_trigger` 인데 저장된 토큰이 없으면 서버가 새 `itk_*` 를 발급한다. 평문은 그 PATCH 응답의 `data.secrets.interactionToken` 에 한 번만 싣는다. 결과의 전략이 `per_trigger` 가 아니거나 결과에 `interaction` 이 없으면 저장된 토큰을 지운다. 그 토큰으로 연 SSE 스트림도 닫는다([트리거 단위 토큰](CLE-EIA-DATA-TOKEN.md#트리거-단위-토큰)). 그래서 전략을 바꿨다가 다시 `per_trigger` 로 바꾸면 새 토큰을 받는다. 옛 토큰은 다시 살아나지 않는다. 인터랙션을 끄는 PATCH 는 토큰을 지우지 않는다. 그 토큰으로 연 SSE 스트림만 닫는다.
  - 두 값은 요청 본문으로 받지 않는다. top-level `interaction` · `notification` 본문에 실으면 전역 검증 파이프(`whitelist` + `forbidNonWhitelisted`)가 400 `VALIDATION_ERROR` 로 거부한다. 원시 `config` 에 `notification.signing.secretRef` 나 `interaction.triggerToken` 을 실으면 생성과 PATCH 모두 400 `VALIDATION_ERROR` 로 거부한다(`CONFIG_INTERNAL_FIELDS`, [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약)). 두 값이 없어도 원시 `config` 바로 아래의 `interaction` · `notification` 키는 값과 상관없이 400 `VALIDATION_ERROR` 로 거부한다. 거부 순서와 `details.field` 는 [트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약) 이 정한다.
  - 채팅 채널 `botTokenRef` 보존과 목적이 같다([트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약)). 방식도 같다. 두 참조 모두 행의 값을 쓰지 않고 트리거 id 로 다시 만든다.
- **`notification.retry`**: 발송할 때 `maxAttempts` 를 발송 큐 작업의 BullMQ `attempts` 로 넘긴다. `maxAttempts` 와 `backoff` 의 뜻은 [EIA 알림 웹훅](CLE-EIA-NOTIFY.md#재시도와-실패-처리) 의 「재시도와 실패 처리」 가 정한다.
- 설정 JSONB 는 키가 없으면 쓰지 않는 것으로 읽는다. 그래서 기존 트리거에 영향이 없다.

저장 형태:

- **알림 서명 시크릿**: `config.notification.signing.secretRef` 의 평문은 `SecretResolver` 가 관리하는 `secret_store` 테이블에 백엔드 AES-256-GCM 으로 암호화해 둔다. 정상 경로에서는 DB 에 암호문만 있고 설정 JSONB 에는 참조만 있다. 첫 시크릿은 서버가 발급한다. 언제 발급하고 언제 옛 평문을 옮기는지는 [EIA 알림 웹훅 「시크릿 교체」](CLE-EIA-NOTIFY.md#시크릿-교체) 가 정한다. PATCH 의 잠금은 위 「PATCH 와 서버가 만든 값」 에 있다. 서버는 `wsk_<64hex>` 를 만들어 트리거 id 로 정해지는 정식 참조(`secret://triggers/{triggerId}/notification-signing`)에 넣는다. `config` 에는 `signing.secretRef` 만 남긴다. 트리거를 만들 때는 트리거 INSERT 와 서버가 만드는 값의 처리(첫 시크릿 발급, `itk_*` 발급)를 한 트랜잭션에서 한다. 그래서 어느 단계가 실패해도 트리거 행과 시크릿이 남지 않는다([트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md#동시-쓰기-직렬화)). 평문은 발급한 그 응답에만 한 번 싣는다. 응답 위치(`data.secrets.notificationSigningSecret`)는 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md#api) 가 정한다. `signing.secret` 은 옛 키다. 타입 필드 `notification.signing` 은 `algorithm` 만 받고 원시 `config` 는 `notification` 키를 받지 않으므로 이 평문을 새로 받는 경로는 없다. 이미 저장된 행에 옛 평문 `signing.secret` 이 남아 있으면 발송 때 그 값으로 서명한다. 서버는 새 시크릿을 발급하지 않는다. 이 옛 평문은 그 트리거의 PATCH 때 시크릿 저장소로 옮긴다. `notification` 이 실린 PATCH 에서는 `NotificationSigningSecretService.settle` 이 트리거 설정 잠금 안에서 옮긴다. 그 밖의 PATCH 에서는 행을 저장한 뒤 `NotificationSigningSecretService.migrateLegacyPlaintext` 가 옮긴다. 옮기는 시점의 기준은 [트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약) 이다. 옮기기 전이나 옮기다 실패하면 JSONB 에 옛 평문이 남는다. 빈 문자열이거나 공백만 있는 `signing.secret` 은 옛 평문으로 보지 않는다. 발송 처리기는 주 시크릿이 없는 것으로 보고 발송 건강도를 `degraded` 로 둔다. 다음 `notification` PATCH 가 첫 시크릿을 발급한다. 저장 뒤 정규화(`migrateLegacyPlaintext`)는 그 값을 옮기지 않고 건너뛴다. 판정 기준은 [EIA 알림 웹훅 「시크릿 교체」](CLE-EIA-NOTIFY.md#시크릿-교체) 가 정한다.
- **`notification_secret_v2`**: 참조 대신 새 시크릿 평문 자체를 담는다. `NotificationSigningSecretService.writeRotation` 이 `` `wsk_${randomBytes(32).toString('hex')}` `` 를 그대로 저장하고, 발송 쪽 `notification-webhook.processor.ts` 는 그 값을 `SecretResolver` 를 거치지 않고 보조 HMAC 키로 쓴다(주 키만 `resolveSigningSecret` 을 거친다). 같은 역할의 채팅 채널 컬럼 `chat_channel_token_v2` 는 참조를 담아 일부러 다르다. 두 컬럼은 뜻이 다르다(알림 서명 시크릿 대 외부 봇 토큰). 컬럼 이름에 관한 결정은 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md), 저장 형태 예외의 기준은 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 가 정한다. 유예가 끝나 승격하면 값을 `secrets.rotate(정식 참조, 트리거의 워크스페이스 id, v2)` 로 시크릿 저장소에 옮기고 컬럼을 `null` 로 비운다. 이 컬럼은 비밀이 잠시 머무는 경유지다.
- **`config.interaction.triggerToken`**: 설정 JSONB 에 평문으로 둔다. [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 가 정한 명시적 예외다(결정 2026-08-16). 이 예외는 값이 서버가 발급한 무작위 hex 로만 채워진다는 전제에 기댄다. 호출자가 원시 `config` 로 실으면 400 `VALIDATION_ERROR` 다(위 「PATCH 와 서버가 만든 값」). 이 예외를 다른 필드를 평문으로 두는 선례로 쓰지 않는다.
- **응답 비노출**: 저장된 값은 응답에 나가지 않는다. 예외(일회성 응답)와 대상 필드 · 컬럼, 시행 방식은 [시크릿 저장소 §규칙](../CLE-INT/CLE-INT-SECRET.md#규칙) 4~6 이 기준이다. 현재 구현은 `TriggersService` 의 `TRIGGER_RESPONSE_STRIP_COLUMNS` 가 응답 경계에서 걷어 내고, `shared/testing/schedule-trigger-ref.ts`(스케줄 조인)와 `shared/testing/trigger-workflow-ref.ts`(트리거 직접 조회)가 부재를 단언한다. 저장 형태 예외(평문 보관)와 노출은 다른 문제다. 첫 발급 · 교체 응답이 새 시크릿을 한 번 평문으로 싣는 것([EIA 알림 웹훅](CLE-EIA-NOTIFY.md))은 응답이고, `notification_secret_v2` 가 유예 동안 평문인 것은 DB 저장이다.
- 일회성 평문(알림 서명 시크릿 첫 발급, 트리거 단위 토큰 발급)을 발급한 생성 · 수정 요청은 감사 기록 `trigger.created` · `trigger.updated` 의 `details.issuedSecrets` 에 발급한 비밀의 종류(`"notificationSigningSecret"` · `"interactionToken"`)를 남긴다. 평문은 싣지 않는다. 발급하지 않은 요청에는 이 키가 없다([감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md)).

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
- **트리거 단위 토큰**: `Trigger.config.interaction.triggerToken` 에 둔다. 값은 서버만 쓴다. 재발급하면 새 값으로 바꾼다.

## 저장소 매핑

### Postgres

| 테이블 | 흐름 | 읽고 쓰는 컬럼 | 비고 |
|---|---|---|---|
| `execution_token` | `iext_*` 발급 | INSERT `(jti, execution_id, issued_at, exp_at)` | 한 실행이 갱신으로 jti 여러 개를 가질 수 있다. INSERT 실패는 경고 후 진행 |
| `execution_token` | 갱신·종료 폐기 | DELETE `WHERE jti=?`(갱신) / `WHERE execution_id=?`(종료 일괄) | `idx_execution_token_execution_id` 단일 조회. `iext_*` 를 발급하지 않은 실행은 아무 일도 없다 |
| `trigger.config`(JSONB) | 인터랙션 설정 | `interaction.enabled`·`interaction.tokenStrategy`·`interaction.triggerToken`(`itk_*` 평문)·`interaction.appearance` | 1급 컬럼이 아니다. `triggerToken` 은 서버만 쓴다(생성 · PATCH 의 발급, `revoke-token` 의 재발급). PATCH 규칙은 [트리거 확장](#트리거-확장) |
| `trigger.config`(JSONB) | EIA 알림 웹훅 설정 | `notification.url`·`notification.events[]`·`notification.signing.{algorithm, secretRef}`·`notification.signing.secret`(옛 키. 읽기 · 옮기기만 하고 새로 받지 않는다)·`notification.retry.{maxAttempts, backoff}` | 생성이나 EIA 알림 웹훅 설정을 처음 붙이는 PATCH 때 서버가 발급한 `wsk_*` 의 참조를 `secretRef` 에 둔다. PATCH 와 옛 평문 `signing.secret` 의 처리는 [트리거 확장](#트리거-확장) |
| `trigger` | 발송 건강도 | UPDATE `notification_health`(`healthy`·`degraded`), `notification_last_error` | 발송 프로세서가 성공·최종 실패 때 |
| `trigger` | 시크릿 교체 | 트리거 설정 잠금 안에서 UPDATE `notification_secret_v2`(평문), `notification_rotated_at`. 승격 때 NULL 로 비움 | [서명 시크릿 교체와 승격](CLE-EIA-DATA-NOTIFY.md#서명-시크릿-교체와-승격) |
| `execution` | 인바운드 검증 | SELECT `status`(종료·입력 대기 검사, `itk_*` 의 `trigger_id` 대조). interact 는 실행 행을 직접 쓰지 않는다(재개 워커가 갱신) | 없음 |
| `execution` | 상태 조회 | SELECT `status`·`result`·`error`·`duration_ms`·`conversation_thread` | 대기 노드 실행 출력도 읽는다 |

### Redis 와 BullMQ

키 형태 규칙은 [Redis 키 명명 규약](../CLE-ENG/CLE-ENG-REDIS.md), 저장소 전체 목록은 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 이 기준이다. 아래 표는 EIA 가 소유한 키 · 채널 · 큐의 상세(용도·TTL·정책)다.

| 저장소 | 키·큐 | 흐름 | TTL·정책 |
|---|---|---|---|
| Redis | `iext:blacklist:<jti>` | 종료 이벤트·갱신 때 SET | TTL = 원래 JWT 만료까지. Redis 를 못 쓰면 fail-open(검증도 fail-open + 경고) |
| Redis | `interaction:idempotency:<executionId>:<route>:<key>` | 명령 응답 캐시 `{ bodyHash, responseJson, statusCode }` | 24시간. 캐시 대상은 `2xx`·`409`·`410` 뿐이다. 같은 키에 다른 본문은 409. 항목이 손상되면(형태 불일치·`responseJson` 파싱 실패) 버리고 새로 처리하며 경고한다(500 아님). 키는 가드가 검증한 `executionId` 와 경로(`interact`·`cancel`)로 묶는다([EIA 수신 API와 SSE](CLE-EIA-INBOUND.md)) |
| Redis | `exec:seq:<executionId>` | `INCR`. SSE `id:`·EIA 알림 웹훅 `seq` 공용 카운터. 버퍼 키가 없는 SSE 재연결은 `GET` 으로 읽어 놓친 이벤트가 있는지 판정한다 | 발급마다 만료를 늘리는 슬라이딩 TTL 이다. 종료 이벤트 뒤에는 가능하면 지운다. 기본값과 해제 규칙은 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md)·[WebSocket 연결과 채널 구독](../CLE-API/CLE-API-WS.md) 이 정한다 |
| Redis | `eia:rl:interact:<executionId>`, `eia:rl:status:<executionId>`, `eia:notif:rl:<triggerId>` | 인바운드 명령·상태 조회의 요청 빈도 제한, EIA 알림 웹훅 발송의 폭주 감지 | 고정 윈도우, fail-open. 한도는 [External Interaction API](CLE-EIA.md) |
| Redis | `eia:sse:buf:<executionId>` | SSE 재전송 버퍼(Stream). 각 서버 인스턴스가 자기 프로세스에서 받은 실행 이벤트를 `XADD … MAXLEN ~ 1000` 으로 넣는다. 넣는 실행과 항목 크기 상한은 [SSE 스트림](CLE-EIA-DATA-SSE.md#sse-스트림) 절을 따른다. 항목 필드는 `seq`(순번 문자열)와 `data` 둘이다. `data` 는 `{v:1, origin, event}` JSON 이거나 생략 표시 `{v:1, origin, omitted:{executionId, seq, eventType}}` JSON 이다. 재연결 때 `XRANGE` 로 읽는다. `seq` 가 `Last-Event-Id` 이하인 항목은 `data` 를 파싱하지 않고 `seq` 필드가 없는 옛 항목은 파싱한다. 모르는 버전이나 모양이 틀린 항목은 버린다 | 넣을 때마다 `PEXPIRE` 5분을 다시 건다. 그래서 마지막 이벤트 5분 뒤 키가 사라진다. 재전송은 항목 id 의 시각으로 받은 지 5분 이내인 항목만 쓴다. 넣지 못한 이벤트와 생략 표시만 넣은 이벤트의 전체 내용은 아래 메모리 버퍼에 둔다. 읽지 못하면 메모리 버퍼와 순번 카운터로 판정한다(fail-open, 경고 로그) |
| Redis | `eia:sse:subs:<executionId>` | 연결 슬롯(동시 연결 상한 계산용). [SSE 스트림](CLE-EIA-DATA-SSE.md#sse-스트림) 절의 연결 자리와 같다. 실행당 동시 SSE 연결(ZSET, member = 구독 id, score = 마지막 heartbeat 시각). 연결 때 Lua 스크립트 하나로 오래된 member 제거, 개수 확인, 추가를 원자적으로 한다 | heartbeat(15초)마다 score 를 갱신하고 키 TTL 을 heartbeat 간격의 3배(45초)로 다시 건다. 이 갱신 pipeline 은 명령 하나가 실패해도 실패로 보고 경고를 남긴다. 연결이 끝나면 `ZREM` 한다. 서버 인스턴스가 정상 종료할 때도 자기 연결의 자리를 돌려준다. heartbeat 간격의 3배보다 오래된 member 는 다음 연결 때 지운다. Redis 를 못 쓰면 서버 인스턴스마다 센다(fail-open, 경고 로그) |
| Redis pub/sub | `eia:sse:live:<executionId>` | SSE 실시간 전달. `XADD` 와 같은 pipeline 에서 `PUBLISH` 한다. 메시지는 Stream 항목의 `data` 와 같다(생략 표시 포함). `origin` 은 발행한 서버 인스턴스의 표시다. 그 실행의 구독자가 있는 서버 인스턴스만 전용 구독 연결로 `SUBSCRIBE` 한다. 자기 `origin` 의 메시지는 고정 접두(`{"v":1,"origin":"<자기 origin>",`)로 알아보고 파싱하지 않고 건너뛴다. 생략 표시의 처리는 [SSE 스트림](CLE-EIA-DATA-SSE.md#sse-스트림) 절을 따른다 | 채널이라 TTL 이 없다. 구독자가 없을 때 발행한 메시지는 버려진다. 유실된 메시지는 Stream 에 남는다. 구독 연결이 다시 준비되거나 `SUBSCRIBE` 확인이 늦게 오면 [SSE 스트림](CLE-EIA-DATA-SSE.md#sse-스트림) 절 「구독이 다시 확정될 때」 로 따라잡는다. Redis 를 못 쓰면 그 서버 인스턴스가 낸 이벤트만 그 서버 인스턴스의 구독자에게 간다(fail-open, 경고 로그) |
| Redis pub/sub | `eia:sse:close` | 트리거 단위 토큰 스트림 닫기 신호 `{v:1, origin, triggerIds}`. 모든 서버 인스턴스가 구독한다. 받은 서버 인스턴스는 자기 구독자 가운데 그 트리거의 `itk_*` 스트림을 닫는다 | 채널이라 TTL 이 없다. 발행은 2초 안에 끝나지 않으면 기다리지 않는다. 발행이 실패하면 호출마다 error 로그(트리거 id · 오류)를 남긴다(fail-open). 신호가 유실돼도 트리거 단위 토큰 스트림은 60초 재확인으로 닫힌다. 자기 `origin` 의 메시지는 건너뛰고 모양이 틀린 메시지는 버린다. 구독 연결이 다시 준비(`ready`)되면 다시 구독한다 |
| 메모리 | `SseAdapter` 메모리 버퍼 | Redis 에 넣지 못한 이벤트와 크기 상한을 넘어 Redis 에는 생략 표시만 올린 이벤트의 전체 내용을 담는 실행별 버퍼. Redis 없이 부팅한 서버 인스턴스에서는 판정 없이 모든 실행의 이벤트를 담는다. 재전송 때 Redis 버퍼와 `seq` 로 합친다(같은 `seq` 는 하나만. 생략 표시와 겹치면 전체 이벤트를 쓴다) | 5분 보관, 최대 1000건. 60초마다 훑어 마지막 이벤트 뒤 5분이 지난 버퍼와 그 실행의 쓰기 대상 판정을 지운다. 그 서버 인스턴스가 낸 이벤트만 담는다. Redis 를 붙인 서버 인스턴스에서는 Redis 쓰기 대상이 아닌 실행의 이벤트를 담지 않는다 |
| BullMQ | `notification-webhook` | `NotificationDispatcher.enqueue` → `NotificationWebhookProcessor` | `jobId`=deliveryId 로 중복 제거, `attempts` 는 트리거의 `notification.retry.maxAttempts`(뜻은 [EIA 알림 웹훅](CLE-EIA-NOTIFY.md#재시도와-실패-처리)), base-4 사용자 정의 backoff(워커 `settings.backoffStrategy`, 1초에서 4배씩 늘고 한 간격은 1시간을 넘지 않음), `removeOnComplete` 24시간, `removeOnFail` 7일 |
| BullMQ | `notification-secret-rotator` | 매시 반복(`0 * * * *`) → v2 승격 | `upsertJobScheduler` 멱등. 여러 서버 인스턴스에서 전역 한 번 |
| BullMQ | `terminal-revoke-reconcile` | 분마다 반복(`* * * * *`) → 종료된 실행에 남은 실행 토큰 정리 → `revokeAllForExecution`(`TerminalRevokeReconcilerService`) | `upsertJobScheduler` 멱등. 전역 한 번. 즉시 경로 누락분을 최소 한 번 보강한다. 실행 토큰 테이블이 영속 outbox 역할을 하므로 전용 테이블이 없다 |
| BullMQ | `webchat-idle-reaper` | 분마다 반복 → 공개 웹훅(`auth_config_id IS NULL`)이 시작한 입력 대기 실행 가운데 실행 토큰 행이 하나 이상 있고 가장 늦은 `execution_token.exp_at` 뒤로 유예 시간(`WEBCHAT_IDLE_REAP_GRACE_MS`)이 지난 실행 → 엔진 `markWebChatIdleTimeout`(조건부 UPDATE `cancelled`·`cancelledBy='timeout'`·`error.code='WEBCHAT_IDLE_TIMEOUT'`) + `revokeAllForExecution`(`WebChatIdleReaperService`) | `upsertJobScheduler` 멱등. 전역 한 번. 종료 토큰 정리 작업의 형제(같은 원천, 다른 큐·서비스). 판정이 실행 토큰 행에서 시작하므로 토큰 행이 없는 실행은 대상이 아니다. 채팅 채널 실행, 인터랙션을 끈 웹훅 실행, 트리거 단위 토큰을 쓰는 실행이 여기 든다. 웹채팅 위젯 유휴 실행 회수 전용 |
| BullMQ | `execution-continuation` | 인바운드 명령 위임의 도착지(발행자 ContinuationBus) | 큐 기준은 [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) |

## 구현 위치

- `codebase/backend/src/modules/external-interaction/entities/execution-token.entity.ts`
- `codebase/backend/src/modules/triggers/triggers.service.ts` (`create`, `mergeExternalConfig`, `mergeRawConfig`(PATCH 원시 `config` 의 최상위 키 병합), `revokePerTriggerToken`, `rotateNotificationSecret`, `promoteRotatedNotificationSecrets`, `TRIGGER_RESPONSE_STRIP_COLUMNS`)
- `codebase/backend/src/modules/triggers/trigger-config-internal-fields.ts` (`CONFIG_INTERNAL_FIELDS`, 원시 `config` 의 서버 소유 필드 거부, 타입 키(`notification` · `interaction` · `chatChannel`) 거부, `secret://` 값 거부)
- `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` (`TriggerDto.secrets`, 일회성 평문을 발급한 응답에만 있는 필드)
- `codebase/backend/src/modules/triggers/dto/responses/trigger-secret-issue-response.dto.ts` (`TriggerIssuedSecretsDto`, 일회성 평문 응답 `data.secrets`)
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (`acquireTriggerConfigLock`)
- `codebase/backend/src/shared/testing/schedule-trigger-ref.ts` (응답 비노출 단언)
- `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` (응답 비노출 단언)
- `codebase/backend/migrations/V059` (트리거 확장 컬럼과 `notification_health` CHECK)
- `codebase/backend/migrations/V060` (실행 토큰 테이블)
- `codebase/backend/migrations/V061` (발송 건강도 부분 인덱스)

## Rationale

### 실행 토큰 테이블을 따로 둔다

JWT 는 무상태로 검증할 수 있어 저장소가 필요 없어 보인다. 그러나 실행이 끝날 때 그 실행이 발급한 토큰을 빠짐없이 폐기하려면 발급 jti 목록이 있어야 한다. 그래서 jti 를 실행별로 기록하는 테이블을 두고, 같은 테이블을 종료 토큰 정리 작업과 웹채팅 위젯 유휴 실행 회수의 원천으로 함께 쓴다. 이미 만료된 jti 는 블랙리스트에 올릴 필요가 없으므로 `exp_at` 을 함께 둔다.

### 공백만 있는 옛 평문은 옮기지 않는다 (2026-11-06)

「저장 형태」 의 알림 서명 시크릿 항목에 빈 문자열이나 공백만 있는 `signing.secret` 의 처리를 더했다. 결정과 근거는 [EIA 알림 웹훅 「공백만 있는 옛 평문도 없는 것으로 본다」](CLE-EIA-NOTIFY.md#공백만-있는-옛-평문도-없는-것으로-본다-2026-11-06) 에 있다.
