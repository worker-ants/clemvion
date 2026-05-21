# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-draft-chat-channel.md`
검토 일시: 2026-05-21
검토 모드: spec draft (--spec)

---

## 발견사항

### 1. 요구사항 ID 충돌

- **[INFO]** CCH-* prefix — 기존에 사용되지 않음
  - target 신규 식별자: `CCH-AD-01` ~ `CCH-AD-06`, `CCH-CV-01` ~ `CCH-CV-05`, `CCH-MP-01` ~ `CCH-MP-05`, `CCH-SE-01` ~ `CCH-SE-04`, `CCH-NF-01` ~ `CCH-NF-03`
  - 기존 사용처: `spec/` 전체에서 `CCH-` prefix를 사용하는 ID가 존재하지 않음
  - 상세: 충돌 없음. 기존 prefix 체계(`WH-*`, `EIA-*`, `NAV-*`, `ND-*` 등)와 명확히 구별됨
  - 제안: 없음 (채택 가능)

- **[INFO]** `WH-MG-08`, `WH-MG-09` — 기존에 사용되지 않음
  - target 신규 식별자: `WH-MG-08` (chatChannel 옵션), `WH-MG-09` (chatChannelHealth 표시)
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/12-webhook.md` §3.4 관리 표의 마지막 ID는 `WH-MG-07` (줄 76)
  - 상세: `WH-MG-07`이 현재 최고 번호이고 target은 연속된 `08`, `09`를 추가한다. 충돌 없음
  - 제안: 없음 (채택 가능)

- **[INFO]** `EIA-AU-08` — 기존에 사용되지 않음
  - target 신규 식별자: `EIA-AU-08` (in-process trusted caller 예외)
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` §3.3 인증 표의 마지막 ID는 `EIA-AU-07` (줄 78)
  - 상세: `EIA-AU-07`이 현재 최고 번호이고 target은 연속된 `08`을 추가한다. 충돌 없음
  - 제안: 없음 (채택 가능)

---

### 2. 엔티티/타입명 충돌

