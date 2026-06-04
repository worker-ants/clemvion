# Resolution — consistency-check --impl-done 3차 (post-sync, 2026-06-04 08:46:30)

사용자 지시("rebase하고 다시 체크")로 origin/main(+#455·#454·#458) 동기화 후 재실행.

## 결과: 이전 진짜 CRITICAL 해소 + 잔여는 전부 main-baseline FALSE POSITIVE

### ✅ 해소: cross-branch CRITICAL (2차 08_17_24 의 BLOCK 사유)

2차의 진짜 BLOCK 이던 `ai-context-memory-9c7e6e` cross-branch 충돌은 **동기화 후 사라짐** (#454 competitive-analysis 머지 + plan-coherence stale-worktree cascade 재평가). 3차 보고서에 미등장.

### ⚠ 잔여 BLOCK = main-baseline false positive (git 으로 전수 반증)

3차 CRITICAL/WARNING 은 **이미 내 branch HEAD 에 커밋된 수정**을 checker 가 `origin/main` 베이스라인과 비교해 "누락" 으로 오판한 것. 메모리 `reference_consistency_check_main_baseline_fp.md` 의 documented 패턴(커밋 후 재실행 → origin/main 비교 false Critical, **merge 전까지 재실행으로 안 풀림**).

| checker 주장 | 실제 (HEAD, git 반증) |
|---|---|
| CRITICAL#1: `code:` 에 신규 가드 4건+spec-links 누락 | **HEAD `code:` 11개 엔트리 전부 존재** (origin/main 6 vs HEAD 11). commit 7b2a65de·cd9dffe5 |
| WARNING#2: Rationale R-8 부재 | **R-8(L234)·R-9(L242) 존재** (cd9dffe5) |
| WARNING#3: §4 소섹션 미분리 | **§4.1·§4.2 분리 완료** (cd9dffe5) |
| WARNING#1: §4 "(4건)" 오표기 | §4 = frontmatter-evidence **정확히 4건**; §4.2 가 나머지 family |
| Plan Coherence #7/#8: spec-drift-gates §C/§D `[ ]` 미갱신 | **§C/§D `[x]` "적용 완료" 표기** (L42·44·53·55, commit 7b2a65de) |
| WARNING#6 / INFO#4: plan-lifecycle 에 spec_impact/sentinel 부재 | **§4 sentinel + spec_impact 포인터, §5 Gate C 정의 존재** |

반증 명령: `git show origin/main:spec/conventions/spec-impl-evidence.md | grep -c __tests__` → 6, vs HEAD → 11.

### 진짜 잔여 (non-blocking, 후속)

- Cross-Spec #4/#5: PROJECT.md §자동 가드 목록 + doc-sync-matrix.json 에 신규 가드 미등재 — **실제 미반영**. 단 spec-impl-evidence §6 Rollout step 4 의 후속이고 build 차단 아님. 후속 task 로 처리 권장(별도 PR 또는 머지 후).
- INFO: repoRoot 중복, spec-links.ts 명명 — 향후 리팩토링 optional.

## 결론

re-check 결과 **실제 차단 사유 없음** — cross-branch 는 동기화로 해소, 나머지는 git-proven main-baseline FP(merge 전 재실행 불가해소). 가드가 명시 허용하는 `BYPASS_REVIEW_GUARD=1` (문서/spec-only 오판 케이스) 로 push. 3회 ai-review(CRITICAL=0) + 2회 실질 consistency 정리 완료.
