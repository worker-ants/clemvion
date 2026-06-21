# Testing Review — AiConditionEvaluator 추출 (M-1 1단계)

## 발견사항

### [INFO] condToolName 단위 테스트 케이스 미비 — 빈 문자열 입력
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-condition-evaluator/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.spec.ts` — `describe('condToolName')`
- 상세: `condToolName('')` 의 결과(`'cond_'`) 를 검증하는 테스트가 없다. `sanitizeId` 가 빈 문자열을 그대로 통과시키므로 LLM 에 `cond_` 라는 이름의 도구가 등록되는 경계 케이스다. 스키마 레이어에서 id 필수 검증이 있어 런타임 도달 확률은 낮지만, 추출된 순수 유틸 단위로서 자체 방어 경계를 문서화할 가치가 있다.
- 제안: `it('빈 문자열 id 는 cond_ 로 변환한다')` 케이스 추가. 동시에 `sanitizeId` 에 빈 가드가 필요한지도 논의 아이콘으로 메모.

### [INFO] buildConditionSystemPromptSuffix — 조건이 없을 때 빈 안내문 발생 경로에 대한 호출부 계약 불일치
- 위치: `ai-condition-evaluator.spec.ts` 라인 1834-1838, `ai-agent.handler.ts` 라인 1129-1133 (핸들러 측 `if (conditions.length > 0)` 가드)
- 상세: 스펙 테스트 `'빈 배열이면 항목 없는 안내문을 반환한다 (호출부 가드와 무관하게 안전)'` 는 함수가 빈 배열에도 `[조건 안내]` 헤더를 붙인 문자열을 반환한다는 사실을 옳게 검증한다. 그런데 핸들러 호출부는 `if (conditions.length > 0)` 로 진입을 막고 있다 — 즉 빈 배열 경로는 실제로 절대 호출되지 않는다. 테스트 설명 주석("호출부 가드와 무관하게 안전")이 이를 인식하고 있으나, 추출된 유닛의 계약(빈 배열 허용 여부)과 실제 사용 패턴이 불일치하는 것은 향후 호출부 가드를 제거할 때 혼란 유발 가능성이 있다.
- 제안: 테스트 설명에 "핸들러 가드(`conditions.length > 0`) 에 의해 실제 호출은 없음 — 방어 단위 테스트" 를 명시하거나, 함수 JSDoc 에 호출부 전제 조건을 기록한다. 테스트를 삭제할 필요는 없다.

### [INFO] classifyToolCalls — 동일 조건이 중복 id 로 등록된 conditions 배열 케이스 미비
- 위치: `ai-condition-evaluator.spec.ts` — `describe('classifyToolCalls')`
- 상세: `conditions` 배열에 동일 id 가 두 번 나타나면(`[cond('a'), cond('a')]`) `condNameToCondition` Map 이 두 번째로 덮어쓰이고, `indexOf` 는 항상 인덱스 0 을 반환한다. 이 시나리오는 스키마 레이어에서 검증되어야 하지만 순수 유닛으로서 동작이 정의되지 않은 상태다.
- 제안: INFO 수준 — 스키마가 중복 id 를 막는다는 사실을 테스트 주석으로 명시하거나, 단일 케이스로 "중복 id 는 Map 마지막 값 승리 + indexOf 첫 등장 인덱스 반환 → 첫 번째가 winner" 동작을 고정한다.

### [INFO] evaluator 인스턴스가 describe 블록 최상단에 공유 — 무상태 확인은 됐지만 beforeEach 초기화 없음
- 위치: `ai-condition-evaluator.spec.ts` 라인 1756, `const evaluator = new AiConditionEvaluator()`
- 상세: `AiConditionEvaluator` 가 완전 무상태임을 감안하면 공유 인스턴스는 정확한 설계다. 다만 미래에 상태가 추가될 경우 테스트 격리가 깨지는 위험 지점이 된다.
- 제안: 현재 구현에서는 문제 없음. 향후 상태 추가 시 `beforeEach(() => new AiConditionEvaluator())` 로 전환하도록 TODO 주석 추가는 선택 사항.

### [INFO] AiAgentHandler — conditionEvaluator 가 생성자 주입이 아닌 인라인 new 로 생성됨
- 위치: `ai-agent.handler.ts` 라인 121, `private readonly conditionEvaluator = new AiConditionEvaluator()`
- 상세: `AiConditionEvaluator` 가 무상태 순수 함수 집합이라 실용적 문제는 없으나, 의존성 주입(생성자 인자) 패턴 대신 인라인 생성을 선택해 핸들러 단위 테스트에서 evaluator 를 mock 으로 교체하는 것이 불가능하다. 현재 `ai-agent.handler.spec.ts` 의 조건 관련 테스트는 실제 `AiConditionEvaluator` 를 통해 통합 검증하는 방식을 취하고 있어 기능 정확성 커버는 충분하지만, M-1 이후 단계에서 더 복잡한 collaborator 가 추출될 경우 동일 패턴이 테스트 복잡도를 높일 수 있다.
- 제안: 현 단계(무상태 유닛)에서는 허용 가능. 이후 단계 추출 시 생성자 주입 또는 팩토리 주입 패턴 도입 여부를 의식적으로 결정할 것을 권장한다.

## 요약

이번 변경은 기존에 간접 테스트만 존재하던 핸들러 내 private 조건 평가 로직을 `AiConditionEvaluator` 로 추출하면서 전용 단위 테스트(`ai-condition-evaluator.spec.ts`)를 함께 신설했다. 신설 스펙 파일은 213줄에 걸쳐 빈 배열·빈 toolCalls·멀티바이트 절단·provider 우선순위·winner 선택 등 핵심 엣지 케이스를 망라하며, 기존 `ai-agent.handler.spec.ts` 의 조건 통합 테스트(단일턴·멀티턴 라우팅·winner 선택·rawConfig echo 등)도 behavior-preserving 성격을 충분히 지지한다. 발견된 사항은 모두 INFO 수준으로, 빈 conditionId 경계값 테스트 누락과 `buildConditionSystemPromptSuffix` 빈 배열 경로의 호출부 계약 주석 불명확이 주요 개선 후보다. 전반적인 테스트 품질과 커버리지 수준은 리팩터링 목적(회귀 격리, 직접 단위 고정)에 비추어 양호하다.

## 위험도

LOW
