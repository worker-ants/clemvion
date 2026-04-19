# HTTP Request (`http_request`)

> 외부 HTTP API를 호출합니다. Integration 자격증명을 통한 자동 인증, 사용자 헤더/쿼리 파라미터, 다양한 body 타입과 응답 파싱을 지원합니다. Integration 인증 사용 시 SSRF 차단(프라이빗 IP/링크로컬/메타데이터 엔드포인트)과 리다이렉트 5홉 제한이 적용됩니다.

- **카테고리**: `integration`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `method` | `'GET' \| 'POST' \| 'PUT' \| 'PATCH' \| 'DELETE' \| 'HEAD' \| 'OPTIONS'` | no | `'GET'` | HTTP 메서드 (select 위젯) | no |
| `url` | string | no (핸들러 `validate`는 필수 요구) | (없음) | 요청 URL. `http(s)://`로 시작하면 절대 URL, 아니면 integration의 `base_url`과 결합 | yes |
| `authentication` | `'none' \| 'integration' \| 'custom'` | no | `'none'` | 인증 방식. `'custom'`은 현재 핸들러 기준 `'none'`과 동일하게 동작 (사용자 헤더에 Authorization 직접 작성) | no |
| `integrationId` | string | `authentication='integration'`일 때만 | (없음) | HTTP Integration ID (`serviceType: 'http'`) | no |
| `headers` | `Array<{key:string,value:string}>` | no | `[]` | 사용자 헤더. legacy `Record<string,string>` 형태도 허용 | value는 yes (UI 위젯 `kv-expression`) |
| `queryParams` | `Array<{key:string,value:string}>` | no | `[]` | 쿼리 스트링 파라미터. legacy `Record` 형태도 허용 | value는 yes |
| `body` | unknown | no | (없음) | 요청 body. `bodyType`에 따라 처리 방식 결정 | (필드 내부 expression) |
| `bodyType` | `'json' \| 'form-data' \| 'x-www-form-urlencoded' \| 'raw' \| 'binary'` | no | `'json'` | body 인코딩. legacy `'form'` 값은 `'x-www-form-urlencoded'`와 동일하게 처리 | no |
| `responseType` | `'json' \| 'text' \| 'binary'` | no | `'json'` | 응답 파싱 방식. `'binary'`는 현재 `text`와 동일 처리 | no |
| `timeout` | int (ms) | no | `30000` | 요청 타임아웃. 초과 시 `AbortController`로 중단 | no |
| `followRedirects` | boolean | no | `true` | schema 필드. 핸들러는 integration 인증 시 항상 수동 follow(최대 5홉, 각 홉 SSRF 검증). 그 외는 `redirect: 'manual'`이므로 3xx 응답이 그대로 반환될 수 있음 | no |
| `verifySsl` | boolean | no | `true` | schema 필드. 현재 핸들러는 Node의 글로벌 `fetch` 기본 동작에 위임 | no |

> `bcc`/`verifySsl`/`followRedirects`처럼 schema에는 있으나 핸들러가 아직 완전히 반영하지 않는 필드는 "주의사항" 참고.

## Ports

| 방향 | id | label | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | `data` | (참조용 — 핸들러는 직접 소비하지 않음. expression으로 `url/headers/body` 등에 주입) |
| Output | `success` | Success | `data` | `res.ok`(2xx)인 응답 |
| Output | `error` | Error | `error` | 4xx/5xx 응답, 네트워크 오류, 타임아웃 (SSRF 차단은 throw → 노드 실패) |

## Input

핸들러는 `_input`을 소비하지 않습니다. 엔진의 expression resolver가 `url`, `headers[].value`, `queryParams[].value`, `body` 안의 `{{ ... }}`를 사전 해석한 뒤 핸들러에 넘깁니다.

## Output

### Case 1: 2xx 성공 응답 (`responseType: 'json'`)

