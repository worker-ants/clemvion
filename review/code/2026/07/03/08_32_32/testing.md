### 발견사항

- **[WARNING]** `driveResumeAwaited`/`processAiResumeTurn` (ai_message) 의 신규 RUNNING skip-guard 가 unit 테스트로 검증되지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1890`, `:2066` (`if (savedExecution.status !== ExecutionStatus.RUNNING) { await this.updateExecutionStatus(...) }`)
  - 상세: 이 diff 의 핵심 변경 중 하나로, claim 이후 `savedExecution.status === RUNNING` 이면 `updateExecutionStatus(RUNNING)` 재호출을 skip 해 `assertTransition` 의 RUNNING→RUNNING throw 를 회피한다. 그러나 `execution-engine.service.spec.ts` 어디에도 (a) savedExecution 이 이미 RUNNING 일 때 `updateExecutionStatus` 가 RUNNING 인자로 호출되지 **않음**을 확인하는 테스트, (b) savedExecution 이 WAITING_FOR_INPUT(legacy/직접 호출 경로)일 때는 여전히 호출됨을 확인하는 회귀 테스트가 없다. 두 곳 다 동일 패턴이 중복돼 있어 회귀 시 조용히 깨질 위험(RUNNING→RUNNING throw)이 두 배다.
  - 제안: `driveResumeAwaited`/ai_message 재개 경로 각각에 대해 (1) savedExecution.status=RUNNING → `updateExecutionStatus` 미호출(또는 RUNNING 인자 없이 미호출) 검증, (2) savedExecution.status=WAITING_FOR_INPUT → 기존처럼 RUNNING 전이 호출 검증하는 짝 테스트 추가.

- **[WARNING]** `claimResumeEntry` 의 "동시 재개" 테스트는 실제 DB 레벨 원자성을 검증하지 않음 (mock 시나리오 사전 스크립팅)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:1910-1928` (`'동시 재개 — 두 claim 중 하나만 승리'`)
  - 상세: `Promise.all` 로 두 `claimResumeEntry` 호출을 병렬 실행하지만, `dataSource.transaction` mock 은 `txCall` 카운터로 첫 호출은 승리·둘째는 패배하도록 **미리 결정**되어 있다. 즉 이 테스트는 "구현이 호출 순서대로 결과를 분기 처리하는 로직"만 검증할 뿐, 실제 DB 조건부 UPDATE 의 원자성(check-then-act 창 부재)은 전혀 검증하지 못한다 — 진짜 race 는 unit mock 으로 재현 불가능한 영역이다. 이 변경 자체의 목적(§7.5 "동일 turn 이중 실행 0" 불변식의 기계적 보장)을 실증하려면 실제 DB 트랜잭션 레이어에서의 검증이 필요하다.
  - 제안: plan draft(`spec-draft-c2-atomic-claim.md`) 의 "착수 조건" 에 명시된 "동일 (executionId, nodeExecutionId) 2회 동시 재개 시 한쪽만 진행 unit + form park 에 continuation job 2건 인위 enqueue 후 turn 이중 실행 0 dockerized e2e" 가 아직 이 PR 에 포함되어 있는지 확인. `codebase/backend/test/execution-park-resume.e2e-spec.ts`, `workflow-execution.e2e-spec.ts` 어디에도 `claimResumeEntry` 참조가 없어 e2e 가 아직 부재한 것으로 보인다 — 후속 작업으로 반드시 추적할 것(테스트명 "동시 재케" 가 실제 레이스를 검증한다는 오해를 줄 수 있으므로 주석에 "mock 시나리오, 실제 원자성은 e2e 대상" 명시도 권장).

