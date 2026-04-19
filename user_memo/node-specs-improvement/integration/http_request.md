# HTTP Request (`http_request`) — Output 일관성 개선안

- **카테고리**: integration
- **현 문서**: [../../node-specs/integration/http_request.md](../../node-specs/integration/http_request.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)

## 1. 현재 Output 구조 요약

외부 HTTP API 호출 결과를 `success` / `error` 두 포트로 라우팅합니다. 성공/실패 모두 `output.response` 하나의 필드에 body 를 담고, 네트워크 오류/타임아웃 시에는 핸들러가 **임의로 `{ error: string }`** 을 채워 반환합니다.

### 현재 Case 1: 2xx 성공

```json
{
  "config": {
    "method": "GET",
    "url": "https://api.example.com/users/u_1",
    "authentication": "none"
  },
  "output": {
    "response": { "id": "u_1", "name": "Alice" }
  },
  "meta": { "statusCode": 200, "duration": 234 },
  "port": "success"
}
```

### 현재 Case 2: 4xx / 5xx 응답 (서버 body 그대로)

```json
{
  "config": { "method": "GET", "url": "https://api.example.com/users/missing", "authentication": "none" },
  "output": { "response": { "error": "Not Found" } },
  "meta": { "statusCode": 404, "duration": 120 },
  "port": "error"
}
```

### 현재 Case 3: 네트워크 오류 / 타임아웃

```json
{
  "config": { "method": "GET", "url": "https://api.example.com/unreachable", "authentication": "none" },
  "output": { "response": { "error": "fetch failed" } },
  "meta": { "statusCode": 0, "duration": 30001 },
  "port": "error"
}
```

특징 요약:

- `output.response` 는 **성공 body / 서버가 돌려준 에러 body / 핸들러가 꾸며낸 `{ error: string }` 3가지 의미**를 한 필드에 담고 있음.
- `meta.duration` 은 다른 노드(`database_query`, `send_email` 등)의 `meta.durationMs` 와 이름이 다름.
- `config.url` 은 base_url 결합/리다이렉트 후 최종 URL을 echo 하지만, 사용자가 `https://user:pass@host/` 형태로 설정한 경우 **credential 이 그대로 echo** 될 여지가 있음 (핸들러는 현재 URL sanitize 를 수행하지 않음).
- SSRF 차단, 리다이렉트 5홉 초과 같은 pre-flight 유사 실패는 `throw` 경로이므로 여기서는 다루지 않음 (P3.1).

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | 에러 시 `output.response: { error: string }` | Principle 3.2 | 표준 에러 형태 `output.error: { code, message, details? }` 를 따르지 않음. 핸들러가 만든 `{ error }` 와 서버가 돌려준 `{ error: ... }` body 가 모양까지 똑같아 구분이 사실상 불가능 |
| 2 | `meta.duration` 이름 | Principle 2 | 다른 노드는 `meta.durationMs`. 표현식 자동완성/멘탈 모델 일관성을 해침 |
| 3 | `config.url` 내 `user:pass@` 그대로 echo 가능 | Principle 7 | "URL 내 임베디드 credential 은 sanitize" 규칙 미준수. `output` 을 공유/로그에 떨어뜨릴 때 credential 유출 위험 |
| 4 | 에러 코드 체계 부재 | Principle 3.2 | `code: HTTP_4XX / HTTP_5XX / HTTP_TIMEOUT / HTTP_NETWORK_ERROR / HTTP_SSRF_BLOCKED` 같은 표준화된 식별자가 없음. 현재는 `meta.statusCode` 와 `output.response.error` 문자열을 조합해 분기해야 함 |
| 5 | 타임아웃/네트워크 실패 시 `meta.statusCode: 0` 의 의미 혼재 | Principle 2 (문서화) | `0` 이 transport 실패를 의미하지만 문서 없이 magic number. 에러 코드가 표준화되면 `statusCode` 는 자연스럽게 optional 이 됨 |

> `output.response` 를 성공 응답 body 의 네이밍으로 유지하는 것은 **의도된 결정**입니다 (아래 5절 근거 참고). 변경 대상은 **에러 분기의 shape 뿐**입니다.

## 3. 제안된 Output 구조

### Before (성공 / 에러 통합 예시)

```json
{
  "config": { "method": "GET", "url": "https://user:pass@api.example.com/x", "authentication": "none" },
  "output": { "response": { "error": "fetch failed" } },
  "meta": { "statusCode": 0, "duration": 30001 },
  "port": "error"
}
```

