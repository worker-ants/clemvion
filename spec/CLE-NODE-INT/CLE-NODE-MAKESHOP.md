---
id: "CLE-NODE-MAKESHOP"
title: "MakeShop 노드"
type: "feature"
version: 9
status: "approved"
requirements: ["REQ-MKSNODE-001", "REQ-MKSNODE-002", "REQ-MKSNODE-003", "REQ-MKSNODE-004", "REQ-MKSNODE-005", "REQ-MKSNODE-006", "REQ-MKSNODE-007", "REQ-MKSNODE-008", "REQ-MKSNODE-009", "REQ-MKSNODE-010", "REQ-MKSNODE-011", "REQ-MKSNODE-012", "REQ-MKSNODE-013", "REQ-MKSNODE-014", "REQ-MKSNODE-015", "REQ-MKSNODE-016", "REQ-MKSNODE-017", "REQ-MKSNODE-018", "REQ-MKSNODE-019", "REQ-MKSNODE-020", "REQ-MKSNODE-021", "REQ-MKSNODE-022", "REQ-MKSNODE-023", "REQ-MKSNODE-024", "REQ-MKSNODE-025", "REQ-MKSNODE-026", "REQ-MKSNODE-027", "REQ-MKSNODE-028", "REQ-MKSNODE-029", "REQ-MKSNODE-030", "REQ-MKSNODE-031", "REQ-MKSNODE-032", "REQ-MKSNODE-033", "REQ-MKSNODE-034", "REQ-MKSNODE-035", "REQ-MKSNODE-036", "REQ-MKSNODE-037", "REQ-MKSNODE-038", "REQ-MKSNODE-039", "REQ-MKSNODE-040", "REQ-MKSNODE-041", "REQ-MKSNODE-042", "REQ-MKSNODE-043", "REQ-MKSNODE-044", "REQ-MKSNODE-045", "REQ-MKSNODE-046", "REQ-MKSNODE-047"]
basis_superseded: false
parent: "CLE-NODE-INT"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT"]
area: "CLE-NODE-INT"
content_hash: "e9a59dc19c9bb952a0fc52716c0f7dd458ba83f448b876955fc64b35563208a1"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/4-nodes/4-integration/5-makeshop.md"]
mirror_sha256: "d7cfd07449f49401f9853f878732d5b4bddc76f70759b361da898fa871c67880"
etag: "sha256-88478a015394508b7b5408ec52de968a2914beb764fa5666f55b75623cc7cd90"
---
> 구현 상태: 부분 구현 (일부 외부 규약은 공식 문서로 재확인 필요) · 원문: `spec/4-nodes/4-integration/5-makeshop.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

MakeShop 노드(`makeshop`)는 한국 이커머스 SaaS [MakeShop](https://developer.makeshop.co.kr/docs/api/shop/상점-설정-정보) 의 신형 Shop API(`connect.makeshop.co.kr/api/v1/{shopId}`, OAuth 2.1)를 부르는 서비스 특화 통합 노드다.

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
- REQ-MKSNODE-005 WHEN operation 메타데이터가 `paginated: true` 면 THE SYSTEM SHALL 페이지네이션 입력을 보여 주고 실행할 때 `pagination` 을 MakeShop query `limit` · `page` 로 바꿔 보내며 `offset` 은 보내지 않는다.
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
- REQ-MKSNODE-028 WHEN 설정을 에코하면 THE SYSTEM SHALL `integrationId`·`resource`·`operation`·`fields`·`pagination` 을 사용자가 넣은 원래 값(표현식과 `pagination.offset` 포함)으로 싣고 자격 증명은 싣지 않는다.
- REQ-MKSNODE-029 WHEN 통합을 얻은 뒤 노드 실행이 성공이나 실패로 끝나면 THE SYSTEM SHALL 활동 로그를 1건 남기고 노드 취소 신호(`AbortError`)로 끝난 호출에는 남기지 않는다.
- REQ-MKSNODE-030 WHEN 활동 로그를 남기면 THE SYSTEM SHALL `api_label` 을 `makeshop.<resource>.<operation>`, `api_method` 를 operation method, `api_path` 를 path 템플릿으로 채운다.
- REQ-MKSNODE-031 WHEN 노드가 dry-run 으로 실행되고 operation method 가 GET 이 아니거나 operation 이 상태를 바꾸는 GET 예외 목록에 있으면 THE SYSTEM SHALL 실제 호출 없이 모의 출력으로 끝낸다.
- REQ-MKSNODE-032 WHEN 노드가 dry-run 으로 실행되고 operation method 가 GET 이며 상태를 바꾸는 GET 예외 목록에 없으면 THE SYSTEM SHALL 실제로 호출한다.
- REQ-MKSNODE-033 WHEN 내부 MCP 브리지가 도구 이름을 만들면 THE SYSTEM SHALL operationId 의 하이픈을 밑줄로 바꾼다.
- REQ-MKSNODE-034 WHEN 백엔드 메타데이터 검사가 돌면 THE SYSTEM SHALL 섹션 안에서 sanitize 한 operationId 가 겹치지 않는지 검증한다.
- REQ-MKSNODE-035 WHEN AI 에이전트의 노출 도구 목록을 저장하면 THE SYSTEM SHALL 하이픈 원형의 bare operationId 배열로 저장한다.
- REQ-MKSNODE-036 WHEN AI 에이전트가 도구 목록을 만들 때 통합이 `connected` 가 아니면 THE SYSTEM SHALL Cafe24 노드와 같은 규칙으로 도구를 빼거나 토큰 갱신을 한 번 시도한다.
- REQ-MKSNODE-037 WHEN MakeShop 에 OAuth 권한 범위를 요청하면 THE SYSTEM SHALL 표준 공백 구분으로 보낸다.
- REQ-MKSNODE-038 WHEN paginated operation 의 `pagination.offset` 이 없으면 THE SYSTEM SHALL `page` 를 만들지 않고 `pagination.limit` 이 있을 때만 `limit` 을 보낸다.
- REQ-MKSNODE-039 WHEN paginated operation 의 `pagination.offset` 이 0 이면 THE SYSTEM SHALL `pagination.limit` 이 없어도 `page=1` 을 보내고 `limit` 이 있으면 함께 보낸다.
- REQ-MKSNODE-040 WHEN paginated operation 의 `pagination.offset` 이 0 보다 크고 `pagination.limit` 의 배수면 THE SYSTEM SHALL `limit` 과 `page = offset / limit + 1` 을 보낸다.
- REQ-MKSNODE-041 IF paginated operation 의 `pagination.offset` 이 0 보다 큰데 `pagination.limit` 이 없거나 `offset` 이 `limit` 의 배수가 아니면 THE SYSTEM SHALL `offset` 을 내림하지 않고 통합을 읽거나 API 를 부르기 전에 `MAKESHOP_INVALID_PAGINATION` 으로 에러 포트에 보낸다.
- REQ-MKSNODE-042 IF paginated operation 의 `pagination.limit` 이 양의 정수가 아니거나 `pagination.offset` 이 0 이상의 정수가 아니면(정수 숫자 문자열은 정수로 본다) THE SYSTEM SHALL 통합을 읽거나 API 를 부르기 전에 `MAKESHOP_INVALID_PAGINATION` 으로 에러 포트에 보낸다.
- REQ-MKSNODE-043 WHEN `pagination` 에서 만든 `limit` · `page` 와 같은 이름의 값이 `fields` 에도 있으면 THE SYSTEM SHALL `pagination` 에서 만든 값을 보낸다.
- REQ-MKSNODE-044 WHEN 실행할 operation 이 `paginated: true` 가 아니면 THE SYSTEM SHALL `pagination` 을 읽지 않는다.
- REQ-MKSNODE-045 WHEN 실행 직전 노드 설정 사전 검증(`validate()`)이 돌면 THE SYSTEM SHALL `pagination` 을 검사하지 않고 숫자로 적은 값과 표현식 값의 규칙 위반을 모두 실행 단계의 `MAKESHOP_INVALID_PAGINATION` 판정에 맡긴다.
- REQ-MKSNODE-046 WHEN 사용자가 설정 화면에서 Offset 을 바꾸면 THE SYSTEM SHALL 화면에 보이는 Limit 값(비어 있으면 50)을 함께 저장한다.
- REQ-MKSNODE-047 WHEN 노드 실행이 dry-run 으로 모의 출력을 돌려주면 THE SYSTEM SHALL 활동 로그를 남기지 않는다.

## 하위 문서

| 문서 | 맡는 내용 | 요구사항 |
|------|-----------|----------|
| [MakeShop 노드 — 실행 로직](CLE-NODE-MAKESHOP-EXEC.md) | 실행 단계(자격 증명 · 토큰 갱신 · URL · 요청 · 재시도 · 활동 로그), 페이지네이션 변환, dry-run, 시간대 | REQ-MKSNODE-001, 002, 005, 008~032, 038~045, 047 |
| [MakeShop 노드 — 출력 구조와 에러](CLE-NODE-MAKESHOP-OUTPUT.md) | 성공 · 에러 출력 모양, 에러 코드 표, 인증 실패 처리와 복구 경로 | REQ-MKSNODE-019~021, 023~027 |

설정 · 설정 화면 · 포트 · 캔버스 요약 · AI 에이전트 노출(REQ-MKSNODE-003, 004, 006, 007, 033~037, 046)은 이 문서에 둔다. REQ-MKSNODE-019~021 · 023~027 은 두 하위 문서에 함께 걸린다. 실행 로직은 언제 그 결과로 끝나는지를, 출력 구조와 에러는 그때 나가는 출력 모양과 코드를 정한다. 출력 구조와 에러 문서의 「인증 실패 처리」가 기대는 외부 요구사항은 [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md)의 REQ-INTOAUTH-043(자격 증명을 갖춘 begin 이 `new` 가 아닌 모드면 `MAKESHOP_USE_SHOPSTORE_INSTALL`)과 [통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md)의 REQ-INTSTAT-009(`insufficient_scope` 감지는 Cafe24 한정)다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `integrationId` | UUID | ✓ | — | `service_type='makeshop'` 통합 ID([통합 노드 공통](CLE-NODE-INT-COMMON.md) 통합 참조) |
| `resource` | Enum | ✓ | — | MakeShop 섹션. 아래 표의 7개 값 중 하나 |
| `operation` | String | ✓ | — | 선택한 섹션의 operation 식별자. MakeShop operationId 를 그대로 쓴다(예: `get-information`, `get-product`, `post-cart-create`). 메타데이터 테이블([MakeShop operation 메타데이터](CLE-MKS-META))에 있는 값 중 하나 |
| `fields` | Record<string, unknown> | — | `{}` | 선택한 operation 의 입력 필드(path 파라미터 + query + body). 표현식 가능. operation 별 필수·선택 필드는 메타데이터가 정한다 |
| `pagination` | object? | — | — | 페이지네이션을 지원하는 operation(`paginated: true`)에만 쓴다. `{ limit?, offset? }` 모양이고 `fields` 와 따로 둔다. 모양은 [Cafe24 노드](CLE-NODE-CAFE24.md)와 같고 전송 방식은 다르다(Cafe24 는 `offset` 을 그대로 보낸다). MakeShop 목록 API 는 `page` · `limit` 으로 조회하므로 실행할 때 `limit` · `page` 로 바꿔 보낸다. `offset` 은 `limit` 의 배수여야 한다([페이지네이션 변환](CLE-NODE-MAKESHOP-EXEC.md#페이지네이션-변환)) |

표현식(`{{ }}`)은 `fields[*]` 와 `pagination.*` 의 모든 값에서 쓸 수 있다. `pagination` 은 숫자로 적었든 표현식이든 실행할 때 풀린 값으로 검사한다. 설정 스키마의 단일 기준은 `codebase/backend/src/nodes/integration/makeshop/makeshop.schema.ts` 다.

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
| 페이지네이션 | 맨 아래 | Limit · Offset 숫자 입력과 안내 문구 | `paginated: true` 인 operation 에만 보인다. 아래 "페이지네이션 입력" 참조 |

- operation 라벨: 백엔드는 카탈로그 키(`labelKey`, `makeshop.<resource>.<operation>`)만 내려 주고 프론트엔드 i18n 사전이 사람이 읽는 라벨로 바꾼다. 사전에 키가 없으면 키 자체를 보인다([MakeShop operation 메타데이터](CLE-MKS-META)).
- 별도 승인 라벨 없음: ⚠ "별도 승인 필요" 라벨, `restrictedApproval` 메타데이터, MakeShop 용 별도 승인 명단 문서를 두지 않는다(Rationale "별도 승인 미도입").
- 지원 예정 operation: 드롭다운에 planned 단계를 내보내는 경로가 없고 카탈로그 행은 모두 supported 다([미결 사항](#미결-사항)).
- 페이지네이션 입력: 저장된 값이 없으면 Limit 칸에는 50, Offset 칸에는 0 이 보인다. Offset 을 바꾸면 화면에 보이는 Limit 값도 함께 저장한다. Offset 만 저장되면 화면엔 Limit 50 이 보이지만 실행은 `limit` 없는 `offset` 으로 거절되기 때문이다. 안내 문구에는 MakeShop 이 페이지 번호로 조회한다는 점과 Offset 이 Limit 의 배수여야 하고 `page = Offset / Limit + 1` 로 바뀐다는 점을 적는다.

## 포트

[Cafe24 노드](CLE-NODE-CAFE24.md) 포트와 같다.

| 방향 | id | label | type | dynamic | 설명 |
|------|----|-------|------|---------|------|
| 입력 | `in` | Input | data | false | 입력 데이터(`$input` 으로 참조) |
| 출력 | `success` | Success | data | false | MakeShop API 2xx 응답 |
| 출력 | `error` | Error | error | false | MakeShop API 4xx·5xx, 전송 실패, 429 재시도 소진, 메타데이터·설정 검증 실패 |

3xx 리다이렉트는 요청 라이브러리(`fetch`)가 자동으로 따라가므로 보통 나타나지 않는다. 남은 3xx 의 분류는 [에러 코드](CLE-NODE-MAKESHOP-OUTPUT.md#에러-코드)에 있다. `status` 는 비블로킹 노드이므로 항상 생략한다.

## 실행 로직

→ [MakeShop 노드 — 실행 로직](CLE-NODE-MAKESHOP-EXEC.md)

### 페이지네이션 변환

→ [MakeShop 노드 — 실행 로직](CLE-NODE-MAKESHOP-EXEC.md#페이지네이션-변환)

### dry-run

→ [MakeShop 노드 — 실행 로직](CLE-NODE-MAKESHOP-EXEC.md#dry-run)

### 시간대

→ [MakeShop 노드 — 실행 로직](CLE-NODE-MAKESHOP-EXEC.md#시간대)

## 출력 구조

→ [MakeShop 노드 — 출력 구조와 에러](CLE-NODE-MAKESHOP-OUTPUT.md#출력-구조)

## 에러 코드

→ [MakeShop 노드 — 출력 구조와 에러](CLE-NODE-MAKESHOP-OUTPUT.md#에러-코드)

### 인증 실패 처리

→ [MakeShop 노드 — 출력 구조와 에러](CLE-NODE-MAKESHOP-OUTPUT.md#인증-실패-처리)

## 캔버스 요약

[통합 노드 공통](CLE-NODE-INT-COMMON.md) 캔버스 요약 표의 MakeShop 행을 따른다. 포맷은 `{{resource}} · {{operation}}`(예: `product · get-product`)이고 렌더된 한 줄을 40자에서 자른다. 참조하던 통합이 삭제되면 `⚠ Missing integration` 배지를 붙인다.

## AI 에이전트 노출

[Cafe24 노드](CLE-NODE-CAFE24.md) AI 에이전트 노출과 같은 모양이다. `MakeshopMcpToolProvider` 가 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md)의 내부 MCP 브리지 패턴으로 이 노드와 같은 메타데이터에서 MCP 도구를 만든다. 도구 호출의 dry-run 판정은 [실행 로직 §dry-run](CLE-NODE-MAKESHOP-EXEC.md#dry-run)에 있다.

### 도구 이름

| 노드 쪽 | MCP 쪽 |
|---------|--------|
| `resource='product'`, `operation='get-product'` | `mcp_<8자>__get_product` |
| `resource='cpik'`, `operation='post-cart-create'` | `mcp_<8자>__post_cart_create` |

- MakeShop operationId 는 `get-product`·`get-cart_free_config` 처럼 하이픈과 밑줄을 섞어 쓴다. MakeShop 공식 operationId 원형을 그대로 보존하기 때문이다(Cafe24 의 snake_case 통일과 다름). MCP 도구 이름 규칙은 영숫자·밑줄 밖의 문자를 sanitize 하므로 하이픈은 `_` 가 된다(`get-cart-free-config` → `get_cart_free_config`).
- sanitize 충돌 방지: 한 섹션 안에서 sanitize 한 토큰이 겹치면(예: `get-a_b` 와 `get-a-b` 가 모두 `get_a_b`) 도구 이름이 겹친다. 그래서 섹션 안에서 sanitize 한 operationId 가 유일한지 테스트로 검증한다. 메타데이터 테스트(`makeshop/metadata/metadata.spec.ts`)가 이 검사를 맡고, 카탈로그 동기 검사(`catalog-sync.spec.ts`)는 sanitize 하기 전 id 의 섹션 안 유일성만 본다. 검사 위치의 기준은 [MakeShop operation 메타데이터 §7](CLE-MKS-META#7-내부-mcp-브리지와의-매핑)이다. 현재 카탈로그에는 충돌이 없고 이 검사로 고정돼 있다.
- bare operationId(하이픈 원형)는 노출 도구 목록과 내부 MCP 브리지의 `execute(name, args)` 에서 그대로 쓴다. sanitize 와 접두어 부여를 어느 층이 맡는지는 [MakeShop operation 메타데이터](CLE-MKS-META) MCP 매핑 절과 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) 도구 이름 규칙이 정한다.
- 도구는 MakeShop API 처럼 `page` · `limit` 을 인자로 직접 받고 노드의 페이지네이션 변환을 거치지 않는다.

### 그 밖의 정책

메타 도구 미사용, 노출 도구 목록, 호출 제한 공유, 활동 로그, 만료된 통합의 도구 목록 처리는 [Cafe24 노드](CLE-NODE-CAFE24.md) 정책과 같다. 차이는 다음뿐이다.

- 노출 도구 목록은 bare operationId 배열이다.
- 별도 승인 ⚠ 라벨이 없다.
- 활동 로그 `api_label` 은 `makeshop.<resource>.<operation>` 이다.
- 만료된 통합의 자가 회복은 리프레시 토큰이 있을 때 한 번 갱신하는 같은 정책이며, Cafe24 노드의 같은 미결 사항을 이어받는다.

## 미결 사항

- **페이지네이션 실측 미완**: [페이지네이션 변환](CLE-NODE-MAKESHOP-EXEC.md#페이지네이션-변환)은 저장소 API 카탈로그를 근거로 정했다. `offset` 이 무시되고 `page` 로만 조회되는지는 테스트 상점이 없어 실측하지 못했다(2026-10-10 기준, 추적: CLE-T-XVS8H7). 실측에서 `offset` 이 먹으면 설정 모양과 변환을 다시 검토한다([Rationale «페이지네이션 방식»](CLE-NODE-MAKESHOP-EXEC.md#페이지네이션-방식)).
- **노드별 코드 색인 등재**: [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md)에는 `MAKESHOP_INVALID_PAGINATION` 과 `MAKESHOP_USE_SHOPSTORE_INSTALL`(이름 예외 포함)이 이미 올라 있다. [통합 노드 공통 「노드별 코드 색인」](CLE-NODE-INT-COMMON.md#노드별-코드-색인)의 MakeShop 행에 `MAKESHOP_INVALID_PAGINATION` 을 더하는 일만 남았다(2026-11-13 확인, 추적: CLE-T-7BNDT8).
- **지원 예정 operation 표시**: 이 노드 원문과 [MakeShop API 카탈로그](CLE-MKS-CATALOG)는 planned 행을 Cafe24 처럼 비활성·"지원 예정" 으로 드롭다운에 보인다고 적는다. [MakeShop operation 메타데이터](CLE-MKS-META)와 현재 구현(`public-meta.ts`)에는 planned 단계를 내보내는 경로가 없다. 카탈로그 동기 검사는 planned 상태를 허용하므로 planned 행을 더해도 화면에는 나타나지 않는다. 지금은 planned 행이 0개라 드러나지 않았을 뿐이다. planned 경로를 만들지, 카탈로그의 화면 표시 문구를 지울지 결정 필요.
- **권한 범위 구성**: 이 노드 원문은 권한 범위를 카탈로그의 `x-scope`(주문·상품·회원·상점 설정·게시판·적립금·쿠폰) × read·write 로 만든다고 적는다. 카탈로그 openapi 의 `x-scope` 는 operation 마다 다르다(예: benefit 섹션 일부가 회원, shop 섹션 일부가 주문). 현재 구현(`metadata/index.ts` 의 `SECTION_SCOPE`)은 섹션마다 대표 그룹 하나만 쓰고 "나중에 정교화" 주석과 `VERIFY` 표시를 남겼다. 권한 범위 부족 판정과 권장 프리셋의 기준을 MakeShop OAuth 문서로 확정한 뒤 [MakeShop operation 메타데이터](CLE-MKS-META)에 매핑 규칙을 적어야 한다.

## 구현 위치

실행 · 출력 쪽 구현 위치는 각 하위 문서에 있다.

- `codebase/backend/src/nodes/integration/makeshop/makeshop.schema.ts` (설정 스키마)
- `codebase/backend/src/nodes/integration/makeshop/makeshop.component.ts`
- `codebase/backend/src/nodes/integration/makeshop/makeshop.module.ts`
- `codebase/backend/src/nodes/integration/makeshop/metadata/index.ts` (operation 메타데이터, 상태를 바꾸는 GET 예외 목록 `MAKESHOP_STATE_CHANGING_GET_OPERATION_IDS`)
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/makeshop-mcp-tool-provider.ts` (내부 MCP 브리지)
- `codebase/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` (`MakeshopConfig` 설정 화면과 페이지네이션 입력)
- `codebase/frontend/src/components/integrations/makeshop-allowlist-editor.tsx` (노출 도구 목록 편집)

