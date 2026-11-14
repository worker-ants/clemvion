---
id: "CLE-NODE-DBQUERY-OUTPUT"
title: "Database Query 노드 — 출력 구조와 에러 코드"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-DBQUERY"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT", "CLE-NODE-DBQUERY"]
area: "CLE-NODE-INT"
content_hash: "ae87c0e0d74f16bbf40cd05608a65fc5da9331992e87cfb95d2a02c83c33221c"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "8bec0b976b1960209d0d6d795b4df97540151ec6aa3578ff36ba1b6adc716278"
etag: "sha256-4750a3e993fb125a6f5f1ec609fe5a94b9ed5a1cdd9b2eeb995f0c0d3bf34a00"
---
## 개요

이 문서는 [Database Query 노드](CLE-NODE-DBQUERY.md) 의 하위 문서로 노드 출력 구조(정상 · 런타임 에러)와 에러 코드 분류를 정한다. 설정 · 실행 로직 · 사설망 차단 판정 시점은 부모 문서가 정한다.

## 출력 구조

노드 출력은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 11 형식을 따른다. JSON 예시는 `undefined` 필드를 생략하고, 다섯 필드 밖의 최상위 키는 두지 않는다. 케이스는 정상(SELECT·0건·INSERT)과 에러(D4 이후 단일 경로) 둘이다. `status` 는 쓰지 않는다(비블로킹).

### 정상 실행 (`success`)

SELECT, 결과 1건 이상(PostgreSQL):

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

SELECT, 결과 0건. 0건은 에러가 아니다(노드 출력 규약 Principle 3.1 "예상 가능한 비즈니스 실패"). `success` 포트로 흐르며 `rowCount: 0` 이다. 뒤쪽 노드에서 `$node["X"].output.rowCount > 0` 으로 분기한다.

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

INSERT(MySQL `ResultSetHeader`):

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
| `config.integrationId` | UUID | 설정 에코 | DB 통합 참조. 자격 증명은 에코하지 않고 id 만 |
| `config.query` | string | 설정 에코 | 사용자가 입력한 원본 SQL. `{{ }}`·`$N` 보존 |
| `config.queryType` | enum | 설정 에코 | `'select'` / `'insert'` / `'update'` / `'delete'` / `'raw'` (기본 `'select'`) |
| `config.parameters` | Array \| string | 설정 에코 | 원본 파라미터. `JSON.parse` 전 형태(배열 또는 문자열) 그대로다. 평가된 배열이 필요하면 뒤쪽 노드에서 다시 파싱하거나 표현식 결과를 직접 참조한다 |
| `output.rows` | Array<Record> | 핸들러 반환 | SELECT 결과 행. INSERT·UPDATE·DELETE 계열은 `[]` (Principle 8.2 1차 명명) |
| `output.rowCount` | number | 핸들러 반환 | 영향받은 행 수(PostgreSQL `rowCount`, MySQL `affectedRows`). SELECT 0건도 `0` |
| `output.fields` | Array<{name, dataTypeID}>? | 핸들러 반환 | 컬럼 메타(PostgreSQL `pg.FieldDef`, MySQL `columnType`). MySQL INSERT 계열은 `[]`. MySQL SELECT 인데 드라이버가 `fields` 를 배열로 주지 않으면 생략(Principle 11) |
| `output.insertId` | number? | 핸들러 반환 | MySQL INSERT 전용 auto-increment id. PostgreSQL 이나 다른 쿼리 유형에는 없다 |
| `meta.durationMs` | number | 핸들러 반환 | 쿼리 실행 시간(ms) |
| `port` | `'success'` | 핸들러 반환 | 정상 분기 |

`rowCount` 는 형식상 메트릭이지만 워크플로우 분기(`rowCount > 0`)의 판단 재료로 쓰이므로 `output` 에 둔다(노드 출력 규약 Principle 1 의 실용적 해석, Principle 8.2 표). 같은 값을 `meta` 에 복제하지 않는다.

표현식 접근 예:

- `$node["X"].output.rows[0].name` → `"Alice"`
- `$node["X"].output.rowCount` → `1`
- `$node["X"].output.insertId` → `99` (MySQL INSERT)
- `$node["X"].meta.durationMs` → `12`
- `$node["X"].port` → `"success"`

### 런타임 에러 (`error`)

런타임 실패는 `output.error.{code, message, details?}`(노드 출력 규약 Principle 3.2)로 `error` 포트에 나간다. `rows`·`rowCount`·`fields`·`insertId` 는 **없다**(Principle 11). 표현식 자동완성에서도 흐리게 보여야 한다.

구문 에러:

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

다른 실패도 같은 모양이다(PostgreSQL 예. `config.integrationId` 는 `int_pg_1`, `parameters` 는 표에 없으면 `[]`).

