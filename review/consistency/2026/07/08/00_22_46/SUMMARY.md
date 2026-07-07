# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전수 확보(cross_spec·convention_compliance 는 FS-write flakiness 로 최초 미생성 → main 에서 최종 상태 기준 재실행). **Critical 0건.**

## 전체 위험도
**LOW** — Critical 없음. Warning 은 (a) 본 PR §2 편집으로 정정 가능한 것 + (b) 본 diff 밖 선행 드리프트로 분류.

## Critical 위배 (BLOCK 사유)
없음.

## 경고 (WARNING) — 처리 내역

| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| 1 | plan_coherence | §2 `05-run-and-debug/` 4개 나열(실제 5개, `validation-errors` 누락) | **FIXED** — 행 추가(order 5 → version-history 뒤 배치) |
| 2 | plan_coherence(INFO) | §2 `06-integrations/` 11개 나열(실제 12개, `web-chat-sdk` 누락) | **FIXED** — 행 추가 |
| 3 | convention_compliance | `connecting-nodes.mdx` summary 프론트매터에 금지어 "엣지"(본문은 "연결선") | **FIXED** — "연결선 색상"으로 정정 |
| 4 | convention_compliance | 영역 수 불일치: overview "다섯 영역"(5) vs 본 PR spec 주석 "4영역" vs connecting-nodes "4개 작업 영역" | **FIXED** — spec 주석·connecting-nodes 참조에서 숫자 제거("화면 구성"), overview 의 5영역 열거를 SoT 로 |
| 5 | convention_compliance | 신규 §2 행(validation-errors/web-chat-sdk) 위치가 order 와 어긋남 | **PARTIAL** — validation-errors(05)는 order대로 재배치. web-chat-sdk(06)는 06 서브트리가 이미 topical(선행 order 드리프트, 아래 참고)이라 그 컨벤션에 맞춰 topical 배치 유지 |
| 6 | cross_spec | `spec/2-navigation/_product-overview.md §3.11 NAV-UG-02` 가 가이드 섹션을 6개로 열거(현 IA 8섹션 — `03-workflow-editor`·`07-workspace-and-team` 누락) | **DEFERRED** — 본 diff 밖 선행 드리프트(섹션은 이전부터 존재, 본 PR은 페이지만 추가). PR 본문에 후속으로 명시 |

## 참고 (INFO) — 조치 불필요/선행

- rationale_continuity: "AI Agent Tool Area" 재도입이 `d7d920ef1`에 있었으나 `aaacb1701`에서 즉시 정정 — HEAD 정합 확인.
- rationale_continuity: 모바일 breakpoint 예외(R-1) 양방향 정합(모범).
- naming_collision: `03-workflow-editor/overview.mdx` ↔ `02-nodes/overview.mdx` 동일 파일명이나 registry 가 `<section>/<slug>` 로 식별 → 충돌 없음.
- convention_compliance: `06-integrations` 선행 order 중복/역전(`mcp-servers`·`cafe24` 모두 order:5 등) — 본 PR 무관 선행 드리프트, 미조치.
- convention_compliance: `ai-assistant-walkthrough.mdx` 가 "## 다음으로" 헤딩 사용(선행, 리네임만 함) — 미조치.

## Checker별 (전수 확보 후)

| Checker | Critical | 비고 |
|---------|----------|------|
| cross_spec | 0 | NAV-UG-02 선행 드리프트 1 Warning |
| rationale_continuity | 0 | Tool Area 자체 교정 확인 |
| convention_compliance | 0 | 영역 수·엣지·order 위치 3 Warning(정정) |
| plan_coherence | 0 | IA §2 누락 2건(정정) |
| naming_collision | 0 | 재편 슬러그·DOCS 키·order 충돌 없음 |

## 결론
BLOCK: NO. 정정 가능한 Warning 전부 본 PR에서 해소. 선행 드리프트(NAV-UG-02, 06 order 중복)는 PR 본문에 후속으로 명시.
