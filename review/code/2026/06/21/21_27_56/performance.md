# 성능(Performance) Review

## 발견사항

### **[INFO]** V101 마이그레이션 — 함수 인덱스 생성 시 잠금 고려
- 위치: `codebase/backend/migrations/V101__add_user_email_lower_index.sql`, line 46
- 상세: `CREATE INDEX IF NOT EXISTS idx_user_email_lower ON "user" (LOWER(email))` 는 기본적으로 `LOCK TABLE "user" ShareLock` 을 획득한다. 운영 중 대용량 테이블이면 마이그레이션 실행 시 write 쿼리가 블로킹된다. `CREATE INDEX CONCURRENTLY` 를 쓰면 잠금 없이 백그라운드 빌드가 가능하다. 단, Flyway 는 기본 트랜잭션 모드에서 `CONCURRENTLY` 를 지원하지 않으므로, `flyway.outOfOrder` 나 `executeInTransaction=false` 설정이 필요하다. 현재 테이블 규모가 작으면 실제 영향은 미미하다.
- 제안: 운영 테이블이 충분히 크다면 `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_email_lower ON "user" (LOWER(email))` 로 변경하고, Flyway 마이그레이션 스크립트에 `-- flyway:executeInTransaction=false` 주석을 추가할 것을 검토한다.

### **[INFO]** e2e 테스트 — 각 테스트 케이스마다 별도 `registerAndLogin` 호출(DB 삽입 비용)
- 위치: `codebase/backend/test/users-email-change.e2e-spec.ts`, 새로 추가된 세 테스트(line 92, 128, 138)
- 상세: 각 `it` 케이스가 독립 사용자를 생성한다. 이는 테스트 격리 측면에서 올바른 접근이지만, `registerAndLogin` 이 내부적으로 HTTP round-trip(POST /auth/register → bcrypt 해시 → POST /auth/login) 을 포함하므로 케이스당 최소 2회 이상의 블로킹 I/O가 발생한다. 현재 4개의 새 케이스 각각이 최소 1~2회 `registerAndLogin` 을 추가로 호출한다(race 케이스는 2회). 60초 타임아웃 내에 문제가 생길 가능성은 낮으나, 테스트 파일 전체 케이스 수가 증가하면 누적 소요 시간이 늘어날 수 있다.
- 제안: 성능 임계가 아니라면 현재 패턴 유지. 케이스가 더 추가될 경우 `beforeAll` 에서 공통 유저를 미리 생성하고 각 테스트에서 상태만 리셋하는 패턴을 검토한다.

### **[INFO]** 프론트엔드 단위 테스트 — `tFromKo` 함수가 모든 translate 호출마다 key.split + 루프 실행
- 위치: `codebase/frontend/src/app/(main)/profile/change-email/verify/__tests__/verify-email-change.test.tsx`, line 522–530 및 `profile-info-card.test.tsx`, line 739–748
- 상세: 두 테스트 파일 모두 `tFromKo` 인라인 구현이 중복되어 있으며, 매 번역 키 조회마다 `key.split('.')` 후 `for` 루프로 객체를 순회한다. 테스트 내에서는 호출 횟수가 매우 적어 실제 부담은 없다. 그러나 이 패턴이 여러 테스트 파일에 복사·붙여넣기 되고 있어 향후 대량 렌더링 테스트에서 다수 key를 조회하면 중복 객체 탐색이 누적된다.
- 제안: 테스트 범위라 성능 임계는 아님. 다만 중복 구현은 `test/helpers/i18n.ts` 같은 공유 모듈로 추출하면 유지보수와 코드 중복 모두 개선된다.

### **[INFO]** spec/data-flow 문서 — 성능 관련 EXPLAIN 확인 미수행
- 위치: `plan/complete/email-change-followup-email-lower-index.md`, line 36–37
- 상세: 계획 문서에 "emailTakenByOther / register 의 case-insensitive 조회가 인덱스를 타는지 EXPLAIN 확인" 이 할 일로 남겨져 있으나, 마이그레이션은 추가되었지만 실제 EXPLAIN ANALYZE 결과나 Index Only Scan 확인 증거가 없다. 인덱스가 올바르게 생성되더라도 쿼리 플래너가 선택하지 않는 경우(소규모 테이블에서 seq scan 선호 등)가 있을 수 있다.
- 제안: 운영 환경 또는 적절한 규모의 테스트 환경에서 `EXPLAIN (ANALYZE, BUFFERS) SELECT ... WHERE LOWER(email) = LOWER($1)` 를 실행해 `Index Scan using idx_user_email_lower` 가 선택되는지 확인 후 EXPLAIN 결과를 plan 문서에 기록한다.

## 요약

이번 변경셋은 성능 최적화를 목적으로 추가된 `idx_user_email_lower` 함수 기반 인덱스(V101), e2e 테스트 3케이스 추가, 프론트엔드 단위 테스트 2파일 추가, 및 spec/plan 문서 업데이트로 구성된다. 핵심 성능 변경인 `LOWER(email)` 인덱스는 방향이 정확하며(`emailTakenByOther` 의 seq scan 위험을 제거), 설계 근거도 명확하다. 다만 운영 대용량 테이블에서 `CREATE INDEX` 의 ShareLock 블로킹 위험(`CONCURRENTLY` 미사용)이 경미하게 존재하며, EXPLAIN 확인이 아직 수행되지 않아 실제 인덱스 사용 여부가 검증되지 않은 상태이다. e2e·프론트엔드 테스트의 성능 특성은 테스트 범위 내에서 정상이며, 비차단 문제이다.

## 위험도

LOW
