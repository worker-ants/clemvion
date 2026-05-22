# 요구사항(Requirement) 리뷰 — chat-channel-secret-store-pgcrypto

분석 기준 spec: `spec/conventions/secret-store.md`, `spec/5-system/15-chat-channel.md`, `spec/5-system/14-external-interaction-api.md`, `spec/1-data-model.md §2.21.1`

---

## 발견사항

### [WARNING] Trigger 생성 시 `store` 대신 `rotate` 사용 — spec §2.1 호출 규약 위반 의심

- **위치**: `codebase/backend/src/modules/triggers/triggers.service.ts` `setupChatChannel()` L228, `setupChannel 이후 secretTokenRef rotate` L254
- **상세**: `spec/conventions/secret-store.md §2.1` 호출 규약 표에 "Trigger 생성 (신규 chatChannel 설정 포함) → `store(ref, workspaceId, plaintext)` 사용" 이 명시되어 있다. 그러나 `setupChatChannel()` (신규 생성 경로) 에서도 `this.secrets.rotate(botTokenRef, ...)` 와 `this.secrets.rotate(secretTokenRef, ...)` 를 사용한다. `store` 는 non-idempotent (중복 ref 는 throw), `rotate` 는 UPSERT idempotent — 신규 생성 시 `store` 를 기대한 코드가 `rotate` 를 사용하면, 같은 triggerId 로 `setupChannel` 이 두 번 호출되는 경우 (재시도, 혹은 플래그 없이 업데이트) 기존 비밀값이 조용히 덮어쓰여질 수 있다. spec 이 신규 생성에 `store` 를 규정한 이유 (중복 감지) 와 어긋난다.
- **제안**: 신규 trigger 의 `setupChatChannel` 에서 `store` 를 사용하고, 이미 존재하는 경우에만 `rotate` 를 사용하도록 분기. 또는 spec §2.1 주석에 멱등성 허용 예외를 명시하도록 `project-planner` 에 위임.

---

### [WARNING] `rotateNotificationSecret` — spec §5.3 rotation 흐름과 구현 불일치

- **위치**: `codebase/backend/src/modules/triggers/triggers.service.ts` L357–370
- **상세**: `spec/conventions/secret-store.md §5.3` 의 rotation 예시는 `v2` ref 에 신규 token 을 `rotate` 로 저장하고 "24h 후 cron 이 v2 → primary 승격" 을 명시한다. 그런데 `promoteRotatedNotificationSecrets` 에서 승격 완료 후 primary ref(`notification-signing`) 로의 `rotate` 는 정상 구현되어 있으나, **최초 notification 생성 시** `config.notification.signing.secret` 평문을 primary ref(`secret://triggers/{id}/notification-signing`) 에 저장하는 경로가 diff 에 보이지 않는다. `notification-webhook.processor.ts` 는 `secretRef` 가 있으면 resolve, 없으면 legacy plaintext 를 fallback 사용하는데, 이는 기존 trigger 의 `signing.secret` 평문이 계속 HMAC 서명에 쓰인다는 의미이다. plan §Phase 2 에 "신규 trigger 생성부터 secretRef 로 보관" 이 적혀 있으나, `TriggersService.create` 또는 update 경로에서 `notification.signing.secret` → `secrets.store(ref, ...)` 로 저장하고 config 에는 `secretRef` 만 남기는 코드가 이번 diff 에 없다. `promoteRotatedNotificationSecrets` 의 승격 후 `secretRef` 반영은 있으나, 최초 저장 경로가 누락되면 신규 trigger 의 `secretRef` 가 항상 공란이 된다.
- **제안**: `TriggersService.create` / `update` 에서 `notification.signing.secret` 입력 시 `secrets.store(ref, workspaceId, plaintext)` 호출 후 config 에 `secretRef` 만 남기는 코드를 추가하거나, plan 에 명시된 Phase 2 완료 여부를 확인할 것.

---

### [WARNING] `chat_channel_token_v2` 컬럼 — rotation grace 시 old token v2 ref 저장은 되나, v2 → primary 승격 cron 이 없음

