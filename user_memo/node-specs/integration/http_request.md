# HTTP Request (`http_request`)

> 외부 HTTP API를 호출합니다. Integration 자격증명을 통한 자동 인증, 수동 헤더, body 다양한 타입을 지원합니다.

- **카테고리**: `integration`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `method` | `'GET' \| 'POST' \| 'PUT' \| 'PATCH' \| 'DELETE' \| 'HEAD' \| 'OPTIONS'` | no | `'GET'` | HTTP 메서드 | no |
| `url` | string (expression) | yes | (없음) | 요청 URL (`base_url`+상대경로 또는 절대 URL) | yes |
| `authentication` | `'none' \| 'integration' \| 'custom'` | no | `'none'` | 인증 방식 | no |
| `integrationId` | string | `authentication='integration'`일 때만 | (없음) | Integration 자격증명 ID | no |
| `headers` | `KeyValue[]` | no | `[]` | 요청 헤더 (`{key, value}` 배열). value는 expression 가능 | yes |
| `queryParams` | `KeyValue[]` | no | `[]` | 쿼리 스트링 파라미터 | yes |
| `body` | unknown (json) | no | (없음) | 요청 body (보통 JSON 객체) | (필드 내부 expression) |
| `bodyType` | `'json' \| 'form-data' \| 'x-www-form-urlencoded' \| 'raw' \| 'binary'` | no | `'json'` | body 인코딩 | no |
| `responseType` | `'json' \| 'text' \| 'binary'` | no | `'json'` | 응답 파싱 방식 | no |
| `timeout` | int (ms) | no | `30000` | 요청 타임아웃 | no |
| `followRedirects` | boolean | no | `true` | 리다이렉트 자동 추적 (integration auth는 5홉 제한) | no |
| `verifySsl` | boolean | no | `true` | SSL 인증서 검증 | no |

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | (참조용 — 실제 데이터는 expression으로 url/headers/body에 주입) |
| Output | `success` | Success | HTTP 응답이 2xx일 때 (`res.ok`) |
| Output | `error` | Error | 응답이 4xx/5xx거나 네트워크/타임아웃 에러 |

## Input

핸들러는 input을 직접 사용하지 않고 expression resolver가 `url`/`headers`/`queryParams`/`body` 안의 `{{ ... }}`를 사전 해석합니다.

## Output

### Case 1: 2xx 성공 응답 (JSON)

config: `{ method: "GET", url: "https://api.example.com/users/u_1" }`

```json
{
  "config": {
    "method": "GET",
    "url": "https://api.example.com/users/u_1",
    "authentication": "none"
  },
  "output": {
    "response": { "id": "u_1", "name": "Alice", "email": "a@b.com" }
  },
  "meta": {
    "statusCode": 200,
    "duration": 234
  },
  "port": "success"
}
```

### Case 2: 4xx/5xx 응답

```json
{
  "config": { "method": "GET", "url": "https://api.example.com/users/missing" },
  "output": { "response": { "error": "Not Found" } },
  "meta": { "statusCode": 404, "duration": 120 },
  "port": "error"
}
```

> body는 여전히 응답 그대로(`responseData`) — `output.response`. 위 예시는 API가 자체적으로 `{ error: "..." }`를 보낸 경우. 4xx/5xx도 `output.response`에는 서버의 실제 응답 body가 담깁니다.

### Case 3: 네트워크 에러 또는 타임아웃

```json
{
  "config": { ... },
  "output": { "response": { "error": "fetch failed: ETIMEDOUT" } },
  "meta": { "statusCode": 0, "duration": 30001 },
  "port": "error"
}
```

| 필드 | 설명 |
| --- | --- |
| `config.method`, `config.url`, `config.authentication`, `config.integrationId?` | 사용된 설정 (자격증명 토큰은 제거됨) |
| `output.response` | 응답 body (responseType에 따라 JSON 객체, 문자열, base64 등). 실패 시 `{ error: "메시지" }` |
| `meta.statusCode` | HTTP 상태 코드 (네트워크 에러 시 `0`) |
| `meta.duration` | 요청 시간 (ms) |
| `port` | `'success'` (2xx) 또는 `'error'` (그 외) |

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Get User`라고 가정.

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Get User"].output.response }}` | `{ id: "u_1", name: "Alice" }` | 응답 body 전체 |
| `{{ $node["Get User"].output.response.id }}` | `"u_1"` | 응답 body의 특정 필드 |
| `{{ $node["Get User"].output.response.error }}` | `"Not Found"` | 에러 시 메시지 |
| `{{ $node["Get User"].meta.statusCode }}` | `200`, `404`, `0` (네트워크) | HTTP 상태 |
| `{{ $node["Get User"].meta.duration }}` | `234` | 응답 시간 (ms) |
| `{{ $node["Get User"].port }}` | `"success"` 또는 `"error"` | 라우팅 포트 |
| `{{ $node["Get User"].config.url }}` | `"https://api..."` | 실제 요청한 URL (리다이렉트 후 최종 URL) |
| `{{ $node["Get User"].config.method }}` | `"GET"` | 사용된 메서드 |

## 주의사항

- `authentication: "integration"`이면 `integrationId` 필수. integration의 base_url이 있으면 상대 경로 `url`도 자동 prefix됨.
- Integration 인증 사용 시 SSRF 보호: 리다이렉트 5홉 제한 + 각 홉의 URL을 `assertSafeOutboundUrl`로 검증.
- 헤더/쿼리 파라미터의 키와 값에서 CR/LF는 자동 제거 (header injection 방지).
- `body`가 객체이고 `bodyType: 'json'`이면 자동 `JSON.stringify` + `Content-Type: application/json`.
- `responseType: 'json'`인데 응답이 JSON 파싱 실패하면 `null` (에러 throw 안 함).
- `responseType: 'binary'`는 현재 텍스트로 처리 (실제 바이너리 처리는 추후).
- timeout 도달 시 AbortController가 fetch를 중단 → `meta.statusCode: 0`, `port: error`.
- `output.response`는 반드시 `response` 키 안에 있음. 직접 응답 body가 객체로 노출되지 않으므로 `$node["..."].output.response.field` 형태로 접근.
- Integration 사용 시 별도로 `IntegrationUsage` 로그가 기록됨 (성공/실패/타이밍 추적).
