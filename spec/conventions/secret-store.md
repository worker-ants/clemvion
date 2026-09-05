---
id: secret-store
status: implemented
code:
  - codebase/backend/src/modules/secret-store/**
---

# CONVENTION: Secret Store (자격증명·시크릿 보관 추상화)

> 관련 문서: [Spec Chat Channel §3.4](../5-system/15-chat-channel.md#34-신뢰성--보안) · [Spec EIA §7.1](../5-system/14-external-interaction-api.md#71-trigger-엔티티-확장) · [Spec Webhook §8](../5-system/12-webhook.md#8-보안-고려사항) · [Spec 데이터 모델](../1-data-model.md)

본 컨벤션은 외부 provider 자격증명 (텔레그램 bot token, webhook secret_token, notification HMAC signing secret 등) 의 보관 추상화를 정의한다. 모든 도메인 모듈 (chat-channel / external-interaction / 향후 cafe24·OAuth 등) 은 본 convention 의 `SecretResolver` 를 경유해 secret 을 읽고 쓴다 — **[§1 하단의 필드 단위 명시적 비대상 예외](#1-uri-scheme)는 제외**하며, 그 예외는 각각 자기 근거를 갖는다 (다른 예외의 근거를 재사용하지 않는다).

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
| `secret://triggers/{triggerId}/notification-signing.v2` | EIA HMAC signing (rotation grace). **현행 구현은 이 ref 를 쓰지 않는다** — grace 동안의 신규 secret 은 `Trigger.notification_secret_v2` 컬럼에 평문으로 두고, 승격 시 canonical ref(`notification-signing`)를 회전한다. 아래 비대상 3번째 항목 참조 |

`name` 안에 `.v2` 접미사는 [CCH-SE-04](../5-system/15-chat-channel.md#34-신뢰성--보안) / [EIA-NX-12](../5-system/14-external-interaction-api.md#31-outbound-notification-notification-webhook) 의 24h grace rotation 기간 동안 병행 보관용. primary 와 동일 자원의 변형이라는 의미를 keep.

> **비대상 — `AuthConfig.config`**: `AuthConfig` ([Spec 데이터 모델 §2.17](../1-data-model.md#217-authconfig)) 의 자격증명은 `auth-configs` 모듈 자체의 컬럼 transformer (Integration `credentials` 와 동일 `ENCRYPTION_KEY`·AES-256-GCM) 가 직접 암복호화한다. 본 `secret://` URI scheme 의 통합 대상이 **아니다**. 응답 마스킹 정책의 단일 진실도 본 convention 이 아니라 [Spec 데이터 모델 §2.17.2](../1-data-model.md#2172-마스킹노출-정책) 다.

> **비대상 — `Trigger.config.interaction.triggerToken`** (결정 2026-08-16): per-trigger interaction 토큰(`itk_*`)은 `Trigger.config` JSONB 에 **평문**으로 보관하며 `secret://` 통합 대상이 아니다.
>
> **위 `AuthConfig.config` 예외와 같은 종류가 아니다.** 그쪽은 *"다른 메커니즘으로 **동등하게 암호화**된다"* 가 근거지만, 이 필드는 **암호화 자체가 없다.** 근거를 따로 세운다 — (a) 요청마다 검증하는 **hot-path bearer 토큰**이라 `secret_store` 경유 시 매 요청 복호화 또는 별도 캐시 계층이 필요하다(**비용 근거이지 필요성 근거가 아니다** — 아래 반례 참조), (b) revoke 가 **값 교체(rotation)** 로 즉시 무효화되어 `secret_store` 의 버전 관리 이점이 작다, (c) 값 공간이 서버 발급 랜덤 hex(`itk_` + 32 bytes)로 닫혀 있고 발급 응답에 **1회만** 노출되므로, 사용자가 입력한 외부 서비스 자격증명과 위험 프로파일이 다르다 (유출 시 영향 범위가 해당 트리거 하나로 한정된다).
>
> **(a) 를 "평문이 필수" 로 읽으면 안 된다 — 반례가 있다**: 토큰을 **해시로 저장하고 해시끼리 `crypto.timingSafeEqual`** 로 비교하면 동일한 성능·타이밍 안전성을 얻는다(`17_12_34`·`18_14_50` security INFO 가 지적). 즉 평문 보관은 **불가피한 것이 아니라** 현행 구현의 선택이며, 이 예외를 지탱하는 실질 근거는 (c) 다. "해시 저장 + timing-safe 비교" 전환은 유효한 후속 개선안으로 열어 둔다.
>
> **이 블록을 "평문 보관 일반의 선례" 로 인용하면 안 된다** — (a)~(c) 를 함께 만족하지 않는 세 번째 필드가 같은 문단을 근거로 예외를 얻는 것이 이 등재의 실패 모드다.
>
> **같은 `Trigger.config` 안의 `notification.signing.secretRef` 는 `SecretResolver` 를 경유한다** — 한 객체 안의 이 비대칭은 의도된 것이고 위 (a)~(c) 가 그 사유다 (그쪽은 사용자 입력 HMAC secret 이라 (c) 를 만족하지 않는다). 표면 서술은 [EIA §7.1](../5-system/14-external-interaction-api.md) 이 SoT 다.

> **비대상 — `Trigger.notification_secret_v2`** (결정 2026-09-05): EIA HMAC signing secret 의
> rotation grace(24h) 동안의 **신규 secret 을 컬럼에 평문으로** 보관하며 `secret://` 통합
> 대상이 아니다. 발송 측은 이 값을 secondary 서명 키로 **직접** 쓴다(primary 는 `secretRef`
> 경유). 표면 서술은 [EIA §7.1](../5-system/14-external-interaction-api.md) 이 SoT 다.
>
> **위 `itk_*` 문단의 (a)~(c) 를 근거로 삼지 않는다** — 그 문단 자신이 *"(a)~(c) 를 함께
> 만족하지 않는 세 번째 필드가 **같은 문단을 근거로** 예외를 얻는 것이 이 등재의 실패
> 모드"* 라 경고한다. 이 필드의 근거는 따로 세운다:
>
> 1. **평문이 종착지가 아니라 경유지다.** 승격되면 값은 `secrets.rotate` 로 secret store 에
>    들어가고 컬럼은 `null` 로 초기화된다
>    ([data-flow §1.5 승격 경로](../data-flow/15-external-interaction.md)). `AuthConfig.config`
>    (영구·암호화)·`itk_*`(영구·평문) 어느 쪽과도 다른 세 번째 형태다.
> 2. **노출 창이 정책으로 닫혀 있다** — grace 종료 cron 이 컬럼을 정리한다.
> 3. **서버 발급·영향 범위가 트리거 하나** — `wsk_` + `randomBytes(32)` 이고 사용자가
>    입력한 외부 자격증명이 아니다.
>
>    > **노출 창은 아직 설계대로 닫혀 있지 않다.** 정책상 평문이 나가는 자리는 rotate
>    > 응답 1회지만, **현행 구현은 `GET/POST/PATCH /api/triggers` 와 `GET /api/schedules`
>    > (트리거 조인) 응답에도 이 컬럼을 그대로 싣는다** — 엔티티를 그대로 반환하는데
>    > 컬럼 단위 스트립이 없기 때문이다(전역 `ClassSerializerInterceptor`·`select:false`·
>    > `@Exclude()` 모두 없음). 즉 grace 24h 동안 **매 요청** 노출된다.
>    >
>    > **이 등재는 그 상태를 승인하지 않는다.** 예외의 대상은 *"컬럼에 평문으로 보관"*
>    > 이지 *"응답에 실어도 된다"* 가 아니다 — 아래 §1.1 이 그 경계를 규범으로 적는다.
>    > 유출을 닫는 코드 수정은 `plan/in-progress/spec-draft-nullable-notation-followups.md`
>    > 가 추적한다.
> 4. **primary 경로는 그대로다** — 이 예외는 grace 창의 secondary 키에만 적용되며
>    `signing.secretRef` 정책을 건드리지 않는다.
>
### 1.1 비대상 필드도 **응답 바디에는 나가지 않는다**

위 비대상 등재는 **저장 위치**에 대한 예외이지 **노출**에 대한 예외가 아니다. `secret://`
밖에 사는 필드(`AuthConfig.config` 자격증명 · `Trigger.config.interaction.triggerToken` ·
`Trigger.notification_secret_v2`)와 secret store ref(`Trigger.chat_channel_token_v2` ·
`config.*.botTokenRef` · `config.notification.signing.secretRef`)는 **응답 DTO 에 선언되어서도,
응답 바디에 실려서도 안 된다.**

- ref 도 대상이다 — 평문은 아니지만 내부 저장 위치를 드러낸다.
- 시행 축은 두 개다: [API 규약 §5.4](../5-system/2-api-convention.md) 의 **응답-계약 검증**
  (선언되지 않은 키를 위반으로 본다)과 [Swagger 규약 §5-1](./swagger.md) 의 **엔티티
  패스스루 금지**.
- 엔티티를 그대로 반환하는 경로에서는 **응답 경계에서 지운다**. 컬럼 수준
  (`select: false`)은 그 컬럼을 읽는 내부 경로(회전 승격·정리 스윕)가 예외 없이 `undefined`
  를 받아 **조용히 오작동**하므로 쓰지 않는다.

> 이 절은 2026-09-05 에 추가됐다. 그 전까지 *"이 컬럼들이 응답에 나가면 안 된다"* 는 요구가
> `spec/**` 어디에도 정규 문장으로 없었고(실측 0건), 실제로 두 엔드포인트에서 나가고 있었다.

---

> **다음 필드가 이 문단을 인용하려면 (1) 을 만족해야 한다** — "승격되어 store 로 들어가고
> 컬럼이 비워지는가". 그 조건 없이 이 문단을 "평문 보관 일반의 선례" 로 쓰는 것이 이
> 등재의 실패 모드다 (위 `itk_*` 문단과 같은 취지).

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
| Trigger 삭제 | 해당 trigger 의 모든 ref 를 `deleteByPrefix('secret://triggers/{id}/')` 로 일괄 삭제 (cascade 차원 — DB FK 가 없으므로 application 책임). 개별 `delete()` 보다 prefix 패턴 권장. **prefix 불변식 2건**: `secret://` 로 시작해야 하고, LIKE 메타문자(`%`·`_`·`\`)를 포함하면 **throw** 한다 (아래 † 참조) |
| 외부 API 호출 직전 (sendMessage, HMAC 서명 등) | `resolve(ref)` — 매 호출 마다 fetch (캐싱은 SecretResolver 내부 결정) |
| Secret rotation API | `rotate(refV2, workspaceId, newPlaintext)` |

> **† `deleteByPrefix` 의 LIKE 메타문자 거부 (2026-08-09)**: 구현이 prefix 를 `ref LIKE :prefix`
> (`` `${prefix}%` ``) 로 쓴다. TypeORM 파라미터 바인딩이라 **SQL 인젝션은 아니지만**, prefix 에
> `%`(임의 문자열)·`_`(임의 1글자)가 섞이면 **의도보다 넓게 지워진다** — 삭제는 되돌릴 수 없어
> 방향이 나쁘다. `\`(LIKE 이스케이프 문자)도 같은 이유로 막는다.
>
> **이스케이프(`\%` + `ESCAPE` 절)가 아니라 거부인 이유**: 이 API 의 prefix 는 내부에서 조립하는
> **식별자 경로**라 메타문자가 정당하게 필요한 경우가 없다 — §1 URI Scheme 의
> `secret://<scope>/<id>/<name>` 구조 자체가 메타문자를 배제한다. 이스케이프는 없는 유스케이스를
> 위해 표면을 넓히는 쪽이다.
>
> **"지금은 안전하다" 를 주석으로만 두지 않은 이유**: 도입 시점 프로덕션 호출부는
> `triggers.service.ts` 한 곳(`secret://triggers/${trigger.id}/`, `trigger.id` 는
> `@PrimaryGeneratedColumn('uuid')` 라 메타문자 불가)뿐이었다(전수 확인). 그러나 그 안전은
> **호출부 목록이 그대로일 때만** 참이라, 사용자 입력이 섞인 prefix 를 넘기는 호출부가 하나
> 생기면 주석은 아무것도 막지 못한다. 기존 `secret://` 접두사 검사와 같은 형태로 **입력 자체를
> 거부**해 그 조건을 없앴다.
>
> **검증은 두 층으로 갈라 고정한다**: 이 불변식의 근거("메타문자가 섞이면 실 DB 가 의도보다 넓게
> 지운다")는 단위 테스트의 in-memory mock 으로 재현할 수 없다 — 그 mock 은 `startsWith` 로 대상을
> 고르므로 와일드카드 패턴에서 실제보다 **적게** 지운다. 방향이 정반대라 과다삭제를 오히려 감춘다.
> mock 에 LIKE 해석기를 심는 선택지는 **테스트가 DB 를 흉내 내다 틀릴** 새 위험을 만들어 채택하지
> 않았다. 대신:
>
> - **와일드카드 의미론**은 실 Postgres 가 고정한다 — `_` 를 섞은 prefix 가 이웃 리소스까지
>   지우는 것을 "리터럴로 해석하면 0건, 실제로는 2건" 으로 단언한다
>   (`codebase/backend/test/secret-store-like-prefix.e2e-spec.ts`).
> - **그 의미론이 이 API 에 적용된다는 사실**은 단위가 고정한다 — 쿼리가 `ref LIKE :prefix` 이고
>   바인딩이 `` `${prefix}%` `` 이며 `ESCAPE` 절이 **없다**는 쿼리 형태 단언
>   (`secret-resolver.service.spec.ts`). `ESCAPE` 가 붙는 순간 메타문자가 리터럴이 되어 이 불변식의
>   전제 자체가 무효가 되므로, 그 부재도 계약의 일부다.
>
> 둘 중 하나가 깨지면 나머지의 전제도 다시 봐야 한다. 단위 mock 은 자기 전제("패턴에 메타문자가
> 없다" — 위 가드가 세워 준다)를 직접 단언하므로, 가드가 제거되면 스위트가 조용히 통과하는 대신
> 실패한다.

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

-- ref 형식 DB 가드 (V063 migration) — application 검증과 별개로 corrupt row 방지 (§1 URI scheme 강제).
ALTER TABLE secret_store
  ADD CONSTRAINT chk_secret_store_ref_format
  CHECK (ref ~ '^secret://[a-z][a-z0-9-]*/[^/]+/[a-z0-9][a-z0-9.-]*$');

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
  - 정확 64-char hex → `Buffer.from(rawHex, 'hex')` 그대로 사용 (`.env.example` 의 표준 형식).
  - 그 외 임의 길이 문자열 → SHA-256 derive (`INTEGRATION_ENCRYPTION_KEY` / `credentials-transformer.ts` 와 동일 패턴) — e2e / 짧은 키 호환.
  - 부팅 시 미설정 / 빈 문자열이면 fail-fast (`SecretResolver` 모듈 init 단계에서 throw).
  - **`.env.example` 의 값은 형식 예시(all-zero placeholder)일 뿐 실 키가 아니다** — 운영자는 `openssl rand -hex 32` 로 새로 생성해야 한다 (refactor 04 M-4). `NODE_ENV=production` 에서 미설정이거나 **공개 `.env.example` 예시 키**(현 all-zero 및 옛 `0123…` 예시)가 그대로 설정돼 있으면 부팅을 거부한다 (`main.ts` 의 `assertProductionConfig` — "secret store 가 사실상 평문" 인 운영 사고 차단). dev/test/e2e(`NODE_ENV≠production`)는 영향 없다.
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
  // 24h 후 정기 배치(ChatChannelTokenRotatorService, BullMQ)가 v2 → primary 승격 + v2 row 삭제.
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

