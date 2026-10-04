---
id: "CLE-INT-AUTH"
title: "서비스별 인증 방식과 자격 증명"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT"
ancestors: ["CLE-VISION", "CLE-INT"]
area: "CLE-INT"
content_hash: "bb1fa1cb604c89860a41fca5b44e8482702b214a921a8eb3ddfb9c695749fe10"
read_as: "approved_fallback"
task: "CLE-T-RGZBCQ"
source_paths: ["spec/2-navigation/4-integration.md"]
mirror_sha256: "1b0baeb84bcc1d3500b06003d102ce131a7fa8608beab531298e3dcef6099212"
etag: "sha256-84cb13ab2fb34ad77ecee4db8a1a26b7b4f22d4c6e27f76d21323ddf7f9eacbb"
---
> 구현 상태: 구현됨 · 원문: `spec/2-navigation/4-integration.md` (§5, Rationale «연결 테스트 — Database · HTTP 는 실제로 접속한다»·«SMTP 연결 테스트를 verify() 로 구현»·«SMTP SSRF 가드를 http/db 와 동일 ALLOW_PRIVATE_HOST_TARGETS 로 통일»·«연결 테스트 endpoint 를 /store 에서 /apps 로 전환») · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 통합(Integration, `integration`)이 연결하는 서비스마다 자격 증명(credentials)에 무엇을 저장하고, 어떤 통합 인증 유형(`auth_type`)을 쓰며, 연결 테스트(test connection)가 무엇을 확인하는지를 정한다. 대상 서비스 유형(`service_type`)은 Google, GitHub, HTTP/REST, Database, Email(SMTP), MCP 서버, Webhook(Outbound), Cafe24, MakeShop 이다.

범위 밖:

- 연결 테스트 기능 전체(엔드포인트, 결과 형식, 설치 대기 통합 거부, 연결 테스트 전용 코드 표)는 [통합 관리](CLE-INT-MANAGE.md) 가 정한다. 이 문서는 서비스마다 무엇을 확인하는지만 적는다.
- OAuth 연결·설치 흐름, 제공자별 토큰 엔드포인트, 토큰 자동 갱신은 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md) 이 정한다.
- 자격 증명 컬럼의 암호화와 저장 형태는 [통합 데이터와 흐름](CLE-INT-DATA.md) 이 정한다.
- MCP 서버의 도구 노출, SSRF 정책, transport 는 [MCP 클라이언트](CLE-INT-MCP.md) 가 정한다.
- Cafe24 별도 승인 명단은 [Cafe24 별도 승인 scope](CLE-C24-SCOPES), Cafe24·MakeShop API 호출 규칙은 [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md)·[MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md) 가 정한다.

## 공통 원칙

- 모든 서비스의 자격 증명은 `Integration.credentials` JSONB 에 저장한다.
- 표에서 🔒 로 표시한 필드는 쓰기 전용이다. API 응답에는 가린 미리보기(예: `xoxb-****4f2a`)만 싣고 원본은 복호화해 보여 주지 않는다.
- OAuth 통합은 권한 범위(OAuth scope, `credentials.scopes`)를 `scopes: string[]` 로 함께 저장한다.
- 서비스 유형과 인증 유형의 조합은 백엔드 서비스 레지스트리(`service-registry.ts`)에 등록된 것만 받는다. 등록되지 않은 조합의 거부는 [통합 관리](CLE-INT-MANAGE.md) 의 `INTEGRATION_INVALID_SERVICE` 다.
- 연결 테스트 결과 코드는 `IntegrationTestResult.code` 이름공간이다. 노드 출력의 `output.error.code`([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md))와 다른 이름공간이며, 값 형식은 같은 UPPER_SNAKE_CASE 다.

