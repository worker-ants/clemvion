# Spec: Integration 노드

> 관련 문서: [PRD Integration 노드](../../prd/3-node-system.md#7-integration-노드-3종) · [PRD 통합/연동](../../prd/4-integration.md) · [Spec 노드 개요](./0-overview.md) · [Spec 노드 공통](../3-workflow-editor/1-node-common.md) · [Spec 데이터 모델](../1-data-model.md)

---

## 1. 공통 패턴

> **본 문서의 범위**: 워크플로 캔버스에 직접 배치되는 Integration 노드(HTTP Request, Database Query, Send Email)의 정의만 다룬다. Integration 엔티티(`service_type='mcp'`)는 워크플로 노드로 노출되지 않고 AI Agent 노드 내부의 `mcpServers` 설정에서만 활용되며, 그 동작·도구 노출 모델은 [Spec MCP Client](../5-system/11-mcp-client.md) 와 [Spec AI 노드 §1](./3-ai-nodes.md#1-ai-agent) 에서 정의한다. 즉 Integration 엔티티는 (a) 본 문서의 노드와 (b) AI Agent MCP provider 두 가지 사용처를 가진다.

### 1.1 Integration 참조

모든 서비스 특화 Integration 노드는 `integrationId` 설정을 통해 Integration 엔티티(spec/1-data-model.md §2.10)에 저장된 인증 정보를 참조한다.

| 설정 필드 | 타입 | 설명 |
|-----------|------|------|
| integrationId | UUID | FK → Integration. 설정 UI에서 드롭다운으로 선택 |

### 1.2 Integration 선택 UI

- 노드 설정 패널 상단에 Integration 선택 드롭다운 표시
- 워크스페이스에 등록된 해당 서비스 타입의 Integration만 필터링하여 표시
- 개인/조직 Integration 구분 표시
- 연결 상태(connected/expired/error) 배지 표시
- "새 Integration 추가" 링크 → Integration 관리 화면으로 이동

### 1.3 공통 출력 구조

모든 Integration 노드의 기본 출력 구조:

```json
{
  "data": { ... },
  "meta": {
    "statusCode": 200,
    "duration_ms": 150,
    "integration": "my-integration"
  }
}
```

---

## 2. HTTP Request

범용 HTTP 요청 노드. 인증 없이 사용하거나 Integration을 참조하여 인증 헤더를 자동 주입할 수 있다.

### 2.1 Config

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

### 2.2 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 |
| Success | 출력 | `success` | HTTP 2xx 응답 시 |
| Error | 출력 | `error` | HTTP 4xx/5xx 또는 네트워크 에러 시 |

### 2.3 출력 구조

**Success 포트:**
```json
{
  "data": { "response_body": "..." },
  "meta": {
    "statusCode": 200,
    "headers": { ... },
    "duration_ms": 250
  }
}
```

**Error 포트:**
```json
{
  "error": {
    "statusCode": 500,
    "message": "Internal Server Error",
    "body": { ... }
  },
  "meta": {
    "duration_ms": 100
  }
}
```

### 2.4 설정 UI

- Method 드롭다운 + URL 입력 필드 (한 줄)
- Authentication 선택: None / Integration (드롭다운) / Custom (직접 헤더 입력)
- 탭: Headers, Query Params, Body, Advanced
- Body 탭: bodyType에 따라 JSON 에디터 / Key-Value 폼 전환
- Advanced 탭: timeout, followRedirects, verifySsl

---

## 3. Database Query

SQL 쿼리를 실행하여 데이터베이스에서 데이터를 조회하거나 조작한다.

### 3.1 Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| integrationId | UUID | ✓ | — | DB Integration 참조 |
| query | String (표현식) | ✓ | — | SQL 쿼리 |
| parameters | Array \| String | — | [] | 파라미터 바인딩 (`$1`, `$2`, ...). JSON 배열 문자열도 허용 |
| queryType | Enum | ✓ | select | select / insert / update / delete / raw |

### 3.2 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 |
| Success | 출력 | `success` | 쿼리 성공 결과 |
| Error | 출력 | `error` | 쿼리 실패 시 에러 정보 (분기 처리 가능) |

### 3.3 출력 구조

**Success 포트 — SELECT:**
```json
{
  "rows": [ { "id": 1, "name": "..." }, ... ],
  "rowCount": 42,
  "fields": [ { "name": "id", "dataTypeID": 23 } ]
}
```

**Success 포트 — INSERT/UPDATE/DELETE (MySQL):**
```json
{
  "rows": [],
  "rowCount": 5,
  "insertId": 99,
  "fields": []
}
```

**Error 포트:**
```json
{
  "error": {
    "code": "QUERY_FAILED",
    "message": "syntax error at or near ..."
  }
}
```

### 3.4 설정 UI

- Integration 선택 드롭다운 (DB 타입만 필터)
- Query Type 드롭다운
- SQL 에디터 (구문 강조, 줄 번호)
- Parameters 섹션: 순서 기반 바인딩 (`$1`, `$2`) — 각 파라미터에 표현식 입력

---

## 4. Send Email

SMTP를 통해 이메일을 발송한다.

### 4.1 Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| integrationId | UUID | ✓ | — | SMTP Integration 참조 |
| to | String[] (표현식) | ✓ | — | 수신자 이메일 목록 |
| cc | String[] | — | [] | 참조 |
| bcc | String[] | — | [] | 숨은 참조 |
| subject | String (표현식) | ✓ | — | 제목 |
| body | String (표현식) | ✓ | — | 본문 |
| bodyType | Enum | — | text | text / html |
| attachments | Attachment[] | — | [] | 첨부 파일 목록 |

**Attachment 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| filename | String | 파일명 |
| content | String (Base64) 또는 URL | 파일 내용 또는 다운로드 URL |

### 4.2 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 |
| Output | 출력 (success) | `out` | 발송 결과 |
| Output | 출력 (error) | `error` | 전송 실패 — `EMAIL_SEND_FAILED` / `INTEGRATION_INCOMPLETE` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` 등 (CONVENTIONS §3.2) |

### 4.3 출력 구조

성공 시:

```json
{
  "config": { "integrationId": "…", "to": [...], "cc": [...], "subject": "…", "bodyType": "text" },
  "output": {
    "messageId": "<message-id@smtp.example.com>",
    "accepted": ["user@example.com"],
    "rejected": []
  },
  "meta": { "durationMs": 820, "deliveryStatus": "sent" }
}
```

실패 시 (`port: 'error'`):

```json
{
  "config": { "integrationId": "…", "to": [...], "subject": "…" },
  "output": {
    "error": {
      "code": "INTEGRATION_NOT_CONNECTED",
      "message": "SMTP integration \"Company SMTP\" is in status \"expired\"",
      "details": {
        "to": ["user@example.com"],
        "subject": "Welcome",
        "integrationCode": "INTEGRATION_NOT_CONNECTED"
      }
    }
  },
  "meta": { "durationMs": 35, "deliveryStatus": "failed" },
  "port": "error"
}
```

> `IntegrationError` 의 원본 코드는 `output.error.code` 로 직접 노출되며 동일한 값이 `output.error.details.integrationCode` 에도 보존된다 (관찰성 대시보드 호환). 순수 SMTP 전송 실패는 `code: 'EMAIL_SEND_FAILED'`.

### 4.4 설정 UI

- Integration 선택 드롭다운 (SMTP 타입만 필터)
- To / CC / BCC: 이메일 칩 입력 (표현식 지원)
- Subject 입력
- Body: 텍스트/HTML 탭 전환, HTML 시 리치 에디터 제공
- Attachments: 파일 추가 UI

---

## 5. 캔버스 요약

| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| HTTP Request | `{method} {url}` (URL 35자 초과 시 잘림) | `GET https://api.exam...` |
| Database Query | `{queryType} · {쿼리 첫 줄}` (잘림) | `SELECT · SELECT * FROM us...` |
| Send Email | `to: {수신자}`. 수신자 2명 초과 시 `+N` 표시 | `to: user@exam..., +2` |

Integration 노드에서 연결된 Integration이 삭제된 경우 `⚠ Missing integration` (앰버색)을 표시한다.

---

## 6. Handler 실행 세멘틱

Integration 노드의 실제 외부 호출 책임은 Execution Engine의 핸들러가 진다. 모든 Integration 핸들러는 다음 공통 계약을 따른다 — 세부는 [Spec 실행 엔진 §7 Integration Handler 계약](../5-system/4-execution-engine.md#7-integration-handler-계약) 참조.

### 6.1 공통 계약

| 단계 | 책임 |
|------|------|
| 1. 워크스페이스 확인 | `ExecutionContext.variables.__workspaceId` 조회. 없으면 즉시 오류 |
| 2. Integration 조회 | `IntegrationsService.getForExecution(integrationId, workspaceId)` 호출. credentials는 AES-256-GCM transformer로 자동 복호화됨 |
| 3. 타입/상태 검증 | `serviceType`이 노드 기대값과 일치 + `status === 'connected'` 검증 |
| 4. Credential 충족 검증 | 서비스별 필수 필드 누락 시 `INTEGRATION_INCOMPLETE` |
| 5. 외부 호출 | 서비스별 SDK/드라이버 호출 |
| 6. Usage 로깅 | 성공·실패 무관 `IntegrationsService.logUsage({integrationId, nodeExecutionId, workflowId, status, durationMs, error?})` 호출 |

### 6.2 공통 에러 코드

| 코드 | 의미 |
|------|------|
| `INTEGRATION_NOT_FOUND` | integrationId가 존재하지 않거나 현재 워크스페이스에 속하지 않음 |
| `INTEGRATION_TYPE_MISMATCH` | 참조된 Integration의 `serviceType`이 노드 기대 타입과 다름 |
| `INTEGRATION_NOT_CONNECTED` | Integration 상태가 `connected`가 아님(`expired`, `error`) |
| `INTEGRATION_INCOMPLETE` | credentials JSONB에 서비스별 필수 필드가 누락 |
| `INTEGRATION_CALL_FAILED` | 기타 일반 예외(분류되지 않은 실패) |

위 코드는 `IntegrationError(code, message)` 예외로 throw되며, 실행 엔진은 노드 실행을 실패 처리하고 동시에 Usage 로그에 `error.code`와 `error.message`를 기록한다.

### 6.3 Send Email (`send_email`)

**라이브러리**: `nodemailer` — Integration.credentials.{host, port, secure, username, password, default_from} 기반으로 SMTP transport를 매 호출마다 생성하고 `finally`에서 `transporter.close()`한다.

**`to`/`cc` 정규화** (`validate()` 통과 후 `execute()`에서 수행):
- 배열 → 각 원소 `trim()` 후 공백 원소 제거
- 문자열 → `","`로 split, 각 토큰 `trim()` 후 공백 제거
- 최종 결과가 비어있으면 "No valid recipients" 오류

**SMTP secure 매핑**:
| `credentials.secure` | nodemailer 옵션 |
|----------------------|-----------------|
| `tls` | `secure: true` |
| `starttls` | `secure: false, requireTLS: true` |
| `none` | `secure: false` |

**반환 shape** (성공 시):
```json
{
  "messageId": "<...>",
  "accepted": ["a@example.com"],
  "rejected": [],
  "to": ["a@example.com"],
  "cc": [],
  "subject": "...",
  "bodyType": "text",
  "status": "sent",
  "durationMs": 412
}
```

**에러 코드**: 공통 코드 외에 `SMTP_SEND_FAILED` (nodemailer sendMail이 throw한 모든 오류).

### 6.4 Database Query (`database_query`)

**드라이버**: `pg` (PostgreSQL) 및 `mysql2` (MySQL). `credentials.driver`가 `'mysql'`이면 `mysql2/promise` 풀을 사용하며, `$1, $2, ...` 플레이스홀더를 내부적으로 `?`로 변환한다(파라미터는 여전히 배열 순서대로 바인딩). `credentials.host/port/database/username/password/driver` 중 하나라도 누락 시 `INTEGRATION_INCOMPLETE`.

**SSL 모드 매핑**:
| `credentials.ssl` | pg 옵션 |
|-------------------|--------|
| `disable` | `ssl: false` |
| `require` | `ssl: { rejectUnauthorized: false }` |
| `verify-full` | `ssl: { rejectUnauthorized: true }` |

**파라미터 바인딩** (`config.parameters`):
- 배열 → 그대로 `client.query(sql, params)`에 전달
- 문자열 → `JSON.parse`로 배열 복원. 파싱 실패 시 `INVALID_PARAMETERS`
- `undefined`/`null`/`''` → 빈 배열

**반환 shape**:
```json
{
  "rows": [...],
  "rowCount": 42,
  "fields": [{"name": "id", "dataTypeID": 23}],
  "query": "...",
  "queryType": "select",
  "durationMs": 18,
  "status": "ok"
}
```

커넥션 lifecycle: 핸들러는 integrationId + credential hash 기준으로 `pg.Pool` / `mysql2.Pool`을 캐시 재사용하며, 각 실행에서 `connect()` → `query()` → `release()` 흐름으로 노출된다.

**포트 라우팅**: 런타임 실패(연결/쿼리 오류)는 `error` 포트로 라우팅된다. 반면 사전 설정 오류(`INTEGRATION_INCOMPLETE`, `INVALID_PARAMETERS`, `INTEGRATION_SERVICE_UNAVAILABLE`)는 throw되어 워크플로우 전체 실패로 처리된다.

**에러 코드**: 공통 + `INVALID_PARAMETERS`, `INTEGRATION_SERVICE_UNAVAILABLE`. SQL 오류는 원본 메시지를 `error` 포트의 `error.message`와 Usage 로그에 기록한다.

### 6.5 HTTP Request (`http_request`)

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

**반환 shape** (§2.3과 동일) — 포트는 2xx = `success`, 그 외 = `error`.