### After — Case 1: 2xx 성공

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
  "meta": { "statusCode": 200, "durationMs": 234 },
  "port": "success"
}
```

### After — Case 2: 4xx / 5xx (서버 응답 body 보존)

```json
{
  "config": {
    "method": "GET",
    "url": "https://api.example.com/users/missing",
    "authentication": "none"
  },
  "output": {
    "error": {
      "code": "HTTP_4XX",
      "message": "HTTP 404 Not Found",
      "details": {
        "statusCode": 404,
        "body": { "error": "Not Found" }
      }
    }
  },
  "meta": { "statusCode": 404, "durationMs": 120 },
  "port": "error"
}
```

- 서버가 돌려준 실제 body 는 **버려지지 않고** `output.error.details.body` 에 보존됨.
- `code` 는 4xx/5xx 구분이 필요하므로 `HTTP_4XX` / `HTTP_5XX` 로 분리. `statusCode` 는 `meta` 에 그대로 존재.

### After — Case 3: 타임아웃

```json
{
  "config": {
    "method": "GET",
    "url": "https://api.example.com/slow",
    "authentication": "none"
  },
  "output": {
    "error": {
      "code": "HTTP_TIMEOUT",
      "message": "Request aborted after 30000ms",
      "details": { "timeoutMs": 30000 }
    }
  },
  "meta": { "durationMs": 30001 },
  "port": "error"
}
```

- 타임아웃 시 `meta.statusCode` 는 **생략** (`0` magic number 폐기).

### After — Case 4: 네트워크 오류

```json
{
  "config": {
    "method": "GET",
    "url": "https://api.example.com/unreachable",
    "authentication": "none"
  },
  "output": {
    "error": {
      "code": "HTTP_NETWORK_ERROR",
      "message": "fetch failed: getaddrinfo ENOTFOUND",
      "details": { "cause": "ENOTFOUND" }
    }
  },
  "meta": { "durationMs": 42 },
  "port": "error"
}
```

### After — Case 5: SSRF 차단 (error 포트 전환)

기존에는 **throw → 노드 실패**였으나, 사용자 입장에서 "integration 인증 URL 이 사설망/메타데이터 엔드포인트로 향한 경우"는 재시도/분기 가치가 있는 runtime 실패에 가깝습니다. CONVENTIONS P3.1 의 "외부 API 실패" 범주로 재분류하여 error 포트로 라우팅합니다. (단, pre-flight 에 해당하는 `INTEGRATION_AUTH_UNSUPPORTED` 등 자격증명/설정 오류는 여전히 throw.)

```json
{
  "config": {
    "method": "GET",
    "url": "http://169.254.169.254/latest/meta-data/",
    "authentication": "integration",
    "integrationId": "int_http_1"
  },
  "output": {
    "error": {
      "code": "HTTP_SSRF_BLOCKED",
      "message": "SSRF_BLOCKED: link-local metadata endpoint",
      "details": { "reason": "link_local" }
    }
  },
  "meta": { "durationMs": 2 },
  "port": "error"
}
```

### 후보 `output.error.code` enum

| 코드 | 조건 |
| --- | --- |
| `HTTP_4XX` | `res.ok === false` 이고 `400 ≤ statusCode < 500` |
| `HTTP_5XX` | `500 ≤ statusCode < 600` |
| `HTTP_TIMEOUT` | `AbortController` 가 `timeout` 초과로 중단 |
| `HTTP_NETWORK_ERROR` | `fetch` 가 throw (DNS / 연결 거부 / 소켓 오류 등) |
| `HTTP_SSRF_BLOCKED` | integration 인증 URL 검증/리다이렉트 홉 한도 초과 |

### URL sanitize (Principle 7)

`config.url` 을 echo 하기 직전에 다음을 적용합니다.

```ts
function sanitizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.username || u.password) {
      u.username = '';
      u.password = '';
    }
    return u.toString();
  } catch {
    return raw; // 파싱 실패는 원본 유지 (단, 로그에 warn)
  }
}
```

- 사용자가 설정한 원본 URL 에 credential 이 있더라도, 요청은 그대로 수행하되 `config.url` echo 에는 credential 이 들어가지 않음.
- `integration` 인증 경로는 이미 credential 을 URL 에 쓰지 않으므로 영향 없음.

### `output.response` 네이밍은 유지

- CONVENTIONS Principle 8.2 표에서 "HTTP 응답 본문 → `output.response` 그대로 유지 (이미 관용적)" 로 명시됨.
- 대다수 워크플로우가 `$node["X"].output.response.*` 로 body 를 꺼내 사용 중이므로 성공 경로의 breaking change 는 원천 차단.

## 4. 마이그레이션 영향도

| Expression 경로 (Before) | Expression 경로 (After) | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["X"].output.response` (성공) | `$node["X"].output.response` | No | 성공 경로는 완전히 동일 |
| `$node["X"].output.response.id` | `$node["X"].output.response.id` | No | 성공 body 접근 동일 |
| `$node["X"].output.response.error` (실패 시) | `$node["X"].output.error.message` (핸들러 메시지)  /  `$node["X"].output.error.details.body.error` (서버가 돌려준 것) | **Yes** | 실패 분기에서만 발생. 현재 `response.error` 는 "핸들러 문자열 vs 서버 body" 두 의미가 섞여 있어 사용자 측에서도 신뢰도가 낮음 |
| (없음) | `$node["X"].output.error.code` | No (신규) | `HTTP_4XX` / `HTTP_5XX` / `HTTP_TIMEOUT` / `HTTP_NETWORK_ERROR` / `HTTP_SSRF_BLOCKED` |
| (없음) | `$node["X"].output.error.details` | No (신규) | 케이스별 스키마 (body/timeoutMs/cause/reason) |
| `$node["X"].meta.statusCode` (성공 및 4xx/5xx) | `$node["X"].meta.statusCode` | No | 유지. HTTP 응답 수신 성공 시에만 존재 |
| `$node["X"].meta.statusCode === 0` (transport 실패 감지) | `$node["X"].output.error.code === "HTTP_TIMEOUT"` / `"HTTP_NETWORK_ERROR"` | **Yes (behavior)** | magic number `0` 의존 패턴 폐기. 코드로 판별 |
| `$node["X"].meta.duration` | `$node["X"].meta.durationMs` | **Yes** | 이름 변경. 다른 integration 노드(`database_query`, `send_email`)와 통일 |
| `$node["X"].config.url` (credential 포함 가능) | `$node["X"].config.url` (credential 제거됨) | **Yes (데이터)** | 경로는 동일하지만 값에서 `user:pass@` 가 제거됨. 이를 명시적으로 필요로 한 소비자(거의 없음)만 영향 |
| `$node["X"].port` (`'success'` \| `'error'`) | `$node["X"].port` | No | 포트 이름 변경 없음 |
| SSRF throw → 노드 실패 | SSRF → `port: 'error'` + `HTTP_SSRF_BLOCKED` | **Yes (behavior)** | 에러 포트로 잡을 수 있게 됨. throw 에 의존해 실패 전파를 기대하던 워크플로우 영향 |

