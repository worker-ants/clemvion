# Plan 정합성 검토 결과

검토 모드: `--impl-done` (scope=`spec/5-system`, diff-base=`origin/main`)
검토 시각: 2026-06-11

---

## 발견사항

### [WARNING] `spec/5-system/1-auth.md §4.1` 이중 편집 — audit-coverage-naming 과 auth-config-audit 브랜치가 동일 섹션을 동시에 수정 중

- **target 위치**: `spec/5-system/1-auth.md §4.1 기록 대상 액션` — "현재 구현된 액션" 표의 `설정` 행
- **관련 plan**: `plan/in-progress/auth-config-webhook-followups.md §1` (worktree: `audit-coverage-naming`, branch `claude/auth-config-audit`)
- **상세**:
  - `audit-coverage-naming` 브랜치(commit `479da446`)는 §4.1 을 "구현됨 / Planned" 이중 테이블로 재구성하고 `auth_config.reveal` 만 "구현됨" 표에 등재했다.
  - 동일 worktree(`/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming`)가 현재 `claude/auth-config-audit` 브랜치로 체크아웃되어 있으며, 해당 브랜치(commit `ededbd9d`)는 §4.1 의 동일 셀에서 `auth_config.create/update/delete/regenerate` 4종을 "구현됨" 표로 이동시키는 변경을 담고 있다.
  - 즉 두 브랜치가 `spec/5-system/1-auth.md §4.1` 설정 행을 각자 다른 상태로 수정했다. `audit-coverage-naming`(이 review 를 트리거한 브랜치)이 먼저 병합되면 `claude/auth-config-audit` 는 merge conflict 없이 덮어쓸 수 있으나, 두 브랜치가 서로의 변경을 인지하지 못한 채 독립 편집 중인 상태다.
  - `claude/auth-config-audit` 에는 원격 tracking 브랜치가 없고 GitHub PR 도 없다 — 로컬 진행 중 미공개 브랜치.
- **제안**: `audit-coverage-naming` 이 main 에 병합된 후, `claude/auth-config-audit` 를 main 에 rebase 해 §4.1 내용이 두 변경을 모두 반영하는지 확인한다. 병합 순서가 명확하지 않으면 `auth-config-webhook-followups.md §1` 체크리스트에 "audit-coverage-naming 병합 완료 확인 후 rebase" 조건을 명시한다.

---

### [WARNING] `spec/5-system/1-auth.md §4.1` 상대 경로 불일치 — unified-model-mgmt-pr4 브랜치가 동일 문단을 편집