입력 config: `{ method: "GET", url: "https://api.example.com/users/u_1", authentication: "none" }`

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
  "meta": { "statusCode": 200, "duration": 234 },
  "port": "success"
}
```

### Case 2: 4xx / 5xx 응답 (body는 그대로 전달)

```json
{
  "config": {
    "method": "GET",
    "url": "https://api.example.com/users/missing",
    "authentication": "none"
  },
  "output": {
    "response": { "error": "Not Found" }
  },
  "meta": { "statusCode": 404, "duration": 120 },
  "port": "error"
}
```

> `output.response`에는 서버가 돌려준 실제 body가 들어갑니다(파싱 실패 시 `null`). 예시의 `{ error: "..." }` 형태는 API가 스스로 그렇게 보낸 경우일 뿐, 핸들러가 만들지 않습니다.

### Case 3: 네트워크 오류 / 타임아웃 / 수동 abort

```json
{
  "config": {
    "method": "GET",
    "url": "https://api.example.com/unreachable",
    "authentication": "none"
  },
  "output": {
    "response": { "error": "fetch failed" }
  },
  "meta": { "statusCode": 0, "duration": 30001 },
  "port": "error"
}
```

### Case 4: Integration 인증 성공 (`integrationId` 포함)

```json
{
  "config": {
    "method": "GET",
    "url": "https://api.example.com/me",
    "authentication": "integration",
    "integrationId": "int_http_1"
  },
  "output": {
    "response": { "id": "u_42", "plan": "pro" }
  },
  "meta": { "statusCode": 200, "duration": 118 },
  "port": "success"
}
```

Integration의 `authType`에 따라 다음 위치에 자격증명이 자동 주입됩니다 (config/output에는 **토큰/비번이 포함되지 않음**):

- `api_key` + `location: 'header'` → 헤더 `{ [key_name]: value }`
- `api_key` + `location: 'query'` → 쿼리 `?{key_name}={value}` 추가
- `bearer_token` → 헤더 `Authorization: Bearer <token>`
- `basic` → 헤더 `Authorization: Basic base64(user:pass)`
- 그 외 `authType` → `INTEGRATION_AUTH_UNSUPPORTED` throw

자격증명에 `base_url`이 있고 `url`이 `http(s)://`로 시작하지 않으면 자동 prefix됩니다 (`base_url`의 trailing `/`, `url`의 leading `/`는 각 한 번만). `default_headers`는 사용자 헤더보다 먼저 적용되지만 **크리덴셜 헤더가 사용자 헤더를 항상 덮어씀** (workflow 작성자가 Authorization을 재정의할 수 없도록).

### Case 5: Integration 인증 중 SSRF 차단

URL 자체가 loopback / RFC1918 / 169.254 / fc00::/7 / `localhost` 로 해석되면 `Error('SSRF_BLOCKED: ...')`를 **throw** 합니다 (error 포트로 라우팅되지 않고 노드 자체가 실패). `IntegrationUsageLog`에는 `code: HTTP_BLOCKED`로 기록됩니다.

### Case 6: Integration 인증 리다이렉트 5홉 초과

5홉 이내면 각 홉마다 `assertSafeOutboundUrl` 재검증 후 계속 따라갑니다. 5홉 초과 시 `throw new Error('SSRF_BLOCKED: redirect chain exceeded 5 hops')` → 노드 실패.

| 필드 | 설명 |
| --- | --- |
| `config.method` | 대문자 정규화된 메서드 |
| `config.url` | 실제 최종 요청 URL (base_url 결합 + 쿼리 파라미터 + integration 리다이렉트 추적 후) |
| `config.authentication` | `'none' \| 'integration' \| 'custom'` |
| `config.integrationId` | integration 사용 시에만 포함 (토큰/비번 등 자격증명은 포함되지 않음) |
| `output.response` | 응답 body (`responseType`에 따라 JSON / 문자열). 예외 경로에서는 `{ error: string }` |
| `meta.statusCode` | HTTP 상태 코드. transport 실패 시 `0` |
| `meta.duration` | 요청 소요 ms |
| `port` | `'success'` (2xx) 또는 `'error'` (그 외) |

> 사용자 config의 `headers`, `queryParams`, `body`, `bodyType`, `responseType`, `timeout`, `followRedirects`, `verifySsl`은 **핸들러 반환 `config`에 echo되지 않습니다.** 후속 노드에서 이들 값을 참조해야 한다면 원본 워크플로우 파라미터를 직접 참조하세요.

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Get User`라고 가정합니다.

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Get User"].output.response }}` | `{ id: "u_1", name: "Alice" }` | 응답 body 전체 |
| `{{ $node["Get User"].output.response.id }}` | `"u_1"` | 응답 body의 특정 필드 |
| `{{ $node["Get User"].output.response.error }}` | `"Not Found"` 또는 `"fetch failed"` | 에러 경로 메시지 (서버 응답 or 네트워크 에러) |
| `{{ $node["Get User"].meta.statusCode }}` | `200`, `404`, `0` | HTTP 상태 (`0`=transport 실패/타임아웃) |
| `{{ $node["Get User"].meta.duration }}` | `234` | 요청 시간 (ms) |
| `{{ $node["Get User"].port }}` | `"success"` \| `"error"` | 활성 출력 포트 |
| `{{ $node["Get User"].config.method }}` | `"GET"` | 사용된 메서드 |
| `{{ $node["Get User"].config.url }}` | `"https://api.example.com/..."` | 최종 요청 URL (쿼리 파라미터 + 리다이렉트 후) |
| `{{ $node["Get User"].config.authentication }}` | `"integration"` | 사용된 인증 방식 |
| `{{ $node["Get User"].config.integrationId }}` | `"int_http_1"` | integration 인증 시만 존재 |

