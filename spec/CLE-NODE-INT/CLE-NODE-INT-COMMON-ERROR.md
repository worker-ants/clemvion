---
id: "CLE-NODE-INT-COMMON-ERROR"
title: "통합 노드 공통 — 에러 코드와 사설망 차단"
type: "convention"
version: 4
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-INT-COMMON"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT", "CLE-NODE-INT-COMMON"]
area: "CLE-NODE-INT"
content_hash: "b176664de07113c9e483f4042940f59318b41bd2f76b36354e89c3ed03448f52"
read_as: "approved_fallback"
task: "CLE-T-43KCNP"
source_paths: []
mirror_sha256: "49b28c769c780d2063b938f29a5d7c7a623f9b323f68119e2ddaf347504a609f"
etag: "sha256-0fc8bf586717211aec4a260276c59e8748399703ef1f576d654bd4cf64f772e9"
---
## 개요

이 문서는 [통합 노드 공통](CLE-NODE-INT-COMMON.md) 의 하위 문서로 통합 노드의 공통 에러 코드, 통합을 얻기 전 실패의 기록 규칙, 노드별 코드 색인, 사설망 차단(SSRF guard)을 정한다. 핸들러가 이 코드를 내는 단계는 [통합 노드 공통 — 핸들러 실행 계약](CLE-NODE-INT-COMMON-HANDLER.md) 이 정한다.

## 공통 에러 코드

| 코드 | 의미 |
|------|------|
| `INTEGRATION_TYPE_MISMATCH` | 참조한 통합의 `serviceType` 이 노드 기대 유형과 다르다. `assertUsable` 이 `IntegrationError` 를 던진다 |
| `INTEGRATION_NOT_CONNECTED` | 통합 상태가 `connected` 가 아니다(`expired`, `error`, `pending_install`). `assertUsable` 이 `IntegrationError` 를 던진다 |
| `INTEGRATION_INCOMPLETE` | credentials JSONB 에 서비스별 필수 필드가 없다. 각 핸들러가 자격 증명을 검증할 때 `IntegrationError` 를 던진다 |
| `INTEGRATION_CALL_FAILED` | 분류되지 않은 그 밖의 실패. `IntegrationError` 가 아닌 예외의 기본 코드다(`toLogError` fallback). 사설망 차단 가드가 차단 판정(`SsrfBlockedError`)이 아닌 오류를 던진 경우(가드 자체의 고장)도 이 코드로 나온다. 노드마다 시점 차이가 있다(HTTP Request 는 preflight 와 리다이렉트 홉이 다르다) |
| `INTEGRATION_SERVICE_UNAVAILABLE` | `IntegrationsService` 미주입 또는 workspace context 누락(배포 구성 에러). 에러 포트로 내보낸다 |

