# 변경 범위(Scope) 리뷰 결과

## 발견사항

### 파일 1: engine-driver.interface.ts

- **[INFO]** `EngineDriver` 인터페이스에 5개 멤버 추가 (`rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `findActivatedBackEdge`, `clearLlmDefaultConfigCache`)
  - 위치: 라인 82–124 (diff 기준)
  - 상세: `RetryTurnService` 가 엔진 잔류 메서드를 driver 경유로 호출하기 위한 최소 표면 확장이다. 커밋 메시지에 명시된 의도("EngineDriver +5멤버")와 정확히 일치하며, 범위 이탈 없음.
  - 제안: 없음.

- **[INFO]** `import type { GraphEdge }` 및 `ExecutionGraphState`, `NodeDispatchLoopParams` 임포트 추가
  - 위치: 라인 61–65 (diff 기준)
  - 상세: 위 5개 신규 멤버의 파라미터·반환 타입 참조에 필수적인 임포트다. 불필요한 추가 없음.
  - 제안: 없음.

### 파일 2: execution-engine.module.ts

- **[INFO]** `RetryTurnService` 임포트 추가 + `providers` 배열에 등록 + ENGINE_DRIVER 주석 1줄 갱신
  - 위치: 라인 322 (import), 라인 331–332 (providers)
  - 상세: 신규 서비스의 NestJS 모듈 등록에 필요한 최소한의 변경이다. ENGINE_DRIVER 주석 갱신("orchestrator + interaction 서비스" → "orchestrator + interaction + retry 서비스")은 현실을 정확히 반영한 서술 보완으로, 실질적 기능 변경 없이 범위 내 문서화 갱신에 해당한다.
  - 제안: 없음.

### 파일 3: execution-engine.service.spec.ts

- **[INFO]** `RetryTurnService` 임포트 추가 + `describe` 블록 3곳의 TestingModule `providers` 배열에 등록
  - 위치: 라인 551 (import), 라인 561, 765, 784 (providers)
  - 상세: `ExecutionEngineService` 생성자가 `forwardRef(() => RetryTurnService)` 의존성을 갖게 됐으므로, 기존 TestingModule 에 `RetryTurnService` 를 추가하지 않으면 DI 오류가 발생한다. 필수적인 하니스 수정이다.
  - 제안: 없음.

- **[INFO]** `retryLastTurn` 8개 테스트 케이스 삭제 (라인 569–754 제거)
  - 위치: `describe('retryLastTurn (_retryState consume + spawn)')` 블록 전체
  - 상세: 해당 테스트는 동일한 assertion 그대로 `retry-turn.service.spec.ts` 로 이관됐다. 엔진 spec 에서 삭제 후 신규 spec 에서 재검증되므로 테스트 커버리지 손실 없다. 범위 의도("retryLastTurn 8건 verbatim 이전 + 엔진 spec 제거")와 정확히 일치한다.
  - 제안: 없음.

### 파일 4: execution-engine.service.ts

- **[INFO]** `RetryLastTurnError` 임포트 제거 + `ExecutionCancelledError` 임포트 추가 (workflow-errors.ts leaf 이동 반영)
  - 위치: 라인 833–837 (diff 기준)
  - 상세: `ExecutionCancelledError` 가 god-class inline 정의에서 `workflow-errors.ts` leaf 로 이동됐으므로 임포트 경로 갱신은 필수다. `RetryLastTurnError` 는 이제 `RetryTurnService` 가 사용하므로 엔진 임포트에서 제거된다. 범위 의도와 일치.
  - 제안: 없음.

- **[INFO]** `class ExecutionCancelledError` 인라인 정의 삭제 (라인 856–862)
  - 위치: `execution-engine.service.ts` 중간부
  - 상세: `ExecutionCancelledError` 를 leaf `workflow-errors.ts` 로 이동해 engine↔retry 간 value cross-import 순환을 방지하는 PR2 `RehydrationError` 교훈의 적용이다. 범위 내 필수 조치.
  - 제안: 없음.

- **[INFO]** `interface ExecutionGraphState` / `interface NodeDispatchLoopParams` `export` 추가
  - 위치: 라인 870–873, 881–882 (diff 기준)
  - 상세: `RetryTurnService` 가 `EngineDriver` 인터페이스 경유로 이 타입들을 참조하므로 export 필수다. 기능 변경 없는 가시성(visibility) 확장이며 범위 내 조치다.
  - 제안: 없음.

- **[INFO]** `rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `findActivatedBackEdge`, `clearLlmDefaultConfigCache` 의 `private` → `public` 승격
  - 위치: 라인 901–903, 1236–1238, 1312–1314, 1473–1474, 1483–1484 (diff 기준)
  - 상세: `EngineDriver` 인터페이스 구현체로서의 공개 표면이 되어야 하므로 `public` 승격은 필수다. 5개 모두 커밋 메시지에 명시된 "+5멤버" 범위와 정확히 일치한다.
  - 제안: 없음.

- **[INFO]** `retryLastTurn` 본문 → thin delegator (`return this.retryTurnService.retryLastTurn(...)`) 교체
  - 위치: 라인 3968–4060 (diff 기준), 실제 본문 약 100줄 → 1줄로 축소
  - 상세: PR3의 `continueButtonClick` delegator 패턴과 동일하다. 외부 표면(WS gateway 호출 진입점)을 보존하면서 실제 로직을 추출 서비스로 위임한다. 범위 일치.
  - 제안: 없음.

- **[INFO]** `applyRetryLastTurn` 본문 → thin delegator 교체
  - 위치: 라인 4068–4186 (diff 기준)
  - 상세: `retryLastTurn` 과 동일한 delegator 패턴. `continuation-execution.processor` 호출 표면 보존. 범위 일치.
  - 제안: 없음.

- **[INFO]** `completeRetryExecution`, `resumeGraphAfterRetry`, `failRetryExecution` private 메서드 삭제 (각각 약 20, 120, 25줄)
  - 위치: 라인 4226–1463 (diff 기준, 대량 삭제)
  - 상세: 해당 메서드들은 `RetryTurnService` 로 verbatim 이관됐으므로 엔진에서 삭제가 정확히 맞다. 범위 일치.
  - 제안: 없음.

- **[INFO]** `RetryTurnService` 생성자 주입 추가 (`@Inject(forwardRef(() => RetryTurnService)) private readonly retryTurnService`)
  - 위치: 라인 892–893 (diff 기준)
  - 상세: thin delegator 가 `RetryTurnService` 를 호출하기 위한 필수 의존성 주입. 범위 일치.
  - 제안: 없음.

### 파일 5: retry-turn.service.spec.ts (신규)

- **[INFO]** 신규 spec 파일 — `retryLastTurn` 8개 단위 테스트 이관 + 최소 mock 하니스
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts`
  - 상세: 엔진 spec 에서 삭제된 `retryLastTurn` 테스트 블록이 assertion 변경 없이 그대로 이관됐다. 하니스만 `TestingModule` → `new RetryTurnService(...)` 직접 생성으로 변경됐고, 불필요한 의존성 없이 `nodeExecutionRepository` + per-test `dataSource` mock 만으로 충분하다. `applyRetryLastTurn` / `resumeGraphAfterRetry` 통합 테스트는 엔진 spec 에 잔류한다는 커밋 메시지 설명과 파일 내 주석이 일치한다.
  - 제안: 없음.

### 파일 6: retry-turn.service.ts (신규)

- **[INFO]** 신규 서비스 파일 — 5개 메서드(`retryLastTurn`, `applyRetryLastTurn`, `completeRetryExecution`, `resumeGraphAfterRetry`, `failRetryExecution`) verbatim 이관
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
  - 상세: 메서드 본문은 추출 전과 동일하게 보존됐으며, `this.<engine>` 호출만 `this.driver.<…>` 로 재배선됐다. 커밋 메시지의 "verbatim + this.driver.X 재배선" 선언과 일치한다. 불필요한 기능 추가, 리팩토링, 새 추상화 없음.
  - 제안: 없음.

## 요약

이번 변경은 `execution-engine.service.ts`(god-class)에서 `retry_last_turn` 생명주기 전체를 `RetryTurnService` 로 strangler-fig 방식으로 추출하는 C-1 step4이다. 수정된 모든 파일(엔진 인터페이스, 모듈 등록, 엔진 본체, 엔진 spec) 및 신규 파일(서비스, spec) 이 해당 추출 작업에 직접 필요한 최소 변경만을 포함한다. 범위를 벗어난 불필요한 리팩토링, 기능 확장, 포맷팅 변경, 무관한 파일 수정은 발견되지 않았다. `ExecutionCancelledError` 를 leaf로 이동하고 `ExecutionGraphState` / `NodeDispatchLoopParams` 를 export 한 것은 순환 import 방지와 타입 공개에 필요한 최소한의 수반 조치로서 범위 내에 해당한다.

## 위험도

NONE
