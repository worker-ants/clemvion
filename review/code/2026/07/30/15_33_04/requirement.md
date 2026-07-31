# 요구사항(Requirement) 리뷰 — retry 재진입 짝 전이 DB 가드 수정 (`2ca44b769`, 8R CRITICAL 후속)

리뷰 대상: `state/state-machine.ts`, `execution-engine.service.ts`, `ai-turn-orchestrator.service.ts`,
`engine-driver.interface.ts`, `retry-turn.service.ts` (5개 파일, 커밋 `2ca44b769` — 직전 라운드
`review/code/2026/07/30/12_56_04` 의 concurrency CRITICAL #1 을 수정).

## 검증 방법 (실측)

- `git show 2ca44b769 --stat` + 파일별 diff 로 실제 변경 hunk 확정(테스트 포함 8파일, 244+/24-).
- 변경 함수(`canTransition`/`lockNonTerminalExecutionRow`/`tryLockActiveExecutionAndSaveNodeExec`/
  `updateExecutionStatus`/`reparkAiResumeTurn`/`processAiResumeTurn`/`finalizeAiNode`)를 `Read` 로
  직접 열어 opts 전파 경로를 라인 단위로 수동 추적(FAILED→RUNNING "turn 즉시 종료" 경로 +
  FAILED→WAITING_FOR_INPUT "turn 계속" 경로 둘 다 시뮬레이션).
- `grep`으로 `updateExecutionStatus`/`tryLockActiveExecutionAndSaveNodeExec` 전체 호출부(9곳)를
  전수 확인해 `allowRetryReentry` 가 필요한 자리(3곳: 상태머신 opt-in·else 분기·세 번째 잠금
  소비처)에 모두 전파됐는지, 불필요한 자리(retry-turn.service.ts 의 2개 호출부, 첫 turn park)에는
  전파하지 않는 것이 맞는지 확인.
- 신규/수정 테스트(`state-machine.spec.ts`, `execution-engine.service.spec.ts`,
  `ai-turn-orchestrator.service.spec.ts`) 를 diff·전문으로 확인해 "turn 계속" 시나리오
  (`ended:false`, re-park)가 실제로 어느 테스트에서도 구성되지 않음을 grep 으로 재확인
  (`retryReentry`/`allowRetryReentry` 전체 occurrence 대조).
- 직전 라운드 산출물(`review/code/2026/07/30/12_56_04/SUMMARY.md`, `requirement.md`)과
  `plan/in-progress/retry-turn-terminal-guard.md` 전문을 읽어 권장 조치사항 대비 이번 커밋의
  이행 범위를 대조.
- `spec/5-system/4-execution-engine.md`, `spec/5-system/6-websocket-protocol.md`,
  `spec/4-nodes/3-ai/1-ai-agent.md` 를 grep -n 으로 열어 신규 `FAILED → WAITING_FOR_INPUT` 전이의
  spec 반영 여부를 line-level 대조.

## 발견사항

- **[WARNING]** "turn 계속(re-park)" 시나리오 — 이번 fix 가 명시적으로 "multi-turn 최빈"
  이라 부르는 바로 그 경로 — 를 실제로 발동시켜 `allowRetryReentry` opt-in 이 DB 가드까지
  성공적으로 도달하는지 검증하는 테스트가 여전히 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:442,457`
    (`reparkAiResumeTurn` 의 `opts` 파라미터·`updateExecutionStatus` 호출 4번째 인자),
    `:223-225`(`processAiResumeTurn` 의 `finalizeOpts` 계산); 그리고
    `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 의
    `describe('applyRetryLastTurn (multi-turn loop re-entry)')` 블록(모든 `processReturn` fixture 가
    `port:'user_ended'`/`status:'ended'` 또는 throw 뿐, `status:'waiting'`/`ended:false` 조합 없음).
  - 상세: 코드를 직접 수동 시뮬레이션한 결과, `retryLastTurn` 재진입에서 handler 가
    `status:'waiting'` 를 반환하면 `handleAiMessageTurn` → `{ended:false}` → `processAiResumeTurn`
    이 `reparkAiResumeTurn(.., finalizeOpts)` 을 호출하고, `finalizeOpts={retryReentry:true}` 가
    `updateExecutionStatus(savedExecution(FAILED), WAITING_FOR_INPUT, nodeExec,
    {allowRetryReentry:true})` 까지 정확히 전파돼 `lockNonTerminalExecutionRow` 가
    `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 을 선택하므로 **로직 자체는 correct** 하다. 그러나 이
    경로를 실제로 실행해 "FOR UPDATE 잠금이 FAILED 를 포함해 1행을 반환하고, 짝 전이가 실제로
    persist 된다"를 검증하는 테스트는 어디에도 없다 — `ai-turn-orchestrator.service.spec.ts`
    의 `reparkAiResumeTurn` 단위 테스트 6건은 전부 `opts` 없이(4개 인자만) 호출해 forwarding 을
    검증하지 않고, `execution-engine.service.spec.ts` 의 `applyRetryLastTurn` 통합 스위트(실
    `ExecutionEngineService`+`AiTurnOrchestrator`+`RetryTurnService` 배선, `useExisting:
    ExecutionEngineService`)는 모든 fixture 가 대화 종료(`finalizeAiNode` COMPLETED/FAILED 분기)
    만 거치고 re-park 분기에 한 번도 도달하지 않는다. `retry-turn.service.spec.ts` 는
    `mockAiTurnOrchestrator`(`jest.fn()`)로 `processAiResumeTurn` 자체를 통째로 mock 해 이 경로를
    구조적으로 검증할 수 없다.
    이 갭은 신규가 아니다 — **직전 라운드(`review/code/2026/07/30/12_56_04`) 의 concurrency
    리뷰어가 바로 이 CRITICAL 을 처음 발견하면서 "권장 조치사항 #2" 로 "실 Postgres 기반 e2e 로
    …'turn 이 ended:false 로 계속되는 재-park 시나리오' 검증" 을 명시적으로 요구**했는데, 이번
    수정 커밋은 그 항목 중 mock 을 honest 하게 바꾸는 부분(`dbExecutionStatus` 대조 mock)만
    이행했고 "turn 계속" 시나리오 자체를 발동하는 테스트는 추가하지 않았다.
  - 제안: `execution-engine.service.spec.ts` 의 `applyRetryLastTurn` 블록에 `processReturn` 이
    `port:'waiting', status:'waiting'` (또는 handler 가 `ended:false` 를 내는 형태)를 반환하는
    fixture 를 최소 1건 추가해, (a) `driver` 가 실제로 FAILED 로 시작하는 DB 상태에서
    `WAITING_FOR_INPUT` 으로 성공 persist 하는지, (b) 짝 NodeExecution 도 WAITING_FOR_INPUT 으로
    저장되는지, (c) 이 propagation 라인 중 하나를 mutation(예: `reparkAiResumeTurn` 의
    `opts?.retryReentry ? {...} : undefined` 를 `undefined` 로 되돌림)했을 때 RED 가 되는지 확인할
    것. 이 영역은 8라운드에 걸쳐 "약한 mock 이 실제 결함을 은폐"한 전력이 반복됐으므로(같은
    plan 문서에 누적 기록) 우선순위를 낮게 잡지 말 것을 권고.

- **[SPEC-DRIFT]** 이번 커밋이 신설한 `FAILED → WAITING_FOR_INPUT` retry-reentry opt-in 전이가
  관련 spec 3개 문서 어디에도 반영되지 않았다 — 코드는 의도적이고 정확하나(위에서 수동 검증),
  상태 전이표·프로토콜 문서·노드 스펙이 여전히 "성공(→running→completed)/실패(→failed)" 두
  outcome 만 기술한다.
  - 위치: `spec/5-system/4-execution-engine.md:46`(ASCII 다이어그램 `└─ failed ─ running` 만
    표시, `waiting_for_input` 엣지 없음), `:51`(주석이 `failed → running` 만 서술),
    `:78`(**"허용되는 상태 전이" 표에 `failed | waiting_for_input` 행 자체가 없음** — `failed |
    running` 행만 존재); 대응 코드측 신설: `codebase/backend/src/modules/execution-engine/state/
    state-machine.ts:30-37`(`ALLOWED_TRANSITIONS[FAILED]` 주석이 "유일한 예외 쌍" 으로
    RUNNING/WAITING_FOR_INPUT 둘 다 명시), `:72-77`(`canTransition` 의 opt-in 분기가
    `to === RUNNING || to === WAITING_FOR_INPUT` 로 이미 확장됨).
    2차: `spec/5-system/6-websocket-protocol.md:376`("재진입 종결 후 graph 진행" 단락이 성공/실패
    두 결과만 서술, "turn 계속(재파킹)" 결과 누락) 및 `spec/4-nodes/3-ai/1-ai-agent.md:989,
    1302-1308`(§7.9/§12.8, 동일하게 성공/실패만 서술).
  - 상세: `state-machine.ts` 자체 주석(`:34-36`)이 "2026-07-30 ai-review CRITICAL #1 후속으로
    WAITING_FOR_INPUT 대상 추가" 라고 명시해 이 확장이 의도적·정확함을 보여준다. 그러나 같은
    파일의 이전 사례(2026-05-19, `WAITING_FOR_INPUT→FAILED` 추가 시)는 "spec/5-system/
    4-execution-engine.md §1.2 상태머신 다이어그램 갱신은 별도 project-planner follow-up" 이라고
    명시적으로 후속을 예약해뒀고 그 항목은 실제로 spec 표에 반영돼 있다(현재 `:75` 행 존재,
    확인함). 이번 신규 확장(FAILED→WAITING_FOR_INPUT)에는 그런 follow-up 예약 주석이 없어, spec
    갱신이 이번 라운드에서 누락된 채 잊혀질 위험이 있다. 이 전이가 "multi-turn 최빈" 시나리오라는
    커밋 메시지 자신의 표현을 고려하면, spec 독자가 §1.1 표·§7.9/§12.8·§4.2 만 보고 "retry_last_turn
    은 성공 아니면 실패 둘 뿐" 이라 오해할 실질적 소지가 있다.
  - 제안: 코드는 유지(정확함, 되돌릴 대상 아님). spec 반영 — (1) `spec/5-system/
    4-execution-engine.md` §1.1 다이어그램에 `failed ─ waiting_for_input` 엣지 추가 + "허용되는
    상태 전이" 표에 `failed | waiting_for_input` 행 신설(§78 행 바로 아래, `failed | running` 행과
    동일한 "`allowRetryReentry` opt-in" 각주 공유) + `:51` 산문 각주를 이미 코드 주석이 쓰는 문구
    ("turn 즉시 종료" / "turn 계속 — re-park") 로 확장. (2) `spec/5-system/6-websocket-protocol.md`
    §4.2 및 `spec/4-nodes/3-ai/1-ai-agent.md` §7.9/§12.8 에 "재진입 turn 이 계속되면(멀티턴 대화
    지속) spawn 된 NodeExecution 은 다시 `waiting_for_input` 으로 re-park 되어 다음 사용자 입력을
    기다린다" 한 문장씩 추가. 반영은 `project-planner` 경유(본 reviewer 는 spec 직접 수정 금지).

## 정합성 확인 (문제 없음으로 판단된 항목)

- **opts 전파 3개 소비처 전수 확인**: 상태머신 opt-in(state-machine.ts) · `updateExecutionStatus`
  의 `linkedNodeExec`/else 분기(`lockNonTerminalExecutionRow` 경유) · 세 번째 소비처
  `tryLockActiveExecutionAndSaveNodeExec` — 커밋 메시지가 주장하는 "리뷰어는 2경로만 지목했으나
  실측으로 3곳" 을 코드로 직접 재확인, 3곳 모두 정확히 opts 를 받고 사용한다
  (`execution-engine.service.ts` 의 `lockNonTerminalExecutionRow`/`tryLockActiveExecutionAndSaveNodeExec`
  /`updateExecutionStatus` 정의부 및 `ai-turn-orchestrator.service.ts` 의 `finalizeAiNode` 두
  호출부 + `reparkAiResumeTurn` + `processAiResumeTurn` 4개 재-park 호출부 전부 확인).
- **opt-in 이 필요 없는 자리에는 전파하지 않음**: `retry-turn.service.ts` 의
  `finalizeGuarded`(경유 `updateExecutionStatus` 2회, `completeRetryExecution`/
  `failRetryExecution`)와 `resumeGraphAfterRetry` 의 직접 `updateExecutionStatus(COMPLETED)` 호출은
  전부 이미 FAILED→RUNNING 전이를 거친 **이후**(RUNNING 소스)이거나 `canTransition` 사전 검증을
  통과한 non-FAILED 소스만 다뤄 opt-in 이 불필요 — 의도적으로 열지 않은 것이 맞다(과잉 개방
  방지 확인).
- **역방향 안전장치**: `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 이 opt-in 시에도 COMPLETED/CANCELLED
  는 여전히 배제함을 계산식으로 확인(`!TERMINAL_STATUSES.has(status) || status===FAILED` →
  {PENDING,RUNNING,WAITING_FOR_INPUT,FAILED}), "실패 종결 실행의 우발적 부활 차단" 설계 불변식이
  유지됨. `state-machine.spec.ts` 신규 테스트("keep failed terminal for every other target even
  with opt-in")가 COMPLETED/CANCELLED/PENDING 3종에 대해 opt-in 을 줘도 여전히 false 임을 회귀로
  고정한 것도 확인.
- **테스트 정직성 개선 확인**: `execution-engine.service.spec.ts` 의 `mockTxManagerQuery` 가 이전
  "SQL·status 무관 항상 성공" 하드코딩(직전 라운드가 은폐 원인으로 명시 지목)에서 실제 SQL 의
  `status IN (...)` 목록과 `dbExecutionStatus` 를 대조하는 honest mock 으로 교체됐음을 diff 로
  확인 — 부분적이나마 직전 라운드 권장사항(#2 후반부)을 이행.
- **TODO/FIXME/HACK/XXX**: 5개 리뷰 대상 파일 전체 grep 0건.
- **에러 시나리오·반환값**: `assertLinkedTransitionApplied`/`finalizeGuarded` 모든 조기 반환
  경로가 `Promise<void>`/`Promise<boolean>` 계약을 지키며, "turn 즉시 종료" 경로(동시 취소 선점
  시 CANCELLED 마킹 + `ExecutionCancelledError`)는 `ai-turn-orchestrator.service.spec.ts` 의
  "finalizeAiNode — retry-last-turn 재진입 RUNNING 재claim 선점" describe 블록에서
  `{retryReentry:true}` 를 실제로 넘겨 `driver.updateExecutionStatus` 가 `{allowRetryReentry:true}`
  로 호출됨을 직접 단언하는 테스트로 검증돼 있음(대조: "turn 계속" 경로는 위 WARNING 대로 미검증).

## 요약

이번 커밋(`2ca44b769`)은 직전 라운드가 발견한 "retry_last_turn 재진입의 짝 전이가 DB 가드에
막혀 구조적으로 절대 persist 될 수 없던" CRITICAL 을 4개 지점(상태머신 opt-in 확장, DB 가드
2개 분기, 세 번째 잠금 소비처)에서 정확히 수정했으며, 코드를 직접 수동 시뮬레이션한 결과
"turn 즉시 종료"·"turn 계속(re-park)" 두 경로 모두 로직 자체는 correct 하다. 다만 (1) 직전
라운드가 명시적으로 요구한 "turn 이 ended:false 로 계속되는" 시나리오의 회귀 테스트는 이번
커밋에도 추가되지 않아, 8라운드째 반복된 "약한 mock 이 실 결함을 은폐" 패턴이 이 특정 경로에
대해서는 여전히 재발 가능한 상태로 남아 있고, (2) 신설된 `FAILED → WAITING_FOR_INPUT` 전이가
관련 spec 3개 문서(상태표·WS 프로토콜·AI Agent 노드 스펙)에 반영되지 않은 SPEC-DRIFT 가 있다.
둘 다 현재 살아있는 기능 결함은 아니나(코드 자체는 정확함을 직접 추적으로 확인), 전자는 향후
회귀를 놓칠 위험, 후자는 스펙 독자의 오독 위험으로 이어지므로 반영을 권고한다.

## 위험도

MEDIUM