- **위치**: `codebase/backend/src/modules/chat-channel/chat-channel.controller.ts` L235–289 (rotate-bot-token 핸들러)
- **상세**: `spec/5-system/15-chat-channel.md §5.4` 및 spec §4.2 `chat_channel_token_v2` 컬럼은 "24h grace 동안 병행 수신" 을 지원하기 위한 것이다. `chat-channel.controller.ts` 는 old token 을 `bot-token.v2` ref 에 `rotate` 로 저장하고 `chatChannelTokenV2 = v2Ref` 로 컬럼에 기록한다. 그런데 `notification_secret_v2` 의 경우 `NotificationSecretRotatorService` (cron job) 가 `promoteRotatedNotificationSecrets` 를 호출해 승격하는데, `chat_channel_token_v2` 의 v2 → primary 승격 cron 이 diff 에 없다. 이 상태에서 24h 후에도 `bot-token.v2` ref 가 계속 남아 있고, `chatChannelTokenV2` 컬럼이 null 로 정리되지 않는다. `bot-token.v2` 의 secret_store row 도 삭제되지 않는다. — 실제로 "grace 기간 내 old token 병행 수신" 이 dispatcher 나 hooks.service 어디에서도 구현되지 않아, v2 ref 저장이 dead code 에 가깝다.
- **제안**: `bot-token.v2` 승격/만료 cron 을 추가하거나, spec §CCH-SE-04 의 "24h grace 동안 병행 받음" 구현 여부를 명확히 할 것. 현재 rotate-bot-token 핸들러는 old token 을 v2 ref 에 보관하지만 이를 실제로 사용하는 경로가 없다.

---

### [INFO] `setupChatChannel` 실패 시 botTokenRef 가 config 에 저장되나 secret_store row 는 남음

- **위치**: `codebase/backend/src/modules/triggers/triggers.service.ts` L274–294 (catch 블록)
- **상세**: `adapter.setupChannel(internalCfg, callbackUrl)` 이 실패하면 catch 블록이 `fallbackConfig` (botTokenRef 포함) 를 config 에 저장하고 `chatChannelHealth = 'degraded'` 로 마킹한다. 이 경우 `secret_store` 에 `bot-token` ref 의 row 는 이미 `rotate` 로 삽입된 상태이다. `setupChannel` 이 실패해도 secret_store row 는 남아 있어 trigger 삭제 전까지 DB 에 살아 있다. spec §6 의 "trigger 삭제 시 application-level cascade" 원칙상 결국 `remove()` 때 정리되므로 critical 은 아니지만, degraded 상태의 trigger 가 재시도될 때 `rotate` (UPSERT) 가 기존 row 를 덮어쓰는 동작에 대한 명시적 의도 확인이 필요하다.
- **제안**: spec 이 이 경우를 회색지대로 남기고 있으면 INFO 유지. 명시적 cleanup 이 필요하다면 `setupChannel` 실패 시 botTokenRef secret_store row 도 제거하거나 rollback 처리하도록 spec 에 기록.

---

### [INFO] `notification-webhook.processor.ts` — legacy plaintext fallback 의 영구 잔류 위험

- **위치**: `codebase/backend/src/modules/external-interaction/notification-webhook.processor.ts` L1196–1203 (`resolveSigningSecret`)
- **상세**: `resolveSigningSecret` 의 세 번째 분기는 `refOrLegacy` 가 secret store ref 형식이 아닌 일반 문자열이면 그대로 반환한다. 이 fallback 은 plan §Phase 2 의 "backfill 불요, 신규 trigger 부터 secretRef 만 보관" 정책에 의거한 의도적 레거시 지원이다. 하지만 fallback 코드가 삭제되는 시점 또는 조건이 코드에 명시되지 않았고, plan 의 "후속 PR 에서 제거" 라는 주석도 코드에서는 찾기 어렵다.
- **제안**: `// TODO: legacy plaintext 경로 — chat-channel-secret-store-pgcrypto 이후 별 plan 에서 제거` 형태의 주석을 추가해 drift 추적.

---

### [INFO] `SecretResolverService.onModuleInit` — `parseMasterKey` throw 가 모듈 초기화를 차단하지 않을 수 있음

