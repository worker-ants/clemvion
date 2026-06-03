---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# common (Integration 노드 공통 규약) — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/4-integration/0-common.md

## 미구현 항목
- [x] §5 Database Query 캔버스 요약 — `database-query.schema.ts` `summaryTemplate: {{queryType|upper}} · {{query}}` (2026-06-03 구현, downscope: DSL 줄분리 미지원으로 "첫 줄" 대신 전체 query truncate).
- [x] §5 Send Email 캔버스 요약 — `send-email.schema.ts` `summaryTemplate: {{to.length}} recipients · {{subject}}` (2026-06-03 구현, downscope: 배열 슬라이스/조건 카운트 미지원으로 "to: {수신자} +N" 대신 수신자 수 + 제목).
- [ ] §5 `⚠ Missing integration` 배지 — 삭제된 Integration 참조를 감지해 캔버스 요약에 앰버 배지를 표시하는 warningRule/렌더 로직. 현재 docs mdx 에만 기술, 코드 부재. **티어3 (cross-entity 검증 — warningRule DSL 밖, 아키텍처 결정 필요, 보류).**

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/4-nodes/4-nodes__4-integration__0-common.md 참조.
- HTTP Request / Cafe24 요약은 이미 `summaryTemplate` 으로 구현됨 (미구현 대상 아님).
- §4.2 `INTEGRATION_NOT_FOUND` 코드 부재는 본문 패치로 정정 완료(강등 사유 아님 — handler 계약 자체는 정합).

## ⚠ 재분류 (2026-06-03 groom): decision-free 아님 → planner 결정 필요
- **db-query**: `{queryType} · {쿼리 첫 줄}` 의 "첫 줄" 은 DSL 줄분리 미지원 → `{{queryType}} · {{query}}`(truncate 40자) 로 downscope 가능(minor 결정).
- **send-email**: `to: {수신자} +N` 은 `to:string[]` 에 슬라이스/조인/조건 카운트 필요 — DSL 불가. **결정 필요**(downscope vs DSL 확장).
- **⚠ Missing integration 배지**: warningRule `when` DSL 은 node config(`integrationId`)만 봄 → **삭제된 integration 존재 검증 불가**. cross-entity 검증(frontend integration 목록 또는 backend join)은 warningRule 메커니즘 밖 → **아키텍처 결정 필요**.
- 패턴(summaryTemplate): `http-request.schema.ts:234-238`, `cafe24.schema.ts:142-146`.

## send-email downscope 확정 (2026-06-03 spec-inprogress-impl2)
- send-email summaryTemplate = `{{to.length}} recipients · {{subject}}` 로 downscope 결정·구현 완료(상기 `## 미구현 항목` [x]). "to: {수신자} +N" 은 DSL 배열 슬라이스/조건 카운트 미지원으로 채택 불가. Missing-integration 배지만 티어3 잔여.
