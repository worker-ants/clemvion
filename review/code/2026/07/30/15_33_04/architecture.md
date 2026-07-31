# 아키텍처(Architecture) Review

대상: `2ca44b769 fix(engine): retry 재진입 짝 전이가 DB 가드에 막혀 절대 persist 되지 않던 결함 (8R CRITICAL)`
검토 파일: `state/state-machine.ts`, `execution-engine.service.ts`, `ai-turn-orchestrator.service.ts`, `engine-driver.interface.ts`, `retry-turn.service.ts`

## 발견사항

- **[WARNING]** retry-reentry 예외 불변식이 타입/구조가 아니라 계층마다 수동으로 이어 나르는 boolean 하나로만 성립함 (OCP / 응집도 / 확장성)
  - 위치: `codebase/backend/src/modules/execution-engine/state/state-machine.ts:57` (`TransitionOptions.allowRetryReentry`), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8171`(`lockNonTerminalExecutionRow`), `:8233`(`tryLockActiveExecutionAndSaveNodeExec`), `:8358`(`updateExecutionStatus`), `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:81`, `:213`, `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:442`~`457`(`reparkAiResumeTurn`), `:1437`·`:1508`·`:1600`·`:1619`(`finalizeAiNode`), `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:466`(`applyRetryLastTurn` → `processAiResumeTurn` 호출)
  - 상세: "FAILED 인 Execution 은 원칙적으로 부활 불가, 단 `retry_last_turn` 재진입만 예외"라는 불변식이 단일 진입점이 아니라 최소 6개 지점(상태머신 1 + DB 가드 헬퍼/소비처 3 + 오케스트레이터 호출부 4 + retry 서비스 1)에서 동일 `{ allowRetryReentry: true }` 를 빠짐없이 전달해야만 성립한다. 이 커밋 자체가 같은 기능에 대한 8번째 라운드 수정("8R CRITICAL")이고, 커밋 메시지가 스스로 "리뷰어는 2경로만 지목했으나 실측으로 3곳임을 확인" 이라고 적었듯, 이번 라운드조차 설계 검토만으로는 소비처 전수(`tryLockActiveExecutionAndSaveNodeExec`)를 찾지 못했고 mutation testing 으로 사후 발견했다. 즉 이 패턴은 타입 시스템이나 구조로 "어느 호출부가 opts 를 빠뜨렸는지"를 정적으로 잡아주지 못하고, 오직 런타임 테스트(그것도 이번엔 mock 이 8라운드 동안 결함을 은폐)에만 의존해 검증된다 — 향후 4번째 예외 케이스나 4번째 소비처가 추가될 때 같은 클래스의 결함이 재발할 구조적 위험이 남는다.
  - 제안: retry-reentry 시나리오 전체(`processAiResumeTurn` + `finalizeAiNode` + `reparkAiResumeTurn` 조합)를 감싸는 단일 진입점(예: `RetryEngineDriver` 전용 `transitionForRetryReentry(...)`)으로 캡슐화해 개별 호출부가 `opts` 존재 자체를 몰라도 되게 하거나, 최소한 "표 밖 전이를 필요로 하는 모든 DB 가드 호출부가 opts 를 받는지"를 기계적으로 확인하는 상수 목록 + 유닛 테스트를 추가해 4번째 소비처 누락을 컴파일/CI 시점에 잡을 것을 권장한다.

- **[WARNING]** SQL 상태 목록 선택 삼항식이 두 곳에 문자 그대로 중복 — 과거 동일 클래스 결함(WARNING #8)의 재발 소지
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8173`-`8175`(`lockNonTerminalExecutionRow` 내부의 `statusesSql` 계산) 및 `:8459`-`8461`(`updateExecutionStatus` else 분기의 `elseStatusesSql` 계산)
  - 상세: `opts?.allowRetryReentry ? NON_TERMINAL_OR_FAILED_STATUSES_SQL : NON_TERMINAL_STATUSES_SQL` 삼항식이 두 곳에 그대로 복제되어 있다. 이 파일은 이미 "손으로 중복된 status 리터럴 목록"이 WARNING #8(2026-07-26)로 지적되어 `NON_TERMINAL_STATUSES_SQL` 상수로 단일화된 이력이 있는데, 이번 opt-in 로직은 상수 자체(값)는 재사용하면서도 "어느 상수를 고를지"를 판단하는 삼항식 로직을 다시 두 곳에 나누어 심었다. 향후 세 번째 예외(예: 다른 opt-in 사유)가 추가되면 한쪽만 갱신되고 다른 쪽이 stale 로 남는 drift 가 재발할 수 있다.
  - 제안: `private static resolveNonTerminalStatusesSql(opts?: { allowRetryReentry?: boolean }): string` 같은 단일 헬퍼로 그 삼항식 판단 자체를 추출해 두 호출부가 공유하게 한다.

