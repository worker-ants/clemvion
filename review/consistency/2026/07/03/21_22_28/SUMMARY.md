# Consistency Check — impl-prep spec/5-system/ (06 leftover batch M-3·M-6·m-3·m-5)

**BLOCK: NO** — Critical 0.

## Critical: 없음
## WARNING/INFO (전부 C-2 leftover 무관 — orchestrator 가 1-auth/graph-rag 를 target 스코프로 잡음)
- W1 plan_coherence: V-09 초대 자동수락 spec-코드 불일치(1-auth §1.5.3) — 기존 갭, 본 WS refactor 무관.
- INFO: graph_error dead-event·초대 에러코드 예외 등재·audit-actions 정합·rag-rerank obsolete 등 — 전부 무관.

본 배치(M-3 gateway join await / M-6·m-5 use-execution-events / m-3 ws-client)는 spec 무변경(spec_impact: none)·behavior-fix. websocket-protocol spec 계약 무변경.

## Checker: convention_compliance NONE · plan_coherence LOW(무관 W1) · cross_spec/rationale_continuity/naming_collision 재시도(파일유실)
