---
id: "CLE-INT-SECRET-BACKEND"
title: "시크릿 저장소 — 인터페이스와 저장 백엔드"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT-SECRET"
ancestors: ["CLE-VISION", "CLE-INT", "CLE-INT-SECRET"]
area: "CLE-INT"
content_hash: "426f5f8d643c4765fe1acf661a3453ab223fa1d0ef859d05eab6ee068b27d71a"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "dc8f282382ed80042bdea4ebd212590fe2830c614574302edfa417e3adcf2fb9"
etag: "sha256-ba49657cdb9f75a817cb80e6f0e39b392232f37fd41214fc96bed0f25f39d058"
---
## 개요

이 문서는 [시크릿 저장소](CLE-INT-SECRET.md) 의 하위 문서로 `SecretResolver` 인터페이스, 저장 백엔드(PostgreSQL + AES-256-GCM), 암호화 형식, 마스터키, 다른 백엔드로 바꾸는 조건을 정한다. 규칙 번호(규칙 N)는 부모 문서 [「규칙」](CLE-INT-SECRET.md#규칙) 의 번호다.

## `SecretResolver` 인터페이스

```typescript
interface SecretResolver {
  /** ref 로 plaintext 조회. 미존재 시 throw (메시지에 ref 를 싣지 않는다, 규칙 18). 정상 동작 경로에서만 호출 (config 가 ref 를 보유) */
  resolve(ref: string): Promise<string>;

  /** plaintext 를 ref 로 저장. 이미 존재하면 throw (메시지에 ref 를 싣지 않는다, 규칙 18. 대신 rotate 사용).
   *  plaintext 가 문자열이 아니거나 비었거나 공백뿐이면 throw 하고 쓰지 않는다 (규칙 27) */
  store(ref: string, workspaceId: string, plaintext: string): Promise<void>;

  /** ref 의 plaintext 를 newPlaintext 로 교체 (UPSERT 의미). 기존 행의 workspace_id 가 인자와 다르면 throw 하고 바꾸지 않는다 (규칙 25).
   *  newPlaintext 가 문자열이 아니거나 비었거나 공백뿐이어도 throw 하고 바꾸지 않는다 (규칙 27).
   *  manager 를 주면 그 트랜잭션에서 쓴다. 트리거 설정 잠금 안 쓰기가 이 인자를 쓴다 (규칙 9) */
  rotate(ref: string, workspaceId: string, newPlaintext: string, manager?: EntityManager): Promise<void>;

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
| `store` | DB INSERT. 평문이 문자열이 아니거나 비었거나 공백뿐이면 throw 하고 쓰지 않는다(규칙 27) | 멱등이 아니다. 중복 참조는 throw |
| `rotate` | DB SELECT 뒤 UPSERT. `manager` 를 받으면 그 트랜잭션에서 한다. 기존 행의 `workspace_id` 가 인자와 다르면 throw 하고 쓰지 않는다. 평문이 문자열이 아니거나 비었거나 공백뿐이어도 throw 하고 쓰지 않는다(규칙 27) | 멱등. 같은 참조 · 워크스페이스 · 평문으로 다시 불러도 된다 |
| `delete` | DB DELETE | 멱등. 없는 참조는 아무것도 하지 않는다 |
| `exists` | DB SELECT 1회 | 순수 |
| `deleteByPrefix` | DB DELETE(prefix 로 시작하는 행 전부). 삭제 행 수를 돌려준다 | 이 규약에 정의 없음([미결 사항](CLE-INT-SECRET.md#미결-사항)) |

## 저장 백엔드

1차 범위에서는 Node.js `crypto` 의 AES-256-GCM 으로 애플리케이션이 직접 암호화·복호화하고 PostgreSQL 은 암호문만 저장한다. 다른 인프라 없이 셀프 호스팅 PostgreSQL 하나로 동작한다.

테이블 컬럼은 [통합 데이터와 흐름](CLE-INT-DATA.md) 의 「시크릿 저장소 (`secret_store`)」 절이 정한다. 이 규약은 참조 형식을 막는 DB 가드와 `workspace_id` 인덱스만 적는다(V063).

```sql
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

- 환경 변수 `ENCRYPTION_KEY` 를 쓴다. LLM API 키 암호화(`crypto.util.ts`)와 같은 키다. 통합 자격 증명과 인증 설정 컬럼의 통합 암호화 키(`INTEGRATION_ENCRYPTION_KEY`)는 이 키와 별개다(규칙 26).
- 정확히 64자 hex 면 `Buffer.from(rawHex, 'hex')` 로 그대로 쓴다(`.env.example` 의 표준 형식).
- 그 밖의 문자열은 SHA-256 으로 키를 만든다. e2e 와 짧은 키도 받으려는 것이다. 통합 암호화 키의 transformer 는 64자 hex 도 SHA-256 으로 만들므로 이 방식과 다르다([통합 데이터와 흐름 「암호화」](CLE-INT-DATA.md#암호화)).
- 설정되지 않았거나 빈 문자열이면 부팅 때 `SecretResolver` 모듈 초기화에서 throw 한다.
- `.env.example` 의 값은 형식 예시(all-zero placeholder)일 뿐 실제 키가 아니다. 운영자는 `openssl rand -hex 32` 로 새로 만든다. `NODE_ENV=production` 에서는 예시 값처럼 쓸 수 없는 키로 기동하지 않는다(규칙 17). dev·test·e2e 는 영향이 없다.
- 마스터키는 애플리케이션 메모리 안에만 있다. DB 쿼리, SQL 파라미터, 로그, 메트릭에 나가지 않는다.
- 셀프 호스팅 운영자가 키를 직접 보관한다(docker-compose `env_file`, kubernetes secret, AWS Parameter Store 등).

### 다른 백엔드로 바꾸기

`SecretResolver` 인터페이스는 PostgreSQL 과 묶여 있지 않다. AWS Secrets Manager 나 HashiCorp Vault 가 필요해지면 `AwsSecretsManagerResolver`·`VaultResolver` 같은 구현을 더하고 `ConfigModule` 에서 환경별로 바꾼다. 인터페이스와 이 규약의 규칙은 바뀌지 않는다. 다만 트리거 설정 잠금 안에서 시크릿 저장소에 쓰는 경로(생성 · PATCH 의 첫 알림 서명 시크릿 발급과 옛 평문 옮기기, 시크릿 승격)는 예외다. 이 경로들은 백엔드가 같은 DB 의 테이블이라는 전제에 기댄다. 잠금 안에서는 HTTP 호출을 하지 않고([트리거 관리 「동시 쓰기 직렬화」](../CLE-TRIG/CLE-TRIG-MANAGE.md#동시-쓰기-직렬화)) 비밀 쓰기를 잠금을 쥔 트랜잭션에 묶기 때문이다(`rotate` 의 `manager` 인자, 규칙 9). 외부 백엔드로 바꾸면 이 경로를 다시 설계한다.

## 구현 위치

- `codebase/backend/src/modules/secret-store/**`
- 규칙 17 · 26 의 운영 환경 가드: `codebase/backend/src/common/config/production-guards.ts`(`assertProductionConfig`, 공개 예시 값 목록 `KNOWN_EXAMPLE_ENCRYPTION_KEYS` · `INSECURE_INTEGRATION_ENCRYPTION_KEYS`), 가드를 부르는 곳 `codebase/backend/src/main.ts`

## Rationale

### R1. 애플리케이션에서 AES-256-GCM 으로 암호화한다

Node `crypto` 의 AES-256-GCM 을 채택한다. 마스터키가 애플리케이션과 DB 의 경계를 넘지 않고, DB 는 암호문만 본다(DBA 도 복호화하지 못한다). PostgreSQL 확장 의존성이 없어 Heroku 같은 관리형 PG 에서도 쓸 수 있다. AEAD 의 인증 태그로 변조를 감지한다. 단위 테스트에 DB 가 필요 없다. 셀프 호스팅 환경에서는 마스터키가 애플리케이션 메모리 밖으로 나가지 않는 경계가 더 큰 보안 이득이다. PostgreSQL 운영 변경(확장 활성화, 재시작) 없이 도입할 수 있다. 기업 사용자가 요청하면 백엔드 교체로 넓힌다.

### R4. FK 를 두지 않는다

`secret_store.workspace_id` 에 FK 를 둘 수는 있지만 이 규약은 애플리케이션 수준 정리만 정한다. 워크스페이스 밖의 시스템 전역 비밀 같은 다른 scope 도 같은 테이블에 두려면 FK 가 제약이 된다. 정리 책임은 트리거 행을 없애는 **모든 경로**가 진다. 트리거 삭제(`TriggersService.remove()`)뿐 아니라 스케줄 삭제, FK CASCADE 로 트리거를 지우는 워크플로우·워크스페이스 삭제도 정리한다. 애플리케이션 수준 정리를 택하면 DB 가 대신 지워 주지 않으므로, 책임을 한 경로에만 적으면 나머지 경로가 조용히 고아를 남긴다. 2026-09-17 실측에서 네 경로 중 한 곳만 정리하고 있었다. `ON DELETE CASCADE` 는 채택하지 않는다. 암묵적 DB 동작과 명시적 애플리케이션 동작이 섞이면 추적이 어렵다. 같은 날 «워크스페이스 삭제는 SQL 한 줄로 정리된다» 는 옛 서술도 바로잡았다. 그렇게 지우는 코드는 없었다.

### R5. `.env.example` 에는 형식 예시만 두고 production 에서 막는다

`.env.example` 의 `ENCRYPTION_KEY` 는 실제 키가 아니라 형식만 보이는 all-zero placeholder 다. 옛 버전은 복사해 쓸 수 있는 구체적인 64-hex 값을 실었고, 그 값을 그대로 운영에 옮긴 배포는 공개 저장소의 알려진 키로 저장소 전체를 암호화해 사실상 평문 상태였다. 그래서 두 겹으로 막는다. 눈에 띄는 all-zero placeholder 와 «MUST regenerate(`openssl rand -hex 32`)» 주석이 하나이고, `NODE_ENV=production` 에서 `main.ts` 가 부르는 운영 환경 가드(`assertProductionConfig`, `production-guards.ts`)가 공개 예시 값으로 기동하지 못하게 막는 것이 둘이다. 거부 기준은 [세션과 토큰 「암호화 키 검사」](../CLE-ACCT/CLE-ACCT-SESSION.md#암호화-키-검사) 에 있다. 빈 값만 막는 `SecretResolver` 초기화 검사를 보완해 «예시 값 복사» 운영 사고까지 막는다. `JWT_SECRET`·`MCP_ALLOW_INSECURE_URL` 과 함께 하나의 fail-closed 가드 함수로 모았다([세션과 토큰 「운영 환경 가드를 한 함수에 모은다」](../CLE-ACCT/CLE-ACCT-SESSION.md#운영-환경-가드를-한-함수에-모은다)). dev·test·e2e 는 영향이 없다.

2026-10-10 에 NERV Task `CLE-T-2V7SBC` 가 이 가드를 세 가지로 넓혔다. 첫째, k8s 예시 Secret 과 루트 README 예시의 자리표시 값도 거부 목록(`KNOWN_EXAMPLE_ENCRYPTION_KEYS`)에 더했다. 이 값들도 공개 저장소에 있어 그대로 옮겨 쓰면 `.env.example` 값을 옮긴 것과 같은 사고가 난다. 둘째, 예시 값을 앞뒤 공백을 뗀 값으로도 대조한다. `.env` 나 Secret 에 옮기다 공백이나 끝 개행이 붙은 예시 값이 목록을 빠져나가지 않게 하려는 것이다. 뗀 값은 대조에만 쓰고 실제로 쓰는 키는 바꾸지 않는다. 셋째, 공백뿐인 값을 거부한다. `SecretResolver` 초기화는 키가 없거나 빈 문자열일 때만 막는다. 공백뿐인 값은 막지 않고 SHA-256 으로 키를 만든다. 이 키는 누구나 짐작할 수 있어 공개 예시 값과 다르지 않다. 감수한 비용도 있다. 이 값들로 돌던 운영 배포는 기동하지 못한다. 키를 새로 만들면 옛 키로 암호화한 `secret_store` 값과 모델 프로바이더 API 키를 읽지 못한다. 옛 키로 풀어 새 키로 다시 암호화하는 수단은 없다. 공개된 키로 암호화한 값은 이미 평문과 같으므로 기동 거부를 택했다. 이 확장의 이유와 비용은 2026-10-31 에 이 단락에 적었다(NERV Task `CLE-T-KQ37NJ`).

### R6. 마스터키를 LLM API 키와 함께 쓴다

기존 `ENCRYPTION_KEY` 의 사용처(LLM API 키)와 이 저장소의 사용처(외부 서비스 비밀)는 같은 신뢰 영역이다. 둘 다 외부 API 자격 증명 평문이다. 도메인을 나눠 얻는 이득보다 운영 단순화 이득이 크다. 도메인 분리가 필요해지면 별도 `ENCRYPTION_KEY_SECRET_STORE` 환경 변수를 검토한다. 이 이름은 아직 도입하지 않은 후보 이름이다. 통합 암호화 키는 구현 이력으로 이미 따로 있다. 두 키를 합치지 않은 이유는 [R13 「통합 암호화 키를 마스터키와 따로 둔다」](#r13-통합-암호화-키-integration_encryption_key-를-마스터키와-따로-두고-production-에서-키-없이-기동하지-않는다-2026-10-10) 에 있다.

### R8. `deleteByPrefix` 는 LIKE 메타문자를 이스케이프하지 않고 거부한다 (2026-08-09)

구현이 prefix 를 `ref LIKE :prefix`(`` `${prefix}%` ``)로 쓴다. 파라미터 바인딩이라 SQL 인젝션은 아니지만, prefix 에 `%`(임의 문자열)나 `_`(임의 한 글자)가 섞이면 의도보다 넓게 지운다. 삭제는 되돌릴 수 없다. `\`(LIKE 이스케이프 문자)도 같은 이유로 막는다.

이스케이프(`\%` + `ESCAPE` 절)가 아니라 거부를 택한 이유는 이 API 의 prefix 가 내부에서 조립하는 식별자 경로라 메타문자가 정당하게 필요한 경우가 없어서다. 참조 형식 자체가 메타문자를 배제한다. 이스케이프는 없는 사용 사례를 위해 표면을 넓힌다.

«지금은 안전하다» 를 주석으로만 두지 않았다. 도입 시점의 운영 호출부는 `triggers.service.ts` 한 곳(`secret://triggers/${trigger.id}/`, UUID 라 메타문자가 없다)뿐이었지만 그 안전은 호출부 목록이 그대로일 때만 참이다. 사용자 입력이 섞인 prefix 를 넘기는 호출부가 생기면 주석은 아무것도 막지 못하므로 기존 `secret://` 접두사 검사와 같은 형태로 입력 자체를 거부했다.

검증은 두 층으로 나눠 고정한다. 단위 테스트의 in-memory mock 은 `startsWith` 로 대상을 골라 와일드카드 패턴에서 실제보다 적게 지운다. 방향이 반대라 과다 삭제를 오히려 감춘다. mock 에 LIKE 해석기를 심으면 테스트가 DB 를 흉내 내다 틀릴 위험이 새로 생긴다. 그래서 와일드카드 의미는 실제 Postgres 로 고정하고(`codebase/backend/test/secret-store-like-prefix.e2e-spec.ts`, `_` 를 섞은 prefix 가 리터럴이면 0건, 실제로는 2건을 지운다고 단언), 그 의미가 이 API 에 적용된다는 사실은 단위 테스트의 쿼리 형태 단언(`secret-resolver.service.spec.ts`, `ref LIKE :prefix` 와 `` `${prefix}%` `` 바인딩과 `ESCAPE` 절 부재)으로 고정한다. 둘 중 하나가 깨지면 나머지의 전제도 다시 본다.

### R13. 통합 암호화 키 `INTEGRATION_ENCRYPTION_KEY` 를 마스터키와 따로 두고 production 에서 키 없이 기동하지 않는다 (2026-10-10)

이 규약과 통합 · 트리거 데이터 문서는 통합 자격 증명과 인증 설정의 암호화 키 이름을 서로 다르게 적었고 미결로 남겼다. 구현은 `INTEGRATION_ENCRYPTION_KEY` 를 읽었다. 키가 없으면 경고만 남기고 평문으로 저장했다. 운영 환경 가드(`assertProductionConfig`)는 이 키를 검사하지 않았다. 그래서 운영 환경에서도 OAuth 토큰과 API 키가 평문으로 쌓일 수 있었다. NERV Task `CLE-T-2V7SBC` 에서 사용자가 아래와 같이 정했다(2026-10-10).

- 두 키를 그대로 둔다. `ENCRYPTION_KEY` 는 이 저장소와 LLM API 키를 암호화하는 마스터키다. `INTEGRATION_ENCRYPTION_KEY` 는 통합 자격 증명과 인증 설정 컬럼 transformer 의 키다(규칙 26).
- `NODE_ENV=production` 에서 통합 암호화 키가 없거나 공백뿐이거나 공개 예시 값이면 기동하지 않는다. 부팅 때 환경 변수를 검사하는 운영 환경 가드(`assertProductionConfig`)가 막는다. 요청 경로에서는 예외를 던지지 않는다.
- 운영 환경 밖에서는 지금처럼 키가 없으면 경고를 남기고 평문으로 저장한다. 평문 저장은 운영 환경 밖에서만 허용한다고 문서에 적는다.
- 이미 평문으로 저장된 행은 그대로 읽는다. 서버가 일괄로 다시 암호화하지 않는다.
- 키 길이에 하한을 두지 않는다. transformer 가 SHA-256 으로 키를 만들어 어떤 길이든 받는다. 32바이트 이상의 무작위 값은 권고로 둔다.

동작의 규범은 [통합 데이터와 흐름 「암호화」](CLE-INT-DATA.md#암호화) 한 곳에 둔다. 운영 환경 가드가 이 키를 거부하는 기준은 2026-10-31 부터 [세션과 토큰 「암호화 키 검사」](../CLE-ACCT/CLE-ACCT-SESSION.md#암호화-키-검사) 에 둔다(아래 R17). 예시 값 목록의 정본은 그 절이 가리키는 `production-guards.ts` 상수이고 공개 예시 값은 스펙에 옮기지 않는다.

- **기동을 막는 기준과 배포 영향.** 운영 환경 가드는 정당한 용도가 없는 설정만 기동을 막는다([세션과 토큰 「가드에 넣는 것과 넣지 않는 것」](../CLE-ACCT/CLE-ACCT-SESSION.md#가드에-넣는-것과-넣지-않는-것)). 키가 없는 운영 설정은 새로 쓰는 자격 증명을 평문으로 저장하므로 이 기준에 따라 막는다. 그래서 통합과 인증 설정을 쓰지 않는 운영 배포도 이 키를 설정해야 한다. `.env.example` 과 k8s 예시 Secret(`k8s/base/secret.example.yaml`)에는 이미 이 키 이름이 있다.
- **요구사항과의 관계.** [비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md) 과 [통합 관리](CLE-INT-MANAGE.md) 의 저장 암호화 요구사항이 요구하는 암호화는 운영 환경에서 새로 쓰는 값에만 보장된다. 2026-10-31 에 NERV Task `CLE-T-KQ37NJ` 가 두 요구사항 문구를 운영 환경(`NODE_ENV=production`) 기준으로 좁히고 예외를 [통합 데이터와 흐름 「암호화」](CLE-INT-DATA.md#암호화) 로 링크했다. 같은 날 [비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md) 에는 마스터키가 암호화하는 시크릿 저장소의 비밀과 LLM API 키는 환경과 상관없이 암호화한다는 문장도 넣었다. 그래서 «운영 환경에서 새로 쓰는 값에만» 은 통합 암호화 키가 암호화하는 그 절 표의 컬럼에만 걸리고 마스터키가 암호화하는 값에는 걸리지 않는다(규칙 17).
- **키 길이에 하한을 두지 않는 이유.** 하한을 넣으면 짧은 키로 운영 중인 환경은 키를 바꿔야 한다. 키를 바꾸면 옛 키로 암호화한 행은 복호화되지 않는다. `JWT_SECRET` 은 서명에 쓰는 키라 하한을 둔다. 키 길이 계약은 NERV Task `CLE-T-C6GCKV` 가 정한다. 이 근거는 짧아도 비밀인 키를 막지 않는 데만 쓴다. 공개 예시 값은 길이와 상관없이 기밀성이 없다. 그래서 R5 와 같은 논리(공개된 값은 막는다)로 막는다. 예시 값으로 운영 중인 배포도 키를 바꿔야 하지만 그 비용을 근거로 예시 값을 받아 주지는 않는다. 이 구분은 2026-10-31 에 더했다(NERV Task `CLE-T-KQ37NJ`).
- **저장소 예외 근거를 고친 경위.** [저장소 예외 필드](CLE-INT-SECRET-EXPOSE.md#저장소-예외-필드) 의 `AuthConfig.config` 근거는 «동등하게 암호화된다» 였다. transformer 는 AAD 를 쓰지 않고 운영 환경 밖에서는 평문으로 저장하므로 «다른 메커니즘으로 암호화된다» 로 고쳤다.

견준 안과 택하지 않은 이유는 다음과 같다.

- **두 키를 하나로 합친다.** 두 키는 키를 만드는 방식이 다르다. `ENCRYPTION_KEY` 는 64자 hex 면 원시 32바이트로 쓰고 통합 암호화 키는 늘 SHA-256 으로 만든다. 그래서 64자 hex 문자열을 두 키에 함께 넣으면 실제 키가 다르다. 그 밖의 문자열이면 두 키 모두 SHA-256 으로 만들어 실제 키가 같다. 합치면 실제 키가 바뀌는 쪽의 기존 암호문을 모두 다시 암호화해야 한다. 이 재암호화 작업이 커서 택하지 않았다.
- **운영 환경에서도 평문 저장을 허용한다.** OAuth 토큰과 API 키가 평문으로 쌓인다.

이번에 정하지 않은 것도 있다.

- 부팅이나 마이그레이션 때 평문 행을 자동으로 다시 암호화할지는 정하지 않는다. 방법과 키 길이 계약은 NERV Task `CLE-T-C6GCKV` 가 정한다.
- 이 가드에 막히는 운영 배포의 이행 경로도 정하지 않았다. 키 없이 돌던 배포에는 그동안 평문으로 쓴 행이 남는다. 예시 값으로 돌던 배포는 키를 바꿔야 기동한다. 키를 바꾸면 예시 값으로 암호화한 행은 복호화되지 않는다. 이 행들을 새 키로 암호화하는 이행 경로도 NERV Task `CLE-T-C6GCKV` 가 맡는다. 이 항목은 2026-10-31 에 더했다(NERV Task `CLE-T-KQ37NJ`).
- 운영 환경 밖에서도 키가 없으면 기동을 멈출지(규칙 17 의 마스터키 처리와 같게)는 결정 때 견주지 않았다. 운영 환경 밖은 지금 동작(경고 후 평문 저장)을 유지했다. 두 키의 처리가 다른 이유는 따로 정하지 않았다. transformer 는 키가 없어도 동작하도록 만들어져 있다.

### R17. 운영 환경 가드의 키 거부 기준은 세션과 토큰 한 곳에 둔다 (2026-10-31)

규칙 17 · 26, 「마스터키」, R5, R13 은 운영 환경 가드가 두 암호화 키를 거부하는 기준(없음 · 공백뿐 · 공개 예시 값 · 앞뒤 공백을 뗀 값 대조)과 예시 값 목록의 정본을 저마다 적었다. [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) 과 [통합 데이터와 흐름](CLE-INT-DATA.md) 에도 같은 사본이 있었다. 가드 조건이 바뀌면 여러 문서를 함께 고쳐야 했다. 빠뜨려도 알려 주는 검사가 없었다. NERV Task `CLE-T-NAT45Z` 가 기준을 [세션과 토큰 「암호화 키 검사」](../CLE-ACCT/CLE-ACCT-SESSION.md#암호화-키-검사) 한 곳에 모았다. 이 규약에서 지금의 규칙을 말하는 문장은 링크로 바꿨다.

- 이 규약에 남는 것은 마스터키를 무엇에 쓰는지, 키를 어떻게 만드는지, `SecretResolver` 초기화가 없거나 빈 키를 막는 규칙(규칙 17)이다.
- 날짜가 붙은 기록은 그때의 사실이라 문장을 고치지 않았다. R5 의 2026-10-10 확장 단락과 R13 의 결정 목록이 그렇다.
- 정본을 이 규약에 두는 안도 견줬다. 그러면 가드 목록 가운데 두 키의 기준만 다른 문서로 떨어져 목록을 읽을 때 두 문서를 오가야 한다. 그래서 가드 목록이 있는 세션과 토큰을 정본으로 골랐다. 자세한 비교는 [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) 의 Rationale 에 있다.

### R18. store · rotate 는 빈 평문을 거부한다 (2026-11-06)

`store` · `rotate` 는 받은 평문을 검사하지 않았다. 빈 문자열도 그대로 암호화해 저장했다. 빈 비밀은 호출부마다 막아야 했고 그 가드가 빠진 경로가 두 곳 있었다.

- **트리거 생성.** 봇 토큰 입력에 `@MinLength(1)` 이 붙기 전에는 트리거 생성 경로에서 빈 문자열(`''`)이 검증을 통과했다. 빈 시크릿이 먼저 저장되고 그 뒤 채널 프로바이더 호출이 실패했다(실측).
- **채팅 채널 PATCH.** `setupChatChannel` 은 `cfg.botToken ?? ''` 를 조건 없이 `rotate` 했다. PATCH 본문에서 `botToken` 을 빼기만 했다면 저장된 봇 토큰이 빈 값으로 지워졌을 것이다. 당시에는 `botToken` 이 필수라 일어나지 않았다. [채팅 채널 「R-CC-21 PATCH 는 비밀을 쓰지 않는다」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-21-patch-는-비밀을-쓰지-않는다) 가 이 경로에서 비밀을 쓰지 않게 해서 닫았다. 그 항목의 「처방의 함정」 에 경위가 있다.

두 경로는 각각 막혔다. 그래도 호출부마다 막는 방식은 새 호출부가 가드를 빠뜨리면 다시 열린다. [채팅 채널 「R-CC-21 PATCH 는 비밀을 쓰지 않는다」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-21-patch-는-비밀을-쓰지-않는다) 는 `rotate` 의 빈 값 가드를 다른 호출부를 위해 따로 검토하기로 했고 [R10](CLE-INT-SECRET-REFS.md#r10-저장된-참조는-읽는-쪽도-다시-만들고-rotate-는-다른-워크스페이스의-행을-덮어쓰지-않는다-2026-10-04) 도 이 가드를 넣지 않았다. 2026-11-06 에 아래와 같이 정했다(NERV Task `CLE-T-94Z6A5`).

- **저장소가 빈 평문을 거부한다.** `store` · `rotate` 는 평문이 문자열이 아니거나 비었거나 공백만 있으면 throw 하고 행을 만들거나 바꾸지 않는다(규칙 27).
- **전용 에러 코드를 만들지 않는다.** HTTP 로 새면 일반 `INTERNAL_ERROR` 500 이고 메시지는 5xx 가림 문구다. 빈 값이 저장소까지 오면 고칠 쪽은 호출부 코드이고 클라이언트가 분기할 조건이 아니다. [R10](CLE-INT-SECRET-REFS.md#r10-저장된-참조는-읽는-쪽도-다시-만들고-rotate-는-다른-워크스페이스의-행을-덮어쓰지-않는다-2026-10-04) 이 `rotate` 의 워크스페이스 불일치 거부에 든 기준과 같다. 예외 메시지에 참조와 워크스페이스 id 를 싣지 않는 이유도 같다. 채팅 채널 설정은 실패 메시지를 화면에 보이는 `chat_channel_last_error` 에 저장한다(규칙 18).
- **호출부를 셌다.** 결정 때 `rotate` 호출부는 10곳이었다. 채팅 채널 바인더 3곳, 봇 토큰 재발급 3곳, 알림 서명 4곳이다. `store` 호출부는 없었다. 빈 값을 넘겨야 하는 호출부는 한 곳도 없었다.
- **빈 값은 호출부가 먼저 거른다.** 결정 때 새 요청의 입력이 규칙 27 에 걸려 500 이 되는 경로는 없었다. 사용자 입력은 호출부가 400 으로 먼저 거르고 서버가 발급하는 값은 비지 않는다(아래 표). 그래서 규칙 27 에 걸리면 호출부 가드가 빠진 결함으로 본다. 새 호출부가 사용자 입력을 저장하면 규칙 27 앞에 400 검증을 둔다.
- **재발급 백업은 비었거나 공백만 있는 옛 토큰을 건너뛴다.** 이 규칙이 생기기 전에 저장된 봇 토큰 가운데 비었거나 공백만 있는 행이 남아 있을 수 있다. 재발급이 그 값을 `bot-token.v2` 에 백업하려 하면 이 거부에 걸린다. 가드는 공백만 있는 값도 거부하므로 `''` 만 건너뛰면 `@MinLength(1)` 을 통과해 저장된 `" "` 같은 옛 행에서 재발급이 500 으로 실패한다. 이런 값은 보존할 토큰이 아니라서 백업을 건너뛴다(규칙 11).

결정 때 호출부별 선행 검증은 다음과 같았다. 마지막 행(EIA 옛 평문 옮기기)은 같은 날 같은 Task 에서 고친 뒤의 상태다. 고치기 전에는 공백만 있는 옛 평문이 400 없이 `rotate` 까지 갔다. 경위는 [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md) 의 Rationale 에 있다.

| 호출부 | 값의 출처 | 선행 검증 | 빈 값이 오면 |
| --- | --- | --- | --- |
| 봇 토큰 저장(생성 · 재발급) | 사용자 입력 | 1~256자의 보이는 ASCII 만 받는다. 생성은 DTO 가, 재발급은 컨트롤러가 본다([채팅 채널 「R-CC-32 봇 토큰 입력은 보이는 ASCII 만 받는다」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-32-봇-토큰-입력은-보이는-ascii-만-받는다)) | 400(생성 `VALIDATION_ERROR`, 재발급 `INVALID_BOT_TOKEN`) |
| Slack · Discord 인바운드 서명 자료(`inboundSigningPlaintext`) | 사용자 입력(채널 프로바이더가 발급한 값) | DTO 가 32~128자를 보고 채널 프로바이더별 lowercase hex 형식(Slack 32자, Discord 64자)을 본다. 바인더는 비어 있지 않은 문자열일 때만 `rotate` 한다 | 400 |
| Telegram 인바운드 서명 자료(`secret_token`) | 서버 발급(`randomBytes(24)`) | 없다. 사용자 입력이 아니다 | 생기지 않는다 |
| EIA 알림 서명 시크릿(첫 발급 · 교체 · 승격) | 서버 발급(`wsk_*`) | 없다. 요청 본문(`NotificationSigningDto`)은 `algorithm` 만 받는다. 승격은 v2 가 비어 있으면 건너뛴다 | 생기지 않는다 |
| EIA 옛 평문 옮기기 | 2026-10-31 전에 원시 `config` 로 받아 저장된 옛 평문 `signing.secret` | `readStoredSigningSecret` 과 `migrateLegacyPlaintext` 가 같은 판정 `isUsableLegacyPlaintext` 를 쓴다. 비었거나 공백만 있는 값은 «없음» 으로 보고 `rotate` 에 넘기지 않는다. 새 값은 더 받지 않는다([R16](CLE-INT-SECRET-REFS.md#r16-원시-config-의-타입-키와-secret-값을-막는다-2026-10-31)) | 옮기지 않는다. `notification` 이 실린 PATCH(`settle`)가 그 행에 새 `wsk_*` 를 발급한다. 기준은 [EIA 알림 웹훅 「시크릿 교체」](../CLE-IX/CLE-EIA-NOTIFY.md#시크릿-교체) 다 |

기각한 대안:

- **`allowEmpty` 옵션을 둔다.** 빈 값이 필요한 호출부가 한 곳도 없다. 쓰는 곳 없는 옵션은 가드를 끄는 길만 열어 둔다.
- **호출부 책임으로 문서에 적는다.** 위 두 경로는 호출부 가드가 빠지면 빈 비밀이 조용히 저장된다는 것을 보였다. 문서에 적어도 새 호출부가 가드를 빠뜨리는 일은 막지 못한다.
