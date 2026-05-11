# Database Query (`database_query`) — UI 라벨 "Database"

> SQL 쿼리를 실행합니다. PostgreSQL과 MySQL을 지원하며, Integration 자격증명을 읽어 드라이버별 커넥션 풀(integrationId + 자격증명 해시 키)을 캐시합니다. placeholder는 PostgreSQL 스타일 `$1, $2, ...`로 통일하며 MySQL에서는 자동으로 `?`로 치환됩니다.

- **카테고리**: `integration`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `integrationId` | string | yes | (없음) | Database Integration ID (`serviceType: 'database'`) | no |
| `queryType` | `'select' \| 'insert' \| 'update' \| 'delete' \| 'raw'` | no | `'select'` | 쿼리 종류. 현재 핸들러 동작 분기에는 사용되지 않고 표시/감사용으로만 전달됨 | no |
| `query` | string | yes | (없음) | SQL 본문. PostgreSQL placeholder(`$1`, `$2`)를 사용하면 MySQL 대상에도 그대로 사용 가능 | no |
| `parameters` | `unknown[] \| string` | no | `[]` | 바인딩 값 배열 또는 JSON 배열 문자열(`'["v1", 2]'`). 문자열을 넘기면 핸들러가 파싱 | yes (`expression` 위젯) |

## Ports

| 방향 | id | label | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | `data` | (참조용 — 핸들러는 직접 소비하지 않음) |
| Output | `success` | Success | `data` | 쿼리 실행 성공 |
| Output | `error` | Error | `error` | **런타임 쿼리 실행 에러만** (SQL 구문 오류, 연결 실패, constraint 위반 등). pre-flight 에러는 throw |

## Input

핸들러는 `_input`을 직접 사용하지 않습니다. `query`와 `parameters` 안에 expression(`{{ ... }}`)을 쓰면 엔진의 resolver가 핸들러 호출 전에 값을 치환해 줍니다. `parameters`가 JSON 배열 문자열로 들어오면 핸들러가 `JSON.parse`합니다(실패 시 `INVALID_PARAMETERS` throw).

## Output

### Case 1: SELECT 성공 (PostgreSQL)

입력 config: `{ integrationId: "int_pg_1", query: "SELECT id, name FROM users WHERE id = $1", parameters: ["u_1"] }`

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

### Case 2: 결과가 0건인 SELECT

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

`rows`는 빈 배열, `rowCount`는 0. `fields`는 드라이버가 컬럼 메타를 제공하면 채워집니다.

### Case 3: SELECT 성공 (MySQL — `$N → ?` 자동 변환)

```json
{
  "config": {
    "integrationId": "int_mysql_1",
    "query": "SELECT id FROM t WHERE x = $1",
    "queryType": "select",
    "parameters": ["v"]
  },
  "output": {
    "rows": [{ "id": 7 }],
    "rowCount": 1,
    "fields": [{ "name": "id", "dataTypeID": 3 }]
  },
  "meta": { "durationMs": 9 },
  "port": "success"
}
```

MySQL에서는 `fields[].dataTypeID`가 mysql2의 `columnType`(숫자) 값입니다.

### Case 4: INSERT 성공 (MySQL — `ResultSetHeader`)

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

`rowCount`는 `affectedRows`, `insertId`는 마지막 auto-increment ID. PostgreSQL에서는 `insertId`가 없으며 `rowCount`는 `pg`의 `rowCount` 또는 `rows.length`.

