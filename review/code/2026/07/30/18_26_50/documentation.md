# 문서화(Documentation) 리뷰 — retry_last_turn 짝 전이 DB 가드 수정 (12R)

검토 파일: `engine-driver.interface.ts` / `retry-turn.service.ts` / `state/state-machine.ts` (전체
파일 컨텍스트 기준). 이 영역은 이미 8~11차(오늘, `review/code/2026/07/30/{12_56_04,15_33_04,
16_42_36,17_37_14}`) 라운드에서 전담 documentation reviewer 가 반복 검토했고, 그때 지적된
`tryLockActiveExecutionAndSaveNodeExec`/`updateExecutionStatus` 의 `@param opts` 누락,
CHANGELOG 미반영, user_guide_sync mdx 리스트 파손은 모두 코드 대조 결과 **이미 해소되어
있음을 확인**했다(각각 10R·11R·11R 커밋 반영). 아래는 그 위에서 이번에 새로 발견한 항목만
적는다 — 기존 정본 인용(spec/plan 교차확인 포함)을 근거로 삼아 재확인했다.

## 발견사항

- **[WARNING]** `retryLastTurn` JSDoc이 **이미 구현·해소된 항목**을 "남은 문서화된 갭"으로
  서술 — 같은 파일 안에서 자기모순
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:122`-`128`
    (`retryLastTurn` 독스트링 "**재진입 구현 완료**" 문단)
  - 상세: 122-128행은 "남은 문서화된 갭은 downstream graph traversal (성공 후 후속 노드
    재개) — `applyRetryLastTurn` 의 docstring 참조" 라고 명시한다. 그런데 그 포인터가
    가리키는 `applyRetryLastTurn` 자신의 독스트링(`:265`-`287`, 특히 "재진입 절차" 8번
    항목 `:282`-`283`)은 정확히 이 능력이 **이미 구현·해소돼 있다**고 서술한다: "성공
    종결이면 `resumeGraphAfterRetry` 가 downstream graph 로 진행 (**WARNING #10 해소**;
    spec/4-nodes/3-ai/1-ai-agent.md §7.9 + §12.8)." `resumeGraphAfterRetry` 자체(`:761`-
    `899`)도 graph rebuild→reachability seed→`runNodeDispatchLoop` traversal→COMPLETED
    마감까지 실제로 완전히 구현돼 있고, `retry-turn.service.spec.ts` 의 "자연 종결(그래프
    완주) 경로가 COMPLETED 로 마감된다" 테스트(`:777`)로 회귀도 잠겨 있다 — 즉 "갭" 이
    아니라 이미 검증된 기능이다.
    `git blame` 으로 확인한 인과: "WARNING #10 해소" 서술(`:283`)은 이 파일의 최초 추출
    커밋 `0c275dd7f`(2026-06-18, C-1 step4 FINAL, engine 에서 그대로 이관)부터 이미
    존재했다 — 즉 downstream graph traversal 은 이 브랜치가 시작되기 훨씬 전부터 구현·
    문서화돼 있었다. 반면 "남은 문서화된 갭은 downstream graph traversal" 문구(`:127`-
    `128`)는 **이번 브랜치 자신의 커밋** `7a05c6ec8`(2026-07-30 12:25:33, "retry-turn
    JSDoc 3건 정정")이 오늘 새로 추가한 문장이다 — 그 커밋은 stale `runAiConversationLoop`
    인용을 올바르게 제거하면서(그 조치는 정확함), 같은 문단에 이미 몇 주 전에 해소된
    항목을 "남은 갭" 으로 잘못 재도입했다. 8R 문서화 라운드(`12_56_04`)가 바로 이
    122-128행 구간을 검토했으나 `runAiConversationLoop` 참조 해소 여부만 확인하고 이
    모순은 놓쳤다(교차 문서 검증 범위 밖) — 9R~11R 도 재검토하지 않아 4개 라운드를
    통과한 상태였다.
  - 제안: 122-128행의 "남은 문서화된 갭은 downstream graph traversal … 참조" 문장을
    삭제하거나 "downstream graph traversal 은 `resumeGraphAfterRetry` (WARNING #10) 로
    이미 구현됨 — 재진입 절차 8번 참조" 로 정정한다. 기능적 영향 없음(순수 문서 정정).

- **[WARNING]** `engine-driver.interface.ts` 최상단 docblock의 "spec 수치가 아직 stale,
  정정 위임 중" 서술이 **이미 완료된 위임을 미해결로 오기술**
  - 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:41`-`44`
    (`CoreEngineDriver` 파일 최상단 독스트링, 멤버 수 실측 문단)
  - 상세: "`execution-engine.md ## Rationale` §C-1 의 수치는 아직 12/7 로 stale —
    `spec-update-node-cancellation-shutdown-classification.md` #7 보강 8번 항목이 이제
    15/10 을 목표로 정정 위임돼 있다" 라고 서술한다(2026-07-26 3차 라운드 작성,
    커밋 `d3fafbafc`). 그러나 직접 대조 결과 그 위임은 이미 이행 완료됐다:
    `spec/5-system/4-execution-engine.md:1725`-`1730` 이 "**멤버 수 갱신 (2026-07-27)**:
    … 현재는 **`EngineDriver` distinct 15 / `AiTurnEngineDriver` 합계 10** 이다" 라는
    정정 블록을 이미 담고 있고(커밋 `72e3193f7`), `plan/in-progress/spec-update-node-
    cancellation-shutdown-classification.md:17` 프론트매터도 "**#6·#7 은 2026-07-27
    이행 완료** (커밋 `e79feae6a`). 아래 두 절과 각 보강은 **이력**으로 남긴다" 라고
    명시적으로 종결 처리했다. 즉 인터페이스 파일의 "아직 stale, 정정 대기 중" 이라는
    현재형 서술이 지금은 사실과 다르다 — 이미 완료된 spec 동기화를 미완으로 안내해
    다음 독자가 불필요하게 재확인하거나(혹은 반대로 실제로 아직 안 끝난 다른 항목의
    긴급도를 오판)할 여지가 있다. (10R 문서화 라운드 `16_42_36` 이 이 문단을 검토하고
    "별도 project-planner 위임으로 추적 중인 pre-existing stale 수치" 라 판단해 이번
    PR 무관으로 넘겼는데, 그 판단의 전제 — "추적이 아직 진행 중" — 자체가 이미 하루
    전(2026-07-27)에 허물어져 있었다.)
  - 제안: 41-44행을 "spec `execution-engine.md` 도 2026-07-27 자로 15/10 으로 갱신
    완료됨(커밋 `72e3193f7`)" 로 정정하거나, 이미 이력이 된 위임 경로 인용을 제거한다.
    코드 쪽 수치(15/10, Core 2+Interaction 1+ReentryState 1+AiTurn 자체 6+Retry 자체 5)
    자체는 직접 재계산해 정확함을 확인했다 — 이 항목은 참조하는 spec 상태 서술만의 문제.

