# Database Query output 개선안

> 대상 spec: `spec/4-nodes/4-integration/2-database-query.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/4-integration/2-database-query.md:96-118` — §5.1.1 SELECT 1건+ (PostgreSQL):

```json
{
  "config": { "integrationId": "int_pg_1", "query": "SELECT id, name FROM users WHERE id = $1", "queryType": "select", "parameters": ["{{ $input.userId }}"] },
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

§5.1.3 INSERT (MySQL):

```json
{
  "output": { "rows": [], "rowCount": 1, "insertId": 99, "fields": [] },
  "meta": { "durationMs": 8 },
  "port": "success"
}
```

§5.3 런타임 에러 (port `error`):

```json
{
  "output": { "error": { "code": "DB_QUERY_FAILED", "message": "...", "details": { "driverCode": "42601" } } },
  "meta": { "durationMs": 5 },
  "port": "error"
}
```

## 진단

Database Query 는 외부 호출 노드 (단계 1개). SELECT/INSERT/UPDATE/DELETE 정상 / runtime 에러.

| 영역 | 적절성 | 근거 |
| --- | --- | --- |
| `output.rows: Array<Record>` | 적절 (output) | 쿼리 결과 (Principle 8.2 — `output.rows`). INSERT 계열은 `[]` |
| `output.rowCount` | 적절 (output) | 영향받은 행 수. spec footnote: "워크플로우 분기(`if rowCount > 0`)의 비즈니스 판단 재료로 사용되어 `output` 에 유지" — Principle 1 의 실용적 해석 |
| `output.fields` (PostgreSQL columnDef / MySQL `[]`) | 적절 (output) | 컬럼 메타 — 다운스트림이 컬럼 타입 분기에 사용 가능 |
| `output.insertId?` (MySQL INSERT 한정) | 적절 (output) | auto-increment id — 후속 처리에 필수 |
| `output.error.{code, message, details?}` | 적절 | Principle 3.2 |
| `output.error.details.driverCode` (PostgreSQL SQLSTATE / MySQL code) | 적절 | 드라이버 native code — 분류용 |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.{integrationId, query, queryType, parameters}` (raw echo) | 적절 | Principle 7. `parameters` 는 JSON 문자열도 허용하므로 raw 그대로 echo |

부적절 항목 없음. spec 본문이 conventions 와 매우 잘 정합.

추가 점검:

1. **`output.rowCount` 가 `meta` 가 아닌 `output` 에 있는 이유** — spec footnote 명시: "워크플로우 분기 비즈니스 판단 재료". Principle 1 의 "비즈니스 결과물" 해석으로 정당. `meta` 에 복제하지 않는 결정도 좋음 (일관성).
2. **에러 시 `rows`/`rowCount`/`fields`/`insertId` 부재** — Principle 11 (`undefined` 필드 echo 금지) 부합. 다운스트림이 `output.error` 존재 여부로 분기.
3. **`INTEGRATION_*` 코드 사용** — Pre-flight (throw) 와 Runtime (`port:'error'`) 분리 정책 (`IntegrationError` 는 throw, 드라이버 SQL 오류는 `port:'error'`) — spec §5.3 footnote 명시. 합리적.

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

```json
// 정상 (SELECT)
{
  "config": { "integrationId": ..., "query": <raw>, "queryType": "select", "parameters": <raw> },
  "output": {
    "rows": [<Record>, ...],
    "rowCount": <number>,
    "fields": [{ "name": ..., "dataTypeID": ... }, ...]
  },
  "meta": { "durationMs": <number> },
  "port": "success"
}

// 정상 (INSERT MySQL)
{
  "output": { "rows": [], "rowCount": <number>, "insertId": <number>, "fields": [] },
  ...
}

// Runtime 에러
{
  "output": { "error": { "code": "DB_QUERY_FAILED" | "DB_CONNECTION_ERROR" | "DB_CONSTRAINT_VIOLATION" | "DB_PERMISSION_DENIED" | "INTEGRATION_*", "message": ..., "details"?: { "driverCode": ... } } },
  "meta": { "durationMs": <number> },
  "port": "error"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 |

## Rationale

- DB 노드의 `output` 은 모두 쿼리 결과 = 비즈니스 데이터 (rows, rowCount, fields, insertId). `meta` 에 들어갈 항목은 duration 정도.
- `output.rowCount` 가 `meta` 에 중복되지 않는 결정이 좋음 — 일관성. 다른 노드 (ForEach, Filter, Split) 가 메트릭 미러를 두는 것과 의도적 분리. spec footnote: "같은 값이 두 곳에 있으면 일관성을 해친다".
- `INTEGRATION_*` 코드 (예: `INTEGRATION_NOT_CONNECTED`) 는 [공통 §4.2](../../../spec/4-nodes/4-integration/0-common.md) 에서 정의 — Integration 카테고리 전반의 일관 코드.
- 드라이버 native code (`driverCode: "42601"`, `"ER_DUP_ENTRY"` 등) 보존은 다운스트림이 더 세밀한 분기 가능 — 운영 측 가시성에 유용.
