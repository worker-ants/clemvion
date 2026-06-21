# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** `classifyToolCalls` 시그니처에 `toolProviders` 인자 추가
  - 위치: `ai-condition-evaluator.ts:87` / `ai-agent.handler.ts:1530, 2438`
  - 상세: 기존 핸들러의 `private classifyToolCalls(toolCalls, conditions)` 는 `this.toolProviders` 에 암묵적으로 의존했다. 추출된 `AiConditionEvaluator.classifyToolCalls(toolCalls, conditions, toolProviders)` 는 세 번째 인자로 명시적으로 받는다. 이 메서드는 기존에 `private` 이었으므로 핸들러 외부 호출자가 존재하지 않으며, 핸들러 내부의 두 호출 지점 모두 `this.toolProviders` 를 전달하도록 동기화되어 있다. 시그니처 변경이 외부로 누설되지 않는다.
  - 제안: 현 상태 유지. 인터페이스 파급 없음.

- **[INFO]** `ConditionDef` / `ConditionClassification` 타입 이동
  - 위치: `ai-agent.handler.ts` (제거) → `ai-condition-evaluator.ts` (신규 export)
  - 상세: 두 타입 모두 `ai-agent.handler.ts` 의 파일-로컬 `interface` 였다. 이제 `ai-condition-evaluator.ts` 에서 `export interface` 로 공개된다. 그러나 `index.ts` 는 `ai-condition-evaluator` 를 re-export하지 않으므로 모듈 공개 API(barrel) 에는 포함되지 않는다. 외부 소비자가 `./ai-condition-evaluator` 를 직접 import해야 하며, 현재 그런 파일은 없다.
  - 제안: 현 상태 유지. 외부 공개 API 변화 없음.

- **[INFO]** `AiConditionEvaluator` 인스턴스가 `AiAgentHandler` 필드로 생성됨
  - 위치: `ai-agent.handler.ts:516` — `private readonly conditionEvaluator = new AiConditionEvaluator()`
  - 상세: `AiConditionEvaluator` 는 생성자 인자·내부 상태·외부 의존이 전혀 없는 무상태 클래스이다. 필드 초기화 시 side effect 가 없으며, 핸들러 인스턴스 당 한 개 객체만 생성된다. NestJS DI 컨테이너를 거치지 않고 `new` 로 직접 생성하지만, 이 클래스에 DI 주입 필요성이 없으므로 문제 없다.
  - 제안: 현 상태 유지. 향후 DI 필요 시 주입 방식으로 전환 가능하나 현재는 불필요.

## 요약

이번 변경은 `AiAgentHandler` 의 `private` 메서드 5개와 로컬 타입 2개를 무상태 collaborator `AiConditionEvaluator` 로 추출하는 순수 리팩터링이다. 전역 변수 도입·파일시스템 조작·환경 변수 읽기/쓰기·네트워크 호출·이벤트 발생 변경은 전혀 없다. `classifyToolCalls` 의 시그니처 변경은 `private` 경계 내에서만 발생했으며, 두 호출 지점 모두 올바르게 `this.toolProviders` 를 전달하도록 갱신되었다. 공개 API(`index.ts` barrel) 에는 새로운 타입·클래스가 노출되지 않는다. 의도하지 않은 부작용은 식별되지 않았다.

## 위험도

NONE
