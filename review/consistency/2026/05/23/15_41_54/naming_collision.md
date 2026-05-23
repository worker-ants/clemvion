# 신규 식별자 충돌 검토 — `spec/5-system/15-chat-channel.md`

검토 모드: `--impl-prep` (구현 착수 전)
검토 일시: 2026-05-23

---

## 발견사항

### 1. 요구사항 ID 충돌

- **[INFO]** CCH-* prefix는 코퍼스 내 다른 파일에서 독립 정의된 선례 없음
  - target 신규 식별자: `CCH-AD-01~06`, `CCH-CV-01~05`, `CCH-MP-01~05`, `CCH-SE-01~04-C`, `CCH-NF-01~03`
  - 기존 사용처: `spec/2-navigation/2-trigger-list.md`(line 44, 99, 101), `spec/4-nodes/7-trigger/providers/telegram.md`(§5 헤더들), `spec/5-system/12-webhook.md`(§7 처리흐름 안 참조)에서 cross-ref 형태로만 사용
  - 상세: 모두 `15-chat-channel.md` 를 원본 정의로 참조하는 cross-ref이며, 다른 의미로 독립 정의된 ID는 없음
  - 제안: 충돌 없음. 현행 유지

---

### 2. 엔티티 / 타입명 충돌

- **[INFO]** `ChatChannelTokenRotatorService` — 코드베이스에 미존재, spec 에서 CCH-SE-04-C 와 `spec/conventions/secret-store.md`(line 220)에서 참조됨
  - target 신규 식별자: `ChatChannelTokenRotatorService`
  - 기존 사용처: `codebase/backend/src/modules/triggers/notification-secret-rotator.service.ts`(class `NotificationSecretRotatorService`)가 유사 패턴의 기존 서비스
  - 상세: 명명 패턴 (`*RotatorService`) 은 기존과 동일하나 다른 자원(HMAC secret vs bot token)이므로 의미 충돌 없음. 코드베이스에는 `ChatChannelTokenRotatorService` 가 아직 미존재
  - 제안: 충돌 없음. 단, 두 서비스가 동일 BullMQ cron 인프라를 공유할 경우 모듈 등록 중복을 피하도록 구현 시 확인

- **[INFO]** `ChannelConversation` 타입 — `spec/4-nodes/7-trigger/0-common.md` 등 다른 spec 에서 동명 사용 없음
  - target 신규 식별자: `ChannelConversation` (Redis 레코드 타입, §4.3)
  - 기존 사용처: 없음
  - 상세: `ConversationThread` (`spec/conventions/conversation-thread.md`) 와 구분되는 별도 Redis 캐시 레코드로 명확히 분리되어 있음
  - 제안: 충돌 없음

---

### 3. API endpoint 충돌

- **[INFO]** `POST /api/triggers/:id/chat-channel/rotate-bot-token` — 기존 코드베이스에 이미 구현됨
  - target 신규 식별자: `POST /api/triggers/:id/chat-channel/rotate-bot-token`
  - 기존 사용처: `codebase/backend/src/modules/chat-channel/chat-channel.controller.ts`(line 38)에 `@Post(':id/chat-channel/rotate-bot-token')` 이미 구현
  - 상세: target spec 과 코드가 일치함. 충돌 아님 — spec 이 기존 구현을 공식화한 형태
  - 제안: 충돌 없음

- **[INFO]** EIA 기존 endpoint 와 중복 없음 확인
  - target 신규 식별자: `/api/triggers/:id/chat-channel/rotate-bot-token`
  - 기존 사용처: `POST /api/triggers/:id/notification/rotate-secret` (`spec/5-system/14-external-interaction-api.md` EIA-NX-12), `POST /api/triggers/:id/interaction/revoke-token` (EIA-AU-07)
  - 상세: 경로 구조가 다르므로 충돌 없음. Rationale R7 에서도 의도적 분리를 명시함

---

### 4. 이벤트 / 메시지명 충돌

