# Database Review

## 발견사항

### **[INFO]** `CREATE INDEX IF NOT EXISTS` — 무중단 배포 관점 검토
- 위치: `codebase/backend/migrations/V101__add_user_email_lower_index.sql` 전체
- 상세: `CREATE INDEX IF NOT EXISTS idx_user_email_lower ON "user" (LOWER(email))` 는 PostgreSQL 에서 일반 `CREATE INDEX` 로 실행된다. 일반 `CREATE INDEX` 는 빌드 완료 시까지 테이블에 `ShareLock` 을 획득해 동시 쓰기(INSERT/UPDATE/DELETE)를 차단한다. `"user"` 테이블이 대형 운영 DB 라면 인덱스 빌드 시간 동안 쓰기가 블로킹될 수 있다.
- 제안: 무중단 배포가 요구된다면 `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_email_lower ON "user" (LOWER(email))` 로 변경한다. `CONCURRENTLY` 는 ShareLock 없이 백그라운드 빌드를 수행해 동시 쓰기를 허용한다. 단, Flyway/마이그레이션 트랜잭션 내에서는 `CONCURRENTLY` 사용 불가이므로, 해당 마이그레이션 스크립트를 `disableChecksum` 또는 비트랜잭션 모드로 실행해야 한다(Flyway `spring.flyway.mixed=true` 또는 `-- flyway:disableTransaction` 선언). 저빈도 호출 경로(이메일 변경 request/verify)라는 plan 설명과 테이블 규모에 따라 현행 방식도 허용 가능하다(Small table 이면 Lock 시간이 무시 가능).

### **[INFO]** non-unique 인덱스 선택 근거 — 적절함
- 위치: `V101__add_user_email_lower_index.sql` 주석 및 `plan/complete/email-change-followup-email-lower-index.md`
- 상세: UNIQUE 함수 인덱스 대신 non-unique 인덱스를 선택한 이유(기존 case-variant 중복 데이터 존재 시 UNIQUE 함수 인덱스 생성 실패, 기존 case-sensitive UNIQUE 제약과의 의미 충돌 방지)가 마이그레이션 주석과 plan 문서에 명확히 서술되어 있다. 설계 판단은 타당하다.

### **[INFO]** e2e 테스트 — 파라미터화된 쿼리 사용 확인
- 위치: `codebase/backend/test/users-email-change.e2e-spec.ts` 전체
- 상세: 테스트 코드 내 모든 직접 DB 쿼리(`db.query(...)`)가 `$1`, `$2`, `$3` 플레이스홀더와 파라미터 배열을 사용한다. SQL 인젝션 취약점 없음.

### **[INFO]** EXPLAIN 확인 권고 — plan 에 기재됨
- 위치: `plan/complete/email-change-followup-email-lower-index.md` "할 일" 항목
- 상세: plan 문서가 `emailTakenByOther` / `register` 의 case-insensitive 조회에서 인덱스가 실제로 사용되는지 `EXPLAIN` 확인을 태스크로 명시하고 있다. 이 항목이 아직 완료로 표시되지 않으므로 배포 전 검증 권고.

---

## 요약

이번 변경의 DB 관련 코드는 `V101__add_user_email_lower_index.sql` 마이그레이션 파일 1건이다. 목적(LOWER() 표현식 인덱스로 `WHERE LOWER(u.email) = LOWER(:email)` 조회 가속)과 설계 근거(non-unique 선택 이유, IF NOT EXISTS 재실행 안전성)가 명확하고 올바르다. 유일한 DB 관점 주의 사항은 `CREATE INDEX` (non-CONCURRENTLY) 가 빌드 중 테이블 쓰기를 블로킹한다는 점이며, `"user"` 테이블 규모와 배포 SLA 에 따라 `CREATE INDEX CONCURRENTLY` 전환을 고려할 수 있다. e2e 테스트 내 직접 DB 쿼리는 전부 파라미터화되어 있어 SQL 인젝션 위험이 없다.

## 위험도

LOW
