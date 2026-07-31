# 의존성(Dependency) 리뷰 — 2026-07-30 16:42:36

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/state/state-machine.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`
- `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`

대응 커밋: `2ca44b769` (fix(engine): retry 재진입 짝 전이가 DB 가드에 막혀 절대 persist 되지 않던 결함, 8R CRITICAL) — 실제 diff 는 `state-machine.ts` / `execution-engine.service.ts` / `ai-turn-orchestrator.service.ts` / `engine-driver.interface.ts` 4개 파일. `retry-turn.service.ts` 는 이 클러스터의 소비자(`canTransition` 직접 import + `RetryEngineDriver` DI)로서 컨텍스트 제공용이며 이 커밋 자체에서는 변경되지 않았다(`git show --stat` 확인).

## 발견사항

- **[INFO]** 신규 외부 의존성 없음
  - 위치: 전 5개 파일 공통
  - 상세: `git show 2ca44b769`(및 후속 9R 커밋 `1838c6fec`) 전체 diff 를 `import `/`require(` 패턴으로 grep 한 결과 신규 추가된 import/require 라인이 0건이다. `package.json`/`pnpm-lock.yaml` 등 매니페스트 파일도 이번 diff 범위(`025aedd0f..1838c6fec`)에 포함되지 않았다(직전 의존성 변경 커밋은 훨씬 이전인 `f8c76c517`/`ef3617a79`). 5개 파일의 import 구문은 모두 기존 사용 중이던 `@nestjs/common`, `@nestjs/core`, `@nestjs/typeorm`, `typeorm`, `@nestjs/config`, `@nestjs/bullmq`(+ `bullmq` type-only), `@workflow/expression-engine`(모노레포 내부 패키지) 및 프로젝트 내부 모듈(`../executions/entities/execution.entity` 등)의 재사용뿐이다.
  - 제안: 없음 — 변경 없음 확인 완료.

- **[INFO]** 변경 성격 = 순수 내부 로직/타입 시그니처 확장 (버전 고정·라이선스·취약점·번들 크기 항목 해당 없음)
  - 위치: `state-machine.ts` (`canTransition`/`TransitionOptions`), `execution-engine.service.ts` (`NON_TERMINAL_OR_FAILED_STATUSES_SQL` 신설 상수 + `lockNonTerminalExecutionRow`/`tryLockActiveExecutionAndSaveNodeExec`/`updateExecutionStatus` else 분기에 `opts?: { allowRetryReentry?: boolean }` 파라미터 추가), `engine-driver.interface.ts` (`AiTurnEngineDriver.tryLockActiveExecutionAndSaveNodeExec` 시그니처에 동일 `opts` 추가)
  - 상세: 추가된 코드는 기존 enum(`ExecutionStatus`) 값을 필터링하는 `Object.values(...).filter(...).map(...).join(', ')` 체인 1개(상수)와, 기존 메서드에 optional 파라미터 1개를 3개 호출부에 스레드-through 하는 것뿐이다. 외부 라이브러리 API 표면은 전혀 건드리지 않는다 — `typeorm`/`bullmq`/`@nestjs/*` 사용 패턴(쿼리빌더, 트랜잭션, DI 데코레이터)은 기존과 동일하다. 따라서 버전 고정/라이선스/알려진 취약점/번들 크기/빌드 시간 항목은 이번 변경에 대해 "해당 없음"이다.
  - 제안: 없음.

- **[INFO]** 내부 인터페이스 계약(`AiTurnEngineDriver`) 확장 — 구현체·소비자 동기화 확인됨
  - 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts` 의 `AiTurnEngineDriver.tryLockActiveExecutionAndSaveNodeExec` / `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의 `tryLockActiveExecutionAndSaveNodeExec` 구현 / `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` 의 두 호출부(`this.driver.tryLockActiveExecutionAndSaveNodeExec(...)`)
  - 상세: 이 메서드는 `ENGINE_DRIVER` DI 토큰(`useExisting: ExecutionEngineService`)을 경유하는 단일-구현·단일-소비자 내부 계약이다. `grep -rn "tryLockActiveExecutionAndSaveNodeExec" codebase/backend/src --include="*.ts"`(spec 제외) 결과 인터페이스 선언 1곳, 구현 1곳(`execution-engine.service.ts`), 소비 2곳(모두 `ai-turn-orchestrator.service.ts`) 뿐이며 신규 `opts` 파라미터가 세 지점 모두 일관되게 반영돼 있다. `FormInteractionService`/`ButtonInteractionService` 는 이 메서드를 호출하지 않으므로(그들은 retry-reentry 경로에 참여하지 않음) 인터페이스 확장에서 제외된 것이 타당하다 — 이번 diff 가 "3번째 소비처(리뷰어는 2곳만 지목)"를 실측으로 찾아 반영했다는 커밋 메시지와도 정합한다. `RetryEngineDriver`(retry-turn.service.ts 가 주입받는 부분 인터페이스)는 `CoreEngineDriver`+`ReentryStateDriver`만 extends 하고 `AiTurnEngineDriver`를 포함하지 않으므로 이 메서드 확장과 무관 — 별도 반영 불필요가 맞다.
  - 제안: 없음(현 상태 정합) — 다만 이런 "opts 스레드-through 소비처 전수 확인"이 이번에도 리뷰어 육안 판단(2곳) 대신 실측(3곳)으로 정정된 이력이 있으므로, 향후 `EngineDriver` 계열 인터페이스에 optional capability 플래그를 추가할 때는 이 파일들처럼 `grep`으로 전체 소비처를 기계적으로 열거하는 습관을 유지할 것을 권장(참고용, 차단 사유 아님).

- **[INFO]** 내부 모듈 결합도 변화 없음 (신규 provider/신규 순환 DI 없음)
  - 위치: 5개 파일 전체 constructor / import 목록
  - 상세: 이번 diff 는 기존 constructor 시그니처(DI 주입 목록)를 변경하지 않는다 — `forwardRef`/`ENGINE_DRIVER` 순환 DI 배선은 그대로이고, 새 provider·새 모듈 등록도 없다. 즉 NestJS 모듈 그래프(`ExecutionEngineModule` 등)에 대한 영향은 0이며, 변경은 이미 존재하는 인터페이스의 메서드 시그니처 확장(optional param)에 한정된다.
  - 제안: 없음.

## 요약

이번 변경분(state-machine.ts / execution-engine.service.ts / ai-turn-orchestrator.service.ts / engine-driver.interface.ts, retry-turn.service.ts 는 컨텍스트)은 `execution.retry_last_turn` 재진입의 짝 상태 전이가 DB 가드(`lockNonTerminalExecutionRow` 등)에서 항상 0행 매칭되던 구조적 결함을 고치는 순수 내부 로직 수정이다. `git show`/grep 으로 실측한 결과 신규 외부 패키지, `package.json`/lock 파일 변경, import/require 추가가 전혀 없어 새 의존성·버전 고정·라이선스·취약점·번들 크기·빌드 시간 항목은 모두 "해당 없음"이다. 유일하게 의존성 관점에서 볼 만한 지점은 `engine-driver.interface.ts` 의 `AiTurnEngineDriver` 내부 계약 확장인데, 구현체(`ExecutionEngineService`)와 유일 소비자(`AiTurnOrchestrator`)가 모두 일관되게 갱신됐고 무관한 인터페이스(`RetryEngineDriver`)는 올바르게 영향받지 않았음을 grep 으로 확인했다. DI 모듈 그래프·provider 목록도 변경이 없다.

## 위험도

NONE
