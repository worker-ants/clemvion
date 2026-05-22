# 부작용(Side Effect) 리뷰

## 발견사항

### [WARNING] `TriggersService.setupChatChannel` — setupChannel 실패 시 botTokenRef 가 DB 에 기록되는 부작용

- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `setupChatChannel()` catch 블록 (`fallbackConfig` 저장 로직)
- 상세: `secrets.rotate(botTokenRef, ...)` 가 먼저 실행돼 `secret_store` 테이블에 row 가 삽입된다. 이후 `adapter.setupChannel(internalCfg, callbackUrl)` 가 실패하면 catch 블록이 `fallbackConfig`(botTokenRef 포함)를 trigger.config 에 저장한다. 의도된 동작이지만, setupChannel 이 여러 번 재시도되지 않는 한 `secret://triggers/{id}/bot-token` row 가 secret_store 에 orphan 으로 남을 가능성이 있다. trigger.remove() 시 `deleteByPrefix` 가 정리하지만 setupChannel 실패 후 teardown 없이 trigger 가 재사용된다면 stale row 가 잔류한다. 또한 `secrets.rotate` 가 UPSERT 이므로 재시도 시 같은 ref 에 새 plaintext 가 덮어쓰여 이전 암호화 값은 복구 불가.
- 제안: 현재 구조는 plan §3 의 "fallback — botTokenRef 만 config 에 반영" 으로 의도된 설계이므로 CRITICAL 은 아님. 다만 setupChannel 실패 시 로그에 "secret store 에 botToken 저장 완료, setupChannel 실패" 수준의 경고를 남겨 운영자가 인지할 수 있도록 개선을 권장.

---

### [WARNING] `TelegramAdapter.constructor` 시그니처 변경 — 기존 직접 인스턴스화 호출자 영향

