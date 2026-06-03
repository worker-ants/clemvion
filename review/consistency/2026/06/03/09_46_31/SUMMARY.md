# Consistency Check 통합 보고서 (spec draft — channel-web-chat gaps, 재검토)

**BLOCK: YES** — Critical 2건. 모두 **타 활성 worktree 와 동일 파일 동시수정 충돌**(설계 내용은 충돌 없음).

## Critical (BLOCK) — cross-worktree 경합
| # | Checker | 충돌 파일 | 충돌 brꞏanch | 제안 |
|---|---|---|---|---|
| 1 | Plan Coherence | `spec/conventions/spec-impl-evidence.md` (W3) | `claude/spec-sync-audit` (§2.1·§3·§4.1·Rationale 수정 중) | 해당 PR 먼저 머지 후 리베이스, 또는 W3 de-scope |
| 2 | Plan Coherence | `codebase/backend/.env.example` (W5) | `claude/system-status-recent-failed-86831b` (말미 env 추가 중) | 해당 PR 먼저 머지 후 리베이스, 또는 W5 .env.example de-scope |

## Warning (설계 다듬기 — spec 반영 시 흡수)
- `blocked` enum 을 4-security §3-① 에 공식 inline 추가 + 1-widget-app §2 다이어그램과 원자 변경
- `2-sdk` blocked/hidden-open-무효 노트를 §R4 대신 §1/§5 또는 1-widget-app 다이어그램 주석으로
- W3 역할 분리(spec 텍스트=planner / parse.ts=developer) 명시
- `_product-overview.md` 제외 근거는 "underscore prefix" 만으로(spec/6 비교 삭제)
- followups §4 [연관] 완료 처리 + 1-widget-app pending_plans 갱신

## INFO
4-security §2.1 에 env 키 SoT 병기, spec-impl-evidence §1 Rationale 1줄(채널 영역 표면 보유→대상 확장), EIA replay_unavailable TODO cross-ref.

## Checker별 위험도
Cross-Spec MEDIUM / Rationale NONE / Convention LOW / Plan **HIGH(Critical 2)** / Naming NONE.

## 조치 방침
Critical 2건은 파일-레벨 cross-worktree 경합 → 사용자 결정(머지 순서 vs de-scope). de-scope 시 충돌 파일 미접촉으로 Critical 제거. 설계 Warning/INFO 는 spec 반영 시 흡수.
