---
id: "CLE-NODE-HTTP"
title: "HTTP Request 노드"
type: "feature"
version: 9
status: "approved"
requirements: ["REQ-HTTP-001", "REQ-HTTP-002", "REQ-HTTP-003", "REQ-HTTP-004", "REQ-HTTP-005", "REQ-HTTP-006", "REQ-HTTP-007", "REQ-HTTP-008", "REQ-HTTP-009", "REQ-HTTP-010", "REQ-HTTP-011", "REQ-HTTP-012", "REQ-HTTP-013", "REQ-HTTP-014", "REQ-HTTP-015", "REQ-HTTP-016", "REQ-HTTP-017", "REQ-HTTP-018", "REQ-HTTP-019", "REQ-HTTP-020", "REQ-HTTP-021", "REQ-HTTP-022", "REQ-HTTP-023", "REQ-HTTP-024", "REQ-HTTP-025", "REQ-HTTP-026", "REQ-HTTP-027", "REQ-HTTP-028", "REQ-HTTP-029", "REQ-HTTP-030", "REQ-HTTP-031", "REQ-HTTP-032", "REQ-HTTP-033", "REQ-HTTP-034", "REQ-HTTP-035", "REQ-HTTP-036", "REQ-HTTP-037"]
basis_superseded: false
parent: "CLE-NODE-INT"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT"]
area: "CLE-NODE-INT"
content_hash: "0631b95cb05fe7311d67838324b069a667018d730ccc2ed15de3fd5471786666"
read_as: "approved_fallback"
task: "CLE-T-6H2AKH"
source_paths: ["spec/4-nodes/4-integration/1-http-request.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "619bb77e022fcbfed6e50453ce70c8b5e47b64cf4c26acf3c742859f7f022b2f"
etag: "sha256-0b08decc5e57b4d96d73afe1877db8f2a1065a9e47d8a9bde4177d24ea750cfa"
---
> 구현 상태: 부분 구현 (바이너리 처리·리다이렉트 토글·SSL 검증 토글은 미구현) · 원문: `spec/4-nodes/4-integration/1-http-request.md`, `spec/4-nodes/_product-overview.md` (§7.1) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

HTTP Request 노드(`http_request`)는 외부 HTTP API 를 부르는 범용 통합 노드다. 인증 없이 쓸 수도 있고, 통합을 참조해 인증 헤더·쿼리·`base_url` 을 자동으로 넣을 수도 있고, 사용자가 헤더를 직접 적을 수도 있다. 응답은 `success`·`error` 두 포트로 나뉜다. 런타임 실패는 에러 포트(`port: 'error'`)와 `output.error` 로 내보낸다. 노드 취소 신호(`context.abortSignal`)로 끊긴 요청은 실패가 아니므로 에러 포트로 보내지 않고 `AbortError` 를 엔진에 전달한다. 지금 이 신호를 만드는 곳은 Parallel 노드의 `cancel-others-on-fail` 정책 하나뿐이다. 사용자의 실행 중지는 이 신호를 만들지 않는다([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md)).

통합 노드 공통 규약(통합 참조, 핸들러 6단계 계약, 공통 에러 코드, 사설망 차단, 캔버스 요약)은 [통합 노드 공통](CLE-NODE-INT-COMMON.md)이 정한다. 이 문서는 HTTP Request 노드만의 설정·동작·출력을 정한다. HTTP 통합의 자격 증명 스키마(`auth_type` 등)는 [서비스별 인증 방식과 자격 증명](../CLE-INT/CLE-INT-AUTH.md)에서, 노드 실행이 통합 상태를 바꾸는 범위는 [통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md)에서 정한다.

## 요구사항

- REQ-HTTP-001 WHEN 노드가 실행되면 THE SYSTEM SHALL 설정한 method(`GET`·`POST`·`PUT`·`PATCH`·`DELETE`·`HEAD`·`OPTIONS`)로 요청을 보낸다. (원본: ND-HR-01)
- REQ-HTTP-002 WHEN 사용자가 노드를 설정하면 THE SYSTEM SHALL URL·헤더·쿼리 파라미터·요청 본문 입력을 제공하고 각 값에서 표현식을 허용한다. (원본: ND-HR-02)
- REQ-HTTP-003 WHEN 사용자가 인증 방식을 고르면 THE SYSTEM SHALL `none`·`integration`·`custom` 세 가지를 제공한다. (원본: ND-HR-03)
- REQ-HTTP-004 WHEN `responseType` 이 `json` 이면 THE SYSTEM SHALL 응답 본문을 JSON 으로 파싱하고 파싱에 실패하면 `output.response` 를 `null` 로 둔다. (원본: ND-HR-04)
- REQ-HTTP-005 WHEN `responseType` 이 `text` 이면 THE SYSTEM SHALL 응답 본문을 문자열로 담는다. (원본: ND-HR-04)
- REQ-HTTP-006 WHEN `responseType` 이 `binary` 이면 THE SYSTEM SHALL 응답을 바이너리 전용으로 디코딩한다. (미구현) (원본: ND-HR-04)
- REQ-HTTP-007 WHEN 응답이 2xx 이면 THE SYSTEM SHALL `success` 포트로 내보낸다. (원본: ND-HR-05)
- REQ-HTTP-008 WHEN 응답이 3xx·4xx·5xx 이거나 전송이 실패하면 THE SYSTEM SHALL `error` 포트로 내보낸다. 노드 취소 신호로 끝난 요청은 전송 실패로 보지 않는다(REQ-HTTP-033). (원본: ND-HR-05)
- REQ-HTTP-009 WHEN 노드 자체 `timeout`(ms)이 지나면 THE SYSTEM SHALL 요청을 중단하고 `HTTP_TRANSPORT_FAILED` 로 에러 포트에 내보낸다. (원본: ND-HR-06)
- REQ-HTTP-010 WHEN 사용자가 `followRedirects` 를 끄면 THE SYSTEM SHALL 리다이렉트를 따라가지 않는다. (미구현) (원본: ND-HR-06)
- REQ-HTTP-011 WHEN 사용자가 `verifySsl` 을 끄면 THE SYSTEM SHALL SSL 인증서 검증을 건너뛴다. (미구현) (원본: ND-HR-06)
- REQ-HTTP-012 WHEN `bodyType` 이 `binary` 이면 THE SYSTEM SHALL 본문을 바이너리 전용으로 직렬화한다. (미구현)
- REQ-HTTP-013 IF 헤더나 쿼리 파라미터의 key·value 에 CRLF 가 들어 있으면 THE SYSTEM SHALL 스키마 단계에서 거부한다.
- REQ-HTTP-014 IF 설정 형식이 잘못되면 THE SYSTEM SHALL 사전 검증 에러로 실행을 실패시킨다.
- REQ-HTTP-015 WHILE 인증 방식이 `integration` 인 동안 THE SYSTEM SHALL 통합의 `auth_type` 에 맞춰 헤더나 쿼리에 자격 증명을 넣는다.
- REQ-HTTP-016 IF 통합의 `auth_type` 이 `api_key`·`bearer_token`·`basic` 이 아니면 THE SYSTEM SHALL `INTEGRATION_AUTH_UNSUPPORTED` 로 에러 포트에 내보낸다.
- REQ-HTTP-017 WHEN 통합에 `base_url` 이 있고 `url` 이 절대 URL 이 아니면 THE SYSTEM SHALL `{base_url}/{url}` 로 결합하고 중복 슬래시를 정규화한다.
- REQ-HTTP-018 WHEN 헤더를 병합하면 THE SYSTEM SHALL 통합 자격 증명 헤더가 사용자 입력 헤더를 덮어쓰게 한다.
- REQ-HTTP-019 WHEN 요청을 보내기 전이면 THE SYSTEM SHALL 인증 방식과 관계없이 사설망 차단을 적용한다.
- REQ-HTTP-020 IF 대상 호스트가 사설망 대역으로 판정되면 THE SYSTEM SHALL `HTTP_BLOCKED` 와 호스트를 드러내지 않는 일반화 메시지로 에러 포트에 내보낸다.
- REQ-HTTP-021 IF 사설망 차단 가드가 차단 판정이 아닌 오류를 preflight 에서 던지면 THE SYSTEM SHALL `INTEGRATION_CALL_FAILED` 로 에러 포트에 내보낸다.
- REQ-HTTP-022 WHILE 인증 방식이 `integration` 인 동안 THE SYSTEM SHALL 3xx 응답을 최대 5홉까지 직접 따라가고 홉마다 사설망 차단을 다시 검사한다.
- REQ-HTTP-023 IF 리다이렉트가 5홉을 넘거나 리다이렉트 대상이 차단되면 THE SYSTEM SHALL `HTTP_BLOCKED` 로 에러 포트에 내보낸다.
- REQ-HTTP-024 WHILE 인증 방식이 `none` 이나 `custom` 인 동안 THE SYSTEM SHALL 3xx 응답을 따라가지 않고 그대로 에러 포트로 반환한다.
- REQ-HTTP-025 WHEN 설정을 에코하면 THE SYSTEM SHALL 스키마 필드를 명시적으로 열거하고 spread 를 쓰지 않는다.
- REQ-HTTP-026 WHEN 설정의 `url` 을 에코하면 THE SYSTEM SHALL URL 의 `user:pass@` 를 지우고 자격 증명 후보 쿼리 값을 `[REDACTED]` 로 바꾼다.
- REQ-HTTP-027 WHEN 응답 헤더를 출력하면 THE SYSTEM SHALL key 를 소문자로 바꾸고 자격 증명 형태의 헤더와 `Location` 값을 `[REDACTED]` 로 바꾼다.
- REQ-HTTP-028 WHEN 실제로 보낸 요청 본문이 256KB 를 넘으면 THE SYSTEM SHALL `output.requestBody` 를 자르고 `output.bodyTruncated` 를 `true` 로 둔다.
- REQ-HTTP-029 WHILE 인증 방식이 `integration` 인 동안 THE SYSTEM SHALL 통합을 얻은 뒤의 호출 가운데 노드 취소 신호로 끝난 호출을 빼고 성공·실패마다 활동 로그를 1건 남긴다.
- REQ-HTTP-030 WHILE 인증 방식이 `none` 이나 `custom` 인 동안 THE SYSTEM SHALL 활동 로그를 남기지 않는다.
- REQ-HTTP-031 WHEN 활동 로그를 남기면 THE SYSTEM SHALL `api_label` 을 NULL, `api_method` 를 정규화한 method, `api_path` 를 query string 을 뺀 호스트+경로로 채운다.
- REQ-HTTP-032 WHEN dry-run 으로 실행되면 THE SYSTEM SHALL 외부 요청 없이 mock 결과를 반환하고 사설망 차단 검사를 건너뛴다.
- REQ-HTTP-033 WHEN 노드 취소 신호(`context.abortSignal`)로 진행 중인 요청(리다이렉트 홉과 응답 본문 읽기 포함)이 `AbortError` 로 끝나면 THE SYSTEM SHALL 에러 포트로 내보내지 않고 `AbortError` 를 그대로 던져 엔진에 전달한다.
- REQ-HTTP-034 WHEN 리다이렉트 홉 대상의 출처(scheme·host·port)가 첫 요청의 출처와 다르면 THE SYSTEM SHALL 그 홉부터 통합 자격 증명 헤더, 통합 공용 헤더(`default_headers`)와 이름이 같은 헤더, `Authorization`·`Proxy-Authorization`·`Cookie` 헤더를 싣지 않고 대상 URL 에서 통합 자격 증명 쿼리를 뺀다.
- REQ-HTTP-035 WHILE 리다이렉트 체인에서 출처가 한 번 바뀐 뒤에는 THE SYSTEM SHALL 첫 요청의 출처로 돌아오는 홉에도 REQ-HTTP-034 에서 뺀 자격 증명을 다시 싣지 않는다.
- REQ-HTTP-036 WHEN 리다이렉트 응답이 303 이고 요청 method 가 `GET`·`HEAD` 가 아니거나 301·302 이고 요청 method 가 `POST` 이면 THE SYSTEM SHALL 다음 홉을 본문 없는 `GET` 으로 보내고 본문 헤더(`Content-Type`·`Content-Encoding`·`Content-Language`·`Content-Location`·`Content-Length`)를 뺀다.
- REQ-HTTP-037 WHEN 리다이렉트 응답이 REQ-HTTP-036 에 해당하지 않으면 THE SYSTEM SHALL 다음 홉에 직전 홉의 method 와 본문을 그대로 보낸다.

## 하위 문서

- [HTTP Request 노드 — 실행 로직](CLE-NODE-HTTP-EXEC.md): 설정 정규화부터 정리까지의 실행 단계, 인증 유형별 자격 증명 적용, 리다이렉트 홉의 자격 증명과 method, 활동 로그. 요구사항 REQ-HTTP-001, REQ-HTTP-009, REQ-HTTP-010, REQ-HTTP-011, REQ-HTTP-012, REQ-HTTP-015 ~ REQ-HTTP-019, REQ-HTTP-021 ~ REQ-HTTP-026, REQ-HTTP-029 ~ REQ-HTTP-037.
- [HTTP Request 노드 — 출력과 에러](CLE-NODE-HTTP-OUTPUT.md): 성공 · 4xx·5xx 응답 · 전송 실패 케이스의 출력 구조와 필드, 사전 검증 에러, 런타임 에러 코드 표와 `details.url` 규칙. 요구사항 REQ-HTTP-004 ~ REQ-HTTP-008, REQ-HTTP-013, REQ-HTTP-014, REQ-HTTP-016, REQ-HTTP-020, REQ-HTTP-023, REQ-HTTP-026 ~ REQ-HTTP-028, REQ-HTTP-033.
- 이 문서: 설정 · 설정 화면 · 포트(REQ-HTTP-002, REQ-HTTP-003).
- 두 하위 문서에 함께 걸린 REQ-HTTP-016 · REQ-HTTP-023 · REQ-HTTP-026 · REQ-HTTP-033 은 언제 그렇게 동작하는지를 [실행 로직](CLE-NODE-HTTP-EXEC.md)이 정본으로 다루고, 그때 나가는 에러 코드 · 출력 필드는 [출력과 에러](CLE-NODE-HTTP-OUTPUT.md)가 정본으로 다룬다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `method` | Enum | ✓ | `GET` | `GET` / `POST` / `PUT` / `PATCH` / `DELETE` / `HEAD` / `OPTIONS` |
| `url` | String (표현식) | ✓ | — | 요청 URL. 설정 에코에서는 `user:pass@` 와 자격 증명 쿼리 파라미터(`api_key`, `token`, `signature` 등)를 지우거나 가린다(노드 출력 규약 Principle 7) |
| `authentication` | Enum | ✓ | `none` | `none` / `integration` / `custom` |
| `integrationId` | UUID | — | — | `authentication='integration'` 일 때 필수([통합 노드 공통](CLE-NODE-INT-COMMON.md) 통합 참조) |
| `headers` | KeyValue[] | — | `[]` | 요청 헤더. `{key, value}` 항목. CRLF 가 든 입력은 스키마 단계에서 거부 |
| `queryParams` | KeyValue[] | — | `[]` | URL 쿼리 파라미터. `headers` 와 같은 규약 |
| `body` | unknown | — | — | 요청 본문. `bodyType` 에 따라 JSON 객체·문자열·KeyValue[] 등 |
| `bodyType` | Enum | — | `json` | `json` / `form-data` / `x-www-form-urlencoded` / `raw` / `binary`. 옛 값 `form` 은 `x-www-form-urlencoded` 로 읽는다. `raw` 와 `binary` 는 현재 같은 처리다(문자열은 그대로, 객체는 `JSON.stringify`). `binary` 전용 처리는 미구현(Planned) |
| `responseType` | Enum | — | `json` | `json` / `text` / `binary`. `binary` 는 현재 `text` 와 같이 `res.text()` 로 처리한다. 전용 바이너리 디코딩은 미구현(Planned) |
| `timeout` | Integer | — | `30000` | 요청 타임아웃(ms). 0 보다 커야 한다 |
| `followRedirects` | Boolean | — | `true` | 리다이렉트 따라가기. **현재 런타임에 반영하지 않는다(Planned)**. 실제 동작은 [실행 로직](CLE-NODE-HTTP-EXEC.md#실행-로직) 9단계(`integration` 만 최대 5홉 직접 추적, `none`·`custom` 은 3xx 그대로 반환). 토글로 끄거나 홉 수를 바꾸는 기능은 미구현 |
| `verifySsl` | Boolean | — | `true` | SSL 인증서 검증. **현재 런타임에 반영하지 않는다(Planned)**. 핸들러가 이 값을 읽지 않으며(`rejectUnauthorized`·custom dispatcher 미설정) 검증은 항상 켜져 있다 |

표현식(`{{ }}`)은 `url`, `headers[i].value`, `queryParams[i].value`, `body` 안에서 쓸 수 있다.

설정 스키마의 단일 기준은 `codebase/backend/src/nodes/integration/http-request/http-request.schema.ts` 의 `httpRequestNodeConfigSchema`·`httpRequestNodeMetadata` 다.

## 설정 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|---------------|------|
| 요청 줄 | 패널 맨 위 | method 드롭다운, URL 입력 | URL 에 표현식 입력 가능 |
| 인증 | 요청 줄 아래 | `Authentication` 드롭다운(None / Integration / Custom), `Integration` 선택기 | Integration 을 고르면 통합 선택기가 `http` 유형만 보여 준다. Custom 이면 헤더를 직접 적는다 |
| 탭 | 인증 아래 | Headers / Query Params / Body / Advanced | Headers·Query 는 key-value 행과 추가 버튼. 값에 표현식 가능 |
| Body 탭 | 탭 안 | `bodyType` 선택, 편집기 | `bodyType` 에 따라 JSON 에디터와 Key-Value 폼을 바꾼다 |
| Advanced 탭 | 탭 안 | `timeout`, `followRedirects`, `verifySsl` | 뒤의 두 값은 현재 런타임에 반영되지 않는다 |

## 포트

| 방향 | id | label | type | dynamic | 설명 |
|------|----|-------|------|---------|------|
| 입력 | `in` | Input | data | false | 입력 데이터. 표현식 `$input` 으로 참조 |
| 출력 | `success` | Success | data | false | HTTP 2xx 응답 |
| 출력 | `error` | Error | error | false | HTTP 3xx·4xx·5xx 또는 전송 실패(네트워크·자체 타임아웃) |

동적 포트는 없다.

## 실행 로직

→ [HTTP Request 노드 — 실행 로직](CLE-NODE-HTTP-EXEC.md#실행-로직)

## 에러 코드

→ [HTTP Request 노드 — 출력과 에러](CLE-NODE-HTTP-OUTPUT.md#에러-코드)

## 캔버스 요약

[통합 노드 공통](CLE-NODE-INT-COMMON.md) 캔버스 요약 표의 HTTP Request 행을 따른다(`{{method|default:GET}} {{url}}`, 렌더된 한 줄을 40자에서 자름). 참조하던 통합이 삭제되면 캔버스가 `⚠ Missing integration` 배지를 붙인다. 이 노드의 `integrationId` 는 `authentication === "integration"` 일 때만 유효하므로 다른 인증 방식에 남은 값에는 배지를 붙이지 않는다.

## 미결 사항

- **사설망 차단 가드 고장의 코드가 시점마다 다름**: preflight 에서 가드가 판정이 아닌 오류를 던지면 `INTEGRATION_CALL_FAILED`, 리다이렉트 홉에서 던지면 전송 catch 로 떨어져 `HTTP_TRANSPORT_FAILED` 가 된다. 두 시점을 통일할지 아직 정하지 않았다. 통일할 때는 채팅 채널 파급을 함께 봐야 한다. `HTTP_TRANSPORT_FAILED` 는 [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md)에서 `executionFailedThirdParty`(«외부 서비스 응답을 받지 못했습니다»)로 안내된다. 그래서 홉의 가드 고장이 이 코드로 합류하는 동안은 내부 가드의 고장이 외부 서비스 탓으로 전달된다.
- **HTTP 통합의 `auth_type=none` 허용 여부**: 통합 화면 쪽 원문은 HTTP 통합에 `auth_type` `none`(`base_url`·`default_headers` 만)을 허용한다. 이 노드는 `api_key`·`bearer_token`·`basic` 밖의 값을 `INTEGRATION_AUTH_UNSUPPORTED` 로 처리하고 현재 구현(`resolveHttpCredentials` default 분기)도 같다. 그래서 `none` 통합을 이 노드에서 쓰면 실패한다. `none` 을 허용해 이 노드에 행을 더할지, 통합 화면 선택지에서 뺄지 결정 필요(관련: [서비스별 인증 방식과 자격 증명](../CLE-INT/CLE-INT-AUTH.md)).

## 구현 위치

- `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` (실행 흐름은 [실행 로직](CLE-NODE-HTTP-EXEC.md), 출력은 [출력과 에러](CLE-NODE-HTTP-OUTPUT.md))
- `codebase/backend/src/nodes/integration/http-request/http-request.schema.ts`
- `codebase/backend/src/nodes/integration/http-request/http-safety.ts` (사설망 차단 가드, 연결 시점 주소 판정 dispatcher `safeOutboundDispatcher`)
- `codebase/backend/src/common/utils/guarded-lookup-dispatcher.ts` (연결할 때 푼 주소를 판정하는 undici dispatcher, MCP · 알림 웹훅과 공용)
- `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` (리다이렉트 직접 추적, 출처가 바뀐 홉의 자격 증명 제거, 리다이렉트 method 규칙)
- `codebase/backend/src/nodes/integration/http-request/http-credentials.ts` (`auth_type` 별 자격 증명)
- `codebase/backend/src/nodes/integration/_base/sanitize-response-headers.util.ts` (응답 헤더 가림)
- `codebase/backend/src/nodes/integration/_base/abort-cascade.util.ts` (노드 취소 신호 연쇄 `linkUpstreamAbort`·`isUpstreamAbort`, Cafe24·MakeShop 과 공용)

## Rationale

실행 흐름(사설망 차단 적용 범위 · 노드 취소 · 리다이렉트 홉 자격 증명 · 활동 로그 범위)의 Rationale 은 [실행 로직](CLE-NODE-HTTP-EXEC.md#rationale), 출력 · 에러 코드(`Location` 가림 · 3xx 코드 · `details`)의 Rationale 은 [출력과 에러](CLE-NODE-HTTP-OUTPUT.md#rationale) 에 있다.

### 사설망 차단 메시지 일반화 (2026-07-05)

`http-safety.ts` 가드가 던지는 원본 메시지(`SSRF_BLOCKED: hostname "…" resolves to a restricted network range` 등)에는 차단된 호스트 이름·IP 가 들어 있다. 이를 `output.error.message` 로 클라이언트에 보이면 내부망 구조를 정찰하는 통로(CWE-209)가 된다. Database Query(`DB_HOST_BLOCKED`)와 Send Email(`EMAIL_HOST_BLOCKED`)은 이미 일반화 문구를 쓰고 있었고 HTTP Request 만 원본을 보이는 비대칭 상태였다.

`HTTP_BLOCKED` 의 `output.error.message` 를 호스트·IP 를 담지 않는 `Request blocked by SSRF policy.` 로 통일했다. 원본 상세는 모든 인증 방식 공통으로 서버 로그(`logger.warn`)에만 남긴다. 활동 로그는 `GET /integrations/:id/activity` 로 워크스페이스 사용자에게 그대로 나가므로 거기에도 일반화 메시지를 기록한다. 클라이언트 UI 는 `output.error.code` 로 지역화 문구를 렌더하므로 사용성 손실은 없다. 같은 결정으로 리다이렉트 대상·한도 초과의 차단도 `HTTP_BLOCKED` 로 보낸다. 이전에는 리다이렉트 홉의 차단 예외가 바깥 일반 catch 로 떨어져 `HTTP_TRANSPORT_FAILED`·`INTEGRATION_CALL_FAILED` 로 잘못 분류됐다.

기각한 대안:

- 원본을 `output.error.details` 로 옮겨 보이기: `details` 도 클라이언트로 나가므로 정찰 통로가 같다.
- `message` 를 빈 문자열로 두기: `HTTP {status}` 형식의 메시지 계약과 어긋나고 디버깅 단서가 사라진다.

운영 영향(breaking): 이 변경 뒤로 `none`·`custom` 인증으로 사설·loopback·link-local·CGNAT 대상을 부르던 기존 셀프 호스팅 워크플로우는 `ALLOW_PRIVATE_HOST_TARGETS=true`(외부 egress 방화벽 전제)를 켜기 전까지 `HTTP_BLOCKED` 로 실패한다. 이전 방법은 환경 변수 하나를 설정하는 것이다.

### 실패를 에러 포트로 통일 (2026-05-17)

이 결정 전에는 `IntegrationError`·`Error` throw 로 노드 실행이 실패하는 경로가 여러 개 있었다. 이 결정 뒤로는 `handler.validate()` 실패만 throw 로 남고, `execute()` 안의 통합 해소·사설망 차단·인증 실패는 모두 에러 포트로 간다. 코드 이름은 기존 `HTTP_BLOCKED` 를 유지했다. 공통 배경은 [통합 노드 공통](CLE-NODE-INT-COMMON.md) Rationale 「핸들러 실패를 에러 포트로 통일」 에 있다.
