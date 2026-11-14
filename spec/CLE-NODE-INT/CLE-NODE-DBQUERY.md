---
id: "CLE-NODE-DBQUERY"
title: "Database Query 노드"
type: "feature"
version: 7
status: "approved"
requirements: ["REQ-DBQ-001", "REQ-DBQ-002", "REQ-DBQ-003", "REQ-DBQ-004", "REQ-DBQ-005", "REQ-DBQ-006", "REQ-DBQ-007", "REQ-DBQ-008", "REQ-DBQ-009", "REQ-DBQ-010", "REQ-DBQ-011", "REQ-DBQ-012", "REQ-DBQ-013", "REQ-DBQ-014", "REQ-DBQ-015", "REQ-DBQ-016", "REQ-DBQ-017", "REQ-DBQ-018", "REQ-DBQ-019", "REQ-DBQ-020", "REQ-DBQ-021", "REQ-DBQ-022", "REQ-DBQ-023", "REQ-DBQ-024", "REQ-DBQ-025", "REQ-DBQ-026", "REQ-DBQ-027", "REQ-DBQ-028", "REQ-DBQ-029"]
basis_superseded: false
parent: "CLE-NODE-INT"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT"]
area: "CLE-NODE-INT"
content_hash: "dc516d5321bf4c33991317948a54db5793708b0a99813af4b7e6b3a57bcd7ed8"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/4-nodes/4-integration/2-database-query.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "135a25e35473e0eb591b34133c9ffc47fcab91a0438fb8c00b766b81d8383577"
etag: "sha256-4e6d21cbefcac4004a5c9c4b89cea78dfc83e0f4ecad8838d0bb146c887a125a"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/4-integration/2-database-query.md`, `spec/4-nodes/_product-overview.md` (§7.2) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Database Query 노드(`database_query`)는 외부 데이터베이스에 SQL 을 실행해 데이터를 조회하거나 조작하는 범용 통합 노드다. PostgreSQL 과 MySQL 드라이버를 모두 지원한다. 실행 결과는 `success` 포트로, 런타임 실패(구문 에러, 연결 끊김, 제약 위반 등)는 `error` 포트로 나간다.

통합 참조, 핸들러 6단계 계약, 공통 에러 코드, 사설망 차단 정책, 캔버스 요약은 [통합 노드 공통](CLE-NODE-INT-COMMON.md)이 정한다. 데이터베이스 통합의 자격 증명 스키마(`driver`, `host`, `ssl` 등)는 [서비스별 인증 방식과 자격 증명](../CLE-INT/CLE-INT-AUTH.md)에서 정한다. 이 문서는 노드의 설정·실행을 정하고, 출력·에러는 하위 문서가 정한다.

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
- REQ-DBQ-013 WHEN 통합의 자격 증명이 교체(`rotate`)되거나 통합이 삭제되면 THE SYSTEM SHALL 모든 인스턴스가 캐시한 그 통합의 풀을 바로 버리게 한다. 무효화 방송의 채널과 발행 시점은 [통합 데이터와 흐름 「자격 증명 캐시 무효화」](../CLE-INT/CLE-INT-DATA.md#자격-증명-캐시-무효화) 가 정한다.
- REQ-DBQ-014 IF 무효화 방송이 실패하거나 이 인스턴스에 닿지 않으면 THE SYSTEM SHALL 다음 실행에서 자격 증명 해시를 비교해 옛 풀을 교체한다. 방송 실패를 기록하는 방식은 [통합 데이터와 흐름 「자격 증명 캐시 무효화」](../CLE-INT/CLE-INT-DATA.md#자격-증명-캐시-무효화) 가 정한다.
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
- REQ-DBQ-027 WHEN 통합을 얻은 뒤 실행이 끝나면 THE SYSTEM SHALL 성공·실패와 관계없이 활동 로그를 1건 남긴다.
- REQ-DBQ-028 WHEN 활동 로그를 남기면 THE SYSTEM SHALL `api_label` 을 NULL, `api_method` 를 SQL 동사, `api_path` 를 드라이버 토큰으로 채운다.
- REQ-DBQ-029 IF 설정 형식이 잘못되면 THE SYSTEM SHALL 사전 검증 에러로 실행을 실패시킨다.

## 하위 문서

- [Database Query 노드 — 출력 구조와 에러 코드](CLE-NODE-DBQUERY-OUTPUT.md): `success` · `error` 포트 출력 형태와 필드, 사전 검증 · 런타임 에러 코드와 드라이버 코드 매핑, `DB_HOST_BLOCKED` 결정 근거. 요구사항: REQ-DBQ-004, REQ-DBQ-005, REQ-DBQ-008, REQ-DBQ-009, REQ-DBQ-010, REQ-DBQ-017, REQ-DBQ-018, REQ-DBQ-022, REQ-DBQ-023, REQ-DBQ-024, REQ-DBQ-029

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

동적 포트는 없다. 자격 증명 누락, `INVALID_PARAMETERS`, 통합 해소 실패를 포함한 모든 실행 중 실패가 `error` 포트로 간다(D4).

## 실행 로직

[통합 노드 공통](CLE-NODE-INT-COMMON.md)의 6단계 계약을 따른다. 노드 고유 동작은 다음과 같다.

0. **취소 확인**: 실행에 들어올 때 `context.abortSignal?.aborted` 면 즉시 `AbortError`(`err.name='AbortError'`)를 던진다. `cancel-others-on-fail` 등으로 이미 취소된 뒤 dispatch 된 경우다. 진행 중 abort 가 오면 **별도 풀 연결**로 PostgreSQL `SELECT pg_cancel_backend(<pid>)` 나 MySQL `KILL QUERY <threadId>` 를 보내 진행 중인 쿼리만 끊는다(연결은 유지). 취소로 생긴 드라이버 에러(PostgreSQL `57014`, MySQL `ER_QUERY_INTERRUPTED`)는 catch 에서 `AbortError` 로 다시 던져 `cancelled` 로 분류되게 한다([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md)). best-effort 다. 취소 권한과 타이밍에 따라 실패해도 해는 없다. 정상 완료되면 리스너를 해제한다.
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
8. **활동 로그 기록**: 통합을 얻은 뒤(`getForExecution` 이 성공한 뒤)에는 성공·실패와 관계없이 `logUsage` 를 부른다(인자는 [통합 노드 공통](CLE-NODE-INT-COMMON.md#integrationsservice-api-실행-엔진용)). 통합을 얻기 전에 끝난 실패는 남기지 않는다([통합 노드 공통](CLE-NODE-INT-COMMON.md#공통-에러-코드)). API 식별 정보는 다음과 같다(통합별 전체 표는 [통합 데이터와 흐름 「호출 API 식별 채우기 규칙」](../CLE-INT/CLE-INT-DATA.md#호출-api-식별-채우기-규칙)).
   - `api_label` = NULL. 임의 SQL 을 부르므로 엔드포인트 카탈로그가 없다.
   - `api_method` = SQL 동사(`SELECT`·`INSERT`·`UPDATE`·`DELETE`). `config.queryType` 을 대문자로 그대로 쓴다. `queryType='raw'` 이면 평가된 SQL 의 첫 토큰을 대문자로 뽑는다. 뽑지 못하면 NULL 이다.
   - `api_path` = 드라이버 토큰(`postgres`·`mysql`). SQL 본문 파싱을 피하고 개인정보가 드러나지 않게 한다. 드라이버가 늘면 토큰 목록을 넓힌다.
9. **포트 라우팅**: 정상 종료는 `port: 'success'`, 그 밖의 모든 실패(쿼리 throw·자격 증명 누락·통합 해소 실패 등)는 `port: 'error'` 다(D4).

### 풀 캐시 무효화

풀 캐시는 인스턴스마다 따로 있는 메모리 캐시라 다른 인스턴스의 풀에는 교체 전 자격 증명으로 맺은 유휴 연결이 남는다(근거는 [Rationale](#풀-캐시-무효화에-redis-pubsub-방송-채택-2026-06-11-refactor-04-m-4)). 그래서 이 노드는 자격 증명 캐시 무효화 방송을 구독한다. 채널, 발행 시점, 페이로드, 방송 실패 처리는 [통합 데이터와 흐름 「자격 증명 캐시 무효화」](../CLE-INT/CLE-INT-DATA.md#자격-증명-캐시-무효화) 가 정한다. 이 절은 풀이 방송을 받았을 때 하는 일만 정한다.

- 핸들러는 생성될 때 무효화 버스(`IntegrationCacheBus`)에 처리 함수 하나를 등록한다.
- 방송으로 통합 ID 를 받으면 그 통합의 풀을 캐시에서 빼고 닫는다(`invalidatePool`). 캐시에 그 통합의 풀이 없으면 아무것도 하지 않는다. 풀을 닫다가 난 오류는 무시한다.
- 다음 쿼리는 새 자격 증명으로 풀을 다시 만든다.
- 방송을 받지 못해도 2단계의 자격 증명 해시 비교가 다음 실행에서 옛 풀을 교체한다(REQ-DBQ-012 · 014). 무효화 버스를 주입받지 못한 핸들러(테스트 fixture 등)는 이 비교로만 풀을 교체한다.

### dry-run

이 노드는 dry-run 을 지원하는 부수효과 노드다(`metadata.supportsDryRun=true`, [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md)). 설정 검증과 에코 직후, DB 연결을 열기 전에 **쓰기 작업만** mock 으로 끝낸다.

- `queryType` 이 `insert`·`update`·`delete` 이면 쓰기로 본다.
- `queryType` 이 `raw` 거나 없으면 SQL 첫 토큰이 쓰기 동사 목록(`INSERT`·`UPDATE`·`DELETE`·`UPSERT`·`MERGE`·`REPLACE`·`TRUNCATE`·`DROP`·`CREATE`·`ALTER`·`GRANT`·`REVOKE`)에 있을 때 쓰기로 본다.
- 판정이 모호하면 읽기로 보고 실제로 실행한다(재현성 우선).
- 읽기(SELECT)는 부수효과가 없어 dry-run 에서도 실제로 실행한다.
- mock 경로는 풀 연결을 절대 부르지 않고 `port: 'success'` 와 `buildDryRunMock('database_query', { operation, sqlPreview })` 로 흐른다. `sqlPreview` 는 SQL 앞 약 200자이며 바인딩 값은 넣지 않는다.

### 사설망 차단

자격 증명 충족 검증 직후, 풀 연결 전에 `credentials.host` 를 검사한다(`assertSafeOutboundHostResolved`). 사설(RFC1918)·loopback·link-local·CGNAT·IPv6 사설 대역으로 해석되면 막고 `DB_HOST_BLOCKED` 로 에러 포트에 보낸다. 셀프 호스팅(예: VPC 안 RDS, 내부 DB)은 `ALLOW_PRIVATE_HOST_TARGETS=true` 로 해제한다. 메커니즘과 플래그는 HTTP Request·Send Email 노드와 같으며 [통합 노드 공통](CLE-NODE-INT-COMMON.md) 사설망 차단 절이 정한다. 클라이언트 메시지는 차단된 호스트·IP 를 담지 않는 일반화 문구다. 원본 상세를 남기는 위치는 [미결 사항](#미결-사항) 참조.

## 에러 코드

출력 구조(정상 `success` · 런타임 에러 `error`)와 에러 코드 분류는 하위 문서가 정한다. → [Database Query 노드 — 출력 구조와 에러 코드](CLE-NODE-DBQUERY-OUTPUT.md#에러-코드)

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
- `codebase/backend/src/common/redis/integration-cache-bus.service.ts` (무효화 버스. 이 노드는 처리 함수를 등록해 구독한다. 채널 정의는 [통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md#자격-증명-캐시-무효화))

## Rationale

### 풀 캐시 무효화에 Redis pub/sub 방송 채택 (2026-06-11, refactor 04 m-4)

단일 프로세스에서는 자격 증명이 바뀌면 다음 쿼리가 해시 불일치를 감지해 옛 풀을 교체하므로 충분하다. 여러 인스턴스로 배포하면 다른 인스턴스의 풀에 교체된 자격 증명의 유휴 연결이 `POOL_IDLE_TIMEOUT_MS`(30초) 또는 다음 쿼리까지 남는다. 침해 대응에서는 이 창이 MTTR 공백이다.

채택안(옵션 A)은 `IntegrationsService` 가 자격 증명이 바뀐 통합 id 를 `integration:cache:invalidate` 로 publish 하고 모든 인스턴스가 즉시 풀을 버리는 방식이다(채널 정의는 [통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md#자격-증명-캐시-무효화)). 교체 즉시 모든 인스턴스에서 옛 연결이 사라져 MTTR 이 가장 짧다. 방송은 즉시성 보강 층일 뿐이라 유실돼도 해시 비교가 정합성을 지킨다.

기각한 대안(옵션 B, `POOL_IDLE_TIMEOUT_MS` 낮추기): 시간 기반 완화일 뿐 즉시성이 없고, 낮출수록 연결 churn 이 늘어 풀 캐시의 존재 이유(연결 재사용)와 부딪힌다. 활성 사용 중인 연결은 유휴 타이머에 걸리지도 않는다.

실행 엔진은 유실되면 실행이 멈추는 재개 신호를 옛 Redis pub/sub 에서 BullMQ 영속 큐로 옮겼다([실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md) Rationale). 이 채널은 그 결정과 부딪히지 않는다. 재개 신호는 내구성이 필요해 큐가 맞고, 캐시 무효화는 유실돼도 해시 비교로 정합성이 보장되는 best-effort 라 가벼운 pub/sub 가 맞다. 목적과 허용 의미(at-most-once 대 at-least-once)가 다르다.

### 통합을 얻기 전에 끝난 실패는 활동 로그에 남기지 않는다 (2026-10-24)

규칙과 근거는 [통합 노드 공통](CLE-NODE-INT-COMMON.md#남의-개인-통합-조회는-없는-통합과-같게-실패한다-2026-10-24) Rationale 에 있다(REQ-INTMGMT-053).

- 요구사항 변경: REQ-DBQ-027 은 «실행이 끝나면» 에서 «통합을 얻은 뒤 실행이 끝나면» 으로 범위를 좁혔다.

### 풀 캐시 무효화 채널의 정본을 통합 데이터와 흐름으로 옮겼다 (2026-11-13)

사람이 정했다(NERV Task `CLE-T-VQX844`). `integration:cache:invalidate` 채널은 이 노드만의 것이 아니고 통합 모듈이 발행한다. 채널을 구독하는 노드가 늘면 노드마다 발행 시점 · 페이로드 · 연결 분리 · 방송 실패 처리를 다시 적게 된다. 그래서 채널 정의를 [통합 데이터와 흐름 「자격 증명 캐시 무효화」](../CLE-INT/CLE-INT-DATA.md#자격-증명-캐시-무효화) 로 옮기고 이 문서의 「풀 캐시 무효화」 에는 풀이 방송을 받았을 때 하는 일만 남겼다.

- 방송 트리거는 `rotate` 와 통합 삭제 전체다. 삭제 쪽 발행은 삭제 뒤 후처리가 하므로 멤버가 나가거나 제거될 때의 개인 통합 삭제도 방송한다. 지금 구독하는 소비자는 이 노드의 풀뿐이다.
- 요구사항 변경: REQ-DBQ-013 은 결과(모든 인스턴스가 그 통합의 풀을 버린다)만 남기고 채널은 통합 데이터와 흐름을 가리키게 했고, 트리거를 «통합이 삭제(`remove`)되면» 에서 «통합이 삭제되면» 으로 넓혔다. REQ-DBQ-014 는 «무효화 방송이 실패하거나 이 인스턴스에 닿지 않으면» 으로 고쳤다. 경고 로그와 실패 계수는 발행하는 쪽의 동작이라 통합 데이터와 흐름이 정한다. 동작은 바뀌지 않았다.