| 경우 | `config.query` | `code` | `message` | `details.driverCode` | `durationMs` |
|------|----------------|--------|-----------|----------------------|--------------|
| 연결 끊김·타임아웃 | `SELECT 1` | `DB_CONNECTION_ERROR` | `Connection terminated unexpectedly` | `ECONNRESET` | 42 |
| 제약 위반(unique·FK·NOT NULL) | `INSERT INTO users(id) VALUES ($1)` (`queryType: insert`, `parameters: ["u_1"]`) | `DB_CONSTRAINT_VIOLATION` | `duplicate key value violates unique constraint "users_pkey"` | `23505` | 9 |
| 권한 부족 | `SELECT * FROM secret_table` | `DB_PERMISSION_DENIED` | `permission denied for table secret_table` | `42501` | 6 |

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | 정상 케이스와 같음 | 설정 에코 | 자격 증명은 에코하지 않고 `integrationId` 만 |
| `output.error.code` | enum | 핸들러 반환 | `DB_QUERY_FAILED` / `DB_CONNECTION_ERROR` / `DB_CONSTRAINT_VIOLATION` / `DB_PERMISSION_DENIED` / `DB_HOST_BLOCKED`, 또는 [통합 노드 공통](CLE-NODE-INT-COMMON.md)의 `IntegrationError` 코드(예: `INTEGRATION_NOT_CONNECTED`). UPPER_SNAKE_CASE |
| `output.error.message` | string | 핸들러 반환 | 드라이버 원문 메시지. `sanitizeMessage` 로 password·secret 토큰을 가린 뒤 내보낸다 |
| `output.error.details` | object? | 핸들러 반환 | 드라이버 native 코드 등(예: PostgreSQL SQLSTATE `{ driverCode: "23505" }`, MySQL `{ driverCode: "ER_DUP_ENTRY" }`). 매핑할 수 있으면 항상 넣는다 |
| `meta.durationMs` | number | 핸들러 반환 | 실패까지 걸린 시간(ms) |
| `port` | `'error'` | 핸들러 반환 | 런타임 실패 분기 |

표현식 접근 예:

- `$node["X"].output.error.code === "<코드>"` → 코드별 분기. `DB_QUERY_FAILED` 일반 쿼리 실패, `DB_CONNECTION_ERROR` 연결 끊김·타임아웃(재시도 후보), `DB_CONSTRAINT_VIOLATION`·`DB_PERMISSION_DENIED` 영구 에러, `INTEGRATION_NOT_CONNECTED` 통합 상태
- `$node["X"].output.error.details.driverCode` → 드라이버 원본 코드(예: `"23505"`, `"ER_DUP_ENTRY"`)
- `$node["X"].output.rows` → `undefined` (에러 포트에는 없다)

## 에러 코드

### 사전 검증 에러

`handler.validate()` 가 실패하면(설정 형식 자체가 잘못된 경우) 노드 실행이 시작되지 않는다. 경고 규칙과 `evaluateMetadataBlockingErrors` 가 throw 하고 엔진이 실행을 실패로 끝낸다. 예: `integrationId is required`, `query is required and must be a string`, `queryType must be one of: ...`, `parameters must be an array or a JSON array string`.

### 런타임 에러 (`port: 'error'`)

| 코드 | 조건 | 드라이버 힌트 (`details.driverCode`) |
|------|------|--------------------------------------|
| `DB_QUERY_FAILED` (기본) | SQL 구문 에러, 잘못된 컬럼·테이블, 타입 불일치 등 일반 실행 실패. 매핑되지 않는 모든 경우의 fallback | pg `42xxx`(제약·권한 제외), mysql `ER_PARSE_ERROR` 등 |
| `DB_CONNECTION_ERROR` | 실행 중 연결 끊김·타임아웃, handshake 단계 인증 거부, 자원 부족, 운영자 개입 | Node errno `ECONNRESET`·`ECONNREFUSED`·`ETIMEDOUT`·`ENOTFOUND`. pg SQLSTATE class `08xxx`(connection_exception), `28xxx`(invalid_authorization_specification, handshake 인증 실패), `53xxx`(insufficient_resources, 예: too_many_connections), `57xxx`(operator_intervention, admin_shutdown). mysql `PROTOCOL_CONNECTION_LOST`·`ER_ACCESS_DENIED_ERROR`(handshake 인증 실패)·`ER_TOO_MANY_USER_CONNECTIONS` |
| `DB_CONSTRAINT_VIOLATION` | unique·foreign key·not null·check·exclusion 제약 위반 | pg `23xxx`(`23505` unique, `23503` FK, `23502` not null, `23514` check, `23P01` exclusion), mysql `ER_DUP_ENTRY`·`ER_NO_REFERENCED_ROW*`·`ER_ROW_IS_REFERENCED*`·`ER_BAD_NULL_ERROR`·`ER_CHECK_CONSTRAINT_VIOLATED` |
| `DB_PERMISSION_DENIED` | 인증된 세션의 객체 권한 부족(실행 중 발견) | pg `42501`(insufficient_privilege), mysql `ER_TABLEACCESS_DENIED_ERROR`·`ER_COLUMNACCESS_DENIED_ERROR`·`ER_DBACCESS_DENIED_ERROR`·`ER_SPECIFIC_ACCESS_DENIED_ERROR` |
| `DB_HOST_BLOCKED` | 사설망 차단 가드가 `credentials.host` 를 사설·loopback·link-local·CGNAT·IPv6 사설 대역으로 판정해 막음(풀 연결 전). 기본 켜짐, `ALLOW_PRIVATE_HOST_TARGETS=true` 로 해제. 메시지는 호스트·IP 를 담지 않는다 | — (가드 차단, 드라이버 관여 없음) |
| `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` | 통합 해소·자격 증명 누락 실패(D4) | — |
| `INTEGRATION_CALL_FAILED` | 통합이 없거나 다른 워크스페이스 소속(`requireEntity` 의 `RESOURCE_NOT_FOUND` fallback). 사설망 차단 가드가 차단 판정(`SsrfBlockedError`)이 아닌 오류를 던진 경우(가드 고장)도 이 코드다. `DB_HOST_BLOCKED` 는 판정에만 쓴다. 이 노드는 리다이렉트가 없어 HTTP Request 와 달리 시점 구분이 없다 | — |
| `INTEGRATION_SERVICE_UNAVAILABLE` | `IntegrationsService` 가 핸들러에 주입되지 않음(배포 누락, D4) | — |
| `INVALID_PARAMETERS` | `config.parameters` JSON 파싱 실패 또는 배열이 아닌 형태(D4) | — |

