---
id: "CLE-INT-OAUTH-REFRESH"
title: "OAuth 연결과 토큰 갱신 — 토큰 자동 갱신"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT-OAUTH"
ancestors: ["CLE-VISION", "CLE-INT", "CLE-INT-OAUTH"]
area: "CLE-INT"
content_hash: "040855e05cbc4ee164342ae01e733e69d3a95cefa93c404798a7c475525d6764"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "2bbf0f8ed0c92eb1fdd0e6b3d8418d6560e9f0cc19361efc45a582f545d2b220"
etag: "sha256-33754c32c561cc822c1a19001d4ecea6b0c2c2a1be9b8e18c730751521436bbd"
---
## 개요

이 문서는 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md) 의 하위 문서로 토큰 자동 갱신의 경로, 만료 시각의 기준, 갱신 큐를 정한다.

## 토큰 자동 갱신

refresh token 을 갖고 제공자가 발급·갱신을 보장하는 통합은 Cafe24·MakeShop 이다. 노드가 외부 API 를 부르기 직전에 만료를 확인하고 만료됐거나 곧 만료되면 갱신한 뒤 부른다. Google 은 refresh token 을 받지만 갱신 경로가 없고 이 통합을 쓰는 노드도 없다. 서비스 레지스트리의 `supportsTokenAutoRefresh` 가 true 라 자동 갱신 표시(`autoRefresh`)는 true 로 나간다. 이 불일치는 [통합 상태와 만료 알림](CLE-INT-STATUS.md) 의 미결 사항이다. `autoRefresh` 는 상태 배지, 주의 필요 술어, 통합 재인증 hover 안내의 분기 신호다.

### 갱신 경로

| 경로 | source | 언제 |
| --- | --- | --- |
| 호출 직전 갱신 | `proactive` | API 호출 직전 `ensureFreshToken` 이 만료가 지났거나 곧 지남을 보았을 때 |
| 401 뒤 갱신 | `reactive_401` | 호출 직전 갱신이 경쟁 조건(DB `expires_at` 미동기, 여러 인스턴스, NULL 인 옛 행 등)으로 빗나가 만료 토큰으로 부른 호출이 401 을 받았을 때 |
| 배경 갱신 | `background` | Cafe24 `cafe24-background-refresh` 작업(6시간), `connected-expiry` 당일 분기, AI 에이전트 내부 MCP 브리지의 `expired` 통합 자가 회복 |

- **401 뒤 갱신**: refresh token 으로 access token 을 갱신한 뒤 같은 요청을 **한 번만** 다시 보낸다. 다시 보낸 요청이 2xx 면 상태는 계속 연결됨이다. 애초에 낮추지 않는다. 다시 보내도 401 이면 토큰 자체의 문제로 보고 `error(auth_failed)` 로 바꾼다([Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md)). 403 은 이 대상이 아니다(갱신으로 해결되지 않는다). 재시도 횟수는 429 rate limit 재시도와 별개로 센다. 연결 테스트의 401 처리([서비스별 인증 방식과 자격 증명](CLE-INT-AUTH.md))와 같은 정책이다.
- **갱신 실패**: refresh token 자체가 무효(`invalid_grant`)면 `error(auth_failed)` 로 바꾼다. transport 실패가 3회 연속이면 `error(network)` 로 바꾼다. 이 전이에는 조치 필요 알림이 나간다([통합 상태와 만료 알림](CLE-INT-STATUS.md)).
- **갱신 성공**: `credentials.access_token`·`credentials.refresh_token`·`credentials.expires_at`·`Integration.token_expires_at` 네 값을 **한 트랜잭션의 원자 UPDATE** 로 바꾼다. 일부만 쓰면 다음 노드 실행이 어긋난 토큰 상태를 쓰게 된다. `last_rotated_at` 도 함께 갱신해 배경 갱신의 기준 시각 비교에 쓴다.
- **Cafe24 만**: 갱신 endpoint 도 `https://{credentials.mall_id}.cafe24api.com/api/v2/oauth/token` 이다. `mall_id` 가 없으면 `INTEGRATION_INCOMPLETE` 로 바로 실패한다.
- **MakeShop**: refresh token 이 매번 바뀌므로 갱신할 때마다 새 refresh token 을 저장한다. 배경 갱신 작업은 없다. 호출 직전 갱신과 401 뒤 갱신으로 충분하다.
- **Cafe24 의 `expired`**: 배경 갱신이 닿기 전에 access token 이 만료돼도 스캐너는 Cafe24 행을 `expired` 로 낮추지 않고 갱신 큐에 넣는다. 그래서 Cafe24 의 `expired` 는 사실상 `install_timeout` 하나만 남는다. refresh token 이 유효한데 access token 만 만료된 통합이 `expired` 가 되어 AI 에이전트와 노드의 자가 회복을 막던 회귀를 없앴다.

