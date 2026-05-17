# HTTP Request output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. `output.requestBody` (evaluated, 256KB cap) + `output.response` + `output.error` 병존 (4xx/5xx) + `meta.statusCode` (transport 실패 시 `0`) 유지.
> 잔여 권고 항목:
> - Transport 실패 시 `output.response: { error: <message> }` legacy 잔재 제거 — `output.error` 만 사용. spec footnote 가 deprecation 의도 명시.

> 대상 spec: `spec/4-nodes/4-integration/1-http-request.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/4-integration/1-http-request.md:122-149` — §5.1 2xx 성공 (port `success`):

```json
{
  "config": { "method": "POST", "url": "https://api.example.com/users", "authentication": "integration", "integrationId": ..., "headers": [...], "queryParams": [], "body": {...}, "bodyType": "json", "responseType": "json", "timeout": 30000, "followRedirects": true, "verifySsl": true },
  "output": {
    "response": { "id": 42, "name": "Alice" },
    "requestBody": { "user": "Alice" },
    "requestBodyType": "json",
    "responseHeaders": { "content-type": "application/json", "authorization": "[REDACTED]" }
  },
  "meta": { "statusCode": 201, "durationMs": 250 },
  "port": "success"
}
```

`spec/4-nodes/4-integration/1-http-request.md:185-216` — §5.3.1 4xx/5xx (port `error`):

```json
{
  "config": {...},
  "output": {
    "response": { "error": "Not Found" },
    "requestBodyType": "json",
    "responseHeaders": { "content-type": "application/json" },
    "error": {
      "code": "HTTP_4XX",
      "message": "HTTP 404 Not Found",
      "details": { "statusCode": 404, "statusText": "Not Found", "url": ..., "method": "GET" }
    }
  },
  "meta": { "statusCode": 404, "durationMs": 120 },
  "port": "error"
}
```

§5.3.2 Transport 실패 — `output.response: { error: "<message>" }` (legacy 잔재) + `output.error.code: 'HTTP_TRANSPORT_FAILED'` + `meta.statusCode: 0`.

## 진단

HTTP Request 는 외부 호출 노드 (단계 1개). 정상 / HTTP 에러 / transport 에러 = 3 케이스.

| 영역 | 적절성 | 근거 |
| --- | --- | --- |
| `output.response` | 적절 (output) | HTTP 응답 body — 비즈니스 결과 (Principle 8.2 표 명시) |
| `output.requestBody?` (256KB cap, evaluated) | 적절 | spec footnote: "wire 에 나간 평가된 본문". `bodyTruncated:true` 동봉 |
| `output.requestBodyType` | 적절 | 실제 적용된 bodyType |
| `output.responseHeaders?` | 적절 | 응답 헤더 (자격증명 sanitize 적용) |
| `output.bodyTruncated?` | 적절 | 256KB cap 동봉 |
| `output.error.{code, message, details}` (4xx/5xx/transport) | 적절 | Principle 3.2 |
| `output.response` + `output.error` 병존 (4xx/5xx) | 적절 | spec 명시: 디버깅 용이성 — 서버 body 보존 |
| `output.response: { error: <message> }` (transport 실패 시) | **부적절** — legacy 잔재 | spec footnote: "신규 코드는 `output.error` 사용". 의미 중복 — 제거 후보 |
| `meta.statusCode` (transport 실패 시 `0`) | 적절 (meta) | spec footnote: magic number — `output.error.code === 'HTTP_TRANSPORT_FAILED'` 로 판별 권장 |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.url` (sanitize 적용 echo) | 적절 | Principle 7 — credential 제거된 raw |
| `config.headers` / `queryParams` (raw echo, `{{ }}` 보존) | 적절 | Principle 7 |

핵심 점검:

1. **`output.response: { error: <message> }` (transport 실패 시) 잔재** — spec footnote 명시: "legacy 호환 잔재 — 신규 코드는 `output.error` 를 사용". 제거 권장. 다운스트림이 transport 실패 시 `output.response.error` 와 `output.error.message` 두 곳을 보고 있을 가능성 있어 deprecation 단계 필요.

2. **`output.response` + `output.error` 병존 (4xx/5xx)** — Information Extractor 의 `output.result + output.error` 와 같은 패턴. 디버깅 (서버 body 보존) 의도 — 합리적. `output.error` 존재 여부로 정상/에러 분기.

3. **`output.requestBody` 위치** — 응답이 아닌 *요청* body 를 `output` 에 두는 것. spec footnote 표(Principle 8.2)에 "HTTP 요청 본문 (evaluated) | `output.requestBody`, `output.requestBodyType`" 으로 명시. config 의 raw body 와 직교 (raw 는 `config.body`, evaluated 는 `output.requestBody`). 적절.

4. **`config.url` sanitize** — credential 제거 후 echo. 자격증명 누출 방지 — 보안 메트릭으로 합리적.

## 개선안 — 정리된 output

```json
// 2xx 성공
{
  "config": {...},
  "output": {
    "response": <unknown>,                       // 응답 body
    "requestBody"?: <unknown>,                   // wire evaluated body, 256KB cap
    "requestBodyType": <enum>,
    "responseHeaders"?: <Record<string, string>>,
    "bodyTruncated"?: <true>
  },
  "meta": { "statusCode": <number>, "durationMs": <number> },
  "port": "success"
}

