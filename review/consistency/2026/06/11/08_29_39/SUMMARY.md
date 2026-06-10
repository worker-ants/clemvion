# Consistency Check 통합 보고서 (--impl-done, scope=spec/2-navigation/)

**BLOCK: NO** — Critical 발견 없음. 병합 차단 불필요.

## 전체 위험도
**MEDIUM** — spec 내부 불일치(makeshop catalog 기술 잔존)와 병렬 worktree 충돌 위험이 있으나, **이번 PR 자체의 구현은 기존 spec/convention 과 완전히 정합**하며 신규 Critical 위반 없음.

## Critical 위배
_없음_

## 경고 (WARNING)

| # | Checker | 위배 | 처분 |
|---|---------|------|------|
| 1 | Rationale Continuity | `spec/2-navigation/4-integration.md` makeshop api_label catalog 정책 본문 §4.6·§9.3 미갱신 내부 불일치 | **본 PR 무관** — rebase 아티팩트(INFO #5). 본 worktree 커밋은 4-integration.md 미수정. 별건(makeshop) 사안. |
| 2 | Plan Coherence | active worktree `unified-model-mgmt-5af7ee` 가 §2.4.1 배너·R-3 (본 PR SoT) 삭제 diff 보유 — 먼저 병합되면 spec 근거 소멸 | **병합순서 조율 사안**(사용자 surface). unified-model-mgmt plan 이 `kb-model-change-reembed-followup.md` 의존을 명시하므로 협조 가능. 본 PR 차단 사유 아님. |

## 참고 (INFO)

| # | Checker | 항목 | 처분 |
|---|---------|------|------|
| 1 | Convention | `14-execution-history.md` Rationale 누락 | pre-existing, 본 PR 무관 |
| 2 | Convention | `0-dashboard.md` 헤딩 비표준 | pre-existing, 본 PR 무관 |
| 3 | Rationale | makeshop 정책 SoT 불명확 | WARNING #1 과 동일 — 별건 |
| 4 | Naming | 4-integration.md makeshop 잔존은 pre-existing | 본 브랜치 신규 아님 |
| 5 | Plan | **4-integration.md diff 는 origin/main rebase 아티팩트** — 본 PR 의도 변경 아님 | **`git rebase origin/main` 로 해소** ✅ |
| 6 | Plan | stale worktree 6건 잔존 | 별도 정리 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | NONE | 데이터 모델·API 계약(POST /re-embed 재사용)·상태머신·RBAC(editor+)·계층(frontend-only) 모두 기존 spec 과 완전 일치 |
| Rationale Continuity | MEDIUM | makeshop 정책(본 PR 무관, rebase 아티팩트) |
| Convention Compliance | NONE | 본 diff 명명·포맷·에러코드·API 규약 무위반 |
| Plan Coherence | MEDIUM | unified-model-mgmt 병합순서(조율 사안), 4-integration rebase 아티팩트 |
| Naming Collision | NONE | 신규 식별자 5건(UnsearchableBanner·unsearchable-banner.tsx·reembedNow·unsearchableBannerIdleDesc·InProgressDesc) 충돌 없음 |

---

## 호출자(main Claude) 사후 판정 — 2026-06-11

**BLOCK: NO 확정.** 본 PR 의 배너 구현은 Cross-Spec·Convention·Naming 전부 정합(NONE). WARNING/INFO 는 전부 **(a) 본 PR 무관 별건(makeshop 4-integration.md)**, **(b) origin/main 전진에 따른 rebase 아티팩트**, **(c) 병렬 worktree 병합순서 조율** 로 분류 — 신규 Critical 0.

조치:
1. ✅ **`git rebase origin/main`** 수행 — 4-integration.md rebase 아티팩트 제거 + 최신 main 수용.
2. ⚠️ **병합순서 surface**: `unified-model-mgmt-5af7ee` worktree 가 본 PR SoT(§2.4.1·R-3) 삭제 diff 보유. 본 PR 을 먼저 병합하거나, unified-model-mgmt 가 §2.4.1·R-3 보존하도록 사용자 조율 필요. (그쪽 plan 이 본 followup 에 의존하므로 협조 가능)
3. lifecycle 졸업(5-knowledge-base implemented·plan complete/ 이동) 진행.
