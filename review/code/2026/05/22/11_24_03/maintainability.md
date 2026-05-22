# 유지보수성(Maintainability) 리뷰

## 발견사항

### 핵심 모듈 (secret-store/)

- **[INFO]** `secret-crypto.ts` 상수 네이밍 명확
  - 위치: `/codebase/backend/src/modules/secret-store/secret-crypto.ts`
  - 상세: `ALGORITHM`, `IV_LENGTH`, `TAG_LENGTH`, `KEY_LENGTH` 상수가 파일 상단에 명시적으로 선언되어 있어 매직 넘버가 없고, 의도가 명확하다.
  - 제안: 유지.

- **[INFO]** `parseMasterKey` SHA-256 fallback 경로의 문서화 충분
  - 위치: `secret-crypto.ts:971-975`
  - 상세: 64-char hex 외 임의 문자열에 대해 SHA-256 derive 경로를 택하는 이유를 주석과 spec 주석으로 설명하고 있어 미래 기여자가 의도를 파악하기 쉽다.
  - 제안: 유지.

- **[INFO]** `SecretResolverService.rotate` — UPSERT 패턴 간결
  - 위치: `secret-resolver.service.ts:102-118`
  - 상세: `store` vs `rotate` 의미 분리(신규 저장 vs 덮어쓰기)가 명확하고, `rotate` 내부에서 존재 여부 분기로 UPSERT를 수행한다. 의미 차이가 주석으로도 설명된다.
  - 제안: 유지.

- **[WARNING]** `rotate` 내부에서 DB를 2회 조회 (findOne + update/insert)
  - 위치: `secret-resolver.service.ts:109-118`
  - 상세: `rotate` 는 항상 덮어쓰기 의미임에도 `findOne` 으로 존재 확인 후 분기한다. TypeORM의 `upsert` 또는 `save`를 직접 사용하면 조회 1회를 제거할 수 있다. 현재 구조에서는 동시성(race condition) 상황에서도 잠재적으로 `insert` 가 충돌할 수 있으며, 로직 변경 시 두 경로를 모두 유지해야 하는 인지 부담이 있다.
  - 제안: TypeORM `upsert(entity, ['ref'])` 또는 DB 레벨 `ON CONFLICT DO UPDATE` 를 활용하거나, `save` 를 통해 단일 경로로 통일.

---

### `SecretResolverService.store` 엄격한 중복 금지 정책

- **[INFO]** `store` 가 중복 ref 에 throw 하는 정책이 명확
  - 위치: `secret-resolver.service.ts:84-99`
  - 상세: 메시지에서 `rotate()` 를 사용하라고 안내하는 방식으로 두 API의 책임 경계를 잘 설명한다.
  - 제안: 유지.

---

### `triggers.service.ts` — setupChatChannel

- **[WARNING]** 함수 내 책임 혼재 — secret store 저장 + adapter 호출 + config 갱신이 한 함수에 위치
  - 위치: `triggers.service.ts` setupChatChannel 메서드 (약 50줄 이상)
  - 상세: botTokenRef 생성·저장, adapter.setupChannel 호출, issuedSecretToken 처리·저장, config 갱신, 에러 시 fallback config 저장까지 순서대로 진행된다. 각 단계가 주석으로 구분되어 있어 가독성은 양호하나, 단일 함수가 5가지 이상의 부수작용을 책임진다. 향후 새 provider 추가 또는 에러 복구 로직 변경 시 수정 범위가 넓다.
  - 제안: `storeAndBuildInternalConfig(...)`, `storeSetupResult(...)` 등 helper 메서드로 단계별 분리를 고려. 현재 규모에서 필수는 아니지만 provider가 늘면 복잡도가 선형 증가할 수 있다.

- **[INFO]** setupChannel 실패 시 botTokenRef 가 secret_store 에 남는 경우 주석으로 명시
  - 위치: `triggers.service.ts:1808-1814` (diff)
  - 상세: "botTokenRef 는 store 됐지만 setupChannel 이 실패했으므로 config 에 ref 만 반영 (setupAt 미설정)" 주석이 있어 의도적 trade-off 임을 알 수 있다. 단, 실패 시 orphan secret row 가 생긴다는 점이 cleanup 누락 위험으로 이어질 수 있다.
  - 제안: 주석에 "orphan row는 trigger.remove() 시 deleteByPrefix 로 정리됨" 을 명시하면 독자 우려를 불식시킬 수 있다.

