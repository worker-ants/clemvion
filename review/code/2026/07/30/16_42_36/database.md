# Database Review — retry_last_turn 원자 claim / 짝 전이 DB 가드

## 검토 범위

- `codebase/backend/src/modules/execution-engine/state/state-machine.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`
- `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`

프롬프트에 diff 게이트가 없어(5개 파일 모두 "전체 파일 컨텍스트"만 제공) `git diff main...HEAD`
로 실제 변경분을 별도 확인한 뒤, 그 변경분이 각 파일에서 실제로 위치한 줄 번호를
`Read` 로 직접 대조했다(아래 위치는 소스 파일의 실제 줄 번호). 변경의 핵심은 (1)
`execution.retry_last_turn` 재진입의 FAILED→RUNNING/WAITING_FOR_INPUT 짝 전이가
DB 가드(`lockNonTerminalExecutionRow`)에 막혀 **항상 0행**이던 8R CRITICAL 을
opt-in(`allowRetryReentry`) SQL 조건 확장으로 수정하고, (2) `applyRetryLastTurn` 의
2차 배달에 JSONB 원자 claim(`claimSpawnedRetryRow`)을 도입한 것이다. 스키마
마이그레이션 변경은 없음(`git diff --stat` 로 확인, migrations 디렉토리 무변경).

## 발견사항

- **[INFO]** `claimSpawnedRetryRow` claim 실패/discard 시 orphan RUNNING NodeExecution row 가 백스톱 없이 잔류할 수 있음 (이미 추적된 P2 잔여 갭)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:485-531` (`claimSpawnedRetryRow` JSDoc "알려진 백스톱 갭" 문단), 소비부 `retry-turn.service.ts:322-343`
  - 상세: 2차 claim(`input_data - '_retryState'` 원자 제거, `status='running' AND jsonb_exists(...)` 조건부 UPDATE)이 실패하면 `applyRetryLastTurn` 은 원인 불문 discard 한다. spawn 된 RUNNING NodeExecution row 는 claim 성공 후 처리가 중단(크래시 등)되면 `_retryState` 가 이미 제거된 채 RUNNING 으로 영구 잔류할 수 있는데, 그 시점 부모 Execution 은 이미 terminal(`failed`)이라 `recoverStuckExecutions`(stale RUNNING **Execution** 재구동 경로)가 이 orphan row 에 닿지 않는다 — 타임라인/진행률 집계 쿼리가 이 row 를 계속 non-terminal 로 카운트하는 DB 위생 문제로 남는다.
  - 근거: 이 갭은 새로 발견한 것이 아니라 코드 JSDoc 과 `plan/in-progress/retry-turn-terminal-guard.md` §코드 표 #15(P2)에 이미 실측·등재돼 있고, 트레이드오프 분석(활성 row 를 죽이는 이전 동작보다 discard 가 안전)도 이미 완료된 상태다. DB 리뷰 관점에서 재확인차 기재하며, 새 CRITICAL/WARNING 으로 취급하지 않는다.
  - 제안: 별도 후속(P2)에서 "FAILED Execution + `_retryState` 없는 RUNNING NodeExecution" 패턴을 스캔하는 주기적 백스톱 잡을 추가하는 방안을 검토(이미 plan 에 등재돼 있으므로 추가 조치 불요, 우선순위만 유지).

- **[INFO]** 신규/확장된 raw JSONB SQL 이 mock QueryBuilder 로만 검증되고 실 Postgres 로 검증되지 않음 (이미 추적된 P2 테스트 갭)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:541-550` (`claimSpawnedRetryRow` 의 `input_data - '${RETRY_STATE_KEY}'` / `jsonb_exists(input_data, '${RETRY_STATE_KEY}')`), `execution-engine.service.ts:8176-8182`·`8462-8473` (`status IN (${statusesSql})` 리스트 확장)
  - 상세: `retry-turn.service.spec.ts` 는 `createQueryBuilder` mock 의 `set()`/`andWhere()` 인자 문자열을 정규식으로 단언할 뿐(`toMatch(/jsonb_exists\(input_data, '_retryState'\)/)` 등) 실제 Postgres 에 대해 SQL 을 실행하지 않는다. JSONB `-` 연산자·`jsonb_exists()` 함수 자체는 이미 `retryLastTurn` 원본 claim 에서 쓰이던 검증된 패턴을 그대로 재사용한 것이라 문법 위험은 낮지만, "affected=1 인 쪽만 진행"을 보장하는 실제 동시성 동작(두 UPDATE 가 동시에 도착했을 때 Postgres 가 정말 1/0 으로 가른다는 것)은 e2e 로도 검증되지 않는다.
  - 근거: `plan/in-progress/retry-turn-terminal-guard.md` §코드 표 #3 이 이미 "atomic-consume SQL 실 Postgres 검증 — unit·e2e 어느 계층에도 없음... `applyRetryLastTurn`/`claimSpawnedRetryRow` 의 2차 claim 도 동일 갭"으로 명시 등재한 상태 — 새로 발견한 결함이 아니라 이번 diff 가 그 갭의 적용 범위를 한 곳(`claimSpawnedRetryRow`) 늘렸을 뿐이다.
  - 제안: 우선순위는 plan 문서를 따르되(P2), 여유가 있으면 `claimSpawnedRetryRow` 동시 호출 2개를 실제 테스트 DB 에 던져 affected 합계가 1이 되는지 확인하는 좁은 integration 테스트 1개를 추가하는 편이 향후 회귀 방지에 비용 대비 효과적이다.

