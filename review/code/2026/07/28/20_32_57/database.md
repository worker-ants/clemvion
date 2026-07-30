# 데이터베이스(Database) 코드 리뷰 결과

## 대상 (커밋 `b351731f0` — `applyRetryLastTurn` 재진입 가드를 read-then-branch 에서 조건부 UPDATE 원자 claim 으로 교체)

- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts`
- `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts`

## 발견사항

- **[WARNING]** 이번 커밋의 핵심 동시성 수정(원자 claim)이 실 Postgres 로 검증된 테스트가 전무함 — mock 전용 unit 테스트만 존재
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:310-339` (claim 구현부), `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:406-434` (`(b3)` 신규 테스트)
  - 상세: 이 커밋은 `applyRetryLastTurn` 의 재진입 가드를 `findOneBy → status 비교` 인 read-then-branch 에서
    ```sql
    UPDATE node_execution SET input_data = input_data - '_retryState'
     WHERE id = :id AND status = 'running' AND jsonb_exists(input_data, '_retryState')
    ```
    조건부 UPDATE(CAS) 로 교체해 "중복 배달 시 정확히 하나만 진행" 을 DB 원자성으로 보장하려 한다. 그런데
    `grep -rl "retry_last_turn\|applyRetryLastTurn\|RetryTurnService" codebase/backend/test/*.ts` 결과가
    0건이라, 이 claim 이 실제 Postgres 위에서 "두 delivery 가 동시에 같은 row 를 대상으로 UPDATE 를
    실행하면 정확히 하나만 `affected=1` 을 받는다" 는 핵심 불변식을 지키는지 검증하는 e2e 테스트가 없다.
    신규 unit 테스트 `(b2)`/`(b3)` 는 `createQueryBuilder` 를 완전히 mock 해 `(b3)` 은 `.set()`/`.where()`/
    `.andWhere()` 에 전달된 SQL 문자열 내용까지 확인하지만(모의 SQL 문법 검증), 실행 결과는
    `{ affected: 0|1 }` 을 하드코딩한 mock 값이라 실제 JSONB 연산자·`jsonb_exists` 함수·행 잠금 기반 CAS
    의미론이 Postgres 상에서 올바르게 동작하는지는 어느 계층에서도 자동화 테스트로 증명되지 않는다. 이
    파일 자체의 plan(`plan/in-progress/retry-turn-terminal-guard.md` "5차 라운드 이후 위생 정리" 표 #3·#4)
    이 이미 인접 코드(`retryLastTurn` 의 동일 JSONB consume 패턴, `finalizeGuarded` 의 `COALESCE` 패턴)에
    대해 "unit·e2e 어느 계층에도 검증 없음" 을 스스로 인정하고 P2 로 추적 중인데, 이번에 새로 추가된 세
    번째 인스턴스(`applyRetryLastTurn` claim)도 같은 성격의 검증 갭을 그대로 반복한다. 다만 SQL 자체는
    이미 프로덕션에서 쓰이는 `retryLastTurn` 소비 UPDATE(같은 파일 189-223행, `output_data` 대상)와
    연산자·함수가 동일해(대상 컬럼명만 다름) 구문 오류 위험은 낮다고 판단된다 — Postgres 버전도
    `docker-compose.yml` 기준 `pgvector/pgvector:pg18` 로 `jsonb_exists`/`jsonb - text` 모두 정식
    지원된다.
  - 제안: `codebase/backend/test/execution-stalled-redelivery.e2e-spec.ts` 류(또는 신규 e2e)에 "동일
    spawned row 를 대상으로 `applyRetryLastTurn` 을 두 호출(경합 시뮬레이션)로 실행해 정확히 한쪽만
    진행하고 나머지는 discard" 시나리오를 실 Postgres 로 추가할 것. `plan/in-progress/
    retry-turn-terminal-guard.md` 의 기존 후속 항목 #3·#4 에 이번 claim 도 함께 등재해 일괄 처리를
    권장.

- **[INFO]** `jsonb_exists()` 채택 근거(파라미터 placeholder 충돌 회피) 주석이 신규 claim 지점에서 반복되지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:331` (신규),
    대조 `retry-turn.service.ts:204-207` (기존 `retryLastTurn` consume 의 동일 근거 주석)
  - 상세: 같은 파일의 `retryLastTurn` 소비 UPDATE 는 `?` 연산자 대신 `jsonb_exists()` 함수를 쓰는 이유
    ("pg 드라이버가 `?` 를 바인드 파라미터 placeholder 로 오인하는 문제 회피")를 명시적으로 주석에
    남기는데, 이번 신규 claim(331행)은 동일 기법을 정확히 재사용하면서도 그 근거를 반복하지 않는다.
    기능적 결함은 아니며 순수 문서 완결성 관찰.
  - 제안: 필요 시 "이유는 204행 참조" 정도의 짧은 포인터만 추가해도 충분. 조치 불요(INFO, non-blocking).

## 위 두 항목 외 8개 관점별 확인 결과 (문제 없음)

- **인덱스**: claim/consume UPDATE 모두 `WHERE id = :id`(UUID PK, `@PrimaryGeneratedColumn('uuid')`)로
  단일 행을 먼저 특정한 뒤 `status`/`jsonb_exists` 를 그 위에 필터링하므로 별도 인덱스(GIN 등) 불필요.
  기존 `@Index(['executionId','status'])` 도 이 쿼리엔 사용되지 않지만 필요하지도 않음.
- **N+1**: 신규 코드에 반복문 내 개별 쿼리 없음. 기존 `Promise.all([executionRepository.findOneBy, nodeRepository.findOneBy])` 병렬화 패턴 유지.
- **트랜잭션**: claim 은 단일 UPDATE 문이라 Postgres 암시적 트랜잭션으로 원자성이 충분하며, 이후 장시간
  비동기 작업(LLM 턴 재진입)을 별도 트랜잭션으로 묶지 않은 것도 적절 — 긴 트랜잭션으로 행 잠금을
  오래 유지하지 않는 설계. `retryLastTurn`(소비+spawn)의 기존 `dataSource.transaction` 사용도 그대로
  유지되어 일관적.
- **마이그레이션 안전성**: 이번 diff 에 스키마/마이그레이션 변경 없음(`input_data` jsonb 컬럼은
  기존 컬럼). 해당 없음.
- **스키마 설계**: JSONB `-` 연산자로 키 제거하는 기존 패턴(`retryLastTurn` 의 `output_data` 소비)을
  다른 컬럼(`input_data`)에 그대로 재사용 — 신규 스키마 설계 이슈 없음.
- **커넥션 관리**: TypeORM repository/`createQueryBuilder` 경유로 커넥션 풀을 표준적으로 사용, 수동
  connection 획득/해제 없음.
- **SQL 인젝션**: `:id`/`:running` 파라미터 바인딩 정상 사용. raw 문자열(`input_data - '_retryState'`,
  `jsonb_exists(input_data, '_retryState')`)에는 외부/사용자 입력이 전혀 포함되지 않고 고정 리터럴만
  삽입되어 인젝션 위험 없음.
- **대량 데이터**: 단일 행(PK) 대상 쓰기로, 대용량 테이블 스캔이나 페이지네이션과 무관.

## 요약

이번 커밋은 `applyRetryLastTurn` 의 재진입 방지 가드를 비원자 `read-then-branch`(`findOneBy` 후
`status !== RUNNING` 분기)에서 조건부 `UPDATE ... WHERE id=:id AND status='running' AND
jsonb_exists(input_data,'_retryState')` 원자 claim 으로 교체해, 이전 라운드(5R)에서 CRITICAL 로
승격됐던 "중복 continuation 배달 시 두 delivery 가 모두 통과해 락 없는 인스턴스-로컬 컨텍스트를
공유·중복 LLM 호출·downstream 도구 중복 실행" 위험을 정확한 DB 패턴으로 닫는다. SQL 은 파라미터
바인딩을 올바르게 쓰고 사용자 입력을 raw 문자열에 직접 삽입하지 않아 SQL 인젝션 위험이 없으며, UUID
PK 단일 행 대상이라 별도 인덱스 없이도 효율적이고, 같은 파일의 기존 `retryLastTurn` 소비 패턴과
연산자·함수가 동일해 스키마·문법 리스크도 낮다. claim 을 별도 트랜잭션으로 감싸지 않은 것도 이후
장시간 비동기 작업 앞에서 짧은 단일 UPDATE 만 원자적으로 수행한다는 점에서 적절한 설계다. N+1·
마이그레이션·커넥션 관리 관점에서도 새로 도입된 문제는 없다. 유일한 아쉬움은 이 fix 의 핵심 불변식
(동시 claim 시 정확히 하나만 승리)이 mock 전용 unit 테스트로만 검증되고 실 Postgres 기반 동시성 e2e
테스트가 없다는 점인데, 이는 같은 파일의 인접 패턴(`retryLastTurn` consume, `finalizeGuarded` 의
COALESCE)에 대해 팀이 이미 인지·추적 중인 갭과 동일한 성격이라 신규 결함이라기보다 기존 테스트
전략의 반복된 한계로 판단된다.

## 위험도

LOW
