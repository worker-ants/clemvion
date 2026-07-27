# 요구사항(Requirement) Review — ie-resume-signal-6e933d (2026-07-26 23_05_48)

## 사전 확인 사항

본 diff 는 3라운드에 걸친 ai-review(`20_10_51` → `21_08_01` → `22_11_22`)가 이미 상세히 검토·수정한 누적 결과다(origin/main..HEAD 전 커밋 확인, 최신 커밋 `cc5f2920a` 는 3차 라운드 RESOLUTION.md). 이번 라운드는 그 결과물을 대상으로 **소스 파일을 직접 Read/Grep** 해 (a) 3차 라운드가 "닫았다"고 주장한 항목이 실제로 코드에 반영됐는지, (b) 새로운 요구사항 충족 갭이 있는지를 검증했다.

## 발견사항

### [WARNING] `handleAiMessageTurn` 이 LLM 호출 종료 후 취소 재확인 없이 `AI_MESSAGE`/`EXECUTION_WAITING_FOR_INPUT` 을 emit — CHANGELOG 가 표방하는 "Stop 이 조용히 무효화되던 문제" 해결이 클라이언트 체감(WS) 레벨에서는 완전하지 않음

- 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` `handleAiMessageTurn` — turn 경계 가드는 671번째 줄(`await this.driver.assertExecutionNotCancelled(executionId);`, handler 호출 **이전**)에서 1회만 실행된다. LLM 호출(`handler.processMultiTurnMessage`, 701-704번째 줄) 종료 후 waiting 분기는 838-936번째 줄에서 취소 재확인 없이 `AI_MESSAGE`(838-868) → `EXECUTION_WAITING_FOR_INPUT`(901-936)을 무조건 emit 하고, terminal 분기도 966-997번째 줄에서 동일하게 무조건 `AI_MESSAGE` 를 emit 한다. 실제 짝 전이 취소 가드(`assertLinkedTransitionApplied`)는 이 반환 이후 **별도 메서드**(`reparkAiResumeTurn`/`finalizeAiNode`)에서 실행된다.
- 상세: LLM 호출은 수 초~분 걸리는(이 PR 이 CHANGELOG/plan 에서 스스로 지목한 취약 구간) 반면, turn 경계 가드는 그 호출 **이전**에만 실행된다. 따라서 LLM 호출 도중 사용자가 Stop 을 누르면: (1) 이미 통과한 가드는 재실행되지 않고, (2) `handleAiMessageTurn` 은 응답이 오는 대로 "대화 계속"/"입력 대기" WS 이벤트를 클라이언트에 먼저 내보내며, (3) 그 다음에야 `reparkAiResumeTurn`(re-park) 혹은 `finalizeAiNode`(자연 종료, 신규 e2e 가 정확히 이 경로를 표적으로 함)의 짝 전이/`assertActiveExecutionAndSaveNodeExec` 가드가 취소를 관측해 `NODE_CANCELLED` 로 정정한다. DB/`NodeExecution` 최종 영속 상태는 안전(재개 불가, lost-update 없음 — 실제로 코드로 확인됨)하지만, 클라이언트가 실제로 받는 이벤트 **순서**는 "계속됨" → (뒤늦게) "취소됨" 이 되어, CHANGELOG 가 서술한 증상("사용자가 누른 Stop 이 조용히 무효화됐다", "실행이 다시 재개 가능 상태로 **보인다**")과 같은 결이 표시 계층에 남는다.
- 이 항목은 3차 라운드(`review/code/2026/07/26/22_11_22`) requirement 리뷰가 이미 지적(SUMMARY#2)했고, 저자(main)가 명시적으로 "본 PR 범위 밖" 으로 결정해 `plan/in-progress/ie-resume-turn-boundary-cancel.md` "## 후속 (본 PR 밖)" → "3차 라운드 추가 후속" 절(증상·영향·닫는 방법·FE 우선순위 확인 항목까지 명시)에 코드 변경 없이 등재했다(커밋 `f306a62c8`). 직접 코드를 재확인한 결과 그 결정이 아직 유효하며 emit 순서 자체는 바뀌지 않았음을 재확인한다 — **새로운 회귀가 아니라, 이미 추적 중인 기지 갭의 현재 상태 재확인**이다.
- 제안: (a) `handleAiMessageTurn` 의 두 emit 지점(waiting 분기의 AI_MESSAGE+EXECUTION_WAITING_FOR_INPUT, terminal 분기의 AI_MESSAGE) 직전에 `assertExecutionNotCancelled` 재확인을 추가해 취소 시 emit 을 skip 하고 `ExecutionCancelledError` 를 곧장 던지도록 하거나, (b) 이미 plan 에 명시된 대로 별도 후속 PR 로 처리한다 — 이번 PR 은 데이터 정합성(DB)만 다루기로 스코프가 확정돼 있으므로 이 자체로 착수를 막을 필요는 없다. 후속 PR 착수 전 FE 가 `NODE_CANCELLED`/`EXECUTION_CANCELLED` 를 지연 도착한 `EXECUTION_WAITING_FOR_INPUT`/`AI_MESSAGE` 보다 우선 적용하는지 확인이 선행돼야 한다(이미 plan 에 "확인 필요" 로 등재).

### [INFO / SPEC-DRIFT] `spec/conventions/node-cancellation.md` §2.1, `spec/5-system/4-execution-engine.md` §1.1·`## Rationale` §C-1 이 이번 구현과 line-level 로 어긋나 있음 — 이미 위임 완료 상태를 재확인

