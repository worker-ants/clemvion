---
id: "CLE-NODE-CAFE24"
title: "Cafe24 노드"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-CAFENODE-001", "REQ-CAFENODE-002", "REQ-CAFENODE-003", "REQ-CAFENODE-004", "REQ-CAFENODE-005", "REQ-CAFENODE-006", "REQ-CAFENODE-007", "REQ-CAFENODE-008", "REQ-CAFENODE-009", "REQ-CAFENODE-010", "REQ-CAFENODE-011", "REQ-CAFENODE-012", "REQ-CAFENODE-013", "REQ-CAFENODE-014", "REQ-CAFENODE-015", "REQ-CAFENODE-016", "REQ-CAFENODE-017", "REQ-CAFENODE-018", "REQ-CAFENODE-019", "REQ-CAFENODE-020", "REQ-CAFENODE-021", "REQ-CAFENODE-022", "REQ-CAFENODE-023", "REQ-CAFENODE-024", "REQ-CAFENODE-025", "REQ-CAFENODE-026", "REQ-CAFENODE-027", "REQ-CAFENODE-028", "REQ-CAFENODE-029", "REQ-CAFENODE-030", "REQ-CAFENODE-031", "REQ-CAFENODE-032", "REQ-CAFENODE-033", "REQ-CAFENODE-034", "REQ-CAFENODE-035", "REQ-CAFENODE-036", "REQ-CAFENODE-037", "REQ-CAFENODE-038", "REQ-CAFENODE-039", "REQ-CAFENODE-040", "REQ-CAFENODE-041", "REQ-CAFENODE-042", "REQ-CAFENODE-043", "REQ-CAFENODE-044", "REQ-CAFENODE-045", "REQ-CAFENODE-046", "REQ-CAFENODE-047", "REQ-CAFENODE-048", "REQ-CAFENODE-049"]
basis_superseded: false
parent: "CLE-NODE-INT"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT"]
area: "CLE-NODE-INT"
content_hash: "8fb545e7e2921c065e6b6ee925cde2a0ebf5a81055195154b2e1f27a3fb228ee"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/4-integration/4-cafe24.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "111d9ffca8ed50b46603c6c1f36473bf20cfcde988e5a7a0cabb2790ee6a4b8a"
etag: "sha256-d88d4b46ba5c96770d17c11a419f00bd6fb07537b035a70d93fd006c7b8c3628"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/4-integration/4-cafe24.md`, `spec/4-nodes/_product-overview.md` (§7.4) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Cafe24 노드(`cafe24`)는 한국 이커머스 SaaS [Cafe24](https://developers.cafe24.com/docs/ko/api/admin/) 의 Admin API 를 부르는 서비스 특화 통합 노드다. 같은 통합을 AI 에이전트에 도구로 붙이면 LLM 도 같은 API 를 부를 수 있다.

- **사용자 가치**: 쇼핑몰 운영자가 상품·주문·회원·프로모션 등 Admin API operation 을 워크플로우 노드 하나로 부른다. 같은 통합을 AI 에이전트에 도구로 주면 LLM 이 "어제 미발송 주문 가져와줘" 같은 자연어 요청을 처리한다.
- **지원 범위**: Cafe24 Admin API 의 Cafe24 리소스(`Cafe24Resource`) 18개 전부다. operation 목록과 구현 상태, 전체 수는 [Cafe24 API 카탈로그](CLE-C24-CATALOG)가 정한다. operation 수가 많아서 AI 에이전트에 내부 MCP 브리지로 노출할 때는 노출 도구 목록(`enabledTools`)으로 좁히는 것이 사실상 필수다([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 도구 정의 예산).
- **이중 활용**: Cafe24 는 "통합 하나가 워크플로우 캔버스 노드와 AI 에이전트 MCP 도구에 동시에 노출되는" 첫 사례다. 백엔드의 `Cafe24McpToolProvider`(AI 에이전트 핸들러의 도구 프로바이더 `AgentToolProvider` 구현체)가 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md)의 내부 MCP 브리지 패턴으로 이 노드와 같은 메타데이터 테이블에서 도구 목록을 만든다.

통합 노드 공통 규약은 [통합 노드 공통](CLE-NODE-INT-COMMON.md)이 정한다. 다음은 다른 문서가 정하므로 여기서는 링크만 둔다.

- operation 메타데이터 형식, Cafe24 요청 봉투, KST 시간대 규약, 카탈로그 키, MCP 도구 설명 조립: [Cafe24 operation 메타데이터](CLE-C24-META)
- operation 목록(리소스별 표·필드 상세): [Cafe24 API 카탈로그](CLE-C24-CATALOG)와 리소스별 문서(아래 "설정" 표)
- 별도 승인이 필요한 권한 범위·operation 명단과 안내 문구: [Cafe24 별도 승인 scope](CLE-C24-SCOPES)
- OAuth 연결, Public·Private 앱 설치의 사용자 흐름, 토큰 자동 갱신 정책: [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md). 갱신 진입점과 큐 dedup: [OAuth 연결과 토큰 갱신 §갱신 큐](../CLE-INT/CLE-INT-OAUTH.md#갱신-큐). 설치 엔드포인트의 HMAC 알고리즘·Redis 키·상수는 이 문서가 정한다(아래 "Private 앱 설치 엔드포인트")
- 노드 실행 결과로 통합 상태가 바뀌는 조건·사유 값·복구: [통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md)
- MCP 도구 이름 규칙과 노출 도구 목록: [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md)

## 요구사항

- REQ-CAFENODE-001 WHEN 노드가 실행되면 THE SYSTEM SHALL 선택한 Cafe24 리소스·operation 의 메타데이터로 Cafe24 Admin API 를 부른다. (원본: ND-CF-01)
- REQ-CAFENODE-002 WHEN 노드가 실행되면 THE SYSTEM SHALL `service_type='cafe24'` 통합의 OAuth 자격 증명을 쓴다. (원본: ND-CF-02)
- REQ-CAFENODE-003 WHEN 사용자가 operation 을 고르면 THE SYSTEM SHALL 메타데이터의 입력 필드로 필수·선택 두 묶음의 동적 폼을 렌더하고 모든 칸에서 표현식을 허용한다. (원본: ND-CF-03)
- REQ-CAFENODE-004 WHEN operation 메타데이터가 `paginated: true` 면 THE SYSTEM SHALL 페이지네이션 입력(`limit`·`offset`)을 보여 준다. (원본: ND-CF-03)
- REQ-CAFENODE-005 WHEN 같은 통합이 AI 에이전트 `mcpServers` 에 연결되면 THE SYSTEM SHALL 내부 MCP 브리지(`Cafe24McpToolProvider`)로 같은 메타데이터에서 도구를 만들어 노출한다. (원본: ND-CF-04)
- REQ-CAFENODE-006 WHEN 사용자가 operation 을 바꾸면 THE SYSTEM SHALL 새 operation 의 필드 이름과 겹치는 `fields` 값만 남기고 나머지를 버린다.
- REQ-CAFENODE-007 WHEN 사용자가 리소스를 바꾸면 THE SYSTEM SHALL `fields` 를 모두 초기화한다.
- REQ-CAFENODE-008 WHEN operation 드롭다운을 보이면 THE SYSTEM SHALL 카탈로그의 planned operation 을 비활성과 "(지원 예정)" 접미사로 함께 보인다.
- REQ-CAFENODE-009 WHEN operation 에 별도 승인 메타데이터(`restrictedApproval`)가 있으면 THE SYSTEM SHALL 라벨 오른쪽에 ⚠ 아이콘과 "별도 승인 필요" 문구를 보인다.
- REQ-CAFENODE-010 WHEN 사용자가 supported 가 아닌 operation 을 고르면 THE SYSTEM SHALL `fields`·`pagination` 입력을 렌더하지 않는다.
- REQ-CAFENODE-011 IF operation 이 메타데이터에 없으면 THE SYSTEM SHALL `CAFE24_UNKNOWN_OPERATION` 으로 에러 포트에 보낸다.
- REQ-CAFENODE-012 IF 필수 필드가 없거나 조건부 필수 제약을 어기면 THE SYSTEM SHALL `CAFE24_MISSING_FIELDS` 로 에러 포트에 보내고 어긋난 필드나 제약 종류를 `details` 에 적는다.
- REQ-CAFENODE-013 IF 자격 증명에 `mall_id`·`app_type`·`access_token`·`refresh_token` 이 없으면 THE SYSTEM SHALL `INTEGRATION_INCOMPLETE` 로 에러 포트에 보낸다.
- REQ-CAFENODE-014 IF `app_type='private'` 인데 `client_id`·`client_secret` 이 없으면 THE SYSTEM SHALL `INTEGRATION_INCOMPLETE` 로 에러 포트에 보낸다.
- REQ-CAFENODE-015 IF `mall_id` 가 형식(소문자 영숫자·하이픈, 3~50자)을 어기면 THE SYSTEM SHALL `CAFE24_INVALID_MALL_ID` 로 에러 포트에 보낸다.
- REQ-CAFENODE-016 WHEN 액세스 토큰이 만료됐거나 60초 안에 만료되면 THE SYSTEM SHALL 호출 전에 토큰을 자동 갱신한다.
- REQ-CAFENODE-017 WHEN 요청 URL 을 만들면 THE SYSTEM SHALL `https://{mall_id}.cafe24api.com/api/v2/admin/{path}` 형식으로 만들고 path 파라미터를 `fields` 에서 채운다.
- REQ-CAFENODE-018 WHEN 요청을 만들면 THE SYSTEM SHALL 필드를 메타데이터의 `location`(path·query·body)대로 나누고 `pagination` 은 언제나 query 로 보낸다.
- REQ-CAFENODE-019 WHEN POST·PUT 요청을 보내면 THE SYSTEM SHALL API 클라이언트가 본문을 Cafe24 요청 봉투로 감싼다.
- REQ-CAFENODE-020 IF 호출자가 이미 `request` 로 감싼 본문을 넘기면 THE SYSTEM SHALL 이중 감싸기를 막기 위해 즉시 throw 한다.
- REQ-CAFENODE-021 WHEN 429 응답을 받으면 THE SYSTEM SHALL `max(X-Cafe24-Call-Remain, X-Cafe24-Time-Remain)` 초만큼 기다린 뒤 최대 2회 재시도한다.
- REQ-CAFENODE-022 IF 세 번째 429 를 받으면 THE SYSTEM SHALL `CAFE24_RATE_LIMITED` 로 에러 포트에 보낸다.
- REQ-CAFENODE-023 WHILE 같은 프로세스 인스턴스에서 한 통합의 호출이 429 로 기다리는 동안 THE SYSTEM SHALL 그 통합의 다른 호출(노드와 MCP 도구)도 기다리게 한다.
- REQ-CAFENODE-024 WHEN 401 응답을 받으면 THE SYSTEM SHALL 리프레시 토큰으로 액세스 토큰을 한 번 갱신하고 같은 요청을 한 번 재시도한다.
- REQ-CAFENODE-025 IF 재시도 응답도 401 이면 THE SYSTEM SHALL `CAFE24_AUTH_FAILED` 로 에러 포트에 보내고 통합 상태를 격하한다.
- REQ-CAFENODE-026 WHEN 403 응답을 받으면 THE SYSTEM SHALL 토큰 갱신 없이 즉시 통합 상태를 격하하고 에러 포트에 보낸다.
- REQ-CAFENODE-027 WHEN 응답을 받으면 THE SYSTEM SHALL 본문을 `output.response` 에 그대로 두고 호출 제한 헤더 값을 `meta` 에 담는다.
- REQ-CAFENODE-028 WHEN 응답이 4xx·5xx 면 THE SYSTEM SHALL 상태별 코드(`CAFE24_404`·`CAFE24_422`·`CAFE24_4XX`·`CAFE24_5XX`)로 에러 포트에 보낸다.
- REQ-CAFENODE-029 IF 요청이 reject 되면 THE SYSTEM SHALL `CAFE24_TRANSPORT_FAILED` 와 `meta.statusCode = 0` 으로 에러 포트에 보낸다.
- REQ-CAFENODE-030 WHEN 설정을 에코하면 THE SYSTEM SHALL `integrationId`·`resource`·`operation`·`fields`·`pagination` 을 명시적으로 열거하고 자격 증명은 싣지 않는다.
- REQ-CAFENODE-031 WHEN 호출이 끝나면 THE SYSTEM SHALL 성공·실패와 관계없이 활동 로그를 1건 남긴다.
- REQ-CAFENODE-032 WHEN 활동 로그를 남기면 THE SYSTEM SHALL `api_label` 을 `cafe24.<resource>.<operation>`, `api_method` 를 operation method, `api_path` 를 치환 전 path 템플릿으로 채운다.
- REQ-CAFENODE-033 WHEN dry-run 으로 실행되고 operation method 가 GET 이 아니면 THE SYSTEM SHALL 실제 호출 없이 mock 결과로 `success` 포트에 보낸다.
- REQ-CAFENODE-034 WHEN dry-run 으로 실행되고 operation method 가 GET 이면 THE SYSTEM SHALL 실제로 호출한다.
- REQ-CAFENODE-035 WHEN dry-run 으로 mock 결과를 돌려주면 THE SYSTEM SHALL 활동 로그를 1건 남긴다.
- REQ-CAFENODE-036 WHEN 내부 MCP 브리지가 도구를 만들면 THE SYSTEM SHALL 모든 도구 설명 끝에 KST 시간대 안내 한 줄을 붙인다.
- REQ-CAFENODE-037 WHEN 내부 MCP 브리지가 capability 를 보고하면 THE SYSTEM SHALL `tools` 만 보고하고 `resources`·`prompts` 는 보고하지 않는다.
- REQ-CAFENODE-038 WHEN AI 에이전트의 노출 도구 목록을 저장하면 THE SYSTEM SHALL bare operation id 배열로 저장한다.
- REQ-CAFENODE-039 WHEN AI 에이전트가 내부 MCP 브리지로 Cafe24 를 부르면 THE SYSTEM SHALL 호출 시점의 AI 에이전트 노드 실행으로 활동 로그를 남긴다.
- REQ-CAFENODE-040 WHEN AI 에이전트가 도구 목록을 만들 때 통합 상태가 `error` 면 THE SYSTEM SHALL 그 통합의 도구를 빼고 진단에 `skipReason='error'` 를 남긴다.
- REQ-CAFENODE-041 WHEN AI 에이전트가 도구 목록을 만들 때 통합이 `expired` 이고 사유가 `install_timeout` 이면 THE SYSTEM SHALL 도구를 빼고 `skipReason='expired_install_timeout'` 을 남긴다.
- REQ-CAFENODE-042 WHEN AI 에이전트가 도구 목록을 만들 때 통합이 `expired` 이고 리프레시 토큰이 없으면 THE SYSTEM SHALL 도구를 빼고 `skipReason='expired_no_refresh_token'` 을 남긴다.
- REQ-CAFENODE-043 WHEN Private 앱 설치 요청(App URL)이 오면 THE SYSTEM SHALL `install_token` 으로 통합 한 행을 찾아 그 행의 `client_secret` 으로 HMAC 을 한 번 검증한다.
- REQ-CAFENODE-044 IF 설치 요청의 `timestamp` 가 ±5분 밖이면 THE SYSTEM SHALL `CAFE24_INSTALL_REPLAY` 로 거절한다.
- REQ-CAFENODE-045 IF 검증을 통과한 같은 (mall_id, timestamp, hmac) 튜플이 10분 안에 다시 오면 THE SYSTEM SHALL `CAFE24_INSTALL_REPLAY` 로 거절한다.
- REQ-CAFENODE-046 IF 설치 요청의 HMAC 이 맞지 않으면 THE SYSTEM SHALL `403 CAFE24_INSTALL_INVALID_HMAC` 로 거절하고 에러 상세를 보이지 않는다.
- REQ-CAFENODE-047 IF 같은 IP 의 `install_token` 조회·HMAC 검증 실패가 `INSTALL_FAIL_THRESHOLD` 를 넘으면 THE SYSTEM SHALL 검증 전에 `429 CAFE24_INSTALL_RATE_LIMITED` 로 거절한다.
- REQ-CAFENODE-048 IF Redis 를 쓸 수 없으면 THE SYSTEM SHALL 설치 nonce 검사와 실패 카운터를 건너뛴다.
- REQ-CAFENODE-049 WHEN Cafe24 에 OAuth 권한 범위를 요청하면 THE SYSTEM SHALL 공백이 아닌 콤마로 구분해 보낸다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `integrationId` | UUID | ✓ | — | `service_type='cafe24'` 통합 ID([통합 노드 공통](CLE-NODE-INT-COMMON.md) 통합 참조) |
| `resource` | Enum | ✓ | — | Cafe24 리소스. 아래 표의 18개 값 중 하나 |
| `operation` | String | ✓ | — | 선택한 리소스의 operation id. 메타데이터 테이블([Cafe24 operation 메타데이터](CLE-C24-META))에 있는 값 중 하나(예: `product_list`, `product_get`, `order_list`, `order_update_status`) |
| `fields` | Record<string, unknown> | — | `{}` | 선택한 operation 의 입력 필드. 표현식 가능. operation 별 필수·선택 필드는 메타데이터가 정한다 |
| `pagination` | object? | — | — | `{ limit?: number, offset?: number }`. operation 이 페이지네이션을 지원할 때만 쓴다. `fields` 와 분리해 표준화했다. `cursor` 는 Cafe24 Admin API 가 일관되게 지원하지 않아 쓰지 않는다(B-3-7) |

