# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] SecretStoreModule — 단일 책임 원칙 및 레이어 경계 적절히 설계됨
- 위치: `codebase/backend/src/modules/secret-store/`
- 상세: `SecretResolverService`, `secret-crypto.ts`, `secret-ref.ts`, `SecretStore` entity 가 각각 단일 역할을 갖도록 분리되어 있다. 암복호화 순수 함수(`secret-crypto.ts`), URI 파싱/빌딩(`secret-ref.ts`), DB 접근(`SecretResolverService`), 스키마(`SecretStore`) 간 레이어 경계가 명확하다. `SecretStoreModule`은 `SecretResolverService` 만 export 하여 외부에 최소 인터페이스를 노출한다.
- 제안: 현 구조 유지. 이후 다른 backend 구현(e.g., Vault adapter)으로 교체 시를 위해 `SecretResolver` interface를 별도 파일로 추출하면 OCP/DIP 관점에서 더 명확해진다 (현재는 구체 서비스만 존재).

---

### [WARNING] 의존성 역전 원칙(DIP) 미완 — 인터페이스 없이 구체 클래스에 직접 의존
- 위치:
  - `codebase/backend/src/modules/chat-channel/chat-channel.controller.ts` (line: `private readonly secrets: SecretResolverService`)
  - `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts` (constructor: `private readonly secrets: SecretResolverService`)
  - `codebase/backend/src/modules/hooks/hooks.service.ts` (line: `private readonly secrets: SecretResolverService`)
  - `codebase/backend/src/modules/external-interaction/notification-webhook.processor.ts`
  - `codebase/backend/src/modules/triggers/triggers.service.ts`
- 상세: 다섯 개 소비자 모듈 모두 `SecretResolverService` 구체 클래스에 직접 의존한다. spec의 `secret-store.md §2`가 `SecretResolver` 인터페이스를 별도 정의하는 구조를 명시하고 있으나, 코드에는 interface 파일이 없다. 테스트 mock이 `jest.Mocked<SecretResolverService>`로 구체 클래스에 의존하므로, 추후 backend 교체(Vault 등) 시 소비자 코드를 전부 수정해야 한다.
- 제안: `ISecretResolver` 인터페이스를 `secret-store/interfaces/secret-resolver.interface.ts`로 추출하고, NestJS injection token을 심볼로 분리(`SECRET_RESOLVER`). `SecretResolverService`가 해당 인터페이스를 구현하도록 변경. 현 단계에서 구현체가 하나이므로 즉각 리팩터링 부담은 낮다.

---

