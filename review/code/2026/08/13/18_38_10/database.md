# 데이터베이스(Database) 코드 리뷰

## 발견사항

- **[INFO]** `updateExecutionStatus` 의 guarded UPDATE 는 애플리케이션 트랜잭션 밖에서 단일 SQL 문으로 실행되므로, 신규 `assertRowArray` 가 throw 해도 이미 DB 에 커밋된 UPDATE 를 되돌리지 못한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`updateExecutionStatus`, `RETURNING id` 뒤 `assertRowArray(updated, ...)` 호출부, 약 8490~8528행 부근)
  - 상세: 단일 `UPDATE ... RETURNING` 문은 Postgres 에서 그 자체로 원자적이라 별도 트랜잭션이 필요 없고, 이 지점의 `throw` 목적도 코드 주석이 명시하듯 "판정을 바꾸는 것"이 아니라 "관측 불가능한 유실(종결 이벤트 미발행)을 관측 가능한 실패로 바꾸는 것"이다. 같은 파일의 `admission`(`admitExecutionOrDefer`)·`lockNonTerminalExecutionRow` 가드는 `manager.transaction(...)` 콜백 안에서 실행돼 throw 가 실제로 롤백을 유발하는 것과 대비된다(트랜잭션 경계와 가드 배치가 정확히 일치). 즉 이 가드는 데이터 정합성 보호가 아니라 진단 목적이며, 그 구분이 코드 주석에 이미 정확히 기록돼 있어 결함은 아니다 — 검토자로서 트랜잭션 경계와 가드 목적이 실제로 일치하는지 재확인한 결과만 기록해 둔다.
  - 제안: 조치 불요. 향후 이 UPDATE 결과에 따라 추가 파생 쓰기(예: 알림 큐 적재)가 같은 메서드에 추가된다면, 그때는 명시적 트랜잭션으로 승격을 검토할 것.

- **[INFO]** `computeChainDepth` 재귀 CTE 는 `WHERE c.depth < $2`(`RERUN_CHAIN_WALK_MAX = 64`) 로 사이클/무한 재귀를 이미 DB 레벨에서 차단하고 있고, 시작 조건(`WHERE id = $1`)은 PK, 재귀 JOIN(`e.id = c.re_run_of`)은 기존 `V067__execution_re_run_chain.sql` 이 추가한 `re_run_of` 인덱스로 커버된다(이번 diff 는 쿼리 자체를 바꾸지 않고 반환 shape guard 만 추가).
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:304-332` (`computeChainDepth`)
  - 상세: `assertRowArray` 삽입이 쿼리 실행 계획이나 인덱스 사용에 영향을 주지 않음을 확인. 이 쿼리는 트랜잭션 밖(단순 조회, `reRun` 의 쓰기 이전 pre-check)에서 실행되므로 throw 가 롤백을 요구하지 않는다 — 여기서 예외를 던지는 것이 곧바로 `reRun` 전체를 중단시켜 이후 쓰기(새 Execution insert 등)로 진행하지 않게 막는 올바른 fail-closed 방향이다.
  - 제안: 조치 불요.

- **[INFO]** 신규 헬퍼 `assertRowArray` 삽입 4곳(engine 3 + executions 1)이 이 두 파일에서 반환값을 소비하는 raw `.query()` 호출 전수와 정확히 일치함을 독립적으로 재확인했다(`grep -n '\.query('` 결과 4건, advisory-lock 전용 호출 1건은 반환값 미사용이라 제외 대상이 맞음).
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2917`(admission), `:8195`(lockNonTerminalExecutionRow), `:8490`(updateExecutionStatus); `codebase/backend/src/modules/executions/executions.service.ts:306`(computeChainDepth)
  - 상세: 인덱스·트랜잭션 경계·파라미터 바인딩 모두 기존 그대로이며 이번 diff 는 반환 shape 검증만 추가한다. SQL 문 자체는 전부 `$1,$2,...` 파라미터 바인딩을 쓰고, 유일하게 문자열로 직접 삽입되는 `elseStatusesSql`/`statusesSql`(`NON_TERMINAL_STATUSES_SQL` 등)은 사용자 입력이 아닌 `Object.values(enum)` 기반 정적 `private static readonly` 상수라 인젝션 표면이 아니다.
  - 제안: 조치 불요 — 확인만.

## 요약

이번 변경은 raw SQL(`EntityManager.query()`, 반환 타입 선언상 `Promise<any>`)의 결과가 실제로 배열인지 런타임에 검증하는 `assertRowArray` 헬퍼를 도입하고, 두 서비스의 raw SQL 호출 4곳(admission 원자 UPDATE, `lockNonTerminalExecutionRow` SELECT FOR UPDATE, `updateExecutionStatus` guarded UPDATE, `computeChainDepth` 재귀 CTE)에 전수 적용한 데이터 정합성 하드닝이다. 트랜잭션 경계 배치가 정확하다 — `manager.transaction()` 콜백 내부 가드(admission, lock)는 throw 시 실제로 롤백되어 부분 적용을 막고, 트랜잭션 밖 단일 statement 가드(updateExecutionStatus)는 이미 커밋된 쓰기를 되돌릴 수 없다는 것을 저자가 정확히 인지하고 진단 목적으로만 두었다. `computeChainDepth` 는 이번 하드닝 이전엔 shape 이상 시 `depth 1` 로 조용히 접혀 RR-PL-05 체인 깊이 제한을 우회할 수 있었던 유일한 fail-open 지점이었고, 이번 변경으로 fail-closed 로 교정됐다. 모든 raw SQL 은 파라미터화 바인딩을 유지하며 SQL 인젝션 표면 변화가 없고, 스키마/마이그레이션 변경·신규 커넥션 사용·N+1·페이지네이션 관련 변경도 없다. 인덱스는 기존 PK/`re_run_of` 인덱스로 이미 커버되며 이번 diff 로 새로 요구되는 인덱스는 없다.

## 위험도

NONE
