### 발견사항

- **[CRITICAL]** `reparkAiResumeTurn` 의 retry opts → DB 가드 번역 로직이 어느 테스트 계층에서도 검증되지 않는다 (뮤테이션으로 실증)
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` `reparkAiResumeTurn` 함수 457번째 줄
    (`opts?.retryReentry ? { allowRetryReentry: true } : undefined`), 이 함수를 호출하는 `processAiResumeTurn` 내부 4개 지점(237, 303, 321, 339번째 줄).
  - 상세: 8R CRITICAL 커밋(`2ca44b769`)이 고친 두 결정적 실패 경로 중 "(b) turn 계속(multi-turn 최빈)" — 커밋 메시지가 스스로 "가장 흔한 시나리오"라 명시한 경로 — 를 실제로 구동하는 이 한 줄이 회귀 테스트로 잠겨 있지 않다.
    직접 뮤테이션으로 실증: 이 줄을 `undefined` 로 되돌려(고정 인자로 치환) `state-machine.spec.ts` / `ai-turn-orchestrator.service.spec.ts` / `retry-turn.service.spec.ts` / `execution-engine.service.spec.ts` 4개 파일을 재실행한 결과 **593건 전원 GREEN** 이었다(0건 RED). e2e 디렉터리(`codebase/backend/test/`)에도 `retry_last_turn`/`applyRetryLastTurn`/`reparkAiResumeTurn` grep 결과 0건이라, 이 회귀를 잡아낼 다른 계층이 존재하지 않는다. 뮤테이션 적용 후 `cp` 백업으로 원복해 `git diff` 클린 확인 완료.
    근본 원인은 테스트가 관련된 두 계층을 각각 **고립** 검증만 하고 있다는 점이다 — (1) `state-machine.spec.ts` 가 `canTransition(FAILED, WAITING_FOR_INPUT, {allowRetryReentry:true})` 를 직접 호출해 상태머신 계층만, (2) `execution-engine.service.spec.ts` 의 9R 신규 테스트(5115~5137번째 줄, `opt-in 시 짝 전이가 FAILED → WAITING_FOR_INPUT 를 persist 한다`)가 `priv().updateExecutionStatus(exec, WAITING_FOR_INPUT, nodeExec, {allowRetryReentry:true})` 를 손으로 구성해 DB 가드 계층만 검증한다. 두 계층을 실제로 이어주는 **orchestrator 의 번역 로직**(`opts.retryReentry` boolean → `{allowRetryReentry:true}` 객체 shape 변환) 자체를 통과하는 테스트가 없다.
    `ai-turn-orchestrator.service.spec.ts` 의 `describe('reparkAiResumeTurn — EngineDriver seam', ...)` (111번째 줄, `ReparkSubject` 타입 112~119번째 줄)는 이 정확한 함수를 mock driver 로 직접 구동하는 이상적인 저비용 하네스를 이미 갖추고 있다. 그런데 8R 커밋 diff 를 확인해 보면 기존 5개 `it()` 에 `driver.updateExecutionStatus` 어서션 4번째 인자로 `undefined` 를 기계적으로 추가했을 뿐(신규 케이스 없음), `{retryReentry:true}` 를 넘기는 케이스는 한 번도 추가되지 않았다. 9R 커밋 메시지는 "multi-turn continuation 을 통합으로 재현하려 했으나 핸들러 반환 형태를 정확히 맞춰야 해... 그 시도는 철회" 라고 명시하는데, 이 describe 블록은 continuation 재현이 전혀 필요 없는 이미 존재하는 저비용 대안이라 그 철회 사유가 적용되지 않는다.
  - 제안: `describe('reparkAiResumeTurn — EngineDriver seam', ...)` 에 아래 형태의 테스트 1건 추가(기존 하네스 그대로 재사용, `ReparkSubject` 타입에 5번째 `opts?: { retryReentry?: boolean }` 파라미터만 추가):
    ```ts
    it('retryReentry:true 시 driver.updateExecutionStatus 에 { allowRetryReentry: true } 를 전달한다', async () => {
      await (orchestrator as unknown as ReparkSubject).reparkAiResumeTurn(
        savedExecution, context, nodeExec, reparkNode as Node, { retryReentry: true },
      );
      expect(driver.updateExecutionStatus).toHaveBeenCalledWith(
        savedExecution, ExecutionStatus.WAITING_FOR_INPUT, nodeExec, { allowRetryReentry: true },
      );
    });
    ```
    대조군(`retryReentry` 미전달 시 `undefined` 전달)은 이미 기존 5개 테스트가 커버하므로 신규 1건이면 충분하다.

- **[WARNING]** `tryLockActiveExecutionAndSaveNodeExec` 의 "RUNNING 유지" 분기 opts 전파 — 무검증이며 현재 도달 경로가 없어 보인다
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` `finalizeAiNode` "RUNNING 유지" 분기 1600번째 줄(`allowRetryReentry ? { allowRetryReentry: true } : undefined`); 대응 고립 단위테스트 `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts` `describe('finalizeAiNode — RUNNING 유지 분기 선점 ...', ...)` (497번째 줄, `callFinalizeRunning` 헬퍼 519~528번째 줄)과 `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` `describe('tryLockActiveExecutionAndSaveNodeExec — RUNNING 유지 분기 전용 원자 관측+save', ...)` (5495번째 줄).
  - 상세: 8R 커밋이 "세 번째 잠금 소비처"로 지목한 `tryLockActiveExecutionAndSaveNodeExec` 호출부는 실제로 **두 곳**이다 — isFailed 분기(1508번째 줄)와 RUNNING-유지 분기(1600번째 줄). 각각 독립적으로 뮤테이션(4번째 인자를 `undefined` 고정)해 확인한 결과: isFailed 분기(1508번째 줄) 뮤테이션은 `execution-engine.service.spec.ts` 의 `re-failure (retryable again) → Execution FAILED + NODE_FAILED on spawned row` 테스트(16946번째 줄)가 즉시 RED 로 포착한다(`expect(failedEvents.length).toBe(1)` 실패) — 이 지점은 정상적으로 가드되고 있다. 그러나 RUNNING-유지 분기(1600번째 줄) 뮤테이션은 동일한 593건 전체가 그대로 GREEN 이다 — 이 분기의 opts 전파는 어떤 테스트로도 검증되지 않는다.
    코드 추적 결과, 이 분기는 `savedExecution.status === 'running'` 일 때만 실행되는데, retry 재진입 흐름은 `finalizeAiNode` 호출 전 의도적으로 `execution.status` 를 미리 RUNNING 으로 바꾸지 않는다 — `retry-turn.service.ts` 429~434번째 줄 주석이 "여기서 미리 RUNNING 으로 옮기면 finalizeAiNode 의 RUNNING → RUNNING 전이가 invalid 가 되므로 전이를 finalize 단계로 미룬다" 고 그 이유를 명시한다. 즉 이 분기에 `retryReentry:true` 가 전달되면서 동시에 `savedExecution.status==='running'` 인 조합이 현재 호출 그래프상 도달하지 않아 보인다 — 사실상 방어적 코드다. 방어적으로 opts 를 통과시켜 둔 것 자체는 안전하지만, sibling 인 `updateExecutionStatus` 계열(같은 8R/9R 이 수정한)은 else 분기·linkedNodeExec 분기 모두 직접 focused 단위테스트를 받았는데(5115~5202번째 줄), 이 분기와 그 고립 단위테스트 두 곳(`describe` 헤더 기준 위 두 곳)은 `opts` 파라미터 자체를 타입 시그니처에도 반영하지 않아 8R 변경이 있었다는 사실조차 이 describe 만 보면 드러나지 않는다.
  - 제안: (1) 이 경로가 정말 도달 불가능한지 한 번 더 확인하고, 도달 불가능이 맞다면 `finalizeAiNode` JSDoc 에 "이 분기의 `allowRetryReentry` 스레딩은 현재 retry 흐름에서 도달하지 않는 방어적 코드"임을 명시(다음 리뷰어/개발자가 "이미 테스트됐다"고 오인하지 않도록). (2) 만약 향후 리팩터로 도달 가능해질 수 있다고 판단되면, sibling(isFailed 분기)과 대칭으로 `{retryReentry:true}` 를 통과시키는 직접 단위테스트를 두 describe 모두에 추가.

