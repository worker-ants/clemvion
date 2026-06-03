---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# template (Presentation) — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/6-presentation/5-template.md

## 미구현 항목
- [ ] §7 캔버스 노드 요약 — `templateNodeMetadata` (`template.schema.ts:146-173`) 에 `summaryTemplate` 부재 → `node-config-summary.ts:89` 가 항상 빈 요약 ('html · N lines' / 'html · N buttons' 미표시)

## 비고
- 근거(claim→코드부재)는 audit findings/4-nodes.md `### spec/4-nodes/6-presentation/5-template.md` 절 참조.
- §6 에러 메시지 영문/한국어 차이는 spec 본문 patch 로 정정 완료.
