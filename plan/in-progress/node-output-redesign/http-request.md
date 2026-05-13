# HTTP Request output 개선안

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
