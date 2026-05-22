# 보안(Security) 리뷰 — chat-channel-secret-store-pgcrypto

## 발견사항

---

### [INFO] masterKey 가 인스턴스 필드로 메모리에 상주
- **위치**: `/codebase/backend/src/modules/secret-store/secret-resolver.service.ts` — `private masterKey: Buffer | null = null`
- **상세**: 마스터키가 GC 에 의존한 유효기간 동안 힙 메모리에 상주한다. Node.js 에서 `Buffer` 는 JS GC 대상이 아닌 native heap 에 올라가기 때문에, 힙 덤프 / core dump / 메모리 스캔 시 키 값이 노출될 수 있다. spec/conventions/secret-store.md §SS-SE-06 에서 "v2 옵션"으로 명시적 wipe 를 후속 과제로 미룬 점은 확인됨.
- **제안**: 긴급 차단 사안은 아니나, 가능한 빠른 후속 PR 에서 서비스 종료 시(`onModuleDestroy`) `this.masterKey.fill(0)` 호출을 추가할 것. `plaintext` 반환 버퍼도 동일하게 caller 사용 종료 후 wipe 패턴을 doc 으로 명시 권장.

---

### [INFO] masterKey 공용 재사용 — 도메인 분리 부재
- **위치**: `secret-crypto.ts:parseMasterKey`, `secret-resolver.service.ts:onModuleInit`, `spec/conventions/secret-store.md §3.3`
- **상세**: `ENCRYPTION_KEY` 를 LLM API key 암호화와 secret store 가 공유한다. 두 암호화 목적 간 키 분리가 없으므로, 하나의 암호화 컨텍스트가 침해되면 같은 키를 쓰는 다른 컨텍스트의 ciphertext 가 일괄 노출될 수 있다. spec 은 "향후 도메인 분리가 필요해지면 `ENCRYPTION_KEY_SECRET_STORE` 검토" 를 언급하나 현재 미적용 상태.
- **제안**: 단기적으로 허용 가능한 tradeoff 이나, secret store 전용 키(`ENCRYPTION_KEY_SECRET_STORE`)를 env 에 선택적으로 도입하고 미설정 시 기존 `ENCRYPTION_KEY` 를 fallback 으로 파생하는 방식을 검토. 이를 통해 키 노출 반경을 줄일 수 있다.

---

### [INFO] `parseMasterKey` — 비표준 문자열 입력 시 SHA-256 key derivation 경로
- **위치**: `secret-crypto.ts:parseMasterKey` (fallback 분기)
- **상세**: 64-char hex 가 아닌 임의 문자열 입력 시 `createHash('sha256').update(rawHex).digest()` 로 키를 derive 한다. SHA-256 은 KDF 가 아니므로 salt 없음, iteration 없음, side-channel 저항 없음. 단순 해시 KDF 는 PBKDF2/scrypt/Argon2 등 표준 KDF 에 비해 brute-force 에 취약하다. 다만 이 경로는 주로 e2e 환경의 짧은 키를 위한 fallback 이며, 프로덕션에서는 `.env.example` 의 64-char hex 경로(직접 사용)를 사용하도록 설계된 점은 양호.
- **제안**: 프로덕션 배포 가이드에 "반드시 64-char hex 형식 사용" 을 명시하고, CI/CD 단계에서 `ENCRYPTION_KEY` 길이 검증을 추가할 것. 가능하면 fallback SHA-256 derive 경로를 제거하고, 비표준 입력은 fail-fast 처리하는 것이 보안적으로 바람직하다.

---

