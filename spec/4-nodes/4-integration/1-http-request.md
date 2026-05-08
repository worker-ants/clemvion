# Spec: HTTP Request

> 관련 문서: [Integration 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진 §10](../../5-system/4-execution-engine.md#10-integration-handler-계약)

범용 HTTP 요청 노드. 인증 없이 사용하거나 Integration을 참조하여 인증 헤더를 자동 주입할 수 있다.

---

## 1. Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| method | Enum | ✓ | GET | GET / POST / PUT / PATCH / DELETE / HEAD / OPTIONS |
| url | String (표현식) | ✓ | — | 요청 URL |
| authentication | Enum | ✓ | none | none / integration / custom |
| integrationId | UUID | — | — | authentication=integration 시 필수 |
| headers | KeyValue[] | — | [] | 요청 헤더 |
| queryParams | KeyValue[] | — | [] | URL 쿼리 파라미터 |
| body | Object | — | — | 요청 본문 |
| bodyType | Enum | — | json | json / form-data / x-www-form-urlencoded / raw / binary |
| responseType | Enum | — | json | json / text / binary |
| timeout | Integer | — | 30000 | 요청 타임아웃 (ms) |
| followRedirects | Boolean | — | true | 리다이렉트 따라가기 |
| verifySsl | Boolean | — | true | SSL 인증서 검증 |

## 2. 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 |
| Success | 출력 | `success` | HTTP 2xx 응답 시 |
| Error | 출력 | `error` | HTTP 4xx/5xx 또는 네트워크 에러 시 |

## 3. 출력 구조

CONVENTIONS Principle 7 — `config` 는 워크플로 작성자가 입력한 **raw** 설정 (URL credential strip, `{{ ... }}` 보존), 평가 결과는 `output.*` 에 둔다 ([실행 엔진 §5.5 / §6.1](../../5-system/4-execution-engine.md), [PRD ENG-RC-*](../../../prd/3-node-system.md#11-노드-핸들러-실행-컨텍스트-engine-contract)). `output.requestBody` 는 실제로 wire 에 나간 평가된 본문 (256KB cap, 초과 시 `output.bodyTruncated: true`). `output.responseHeaders` 는 응답 헤더 — 자격증명-shape 헤더 (`Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key` 외 패턴) 의 값은 `[REDACTED]` 로 마스킹되어 노출.

**Success 포트:**
```json
{
  "config": {
    "method": "POST",
    "url": "https://api.example.com/users",
    "authentication": "integration",
    "integrationId": "…",
    "body": { "user": "{{ $input.name }}" },
    "bodyType": "json",
    "headers": [],
    "queryParams": [],
    "responseType": "json",
    "timeout": 30000,
    "followRedirects": true,
    "verifySsl": true
  },
  "output": {
    "response": { "id": 42 },
    "requestBody": { "user": "Alice" },
    "requestBodyType": "json",
    "responseHeaders": {
      "content-type": "application/json",
      "authorization": "[REDACTED]"
    }
  },
  "meta": { "statusCode": 200, "duration": 250 },
  "port": "success"
}
```

**Error 포트** (CONVENTIONS §3.2 — 표준 envelope, 본문은 디버깅 용이성을 위해 보존):
```json
{
  "config": { "method": "POST", "url": "https://api.example.com/users", "body": "{{ $input }}", "bodyType": "json" },
  "output": {
    "response": { "error": "boom" },
    "requestBody": { "user": "Alice" },
    "requestBodyType": "json",
    "responseHeaders": { "content-type": "application/json" },
    "error": {
      "code": "HTTP_5XX",
      "message": "HTTP 500 Internal Server Error",
      "details": { "statusCode": 500, "statusText": "Internal Server Error", "url": "https://api.example.com/users", "method": "POST" }
    }
  },
  "meta": { "statusCode": 500, "duration": 100 },
  "port": "error"
}
```

> Transport 실패 (네트워크 / 타임아웃) 시 `output.error.code = 'HTTP_TRANSPORT_FAILED'`, `meta.statusCode = 0`. Response 가 없으므로 `output.responseHeaders` 는 미포함하고 `output.requestBody` / `output.requestBodyType` 만 echo 된다.

## 4. 설정 UI

- Method 드롭다운 + URL 입력 필드 (한 줄)
- Authentication 선택: None / Integration (드롭다운) / Custom (직접 헤더 입력)
- 탭: Headers, Query Params, Body, Advanced
- Body 탭: bodyType에 따라 JSON 에디터 / Key-Value 폼 전환
- Advanced 탭: timeout, followRedirects, verifySsl

## 5. Handler 실행 세멘틱

[Integration 공통 §4 Handler 실행 세멘틱](./0-common.md#4-handler-실행-세멘틱) 의 6단계 계약을 따른다. 노드 고유 동작은 아래와 같다.

**인증 모드**:
| `config.authentication` | 동작 |
|-------------------------|------|
| `none` | 아무 것도 주입 안 함 |
| `integration` | `integrationId`로 Integration 조회 후 `auth_type`별 credential을 요청에 자동 적용 (아래 표) |
| `custom` | 사용자가 `headers`에 직접 입력 |

`authentication='integration'`이지만 `integrationId`가 비어있으면 validate 실패(`integrationId is required when authentication is "integration"`).

**`auth_type`별 credential 적용**:
| `auth_type` | 주입 위치 | 예시 |
|-------------|----------|------|
| `api_key` + `location=header` | `credentials.headers[key_name] = value` | `X-Api-Key: secret` |
| `api_key` + `location=query` | URL 쿼리 파라미터에 `key_name=value` append | `?token=secret` |
| `bearer_token` | `Authorization: Bearer {token}` | — |
| `basic` | `Authorization: Basic {base64(username:password)}` | — |

**헤더 우선순위** (뒤가 우선):
1. `credentials.default_headers`
2. credential 주입 헤더
3. 노드 설정의 `headers` (사용자 입력)

**`base_url` prefix**: credential에 `base_url`이 있고 노드의 `url`이 절대 URL(`https?://` 시작)이 아니면 `{base_url}/{url}`로 결합(중복 슬래시 정규화).

**Usage 로깅** (`authentication='integration'`일 때만 수행):
| 조건 | `status` | `error.code` |
|------|---------|--------------|
| 2xx | `success` | — |
| 3xx/4xx/5xx | `failed` | `HTTP_{status}` |
| fetch reject(네트워크/타임아웃) | `failed` | `HTTP_TRANSPORT_FAILED` |

**반환 shape** (§3과 동일) — 포트는 2xx = `success`, 그 외 = `error`.
