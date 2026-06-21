### 발견사항

- **[INFO]** `classifyToolCalls` 시그니처 변경 — 내부 private 에서 public 으로 승격, 3번째 인자 `toolProviders` 추가
  - 위치: `ai-agent.handler.ts` diff +142, +173; `ai-condition-evaluator.ts` L94-98
  - 상세: 기존 `private classifyToolCalls(toolCalls, conditions)` 가 `AiConditionEvaluator.classifyToolCalls(toolCalls, conditions, toolProviders)` 로 교체됐다. 원래 메서드는 `private` 이었으므로 핸들러 외부 호출자는 없다. 핸들러 내 두 호출부(단턴·멀티턴) 모두 `this.toolProviders` 를 명시적으로 전달하도록 동시에 수정됐다. 시그니처 변경의 영향 범위가 이 두 호출부에 완전히 국한되며, 변경 전 `this.toolProviders` 는 클로저로 참조되던 것이 인자로 바뀐 것이므로 의미적으로 동일하다.
  - 제안: 변경 없음. 영향 범위가 닫혀 있고 기존 동작이 보존되었다.

- **[INFO]** `ConditionDef` / `ConditionClassification` 인터페이스 이동 — `ai-agent.handler.ts` 내부 `interface` → `ai-condition-evaluator.ts` `export interface`
  - 위치: `ai-condition-evaluator.ts` L12-28; `ai-agent.handler.ts` diff -79 ~ -97
  - 상세: 두 타입이 파일 내부에서 외부로 이동하면서 `export` 가 추가됐다. `ai-agent.handler.ts` 는 `import { type ConditionDef }` 로 재참조하며, `RawAiAgentMultiTurnConfig.conditions?: ConditionDef[]` 는 변경 없이 유지된다. 이 타입을 직접 `import` 하던 외부 모듈이 있다면 기존에는 `ai-agent.handler` 를 참조할 수 없었을 것(내부 선언)이므로 외부 의존 호환 파괴 없음. 단, 향후 외부 소비자가 두 경로(`ai-agent.handler` 경유 vs `ai-condition-evaluator` 직접) 중 혼용할 경우 타입 동일성 문제가 없음을 확인했다 — handler 가 re-export 없이 `import type` 만 하므로 외부에서 handler 경유 타입 접근은 여전히 불가능하다.
  - 제안: 변경 없음. 내부 private 타입에서 named export 로의 승격이며 깨진 호출자가 없다.

- **[INFO]** `condToolName` 함수 가시성 변경 — module-private `function` → `export function`
  - 위치: `ai-condition-evaluator.ts` L43; 테스트 파일에서 `import { condToolName }` 로 직접 소비
  - 상세: 테스트가 `condToolName` 을 직접 호출하기 위해 export 됐다. 핸들러는 이 함수를 직접 호출하지 않으며, `AiConditionEvaluator` 의 내부 구현이 이를 사용한다. 테스트 목적 외에 새로운 공개 계약이 하나 생기지만 이 함수는 순수 결정론적 변환이라 부작용 없음.
  - 제안: 변경 없음.

- **[INFO]** `AiAgentHandler` 의 인스턴스 필드 `conditionEvaluator` 추가
  - 위치: `ai-agent.handler.ts` diff +119, `private readonly conditionEvaluator = new AiConditionEvaluator()`
  - 상세: `AiConditionEvaluator` 는 생성자 인자 없이 무상태로 초기화된다. `AiAgentHandler` 인스턴스 당 하나의 `AiConditionEvaluator` 가 생성된다. `AiConditionEvaluator` 는 내부 필드가 전혀 없으므로 힙 증가는 무시할 수 있는 수준(빈 객체 하나)이다. NestJS DI 컨텍스트에서 `AiAgentHandler` 가 singleton/transient 중 어느 쪽이든 `conditionEvaluator` 도 같은 생명주기를 따르므로 상태 누출 경로 없음.
  - 제안: 변경 없음. 의도된 collaborator 패턴이며 부작용 없음.

### 요약

이번 변경은 `AiAgentHandler` 내부 private 메서드 4개(`classifyToolCalls`, `extractConditionReason`, `buildConditionSystemPromptSuffix`)와 인라인 블록(`buildConditionTools`)을 새 파일 `ai-condition-evaluator.ts` 의 `AiConditionEvaluator` 클래스로 추출한 순수 리팩터링이다. 모든 로직이 매 호출 시 새 지역 변수만 생성하는 순수 함수 형태이며, 클래스 자체에 변경 가능한 인스턴스 상태가 없다. 유일한 시그니처 변화(`classifyToolCalls` 에 `toolProviders` 인자 추가)는 기존에 closure 로 참조하던 `this.toolProviders` 를 명시적 인자로 바꾼 것이며 두 호출부가 동시에 수정됐다. 외부 공개 API(`AiAgentHandler` 의 `validate` / `execute`)는 시그니처 변경 없음. 환경 변수·네트워크 호출·파일시스템 접근·이벤트 발생 경로가 이번 변경으로 새로 추가되거나 변경된 것은 없다.

### 위험도

NONE
