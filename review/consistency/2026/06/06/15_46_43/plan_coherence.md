# Plan 정합성 검토 결과

검토 모드: `--impl-done` (scope=`spec/5-system/4-execution-engine.md`, diff-base=`origin/main`)
대상 worktree: `exec-park-b2b-04a2f8` (branch `claude/exec-park-b2b-04a2f8`)
검토 대상 plan: `plan/in-progress/exec-park-durable-resume.md`, `plan/in-progress/spec-draft-exec-park-b2-durable.md`

---

## 발견사항

### [INFO] PR-B2b 완료형 spec 전환 — 전제 조건(W3/C5) 충족 확인
- target 위치: `spec/5-system/4-execution-engine.md` §4.x banner 2개, §7.4 Worker 동작, §Rationale
- 관련 plan: `spec-draft-exec-park-b2-durable.md` C5 (W3 전제)
- 상세: `spec-draft-exec-park-b2-durable.md` C5 에서 "완료형 spec 갱신은 PR-B2 코드와 같은 PR 로 함께 머지될 때만 적용"이라 명시했다. target 브랜치는 코드 변경(`refactor(execution-engine): PR-B2b full B3 — in-memory continuation/barrier 머신 완전 제거`)과 spec 변경(`docs(spec): PR-B2b exec-park D6 + full B3 완료형 flip`)을 동일 branch 에 함께 담고 있어 전제 충족. 머지 시점에 spec↔구현 역전 없음.
- 제안: 이상 없음. 단순 추적 메모.

### [INFO] impl-concurrency-cap-pr2b rebase 착수조건 — exec-intake-queue-impl.md 에 이미 명기
- target 위치: 해당 없음 (target 이 직접 명기 불요)
- 관련 plan: `exec-park-durable-resume.md` §진행메모 W4, `exec-intake-queue-impl.md` PR2b 착수조건
- 상세: `exec-park-durable-resume.md` W4 와 `exec-intake-queue-impl.md` PR2b 착수조건에 "PR-B2 머지 후 `impl-concurrency-cap-pr2b` rebase 선행" 이 명기돼 있다. target 의 PR-B2b 가 머지되면 이 조건이 발동한다. plan 간 추적은 이미 존재하나, target PR 이 실제로 머지되는 시점에 담당자가 해당 조건을 이행해야 함을 재확인할 필요가 있다.
- 제안: `exec-intake-queue-impl.md` 의 기존 명기로 충분하나, PR-B2b 머지 후 planner 가 `impl-concurrency-cap-pr2b` worktree 에 rebase 지시를 능동 전달하는 것이 권장됨.

### [WARNING] `spec/5-system/4-execution-engine.md` 및 `spec/1-data-model.md` 동시 수정 — impl-concurrency-cap-pr2b worktree와 파일 경합
- target 위치: `spec/5-system/4-execution-engine.md` 전체, `spec/1-data-model.md`
- 관련 plan: `exec-intake-queue-impl.md` PR2b (worktree `claude/impl-concurrency-cap-pr2b`)
- 상세: `claude/impl-concurrency-cap-pr2b` 브랜치가 `origin/main` 대비 `spec/5-system/4-execution-engine.md` 와 `spec/1-data-model.md` 를 동시에 보유하고 있다. target 브랜치도 동일 두 파일을 변경한다. 브랜치 `claude/impl-concurrency-cap-pr2b` 는 Step 1(ancestor 검사)에서 ACTIVE, 이에 PR state 를 확인했으나 PR 이 생성되지 않아 결과가 비어있다. 커밋 내역 상 해당 브랜치에는 docs/plan 커밋 1건만 있고 실제 spec 변경 내용은 `origin/main` 기반 squash 이전 이력에서 이어받은 것으로 추정된다. 즉 해당 브랜치의 spec 내용이 Phase B 이전 모델(PR-B1/B2 이전 `pendingContinuations`/`firstSegmentBarriers`/fast-path 이원화 서술, V084/V085 이전 data-model)을 보유할 수 있다. target PR-B2b 가 main 에 먼저 머지된 후 `impl-concurrency-cap-pr2b` 가 rebase 없이 push 되면, target 이 작성한 완료형 서술과 `resume_call_stack`(V087) 컬럼 행이 덮어써질 위험이 있다.
- 제안: target PR-B2b 머지 직후, `exec-intake-queue-impl.md` 에 명기된 착수조건(rebase 선행)이 실제로 이행되는지 확인 필요. `plan/in-progress/exec-intake-queue-impl.md` PR2b 착수조건 체크박스를 확인하고 `impl-concurrency-cap-pr2b` worktree 에 rebase 를 명시적으로 지시.

