---
id: "CLE-INT-MCP"
title: "MCP 클라이언트"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT"
ancestors: ["CLE-VISION", "CLE-INT"]
area: "CLE-INT"
content_hash: "edc1012415839aff06b2b39e2b783685ffe141d7aed39c51eab71086e79f378a"
read_as: "approved_fallback"
task: "CLE-T-RGZBCQ"
source_paths: ["spec/5-system/11-mcp-client.md"]
mirror_sha256: "96d6903dfdb7440f416d492ebcb9564221aa58ea3a87be867199fcccc4e0db8e"
etag: "sha256-9d25d1029c43042219804dfcf022e727c9d4ba3e2053d16565f296a24dedcb42"
---
> 구현 상태: 구현됨 · 원문: `spec/5-system/11-mcp-client.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

MCP 클라이언트(MCP client)는 AI 에이전트 노드가 외부 [Model Context Protocol](https://modelcontextprotocol.io)(MCP) 서버의 능력(Tools·Resources·Prompts)을 LLM 도구 호출 인터페이스로 쓰게 하는 추상화 계층이다.

AI 에이전트 노드 핸들러는 도구 프로바이더(`AgentToolProvider`) 구현체에서 MCP 도구를 받는다. 외부 서버용 구현체는 `McpToolProvider` 이고, 그 아래에서 `McpClientService` 모듈이 MCP 프로토콜 통신을 맡는다. 백엔드 안에서 도는 내부 MCP 브리지(Internal MCP Bridge) 구현체는 `Cafe24McpToolProvider` 와 `MakeshopMcpToolProvider` 다. 외부 프로토콜·인증·세션은 모두 이 계층 안에 숨기므로 AI 에이전트 핸들러는 지식 저장소 검색과 같은 추상화로 MCP 도구를 다룬다.

범위는 다음과 같다.

- LLM 이 스스로 도구를 호출할 때만 부른다. 지식 저장소 도구와 같고, 핸들러가 미리 채워 넣지 않는다.
- MCP 서버는 워크스페이스 공용 자원이다. 사용자 개인 MCP 서버는 범위 밖이다.
- transport 는 외부 서버용 Streamable HTTP(SSE)와 내부 모듈용 내부 MCP 브리지 두 가지다. stdio·websocket 은 지원하지 않는다.

MVP 에 넣지 않은 것은 다음과 같다.

- stdio MCP 서버 spawn (멀티테넌트 SaaS 에서 프로세스·보안 격리 부담)
- MCP `prompts/get` 결과를 systemPrompt 자리에 고정해 넣는 UX
- MCP server-to-server proxy 와 응답 캐싱 계층
- MCP 서버 헬스체크 전용 cron (만료 스캐너의 `token_expires_at` 흐름도 쓰지 않는다)

다른 문서가 정하는 것은 다음과 같다.

- MCP 서버 통합의 자격 증명 필드(`url`·`default_headers`·인증 유형별 필드): [서비스별 인증 방식과 자격 증명](CLE-INT-AUTH.md#mcp-서버)
- AI 에이전트 노드의 `mcpServers` 설정 필드 구조(`McpServerRef`): [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md#mcp-서버-연결-ai-에이전트-전용)
- AI 에이전트 도구 이름 접두어 분류 전체(`kb_`·`cond_`·`mcp_`·`render_`): [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md#도구-이름-규칙)
- Cafe24·MakeShop operation 메타데이터와 도구 description 조립: [Cafe24 operation 메타데이터](CLE-C24-META), [MakeShop operation 메타데이터](CLE-MKS-META)
- 통합 상태 전이 전체: [통합 상태와 만료 알림](CLE-INT-STATUS.md)
- 활동 로그 컬럼과 API 식별 채우기 규칙: [통합 데이터와 흐름](CLE-INT-DATA.md#호출-api-식별-채우기-규칙)
- 도구 프로바이더 확장 지점(첫 구현체 `KbToolProvider`): [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md#확장-지점)

## Transport

두 transport 를 지원한다. 외부 서버용 HTTP transport 와 내부 모듈용 내부 MCP 브리지다. 둘 다 도구 프로바이더 구현체로 노출되므로 AI 에이전트 핸들러는 둘의 차이를 신경 쓰지 않는다. `McpClientService` 가 MCP 프로토콜 통신을 맡는 것은 외부 HTTP transport 뿐이다.

```mermaid
flowchart LR
  A[AI 에이전트 핸들러] --> P1[McpToolProvider]
  P1 --> C[McpClientService]
  C -->|Streamable HTTP| S[외부 MCP 서버]
  A --> P2[Cafe24McpToolProvider]
  P2 --> K[Cafe24ApiClient]
  K --> KA[Cafe24 Admin API]
  A --> P3[MakeshopMcpToolProvider]
  P3 --> M[MakeshopApiClient]
  M --> MA[MakeShop Shop API]
