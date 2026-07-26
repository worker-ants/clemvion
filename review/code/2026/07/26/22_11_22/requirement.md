# 요구사항(Requirement) 코드 리뷰 — ie-resume-signal-6e933d (2026-07-26 22_11_22)

## 발견사항

### [WARNING] `handleAiMessageTurn` 이 취소 가드보다 먼저 `AI_MESSAGE`/`EXECUTION_WAITING_FOR_INPUT` WS 이벤트를 발행한다 — "턴 진행 중 Stop 이 조용히 무효화됨" 이라는 이 PR 의 핵심 문제가 클라이언트 체감 관점에서는 완전히 닫히지 않는다

- 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` — `handleAiMessageTurn` 의 waiting_for_input 분기(`EXECUTION_WAITING_FOR_INPUT` emit, 888~923줄; `AI_MESSAGE` emit, 825~855줄)와 terminal 분기(`AI_MESSAGE` emit, 953~984줄). 대조 지점: `reparkAiResumeTurn`(297줄에서 호출, 가드는 405~412줄) / `finalizeAiNode`(245~294줄에서 호출, CRITICAL#1 가드는 1446~1461줄).
- 상세:
  이번 PR 이 새로 추가한 turn 경계 가드(`assertExecutionNotCancelled`, `handleAiMessageTurn` 658줄)는 handler(`processMultiTurnMessage`, 즉 LLM 호출) **진입 이전**에만 취소를 관측한다. `handleAiMessageTurn` 은 LLM 호출이 끝난 뒤 (a) turn 이 계속되면 `AI_MESSAGE`+`EXECUTION_WAITING_FOR_INPUT` 을, (b) turn 이 종료되면 terminal `AI_MESSAGE` 를 **그 자리에서 무조건** emit 하고 반환한다. 이 PR 이 도입한 짝 전이 terminal 가드(`assertLinkedTransitionApplied` → `reparkAiResumeTurn`/`finalizeAiNode`)는 이 반환 **이후**, `processAiResumeTurn` 이 그 결과를 보고 별도로 호출하는 **다른 메서드** 안에서 실행된다.

  즉 LLM 호출 도중(수 초~분, 이 PR 이 스스로 지목한 그 취약 구간) Stop 이 눌리면:
  1. turn 경계 가드(658줄)는 이미 통과한 뒤라 아무 효과가 없다.
  2. 핸들러가 정상 응답을 반환하고, `handleAiMessageTurn` 이 `AI_MESSAGE`(대화 이어짐을 함의)와 `EXECUTION_WAITING_FOR_INPUT`(계속 가능함을 함의) 를 클라이언트로 **먼저** 내보낸다.
  3. 그 다음에야 `reparkAiResumeTurn`(re-park) 또는 `finalizeAiNode`(자연 종료, 신규 e2e 가 실제로 exercise 하는 CRITICAL#1 경로)가 짝 전이/`assertExecutionNotCancelled` 가드로 취소를 관측해 `markNodeCancelled`+`NODE_CANCELLED` 로 정정한다.

  DB/`NodeExecution` 최종 영속 상태는 이 PR 덕에 안전하다(재개 불가, lost-update 없음 — 이 부분은 정확히 구현됨). 그러나 **클라이언트가 실제로 받는 WS 이벤트 순서**는 "대화가 계속된다" → (뒤늦게) "취소됨" 이 되어, 사용자가 Stop 을 눌렀는데도 화면에는 잠깐 AI 응답과 "입력 대기" 상태가 노출된다 — 이 PR 의 CHANGELOG/plan 이 명시한 문제("사용자가 누른 Stop 이 조용히 무효화됐다", "실행이 다시 재개 가능 상태로 **보인다**")의 사용자 체감 증상과 본질적으로 같은 결이다. 이는 `emitAiWaitingForInput`(첫 turn park, 507~514줄에서 가드가 emit 보다 먼저 실행되도록 올바르게 배치됨)과 비대칭이다 — 첫 turn 은 정확히 고쳐졌는데, 훨씬 흔한 후속 turn(re-park)·"자연 종료"(finalizeAiNode RUNNING 분기, 신규 e2e 대상 시나리오 그 자체) 경로는 이 순서 문제가 남아 있다.

  기존 3라운드 리뷰(20_10_51/21_08_01 concurrency·requirement)는 모두 "DB/NodeExecution 최종 상태" 관점에서만 검증했고(`updateExecutionStatus` 반환값 소비 여부), WS 이벤트 발행 **순서** 자체는 어느 라운드에서도 지적되지 않았다 — 신규 단위 테스트 3세트도 `reparkAiResumeTurn`/`emitAiWaitingForInput`/`finalizeAiNode` 를 **개별 메서드로 직접 호출**해 검증하므로, `handleAiMessageTurn` → (WS emit) → `reparkAiResumeTurn`/`finalizeAiNode` 로 이어지는 실제 순서를 한 테스트 안에서 exercise 하지 않는다. 신규 e2e(파일 9)도 DB 행만 조회하고 WS 이벤트를 구독하지 않아 이 갭을 포착하지 못한다.
- 제안: (a) `handleAiMessageTurn` 의 두 emit 지점 직전에 `assertExecutionNotCancelled` 재확인을 추가해, 취소 시 emit 자체를 건너뛰고 `ExecutionCancelledError` 를 곧장 던지도록 하거나, (b) 최소한 이 잔여 갭을 plan `ie-resume-turn-boundary-cancel.md` 의 "후속(본 PR 밖)" 절에 명시적으로 등재해 "표시상 신호 잔여" 로 triage 할 것. 프론트엔드가 `NODE_CANCELLED`/`EXECUTION_CANCELLED` 를 늦게 도착한 `EXECUTION_WAITING_FOR_INPUT` 보다 항상 우선 적용하는지도 함께 확인 필요(이 diff 범위 밖).

### [WARNING] CHANGELOG.md 의 "3곳 전부 소비" 서술이 이후 라운드에서 추가된 4번째(사실상 주된) 소비처를 반영하지 못해 완전성 주장이 실제 구현 범위와 어긋난다

- 위치: `CHANGELOG.md:9` (항목 3: "짝 전이 `false` 반환 계약을 AI 경로 3곳(re-park·첫 turn park·retry-last-turn RUNNING 재claim) 전부 소비"). 대조: `ai-turn-orchestrator.service.ts` `finalizeAiNode` 의 `if (savedExecution.status === ExecutionStatus.RUNNING)` 분기(1446~1461줄, CRITICAL#1 이 추가한 가드) — 코드 자체 주석이 "이 분기가 정상 multi-turn 대화 종료의 **주 경로**" 라고 명시한다(1438~1439줄).
- 상세: CHANGELOG 항목 3은 `review/code/2026/07/26/20_10_51` 라운드(1차 fix)의 서술을 그대로 담고 있고, 그 시점엔 실제로 3개 소비처(re-park/첫 turn park/retry-last-turn RUNNING 재claim)만 존재했다. 그러나 이후 `21_08_01` 라운드에서 CRITICAL #1 로 지적된 4번째 소비처(`finalizeAiNode` 의 "이미 RUNNING" 분기 — `updateExecutionStatus` 를 아예 호출하지 않고 `assertExecutionNotCancelled` 직접 재관측으로 처리)가 추가됐고, 신규 e2e(파일 9)도 정확히 **이 4번째 경로**를 표적으로 작성됐다. `RESOLUTION.md`(review/code/2026/07/26/21_08_01) 어디에도 CHANGELOG 갱신 커밋이 매핑돼 있지 않다 — CHANGELOG 만 1차 fix 시점에 멈춰 있다. 결과적으로 이 결함 수정의 단일 공개 기록(CHANGELOG)이 실제로 가장 흔하고 가장 심각했던(CRITICAL 로 분류된) 경로를 언급하지 않아, 향후 이 CHANGELOG 항목만 읽고 "AI 경로는 3개 소비처로 완전히 닫혔다" 고 판단하면 오판하게 된다.
- 제안: CHANGELOG 항목 3(또는 신규 항목)을 "AI 경로 **4곳**(re-park·첫 turn park·retry-last-turn RUNNING 재claim·자연 종료 시 RUNNING 유지 분기)" 으로 갱신하고, 4번째가 `updateExecutionStatus` 를 거치지 않는 별도 메커니즘(`assertExecutionNotCancelled` 직접 재관측)이라는 점도 한 줄 명시.

### [WARNING] `finalizeAiNode` 의 "이미 RUNNING" 분기(CRITICAL#1 가드)는 검사-후-사용 레이스가 완전히 닫히지 않는다 — 같은 파일의 `linkedNodeExec` 분기(FOR UPDATE)와 원자성 수준이 다르다

- 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:1446-1464` (`finalizeAiNode`, `if (savedExecution.status === ExecutionStatus.RUNNING) { ... assertExecutionNotCancelled ...; assertLinkedTransitionApplied(...); if (nodeExec) { await this.nodeExecutionRepository.save(nodeExec); } }`). 대조: `execution-engine.service.ts` `updateExecutionStatus` 의 `linkedNodeExec` 분기(`SELECT ... FOR UPDATE` 트랜잭션, 8181~8199줄).
- 상세: `updateExecutionStatus` 의 `linkedNodeExec` 분기는 같은 트랜잭션 안에서 대상 행을 `FOR UPDATE` 로 잠근 뒤에만 save 를 수행해 검사-후-사용 race 를 완전히 닫는다(PR 자체 주석이 명시). 반면 `finalizeAiNode` 의 "이미 RUNNING" 분기는 `updateExecutionStatus` 를 호출하지 않으므로 이 잠금 경로를 타지 않고, 대신 `assertExecutionNotCancelled`(잠금 없는 단순 `SELECT`)로 재확인한 뒤 `nodeExecutionRepository.save(nodeExec)` 를 별도 호출로 수행한다. `SELECT` 와 `save` 사이에 여전히(비록 원래 버그의 "LLM 호출 전체 구간" 대비 훨씬 좁아진) 논-원자적 창이 남아 있다 — 그 사이에 동시 Stop 이 끼어들면 이 분기는 여전히 `NodeExecution` 을 COMPLETED 로 저장하고 `NODE_COMPLETED`/`EXECUTION_RESUMED` 를 발행할 수 있다. 이 분기가 코드 주석 스스로 "정상 multi-turn 대화 종료의 주 경로" 라고 부르는 자리라는 점에서, 다른 4개(4번째 포함) 소비처와 원자성 보장 수준이 다르다는 점은 검토 가치가 있다.
- 제안: 이 분기도 (a) `assertExecutionNotCancelled` 를 트랜잭션 안에서 `FOR UPDATE` 로 재조회하거나, (b) `nodeExecutionRepository.save` 를 그 확인과 같은 트랜잭션으로 묶어 race window 를 완전히 제거할 것. 즉시 조치가 아니라면 이 잔여 window 를 plan 의 "후속" 절에 명시적으로 남겨 팀이 의도적으로 수용했음을 기록.

