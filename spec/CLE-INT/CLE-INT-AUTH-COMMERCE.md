---
id: "CLE-INT-AUTH-COMMERCE"
title: "서비스별 인증 방식과 자격 증명 — Cafe24 · MakeShop"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT-AUTH"
ancestors: ["CLE-VISION", "CLE-INT", "CLE-INT-AUTH"]
area: "CLE-INT"
content_hash: "38145f9cd8e4faed073a03f4e49c6d4e9d64e5d3e04be7f0d3ea8f5c7f55c7e8"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/2-navigation/4-integration.md"]
mirror_sha256: "be44e24a4c9b3fbdc00db0beb7f8ee990d18d3f95d4806c23ab634dadb23b642"
etag: "sha256-dc104fcc935e2a2c8af6bce647309ce849278bcb33c7a22fe1f5d8d6bf876491"
---
> 구현 상태: 구현됨 · 원문: `spec/2-navigation/4-integration.md` (§5, Rationale «연결 테스트 endpoint 를 /store 에서 /apps 로 전환») · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 [서비스별 인증 방식과 자격 증명](CLE-INT-AUTH.md) 의 하위 문서로 Cafe24 · MakeShop 통합의 자격 증명, 권한 범위 프리셋, 연결 테스트, rate limit, AI 에이전트 노출을 정한다. 공통 원칙(🔒 표시 등)은 부모를 따른다.

## Cafe24

