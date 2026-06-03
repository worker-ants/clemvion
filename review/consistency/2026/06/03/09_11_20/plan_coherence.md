# Plan 정합성 검토 결과

**검토 대상**: `plan/in-progress/spec-draft-conventions-code-data.md` (worktree `conventions-code-data-9b32d5`)
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-06-03

---

## 발견사항

### [WARNING] `node-output-redesign` plan 의 후속 "(spec)" 체크박스가 target 변경으로 무효화됨 — 갱신 미반영

- **target 위치**: target plan §"변경 (이미 worktree spec/ 에 적용)" Critical 1 / Critical 2 / WARNING 1
- **관련 plan**: `plan/in-progress/node-output-redesign/README.md` §"Phase E — P0/P1 노드별 구현" + `plan/in-progress/node-output-redesign/code.md` §"종합 개선안" (spec 체크박스)
- **상세**:
  - `node-output-redesign/README.md` Phase 2 §B 구현 분석 관점 §7 "Code 노드 sandbox API 갭"(잔여 P1) 항목 안에 암묵적으로 포함된 spec 권고: `node-output.md Principle 8.2` 에 "Code/Transform 각주 추가", `0-common.md §4` meta 필드 정정 — 이 두 건은 해당 README 가 "(spec)" 권고로 추적 중이다.
  - `node-output-redesign/code.md` §"종합 개선안" 에 `node-output.md Principle 8.2` 관련 spec 수정 권고가 열린 상태(`[ ]`)로 남아 있다.
  - target plan 이 `node-output.md` Principle 7/8.2/2 + `0-common.md §4` 를 일괄 정합화하면 위 체크박스들은 더 이상 유효하지 않다.
  - 또한 `plan-grooming-2ec306` 워크트리(브랜치 `claude/plan-grooming-2ec306`, 커밋 `2cb06b08` — 미머지 active)가 같은 `node-output-redesign/README.md` 에 "5차 갱신" 노트를 추가하고 있으므로, target plan 머지 후 그 브랜치에서도 동일 변경 반영이 필요하다.
- **제안**:
  - target plan 이 머지된 후 `node-output-redesign/README.md` 와 `node-output-redesign/code.md` 의 해당 spec 체크박스를 `[x]` 처리하고 "resolved by spec-draft-conventions-code-data" 메모를 달아야 한다. 이 작업은 `plan-grooming-2ec306` 워크트리 PR 에 포함하거나 별도 grooming 커밋으로 처리 권장.

### [INFO] `plan-grooming-2ec306` 워크트리 — `node-output-redesign/README.md` 동시 편집 (plan 파일 경합)

- **target 위치**: target plan 의 spec 변경이 `node-output.md` Principle 7/8.2 를 수정함
- **관련 plan**: `plan/in-progress/node-output-redesign/README.md` (plan-grooming-2ec306 워크트리가 "5차 갱신" 노트 추가 커밋 `2cb06b08`)
- **상세**: `plan-grooming-2ec306` 의 변경(README 5차 갱신)은 **spec 파일** 을 건드리지 않고 `plan/in-progress/node-output-redesign/README.md` 만 편집한다. target worktree 는 `spec/` 파일을 편집한다. 두 워크트리가 같은 파일을 동시에 편집하지 않으므로 **직접 worktree 경합은 없다**. 단, plan-grooming 브랜치의 README 변경이 Code P1 항목을 "stale" 이 아닌 "잔여" 로 기술하고 있는데, target plan 머지 후에는 그 기술의 spec 부분이 outdated 가 된다.
- **제안**: plan-grooming 브랜치 PR 을 main 에 머지하기 전, target plan (spec-draft-conventions-code-data) 이 먼저 머지되어야 한다. 그래야 plan-grooming PR 이 spec 변경을 토대로 Code P1 체크박스를 정확하게 갱신할 수 있다.

### [INFO] `node-output-redesign` 잔여 P1 — Code `timeout` schema / `$node` / `$helpers` 는 target 과 직교

