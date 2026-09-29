---
id: "CLE-NODE-MAKESHOP"
title: "MakeShop 노드"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-MKSNODE-001", "REQ-MKSNODE-002", "REQ-MKSNODE-003", "REQ-MKSNODE-004", "REQ-MKSNODE-005", "REQ-MKSNODE-006", "REQ-MKSNODE-007", "REQ-MKSNODE-008", "REQ-MKSNODE-009", "REQ-MKSNODE-010", "REQ-MKSNODE-011", "REQ-MKSNODE-012", "REQ-MKSNODE-013", "REQ-MKSNODE-014", "REQ-MKSNODE-015", "REQ-MKSNODE-016", "REQ-MKSNODE-017", "REQ-MKSNODE-018", "REQ-MKSNODE-019", "REQ-MKSNODE-020", "REQ-MKSNODE-021", "REQ-MKSNODE-022", "REQ-MKSNODE-023", "REQ-MKSNODE-024", "REQ-MKSNODE-025", "REQ-MKSNODE-026", "REQ-MKSNODE-027", "REQ-MKSNODE-028", "REQ-MKSNODE-029", "REQ-MKSNODE-030", "REQ-MKSNODE-031", "REQ-MKSNODE-032", "REQ-MKSNODE-033", "REQ-MKSNODE-034", "REQ-MKSNODE-035", "REQ-MKSNODE-036", "REQ-MKSNODE-037"]
basis_superseded: false
parent: "CLE-NODE-INT"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT"]
area: "CLE-NODE-INT"
content_hash: "f112b5a92e902ec4c3273346a8faf7e4575276fa88eb70cef041328efedadbd4"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/4-integration/5-makeshop.md"]
mirror_sha256: "02be735ad99b63feb7d59fe9def1bd8046241c87ed5b9b298da5a102077c5c18"
etag: "sha256-219938cfc136ddd5d3b22ee86723556fa00732a93fd5638f2d8c1a12d247fa73"
---
> 구현 상태: 구현됨 (일부 외부 규약은 공식 문서로 재확인 필요) · 원문: `spec/4-nodes/4-integration/5-makeshop.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

MakeShop 노드(`makeshop`)는 한국 이커머스 SaaS [MakeShop](https://developer.makeshop.co.kr/docs/api/shop/상점-설정-정보) 의 신형 Shop API(`connect.makeshop.co.kr/api/v1/{shopId}`, OAuth 2.1)를 부르는 서비스 특화 통합 노드다. 같은 통합을 AI 에이전트에 도구로 붙이면 LLM 도 같은 API 를 부를 수 있다.

- **사용자 가치**: 쇼핑몰 운영자가 상점 설정·상품·주문·회원·혜택·게시판 등 Shop API operation 을 워크플로우 노드 하나로 부른다. 같은 통합을 AI 에이전트에 도구로 주면 LLM 이 "어제 결제완료 주문 가져와줘" 같은 자연어 요청을 처리한다.
- **지원 범위**: MakeShop Shop API 의 MakeShop 섹션(`MakeshopResource`) 7개(Shop·Product·Order·Member·Benefit·Board·CPIK)의 REST operation 이다. operation 목록과 수는 [MakeShop API 카탈로그](CLE-MKS-CATALOG)가 정한다. CPIK 섹션의 webhook 11개(이벤트 수신)는 이 노드 범위 밖이다(Rationale "CPIK webhook 범위 분리").
- **이중 활용**: Cafe24 에 이어 통합 하나가 워크플로우 캔버스 노드와 AI 에이전트 MCP 도구에 동시에 노출되는 두 번째 사례다. 백엔드의 `MakeshopMcpToolProvider`(도구 프로바이더 `AgentToolProvider` 구현체)가 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md)의 내부 MCP 브리지 패턴으로 이 노드와 같은 메타데이터 테이블에서 도구 목록을 만든다.

설계는 [Cafe24 노드](CLE-NODE-CAFE24.md)와 같은 모양이다. 이 문서는 MakeShop 고유 분기만 자세히 적고, 같은 정책은 Cafe24 노드 문서를 가리킨다. 통합 노드 공통 규약은 [통합 노드 공통](CLE-NODE-INT-COMMON.md)이 정한다. 다음은 다른 문서가 정한다.

- operation 메타데이터 형식(Cafe24 와 다른 점): [MakeShop operation 메타데이터](CLE-MKS-META)
- operation 목록과 요청·응답 필드 스키마: [MakeShop API 카탈로그](CLE-MKS-CATALOG)와 섹션별 문서(아래 "설정" 표)
- OAuth 연결, ShopStore 설치 흐름, 토큰 자동 갱신 정책: [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md). 갱신 진입점과 큐: [OAuth 연결과 토큰 갱신 §갱신 큐](../CLE-INT/CLE-INT-OAUTH.md#갱신-큐)
- 노드 실행 결과로 통합 상태가 바뀌는 조건·사유 값·복구: [통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md)

## 요구사항

원문 노드 PRD 에는 MakeShop 절이 없다. 아래 요구사항은 노드 스펙의 규범 문장에서 뽑았다.

- REQ-MKSNODE-001 WHEN 노드가 실행되면 THE SYSTEM SHALL 선택한 MakeShop 섹션·operation 의 메타데이터로 MakeShop Shop API 를 부른다.
- REQ-MKSNODE-002 WHEN 노드가 실행되면 THE SYSTEM SHALL `service_type='makeshop'` 통합의 OAuth 자격 증명을 쓴다.
- REQ-MKSNODE-003 WHEN 사용자가 operation 을 고르면 THE SYSTEM SHALL 메타데이터의 입력 필드로 필수·선택 두 묶음의 동적 폼을 렌더하고 모든 칸에서 표현식을 허용한다.
- REQ-MKSNODE-004 WHEN 사용자가 operation 을 바꾸면 THE SYSTEM SHALL 새 operation 의 필드 이름과 겹치는 `fields` 값만 남긴다.
- REQ-MKSNODE-005 WHEN operation 메타데이터가 `paginated: true` 면 THE SYSTEM SHALL 페이지네이션 입력을 보여 주고 그 값을 query 로 보낸다.
- REQ-MKSNODE-006 WHEN operation 라벨을 보이면 THE SYSTEM SHALL 별도 승인 ⚠ 라벨을 붙이지 않는다.
- REQ-MKSNODE-007 WHEN 같은 통합이 AI 에이전트 `mcpServers` 에 연결되면 THE SYSTEM SHALL 내부 MCP 브리지(`MakeshopMcpToolProvider`)로 같은 메타데이터에서 도구를 만들어 노출한다.
- REQ-MKSNODE-008 IF operation 이 메타데이터에 없으면 THE SYSTEM SHALL `MAKESHOP_UNKNOWN_OPERATION` 으로 에러 포트에 보낸다.
- REQ-MKSNODE-009 IF 자격 증명에 `shop_uid`·`access_token`·`refresh_token`·`client_id`·`client_secret` 중 하나라도 없으면 THE SYSTEM SHALL `INTEGRATION_INCOMPLETE` 로 에러 포트에 보낸다.
- REQ-MKSNODE-010 IF `shop_uid` 가 형식(영숫자·하이픈·언더스코어)을 어기면 THE SYSTEM SHALL `MAKESHOP_INVALID_SHOP_UID` 로 에러 포트에 보낸다.
- REQ-MKSNODE-011 IF 필수 필드가 없거나 조건부 필수 제약을 어기면 THE SYSTEM SHALL `MAKESHOP_MISSING_FIELDS` 로 에러 포트에 보낸다.
- REQ-MKSNODE-012 WHEN 액세스 토큰이 만료됐거나 60초 안에 만료되면 THE SYSTEM SHALL `https://auth.makeshop.com/oauth/token` 에 `grant_type=refresh_token` 으로 토큰을 갱신한다.
- REQ-MKSNODE-013 WHEN 토큰을 갱신하면 THE SYSTEM SHALL 새로 받은 리프레시 토큰을 저장한다.
- REQ-MKSNODE-014 WHEN 여러 인스턴스가 같은 통합의 토큰 갱신을 요청하면 THE SYSTEM SHALL 전용 `makeshop-token-refresh` 큐의 `jobId = integrationId` dedup 으로 한 번만 실행한다.
- REQ-MKSNODE-015 WHILE 통합이 MakeShop 인 동안 THE SYSTEM SHALL 배경 주기 토큰 갱신 잡을 두지 않는다.
- REQ-MKSNODE-016 WHEN 요청 URL 을 만들면 THE SYSTEM SHALL `https://connect.makeshop.co.kr/api/v1/{shop_uid}/{path}` 형식으로 만들고 path 파라미터를 `fields` 에서 채운다.
- REQ-MKSNODE-017 WHEN 요청을 만들면 THE SYSTEM SHALL 필드를 메타데이터의 `location`(path·query·body)대로 나눈다.
- REQ-MKSNODE-018 WHEN POST 본문을 보내면 THE SYSTEM SHALL 평평한 JSON 그대로 보내고 Cafe24 요청 봉투를 쓰지 않는다.
- REQ-MKSNODE-019 WHEN 401 응답을 받으면 THE SYSTEM SHALL 토큰을 한 번 갱신하고 같은 요청을 한 번 재시도한다.
- REQ-MKSNODE-020 IF 재시도 응답도 401 이면 THE SYSTEM SHALL `MAKESHOP_AUTH_FAILED` 로 에러 포트에 보내고 통합 상태를 `error(auth_failed)` 로 격하한다.
- REQ-MKSNODE-021 WHEN 403 응답을 받으면 THE SYSTEM SHALL 토큰 갱신 없이 즉시 `MAKESHOP_AUTH_FAILED` 로 에러 포트에 보내고 통합 상태를 `error(auth_failed)` 로 격하한다.
- REQ-MKSNODE-022 WHEN 429 응답을 받으면 THE SYSTEM SHALL `Retry-After` 헤더가 있으면 그 값만큼, 없으면 고정 간격만큼 기다린 뒤 최대 2회 재시도한다.
- REQ-MKSNODE-023 IF 429 재시도를 다 쓰면 THE SYSTEM SHALL `MAKESHOP_RATE_LIMITED` 로 에러 포트에 보낸다.
- REQ-MKSNODE-024 WHEN 응답을 받으면 THE SYSTEM SHALL 본문을 `output.response` 에 그대로 두고 `meta.statusCode`·`meta.durationMs` 를 채운다.
- REQ-MKSNODE-025 WHEN 응답이 4xx·5xx 면 THE SYSTEM SHALL 상태별 코드(`MAKESHOP_404`·`MAKESHOP_422`·`MAKESHOP_4XX`·`MAKESHOP_5XX`)로 에러 포트에 보낸다.
- REQ-MKSNODE-026 IF 자동 추종 뒤에도 3xx 응답이 남으면 THE SYSTEM SHALL `MAKESHOP_4XX` 로 분류한다.
- REQ-MKSNODE-027 IF 요청이 reject 되면 THE SYSTEM SHALL `MAKESHOP_TRANSPORT_FAILED` 와 `meta.statusCode = 0` 으로 에러 포트에 보낸다.
- REQ-MKSNODE-028 WHEN 설정을 에코하면 THE SYSTEM SHALL `integrationId`·`resource`·`operation`·`fields`·`pagination` 을 싣고 자격 증명은 싣지 않는다.
- REQ-MKSNODE-029 WHEN 호출이 끝나면 THE SYSTEM SHALL 성공·실패와 관계없이 활동 로그를 1건 남긴다.
- REQ-MKSNODE-030 WHEN 활동 로그를 남기면 THE SYSTEM SHALL `api_label` 을 `makeshop.<resource>.<operation>`, `api_method` 를 operation method, `api_path` 를 path 템플릿으로 채운다.
- REQ-MKSNODE-031 WHEN dry-run 으로 실행되고 operation method 가 POST 면 THE SYSTEM SHALL 실제 호출 없이 mock 결과로 끝낸다.
- REQ-MKSNODE-032 WHEN dry-run 으로 실행되고 operation method 가 GET 이면 THE SYSTEM SHALL 실제로 호출한다.
- REQ-MKSNODE-033 WHEN 내부 MCP 브리지가 도구 이름을 만들면 THE SYSTEM SHALL operationId 의 하이픈을 밑줄로 바꾼다.
- REQ-MKSNODE-034 WHEN 백엔드 메타데이터 검사가 돌면 THE SYSTEM SHALL 섹션 안에서 sanitize 한 operationId 가 겹치지 않는지 검증한다.
- REQ-MKSNODE-035 WHEN AI 에이전트의 노출 도구 목록을 저장하면 THE SYSTEM SHALL 하이픈 원형의 bare operationId 배열로 저장한다.
- REQ-MKSNODE-036 WHEN AI 에이전트가 도구 목록을 만들 때 통합이 `connected` 가 아니면 THE SYSTEM SHALL Cafe24 노드와 같은 규칙으로 도구를 빼거나 토큰 갱신을 한 번 시도한다.
- REQ-MKSNODE-037 WHEN MakeShop 에 OAuth 권한 범위를 요청하면 THE SYSTEM SHALL 표준 공백 구분으로 보낸다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `integrationId` | UUID | ✓ | — | `service_type='makeshop'` 통합 ID([통합 노드 공통](CLE-NODE-INT-COMMON.md) 통합 참조) |
| `resource` | Enum | ✓ | — | MakeShop 섹션. 아래 표의 7개 값 중 하나 |
| `operation` | String | ✓ | — | 선택한 섹션의 operation 식별자. MakeShop operationId 를 그대로 쓴다(예: `get-information`, `get-product`, `post-cart-create`). 메타데이터 테이블([MakeShop operation 메타데이터](CLE-MKS-META))에 있는 값 중 하나 |
| `fields` | Record<string, unknown> | — | `{}` | 선택한 operation 의 입력 필드(path 파라미터 + query + body). 표현식 가능. operation 별 필수·선택 필드는 메타데이터가 정한다 |
| `pagination` | object? | — | — | 페이지네이션을 지원하는 operation 에만 쓴다. `fields` 와 분리해 표준화했다. 필드 이름(`limit`·`offset` 인지 `page`·`limit` 인지)은 정의가 갈린다. [미결 사항](#미결-사항) 참조 |

표현식(`{{ }}`)은 `fields[*]` 와 `pagination.*` 의 모든 값에서 쓸 수 있다. 설정 스키마의 단일 기준은 `codebase/backend/src/nodes/integration/makeshop/makeshop.schema.ts` 다.

섹션 값과 operation 목록 문서:

| `resource` | 뜻 | operation 목록 |
|------------|----|----------------|
| `shop` | 상점 설정 | [Shop](CLE-MKS-SHOP) |
| `product` | 상품 | [Product](CLE-MKS-PRODUCT) |
| `order` | 주문 | [Order](CLE-MKS-ORDER) |
| `member` | 회원 | [Member](CLE-MKS-MEMBER) |
| `benefit` | 혜택 | [Benefit](CLE-MKS-BENEFIT) |
| `board` | 게시판 | [Board](CLE-MKS-BOARD) |
| `cpik` | 외부연동 | [CPIK](CLE-MKS-CPIK) |

## 설정 화면

[Cafe24 노드](CLE-NODE-CAFE24.md) 설정 화면과 같은 메타데이터 기반 동적 폼이다. 다른 점만 적는다.

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|---------------|------|
| 통합 | 맨 위 | 통합 선택기(`serviceTypes=['makeshop']`) | MakeShop 통합만 보여 준다 |
| 섹션 | 통합 아래 | Resource 드롭다운 | 7개 섹션을 라벨과 함께 보인다(예: `product` → "Product (상품)", `cpik` → "CPIK (외부연동)") |
| operation | 섹션 아래 | Operation 드롭다운 | 섹션을 바꾸면 목록이 바뀐다 |
| 필드 | operation 아래 | Required·Optional 묶음 | `ExpressionInput` 기반. 호환 키 보존 규칙은 Cafe24 와 같다 |
| 페이지네이션 | 맨 아래 | 페이지네이션 입력 | `paginated: true` 인 operation 에만 보인다 |

- operation 라벨: 백엔드는 카탈로그 키(`labelKey`, `makeshop.<resource>.<operation>`)만 내려 주고 프론트엔드 i18n 사전이 사람이 읽는 라벨로 바꾼다. 사전에 키가 없으면 키 자체를 보인다([MakeShop operation 메타데이터](CLE-MKS-META)).
- 별도 승인 라벨 없음: Cafe24 와 달리 MakeShop 에는 권한 범위·operation 단위의 별도 파트너 승인 단계가 없다(심사 때 일괄 검토만 한다). 그래서 ⚠ "별도 승인 필요" 라벨, `restrictedApproval` 메타데이터, MakeShop 용 별도 승인 명단 문서를 두지 않는다(Rationale "별도 승인 미도입").
- 지원 예정 operation: 현재 MakeShop 메타데이터에는 planned 단계를 드롭다운에 내보내는 경로가 없다. 카탈로그 행은 모두 supported 다. planned 행을 Cafe24 처럼 비활성으로 보일지는 정의가 갈린다. [미결 사항](#미결-사항) 참조.

## 포트

[Cafe24 노드](CLE-NODE-CAFE24.md) 포트와 같다.

| 방향 | id | label | type | dynamic | 설명 |
|------|----|-------|------|---------|------|
| 입력 | `in` | Input | data | false | 입력 데이터(`$input` 으로 참조) |
| 출력 | `success` | Success | data | false | MakeShop API 2xx 응답 |
| 출력 | `error` | Error | error | false | MakeShop API 4xx·5xx, 전송 실패, 429 재시도 소진, 메타데이터 검증 실패 |

3xx 리다이렉트는 요청 라이브러리(`fetch`)가 자동으로 따라가므로 보통 나타나지 않는다. 남은 3xx 는 `MAKESHOP_4XX` 로 분류한다. `status` 는 비블로킹 노드이므로 항상 생략한다.

## 실행 로직

[통합 노드 공통](CLE-NODE-INT-COMMON.md)의 6단계 계약을 따른다. [Cafe24 노드](CLE-NODE-CAFE24.md) 실행 로직과 같은 모양이며 MakeShop 고유 분기는 다음과 같다.

1. **설정 정규화**: `resource`·`operation` 으로 메타데이터 `{ method, path, requiredFields, optionalFields, paginated }` 를 찾는다. 없으면 `MAKESHOP_UNKNOWN_OPERATION` 으로 에러 포트에 보낸다(D4).
2. **설정 에코**: `integrationId`·`resource`·`operation`·`fields`·`pagination` 을 에코한다(노드 출력 규약 Principle 7). 자격 증명은 싣지 않는다.
3. **통합 자격 증명 해소**: `service_type='makeshop'` 과 `status='connected'` 를 확인한다. 실패하면 공통 `INTEGRATION_*` 코드다. 통합이 없거나 다른 워크스페이스 소속이면 공통 규칙대로 `INTEGRATION_CALL_FAILED` 다.
4. **자격 증명 충족 검증과 `shop_uid` 형식**: `shop_uid`·`access_token`·`refresh_token`·`client_id`·`client_secret` 중 하나라도 없으면 `INTEGRATION_INCOMPLETE` 다(D4). `shop_uid` 가 형식 규약(영숫자·하이픈·언더스코어)을 어기면 `MAKESHOP_INVALID_SHOP_UID` 다(D4). 이 검증이 base URL 경로 조각 주입을 막는 사설망 방어다. MakeShop OAuth 는 confidential client 모델이라 `client_id`·`client_secret` 이 언제나 필요하다. Cafe24 처럼 Public·Private 로 나뉘지 않는다. `shop_uid` 의 정확한 정규식은 코드에 잠정값과 `VERIFY` 표시로 두고 운영 전에 MakeShop 문서로 확정한다.
5. **필수 필드·조건부 필수 제약 검증**: Cafe24 와 같다. 제약 형식은 [MakeShop operation 메타데이터](CLE-MKS-META)가 Cafe24 형식을 그대로 쓴다. 어기면 `MAKESHOP_MISSING_FIELDS` 다.
6. **토큰 만료 확인과 갱신**: `Integration.token_expires_at`([통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md))이 지났거나 60초 안이면 자동 갱신한다.
   - 갱신 엔드포인트는 `https://auth.makeshop.com/oauth/token`(`grant_type=refresh_token`)이다.
   - 리프레시 토큰은 한 번 쓰면 회전(rotation)하므로 새 리프레시 토큰을 반드시 저장한다. Cafe24 와 같은 특성이다. 액세스 토큰 TTL 은 1시간, 리프레시 토큰 TTL 은 기본 30일·최대 90일이다.
   - 여러 인스턴스 사이 직렬화는 전용 `makeshop-token-refresh` BullMQ 큐(`jobId = integrationId` dedup)가 맡는다. 서비스마다 토큰 엔드포인트와 회전 정책이 달라 Cafe24 의 `cafe24-token-refresh` 큐와 공유하지 않는다.
   - 갱신 실패 분기와 `reactive_401` 직렬화 정책은 Cafe24 와 같은 모양이며 [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md)이 정한다.
   - 배경 주기 갱신 잡은 두지 않는다. Cafe24 는 리프레시 토큰 TTL 이 14일로 짧아 6시간 주기 `cafe24-background-refresh` 잡으로 만기 전에 미리 갱신한다. MakeShop 은 리프레시 토큰 TTL 이 30~90일로 충분히 길어 호출 직전 갱신(`ensureFreshToken`)과 401 재시도로 충분하다. 오래 쓰지 않은 통합의 복구 방법은 정의가 갈린다. [미결 사항](#미결-사항) 참조.
7. **URL 만들기**: `https://connect.makeshop.co.kr/api/v1/{shop_uid}/{operation.path}`. `{path}` 는 메타데이터 path 템플릿(예: `information`, `product`, `cart/create`)이고 path 파라미터는 `fields` 에서 채운다. Cafe24 의 `{mall_id}.cafe24api.com` 서브도메인 방식과 달리 호스트 하나에 `{shopId}` 경로 조각을 쓴다. 호스트가 고정돼 사용자 입력이 호스트를 정하지 않으므로 `assertSafeOutboundHostResolved` 사설망 차단은 필요 없다. 4단계의 `shop_uid` 형식 검증으로 충분하다.
8. **query·본문 만들기**: 메타데이터 `fields[*].location`(path·query·body)대로 나눈다. 페이지네이션 값은 query 로 보낸다. POST 본문은 평평한 JSON 그대로 보내고 Cafe24 의 `{request:{...}}` 요청 봉투를 쓰지 않는다. MakeShop Shop API 는 GET·POST 만 쓴다([MakeShop operation 메타데이터](CLE-MKS-META)). 봉투가 필요 없는지는 운영 전에 MakeShop 문서로 다시 확인한다(코드 `VERIFY`).
9. **호출**: `MakeshopApiClient` 가 `Authorization: Bearer {access_token}` 을 붙여 보낸다.
   - 401 을 받으면 토큰을 갱신하고 같은 요청을 한 번 재시도한다(Cafe24 와 같은 정책). 403 은 즉시 격하한다(아래 "인증 실패 처리").
   - MakeShop 은 데이터 호출의 호출 제한 헤더·정책을 공개 문서로 밝히지 않았다. 429 를 받으면 `Retry-After` 헤더가 있으면 그 값만큼, 없으면 고정 간격만큼 기다려 최대 2회 재시도하고, 다 쓰면 `MAKESHOP_RATE_LIMITED` 다.
   - 현재 구현은 상위 취소 신호(`context.abortSignal`)를 API 클라이언트에 넘긴다. 그 때문에 생긴 `AbortError` 는 에러 포트로 바꾸지 않고 다시 던져 노드 실행이 `cancelled` 로 분류되게 한다([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md)).
10. **응답 파싱**: JSON 본문을 `output.response` 에 둔다. `meta.statusCode`, `meta.durationMs` 를 채운다.
11. **활동 로그 기록**: 성공·실패 1건. API 식별 정보는 다음과 같다(통합별 전체 표는 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) INT-US-05).
    - `api_label` = 카탈로그 키 `makeshop.<resource>.<operation>`(예: `makeshop.product.get-product`). 프론트엔드가 `GET /api/integrations/services/makeshop/catalog` 응답의 `labelKey` 와 i18n 사전으로 렌더한다.
    - `api_method` = operation 의 `method`(`GET`·`POST`).
    - `api_path` = operation 의 path 템플릿(placeholder 그대로).
12. **반환**: 2xx 는 성공 케이스, 4xx·5xx 는 에러 케이스(아래 에러 코드), 전송 실패는 `MAKESHOP_TRANSPORT_FAILED`. 남은 3xx 는 `MAKESHOP_4XX` 로 분류한다. 별도 `MAKESHOP_3XX` 코드는 두지 않는다(Cafe24 와 같음).

### dry-run

Cafe24 노드와 같은 규칙이다. 쓰기 operation(POST)은 dry-run 에서 외부 상태 변경을 막으려고 mock 으로 끝내고, GET 은 그대로 부른다([재실행](../CLE-EXEC/CLE-EXEC-RERUN.md)).

### 시간대

MakeShop API 날짜·시간 필드의 시간대 규약은 **확인되지 않았다**(코드 `VERIFY`). 운영 전에 MakeShop 공식 문서로 확정한다. KST 고정이면 Cafe24 처럼([Cafe24 operation 메타데이터](CLE-C24-META) 시간대 절) AI 에이전트 도구 설명에 시간대 안내를 붙인다.

## 출력 구조

노드 출력은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 11 형식을 따르며 [Cafe24 노드](CLE-NODE-CAFE24.md)와 같은 다섯 필드 구조다(`config`·`output`·`meta`·`port`, `status` 생략).

### 2xx 성공 (`success`)

```json
{
  "config": {
    "integrationId": "int_makeshop_myshop",
    "resource": "product",
    "operation": "get-product",
    "fields": { "product_id": "{{ $input.pid }}" }
  },
  "output": {
    "response": { "list": { "product_id": "1001", "product_name": "샘플 상품" } }
  },
  "meta": { "statusCode": 200, "durationMs": 280 },
  "port": "success"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | object | 설정 에코 | 사용자 입력 원본(`{{ }}` 보존) |
| `output.response` | unknown | 런타임 | MakeShop 응답 본문 그대로. 구조는 operation 마다 다르며 [MakeShop API 카탈로그](CLE-MKS-CATALOG)의 스키마를 본다 |
| `meta.statusCode` | number | 핸들러 반환 | HTTP 상태(2xx) |
| `meta.durationMs` | number | 핸들러 반환 | 요청부터 응답까지 ms |
| `port` | `'success'` | 핸들러 반환 | 2xx 분기 |

Cafe24 의 `meta.callUsage`·`meta.callRemain`(leaky bucket 메트릭)은 MakeShop 에 **없다**. MakeShop 이 호출 제한 헤더를 공개하지 않아 보일 메트릭이 없다.

### API 에러 또는 전송 실패 (`error`)

`output.error.{code, message, details?}`(Principle 3.2)를 쓴다. 4xx·5xx 면 서버 응답 본문을 `output.response` 에 둔다. 구조는 Cafe24 와 같고 `code` 는 `MAKESHOP_*`, `details` 에 `shopUid`·`resource`·`operation` 을 담는다.

```json
{
  "config": {
    "integrationId": "int_makeshop_myshop",
    "resource": "product",
    "operation": "get-product",
    "fields": { "product_id": "9999" }
  },
  "output": {
    "response": { "error": { "code": "404", "message": "Not Found" } },
    "error": {
      "code": "MAKESHOP_404",
      "message": "MakeShop API returned 404",
      "details": {
        "statusCode": 404,
        "shopUid": "myshop",
        "resource": "product",
        "operation": "get-product"
      }
    }
  },
  "meta": { "statusCode": 404, "durationMs": 120 },
  "port": "error"
}
```

| 필드 | 출처 | 설명 |
|------|------|------|
| `output.response` | 런타임 | 4xx·5xx 에서도 MakeShop 응답 본문 보존 |
| `output.error.code` | 핸들러 반환 | 아래 에러 코드 표의 값(`MAKESHOP_*`·`INTEGRATION_*`) |
| `output.error.message` | 핸들러 반환 | `MakeShop API returned <status>`. statusText 는 넣지 않는다. 서버 쪽 사유는 `details` 의 MakeShop 응답 필드로 일부 보존한다 |
| `output.error.details.{statusCode, shopUid, resource, operation}` | 핸들러 반환 | 디버깅 맥락(`shopUid` 는 호출 대상 상점) |
| `meta.statusCode` | 핸들러 반환 | HTTP 상태(전송 실패는 `0`) |
| `port` | 핸들러 반환 | `'error'` |

## 에러 코드

런타임(`port: 'error'`) `output.error.code` 값이다. 의미 기반 명명은 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md)를 따른다.

| 코드 | 조건 |
|------|------|
| `MAKESHOP_4XX` / `MAKESHOP_404` / `MAKESHOP_422` | 4xx. 404·422 는 자주 분기해 따로 두고 그 밖은 `MAKESHOP_4XX`. 남은 3xx 도 `MAKESHOP_4XX` |
| `MAKESHOP_AUTH_FAILED` | 401(토큰 갱신 후 1회 재시도에도 401) 또는 403(즉시). 통합 상태를 `error(auth_failed)` 로 한 번에 바꾼다 |
| `MAKESHOP_RATE_LIMITED` | 429 와 재시도 소진 |
| `MAKESHOP_5XX` | 5xx |
| `MAKESHOP_TRANSPORT_FAILED` | 요청 reject(DNS·연결·타임아웃). `meta.statusCode=0` |
| `MAKESHOP_UNKNOWN_OPERATION` | `operation` 이 메타데이터에 없음(D4) |
| `MAKESHOP_MISSING_FIELDS` | `requiredFields` 누락 또는 조건부 필수 제약 위반(D4) |
| `MAKESHOP_INVALID_SHOP_UID` | `shop_uid` 형식 위반(D4) |
| `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` / `INTEGRATION_CALL_FAILED` | 통합 해소·자격 증명 실패([통합 노드 공통](CLE-NODE-INT-COMMON.md), D4) |
| `INTEGRATION_SERVICE_UNAVAILABLE` | `__workspaceId` 누락 또는 `MakeshopApiClient` 미주입(배포 구성 에러, D4). Cafe24 와 **같은 공용 코드**를 쓴다. 같은 조건을 두 코드로 나누지 않으려고 서비스별 접두(`MAKESHOP_`)를 붙이지 않는다 |

### 인증 실패 처리

[Cafe24 노드](CLE-NODE-CAFE24.md) 인증 실패 처리 정책을 그대로 쓴다. 401 은 토큰을 갱신하고 한 번 재시도하며 재시도도 401 이면 격하한다. 403 은 즉시 격하한다.

현재 구현은 401·403 모두 `error(auth_failed)` 로 격하한다. Cafe24 의 `insufficient_scope` 세분 전이는 MakeShop 에 없다. MakeShop 은 권한 범위별 별도 승인 단계가 없어 403 을 권한 범위 부족으로 나눌 근거가 없고, `insufficient_scope` 감지는 Cafe24 에만 있다(INT-AU-07, [통합 관리](../CLE-INT/CLE-INT-MANAGE.md)). 격하 조건과 사유 값은 [통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md)이 정한다. 격하한 뒤 `error → connected` 로 자동으로 돌아가지 않는다. 사용자가 어떤 동작으로 되살리는지는 정의가 갈린다. [미결 사항](#미결-사항) 참조.

## 캔버스 요약

[통합 노드 공통](CLE-NODE-INT-COMMON.md) 캔버스 요약 표의 MakeShop 행을 따른다. 포맷은 `{{resource}} · {{operation}}`(예: `product · get-product`)이고 렌더된 한 줄을 40자에서 자른다. 참조하던 통합이 삭제되면 `⚠ Missing integration` 배지를 붙인다.

## AI 에이전트 노출

[Cafe24 노드](CLE-NODE-CAFE24.md) AI 에이전트 노출과 같은 모양이다. `MakeshopMcpToolProvider` 가 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md)의 내부 MCP 브리지 패턴으로 이 노드와 같은 메타데이터에서 MCP 도구를 만든다.

### 도구 이름

| 노드 쪽 | MCP 쪽 |
|---------|--------|
| `resource='product'`, `operation='get-product'` | `mcp_<8자>__get_product` |
| `resource='cpik'`, `operation='post-cart-create'` | `mcp_<8자>__post_cart_create` |

- MakeShop operationId 는 `get-product`·`get-cart_free_config` 처럼 하이픈과 밑줄을 섞어 쓴다. MakeShop 공식 operationId 원형을 그대로 보존하기 때문이다(Cafe24 의 snake_case 통일과 다름). MCP 도구 이름 규칙은 영숫자·밑줄 밖의 문자를 sanitize 하므로 하이픈은 `_` 가 된다(`get-cart-free-config` → `get_cart_free_config`).
- sanitize 충돌 방지: 한 섹션 안에서 sanitize 한 토큰이 겹치면(예: `get-a_b` 와 `get-a-b` 가 모두 `get_a_b`) 도구 이름이 겹친다. 그래서 섹션 안에서 sanitize 한 operationId 가 유일한지 테스트로 검증한다. 현재 구현은 메타데이터 테스트(`makeshop/metadata/metadata.spec.ts`)가 이 검사를 맡는다. 카탈로그 동기 검사(`catalog-sync.spec.ts`)는 sanitize 하기 전 id 가 섹션 파일 안에서 유일한지만 본다. 검사 위치의 기준은 [MakeShop operation 메타데이터 §7](CLE-MKS-META#7-내부-mcp-브리지와의-매핑)이다. 현재 카탈로그에는 충돌이 없고 이 검사로 고정돼 있다.
- bare operationId(하이픈 원형)는 노출 도구 목록과 내부 MCP 브리지의 `execute(name, args)` 에서 그대로 쓴다. sanitize 와 접두어 부여를 어느 층이 맡는지는 [MakeShop operation 메타데이터](CLE-MKS-META) MCP 매핑 절과 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) 도구 이름 규칙이 정한다.

### 그 밖의 정책

메타 도구 미사용, 노출 도구 목록, 호출 제한 공유, 활동 로그, 만료된 통합의 도구 목록 처리는 [Cafe24 노드](CLE-NODE-CAFE24.md) 정책과 같다. 차이는 다음뿐이다.

- 노출 도구 목록은 bare operationId 배열이다.
- 별도 승인 ⚠ 라벨이 없다.
- 활동 로그 `api_label` 은 `makeshop.<resource>.<operation>` 이다.
- 만료된 통합의 자가 회복은 리프레시 토큰이 있을 때 한 번 갱신하는 같은 정책이며, Cafe24 노드의 같은 미결 사항을 이어받는다.

## 미결 사항

- **페이지네이션 파라미터 이름**: 이 노드 원문은 `pagination` 을 `{ limit?: number, offset?: number }` 로 표준화하고 `offset` 을 query 로 보낸다고 적으며, 이를 "카탈로그의 가정" 이라 부른다. 그런데 [MakeShop API 카탈로그](CLE-MKS-CATALOG)의 openapi 추출본 7개에는 `page`·`limit` 을 가진 operation 이 42개이고 `offset` 파라미터는 한 곳도 없다. 카탈로그의 paginated 판정도 `page`+`limit` 기준이다. 현재 구현(`makeshop.handler.ts`)은 원문대로 `offset` 을 query 에 싣고, 메타데이터 `fields` 에는 `page` 가 별도 query 필드로 있다. 어느 쪽을 따르느냐에 따라 `pagination.offset` 이 무시되거나 `page` 가 쓰인다. 공식 문서 추출본(`page`+`limit`)에 맞춰 설정 모양을 바꿀지, `offset`→`page` 변환 규칙을 둘지 결정 필요.
- **격하 뒤 복구 방법(통합 재인증 가능 여부)**: 이 노드 원문은 격하 뒤 사용자가 `Reauthorize`(통합 재인증)로 되돌리고, 오래 쓰지 않은 통합도 통합 재인증으로 복구한다고 적는다. [통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md) 원문과 현재 구현은 MakeShop 통합의 통합 재인증·추가 권한 요청을 `MAKESHOP_USE_SHOPSTORE_INSTALL` 로 거부한다(ShopStore 재설치만 가능). 통합 화면 쪽 원문은 통합 재인증 비활성 조건에 MakeShop 을 넣지 않아 버튼이 활성이다. ShopStore 재설치로 복구되는지도 불분명하다. 결정은 [통합 상태와 만료 알림 미결 사항](../CLE-INT/CLE-INT-STATUS.md#미결-사항) 의 «MakeShop 통합이 오류가 된 뒤의 복구 경로» 에서 한다. 삭제 후 재등록으로 정할지, 재설치가 기존 행을 되살리게 할지, 버튼을 비활성할지가 결정 대상이다. begin 쪽 거절 규칙과 화면 버튼의 어긋남은 [OAuth 연결과 토큰 갱신 미결 사항](../CLE-INT/CLE-INT-OAUTH.md#미결-사항) 의 «MakeShop 통합의 재인증·추가 권한 요청» 에도 올라 있다.
- **지원 예정 operation 표시**: 이 노드 원문과 [MakeShop API 카탈로그](CLE-MKS-CATALOG)는 planned 행을 Cafe24 처럼 비활성·"지원 예정" 으로 드롭다운에 보인다고 적는다. [MakeShop operation 메타데이터](CLE-MKS-META)와 현재 구현(`public-meta.ts`)은 planned 단계를 내보내는 경로가 없다고 적는다. 카탈로그 동기 검사는 planned 상태를 허용하므로 planned 행을 더해도 화면에는 나타나지 않는다. 지금은 planned 행이 0개라 드러나지 않았을 뿐이다. planned 경로를 만들지, 카탈로그의 화면 표시 문구를 지울지 결정 필요.
- **권한 범위 구성**: 이 노드 원문은 권한 범위를 카탈로그의 `x-scope`(주문·상품·회원·상점 설정·게시판·적립금·쿠폰) × read·write 로 만든다고 적는다. 카탈로그 openapi 의 `x-scope` 는 operation 마다 다르다(예: benefit 섹션 일부가 회원, shop 섹션 일부가 주문). 현재 구현(`metadata/index.ts` 의 `SECTION_SCOPE`)은 섹션마다 대표 그룹 하나만 쓰고 "나중에 정교화" 주석과 `VERIFY` 표시를 남겼다. 권한 범위 부족 판정과 권장 프리셋이 어느 기준을 따를지 MakeShop OAuth 문서로 확정한 뒤 [MakeShop operation 메타데이터](CLE-MKS-META)에 매핑 규칙을 적어야 한다.

## 구현 위치

- `codebase/backend/src/nodes/integration/makeshop/makeshop.handler.ts`
- `codebase/backend/src/nodes/integration/makeshop/makeshop.schema.ts`
- `codebase/backend/src/nodes/integration/makeshop/makeshop.component.ts`
- `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts` (401 재시도·429 재시도)
- `codebase/backend/src/nodes/integration/makeshop/makeshop-token-refresh.processor.ts` (토큰 갱신 worker)
- `codebase/backend/src/nodes/integration/makeshop/makeshop.module.ts`
- `codebase/backend/src/nodes/integration/makeshop/metadata/index.ts` (operation 메타데이터)
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/makeshop-mcp-tool-provider.ts` (내부 MCP 브리지)
- `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (OAuth auth-code + PKCE)
- `codebase/backend/src/modules/integrations/integrations.service.ts`
- `codebase/backend/src/modules/integrations/third-party-oauth.controller.ts` (ShopStore 설치 HMAC)
- `codebase/frontend/src/components/integrations/makeshop-allowlist-editor.tsx` (노출 도구 목록 편집)

## Rationale

공통 결정(노드 하나 + 메타데이터, 내부 MCP 브리지, 메타데이터 위치, 다섯 필드 규약, 필드 동적 폼)은 [Cafe24 노드](CLE-NODE-CAFE24.md) Rationale 과 근거가 같아 되풀이하지 않는다. 아래는 MakeShop 고유 분기다.

### 인증 흐름으로 Authorization-Code + refresh 선택

MakeShop 신형 API 는 두 OAuth 흐름을 함께 제공한다. (a) Authorization-Code(OAuth 2.1 + PKCE, `auth.makeshop.com`, 리프레시 30~90일)와 (b) Client-Credentials(`connect.makeshop.co.kr`, `shop_uid`, 토큰 TTL 5분, 발급 분당 5회 제한)다. 이 통합은 (a) 를 택했다. 사용자가 "Cafe24 와 같게" 를 요구했고, 기존 OAuth 인프라(인가 시작·콜백·토큰 갱신 큐·설치 호출 제한·nonce)를 그대로 다시 쓸 수 있기 때문이다. (b) 는 사용자 리다이렉트와 리프레시 저장이 필요 없다는 단순함이 있지만, Cafe24 와 흐름이 달라 새 인프라가 필요하고 토큰 TTL·발급 제한이 있어서 택하지 않았다(나중에 다시 평가할 수 있다).

### OAuth 권한 범위를 공백으로 구분

MakeShop 은 OAuth 2.1 표준을 따르므로 권한 범위를 공백으로 구분(`store.read store.write`)해 보낸다. Cafe24 의 콤마 구분 예외([Cafe24 노드](CLE-NODE-CAFE24.md) Rationale)는 적용하지 않는다. 인가 시작 단계의 OAuth 제공자 분기에서 MakeShop 은 표준 공백 구분 경로를 탄다.

### 호스트 하나 + `shop_uid` 경로 조각

Cafe24 는 `{mall_id}.cafe24api.com` 서브도메인이지만 MakeShop 은 호스트 `connect.makeshop.co.kr` 하나에 `/api/v1/{shop_uid}/` 경로 조각을 쓴다. 상점 식별자 `shop_uid` 는 Cafe24 의 `mall_id` 와 같은 역할이다. 통합의 `mall_id` 컬럼(`credentials.shop_uid` 를 투영)에 두고, 공통 상점 식별자 부분 UNIQUE 인덱스 `idx_integration_workspace_service_mall`(`(workspace_id, service_type, mall_id)`, V072)로 중복 연결을 막는다([통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md)). 인가·토큰은 별도 호스트 `auth.makeshop.com` 을 쓴다.

### POST 요청 봉투 미적용

Cafe24 POST·PUT 은 `{request:{...}}` 봉투가 필수지만 MakeShop 은 평평한 JSON 본문을 받는다(카탈로그의 requestBody 스키마가 모두 평평한 객체다). 그래서 `MakeshopApiClient` 에 봉투 래퍼를 두지 않는다. 운영 전에 다시 검증한다(코드 `VERIFY`). 일부 operation 이 별도 래퍼를 요구하면 그 operation 메타데이터에 표시하고 래퍼 정책을 다시 본다.

### 별도 승인 미도입

Cafe24 는 일부 권한 범위·operation 이 파트너 별도 승인 대상이라 `restrictedApproval` 메타데이터, [Cafe24 별도 승인 scope](CLE-C24-SCOPES) 명단, UI ⚠ 라벨을 둔다. MakeShop 에는 권한 범위·operation 단위 별도 승인 단계가 없다. 앱 심사(ShopStore 등록) 때 요청한 권한 범위 전체를 한꺼번에 검토할 뿐이다. 그래서 MakeShop 에는 `restrictedApproval` 메타데이터, 별도 승인 명단 문서, ⚠ 라벨을 두지 않는다. 심사 거절과 권한 범위 변경 재심사는 앱 등록 운영의 영역이며 노드 실행 스펙의 관심사가 아니다.

### CPIK webhook 범위 분리

CPIK 섹션의 webhook 11개(`event_code` 기반 상품·주문·배송·카테고리 변경 이벤트)는 호출형 REST 가 아니라 이벤트 수신(트리거) 정의다. 이 노드(호출형)와 내부 MCP 브리지(도구)의 범위 밖이며 워크플로우 트리거에 해당한다. Cafe24 에도 아직 수신 webhook 트리거가 없으므로, MakeShop CPIK webhook 과 Cafe24 webhook 을 함께 다루는 통합 공통 webhook·트리거를 별도 후속 과제로 나눴다. MakeShop 쪽 webhook **구독 등록 API** 는 아직 문서화되지 않았다. 후속 작업 전에 파트너센터 확인이 먼저다.

### 운영 전 확인할 항목

노드와 MCP 도구는 구현이 끝났다. 아래는 MakeShop 공식 문서에서 확정하지 못한 부분으로, 코드에 `VERIFY` 주석을 달아 운영 전 확인 대상으로 둔다. 구현 표면이 덜 된 것이 아니다.

- OAuth 인가·토큰 호스트 `auth.makeshop.com`(인가·토큰·갱신): 1차 출처는 MakeShop 가이드 페이지다. 공식 OAuth 문서로 호스트·엔드포인트·Basic 인증 방식을 다시 확인한다.
- 데이터 호출 호출 제한: MakeShop 은 데이터 API 의 호출 제한 헤더·정책을 공개하지 않았다(문서의 분당 5회는 client_credentials **토큰 발급** 한정). 429 best-effort 대기로 시작하고 운영 관측 뒤 정책을 보강한다. Cafe24 의 leaky bucket 메트릭은 헤더가 없어 출력에 넣지 않는다.
- 시간대: 날짜·시간 필드 시간대 미확인.
- POST 봉투: 평평한 본문 가정. 운영 전 확인.
- 페이지네이션 방식: 원문은 카탈로그의 `limit`·`offset` 을 가정했다. cursor 방식은 Cafe24 처럼 쓰지 않는다. 실제 파라미터 이름은 [미결 사항](#미결-사항)이다.

### 통합 파생 필드 계산을 서비스 레지스트리로 일반화

MakeShop 은 Cafe24 에 이은 두 번째 OAuth 리프레시 통합이다. 그래서 Cafe24 전용으로 하드코딩돼 있던 `IntegrationDto` 파생 필드(`autoRefresh`·`appUrl`) 계산을 서비스 레지스트리 기반의 서비스별 계산으로 일반화하는 Cafe24 백로그 C-6 을 함께 풀었다. MakeShop 은 `autoRefresh=true`(auth-code + refresh)이며, ShopStore 설치 App URL 이 있으면 `appUrl` 도 레지스트리 함수로 계산한다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md), [통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md)).
