# Plan 정합성 검토 결과

target: `plan/in-progress/spec-draft-exec-park-b2-durable.md`

---

## 발견사항

### [CRITICAL] active worktree `impl-concurrency-cap-pr2b` 가 동일 spec 파일 3종을 동시에 수정 중 — PR-B2 적용 후 병합 시 spec 덮어쓰기 위험

- **target 위치**: C5 "spec 서술 재전환 (PR-B1 정직화 → 완료형)", W5 "덮어쓰기 리스크"
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` (PR2b, worktree `impl-exec-concurrency-cap`, branch `claude/impl-concurrency-cap-pr2b`)
- **상세**:
  - worktree 실존 확인: `git worktree list` 로 `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap` (branch `claude/impl-concurrency-cap-pr2b`) 가 ACTIVE 상태.
  - stale 판정: Step 1 (`git merge-base --is-ancestor`) → ACTIVE (exit 1). Step 2 (`gh pr list --state all`) → PR 없음(empty). Step 3 fallback: **active 로 처리**.
  - `git diff origin/main..claude/impl-concurrency-cap-pr2b -- spec/5-system/4-execution-engine.md` 결과, 해당 브랜치는 **PR-B1/B2 이전 모델 서술**(`pendingContinuations`, `firstSegmentBarriers`, "in-process 코루틴 유지", "fast-path(in-instance fast path)/slow-path 이원화")을 `spec/5-system/4-execution-engine.md` 에 그대로 기재하고 있다. 특히:
    - `waiting_for_input → waiting_for_input` 전이 설명: "`pendingContinuations` 가 새 인스턴스에 재등록"이라는 내용이 추가됨 (PR-B2 완료 후 이 분기 자체가 삭제 대상).
    - "구현 메모 — 첫 세그먼트 배리어(`firstSegmentBarriers`)" 설명 추가 — PR-B2 가 삭제할 barrier/detach 메커니즘을 spec 에 새로 기술.
    - "현재 재개 경로와 알려진 한계 — park 코루틴이 누적" 서술 추가 — PR-B2 가 해결하는 문제를 미해결 미래 과제로 기술.
    - Worker 동작 표: "`pendingContinuations` 에 키가 있으면 즉시 resolve (in-instance fast path)" 추가.
  - 동시에 손대는 spec 파일 목록:
    - `spec/5-system/4-execution-engine.md` — target C5 가 "완료형 재전환"할 파일과 동일.
    - `spec/4-nodes/3-ai/1-ai-agent.md` — target(exec-park-pr-b2 브랜치)도 수정 중.
    - `spec/4-nodes/3-ai/3-information-extractor.md` — target(exec-park-pr-b2 브랜치)도 수정 중.
  - target 의 C5/W5 는 "PR-B2 머지 전 `impl-concurrency-cap-pr2b` 가 origin/main rebase 선행하도록 `exec-intake-queue-impl.md` 착수조건에 명기 — 본 plan W4/진행메모에 이미 기록" 이라고 하나, `exec-intake-queue-impl.md` 를 실제로 확인하면 PR2b 착수조건 섹션에 **"PR-B2 머지 후 rebase 선행" 문구가 없다**. 진행메모(exec-park-durable-resume.md)에만 기록됐고, exec-intake-queue-impl.md PR2b 항목에는 미반영 상태다.
- **제안**: 두 가지 조치 모두 필요.
  1. `plan/in-progress/exec-intake-queue-impl.md` PR2b 항목(`[ ] PR2b — 동시성 cap`)에 착수조건으로 "**PR-B2(`exec-park-pr-b2`) 머지 후 `origin/main` rebase 선행 필수 — 이 브랜치는 PR-B1/B2 이전 execution-engine.md 서술을 포함하고 있어 PR-B2 없이 push 시 spec 덮어쓰기 발생**"을 명시 추가 (project-planner 영역이나 developer 도 plan 파일 편집 가능).
  2. 또는 즉시 `impl-exec-concurrency-cap` worktree 에서 exec-park-pr-b2 결과를 rebase 수용 (PR-B2 랜딩 후).
  - 이 항목은 target spec-draft 자체 내용의 오류가 아니라, plan 간 착수조건 문서화 누락(exec-intake-queue-impl.md)이다.

---

### [WARNING] `spec/5-system/1-data-model.md` 미해결 pending_plans 등록 확인 필요

- **target 위치**: C1 "data-model: `1-data-model.md §2.13 Execution` 컬럼 표에 `resume_call_stack jsonb NULL` 행 추가"
- **관련 plan**: `plan/in-progress/exec-park-durable-resume.md` §Spec 변경 — "frontmatter `pending_plans:` 에 본 plan 등록 (`conversation-thread.md`·`4-execution-engine.md`·`1-data-model.md`). [A1 완료]"
- **상세**: exec-park-durable-resume.md 에 따르면 A1 완료 시 `1-data-model.md` frontmatter `pending_plans` 에 본 plan 이 등록됐다. 그런데 C1 은 V087 마이그레이션으로 `resume_call_stack` 컬럼을 추가하는 새 변경이다. 현재 exec-park-pr-b2 브랜치에는 아직 마이그레이션 파일 자체가 없고(spec-draft 단계), `1-data-model.md` 수정도 미포함이다. target 이 "data-model 병기 번호도 V087"이라고 기술하므로, PR-B2 착수 시 `1-data-model.md` 동시 수정이 수행돼야 한다. 이는 이미 plan 에 명시된 사항이지만, **`impl-concurrency-cap-pr2b` 도 `spec/1-data-model.md` 를 수정 중**이며(git diff 확인: V084/V085 columns 포함), merge 순서에 따라 충돌 가능성이 있다.
- **제안**: PR-B2 가 `1-data-model.md` 수정 전에 `impl-concurrency-cap-pr2b` 가 rebase 없이 push 되면 충돌·역전이 발생할 수 있다. CRITICAL 항목의 PR2b 착수조건 명기와 함께 `1-data-model.md` 도 명시적으로 언급할 것.

---

### [WARNING] V087 마이그레이션 번호 — impl-concurrency-cap-pr2b 브랜치가 V084/V085 를 포함하므로 rebase 전 번호 경합 확인 필요

- **target 위치**: C1 "마이그레이션: `V087__execution_resume_call_stack.sql` — 현재 최고 V086 #482 → next V087 확정"
- **관련 plan**: `exec-intake-queue-impl.md` PR2b (미착수) — 해당 worktree 가 이미 V084/V085(conversation_thread/user_variables) 를 branch 에 포함하고 있음.
- **상세**: `impl-concurrency-cap-pr2b` 브랜치는 V084/V085/V086 마이그레이션을 포함하고 있으나 이는 main 에 이미 랜딩된 것들이다(main 에 V086 까지 머지됨). 즉 해당 브랜치 자체에 아직 V087+ 가 없으므로 PR-B2 가 V087을 쓰는 것은 현재 기준 유효하다. 그러나 PR2b 가 미래에 **새 마이그레이션을 추가**할 경우(동시성 cap 용 migration이 필요하다면) V087 번호 경합이 생길 수 있다. PR2b 착수 직전 `check-migration-versions.py` 재확인이 필요하다.
- **제안**: 현재 V087 채택은 적정하며 즉각 차단 사유 아님. PR2b 착수 시 번호 재검증 수행 명기.

---

### [INFO] C5 의 "완료형 spec 적용 전제(W3)" — exec-park-pr-b2 브랜치에는 현재 spec-only 커밋이 없음, PR-B2 코드와 동시 랜딩 계획 명확

- **target 위치**: C5 "적용 전제(W3): C5 의 완료형 spec 갱신은 PR-B2 코드와 같은 PR 로 함께 머지될 때만 적용"
- **관련 plan**: `exec-park-durable-resume.md` §PR-B2 구현 설계 단계 7 "spec 재전환(별 commit)"
- **상세**: exec-park-pr-b2 브랜치를 실제 확인하면 현재 spec 파일 변경이 없다(1-ai-agent.md, 3-information-extractor.md 는 Phase A 작업 포함). C5 적용 전제(코드와 동시 랜딩)가 plan 에 명시돼 있고, W3 주의사항도 기술돼 있어 절차 인식은 양호하다. 추적 메모 수준이다.
- **제안**: 추가 조치 불요. 현행 plan 기술 유지.

---

### [INFO] stale 으로 skip 한 worktree (0건)

worktree 충돌 후보 중 stale 판정 cascade 로 skip 된 항목:

없음. 모든 active worktree (`impl-exec-concurrency-cap` / `fix-webchat-envelope-unwrap-9519af` / `rag-eval-harness-b8cc46`) 는 Step 1 ACTIVE 또는 Step 2 PR 없음(Step 3 fallback active). 이 중 `fix-webchat-envelope-unwrap-9519af`·`rag-eval-harness-b8cc46` 는 대상 spec 파일을 건드리지 않아 §5번 검토 후보에서 제외(충돌 후보 아님). `impl-exec-concurrency-cap` 만 충돌 후보로 CRITICAL 분류됨.

---

## 요약

target 문서 `spec-draft-exec-park-b2-durable.md` 의 핵심 내용(D4 멀티턴 turn-park, D6 중첩 call stack 영속, V087 마이그레이션, B3 일괄 제거)은 `exec-park-durable-resume.md` 의 확정된 결정 D4/D6 및 PR-B2 구현 설계와 정합하며, 미해결 결정을 일방적으로 번복하는 항목 없다. 선행 plan(Phase A: V084/V085/A2a/A2b 완료)의 전제도 충족됐다. 다만 **CRITICAL 1건** 이 존재한다: active worktree `impl-concurrency-cap-pr2b`(branch `claude/impl-concurrency-cap-pr2b`, worktree `impl-exec-concurrency-cap`)가 동일한 `spec/5-system/4-execution-engine.md` 를 PR-B1/B2 이전 모델로 수정 중이며, PR-B2 머지 후 이 브랜치가 rebase 없이 push 되면 spec 완료형 서술이 덮어써진다. target plan(C5/W5)은 이 위험을 인식하고 있으나 `exec-intake-queue-impl.md` PR2b 착수조건에 해당 제약이 **실제로 기술돼 있지 않아** plan 정합성 관점에서 누락이다. worktree 충돌 후보 2건 모두 stale 판정 불가(Step 3 fallback active), stale skip 0건.

---

## 위험도

HIGH
