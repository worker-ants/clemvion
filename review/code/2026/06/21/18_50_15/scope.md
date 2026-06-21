# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [INFO] `required: []` 필드 추가 — 원본에 없던 JSON Schema 필드
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-condition-evaluator/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` — `buildConditionTools` 메서드, `parameters.required: []`
- 상세: 원본 `ai-agent.handler.ts` 의 인라인 `conditionTools` 생성 블록에는 `required` 필드가 없었다. 신규 파일에서는 `required: []` 가 명시적으로 추가됐다. 커밋 메시지에서 "spec §5.1 정합으로 `required: []` 명시 — JSON Schema 상 생략과 동치"라고 설명하며, JSON Schema 규약상 동작은 동일하다. 그러나 순수 이동(behavior-preserving extract)의 정의를 엄밀히 적용하면 없던 필드를 추가한 것이므로 "완전한 이동"과는 미세하게 다르다.
- 제안: spec §5.1 에 `required: []` 가 명시돼 있다면 현재 방식이 오히려 올바른 정합이므로 변경 유지. 단, 이를 순수 이동 이외의 의도적 개선임을 커밋 메시지에서 이미 명시하고 있어 추가 조치 불필요.

### [INFO] `condToolName` 가시성 변경 — private → export
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-condition-evaluator/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` 및 `.spec.ts` import
- 상세: 원본에서 `condToolName` 은 핸들러 파일 내 module-private 함수였다. 신규 파일에서는 `export function condToolName` 으로 공개됐으며, 테스트 파일이 이를 직접 import한다. 단위 테스트 접근성 확보를 위한 자연스러운 변경으로, 내부 호출 의미는 동일하다.
- 제안: 테스트 요건상 필수 변경. 추가 조치 불필요.

## 요약

이번 변경은 `AiAgentHandler` 내 조건 평가 로직 5개 메서드·2개 타입·1개 암묵 상수를 신규 무상태 collaborator `AiConditionEvaluator` 로 추출하는 §M-1 1단계 리팩토링이다. 변경 대상 파일은 핸들러·신규 evaluator·신규 테스트 3개로 한정되며, 무관한 파일·설정·포맷팅 수정은 없다. 핸들러에서 제거된 코드와 신규 파일에 추가된 코드는 1:1 대응이며, 단 하나의 미세 차이(`required: []` 명시)는 JSON Schema 상 동등하고 spec 정합을 위한 의도적 추가로 커밋 메시지에 근거가 명시돼 있다. 단위 테스트 신설도 추출 행위에 수반되는 자연스러운 범위 내 작업이다. 전체적으로 변경 범위를 벗어난 부분은 없다.

## 위험도

NONE