표현식(`{{ }}`)은 `fields[*]` 와 `pagination.*` 의 모든 값에서 쓸 수 있다. 설정 스키마의 단일 기준은 `codebase/backend/src/nodes/integration/cafe24/cafe24.schema.ts` 의 `cafe24NodeConfigSchema`·`cafe24NodeMetadata` 다.

리소스 값과 operation 목록 문서:

| `resource` | 뜻 | operation 목록 |
|------------|----|----------------|
| `store` | 상점 | [Store](CLE-C24-STORE) |
| `product` | 상품 | [Product](CLE-C24-PRODUCT) |
| `order` | 주문 | [Order](CLE-C24-ORDER) |
| `customer` | 회원 | [Customer](CLE-C24-CUSTOMER) |
| `community` | 게시판 | [Community](CLE-C24-COMMUNITY) |
| `design` | 디자인 | [Design](CLE-C24-DESIGN) |
| `promotion` | 프로모션 | [Promotion](CLE-C24-PROMOTION) |
| `application` | 앱 관리. OAuth 앱 등록과 무관한 Cafe24 앱 관리 API 다 | [Application](CLE-C24-APPLICATION) |
| `category` | 상품분류 | [Category](CLE-C24-CATEGORY) |
| `collection` | 판매분류 | [Collection](CLE-C24-COLLECTION) |
| `supply` | 공급사 | [Supply](CLE-C24-SUPPLY) |
| `shipping` | 배송 | [Shipping](CLE-C24-SHIPPING) |
| `salesreport` | 매출통계 | [Salesreport](CLE-C24-SALESREPORT) |
| `personal` | 개인화 | [Personal](CLE-C24-PERSONAL) |
| `privacy` | 개인정보 | [Privacy](CLE-C24-PRIVACY) |
| `mileage` | 적립금 | [Mileage](CLE-C24-MILEAGE) |
| `notification` | 알림 | [Notification](CLE-C24-NOTIFICATION) |
| `translation` | 번역 | [Translation](CLE-C24-TRANSLATION) |

