# 유지보수성(Maintainability) Review — retry_last_turn 원자 claim 하드닝

대상: `state/state-machine.ts`, `execution-engine.service.ts`, `ai-turn-orchestrator.service.ts`,
`engine-driver.interface.ts`, `retry-turn.service.ts` (execution-engine 모듈, `execution.retry_last_turn`
재진입 짝 전이 DB 가드 하드닝 — ai-review 8R/9R/10R CRITICAL 후속).

## 발견사항

- **[WARNING]** `allowRetryReentry`/`retryReentry` opt-in 플래그의 shape 이 여러 파일에 익명 타입으로 중복 선언됨
  - 위치:
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8171`(`lockNonTerminalExecutionRow`), `:8233`(`tryLockActiveExecutionAndSaveNodeExec`), `:8358`(`updateExecutionStatus`)
    - `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:81`(`CoreEngineDriver.updateExecutionStatus`), `:219`(`AiTurnEngineDriver.tryLockActiveExecutionAndSaveNodeExec`)
    - `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:220,442,1437`(`opts?: { retryReentry?: boolean }` — orchestrator 어휘, driver 경계에서 `allowRetryReentry` 로 번역)
  - 상세: `state/state-machine.ts` 는 이미 `export interface TransitionOptions { allowRetryReentry?: boolean; }` 를 export 하고, `execution-engine.service.ts` 는 이미 그 모듈에서 `assertTransition` 을 import 해 `opts` 를 그대로 forwarding 도 한다(8360행). 그럼에도 이번 diff 가 새로 추가한 두 메서드(`lockNonTerminalExecutionRow`/`tryLockActiveExecutionAndSaveNodeExec`)는 동일한 shape 을 또 익명 inline 타입으로 재선언했고, `engine-driver.interface.ts` 의 두 인터페이스 멤버도 같은 shape 을 독립적으로 선언한다. 같은 "단일 boolean opt-in" 개념이 최소 5곳(+ `ai-turn-orchestrator.service.ts` 의 번역판 3곳)에 흩어져 있으면, 다음에 opts 에 필드를 하나 더 추가할 때 그중 한 곳을 빠뜨리기 쉽다 — 이는 바로 이 PR 이 고친 CRITICAL #1(2026-07-30: `opts` 가 세 소비처 중 일부에서만 실제로 DB 가드에 반영됨)과 동일한 "같은 계약이 여러 곳에 흩어져 존재" 구조다.
  - 제안: `execution-engine.service.ts`/`engine-driver.interface.ts` 는 `state-machine.ts` 의 `TransitionOptions` 를 import 해 `opts?: TransitionOptions` 로 통일한다. `ai-turn-orchestrator.service.ts` 는 자신의 `{ retryReentry?: boolean }` 를 파일 상단에 `type RetryReentryOpts = { retryReentry?: boolean };` 로 1회 선언해 3개 메서드 시그니처가 재사용하게 한다.

- **[WARNING]** `NON_TERMINAL_STATUSES_SQL` / `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 두 static 상수가 거의 동일한 빌드 체인을 반복
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:513-518`(기존), `:534-543`(이번 diff 신규 추가)
  - 상세: 두 상수는 `Object.values(ExecutionStatus).filter(...).map((status) => \`'${status}'\`).join(', ')` 체인이 100% 동일하고, `filter` 콜백 조건(`!TERMINAL_STATUSES.has(status)` vs `!TERMINAL_STATUSES.has(status) || status === FAILED`)만 다르다. 이 파일은 WARNING #8(2026-07-26)에서 "손으로 중복 조립하던 SQL 리터럴 목록을 상수화"한 이력이 있는데, 이번엔 그 상수를 매개변수화하는 대신 형제 상수를 하나 더 만들어 같은 빌드 로직이 다시 두 곳에 존재하게 됐다. 세 번째 예외 상태가 필요해지면 세 번째 상수가 또 생길 위험이 있다.
  - 제안: `private static buildStatusesSql(extraIncluded: ExecutionStatus[] = [])` 같은 private static 헬퍼로 일반화하고, 두 상수를 그 헬퍼 호출 결과로 선언하면 필터 로직이 한 곳에만 존재한다.

- **[WARNING]** "opts → DB 가드 플래그" 3줄 삼항 변환이 한 파일 안에서 문자 그대로 반복
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:457,1508,1600,1619` (`allowRetryReentry ? { allowRetryReentry: true } : undefined` 형태), `execution-engine.service.ts:8173-8175`(`statusesSql`) · `:8459-8461`(`elseStatusesSql`, 변수명만 다르고 로직은 동일)
  - 상세: 바로 이 "opts→allowRetryReentry 번역 한 줄"이 최신 커밋(`3c306d593`, "10R CRITICAL — opts→DB가드 번역 seam 무검증")의 원인이었다. 같은 표현이 `ai-turn-orchestrator.service.ts` 한 파일에서만 4번(`finalizeAiNode` 안에 3번 + `reparkAiResumeTurn` 1번) 손으로 반복되고 있어, 다음에 다섯 번째 소비처가 추가되면 그중 하나를 빠뜨릴 여지가 구조적으로 남는다 — 이미 같은 결함 클래스가 8R/10R 두 라운드 연속 발생했다.
  - 제안: `finalizeAiNode` 상단(`allowRetryReentry` 계산 직후)에서 `const retryReentryOpts = allowRetryReentry ? { allowRetryReentry: true as const } : undefined;` 를 한 번만 계산해 세 호출부가 재사용하게 한다. `execution-engine.service.ts` 는 `resolveStatusesSql(opts)` 같은 private 헬퍼로 통합하고, 변수명도 `statusesSql`/`elseStatusesSql` 로 갈리지 않게 통일한다.

- **[INFO]** 핵심 가드 함수의 주석 대 코드 비율이 매우 높아, 현재 유효한 계약을 파악하기 전에 여러 라운드의 역사를 읽어야 함
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` — `finalizeGuarded` (554~678행, JSDoc 554-572 + 본문 573-678)
  - 상세: `if (live.status === target)` 분기 하나에 2차~4차 라운드에 걸친 CRITICAL 수정 이력이 인라인 주석 약 40줄로 누적돼 있고, 실제 실행 로직은 15줄 안팎이다. 이 스타일은 이 모듈 전반에 이미 정착된 컨벤션이고 동시성 회귀를 실제로 막아온 실질적 가치가 있어 CRITICAL 은 아니지만, 라운드가 계속 쌓일수록 신규 독자가 "지금 유효한 계약"에 도달하기까지의 진입장벽이 커진다.
  - 제안: 다음 정리 라운드에서 이미 안정화된 과거 라운드 서술(예: 2차/3차)은 spec 의 `## Rationale` 또는 `plan/complete/` 로 옮기고, 인라인에는 "왜 이 가드가 필요한가"의 최신 요약만 남기는 것을 고려.

- **[INFO]** `canTransition` 의 retry 재진입 허용 대상이 `||` 체인으로 하드코딩돼 있어 다음 확장 시 조건식이 계속 길어짐
  - 위치: `codebase/backend/src/modules/execution-engine/state/state-machine.ts:72-77`
  - 상세: 이번 diff 로 허용 대상이 1개(RUNNING)에서 2개(RUNNING, WAITING_FOR_INPUT)로 늘며 `||` 조건이 추가됐다. `ALLOWED_TRANSITIONS` 자체는 배열 기반(`.includes`)인데, 이 opt-in 예외만 개별 `===` 비교의 `||` 체인이라 스타일이 갈린다.
  - 제안: `const RETRY_REENTRY_TARGETS: string[] = [ExecutionStatus.RUNNING, ExecutionStatus.WAITING_FOR_INPUT];` 를 선언해 `.includes(to)` 로 표현하면 `ALLOWED_TRANSITIONS` 와 스타일이 통일되고, 세 번째 대상이 추가돼도 배열에 원소 하나만 추가하면 된다.

## 요약

이번 변경은 `execution.retry_last_turn` 재진입의 FAILED→RUNNING/WAITING_FOR_INPUT 짝 전이가 DB 가드(`lockNonTerminalExecutionRow`/`updateExecutionStatus`)에서 opts 미전파로 항상 0행 매칭되던 CRITICAL 을 바로잡은 것이며, 개별 파일의 가독성·네이밍·주석 품질·함수 길이·중첩 깊이는 기존 컨벤션과 일관되고 대체로 양호하다(매직 넘버 신규 도입 없음, `RETRY_STATE_KEY` 상수화 등 기존 중복도 정리됨). 다만 이번 fix 가 도입한 "opts→SQL 상수/DB 플래그 번역" 로직 자체가 5개 파일 중 3개에 걸쳐 최소 9곳(타입 shape 5곳 + 삼항 변환 4곳, SQL 빌더 포함 시 그 이상)에서 동일 패턴으로 손 복제되어 있다. 이는 바로 이 PR 이 8R·10R 두 라운드 연속으로 겪은 "여러 호출부 중 일부만 갱신되고 나머지는 누락"되는 결함 클래스와 동형의 구조적 위험을 남긴다 — 지금은 테스트로 전부 잠겼지만, 다음 소비처가 추가될 때 동일 사고가 재발할 토양이 그대로 남아 있다. 타입/헬퍼 중복 제거(WARNING 3건)를 다음 정리 라운드에서 반영하면 유지보수성이 한 단계 개선될 것이다.

## 위험도
MEDIUM
