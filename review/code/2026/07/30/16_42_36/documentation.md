# 문서화(Documentation) 리뷰 — retry_last_turn 재진입 짝 전이 DB 가드 수정 (8R/9R)

리뷰 대상: `state-machine.ts` / `execution-engine.service.ts` / `ai-turn-orchestrator.service.ts` /
`engine-driver.interface.ts` / `retry-turn.service.ts` (전체 파일 컨텍스트 기준). 실제 diff 는
`origin/main...HEAD` 로 직접 대조했다 (b351731f0 ~ 1838c6fec, retry_last_turn 원자 claim 도입 →
2차 claim 삽입 위치 결함 수정 → 8R CRITICAL: DB 가드가 opt-in 을 반영 못해 재진입 짝 전이가
항상 0행이던 결함 → 9R: re-park 경로 회귀 테스트 + spec 반영).

## 발견사항

- **[WARNING]** `AiTurnEngineDriver.tryLockActiveExecutionAndSaveNodeExec` 의 신규 `opts`
  파라미터가 인터페이스 JSDoc 에 전혀 반영되지 않음.
  - 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:185-214`
    (JSDoc 블록 185-209, 신규 파라미터는 213줄 `opts?: { allowRetryReentry?: boolean },`)
  - 상세: 이번 PR 이 시그니처에 `opts?: { allowRetryReentry?: boolean }` 를 추가했지만(diff
    확인), 바로 위 JSDoc 블록은 `@returns` 까지 기존 2-인자 계약만 서술하고 새 파라미터는
    `@param` 은 물론 한 줄의 언급도 없다. 같은 파일의 다른 메서드(`buildRetryReentryState`)는
    `@param opts.nodeExecutionId ...` 형태로 옵션 파라미터를 명시하는 관례를 이미 쓰고
    있어 이 누락은 파일 내 일관성도 깨뜨린다. 더 중요한 것은, 이 파일 최상단 docblock 이
    스스로 "메서드 시그니처는 엔진을 단일 진실(source of truth)로 그대로 미러링한다" 고
    선언하고 있고, 정확히 이 클래스의 결함("네 소비처가 새 소비처 추가... 이후에도 갱신되지
    않고 두 라운드 동안 stale 하게 남았던 이력이 있다")을 `updateExecutionStatus` JSDoc 이
    스스로 경고하고 있다는 점이다 — 즉 이 파일은 "시그니처만 바뀌고 문서가 안 따라가는"
    바로 그 패턴을 이미 한 번 겪은 이력이 있는데 이번에도 반복됐다. 실제 구현부
    (`execution-engine.service.ts:8224-8253`)는 파라미터 선언 바로 위에 왜 이 옵션이
    필요한지(3번째 소비처, 없으면 "살아있는 spawn row 가 동시 cancel 선점으로 오판"됨)를
    상세히 설명하는 인라인 주석을 달아 두었으나, 그 설명은 DI 로 실제 주입받는 계약면
    (인터페이스)에는 전혀 미러링되지 않았다 — `RetryTurnService`/`AiTurnOrchestrator` 처럼
    이 인터페이스만 보고 개발하는 소비자는 `opts` 의 존재조차 인터페이스 문서에서 알 수
    없다.
  - 제안: `tryLockActiveExecutionAndSaveNodeExec` JSDoc 에 `@param opts.allowRetryReentry`
    항목을 추가해 구현부 인라인 주석의 핵심("retry 재진입 3번째 소비처, opt-in 없으면
    FAILED 상태 Execution 에 대한 잠금이 실패해 살아있는 작업이 취소로 오분류된다")을
    최소 요약으로 미러링.

- **[WARNING]** `spec/5-system/4-execution-engine.md` 에 이중 리스트 마커 오타 — 이번 PR 이
  편집한 목록 항목의 렌더링이 깨짐.
  - 위치: `spec/5-system/4-execution-engine.md:1522`
  - 상세: `git diff origin/main...HEAD -- spec/5-system/4-execution-engine.md` 로 확인 결과,
    "세 번째 갈래" 신규 불릿을 삽입하면서 원래 있던 "재진입 성공 시 Execution 은 `completed`,
    ..." 불릿을 그대로 재추가했는데, 이번엔 앞에 `- ` 가 아니라 `- - ` (대시 2개)로 시작한다.
    실제 파일을 직접 열어 확인(`grep -n '^- - 재진입 성공' spec/5-system/4-execution-engine.md`
    → 1522줄 적중, 전체 spec/ 트리에서 이 패턴은 이 한 줄뿐)했다 — 의도된 스타일이 아니라
    단순 편집 실수다. Markdown 렌더러에 따라 리터럴 `- -` 텍스트로 보이거나 의도치 않은
    중첩 리스트로 렌더링될 수 있다.
  - 제안: 1522줄 앞의 `- - ` 를 `- ` 로 정정 (한 글자 수정).

- **[WARNING]** `CHANGELOG.md` 가 이 PR 체인 전체(3라운드 연속, 8R CRITICAL 포함)를 반영하지
  않음 — 직전 문서화 리뷰(`review/code/2026/07/30/11_41_20/documentation.md`)가 이미 INFO 로
  지적하고 "다음 문서-정리 턴" 으로 이월했던 항목이 이번에도 그대로 남았다.
  - 위치: `CHANGELOG.md` (루트) — 최상단 `## Unreleased — AI multi-turn resume turn 경계
    cancel 가드 + park 짝 전이 lost-update 차단` 절 (3번째 줄)
  - 상세: `git log --oneline -1 -- CHANGELOG.md` 기준 이 파일의 마지막 갱신 커밋은
    `771801e3e`(2026-07-28 09:36, "retry-turn 종결 2경로의 무가드 terminal 쓰기 차단")이다.
    그 이후 이 브랜치에서 이어진 `b351731f0`(원자 claim 도입) → `414550a1d`(2차 claim 삽입
    위치 결함 2건 수정) → `7a05c6ec8`/`886ca9395`(JSDoc·회귀 테스트) → **`2ca44b769`
    (8R CRITICAL — retry 재진입 짝 전이가 DB 가드에 막혀 절대 persist 되지 않던 결함)**
    → `1838c6fec`(9R — re-park 회귀 테스트 + FAILED→WAITING spec 반영) 중 어느 것도
    `CHANGELOG.md` 에 없다(`grep -n "claimSpawnedRetryRow\|NON_TERMINAL_OR_FAILED"
    CHANGELOG.md` 무적중). 특히 8R 은 이 기능(`execution.retry_last_turn` 의 turn-계속
    재진입 경로)이 **한 번도 실제로 persist 된 적이 없었다**는, 이 PR 체인에서 가장
    심각한 발견인데도 기록이 없다. 이 파일은 정확히 이 서브시스템(`updateExecutionStatus`,
    `lockNonTerminalExecutionRow` 등)에 대한 유사한 동시성 수정을 상세히 기록해 온 확립된
    관례가 있어(바로 위 항목 6·7이 그 예) 누락이 두드러지며, 이미 한 차례 이월(INFO, 7R)된
    뒤에도 두 라운드(8R·9R)를 더 거치는 동안 반영되지 않았다는 점에서 우선순위를 올릴
    근거가 있다.
  - 제안: "다음 문서-정리 턴" 을 기다리기보다, 이번에 CHANGELOG 절을 하나 추가해 최소
    "retry_last_turn 재진입의 FAILED→RUNNING/WAITING_FOR_INPUT 짝 전이가 DB 가드
    불일치로 절대 persist 되지 않던 결함을 원자 claim + 상태 목록 동기화로 수정" 요지를
    기록 권장. `plan/in-progress/retry-turn-terminal-guard.md` 에 번호 있는 항목으로도
    등재(현재 W10~W12 계열은 날짜 있는 산문 불릿에만 존재 — 이 프로젝트가 이미 겪은
    "산문 유실" 패턴 재발 위험, 7R 문서화 리뷰가 동일하게 지적한 바 있음).

- **[INFO]** `plan/in-progress/retry-turn-terminal-guard.md` 우선순위 표 항목 #9 이 이번
  PR 로 바뀐 사실(반복 횟수 감소)을 반영하지 못함 — 같은 파일 안에서 최신 라운드 서술과
  불일치.
  - 위치: `plan/in-progress/retry-turn-terminal-guard.md:334`(표 항목 #9, "3곳 반복") vs
    `:511`(7R 라운드 서술, "not-found **2블록**")
  - 상세: 8R CRITICAL 수정 전에는 `applyRetryLastTurn` 안에 spawned row 를 FAILED 로
    마킹하는 지점이 3곳(execution not found / node not found / `_retryState` 부재)
    있었다. 이번 PR 의 CRITICAL#1 수정으로 "`_retryState` 부재" 분기는 더 이상 FAILED 로
    마킹하지 않고 discard 하도록 바뀌어(코드 확인: `grep -n
    "spawnedRow.status = NodeExecutionStatus.FAILED" retry-turn.service.ts` → 2건만
    적중, execution-not-found/node-not-found 뿐), 실제 반복 지점은 2곳으로 줄었다. 같은
    plan 파일의 7R 라운드 서술(511줄)은 이를 정확히 "2블록" 으로 반영했지만, 그보다 위에
    있는 우선순위 표 자체(334줄, 1R 부터 이어진 원 항목)는 여전히 "(3곳 반복)" 으로 남아
    같은 문서 안에서 최신 사실과 옛 표가 어긋난다.
  - 제안: 표 334줄의 "(3곳 반복)" 을 "(2곳 반복, 8R 로 1곳 감소)" 로 정정. 우선순위(P3)에는
    영향 없는 저비용 수정.

## 검토했으나 문제 없음 (참고)

- `state-machine.ts` — `ALLOWED_TRANSITIONS`/`TransitionOptions`/`canTransition`/
  `assertTransition` 4곳 모두 FAILED→WAITING_FOR_INPUT 추가를 정확하고 일관되게 반영(주석,
  JSDoc `@param` 모두 동기화됨). 새 단위 테스트(`state-machine.spec.ts`)의 설명 주석도 실제
  동작과 일치.
- `execution-engine.service.ts` — `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 신규 상수, 그
  소비처 3곳(`lockNonTerminalExecutionRow`/`tryLockActiveExecutionAndSaveNodeExec`/
  `updateExecutionStatus` else 분기)의 인라인 주석 모두 "왜 필요한가"(opt-in 없이는 항상
  0행)를 정확히 설명하며 과거 결함(8R)과의 인과관계도 명시. `lockNonTerminalExecutionRow`
  구현부 자체의 JSDoc 은 `@param opts.allowRetryReentry` 를 정확히 갖추고 있음(위 WARNING
  대상인 인터페이스 쪽과 대조적으로 이쪽은 모범적).