- **[INFO]** `execution.waiting_for_input` / `execution.ai_message` / `execution.completed` / `execution.failed` / `execution.cancelled` — 기존 EIA / WebSocket spec 에서 동일 이름 사용
  - target 신규 식별자: 상기 5개 이벤트 이름 (§3 CCH-AD-05)
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md`(EIA-NX-02), `spec/5-system/6-websocket-protocol.md`(§4.1)
  - 상세: target spec 은 이들 이벤트를 새로 정의하는 것이 아니라 기존 EIA 이벤트를 `NotificationDispatcher EventEmitter` 를 통해 수신하는 consumer 로 동작. 동일 이름을 다른 의미로 정의하는 충돌이 아님
  - 제안: 충돌 없음

- **[INFO]** Redis key pattern `chat-channel:{triggerId}:{conversationKey}` — 기존 Redis key 패턴과 prefix 충돌 없음
  - target 신규 식별자: `chat-channel:{triggerId}:{conversationKey}`
  - 기존 사용처: 코드베이스 전반의 Redis key들 (`execution:*`, `notification:*`, `bull:*` 등)
  - 상세: `chat-channel:` prefix 가 기존 key namespace 와 겹치지 않음 (spec §4.3 에서도 "다른 모듈의 prefix 와 충돌 없음"으로 명시)
  - 제안: 충돌 없음

---

### 5. 환경변수 / 설정키 충돌

- **[INFO]** 신규 ENV var 없음 — `15-chat-channel.md` 가 직접 도입하는 환경변수·설정키 없음
  - target 신규 식별자: 없음 (기존 `ENCRYPTION_KEY` 재사용, `CHAT_CHANNEL_CONVERSATION_REDIS` inject token 은 내부 DI token)
  - 기존 사용처: `codebase/backend/src/modules/chat-channel/channel-conversation.service.ts`(line 33)에 `CHAT_CHANNEL_CONVERSATION_REDIS` DI token 이 이미 존재
  - 상세: 충돌 없음

---

### 6. 파일 경로 충돌

- **[INFO]** `spec/5-system/15-chat-channel.md` — 기존 파일 목록과 번호 충돌 없음
  - target 신규 식별자: `spec/5-system/15-chat-channel.md`
  - 기존 사용처: `spec/5-system/` 폴더에 `14-external-interaction-api.md` 까지 존재. 15번이 다음 번호
  - 상세: 명명 컨벤션 `N-name.md` 정합. 이미 실제 파일로 존재하며 다른 spec 에서 cross-ref 중
  - 제안: 충돌 없음

- **[INFO]** `spec/conventions/chat-channel-adapter.md` — 이미 존재하는 파일
  - target 신규 식별자: `spec/conventions/chat-channel-adapter.md` (§R6 에서 분리 근거 명시)
  - 기존 사용처: `spec/conventions/` 폴더 내 기존 거주자 (`node-output.md`, `conversation-thread.md`, `cafe24-api-metadata.md` 등)
  - 상세: 파일이 이미 존재하며 naming convention 과 일치. 충돌 없음

- **[INFO]** `spec/4-nodes/7-trigger/providers/telegram.md` — 이미 존재하는 파일
  - target 신규 식별자: `spec/4-nodes/7-trigger/providers/telegram.md` (R5 에서 위치 결정 명시)
  - 기존 사용처: 해당 경로에 파일 실존 확인 (`ls` 결과: `_overview.md` + `telegram.md`)
  - 제안: 충돌 없음

---

### 7. 에러 코드 — 코드베이스 실존 대비 spec 누락 (INFO)

- **[INFO]** `CHAT_CHANNEL_ENDPOINT_REQUIRED` 에러 코드가 코드베이스에만 존재하고 `15-chat-channel.md` §5.4 에러 표에는 미기재
  - target 신규 식별자: `§5.4` 에러 표에 `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED` 4종
  - 기존 사용처: `codebase/backend/src/modules/triggers/triggers.service.ts`(line 274, 503)에 `CHAT_CHANNEL_ENDPOINT_REQUIRED` 가 별도 추가 존재
  - 상세: `CHAT_CHANNEL_ENDPOINT_REQUIRED` 는 신규 에러 코드로 spec 에 미정의 상태. 반대 방향(spec → code) 충돌은 아니나, spec-code 동기화 누락
  - 제안: `15-chat-channel.md §5.4` 에러 표에 `CHAT_CHANNEL_ENDPOINT_REQUIRED` 에러 코드 행 추가 권장 (`400` / chatChannel 설정 시 endpointPath 미지정 케이스)

---

### 8. Rationale ID — `R-K` 의 파일 로컬 의미

- **[INFO]** `R-K` Rationale ID 가 `15-chat-channel.md` 로컬 식별자로 사용되나, 다른 spec 에서 같은 표기법 혼용 가능성
  - target 신규 식별자: `R-K` (§Rationale 절 마지막 항)
  - 기존 사용처: `spec/2-navigation/2-trigger-list.md` 의 Rationale 절은 `R-1` ~ `R-8` 순번 사용 (알파벳 없음). `spec/5-system/14-external-interaction-api.md` 는 `§R5`, `§R10`, `§R12` 형식 사용
  - 상세: spec 마다 Rationale ID 체계가 다르게 운영되며 (숫자 순번 / `R-N` / `R-CC-N`), `R-K` 는 `15-chat-channel.md` 내부에서만 참조됨. 다른 파일에서 충돌하는 `R-K` 정의 없음. 단, 같은 파일에 `R1~R9` + `R-CC-10~12` + `R-K` 세 가지 패턴이 혼재하고 있어 일관성이 낮음 (본 파일 Rationale ID 컨벤션 절에서도 "기존 R1~R9 / R-K 는 하위 호환 위해 그대로 유지" 라고 명시)
  - 제안: 신규 Rationale 항은 `R-CC-N` prefix 를 사용하는 것으로 이미 결정됨. `R-K` 는 레거시로 인정하되, 향후 참조 시 `R-K` 가 무엇의 축약인지 명시하는 주석 추가 권장 (현행 문서에 설명 부재)

---

## 요약

`spec/5-system/15-chat-channel.md` 가 도입하는 식별자군 (CCH-* 요구사항 ID, Chat Channel DB 컬럼 5종, `POST /api/triggers/:id/chat-channel/rotate-bot-token` endpoint, Redis key prefix `chat-channel:`, 서비스 타입 `ChatChannelTokenRotatorService`, 에러 코드 4종, Rationale ID R-K / R-CC-*)은 기존 코퍼스의 어떤 식별자와도 의미상 충돌을 일으키지 않는다. 유일한 실질적 보완 사항은 코드베이스에 이미 존재하는 `CHAT_CHANNEL_ENDPOINT_REQUIRED` 에러 코드가 spec §5.4 에러 표에 누락된 점 (INFO 수준)이며, 이는 spec-code 동기화 갭이지 명명 충돌이 아니다. 모든 식별자가 신규이거나 명시적 분리 근거(`R7`, `R-K`, `R-CC-10`)를 갖추고 있어 구현 착수를 차단할 CRITICAL / WARNING 수준의 충돌은 발견되지 않았다.

## 위험도

NONE
