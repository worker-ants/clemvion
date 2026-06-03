---
id: database-query
status: implemented
code:
  - codebase/backend/src/nodes/integration/database-query/database-query.handler.ts
  - codebase/backend/src/nodes/integration/database-query/database-query.schema.ts
---

# Spec: Database Query

> 관련 문서: [Integration 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진 §10](../../5-system/4-execution-engine.md#10-integration-handler-계약) · [CONVENTIONS](../../conventions/node-output.md)

SQL 쿼리를 실행하여 외부 데이터베이스에서 데이터를 조회하거나 조작한다. PostgreSQL / MySQL 드라이버를 모두 지원하며, 실행 결과는 `success` 포트, 런타임 실패(구문 오류, 커넥션 drop, 제약 위반 등)는 `error` 포트로 분기된다.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| integrationId | UUID | ✓ | — | DB Integration 참조 ([공통 §1](./0-common.md#1-integration-참조)) |
| query | String (표현식) | ✓ | — | SQL 쿼리. `{{ }}` 템플릿 허용. PostgreSQL 스타일 `$1`, `$2`, ... 플레이스홀더 사용 |
| parameters | Array \| String | | `[]` | `$1`, `$2`, ... 위치 기반 바인딩 값. JSON 배열 문자열도 허용 (예: `'["v1", 2]'`) |
| queryType | Enum | ✓ | `select` | `select` / `insert` / `update` / `delete` / `raw` — 감사·UI 힌트 (실행 분기에 영향 없음) |

> Source of truth: `codebase/backend/src/nodes/integration/database-query/database-query.schema.ts` (export `databaseQueryNodeConfigSchema`)
>
> `query` / `parameters` 의 expression(`{{ }}`) 은 엔진이 dispatch 직전 평가하므로 핸들러는 평가된 SQL·값으로 동작한다. `config` echo 는 평가 전 raw 형태를 보존한다 (Principle 7).

## 2. 설정 UI

```
┌──────────────────────────────────────────┐
│  Integration  [ Postgres-prod  ▼ ]       │
│  Query Type   [ SELECT         ▼ ]       │
│                                          │
│  SQL                                     │
│  ┌──────────────────────────────────────┐│
│  │ SELECT id, name FROM users           ││
│  │ WHERE id = $1                        ││
│  └──────────────────────────────────────┘│
│                                          │
│  Parameters (JSON array)                 │
│  ┌──────────────────────────────────────┐│
│  │ [ "{{ $input.userId }}" ]            ││
│  └──────────────────────────────────────┘│
└──────────────────────────────────────────┘
```

- Integration 선택은 [공통 §2](./0-common.md#2-integration-선택-ui) 의 드롭다운 패턴을 따른다 (`service_type=database` 만 노출).
- SQL 에디터는 구문 강조·줄 번호를 제공한다.
- Parameters 입력은 `$1`, `$2`, ... 순서 기반 — 표현식(`{{ }}`) 으로 input 값 바인딩 가능.

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 입력 데이터 (1개) — `query` / `parameters` expression 의 `$input` 으로 접근 |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `success` | Success | data | false | 쿼리 실행 성공 시 결과 분기 |
| `error` | Error | error | false | 런타임 실패(구문 오류·커넥션 drop·제약 위반·권한 부족 등) 분기 (CONVENTIONS Principle 3.1) |

> Database Query 는 동적 포트가 없다. D4 이후 자격증명 누락·`INVALID_PARAMETERS`·integration resolve 실패 등 모든 실패 경로가 `error` 포트로 흐른다 (§5.3).

## 4. 실행 로직

[Integration 공통 §4 Handler 실행 세멘틱](./0-common.md#4-handler-실행-세멘틱) 의 6단계 계약을 따른다. 노드 고유 동작:

0. **Abort 사전 체크**: execute 진입 시 `context.abortSignal?.aborted` 이면 즉시 `AbortError` (`err.name='AbortError'`) 를 throw 한다 — cancel-others-on-fail 등으로 이미 취소된 뒤 dispatch 된 케이스. 진행 중 abort 의 driver-level cancel(예: pg `client.cancel`) 은 best-effort (후속 PR 후보).
1. **드라이버 분기**: `Integration.credentials.driver` 가 `'mysql'` 이면 `mysql2/promise` 풀, 그 외(기본 `'postgres'`) 는 `pg` 풀 사용.
2. **풀 캐시**: integrationId + credential SHA-256 해시를 키로 풀을 재사용한다 (`POOL_MAX_CONNECTIONS=5`, `POOL_IDLE_TIMEOUT_MS=30000`). credential 회전 시 stale 풀을 evict 후 새 풀 생성.
3. **PostgreSQL 플레이스홀더 변환** (MySQL 전용): `$1, $2, ...` → `?` 로 변환 (정규식 `\$\d+`). 파라미터는 여전히 배열 순서대로 위치 바인딩.
4. **파라미터 정규화** (`config.parameters`):
   - `Array` → 그대로 사용
   - `string` → `JSON.parse` 시도, 결과가 배열이면 사용
   - `undefined` / `null` / `''` → `[]`
   - 그 외 / JSON parse 실패 → `INVALID_PARAMETERS` 코드로 `port: 'error'` (§5.3, D4)
5. **PostgreSQL 실행**: `pool.connect()` → `client.query(sql, params)` → `client.release()`.
6. **MySQL 실행**: `pool.query(sql, params)` — 결과가 배열이면 SELECT 계열 (`rows` / `fields`), `ResultSetHeader` 면 INSERT/UPDATE/DELETE 계열 (`rowCount = affectedRows`, `insertId`).
7. **SSL 매핑**:

   | `credentials.ssl` | pg 옵션 | mysql2 옵션 |
   |-------------------|---------|-------------|
   | `disable` | `ssl: false` | `ssl: undefined` |
   | `require` | `ssl: { rejectUnauthorized: true }` | `ssl: { rejectUnauthorized: true }` |
   | `verify-full` | `ssl: { rejectUnauthorized: true }` | `ssl: { rejectUnauthorized: true }` |

   > `require` 도 인증서 검증을 강제한다 (MITM 방어). self-signed 인증서를 쓰려면 별도 `require-trust` 모드 도입이 필요하다.

8. **Usage 로깅**: 성공·실패 모두 `IntegrationsService.logUsage({ integrationId, status, durationMs, error?, api })` 호출 ([공통 §4.1](./0-common.md#41-공통-계약) 단계 6). 활동 로그 API 식별 정보 (`_product-overview.md` INT-US-05):
   - `api_label` = NULL (Database Query 는 endpoint 카탈로그 없음 — 임의 SQL 호출)
   - `api_method` = SQL 동사 (`SELECT` / `INSERT` / `UPDATE` / `DELETE`). `config.queryType` 의 enum 을 그대로 대문자 표기. `queryType='raw'` 인 경우 evaluated SQL 의 첫 토큰을 대문자로 추출 — 추출 실패 시 NULL
   - `api_path` = driver token (`postgres` / `mysql`) — SQL 본문 파싱 회피 + PII 직접 노출 차단. 그 외 driver 가 추가되면 같은 token vocabulary 확장
9. **포트 라우팅**: 정상 종료 → `port: 'success'` / 그 외 모든 실패 (쿼리 throw·자격증명 누락·integration resolve 실패 등) → `port: 'error'` (§5.3, D4).

> **Dry-run (재실행)** — 노드는 dry-run 을 지원한다 (`metadata.supportsDryRun=true`, [재실행 §7.1](../../5-system/13-replay-rerun.md#71)). config 검증·echo 직후, DB 연결을 열기 전에 **WRITE 작업만** mock 으로 단락한다: `queryType` 이 `insert`/`update`/`delete` 이거나 (`raw`/누락 시) SQL 첫 토큰이 write 동사 화이트리스트(`INSERT`/`UPDATE`/`DELETE`/`UPSERT`/`MERGE`/`REPLACE`/`TRUNCATE`/`DROP`/`CREATE`/`ALTER`/`GRANT`/`REVOKE`) 면 write 로 간주. 모호하면 read 로 떨어뜨려 실제 실행한다(재현성 우선). **READ(SELECT) 는 dry-run 에서도 실제로 실행**한다 (부수효과 없음). mock 경로는 pool/connect 를 절대 호출하지 않고 `port: 'success'` + `buildDryRunMock('database_query', { operation, sqlPreview })` (`sqlPreview` = SQL 앞 ~200자, 바인딩 값 미포함) 로 흐른다.

> **SSRF 가드** — 자격증명 충족 검증 직후, 풀 연결 전에 `credentials.host` 를 검사한다 (`assertSafeOutboundHostResolved`). 사설(RFC1918)·loopback·link-local·CGNAT·IPv6 사설 대역으로 해석되면 차단하고 `port: 'error'` 로 라우팅한다. [HTTP Request §4](./1-http-request.md#4-실행-로직)·Send Email 과 **동일 메커니즘·플래그** — 기본 차단, self-host(예: VPC 안 RDS·내부 DB)는 `ALLOW_PRIVATE_HOST_TARGETS=true` 로 opt-out. 차단 시 코드는 전용 코드 없이 `mapDbError` fallback 인 `INTEGRATION_CALL_FAILED` 로 surface 된다 (HTTP 의 `HTTP_BLOCKED`·Email 의 `EMAIL_HOST_BLOCKED` 와 달리 driver 도메인 전용 코드 미정의 — 향후 통일 후보).

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> Database Query 는 §5.1 (정상 — SELECT/0건/INSERT) / §5.3 (모든 에러 — D4 이후 단일 경로) 케이스로 구성된다. Status 는 미사용 (`undefined` — 비-블로킹 노드).

### 5.1 Case: 정상 실행 (port `success`)

#### 5.1.1 SELECT — 결과 1건 이상 (PostgreSQL)

```json
{
  "config": {
    "integrationId": "int_pg_1",
    "query": "SELECT id, name FROM users WHERE id = $1",
    "queryType": "select",
    "parameters": ["{{ $input.userId }}"]
  },
  "output": {
    "rows": [{ "id": "u_1", "name": "Alice" }],
    "rowCount": 1,
    "fields": [
      { "name": "id", "dataTypeID": 25 },
      { "name": "name", "dataTypeID": 25 }
    ]
  },
  "meta": { "durationMs": 12 },
  "port": "success"
}
```

#### 5.1.2 SELECT — 결과 0건

> 0건은 **에러가 아님** (CONVENTIONS Principle 3.1 "예상 가능한 비즈니스 실패"). 정상 `success` 포트로 흐르며 `rowCount: 0`. 후속 노드에서 `if $node["X"].output.rowCount > 0` 로 분기한다.

```json
{
  "config": {
    "integrationId": "int_pg_1",
    "query": "SELECT id FROM users WHERE id = $1",
    "queryType": "select",
    "parameters": ["{{ $input.userId }}"]
  },
  "output": {
    "rows": [],
    "rowCount": 0,
    "fields": [{ "name": "id", "dataTypeID": 25 }]
  },
  "meta": { "durationMs": 4 },
  "port": "success"
}
```

#### 5.1.3 INSERT (MySQL — `ResultSetHeader`)

```json
{
  "config": {
    "integrationId": "int_mysql_1",
    "query": "INSERT INTO logs (msg) VALUES ($1)",
    "queryType": "insert",
    "parameters": ["{{ $input.message }}"]
  },
  "output": {
    "rows": [],
    "rowCount": 1,
    "insertId": 99,
    "fields": []
  },
  "meta": { "durationMs": 8 },
  "port": "success"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.integrationId` | UUID | config echo (Principle 7) | DB Integration 참조 (자격증명 echo 금지 — id 만) |
| `config.query` | string | config echo | 사용자가 입력한 raw SQL — `{{ }}` / `$N` 보존 |
| `config.queryType` | enum | config echo | `'select'` / `'insert'` / `'update'` / `'delete'` / `'raw'` (default `'select'`) |
| `config.parameters` | Array \| string | config echo | raw 파라미터 — JSON 배열 문자열도 가능 |
| `output.rows` | Array<Record> | handler return | SELECT 결과 행 목록. INSERT/UPDATE/DELETE 계열은 `[]` (Principle 8.2 — 1차 네이밍) |
| `output.rowCount` | number | handler return | 영향받은 행 수 (PostgreSQL `rowCount` / MySQL `affectedRows`). SELECT 0건도 `0` |
| `output.fields` | Array<{name, dataTypeID}>? | handler return | 컬럼 메타 (PostgreSQL `pg.FieldDef` / MySQL `columnType`). MySQL INSERT 계열은 `[]`. MySQL SELECT 인데 드라이버가 `fields` 를 배열로 주지 않으면 `undefined` (필드 생략 — Principle 11) |
| `output.insertId` | number? | handler return | **MySQL INSERT 전용** — auto-increment id. PostgreSQL / 그 외 query type 에서는 미포함 |
| `meta.durationMs` | number | handler return | 쿼리 실행 시간 (ms) |
| `port` | `'success'` | handler return | 정상 분기 |

> `rowCount` 는 형식상 메트릭이지만, 워크플로우 분기(`if rowCount > 0`)의 비즈니스 판단 재료로 사용되어 **`output` 에 유지**한다 (CONVENTIONS Principle 1 의 실용적 해석, Principle 8.2 표 명시). `meta` 에 복제하지 않는다 — 같은 값이 두 곳에 있으면 일관성을 해친다.
>
> `config.parameters` 는 `JSON.parse` 가 적용되기 전 형태(배열 또는 문자열) 그대로 echo 된다. 평가된 배열이 필요하면 후속 노드에서 다시 파싱하거나 expression 결과를 직접 참조.

**Expression 접근 예**:
- `$node["X"].output.rows[0].name` → `"Alice"`
- `$node["X"].output.rowCount` → `1`
- `$node["X"].output.insertId` → `99` (MySQL INSERT)
- `$node["X"].meta.durationMs` → `12`
- `$node["X"].port` → `"success"`

### 5.3 Case: 런타임 에러 (port `error`)

런타임 쿼리 실패는 표준 envelope `output.error.{code, message, details?}` (CONVENTIONS Principle 3.2) 로 노출되며, `error` 포트로 라우팅된다. `rows` / `rowCount` / `fields` / `insertId` 는 **존재하지 않는다** (undefined 필드 생략 — Principle 11). expression 자동완성에서도 회색 처리되어야 한다.

#### 5.3.1 구문 오류

```json
{
  "config": {
    "integrationId": "int_pg_1",
    "query": "SELEC 1",
    "queryType": "select",
    "parameters": []
  },
  "output": {
    "error": {
      "code": "DB_QUERY_FAILED",
      "message": "syntax error at or near \"SELEC\"",
      "details": { "driverCode": "42601" }
    }
  },
  "meta": { "durationMs": 5 },
  "port": "error"
}
```

#### 5.3.2 커넥션 drop / 타임아웃

```json
{
  "config": {
    "integrationId": "int_pg_1",
    "query": "SELECT 1",
    "queryType": "select",
    "parameters": []
  },
  "output": {
    "error": {
      "code": "DB_CONNECTION_ERROR",
      "message": "Connection terminated unexpectedly",
      "details": { "driverCode": "ECONNRESET" }
    }
  },
  "meta": { "durationMs": 42 },
  "port": "error"
}
```

#### 5.3.3 제약 위반 (unique / FK / NOT NULL)

```json
{
  "config": {
    "integrationId": "int_pg_1",
    "query": "INSERT INTO users(id) VALUES ($1)",
    "queryType": "insert",
    "parameters": ["u_1"]
  },
  "output": {
    "error": {
      "code": "DB_CONSTRAINT_VIOLATION",
      "message": "duplicate key value violates unique constraint \"users_pkey\"",
      "details": { "driverCode": "23505" }
    }
  },
  "meta": { "durationMs": 9 },
  "port": "error"
}
```

#### 5.3.4 권한 부족

```json
{
  "config": {
    "integrationId": "int_pg_1",
    "query": "SELECT * FROM secret_table",
    "queryType": "select",
    "parameters": []
  },
  "output": {
    "error": {
      "code": "DB_PERMISSION_DENIED",
      "message": "permission denied for table secret_table",
      "details": { "driverCode": "42501" }
    }
  },
  "meta": { "durationMs": 6 },
  "port": "error"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | (§5.1과 동일) | config echo | 자격증명 echo 금지 — `integrationId` 만 |
| `output.error.code` | enum | handler return | `DB_QUERY_FAILED` / `DB_CONNECTION_ERROR` / `DB_CONSTRAINT_VIOLATION` / `DB_PERMISSION_DENIED` 중 하나, 또는 [공통 §4.2](./0-common.md#42-공통-에러-코드) 의 `IntegrationError` 코드 (e.g. `INTEGRATION_NOT_CONNECTED`). UPPER_SNAKE_CASE |
| `output.error.message` | string | handler return | 드라이버 원문 메시지. `sanitizeMessage` 로 password/secret 토큰 마스킹 적용 후 노출 |
| `output.error.details` | object? | handler return | 선택적 — 드라이버 native code 등 (e.g. `{ driverCode: "23505" }` for PostgreSQL SQLSTATE, `{ driverCode: "ER_DUP_ENTRY" }` for MySQL). 매핑 가능한 경우 항상 포함 |
| `meta.durationMs` | number | handler return | 실패까지 경과 시간 (ms) |
| `port` | `'error'` | handler return | 런타임 실패 분기 |

**Expression 접근 예**:
- `$node["X"].output.error.code === "DB_QUERY_FAILED"` → 일반 쿼리 실패 분기
- `$node["X"].output.error.code === "DB_CONNECTION_ERROR"` → 커넥션 drop / 타임아웃 분기 (재시도 후보)
- `$node["X"].output.error.code === "DB_CONSTRAINT_VIOLATION"` → 제약 위반 분기 (영구 오류)
- `$node["X"].output.error.code === "DB_PERMISSION_DENIED"` → 권한 부족 분기 (영구 오류)
- `$node["X"].output.error.code === "INTEGRATION_NOT_CONNECTED"` → Integration 상태 분기 (공통 §4.2)
- `$node["X"].output.error.details.driverCode` → 드라이버 원본 code (e.g. `"23505"`, `"ER_DUP_ENTRY"`)
- `$node["X"].output.rows` → **undefined** (error 포트에서는 존재하지 않음)
- `$node["X"].port` → `"error"`

### 5.8 (D4) handler.validate 실패만 throw, 나머지 모두 §5.3 으로 라우팅

handler.validate 실패와 execute 안의 실패는 다음 두 경로로 분리된다:

- **`handler.validate()` 실패** (config 형식 자체가 잘못된 경우): 여전히 사전 검증 단계에서 노드 실행 자체가 시작되지 않는다. warningRule + `evaluateMetadataBlockingErrors` 가 throw 하며 엔진이 워크플로우를 실패 처리. 예: `integrationId is required`, `query is required and must be a string`, `queryType must be one of: ...`, `parameters must be an array or a JSON array string`.
- **`execute()` 안의 모든 IntegrationError / 파라미터 파싱 실패**: §5.3 (`port: 'error'` + `output.error.*`) 으로 라우팅된다. 다음 코드들이 해당:
  - `INTEGRATION_SERVICE_UNAVAILABLE` — IntegrationsService 미주입
  - `INTEGRATION_NOT_FOUND` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` ([공통 §4.2](./0-common.md#42-공통-에러-코드))
  - `INVALID_PARAMETERS` — 파라미터 JSON parse 실패

> 모든 `IntegrationError.code` 가 `output.error.code` 로 surface 된다 (throw 되어 노드 실패로 이어지지 않는다). Usage 로그 (`status: 'failed'` + `error: {code, message}`) 는 양쪽 모두에서 동일하게 기록.

## 6. 에러 코드

### 6.1 Pre-handler (`handler.validate()` throw → 노드 실행 자체가 시작되지 않음)

config 형식 자체가 잘못된 경우 (e.g. `integrationId is required` / `query is required and must be a string` / `queryType` enum 가드 / `parameters` sum-type 가드) — warningRule + `evaluateMetadataBlockingErrors`. 엔진이 워크플로우를 실패 처리.

### 6.2 Runtime (`port: 'error'` + `output.error`)

| 코드 | 조건 | 드라이버 힌트 (`details.driverCode`) |
|------|------|---------------|
| `DB_QUERY_FAILED` (기본) | SQL 구문 오류, 잘못된 컬럼/테이블, 타입 불일치 등 일반 실행 실패. 매핑 안 되는 모든 케이스의 fallback | pg `42xxx` (제약/권한 제외), mysql `ER_PARSE_ERROR` 등 |
| `DB_CONNECTION_ERROR` | 실행 중 커넥션 drop / 타임아웃 / handshake 단계 인증 거부 / 자원 부족 / 운영자 개입 | Node errno: `ECONNRESET`, `ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`. pg SQLSTATE class `08xxx` (connection_exception), `28xxx` (invalid_authorization_specification — handshake-time auth fail), `53xxx` (insufficient_resources, e.g. too_many_connections), `57xxx` (operator_intervention, admin_shutdown). mysql `PROTOCOL_CONNECTION_LOST` / `ER_ACCESS_DENIED_ERROR` (handshake-time 인증 실패) / `ER_TOO_MANY_USER_CONNECTIONS` |
| `DB_CONSTRAINT_VIOLATION` | unique / foreign key / not null / check / exclusion 제약 위반 | pg `23xxx` (`23505` unique, `23503` FK, `23502` not null, `23514` check, `23P01` exclusion), mysql `ER_DUP_ENTRY` / `ER_NO_REFERENCED_ROW*` / `ER_ROW_IS_REFERENCED*` / `ER_BAD_NULL_ERROR` / `ER_CHECK_CONSTRAINT_VIOLATED` |
| `DB_PERMISSION_DENIED` | 인증된 세션의 객체 권한 부족 (실행 중 발견) | pg `42501` (insufficient_privilege), mysql `ER_TABLEACCESS_DENIED_ERROR` / `ER_COLUMNACCESS_DENIED_ERROR` / `ER_DBACCESS_DENIED_ERROR` / `ER_SPECIFIC_ACCESS_DENIED_ERROR` |
| `INTEGRATION_*` ([공통 §4.2](./0-common.md#42-공통-에러-코드)) | D4 — Integration resolve / 자격증명 누락 실패. `INTEGRATION_NOT_FOUND` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` 모두 본 경로로 surface | — |
| `INTEGRATION_SERVICE_UNAVAILABLE` | D4 — IntegrationsService 가 핸들러에 주입되지 않음 (deployment 누락). 본 경로로 surface | — |
| `INVALID_PARAMETERS` | D4 — `config.parameters` JSON parse 실패 / 배열 아닌 형태. 본 경로로 surface | — |

> 드라이버 간 일관성 메모: pg SQLSTATE class `28` (invalid_authorization_specification) 과 mysql `ER_ACCESS_DENIED_ERROR` 는 둘 다 **handshake 단계 인증 실패** 다. 두 드라이버 모두 `DB_CONNECTION_ERROR` 로 라우팅되어 워크플로우의 credential-rotation retry 정책이 양쪽에서 동일하게 동작한다. 실행 중 권한 거부(`DB_PERMISSION_DENIED`) 는 인증된 세션에서 객체 접근에 실패한 별도의 영구 오류로 분리된다.

> `output.error.message` 는 `sanitizeMessage` 로 password/Bearer/긴 토큰 패턴이 마스킹된다. Usage 로그에는 `toLogError(err)` 가 동일하게 sanitize 된 `code` / `message` 를 기록한다.
>
> `output.error.details.driverCode` 는 드라이버가 식별 가능한 native code 를 제공할 때 항상 채워진다 (PostgreSQL `DatabaseError.code` SQLSTATE 또는 MySQL `QueryError.code`). 드라이버가 code 를 제공하지 않으면(`Error` 인스턴스만) `details` 자체가 생략된다 (CONVENTIONS Principle 11 — undefined 필드 생략).
>
> 구현 메모: 런타임 출력 zod 스키마 (`databaseQueryNodeOutputSchema.output.error`) 는 `code` / `message` 만 명시 선언하고 `.passthrough()` 로 두므로 `details` 는 런타임에 그대로 통과하지만 스키마 타입에는 surface 되지 않는다. expression 자동완성에서 `details.driverCode` 를 노출하려면 스키마에 명시 선언이 필요하다 (향후 보강 후보).

## 7. 캔버스 요약

[공통 §5](./0-common.md#5-캔버스-요약) — `Database Query` 행 인용. 형식: `{queryType} · {쿼리 첫 줄}` (35자 초과 시 잘림). Integration 이 삭제된 경우 `⚠ Missing integration` (앰버색) 표시.

예시:
- `SELECT · SELECT id, name FROM users WH...`
- `INSERT · INSERT INTO logs (msg) VALUES...`
