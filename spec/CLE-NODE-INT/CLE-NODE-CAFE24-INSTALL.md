---
id: "CLE-NODE-CAFE24-INSTALL"
title: "Cafe24 노드 — 앱 설치 엔드포인트"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-CAFE24"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT", "CLE-NODE-CAFE24"]
area: "CLE-NODE-INT"
content_hash: "63209d51c88f42d36cb4ea12096ebefbb4075de23e438622d2a648134bdb8584"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "e477c4ba4c651c9592a7f8306dd550e448b384a6e2a15329a5287467cc69a58f"
etag: "sha256-3562c630ccea4f29194e0a214404632b6db9aac24a95b567ebad68fd8672bf70"
---
## 개요

이 문서는 [Cafe24 노드](CLE-NODE-CAFE24.md) 의 하위 문서로 Private 앱 설치 엔드포인트(App URL)의 보안 계층과 OAuth 권한 범위 구분자 규칙을 정한다.

## Private 앱 설치 엔드포인트

Cafe24 앱은 모두 Cafe24 Developers 에서 만든다. 앱스토어에 등록(심사 완료 또는 대기)한 Public 앱은 서버 환경 변수 `CAFE24_CLIENT_ID`·`CAFE24_CLIENT_SECRET` 으로 OAuth 를 진행하고, 우리 서비스가 인가 URL 팝업을 직접 연다. 심사를 제출하지 않은 Private 앱(최대 5개 쇼핑몰)은 우리 서비스가 OAuth 를 시작할 수 없다. Cafe24 Developers 의 "테스트 실행" 이 우리 App URL(`GET /api/3rd-party/cafe24/install/:installToken?mall_id=...&hmac=...`)을 부르며 흐름을 시작한다. 설치의 사용자 흐름 전체(설치 대기 통합 생성, 콜백, 실패 보존, 24시간 설치 시간 초과)는 [OAuth 연결과 토큰 갱신 §설치 우선 흐름](../CLE-INT/CLE-INT-OAUTH.md#설치-우선-흐름-cafe24-privatemakeshop)이, 엔드포인트의 가드 순서는 [같은 문서 §설치 엔드포인트](../CLE-INT/CLE-INT-OAUTH.md#설치-엔드포인트-app-url)가 정한다. 이 절은 App URL 엔드포인트 보안 계층의 알고리즘·키·상수를 정한다.

### Redis 키 (normative)

App URL 설치 엔드포인트가 쓰는 Redis 키는 두 계열이다. 키 형태 규칙과 전체 인벤토리는 [Redis 키 명명 규약](../CLE-ENG/CLE-ENG-REDIS.md)과 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md)이 단일 기준이고, 용도·TTL·Redis 미가용 시 동작은 이 절이 단일 기준이다.

| 키 | 용도 | TTL | Redis 미가용 시 |
|----|------|-----|-----------------|
| `cafe24:install:nonce:<mall_id>:<timestamp>:<hmac 앞 8자>` | HMAC 검증을 통과한 (mall_id, timestamp, hmac) 튜플을 기록해 같은 윈도우 안 재전송을 `CAFE24_INSTALL_REPLAY` 로 거절 | 10분 | 건너뛴다. ±5분 윈도우 정책으로 돌아간다 |
| `cafe24:install:fail:<ip>` | `install_token` 조회·HMAC **실패**만 IP 별로 센다(성공한 설치는 세지 않음). `INSTALL_FAIL_THRESHOLD` 를 넘으면 `429 CAFE24_INSTALL_RATE_LIMITED` | `INSTALL_FAIL_WINDOW_SEC` | 건너뛴다(fail-open) |