### [WARNING] ChatChannelController의 도메인 로직 집중 — 단일 책임 원칙 경계선
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.controller.ts` (rotate-bot-token 핸들러, 약 60줄)
- 상세: `rotate-bot-token` 엔드포인트 핸들러가 다음을 직접 수행하고 있다: (1) old token resolve, (2) v2 ref 생성 및 secret store rotate, (3) primary ref rotate, (4) adapter.setupChannel 호출, (5) issuedSecretToken을 secret store에 저장, (6) triggerRepository.update. 이는 Controller가 비즈니스 로직과 오케스트레이션을 직접 담당하는 것으로, Controller는 HTTP 관심사(입력 파싱, 응답 직렬화, 권한 확인)에만 집중해야 한다는 레이어 책임 원칙에 위배된다. `TriggersService.setupChatChannel`은 이미 유사 로직을 서비스 레이어에 갖고 있다.
- 제안: rotation 오케스트레이션을 `TriggersService.rotateBotToken(triggerId, workspaceId, newBotToken)` 메서드로 위임. Controller는 해당 메서드 호출 + 응답 직렬화만 담당. 이는 `TriggersService.setupChatChannel`과 동일한 패턴으로, 일관성도 확보된다.

---

### [INFO] `resolveSigningSecret` 메서드 — legacy plaintext 폴백 로직의 레이어 위치
- 위치: `codebase/backend/src/modules/external-interaction/notification-webhook.processor.ts` (lines 172~202, `resolveSigningSecret` private 메서드)
- 상세: ref 판별 + legacy plaintext fallback 로직이 `NotificationWebhookProcessor` 내에 private 메서드로 구현되어 있다. 이 "ref이면 resolve, 아니면 legacy plaintext 그대로 반환" 로직은 마이그레이션 기간 한정 패턴이므로 현 위치(도메인 서비스)가 현실적으로 적절하다. 다만 동일 패턴이 다른 소비자에도 필요할 경우 `SecretResolverService`에 `resolveOrLegacy(refOrPlaintext)` 메서드를 추가하는 것이 응집도를 높인다.
- 제안: 단기간 backfill이 없는 전략이므로 현 위치 유지 가능. 만약 다른 모듈에서도 legacy fallback이 필요하다면 `SecretResolverService.resolveOrLegacy(value, triggerId)` 로 중앙화를 검토.

---

### [INFO] `deleteByPrefix`의 LIKE 쿼리 — 인덱스 활용 확인 필요
- 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (lines 139~151)
- 상세: `WHERE ref LIKE 'secret://triggers/{id}/%'`는 prefix 검색이므로 `ref TEXT PRIMARY KEY` B-tree 인덱스를 활용할 수 있다. 단, TypeORM QueryBuilder의 parameter binding이 `LIKE :prefix` 형태로 올바르게 바인딩되어 있어 SQL injection 위협은 없다. `workspace_id` 인덱스도 별도 생성되어 있다.
- 제안: 현 구현 유지. `ref`가 PK(B-tree)이므로 prefix LIKE는 index scan 활용 가능. 다만 대규모 cleanup 시 batch 처리가 필요할 수 있으므로 향후 고려 항목으로 남긴다.

---

### [INFO] `secret_store` 테이블의 workspace_id FK 미설정 — 의도적 설계
- 위치: `codebase/backend/migrations/V063__secret_store.sql`, SQL 주석
- 상세: `workspace_id`에 DB FK constraint가 없고 application-level cascade를 택한 것은 의도적 결정(Rationale R4: 향후 system-wide secret 확장 여지)이며, 주석으로 명시되어 있다. `TriggersService.remove()`에서 `deleteByPrefix`를 호출해 trigger 삭제 시 정리하는 구조이나, workspace 삭제 경로(워크스페이스 전체 삭제 flow)의 호출 여부는 본 diff에서 확인되지 않는다.
- 제안: workspace 삭제 서비스(`WorkspaceService` 또는 동등 모듈)에서 `deleteByPrefix('secret://triggers/')` 또는 workspace-scope cleanup이 호출되는지 확인 필요. application-level cascade는 delete 경로가 빠지면 孤立 row가 남는 위험이 있다.

---

### [INFO] `parseMasterKey`의 SHA-256 derive fallback — 보안 완화 경로 존재
- 위치: `codebase/backend/src/modules/secret-store/secret-crypto.ts` (lines 970~974)
- 상세: 64-char hex가 아닌 임의 문자열 입력에 대해 SHA-256으로 key derive하는 fallback이 존재한다. 이는 e2e 환경 호환을 위한 것이나, 짧은 패스프레이즈(예: 'test')를 허용하는 soft path가 생긴다. `parseMasterKey`가 길이 제약 없이 임의 문자열을 수용하므로, 운영 환경에서 weak key가 사용될 위험이 있다. 테스트 spec에서도 이 경로를 "정상" 케이스로 명시하고 있다.
- 제안: 운영 환경에서는 반드시 64-char hex만 허용하도록 `NODE_ENV=production` 조건부 strict validation 추가를 검토. 또는 `onModuleInit`에서 64-char hex 여부를 추가로 경고 로그 출력.

---

### [INFO] `TelegramAdapter`의 `resolveBotToken` 호출 패턴 — 매 API 메서드마다 resolve
- 위치: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts`
- 상세: `setupChannel`, `teardownChannel`, `sendMessage`, `ackInteraction` 각각에서 `resolveBotToken(config)`를 독립적으로 호출한다. 단일 요청 내에서 여러 API 메서드가 연속 호출될 경우(현재 구조에서는 드물지만), DB 조회 + 복호화가 중복 발생한다. 현재 사용 패턴(각 요청마다 하나의 메서드만 호출)에서는 실질적 문제가 없다.
- 제안: 현 구조 유지 가능. 향후 단일 요청 내 다중 호출 패턴이 생기면 요청 레벨 캐시(e.g., `Map<ref, Promise<string>>`)를 도입.

