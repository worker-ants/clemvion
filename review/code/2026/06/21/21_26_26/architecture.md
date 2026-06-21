# Architecture Review — M-1 2단계: AiMemoryManager 추출

## 발견사항

### **[INFO]** SRP 준수 — 책임 분리 방향 올바름
- 위치: `ai-memory-manager.ts` 전체 / `ai-agent.handler.ts` 생성자 블록
- 상세: `AiAgentHandler` 에서 메모리 전략 해석·주입·enqueue 3개 메서드(-330줄)를 `AiMemoryManager` 무상태 collaborator 로 분리한 방향은 SRP 에 부합한다. 핸들러는 "요청 오케스트레이션" 책임을, 매니저는 "메모리 컨텍스트 조립" 책임을 각각 단일하게 가진다. `AiConditionEvaluator` (#665) 선례와 동형 패턴을 일관되게 적용하여 프로젝트 내 패턴 통일성도 확보됐다.
- 제안: 추가 조치 불필요. 리팩토링 방향이 명확히 옳다.

### **[INFO]** 의존성 역전 — 런타임 import 그래프 회피 (인라인 타입 import 패턴)
- 위치: `ai-memory-manager.ts` 생성자 파라미터 `conversationThreadService?` / `agentMemoryService?` (인라인 `import()` 타입)
- 상세: `nodes/` 레이어가 `modules/execution-engine/` 및 `modules/agent-memory/` 를 런타임 의존으로 가지지 않도록 인라인 `import()` 타입 전용 참조를 사용한 것은 순환 의존 방지 측면에서 올바른 선택이다. 핸들러에서 이미 동일 패턴을 쓰고 있어 일관성 있다.
- 제안: 추가 조치 불필요.

### **[WARNING]** 인터페이스 부재 — 구체 클래스 직접 참조로 DIP 부분 미충족
- 위치: `ai-agent.handler.ts` 라인 139-143 (생성자 내 `new AiMemoryManager(...)`)
- 상세: `AiMemoryManager` 를 `private readonly memoryManager: AiMemoryManager` 로 구체 타입 직접 참조한다. 인터페이스(`IAiMemoryManager` 또는 유사)가 없으므로 테스트 시 mock 교체나 전략 교체(다른 메모리 매니저 구현 도입)가 불가능하다. 동일 문제가 `AiConditionEvaluator` 에도 존재하지만, 두 번의 선례 적용으로 패턴이 굳어지는 중이다. 현재는 `behavior-preserving` refactor 이므로 즉각 차단 수준은 아니나, 향후 테스트 용이성과 확장성을 위해 인터페이스 추출이 필요하다.
- 제안: `IAiMemoryManager` 인터페이스를 추출하고, 핸들러 생성자에서 해당 인터페이스 타입으로 선언. `AiMemoryManager` 는 구현체로. M-1 전체 완료 후 별도 후속 작업(#666 등)으로 분리해도 무방.

### **[WARNING]** 핸들러가 여전히 collaborator 를 직접 생성 — Factory/DI 미적용
- 위치: `ai-agent.handler.ts` 생성자 (라인 138-144): `this.memoryManager = new AiMemoryManager(...)`
- 상세: 핸들러 생성자 안에서 `new AiMemoryManager(...)` 를 직접 호출하여 collaborator 를 생성한다. `AiConditionEvaluator` 도 동일 패턴(`private readonly conditionEvaluator = new AiConditionEvaluator()`). 이 패턴은 OCP/DIP 를 완전히 달성하지 못한다. NestJS DI 컨테이너 외부에서 생성되므로 AoP(인터셉터, 데코레이터) 적용이 불가하고, 테스트에서 collaborator 를 교체하려면 핸들러 생성자 전체를 재구성해야 한다. 단기적으로는 graceful degrade 패턴과 맞물려 문제가 없으나, collaborator 수가 늘어날수록(M-1 3단계 이후) 핸들러 생성자가 collaborator 조립 책임까지 갖게 된다.
- 제안: collaborator 를 NestJS provider 로 등록하거나, 핸들러 생성자 파라미터로 주입받도록 전환. 최소한 선택적 파라미터로라도 외부 주입 경로를 열어두어 테스트 격리를 가능하게 한다.

### **[INFO]** `injectMemoryContext` 인자 객체 — 넓은 파라미터 표면 (Parameter Object 패턴)
- 위치: `ai-memory-manager.ts` `injectMemoryContext` 메서드 (라인 731-777: 11개 필드 args 객체)
- 상세: 11개 필드를 가진 단일 args 객체를 받는 구조는 Parameter Object 패턴으로 올바르게 그룹화돼 있다. 다만 `llmConfig`, `model`, `summaryModelConfigId`, `workspaceId`, `executionId`, `queryText`, `tailMode` 등 필드가 혼재하여 응집도가 낮다. LLM 호출 컨텍스트(`llmConfig`, `model`, `summaryModelConfigId`)와 실행 컨텍스트(`workspaceId`, `executionId`, `queryText`)를 분리한 두 개의 서브 타입으로 구성하면 가독성과 재사용성이 개선된다. 현재는 리팩토링 단계이므로 즉각 차단 사안은 아니다.
- 제안: 후속 리팩토링에서 `LlmCallContext` / `ExecutionContext` 등 서브 타입으로 분리 고려.

### **[INFO]** `injectMemoryContext` 내 `thread` 직접 mutation — 레이어 경계 우려
- 위치: `ai-memory-manager.ts` 라인 872-879 (`mutable.runningSummary = ...` / `mutable.summarizedUpToSeq = ...`)
- 상세: `AiMemoryManager` 가 `conversationThread` 객체를 직접 mutation 하고 있다(`as { runningSummary?: string; ... }` 강제 캐스팅). 이는 데이터 레이어(ConversationThread 엔티티/상태)에 비즈니스 레이어(메모리 매니저)가 직접 쓰기를 수행하는 패턴이다. 핸들러 시절부터 존재하던 패턴을 그대로 이동(behavior-preserving)한 것으로 이해되나, `AiMemoryManager` 분리 기회에 mutation 대신 반환값으로 갱신 지시를 상위에 위임하는 설계로 개선하지 않은 점은 아쉽다. 현재는 비차단이나 향후 multi-turn 상태 관리 복잡도 증가 시 버그 표면이 된다.
- 제안: `injectMemoryContext` 반환값에 `updatedSummaryState?: { runningSummary: string; summarizedUpToSeq: number }` 를 포함시켜, 실제 thread mutation 을 핸들러(혹은 ConversationThreadService)에서 수행하도록 위임 분리. 중장기 개선 항목.

### **[INFO]** `resolveMemoryStrategy` — 모듈 경계 내 위치 적절, 추상화 수준 맞음
- 위치: `ai-memory-manager.ts` 라인 707-713
- 상세: 전략 enum 해석 로직 3줄이 독립 메서드로 분리된 것은 과도한 추상화처럼 보일 수 있으나, 하위호환 기본값(`'manual'`) 보장 로직이 한 곳에 집중되어 있어 적절하다. `config: Record<string, unknown>` 타입은 런타임 안전성을 약화시키지만 핸들러의 기존 패턴을 유지한 것으로 이해된다.
- 제안: 장기적으로 `config` 타입을 Zod 스키마 파싱 결과(`AiAgentNodeConfig`)로 강화 시 `resolveMemoryStrategy` 파라미터도 함께 타입 강화 검토.

### **[INFO]** `scheduleMemoryExtraction` — 위임 래퍼로 존재, 중간 레이어 불필요성 검토 권장
- 위치: `ai-memory-manager.ts` 라인 998-1029
- 상세: `AiMemoryManager.scheduleMemoryExtraction` 는 `sharedScheduleMemoryExtraction` 공유 헬퍼로 단순 위임(pass-through wrapper)한다. 현재는 `selfNodeId` 파라미터를 받아 실제로는 사용하지 않는다(주석에도 명시). 순수 위임 래퍼가 독립 메서드로 존재하는 것은 응집도 측면에서 불필요한 간접화이지만, 핸들러가 `sharedScheduleMemoryExtraction` 에 직접 의존하지 않도록 격리한다는 점에서 모듈 경계상 의미 있다.
- 제안: `selfNodeId` 파라미터 미사용 사실을 deprecation 주석 또는 파라미터 제거로 정리. 중기적으로 `agent-memory-injection.ts` 의 공유 헬퍼를 `AiMemoryManager` 내부로 흡수하여 위임 계층을 제거하는 것도 고려.

---

## 요약

이번 변경은 god-handler `AiAgentHandler` 에서 메모리 컨텍스트 조립 로직 3개 메서드를 무상태 collaborator `AiMemoryManager` 로 추출하는 SRP 지향 리팩토링이다. 방향성은 명확히 올바르고, `AiConditionEvaluator` 선례와 동형 패턴을 적용하여 프로젝트 내 아키텍처 일관성을 유지했다. 주요 레이어 경계(node 레이어 전용 오케스트레이터 vs. `AgentMemoryService` persistent I/O)가 doc-comment 수준에서 명시된 것도 긍정적이다. 그러나 두 가지 구조적 미흡이 남는다. 첫째, `IAiMemoryManager` 인터페이스 부재로 테스트 mock 교체가 불가능하고, 향후 전략 다변화 시 OCP 위반이 된다. 둘째, 핸들러 생성자 안에서 `new AiMemoryManager(...)` 를 직접 생성하여 DI 컨테이너 외부에 놓이므로 AoP 적용 불가 및 테스트 격리 어려움이 있다. 이 두 항목은 `behavior-preserving` 리팩토링의 범위 외 사안이므로 즉각 차단 수준은 아니나, M-1 단계 완료 후 별도 후속 개선 이슈로 등록을 권장한다. `injectMemoryContext` 내 thread 직접 mutation 패턴도 장기 부채로 기록할 가치가 있다.

## 위험도

LOW

---

STATUS: SUCCESS