- **[INFO]** (참고 — 8R 이 이미 발견·저위험 판정, 지금도 유효) `claimSpawnedRetryRow` 재진입
  순서 불변식의 핵심 논거가 호출부 인라인 주석(`retry-turn.service.ts:322`-`330`)과 헬퍼
  자신의 JSDoc(`:486`-`531`)에 문장 단위로 거의 그대로 중복돼 있다. 현재는 두 사본이
  일치하므로 차단 사유는 아니며, 8R 리뷰가 이미 "이 클래스는 정확히 이런 식으로(신·구
  버전이 한쪽만 갱신되며 자기모순) 한 번 실패한 이력이 있다" 는 근거로 WARNING·LOW 를
  매겨 축약을 권고했다. 4개 라운드가 지나도록 손대지 않았고 실제로 drift 가 재발하지는
  않았으므로, 이번 라운드에서 다시 차단 사유로 올리지는 않되 여전히 유효한 저비용 정리
  항목으로 재확인한다.

## 검토했으나 문제 없음 (재확인)

- `state/state-machine.ts` — `TransitionOptions.allowRetryReentry` JSDoc, `canTransition` 의
  `FAILED → RUNNING`/`FAILED → WAITING_FOR_INPUT` opt-in 분기 주석, `assertTransition` 의
  `@param opts` 설명 모두 실제 구현과 정확히 일치(직접 로직 대조 완료). `ALLOWED_TRANSITIONS`
  주석의 "유일한 예외 쌍" 서술도 정확 — 표에는 없고 opt-in 으로만 허용되는 두 전이가 실제로
  그 두 개뿐임을 코드로 확인.
