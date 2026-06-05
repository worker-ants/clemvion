# Plan 정합성 검토 결과

검토 모드: `--impl-prep`, scope=`spec/5-system/`
Target plan: `plan/in-progress/exec-park-durable-resume.md`
검토 일시: 2026-06-05

---

## 발견사항

### [CRITICAL] `impl-exec-concurrency-cap` worktree 가 A1 완료 결과를 역행(revert)하며 동일 spec 파일을 편집 중
- **target 위치**: `exec-park-durable-resume.md` Phase A1·A3, Spec 변경 항목 전반
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` — worktree `impl-exec-concurrency-cap` (branch `claude/impl-concurrency-cap-pr2b`)
- **상세**:
  - `impl-exec-concurrency-cap` worktree (branch `claude/impl-concurrency-cap-pr2b`, open PR 없음, main 미머지)가 `spec/5-system/4-execution-engine.md`, `spec/1-data-model.md`, `spec/conventions/conversation-thread.md` 를 동시에 편집하고 있다.
  - 해당 worktree 의 diff 는 `exec-park-durable-resume` A1(conversationThread durable park, PR #470)이 main 에 반영한 내용을 **역행**한다:
    - V084 마이그레이션(`codebase/backend/migrations/V084__execution_conversation_thread.sql`)을 삭제.
    - `spec/conventions/conversation-thread.md §4` 영속화 표에서 `Execution.conversation_thread jsonb NULL` durable park 컬럼 행을 제거하고 "v1 신규 DB 컬럼 없음" 문구로 되돌림.
    - `spec/5-system/4-execution-engine.md §6.2` "waiting_for_input 진입 시" 저장 행에서 `Execution.conversation_thread` 제거, §7.5 rehydration 경로에서 conversation_thread 복원 경로 제거.
    - `spec/1-data-model.md` Execution 테이블에서 `conversation_thread` 행 삭제 + `exec-park-durable-resume` `pending_plans` 참조 제거.
    - `spec/4-nodes/3-ai/3-information-extractor.md` 의 A2b(IE 멀티턴 checkpoint) 확장을 "ai_agent 한정"으로 되돌림.
  - `exec-park-durable-resume` 의 현재 Phase A3 에서도 `spec/5-system/4-execution-engine.md §6.2`·`spec/1-data-model.md §2.13` 을 추가 편집하고 있어, 두 worktree 의 변경이 직접 충돌한다.
  - main 에는 이미 A1 결과(`conversation_thread` 컬럼·spec)가 반영된 상태이므로, `impl-exec-concurrency-cap` 가 main 으로 merge 될 경우 A1 의 결정(D1 확정)을 우회하는 spec·마이그레이션 충돌이 발생한다.
- **제안**:
  - `exec-intake-queue-impl.md` 담당자(또는 planner)가 `impl-exec-concurrency-cap` worktree 의 spec diff 를 검토해 A1 역행 부분을 제거하고 현재 main(A1 반영 상태) 기준으로 rebase 해야 한다.
  - 두 worktree 의 동일 파일 편집 직렬화 순서를 확정 후 `impl-exec-concurrency-cap` 가 A1·A2b 결정을 존중하는 방향으로 스펙을 재작성해야 한다.
  - BLOCK: Phase A3 코드 착수 전 위 충돌이 해소돼야 A3 spec 변경이 안전하다.

---

### [WARNING] Phase A3 spec 변경(`spec/1-data-model.md`, `spec/5-system/4-execution-engine.md`)이 `impl-exec-concurrency-cap` 의 동일 파일 편집과 충돌 예상
- **target 위치**: `exec-park-durable-resume.md §A3` — V085, `Execution.user_variables` spec 갱신 항목들
- **관련 plan**: `exec-intake-queue-impl.md` (worktree `impl-exec-concurrency-cap`)
- **상세**:
  - `exec-park-durable-resume` 의 A3 는 `spec/5-system/4-execution-engine.md §6.2` (waiting_for_input 진입 시 행에 `Execution.user_variables` 추가) 와 `spec/1-data-model.md §2.13` (user_variables 행 추가)을 편집한다.
  - `impl-exec-concurrency-cap` 도 동일한 두 파일을 편집 중이다. `spec/1-data-model.md` 에서는 `exec-park-durable-resume` pending_plan 참조를 삭제하고 `conversation_thread` 행도 제거했다.
  - A3 spec 변경이 완료되면 두 branch 모두 `§6.2` 테이블의 동일 행(waiting_for_input 진입 시)을 서로 다른 내용으로 편집한 상태가 되어, 어느 쪽이 먼저 PR 을 열어도 나머지 merge 시 conflict 가 발생한다.
- **제안**: A3 spec 적용 전 `impl-exec-concurrency-cap` 충돌(CRITICAL #1)을 해소하거나, A3 spec 변경과 `impl-exec-concurrency-cap` PR 의 순서를 확정한다.

---

### [WARNING] Phase B 선행 조건인 D3 미결 결정이 plan 내에서 미명시
- **target 위치**: `exec-park-durable-resume.md §미해결 결정 D3`
- **관련 plan**: `exec-park-durable-resume.md` 자체 + Phase B spec 변경 항목
- **상세**:
  - D3("park 중 워크플로 정의 편집 시 재개 정책")가 미확정 상태이다. Phase B 의 spec 변경 항목 중 `4-execution-engine.md §7.5` rehydration 서술은 D3 에 따라 내용이 달라질 수 있다(node.config 재유도 의미 유지 여부).
  - Phase B 착수 전 필수 의무인 "D4 turn-단위 park Rationale 명문화(`4-execution-engine.md §4.x` 또는 신규 §Rationale)" 가 plan 에 명시돼 있으나, D3 가 그 spec 내용에 영향을 미칠 수 있는지 여부가 plan 에 판단 없이 남겨져 있다.
  - 현재 Phase A3 는 D3 와 무관(user_variables 복원 정책은 D3 와 독립)하므로 A3 착수에 차단이 없다. 단 Phase B 착수 전 D3 의 scope(spec 범위 포함 여부)를 확정해야 한다.
- **제안**: Phase B 착수 전 D3 를 "결정 또는 명시적 defer" 로 처리해 §7.5 spec 내용에 영향을 주는지 판단한다. plan 에 "D3 는 B 착수 전 확정 또는 defer 필요" 를 명시 추가한다.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

- `spec-exec-intake-queue` (branch `claude/spec-exec-intake-queue`) — Step 1 ACTIVE(ancestor 아님), Step 2 PR #458 MERGED → **stale** (squash/rebase merge 케이스, Step 1 통과 못하나 PR MERGED). `spec/5-system/4-execution-engine.md` 편집 후보였으나 이미 main 에 반영됨. skip.
- `impl-exec-intake-queue` (branch `claude/impl-exec-intake-queue`) — Step 1 ACTIVE(ancestor 아님), Step 2 PR MERGED → **stale** (`exec-intake-queue-impl.md` plan 의 PR1/PR2a 구현 branch). `spec/5-system/4-execution-engine.md` 등 편집 후보였으나 main 반영 완료. skip.
- `fix-bg-context-followups` (branch `claude/fix-bg-context-followups`) — Step 1 ACTIVE, Step 2 PR #451 MERGED → **stale**. skip.

해당 worktree들이 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`exec-park-durable-resume` plan 의 A1·A2a·A2b 는 완료(main 반영)됐고, 현재 진행 중인 A3(user-defined variables 영속, V085)는 plan 내 결정(D2 확정)과 정합하다. 그러나 **`impl-exec-concurrency-cap` worktree(branch `claude/impl-concurrency-cap-pr2b`, open PR 없음)가 이미 main 에 머지된 A1·A2b 의 spec 결과를 역행하는 방향으로 `spec/5-system/4-execution-engine.md`, `spec/1-data-model.md`, `spec/conventions/conversation-thread.md` 를 편집 중**이라 동일 파일에 대한 active worktree 충돌(CRITICAL)이 존재한다. A3 spec 착수 전 이 충돌을 직렬화·해소해야 한다. worktree 충돌 후보 5건 중 stale 3건 skip, active 2건(`impl-exec-concurrency-cap`·`exec-park-durable-resume`) 분석.

---

## 위험도

HIGH
