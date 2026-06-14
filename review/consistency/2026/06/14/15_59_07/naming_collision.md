# 신규 식별자 충돌 검토 — spec/5-system/14-external-interaction-api.md

## 발견사항

- **[WARNING]** `TOKEN_INVALID` / `TOKEN_EXPIRED` — 기존 워크스페이스 JWT 에러 코드와 동일 문자열 재사용
  - target 신규 식별자: `TOKEN_INVALID`, `TOKEN_EXPIRED` (§5.1 에러 표, EIA inbound 토큰 검증 실패)
  - 기존 사용처: `/spec/5-system/3-error-handling.md` §1.2 — 워크스페이스 Access Token 인증 레이어의 코드로 정의됨. `/spec/data-flow/2-auth.md` 여러 곳에서 동일 문자열이 워크스페이스 JWT refresh 흐름에 사용됨.
  - 상세: target §5.1 의 주석 "코드 네임스페이스 주석 (1)" 에서 "같은 문자열이나 진입점·토큰 family 로 레이어가 구분된다" 고 명시했다. 그러나 외부 클라이언트(SDK 등)가 `/api/external/*` 에서 `TOKEN_INVALID` 401 을 수신했을 때와 일반 API 에서 수신했을 때 동일 에러 코드가 다른 의미임을 문서·클라이언트 코드가 인지해야 한다. 레이어 구분은 코드 내부에서만 명확하고, 외부 API 표면에서는 동일 응답 shape 에 동일 코드가 출현해 혼동 가능성이 있다.
  - 제안: 현행 설계는 §5.1 주석과 R14 에서 의도적 결정으로 이미 명시되어 있다. 추가 완화책으로, API 문서(Swagger)에서 `/api/external/*` 엔드포인트의 `TOKEN_INVALID`/`TOKEN_EXPIRED` 가 interaction 토큰(`iext_*`/`itk_*`) 실패를 가리킴을 명시하는 것을 권장한다. 코드 자체의 변경은 불필요(의도적 설계).

- **[WARNING]** `NotificationDispatcher` — 기존 인-앱/이메일 알림 시스템의 동명 클래스와 같은 이름
  - target 신규 식별자: `NotificationDispatcher` (`notification-dispatcher.service.ts` — outbound webhook HTTP POST BullMQ facade, §10)
  - 기존 사용처: `/spec/2-navigation/4-integration.md` §11.2 — "활성화 시 `Notification.channel = 'both'`로 생성되어 `NotificationDispatcher`가 이메일 발송" 으로 기존 인-앱/이메일 알림 dispatch 클래스와 동명이 참조됨. `/spec/1-data-model.md` §2.19 에 `Notification` 엔티티(in-app/email 알림) 가 별도로 정의되어 있다.
  - 상세: EIA 의 `NotificationDispatcher` 는 외부 webhook HTTP POST 를 담당하고, 기존 `NotificationDispatcher` 는 인-앱/이메일 알림을 담당하는 서로 다른 관심사를 가진다. 두 클래스가 서로 다른 모듈 경로에 위치하더라도(EIA: `modules/external-interaction/notification-dispatcher.service.ts`) 동일 이름이 spec 과 코드에서 혼용되면 신규 개발자가 참조를 혼동할 수 있다.
  - 제안: EIA 측 클래스 이름을 `OutboundWebhookDispatcher` 또는 `ExternalNotificationDispatcher` 로 변경해 기존 인-앱 알림 `NotificationDispatcher` 와 명확히 구분할 것을 권장한다. 또는 `NotificationWebhookDispatcher` 로 도메인을 표현하는 것도 가능하다.

