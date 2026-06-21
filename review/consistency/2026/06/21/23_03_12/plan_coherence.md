# Plan 정합성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
Target: `spec/4-nodes/3-ai` (`0-common.md` / `1-ai-agent.md` / `2-text-classifier.md` / `3-information-extractor.md`)
작업 컨텍스트: M-1 3단계 — `AiTurnExecutor` 추출 (`plan/in-progress/refactor/02-architecture.md §M-1`)

---

## 발견사항

### 발견사항 1
- **[INFO]** `spec/4-nodes/3-ai/1-ai-agent.md §6.1 step 3a` 구현 참조가 `ai-agent.handler.ts classifyToolCalls` 로 남아 있으나 실제 구현은 `ai-condition-evaluator.ts` 로 이전됨
  - target 위치: `1-ai-agent.md §6.1 step 3a` 마지막 괄호 `(구현: ai-agent.handler.ts classifyToolCalls)`
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md §M-1` — "planner 후속(비차단 SPEC-DRIFT): §6.1 step 3a 구현 참조(`ai-agent.handler.ts classifyToolCalls` → `ai-condition-evaluator.ts`) 갱신 + M-1 전체 완료 시 일괄 처리 권장"
  - 상세: M-1 1단계(PR #665)에서 `classifyToolCalls` 가 `ai-condition-evaluator.ts` 로 이전됐으나 spec 본문의 구현 참조가 아직 갱신되지 않았다. plan 이 이를 "planner 후속 비차단 SPEC-DRIFT" 로 명시 인지·추적 중이다.
  - 제안: M-1 3단계(AiTurnExecutor) 구현 완료 후 plan 이 정한 시점(M-1 전체 완료)에 planner 가 spec 본문 갱신. 3단계 착수를 차단하지 않는다.

### 발견사항 2
- **[INFO]** `spec/4-nodes/3-ai/1-ai-agent.md §6.1` step 1.5/1.3/2.7 구현 참조 경로가 `ai-agent.handler.ts` 암시이나 `AiMemoryManager`(`ai-memory-manager.ts`)로 이전됨
  - target 위치: `1-ai-agent.md §6.1` — 단계 1.5/1.3/2.7 본문
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md §M-1` — "§6.1 단계 1.3/1.5/2.7 구현 참조(→ ai-memory-manager.ts) 갱신 … M-1 전체 완료 시 일괄 처리 권장"
  - 상세: M-1 2단계(PR #668)에서 `injectMemoryContext`/`scheduleMemoryExtraction`/`resolveMemoryStrategy` 가 `ai-memory-manager.ts` 로 이전됐으나 spec 구현 참조 경로 갱신이 보류 중이다. plan 에서 동일하게 "planner 비차단 후속"으로 추적 중.
  - 제안: 발견사항 1과 동일 시점에 planner 가 일괄 갱신. 착수 차단 없음.

### 발견사항 3
- **[INFO]** `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 에 `ai-condition-evaluator.ts`, `ai-memory-manager.ts` 미등재
  - target 위치: `1-ai-agent.md` frontmatter `code:` 목록
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md §M-1` — "1-ai-agent.md frontmatter code: 에 ai-condition-evaluator.ts·ai-memory-manager.ts 등재. M-1 전체 완료 시 일괄 처리 권장"
  - 상세: plan 이 인지하고 M-1 전체 완료 시 일괄 갱신으로 명시 추적 중이다. 3단계 완료 후 `ai-turn-executor.ts` 등재도 같은 시점에 함께 처리하도록 정의됨.
  - 제안: 착수 차단 없음. 3단계 완료 후 M-1 일괄 spec 갱신 시 포함.

### 발견사항 4
- **[INFO]** `ai-agent-tool-connection-rewrite.md` 의 모든 설계 결정(도구 등록 모델·시그니처 위치·실행 컨텍스트·결과 라우팅·ND-AG-21)이 TBD이며, target spec 의 `§6.1 step 3a`는 일반 도구 분류 시 "가짜 성공 stub 회신 (`tool_call_not_implemented` 은 Planned)"으로 현행 유지를 명시
  - target 위치: `1-ai-agent.md §6.1 step 3a` — "미구현 (Planned)" 박스
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md §1 디자인 결정` — 5개 결정 항목 전부 TBD
  - 상세: AiTurnExecutor 추출(step 3)은 behavior-preserving 리팩터라 기존 stub 동작을 그대로 위임하면 미결 결정과 충돌하지 않는다. 단, 추출 과정에서 stub 동작을 변경하거나 `tool_call_not_implemented` 를 일방적으로 구현하면 TBD 결정을 우회하는 CRITICAL 이 된다.
  - 제안: 3단계 구현 시 일반 도구 stub 동작을 변경하지 않고 핸들러 → `AiTurnExecutor` 로 동일 코드 이전만 수행. 별도 결정 필요.

### 발견사항 5
- **[INFO]** `ai-context-memory-followup-v2.md` backlog 중 `injectMemoryContext` 이중 쿼리 단일화(I/O-backed 전환 대비), `ConversationThreadService.updateSummaryState()` 신설이 미완료이며 `ai-memory-manager.ts` 내부 로직과 연관
  - target 위치: `1-ai-agent.md §6.1 step 1.5` (컨텍스트 메모리 주입 로직) / `§6.2 d.5`
  - 관련 plan: `plan/in-progress/ai-context-memory-followup-v2.md §v2 코드 리뷰 도출 백로그` — `[ ] injectMemoryContext 이중 쿼리 단일화`, `[ ] ConversationThreadService.updateSummaryState() 신설`
  - 상세: 이 backlog 항목들은 `ai-memory-manager.ts` 내부 구현 품질 개선 항목이다. `AiTurnExecutor` 추출(step 3) 대상은 `processMultiTurnMessage` 내 turn 처리 루프이며 memory 주입 로직과 직교하다. 추출 과정에서 backlog 항목을 우회하거나 결정하지 않도록 주의.
  - 제안: 착수 차단 없음. AiTurnExecutor 가 `AiMemoryManager` 를 주입받아 호출하는 구조를 유지하면 backlog 항목의 추후 구현이 가능하다.

---

## 요약

`spec/4-nodes/3-ai` 는 M-1 3단계(`AiTurnExecutor` 추출)의 구현 기준으로서 plan과의 정합성이 양호하다. 미결 결정(`ai-agent-tool-connection-rewrite.md`)은 일반 도구 stub 동작과 관련되며, behavior-preserving 추출인 한 step 3는 이 결정을 우회하지 않는다. spec 구현 참조 경로와 frontmatter `code:` 의 갱신 지연은 plan이 인지·추적하는 비차단 INFO 수준 SPEC-DRIFT다. `exec-park-durable-resume.md`의 Phase B 완료(B1/B2/B3 전체 체크됨)와 `ai-context-memory-followup-v2.md`의 미완료 backlog는 step 3 착수를 차단하지 않는다. CRITICAL 또는 WARNING 등급의 충돌은 발견되지 않았다.

## 위험도

NONE

---

STATUS: OK
