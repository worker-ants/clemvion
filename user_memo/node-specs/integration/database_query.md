# Database Query (`database_query`) — UI 라벨 "Database"

> SQL 쿼리를 실행합니다. PostgreSQL과 MySQL을 지원하며, Integration에서 자격증명을 받아 연결 풀을 자동 관리합니다.

- **카테고리**: `integration`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `integrationId` | string | yes | (없음) | DB Integration ID (자격증명) | no |
| `queryType` | `'select' \| 'insert' \| 'update' \| 'delete' \| 'raw'` | no | `'select'` | 쿼리 종류 (현재 핸들러는 모두 동일하게 처리, 표시용) | no |
| `query` | string | yes | (없음) | SQL 본문. PostgreSQL placeholder(`$1`, `$2`) 사용 (MySQL에서는 자동으로 `?`로 변환) | no |
| `parameters` | `unknown[] \| string` | no | `[]` | 바인딩 값 배열 또는 JSON 배열 문자열 (`'["v1", 2]'`) | (필드 자체 expression) |

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | (참조용) |
| Output | `success` | Success | 쿼리 성공 |
| Output | `error` | Error | 쿼리 실패 (런타임 에러 — 자격증명/연결/구문 오류) |

## Input

핸들러는 input을 사용하지 않습니다. expression resolver가 `parameters` 안의 expression을 사전 평가합니다.

## Output

### Case 1: SELECT 성공 (PostgreSQL)

config: `{ integrationId: "int_pg_1", query: "SELECT id, name FROM users WHERE id = $1", parameters: ["u_1"] }`

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

### Case 2: INSERT/UPDATE/DELETE 성공 (MySQL)

```json
{
  "config": { ... },
  "output": {
    "rows": [],
    "rowCount": 1,
    "insertId": 42,
    "fields": []
  },
  "meta": { "durationMs": 8 },
  "port": "success"
}
```

`insertId`는 MySQL의 `LAST_INSERT_ID()`. PostgreSQL에서는 없음.

### Case 3: 쿼리 실패 (런타임 에러)

```json
{
  "config": { ... },
  "output": {
    "error": {
      "code": "QUERY_FAILED",
      "message": "syntax error at or near \"FRO\""
    }
  },
  "meta": { "durationMs": 5 },
  "port": "error"
}
```

### Case 4: Pre-flight 에러 (자격증명 누락 등)

핸들러가 throw → 노드 실패 (error 포트로 라우팅되지 않고 노드 자체가 실패). 예: `INTEGRATION_INCOMPLETE`, `INTEGRATION_SERVICE_UNAVAILABLE`.

| 필드 | 설명 |
| --- | --- |
| `output.rows` | 결과 row 배열 (SELECT) 또는 빈 배열 (INSERT/UPDATE/DELETE) |
| `output.rowCount` | 영향받은 row 수 (SELECT는 결과 길이) |
| `output.fields` | 컬럼 메타 정보 배열 (`{name, dataTypeID}`) |
| `output.insertId` | (MySQL INSERT만) 새로 생성된 auto-increment ID |
| `output.error.code` | 에러 코드 (`QUERY_FAILED`, `INTEGRATION_*`) |
| `output.error.message` | 에러 상세 메시지 |
| `meta.durationMs` | 실행 시간 |
| `port` | `'success'` 또는 `'error'` |

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Find User`라고 가정.

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Find User"].output.rows }}` | `[{id:"u_1",name:"Alice"}]` | 결과 row 배열 |
| `{{ $node["Find User"].output.rows[0] }}` | `{id:"u_1",name:"Alice"}` | 첫 번째 row |
| `{{ $node["Find User"].output.rows[0].name }}` | `"Alice"` | 첫 row의 특정 컬럼 |
| `{{ $node["Find User"].output.rowCount }}` | `1` | row 수 (또는 영향받은 수) |
| `{{ $node["Find User"].output.insertId }}` | `42` | (MySQL INSERT만) |
| `{{ $node["Find User"].output.fields }}` | `[{name:"id",...}]` | 컬럼 메타 |
| `{{ $node["Find User"].output.error.message }}` | `"syntax error..."` | (실패 시) 에러 메시지 |
| `{{ $node["Find User"].meta.durationMs }}` | `12` | 실행 시간 |
| `{{ $node["Find User"].port }}` | `"success"` 또는 `"error"` | 라우팅 |

## 주의사항

- **placeholder는 항상 PostgreSQL 스타일 (`$1`, `$2`, ...)** 으로 작성. MySQL 드라이버에서는 자동으로 `?`로 변환됩니다 (positional 순서).
- `parameters`는 배열 또는 JSON 배열 문자열 모두 허용. 문자열인데 JSON 파싱 실패 시 `INVALID_PARAMETERS` throw (노드 실패).
- 자격증명 누락 / Integration 서비스 미설정은 throw → 노드 실패 (error 포트가 아닌 워크플로우 실패).
- 쿼리 실행 자체의 에러(SQL 구문 오류, constraint 위반 등)는 `error` 포트로 라우팅 — 후속 노드에서 분기 가능.
- 연결 풀은 integration ID + 자격증명 hash로 캐시. 자격증명 변경 시 자동 재생성.
- SSL 설정: integration의 `ssl: 'require'` 또는 `'verify-full'`이면 `rejectUnauthorized: true`. self-signed 인증서는 명시적 설정 필요 (보안상 기본 거부).
- `queryType` 필드는 schema enum이지만 핸들러는 분기에 사용하지 않음 — 표시용 메타데이터.
- result row의 `dataTypeID`는 PostgreSQL OID(예: `25`=text, `23`=int4) / MySQL columnType.