### 만료 시각의 기준

Cafe24 의 `access_token`·`refresh_token` 은 JWT 다. 그래서 JWT `exp` claim(RFC 7519, UTC 기준 Unix epoch 초)을 만료 시각의 단일 기준으로 쓴다.

- 콜백의 토큰 교환 정규화(`parseTokenExpiresAt`)와 갱신 경로(`refreshAccessToken`)는 먼저 `parseJwtExp(token)` 을 불러 그 값을 쓴다. JWT 디코드가 실패해 null 일 때만 표준 `expires_in` → Cafe24 의 `expires_at` ISO(시간대 표시가 없으면 `+09:00` KST 로 정규화) → 2시간 기본값 순서로 내려간다.
- 호출 직전 갱신과 워커의 판정(`resolveTokenExpiry`)도 JWT `exp` → `Integration.tokenExpiresAt` → `credentials.expires_at` 순서다.
- 워커의 «아직 충분히 남았다» 건너뛰기 판정은 `parseJwtExp(access_token)` 만 믿는다. JWT `exp` 가 null 이거나 지났으면 건너뛰지 않고 늘 갱신한다. `source='reactive_401'` 이면 건너뛰기 판정 자체를 하지 않는다. 호출자가 실제로 401 을 받았다는 신호라 어떤 만료 정보도 믿을 수 없다.
- JWT 서명은 검증하지 않는다. 만료 시각만 꺼내는 용도라 필요 없고 토큰 진위는 Cafe24 API 호출 때 확인된다.

### 갱신 큐

| 큐 | producer | consumer | payload | 중복 제거 |
| --- | --- | --- | --- | --- |
| `cafe24-token-refresh` | ① `Cafe24ApiClient` 호출 직전(`proactive`) ② `cafe24-background-refresh` 작업(`background`) ③ `connected-expiry` 당일 분기(`background`) ④ `Cafe24ApiClient.performAuthRefresh` 401 뒤(`reactive_401`) ⑤ `Cafe24McpToolProvider` 의 `expired` 자가 회복 `refreshTokenViaQueue(integration, 'background')` | `Cafe24TokenRefreshProcessor` (`Cafe24Module`) | `{ integrationId, source: 'background' \| 'proactive' \| 'reactive_401' }` | `proactive`·`background` 는 `jobId = integrationId` 로 같은 통합의 갱신을 워커 한 번으로 모은다. `reactive_401` 은 `jobId = ${integrationId}#reactive-${Date.now()}-${rand6}` 로 중복 제거를 건너뛰고 pod 사이 직렬화는 `refreshAccessToken` 의 PostgreSQL `pessimistic_write` 행 잠금이 맡는다. 워커는 jobId 가 아니라 `payload.integrationId` 로 통합을 찾는다 |
| `makeshop-token-refresh` | ① `MakeshopApiClient` 호출 직전(`proactive`) ② `MakeshopApiClient` 401 뒤(`reactive_401`) ③ `MakeshopMcpToolProvider` 의 `expired` 자가 회복(`background`). 배경 cron 은 없다 | `MakeshopTokenRefreshProcessor` (`MakeshopModule`) | `{ integrationId, source: 'proactive' \| 'background' \| 'reactive_401' }` | Cafe24 와 같은 방식. Cafe24 와 큐를 공유하지 않는다(토큰 endpoint 와 회전 정책이 다르다) |

