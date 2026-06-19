# Plan 정합성 검토 — spec/4-nodes/3-ai/ (--impl-prep)

검토 일시: 2026-06-19
검토 모드: 구현 착수 전 (--impl-prep)
Target: spec/4-nodes/3-ai/ (0-common.md / 1-ai-agent.md / 2-text-classifier.md / 3-information-extractor.md)
구현 목표: LLM 호출 기록 도메인 타입 통합 (LlmCallRecord / AiTurnDebugEntry → shared/ 승격)

---

## 발견사항

### [INFO] ai-agent-tool-connection-rewrite.md — 5개 TBD 결정과 target 비접촉

- target 위치: spec/4-nodes/3-ai/1-ai-agent.md §4 Tool Area 연동 ("재작성 예정 (현재 제거됨)")
- 관련 plan: plan/in-progress/ai-agent-tool-connection-rewrite.md §결정 기록 (도구 등록 모델/시그니처 위치/실행 컨텍스트/결과 라우팅/ND-AG-21 — 5항목 모두 TBD)
- 상세: 5개 미결 결정이 존재하나, 이번 구현(LlmCallRecord/AiTurnDebugEntry shared/ 승격)은 tool-providers 코드나 §4 Tool Area 영역을 건드리지 않는다. meta.turnDebug 구조 정의(§6/§7.1)는 tool connection 설계와 독립적이다.
- 제안: 조치 불요. 추적 정보로 기록.

### [INFO] exec-park-durable-resume.md — 잔여 umbrella 항목과 target 비접촉

- target 위치: spec/4-nodes/3-ai/1-ai-agent.md §7.4/_resumeCheckpoint, §6.2 멀티턴 실행 경로
- 관련 plan: plan/in-progress/exec-park-durable-resume.md §umbrella 잔여 (분리) — PR3 rehydration 일반화(ai_agent → 일반 노드 + 멱등 재개) 미구현; W4 cross-worktree rebase(타 worktree 담당)
- 상세: exec-park의 잔여 항목들은 실행 엔진 rehydration 경로와 resume_call_stack 영속에 관한 것이다. LlmCallRecord/TurnDebugEntry 타입 통합은 meta.turnDebug의 JSONB 도메인 타입을 shared/로 승격하는 순수 타입 정렬 작업이며, park/resume 메커니즘이나 _resumeCheckpoint 구조를 변경하지 않는다.
- 제안: 조치 불요. 추적 정보로 기록.

### [INFO] ai-context-memory-followup-v2.md — 잔여 백로그와 target 간접 접촉

- target 위치: spec/4-nodes/3-ai/0-common.md §6 토큰 회계, spec/4-nodes/3-ai/1-ai-agent.md §7.1 meta.turnDebug
- 관련 plan: plan/in-progress/ai-context-memory-followup-v2.md v2 백로그 — meta.memory.compactedMessages ND-AG-30 등재(미완), §6.2 d.5 spec 부연(미완)
- 상세: meta.turnDebug 구조(§6/§7.1)에서 turnDebug[i].ragSources/ragDiagnostics/mcpDiagnostics 등의 형태는 이미 spec에 정의돼 있고, LlmCallRecord(llmCalls 배열)와 AiTurnDebugEntry(turnDebug 항목)의 타입 통합은 그 정의를 구현에서 일치시키는 작업이다. 이 spec 내용이 미결 사항을 일방적으로 결정하는 것이 아니다 — meta.turnDebug 구조는 이미 확정된 spec이며 미결 항목(compactedMessages ND-AG-30 등재 등)은 별도 계층에 있다.
- 제안: 조치 불요. 추적 정보로 기록.

### [INFO] c1-engine-split.md SPEC-DRIFT 후속(planner) — 1-ai-agent.md §10 미갱신 대기 중

- target 위치: spec/4-nodes/3-ai/1-ai-agent.md §10 에러 코드 표 (LLM_API_ERROR passthrough 범위)
- 관련 plan: plan/in-progress/refactor/c1-engine-split.md §후속 고려 LLM_API_ERROR 절 — impl-done Warning: 미등록 explicit code passthrough 허용 범위가 §10에 미명시 → planner가 (a) 미등록 code passthrough 허용·retryable=false, (b) HTTP status 기준 명시 예정 (PR #630 이후 planner 후속 대기 중)
- 상세: §10 에러 코드 표가 갱신 대기 중이나, LlmCallRecord/TurnDebugEntry 타입 통합 구현은 에러 코드 분류 로직이 아닌 meta.turnDebug 내 llmCalls 배열 타입을 다루는 것이므로 해당 planner 후속 전에 착수해도 충돌이 없다.
- 제안: 조치 불요. 에러 코드 §10 변경은 타입 통합과 직교.

---

## 요약

spec/4-nodes/3-ai/ 의 진행 중 plan 참조는 3개다: ai-agent-tool-connection-rewrite.md (5개 TBD), ai-context-memory-followup-v2.md (잔여 백로그), exec-park-durable-resume.md (umbrella 잔여). 이번 구현 목표인 LlmCallRecord/AiTurnDebugEntry→shared/ 타입 통합은 세 plan의 미결 항목 중 어느 것과도 결정 충돌이 없다 — tool connection 설계, park/resume 영속, memory 전략은 모두 이 타입 정렬 작업과 독립적인 관심사다. 또한 c1-engine-split plan이 남긴 planner 후속(§10 에러 코드 명시)은 meta.turnDebug 구조와 직교한다. CRITICAL 또는 WARNING 등급의 정합 위반 없음.

## 위험도

NONE
