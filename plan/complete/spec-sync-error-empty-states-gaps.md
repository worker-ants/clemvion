---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# error-empty-states — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/2-navigation/11-error-empty-states.md

## 미구현 항목
- [x] Triggers 목록 빈 상태 — 공유 `EmptyState` 적용 + **트리거 추가** CTA (§2.2). 현재 CTA 없는 인라인 `Inbox` 빈 상태(triggers/page.tsx:618-622).
- [x] Schedule 목록 빈 상태 — 공유 `EmptyState` 적용 + **스케줄 추가** CTA (§2.2). 현재 CTA 없는 인라인 `Inbox` 빈 상태(schedules/page.tsx:978-983).
- [x] 검색 결과 없음 전용 상태 + **필터 초기화** CTA (§2.3). 현재 Workflows 는 안내 문구만 교체(`adjustFiltersHint`)하고 전용 메시지·리셋 버튼 없음(workflows/page.tsx:378-402). 검색바/필터가 있는 모든 목록 화면 공통 적용 대상.

## 비고
- §1 에러 페이지 5종은 완전 구현 확인됨 (error-page.tsx). 강등 사유 아님.
- §2.2 Dashboard / Workflows / Integration / Executions 빈 상태는 구현됨.
- 각 항목의 근거(claim→코드부재)는 audit findings/2-navigation.md 참조.

## 구현 상태 (branch claude/spec-sync-impl-644d19, 2026-06-03)
- 미구현 항목 **코드 구현 완료** — commit ae20f7bd. ai-review(13 reviewer)+resolution-applier 처리, build/lint/unit/e2e green. (공유 EmptyState — Triggers/Schedules CTA + Workflows reset)
- **미해결 follow-up**: spec marker flip / 본문 보강(planner) → `plan/in-progress/spec-fix-impl-marker-flips.md`. 그 완료 시 본 ticket 을 `complete/` 이동 (plan-lifecycle §2).
