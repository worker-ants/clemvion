# 의존성(Dependency) 리뷰 — engine-driver.interface.ts / retry-turn.service.ts / state-machine.ts

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 순수 내부 계약/로직 변경
  - 위치: 파일 전체 (`codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`, `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`, `codebase/backend/src/modules/execution-engine/state/state-machine.ts`)
  - 상세: `git diff origin/main...HEAD` 로 `package.json`/`pnpm-lock.yaml` 등 의존성 매니페스트 변경 여부를 확인한 결과 리포지토리 전체에서 변경 없음(diff 자체가 빈 결과). 검토 대상 3개 파일의 `import` 구문도 diff 상 추가·삭제가 전혀 없다(확인: `git diff` 를 `^import|^-import` 로 grep — 매치 0건). 변경의 실체는 (1) 엔진 내부 `EngineDriver` 계열 인터페이스 2개 메서드(`CoreEngineDriver.updateExecutionStatus`, `AiTurnEngineDriver.tryLockActiveExecutionAndSaveNodeExec`)에 하위호환 선택적 파라미터 `opts?: { allowRetryReentry?: boolean }` 를 추가한 것과 (2) `state-machine.ts` 의 `allowRetryReentry` opt-in 허용 전이 대상에 `WAITING_FOR_INPUT` 을 추가한 것, 그리고 다수의 JSDoc/주석 갱신뿐이다. 새 npm 패키지·버전 변경·라이선스 검토 대상이 없다.
  - 제안: 없음(정보성 확인).

- **[INFO]** 기존 의존성(TypeORM) 패치 버전 드리프트에 대한 방어가 이미 명시적으로 반영됨
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` — `delete spawnedRow.inputData[RETRY_STATE_KEY];` 앞 주석 블록 (`applyRetryLastTurn` 본문, "claim 이 DB 의 `input_data` 에서만 키를 원자 제거하므로" 로 시작하는 주석)
  - 상세: 주석은 "TypeORM 0.3.30 기준으로 확인된 jsonb diff" 동작을 근거로 들면서도 "이 delete 자체는 버전-불문 방어라 이후 patch 버전에서도 유지한다(W9)" 라고 명시한다. 실제로 `codebase/backend/package.json` 은 `"typeorm": "^0.3.28"` (caret range, 0.3.x 내 patch 자유 업데이트 허용)이고 `pnpm-lock.yaml` 에서 현재 해석된(resolved) 버전은 `0.3.30` 이다(직접 확인). 즉 향후 `pnpm install`/lockfile 갱신으로 0.3.31+ 로 patch 가 올라가도, 코드가 특정 patch 버전의 우연한 동작(엔티티 stale 값 재기록으로 인한 jsonb 부활)에 암묵적으로 의존하지 않도록 이미 대비되어 있다 — 의존성 버전 고정(pinning) 관점에서 바람직한 방어적 설계이며 별도 조치 불필요.
  - 제안: 없음(양호 확인). 다만 이런 "라이브러리 patch 버전 명시 근거" 주석이 향후에도 남을 경우, TypeORM 메이저/마이너 업그레이드 시 이 주석의 전제(jsonb diff 재-SELECT 동작)가 유효한지 회귀 테스트로 재확인하는 습관을 권장(코드 자체는 이미 버전-불문으로 안전).

- **[INFO]** 확장된 내부 인터페이스 계약(`opts.allowRetryReentry`)이 구현체·모든 소비자에 실제로 동기화되어 있음을 교차 확인
  - 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts` — `CoreEngineDriver.updateExecutionStatus`(파라미터 목록), `AiTurnEngineDriver.tryLockActiveExecutionAndSaveNodeExec`(파라미터 목록)
  - 상세: 두 메서드에 추가된 `opts?: { allowRetryReentry?: boolean }` 는 `EngineDriver`(canonical 구현체 `ExecutionEngineService`) 계약이 `CoreEngineDriver`→`InteractionEngineDriver`/`AiTurnEngineDriver`/`RetryEngineDriver` 로 상속되는 ISP 구조상, `RetryTurnService`·`AiTurnOrchestrator`·Form/ButtonInteractionService 등 `ENGINE_DRIVER` 토큰의 모든 소비 서비스로 전파되는 내부 의존성 표면 확장이다. optional 파라미터이므로 하위호환은 유지된다. `execution-engine.service.ts`(구현체)와 `ai-turn-orchestrator.service.ts`(소비자)를 grep 대조한 결과, `opts.allowRetryReentry` 가 실제 DB 가드 SQL 절(`statusesSql`/`elseStatusesSql`)까지 threading 되어 있고 4개 호출부 모두 `allowRetryReentry ? { allowRetryReentry: true } : undefined` 패턴으로 일관되게 전달한다 — "인터페이스는 약속했지만 구현이 무시" 하는 내부 계약 불일치는 발견되지 않았다. `retry-turn.service.ts` 자신의 `finalizeGuarded` 헬퍼는 이 opts 를 전달하지 않지만, 그 호출 시점엔 이미 FAILED→RUNNING/WAITING 재진입이 별도 경로(`finalizeAiNode`)로 완료된 뒤라 일반 전이(RUNNING→COMPLETED/FAILED/CANCELLED)만 다루므로 계약 위반이 아니다.
  - 제안: 없음(확인 완료). 참고로 이런 "인터페이스에 opts 추가 후 구현체 seam 번역 누락"은 바로 이 파일들의 직전 라운드(10R)에서 실제로 발생했던 CRITICAL 결함 클래스였다(`3c306d593 fix(engine): 10R CRITICAL — opts→DB가드 번역 seam 무검증`) — 현재는 해소되어 있으나, `EngineDriver` 파생 인터페이스에 opts 파라미터를 또 추가하는 향후 변경에서는 동일 패턴 재발을 막기 위해 구현체·모든 호출부 동시 갱신을 계약 테스트(spec)로 고정해 두는 것을 권장한다.

## 요약
이번 검토 대상 3개 파일(`engine-driver.interface.ts`, `retry-turn.service.ts`, `state/state-machine.ts`)은 신규 외부 패키지 추가나 버전 변경이 전혀 없는 순수 내부 리팩토링/버그수정이다 — `package.json`·lockfile 변경 없음, `import` 구문 추가·삭제 없음을 `git diff origin/main...HEAD` 로 직접 확인했다. 실질 변경은 엔진 내부 ISP 인터페이스 2개 메서드에 하위호환 선택적 파라미터(`opts.allowRetryReentry`)를 추가하고 상태머신의 opt-in 허용 전이 대상에 `WAITING_FOR_INPUT` 을 추가한 것, 그리고 다수의 JSDoc 정합화가 전부다. 기존 의존성(TypeORM 0.3.30, `@nestjs/*`) 사용 패턴은 그대로이며, 오히려 특정 patch 버전 동작에 대한 암묵 의존을 명시적으로 제거하는 방향(버전-불문 방어 주석, W9)으로 개선되었다. 확장된 인터페이스 계약이 구현체(`ExecutionEngineService`)와 모든 소비자(`AiTurnOrchestrator` 등)에 실제로 threading 되어 있음을 grep 으로 교차 확인했고 불일치는 없었다. 의존성 관점에서 CRITICAL/WARNING 사항 없음.

## 위험도
NONE