### [INFO] `deleteByPrefix` — LIKE 패턴 메타문자 이스케이프 미수행
- **위치**: `secret-resolver.service.ts:deleteByPrefix` — `.where('ref LIKE :prefix', { prefix: \`${prefix}%\` })`
- **상세**: TypeORM 의 파라미터 바인딩(`:prefix`)은 SQL 인젝션을 방어하지만, LIKE 패턴 메타문자(`%`, `_`)는 이스케이프하지 않는다. `prefix` 인자에 `%` 또는 `_` 가 포함된 경우 의도치 않은 패턴 매칭으로 다른 workspace 의 secret 이 삭제될 수 있다. 현재 `prefix` 는 내부 `buildSecretRef` 결과 + `/` suffix 로 생성되므로 실제 `%` / `_` 포함 가능성은 낮다. 그러나 향후 외부 입력이 이 경로로 유입될 경우 위험이 증가한다.
- **제안**: `prefix` 를 PostgreSQL LIKE escape 처리(`prefix.replace(/[\\%_]/g, '\\$&')`)하거나, `LIKE` 대신 `ref LIKE :safe_prefix` 와 함께 `ESCAPE '\\'` 절을 추가할 것. 또는 `ref >= :start AND ref < :end` 범위 쿼리로 전환하는 것이 더 안전하다.

---

### [WARNING] `assertRefFormat` — ref 값 자체를 에러 메시지에 포함 (로그 노출 가능성)
- **위치**: `secret-resolver.service.ts:assertRefFormat` — `throw new Error('... 입력: ' + JSON.stringify(ref))`
- **상세**: `assertRefFormat` 이 유효하지 않은 ref 를 에러 메시지에 그대로 포함해 throw 한다. ref 가 실수로 plaintext bot token(`123456789:AAA...`) 형식으로 입력되는 경우(마이그레이션 실수, 잘못된 config 등), 해당 에러 메시지가 application logger 또는 외부 APM 에 기록되어 token 이 노출된다. 실제로 `hooks.service.ts` 는 rotation 전 첫 setupChannel 전 trigger 에 대해 `secretTokenRef` 미설정 시 검증을 skip 하는 경로가 있어, 잘못 전달된 값이 이 경로를 통과할 가능성이 낮지 않다.
- **제안**: `assertRefFormat` 의 에러 메시지에서 입력 값을 제거하거나, 형식 요약(길이, 시작 문자 등)만 포함한다: `throw new Error('SecretResolverService: invalid ref format (input length=' + ref.length + ')')`. plaintext 를 절대 로그에 남기지 않는 SS-SE-05 정책에 에러 메시지도 포함시켜야 한다.

---

### [WARNING] `resolve()` 실패 시 에러를 re-throw — 호출자에 raw 에러 전파
- **위치**: `secret-resolver.service.ts:resolve` (catch 블록의 `throw err`)
- **상세**: `resolve()` 에서 복호화 실패 시 원본 `err` 를 그대로 re-throw 한다. Node.js `crypto` 모듈의 GCM 인증 실패 에러(예: `Unsupported state or unable to authenticate data`)가 그대로 호출 스택을 타고 올라가 HTTP 응답의 500 에러 body 나 외부 로그에 노출될 수 있다. 이 에러 메시지 자체는 민감 정보를 담지 않지만, 특정 암호화 실패 패턴이 노출되면 timing/oracle attack 에 활용될 수 있다.
- **제안**: catch 블록에서 원본 에러를 감싸는 추상화된 에러(`new Error('Secret decryption failed')`)로 교체하고, 원본 에러는 로그에만 기록하는 것을 권장. 이미 logger 에 기록하므로 추상화된 에러만 throw 해도 디버그 가시성이 유지된다.

---

### [WARNING] Telegram `secretTokenRef` 미설정 시 webhook 인증 완전 skip
- **위치**: `hooks.service.ts` — `if (config.provider === 'telegram' && config.secretTokenRef)` 조건 분기
- **상세**: `secretTokenRef` 가 없으면 `X-Telegram-Bot-Api-Secret-Token` 헤더 검증이 전혀 수행되지 않는다. 신규 trigger 생성 직후(`setupChannel` 완료 전)나 마이그레이션 중인 기존 trigger 에서 이 상태가 발생할 수 있다. 이 상태의 webhook endpoint 는 누구나 호출 가능해 SSRF / 봇 스푸핑 공격에 노출된다.
- **제안**: `setupChannel` 을 완료하기 전에는 webhook endpoint 를 활성화하지 않도록 `chatChannelHealth` 상태를 `pending` 으로 유지하고, `health !== 'healthy'` 인 경우 webhook 수신을 거부하는 가드를 추가할 것. 또는 `secretTokenRef` 미설정 시 최소한 요청 IP 를 Telegram 공식 IP 대역으로 제한하는 보조 검증을 추가하는 것을 검토.

