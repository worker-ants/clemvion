# Plan 정합성 검토 결과

**target**: `plan/in-progress/spec-update-perf-backlog-01.md`
**검토 모드**: spec draft (--spec)
**검토 일시**: 2026-06-10

---

## 발견사항

### [INFO] §1.6 섹션 번호 불일치 — 스펙 내 존재하지 않는 섹션 참조
- **target 위치**: `plan/in-progress/spec-update-perf-backlog-01.md` §2 항목
- **관련 plan**: 해당 없음 (target 내부 기술 오류)
- **상세**: target draft 가 `spec/5-system/4-execution-engine.md §1.6 표의 MAX_NODE_ITERATIONS 행` 을 변경 대상으로 기술하고 있으나, 현 spec 에는 `§1.1 Execution 상태`, `§1.2 NodeExecution 상태`, `§1.3 블로킹/재개 컨트랙트` 만 존재하며 `§1.6` 은 없다. `MAX_NODE_ITERATIONS` 환경 변수 표는 `§2.1 토폴로지 정렬 기반 실행 > 순환 참조 제한` 표(line 202-204)에, 유사 "모듈 로드 시 1회 읽음" 문구가 있는 자매 env 표는 `§11 Graceful Shutdown`(line 1139-1145)에 위치한다. `PARALLEL_ENGINE` 은 해당 spec 파일에 아예 없고 `spec/4-nodes/1-logic/10-parallel.md` / `spec/0-overview.md` 에만 존재한다.
- **제안**: project-planner 가 draft 를 spec 에 반영하기 전에 §2.1 순환 참조 제한 표(line 204)와 `PARALLEL_ENGINE` 이 실제로 언급된 위치를 재확인 후 draft 내 섹션 참조를 교정할 것. 행위 의미 불변 변경이므로 반영 자체는 비차단.

---

### [INFO] `unified-model-mgmt-5af7ee` worktree — stale cascade Step 1/2 모두 음성, active 로 처리
- **target 위치**: `plan/in-progress/spec-update-perf-backlog-01.md` §1 (`spec/data-flow/4-file-storage.md`) 변경 대상
- **관련 plan**: `unified-model-mgmt-5af7ee` worktree (branch `claude/unified-model-mgmt-5af7ee`)
- **상세**: `unified-model-mgmt-5af7ee` 는 `spec/data-flow/4-file-storage.md` 에 대해 `origin/main` 대비 69행 diff 를 보유한다. 그러나 이는 해당 worktree 가 `origin/main` 보다 앞서 있는 local main(b4a551a5, PR #440 적용됨)에서 분기했기 때문에 발생하는 외형 diff 이다. 실제로 `unified-model-mgmt HEAD` 와 local `main` 양쪽에서 `4-file-storage.md` 의 blob hash 가 동일(`5f87defb`)하며, perf-backlog-01 이 변경하려는 line 91–92("for 루프로 호출" 서술)도 local main 과 unified-model-mgmt HEAD 가 동일한 내용을 갖고 있어 실질 충돌이 없다. `spec/5-system/4-execution-engine.md` diff(lines 11, 64, 127, 536, 592, 692, 921, 942, 1053, 1327)도 perf-backlog-01 의 대상 범위(§2.1 순환 참조 제한 표, line ~204)와 겹치지 않는다.
  - stale cascade Step 1 (ancestor): `git merge-base --is-ancestor` → ACTIVE (exit 1)
  - stale cascade Step 2 (PR state): PR 없음(open/merged/closed 모두 미존재) → 판정 불가
  - Step 3 fallback → **active 로 처리**. 단 worktree 자체는 origin/main 을 fetch 하면 실질 diff 가 대폭 줄어들 것이며, `spec/data-flow/4-file-storage.md` 의 변경은 rebase 후 zero-diff 가 될 가능성이 높음. cleanup-worktree-all.sh 또는 rebase 후 재검토 권장.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 7건 분석:

| worktree | branch | 판정 |
| --- | --- | --- |
| `kb-lifecycle-groom-57cc46` | `claude/kb-lifecycle-groom-57cc46` | **STALE** — Step 1 non-ancestor, Step 2 PR #513 MERGED (squash) |
| `kb-unsearchable-warning-b47e20` | `claude/kb-unsearchable-warning-b47e20` | **STALE** — Step 1 non-ancestor, Step 2 PR #511 MERGED (squash) |
| `plan-complete-ai-review-backlog-85f80a` | `claude/plan-complete-ai-review-backlog-85f80a` | **STALE** — Step 1 non-ancestor, Step 2 PR #510 MERGED (squash) |
| `trigger-schedule-sync-f88604` | `claude/trigger-schedule-sync-f88604` | **active** (PR #519 OPEN) — 대상 파일 변경 없음 |
| `spec-sync-audit-998544` | `claude/spec-sync-audit-998544` | active (PR 미발행) — 대상 파일(`4-file-storage.md`, `4-execution-engine.md`) 변경 없음 |
| `unified-model-mgmt-5af7ee` | `claude/unified-model-mgmt-5af7ee` | active (Step 3 fallback) — 실질 충돌 없음(위 INFO 참조) |
| `plan-complete-turn-timing-aa533b` | `perf-backlog-01` | target 자신 |

stale skip 목록:
- `kb-lifecycle-groom-57cc46` (branch `claude/kb-lifecycle-groom-57cc46`) — Step 2 PR #513 MERGED
- `kb-unsearchable-warning-b47e20` (branch `claude/kb-unsearchable-warning-b47e20`) — Step 2 PR #511 MERGED
- `plan-complete-ai-review-backlog-85f80a` (branch `claude/plan-complete-ai-review-backlog-85f80a`) — Step 2 PR #510 MERGED

이 세 worktree 는 이미 머지된 PR 의 정리되지 않은 잔재이므로 `./cleanup-worktree-all.sh --yes --force` 실행을 권장.

---

## 요약

`spec-update-perf-backlog-01.md` 는 두 가지 행위 의미 불변 코드-sync 문구 갱신(KB 삭제 S3 배치 삭제 서술 + `MAX_NODE_ITERATIONS` env read-once 문구 추가)을 project-planner 에게 위임하는 draft 로, 검토 관점 1(미해결 결정 우회), 2(중복 작업), 3(선행 plan 미해소), 4(후속 항목 누락) 모두 이상 없다. 관점 5(worktree 충돌)에서는 7개 worktree 를 점검하여 stale 3건을 skip 처리하고 active 3건을 분석했으며, 실질 line 충돌은 발견되지 않았다. 단, draft 내 `§1.6` 섹션 번호가 존재하지 않는 섹션을 가리키므로 반영 전 planner 가 실제 섹션 위치(§2.1 순환 참조 제한, line 204)를 재확인해야 한다. worktree 충돌 후보 7건 중 stale 3건 skip, active 4건 분석(충돌 없음).

---

## 위험도

LOW