## 설정 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|---------------|------|
| 통합 | 맨 위 | 통합 선택기(`serviceTypes=['cafe24']`) | Cafe24 통합만 보여 준다 |
| 리소스 | 통합 아래 | Resource 드롭다운 | 18개 리소스를 라벨과 함께 보인다(예: `product` → "Product (상품)") |
| operation | 리소스 아래 | Operation 드롭다운 | 리소스를 바꾸면 목록이 바뀐다. 리소스 옆에 "지원 N개 · 추후 지원 M개" 안내를 보인다 |
| 필수 필드 | operation 아래 | Required 묶음 | 메타데이터가 정한 필수 필드 행 |
| 선택 필드 | 필수 필드 아래 | Optional 묶음 | 메타데이터가 정한 선택 필드 행 |
| 페이지네이션 | 맨 아래 | Limit·Offset 입력 | `paginated: true` 인 operation 에만 보인다 |

- operation 라벨: 백엔드는 카탈로그 키(`labelKey`, `cafe24.<resource>.<operation>`)만 내려 주고 프론트엔드 i18n 사전이 사람이 읽는 라벨로 바꾼다. 사전에 키가 없으면 키 자체를 보인다. 규칙은 [Cafe24 operation 메타데이터](CLE-C24-META) 카탈로그 키 절이 정한다.
- 필드 입력: operation 을 고르면 메타데이터의 입력 스키마(JSON Schema 호환 형식)로 동적 폼을 렌더하고 필수와 선택 두 묶음으로 나눈다. 모든 칸은 `ExpressionInput` 을 바탕으로 해서 표현식을 받는다. `enum`·`boolean`·`default` 정보는 힌트 문구로 보인다. 키는 메타데이터로 고정되므로 사용자가 임의 키를 더하는 경로는 없다(Rationale "필드 편집 UI").
- 호환 키 보존: operation 을 바꾸면 새 operation 의 `fields[].name` 과 겹치는 키만 남기고 나머지는 버린다. 예를 들어 `product_get`(`shop_no` 만)에서 `product_list`(`shop_no`·`display` 등)로 바꾸면 `shop_no` 값이 남는다. 리소스를 바꾸면 `fields` 를 모두 초기화한다.
- 지원 예정 operation: 카탈로그의 `status: planned` 행도 드롭다운에 보이지만 비활성이며 "(지원 예정)" 접미사를 붙인다. supported 가 아닌 operation(planned·unknown)을 고르면 `fields`·`pagination` 입력을 렌더하지 않는다.
- 별도 승인 라벨: 메타데이터 행에 `restrictedApproval` 이 있는 operation 은 라벨 오른쪽에 ⚠ 아이콘과 "별도 승인 필요" 보조 문구를 보인다. 리소스 전체가 별도 승인 대상(`restrictedApproval.level='scope'`)이면 그 리소스의 모든 operation 에 붙는다. `level='operation'` 이면 해당 행에만 붙는다. 명단, 툴팁 본문, 문의 링크는 [Cafe24 별도 승인 scope](CLE-C24-SCOPES)가 정한다. `approvalGroup`(문구 묶음 식별자)별 문구는 프론트엔드 i18n 사전이 관리한다.

## 포트

| 방향 | id | label | type | dynamic | 설명 |
|------|----|-------|------|---------|------|
| 입력 | `in` | Input | data | false | 입력 데이터(`$input` 으로 참조) |
| 출력 | `success` | Success | data | false | Cafe24 API 2xx 응답 |
| 출력 | `error` | Error | error | false | Cafe24 API 3xx·4xx·5xx, 전송 실패, 429 재시도 소진, 메타데이터 검증 실패 |

`status` 는 비블로킹 노드이므로 항상 생략한다.

## 실행 로직

[통합 노드 공통](CLE-NODE-INT-COMMON.md)의 6단계 계약을 따른다. 노드 고유 흐름은 다음과 같다.

1. **설정 정규화**: `resource`·`operation` 으로 메타데이터를 찾아 `{ method, path, requiredFields, optionalFields, paginated, responseShape }` 를 얻는다. 없으면 `CAFE24_UNKNOWN_OPERATION` 으로 에러 포트에 보낸다(D4).
2. **설정 에코 만들기**: `integrationId`·`resource`·`operation`·`fields`·`pagination` 을 원본 설정에서 하나씩 명시적으로 읽어 에코한다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 7 D1). `fields`·`pagination` 의 `{{ }}` 표현식은 그대로 남는다. 자격 증명은 싣지 않는다.
3. **통합 자격 증명 해소**: `getForExecution(integrationId, workspaceId)` 로 통합을 읽고 `serviceType='cafe24'`·`status='connected'` 를 확인한다. 실패하면 `INTEGRATION_TYPE_MISMATCH`·`INTEGRATION_NOT_CONNECTED` 로 에러 포트에 보낸다(D4). 통합이 없거나 다른 워크스페이스 소속이면 공통 규칙대로 `INTEGRATION_CALL_FAILED` 가 된다.
4. **자격 증명 충족 검증**: `mall_id`·`app_type`·`access_token`·`refresh_token` 이 없으면 `INTEGRATION_INCOMPLETE` 다. `app_type='private'` 인데 `client_id`·`client_secret` 이 없어도 같다(D4).
5. **필수 필드·조건부 필수 제약 검증**: 메타데이터의 `requiredFields`(모두 필수)가 `config.fields` 에 다 있는지, 조건부 필수 제약(`constraints`)을 만족하는지 확인한다. 제약 종류와 의미는 [Cafe24 operation 메타데이터](CLE-C24-META)가 정한다. 어기면 `CAFE24_MISSING_FIELDS` 로 에러 포트에 보내고, `details` 에 어느 필드나 어느 제약 종류가 어긋났는지 적는다(D4).
6. **토큰 만료 확인과 갱신**: `Integration.token_expires_at` 이 지났거나 60초 안에 만료되면 호출 전에 자동 갱신한다. 갱신 실패의 상태 전이(리프레시 토큰 `invalid_grant` 면 `error(auth_failed)`, 전송 3회 연속 실패면 `error(network)`)와 갱신 요청의 여러 인스턴스 사이 직렬화는 [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md)과 [통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md)에서 정한다. 갱신에 실패해 연결이 끊긴 통합은 `INTEGRATION_NOT_CONNECTED` 로 끝난다.
7. **URL 만들기**: `https://{credentials.mall_id}.cafe24api.com/api/v2/admin/{operation.path}`. `{path}` 는 메타데이터의 path 템플릿(예: `products/{product_no}`)이고 path 파라미터는 `fields` 에서 채운다.
8. **query·본문 만들기**: 메타데이터의 `fields[*].location`(path·query·body)에 따라 나눈다. `pagination.{limit, offset}` 은 언제나 query 다. 본문을 Cafe24 요청 봉투로 감싸는 일은 9단계의 API 클라이언트가 혼자 맡는다.
9. **호출**: `Cafe24ApiClient` 가 다음을 한다.
   - `Authorization: Bearer {access_token}` 헤더를 붙인다.
   - POST·PUT 본문을 Cafe24 요청 봉투(`{ shop_no?, request: { ...payload } }`)로 감싼다. 직렬화 규칙은 [Cafe24 operation 메타데이터](CLE-C24-META) wire format 절이 단일 기준이다. DELETE·GET 에는 감싸지 않는다. 호출자가 이미 `{request: ...}` 로 감싼 본문을 넘기면 즉시 throw 해 이중 감싸기를 막는다(개발 단계 가드).
   - 응답 헤더 `X-Cafe24-Call-Remain` 을 지켜보고 429 를 받으면 기다렸다 재시도한다(아래 "호출 제한").
   - 401 을 받으면 리프레시 토큰으로 액세스 토큰을 한 번 갱신하고 같은 요청을 한 번 재시도한다. 6단계의 사전 갱신이 경쟁 구간에서 빗나간 경우를 이렇게 되살린다. 재시도가 2xx 면 정상 흐름으로 가고, 재시도도 401 이면 인증 실패로 격하한다(아래 "인증 실패 처리"). 403 은 이 갱신 대상이 아니며 즉시 격하한다.
   - 현재 구현은 상위 취소 신호(`context.abortSignal`)를 API 클라이언트에 넘긴다. 그 때문에 생긴 `AbortError` 는 에러 포트로 바꾸지 않고 다시 던져 노드 실행이 `cancelled` 로 분류되게 한다([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md)).
