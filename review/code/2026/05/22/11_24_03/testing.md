# Testing Review — chat-channel-secret-store-pgcrypto

## 발견사항

---

### [INFO] secret-crypto.spec.ts — 핵심 암복호화 로직 커버리지 양호
- 위치: `/codebase/backend/src/modules/secret-store/secret-crypto.spec.ts`
- 상세: `parseMasterKey` (5건), `encryptSecret/decryptSecret` round-trip (6건) 을 망라. IV 재사용 금지 검증, AAD mismatch (cross-row 교체 공격), authTag 변조, 키 불일치, envelope 길이 부족을 모두 검증한다. 암호화 핵심 경로의 단위 테스트로 충분하다.
- 제안: 현행 유지.

---

### [INFO] secret-resolver.service.spec.ts — 주요 CRUD 경로 커버리지 양호
- 위치: `/codebase/backend/src/modules/secret-store/secret-resolver.service.spec.ts`
- 상세: `onModuleInit` fail-fast, `store/resolve` round-trip, 중복 ref 에러, `rotate` UPSERT 양쪽, `exists`, `delete` noop 을 커버한다.
- 제안: 현행 유지 (아래 CRITICAL/WARNING 항목과 함께 보완 필요).

---

### [CRITICAL] deleteByPrefix — 단위 테스트 미존재 + in-memory mock 버그
- 위치: `/codebase/backend/src/modules/secret-store/secret-resolver.service.spec.ts` L43~60, `secret-resolver.service.ts` L139~151
- 상세: `deleteByPrefix` 에 대한 테스트 케이스가 `secret-resolver.service.spec.ts` 에 전혀 없다. 더 심각한 문제는 in-memory mock 의 `createQueryBuilder` 구현 자체가 동작하지 않는다. `_lastPrefix` 필드가 `undefined` 로 초기화된 채로 `.where()` 콜백 내부에서 `this._lastPrefix` 를 참조하는데, `where()` 가 prefix 인자를 `_lastPrefix` 에 세팅하는 로직이 없다. 따라서 실제 서비스에서 `.where('ref LIKE :prefix', { prefix: ... })` 로 prefix 를 전달해도 mock 에서 `_lastPrefix` 는 항상 `undefined` 이므로 `k.startsWith(undefined)` 가 되어 아무 row 도 삭제되지 않는다. `TriggersService.remove()` 가 trigger 삭제 시 `deleteByPrefix` 에 의존하므로 이 경로를 신뢰할 수 없다.
- 제안: (1) in-memory mock 의 `where(condition, params)` 에서 `params.prefix` 를 `_lastPrefix` 에 세팅하는 로직 추가. (2) `deleteByPrefix` 단위 테스트 추가 — 여러 ref 를 store 한 뒤 prefix 매칭 건만 삭제되고 나머지는 남아있는지, 0건 매칭 시 affected=0 반환인지, `secret://` 미시작 prefix 시 throw 인지를 검증.

---

### [CRITICAL] ChatChannelController — rotate-bot-token 로직 단위 테스트 미존재
- 위치: `/codebase/backend/src/modules/chat-channel/chat-channel.controller.ts` (변경분 전체, 약 60 LOC)
- 상세: `rotate-bot-token` 엔드포인트는 이번 PR 에서 가장 복잡하게 변경된 로직이다 — (a) 기존 botToken resolve (실패 시 skip), (b) v2Ref 에 oldPlaintext 백업, (c) primary botTokenRef 에 newBotToken rotate, (d) setupChannel 재호출, (e) issuedSecretToken → secretTokenRef store, (f) trigger config 갱신 + chatChannelTokenV2 null/ref 분기. 이 6단계를 검증하는 `chat-channel.controller.spec.ts` 파일이 존재하지 않는다.
- 제안: 컨트롤러 단위 테스트를 신설하여 최소 다음 케이스를 커버: (1) 정상 rotation — 각 단계 mock 호출 순서 검증, (2) 첫 rotation (oldPlaintext resolve 실패) — v2Ref 백업 skip + chatChannelTokenV2=null, (3) issuedSecretToken 있을 때 secretTokenRef 생성·저장, (4) setupChannel 예외 시 error handling.

---

