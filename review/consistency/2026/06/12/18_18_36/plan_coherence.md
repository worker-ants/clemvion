# Plan 정합성 검토 결과

검토 대상: `spec/conventions/` (구현 완료 후 검토 — `--impl-done`, diff-base=`origin/main`)

변경 파일:
- `spec/conventions/cafe24-api-catalog/_overview.md` — §7.3 응답 래퍼 ↔ 요청 파라미터 충돌 회귀 검증 레시피 추가
- `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — `order` 래퍼 행 설명 수정 ("정렬 순서 asc…" → "(응답 객체)")
- `spec/conventions/cafe24-api-catalog/_generator.py` — 컨테이너(obj/arr) 필드의 req/global/variant cross-map fallback 제외 버그픽스

---

## 발견사항

### [INFO] cafe24-backlog-residual G-1-remaining — 생성기 버그픽스와의 관계 명시 권장

- target 위치: `spec/conventions/cafe24-api-catalog/_overview.md §7.3`, `application/appstore-orders.md`
- 관련 plan: `plan/in-progress/cafe24-backlog-residual.md §G-1-remaining`
- 상세: G-1-remaining 은 field-level 카탈로그(`cafe24-api-catalog/<resource>/<entity>.md`)를 "docs-side SoT" 로 삼아 backend metadata field-set 갭 보강을 진행할 예정이다. 이번 변경은 생성기(`_generator.py`)의 컨테이너/스칼라 cross-map fallback 버그를 수정하고, `appstore-orders.md` 의 잘못된 `order` 래퍼 설명을 정정했다. G-1-remaining 이 `appstore-orders.md` 를 field 갭 보강의 참조 SoT 로 사용할 경우, 수정 전 오염된 설명("정렬 순서 asc…")이 포함된 버전을 참조했을 수 있다. G-1-remaining 착수 시 본 수정이 병합된 이후의 카탈로그를 기준으로 삼아야 한다는 점을 plan 노트에 추가해 두면 추적성이 향상된다. **이번 변경 자체가 G-1-remaining 과 충돌하거나 선행 조건을 위반하지는 않는다** — 단순 데이터 정확성 개선이라 G-1-remaining 진행을 unblock 하는 방향이다.
- 제안: `cafe24-backlog-residual.md §G-1-remaining` 에 짧은 노트 추가 권장 (예: "field-level 카탈로그는 PR #[본 PR] 에서 컨테이너 래퍼 설명 오염 버그 수정됨 — 보강 착수 시 최신 main 기준으로 진행할 것"). 필수는 아니며 차단 사유 없음.

---

### [INFO] fix-spec-frontmatter-catalog — plan/complete/ 이동 정합

- target 위치: `plan/complete/fix-spec-frontmatter-catalog.md` (신규, diff에서 확인)
- 관련 plan: `plan/in-progress/fix-spec-frontmatter-catalog.md`
- 상세: 현재 worktree diff 에서 `plan/complete/fix-spec-frontmatter-catalog.md` 가 신규 생성되고 있다. `in-progress/` 의 해당 파일은 모든 체크박스가 `[x]` 로 완료 표시되어 있으며, plan-lifecycle 규약에 따라 `complete/` 이동이 적절하다. 단, diff 에서 `plan/in-progress/fix-spec-frontmatter-catalog.md` 의 삭제가 포함되어 있는지는 확인되지 않았다. plan-lifecycle 상 `in-progress/` 원본도 함께 제거해야 완전한 이동이다.
- 제안: PR merge 전 `plan/in-progress/fix-spec-frontmatter-catalog.md` 가 삭제(또는 `complete/` 에 통합)되었는지 확인. 양쪽이 동시에 존재하면 중복 추적 혼란 우려.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 검토:

target 이 수정하는 파일: `spec/conventions/cafe24-api-catalog/_overview.md`, `spec/conventions/cafe24-api-catalog/application/appstore-orders.md`, `spec/conventions/cafe24-api-catalog/_generator.py`.

관련 plan 의 worktree 필드:
- `cafe24-backlog-residual.md` — `worktree: cafe24-backlog-residual-batch`
- `fix-spec-frontmatter-catalog.md` — `worktree: fix-spec-frontmatter-catalog`

**Stale 판정 cascade:**

- `cafe24-backlog-residual-batch`:
  - Step 1: `git merge-base --is-ancestor cafe24-backlog-residual-batch origin/main` — 브랜치가 로컬/원격 모두 존재하지 않음 (exit 1, "ACTIVE_or_NOTFOUND").
  - Step 2: `gh pr list --state all --head cafe24-backlog-residual-batch` — 결과 empty (PR 없음).
  - Step 3: Fallback — active 로 처리. 단 `.claude/worktrees/` 에 실제 체크아웃된 worktree 디렉토리가 없고 브랜치 자체가 부재하므로 물리적 경합 위험은 없다. stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장.

- `fix-spec-frontmatter-catalog`:
  - Step 1: `git merge-base --is-ancestor fix-spec-frontmatter-catalog origin/main` — 브랜치 부재 (exit 1).
  - Step 2: `gh pr list --state all --head fix-spec-frontmatter-catalog` — 결과 empty (PR 없음).
  - Step 3: Fallback — active 로 처리. 동일하게 물리적 worktree 없음. stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장.

**충돌 결론**: `cafe24-backlog-residual-batch` 는 `_overview.md` 를 참조하지만 `spec/conventions/cafe24-api-catalog/<resource>/<entity>.md` 의 field-set 을 건드리는 것이 목적이라, 현재 target 의 generator/overview 수정과 동일 파일을 **동시 편집**하는 상황이 아니다 (G-1-remaining 은 backend metadata `.ts` 파일이 주 대상). `fix-spec-frontmatter-catalog` 는 이번 worktree 에서 `complete/` 이동되고 있어 종결 중. CRITICAL 분류 기준 미충족.

---

## 요약

target 변경(`spec/conventions/cafe24-api-catalog/` generator 버그픽스 + `appstore-orders.md` 래퍼 설명 수정 + `_overview.md` §7.3 회귀 검증 레시피 추가)은 진행 중인 plan 과 구조적 충돌이 없다. `cafe24-backlog-residual.md` 의 G-1-remaining 이 동일 파일들을 SoT 로 사용하지만, 이번 변경은 그 작업의 전제 데이터 정확성을 개선하는 방향이며 G-1-remaining 의 착수·진행 방식에 간섭하지 않는다. `fix-spec-frontmatter-catalog` plan 은 본 worktree 에서 완료 처리되고 있어 정합하다. 유일한 실행 권고는 `in-progress/fix-spec-frontmatter-catalog.md` 삭제 확인(plan-lifecycle 규약)과 G-1-remaining 착수 시 최신 main 기준 사용 권장 메모다. worktree 충돌 후보 2건 모두 물리 브랜치 부재로 실제 경합 없음 — stale 판정 cascade Step 1/2 음성(브랜치 자체 부재), Step 3 fallback active 처리.

### 위험도

NONE