상수 **값**은 [관련 코드 상수](#관련-코드-상수) 표가 단일 기준이고 여기서는 이름으로만 가리킨다(두 곳에 적으면 어긋난다).

두 키 모두 끄는 쪽이 안전한 순수 강화 층이다. 메모리 대체 수단이 없어서 Redis 가 없을 때 차단을 유지하면 정상 설치가 막힌다. 새 키를 만들면 이 절과 인벤토리를 함께 고친다.

### HMAC 검증 알고리즘

Cafe24 는 App URL 을 부를 때 HmacSHA256 + Base64 서명(`hmac` 파라미터)을 함께 보낸다. 설치 엔드포인트는 이 서명을 검증한다. 공식 문서와 공식 Java 샘플 기준 알고리즘은 다음과 같다.

1. `hmac` 을 뺀 나머지 쿼리 파라미터를 key 기준 알파벳순으로 정렬한다.
2. **원본 URL 인코딩 값을 그대로** `key=raw-value&...` 로 이어 붙인다. decode·re-encode 하지 않는다. 공식 Java 샘플 `validationCheckHmac` 는 `request.getQueryString()` 을 `&` 로 나눈 뒤 `=` 로 한 번만 나눠 value 를 원본 그대로 TreeMap 에 저장한다. URL 에 `%20` 으로 왔으면 HMAC 메시지에도 `%20`, `+` 로 왔으면 `+` 를 유지한다. 값의 뜻을 해석하지 않고 바이트 단위로 맞추는 것이 정답이다.
3. `client_secret` 을 키로 HmacSHA256 해싱한다.
4. 결과를 Base64 로 인코딩한다.
5. URL-decode 한 `hmac` 파라미터 값과 timing-safe 로 비교한다.

```typescript
// Cafe24 는 URL 의 값을 decode/re-encode 없이 원본 그대로 HMAC 메시지에
// 쓴다. `%20` 을 `+` 등으로 바꾸면 바이트가 어긋나므로 원본 보존이 불변식이다.
function buildHmacMessage(rawQuery: string): string {
  return rawQuery
    .split('&')
    .map((part) => {
      const eqIdx = part.indexOf('=');
      const key = eqIdx === -1 ? part : part.slice(0, eqIdx);
      return { key, raw: part };
    })
    .filter((p) => p.key.length > 0 && p.key !== 'hmac')
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((p) => p.raw)
    .join('&');
}

function verifyHmac(rawQuery: string, clientSecret: string, receivedHmac: string): boolean {
  const message = buildHmacMessage(rawQuery);
  const computed = createHmac('sha256', clientSecret).update(message, 'utf8').digest('base64');
  return timingSafeEqual(Buffer.from(computed), Buffer.from(receivedHmac));
}
```

### 추가 보안 조치

- `timestamp` 가 ±5분 밖인 요청은 재전송 공격 방어를 위해 즉시 거부한다(`CAFE24_INSTALL_REPLAY`).
- HMAC 이 맞지 않으면 `403 CAFE24_INSTALL_INVALID_HMAC` 로 거절하고 에러 상세를 보이지 않는다.
- **nonce 캐시**(`Cafe24InstallNonceCache`): ±5분 윈도우와 HMAC 검증을 둘 다 통과한 (mall_id, timestamp, hmac) 튜플을 [Redis 키](#redis-키-normative) 표의 nonce 키에 10분 TTL 로 기록해 "유효한 HMAC + 같은 timestamp 재전송" 까지 막는다. Redis 가 없거나 통신이 실패하면 ±5분 윈도우 정책으로 돌아간다. 운영 환경에서는 BullMQ 가 이미 쓰는 Redis 를 함께 쓰므로 추가 비용이 없다.
- **nonce 키 구성**: `cafe24:install:nonce:{mall_id}:{timestamp}:{hmac 앞 8자}`. base64 hmac(약 44자) 전체 대신 앞 8자만 써서 키 길이를 줄인다(충돌 확률은 [관련 코드 상수](#관련-코드-상수)). 충돌해도 이미 HMAC 검증을 통과한 요청이라 보안 영향은 없고, 드물게 정상 재시도가 재전송으로 거절될 뿐이다. 이 충돌은 nonce 키의 고유성 문제이며 `install_token` capability 가정이나 HMAC 암호 강도와는 무관하다.
- **호출 제한(열거 공격 방어, 심층 방어)**: 설치 엔드포인트는 capability-token 가정(`install_token` 은 128bit 이상 무작위라 추측 불가) 위에 두 겹의 운영 방어를 더한다.
  - 1층, IP 제한(IP 당 분당 30회): `@Throttle({ limit: 30, ttl: 60_000 })`. 인증 없는 경로라 `UserThrottlerGuard` 의 IP 대체 키를 쓴다. 현재는 `@nestjs/throttler` 기본 저장소라 인스턴스마다 메모리에 따로 세어 quota 가 인스턴스별로 나뉜다. Redis 분산 저장소로 옮기는 일은 모든 제한 엔드포인트에 영향을 주는 전역 저장소 교체라 미뤘다. 열거 방어의 핵심은 인스턴스를 넘나드는 2층이 맡으므로 1층 분산화는 보강 성격이다.
  - 2층, 실패 페널티 잠금: `install_token` 조회·HMAC 검증이 **실패**한 요청(`CAFE24_INSTALL_INVALID_TOKEN`·`CAFE24_INSTALL_INVALID_HMAC`)만 IP 별 카운터 `cafe24:install:fail:{ip}` 를 `INCR`(EX `INSTALL_FAIL_WINDOW_SEC`)한다. `INSTALL_FAIL_THRESHOLD` 를 넘으면 HMAC 검증과 행 조회 전에 `429 CAFE24_INSTALL_RATE_LIMITED` 로 즉시 거절한다. 성공한 설치(302 리다이렉트)는 세지 않으므로 정상 사용자(유효한 토큰, 적은 요청)는 영향이 없고 대량 실패인 열거만 겨냥한다. Redis 가 없으면 건너뛰고(fail-open) 기존 정책(±5분 윈도우 + capability-token)으로 돌아간다. 메모리 대체 수단이 없는 순수 강화 층이라 차단을 유지하면 정상 설치가 막히기 때문이며, 1층(메모리 대체)과 의도적으로 다른 저하 경로다.

### 식별 전략

App URL 경로의 `:installToken` 으로 통합 **한 행**을 조회한다. 상태와 무관하다(`pending_install`·`connected`·`error(*)`·`expired` 모두 대상). 조회한 행의 `client_secret` 으로 HMAC 을 **한 번만** 검증한다. 메모리에서 후보를 훑으며 HMAC 을 여러 번 시험하는 방식 대신 이렇게 해서 중복 시나리오와 O(N) 비용을 함께 없앤다. 검증을 통과한 행은 설치 대기이거나 유효한 [재설치 대기 표시](../CLE-INT/CLE-INT-OAUTH.md#재설치-대기-표시)가 있으면 OAuth 인가로, 그 밖이면 상세 화면으로 보낸다. 그래서 오류·만료됨 행도 통합 재인증 뒤 "테스트 실행" 으로 복구할 수 있다. 분기 규칙은 [OAuth 연결과 토큰 갱신 §설치 엔드포인트](../CLE-INT/CLE-INT-OAUTH.md#설치-엔드포인트-app-url)가 정한다.

- 한 행 조회가 실패하면 `install_token` 불일치 회복 흐름(`tryRecoverByMallId`)이 좁은 대체 경로로 동작한다. `mall_id` 가 같은 후보(상한 `RECOVERY_CANDIDATE_LIMIT=5`)의 `client_secret` 으로 HMAC 을 한 번씩 시험한다. 정확히 1개가 통과하면 그 행으로 진행하고, 0개나 여러 개면 회복을 포기한다. 보안 전제와 DoS 보호는 [OAuth 연결과 토큰 갱신 Rationale](../CLE-INT/CLE-INT-OAUTH.md#설치-토큰-불일치-회복-흐름)에 있다.
- 응답 코드: 회복 흐름 뒤에도 토큰이 없으면 `404 CAFE24_INSTALL_INVALID_TOKEN`, HMAC 불일치는 `403 CAFE24_INSTALL_INVALID_HMAC`, timestamp 윈도우 초과는 `400 CAFE24_INSTALL_REPLAY`, 파라미터 누락은 `400 CAFE24_INSTALL_MISSING_PARAMS`, 같은 IP 의 조회·HMAC 실패가 `INSTALL_FAIL_THRESHOLD` 를 넘으면 `429 CAFE24_INSTALL_RATE_LIMITED` 다.
- `install_token` 은 통합이 사는 동안 보존한다. 통합을 삭제하거나 `pending_install → expired(install_timeout)` 24시간 TTL 이 지날 때만 NULL 로 지운다.
- 식별 방식을 `mall_id` 훑기에서 `install_token` 단일 조회로 바꾼 배경은 [OAuth 연결과 토큰 갱신 Rationale](../CLE-INT/CLE-INT-OAUTH.md#설치-토큰을-app-url-경로의-식별-키로-올렸다)에 있다.

### 관련 코드 상수

| 상수 | 값 | 뜻 |
|------|----|----|
| `RECOVERY_CANDIDATE_LIMIT` | `5` (코드 상수, 환경 변수 아님) | `install_token` 불일치 회복 흐름의 HMAC 시험 상한. 워크스페이스를 넘어 같은 `mall_id` 가 5건을 넘으면 회복을 포기한다(DoS 증폭 차단). 정상 운영에서 `mall_id` 당 Cafe24 행은 보통 1~2건이다 |
| nonce 키 hmac 접두 길이 | `8` (코드 리터럴, `Cafe24InstallNonceCache.buildKey`) | Redis nonce 키의 hmac 부분 길이. base64 8자는 약 48bit, 약 2.8e14 공간이라 충돌을 무시할 수 있다. 키 길이를 줄이려는 값이며, 바꾸면 `buildKey` 의 `slice(0, 8)` 도 함께 고친다 |
| `INSTALL_FAIL_THRESHOLD` | `10` (코드 상수, 환경 변수 아님) | IP 별로 허용하는 `install_token` 조회·HMAC 실패 횟수(2층). 윈도우 안에서 넘으면 `429 CAFE24_INSTALL_RATE_LIMITED`. 유효한 토큰을 쓰는 정상 사용자는 실패하지 않아 영향이 없다 |
| `INSTALL_FAIL_WINDOW_SEC` | `600` (10분, 코드 상수) | 실패 카운터(`cafe24:install:fail:{ip}`)의 Redis TTL. nonce TTL(10분)과 같은 여유 |

## Rationale

### OAuth 권한 범위를 콤마로 보내는 이유 (RFC 6749 예외)

Cafe24 의 `/oauth/authorize` 는 RFC 6749 §3.3 의 공백 구분이 아니라 **콤마 구분** 권한 범위를 요구한다(자체 규약). 그래서 인가 시작 단계에서 `service.oauthProvider === 'cafe24'` 분기로 `,` 를 쓴다. 다른 OAuth 제공자(google, github)는 표준 공백 구분을 쓴다.

공백이나 `+` 로 보내면 Cafe24 가 전체 문자열을 토큰 하나로 해석한다. 그래서 권한 범위 하나(예: `mall.read_product`)만 보내도 `invalid_scope` 가 돌아온다. 이 증상은 "사용자 앱 권한 사전 등록 누락" 으로 오진하기 쉬워서 여기에 적는다.

확인 출처:

- `https://developers.cafe24.com/app/front/app/develop/oauth/oauthcode` 의 인증 코드 요청 예시 URL: `scope=mall.read_application,mall.write_application`
- 공식 샘플 앱 `cafe24-app/cafe24_app_sample` 의 `StoreToken.java#getCodeRedirectUrl`: `APP_SCOPE` 를 `&scope=` 에 그대로 이어 붙인다(공백·특수 인코딩 없음)
- velog `@yl9517` 의 `mall.read_product` 하나를 콤마 구분으로 보낸 정상 동작 사례

회귀 보호: `codebase/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` 가 인가 URL 에 `scope=...%2C...` 가 들어 있는지, `+`·`%20` 으로 돌아가지 않는지 검증한다.