10. **응답 파싱**: JSON 본문을 그대로 `output.response` 에 둔다. `meta.statusCode`, `meta.durationMs`, `meta.callUsage`(헤더 `X-Cafe24-Call-Usage`), `meta.callRemain`(헤더 `X-Cafe24-Call-Remain`)을 채운다.
11. **활동 로그 기록**: 성공·실패와 관계없이 1건 남긴다. `error.code` 는 아래 에러 코드 표의 값이다. API 식별 정보는 다음과 같다(통합별 전체 표는 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) INT-US-05).
    - `api_label` = 카탈로그 키 `cafe24.<resource>.<operation>`(예: `cafe24.product.product_list`). 프론트엔드가 `GET /api/integrations/services/cafe24/catalog` 응답의 `labelKey` 와 i18n 사전으로 사람이 읽는 라벨을 만든다. DB 에는 언어 정보가 없는 카탈로그 키만 저장한다.
    - `api_method` = 메타데이터 행의 `method`(`GET`·`POST`·`PUT`·`DELETE`).
    - `api_path` = 메타데이터 행의 `path` 템플릿. placeholder 를 그대로 둔다(예: `products/{product_no}`). 실제 호출 URL 의 치환값을 넣지 않는다. 엔드포인트 단위로 묶고 path 안 ID 에 담긴 개인정보가 새지 않게 하기 위해서다.
12. **반환**:
    - 2xx 면 성공 케이스(`port: 'success'`).
    - 3xx·4xx·5xx 면 에러 케이스(`CAFE24_404`·`CAFE24_422`·`CAFE24_AUTH_FAILED`·`CAFE24_RATE_LIMITED`·`CAFE24_4XX`·`CAFE24_5XX`).
    - 전송 실패면 `CAFE24_TRANSPORT_FAILED`, `meta.statusCode = 0`.

### dry-run

노드 스키마가 `supportsDryRun: true` 인 부수효과 노드다([재실행](../CLE-EXEC/CLE-EXEC-RERUN.md)). dry-run 에서 operation `method` 가 GET 이 아닌 호출(쓰기: POST·PUT·DELETE)은 외부 쇼핑몰 상태를 바꾸지 않도록 `Cafe24ApiClient` 를 부르지 않고 1단계 직후 mock 응답으로 끝낸다(`buildDryRunMock('cafe24', ...)`, `meta.statusCode=0`, `port:'success'`). GET operation 은 부수효과가 없어 dry-run 에서도 그대로 부른다. mock 으로 끝낸 경우에도 활동 로그를 1건 남긴다.

### 호출 제한

| 헤더 | 뜻 | 동작 |
|------|----|------|
| `X-Api-Call-Limit` | `현재/상한` (예: `1/40`) | 진단 메트릭으로만 보존(`meta.callLimit`) |
| `X-Cafe24-Call-Usage` | 호출 사용률(%) | `meta.callUsage` |
| `X-Cafe24-Call-Remain` | 재개까지 남은 시간(초) | 429 때 대기 시간 |
| `X-Cafe24-Time-Usage` | 처리 시간 사용률(%) | `meta.timeUsage`(있을 때) |
| `X-Cafe24-Time-Remain` | 처리 시간 재개까지 남은 시간(초) | 429 때 대기 시간 보정 |

- 429 를 받으면 `max(X-Cafe24-Call-Remain, X-Cafe24-Time-Remain)` 초만큼 기다린다. 최대 2회 재시도하고, 세 번째 429 면 `CAFE24_RATE_LIMITED` 로 에러 포트에 보낸다.
- 노드와 MCP 도구 호출은 같은 통합 자격 증명을 쓰므로 같은 leaky bucket 을 공유한다. API 클라이언트의 대기는 같은 프로세스 인스턴스 안에서 통합 ID 별 메모리 mutex 로 보호된다. 한 호출이 기다리는 동안 같은 통합의 다른 호출도 자동으로 기다린다(과부하 방지).
- 여러 인스턴스로 배포하면 인스턴스 사이 직렬화는 자동으로 보장되지 않는다. Cafe24 leaky bucket 은 통합 단위 quota 라 인스턴스 사이 동시 호출에서도 429 응답이 자체 backoff 신호가 된다. 필요하면 Redis 기반 조율을 별도 스펙으로 도입할 수 있다(Rationale "호출 제한 범위").
- 격리 단위는 통합이다. `mall_id` 가 다른 통합끼리는 대기를 공유하지 않는다.

### 시간대

Cafe24 Admin API 의 날짜·시간 필드는 모두 KST(Asia/Seoul, UTC+9) 기준이다. 규칙의 단일 기준은 [Cafe24 operation 메타데이터](CLE-C24-META) 시간대 절이다.

- 워크플로우 캔버스 노드는 사용자 표현식 `{{ $now }}`(UTC ISO 8601)를 그대로 보내도 뜻이 같다. Cafe24 가 시간대 표기를 존중하기 때문이다.
- AI 에이전트에 내부 MCP 브리지로 노출할 때는 모든 도구 설명 끝에 KST 안내가 자동으로 붙는다(아래 "AI 에이전트 노출").
- 토큰 만료 시각(`expires_at`)은 이 규칙 밖이다. JWT `exp`(UTC 절대 시각)가 기준이며 [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md)에서 정한다.

## 출력 구조

노드 출력은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 11 형식을 따른다. JSON 예시는 `undefined` 필드를 생략하고, 다섯 필드 밖의 최상위 키는 두지 않는다. `output.response` 는 Principle 8.2 의 HTTP 관용 명명을 다시 쓴다. `status` 는 비블로킹 노드이므로 항상 생략한다.

### 2xx 성공 (`success`)

```json
{
  "config": {
    "integrationId": "int_cafe24_myshop",
    "resource": "product",
    "operation": "product_list",
    "fields": {
      "shop_no": 1,
      "display": "T",
      "created_start_date": "{{ $now }}"
    },
    "pagination": { "limit": 50, "offset": 0 }
  },
  "output": {
    "response": {
      "products": [
        { "product_no": 1001, "product_name": "샘플 상품", "price": "10000.00" }
      ],
      "links": [{ "rel": "next", "href": "/api/v2/admin/products?offset=50&limit=50" }]
    }
  },
  "meta": {
    "statusCode": 200,
    "durationMs": 320,
    "callUsage": 12,
    "callRemain": 0,
    "callLimit": "5/40"
  },
  "port": "success"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.integrationId` | UUID | 설정 에코 | 사용자 입력 원본 |
| `config.resource` | Enum | 설정 에코 | Cafe24 리소스 18개 중 하나 |
| `config.operation` | string | 설정 에코 | operation id |
| `config.fields` | object | 설정 에코 | 사용자 입력 원본(`{{ }}` 보존). `{}` 여도 명시적으로 에코한다(누락과 `undefined` 는 다르다) |
| `config.pagination?` | object | 설정 에코 | 페이지네이션 operation 일 때 |
| `output.response` | unknown | Cafe24 응답 본문 | 그대로 보존. 구조는 operation 마다 다르다 |
| `meta.statusCode` | number | 핸들러 반환 | HTTP 응답 상태(2xx) |
| `meta.durationMs` | number | 핸들러 반환 | 요청 시작부터 응답까지 ms |
| `meta.callUsage?` | number | 런타임 | `X-Cafe24-Call-Usage` 헤더(%) |
| `meta.callRemain?` | number | 런타임 | `X-Cafe24-Call-Remain` 헤더(초) |
| `meta.callLimit?` | string | 런타임 | `X-Api-Call-Limit` 헤더(`현재/상한`) |
| `port` | `'success'` | 핸들러 반환 | 2xx 분기 |

표현식 접근 예:

- `$node["X"].output.response.products[0].product_no` → `1001`
- `$node["X"].meta.statusCode` → `200`
- `$node["X"].config.resource` → `"product"`

### API 에러 또는 전송 실패 (`error`)

