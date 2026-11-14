---
id: "CLE-NODE-CAFE24"
title: "Cafe24 노드"
type: "feature"
version: 9
status: "approved"
requirements: ["REQ-CAFENODE-001", "REQ-CAFENODE-002", "REQ-CAFENODE-003", "REQ-CAFENODE-004", "REQ-CAFENODE-005", "REQ-CAFENODE-006", "REQ-CAFENODE-007", "REQ-CAFENODE-008", "REQ-CAFENODE-009", "REQ-CAFENODE-010", "REQ-CAFENODE-011", "REQ-CAFENODE-012", "REQ-CAFENODE-013", "REQ-CAFENODE-014", "REQ-CAFENODE-015", "REQ-CAFENODE-016", "REQ-CAFENODE-017", "REQ-CAFENODE-018", "REQ-CAFENODE-019", "REQ-CAFENODE-020", "REQ-CAFENODE-021", "REQ-CAFENODE-022", "REQ-CAFENODE-023", "REQ-CAFENODE-024", "REQ-CAFENODE-025", "REQ-CAFENODE-026", "REQ-CAFENODE-027", "REQ-CAFENODE-028", "REQ-CAFENODE-029", "REQ-CAFENODE-030", "REQ-CAFENODE-031", "REQ-CAFENODE-032", "REQ-CAFENODE-033", "REQ-CAFENODE-034", "REQ-CAFENODE-035", "REQ-CAFENODE-036", "REQ-CAFENODE-037", "REQ-CAFENODE-038", "REQ-CAFENODE-039", "REQ-CAFENODE-040", "REQ-CAFENODE-041", "REQ-CAFENODE-042", "REQ-CAFENODE-043", "REQ-CAFENODE-044", "REQ-CAFENODE-045", "REQ-CAFENODE-046", "REQ-CAFENODE-047", "REQ-CAFENODE-048", "REQ-CAFENODE-049"]
basis_superseded: false
parent: "CLE-NODE-INT"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT"]
area: "CLE-NODE-INT"
content_hash: "4e98c3f609c1c9ffa3d47c38287a482c9c73c4e791965d3c99b0c9df9a0a45de"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/4-nodes/4-integration/4-cafe24.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "cb8b8082cb41a3aeb7a3f9f0e404f82caffc0b54fc05e684e5b5da747b12811c"
etag: "sha256-682bce7d6ba2bc179b3a6c03daf850099983e46e42925ff10c559b082e01c872"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/4-integration/4-cafe24.md`, `spec/4-nodes/_product-overview.md` (§7.4) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Cafe24 노드(`cafe24`)는 한국 이커머스 SaaS [Cafe24](https://developers.cafe24.com/docs/ko/api/admin/) 의 Admin API 를 부르는 서비스 특화 통합 노드다. 같은 통합을 AI 에이전트에 도구로 붙이면 LLM 도 같은 API 를 부를 수 있다.

- **사용자 가치**: 쇼핑몰 운영자가 상품·주문·회원·프로모션 등 Admin API operation 을 워크플로우 노드 하나로 부른다. 같은 통합을 AI 에이전트에 도구로 주면 LLM 이 "어제 미발송 주문 가져와줘" 같은 자연어 요청을 처리한다.
- **지원 범위**: Cafe24 Admin API 의 Cafe24 리소스(`Cafe24Resource`) 18개 전부다. operation 목록과 구현 상태, 전체 수는 [Cafe24 API 카탈로그](CLE-C24-CATALOG)가 정한다. operation 수가 많아서 AI 에이전트에 내부 MCP 브리지로 노출할 때는 노출 도구 목록(`enabledTools`)으로 좁히는 것이 사실상 필수다([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 도구 정의 예산).
- **이중 활용**: Cafe24 는 "통합 하나가 워크플로우 캔버스 노드와 AI 에이전트 MCP 도구에 동시에 노출되는" 첫 사례다. `Cafe24McpToolProvider`(도구 프로바이더 `AgentToolProvider` 구현체)가 이 노드와 같은 메타데이터 테이블에서 도구 목록을 만든다([AI 에이전트 노출](CLE-NODE-CAFE24-AGENT.md)).

통합 노드 공통 규약은 [통합 노드 공통](CLE-NODE-INT-COMMON.md)이 정한다. 다음은 다른 문서가 정한다.

- operation 메타데이터 형식, Cafe24 요청 봉투, KST 시간대 규약, 카탈로그 키, MCP 도구 설명 조립: [Cafe24 operation 메타데이터](CLE-C24-META)
- operation 목록: [Cafe24 API 카탈로그](CLE-C24-CATALOG)와 리소스별 문서([설정](CLE-NODE-CAFE24-CONFIG.md#설정) 표)
- 별도 승인이 필요한 권한 범위·operation 명단과 안내 문구: [Cafe24 별도 승인 scope](CLE-C24-SCOPES)
- OAuth 연결, Public·Private 앱 설치의 사용자 흐름, 토큰 자동 갱신 정책: [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md). 갱신 진입점과 큐 dedup: [OAuth 연결과 토큰 갱신 §갱신 큐](../CLE-INT/CLE-INT-OAUTH.md#갱신-큐). 설치 엔드포인트의 HMAC 알고리즘·Redis 키·상수는 이 문서의 하위 문서 [Cafe24 노드 — 앱 설치 엔드포인트](CLE-NODE-CAFE24-INSTALL.md)가 정한다
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
- REQ-CAFENODE-031 WHEN 통합을 얻은 뒤 외부 호출이 끝나면 THE SYSTEM SHALL 성공·실패와 관계없이 활동 로그를 1건 남긴다.
- REQ-CAFENODE-032 WHEN 활동 로그를 남기면 THE SYSTEM SHALL `api_label` 을 `cafe24.<resource>.<operation>`, `api_method` 를 operation method, `api_path` 를 치환 전 path 템플릿으로 채운다.
- REQ-CAFENODE-033 WHEN 노드가 dry-run 으로 실행되고 operation method 가 GET 이 아니거나 operation 이 상태를 바꾸는 GET 예외 목록에 있으면 THE SYSTEM SHALL 실제 호출 없이 모의 출력으로 `success` 포트에 보낸다.
- REQ-CAFENODE-034 WHEN 노드가 dry-run 으로 실행되고 operation method 가 GET 이며 상태를 바꾸는 GET 예외 목록에 없으면 THE SYSTEM SHALL 실제로 호출한다.
- REQ-CAFENODE-035 WHEN 노드 실행이 dry-run 으로 모의 출력을 돌려주면 THE SYSTEM SHALL 활동 로그를 남기지 않는다.
- REQ-CAFENODE-036 WHEN 내부 MCP 브리지가 도구를 만들면 THE SYSTEM SHALL 모든 도구 설명 끝에 KST 시간대 안내 한 줄을 붙인다.
- REQ-CAFENODE-037 WHEN 내부 MCP 브리지가 capability 를 보고하면 THE SYSTEM SHALL `tools` 만 보고하고 `resources`·`prompts` 는 보고하지 않는다.
- REQ-CAFENODE-038 WHEN AI 에이전트의 노출 도구 목록을 저장하면 THE SYSTEM SHALL bare operation id 배열로 저장한다.
- REQ-CAFENODE-039 WHEN AI 에이전트가 내부 MCP 브리지로 Cafe24 API 를 실제로 부르면 THE SYSTEM SHALL 호출 시점의 AI 에이전트 노드 실행으로 활동 로그를 남긴다.
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

## 하위 문서

| 문서 | 맡는 내용 | 요구사항 |
|------|-----------|----------|
| [Cafe24 노드 — 설정과 출력](CLE-NODE-CAFE24-CONFIG.md) | 설정 필드, 리소스 표, 설정 화면, 포트, 캔버스 요약, 출력 구조, 에러 코드, 401·403 인증 실패 처리 | REQ-CAFENODE-003, 004, 006, 007, 008, 009, 010, 011, 012, 015, 024, 025, 026, 027, 028, 029, 030 |
| [Cafe24 노드 — 실행 로직](CLE-NODE-CAFE24-EXEC.md) | 실행 12단계, dry-run, 호출 제한, 시간대 | REQ-CAFENODE-001, 002, 013, 014, 016, 017, 018, 019, 020, 021, 022, 023, 031, 032, 033, 034, 035 |
| [Cafe24 노드 — AI 에이전트 노출](CLE-NODE-CAFE24-AGENT.md) | 내부 MCP 브리지 도구 이름·capability·노출 도구 목록·활동 로그·만료된 통합 처리 | REQ-CAFENODE-005, 036, 037, 038, 039, 040, 041, 042 |
| [Cafe24 노드 — 앱 설치 엔드포인트](CLE-NODE-CAFE24-INSTALL.md) | Private 앱 App URL 의 Redis 키·HMAC 검증·재전송 방지·실패 제한·식별 전략·상수, OAuth 권한 범위 구분자 | REQ-CAFENODE-043, 044, 045, 046, 047, 048, 049 |

## 설정 화면

→ [설정과 출력](CLE-NODE-CAFE24-CONFIG.md#설정-화면)

## dry-run

→ [실행 로직](CLE-NODE-CAFE24-EXEC.md#dry-run)

## 호출 제한

→ [실행 로직](CLE-NODE-CAFE24-EXEC.md#호출-제한)

## 에러 코드

→ [설정과 출력](CLE-NODE-CAFE24-CONFIG.md#에러-코드)

## 인증 실패 처리

→ [설정과 출력](CLE-NODE-CAFE24-CONFIG.md#인증-실패-처리)

## AI 에이전트 노출

→ [AI 에이전트 노출](CLE-NODE-CAFE24-AGENT.md#ai-에이전트-노출)

### 노출 도구 목록 화면

→ [AI 에이전트 노출](CLE-NODE-CAFE24-AGENT.md#노출-도구-목록-화면)

### 만료된 통합의 도구 목록 처리

→ [AI 에이전트 노출](CLE-NODE-CAFE24-AGENT.md#만료된-통합의-도구-목록-처리)

## Private 앱 설치 엔드포인트

→ [앱 설치 엔드포인트](CLE-NODE-CAFE24-INSTALL.md#private-앱-설치-엔드포인트)

### HMAC 검증 알고리즘

→ [앱 설치 엔드포인트](CLE-NODE-CAFE24-INSTALL.md#hmac-검증-알고리즘)

## 미결 사항

- **403(권한 범위 부족) 때 노드 출력 에러 코드**: 이 노드 원문은 403 을 `output.error.code = CAFE24_AUTH_FAILED` 로 내보내고 통합 상태를 `error(auth_failed)` 또는 `error(insufficient_scope)` 로 바꾼다고 적는다. 통합 화면 쪽 원문과 [Cafe24 별도 승인 scope](CLE-C24-SCOPES)는 노드 실행 중 403 이 `INSUFFICIENT_SCOPE` 코드와 `details.missingScopes`·`requiresCafe24Approval` 을 낸다고 적는다. 이 노드 원문의 별도 승인 Rationale 은 `details.requiresCafe24Approval` 만 전제한다. 현재 구현은 API 클라이언트에 `CAFE24_INSUFFICIENT_SCOPE` 코드가 있고 `requiresCafe24Approval` 을 통합의 `last_error.details` 에 싣는 것으로 보이나, 노드 출력으로 어떤 코드가 나가는지는 확인되지 않았다. 워크플로우 작성자가 분기할 코드와 `requiresCafe24Approval` 이 실리는 자리를 정해야 한다(관련: [통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md)). 같은 충돌이 [통합 관리 미결 사항](../CLE-INT/CLE-INT-MANAGE.md#미결-사항)에 올라 있다.
- **만료된 통합의 도구 목록 자가 회복**: 이 노드 원문은 `buildTools()` 가 `expired` 행에 큐 경유 토큰 갱신을 걸면 갱신 worker 가 통합을 `connected` 로 되돌려 정상 도구 목록을 받는다고 적는다. [통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md) 원문은 갱신 worker 가 source 와 무관하게 `status !== 'connected'` 행을 건너뛴다고 적고(현재 구현 `cafe24-token-refresh.processor.ts` 의 상태 가드와 같음), 같은 문서의 상태도에는 MCP 브리지 자가 회복으로 `expired → connected` 가 된다고 적어 자기모순이다. 만료된 통합이 AI 에이전트에서 되살아나는지가 여기에 달려 있다. 자가 회복 서술을 지울지, worker 가드에 예외를 설계할지 결정 필요(관련: [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md), [MakeShop 노드](CLE-NODE-MAKESHOP.md)도 같은 정책을 따른다). 같은 충돌이 [통합 상태와 만료 알림 미결 사항](../CLE-INT/CLE-INT-STATUS.md#미결-사항)에 올라 있다.

## 구현 위치

- `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts`
- `codebase/backend/src/nodes/core/dry-run.util.ts` (dry-run 부수효과 판정 `isDryRunMockedOperation`)
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

operation 규모는 초기 추정치("총 약 180개")와 달리 2026-07-17 실측(카탈로그 supported 행과 백엔드 메타데이터를 양방향으로 맞추는 동기 검사 기준)으로 485개였다. 단순 `grep -c supported` 는 설명·예시 행이 섞이므로 status 컬럼 기준으로 센다. 이 정정은 "노드 하나" 결정을 뒤집지 않고 오히려 논거를 강하게 한다. 현재 수는 [Cafe24 API 카탈로그](CLE-C24-CATALOG)가 단일 기준이다.

### 메타데이터를 두는 자리

메타데이터 **형식**은 [Cafe24 operation 메타데이터](CLE-C24-META)가 정하고 실제 행은 백엔드 메타데이터 모듈(`codebase/backend/src/nodes/integration/cafe24/metadata/*.ts`)에 있다. operation 목록(구현됨·예정·폐기)은 [Cafe24 API 카탈로그](CLE-C24-CATALOG)에 리소스 단위로 나눠 둔다. 카탈로그와 백엔드 메타데이터는 카탈로그 동기 검사(`catalog-sync.spec.ts`)가 양방향으로 지킨다. 새 operation 을 더하려면 카탈로그 행 갱신과 메타데이터 행 추가가 같은 PR 에 있어야 CI 를 통과한다. 이 문서는 operation 목록을 본문에 되풀이하지 않는다. 어긋남을 막기 위해서다.

### 요구사항 변경 (2026-10-23 · 2026-10-24)

근거는 [실행 로직 Rationale](CLE-NODE-CAFE24-EXEC.md#dry-run-모의-출력에-활동-로그를-남기지-않는다-2026-10-23)에 있다.

- 2026-10-23: REQ-CAFENODE-035 는 «dry-run 으로 mock 결과를 돌려주면 활동 로그를 1건 남긴다» 에서 «남기지 않는다» 로 바꿨다. REQ-CAFENODE-033 · REQ-CAFENODE-034 는 상태를 바꾸는 GET 예외 목록을 판정에 더했다. REQ-CAFENODE-039 는 실제로 부른 호출로, REQ-CAFENODE-031 은 외부 호출로 범위를 좁혔다.
- 2026-10-24: REQ-CAFENODE-031 은 «외부 호출이 끝나면» 에서 «통합을 얻은 뒤 외부 호출이 끝나면» 으로 범위를 좁혔다. 근거는 [통합 노드 공통](CLE-NODE-INT-COMMON.md#남의-개인-통합-조회는-없는-통합과-같게-실패한다-2026-10-24) Rationale(REQ-INTMGMT-053)이다.