- **[WARNING]** `InteractionRequestContext`에 `scope: 'in_process_trusted'` 필드 추가
  - target 신규 식별자: `scope: 'in_process_trusted'` 플래그를 `InteractionRequestContext`에 추가
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/modules/external-interaction/interaction.guard.ts` 줄 27~34에서 `InteractionRequestContext`가 `{ executionId, tokenFamily, triggerId? }` 3개 필드만 가짐. `scope` 필드 없음
  - 상세: target draft의 §3.5와 §7.2(EIA-AU-08)에서 "어댑터가 `InteractionRequestContext`를 직접 합성하되 `scope: 'in_process_trusted'` 플래그 동봉"이라고 명시한다. 기존 `InteractionRequestContext`에는 `scope` 필드가 존재하지 않는다. 구현 단계에서 이 인터페이스를 확장해야 하는데, spec draft 단계에서 이 확장이 기존 코드 SoT와의 정합에 대한 명시 없이 서술되어 있다. 또한 기존 Guard의 `tokenFamily: 'iext' | 'itk'`와 새 `scope` 필드의 역할이 부분적으로 겹친다 — 양쪽 모두 "어떤 경로의 요청인가"를 구분하는 목적이 있음.
  - 제안: spec draft에서 `InteractionRequestContext` 확장 방향을 명확히 기술할 것. 예: `tokenFamily` 를 `'iext' | 'itk' | 'in_process'`로 확장하는 방식과 별도 `scope` 필드를 추가하는 방식 중 하나를 선택해 spec SoT로 고정. 기존 코드의 `tokenFamily` 열거형이 단일 진실이므로 spec이 구현 방향을 선택한 후 개발자 위임 전 명시 필요.

- **[INFO]** `ChannelMessage` — 기존과 무관한 신규 타입
  - target 신규 식별자: `interface ChannelMessage` (어댑터 규약, chat-channel-adapter.md)
  - 기존 사용처: `codebase/backend/node_modules/@grpc/grpc-js/src/channelz.ts`에 `ChannelMessage` 임포트가 존재하나 이는 gRPC 내부 node_modules 내 타입이며 프로젝트 소스(`src/`)에는 동명 타입이 존재하지 않음
  - 상세: node_modules 내 타입이므로 실질적 충돌 없음. 프로젝트 소스 공간에서는 신규 도입
  - 제안: 없음 (채택 가능)

- **[INFO]** `ChannelUpdate`, `ChannelButton`, `ChannelAdapterRegistry`, `SetupResult`, `SendResult`, `KeyboardHint`, `ChatChannelAdapter`, `ChatChannelConfig`, `EiaEvent` — 모두 신규
  - target 신규 식별자: 위 열거된 TypeScript 인터페이스/타입 전체
  - 기존 사용처: `codebase/backend/src/` 전체 검색 결과 동명 심볼 없음
  - 상세: 충돌 없음
  - 제안: 없음

---

### 3. API endpoint 충돌

- **[INFO]** `POST /api/triggers/:id/chat-channel/rotate-bot-token` — 기존에 없음
  - target 신규 식별자: `POST /api/triggers/:id/chat-channel/rotate-bot-token`
  - 기존 사용처: 관련 패턴인 `POST /api/triggers/:id/notification/rotate-secret`과 `POST /api/triggers/:id/interaction/revoke-token`이 `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` 줄 48, 78에 정의되어 있음
  - 상세: 경로 세그먼트가 각각 `notification/`, `interaction/`, `chat-channel/`로 구분되어 겹치지 않음. 충돌 없음. target의 Rationale(CCH-SE-04)에서 `rotate-secret`과 의미가 다른 자원임을 URL로 명시하는 이유도 합리적으로 서술되어 있음
  - 제안: 없음 (채택 가능)

---

### 4. 이벤트/메시지명 충돌

- **[INFO]** `execution.waiting_for_input` / `execution.ai_message` / `execution.completed` / `execution.failed` / `execution.cancelled` — 기존 이벤트 재사용
  - target 신규 식별자: `EiaEvent` union의 5개 `type` 문자열
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` §3.1 EIA-NX-02 (줄 38), §6 전체에서 동일 이름으로 이미 정의된 EIA outbound 이벤트 종류
  - 상세: target draft가 의도적으로 EIA spec의 기존 이벤트 이름을 재사용 — "별도 신규 타입을 정의하지 않고 EIA spec의 payload shape을 재사용 (I11 해소)"라고 명시하고 있어 충돌이 아닌 정렬된 재사용임. 상충 없음.
  - 제안: 없음

- **[INFO]** Redis 키 패턴 `chat-channel:{triggerId}:{conversationKey}` — 기존 패턴과 구별됨
  - target 신규 식별자: Redis key prefix `chat-channel:`
  - 기존 사용처: `codebase/backend/src/`에서 확인된 기존 Redis key prefix: `iext:blacklist:` (줄 43, interaction-token.service.ts), `interaction:idempotency:` (줄 19, idempotency.interceptor.ts), `exec:recover:lock` (continuation-bus.service.ts)
  - 상세: `chat-channel:` prefix는 기존 어떤 prefix와도 겹치지 않음. 콜론 구분자 + 계층형 패턴도 기존 스타일과 일치
  - 제안: 없음 (채택 가능)

---

### 5. 환경변수·설정키 충돌

- **[INFO]** 신규 ENV var — target에서 구체적 ENV var 이름을 도입하지 않음
  - target 신규 식별자: `botTokenRef`는 `secret://triggers/:id/bot-token` 형식의 secret store reference. 구체적 환경변수 이름은 도입 안 함 (v1은 reference 형식만)
  - 기존 사용처: 해당 없음
  - 상세: 충돌 없음. 구체적 secret store 구현은 follow-up으로 위임되어 ENV var 이름 충돌 위험이 v1 단계에서는 발생하지 않음
  - 제안: 없음

