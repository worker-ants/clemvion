# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `sanitizeMessage` 미적용으로 인한 민감정보 노출 + `DB_CONNECTION_FAILED` 값 문자열 변경의 저장 데이터 사이드 이펙트 + 드라이버 간 인증 실패 분류 불일치가 핵심 리스크

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect | `DB_CONNECTION_FAILED` → `DB_CONNECTION_ERROR` 값 문자열 변경: 저장된 워크플로우 expression(`=== "DB_CONNECTION_FAILED"`)이 컴파일 오류 없이 조용히 분기 누락됨. plan 문서는 "사용처 없어 단순 rename"이라 기술하나 DB 저장 데이터까지는 정적 분석으로 탐지 불가 | `error-codes.ts:16` | `git grep -r "DB_CONNECTION_FAILED"` 로 전체 레포 0건 확인 후, DB 저장 워크플로우 expression 대상 마이그레이션 쿼리 실행 또는 한 릴리즈 동안 두 값 공존(`@deprecated`) |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / API Contract / Requirement | `mapDbError`에서 `sanitizeMessage` 미적용: spec §5.3에 "password/secret 토큰 마스킹 적용 후 노출"이라 명시되어 있으나 `err.message`가 raw 그대로 `output.error.message`로 노출됨. MySQL `ER_ACCESS_DENIED_ERROR`는 `"Access denied for user 'u'@'hostname'"`을 포함, pg 연결 실패 시 자격증명 조각 노출 가능 | `database-query.handler.ts` — `mapDbError` 함수 | `sanitizeMessage`를 `message` 반환 전 적용. `toLogError`와 동일 함수 재사용 |
| 2 | API Contract | 기존 `DB_QUERY_FAILED` 단일 코드 세분화로 인한 묵시적 Breaking Change: 이전에 `DB_CONSTRAINT_VIOLATION` / `DB_PERMISSION_DENIED`를 포괄하던 `=== "DB_QUERY_FAILED"` 워크플로우 expression이 두 경우를 더 이상 잡지 못함 | `database-query.handler.ts` — `mapDbError` / `classifyDbError` | 클라이언트·워크플로우 마이그레이션 가이드 별도 제공(기존 `DB_QUERY_FAILED` 분기에 신규 코드 추가 필요 안내) |
| 3 | Architecture / Dependency / Requirement | PostgreSQL class `28xxx`(invalid_authorization) → `DB_PERMISSION_DENIED` vs MySQL `ER_ACCESS_DENIED_ERROR` → `DB_CONNECTION_ERROR`: 동일한 "접속 시 인증 실패" 시나리오가 드라이버별로 다른 코드 반환. 크로스-드라이버 워크플로우 분기 오동작 발생 가능 | `database-query.handler.ts` — `classifyPostgresSqlState`, `MYSQL_CONNECTION_CODES` | PostgreSQL class 28도 `DB_CONNECTION_ERROR`로 통일하거나(credential rotation 재시도 일관성 확보) spec §6.2에 이 비대칭을 명시적 note로 기재 |
| 4 | Testing | 신규 에러 테스트 9건에서 `out.port` 검증 누락: `code`는 검증하지만 라우팅이 `'success'`로 잘못 나와도 테스트 통과. 원본 `routes query error to error port` 테스트는 port를 검증함 | `database-query.handler.spec.ts` — MySQL/PostgreSQL 신규 에러 케이스 전체 | 모든 error-port 케이스에 `expect(out.port).toBe('error')` 추가 |
| 5 | Testing | 신규 PostgreSQL 에러 테스트 4건에서 `releaseMock` 검증 누락: `executePostgres`는 `finally { client?.release() }` 보장이 있으나 신규 케이스에서 미검증. 커넥션 릭 회귀가 조용히 통과 가능 | `database-query.handler.spec.ts` — `23503`, `42501`, `42601`, `ECONNRESET` 케이스 | `expect(releaseMock).toHaveBeenCalled()` 추가 |
| 6 | Testing | PostgreSQL SQLSTATE 클래스 `08`(connection_exception) / `28`(invalid_authorization) / `57`(operator_intervention) 미테스트: 핸들러 코드와 spec §6.2에 명시된 분류이나 테스트 없어 정확성 보증 불가 | `database-query.handler.spec.ts` | `08006` → `DB_CONNECTION_ERROR`, `28000` → `DB_PERMISSION_DENIED`, `57P01` → `DB_CONNECTION_ERROR` 대표 케이스 최소 1개씩 추가 |
| 7 | Maintainability | MySQL 자격증명 객체가 테스트 5건 이상에 인라인 복사: 미묘한 `ssl` 값 차이가 숨어들기 쉽고, 필드 추가 시 모든 복제본 수정 필요 | `database-query.handler.spec.ts` | `makeMysqlService()` 헬퍼 또는 파일 상단 `MYSQL_INTEGRATION_BASE` 상수 선언으로 통합 |
| 8 | Architecture | `mapDbError` 불필요한 `export`: 테스트 파일이 직접 import하지 않고, handler 파일 외부 소비자가 없음. 향후 다른 핸들러가 import 시 handler 모듈 의존성 발생 | `database-query.handler.ts:422` | `export` 제거. 재사용 계획이 있다면 `_base/db-error-classifier.ts`로 분리 |
| 9 | Maintainability | `const driver = creds.driver ?? 'postgres'` try/catch 두 곳에서 중복 선언: default 값 변경 시 두 곳 동시 수정 필요 | `database-query.handler.ts` — try 블록, catch 블록 | try/catch 바깥 공통 스코프에 단일 선언으로 끌어올리기 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / Maintainability | `CONNECTION_ERRNOS`와 `MYSQL_CONNECTION_CODES`에 `PROTOCOL_CONNECTION_LOST`, `PROTOCOL_SEQUENCE_TIMEOUT`, `PROTOCOL_PACKETS_OUT_OF_ORDER` 3개 중복: `classifyDbError`가 `CONNECTION_ERRNOS` 먼저 체크하므로 `MYSQL_CONNECTION_CODES` 내 해당 항목은 dead code | `database-query.handler.ts` — 두 Set 정의 | `MYSQL_CONNECTION_CODES`에서 3개 제거하거나 "Shared codes handled by CONNECTION_ERRNOS first" 주석 추가 |
| 2 | Maintainability | 분류 함수 반환 타입 유니언이 3개 함수에 반복: `'DB_QUERY_FAILED' \| 'DB_CONNECTION_ERROR' \| 'DB_CONSTRAINT_VIOLATION' \| 'DB_PERMISSION_DENIED'` | `classifyDbError`, `classifyPostgresSqlState`, `classifyMysqlCode` 반환 타입 | `type DbRuntimeErrorCode = ...`로 추출 후 재사용 |
| 3 | Maintainability / Testing | 출력 타입 캐스팅 `as unknown as { port: string; output: { error: { ... } } }` 7회 이상 반복 | `database-query.handler.spec.ts` | `type ErrorPortOutput = ...` 타입 정의 후 재사용 |
| 4 | Maintainability | 각 테스트 말미 `await handler.shutdown()` 누락 시 assertion throw로 shutdown 스킵 가능 | `database-query.handler.spec.ts` | `afterEach(() => handler?.shutdown())`으로 이동 |
| 5 | Database | `pool.on('error', () => {})` idle 에러 완전 무음 처리: TLS 만료 등 보안 관련 이벤트 포함 운영 가시성 없음 | `database-query.handler.ts` — `resolvePgPool` | `pool.on('error', (err) => logger.warn('pg pool idle client error', { message: err.message }))` |
| 6 | Database | 대용량 결과셋 방어 없음: `SELECT *` 실행 시 수백만 행이 Node.js 메모리에 로드 | `executePostgres()` / `executeMysql()` | `maxRows` 옵션 추가 후 서버 사이드 truncate + `meta.truncated: true` 반환 고려, 또는 spec에 제약 명시 |
| 7 | Database | 트랜잭션 미지원 제약이 spec에 미기재: 여러 DML 원자성이 필요한 워크플로우에서 사용자 혼란 가능 | spec §4 | "단일 쿼리 단위 실행 / 트랜잭션 미지원" 명시 |
| 8 | Requirement | catch 블록 내 `err instanceof IntegrationError` 분기가 실질적으로 도달 불가: `resolveIntegration`/`missingDbFields`는 try 바깥, `executePostgres`/`executeMysql`은 `IntegrationError` 미발생 | `database-query.handler.ts:174–180` | 제거하거나 "방어적 보존" 주석 명시 |
| 9 | Documentation | spec §6.2 `DB_PERMISSION_DENIED` 행에 PostgreSQL class `28xxx` 누락: 핸들러는 분류하지만 스펙에서 확인 불가 | `spec/4-nodes/4-integration/2-database-query.md` §6.2 | `DB_PERMISSION_DENIED` 행 드라이버 힌트에 `pg 42501, 28xxx (invalid_authorization_specification)` 추가 |
| 10 | Documentation | `MYSQL_CONSTRAINT_CODES` / `MYSQL_PERMISSION_CODES` doc 주석 없음: `CONNECTION_ERRNOS`·`MYSQL_CONNECTION_CODES`는 주석 있음 | `database-query.handler.ts` | "Covers unique / FK / not-null violations" 등 한 줄 블록 주석 추가 |
| 11 | Documentation | `classifyPostgresSqlState` 주석의 "class-23 fallback" 표현이 오해 소지: `42501`은 class 42임 | `database-query.handler.ts` — `classifyPostgresSqlState` | `"must precede the generic class switch"` 등으로 수정 |
| 12 | Requirement | PostgreSQL class `53`(insufficient_resources: `too_many_connections` 등)이 `DB_QUERY_FAILED`로 낙하: retry-worthy 케이스가 재시도 정책에서 누락 | `classifyPostgresSqlState` | `if (klass === '53') return 'DB_CONNECTION_ERROR'` 추가 검토 |
| 13 | Security | `details.driverCode` echo로 DB 엔진 유형 유추 가능: `"23505"` vs `"ER_DUP_ENTRY"` 코드 형식으로 PostgreSQL/MySQL 식별 가능 | `mapDbError` 반환값 | 운영 가이드에 "driverCode를 최종 사용자 응답에 직접 노출 금지" 경고 추가 |
| 14 | Maintainability | `mapDbError` 반환 타입의 `code` 필드가 `string`으로 선언: 내부에서 항상 4개 코드 중 하나 반환 | `export function mapDbError` 시그니처 | `DbRuntimeErrorCode` 또는 `ErrorCodeValue`로 좁히기 |
| 15 | Architecture | `MYSQL_CONSTRAINT_CODES` 등 대형 Set 상수가 핸들러 파일 말미에 위치 (154줄) | `database-query.handler.ts:447–570` | 단기 현행 유지. 중장기적으로 `db-error-classifier.ts` 분리 시 자연 해결 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Side Effect | MEDIUM | `DB_CONNECTION_FAILED` 값 문자열 변경의 저장 데이터 사이드 이펙트 (CRITICAL 지적) |
| API Contract | MEDIUM | `sanitizeMessage` 누락, `DB_QUERY_FAILED` 세분화 breaking change |
| Requirement | MEDIUM | `sanitizeMessage` 미적용(spec-code 불일치), 드라이버 간 인증 실패 분류 불일치 |
| Testing | MEDIUM | `out.port`·`releaseMock` 검증 누락, SQLSTATE `08`/`28`/`57` 미테스트 |
| Maintainability | MEDIUM | MySQL 자격증명 5회 복사, `CONNECTION_ERRNOS`·`MYSQL_CONNECTION_CODES` 중복 |
| Security | LOW | `sanitizeMessage` 누락 (WARNING), `driverCode` 정보 노출 (INFO) |
| Architecture | LOW | `mapDbError` SRP 위반, OCP 부분 위반, Set 중복 |
| Dependency | LOW | `DB_CONNECTION_FAILED` 저장 데이터 리스크, 드라이버 간 인증 분류 불일치 |
| Database | LOW | PostgreSQL class 28 분류 일관성, 대용량 결과셋 방어 부재, idle 에러 무음 처리 |
| Documentation | LOW | `MYSQL_CONSTRAINT_CODES` 주석 누락, spec §6.2 class `28` 누락 |
| Scope | LOW | `mapDbError` 불필요한 export, SQLSTATE `08`/`28`/`57` 미테스트 |
| Concurrency | LOW | `shutdown()` + 진행 중 `execute()` 경쟁 조건 (기존 문제, 이번 diff 무관) |
| Performance | NONE | 모든 분류 함수 O(1), 에러 경로 전용 — 핫패스 영향 없음 |

