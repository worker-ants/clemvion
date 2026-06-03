---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# user-guide-evidence — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/conventions/user-guide-evidence.md

## 미구현 항목
- [x] §4 채널 2 — `.claude/agents/user-guide-writer.md` 에 "GUI 흐름 절 작성 시 `<ImplAnchor>` 동반 의무" 자가검증 체크리스트 항목 등재 (현재 해당 파일에 ImplAnchor/impl-anchor/user-guide-evidence 언급 0건)
- [x] §2 `impl-anchor-existence.test.ts` — `kind="api-endpoint"` anchor 에 대한 NestJS `@Post`/`@Get` 데코레이터 + path 매치 추가 검증 (현재 kind 분기 없이 file 실존 + symbol substring grep 만 적용)

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/conventions.md `### spec/conventions/user-guide-evidence.md` 절 참조.
- §2/§3.2 triggers-coverage 의 'provider-name 기반 절 탐지' over-claim, §1.3/R-1 의 display:none over-claim, §3 예시 symbol(chatChannelCheckbox) 오기는 본 audit 동기화에서 spec 본문 patch 로 이미 정정 — 코드 변경 불요.

## 구현 상태 (branch claude/spec-sync-impl-644d19, 2026-06-03)
- 미구현 항목 **코드 구현 완료** — commit 8651f4b5. ai-review(13 reviewer)+resolution-applier 처리, build/lint/unit/e2e green. (api-endpoint anchor guard + agent self-check)
- **미해결 follow-up**: spec marker flip / 본문 보강(planner) → `plan/in-progress/spec-fix-impl-marker-flips.md`. 그 완료 시 본 ticket 을 `complete/` 이동 (plan-lifecycle §2).