---

### [WARNING] `resolveSigningSecret` — legacy plaintext fallback 이 조용히 허용됨
- **위치**: `notification-webhook.processor.ts:resolveSigningSecret` — `if (typeof refOrLegacy === 'string' && refOrLegacy.length > 0) return refOrLegacy;`
- **상세**: `refOrLegacy` 가 secret store ref 형식(`secret://...`)이 아닌 일반 문자열(기존 plaintext secret)이면 그대로 반환된다. 이 fallback 은 "backfill 불요" 정책을 지원하기 위한 의도적 결정이나, 결과적으로 plaintext 가 JSONB config 에 영구적으로 잔류해도 경고 없이 동작하게 된다. 마이그레이션 완료 여부를 운영자가 파악하기 어렵다.
- **제안**: plaintext fallback 경로 진입 시 `this.logger.warn('legacy plaintext signing secret detected (triggerId=...) — migration to secret store recommended')` 형태의 경고를 기록해, 운영자가 마이그레이션 미완료 trigger 를 추적할 수 있도록 할 것. 일정 기간(예: 다음 릴리즈) 후 이 fallback 경로를 제거하는 계획을 plan 에 명시하는 것도 권장.

---

### [INFO] `secret_store` 테이블 — DB-level FK 미설정으로 orphan row 가능성
- **위치**: `migrations/V063__secret_store.sql`, `spec/conventions/secret-store.md §6`
- **상세**: `workspace_id` 에 FK 없이 application-level cascade 만 정의되어 있다. `TriggersService.remove()` 가 `deleteByPrefix` 를 호출하지만, trigger 삭제 전 예외 발생 시 또는 직접 DB 조작 시 orphan secret row 가 남을 수 있다. orphan row 는 보안 위협이라기보다 데이터 정합성 문제이나, 암호화된 자격증명이 불필요하게 잔류하는 것은 최소 노출 원칙(principle of least privilege)에 반한다.
- **제안**: 운영용 cleanup job 또는 모니터링 쿼리(`SELECT COUNT(*) FROM secret_store ss LEFT JOIN trigger t ON ss.ref LIKE 'secret://triggers/' || t.id || '/%' WHERE t.id IS NULL`)를 추가해 주기적으로 orphan row 를 감지하고 정리하는 루틴을 마련할 것.

---

### [INFO] `rotate-bot-token` — 신 token 을 v2 ref 에 백업 후 primary 교체, Telegram grace 기간 검증 없음
- **위치**: `chat-channel.controller.ts:rotateBotToken`
- **상세**: 코드는 old token 을 v2 ref 에 백업하고 primary ref 를 new token 으로 교체한다. 그러나 Telegram 의 bot token rotation 은 BotFather reset 즉시 구 token 을 무효화하므로, 24h grace 병행 운용이 실제로 Telegram 측에서 지원되지 않는다. 이 점은 코드 주석에서도 언급되어 있다. 즉, v2 ref 에 보관된 old token 은 Telegram 에서 이미 무효화된 상태이며, `chatChannelTokenV2` 컬럼에 저장된 ref 를 실제로 사용하는 코드가 없는 경우 해당 row 는 orphan 상태가 된다.
- **제안**: `chatChannelTokenV2` ref 를 사용하는 경로가 있는지 확인하고, 없다면 해당 row 를 즉시 삭제하거나, 명확한 사용 목적(운영 가시성 / rollback 용)을 코드/spec 에 문서화할 것.

---