### [INFO] Phase 0 미완료 항목(PR3 rehydration 일반화) — target 범위 내 구현 확인 필요
- target 위치: 해당 없음 (spec 변경 직접 충돌 없음)
- 관련 plan: `exec-park-durable-resume.md` §Phase 0, `exec-intake-queue-impl.md` PR3
- 상세: `exec-park-durable-resume.md` Phase 0 에 "PR3 의 rehydration 일반화(ai_agent → 일반 노드) + 멱등 재개를 본 plan A2/B2 로 직접 구현" 이 `[ ]` 미체크 상태로 남아 있다. target 브랜치 commit 이력상 PR-B2b 는 중첩 call-stack durable + full B3 에 집중하며, 일반 노드(ai_agent 아닌 노드)로의 rehydration 확장·멱등 재개(jobId·NodeExecution.status 재검증)는 명시적으로 커버됐는지 plan 에서 확인이 안 된다. 단 이 항목은 spec 정합 차단이 아니라 기능 누락 위험 수준으로, target 의 spec 텍스트와 직접 충돌하지는 않는다.
- 제안: `exec-park-durable-resume.md` Phase 0 미체크 항목을 PR-B2b 완료 후 검토하여, 구현됐으면 체크, 미구현이면 후속 plan 에 이관 표기.

### [INFO] `spec-draft-exec-park-b2-durable.md` worktree 선언과 target worktree 불일치 — 추적 메모
- target 위치: 해당 없음
- 관련 plan: `spec-draft-exec-park-b2-durable.md` frontmatter `worktree: exec-park-durable-resume`
- 상세: `spec-draft-exec-park-b2-durable.md` 는 frontmatter 에 `worktree: exec-park-durable-resume` 를 선언하나 실제 구현은 `exec-park-b2b-04a2f8` worktree 에서 이루어졌다. 이는 plan 이 초안 단계에서 작성됐고 분할 결정(PR-B2b) 이후 별도 worktree 에서 실행된 결과다. 충돌 위험은 없으나 frontmatter 불일치가 추적 추론 시 혼선을 유발할 수 있다.
- 제안: PR-B2b 완료 후 `spec-draft-exec-park-b2-durable.md` 를 `plan/complete/` 로 이동 시 worktree 필드를 `exec-park-b2b-04a2f8` 로 정정하거나 note 추가.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 전수 조사 결과:

| 브랜치 | Step 1 | Step 2 (PR state) | 판정 |
|---|---|---|---|
| `claude/exec-park-a2-checkpoint` | ACTIVE (non-ancestor) | MERGED (#?) | **stale** — skip |
| `claude/exec-park-a2b-infoextractor` | ACTIVE (non-ancestor) | MERGED | **stale** — skip |
| `claude/exec-park-a3-variables` | ACTIVE (non-ancestor) | MERGED | **stale** — skip |
| `claude/exec-park-b1` | ACTIVE (non-ancestor) | MERGED | **stale** — skip |
| `claude/exec-park-durable-resume` | ACTIVE (non-ancestor) | MERGED (PR #470, A1 only) | **stale** — skip (브랜치에 8개 미머지 커밋 잔류 — A1 이후 docs 커밋들. main 에 흡수되지 않은 내용이나 spec/코드 추가 변경 없이 plan 문서/review 커밋만 포함. 충돌 위험 없음.) |
| `claude/exec-park-pr-b2` (PR-B2a) | ACTIVE (non-ancestor) | MERGED (PR #494) | **stale** — skip |
| `claude/exec-park-phaseb` | ACTIVE (non-ancestor) | MERGED | **stale** — skip |
| `claude/impl-concurrency-cap-pr2b` | ACTIVE (non-ancestor) | PR 없음 (empty response) | **active** — §5번 검토 대상 (WARNING 위 참조) |

stale skip 개수: 7건. active 분석: 1건 (`claude/impl-concurrency-cap-pr2b`).

stale 브랜치들의 worktree 가 아직 `.claude/worktrees/` 에 활성 마운트로 남아있다면 `./cleanup-worktree-all.sh --yes --force` 실행을 권장한다. 현재 확인된 worktrees: `exec-park-b2b-04a2f8`(현재 작업), `exec-park-durable-resume`(PR #470 MERGED — 정리 대상).

---

## 요약

target 브랜치(`claude/exec-park-b2b-04a2f8`)의 `spec/5-system/4-execution-engine.md` 변경은 `exec-park-durable-resume.md` 의 모든 확정 결정(D1~D6)과 정합하며, `spec-draft-exec-park-b2-durable.md` 의 C1~C5 변경 요지를 충실히 반영한다. 미해결 결정은 D1~D6 모두 확정 완료 상태이고, target 이 일방적으로 미결 항목을 결정하거나 충돌하는 케이스는 없다. 유일한 실질적 위험은 `claude/impl-concurrency-cap-pr2b` worktree 가 동일 spec 파일(`spec/5-system/4-execution-engine.md`, `spec/1-data-model.md`)을 Phase B 이전 모델로 보유한 채 미rebase 상태라는 점으로, target PR-B2b 머지 후 해당 브랜치가 rebase 없이 push 되면 완료형 서술·V087 컬럼 행이 덮어써지는 오버라이트 리스크가 있다(plan 에 착수조건으로 이미 등재됨 — 이행 여부 모니터링 필요). worktree 충돌 후보 8건 중 stale 7건 skip, active 1건 분석.

---

## 위험도

LOW
