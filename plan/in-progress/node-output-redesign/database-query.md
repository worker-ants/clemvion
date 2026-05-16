# Database Query output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. SELECT 의 `rows`/`rowCount`/`fields` + INSERT 의 `insertId` (MySQL 한정) + 드라이버 native `driverCode` 보존 유지. 잔여 권고 없음.

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

## 구현 분석 (2026-05-16)

대상 파일: `backend/src/nodes/integration/database-query/{database-query.handler.ts, database-query.schema.ts, database-query.schema.spec.ts, database-query.handler.spec.ts}`.

1. **spec §5 ↔ handler return 정합성**:
   - 정상 분기 (`database-query.handler.ts:162-167`): `{ config: configEcho, output: result, meta: { durationMs }, port: 'success' }` — spec §5.1 정확 일치. `result` 는 driver-specific (PG `executePostgres :233-255`, MySQL `executeMysql :199-231`) 가 `{ rows, rowCount, fields, insertId? }` 객체를 만들어 반환.
   - 에러 분기 (`:181-196`): `IntegrationError` instanceof 분기 — `{ code: err.code, message: sanitizeMessage(err.message) }` (`:182-186`), 그 외는 `mapDbError(err, driver)` (`:187`). 둘 다 `output: { error: errorEnvelope }` 로 wrap (`:189-194`). spec §5.3 의 envelope 정확 일치.
   - **`error` 분기에서 `rows`/`rowCount`/`fields`/`insertId` 부재** — handler `output: { error }` 만 보내므로 spec §5.3 의 "undefined 필드 생략" (Principle 11) 정합.

2. **schema ↔ spec config 정합성**: `databaseQueryNodeConfigSchema` (`database-query.schema.ts:65-109`) 의 `integrationId` / `queryType` (enum) / `query` / `parameters` (sum type `array | string`, default `[]`) — spec §1 표와 동일.

3. **validate 일관성** (`database-query.handler.ts:74-94`):
   - SSOT (`evaluateMetadataBlockingErrors` + `validateConfig`) 가 `integrationId`/`query` 필수 + `parameters` sum-type 검증.
   - handler 가 추가로 `query` 타입 가드 + `queryType` enum 가드만 추가. spec §5.8 와 1:1 일치.

4. **에러 컨트랙트 (Principle 3)** — **핵심**:
   - **Pre-flight throw** — `INTEGRATION_SERVICE_UNAVAILABLE` (`:105-110`), `INTEGRATION_INCOMPLETE` (`:133-138`), `INVALID_PARAMETERS` (`parseParameters :389-407`), 그리고 `resolveIntegration` 으로부터의 `INTEGRATION_NOT_FOUND/TYPE_MISMATCH/NOT_CONNECTED`. 모두 catch 블록 안의 `IntegrationError` instanceof 분기 (`:181-187`) 로 spec §5.3 envelope 으로 변환되어 `port:'error'`. **이는 spec §5.8 의 "pre-flight throw" 와 미세 불일치** — spec 은 IntegrationError 가 throw 되어 노드 실패로 분기한다 (`5.8` 마지막 표) 라고 명시하지만 코드는 catch 후 `port:'error'` 로 라우팅. 단 `resolveIntegration` 은 try 블록 **밖**에서 호출 (`:126`), `parseParameters` / `missingDbFields` 도 try 외부 (`:103, :131-138`). 즉 실제로 try 블록 안에서 throw 되는 IntegrationError 는 없다 (코드 주석 `:176-180` 가 명시: "defensive"). **결론: 코드 ↔ spec 정합 — `instanceof IntegrationError` 분기는 future-proof 가드**.
   - **Runtime `port:'error'`** — driver native 에러 (`mapDbError :478-494`) 가 `{ code: DB_*, message: sanitize, details?: { driverCode } }` 생산. spec §5.3 표 그대로.
   - `classifyDbError` (`:572-586`) + `classifyPostgresSqlState` (`:588-611`) + `classifyMysqlCode` (`:613-618`) 가 SQLSTATE / errno / mysql ER_* 코드를 4 enum 으로 분류. 28000 (pg) ↔ ER_ACCESS_DENIED_ERROR (mysql) 의 cross-driver symmetry 가 의도적 (handshake-time auth fail → `DB_CONNECTION_ERROR`) — spec §6.2 footnote 와 정합.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 1.1: `config` 에 `query`/`parameters` raw, `output` 에 `rows`/`rowCount`/`fields`/`insertId?` 평가 결과 — 직교 부합. `rowCount` 는 spec footnote 가 "비즈니스 분기 재료" 로 `output` 에 두기로 결정.
   - Principle 2: `meta = { durationMs }` 만 (`:165, :193`). `rowCount` 미러 없음 — 의도적 분리.
   - Principle 7: `configEcho = { integrationId, query, queryType, parameters }` (`:117-122`) — 4개 필드 명시적 선택. **spread 가 아닌 explicit picking 패턴**. 자격증명 미echo. 적절하나 schema 에 신규 필드 추가 시 echo 누락 가능성 있음 (HTTP Request 의 spread 패턴과 차이).
   - Principle 8.2: `output.rows`/`rowCount`/`fields`/`insertId` — spec 표와 정확 일치.