---

### `chat-channel.controller.ts` — rotateBotToken

- **[WARNING]** 메서드 길이 — 약 60줄, 여러 단계 혼재
  - 위치: `chat-channel.controller.ts:97-145` (diff 기준)
  - 상세: v2 ref 백업, old plaintext 조회, primary ref rotate, setupChannel 재호출, issuedSecretToken 저장, config 갱신이 단일 컨트롤러 메서드에 모여 있다. 일반적으로 컨트롤러는 요청 파싱·응답 구성만 담당해야 하며, 이 비즈니스 로직은 서비스 계층에 위치하는 것이 적합하다.
  - 제안: `ChatChannelService` 또는 `TriggersService` 에 `rotateBotToken(triggerId, workspaceId, newBotToken)` 메서드를 만들어 컨트롤러는 호출만 하도록 분리.

- **[INFO]** `buildSecretRef` 호출 인자가 인라인으로 반복 — 일관성은 유지
  - 위치: `chat-channel.controller.ts:234-238` (diff)
  - 상세: `buildSecretRef({ scope: 'triggers', resourceId: trigger.id, name: '...' })` 패턴이 컨트롤러와 서비스 양쪽에서 동일하게 사용되어 중복은 없으나, scope/resourceId 조합이 반복된다.
  - 제안: 유지 가능. 단, 향후 scope 변경 시 두 파일을 동시에 수정해야 하므로 필요 시 trigger 전용 ref builder를 별도 함수로 추출할 수 있다.

---

### `notification-webhook.processor.ts` — resolveSigningSecret

- **[INFO]** `resolveSigningSecret` 의 파라미터 명 `refOrLegacy` 가 의도를 잘 표현
  - 위치: `notification-webhook.processor.ts:1178-1202` (diff)
  - 상세: ref 형식이면 resolve, 아니면 legacy plaintext 직접 사용이라는 두 경로를 하나의 함수에서 처리하며 파라미터 명이 명확하다. JSDoc 주석도 우선순위를 명시한다.
  - 제안: 유지.

- **[WARNING]** `legacyPlaintext` 파라미터가 항상 `null` 로만 호출되어 현재 시점에서 사문화
  - 위치: `notification-webhook.processor.ts:1153-1164` (diff)
  - 상세: `resolveSigningSecret(trigger.notificationSecretV2, null, triggerId)` 의 두 번째 인수가 항상 `null`. `legacyPlaintext` 는 `config.signing.secret` plaintext fallback 용도로 설계됐으나 notificationSecretV2 경로에서는 legacy plaintext 개념이 없다. 파라미터 시그니처가 실제 사용과 어긋나 혼란을 줄 수 있다.
  - 제안: `secondarySecret` 경로는 `resolveSecretRef(ref, triggerId)` 로 분리하거나, 주석으로 "notificationSecretV2 경로에는 legacyPlaintext 없음" 을 명시.

---

### `hooks.service.ts` — validateTelegramSecretToken

- **[WARNING]** Telegram 인증 블록이 인라인으로 존재 — provider가 늘면 유지보수 부담
  - 위치: `hooks.service.ts:199-220` (diff)
  - 상세: `if (config.provider === 'telegram' && config.secretTokenRef)` 블록이 handleChatChannelWebhook 내에 직접 위치한다. 다른 provider가 provider-specific 헤더 검증을 필요로 할 때 동일한 패턴이 반복될 수 있다.
  - 제안: `validateWebhookAuth(config, input.headers)` 같은 private 메서드로 추출하면 향후 provider 추가 시 수정 지점을 일원화할 수 있다.

---

### 테스트 코드 — SecretResolverService mock 중복

