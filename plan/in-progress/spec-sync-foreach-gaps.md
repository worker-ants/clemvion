---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# foreach — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/1-logic/9-foreach.md

## 미구현 항목
- [ ] body 표현식에서 `$item.isFirst` / `$item.isLast` 첫·마지막 항목 플래그 노출. 현재 엔진 내부 `itemContext` 는 `isFirst`/`isLast` 를 보유하지만(`foreach-executor.ts:78-83`) `expression-resolver.service.ts` 는 `$item`(raw)/`$itemIndex` 만 노출 → body 표현식에서 first/last 직접 판별 불가. (현재 workaround: `$itemIndex === 0`)

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/4-nodes/4-nodes__1-logic__9-foreach.md 참조.
- 함께 정정된 순수 서술 부정확(강등 사유 아님): §5.2/§5.3 envelope `port:'done'` 키 부재(라우팅은 edge 활성화), `meta.durationMs` 부재(DB row/WS 레벨만), §6 메시지 SSOT 영문화 — 모두 본 audit 에서 본문 패치 완료.