- 위치: `spec/conventions/node-cancellation.md:44` — IE 행이 "resume 경로는 turn 경계에서 abort 체크를 도입하는 별도 작업으로 추적"·"defense-in-depth timeout … 위 resume signal gap 과 무관하게 무기한 hang 을 상한한다" 는 서술을 여전히 담고 있다(직접 grep 확인). 이 서술은 이 PR 이 착수 시 무수정 프로브로 반증한 바로 그 문장이다 — 실제 결함은 응답성 갭이 아니라 park 짝 전이 lost-update(취소 소실)였다.
- 위치: `spec/5-system/4-execution-engine.md:79` — `## §1.1 원자성 보장` 절이 "재개 진입의 claim 도 이 원자성에 포함 … affected=0 이면 어느 쪽도 갱신하지 않는 no-op" 라고만 서술하고, 이번 PR 이 신규 도입한 "park↔resume 짝 전이(`linkedNodeExec` 분기) 자체도 동시 cancel 시 `false`(no-op)를 반환할 수 있다"는 계약은 반영돼 있지 않다(직접 grep 확인, 해당 절 어디에도 `FOR UPDATE`/짝 전이 no-op 서술 없음).
- 위치: `spec/5-system/4-execution-engine.md:1640` — `## Rationale` §C-1 이 "단일 12-멤버 계약"·`AiTurnEngineDriver` "7멤버"·`RetryEngineDriver` "8멤버" 를 여전히 서술한다. `engine-driver.interface.ts` 를 직접 세어 확인한 결과 현재 `EngineDriver` distinct 15(Core 2 + Interaction 1 + Reentry 1 + AiTurn 자체 6 + Retry 자체 5), `AiTurnEngineDriver` 합계 10 이 정확하다 — spec 수치(12/7)는 stale.
- 코드(`engine-driver.interface.ts:36-43`)가 스스로 이 stale 수치를 자각하고 `spec-update-node-cancellation-shutdown-classification.md` #7(보강 6~8번)로 정정을 위임해 뒀다 — 코드가 옳고 spec 이 아직 반영되지 않은 전형적 SPEC-DRIFT 다. `developer` 는 `spec/` 쓰기 권한이 없으므로 직접 수정하지 않은 처리는 규약에 맞다.
- 제안: 코드 변경 불필요. `project-planner` 턴에서 `spec-update-node-cancellation-shutdown-classification.md` #7(및 보강 6~8번)을 그대로 반영할 것 — (1) `node-cancellation.md` §2.1 IE 행 재서술 + §2.3/§6 신규 행, (2) `execution-engine.md` §1.1 "짝 전이도 no-op 될 수 있음" 케이스 추가, (3) `## Rationale` §C-1 의 12/7 → 15/10 정정(코드 실측치와 동일 턴에 재확인 — 3차 라운드 안에서도 14/9→15/10 으로 한 번 더 갱신된 이력이 있어, spec 반영 시점에 코드 수치를 다시 셀 것).

