# 아키텍처 리뷰 — retry-ie-residuals-c4a1b2 (C-4 처분)

## 발견사항

- **[INFO]** `finalizeGuarded` 의 "in-place mutation 이 계약" 문서화는 여전히 hidden side-channel 패턴을 그대로 남긴다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:567-576` (JSDoc `@param execution`)
  - 상세: 이번 diff 는 `finalizeGuarded` 가 인자로 받은 `execution` 엔티티를 `status`/`durationMs`/`finishedAt` 세 필드에 대해 **암묵적으로 되쓴다**는 사실을 JSDoc 으로 명시했다. 좋은 문서화지만, 구조적으로는 "출력 파라미터(output parameter)를 통한 다중 값 반환"이라는 안티패턴을 없앤 것이 아니라 **그 존재를 인정하고 고정**한 것이다. 호출부(`completeRetryExecution`/`failRetryExecution`)는 반환값(`boolean`)만으로는 어떤 필드가 갱신됐는지 알 수 없고, 반드시 이 JSDoc 을 읽어야 안전하게 후속 로직(`resolveTerminalDurationMs(execution)` 등)을 짤 수 있다 — 컴파일러가 강제하지 못하는 계약이라 세 번째 호출부가 추가되면 같은 실수(되쓰기 누락)가 재발할 수 있는 표면이다.
  - 제안: 지금 당장 시그니처를 바꿀 필요는 없다는 plan 의 판단(`retry-turn-terminal-guard.md` W3, 범위 확대 우려)에 동의하지만, 후속에서 순수 반환형(`{ persisted: boolean; live: { status; durationMs; finishedAt } }`)으로 전환할 때는 되쓰기 소비처(3곳: `completeRetryExecution`, `failRetryExecution`, 그리고 향후 추가될 호출부)를 **함께** 마이그레이션하는 것으로 범위를 못박아 두는 것이 좋다.

- **[INFO]** 동일한 "guarded terminal 전이 + 반환값 로깅" 패턴이 서비스 경계를 넘어 두 곳에서 독립적으로 재구현되고 있다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4313-4322` (executeSync timeout catch) vs `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:583-709` (`finalizeGuarded`)
  - 상세: 이번 diff 가 `execution-engine.service.ts` 의 `executeSync` timeout catch 에 `persisted` 소비(`if (!persisted) this.logger.warn(...)`)를 추가해 형제 경로(`failFirstSegmentSetup`)와 관측을 맞췄다. 그런데 이 "guarded UPDATE → 반환값 확인 → 미영속 시 warn" 패턴은 `RetryTurnService.finalizeGuarded` 가 이미 별도로, 더 정교하게(CANCELLED COALESCE 분기 포함) 구현하고 있다. 두 서비스가 같은 문제(동시 cancel 로 인한 lost-update 방지)를 구조적으로 다른 자리에서 풀고 있고, 이번 diff 자체가 "한쪽만 관측을 맞췄던" 결함(비대칭 로깅)의 재발 사례다 — 즉 이 중복이 정확히 이 클래스의 버그를 낳는 자리다.
  - 제안: `plan/in-progress/ie-resume-turn-boundary-cancel.md:539-542` 가 `markExecutionFailed` 공용 헬퍼 승격을 이미 별도 항목으로 추적 중이므로 추가 조치는 불요하나, 통합 시점에 `RetryTurnService.finalizeGuarded` 도 같은 추상화로 흡수할지(또는 명시적으로 별도로 남길지) 스코프에 포함할 것을 권고한다 — 지금처럼 부분적으로만 패턴이 맞춰지면 세 번째 비대칭이 또 나올 수 있다.

