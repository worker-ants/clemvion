# Consistency Check 통합 보고서 (--spec) — G1 철회 / engine §11 stale WS start gate 정정

**BLOCK: NO** — Critical 0. WARNING 2건 모두 조치(draft `## Rationale` 추가 + dangling pending_plans 를 변경 5 로 흡수).

- 모드: `--spec` · target `plan/in-progress/spec-draft-g1-withdraw-ws-start-gate.md`
- 세션: `review/consistency/2026/07/05/11_10_25` · checker 5/5 성공 (직접 Agent fan-out)

## 전체 위험도: LOW

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| cross_spec | NONE | 전 인용(6-websocket §4.2 Planned·3-execution §8.2 REST-only·§11 stale·api-convention §10.3) line 대조 정확. 충돌 없음 |
| rationale_continuity | NONE | 6-websocket-protocol.md Rationale 의 "Planned 보존" 결정을 그대로 계승, 번복/기각대안 재도입 없음. INFO 2(spec_impact 부기·§11 Phase 1/2 wording — 비차단) |
| convention_compliance | LOW | 인용 line·`_(계획·미구현)_` 포맷·anchor slug 정확. **WARNING: draft `## Rationale` heading 누락** → 추가 조치함 |
| plan_coherence | LOW | G1 철회는 "필요성 평가"(2026-07-05) 이행. G2 BLOCKED·frontmatter status:partial 정합. **WARNING: dangling `pending_plans`(spec-sync-execution-engine-gaps.md, complete 로 이동)** → 변경 5 로 제거 |
| naming_collision | NONE | 신규 식별자 0. INFO(`[~]`/WITHDRAWN 미등록) → 표준 마커 유지로 회피 |

## Critical / Warning

- Critical: 없음.
- WARNING #1 (convention): draft `## Rationale` 누락 → **추가 완료**.
- WARNING #2 (plan_coherence): engine frontmatter dangling pending_plans → **변경 5 로 제거**.

## 판정

BLOCK: NO → spec 반영 진행(변경 1~5).
