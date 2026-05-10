## 발견사항

### [WARNING] 신규 에러 테스트에서 `out.port` 검증 누락
- **위치**: `database-query.handler.spec.ts` — `maps PostgreSQL SQLSTATE 23503`, `42501`, `42601`, `maps connect-time ECONNRESET`, MySQL 전체 신규 케이스
- **상세**: `out.port` 를 `toBe('error')` 로 검증하지 않는 테스트가 9개. `code` 는 검증하지만 라우팅 자체가 실수로 `'success'` 로 바뀌어도 해당 테스트는 통과한다. 비교 기준인 `routes query error to error port` 원본 테스트는 port 를 검증한다.
- **제안**: 모든 error-port 케이스에 `expect(out.port).toBe('error')` 추가

### [WARNING] 신규 PostgreSQL 에러 테스트에서 `releaseMock` 검증 누락
- **위치**: `maps PostgreSQL SQLSTATE 23503`, `42501`, `42601`, `maps connect-time ECONNRESET` 4개 케이스
- **상세**: `executePostgres` 는 `finally { client?.release() }` 로 클라이언트를 반환한다. 원본 error 테스트(`routes query error`)는 `expect(releaseMock).toHaveBeenCalled()` 를 검증하지만, 신규 케이스들은 이를 생략했다. 해당 assertion 이 없으면 커넥션 릭 회귀가 조용히 통과한다.
- **제안**: 신규 PostgreSQL 에러 케이스 전부에 `expect(releaseMock).toHaveBeenCalled()` 추가

### [WARNING] PostgreSQL SQLSTATE 클래스 `08` / `28` / `57` 미테스트
- **위치**: `classifyPostgresSqlState` — `database-query.handler.ts`
- **상세**: 핸들러 코드와 spec §6.2 는 `08xx`(connection_exception), `28xx`(invalid_authorization), `57xx`(operator_intervention) 를 `DB_CONNECTION_ERROR` / `DB_PERMISSION_DENIED` 로 매핑한다고 명시하지만, 테스트는 `ECONNRESET`(Node errno) 와 `42501`(하드코딩 특수 케이스)만 커버한다. `08006`(connection_failure), `28000`(invalid_authorization_specification), `57P01`(admin_shutdown) 등의 실제 SQLSTATE 시나리오는 무테스트.
- **제안**: 최소 1개씩 대표 케이스 추가 (`08006` → `DB_CONNECTION_ERROR`, `28000` → `DB_PERMISSION_DENIED`, `57P01` → `DB_CONNECTION_ERROR`)

### [INFO] export 된 `mapDbError` 함수의 직접 단위 테스트 없음
- **위치**: `database-query.handler.ts:mapDbError` (exported)
- **상세**: `mapDbError` 는 `export function` 으로 공개되어 있고 분류 로직의 진입점이지만, 핸들러 통합 레벨을 거쳐서만 간접 테스트된다. `extractDriverCode` 의 엣지 케이스(code 가 숫자인 경우 `{ code: 1062 }`, 빈 문자열, `null` 에러 throw, 문자열 throw 등)는 현재 전혀 커버되지 않는다. 직접 단위 테스트가 있으면 경계 조건을 효율적으로 문서화할 수 있다.
- **제안**: `mapDbError.spec.ts` 혹은 기존 spec 내 `describe('mapDbError')` 블록으로 `extractDriverCode` 포함 단위 테스트 추가

### [INFO] 분류 Set 에 정의된 코드 대부분이 미테스트
- **위치**: `MYSQL_CONSTRAINT_CODES`, `MYSQL_PERMISSION_CODES`, `MYSQL_CONNECTION_CODES` Set 들
- **상세**: `MYSQL_CONSTRAINT_CODES` 에 12개 코드가 있지만 테스트는 `ER_DUP_ENTRY` 1개뿐. `MYSQL_PERMISSION_CODES` 5개 중 `ER_TABLEACCESS_DENIED_ERROR` 1개. `CONNECTION_ERRNOS` 11개 중 `ECONNRESET` 1개. 대표 케이스 테스트는 정당하지만, 추가된 Set 항목이 오타나 위치 오류일 경우를 잡을 테스트가 없다.
- **제안**: `ER_NO_REFERENCED_ROW_2`(FK), `ECONNREFUSED`, `ER_DBACCESS_DENIED_ERROR` 등 카테고리별 추가 대표 케이스 1~2개씩 추가 고려

### [INFO] MySQL 테스트의 자격증명 설정 코드 대량 중복
- **위치**: `database-query.handler.spec.ts` — MySQL 전용 테스트 5개
- **상세**: 각 MySQL 테스트가 동일한 자격증명 객체(`driver: 'mysql', host: 'h', port: 3306, ...`)를 반복 인라인으로 작성한다. `makeService` 에 `makeService({ driver: 'mysql' })` 단축 경로가 없어 코드가 약 40줄씩 반복된다. 버그 리스크는 낮지만 유지보수성이 떨어진다.
- **제안**: `makeMysqlService()` 헬퍼 혹은 `makeService` 기본값에 MySQL 프리셋 추가

### [INFO] `DB_CONNECTION_FAILED` rename 의 잔존 참조 검증 없음
- **위치**: `error-codes.ts` diff — `DB_CONNECTION_FAILED` → `DB_CONNECTION_ERROR`
- **상세**: plan 문서는 "사용처 없어 단순 rename" 이라고 적시하지만, 이를 보장하는 테스트가 없다. 다른 파일에서 문자열 리터럴 `'DB_CONNECTION_FAILED'` 를 직접 비교하는 코드가 있다면 조용히 분기 로직이 망가진다.
- **제안**: `grep -r 'DB_CONNECTION_FAILED'` 를 CI lint 나 별도 체크로 추가하거나, spec 테스트에서 `DB_CONNECTION_FAILED` 가 절대 출력되지 않음을 assertion 으로 명시

---

## 요약

신규 테스트는 핵심 시나리오(PostgreSQL SQLSTATE `23505`/`23503`/`42501`/`42601`, Node errno `ECONNRESET`, MySQL `ER_DUP_ENTRY`/`PROTOCOL_CONNECTION_LOST`/`ER_TABLEACCESS_DENIED_ERROR`/`ER_ACCESS_DENIED_ERROR`)를 명확하게 커버하며 전체적으로 의도 전달이 잘 된다. 그러나 일부 신규 케이스에서 `out.port` 와 `releaseMock` 검증이 누락되어 라우팅 회귀와 커넥션 릭 회귀를 잡지 못할 위험이 있다. 또한 PostgreSQL SQLSTATE 클래스 `08`/`28`/`57`은 핸들러 코드와 spec 에 명시되었음에도 테스트가 없어 해당 분기의 정확성을 보장할 수 없다.

## 위험도

**MEDIUM** — port 검증 누락과 releaseMock 검증 누락이 커넥션 릭·라우팅 회귀를 조용히 통과시킬 수 있으며, SQLSTATE 클래스 `08`/`28`/`57` 미테스트는 스펙에 명시된 동작을 보증하지 못한다.