# Plan 정합성 검토 결과

## 검토 대상
- target plan: `plan/in-progress/spec-update-trigger-schedule-sync.md` (worktree: `trigger-schedule-sync-f88604`)
- 검토 모드: spec draft (--spec)

---

## 발견사항

### [WARNING] `spec/2-navigation/3-schedule.md §3.1` — 선행 worktree 가 이미 "갭 표기 삽입" 상태

- target 위치: 갱신 대상 3 (`spec/2-navigation/3-schedule.md §3.1`, before/after 모두 기술됨)
- 관련 plan: `plan/in-progress/trigger-schedule-reverse-sync.md` 체크리스트 마지막 항목 (spec 갭 표기 해소)
- 상세: commit `8beb1742`(`docs(spec,plan): impl-prep BLOCK 해소`)가 이미 `spec/2-navigation/3-schedule.md §3.1` 에 "미구현 — 구현 갭" 텍스트와 BullMQ removeJob 누락 구현 갭 문구를 삽입했다. 이 커밋은 `trigger-schedule-sync-f88604` 브랜치 위에 존재하며, target plan 의 "Before" 문자열과 정확히 일치한다. 즉 target plan 이 제거하려는 갭 표기는 target 자신의 브랜치가 앞선 커밋에서 의도적으로 삽입한 것이다 — 정합성 차원에서 순서가 맞다.
- 제안: 정합. 이 항목은 문제 없음. impl-prep 단계(갭 표기 삽입) → 구현(59231fd7/2838fcc0) → 본 spec-update(갭 제거)의 올바른 3단계 순서다.

### [CRITICAL] `spec/1-data-model.md §2.9.1` 및 `spec/data-flow/10-triggers.md §1.4` — PR #518 (`refactor-backlog-format`) 과 동일 라인 충돌