## Rationale

공통 결정(노드 하나 + 메타데이터, 내부 MCP 브리지, 메타데이터 위치, 다섯 필드 규약, 필드 동적 폼)은 [Cafe24 노드](CLE-NODE-CAFE24.md) Rationale 과 근거가 같아 되풀이하지 않는다. 아래는 MakeShop 고유 분기다. 페이지네이션 · dry-run · 활동 로그 결정은 [실행 로직](CLE-NODE-MAKESHOP-EXEC.md#rationale), 인증 실패 복구 결정은 [출력 구조와 에러](CLE-NODE-MAKESHOP-OUTPUT.md#rationale)에 있다.

### 인증 흐름으로 Authorization-Code + refresh 선택

MakeShop 신형 API 는 두 OAuth 흐름을 함께 제공한다. (a) Authorization-Code(OAuth 2.1 + PKCE, `auth.makeshop.com`, 리프레시 30~90일)와 (b) Client-Credentials(`connect.makeshop.co.kr`, `shop_uid`, 토큰 TTL 5분, 발급 분당 5회 제한)다. 이 통합은 (a) 를 택했다. 사용자가 "Cafe24 와 같게" 를 요구했고, 기존 OAuth 인프라(인가 시작·콜백·토큰 갱신 큐·설치 호출 제한·nonce)를 그대로 다시 쓸 수 있기 때문이다. (b) 는 리다이렉트와 리프레시 저장이 필요 없어 단순하지만, 흐름이 달라 새 인프라가 필요하고 토큰 TTL·발급 제한이 있어 택하지 않았다(나중에 다시 평가할 수 있다).

### OAuth 권한 범위를 공백으로 구분

MakeShop 은 OAuth 2.1 표준을 따르므로 권한 범위를 공백으로 구분(`store.read store.write`)해 보낸다. Cafe24 의 콤마 구분 예외([Cafe24 노드](CLE-NODE-CAFE24.md) Rationale)는 적용하지 않는다. 인가 시작 단계의 OAuth 제공자 분기에서 MakeShop 은 표준 공백 구분 경로를 탄다.

### 호스트 하나 + `shop_uid` 경로 조각

Cafe24 는 `{mall_id}.cafe24api.com` 서브도메인이지만 MakeShop 은 호스트 `connect.makeshop.co.kr` 하나에 `/api/v1/{shop_uid}/` 경로 조각을 쓴다. 상점 식별자 `shop_uid` 는 Cafe24 의 `mall_id` 와 같은 역할이다. 통합의 `mall_id` 컬럼(`credentials.shop_uid` 를 투영)에 두고, 공통 상점 식별자 부분 UNIQUE 인덱스 `idx_integration_workspace_service_mall`(`(workspace_id, service_type, mall_id)`, V072)로 중복 연결을 막는다([통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md)). 인가·토큰은 별도 호스트 `auth.makeshop.com` 을 쓴다.

### POST 요청 봉투 미적용

Cafe24 POST·PUT 은 `{request:{...}}` 봉투가 필수지만 MakeShop 은 평평한 JSON 본문을 받는다(카탈로그의 requestBody 스키마가 모두 평평한 객체다). 그래서 `MakeshopApiClient` 에 봉투 래퍼를 두지 않는다. 운영 전에 다시 검증한다(코드 `VERIFY`). 일부 operation 이 별도 래퍼를 요구하면 그 operation 메타데이터에 표시하고 래퍼 정책을 다시 본다.

### 별도 승인 미도입

Cafe24 는 일부 권한 범위·operation 이 파트너 별도 승인 대상이라 `restrictedApproval` 메타데이터, [Cafe24 별도 승인 scope](CLE-C24-SCOPES) 명단, UI ⚠ 라벨을 둔다. MakeShop 에는 권한 범위·operation 단위 별도 승인 단계가 없다. 앱 심사(ShopStore 등록) 때 요청한 권한 범위 전체를 한꺼번에 검토할 뿐이다. 그래서 MakeShop 에는 `restrictedApproval` 메타데이터, 별도 승인 명단 문서, ⚠ 라벨을 두지 않는다. 심사 거절과 권한 범위 변경 재심사는 앱 등록 운영의 영역이다.

### CPIK webhook 범위 분리

CPIK 섹션의 webhook 11개(`event_code` 기반 상품·주문·배송·카테고리 변경 이벤트)는 호출형 REST 가 아니라 이벤트 수신(트리거) 정의다. 이 노드(호출형)와 내부 MCP 브리지(도구)의 범위 밖이며 워크플로우 트리거에 해당한다. Cafe24 에도 아직 수신 webhook 트리거가 없어 둘을 함께 다루는 통합 공통 webhook·트리거를 별도 후속 과제로 나눴다. MakeShop 쪽 webhook **구독 등록 API** 는 아직 문서화되지 않았다. 후속 작업 전에 파트너센터 확인이 먼저다.

### 통합 파생 필드 계산을 서비스 레지스트리로 일반화

MakeShop 은 두 번째 OAuth 리프레시 통합이라 Cafe24 전용으로 하드코딩돼 있던 `IntegrationDto` 파생 필드(`autoRefresh`·`appUrl`) 계산을 서비스 레지스트리 기반의 서비스별 계산으로 일반화했다(Cafe24 백로그 C-6). MakeShop 은 `autoRefresh=true`(auth-code + refresh)이며, ShopStore 설치 App URL 이 있으면 `appUrl` 도 레지스트리 함수로 계산한다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md), [통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md)).
