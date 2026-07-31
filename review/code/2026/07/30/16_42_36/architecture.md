# 아키텍처(Architecture) 리뷰

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/state/state-machine.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`
- `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (컨텍스트, 본 diff 범위 밖)

diff 는 8R CRITICAL(`execution.retry_last_turn` 재진입 짝 전이가 DB 가드에 막혀 절대 persist 되지 않던 결함)의 수정 + 9R 후속(re-park 경로 `FAILED → WAITING_FOR_INPUT` 로 opt-in 확장)이다. `state-machine.ts` 의 opt-in(`allowRetryReentry`)을 `RUNNING` 뿐 아니라 `WAITING_FOR_INPUT` 까지 허용하도록 넓히고, 그 opt-in 이 실제 DB 잠금/UPDATE 가드(`lockNonTerminalExecutionRow`/`updateExecutionStatus`/`tryLockActiveExecutionAndSaveNodeExec`)까지 관통하도록 `opts` 파라미터를 4개 파일에 걸쳐 재배선했다.

## 발견사항

- **[WARNING]** 상태 전이 "허용 여부"의 이중 진실 소스(state-machine vs DB 가드) 구조가 이번 CRITICAL 버그의 근본 원인이며, 수정 후에도 구조 자체는 그대로 남는다.
  - 위치: `codebase/backend/src/modules/execution-engine/state/state-machine.ts:31-58` (`ALLOWED_TRANSITIONS` 주석 + `TransitionOptions`), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:505-543` (`NON_TERMINAL_STATUSES_SQL` / `NON_TERMINAL_OR_FAILED_STATUSES_SQL`), `execution-engine.service.ts:8168-8184`(`lockNonTerminalExecutionRow`), `execution-engine.service.ts:8354-8489`(`updateExecutionStatus`)
  - 상세: "이 전이가 논리적으로 유효한가"는 `state-machine.ts` 의 `ALLOWED_TRANSITIONS`/`canTransition` 이 단일 진실이지만, "이 전이가 실제로 DB 에 persist 될 수 있는가"는 `execution-engine.service.ts` 가 별도로 유지하는 SQL 상태 allow-list(`NON_TERMINAL_STATUSES_SQL`/`NON_TERMINAL_OR_FAILED_STATUSES_SQL`)가 독립적으로 결정한다. 이번 CRITICAL 은 정확히 이 두 표현이 어긋나서 발생했다 — state-machine 이 `allowRetryReentry` opt-in 을 이미 허용하는데(8R 이전 라운드에 이미 존재), DB 가드는 그 opt-in 을 몰라 FAILED 를 무조건 배제해 항상 0행이었다. 이번 diff 는 `opts.allowRetryReentry` 를 3개 소비처(`lockNonTerminalExecutionRow`/`tryLockActiveExecutionAndSaveNodeExec`/else 분기 guarded UPDATE)에 모두 스레딩해 두 표현을 재동기화했지만, "state-machine 의 opt-in 규칙이 바뀌면 DB 가드도 手動으로 따라와야 한다"는 구조적 결합은 사라지지 않았다. 향후 opt-in 대상이 하나 더 늘면(예: 다른 상태 쌍) 동일 클래스의 버그가 다시 발생할 수 있고, 유일한 안전망은 이번에 사후 추가된 단위 테스트(회귀 방지, 신규 케이스는 못 잡음)뿐이다.
  - 제안: 장기적으로 DB 가드의 SQL allow-list 를 `canTransition`/`ALLOWED_TRANSITIONS` 로부터 파생 생성(예: opt-in 조건별로 "그 opt-in 이 허용하는 추가 source 상태" 를 state-machine 쪽에서 export 하고 엔진이 그 값으로 SQL 리스트를 조립)하거나, 최소한 두 파일 상단에 상호 참조 주석("이 표를 바꾸면 반드시 execution-engine.service.ts 의 XXX_SQL 도 확인" / 역방향)을 명시해 재발 확률을 낮히는 것을 권장한다.

- **[WARNING]** `{ allowRetryReentry?: boolean }` opts 형태가 이미 export 된 `TransitionOptions` 를 재사용하지 않고 3개 파일 5곳에 인라인 구조적 타입으로 중복 선언되어 있다.
  - 위치: `state-machine.ts:45`(`export interface TransitionOptions`, 유일하게 named export 이나 타 파일에서 import 되지 않음), `execution-engine.service.ts:8171`(`lockNonTerminalExecutionRow` opts 파라미터), `execution-engine.service.ts:8233`(`tryLockActiveExecutionAndSaveNodeExec` opts 파라미터), `execution-engine.service.ts:8358`(`updateExecutionStatus` opts 파라미터), `engine-driver.interface.ts:81`(`CoreEngineDriver.updateExecutionStatus`), `engine-driver.interface.ts:213`(`AiTurnEngineDriver.tryLockActiveExecutionAndSaveNodeExec`)
  - 상세: 구조적 타이핑 덕에 지금은 문제없이 동작하지만, 동일 개념(`allowRetryReentry`)의 타입이 한 곳(named interface)이 아니라 5곳의 인라인 리터럴로 흩어져 있다. 이 파일은 이미 SQL 리터럴 중복으로 WARNING #8(2026-07-26)을 받아 `NON_TERMINAL_STATUSES_SQL` 상수화로 정리한 이력이 있는데, 이번 CRITICAL #1 수정 과정에서 타입 레벨에서 같은 패턴(정의 한 곳, 소비처 곳곳에 손 복제)이 재도입됐다. 나중에 `TransitionOptions` 에 필드가 하나 추가되면(예: `reason?: string`) 이 5곳 각각을 사람이 기억해서 갱신해야 하며, 잊어도 컴파일 에러가 나지 않는다(옵셔널 필드라 구조적으로 여전히 호환) — 조용한 기능 누락으로 이어질 수 있다.
  - 제안: `state-machine.ts` 의 `TransitionOptions` 를 다른 4곳에서 그대로 import 해 재사용(또는 alias export)하여 단일 진실 지점으로 좁힐 것을 권장.

- **[INFO]** 체크포인트 함수들의 `Promise<boolean>` 반환은 "정상 동시성 경합"과 "opts 미전파(프로그래밍 오류)"를 같은 `false` 로 합류시키는데, 바로 이 특성이 이번 버그가 여러 라운드 동안 조용히 은폐된 이유다.
  - 위치: `execution-engine.service.ts:8227-8232` (`tryLockActiveExecutionAndSaveNodeExec` 파라미터 주석에 이미 자체 서술됨), `execution-engine.service.ts:8354-8360`(`updateExecutionStatus`)
  - 상세: `updateExecutionStatus`/`tryLockActiveExecutionAndSaveNodeExec` 는 "동시 cancel 로 이미 terminal" 과 "opt-in 이 guard 에 도달하지 못해 상시 0행" 을 동일한 `false` 로 표현한다. 동시성 케이스에서는 이 획일적 처리가 정확히 의도된 설계(호출부가 원인을 굳이 구분하지 않고 일괄 discard)이지만, 그 설계 자체가 "프로그래머가 opts 전달을 빠뜨렸다"는 종류의 결함을 런타임에서 관측 불가능하게 만든다 — 이번 CRITICAL 이 8R 에 이르기까지 어떤 예외도 없이 조용히 발생한 이유다. 코드 주석에 이미 이 트레이드오프가 명시돼 있어 팀이 인지하고 있는 상태다.
  - 제안: 별도 조치 불요(설계 트레이드오프로 문서화됨) — 향후 이 choke point 에 새 opt-in 을 추가할 때는 반드시 이번처럼 "guard SQL 이 실제로 opt-in 상태를 포함하는지"를 직접 검증하는 테스트(mock 이 SQL 내용을 실제로 파싱/대조)를 함께 추가해야 한다는 점을 팀 관례로 남겨둘 가치가 있다.

- **[INFO]** (긍정) ISP/의존성 방향은 이번 변경으로 훼손되지 않았다.
  - 위치: `engine-driver.interface.ts:134-215`(`AiTurnEngineDriver`), `ai-turn-orchestrator.service.ts:430-459`(`reparkAiResumeTurn`), `ai-turn-orchestrator.service.ts:1426-1439`(`finalizeAiNode`)
  - 상세: 새 `opts` 파라미터는 소비자별로 분리된 인터페이스(`AiTurnEngineDriver`)와 그 단일 구현체(`ExecutionEngineService`)에 동시에 반영됐고, 기존 "boolean flag 대신 opts 객체" 관례(W5, Flag Parameter 안티패턴 회피)를 그대로 따른다. orchestrator 계층은 `retryReentry`(의도 표현) → 엔진 계층 `allowRetryReentry`(메커니즘 표현)로 경계에서 번역하는데, `applyRetryLastTurn`(`retry-turn.service.ts:466`) 한 곳에서만 `{ retryReentry: true }` 가 발화되고 그 값이 `processAiResumeTurn` → `reparkAiResumeTurn`/`finalizeAiNode` → `driver.updateExecutionStatus`/`tryLockActiveExecutionAndSaveNodeExec` 까지 조건부로 정확히 전파되는 것을 추적 확인했다 — 의도치 않게 opt-in 이 넓어지는 경로는 발견되지 않았다.

## 요약

이번 diff 는 실제로 발생한 CRITICAL(상태머신은 허용하나 DB 가드가 몰라 재진입 짝 전이가 구조적으로 절대 persist 되지 않던 결함)을 `opts.allowRetryReentry` 를 관련 3개 소비처(트랜잭션 내 행 잠금 SELECT, else 분기 guarded UPDATE, 짝 전이 choke point)에 일관되게 재배선해 정확히 닫았고, opt-in 범위(FAILED→RUNNING/WAITING_FOR_INPUT 두 타깃 한정)도 끝까지 추적한 결과 부주의한 확장 없이 좁게 유지된다. ISP 로 쪼갠 `EngineDriver` 계열 인터페이스와 그 단일 구현체는 새 파라미터 추가에도 계약이 흐트러지지 않았고, "opts 객체 vs boolean flag" 관례도 일관되게 지켜졌다. 다만 이 CRITICAL 의 근본 원인인 "상태 전이 규칙(state-machine)과 그 규칙의 DB 영속 가드(SQL allow-list)가 서로 다른 파일에 독립적으로 존재하고 수동으로만 동기화된다"는 구조는 이번 수정으로도 해소되지 않았으며, 같은 파일이 이미 한 번(WARNING #8, SQL 리터럴 중복) 겪은 것과 같은 종류의 "정의 한 곳·소비처 여러 곳 수동 복제" 패턴이 opts 타입 레벨에서도 반복되고 있어 후속 정리를 권장한다.

## 위험도

LOW
