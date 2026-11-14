---
id: "CLE-NODE-HTTP-EXEC"
title: "HTTP Request 노드 — 실행 로직"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-HTTP"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT", "CLE-NODE-HTTP"]
area: "CLE-NODE-INT"
content_hash: "65ddabb013e3a5763fa3cc92b73c1bd1271c13f11a66361b79b8f5eb68a8e39c"
read_as: "approved_fallback"
task: "CLE-T-BS1WD1"
source_paths: []
mirror_sha256: "31d7549968b3941ce53e3ba5324a6284ec4f7e890e735318456ce04168db48bb"
etag: "sha256-beb143b218d8d816565e6b4997eb190833be86517eb691ae9fcd6c1fa4a84934"
---
## 개요

이 문서는 [HTTP Request 노드](CLE-NODE-HTTP.md) 의 하위 문서로 노드의 실행 흐름, 인증 유형별 자격 증명 적용, 리다이렉트 홉 규칙, 활동 로그 기록을 정한다. 출력 모양과 에러 코드는 [HTTP Request 노드 — 출력과 에러](CLE-NODE-HTTP-OUTPUT.md) 가 정한다.

## 실행 로직

[통합 노드 공통](CLE-NODE-INT-COMMON.md)의 6단계 계약을 따른다. 노드 고유 흐름은 다음과 같다.

1. **설정 정규화**: `method` 를 대문자로 바꾸고 `bodyType`·`responseType` 기본값을 적용한다.
2. **설정 에코 만들기**: 원본 설정(`context.rawConfig`)에서 스키마 필드(`method`, `url`, `authentication`, `integrationId`, `headers`, `queryParams`, `body`, `bodyType`, `responseType`, `timeout`, `followRedirects`, `verifySsl`)를 하나씩 직접 읽어 에코한다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 7 의 명시 나열 규칙). `{ ...rawConfig }` 처럼 spread 하지 않는다. 앞으로 추가될 자격 증명 형태의 필드가 자동으로 새어 나가기 때문이다. `url` 만 `sanitizeUrlCredentials` 결과로 바꾼다.
   - URL 의 `user:pass@host` 에서 userinfo 를 지운다.
   - 쿼리 파라미터 key 가 `api_key`·`token`·`secret`·`signature`·`x-amz-signature` 같은 자격 증명 후보면 값을 `[REDACTED]` 로 바꾼다.
   - URL 파싱에 실패하면 정규식으로 userinfo 만 지운다(best-effort).
