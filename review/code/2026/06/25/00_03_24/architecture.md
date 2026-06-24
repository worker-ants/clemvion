# 아키텍처(Architecture) 리뷰 결과

**대상**: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`
**변경 유형**: `executeSingleTurn` god-method setup 단계 — private 메서드 3개로 behavior-preserving 분해

---

## 발견사항

### [INFO] SRP 부분 개선 — executeSingleTurn 내 tool-loop 응집도는 여전히 잔류
- 위치: `executeSingleTurn` 메서드 전체 (diff 이후에도 ~400줄 수준 추정)
- 상세: 이번 PR 은 setup 단계(system prompt 조립·messages 빌드·memory 주입) 3개를 추출해 SRP 를 개선했다. 그러나 tool-loop(분기·provider 실행·condition 처리·turn push)와 출력 조립이 `executeSingleTurn` 에 여전히 혼재한다. 이 PR 의 명시된 범위(1차 슬라이스) 내에서는 적절하며, 2차 PR(`processMultiTurnMessage` 분해)로 연속 개선이 예정되어 있다.
- 제안: 현 PR 범위에서는 조치 불요. 2차 PR 에서 tool-loop 를 별도 private 메서드로 추출해 SRP 완성.

### [INFO] applySingleTurnMemoryInjection 의 파라미터 객체 — 인터페이스 분리 관점
- 위치: `applySingleTurnMemoryInjection(args: { ... })` — 시그니처에 9개 필드 포함
- 상세: args object 가 `context`, `config`, `messages`, `finalSystemPrompt`, `memoryStrategy`, `llmConfig`, `model`, `workspaceId`, `userPrompt` 9개 필드를 묶는다. 이는 메서드가 "memory 주입" 이라는 단일 책임을 갖지만 `memoryManager.injectMemoryContext` 에 전달할 인자를 중계하는 thin adapter 역할이 많아 args 객체가 비대해진 결과다. ISP 관점에서 호출자가 필요하지 않은 필드(예: `workspaceId`, `model`)를 묶음으로 전달하는 구조다.
- 제안: 현 단계에서 실질 문제가 없으므로 즉각 조치 불요. 단 향후 `memoryManager` 인터페이스를 분리할 때 이 인자 묶음을 value object 타입으로 정의해 ISP 를 명시적으로 강제하는 것을 검토.

### [INFO] buildSingleTurnMessages 의 부작용(side effect) — Command-Query 분리 위반 경계
- 위치: `buildSingleTurnMessages` (diff +147~+167 블록)
- 상세: 메서드 이름(`build*`) 이 Query 성격을 암시하지만 내부에서 `this.pushAiThreadTurn(...)` 을 호출해 ConversationThread 에 대한 side effect 를 발생시킨다. 메서드가 값을 반환하면서 동시에 외부 상태(thread)를 변경하므로 Command-Query Separation 원칙의 경계에 있다. 단, JSDoc 에 `ai_user push` 를 명시해 의도가 드러나 있고 spec §2.2 의 단계 1.7 에 정렬된 결정이다.
- 제안: 메서드 이름을 `buildAndRegisterSingleTurnMessages` 로 변경하거나 JSDoc 에 `@sideEffect pushAiThreadTurn` 수준의 명시를 추가해 Query 로 오해하지 않도록 한다. 기능 변경 없이 명명/문서 수준 개선으로 충분.

### [INFO] AiTurnExecutor 클래스 자체의 크기 — 모듈 경계 장기 고려
- 위치: `AiTurnExecutor` 클래스 전체 (추정 2800+ 줄)
- 상세: 이번 리팩토링은 클래스 내 private 메서드 추출 수준이며 클래스 경계를 유지한다. 그러나 `RagAccumulator`, `RagAccumulatorGroup`, `capFormDataBytes`, 상수군(`KB_TOOL_GUIDANCE`, `PRESENTATION_TOOLS_GUIDANCE` 등)이 동일 파일에 혼재한다. 이 파일 자체가 단일 모듈이라기보다 모듈 패키지 수준의 규모다.
- 제안: 이 PR 의 scope 내에서는 조치 불요. 장기적으로 `RagAccumulator` 계열을 별도 모듈로 분리하고, 상수/guidance 문자열을 `prompts.ts` 등 별도 파일로 추출하면 모듈 응집도가 높아진다.

### [INFO] applySingleTurnMemoryInjection 반환값 재할당 패턴 — 가변성 노출
- 위치: `executeSingleTurn` 내 `messages = memInjection.messages` / `finalSystemPrompt = memInjection.finalSystemPrompt` 재할당 (diff +309~+312)
- 상세: `messages` 와 `finalSystemPrompt` 가 `let` 선언 후 여러 메서드 호출을 거치며 재할당된다. 이는 순서 의존성이 있는 파이프라인 패턴을 명시적으로 드러내지 않고 변수 재할당으로 표현하는 구조로, 순서 오류가 컴파일 타임에 탐지되지 않는다.
- 제안: 현재 JSDoc 과 주석으로 ordering 의존성을 설명하고 있어 실용상 충분하다. 향후 pipeline builder 패턴 또는 불변 value object 연결 방식으로 순서를 타입 수준에서 강제할 수 있다. 현 PR 에서는 조치 불요.

---

## 요약

이번 PR 은 `executeSingleTurn` god-method 의 setup 단계를 spec §6.1 단계에 정렬한 private 메서드 3개(`buildSingleTurnSystemPrompt`, `buildSingleTurnMessages`, `applySingleTurnMemoryInjection`)로 추출하는 behavior-preserving 리팩토링이다. 아키텍처 관점에서 SRP 개선, 응집도 향상, spec 추적성 강화라는 긍정적 방향을 취하고 있으며 외부 public interface 불변·순환 의존성 미도입·레이어 책임 미위반의 기본 요건을 모두 충족한다. `buildSingleTurnMessages` 의 side effect 혼재(CQS 경계)와 `applySingleTurnMemoryInjection` 의 비대한 args 객체는 설계상 의식적 결정으로 문서화되어 있어 위험 수준이 낮다. tool-loop 잔류와 클래스 규모 문제는 2차 PR 로 연속 개선 예정임이 명시되어 있어 현 슬라이스 내에서는 수용 가능하다.

---

## 위험도

LOW