- **target 위치**: target plan 의 변경 범위 (Critical 1/2 / WARNING 1~3)
- **관련 plan**: `plan/in-progress/node-output-redesign/code.md` §"종합 개선안" P1 체크박스 (`timeout` schema, `$node`/`$helpers` 주입, timer 셰도잉)
- **상세**: target plan 은 **conventions drift 정합화** (echo/output root 배치 규약 vs spec 불일치 해소)만 다루며, Code 노드 impl 갭(`timeout` zod schema 추가, `$node`/`$helpers` sandbox 주입, timer 셰도잉 명시)은 건드리지 않는다. `node-output-redesign` Phase E P1 구현 작업은 target 머지 후에도 그대로 유효하게 남는다. 충돌 없음, 단 작업자가 혼동하지 않도록 구분 메모가 유용하다.

### [INFO] `spec-drift-parallel-count.md` / `spec-drift-ws-button-config.md` — spec-drift-resolve-efb608 워크트리가 이미 해소 예정

- **target 위치**: target plan 과 직접 무관
- **관련 plan**: `plan/in-progress/spec-drift-parallel-count.md`, `plan/in-progress/spec-drift-ws-button-config.md`
- **상세**: `spec-drift-resolve-efb608` 워크트리(브랜치 `claude/spec-drift-resolve-efb608`, 커밋 `0cd47569` — 미머지 active)가 이미 두 plan 을 `plan/complete/` 로 이동하고 대응 spec 파일(`10-parallel.md`, `6-websocket-protocol.md`)을 수정하는 커밋을 보유한다. target plan 이 변경하는 spec 파일들과 겹치지 않으므로 직접 충돌은 없다.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보:
- `feat-web-chat-demo` — 대상 spec 파일 미접촉. 후보 아님.
- `plan-grooming-2ec306` — `node-output-redesign/README.md` 만 수정 (spec 파일 미접촉). INFO 처리.
- `spec-drift-resolve-efb608` — `10-parallel.md`, `6-websocket-protocol.md` 만 수정 (target 파일 비겹침). INFO 처리.
- `code-node-sandbox-979a97` — 변경 없음(main HEAD). 후보 아님.
- `spec-sync-audit` — 변경 없음. 후보 아님.
- `system-status-recent-failed-86831b` — 변경 없음. 후보 아님.

각 후보의 stale 판정:

- `plan-grooming-2ec306` (branch `claude/plan-grooming-2ec306`):
  - Step 1: `git merge-base --is-ancestor` → exit 1 (ACTIVE — main HEAD 보다 앞선 커밋 존재).
  - Step 2: `gh pr list --head claude/plan-grooming-2ec306` → [] (PR 없음 — 아직 open PR 미생성).
  - Step 3: active 로 처리. "stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장"

- `spec-drift-resolve-efb608` (branch `claude/spec-drift-resolve-efb608`):
  - Step 1: exit 1 (ACTIVE).
  - Step 2: `gh pr list --head "claude/spec-drift-resolve-efb608"` → [] (PR 없음).
  - Step 3: active 로 처리. stale 판정 cascade Step 1/2 모두 음성. active 로 처리.

**stale skip 건수: 0건** (충돌 후보 중 stale 로 분류된 worktree 없음).

---

## 요약

target plan `spec-draft-conventions-code-data.md` 의 변경 내용(Principle 7/8.2/2 정합화 + `0-common.md` meta 정정 + `2-code.md` Rationale 신설 + `0-overview.md` port count 수정)은 다른 진행 중 plan 과 **직접 충돌하지 않는다**. 미해결 결정을 일방적으로 번복하는 사항도 없으며, 변경 대상 spec 파일을 다른 active worktree 가 동시에 수정하는 경우도 없다. 단, `node-output-redesign` plan 의 spec 체크박스(Principle 8.2 각주 추가, `0-common.md §4` 정정)가 target 변경으로 무효화되므로, 머지 후 `node-output-redesign/README.md` · `code.md` 의 해당 항목 동기화가 필요하다(WARNING). `plan-grooming-2ec306` 워크트리가 같은 README 를 편집 중이므로, target plan 을 먼저 머지 후 plan-grooming 브랜치를 rebase 해 spec 체크박스를 갱신하는 순서가 권장된다. worktree 충돌 후보 2건 모두 target spec 파일과 겹치지 않아 §5번 CRITICAL 적용 대상에서 제외됨. stale skip 0건.

---

## 위험도

LOW
