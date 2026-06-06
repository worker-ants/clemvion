# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/spec-draft-exec-park-b2-durable.md`
검토 시각: 2026-06-06
검토 모드: spec draft (--spec)

---

## 발견사항

### [WARNING] `impl-concurrency-cap-pr2b` worktree 가 동일 spec 파일 2건을 보유 — rebase 미이행 시 덮어쓰기 위험

- **target 위치**: C1 (`spec/5-system/1-data-model.md §2.13` — `resume_call_stack` 행 추가), C5 (`spec/5-system/4-execution-engine.md` — §4.x banner 완료형 전환·§7.4 L829 단서 제거·§Rationale L1257 갱신·§6.2·§7.5)
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` PR2b 섹션
- **상세**: active worktree `impl-exec-concurrency-cap`(branch `claude/impl-concurrency-cap-pr2b`)가 `spec/5-system/4-execution-engine.md` 와 `spec/1-data-model.md` 를 **PR-B1·Phase A 이전 모델**(V084/V085 미포함, `pendingContinuations`/`firstSegmentBarriers`/fast-path 이원화 서술 보유)로 보유하고 있다. 해당 분기가 origin/main rebase 없이 push·merge 되면 PR-B2 가 확정한 complete-durable 서술과 `resume_call_stack`(C1), 완료형 banner(C5)가 덮어써진다.
  - git diff 확인: `git diff --name-only origin/main claude/impl-concurrency-cap-pr2b | grep spec` → `spec/5-system/4-execution-engine.md`, `spec/1-data-model.md` 등 22개 파일 포함.
  - `impl-concurrency-cap-pr2b` 의 `spec/5-system/4-execution-engine.md` 에는 `pendingContinuations`·`firstSegmentBarriers`·"PR-B2 미적용" 서술이 그대로 남아 있다.
  - `spec/1-data-model.md` 에는 `conversation_thread`, `user_variables`, `resume_call_stack` 컬럼이 없다(Phase A/B 이전 상태).
  - 이 위험은 `exec-park-durable-resume.md` 진행메모 W4 + `exec-intake-queue-impl.md` PR2b 착수조건에 이미 기록됐다. spec-draft 문서(target)는 W5로 명시.
- **제안**: spec-draft 문서(C5 주석 W5) 에 이미 기록됨 — 별도 spec 문서 수정 불필요. 단, `exec-intake-queue-impl.md` PR2b 착수조건의 "PR-B2 머지 후 rebase 선행" 명기가 **PR-B2 merge 시점 즉시 체크**되어야 한다. target spec-draft 의 C5 전제(W3)도 PR-B2 코드와 spec 이 동일 PR 로 머지됨을 재확인.

---

### [INFO] `spec/4-nodes/2-flow/1-workflow.md §4` 추가 항목(W2) — 후속 plan 반영 필요

- **target 위치**: Rationale 마지막 단락 "spec 적용 시 챙길 동기화" — `§4-nodes/2-flow/1-workflow.md §4` 에 "sync sub-workflow 내부 blocking park 시 executeInline 도 PARK_RELEASED 버블업" 추가(W2)
- **관련 plan**: 현재 in-progress plan 목록에 `spec/4-nodes/2-flow/1-workflow.md` 를 추적하는 별도 plan 없음.
- **상세**: 본 spec-draft 가 `workflow.md §4` 변경을 요구하지만 해당 파일을 추적하는 별도 plan 이 없다. 변경 범위는 소규모(단일 항목 추가)라 본 draft 적용 시 함께 처리 가능하나, 적용 과정에서 누락 위험이 있다.
- **제안**: target spec-draft 에서 W2 를 "본 plan 적용 커밋에서 함께 처리" 로 명시하거나, `exec-park-durable-resume.md` Spec 변경 섹션에 `spec/4-nodes/2-flow/1-workflow.md §4` 변경 항목을 추가.

---

### [INFO] 마이그레이션 번호 V087 — PR race 대비 재확인 의무 기록 (이미 plan 내 명시)

- **target 위치**: C1 마이그레이션 항목 — "구현 착수 직전 `ls migrations/V08* | tail -2` 재확인 후 확정"
- **관련 plan**: `exec-park-durable-resume.md` + `exec-intake-queue-impl.md`
- **상세**: 현재 V086 은 `impl-concurrency-cap-pr2b` 분기가 `V086__agent_memory_scope_updated_index` 로 이미 사용 중(main HEAD `21fa8194` 에서 머지 완료). 따라서 next 는 V087 이 맞다. target spec-draft 가 "구현 착수 직전 재확인" 을 이미 명시하고 있어 올바른 가드가 있다. 단, PR2b 착수 시 V087 을 이 PR-B2 가 선점하므로 PR2b 는 V088+ 를 써야 한다 — `exec-intake-queue-impl.md` PR2b 착수조건에 이미 "마이그레이션 번호도 그때 재검증" 이 기록됨. 추가 조치 불필요.
- **제안**: 현재 기록으로 충분. 참고용 INFO.

---

### [INFO] Stale worktree skip 목록

아래는 활성 worktree 충돌 후보 중 stale 판정 cascade 를 적용한 결과다.

활성 worktree 목록 (git worktree list):
1. `exec-park-durable-resume` — target plan 자신 (claude/exec-park-pr-b2)
2. `impl-exec-concurrency-cap` — branch `claude/impl-concurrency-cap-pr2b` → ACTIVE (Step 1: non-ancestor, Step 2: no PR found, Step 3: active fallback)
3. `fix-webchat-envelope-unwrap-9519af` — branch `claude/fix-webchat-envelope-unwrap-9519af` → 대상 spec 파일 무접촉 (execution-engine.md / data-model.md / migrations.md / workflow.md 미수정), 충돌 후보 아님
4. `rag-eval-harness-b8cc46` — branch `claude/rag-eval-harness-b8cc46` → 대상 spec 파일 무접촉, 충돌 후보 아님

**stale 로 skip 된 worktree: 0건.** 모든 worktree 가 Step 1/2 에서 ACTIVE 로 분류되거나 충돌 대상 파일 무접촉.

> `impl-exec-concurrency-cap`(branch `claude/impl-concurrency-cap-pr2b`): Step 1 non-ancestor(ACTIVE), Step 2 PR 없음 → Step 3 fallback active. 실제 active 이며 `exec-intake-queue-impl.md` PR2b 착수조건에 재확인 의무가 등록돼 있다.

---

## 요약

검토 모드 --spec 관점에서 target `spec-draft-exec-park-b2-durable.md` 는 전반적으로 정합하다. 미해결 결정(D1~D6)은 모두 `exec-park-durable-resume.md` 에서 이미 확정됐고, target 은 그 결정을 충실히 따른다. 주요 위험은 active worktree `impl-exec-concurrency-cap`(PR2b)가 동일 spec 파일 2건(`spec/5-system/4-execution-engine.md`, `spec/1-data-model.md`)을 PR-B2 이전 모델로 보유해 rebase 누락 시 덮어쓸 수 있다는 점이며, 이는 target 내 W5 + `exec-intake-queue-impl.md` PR2b 착수조건에 이미 기록되어 있다. 미해결 결정과의 충돌 0건, 선행 plan 미해소 0건. `spec/4-nodes/2-flow/1-workflow.md §4` 변경(W2)은 추적 plan 이 없어 적용 시 누락 위험이 있다. worktree 충돌 후보 3건 모두 cascade Step 1/2 로 ACTIVE 판정, stale skip 0건.

---

## 위험도

LOW