[노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 3.2 의 `output.error.{code, message, details?}` 를 쓴다. 4xx·5xx 면 서버 응답 본문을 디버깅을 위해 `output.response` 에 둔다.

Cafe24 API 4xx·5xx 응답:

```json
{
  "config": {
    "integrationId": "...",
    "resource": "product",
    "operation": "product_get",
    "fields": { "product_no": 9999 }
  },
  "output": {
    "response": {
      "error": { "code": "404", "message": "Not Found", "more_info": "..." }
    },
    "error": {
      "code": "CAFE24_404",
      "message": "Cafe24 API returned 404",
      "details": {
        "statusCode": 404,
        "mallId": "myshop",
        "resource": "product",
        "operation": "product_get",
        "cafe24ErrorCode": "404",
        "cafe24Message": "Not Found"
      }
    }
  },
  "meta": { "statusCode": 404, "durationMs": 120, "callUsage": 13 },
  "port": "error"
}
```

429 재시도 소진:

```json
{
  "config": { "integrationId": "...", "resource": "product", "operation": "product_list", "fields": {} },
  "output": {
    "error": {
      "code": "CAFE24_RATE_LIMITED",
      "message": "Cafe24 leaky bucket exhausted after 2 retries",
      "details": { "retries": 2, "lastRetryAfterSec": 5, "mallId": "myshop" }
    }
  },
  "meta": { "statusCode": 429, "durationMs": 12500, "callUsage": 100, "callRemain": 5 },
  "port": "error"
}
```

전송 실패(네트워크·타임아웃):

```json
{
  "config": { "integrationId": "...", "resource": "order", "operation": "order_list", "fields": {} },
  "output": {
    "error": {
      "code": "CAFE24_TRANSPORT_FAILED",
      "message": "ECONNRESET",
      "details": { "mallId": "myshop", "resource": "order", "operation": "order_list" }
    }
  },
  "meta": { "statusCode": 0, "durationMs": 30000 },
  "port": "error"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.fields` | object | 설정 에코 | 호출하려던 입력(`{{ }}` 보존) |
| `output.response` | unknown | 런타임 | 4xx·5xx 에서도 Cafe24 응답 본문 보존 |
| `output.error.code` | string | 핸들러 반환 | 아래 에러 코드 표의 값 |
| `output.error.message` | string | 핸들러 반환 | `Cafe24 API returned <status>`. statusText 는 넣지 않는다. 서버 쪽 사유는 `details.cafe24ErrorCode`·`cafe24Message` 로 보존한다 |
| `output.error.details.statusCode` | number | 핸들러 반환 | HTTP 상태 |
| `output.error.details.mallId` | string | 핸들러 반환 | 호출 대상 `mall_id`(디버깅) |
| `output.error.details.resource` / `operation` | string | 핸들러 반환 | 호출하려던 노드 설정 |
| `output.error.details.cafe24ErrorCode` / `cafe24Message` | string? | 핸들러 반환 | Cafe24 응답 본문의 `error.code`·`message`(있을 때) |
| `meta.statusCode` | number | 핸들러 반환 | HTTP 응답 상태(전송 실패는 `0`) |
| `port` | `'error'` | 핸들러 반환 | 에러 분기 |

## 에러 코드

### 사전 검증 에러

`handler.validate()` 가 실패하면(설정 형식 자체가 잘못된 경우) 노드 실행이 시작되지 않는다. 경고 규칙과 `evaluateMetadataBlockingErrors` 가 throw 하고 엔진이 실행을 실패로 끝낸다. 예: `Integration 을 선택해야 합니다.`, `resource must be one of: store, product, order, ... (18 categories)`.

### 런타임 에러 (`port: 'error'`)

`execute()` 안의 모든 실패는 에러 포트로 간다(D4). 활동 로그에는 같은 실패를 `status: 'failed'` 와 `error: {code, message}` 로 기록한다.

| 코드 | 조건 | `output.response` | `meta.statusCode` |
|------|------|-------------------|-------------------|
| `CAFE24_4XX` | `400 ≤ statusCode < 500` 중 404·422 가 아닌 경우. 남은 3xx 도 여기로 분류한다 | 서버 본문 보존 | 응답 상태 |
| `CAFE24_404` | Cafe24 응답 404(자주 분기하는 경우) | 서버 본문 보존 | 404 |
| `CAFE24_422` | Cafe24 응답 422(검증 실패) | 서버 본문 보존 | 422 |
| `CAFE24_AUTH_FAILED` | 401: 토큰 갱신 후 1회 재시도에도 401. 403: 즉시. 403 일 때의 코드는 정의가 갈린다. [미결 사항](#미결-사항) 참조 | 서버 본문 보존 | 401 / 403 |
| `CAFE24_RATE_LIMITED` | 429 와 재시도 소진 | 서버 본문 보존(있으면) | 429 |
| `CAFE24_5XX` | `500 ≤ statusCode < 600` | 서버 본문 보존 | 응답 상태 |
| `CAFE24_TRANSPORT_FAILED` | 요청 reject(DNS·연결 거부·소켓·타임아웃) | 없음 | `0` |
| `CAFE24_UNKNOWN_OPERATION` | `operation` 이 메타데이터에 없음 | — | `0` |
| `CAFE24_MISSING_FIELDS` | `requiredFields` 누락 또는 조건부 필수 제약 위반. 두 사유 모두 같은 코드를 쓴다 | — | `0` |
| `CAFE24_INVALID_MALL_ID` | `mall_id` 형식 위반(소문자 영숫자·하이픈, 3~50자 밖) | — | `0` |
| `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` / `INTEGRATION_CALL_FAILED` | 통합 해소·자격 증명 실패([통합 노드 공통](CLE-NODE-INT-COMMON.md)) | — | `0` |
| `INTEGRATION_SERVICE_UNAVAILABLE` | `__workspaceId` 누락 또는 `Cafe24ApiClient` 미주입(배포 구성 에러) | — | `0` |

### 인증 실패 처리

**401(액세스 토큰 만료 가능성)**: 토큰을 한 번 갱신한 뒤 같은 요청을 다시 보낸다. 통합 화면의 연결 테스트(`pingConnection`)도 같은 정책을 쓴다.

1. 토큰 갱신을 요청한다(`refreshViaQueue`, `source='reactive_401'`). 이 경로의 큐 dedup 우회와 여러 인스턴스 사이 직렬화는 [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md)에서 정한다.
2. 갱신에 성공하면 새 액세스 토큰으로 같은 요청을 **한 번** 다시 보낸다.
3. 재시도 응답이 2xx 면 통합은 `connected` 그대로다. 애초에 `error` 로 바꾸지 않는다. 정상 결과를 돌려준다.
4. 재시도 응답도 401 이면 토큰 자체의 문제로 확정하고 아래 격하 동작을 한다.

갱신 자체가 401·403(`invalid_grant`)으로 실패하면 갱신 단계가 이미 통합을 `error(auth_failed)` 로 바꾸고 throw 한다. 이때는 재시도하지 않는다. 재시도는 정확히 1회다(무한 재시도 차단). 429 재시도와는 따로 센다.

**403(권한 범위 부족·앱 미설치)**: 토큰 갱신으로 되살릴 수 없으므로 즉시 격하한다. 권한 범위 부족 신호가 있으면 사유를 `insufficient_scope` 로, 그 밖은 `auth_failed` 로 둔다.

**격하 동작**: 위 두 경우 모두 다음을 함께 한다.

1. `port: 'error'` 로 보내고 `output.error.code` 를 인증 실패 코드로 둔다.
2. 활동 로그의 `error.code` 에도 같은 코드를 남긴다.
3. 통합 상태를 `error` 로, 사유를 `auth_failed` 또는 `insufficient_scope` 로 한 번의 UPDATE 로 바꾼다. 통합 관리 화면에 "Need attention" 이 보이게 된다. 전이 조건과 사유 값은 [통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md)이 정한다.

격하한 뒤 `error → connected` 로 자동으로 돌아가지 않는다. 사용자가 통합 재인증으로 되돌린다. Cafe24 Private 앱은 통합 재인증 진입점이 없어 삭제 후 다시 등록하는 것이 유일한 복구다([OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md#cafe24-private-이-오류가-되면-삭제-후-재등록만-된다)). 자동으로 돌아가지 않게 한 것은 시각 경쟁으로 상태가 뒤바뀌지 않게 하려는 정책이다. [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md)의 인증 실패 전환 정책과 같다.

## 캔버스 요약

[통합 노드 공통](CLE-NODE-INT-COMMON.md) 캔버스 요약 표의 Cafe24 행을 따른다. 포맷은 `{{resource}} · {{operation}}`(예: `product · product_list`)이고 렌더된 한 줄을 40자에서 자른다. 참조하던 통합이 삭제되면 `⚠ Missing integration` 배지를 붙인다.

## AI 에이전트 노출

통합 하나를 이 노드와 AI 에이전트 MCP 도구가 함께 쓴다. `Cafe24McpToolProvider`(`codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts`)가 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md)의 내부 MCP 브리지 패턴으로 이 노드와 같은 메타데이터 테이블에서 MCP 도구 목록을 자동으로 만든다. 노드와 MCP 도구는 같은 `Cafe24ApiClient` 호출 경로를 쓴다.

### 도구 이름

| 노드 쪽 | MCP 쪽 |
|---------|--------|
| `resource='product'`, `operation='product_list'` | `mcp_<통합 id 8자>__product_list` |
| `resource='order'`, `operation='order_get'` | `mcp_<통합 id 8자>__order_get` |
| `resource='customer'`, `operation='customer_delete'` | `mcp_<통합 id 8자>__customer_delete` |

- 도구 이름의 sanitize·길이 규칙은 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) 도구 이름 규칙을 그대로 쓴다. operation id 안에 밑줄이 들어가도 서버와 도구를 가르는 첫 `__` 위치로 나누므로 충돌하지 않는다.
- `mcp_<sid>__` 접두어를 누가 붙이는지는 [Cafe24 operation 메타데이터](CLE-C24-META) MCP 매핑 절이 정한다. 도구 프로바이더가 `buildTools()` 에서 접두어가 붙은 이름을 직접 만들고, `execute()` 에 들어올 때 접두어를 벗겨 bare operation id 로 처리한다.
- 노출 도구 목록(`mcpServers[].enabledTools`)은 bare operation id 배열(예: `['product_list', 'order_list']`)로 저장하고 비교한다.
- `buildTools()` 는 모든 도구 설명 끝에 KST 시간대 안내 한 줄(`CAFE24_TIMEZONE_SUFFIX`)을 자동으로 붙인다. AI 에이전트가 `$now`(UTC)와 KST 의 9시간 차이를 몰라 도구 인자를 잘못 만드는 회귀를 막는 1차 방어선이다. AI 노드 시스템 프롬프트의 시스템 컨텍스트 접두([AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md))와 함께 두 경로로 알린다.

### 메타 도구 미사용

내부 MCP 브리지는 `tools` capability 만 보고하고 `resources`·`prompts` 는 보고하지 않는다. Cafe24 Admin API 는 도구 기반 RPC 모델이고 프롬프트 템플릿이나 읽기 전용 리소스 모델이 없기 때문이다. 그래서 `mcp_<sid>__list_resources` 같은 메타 도구는 노출하지 않는다([MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) 노출 규칙).

### 노출 도구 목록 화면

AI 에이전트 설정에서는 리소스 단위로 묶어 고르게 한다. "Product (read/write 전부 허용)" 같은 묶음을 고르면 프론트엔드가 `enabledTools` 배열로 펼쳐 저장한다(용어는 [Cafe24 operation 메타데이터](CLE-C24-META) allowlist 절).

- 리소스 전체가 별도 승인 대상인 묶음은 그룹 머리에 ⚠ 와 "별도 승인 필요" 를 보인다. operation 단위 별도 승인 대상은 해당 행에만 ⚠ 를 보인다. 명단은 [Cafe24 별도 승인 scope](CLE-C24-SCOPES)가 정한다.
- 백엔드가 `tools/list` 응답 메타데이터에 `restrictedApproval` 을 실어 보내고 프론트엔드가 자동으로 렌더한다.
- 막지는 않는다. 사용자가 알고 고를 수 있게 안내만 한다.

### 호출 제한 공유

노드 호출과 MCP `tools/call` 은 모두 같은 `Cafe24ApiClient` 를 지나므로 같은 통합의 leaky bucket 을 공유한다. AI 에이전트 멀티턴 중 LLM 이 빠르게 연달아 부르면 다른 워크플로우의 같은 통합 호출도 함께 기다린다(같은 프로세스 인스턴스 mutex). 격리 단위는 통합이며 `mall_id` 가 다른 통합끼리는 공유하지 않는다.

### 활동 로그

MCP 쪽 호출도 같은 활동 로그(`IntegrationUsageLog`)에 기록한다([MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md)). `node_execution_id` 는 호출 시점의 AI 에이전트 노드 실행이다. 통합 상세 화면의 활동 탭은 두 경로의 호출을 함께 보인다. 내부 MCP 브리지는 노드 핸들러 베이스를 거치지 않고 `IntegrationsService.logUsage` 를 직접 부르므로 `api` 식별 정보도 직접 채워야 한다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md) INT-US-05).

