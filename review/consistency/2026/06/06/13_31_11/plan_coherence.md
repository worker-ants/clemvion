# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
Target: `spec/5-system/4-execution-engine.md`
Target 내 변경 영역: (없음) — worktree `fix-carousel-waiting-status-4d4ed3` 는 현재 main(d9cd4b73) 과 동일 커밋, 미착수 상태.

---

## 발견사항

### [INFO] Target 변경 미착수 — 정합성 점검 실질 대상 없음

- target 위치: `spec/5-system/4-execution-engine.md` 전체
- 관련 plan: 해당 없음 (worktree 내 변경 없음)
- 상세: `fix-carousel-waiting-status-4d4ed3` worktree 의 branch `claude/fix-carousel-waiting-status-4d4ed3` 는 `main`(d9cd4b73) 과 HEAD 가 동일하다 — spec 파일에 아직 아무 변경도 없다. --impl-prep 시점에 변경 예정 내용이 없으므로 충돌·중복·누락 판정의 실질 대상이 없다.
- 제안: 구현 착수 전 이 검토가 재실행된 것이므로 문제없음. 실제 spec 변경 드래프트 작성 후 재실행 권장.

---

### [WARNING] spec/5-system/4-execution-engine.md 는 현재 4개 pending_plan 이 활성 추적 중 — 착수 시 조율 필요

- target 위치: `spec/5-system/4-execution-engine.md` frontmatter `pending_plans`
- 관련 plan:
  - `plan/in-progress/execution-engine-residual-gaps.md` (worktree: `spec-frontmatter-status-migration-027c17`, 미착수 브랜치)
  - `plan/in-progress/spec-sync-execution-engine-gaps.md` (worktree: `spec-sync-audit`)
  - `plan/in-progress/exec-intake-queue-impl.md` (worktree: `impl-exec-concurrency-cap`, branch `claude/impl-concurrency-cap-pr2b`)
  - `plan/in-progress/exec-park-durable-resume.md` (worktree: `exec-park-durable-resume`, branch `claude/exec-park-b2b-04a2f8` 후속 진행 중)
- 상세: 위 4개 plan 이 `spec/5-system/4-execution-engine.md` 를 지속적으로 갱신·추적한다. 이 파일에 신규 변경(carousel 관련 `waiting_for_input` 상태 표 수정 등)이 필요한 경우, PR-B2b(exec-park-b2b-04a2f8 — active) 및 PR2b(impl-concurrency-cap-pr2b — active) 와 병합 충돌 위험이 있다.
- 제안: 착수 전 `exec-park-b2b-04a2f8` 의 PR-B2b와 `impl-concurrency-cap-pr2b` 의 PR2b 머지 상태 및 spec 변경 범위 확인. 겹치는 절(§1.1 상태표, §1.3 블로킹/재개 컨트랙트)을 손댄다면 해당 브랜치 HEAD rebase 후 진행.

---

### [INFO] exec-park-durable-resume plan — §1.3 "ai_agent 한정" 문구를 IE 지원으로 확장 완료(A2b) — carousel 관련 `waiting_for_input` 행 이미 존재

- target 위치: `spec/5-system/4-execution-engine.md §1.3` 블로킹/재개 컨트랙트 표 `waiting_for_input` 행
- 관련 plan: `plan/in-progress/exec-park-durable-resume.md` §A2b
- 상세: `§1.3` 표의 `waiting_for_input` 행 description 에는 이미 `Carousel(button)` 등이 열거되어 있다(현행 main 기준). `fix-carousel-waiting-status` 작업이 carousel 의 waiting 상태 관련 spec 서술을 변경하려 한다면, A2b(ai_agent→IE 확장, 이미 완료·반영)와는 겹치지 않는다. 단, `exec-park-pr-b2` 브랜치가 §1.3 을 수정했으나 MERGED 이므로 현 main 에 반영돼 있다.
- 제안: main 의 §1.3 현재 서술을 확인 후 중복 기술 없이 carousel-specific 내용만 추가.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 `§worktree stale 판정` 으로 skip 된 항목:

- `exec-park-durable-resume` (branch `claude/exec-park-pr-b2`) — Step 2 PR MERGED (`spec/5-system/4-execution-engine.md` 수정 포함). 해당 변경은 이미 main 에 흡수됨.
- `harden-review-hooks-cb1c84` (branch `claude/harden-review-hooks-cb1c84`) — Step 2 PR #493 MERGED. `spec/5-system/4-execution-engine.md` 미수정.
- `rag-dynamic-cut-12fac1` (branch `claude/rag-dynamic-cut-12fac1`) — Step 1 ancestor(main 에 포함). `spec/5-system/4-execution-engine.md` 미수정.
- `plan-complete-p6-043804` (branch `claude/plan-complete-p6-043804`) — Step 2 PR MERGED. `spec/5-system/4-execution-engine.md` 미수정.

위 4건은 stale worktree 로 판정, §5 검토 대상에서 제외. 정리 권장: `./cleanup-worktree-all.sh --yes --force` 실행 후 재확인.

**Active worktree (stale 아님) — spec 파일 비수정으로 §5 충돌 없음**:
- `exec-park-b2b-04a2f8` (branch `claude/exec-park-b2b-04a2f8`) — Step 1 ACTIVE, Step 2 PR 없음(fallback ACTIVE). `spec/5-system/4-execution-engine.md` 미수정 — codebase 및 plan 만 수정. 충돌 해당 없음.
- `impl-exec-concurrency-cap` (branch `claude/impl-concurrency-cap-pr2b`) — Step 1 ACTIVE, Step 2 PR 없음(fallback ACTIVE). 수정 파일: `plan/in-progress/exec-intake-queue-impl.md` 만. `spec/5-system/4-execution-engine.md` 미수정 — 충돌 해당 없음.

---

## 요약

`spec/5-system/4-execution-engine.md` 에 대한 `--impl-prep` 검토 시점에 `fix-carousel-waiting-status-4d4ed3` worktree 는 미착수(main 동일 커밋)이므로 실질 충돌 대상이 없다. 동 파일을 수정하는 active worktree 는 `spec/5-system/4-execution-engine.md` 를 직접 건드리지 않아 §5 worktree 충돌은 없다. 단, 4개의 active pending_plan 이 이 파일을 지속 추적 중이므로 착수 시 관련 절(§1.1 상태표·§1.3 블로킹 컨트랙트)의 현 main 서술 확인 및 PR2b/B2b rebase 조율이 필요하다. worktree 충돌 후보 7건 중 stale 4건 skip, active 2건 분석(spec 파일 비수정 — 충돌 없음), 미착수 현재 worktree 1건.

## 위험도

LOW