**권장 전략**:

1. P0 (additive): `output.error.{code,message,details}` 를 핸들러에서 신설하고 `meta.durationMs` 를 동시 노출, `meta.duration` 은 한 릴리즈 동안 alias 로 병행 제공 (deprecation 경고 로그).
2. P0 (security): `config.url` sanitize 는 즉시 적용 — 민감정보 유출 방지가 behavior 변경보다 우선.
3. P1: `output.response.error` (실패 분기에서) 는 한 릴리즈 동안 `output.error.details.body` 와 duplicate 로 노출한 뒤 다음 major 에서 제거.
4. P1: SSRF throw → error 포트 전환은 breaking behavior change 이므로 changelog 에 강조하고, 기존 SSRF throw 를 catch 하지 않던 워크플로우가 실패 대신 error 분기로 돌기 전에 사용자 공지 필요.
5. P2: `meta.statusCode: 0` 은 한 릴리즈 동안 유지 후 제거. transport 실패 판별은 `output.error.code` 로 유도.

## 5. 근거

- **Principle 3.2 (에러 표준 shape)**: `code / message / details` 3-필드 구조가 integration 3노드(`http_request`, `database_query`, `send_email`) 에서 동일하게 반복되면, 워크플로우 작성자는 **노드 종류를 몰라도 에러 처리 서브그래프를 재사용** 할 수 있습니다. 현재 HTTP 만 `output.response.error` 로 엇나가 있어 이 재사용성을 깨뜨립니다.
- **Principle 2 (meta 네이밍)**: `durationMs` 통일은 순수 네이밍 정리이지만, 자동완성 힌트의 일관성은 사용자 학습 비용을 직접 낮춥니다 (최근 PR `fd3dc27` 에서 노드별 변수 힌팅이 이미 정비된 만큼 이름까지 정렬해두는 편이 낫습니다).
- **Principle 7 (URL sanitize)**: `config.url` 은 디버깅/재실행을 위해 echo 하지만, credential 동봉 URL 은 그 자체가 민감정보입니다. `new URL(...).username = ''` 한 줄로 방어 가능하므로 security fix 로 즉시 적용하는 것이 합리적입니다.
- **`output.response` 유지 이유**: 이 네이밍은 (a) CONVENTIONS P8.2 에서 명시적으로 유지 대상, (b) `manual_trigger` 의 `output.request` 와 대칭 (request ↔ response), (c) 대부분의 기존 워크플로우가 의존 중. 성공 경로를 건드리지 않는 것이 전체 마이그레이션 비용을 최소화합니다.
- **SSRF 분류 재조정 근거**: 현재 SSRF throw 는 integration 인증 URL이 사설망으로 향할 때 발생합니다. 이는 사용자의 **오타/잘못된 환경변수 주입** 에서 흔히 기인하고, 재시도/폴백 분기 가치가 있는 runtime error 에 가깝습니다. Pre-flight 에 해당하는 자격증명/설정 누락(`INTEGRATION_AUTH_UNSUPPORTED` 등)은 여전히 throw 유지.
- **INCONSISTENCY_MATRIX 축 3**: `http_request` 행이 정확히 본 개선안으로 매핑됨 — "error 포트의 `output.error.{code,message,details}` 로 통일".
