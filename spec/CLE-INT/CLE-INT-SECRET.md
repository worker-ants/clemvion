---
id: "CLE-INT-SECRET"
title: "시크릿 저장소"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT"
ancestors: ["CLE-VISION", "CLE-INT"]
area: "CLE-INT"
content_hash: "9063c79f1847ce5831ca7ce274f5a0f6f9fa752673e7a617fcb398f8537d47c1"
read_as: "approved_fallback"
task: "CLE-T-52JYHM"
source_paths: ["spec/conventions/secret-store.md"]
mirror_sha256: "bed9162ec71911ac2efc39dc9464ff3d735e2adfc478172337843e8b84b5d184"
etag: "sha256-5ee5b79df62902822669426b512a0194e500a3d1393c4e18f326d311b46d8163"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/secret-store.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 규약은 외부 provider 비밀(텔레그램 봇 토큰, 웹훅 `secret_token`, EIA 알림 웹훅 HMAC 서명 시크릿 등)을 보관하는 추상화인 시크릿 저장소(SecretStore, `secret_store`)를 정한다. 비밀은 시크릿 참조(secret ref, `secret://<scope>/<resourceId>/<name>`)로 가리키고, 읽고 쓰기는 `SecretResolver` 한 곳으로만 한다. 저장 백엔드는 PostgreSQL 에 애플리케이션이 AES-256-GCM 으로 암호화한 값을 두는 방식이다.

도메인 모듈은 비밀을 이 규약의 `SecretResolver` 로 읽고 쓴다. 예외는 [저장소 예외 필드](#저장소-예외-필드) 에 이름을 올린 필드뿐이고, 예외마다 자기 근거를 따로 세운다. 한 예외의 근거를 다른 예외에 빌려 쓰지 않는다.

현재 통합 자격 증명(`Integration.credentials`)은 이 저장소를 쓰지 않는다. 통합 엔티티의 컬럼 transformer 가 직접 암호화한다([통합 데이터와 흐름](CLE-INT-DATA.md)). 이 필드를 저장소 예외로 올릴지는 [미결 사항](#미결-사항) 에 있다.

범위 밖:

- `secret_store` 테이블 컬럼 정의는 [통합 데이터와 흐름](CLE-INT-DATA.md) 이 소유한다.
- 사용자 민감 컬럼의 응답 노출 금지는 [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) 이 소유한다. 같은 금지와 같은 근거가 걸리지만 그 컬럼들은 provider 비밀이 아니고 `secret://` 에 살지 않는다. 이 규약의 관할을 그쪽으로 넓히지 않는다.
- 인증 설정(AuthConfig) 응답 마스킹은 [외부 호출 인증 설정](../CLE-TRIG/CLE-TRIG-AUTHCFG.md) 과 [트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md) 이 소유한다.
- 봇 토큰 재발급 동작은 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md), 알림 서명 시크릿 교체 동작은 [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md) 이 소유한다.
- 트리거 행이 없어지는 경로 목록은 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) 가 소유한다.

## 규칙