## 정상 확인 사항 (참고용 — 문제 아님)

다음은 DB 관점에서 특히 주의 깊게 봤으나 **문제를 발견하지 못한** 지점이다(회귀
가능성이 높은 영역이라 명시적으로 기록):

- **opt-in SQL 확장의 3개 소비처 전수 확인**: `NON_TERMINAL_OR_FAILED_STATUSES_SQL`
  (execution-engine.service.ts:534-543)이 실제로 쓰이는 지점은 정확히 3곳 —
  `lockNonTerminalExecutionRow`(8168-8184), 그 호출자
  `tryLockActiveExecutionAndSaveNodeExec`(8224-8253), 그리고
  `updateExecutionStatus` else 분기의 인라인 raw UPDATE(8443-8496) — 이며 `grep` 으로
  4번째 누락 소비처가 없음을 확인했다. 이전 라운드(2ca44b769)의 CRITICAL 이 정확히
  "일부 소비처에서만 opt-in 이 전파됨"이었던 결함 클래스라 이 완전성 확인이 중요했다.
- **opt-in 범위 격리**: `allowRetryReentry`/`retryReentry` 문자열을
  `form-interaction.service.ts`/`button-interaction.service.ts` 전체에서 grep 한 결과
  0건 — form/button 블로킹 인터랙션 경로는 이 opt-in 을 전혀 참조하지 않아 "FAILED
  Execution 은 일반 경로로 되살릴 수 없다"는 방어적 불변식이 그대로 유지된다.
