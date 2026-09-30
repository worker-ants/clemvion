---
id: "CLE-NODE-DBQUERY"
title: "Database Query 노드"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-DBQ-001", "REQ-DBQ-002", "REQ-DBQ-003", "REQ-DBQ-004", "REQ-DBQ-005", "REQ-DBQ-006", "REQ-DBQ-007", "REQ-DBQ-008", "REQ-DBQ-009", "REQ-DBQ-010", "REQ-DBQ-011", "REQ-DBQ-012", "REQ-DBQ-013", "REQ-DBQ-014", "REQ-DBQ-015", "REQ-DBQ-016", "REQ-DBQ-017", "REQ-DBQ-018", "REQ-DBQ-019", "REQ-DBQ-020", "REQ-DBQ-021", "REQ-DBQ-022", "REQ-DBQ-023", "REQ-DBQ-024", "REQ-DBQ-025", "REQ-DBQ-026", "REQ-DBQ-027", "REQ-DBQ-028", "REQ-DBQ-029"]
basis_superseded: false
parent: "CLE-NODE-INT"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT"]
area: "CLE-NODE-INT"
content_hash: "3f86c364c4eeee1d9240687dbd40b684b2b7a9d8102f724663a2032409a9ae4a"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/4-integration/2-database-query.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "cd55e573f8972d0046637ae59a719a020443dd1a6d393d30d6e9fea0dda0b147"
etag: "sha256-01e511a98d4b4e44dc012fa3d073b49e9732b35786c5769da2af61562224ca59"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/4-integration/2-database-query.md`, `spec/4-nodes/_product-overview.md` (§7.2) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Database Query 노드(`database_query`)는 외부 데이터베이스에 SQL 을 실행해 데이터를 조회하거나 조작하는 범용 통합 노드다. PostgreSQL 과 MySQL 드라이버를 모두 지원한다. 실행 결과는 `success` 포트로, 런타임 실패(구문 에러, 연결 끊김, 제약 위반 등)는 `error` 포트로 나간다.

통합 참조, 핸들러 6단계 계약, 공통 에러 코드, 사설망 차단 정책, 캔버스 요약은 [통합 노드 공통](CLE-NODE-INT-COMMON.md)이 정한다. 데이터베이스 통합의 자격 증명 스키마(`driver`, `host`, `ssl` 등)는 [서비스별 인증 방식과 자격 증명](../CLE-INT/CLE-INT-AUTH.md)에서 정한다. 이 문서는 노드의 설정·실행·출력·에러를 정한다.

## 요구사항

- REQ-DBQ-001 WHEN 노드가 실행되면 THE SYSTEM SHALL 설정한 SQL 을 통합의 데이터베이스에 실행해 데이터를 조회하거나 조작한다. (원본: ND-DQ-01)
- REQ-DBQ-002 WHEN 노드가 실행되면 THE SYSTEM SHALL DB 연결 정보를 `service_type='database'` 통합에서 읽는다. (원본: ND-DQ-02)
- REQ-DBQ-003 WHEN 쿼리에 `$1`, `$2` 같은 플레이스홀더가 있으면 THE SYSTEM SHALL `parameters` 배열 값을 순서대로 바인딩한다. (원본: ND-DQ-03)
- REQ-DBQ-004 WHEN SELECT 계열 쿼리가 끝나면 THE SYSTEM SHALL 결과 행을 `output.rows` 에, 행 수를 `output.rowCount` 에 담는다. (원본: ND-DQ-04)
- REQ-DBQ-005 WHEN INSERT·UPDATE·DELETE 계열 쿼리가 끝나면 THE SYSTEM SHALL 영향받은 행 수를 `output.rowCount` 에 담고 `output.rows` 를 빈 배열로 둔다. (원본: ND-DQ-04)
- REQ-DBQ-006 WHEN `credentials.driver` 가 `mysql` 이면 THE SYSTEM SHALL `mysql2/promise` 풀을 쓰고, 그 밖이면 `pg` 풀을 쓴다. (원본: ND-DQ-05)
- REQ-DBQ-007 WHILE 드라이버가 MySQL 인 동안 THE SYSTEM SHALL `$N` 플레이스홀더를 `?` 로 바꿔 실행한다.
- REQ-DBQ-008 WHEN MySQL INSERT 가 auto-increment id 를 돌려주면 THE SYSTEM SHALL 그 값을 `output.insertId` 에 담는다.
- REQ-DBQ-009 WHEN SELECT 결과가 0건이면 THE SYSTEM SHALL 에러가 아니라 `success` 포트로 `rowCount: 0` 을 내보낸다.
- REQ-DBQ-010 IF `parameters` 가 배열도 JSON 배열 문자열도 아니면 THE SYSTEM SHALL `INVALID_PARAMETERS` 로 에러 포트에 내보낸다.
- REQ-DBQ-011 WHEN 같은 통합과 같은 자격 증명으로 쿼리하면 THE SYSTEM SHALL 인스턴스 안의 연결 풀을 재사용한다.
- REQ-DBQ-012 WHEN 자격 증명 해시가 캐시된 풀과 다르면 THE SYSTEM SHALL 옛 풀을 버리고 새 풀을 만든다.
- REQ-DBQ-013 WHEN 통합의 자격 증명이 교체(`rotate`)되거나 통합이 삭제(`remove`)되면 THE SYSTEM SHALL 그 통합 id 를 `integration:cache:invalidate` 채널로 방송해 모든 인스턴스가 해당 풀을 즉시 버리게 한다.
- REQ-DBQ-014 IF 캐시 무효화 방송이 실패하면 THE SYSTEM SHALL 경고 로그만 남기고 다음 실행의 자격 증명 해시 비교로 옛 풀을 교체한다.
- REQ-DBQ-015 WHEN `credentials.ssl` 이 `require` 나 `verify-full` 이면 THE SYSTEM SHALL 인증서 검증을 강제한다.
- REQ-DBQ-016 WHEN 풀에 연결하기 전이면 THE SYSTEM SHALL `credentials.host` 에 사설망 차단을 적용한다.
- REQ-DBQ-017 IF `credentials.host` 가 사설망 대역으로 해석되면 THE SYSTEM SHALL `DB_HOST_BLOCKED` 와 호스트를 드러내지 않는 메시지로 에러 포트에 내보낸다.
- REQ-DBQ-018 IF 사설망 차단 가드가 차단 판정이 아닌 오류를 던지면 THE SYSTEM SHALL `INTEGRATION_CALL_FAILED` 로 에러 포트에 내보낸다.
- REQ-DBQ-019 WHEN 실행에 들어올 때 `context.abortSignal` 이 이미 취소 상태면 THE SYSTEM SHALL 즉시 `AbortError` 를 던진다.
- REQ-DBQ-020 WHEN 쿼리가 도는 중에 취소 신호가 오면 THE SYSTEM SHALL 별도 연결로 PostgreSQL `pg_cancel_backend` 나 MySQL `KILL QUERY` 를 보내 진행 중인 쿼리만 끊는다.
- REQ-DBQ-021 WHEN 취소 때문에 드라이버 에러(PostgreSQL `57014`, MySQL `ER_QUERY_INTERRUPTED`)가 나면 THE SYSTEM SHALL 이를 `AbortError` 로 다시 던져 노드 실행이 `cancelled` 로 분류되게 한다.
- REQ-DBQ-022 WHEN 쿼리가 실패하면 THE SYSTEM SHALL 드라이버 코드를 `DB_QUERY_FAILED`·`DB_CONNECTION_ERROR`·`DB_CONSTRAINT_VIOLATION`·`DB_PERMISSION_DENIED` 중 하나로 분류해 에러 포트에 내보낸다.
- REQ-DBQ-023 WHEN 드라이버가 native 에러 코드를 주면 THE SYSTEM SHALL 그 값을 `output.error.details.driverCode` 에 담는다.
- REQ-DBQ-024 WHEN 에러 메시지를 내보내거나 활동 로그에 남기면 THE SYSTEM SHALL 비밀번호·Bearer·긴 토큰 패턴을 가린다.
- REQ-DBQ-025 WHEN dry-run 으로 실행되고 쿼리가 쓰기 작업이면 THE SYSTEM SHALL DB 에 연결하지 않고 mock 결과로 `success` 포트에 보낸다.
- REQ-DBQ-026 WHEN dry-run 으로 실행되고 쿼리가 읽기 작업이거나 판정이 모호하면 THE SYSTEM SHALL 쿼리를 실제로 실행한다.
- REQ-DBQ-027 WHEN 실행이 끝나면 THE SYSTEM SHALL 성공·실패와 관계없이 활동 로그를 1건 남긴다.
- REQ-DBQ-028 WHEN 활동 로그를 남기면 THE SYSTEM SHALL `api_label` 을 NULL, `api_method` 를 SQL 동사, `api_path` 를 드라이버 토큰으로 채운다.
- REQ-DBQ-029 IF 설정 형식이 잘못되면 THE SYSTEM SHALL 사전 검증 에러로 실행을 실패시킨다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `integrationId` | UUID | ✓ | — | DB 통합 참조([통합 노드 공통](CLE-NODE-INT-COMMON.md) 통합 참조) |
| `query` | String (표현식) | ✓ | — | SQL 쿼리. `{{ }}` 템플릿을 쓸 수 있다. 플레이스홀더는 PostgreSQL 방식 `$1`, `$2`, ... |
| `parameters` | Array \| String | | `[]` | `$1`, `$2`, ... 위치 기반 바인딩 값. JSON 배열 문자열(예: `'["v1", 2]'`)도 받는다 |
| `queryType` | Enum | ✓ | `select` | `select` / `insert` / `update` / `delete` / `raw`. 감사·UI 힌트이며 실행 분기에는 영향이 없다 |

설정 스키마의 단일 기준은 `codebase/backend/src/nodes/integration/database-query/database-query.schema.ts` 의 `databaseQueryNodeConfigSchema` 다.

`query`·`parameters` 의 표현식은 엔진이 dispatch 직전에 평가하므로 핸들러는 평가된 SQL 과 값으로 동작한다. 설정 에코는 평가 전 원본을 남긴다(노드 출력 규약 Principle 7).

## 설정 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|---------------|------|
| 통합 | 맨 위 | 통합 선택기 | `service_type=database` 통합만 보여 준다 |
| 쿼리 유형 | 통합 아래 | `queryType` 드롭다운 | SELECT / INSERT / UPDATE / DELETE / RAW |
| SQL | 가운데 | SQL 에디터 | 구문 강조와 줄 번호를 제공한다 |
| 파라미터 | 아래 | JSON 배열 입력 | `$1`, `$2`, ... 순서대로 바인딩. 표현식으로 입력 값을 넣을 수 있다(예: `[ "{{ $input.userId }}" ]`) |

## 포트

| 방향 | id | label | type | dynamic | 설명 |
|------|----|-------|------|---------|------|
| 입력 | `in` | Input | data | false | 입력 데이터(1개). `query`·`parameters` 표현식의 `$input` 으로 읽는다 |
| 출력 | `success` | Success | data | false | 쿼리 실행 성공 |
| 출력 | `error` | Error | error | false | 런타임 실패(구문 에러·연결 끊김·제약 위반·권한 부족 등). 노드 출력 규약 Principle 3.1 |

동적 포트는 없다. D4 이후 자격 증명 누락, `INVALID_PARAMETERS`, 통합 해소 실패를 포함한 모든 실행 중 실패가 `error` 포트로 간다.

## 실행 로직

[통합 노드 공통](CLE-NODE-INT-COMMON.md)의 6단계 계약을 따른다. 노드 고유 동작은 다음과 같다.

0. **취소 확인**: 실행에 들어올 때 `context.abortSignal?.aborted` 면 즉시 `AbortError`(`err.name='AbortError'`)를 던진다. `cancel-others-on-fail` 등으로 이미 취소된 뒤 dispatch 된 경우다. 진행 중인 쿼리의 취소는 드라이버 수준에서 처리한다. abort 가 오면 **별도 풀 연결**로 PostgreSQL `SELECT pg_cancel_backend(<pid>)` 나 MySQL `KILL QUERY <threadId>` 를 보내 진행 중인 쿼리만 끊는다(연결은 유지). 취소로 생긴 드라이버 에러(PostgreSQL `57014`, MySQL `ER_QUERY_INTERRUPTED`)는 catch 에서 `AbortError` 로 다시 던져 `cancelled` 로 분류되게 한다([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md)). best-effort 다. 취소 권한과 타이밍에 따라 실패할 수 있지만 해는 없고, 정상 완료되면 리스너를 해제한다.
1. **드라이버 선택**: `Integration.credentials.driver` 가 `'mysql'` 이면 `mysql2/promise` 풀, 그 밖(기본 `'postgres'`)은 `pg` 풀을 쓴다.
2. **풀 캐시**: integrationId 와 자격 증명 SHA-256 해시를 키로 풀을 재사용한다(`POOL_MAX_CONNECTIONS=5`, `POOL_IDLE_TIMEOUT_MS=30000`). 자격 증명이 바뀌면 옛 풀을 버리고 새 풀을 만든다. 여러 인스턴스 사이의 무효화는 아래 "풀 캐시 무효화" 에서 정한다.
3. **플레이스홀더 변환**(MySQL 전용): `$1, $2, ...` 를 `?` 로 바꾼다(정규식 `\$\d+`). 파라미터는 그대로 배열 순서로 바인딩한다.
4. **파라미터 정규화**(`config.parameters`):
   - 배열이면 그대로 쓴다.
   - 문자열이면 `JSON.parse` 를 시도해 결과가 배열이면 쓴다.
   - `undefined`·`null`·`''` 이면 `[]` 다.
   - 그 밖이거나 JSON 파싱에 실패하면 `INVALID_PARAMETERS` 로 에러 포트에 보낸다(D4).
5. **PostgreSQL 실행**: `pool.connect()` → `client.query(sql, params)` → `client.release()`.
6. **MySQL 실행**: `pool.getConnection()` → `connection.query(sql, params)` → `connection.release()`. 결과가 배열이면 SELECT 계열(`rows`·`fields`), `ResultSetHeader` 면 INSERT·UPDATE·DELETE 계열(`rowCount = affectedRows`, `insertId`)이다. 연결을 명시적으로 얻는 이유는 진행 중 취소에 쓸 `threadId` 를 확보하기 위해서다(0단계).
7. **SSL 매핑**:

   | `credentials.ssl` | pg 옵션 | mysql2 옵션 |
   |-------------------|---------|-------------|
   | `disable` | `ssl: false` | `ssl: undefined` |
   | `require` | `ssl: { rejectUnauthorized: true }` | `ssl: { rejectUnauthorized: true }` |
   | `verify-full` | `ssl: { rejectUnauthorized: true }` | `ssl: { rejectUnauthorized: true }` |

   `require` 도 인증서 검증을 강제한다(MITM 방어). self-signed 인증서를 쓰려면 별도 `require-trust` 모드를 새로 도입해야 한다.
8. **활동 로그 기록**: 성공·실패 모두 `logUsage({ integrationId, status, durationMs, error?, api })` 를 부른다. API 식별 정보는 다음과 같다(통합별 전체 표는 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) INT-US-05).
   - `api_label` = NULL. 임의 SQL 을 부르므로 엔드포인트 카탈로그가 없다.
   - `api_method` = SQL 동사(`SELECT`·`INSERT`·`UPDATE`·`DELETE`). `config.queryType` 을 대문자로 그대로 쓴다. `queryType='raw'` 이면 평가된 SQL 의 첫 토큰을 대문자로 뽑는다. 뽑지 못하면 NULL 이다.
   - `api_path` = 드라이버 토큰(`postgres`·`mysql`). SQL 본문 파싱을 피하고 개인정보가 직접 드러나지 않게 한다. 드라이버가 늘면 같은 토큰 목록을 넓힌다.
9. **포트 라우팅**: 정상 종료는 `port: 'success'`, 그 밖의 모든 실패(쿼리 throw·자격 증명 누락·통합 해소 실패 등)는 `port: 'error'` 다(D4).

### 풀 캐시 무효화

풀 캐시는 인스턴스마다 따로 있는 메모리 캐시다. 자격 증명이 교체(`IntegrationsService.rotate`)되거나 통합이 삭제(`remove`)되면 작업한 인스턴스는 자기 캐시만 고칠 수 있다. 다른 인스턴스의 풀에는 교체 전 자격 증명으로 맺은 유휴 연결이 남는다. 침해 대응(교체한 자격 증명을 즉시 막기)에서는 이 잔존 시간이 MTTR 공백이다.

- `IntegrationsService` 는 해당 integrationId 를 Redis pub/sub 채널 `integration:cache:invalidate` 로 방송한다. 모든 인스턴스의 구독자가 그 풀을 즉시 버리고, 다음 쿼리는 새 자격 증명으로 풀을 다시 만든다.
- 방송 트리거는 `rotate` 와 `remove` 두 동기 경로뿐이다. `update` 는 이름만 바꾸므로 자격 증명이 그대로다. OAuth 토큰 갱신과 통합 재인증은 DB·이메일처럼 풀 캐시를 쓰는 노드가 OAuth 자격 증명을 쓰지 않으므로(구독자가 없음) 방송하지 않는다.
- 방송은 즉시성을 보강하는 best-effort 층이다. Redis 가 잠시 끊겨도 자격 증명 해시 비교가 다음 실행에서 옛 풀을 교체하므로 안전하게 저하된다. 방송 실패는 경고 로그만 남기고 삼킨다.
- 채널 페이로드는 integrationId 평문 문자열이다. 채널은 특정 노드에 묶이지 않아서 인스턴스마다 자격 증명을 캐시하는 다른 소비자(예: Send Email transport)도 같은 방식으로 구독할 수 있다.
- 공유 Redis 연결은 명령 전용(SUBSCRIBE 미사용)이라 그대로 두고 구독은 전용 복제 연결로 분리한다. PUBLISH 는 일반 명령이라 공유 연결로 보낸다.

### dry-run

이 노드는 dry-run 을 지원하는 부수효과 노드다(`metadata.supportsDryRun=true`, [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md)). 설정 검증과 에코 직후, DB 연결을 열기 전에 **쓰기 작업만** mock 으로 끝낸다.

- `queryType` 이 `insert`·`update`·`delete` 이면 쓰기로 본다.
- `queryType` 이 `raw` 거나 없으면 SQL 첫 토큰이 쓰기 동사 목록(`INSERT`·`UPDATE`·`DELETE`·`UPSERT`·`MERGE`·`REPLACE`·`TRUNCATE`·`DROP`·`CREATE`·`ALTER`·`GRANT`·`REVOKE`)에 있을 때 쓰기로 본다.
- 판정이 모호하면 읽기로 보고 실제로 실행한다(재현성 우선).
- 읽기(SELECT)는 dry-run 에서도 실제로 실행한다. 부수효과가 없기 때문이다.
- mock 경로는 풀 연결을 절대 부르지 않고 `port: 'success'` 와 `buildDryRunMock('database_query', { operation, sqlPreview })` 로 흐른다. `sqlPreview` 는 SQL 앞 약 200자이며 바인딩 값은 넣지 않는다.

### 사설망 차단

자격 증명 충족 검증 직후, 풀 연결 전에 `credentials.host` 를 검사한다(`assertSafeOutboundHostResolved`). 사설(RFC1918)·loopback·link-local·CGNAT·IPv6 사설 대역으로 해석되면 막고 `DB_HOST_BLOCKED` 로 에러 포트에 보낸다. 셀프 호스팅(예: VPC 안 RDS, 내부 DB)은 `ALLOW_PRIVATE_HOST_TARGETS=true` 로 해제한다. 메커니즘과 플래그는 HTTP Request·Send Email 노드와 같으며 [통합 노드 공통](CLE-NODE-INT-COMMON.md) 사설망 차단 절이 정한다. 클라이언트에 나가는 메시지는 차단된 호스트·IP 를 담지 않는 일반화 문구다. 원본 상세를 어디에 남기는지는 정의가 갈린다. [미결 사항](#미결-사항) 참조.

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

`rowCount` 는 형식상 메트릭이지만 워크플로우 분기(`rowCount > 0`)의 판단 재료로 쓰이므로 `output` 에 둔다(노드 출력 규약 Principle 1 의 실용적 해석, Principle 8.2 표). `meta` 에 복제하지 않는다. 같은 값이 두 곳에 있으면 일관성을 해친다.

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

연결 끊김·타임아웃:

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

제약 위반(unique·FK·NOT NULL):

```json
{
  "config": { "integrationId": "int_pg_1", "query": "INSERT INTO users(id) VALUES ($1)", "queryType": "insert", "parameters": ["u_1"] },
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

권한 부족:

```json
{
  "config": { "integrationId": "int_pg_1", "query": "SELECT * FROM secret_table", "queryType": "select", "parameters": [] },
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
| `config.*` | 정상 케이스와 같음 | 설정 에코 | 자격 증명은 에코하지 않고 `integrationId` 만 |
| `output.error.code` | enum | 핸들러 반환 | `DB_QUERY_FAILED` / `DB_CONNECTION_ERROR` / `DB_CONSTRAINT_VIOLATION` / `DB_PERMISSION_DENIED` / `DB_HOST_BLOCKED`, 또는 [통합 노드 공통](CLE-NODE-INT-COMMON.md)의 `IntegrationError` 코드(예: `INTEGRATION_NOT_CONNECTED`). UPPER_SNAKE_CASE |
| `output.error.message` | string | 핸들러 반환 | 드라이버 원문 메시지. `sanitizeMessage` 로 password·secret 토큰을 가린 뒤 내보낸다 |
| `output.error.details` | object? | 핸들러 반환 | 드라이버 native 코드 등(예: PostgreSQL SQLSTATE `{ driverCode: "23505" }`, MySQL `{ driverCode: "ER_DUP_ENTRY" }`). 매핑할 수 있으면 항상 넣는다 |
| `meta.durationMs` | number | 핸들러 반환 | 실패까지 걸린 시간(ms) |
| `port` | `'error'` | 핸들러 반환 | 런타임 실패 분기 |

표현식 접근 예:

- `$node["X"].output.error.code === "DB_QUERY_FAILED"` → 일반 쿼리 실패 분기
- `$node["X"].output.error.code === "DB_CONNECTION_ERROR"` → 연결 끊김·타임아웃 분기(재시도 후보)
- `$node["X"].output.error.code === "DB_CONSTRAINT_VIOLATION"` → 제약 위반 분기(영구 에러)
- `$node["X"].output.error.code === "DB_PERMISSION_DENIED"` → 권한 부족 분기(영구 에러)
- `$node["X"].output.error.code === "INTEGRATION_NOT_CONNECTED"` → 통합 상태 분기
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

## 캔버스 요약

[통합 노드 공통](CLE-NODE-INT-COMMON.md) 캔버스 요약 표의 Database Query 행을 따른다. `summaryTemplate` 은 `{{queryType|upper}} · {{query}}` 이고 렌더된 한 줄을 40자에서 자른다. DSL 이 줄 분리를 지원하지 않아 "첫 줄" 대신 전체 쿼리를 잘라 보인다. 참조하던 통합이 삭제되면 `⚠ Missing integration` 배지를 붙인다.

예시:

- `SELECT · SELECT id, name FROM users WH…`
- `INSERT · INSERT INTO logs (msg) VALUES…`

## 미결 사항

- **사설망 차단 원본 상세를 남기는 위치**: 이 노드 원문은 차단 상세(원본 호스트)를 "서버 활동 로그(`logUsage`)" 에만 남긴다고 적는다. [HTTP Request 노드](CLE-NODE-HTTP.md)는 활동 로그가 사용자에게 그대로 나가므로 활동 로그에도 일반화 문구만 남긴다고 적는다. 두 쪽과 현재 구현은 [통합 노드 공통 미결 사항](CLE-NODE-INT-COMMON.md#미결-사항)에 정리했다. 결정 필요.

## 구현 위치

- `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts`
- `codebase/backend/src/nodes/integration/database-query/database-query.schema.ts`
- `codebase/backend/src/common/redis/integration-cache-bus.service.ts` (풀 캐시 무효화 pub/sub)

## Rationale

### `DB_HOST_BLOCKED` 전용 차단 코드 (2026-06-12, refactor 04 C-3 후속)

이전에는 DB 호스트 차단이 공용 가드의 일반 `Error` 로 던져져 `mapDbError` fallback 인 `INTEGRATION_CALL_FAILED` 로 나왔다. HTTP Request(`HTTP_BLOCKED`)와 Send Email(`EMAIL_HOST_BLOCKED`)은 각자 전용 코드가 있어서 비대칭이었다. 그래서 워크플로우 작성자가 "사설망 차단" 을 다른 통합 실패와 구분해 분기할 수 없었다. 세 노드의 차단 동작을 일관되게 드러내려고 전용 코드 `DB_HOST_BLOCKED` 를 새로 만들었다. 핸들러가 공용 가드의 일반 에러를 잡아 `IntegrationError('DB_HOST_BLOCKED')` 로 올린다(`EMAIL_HOST_BLOCKED` 패턴과 대칭).

- 메시지 일반화: 클라이언트에 나가는 메시지에는 차단된 호스트·IP 를 넣지 않는다(정찰 면 축소). Send Email 과 같은 원칙이다. HTTP Request 도 2026-07-05 에 같은 일반화를 마쳤다.
- 해제 플래그 재사용: 별도 플래그를 만들지 않고 `ALLOW_PRIVATE_HOST_TARGETS` 를 재사용한다. 통합 노드 전체의 보안 자세(기본 차단, 셀프 호스팅만 해제)를 일관되게 유지하기 위해서다.
- 채팅 채널 분류: `DB_HOST_BLOCKED` 는 [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md)의 `DB_*` 매핑에 들어가 `executionFailedInternal` 로 분류된다. 차단은 우리 쪽 정책 결정이므로 내부 실패다.
- 호환성: 차단 케이스의 `output.error.code` 가 `INTEGRATION_CALL_FAILED` 에서 `DB_HOST_BLOCKED` 로 바뀌었다. 이 경우를 일반 코드로 분기하던 저장된 워크플로우에는 breaking 이다. 영향 범위는 "DB 사설망 차단" 이라는 드문 경로에 한정된다.

### 풀 캐시 무효화에 Redis pub/sub 방송 채택 (2026-06-11, refactor 04 m-4)

단일 프로세스에서는 자격 증명이 바뀌면 다음 쿼리가 해시 불일치를 감지해 옛 풀을 교체하므로 충분하다. 여러 인스턴스로 배포하면 다른 인스턴스의 풀에 교체된 자격 증명의 유휴 연결이 `POOL_IDLE_TIMEOUT_MS`(30초) 또는 다음 쿼리까지 남는다. 침해 대응에서는 이 창이 MTTR 공백이다.

채택안(옵션 A)은 `IntegrationsService` 가 자격 증명이 바뀐 통합 id 를 `integration:cache:invalidate` 로 publish 하고 모든 인스턴스가 즉시 풀을 버리는 방식이다. 교체 즉시 모든 인스턴스에서 옛 연결이 사라져 MTTR 이 가장 짧다. 방송은 즉시성 보강 층일 뿐이라 유실돼도 해시 비교가 정합성을 지킨다.

기각한 대안(옵션 B, `POOL_IDLE_TIMEOUT_MS` 낮추기): 시간 기반 완화일 뿐 즉시성이 없고, 낮출수록 연결 churn 이 늘어 풀 캐시의 존재 이유(연결 재사용)와 부딪힌다. 활성 사용 중인 연결은 유휴 타이머에 걸리지도 않는다.

실행 엔진은 유실되면 실행이 멈추는 재개 신호를 옛 Redis pub/sub 에서 BullMQ 영속 큐로 옮겼다([실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md) Rationale). 이 채널은 그 결정과 부딪히지 않는다. 재개 신호는 내구성이 필요해 큐가 맞고, 캐시 무효화는 유실돼도 해시 비교로 정합성이 보장되는 best-effort 라 가벼운 pub/sub 가 맞다. 목적과 허용 의미(at-most-once 대 at-least-once)가 다르다.
