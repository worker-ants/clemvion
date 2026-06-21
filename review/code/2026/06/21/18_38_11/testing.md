# Testing Review — AiConditionEvaluator 추출 (M-1 1단계)

## 발견사항

### [INFO] 테스트 존재 여부 — 신규 단위 테스트 신설, 충분한 커버리지
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-condition-evaluator/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.spec.ts`
- 상세: 16개 테스트 케이스로 `AiConditionEvaluator` 의 전체 public 인터페이스(`condToolName`, `buildConditionTools`, `buildConditionSystemPromptSuffix`, `classifyToolCalls`, `extractConditionReason`)를 직접 커버한다. 기존엔 `ai-agent.handler.spec.ts` 의 통합 경로에서만 간접 검증됐던 로직을 독립 단위로 고정함으로써 regression 격리가 크게 개선됐다.
- 제안: 현황 유지.

### [INFO] 테스트 격리 — `evaluator` 인스턴스를 describe 최상위에서 공유
- 위치: `ai-condition-evaluator.spec.ts` 라인 15 (`const evaluator = new AiConditionEvaluator();`)
- 상세: `AiConditionEvaluator` 가 무상태 클래스이므로 테스트 간 인스턴스 공유는 현재는 안전하다. 그러나 향후 상태가 추가될 경우 격리 실패로 이어질 수 있다. `beforeEach` 로 인스턴스를 재생성하는 것이 방어적으로 더 낫다.
- 제안: `beforeEach(() => { evaluator = new AiConditionEvaluator(); })` 패턴으로 전환 권고(낮은 우선순위 — 현재 무상태이므로 기능 결함은 아님).

### [INFO] 커버리지 갭 — `extractConditionReason([], conditionId)` 케이스 미포함
- 위치: `ai-condition-evaluator.spec.ts` `extractConditionReason` describe 블록
- 상세: `toolCalls` 배열이 완전히 비어있는 경우(`[]`)에 대한 명시적 테스트가 없다. `toolCall('cond_other')` 케이스(라인 190)로 간접 커버는 되나, "toolCalls 자체가 빈 배열"은 `classifyToolCalls` 에는 있는 반면 `extractConditionReason` 에는 없어 대칭성이 어긋난다.
- 제안: `expect(evaluator.extractConditionReason([], 'refund')).toBe('');` 케이스 추가.

### [INFO] 커버리지 갭 — `condToolName('')` (빈 문자열 id) 엣지 케이스 미포함
- 위치: `ai-condition-evaluator.spec.ts` `condToolName` describe 블록 (라인 38–45)
- 상세: `condToolName('')` 은 `'cond_'` 를 반환한다. 실제 `conditions` 배열에서 빈 id 가 올 수 없다는 validation 가드가 핸들러 레이어에 있으나, `AiConditionEvaluator` 자체는 방어 로직이 없다. 추출된 순수 함수에 대한 계약 문서 차원에서 경계값 테스트가 있으면 좋다.
- 제안: `expect(condToolName('')).toBe('cond_');` 케이스 추가(낮은 우선순위).

### [INFO] 테스트 가독성 — 500자 cap 하드코딩, 상수 미참조
- 위치: `ai-condition-evaluator.spec.ts` 라인 178, 186
- 상세: `CONDITION_REASON_MAX_CHARS` 상수가 `ai-condition-evaluator.ts` 에서 `const` (non-export)로 선언되어 테스트에서 참조할 수 없어 테스트 내에 숫자 `500` 이 하드코딩됐다. 상수가 변경되면 테스트가 자동으로 깨지지 않는다.
- 제안: `CONDITION_REASON_MAX_CHARS` 를 `export const` 로 변경해 테스트에서 임포트 후 참조(`toHaveLength(CONDITION_REASON_MAX_CHARS)`)하도록 변경 권고. 매직넘버 제거 취지와 일관성 확보.

### [INFO] Mock 적절성 — `AgentToolProvider` 구조체 mock 적절
- 위치: `ai-condition-evaluator.spec.ts` 라인 32–37 (`providerMatching` 헬퍼)
- 상세: `as unknown as AgentToolProvider` 캐스팅으로 최소 인터페이스만 구현한 partial mock. `classifyToolCalls` 가 실제 사용하는 메서드는 `matches(name)` 뿐이므로 mock 범위가 정확하다. `buildTools`, `execute` 는 `jest.fn()` 으로 채워져 타입 에러 없이 컴파일된다.
- 제안: 현황 유지.

### [INFO] 회귀 테스트 — 핸들러 간접 테스트와 신규 단위 테스트의 이중 커버
- 위치: `ai-agent.handler.spec.ts` `conditions - single_turn` / `conditions - multi_turn` describe 블록
- 상세: 기존 핸들러 spec(라인 2637–2866)은 `conditionEvaluator` 를 직접 참조하지 않고 `handler.execute()` 경로를 통해 종단간 검증한다. 리팩터링 후 동일 테스트들이 여전히 통과함으로써 behavior-preserving 추출임을 실증한다. 신규 단위 테스트와 기존 통합 경로가 상호 보완적으로 구성된 구조는 양호하다.
- 제안: 현황 유지.

### [INFO] 테스트 용이성 — `conditionEvaluator` 가 `private readonly` 필드로 하드와이어됨
- 위치: `ai-agent.handler.ts` 라인 516 (`private readonly conditionEvaluator = new AiConditionEvaluator();`)
- 상세: `AiConditionEvaluator` 가 무상태이고 의존성이 없어 현재는 교체 필요성이 없다. 그러나 향후 `AiConditionEvaluator` 에 의존성(예: 설정, 서비스)이 추가될 경우 생성자 주입 불가로 테스트 난이도가 올라간다. 현 단계에서는 DI 구조가 과도할 수 있으므로 고려사항으로만 기록.
- 제안: 현재 설계는 적절. 향후 `AiConditionEvaluator` 에 외부 의존성이 생기면 생성자 파라미터로 주입 가능하도록 설계 변경 검토.

## 요약

`AiConditionEvaluator` 추출 리팩터링은 테스트 측면에서 명확한 개선이다. 이전까지 핸들러 private 메서드로 간접 검증에만 의존하던 조건 평가 로직이 독립 단위 테스트(16케이스)로 직접 고정되었으며, 빈 배열·빈 toolCalls·멀티바이트 절단 등 핵심 엣지 케이스가 포함됐다. 기존 핸들러 스펙(conditions - single_turn/multi_turn)도 통과를 유지해 behavior-preserving 추출임을 검증한다. 소수의 갭(빈 toolCalls에 대한 `extractConditionReason` 케이스 누락, `CONDITION_REASON_MAX_CHARS` 상수 비참조, `condToolName('')` 경계값 미포함)이 있으나 모두 현재 동작을 위협하는 수준이 아닌 계약 문서 및 리팩터링 안전성 차원의 사항이다.

## 위험도

LOW
