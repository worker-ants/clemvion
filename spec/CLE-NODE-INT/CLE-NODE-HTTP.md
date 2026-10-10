---
id: "CLE-NODE-HTTP"
title: "HTTP Request 노드"
type: "feature"
version: 1
status: "approved"
requirements: ["REQ-HTTP-001", "REQ-HTTP-002", "REQ-HTTP-003", "REQ-HTTP-004", "REQ-HTTP-005", "REQ-HTTP-006", "REQ-HTTP-007", "REQ-HTTP-008", "REQ-HTTP-009", "REQ-HTTP-010", "REQ-HTTP-011", "REQ-HTTP-012", "REQ-HTTP-013", "REQ-HTTP-014", "REQ-HTTP-015", "REQ-HTTP-016", "REQ-HTTP-017", "REQ-HTTP-018", "REQ-HTTP-019", "REQ-HTTP-020", "REQ-HTTP-021", "REQ-HTTP-022", "REQ-HTTP-023", "REQ-HTTP-024", "REQ-HTTP-025", "REQ-HTTP-026", "REQ-HTTP-027", "REQ-HTTP-028", "REQ-HTTP-029", "REQ-HTTP-030", "REQ-HTTP-031", "REQ-HTTP-032", "REQ-HTTP-033"]
basis_superseded: false
parent: "CLE-NODE-INT"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT"]
area: "CLE-NODE-INT"
content_hash: "de82649ba62756044e552eaa69b8e620755558f2c3dddccd07a8524b77f903bf"
read_as: "task_basis"
task: "CLE-T-6T6Q95"
source_paths: ["spec/4-nodes/4-integration/1-http-request.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "456945294419c35bda75c182de2cdc2aca97cc555710cba6e2cb6832df90bd9e"
etag: "sha256-4b0ba0fdeb7a49936a71e4f775dc68a02e051cd0a289bad8039b1141ac4ac98b"
---
> 구현 상태: 구현됨 (바이너리 처리·리다이렉트 토글·SSL 검증 토글은 미구현) · 원문: `spec/4-nodes/4-integration/1-http-request.md`, `spec/4-nodes/_product-overview.md` (§7.1) · 용어: [용어 사전](../CLE-GLOSSARY.md)

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
- REQ-HTTP-029 WHILE 인증 방식이 `integration` 인 동안 THE SYSTEM SHALL 노드 취소 신호로 끝난 호출을 빼고 성공·실패마다 활동 로그를 1건 남긴다.
- REQ-HTTP-030 WHILE 인증 방식이 `none` 이나 `custom` 인 동안 THE SYSTEM SHALL 활동 로그를 남기지 않는다.
- REQ-HTTP-031 WHEN 활동 로그를 남기면 THE SYSTEM SHALL `api_label` 을 NULL, `api_method` 를 정규화한 method, `api_path` 를 query string 을 뺀 호스트+경로로 채운다.
- REQ-HTTP-032 WHEN dry-run 으로 실행되면 THE SYSTEM SHALL 외부 요청 없이 mock 결과를 반환하고 사설망 차단 검사를 건너뛴다.
- REQ-HTTP-033 WHEN 노드 취소 신호(`context.abortSignal`)로 진행 중인 요청(리다이렉트 홉과 응답 본문 읽기 포함)이 `AbortError` 로 끝나면 THE SYSTEM SHALL 에러 포트로 내보내지 않고 `AbortError` 를 그대로 던져 엔진에 전달한다.

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
| `followRedirects` | Boolean | — | `true` | 리다이렉트 따라가기. **현재 런타임에 반영하지 않는다(Planned)**. 실제 동작은 `integration` 인증일 때만 최대 5홉을 직접 따라가며 홉마다 사설망 차단을 다시 검사하고, `none`·`custom` 은 3xx 를 그대로 반환한다. 토글로 끄거나 홉 수를 바꾸는 기능은 미구현 |
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

[통합 노드 공통](CLE-NODE-INT-COMMON.md)의 6단계 계약을 따른다. 노드 고유 흐름은 다음과 같다.

1. **설정 정규화**: `method` 를 대문자로 바꾸고 `bodyType`·`responseType` 기본값을 적용한다.
2. **설정 에코 만들기**: 원본 설정(`context.rawConfig`)에서 스키마 필드(`method`, `url`, `authentication`, `integrationId`, `headers`, `queryParams`, `body`, `bodyType`, `responseType`, `timeout`, `followRedirects`, `verifySsl`)를 하나씩 직접 읽어 에코한다(Principle 7 D1). `{ ...rawConfig }` 처럼 spread 하지 않는다. 앞으로 추가될 자격 증명 형태의 필드가 자동으로 새어 나가기 때문이다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md)). `url` 만 `sanitizeUrlCredentials` 결과로 바꾼다.
   - URL 의 `user:pass@host` 에서 userinfo 를 지운다.
   - 쿼리 파라미터 key 가 `api_key`·`token`·`secret`·`signature`·`x-amz-signature` 같은 자격 증명 후보면 값을 `[REDACTED]` 로 바꾼다.
   - URL 파싱에 실패하면 정규식으로 userinfo 만 지운다(best-effort).