한국 이커머스 SaaS Cafe24 의 Admin API([공식 문서](https://developers.cafe24.com/docs/ko/api/admin/)) 통합이다. 한 통합을 워크플로우의 [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md) 와 AI 에이전트의 MCP 도구 양쪽에서 쓴다.

| 필드 | 값 |
| --- | --- |
| `Integration.service_type` | `cafe24` |
| `Integration.auth_type` | `oauth2` |
| `Integration.scope` | `personal` / `organization` |

**자격 증명 스키마**

| 필드 | 타입 | 필수 | 비밀 | 설명 |
| --- | --- | --- | --- | --- |
| `mall_id` | string | ✓ | × | Cafe24 상점 식별자. base URL `https://{mall_id}.cafe24api.com/api/v2/admin/...` 을 만든다. 형식은 `/^[a-z0-9-]{3,50}$/` (소문자 영숫자·하이픈, 3~50자). Cafe24 규약이자 다른 host 주입을 막는 SSRF 방어다 |
| `app_type` | enum `public` \| `private` | ✓ | × | Cafe24 앱 유형(`app_type`). `public` 은 Cafe24 앱스토어에 등록된 앱으로 서버 환경 변수 `CAFE24_CLIENT_ID`·`CAFE24_CLIENT_SECRET` 을 쓴다. `private` 은 Cafe24 개발자 센터에서 만든 심사 전 앱으로 사용자가 client_id·secret 을 직접 넣는다 |
| `client_id` | string | `app_type='private'` 이면 ✓ | × | Private 앱의 OAuth client_id |
| `client_secret` | string | `app_type='private'` 이면 ✓ | 🔒 | Private 앱의 OAuth client_secret. 설치 HMAC 검증 키로도 쓴다 |
| `access_token` | string | ✓ | 🔒 | OAuth access token (2시간 유효) |
| `refresh_token` | string | ✓ | 🔒 | OAuth refresh token (14일 유효) |
| `scopes` | string[] | ✓ | × | 권한 범위. `mall.read_<category>` / `mall.write_<category>` 형식 |
| `expires_at` | ISO8601 | ✓ | × | `access_token` 만료 시각. `Integration.token_expires_at` 과 원자 갱신으로 맞춘다 |
| `cafe24_operator_id` | string | ✓ | × | 토큰을 받은 Cafe24 운영자 식별자. Cafe24 응답 본문의 `user_id` 값을 저장한다. 내부 `User.id`(UUID)와 헷갈리지 않도록 이름을 따로 붙였다 |

`mall_id` 는 base URL 의 일부이고 인가 URL 도 상점마다 다르다. 그래서 OAuth 연결을 시작하기 전에 사용자가 먼저 입력한다(Public·Private 모두). 인가 URL, 토큰 엔드포인트, 권한 범위 구분자(콤마), 토큰 만료 시각 해석은 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md) 이 정한다.

**권한 범위 권장 프리셋**

| 카테고리 | 권한 범위 값 (R / W) | 별도 승인 |
| --- | --- | --- |
| Product | `mall.read_product` / `mall.write_product` | |
| Order | `mall.read_order` / `mall.write_order` | |
| Customer | `mall.read_customer` / `mall.write_customer` | |
| Category | `mall.read_category` / `mall.write_category` | |
| Promotion | `mall.read_promotion` / `mall.write_promotion` | |
| Mileage | `mall.read_mileage` / `mall.write_mileage` | ⚠ 필요 (R/W) |
| Shipping | `mall.read_shipping` / `mall.write_shipping` | |
| Sales report | `mall.read_salesreport` / 없음(write 없음) | |
| Translation | `mall.read_translation` / `mall.write_translation` | |
| Notification | `mall.read_notification` / `mall.write_notification` | ⚠ 필요 (R/W) |
| Application | `mall.read_application` / `mall.write_application` | |
| Store | `mall.read_store` / `mall.write_store` | ⚠ 일부 sub-resource |
| Design | `mall.read_design` / `mall.write_design` | |
| Community | `mall.read_community` / `mall.write_community` | |
| Collection | `mall.read_collection` / `mall.write_collection` | |
| Supply | `mall.read_supply` / `mall.write_supply` | |
| Personal | `mall.read_personal` / `mall.write_personal` | |
| Privacy | `mall.read_privacy` / `mall.write_privacy` | ⚠ 필요 (R/W) |

⚠ 로 표시한 카테고리는 카페24 본사가 별도로 승인한 클라이언트만 쓸 수 있다. 사용자가 모르고 체크한 채 OAuth 를 진행하면 `invalid_scope` 로 실패할 수 있어서, 화면은 체크박스 옆 ⚠ 아이콘과 tooltip, 폼 하단 경고로 알린다. 체크 자체는 막지 않는다. Store 의 «일부 sub-resource» 는 권한 범위 단위가 아니라 operation 단위라서 노드 Operation 드롭다운의 ⚠ 라벨이 첫 안내 지점이다. 명단의 단일 기준은 [Cafe24 별도 승인 scope](CLE-C24-SCOPES) 다. 해당 operation 명단도 그 문서에 있다.

화면은 카테고리 단위 체크박스(R·W 두 열)와 «고급» 토글 아래의 개별 권한 범위 입력란으로 구성한다.

**연결 테스트**: 저장된 `access_token` 으로 `GET https://{mall_id}.cafe24api.com/api/v2/admin/apps` 를 부르고 200 과 JSON 본문을 확인한다.

- 401(`access_token time expired` 등)을 받을 때만 `refresh_token` 으로 access token 을 갱신한 뒤 한 번만 다시 시도한다. 다시 시도해도 401 이면 `error(auth_failed)` 로 바꾼다. 호출 직전 갱신이 경쟁 조건(DB `expires_at` 미동기, 여러 인스턴스 등)으로 빗나간 경우를 스스로 복구하려는 것이며, 노드 호출 경로와 같은 정책이다([OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md)).
- 토큰 갱신 요청이 401·403 으로 거절되면 갱신 단계가 통합을 `error(auth_failed)` 로 바꾸고 `CAFE24_AUTH_FAILED` 를 돌려준다. 갱신 요청이 그 밖의 상태로 실패하면 지금은 `CAFE24_TRANSPORT_FAILED` 다(아래 Rationale 「연결 테스트는 401 만 토큰 문제로 본다」).
- 403 이면 상태를 낮추지 않고 `CAFE24_INSUFFICIENT_SCOPE` 메시지만 돌려준다. 권한 부족이나 앱 미설치는 사용자가 통합 재인증이나 추가 권한 요청으로 해결한다.
- 2xx 가 아닌 상태 가운데 401·403 을 뺀 나머지(429·5xx·404 등)는 토큰 문제로 보지 않는다. 토큰을 갱신하지 않고 상태도 낮추지 않는다. 받은 상태를 메시지에 담아 `CAFE24_API_ERROR` 를 돌려준다. 다시 보낸 요청이 이런 상태로 실패해도 같다. 사용자는 잠시 뒤 다시 시도한다.
- 사용자가 직접 누른 진단 호출이라 연속 네트워크 실패(`consecutive_network_failures`) 합산에서 뺀다. 이 카운터는 노드 실행 시점의 자동 호출만 센다.
- 저장 전 연결 테스트(`preview-test`)는 저장하기 전 자격 증명의 구조만 검증하고 외부를 부르지 않는다. 막 발급된 토큰이라 갱신이 필요 없다. 컨트롤러 throttle 은 분당 20회다.

**Rate limit**: Cafe24 는 leaky bucket 으로 호출량을 제한한다. 백엔드 `Cafe24ApiClient` 가 응답 헤더 `X-Cafe24-Call-Remain`·`X-Cafe24-Call-Usage`·`X-Api-Call-Limit` 을 보고, 429 를 받으면 기다렸다가 최대 2회 다시 시도한다. 노드 호출과 AI 에이전트 MCP 호출이 같은 클라이언트를 거치므로 같은 프로세스 안에서는 통합 단위로 bucket 을 공유한다. 같은 통합을 동시에 많이 쓰면 양쪽이 함께 기다린다. 여러 인스턴스 사이의 직렬화는 보장하지 않는다. 429 뒤 대기 시간은 `max(X-Cafe24-Call-Remain, X-Cafe24-Time-Remain)` 초이고, 헤더 뜻과 재시도 규칙은 [Cafe24 노드 §호출 제한](../CLE-NODE-INT/CLE-NODE-CAFE24.md#호출-제한) 이 정한다.

**AI 에이전트 노출**: `service_type='cafe24'` 통합은 AI 에이전트의 `mcpServers` 선택 목록에도 나온다. 고르면 백엔드의 `Cafe24McpToolProvider` 가 서버 안의 `AgentToolProvider` 구현체로 동작해 Cafe24 리소스 × operation 을 MCP 도구로 노출한다. 도구 이름과 노출 도구 목록 규칙은 [MCP 클라이언트](CLE-INT-MCP.md), 상세는 [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md).

## MakeShop

> 구현 완료. 한국 이커머스 SaaS MakeShop 의 신형 Shop API([공식 문서](https://developer.makeshop.co.kr/docs/api/shop/상점-설정-정보)) 통합이다.

Cafe24 와 같은 구조로 설계했다. 한 통합을 워크플로우의 [MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md) 와 AI 에이전트의 MCP 도구 양쪽에서 쓴다. 이 절은 MakeShop 만의 차이를 적고, 상태 전이·토큰 자동 갱신·설치 HMAC·rate limit 래퍼·연결 테스트의 401 복구는 Cafe24 정책을 그대로 쓴다.

| 필드 | 값 |
| --- | --- |
| `Integration.service_type` | `makeshop` |
| `Integration.auth_type` | `oauth2` |
| `Integration.scope` | `personal` / `organization` |

**자격 증명 스키마**

| 필드 | 타입 | 필수 | 비밀 | 설명 |
| --- | --- | --- | --- | --- |
| `shop_uid` | string | ✓ | × | MakeShop 상점 식별자. base URL `https://connect.makeshop.co.kr/api/v1/{shop_uid}/...` 을 만들고 `mall_id` 컬럼에 복제한다([통합 데이터와 흐름](CLE-INT-DATA.md)). ShopStore 설치 redirect 의 `shop_uid` 파라미터로 받는다 |
| `client_id` | string | ✓ | × | OAuth client_id (파트너센터 앱 등록 때 발급) |
| `client_secret` | string | ✓ | 🔒 | OAuth client_secret. 설치 HMAC 검증 키로도 쓴다 |
| `access_token` | string | ✓ | 🔒 | OAuth access token (1시간 유효) |
| `refresh_token` | string | ✓ | 🔒 | OAuth refresh token (기본 30일, 최대 90일). 한 번 쓰면 새 값으로 바뀐다 |
| `scopes` | string[] | ✓ | × | 권한 범위. `<그룹>.read` / `<그룹>.write` 형식(예: `store.read`, `product.write`) |
| `expires_at` | ISO8601 | ✓ | × | `access_token` 만료 시각. 원자 갱신으로 맞춘다 |

인증은 Authorization Code + PKCE(OAuth 2.1)이고, 권한 범위는 표준 공백 구분이다. 설치는 ShopStore 앱 설치로 시작한다. 흐름과 엔드포인트는 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md) 이 정한다.

**권한 범위 권장 프리셋** (카탈로그 권한 그룹 × R/W)

| 그룹 | 권한 범위 값 (R / W) |
| --- | --- |
| 상점 설정 | `store.read` / `store.write` |
| 상품 | `product.read` / `product.write` |
| 주문 | `order.read` / `order.write` |
| 회원 | `member.read` / `member.write` |
| 게시판 | `board.read` / `board.write` |
| 적립금/쿠폰(혜택) | `benefit.read` / `benefit.write` |

MakeShop 에는 별도 승인 권한 범위가 없다. Cafe24 의 파트너 별도 승인 단계가 없고 앱 심사 때 한꺼번에 검토한다([MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md)). 정확한 권한 토큰 문자열과 그룹은 코드에 `VERIFY` 로 표시돼 있어 운영 전에 MakeShop OAuth 문서로 확정해야 한다. 한글 권한 그룹(`x-scope`)과 실제 권한 토큰의 대응은 [MakeShop operation 메타데이터](CLE-MKS-META) 가 정한다.

**연결 테스트**: 저장된 `access_token` 으로 `GET https://connect.makeshop.co.kr/api/v1/{shop_uid}/information` 을 부른다. 401 복구, 401·403 이 아닌 상태의 처리(`MAKESHOP_API_ERROR`), 연속 네트워크 실패 합산 제외는 Cafe24 와 같다. 403 결과 코드는 다르다. 상태를 낮추지 않는 것은 같지만 Cafe24 가 `CAFE24_INSUFFICIENT_SCOPE` 로 가르는 자리에서 MakeShop 은 `MAKESHOP_AUTH_FAILED` 로 묶는다. 별도 승인 권한 범위가 없어 403 을 권한 부족으로 나눌 근거가 없다.

**Rate limit**: MakeShop 은 데이터 호출 rate limit 을 공개하지 않았다. 토큰 발급만 client_credentials 기준 분당 5회로 정해져 있다. `MakeshopApiClient` 는 429 응답의 `Retry-After` 를 참고해 최대 2회 다시 시도한다. 확정되지 않은 항목은 [MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md) 에 있다.

**AI 에이전트 노출**: `service_type='makeshop'` 통합도 AI 에이전트 `mcpServers` 선택 목록에 나온다. `MakeshopMcpToolProvider` 가 서버 안의 `AgentToolProvider` 로 7개 섹션의 REST operation 161개를 MCP 도구로 노출한다. 수치의 기준은 [MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md) 다.

**웹훅은 범위 밖**: CPIK 웹훅 11개(이벤트 수신)는 이 통합의 범위가 아니다. Cafe24 와 함께 트리거 노드의 후속 과제로 둔다.

## 구현 위치

- `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` (Cafe24 연결 테스트와 요청 빈도 제한 처리)
- `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts` (MakeShop 연결 테스트와 `Retry-After` 재시도)

## Rationale

### Cafe24 연결 테스트 endpoint 를 `/store` 에서 `/apps` 로 바꿨다

예전에는 `GET /api/v2/admin/store` 로 테스트했는데 운영 중 거짓 실패가 두 가지 보고됐다. 통합이 `mall.read_store` 권한 범위를 갖지 않으면 403 으로 실패해 «토큰은 유효한데 연결 테스트만 실패» 하는 혼란이 생겼다. 또 `/store` 는 상점 수준 메타데이터라 일부 운영자 권한에서 응답 형태가 일정하지 않았다. `GET /api/v2/admin/apps` 는 자기 앱 정보 조회이고 모든 Cafe24 통합은 자기 앱이므로 권한 부족 위험이 가장 적다. Cafe24 OAuth 가 발급한 토큰이면 자기 앱 정보를 볼 권한은 늘 있다.

검토한 다른 후보:

- `/scopes`: 토큰의 현재 권한 범위만 돌려줘 가볍지만 응답이 단순 배열이라 «JSON 본문 200 OK» 검증의 의미가 약하다.
- `/oauth/token` introspection: Cafe24 가 표준 introspection endpoint 를 제공하지 않는다.
- `/products?limit=1` 같은 도메인 호출: 권한 부족 위험이 가장 크다.

연속 네트워크 실패 카운터는 노드 실행 경로의 자동 호출이 쌓여 `error(network)` 로 바꾸는 운영 신호다. 사용자가 직접 누른 연결 테스트는 일회성 진단이라 합산하면 사용자 클릭만으로 상태가 낮아지는 거짓 양성 위험이 커서 뺀다. 이 결정은 `Cafe24ApiClient.pingConnection()` 의 «예외를 던지지 않고 메시지만 돌려준다» 계약과 짝을 이룬다. 401 을 받으면 토큰을 갱신하고 한 번 다시 시도하는 정책도 노드 호출 경로와 같게 맞췄다.

### 연결 테스트는 401 만 토큰 문제로 본다 (2026-11-06)

Cafe24·MakeShop 연결 테스트는 첫 요청이 401·403 이 아닌 상태로 실패해도 401 처럼 토큰을 갱신하고 다시 보냈다. 다시 보낸 요청이 5xx·429 로 실패하면 `*_AUTH_FAILED` 로 답해 서버 장애나 호출 제한을 인증 실패로 안내했다. 사용자는 하지 않아도 되는 재인증을 했고 갱신 호출도 한 번 더 나갔다.

- 노드 호출 경로처럼 401 만 갱신하고 다시 보낸다([OAuth 연결과 토큰 갱신 「401 을 받으면 갱신하고 한 번 다시 보낸다」](CLE-INT-OAUTH.md#401-을-받으면-갱신하고-한-번-다시-보낸다)). 위 「Cafe24 연결 테스트 endpoint 를 `/store` 에서 `/apps` 로 바꿨다」 가 정한 «노드 호출 경로와 같은 401 정책» 을 코드가 401 밖 상태에서 지키지 않았다.
- 401·403 이 아닌 상태는 새 코드 `CAFE24_API_ERROR`·`MAKESHOP_API_ERROR` 로 돌려주고 상태를 낮추지 않는다. 코드 이름과 기각한 대안은 [에러 코드 규약과 카탈로그 「Cafe24 · MakeShop 연결 테스트의 401 · 403 밖 실패에 `*_API_ERROR` 를 새로 만들었다」](../CLE-API/CLE-API-ERRCODES.md#cafe24--makeshop-연결-테스트의-401--403-밖-실패에-_api_error-를-새로-만들었다-2026-11-06) 에 있다.
- 토큰 갱신 요청 자체가 401·403 이 아닌 상태로 실패하면 연결 테스트는 지금도 `*_TRANSPORT_FAILED` 로 답한다. 갱신 경로는 노드와 함께 써서 이 변경에 넣지 않았다. 응답을 받은 실패라 그 코드의 뜻(응답을 받지 못한 실패)과 어긋난다. NERV Task `CLE-T-DJGSBR` 이 고칠 때까지 남겨 두는 한시 예외다.
