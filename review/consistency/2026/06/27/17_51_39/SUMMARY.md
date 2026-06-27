# Consistency Check 통합 보고서 (--impl-done, scope=spec/5-system/)

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 5개 checker 전원 LOW. Critical 0건, Warning 3건(전부 본 변경과 무관한 pre-existing), Info 4건.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING) — 전부 mc-cfg-polish 와 무관한 pre-existing (scope 스캔이 우연히 노출)

| # | Checker | 위배 | target | 처리 |
|---|---------|------|--------|------|
| 1 | Convention | `10-graph-rag.md:25` 자기 참조 링크 `[PRD Graph RAG](./10-graph-rag.md)` | `spec/5-system/10-graph-rag.md` | **out-of-scope** — graph-rag 도메인 이슈, 별 planner 트랙 |
| 2 | Convention | `10-graph-rag.md` 이중 개요(`## Overview` + `## 1. 개요`) | `spec/5-system/10-graph-rag.md` | **out-of-scope** — 별 planner 트랙 |
| 3 | Plan Coherence | `security-backlog-invitation-token-hash.md` plan 이 §1.5.D "raw 유지" 확정 미반영 | `plan/in-progress/security-backlog-invitation-token-hash.md` | **out-of-scope** — invitation-token-hash 트랙, 별 처리 |

> 위 3건은 모두 본 PR 이 만지지 않은 파일이며 throttle/cap/enum 변경과 무관하다. 본 PR 에 끌어들이면 scope 위반(무관 변경)이므로 별 트랙으로 남긴다. BLOCK NO.

## 참고 (INFO)

| # | Checker | 항목 | 처리 |
|---|---------|------|------|
| 1 | Cross-Spec/Naming | §7 probe행(`PROVIDER_PROBE_THROTTLE`만) vs invitation행(`SENSITIVE_ACTION_THROTTLE(별칭…)`) 표기 깊이 비대칭 | 선택적 — BLOCK NO. running fresh review 무효화 회피 위해 본 라운드 미수정(필요 시 후속) |
| 2 | Cross/Rationale/Naming | `1-auth.md §1.5.1`·`data-flow/12-workspace.md §1.2` 가 `INVITATION_THROTTLE` 를 독립 상수로 취급, 공유 alias 미반영 | 선택적 — 수치 일치, 즉각 수정 불요 |
| 3 | Plan Coherence | `rag-rerank-followup.md` model-config 통합 대체 | out-of-scope, 별 트랙 |
| 4 | Plan Coherence | `14-external-interaction-api.md` console.warn stale | out-of-scope, 별 트랙 |

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | LOW | throttle 표기 깊이 비일관(INFO), 기능 충돌 0 |
| Rationale Continuity | LOW | 명명 계층 비대칭(INFO), 기각 결정 재도입 0 |
| Convention Compliance | LOW | 10-graph-rag pre-existing 2건(무관), Critical 0 |
| Plan Coherence | LOW | security-backlog plan pre-existing(무관) |
| Naming Collision | LOW | 신규 식별자 실제 충돌 0 |

## 결론

본 mc-cfg-polish 변경에 대한 spec↔code 정합 위배 **없음**. WARNING 3건은 전부 무관한 pre-existing 으로 별 트랙. **BLOCK: NO** — push 가능.
