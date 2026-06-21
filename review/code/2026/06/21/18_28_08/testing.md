# Testing Review — AiConditionEvaluator 추출 (M-1 1단계)

## 발견사항

### **[INFO]** 테스트 파일 신설 — 커버리지 확보 양호
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.spec.ts`
- 상세: 기존에 `ai-agent.handler` private 메서드로 간접 커버되던 5개 함수(condToolName, buildConditionTools, buildConditionSystemPromptSuffix, classifyToolCalls, extractConditionReason)가 신설 spec 파일에서 17개 케이스로 직접 단위 테스트됨. 추출 리팩터링의 회귀 격리 목적에 부합한다.

### **[INFO]** buildConditionSystemPromptSuffix — 빈 conditions 엣지 케이스 미테스트
- 위치: `ai-condition-evaluator.spec.ts` describe('buildConditionSystemPromptSuffix')
- 상세: 2개 조건이 있는 정상 케이스만 있음. 빈 배열(`[]`)을 넘겼을 때의 출력 형태(접미사가 불필요하게 붙는지, `[조건 안내]` 라인만 남는지)를 검증하는 케이스가 없다. 실제 호출부(`ai-agent.handler.ts`)는 `conditions.length > 0` 가드로 빈 배열 경우 호출 자체를 막고 있으므로 프로덕션 버그 위험은 낮지만, 모듈 계약 명세 관점에서 단독 테스트가 없으면 향후 호출부 가드가 제거될 때 silent regression이 될 수 있다.
- 제안: `expect(evaluator.buildConditionSystemPromptSuffix([])).toBe(...)` 케이스 1개 추가로 계약 고정.

### **[INFO]** condToolName — 단일 케이스에서 2가지 동작을 한꺼번에 검증
- 위치: `ai-condition-evaluator.spec.ts` 39–44줄
- 상세: `it(...)` 하나에서 정상 입력(`refund`)과 특수문자 치환 입력(`user-wants.refund 99`) 두 가지를 동시에 assert. 테스트 이름이 두 동작을 모두 설명하고 있어 가독성은 나쁘지 않으나, 두 번째 assert만 실패할 경우 실패 이름만으로는 어느 케이스가 문제인지 특정하기 어렵다. 추가 엣지로 빈 문자열(`''`) 입력 시 `cond_`만 반환되는지도 미테스트.
- 제안: 케이스 분리 또는 `''` 입력 케이스 추가(선택적).

### **[INFO]** extractConditionReason — 500자 절단 테스트가 char 단위 고정
- 위치: `ai-condition-evaluator.spec.ts` 160–166줄
- 상세: 구현체는 `reason.slice(0, 500)` (JavaScript 문자 단위)을 사용하고, 테스트는 `'x'.repeat(600)` ASCII 문자열로 500자를 검증한다. 멀티바이트 문자(예: 한글 500자 초과) 시 behavior를 명시한 테스트가 없다. 현재 구현이 byte 단위가 아닌 char 단위 슬라이싱임을 감안하면 한글 600자 입력 시 500글자로 잘리는지 확인할 케이스가 보완 포인트.
- 제안: `'한'.repeat(600)` 케이스 추가로 멀티바이트 동작 명시(선택적).

### **[INFO]** classifyToolCalls — 빈 toolCalls 배열 케이스 미테스트
- 위치: `ai-condition-evaluator.spec.ts` describe('classifyToolCalls')
- 상세: 정상 분류, 다중 condition winner, 우선순위 충돌, condition 없음(normalOnly)은 테스트하나 `toolCalls = []` (빈 입력) 케이스가 없다. 구현상 문제는 없지만 인터페이스 계약 문서화 측면에서 미흡.
- 제안: 빈 toolCalls 시 3개 배열 모두 빈 배열 + matchedCondition null을 검증하는 케이스 1개 추가(선택적).

### **[INFO]** 테스트 격리 — describe 수준 공유 evaluator 인스턴스
- 위치: `ai-condition-evaluator.spec.ts` 15줄 `const evaluator = new AiConditionEvaluator()`
- 상세: `AiConditionEvaluator`가 진정한 무상태 클래스(내부 필드 없음)이므로 인스턴스 공유는 현재 테스트 간 오염 위험 없음. 향후 evaluator에 내부 캐시나 상태가 추가되면 격리 이슈가 될 수 있으나 현재 코드 상태에서는 문제 없다.

### **[INFO]** Mock 적절성 — AgentToolProvider 가짜 객체
- 위치: `ai-condition-evaluator.spec.ts` 29–36줄 `providerMatching`
- 상세: `matches` 함수는 실제 구현(startsWith prefix)을 직접 인라인하고, `buildTools`/`execute`는 `jest.fn()`으로 비어있다. classifyToolCalls 테스트에서는 `matches`만 사용되므로 mock 범위가 적절하다. provider가 `matches` 외 메서드를 classifyToolCalls 내에서 호출하지 않으므로 과도한 mock 없이 최소 stub으로 처리한 것이 좋다.

### **[INFO]** 핸들러 변경에 대한 테스트 — 기존 회귀 커버
- 위치: `ai-agent.handler.ts` 변경 부분
- 상세: 핸들러에서 제거된 private 메서드들(classifyToolCalls, extractConditionReason, buildConditionSystemPromptSuffix, buildConditionTools)은 모두 conditionEvaluator 인스턴스로 위임됐다. 신설 spec에서 이 위임된 로직이 직접 단위 테스트되므로 핸들러 레벨 회귀 위험은 낮다. 커밋 메시지에서 "ai-agent 435 포함 unit 7207 PASS"가 언급되어 기존 핸들러 integration 테스트도 통과한 것으로 확인된다.

## 요약

`AiConditionEvaluator` 추출에 맞춰 신설된 `ai-condition-evaluator.spec.ts`는 5개 공개 API를 17개 케이스로 직접 검증하며, 핵심 동작(분류 우선순위, winner 선택 로직, JSON 파싱 방어, reason 절단)을 잘 커버한다. 테스트 격리·Mock 적절성·가독성 모두 양호하다. 미흡한 부분은 `buildConditionSystemPromptSuffix` 빈 배열 케이스, `classifyToolCalls` 빈 입력 케이스, `condToolName` 빈 문자열 케이스로, 이 중 현재 호출부 가드로 보호되지 않는 경로는 없어 프로덕션 위험으로 연결되지는 않는다. 멀티바이트 절단 동작은 현재 char 단위로 구현되어 있으나 테스트에서 이를 명시하지 않아 향후 byte 단위 변경 시 미탐지될 수 있다.

## 위험도

LOW
