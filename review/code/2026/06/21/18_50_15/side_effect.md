# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `classifyToolCalls` 시그니처 변경 — `toolProviders` 인자 추가
  - 위치: `ai-agent.handler.ts` diff +144, `ai-condition-evaluator.ts` L98-102
  - 상세: 기존 핸들러 private 메서드 `classifyToolCalls(toolCalls, conditions)` (2-인자)가 `AiConditionEvaluator.classifyToolCalls(toolCalls, conditions, toolProviders)` (3-인자)로 이동했다. 이 메서드는 `private` 이었으므로 외부 공개 API 에 속하지 않는다. 핸들러 내부의 두 호출 지점 모두 `this.toolProviders` 를 세 번째 인자로 정확히 추가해 동작은 동일하게 보존된다.
  - 제안: 해당 없음 — private to method 이동이고 두 호출 지점 모두 갱신됨.

- **[INFO]** `ConditionDef` / `ConditionClassification` 타입 이동 — 기존 파일-로컬 interface → 신규 파일 exported interface
  - 위치: `ai-agent.handler.ts` diff -80~-98, `ai-condition-evaluator.ts` L12-28
  - 상세: 핸들러 내 file-scoped interface 였으나 `ai-condition-evaluator.ts` 에 `export interface` 로 이동됐다. 핸들러는 `import { type ConditionDef }` 로 재-임포트해 사용한다. `ConditionClassification` 은 핸들러 외부에서 사용되지 않던 타입이라 공개 표면 변경은 없다. `ConditionDef` 도 마찬가지로 핸들러 내부 config 파싱에만 쓰이므로 기존 소비자에 영향 없다.
  - 제안: 해당 없음.

- **[INFO]** `condToolName` / `CONDITION_REASON_MAX_CHARS` 신규 export
  - 위치: `ai-condition-evaluator.ts` L35, L43
  - 상세: 핸들러 내에서 module-private 함수로 존재하던 `condToolName` 이 `export function` 으로 공개됐다. `CONDITION_REASON_MAX_CHARS` 도 새로 export 됐다. 두 식별자 모두 기존엔 외부 노출이 없었으므로 additive 변경이다. 새 export 가 향후 외부 모듈에서 조건 도구명을 직접 조합하는 데 오용될 가능성은 있으나, 현재 시점에는 테스트 파일에서만 임포트하며 실제 부작용은 없다.
  - 제안: 필요시 `@internal` JSDoc 태그를 붙여 외부 소비를 억제하는 것을 고려할 수 있으나 필수 아님.

- **[INFO]** `buildConditionTools` 에 `required: []` 필드 추가
  - 위치: `ai-condition-evaluator.ts` L77, `ai-agent.handler.ts` diff -285~-297 (기존 인라인 블록)
  - 상세: 기존 인라인 블록에는 `required` 필드가 없었고, 신규 구현에는 `required: []` 가 명시된다. JSON Schema 상 `required` 생략과 `required: []` 는 동치이므로 LLM API 동작 변경은 없다. 단, 일부 strict 모드 JSON Schema validator 가 빈 배열의 명시적 presence 를 다르게 처리할 가능성은 이론상 존재한다.
  - 제안: 해당 없음 — spec §5.1 에 명시값으로 정의되어 있으므로 의도된 변경.

## 요약

이 변경은 `AiAgentHandler` 의 private 조건 평가 메서드 4개(+ 2개 helper 함수, 2개 interface)를 `AiConditionEvaluator` 클래스로 추출한 순수 리팩터링이다. 핸들러 자체는 무상태 collaborator 인스턴스(`private readonly conditionEvaluator`)를 생성·소유하며, 두 호출 지점 모두 정확히 갱신됐다. 전역 변수 신규 도입 없음, 파일시스템 부작용 없음, 환경 변수 읽기·쓰기 없음, 네트워크 호출 없음, 이벤트·콜백 변경 없음이다. `classifyToolCalls` 시그니처가 2-인자에서 3-인자로 바뀌었으나 해당 메서드는 private이었으므로 공개 API 영향이 없다. `required: []` 추가는 JSON Schema 동치 변경이다. 전체적으로 의도치 않은 부작용 위험은 없다.

## 위험도

NONE