- `retry-turn.service.ts` — 클래스 최상단 "책임" 문단, `retryLastTurn`/`applyRetryLastTurn`
  독스트링의 "재진입 절차" 번호 목록, `claimSpawnedRetryRow` JSDoc(백스톱 갭 서술 포함) 모두
  이전 라운드(6R/7R)에서 지적된 stale 참조·자기모순이 이번 시점엔 이미 해소되어 있음을
  직접 확인(`runAiConversationLoop` 잔존 참조 없음, 백스톱 갭 서술 자기모순 없음). 인용된
  선행 리뷰·plan 경로(`review/code/2026/07/28/20_32_57`, `review/code/2026/07/30/11_41_20`,
  `plan/in-progress/retry-turn-terminal-guard.md`)는 모두 실재함을 확인.
- `spec/5-system/4-execution-engine.md`/`spec/4-nodes/3-ai/1-ai-agent.md`/
  `spec/5-system/6-websocket-protocol.md` — §1.1 상태표·§7.5 대칭 Rationale·§12.8 신규
  admonition·WS 프로토콜 문단 모두 코드 변경(FAILED→WAITING_FOR_INPUT 신규 전이)과 정확히
  동기화됨. 신규 앵커 링크(`#11-execution-상태`)도 대상 헤딩과 일치 확인.
