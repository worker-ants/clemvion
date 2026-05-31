---
id: secret-store
status: implemented
code:
  - codebase/backend/src/modules/secret-store/**
---

# CONVENTION: Secret Store (자격증명·시크릿 보관 추상화)

> 관련 문서: [Spec Chat Channel §3.4](../5-system/15-chat-channel.md#34-신뢰성--보안) · [Spec EIA §7.1](../5-system/14-external-interaction-api.md#71-trigger-엔티티-확장) · [Spec Webhook §8](../5-system/12-webhook.md#8-보안-고려사항) · [Spec 데이터 모델](../1-data-model.md)

본 컨벤션은 외부 provider 자격증명 (텔레그램 bot token, webhook secret_token, notification HMAC signing secret 등) 의 보관 추상화를 정의한다. 모든 도메인 모듈 (chat-channel / external-interaction / 향후 cafe24·OAuth 등) 은 본 convention 의 `SecretResolver` 를 경유해 secret 을 읽고 쓴다.

---

## 1. URI Scheme

```
secret://<scope>/<resourceId>/<name>
```

| 부분 | 의미 | 규칙 |
|---|---|---|
| `scope` | 자원 namespace | lower-case kebab-case (예: `triggers`, `oauth-clients`). `auth-configs` 는 향후 확장 여지일 뿐 현재 미사용 — 아래 "비대상" 참고 |
| `resourceId` | 자원 식별자 | UUID v4 또는 별 spec 의 ID 형식 |
| `name` | 자원 안의 secret 이름 | lower-case kebab-case (예: `bot-token`, `inbound-signing`, `notification-signing`, `bot-token.v2`) |

예시:

| ref | 용도 |
|---|---|
| `secret://triggers/{triggerId}/bot-token` | Chat Channel adapter 의 봇 토큰 (provider 공통 — Telegram bot token / Slack `xoxb-*` / Discord bot token 등) |
| `secret://triggers/{triggerId}/bot-token.v2` | 봇 토큰 (rotation grace) |
| `secret://triggers/{triggerId}/inbound-signing` | Chat Channel inbound webhook 출처 검증용 자료 (provider 공통 슬롯). provider 별 의미: Telegram = server-issued shared secret (`setWebhook.secret_token`, 어댑터가 randomBytes 발급) / Slack = HMAC-SHA256 signing secret (Slack 발급, 사용자 입력) / Discord = ed25519 application public key (Discord 발급, 사용자 입력). 검증 알고리즘 분기는 backend 의 provider 별 책임 — ref 슬롯은 단일. SoT: [`conventions/chat-channel-adapter.md §2.3`](./chat-channel-adapter.md#23-chatchannelconfig) |
| `secret://triggers/{triggerId}/notification-signing` | EIA notification HMAC signing secret |
| `secret://triggers/{triggerId}/notification-signing.v2` | EIA HMAC signing (rotation grace) |

`name` 안에 `.v2` 접미사는 [CCH-SE-04](../5-system/15-chat-channel.md#34-신뢰성--보안) / [EIA-NX-12](../5-system/14-external-interaction-api.md#31-outbound-notification-notification-webhook) 의 24h grace rotation 기간 동안 병행 보관용. primary 와 동일 자원의 변형이라는 의미를 keep.

> **비대상 — `AuthConfig.config`**: `AuthConfig` ([Spec 데이터 모델 §2.17](../1-data-model.md#217-authconfig)) 의 자격증명은 `auth-configs` 모듈 자체의 컬럼 transformer (Integration `credentials` 와 동일 `ENCRYPTION_KEY`·AES-256-GCM) 가 직접 암복호화한다. 본 `secret://` URI scheme 의 통합 대상이 **아니다**. 응답 마스킹 정책의 단일 진실도 본 convention 이 아니라 [Spec 데이터 모델 §2.17.2](../1-data-model.md#2172-마스킹노출-정책) 다.

---

## 2. `SecretResolver` 인터페이스

```typescript
interface SecretResolver {
  /** ref 로 plaintext 조회. 미존재 시 throw. 정상 동작 경로에서만 호출 (config 가 ref 를 보유) */
  resolve(ref: string): Promise<string>;

  /** plaintext 를 ref 로 저장. 이미 존재하면 throw (대신 rotate 사용) */
  store(ref: string, workspaceId: string, plaintext: string): Promise<void>;

  /** ref 의 plaintext 를 newPlaintext 로 교체 (UPSERT 의미) */
  rotate(ref: string, workspaceId: string, newPlaintext: string): Promise<void>;

  /** ref 삭제. 미존재 ref 는 noop */
  delete(ref: string): Promise<void>;

  /** ref 존재 여부 확인 (validation 용) */
  exists(ref: string): Promise<boolean>;
}
```

### 2.1 호출 규약

| 시점 | 의무 호출 |
|---|---|
| Trigger 생성 (notification / chatChannel 설정 포함) | **`rotate(ref, workspaceId, plaintext)` 권장** — UPSERT 멱등성으로 setup 재시도 안전 (§5.5 예시 + `triggers.service.ts.setupChatChannel` 구현체 모두 `rotate()` 사용). `store()` 도 동일 결과를 내지만, 동일 ref 가 이미 있을 때 `store()` 의 동작 (덮어쓰기 vs throw) 은 backend 구현 변경에 취약 — `rotate()` 의 명시적 UPSERT 시맨틱이 안전 |
| Trigger 삭제 | 해당 trigger 의 모든 ref 를 `deleteByPrefix('secret://triggers/{id}/')` 로 일괄 삭제 (cascade 차원 — DB FK 가 없으므로 application 책임). 개별 `delete()` 보다 prefix 패턴 권장 |
| 외부 API 호출 직전 (sendMessage, HMAC 서명 등) | `resolve(ref)` — 매 호출 마다 fetch (캐싱은 SecretResolver 내부 결정) |
| Secret rotation API | `rotate(refV2, workspaceId, newPlaintext)` |

### 2.1.1 DIP 인터페이스 — v1 면제

소비자 모듈은 구체 클래스(`SecretResolverService`) 가 아닌 추상 인터페이스에 의존해야 한다는 것이 일반 원칙이나, **v1 구현에서는 NestJS DI 편의상 구체 클래스를 직접 inject 하는 것이 허용된다**.

**v1 면제 사유**:
- 단일 구현체 (`SecretResolverService`) 만 존재 — 교체 가능성 없음
- NestJS DI 에서 abstract class 사용 시 추가 injection token 설정 필요
- `deleteByPrefix` 포함 전체 메서드 시그니처 안정화 전

**v2 행동 항목** (복수 backend 도입 시 trigger):
- `ISecretResolver` abstract class 또는 interface 추출
- 5개 소비자 모듈 (triggers / hooks / chat-channel / external-interaction / app) 의 injection token 교체
- 테스트 mock 도 인터페이스 기반으로 교체

### 2.2 부작용 / 멱등성

| 함수 | 부작용 | 멱등성 |
|---|---|---|
| `resolve` | DB SELECT 1회 | pure (read-only) |
| `store` | DB INSERT | non-idempotent (중복 ref 는 throw — duplicate detect) |
| `rotate` | DB UPSERT | idempotent — 같은 ref + 같은 plaintext 재호출 OK |
| `delete` | DB DELETE | idempotent — 미존재 ref 는 noop |
| `exists` | DB SELECT 1회 | pure |

---

## 3. 저장 백엔드 (v1)

### 3.1 PostgreSQL + 백엔드 AES-256-GCM

v1 은 **Node.js `crypto` 모듈의 AES-256-GCM** 으로 application-side 에서 직접 암복호화하고 PostgreSQL 은 ciphertext 만 저장한다. 별 인프라 의존 없이 self-hosting 단일 PostgreSQL 만으로 동작 — 본 프로젝트의 self-serving 운영을 가능케 하는 선택.

```sql
CREATE TABLE secret_store (
  ref          TEXT PRIMARY KEY,                    -- secret://<scope>/<resourceId>/<name>
  workspace_id UUID NOT NULL,
  encrypted    BYTEA NOT NULL,                       -- [IV(12B) || ciphertext || authTag(16B)] concat
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_secret_store_workspace_id ON secret_store(workspace_id);
```

### 3.2 암호화 형식

- **알고리즘**: AES-256-GCM (AEAD — tamper detection 내장).
- **IV**: 12 byte random `crypto.randomBytes(12)` — 매 `store` / `rotate` 호출마다 새로 발급.
- **AAD**: `ref` 문자열 자체를 additional authenticated data 로 사용 — DB 에서 row 가 다른 ref 로 교체되는 cross-row 공격 차단.
- **인코딩**: `BYTEA` 컬럼에 `[IV(12B) ‖ ciphertext ‖ authTag(16B)]` raw concat.

```typescript
// 암호화
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
cipher.setAAD(Buffer.from(ref, 'utf8'));
const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();
const encrypted = Buffer.concat([iv, ct, tag]);   // BYTEA 컬럼에 저장

// 복호화
const iv = encrypted.subarray(0, 12);
const tag = encrypted.subarray(encrypted.length - 16);
const ct = encrypted.subarray(12, encrypted.length - 16);
const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
decipher.setAAD(Buffer.from(ref, 'utf8'));
decipher.setAuthTag(tag);
const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
```

### 3.3 마스터키

- 환경변수 **`ENCRYPTION_KEY`** (재사용 — [LLM API key 암호화](../../codebase/backend/src/common/utils/crypto.util.ts) 와 동일 키). 입력 형식:
  - 정확 64-char hex → `Buffer.from(rawHex, 'hex')` 그대로 사용 (`.env.example` 의 표준).
  - 그 외 임의 길이 문자열 → SHA-256 derive (`INTEGRATION_ENCRYPTION_KEY` / `credentials-transformer.ts` 와 동일 패턴) — e2e / 짧은 키 호환.
  - 부팅 시 미설정 / 빈 문자열이면 fail-fast (`SecretResolver` 모듈 init 단계에서 throw).
- 마스터키는 **application 메모리 안에서만 존재** — DB query / SQL parameter / 로그 / metric 에 일절 노출되지 않는다. PostgreSQL 은 ciphertext 만 본다.
- 자체 호스팅 사용자는 운영 자체적으로 키 보관 (예: docker-compose `env_file`, kubernetes secret, AWS Parameter Store 등).
- 키 생성 예: `openssl rand -hex 32`.
- **재사용 근거**: 기존 `ENCRYPTION_KEY` 의 사용처 (LLM API key) 와 본 secret store 의 사용처 (외부 provider 자격증명) 가 동일 신뢰 영역 (둘 다 외부 API 자격증명 평문). 도메인 분리 이득보다 ops 단순화 이득이 우위. 향후 도메인 분리가 필요해지면 별 `ENCRYPTION_KEY_SECRET_STORE` env 도입 검토.

### 3.4 다른 백엔드로의 swap

`SecretResolver` interface 자체는 PostgreSQL 결합 없음. 향후 AWS Secrets Manager / HashiCorp Vault 등이 필요해지면 별 `AwsSecretsManagerResolver` / `VaultResolver` 구현을 추가하고 `ConfigModule` 에서 환경별 swap. 본 convention 변경 없음.

---

## 4. 보안 요구사항

| ID | 요구사항 | 우선순위 |
|---|---|---|
| SS-SE-01 | plaintext / 마스터키 는 application 메모리 안에서만 존재. DB query / SQL parameter / log / metric 에 일절 노출 금지 — DB 는 항상 ciphertext 만 본다 | 필수 |
| SS-SE-02 | 매 `store` / `rotate` 호출은 새 random IV (12 byte) 발급. IV 재사용 절대 금지 — AES-GCM 의 nonce reuse 는 catastrophic | 필수 |
| SS-SE-03 | AAD = `ref` — `setAAD(Buffer.from(ref))`. cross-row 교체 공격 (다른 ref 의 ciphertext 를 본 row 에 덮어쓰기) 시 복호화 실패 보장 | 필수 |
| SS-SE-04 | 마스터키 미설정 / 길이 불일치 시 부팅 fail-fast — 운영 사고 (배포 환경의 secret 누락) 가시화 | 필수 |
| SS-SE-05 | DB row 단위 audit log 는 v1 미지원 — application logger 가 `resolve` 실패 시 ref + workspaceId 만 기록 (plaintext 미기록) | 필수 |
| SS-SE-06 | `resolve(ref)` 결과는 caller 에서 사용 후 GC 의존 (Node.js 의 `Buffer.fill(0)` 등 강제 wipe 는 v1 미적용 — v2 옵션) | 권장 |

---

## 5. 사용 패턴

### 5.1 Trigger 생성 시

```typescript
async createTrigger(dto: CreateTriggerDto, workspaceId: string) {
  const trigger = await this.repo.save({ ...dto, workspaceId });
  if (dto.notification?.signing?.secret) {
    const ref = `secret://triggers/${trigger.id}/notification-signing`;
    await this.secrets.store(ref, workspaceId, dto.notification.signing.secret);
    trigger.config.notification.signing = { algorithm: dto.notification.signing.algorithm, secretRef: ref };
    await this.repo.save(trigger);
  }
  if (dto.chatChannel?.botToken) {
    const ref = buildSecretRef({ scope: 'triggers', resourceId: trigger.id, name: 'bot-token' });
    // setup 경로는 재시도 안전성을 위해 rotate() (UPSERT) 사용 — §2.1 의 허용 규약.
    await this.secrets.rotate(ref, workspaceId, dto.chatChannel.botToken);
    // DTO 의 botToken plaintext 는 config 에 흘리지 않음 — botTokenRef 만 보관.
    trigger.config.chatChannel = {
      provider: dto.chatChannel.provider,
      botTokenRef: ref,
      uiMapping: dto.chatChannel.uiMapping,
      rateLimitPerMinute: dto.chatChannel.rateLimitPerMinute,
      languageHints: dto.chatChannel.languageHints,
    };
    await this.repo.save(trigger);
  }
}
```

### 5.2 외부 API 호출 시

```typescript
async sendMessage(message: ChannelMessage, config: ChatChannelConfig) {
  const token = await this.secrets.resolve(config.botTokenRef);
  return this.client.sendMessage(token, message);
}
```

### 5.3 Trigger 삭제 시 — prefix 일괄 삭제

```typescript
async removeTrigger(triggerId: string) {
  // 개별 ref delete 보다 prefix 패턴 권장 — 추가 secret (예: future 'mcp-token') 도 자동 정리.
  await this.secrets.deleteByPrefix(`secret://triggers/${triggerId}/`);
  await this.repo.delete(triggerId);
}
```

### 5.4 Rotation 시

```typescript
async rotateBotToken(triggerId: string, newToken: string, workspaceId: string) {
  const refV2 = buildSecretRef({ scope: 'triggers', resourceId: triggerId, name: 'bot-token.v2' });
  await this.secrets.rotate(refV2, workspaceId, newToken);  // grace 기간 신규 token
  // 24h 후 cron 이 v2 → primary 승격 + v2 row 삭제. 구현: ChatChannelTokenRotatorService.
}
```

### 5.5 Chat Channel `inboundSigningRef` 초기화 — provider 두 경로

`inbound-signing` 자원은 provider 별로 두 가지 초기화 경로가 있다 — `setupChannel` 의 결과 (server-issued, Telegram) 와 사용자 입력 (provider-issued, Slack / Discord). 둘 다 동일 ref slot (`secret://triggers/{id}/inbound-signing`) 로 보관한다.

```typescript
// (a) server-issued — Telegram 등 adapter 의 setupChannel 이 randomBytes 로 발급
async setupChatChannel(trigger: Trigger, workspaceId: string) {
  const adapter = this.registry.get(trigger.config.chatChannel.provider);
  const result = await adapter.setupChannel(trigger.config.chatChannel, callbackUrl);
  // configUpdates 안에 plaintext 흘리지 않고 issuedInboundSigning 으로 분리 (Convention §2.4)
  if (result.issuedInboundSigning) {
    const ref = buildSecretRef({ scope: 'triggers', resourceId: trigger.id, name: 'inbound-signing' });
    await this.secrets.rotate(ref, workspaceId, result.issuedInboundSigning);  // setup 재시도 안전성 (§2.1)
    trigger.config.chatChannel.inboundSigningRef = ref;
  }
  Object.assign(trigger.config.chatChannel, result.configUpdates ?? {});
  await this.repo.save(trigger);
}

// (b) provider-issued — Slack signing secret / Discord public key, 사용자 manual 입력
async createChatChannelTrigger(dto: CreateTriggerDto, workspaceId: string) {
  const trigger = await this.repo.save({ ...dto, workspaceId });
  if (dto.chatChannel?.inboundSigningPlaintext) {  // DTO 한정 입력 필드 (plaintext)
    const ref = buildSecretRef({ scope: 'triggers', resourceId: trigger.id, name: 'inbound-signing' });
    await this.secrets.rotate(ref, workspaceId, dto.chatChannel.inboundSigningPlaintext);
    // DTO 의 plaintext 는 config 에 흘리지 않음 — inboundSigningRef 만 보관.
    trigger.config.chatChannel.inboundSigningRef = ref;
    await this.repo.save(trigger);
  }
  // 이어서 setupChatChannel(trigger) 호출 — (a) 경로의 issuedInboundSigning 은 비어 있음
}
```

두 경로의 공존은 `inboundSigningRef` 단일 slot 이 backend 의 provider 분기로 흡수한다는 의미 — Convention §2.3 의 표 참조.

---

## 6. Trigger 삭제 시 cascade

`SecretStore` 테이블은 `trigger` 테이블의 FK 를 갖지 않는다 (cross-scope 의 미래 확장을 위해 namespace 만 분리). Trigger 삭제 시 application 이 `secret://triggers/{id}/*` ref 를 명시적으로 `delete()` 호출 — `TriggersService.delete()` 의 의무.

`workspace_id` 컬럼은 workspace 삭제 시 cascade 정리용 (`DELETE FROM secret_store WHERE workspace_id = $1`).

---

## 7. 변경 관리

본 컨벤션은 `SecretResolver` interface 의 변경 시 모든 호출자 (triggers / chat-channel / external-interaction / 향후 cafe24) 의 동시 갱신이 필요하다. interface 변경 PR 은 callers 의 동시 수정을 강제한다.

새 secret type (예: `oauth-client-secret`) 추가 시:
1. 본 §1 의 예시 표에 새 `name` 행 추가
2. 호출 모듈의 spec 본문에 ref 형식 명시

---

## Rationale

### R1. Application-side AES-256-GCM 채택

**Application-side AES-256-GCM (Node `crypto`)** 를 채택한다 — 마스터키가 app↔DB 경계를 절대 넘지 않음. DB 는 ciphertext 만 봄 (DBA 도 복호화 불가). PostgreSQL extension 의존성 0 — managed PG (Heroku 등) 환경 호환성 ↑. AEAD 의 auth tag 로 tamper detection 내장. 단위 테스트 시 DB 의존성 없음.

근거: 마스터키가 app 메모리 밖으로 나가지 않는 경계 분리가 self-hosting 환경에서 더 큰 보안 이득. PostgreSQL 의 운영 변경 (extension 활성화 / 재시작) 없이 도입 가능. 향후 enterprise 사용자 요청 시 §3.4 swap 으로 확장.

### R2. URI scheme 의 `<scope>` 분리

`secret://<scope>/<resourceId>/<name>` 를 채택한다 — 다른 도메인 자원 (cafe24 access token 등) 도 같은 store 공유 가능. namespace 충돌 없음.

근거: 향후 OAuth client secret, cafe24 access token 등의 통합 가능성 + namespace 명확성.

### R3. `.v2` 접미사로 rotation grace 표현

`name.v2` 를 채택한다 — 같은 자원의 변형임을 name 안에 명시. `bot-token` ↔ `bot-token.v2` 시각적 묶임.

근거: name 안에서 분리하면 ref string 자체로 의도 명확. `resolve('secret://triggers/{id}/bot-token')` vs `resolve('secret://triggers/{id}/bot-token.v2')` 둘 다 명시적.

### R4. Trigger FK 미설정

`secret_store.workspace_id` 는 workspace FK 를 가질 수 있으나 본 spec 은 application-level cascade 만 정의 — 향후 다른 scope (예: workspace 외부의 system-wide secret) 도 같은 테이블에 두려면 FK 가 제약. trigger 삭제 시의 명시적 cleanup 책임은 `TriggersService.delete()` 가 진다. `ON DELETE CASCADE` 는 채택하지 않는다 — implicit DB 동작과 explicit application 동작이 섞이면 추적이 어려워지기 때문.
