# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/4-nodes/3-ai` (impl-done, diff-base=origin/main)
**변경 요약**: M-1 1단계 — `AiAgentHandler` 내부의 조건(condition) 평가 로직(`classifyToolCalls` / `buildConditionTools` / `buildConditionSystemPromptSuffix` / `extractConditionReason` / `ConditionDef` / `ConditionClassification` / `condToolName` / `sanitizeId`)을 `ai-condition-evaluator.ts` 의 무상태 `AiConditionEvaluator` 클래스로 추출. behavior-preserving 리팩터. spec 변경 없음.

---

## 발견사항

- **[INFO]** spec `code:` frontmatter 에 신규 파일 미등재
  - target 위치: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 목록 (lines 4–13)
  - 충돌 대상: 동일 파일 frontmatter
  - 상세: `spec/4-nodes/3-ai/1-ai-agent.md` 의 `code:` 목록에 `ai-agent.handler.ts` 와 `tool-providers/*.ts` 는 등재되어 있으나, 이번 리팩터로 신설된 `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` 는 등재되지 않았다. frontmatter `code:` 는 spec 의 구현 증거 레지스트리이므로 누락 시 spec-coverage 도구가 이 파일을 추적 대상에서 제외한다. plan/in-progress/refactor/02-architecture.md M-1 체크리스트도 "planner 후속(비차단 SPEC-DRIFT): spec `code:` 목록에 `ai-condition-evaluator.ts` 등재"로 명시하고 있다.
  - 제안: `spec/4-nodes/3-ai/1-ai-agent.md` 의 `code:` 목록에 `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` 추가. spec 변경이므로 `project-planner` 역할로 처리.

- **[INFO]** spec §6.1 step 3a 구현 파일 참조가 구 위치를 가리킴
  - target 위치: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` §6.1 step 3a (line 370)
  - 충돌 대상: 신규 구현 파일 `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts`
  - 상세: 해당 행은 `(구현: ai-agent.handler.ts classifyToolCalls)` 라고 명시하지만, `classifyToolCalls` 는 이제 `AiConditionEvaluator` 클래스 (`ai-condition-evaluator.ts`) 에 위치한다. `ai-agent.handler.ts` 는 `this.conditionEvaluator.classifyToolCalls(...)` 로 위임만 한다. spec 구현 힌트 참조가 실제 구현 위치와 drift 됐다.
  - 제안: spec §6.1 step 3a 의 괄호 주석을 `(구현: ai-condition-evaluator.ts AiConditionEvaluator.classifyToolCalls)` 로 갱신. 구현 힌트이지 contract 정의가 아니므로 INFO 등급.

---

## 요약

이번 M-1 1단계 리팩터는 `AiAgentHandler` 내부의 조건 평가 로직을 행동 보존적으로 `AiConditionEvaluator` 무상태 collaborator 로 추출한 것으로, spec 이 정의한 모든 behavioral contract 이 그대로 유지된다. 구체적으로 `ConditionDef` 데이터 모델(id/label/prompt 3필드), `cond_` prefix 명명·sanitizeId 변환 규칙, reason 500자 cap, 조건 다중 호출 시 conditions 배열 선두 winner 선택 규칙, 조건+비조건 혼재 시 비조건 우선 실행 순서, 도구 파라미터 스키마(`required: []`) 등이 모두 동일하다. 계층 책임 분할 관점에서도 `AiConditionEvaluator` 는 `nodes/ai/ai-agent/` co-location 내에 유지되어 기존 모듈 경계(`AgentToolProvider` 인터페이스·`processMultiTurnMessage` 폴리모픽 계약)와 충돌하지 않는다. 발견된 두 건은 모두 spec 문서의 `code:` 등재 누락 및 구현 위치 힌트 참조 drift 로 한정된 정보성 메모이며, plan 02-architecture.md M-1 체크리스트에서 이미 "planner 후속(비차단 SPEC-DRIFT)"으로 식별된 기존 사안이다. 새 동작을 정의하거나 기존 계약을 위반하는 변경은 없다.

## 위험도

NONE