- **[WARNING]** `applyRetryLastTurn` 통합 describe 에 "turn 계속(re-park)" 시나리오가 전무 (이미 문서화된 트레이드오프, 위 CRITICAL 과 결합 시 영향 확대)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` `describe('applyRetryLastTurn (multi-turn loop re-entry)', ...)` (16785번째 줄).
  - 상세: 이 describe 는 `{ provide: ENGINE_DRIVER, useExisting: ExecutionEngineService }` 로 실제 엔진을 배선해(440번째 줄) `RetryTurnService`/`AiTurnOrchestrator` 를 종단간(end-to-end) 구동하는 유일한 장소다. 그러나 `installReentry`/`terminalSuccess` 헬퍼가 항상 `status:'ended'` 만 반환해 "성공 즉시 종료"(16905, 16934번째 줄)와 "재실패"(16946번째 줄) 시나리오만 커버하고, turn 이 계속돼 re-park 되는 시나리오는 이 describe 어디에도 없다(`awk`+grep 로 16785~16989 구간 전수 확인, `PARK_RELEASED`/`re-park` 문자열 0건). 9R 커밋 메시지가 "multi-turn continuation 을 통합으로 재현하려 했으나 핸들러 반환 형태를 정확히 맞춰야 해 FOR UPDATE 잠금에 도달조차 못했다(그 시도는 철회)" 라고 명시적으로 밝힌 그대로이므로 이번에 새로 발견된 결함은 아니다. 다만 위 CRITICAL 항목과 결합하면, "turn 계속" 경로는 상태머신 계층과 DB-가드 계층 각각의 고립 단위테스트를 제외하면 **어떤 테스트도 실제 호출 체인을 타고 검증하지 않는다**는 사실이 강조된다.
  - 제안: 통합 재현이 막힌 정확한 이유(어떤 핸들러 반환 shape 이 `FOR UPDATE` 도달을 막았는지)를 `plan/in-progress/retry-turn-terminal-guard.md` 류 문서에 남겨, 다음 라운드가 같은 시도를 반복 소모하지 않게 할 것. 최소 방어선으로는 위 CRITICAL 항목의 저비용 대안(`reparkAiResumeTurn` 직접 단위테스트)을 우선 적용.

- **[INFO]** `retry-turn.service.spec.ts` 는 `applyRetryLastTurn → processAiResumeTurn` 호출에 `{ retryReentry: true }` 가 실제로 실렸는지 인자 단언이 없다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts` — `mockAiTurnOrchestrator.processAiResumeTurn` 을 설정하는 모든 지점(653, 671, 706, 729, 747, 780, 821, 854번째 줄)이 반환값(`mockResolvedValue`/`mockImplementation`)만 설정하고, `toHaveBeenCalledWith(...)` 로 8번째 인자(`{retryReentry:true}`)를 검증하는 곳은 없다(grep 확인, 매치 0건).
  - 상세: `retry-turn.service.ts` 458~467번째 줄의 실제 호출은 `{ retryReentry: true }` 를 정확히 싣고 있으나(코드 확인 완료), 이 서비스 단위 테스트는 orchestrator 를 전부 mock 하므로 이 인자가 빠지는 회귀가 나더라도 이 파일에서는 잡히지 않는다. 다행히 `execution-engine.service.spec.ts` 의 진짜 엔진 배선 테스트(16946번째 줄 등)가 이 인자 유실을 간접적으로 잡아내므로 완전한 사각지대는 아니지만, 실패 시 에러 메시지가 "어떤 이벤트가 안 왔다"는 우회적 신호라 원인 특정에 시간이 걸린다.
  - 제안: `retry-turn.service.spec.ts` 의 아무 happy-path 테스트 한 곳에 `expect(mockAiTurnOrchestrator.processAiResumeTurn).toHaveBeenCalledWith(..., { retryReentry: true })` 한 줄을 추가하면 국지적이고 빠른 실패 신호를 얻을 수 있다.

