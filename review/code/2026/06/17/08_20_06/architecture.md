# 아키텍처(Architecture) 리뷰

## 발견사항

### **[WARNING]** 순환 의존성: Engine ↔ Orchestrator 쌍방 import (ES module 레벨)

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L130, `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` L48
- 상세: `execution-engine.service.ts` 가 `AiTurnOrchestrator`를 `import`하고(`L130`), `ai-turn-orchestrator.service.ts` 가 `execution-engine.service`에서 `RehydrationError`, `buildConversationConfigFromOutput` 등 다수 helper를 `import`한다(`L48`). 결과적으로 두 파일 사이에 **ES module 레벨 순환 참조**가 존재한다. NestJS DI 레벨에서는 `forwardRef(() => AiTurnOrchestrator)` 로 해소되지만(`engine.service.ts L902`), ES module circular import는 런타임에서 undefined evaluation window를 열어 두며, 현재는 helper 함수(값/타입)만 cross-import하므로 실제 위험은 낮다. 그러나 추출 중간 단계인 현재 구조가 고착화될 경우 유지보수 비용이 증가한다.
- 제안: 두 서비스가 공유하는 helper(`buildConversationConfigFromOutput`, `buildConversationMetaFromResumeState`, `buildAiMessageDebugFromResumeState`, `withInteractionMeta`, `withSourceMarker`, `RehydrationError`, `WaitingInteractionType`, `userMessageSignalApplies`)를 별도 파일(예: `ai-conversation-helpers.ts` 또는 `conversation-emit.utils.ts`)로 분리하면 순환 import를 제거하고 두 서비스 모두 단방향으로 그 파일을 참조할 수 있다. 이는 C-1 step3 이후 단계에서 자연스럽게 실시 가능하다.

---

### **[WARNING]** EngineDriver 인터페이스에 Orchestrator가 실제 사용하지 않는 메서드 포함 (ISP 위반 경계)

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/engine-driver.interface.ts` L86-92
- 상세: `EngineDriver` 인터페이스의 `resolveHasDefaultLlmConfigCached` 와 `clearLlmDefaultConfigCache` 두 메서드가 `AiTurnOrchestrator` 내부 어디서도 호출되지 않는다(코드 전수 검색 결과 0건). 인터페이스 문서에도 "(orchestrator 에서 직접 쓰지 않더라도 …)"라고 명시되어 있다. 이는 SOLID의 인터페이스 분리 원칙(ISP)에 반한다: orchestrator가 불필요한 능력을 주입받고 구현체는 해당 메서드를 반드시 구현해야 하므로, 미래에 대체 EngineDriver 구현체를 만들 경우 의미 없는 메서드 구현 부담이 발생한다.
- 제안: 이 두 캐시 메서드는 엔진 내부 LLM 캐시 관리 계약이므로 `EngineDriver`에서 분리해 엔진이 내부적으로 관리하거나, 필요 시 별도 인터페이스(`LlmCacheDriver`)로 분리하는 것이 낫다. 단, 현재 구현체가 하나뿐이어서 실질적 위험은 낮으므로 중간 단계 리팩터링에서 허용 가능하다.

---

### **[WARNING]** ExecutionEngineService 8,411줄 — god-class 여전히 비대

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- 상세: ~1,250줄을 `AiTurnOrchestrator`로 추출했음에도 엔진은 여전히 **8,411줄**이다. 단일 클래스가 `WorkflowExecutor`, `EngineDriver`, `OnModuleInit`, `OnApplicationBootstrap`을 동시에 `implements`하며, 그래프 순회, 노드 dispatch loop, retry, 체크포인트, LLM 캐시, segmentStartMs active-time 추적 등을 모두 담당한다. 이번 PR은 SRP 위반을 줄이는 방향으로 올바르게 진행 중이나 한 클래스에 책임이 여전히 과다하다.
- 제안: 이번 PR이 "strangler-fig C-1 A방식 step2"임을 고려하면 단계적 추출이 의도된 것이다. 향후 step에서 `GraphTraversal`, `RetryReentry`, `NodeDispatch` 등을 추가 추출해 단일 책임 방향으로 지속 진행하는 것이 권장된다. 현재 단계에서의 위험도는 회귀(기능 이동)가 검증됐으므로 MEDIUM으로 평가한다.

---

### **[INFO]** EngineDriver `applyPortSelection`의 추상화 레벨 부정합

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/engine-driver.interface.ts` L78
- 상세: `applyPortSelection(output: unknown): unknown` 는 "legacy `{port, data}` envelope → `_selectedPort` 라우팅 flat shape 으로 변환"이라는 엔진 내부 구현 세부사항이다. 이 변환이 `EngineDriver`(엔진 캐퍼빌리티 계약)에 노출되는 것은 orchestrator가 엔진 내부 라우팅 convention을 알아야 하는 추상화 누출이다. 다만 현재 orchestrator가 `handleAiMessageTurn` 내에서 직접 호출하고 있으므로 실용적 이유가 있다.
- 제안: 장기적으로 이 변환은 `adaptHandlerReturn` → `toEngineFlatShape` 파이프라인처럼 별도 어댑터로 격리하고, orchestrator는 "flat shape"을 직접 받도록 리팩터링하는 것이 이상적이다. 현재 단계에서는 INFO로 기록한다.

