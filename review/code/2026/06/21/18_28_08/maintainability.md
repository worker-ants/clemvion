# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### ai-condition-evaluator.ts

- **[INFO]** `sanitizeId` 함수가 모듈 내부 전용이지만 export 되지 않아 클래스 외부에 노출되지 않음 — 현재 상태(unexported module-level 함수)는 적절하다. 단, `condToolName`은 export되어 있어 테스트에서 직접 검증 가능하며, `sanitizeId`는 `condToolName` 내부 구현 세부사항으로 올바르게 은닉됨. 문제 없음.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-condition-evaluator/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` L31–38

- **[INFO]** `classifyToolCalls` 내 winner 선택 루프에서 `condNameToCondition.get(ctc.name)` 로 가져온 `cond` 객체를 다시 `conditions.indexOf(cond)` 로 참조 인덱스를 탐색한다. Map 을 이미 만들어 O(1) 조회를 하지만 인덱스는 별도로 선형 탐색(`indexOf`)하는 이중 구조다. 조건 수가 실용 범위(수십 개 이하, spec 상 20개 제한)에서는 성능 이슈가 없으나, Map 에 `{ condition, index }` 쌍을 저장하면 `indexOf` 제거로 의도가 더 명확해진다.
  - 위치: `ai-condition-evaluator.ts` L92–128
  - 상세: 현재 구현은 동작 정확성에 문제 없음. 가독성 개선 여지만 존재.
  - 제안:
    ```ts
    const condNameToCondition = new Map<string, { cond: ConditionDef; idx: number }>();
    for (let i = 0; i < conditions.length; i++) {
      condNameToCondition.set(condToolName(conditions[i].id), { cond: conditions[i], idx: i });
    }
    // winner 선택 시 entry.idx 직접 사용
    ```

- **[INFO]** `buildConditionSystemPromptSuffix` 의 반환 문자열에 한국어 LLM 안내문이 하드코딩 인라인으로 포함되어 있다. 이 문자열은 LLM 프롬프트 행동을 직접 제어하는 "설정 값"에 해당하므로, `KB_TOOL_GUIDANCE` / `PRESENTATION_TOOLS_GUIDANCE` 처럼 모듈 수준 상수로 분리하면 변경 포인트를 단일화하고 테스트에서 상수를 import 해 검증하는 패턴과 일관성을 맞출 수 있다.
  - 위치: `ai-condition-evaluator.ts` L74–79
  - 상세: 현행 패턴(`ai-agent.handler.ts`)의 `KB_TOOL_GUIDANCE`/`PRESENTATION_TOOLS_GUIDANCE`와 스타일 불일치.
  - 제안: `buildConditionSystemPromptSuffix` 내 고정 접미사 부분을 `CONDITION_GUIDANCE_TEMPLATE` 상수로 추출하고, 조건 목록만 동적으로 삽입하는 방식으로 분리.

- **[INFO]** `extractConditionReason` 에서 `reason.slice(0, 500)` 의 `500`이 매직 넘버다. 다른 cap 값들(`TOOL_RESULT_PREVIEW_CHARS = 200`, `FORM_SUBMITTED_MAX_BYTES = 10 * 1024`)은 이름 있는 상수로 분리되어 있는데 이것만 인라인.
  - 위치: `ai-condition-evaluator.ts` L148
  - 상세: 동일 파일의 다른 cap 들과 패턴 불일치.
  - 제안: `const CONDITION_REASON_MAX_CHARS = 500;` 으로 추출.

- **[INFO]** `AiConditionEvaluator` 클래스는 인스턴스 상태가 전혀 없는 pure 로직의 모음이다. 현행 클래스 설계는 NestJS DI 패턴과 맞추기 위한 collaborator 형태로 합리적이나, 향후 `ai/shared/` 로 승격할 때 `@Injectable()` 없이 module-level 함수 묶음(`conditionEvaluatorUtils`) 또는 namespace 로 전환하는 것도 고려할 수 있다. 현 단계에서는 결정 불필요.
  - 위치: `ai-condition-evaluator.ts` L50
  - 상세: 클래스 형태 자체가 잘못된 것은 아님. 미래 설계 선택지 메모.

### ai-agent.handler.ts (변경 부분)

- **[INFO]** `conditionEvaluator` 필드가 `private readonly` 로 선언되고 생성자 없이 `= new AiConditionEvaluator()` 로 초기화된다. 이 패턴은 기존 코드베이스의 의존성 주입 방식(`constructor` 파라미터)과 다르다. 무상태 collaborator 이므로 테스트에서 대체할 이유가 없어 현 방식이 단순하고 적절함. 다만 향후 `AiConditionEvaluator` 가 의존성을 갖게 되면 주입 경로 리팩터가 필요해지는 점을 인지할 것.
  - 위치: `ai-agent.handler.ts` L118
  - 상세: 현재는 문제 없음. 변경 시 주의 사항 기록.

- **[INFO]** `buildConditionSystemPromptSuffix` 호출이 handler 내 두 곳(`executeSingleTurn` 경로와 `executeMultiTurn` 경로)에서 각각 나타난다. 이 중복 호출 패턴은 이 PR 이전부터 존재하던 구조이며 이번 리팩터 범위 밖이다. 향후 단일화 여지는 있음.
  - 위치: `ai-agent.handler.ts` diff L127–130, L158–161

### ai-condition-evaluator.spec.ts

- **[INFO]** 테스트 파일에서 `describe` 최상위 스코프에 `const evaluator = new AiConditionEvaluator()` 가 선언되어 있다. 클래스가 무상태이므로 각 테스트가 공유 인스턴스를 쓰는 것은 정확히 맞다. `beforeEach` 에서 재생성할 필요가 없어 현 구조가 의도를 명확히 표현한다.

- **[INFO]** `condToolName` 테스트가 `AiConditionEvaluator` describe 블록 안에 있다. `condToolName` 은 export 된 모듈 수준 함수이므로 wrapper 없이 직접 테스트하는 것은 맞으나, 클래스 인스턴스와 무관한 함수임을 명확히 하기 위해 describe 블록을 최상위로 분리하는 것이 더 명확할 수 있다. 현재도 동작에는 지장 없음.
  - 위치: `ai-condition-evaluator.spec.ts` L1772–1779

- **[INFO]** `buildConditionSystemPromptSuffix` 테스트에서 suffix 내용을 `toContain` 으로 부분 검증한다. 안내문 전체 문자열보다 핵심 토큰만 검증하는 방식은 향후 문구 변경 시 테스트 수정 범위를 최소화하는 의도적 선택으로 보임. 적절하다.

## 요약

이번 변경은 `AiAgentHandler` 의 god-class 분할 첫 단계로, 조건 평가 로직을 무상태 collaborator `AiConditionEvaluator` 로 추출한 behavior-preserving 리팩터다. 추출된 클래스는 책임이 명확히 분리되어 있고, 주석이 충분하며, 함수 길이·중첩 깊이 모두 적정하다. 테스트 17케이스가 입출력 계약을 직접 고정해 회귀 격리 기반을 확보했다. 주요 개선 여지는 (1) `extractConditionReason` 의 `500` 매직 넘버 상수화, (2) `buildConditionSystemPromptSuffix` 의 인라인 프롬프트 문자열을 `handler.ts` 의 `KB_TOOL_GUIDANCE` 패턴과 일관되게 상수 추출하는 것으로, 둘 다 INFO 수준이다. `classifyToolCalls` 의 `indexOf` 이중 탐색도 사소한 가독성 개선 여지이나 동작 정확성과 실용 범위 성능에는 무관하다.

## 위험도

LOW
