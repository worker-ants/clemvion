# 신규 식별자 충돌 검토 — `spec/5-system/14-external-interaction-api.md`

## 조사 방법

1. `origin/main` 대비 실제 diff를 먼저 확인했다 — 이번 turn 의 target 변경분은 `spec/5-system/14-external-interaction-api.md` 9줄(5 삽입/4 삭제)뿐이며, 전부 `durationMs`·`error.code` null 가능 사유를 보강하는 **순수 서술 수정**이다. 새 ID·엔티티명·endpoint·이벤트명·env var·파일 경로는 diff 안에 **전혀 없다** (언급된 `WORKER_HEARTBEAT_TIMEOUT`/`RESUME_*`/`EXECUTION_QUEUE_WAIT_TIMEOUT`/`WEBCHAT_IDLE_TIMEOUT` 는 모두 기존 코드에 이미 존재하는 값을 재인용한 것 — `spec/5-system/4-execution-engine.md`, `spec/conventions/error-codes.md`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 에서 grep 으로 확인).
2. diff 만으로는 충돌 여지가 없으므로, bundle 로 제공된 문서 전문(기존에 이미 정착된 partial-status spec, `status: partial` + 다수 "구현됨" 마킹)을 대상으로 신규 식별자 충돌 6개 관점을 폭넓게 재점검했다.

## 발견사항

이번 diff 자체는 신규 식별자를 도입하지 않는다. 문서 전체를 대상으로 6개 관점을 재조사한 결과, **기술적 충돌(동일 식별자·다른 의미)은 발견되지 않았다.** 아래는 조사 중 확인한, 잠재적으로 헷갈릴 수 있어 보였으나 실측 결과 이미 spec 내에서 명시적으로 해소/문서화되어 있던 항목들이다.

- **[INFO]** "Notification" 용어가 두 개의 이질적 서브시스템에서 쓰인다
  - target 식별자: `NotificationDispatcher` / `NotificationWebhookProcessor` / `notification.url` / `Trigger.notificationHealth` (외부 시스템에 보내는 outbound webhook 통보 — §3.1/§6/§7.1)
  - 기존 사용처: `codebase/backend/src/modules/notifications/notifications.service.ts` (`NotificationsService`) — `/api/notifications`, `notification` DB 테이블, WS `notification.new` (`spec/2-navigation/9-user-profile.md:370-377`, `spec/data-flow/8-notifications.md`) — 워크스페이스 사용자에게 보여주는 인앱/이메일 알림
  - 상세: 두 시스템 모두 "notification/알림" 을 자기 도메인 이름으로 쓴다. DB 테이블(`notification` 단독 테이블 vs `trigger.notification_*` 컬럼), endpoint(`/api/notifications/*` vs `/api/triggers/:id/notification/*`), WS 이벤트 네임스페이스(`notification.new` vs `execution.*`/webhook `type`)가 전부 분리되어 있어 **기술적 충돌은 없다.** 다만 grep·온보딩 관점에서 "Notification\*" 클래스명이 두 갈래로 흩어져 있어 첫 접근 시 헷갈릴 여지는 있다. 이 이름은 이번 diff 로 새로 생긴 것이 아니라 이미 구현·다회 리뷰를 거친 기존 명명이다(예: `codebase/backend/src/modules/triggers/notification-secret-rotator.service.ts` 가 이미 존재).
  - 제안: 실질 조치 불요(비차단). 후속 문서화를 원하면 EIA §Rationale 에 "본 `notification` 은 트리거 outbound webhook 전용이며 인앱 알림(`NotificationsService`)과 무관"이라는 한 줄 caveat 추가 정도로 충분.