- **[WARNING]** `SecretResolverService` mock 객체가 여러 spec 파일에 중복 정의
  - 위치: `triggers.service.spec.ts` 3개 describe 블록, `hooks.service.spec.ts`, `notification-webhook.processor.spec.ts`
  - 상세: `{ store: jest.fn(), rotate: jest.fn(), resolve: jest.fn(), delete: jest.fn(), deleteByPrefix: jest.fn(), exists: jest.fn() }` 형태의 mock 리터럴이 최소 5곳 이상에서 복사·반복된다. 인터페이스에 메서드가 추가될 때 모든 mock을 동시에 갱신해야 한다.
  - 제안: `test/factories/secret-resolver.mock.ts` 또는 공용 `makeSecretResolverMock()` 팩토리 함수를 만들어 단일 위치에서 관리.

---

### `table.handler.spec.ts` — 타입 캐스트 반복

- **[INFO]** `as unknown as { config: ...; output: ... }` 캐스트가 17회 이상 반복 → 별도 helper 타입 제안
  - 위치: `table.handler.spec.ts` (파일 21 전체)
  - 상세: 이번 변경에서 멀티라인 형식으로 포맷이 정리됐으나 동일 타입 캐스트가 수십 회 반복된다. 핸들러 반환 타입이 변경될 때 모든 캐스트를 수정해야 한다.
  - 제안: 파일 상단에 `type TableHandlerResult = { config: Record<string, unknown>; output: Record<string, unknown> }` 타입 alias를 선언하고 `as unknown as TableHandlerResult` 로 참조.

---

### spec/migrations SQL

- **[INFO]** `V063__secret_store.sql` — CHECK constraint가 regex 검증까지 포함하여 application 검증과 이중 방어
  - 위치: `/codebase/backend/migrations/V063__secret_store.sql`
  - 상세: DB 레벨과 application 레벨에서 동일 정규식이 사용된다. 두 곳이 동기화되지 않으면 한쪽만 통과하는 상황이 생길 수 있다.
  - 제안: SQL 주석에 대응하는 application 정규식 위치(`secret-ref.ts` `SECRET_URI_REGEX`)를 명시하면 추후 변경 시 동기화를 잊지 않도록 돕는다.

---

### 네이밍 일관성

- **[INFO]** `secrets` 로 주입받는 `SecretResolverService` 파라미터명이 일관됨
  - 위치: `TelegramAdapter`, `HooksService`, `TriggersService`, `ChatChannelController`, `NotificationWebhookProcessor` 모두
  - 상세: private 필드명 `secrets` 가 모든 소비자에서 통일되어 코드베이스 전반에 걸쳐 추적이 용이하다.
  - 제안: 유지.

- **[INFO]** `botToken` (plaintext) vs `botTokenRef` (ref) 구분이 타입 수준에서 강제됨
  - 위치: `types.ts`, `chat-channel-config.dto.ts`
  - 상세: DTO에서 `botToken` (입력 plaintext), 내부 config 타입에서 `botTokenRef` (ref only)로 명확히 분리된다. plaintext가 내부 타입에 유입될 수 없어 안전하다.
  - 제안: 유지.

---

## 요약

이번 변경은 secret store 인프라 도입과 기존 chat-channel / notification-signing plaintext 자격증명의 마이그레이션을 동시에 수행한다. 핵심 모듈인 `secret-store/` 는 단일 책임 원칙을 잘 따르고, 상수 및 네이밍 정책이 일관적이다. 가장 두드러진 유지보수성 우려는 두 가지다. 첫째, `SecretResolverService` mock 리터럴이 5개 이상 spec 파일에 중복 정의되어 인터페이스 변경 시 동기화 누락 위험이 있다. 둘째, 컨트롤러 계층(`chat-channel.controller.ts`)에 비즈니스 로직이 직접 위치하여 함수가 60줄에 달하며 서비스 계층으로 분리가 권장된다. `triggers.service.ts`의 setupChatChannel도 여러 부수작용을 순서대로 실행하는 구조이나 주석으로 각 단계를 명확히 구분하고 있어 현재 규모에서는 허용 범위다. 전반적으로 신규 도입 코드의 설계 의도와 주석 품질은 우수하며, 지적 사항들은 확장성과 테스트 유지보수성 측면의 개선 권고 수준이다.

## 위험도

LOW