- **[INFO]** `markNodeCancelled` 실패를 감싸는 catch 가 예외 종류를 구분하지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:409-432`
  - 상세: 신규 `try { await this.driver.markNodeCancelled(...) } catch (err) { this.logger.error(...) }` 는 DB 쓰기 실패(의도된 시나리오)와 프로그래밍 오류(예: `markNodeCancelled` 내부의 TypeError)를 동일하게 취급해 로그만 남기고 삼킨다. 취소 분류를 FAILED 로 오분류하지 않는다는 목표는 달성하지만, `markNodeCancelled` 자체에 새로운 버그가 생겨도 이 경로에서는 항상 조용히 넘어가게 된다.
  - 제안: 감사 로깅 실패(#1259)와 같은 판단이라는 근거가 plan(`ie-resume-turn-boundary-cancel.md:555-563`)에 명시돼 있어 현재로선 수용 가능한 트레이드오프다. 추가 조치는 불필요하되, 이 catch 가 잡는 대상이 넓어질 경우(예: 향후 다른 검증 로직이 같은 블록에 추가되는 경우) 의도치 않게 구조적 오류까지 은폐할 수 있다는 점을 인지해 둘 것.

- **[INFO]** `RetryEngineDriver.updateExecutionStatus` 의 "SET 절이 `error` 컬럼을 무조건 쓴다"는 계약이 인터페이스가 아니라 호출부 주석에만 존재한다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:757-769` (`prepareSuccessTermination` JSDoc)
  - 상세: `prepareSuccessTermination` 이 `execution.error = null` 을 명시적으로 세팅해야 하는 이유는 driver 의 guarded UPDATE 가 `error = $8::jsonb` 로 항상 엔티티 값을 그대로 영속하기 때문이다 — 이 사실은 `retry-turn.service.ts` 의 주석에만 적혀 있고, driver 를 호출하는 다른 소비자(`ai-turn-orchestrator.service.ts` 등)가 이 인터페이스 메서드를 새로 호출할 때 같은 함정(옛 `error` 잔류)에 빠질 수 있다. 인터페이스 정의(`engine-driver.interface.ts`, 이번 diff 범위 밖)에 이 계약이 명시돼 있는지는 이번 리뷰에서 확인하지 못했다.
  - 제안: `RetryEngineDriver`/`AiTurnEngineDriver` 인터페이스의 `updateExecutionStatus` JSDoc 에도 "호출 전 `error`/`finishedAt`/`durationMs` 를 원하는 최종값으로 세팅해 둘 것 — SET 절이 엔티티 값을 무조건 쓴다"는 계약을 명시하는 것을 다음 인터페이스 변경 시 함께 검토할 것(이번 diff 범위 밖이라 차단 사유 아님).

## 긍정적으로 확인한 점

- `markSpawnedRowFailed`(zombie row 마킹 4단계) / `prepareSuccessTermination`(성공 종결 필드 세팅) extract-method 는 SRP·DRY 관점에서 적절하다 — 두 not-found 분기·두 성공 종결 분기가 각각 하나의 단일 소스로 수렴했다.
- `execution.entity.ts` 의 `error: Record<string, unknown> | null` 타입 정정은 엔티티의 다른 nullable 컬럼(`sourceIp`, `queuedAt` 등)과 동일한 관용을 따르며, DB 스키마(`nullable: true`)와 타입을 일치시켜 "타입이 거짓말하던" 상태를 해소했다. `execution.error = null` 대입이 캐스트 없이 타입체크를 통과하게 된 것은 이 변경의 직접적 귀결이다.
- plan 문서(`ie-resume-turn-boundary-cancel.md`, `retry-turn-terminal-guard.md`) 가 이번 라운드에서 처리한 항목과 의도적으로 남긴 항목을 표로 분리하고 각 항목마다 근거를 적은 것은, 스코프 크립(3개 종결 경로 동시 리팩터 등)을 피하면서도 추적성을 유지하는 좋은 거버넌스 관행이다.

## 요약

이번 changeset 은 새로운 아키텍처 결함을 도입하지 않는다. `retry-turn.service.ts` 의 extract-method 리팩터(`markSpawnedRowFailed`/`prepareSuccessTermination`)는 SRP·DRY 를 개선하고, `execution.entity.ts` 의 nullable 타입 정정은 데이터 레이어와 비즈니스 레이어 간 계약을 정직하게 맞춘다. `ai-turn-orchestrator.service.ts`/`execution-engine.service.ts` 의 두 수정은 기존에 문서화된 결함 클래스(취소 오분류, 반환값 미소비로 인한 관측성 비대칭)를 형제 경로와 일관되게 닫는 국소적 패치다. 다만 (1) `finalizeGuarded` 의 mutation-as-return-channel 패턴, (2) `ExecutionEngineService` 와 `RetryTurnService` 가 "guarded 종결 + 반환값 소비" 패턴을 독립적으로 재구현하는 구조적 중복, (3) driver 인터페이스 계약이 호출부 주석에만 존재하는 점은 이미 plan 에 후속으로 추적되고 있는 기존 기술 부채이며, 이번 diff 는 그 부채를 악화시키지 않고 문서화·국소 수정으로 대응했다. 스코프를 의도적으로 좁게 유지한 판단(3경로 통합 헬퍼 승격을 별도 PR 로 분리)은 회귀 위험 관리 관점에서 타당하다.

## 위험도
LOW