---

### [INFO] `SetupResult.issuedSecretToken` — 1회성 plaintext 노출 계약 명확화
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` (`issuedSecretToken?: string` 필드)
- 상세: `issuedSecretToken`을 `SetupResult`에 노출하고 caller(`TriggersService`, `ChatChannelController`)가 즉시 secret store에 저장하는 패턴은 "1회성 plaintext 노출" 계약을 인터페이스 수준에서 명시한 좋은 설계이다. 다만 caller가 저장을 누락할 경우 secret이 영구 유실된다. 저장 실패 시 `issuedSecretToken`을 다시 얻을 방법이 없다.
- 제안: 현 설계 유지. 다만 `TriggersService.setupChatChannel`과 `ChatChannelController.rotateBotToken` 두 경로 모두에서 동일한 저장 로직이 중복 구현되어 있다. 앞서 언급한 Controller 로직 위임 시 자연스럽게 해소된다.

---

### [INFO] 순환 의존성 — 확인되지 않음
- 위치: 전체 변경 파일 그래프
- 상세: `SecretStoreModule`은 `ConfigModule` + `TypeOrmModule`만 import하고 도메인 모듈을 역참조하지 않는다. `ChatChannelModule` → `SecretStoreModule`, `HooksModule` → `SecretStoreModule`, `TriggersModule` → `SecretStoreModule`, `ExternalInteractionModule` → `SecretStoreModule` 방향으로만 흐르며, 역방향 의존이 없다. 순환 의존 위험 없음.
- 제안: 해당 없음.

---

### [INFO] `deleteByPrefix` — `NotificationWebhookProcessor`와 `HooksService`에 미구현
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`remove` 메서드)
- 상세: trigger 삭제 시 `deleteByPrefix('secret://triggers/{id}/')` 호출이 `TriggersService.remove`에만 구현되어 있다. notification-webhook과 hooks flow에서 trigger를 삭제하는 경로가 별도로 존재한다면 누락될 수 있으나, 현재 diff 범위에서는 삭제의 단일 진입점이 `TriggersService.remove`로 보인다.
- 제안: trigger 삭제 진입점이 `TriggersService.remove` 단일 경로임을 아키텍처 문서에서 확인. 추후 다른 삭제 경로 추가 시 cleanup 책임을 잊지 않도록 `@OnDelete` 또는 서비스 레이어 가드를 고려.

---

## 요약

이번 변경은 `secret-store` 인프라 모듈을 새로 도입하고 5개 모듈(`triggers`, `chat-channel`, `hooks`, `external-interaction`, `notification-webhook`)의 plaintext 자격증명을 `secret://` ref 기반 흐름으로 전환한 대규모 마이그레이션이다. 모듈 내부 구조(암호화 헬퍼, URI 파서, entity, 서비스 분리)는 단일 책임 원칙에 부합하고, `SecretStoreModule`이 `SecretResolverService`만 export하는 최소 인터페이스 설계는 적절하다. 의존성 방향이 단방향(소비자 → SecretStoreModule)으로 유지되어 순환 의존성도 없다. 주요 아키텍처적 개선 여지는 두 가지다: (1) 소비자들이 구체 클래스에 직접 의존하므로 `ISecretResolver` 인터페이스를 분리해 DIP를 완성하는 것, (2) `ChatChannelController`의 rotate 핸들러가 서비스 레이어에 위임해야 할 오케스트레이션 로직을 직접 보유한 것. workspace 삭제 시 secret 고아 row 정리 경로 확인도 후속 검토가 필요하다.

## 위험도

LOW
