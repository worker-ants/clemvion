---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# common (Integration 노드 공통 규약) — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/4-integration/0-common.md

## 미구현 항목
- [ ] §5 Database Query 캔버스 요약 — `database-query.schema.ts` 에 `summaryTemplate` 추가 (`{queryType} · {쿼리 첫 줄}`). 현재 부재 → 요약 미렌더.
- [ ] §5 Send Email 캔버스 요약 — `send-email.schema.ts` 에 `summaryTemplate` 추가 (`to: {수신자}` + 수신자 2명 초과 시 `+N`). 현재 부재.
- [ ] §5 `⚠ Missing integration` 배지 — 삭제된 Integration 참조를 감지해 캔버스 요약에 앰버 배지를 표시하는 warningRule/렌더 로직. 현재 docs mdx 에만 기술, 코드 부재.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/4-nodes/4-nodes__4-integration__0-common.md 참조.
- HTTP Request / Cafe24 요약은 이미 `summaryTemplate` 으로 구현됨 (미구현 대상 아님).
- §4.2 `INTEGRATION_NOT_FOUND` 코드 부재는 본문 패치로 정정 완료(강등 사유 아님 — handler 계약 자체는 정합).
