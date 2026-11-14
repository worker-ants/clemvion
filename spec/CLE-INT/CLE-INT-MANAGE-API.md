---
id: "CLE-INT-MANAGE-API"
title: "통합 관리 — API 와 에러 코드"
type: "design"
version: 3
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT-MANAGE"
ancestors: ["CLE-VISION", "CLE-INT", "CLE-INT-MANAGE"]
area: "CLE-INT"
content_hash: "4e2a0f87cdc0e243ae8ecc2ad4c99c5b6c4c70605686f0d4415e550badb8e708"
read_as: "approved_fallback"
task: "CLE-T-4F33EZ"
source_paths: []
mirror_sha256: "8aa7f278c1d516848e0b67b872dddc7fffa02dffba669dd7301759907e47a06a"
etag: "sha256-c355944f8fea0e98c2bdb3af8db319ca5e68ed12e9478021fbfb8a528ce46f5c"
---
## 개요

이 문서는 [통합 관리](CLE-INT-MANAGE.md) 의 하위 문서로 통합 관리 API 의 경로, `IntegrationDto` 의 파생 값, 중복 사전 감지, 사용처 · 활동 · 카탈로그 API 와 통합 API 의 에러 코드를 정한다. 연결 테스트 세 경로의 결과 모양은 [통합 관리 — 사용처 · 연결 테스트 · 실행 연동](CLE-INT-MANAGE-RUN.md#연결-테스트) 이 정한다.

## API

응답 봉투는 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 을 따른다. 성공은 `{ data: ... }` 또는 `{ data: ..., pagination: ... }` 이고 실패는 에러 응답 봉투 `{ error: { code, message, requestId, details? } }` 다. 봉투 필드의 뜻과 `details` 를 싣는 규칙은 [에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md) 가 정한다.

### 목록과 CRUD

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/integrations` | 목록. 쿼리 `q`, `scope`, `serviceType`, `status`, `page`, `limit`. `status` 허용값은 `connected`·`expiring`·`expired`·`error`·`attention` 이고 `expiring`·`attention` 은 가상 필터 값이다([통합 상태와 만료 알림](CLE-INT-STATUS.md)). 각 행은 상세와 같은 `IntegrationDto` 라 파생 값 두 개가 모두 들어 있다. 페이지네이션은 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 목록 응답을 따른다 |
| POST | `/api/integrations` | 생성. OAuth 는 `previewToken` 으로 서버 임시 저장 토큰을 참조한다. 소비 규칙은 [통합 데이터와 흐름](CLE-INT-DATA.md) |
| GET | `/api/integrations/:id` | 상세. `{ data: IntegrationDto }`. 자격 증명은 가린다 |
| PATCH | `/api/integrations/:id` | 별칭 등 메타 수정 |
| DELETE | `/api/integrations/:id` | 삭제. 사용처가 있으면 409 |
| POST | `/api/integrations/:id/test` | 저장된 자격 증명으로 연결 테스트 |
| GET | `/api/integrations/services` | 지원 서비스 메타데이터(필드 스키마 포함). Cafe24 항목은 `meta.publicAppAvailable` 을 싣는다([OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md)) |

`IntegrationDto` 는 DB 컬럼이 아닌 파생 값 두 개를 응답마다 계산해 싣는다. 이 둘은 이 절이 소유한다.

- **`appUrl: string | null`**: Cafe24 Private 통합은 `${APP_URL}/api/3rd-party/cafe24/install/:installToken`, MakeShop ShopStore 설치 통합은 `${APP_URL}/api/3rd-party/makeshop/install/...`, 그 밖은 `null` 이다. 설치 토큰은 따로 노출하지 않고 App URL 경로 안에만 둔다.
- **`autoRefresh: boolean`**: 자동 갱신 표시. 백엔드 서비스 레지스트리의 `ServiceDefinition.supportsTokenAutoRefresh`(`service-registry.ts`)에서 파생한다. 현재 `cafe24`·`google`·`makeshop`(auth-code + refresh)이 true, 그 밖(`github` 포함)은 false 다. 사이드바 카운트, 주의 필요 배너, `Expiring`·`Attention` 칩, 상세 헤더·개요의 분기 신호이고 권한과 상관없이 모든 인증 요청에 싣는다. Google 이 true 인 문제는 [통합 상태와 만료 알림](CLE-INT-STATUS.md) 의 미결 사항이다.
- 두 파생 값의 서비스별 계산은 `buildIntegrationMeta` 의 `Map<serviceType, fn>` 서비스 레지스트리 방식이다.

`IntegrationDto` 는 파생 값 외에 엔티티 컬럼 투영 여섯 개도 싣는다: `mallId`·`tokenExpiresAt`·`lastRotatedAt`·`reinstallRequestedAt`·`lastUsedAt`·`consecutiveNetworkFailures`. 이 가운데 `reinstallRequestedAt` 은 컬럼 값을 그대로 옮기지 않는다. 남긴 지 24시간이 지난 값은 서버가 `null` 로 가린다(아래 문단). 이 컬럼들의 뜻과 마이그레이션은 [통합 데이터와 흐름](CLE-INT-DATA.md) 이 기준이다. 그 컬럼들이 관여하는 상태 전이와 스캐너 판정은 [통합 상태와 만료 알림](CLE-INT-STATUS.md) 이 기준이다. `consecutiveNetworkFailures` 는 health 판정의 내부 카운터이고 프런트엔드 참조가 0곳(2026-09-10 재측정)이다. 노출을 멈추려는 필드라 새 소비자를 만들지 않는다. 노출 중단을 맡을 Task 는 아직 정하지 않았다.

`reinstallRequestedAt: string | null` 은 재설치 대기 표시(`reinstall_requested_at`, V151)다. ISO 8601 시각이고 표시가 없거나 남긴 지 24시간이 지났으면 `null` 이다. 서버는 24시간이 지난 값을 컬럼에 남겨 두지만 응답에는 싣지 않는다. 지금은 Cafe24 Private 통합에만 값이 생기고 그 밖의 통합은 늘 `null` 이다. 상세 화면의 [재설치 대기 안내](CLE-INT-MANAGE-DETAIL.md#재설치-대기-안내)가 이 값을 쓴다.

### 인증·교체·권한

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/api/integrations/oauth/begin` | OAuth 시작. 요청·응답과 Cafe24 begin 사전 검사는 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md) |
| GET | `/api/integrations/cafe24/precheck` | Cafe24 중복 사전 감지(아래) |
| GET | `/api/integrations/makeshop/precheck` | MakeShop 중복 사전 감지(아래) |
| GET | `/api/3rd-party/cafe24/install/:installToken` | Cafe24 Private App URL. [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md) |
| GET | `/api/3rd-party/makeshop/install/:installToken` | MakeShop App URL. 같은 문서 |
| GET | `/api/3rd-party/:provider/callback` | OAuth 콜백. `:provider ∈ {cafe24, google, github, makeshop}`. 같은 문서 |
| POST | `/api/integrations/preview-test` | 저장 전 연결 테스트 |
| POST | `/api/integrations/:id/reauthorize` | 통합 재인증. OAuth 통합은 `authUrl` 을 발급하고 OAuth 가 아닌 통합은 바로 연결됨으로 되돌린다. 설치 토큰이 있고 설치 대기가 아닌 Cafe24 Private 통합은 재설치 대기 표시만 남기고(이미 있으면 새 시각으로 덮어쓴다) `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl }` 을 돌려준다. 추가 권한 요청의 Private 응답과 같은 모양이고 `scopesAdded` 만 없다. 설치 대기이거나 설치 토큰이 없는 Cafe24 Private 통합과 MakeShop 통합은 400 으로 거절한다. 코드는 Cafe24 Private 이 [에러 코드](#에러-코드) 표의 `CAFE24_PRIVATE_APP_USE_TEST_RUN`·`CAFE24_PRIVATE_APP_INSTALL_TOKEN_MISSING` 이고 MakeShop 이 `MAKESHOP_CREDENTIALS_REQUIRED` 다. Cafe24 Public 통합은 행의 상점 식별자와 앱 유형으로 그 상점의 `authUrl` 을 발급한다. 같은 문서 |
| POST | `/api/integrations/:id/rotate` | OAuth 가 아닌 자격 증명 교체. 본문은 새 자격 증명 객체. 안에서 테스트하고 성공할 때만 저장. 실패하면 400 `INTEGRATION_TEST_FAILED`. `oauth2` 는 `INTEGRATION_ROTATE_UNSUPPORTED` |
| POST | `/api/integrations/:id/request-scopes` | 추가 권한 요청. 본문 `{ scopes: string[] }`. 설치 토큰이 있는 Cafe24 Private 통합은 OAuth 없이 권한 범위를 합쳐 저장하고 설치 대기가 아니면 재설치 대기 표시를 남긴 뒤(이미 있으면 새 시각으로 덮어쓴다) `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded: string[] }` 를 돌려준다. 설치 토큰이 없는 Cafe24 Private 통합(`CAFE24_PRIVATE_APP_INSTALL_TOKEN_MISSING`)과 MakeShop 통합(`MAKESHOP_CREDENTIALS_REQUIRED`)은 400 으로 거절한다. 인증 유형이 `oauth2` 가 아닌 통합은 400 `INTEGRATION_SCOPE_UNSUPPORTED` 다. 400 거절은 모두 가시성(404)과 역할(403) 판정 뒤다. 그 밖의 응답 분기는 같은 문서 |
| PATCH | `/api/integrations/:id/scope` | 공개 범위 전환(관리자) |

같은 «서비스 식별자» 개념인데 두 엔드포인트가 필드명을 다르게 쓴다. `oauth/begin` 은 `OAuthBeginDto.service`, `preview-test` 는 `PreviewTestDto.serviceType` 이다. 두 DTO 가 따로 발전한 결과이며 `service` 이름 변경은 별도 breaking change 범위다.

**중복 사전 감지(precheck)**:

- `GET /api/integrations/cafe24/precheck`: 쿼리 `mallId`(`^[a-z0-9-]{3,50}$`). 응답 `Cafe24PrecheckResultDto`(`ApiOkWrappedResponse` 래퍼) = `{ conflict: bool, existingIntegrationId?: string, existingName?: string, status?: 'connected'|'pending_install'|'expired'|'error' }`.
- `GET /api/integrations/makeshop/precheck`: 쿼리 `shopUid`(`^[A-Za-z0-9_-]{2,64}$`). 응답 모양은 Cafe24 와 같다. MakeShop begin 에는 `shop_uid` 입력이 없으므로(설치 redirect 로 온다) 설치 뒤 식별된 `shop_uid` 의 중복 확인 같은 선제 화면에서 쓴다.
- 인증된 사용자의 현재 워크스페이스(`X-Workspace-Id` 헤더) 소속 행만 본다. 워크스페이스를 넘는 조회 경로가 아니다. 충돌 행이 남의 개인 통합이면 `existingIntegrationId`·`existingName` 을 싣지 않는다. 자격 증명, 토큰, 시각은 싣지 않는다.
- 여러 행이 있으면 `connected > pending_install > error > expired` 순으로 가장 제한적인 상태 하나만 돌려준다. enum 밖의 과도 상태(`initializing` 등)가 오면 `status` 를 빼서 프런트엔드가 모르는 값을 조용히 흘려보내지 않게 한다.
- throttle 은 분당 60회이고 이 엔드포인트 전용 상한이다(`@Throttle`). 일반 API rate limit 위에 더하지 않고 이 값으로 바꾼다. 입력 350ms debounce 기준으로 입력당 정상 호출은 1~2회다.
- NestJS 라우트 선언 순서: `:id` 동적 경로보다 앞에 선언해야 `cafe24`·`makeshop` 이 UUID 로 해석되지 않는다. 컨트롤러 주석에 회귀 방지로 적어 둔다.
- 화면 쪽 근거는 [중복 사전 감지로 상점 식별자 입력 단계에서 미리 알린다](CLE-INT-MANAGE-LIST.md#중복-사전-감지로-상점-식별자-입력-단계에서-미리-알린다) 에 있다.

### 사용처와 활동 API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/integrations/:id/usages` | 사용 중인 워크플로우·노드 목록. 모양은 [사용처 추적과 삭제 차단](CLE-INT-MANAGE-RUN.md#사용처-추적과-삭제-차단) |
| GET | `/api/integrations/:id/activity` | 최근 호출 기록. 쿼리 `limit`(기본 20, 최대 100), `days`(기본 7, 최대 30). 응답 `{ items: ActivityItem[], summary: { totalCalls, successRate, dailyCounts[] } }` |
| GET | `/api/integrations/services/:type/catalog` | 서비스 유형별 API 카탈로그. 응답 `{ operations: Array<{ key, method, path, labelKey, descriptionKey }> }` |

`ActivityItem`(모든 통합 공통):

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | UUID | `integration_usage_log.id` |
| `integrationId` | UUID | `integration_usage_log.integration_id` |
| `nodeExecutionId` | UUID? | `integration_usage_log.node_execution_id`. 컬럼은 NOT NULL 이고 노드 실행이 없으면 행을 쓰지 않으므로 저장된 행에는 늘 있다 |
| `workflowId` | UUID? | 연관 워크플로우(조인) |
| `status` | `'success' \| 'failed'` | 호출 결과 |
| `error` | `{ code, message } \| null` | 실패 코드와 메시지(sanitize 적용) |
| `durationMs` | number | 호출 소요 시간 |
| `at` | ISO8601 | 호출 시각 |
| `apiLabel` | string \| null | 호출 API 라벨(카탈로그 키 형식) |
| `apiMethod` | string \| null | 호출 방식(HTTP 메서드 등) |
| `apiPath` | string \| null | 호출 대상(host+path 등) |

세 `api*` 값을 통합마다 무엇으로 채우는지와 길이 한도는 [통합 데이터와 흐름 「호출 API 식별 채우기 규칙」](CLE-INT-DATA.md#호출-api-식별-채우기-규칙) 한 곳이 정한다. 이 문서는 화면이 세 값을 어떻게 보이는지만 정한다([활동 탭](CLE-INT-MANAGE-DETAIL.md#활동-탭)).

카탈로그 엔드포인트:

- `key` 는 활동 로그 `apiLabel` 과 맞추는 키다. Cafe24 는 `cafe24.<resource>.<operation>`([Cafe24 operation 메타데이터](CLE-C24-META)), MakeShop 은 `makeshop.<resource>.<operation>`([MakeShop operation 메타데이터](CLE-MKS-META)). `method`·`path` 는 endpoint 보조 문구의 대체값이고 `labelKey`·`descriptionKey` 는 프런트엔드 i18n 사전이 사람이 읽는 라벨로 바꾼다.
- `:type='cafe24'`·`'makeshop'` 만 백엔드 메타데이터에서 뽑은 `operations[]` 를 채운다. `http`·`database`·`email`·`webhook`·`mcp`·`google`·`github` 은 빈 배열(`{ operations: [] }`)이다. 지원하지 않는 `:type` 은 일반 404 다.
- 모든 인증 요청이 접근할 수 있고 워크스페이스 격리가 없다(메타데이터는 같다).
- 응답 DTO 이름은 `OperationCatalogDto` 다. 서비스 종류 목록인 `ServiceCatalogDto`(`GET /api/integrations/services`)와 구분한다.
- NestJS 선언 순서는 `:id` 동적 경로보다 앞, `services/:type` 단독 경로(나중에 생기면)보다 뒤다.

### 에러 코드

통합 API 가 내는 에러 코드를 한곳에 모은다. 상태 코드가 정의되지 않은 코드는 비워 둔다.

| 코드 | HTTP | 뜻 |
| --- | --- | --- |
| `INTEGRATION_IN_USE` | 409 | 사용처가 있어 삭제를 막았다. 사용처 목록은 `details.usages` 에 싣는다. 현재 구현은 목록을 싣지 못한다([미결](CLE-INT-MANAGE.md#미결-사항)) |
| `INTEGRATION_NAME_TAKEN` | 409 | 워크스페이스에 같은 이름의 통합이 있다(`integration_workspace_name_unique`, 공개 범위 무관). 생성과 별칭 수정이 낸다. Cafe24 Private·MakeShop 의 `oauth/begin` 이 설치 대기 행을 만들 때도 낸다([OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md#설치-대기-행-재사용의-권한)). 겹친 쪽이 남의 개인 통합이어도 난다([받아들인 잔여](CLE-INT-MANAGE-PERM.md#개인-통합-소유자를-강제한다-404-로-숨기고-역할-우위를-두지-않으며-노드-실행은-후속으로-둔다-2026-09-25)) |
| `INTEGRATION_TEST_FAILED` | 400 | 자격 증명 교체(`:id/rotate`)가 새 자격 증명으로 돌린 연결 테스트가 실패했다. 자격 증명과 상태는 그대로다. `message` 는 테스트 결과의 `message` 다. 결과에 `code` 가 있으면 `details: { testCode }` 로 싣고 없으면 `details` 를 싣지 않는다. 무엇을 확인하는지는 서비스마다 다르다([서비스별 인증 방식과 자격 증명](CLE-INT-AUTH.md)). HTTP 는 `base_url` 이 401·403 을 돌려줄 때만 자격 증명 거부를 안다. `:id/test`·`preview-test` 의 실패는 이 코드가 아니라 200 결과 객체다([연결 테스트](CLE-INT-MANAGE-RUN.md#연결-테스트)) |
| `INTEGRATION_INVALID_SERVICE` | 400 | 지원하지 않는 서비스 유형·인증 유형 조합. 생성과 저장 전 연결 테스트가 공유하는 `IntegrationsService.validateServiceAuthType` 이 서비스 레지스트리(`findVariant`)에 없는 조합을 거부한다. 메시지 `Unsupported service/auth combination: {serviceType}/{authType}` |
| `INTEGRATION_INVALID_CREDENTIALS` | 400 | 생성이나 자격 증명 교체(`:id/rotate`)의 자격 증명이 서비스의 필드 규칙(필수 필드 · 형식)에 맞지 않는다. 교체는 저장된 자격 증명에 새 값을 합친 결과를 본다. 이름이 비슷한 `INTEGRATION_CREDENTIALS_INVALID` 와 다른 코드다 |
| `INTEGRATION_CREDENTIALS_INVALID` | 400 | `previewToken` 으로 통합을 만들 때 저장된 미리보기 자격 증명이 암호화되지 않은 문자열이라 쓰지 않는다 |
| `INTEGRATION_ROTATE_UNSUPPORTED` | 400 | `oauth2` 통합에 자격 증명 교체(`:id/rotate`)를 요청했다. 가시성(404)과 역할(403) 판정 뒤에 본다. 관리자 미만이 OAuth2 조직 통합에 요청하면 403 `ADMIN_REQUIRED` 다([Rationale](#추가-권한-요청은-역할을-인증-유형보다-먼저-판정한다-2026-11-14)) |
| `INTEGRATION_SCOPE_UNSUPPORTED` | 400 | 인증 유형이 `oauth2` 가 아닌 통합에 추가 권한 요청(`:id/request-scopes`)을 했다. 가시성(404)과 역할(403) 판정 뒤에 본다. 관리자 미만이 OAuth2 가 아닌 조직 통합에 요청하면 403 이다([Rationale](#추가-권한-요청은-역할을-인증-유형보다-먼저-판정한다-2026-11-14)) |
| `RESOURCE_NOT_FOUND` | 404 | 없는 통합, 다른 워크스페이스 통합, 남의 개인 통합. 공개 범위 전환 도중 워크스페이스와 함께 지워진 통합도 같다([위험 영역 탭](CLE-INT-MANAGE-DETAIL.md#위험-영역-탭)) |
| `NOT_A_MEMBER` | 403 | 개인 통합 행을 만드는 트랜잭션이 통합 소유자(요청자)의 멤버십을 다시 읽었는데 없다. 라우트 가드가 멤버십을 확인한 뒤 같은 사람이 나가거나 제거된 경쟁에서만 난다. 통합을 만드는 트랜잭션이 먼저 잠글 워크스페이스 행이 그 사이 지워졌을 때도 공개 범위와 관계없이 같은 코드다([통합 쓰기의 잠금 순서](CLE-INT-MANAGE-PERM.md#통합-쓰기의-잠금-순서)). 가드 거부와 같은 코드다([워크스페이스와 멤버 「가드 거부 에러 코드」](../CLE-ACCT/CLE-ACCT-WS.md#가드-거부-에러-코드)) |
| `INTEGRATION_OWNER_NOT_MEMBER` | 409 | 조직 통합을 개인으로 바꾸려는데 통합을 만든 사람(`created_by`, 전환하면 통합 소유자가 된다)이 워크스페이스 멤버가 아니다. 통합은 바뀌지 않는다. 요청자는 멤버이고 통합의 상태와 부딪힌 요청이라 `NOT_A_MEMBER` 를 쓰지 않는다 |
| `ADMIN_REQUIRED` | 403 | 관리자 미만이 조직 통합을 만들거나 바꾸려 했다. `oauth/begin` 이 다시 쓸 조직 설치 대기 행을 관리자 미만이 만난 경우도 같다([OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md#설치-대기-행-재사용의-권한)). 공개 범위 전환은 라우트 가드가 이 코드를 낸다. 삭제는 라우트 가드가 뷰어를 막지 않아 뷰어의 조직 통합 삭제도 이 코드다. 라우트 가드 밖에서는 OAuth 콜백의 커밋 직전 인가 재판정도 관리자 미만인 요청자의 조직 통합 재인증 · 추가 권한 요청을 이 코드로 실패시키고 콜백 팝업과 통합의 `last_error` 로 알린다([OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md#에러-매핑)). 발행처는 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 에도 있다. 뷰어가 이 코드와 `EDITOR_REQUIRED` 가운데 무엇을 받는지는 [권한](CLE-INT-MANAGE-PERM.md#권한) 의 «역할 거부 코드는 라우트 가드가 먼저 정한다» 가 정한다 |
| `EDITOR_REQUIRED` | 403 | 뷰어가 편집자 이상 라우트(생성, 별칭 수정, 자격 증명 교체, 통합 재인증, 추가 권한 요청, 저장 전 연결 테스트, `oauth/begin`)를 불렀다. 대상의 공개 범위와 상관없이 라우트 가드가 낸다. 뷰어의 조회, 저장된 통합의 연결 테스트, 삭제는 이 코드를 내지 않는다. 라우트 가드 밖에서는 OAuth 콜백의 커밋 직전 인가 재판정이 시작과 콜백 사이에 뷰어로 강등된 요청자의 개인 통합 재인증 · 추가 권한 요청을 이 코드로 실패시키고 콜백 팝업과 통합의 `last_error` 로 알린다([OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md#에러-매핑)). 발행처는 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 에도 있다 |
| `OAUTH_STATE_MISMATCH` | 400 | OAuth state 불일치 |
| `OAUTH_STATE_EXPIRED` | 400 | OAuth state 의 유효 시간이 지났다 |
| `INTEGRATION_INSTALL_EXPIRED` | 400 | 설치 기한이 지나 만료된(`install_timeout`) 설치 대기 행에 OAuth 콜백이 늦게 도착했다. 행을 되살리지 않고 `last_error` 도 쓰지 않는다([OAuth 연결과 토큰 갱신 「에러 매핑」](CLE-INT-OAUTH.md#에러-매핑)) |
| `OAUTH_CONFIG_MISSING` | 500 | 서버 OAuth 설정(예: Cafe24 Public 환경 변수) 없음 |
| `OAUTH_PREVIEW_INVALID` · `OAUTH_PREVIEW_EXPIRED` · `OAUTH_PREVIEW_MISMATCH` | 400 | 미리보기 토큰이 없거나 남의 것 · 10분 경과 · 서비스 유형 불일치 |
| `OAUTH_TARGET_MISMATCH` | 400 | `new` 가 아닌 모드(통합 재인증·추가 권한 요청)의 `oauth/begin` 본문이 대상 통합(`integrationId`)과 맞지 않는다. 서비스가 대상 통합의 서비스 유형과 다르거나 Cafe24 상점 식별자·앱 유형이 대상 통합의 `credentials.mall_id`·`credentials.app_type` 과 다르다. state 를 만들지 않는다([OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md#oauthbegin-요청과-응답)). `:id/reauthorize`·`:id/request-scopes` 는 행의 값을 넘기므로 이 코드를 내지 않는다 |
| `INSUFFICIENT_SCOPE` | 403 | 권한 부족. 노드 실행 중 감지하면 통합 상태도 `error(insufficient_scope)` 로 바뀐다. `details.missingScopes: string[]`(Cafe24 응답에서 뽑은 누락 권한 범위)와, Cafe24 만 `details.requiresCafe24Approval?: string[]`(누락 권한과 [Cafe24 별도 승인 scope](CLE-C24-SCOPES) §1·§2 명단 전체의 교집합)를 싣는다. §2 항목은 권한 범위 자체(`mall.read_store`·`mall.write_store`)가 일반 사용 가능이라 교집합은 대개 §1 항목에서 생긴다. 다른 서비스는 이 필드를 뺀다. 프런트엔드는 비어 있지 않으면 «이 권한은 카페24 별도 승인이 필요해요» 를 더 보인다. 새 코드 없이 필드만 더한 보강이다. 노드 실행 중 403 의 노드 출력 코드는 [미결](CLE-INT-MANAGE.md#미결-사항) |
| `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` | 409 | 같은 워크스페이스에 같은 상점의 Cafe24 통합이 있다(앱 유형 무관). `new` 가 아닌 모드의 begin(통합 재인증·추가 권한 요청)은 대상 통합 자신을 빼고 본다. 겹친 행의 통합 ID 는 싣지 않는다. 발행 경로와 이름의 유래는 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md) |
| `CAFE24_PRIVATE_APP_INSTALL_PENDING` | 409 | Cafe24 Private `oauth/begin`(`new`)이 다시 쓸 같은 상점의 설치 대기 행이 남의 개인 통합이다. 통합 ID 와 App URL 을 싣지 않고 `details.pendingInstallExpiresAt` 에 그 행의 설치 기한을 싣는다([OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md#설치-대기-행-재사용의-권한)). 이름이 통합 상태 값 `pending_install` 과 비슷하지만 상태 값이 아니고 `oauth/begin` 이 내는 충돌 코드다 |
| `CAFE24_PRIVATE_APP_USE_TEST_RUN` | 400 | 우리 서버가 OAuth 를 시작할 수 없는 Cafe24 Private 통합에 OAuth 시작을 요청했다. 설치는 «테스트 실행» 이 App URL 을 거쳐 마친다. 나오는 자리는 `client_id`·`client_secret` 을 갖춘 `oauth/begin` 의 `new` 외 모드와 설치 토큰이 있는 설치 대기 Cafe24 Private 통합의 `:id/reauthorize` 다. 설치 대기여도 설치 토큰이 없으면 `CAFE24_PRIVATE_APP_INSTALL_TOKEN_MISSING` 이다. 설치 토큰이 있고 설치 대기가 아닌 통합의 통합 재인증과 추가 권한 요청은 이 코드 대신 재설치 대기 표시를 남긴다. 2026-10-10 에 낼 자리가 좁아졌지만 뜻이 같아 이름을 유지했다([OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md) Rationale) |
| `CAFE24_PRIVATE_APP_INSTALL_TOKEN_MISSING` | 400 | 설치 토큰이 없는 Cafe24 Private 통합(24시간 설치 기한을 넘긴 행, 설치 토큰 보존 전에 연결된 옛 행)에 통합 재인증이나 추가 권한 요청을 했다. App URL 이 없어 «테스트 실행» 이 이 통합으로 돌아오지 못한다. 복구는 행에 따라 다르다. 24시간 설치 기한을 넘긴 행은 지우지 않고 같은 상점을 새로 등록한다. 설치 토큰 보존 전에 연결된 옛 행은 삭제 후 재등록한다. 행에 설치 토큰이 저장돼 있지 않다는 조건이라 App URL 경로의 설치 토큰으로 행을 찾지 못한 `CAFE24_INSTALL_INVALID_TOKEN`(404)과 다르다. 설치 대기 행이어도 설치 토큰이 없으면 이 코드다. 2026-10-15 에 새로 뒀다([OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md) Rationale) |
| `CAFE24_PRIVATE_APP_CREDENTIALS_REQUIRED` | 400 | Cafe24 Private `oauth/begin` 본문에 `client_id`·`client_secret` 이 없다. 콜백의 토큰 교환에서 OAuth state 에 자격 증명이 없을 때도 같은 코드가 난다 |
| `CAFE24_INVALID_MALL_ID` | 400 | Cafe24 `oauth/begin` 의 상점 식별자가 없거나 형식(`^[a-z0-9-]{3,50}$`)이 틀렸다. 통합 재인증과 추가 권한 요청은 행의 `credentials.mall_id` 를 넘기므로 그 값이 없는 옛 행에서 난다. 노드 실행에서 나는 같은 이름의 코드는 [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md) 가 정한다 |
| `CAFE24_INVALID_APP_TYPE` | 400 | Cafe24 `oauth/begin` 의 앱 유형이 `public`·`private` 가 아니다. 통합 재인증과 추가 권한 요청에서는 `credentials.app_type` 이 없는 옛 행에서 난다 |
| `MAKESHOP_USE_SHOPSTORE_INSTALL` | 400 | 본문에 `client_id`·`client_secret` 을 실은 MakeShop `oauth/begin` 이 `new` 외 모드로 왔다. `oauth/begin` 을 직접 부른 요청에서만 난다. 자격 증명이 없으면 그보다 앞에서 `MAKESHOP_CREDENTIALS_REQUIRED` 로 거절된다. MakeShop 통합의 `:id/reauthorize`·`:id/request-scopes` 는 자격 증명을 싣지 않고 begin 을 부르므로 이 코드에 닿지 않는다. MakeShop 은 통합 재인증과 추가 권한 요청이 없고 ShopStore 재설치도 기존 통합을 되살리지 않는다. 복구는 삭제 후 재등록이다. 이름을 유지한 이유는 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md) 의 Rationale |
| `MAKESHOP_CREDENTIALS_REQUIRED` | 400 | MakeShop `oauth/begin` 본문에 `client_id`·`client_secret` 이 없다. MakeShop 통합의 `:id/reauthorize`·`:id/request-scopes` 도 이 코드로 거절한다. 두 경로는 자격 증명 없이 begin 을 부르고 begin 은 모드보다 자격 증명을 먼저 본다. 이 응답은 계약이다(2026-11-13 사용자 결정). 가시성과 역할 판정(404·403)을 통과한 요청만 닿는다. 복구는 삭제 후 재등록이다([OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md#makeshop-은-삭제-후-재등록으로만-복구한다)) |
| `MAKESHOP_ALREADY_CONNECTED` | 409 | 같은 워크스페이스에 같은 `shop_uid` 의 연결됨 MakeShop 통합이 있다. 겹친 행의 통합 ID 는 싣지 않는다 |
| `MAKESHOP_INSTALL_PENDING` | 409 | MakeShop `oauth/begin`(`new`)이 다시 쓸 같은 `client_id` 의 설치 대기 행이 남의 개인 통합이다. 응답 모양은 `CAFE24_PRIVATE_APP_INSTALL_PENDING` 과 같다. `MAKESHOP_INSTALL_*` 계열이지만 설치 엔드포인트가 아니라 `oauth/begin` 이 낸다. 그래서 클라이언트는 접두로 묶지 않고 코드 값 전체로 분기한다 |
| `CAFE24_INSTALL_MISSING_PARAMS` | 400 | App URL 호출에 `mall_id`·`timestamp`·`hmac` 누락 |
| `CAFE24_INSTALL_INVALID_TOKEN` | 404 | App URL 경로의 설치 토큰으로 행을 찾지 못했다(삭제, 24시간 만료, 회복 실패) |
| `CAFE24_INSTALL_INVALID_HMAC` | 403 | App URL HMAC 검증 실패 |
| `CAFE24_INSTALL_REPLAY` | 400 | App URL timestamp 가 ±5분 창 밖 |
| `CAFE24_INSTALL_RATE_LIMITED` | 429 | 같은 IP 의 설치 토큰 조회·HMAC 실패가 임계치 초과 |
| `MAKESHOP_INSTALL_REPLAY` | 400 | MakeShop App URL timestamp 가 ±5분 창 밖 |
| `MAKESHOP_INVALID_SHOP_UID` | 400 | MakeShop App URL 의 `shop_uid` 형식 위반. 노드 출력 문맥은 [MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md) 가 정한다 |

설치 엔드포인트 코드의 조건과 순서는 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md), 409 등 상태 코드 선택은 [OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md), 코드 명명 규율은 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 가 정한다.

## 구현 위치

- `codebase/backend/src/modules/integrations/**` (`integrations.service.ts`: `reauthorize`·`requestScopes`·`rotate`·`getForExecution`, `dto/responses/integration-response.dto.ts`: `reinstallRequestedAt`·`authorIsIntegrationOwner`)
- `codebase/backend/src/common/filters/http-exception.filter.ts` (에러 응답 봉투)
- `codebase/frontend/src/lib/api/integrations.ts`
- `codebase/frontend/src/lib/api/integration-error-codes.ts`

## Rationale

### 추가 권한 요청은 역할을 인증 유형보다 먼저 판정한다 (2026-11-14)

`:id/request-scopes` 는 가시성(404), 역할(403), 인증 유형(400) 순서로 판정한다(NERV Task `CLE-T-RW69WZ`). 전에는 인증 유형을 먼저 봐서 관리자 미만이 OAuth2 가 아닌 조직 통합에 요청하면 400 을 받았다. [통합 관리](CLE-INT-MANAGE.md) 의 역할 거부 요구사항은 이 요청을 403 으로 거절한다.

- **기각한 안**: 요구사항을 400 우선으로 고치는 안. 드러나는 것은 요청자가 이미 볼 수 있는 인증 유형뿐이라 보안 차이는 없다. 그래도 권한이 없는 요청자가 요청 형식 오류를 받아 맞지 않는 안내를 보게 된다.
- **자격 증명 교체도 같은 순서다 (2026-11-14, NERV Task `CLE-T-4F33EZ`).** `:id/rotate` 도 인증 유형보다 역할을 먼저 본다. 관리자 미만이 OAuth2 조직 통합에 교체를 요청하면 403 `ADMIN_REQUIRED` 다. 소유자 · 관리자가 보낸 요청과 본인 개인 통합에 보낸 요청은 400 `INTEGRATION_ROTATE_UNSUPPORTED` 다.

### MakeShop 거절 코드를 계약으로 정하고 에러 표를 구현에 맞춘다 (2026-11-13)

이 개정은 동작을 바꾸지 않고 문서와 구현의 어긋남을 맞췄다.

- **MakeShop 통합의 `:id/reauthorize` · `:id/request-scopes` 는 400 `MAKESHOP_CREDENTIALS_REQUIRED` 다.** 2026-11-13 에 사용자가 이 응답을 계약으로 정했다. 두 경로는 MakeShop 행으로 begin 을 부를 때 자격 증명을 싣지 않고 begin 은 모드보다 자격 증명을 먼저 보므로 이 코드에서 끝난다. 이 거절에 새 코드를 두지 않았다. 화면이 두 버튼을 이미 막고(`makeshop` 비활성 이유) 복구도 삭제 후 재등록 하나뿐이다.
- **`MAKESHOP_USE_SHOPSTORE_INSTALL` 은 `oauth/begin` 을 직접 부른 요청에서만 난다.** 두 `:id` 경로가 이 코드를 받는 것처럼 읽히던 설명을 고쳤다.
- **세 `api*` 값의 채우기 규칙은 [통합 데이터와 흐름 「호출 API 식별 채우기 규칙」](CLE-INT-DATA.md#호출-api-식별-채우기-규칙) 한 곳에 둔다.** 한쪽만 바뀌면 두 문서가 갈리므로 이 문서에는 화면이 세 값을 보이는 규칙과 링크만 둔다.

### `IntegrationDto` 인벤토리 주장의 경계 (2026-09-10)

«`IntegrationDto` 는 파생 값 두 개를 싣는다» 는 문자 그대로는 참이지만 읽는 사람에게는 응답 모양의 전수 목록처럼 보인다. 실제 DTO 는 컬럼 투영을 더 싣는다. 그래서 경계 문장을 덧붙였다. 원문을 지우지 않은 이유는 그 문장이 왜 두 파생 값만 이 절이 소유하는지(계산 값과 컬럼 투영의 차이)를 담고 있어서다.

컬럼의 뜻과 마이그레이션은 데이터 문서가 이미 모두 갖고 있어 복제하지 않는다. 옮기면 두 자리가 갈리는 원인이 하나 늘 뿐이다. 다만 기준을 데이터 문서에 통째로 넘기지도 않았다. 데이터 문서의 `consecutive_network_failures` 행 자신이 전이 규칙은 상태 전이 문서라고 되짚기 때문이다. 그래서 범위를 뜻·마이그레이션으로 좁히고 전이 축은 상태 문서로 명시했다. 경계 문장을 에러 코드 표가 아닌 상세 API 행에 둔 이유는 좁은 인벤토리 주장이 실제로 있는 자리가 상세 API 행이라서다.

이 경계 문장에는 유지 비용이 있다. `consecutiveNetworkFailures` 가 실제로 제거되면 여기 문장과 DTO JSDoc(`integration-response.dto.ts` 의 그 필드 주석) 두 자리를 함께 지워야 한다. 그래도 두는 이유는 경계 문장이 없으면 다음 프런트엔드 작업자가 그 필드를 소비할 수 있고 그러면 제거가 파괴적 변경이 되어 그 항목이 영영 닫히지 못하기 때문이다. 2026-10-10 에 `reinstallRequestedAt` 이 더해져 컬럼 투영은 여섯 개가 됐다. 이 값은 컬럼 값을 그대로 싣지 않고 남긴 지 24시간이 지난 값을 `null` 로 가린다.