// 4xx/5xx (정리안 — response 보존)
{
  "config": {...},
  "output": {
    "response": <서버 body>,
    "requestBody"?, "requestBodyType", "responseHeaders"?, "bodyTruncated"?,
    "error": { "code": "HTTP_4XX" | "HTTP_5XX", "message": ..., "details": { "statusCode", "statusText", "url", "method" } }
  },
  "meta": { "statusCode": <number>, "durationMs": <number> },
  "port": "error"
}

// Transport 실패 (정리안 — legacy response.error 제거)
{
  "config": {...},
  "output": {
    // ⚠ "response": { "error": ... } — 제거 권장
    "requestBody"?, "requestBodyType",
    "error": { "code": "HTTP_TRANSPORT_FAILED", "message": ..., "details": { "url", "method" } }
  },
  "meta": { "statusCode": 0, "durationMs": <number> },
  "port": "error"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| `output.response: { error: <message> }` (transport 실패 시) | 제거 — `output.error.message` 만 사용 | legacy 잔재. spec footnote 가 명시적으로 deprecation 의도 표시 |

## Rationale

- HTTP 응답 body (`output.response`) 와 에러 envelope (`output.error`) 의 병존은 디버깅 용이성을 위해 의도적 — Principle 3 의 변형. 다운스트림은 `output.error` 존재 여부로 정상/에러 분기.
- transport 실패 시 `output.response: { error }` 는 호환성 잔재 — 신규 코드는 `output.error` 만 사용해야 한다. deprecation 후 제거.
- `meta.statusCode = 0` magic number 는 transport 실패 식별용으로 합리적이지만, `output.error.code === 'HTTP_TRANSPORT_FAILED'` 가 더 명확한 분기 키 — spec 이 권장.
- `config.url` 의 sanitize echo 는 자격증명 leak 방지 (Principle 7 절대 echo 금지). raw 보존을 위한 trade-off — 사용자가 입력한 `{{ }}` 표현식은 보존되며 credential 만 redact.

## 구현 분석 (2026-05-16)

대상 파일: `codebase/backend/src/nodes/integration/http-request/{http-request.handler.ts, http-request.schema.ts, http-request.handler.spec.ts, http-safety.ts}` + `codebase/backend/src/nodes/integration/_base/{integration-handler-base.ts, sanitize-response-headers.util.ts}`.

1. **spec §5 ↔ handler return 정합성**:
   - 2xx 분기 (`http-request.handler.ts:343-349`): `{config: configEcho, output: { response, ...bodyFields }, meta, port: 'success' }` — spec §5.1 과 정합. `bodyFields` 는 `buildBodyOutputFields` 가 만드는 `{ requestBodyType, requestBody?, bodyTruncated?, responseHeaders? }` (`:415-427`).
   - 4xx/5xx 분기 (`:356-374`): `output.response` 보존 + `output.error.{code, message, details}` 동봉. `code` 는 `res.status >= 500 ? 'HTTP_5XX' : 'HTTP_4XX'` (`:362`). spec §5.3.1 과 정합.
   - **gap (잔여 권고와 정합)**: Transport 실패 분기 (`:391-404`) 는 `output.response: { error: message }` 를 그대로 동봉한다 (`:394`) — spec §5.3.2 의 "legacy 호환 잔재 — 신규 코드는 `output.error` 를 사용" footnote 와 정확히 일치. handler 가 곧 deprecation 대상 코드를 보유 중. `bodyFields` 호출 시 `responseHeaders` 인자를 의도적으로 생략(`:390`) 하므로 transport 실패 시 `output.responseHeaders` 는 부재 (spec 명시 부합).

2. **schema ↔ spec config 정합성**: `httpRequestNodeConfigSchema` (`http-request.schema.ts:96-176`) 의 모든 필드 (method/url/authentication/integrationId/headers/queryParams/body/bodyType/responseType/timeout/followRedirects/verifySsl) 가 spec §1 표와 동일. default 값 일치 (`GET` / `none` / `[]` / `json` / `30000` / `true` / `true`). `keyValueSchema` (`:17-29`) 가 CRLF 차단 + `.passthrough()` 로 메타 필드 허용. 변경 없음.

3. **validate 일관성**: `handler.validate()` (`http-request.handler.ts:84-122`) 는 SSOT (`evaluateMetadataBlockingErrors` + `validateConfig` 의 timeout guard) + method enum / url-string / integrationId-string 의 type 가드만 추가. spec §5.8 의 throw 매트릭스와 1:1 정합.

4. **에러 컨트랙트 (Principle 3)** — **핵심**:
   - **Pre-flight throw** — `assertSafeOutboundUrl` SSRF 차단 (`:265-282`), `Integration-based authentication is not available` (`:170-173`), `INTEGRATION_INCOMPLETE` (`buildHttpCredentials :534-589`), redirect 5홉 (`:301-303`). 모두 spec §5.8 일치.
   - **Runtime `port:'error'`** — 비-2xx (`:356-374`) + transport 실패 (`:391-404`). 두 경로 모두 `output.error.{code, message, details}` 표준 envelope. **부합**.
   - **`output.response: { error }` 잔재** (`:394`) — Principle 3.2 의 `output.error` 만으로 충분하고 spec footnote 가 deprecation 의도 명시 — 본 plan §"분리 제안" 항목과 일치. handler 코드는 spec 과 같은 형태로 잔재가 코드에 남아있다.
   - SSRF 차단을 throw 로 유지하는 spec 명시 정책 (`spec §5.8` 끝 footnote) 과 일치 — `Cafe24` 노드와 비교했을 때, Cafe24 는 호스트가 정해져 있어 별도 `Cafe24_TRANSPORT_FAILED` 로 처리하는 점에서 미세 차이.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 1.1: `config` 에 `headers`/`queryParams`/`body` 의 raw (`{{ }}` 보존) echo, `output` 에 evaluated `requestBody` / `responseHeaders` — 직교 부합.
   - Principle 2: `meta = { statusCode, durationMs }` 만 (`:324`). `meta.statusCode=0` 은 transport 실패 magic number (spec 권장과 정합 — `output.error.code` 가 더 명확한 분기 키).
   - Principle 7 (`config` echo): `configEcho = { ...rawConfig, url: sanitizeUrlCredentials(rawConfig.url) }` (`:148-155`) — spread 패턴으로 신규 schema 필드 자동 echo + URL 만 sanitize. `sanitizeUrlCredentials` (`:50-72`) 는 userinfo + QUERY_PARAM_BLACKLIST (api_key/token/secret/signature/x-amz-* 등) 모두 redact. **자격증명 echo 금지 부합**.
   - Principle 8.2: `output.response` / `output.requestBody` / `output.requestBodyType` / `output.responseHeaders` — spec 표 그대로.
   - `sanitizeResponseHeaders` (`_base/sanitize-response-headers.util.ts:69-`) 가 Authorization/Cookie/Set-Cookie/X-*-Token/X-*-Key 등을 `[REDACTED]` 로 — Principle 7 자격증명 누출 차단의 응답 측 호혜.

6. **handler 테스트 (`http-request.handler.spec.ts`, 1059 줄)**:
   - 정상 2xx (`:132-154`) / 4xx error 포트 (`:156-176`) / 네트워크 실패 (`:178-194`) 케이스 모두 커버.
   - **transport 실패 + legacy `output.response: { error }` 검증** (`:178-194`): 테스트가 명시적으로 `result.output.response.error === 'Network error'` 를 assert 한다 — 본 잔재가 제거되면 본 테스트도 동시 갱신 필요.
   - URL credential sanitize (`:108-130`), 헤더 CRLF 차단 (`:332-355`), redirect SSRF (`:678-716`), `output.requestBody` evaluated + 256KB cap (`:968-995`), 응답 헤더 redact (`:939-966`), 4xx/transport 시에도 `requestBody` 동봉 (`:997-1057`) 모두 커버.
   - 미세 누락: `output.error.details.url` 의 sanitize 적용 여부 (handler `:367,399` 에서 적용) 에 대한 회귀 테스트 없음 — `Basic Auth` URL 이 `details.url` 에서 redact 되는지 직접 assert 부재.

7. **횡단 일관성 (Integration 4종)**:
   - `IntegrationHandlerBase` extends 패턴: HTTP, DB, Email, Cafe24 모두 동일. `resolveIntegration` + `logUsage` + `toLogError` + `sanitizeMessage` 공유.
   - HTTP 만 `IntegrationError` 가 항상 throw 로 surface 되며 (Email/DB/Cafe24 는 runtime catch 후 `port:'error'` 라우팅), 이유: HTTP 는 `authentication='none'` 가능하므로 Integration 에러가 pre-flight 분류. **의도된 비대칭**.
   - `output.response` (HTTP / Cafe24) vs `output.rows` (DB) vs `output.messageId` (Email) — Principle 8.2 표의 노드별 1차 네이밍 통일과 정확히 정합.
   - `meta.statusCode=0` magic number 가 HTTP / Cafe24 transport 실패에 공유 — 일관성 OK.

8. **구현 품질**:
   - 풀/timeout/retry: AbortController + `timeout` (`:284-286`), redirect manual + 5홉 SSRF 재검증 (`:295-310`).
   - 응답 크기 제한: `truncateBodyForOutput(evaluatedRequestBody)` 256KB (`:161`) — **요청** body 만 cap. 응답 body 는 cap 없음 (HTTP Request 의 응답은 사용자가 직접 받아 처리하는 비즈니스 데이터라서). Cafe24 / DB 와 비교 시 응답 cap 부재가 의도된 trade-off.
   - 헤더 병합 우선순위 (`:223-227`) — `credentials.headers` 가 사용자 `userHeaders` 를 덮어쓰는 보안 패턴 (사용자가 Authorization 위조해서 자격증명 무력화 차단). 테스트 `:560-577` 가 회귀 보호.

## 종합 개선안 (2026-05-16)

- [ ] (impl) Transport 실패 분기에서 `output.response: { error: message }` 제거 — `output.error.{code, message, details}` 만 유지. 다운스트림 호환성을 위해 deprecation 노트를 1 minor cycle 둔 뒤 제거 권장. 근거: `http-request.handler.ts:394`, spec `1-http-request.md:273-274` footnote.
- [ ] (impl/test) 위 변경에 따라 `http-request.handler.spec.ts:191-194` (`expect(result.output.response.error).toBe('Network error')`) 갱신 또는 제거. 동시에 `output.error.message === 'Network error'` 의 직접 assert 추가.
- [ ] (spec) `1-http-request.md:264-265` 의 §5.3.2 JSON 예시에서 `output.response.error` 줄 제거 + `output.responseHeaders` 부재 footnote 만 남기기 — 본 변경에 spec 측 정정 필요. 근거: `1-http-request.md:273` "legacy 호환 잔재 — 신규 코드는 `output.error` 를 사용".
- [ ] (impl/test, 선택) `output.error.details.url` 의 sanitize 적용 회귀 테스트 추가 — `Basic Auth` userinfo 가 details 에 leak 되지 않는지 직접 assert. 근거: `http-request.handler.ts:367, 399` 의 `sanitizeUrlCredentials(url)` 적용.