- **[정상 — 충돌 없음, 확인 완료]** `rotate-secret` 동사 재사용 위험
  - `spec/5-system/15-chat-channel.md:566`, `spec/conventions/audit-actions.md:76` 이 EIA 의 `notification/rotate-secret`(HMAC secret) 과 Chat Channel 의 `chat-channel/rotate-bot-token`(bot token) 을 **의도적으로 다른 동사**로 분리한 근거를 이미 명시하고 있다 — 동일 동사 재사용 시 "의미 혼동" 이 생긴다는 점까지 문서화됨. 새 충돌 없음.

- **[정상 — 충돌 없음, 확인 완료]** `EIA-*` 요구사항 ID 47개 전수
  - `spec/` 전체에서 `EIA-[A-Z]+-[0-9]+` 패턴을 모두 추출(47개)한 뒤 target 문서가 정의한 47개 테이블 행과 diff 했다. 정확히 일치 — dangling/재정의/타 의미 재사용 없음.

- **[정상 — 충돌 없음, 확인 완료]** ENV var / 상수
  - `INTERACTION_JWT_SECRET`, `WEBCHAT_IDLE_REAP_GRACE_MS`, `ALLOW_HTTP_HOOKS`, `NOTIFICATION_BACKOFF_TYPE` 모두 `codebase/backend/src/modules/external-interaction/**` · `common/config/**` 에서 문서와 동일 의미로만 쓰이며, 다른 모듈에서 다른 의미로 재사용된 사례 없음.

- **[정상 — 충돌 없음, 확인 완료]** Redis 키 네임스페이스
  - `eia:rl:interact:<executionId>` / `eia:rl:status:<executionId>` / `eia:notif:rl:<triggerId>` — `spec/conventions/redis-keys.md:60,67` 이 이미 인벤토리에 등록·SoT 로 target 문서를 가리키고 있으며, 다른 모듈이 `eia:` 접두를 다른 의미로 쓰는 사례 없음.

- **[정상 — 충돌 없음, 확인 완료]** Trigger 테이블 신규 컬럼
  - `notification_health` / `notification_last_error` / `notification_secret_v2` / `notification_rotated_at` — `spec/1-data-model.md:237-244` 에 이미 등재되어 있고, 유사 패턴인 `chat_channel_token_v2` 와의 명명 유사성("Semantic 비대칭 주의")까지 스스로 각주로 경고하고 있다. 신규 충돌 없음.

- **[정상 — 충돌 없음, 확인 완료]** endpoint / 파일 경로
  - `/api/external/executions/:id/*` 는 §12 에서 기존 `/api/executions/*` 와 prefix·인증 family 가 명시적으로 분리됨이 확인됨(§R11 참조). `spec/5-system/14-external-interaction-api.md` 파일명은 `5-system/` 넘버링 컨벤션(1~17, 14 미사용 상태였음)과 겹치지 않는다.

## 요약

이번 turn 에서 target 문서(`spec/5-system/14-external-interaction-api.md`)에 실제로 적용된 변경은 9줄의 서술 보강뿐이며 신규 식별자를 전혀 도입하지 않는다 — 언급된 에러코드(`WORKER_HEARTBEAT_TIMEOUT` 등)는 모두 기존 정의를 재인용한 것으로 확인했다. 문서 전문을 대상으로 확장 조사한 결과에서도 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·env var·Redis 키·DB 컬럼·파일 경로 어느 관점에서도 **기술적 충돌은 발견되지 않았다** — 유사해 보이는 항목(예: `rotate-secret`/`rotate-bot-token`, `notification_secret_v2`/`chat_channel_token_v2`)들은 이미 spec 자체가 혼동 위험을 인지하고 명시적으로 분리·각주 처리해 두었다. 유일하게 남는 것은 "Notification" 이라는 도메인 용어가 인앱 알림 시스템과 트리거 outbound webhook 시스템 두 곳에서 독립적으로 쓰인다는 INFO 성격의 관찰이며, 이는 이미 오래 정착된 기존 명명이라 이번 diff 의 책임 범위 밖이고 기술적 충돌도 없다(비차단).

## 위험도

NONE