### Case 5: 쿼리 실행 에러 (error 포트)

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
      "code": "QUERY_FAILED",
      "message": "syntax error at or near \"SELEC\""
    }
  },
  "meta": { "durationMs": 5 },
  "port": "error"
}
```

에러 코드는 `IntegrationError`이면 그 `code`, 그 외에는 `'QUERY_FAILED'`. 예: `INTEGRATION_TYPE_MISMATCH`, `INTEGRATION_NOT_CONNECTED`는 throw 경로이므로 여기까지 오지 않습니다(아래 Case 6 참고).

### Case 6: Pre-flight 에러 (throw → 노드 실패)

아래는 error 포트로 라우팅되지 않고 **handler가 throw**하여 노드 자체가 실패합니다.

| 코드 | 원인 |
| --- | --- |
| `INTEGRATION_SERVICE_UNAVAILABLE` | IntegrationsService DI 주입 실패 (운영상 설정 문제) |
| `INTEGRATION_TYPE_MISMATCH` | `serviceType`이 `'database'`가 아님 |
| `INTEGRATION_NOT_CONNECTED` | integration이 `connected`가 아님 (`expired`, `error` 등) |
| `INTEGRATION_INCOMPLETE` | 자격증명에서 `driver/host/port/database/username/password` 중 누락 |
| `INVALID_PARAMETERS` | `parameters` 문자열이 JSON 배열로 파싱되지 않음 |

| 필드 | 설명 |
| --- | --- |
| `config.integrationId` | 사용된 integration ID (자격증명 호스트/비번은 echo되지 않음) |
| `config.query` | 실행한 SQL 원문 (`$N → ?` 변환 전) |
| `config.queryType` | 설정값 그대로. 핸들러 분기에는 사용되지 않음 |
| `config.parameters` | 파싱 후의 값 배열 (문자열 JSON이었다면 배열로 정규화됨) |
| `output.rows` | 결과 row 배열. SELECT는 row 목록, INSERT/UPDATE/DELETE MySQL은 `[]` |
| `output.rowCount` | PostgreSQL은 `pg`의 `rowCount ?? rows.length`; MySQL은 SELECT는 `rows.length`, 그 외는 `affectedRows` |
| `output.fields` | `[{ name, dataTypeID }]`. PostgreSQL OID(예: `25`=text, `23`=int4), MySQL은 `columnType` 숫자 |
| `output.insertId` | MySQL ResultSetHeader의 `insertId` (INSERT 계열에서만) |
| `output.error.code` | 에러 포트 경로에서만 존재 (`QUERY_FAILED` 등) |
| `output.error.message` | 에러 메시지. 드라이버 메시지는 Activity 로그에선 masking되지만 `output`에는 원문이 그대로 담김 |
| `meta.durationMs` | 실행 소요 ms |
| `port` | `'success'` 또는 `'error'` |

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Find User`라고 가정합니다.

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Find User"].output.rows }}` | `[{id:"u_1",name:"Alice"}]` | 결과 row 배열 |
| `{{ $node["Find User"].output.rows[0] }}` | `{id:"u_1",name:"Alice"}` | 첫 번째 row |
| `{{ $node["Find User"].output.rows[0].name }}` | `"Alice"` | 첫 row의 특정 컬럼 |
| `{{ $node["Find User"].output.rowCount }}` | `1` | 영향받은/결과 row 수 |
| `{{ $node["Find User"].output.insertId }}` | `99` | MySQL INSERT 전용 |
| `{{ $node["Find User"].output.fields }}` | `[{name:"id",dataTypeID:25}]` | 컬럼 메타 |
| `{{ $node["Find User"].output.error.code }}` | `"QUERY_FAILED"` | error 포트 경로에서만 |
| `{{ $node["Find User"].output.error.message }}` | `"syntax error ..."` | error 포트 메시지 |
| `{{ $node["Find User"].meta.durationMs }}` | `12` | 실행 시간 |
| `{{ $node["Find User"].port }}` | `"success"` \| `"error"` | 활성 포트 |
| `{{ $node["Find User"].config.query }}` | `"SELECT ... $1"` | 실행한 SQL 원문 |
| `{{ $node["Find User"].config.parameters }}` | `["u_1"]` | 파싱된 파라미터 배열 |
| `{{ $node["Find User"].config.queryType }}` | `"select"` | 설정값 |
| `{{ $node["Find User"].config.integrationId }}` | `"int_pg_1"` | 사용한 integration ID |