- **통합이 없거나 다른 워크스페이스 소속일 때**: `IntegrationsService.getForExecution` 안의 `requireEntity` 가 `NotFoundException({ code: 'RESOURCE_NOT_FOUND' })` 를 던진다. 이 예외는 `IntegrationError` 가 아니므로 전용 코드로 보존되지 않는다. 대부분의 노드는 `INTEGRATION_CALL_FAILED` 로, Send Email 노드는 `EMAIL_SEND_FAILED` 로 내보낸다. 별도의 `INTEGRATION_NOT_FOUND` 코드는 현재 코드에 없다(`integrations.service.ts` `requireEntity`, `_base/integration-handler-base.ts` `toLogError`).
- **[개인 통합 사용 판정](../CLE-INT/CLE-INT-MANAGE.md#개인-통합-사용-판정)을 통과하지 못한 개인 통합일 때**: 위와 같은 코드와 같은 문구로 실패한다. 노드 출력만 보고는 없는 통합, 다른 워크스페이스 통합, 남의 개인 통합을 구분할 수 없다.
- **통합을 얻기 전에 끝난 실행의 기록**: 통합을 얻기 전에 끝난 실패는 활동 로그를 남기지 않는다. 설정의 `integrationId` 가 가리키는 통합의 `last_used_at`·`last_error` 도 바꾸지 않는다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md) 의 «통합을 얻기 전 실패는 기록하지 않는다» 요구사항). 노드별 문서의 «매 호출 활동 로그» 서술은 통합을 얻은 뒤의 호출을 말한다. 유형 불일치·미연결·자격 증명 부족과 그 뒤의 실패는 통합을 얻은 뒤의 실패라 얻은 통합으로 활동 로그를 남긴다.
  - 통합을 얻기 전에 끝나는 실패는 워크스페이스 확인(1단계) 실패, 조회 거절(위 세 경우), 조회 중 일시 에러(DB 연결 에러 등), 자격 증명 읽기 실패다. 통합을 얻기 전의 노드 사전 검사 실패도 여기에 든다. Cafe24·MakeShop 노드의 API 클라이언트 미주입, operation 조회 실패(`CAFE24_UNKNOWN_OPERATION`·`MAKESHOP_UNKNOWN_OPERATION`), 필수 필드·조건 검사 실패(`CAFE24_MISSING_FIELDS`·`MAKESHOP_MISSING_FIELDS`), MakeShop 노드의 `MAKESHOP_INVALID_PAGINATION`, Database Query 노드의 파라미터 파싱 실패, Send Email 노드의 빈 수신자 확인 실패(`EMAIL_NO_RECIPIENTS`)가 해당한다. HTTP Request 노드는 인증 방식이 `none`·`custom` 이면 `integrationId` 가 남아 있어도 통합을 조회하지 않으므로 기록하지 않는다.
  - 자격 증명을 읽지 못한 경우(`IntegrationCredentialsUnreadableError`)는 조회가 통합을 찾았어도 얻지 못한 통합으로 본다. `getForExecution` 이 통합을 돌려주지 않고 이 예외를 던지기 때문이다. 근거는 [Rationale 「자격 증명을 읽지 못한 통합은 얻지 못한 통합으로 본다」](#자격-증명을-읽지-못한-통합은-얻지-못한-통합으로-본다-2026-11-05) 에 있다.
  - 서비스가 주입되지 않은 경우는 기록할 서비스가 없어 남지 않는다.
- **기록할 통합은 얻은 통합뿐이다**: `logUsage` 는 통합 ID 대신 `getForExecution` 이 돌려준 통합을 받는다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md) 의 «얻은 통합에만 기록한다» 요구사항). 얻지 못한 통합은 넘길 수 없으므로 위 규칙을 핸들러와 도구 프로바이더가 따로 지키지 않아도 된다. 다른 워크스페이스 통합도 `getForExecution` 이 돌려주지 않으므로 기록되지 않는다.
- **에러 포트 라우팅**: 위 코드가 생기는 모든 경우는 핸들러 안에서 잡혀 `port: 'error'` 와 `output.error.{code, message, details?}` 로 나간다. 다섯 노드 모두 Send Email 노드의 catch 패턴으로 통일했다. `IntegrationError` 를 throw 해서 노드 실행이 실패하는 경로는 없다. 모든 `IntegrationError.code` 는 `output.error.code` 로 나온다. 통합을 얻은 뒤의 실패는 활동 로그에 `status: 'failed'` 와 `error: {code, message}` 로 기록한다. 통합을 얻기 전의 실패는 위 «통합을 얻기 전에 끝난 실행의 기록» 대로 남기지 않는다.
- 노드별 코드(`HTTP_*`, `DB_*`, `EMAIL_*`, `CAFE24_*`, `MAKESHOP_*`)와 `INTEGRATION_AUTH_UNSUPPORTED`(HTTP 전용)는 각 노드 문서가 정한다. 어느 코드가 어느 문서에 있는지는 아래 "노드별 코드 색인" 에 모았다.
- 자격 증명을 복호화할 수 없을 때(`IntegrationCredentialsUnreadableError`)의 출력 코드는 정해지지 않았다. [미결 사항](CLE-NODE-INT-COMMON.md#미결-사항) 참조.

### 노드별 코드 색인

공통 코드 밖의 `output.error.code` 는 노드마다 다르다. 코드마다 발생 조건, 출력 모양, 활동 로그 기록은 각 노드 문서의 에러 코드 절이 단일 기준이다. 이 표에는 코드가 어느 문서에 있는지만 적는다.

| 노드 | 노드 고유 코드 |
|------|----------------|
| [HTTP Request](CLE-NODE-HTTP.md#에러-코드) | `HTTP_4XX`·`HTTP_5XX`(활동 로그에는 `HTTP_{status}`), `HTTP_TRANSPORT_FAILED`, `HTTP_BLOCKED`, `INTEGRATION_AUTH_UNSUPPORTED` |
| [Database Query](CLE-NODE-DBQUERY.md#에러-코드) | `DB_QUERY_FAILED`, `DB_CONNECTION_ERROR`, `DB_CONSTRAINT_VIOLATION`, `DB_PERMISSION_DENIED`, `DB_HOST_BLOCKED`, `INVALID_PARAMETERS` |
| [Send Email](CLE-NODE-EMAIL.md#에러-코드) | `EMAIL_SEND_FAILED`, `EMAIL_HOST_BLOCKED`, `EMAIL_NO_RECIPIENTS` |
| [Cafe24](CLE-NODE-CAFE24.md#에러-코드) | `CAFE24_4XX`·`CAFE24_404`·`CAFE24_422`·`CAFE24_5XX`, `CAFE24_AUTH_FAILED`, `CAFE24_RATE_LIMITED`, `CAFE24_TRANSPORT_FAILED`, `CAFE24_UNKNOWN_OPERATION`, `CAFE24_MISSING_FIELDS`, `CAFE24_INVALID_MALL_ID` |
| [MakeShop](CLE-NODE-MAKESHOP.md#에러-코드) | `MAKESHOP_4XX`·`MAKESHOP_404`·`MAKESHOP_422`·`MAKESHOP_5XX`, `MAKESHOP_AUTH_FAILED`, `MAKESHOP_RATE_LIMITED`, `MAKESHOP_TRANSPORT_FAILED`, `MAKESHOP_UNKNOWN_OPERATION`, `MAKESHOP_MISSING_FIELDS`, `MAKESHOP_INVALID_PAGINATION`, `MAKESHOP_INVALID_SHOP_UID` |

- Cafe24 노드가 403 에 어떤 코드를 내는지는 정의가 갈린다. [Cafe24 노드 미결 사항](CLE-NODE-CAFE24.md#미결-사항) 참조.
- 통합 연결 테스트만 쓰는 코드(`EMAIL_CONNECT_FAILED`·`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_AUTH_FAILED`·`HTTP_SERVER_ERROR`·`HTTP_CONNECT_FAILED`)는 노드 출력에 나오지 않는다. [서비스별 인증 방식과 자격 증명](../CLE-INT/CLE-INT-AUTH.md)에서 정한다. 사설망 차단 코드(`HTTP_BLOCKED`·`DB_HOST_BLOCKED`·`EMAIL_HOST_BLOCKED`)는 노드와 연결 테스트가 같이 쓴다.

## 사설망 차단

사설망 차단(SSRF guard)은 통합 노드가 사설·loopback·클라우드 메타데이터 주소로 연결하지 못하게 막는 검사다.

| 노드 | 검사 대상 | 검사 시점 | 차단 코드 |
|------|-----------|-----------|-----------|
| HTTP Request | 요청 URL 의 호스트. 모든 인증 방식(`none`·`integration`·`custom`) | 요청 전 preflight, 통합 인증에서 따라가는 리다이렉트 홉마다, 그리고 요청이 연결할 때 | `HTTP_BLOCKED` |
| Database Query | `credentials.host` | 자격 증명 충족 검증 직후, 풀 연결 전 | `DB_HOST_BLOCKED` |
| Send Email | `credentials.host` (SMTP 호스트) | 통합 조회 직후, SMTP 발송 전 | `EMAIL_HOST_BLOCKED` |

- 막는 대역은 loopback, RFC1918 사설 대역, link-local, CGNAT, IPv6 link-local·ULA 다. 호스트 이름은 DNS 로 해석한 뒤 IP 를 다시 검사한다(DNS rebinding 방어, `assertSafeOutboundHostResolved`). HTTP Request 는 그 전에 호스트 리터럴도 검사한다(`assertSafeOutboundUrl`).
- DNS rebinding 방어의 범위는 노드마다 다르다. 위 검사는 연결 전에 한 번 푼 결과를 본다. HTTP Request 와 HTTP 통합 연결 테스트는 요청이 연결할 때 푼 주소도 같은 대역으로 다시 판정한다(`safeOutboundDispatcher`). 그래서 검사와 연결 사이에 DNS 응답이 바뀌어도 막힌 대역에 연결하지 않는다([HTTP Request 노드 — 실행 로직](CLE-NODE-HTTP-EXEC.md) 8단계). Database Query · Send Email 은 연결 시점 판정이 없어서 검사와 연결 사이의 응답 변경은 egress 방화벽으로 막아야 한다. 외부 MCP 서버의 연결 시점 판정은 [MCP 클라이언트 — 연결과 URL 검증](../CLE-INT/CLE-INT-MCP-CONN.md), LLM 엔드포인트의 한계는 [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) 가 정한다.
- 기본은 차단이다(secure-by-default). 셀프 호스팅에서 내부 DB·on-prem API·내부 SMTP relay 같은 사설망 대상을 정당하게 불러야 할 때만 사설망 허용 플래그 `ALLOW_PRIVATE_HOST_TARGETS=true` 를 켠다. 외부 egress 방화벽이 있다는 전제다.
- 세 노드는 이 플래그 하나를 함께 쓴다. AI 에이전트의 외부 MCP 서버는 별도 정책(`MCP_ALLOW_INSECURE_URL`)을 따른다. [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md)에서 정한다.
- MakeShop 노드는 호출 호스트가 `connect.makeshop.co.kr` 하나로 고정돼 사용자 입력이 호스트를 정하지 않는다. 그래서 이 가드를 쓰지 않고 `shop_uid` 형식 검증으로 경로 주입을 막는다([MakeShop 노드](CLE-NODE-MAKESHOP.md)).
- 차단 코드는 차단 판정(`SsrfBlockedError`)에만 쓴다. 가드가 판정이 아닌 오류를 던지면(예: DNS 해석기가 낸 예기치 않은 예외) `INTEGRATION_CALL_FAILED` 로 내보낸다. HTTP Request 의 리다이렉트 홉에서 같은 고장이 나면 `HTTP_TRANSPORT_FAILED` 가 된다. 두 시점의 코드를 통일할지는 [HTTP Request 노드](CLE-NODE-HTTP.md)의 미결 사항이다. Send Email 노드는 `IntegrationError` 가 아닌 실패를 모두 `EMAIL_SEND_FAILED` 로 흡수하므로 `INTEGRATION_CALL_FAILED` 를 출력하지 않는다.
- 위 규칙의 예외가 하나 있다. HTTP Request 노드는 통합 인증에서 리다이렉트를 5홉 넘게 따라가야 하면 차단 판정 없이 `HTTP_BLOCKED` 를 낸다. 메시지는 차단 판정과 같은 일반화 문구다. 사람이 2026-11-14 에 이 예외를 받아들이기로 정했다. 이 예외는 그 경우에만 쓰고 다른 실패로 넓히지 않는다. 근거는 [HTTP Request 노드 — 출력과 에러](CLE-NODE-HTTP-OUTPUT.md) Rationale 「3xx 와 리다이렉트 한도 초과의 코드를 바꾸지 않는다」 에 있다.
- 클라이언트에 나가는 `output.error.message` 에는 차단된 호스트나 IP 를 넣지 않는다. 일반화된 문구만 쓴다(내부망 정찰 방지, CWE-209). 원본 상세를 어디에 남기는지는 정의가 갈린다. [미결 사항](CLE-NODE-INT-COMMON.md#미결-사항) 참조.

## Rationale

### 사설망 허용 플래그 하나를 세 노드가 공유

HTTP Request·Database Query·Send Email 노드는 노드별 플래그를 새로 만들지 않고 `ALLOW_PRIVATE_HOST_TARGETS` 하나를 쓴다. 통합 노드 전체의 보안 자세(기본 차단, 셀프 호스팅만 해제)를 한 가지로 유지하기 위해서다. HTTP Request 노드가 모든 인증 방식에 가드를 적용하게 된 배경은 [HTTP Request 노드](CLE-NODE-HTTP.md) Rationale 에 있다. Database Query 노드의 전용 차단 코드 배경은 [Database Query 노드](CLE-NODE-DBQUERY.md) Rationale 에 있다.

### 차단 코드를 판정에만 쓰는 이유

막힌 적 없는 요청을 "막혔다" 고 보고하면 없는 사실을 사용자에게 알리고 활동 로그에도 남기게 된다. 그래서 가드 자체의 고장은 차단 코드가 아니라 분류되지 않은 실패(`INTEGRATION_CALL_FAILED`)로 내보낸다.

HTTP Request 노드의 리다이렉트 한도 초과는 이 원칙의 예외다. 판정 없이 `HTTP_BLOCKED` 를 낸다. 2026-11-13 에 지금 동작을 그대로 적었고, 2026-11-14 에 NERV Task `CLE-T-43KCNP` 에서 사람이 전용 코드를 만들지 않고 받아들인 예외로 두기로 정했다. 근거는 [HTTP Request 노드 — 출력과 에러](CLE-NODE-HTTP-OUTPUT.md#3xx-와-리다이렉트-한도-초과의-코드를-바꾸지-않는다-2026-11-14) Rationale 에 있다. [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 의 `HTTP_BLOCKED` 행에는 NERV Task `CLE-T-6G3084` 가 이 예외를 적었다.

### 연결 시점 판정은 대역표와 우회 플래그를 호출자가 정한다 (2026-11-14)

NERV Task `CLE-T-BS1WD1` · `CLE-T-GAQCF9` 에서 HTTP Request · 외부 MCP 서버 · 알림 웹훅의 연결에 연결 시점 주소 판정을 넣었다. NERV Task `CLE-T-NESSYD` 에서 HTTP 통합 연결 테스트도 HTTP Request 와 같은 판정 dispatcher 를 쓰게 했다. 세 경로는 공용 헬퍼(`createGuardedLookupDispatcher`)를 쓰고 판정 함수는 각 경로가 넘긴다. HTTP Request 는 이 문서의 대역표와 `ALLOW_PRIVATE_HOST_TARGETS` 를, MCP 는 MCP 의 대역표와 `MCP_ALLOW_INSECURE_URL` 을, 알림 웹훅은 알림의 대역표와 DNS 가드 플래그(`NOTIFICATION_ENFORCE_DNS_REBIND_GUARD`)를 그대로 쓴다([EIA 알림 웹훅 — SSRF 방지](../CLE-IX/CLE-EIA-NOTIFY-SSRF.md)). 대역표와 우회 플래그를 합치는 일은 이번 범위가 아니다. 합치면 각 경로의 Rationale 이 함께 바뀐다. HTTP Request 쪽 근거는 [HTTP Request 노드 — 실행 로직](CLE-NODE-HTTP-EXEC.md) Rationale 「연결할 때 푼 주소를 다시 판정한다」 에 있다.

### 거절된 조회는 임시 장치로 건너뛴다 (2026-10-25)

> 2026-11-05 NERV Task `CLE-T-PTC4SF` 에서 이 장치를 지웠다. 아래는 결정 당시 기록이다. 지금 규칙은 [공통 에러 코드](#공통-에러-코드) 의 «통합을 얻기 전에 끝난 실행의 기록» 과 [「자격 증명을 읽지 못한 통합은 얻지 못한 통합으로 본다」](#자격-증명을-읽지-못한-통합은-얻지-못한-통합으로-본다-2026-11-05) 에 있다.

얻기와 검증을 나눈 뒤에도(`CLE-T-1BQZ10`) `logUsage` 의 서명은 그대로라 다섯 핸들러는 실패하면 설정의 `integrationId` 로 기록했다. 그대로 두면 개인 통합 사용 판정에서 거절된 통합의 활동 탭과 `last_error` 에 남의 워크플로우 실행이 남았다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md) 의 «남의 개인 통합은 없는 통합과 같게 실패한다» · «통합을 얻기 전 실패는 기록하지 않는다» 요구사항). 그래서 서명을 바꾸기 전까지 임시 장치를 두었다.

- **동작**: 공통 베이스의 `rejectedLookups` 가 노드 실행마다 만드는 실행 컨텍스트 복사본마다 404(`NotFoundException`)로 거절된 조회의 통합 ID 를 담았다. 공통 베이스의 `logUsage` 는 담긴 ID 의 기록을 건너뛰었다. 이 복사본은 노드 실행마다 하나라서([노드 핸들러 계약 「핸들러용 실행 컨텍스트는 노드 실행마다 하나다」](../CLE-EXEC/CLE-EXEC-HANDLER.md#핸들러용-실행-컨텍스트는-노드-실행마다-하나다)) 다른 노드 실행이나 병렬 분기의 거절과 섞이지 않았다.
- **담는 기준은 «없는 통합과 같은 거절이 확정됐는가» 였다.** 404 는 통합이 없거나 다른 워크스페이스 소속이거나 개인 통합 사용 판정을 통과하지 못한 경우다. 셋 모두 이 실행에서 쓸 수 없는 통합으로 확정된 경우다. DB 연결 에러 같은 일시 에러는 통합이 있는지 모르는 경우라 담지 않았다. 자격 증명을 읽지 못한 경우(`IntegrationCredentialsUnreadableError`)는 조회가 통합을 찾은 경우라 담지 않았고 분류는 `CLE-T-PTC4SF` 에 맡겼다.
- **조회가 성공하면 그 ID 를 지웠다.** 노드 재시도 정책이면 `ExecutionEngineService.executeWithRetry` 가 같은 복사본으로 핸들러를 다시 부른다. 앞 시도의 조회가 거절됐어도 같은 노드 실행의 다음 시도가 통합을 얻었다면 그 시도는 얻은 통합으로 실행한 것이라 기록해야 했다. 담는 기준은 한 번의 조회 결과를 보고 지움은 같은 노드 실행의 다음 조회 결과를 보므로 두 규칙은 부딪치지 않았다.
- **남는 경로**: 워크스페이스 확인 실패, 일시 에러, 자격 증명 읽기 실패의 기록은 이 장치가 막지 않았다. 이 경로에서는 설정의 `integrationId` 가 가리키는 통합에 기록이 남았다. 받아들인 근거는 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) Rationale 「개인 통합의 역할 하한과 노드 사용 기준을 정한다」 이행의 «활동 로그 규칙은 노드 사용 기준보다 늦게 내지 않는다» 항목에 있다.
- **걷는 시점**: `logUsage` 를 얻은 통합만 받는 서명으로 바꾸면 얻지 못한 통합은 넘길 값이 없다. 그때 이 장치와 `acquireIntegration` 의 기록 코드를 지우기로 했고, 2026-11-05 에 NERV Task `CLE-T-PTC4SF` 가 그렇게 했다.

### 자격 증명을 읽지 못한 통합은 얻지 못한 통합으로 본다 (2026-11-05)

NERV Task `CLE-T-PTC4SF` 가 `logUsage` 를 얻은 통합만 받는 서명으로 바꾸면서 자격 증명을 읽지 못한 통합을 어느 쪽으로 볼지 정했다. `getForExecution` 은 통합을 찾은 뒤 복호화에 실패하면 통합을 돌려주지 않고 `IntegrationCredentialsUnreadableError` 를 던진다. 이 경우를 얻지 못한 통합으로 본다. 핸들러에 넘길 통합이 없으므로 활동 로그를 남기지 않고 `last_used_at`·`last_error` 도 바꾸지 않는다.

- «얻은 통합» 의 기준을 `getForExecution` 이 돌려준 통합 하나로 둔다. 예외에 엔티티를 실어 기록하게 하면 복호화에 실패한 엔티티가 핸들러의 catch 와 로그 경로로 흘러간다. 예외에 통합을 싣지 않는 이유는 [「통합을 얻는 단계와 검증하는 단계를 나눈다」](CLE-NODE-INT-COMMON-HANDLER.md#통합을-얻는-단계와-검증하는-단계를-나눈다-2026-10-25) 와 같다.
- 이 경우만 통합 ID 로 기록하면 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) 의 «얻은 통합에만 기록한다» 요구사항이 없앤 ID 기록 경로가 다시 생긴다. `logUsage` 가 다시 ID 를 받아야 하므로 얻은 통합에만 기록한다는 규칙을 서명으로 지킬 수 없다.
- 이 상태는 활동 로그가 없어도 드러난다. 통합 응답(`IntegrationsService.toPublic`)에서 자격 증명을 읽지 못한 통합은 `status: 'error'`·`statusReason: 'credentials_unreadable'`·`credentialsStatus: 'needs_reauth'` 로 나간다. 사용자는 이 표시를 보고 통합을 다시 연결한다([통합 데이터와 흐름 「이미 저장된 값」](../CLE-INT/CLE-INT-DATA.md#이미-저장된-값)).
- 기각: 예외에 통합을 실어 기록하는 안. 위 첫째 이유로 뺐다.
- 기각: 이 경우만 통합 ID 로 기록하는 안. 위 둘째 이유로 뺐다.
- 이 예외의 노드 출력 코드는 이 결정으로 정하지 않았다. [미결 사항](CLE-NODE-INT-COMMON.md#미결-사항) 의 «자격 증명 복호화 실패의 출력 코드» 는 그대로 남는다.