- 보존: `removeOnComplete: { age: 60 }`, `removeOnFail: { age: 300 }`(모든 source 공통).
- 재시도: `attempts: 1`. 워커의 `process()` 는 갱신 실패를 삼키지 않고 다시 던져 BullMQ 가 작업을 `failed` 로 남기게 한다. `.catch(logger.error)` 로 흡수하지 않는다. 흡수하면 작업이 `completed` 로 기록돼 «갱신이 조용히 실패하는» 관측 사각지대가 생긴다. 큐 수준 재시도는 하지 않는다. 다시 시도는 호출자(다음 API 호출의 401 뒤 갱신, 다음 `cafe24-background-refresh`·`connected-expiry` 주기)가 한다. 회귀 고정은 `cafe24-token-refresh.processor.spec.ts` TEST-C2(`process()` 재던짐 단언)다.
- 삭제된 통합(행 없음)은 실패가 아니라 아무것도 하지 않고 끝낸다.
- 워커는 DB 에서 행을 다시 읽어 확인한 뒤 `refreshAccessToken` 을 부르고 네 값을 원자 UPDATE 한다. 연결됨이 아닌 행은 건너뛴다.
- 실패의 사용자 표면은 이 큐가 아니라 `error(auth_failed)` 전이와 조치 필요 알림이다. 운영 관측은 OTel 파이프라인이 받는다([비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md) NF-OB-02·03·07).
- 이 큐는 갱신 호출의 pod 사이 직렬화만 맡는다. Cafe24 API 호출 자체(leaky bucket)는 `Cafe24ApiClient` 의 메모리 mutex 가 같은 pod 안에서만 직렬화한다. Cafe24 bucket 은 상점 단위 할당이라 pod 사이 직렬화가 필요 없다.
- 큐가 연결되지 않은 환경(단위 테스트)에서는 프로세스 안에서 `refreshAccessToken` 을 바로 부른다. 운영 배선은 늘 큐를 거친다.
- 큐 전체 목록은 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 이 기준이다.

## 구현 위치

- `codebase/backend/src/modules/integrations/jwt-exp.ts`, `cafe24-token-utils.ts`
- `codebase/backend/src/nodes/integration/cafe24/`, `codebase/backend/src/nodes/integration/makeshop/` (API 클라이언트, 갱신 큐 워커)

## Rationale

### 여러 인스턴스의 갱신 경쟁은 BullMQ `jobId` 중복 제거로 푼다

[Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md) 가 미뤄 둔 pod 사이 갱신 경쟁을 BullMQ 큐로 풀었다. 두 pod 가 같은 옛 refresh token 으로 동시에 갱신하면 한쪽 토큰이 고아가 되거나, Cafe24 회전 정책 때문에 한쪽이 `invalid_grant` 를 받고 잘못 `error(auth_failed)` 가 될 수 있었다. `proactive`·`background` 는 `jobId = integrationId` 중복 제거로 워커 한 번에 모이고 호출자는 `waitUntilFinished` 로 같은 결과를 받는다.

