---
id: "CLE-NODE-DBQUERY"
title: "Database Query 노드"
type: "feature"
version: 12
status: "approved"
requirements: ["REQ-DBQ-001", "REQ-DBQ-002", "REQ-DBQ-003", "REQ-DBQ-004", "REQ-DBQ-005", "REQ-DBQ-006", "REQ-DBQ-007", "REQ-DBQ-008", "REQ-DBQ-009", "REQ-DBQ-010", "REQ-DBQ-011", "REQ-DBQ-012", "REQ-DBQ-013", "REQ-DBQ-014", "REQ-DBQ-015", "REQ-DBQ-016", "REQ-DBQ-017", "REQ-DBQ-018", "REQ-DBQ-019", "REQ-DBQ-020", "REQ-DBQ-021", "REQ-DBQ-022", "REQ-DBQ-023", "REQ-DBQ-024", "REQ-DBQ-025", "REQ-DBQ-026", "REQ-DBQ-027", "REQ-DBQ-028", "REQ-DBQ-029", "REQ-DBQ-030", "REQ-DBQ-031", "REQ-DBQ-032"]
basis_superseded: false
parent: "CLE-NODE-INT"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT"]
area: "CLE-NODE-INT"
content_hash: "a3cf0dc67d5fa9574a6c1586be2a3639ea702d2a99c5202d8920e67c91ababaa"
read_as: "approved_fallback"
task: "CLE-T-3M0KRA"
source_paths: ["spec/4-nodes/4-integration/2-database-query.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "be27fb9a800b85980565d0d6cf46b95857c2bc28390c44710232a844db82e96b"
etag: "sha256-770dbe9a4ff3cef3484a65ea4ce6f5341d0bc73242d275c5d26b4d8a23eca3de"
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
- REQ-DBQ-018 IF 사설망 차단 가드가 차단 판정이 아닌 오류를 던지면 THE SYSTEM SHALL `INTEGRATION_CALL_FAILED` 와 고정 문구 `The outbound address check failed.` 로 에러 포트에 내보내고 원문은 서버 경고 로그에만 남긴다.
- REQ-DBQ-019 WHEN 실행에 들어올 때 `context.abortSignal` 이 이미 취소 상태면 THE SYSTEM SHALL 즉시 `AbortError` 를 던진다.
- REQ-DBQ-020 WHEN 쿼리가 도는 중에 취소 신호가 오면 THE SYSTEM SHALL 별도 연결로 PostgreSQL `pg_cancel_backend` 나 MySQL `KILL QUERY` 를 보내 진행 중인 쿼리만 끊는다.
- REQ-DBQ-021 WHEN 취소 때문에 드라이버 에러(PostgreSQL `57014`, MySQL `ER_QUERY_INTERRUPTED`)가 나면 THE SYSTEM SHALL 이를 `AbortError` 로 다시 던져 노드 실행이 `cancelled` 로 분류되게 한다.
- REQ-DBQ-022 WHEN 쿼리가 실패하면 THE SYSTEM SHALL 드라이버 코드를 `DB_QUERY_FAILED`·`DB_CONNECTION_ERROR`·`DB_CONSTRAINT_VIOLATION`·`DB_PERMISSION_DENIED` 중 하나로 분류해 에러 포트에 내보낸다.
- REQ-DBQ-023 WHEN 드라이버가 native 에러 코드를 주면 THE SYSTEM SHALL 그 값을 `output.error.details.driverCode` 에 담는다.
- REQ-DBQ-024 WHEN 에러 메시지를 내보내거나 활동 로그에 남기면 THE SYSTEM SHALL 비밀번호·Bearer·긴 토큰 패턴을 가린다.
- REQ-DBQ-025 WHEN dry-run 으로 실행되고 쿼리가 쓰기 작업이거나 쓰기 여부를 판정할 수 없으면 THE SYSTEM SHALL DB 에 연결하지 않고 mock 결과로 `success` 포트에 보낸다.
- REQ-DBQ-026 WHEN dry-run 으로 실행되고 쿼리가 읽기 작업이면 THE SYSTEM SHALL 쿼리를 실제로 실행한다.
- REQ-DBQ-027 WHEN 통합을 얻은 뒤 실행이 끝나면 THE SYSTEM SHALL 성공·실패와 관계없이 활동 로그를 1건 남긴다. 실행 취소로 끝난 호출은 활동 로그를 남기지 않고 `AbortError` 를 그대로 던져 노드가 `cancelled` 로 끝난다([통합 노드 공통 규칙 7](CLE-NODE-INT-COMMON.md#규칙), [노드 취소 규칙 3](../CLE-EXEC/CLE-EXEC-CANCEL.md#노드-핸들러-의무)). dry-run 재실행의 모의 출력은 활동 로그를 남기지 않는다([부수효과 판정](../CLE-EXEC/CLE-EXEC-RERUN-DRYRUN.md#부수효과-판정)).
- REQ-DBQ-028 WHEN 활동 로그를 남기면 THE SYSTEM SHALL `api_label` 을 NULL, `api_method` 를 SQL 동사, `api_path` 를 드라이버 토큰으로 채운다.
- REQ-DBQ-029 IF 설정 형식이 잘못되면 THE SYSTEM SHALL 사전 검증 에러로 실행을 실패시킨다.
- REQ-DBQ-030 WHEN 노드 실행의 풀이나 진행 중 쿼리를 끊는 일회성 연결이 데이터베이스에 새 연결을 맺으면 THE SYSTEM SHALL 연결할 때 푼 주소를 사설망 차단 대역표로 다시 판정하고 통과한 주소로만 연결한다.
- REQ-DBQ-031 IF 연결 시점 판정이 쿼리를 실행할 연결을 막으면 THE SYSTEM SHALL `DB_HOST_BLOCKED` 와 고정 문구 `Database host resolves to a private/loopback address blocked by SSRF policy.` 로 에러 포트에 내보낸다.
- REQ-DBQ-032 WHEN 사설망 차단이 연결을 막으면 THE SYSTEM SHALL 차단된 host · IP 원문을 서버 경고 로그에만 남기고 노드 에러와 활동 로그에는 싣지 않는다.

## 하위 문서

- [Database Query 노드 — 출력 구조와 에러 코드](CLE-NODE-DBQUERY-OUTPUT.md): `success` · `error` 포트 출력 형태와 필드, 사전 검증 · 런타임 에러 코드와 드라이버 코드 매핑, `DB_HOST_BLOCKED` 결정 근거. 요구사항: REQ-DBQ-004, REQ-DBQ-005, REQ-DBQ-008, REQ-DBQ-009, REQ-DBQ-010, REQ-DBQ-017, REQ-DBQ-018, REQ-DBQ-022, REQ-DBQ-023, REQ-DBQ-024, REQ-DBQ-029

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `integrationId` | UUID | ✓ | — | DB 통합 참조([통합 노드 공통](CLE-NODE-INT-COMMON.md) 통합 참조) |
| `query` | String (표현식) | ✓ | — | SQL 쿼리. `{{ }}` 템플릿을 쓸 수 있다. 플레이스홀더는 PostgreSQL 방식 `$1`, `$2`, ... |
| `parameters` | Array \| String | | `[]` | `$1`, `$2`, ... 위치 기반 바인딩 값. JSON 배열 문자열(예: `'["v1", 2]'`)도 받는다 |
| `queryType` | Enum | ✓ | `select` | `select` / `insert` / `update` / `delete` / `raw`. 감사·UI 힌트다. dry-run 판정은 `insert`·`update`·`delete` 만 쓰기 신호로 쓰고 `select`·`raw` 는 SQL 첫 동사로 가린다([dry-run](#dry-run)) |

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

동적 포트는 없다. 자격 증명 누락, `INVALID_PARAMETERS`, 통합 해소 실패를 포함한 모든 실행 중 실패가 `error` 포트로 간다(D4). 실행 취소로 생긴 `AbortError` 는 예외다. 어느 포트로도 나가지 않고 노드가 `cancelled` 로 끝난다([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md)).

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
8. **활동 로그 기록**: 통합을 얻은 뒤(`getForExecution` 이 성공한 뒤)에는 성공·실패와 관계없이 `logUsage` 를 부른다(인자는 [통합 노드 공통](CLE-NODE-INT-COMMON.md#integrationsservice-api-실행-엔진용)). 통합을 얻기 전에 끝난 실패는 남기지 않는다([통합 노드 공통](CLE-NODE-INT-COMMON.md#공통-에러-코드)). 실행 취소로 끝난 호출도 남기지 않는다. catch 첫머리에서 `isAbortErrorLike` 로 `AbortError` 인지 보고, 맞으면 `logUsage` 를 부르지 않고 그대로 다시 던진다. 0단계에서 드라이버 에러를 바꾼 `AbortError` 도 같다. 엔진이 노드를 `cancelled` 로 기록한다. API 식별 정보는 다음과 같다(통합별 전체 표는 [통합 데이터와 흐름 「호출 API 식별 채우기 규칙」](../CLE-INT/CLE-INT-DATA.md#호출-api-식별-채우기-규칙)).
   - `api_label` = NULL. 임의 SQL 을 부르므로 엔드포인트 카탈로그가 없다.
   - `api_method` = SQL 동사(`SELECT`·`INSERT`·`UPDATE`·`DELETE`). `config.queryType` 을 대문자로 그대로 쓴다. `queryType='raw'` 이면 평가된 SQL 의 첫 토큰을 대문자로 뽑는다. 뽑지 못하면 NULL 이다.
   - `api_path` = 드라이버 토큰(`postgres`·`mysql`). SQL 본문 파싱을 피하고 개인정보가 드러나지 않게 한다. 드라이버가 늘면 토큰 목록을 넓힌다.
9. **포트 라우팅**: 정상 종료는 `port: 'success'`, 그 밖의 모든 실패(쿼리 throw·자격 증명 누락·통합 해소 실패 등)는 `port: 'error'` 다(D4). 실행 취소로 생긴 `AbortError` 는 포트로 보내지 않고 다시 던진다(8단계).

### 풀 캐시 무효화

풀 캐시는 인스턴스마다 따로 있는 메모리 캐시라 다른 인스턴스의 풀에는 교체 전 자격 증명으로 맺은 유휴 연결이 남는다(근거는 [Rationale](#풀-캐시-무효화에-redis-pubsub-방송-채택-2026-06-11-refactor-04-m-4)). 그래서 이 노드는 자격 증명 캐시 무효화 방송을 구독한다. 채널, 발행 시점, 페이로드, 방송 실패 처리는 [통합 데이터와 흐름 「자격 증명 캐시 무효화」](../CLE-INT/CLE-INT-DATA.md#자격-증명-캐시-무효화) 가 정한다. 이 절은 풀이 방송을 받았을 때 하는 일만 정한다.

- 핸들러는 생성될 때 무효화 버스(`IntegrationCacheBus`)에 처리 함수 하나를 등록한다.
- 방송으로 통합 ID 를 받으면 그 통합의 풀을 캐시에서 빼고 닫는다(`invalidatePool`). 캐시에 그 통합의 풀이 없으면 아무것도 하지 않는다. 풀을 닫다가 난 오류는 무시한다.
- 다음 쿼리는 새 자격 증명으로 풀을 다시 만든다.
- 방송을 받지 못해도 2단계의 자격 증명 해시 비교가 다음 실행에서 옛 풀을 교체한다(REQ-DBQ-012 · 014). 무효화 버스를 주입받지 못한 핸들러(테스트 fixture 등)는 이 비교로만 풀을 교체한다.

### dry-run

이 노드는 dry-run 을 지원하는 부수효과 노드다(`metadata.supportsDryRun=true`, [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md)). 설정 검증과 에코 직후, 통합을 얻고 DB 에 연결하기 전에 판정한다. **읽기 작업으로 확인된 쿼리만** 실제로 실행하고 나머지는 mock 으로 끝낸다.

- `queryType` 이 `insert`·`update`·`delete` 이면 SQL 과 관계없이 쓰기로 본다.
- `queryType` 이 `select`·`raw` 거나 없으면 평가된 SQL 의 첫 동사로 가린다.
- 첫 동사를 뽑기 전에 맨 앞 공백과 주석(`-- …` 줄 주석, `/* … */` 블록 주석)을 건너뛴다. 닫히지 않은 블록 주석과 동사 앞의 힌트(`/*+` 로 시작하는 블록 주석)는 판정할 수 없는 쿼리로 본다.
- 문장이 둘 이상이면(문자열 리터럴 · 따옴표 식별자 · 주석 밖의 `;` 뒤에 내용이 더 있으면) 판정할 수 없는 쿼리로 본다. 끝에 붙은 `;` 하나는 문장을 늘리지 않는다.
- 닫히지 않은 따옴표 · 달러 인용은 판정할 수 없는 쿼리다. DB 마다 해석이 갈리는 형태(백슬래시가 든 작은따옴표 리터럴, 큰따옴표 안 백슬래시, 중첩 블록 주석, 공백 없이 붙은 `--`, MySQL 실행 주석 `/*!`)도 문장 경계를 확실히 알 수 없어 판정할 수 없는 쿼리로 본다.
- 드라이버를 모르는 시점이라 같은 SQL 을 PostgreSQL · MySQL 두 방언 규칙으로 한 번씩 읽고 둘 다 읽기 동사 하나로 된 한 문장일 때만 실행한다. MySQL `#` 줄 주석이나 PostgreSQL 달러 인용처럼 한 방언에서만 리터럴 · 주석인 곳에 `;` 가 있으면 mock 이다.
- 첫 동사가 읽기 동사(`SELECT`·`SHOW`·`DESCRIBE`·`DESC`·`VALUES`·`TABLE`)면 읽기로 보고 실제로 실행한다.
- 그 밖은 모두 mock 이다. 쓰기 동사(`INSERT`·`UPDATE`·`DELETE`·`UPSERT`·`MERGE`·`REPLACE`·`TRUNCATE`·`DROP`·`CREATE`·`ALTER`·`GRANT`·`REVOKE`)와 첫 동사로 쓰기 여부를 판정할 수 없는 쿼리(`WITH` CTE, `CALL`, `DO`, `COPY`, `EXPLAIN`, 괄호로 시작하는 쿼리, 빈 쿼리)가 여기 든다. PostgreSQL 의 `EXPLAIN ANALYZE` 는 문장을 실제로 실행하므로 `EXPLAIN` 도 읽기로 보지 않는다. 판정할 근거가 없으면 부수효과로 보는 [부수효과 판정](../CLE-EXEC/CLE-EXEC-RERUN-DRYRUN.md#부수효과-판정)의 공통 규칙과 같다.
- 한계: 첫 동사만 보므로 `SELECT write_func()` 처럼 데이터를 바꾸는 함수를 부르는 SELECT 와 `SELECT … INTO new_table` 은 읽기로 보고 실제로 실행한다.
- mock 경로는 풀 연결을 절대 부르지 않고 `port: 'success'` 와 `buildDryRunMock('database_query', { operation, sqlPreview })` 로 흐른다. `sqlPreview` 는 SQL 앞 약 200자이며 바인딩 값은 넣지 않는다. mock 경로는 활동 로그를 남기지 않는다(REQ-DBQ-027).

### 사설망 차단

막는 대역 · 우회 플래그 · 차단 코드의 공통 규칙은 [통합 노드 공통 — 에러 코드와 사설망 차단 「사설망 차단」](CLE-NODE-INT-COMMON-ERROR.md#사설망-차단) 이 정한다. 대역표의 구현은 `common/utils/ssrf/ip-classifier.ts` 다. 이 노드는 두 번 판정한다.

- **연결 전 검사**: 자격 증명 충족 검증 직후, 풀 연결 전에 `credentials.host` 를 해석해 검사한다(`assertSafeOutboundHostResolved`). IP 리터럴 host 는 이 검사만 판정한다.
- **연결 시점 판정**: 드라이버가 새 연결을 맺을 때 푼 주소를 같은 대역표로 다시 판정한다. pg · mysql2 의 `stream` 팩토리로 소켓을 직접 열고 공용 조회 함수(`safeOutboundLookup`)를 쓴다. 연결 옵션 빌더(`database-connection.ts`) 하나를 노드 실행의 풀, 진행 중 쿼리를 끊는 일회성 연결, [Database 연결 테스트](../CLE-INT/CLE-INT-AUTH.md#database) 가 함께 쓴다. 풀은 새 연결을 맺을 때마다 판정하고 이미 열린 연결은 다시 판정하지 않는다. SSL 매핑(7단계)은 그대로다. TLS 는 드라이버가 그 소켓 위에서 원래 host 이름으로 맺는다.
- **차단되면**: 두 판정 모두 `DB_HOST_BLOCKED` 와 고정 문구 `Database host resolves to a private/loopback address blocked by SSRF policy.` 로 에러 포트에 보낸다. 드라이버가 감싸 올린 오류는 `cause` 사슬에서 판정 오류를 찾는다. 차단된 host · IP 원문은 서버 경고 로그에만 남기고 노드 에러와 활동 로그에는 싣지 않는다. 취소용 연결이 막히면 취소만 실패한다(0단계의 best-effort).
- **가드 고장**: 연결 전 검사가 판정이 아닌 오류로 끝나면 `INTEGRATION_CALL_FAILED` 와 고정 문구 `The outbound address check failed.` 로 에러 포트에 보낸다. 원문은 서버 경고 로그에만 남긴다([출력 구조와 에러 코드](CLE-NODE-DBQUERY-OUTPUT.md#런타임-에러-port-error)).
- 셀프 호스팅(예: VPC 안 RDS, 내부 DB)은 `ALLOW_PRIVATE_HOST_TARGETS=true` 로 두 판정을 함께 끈다. 그러면 드라이버가 기본 연결을 그대로 쓴다. 플래그는 HTTP Request · Send Email 노드와 같다.

## 에러 코드

출력 구조(정상 `success` · 런타임 에러 `error`)와 에러 코드 분류는 하위 문서가 정한다. → [Database Query 노드 — 출력 구조와 에러 코드](CLE-NODE-DBQUERY-OUTPUT.md#에러-코드)

## 캔버스 요약

[통합 노드 공통](CLE-NODE-INT-COMMON.md) 캔버스 요약 표의 Database Query 행을 따른다. `summaryTemplate` 은 `{{queryType|upper}} · {{query}}` 이고 렌더된 한 줄을 40자에서 자른다. DSL 이 줄 분리를 지원하지 않아 "첫 줄" 대신 전체 쿼리를 잘라 보인다. 참조하던 통합이 삭제되면 `⚠ Missing integration` 배지를 붙인다.

예시:

- `SELECT · SELECT id, name FROM users WH…`
- `INSERT · INSERT INTO logs (msg) VALUES…`

## 미결 사항

- **사설망 차단 원본 상세를 남기는 위치**: 이 노드 원문은 차단 상세(원본 호스트)를 "서버 활동 로그(`logUsage`)" 에만 남긴다고 적는다. [HTTP Request 노드](CLE-NODE-HTTP.md)는 활동 로그가 사용자에게 그대로 나가므로 활동 로그에도 일반화 문구만 남긴다고 적는다. 두 쪽과 현재 구현은 [통합 노드 공통 미결 사항](CLE-NODE-INT-COMMON.md#미결-사항)에 정리했다. 결정 필요. 지금 구현은 HTTP Request 노드와 같은 쪽이다. 연결 전 검사와 연결 시점 판정 모두 원문을 서버 경고 로그에만 남긴다(REQ-DBQ-032). 이 항목은 통합 노드 공통의 미결 사항과 함께 닫는다.

## 구현 위치

- `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` (실행 로직. catch 첫머리의 실행 취소 판정과 다시 던지기 포함)
- `codebase/backend/src/nodes/integration/database-query/database-query.schema.ts`
- `codebase/backend/src/nodes/integration/database-query/database-connection.ts` (연결 옵션 빌더와 연결 시점 판정 `stream` 팩토리. 노드 실행 · 취소 연결 · 연결 테스트가 함께 쓴다)
- `codebase/backend/src/common/utils/ssrf/outbound-guard.ts` (연결 전 검사 `assertSafeOutboundHostResolved` 와 연결 시점 판정 `safeOutboundLookup`)
- `codebase/backend/src/nodes/core/abort-error.util.ts` (`AbortError` 공용 판정 `isAbortErrorLike`)
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

### 실행 취소로 끝난 호출은 활동 로그에 남기지 않는다

결정일: 2026-11-19

이전에는 이 노드만 실행 취소 때도 `failed` 활동 로그 1건을 남겼다. catch 가 취소 여부를 보기 전에 `logUsage` 를 불렀기 때문이다. HTTP Request · Cafe24 · MakeShop 노드는 취소된 호출을 남기지 않아 네 노드의 규칙이 달랐다. 취소로 끝난 호출은 끝난 호출이 아니므로 활동 로그를 남기지 않는다. 2026-11-19 에 catch 첫머리에서 취소를 먼저 가려 활동 로그 없이 다시 던지게 고쳤다(NERV Task `CLE-T-GZRYQ3` · `CLE-T-WMH3EK`). 활동 로그 `status` 에 `cancelled` 값은 새로 두지 않았다. 근거 전체는 [노드 취소 Rationale](../CLE-EXEC/CLE-EXEC-CANCEL.md#노드-취소로-끝난-호출은-활동-로그를-남기지-않는다-2026-10-10)에 있다.

- 요구사항 변경: REQ-DBQ-027 에 «실행 취소로 끝난 호출은 활동 로그를 남기지 않고 `AbortError` 를 그대로 던져 노드가 `cancelled` 로 끝난다» 를 더했다.

### dry-run 에서 판정할 수 없는 쿼리는 mock 으로 끝낸다

결정일: 2026-11-19

사람이 정했다(NERV 질문 `01a1f2b8-529a-7479-8631-6e8fc96f5879`, Task `CLE-T-KH11HA`). 이전 규칙에는 구멍이 둘 있었다. `queryType` 이 `select`(기본값)이면 SQL 을 보지 않고 실제로 실행해서, 쿼리 유형을 그대로 두고 `DELETE FROM …` 을 적은 노드는 dry-run 에서도 데이터를 지웠다. 또 첫 동사가 쓰기 목록에 없으면 읽기로 봐서 `WITH … DELETE …` 같은 CTE 도 실제로 실행했다.

이제 `queryType` 이 `select` 여도 SQL 첫 동사를 보고 읽기 동사로 확인된 쿼리만 실제로 실행한다. [부수효과 판정](../CLE-EXEC/CLE-EXEC-RERUN-DRYRUN.md#부수효과-판정)의 공통 규칙에서 이 노드만 빠져 있던 예외도 없앴다.

| 선택지 | 내용 | 결정 |
| --- | --- | --- |
| A | 읽기 동사면 실행하고 쓰기 동사와 판정할 수 없는 쿼리는 모두 mock | 채택 |
| B | A 와 같되 `WITH` 로 시작하는 쿼리는 본문에 쓰기 동사(`INSERT`·`UPDATE`·`DELETE`·`MERGE`)가 단어로 있을 때만 mock | 기각. 읽기 CTE 의 재현성은 지키지만 문자열 리터럴 · 식별자 안의 단어도 쓰기로 잡힌다 |
| C | `select` 우회만 막고 판정이 모호하면 실제로 실행(이전 REQ-DBQ-026) | 기각. `WITH … DELETE` 가 dry-run 에서도 실행된다 |

코드 리뷰에서 `SELECT 1; DELETE FROM t` 같은 다중 문장이 첫 동사만 보면 읽기로 통과한다는 지적이 나왔다(PostgreSQL 은 바인딩 값이 없으면 여러 문장을 한 번에 실행한다). 그래서 다중 문장과 문장 경계를 확실히 알 수 없는 쿼리도 판정할 수 없는 쿼리로 묶었다.

비용: 읽기 CTE(`WITH … SELECT`)와 `CALL` 로 값을 읽는 쿼리도 mock 이 되어 dry-run 의 재현성이 조금 떨어진다. dry-run 이 데이터를 바꾸지 않는 쪽을 골랐다.

- 요구사항 변경: REQ-DBQ-025 는 «쓰기 작업이면» 에서 «쓰기 작업이거나 쓰기 여부를 판정할 수 없으면» 으로, REQ-DBQ-026 은 «읽기 작업이거나 판정이 모호하면» 에서 «읽기 작업이면» 으로 바꿨다.

### dry-run 모의 출력의 활동 로그 예외를 요구사항에 적었다

결정일: 2026-11-19

[재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) REQ-RERUN-053 의 예외(모의 출력은 활동 로그를 남기지 않는다)를 REQ-DBQ-027 에도 적었다(NERV Task `CLE-T-M6W7RE`). mock 경로는 통합을 얻기 전에 끝나서 동작은 바뀌지 않았다. 요구사항만 읽는 사람이 예외를 놓치지 않게 적었다.

### dry-run 판정은 두 방언 규칙으로 읽는다

결정일: 2026-11-20

한 방언 규칙으로만 읽으면 다른 방언에서 문장 끝인 `;` 를 놓친다. 판정 시점에는 드라이버를 모르므로 두 방언으로 모두 읽는다(NERV Task `CLE-T-EANRHY`).

- 기각: 판정을 통합 조회 뒤로 옮겨 드라이버를 알아낸다. 통합을 얻기 전에 판정해 mock 이 활동 로그를 남기지 않는다는 지금 규칙이 바뀐다.
- 기각: `#` 가 있으면 모두 mock 으로 둔다. jsonb 연산자(`#>` · `#>>`)를 쓴 PostgreSQL 읽기 쿼리도 mock 이 된다.

### 연결할 때 푼 주소도 판정한다

결정일: 2026-11-20

전에는 풀 연결 전에 한 번만 검사해서 검사와 연결 사이에 DNS 응답이 바뀌면(DNS rebinding) 막지 못했다. NERV Task `CLE-T-691T4G` 에서 드라이버가 새 연결을 맺을 때도 같은 대역표로 판정하게 했다. 방식과 기각한 대안은 [통합 노드 공통 — 에러 코드와 사설망 차단 Rationale](CLE-NODE-INT-COMMON-ERROR.md#database-query--send-email-에도-연결-시점-판정을-넣는다-2026-11-20) 에 있다.

- 취소용 일회성 연결도 같은 연결 옵션 빌더를 쓴다. 이 연결만 판정에서 빠지면 막힌 대역에 닿는 길이 하나 남는다.
- 요구사항 변경: REQ-DBQ-018 에 고정 문구와 서버 경고 로그를 적었다. 동작은 NERV Task `CLE-T-E991S1` 이 바꾼 그대로다. REQ-DBQ-030 · REQ-DBQ-031 · REQ-DBQ-032 를 새로 두었다.