## 주의사항

- **자격증명 제거**: integration 자격증명(token, api_key value, password 등)은 요청 수행에만 사용되며, `config` echo에 절대 포함되지 않습니다. `output.response`에도 자격증명은 들어가지 않지만, 서버가 응답 본문에 포함해 돌려주면 그대로 노출되므로 후속 노드에서 마스킹이 필요하면 별도 처리해야 합니다.
- **SSRF 보호는 integration 인증에 한정**: `authentication: 'integration'`일 때만 URL이 loopback / RFC1918 / 169.254 / 100.64 CGNAT / `::1` / `fc00::/7` / `fe80::/10` / `localhost` 로 향하면 차단됩니다. `'none'` / `'custom'`은 내부망 호출 가능 — 워크플로우 작성자가 책임져야 합니다.
- **리다이렉트 처리**: integration 인증은 `redirect: 'manual'` + 최대 5홉 수동 follow + 각 홉 SSRF 재검증. 그 외 인증 모드도 `redirect: 'manual'`이므로 3xx 응답이 그대로 반환될 수 있습니다 (`meta.statusCode`가 3xx, body는 location 헤더 기반 처리 안 함). 필요하다면 `followRedirects` 플래그와 무관하게 후속 노드에서 3xx 분기를 직접 처리하세요.
- **헤더/쿼리 정규화**: 배열 형식(`[{key,value}]`) 과 legacy `Record` 형식 모두 허용. `key`가 빈 문자열/공백만이면 자동 drop. `key`/`value` 내부 CR/LF(`\r`, `\n`)은 자동 제거되어 HTTP header injection을 차단합니다.
- **body 처리**: `GET`/`HEAD`에서는 body 무시. 그 외 메서드에서 `bodyType`별 처리:
  - `'json'`: 문자열이면 그대로, 아니면 `JSON.stringify`. `Content-Type: application/json` 자동(사용자/크리덴셜 헤더가 이미 지정했으면 존중).
  - `'x-www-form-urlencoded'` 또는 legacy `'form'`: `URLSearchParams` 직렬화. `Content-Type: application/x-www-form-urlencoded`.
  - `'form-data'`: `FormData` 생성. multipart boundary가 제대로 붙도록 `Content-Type` 헤더는 강제로 제거.
  - `'raw'` / `'binary'`: 문자열이면 그대로, 아니면 `JSON.stringify`.
- **JSON 응답 파싱 실패**: `responseType: 'json'`에서 body가 JSON이 아니면 `output.response`가 `null`로 떨어집니다 (throw하지 않음).
- **`responseType: 'binary'`**: 현재 구현은 `text`와 동일하게 처리합니다 (진짜 바이너리 반환은 미지원).
- **`verifySsl`**: schema 필드지만 현재 핸들러는 사용하지 않습니다. TLS 검증은 Node 런타임 기본 동작.
- **`custom` 인증**: 핸들러는 `'none'`과 동일하게 취급하며 자격증명 주입 없음. 워크플로우 작성자가 `headers`에 `Authorization` 등을 직접 작성해야 합니다.
- **IntegrationUsageLog**: `authentication: 'integration'` + `integrationId`가 있을 때만 기록. `HTTP_<status>`(non-2xx), `HTTP_TRANSPORT_FAILED`(네트워크), `HTTP_BLOCKED`(SSRF), `INTEGRATION_*`(자격증명/설정) 코드로 Activity 탭에 표시됩니다.
- **AbortController 타임아웃**: `timeout`(ms) 초과 시 fetch가 중단되고 `port: 'error'` + `meta.statusCode: 0`으로 떨어집니다.
