BLOCK: NO

# Consistency Check 통합 보고서 (--impl-done, 재확인)

대상 scope: `spec/2-navigation/4-integration.md` (PR #633).
검토 모드: `--impl-done`, diff-base origin/main. 검토 일시: 2026-06-19 14:28:49.
직전 세션 14_18_26 이후 delta: **주석(JSDoc/comment) only** — `IntegrationUsageNodeDto.id/.label/.type` 한국어 JSDoc 추가(W-3 해소) + e2e 주석 spec 경로 정정(I-5 해소). 런타임/spec-impl 의미 변화 없음.
전체 위험도: LOW (plan-coherence 가 spec-drift 를 MEDIUM 으로 표기하나 모두 project-planner 후속 대상, Critical 0).

## Critical 위배 (BLOCK 사유)
없음.

## WARNING (전부 spec-drift — 코드가 옳고 spec 이 낡음, project-planner 후속)

| # | Checker | 위배 | 위치 | 조치 |
| --- | --- | --- | --- | --- |
| W-1 | Cross-Spec / Plan-Coherence | §7.1 조회 조건·nodes shape 가 MCP 합집합·usageKind 미반영 | `spec/2-navigation/4-integration.md §7.1` | project-planner spec 갱신 |
| W-2 | Cross-Spec | INT-US-01 이 직접 참조만 명시, MCP 배제 오독 | `spec/4-nodes/4-integration/_product-overview.md INT-US-01` | project-planner |
| W-3 | Plan-Coherence | §7.2 삭제 다이얼로그 MCP 배지 요건 누락 (plan ⑥ 선행) | `spec/2-navigation/4-integration.md §7.2` | project-planner |

## 해소 확인 (직전 세션 대비)
- 직전 W-3(DTO JSDoc 누락) → 해소: id/label/type 한국어 JSDoc 추가됨 (swagger.md §1-1 충족).
- 직전 I-5(e2e 주석 spec 경로 오기) → 해소: `spec/2-navigation/4-integration.md §7` 로 정정됨.

## INFO
- §7.2 MCP 배지 UI 규칙·INT-US-02 (project-planner). usageKind enumName 미지정(선택). ⑤GIN/⑦이중findById = perf, spec 무관 (plan 추적). 신규 식별자 충돌 없음.

## Checker별 위험도
- Cross-Spec: LOW (spec-drift) · Rationale Continuity: NONE · Convention: PASS (W-3/I-5 해소, Critical 0) · Plan Coherence: MEDIUM (spec-drift, project-planner) · Naming Collision: NONE.

## 결론
- **BLOCK: NO** (Critical 0). 모든 WARNING 은 "코드가 앞서고 spec 이 낡은" spec-drift 로 project-planner 의 후속 spec 갱신 대상이며, developer(본 PR)의 차단 사유가 아니다. developer 즉시 수정 항목(W-3/I-5)은 모두 반영됨.