| 서비스 유형 | 통합 인증 유형 | 연결 테스트 | 쓰는 곳 |
| --- | --- | --- | --- |
| `google` | `oauth2` | 필드 구조 검증만 | 아직 쓰는 노드 없음 |
| `github` | `oauth2`, PAT | 필드 구조 검증만 | 아직 쓰는 노드 없음 |
| `http` | `api_key`, `bearer_token`, `basic` (`none` 은 [미결](#미결-사항)) | `base_url` 로 실제 요청 | [HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md) |
| `database` | `connection_string` | 일회성 연결 후 `SELECT 1` | [Database Query 노드](../CLE-NODE-INT/CLE-NODE-DBQUERY.md) |
| `email` | `smtp` | `nodemailer` `verify()` | [Send Email 노드](../CLE-NODE-INT/CLE-NODE-EMAIL.md) |
| `mcp` | `bearer_token`, `api_key`, `none` | MCP `initialize` | AI 에이전트 `mcpServers` |
| `webhook` | `webhook_outbound` | 필드 구조 검증만 | 아직 쓰는 노드 없음 |
| `cafe24` | `oauth2` | 연결 뒤 `GET /apps` | [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md), AI 에이전트 내부 MCP 브리지 |
| `makeshop` | `oauth2` | 연결 뒤 `GET /information` | [MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md), AI 에이전트 내부 MCP 브리지 |

저장 전 연결 테스트(`preview-test`)는 이 표에서 «실제 요청» 인 Email·MCP·HTTP·Database 만 외부를 부르고, 나머지는 구조 검증만 한다. Cafe24·MakeShop 은 연결 뒤 `:id/test` 에서 실제로 부른다.

## Google (OAuth2)

| 필드 | 타입 | 필수 | 비밀 |
| --- | --- | --- | --- |
| `scopes` | string[] | ✓ | × |
| `access_token` | string | ✓ | 🔒 |
| `refresh_token` | string | ✓ | 🔒 |
| `account_email` | string | ✓ | × |

권한 범위는 서비스 묶음 체크박스로 고른다.

| 묶음 | 권한 범위 값 |
| --- | --- |
| Drive | `https://www.googleapis.com/auth/drive` |
| Sheets | `https://www.googleapis.com/auth/spreadsheets` |
| Gmail | `https://www.googleapis.com/auth/gmail.send` |
| Calendar | `https://www.googleapis.com/auth/calendar` |

연결 테스트: 현재는 필드 구조만 검증하고 외부를 부르지 않는다. 이 통합을 쓰는 노드가 아직 없어서다. 토큰 갱신 경로도 구현돼 있지 않다([OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md)). 노드가 생길 때 `tokeninfo` 엔드포인트나 선택한 첫 묶음의 `/about` 호출 테스트를 함께 만든다.

## GitHub

GitHub 는 인증 유형 두 가지 중 하나를 고른다.

**OAuth2**

| 필드 | 타입 | 필수 | 비밀 |
| --- | --- | --- | --- |
| `scopes` | string[] | ✓ | × |
| `access_token` | string | ✓ | 🔒 |
| `login` | string | ✓ | × |

권장 권한 범위는 `repo`, `read:org` 이고 추가 선택지는 `workflow`, `gist` 다.

**Personal Access Token (PAT)**

| 필드 | 타입 | 필수 | 비밀 |
| --- | --- | --- | --- |
| `token` | string | ✓ | 🔒 |

연결 테스트: 현재는 필드 구조만 검증한다. 이 통합을 쓰는 노드가 아직 없어서다. 노드가 생길 때 `GET https://api.github.com/user` 테스트를 함께 만든다.

## HTTP/REST

인증 유형은 `api_key` / `bearer_token` / `basic` 중에서 고른다. 화면 정의는 `none` 도 고를 수 있다고 적지만 노드 쪽 정의와 갈린다. [미결 사항](#미결-사항) 참조.

| 공통 필드 | 타입 | 필수 | 비고 |
| --- | --- | --- | --- |
| `base_url` | string | | 비어 있으면 노드 설정에서 URL 전체를 적는다 |
| `default_headers` | Record<string,string>? | | 공용 헤더 |

**api_key**

| 필드 | 타입 | 필수 | 비밀 |
| --- | --- | --- | --- |
| `location` | enum `header` \| `query` | ✓ | × |
| `key_name` | string | ✓ | × |
| `value` | string | ✓ | 🔒 |

**bearer_token**

| 필드 | 타입 | 필수 | 비밀 |
| --- | --- | --- | --- |
| `token` | string | ✓ | 🔒 |

**basic**

| 필드 | 타입 | 필수 | 비밀 |
| --- | --- | --- | --- |
| `username` | string | ✓ | × |
| `password` | string | ✓ | 🔒 |

연결 테스트: `base_url` 이 있으면 HTTP Request 노드와 같은 방식으로 자격 증명을 붙여 `GET base_url` 을 보낸다. 리다이렉트는 노드와 같이 최대 5홉까지 따라가며 홉마다 SSRF 를 다시 검사한다([HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md)). 리다이렉트 뒤에서 인증을 거부하는 서비스도 잡기 위해서다. 판정은 마지막 응답으로 한다. 응답 본문은 읽지 않는다. 대기 시간은 10초다. host 의 SSRF 가드는 노드와 같다(`ALLOW_PRIVATE_HOST_TARGETS` 로 끌 수 있다).

| 결과 | 코드 |
| --- | --- |
| 2xx, 또는 `Location` 없는 3xx | `success: true` |
| 401·403 | `HTTP_AUTH_FAILED`. 서버가 자격 증명을 거부했다 |
| 그 밖의 4xx(404·405 등) | `success: true`. 다만 메시지로 «서버에는 닿았지만 `base_url` 이 이 요청을 처리하지 않아 자격 증명은 확인하지 못했다» 고 알린다. `base_url` 은 대개 API 의 뿌리라 그 자체가 자원이 아니다 |
| 5xx | `HTTP_SERVER_ERROR` |
| host(첫 요청 또는 리다이렉트 대상)가 SSRF 가드에 차단됨, 또는 리다이렉트가 5홉을 넘음 | `HTTP_BLOCKED` |
| 네트워크·타임아웃·TLS 실패 | `HTTP_CONNECT_FAILED`. SSRF 가드가 차단 판정이 아닌 오류를 낸 경우(가드 고장)도 같은 코드다. `HTTP_BLOCKED` 는 차단 판정에만 쓴다 |
| 자격 증명을 붙이기 전 실패(필수 필드 누락, 지원하지 않는 인증 유형) | `INTEGRATION_INCOMPLETE`·`INTEGRATION_AUTH_UNSUPPORTED`. 요청을 보내지 않는다. 노드와 같은 `resolveHttpCredentials` 를 쓰므로 같은 자격 증명으로 노드가 낼 코드와 같다 |

`base_url` 이 비어 있으면(노드가 URL 전체를 적는 통합) 부르지 않고 `success: true` 에 «`base_url` 이 없어 연결을 확인하지 않았다» 는 메시지를 돌려준다. 자격 증명 거부를 알 수 있는 것은 `base_url` 이 401·403 을 돌려줄 때뿐이다.

## Database

| 필드 | 타입 | 필수 | 비밀 |
| --- | --- | --- | --- |
| `driver` | enum `postgres` \| `mysql` | ✓ | × |
| `host` | string | ✓ | × |
| `port` | int | ✓ | × |
| `database` | string | ✓ | × |
| `username` | string | ✓ | × |
| `password` | string | ✓ | 🔒 |
| `ssl` | enum `disable` \| `require` \| `verify-full` | ✓ | × |

연결 테스트: 저장된(또는 입력한) 자격 증명으로 일회성 연결을 열어 `SELECT 1` 을 실행하고 닫는다. 연결과 `SELECT 1` 을 각각 10초까지 기다린다. 연결만 제한하면 인증 뒤 응답하지 않는 서버에 쿼리가 매달린다. SSL 매핑과 host 의 SSRF 가드는 [Database Query 노드](../CLE-NODE-INT/CLE-NODE-DBQUERY.md) 와 같다.

| 결과 | 코드 |
| --- | --- |
| 성공 | `success: true` |
| host 가 SSRF 가드에 차단됨 | `DB_HOST_BLOCKED` |
| 인증 거부(PostgreSQL SQLSTATE class 28, MySQL `ER_ACCESS_DENIED_ERROR`·`ER_DBACCESS_DENIED_ERROR`) | `DB_AUTH_FAILED` |
| 그 밖(네트워크·타임아웃·TLS·없는 database 등) | `DB_CONNECT_FAILED` |

메시지에는 드라이버 원문을 길이를 제한해 싣는다. 비밀번호는 드라이버 원문에 없다. `DB_CONNECT_FAILED` 는 노드 실행의 `DB_CONNECTION_ERROR`(핸드셰이크 인증 실패까지 포함)와 모집합이 다르다. 연결 테스트는 인증 실패를 `DB_AUTH_FAILED` 로 먼저 가른다. 이 일회성 연결은 노드 실행의 커넥션 풀과 별개이며 풀에 남지 않는다.

## Email (SMTP)

| 필드 | 타입 | 필수 | 비밀 |
| --- | --- | --- | --- |
| `host` | string | ✓ | × |
| `port` | int | ✓ | × |
| `secure` | enum `none` \| `starttls` \| `tls` | ✓ | × |
| `username` | string | ✓ | × |
| `password` | string | ✓ | 🔒 |
| `default_from` | string | ✓ | × |

연결 테스트: `nodemailer` transporter 의 `verify()` 로 SMTP 연결, 인증, STARTTLS·TLS 핸드셰이크를 확인한다. 실제 메일은 보내지 않는다. 저장 전 연결 테스트, 저장 후 `:id/test`, 자격 증명 교체 세 경로 모두 실제 `verify()` 를 한다. Cafe24 의 저장 전 연결 테스트가 외부를 부르지 않는 것과 일부러 다르다. SMTP 는 외부 서버 인증을 거쳐야만 자격 증명을 확인할 수 있어서다.

실패 코드는 연결·인증·TLS 실패면 `EMAIL_CONNECT_FAILED`(nodemailer 원본 메시지 동반), host 가 SSRF 가드에 차단되면 `EMAIL_HOST_BLOCKED` 다.

SMTP host 는 [HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md) 의 SSRF 가드와 같은 메커니즘과 플래그를 쓴다. 사설(RFC1918)·loopback·link-local·CGNAT·IPv6 사설 대역을 기본 차단하고, 셀프 호스팅은 `ALLOW_PRIVATE_HOST_TARGETS=true` 로 끈다(내부 SMTP relay 보존). 연결 테스트와 Send Email 노드 발송에 똑같이 적용한다.

## MCP 서버

AI 에이전트 노드가 쓰는 외부 [Model Context Protocol](https://modelcontextprotocol.io) 서버를 워크스페이스에 등록한다. 워크플로우 노드로는 직접 쓰지 않고 AI 에이전트의 `mcpServers` 설정에서 참조한다. 도구 노출 모델과 동작은 [MCP 클라이언트](CLE-INT-MCP.md) 가 정한다.

인증 유형은 `bearer_token` / `api_key` / `none` 중에서 고른다.

| 공통 필드 | 타입 | 필수 | 비밀 | 비고 |
| --- | --- | --- | --- | --- |
| `url` | string | ✓ | × | Streamable HTTP 엔드포인트. `https://` 만 받는다 |
| `default_headers` | Record<string,string>? | | × | 모든 요청에 더하는 헤더 |

- **bearer_token**: `token`(string, 필수, 🔒). `Authorization: Bearer <token>` 을 자동으로 붙인다.
- **api_key**: `header_name`(string, 필수), `value`(string, 필수, 🔒). `<header_name>: <value>` 를 자동으로 붙인다.
- **none**: 추가 필드가 없다. 인증 없는 공용 MCP 서버용이다.

연결 테스트: 연결한 뒤 MCP `initialize` 를 불러 `capabilities` 와 `serverInfo` 를 받는다. 성공하면 응답에 `{ capabilities, serverInfo, preview: { toolCount, resourceSupported, promptSupported } }` 를 실어 등록 뒤 노드 설정 화면의 미리보기에 쓴다. 상세는 [MCP 클라이언트](CLE-INT-MCP.md).

MCP 서버는 OAuth refresh token 을 갖지 않으므로 `token_expires_at` 이 없고 만료 스캐너의 임계 알림이 적용되지 않는다. 인증 실패(401·403)는 노드 실행 시점에 `error(auth_failed)` 로 바뀌고, 사용자는 자격 증명 교체로 토큰을 바꾼다([통합 상태와 만료 알림](CLE-INT-STATUS.md)). MCP 통합을 개인 공개 범위로 등록할 수 있는지는 [통합 관리](CLE-INT-MANAGE.md) 의 미결 사항이다.

## Webhook (Outbound)

| 필드 | 타입 | 필수 | 비밀 |
| --- | --- | --- | --- |
| `url` | string | ✓ | × |
| `method` | enum `POST` \| `PUT` \| `PATCH` | ✓ | × (기본 `POST`) |
| `default_headers` | Record<string,string>? | | × |
| `signing_secret` | string? | | 🔒 |
| `signature_header` | string? | | × (기본 `X-Signature`) |

- `signing_secret` 을 지정하면 호출 페이로드를 HMAC-SHA256 으로 서명해 `signature_header` 에 붙인다.
- 이 통합은 밖으로 보내는 호출 대상만 정한다. 들어오는 웹훅 URL 은 트리거(`type=webhook`)가 따로 관리하며 이 통합과 공유하지 않는다([웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md)).

연결 테스트: 현재는 필드 구조만 검증한다. 이 통합을 쓰는 노드가 아직 없어서다. 노드가 생길 때 `url` 호출 테스트를 함께 만든다.

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

⚠ 로 표시한 카테고리는 카페24 본사가 별도로 승인한 클라이언트만 쓸 수 있다. 사용자가 모르고 체크한 채 OAuth 를 진행하면 `invalid_scope` 로 실패할 수 있어서, 화면은 체크박스 옆 ⚠ 아이콘과 tooltip, 폼 하단 경고로 알린다. 체크 자체는 막지 않는다. Store 의 «일부 sub-resource» 는 권한 범위 단위가 아니라 operation 단위(Activitylogs, Menus, Naverpay·Kakaopay setting, Paymentgateway 관련, Financials paymentgateway)라서 노드 Operation 드롭다운의 ⚠ 라벨이 첫 안내 지점이다. 명단의 단일 기준은 [Cafe24 별도 승인 scope](CLE-C24-SCOPES) 다.

화면은 카테고리 단위 체크박스(R·W 두 열)와 «고급» 토글 아래의 개별 권한 범위 입력란으로 구성한다.

**연결 테스트**: 저장된 `access_token` 으로 `GET https://{mall_id}.cafe24api.com/api/v2/admin/apps` 를 부르고 200 과 JSON 본문을 확인한다.

- `/apps` 를 고른 이유: 자기 앱 정보 조회라 모든 Cafe24 통합이 권한 부족 위험이 가장 적다(아래 Rationale).
- 401(`access_token time expired` 등)을 받으면 `refresh_token` 으로 access token 을 갱신한 뒤 한 번만 다시 시도한다. 다시 시도해도 401 이면 `error(auth_failed)` 로 바꾼다. 호출 직전 갱신이 경쟁 조건(DB `expires_at` 미동기, 여러 인스턴스 등)으로 빗나간 경우를 스스로 복구하려는 것이며, 노드 호출 경로와 같은 정책이다([OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md)).
- 403 이면 상태를 낮추지 않고 `CAFE24_INSUFFICIENT_SCOPE` 메시지만 돌려준다. 권한 부족이나 앱 미설치는 사용자가 통합 재인증이나 추가 권한 요청으로 해결한다.
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

**연결 테스트**: 저장된 `access_token` 으로 `GET https://connect.makeshop.co.kr/api/v1/{shop_uid}/information` 을 부른다. 401 복구와 연속 네트워크 실패 합산 제외는 Cafe24 와 같다. 403 결과 코드는 다르다. 상태를 낮추지 않는 것은 같지만 Cafe24 가 `CAFE24_INSUFFICIENT_SCOPE` 로 가르는 자리에서 MakeShop 은 `MAKESHOP_AUTH_FAILED` 로 묶는다. 별도 승인 권한 범위가 없어 403 을 권한 부족으로 나눌 근거가 없다.

**Rate limit**: MakeShop 은 데이터 호출 rate limit 을 공개하지 않았다. 토큰 발급만 client_credentials 기준 분당 5회로 정해져 있다. `MakeshopApiClient` 는 429 응답의 `Retry-After` 를 참고해 최대 2회 다시 시도한다. 확정되지 않은 항목은 [MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md) 에 있다.

**AI 에이전트 노출**: `service_type='makeshop'` 통합도 AI 에이전트 `mcpServers` 선택 목록에 나온다. `MakeshopMcpToolProvider` 가 서버 안의 `AgentToolProvider` 로 7개 섹션의 REST operation 161개를 MCP 도구로 노출한다. 수치의 기준은 [MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md) 다.

**웹훅은 범위 밖**: CPIK 웹훅 11개(이벤트 수신)는 이 통합의 범위가 아니다. Cafe24 와 함께 트리거 노드의 후속 과제로 둔다.

## 미결 사항

- **HTTP 통합의 `none` 인증 유형**: 통합 화면 정의는 HTTP 통합에서 `none`(`base_url`·`default_headers` 만)을 고를 수 있다고 적는다. [HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md) 정의는 `api_key`·`bearer_token`·`basic` 외의 인증 유형을 `INTEGRATION_AUTH_UNSUPPORTED` 로 처리한다. 현재 구현(`resolveHttpCredentials` 기본 분기)도 노드 정의와 같아, `none` 통합을 노드에서 쓰면 실패한다. `none` 을 허용해 노드에 행을 더할지, 화면 선택지에서 뺄지 결정이 필요하다. 같은 미결이 [HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md#미결-사항) 에도 있어 두 문서를 함께 정한다.

## 구현 위치

- `codebase/backend/src/modules/integrations/services/service-registry.ts` (서비스와 인증 유형 조합, 서비스별 자격 증명 필드와 가림, 권한 범위 프리셋)
- `codebase/backend/src/modules/integrations/integrations.service.ts` (연결 테스트 분기, Email(SMTP) 의 `verify()`, Google · GitHub · Webhook 의 구조만 검증하는 연결 테스트)
- `codebase/backend/src/modules/integrations/*-connection-tester.ts` (HTTP/REST · Database 연결 테스트)
- `codebase/backend/src/modules/integrations/connection-test-codes.ts` (연결 테스트 결과 코드)
- `codebase/backend/src/nodes/integration/http-request/http-credentials.ts` (HTTP/REST 인증 유형별 부착)
- `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts` (Email(SMTP) 사설 호스트 차단)
- `codebase/backend/src/modules/mcp/mcp-test-connection.service.ts` (MCP 서버 연결 테스트)
- `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` (Cafe24 연결 테스트와 요청 빈도 제한 처리)
- `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts` (MakeShop 연결 테스트와 `Retry-After` 재시도)
- `codebase/frontend/src/app/(main)/w/[slug]/integrations/new/_components/auth-step.tsx` (인증 유형 선택, 자격 증명 입력, 권한 범위 선택과 경고)
- `codebase/frontend/src/app/(main)/w/[slug]/integrations/new/_components/test-step.tsx` (저장 전 연결 테스트 화면)
- `codebase/frontend/src/app/(main)/w/[slug]/integrations/_shared/credentials-form.tsx` (서비스별 자격 증명 입력 폼)

## Rationale

### 연결 테스트: Database·HTTP 는 실제로 접속하고 Google·GitHub·Webhook 은 구조만 검증한다 (2026-09-19)

통합 화면 정의는 다섯 서비스(Google·GitHub·HTTP·Database·Webhook)에 실제 연결 테스트(`tokeninfo`·`GET /user`·`GET base_url`·`SELECT 1`·`HEAD url`)를 약속했다. 그런데 `IntegrationsService.dispatchTest` 에는 그 테스터가 없었다. transport 테스터는 `mcp`·`email`, entity 테스터는 `cafe24`·`makeshop` 뿐이라 나머지는 구조만 맞으면 «Connection successful» 이었다. 틀린 비밀번호로도 연결 테스트가 성공했고, 테스트 성공을 조건으로 하는 자격 증명 교체도 통과했다. SMTP 가 같은 상태였다가 `verify()` 로 고친 선례와 같은 결함이다.

- **범위(사용자 결정, 2026-09-19)**: 처음에는 다섯 모두 구현하기로 했다. 조사해 보니 Google·GitHub·Webhook 은 그 통합을 쓰는 노드가 없었고 Google 은 토큰 갱신 경로도 없었다. 그래서 Database·HTTP 만 구현한다. 쓰는 곳이 있는 두 서비스에 피해가 몰린다. 나머지 셋은 테스트를 붙여도 확인할 대상이 없고, Google 은 갱신이 없어 테스트가 곧 거짓 실패가 된다. 노드가 생길 때 테스터를 함께 만든다.
- **HTTP 의 4xx(401·403 제외)는 성공으로 둔다**: `base_url` 은 대개 API 의 뿌리라 404·405 가 흔하다. 실패로 두면 맞는 자격 증명의 교체가 막힌다. 메시지로 «확인하지 못했다» 를 분명히 하고 401·403 만 거부로 본다. 리다이렉트는 노드와 같이 5홉까지 따라가 리다이렉트 뒤에서 거부하는 서비스를 놓치지 않는다.
- **코드 이름**: host 차단은 노드와 같은 코드를 쓴다(`DB_HOST_BLOCKED`·`HTTP_BLOCKED`, `EMAIL_HOST_BLOCKED` 선례). 나머지 다섯(`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_AUTH_FAILED`·`HTTP_CONNECT_FAILED`·`HTTP_SERVER_ERROR`)은 연결 테스트 전용이다. 이름이 가까운 노드 코드와 모집합이 다를 수 있다. 예전 Database 절의 소문자 `auth_failed`·`network`·`unknown_error` 는 통합 상태 사유와 철자가 같은 다른 층의 값이었다. 연결 테스트 코드는 UPPER_SNAKE_CASE 다. `INTEGRATION_INCOMPLETE`·`INTEGRATION_AUTH_UNSUPPORTED` 는 그 다섯에 들지 않는다. 노드와 공유하는 공통 코드이고(`resolveHttpCredentials`) 요청을 보내기 전에 나온다.
- **저장 전 연결 테스트의 «외부 호출 없음» 범위**: 구조 검증만 하는 서비스는 Cafe24·MakeShop(설계상, 토큰이 막 발급됐거나 설치 대기다)과 Google·GitHub·Webhook(구현 범위, 쓰는 노드가 없다)이다.
- **카운터**: 연결 테스트 실패는 연속 네트워크 실패에 합산하지 않는다. Database 연결 테스트의 일회성 연결은 노드 실행의 커넥션 풀과 별개다.

근거와 실측: `plan/complete/spec-draft-integration-connection-tests.md`.

### SMTP 연결 테스트를 `verify()` 로 구현한다

예전 정의는 SMTP 테스트를 «핸드셰이크 + `NOOP`» 으로 적었지만, 실제로는 email 통합에 transport 테스터가 없어 필드 존재와 타입만 맞으면 무조건 성공을 돌려줬다. 인증에 실패하는 자격 증명도 «연결 성공» 으로 보인다는 운영 보고가 있었다. `nodemailer` 의 `verify()`(연결, 인증, TLS 핸드셰이크)로 바꿔 인증 실패를 미리 정확히 드러낸다.

저장 전 연결 테스트의 «외부 호출 없음» 원칙은 원래 Cafe24 만을 위한 것이었다. OAuth 토큰이 막 발급돼 구조 검증으로 충분해서다. Email 은 외부 네트워크 없이 SMTP 인증을 확인할 수 없으므로 명시적 예외다. 그래서 저장 전 테스트, `:id/test`, 자격 증명 교체 세 경로 모두 email 에서는 실제 `verify()` 를 한다. 2026-09-19 부터 구조 검증만 하는 서비스는 Cafe24 외에 MakeShop·Google·GitHub·Webhook 도 있다(위 항목).

### SMTP SSRF 가드를 HTTP·Database 와 같은 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일한다

SMTP host 도 사설·loopback 주소를 가리킬 수 있어 SSRF 표면이 된다. 별도 opt-in 플래그(`SMTP_BLOCK_PRIVATE_HOSTS` 안)를 새로 만드는 대신 HTTP Request 와 Database Query 가 이미 쓰는 `ALLOW_PRIVATE_HOST_TARGETS` 를 다시 쓴다. 통합 노드 전반의 SSRF 방침(기본 차단, 셀프 호스팅만 해제)을 일관되게 지키고 노드마다 플래그가 갈리는 혼란을 막는다. 연결 테스트만 막고 실제 발송은 뚫리는 비대칭을 막기 위해 Send Email 핸들러에도 같은 가드를 적용한다.

코드 이름은 `EMAIL_HOST_BLOCKED` 다. HTTP 의 `HTTP_BLOCKED` 와 같은 메커니즘이지만 차단 원인(host)과 노드 도메인(email)을 드러내려고 `EMAIL_` prefix 에 `HOST_BLOCKED` 를 붙였다. 에러 코드 enum 은 노드 카테고리별 prefix 가 기준이므로 `HTTP_BLOCKED` 와 형태가 갈리는 것은 의도한 도메인 구분이다.

채팅 채널 실패 분류표는 바꾸지 않는다. `EMAIL_HOST_BLOCKED` 는 노드 수준 `output.error.code`(또는 연결 테스트 `result.code`)로만 나온다. Send Email 실패가 워크플로우 종료로 올라가면 실행 수준 에러 코드는 이미 분류표의 INTERNAL 군에 있는 `ERROR_PORT_FALLBACK` 이 된다([채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md)). 에러 enum 을 늘릴 때의 분류표 검토 의무([에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md))를 따라 검토한 결과 행을 더할 필요가 없다.

### Cafe24 연결 테스트 endpoint 를 `/store` 에서 `/apps` 로 바꿨다

예전에는 `GET /api/v2/admin/store` 로 테스트했는데 운영 중 거짓 실패가 두 가지 보고됐다. 통합이 `mall.read_store` 권한 범위를 갖지 않으면 403 으로 실패해 «토큰은 유효한데 연결 테스트만 실패» 하는 혼란이 생겼다. 또 `/store` 는 상점 수준 메타데이터라 일부 운영자 권한에서 응답 형태가 일정하지 않았다. `GET /api/v2/admin/apps` 는 자기 앱 정보 조회이고 모든 Cafe24 통합은 자기 앱이므로 권한 부족 위험이 가장 적다. Cafe24 OAuth 가 발급한 토큰이면 자기 앱 정보를 볼 권한은 늘 있다.

검토한 다른 후보:

- `/scopes`: 토큰의 현재 권한 범위만 돌려줘 가볍지만 응답이 단순 배열이라 «JSON 본문 200 OK» 검증의 의미가 약하다.
- `/oauth/token` introspection: Cafe24 가 표준 introspection endpoint 를 제공하지 않는다.
- `/products?limit=1` 같은 도메인 호출: 권한 부족 위험이 가장 크다.

연속 네트워크 실패 카운터는 노드 실행 경로의 자동 호출이 쌓여 `error(network)` 로 바꾸는 운영 신호다. 사용자가 직접 누른 연결 테스트는 일회성 진단이라 합산하면 사용자 클릭만으로 상태가 낮아지는 거짓 양성 위험이 커서 뺀다. 이 결정은 `Cafe24ApiClient.pingConnection()` 의 «예외를 던지지 않고 메시지만 돌려준다» 계약과 짝을 이룬다. 401 을 받으면 토큰을 갱신하고 한 번 다시 시도하는 정책도 노드 호출 경로와 같게 맞췄다.