뺀 안: PostgreSQL advisory lock 은 잠금을 쥔 채 Cafe24 HTTP 요청을 트랜잭션에 묶어 커넥션 점유가 길어지고 BullMQ 가 이미 있어 별도 메커니즘 부담이 크다. Redis redlock 은 따로 잠금 메커니즘을 운영해야 한다. 메모리 mutex(`withIntegrationLock`)만 두면 여러 pod 에서 경쟁이 남는다. 이 결정은 토큰 갱신에 한한다. MakeShop 설치 대기 행 재사용은 트랜잭션 안에서 외부를 부르지 않아 advisory lock 을 쓴다([설치 대기 행 재사용의 권한](CLE-INT-OAUTH-PENDING.md#설치-대기-행-재사용의-권한)).

### 갱신 워커는 실패를 다시 던지고 `attempts: 1` 로 둔다 (2026-07-17)

흡수하면 작업이 `completed` 로 남아 큐 메트릭과 실패 목록에서 사라지고 갱신 실패가 `error(auth_failed)` 로 사용자에게 닿기까지의 진단 경로가 끊긴다. 그래도 재시도하지 않는 이유는 갱신 실패가 거의 늘 끝난 실패(refresh token 만료, Cafe24 무효화)라 재시도가 같은 401 과 알림만 늘리기 때문이다. 다시 시도는 호출자가 자연스럽게 한다. 만료 스캐너 작업의 `attempts: 3` 은 일시적 실패로 한 주기를 잃지 않으려는 것이라 성격이 다르고 두 값이 함께 있는 것은 모순이 아니다.

이 정책은 2026-06-02 에 «관측 인프라를 한꺼번에 들일 때 명시한다» 며 미뤘다. 2026-06-14 에 OTel 파이프라인이 들어와 NF-OB-02·03·07 이 구현되면서 조건이 충족됐다. 코드는 이미 이 정책을 구현하고 있었고 남은 것은 스펙 명시뿐이었다. 번복이 아니라 예정된 재개다.

### 401 을 받으면 갱신하고 한 번 다시 보낸다

최초 연결 직후 호출은 정상인데 access token 이 만료된 뒤(refresh token 은 유효) 부르면 401 을 받고 갱신 없이 바로 `error(auth_failed)` 가 되어 사용자가 통합 재인증을 강요당했다. 호출 직전 갱신이 경쟁 창에서 빗나간 탓이었다. `expires_at` 이 NULL 인 옛 행, 여러 인스턴스의 캐시 미동기, DB 쓰기와 시계의 미세한 어긋남이다. 그래서 연결 테스트(`pingConnection`)가 쓰던 «401 → 갱신 → 1회 재시도» 를 `Cafe24ApiClient.executeWithRateLimit()` 의 401 분기에도 적용했다. 403 은 갱신으로 해결되지 않아 바로 낮춘다.

- 호출 직전 창을 넓히면(60초 → 5분) 경쟁 창만 좁을 뿐 여러 인스턴스의 캐시 미스는 남는다.
- 여러 번 재시도하면 refresh token 이 무효일 때 알림 폭탄과 `/oauth/token` rate limit 위반을 부른다.
- 바로 낮추고 통합 재인증을 하게 두면 갱신할 수 있는 경우를 거짓 실패로 만든다.

외부 MCP 서버([MCP 클라이언트](CLE-INT-MCP.md))는 refresh token 이 없어 401 이면 바로 낮추는 정책이 그대로 맞다. refresh token 을 가진 서비스의 401 뒤 갱신은 우리 서버가 명시적으로 갱신하는 정상 단계이고 낮추기 전에 일어나 상태가 오가지도 않는다. 적용 범위는 Cafe24 노드와 내부 MCP 브리지의 `call()` 경로와 `pingConnection()` 이다. 외부 MCP, 403, 갱신 자체의 401·403, 429·5xx·transport 는 대상이 아니다.

### Cafe24 토큰 만료 시각의 기준을 JWT `exp` 로 올렸다

호출 직전 갱신과 401 뒤 갱신이 모두 있는데도 같은 401 이 되풀이될 수 있었다. `Date.parse` 가 시간대 없는 ISO 를 서버 지역 시간으로 해석해(ECMA-262) UTC 컨테이너에서 `tokenExpiresAt` 이 틀리게 저장됐고 워커의 건너뛰기 판정이 그 값을 믿어 401 뒤 갱신도 실제로 갱신하지 않았다. 네 겹의 방어가 모두 같은 잘못된 값을 믿어 무력해졌다. 그래서 Cafe24 토큰이 JWT 라는 사실에 근거해 JWT `exp`(RFC 7519, UTC 절대 시각)를 단일 기준으로 올렸고 워커는 `source='reactive_401'` 이면 건너뛰기 판정을 하지 않는다. 다른 실측 신호 경로가 생기면 `reactive_<signal>` 형식으로 넓힌다.

- `parseTokenExpiresAt` 만 고치면 이미 잘못 저장된 행이 회복하지 못한다.
- 워커 판정만 없애면 정상 상태에서도 매 호출이 401 을 한 번씩 받는다.
- Cafe24 에 응답 정규화를 요청하는 것은 기한을 알 수 없는 외부 의존이다.

JWT 서명은 검증하지 않는다. Cafe24 가 토큰을 불투명 형식으로 바꾸면 대체 순서로 내려간다. `+09:00` 보정은 Cafe24 운영 시간대 기준 추정이고 JWT `exp` 가 우선이다. 이보다 앞선 결정(Cafe24 응답에 `expires_in` 이 없어 `token_expires_at` 이 NULL 로 저장되던 문제를 `expires_at` 파싱, 2시간 기본값, NULL 을 «갱신 필요» 로 해석해 고친 것)은 여기에 흡수됐다. 회귀 테스트는 `jwt-exp.spec.ts`, `integration-oauth.service.cafe24.spec.ts`, `cafe24-api.client.spec.ts`, `cafe24-token-refresh.processor.spec.ts` 에 있다.

### `reactive_401` 은 고유 jobId 로 중복 제거를 완전히 건너뛴다

JWT `exp` 결정 뒤에도 두 결함이 남았다.

- **A.** BullMQ `addStandardJob` Lua 스크립트는 같은 `jobId` 의 작업이 어떤 상태로든 Redis 에 있으면 기존 작업을 돌려주고 새 add 의 옵션을 적용하지 않는다. 그래서 `removeOnComplete: { age: 0 }` 로는 `proactive` 가 완료 뒤 60초 남아 있는 동안 들어온 `reactive_401` 이 그 완료된 작업으로 합쳐지는 것을 막지 못했다. 워커가 새로 돌지 않아 호출자는 낡은 토큰으로 두 번째 401 을 받았다.
- **B.** 워커 판정이 `resolveTokenExpiry` 의 대체 순서까지 믿어, JWT `exp` 파싱이 실패하면 틀린 미래 시각으로 건너뛰었다.

그래서 `reactive_401` jobId 를 `${integrationId}#reactive-${Date.now()}-${rand6}` 로 고유하게 만들고 pod 사이 직렬화는 `refreshAccessToken` 의 `pessimistic_write` 행 잠금에 맡긴다. 워커 판정은 `parseJwtExp(access_token)` 만 믿는다. 호출자 쪽 `ensureFreshToken` 판정은 그대로다(거짓 양성 비용은 enqueue 한 번뿐이다).

- 메모리 mutex(`withIntegrationLock`)는 `reactive_401` 의 같은 pod 안 직렬화 보조로 다시 쓰인다. 앞 결정에서 «메모리 mutex 만 유지» 를 뺀 이유는 pod 사이 경쟁이었고 이번에는 DB 행 잠금과 조합한 역할 재배치다.
- `reactive_401` 에 한해 «워커 한 번 결과를 공유한다» 는 불변식을 풀었다. 두 pod 가 모두 갱신해 한쪽이 `invalid_grant` 로 `markAuthFailed` 까지 가는 fail-safe 결과를 받아들인다. 401 뒤 갱신 자체가 드물어 실제로는 거의 없다.
- 뺀 안: add 직전 `Queue.removeJob`(진행 중 갱신을 끊는다), 큐를 건너뛴 직접 갱신(보존·관측 일관성을 잃는다).
