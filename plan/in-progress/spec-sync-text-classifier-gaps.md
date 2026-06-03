---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# text-classifier — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/3-ai/2-text-classifier.md

## 미구현 항목
- [ ] §5.3/§6 error.details.retryable (CONVENTIONS Principle 3.2.1 필수 필드) — 핸들러 catch 블록(handler.ts:203-227)이 details 에 originalInput 만 set, retryable/retryAfterSec 미설정. code 도 항상 'LLM_CALL_FAILED' 하드코딩(429/auth 분기 없음).
- [ ] §3.2 카테고리 name·id 가 시스템 예약어(out/error/default/done/user_ended/max_turns/completed/fallback/continue)와 충돌 시 schema 거부 — 현재 validateTextClassifierConfig(schema.ts:148-179)는 __none__ 예약어와 id 중복만 거부.
- [ ] §7 캔버스 요약 `{model} · {N} categories` — textClassifierNodeMetadata.summaryTemplate 미정의(schema.ts:181-223)로 요약 본문 숨김. summaryTemplate 추가 필요.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/4-nodes/4-nodes__3-ai__2-text-classifier.md 참조.
- §6 warningRule 메시지 영문 source 화는 spec 본문에서 이미 정정 완료(코드 변경 불요).

## 구현 상태 (branch claude/spec-sync-impl-644d19, 2026-06-03)
- 미구현 항목 **코드 구현 완료** — commit 0d65f322. ai-review(13 reviewer)+resolution-applier 처리, build/lint/unit/e2e green. (reserved-word·retryable·summaryTemplate 전 항목)
- **미해결 follow-up**: spec marker flip / 본문 보강(planner) → `plan/in-progress/spec-fix-impl-marker-flips.md`. 그 완료 시 본 ticket 을 `complete/` 이동 (plan-lifecycle §2).