---

## 발견 없는 에이전트

- **Performance**: 모든 발견사항이 INFO 수준 개선 제안으로, 실질적 성능 위험 없음

---

## 권장 조치사항

1. **[즉시, 배포 전 필수]** `mapDbError` 내 `sanitizeMessage` 적용 — spec과 구현 간 갭이며 DB 자격증명 노출 경로
2. **[즉시, 배포 전 필수]** `DB_CONNECTION_FAILED` 저장 데이터 검증 — `git grep -r "DB_CONNECTION_FAILED"` 후 DB 워크플로우 expression 컬럼 스캔, 안전 확인 전까지 `@deprecated` 공존 유지
3. **[단기]** 신규 에러 테스트 전체에 `out.port`, `releaseMock` assertion 추가 — 커넥션 릭·라우팅 회귀 방어
4. **[단기]** PostgreSQL SQLSTATE `08006`, `28000`, `57P01` 테스트 케이스 추가 — spec 명시 동작 보증
5. **[단기]** 드라이버 간 인증 실패 분류 통일 결정 — PostgreSQL class 28을 `DB_CONNECTION_ERROR`로 통일하거나 spec §6.2에 비대칭 명시
6. **[단기]** spec §6.2 `DB_PERMISSION_DENIED` 행에 `pg 28xxx` 추가, `DB_QUERY_FAILED` 세분화 마이그레이션 가이드 작성
7. **[중기]** `CONNECTION_ERRNOS`·`MYSQL_CONNECTION_CODES` 중복 3개 항목 제거 또는 주석 명시
8. **[중기]** 테스트 파일 리팩터링 — `makeMysqlService()` 헬퍼, `ErrorPortOutput` 타입, `afterEach` shutdown 이동
9. **[중기]** `const driver` 단일 선언, 반환 타입 유니언 `DbRuntimeErrorCode`로 추출
10. **[장기]** `mapDbError` 및 분류 Set 상수를 `_base/db-error-classifier.ts`로 분리 — SRP/OCP 준수