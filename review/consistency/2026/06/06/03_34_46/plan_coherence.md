# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system, diff-base=origin/main)
Target plan: `plan/in-progress/exec-park-durable-resume.md`
Target 수정 파일 (origin/main 대비): `spec/5-system/4-execution-engine.md`, `spec/5-system/13-replay-rerun.md`

---

## 발견사항

- **[CRITICAL] `impl-concurrency-cap-pr2b` worktree 가 동일 spec 파일을 active 수정 중**
  - target 위치: `spec/5-system/4-execution-engine.md` (전체)
  - 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` — PR2b "착수 전 필수 — exec-park-pr-b2 머지 후 origin/main rebase 선행" 조건
  - 상세: worktree `impl-exec-concurrency-cap` (branch `claude/impl-concurrency-cap-pr2b`) 가 `spec/5-system/4-execution-engine.md`(PR-B1/B2 이전 pendingContinuations/firstSegmentBarriers/fast-path 이원화 서술 보유), `spec/5-system/1-auth.md`, `spec/5-system/17-agent-memory.md` 등 총 7개 `spec/5-system/` 파일을 origin/main 대비 수정 중이다. target plan(exec-park-pr-b2) 이 `spec/5-system/4-execution-engine.md` 에 "완료형 재전환(§4.x banner·§7.4·§Rationale L1257 갱신)" + `resume_call_stack` §6.2 추가 변경을 내리면, PR2b 가 rebase 없이 push 할 경우 해당 완료형 서술·call-stack 컬럼 추가가 덮어쓰이는 위협이 실존한다.
  - git merge-base Step 1: ACTIVE (HEAD 가 origin/main 조상 아님). Step 2: PR 상태 `[]` (GitHub PR 미발행 상태). Step 3 fallback: ACTIVE 처리.
  - 제안: `exec-intake-queue-impl.md` PR2b 착수조건("PR-B2 머지 후 rebase 선행")이 이미 명기되어 있으므로, **target plan(exec-park-pr-b2) 의 spec 변경(C5 완료형 재전환)이 origin/main 에 머지되는 즉시 `impl-concurrency-cap-pr2b` 브랜치가 rebase 를 이행하기 전까지 PR2b 코드 착수를 차단**하는 인터락이 두 plan 간에 문서화되어 있는지 재확인하고, 없다면 `exec-intake-queue-impl.md` 의 PR2b 착수조건 항목에 "PR-B2 spec 머지 확인" 체크를 명시적으로 추가한다.

- **[WARNING] PR-B2 spec 변경(C5) 이 origin/main 머지 전에 spec 만 선반영될 위험 — 동기화 선행조건 미확인**
  - target 위치: `spec-draft-exec-park-b2-durable.md` C5 "적용 전제(W3)" 조항
  - 관련 plan: `plan/in-progress/exec-park-durable-resume.md` §"진행 메모" W4 및 §"Spec 변경" 7번 항목
  - 상세: `spec-draft-exec-park-b2-durable.md` C5 는 "코드 머지 전에 spec 만 완료형으로 바꾸면 main 에서 spec↔구현 역전" 을 명시하고 있다. PR-B2 는 코드+spec 동시 랜딩 PR 이므로 정상이나, 본 consistency-check(--impl-done) 시점이 PR-B2 코드 구현 "완료" 후 머지 전이므로 현재 브랜치(`claude/exec-park-pr-b2`)에서 spec 수정이 선반영된 상태일 가능성을 확인해야 한다. `spec/5-system/4-execution-engine.md` 의 §4.x banner "PR-B2 미적용" 표기 제거가 실제 코드 제거보다 앞서 commit 되어 있다면 --impl-done 판정 자체가 spec 과 구현 사이의 순서 불일치를 내포한다.
  - 제안: PR-B2 가 단일 PR 로 코드+spec 을 동시에 담는다는 시퀀싱(사용자 결정 2026-06-06) 이 실제 commit 순서로도 유지되는지 — 즉 spec 재전환(C5) commit 이 코드 변경(단발 turn 처리기·B3 제거) commit 이후에 위치하는지 — git log 로 확인할 것.

- **[WARNING] PR-B2 미착수 항목(중첩 call stack D6) 이 spec 에 "완료형"으로 반영될 때 후속 plan 누락 가능성**
  - target 위치: `spec-draft-exec-park-b2-durable.md` C3(중첩 sub-workflow durable) 및 C5 spec 재전환
  - 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` PR3("크래시 RUNNING checkpoint 재개" — exec-park 로 이관), `plan/in-progress/node-cancellation-infrastructure.md` §2(B3 선행 후 rebase)
  - 상세: D6(중첩 call stack 영속)은 PR-B2 단일 PR 에 통합된다(사용자 결정 2026-06-06). D6 가 완료되면 `driveResumeDetached` 가 재귀 executeInline 재진입하는 새 재개 경로가 생긴다. `node-cancellation-infrastructure.md §2` 는 "B3(PR-B2 dispatch-path 정리) 선행 → 본 §2 는 그 결과 위로 rebase" 를 직렬화 순서로 확정했으나, D6 의 재귀 재진입 경로(`driveResumeDetached` 확장)가 cancellation §2 의 dispatch 직전 `abortSignal.aborted` 사전체크 삽입 지점과 정확히 어떤 함수 위치에서 겹치는지 명기되어 있지 않다. `exec-park-durable-resume.md` 에 "node-cancellation §2 는 B3 결과 위로 rebase" 만 있고, D6 의 재귀 재진입 신규 경로도 §2 의 rebase 대상에 포함됨이 `node-cancellation-infrastructure.md` 에 명시되어 있지 않다.
  - 제안: `node-cancellation-infrastructure.md §2` cross-link 항목에 "D6 재귀 executeInline 재진입 경로도 B3 결과에 포함 — rebase 시 해당 경로의 abortSignal.aborted 사전체크도 함께 커버" 한 줄 추가.

