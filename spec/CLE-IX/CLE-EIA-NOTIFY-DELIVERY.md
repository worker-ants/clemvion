---
id: "CLE-EIA-NOTIFY-DELIVERY"
title: "EIA 알림 웹훅 — 서명과 발송"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EIA-NOTIFY"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-EIA-NOTIFY"]
area: "CLE-IX"
content_hash: "6978ae8e85a7a064f99f13fe48a3a7943efb471ece1523ad94c31425960e86fb"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "7d8fafb15cf499fb7a8047f89fe883a033d02b2cd6acdeb4e1989fe69bae2624"
etag: "sha256-04dbc56057ab4580f6c15408d9afa75676b21ae2e42f00b287267a6d11999f5e"
---
## 개요

이 문서는 [EIA 알림 웹훅](CLE-EIA-NOTIFY.md) 의 하위 문서로 헤더와 서명, 재시도와 실패 처리, 전달 보장, 폭주 감지를 정한다. 발송 파이프라인(`NotificationFanout` → `NotificationDispatcher` → `notification-webhook` 큐 → `NotificationWebhookProcessor`)과 큐 설정은 [EIA 데이터와 흐름](CLE-EIA-DATA.md) 에 있다.

## 헤더와 서명

```
POST <notification.url>
Content-Type:           application/json
X-Clemvion-Event:       execution.waiting_for_input
X-Clemvion-Execution-Id: <uuid>
X-Clemvion-Trigger-Id:   <uuid>
X-Clemvion-Workflow-Id:  <uuid>
X-Clemvion-Delivery:     <uuid>            # 다시 보내도 같다
X-Clemvion-Timestamp:    <unix>
X-Clemvion-Signature:    t=<unix>,v1=<hex>
```

서명 계산 규칙(Stripe 방식):

```
signed_payload = "{timestamp}.{rawBody}"
signature      = HMAC_SHA256(secret, signed_payload)   // hmac-sha512 면 SHA-512
header value   = "t={timestamp},v1={hex(signature)}"
```

- 알고리즘 기본값은 `hmac-sha256`, 다른 값은 `hmac-sha512` 뿐이다(`notification-signature.util.ts`).
- 시크릿 교체 유예 중에는 새 시크릿으로도 서명해 `v1=` 를 두 개 싣는다(`t=<unix>,v1=<hex>,v1=<v2hex>`).
- 서명 스킴 버전은 별개 축이다. 헤더의 `v1=` 가 그 버전이고, 새 스킴을 들이면 `v2=` 를 함께 적는다. 지금 발행하는 것은 `v1=` 뿐이다. 이 `v2` 는 시크릿 교체용 `notification_secret_v2` 컬럼과 이름만 겹치고 관계가 없다.
- 검증 측 헬퍼 `verifySignatureHeader`(±5분 허용)는 SDK·e2e 가 다시 쓸 수 있게 export 돼 있다.

수신 측 검증 규칙:

- 타이밍 안전 비교를 쓴다.
- `timestamp` 가 현재 시각 ±5분 밖이면 거부한다(재전송 공격 방지).
- 시크릿 교체 유예(24시간) 중에는 옛 시크릿과 새 시크릿을 둘 다 시도하고 하나라도 맞으면 통과시킨다.
- 알고리즘은 `hmac-sha256`·`hmac-sha512` 두 값만 받는다. 웹훅 인바운드 HMAC 검증([웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md))의 `sha256`·`sha512` 와 같은 두 알고리즘이고 표기만 다르다.
- 서명 헤더 누락·형식 위반·시간 창 초과·서명 불일치는 모두 같은 401 메시지로 답한다. 어떤 알고리즘을 쓰는지 새지 않게 하려는 것이다.

## 재시도와 실패 처리

