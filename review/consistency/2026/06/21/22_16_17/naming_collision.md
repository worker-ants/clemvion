# 신규 식별자 충돌 Check — 결과

검토 범위: `spec/4-nodes/3-ai` (0-common.md · 1-ai-agent.md 기준)
검토 모드: --impl-done, diff-base=origin/main

---

## 발견사항

### 1. 엔티티/타입명: `AiMemoryManager` vs `AgentMemoryService`

- **등급**: INFO
- target 신규 식별자: `AiMemoryManager` (`codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts`)
- 기존 사용처: `AgentMemoryService` (`codebase/backend/src/modules/agent-memory/agent-memory.service.ts:141`)
- 상세: 두 클래스 모두 "메모리" 관련 이름이나 책임 레이어가 다르다. `AiMemoryManager`는 node 레이어 오케스트레이터(config 해석·LLM 호출 전 컨텍스트 조립·turn 경계 enqueue), `AgentMemoryService`는 modules 레이어 I/O 서비스(임베딩 회수·DB 저장·dedup). `ai-memory-manager.ts` 주석에서 명시적으로 "이름이 근접하지만 책임·레이어가 다르다"고 설명되어 있어 의도된 구분임. 혼동 가능성은 낮으나 코드 리뷰·검색 시 근접 이름으로 혼선 가능.
- 제안: 현행 명명 유지 가능. 향후 신규 기여자를 위해 `ai-memory-manager.ts` JSDoc 의 기존 책임 설명이 이미 층위를 명확히 기술하고 있어 추가 조치 불필요.

### 2. 파일 경로 미등재: `ai-memory-manager.ts` / `ai-condition-evaluator.ts` — spec frontmatter `code:` 누락

- **등급**: WARNING
- target 신규 식별자: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts`, `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts`
- 기존 사용처: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 섹션 — 현재 `agent-memory-injection.ts`·`agent-memory-schema.ts` 만 등재 (구 파일), 신규 분리 파일 2개 누락
- 상세: 이는 이미 `plan/in-progress/refactor/02-architecture.md` §M-1 의 "planner 후속(비차단 SPEC-DRIFT)" 항목으로 명시되어 있고 `review/consistency/2026/06/21/22_00_44/` impl-done 결과의 WARNING 2건과 동일 사안. spec frontmatter가 구현 파일을 완전히 추적하지 못하는 drift 상태.
- 제안: `1-ai-agent.md` frontmatter `code:` 에 `ai-memory-manager.ts`·`ai-condition-evaluator.ts` 를 추가하고, `agent-memory-injection.ts`·`agent-memory-schema.ts` 가 여전히 핸들러와 IE handler 에서 직접 import 되는지 확인 후 존치 여부 결정 (planner 처리, M-1 전체 완료 시 일괄 권장).

### 3. 엔티티/타입명: `AiConditionEvaluator` vs `condition-evaluator.util.ts` (core)

- **등급**: INFO
- target 신규 식별자: `AiConditionEvaluator` (`codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts`)
- 기존 사용처: `codebase/backend/src/nodes/core/condition-evaluator.util.ts` — `evaluateCondition` 등 logic 노드(if-else/switch/loop) 공용 조건 평가 유틸. `spec/4-nodes/1-logic/0-common.md` 및 `spec/4-nodes/0-overview.md:50` 에 명시
- 상세: "ConditionEvaluator" 라는 단어를 공유하지만 범위와 계층이 완전히 다르다. `AiConditionEvaluator`는 AI Agent 조건 도구(`cond_*`) 분류/처리 전용, `condition-evaluator.util.ts`는 logic 카테고리 노드의 표현식 기반 조건 평가 유틸. `Ai` 접두사로 명확히 구분되어 있으며 spec 에도 두 존재가 별도 섹션(`spec/4-nodes/1-logic/0-common.md` vs `spec/4-nodes/3-ai/1-ai-agent.md §5`)에 각각 등재. 실질 충돌 없음.
- 제안: 현행 명명 유지.

### 4. 파일 경로 미등재: `system-context-schema.ts` — spec `0-common.md` frontmatter 누락

- **등급**: INFO
- target 신규 식별자: `codebase/backend/src/nodes/ai/shared/system-context-schema.ts` (§11 구현 파일)
- 기존 사용처: `spec/4-nodes/3-ai/0-common.md` frontmatter `code:` — `system-context-prefix.ts` 는 등재되어 있으나 `system-context-schema.ts` 는 미등재
- 상세: `system-context-schema.ts` 는 `buildSystemContextSchemaFields`·`pickNonDefaultSystemContext` 를 제공하는 공유 유틸로 세 노드 스키마 모두에서 import 된다. spec `code:` 필드가 완전한 파일 목록을 의도한 경우 누락.
- 제안: `0-common.md` frontmatter `code:` 에 `system-context-schema.ts` 추가 (planner 처리).

---

## 요약

`spec/4-nodes/3-ai` 가 도입하는 신규 식별자 중 다른 의미로 이미 사용 중인 것은 없다. `AiMemoryManager`(node 레이어 오케스트레이터)와 `AgentMemoryService`(modules 레이어 I/O 서비스), `AiConditionEvaluator`(AI agent 조건 도구 처리)와 `condition-evaluator.util.ts`(logic 노드 표현식 평가)는 접두사·파일 위치·계층으로 명확히 구분된다. 실질 충돌은 없으며, 발견된 WARNING은 신규 분리 파일 2개(`ai-memory-manager.ts`, `ai-condition-evaluator.ts`)가 `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 에 미등재된 spec drift 사안으로, 이미 plan의 "planner 후속(비차단 SPEC-DRIFT)" 항목 및 이전 impl-done WARNING 으로 추적되고 있다. `system-context-schema.ts` 의 `0-common.md` 미등재는 INFO 수준이다.

## 위험도

LOW

STATUS: SUCCESS