- `spec/5-system/4-execution-engine.md` §1.1 상태 전이 표(`:79`-`80`)가 `FAILED → RUNNING`/
  `FAILED → WAITING_FOR_INPUT` 재진입 전이 둘 다(2026-07-30 CRITICAL #1 대응) 정확히 반영—
  spec-코드 동기화 확인.
- `engine-driver.interface.ts` 의 `updateExecutionStatus`/`tryLockActiveExecutionAndSaveNodeExec`
  신규 `@param opts.allowRetryReentry` 서술을 각 구현부(`execution-engine.service.ts`)와
  대조 — DB 가드(FOR UPDATE 짝 전이 분기 + else 분기 guarded UPDATE + `lockNonTerminal
  ExecutionRow`)가 실제로 opt-in 을 전파하며, "opt-in 시에도 COMPLETED/CANCELLED 는 배제"
  주장도 `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 정의(FAILED 만 추가, TERMINAL_STATUSES 의
  나머지는 그대로 배제)로 정확히 확인됨.
- `continuation-execution.processor.ts` 의 `retry_last_turn` claim 제외 사유 주석과
  `retry-turn.service.ts` 의 대응 서술(5차 라운드 CRITICAL 인과)이 양쪽 파일에서 서로
  일치 — cross-file 정합 확인.
- CHANGELOG.md 최상단 "Unreleased — retry_last_turn 재진입: 종결 경로 terminal 가드 + 원자
  claim + 짝 전이 persist 수정" 항목이 8R~10R 의 핵심 결함 3축(종결 guarded 전환·원자
  claim·짝 전이 persist 결함)을 모두 반영 완료(10R 커밋 `3c306d593`) — 이전 라운드가 3회
  연속 지적했던 미반영은 이제 해소.
- 신규 환경변수·설정 옵션 없음(설정 문서화 해당 없음). 이 모듈에 README 관례 없음(spec/ 가
  SoT, README 미갱신 정상). REST/WS 공개 계약(에러 코드 4종·이벤트 타입) 불변 — API 문서
  갱신 불요.

## 요약

이 PR 은 11라운드를 거치며 문서화 품질이 이미 매우 높은 수준으로 수렴했다 — 상태 머신 opt-in,
DB 가드, 2차 원자 claim 각각의 "왜" 를 설명하는 JSDoc/주석이 촘촘하고 spec 3개 파일도 신규
`FAILED → WAITING_FOR_INPUT` 전이를 정확히 반영한다. 이번 라운드에서 새로 발견한 것은 순수
문서 자기모순 2건이다: (1) `retryLastTurn` 독스트링이 이미 몇 주 전부터 구현·테스트로 잠긴
downstream graph traversal 을 "남은 갭" 으로 오기술 — 아이러니하게도 다른 stale 참조를 고치던
바로 그 커밋(오늘, `7a05c6ec8`)이 도입했고 이후 4개 문서화 라운드가 놓쳤다. (2)
`engine-driver.interface.ts` 최상단의 "spec 12/7 로 stale, 정정 위임 중" 서술이 실제로는
이미 하루 전(2026-07-27) 완료된 위임을 현재진행형으로 오기술 — 10R 이 "별도로 추적 중이라
무관" 이라 넘겼던 전제 자체가 이미 허물어져 있었다. 둘 다 코드 동작에는 영향이 없는 순수
서술 정정 건이며, 나머지(README/CHANGELOG/설정/예제/API 문서/spec 동기화)는 전부 정상이다.

## 위험도

LOW
