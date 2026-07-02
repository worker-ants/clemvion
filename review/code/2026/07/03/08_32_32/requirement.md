### 발견사항

- **[INFO]** spec fidelity — 코드와 `spec/5-system/4-execution-engine.md` §7.5/§1.1/§1.2/§7.4/Rationale, `spec/data-flow/3-execution.md` §1.4/§3.2 이 line-level 로 정확히 일치
  - 위치: `execution-engine.service.ts:862-920`(`claimResumeEntry`), `:2475-2515`(`markNodeExecutionFailed`), `:2569-2649`(`recoverStuckExecutions` cascade), `:962-1023`(`rehydrateAndResume` 상태 가드), `ai-turn-orchestrator.service.ts:330-349`(`reparkAiResumeTurn`)
  - 상세: 확인한 8개 spec 주장이 전부 구현과 정합함 — (1) claim 이 단일 트랜잭션으로 NodeExecution→Execution 순서로 조건부 UPDATE, (2) `affected=0` 시 discard, (3) `WAITING_FOR_INPUT ∪ RUNNING` 재개-가능 상태 가드, (4) `markNodeExecutionFailed` 가 WAITING/RUNNING 둘 다 대상, (5) `recoverStuckExecutions` 가 회수된 Execution 의 자식 RUNNING NodeExecution 을 cascade FAILED, (6) `waiting_for_input → running` 이 이미 `ALLOWED_TRANSITIONS` 표에 존재해 신규 전이 추가가 아님(state-machine.ts:18-19), (7) `driveResumeAwaited`/`driveCallStackResume` 가 `savedExecution.status !== RUNNING` 가드로 claim 후 중복 전이(RUNNING→RUNNING throw)를 회피, (8) `reparkAiResumeTurn` 이 claim 후 RUNNING 으로 로드된 nodeExec 를 명시적으로 WAITING_FOR_INPUT 으로 되돌림. `plan/in-progress/spec-draft-c2-atomic-claim.md` rev2 가 consistency-check Critical(rationale_continuity, L1252 "2단계 전이 기각"과의 충돌)을 해소한 근거(claim 은 진입 gate 전용, 기존 direct finalization 전이는 재서술 없음, `running → failed` 는 claim 후에만 발생하는 별개 finalize 경로)도 실제 코드(§7.5 "두 실패 경로 구분" 문단, `markNodeExecutionFailed` WAITING/RUNNING 동시 타깃)와 정확히 일치한다.
  - 제안: 없음(현행 유지). SPEC-DRIFT 아님 — spec 이 코드와 동시에(같은 커밋 세트) 갱신됐고 line-level 일치 확인됨.

- **[INFO]** 엣지 케이스 처리 — legacy/빈 nodeExecutionId sentinel, 동시 cancel 레이스, 동시 재개 레이스 모두 테스트로 커버
  - 위치: `execution-engine.service.ts:866-871`(`__no_node_exec__`/빈 문자열 → claim 우회 true), `:887-906`(Execution 짝 UPDATE affected=0 → node claim 도 tx 롤백), `execution-engine.service.spec.ts:466-484`(`Promise.all` 동시 claim 중 정확히 하나만 승리)
  - 상세: `cancelParkedExecution` 의 비원자 exec/node UPDATE 창(exec=CANCELLED, node=WAITING)에서 claim 이 node 만 잡는 엣지 케이스를 Execution 짝 UPDATE 의 `WAITING_FOR_INPUT ∪ RUNNING` 조건으로 감지해 tx 전체를 롤백하는 설계가 정확히 구현·테스트됨. 빈 문자열/`__no_node_exec__` sentinel 은 트랜잭션 자체를 열지 않고 즉시 `true` 반환(`ds().dataSource.transaction).not.toHaveBeenCalled()` 로 검증).
  - 제안: 없음.

- **[INFO]** 반환값·에러 전파 — `claimResumeEntry` 의 catch 가 "짝 불일치"(정상 discard, `false`)와 "그 외 DB 오류"(재throw, BullMQ job 재시도 유발)를 정확히 구분
  - 위치: `execution-engine.service.ts:909-913`
  - 상세: `execMismatch` 클로저 플래그로 두 실패 유형을 구분한다. TypeORM `DataSource.transaction()` 은 기본적으로 콜백을 자동 재시도하지 않으므로(직렬화 실패 시 재시도 로직 없음) 클로저 변수 재사용에 따른 stale-state 위험은 없음을 확인.
  - 제안: 없음.

- **[INFO]** TODO/FIXME — 변경 파일들에서 미완성 작업 시사 주석 없음
  - 상세: `execution-engine.service.ts` 에 `TODO(PR2): trigger type threading` 1건이 있으나 본 changeset 과 무관한 기존 코드(라인 2739, triggerType 관련) — 이번 06 C-2 변경 범위 밖.

- **[INFO]** 테스트 실행 결과 — 변경된 3개 핵심 스펙 파일 전부 통과
  - 상세: `npx jest execution-engine.service.spec.ts continuation-execution.processor.spec.ts ai-turn-orchestrator.service.spec.ts` → 418 passed, 0 failed. 로그에 나타난 `ERROR` 라인은 테스트가 의도적으로 주입한 실패 시나리오의 logger.error 호출(테스트 스스로 `mockRejectedValue`/throw 로 유발하고 assertion 대상)이며 실제 실패 아님.

### 요약

06 C-2(재개 진입 DB 원자 claim) 변경은 기능적으로 완전하며 spec(`4-execution-engine.md` §7.5/§1.1/§1.2/§7.4/Rationale, `data-flow/3-execution.md` §1.4/§3.2)과 line-level 로 정확히 일치한다. 핵심 동시성 불변식(동일 turn 이중 실행 0)을 비원자 SELECT 재검증에서 조건부 원자 UPDATE 로 전환하면서, 짝 상태(Execution↔NodeExecution) 단일 트랜잭션 처리·claim 실패 시 롤백·claim 후 rehydration 실패의 RUNNING→FAILED terminal 마감·크래시 잔여 RUNNING 의 `recoverStuckExecutions` cascade 회수까지 모든 실패 경로가 빠짐없이 구현·테스트됐다. rationale-continuity 관점에서 우려됐던 "2026-06 결정(WFI→running→failed 2단계 전이 기각)과의 충돌"은 spec draft rev2 에서 "claim 은 진입 gate 전용, 기존 finalization 전이는 재서술 없음"으로 정면 해소됐고 코드 구현도 그 논거(claim 후 발생하는 LLM throw 는 이미 running 상태에서의 별개 finalize)와 정확히 일치한다. TODO/FIXME 잔존 없음, 엣지 케이스(legacy sentinel, 동시 cancel, 동시 재개 레이스) 전부 테스트 커버, 관련 3개 스펙 파일 418 테스트 전부 통과. CRITICAL/WARNING 급 발견사항 없음.

### 위험도
NONE
