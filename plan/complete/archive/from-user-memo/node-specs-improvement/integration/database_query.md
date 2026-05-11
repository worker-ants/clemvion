# Database Query (`database_query`) — Output 일관성 개선안

- **카테고리**: integration
- **현 문서**: [../../node-specs/integration/database_query.md](../../node-specs/integration/database_query.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)

## 1. 현재 Output 구조 요약

SQL 쿼리를 실행하고 결과를 `success` 포트로, 실행 시점의 쿼리 실패(구문 오류, 제약 위반 등)는 `error` 포트로 분기합니다. integration 조회/타입/자격증명 누락 및 `INVALID_PARAMETERS` 는 **throw → 노드 실패** 로 처리되어 error 포트로 가지 않습니다 (Principle 3.1 pre-flight).

### 현재 Case 1: SELECT 성공 (PostgreSQL)

```json
{
  "config": {
    "integrationId": "int_pg_1",
    "query": "SELECT id, name FROM users WHERE id = $1",
    "queryType": "select",
    "parameters": ["u_1"]
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

### 현재 Case 2: INSERT (MySQL `ResultSetHeader`)

```json
{
  "config": {
    "integrationId": "int_mysql_1",
    "query": "INSERT INTO t (a) VALUES (?)",
    "queryType": "insert",
    "parameters": [1]
  },
  "output": {
    "rows": [],
    "rowCount": 2,
    "insertId": 99,
    "fields": []
  },
  "meta": { "durationMs": 8 },
  "port": "success"
}
```

### 현재 Case 3: 쿼리 실행 에러

```json
{
  "config": { "integrationId": "int_pg_1", "query": "SELEC 1", "queryType": "select", "parameters": [] },
  "output": {
    "error": {
      "code": "QUERY_FAILED",
      "message": "syntax error at or near \"SELEC\""
    }
  },
  "meta": { "durationMs": 5 },
  "port": "error"
}
```

특징 요약:

- `output.error` 는 **이미 `{ code, message }` 형태** 로 CONVENTIONS P3.2 에 부합.
- `rows` / `rowCount` / `fields` / `insertId?` 는 SELECT/INSERT 계열 모두에 일관되게 존재 (INSERT 에서 `rows: []`, SELECT 에서 `insertId` 없음).
- `meta.durationMs` 이름 이미 정렬됨.
- `config` 에 credential (host/user/password) 은 echo 되지 않고 `integrationId` 만 echo — Principle 7 준수.

> 전체적으로 통일성이 가장 높은 노드 중 하나. 미세 조정만 필요합니다.

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | `output.error.code = 'QUERY_FAILED'` 단일 기본값 | Principle 3.2 (세분화) | 표준 enum 이 없어 워크플로우 작성자가 "연결 실패 vs 구문 오류 vs 제약 위반" 을 `message` 문자열로 substring 매칭해야 함. `DB_QUERY_FAILED`, `DB_CONNECTION_ERROR`, `DB_CONSTRAINT_VIOLATION` 등 세분화 필요 |
| 2 | `rowCount` 의 위치 논쟁 | Principle 1 vs Principle 2 | `rowCount` 는 "실행 메트릭(=얼마나 영향받았나)"이자 "비즈니스 판단 재료(=`if rowCount > 0`)" 양쪽 성격을 가짐. 현재 `output.rowCount` 는 P1 형식상 위반이지만, 소비 패턴이 비즈니스 로직 쪽이므로 **유지하는 예외가 타당**. 문서에 명문화 부재 |
| 3 | `insertId` 가 MySQL-only | Principle 11 (문서 규칙) | PostgreSQL 에서는 존재하지 않음. 선택적 필드임을 표에서 `?` 로 명시 필요 |
| 4 | 에러 경로에 `rows` / `rowCount` / `fields` 가 부재 | Principle 11 (undefined 필드 생략) | 현재 동작은 정상 (JSON 예시에서 생략) 이지만, 표현식 자동완성에서 "error 포트일 땐 `rows` 가 없음" 을 사용자가 인지하기 어려움. 문서 강화 필요 |
| 5 | `queryType` 이 핸들러 분기에 미사용 | Principle 7 (echo 정책) | echo 는 유지 (감사/UI) 하되, 문서에 "실행 분기와 무관" 을 재확인 |

## 3. 제안된 Output 구조

### Before (쿼리 에러 예시)

```json
{
  "output": { "error": { "code": "QUERY_FAILED", "message": "..." } },
  "meta": { "durationMs": 5 },
  "port": "error"
}
```

### After — Case 1: SELECT 성공 (변경 없음)

```json
{
  "config": {
    "integrationId": "int_pg_1",
    "query": "SELECT id, name FROM users WHERE id = $1",
    "queryType": "select",
    "parameters": ["u_1"]
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

### After — Case 2: 결과가 0건

```json
{
  "config": { "integrationId": "int_pg_1", "query": "...", "queryType": "select", "parameters": [] },
  "output": {
    "rows": [],
    "rowCount": 0,
    "fields": [{ "name": "id", "dataTypeID": 25 }]
  },
  "meta": { "durationMs": 4 },
  "port": "success"
}
```

> 0건은 **에러가 아님** (Principle 3.1 "예상 가능한 비즈니스 실패"). 정상 `success` 포트로 흐르며 `rowCount: 0`.

### After — Case 3: INSERT (MySQL, 변경 없음)

```json
{
  "config": {
    "integrationId": "int_mysql_1",
    "query": "INSERT INTO t (a) VALUES (?)",
    "queryType": "insert",
    "parameters": [1]
  },
  "output": {
    "rows": [],
    "rowCount": 2,
    "insertId": 99,
    "fields": []
  },
  "meta": { "durationMs": 8 },
  "port": "success"
}
```

### After — Case 4: 구문 오류

```json
{
  "config": { "integrationId": "int_pg_1", "query": "SELEC 1", "queryType": "select", "parameters": [] },
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

### After — Case 5: 연결 실패 (쿼리 실행 중 커넥션 drop)

```json
{
  "config": { "integrationId": "int_pg_1", "query": "SELECT 1", "queryType": "select", "parameters": [] },
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

### After — Case 6: 제약 위반

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
      "details": { "driverCode": "23505", "constraint": "users_pkey" }
    }
  },
  "meta": { "durationMs": 9 },
  "port": "error"
}
```

### `output.error.code` enum (신규)

| 코드 | 조건 | 드라이버 힌트 |
| --- | --- | --- |
| `DB_QUERY_FAILED` | SQL 구문 오류, 잘못된 컬럼/테이블, 타입 불일치 등 일반 실행 실패 | pg `42xxx`, mysql `ER_PARSE_ERROR` 등 |
| `DB_CONNECTION_ERROR` | 실행 중 커넥션 drop/타임아웃 | `ECONNRESET`, `ETIMEDOUT`, mysql `PROTOCOL_CONNECTION_LOST` |
| `DB_CONSTRAINT_VIOLATION` | unique / foreign key / not null / check 위반 | pg `23xxx`, mysql `ER_DUP_ENTRY`, `ER_NO_REFERENCED_ROW` |
| `DB_PERMISSION_DENIED` | 권한 부족 | pg `42501`, mysql `ER_TABLEACCESS_DENIED_ERROR` |
| `DB_QUERY_FAILED` (fallback) | 위에 매칭되지 않는 모든 쿼리 실행 실패 | — |

- `details.driverCode` 는 **선택적** 필드. 드라이버가 에러 코드를 제공하지 않으면 생략.
- `IntegrationError` 가 throw 되는 pre-flight 경로(`INTEGRATION_TYPE_MISMATCH` 등)는 여전히 노드 실패로 남고, error 포트로 오지 않음.

### `rowCount` 위치 결정 (기록용)

- **결정**: `output.rowCount` 로 **유지** (이동/복제 없음).
- **근거**: 대다수 워크플로우 분기가 `if $node["X"].output.rowCount > 0` 형태로 **비즈니스 조건** 에 사용. 이는 Principle 1 의 "도메인 데이터" 정의에 더 가까움. `http_request.meta.statusCode` 와는 성격이 다름 (statusCode 는 HTTP 프로토콜 메트릭, rowCount 는 "몇 개를 처리했나" 라는 결과값).
- `meta.rowCount` 를 복제 echo 하는 안 은 **채택하지 않음** — 같은 값이 두 곳에 있으면 정답이 둘이 되어 오히려 일관성을 해침.
- 본 예외는 CONVENTIONS P1 이 명시적으로 "비즈니스 판단 재료" 를 허용하는 범위 내로 해석하고, CONVENTIONS 표 P8.2 에서 이미 `output.rows / output.rowCount / output.fields / output.insertId?` 로 유지 대상에 등재되어 있음.

## 4. 마이그레이션 영향도

| Expression 경로 (Before) | Expression 경로 (After) | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["X"].output.rows` | `$node["X"].output.rows` | No | 성공 경로 유지 |
| `$node["X"].output.rows[0].name` | `$node["X"].output.rows[0].name` | No | 동일 |
| `$node["X"].output.rowCount` | `$node["X"].output.rowCount` | No | 유지 결정 |
| `$node["X"].output.insertId` | `$node["X"].output.insertId` | No | MySQL INSERT 전용 (optional) |
| `$node["X"].output.fields` | `$node["X"].output.fields` | No | 동일 |
| `$node["X"].output.error.code === 'QUERY_FAILED'` | `$node["X"].output.error.code === 'DB_QUERY_FAILED'` | **Yes** | code 값 재정의. 기존 `'QUERY_FAILED'` 는 한 릴리즈 동안 alias 로 공존 가능 |
| (없음) | `$node["X"].output.error.code === 'DB_CONNECTION_ERROR'` | No (신규) | 신규 enum — 더 세분화된 분기 가능 |
| (없음) | `$node["X"].output.error.code === 'DB_CONSTRAINT_VIOLATION'` | No (신규) | 신규 enum |
| (없음) | `$node["X"].output.error.code === 'DB_PERMISSION_DENIED'` | No (신규) | 신규 enum |
| `$node["X"].output.error.message` | `$node["X"].output.error.message` | No | 동일. 드라이버 원문 유지 |
| (없음) | `$node["X"].output.error.details.driverCode` | No (신규) | 드라이버가 제공하는 native code |
| `$node["X"].meta.durationMs` | `$node["X"].meta.durationMs` | No | 이름 정렬되어 있음 |
| `$node["X"].port` | `$node["X"].port` | No | `'success'` \| `'error'` 유지 |
| `$node["X"].config.query` | `$node["X"].config.query` | No | `$N → ?` 변환 전 원문 유지 |
| `$node["X"].config.parameters` | `$node["X"].config.parameters` | No | 파싱된 배열 유지 |
| `$node["X"].config.queryType` | `$node["X"].config.queryType` | No | 유지 (감사/UI) |
| `$node["X"].config.integrationId` | `$node["X"].config.integrationId` | No | 유지 |

