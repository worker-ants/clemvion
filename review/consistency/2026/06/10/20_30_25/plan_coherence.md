# Plan 정합성 검토 결과

검토 대상: perf 백로그 01 구현 (`spec/5-system/4-execution-engine.md spec/data-flow/4-file-storage.md spec/4-nodes/1-logic/10-parallel.md spec/3-workflow-editor/3-execution.md`)
검토 시각: 2026-06-10
Diff 베이스: `origin/main`

---

## 발견사항

### [WARNING] `plan/in-progress/refactor/01-performance.md` 체크박스가 구현 완료 후에도 미착수(`[ ]`) 상태

- **target 위치**: `plan/in-progress/refactor/01-performance.md` 라인 14, 41, 78, 108, 134, 160, 185, 211, 245, 353 — `#1·#2·#3·#4·#5·#6·#7·#8·#10·#14` 모두 `- [ ] 미착수`
- **관련 plan**: `plan/in-progress/refactor/01-performance.md` (worktree: `plan-complete-turn-timing-aa533b`)
- **상세**: 파일 하단 "구현 진행 메모"(라인 403–410)에는 "#1·#5·#6·#14(엔진), #2(s3 deleteMany+KB), #4(dashboard 2쿼리), #7(카탈로그 캐시), #10(import 배치), #3+#8(frontend B안)" 이 모두 완료됐다고 기록돼 있다. 그러나 각 항목의 `- [ ]` 체크박스는 갱신되지 않은 채 `미착수` 표기로 남아 있다. 이 상태에서 본 plan 을 읽는 다음 작업자는 이 항목들이 아직 착수 전임을 오해해 중복 착수 또는 불필요한 분석을 반복할 수 있다.
- **제안**: `plan/in-progress/refactor/01-performance.md` 의 `#1·#2·#3·#4·#5·#6·#7·#8·#10·#14` 항목 체크박스를 `[x]`로 갱신하고, 각 항목에 구현 완료(PR/commit) 참조를 추가한다. `#11·#12·#15` 는 이미 `[x]` 종결로 표시돼 있어 정상.

---

### [WARNING] `spec/data-flow/4-file-storage.md` "for 루프" 문구 갱신 완료 여부 — plan 의 spec 갱신 필요 항목이 plan 목록에 잔존

- **target 위치**: `plan/in-progress/refactor/README.md` "spec 갱신 필요 항목 (project-planner 위임 대기)" 목록 (`data-flow/4-file-storage.md` "for 루프" 문구 — 01 #2)
- **관련 plan**: `plan/complete/spec-update-perf-backlog-01.md` — 해당 spec 갱신을 완료로 기록
- **상세**: `spec-update-perf-backlog-01.md`(complete)에서 `data-flow/4-file-storage.md` KB 삭제 흐름 문구가 `deleteMany` 배치로 갱신 완료됐다고 기록했다. 그러나 `refactor/README.md` 의 "spec 갱신 필요 항목" 목록에 `data-flow/4-file-storage.md` "for 루프" 문구(01 #2) 항목이 "project-planner 위임 대기" 상태로 여전히 남아 있다. 완료된 항목을 목록에서 체크하거나 제거하지 않으면 계획 상태를 혼동하게 된다.
- **제안**: `refactor/README.md` "spec 갱신 필요 항목" 목록에서 `data-flow/4-file-storage.md` "for 루프" 문구 행을 완료 표시 또는 제거한다.

---

### [INFO] `plan/in-progress/refactor/01-performance.md` — `#14` 의 spec 갱신(§1.6 read-once 문구) 위치 교정 반영 필요

- **target 위치**: `plan/in-progress/refactor/01-performance.md` #14 항목 spec 갱신 지침 "적용 시 §1.6 에 read-once 문구 추가가 일관적 (planner)"
- **관련 plan**: `plan/complete/spec-update-perf-backlog-01.md` — §1.6 이 미존재 섹션 오참조임을 교정해 §2.1(`MAX_NODE_ITERATIONS`)·`10-parallel.md`(`PARALLEL_ENGINE`) 에 반영 완료
- **상세**: `spec-update-perf-backlog-01.md`(complete) 검토 메모에 "draft 의 §1.6 은 미존재 섹션 오참조였음 — 교정"이라고 기록됐다. 그러나 `refactor/01-performance.md` #14 항목의 spec 갱신 지침은 "§1.6 에 read-once 문구 추가" 로 여전히 오참조 섹션을 가리킨다. 이는 향후 #14 를 별도 plan 으로 참조하는 작업자가 틀린 섹션에 spec 변경을 가할 수 있다.
- **제안**: `refactor/01-performance.md` #14 spec 갱신 행을 "§2.1 `MAX_NODE_ITERATIONS` 행 + `10-parallel.md` rollback card 에 read-once 병기 — 완료(spec-update-perf-backlog-01.md)" 로 교정한다.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 검토 중 다음 3개 worktree 에 대해 stale 판정 cascade 를 실행했다:

- `plan-complete-turn-timing-aa533b` (branch `claude/plan-complete-turn-timing-aa533b`) — Step 1: ACTIVE (ancestor 아님). Step 2: PR `MERGED`. → **stale** (현 worktree 자신 — target 이 이미 main 에 반영됨)
- `spec-sync-audit` (branch `claude/spec-sync-audit`) — Step 1: ACTIVE. Step 2: PR `MERGED`. → **stale** skip. `spec-sync-execution-engine-gaps.md` 와 `spec-sync-structural-followups.md` 가 이 worktree 를 참조하나 실제 conflict 없음.
- `spec-frontmatter-status-migration-027c17` (branch `claude/spec-frontmatter-status-migration-027c17`) — Step 1: ACTIVE. Step 2: PR `MERGED`. → **stale** skip. `execution-engine-residual-gaps.md` 가 이 worktree 를 참조.

모든 후보 worktree 3건이 stale. active worktree 와의 §5 spec 파일 동시 편집 충돌 CRITICAL 없음.

해당 worktree 들이 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

perf 백로그 01 구현(#1~#14 다수 항목) 자체는 `plan/in-progress/refactor/01-performance.md` 에서 사용자 결정을 받은 방향 그대로 실행됐으며, 미해결 결정을 우회하거나 다른 active plan 과 충돌하는 지점은 없다. 주요 정합 문제는 구현 완료 후 plan 체크박스 미갱신(WARNING)과 `refactor/README.md` spec 갱신 목록의 완료 항목 미제거(WARNING) 두 건이다. 이 두 건은 실제 동작 회귀와 무관하지만, 다음 작업자가 plan 상태를 오독할 위험이 있어 plan 을 갱신해야 한다. worktree 충돌 후보 3건은 모두 PR MERGED stale 판정으로 skip 됐다.

---

## 위험도

LOW
