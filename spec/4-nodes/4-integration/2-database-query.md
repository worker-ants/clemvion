# Spec: Database Query

> 관련 문서: [Integration 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진 §10](../../5-system/4-execution-engine.md#10-integration-handler-계약) · [CONVENTIONS](../../../user_memo/node-specs-improvement/CONVENTIONS.md)

SQL 쿼리를 실행하여 외부 데이터베이스에서 데이터를 조회하거나 조작한다. PostgreSQL / MySQL 드라이버를 모두 지원하며, 실행 결과는 `success` 포트, 런타임 실패(구문 오류, 커넥션 drop, 제약 위반 등)는 `error` 포트로 분기된다.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| integrationId | UUID | ✓ | — | DB Integration 참조 ([공통 §1](./0-common.md#1-integration-참조)) |
| query | String (표현식) | ✓ | — | SQL 쿼리. `{{ }}` 템플릿 허용. PostgreSQL 스타일 `$1`, `$2`, ... 플레이스홀더 사용 |
| parameters | Array \| String | | `[]` | `$1`, `$2`, ... 위치 기반 바인딩 값. JSON 배열 문자열도 허용 (예: `'["v1", 2]'`) |
| queryType | Enum | ✓ | `select` | `select` / `insert` / `update` / `delete` / `raw` — 감사·UI 힌트 (실행 분기에 영향 없음) |

> Source of truth: `backend/src/nodes/integration/database-query/database-query.schema.ts` (export `databaseQueryNodeConfigSchema`)
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

> Database Query 는 동적 포트가 없다. Pre-flight 검증 실패(자격증명 누락·`INVALID_PARAMETERS`)는 throw — error 포트로 흐르지 않는다 (§5.8).

## 4. 실행 로직

[Integration 공통 §4 Handler 실행 세멘틱](./0-common.md#4-handler-실행-세멘틱) 의 6단계 계약을 따른다. 노드 고유 동작:

1. **드라이버 분기**: `Integration.credentials.driver` 가 `'mysql'` 이면 `mysql2/promise` 풀, 그 외(기본 `'postgres'`) 는 `pg` 풀 사용.
2. **풀 캐시**: integrationId + credential SHA-256 해시를 키로 풀을 재사용한다 (`POOL_MAX_CONNECTIONS=5`, `POOL_IDLE_TIMEOUT_MS=30000`). credential 회전 시 stale 풀을 evict 후 새 풀 생성.
3. **PostgreSQL 플레이스홀더 변환** (MySQL 전용): `$1, $2, ...` → `?` 로 변환 (정규식 `\$\d+`). 파라미터는 여전히 배열 순서대로 위치 바인딩.
4. **파라미터 정규화** (`config.parameters`):
   - `Array` → 그대로 사용
   - `string` → `JSON.parse` 시도, 결과가 배열이면 사용
   - `undefined` / `null` / `''` → `[]`
   - 그 외 / JSON parse 실패 → `INVALID_PARAMETERS` throw (§5.8)
5. **PostgreSQL 실행**: `pool.connect()` → `client.query(sql, params)` → `client.release()`.
6. **MySQL 실행**: `pool.query(sql, params)` — 결과가 배열이면 SELECT 계열 (`rows` / `fields`), `ResultSetHeader` 면 INSERT/UPDATE/DELETE 계열 (`rowCount = affectedRows`, `insertId`).
7. **SSL 매핑**:

   | `credentials.ssl` | pg 옵션 | mysql2 옵션 |
   |-------------------|---------|-------------|
   | `disable` | `ssl: false` | `ssl: undefined` |
   | `require` | `ssl: { rejectUnauthorized: true }` | `ssl: { rejectUnauthorized: true }` |
   | `verify-full` | `ssl: { rejectUnauthorized: true }` | `ssl: { rejectUnauthorized: true }` |

   > `require` 도 인증서 검증을 강제한다 (MITM 방어). self-signed 인증서를 쓰려면 별도 `require-trust` 모드 도입이 필요하다.

8. **Usage 로깅**: 성공·실패 모두 `IntegrationsService.logUsage({ integrationId, status, durationMs, error? })` 호출 ([공통 §4.1](./0-common.md#41-공통-계약) 단계 6).
9. **포트 라우팅**: 정상 종료 → `port: 'success'` / 쿼리 실행 중 throw → `port: 'error'` (§5.3). Pre-flight throw 는 §5.8.

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> Database Query 는 §5.1 (정상 — SELECT/0건/INSERT) / §5.3 (런타임 에러) / §5.8 (Pre-flight throw) 케이스로 구성된다. Status 는 미사용 (`undefined` — 비-블로킹 노드).

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
| `output.fields` | Array<{name, dataTypeID}>? | handler return | 컬럼 메타 (PostgreSQL `pg.FieldDef` / MySQL `columnType`). MySQL INSERT 계열은 `[]` |
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
      "message": "syntax error at or near \"SELEC\""
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
      "message": "Connection terminated unexpectedly"
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
      "message": "duplicate key value violates unique constraint \"users_pkey\""
    }
  },
  "meta": { "durationMs": 9 },
  "port": "error"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | (§5.1과 동일) | config echo | 자격증명 echo 금지 — `integrationId` 만 |
| `output.error.code` | enum | handler return | `DB_QUERY_FAILED` (기본) 또는 [공통 §4.2](./0-common.md#42-공통-에러-코드) 의 `IntegrationError` 코드 (e.g. `INTEGRATION_NOT_CONNECTED`). UPPER_SNAKE_CASE |
| `output.error.message` | string | handler return | 드라이버 원문 메시지. `sanitizeMessage` 로 password/secret 토큰 마스킹 적용 후 노출 |
| `output.error.details` | object? | handler return | 선택적 — 드라이버 native code 등 (e.g. `{ driverCode: "23505" }`). 현재 핸들러는 `details` 미포함, 향후 enum 세분화 시 추가 예정 |
| `meta.durationMs` | number | handler return | 실패까지 경과 시간 (ms) |
| `port` | `'error'` | handler return | 런타임 실패 분기 |

> ⚠ **현재 핸들러 동작**: `database-query.handler.ts` 는 `IntegrationError` throw 가 아닌 일반 throw 에 대해 `output.error.code = 'DB_QUERY_FAILED'` 로 매핑한다. 구문 오류 / 커넥션 drop / 제약 위반의 enum 세분화 (`DB_CONNECTION_ERROR` / `DB_CONSTRAINT_VIOLATION` / `DB_PERMISSION_DENIED`) 와 `details.driverCode` 추가는 [user_memo 개선안 integration/database_query.md §3](../../../user_memo/node-specs-improvement/integration/database_query.md#3-제안된-output-구조) 의 P0 제안 — 본 spec 의 §5.3.2 / §5.3.3 enum 은 해당 개선이 반영된 후 활성화된다. 그 전까지는 `DB_QUERY_FAILED` 단일 코드 + `message` 문자열로 분기를 구분해야 한다.
>
> ⚠ **에러 alias (마이그레이션 단계)**: 옛 코드 `'QUERY_FAILED'` 는 한 릴리즈 동안 alias 로 공존하다 제거된다. 신규 워크플로우는 `'DB_QUERY_FAILED'` 만 사용한다.

**Expression 접근 예**:
- `$node["X"].output.error.code === "DB_QUERY_FAILED"` → 일반 쿼리 실패 분기
- `$node["X"].output.error.code === "INTEGRATION_NOT_CONNECTED"` → Integration 상태 분기 (공통 §4.2)
- `$node["X"].output.rows` → **undefined** (error 포트에서는 존재하지 않음)
- `$node["X"].port` → `"error"`

### 5.8 Pre-flight throw (워크플로우 실패)

다음 조건에서는 핸들러가 throw 하여 노드 실행이 **실패 처리** 되며, `error` 포트로 분기되지 않는다 (CONVENTIONS Principle 3.1). 엔진이 워크플로우 전체를 실패로 마킹한다.

| 시점 | 코드 | 메시지 / 조건 |
|------|------|---------------|
| handler.validate (Pre-handler) | — | `integrationId is required` (warningRule + `evaluateMetadataBlockingErrors`) |
| handler.validate | — | `query is required` (warningRule) |
| handler.validate | — | `query is required and must be a string` (type 가드) |
| handler.validate | — | `queryType must be one of: select, insert, update, delete, raw` (enum 가드) |
| handler.validate | — | `parameters must be an array or a JSON array string` (sum-type 가드) |
| execute() — IntegrationsService 미주입 | `INTEGRATION_SERVICE_UNAVAILABLE` | `Database node requires an integrations service to be configured` |
| execute() — 공통 §4.2 | `INTEGRATION_NOT_FOUND` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` | [공통 §4.2](./0-common.md#42-공통-에러-코드) 참조. credential 누락 시: `Database integration is missing fields: <list>` |
| execute() — 파라미터 파싱 | `INVALID_PARAMETERS` | `parameters must be a JSON array (e.g. \`["v1", 2]\`)` 또는 `parameters must be an array or a JSON array string` |

> `IntegrationError` 가 throw 되는 모든 경우는 Pre-flight 로 처리되어 error 포트가 아니라 노드 실패로 끝난다. 단 핸들러 try/catch 안의 throw (드라이버가 던지는 SQL 오류 등) 는 §5.3 으로 라우팅된다 — `IntegrationError` 인지 여부는 `instanceof` 로 분기한다.

## 6. 에러 코드

### 6.1 Pre-flight (throw → 노드 실패, error 포트 미사용)

§5.8 표 참조. [공통 §4.2](./0-common.md#42-공통-에러-코드) 의 `INTEGRATION_*` 코드 + `INVALID_PARAMETERS` + `INTEGRATION_SERVICE_UNAVAILABLE`.

### 6.2 Runtime (`port: 'error'` + `output.error`)

| 코드 | 조건 | 드라이버 힌트 |
|------|------|---------------|
| `DB_QUERY_FAILED` | SQL 구문 오류, 잘못된 컬럼/테이블, 타입 불일치 등 일반 실행 실패 | pg `42xxx`, mysql `ER_PARSE_ERROR` |
| `DB_CONNECTION_ERROR` | 실행 중 커넥션 drop / 타임아웃 (개선안 P0 — 핸들러 반영 후 활성) | `ECONNRESET`, `ETIMEDOUT`, mysql `PROTOCOL_CONNECTION_LOST` |
| `DB_CONSTRAINT_VIOLATION` | unique / foreign key / not null / check 제약 위반 (개선안 P0) | pg `23xxx`, mysql `ER_DUP_ENTRY` |
| `DB_PERMISSION_DENIED` | 권한 부족 (개선안 P0) | pg `42501`, mysql `ER_TABLEACCESS_DENIED_ERROR` |

> `output.error.message` 는 `sanitizeMessage` 로 password/Bearer/긴 토큰 패턴이 마스킹된다. Usage 로그에는 `toLogError(err)` 가 동일하게 sanitize 된 `code` / `message` 를 기록한다.

## 7. 캔버스 요약

[공통 §5](./0-common.md#5-캔버스-요약) — `Database Query` 행 인용. 형식: `{queryType} · {쿼리 첫 줄}` (35자 초과 시 잘림). Integration 이 삭제된 경우 `⚠ Missing integration` (앰버색) 표시.

예시:
- `SELECT · SELECT id, name FROM users WH...`
- `INSERT · INSERT INTO logs (msg) VALUES...`
