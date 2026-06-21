# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/4-nodes/3-ai` (impl-done, diff-base=origin/main)
**변경 요약**: M-1 1단계 — `AiAgentHandler` 내부의 조건(condition) 평가 로직(`classifyToolCalls` / `buildConditionTools` / `buildConditionSystemPromptSuffix` / `extractConditionReason` / `ConditionDef` / `ConditionClassification`)을 `ai-condition-evaluator.ts` 의 무상태 `AiConditionEvaluator` 클래스로 추출. behavior-preserving 리팩터.

---

## 발견사항

- **[INFO]** spec `code:` frontmatter 에 신규 파일 미등재
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 목록 (lines 4–13)
  - 충돌 대상: 동일 파일 frontmatter
  - 상세: `spec/4-nodes/3-ai/1-ai-agent.md` 의 `code:` 목록에 `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 와 `tool-providers/*.ts` 는 등재되어 있으나, 이번 리팩터로 신설된 `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` 는 등재되지 않았다. frontmatter `code:` 는 spec 의 구현 증거 레지스트리이므로 누락 시 spec-coverage 도구가 이 파일을 추적 대상에서 제외한다.
  - 제안: `spec/4-nodes/3-ai/1-ai-agent.md` 의 `code:` 목록에 `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` 를 추가. spec 변경이므로 `project-planner` 역할로 처리.

- **[INFO]** spec §6.1 step 3a 구현 파일 참조가 구 위치를 가리킴
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 step 3a (line 370)
  - 충돌 대상: 신규 구현 파일 `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts`
  - 상세: 해당 행은 `(구현: ai-agent.handler.ts classifyToolCalls)` 라고 명시하지만, `classifyToolCalls` 는 이제 `AiConditionEvaluator` 클래스 (`ai-condition-evaluator.ts`) 에 위치한다. `ai-agent.handler.ts` 는 `this.conditionEvaluator.classifyToolCalls(...)` 로 위임할 뿐이다. spec 참조 위치가 구현과 drift 됐다.
  - 제안: spec §6.1 step 3a 의 괄호 주석을 `(구현: ai-condition-evaluator.ts AiConditionEvaluator.classifyToolCalls)` 로 갱신. 단, 이 참조는 구현 힌트이지 contract 정의가 아니므로 CRITICAL 이 아닌 INFO 등급.

---

## 요약

이번 M-1 1단계 리팩터는 `AiAgentHandler` 내부의 조건 평가 로직을 행동 보존적으로 외부 클래스로 추출한 것으로, spec 이 정의한 데이터 모델(`ConditionDef` 구조), API 계약(출력 포트·reason 500자 cap·`cond_` prefix 명명), 상태 전이(단일 winner 선택·조건+비조건 혼재 시 비조건 우선 실행), 조건 도구 파라미터 스키마 등 모든 behavioral contract 이 그대로 유지된다. 계층 책임 분할 관점에서도 `AiConditionEvaluator` 는 AI 노드 패키지 내부 collaborator 로 남아 있어 기존 모듈 경계와 충돌하지 않는다. 발견된 두 건은 모두 spec 문서의 `code:` 등재 누락 및 구현 위치 힌트 참조 drift 로 한정된 정보성 메모다. 새 동작을 정의하거나 기존 계약을 위반하는 변경은 없다.

## 위험도

NONE
