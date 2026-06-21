# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상 영역: `spec/4-nodes/3-ai` (0-common.md / 1-ai-agent.md / 2-text-classifier.md / 3-information-extractor.md)
연관 컨텍스트: M-1 2단계 `AiMemoryManager` 추출 착수 전 검토

---

## 발견사항

### [INFO] `1-ai-agent.md` frontmatter `code:` 에 `ai-condition-evaluator.ts` 미등재
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 목록 (line 4-13)
- 충돌 대상: `plan/in-progress/refactor/02-architecture.md` §M-1 1단계 planner 후속 항목
- 상세: M-1 1단계 완료(`24ca3340`)로 `ai-condition-evaluator.ts` 가 신설됐으나 spec `1-ai-agent.md` 의 frontmatter `code:` 목록에는 아직 등재되지 않았다. plan §M-1 비고("**planner 후속(비차단 SPEC-DRIFT)**: `1-ai-agent.md` frontmatter `code:` 에 `ai-condition-evaluator.ts` 등재")가 이를 명시하고 있으나 현재 spec 에는 반영 미완. spec `code:` 목록은 단일 진실 역할이므로 기존 `ai-agent.handler.ts` 항목만 보이는 상태다.
- 제안: planner 가 `1-ai-agent.md` frontmatter `code:` 에 `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` 를 추가. `--impl-prep` 에 해당하는 M-1 2단계(`AiMemoryManager`) 착수를 차단하지 않음(비차단 SPEC-DRIFT).

### [INFO] `1-ai-agent.md §6.1 step 3a` 구현 참조 표현이 리팩토링 이전 상태로 기술
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 step 3a (line 370): `"구현: ai-agent.handler.ts classifyToolCalls"`
- 충돌 대상: 실제 구현 (`codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts`)
- 상세: M-1 1단계가 `classifyToolCalls` 를 `AiConditionEvaluator` 로 추출했으나 spec §6.1 step 3a 는 여전히 `ai-agent.handler.ts classifyToolCalls` 를 구현 참조로 지목한다. 동작 명세(분류 로직) 자체는 변경이 없으므로 기능 모순은 없지만, spec 의 구현 참조가 실제 코드 위치와 다르다.
- 제안: planner 가 §6.1 step 3a 의 구현 참조를 `ai-condition-evaluator.ts AiConditionEvaluator.classifyToolCalls` 로 갱신. M-1 2단계 착수를 차단하지 않음(비차단 SPEC-DRIFT).

### [INFO] M-1 2단계 `AiMemoryManager` 추출이 `spec/4-nodes/3-ai/0-common.md §10` 과 `spec/5-system/17-agent-memory.md` 의 구현 참조 파일 목록에 영향
- target 위치: `spec/4-nodes/3-ai/0-common.md` frontmatter `code:` (line 4-10) — `shared/agent-memory-injection.ts` / `shared/agent-memory-schema.ts` 등재
- 충돌 대상: `plan/in-progress/refactor/02-architecture.md` §M-1 2단계 착수 계획
- 상세: M-1 2단계 `AiMemoryManager` 추출이 완료되면, `0-common.md` 및 `1-ai-agent.md` 의 frontmatter `code:` 와 §6.1 단계별 구현 참조(`agent-memory-injection.ts` → `AiMemoryManager`)가 갱신 대상이 된다. 현재 spec 은 구현 파일 위치와 정합하므로 모순은 없고, 이 항목은 2단계 완료 후 planner 가 수행할 동기화 범위를 사전에 파악해두기 위한 정보성 메모다.
- 제안: M-1 2단계 완료 후 planner 가 `0-common.md`, `1-ai-agent.md` 의 `code:` 목록과 `§6.1/§6.2` 구현 참조를 갱신. 현 착수 단계에서는 차단 없음.

---

## 요약

`spec/4-nodes/3-ai` 영역은 내부 정합성이 높고 cross-spec 충돌이 없다. 데이터 모델(`spec/1-data-model.md §2.15 AgentMemory`·`spec/5-system/17-agent-memory.md`), API 계약(CONVENTIONS node-output / conversation-thread / MCP Client), 상태 전이(multi-turn `waiting_for_input` / `resumed` / `ended`), RBAC 모델(워크스페이스 범위), 계층 책임 분할(handler co-location 원칙)이 모두 기존 spec 과 일치한다. 발견된 3건은 모두 M-1 1단계 완료 후 planner 동기화 항목으로 남겨진 비차단 SPEC-DRIFT(INFO 등급)이며, 구현 착수를 막는 CRITICAL·WARNING 은 없다.

---

## 위험도

NONE

STATUS: OK
