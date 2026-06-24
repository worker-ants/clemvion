# Database Query output 개선안

> **6차 갱신 (2026-06-25 코드 재검증)**: handler 는 여전히 단일 파일(`database-query.handler.ts`, 772줄). 2026-05-16 이후 코드가 크게 확장됐다 — D4 catch-all 단일 에러 경로(`parseParameters`/`resolveIntegration`/`missingDbFields`/SSRF 가드가 모두 try 블록 안으로 이동, §7.4 의 "pre-flight throw 미세 불일치" 논의는 **해소·전제 무효화** — spec §5.8 D4 가 port:'error' 라우팅을 명시 채택), dry-run WRITE mock 단락(PR #390 `isDryRun`/`isWriteOperation`/`buildDryRunMock`), abort 사전 체크(PR #381), SSRF 가드 + 전용 `DB_HOST_BLOCKED` 코드(PR #553/#549), Redis pub/sub 풀 무효화(PR #531 `IntegrationCacheBus`), usage 로그 `extractSqlVerb`(PR #338) 신설. **output 구조(`rows`/`rowCount`/`fields`/`insertId?` + error envelope) 자체는 무변 — spec 정합 유지.** §7 라인 인용 전부 stale → 현재 값으로 정정(success `:256-261`, error `:262-291`, schema `:65-113`, validate `:108-128`, mapDbError `:632-648` 등). §8 체크박스 3건은 **모두 잔여**(parameters raw echo 회귀 테스트·explicit-picking→spread·convertPgPlaceholders 리터럴 안전성) — 라인만 정정. 신규 갭 없음.

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

## 구현 분석 (2026-05-16, 라인 인용 2026-06-25 정정)

대상 파일: `codebase/backend/src/nodes/integration/database-query/{database-query.handler.ts (772줄), database-query.schema.ts, database-query.schema.spec.ts, database-query.handler.spec.ts (1155줄), database-query.component.ts, index.ts}`. handler 는 **분할되지 않고 단일 파일** 유지 (ai-agent 류 분할 없음).

1. **spec §5 ↔ handler return 정합성**:
   - 정상 분기 (`database-query.handler.ts:256-261`): `{ config: configEcho, output: result, meta: { durationMs }, port: 'success' }` — spec §5.1 정확 일치. `result` 는 driver-specific (PG `executePostgres :328-350`, MySQL `executeMysql :294-326`) 가 `{ rows, rowCount, fields, insertId? }` 객체를 만들어 반환.
   - 에러 분기 (`:262-291`): `IntegrationError` instanceof 분기 — `{ code: err.code, message: sanitizeMessage(err.message) }` (`:276-281`), 그 외는 `mapDbError(err, driver)` (`:282`). 둘 다 `output: { error: errorEnvelope }` 로 wrap (`:283-290`). spec §5.3 의 envelope 정확 일치.
   - **`error` 분기에서 `rows`/`rowCount`/`fields`/`insertId` 부재** — handler `output: { error }` 만 보내므로 spec §5.3 의 "undefined 필드 생략" (Principle 11) 정합.
   - **(2026-06-25 추가) dry-run WRITE mock 단락** (`:178-190`, PR #390): `isDryRun(context) && isWriteOperation(...)` 면 pool/connect 없이 `buildDryRunMock('database_query', { operation, sqlPreview })` + `port:'success'` 반환. READ(SELECT)는 실제 실행. spec §4 dry-run footnote 정합.

2. **schema ↔ spec config 정합성**: `databaseQueryNodeConfigSchema` (`database-query.schema.ts:65-113`) 의 `integrationId` / `queryType` (enum, default `'select'`) / `query` / `parameters` (sum type `array | string`, default `[]`) — spec §1 표와 동일.

3. **validate 일관성** (`database-query.handler.ts:108-128`):
   - SSOT (`evaluateMetadataBlockingErrors` + `validateConfig`) 가 `integrationId`/`query` 필수 + `parameters` sum-type 검증.
   - handler 가 추가로 `query` 타입 가드 + `queryType` enum 가드만 추가. spec §5.8 와 1:1 일치.

4. **에러 컨트랙트 (Principle 3)** — **핵심**:
   - **D4 단일 에러 경로 (이전 "pre-flight throw 미세 불일치" 전제 무효화)** — `INTEGRATION_SERVICE_UNAVAILABLE` (`:195-200`), `INTEGRATION_INCOMPLETE` (`:209-214`), `INVALID_PARAMETERS` (`parseParameters :543-561`), SSRF 차단 `DB_HOST_BLOCKED` (`:223-232`), 그리고 `resolveIntegration` (`:202`) 으로부터의 `INTEGRATION_TYPE_MISMATCH/NOT_CONNECTED/CALL_FAILED` — **이제 전부 try 블록 안(`:192-292`)에서 throw 되어** catch 의 `IntegrationError` instanceof 분기 (`:276-282`) 로 spec §5.3 envelope 으로 변환·`port:'error'` 라우팅된다. `parseParameters`·`resolveIntegration`·`missingDbFields` (`:208`) 모두 try **내부**로 이동. → (2026-06-25) 해소: spec §5.8 (D4) 이 이 라우팅을 명시 채택했고 코드도 일치 — 2026-05-16 plan 의 "코드는 try 밖에서 호출, instanceof 는 defensive future-proof 가드" 전제는 **D4 이후 폐기**. 근거 `database-query.handler.ts:192-292`, `database-query.handler.spec.ts:761-797`(INVALID_PARAMETERS·SERVICE_UNAVAILABLE → port:error), `:903-995`(DB_HOST_BLOCKED). PR #553(SSRF 코드)·#390(dry-run)·#381(abort).
   - **Runtime `port:'error'`** — driver native 에러 (`mapDbError :632-648`) 가 `{ code: DB_*, message: sanitize, details?: { driverCode } }` 생산. spec §5.3 표 그대로.
   - `classifyDbError` (`:726-740`) + `classifyPostgresSqlState` (`:742-765`) + `classifyMysqlCode` (`:767-772`) 가 SQLSTATE / errno / mysql ER_* 코드를 4 enum 으로 분류. 28000 (pg) ↔ ER_ACCESS_DENIED_ERROR (mysql) 의 cross-driver symmetry 가 의도적 (handshake-time auth fail → `DB_CONNECTION_ERROR`) — spec §6.2 footnote 와 정합.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 1.1: `config` 에 `query`/`parameters` raw, `output` 에 `rows`/`rowCount`/`fields`/`insertId?` 평가 결과 — 직교 부합. `rowCount` 는 spec footnote 가 "비즈니스 분기 재료" 로 `output` 에 두기로 결정.
   - Principle 2: `meta = { durationMs }` 만 (`:259, :288`). `rowCount` 미러 없음 — 의도적 분리.
   - Principle 7: `configEcho = { integrationId, query, queryType, parameters }` (`:154-159`, raw 는 `context.rawConfig ?? config` 에서) — 4개 필드 명시적 선택. **spread 가 아닌 explicit picking 패턴**. 자격증명 미echo. 적절하나 schema 에 신규 필드 추가 시 echo 누락 가능성 있음 (HTTP Request 의 spread 패턴과 차이).
   - Principle 8.2: `output.rows`/`rowCount`/`fields`/`insertId` — spec 표와 정확 일치.

6. **handler 테스트 (`database-query.handler.spec.ts`, 1155 줄 — 2026-05-16 의 707줄에서 확장. dry-run·SSRF·abort·cache-bus·extractSqlVerb·isWriteOperation 신규 블록 추가)**:
   - PostgreSQL: 23505 (unique) → `DB_CONSTRAINT_VIOLATION` (`:356`), 23503 (FK) (`:382`), 42501 (permission) (`:400`), 42601 (syntax) (`:420`), 08006 (connection_failure) (`:440`), 28000 (auth) (`:458`), 53300 (too_many_connections) (`:475`), 57P01 (admin_shutdown) (`:494`).
   - Node errno: ECONNRESET (`:514`) — connect() 거부 시 release 미호출 검증 포함.
   - sanitizeMessage 회귀 (`:537`) — `password=hunter2` / `Bearer abc...` 가 `***` 로 마스킹.
   - MySQL: SELECT $N→? 변환 (`:564`), INSERT ResultSetHeader → `rowCount`+`insertId` (`:600`), ER_PARSE_ERROR (`:627`), ER_DUP_ENTRY (`:645`), PROTOCOL_CONNECTION_LOST (`:666`), ER_TABLEACCESS_DENIED_ERROR (`:687`), ER_ACCESS_DENIED_ERROR → `DB_CONNECTION_ERROR` cross-driver symmetry (`:709`).
   - Pre-flight/D4 라우팅: 자격증명 누락 (`:730`), JSON parse 실패 → port:error (`:761`), service 미주입 → port:error (`:781`).
   - **(2026-06-25 추가) dry-run** (`:798-`), **SSRF host guard → DB_HOST_BLOCKED** (`:903-`), **abort 사전 체크 → AbortError** (`:1025`), **cache bus 등록** (`:132`), **extractSqlVerb** 유닛 (`:1046-`), **isWriteOperation** 유닛 (`:1109-`).
   - **누락(잔여)**: 타임아웃 케이스 (Pool 옵션 `POOL_IDLE_TIMEOUT_MS` 자체 동작) — 단위 테스트에서 verify 어렵지만 통합 테스트 부재. spec §6.2 의 ETIMEDOUT 코드만 어휘로 정의됨.

7. **횡단 일관성 (Integration 4종)**:
   - `IntegrationHandlerBase` 의 `resolveIntegration` + `logUsage` + `sanitizeMessage` + `toLogError` 패턴 공유. DB 는 `logUsage` 를 `.catch(() => {})` 로 wrap (`:250-255, :264-270`) — Email/Cafe24 도 동일 패턴 (B-5-6).
   - 풀 캐시: DB 만 driver-specific pool (PG / MySQL) 을 `integrationId + credsHash` 로 캐싱 (`:78-82`, resolve `:376-440`). Email 도 동등 패턴 (`send-email.handler.ts` transports map). HTTP / Cafe24 는 fetch 매번 — 외부 connection lifecycle 차이로 인한 정합한 비대칭.
   - **(2026-06-25 추가) 멀티 인스턴스 풀 무효화 (PR #531)** — `IntegrationCacheBus` 를 생성자에서 `register(this.invalidatePoolOnBroadcast)` (`:89-104`). credential 회전이 타 인스턴스에서 발생하면 Redis pub/sub 으로 통지받아 해당 풀 즉시 evict. bus 미주입 시 credsHash 비교 evict 로 degrade. spec §4.2 정합.

8. **구현 품질**:
   - `convertPgPlaceholders` (`:563-567`): `$N → ?` 변환 (MySQL 만). 정규식 `/\$\d+/g` 가 SQL 문자열 리터럴 안의 `$1` 도 변환하는 위험 — 여전히 단순 정규식(tokenizer 없음), 가능하나 일반 운영에서 드물고, 사용자가 PostgreSQL placeholder syntax 로 작성 + MySQL driver 호환을 위한 trade-off.
   - SSL 매핑 (`buildPgConnection :443-468`, `buildMysqlSsl :569-576`): `require` / `verify-full` 모두 `rejectUnauthorized: true` 강제 — MITM 방어 (spec §4.7 footnote 와 정합).
   - 풀 관리: `invalidatePool` (`:356-365`) + `shutdown` (`:370-374`) + idle client `pool.on('error', ...)` warn (`:401-405`). credential 회전 시 stale pool evict.
   - **(2026-06-25 추가) SSRF 가드** (`:223-232`, PR #553/#549): `assertSafeOutboundHostResolved(creds.host)` 실패 시 공용 가드의 plain Error 를 `IntegrationError('DB_HOST_BLOCKED')` 로 승격 → port:error. host/IP 미노출 일반화 메시지. HTTP `HTTP_BLOCKED` / Email `EMAIL_HOST_BLOCKED` 대칭.

## 종합 개선안 (2026-05-16)

- [ ] (impl, 선택) `configEcho` 의 `parameters` echo 가 raw 형태 (string 또는 array) 를 유지하는 동작이 spec footnote 와 정합한지 회귀 테스트로 명시 — 현 spec ↔ 구현 정합 상태이지만 schema sum-type 의 미세 변경에 회귀하지 않도록 보호. **잔여 (2026-06-25)**: 테스트는 `out.config.query` 만 단언(`database-query.handler.spec.ts:234`), `out.config.parameters` 의 raw 보존 단언은 여전히 부재. 근거: `database-query.handler.ts:158` (`parameters: rawConfig.parameters`), spec §5.1 footnote (`2-database-query.md:197`).
- [ ] (impl, 선택) `configEcho` 의 explicit picking 패턴을 `{ ...rawConfig }` spread 로 전환 검토 — HTTP Request 와 일관성 향상 + schema 신규 필드 자동 echo. 단 자격증명 누출 위험 평가 필요 (`integrationId` 외 credential-shape 필드가 schema 에 도입될 가능성 적음, 그래도 `sanitizeConfigEcho` (Cafe24 패턴) 적용 검토). **잔여 (2026-06-25)**: 여전히 4필드 explicit picking. 근거: `database-query.handler.ts:154-159`.
- [ ] (test, 선택) `convertPgPlaceholders` 의 SQL 리터럴 안 `$N` 변환 위험을 회귀 테스트로 문서화 — 또는 placeholder 안전 변환 (예: tokenizer 기반) 으로 리팩토링. **잔여 (2026-06-25)**: `/\$\d+/g` 단순 정규식 그대로, 리터럴 안전 변환·회귀 테스트 미추가. 근거: `database-query.handler.ts:563-567`.