- 위치: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts` — `constructor(client, secrets)`
- 상세: 기존 `constructor(client: TelegramClient)` 에서 `constructor(client: TelegramClient, private readonly secrets: SecretResolverService)` 로 두 번째 필수 인자가 추가됐다. NestJS DI 컨텍스트에서는 문제없으나, 테스트 코드 외에서 `new TelegramAdapter(client)` 형태로 직접 인스턴스화하는 곳이 있다면 런타임 오류가 발생한다. 리뷰 대상 범위에서는 스펙 파일(telegram.adapter.spec.ts)이 `new TelegramAdapter(client, secrets)` 로 이미 수정됐으므로 테스트는 정상이지만, 다른 파일에서 직접 생성하는 패턴이 있는지 추가 확인이 필요하다.
- 제안: `grep -r "new TelegramAdapter"` 로 코드베이스 전수 검색 권장.

---

### [WARNING] `NotificationWebhookProcessor.constructor` 시그니처 변경 — 기존 직접 인스턴스화 호출자 영향

- 위치: `codebase/backend/src/modules/external-interaction/notification-webhook.processor.ts` — 생성자에 `secrets: SecretResolverService` 추가
- 상세: `TelegramAdapter` 와 동일한 패턴. BullMQ `WorkerHost` 서브클래스이므로 일반적으로 NestJS DI 를 통해서만 인스턴스화되지만, 테스트 코드에서 `new NotificationWebhookProcessor(triggerRepo, executionRepo, secrets)` 형태로 직접 인스턴스화한다. 리뷰 대상 spec 파일은 이미 세 번째 인자를 추가했으므로 기존 테스트는 정상 통과한다.
- 제안: 이미 spec 에서 처리됐으므로 추가 조치 불필요.

---

### [WARNING] `ChatChannelConfig` 인터페이스 파괴적 변경 — `botToken` / `secretToken` 필드 제거

- 위치: `codebase/backend/src/modules/chat-channel/types.ts`
- 상세: `botToken: string` 이 `botTokenRef: string` 으로 대체되고, `secretToken?: string` 이 `secretTokenRef?: string` 으로 대체됐다. 이 인터페이스를 직접 참조하거나 spread 연산자로 사용하는 모든 코드가 영향을 받는다. 리뷰 범위 내에서는 `chat-channel.controller.ts`, `chat-channel.dispatcher.ts`, `hooks.service.ts`, `telegram.adapter.ts` 가 이미 갱신됐다. 그러나 이 인터페이스를 직접 `as ChatChannelConfig` 로 캐스팅하거나 `Partial<ChatChannelConfig>` 로 다루는 코드, 또는 config JSONB 를 DB 에서 읽어 직접 접근하는 코드가 있다면 런타임에 `undefined` 가 반환된다(TypeScript 컴파일은 통과하지만 실제 DB row 는 여전히 `botToken` 평문을 가질 수 있음).
- 제안: 기존 DB 에 `botToken` 평문으로 저장된 레거시 row 에 대한 read-path fallback 이 없다. plan 에서 "미배포 — 백필 불요" 로 결정됐으므로 기존 데이터 없음이 전제이지만, `readChatChannelConfig` 함수가 `botTokenRef` 의 존재를 강제 검증하므로 레거시 row 는 webhook 수신 시 `null` 반환 → 무시된다. 이는 의도된 동작으로 보이나, 레거시 호환 정책을 주석으로 명시해두면 향후 혼란을 방지할 수 있다.

---

### [INFO] `SetupResult.configUpdates` 에서 `secretToken` 제거 — 이전 코드와의 공개 인터페이스 호환성

- 위치: `codebase/backend/src/modules/chat-channel/types.ts` — `SetupResult` 인터페이스
- 상세: 기존 `configUpdates?.secretToken` 패턴이 `issuedSecretToken` 으로 분리됐다. 이 변경으로 이전에 `result.configUpdates?.secretToken` 으로 secret token 을 꺼내 저장하던 caller 가 `issuedSecretToken` 을 놓칠 수 있다. 리뷰 범위 내 caller(`TriggersService.setupChatChannel`, `ChatChannelController.rotateBotToken`)는 이미 `result.issuedSecretToken` 으로 갱신됐다. 외부 어댑터 구현자가 있다면 해당 패턴도 갱신 필요.
- 제안: `ChatChannelAdapter` 를 구현한 다른 어댑터(향후 WhatsApp 등)가 있다면 `SetupResult` 의 의미 변경을 주지시키는 changelog 주석이 필요하다.

---

### [INFO] `TriggersService.remove` — `deleteByPrefix` 가 `triggerRepository.remove` 와 트랜잭션 미묶임

- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `remove()` 메서드
- 상세: `await this.secrets.deleteByPrefix(...)` 후 `await this.triggerRepository.remove(trigger)` 가 별개의 DB 작업으로 순서대로 실행된다. `deleteByPrefix` 성공 후 `triggerRepository.remove` 가 실패하면 secret_store row 는 삭제됐는데 trigger row 는 남는 불일치 상태가 된다. 역방향(trigger 삭제 후 secret 미삭제)보다는 덜 위험하지만, secret 이 orphan 된 trigger 에 연결돼 있다고 오인될 수 있다.
- 제안: 현재 구조는 plan 의 "application-level cascade" 결정을 따른 것으로 의도된 설계다. 다만 실패 시 재시도를 위해 `deleteByPrefix` 를 trigger 삭제 이후로 순서를 바꾸거나(trigger 없으면 secret 도 orphan 이 되므로 cleanup 배치로 정리), 또는 두 작업을 단일 DB 트랜잭션으로 묶는 것을 장기적으로 검토할 가치가 있다.

---

### [INFO] `SecretResolverService.onModuleInit` — `masterKey` 가 인스턴스 필드에 평생 유지됨

- 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` — `private masterKey: Buffer | null`
- 상세: `parseMasterKey` 가 반환한 32-byte Buffer 가 서비스 인스턴스의 `masterKey` 필드에 애플리케이션 수명 전체 동안 저장된다. plan 에서 "resolve() 후 plaintext buffer wipe (Buffer.fill(0)) — v2 옵션" 으로 언급됐듯, 현재는 마스터키가 메모리에 지속 잔류한다. Node.js GC 가 Buffer 를 즉시 해제하지 않으므로 힙 덤프 시 노출 가능성이 있다. plan 에서 v2 과제로 명시됐으므로 현재 범위에서는 INFO 수준.
- 제안: v2 에서 `Buffer.fill(0)` 또는 SecureBuffer 패턴을 도입할 때 이 필드 처리도 포함하도록 기록.

