# Database Review — ie-resume-signal / turn-boundary-cancel + park 짝 전이 lost-update

## 발견사항

- **[INFO]** 짝 전이 실패 시 `NodeExecution` terminal 마킹이 `Execution` 행을 판정한 트랜잭션과 별도로(비원자적으로) 수행됨
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:347` (`assertLinkedTransitionApplied`, `nodeExec.outputData = {}; nodeExec.error = {}; await this.driver.markNodeCancelled(...)` 호출부), 대응 구현은 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8125`(`updateExecutionStatus` 의 `SELECT ... FOR UPDATE` 트랜잭션, 8182~8199 라인)과 `execution-engine.service.ts:4586`(`markNodeCancelled`, 별도 `nodeExecutionRepository.save`)
  - 상세: `updateExecutionStatus` 의 `linkedNodeExec` 분기는 이번 변경으로 `SELECT id FROM execution ... FOR UPDATE` 를 트랜잭션 안에서 실행해 Execution 행의 lost-update 는 정확히 닫혔다(좋은 개선). 그런데 그 트랜잭션이 커밋된 **이후**, 호출부(`assertLinkedTransitionApplied`)가 짝이었던 `NodeExecution` 을 terminal(`CANCELLED`) 로 마킹하는 `markNodeCancelled` 는 별도의 독립된 `save()` 호출이다 — 같은 트랜잭션/같은 행 잠금 범위에 있지 않다. Execution 행을 이미 terminal 로 판정한 순간과 NodeExecution 을 CANCELLED 로 실제 영속하는 순간 사이에 프로세스 크래시가 나면, 정확히 이번 수정이 막으려던 것과 같은 종류의 결함(“non-terminal 로 영구 잔류”)이 NodeExecution 쪽에서 재발할 수 있는 좁은 창이 남는다.
  - 제안: 크래시 윈도우가 실제로 문제인지(현재 stalled/recovery 백스탑이 이 케이스를 커버하는지)를 확인하고, 커버하지 않는다면 `markNodeCancelled` 의 save 를 동일 트랜잭션(`manager`)으로 전달받아 Execution 판정과 원자적으로 묶는 것을 고려. 다만 이번 PR 의 핵심 결함(park↔resume 짝 전이의 lost update)은 Execution 행 기준으로는 이미 올바르게 닫혔으므로 CRITICAL 로 보지는 않음.

- **[INFO]** SQL `IN (...)` 절을 문자열 보간으로 구성(파라미터 바인딩 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:507` (`NON_TERMINAL_STATUSES_SQL` 정의), 사용처 `execution-engine.service.ts:8186`·`8227`
  - 상세: `AND status IN (${ExecutionEngineService.NON_TERMINAL_STATUSES_SQL})` 는 사용자 입력이 아니라 TS 문자열 enum(`ExecutionStatus`) 값에서 클래스 로드 시 1회 계산되므로 SQL 인젝션 경로는 없음(코드 주석에도 명시). `id` 바인딩(`$1`)은 정상 파라미터화. 일반적으로 "raw SQL 문자열 조립" 은 리뷰 관점에서 항상 주의 신호이지만, 이 경우는 안전하다고 판단.
  - 제안: 현재로도 안전하나, 향후 이 상수에 사용자 제어 가능한 값이 섞이지 않도록(예: 동적 status 필터 확장 시) 계속 enum-derived 로만 유지할 것.

- **[INFO]** `updateExecutionStatus` 의 `false` 반환 계약을 소비하지 않는 4개 호출부(Form/Button interaction park·재claim)가 여전히 남아 있음
  - 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:44`(`CoreEngineDriver.updateExecutionStatus` JSDoc, WARNING #3 각주)
  - 상세: 이번 PR 은 AI 경로(re-park/첫 turn park/retry-last-turn RUNNING 재claim) 3곳만 새 `assertLinkedTransitionApplied` 로 반환값을 소비하도록 고쳤다. 나머지 4곳(Form/Button)은 DB 쓰기 자체는 이 트랜잭션/락 가드로 안전(no-op 시 실제 UPDATE/save 가 일어나지 않음)하지만, 호출부가 `false` 를 무시하고 그대로 진행하면 이미 취소된 실행에 대해 "정상 park" 이벤트가 잘못 emit 되는 표시 불일치가 남는다. 저자가 코드/plan(`ie-resume-turn-boundary-cancel.md` "후속(본 PR 밖)")에 이미 명시적으로 추적 중이라 이번 diff 의 새 결함은 아님.
  - 제안: 별도 후속 작업으로 이미 추적되고 있으므로 이번 PR 에서 추가 조치 불필요. 후속 착수 시 동일한 `assertLinkedTransitionApplied` 패턴 재사용 권장.

## 요약

핵심 변경은 `ExecutionEngineService.updateExecutionStatus` 의 `linkedNodeExec`(park↔resume 짝 전이) 분기에 `SELECT ... FOR UPDATE` 행 잠금을 도입해, 턴 진행 중 동시 Stop 이 Execution 을 CANCELLED 로 마감한 뒤에도 stale in-memory 엔티티의 full-entity save 가 그 취소를 덮어쓰는 lost-update(검사-후-사용 race)를 트랜잭션 경계 안에서 원자적으로 차단한 것이다. 잠금은 커밋까지 유지되고, 비-terminal 상태 리스트는 SQL 리터럴 중복을 제거해 단일 출처(`ExecutionStatus` enum 파생, 사용자 입력 아님)로 통합했으며, `id` 바인딩은 정상 파라미터화돼 있어 SQL 인젝션 우려는 없다. `recordRunningSegmentStart` 를 실제 영속 성공(`persisted===true`) 이후로 미룬 것도 in-memory 자원 누수를 막는 타당한 보정이다. N+1 패턴이나 신규 스키마/마이그레이션 변경은 없으며, 커넥션은 TypeORM `dataSource.transaction` 이 표준적으로 관리한다. 유일한 잔여 관찰점은 짝이었던 `NodeExecution` 의 terminal 마킹(`markNodeCancelled`)이 Execution 판정 트랜잭션과 원자적으로 묶여 있지 않다는 점과, Form/Button 경로 4곳이 아직 반환값을 소비하지 않는다는 점인데 둘 다 이미 문서화된 좁은 후속 범위다.

## 위험도

LOW