3. **통합 자격 증명 해소**(`authentication='integration'` 일 때만): `getForExecution(integrationId, workspaceId)` 로 통합을 읽고 `serviceType='http'`·`status='connected'` 를 확인한다. `auth_type` 별로 자격 증명을 만든다(아래 표). 실패하면 에러를 잡아 에러 포트로 보내고 활동 로그에 `failed` 를 남긴다(D4).
4. **URL 결합**: `base_url` 이 있고 `url` 이 절대 URL(`https?://`)이 아니면 `{base_url}/{url}` 로 합치고 중복 슬래시를 정규화한다.
5. **쿼리 병합**: 노드 `queryParams` 를 URL 에 붙인다. 그 뒤 `auth_type='api_key'` 이고 `location='query'` 인 자격 증명을 붙인다.
6. **헤더 병합**(뒤가 우선): `credentials.default_headers` ← 노드 `headers` ← `credentials.headers`. 즉 통합 자격 증명 헤더가 사용자 입력을 덮어쓴다. 사용자가 `Authorization` 을 위조해 자격 증명을 무력화하는 경로를 막기 위해서다.
7. **본문 직렬화**: `GET`·`HEAD` 가 아니면 `bodyType` 에 따라 직렬화한다. `form-data` 는 multipart boundary 를 자동으로 붙인다(Content-Type 을 지정하지 않는다).
8. **사설망 차단**(모든 인증 방식 공통): `assertSafeOutboundUrl(url)` 로 호스트 리터럴을 검사하고, 이어서 `assertSafeOutboundHostResolved(hostname)` 로 DNS 를 해석한 IP 를 다시 검사한다. 차단되면 `HTTP_BLOCKED` 로 에러 포트에 보낸다. 가드가 차단 판정(`SsrfBlockedError`)이 아닌 오류를 던지면 `INTEGRATION_CALL_FAILED` 로 보낸다. 대역·플래그·메시지 규칙은 [통합 노드 공통](CLE-NODE-INT-COMMON.md) 사설망 차단 절이 정한다. dry-run 실행([재실행](../CLE-EXEC/CLE-EXEC-RERUN.md))은 실제 요청이 없으므로 이 가드 전에 mock 을 반환하고 가드를 건너뛴다.
9. **요청 보내기**: `AbortController` 로 `timeout` 을 걸고 `redirect: 'manual'` 로 보낸다. 노드 취소 신호(`context.abortSignal`)는 공용 헬퍼 `linkUpstreamAbort` 로 같은 controller 에 잇는다. 신호가 이미 취소됐으면 `controller.abort()` 를 바로 부른다. `integration` 인증이면 3xx 를 받을 때 최대 5홉까지 직접 따라가며 홉마다 사설망 차단을 다시 검사한다. 리다이렉트 홉(`followRedirectsSafely`)도 같은 controller 의 신호를 쓴다. `none`·`custom` 인증은 3xx 를 따라가지 않고 그대로 에러 케이스로 반환한다. `followRedirects`·`verifySsl` 은 반영하지 않는다(Planned). 3단계의 통합 조회와 8단계의 사설망 차단 검사·DNS 해석은 노드 취소 신호를 잇기 전에 돈다. 신호가 이미 취소된 노드는 엔진이 dispatch 직전에 거르므로([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) 규칙 19) 이 틈은 좁다. 이 틈에서 신호가 취소돼도 대상이 차단 호스트면 `HTTP_BLOCKED` 가 먼저 나온다. 진입할 때 신호를 따로 확인하지 않는 이유는 [Rationale](#rationale) 에 있다.
10. **응답 파싱**: `responseType='json'` 이면 `res.json()`(실패하면 `null`), 그 밖(`text`·`binary`)은 `res.text()` 다. 본문을 읽다가 노드 취소 신호가 취소되면 `null` 로 삼키지 않고 `AbortError` 를 다시 던진다.
11. **활동 로그 기록**: `integration` 인증일 때만 `success`·`failed` 를 남긴다(아래 "활동 로그"). 노드 취소 신호로 끝난 호출은 남기지 않는다.
12. **반환**:
    - `res.ok` 면 성공 케이스(`port: 'success'`).
    - 3xx·4xx·5xx 면 에러 케이스(`output.error.code` 는 `HTTP_4XX` 또는 `HTTP_5XX`). 3xx 는 직접 따라가는 한도에 닿았을 때도 생길 수 있다.
    - 요청이 reject 되면(네트워크·노드 자체 타임아웃) `HTTP_TRANSPORT_FAILED`, `meta.statusCode = 0`.
    - 노드 취소 신호로 요청이 끝나면(`isUpstreamAbort`) 핸들러는 출력을 돌려주지 않고 `AbortError` 를 다시 던진다. 엔진이 노드 실행을 취소됨(`cancelled`)으로 끝내고 취소 에러(`AbortError`)를 노드 실행의 `error` 에 남긴다([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) 규칙 19).
13. **정리**: 노드 취소 신호의 리스너는 응답 본문까지 읽은 뒤 `finally` 에서 뗀다. 본문 읽기도 취소 대상이라 헤더를 받은 직후에 떼지 않는다. 성공한 요청은 `controller.abort()` 를 부르지 않으므로 정리를 controller 의 `abort` 이벤트에 걸면 리스너가 노드 취소 신호에 남는다.

### 인증 유형별 자격 증명 적용

| `auth_type` | 넣는 위치 | 예시 |
|-------------|-----------|------|
| `api_key` + `location=header` | `credentials.headers[key_name] = value` | `X-Api-Key: secret` |
| `api_key` + `location=query` | URL 쿼리 파라미터에 붙임 | `?token=secret` |
| `bearer_token` | `Authorization: Bearer {token}` | — |
| `basic` | `Authorization: Basic {base64(username:password)}` | — |
| 그 밖 | `INTEGRATION_AUTH_UNSUPPORTED` 로 에러 포트(D4) | — |

HTTP 통합에서 `auth_type` 을 `none` 으로 저장할 수 있는지는 정의가 갈린다. [미결 사항](#미결-사항) 참조.

### 활동 로그

활동 로그는 `authentication === 'integration'` 일 때만 남긴다. `none`·`custom` 인증은 활동 로그를 만들지 않으므로 사설망 차단·전송 실패를 포함한 모든 실패가 에러 포트 라우팅으로만 드러난다. `integration` 인증이어도 노드 취소 신호로 끝난 호출은 활동 로그를 남기지 않는다. 그 호출은 끝나지 않았기 때문이다([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) 규칙 3). Cafe24·MakeShop 핸들러 구현과 같다. 이 예외를 [통합 노드 공통](CLE-NODE-INT-COMMON.md) 규약에 적는 일은 NERV Task `CLE-T-GZRYQ3` 가 맡는다.

| 조건 | `status` | `error.code` |
|------|----------|--------------|
| 2xx | `success` | — |
| 3xx·4xx·5xx | `failed` | `HTTP_{status}` (예: `HTTP_502`) |
| 요청 reject (네트워크·노드 자체 타임아웃) | `failed` | `HTTP_TRANSPORT_FAILED` |
| 사설망 차단·리다이렉트 한도 초과 | `failed` | `HTTP_BLOCKED` |
| 사설망 차단 가드의 고장 (preflight) | `failed` | `INTEGRATION_CALL_FAILED` |

활동 로그의 `error.code` 는 상태 코드별(`HTTP_{status}`)이고, 노드 출력의 `output.error.code` 는 범주별(`HTTP_4XX`·`HTTP_5XX`)이다. 두 값을 섞지 않는다.

API 식별 정보는 다음처럼 채운다. 통합별 채우기 정책의 전체 표는 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) INT-US-05 에 있다.

- `api_label` = NULL. 사용자가 임의 URL 을 부르므로 카탈로그 키가 없다.
- `api_method` = 정규화한 HTTP method(`GET`·`POST` 등).
- `api_path` = `base_url` 을 합친 뒤의 절대 URL 에서 호스트+경로. query string 은 지운다(엔드포인트 단위 묶음과 자격 증명 누출 방지). `base_url` 없이 상대 URL 만 있으면 경로만 저장한다. URL 파싱에 실패하면 원문 문자열을 그대로 저장한다. 길이 초과는 백엔드가 자른다([통합 노드 공통](CLE-NODE-INT-COMMON.md)).

## 출력 구조

노드 출력은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 11 형식을 따른다. JSON 예시는 `undefined` 필드를 생략하고, 다섯 필드 밖의 최상위 키는 두지 않는다. `output.response` 는 Principle 8.2 의 1차 명명을 따른다. `status` 는 비블로킹 노드이므로 항상 생략한다. 케이스는 성공과 에러 둘뿐이다. 취소는 엔진이 기록하는 별도 종결이다. 노드 취소 신호로 요청이 끝나면 핸들러는 출력을 돌려주지 않는다. 엔진이 노드 실행을 취소됨(`cancelled`)으로 끝내고 취소 에러(`AbortError`)를 노드 실행의 `error` 에 남긴다([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) 규칙 19).

### 2xx 성공 (`success`)

```json
{
  "config": {
    "method": "POST",
    "url": "https://api.example.com/users",
    "authentication": "integration",
    "integrationId": "int_http_1",
    "headers": [{ "key": "X-Request-Id", "value": "req-{{ $execution.id }}" }],
    "queryParams": [],
    "body": { "user": "{{ $input.name }}" },
    "bodyType": "json",
    "responseType": "json",
    "timeout": 30000,
    "followRedirects": true,
    "verifySsl": true
  },
  "output": {
    "response": { "id": 42, "name": "Alice" },
    "requestBody": { "user": "Alice" },
    "requestBodyType": "json",
    "responseHeaders": {
      "content-type": "application/json",
      "authorization": "[REDACTED]"
    }
  },
  "meta": { "statusCode": 201, "durationMs": 250 },
  "port": "success"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.method` | Enum | 설정 에코 | 사용자가 입력한 method |
| `config.url` | string | 설정 에코 + 가림 | `user:pass@` 와 자격 증명 쿼리를 지운 값. 그 밖은 원본(`{{ }}` 보존) |
| `config.authentication` | Enum | 설정 에코 | `none` / `integration` / `custom` |
| `config.integrationId` | UUID? | 설정 에코 | `integration` 인증일 때 에코. 자격 증명 자체는 절대 에코하지 않는다 |
| `config.headers` / `config.queryParams` | KeyValue[] | 설정 에코 | 원본(`{{ }}` 보존) |
| `config.body` / `config.bodyType` | unknown / Enum | 설정 에코 | 원본 본문(`{{ }}` 보존) |
| `config.responseType` / `config.timeout` / `config.followRedirects` / `config.verifySsl` | — | 설정 에코 | 입력값 원본 |
| `output.response` | unknown | 런타임 `res.json()`·`res.text()` | 응답 본문. `json` 파싱 실패 시 `null` |
| `output.requestBody?` | unknown | 런타임(평가된 값) | 실제로 보낸 평가된 본문. 256KB 를 넘으면 잘린다. `body` 가 없으면 생략 |
| `output.requestBodyType` | string | 런타임 | 실제 적용된 `bodyType`(기본값 `'json'` 적용 후) |
| `output.responseHeaders?` | Record<string,string> | 런타임 | 응답 헤더. key 는 소문자. `Authorization`·`Cookie`·`Set-Cookie`·`X-*-Token`·`X-*-Key` 같은 자격 증명 형태 값과 `Location`(3xx 대상 URL)은 `[REDACTED]`. 단일 기준은 `_base/sanitize-response-headers.util.ts` |
| `output.bodyTruncated?` | boolean | 런타임 | 256KB 제한이 적용됐을 때만 `true` |
| `meta.statusCode` | number | 핸들러 반환 | HTTP 응답 상태(2xx) |
| `meta.durationMs` | number | 핸들러 반환 | 요청 시작부터 응답까지 ms |
| `port` | `'success'` | 핸들러 반환 | 2xx 분기 |

표현식 접근 예:

- `$node["X"].output.response.id` → `42`
- `$node["X"].output.requestBody.user` → `"Alice"`
- `$node["X"].output.responseHeaders["content-type"]` → `"application/json"`
- `$node["X"].meta.statusCode` → `201`
- `$node["X"].config.url` → `"https://api.example.com/users"` (원본, 자격 증명 제거)
- `$node["X"].port` → `"success"`

### 4xx·5xx 응답 (`error`)

[노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 3.2 의 `output.error.{code, message, details?}` 를 채운다. 서버가 돌려준 응답 본문은 디버깅을 위해 `output.response` 에 그대로 둔다.

```json
{
  "config": {
    "method": "GET",
    "url": "https://api.example.com/users/missing",
    "authentication": "none",
    "headers": [],
    "queryParams": [],
    "bodyType": "json",
    "responseType": "json",
    "timeout": 30000,
    "followRedirects": true,
    "verifySsl": true
  },
  "output": {
    "response": { "error": "Not Found" },
    "requestBodyType": "json",
    "responseHeaders": { "content-type": "application/json" },
    "error": {
      "code": "HTTP_4XX",
      "message": "HTTP 404 Not Found",
      "details": {
        "statusCode": 404,
        "statusText": "Not Found",
        "url": "https://api.example.com/users/missing",
        "method": "GET"
      }
    }
  },
  "meta": { "statusCode": 404, "durationMs": 120 },
  "port": "error"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | 성공 케이스와 같음 | 설정 에코 | |
| `output.response` | unknown | 서버 응답 본문 | 4xx·5xx 에서도 본문 보존 |
| `output.requestBody?` / `output.requestBodyType` / `output.responseHeaders?` / `output.bodyTruncated?` | 성공 케이스와 같음 | 런타임 | 응답이 있으므로 `responseHeaders` 포함 |
| `output.error.code` | `'HTTP_4XX'` / `'HTTP_5XX'` | 핸들러 반환 | `statusCode >= 500` 이면 `HTTP_5XX`, 그 밖 300 이상이면 `HTTP_4XX` |
| `output.error.message` | string | 핸들러 반환 | `HTTP {status} {statusText}` |
| `output.error.details.statusCode` | number | 핸들러 반환 | HTTP 응답 상태 |
| `output.error.details.statusText` | string | 핸들러 반환 | HTTP 응답 상태 텍스트 |
| `output.error.details.url` | string | 핸들러 반환 | 실제 요청 URL(자격 증명 가림 적용) |
| `output.error.details.method` | string | 핸들러 반환 | 요청 method |
| `meta.statusCode` | number | 핸들러 반환 | HTTP 응답 상태 |
| `meta.durationMs` | number | 핸들러 반환 | 요청 ms |
| `port` | `'error'` | 핸들러 반환 | 에러 분기 |

### 전송 실패 (`error`)

요청이 reject 된 경우(DNS·연결 거부·소켓·노드 자체 타임아웃)다. 응답이 없으므로 `output.responseHeaders` 를 넣지 않고 `meta.statusCode = 0` 이다. 노드 취소 신호로 끊긴 요청은 이 케이스가 아니다. 핸들러는 출력을 돌려주지 않고 `AbortError` 를 다시 던진다(위 [출력 구조](#출력-구조) 서두).

```json
{
  "config": {
    "method": "POST",
    "url": "https://api.example.com/x",
    "authentication": "none",
    "headers": [],
    "queryParams": [],
    "body": { "ping": 1 },
    "bodyType": "json",
    "responseType": "json",
    "timeout": 30000,
    "followRedirects": true,
    "verifySsl": true
  },
  "output": {
    "response": { "error": "ECONNREFUSED" },
    "requestBody": { "ping": 1 },
    "requestBodyType": "json",
    "error": {
      "code": "HTTP_TRANSPORT_FAILED",
      "message": "ECONNREFUSED",
      "details": {
        "url": "https://api.example.com/x",
        "method": "POST"
      }
    }
  },
  "meta": { "statusCode": 0, "durationMs": 42 },
  "port": "error"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `output.response.error` | string | 핸들러 반환 | 전송 실패 메시지. 옛 호환을 위해 남은 필드(Deprecated)다. 새 코드는 `output.error.{code, message}` 를 기준으로 쓰고 이 필드에 기대지 않는다 |
| `output.error.code` | `'HTTP_TRANSPORT_FAILED'` | 핸들러 반환 | 네트워크 에러와 노드 자체 타임아웃을 묶은 코드. 노드 취소 신호로 끊긴 요청은 이 코드를 쓰지 않는다. 엔진이 노드 실행을 취소됨(`cancelled`)으로 끝낸다([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md)) |
| `output.error.message` | string | 핸들러 반환 | 원인 에러 메시지(`Error.message` 또는 문자열 변환) |
| `output.error.details.url` / `output.error.details.method` | string | 핸들러 반환 | 시도한 요청 정보(URL 가림 적용) |
| `output.responseHeaders` | — | — | 응답이 없어 생략 |
| `meta.statusCode` | `0` | 핸들러 반환 | 전송 실패 표시값. 판별은 `output.error.code === 'HTTP_TRANSPORT_FAILED'` 를 권장 |
| `meta.durationMs` | number | 핸들러 반환 | 요청 시작부터 reject 까지 |
| `port` | `'error'` | 핸들러 반환 | 에러 분기 |

에러 케이스 표현식 접근 예:

- `$node["X"].output.error.code` → `"HTTP_4XX"` / `"HTTP_5XX"` / `"HTTP_TRANSPORT_FAILED"`
- `$node["X"].output.error.details.statusCode` → `404` (전송 실패 시 없음)
- `$node["X"].output.response` → 서버 본문(4xx·5xx) 또는 `{ error: "..." }`(전송 실패)
- `$node["X"].port === 'error'` → 분기 라우팅

## 에러 코드

### 사전 검증 에러

`handler.validate()` 가 실패하면(설정 형식 자체가 잘못된 경우) 노드 실행이 시작되지 않는다. 경고 규칙과 `evaluateMetadataBlockingErrors` 가 throw 하고 엔진이 실행을 실패로 끝낸다. 예: `URL 을 입력해야 합니다.`, `method must be one of: ...`, `timeout must be a positive number`, `CRLF characters are not allowed in key/value`, `integrationId is required when authentication is "integration"`.

### 런타임 에러 (`port: 'error'`)

`execute()` 안의 실패는 모두 에러 포트로 간다(D4). 노드 취소 신호로 생긴 `AbortError` 는 실패가 아니라서 이 표에 없다. 핸들러가 그 에러를 다시 던지고 엔진이 노드 실행을 취소됨(`cancelled`)으로 끝낸다([요구사항](#요구사항)).

| 코드 | 조건 | `output.response` | `output.responseHeaders` | `meta.statusCode` |
|------|------|-------------------|--------------------------|-------------------|
| `HTTP_4XX` | `400 ≤ statusCode < 500`, 또는 직접 따라가는 한도에 닿은 3xx | 서버 본문 보존 | 응답 헤더(가림 적용) | 응답 상태 |
| `HTTP_5XX` | `500 ≤ statusCode < 600` | 서버 본문 보존 | 응답 헤더(가림 적용) | 응답 상태 |
| `HTTP_TRANSPORT_FAILED` | 요청 reject(DNS·연결 거부·소켓·노드 자체 타임아웃). 리다이렉트 홉에서 사설망 차단 가드가 판정이 아닌 오류를 던진 경우도 여기로 합류한다 | `{ error: <message> }` (옛 호환) | — | `0` |
| `HTTP_BLOCKED` | 사설망 차단(호스트 검사·DNS rebinding·리다이렉트 한도·리다이렉트 대상 재검사·http(s) 가 아닌 프로토콜). `output.error.message` 는 `Request blocked by SSRF policy.` | — | — | `0` |
| `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` | 통합 해소·자격 증명 실패([통합 노드 공통](CLE-NODE-INT-COMMON.md)) | — | — | `0` |
| `INTEGRATION_AUTH_UNSUPPORTED` | 지원하지 않는 `auth_type` | — | — | `0` |
| `INTEGRATION_CALL_FAILED` | 통합이 없거나 다른 워크스페이스 소속(`requireEntity` 의 `RESOURCE_NOT_FOUND` fallback), 또는 preflight 사설망 차단 가드의 고장 | — | — | `0` |
| `INTEGRATION_SERVICE_UNAVAILABLE` | `IntegrationsService` 미주입(`Integration-based authentication is not available in this environment`) 또는 workspace context 누락. 워크스페이스 누락의 현재 구현 차이는 [통합 노드 공통](CLE-NODE-INT-COMMON.md) 미결 사항 참조 | — | — | `0` |

## 캔버스 요약

[통합 노드 공통](CLE-NODE-INT-COMMON.md) 캔버스 요약 표의 HTTP Request 행을 따른다(`{{method|default:GET}} {{url}}`, 렌더된 한 줄을 40자에서 자름). 참조하던 통합이 삭제되면 캔버스가 `⚠ Missing integration` 배지를 붙인다. 이 노드의 `integrationId` 는 `authentication === "integration"` 일 때만 유효하므로 다른 인증 방식에 남은 값에는 배지를 붙이지 않는다.

## 미결 사항

- **사설망 차단 가드 고장의 코드가 시점마다 다름**: preflight 에서 가드가 판정이 아닌 오류를 던지면 `INTEGRATION_CALL_FAILED`, 리다이렉트 홉에서 던지면 전송 catch 로 떨어져 `HTTP_TRANSPORT_FAILED` 가 된다. 두 시점을 통일할지 아직 정하지 않았다. 통일할 때는 채팅 채널 파급을 함께 봐야 한다. `HTTP_TRANSPORT_FAILED` 는 [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md)에서 `executionFailedThirdParty`(«외부 서비스 응답을 받지 못했습니다»)로 안내된다. 그래서 홉의 가드 고장이 이 코드로 합류하는 동안은 내부 가드의 고장이 외부 서비스 탓으로 전달된다.
- **HTTP 통합의 `auth_type=none` 허용 여부**: 통합 화면 쪽 원문은 HTTP 통합에 `auth_type` `none`(`base_url`·`default_headers` 만)을 허용한다. 이 노드는 `api_key`·`bearer_token`·`basic` 밖의 값을 `INTEGRATION_AUTH_UNSUPPORTED` 로 처리하고 현재 구현(`resolveHttpCredentials` default 분기)도 같다. 그래서 `none` 통합을 이 노드에서 쓰면 실패한다. `none` 을 허용해 이 노드에 행을 더할지, 통합 화면 선택지에서 뺄지 결정 필요(관련: [서비스별 인증 방식과 자격 증명](../CLE-INT/CLE-INT-AUTH.md)).

## 구현 위치

- `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`
- `codebase/backend/src/nodes/integration/http-request/http-request.schema.ts`
- `codebase/backend/src/nodes/integration/http-request/http-safety.ts` (사설망 차단 가드)
- `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` (리다이렉트 직접 추적)
- `codebase/backend/src/nodes/integration/http-request/http-credentials.ts` (`auth_type` 별 자격 증명)
- `codebase/backend/src/nodes/integration/_base/sanitize-response-headers.util.ts` (응답 헤더 가림)
- `codebase/backend/src/nodes/integration/_base/abort-cascade.util.ts` (노드 취소 신호 연쇄 `linkUpstreamAbort`·`isUpstreamAbort`, Cafe24·MakeShop 과 공용)

## Rationale

### `Location` 응답 헤더를 가리는 이유

`Location` 은 자격 증명 형태의 이름은 아니지만 가림 대상 목록에 넣었다(`_base/sanitize-response-headers.util.ts`). 3xx 대상 URL 을 `output.responseHeaders` 로 그대로 보이면, `output.error.details.url` 에서 `sanitizeUrlCredentials` 가 막는 URL 안 자격 증명(`user:pass@`, 자격 증명 쿼리)이 응답 헤더 경로로 다시 새어 나간다. 두 가림 경로를 대칭으로 유지하려는 결정이다. 배경은 유틸 파일 머리 주석에 있다.

### 사설망 차단을 모든 인증 방식에 적용 (2026-06-11)

원래 사설망 차단은 `authentication='integration'` 일 때만 적용됐다. 그래서 `none`·`custom` 인증 요청은 `169.254.169.254`(클라우드 메타데이터)와 RFC1918 내부망을 가드 없이 직접 부를 수 있었다. 코드 주석은 "none 은 내부 서비스를 정당하게 부를 수 있다" 고 정당화했지만 어느 스펙에도 근거가 없었다. 게다가 "기본은 차단이며 이 플래그가 통합 노드 전체의 사설망 차단을 제어한다" 는 스펙 서술과 정면으로 어긋났다.

사용자 결정(2026-06-11)으로 가드를 모든 인증 방식에 적용했다. 내부 서비스 접근이라는 정당한 용도는 이미 `ALLOW_PRIVATE_HOST_TARGETS=true` 로 충족되므로 `none` 전용 예외를 둘 이유가 없다. 이 결정으로 Database Query·Send Email 노드와 보안 자세가 같아지고 `NF-SC-05`(OWASP)와도 맞는다. 활동 로그는 이전처럼 `integration` 인증에만 남긴다. `none`·`custom` 은 활동 로그를 만들지 않으므로 사설망 차단의 에러 포트(`HTTP_BLOCKED`) 라우팅만 모든 인증 방식에 공통이다.

기각한 대안:

- `none` 전용 호스트 허용 목록 환경 변수: 플래그가 둘로 나뉘고 근거 없는 새 표면이 생기며 Database Query·Send Email 과 보안 자세가 계속 갈린다.
- 현상 유지 + "none 은 의도적으로 가드 없음" 명문화: 클라우드 메타데이터·내부망 공격 면이 그대로 열리고, 그 용도는 이미 opt-out 으로 충족되므로 예외를 둘 이유가 없다.

### 사설망 차단 메시지 일반화 (2026-07-05)

`http-safety.ts` 가드가 던지는 원본 메시지(`SSRF_BLOCKED: hostname "…" resolves to a restricted network range` 등)에는 차단된 호스트 이름·IP 가 들어 있다. 이를 `output.error.message` 로 클라이언트에 보이면 내부망 구조를 정찰하는 통로(CWE-209)가 된다. Database Query(`DB_HOST_BLOCKED`)와 Send Email(`EMAIL_HOST_BLOCKED`)은 이미 일반화 문구를 쓰고 있었고 HTTP Request 만 원본을 보이는 비대칭 상태였다.

`HTTP_BLOCKED` 의 `output.error.message` 를 호스트·IP 를 담지 않는 `Request blocked by SSRF policy.` 로 통일했다. 원본 상세는 모든 인증 방식 공통으로 서버 로그(`logger.warn`)에만 남긴다. 활동 로그는 `GET /integrations/:id/activity` 로 워크스페이스 사용자에게 그대로 나가므로 거기에도 일반화 메시지를 기록한다. 클라이언트 UI 는 `output.error.code` 로 지역화 문구를 렌더하므로 사용성 손실은 없다. 같은 결정으로 리다이렉트 대상·한도 초과의 차단도 `HTTP_BLOCKED` 로 보낸다. 이전에는 리다이렉트 홉의 차단 예외가 바깥 일반 catch 로 떨어져 `HTTP_TRANSPORT_FAILED`·`INTEGRATION_CALL_FAILED` 로 잘못 분류됐다.

기각한 대안:

- 원본을 `output.error.details` 로 옮겨 보이기: `details` 도 클라이언트로 나가므로 정찰 통로가 같다.
- `message` 를 빈 문자열로 두기: `HTTP {status}` 형식의 메시지 계약과 어긋나고 디버깅 단서가 사라진다.

운영 영향(breaking): 이 변경 뒤로 `none`·`custom` 인증으로 사설·loopback·link-local·CGNAT 대상을 부르던 기존 셀프 호스팅 워크플로우는 `ALLOW_PRIVATE_HOST_TARGETS=true`(외부 egress 방화벽 전제)를 켜기 전까지 `HTTP_BLOCKED` 로 실패한다. 이전 방법은 환경 변수 하나를 설정하는 것이다.

### 실패를 에러 포트로 통일 (D4)

D4 이전에는 `IntegrationError`·`Error` throw 로 노드 실행이 실패하는 경로가 여러 개 있었다. D4 뒤로는 `handler.validate()` 실패만 throw 로 남고, `execute()` 안의 통합 해소·사설망 차단·인증 실패는 모두 에러 포트로 간다. 과거 개선안에 있던 "사설망 차단을 에러 포트로 전환" 후보도 이때 끝냈으며 코드 이름은 기존 `HTTP_BLOCKED` 를 유지했다. 공통 배경은 [통합 노드 공통](CLE-NODE-INT-COMMON.md) Rationale 에 있다.

### 노드 취소를 에러 포트로 보내지 않는다 (2026-10-10)

이 노드는 원래 노드 취소 신호(`context.abortSignal`)로 끊긴 요청을 전송 실패와 묶어 `HTTP_TRANSPORT_FAILED` 와 에러 포트로 돌려줬다. [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) 규약은 외부 I/O 노드가 취소 때 `AbortError` 를 그대로 던진다고 정한다. 그래서 cancel-others-on-fail 로 멈춘 HTTP 분기가 `cancelled` 대신 에러 포트 라우팅으로 기록됐다. 이 충돌은 리뷰 발견 `finding 01a0e599-78b6-7714-a5c1-ba2c658d1888` 로 올라왔고 사용자가 2026-10-10 에 선택지 1 을 승인했다.

- 선택지 1(채택): Cafe24·MakeShop 핸들러처럼 노드 취소 신호로 생긴 `AbortError` 를 다시 던진다. 엔진이 노드 실행을 `cancelled` 로 기록한다.
- 선택지 2(기각): 지금 동작을 노드 취소 규약의 예외로 적는다. 이렇게 하면 취소된 분기가 에러 포트를 따라 다음 노드를 실행하므로 기각했다.

노드 자체 타임아웃은 이 결정의 범위 밖이다. 그대로 `HTTP_TRANSPORT_FAILED` 로 에러 포트에 간다. 두 `AbortError` 는 노드 취소 신호가 취소됐는지로 가른다. 실행 안의 실패는 에러 포트로 보낸다는 원칙은 그대로다. 노드 취소는 실패가 아니어서 그 원칙의 대상이 아니다. 이 예외를 [통합 노드 공통](CLE-NODE-INT-COMMON.md) 규약에 적는 일은 NERV Task `CLE-T-GZRYQ3` 가 맡는다.

노드 취소 신호의 리스너 정리는 `finally` 에서 하고 controller 의 `abort` 이벤트에 걸지 않는다. 성공한 요청은 `controller.abort()` 를 부르지 않는다. 그래서 그 이벤트에 정리를 걸면 요청이 성공할 때마다 노드 취소 신호에 리스너가 남는다.

자세한 배경은 [노드 취소 §HTTP Request 노드도 노드 취소를 cancelled 로 끝낸다](../CLE-EXEC/CLE-EXEC-CANCEL.md#http-request-노드도-노드-취소를-cancelled-로-끝낸다-2026-10-10) 에 있다.

### 진입할 때 노드 취소 신호를 따로 확인하지 않는다 (2026-10-10)

신호를 잇기 전 단계(통합 조회와 자격 증명 해소, 사설망 차단 검사와 DNS 해석)는 노드 취소 신호를 받지 않는다. 그 사이에 신호가 취소되면 요청 직전에 신호를 잇는 순간 요청이 끊긴다. `linkUpstreamAbort` 가 이미 취소된 신호를 보면 `controller.abort()` 를 바로 부르기 때문이다. 그래서 노드 실행은 취소됨(`cancelled`)으로 끝난다. 다만 대상이 차단 주소면 그 전에 `HTTP_BLOCKED` 로 에러 포트에 간다. 차단 주소는 취소와 상관없이 실패할 요청이므로 진입 확인을 더하지 않았다. dispatch 전에 신호가 이미 취소된 노드는 엔진이 핸들러를 부르기 전에 거른다([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) 규칙 19).
