# 아키텍처 리뷰 — retry-ie-residuals-c4a1b2 (C-4 처분 + 1라운드 RESOLUTION 반영)

## 컨텍스트

이번 changeset 은 두 갈래로 구성된다: (1) `retry-turn-terminal-guard.md`/`ie-resume-turn-boundary-cancel.md`
잔여 항목을 닫는 코드 수정 5건(`ai-turn-orchestrator.service.ts`, `execution-engine.service.ts`,
`retry-turn.service.ts`, `execution.entity.ts`, 관련 spec 3개), (2) 그 changeset 에 대한 1라운드 리뷰
(`17_55_50`)의 WARNING 5건(W1~W5)을 정정한 `RESOLUTION.md` 및 그 산출물 커밋. 두 갈래 모두 저장소 안
소스를 직접 `Read` 로 열어 독립 검증했다.

## 발견사항

- **[INFO]** `finalizeGuarded` 의 in-place mutation 계약이 여전히 output-parameter 안티패턴을 고정한다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:567-576` (JSDoc `@param execution`)
  - 상세: 이번 라운드는 `@param execution` 태그로 "`status`/`durationMs`/`finishedAt` 세 필드가
    in-place 로 변이된다"는 계약을 명시했다(1라운드 W3 대응). 좋은 문서화지만 구조는 바뀌지 않았다 —
    호출부는 여전히 `boolean` 반환값만으로는 어떤 필드가 갱신됐는지 알 수 없고, 반드시 JSDoc 을 읽어야
    안전하게 후속 로직(`resolveTerminalDurationMs(execution)` 재호출 등)을 짤 수 있다. 컴파일러가 강제
    하지 못하는 계약이라 세 번째 호출부가 추가되면 같은 실수(되쓰기 누락)가 재발할 수 있는 표면이
    그대로 남아 있다. 1라운드 architecture 리뷰가 이미 지적했고 plan(`retry-turn-terminal-guard.md`
    INFO 2R INFO 2)이 "지금은 시그니처를 바꾸지 않는다"로 명시적으로 처분했으므로 새로운 결함은 아니다.
  - 제안: 그대로 — 후속에서 순수 반환형(`{ persisted, live }`)으로 전환할 때는 되쓰기 소비처(현재 2곳:
    `completeRetryExecution`/`failRetryExecution`, 향후 추가분 포함)를 함께 마이그레이션하는 것으로
    범위를 못박아 둘 것.

- **[INFO]** "guarded 종결 + 반환값 소비" 패턴이 서비스 경계를 넘어 독립적으로 재구현되는 중복이 이번
  라운드에도 유지·확산된다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4308-4322`
    (`executeSync` timeout catch, 신규 `persisted` 소비) vs
    `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:583-709` (`finalizeGuarded`)
  - 상세: 이번 diff 가 `execution-engine.service.ts` 에 추가한 `if (!persisted) { this.logger.warn(...) }`
    는 정확히 `RetryTurnService.finalizeGuarded` 가 이미 별도로(CANCELLED COALESCE 분기까지 포함해 더
    정교하게) 풀고 있는 동일 문제(동시 cancel 로 인한 lost-update 관측)를 또 한 번 그 자리에서
    재구현한 것이다. `ExecutionEngineService` 는 `CoreEngineDriver` 구현체이자 `RetryTurnService` 가
    `this.driver` 로 호출하는 대상이기도 해서, 두 서비스가 사실상 같은 "guarded 종결" 책임을 각자
    다른 위치에서 부분적으로 재발명하고 있다 — 정확히 이런 비대칭(한쪽만 관측을 맞췄던 것)이 이번
    changeset 이 닫으려는 결함의 근원이었다. `plan/in-progress/ie-resume-turn-boundary-cancel.md:539-542`
    가 `markExecutionFailed` 공용 헬퍼 승격을 이미 추적 중이므로 신규 지적은 아니다.
  - 제안: 공용 헬퍼 승격(3경로 통합) 시 `RetryTurnService.finalizeGuarded` 도 같은 추상화로 흡수할지
    스코프에 명시적으로 포함할 것 — 지금처럼 부분 정합만 이어지면 세 번째 비대칭이 또 나올 수 있다.

- **[INFO]** `AiTurnOrchestrator`(오케스트레이션/비즈니스 레이어)가 driver(영속 레이어) 예외를 종류
  구분 없이 흡수한다
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:409-432`
    (`assertLinkedTransitionApplied` 의 `try { await this.driver.markNodeCancelled(...) } catch (err) { ... }`)
  - 상세: `catch (err)` 의 범위가 "취소 마킹 DB 저장 실패"라는 의도된 시나리오뿐 아니라 `markNodeCancelled`
    내부의 프로그래밍 오류까지 동일하게 흡수한다. 취소 **분류**의 정확성을 지키기 위한 레이어 책임
    분리(비즈니스 레이어가 "이 실패로 사용자 취소 흐름을 오염시키지 않는다"고 결정) 자체는 타당하지만,
    catch 대상이 넓어 driver 계층의 구조적 결함까지 조용히 삼킬 수 있다. plan 이 `#1259` 감사 로깅
    실패와 동일 판단으로 명시 수용한 트레이드오프라 새로운 결함은 아니다.
  - 제안: 조치 불요(문서화된 의도). 이 catch 범위가 향후 더 넓어지지 않도록(예: 다른 검증 로직을
    같은 블록에 얹지 않도록) 유의할 것.