### [INFO / SPEC-DRIFT] `spec/conventions/node-cancellation.md` §2.1/§2.3/§6, `spec/5-system/4-execution-engine.md` §1.1, `execution-engine.md ## Rationale` §C-1 의 멤버 수(12/7)가 모두 이번 구현과 line-level 로 어긋나 있음 — 단, 이미 올바르게 위임돼 있음을 재확인

- 위치: `spec/conventions/node-cancellation.md:44`(§2.1 IE 행 — "resume 경로는 turn 경계에서 abort 체크를 도입하는 별도 작업으로 추적"·"defense-in-depth timeout … 위 resume signal gap 과 무관하게 무기한 hang 을 상한한다" 서술이 이번 구현 이후에도 그대로 남아 있음), §2.3(56~62줄, "turn 경계(AI multi-turn resume)" 항목 부재), §6 표(121~141줄, 신규 가드 행 부재); `spec/5-system/4-execution-engine.md:79`(§1.1 "원자성 보장" — 짝 전이가 no-op(`false`)이 될 수 있다는 신규 계약 미기재); `execution-engine.md:1640`(§C-1 Rationale — "단일 12-멤버 계약"·"7멤버" 가 실제 14/9 와 불일치).
- 상세: 코드(`engine-driver.interface.ts:36-41`)가 스스로 이 stale 수치(12/7)를 명시하며 `spec-update-node-cancellation-shutdown-classification.md` #7 로 정정을 위임해 뒀다. 직접 두 spec 문서를 열어 대조한 결과 실제로 위 4개 지점이 모두 stale 함을 확인했다 — 코드가 옳고 spec 이 아직 반영되지 않은 전형적인 SPEC-DRIFT 다. `developer` 는 `spec/` 쓰기 권한이 없으므로 직접 수정하지 않은 것은 규약에 맞다.
- 제안: 코드 변경 불필요. `project-planner` 턴에서 `spec-update-node-cancellation-shutdown-classification.md` #7(및 보강 6~8번)을 그대로 반영 — (1) node-cancellation.md §2.1 IE 행 재서술 + §2.3/§6 신규 행, (2) execution-engine.md §1.1 "적용되지 않을 수 있음" 케이스 추가, (3) `## Rationale` §C-1 의 12/7 → 14/9 정정.

