# 유지보수성(Maintainability) 리뷰

## 발견사항

### ai-condition-evaluator.ts

- **[INFO]** `sanitizeId` 함수가 모듈-내부(non-export)로만 남아 있어 `condToolName`을 통해서만 간접 접근된다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-condition-evaluator/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` 라인 38-40
  - 상세: `sanitizeId`는 `condToolName`의 단일 호출자만 있어, 현재 private 모듈 함수로 두는 것은 적절하다. 그러나 향후 다른 도구명 체계가 추가될 경우 재사용 경로가 불명확해진다. 현재 규모에서는 문제 없음.
  - 제안: 현 상태 유지 — 조기 추출 없이, 두 번째 사용처가 생길 때 별도 export로 승격.

- **[INFO]** `classifyToolCalls` 내 winner 선택 로직이 두 단계(분류 루프 → winner 루프)로 분리되어 있다.
  - 위치: 라인 126-139
  - 상세: 분류 1회 + winner 선택 1회, 총 두 번의 루프를 순차 실행한다. 논리 단위로는 자연스럽게 분리되어 있어 가독성 저해 수준은 아님. `Infinity` 초기값 + index 비교 패턴은 일반적인 최솟값 탐색 관용구로 명확하다.
  - 제안: 현재 조건 수가 소규모이고 로직이 명확하므로 변경 불필요.

- **[INFO]** `buildConditionSystemPromptSuffix`의 반환 문자열에 하드코딩된 한국어 안내문이 포함되어 있다.
  - 위치: 라인 89
  - 상세: `[조건 안내]`, `조건에 해당하지 않으면 대화를 계속하세요.` 등 LLM에 전달되는 프롬프트 문언이 코드 안에 직접 삽입되어 있다. 동일 파일 내 다른 안내 상수(`KB_TOOL_GUIDANCE`, `PRESENTATION_TOOLS_GUIDANCE`)는 핸들러 파일에 상수로 선언되어 있는데 이 문자열은 메서드 내부에 인라인으로 존재한다. 코드베이스 전체의 일관성에서 약간의 비대칭이 있으나, 해당 문자열이 이 클래스의 단일 책임 범위에 속하므로 허용 가능한 수준이다.
  - 제안: 향후 다국어 지원 또는 동일 문언의 재사용이 필요해지면 모듈 상단 상수로 추출. 현재는 INFO 수준.

- **[INFO]** `AiConditionEvaluator` 클래스가 상태를 전혀 갖지 않음에도 class로 선언되어 있다.
  - 위치: 라인 57
  - 상세: 모든 메서드가 순수 함수 형태이며, 인스턴스 필드가 없다. `condToolName` 처럼 자유 함수 모음으로도 구현 가능하다. 그러나 commit 메시지와 JSDoc에서 "무상태 collaborator" 패턴을 의도적으로 선택한 근거가 명시되어 있고(`private readonly conditionEvaluator = new AiConditionEvaluator()`), 추후 의존 주입(DI) 전환 시 인터페이스 분리가 용이하다. 코드베이스의 NestJS 패턴과도 일관성 있다.
  - 제안: 현 설계 유지 타당. 단, 인터페이스(`IConditionEvaluator`)를 별도로 정의하면 테스트 mock 교체와 향후 전략 패턴 확장이 쉬워진다 — 2단계 이후 리팩터링 시 검토 권장.

### ai-agent.handler.ts (변경분)

- **[INFO]** `conditionEvaluator` 인스턴스가 `private readonly` 필드로 핸들러 클래스 본문에 직접 인스턴스화되어 있다.
  - 위치: 라인 121 (`private readonly conditionEvaluator = new AiConditionEvaluator();`)
  - 상세: NestJS DI 컨테이너 밖에서 `new`로 직접 생성하고 있어, 향후 `AiConditionEvaluator`에 의존성이 생기거나 테스트에서 mock으로 교체해야 할 경우 수정 범위가 넓어진다. 현재 클래스가 무상태이므로 실용적 문제는 없고, 오히려 단순성 측면에서 장점이 있다.
  - 제안: 현재 무상태 클래스 범위에서는 허용 가능. DI 전환이 필요해지면 생성자 파라미터로 이동.

- **[INFO]** `buildConditionSystemPromptSuffix` 호출이 두 곳(라인 1395, 1924)에 동일 패턴으로 중복된다.
  - 위치: `ai-agent.handler.ts` 내 `executeSingleTurn`과 `executeMultiTurn` 경로
  - 상세: 이는 기존 코드의 구조적 중복이며 이번 변경에서 새로 생긴 것이 아니다. 변경 전후 동일하게 두 위치에서 호출된다. 이 중복 자체는 god-handler 분할의 다음 단계(메서드 레벨 통합)에서 해소될 수 있다.
  - 제안: 이번 PR 범위 밖. 후속 M-1 단계에서 공통 setup 메서드로 통합 권장.

### ai-condition-evaluator.spec.ts

- **[INFO]** `providerMatching` 헬퍼가 `AgentToolProvider`의 불필요한 메서드(`buildTools`, `execute`)를 `jest.fn()`으로 stub하고 있다.
  - 위치: 라인 1771-1777
  - 상세: `classifyToolCalls`가 `matches()`만 사용함에도 `buildTools`/`execute`를 stub한다. `as unknown as AgentToolProvider` 캐스트를 쓰므로 실제로는 필요하지 않다. 불필요한 stub이 유지 부담을 미미하게 증가시키나, 테스트 의도를 해치지 않는다.
  - 제안: `buildTools`/`execute` stub 제거해 `{ key, matches }` 최소 객체만 사용 가능. 현재 수준에서는 INFO.

- **[INFO]** describe 블록 최상위에 `const evaluator = new AiConditionEvaluator()`를 선언해 모든 테스트가 단일 인스턴스를 공유한다.
  - 위치: 라인 1756
  - 상세: 무상태 클래스이므로 공유 인스턴스 사용이 완전히 안전하다. 다만 상태가 생기는 경우 `beforeEach`로 이동해야 한다는 주의가 필요하다. 현재 구조에서는 의도적이고 명확하다.
  - 제안: 현 상태 유지. 상태가 추가되는 리팩터링 발생 시 `beforeEach(() => new AiConditionEvaluator())` 패턴으로 전환 필요.

## 요약

이번 변경은 3,400줄 god-handler에서 조건 평가 로직을 무상태 collaborator(`AiConditionEvaluator`)로 추출한 behavior-preserving 리팩터링이다. 추출된 클래스는 단일 책임을 명확히 가지며, 각 public 메서드가 짧고(최대 45줄), 중첩 깊이도 2-3 수준 이내로 적절하다. 매직 넘버 500은 `CONDITION_REASON_MAX_CHARS` 상수로 명명되어 테스트 파일에서도 직접 참조된다. 전반적으로 네이밍·문서화·테스트 커버리지가 우수하며, 기존 코드베이스 스타일(JSDoc 한국어 + 영어 혼용, 인라인 spec 참조)과 일관성을 잘 유지한다. 발견된 사항은 모두 INFO 수준으로 즉각적인 수정이 필요한 항목이 없다.

## 위험도

NONE