- **target 위치**: `spec/5-system/1-auth.md §4.1` Action naming 규약 단락 — `audit-action.const.ts` 링크
- **관련 plan**: `plan/in-progress/unified-model-management.md` (worktree: `unified-model-mgmt-5af7ee`, branch `claude/unified-model-mgmt-pr4`, GitHub PR #545 OPEN)
- **상세**:
  - `audit-coverage-naming` 브랜치는 `audit-action.const.ts` 링크를 `codebase/backend/...` (루트 상대) 로 기록했다.
  - `claude/unified-model-mgmt-pr4` 브랜치(PR #545 OPEN)는 동일 단락에서 동일 링크를 `../../codebase/backend/...` 으로 수정하는 변경을 담고 있다.
  - 두 변경은 동일 줄(`audit-action.const.ts` 링크 경로)을 서로 다른 값으로 수정한다 — 병합 시 conflict 또는 어느 한쪽이 소리 없이 덮어써질 수 있다.
  - 내용 충돌은 아니지만 경로 표기 일관성 관점에서 어느 쪽이 spec 내 상대경로 규약에 맞는지 한쪽이 결정·정렬해야 한다 (`spec/5-system/1-auth.md` 에서 `codebase/` 하위를 가리키는 상대경로는 `../../codebase/` 가 올바름).
- **제안**: `audit-coverage-naming` 병합 전 §4.1 링크를 `../../codebase/backend/src/modules/audit-logs/audit-action.const.ts` 로 수정해 PR #545 와 충돌을 방지한다. 또는 PR #545 가 먼저 병합되면 본 브랜치는 자동으로 올바른 경로를 상속한다.

---

### [INFO] `auth-config-webhook-followups.md §1` 체크리스트 — TEST WORKFLOW·/ai-review·--impl-done 미완료

- **target 위치**: (spec 변경에 간접 영향) `plan/in-progress/auth-config-webhook-followups.md §1` 체크리스트
- **관련 plan**: 동일 파일 §1 하단 체크리스트
- **상세**: `claude/auth-config-audit` 브랜치의 `auth-config-webhook-followups.md §1` 체크리스트에서 `TEST WORKFLOW (lint·unit·build ✓ / e2e 진행)`, `/ai-review + RESOLUTION`, `consistency-check --impl-done` 세 항목이 미완료 상태다. 이 브랜치는 `spec/5-system/1-auth.md §4.1` 와 `spec/data-flow/1-audit.md §1.1` 를 함께 수정하므로, `--impl-done` 검토가 완료되지 않은 상태에서 target(`audit-coverage-naming`)의 spec 변경이 동일 파일을 먼저 편집하면 후속 `--impl-done` 의 diff-base 가 달라진다.
- **제안**: `claude/auth-config-audit` 의 spec 변경이 `audit-coverage-naming` 병합 이후에도 의도대로 반영되는지 rebase 후 재확인하고, `--impl-done` consistency-check 를 신규 base 기준으로 재실행한다. plan 체크리스트에 이 조건을 기록한다.

---

### [INFO] `spec-code-cross-audit-2026-06-10.md` 잔여 위반(V-04·V-05·V-09~V-14·V-18) — target spec 에 미반영된 결정 대기 항목

- **target 위치**: `plan/in-progress/spec-code-cross-audit-2026-06-10.md §후속` 잔여 항목
- **관련 plan**: 동일 파일 `[ ] 잔여: V-04·V-05·V-09~V-14·V-18 (major/minor — 결정 대기)`
- **상세**: 이번 `audit-coverage-naming` 브랜치(G-01·G-02)는 `spec-code-cross-audit-2026-06-10.md §후속` 의 G-01/G-02 항목을 처리했다. 그러나 동일 plan 에 "결정 대기" 로 남은 위반 14건(major/minor)이 있으며, 이들 중 일부가 `spec/5-system` 영역과 교차할 경우 target spec 의 후속 변경을 요구할 수 있다. 현재 target 이 다루지 않는 영역이고 결정 대기 상태이므로 즉각적 충돌은 없으나, plan 이 열린 채로 유지되는 점을 추적한다.
- **제안**: `spec-code-cross-audit-2026-06-10.md` 의 잔여 결정을 순차적으로 처리할 때 `spec/5-system` 영역에 영향이 있는지 확인한다. 영향이 있으면 해당 plan 에 worktree 지정 후 작업한다.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

- `ai-node-override-fields` (branch `claude/ai-node-override-fields`) — Step 2 PR state: MERGED
- `auth-refresh-rotation-atomic` (branch `claude/auth-refresh-rotation-atomic`) — Step 2 PR state: MERGED
- `fix-model-configs-kind-400-88c8b4` (branch `claude/fix-model-configs-kind-400-88c8b4`) — Step 2 PR state: MERGED
- `prod-fail-closed-guards` (branch `claude/prod-fail-closed-guards`) — Step 2 PR state: MERGED
- `code-node-isolated-vm` (branch `claude/code-node-isolated-vm`) — Step 1·2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장. 단, `spec/5-system` 과 교차하는 변경 없음 — 충돌 위험 없음 확인.
- `fix-embedding-test-dimension-a3d42a` (branch `claude/fix-embedding-test-dimension-a3d42a`) — Step 1·2 모두 음성. active 로 처리. `spec/5-system` 교차 없음.

stale MERGED worktree 4건이 cleanup 되지 않고 남아 있다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`audit-coverage-naming` (G-01/G-02) 의 spec 변경은 `spec/5-system/1-auth.md §4.1` 을 "구현됨 / Planned" 구조로 재편하고 action naming 규약을 명시했다. plan 정합성 관점에서 두 개의 WARNING 이 발견됐다: (1) 동일 worktree 가 현재 `claude/auth-config-audit` 브랜치로 체크아웃되어 §4.1 설정 행에 대해 독립적인 편집(auth_config CRUD Planned→구현됨 이동)을 진행 중이다 — 병합 순서에 따라 한 변경이 다른 변경을 소리 없이 덮어쓸 위험. (2) OPEN PR #545(`unified-model-mgmt-pr4`)가 동일 단락의 링크 경로를 다른 값으로 수정하고 있어 merge conflict 잠재 위험이 있다. 두 WARNING 모두 내용 충돌은 아니지만 rebase/병합 시 주의가 필요하다. worktree 충돌 후보 8건 중 stale 4건 skip, active 4건 분석 (audit-coverage-naming 자신 포함).

---

## 위험도

MEDIUM