## 요약

이번 diff 는 세 라운드(20_10_51 → 21_08_01)에 걸쳐 상세히 검토·수정된 누적 결과로, 핵심 결함(park 짝 전이의 무가드 full-entity save 로 인한 취소 소실, `finalizeAiNode` "이미 RUNNING" 분기의 무가드 사후 오시그널)은 `FOR UPDATE` 트랜잭션·`assertLinkedTransitionApplied` 통일 소비·회귀 테스트(단위+e2e)로 견고하게 닫혔다. DB/`NodeExecution` 최종 영속 상태 기준으로는 "턴 진행 중 Stop 이 조용히 무효화된다" 는 원래 결함이 실질적으로 해소됐다. 다만 이번 리뷰에서 새로 확인한 바로는, 신규 turn-경계 가드가 handler(LLM) 호출 **이전**에만 배치돼 있어 `handleAiMessageTurn` 이 LLM 호출 **이후** 무조건 발행하는 `AI_MESSAGE`/`EXECUTION_WAITING_FOR_INPUT` WS 이벤트는 재개/종료 가드(다른 메서드에 위치)보다 먼저 클라이언트에 도달할 수 있다 — 즉 DB 는 안전해졌지만 클라이언트가 실제로 보는 이벤트 순서 관점에서는 "Stop 눌러도 대화가 계속되는 것처럼 보이는" 증상이 완전히 제거되지 않았다. 이는 3라운드 리뷰 모두 DB/반환값 소비 관점에만 집중해 놓친 각도로 보이며, `finalizeAiNode` 의 신규 가드 자체도 `linkedNodeExec` 분기 대비 원자성이 약한 검사-후-사용 형태다. CHANGELOG 는 1차 라운드 시점의 "3곳" 서술에 멈춰 있어 2차 라운드에서 추가된, 코드 주석 스스로 "주 경로" 라고 부르는 4번째 소비처가 누락돼 있다. spec 4개 지점의 stale 서술은 이미 project-planner 위임이 정확히 걸려 있어 추가 조치 불필요.

## 위험도

MEDIUM