### [INFO] 핵심 결함(park 짝 전이 lost-update + turn 경계 cancel 미관측)은 코드 레벨에서 직접 검증 완료 — 기능 완전성 확인

- `updateExecutionStatus`(`execution-engine.service.ts`) 의 `linkedNodeExec` 분기가 `SELECT id FROM execution WHERE id = $1 AND status IN (...) FOR UPDATE` 로 대상 행을 잠근 뒤에만 `Execution`/`NodeExecution` save 를 수행하고, 0행(terminal)이면 `false` 를 반환해 lost-update 를 정확히 닫는다 — 직접 코드 확인.
- `finalizeAiNode`(`ai-turn-orchestrator.service.ts:1471-1483`) 의 "이미 RUNNING 유지" 분기는 `assertActiveExecutionAndSaveNodeExec`(동일 패턴의 FOR UPDATE 트랜잭션)로 관측+save 를 원자화해, 3차 라운드가 스스로 지적한 잔여 TOCTOU(단순 SELECT 후 별도 save)를 완전히 닫았다 — `execution-engine.service.spec.ts:5071-5149` 의 4개 테스트(비-terminal/terminal/FOR UPDATE 쿼리 형태/`nodeExec===null`)로 회귀 고정돼 있음을 확인.
- `assertLinkedTransitionApplied` 헬퍼(`ai-turn-orchestrator.service.ts:360-381`)가 `shouldProceed===false` 시 (1) `nodeExec.outputData`/`error` 초기화 → `markNodeCancelled` 로 terminal 마킹, (2) `ExecutionCancelledError` throw 를 4개 소비처(re-park/첫 turn park/RUNNING 재claim/RUNNING 유지)에 일관되게 적용한다 — CHANGELOG("AI 경로 4곳")·JSDoc·코드가 서로 정합함을 직접 대조로 확인.
- `EngineDriver`/`AiTurnEngineDriver` 의 멤버 수 JSDoc 주장(distinct 15 / AiTurn 10)은 인터페이스 정의를 직접 세어 정확함을 확인(위 SPEC-DRIFT 항목 참조).
- 이번 라운드에서 새로운 기능적 결함은 발견되지 않았다.

## 요약

핵심 요구사항 — "AI multi-turn 턴 진행 중 Stop 이 조용히 무효화(park 짝 전이 lost-update)되던 결함 차단 + turn 경계 cancel 관측 도입" — 은 DB/`NodeExecution` 최종 영속 상태 기준으로 코드를 직접 대조 확인한 결과 완전하고 정확하게 구현돼 있다. 3차 라운드가 스스로 발견해 고친 잔여 TOCTOU(`finalizeAiNode` RUNNING 유지 분기)도 `assertActiveExecutionAndSaveNodeExec`(FOR UPDATE 트랜잭션)로 실제로 닫혔음을 테스트 커버리지까지 포함해 확인했다. 유일하게 남은 실질적 갭은 `handleAiMessageTurn` 이 LLM 호출 종료 후 취소 재확인 없이 WS 이벤트(`AI_MESSAGE`/`EXECUTION_WAITING_FOR_INPUT`)를 먼저 내보내는 표시 계층 순서 문제인데, 이는 이번 라운드의 새 발견이 아니라 3차 라운드에서 이미 식별·의도적으로 범위 밖으로 결정되어 plan 에 증상·영향·닫는 방법까지 상세히 기록된 상태다(데이터 정합성 위험 아님, 표시 지연에 한정). Spec 문서(`node-cancellation.md` §2.1, `execution-engine.md` §1.1/`## Rationale` §C-1)의 stale 서술도 직접 대조로 실재함을 재확인했으나 `project-planner` 위임이 이미 정확히 걸려 있어 추가 조치가 필요하지 않다. 신규 CRITICAL 은 없다.

## 위험도

LOW
