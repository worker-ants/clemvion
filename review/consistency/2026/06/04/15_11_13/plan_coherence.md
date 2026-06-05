# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
Target: `spec/5-system/4-execution-engine.md` (+ `spec/data-flow/0-overview.md`, `spec/5-system/14-external-interaction-api.md`, `spec/conventions/chat-channel-adapter.md`)
Worktree: `impl-exec-concurrency-cap` (branch `claude/impl-exec-concurrency-cap`)

---

## 발견사항

- **[INFO]** PR2a 한도 출처 결정 (Q1=A) — plan 내 인라인 기록 (plan 체크리스트 미반영)
  - target 위치: `exec-intake-queue-impl.md` PR2a 행 "Q1=A" 주석
  - 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` PR2a 항목
  - 상세: Q1("per-workflow settings 즉시 구현 vs 후속 env 상수") 결정이 plan 인라인 `Q1=A` 로만 기록되고 명시적 결정 섹션이 없다. target 구현이 "1단계 env 상수 / 2단계 per-workflow" 로 확정 반영하고 있어 실제 충돌은 없으나, 미래 PR2b 착수자가 Q1 결정 근거를 찾을 수 없을 수 있다.
  - 제안: exec-intake-queue-impl.md 에 `## 결정 기록` 섹션(Q1=A: env 상수 1단계, Q2=A: FOR UPDATE 원자화)을 명시 추가 권장 (minor).

- **[INFO]** `exec-intake-queue-impl.md` 후속 항목 미체크 상태
  - target 위치: `exec-intake-queue-impl.md` §consistency-check --impl-prep "후속" 목록
  - 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` lines 18–20
  - 상세: `spec/data-flow/0-overview.md §4` BullMQ 카탈로그 갱신(execution-run 행 추가), `spec/5-system/16-system-status-api.md §1` execution-run 등록 2건이 plan 후속 항목으로 열려 있다. target PR2a 는 data-flow/0-overview.md 의 큐 목록 한 줄(인라인 텍스트)은 갱신했으나 §4 **표** 행(execution-run 큐 상세 행)은 미추가 — plan 후속 항목 ①의 일부가 아직 미반영이다. `spec/5-system/16-system-status-api.md §1`도 미반영 상태.
  - 제안: target PR 머지 후 해당 후속 항목이 여전히 열려 있음을 plan 에 명시하거나, PR2b(또는 별 project-planner PR)에서 처리하도록 분류 명시.

- **[INFO]** `spec-sync-execution-engine-gaps.md` §8 체크박스 — "spec 본문 §8 부분 구현 반영 완료(2026-06-04)" 기록됨. worktree 내 판본은 PR2a 반영 완료 표기. main 의 판본은 미반영(worktree-local 변경). 머지 전까지 main 의 `spec-sync-execution-engine-gaps.md`는 §8을 미완료로 읽힐 수 있으나, 이는 worktree 격리로 인한 정상 상태 — 머지 시 해소.
  - target 위치: `plan/in-progress/spec-sync-execution-engine-gaps.md` (worktree 판본)
  - 관련 plan: main `plan/in-progress/spec-sync-execution-engine-gaps.md`
  - 제안: 추적 목적만 — 별도 조치 불요.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보: `spec/5-system/4-execution-engine.md`, `spec/5-system/14-external-interaction-api.md`, `spec/data-flow/0-overview.md` 를 다른 활성 worktree가 동시에 수정하는지 확인. 후보 5건 발견, 전부 Step 2(GitHub PR state) 에서 stale 판정.

- `impl-exec-intake-queue` (branch `claude/impl-exec-intake-queue`) — Step 2 PR #463 **MERGED**. `spec/5-system/4-execution-engine.md` 수정 포함. PR1 intake 큐 구현 후 stale.
- `spec-exec-intake-queue` (branch `claude/spec-exec-intake-queue`) — Step 2 PR #458 **MERGED**. `spec/5-system/4-execution-engine.md` 수정 포함. spec 재정의 PR 후 stale.
- `fix-bg-context-followups` (branch `claude/fix-bg-context-followups`) — Step 2 PR #451 **MERGED**. `spec/5-system/4-execution-engine.md` 수정 포함. createContext options-bag 후 stale.
- `kb-quality-fba2f2` (branch `claude/kb-quality-fba2f2`) — Step 2 PR #457 **MERGED**. `spec/5-system/14-external-interaction-api.md` 수정 포함. KB quality PR 후 stale.
- `makeshop-api-catalog-730deb` (branch `claude/makeshop-api-catalog-730deb`) — Step 2 PR #456 **MERGED**. `spec/data-flow/0-overview.md` 수정 포함. MakeShop 통합 PR 후 stale.

해당 worktree 들이 활성으로 남아있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`impl-exec-concurrency-cap` (PR2a — §8 active-running 누적 타임아웃) 구현이 plan 과 정합하다. `exec-intake-queue-impl.md`가 PR2a를 명시적으로 기술하고 사용자 승인(2026-06-04)을 기록하며, spec §8 헤더를 "미구현→부분 구현"으로 갱신하고, `EXECUTION_MAX_ACTIVE_RUNNING_MS` env 상수 1단계 / per-workflow 2단계 분리도 plan 에 Q1=A로 기록된 결정을 충실히 반영한다. `spec-sync-execution-engine-gaps.md` §8 항목이 "PR2a 완료"로 체크됐고, EIA classifier·chat-channel-adapter·data-flow 큐 인라인 목록도 함께 동기화했다. 미해결 결정 우회·중복 작업·선행 plan 미해소·후속 무효화 항목 없음. worktree 충돌 후보 5건은 모두 Step 2(PR MERGED)에서 stale 판정 → 전건 skip. INFO 2건(Q1 결정 명시화, data-flow §4 표 행 + system-status-api §1 미추가 후속 항목 open)은 비차단 추적 항목이다.

---

## 위험도

NONE

STATUS: OK
