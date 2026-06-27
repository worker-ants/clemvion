# Consistency Check 통합 보고서 (--spec, nav-spec-doc-fix)

**BLOCK: NO** — Critical 발견 없음.

## 전체 위험도
**LOW** — 실제 spec 편집(§2.5/§2.6 swap·§2.1 주석)은 전부 안전(anchor·cross-ref·Rationale 충돌 0). WARNING 1·INFO 3 은 plan-note 위생/추적 권고.

## Critical 위배
없음.

## 경고 (WARNING)

| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| 1 | Plan Coherence | swagger double-wrap 버그(별도 발견)를 plan/in-progress 추적 미등록 | **RESOLVED** — `plan/in-progress/swagger-double-wrap-fix.md` 신설 |

## 참고 (INFO)

| # | Checker | 항목 | 처리 |
|---|---------|------|------|
| 1 | Convention | plan note 항목 prose → 체크박스 | **APPLIED** — `## 체크리스트` 추가 |
| 2 | Plan Coherence | `security-backlog-invitation-token-hash` §1.5.D raw 유지 미반영 | 별 트랙 — PR 후 안내(본 PR scope 아님) |
| 3 | Plan Coherence | `10-graph-rag.md` 결함 untracked | 별 트랙 — PR 후 안내 |

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | NONE | anchor·API 계약·요구사항 ID·RBAC 전부 안전 |
| Rationale Continuity | NONE | §2.5/§2.6 swap·§5 FALSE POSITIVE·§2.1 주석 충돌 없음 |
| Convention Compliance | LOW | frontmatter 통과. INFO: 체크박스(해소) |
| Plan Coherence | LOW | WARNING(swagger 추적, 해소) + INFO 2(deferred 안내) |
| Naming Collision | NONE | 신규 식별자 없음 |

## 결론

실제 nav-spec 편집은 정합. **BLOCK: NO**. swagger double-wrap 추적 plan 신설로 WARNING 해소.