**권장 전략**:

1. P0: error code enum 을 세분화 (`DB_QUERY_FAILED` / `DB_CONNECTION_ERROR` / `DB_CONSTRAINT_VIOLATION` / `DB_PERMISSION_DENIED`). `'QUERY_FAILED'` → `'DB_QUERY_FAILED'` 네이밍 변경은 한 릴리즈 동안 기존 값도 허용하는 alias 로 진행.
2. P0 (additive): `output.error.details.driverCode` 필드 추가 — 기존 소비자 영향 없음.
3. P1: 문서에 "`rowCount` 는 Principle 1 의 비즈니스 판단 재료 허용 범위로 `output` 에 유지하며, `meta` 에 복제하지 않음" 을 명시.
4. P1: error 포트 경로에서는 `rows` / `rowCount` / `fields` / `insertId` 가 **존재하지 않음** 을 문서의 "변수로 접근 가능한 항목" 표에 경고 문구로 추가 — expression 자동완성이 error 분기에서 이 키들을 회색 처리할 근거.

## 5. 근거

- **Principle 3.2 (에러 enum)**: 현재 단일 `'QUERY_FAILED'` 로는 "재시도 가치가 있는 일시적 실패(connection drop)"와 "재시도해도 실패하는 영구 오류(syntax error, permission denied)"를 구분할 수 없습니다. 세분화된 code 는 retry policy, alerting, 사용자 메시지 분기를 가능하게 합니다.
- **Principle 1 의 실용적 해석 (`rowCount`)**: `rowCount` 는 형식상 메트릭이지만 **소비 패턴이 비즈니스 분기**입니다. `if_else` 노드에서 `$node["X"].output.rowCount > 0` 같은 분기는 현장에서 매우 흔합니다. 이를 `meta` 로 옮기면 사용자는 "왜 여긴 meta 고 다른 노드 결과는 output 인가" 를 매번 확인해야 합니다. 유지가 더 직관적.
- **Principle 8.2 표의 명시적 유지 대상**: DB 결과 키들(`rows`, `rowCount`, `fields`, `insertId?`)은 이미 CONVENTIONS 에서 명시적으로 "그대로 유지" 대상으로 등재. 본 개선안은 그 결정을 재확인.
- **Principle 7 (Config echo)**: `integrationId` 만 echo 하고 host/user/password 를 제거하는 현재 동작은 모범 사례. 변경 없음.
- **Principle 11 (문서화)**: 성공/에러 Case 별로 JSON 예시를 분리하고, error 포트에서 존재하지 않는 필드를 명시적으로 문서화하는 것이 자동완성 UX 와 직결됩니다.
- **INCONSISTENCY_MATRIX 축 3**: `database_query` 행은 "이미 규약 준수, 유지" 로 표기되어 있으며 본 개선안은 그 범위 내에서 code 세분화만 추가.
- **`http_request` 와의 대칭**: 본 개선안 적용 후 세 integration 노드(`http_request`, `database_query`, `send_email`)가 모두 `output.error.{code, message, details?}` 한 shape 으로 수렴 — 에러 처리 서브그래프 재사용성 확보.