### [WARNING] TriggersService.setupChatChannel — 신규 secret store 경로 테스트 미존재
- 위치: `/codebase/backend/src/modules/triggers/triggers.service.spec.ts`
- 상세: `setupChatChannel` 에서 이번 PR 의 핵심 변경사항인 (a) `secrets.rotate(botTokenRef, ...)` 호출, (b) `result.issuedSecretToken` → `secrets.rotate(webhookSecretRef, ...)`, (c) `fallbackConfig` 경로 (setupChannel 실패 시 botTokenRef 는 이미 저장됐으나 config 에 ref 만 반영)를 검증하는 테스트가 전혀 없다. 현재 `TriggersService.Secret rotation / itk revoke` describe 에 secret store 관련 `secrets.*` 호출 검증이 일부 추가됐으나, `setupChatChannel` 자체는 미테스트 상태다.
- 제안: `setupChatChannel` describe 신설 후 (a) 성공 시 `secrets.rotate` 두 번 호출 (botToken + webhookSecret) 검증, (b) `issuedSecretToken` 없을 때 webhookSecretRef rotate 미호출, (c) setupChannel throw 시 fallbackConfig 갱신 및 `chatChannelHealth=degraded` 검증 추가.

---

### [WARNING] TriggersService.remove — deleteByPrefix 호출 테스트 미존재
- 위치: `/codebase/backend/src/modules/triggers/triggers.service.spec.ts`
- 상세: `remove` 메서드에 신규 추가된 `this.secrets.deleteByPrefix(\`secret://triggers/${trigger.id}/\`)` 호출이 테스트되지 않는다. cascade delete 가 실제로 올바른 prefix 로 호출되는지 검증이 없다.
- 제안: `remove` 테스트에서 `secrets.deleteByPrefix` 가 `secret://triggers/<id>/` 로 호출됨을 검증.

---

### [WARNING] HooksService — secretTokenRef resolve 실패 → 401 경로 미테스트
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.spec.ts`
- 상세: `hooks.service.ts` 에서 `config.secretTokenRef` 가 있을 때 `secrets.resolve` 가 throw 하면 `UnauthorizedException` 을 발생시키는 경로가 추가됐다. 현재 테스트는 (a) 정상 match, (b) 헤더 불일치 → 401, (c) secretTokenRef 미설정 → skip 만 검증한다. resolve 실패 → 401 케이스가 누락됐다.
- 제안: `secrets.resolve.mockRejectedValueOnce(new Error('secret not found'))` 를 사용해 `UnauthorizedException` throw 를 검증하는 테스트 추가.

---

### [WARNING] NotificationWebhookProcessor — resolveSigningSecret 실패 → markDegraded 경로 미테스트
- 위치: `/codebase/backend/src/modules/external-interaction/notification-webhook.processor.spec.ts`
- 상세: `resolveSigningSecret` 에서 secretRef resolve 가 실패하면 `null` 을 반환하고 `!primarySecret` 분기에서 `markDegraded` 를 호출한다. 이 경로를 검증하는 테스트가 없다. `secrets.resolve.mockRejectedValueOnce(...)` 로 재현 가능하다.
- 제안: "secretRef resolve 실패 시 degraded + skip" 케이스 추가.

---

### [WARNING] NotificationWebhookProcessor — legacyPlaintext fallback 경로 미테스트
- 위치: `/codebase/backend/src/modules/external-interaction/notification-webhook.processor.spec.ts`
- 상세: `resolveSigningSecret` 에는 `refOrLegacy` 가 secret ref 형식이 아닌 경우 그대로 legacy plaintext 로 사용하는 fallback 이 있다 (마이그레이션 호환성). 기존 테스트 "HMAC 헤더" 는 여전히 `config.signing.secret = SECRET` (plaintext) 로 동작하므로 이 경로를 암묵적으로 커버하지만, 명시적 테스트가 없어 의도가 불분명하다.
- 제안: 테스트명에 "(legacy plaintext fallback)" 을 명시하거나 별도 케이스로 분리.

---

### [INFO] TelegramAdapter — SecretResolverService mock 구조 적절
- 위치: `/codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.spec.ts` L27~38
- 상세: `makeSecretsMock` 팩토리가 각 테스트 `beforeEach` 에서 새 인스턴스를 생성하므로 테스트 격리가 유지된다. `BOT_TOKEN_REF → BOT_TOKEN_PLAIN` 매핑이 명확하고, 예상치 못한 ref 시 명시적 오류를 throw 하는 방어적 mock 구현이 실제 동작과의 괴리를 최소화한다.
- 제안: 현행 유지.

---

### [INFO] TelegramAdapter — teardownChannel resolve 실패 시 best-effort 테스트 추가됨
- 위치: `/codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.spec.ts` L151~160
- 상세: `secrets.resolve.mockRejectedValueOnce` 를 사용해 resolve 실패 → deleteWebhook 미호출 → 예외 없이 완료를 검증하는 테스트가 추가됐다. best-effort 계약을 명확하게 표현한다.
- 제안: 현행 유지.

---

### [INFO] TelegramAdapter — secretToken 재사용 테스트 제거 (설계 변경 반영)
- 위치: `/codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.spec.ts`
- 상세: `config 에 secretToken 이 있으면 기존 값으로 setWebhook 호출한다 (재설정 멱등성)` 테스트가 삭제됐다. 이는 설계가 "매 setupChannel 마다 새 secretToken 발급 후 caller 에 위임" 으로 변경됐기 때문으로, 제거가 타당하다. SetupResult 에 `configUpdates.secretToken` 이 없고 `issuedSecretToken` 만 있음을 검증하는 테스트로 대체됐다.
- 제안: 현행 유지.

---

### [INFO] SecretResolverService — `deleteByPrefix` invalid prefix 검증 테스트 미존재
- 위치: `/codebase/backend/src/modules/secret-store/secret-resolver.service.spec.ts`
- 상세: `deleteByPrefix` 가 `secret://` 로 시작하지 않는 prefix 에서 throw 하는 경로가 서비스 코드에 있으나 테스트되지 않는다 (CRITICAL 항목과 연계).
- 제안: CRITICAL 항목 fix 시 함께 커버.