- **[INFO]** 동일 boolean 개념이 계층마다 다른 필드명으로 번역됨
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:220`, `:224`, `:442`, `:457` (`opts.retryReentry` → `{ allowRetryReentry: true }` 변환), `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:466` (`{ retryReentry: true }`) — 이 두 파일은 필드명 `retryReentry` 사용. 반면 `codebase/backend/src/modules/execution-engine/state/state-machine.ts:57`, `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:81`, `:213`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8171`/`8233`/`8358` 는 `allowRetryReentry` 사용.
  - 상세: orchestrator/retry-turn 계층은 `retryReentry`, state-machine/engine-driver/execution-engine 계층은 `allowRetryReentry` 를 쓴다. 매 계층 경계에서 `opts?.retryReentry ? { allowRetryReentry: true } : undefined` 같은 수동 리네임 변환이 필요해(`ai-turn-orchestrator.service.ts:457` 등), 플래그를 추적할 때 불필요한 인지 부하가 더해진다. 기능적 결함은 아니다.
  - 제안: 두 계층이 동일 필드명을 공유하도록 통일(저위험 후속 정리, 이번 PR 스코프 밖으로 미뤄도 무방).

## 참고 (설계상 양호한 점)

- 상태머신(순수 함수, `state-machine.ts`)과 DB 영속(`execution-engine.service.ts`)의 책임 분리가 유지된다 — opt-in 이 두 레이어 모두에서 독립적으로(그리고 이번 수정으로 일관되게) 요구되는 defense-in-depth 구조.
- `ALLOWED_TRANSITIONS[FAILED] = []` 를 유지한 채 opt-in 은 정확히 `FAILED → RUNNING`/`FAILED → WAITING_FOR_INPUT` 두 타깃으로만 좁혀져 있고, DB 가드 쪽 `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 도 `COMPLETED`/`CANCELLED` 는 계속 배제한다 — opt-in 이 "일반 부활 허용"으로 넓혀지지 않도록 하는 설계 의도가 코드·테스트(`state-machine.spec.ts` "should keep failed terminal for every other target even with opt-in") 양쪽에서 일관되게 지켜진다.
- `EngineDriver` 를 `CoreEngineDriver`/`InteractionEngineDriver`/`ReentryStateDriver`/`AiTurnEngineDriver`/`RetryEngineDriver` 로 나눈 ISP 구조가 이번 변경(옵션 파라미터 추가)에도 그대로 유지되며, 새 옵션은 기존 시그니처에 optional 트레일링 파라미터로만 추가되어 하위 호환을 깨지 않는다.
- boolean 플래그를 직접 전달하지 않고 `opts?: { allowRetryReentry?: boolean }` 객체 파라미터로 감싼 것은 이 코드베이스가 이미 채택한 "Flag Parameter 안티패턴 회피" 컨벤션(예: `finalizeAiNode` 의 `opts?: { retryReentry?: boolean }`)과 일관된다.

## 요약

이 커밋은 `execution.retry_last_turn` 재진입의 `FAILED → RUNNING`/`FAILED → WAITING_FOR_INPUT` 짝 전이가 상태머신 opt-in 은 통과하면서도 DB 가드(3개 소비처: `lockNonTerminalExecutionRow`, `tryLockActiveExecutionAndSaveNodeExec`, `updateExecutionStatus` else 분기) 에는 반영되지 않아 매 호출 결정적으로 실패하던 구조적 결함을 수정한다. 상태머신/DB 레이어 분리, ISP 로 쪼갠 `EngineDriver` 서브 인터페이스, opts 객체 파라미터 컨벤션 등 기존에 확립된 아키텍처 규율을 그대로 따르고 있고, opt-in 의 범위(FAILED→RUNNING/WAITING_FOR_INPUT 만, COMPLETED/CANCELLED 는 계속 배제)도 정확히 좁혀져 있어 현재 diff 자체의 정확성은 테스트(mutation 5/5 포함)로 뒷받침된다. 다만 이 불변식은 컴파일러가 강제할 수 없는 boolean 하나를 상태머신·인터페이스·서비스·오케스트레이터·retry 서비스 등 6개 이상 지점에 수동으로 동기화해야 성립하는 구조이며, "8R" 이력과 이번 라운드에서도 3번째 소비처를 사후 실측으로 찾아낸 사실이 이 패턴의 구조적 취약성(정적 검증 불가, 신규 소비처 추가 시 재발 위험)을 뒷받침한다. SQL 상태-목록 선택 로직의 국소적 중복(과거 지적된 것과 동일 클래스)과 계층 간 필드명 불일치도 경미하지만 관찰된다.

## 위험도

LOW
