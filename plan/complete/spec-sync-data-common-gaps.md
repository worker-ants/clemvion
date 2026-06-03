---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# common (Data 노드 공통 규약) — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/5-data/0-common.md

## 미구현 항목
- [x] §3 캔버스 요약: Code 노드 `{language} · {N} lines` (예: `JavaScript · 12 lines`). `codeNodeMetadata` (codebase/backend/src/nodes/data/code/code.schema.ts) 에 `summaryTemplate` 이 없어 캔버스 본문 요약이 표시되지 않는다 (`getConfigSummary` → `renderSummaryTemplate` → `null`). Transform 만 `summaryTemplate` 구현됨 (`transform.schema.ts:228`).

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/4-nodes/4-nodes__5-data__0-common.md 참조.
- §3 (캔버스 요약) Code 행은 본문에서 "미구현 (Planned)" 으로 표기 분리됨.
- §4 transform/code `meta` 형태 stale 은 본문만 코드에 맞게 패치 (강등 사유 아님 — 코드 실재 동작 반영).

## ⚠ 재분류 (2026-06-03 groom): decision-free 아님 → planner 결정 필요
- spec 약속 `JavaScript · 12 lines` 는 summaryTemplate DSL 로 **표현 불가**: (a) "12 lines" = `code` 의 줄 수인데 DSL `length` 는 **문자 수**만 지원(줄 세기 없음), (b) `language` enum 값은 소문자 `javascript` 인데 spec 은 title-case `JavaScript` — DSL 은 `upper`/`lower` 만 있고 title-case 없음.
- **결정 필요**: summaryTemplate DSL 확장(`lines` primitive + title-case 필터) vs 약속 downscope(예: `{{language|upper}}` 만). 패턴 sibling: `transform.schema.ts:228-232`. 위치: `nodes/data/code/code.schema.ts:109-131`.