- `engine-driver.interface.ts` 최상단 docblock 의 멤버 수 실측치("15/10")는 이번 PR 이
  기존 멤버에 파라미터만 추가했을 뿐 신규 멤버를 만들지 않았으므로 갱신 대상이 아님(이미
  별도 project-planner 위임으로 추적 중인 pre-existing stale "12/7" spec 수치와는 무관).
- 신규 환경변수·설정 옵션 없음 — 설정 문서화 항목 해당 없음. 이 프로젝트는 모듈별 README
  관례가 없음(spec/ 이 SoT) — README 미갱신은 정상.
- `execution-engine.service.spec.ts`/`retry-turn.service.spec.ts` 신규·수정 테스트의 설명
  주석은 실제 검증 대상(claim 실패 discard, opts 전파, mock 이 SQL 조건을 실제로 평가하도록
  개선한 이유)과 정확히 일치하며 과장·누락 없음.

## 요약

이 PR 은 문서화 품질이 전반적으로 매우 높다 — 상태 머신·DB 가드·2차 claim 각각의 "왜"를
설명하는 JSDoc/인라인 주석이 촘촘하고, spec 3개 파일(§1.1 상태표·§7.9/§12.8·WS 프로토콜)이
코드 변경과 정확히 동기화됐으며, 직전 라운드(7R)가 지적한 자기모순·stale 참조도 실제로
해소된 것을 직접 확인했다. 다만 세 가지는 놓쳤다: (1) `engine-driver.interface.ts` 의
`tryLockActiveExecutionAndSaveNodeExec` 신규 `opts` 파라미터가 DI 계약 문서에는 전혀
반영되지 않아 구현부의 상세한 설명과 비대칭이 생겼고, (2) 이번에 편집한 spec 목록 항목에
`- -` 이중 마커 오타가 남았으며, (3) `CHANGELOG.md` 가 이 브랜치의 핵심 결함(8R CRITICAL:
재진입 짝 전이가 DB 가드에 막혀 절대 persist 되지 않던 결함)을 포함해 3라운드째 반영되지
않았다 — 이는 직전 리뷰가 이미 이월(INFO)한 항목이 재차 넘어간 것이라 우선순위를 올릴
근거가 있다. 세 항목 모두 기능적 결함이 아니라 후속 문서화 턴에서 저비용으로 정정 가능한
수준이다.

## 위험도

LOW