- **[WARNING] `exec-intake-queue-impl.md` PR3 이관 후 "PR3 미구현" 표기가 plan 본문에 일부 잔존 가능**
  - target 위치: `plan/in-progress/exec-intake-queue-impl.md` PR3 항목
  - 관련 plan: `plan/in-progress/exec-park-durable-resume.md` Phase 0 / Phase A2/B2
  - 상세: `exec-intake-queue-impl.md` PR3 는 "→ exec-park-durable-resume 로 이관(직접 구현)" 표기가 완료(2026-06-06)되었다고 plan 에 기록되어 있다. 그러나 PR3 의 구체 항목(rehydration 일반화 — ai_agent 너머 일반 노드, 멱등 jobId·NodeExecution.status 재검증, 완료 노드 미재실행)이 `exec-park-durable-resume.md` Phase A2/B2 의 어느 체크박스에 대응하는지 명시가 없다. PR-B2 구현 설계에 "완료노드 미재실행 멱등 유지" 가 D6 맥락으로 언급되어 있으나, PR3 의 "일반 노드(ai_agent 너머)" 확장 및 "멱등 jobId 재검증"이 어느 단계에 포함되는지 누락 상태다.
  - 제안: `exec-park-durable-resume.md` Phase B2 구현 설계 또는 Phase 0 항목에 PR3 이관 3항목(rehydration 일반화 + jobId 멱등 재검증 + 완료노드 미재실행)이 각각 어느 코드 변경에 대응하는지 한 줄씩 체크박스 형태로 등재.

- **[INFO] `spec/5-system/1-auth.md` 는 target plan 수정 대상이 아니나 `impl-concurrency-cap-pr2b` 가 동시 수정 중**
  - target 위치: 해당 없음 (target plan 은 `1-auth.md` 미수정)
  - 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` §consistency-check --impl-prep(auth Critical 2건 언급)
  - 상세: `impl-concurrency-cap-pr2b` 브랜치의 `spec/5-system/1-auth.md` 수정이 origin/main 과 diff 를 가짐. 이는 PR2a(#469) rebase 과정에서 남겨진 auth 관련 변경이거나 이미 main 에 포함된 변경이 stale 상태일 수 있다. exec-park target plan 은 `1-auth.md` 를 건드리지 않으므로 직접 충돌 없음. stale 정리 여부만 추적.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목: 없음 (0건).

후보 3개 (`impl-exec-concurrency-cap`, `fix-webchat-envelope-unwrap-9519af`, `rag-eval-harness-b8cc46`) 모두:
- Step 1 ancestor 검사: ACTIVE (origin/main 조상 아님)
- Step 2 GitHub PR: `[]` (PR 미발행)
- Step 3 fallback: ACTIVE 처리

`fix-webchat-envelope-unwrap-9519af` 및 `rag-eval-harness-b8cc46` 는 `spec/5-system/` 와 충돌 파일 없음 — CRITICAL 분류 제외, INFO 불요.

---

## 요약

`spec/5-system/4-execution-engine.md` 를 동시에 수정 중인 active worktree `impl-exec-concurrency-cap`(branch `claude/impl-concurrency-cap-pr2b`) 이 존재하며, PR-B2 spec 완료형 재전환(C5)이 origin/main 에 머지될 경우 해당 브랜치가 rebase 없이 push 하면 PR-B2 의 full-durable 서술이 덮어쓰이는 실질적 충돌 위협이 CRITICAL 등급이다. 이 충돌은 `exec-intake-queue-impl.md` 의 PR2b 착수조건에 이미 rebase 의무가 명기되어 있으나, 인터락이 두 plan 간 체크박스로 연결되어 있지 않아 운영 상 누락 위험이 있다. 추가로 D6 재귀 재진입 경로와 `node-cancellation-infrastructure.md §2` 의 겹치는 범위, PR3 이관 항목의 exec-park plan 내 대응 미기록이 WARNING 수준의 후속 항목 누락이다. worktree 충돌 후보 3건 중 stale 0건 skip, active 3건 분석 (1건 CRITICAL, 2건 충돌 파일 없어 제외).

---

## 위험도

HIGH
