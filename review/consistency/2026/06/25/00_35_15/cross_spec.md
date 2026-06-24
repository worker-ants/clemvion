# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`
대상: `03-maintainability C-2 2차(완결)` — `ai-turn-executor.ts` god-method behavioral-preserving 분해
검토 일시: 2026-06-25

---

## 발견사항

### 발견사항 없음 (NONE)

본 작업은 `spec/` 변경이 없는 순수 behavioral-preserving 리팩토링이다. 검토 6개 관점 각각에 대해 아래와 같이 판정한다.

**1. 데이터 모델 충돌**

target 이 신규 정의하는 엔티티·필드 없음. `_resumeState`, `_resumeCheckpoint`, `ConversationTurn`, `ai_user`/`ai_assistant` source 등 모두 기존 spec(`spec/4-nodes/3-ai/1-ai-agent.md §7.4`, `spec/conventions/conversation-thread.md`)이 정의한 shape 를 그대로 운반하는 구조. 리팩토링은 메서드 경계만 변경하므로 데이터 모델 충돌 없음.

**2. API 계약 충돌**

신규 endpoint·HTTP method·request/response shape 정의 없음. `executeSingleTurn`/`processMultiTurnMessage` 는 internal 클래스 메서드이며 외부 API surface 에 직접 노출되지 않음. 분해 후 private 메서드(`buildTurnMessages`/`executeToolBatch`/`classifyTurnResult`/`handleTurnCompletion`)도 동일하게 internal. API 계약 충돌 없음.

**3. 요구사항 ID 충돌**

target 이 새 요구사항 ID 를 부여하지 않음. 메서드 doc 에 기입할 단계 번호(`§6.1 단계 2`, `§6.2 단계 d.5` 등)는 `spec/4-nodes/3-ai/1-ai-agent.md` 의 기존 절 번호를 참조 주석으로 표기하는 것이며, 기존 ID 를 다른 의미로 재사용하거나 신규 ID 를 발행하는 것이 아님. 요구사항 ID 충돌 없음.

**4. 상태 전이 충돌**

분해 대상 메서드들이 구현하는 상태 전이(`waiting_for_input` park → `resumed` → `ended`)는 `spec/4-nodes/3-ai/1-ai-agent.md §6.2` 및 `spec/5-system/4-execution-engine.md §7.5` 의 기술과 정합이다. plan(`03-maintainability.md C-2`) 이 명시한 ordering 보존 요건 — `ai_user` push LLM 호출 전, `ai_assistant` push 응답 직후 — 도 spec §6.1 단계 1.7·2.5 / §6.2 단계 2.c·2.e 와 동일하다. behavior-preserving 분해이므로 상태 전이 충돌 없음.

**5. 권한·RBAC 모델 충돌**

AI Agent 실행 흐름의 RBAC 는 엔진 레이어(`AiTurnOrchestrator`, `execution-engine.service.ts`)가 처리한다. `AiTurnExecutor` 는 turn 처리 로직만 담당하며 리팩토링 범위에 RBAC 변경 없음. 권한 모델 충돌 없음.

**6. 계층 책임 충돌**

plan 이 제안하는 분해 경계(`buildTurnMessages` / `executeToolBatch` / `classifyTurnResult` / `handleTurnCompletion`)는 모두 `AiTurnExecutor` 의 private 메서드로 동일 파일 내부에 머문다. 기존 결정(`spec/4-nodes/3-ai/1-ai-agent.md §3.58` M-1 분할 결과) — `AiAgentHandler` facade → `AiTurnExecutor` → `AiConditionEvaluator`·`AiMemoryManager` 단방향 위임 — 을 변경하지 않는다. park/resume lifecycle 은 `AiTurnOrchestrator` 가 계속 담당(변경 없음). 계층 책임 충돌 없음.

---

## 요약

C-2 2차(완결)는 `ai-turn-executor.ts` 의 `executeSingleTurn`(~493줄)과 `processMultiTurnMessage`(~768줄) god-method 를 spec §6.1/§6.2 단계 정렬 private 메서드로 behavioral-preserving 분해하는 작업이다. 본 리팩토링은 spec 변경 불요이며, 신규 엔티티·API 계약·요구사항 ID·상태 머신·RBAC 정의를 일절 추가하지 않는다. 분해 경계는 `spec/4-nodes/3-ai/1-ai-agent.md §6.1·§6.2` 가 이미 단계 열거로 명시한 기존 경계이고, `ai_user`/`ai_assistant` turn push ordering·`_resumeState` 운반·park-rehydration checkpoint 호환은 보존 대상으로 plan 에 명기되어 있다. Cross-Spec 관점에서 어떤 다른 spec 영역과도 충돌하지 않는다.

---

## 위험도

NONE
