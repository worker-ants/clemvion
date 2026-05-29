# Consistency Check 통합 보고서

BLOCK: NO

검토 대상: `plan/in-progress/spec-fix-isactive-drawer-toggle.md` (--spec)
시점: 2026-05-29 08:45:29
(consistency-summary sub-agent 가 worktree write 차단으로 inline 반환 → main 이 대리 기록)

## 전체 위험도: LOW

5개 checker 전원 성공, Critical 0건. WARNING 3건 / INFO 7건 — 모두 plan 문서 형식·추적성 개선 또는 spec 반영 시 서술 보강 권고이며, 핵심 결정(drawer read-only 배지 + ⋮ 행 액션 단일 편집 경로)을 차단하지 않음.

## Critical (BLOCK): 없음

## WARNING
1. (convention) frontmatter 비표준 필드 `source` — 제거 권장 (본문 `## 원본 발견사항` 중복).
2. (convention) 실행 단계 산문 서술 — 완료 시 `[x]` + `plan/complete/` 이동, 미완 시 `[ ]`.
3. (plan_coherence) `trigger-drawer-tests.md` isActive 케이스 후속 영향 누락 — 단, drawer 는 이미 read-only 배지로 shipping 되어 테스트도 동반 작성됐을 가능성 높아 실제 영향 낮음.

## INFO
- R-16 번호가 `spec/6-brand.md:487` 에도 존재하나 파일별 독립 번호 컨벤션상 허용 (2-trigger-list.md 는 R-15 까지). 제목·앵커로 구분.
- R-4 Rationale 이 §2.3.1 isActive 행을 직접 참조 → spec 반영 시 R-4 보완 권장.
- R-16 spec 미반영은 plan 미착수 정상 상태 (이번 반영으로 해소).
- 제목 `Draft` 잔류 / `## 영향 범위` 기각 Option A 잔류 — 정리 권장.
- frontmatter worktree slug stale (PR #268 머지) — 실작업은 별 worktree, 충돌 없음.

## 반영한 권고
- §2.3.1 isActive 행 변경 + R-16 신설 (Option A 기각 사유·§2.1 관계·정정 맥락 포함).
- R-4 본문에 "drawer read-only 배지 + 편집은 §2.1 ⋮ 행 액션 (R-16)" 보충.
- plan: `source` frontmatter 제거 / 제목 `Draft` 제거 / 실행 항목 `[x]` + complete 이동.

## Checker별
| Checker | 위험도 |
|---|---|
| Cross-Spec | LOW |
| Rationale Continuity | LOW |
| Convention Compliance | LOW |
| Plan Coherence | LOW |
| Naming Collision | NONE |
