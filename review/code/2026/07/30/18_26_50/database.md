# Database Review — retry-atomic-claim (2026-07-30 18:26:50)

대상: `engine-driver.interface.ts`, `retry-turn.service.ts`, `state/state-machine.ts`
(`execution.retry_last_turn` 2차 원자 claim + FAILED→RUNNING/WAITING_FOR_INPUT 재진입
짝 전이 DB 가드 — 8R~11R 누적 수정분 포함)

## 발견사항

- **[INFO]** `_retryState` JSONB 키 리터럴이 파라미터 바인딩이 아닌 raw SQL 문자열
  삽입으로 4곳에 반복된다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:213`,
    `:220` (`retryLastTurn` atomic-consume), `:544`, `:549` (`claimSpawnedRetryRow`)
  - 상세: `output_data - '${RETRY_STATE_KEY}'` / `jsonb_exists(output_data, '${RETRY_STATE_KEY}')`
    (그리고 `input_data` 짝)이 모두 `RETRY_STATE_KEY`(모듈 최상단 `const RETRY_STATE_KEY = '_retryState'`,
    컴파일타임 상수, 외부 입력과 무관)를 템플릿 리터럴로 SQL에 직접 삽입한다. 같은 쿼리 안의
    다른 값들(`id`, `spawnedNodeExecutionId`, `status`)은 전부 `:id`/`:running` named
    parameter 로 바인딩되는데 이 값만 예외다. 현재는 상수라 실질 인젝션 리스크는 0 이지만,
    "이 상수를 문자열 그대로 SQL에 꽂는" 패턴 자체가 코드베이스에 4곳 존재해, 향후 이
    키가 설정 가능/동적으로 바뀌는 리팩터가 이 삽입 패턴을 그대로 복붙해 갈 경우 실제
    인젝션 표면을 재도입할 소지가 있다. `jsonb_exists` 를 함수 호출로 쓴 이유(주석: pg
    `?` 연산자와 bound parameter 표시자 충돌 회피)는 타당하지만, 그 이유가 "값 자체를
    파라미터로 바인딩하지 말아야 한다"는 뜻은 아니다 — `jsonb_exists(output_data, :key)`
    형태로도 동일하게 동작하며 `?` 충돌과 무관하다.
  - 제안: `.andWhere('jsonb_exists(output_data, :key)', { key: RETRY_STATE_KEY })` /
    `.set({ outputData: () => 'output_data - :key' })` + `.setParameter('key', RETRY_STATE_KEY)`
    형태로 나머지 값들과 동일하게 파라미터 바인딩할 것을 권장(방어적 습관 통일 목적,
    현재 동작 변경 없음).

- **[INFO]** 동일한 "terminal 상태 CAS guarded UPDATE" 불변식이 두 개의 독립된 구현
  경로로 유지된다.
  - 위치: `retry-turn.service.ts:573`(`finalizeGuarded` 멱등 분기, `:630`~`:658`)
    vs `updateExecutionStatus`(engine 구현체, 이번 리뷰 파일셋 밖 — `execution-engine.service.ts`)의
    else-분기 guarded UPDATE.
  - 상세: `finalizeGuarded` 는 `live.status === target` (자기-전이/멱등) 케이스를 자체
    raw QueryBuilder guarded UPDATE(COALESCE for CANCELLED / 직접 SET for FAILED·COMPLETED)로
    처리하고, 그 외 케이스는 `this.driver.updateExecutionStatus` 로 위임한다. 두 경로 모두
    "`WHERE id AND status = 관측한 상태`" CAS 패턴을 각자 재구현한 것이라, 향후 가드 조건이
    바뀔 때(이번 라운드의 FAILED→WAITING_FOR_INPUT 확장처럼) 한쪽만 갱신되고 다른 한쪽이
    누락될 구조적 위험이 남는다 — 실제로 이번 기능의 8R 커밋 자체가 "잠금 소비처가
    리뷰어 지목 2곳이 아니라 실측 3곳"이었다고 기록하고 있어, 이 클래스의 드리프트가
    이미 이 PR 안에서 한 번 발생한 이력이 있다.
  - 제안: 지금 당장 고칠 결함은 아니며(현재 두 경로 모두 정확), 두 guarded-update 구현을
    공유 헬퍼로 합치는 리팩터를 후속 과제로 고려. (이미 `plan/in-progress/retry-turn-terminal-guard.md`
    에 유사 계열 후속 항목이 기록돼 있으므로 그쪽에 병기 검토 권장.)

## 점검 관점별 확인 결과

1. **인덱스**: 모든 쿼리(`retryLastTurn`/`applyRetryLastTurn`/`claimSpawnedRetryRow`/
   `finalizeGuarded`)가 PK(`id = :id`) 단일 행 대상이며 `jsonb_exists`/`status` 조건은
   그 한 행 위에서만 평가된다. 별도 인덱스 누락 없음.
2. **N+1**: 루프 내 개별 쿼리 없음. `applyRetryLastTurn` 의 execution/node 조회는
   `Promise.all` 로 병렬화(INFO#4/W18, `retry-turn.service.ts:373`), `resumeGraphAfterRetry`
   는 `loadAndBuildGraph` 1회 배치 로드 후 순수 in-memory 순회. 문제 없음.
3. **트랜잭션**: `retryLastTurn` 의 atomic consume+spawn 은 `dataSource.transaction`
   으로 원자화(`retry-turn.service.ts:207`). `claimSpawnedRetryRow`/`finalizeGuarded` 의
   guarded UPDATE 는 단일 SQL문의 WHERE-절 CAS 로 동시성을 처리해 트랜잭션 불필요 —
   설계 의도대로 적절. `finalizeGuarded` 가 SELECT 후 별도 UPDATE 를 트랜잭션 없이
   수행하는 것도, 실제 정합성은 UPDATE 문 자체의 조건절이 담당하므로 안전(코드 주석에
   근거 명시). `ai-turn-orchestrator.service.ts`↔`execution-engine.service.ts` 경유
   object-reference 공유를 직접 추적해 `resumeGraphAfterRetry` 최종 COMPLETED 전이가
   stale in-memory status 로 인해 오동작하지 않음을 확인함(별도 파일이라 findings 에는
   포함하지 않음).
4. **마이그레이션 안전성**: 스키마 변경 없음(TS 로직 파일만) — 해당 없음.
5. **스키마 설계**: 신규 테이블/컬럼 없음 — 해당 없음. `_retryState` 를 JSONB 서브필드로
   보존하는 기존 설계 재사용, 이 diff 의 변경 범위 아님.
6. **커넥션 관리**: NestJS `@InjectRepository`/`@InjectDataSource` DI 로만 접근, 수동
   커넥션 획득/해제 없음. 트랜잭션은 전부 짧은 단일 UPDATE/INSERT 범위로, LLM 호출 등
   외부 I/O 를 걸치지 않아 커넥션 풀 점유 리스크 없음.
7. **SQL 인젝션**: `id`/`nodeExecutionId`/`spawnedNodeExecutionId`/`status` 등 가변 값은
   전부 named parameter(`:id` 등)로 바인딩. 유일한 raw 삽입은 컴파일타임 상수
   `RETRY_STATE_KEY` (위 INFO 참조) — 현재 익스플로잇 불가능.
8. **대량 데이터**: 벌크 조회/페이지네이션 대상 쿼리 없음(전부 단건 PK 조회/갱신) —
   해당 없음.

## 요약

이번 diff(`retry_last_turn` 2차 원자 claim + FAILED 소스 짝 전이의 DB 가드 opt-in 배선)를
데이터베이스 관점에서 검토한 결과, 인덱스·N+1·트랜잭션 경계·커넥션 관리·SQL 파라미터화
전 영역에서 구조적 결함을 발견하지 못했다. 핵심 CRITICAL(8R: `allowRetryReentry` 가
상태머신에는 도달하되 DB `FOR UPDATE` 가드에는 전파되지 않아 짝 전이가 항상 0행이던 결함)은
`engine-driver.interface.ts`/`state-machine.ts`/`retry-turn.service.ts` 삼각에서 일관되게
반영돼 있고, `retryLastTurn`(atomic consume+spawn, 트랜잭션)과 `claimSpawnedRetryRow`(2차
claim, 단일 CAS UPDATE)의 동시성 가드도 견고하다. `finalizeGuarded` 의 "DB 재조회 후
guarded UPDATE" 패턴은 이 서비스의 `execution` 참조가 재진입 도중 stale 해질 수 있는
정확한 지점(재진입 시작 이전에 이미 발생한 concurrent cancel)을 겨냥한 설계로, object
reference 공유 경로를 직접 추적해 안전함을 확인했다. 남은 항목은 전부 INFO 수준(상수
문자열의 raw SQL 삽입 습관, 두 개의 병렬 guarded-update 구현이 향후 드리프트할 수 있는
구조적 여지)으로, 현재 데이터 정합성이나 보안에 실질적 영향은 없다.

## 위험도

LOW