- **[INFO]** `config.chatChannel` 서브 필드 — 기존 config 키와 구별됨
  - target 신규 식별자: Trigger `config` JSONB의 `chatChannel` 최상위 서브 키
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/12-webhook.md` §2.2 및 `/Volumes/project/private/clemvion/codebase/backend/src/modules/external-interaction/notification-webhook.processor.ts`에서 `config.notification`, `config.interaction` 키 사용 확인
  - 상세: `chatChannel`은 기존 `notification`, `interaction`과 구별되는 신규 서브 키. 충돌 없음
  - 제안: 없음

---

### 6. 파일 경로 충돌

- **[INFO]** `spec/5-system/15-chat-channel.md` — 신설, 기존 없음
  - target 신규 식별자: 파일명 `15-chat-channel.md`
  - 기존 사용처: `spec/5-system/` 디렉토리에 현재 숫자 prefix가 1~14까지 존재 (`1-auth.md`부터 `14-external-interaction-api.md`까지). `15-` prefix 파일 없음
  - 상세: 충돌 없음. 번호 순서가 자연스럽게 이어짐
  - 제안: 없음

- **[INFO]** `spec/conventions/chat-channel-adapter.md` — 신설, 기존 없음
  - target 신규 식별자: 파일명 `chat-channel-adapter.md`
  - 기존 사용처: `spec/conventions/`에 현재 `cafe24-api-metadata.md`, `cafe24-restricted-scopes.md`, `conversation-thread.md`, `i18n-userguide.md`, `migrations.md`, `node-output.md`, `swagger.md` 존재
  - 상세: 충돌 없음. 명명 컨벤션(`kebab-case-topic.md`)과 일치
  - 제안: 없음

- **[INFO]** `spec/4-nodes/7-trigger/providers/telegram.md` — 신설 서브디렉토리
  - target 신규 식별자: 서브디렉토리 `providers/` + 파일 `telegram.md`
  - 기존 사용처: `spec/4-nodes/7-trigger/` 에 현재 `0-common.md`, `1-manual-trigger.md` 2개 파일만 존재. `providers/` 서브디렉토리 없음
  - 상세: 충돌 없음. target draft의 Rationale R-G에서 위치 선택 근거를 상세히 설명하고 있음
  - 제안: 없음

- **[INFO]** `spec/1-data-model.md` §2.8 신규 컬럼 명명
  - target 신규 식별자: DB 컬럼 `chat_channel_health`, `chat_channel_last_error`, `chat_channel_setup_at`, `chat_channel_token_v2`, `chat_channel_rotated_at`
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/1-data-model.md` 줄 208~211에서 `notification_health`, `notification_last_error`, `notification_secret_v2`, `notification_rotated_at` 존재
  - 상세: 접두사가 `notification_` vs `chat_channel_`로 명확히 구별되어 충돌 없음. target draft에서 `notification_*` 컬럼과 동일 패턴을 의도적으로 채택했음을 명시(§2.6). 단, `chat_channel_token_v2`와 `notification_secret_v2`는 저장 내용의 의미가 다름 — 전자는 bot token reference, 후자는 HMAC signing secret. 컬럼명의 `_v2` suffix만 보면 "두 번째 버전 토큰" 의미로 혼동 가능하나 이는 기존 코드의 `notification_secret_v2`도 rotation grace 목적이었고 신규도 동일 패턴이므로 일관성 관점에서 허용 가능한 수준
  - 제안: 없음 (INFO 수준)

---

## 요약

target draft(`spec-draft-chat-channel.md`)가 도입하는 식별자들은 기존 spec·codebase와 실질적 충돌이 없다. 요구사항 ID(`CCH-*`, `WH-MG-08/09`, `EIA-AU-08`)는 모두 기존에 없던 신규 번호로 연속 배정되어 있으며, 신규 TypeScript 인터페이스·타입 이름(`ChannelUpdate`, `ChannelMessage` 등)도 프로젝트 소스 공간에서 미사용 상태다. API endpoint 패턴과 Redis 키 prefix도 기존 명명과 겹치지 않는다. 단 하나의 주의 사항은 `InteractionRequestContext` 인터페이스에 `scope: 'in_process_trusted'` 필드를 추가하는 의도가 spec draft에 서술되어 있으나, 기존 코드 SoT(`interaction.guard.ts`)의 인터페이스 정의에는 해당 필드가 없고 기존 `tokenFamily` 필드와 역할이 부분적으로 겹친다는 점이다. 이는 구현 시 인터페이스 확장 방향 결정이 필요한 경계 사항으로, spec draft 단계에서 선택 방향을 명시해 개발자에게 모호성 없이 위임하는 것을 권장한다.

## 위험도

LOW
