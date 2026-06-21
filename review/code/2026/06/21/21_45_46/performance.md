# 성능(Performance) 리뷰

세션: `review/code/2026/06/21/21_45_46`

## 발견사항

### 파일 1: V101__add_user_email_lower_index.sql

- **[INFO]** `CREATE INDEX` non-CONCURRENTLY — 마이그레이션 실행 중 `ShareLock` 획득으로 해당 테이블 쓰기 차단
  - 위치: `codebase/backend/migrations/V101__add_user_email_lower_index.sql:46`
  - 상세: `CREATE INDEX IF NOT EXISTS idx_user_email_lower ON "user" (LOWER(email))` 는 CONCURRENTLY 옵션 없이 실행되므로 인덱스 빌드 중 `user` 테이블에 ShareLock 이 걸려 INSERT/UPDATE 가 블로킹된다. 소규모 테이블에서는 수 밀리초 수준이나, 운영 환경에서 `user` 테이블이 수백만 건 이상으로 성장한 경우 마이그레이션 다운타임이 수십 초에서 수 분 까지 늘어날 수 있다.
  - 제안: 운영 대용량 환경 배포 시 별도 스크립트로 `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_email_lower ON "user" (LOWER(email))` 를 Flyway 마이그레이션 바깥에서 실행. (CONCURRENTLY 는 트랜잭션 내 실행 불가 — Flyway 기본 트랜잭션 모드와 충돌하므로 마이그레이션 파일로 직접 대체는 어렵고, `flyway.outOfOrder` 또는 별도 non-transactional 마이그레이션 형태로 분리 필요.) 현 규모에서는 비차단 INFO.

- **[INFO]** `LOWER()` 표현식 인덱스 selectivity 미검증
  - 위치: `codebase/backend/migrations/V101__add_user_email_lower_index.sql:46`
  - 상세: 인덱스 생성 자체는 올바르다. 그러나 `emailTakenByOther` 쿼리(`WHERE LOWER(u.email) = LOWER(:email)`)가 실제로 이 표현식 인덱스를 Index Scan 으로 활용하는지는 PostgreSQL 플래너 통계(table statistics, `pg_stats`)와 실제 데이터 볼륨에 따라 달라진다. 이메일 컬럼 카디널리티가 충분히 높으면 거의 항상 사용되나, seq scan cost 가 낮다고 플래너가 판단하면 무시될 수 있다.
  - 제안: 운영/스테이징 환경에서 충분한 데이터 볼륨 적재 후 `EXPLAIN (ANALYZE, BUFFERS)` 로 인덱스 사용 여부 확인. plan/complete/email-change-followup-email-lower-index.md 의 deferred 체크박스에 이미 추적 중 — 추가 조치 불필요.

---

### 파일 2: auth.service.spec.ts (신규 테스트)

성능 관련 발견사항 없음. mock 기반 단위 테스트로 실제 I/O 없음.

---

### 파일 3: users-email-change.e2e-spec.ts

- **[INFO]** e2e 테스트 내 per-test DB 쿼리 누적 — `before`/`after` SELECT 쿼리 추가
  - 위치: `codebase/backend/test/users-email-change.e2e-spec.ts` L240-256 (resend 테스트)
  - 상세: resend 테스트가 `before` 상태 조회 SELECT 1건 + resend API 호출 + `after` 상태 조회 SELECT 1건 총 3번의 DB 또는 HTTP 왕복을 순차 수행한다. e2e 테스트 맥락에서는 자연스러운 패턴이며 성능 문제가 아님. `seedPendingEmailChange` 헬퍼 추출로 중복 쿼리 문자열이 제거된 것은 긍정적.
  - 제안: 해당 없음 (테스트 코드 정상).

---

### 파일 4-5: 프론트엔드 테스트 파일

- **[INFO]** `tFromKo` i18n mock 의 key 순회 — O(depth) 선형, 무시 가능
  - 위치: `codebase/frontend/src/app/(main)/profile/change-email/verify/__tests__/verify-email-change.test.tsx` L358-367
  - 상세: `tFromKo` 가 키를 `.` 으로 분리해 순회하므로 키 depth에 선형. 테스트 mock 이고 실제 번역 키 depth 는 수 단계 수준이라 성능 영향 전무. 단, 동일 로직이 두 테스트 파일에 중복 존재하는 것은 이전 리뷰(INFO-3)에서 이미 지적됨.
  - 제안: 비차단. 테스트 전용이며 기존 INFO-3 으로 추적 중.

---

## 요약

변경 집합은 SQL 마이그레이션 1개(LOWER() 표현식 인덱스), 백엔드 단위 테스트 1건 추가, e2e 테스트 헬퍼 리팩터 + 신규 케이스 3건, 프론트엔드 단위 테스트 신규 파일로 구성된다. 프로덕션 코드 경로의 신규 N+1 쿼리·불필요한 메모리 할당·블로킹 I/O·알고리즘 비효율은 없다. 유일한 성능 관련 주의점은 `CREATE INDEX` 가 CONCURRENTLY 없이 실행되어 마이그레이션 중 테이블 쓰기를 잠시 차단한다는 점이나, 이는 현 규모에서 실질적 영향이 없고 이전 리뷰(INFO-1)에서도 이미 인지·수용된 사항이다. 인덱스 selectivity 검증(EXPLAIN ANALYZE)은 plan 에 deferred 로 추적 중이다.

## 위험도

NONE

---

STATUS: SUCCESS