```

그림의 위쪽 경로가 외부 HTTP transport 이고, 아래 두 경로가 내부 MCP 브리지다. 내부 MCP 브리지는 MCP 프로토콜 대신 각 통합의 API 클라이언트를 직접 함수로 부른다.

### Streamable HTTP (외부 서버)

`service_type='mcp'` 통합에 적용한다. MCP 의 Streamable HTTP transport 만 지원한다.

| 항목 | 동작 |
|------|------|
| 엔드포인트 | 통합 `credentials.url` 의 단일 URL. 클라이언트 → 서버는 `POST`, 서버 → 클라이언트는 `GET` + `text/event-stream` |
| 세션 | 서버가 `Mcp-Session-Id` 응답 헤더로 발급하면 이후 모든 요청에 같은 헤더를 되돌려 보낸다. 발급하지 않으면 stateless 모드다 |
| 프로토콜 버전 | 클라이언트 SDK 가 협상한다. 서버가 지원하지 않는 버전을 거부하면 connect 단계 실패로 보고 `MCP_CONNECT_FAILED` 로 처리한다([에러 코드](#에러-코드)) |
| 인증 | HTTP 헤더. 인증 유형별 매핑은 [서비스별 인증 방식과 자격 증명](CLE-INT-AUTH.md#mcp-서버) |

### stdio 를 지원하지 않는 이유

- 멀티테넌트 백엔드에서 사용자마다 subprocess 를 spawn 하는 비용과 보안 부담이 크다.
- 임의 명령 실행 권한이 드러날 위험이 있다.
- 워크스페이스 공용 자원 모델과 맞지 않는다.

데스크톱 브리지 에이전트 같은 우회 경로로 stdio 서버를 노출하는 방안은 별도 스펙으로 나눈다.

### 내부 MCP 브리지

일부 first-party 통합은 외부 MCP 서버 없이 백엔드 프로세스 안의 모듈로 MCP 인터페이스를 노출한다. 같은 통합을 워크플로우 노드와 AI 에이전트 노드 양쪽에서 쓰는 경우의 표준 패턴이다.

| 항목 | 동작 |
|------|------|
| 적용 `service_type` | 지금은 `cafe24`, `makeshop`. 앞으로 다른 first-party 통합(예: Shopify, Naver Smartstore)도 같은 패턴을 쓸 수 있다 |
| 구현 형태 | 백엔드 모듈이 도구 프로바이더 인터페이스를 직접 구현한다(`Cafe24McpToolProvider`, `MakeshopMcpToolProvider`). HTTP fetch 가 아니라 직접 함수 호출이다 |
| connect · initialize | no-op. 메모리 안에서 바로 쓸 수 있고 `capabilities`·`serverInfo` 는 정적 상수다 |
| 세션 | 노드 실행 단위 mutex 만 쓴다. `Mcp-Session-Id` 헤더가 필요 없다 |
| 인증 | 통합 자체 인증(예: Cafe24 OAuth)을 그대로 쓴다. 외부 서버용 `credentials.url`·`auth_type` 규칙은 적용하지 않는다 |
| SSRF 검증 | 적용하지 않는다. 외부 fetch 가 없다. base URL 의 안전성은 통합의 `service_type` 별 로직(예: Cafe24 의 `mall_id` 유효성 검사)이 맡는다 |
| 호출 제한(rate limit) | 통합 자체 래퍼(예: Cafe24 의 `Cafe24ApiClient`)가 처리한다. 같은 프로세스 인스턴스 안에서는 mutex 로 노드 호출과 공유한다 |

- **도구 노출**: [도구 노출 모델](#도구-노출-모델)의 일반 규칙을 그대로 쓴다. `Cafe24McpToolProvider.buildTools()` 는 Cafe24 메타데이터 테이블에서 자동으로 만든 도구 목록(`ToolDef[]`)을 돌려준다([Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md#ai-에이전트-노출), [Cafe24 operation 메타데이터](CLE-C24-META)). MakeShop 도 같은 방식이다([MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#ai-에이전트-노출), [MakeShop operation 메타데이터](CLE-MKS-META)).
- **capability 보고**: 브리지마다 보고하는 capability 가 다를 수 있다. Cafe24 는 `tools` 만 보고하고 `resources`·`prompts` 는 보고하지 않는다. 그래서 AI 에이전트 노드는 [노출 규칙](#노출-규칙)에 따라 메타 도구를 만들지 않는다.
- **에러 처리**: [에러 처리](#에러-처리)의 규칙을 그대로 쓴다. Cafe24 의 `tool_result.error.code` 는 [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md#에러-코드) 에러 어휘(`CAFE24_AUTH_FAILED` 등)를 그대로 쓴다. 호출 단계 실패(API 4xx·5xx, 전송 실패)는 `tool_result.error` 와 [활동 로그](#활동-로그)에 더해 `mcpDiagnostics.errors[]` 에도 같은 어휘와 `phase='tools/call'` 로 쌓인다(`AgentToolResult.mcpErrorDelta` 경유). 도구 목록 구성 단계의 `errors[]`(connect·`tools/list`)는 외부 `McpToolProvider` 전용이다. 내부 MCP 브리지의 도구 목록 구성 실패는 `serverSummaries[]` 의 `skipped(skipReason)` 로 드러난다. 즉 내부 MCP 브리지에서 `errors[]` 는 호출 단계 표면이다.
- **인증 실패**: 내부 MCP 브리지도 [인증 실패 상태 전환](#인증-실패-상태-전환) 정책을 따른다. 단 refresh token 이 있는 프로바이더(예: Cafe24)의 401 에는 [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md#인증-실패-처리)의 «토큰 갱신 + 1회 재시도» 자가 회복 정책을 먼저 적용한다. 재시도도 401 이면 그때 같은 방식으로 격하한다. 403 은 언제나 즉시 격하한다. MakeShop 클라이언트도 같은 방식이다([통합 상태와 만료 알림](CLE-INT-STATUS.md#상태-전이)).
- **브리지별 description 접미**: 내부 MCP 브리지는 자기 `service_type` 에 특화된 정보를 도구 description 끝에 자동으로 붙일 수 있다. Cafe24 는 `(Cafe24 <method> <path>)` 한 줄과 KST 시간대 안내 `CAFE24_TIMEZONE_SUFFIX` 를 붙인다. operation 메타데이터에 `constraints?` 가 있으면 그 사이에 제약 종류별로 한 줄씩(예: `Constraint: at least one of …`) 넣는다. 조립 순서와 종류별 문구 형식은 [Cafe24 operation 메타데이터](CLE-C24-META#2-operation-메타데이터-형식) 의 `constraints` 의미 절과 [description 자동 접미 절](CLE-C24-META#53-mcp-도구-description-자동-접미)이 함께 정한다. 외부 HTTP transport 는 서버가 보고한 description 을 그대로 쓰고, 끝에 출처 한 줄만 붙인다([일반 도구](#일반-도구-tools)).

## 통합 모델

MCP 서버는 새 노드가 아니라 기존 통합 엔티티의 새 `service_type` 으로 등록한다([통합 데이터와 흐름](CLE-INT-DATA.md#통합-integration)). 별도 테이블이나 컬럼을 더하지 않는다.

### service_type 과 인증 유형

이 절의 `service_type='mcp'` 와 통합 인증 유형(`auth_type`)·자격 증명 규칙은 외부 HTTP transport 에만 적용한다. 내부 MCP 브리지로 노출하는 `service_type` 은 자체 인증 모델을 쓴다.

| 필드 | 값 (외부 HTTP) |
|------|----|
| `Integration.service_type` | `mcp` |
| `Integration.auth_type` | `bearer_token` / `api_key` / `none` |
| `Integration.scope` (공개 범위) | 기본 `organization`. 개인 공개 범위 등록을 허용하는지는 정의가 갈린다. [통합 관리](CLE-INT-MANAGE.md#미결-사항) 의 미결 사항 참조 |

내부 MCP 브리지를 쓰는 `service_type` 은 지금 다음 두 가지다.

| `service_type` | 브리지 구현 | 문서 |
|---|---|---|
| `cafe24` | `Cafe24McpToolProvider` | [Cafe24 노드 §AI 에이전트 노출](../CLE-NODE-INT/CLE-NODE-CAFE24.md#ai-에이전트-노출) |
| `makeshop` | `MakeshopMcpToolProvider` | [MakeShop 노드 §AI 에이전트 노출](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#ai-에이전트-노출) |

### 자격 증명과 URL 검증

자격 증명(`credentials`) 필드는 [서비스별 인증 방식과 자격 증명](CLE-INT-AUTH.md#mcp-서버) 이 정한다. 요약하면 공통 `url`(https, 필수)·`default_headers` 와 인증 유형별 `token`(🔒) 또는 `header_name`·`value`(`value` 만 🔒)다. 비밀 필드는 모두 AES-256-GCM 으로 암호화한다([통합 데이터와 흐름](CLE-INT-DATA.md#암호화)).

URL 검증과 SSRF 차단은 외부 HTTP transport 에만 적용한다. 내부 MCP 브리지는 외부 fetch 가 없어 적용하지 않는다.

1. `url` 은 HTTPS 만 받는다. 연결 테스트에서 `https://` 로 시작하는지 확인하고, 아니면 `MCP_HTTPS_REQUIRED` 를 낸다.
2. 호스트가 다음 중 하나이면 같은 코드(`MCP_HTTPS_REQUIRED`)로 막는다.
   - loopback(`127.0.0.0/8`, `::1`), link-local(`169.254.0.0/16`, `fe80::/10`)
   - RFC 1918 사설 대역(`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
   - IPv6 unique-local(`fc00::/7`)
   - 클라우드 메타데이터 호스트 이름(`metadata.google.internal`, `metadata.azure.com` 등)
3. 호스트 이름이 IP literal 이 아니면 DNS 결과를 기다려 바로 막지는 않는다. connect 단계에서 SDK 가 실제로 fetch 할 때 사설망 IP 로 풀리더라도 transport 가 같은 검증을 한 번 더 한다.
4. 이 규칙은 MCP 등록 단계에서 일관되게 적용한다. 다른 아웃바운드 경로의 SSRF 가드는 [HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md#실행-로직)와 [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md#ssrf-가드)에 있다.

**로컬 개발용 우회 플래그**: 환경 변수 `MCP_ALLOW_INSECURE_URL=true` 가 켜지면 다음이 바뀐다.

- `http://` URL 을 받는다. `file://`·`ws://` 같은 다른 scheme 은 여전히 거부한다.
- 위 SSRF 호스트 차단 목록 전체를 건너뛴다(loopback·RFC 1918·클라우드 메타데이터 모두 등록 가능).

이 플래그는 운영 환경에서 절대 켜면 안 된다. 워크스페이스 관리자가 등록한 URL 을 그대로 믿게 되어 SSRF 방어면이 다시 열린다. 기본값은 `false` 이고 `codebase/backend/.env.example` 에 경고와 함께 적는다.

**운영 환경 가드**: `NODE_ENV=production` 에서 `MCP_ALLOW_INSECURE_URL=true` 이면 부팅을 거부한다(`main.ts` 의 `assertProductionConfig`, `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 와 같은 형태). 부팅 가드 전체 목록은 [세션과 토큰 「운영 환경 가드」](../CLE-ACCT/CLE-ACCT-SESSION.md#운영-환경-가드) 에 있다. 셀프 호스팅(VPC 내부 호스트 등)에 정당한 용도가 있는 `ALLOW_PRIVATE_HOST_TARGETS`(HTTP Request·Database Query·Send Email 통합 노드 SSRF 가드의 공통 플래그, [HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md#실행-로직))는 정책이 달라 throw 가 아니라 warn 으로 둔다. 운영에서 켜져 있으면 부팅은 하되 경고 로그를 남긴다. 분류 기준은 «절대 금지» 플래그는 throw, «정당한 용도가 있는» 플래그는 warn 이다.

### 환경 변수

| 변수 | 기본값 | 뜻 |
|------|--------|----|
| `MCP_MAX_CONCURRENT_CONNECTIONS` | 20 | 워크스페이스 단위 동시 connect 상한. 외부 HTTP transport 만 센다 |
| `MCP_CONNECT_TIMEOUT_MS` | 미설정 시 [타임아웃](#타임아웃) 기본값 | connect 타임아웃을 바꾼다 |
| `MCP_ALLOW_INSECURE_URL` | `false` | 로컬 개발용 우회 플래그. 운영에서 켜면 부팅 거부 |

`McpClientService` 는 이 세 변수를 `process.env` 로 직접 읽지 않는다. ConfigService 의 `mcp.*` namespace(`registerAs('mcp')`, `common/config/mcp.config.ts`)를 거친다. 서비스 계층의 환경 변수 접근을 한곳에 모으기 위해서다. `MCP_ALLOW_INSECURE_URL` 의 단일 출처는 `McpClientService.allowInsecureUrl` getter 이고, `McpToolProvider` 는 주입받은 인스턴스로 같은 값을 쓴다. 부팅 시점 값이라 바꾸면 재기동해야 반영된다.

### capabilities 캐시를 두지 않는다

`credentials.cached_capabilities` 캐시는 채택하지 않는다(비채택, 2026-07-16). 노드 설정 화면의 미리보기는 매번 live `initialize` 결과([연결 테스트](#연결-테스트))를 쓰는 지금 방식이 정식 경로다. 이유와 재개 조건은 [Rationale](#capabilities-캐시를-채택하지-않는다-r-wontdo-cached-capabilities) 에 있다.

## 연결 수명

### 단위

AI 에이전트 노드 실행 1회가 MCP 세션 1회다. 노드 실행이 시작되면 `mcpServers` 에 등록된 통합마다 필요할 때 연결하고, 노드 실행이 끝나거나 멀티턴이 입력 대기(`waiting_for_input`)에 들어가면 닫는다.

| 시점 | 동작 |
|------|------|
| AI 에이전트 `execute` 진입 | `mcpServers` 목록만 조회한다. 연결은 미룬다 |
| `buildTools` 첫 호출 | 서버마다 connect → `initialize` → capability 검사 → `tools/list`. `resources`·`prompts` capability 를 보고하면 각 list 도 부른다 |
| LLM 이 `mcp_*` 도구 호출 | 같은 세션에서 `tools/call` 또는 메타 도구 RPC 를 부른다 |
| 노드 종료 또는 입력 대기 진입 | 모든 세션을 닫는다. 재개할 때 `mcpServers` 설정으로 결정적으로 다시 연결한다 |
| 같은 노드 멀티턴의 N+1 턴 | 입력 대기에 들어가지 않은 메모리 안 턴이면 같은 세션을 유지한다 |

### 재연결과 재개

멀티턴 AI 에이전트가 입력 대기로 멈추면 세션을 닫는다. 사용자 메시지를 받아 재개할 때 같은 `mcpServers` 로 새 세션을 만든다. 세션 ID 와 capability 목록은 재개 때 다시 조회해도 안전하게 설계했고, AI 에이전트 내부 상태(`messages` 등)는 영향을 받지 않는다.

### 동시성과 풀링

한 노드 실행 안에서 한 서버로의 connect 는 한 번만 일어난다(`(integrationId, executionId)` 캐시). 노드 사이나 실행 사이에는 세션을 공유하지 않는다. 사용자 격리와 세션 수명을 단순하게 두려고 일부러 풀을 키우지 않는다. 워크스페이스 단위 동시 connect 수는 `MCP_MAX_CONCURRENT_CONNECTIONS`(기본 20)로 제한한다.

내부 MCP 브리지에서는 connect·`initialize`·close 가 모두 no-op 이다. `buildTools` 는 메타데이터 테이블로 도구 목록을 메모리에서 바로 만들고, `tools/call` 은 직접 함수 호출이다. `(integrationId, executionId)` 캐시 규칙은 같이 적용한다(브리지 인스턴스가 같은 실행 안에서 한 번 lazy init). `MCP_MAX_CONCURRENT_CONNECTIONS` 는 외부 HTTP transport 만 세고 내부 MCP 브리지에는 따로 상한이 없다.

### 타임아웃

| 단계 | 기본 타임아웃 |
|------|-------------|
| connect + initialize | 10s |
| `tools/list`, `resources/list`, `prompts/list` | 10s |
| `tools/call`, `resources/read`, `prompts/get` | 30s |

타임아웃은 환경 변수로 바꿀 수 있다. 넘기면 [에러 처리](#에러-처리)에 따라 격리한다.

## 도구 노출 모델

MCP 의 세 capability(Tools·Resources·Prompts)를 모두 LLM 도구 호출 인터페이스로 평탄화해 노출한다. 이렇게 하면 일관되고 단순하다.

- LLM 이 호출 시점과 인자를 스스로 정한다. 지식 저장소 검색과 같은 모델이다.
- AI 에이전트 핸들러의 도구 프로바이더 추상화를 그대로 다시 쓴다.
- 사용자 설정 화면이 «MCP 서버 추가 + 노출 도구 목록» 한 흐름으로 끝난다.

systemPrompt 에 prompt 를 고정하거나 Resource 를 지식 저장소처럼 정적 컨텍스트로 넣는 변형은 나중에 별도 스펙으로 들일 수 있다.

### 노출 규칙

서버가 `initialize` 응답에서 보고한 capability 에 따라 다음 도구를 자동으로 만든다.

| MCP capability | 노출하는 LLM 도구 | 종류 |
|----------------|-----------------|------|
| `tools` (서버가 보고) | tool 마다 1개, `mcp_<sid>__<toolName>` | 일반 도구 |
| `resources` (서버가 보고) | `mcp_<sid>__list_resources`, `mcp_<sid>__read_resource` | 메타 도구 |
| `prompts` (서버가 보고) | `mcp_<sid>__list_prompts`, `mcp_<sid>__get_prompt` | 메타 도구 |

서버가 capability 를 보고하지 않으면 그 분류의 도구는 만들지 않는다. LLM 에 노출되지 않는다.

### 도구 이름 규칙

MCP 도구는 모두 `mcp_` 접두어로 시작한다. AI 에이전트 노드의 다른 도구 접두어(`kb_`, `cond_`, `render_`)와 겹치지 않는다. 접두어 분류 전체는 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md#도구-이름-규칙) 가 정한다.

```text
mcp_<sid>__<toolName>
mcp_<sid>__list_resources
mcp_<sid>__read_resource
mcp_<sid>__list_prompts
mcp_<sid>__get_prompt
```

| 토큰 | 정의 |
|------|------|
| `<sid>` | `Integration.id`(UUID) 앞 8자에서 `[a-z0-9]` 가 아닌 문자를 `_` 로 바꾼 값. 워크스페이스 안에서 8자가 겹치면 12자로 늘린다(`McpToolProvider` 가 등록 시점에 정한다). 현재 구현과의 차이는 [미결 사항](#미결-사항) 참조 |
| `<toolName>` | MCP 서버가 `tools/list` 로 보고한 원래 이름. LLM API 호환을 위해 `[^a-zA-Z0-9_]` 를 `_` 로 바꾼다(sanitize) |
| `__` | 서버와 도구의 구분자. 밑줄 하나로는 sanitize 한 도구 이름과 나눌 수 없어 밑줄 두 개를 쓴다 |

**역파싱**: `McpToolProvider.matches(name)` 는 `name.startsWith('mcp_')` 만 본다. `execute` 단계에서 `__` 가 처음 나오는 위치로 나눠 `<sid>` 와 도구 식별자를 얻는다. 메타 도구는 식별자가 예약어(`list_resources`, `read_resource`, `list_prompts`, `get_prompt`)와 같은지로 가른다.

**접두어를 붙이는 곳**: 외부 서버 도구 이름은 `McpToolProvider` 가 만든다. 내부 MCP 브리지 프로바이더는 `buildTools()` 에서 접두어가 붙은 이름(`mcp_<sid>__<operation 토큰>`)을 직접 만들고, `execute()` 에 들어올 때 접두어를 벗겨 bare operation id 로 처리한다. 노출 도구 목록(`enabledTools`) 비교는 bare id 로 한다. MakeShop operationId 의 하이픈은 `_` 로 바꾼 토큰을 도구 이름에 쓰고, bare id(하이픈 형태)는 노출 도구 목록과 브리지 내부 `execute` 에서 그대로 쓴다([MakeShop operation 메타데이터](CLE-MKS-META#7-내부-mcp-브리지와의-매핑)). Cafe24 매핑은 [Cafe24 operation 메타데이터](CLE-C24-META#7-내부-mcp-브리지와의-매핑) 에 있다.

### 일반 도구 (Tools)

MCP `tools/list` 응답의 tool 을 하나씩 `ToolDef`([LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md#tooldef--toolcall))로 바꾼다.

```json
{
  "name": "mcp_<sid>__<sanitized_toolName>",
  "description": "<MCP tool.description>\n\n(via MCP server: <integration.name>)",
  "parameters": "<MCP tool.inputSchema>"
}
```

- `inputSchema` 는 MCP 표준 JSON Schema 다. 바꾸지 않고 LLM 의 `parameters` 로 그대로 넘긴다.
- `description` 끝에 출처(서버 별칭)를 자동으로 붙인다. 같은 뜻의 도구가 여러 서버에 있을 때 LLM 이 출처를 구분할 수 있게 하려는 것이다.

**사용자 덮어쓰기(선택)**: AI 에이전트 설정의 `mcpServers[].toolOverrides[]`([AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md#mcp-서버-연결-ai-에이전트-전용))로 도구별 description 을 바꿀 수 있다. 이름은 호환성 때문에 바꿀 수 없다.

### Resources 메타 도구

서버가 `resources` capability 를 보고할 때만 두 도구를 더한다.

```json
{
  "name": "mcp_<sid>__list_resources",
  "description": "List available resources on MCP server \"<integration.name>\".",
  "parameters": {
    "type": "object",
    "properties": {
      "cursor": { "type": "string", "description": "Pagination cursor (optional)" }
    }
  }
}
```

```json
{
  "name": "mcp_<sid>__read_resource",
  "description": "Read a resource by URI from MCP server \"<integration.name>\".",
  "parameters": {
    "type": "object",
    "properties": {
      "uri": { "type": "string", "description": "Resource URI" }
    },
    "required": ["uri"]
  }
}
```

`tool_result` 는 MCP `Resource`·`ResourceContents` 객체를 JSON 으로 직렬화해 그대로 넘긴다. 텍스트는 `content[].text`, 바이너리는 `content[].blob`(base64)이다. LLM 멀티모달 입력으로 쓰는 것은 나중에 별도 노드에서 다룬다.

### Prompts 메타 도구

서버가 `prompts` capability 를 보고할 때만 두 도구를 더한다.

```json
{
  "name": "mcp_<sid>__list_prompts",
  "description": "List available prompt templates on MCP server \"<integration.name>\".",
  "parameters": {
    "type": "object",
    "properties": {
      "cursor": { "type": "string", "description": "Pagination cursor (optional)" }
    }
  }
}
```

```json
{
  "name": "mcp_<sid>__get_prompt",
  "description": "Render a prompt template from MCP server \"<integration.name>\". Returns a list of messages you should incorporate into your reasoning.",
  "parameters": {
    "type": "object",
    "properties": {
      "name":      { "type": "string" },
      "arguments": { "type": "object", "description": "Prompt arguments (server-defined)" }
    },
    "required": ["name"]
  }
}
```

`get_prompt` 의 `tool_result` 는 MCP `GetPromptResult.messages` 배열을 JSON 으로 직렬화한 것이다. LLM 은 이 메시지를 자기 추론에 반영한다. MVP 에서는 시스템 프롬프트 자리에 고정해 넣지 않는다.

### 노출 도구 목록

AI 에이전트 설정의 노출 도구 목록(`mcpServers[].enabledTools`)으로 일반 도구를 골라 노출할 수 있다.

| 값 | 뜻 |
|----|------|
| `['*']` 또는 미설정 | 서버가 노출하는 일반 도구를 모두 LLM 에 노출한다(기본) |
| `['toolA', 'toolB']` | 적은 일반 도구만 노출한다. 서버에 없는 이름은 무시하고 경고만 남긴다 |

메타 도구는 노출 도구 목록의 영향을 받지 않고 서버 단위 on/off 로만 제어한다. resource·prompt 마다 목록을 두지 않은 이유는 이렇다. 그 권한은 MCP 서버 쪽 권한 모델로 제어하는 것이 자연스럽고, AI 에이전트 입장에서는 capability 단위 토글로 충분하다.

`mcpServers[].includeResources: false`·`mcpServers[].includePrompts: false` 로 capability 단위로 끌 수 있다. 기본은 모두 `true` 다(서버가 보고했으면 노출).

### 도구 호출 한도

MCP 도구 호출은 AI 에이전트의 도구 호출 한도(`maxToolCalls`)에 들어간다. 지식 저장소 도구와 같은 정책이다. 한도 값과 한도에 닿았을 때의 처리는 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md#단일-턴)가 정한다.

### 도구 정의 크기 예산

MCP 서버가 노출하는 도구 정의(스키마)는 AI 에이전트의 도구 정의 크기 예산(직렬화 bytes 기준)에 더해진다([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md#도구-정의-크기-예산)). [도구 호출 한도](#도구-호출-한도)(`maxToolCalls`)와는 다른 축이다. 하나는 호출 횟수, 하나는 정의 크기다.

대형 카탈로그는 노출 도구 목록 없이 전부 노출하면 도구 정의가 프롬프트를 provider transport 타임아웃 너머로 밀어 provider 와 무관하게 응답 실패(hang, 끝없는 재시도)를 일으킬 수 있다. Cafe24 Admin API 는 operation 485개, MakeShop 은 REST operation 161개다(2026-07-17 실측. 수치의 단일 기준은 [Cafe24 API 카탈로그](CLE-C24-CATALOG#5-coverage-matrix)와 [MakeShop API 카탈로그](CLE-MKS-CATALOG#5-coverage-matrix)). 실제 노출 수는 허가된 권한 범위로 걸러진다. 이 카탈로그들은 bytes 예산 이전에 도구 개수만으로 `AI_AGENT_TOOL_COUNT_MAX` 기본값(128)을 늘 넘는다. 그래서 대형 서버는 `mcpServers[].enabledTools` 로 노출 도구를 좁히는 것이 사실상 필수다. 목록이 없으면 정상 설정처럼 보여도 실행 전 점검이 실패한다. 예산 초과 판정(실행 전 에러 코드 `TOOL_DEFINITION_PAYLOAD_EXCEEDED`)과 저장 시점 경고(그래프 경고 `ai_agent:tool-payload-budget`)의 단일 기준은 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md#도구-정의-크기-예산)와 [에러 코드 절](../CLE-NODE-AI/CLE-NODE-AGENT.md#에러-코드)이다.

## 도구 프로바이더 구현 (`McpToolProvider`)

도구 프로바이더 인터페이스의 두 번째 구현체다. 첫 번째는 `KbToolProvider` 다([RAG 검색](../CLE-KB/CLE-KB-SEARCH.md#확장-지점)).

### 인터페이스 매핑

| 메서드 | 동작 |
|--------|------|
| `key` | `'mcp'` |
| `matches(name)` | `name.startsWith('mcp_')` |
| `buildTools(ctx)` | `ctx.config.mcpServers` 를 돌며 서버마다 connect·initialize 하고 [도구 노출 모델](#도구-노출-모델) 규칙으로 `ToolDef[]` 를 만든다. 실패한 서버는 건너뛰고 진단 정보를 쌓는다 |
| `execute(call, ctx)` | `name` 에서 `<sid>` 를 꺼내 그 서버 세션에서 일반 도구·Resources·Prompts 분기에 따라 RPC 를 부르고, 결과를 `AgentToolResult.content` 로 직렬화한다 |

### 진단 누적 (`mcpDiagnostics`)

지식 저장소의 `ragDiagnostics` 와 같은 방식으로 AI 에이전트 노드의 `meta.mcpDiagnostics` 에 호출 통계를 쌓는다. `mcpDiagnostics` 는 아래 예시의 구조화 객체(`attempted`·`serverCount`·`toolCalls`·`resourceReads`·`promptGets`·`serverSummaries[]`·`errors[]`)로 내보낸다(`mcp-diagnostics.ts` 의 `finalizeMcpDiagnostics`, `ai-turn-executor.ts` 의 `buildMcpDiagnosticsMeta`). 노드 실행에서 MCP 를 한 번도 시도하지 않았으면 `mcpDiagnostics` 키 자체를 뺀다.

- `serverSummaries[]` 는 내부 MCP 브리지(`Cafe24McpToolProvider`·`MakeshopMcpToolProvider`)와 외부 `McpToolProvider` 둘 다 쌓는다. `McpToolProvider` 는 connect 와 list 가 성공하면 `connected`(`toolCount` 포함)를, `serviceType` 을 확정한 뒤 status·connect·list 에서 실패하면 `skipped`(`skipReason='error'`)를 쌓는다. `serviceType` 판정 전 조회 실패는 중복을 피하려고 쌓지 않는다.
- `errors[]` 는 격리된 부분 실패를 세분 코드와 `phase` 로 쌓는다.
  - **도구 목록 구성 단계**(connect·`tools/list`): `MCP_TIMEOUT`·`MCP_CONNECT_FAILED`·`MCP_LIST_FAILED`. 프로바이더가 `ctx.mcpDiagnosticErrors` 로 쌓는다(`McpToolProvider.openServer`, `skipped` 서버 요약과 함께 남는다). 외부 `McpToolProvider` 전용이다.
  - **호출 단계**(`tools/call`·`resources/read`·`prompts/get`·`resources/list`·`prompts/list`): 서버 쪽 실패다. 프로바이더가 `AgentToolResult.mcpErrorDelta` 로 보고하면 핸들러가 execute 한 지점에서 쌓는다. 외부 MCP 는 `MCP_TIMEOUT`·`MCP_TOOL_ERROR`·`MCP_AUTH_FAILED`·`MCP_CALL_FAILED`, 내부 MCP 브리지는 `CAFE24_*`·`MAKESHOP_*` 어휘다.
  - 클라이언트 쪽 실패(`INVALID_TOOL_ARGUMENTS`·`MCP_UNKNOWN_TOOL`·`*_MISSING_FIELDS` 등)는 서버 실패가 아니라 `errors[]` 에 넣지 않는다. `tool_result` 로만 돌려준다.
- `serverCount` 는 `serverSummaries[]` 중 `status='connected'` 행 수다. `attempted` 는 서버 요약·에러·카운터 중 하나라도 있으면 true 다.
- `toolCalls`·`resourceReads`·`promptGets` 는 노드 실행의 도구 실행 지점에서 `mcp_*` 호출을 종류별(`tools/call`·`read_resource`·`get_prompt`)로 센다. 성공과 실패를 가리지 않고 시도 1회를 1로 센다. `list_resources`·`list_prompts` 탐색 메타 도구는 세지 않는다([활동 로그](#활동-로그)에서 빼는 것과 같다).

**입력 자리와 출력 모양의 구분**: 프로바이더(`AgentToolProvider.buildTools`)는 진단을 배열 자리 두 개에만 쌓는다. `ProviderBuildCtx.mcpDiagnostics`(= `serverSummaries[]`, `McpServerSummary[]`)와 `ProviderBuildCtx.mcpDiagnosticErrors`(= `errors[]`, `McpDiagnosticError[]`)다. 최종 `meta.mcpDiagnostics`(구조화 `McpDiagnostics` 객체)는 핸들러(executor)가 두 배열과 실행 카운터를 모아 만든다. 즉 `ProviderBuildCtx.mcpDiagnostics`(입력 자리, 배열)와 `meta.mcpDiagnostics`(출력, 객체)는 이름은 비슷해도 계층과 모양이 다르다. 프로바이더는 요약 배열만 채우고 객체 조립과 카운터는 핸들러가 맡는다.

```json
{
  "mcpDiagnostics": {
    "attempted": true,
    "serverCount": 2,
    "toolCalls": 4,
    "resourceReads": 1,
    "promptGets": 0,
    "serverSummaries": [
      { "integrationId": "uuid-a", "serviceType": "cafe24", "status": "connected", "toolCount": 18 },
      { "integrationId": "uuid-b", "serviceType": "cafe24", "status": "skipped", "skipReason": "expired_install_timeout", "toolCount": 0 }
    ],
    "errors": [
      { "integrationId": "uuid-c", "phase": "tools/list", "code": "MCP_TIMEOUT", "message": "..." }
    ]
  }
}
```

| 필드 | 뜻 |
|------|------|
| `attempted` | MCP 도구를 한 번 이상 호출했거나 노출했는지 |
| `serverCount` | 이 노드 실행에서 연결에 성공한 서버 수(= `serverSummaries[]` 중 `status='connected'` 행 수) |
| `toolCalls` / `resourceReads` / `promptGets` | 종류별 호출 누적 |
| `serverSummaries[]` | `mcpServers` 설정에 등록된 통합마다 도구 목록 구성 결과. 사용자가 «통합이 보이지 않는» 원인을 바로 알게 하려는 것이다. 필드는 `integrationId`, `serviceType`(`mcp`·`cafe24`·…), `status`(`connected`·`skipped`), `skipReason`(skip 일 때만), `toolCount`(카탈로그에 등록된 도구 수) |
| `errors` | 서버별 부분 실패 기록(전체 실패가 아니라 격리된 실패) |

**`skipReason` 어휘**: 이 어휘는 주로 내부 MCP 브리지(Cafe24) 경로의 도구 목록 구성 단계 skip 을 정한다. 외부 MCP 의 status·connect·`tools/list` 실패는 사용자용 요약으로 `serverSummaries[]` 의 `skipped(skipReason='error')` 가 되고, 동시에 `errors[]` 에 세분 코드(`MCP_TIMEOUT`·`MCP_CONNECT_FAILED`·`MCP_LIST_FAILED`)와 `phase` 로 쌓인다. `skipReason` 은 요약, `errors[]` 는 코드 단위 세부로 역할을 나누고 둘을 함께 둔다.

`skipReason` 값은 모두 `lower_snake_case` 다. 이 필드는 에러 코드가 아니라 운영 진단용 enum 이다. 그래서 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-3-에러-계약)의 `code` UPPER_SNAKE_CASE 규칙(예: `MCP_AUTH_FAILED`, `MCP_TIMEOUT`)과 다르다. 통합 상태 사유(`Integration.status_reason`, 예: `auth_failed`, `install_timeout`)와는 일부러 표기를 맞췄다. `skipReason` 의 일부 값(`expired_install_timeout`, `expired_refresh_failed`)이 상태 사유의 뜻을 그대로 옮기기 때문이다.

| 값 | 뜻 | 적용 프로바이더 |
|----|------|---------------|
| `expired_install_timeout` | Cafe24 Private 의 `pending_install → expired` 24시간 TTL 만료. `install_token` 이 NULL 이라 갱신할 수 없고 사용자가 지우고 다시 등록해야 한다 | cafe24 |
| `expired_refresh_failed` | `expired` 상태에서 `buildTools` 의 1회 갱신 시도가 `invalid_grant` 로 실패. worker 가 `error(auth_failed)` 로 전이한다([Cafe24 노드 §만료된 통합의 도구 목록 처리](../CLE-NODE-INT/CLE-NODE-CAFE24.md#만료된-통합의-도구-목록-처리)) | cafe24 |
| `expired_no_refresh_token` | `expired` 상태인데 `credentials.refresh_token` 이 없다. 갱신할 수 없어 통합 재인증이 필요하다 | cafe24 |
| `error` | `status='error'`(auth_failed·insufficient_scope·network 등). 정식 회복은 외부에서 하는 명시적 재인증이다([인증 실패 상태 전환](#인증-실패-상태-전환)) | cafe24 / mcp |
| `pending_install` | Cafe24 Private 첫 설치가 끝나지 않았다 | cafe24 |
| `lookup_failed` | 통합 행 조회 실패(삭제됨, 권한 없음) | 공용 |
| `not_capable` | `mcpServers` 에 등록된 통합의 `service_type` 이 이 프로바이더가 처리할 대상이 아니다(프로바이더 라우팅이 정상인지 확인하는 용도) | 공용 |

`expired` 통합을 `buildTools` 가 스스로 되살리는지는 [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md#미결-사항)와 [통합 상태와 만료 알림](CLE-INT-STATUS.md#미결-사항)의 미결 사항이다.

멀티턴에서는 지식 저장소와 같이 턴 단위 delta 를 `meta.turnDebug[].mcpDiagnostics` 에도 따로 싣는다. `serverSummaries[]` 는 도구 목록 구성 결과의 정적 스냅샷이다. 턴마다 다시 계산하지 않고 노드 실행 단위로 한 번 정한다. 멀티턴 재개 때 도구 목록을 다시 만들면 스냅샷도 바뀐다.

## 실행 흐름

```mermaid
flowchart TD
  A[AI 에이전트 execute 시작] --> B[mcpServers 설정 조회]
  B --> C[서버별 연결과 initialize, 목록 조회]
  C --> D[노출 규칙으로 ToolDef 목록 생성]
  C -->|실패한 서버| E[건너뛰고 mcpDiagnostics에 기록]
  D --> F["LLM 호출 (지식 저장소·MCP·조건·표시 도구 노출)"]
  F --> G{LLM 응답}
  G -->|mcp_ 도구 호출| H[McpToolProvider execute]
  H --> I[tool_result 주입]
  I --> F
  G -->|kb_ 도구 호출| J[KbToolProvider 처리]
  J --> F
  G -->|cond_ 도구 호출| K[조건 처리]
  G -->|텍스트 응답| L[종료]
  K --> L
  L --> M[모든 세션 닫기, mcpDiagnostics 확정]
```

AI 에이전트가 시작되면 `mcpServers` 설정을 읽고, 서버마다 필요할 때 연결해 도구 목록을 만든다. 실패한 서버는 건너뛰고 진단에 남긴다. LLM 에는 지식 저장소 도구·MCP 도구·조건 도구와 등록된 표시 도구를 함께 노출한다. LLM 이 `mcp_*` 도구를 부르면 `McpToolProvider` 가 실행해 결과를 다음 LLM 호출에 넣는다. 텍스트로 끝나면 모든 세션을 닫고 `meta.mcpDiagnostics` 를 확정한다. 도구 호출 분류 순서는 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md#도구-호출-분류)가 정한다.

## 에러 처리

### 격리 원칙

MCP 서버 하나가 장애를 내도 AI 에이전트 노드 전체가 죽지 않는다. 지식 저장소 검색과 같은 graceful degradation 전략이다.

| 상황 | 처리 |
|------|------|
| `initialize` 실패, `tools/list` 실패, connect 타임아웃 | 그 서버 도구는 LLM 에 노출하지 않는다. `meta.mcpDiagnostics.errors` 에 세분 코드([에러 코드](#에러-코드))와 `phase` 로 남긴다. 다른 서버·지식 저장소 도구는 정상 노출한다 |
| `tools/call` 실패(네트워크, 5xx, RPC error) | 그 호출만 실패한다. LLM 에 `tool_result` 로 `{ "error": "<code>", "message": "..." }` 를 넘겨 LLM 이 응답 방법을 정하게 한다. [활동 로그](#활동-로그)와 `mcpDiagnostics.errors[]`(`phase='tools/call'`, 세분 코드)에 남긴다 |
| 401·403(인증 실패) | 위와 같고, 추가로 `Integration.status` 를 `error(auth_failed)` 로 바꾸고 `last_error` 를 남긴다. 사용자에게 통합 재인증이나 자격 증명 교체를 권한다([인증 실패 상태 전환](#인증-실패-상태-전환)) |
| 도구 인자 스키마 검증 실패 | LLM 이 보낸 인자가 `inputSchema` 를 어기면 호출하지 않고 `tool_result.error = 'INVALID_TOOL_ARGUMENTS'` 를 돌려준다. LLM 이 다음 턴에 고친다 |
| `tool_result.content` 가 너무 큼(텍스트 100KB 초과, 바이너리 1MB 초과) | 잘라 내고 `tool_result` 끝에 `[truncated: original_size_bytes]` 표시를 붙인다. `mcpDiagnostics` 에 경고를 남긴다 |

### 에러 코드

`tool_result.error` 나 `mcpDiagnostics.errors[].code` 에 쓴다. 단일 기준은 `codebase/backend/src/modules/mcp/mcp-error-codes.ts` 의 `MCP_ERROR_CODES` 상수다.

| 코드 | 뜻 |
|------|------|
| `MCP_CONNECT_FAILED` | TCP·TLS·DNS 실패, HTTPS 강제 위반, `initialize` RPC 실패(프로토콜 버전 불일치 포함). connect 단계 실패를 모두 하나로 모은다. SDK 가 connect 와 initialize 를 한 호출로 묶어 두 단계를 뜻으로 나누기 어렵기 때문이다. 내는 곳은 [연결 테스트](#연결-테스트)(`McpTestConnectionService`)와 노드 실행 `buildTools`(`McpToolProvider.openServer`)다. `buildTools` 의 connect 실패(status 사전 검사 포함)는 `mcpDiagnostics.errors[].code = MCP_CONNECT_FAILED`(`phase='connect'`)로 드러난다 |
| `MCP_LIST_FAILED` | `tools/list` 등 list RPC 실패. 내는 곳은 연결 테스트와 `buildTools` 다. `buildTools` 의 `tools/list` 실패는 `mcpDiagnostics.errors[].code = MCP_LIST_FAILED`(`phase='tools/list'`)로 드러난다 |
| `MCP_CALL_FAILED` | `tools/call`·`resources/read`·`prompts/get`·`resources/list`·`prompts/list` 실패. 노드 실행 `execute` 경로에서 낸다. `tool_result` 와 `mcpDiagnostics.errors[]`(phase 별) 양쪽에 드러난다 |
| `MCP_TOOL_ERROR` | `tools/call` 응답이 MCP `isError: true` 인 도구 수준 실패. 전송은 성공했지만 도구가 에러를 보고했다. `tool_result.content` 에 서버 content 를 함께 싣고 `mcpDiagnostics.errors[]`(`phase='tools/call'`)에도 남긴다 |
| `MCP_TIMEOUT` | [타임아웃](#타임아웃) 초과. `withTimeout` 의 `TimeoutError`(와 connect 단계 AbortController 만료)로 판정하며 모든 단계에서 드러난다. 도구 목록 구성 단계(connect·`tools/list`)와 호출 단계(`tools/call`·`resources/read`·`prompts/get` 등)는 `mcpDiagnostics.errors[].code = MCP_TIMEOUT`(해당 phase), 연결 테스트는 응답 `code = MCP_TIMEOUT` 이다 |
| `MCP_AUTH_FAILED` | 자격 증명 누락·형식 오류, 또는 401·403. `Integration.status` 변경이 따른다 |
| `MCP_HTTPS_REQUIRED` | URL 이 `https://` 가 아니거나, 파싱할 수 없거나, 사설·내부망 호스트(SSRF 차단)다. 미리보기 테스트(`preview-test`) 단계에서 잡는다 |
| `MCP_UNKNOWN_TOOL` | `execute` 단계에서 `<sid>` 에 맞는 활성 세션이 없거나, 세션이 노출하지 않은 도구 이름을 LLM 이 불렀다(`buildTools` 미실행, 도구 없음) |
| `INVALID_TOOL_ARGUMENTS` | 인자 스키마 검증 실패 또는 인자 JSON 파싱 실패. 호출 자체는 일어나지 않는다 |
| `MCP_RESPONSE_TOO_LARGE` | content 크기 상한 초과. 잘라 냈음을 알린다 |

`Integration.last_error` 에는 `MCP_AUTH_FAILED` 처럼 상태 전이를 일으킨 에러만 남긴다. 일반 호출 실패는 활동 로그와 `mcpDiagnostics.errors` 로 충분하다.

### 활동 로그

통합 노드의 활동 로그(`IntegrationUsageLog`) 기록 방식은 AI 에이전트의 MCP 호출에도 적용한다. `tools/call` 1회당 1행을 쓰고, `node_execution_id` 는 호출 시점의 AI 에이전트 노드 실행이다. 컬럼 정의는 [통합 데이터와 흐름](CLE-INT-DATA.md#활동-로그-integration_usage_log)이 정한다.

| 필드 | 타입 | MCP 호출의 값 |
|------|------|----|
| `status` | enum | `success` / `failed` |
| `error` | jsonb? | 실패 때 `{ code, message }`([에러 코드](#에러-코드) 어휘). `message` 는 자격 증명 모양의 문자열을 가린 뒤 2KB 로 자른다. 가리는 대상은 Bearer 토큰, `Authorization` 헤더, URL userinfo(scheme 을 남겨 `scheme://***@host`), bare JWT, 이름이 붙은 `api_key`·`secret`·`token` 계열(`token`·`access_token`·`csrf_token`·`csrfToken`) key-value 등이다. 모두 공용 `SECRET_LEAK_PATTERNS`(`shared/utils/sanitize-error-message`)로 처리한다. MCP 전용 추가 패턴은 2026-08-17 기준 없다. `mcpDiagnostics.errors[].message` 와 `Integration.last_error` 도 같은 방식(`sanitizeMcpErrorMessage`)이다 |
| `duration_ms` | int | RPC 호출 단위 소요 시간 |
| `api_label` | `varchar(128)?` | 내부 MCP 브리지 경로는 카탈로그 키를 채운다(Cafe24 `cafe24.<resource>.<operation>`, MakeShop `makeshop.<resource>.<operation>`). 외부 MCP 서버 경로는 NULL |
| `api_method` | `varchar(8)?` | 내부 MCP 브리지는 operation 의 HTTP 메서드, 외부 MCP 경로는 NULL |
| `api_path` | `varchar(256)?` | 내부 MCP 브리지는 operation 경로 템플릿, 외부 MCP 경로는 NULL |

`api_*` 세 컬럼의 채우기 규칙과 길이 한도는 [통합 데이터와 흐름](CLE-INT-DATA.md#호출-api-식별-채우기-규칙)이 단일 기준이다.

**API 식별 채우기는 호출하는 쪽의 명시 의무다**: 내부 MCP 브리지 경로는 노드 핸들러의 `IntegrationHandlerBase.logUsage`(api 인자를 자동으로 넘김)를 거치지 않는다. 도구 프로바이더(`Cafe24McpToolProvider`, `MakeshopMcpToolProvider`)가 `IntegrationsService.logUsage` 를 직접 부른다. 그래서 `api` 식별 정보를 호출하는 쪽에서 직접 채워야 한다. 빠뜨려도 노드 핸들러 테스트는 통과하므로 사각지대가 된다. 채우는 값은 노드 핸들러와 같은 형식(카탈로그 키 + operation 메서드 + operation 경로)이다.

메타 도구(`list_resources`·`read_resource`·`list_prompts`·`get_prompt`)는 활동 로그에 남기지 않는다. 외부 API 호출이라기보다 MCP 세션 안의 탐색 흐름이고, 매번 남기면 활동 탭의 신호보다 잡음이 커진다. 따로 대시보드가 필요해지면 별도 trace 로 들인다. `tools/list`·`resources/list`·`prompts/list` 같은 `buildTools` 단계의 준비 RPC 도 남기지 않는다.

활동 로그 쓰기는 fire-and-forget 이다. `tools/call` 응답을 돌려준 직후 비동기로 보내 주 경로를 막지 않는다. DB 쓰기가 실패하면 삼키고 warn 로그만 남긴다.

### 인증 실패 상태 전환

`tools/call` 응답이 401·403(또는 `unauthorized`·`forbidden` 메시지)이면 다음을 함께 한다.

1. `tool_result.error.code = MCP_AUTH_FAILED` 로 LLM 에 넘긴다. 사용자 경험을 위해 호출 자체는 부드럽게 실패시킨다.
2. 활동 로그 `error.code = MCP_AUTH_FAILED` 로 남긴다.
3. `Integration.status` 를 `error` 로, `status_reason` 을 `auth_failed` 로 원자적으로 UPDATE 한다. 그러면 통합 관리 화면에 «주의 필요» 배너가 자동으로 뜬다([통합 상태와 만료 알림](CLE-INT-STATUS.md#주의-필요-배너)).

이 정책은 refresh token 이 없는 토큰 모델인 외부 MCP 서버에만 적용한다. `error → connected` 자동 복구는 하지 않는다. 토큰이 다시 유효해지면 사용자가 자격 증명 교체나 OAuth 통합 재인증으로 `connected` 로 되돌린다. 자동 복구를 들이면 만료된 토큰이 잠깐 살아나는 시각 경쟁(race-of-clock) 상황에서 상태가 깜빡여 운영 가시성을 해친다.

**내부 MCP 브리지 예외(refresh token 이 있는 프로바이더)**: Cafe24 처럼 자체 OAuth refresh token 이 있는 프로바이더의 401 은 이 정책 대신 [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md#인증-실패-처리)의 «토큰 갱신 + 1회 재시도» 자가 회복 정책을 쓴다. refresh token 이 정상 갱신을 보장하므로 외부 MCP 의 시각 경쟁 상황이 생기지 않고, 정상 토큰 수명의 일부라 상태가 깜빡일 걱정도 없다. 403(권한 범위·권한 부족)은 내부 MCP 브리지도 이 절과 똑같이 즉시 격하한다. 이 분기의 결정 근거는 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md#401-을-받으면-갱신하고-한-번-다시-보낸다)에 있다.

실패 한 번으로 상태를 바꾸는 것은 기존 OAuth 통합 정책과 같고 의도한 것이다. 외부 MCP 서버에만 해당한다. 임계값(예: 연속 3회)을 들일지는 반복 실패 비용과 상태 가시성 사이의 trade-off 를 분석한 뒤 따로 정한다.

## 연결 테스트

[통합 관리](CLE-INT-MANAGE.md)의 저장 전 연결 테스트(`POST /api/integrations/preview-test`)와 같은 방식이다. MCP 서비스의 테스트 순서는 다음과 같다.

1. `credentials.url` 이 `https://` 로 시작하는지 확인한다. 아니면 `MCP_HTTPS_REQUIRED` 다. SSRF 차단과 형식이 잘못된 URL 도 같은 코드로 모은다.
2. Streamable HTTP 클라이언트로 connect 한 뒤 `initialize` 를 부른다(10초 타임아웃).
3. 응답의 `capabilities` 와 `serverInfo` 를 메모리에 둔다.
4. (선택) `tools/list` 를 한 번 불러 도구 개수 미리보기를 만든다.
5. 세션을 닫는다.

성공하면 응답 본문에 다음을 싣는다. 화면은 이 값으로 capability 미리보기를 그린다.

```json
{
  "capabilities": { "tools": {}, "resources": {}, "prompts": {} },
  "serverInfo": { "name": "filesystem-mcp", "version": "1.2.0" },
  "preview": { "toolCount": 12, "resourceSupported": true, "promptSupported": false }
}
```

**실패 응답 형식**: `preview-test` 는 실패해도 예외를 던지지 않는다. HTTP 200 OK 본문에 `{ success: false, code, message }` 를 담아 돌려준다. `code` 는 [에러 코드](#에러-코드) 중 `MCP_HTTPS_REQUIRED`·`MCP_AUTH_FAILED`·`MCP_CONNECT_FAILED`·`MCP_LIST_FAILED`·`MCP_TIMEOUT` 이다. connect 나 `tools/list` 가 `TimeoutError` 로 만료되면 `MCP_TIMEOUT` 이다. 화면은 이 본문을 그대로 보여 준다.

**이미 저장된 통합의 자격 증명 교체**: `POST /api/integrations/:id/rotate` 는 새 값으로 연결 테스트를 먼저 돌리고, 통과했을 때만 저장한다. 테스트가 실패하면 `INTEGRATION_TEST_FAILED` 로 거부한다. 신규 등록 미리보기인 `preview-test` 와 다른 경로다. 이 문서 원문은 `BadRequestException`(HTTP 400)으로 던진다고 적지만 에러 코드 목록과 정의가 갈린다. [통합 관리](CLE-INT-MANAGE.md#미결-사항) 의 미결 사항 참조.

## 클라이언트 라이브러리

- 백엔드는 공식 TypeScript SDK `@modelcontextprotocol/sdk` 의 Streamable HTTP transport 모듈을 쓴다. NestJS `McpClientModule` 이 SDK 를 감싸 워크스페이스 격리·로깅·타임아웃을 넣는다.
- transport 를 하나만 써서 SDK import 범위를 줄인다. stdio·websocket 모듈은 import 하지 않는다.

## 데이터 모델 영향

새 컬럼이나 새 엔티티는 없다. [통합 데이터와 흐름](CLE-INT-DATA.md#통합-integration)의 `service_type` 문자열 컬럼에 이 문서 영역의 값 `mcp`(외부 HTTP transport)와 `cafe24`·`makeshop`(내부 MCP 브리지)을 쓴다. 세 값 모두 문자열 컬럼이라 enum 마이그레이션이 필요 없다. 활동 로그 사용 방식(`tools/call` 1회당 1행)은 두 transport 에 모두 적용한다.

## 확장 지점

- **stdio transport**: 데스크톱 브리지나 사내 격리 환경에 한해 들일 수 있다. 자격 증명 스키마에 `command`·`args`·`env` 를 더하고 transport 를 분기한다.
- **prompt 고정**: `mcp_<sid>__get_prompt` 결과를 systemPrompt 자리에 고정해 넣는 사용자 흐름. AI 에이전트 설정 화면의 systemPrompt 영역 옆에 «MCP Prompt 첨부» 를 더한다.
- **resource 를 정적 컨텍스트로**: 특정 resource URI 를 노드 실행 때 자동으로 읽어 `messages[].content` 앞에 넣는다. `mcpServers[].pinnedResources: string[]`.
- **OAuth 2.1(PKCE) 인증 유형**: 지금은 OAuth 계열 인증 유형이 없다(`bearer_token`·`api_key`·`none` 만). 동적 OAuth 흐름은 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md#oauth-콜백-엔드포인트)의 콜백 패턴을 다시 써서 더할 수 있다.
- **server-to-server proxy, 응답 캐싱**: 트래픽 분석 뒤 별도 스펙으로 다룬다.
- **내부 MCP 브리지 확장**: Shopify, Naver Smartstore 같은 first-party 이커머스 통합을 `cafe24` 와 같은 패턴으로 더할 수 있다. 백엔드에 브리지 모듈(기존 예: `Cafe24McpToolProvider`)과 메타데이터 테이블을 두고, [내부 MCP 브리지 적용 목록](#service_type-과-인증-유형)에 더한다.

각 항목은 [도구 노출 모델](#도구-노출-모델)의 평탄화 방식을 깨지 않고 더할 수 있게 설계했다.

## 미결 사항

- 자격 증명 교체 실패 `INTEGRATION_TEST_FAILED` 의 HTTP 상태(400 대 422)와 MCP 통합의 개인 공개 범위 허용 여부는 [통합 관리](CLE-INT-MANAGE.md#미결-사항) 의 미결 사항에서 다룬다. 이 문서 원문은 각각 400 과 «기본 `organization`, 개인 등록 미지원» 쪽이다.
- **`<sid>` 길이 규칙과 현재 구현의 차이**: 이 문서 원문은 `<sid>` 를 `Integration.id` 앞 8자로 두고 워크스페이스 안에서 겹치면 12자로 늘린다고 적는다. 현재 구현은 외부 `McpToolProvider` 가 한 노드의 `mcpServers` 안에서만 겹침을 보고 8 → 12 → 32자 순으로 늘리며(`assignSids`, `buildTools` 시점), 내부 MCP 브리지 프로바이더는 늘 앞 16자를 쓴다(`sanitizeSid`). 문서를 구현에 맞출지, 구현을 문서에 맞출지 정해야 한다. 결정 필요.

## 구현 위치

- `codebase/backend/src/modules/mcp/mcp-client.service.ts` (Streamable HTTP 클라이언트, URL 검증)
- `codebase/backend/src/modules/mcp/mcp-test-connection.service.ts` (연결 테스트)
- `codebase/backend/src/modules/mcp/mcp-error-codes.ts` (`MCP_ERROR_CODES`, `sanitizeMcpErrorMessage`)
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` (외부 서버 도구 프로바이더)
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts` (`finalizeMcpDiagnostics`)
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` (Cafe24 내부 MCP 브리지)
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/makeshop-mcp-tool-provider.ts` (MakeShop 내부 MCP 브리지)
- `codebase/backend/src/common/config/mcp.config.ts` (`mcp.*` 설정 namespace)

## Rationale

이 절은 본문 곳곳의 주요 설계 결정과 기각한 대안의 배경을 모은다. 본문이 «무엇» 을 정한다면 여기서는 «왜» 를 적는다.

### stdio transport 를 지원하지 않는다

멀티테넌트 SaaS 백엔드에서 사용자마다 subprocess 를 spawn 하면 세 가지 문제가 있다. 프로세스·보안 격리 비용이 들고, 임의 명령 실행 권한이 드러나고, «워크스페이스 공용 자원» 모델과 맞지 않는다. 그래서 MVP 에서 뺐다. Streamable HTTP 한 가지로 SDK import 범위를 줄이고, stdio 는 나중에 데스크톱 브리지 에이전트로 우회 노출하는 별도 스펙으로 나눈다.

### 내부 MCP 브리지와 자가 회복 예외

같은 통합(예: Cafe24)을 워크플로우 노드와 AI 에이전트 양쪽에서 쓰는 경우를 위해 내부 MCP 브리지를 들였다. 외부 MCP 서버 없이 백엔드 프로세스 안의 모듈이 도구 프로바이더를 직접 구현한다. HTTP fetch·SSRF·세션 헤더가 모두 no-op 이 되어 표면이 단순하다.

«401 → 즉시 상태 격하» 정책은 refresh token 이 없는 외부 MCP 에만 적용한다. refresh token 이 있는 내부 MCP 브리지 프로바이더(Cafe24)의 401 은 [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md#인증-실패-처리)의 «토큰 갱신 + 1회 재시도» 자가 회복을 먼저 쓴다. refresh token 이 정상 토큰 수명을 보장하므로 외부 MCP 의 시각 경쟁(만료 토큰이 잠깐 되살아나는 상황)이 없고, 상태가 깜빡일 걱정도 없다. 403(권한 범위 부족)은 양쪽 모두 즉시 격하한다.

### 진단 어휘를 `skipReason` 과 `errors[].code` 로 나눈다

진단 표면을 일부러 두 어휘로 나눴다. `serverSummaries[].skipReason` 은 `lower_snake_case` 운영 enum(예: `expired_install_timeout`)으로 통합 상태 사유의 뜻을 옮긴다. `errors[].code` 는 `UPPER_SNAKE_CASE` 에러 코드로 실패 단계별 세부를 담는다. 하나로 합치지 않은 이유는 두 필드가 답하는 질문이 다르기 때문이다. 앞쪽은 «이 통합이 왜 안 보이나»(도구 목록 구성 스냅샷)에, 뒤쪽은 «어느 RPC 가 어떻게 실패했나»(구성·호출 단계별)에 답한다.

프로바이더 입력 자리(`ProviderBuildCtx.mcpDiagnostics`, 배열)와 최종 출력(`meta.mcpDiagnostics`, 객체)은 이름을 같이 쓰지만 계층과 모양이 다르다. 프로바이더는 요약·에러 배열만 채우고 카운터 집계와 객체 조립은 핸들러(executor)가 맡는다. 소유 경계를 이름이 아니라 타입으로 나눈다.

### SSRF 우회 플래그를 throw 와 warn 으로 나눈다

운영 환경 부팅 차단에서 «절대 금지» 플래그(`MCP_ALLOW_INSECURE_URL`)는 부팅 throw 로, «정당한 용도가 있는» 플래그(`ALLOW_PRIVATE_HOST_TARGETS`, VPC 내부 호스트 같은 셀프 호스팅 용도)는 warn 으로 나눈다. 기준은 그 플래그에 정당한 운영 용도가 있느냐다. 잘못 나누면 정당한 셀프 호스팅 배포를 막거나(지나친 throw) SSRF 표면을 열어 둔다(지나친 warn).

### 타임아웃을 `TimeoutError` 로 분류한다

`withTimeout` 의 soft deadline 과 connect 단계 AbortController 만료를 모두 `TimeoutError` 하위 클래스로 맞췄다. 호출하는 쪽은 message 문자열을 맞춰 보지 않고 `instanceof` 로 타임아웃과 다른 실패를 확실히 가른다(`MCP_TIMEOUT` 대 `MCP_CONNECT_FAILED`·`MCP_CALL_FAILED`). 하위 호환을 위해 여전히 `Error` 이고 message 형식도 그대로다.

### capabilities 캐시를 채택하지 않는다 (R-wontdo-cached-capabilities)

**결정 (2026-07-16)**: `credentials.cached_capabilities` 캐시는 채택하지 않는다. 2026-06-03 스펙·코드 감사가 이 캐시를 «미구현(Planned)» 으로 표시해 추적해 왔으나, 6주 유예 끝에 들이지 않기로 확정했다.

검토한 참고 설계는 이렇다. 서버를 등록할 때 `initialize` 응답의 `capabilities` 객체를 한 번 `credentials.cached_capabilities` 에 저장한다(write-only 가 아닌 메타데이터). 노드 설정 화면이 즉시 미리보기에 쓰되, 저장된 값은 힌트일 뿐이고 실행 시점에 다시 조회한 결과가 우선한다. 외부 HTTP transport 전용이며, 내부 MCP 브리지는 capability 가 정적 상수라 캐시가 필요 없다(`Cafe24McpToolProvider` 는 `tools` capability 만 고정으로 보고한다).

근거는 다음과 같다.

- **기능 결손이 아니다.** 참고 설계 스스로 «저장된 capabilities 는 힌트일 뿐, 실행 시점 재조회가 우선한다» 고 정했다. 정확성을 위해 어차피 다시 조회하므로 캐시가 없애는 것은 설정 화면 미리보기의 첫 렌더 지연뿐이다. 지금의 live `initialize` 경로([연결 테스트](#연결-테스트))는 오히려 늘 최신이라는 정확성 이점이 있다.
- **최적화의 전제인 측정된 병목이 없다.** 2026-06-03 등재 뒤로 실사용 성능 불만이 나온 적이 없다. 측정 없는 선제 최적화는 이 문서가 stdio 미지원과 SSRF 우회 플래그에서 지켜 온 «비용 대비 실익» 판단과 어긋난다.
- **비용이 국소적이지 않다.** 통합 자격 증명 JSONB 스키마 변경은 자격 증명 저장 경로 전반에 걸친 인프라 변경이다. 여기에 캐시 무효화(서버 쪽 도구 목록 변경 감지)라는 새 문제가 더해진다. 힌트 성격의 최적화가 치를 값이 아니다.

**재개 조건**: 설정 화면 미리보기의 live `initialize` 지연이 실측으로 문제가 되면(예: 대형 카탈로그 서버에서 체감 지연) 새 plan 으로 다시 제안한다. 그때는 자격 증명 JSONB 확장만이 선택지가 아니므로 별도 캐시 테이블 + TTL, 노출 도구 목록 기반 지연 로딩 같은 대안도 함께 평가한다. 즉 이 결정은 캐시라는 아이디어를 영구히 버린 것이 아니라 지금 근거로는 이 구현 형태를 채택하지 않는다는 뜻이다.

**표기 선례**: 절 단위 비채택 표기(인라인 표시 + 전용 `R-wontdo-*` Rationale 절)는 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)의 `R-wontdo-rawws-rest`(2026-07-08)가 세운 방식을 따른다. 옛 스펙 트리의 문서 단위 폐기 표시(`status: archived`)와는 층이 다르다. 그 표시는 전환 단계 5 에서 옛 트리와 함께 걷었다([스펙과 구현 근거 규약](../CLE-ENG/CLE-ENG-SPECEVIDENCE.md) R-4 · R-16).

### 에러 message 가리기는 공용 패턴을 다시 쓴다

사용자에게 보이는 곳(`mcpDiagnostics.errors[].message` 등)으로 나가는 외부 MCP 에러 문자열의 비밀 가리기는 공용 `SECRET_LEAK_PATTERNS`(`shared/utils/sanitize-error-message`)를 다시 쓴다. 공용이 다루지 않는 MCP 특화 경우만 얇게 얹는 훅(`MCP_EXTRA_SECRET_PATTERNS`)을 둔다. 별도 가리기 로직을 새로 두지 않은 이유는 이렇다. 비밀 패턴은 보안상 민감한 단일 기준이라, 나뉘면 «공용에 새 패턴을 더했는데 MCP 는 빠짐» 같은 유지보수 위험이 커진다. 길이 상한만 MCP 는 2048(공용 200 과 별개)로 다르게 둔다. MCP 서버 에러가 더 길 수 있어 진단성을 지키려는 것이다.

URL userinfo(`scheme://user:pass@host`) 패턴과 쿼리의 bare `token=` 은 원래 MCP 전용 목록에 있었다. 공용 패턴이 같은 형태를 흡수하면서 MCP 전용 목록에서 뺐다(2026-07-10, 2026-08-17). 공용 이름 붙은 패턴이 `token` 계열 전체(`[A-Za-z0-9_-]*token`: bare `token`·`access_token`·`csrf_token`·`csrfToken`)로 넓어졌기 때문이다. 수정 없는 프로브로 같은 결과를 확인했다. `?token=abc&foo=bar` 가 공용 패턴만으로 `?***&foo=bar` 가 되고, `mcp-error-codes.spec.ts` 8건이 모두 그대로 통과한다. 그래서 `MCP_EXTRA_SECRET_PATTERNS` 는 비었지만 훅은 남긴다. MCP 서버는 제3자 구현이라 공용이 모르는 형태를 언제든 돌려줄 수 있다. 그때 여기에 한 줄 얹는 편이 공용 단일 기준을 MCP 사정으로 넓히는 것보다 안전하다.
