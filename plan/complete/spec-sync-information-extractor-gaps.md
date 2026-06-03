---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# information-extractor — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/3-ai/3-information-extractor.md

## 미구현 항목
- [x] `output.error.details.retryable` (필수, CONVENTIONS Principle 3.2.1 — LLM 계열 노드 한정 필수) 충전. 현재 handler 의 모든 error 경로 (`LLM_CALL_FAILED` / `LLM_RESPONSE_INVALID` / `MAX_COLLECTION_RETRIES_EXCEEDED`) 가 `details` 에 `retryable` 미설정 — `information-extractor.handler.ts` `buildErrorOutput` 및 multi-turn error 블록. invariant: `LLM_CALL_FAILED` / `LLM_RATE_LIMIT` → `true`, `LLM_RESPONSE_INVALID` / `MAX_COLLECTION_RETRIES_EXCEEDED` → `false`.
- [x] `output.error.details.retryAfterSec?` — `retryable === true` 일 때 provider 신호 기반 set (현재 미구현).

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/4-nodes/4-nodes__3-ai__3-information-extractor.md 참조.
- 본 plan 완료 후 spec frontmatter status 를 `implemented` 로 복귀하고 §5.3 retryable/retryAfterSec 행의 "미구현 (Planned)" 표기를 제거한다.
- 별건(코드/구현 정합 — spec 범위 밖, 본 plan 추적 아님): (1) 정적 backend schema `informationExtractorNodePorts` 의 `out` type 이 `data` 인 반면 frontend `resolveDynamicPorts` 는 `system` 발행 — backend/frontend 포트 type 불일치. (2) `information-extractor.component.ts` 가 `conversationThreadService` 미주입 → `pushExtractorTurn` no-op.

## 구현 상태 (branch claude/spec-sync-impl-644d19, 2026-06-03)
- 미구현 항목 **코드 구현 완료** — commit 0d65f322. ai-review(13 reviewer)+resolution-applier 처리, build/lint/unit/e2e green.
- **미해결 follow-up**: spec marker flip / 본문 보강(planner) → `plan/in-progress/spec-fix-impl-marker-flips.md`. 그 완료 시 본 ticket 을 `complete/` 이동 (plan-lifecycle §2).