- **[INFO]** `Execution.error` 엔티티 타입 정정이 데이터 레이어→응답 DTO 레이어로 정확히 전파됐고,
  `ResponseExecution` 의 `error` 재선언은 이제 부분적으로 중복이다
  - 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts:81`
    (`error: Record<string, unknown> | null`) → `codebase/backend/src/modules/executions/executions.service.ts:95-99`
    (`ResponseExecution = Omit<Execution, 'error' | 'inputData' | 'outputData' | ...> & { error: ...; ... }`)
  - 상세: 직접 `Read` 로 확인 — `executions.service.ts:74-93` 의 JSDoc 이 이번 라운드에 정정돼
    "`error` 는 이제 엔티티도 `| null` 이다, 넓히는 대상은 `inputData`/`outputData` 뿐"이라고 정확히
    서술하고 있다(1라운드 W4 fix, 코드와 문서가 일치함을 확인). 다만 `ResponseExecution` 타입 정의
    자체는 여전히 `Omit<Execution, 'error' | ...>` 로 `error` 를 명시적으로 제외한 뒤 동일한 타입
    (`Record<string, unknown> | null`)으로 재선언한다 — 기능적으로 틀리지 않지만, `error` 항목에
    한해서는 이제 이 Omit-and-redefine 이 불필요한 간접화다. 레이어 경계(엔티티 vs 응답 DTO)를 만드는
    의도된 구조라 당장 문제는 아니다.
  - 제안: 조치 불요. 후속에서 `inputData`/`outputData` 도 엔티티 타입이 nullable 로 정정되는 시점에
    `ResponseExecution` 의 Omit 목록에서 `error` 를 함께 정리하는 것을 고려할 수 있다(우선순위 낮음).

## 긍정적으로 확인한 점

- `markSpawnedRowFailed`/`prepareSuccessTermination` extract-method 는 SRP·DRY 관점에서 견고하다.
  `retry-turn.service.ts:711-777` 을 직접 열어 확인한 결과, 1라운드 WARNING(W1: JSDoc 오귀속)이
  정확히 정정돼 `completeRetryExecution` 의 JSDoc(756-776줄)이 이제 그 실제 선언(777줄) 바로 위에
  있고, 두 신규 헬퍼도 각자 올바른 JSDoc 을 갖는다 — RESOLUTION.md 의 주장을 코드로 재현·검증했다.
- `execution.entity.ts` 의 `error` nullable 타입 정정은 DB 스키마(`nullable: true`)와 타입을 일치시켜
  데이터 레이어와 비즈니스 레이어 사이의 "타입이 거짓말하던" 계약 불일치를 해소했다. 이 변경이
  `executions.service.ts` 의 문서 두 곳을 stale 하게 만드는 부수효과(1라운드 side_effect WARNING)도
  이번 라운드에 정확히 정정된 것을 확인했다.
- 코드 수정 4건(마킹 실패 흡수, timeout 반환값 소비, 헬퍼 추출 2건) 모두 기존 모듈 경계(execution-engine
  ↔ executions ↔ entities)를 넘지 않고 국소적으로 닫혔다 — 새로운 순환 의존이나 레이어 역행은
  관측되지 않았다.

## 요약

이번 changeset(코드 수정 5건 + 1라운드 RESOLUTION 정정)은 새로운 아키텍처 결함을 도입하지 않는다.
`markSpawnedRowFailed`/`prepareSuccessTermination` extract-method 는 SRP·DRY 를 개선했고, 1라운드에서
지적된 JSDoc 오귀속(W1)·문서 drift(W4)는 소스를 직접 열어 재확인한 결과 정확히 정정돼 있다.
남아 있는 세 가지 구조적 관찰 — (1) `finalizeGuarded` 의 mutation-as-return-channel 패턴, (2)
`ExecutionEngineService` 와 `RetryTurnService` 가 "guarded 종결 + 반환값 소비" 패턴을 서비스 경계를
넘어 독립 재구현하는 중복, (3) 비즈니스 레이어의 넓은 catch 범위 — 은 전부 1라운드에서 이미 식별돼
plan 에 후속으로 추적 중인 기존 기술 부채이며, 이번 diff 는 그 부채를 악화시키지 않았다. 스코프를
좁게 유지한 판단(3경로 통합 헬퍼 승격을 별도 항목으로 분리)은 회귀 위험 관리 관점에서 여전히 타당하다.

## 위험도
LOW
