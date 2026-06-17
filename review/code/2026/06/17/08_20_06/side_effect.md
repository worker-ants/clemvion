# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] ENGINE_DRIVER 토큰이 exports 에 미포함 — 모듈 외부 테스트 재조립 시 수동 제공 필요
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/execution-engine.module.ts` — `exports` 배열
- 상세: `AiTurnOrchestrator` 와 `ENGINE_DRIVER` 바인딩은 `providers` 에만 등록되고 `exports` 에는 포함되지 않았다. 현재 테스트 코드에서는 `Test.createTestingModule` 내부에 직접 재등록하는 방식으로 처리하고 있어 동작에는 문제 없다. 그러나 다른 모듈이 `ExecutionEngineModule` 을 import 하면서 `AiTurnOrchestrator` 를 직접 주입 받으려 할 경우 DI 에러가 발생한다.
- 제안: `AiTurnOrchestrator` 를 외부 소비 대상으로 의도하지 않음을 명시적으로 문서화하거나, 필요 시 exports 에 추가하는 방향을 결정해 두는 것이 좋다.

### [INFO] `waitForAiConversation` 이 `resumeState` 객체를 직접 변경함 (in-place mutation)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` 라인 147-149
- 상세: `resumeState` 는 `context.nodeOutputCache[node.id]._resumeState` 에서 꺼낸 참조다. `resumeState.rawConfig = Object.freeze({...})` 는 nodeOutputCache 안의 원본 객체를 직접 변경한다. 이 mutation 은 이미 추출 전 엔진에도 동일하게 존재하던 패턴(verbatim 이동)이므로 이번 PR 이 새로 도입한 부작용은 아니다. 단, 추출로 인해 해당 side effect 가 별도 클래스로 격리됨으로써 코드를 읽는 입장에서는 이 mutation 의 존재가 더 불투명해질 수 있다.
- 제안: 현 상태(추출 전과 동일 동작)는 허용 가능. 향후 리팩터 단계에서 `rawConfig` seed 를 명시적 파라미터나 불변 방식으로 전환하는 것을 검토할 수 있다.

### [INFO] `forwardRef` 없이 순환 DI — 런타임 의존성 해소 순서 의존
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/execution-engine.module.ts` 라인 82-88
- 상세: `AiTurnOrchestrator` 는 `ENGINE_DRIVER` (=`ExecutionEngineService`)를 주입받고, `ExecutionEngineService` 는 `AiTurnOrchestrator` 를 직접 주입받는다(엔진의 resume registry 위임). 커밋 메시지에 "forwardRef 순환 DI" 라 명시되어 있으나, 실제 모듈 파일에서 `forwardRef` 래핑이 적용됐는지는 엔진 서비스 생성자 측 코드에서 확인이 필요하다. NestJS 에서 순환 DI 를 `forwardRef` 없이 처리하면 `undefined` 주입 버그가 런타임까지 숨겨진다. 현재 e2e 통과가 확인됐으므로 실제 런타임 문제는 없을 가능성이 높지만, `forwardRef` 적용 여부를 코드 레벨에서 명시적으로 보장하는 것이 안전하다.
- 제안: `ExecutionEngineService` 생성자에서 `AiTurnOrchestrator` 주입 시 `@Inject(forwardRef(() => AiTurnOrchestrator))` 가 사용됐는지 확인 및 문서화를 권장한다.

### [INFO] `execution-engine.service.spec.ts` 테스트 내 직접 프로퍼티 대입 패턴 — 복원 누락 위험
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `orchAny.processAiResumeTurn = jest.fn()` / `orchAny.waitForAiConversation = jest.fn()` 구간
- 상세: `jest.spyOn` 대신 직접 프로퍼티 대입(property assignment)으로 모킹하는 구간이 여전히 존재한다. 이 경우 테스트가 예외로 종료되면 `finally` 블록이 없는 한 원본 메서드가 복원되지 않아 후속 테스트에 오염이 생길 수 있다. `waitForAiConversation` 교체/복원 구간은 `try/finally` 로 감싸져 있어 안전하지만, `orchAny.processAiResumeTurn = jest.fn()` 대입 구간은 `finally` 없이 `orig.turn` 복원이 `} finally {` 블록에 있는지 확인이 필요하다(diff 상 복원 코드가 존재하나, `guard` 대기 중 타임아웃 발생 시 복원 보장 여부 불명확).
- 제안: 직접 대입 모킹 전체를 `jest.spyOn` 으로 전환하거나, 복원을 `afterEach` 에 등록하는 패턴을 일관 적용한다.

### [INFO] `AiTurnOrchestrator` 가 `ExecutionEngineService` 에서 export 되는 타입에 의존
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` 라인 40-48
- 상세: `RehydrationError`, `withInteractionMeta`, `withSourceMarker`, `buildConversationConfigFromOutput`, `buildConversationMetaFromResumeState`, `buildAiMessageDebugFromResumeState`, `userMessageSignalApplies`, `WaitingInteractionType` 를 `execution-engine.service` 에서 직접 import 한다. 이는 추출된 오케스트레이터가 god-class 에 여전히 import 결합(coupling)을 유지한다는 의미다. 이 함수들이 향후 별도 파일로 이동될 때 `ai-turn-orchestrator.service.ts` 의 import 경로도 함께 갱신해야 하는 묵시적 의존성이 생긴다. 현재 PR 범위에서는 의도된 strangler-fig 단계이므로 런타임 부작용은 없다.
- 제안: 중장기적으로 공유 변환 헬퍼(`buildConversationConfigFromOutput` 등)를 별도 파일로 분리하고, `execution-engine.service` 는 엔진 핵심 로직만 유지하도록 점진적 이동을 계획하는 것이 좋다.

---

## 요약

이번 변경은 `ExecutionEngineService` 의 AI 멀티턴 생명주기 약 1,250 줄을 `AiTurnOrchestrator` 로 수직 추출하는 strangler-fig 리팩터다. 메서드 본문은 verbatim 이동이고 `this.engine.*` 호출만 `this.driver.*` 로 재배선됐으므로, 새로운 외부 상태 변경·전역 변수 도입·파일시스템 부작용·네트워크 호출 추가는 없다. 공개 API(엔진의 `continueAiConversation`/`endAiConversation`)는 그대로 유지되고, 내부 resume registry 위임 경로만 추가됐다. 주목할 부작용 위험은 세 가지다: (1) NestJS 순환 DI 에서 `forwardRef` 적용 여부 확인 권장, (2) `resumeState` 객체의 in-place mutation 이 verbatim 이동으로 별도 클래스에 은폐됨, (3) 테스트 내 직접 프로퍼티 대입 모킹의 복원 보장. 세 항목 모두 추출 이전에 이미 존재하거나 INFO 수준으로 즉각적 런타임 장애 위험은 낮다.

---

## 위험도

LOW