- **[INFO]** (긍정적 관찰) `mockTxManagerQuery` 의 "정직한 mock" 전환은 테스트 품질을 실질적으로 개선했다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 267~277번째 줄.
  - 상세: 8R 커밋 이전에는 이 mock 이 SQL/status 무관하게 항상 잠금 성공(`[{id}]`)을 반환해, DB 가드가 FAILED 를 배제한다는 사실을 8라운드 동안 은폐했다(커밋 메시지 자기진단). 지금은 SQL 의 `status IN (...)` 리터럴과 `dbExecutionStatus` 를 실제로 대조하는 방식으로 바뀌어, 이번 리뷰의 CRITICAL 뮤테이션 검증에서도 이 mock 의 정직성 덕에 실패 신호가 명확했다(9R 신규 focused 테스트가 정확히 이 계층에서 RED 를 낼 수 있었던 이유). Mock 설계 관점에서 우수한 개선이다.

### 요약

state-machine 의 opt-in 확장(FAILED→RUNNING/WAITING_FOR_INPUT)과 DB 가드 SQL(`NON_TERMINAL_OR_FAILED_STATUSES_SQL`)에 대해서는 8R/9R 이 각 계층을 직접 겨냥한 focused 단위테스트를 촘촘히 추가했고(state-machine.spec.ts, execution-engine.service.spec.ts 양쪽 다 opt-in/비opt-in 대조 쌍 확보), `finalizeAiNode` isFailed 분기의 opts 전파는 `execution-engine.service.spec.ts` 의 실제 엔진 배선 통합 테스트(re-failure 시나리오)가 잘 가드하고 있음을 뮤테이션으로 직접 확인했다. 그러나 8R 커밋이 "가장 흔한 시나리오"라 부른 "(b) turn 계속 → re-park" 경로를 실제로 구동하는 `AiTurnOrchestrator.reparkAiResumeTurn` 의 opts 번역 로직(상태머신 계층과 DB-가드 계층을 잇는 유일한 glue code)은 뮤테이션 실증 결과 4개 관련 스펙 파일 593건 전체와 e2e 전체에서 단 1건도 검증하지 못했다 — 두 계층이 각각 고립 테스트로는 옳아도 그 둘을 잇는 배선이 끊어져도 아무도 모른다는 뜻이다. 같은 패턴(방어적으로 opts 를 넘겨 두었지만 실제 도달 경로가 불명확한 채 무검증인 지점)이 `tryLockActiveExecutionAndSaveNodeExec` 의 "RUNNING 유지" 분기에도 있다. 이 프로젝트가 정확히 이 결함 클래스(opts/flag 가 여러 호출부 중 일부에서만 전파돼 DB 가드에 도달하지 못함)로 8~9 라운드에 걸쳐 반복 CRITICAL 을 내온 이력을 고려하면, 이번에 확인된 무검증 glue code 는 다음 리팩터에서 같은 결함이 재발해도 전체 테스트 스위트가 GREEN 을 유지할 실질적 위험으로 이어진다. 다행히 교정 비용은 낮다 — 이미 존재하는 mock-driver 단위테스트 하네스에 케이스 1~2건만 추가하면 된다.

### 위험도
HIGH
