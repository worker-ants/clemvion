---
id: "CLE-INT-MCP-CONN"
title: "MCP 클라이언트 — 연결과 URL 검증"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT-MCP"
ancestors: ["CLE-VISION", "CLE-INT", "CLE-INT-MCP"]
area: "CLE-INT"
content_hash: "d501bcbde75521214a3e5677986dc32051ae97601dd19b33d982f8c647af0418"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "f71e890270a9e8053a832a11394483499fd1a95316a030098ec05aa459e3e2fd"
etag: "sha256-f2c6485c33d601f903019b6675aee353bf86e0e71fd11d9a866141fced1c0dad"
---
## 개요

이 문서는 [MCP 클라이언트](CLE-INT-MCP.md) 의 하위 문서로 외부 MCP 서버와의 연결(Streamable HTTP transport, URL 검증과 SSRF 차단, 환경 변수, 연결 수명, 연결 테스트)을 정한다.

## Streamable HTTP (외부 서버)

`service_type='mcp'` 통합에 적용한다. MCP 의 Streamable HTTP transport 만 지원한다.

| 항목 | 동작 |
|------|------|
| 엔드포인트 | 통합 `credentials.url` 의 단일 URL. 클라이언트 → 서버는 `POST`, 서버 → 클라이언트는 `GET` + `text/event-stream` |
| 세션 | 서버가 `Mcp-Session-Id` 응답 헤더로 발급하면 이후 모든 요청에 같은 헤더를 되돌려 보낸다. 발급하지 않으면 stateless 모드다 |
| 프로토콜 버전 | 클라이언트 SDK 가 협상한다. 서버가 지원하지 않는 버전을 거부하면 connect 단계 실패로 보고 `MCP_CONNECT_FAILED` 로 처리한다([에러 코드](CLE-INT-MCP-ERROR.md#에러-코드)) |
| 인증 | HTTP 헤더. 인증 유형별 매핑은 [서비스별 인증 방식과 자격 증명](CLE-INT-AUTH.md#mcp-서버) |

## 자격 증명과 URL 검증

자격 증명(`credentials`) 필드는 [서비스별 인증 방식과 자격 증명](CLE-INT-AUTH.md#mcp-서버) 이 정한다. 요약하면 공통 `url`(https, 필수)·`default_headers` 와 인증 유형별 `token`(🔒) 또는 `header_name`·`value`(`value` 만 🔒)다. 비밀 필드는 모두 AES-256-GCM 으로 암호화한다([통합 데이터와 흐름](CLE-INT-DATA.md#암호화)).

URL 검증과 SSRF 차단은 외부 HTTP transport 에만 적용한다. 내부 MCP 브리지는 외부 fetch 가 없어 적용하지 않는다.

1. `url` 은 HTTPS 만 받는다. 연결 테스트에서 `https://` 로 시작하는지 확인하고, 아니면 `MCP_HTTPS_REQUIRED` 를 낸다.
2. 호스트가 다음 중 하나이면 같은 코드(`MCP_HTTPS_REQUIRED`)로 막는다.
   - loopback(`127.0.0.0/8`, `::1`, `localhost`), link-local(`169.254.0.0/16`, `fe80::/10`)
   - RFC 1918 사설 대역(`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
   - 그 밖의 특수 대역(통신사 공유 주소 CGNAT `100.64.0.0/10`, `0.0.0.0/8`, IPv6 미지정 주소 `::`)
   - IPv6 unique-local(`fc00::/7`)
   - IPv4 를 품은 IPv6 리터럴. IPv4-mapped(`::ffff:0:0/96`), IPv4-compatible(`::/96`), 상태 없는 변환 SIIT(`::ffff:0:0:0/96`), IPv6→IPv4 변환 NAT64 의 well-known prefix(`64:ff9b::/96`) 는 품은 IPv4 를 위 대역으로 판정한다. 공인 IPv4 를 품었으면 통과한다. 6to4(`2002::/16`)와 NAT64 local-use prefix(`64:ff9b:1::/48`)는 보지 않는다. 판정 범위의 기준 문서는 [알림 웹훅 「SSRF 방지」](../CLE-IX/CLE-EIA-NOTIFY.md#ssrf-방지) 다. 알림 웹훅 가드는 2026-11-12 부터 특수 용도 대역(192.0.0/24 · 198.18/15 · 224/4 · 240/4 · fec0::/10 · ff00::/8), 6to4, NAT64 local-use prefix 를 더 막는다. MCP 가드를 맞추는 일은 NERV Task `CLE-T-753725` 가 맡는다
   - 클라우드 메타데이터 호스트 이름(`metadata.google.internal`, `metadata.azure.com` 등)
3. 호스트가 IP literal 이 아니면 연결할 때마다 connect 직전에 호스트 이름을 DNS 로 해석하고, 돌아온 주소를 모두 2항과 같은 판정으로 검사한다. 주소가 하나라도 막히는 대역이면 연결하지 않고 같은 코드(`MCP_HTTPS_REQUIRED`)로 막는다. 노드 실행에서는 다른 connect 실패와 같이 `MCP_CONNECT_FAILED` 로 모인다([에러 코드](CLE-INT-MCP-ERROR.md#에러-코드)).
   - 에러 message 에는 호스트 이름만 싣고 해석된 주소는 싣지 않는다. 주소는 서버 경고 로그에만 남긴다.
   - DNS 해석에는 connect 와 같은 타임아웃(`MCP_CONNECT_TIMEOUT_MS`, 기본 10s)을 따로 둔다. 그 안에 끝나지 않으면 검사를 건너뛰지 않고 `TimeoutError` 로 끝낸다. 연결 테스트와 노드 실행 모두 `MCP_TIMEOUT` 이다.
   - 시간 초과가 아닌 DNS 해석 실패(해석기가 던지는 그 밖의 예외 모두)는 막지 않고 넘긴다. 해석되지 않는 호스트에는 SDK 의 fetch 도 닿지 못하므로 connect 실패로 끝난다.
   - `MCP_ALLOW_INSECURE_URL=true` 이면 이 검사도 건너뛴다. `ALLOW_PRIVATE_HOST_TARGETS` 는 읽지 않는다.
   - 검사한 뒤 실제 연결 전에 DNS 응답이 바뀌면(DNS rebinding) 막지 못한다([미결 사항](CLE-INT-MCP.md#미결-사항)).
4. 이 규칙은 등록 전 연결 테스트와 노드 실행의 connect 에 똑같이 적용한다. 다른 아웃바운드 경로의 SSRF 가드는 [HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md#실행-로직)와 [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md#ssrf-가드)에 있다.

**로컬 개발용 우회 플래그**: 환경 변수 `MCP_ALLOW_INSECURE_URL=true` 가 켜지면 다음이 바뀐다.

- `http://` URL 을 받는다. `file://`·`ws://` 같은 다른 scheme 은 여전히 거부한다.
- 위 SSRF 호스트 차단 목록 전체를 건너뛴다(loopback·RFC 1918·클라우드 메타데이터 모두 등록 가능). connect 직전 해석 주소 검사(3항)도 건너뛴다.

이 플래그는 운영 환경에서 절대 켜면 안 된다. 등록된 URL 을 그대로 믿게 되어 SSRF 방어면이 다시 열린다. 기본값은 `false` 이고 `codebase/backend/.env.example` 에 경고와 함께 적는다.

**운영 환경 가드**: `NODE_ENV=production` 에서 `MCP_ALLOW_INSECURE_URL=true` 이면 부팅을 거부한다(`main.ts` 의 `assertProductionConfig`, `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 와 같은 형태). 부팅 가드 전체 목록은 [세션과 토큰 「운영 환경 가드」](../CLE-ACCT/CLE-ACCT-SESSION.md#운영-환경-가드) 에 있다. 셀프 호스팅(VPC 내부 호스트 등)에 정당한 용도가 있는 `ALLOW_PRIVATE_HOST_TARGETS`(HTTP Request·Database Query·Send Email 통합 노드 SSRF 가드의 공통 플래그, [HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md#실행-로직))는 정책이 달라 throw 가 아니라 warn 으로 둔다. 운영에서 켜져 있으면 부팅은 하되 경고 로그를 남긴다([Rationale](#ssrf-우회-플래그를-throw-와-warn-으로-나눈다)).

## 환경 변수

| 변수 | 기본값 | 뜻 |
|------|--------|----|
| `MCP_MAX_CONCURRENT_CONNECTIONS` | 20 | 워크스페이스 단위 동시 connect 상한. 외부 HTTP transport 만 센다 |
| `MCP_CONNECT_TIMEOUT_MS` | 미설정 시 [타임아웃](#타임아웃) 기본값 | connect 타임아웃을 바꾼다 |
| `MCP_ALLOW_INSECURE_URL` | `false` | 로컬 개발용 우회 플래그. 운영에서 켜면 부팅 거부 |

`McpClientService` 는 이 세 변수를 `process.env` 로 직접 읽지 않고 ConfigService 의 `mcp.*` namespace(`registerAs('mcp')`, `common/config/mcp.config.ts`)로 읽는다. 서비스 계층의 환경 변수 접근을 한곳에 모으기 위해서다. `MCP_ALLOW_INSECURE_URL` 의 단일 출처는 `McpClientService.allowInsecureUrl` getter 이고, `McpToolProvider` 는 주입받은 인스턴스로 같은 값을 쓴다. 부팅 시점 값이라 바꾸면 재기동해야 반영된다.

## capabilities 캐시를 두지 않는다

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

타임아웃은 환경 변수로 바꿀 수 있다. 넘기면 [에러 처리](CLE-INT-MCP-ERROR.md)에 따라 격리한다.

## 연결 테스트

[통합 관리](CLE-INT-MANAGE.md)의 저장 전 연결 테스트(`POST /api/integrations/preview-test`)와 같은 방식이다. MCP 서비스의 테스트 순서는 다음과 같다.

1. `credentials.url` 이 `https://` 로 시작하는지 확인한다. 아니면 `MCP_HTTPS_REQUIRED` 다. SSRF 차단과 형식이 잘못된 URL 도 같은 코드로 모은다.
2. Streamable HTTP 클라이언트로 connect 한 뒤 `initialize` 를 부른다(10초 타임아웃). connect 직전에 호스트 이름을 해석해 주소를 검사하고([자격 증명과 URL 검증](#자격-증명과-url-검증) 3항), 막히면 `MCP_HTTPS_REQUIRED`, 해석이 시간을 넘기면 `MCP_TIMEOUT` 이다.
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

**실패 응답 형식**: `preview-test` 와 저장된 통합의 `POST /api/integrations/:id/test` 는 실패해도 예외를 던지지 않는다. HTTP 200 OK 본문에 `{ success: false, code, message }` 를 담아 돌려준다. MCP 테스트가 낸 실패의 `code` 는 [에러 코드](CLE-INT-MCP-ERROR.md#에러-코드) 중 `MCP_HTTPS_REQUIRED`·`MCP_AUTH_FAILED`·`MCP_CONNECT_FAILED`·`MCP_LIST_FAILED`·`MCP_TIMEOUT` 이다. connect 나 `tools/list` 가 `TimeoutError` 로 만료되면 `MCP_TIMEOUT` 이다. 화면은 이 본문을 그대로 보여 준다. `:id/test` 가 테스트 전에 거절하는 경우(자격 증명 복호화 실패 등)의 코드는 [통합 관리 「연결 테스트」](CLE-INT-MANAGE.md#연결-테스트) 가 정한다.

**이미 저장된 통합의 자격 증명 교체**: `POST /api/integrations/:id/rotate` 는 새 값으로 연결 테스트를 먼저 돌려 통과했을 때만 저장한다. 테스트가 실패하면 저장하지 않고 400 `INTEGRATION_TEST_FAILED` 에러 봉투로 거절한다. 결과 객체가 아니다. 테스트 결과의 `message` 와 `code` 를 싣는 자리는 [통합 관리 「에러 코드」](CLE-INT-MANAGE.md#에러-코드) 가 정한다. 신규 등록 미리보기인 `preview-test` 와 다른 경로다.

## 클라이언트 라이브러리

백엔드는 공식 TypeScript SDK `@modelcontextprotocol/sdk` 의 Streamable HTTP transport 모듈만 쓴다. stdio·websocket 모듈은 import 하지 않아 SDK import 범위를 줄인다. NestJS `McpClientModule` 이 SDK 를 감싸 워크스페이스 격리·로깅·타임아웃을 넣는다.

## Rationale

### stdio transport 를 지원하지 않는다

멀티테넌트 SaaS 백엔드에서 사용자마다 subprocess 를 spawn 하면 세 가지 문제가 있다. 프로세스·보안 격리 비용이 들고, 임의 명령 실행 권한이 드러나고, «워크스페이스 공용 자원» 모델과 맞지 않는다. 그래서 MVP 에서 뺐다. stdio 는 나중에 데스크톱 브리지 에이전트로 우회 노출하는 별도 스펙으로 나눈다.

### SSRF 우회 플래그를 throw 와 warn 으로 나눈다

운영 환경 부팅 차단에서 «절대 금지» 플래그(`MCP_ALLOW_INSECURE_URL`)는 부팅 throw 로, «정당한 용도가 있는» 플래그(`ALLOW_PRIVATE_HOST_TARGETS`, VPC 내부 호스트 같은 셀프 호스팅 용도)는 warn 으로 나눈다. 기준은 그 플래그에 정당한 운영 용도가 있느냐다. 잘못 나누면 정당한 셀프 호스팅 배포를 막거나(지나친 throw) SSRF 표면을 열어 둔다(지나친 warn).

### IPv4 를 품은 IPv6 리터럴을 품은 IPv4 로 판정한다 (2026-11-01)

외부 MCP 서버 URL 의 호스트가 IPv4 를 품은 IPv6 리터럴이면 품은 IPv4 를 IPv4 차단 대역으로 다시 판정한다. 작업은 NERV Task `CLE-T-DCQWEB` 다.

- 그때까지 MCP 가드는 점 표기(`::ffff:127.0.0.1`)만 보는 정규식으로 IPv4-mapped 를 판정했다. 그러나 Node 의 `URL` 은 hostname 을 `[::ffff:7f00:1]` 같은 16진 표기로 바꿔 돌려준다. 그래서 그 정규식은 한 번도 맞지 않았고 loopback · 메타데이터 주소가 통과했다.
- 판정 범위는 IPv4-mapped · IPv4-compatible · SIIT · NAT64 `/96` 넷이다. 근거는 [알림 웹훅 Rationale 「IPv4 를 품은 IPv6 리터럴을 품은 IPv4 로 판정한다 (2026-11-01)」](../CLE-IX/CLE-EIA-NOTIFY.md#ipv4-를-품은-ipv6-리터럴을-품은-ipv4-로-판정한다-2026-11-01) 에 있다. IPv4-mapped 만 판정하는 안은 기각했다. NAT64 망에서는 다른 표기로도 사설 IPv4 에 닿을 수 있기 때문이다.
- 두 가드는 IPv6 리터럴 정규화(`normalizeIpv6Literal`)와 품은 IPv4 추출(`embeddedIpv4FromIpv6`)을 같이 쓴다. 꺼낸 IPv4 를 판정하는 대역표는 가드마다 따로 있다. 한 모듈로 모으는 일은 NERV Task `CLE-T-753725` 가 맡는다.
- HTTP Request 노드 가드는 IPv4-mapped 만 판정한다. 두 범위를 맞출지는 NERV Task `CLE-T-63RSH6` 가 정한다.
- 본문 「자격 증명과 URL 검증」 2항에 더한 `localhost` · CGNAT · `0.0.0.0/8` · `::` 는 구현이 이미 막던 대역이다. 본문을 구현에 맞췄다.
- 이 헬퍼는 환경 변수를 읽지 않는다. MCP 의 우회 수단은 `MCP_ALLOW_INSECURE_URL` 뿐이다.

### 호스트 이름은 연결 직전에 해석해 주소를 검사한다 (2026-11-05)

외부 MCP 서버 URL 의 호스트 이름을 connect 직전에 DNS 로 해석하고, 돌아온 주소를 리터럴과 같은 판정으로 검사한다. 작업은 NERV Task `CLE-T-RAPNHB` 다.

- 그때까지 본문 3항은 «SDK 가 fetch 할 때 transport 가 같은 검증을 한 번 더 한다» 고 적었다. 그러나 SDK 의 Streamable HTTP transport 는 주소를 검사하지 않는다. 그래서 사설 주소로 풀리는 호스트 이름(예: `127.0.0.1` 을 돌려주는 공개 도메인)은 리터럴 검사를 통과해 그대로 연결됐다. 본문을 구현에 맞추는 안 대신 구현을 본문의 뜻에 맞췄다.
- 판정은 2항의 MCP 가드를 그대로 쓴다. IPv4 를 품은 IPv6 주소와 NAT64 도 리터럴과 같이 판정한다. HTTP Request 노드 가드(`assertSafeOutboundHostResolved`)를 가져다 쓰는 안은 기각했다. 그 가드는 `ALLOW_PRIVATE_HOST_TARGETS` 를 읽어 MCP 의 우회 수단이 둘이 되고, 판정 범위도 MCP 가드보다 좁다(「IPv4 를 품은 IPv6 리터럴을 품은 IPv4 로 판정한다 (2026-11-01)」).
- 차단 message 는 리터럴 차단과 같게 호스트 이름만 싣는다. 연결 테스트는 `MCP_HTTPS_REQUIRED` 의 message 를 그대로 화면에 돌려주므로, 해석된 주소를 실으면 등록 화면이 내부 DNS 를 알아보는 통로가 된다. 호스트 이름은 등록하는 사람이 직접 넣은 값이라 돌려줘도 새로 드러나는 정보가 없다. HTTP Request 노드가 차단 message 를 한 문장으로 일반화한 결정(CLE-NODE-HTTP Rationale 「사설망 차단 메시지 일반화 (2026-07-05)」)과 다른 이유다. 그 결정이 가리려던 것은 해석된 IP 와 차단 사유다.
- DNS 해석 실패는 막지 않고 넘긴다(fail-open). 해석되지 않는 호스트에는 연결도 되지 않으므로 SSRF 가 성립하지 않고, 실패는 connect 실패로 드러난다. HTTP Request 노드 가드의 구현(`assertSafeOutboundHostResolved`)도 해석 실패를 넘긴다.
- 해석 시간 초과는 넘기지 않는다. 해석은 connect 의 AbortController 타임아웃보다 앞에서 돌아서, 상한이 없으면 connect 를 따로 감싸지 않는 연결 테스트 요청은 해석이 끝날 때까지 응답 없이 기다린다. 시간 초과를 넘기는 쪽으로 정하면 DNS 응답을 늦추는 것만으로 검사를 건너뛸 수 있다. 그래서 해석에 connect 와 같은 상한을 두고, 넘기면 connect 시간 초과와 같은 `MCP_TIMEOUT` 으로 끝낸다.
- 검사와 연결 사이의 DNS rebinding 은 막지 못한다. 해석한 주소로 연결을 고정하려면 SDK 의 fetch 를 바꿔 끼워야 해서 미뤘다([미결 사항](CLE-INT-MCP.md#미결-사항)).
- 리다이렉트로 다른 호스트에 닿는 경로는 없다. `@modelcontextprotocol/sdk` 1.32 의 Streamable HTTP transport 는 `redirectPolicy` 를 주지 않으면 호스트가 같은 리다이렉트만 따라가고(같은 scheme · 포트, 또는 기본 포트의 `http` → `https`), 이 클라이언트는 그 옵션을 주지 않는다. HTTP Request 노드의 리다이렉트 홉 처리(`followRedirectsSafely`, CLE-T-FC2BWA)는 MCP transport 에 쓰지 않는다.

### capabilities 캐시를 채택하지 않는다 (R-wontdo-cached-capabilities)

**결정 (2026-07-16)**: `credentials.cached_capabilities` 캐시는 채택하지 않는다. 2026-06-03 부터 «미구현(Planned)» 으로 추적해 왔으나 들이지 않기로 확정했다.

검토한 참고 설계는 서버 등록 때 `initialize` 응답의 `capabilities` 를 `credentials.cached_capabilities` 에 저장해(write-only 가 아닌 메타데이터) 설정 화면 미리보기에 쓰는 것이었다. 외부 HTTP transport 전용이다. 내부 MCP 브리지는 capability 가 정적 상수라 캐시가 필요 없다.

근거는 다음과 같다.

- **기능 결손이 아니다.** 참고 설계 스스로 «저장된 capabilities 는 힌트일 뿐, 실행 시점 재조회가 우선한다» 고 정했다. 어차피 다시 조회하므로 캐시가 없애는 것은 설정 화면 미리보기의 첫 렌더 지연뿐이다. 지금의 live `initialize` 경로([연결 테스트](#연결-테스트))는 오히려 늘 최신이라는 정확성 이점이 있다.
- **최적화의 전제인 측정된 병목이 없다.** 2026-06-03 등재 뒤로 실사용 성능 불만이 나온 적이 없다. 측정 없는 선제 최적화는 이 문서가 stdio 미지원과 SSRF 우회 플래그에서 지켜 온 «비용 대비 실익» 판단과 어긋난다.
- **비용이 국소적이지 않다.** 통합 자격 증명 JSONB 스키마 변경은 자격 증명 저장 경로 전반에 걸친 인프라 변경이다. 여기에 캐시 무효화(서버 쪽 도구 목록 변경 감지)라는 새 문제가 더해진다. 힌트 성격의 최적화가 치를 값이 아니다.

**재개 조건**: 설정 화면 미리보기의 live `initialize` 지연이 실측으로 문제가 되면(예: 대형 카탈로그 서버에서 체감 지연) 새 plan 으로 다시 제안한다. 그때는 자격 증명 JSONB 확장만이 선택지가 아니므로 별도 캐시 테이블 + TTL, 노출 도구 목록 기반 지연 로딩 같은 대안도 함께 평가한다. 즉 이 결정은 캐시라는 아이디어를 영구히 버린 것이 아니라 지금 근거로는 이 구현 형태를 채택하지 않는다는 뜻이다.

**표기 선례**: 절 단위 비채택 표기(인라인 표시 + 전용 `R-wontdo-*` Rationale 절)는 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)의 `R-wontdo-rawws-rest`(2026-07-08)가 세운 방식을 따른다.
