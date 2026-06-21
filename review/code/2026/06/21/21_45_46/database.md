# Database Review

## 발견사항

### [INFO] CREATE INDEX (non-CONCURRENTLY) — 쓰기 블로킹 가능성
- 위치: `codebase/backend/migrations/V101__add_user_email_lower_index.sql` 전체
- 상세: `CREATE INDEX IF NOT EXISTS idx_user_email_lower ON "user" (LOWER(email))` 는 PostgreSQL 기본 동작(non-CONCURRENTLY)으로 실행된다. 인덱스 빌드 완료 시까지 `"user"` 테이블에 `ShareLock`(읽기 허용·쓰기 차단)을 보유하므로, 운영 대형 테이블에서 마이그레이션 실행 중 INSERT/UPDATE/DELETE 가 블로킹된다. 이전 세션(21_27_56) 의 database 리뷰에서 이미 INFO-1 로 동일하게 지적되었고, RESOLUTION 에서 "현 규모 미미 — 운영 대용량 시 CONCURRENTLY 검토를 plan 에 메모" 로 수용 처리된 항목이다.
- 제안: 무중단 배포가 요구되는 운영 환경이라면 `CREATE INDEX CONCURRENTLY IF NOT EXISTS ...` 로 전환한다. CONCURRENTLY 는 마이그레이션 트랜잭션 내 실행 불가이므로 Flyway 비트랜잭션 모드(예: 파일 상단 `-- flyway:disableTransaction` 주석)가 필요하다. 현재 이메일 변경 경로(저빈도)와 테이블 규모를 고려하면 현행도 허용 가능하며, plan 파일(`plan/complete/email-change-followup-email-lower-index.md`)에 deferred 체크박스로 이미 추적되고 있다.

### [INFO] non-unique 표현식 인덱스 설계 — 타당
- 위치: `codebase/backend/migrations/V101__add_user_email_lower_index.sql` 주석
- 상세: UNIQUE 함수 인덱스를 선택하지 않고 non-unique 로 둔 근거(기존 case-variant 중복 데이터 존재 시 UNIQUE 함수 인덱스 생성 실패, 기존 case-sensitive UNIQUE 제약과 의미 충돌 방지)가 마이그레이션 주석에 명확히 서술되어 있다. 설계 판단은 적절하다.

### [INFO] IF NOT EXISTS — 재실행 안전성 확보
- 위치: `codebase/backend/migrations/V101__add_user_email_lower_index.sql` L49
- 상세: `IF NOT EXISTS` 절로 동일 마이그레이션을 재실행해도 오류 없이 멱등하게 동작한다. DOWN 주석도 제공되어 롤백 시 의도가 명확하다.

### [INFO] e2e 직접 DB 쿼리 — 파라미터화 확인
- 위치: `codebase/backend/test/users-email-change.e2e-spec.ts` `seedPendingEmailChange` 함수 및 개별 `db.query` 호출 전체
- 상세: `seedPendingEmailChange` 헬퍼 및 e2e 내 모든 직접 `db.query(...)` 호출이 `$1/$2/$3` 위치 파라미터와 배열을 사용한다. SQL 인젝션 위험 없음. 단, `expiresSql` 파라미터가 SQL 문자열 그대로 인터폴레이션(`${expiresSql}`)된다는 점을 확인할 필요가 있다. 이 값은 호출부에서 리터럴 SQL 상수(`"NOW() + INTERVAL '1 hour'"`, `"NOW() - INTERVAL '1 minute'"`)만 전달되는 테스트 전용 코드이므로 실 운영 경로가 아니며 인젝션 경로가 없다. 다만 향후 이 헬퍼를 재사용할 때 외부 입력을 `expiresSql` 에 주입하지 않도록 주의가 필요하다.
- 제안: 테스트 코드로서 현행 위험 없음. 향후 헬퍼 재사용 시 `expiresSql` 에 리터럴만 허용하도록 타입 주석 또는 enum 제한을 고려한다(비차단).

### [INFO] EXPLAIN ANALYZE 미수행 — plan 추적 중
- 위치: `plan/complete/email-change-followup-email-lower-index.md` "할 일" 항목
- 상세: `emailTakenByOther` 의 `WHERE LOWER(u.email) = LOWER(:email)` 쿼리가 신규 인덱스를 실제로 사용하는지 `EXPLAIN (ANALYZE, BUFFERS)` 검증이 plan 에 deferred 항목으로 남아 있다. PostgreSQL 은 표현식 인덱스를 `LOWER(email)` 형태와 정확히 매칭할 때만 사용하므로 ORM/쿼리빌더가 동일 형식을 생성하는지 확인이 필요하다. plan 에서 이미 추적 중이며 비차단이다.

---

## 요약

이번 변경의 DB 관련 코드는 `V101__add_user_email_lower_index.sql` 단 1건이다. `LOWER(email)` 표현식 인덱스 추가의 목적(case-insensitive 중복 검사 가속)과 설계 판단(non-unique 선택, IF NOT EXISTS 재실행 안전성)이 모두 타당하고 주석으로 충분히 설명되어 있다. 발견된 DB 이슈는 전부 INFO 수준이며, 핵심 위험인 non-CONCURRENTLY 쓰기 블로킹은 이전 리뷰 세션(21_27_56)에서 이미 수용 처리된 항목이 재확인되는 것이다. e2e 테스트 직접 쿼리는 전부 파라미터화되어 있으며, `expiresSql` 인터폴레이션은 테스트 리터럴 상수만 전달되어 실질적 위험이 없다. N+1, 트랜잭션 누락, 커넥션 풀 문제, 스키마 설계 결함은 이번 변경에서 발견되지 않았다.

## 위험도
LOW

STATUS=success ISSUES=0
