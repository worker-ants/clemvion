# Consistency Check 통합 보고서

**BLOCK: YES (false positive — 진행)**

검토 대상: `plan/in-progress/spec-draft-cafe24-public-dup-guard.md`
모드: `--spec` (spec draft 검토)
세션: `review/consistency/2026/05/16/15_48_50/`

---

## 전체 위험도

**MEDIUM** — Critical 2건 모두 stale plan 파일에 기반한 false positive (관련 PR 이 이미 main 에 merged). 의미 있는 Warning 9건은 draft 에 반영.

## Critical 위배 분석

| # | Checker | 위배 | 실제 상태 |
|---|---------|------|----------|
| 1 | Plan Coherence | `cafe24-app-url-reuse-f9a2e3` / `prod-rereview-fix-a7c93f` 가 Rationale 말미 동시 수정 중 | **false positive** — PR #39 (`cafe24-app-url-reuse`) 는 commit `a70c5762` 로 main merged. `prod-rereview-fix-a7c93f` worktree 는 `git worktree list` 에 부재 (stale plan note 만 잔존). 본 branch 는 origin/main rebase 완료 |
| 2 | Plan Coherence | `cafe24-pending-polish-7fdb7e` / `cafe24-app-url-reuse-f9a2e3` 가 §9.2 동시 수정 중 | **false positive** — PR #18 (`cafe24-pending-polish`) 는 commit `ee767bbf` 로 main merged. PR #39 동상 |

Plan Coherence checker 가 `git log`/`worktree list` 를 보지 않고 plan 파일만 읽는 한계로, 완료됐지만 `complete/` 로 이동되지 않은 stale plan 들이 active work 로 잡혔다. 본 branch 는 origin/main rebase 로 이미 동기화돼 있어 실제 충돌은 없음.

## Warning 처리 (draft 보강)

| # | Checker | 위배 | draft 반영 |
|---|---------|------|----------|
| W1 | Cross-Spec | begin 행 Public/Private 가드 조건 비대칭 혼재 | 변경 1 의 ※ 문구를 Public/Private/기타 status 3단계로 분리 서술 |
| W2 | Cross-Spec | precheck 응답 ID 노출 범위 미명시 | 변경 2 행에 "current workspace (X-Workspace-Id 헤더) 소속만 노출, cross-workspace 접근 경로 아님" 명시 |
| W3 | Cross-Spec | throttle 60/min vs 일반 API rate limit 정합 | 변경 2 행에 "이 endpoint 전용 상한, 일반 rate limit 위에 더해지지 않고 본 값으로 대체" 명시 |
| W4 | Rationale Continuity | O(N) 폐기 vs 회복 분기 공존 관계 미서술 | Rationale "precheck endpoint" 항에 "O(N) 폐기와의 관계" 소절 추가 |
| W5 | Rationale Continuity | 코드명 유지 기각 근거 미서술 | Rationale 신설 항목 "CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드명 유지 결정" 추가 (3개 사유) |
| W6 | Convention Compliance | precheck DTO 래퍼 미명시 | 변경 2 행에 "응답 DTO: Cafe24PrecheckResultDto (ApiOkWrappedResponse 래퍼)" 명시 |
| W7 | Convention Compliance | 에러 코드 명명 규약 예외 미등록 | Rationale 신설 항목에 "의미 기반 명명 선례 예외" 공식 등록 |
| W8 | Plan Coherence | rename 기각 결정이 spec-draft 단독 독자에게 미전달 | 변경 3 상단에 "rename 기각 (2026-05-16 사용자 지시)" 한 줄 추가 |
| W9 | Plan Coherence | §9.4 가 cafe24-pending-polish 와 의미 중복 | PR #18 main merged 확인, 실제 충돌 없음 (직렬화 조건 절에 명시) |

## INFO 처리

대부분 보강에 자연스럽게 흡수됨. 다음 항목은 후속 plan 으로 위임:

- INFO 3: `spec/data-flow/5-integration.md` 의 precheck SELECT 흐름 기술 — read-only endpoint 일관 패턴화 시점에 일괄 갱신.
- INFO 9: spec-draft 와 spec-update 두 plan 파일 통합 — 본 PR 완료 후 spec-update note 가 더 이상 필요 없으면 `complete/` 로 이동하며 자연 정리.

## 진행 판단

Critical 2건 모두 verifiable false positive 이며 draft 의 "직렬화 조건" 절에 사유를 명시. Warning 9건은 draft 에 모두 반영. **spec 본문 적용 진행**.
