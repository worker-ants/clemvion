# 유지보수성(Maintainability) 리뷰

## 발견사항

### ai-condition-evaluator.ts

- **[INFO]** `condToolName` 함수가 `export`로 공개되어 있으나 클래스 외부 모듈 레벨에 독립 함수로 노출됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-condition-evaluator/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` L43
  - 상세: 테스트(`ai-condition-evaluator.spec.ts`)에서 `condToolName`을 직접 import해 검증하므로 export는 합리적이다. 다만 내부 헬퍼 `sanitizeId`는 비공개 함수로 유지되어 일관성이 떨어진다. `condToolName`이 `sanitizeId`를 감싸는 단일 진입점이므로 현재 구조는 기능적으로 문제 없으나, 향후 `sanitizeId`를 별도 검증하려는 상황에서 export 범위 결정 기준이 불명확해질 수 있다.
  - 제안: 현재 구조 유지가 적절. 단, `sanitizeId`가 단독 테스트 대상이 될 가능성이 있다면 `condToolName` 테스트로 간접 검증하는 현재 방식을 유지하고 JSDoc에 "sanitizeId는 condToolName을 통해서만 테스트됨"을 명시하면 의도가 더 명확해진다.

- **[INFO]** `buildConditionSystemPromptSuffix`의 JSDoc이 영문/한국어 혼재
  - 위치: L78–80
  - 상세: `buildConditionTools`와 `classifyToolCalls`는 한국어 JSDoc을 사용하나 `buildConditionSystemPromptSuffix`와 `extractConditionReason`은 영문 한 줄 요약만 있다. 같은 클래스 내 언어 일관성이 떨어진다. 동일 파일의 인터페이스(`ConditionDef`, `ConditionClassification`) 및 상수(`CONDITION_REASON_MAX_CHARS`)는 모두 한국어 설명을 사용한다.
  - 제안: 두 메서드의 JSDoc을 한국어로 통일하거나, 파일 레벨 정책(영문 요약 + 한국어 상세)을 명시한다.

- **[INFO]** `classifyToolCalls`의 winner 선택 루프에서 `conditions.indexOf(cond)` 호출이 O(n) 선형 탐색
  - 위치: L128–134
  - 상세: `condNameToCondition` Map으로 이름→조건 역방향 조회는 O(1)이지만, winner 선택 시 `conditions.indexOf(cond)`로 다시 조건 배열을 선형 탐색한다. conditions 수가 실무 범위(수십 개 이하)에서는 무시할 수준이며, 현재 코드는 behavior-preserving 추출이므로 성능 변경은 이 PR 범위 외다. 단, 향후 conditions 수가 늘어날 경우 Map에 인덱스도 함께 저장하는 방식으로 개선 가능하다.
  - 제안: 현재 범위에서는 변경 불필요. 후속 리팩터 시 `condNameToCondition`에 `{ cond, idx }` 튜플을 저장하면 `indexOf` 제거 가능.

### ai-agent.handler.ts

- **[INFO]** `conditionEvaluator` 필드가 인스턴스 생성 시 직접 `new AiConditionEvaluator()`로 초기화됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-condition-evaluator/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L119
  - 상세: `AiConditionEvaluator`가 완전 무상태 클래스이므로 현재 인라인 초기화는 기능상 완전하다. NestJS DI 컨테이너 밖에서 직접 `new`로 생성하는 패턴은 핸들러 자체가 NestJS managed bean이 아닌 수동 인스턴스화 패턴을 따르는 이 코드베이스에서 일관적이다. 다만 미래에 `AiConditionEvaluator`가 의존성을 가지게 되면 이 초기화 지점을 생성자로 옮겨야 하는 부채가 발생한다.
  - 제안: 현재는 적절. 무상태 불변 조건이 깨질 경우 생성자 주입으로 전환하는 것을 계획에 명시.

- **[INFO]** `buildConditionSystemPromptSuffix` 호출부 두 곳의 코드가 동일한 `if (conditions.length > 0)` 가드 패턴으로 중복
  - 위치: L1395–1131, L1924–1162 (단일턴/멀티턴 두 경로)
  - 상세: 이 패턴은 이번 PR에서 변경된 것이 아니라 기존 핸들러 구조에서 유래한 중복이다. 이번 리팩터의 범위(behavior-preserving 추출)를 벗어나므로 현재 PR에서 수정 의무는 없다. 후속 분할(M-1 2단계 이후)에서 단일 시스템 프롬프트 빌더로 통합 시 자연히 해소된다.
  - 제안: 현재 PR 범위 외. 후속 god-handler 분할 계획에 note로 남길 것.

### ai-condition-evaluator.spec.ts

- **[INFO]** `toolCall` 헬퍼의 기본 인자 `args = '{}'`가 암묵적으로 빈 JSON 객체를 의미함
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-condition-evaluator/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.spec.ts` L1759
  - 상세: 기능상 문제 없으나 `'{}'`가 "빈 arguments JSON"을 뜻한다는 것이 명시되어 있지 않다. 현재 테스트 가독성은 충분하다.
  - 제안: 필요 시 `args = '{}' // 빈 arguments` 인라인 주석 추가. 현재도 충분히 읽을 수 있어 강제 필요는 없음.

- **[INFO]** `buildConditionSystemPromptSuffix` 테스트에서 빈 배열 케이스는 안내문 존재 여부만 검증하고 `condList`가 빈 문자열인지 명시적으로 단언하지 않음
  - 위치: L1827–1831
  - 상세: 호출부(`ai-agent.handler.ts`)에서 `conditions.length > 0` 가드가 있어 실제로 빈 배열로 호출되지 않지만, 테스트 코멘트에 "호출부 가드와 무관하게 안전"이라 명시한 만큼 더 엄밀하게 단언할 수 있다.
  - 제안: `expect(suffix).not.toContain('- cond_')` 단언을 추가하면 "빈 배열일 때 항목이 없다"는 의도가 더 명확해진다. 현재도 기능적으로 충분.

## 요약

이번 변경은 `AiAgentHandler`의 god-handler에서 조건 평가 로직을 무상태 collaborator `AiConditionEvaluator`로 분리한 behavior-preserving 리팩터이다. 추출된 파일(`ai-condition-evaluator.ts`)은 160줄로 단일 책임이 명확하고, 함수·타입·상수 네이밍이 의도를 잘 나타낸다. 매직 넘버 500이 `CONDITION_REASON_MAX_CHARS`로 상수화된 점, `sanitizeId`가 내부 헬퍼로 유지되고 `condToolName`만 공개된 점 모두 적절하다. 테스트 커버리지도 빈 배열·빈 toolCalls·멀티바이트 절단 등 엣지 케이스를 망라하고 있다. 발견된 사항은 모두 INFO 등급으로, 유지보수 부채나 명확성 개선 여지를 가리키지만 즉각적인 수정이 필요한 구조적 문제는 없다. 클래스 내 JSDoc 언어 혼재(영문/한국어)가 일관성 면에서 가장 눈에 띄는 개선 포인트다.

## 위험도

NONE