---

### [INFO] `ChatChannelConfigDto` — `botToken` 필드 유지, `botTokenRef` / `secretToken` 제거

- 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
- 상세: DTO 에 `botToken: string` 은 여전히 존재(입력용 plaintext)하고, `botTokenRef` 와 `secretToken` 이 제거됐다. 이는 "DTO 에서 받은 plaintext → 서버가 secret store 에 저장 → config 에는 ref 만" 패턴을 구현한다. 의도된 설계이지만, 응답 직렬화 시 `botToken` 이 노출되지 않도록 하는 장치(response DTO 의 `@Exclude()` 등)가 별도로 필요하다. 현재 diff 에서 응답 마스킹 구현 여부가 보이지 않는다.
- 제안: `botToken` 이 API 응답에 포함되지 않는지 확인 필요. `TriggersController` 의 응답 직렬화 설정을 점검할 것.

---

### [INFO] `promoteRotatedNotificationSecrets` — `delete updatedSigning.secret` 로 인한 객체 변이

- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `promoteRotatedNotificationSecrets()`
- 상세: `delete (updatedSigning as Record<string, unknown>).secret` 가 spread 로 생성한 새 객체에 대해 호출된다. 이 자체는 안전하지만, `updatedSigning` 이 `signing` 의 spread 결과이므로 원본 `trigger.config` 객체는 영향을 받지 않는다. TypeScript 타입 단언(`as Record<string, unknown>`)이 필요하다는 점은 타입 설계의 불완전함을 나타내지만 부작용은 없다.
- 제안: 타입 안전성 향상을 위해 `Omit<typeof signing, 'secret'>` 패턴 사용을 검토.

---

### [INFO] `package-lock.json` 변경 — chokidar 3.6.0 추가, uglify-js 에 `dev: true` 추가

- 위치: `codebase/backend/package-lock.json`, `codebase/frontend/package-lock.json`
- 상세: `@nestjs-modules/mailer` 의 중첩 의존성으로 `chokidar@3.6.0` (optional, peer) 와 관련 패키지(`glob-parent@5.1.2`, `readdirp@3.6.0`)가 추가됐다. 이는 npm lock 파일 재생성 과정에서 발생한 자동 변경으로 부작용은 없다. `uglify-js` 와 frontend 의 `fsevents` 에 `"dev": true` 플래그가 추가된 것도 동일하게 자동 갱신 결과다.
- 제안: 의도하지 않은 의존성 추가가 없음을 확인. 문제없음.

---

## 요약

이 변경은 Chat Channel(botToken/secretToken)과 EIA Notification(signing.secret)의 plaintext stub 을 application-side AES-256-GCM 기반 `SecretResolverService` 로 전면 교체한다. 인터페이스 관점에서 가장 주목할 부작용은 `ChatChannelConfig.botToken` → `botTokenRef` 로의 breaking change 와 `TelegramAdapter` / `NotificationWebhookProcessor` 생성자 시그니처 변경이며, 이 두 가지는 리뷰 범위 내 파일에서 이미 동반 갱신됐다. 상태 변경 측면에서는 `TriggersService.setupChatChannel` 의 실패 경로에서 secret_store row 가 먼저 삽입된 뒤 adapter 호출이 실패할 경우 부분 상태가 남는 점과, `remove()` 에서 `deleteByPrefix` 와 `triggerRepository.remove` 가 트랜잭션 없이 순서대로 실행되는 점이 잠재적 불일치 원인이다. 이 두 가지는 plan 에서 "application-level cascade" 로 의도된 설계이지만, 실패 시 orphan row 가 잔류할 수 있어 운영 가시성 보완이 권장된다. 전역 변수 수정, 파일시스템 부작용, 환경 변수의 의도치 않은 읽기/쓰기는 발견되지 않았다.

## 위험도

MEDIUM