### 만료된 통합의 도구 목록 처리

`buildTools()` 는 AI 에이전트 노드가 실행될 때 `mcpServers[]` 의 각 Cafe24 통합을 조회해 도구 목록을 만든다. 통합 상태에 따라 다음과 같이 처리한다.

| 상태 | 처리 |
|------|------|
| `connected` | 정상 도구 목록 |
| `expired` + `status_reason='install_timeout'` | 뺀다(`install_token` 이 NULL 이라 갱신 불가). `mcpDiagnostics.serverSummaries[].skipReason='expired_install_timeout'` |
| `expired` + 리프레시 토큰 있음 + 사유가 `install_timeout` 아님 | 큐를 거쳐 1회 토큰 갱신(`refreshViaQueue`)을 시도한다. 갱신 결과로 통합이 `connected` 로 돌아와 도구 등록을 이어 가는지는 정의가 갈린다. [미결 사항](#미결-사항) 참조. 갱신에 실패하면 `error(auth_failed)` 로 바뀌고 뺀다(`skipReason='expired_refresh_failed'`) |
| `expired` + 리프레시 토큰 없음 | 뺀다(`skipReason='expired_no_refresh_token'`). 이상 케이스라 사용자의 통합 재인증이 필요하다 |
| `error(*)` | 뺀다(`skipReason='error'`). 외부에서 명시적으로 통합 재인증하는 것이 정식 복구다(위 "인증 실패 처리") |

빼는지와 그 이유는 모두 AI 에이전트 노드의 `meta.mcpDiagnostics.serverSummaries[]` 에 남는다. 사용자는 "통합이 보이지 않는" 원인을 바로 알 수 있다([MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) 진단).

## Private 앱 설치 엔드포인트

Cafe24 앱은 모두 Cafe24 Developers 에서 만든다. 앱스토어에 등록(심사 완료 또는 대기)한 Public 앱은 서버 환경 변수 `CAFE24_CLIENT_ID`·`CAFE24_CLIENT_SECRET` 으로 OAuth 를 진행하고, 우리 서비스가 인가 URL 팝업을 직접 연다. 심사를 제출하지 않은 Private 앱(최대 5개 쇼핑몰)은 우리 서비스가 OAuth 를 시작할 수 없다. Cafe24 Developers 의 "테스트 실행" 이 우리 App URL(`GET /api/3rd-party/cafe24/install/:installToken?mall_id=...&hmac=...`)을 부르며 흐름을 시작한다. 설치의 사용자 흐름 전체(설치 대기 통합 생성, 콜백, 실패 보존, 24시간 설치 시간 초과)는 [OAuth 연결과 토큰 갱신 §설치 우선 흐름](../CLE-INT/CLE-INT-OAUTH.md#설치-우선-흐름-cafe24-privatemakeshop)이, 엔드포인트의 가드 순서는 [같은 문서 §설치 엔드포인트](../CLE-INT/CLE-INT-OAUTH.md#설치-엔드포인트-app-url)가 정한다. 이 절은 App URL 엔드포인트의 보안 계층 가운데 알고리즘·키·상수(HMAC 검증, 재전송 방지, 실패 제한, Redis 키, 식별 전략)를 정한다.

### Redis 키 (normative)

App URL 설치 엔드포인트가 쓰는 Redis 키는 두 계열이다. 키 형태 규칙과 전체 인벤토리는 [Redis 키 명명 규약](../CLE-ENG/CLE-ENG-REDIS.md)과 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md)이 단일 기준이고, 용도·TTL·Redis 미가용 시 동작은 이 절이 단일 기준이다.

| 키 | 용도 | TTL | Redis 미가용 시 |
|----|------|-----|-----------------|
| `cafe24:install:nonce:<mall_id>:<timestamp>:<hmac 앞 8자>` | HMAC 검증을 통과한 (mall_id, timestamp, hmac) 튜플을 기록해 같은 윈도우 안 재전송을 `CAFE24_INSTALL_REPLAY` 로 거절 | 10분 | 건너뛴다. ±5분 윈도우 정책으로 돌아간다 |
| `cafe24:install:fail:<ip>` | `install_token` 조회·HMAC **실패**만 IP 별로 센다(성공한 설치는 세지 않음). `INSTALL_FAIL_THRESHOLD` 를 넘으면 `429 CAFE24_INSTALL_RATE_LIMITED` | `INSTALL_FAIL_WINDOW_SEC` | 건너뛴다(fail-open) |

상수 **값**은 아래 "관련 코드 상수" 표가 단일 기준이다. 여기서는 이름으로만 가리킨다. 값을 두 곳에 적으면 서로 어긋날 자리가 생기기 때문이다.

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
- **nonce 캐시**: ±5분 윈도우와 HMAC 검증을 통과한 (mall_id, timestamp, hmac) 튜플을 Redis 에 10분 TTL 로 기록한다(`Cafe24InstallNonceCache`). 같은 윈도우 안에 같은 튜플이 다시 오면 `CAFE24_INSTALL_REPLAY` 로 거절한다. "유효한 HMAC + 같은 timestamp 재전송" 까지 막는다. Redis 가 없거나 통신이 실패하면 nonce 검사를 건너뛰고 ±5분 윈도우 정책으로 돌아간다. 운영 환경에서는 BullMQ 가 이미 쓰는 Redis 를 함께 쓰므로 추가 비용이 없다.
- **nonce 키 구성**: `cafe24:install:nonce:{mall_id}:{timestamp}:{hmac 앞 8자}`. base64 hmac(약 44자) 전체 대신 앞 8자(48bit, 약 2.8e14 공간)만 써서 키 길이를 줄인다. 같은 윈도우·같은 (mall_id, timestamp) 에서 앞 8자까지 같을 확률은 무시할 만하다. 충돌해도 이미 HMAC 검증을 통과한 요청이라 보안 영향은 없고, 드물게 정상 재시도가 재전송으로 거절될 뿐이다. 이 충돌은 nonce 키의 고유성 문제이며 `install_token` capability 가정이나 HMAC 암호 강도와는 무관하다.
- **호출 제한(열거 공격 방어, 심층 방어)**: 설치 엔드포인트는 capability-token 가정(`install_token` 은 128bit 이상 무작위라 추측 불가) 위에 두 겹의 운영 방어를 더한다.
  - 1층, IP 제한(IP 당 분당 30회): `@Throttle({ limit: 30, ttl: 60_000 })`. 인증 없는 경로라 `UserThrottlerGuard` 의 IP 대체 키를 쓴다. 현재는 `@nestjs/throttler` 기본 저장소라 인스턴스마다 메모리에 따로 센다. 여러 인스턴스·재배포 때 quota 가 인스턴스별로 나뉜다. Redis 분산 저장소로 옮기는 일은 전역 저장소 교체(모든 제한 엔드포인트에 영향)라 별도 인프라 PR 로 미뤘다. 열거 방어의 핵심은 Redis 기반으로 인스턴스를 넘나드는 2층이 맡으므로 1층 분산화는 보강 성격이다.
  - 2층, 실패 페널티 잠금: `install_token` 조회·HMAC 검증이 **실패**한 요청(`CAFE24_INSTALL_INVALID_TOKEN`·`CAFE24_INSTALL_INVALID_HMAC`)만 IP 별 카운터 `cafe24:install:fail:{ip}` 를 `INCR`(EX `INSTALL_FAIL_WINDOW_SEC`)한다. `INSTALL_FAIL_THRESHOLD` 를 넘으면 HMAC 검증과 행 조회 전에 `429 CAFE24_INSTALL_RATE_LIMITED` 로 즉시 거절한다. 성공한 설치(302 리다이렉트)는 세지 않는다. 정상 사용자(유효한 토큰, 적은 요청)는 영향이 없고 대량 실패인 열거만 겨냥한다. nonce 캐시처럼 Redis 가 없으면 건너뛴다(fail-open). 메모리 대체 수단이 없는 순수 강화 층이라 Redis 가 없을 때 차단을 끄고 기존 정책(±5분 윈도우 + capability-token)으로 돌아가야 정상 설치를 막지 않는다. 1층(메모리 대체)과 의도적으로 다른 저하 경로다.

### 식별 전략

App URL 경로의 `:installToken` 으로 통합 **한 행**을 조회한다. 상태와 무관하다(`pending_install`·`connected`·`error(*)`·`expired` 모두 대상). 조회한 행의 `client_secret` 으로 HMAC 을 **한 번만** 검증한다. 메모리에서 후보를 훑으며 HMAC 을 여러 번 시험하는 방식 대신 이렇게 해서 중복 시나리오와 O(N) 비용을 함께 없앤다.

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

## 미결 사항

- **403(권한 범위 부족) 때 노드 출력 에러 코드**: 이 노드 원문은 403 을 `output.error.code = CAFE24_AUTH_FAILED` 로 내보내고 통합 상태를 `error(auth_failed)` 또는 `error(insufficient_scope)` 로 바꾼다고 적는다. 통합 화면 쪽 원문과 [Cafe24 별도 승인 scope](CLE-C24-SCOPES)는 노드 실행 중 403 이 `INSUFFICIENT_SCOPE` 코드와 `details.missingScopes`·`requiresCafe24Approval` 을 낸다고 적는다. 이 노드 원문의 별도 승인 Rationale 도 `INSUFFICIENT_SCOPE` 의 `details.requiresCafe24Approval` 을 전제한다. 현재 구현은 API 클라이언트에 `CAFE24_INSUFFICIENT_SCOPE` 코드가 있고 `requiresCafe24Approval` 을 통합의 `last_error.details` 에 싣는 것으로 보이나, 노드 출력으로 어떤 코드가 나가는지는 확인되지 않았다. 워크플로우 작성자가 분기할 코드와 `requiresCafe24Approval` 이 실리는 자리를 정해야 한다(관련: [Cafe24 별도 승인 scope](CLE-C24-SCOPES), [통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md)). 같은 충돌이 [통합 관리 미결 사항](../CLE-INT/CLE-INT-MANAGE.md#미결-사항)에 올라 있다.
- **만료된 통합의 도구 목록 자가 회복**: 이 노드 원문은 `buildTools()` 가 `expired` 행에 큐 경유 토큰 갱신을 걸면 갱신 worker 가 통합을 `connected` 로 되돌려 정상 도구 목록을 받는다고 적는다. [통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md) 원문은 갱신 worker 가 source 와 무관하게 `status !== 'connected'` 행을 건너뛴다고 적고(현재 구현 `cafe24-token-refresh.processor.ts` 의 상태 가드와 같음), 같은 문서의 상태도에는 MCP 브리지 자가 회복으로 `expired → connected` 가 된다고 적어 자기모순이다. 만료된 통합이 AI 에이전트에서 되살아나는지가 여기에 달려 있다. 자가 회복 서술을 지울지, worker 가드에 예외를 설계할지 결정 필요(관련: [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md), [MakeShop 노드](CLE-NODE-MAKESHOP.md)도 같은 정책을 따른다). 같은 충돌이 [통합 상태와 만료 알림 미결 사항](../CLE-INT/CLE-INT-STATUS.md#미결-사항)에 올라 있다.

## 구현 위치

- `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts`
- `codebase/backend/src/nodes/integration/cafe24/cafe24.schema.ts`
- `codebase/backend/src/nodes/integration/cafe24/cafe24.component.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/index.ts` (operation 메타데이터)
- `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` (호출 제한·요청 봉투·401 재시도)
- `codebase/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts` (토큰 갱신 worker)
- `codebase/backend/src/nodes/integration/cafe24/cafe24.module.ts`
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` (내부 MCP 브리지)
- `codebase/backend/src/modules/integrations/third-party-oauth.controller.ts` (App URL 설치 엔드포인트)
- `codebase/backend/src/modules/integrations/cafe24-install-rate-limit.service.ts` (설치 실패 제한)
- `codebase/backend/src/modules/integrations/cafe24-install-nonce-cache.service.ts` (설치 nonce 캐시)
- `codebase/frontend/src/components/integrations/cafe24-allowlist-editor.tsx` (노출 도구 목록 편집)
- `codebase/frontend/src/components/integrations/approval-required-badge.tsx` (별도 승인 배지)

## Rationale

### 노드 하나 + 메타데이터 테이블

캔버스 노드 하나에 리소스·operation 동적 폼을 두고, 새 operation 은 메타데이터 행 1개로 더한다. operation 마다 도메인 노드를 두면 캔버스 가독성과 노드 카탈로그가 무너진다. 범용 HTTP Request 노드 + 인증 등록 방식은 매번 URL·method 를 구성해야 해서 사용성이 떨어지고 호출 제한 헤더 처리를 일반화하기 어렵다. n8n·Make 의 Cafe24 노드와 같은 결정이다.

operation 규모는 한동안 "리소스당 평균 약 10개, 총 약 180개" 로 적혀 있었지만 이는 초기 추정치였다. 2026-07-17 실측(카탈로그 supported 행, 백엔드 메타데이터 operation, 두 값의 양방향 일치를 강제하는 카탈로그 동기 검사)으로 485개를 확인했다. 단순 `grep -c supported` 는 개요 문서의 설명·예시 행이 섞여 491·486 이 나오므로 status 컬럼 기준으로 세야 한다. 2026-07-13 장애 때 프롬프트에 실린 도구 383개는 그 계정의 허용 권한 범위로 거른 수이지 카탈로그 총량이 아니다. 이 정정은 "노드 하나" 결정을 뒤집지 않는다. operation 마다 노드를 두면 캔버스가 무너진다는 논거가 오히려 강해진다. 현재 수는 [Cafe24 API 카탈로그](CLE-C24-CATALOG)가 단일 기준이다.

### 내부 MCP 브리지

통합 하나를 서버 프로세스 안에서 MCP 도구로 노출한다. AI 에이전트 스펙과 핸들러는 바꾸지 않는다. 백엔드 구현은 AI 에이전트 핸들러의 도구 프로바이더 인터페이스(`codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts`)를 구현한 `Cafe24McpToolProvider`(메타데이터 → `buildTools()`·`execute()`)다. 별도 외부 MCP 서버를 두고 통합을 두 번 등록하는 방식은 자격 증명이 중복되고 운영 부담이 커서 쓰지 않았다.

### 메타데이터를 두는 자리

메타데이터 **형식**은 [Cafe24 operation 메타데이터](CLE-C24-META)가 정하고 실제 행은 백엔드 메타데이터 모듈(`codebase/backend/src/nodes/integration/cafe24/metadata/*.ts`)에 있다. operation 목록(구현됨·예정·폐기)은 [Cafe24 API 카탈로그](CLE-C24-CATALOG)에 리소스 단위로 나눠 둔다. 카탈로그와 백엔드 메타데이터는 카탈로그 동기 검사(`catalog-sync.spec.ts`)가 양방향으로 지킨다. 새 operation 을 더하려면 카탈로그 행 갱신과 메타데이터 행 추가가 같은 PR 에 있어야 CI 를 통과한다. 이 문서는 operation 목록을 본문에 되풀이하지 않는다. 어긋남을 막기 위해서다.

### 호출 제한 범위

`Cafe24ApiClient` 의 메모리 mutex 는 같은 프로세스 인스턴스 안에서 API 호출의 leaky bucket 직렬화만 맡는다.

- Cafe24 leaky bucket 은 통합 단위(`mall_id` 기준) quota 라서 인스턴스 사이 동시 호출에서도 429 가 스스로 backoff 신호가 된다. 그래서 API 호출 자체를 인스턴스 사이에서 직렬화할 필요는 없다.
- 토큰 갱신의 인스턴스 사이 직렬화는 따로 푼다. `proactive`·`background` 경로는 `cafe24-token-refresh` BullMQ 큐의 `jobId = integrationId` dedup 으로, `reactive_401` 경로는 dedup 을 우회하는 고유 jobId 와 `refreshAccessToken` 의 PostgreSQL 행 잠금(`pessimistic_write`)으로 모은다. 리프레시 토큰 회전 경쟁을 두 단계로 막는 구조다. 갱신 진입점은 다섯이다. 호출 직전 갱신(`proactive`), `cafe24-background-refresh` 작업, `connected-expiry` 당일 분기, 내부 MCP 브리지의 `expired` 자가 회복(이 셋은 `background`), 401 뒤 갱신(`reactive_401`)이다. 자가 회복이 실제로 통합을 되살리는지는 [미결 사항](#미결-사항)이다. 진입점 목록과 큐 설정은 [OAuth 연결과 토큰 갱신 §갱신 큐](../CLE-INT/CLE-INT-OAUTH.md#갱신-큐)가 단일 기준이다. 결정 배경은 같은 문서 Rationale 의 [BullMQ `jobId` 중복 제거](../CLE-INT/CLE-INT-OAUTH.md#여러-인스턴스의-갱신-경쟁은-bullmq-jobid-중복-제거로-푼다)와 [`reactive_401` 고유 jobId](../CLE-INT/CLE-INT-OAUTH.md#reactive_401-은-고유-jobid-로-중복-제거를-완전히-건너뛴다)에 있다.
- 두 인스턴스가 동시에 401 을 받아 `reactive_401` worker 가 둘 다 돌면 행 잠금이 같은 행의 동시 UPDATE 를 직렬화한다. 한 인스턴스만 새 토큰을 저장하고 다른 쪽은 `invalid_grant` 로 격하된다(fail-safe). `reactive_401` 은 실제 401 을 받았을 때만 발생하므로 leaky bucket 부담이 눈에 띄게 늘지 않는다.

### OAuth 권한 범위를 콤마로 보내는 이유 (RFC 6749 예외)

Cafe24 의 `/oauth/authorize` 는 RFC 6749 §3.3 의 공백 구분이 아니라 **콤마 구분** 권한 범위를 요구한다(자체 규약). 그래서 인가 시작 단계에서 `service.oauthProvider === 'cafe24'` 분기로 `,` 를 쓴다. 다른 OAuth 제공자(google, github)는 표준 공백 구분을 쓴다.

공백이나 `+` 로 보내면 Cafe24 가 전체 문자열을 토큰 하나로 해석한다. 그래서 권한 범위 하나(예: `mall.read_product`)만 보내도 `invalid_scope` 가 돌아온다. 이 증상은 "사용자 앱 권한 사전 등록 누락" 으로 오진하기 쉬워서 여기에 적는다.

확인 출처:

- `https://developers.cafe24.com/app/front/app/develop/oauth/oauthcode` 의 인증 코드 요청 예시 URL: `scope=mall.read_application,mall.write_application`
- 공식 샘플 앱 `cafe24-app/cafe24_app_sample` 의 `StoreToken.java#getCodeRedirectUrl`: `APP_SCOPE` 를 `&scope=` 에 그대로 이어 붙인다(공백·특수 인코딩 없음)
- velog `@yl9517` 의 `mall.read_product` 하나를 콤마 구분으로 보낸 정상 동작 사례

회귀 보호: `codebase/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` 가 인가 URL 에 `scope=...%2C...` 가 들어 있는지, `+`·`%20` 으로 돌아가지 않는지 검증한다.

### 필드 편집 UI

operation 메타데이터 기반 동적 폼을 쓴다. `extras.operationsByResource` 로 (리소스, operation) 별 `fields[]` 가 프론트엔드에 도착한다. UI 는 메타데이터에 적힌 키만 행으로 렌더하고 필수와 선택으로 나눈다. 사용자가 임의 키를 더하는 경로가 없으니 빈 키 행이나 편집 버퍼 문제가 구조적으로 사라진다. 모든 값 칸은 `ExpressionInput` 을 바탕으로 해서 표현식을 유지한다. 자유 key-value 행 입력은 어느 키가 필수·선택인지 안내하지 못하고 빈 키 행용 편집 버퍼를 따로 둬야 해서 쓰지 않았다. 다른 통합 노드(HTTP Request 의 `headers`·`queryParams`)는 `KeyValue[]` 로 직렬화하므로 이 결정의 대상이 아니다(빈 키 행도 그대로 에코).

operation 을 바꿀 때 `fields` 를 모두 초기화하면 다음 operation 도 받는 키를 사용자가 다시 입력해야 한다. 그래서 새 operation 의 `fields[].name` 과 현재 `config.fields` 키의 **교집합**만 남긴다. `product_get → product_list` 같은 점진 전환에서 `shop_no` 같은 공통 키가 남는다. 리소스를 바꾸면 뜻이 너무 크게 달라지므로 모두 초기화한다.

### Cafe24 요청 봉투를 API 클라이언트 한 곳에서 감싸는 이유

POST·PUT 본문의 `request` 봉투는 `Cafe24ApiClient.executeWithRateLimit` 의 wire 직렬화 단계(`JSON.stringify` 직전)에서 적용한다. 노드 핸들러나 `Cafe24McpToolProvider` 의 본문 구성 단계에서 감싸지 않는 이유는 다음과 같다.

- 봉투는 Cafe24 wire format 고유 규약이지 노드나 MCP 의 관심사가 아니다. API 클라이언트가 이미 URL 접두(`{mall_id}.cafe24api.com`), leaky bucket 헤더, 토큰 갱신 같은 Cafe24 전용 책임을 맡고 있어 단일 책임 원칙에 맞는다.
- 노드 핸들러(`buildRequestParts`)와 `Cafe24McpToolProvider.execute` 가 같은 분리 로직을 따로 갖고 있었다. 한 지점에서 고쳐야 어긋남을 막는다.
- 외부 시그니처 `Cafe24CallOptions.body: Record<string, unknown>` 은 바뀌지 않는다. 호출자는 평평한 객체를 넘기면 된다.
- 두 호출 경로가 모두 평평한 본문을 직렬화하면 `request` 봉투가 빠져 `400 "Please enter the Request parameter."` 에 빠진다. API 클라이언트 단일 책임이 이를 구조적으로 막는다.

POST·PUT 밖의 method 는 허용 목록으로 강제한다. PATCH 같은 method 가 나중에 생기면 API 클라이언트 안에서 명시적으로 정하게 된다(DELETE 본문이 조용히 감싸지지 않도록). 이중 감싸기 throw 가드는 현재 모든 호출자(노드 핸들러, 내부 MCP 브리지)가 평평한 본문만 쓴다는 전제에 기댄다. 봉투를 미리 적용해야 하는 새 호출자가 생기면 그때 가드 정책을 다시 본다.

### 별도 승인 라벨을 메타데이터 한 곳에서 렌더

화면 네 곳(통합 추가 위저드, 통합 상세 권한 범위 영역, 이 노드의 operation 드롭다운, AI 에이전트 노출 도구 목록)의 ⚠ 라벨은 모두 같은 메타데이터(`Cafe24OperationMetadata.restrictedApproval`)에서 자동으로 렌더한다. 명단의 단일 기준은 [Cafe24 별도 승인 scope](CLE-C24-SCOPES)뿐이다. 이 문서는 라벨이 노드와 AI 에이전트의 어디에 보이는지만 적고 명단을 되풀이하지 않는다. operation 목록을 본문에 되풀이하지 않는 것과 같은 이유다(어긋남 방지). 막는 정책을 택하지 않은 이유는 [OAuth 연결과 토큰 갱신 Rationale](../CLE-INT/CLE-INT-OAUTH.md#cafe24-별도-승인-권한-범위는-막지-않고-안내한다)에 있다. 새 에러 코드는 더하지 않았다. 403 때 어떤 코드와 보강 필드로 알리는지는 [미결 사항](#미결-사항)이다.