- 드라이버 간 일관성: pg SQLSTATE class `28` 과 mysql `ER_ACCESS_DENIED_ERROR` 는 모두 handshake 단계 인증 실패다. 두 드라이버 모두 `DB_CONNECTION_ERROR` 로 보내서 워크플로우의 자격 증명 교체 재시도 정책이 양쪽에서 같게 동작한다. 실행 중 권한 거부(`DB_PERMISSION_DENIED`)는 인증된 세션이 객체 접근에 실패한 별도의 영구 에러다.
- 활동 로그에는 `toLogError(err)` 가 같은 방식으로 가린 `code`·`message` 를 기록한다.
- `output.error.details.driverCode` 는 드라이버가 식별 가능한 native 코드(PostgreSQL `DatabaseError.code` SQLSTATE, MySQL `QueryError.code`)를 줄 때 항상 채운다. 드라이버가 코드를 주지 않으면(`Error` 인스턴스만) `details` 자체를 생략한다(Principle 11).
- 현재 구현의 런타임 출력 zod 스키마(`databaseQueryNodeOutputSchema.output.error`)는 `code`·`message` 만 선언하고 `.passthrough()` 로 둔다. 그래서 `details` 는 런타임에 그대로 통과하지만 스키마 타입에는 없다. 표현식 자동완성에 `details.driverCode` 를 보이려면 스키마에 선언을 더해야 한다(보강 후보).

## Rationale

### `DB_HOST_BLOCKED` 전용 차단 코드 (2026-06-12)

이전에는 DB 호스트 차단이 공용 가드의 일반 `Error` 로 던져져 `mapDbError` fallback 인 `INTEGRATION_CALL_FAILED` 로 나왔다. HTTP Request(`HTTP_BLOCKED`)와 Send Email(`EMAIL_HOST_BLOCKED`)은 각자 전용 코드가 있어서 비대칭이었다. 그래서 워크플로우 작성자가 "사설망 차단" 을 다른 통합 실패와 구분해 분기할 수 없었다. 세 노드의 차단 동작을 일관되게 드러내려고 전용 코드 `DB_HOST_BLOCKED` 를 만들었다. 핸들러는 가드가 차단을 판정할 때 던지는 `SsrfBlockedError` 만 `DB_HOST_BLOCKED` 로 올리고, 그 밖의 오류(가드 고장)는 경고 로그를 남긴 뒤 `INTEGRATION_CALL_FAILED` 로 내보낸다([부모 문서 요구사항](CLE-NODE-DBQUERY.md#요구사항)의 가드 고장 항목, [통합 노드 공통 「차단 코드를 판정에만 쓰는 이유」](CLE-NODE-INT-COMMON.md#차단-코드를-판정에만-쓰는-이유)).

- 메시지 일반화: 클라이언트에 나가는 메시지에는 차단된 호스트·IP 를 넣지 않는다(정찰 면 축소). Send Email·HTTP Request 와 같은 원칙이다.
- 해제 플래그 재사용: 별도 플래그를 만들지 않고 `ALLOW_PRIVATE_HOST_TARGETS` 를 재사용한다. 통합 노드 전체의 보안 자세(기본 차단, 셀프 호스팅만 해제)를 일관되게 유지하기 위해서다.
- 채팅 채널 분류: `DB_HOST_BLOCKED` 는 [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md)의 `DB_*` 매핑에 들어가 `executionFailedInternal` 로 분류된다. 차단은 우리 쪽 정책 결정이므로 내부 실패다.
- 호환성: 차단 케이스의 `output.error.code` 가 `INTEGRATION_CALL_FAILED` 에서 `DB_HOST_BLOCKED` 로 바뀌었다. 이 경우를 일반 코드로 분기하던 저장된 워크플로우에는 breaking 이다. 영향 범위는 "DB 사설망 차단" 이라는 드문 경로에 한정된다.
