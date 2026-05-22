# Documentation Review — chat-channel-secret-store-pgcrypto

## 발견사항

---

### 1. 독스트링 / JSDoc

- **[WARNING]** `TelegramAdapter.resolveBotToken()` private 메서드의 JSDoc이 불완전하다.
  - 위치: `/codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts` line 36~50 (diff 내 `+  /**` 블록)
  - 상세: 현재 주석은 `botTokenRef 가 secret store ref 면 resolve. 신규 trigger 는 ref 만 가지므로 항상 resolve.` 라고 적혀 있는데, 이는 정확하지 않다. `botTokenRef` 는 이 변경 이후 항상 secret store ref 형식이어야 하므로 "ref 면" 조건 분기 설명이 오해를 유발한다. 또한 이 메서드가 resolve 실패 시 throw 한다는 사실 (teardownChannel 에서는 호출자가 직접 try/catch 로 best-effort 처리함)이 명시되지 않았다.
  - 제안: `@throws` 태그 추가 + "항상 secret store ref 형식이어야 하므로 resolve() 를 직접 위임" 으로 설명 단순화.

- **[INFO]** `SecretResolverService.deleteByPrefix()` 메서드가 `SecretResolver` interface 스펙 (`spec/conventions/secret-store.md §2`) 에 정의되어 있지 않음에도 구현체에 public API 로 존재한다.
  - 위치: `/codebase/backend/src/modules/secret-store/secret-resolver.service.ts` line 139~151
  - 상세: `spec/conventions/secret-store.md` 의 `SecretResolver` interface 정의에는 `resolve / store / rotate / delete / exists` 5개만 명시되어 있고 `deleteByPrefix` 는 없다. 구현체에만 메서드가 있어 spec-impl 간 gap 이 생겼다. 사용처는 `TriggersService.remove()` 에서 trigger 단위 일괄 삭제에 활용되므로 기능적으로 필요하다.
  - 제안: `spec/conventions/secret-store.md §2` interface 정의에 `deleteByPrefix(prefix: string): Promise<number>` 항목 추가 + 호출 규약 표에 "Trigger 삭제 시" 행도 갱신. 또는 명시적으로 "구현체 전용 편의 메서드" 임을 JSDoc 에 기재.

---

### 2. README / 사용자 가이드

- **[INFO]** 기존 `telegram.en.mdx` / `telegram.mdx` 사용자 가이드의 v1 plaintext 경고 문구가 이번 변경에서 올바르게 제거되고 AES-256-GCM 암호화 보관 내용으로 교체됐다. 두 파일이 영문/한국어 버전 모두 동기화되어 있다.
  - 위치: 파일 23, 24 (파일 목록 기준)
  - 평가: 양호.

---

### 3. API 문서 (Swagger / ApiProperty)