3. **통합 자격 증명 해소**(`authentication='integration'` 일 때만): `getForExecution` 으로 통합을 읽고 `serviceType='http'`·`status='connected'` 를 확인한다. 넘기는 인자는 [통합 노드 공통](CLE-NODE-INT-COMMON.md#integrationsservice-api-실행-엔진용) 이 정한다. `auth_type` 별로 자격 증명을 만든다(아래 표). 실패하면 에러를 잡아 에러 포트로 보낸다(근거는 [Rationale 「실패를 에러 포트로 통일」](CLE-NODE-HTTP.md#실패를-에러-포트로-통일-2026-05-17)). 유형 불일치와 미연결은 통합을 얻은 뒤의 실패라 활동 로그에 `failed` 를 남긴다. 조회가 실패하면 남기지 않는다(11단계).
4. **URL 결합**: `base_url` 이 있고 `url` 이 절대 URL(`https?://`)이 아니면 `{base_url}/{url}` 로 합치고 중복 슬래시를 정규화한다.
5. **쿼리 병합**: 노드 `queryParams` 를 URL 에 붙인다. 그 뒤 `auth_type='api_key'` 이고 `location='query'` 인 자격 증명을 붙인다.
6. **헤더 병합**(뒤가 우선): `credentials.default_headers` ← 노드 `headers` ← `credentials.headers`. 즉 통합 자격 증명 헤더가 사용자 입력을 덮어쓴다. 사용자가 `Authorization` 을 위조해 자격 증명을 무력화하는 경로를 막는다.
7. **본문 직렬화**: `GET`·`HEAD` 가 아니면 `bodyType` 에 따라 직렬화한다. `form-data` 는 multipart boundary 를 자동으로 붙인다(Content-Type 을 지정하지 않는다).
8. **사설망 차단**(모든 인증 방식 공통): `assertSafeOutboundUrl(url)` 로 호스트 리터럴을 검사하고, 이어서 `assertSafeOutboundHostResolved(hostname)` 로 DNS 를 해석한 IP 를 다시 검사한다. 차단되면 `HTTP_BLOCKED` 로 에러 포트에 보낸다. 가드가 차단 판정(`SsrfBlockedError`)이 아닌 오류를 던지면 `INTEGRATION_CALL_FAILED` 로 보낸다. 9단계의 요청(리다이렉트 홉 포함)은 연결 시점 주소 판정 dispatcher(`safeOutboundDispatcher`)로 보낸다. 연결할 때 호스트 이름을 다시 풀어 나온 주소가 하나라도 같은 대역에 들면 연결하지 않고 `HTTP_BLOCKED` 로 끝낸다. 판정을 통과한 주소로만 연결하므로 검사와 연결 사이에 DNS 응답이 바뀌어도(DNS rebinding) 막힌 대역에 닿지 않는다. 연결할 때 이름이 풀리지 않으면 `HTTP_TRANSPORT_FAILED` 다. `ALLOW_PRIVATE_HOST_TARGETS=true` 면 이 판정도 하지 않는다([Rationale](#연결할-때-푼-주소를-다시-판정한다-2026-11-14)). 대역·플래그·메시지 규칙은 [통합 노드 공통](CLE-NODE-INT-COMMON.md) 사설망 차단 절이 정한다. dry-run 실행([재실행](../CLE-EXEC/CLE-EXEC-RERUN.md))은 실제 요청이 없으므로 이 가드 전에 mock 을 반환하고 가드를 건너뛴다.
9. **요청 보내기**: `AbortController` 로 `timeout` 을 걸고 `redirect: 'manual'` 로 보낸다. 노드 취소 신호(`context.abortSignal`)는 공용 헬퍼 `linkUpstreamAbort` 로 같은 controller 에 잇는다. 신호가 이미 취소됐으면 `controller.abort()` 를 바로 부른다. `integration` 인증이면 `Location` 헤더가 있는 3xx 를 최대 5홉까지 직접 따라가며 홉마다 사설망 차단을 다시 검사한다. 5홉을 따라간 뒤에도 `Location` 이 있는 3xx 가 오면 차단 판정 없이 `HTTP_BLOCKED` 로 끝낸다. 메시지는 사설망 차단과 같은 일반화 문구다([Rationale](CLE-NODE-HTTP-OUTPUT.md#리다이렉트-한도-초과와-3xx-응답의-출력-코드-2026-11-13)). 홉 대상의 출처가 첫 요청과 다르면 그 홉부터 자격 증명을 싣지 않고, 303 과 301·302 의 `POST` 는 본문 없는 `GET` 으로 바꾼다(아래 [리다이렉트 홉의 자격 증명과 method](#리다이렉트-홉의-자격-증명과-method)). 리다이렉트 홉(`followRedirectsSafely`)도 같은 controller 의 신호를 쓴다. `none`·`custom` 인증은 3xx 를 따라가지 않고 그대로 에러 케이스로 반환한다. `followRedirects`·`verifySsl` 은 반영하지 않는다(Planned). 3단계의 통합 조회와 8단계의 사설망 차단 검사·DNS 해석은 노드 취소 신호를 잇기 전에 돈다. 신호가 이미 취소된 노드는 엔진이 dispatch 직전에 거르므로([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) 규칙 19) 이 틈은 좁다. 이 틈에서 신호가 취소돼도 대상이 차단 호스트면 `HTTP_BLOCKED` 가 먼저 나온다. 진입할 때 신호를 따로 확인하지 않는 이유는 [Rationale](#진입할-때-노드-취소-신호를-따로-확인하지-않는다-2026-10-10) 에 있다.
10. **응답 파싱**: `responseType='json'` 이면 `res.json()`(실패하면 `null`), 그 밖(`text`·`binary`)은 `res.text()` 다. 본문을 읽다가 노드 취소 신호가 취소되면 `null` 로 삼키지 않고 `AbortError` 를 다시 던진다.
11. **활동 로그 기록**: `integration` 인증일 때만 `success`·`failed` 를 남긴다(아래 "활동 로그"). 노드 취소 신호로 끝난 호출과 통합을 얻기 전에 끝난 실패는 남기지 않는다([통합 노드 공통](CLE-NODE-INT-COMMON.md#공통-에러-코드)).
12. **반환**:
    - `res.ok` 면 성공 케이스(`port: 'success'`).
    - 2xx 가 아닌 응답이면 에러 케이스다. `output.error.code` 는 상태가 500 이상이면 `HTTP_5XX`, 그 밖(3xx·4xx)은 `HTTP_4XX` 다. 3xx 가 여기로 오는 경우는 `none`·`custom` 인증의 3xx 와 `integration` 인증에서 `Location` 이 없는 3xx 다. `integration` 인증에서 리다이렉트가 5홉을 넘으면 3xx 가 아니라 `HTTP_BLOCKED` 가 나온다(9단계).
    - 요청이 reject 되면(네트워크·노드 자체 타임아웃) `HTTP_TRANSPORT_FAILED`, `meta.statusCode = 0`.
    - 노드 취소 신호로 요청이 끝나면(`isUpstreamAbort`) 핸들러는 출력을 돌려주지 않고 `AbortError` 를 다시 던진다. 엔진 쪽 기록은 [출력 구조](CLE-NODE-HTTP-OUTPUT.md#출력-구조) 서두에 있다.
13. **정리**: 노드 취소 신호의 리스너는 응답 본문까지 읽은 뒤 `finally` 에서 뗀다. 본문 읽기도 취소 대상이라 헤더를 받은 직후에 떼지 않는다. 성공한 요청은 `controller.abort()` 를 부르지 않으므로 정리를 controller 의 `abort` 이벤트에 걸면 리스너가 노드 취소 신호에 남는다.

### 인증 유형별 자격 증명 적용

| `auth_type` | 넣는 위치 | 예시 |
|-------------|-----------|------|
| `api_key` + `location=header` | `credentials.headers[key_name] = value` | `X-Api-Key: secret` |
| `api_key` + `location=query` | URL 쿼리 파라미터에 붙임 | `?token=secret` |
| `bearer_token` | `Authorization: Bearer {token}` | — |
| `basic` | `Authorization: Basic {base64(username:password)}` | — |
| 그 밖 | `INTEGRATION_AUTH_UNSUPPORTED` 로 에러 포트 | — |

HTTP 통합에서 `auth_type` 을 `none` 으로 저장할 수 있는지는 정의가 갈린다. [미결 사항](CLE-NODE-HTTP.md#미결-사항) 참조.

### 리다이렉트 홉의 자격 증명과 method

`integration` 인증의 리다이렉트 홉(9단계)에 적용한다. HTTP 통합 연결 테스트([서비스별 인증 방식과 자격 증명](../CLE-INT/CLE-INT-AUTH.md))도 같은 함수(`followRedirectsSafely`)에 같은 자격 증명을 넘겨 같은 규칙을 따른다.

**출처 비교.** 홉 대상 URL(`Location` 을 직전 URL 기준으로 푼 값)의 scheme·host·port 를 첫 요청 URL 과 비교한다. 기본 port 를 적은 URL(`https://api.example.com:443`)은 적지 않은 URL 과 같은 출처다. 하위 도메인이 바뀌거나 `https` 가 `http` 로 바뀌거나 port 가 바뀌면 다른 출처다.

| 홉 | 헤더 | 대상 URL 의 쿼리 |
|----|------|------------------|
| 출처가 같고 그 전에 출처가 바뀐 적이 없음 | 첫 요청과 같다 | 그대로 |
| 출처가 다름. 그 뒤의 모든 홉(원래 출처로 돌아와도) | 아래 헤더를 이름의 대소문자와 관계없이 뺀다. 사용자가 적은 헤더 가운데 이름이 겹치지 않는 것은 남긴다 | 통합 자격 증명 쿼리와 이름·값이 모두 같은 항목을 뺀다. 다른 쿼리는 그대로 둔다 |

출처가 바뀐 홉에서 빼는 헤더:

- 통합 자격 증명 헤더의 이름(`api_key` 의 `key_name`, `bearer_token`·`basic` 의 `Authorization`)
- 통합 공용 헤더(`default_headers`)의 이름
- `Authorization`·`Proxy-Authorization`·`Cookie`. 사용자가 직접 적은 값이어도 뺀다

홉 사설망 검사와 결과 URL(활동 로그의 `api_path`, `output.error.details.url`)은 쿼리를 뺀 URL 을 쓴다.

**method 와 본문.** Fetch 표준의 리다이렉트 규칙을 따른다. 바뀐 method 는 그 뒤의 홉에도 이어진다.

| 응답 | 요청 method | 다음 홉 |
|------|-------------|---------|
| 303 | `GET`·`HEAD` 가 아닌 것 | 본문 없는 `GET`. `Content-Type`·`Content-Encoding`·`Content-Language`·`Content-Location`·`Content-Length` 를 뺀다 |
| 301·302 | `POST` | 위와 같다 |
| 그 밖(307·308, 301·302 의 `POST` 가 아닌 method, 303 의 `GET`·`HEAD`) | — | method 와 본문을 그대로 보낸다 |

### 활동 로그

활동 로그는 `authentication === 'integration'` 일 때만 남긴다. `none`·`custom` 인증은 활동 로그를 만들지 않으므로 사설망 차단·전송 실패를 포함한 모든 실패가 에러 포트 라우팅으로만 드러난다. `integration` 인증이어도 노드 취소 신호로 끝난 호출은 끝나지 않은 호출이라 활동 로그를 남기지 않는다([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) 규칙 3). Cafe24·MakeShop 핸들러 구현과 같다(통합 노드 공통 규약에 적는 일은 NERV Task `CLE-T-GZRYQ3`).

| 조건 | `status` | `error.code` |
|------|----------|--------------|
| 2xx | `success` | — |
| 3xx·4xx·5xx | `failed` | `HTTP_{status}` (예: `HTTP_502`) |
| 요청 reject (네트워크·노드 자체 타임아웃) | `failed` | `HTTP_TRANSPORT_FAILED` |
| 사설망 차단·리다이렉트 한도 초과 | `failed` | `HTTP_BLOCKED` |
| 사설망 차단 가드의 고장 (preflight) | `failed` | `INTEGRATION_CALL_FAILED` |

활동 로그의 `error.code` 는 상태 코드별(`HTTP_{status}`)이고, 노드 출력의 `output.error.code` 는 범주별(`HTTP_4XX`·`HTTP_5XX`)이다. 두 값을 섞지 않는다.

API 식별 정보는 다음처럼 채운다. 통합별 채우기 정책의 전체 표는 [통합 데이터와 흐름 「호출 API 식별 채우기 규칙」](../CLE-INT/CLE-INT-DATA.md#호출-api-식별-채우기-규칙) 에 있다.

- `api_label` = NULL. 사용자가 임의 URL 을 부르므로 카탈로그 키가 없다.
- `api_method` = 정규화한 HTTP method(`GET`·`POST` 등).
- `api_path` = `base_url` 을 합친 뒤의 절대 URL 에서 호스트+경로. query string 은 지운다(엔드포인트 단위 묶음과 자격 증명 누출 방지). `base_url` 없이 상대 URL 만 있으면 경로만 저장한다. URL 파싱에 실패하면 원문 문자열을 그대로 저장한다. 길이 초과는 백엔드가 자른다([통합 노드 공통](CLE-NODE-INT-COMMON.md)).

## Rationale

### 노드 취소를 에러 포트로 보내지 않는다 (2026-10-10)

이 노드는 원래 노드 취소 신호(`context.abortSignal`)로 끊긴 요청을 전송 실패와 묶어 `HTTP_TRANSPORT_FAILED` 와 에러 포트로 돌려줬다. [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) 규약은 외부 I/O 노드가 취소 때 `AbortError` 를 그대로 던진다고 정한다. 그래서 cancel-others-on-fail 로 멈춘 HTTP 분기가 `cancelled` 대신 에러 포트 라우팅으로 기록됐다. 사용자가 2026-10-10 에 선택지 1 을 승인했다.

- 선택지 1(채택): Cafe24·MakeShop 핸들러처럼 노드 취소 신호로 생긴 `AbortError` 를 다시 던진다. 엔진이 노드 실행을 `cancelled` 로 기록한다.
- 선택지 2(기각): 지금 동작을 노드 취소 규약의 예외로 적는다. 이렇게 하면 취소된 분기가 에러 포트를 따라 다음 노드를 실행하므로 기각했다.

노드 자체 타임아웃은 이 결정의 범위 밖이다. 그대로 `HTTP_TRANSPORT_FAILED` 로 에러 포트에 간다. 두 `AbortError` 는 노드 취소 신호가 취소됐는지로 가른다. 실행 안의 실패는 에러 포트로 보낸다는 원칙은 그대로다. 노드 취소는 실패가 아니어서 그 원칙의 대상이 아니다. 이 예외를 통합 노드 공통 규약에 적는 일은 NERV Task `CLE-T-GZRYQ3` 가 맡는다.

리스너 정리를 `finally` 에서 하는 이유는 실행 로직 13단계에 적었다.

자세한 배경은 [노드 취소 §HTTP Request 노드도 노드 취소를 cancelled 로 끝낸다](../CLE-EXEC/CLE-EXEC-CANCEL.md#http-request-노드도-노드-취소를-cancelled-로-끝낸다-2026-10-10) 에 있다.

### 진입할 때 노드 취소 신호를 따로 확인하지 않는다 (2026-10-10)

신호를 잇기 전 단계(통합 조회와 자격 증명 해소, 사설망 차단 검사와 DNS 해석)는 노드 취소 신호를 받지 않는다. 그 사이에 신호가 취소되면 요청 직전에 신호를 잇는 순간 요청이 끊긴다. `linkUpstreamAbort` 가 이미 취소된 신호를 보면 `controller.abort()` 를 바로 부르기 때문이다. 그래서 노드 실행은 취소됨(`cancelled`)으로 끝난다. 다만 대상이 차단 주소면 그 전에 `HTTP_BLOCKED` 로 에러 포트에 간다. 차단 주소는 취소와 상관없이 실패할 요청이므로 진입 확인을 더하지 않았다. dispatch 전에 신호가 이미 취소된 노드는 엔진이 핸들러를 부르기 전에 거른다([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) 규칙 19).

### 출처가 바뀐 리다이렉트 홉에는 자격 증명을 싣지 않는다 (2026-11-05)

이전 구현은 리다이렉트 홉마다 첫 요청과 같은 요청 옵션을 다시 썼다. 그래서 통합의 `Authorization`·API 키 헤더와 자격 증명 쿼리가 `Location` 이 가리키는 다른 호스트로도 나갔다. API 호스트에 열린 리다이렉트(open redirect)가 하나만 있어도 통합 자격 증명이 제3자에게 넘어간다. method 도 응답 코드와 관계없이 그대로였다. 303 을 받은 `POST` 가 다음 호스트에 같은 본문을 다시 보냈다.

- **기준은 Fetch 표준과 curl 이다.** Fetch 는 출처가 바뀐 리다이렉트에서 `Authorization` 을 지운다. curl 은 `--location-trusted` 없이 host 가 바뀌면 `Authorization` 과 `Cookie` 를 보내지 않는다. 출처는 Fetch 처럼 scheme·host·port 로 정한다.
- **통합 헤더는 이름으로 모두 뺀다.** 통합 자격 증명 헤더는 정의상 자격 증명이다. `default_headers` 도 통합 자격 증명 묶음에 저장되고 사용자 정의 인증 토큰을 담을 수 있어 함께 뺀다. 사용자가 노드에 적은 헤더는 작성자가 의도한 값이라 남긴다. 다만 `Authorization`·`Proxy-Authorization`·`Cookie` 는 출처와 상관없이 자격 증명을 실어 나르는 헤더라 뺀다.
- **한 번 바뀌면 끝까지 뺀다.** 원래 출처로 돌아올 때 다시 싣는 안은 기각했다. 그러면 다른 출처의 서버가 원래 출처의 경로를 골라 인증된 요청을 보내게 할 수 있다(307 로 `POST` 와 본문을 유지한 채). Fetch 도 한 번 지운 헤더를 다시 붙이지 않는다.
- **쿼리는 이름과 값이 모두 같을 때만 뺀다.** 이름만 같으면 빼는 안은 기각했다. 대상 서비스가 같은 이름의 다른 값을 쓸 수 있다. 쿼리를 모두 지우는 안도 기각했다. `state` 같은 값을 쿼리로 넘기는 리다이렉트가 깨진다. 막으려는 것은 우리 자격 증명 값이 새는 것이다.
- **method 규칙은 Fetch 표준을 따른다.** 본문 헤더 목록에 `Content-Length` 를 더한 이유는 Node 의 fetch 가 사용자가 적은 `Content-Length` 를 막지 않기 때문이다. 본문 없는 요청에 남으면 길이가 맞지 않는다.
- **연결 테스트도 같은 함수를 쓴다.** `base_url` 이 다른 출처로 리다이렉트하면 노드도 자격 증명 없이 그 출처를 부른다. 연결 테스트도 같은 결과(대개 `HTTP_AUTH_FAILED`)를 내야 테스트 통과가 실행 성공을 뜻한다.

### 사설망 차단을 모든 인증 방식에 적용 (2026-06-11)

원래 사설망 차단은 `authentication='integration'` 일 때만 적용됐다. 그래서 `none`·`custom` 인증 요청은 `169.254.169.254`(클라우드 메타데이터)와 RFC1918 내부망을 가드 없이 직접 부를 수 있었다. "none 은 내부 서비스를 정당하게 부를 수 있다" 는 코드 주석의 정당화는 스펙 근거가 없었고 "기본은 차단이며 이 플래그가 통합 노드 전체의 사설망 차단을 제어한다" 는 스펙 서술과 정면으로 어긋났다.

사용자 결정(2026-06-11)으로 가드를 모든 인증 방식에 적용했다. 내부 서비스 접근이라는 정당한 용도는 이미 `ALLOW_PRIVATE_HOST_TARGETS=true` 로 충족되므로 `none` 전용 예외를 둘 이유가 없다. 이 결정으로 Database Query·Send Email 노드와 보안 자세가 같아지고 `NF-SC-05`(OWASP)와도 맞는다. 활동 로그는 이전처럼 `integration` 인증에만 남긴다. 모든 인증 방식에 공통인 것은 사설망 차단의 에러 포트(`HTTP_BLOCKED`) 라우팅이다.

기각한 대안:

- `none` 전용 호스트 허용 목록 환경 변수: 플래그가 둘로 나뉘고 근거 없는 새 표면이 생기며 Database Query·Send Email 과 보안 자세가 계속 갈린다.
- 현상 유지 + "none 은 의도적으로 가드 없음" 명문화: 클라우드 메타데이터·내부망 공격 면이 그대로 열리고, 그 용도는 이미 opt-out 으로 충족되므로 예외를 둘 이유가 없다.

### 연결할 때 푼 주소를 다시 판정한다 (2026-11-14)

8단계 검사는 요청 전에 DNS 를 풀어 판정하지만 `fetch` 는 연결할 때 이름을 다시 푼다. 그 사이에 응답이 바뀌면(TTL 0 rebinding) 검사를 통과한 이름이 내부 주소로 연결될 수 있었다. 권한 DNS 를 쥔 공격자가 검사 때는 조회 실패를, 연결 때는 내부 주소를 돌려주는 변형도 있었다. NERV Task `CLE-T-BS1WD1` 에서 연결에 쓰는 주소 조회(undici `Agent` 의 `connect.lookup`)에 8단계와 같은 대역 판정을 넣었다.

- **검사 결과로 고정하지 않고 연결할 때 다시 판정한다.** 판정한 주소와 연결하는 주소가 같은 조회 결과라서 판정을 거치지 않은 주소로는 연결하지 않는다. 검사 결과를 그대로 쓰려면 요청마다 dispatcher 를 만들어야 해서 keep-alive 연결을 다시 쓰지 못하고 dispatcher 수명도 따로 관리해야 한다. 판정 dispatcher 는 프로세스에 하나라서 연결을 다시 쓴다. 다시 쓰는 연결은 맺을 때 판정을 거쳤다.
- **8단계 검사는 남겼다.** 차단이 통합 해소 뒤 · 요청 전에 나오는 순서와 차단 코드를 그대로 두려는 것이다. 연결 시점 차단도 같은 `HTTP_BLOCKED` 와 일반화 문구로 내고 원래 주소는 서버 로그에만 남긴다.
- 연결 시점 조회가 `fetch` 의 원래 조회를 대신하므로 요청 하나의 조회 횟수는 전과 같다.
- 해석 실패는 전처럼 통과시킨다(사람 결정, 2026-11-14). 연결할 때도 풀리지 않으면 요청이 `HTTP_TRANSPORT_FAILED` 로 끝난다. 검사 때 실패하고 연결 때 내부 주소로 풀리는 변형은 연결 시점 판정이 막는다.
- TLS 의 SNI 와 인증서 검증은 undici 가 URL 의 호스트 이름으로 하므로 바뀌지 않는다. IP 리터럴 호스트는 조회를 거치지 않으므로 8단계의 리터럴 검사가 맡는다.
- 이 판정 밖에 남은 경로가 있다. HTTP 통합 연결 테스트는 `followRedirectsSafely` 를 함께 쓰지만 이 dispatcher 를 넘기지 않는다. Database Query · Send Email 은 `fetch` 를 쓰지 않아 사전 검사만 한다.

### 통합을 얻기 전에 끝난 실패는 활동 로그에 남기지 않는다 (2026-10-24)

규칙과 근거는 [통합 노드 공통](CLE-NODE-INT-COMMON.md#남의-개인-통합-조회는-없는-통합과-같게-실패한다-2026-10-24) Rationale 에 있다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md) 의 «통합을 얻기 전 실패는 기록하지 않는다» 요구사항).

- 요구사항 변경: 활동 로그 기록 요구사항([활동 로그](#활동-로그))은 «노드 취소 신호로 끝난 호출을 빼고» 에서 «통합을 얻은 뒤의 호출 가운데 노드 취소 신호로 끝난 호출을 빼고» 로 범위를 좁혔다.