---

### [INFO] table.handler.spec.ts — 변경 사항은 코드 포맷팅만
- 위치: `/codebase/backend/src/nodes/presentation/table/table.handler.spec.ts`
- 상세: `as unknown as { ... }` 타입 캐스팅의 줄바꿈 형식 변경만 있다. 테스트 로직·검증 대상 변경 없음.
- 제안: 해당 없음.

---

### [INFO] app.module.spec.ts — SecretStore entity 등록 가드 추가
- 위치: `/codebase/backend/src/app.module.spec.ts`
- 상세: `REQUIRED_ENTITIES` 에 `SecretStore` 를 추가하여 AppModule 의 entity 등록 여부를 자동 검증한다. entity 누락 시 이 테스트가 실패하는 구조로 회귀 방지가 적절히 동작한다.
- 제안: 현행 유지.

---

## 요약

이번 PR 의 핵심인 secret store 인프라 (`SecretResolverService`, `secret-crypto`, `secret-ref`) 자체에 대한 단위 테스트는 체계적으로 작성됐다. 암복호화 round-trip·AAD 검증·fail-fast, CRUD, URI 파서 모두 커버된다. TelegramAdapter 의 SecretResolver 통합 테스트도 mock 설계가 적절하고 edge case(resolve 실패 best-effort)를 포함한다. 그러나 `deleteByPrefix` 의 in-memory mock 구현 버그로 인해 실제 prefix 매칭 삭제가 테스트에서 검증되지 않으며(`TriggersService.remove` 의 cascade delete 검증 불가), `ChatChannelController.rotate-bot-token` 의 복잡한 6단계 변경 로직에 대한 전용 테스트가 전혀 없다. `TriggersService.setupChatChannel` 의 신규 secret store 경로(botToken store, webhookSecret store, setupChannel 실패 fallback)도 미테스트 상태다. `HooksService` 의 secretTokenRef resolve 실패 → 401 경로와 `NotificationWebhookProcessor` 의 resolve 실패 → degraded 경로도 누락됐다. CRITICAL 2건(deleteByPrefix mock 버그 + 컨트롤러 테스트 부재)과 WARNING 4건을 보완하면 변경 전반의 테스트 신뢰도가 크게 개선된다.

## 위험도

HIGH