## 주의사항

- **자격증명 제거**: Integration 자격증명(host, port, user, password, ssl 등)은 `config`에 echo되지 않습니다. `config.integrationId`로만 참조됩니다.
- **placeholder 통일**: 항상 PostgreSQL 스타일(`$1`, `$2`, ...)로 작성하세요. MySQL 드라이버 경로에서는 핸들러가 `query.replace(/\$\d+/g, '?')`로 자동 변환합니다 — 따라서 **파라미터 순서가 곧 바인딩 순서**이며, 같은 `$N`을 여러 번 참조하면 그만큼 값을 반복해서 넣어야 합니다.
- **parameters 입력 형태**: 배열(`[...]`) 또는 JSON 배열 문자열(`'["v"]'`) 모두 허용. 문자열인데 JSON 배열로 파싱 안 되면 `INVALID_PARAMETERS` throw → 노드 실패 (error 포트 아님). 객체/숫자/다른 값은 validate 단계에서 거부.
- **pre-flight vs runtime**: integration 조회/타입/상태/자격증명 누락, `INVALID_PARAMETERS`는 **throw(노드 실패)** 로 처리되어 error 포트로 가지 **않습니다**. SQL 구문 오류·제약조건 위반·네트워크 실패 같은 쿼리 실행 시점 오류만 error 포트로 라우팅됩니다.
- **드라이버**: 자격증명의 `driver`가 `'mysql'`이면 `mysql2/promise` 경로, 그 외(`'postgres'` 기본)는 `pg` 경로. driver 미지정은 `'postgres'`로 간주.
- **커넥션 풀**:
  - 키: `integrationId` + 자격증명 SHA-256 해시. 자격증명이 바뀌면 기존 풀을 백그라운드에서 `end()` 하고 새 풀 생성.
  - PostgreSQL(`pg.Pool`): `max=5`, `idleTimeoutMillis=30_000`, 매 실행마다 `connect()` → 쿼리 → `finally { client.release() }` (에러 경로에서도 반드시 release).
  - MySQL(`mysql2.createPool`): `connectionLimit=5`, `idleTimeout=30_000`, `waitForConnections=true`.
  - `handler.invalidatePool(integrationId)` / `handler.shutdown()`로 외부에서 풀을 닫을 수 있음 (엔진/테스트 종료 훅 용도).
- **SSL 정책**:
  - `ssl: 'require'` 또는 `'verify-full'` → `{ rejectUnauthorized: true }`. `require`도 **인증서 검증을 강제**합니다 (과거의 `rejectUnauthorized: false` 기본값은 MITM 위험으로 제거됨).
  - self-signed 인증서가 필요하면 연결 정책을 서버 쪽에서 해결하거나, `verify-full` 페어로 전환해야 합니다.
  - `ssl: 'disable'`(또는 미설정) → PostgreSQL `false`, MySQL은 SSL 옵션 미전달.
- **`queryType` 힌트**: schema는 enum이지만 핸들러는 분기용으로 쓰지 않습니다(감사/UI 표시용). `'raw'`를 고르더라도 핸들러 동작은 동일.
- **IntegrationUsageLog**: 성공/실패 모두 `nodeExecutionId`와 함께 기록됩니다. 실패 경로에서는 `toLogError`가 메시지의 비밀번호/토큰 패턴을 `***`로 마스킹합니다(단, `output.error.message`는 원문 유지이므로 워크플로우 작성자가 노출 범위를 책임져야 함).
- **결과 row 직렬화**: PostgreSQL은 `pg` 기본 type parser를 거쳐 JS 값으로 변환(숫자, 문자열, Buffer, Date 등). JSON으로 내보낼 때 Buffer/Date 등은 expression resolver가 문자열화할 수 있으니, 바이너리 컬럼은 서버에서 base64 등으로 변환해 select 하는 것을 권장.