6. **handler 테스트 (`database-query.handler.spec.ts`, 707 줄)**:
   - PostgreSQL: 23505 (unique) → `DB_CONSTRAINT_VIOLATION` (`:281-305`), 23503 (FK) (`:307-323`), 42501 (permission) (`:325-343`), 42601 (syntax) (`:345-363`), 08006 (connection_failure) (`:365-381`), 28000 (auth) (`:383-398`), 53300 (too_many_connections) (`:400-417`), 57P01 (admin_shutdown) (`:419-437`).
   - Node errno: ECONNRESET (`:439-460`) — connect() 거부 시 release 미호출 검증 포함.
   - sanitizeMessage 회귀 (`:462-487`) — `password=hunter2` / `Bearer abc...` 가 `***` 로 마스킹.
   - MySQL: SELECT $N→? 변환 (`:489-523`), INSERT ResultSetHeader → `rowCount`+`insertId` (`:525-550`), ER_PARSE_ERROR (`:552-568`), ER_DUP_ENTRY (`:570-589`), PROTOCOL_CONNECTION_LOST (`:591-610`), ER_TABLEACCESS_DENIED_ERROR (`:612-632`), ER_ACCESS_DENIED_ERROR → `DB_CONNECTION_ERROR` cross-driver symmetry (`:634-653`).
   - Pre-flight: 자격증명 누락 (`:655-678`), JSON parse 실패 (`:680-694`), service 미주입 (`:696-705`).
   - **누락**: 타임아웃 케이스 (Pool 옵션 `POOL_IDLE_TIMEOUT_MS` 자체 동작) — 단위 테스트에서 verify 어렵지만 통합 테스트 부재. spec §6.2 의 ETIMEDOUT 코드만 어휘로 정의됨.

7. **횡단 일관성 (Integration 4종)**:
   - `IntegrationHandlerBase` 의 `resolveIntegration` + `logUsage` + `sanitizeMessage` + `toLogError` 패턴 공유. DB 는 `logUsage` 를 `.catch(() => {})` 로 wrap (`:161, :175`) — Email/Cafe24 도 동일 패턴 (B-5-6).
   - 풀 캐시: DB 만 driver-specific pool (PG / MySQL) 을 `integrationId + credsHash` 로 캐싱 (`:62-66, :281-345`). Email 도 동등 패턴 (`send-email.handler.ts:43-46` transports map). HTTP / Cafe24 는 fetch 매번 — 외부 connection lifecycle 차이로 인한 정합한 비대칭.

8. **구현 품질**:
   - `convertPgPlaceholders` (`:409-413`): `$N → ?` 변환 (MySQL 만). 정규식 `/\$\d+/g` 가 SQL 문자열 리터럴 안의 `$1` 도 변환하는 위험 — 가능하나 일반 운영에서 드물고, 사용자가 PostgreSQL placeholder syntax 로 작성 + MySQL driver 호환을 위한 trade-off.
   - SSL 매핑 (`buildPgConnection :348-373`, `buildMysqlSsl :415-422`): `require` / `verify-full` 모두 `rejectUnauthorized: true` 강제 — MITM 방어 (spec §4.7 footnote 와 정합).
   - 풀 관리: `invalidatePool` (`:261-270`) + `shutdown` (`:275-279`) + idle client `pool.on('error', ...)` warn (`:306-310`). credential 회전 시 stale pool evict.

## 종합 개선안 (2026-05-16)

- [ ] (impl, 선택) `configEcho` 의 `parameters` echo 가 raw 형태 (string 또는 array) 를 유지하는 동작이 spec footnote 와 정합한지 회귀 테스트로 명시 — 현 spec ↔ 구현 정합 상태이지만 schema sum-type 의 미세 변경에 회귀하지 않도록 보호. 근거: `database-query.handler.ts:121` (`parameters: rawConfig.parameters`), spec §5.1 footnote (`2-database-query.md:179`).
- [ ] (impl, 선택) `configEcho` 의 explicit picking 패턴을 `{ ...rawConfig }` spread 로 전환 검토 — HTTP Request 와 일관성 향상 + schema 신규 필드 자동 echo. 단 자격증명 누출 위험 평가 필요 (`integrationId` 외 credential-shape 필드가 schema 에 도입될 가능성 적음, 그래도 `sanitizeConfigEcho` (Cafe24 패턴) 적용 검토). 근거: `database-query.handler.ts:117-122` vs `http-request.handler.ts:148-155`.
- [ ] (test, 선택) `convertPgPlaceholders` 의 SQL 리터럴 안 `$N` 변환 위험을 회귀 테스트로 문서화 — 또는 placeholder 안전 변환 (예: tokenizer 기반) 으로 리팩토링. 근거: `database-query.handler.ts:409-413`.