- target 위치: 갱신 대상 1 (`spec/1-data-model.md §2.9.1` 줄 257 부근) 및 갱신 대상 2 (`spec/data-flow/10-triggers.md §1.4` 표 행 및 blockquote)
- 관련 plan: `plan/in-progress/` — `refactor-backlog-format` 브랜치(PR #518 OPEN)가 `spec/1-data-model.md` §2.9.1 행을 `"역방향도 동일"` → `"역방향 Trigger→Schedule 동기화는 **미구현 — 구현 갭**"` 으로, `spec/data-flow/10-triggers.md §1.4` 표를 `"역방향 동일"` → `"역방향 미구현 (구현 갭, 아래)"` 로, 그리고 §1.4 에 구현 갭 blockquote 를 삽입하는 변경을 포함하고 있다.
- 상세: `git diff main...refactor-backlog-format` 결과, PR #518 은 이 두 파일의 §2.9.1·§1.4 영역을 동시에 수정한다. 해당 변경은 PR #518 의 base commit (`79f1d849`) 당시 스냅샷을 반영한 것으로, 그 시점 이후 main 이 이미 `"역방향도 동일"` 텍스트를 포함하는 방향으로 업데이트됐으나 PR #518 은 rebasing 되지 않아 과거 갭 텍스트를 담고 있다.
  - 만약 PR #518 이 먼저 머지되면: `spec/1-data-model.md §2.9.1` 과 `spec/data-flow/10-triggers.md §1.4·§3.1` 이 다시 "미구현 — 구현 갭" 상태로 되돌아가므로, 뒤따르는 target plan 의 before 텍스트가 달라져 patch 적용 혼란 발생.
  - 만약 target plan 이 먼저 머지되면: PR #518 은 rebase 시 §2.9.1 / §1.4 / §3.1 영역에서 충돌이 발생하여 수동 해결이 필요하다.
  - PR #518 의 목적은 plan backlog 마크다운 재정리(표 렌더 깨짐 해소)이며, spec 내용 변경은 오래된 base 에서 inherited 된 것으로 의도된 spec 편집이 아닌 것으로 판단된다. 그러나 현재 OPEN 상태라 머지 순서에 따라 충돌이 실재한다.
- 제안: (a) target plan 을 먼저 머지하고, PR #518 을 rebase on main 한 뒤 spec 충돌 라인을 target plan 이 반영한 완료 텍스트로 수동 확인. 또는 (b) PR #518 을 먼저 rebase 해 spec 변경 범위를 최소화(spec 내용은 main 최신 상태를 keep)한 뒤 머지 후 target plan 진행. 어느 순서든 PR #518 의 즉각 rebase 가 선행되어야 충돌을 명확히 격리할 수 있다.

### [INFO] `spec/2-navigation/2-trigger-list.md §4.3` 추가 검토 지시 — 현재 plan 에 미반영

- target 위치: target plan 의 "추가 정보" 섹션 마지막 줄: "연관 spec 파일: `spec/2-navigation/2-trigger-list.md` §4.3 — 해당 섹션 검토 후 필요 시 추가 수정"
- 관련 plan: `refactor-backlog-format` 브랜치가 `spec/2-navigation/2-trigger-list.md` 에도 변경을 포함(sort/order 미구현 Planned 문구 추가 등)한다. 두 변경이 §4.3 에서 겹치는지는 plan 의 "필요 시 추가 수정" 조건부이므로 실제 겹침은 plan 실행 시 확인해야 한다.
- 제안: target plan 실행 시 `spec/2-navigation/2-trigger-list.md §4.3` 를 실제 열어 갭 표기가 있는지 확인하고, 있을 경우 plan 본문에 5번째 갱신 대상으로 명시한다. PR #518 과 충돌 가능성도 동시 점검.

### [INFO] `trigger-schedule-reverse-sync.md` 마지막 체크박스와 target plan 의 정합

- target 위치: target plan 전체
- 관련 plan: `plan/in-progress/trigger-schedule-reverse-sync.md` 마지막 미완 항목 — "[ ] spec 갭 표기 해소 (project-planner 역할: 1-data-model §2.9.1, data-flow/10-triggers.md §1.4) + /consistency-check --impl-done"
- 상세: target plan 은 정확히 이 미완 항목을 이행하기 위한 spec-update 문서다. 갱신 대상 4곳이 `trigger-schedule-reverse-sync.md` 에 명시된 파일·섹션과 일치하며, 구현 커밋(59231fd7) 및 테스트 커밋(2838fcc0) 도 정합한다. 선행 조건(구현 + TEST WORKFLOW PASS)은 모두 체크 완료 상태다.
- 제안: 정합. target plan 완료 후 `trigger-schedule-reverse-sync.md` 의 마지막 체크박스를 [x] 처리하고 plan 을 `plan/complete/` 로 이동할 것.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

- `spec-sync-audit-998544` (branch `claude/spec-sync-audit-998544`) — Step 2 PR MERGED. 해당 worktree 가 활성으로 남아있을 이유가 없으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target plan (`spec-update-trigger-schedule-sync.md`) 은 `trigger-schedule-reverse-sync.md` 의 마지막 미완 항목(spec 갭 표기 해소)을 이행하는 올바른 SPEC-DRIFT 문서이며, 선행 조건(구현·테스트·impl-prep)은 모두 충족된 상태다. 단, OPEN 상태의 PR #518 (`refactor-backlog-format` 브랜치)이 target 과 동일한 `spec/1-data-model.md §2.9.1` 및 `spec/data-flow/10-triggers.md §1.4·§3.1` 행을 직접 수정하고 있어 머지 순서에 따라 rebase 충돌이 발생한다 — PR #518 을 먼저 rebase on main 하거나, target plan 을 먼저 머지한 뒤 PR #518 을 rebase 해야 한다. stale worktree 1건(`spec-sync-audit-998544`) skip. 전체 active worktree 중 target spec 파일을 건드리는 것은 `refactor-backlog-format` 1건뿐.

## 위험도

MEDIUM
