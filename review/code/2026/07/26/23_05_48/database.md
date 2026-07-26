# Database Review — ie-resume-signal / turn-boundary-cancel + park 짝 전이 lost-update (4차 라운드)

## 발견사항

- **[INFO]** 짝 `NodeExecution` terminal 마킹(`markNodeCancelled`)이 Execution 을 판정한 `FOR UPDATE` 트랜잭션과 분리된 별도 `save()` 로 수행됨 — 3차 라운드에서 이미 식별된 항목이며 이번 라운드 diff 에서도 코드 변경 없이 그대로 남아 있다
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:360`(`assertLinkedTransitionApplied` 정의), `:376`(`markNodeCancelled` 호출) — 대응 구현은 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8208`(`updateExecutionStatus` 의 `linkedNodeExec` 분기, `FOR UPDATE` 트랜잭션)·`:8049`(`assertActiveExecutionAndSaveNodeExec`, 동일 패턴)·`:4586`(`markNodeCancelled` 구현, 독립 `nodeExecutionRepository.save`)
  - 상세: 두 choke point(`updateExecutionStatus` 의 `linkedNodeExec` 분기, `assertActiveExecutionAndSaveNodeExec`) 모두 이번 PR 로 `SELECT ... FOR UPDATE` 트랜잭션 안에서 Execution 행을 원자적으로 판정하도록 고쳐졌다(좋은 개선, Execution 행 기준 lost-update 는 정확히 닫힘). 그런데 판정 결과가 `false`(동시 Stop 이 이미 선점)일 때 호출부 `assertLinkedTransitionApplied` 가 수행하는 짝 `NodeExecution` 의 CANCELLED 마킹은, 그 트랜잭션이 이미 커밋(잠금 해제)된 **이후** 별도의 독립된 `save()` 다. Execution 을 terminal 로 이미 판정한 시점과 NodeExecution 을 실제로 CANCELLED 로 영속하는 시점 사이에 프로세스 크래시가 나면, 이 NodeExecution 은 non-terminal(RUNNING) 로 영구 잔류할 수 있다 — 정확히 이번 PR 이 Execution 행에서 막으려 한 것과 같은 성격의 결함이 NodeExecution 행 쪽에서 좁게 재발할 여지다.
  - 제안: stalled-job recovery 백스탑이 이 케이스(NodeExecution=RUNNING, 부모 Execution=CANCELLED)를 실제로 커버하는지 확인. 커버하지 않는다면 `markNodeCancelled` 의 save 를 `assertLinkedTransitionApplied` 호출부까지 같은 트랜잭션(`manager`)으로 전달해 Execution 판정과 원자적으로 묶는 것을 후속 검토. 낮은 우선순위(크래시 타이밍 창이 매우 좁음) — 3차 라운드에서도 CRITICAL 로 보지 않기로 이미 합의된 사안이라 이번 라운드에서 신규로 격상하지 않음.

- **[INFO]** SQL `IN (...)` 절을 문자열 보간으로 구성(파라미터 바인딩 아님) — 안전 확인, 반복 관측
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:507`(`NON_TERMINAL_STATUSES_SQL` 정의), 사용처 `:8058`(`assertActiveExecutionAndSaveNodeExec`), `:8235`(`updateExecutionStatus` linkedNodeExec 분기), `:8276`(else 분기)
  - 상세: `AND status IN (${ExecutionEngineService.NON_TERMINAL_STATUSES_SQL})` 는 사용자 입력이 아니라 `ExecutionStatus` enum 값에서 클래스 로드 시 1회 계산되는 상수라 SQL 인젝션 경로는 없다. `id`/`executionId` 바인딩은 모두 `$1`/`$2` 정상 파라미터화. 3개 사용처(else 분기·linkedNodeExec 분기·`assertActiveExecutionAndSaveNodeExec`)가 동일 상수를 공유해 이전 라운드의 리터럴 중복(`'pending', 'running', 'waiting_for_input'` 하드코딩 2곳)도 제거됐다.
  - 제안: 조치 불요. 향후 이 값이 사용자 제어 가능한 소스로 동적화될 경우에만 파라미터 바인딩(`= ANY($n::text[])`)로 전환 검토.

- **[INFO]** `assertExecutionNotCancelled` 가 AI turn 마다 스로틀 없이 신규 DB 재조회를 추가함
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:663`(turn 경계 가드, `handleAiMessageTurn` 진입 직후) — 기존 노드 dispatch 루프 호출부(`{throttle:true}`)와 대비
  - 상세: turn 경계마다(사용자 메시지 1건당 1회) primary key 조회 1건 추가는 통상 워크로드에서 미미하나, 고빈도 multi-turn 대화가 많은 워크로드에서는 누적 DB 부하가 될 수 있다. 인덱스 관점에서는 `id` PK 조회라 문제 없음 — 순수 호출 빈도 트레이드오프.
  - 제안: 조치 불요(의도된 트레이드오프, JSDoc 에 이미 명시). 실제 부하 문제 관측 시 스로틀 옵션 적용 검토.

## 요약

이번 4차 라운드 diff 는 3차 라운드에서 지적된 concurrency WARNING(#1, `finalizeAiNode` "이미 RUNNING 유지" 분기의 잔여 검사-후-사용 창)을 `assertActiveExecutionAndSaveNodeExec` 로 완전히 닫았다 — 형제 분기(`updateExecutionStatus` 의 `linkedNodeExec` 분기)와 동일하게 `SELECT ... FOR UPDATE` 트랜잭션 안에서 Execution 행 관측과 `NodeExecution` save 를 원자화해, DB 관점의 lost-update/TOCTOU 는 두 분기 모두 구조적으로 닫혔다. `NON_TERMINAL_STATUSES_SQL` 단일 출처화는 리터럴 중복 제거와 함께 3곳 전부에 일관 적용됐고, `id`/`executionId` 바인딩은 전부 파라미터화돼 SQL 인젝션 우려는 없다. 신규 마이그레이션·스키마 변경은 없으며, 커넥션은 TypeORM `dataSource.transaction`(관리형 트랜잭션)으로 표준적으로 획득·해제된다. N+1 패턴도 없다(모든 신규 쿼리는 단건 PK 조회/갱신이며 반복문 내 개별 쿼리 구조가 아니다). e2e 신규 쿼리(`node_execution` poll)도 파라미터화된 단건 조회로 안전하다. 유일한 잔여 관찰점은 짝 `NodeExecution` 의 terminal 마킹(`markNodeCancelled`)이 Execution 판정 트랜잭션과 원자적으로 묶여 있지 않다는 점인데, 이는 3차 라운드에서 이미 INFO/저우선순위로 합의된 좁은 크래시 윈도우이며 이번 diff 로 새로 도입되거나 악화된 것은 아니다.

## 위험도

LOW