- **[WARNING]** `ChatChannelConfigDto.botToken` 필드의 `@ApiProperty` description 이 "서버가 즉시 secret store 에 암호화 보관하고 config 에는 ref 만 저장" 이라고 적혀 있지만, 삭제된 `botTokenRef` / `secretToken` DTO 필드에 대한 Swagger description 이 삭제되었을 때 해당 ref 를 읽는 응답 DTO 쪽 문서가 어떻게 처리되는지 확인이 필요하다. 구체적으로 trigger 조회 응답에서 `chatChannel.botTokenRef` / `chatChannel.secretTokenRef` 가 노출되는 경우 별도 응답 DTO 가 있다면 그 쪽에 ApiProperty 가 있는지 미확인.
  - 위치: `/codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (파일 17)
  - 상세: diff 에서 입력 DTO (botToken) 쪽 설명은 갱신됐으나, 응답에서 `botTokenRef` / `secretTokenRef` 를 서빙하는 별도 응답 DTO 또는 ChatChannelConfigDto 자체의 출력 필드 설명이 추가되지 않았다. ref 문자열이 API 응답에 노출된다면 Swagger 문서에 해당 필드 설명이 없는 상태.
  - 제안: `botTokenRef` / `secretTokenRef` 에 `@ApiPropertyOptional` + description 추가 (응답 전용 필드임을 명시). 또는 입력/응답 DTO 를 분리해 명확화.

---

### 4. 주석 정확성 (오래된 주석)

- **[WARNING]** `Trigger` 엔티티의 `chatChannelTokenV2` 컬럼 JSDoc 이 여전히 "v1 은 plaintext stub" 을 언급하고 있다.
  - 위치: `/codebase/backend/src/modules/triggers/entities/trigger.entity.ts` line 137~143
  - 상세: 현재 주석: `v1 은 plaintext stub (config.chatChannel.botToken 와 동일 보관 정책).` — 이번 변경의 핵심 내용이 컬럼 의미를 "plaintext → secret store ref" 로 전환하는 것인데, 엔티티 JSDoc 은 아직 이 전환을 반영하지 않았다. 코드 자체는 올바르게 ref 를 저장하고 있으나 주석이 구현과 불일치.
  - 제안: 주석을 `secret store ref 보관 — rotation grace (24h) 기간 동안의 신규 bot token ref (secret://triggers/{id}/bot-token.v2). NULL 이면 rotation 진행 중이 아님.` 으로 갱신.

- **[WARNING]** `TriggersService.rotateNotificationSecret()` JSDoc 의 step 3 설명이 오래된 내용을 포함한다.
  - 위치: `/codebase/backend/src/modules/triggers/triggers.service.ts` line 329~332
  - 상세: 현재 주석 step 3: `24h 경과 후 별도 cron 이 v2 → config.signing.secret 으로 승격` — 이번 변경 후 승격은 `config.signing.secretRef` (ref 형식) 로 이루어지는데 주석은 여전히 `config.signing.secret` (plaintext 형식) 을 언급. step 2 의 `trigger.notification_secret_v2 컬럼에 새 secret 저장` 도 실제로는 "ref 저장" 이 되어야 정확.
  - 제안: step 2/3 설명을 `notification_secret_v2 컬럼에 v2 ref 저장 + secret store 에 암호화 보관` / `cron 이 v2 ref 의 plaintext 를 primary secretRef 로 rotate 승격 + v2 ref/row 정리` 로 갱신.

- **[WARNING]** `TriggersService.promoteRotatedNotificationSecrets()` JSDoc 이 오래된 필드명을 참조한다.
  - 위치: `/codebase/backend/src/modules/triggers/triggers.service.ts` line 410
  - 상세: `notification_secret_v2 → config.notification.signing.secret 승격` — 실제 구현은 `secretRef` 로 승격하고 `secret` 필드를 삭제한다. 주석이 구현과 불일치.
  - 제안: `notification_secret_v2 ref 의 plaintext → primary secretRef 로 rotate 승격 + v2 row 정리` 로 갱신.

- **[WARNING]** `NotificationSecretRotatorService` 클래스 JSDoc 이 오래된 필드명을 참조한다.
  - 위치: `/codebase/backend/src/modules/triggers/notification-secret-rotator.service.ts` line 8
  - 상세: `notification_secret_v2 를 primary config.notification.signing.secret 으로 승격` — 이번 변경 이후 승격 대상은 `signing.secretRef` 이다.
  - 제안: `signing.secret → signing.secretRef` 로 수정.

---

### 5. 인라인 주석

- **[INFO]** `notification-webhook.processor.ts` 의 레거시 plaintext fallback 경로 주석은 충분히 명확하다. `// 레거시 호환 — config.signing.secret 평문은 아직 read-path 지원 (chat-channel-secret-store-pgcrypto plan: 신규 trigger 부터 secretRef 만 보관, backfill 불요). 후속 PR 에서 제거.` — 의도와 후속 계획이 잘 기술되어 있다.

- **[INFO]** `telegram.adapter.ts` 의 `setupChannel` 반환값 주석 (`// secretToken plaintext 는 호출자... 어댑터는 plaintext 만 반환 — setupChannel 은 멱등성(plain) 유지를 위해 SecretResolver 호출을 caller 에 위임.`)이 설계 결정의 배경을 충분히 담고 있다.

- **[INFO]** V063 마이그레이션 SQL 파일의 주석이 설계 결정, 저장 형식, 호환성을 체계적으로 문서화하고 있다. 이는 모범적인 마이그레이션 문서화다.

---

### 6. 변경 이력 (CHANGELOG)

- **[INFO]** `spec/conventions/chat-channel-adapter.md` 의 Changelog 섹션에 이번 변경 (`botToken`/`secretToken` 제거, `botTokenRef`/`secretTokenRef` 단일화) 이 `2026-05-22` 날짜로 올바르게 추가되어 있다.

- **[INFO]** `spec/conventions/secret-store.md` 의 Changelog 에 v1 초기 도입 내용이 기록되어 있다.

---

### 7. 설정 문서 (환경변수)

- **[INFO]** `plan/in-progress/chat-channel-secret-store-infra.md` 에서 "`.env.example` 항목 갱신 불요 (이미 등록)" 을 명시하고 있으며, 실제로 `ENCRYPTION_KEY` 는 `.env.example` line 107 에 이미 존재한다. 설정 문서는 별도 추가 불필요.

- **[INFO]** `spec/conventions/secret-store.md §3.3` 에 `ENCRYPTION_KEY` 의 형식, 생성법, 재사용 근거, 자체 호스팅 환경에서의 보관 지침이 상세히 기술되어 있다. 운영자 관점의 설정 문서로서 충분하다.

---

### 8. 예제 코드

- **[INFO]** `spec/conventions/secret-store.md §5` 에 Trigger 생성, 외부 API 호출, Rotation 시나리오별 예제 코드가 포함되어 있다. 실사용 패턴을 잘 커버한다.

- **[WARNING]** `spec/conventions/secret-store.md §5.1` 의 Trigger 생성 예제 코드에 `delete (trigger.config.chatChannel as any).botToken;` 라는 라인이 있는데, 이번 변경으로 DTO 에 `botToken` → `ChatChannelConfig.botTokenRef` 로 전환됐으므로 예제의 맥락이 불명확해졌다. `botToken` 은 DTO 입력 필드이고 내부 config 에는 `botTokenRef` 만 존재하는 구조인데, 예제는 둘 다 있는 것처럼 보일 수 있다.
  - 위치: `/spec/conventions/secret-store.md` line 164~170
  - 제안: 예제에서 `delete` 라인을 제거하거나, `internalCfg = { provider, botTokenRef: ref, ... }` 처럼 처음부터 ref 만 가진 내부 config 객체를 구성하는 방식으로 재작성. 이렇게 하면 실제 `TriggersService.setupChatChannel()` 구현과 일치.

---

## 요약

이번 변경은 chat channel 의 bot token / webhook secret 과 notification HMAC signing secret 를 config JSONB 평문에서 application-side AES-256-GCM 기반 secret store 로 이전하는 대규모 리팩터링이다. 핵심 신규 파일(`SecretResolverService`, `SecretStore` entity, 마이그레이션 SQL, `secret-ref`, `secret-crypto`)은 독스트링과 인라인 주석이 충실하며, spec 문서(`secret-store.md`, `chat-channel-adapter.md`, `data-model.md`, `external-interaction-api.md`) 와 사용자 가이드(`telegram.mdx`) 도 함께 갱신됐다. 그러나 변경이 넓은 범위에 걸쳐 있어 일부 기존 파일의 JSDoc이 구현 변경을 따라가지 못했다: `Trigger` 엔티티의 `chatChannelTokenV2` 컬럼 주석이 여전히 "v1 plaintext stub" 을 언급하고, `rotateNotificationSecret`·`promoteRotatedNotificationSecrets`·`NotificationSecretRotatorService` 의 JSDoc 이 `config.signing.secret` (plaintext 시대의 필드명) 을 참조하는 오래된 설명을 담고 있다. 또한 `deleteByPrefix` 가 구현체에만 존재하고 `SecretResolver` interface 스펙에 미등재된 gap 이 있으며, `spec/conventions/secret-store.md §5.1` 의 예제 코드가 실제 구현 흐름과 미세하게 불일치한다. 이 항목들은 기능 정확성에 영향을 주지 않지만 유지보수 혼선을 야기할 수 있다.

## 위험도

LOW