- **[INFO]** `reparkAiResumeTurn` 의 `nodeExec === null` 분기는 이번 변경으로 커버리지 갭이 생기지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:340-342`
  - 상세: `if (nodeExec) { nodeExec.status = WAITING_FOR_INPUT }` 가드가 추가됐고, 기존 첫 번째 테스트(`stageDurableResumeSnapshot + updateExecutionStatus(WAITING_FOR_INPUT) 를 driver 로 위임`, L108)는 `nodeExec = { id: 'ne-1' }`(status 필드 없음)로 신규 코드가 `nodeExec.status` 를 덮어써도 부작용이 드러나지 않는 형태다. `nodeExec === null` 전달 케이스(레거시 `__no_node_exec__` 경로 등)에 대한 explicit 테스트는 없으나, 이 분기는 방어적 가드일 뿐 로직 변경이 아니므로 위험도는 낮음.
  - 제안: 선택 사항 — `reparkAiResumeTurn(savedExecution, context, null)` 호출 시 throw 없이 `driver.updateExecutionStatus(savedExecution, WAITING_FOR_INPUT, undefined)` 로 위임되는지 확인하는 짧은 테스트를 추가하면 완전성이 높아진다.

- **[INFO]** `claimResumeEntry` 의 tx catch 절에서 `execMismatch` 클로저 변수 재사용에 대한 테스트 없음 (동일 인스턴스 재호출 시 상태 누수 가능성 이론적 검토)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:872, 903-912`
  - 상세: `execMismatch` 는 함수 로컬 변수(매 호출마다 새로 선언)이므로 실제로는 상태 누수가 없다 — 코드를 재확인한 결과 문제 없음. 다만 "노드 claim 성공 + exec 짝 UPDATE 도 실패 아님 + 그 후 다른 이유로 알 수 없는 Error가 throw" 되는 케이스(예: DB 커넥션 에러)가 `execMismatch=false` 상태에서 전파되는지("그 외 DB 오류는 전파" 주석대로) 검증하는 테스트가 없다.
  - 제안: `claimResumeEntry` 에 "tx 콜백이 execMismatch 와 무관한 임의 Error 를 throw 하면 그대로 rethrow(false 로 삼키지 않음)" 테스트를 1개 추가하면 catch 분기 전체(2개 분기: mismatch→false, 기타→rethrow)가 커버된다. 현재는 mismatch 분기만 간접 커버(`node claim 성공하나 Execution terminal` 테스트)되고 rethrow 분기는 미검증.

- **[INFO]** `execution-engine.service.spec.ts` 의 `RUNNING(claim 후) → status 가드 통과` positive 테스트가 이후 흐름을 sentinel throw 로 조기 종료시켜, RUNNING 상태 rehydration 의 실제 다운스트림 동작(rehydrateContext 인자 등)은 검증 범위 밖
  - 위치: `execution-engine.service.spec.ts:567-589` (`'Execution/NodeExecution RUNNING(claim 후) → status 가드 통과, rehydrate 진입'`)
  - 상세: 의도적으로 "가드 통과 여부"만 확인하는 좁은 테스트로 설계되어 있고 주석에도 "본 테스트 범위 밖" 명시가 있어 문제라기보다 설계 의도다. 다만 rehydrateContext 에 전달되는 `execution`/`nodeExec` 객체가 status=RUNNING 상태 그대로 넘어가는지(예: `rehydrateContext` 내부가 여전히 WAITING_FOR_INPUT 을 전제하는 로직이 있는지)는 별도 검증이 없다.
  - 제안: 우선순위 낮음. `rehydrateContext` 자체가 status 를 참조하지 않는다면(코드 확인 권장) 현재 범위로 충분.

### 요약

이번 변경(06 C-2, §7.5 재개 진입 원자 claim)은 테스트 밀도가 전반적으로 높다 — `claimResumeEntry` 의 성공/실패/짝-불일치-롤백/legacy-우회 4개 경로, `markNodeExecutionFailed` 의 RUNNING 포함 회귀 가드, `recoverStuckExecutions` 의 cascade FAILED, re-park 의 RUNNING→WAITING 재설정, processor 의 메서드 rename 전파까지 빠짐없이 스펙이 갱신됐고 mock 구조(qb 체인, tx 콜백 순서 반환)도 실제 TypeORM QueryBuilder 사용 패턴과 합리적으로 일치한다. 다만 이 변경의 핵심 위험(레이스 컨디션의 실제 원자성)은 본질적으로 unit mock 으로 증명 불가능한 영역이며, plan draft 자체가 명시한 "착수 조건"(동시성 e2e)이 현재 diff 범위에는 보이지 않아 실질 검증 갭으로 남아있다. 또한 `driveResumeAwaited`/ai_message 재개 경로에 새로 추가된 RUNNING skip-guard(2곳, 거의 동일 패턴 중복) 자체를 직접 겨냥한 단위 테스트가 빠져 있어, 이 diff 가 도입한 변경 중 유일하게 전용 회귀 가드가 없는 지점이다. 나머지는 CRITICAL 급 문제 없음.

### 위험도
MEDIUM