`SecretStore` 테이블은 `trigger` 테이블의 FK 를 갖지 않는다 (cross-scope 의 미래 확장을 위해 namespace 만 분리). Trigger 삭제 시 application 이 `secret://triggers/{id}/*` ref 를 명시적으로 정리한다 — `TriggersService.remove()` 가 개별 `delete()` 가 아닌 `deleteByPrefix('secret://triggers/{id}/')` 로 일괄 삭제하는 의무 (§2.1 / §5.3 참고).

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

### R5. `.env.example` 예시 키 placeholder + production 차단 (refactor 04 M-4)

`.env.example` 의 `ENCRYPTION_KEY` 는 실 키가 아니라 형식만 보이는 all-zero placeholder 다. 옛 버전은
복붙 가능한 구체 64-hex 값을 실어, 그 값을 그대로 운영에 옮긴 배포는 **공개 저장소의 알려진 키로
secret store 전체를 암호화**해 사실상 평문 상태였다. 두 겹으로 막는다: (1) 눈에 띄는 all-zero
placeholder + "MUST regenerate(`openssl rand -hex 32`)" 주석, (2) `NODE_ENV=production` 부팅 가드
(`main.ts` 의 `assertProductionConfig`)가 미설정이거나 공개 예시 키(현 all-zero·옛 `0123…`)면 기동을
거부. 빈 값만 막는 §3.3 의 `SecretResolver` fail-fast 를 보완해 "예시 키 복붙" 운영 사고까지 차단하며,
`JWT_SECRET`/`MCP_ALLOW_INSECURE_URL` 과 단일 fail-closed 가드 블록으로 응집한다([auth §Rationale
"Production fail-closed 가드"](../5-system/1-auth.md#rationale)). dev/test/e2e 는 영향 없다.
