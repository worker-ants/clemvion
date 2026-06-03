---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# statistics — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/2-navigation/7-statistics.md

## 미구현 항목
- [ ] Total Runs 카드 "전 기간 대비 증감률" — `StatisticsSummaryDto` 및 프론트 카드 모두 증감률 필드 부재
- [ ] 기간 필터 "커스텀 범위" 프론트 UI — 백엔드 `QueryStatisticsDto`(`period=custom` + `startDate`/`endDate`)는 지원하나 프론트에 범위 선택 UI 없음 (프리셋 `1d`/`7d`/`30d`/`90d` 버튼만)
- [ ] 프리셋 `1d`(오늘) 백엔드 enum 정합 — 프론트는 `1d` 를 보내나 백엔드 `period` enum 은 `7d`/`30d`/`90d`/`custom` 만 허용 (구현 측 검증 필요)

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings 참조.
- 별도 코드 정합 이슈(spec 범위 밖): 프론트 `1d` 전송 vs 백엔드 enum 불일치는 spec 부정확이 아니라 구현 버그 가능성 — developer 검증 필요.

## 구현 상태 (branch claude/spec-sync-impl-644d19, 2026-06-03)
- 미구현 항목 **코드 구현 완료** — commit abab3831. ai-review(13 reviewer)+resolution-applier 처리, build/lint/unit/e2e green. (증감률+custom-range; 1d enum 은 upstream #443). spec 갱신=사용자 결정 '구현 유지'
- **미해결 follow-up**: spec marker flip / 본문 보강(planner) → `plan/in-progress/spec-fix-impl-marker-flips.md`. 그 완료 시 본 ticket 을 `complete/` 이동 (plan-lifecycle §2).