### [INFO] `setupChannel` 실패 시 botTokenRef 가 config 에 기록되나 secret store 에는 이미 저장됨
- **위치**: `triggers.service.ts:setupChatChannel` — 실패 catch 블록 내 `fallbackConfig` 저장
- **상세**: `adapter.setupChannel()` 실패 시 `internalCfg`(botTokenRef 포함)를 trigger config 에 저장하지만, `secretTokenRef` 는 아직 저장되지 않은 상태다. 반면 `botToken` plaintext 는 이미 `secrets.rotate(botTokenRef, ...)` 로 secret store 에 저장된 상태이다. 이 상태에서 운영자가 재시도 없이 trigger 를 삭제하면, `TriggersService.remove()` 의 `deleteByPrefix` 가 orphan bot-token secret 을 정리한다. 이 흐름 자체는 허용 가능하나, 실패 후 trigger 가 `degraded` 상태로 유지되는 동안 botTokenRef 가 config 에 존재하므로 webhook 요청이 들어와 resolve 를 시도할 수 있다.
- **제안**: 실패 fallback config 에는 `botTokenRef` 를 포함하되 `chatChannelHealth: 'degraded'` 와 함께 저장하므로 현재 구조상 큰 문제는 없다. 다만 `chatChannelHealth !== 'healthy'` 인 trigger 에 대해 webhook 수신을 차단하는 명시적 가드가 있는지 확인하고, 없다면 추가할 것을 권장.

---

### [INFO] `deleteByPrefix` 에 workspace 소유권 검증 없음
- **위치**: `secret-resolver.service.ts:deleteByPrefix`
- **상세**: `deleteByPrefix('secret://triggers/{id}/')` 는 `workspace_id` 필터 없이 prefix 매칭으로 삭제한다. 현재 호출자(`TriggersService.remove`)는 먼저 `findById(id, workspaceId)` 로 소유권을 검증하므로 실질적 취약점은 없다. 그러나 `deleteByPrefix` 자체가 workspace 격리를 강제하지 않으므로, 향후 다른 호출자가 소유권 검증 없이 이 함수를 호출할 경우 다른 workspace 의 secret 을 삭제할 수 있다.
- **제안**: `deleteByPrefix(prefix: string, workspaceId?: string)` 형태로 선택적 workspace 필터를 추가하거나, 최소한 JSDoc 에 "호출자가 반드시 소유권을 사전 검증해야 한다"는 주의를 명시할 것.

---

### [INFO] 의존성 보안 — `chokidar@3.6.0` (optional/peer)
- **위치**: `codebase/backend/package-lock.json` — `@nestjs-modules/mailer/node_modules/chokidar@3.6.0`
- **상세**: `chokidar` 는 파일 감시 라이브러리로, `optional: true, peer: true` 로 표시되어 있어 런타임에 직접 로드되지 않을 가능성이 높다. 3.6.0 버전에서 알려진 CVE 는 현재(2026-05 기준) 미확인이나, 이 버전이 `@nestjs-modules/mailer` 의 peer 의존성으로 고정되어 있는 점은 추적이 필요하다.
- **제안**: `npm audit` 실행 결과를 정기적으로 확인하고, optional/peer 의존성도 포함한 취약점 스캔(예: Snyk, Dependabot)을 CI 에 연동할 것.

---

## 요약

본 변경은 Chat Channel(Telegram bot token, webhook secret) 및 EIA(notification HMAC signing secret)의 자격증명을 JSONB 평문 보관에서 application-side AES-256-GCM 암호화 secret store 로 전환하는 보안 개선 PR 이다. 암호화 알고리즘 선택(AES-256-GCM + AEAD), IV 매 호출 랜덤 발급, AAD 를 ref 로 설정해 cross-row 교체 공격 차단, 부팅 시 fail-fast 검증 등 핵심 설계는 양호하다. 다만 몇 가지 보완 사항이 존재한다. `assertRefFormat` 에러 메시지에 잘못 입력된 plaintext 가 노출될 수 있는 점(WARNING), `secretTokenRef` 미설정 시 Telegram webhook 인증이 완전 skip 되는 점(WARNING), legacy plaintext fallback 이 경고 없이 조용히 동작하는 점(WARNING)은 단기 개선이 필요하다. 마스터키 메모리 상주 및 공용 키 재사용, `deleteByPrefix` LIKE 메타문자 미이스케이프, orphan row 가능성 등은 중장기 개선 항목으로 추적할 것을 권장한다. 전체적으로 plaintext 자격증명이 config JSONB, 로그, API 응답에서 제거되는 방향의 변경은 올바르며 즉각적인 차단 사유는 없다.

---

## 위험도

MEDIUM