- **[INFO]** `EXECUTION_NOT_FOUND` — 기존 워크스페이스 JWT 레이어의 동명 에러 코드와 중복 정의
  - target 신규 식별자: `EXECUTION_NOT_FOUND` (§5.1 에러 표, `executionId` 미존재 시 404)
  - 기존 사용처: `/spec/3-workflow-editor/4-ai-assistant.md` §EXECUTION_NOT_FOUND — AI Assistant 탐색 도구에서 워크스페이스 JWT 인증 레이어의 execution 조회 실패에 동일 코드 사용. `/spec/4-nodes/1-logic/12-background.md` — Background 노드 상태 조회 404 에서 동일 코드.
  - 상세: EIA 레이어의 `EXECUTION_NOT_FOUND` 와 내부 워크스페이스 JWT 레이어의 `EXECUTION_NOT_FOUND` 는 동일 의미(execution 미존재)로 동일 코드를 사용하며, 이는 의미적으로 정합하다. EIA 표면에서는 scope/audience 불일치가 `TOKEN_SCOPE_MISMATCH` 로 먼저 처리되어 existence leak 없음을 §5.1 주석이 명시한다. 진입점 prefix(`/api/external/` vs `/api/`)로 레이어가 구분되므로 충돌은 아니지만, `RERUN_EXECUTION_NOT_FOUND` 처럼 prefix 를 붙이는 패턴과 일관성이 다소 어긋난다.
  - 제안: 현행 공유는 의미가 같아 허용 가능하다. 기존 워크스페이스 JWT 레이어에서 이미 동일 코드가 사용 중이므로 EIA 도 그대로 재사용하는 것이 API 일관성에 유리하다. 조치 불필요.

- **[INFO]** `RATE_LIMITED` — 기존 전역 에러 코드 재사용 (미구현 항목)
  - target 신규 식별자: `RATE_LIMITED` (§5.1 에러 표, inbound 명령 rate-limit 초과, 미구현 Planned)
  - 기존 사용처: `/spec/5-system/3-error-handling.md` §1.1 시스템 에러 카탈로그, `/spec/5-system/2-api-convention.md` §5 — 429 기본 코드값으로 전역 정의됨.
  - 상세: EIA 의 `RATE_LIMITED` 는 per-execution inbound rate-limit 전용(미구현)이고, 기존 정의는 전역 rate limit 에 대응한다. 의미적으로 동일 계열이며 기존 카탈로그 재사용으로 일관성을 유지한다. `TOO_MANY_CONNECTIONS`(SSE 동시 연결 초과)는 EIA 전용 신규 코드로 별도 도입되어 구분된다. 충돌 없음.
  - 제안: 조치 불필요.

- **[INFO]** `interactionAllowedOrigins` — target 이 새로 정의하는 것이 아니라 기존 data model 에서 이미 정의된 키
  - target 신규 식별자: `Workspace.settings.interactionAllowedOrigins` (§8.5 CORS 설정에서 참조)
  - 기존 사용처: `/spec/1-data-model.md` §2.2, `/spec/7-channel-web-chat/4-security.md` §2, `/spec/2-navigation/9-user-profile.md` §314/315 — 이미 정의·사용 중.
  - 상세: target 이 신규 도입한 식별자가 아니며 기존 정의를 cross-reference 하는 구조다. 충돌 없음.
  - 제안: 조치 불필요.

## 요약

`spec/5-system/14-external-interaction-api.md` 가 도입하는 식별자들은 대체로 기존 코퍼스와 충돌 없이 설계되어 있다. 주요 주의점은 두 가지다. 첫째, `TOKEN_INVALID`/`TOKEN_EXPIRED` 에러 코드를 워크스페이스 JWT 레이어와 동일 문자열로 재사용하는 것은 §R14 에서 의도적 결정이나 외부 API 표면에서 레이어 혼동 가능성이 있어 Swagger 문서에 명시적 보완을 권장한다. 둘째, `NotificationDispatcher` 클래스명이 기존 인-앱/이메일 알림 dispatch 클래스와 동명으로 사용되어 코드 네비게이션 시 혼동 위험이 있으며 이름 변경이 권장된다. 요구사항 ID(`EIA-NX-*`/`EIA-IN-*`/`EIA-AU-*`/`EIA-RL-*`/`EIA-NF-*`) prefix 는 기존 코퍼스에서 다른 의미로 사용되지 않으며, API endpoint prefix(`/api/external/executions/*`)도 기존 내부 `/api/executions/*` 와 완전히 분리되어 충돌이 없다. 토큰 prefix(`iext_*`/`itk_*`/`wsk_*`), 환경변수(`INTERACTION_JWT_SECRET`, `ALLOW_HTTP_HOOKS`), 신규 DB 엔티티(`execution_token`), Swagger scheme(`interaction-token`)도 기존 네임스페이스와 겹치지 않는다.

## 위험도

LOW
