---
id: "CLE-INT-DATA-ENTITY"
title: "통합 데이터와 흐름 — 엔티티와 인덱스"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT-DATA"
ancestors: ["CLE-VISION", "CLE-INT", "CLE-INT-DATA"]
area: "CLE-INT"
content_hash: "83d6b4e5ac5a03ae4aef0d61273460201a19660a40a9f349f3c964ee0ed2c96d"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "e7faa82afd9403478f508d71c152b91d4fbe60f8e01b7fffe76c386dd674c873"
etag: "sha256-a52c35e3551c769f03249f1b6bfe30ef6404a2a33ba3b25d6de9d975d5abbdcd"
---
> 구현 상태: 구현됨 · 원문 출처는 부모 [통합 데이터와 흐름](CLE-INT-DATA.md) 머리 줄 · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 [통합 데이터와 흐름](CLE-INT-DATA.md) 의 하위 문서로 통합 도메인이 저장하는 엔티티(통합, 활동 로그, 연결 과정의 임시 테이블 세 개, 시크릿 저장소)의 필드 · 제약과 인덱스를 정한다. 엔티티 관계도와 암호화 규칙은 부모 문서가 정한다.

## 엔티티

### 통합 (`integration`)

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace (CASCADE) |
| service_type | String | 서비스 유형(`service_type`). `google`, `github`, `http`, `database`, `email`, `webhook`, `mcp`, `cafe24`, `makeshop`. 서비스별 자격 증명 형식은 [서비스별 인증 방식과 자격 증명](CLE-INT-AUTH.md). `cafe24`·`makeshop` 통합은 워크플로우 노드와 AI 에이전트의 내부 MCP 브리지 양쪽에서 쓴다([MCP 클라이언트](CLE-INT-MCP.md)) |
| name | String | 사용자가 정한 별칭 |
| auth_type | Enum | 통합 인증 유형(`auth_type`). `oauth2` / `api_key` / `bearer_token` / `basic` / `connection_string` / `smtp` / `webhook_outbound` / `none`. `none` 은 인증 없는 공용 MCP 서버 등에 쓴다 |
| credentials | JSONB (encrypted) | 자격 증명. 암호화해 저장한다([암호화](CLE-INT-DATA.md#암호화)). OAuth 통합은 권한 범위(`scopes: string[]`)를 포함한다 |
| scope | Enum | 공개 범위(`Integration.scope`). `personal` / `organization` |
| status | Enum | 통합 상태. `connected` / `expired` / `error` / `pending_install`. 전이 규칙은 [통합 상태와 만료 알림](CLE-INT-STATUS.md) |
| install_token | String? | 설치 토큰. Cafe24 Private 앱과 MakeShop ShopStore 설치 우선 흐름에서 설치 대기 통합을 가리키는 식별 키다. 그 밖의 서비스 유형은 NULL 이다. 발급 시 16바이트를 base64url(패딩 없음, 22자)로 인코딩한다. 통합이 살아 있는 동안 보존한다(App URL 경로 식별 키). 예외로 `oauth/begin` 이 설치 대기 행을 다시 쓰면서 새로 발급할 때가 있다. 그 조건은 [OAuth 연결과 토큰 갱신 「`oauth/begin` 요청과 응답」](CLE-INT-OAUTH.md#oauthbegin-요청과-응답) 이 정한다. 연결 성공 콜백에서도 보존하고, 설치 대기 24시간 만료 또는 통합 삭제에서만 NULL 로 지운다. `varchar(64)`, V042 |
| install_token_issued_at | Timestamp? | 설치 토큰 발급 시각. 설치 대기 만료 판정의 기준이다. 설치 토큰을 새로 발급할 때만 갱신한다. 설치 대기 행을 다시 써도 설치 토큰을 보존하면 그대로 두고 연결 성공 콜백에서도 보존한다. 만료·삭제 경로에서만 NULL 로 지운다. V044 이전 행은 NULL 이며 스캐너가 `created_at` 으로 대신 판정한다. Cafe24 Private 과 MakeShop 모두 적용한다. V044 |
| mall_id | String? | 상점 식별자(`mall_id`)의 평문 투영. Cafe24 는 `credentials.mall_id`, MakeShop 은 `credentials.shop_uid` 를 이 컬럼에 복제한다. Cafe24·MakeShop 외 서비스 유형은 항상 NULL 이다. NULL 인 경우는 셋이다. V045 이전 행은 다음 저장(콜백·재인증)에서 채운다. MakeShop 설치 대기 행은 App URL 을 거쳐 `shop_uid` 를 받을 때 채운다. 설치 대기 행이 설치 기한을 넘겨 만료(`install_timeout`)되면 NULL 로 비운다([통합 상태와 만료 알림](CLE-INT-STATUS.md#상태-전이)). 이 규칙 전에 만료된 행은 V154 가 한 번 비웠다. 만료 행은 다시 채우지 않는다. 콜백, begin 의 행 재사용, App URL 은 설치 대기 행만 다룬다. NULL 이 세 뜻이라 같은 상점을 찾을 때 NULL 로 가르지 않는다(아래 상점 식별자 유일성의 조회 함수). Cafe24·MakeShop 행에서도 NOT NULL 로 강화하지 않는다. V045 |
| status_reason | String? | 상태 사유. snake_case 코드이고 허용값은 코드 union `INTEGRATION_STATUS_REASONS` 한 곳에서 정한다. 상태별 허용값은 [통합 상태와 만료 알림](CLE-INT-STATUS.md). 연결됨 행에도 사유가 남을 수 있다. 통합 재인증이나 추가 권한 요청의 콜백에서 Cafe24 가 권한 범위를 거부하면 상태는 그대로 두고 `oauth_invalid_scope` 를 남긴다([통합 상태와 만료 알림 「상태 값과 상태 사유」](CLE-INT-STATUS.md#상태-값과-상태-사유)). `VARCHAR(64)`, V008 |
| consecutive_network_failures | int | 연속 네트워크 실패 횟수. 노드 실행이나 토큰 갱신 중 transport 실패가 나면 늘고, 성공하면 0 으로 되돌린다. 3 에 닿으면 상태를 `error(network)` 로 바꾸고 0 으로 되돌린다. NOT NULL DEFAULT 0. V049 |
| token_expires_at | Timestamp? | OAuth 토큰 만료 시각 |
| last_used_at | Timestamp? | 마지막으로 노드 실행에서 쓴 시각(캐시) |
| last_rotated_at | Timestamp? | 자격 증명을 마지막으로 바꾼 시각(OAuth 통합 재인증, 자격 증명 교체, 토큰 자동 갱신) |
| reinstall_requested_at | Timestamp? | 재설치 대기 표시(reinstall request mark). 설치를 마친 Cafe24 Private 통합에 통합 재인증이나 추가 권한 요청이 들어온 시각이고 사용자가 Cafe24 «테스트 실행» 으로 OAuth 를 마치기를 기다린다는 뜻이다. App URL 이 이 값을 보고 OAuth 로 보낸다. 상태·상태 사유와 따로 둔 컬럼이라 표시를 남겨도 상태·상태 사유·자격 증명은 바뀌지 않는다. 남긴 시각부터 24시간 동안만 유효하고 그 뒤에는 서버가 표시가 없는 것으로 본다. 콜백이 성공할 때만 NULL 로 지운다(자격 증명 교체와 같은 트랜잭션). 24시간이 지난 값은 지우지 않고 판정에서 무시한다. 다시 요청하면 새 시각으로 덮어쓴다. 설치 대기 행과 그 밖의 서비스 유형은 늘 NULL 이다. 상태 모델과의 관계는 [통합 상태와 만료 알림](CLE-INT-STATUS.md#재설치-대기-표시), 남기고 지우는 규칙은 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md#재설치-대기-표시). `TIMESTAMPTZ NULL`, V151 |
| last_error | JSONB? (encrypted) | 최근 호출 실패 요약 `{ code, message, at, details? }`. 암호화해 저장한다([암호화](CLE-INT-DATA.md#암호화)). `details` 는 사유별 추가 맥락을 담는 `Record<string, unknown>` 이다. 현재 정의된 키는 `oauth_invalid_scope` 의 `details.requiresCafe24Approval: string[]`(요청 권한 범위와 [Cafe24 별도 승인 scope](CLE-C24-SCOPES) §1 명단의 교집합) 하나다. 새 사유가 키를 쓰면 이 행에 정의를 더한다. 이 컬럼은 저장만 책임지고 응답 노출은 각 API 정의가 통제한다 |
| created_by | UUID | FK → User (NO ACTION). 통합 소유자(`created_by`). 개인 통합의 통합 소유자가 워크스페이스를 나가거나 제거되면 그 행을 지운다([통합 관리](CLE-INT-MANAGE.md#나간-멤버의-개인-통합은-나갈-때-지운다-2026-10-29)) |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

제약:

- `UNIQUE(workspace_id, name)`: 워크스페이스 안에서 별칭은 하나뿐이다. 공개 범위와 상관없다.
- 상점 식별자 유일성: 한 워크스페이스 안에서 같은 `(service_type, mall_id)` 의 통합은 최대 1행이다. Cafe24 는 앱 유형과 상관없다. 한 상점에 Public 앱 통합과 Private 앱 통합을 함께 두면 토큰과 웹훅 처리 주체가 갈려 사용자 혼란과 회계 충돌이 생기므로 금지한다. 서로 다른 서비스 유형이 같은 `mall_id` 값을 쓰는 것은 괜찮다. 설치 기한을 넘겨 만료된 행은 `mall_id` 를 비우므로 이 유일성에 들지 않는다([OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md#만료된-설치-대기-행은-상점-자리를-놓는다-2026-10-29)).
  - 같은 상점의 행을 찾는 네 지점(중복 사전 감지, `oauth/begin`, 설치 엔드포인트, 설치 토큰 불일치 회복)은 조회 함수 하나를 거친다. 만료 행 제외는 그 함수가 한다. `mall_id` 컬럼이 빈 옛 행을 `credentials.mall_id` 로 맞추는 대체 경로(`findAllCafe24RowsForMall`)도 같은 함수 안에서 만료 행을 거른다.
  - 만료 행은 상점 자리를 놓아도 이름은 그대로다. 같은 이름으로 다시 등록하면 409 `INTEGRATION_NAME_TAKEN` 이다.

응답 전용 값: `IntegrationDto` 는 DB 컬럼이 아닌 두 값 `autoRefresh`·`appUrl` 을 응답 시점에 계산해 싣는다. 정의는 [통합 관리](CLE-INT-MANAGE.md) 의 API 절이 소유한다. 복호화에 실패한 행을 응답에서 `statusReason='credentials_unreadable'` 로 표시하는 규칙도 DB 저장값이 아니다([통합 상태와 만료 알림](CLE-INT-STATUS.md)). `reinstall_requested_at` 은 컬럼 값을 `reinstallRequestedAt`(ISO 8601 또는 `null`)으로 내보낸다. 남긴 지 24시간이 지난 값은 `null` 로 내보낸다.

### 활동 로그 (`integration_usage_log`)

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| integration_id | UUID | FK → Integration (CASCADE) |
| node_execution_id | UUID | FK → NodeExecution (CASCADE) |
| workflow_id | UUID | FK → Workflow (CASCADE). 조회 최적화용 비정규화 |
| status | Enum | `success` / `failed` |
| error | JSONB? | 실패 요약 `{ code, message }` |
| duration_ms | Integer | 호출 소요 시간 |
| at | Timestamp | 호출 시각 |
| api_label | varchar(128)? | 호출 API 라벨(`api_label`). 아래 채우기 규칙을 따른다 |
| api_method | varchar(8)? | HTTP 메서드, SQL 동사, `SEND` 처럼 통합마다 뜻이 다르다 |
| api_path | varchar(256)? | endpoint 경로, 드라이버 이름, SMTP host 처럼 통합마다 뜻이 다르다 |

- 보존 기간은 90일이다. 만료 스캐너의 `usage-log-prune` 작업이 매일 정리한다([통합 상태와 만료 알림](CLE-INT-STATUS.md)).
- `api_*` 세 컬럼은 길이 한도를 넘으면 끝에 `…` 를 붙여 잘라 저장한다(`clampMessage` 패턴).
- `node_execution_id` 가 없으면 행을 쓰지 않는다([실행과 정리 흐름 「노드 실행의 통합 사용」](CLE-INT-DATA-RUN.md#노드-실행의-통합-사용)). 그래서 저장된 행에는 항상 노드 실행이 있다.

#### 호출 API 식별 채우기 규칙

활동 로그에 행을 쓰는 실행 경로는 `logUsage` 를 부를 때 `api` 식별 정보를 함께 넘긴다. 외부 MCP 서버의 도구 호출만 예외다(아래 적용 범위 3). 채우는 값은 통합마다 다르다. 이 표가 채우기 규칙의 단일 기준이고, 각 노드 문서의 «활동 로그» 절은 자기 행을 가리킨다. [통합 관리 「활동 탭」](CLE-INT-MANAGE.md#활동-탭) 은 세 값을 화면에 어떻게 보이는지만 정하고 채우기 규칙은 이 표를 가리킨다.

| 통합 | `api_label` | `api_method` | `api_path` |
| --- | --- | --- | --- |
| cafe24 ([Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md)) | 카탈로그 키 `cafe24.<resource>.<operation>` ([Cafe24 operation 메타데이터](CLE-C24-META)) | operation 의 HTTP 메서드(`GET`/`POST`/…) | operation 의 경로 템플릿. 자리표시자를 그대로 둔다(`products/{product_no}`) |
| makeshop ([MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md)) | 카탈로그 키 `makeshop.<resource>.<operation>` ([MakeShop operation 메타데이터](CLE-MKS-META)) | operation 의 HTTP 메서드(`GET`/`POST`) | operation 의 상대 경로(`product`, `cart/create`). MakeShop 경로에는 `{shopId}` 밖의 path 파라미터가 없어 자리표시자가 없다([MakeShop API 카탈로그](CLE-MKS-CATALOG)) |
| http-request ([HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md)) | NULL | HTTP 메서드 | host + path. query string 은 뺀다. baseUrl 이 없으면 path 만 |
| database-query ([Database Query 노드](../CLE-NODE-INT/CLE-NODE-DBQUERY.md)) | NULL | SQL 동사(`SELECT`/`INSERT`/`UPDATE`/`DELETE`). `queryType='raw'` 이면 평가된 SQL 의 첫 토큰을 대문자로 뽑고, 뽑지 못하면 NULL 이다. 상세는 노드 문서 | 드라이버(`postgres` / `mysql`) |
| send-email ([Send Email 노드](../CLE-NODE-INT/CLE-NODE-EMAIL.md)) | NULL | `SEND` | SMTP host 또는 NULL |
| mcp (외부 MCP 서버, [MCP 클라이언트](CLE-INT-MCP.md)) | NULL | NULL | NULL. 도구 호출을 기록하지만 `api` 를 넘기지 않는다 |

적용 범위는 세 경로다. 앞의 두 경로가 `api` 를 넘긴다.

1. 노드 핸들러 경로: cafe24·makeshop·http-request·database-query·send-email 노드는 `IntegrationHandlerBase.logUsage` 에 `api` 인자를 넘기고, 베이스 클래스가 `IntegrationsService.logUsage` 로 전달한다.
2. 내부 MCP 브리지 경로: AI 에이전트 노드에 붙은 통합을 MCP 도구로 노출하는 도구 프로바이더(`Cafe24McpToolProvider`, `MakeshopMcpToolProvider`)는 노드 베이스 클래스를 거치지 않고 `IntegrationsService.logUsage` 를 직접 부른다. 도구 프로바이더는 도구 목록을 만들 때 얻은 통합을 들고 있다가 도구를 실행할 때 그 통합을 넘긴다. 이 경로도 노드 핸들러와 같은 카탈로그 키 형식으로 `api.label` 을 채운다. 이때 `node_execution_id` 는 호출 시점의 AI 에이전트 노드 실행이다. 메타 도구 호출은 기록하지 않는다.
3. 외부 MCP 서버 경로: AI 에이전트 노드에 붙은 `mcp` 통합의 도구 호출(`McpToolProvider`)도 `IntegrationsService.logUsage` 를 직접 부른다. 이 경로는 `api` 를 넘기지 않아 세 컬럼이 NULL 이다.

내부 MCP 브리지 경로는 노드 베이스 클래스를 거치지 않으므로 `api` 를 빠뜨려도 노드 핸들러 테스트는 통과한다. 새 노드 핸들러나 새 브리지 도구 프로바이더를 더할 때 `logUsage` 의 `api` 동반을 반드시 확인한다.

### 통합 OAuth state (`integration_oauth_state`)

통합 연결의 인가 요청과 콜백을 짝짓는 10분짜리 일회용 행이다(V009). 소셜 로그인의 `auth_oauth_state` 와 다른 테이블이다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| state | VARCHAR(64) | 인가 요청 식별값. `UNIQUE` |
| workspace_id | UUID | 요청한 워크스페이스. FK → Workspace (CASCADE) |
| user_id | UUID | 요청한 사용자. 설치 흐름(App URL)이 만든 행은 요청자가 아니라 통합 소유자(`created_by`)다. FK → User (CASCADE) |
| provider | VARCHAR(32) | OAuth 제공자 |
| service_type | VARCHAR(50) | 서비스 유형 |
| mode | VARCHAR(32) | `new` / `reauthorize` / `request_scopes` (`OAuthStateMode`). DB CHECK 가 세 값만 받는다 |
| integration_id | UUID? | 통합 재인증·추가 권한 요청·설치 흐름에서 채운다. `mode='new'` 면 NULL 이다. FK → Integration (CASCADE) |
| requested_scopes | TEXT[] | 요청한 권한 범위. 기본값은 빈 배열 |
| integration_name | VARCHAR(255)? | 통합 이름. 현재 구현은 `oauth/begin` 이 받은 이름을, 설치 흐름에서는 대상 통합의 이름을 담는다. 원문 흐름 정의에는 없는 컬럼이다 |
| scope | VARCHAR(20)? | 공개 범위(`personal` / `organization`). 담는 방식은 `integration_name` 과 같다 |
| provider_meta | JSONB? (encrypted) | V041. 콜백까지 들고 가야 하는 값을 담는다. Cafe24 는 `mall_id`·`client_id`·`client_secret`, MakeShop 은 `shop_uid`·클라이언트 자격 증명·PKCE `code_verifier` |
| expires_at | Timestamp | 발급 시각 + 10분 |
| created_at | Timestamp | 생성 시각 |

콜백은 `DELETE … RETURNING` 으로 한 번만 소비한다. 콜백이 동시에 두 번 와도 한쪽만 이긴다.

### 미리보기 토큰 (`integration_oauth_preview`)

새 OAuth 연결(`mode='new'`)이 통합 행을 만들기 전까지 토큰을 맡겨 두는 10분짜리 테이블이다(V009).

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| preview_token | VARCHAR(64) | PK. `'tmp_'` + hex 32자 |
| workspace_id | UUID | 발급받은 워크스페이스. FK → Workspace (CASCADE) |
| user_id | UUID | 발급받은 사용자. FK → User (CASCADE) |
| service_type | VARCHAR(50) | 서비스 유형 |
| credentials | JSONB (encrypted) | 콜백이 받은 토큰 |
| token_expires_at | Timestamp? | 토큰 만료 시각 |
| expires_at | Timestamp | 발급 시각 + 10분 |
| created_at | Timestamp | 생성 시각 |

`POST /api/integrations` 가 소유자 조건을 WHERE 에 넣은 `DELETE … RETURNING` 으로 한 번만 소비한다. 만료된 행은 다음 `oauth/begin` 이 비동기로 지운다.

### 만료 알림 발사 기록 (`integration_expiry_dispatch`)

만료 스캐너가 임계마다 알림을 한 번만 보내도록 선점(claim)하는 테이블이다(V009).

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| integration_id | UUID | FK → Integration (CASCADE) |
| threshold | VARCHAR(16) | `'7d'` / `'3d'` / `'0d'`. DB CHECK 가 세 값만 받는다 |
| token_expires_at | Timestamp | 발사 기준이 된 만료 시각 |
| dispatched_at | Timestamp | 발사 시각. 기본값은 INSERT 시각 |

`UNIQUE (integration_id, threshold, token_expires_at)` 로 같은 만료 시각에 대해 임계마다 한 번만 발사한다. 통합 재인증으로 `token_expires_at` 이 바뀌면 새 키가 되어 다시 발사할 수 있다. 선점은 `INSERT … ON CONFLICT DO NOTHING` 이고, 충돌하면 그 임계를 건너뛴다.

### 일시 테이블의 FK 와 삭제 동작

세 테이블의 FK 는 모두 `ON DELETE CASCADE` 다. 부모 행이 지워지면 함께 지워진다.

| 테이블 | FK | 부모 |
| --- | --- | --- |
| `integration_oauth_state` | `workspace_id` | Workspace |
| `integration_oauth_state` | `user_id` | User |
| `integration_oauth_state` | `integration_id` (nullable) | Integration |
| `integration_oauth_preview` | `workspace_id` | Workspace |
| `integration_oauth_preview` | `user_id` | User |
| `integration_expiry_dispatch` | `integration_id` | Integration |

- 두 OAuth 일시 테이블에서 사용자를 가리키지 않는 FK 셋(`integration_oauth_state` 의 `workspace_id`·`integration_id`, `integration_oauth_preview` 의 `workspace_id`)에는 FK 인덱스를 두지 않는다. 10분 만료 일시 행이라 삭제 연쇄 비용이 호출당 0.1 ms 미만이다. 처분 근거는 [데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md) 의 Rationale «쓸 인덱스가 없는 FK 서른하나의 처분» 이다.
- 사용자 FK 는 앱에 사용자 삭제 경로가 없어 실제로 연쇄가 일어나지 않는다([데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md) 의 FK 삭제 동작).

### 시크릿 저장소 (`secret_store`)

워크스페이스 단위 비밀을 암호화해 보관하는 테이블이다. 참조 형식, 암호화 형식, 호출 규약은 [시크릿 저장소](CLE-INT-SECRET.md) 가 단일 기준이다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| ref | TEXT | PK. 시크릿 참조 `secret://<scope>/<resourceId>/<name>` (예: `secret://triggers/{triggerId}/bot-token`). 형식은 DB CHECK 로도 막는다(V063) |
| workspace_id | UUID | 귀속 워크스페이스. 처음 저장한 값에서 바뀌지 않는다. `rotate` 는 다른 워크스페이스로 부르면 거부한다([시크릿 저장소](CLE-INT-SECRET.md) 규칙 25). FK 가 없다(애플리케이션 수준 정리). 애플리케이션에는 이 컬럼을 조건으로 지우는 경로가 없다. 트리거 단위 prefix 삭제(`deleteByPrefix`)로 정리한다. 다른 워크스페이스의 요청이 덮어쓴 행(교차 행)과 그 점검 · 정리를 걷은 경위는 [시크릿 저장소 「교차 행 점검과 정리」](CLE-INT-SECRET.md#교차-행-점검과-정리) 에 있다. 어느 경로가 언제 지우는지는 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) |
| encrypted | BYTEA | `[IV(12B) ‖ AES-256-GCM ciphertext ‖ authTag(16B)]`. AAD 는 `ref`. DB 는 암호문만 본다 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 마지막 교체 시각 |

현재 쓰는 참조:

- `secret://triggers/{id}/bot-token`: 채팅 채널 봇 토큰(채널 프로바이더 공통). [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md)
- `secret://triggers/{id}/bot-token.v2`: 봇 토큰 24시간 유예용
- `secret://triggers/{id}/inbound-signing`: 채팅 채널 인바운드 웹훅 출처 검증 자료(채널 프로바이더 공통 슬롯). [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md)
- `secret://triggers/{id}/notification-signing`: EIA 알림 웹훅 HMAC 서명 시크릿. [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md)

`secret://triggers/{id}/notification-signing.v2` 는 예약만 된 참조다. 현재 구현은 이 참조를 쓰지 않고, 유예 기간의 새 서명 시크릿을 `Trigger.notification_secret_v2` 컬럼에 둔다([시크릿 저장소](CLE-INT-SECRET.md)).

## 인덱스

| 테이블 | 인덱스 | 용도 |
| --- | --- | --- |
| integration | `(workspace_id, name)` UNIQUE | 별칭 유일성 (V001/V008) |
| integration | `(workspace_id, service_type)` | 서비스별 통합 조회 |
| integration | `(workspace_id, status)` | 만료·오류 배지 카운트, 설치 대기 만료 스캔, 중복 조회 겸용 |
| integration | `(token_expires_at)` | 만료 스캐너 배치 조회 (V009) |
| integration | `(install_token) WHERE install_token IS NOT NULL` UNIQUE | App URL 로 설치 대기 통합 한 행을 찾는다. Cafe24 Private 과 MakeShop 공용. 유일성은 워크스페이스를 가리지 않는 전역이다 (V043) |
| integration | `idx_integration_workspace_service_mall` `(workspace_id, service_type, mall_id) WHERE mall_id IS NOT NULL` UNIQUE | 상점 식별자 중복 방지. 서비스 유형을 키에 넣어 새 통합 서비스를 더할 때 인덱스와 마이그레이션이 필요 없다. 옛 서비스별 UNIQUE(V046 cafe24, V071 makeshop)를 대체한다. CONCURRENTLY 라 V045 컬럼 추가와 다른 마이그레이션이다 (V072) |
| integration | `idx_integration_service_mall` `(service_type, mall_id) WHERE mall_id IS NOT NULL` | 복호화 없이 상점 식별자로 찾는다(Cafe24 설치 토큰 불일치 회복 등). 옛 cafe24 전용 `idx_integration_cafe24_mall_id_partial`(V051)을 대체한다 (V072) |
| integration_usage_log | `(integration_id, at DESC)` | 통합별 최근 활동 로그 (V008) |
| integration_usage_log | `(at)` | 보존 기간 정리 배치 |
| integration_usage_log | `(node_execution_id)` | 노드 실행 삭제의 FK CASCADE. CONCURRENTLY (V113) |
| integration_usage_log | `(workflow_id)` | 워크플로우 삭제의 FK CASCADE. CONCURRENTLY (V114) |
| integration_oauth_state | `(expires_at)` | 만료 행 정리 (V009) |
| integration_oauth_preview | `(expires_at)` | 만료 행 정리 (V009) |
| secret_store | `idx_secret_store_workspace_id` `(workspace_id)` | 워크스페이스별 정리·조회용으로 만들었다. 지금은 이 컬럼으로 거르는 애플리케이션 조회가 없다 (V063) |

`api_*` 컬럼에는 아직 인덱스가 없다. 메서드·경로별 필터(예: «5xx 응답만»)가 필요해질 때 더한다. `reinstall_requested_at` 에도 인덱스가 없다. App URL 은 설치 토큰으로 한 행을 찾은 뒤 이 값을 읽기만 하고 이 컬럼으로 거르는 조회가 없다.

## 구현 위치

- `codebase/backend/src/modules/integrations/entities/` (엔티티)
- `codebase/backend/migrations/V151__integration_reinstall_requested_at.sql` (재설치 대기 표시 컬럼)
- `codebase/backend/migrations/V154__integration_install_timeout_release_mall_id.sql` (이미 설치 기한을 넘겨 만료된 행의 `mall_id` 를 한 번 비운다)
- `codebase/backend/src/modules/integrations/cafe24-store-rows.ts` (같은 상점의 Cafe24 행 조회 `findAllCafe24RowsForMall` 과 상점 자리를 놓은 만료 행 판정 `hasReleasedStoreSlot`)
- `codebase/backend/src/modules/secret-store/**` (시크릿 저장소)

## Rationale

### 호출 API 식별을 세 컬럼으로 나눈다

활동 탭이 시간·상태·소요 시간·에러만 보여 주면 Cafe24 처럼 한 통합이 수십 endpoint 를 다루는 서비스에서 실패 행의 원인 API 를 알 수 없다. 그래서 `api_label`·`api_method`·`api_path` 세 컬럼을 둔다. 채우는 값이 통합마다 비대칭이라 한 컬럼으로는 같게 표현할 수 없었다. Cafe24·MakeShop 은 카탈로그 라벨이 있고 나머지는 endpoint 만 있다. 한 `api` 컬럼으로 합치면 Cafe24·MakeShop 의 라벨과 endpoint 두 줄 표시가 깨지고, 나중에 메서드·경로별 인덱스와 필터를 더할 여지도 사라진다. 비정규화 비용은 행당 최대 392바이트(128+8+256)로, 행 평균 200~500바이트인 에러 메시지·코드에 비하면 작다.

- **http-request 는 query string 을 뺀다.** 같은 endpoint 호출을 묶어 보려면 query 차이를 무시해야 한다. query 에는 `api_key`·`token` 같은 자격 증명이 섞이기 쉬운데 활동 로그는 평문으로 저장한다.
- **database-query 는 드라이버 이름만 남긴다.** SQL 본문은 길이가 가변이라 `varchar(256)` 을 자주 넘고, 파라미터를 인라인하면 개인정보가 그대로 드러나며, 파싱과 정규화 비용도 생긴다. 드라이버 이름만으로도 «어느 DB 였는지» 라는 진단 신호는 충분하다.
- **send-email 은 수신자를 저장하지 않는다.** 수신자 이메일은 개인정보다. SMTP host 만 남겨 «어느 메일 서버였는지» 만 보인다. 가린 수신자 정보는 노드 출력의 `output.error.details.to` 가 따로 준다.

카탈로그 라벨을 사람이 읽는 문구로 바꾸는 책임을 프런트엔드에 두는 이유는 [통합 관리](CLE-INT-MANAGE.md) 의 Rationale 에 있다.

### 활동 로그는 90일만 보존한다

상세 화면의 활동 탭은 최근 30~90일 데이터만 의미가 있다. 그보다 오래 쌓으면 행 수가 급격히 늘어 검색 성능이 떨어진다. 그래서 매일 배치로 정리한다.

### 설치 토큰은 16바이트 base64url 이다

32바이트 hex(64자)로는 Cafe24 개발자 센터의 App URL 입력 칸 100자 한도를 경로 prefix 단축만으로 맞출 수 없었다. 16바이트(128비트)는 capability 토큰으로 NIST·OWASP 권장치(96비트 이상)를 넉넉히 넘는다. 컬럼 `install_token` 은 `varchar(64)` 라 22자 토큰이 그대로 들어가므로 스키마를 바꾸지 않았다. 경로 단축 결정은 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md) 의 Rationale 에 있다.

### 상점 식별자를 평문 컬럼으로 복제하고 인덱스를 하나로 합쳤다

`mall_id` 가 암호화 JSONB 안에만 있으면 SQL 로 거를 수 없어 중복 검사가 복호화 후 메모리 비교가 되고, 조회와 INSERT 사이의 경쟁도 막을 수 없다. 평문 컬럼(V045)과 부분 UNIQUE 인덱스를 두면 DB 가 중복을 거부한다. 처음에는 서비스별 인덱스(V046 cafe24, V071 makeshop)였으나 서비스 유형을 키에 넣은 인덱스 하나(V072)로 합쳤다. 새 서비스를 더할 때 인덱스와 마이그레이션이 필요 없다. 옛 행의 NULL 은 부분 인덱스 비교에서 빠지므로 새 행과 충돌하지 않고, 다음 저장 때 채워진다. 설치 기한이 지나 만료된 행이 `mall_id` 를 비워 상점 자리를 놓는 것도 이 성질을 쓴다([OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md#만료된-설치-대기-행은-상점-자리를-놓는다-2026-10-29)).

### 재설치 대기 표시를 상태와 따로 둔 시각 컬럼으로 둔다 (2026-10-10)

Cafe24 Private 의 통합 재인증과 추가 권한 요청을 «테스트 실행» 으로 마치게 하면서 «이 행은 App URL 이 OAuth 로 보내야 한다» 는 사실을 저장할 자리가 필요했다. `status`·`status_reason` 과 따로 둔 nullable 시각 컬럼 `reinstall_requested_at`(V151)을 택했다. 시각이라 화면이 요청 시각을 보이고 서버가 24시간 유효 기간을 판정할 수 있다. 상태 컬럼을 쓰지 않으므로 만료 스캐너, 주의 필요 술어, 노드 실행 가드가 바뀌지 않는다. 지난 값은 지우지 않고 판정할 때 시각을 비교하므로 정리 작업도 없다. 설치 대기 재사용, 연결됨의 새 상태 사유, 새 상태 값을 기각한 이유와 24시간 유효 기간을 둔 이유는 [통합 상태와 만료 알림](CLE-INT-STATUS.md) 의 Rationale «재설치 대기 표시는 상태와 따로 둔 컬럼이다» 에 있다.

### `api_*` 채우기 표를 정본으로 확인하고 외부 MCP 행을 더했다 (2026-11-13)

`api_*` 채우기 표의 정본을 이 문서 한 곳으로 정했다([Database Query 노드](../CLE-NODE-INT/CLE-NODE-DBQUERY.md) 의 실행 로직도 이 표를 가리킨다). 코드와 대조하니 외부 MCP 서버의 도구 호출(`McpToolProvider`)만 `api` 를 넘기지 않아서 지금 동작대로 `mcp` 행과 적용 범위 3 을 더했다.

- 고치지 않은 것: 외부 MCP 도구 호출의 `api_*` 를 채우는 일은 코드 변경이라 NERV Task `CLE-T-22PSME` 가 맡는다.