- **opt-in 이어도 COMPLETED/CANCELLED 는 계속 배제**:
  `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 필터가 `!TERMINAL_STATUSES.has(status) ||
  status === FAILED` 라 opt-in 집합은 `{pending, running, waiting_for_input, failed}`
  로 한정되고 `completed`/`cancelled` 는 여전히 제외된다 — 진짜 동시 취소/완료는
  opt-in 여부와 무관하게 계속 차단된다.
- **SQL 인젝션**: 두 상태 리스트 상수 모두 `Object.values(ExecutionStatus)`(고정
  TS enum, 사용자 입력 아님)로 클래스 로드 시 1회 생성되고, `RETRY_STATE_KEY =
  '_retryState'`(retry-turn.service.ts:42) 도 컴파일 타임 리터럴이다. 두 값 모두
  raw SQL 문자열에 그대로 삽입되지만(파라미터 바인딩 아님) 사용자 제어 입력이
  섞이지 않으므로 인젝션 경로가 없다. `executionId`/`spawnedNodeExecutionId` 등 실제
  가변 입력은 전부 `$1`/`:id` 파라미터 바인딩을 사용한다.
- **트랜잭션 경계**: 짝 전이(Execution+NodeExecution)가 필요한 3곳
  (`tryLockActiveExecutionAndSaveNodeExec`, `updateExecutionStatus` 의
  `linkedNodeExec` 분기, `retryLastTurn` 의 atomic consume+spawn)은 모두
  `dataSource.transaction(...)` 으로 묶여 있어 부분 커밋 위험이 없다.
  `claimSpawnedRetryRow`/`updateExecutionStatus` else 분기의 단일 UPDATE 문은
  Postgres 단일 statement 원자성에 기대는 것으로 충분하며 별도 트랜잭션이 불필요한
  올바른 설계다.
- **인덱스/대량 데이터**: 이번 diff 로 추가·변경된 모든 쿼리(`lockNonTerminalExecutionRow`
  의 `SELECT ... FOR UPDATE`, `claimSpawnedRetryRow`, `updateExecutionStatus` else
  분기 UPDATE)는 전부 `id = $1`(PK 등가) 로 단일 행을 먼저 좁힌 뒤 나머지 조건을
  적용하는 형태라 풀스캔·신규 인덱스 필요성이 없다. `status` 컬럼은
  `execution.entity.ts`/`node-execution.entity.ts` 모두 `varchar(30)` (네이티브 enum
  아님)이라 리터럴 문자열 비교에 타입 캐스팅 이슈도 없다.
- **N+1**: `applyRetryLastTurn` 의 execution/node 조회는 `Promise.all` 병렬화된
  단건 조회 2개(반복문 아님)이며, 이번 diff 는 반복문 내 개별 쿼리를 추가하지
  않았다.
- **회귀 테스트**: `retry-turn.service.spec.ts`(66/66) ·
  `state-machine.spec.ts`(같은 스위트에 포함) · `execution-engine.service.spec.ts` ·
  `ai-turn-orchestrator.service.spec.ts` (527/527) 를 직접 실행해 전수 통과를
  확인했다. opt-in 포함/배제 양쪽 SQL 조건을 모두 단언하는 대조 테스트
  (`execution-engine.service.spec.ts:5115-5200` 부근)가 존재해 이번 수정의 mock
  레벨 회귀 방지력은 양호하다.

## 요약

이번 변경은 이전 라운드(8R)에서 발견된 "retry 재진입 짝 전이가 DB 가드에서
FAILED 를 무조건 배제해 항상 0행이 되던" CRITICAL 을 opt-in(`allowRetryReentry`)
SQL 조건 확장으로 수정하고, 9R 에서 그 opt-in 대상을 WAITING_FOR_INPUT(re-park
경로)까지 넓힌 것이다. DB 관점에서 3개 소비처 전수 전파, opt-in 범위의 안전한
격리(COMPLETED/CANCELLED 계속 배제, form/button 경로 미참조), 트랜잭션 경계,
파라미터 바인딩(SQL 인젝션 없음), PK 기반 쿼리(인덱스/스캔 문제 없음)를 모두
직접 대조·재현 실행(593 개 unit test 통과)으로 확인했으며 새로운 CRITICAL/WARNING
은 발견하지 못했다. 남은 두 관찰(2차 claim 실패 시 orphan RUNNING row 백스톱 부재,
raw JSONB SQL 의 실 Postgres 미검증)은 모두 코드 JSDoc 과
`plan/in-progress/retry-turn-terminal-guard.md` 에 이미 P2 로 추적 중인 기존
잔여 갭이며, 이번 diff 가 새로 만든 결함이 아니다.

## 위험도

LOW
