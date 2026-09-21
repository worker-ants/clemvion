# 데이터베이스(Database) 리뷰

## 대상

`codebase/backend/test/helpers/concurrency.ts` (신규 e2e 전용 헬퍼) 로 9 개 e2e 스펙 파일(auth-config,
integration, member-remove(2블록), model-config, schedule, trigger, webauthn-credential(2블록),
workflow, workspace — 총 11 블록)에 손으로 복제돼 있던 "BEGIN → 락(`FOR UPDATE`/`pg_advisory_xact_lock`)
→ 두 요청 발사 → 공허성 가드(1.5초) → COMMIT/ROLLBACK" 트랜잭션 보일러플레이트를 추출한 순수 리팩터.
`codebase/backend/src/**` (프로덕션 코드·스키마·마이그레이션) 변경은 0건이다. `PROJECT.md`·
`plan/in-progress/e2e-race-helper.md`·`review/consistency/**`·`review/code/2026/09/21/20_26_50/**` 는
문서/이전 리뷰 산출물이라 DB 관점 코드 리뷰 대상이 아니다.

## 관점별 확인

1. **인덱스** — 전부 PK(`id = $1`) 또는 `id = ANY($1::uuid[])` 조건의 `SELECT … FOR UPDATE`. e2e 테스트
   fixture 단위(수 행) 조회이고 신규 쿼리 패턴도 아니라(기존 인라인 코드를 그대로 헬퍼로 옮김) 인덱스
   이슈 없음.
2. **N+1** — `Promise.all(fires.map((fire) => fire()))` 는 정확히 "겹침을 만들 만큼"(테스트당 2개) 동시
   발사이지, 반복 증가하는 루프형 개별 쿼리가 아니다. N+1 해당 없음.
3. **트랜잭션** — `BEGIN` → 락 획득 → 발사 → 공허성 가드 → `COMMIT`, `finally` 에서 `ROLLBACK` (COMMIT 을
   이미 탄 경우 no-op) + `pending` rejection 흡수. 원본 11 블록 각각에 있던 것과 **의미상 동일**하게
   추출됐다 — 원본 vs 신규를 직접 대조한 결과 트랜잭션 경계·에러 처리 순서에 회귀가 없다. `locker`
   전용 커넥션을 검증용 `db` 와 분리해야 한다는 제약도 JSDoc(`@param locker`)에 명시돼 있어, 같은
   커넥션으로 락을 쥔 채 검증 쿼리를 보내 자기 자신을 기다리는 실수를 방지한다.
4. **마이그레이션 안전성** — 스키마 변경 없음. 해당 없음.
5. **스키마 설계** — 테이블 구조 변경 없음. 해당 없음.
6. **커넥션 관리** — `locker: Client` 는 헬퍼 인자로 주입되며 생명주기(open/close)는 호출부(각 e2e 파일의
   `beforeAll`/`afterAll`, 이번 diff 범위 밖)가 그대로 관리한다. 이번 리팩터가 커넥션 획득/해제 로직 자체를
   바꾸지 않았음을 diff 로 확인. `finally` 블록이 `ROLLBACK` + `pending` catch 를 항상 실행해 헬퍼 함수
   자체 내에서 커넥션을 누수 없이 원상복구한다(단, 커넥션을 닫는 것은 여전히 호출부 책임 — 이 헬퍼 범위
   밖이라 지적 대상 아님).
7. **SQL 인젝션** — 모든 쿼리가 `$1`, `ANY($1::uuid[])` 파라미터 바인딩만 사용. 문자열 결합 없음. 리터럴
   SQL 은 헬퍼 호출부가 상수로 전달하는 `lock.sql` 뿐이며 사용자 입력이 SQL 문자열에 직접 삽입되는
   경로는 없다. 문제 없음.
8. **대량 데이터** — e2e fixture 수 행 규모. 페이지네이션/대용량 스캔과 무관.

## 발견사항

없음 — CRITICAL/WARNING 대상 코드 없음. 참고로 남길 만한 점(INFO, 이미 이전 리뷰 라운드에서
architecture/documentation reviewer 가 유사하게 지적한 내용과 겹침, 새로 추가하는 항목 아님):

- **[INFO]** `VACUITY_GUARD_MS`(1.5초, `helpers/concurrency.ts`) 는 락 대기(트랜잭션 경계) 관련 타이밍
  상수라 DB 동시성 테스트 신뢰성에 직결된다. 현재는 `if (VACUITY_GUARD_MS >= TRIGGER_DELETE_LOCK_TIMEOUT_MS) throw` 런타임
  assert 로 "가드 대기 < 프로덕션 최단 잠금 타임아웃" 관계를 코드화해뒀고, 11개 콜사이트 전부 균일함을
  plan 에서 실측(§B)했다. 향후 이 헬퍼보다 짧은 `lock_timeout`을 갖는 자원이 추가되면(예: 다른 advisory
  lock 이 더 짧은 타임아웃을 쓰는 경우) 이 단일 상수·단일 assert 로는 잡지 못한다는 점만 기록한다.
  - 위치: `codebase/backend/test/helpers/concurrency.ts` (`VACUITY_GUARD_MS` 선언부 및 그 직후의
    `if (VACUITY_GUARD_MS >= TRIGGER_DELETE_LOCK_TIMEOUT_MS)` 가드)
  - 제안: 현재 조치 불요(YAGNI, 이미 assert 로 최소 방어선은 있음). 두 번째 서로 다른 타임아웃 자원이
    생기면 그때 `guardMs?: number` 옵션으로 확장.

## 요약

DB 관점에서 이 변경은 스키마·인덱스·마이그레이션·프로덕션 쿼리 로직에 아무 영향이 없는 e2e 테스트
헬퍼 추출 리팩터다. 트랜잭션(BEGIN/COMMIT/ROLLBACK) 경계와 에러 처리 순서를 원본 11 블록과 대조한
결과 의미상 동일하게 보존됐고, 모든 쿼리가 파라미터 바인딩을 사용해 SQL 인젝션 우려가 없으며, 커넥션
분리(`locker` vs 검증용 `db`) 요건도 문서화돼 있다. 유일하게 기록할 만한 점은 공허성 가드 대기시간
상수가 여러 콜사이트에 공유되는 확장성 이슈뿐이며 이는 이미 런타임 assert 로 최소 방어되어 있어
현시점 결함은 아니다.

## 위험도

NONE