---

### **[INFO]** `WaitingInteractionType` 미이동 — 경계 불명확

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L173, `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` L47
- 상세: `WaitingInteractionType`은 AI 멀티턴 생명주기의 도메인 타입이나 `execution-engine.service.ts`에 잔류하고 orchestrator가 `type` import로 참조한다. 커밋 메시지에서 "WaitingInteractionType 미이동(§1.1)"이라고 명시했으므로 의도된 결정이나, orchestrator가 엔진 서비스 파일을 타입 import 목적으로도 의존해야 하는 구조는 경계를 흐린다.
- 제안: 위의 helper 분리 작업(순환 import 해소)과 함께 `WaitingInteractionType`도 이동하면 의존 방향이 명확해진다.

---

### **[INFO]** 테스트 파일의 private 메서드 접근 패턴 반복

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts` — `as unknown as ReparkSubject`, `as unknown as ExtractFn` 다수
- 상세: `reparkAiResumeTurn`(private), `extractAiTurnErrorPayload`(private static)를 `as unknown as` 캐스팅으로 직접 테스트한다. 이는 구현 세부사항에 결합되어 리팩터링 시 테스트 수정 부담을 높인다.
- 제안: private 메서드 테스트는 public 메서드를 통한 행위 검증(블랙박스)으로 대체하거나, 해당 로직을 별도 순수 함수 모듈로 추출해 직접 import 테스트하는 것이 바람직하다. 다만 `extractAiTurnErrorPayload`는 이미 외부 영향이 없는 순수 static 함수이므로 별도 유틸 파일로 추출하면 `as unknown as` 없이 테스트 가능하다.

---

### **[INFO]** `handleAiMessageTurn`의 contextKey 파라미터 설계 — 일부 컨텍스트 직접 접근 혼재

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` L513, L771-774
- 상세: `handleAiMessageTurn`은 `ExecutionContext` 객체 대신 `contextKey`(string)를 받지만, 내부에서 `this.contextService.getContext(contextKey)` 로 context를 다시 조회한다(L774). 이는 파라미터 설계와 실제 사용이 일치하지 않는 추상화 불일치다. `processAiResumeTurn`은 `context` 객체를 직접 받는 반면 `handleAiMessageTurn`은 key만 받는다.
- 제안: `handleAiMessageTurn`도 `ExecutionContext`를 직접 받도록 통일하거나, 현재 설계 이유("handleAiMessageTurn 가 context 객체를 받지 않으므로 호출자가 contextKeyOf(context) 를 전달" 주석 참조)를 인터페이스 수준 주석으로 명확히 문서화한다.

---

## 요약

이번 변경은 ~9,657줄 god-class `ExecutionEngineService`에서 AI 멀티턴 생명주기 책임을 `AiTurnOrchestrator`로 추출하는 strangler-fig 패턴의 step2다. `EngineDriver` 인터페이스 + DI 토큰(`ENGINE_DRIVER`, `useExisting` 바인딩)을 통해 엔진↔orchestrator 결합을 DI 경계로 한정한 설계는 의존성 역전 원칙을 올바르게 적용한 것이며, `WORKFLOW_EXECUTOR` 선례와 일관성이 있다. 핵심 아키텍처 우려는 두 서비스 파일 사이의 ES module 레벨 순환 import(helper 함수 공유로 인한)와 `EngineDriver` 인터페이스에 orchestrator가 실제 사용하지 않는 메서드가 포함된 ISP 경미 위반이다. 두 이슈 모두 중간 단계 리팩터링에서 허용 가능한 기술 부채로 보이나, 다음 step에서 공유 helper를 별도 파일로 분리하면 순환 참조와 경계 불명확 문제를 동시에 해소할 수 있다. 엔진 자체는 여전히 8,411줄로 비대하지만 이번 PR이 지속적 추출의 한 단계임을 감안하면 현 방향은 올바르다.

## 위험도

MEDIUM