- **위치**: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` L35–44
- **상세**: `spec §SS-SE-04` 는 "마스터키 미설정 / 길이 불일치 시 부팅 fail-fast" 를 필수 요구사항으로 정의한다. `parseMasterKey` 는 빈 문자열 입력 시 throw 하므로 `onModuleInit` 에서 예외가 발생한다. NestJS 의 `onModuleInit` 에서 throw 하면 앱 부팅이 차단되어 spec 의 fail-fast 의도는 충족된다. 그러나 `this.masterKey = parseMasterKey(raw)` 에서 throw 될 경우 `this.masterKey` 는 초기값 `null` 로 남는다. 이후 `getKey()` 에서 두 번째 방어 로직(`null` 체크)이 있으므로 실제 문제는 없으나, fail-fast 이후에도 서비스가 어떤 경로로든 `resolve()` 를 호출하면 "onModuleInit 가 fail 했습니다" 에러가 발생한다. spec 의 의도 (부팅 차단) 와는 동일 결과이므로 severity INFO.
- **제안**: 현행 구현은 spec §SS-SE-04 의 fail-fast 의도를 충족. 추가 조치 불요.

---

### [INFO] `spec/1-data-model.md §2.21.1` — "pgcrypto 백엔드" 표현 잔류

- **위치**: `spec/1-data-model.md` diff L2554
- **상세**: 변경된 §2.21.1 설명에 "pgcrypto 백엔드" 라는 표현이 남아 있다(`spec/conventions/secret-store.md` 의 단일 진실 … pgcrypto 백엔드). plan §결정 에서는 pgcrypto 를 명시적으로 기각하고 backend AES-256-GCM 을 채택했으며, `spec/conventions/secret-store.md §3.1` 제목도 "PostgreSQL + 백엔드 AES-256-GCM" 이다. spec 1-data-model 의 "pgcrypto" 문구는 stale 표현.
- **제안**: spec 문서 수정은 `project-planner` 위임. `"pgcrypto 백엔드"` 를 `"backend AES-256-GCM 백엔드"` 로 정정.

---

### [INFO] `ChatChannelConfigDto.botToken` — 입력은 유지하나 DTO 에서 `botTokenRef` / `secretTokenRef` 응답 마스킹 명시 없음

- **위치**: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
- **상세**: DTO 수정 diff 에서 `botToken` 필드는 입력 전용으로 유지되었고 주석에 "응답·조회 시에는 마스킹" 이 기술되어 있다. 그러나 실제 응답 시 `botToken` 필드를 제거하거나 마스킹하는 serialization 로직 (Interceptor / Class-transformer `@Exclude`) 이 diff 에 없다. spec CCH-SE-03 은 "config JSONB 에는 ref 만 보관" 을 요구하므로 DB 에는 ref 만 들어가지만, REST 응답에서 DTO 가 그대로 직렬화되면 `botToken` 필드가 응답에 포함될 수 있다.
- **제안**: 기존 응답 직렬화 로직을 확인하여 `botToken` 이 조회 응답에 포함되지 않도록 처리. spec 에 응답 마스킹 명세가 없으면 `project-planner` 에 spec 보완 위임.

---

## 요약

본 변경은 `spec/conventions/secret-store.md` 에서 정의한 `SecretResolver` interface, AES-256-GCM 암호화 백엔드, `secret://` URI scheme, 그리고 `spec/5-system/15-chat-channel.md §3.4 CCH-SE-03` 의 bot token / webhook secret store 통합 요구사항을 전반적으로 충실히 구현하고 있다. `SecretResolverService`, `secret-crypto`, `secret-ref`, `SecretStore` entity, Flyway migration, 모듈 연결, 어댑터 및 서비스 전반의 plaintext → ref 전환이 일관되게 이루어졌다. 다만 두 가지 WARNING 이 존재한다: (1) 신규 trigger 생성 시 `store` 대신 `rotate` 사용으로 인한 spec §2.1 호출 규약 불일치, (2) notification.signing.secret 의 최초 저장 → secretRef 변환 경로 누락으로 Phase 2 완료 여부가 불분명하다. `chat_channel_token_v2` 의 v2 → primary 승격 cron 부재도 관련 기능의 완전성 측면에서 WARNING 수준으로 체크가 필요하다.

---

## 위험도

MEDIUM