| 항목 | 값 |
|---|---|
| 성공 기준 | HTTP `2xx` |
| 리다이렉트 | 발송은 리다이렉트를 따라가지 않는다. 3xx 응답은 `2xx` 가 아니므로 실패로 보고 다른 실패와 같은 간격으로 재시도한다. 마지막 시도가 3xx 로 실패하면 `notification_last_error` 는 `HTTP <status> <statusText>. Redirects are not followed. Register the final URL as the notification URL.` 이다 |
| 타임아웃 | 10초 |
| 시도 횟수 | `notification.retry.maxAttempts` 는 첫 시도를 포함한 총 시도 횟수다. 기본 5, 상한 10 이다. 0 은 1(큐 재시도 없음)로 본다. 이 값을 발송 큐(`notification-webhook`) 작업의 `attempts` 로 넘긴다. 기본값이면 큐 재시도는 네 번이다 |
| 간격 | 1초에서 시작해 4배씩 늘어나고 한 간격은 1시간을 넘지 않는다(1s · 4s · 16s · 64s … 최대 1시간). 간격 수는 총 시도 횟수보다 하나 적다. 1시간 상한은 일곱째 간격부터 걸린다. 그래서 총 시도 횟수가 8 이상일 때만 걸리고 기본값 5 에는 걸리지 않는다. 총 시도 횟수가 상한 10 이면 간격은 1 · 4 · 16 · 64 · 256 · 1024 · 3600 · 3600 · 3600초다. 마지막 재시도는 첫 시도 뒤 12,165초(약 3.4시간)에 나간다. 이 값은 간격만 더한 것이다. 시도마다 응답을 최대 10초 기다리는 시간은 따로 더해진다. 설정 값 `backoff: "exponential"` 은 이 간격을 뜻한다. BullMQ 내장 `exponential`(2배씩 늘어남)과는 이름만 같다. 내장 전략으로는 4배 간격을 낼 수 없어 사용자 정의 전략을 쓴다. 워커 `settings.backoffStrategy`(`NotificationWebhookProcessor`)가 `min(1000·4^(attemptsMade-1), 3600000)` 밀리초를 돌려준다(`notificationBackoffDelayMs`). 작업 옵션 `backoff.type = NOTIFICATION_BACKOFF_TYPE`(`exp-base4`)이 이 전략을 가리킨다 |
| 같은 이벤트 식별 | `X-Clemvion-Delivery` UUID(다시 보내도 같다) |
| 최종 실패 | 발송 건강도 `degraded` + `notification_last_error`(500자로 자름). 트리거를 자동으로 끄지 않는다(사용자 승인 필요). 발송 건강도 배지는 트리거 상세 화면에 보인다. 실패 기록(`notificationLastError`)은 트리거 REST 응답에만 실리고 자격 증명 모양은 가린다([응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md#310-트리거-응답의-마지막-오류-2026-10-05)) |
| 낡은 알림 웹훅 차단 | 발송 직전 실행 상태를 다시 읽어 이미 종료면 진행 중 이벤트(`waiting_for_input`·`ai_message`)를 보내지 않는다 |

최소 한 번 전달은 발송 작업이 발송 큐(`notification-webhook`)에 적재된 뒤에만 성립한다. 적재 전에 프로세스가 끝나거나 적재가 실패하면 그 발송은 사라지고 발송 건강도에도 남지 않는다. 적재가 실패하면 경고 로그만 남긴다. 적재 실패의 처리는 [EIA 데이터와 흐름 「알림 웹훅 발송」](CLE-EIA-DATA.md#알림-웹훅-발송) 이 정한다. 발송 큐 적재를 fail-open 으로 두는 근거는 [EIA 데이터와 흐름 「인프라 장애에는 fail-open 한다」](CLE-EIA-DATA.md#인프라-장애에는-fail-open-한다) 에 있다.

발송 건강도(`notification_health`)는 `unknown`(확인 안 됨)·`healthy`(정상)·`degraded`(저하됨) 세 값이다. `notification.retry` 설정의 뜻(시도 횟수와 간격)은 위 표가 정하고 다른 문서는 이 표를 가리킨다.

## 폭주 감지

트리거당 분당 60건 한도는 발송을 줄이거나 늦추는 데 쓰지 않는다. 폭주를 알리는 표시다.

- 발송에 성공(2xx)할 때마다 `OutboundNotificationRateLimiterService.consume(triggerId)` 가 트리거당 분당 발송 수를 센다(Redis 고정 윈도우 `INCR`+`EXPIRE NX`, fail-open). 키는 `eia:notif:rl:<triggerId>` 다.
- 60건을 넘으면 `healthy` 대신 `notification_health='degraded'` 와 폭주 전용 `notification_last_error`(`Outbound rate exceeded …`)를 기록한다. 초과분도 버리지 않고 계속 보낸다. 수신 엔드포인트의 부하만 알린다.
- 마지막 시도까지 실패한 발송과 폭주가 같은 `degraded` 를 쓴다. 원인은 `notification_last_error` 로 가른다.
- 카운트는 발송 성공 분기에서 올린다. 실패·재시도 경로는 발송 실패 쪽 `degraded` 가 맡으므로 폭주 카운트에서 사실상 빠진다.

## 구현 위치

- `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts` (`retry.maxAttempts` 를 큐 시도 횟수로 넘김)
- `codebase/backend/src/modules/external-interaction/notification-dispatcher.service.ts` (BullMQ 적재, `NOTIFICATION_BACKOFF_TYPE`)
- `codebase/backend/src/modules/external-interaction/notification-dispatcher.types.ts` (`NOTIFICATION_BACKOFF_TYPE`, 4배 간격 계산 `notificationBackoffDelayMs`, 간격 상한 `NOTIFICATION_BACKOFF_MAX_DELAY_MS`)
- `codebase/backend/src/modules/external-interaction/notification-webhook.processor.ts` (HTTP POST·재시도·서명·SSRF·낡은 알림 웹훅 검사·발송 건강도, 3xx 를 따라가지 않고 실패로 처리)
- `codebase/backend/src/modules/external-interaction/notification-signature.util.ts` (서명 계산, `verifySignatureHeader`)
- `codebase/backend/src/modules/external-interaction/outbound-notification-rate-limiter.service.ts` (폭주 감지 카운터)

## Rationale

### 서명 알고리즘 표기를 인바운드와 나눈다

트리거의 인바운드 웹훅 HMAC 검증([웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md))은 인증 설정 메타 `AuthConfig.config.algorithm: 'sha256' | 'sha512'` 를 쓴다. 알림 서명은 `signing.algorithm: 'hmac-sha256' | 'hmac-sha512'` 로 적는다. 인바운드는 외부 발신자(GitHub 등)의 서명 헤더 형식(`X-Hub-Signature-256: sha256=...`)과 맞아야 하고, 아웃바운드는 자체 서명 헤더(`X-Clemvion-Signature: t=...,v1=...`)의 알고리즘 식별자 뜻이 분명하도록 `hmac-` 접두사를 붙인다. 두 경로 모두 허용 알고리즘은 SHA-256·SHA-512 두 가지다.

- 둘 다 `sha256` 으로 맞추는 안: 아웃바운드 표기에서 HMAC 서명이라는 것이 드러나지 않아, 나중에 다른 서명 방식(예: Ed25519)을 더할 때 식별자가 모호해진다.
- 둘 다 `hmac-sha256` 으로 맞추는 안: 인바운드는 외부 발신자가 정한 형식(`sha256=<hex>`)과 맞아야 해서 기존 표기를 바꾸면 호환성이 깨진다.

인바운드 값의 출처는 인증 설정 메타다. 트리거 설정에는 없다. 트리거의 옛 인라인 인증 키(`authType`·`secret`·`bearerToken`·`hmacHeader`·`hmacAlgorithm`)는 `V066__trigger_config_strip_inline_auth.sql` 로 제거됐고 `triggers.service.ts` 가 저장할 때 걷어 낸다. 출처가 바뀌어도 결론은 같다.

### 폭주는 저하 표시로 알린다

트리거당 분당 60건을 넘어도 알림 웹훅을 버리거나 늦추지 않고 보낸다. 성공했을 때 초과했으면 `degraded` 로만 표시한다(결정 2026-07-07).

- 버리기·늦추기 안을 기각했다. 폭주 감지 요구사항은 초과분도 버리지 않고 그대로 보낸다고 정한다. EIA 알림 웹훅은 실행 결과의 부수 통지라 잃으면 관측성을 잃는다. 그래서 발송을 줄이거나 늦추지 않고 "폭주 감지 → 건강도 표시" 로 구현한다.
- 발송 실패와 폭주가 `degraded` 를 함께 쓴다. `flooded` 같은 새 값을 두는 안은 V059 CHECK 제약·UI·기록의 세 군데 마이그레이션을 부르는데, 두 상태 모두 "이 트리거의 알림 웹훅 발송이 정상이 아니다" 라는 같은 운영 신호라 이득이 작다. 원인은 `notification_last_error` 로 가른다.
- `healthy` 복귀: 폭주가 멎어 분당 60건 이내로 발송에 성공하면 다음 성공이 `healthy` 로 되돌린다. `degraded` 는 폭주가 이어지는 동안만 유지되는 일시 신호다.

### `retry.maxAttempts` 를 발송 큐에 넘긴다 (2026-10-09)

이 값은 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) 에서 편집할 수 있는 설정이다. 결정할 때 발송은 이 값을 읽지 않고 시도 횟수를 5로 고정했다. 사용자 결정(2026-10-09, NERV Task `CLE-T-M6PERB`)으로 설정을 반영한다. 함께 제시한 다른 안은 `retry` 를 입력에서 빼는 것이었다.

- 값의 뜻은 첫 시도를 포함한 총 시도 횟수다. BullMQ 작업 옵션 `attempts` 와 같은 뜻이다. 입력은 0 부터 10 까지 받고 0 은 1(큐 재시도 없음)로 본다. 기본 5 면 큐 재시도는 네 번이고 간격은 1초 · 4초 · 16초 · 64초다.
- `backoff: "exponential"` 은 BullMQ 내장 지수 백오프(2배씩 늘어남)가 아니라 1초에서 시작해 4배씩 늘어나는 간격이다. 이름이 같아 헷갈리기 쉬워서 [재시도와 실패 처리](#재시도와-실패-처리) 표에 뜻을 적었다. 이 뜻은 그 표 한 곳에 두고 [EIA 데이터와 흐름](CLE-EIA-DATA.md) 은 그 표를 가리킨다([EIA 알림 웹훅 「정본을 한 곳에 둔다」](CLE-EIA-NOTIFY.md#정본을-한-곳에-둔다)).

### 재시도 간격에 1시간 상한을 둔다 (2026-10-17)

알림 웹훅 재시도의 한 간격은 1시간을 넘지 않는다. 총 시도 횟수 상한 10 은 그대로다. 사용자 결정(2026-10-17)이고 작업은 NERV Task `CLE-T-EQDYC1` 다.

- 상한이 없으면 총 시도 횟수 10 의 마지막 간격은 65,536초(약 18.2시간)다. 간격을 모두 더하면 87,381초(약 24.3시간)다. 상한을 두면 같은 설정에서 12,165초(약 3.4시간)로 줄어든다.
- 발송 건강도는 마지막 시도가 실패해야 `degraded` 가 된다. 재시도 창이 하루면 운영자는 발송 실패를 하루 늦게 안다.
- 진행 중 이벤트는 낡은 알림 웹훅 차단이 걸러 낸다. 종결 이벤트는 그 대상이 아니라서 하루 늦게라도 나간다.
- 발송 직전 SSRF 검사는 시도마다 한다. 그러나 이 결정 때는 DNS 결과 검사(`NOTIFICATION_ENFORCE_DNS_REBIND_GUARD`)가 기본 꺼짐이었다(2026-11-06 부터 운영 환경에서 기본 켜짐, [EIA 알림 웹훅 — SSRF 방지](CLE-EIA-NOTIFY-SSRF.md#운영-환경에서-dns-결과-검사를-기본으로-켠다-2026-11-06)). 재시도 창이 길수록 등록 뒤 바뀐 DNS 응답으로 보낼 여지도 길어진다.
- 상한은 EIA 알림 웹훅에만 둔다. 재개 큐(`execution-continuation`)도 1초에서 4배씩 늘지만 상한이 없고 전략 이름(`continuation-exp4`)도 따로다([큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md)). 알림 웹훅 쪽 전략 이름 `exp-base4` 는 그대로 둔다.

기각한 대안:

- **상한 없음**(그때까지의 동작): 위 이유로 재시도 창이 하루에 이른다.
- **총 시도 횟수 상한을 10 보다 낮춘다**: 총 지연은 줄어든다. 그러나 이미 8~10 으로 저장한 트리거의 값이 입력 범위를 벗어난다. 긴 장애 동안 시간 단위로 여러 번 다시 시도하는 길도 사라진다.

### 알림 웹훅 발송은 리다이렉트를 따라가지 않는다 (2026-10-18)

알림 웹훅 발송은 3xx 응답을 따라가지 않고 실패로 본다. 그때까지 발송은 fetch 기본값대로 리다이렉트를 따라가서 등록 URL 검사와 DNS 검사를 우회할 수 있었다(코드 리뷰 발견, NERV Task `CLE-T-ZGYXSZ`).

- 등록 때와 발송 직전의 SSRF 검사는 등록 URL 의 호스트만 본다. 리다이렉트를 따라가면 공개 호스트가 302 · 307 로 사설 · loopback · 메타데이터 주소를 가리켜 두 검사와 `NOTIFICATION_ENFORCE_DNS_REBIND_GUARD` 를 통과한다.
- 307 · 308 은 메서드와 본문을 바꾸지 않고 다시 보내라는 응답이다. 그래서 따라가면 서명한 POST 본문도 그 주소로 간다.
- 3xx 도 `2xx` 가 아닌 다른 응답과 같이 재시도한다. 처리기는 시도마다 트리거 설정의 URL 을 다시 읽는다. 그래서 사용자가 URL 을 고치면 남은 재시도에 반영된다. 3xx 를 받았을 때 바로 `degraded` 로 보내는 별도 분기는 두지 않는다.

기각한 대안:

- **HTTP Request 노드처럼 따라가며 홉마다 다시 검사한다**: [HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md) 는 `integration` 인증일 때 3xx 를 최대 5홉까지 따라가고 홉마다 사설망 차단을 다시 검사한다. 같은 노드도 `none` · `custom` 인증일 때는 3xx 를 따라가지 않는다. 알림 웹훅 발송은 같은 노드의 `none` · `custom` 인증 쪽 동작을 따른다. 알림 웹훅이 따라가면 307 · 308 이 서명한 본문과 `X-Clemvion-*` 헤더를 다른 호스트로 그대로 보낸다. 따라가는 홉마다 SSRF 검사를 다시 하려면 그 코드와 시험을 새로 들여야 한다. 정상 수신 서버는 최종 URL 을 등록하면 된다.
- **같은 출처 리다이렉트만 따라간다**: 새 허용 규칙이 필요하다. 등록 URL 을 최종 주소로 바꾸면 같은 결과를 얻는다.
- **3xx 를 받으면 재시도 없이 바로 최종 실패(`degraded`)로 둔다**: 임시 리다이렉트는 상대 서버가 고치거나 사용자가 URL 을 고치면 회복될 수 있다. 다른 `2xx` 가 아닌 응답과 같은 재시도 규칙을 따르면 처리 분기가 늘지 않는다. 대신 영구 리다이렉트도 재시도가 끝날 때까지 `degraded` 표시가 늦어진다. 기본 설정(총 시도 5)이면 간격만 더해 85초, 총 시도 횟수 상한 10 이면 12,165초(약 3.4시간) 늦어진다.

### 전달 보장의 시작점을 발송 큐 적재로 좁힌다 (2026-11-05)

NERV Task `CLE-T-YR4EK5` 에서 구현에 맞췄다. 이전 요구사항 문장은 최소 한 번 전달을 조건 없이 보장한다고 읽혔다. 구현은 실행 트랜잭션이 커밋된 뒤 발송 작업을 큐에 넣고, 적재가 실패해도 실행을 막지 않는다([EIA 데이터와 흐름 「인프라 장애에는 fail-open 한다」](CLE-EIA-DATA.md#인프라-장애에는-fail-open-한다)). 적재 전에 사라진 발송은 재시도 대상이 아니므로 보장의 시작점을 적재로 적었다.

### «낡은 알림 웹훅 차단» 으로 이름을 맞췄다 (2026-11-12)

용어 사전 기준(EIA 알림 웹훅을 단독 «알림» 으로 쓰지 않는다)에 맞춰 [EIA 데이터와 흐름](CLE-EIA-DATA.md) 과 같은 이름으로 바꿨다. 뜻은 바뀌지 않았다(NERV Task `CLE-T-GNTWP9`).