1. 시크릿 참조는 `secret://<scope>/<resourceId>/<name>` 형식이다. `scope` 는 자원 namespace 로 lower-case kebab-case(예: `triggers`, `oauth-clients`)다. `resourceId` 는 UUID v4 또는 다른 스펙이 정한 ID 형식이다. `name` 은 자원 안 비밀 이름으로 lower-case kebab-case(예: `bot-token`, `inbound-signing`, `notification-signing`, `bot-token.v2`)다. DB 도 같은 형식을 CHECK 로 막는다([저장 백엔드](#저장-백엔드)).
2. `name` 끝의 `.v2` 는 같은 자원의 24시간 유예용 변형이다. 현재 쓰는 곳은 채팅 채널 봇 토큰 재발급([채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) CCH-SE-04)뿐이다. EIA 알림 서명 시크릿 교체는 `.v2` 참조를 쓰지 않는다([저장소 예외 필드](#저장소-예외-필드)).
3. 도메인 모듈은 비밀을 `SecretResolver` 로 읽고 쓴다. 예외는 [저장소 예외 필드](#저장소-예외-필드) 에 올린 필드뿐이며, 예외를 올릴 때 그 필드만의 근거를 적는다.
4. 저장소 예외 필드는 **저장 위치**의 예외일 뿐 **노출**의 예외가 아니다. 저장소 밖에 사는 필드(`AuthConfig.config` 자격 증명, `Trigger.config.interaction.triggerToken`, `Trigger.notification_secret_v2`)와 시크릿 참조(`Trigger.chat_channel_token_v2`, `config.*.botTokenRef`, `config.notification.signing.secretRef`)는 응답 DTO 에 선언해서도, 응답 바디에 실어서도 안 된다. 참조도 대상이다. 평문은 아니지만 내부 저장 위치를 드러낸다.
5. 규칙 4 는 두 축으로 시행한다. [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 응답-계약 검증(선언하지 않은 키를 위반으로 본다)과 [OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) 의 엔티티 패스스루 금지다.
6. 엔티티를 그대로 반환하는 경로에서는 응답 경계에서 지운다. 컬럼 수준 `select: false` 는 쓰지 않는다. 그 컬럼을 읽는 내부 경로(교체 승격, 정리 스윕)가 예외 없이 `undefined` 를 받아 조용히 오작동하기 때문이다.
7. 트리거를 만들 때(알림 웹훅·채팅 채널 설정 포함) 비밀 저장은 `rotate(ref, workspaceId, plaintext)` 를 쓴다. UPSERT 라 설정을 다시 시도해도 안전하다. `store()` 도 결과는 같지만 같은 참조가 이미 있을 때의 동작(덮어쓰기 또는 throw)이 백엔드 구현에 따라 달라질 수 있다.
8. 트리거 행이 없어질 때(트리거·스케줄·워크플로우·워크스페이스 삭제) 그 트리거의 모든 참조를 `deleteByPrefix('secret://triggers/{id}/')` 로 한꺼번에 지운다. 행 삭제가 커밋된 **뒤에** 지운다. provider 정리 작업이 이 비밀을 읽으므로 먼저 지울 수 없고, 행 삭제 전에 지우면 그 사이 커밋된 쓰기가 남긴 비밀을 아무도 지우지 않는다. DB FK 가 없으므로 애플리케이션 책임이다. 개별 `delete()` 보다 prefix 삭제를 쓴다.
9. 트리거 락 밖에서 비밀을 쓴 뒤 락 안 재기록이 행 부재로 실패하면 `deleteByPrefix('secret://triggers/{id}/')` 로 되돌린다. 규칙 8 과 짝이다. 행이 없으므로 prefix 전체를 지워도 안전하다([트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md)).
10. 외부 API 호출 직전(메시지 전송, HMAC 서명 등)에는 매번 `resolve(ref)` 로 값을 가져온다. 캐싱 여부는 `SecretResolver` 내부가 정한다.
11. 비밀 교체도 `rotate()`(UPSERT)로 쓴다. 채팅 채널 봇 토큰 재발급은 옛 토큰을 `bot-token.v2` 참조에 `rotate` 로 백업한 뒤 기본 참조(`bot-token`)를 새 토큰으로 `rotate` 한다([봇 토큰 재발급](#봇-토큰-재발급)). `.v2` 참조에 새 값을 쓰는 교체는 현재 없다.
12. `deleteByPrefix` 의 prefix 는 `secret://` 로 시작해야 한다. LIKE 메타문자(`%`·`_`·`\`)가 들어 있으면 throw 한다. 구현은 `ref LIKE :prefix` 에 `` `${prefix}%` `` 를 바인딩하고 `ESCAPE` 절을 두지 않는다. `ESCAPE` 절이 없다는 것도 계약의 일부다.
13. `secret_store.workspace_id` 를 조건으로 지우는 경로는 두지 않는다. 워크스페이스 삭제도 트리거 단위 prefix 로 정리한다. 인터페이스에 워크스페이스 단위 삭제가 없고, 백엔드를 규약 변경 없이 바꿀 수 있어야 하기 때문이다. 워크스페이스 삭제가 정리할 트리거를 빠짐없이 모으는 방법은 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) 가 정한다.
14. 평문과 마스터키는 애플리케이션 메모리 안에만 존재한다. DB 쿼리, SQL 파라미터, 로그, 메트릭에 절대 내보내지 않는다. DB 는 항상 암호문만 본다. (원본: SS-SE-01)
15. `store`·`rotate` 를 부를 때마다 12바이트 IV 를 새로 발급한다. IV 재사용은 금지한다. AES-GCM 에서 nonce 재사용은 치명적이다. (원본: SS-SE-02)
16. AAD 는 `ref` 다(`setAAD(Buffer.from(ref))`). 다른 참조의 암호문을 이 행에 덮어쓰는 행 간 교체 공격은 복호화 실패로 끝나야 한다. (원본: SS-SE-03)
17. 마스터키가 설정되지 않았거나 빈 값이면 부팅을 멈춘다(`SecretResolver` 모듈 초기화에서 throw). `NODE_ENV=production` 에서는 공개 `.env.example` 예시 키가 그대로 설정된 경우에도 부팅을 거부한다. 64-hex 가 아닌 값은 거부하지 않고 SHA-256 으로 키를 만든다([마스터키](#마스터키)). (원본: SS-SE-04)
18. v1 은 DB 행 단위 감사 로그를 지원하지 않는다. `resolve` 가 실패하면 애플리케이션 로거가 참조와 `workspaceId` 만 남기고 평문은 남기지 않는다. (원본: SS-SE-05)
19. `resolve(ref)` 결과는 호출자가 쓴 뒤 GC 에 맡긴다. `Buffer.fill(0)` 같은 강제 삭제는 v1 에 적용하지 않고 v2 선택지로 둔다(권장). (원본: SS-SE-06)
20. 소비 모듈은 원칙상 구체 클래스(`SecretResolverService`)가 아닌 추상 인터페이스에 의존한다. v1 은 NestJS DI 편의를 위해 구체 클래스를 직접 주입해도 된다. 구현체가 하나뿐이라 바꿀 일이 없고, abstract class 를 쓰면 injection token 설정이 더 필요하며, `deleteByPrefix` 를 포함한 메서드 시그니처가 아직 안정되지 않았기 때문이다. 백엔드가 둘 이상이 되면 `ISecretResolver` 를 추출하고 소비 모듈의 injection token 과 테스트 mock 을 인터페이스 기반으로 바꾼다. 현재 구현의 소비 모듈은 `triggers`·`chat-channel`·`external-interaction`·`schedules` 다.
21. `SecretResolver` 인터페이스를 바꾸는 변경은 모든 호출 모듈을 같은 변경에서 함께 고친다.
22. 새 비밀 종류(예: `oauth-client-secret`)를 더할 때는 [참조 예시](#참조-예시) 표에 새 `name` 행을 더하고, 호출 모듈의 스펙 본문에 참조 형식을 적는다.

## 참조 예시

| 참조 | 용도 |
| --- | --- |
| `secret://triggers/{triggerId}/bot-token` | 채팅 채널 어댑터의 봇 토큰. provider 공통(Telegram bot token, Slack `xoxb-*`, Discord bot token 등) |
| `secret://triggers/{triggerId}/bot-token.v2` | 봇 토큰 재발급 24시간 유예용 |
| `secret://triggers/{triggerId}/inbound-signing` | 채팅 채널 inbound 웹훅 출처 검증 자료(provider 공통 슬롯). Telegram 은 서버가 발급한 공유 비밀(`setWebhook.secret_token`, 어댑터가 randomBytes 로 발급), Slack 은 Slack 이 발급한 HMAC-SHA256 signing secret(사용자 입력), Discord 는 Discord 가 발급한 ed25519 application public key(사용자 입력)다. 검증 알고리즘 분기는 백엔드의 provider 별 책임이고 슬롯은 하나다. 기준은 [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md) |
| `secret://triggers/{triggerId}/notification-signing` | EIA 알림 웹훅 HMAC 서명 시크릿 |
| `secret://triggers/{triggerId}/notification-signing.v2` | 예약만 된 참조다. 현재 구현은 쓰지 않는다. 유예 기간의 새 서명 시크릿은 `Trigger.notification_secret_v2` 컬럼에 평문으로 두고, 승격할 때 기준 참조(`notification-signing`)를 교체한다 |

## 저장소 예외 필드

아래 세 필드는 시크릿 저장소 밖에 둔다. 근거가 서로 다르다.

### `AuthConfig.config`

인증 설정([외부 호출 인증 설정](../CLE-TRIG/CLE-TRIG-AUTHCFG.md))의 자격 증명은 `auth-configs` 모듈의 컬럼 transformer(AES-256-GCM)가 직접 암호화·복호화한다. `secret://` 통합 대상이 아니다. 근거는 «다른 메커니즘으로 동등하게 암호화된다» 이다. 응답 마스킹 정책의 단일 기준도 이 규약이 아니라 [트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md) 이다. 이 transformer 가 쓰는 키 이름은 [미결 사항](#미결-사항) 에 있다.

### `Trigger.config.interaction.triggerToken` (2026-08-16 결정)

트리거 단위 인터랙션 토큰(`itk_*`)은 `Trigger.config` JSONB 에 평문으로 보관한다. 위 `AuthConfig.config` 와 같은 종류의 예외가 아니다. 이 필드에는 암호화 자체가 없다. 근거는 따로 세운다.

- (a) 요청마다 검증하는 hot-path bearer 토큰이다. 저장소를 거치면 매 요청 복호화나 별도 캐시 계층이 필요하다. 이것은 비용 근거이지 필요성 근거가 아니다.
- (b) 폐기는 값 교체로 즉시 무효화되므로 저장소의 버전 관리 이점이 작다.
- (c) 값 공간이 서버가 발급한 랜덤 hex(`itk_` + 32바이트)로 닫혀 있고, 발급 응답에 한 번만 보인다. 사용자가 입력한 외부 서비스 자격 증명과 위험 성격이 다르다. 새어도 영향 범위가 그 트리거 하나다.

(a) 를 «평문이 필수» 로 읽으면 안 된다. 토큰을 해시로 저장하고 해시끼리 `crypto.timingSafeEqual` 로 비교하면 같은 성능과 타이밍 안전성을 얻는다. 평문 보관은 불가피한 것이 아니라 현재 구현의 선택이고, 이 예외를 지탱하는 실질 근거는 (c) 다. «해시 저장 + timing-safe 비교» 전환은 유효한 후속 개선안으로 열어 둔다.

이 항목을 «평문 보관 일반의 선례» 로 인용하면 안 된다. (a)~(c) 를 함께 만족하지 않는 필드가 이 문단을 근거로 예외를 얻는 것이 이 등재의 실패 모드다.

같은 `Trigger.config` 안의 `notification.signing.secretRef` 는 `SecretResolver` 를 거친다. 한 객체 안의 이 비대칭은 의도한 것이고 (a)~(c) 가 그 이유다. 서명 시크릿은 사용자가 입력하는 HMAC 비밀이라 (c) 를 만족하지 않는다. 표면 서술은 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 이 기준이다.

### `Trigger.notification_secret_v2` (2026-09-05 결정)

EIA 알림 웹훅 HMAC 서명 시크릿을 교체하는 24시간 유예 동안 **새 시크릿을 컬럼에 평문으로** 둔다. `secret://` 통합 대상이 아니다. 발송 측은 이 값을 보조 서명 키로 직접 쓴다. 기본 키는 `secretRef` 를 거친다. 표면 서술은 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 이 기준이다.

위 `itk_*` 항목의 (a)~(c) 를 근거로 삼지 않는다. 근거는 따로 세운다.

1. **평문이 종착지가 아니라 경유지다.** 승격되면 값은 `secrets.rotate` 로 저장소에 들어가고 컬럼은 `null` 로 비운다([EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 의 승격 경로). `AuthConfig.config`(영구·암호화)와 `itk_*`(영구·평문) 어느 쪽과도 다른 세 번째 형태다.
2. **노출 창이 정책으로 닫혀 있다.** 유예 종료 cron 이 컬럼을 정리한다. 응답으로 새지 않도록 `TriggersService` 의 `TRIGGER_RESPONSE_STRIP_COLUMNS` 가 응답 경계에서 이 컬럼을 지운다. 부재는 두 자리에서 단언한다. 트리거 직접 응답은 `shared/testing/trigger-workflow-ref.ts`, 스케줄 조인 응답은 `shared/testing/schedule-trigger-ref.ts` 가 같은 컬럼 목록으로 확인한다.
3. **서버가 발급하고 영향 범위가 트리거 하나다.** `wsk_` + `randomBytes(32)` 이며 사용자가 입력한 외부 자격 증명이 아니다.
4. **기본 경로는 그대로다.** 이 예외는 유예 기간의 보조 키에만 적용되며 `signing.secretRef` 정책을 건드리지 않는다.

다음 필드가 이 항목을 근거로 삼으려면 (1) 을 만족해야 한다. 즉 «승격되어 저장소로 들어가고 컬럼이 비워지는가» 다. 이 조건 없이 이 항목을 평문 보관의 선례로 쓰는 것이 이 등재의 실패 모드다.

## `SecretResolver` 인터페이스

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

  /** prefix 로 시작하는 ref 를 전부 삭제하고 삭제 행 수를 돌려준다. prefix 불변식은 규칙 12 */
  deleteByPrefix(prefix: string): Promise<number>;
}
```

| 함수 | 부작용 | 멱등성 |
| --- | --- | --- |
| `resolve` | DB SELECT 1회 | 순수(읽기 전용) |
| `store` | DB INSERT | 멱등이 아니다. 중복 참조는 throw |
| `rotate` | DB UPSERT | 멱등. 같은 참조와 같은 평문으로 다시 불러도 된다 |
| `delete` | DB DELETE | 멱등. 없는 참조는 아무것도 하지 않는다 |
| `exists` | DB SELECT 1회 | 순수 |
| `deleteByPrefix` | DB DELETE(prefix 로 시작하는 행 전부). 삭제 행 수를 돌려준다 | 이 규약에 정의 없음 |

## 저장 백엔드

v1 은 Node.js `crypto` 의 AES-256-GCM 으로 애플리케이션이 직접 암호화·복호화하고 PostgreSQL 은 암호문만 저장한다. 다른 인프라 없이 셀프 호스팅 PostgreSQL 하나로 동작한다.

```sql
CREATE TABLE secret_store (
  ref          TEXT PRIMARY KEY,                    -- secret://<scope>/<resourceId>/<name>
  workspace_id UUID NOT NULL,
  encrypted    BYTEA NOT NULL,                       -- [IV(12B) || ciphertext || authTag(16B)] concat
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ref 형식 DB 가드 (V063 migration) — application 검증과 별개로 corrupt row 방지.
ALTER TABLE secret_store
  ADD CONSTRAINT chk_secret_store_ref_format
  CHECK (ref ~ '^secret://[a-z][a-z0-9-]*/[^/]+/[a-z0-9][a-z0-9.-]*$');

CREATE INDEX idx_secret_store_workspace_id ON secret_store(workspace_id);
```

`secret_store` 는 `trigger` 테이블 FK 를 두지 않는다. 앞으로 다른 scope 를 같은 테이블에 둘 수 있도록 namespace 만 나눈다. 트리거 행이 없어질 때의 정리는 규칙 8 이 정한다.

### 암호화 형식

- 알고리즘: AES-256-GCM(AEAD, 변조 감지 내장).
- IV: `crypto.randomBytes(12)`. `store`·`rotate` 를 부를 때마다 새로 발급한다.
- AAD: `ref` 문자열. DB 에서 행을 다른 참조로 바꿔치기하는 공격을 막는다.
- 인코딩: `BYTEA` 컬럼에 `[IV(12B) ‖ ciphertext ‖ authTag(16B)]` 를 그대로 이어 붙인다.

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

### 마스터키

- 환경 변수 `ENCRYPTION_KEY` 를 쓴다. LLM API 키 암호화(`crypto.util.ts`)와 같은 키다.
- 정확히 64자 hex 면 `Buffer.from(rawHex, 'hex')` 로 그대로 쓴다(`.env.example` 의 표준 형식).
- 그 밖의 문자열은 SHA-256 으로 키를 만든다. 통합 자격 증명 transformer(`credentials-transformer.ts`)와 같은 방식이며 e2e 와 짧은 키를 받아 준다.
- 설정되지 않았거나 빈 문자열이면 부팅 때 `SecretResolver` 모듈 초기화에서 throw 한다.
- `.env.example` 의 값은 형식 예시(all-zero placeholder)일 뿐 실제 키가 아니다. 운영자는 `openssl rand -hex 32` 로 새로 만든다. `NODE_ENV=production` 에서 키가 없거나 공개 예시 키(현재 all-zero, 옛 `0123…` 예시)가 그대로면 `main.ts` 의 `assertProductionConfig` 가 부팅을 거부한다. dev·test·e2e 는 영향이 없다.
- 마스터키는 애플리케이션 메모리 안에만 있다. DB 쿼리, SQL 파라미터, 로그, 메트릭에 나가지 않는다.
- 셀프 호스팅 운영자가 키를 직접 보관한다(docker-compose `env_file`, kubernetes secret, AWS Parameter Store 등).

### 다른 백엔드로 바꾸기

`SecretResolver` 인터페이스는 PostgreSQL 과 묶여 있지 않다. AWS Secrets Manager 나 HashiCorp Vault 가 필요해지면 `AwsSecretsManagerResolver`·`VaultResolver` 같은 구현을 더하고 `ConfigModule` 에서 환경별로 바꾼다. 이 규약은 바뀌지 않는다.

## 사용 패턴

### 트리거 생성

```typescript
async createTrigger(dto: CreateTriggerDto, workspaceId: string) {
  const trigger = await this.repo.save({ ...dto, workspaceId });
  if (dto.notification?.signing?.secret) {
    const ref = `secret://triggers/${trigger.id}/notification-signing`;
    await this.secrets.rotate(ref, workspaceId, dto.notification.signing.secret);
    trigger.config.notification.signing = { algorithm: dto.notification.signing.algorithm, secretRef: ref };
    await this.repo.save(trigger);
  }
  if (dto.chatChannel?.botToken) {
    const ref = buildSecretRef({ scope: 'triggers', resourceId: trigger.id, name: 'bot-token' });
    // setup 경로는 재시도 안전성을 위해 rotate() (UPSERT) 사용 — 규칙 7.
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

### 외부 API 호출

```typescript
async sendMessage(message: ChannelMessage, config: ChatChannelConfig) {
  const token = await this.secrets.resolve(config.botTokenRef);
  return this.client.sendMessage(token, message);
}
```

### 트리거 행이 없어질 때

트리거 화면 삭제를 예로 든다. 스케줄·워크플로우·워크스페이스 삭제도 같은 순서다([트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md)).

```typescript
async removeTrigger(triggerId: string) {
  // 외부 provider teardown 은 이보다 앞에서 끝낸다 — teardown 이 비밀을 읽는다.
  await this.repo.delete(triggerId);
  // 행 삭제가 커밋된 뒤에 지운다. 그 사이 끼어든 쓰기는 락 안 재기록에서 행 부재를 보고 스스로
  // 되돌린다(규칙 9). 개별 ref delete 보다 prefix 패턴 권장 — 추가 secret 도 자동 정리.
  await this.secrets.deleteByPrefix(`secret://triggers/${triggerId}/`);
}
```

### 봇 토큰 재발급

봇 토큰 재발급은 기본 참조(`bot-token`)를 바로 새 토큰으로 바꾸고 `bot-token.v2` 에 옛 토큰을 24시간 보관한다. 별도 승격 단계는 없다. 재발급 순서와 유예 정리는 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 과 [채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md) 이 정한다.

### 채팅 채널 inbound 서명 자료 초기화

`inbound-signing` 은 provider 에 따라 두 경로로 초기화한다. 서버가 발급하는 경우(Telegram)는 `setupChannel` 결과에서 받고, provider 가 발급하는 경우(Slack·Discord)는 사용자 입력에서 받는다. 둘 다 같은 슬롯 `secret://triggers/{id}/inbound-signing` 에 둔다. 한 슬롯을 백엔드의 provider 분기가 흡수한다는 뜻이다([채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md)).

```typescript
// (a) server-issued — Telegram 등 adapter 의 setupChannel 이 randomBytes 로 발급
async setupChatChannel(trigger: Trigger, workspaceId: string) {
  const adapter = this.registry.get(trigger.config.chatChannel.provider);
  const result = await adapter.setupChannel(trigger.config.chatChannel, callbackUrl);
  // configUpdates 안에 plaintext 흘리지 않고 issuedInboundSigning 으로 분리
  if (result.issuedInboundSigning) {
    const ref = buildSecretRef({ scope: 'triggers', resourceId: trigger.id, name: 'inbound-signing' });
    await this.secrets.rotate(ref, workspaceId, result.issuedInboundSigning);  // setup 재시도 안전성 (규칙 7)
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

## 미결 사항

- **통합·인증 설정 자격 증명 암호화 키 이름**: 이 규약의 `AuthConfig.config` 예외 설명(원문)과 인증 설정 데이터 정의는 인증 설정과 통합 자격 증명 transformer 가 `ENCRYPTION_KEY` 를 쓴다고 적는다. 같은 규약의 마스터키 절은 통합 자격 증명 transformer 를 `INTEGRATION_ENCRYPTION_KEY` 를 쓰는 다른 키로 적는다(관련: [통합 데이터와 흐름](CLE-INT-DATA.md), [트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md)). 현재 구현을 정리하면 키가 둘이다. `ENCRYPTION_KEY` 는 이 저장소, LLM API 키 암호화, 운영 부팅 가드(`production-guards.ts`)가 읽는다. `INTEGRATION_ENCRYPTION_KEY` 는 `credentials-transformer.ts` 가 읽는다. 인증 설정 엔티티도 이 transformer 를 가져다 쓰므로(`auth-config.entity.ts`) 통합 자격 증명·`last_error`·OAuth 일시 테이블·인증 설정 자격 증명이 모두 `INTEGRATION_ENCRYPTION_KEY` 를 쓴다. 이 키가 없으면 transformer 는 경고를 한 번 남기고 평문으로 저장하고, 운영 부팅 가드는 이 키를 검사하지 않는다. 두 키가 다르면 운영 키 교체와 백업 범위 판단이 달라진다. 키 이름, 두 키를 합칠지, 키가 없을 때 평문 저장을 허용할지 결정이 필요하다.
- **통합 자격 증명과 이 저장소의 관계**: 이 규약은 도메인 모듈이 `SecretResolver` 를 거치고 예외는 [저장소 예외 필드](#저장소-예외-필드) 뿐이라고 정한다. 그런데 통합 자격 증명(`Integration.credentials`, Cafe24·OAuth·MCP 토큰 포함)은 컬럼 transformer 로 저장하고 예외 목록에도 없다([통합 데이터와 흐름](CLE-INT-DATA.md)). 원문 서두는 «향후 cafe24·OAuth 등» 도 `SecretResolver` 를 거친다고 적고, Rationale R2 는 OAuth client secret 과 Cafe24 토큰을 옮겨 올 가능성을 적는다. 방향은 이관 쪽이지만 시점과 범위를 정한 계획은 원문에 없다. 예외로 올린다면 `AuthConfig.config` 처럼 «다른 메커니즘으로 동등하게 암호화된다» 를 근거로 삼게 되는데, 키가 없을 때 평문으로 저장하는 동작(위 미결)이 남아 있으면 그 근거가 서지 않는다. 예외로 올리고 근거를 적을지, 저장소로 옮길 계획을 세울지 결정이 필요하다.

## 구현 위치

- `codebase/backend/src/modules/secret-store/**`

## Rationale

### R1. 애플리케이션에서 AES-256-GCM 으로 암호화한다

Node `crypto` 의 AES-256-GCM 을 채택한다. 마스터키가 애플리케이션과 DB 의 경계를 넘지 않고, DB 는 암호문만 본다(DBA 도 복호화하지 못한다). PostgreSQL 확장 의존성이 없어 Heroku 같은 관리형 PG 에서도 쓸 수 있다. AEAD 의 인증 태그로 변조를 감지한다. 단위 테스트에 DB 가 필요 없다. 셀프 호스팅 환경에서는 마스터키가 애플리케이션 메모리 밖으로 나가지 않는 경계가 더 큰 보안 이득이다. PostgreSQL 운영 변경(확장 활성화, 재시작) 없이 도입할 수 있다. 기업 사용자가 요청하면 백엔드 교체로 넓힌다.

### R2. 참조에 `<scope>` 를 둔다

`secret://<scope>/<resourceId>/<name>` 형식을 쓰면 다른 도메인 자원(예: Cafe24 access token)도 같은 저장소를 namespace 충돌 없이 함께 쓸 수 있다. OAuth client secret 이나 Cafe24 토큰을 옮겨 올 가능성과 namespace 명확성을 함께 고려했다.

### R3. `.v2` 접미사로 유예 변형을 나타낸다

`name.v2` 로 같은 자원의 변형임을 이름 안에 적는다. `bot-token` 과 `bot-token.v2` 가 눈으로 묶이고, `resolve` 에 넘기는 참조 문자열만 봐도 무엇을 읽는지 분명하다.

`v2` 는 «같은 자원의 24시간 유예용 변형» 만 뜻하고 옛 값인지 새 값인지는 뜻하지 않는다. 실제로 두 v2 의 뜻은 반대다. 채팅 채널의 `bot-token.v2`(와 `Trigger.chat_channel_token_v2`)는 **옛** 봇 토큰 백업이고 유예가 끝나면 지운다. 승격 단계는 없다([채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md)). EIA 알림 서명의 `Trigger.notification_secret_v2` 는 유예 기간의 **새** 서명 시크릿이고 승격 때 기준 참조를 바꾼다([EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md)). 원문의 옛 봇 토큰 재발급 예시는 `rotate(refV2, newToken)` 뒤 배치가 v2 를 기준 참조로 올린다고 적어 알림 서명 쪽 뜻을 따랐는데, 채팅 채널 요구사항(CCH-SE-04-C)과 현재 구현(`rotateBotToken`)은 옛 토큰 백업이다. 그래서 [봇 토큰 재발급](#봇-토큰-재발급) 절과 규칙 11 은 채팅 채널 쪽을 따른다. 두 v2 를 읽을 때는 이름 패턴이 같다고 뜻이 같다고 보지 않는다.

### R4. FK 를 두지 않는다

`secret_store.workspace_id` 에 FK 를 둘 수는 있지만 이 규약은 애플리케이션 수준 정리만 정한다. 워크스페이스 밖의 시스템 전역 비밀 같은 다른 scope 도 같은 테이블에 두려면 FK 가 제약이 된다. 정리 책임은 트리거 행을 없애는 **모든 경로**가 진다. 트리거 삭제(`TriggersService.remove()`)뿐 아니라 스케줄 삭제, FK CASCADE 로 트리거를 지우는 워크플로우·워크스페이스 삭제도 정리한다. 애플리케이션 수준 정리를 택하면 DB 가 대신 지워 주지 않으므로, 책임을 한 경로에만 적으면 나머지 경로가 조용히 고아를 남긴다. 2026-09-17 실측에서 네 경로 중 한 곳만 정리하고 있었다. `ON DELETE CASCADE` 는 채택하지 않는다. 암묵적 DB 동작과 명시적 애플리케이션 동작이 섞이면 추적이 어렵다. 같은 날 «워크스페이스 삭제는 SQL 한 줄로 정리된다» 는 옛 서술도 바로잡았다. 그렇게 지우는 코드는 없었다.

### R5. `.env.example` 에는 형식 예시만 두고 production 에서 막는다

`.env.example` 의 `ENCRYPTION_KEY` 는 실제 키가 아니라 형식만 보이는 all-zero placeholder 다. 옛 버전은 복사해 쓸 수 있는 구체적인 64-hex 값을 실었고, 그 값을 그대로 운영에 옮긴 배포는 공개 저장소의 알려진 키로 저장소 전체를 암호화해 사실상 평문 상태였다. 그래서 두 겹으로 막는다. 눈에 띄는 all-zero placeholder 와 «MUST regenerate(`openssl rand -hex 32`)» 주석이 하나이고, `NODE_ENV=production` 부팅 가드(`main.ts` 의 `assertProductionConfig`)가 키가 없거나 공개 예시 키면 기동을 거부하는 것이 둘이다. 빈 값만 막는 `SecretResolver` 초기화 검사를 보완해 «예시 키 복사» 운영 사고까지 막는다. `JWT_SECRET`·`MCP_ALLOW_INSECURE_URL` 과 함께 하나의 fail-closed 가드 블록으로 모았다([세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) 의 Rationale 「운영 환경 가드」). dev·test·e2e 는 영향이 없다(refactor 04 M-4).

### R6. 마스터키를 LLM API 키와 함께 쓴다

기존 `ENCRYPTION_KEY` 의 사용처(LLM API 키)와 이 저장소의 사용처(외부 provider 비밀)는 같은 신뢰 영역이다. 둘 다 외부 API 자격 증명 평문이다. 도메인을 나눠 얻는 이득보다 운영 단순화 이득이 크다. 도메인 분리가 필요해지면 별도 `ENCRYPTION_KEY_SECRET_STORE` 환경 변수를 검토한다.

### R7. 저장소 예외 필드도 응답에는 나가지 않는다고 규범으로 적는다

2026-09-05 전까지 «이 컬럼들이 응답에 나가면 안 된다» 는 요구가 스펙 어디에도 규범 문장으로 없었고(실측 0건), 실제로 두 엔드포인트에서 나가고 있었다. `notification_secret_v2` 예외를 올릴 때도 예외의 대상은 «컬럼에 평문으로 보관» 이지 «응답에 실어도 된다» 가 아니었다. 그래서 규칙 4~6 으로 경계를 규범으로 적었다. 이후 `#1291` 이 응답 경계 스트립을 세웠고 두 단언 자리가 부재를 고정한다. 같은 컬럼 목록이 EIA 문서에도 있으면 한쪽만 고쳐 다른 쪽이 낡으므로, 목록은 이 규약에 두고 EIA 문서는 링크한다.

### R8. `deleteByPrefix` 는 LIKE 메타문자를 이스케이프하지 않고 거부한다 (2026-08-09)

구현이 prefix 를 `ref LIKE :prefix`(`` `${prefix}%` ``)로 쓴다. 파라미터 바인딩이라 SQL 인젝션은 아니지만, prefix 에 `%`(임의 문자열)나 `_`(임의 한 글자)가 섞이면 의도보다 넓게 지운다. 삭제는 되돌릴 수 없다. `\`(LIKE 이스케이프 문자)도 같은 이유로 막는다.

이스케이프(`\%` + `ESCAPE` 절)가 아니라 거부를 택한 이유는 이 API 의 prefix 가 내부에서 조립하는 식별자 경로라 메타문자가 정당하게 필요한 경우가 없어서다. 참조 형식 자체가 메타문자를 배제한다. 이스케이프는 없는 사용 사례를 위해 표면을 넓힌다.

«지금은 안전하다» 를 주석으로만 두지 않았다. 도입 시점의 운영 호출부는 `triggers.service.ts` 한 곳(`secret://triggers/${trigger.id}/`, `trigger.id` 는 UUID 라 메타문자가 없다)뿐이었다. 그러나 그 안전은 호출부 목록이 그대로일 때만 참이다. 사용자 입력이 섞인 prefix 를 넘기는 호출부가 하나 생기면 주석은 아무것도 막지 못한다. 기존 `secret://` 접두사 검사와 같은 형태로 입력 자체를 거부했다.

검증은 두 층으로 나눠 고정한다. 단위 테스트의 in-memory mock 은 `startsWith` 로 대상을 골라 와일드카드 패턴에서 실제보다 적게 지운다. 방향이 반대라 과다 삭제를 오히려 감춘다. mock 에 LIKE 해석기를 심으면 테스트가 DB 를 흉내 내다 틀릴 위험이 새로 생긴다. 그래서 와일드카드 의미는 실제 Postgres 로 고정하고(`codebase/backend/test/secret-store-like-prefix.e2e-spec.ts`, `_` 를 섞은 prefix 가 리터럴이면 0건, 실제로는 2건을 지운다고 단언), 그 의미가 이 API 에 적용된다는 사실은 단위 테스트의 쿼리 형태 단언(`secret-resolver.service.spec.ts`, `ref LIKE :prefix` 와 `` `${prefix}%` `` 바인딩과 `ESCAPE` 절 부재)으로 고정한다. 둘 중 하나가 깨지면 나머지의 전제도 다시 본다.
