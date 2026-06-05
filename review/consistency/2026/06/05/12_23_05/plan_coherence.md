# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)
Target: `spec/5-system/` 범위 (실질 영향 파일: `spec/5-system/4-execution-engine.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/3-information-extractor.md`)
Source plan: `plan/in-progress/exec-park-durable-resume.md` (worktree: `exec-park-durable-resume`, branch `claude/exec-park-a2b-infoextractor`)

---

## 발견사항

### [WARNING] exec-park-durable-resume 이 `spec/5-system/4-execution-engine.md` pending_plans 에 미등록 (main 기준)

- **target 위치**: `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:`
- **관련 plan**: `plan/in-progress/exec-park-durable-resume.md` (본 plan)
- **상세**: main HEAD (`9f30216f`) 기준 `spec/5-system/4-execution-engine.md` 의 `pending_plans` 에는 `exec-park-durable-resume.md` 가 없다. 워크트리(exec-park-a2b-infoextractor 브랜치) 에서는 추가됐으나 main 에 미반영 상태다. A1(PR #470)이 main 에 랜딩됐을 때 함께 추가됐어야 했다. `conversation-thread.md` 와 `1-data-model.md §2.13` 은 A1 에서 갱신됐으나 execution-engine spec frontmatter 의 pending_plans 행은 현재 브랜치에서만 존재한다.
- **제안**: PR-A2b 머지 전 또는 직후 `spec/5-system/4-execution-engine.md` frontmatter에 `plan/in-progress/exec-park-durable-resume.md` 를 추가하는 별도 커밋(또는 이번 PR 에 포함)이 필요하다. ※ 워크트리에서는 이미 추가됨 — main 반영 여부만 확인 필요.

---

### [WARNING] Phase B 선행 조건(D4 Rationale 명문화)이 미완이나 Phase B 미착수이므로 즉시 차단은 아님

- **target 위치**: `plan/in-progress/exec-park-durable-resume.md` §Spec 변경 섹션 — "Phase B 선행 — 구현 착수 전 의무: D4 turn-단위 park Rationale 명문화"
- **관련 plan**: 동일 plan
- **상세**: exec-park plan 은 Phase B 착수 전 `4-execution-engine.md §4.x` 에 D4(turn-단위 park) Rationale 명문화를 의무로 명시하고 있으나, 현재 브랜치(A2b 완료 후)는 Phase B 미착수 상태다. Phase A 완료 시점을 기준으로 Phase B 전 이 조건이 해소됐는지 확인 체크포인트가 없다.
- **제안**: Phase B PR 착수 직전 check 항목으로 plan 에 명시적 체크박스 추가 권장. 현재는 차단 아님.

---

### [WARNING] `spec/5-system/4-execution-engine.md` 가 exec-park 브랜치와 `impl-exec-intake-queue` 워크트리(MERGED PR#463 squash) 에서 동시 수정됨

- **target 위치**: `spec/5-system/4-execution-engine.md` (exec-park 브랜치에서 수정)
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` (worktree: `impl-exec-intake-queue`, branch `claude/impl-exec-intake-queue`)
- **상세**: `claude/impl-exec-intake-queue` 브랜치는 Step 2 검사(PR #463 MERGED)로 stale 판정 — 아래 "Stale skip" 섹션 참조. 단, `plan/in-progress/spec-sync-execution-engine-gaps.md` 역시 같은 worktree 가 가리키는 파일이므로 동일 stale 판정.

---

### [WARNING] `plan/in-progress/exec-park-durable-resume.md` Phase 0 미완 항목 — node-cancellation §2 직렬화 순서 미확정

- **target 위치**: `plan/in-progress/exec-park-durable-resume.md` §Phase 0 세 번째 체크박스: "(A2/B 착수 전) node-cancellation §2(`NodeExecution.status='cancelled'` enum·재개 경로)와의 직렬화 순서·status 가드 겹침 확정"
- **관련 plan**: `plan/in-progress/node-cancellation-infrastructure.md` §2 (worktree: `(unstarted)`)
- **상세**: node-cancellation-infrastructure §2 는 `NodeExecution.status='cancelled'` enum/migration(V069) + 엔진 dispatch 사전체크 + AbortError→CANCELLED 분류를 다루며, exec-park 의 Phase A2/B2 재개 경로(rehydration dispatch) 와 status 가드 겹침이 있다고 plan 에 명시돼 있다. 단, Phase B 는 아직 미착수이므로 직렬화 순서 미확정이 현 Phase A2b 구현을 차단하지는 않는다. B 착수 전 확정 필요.
- **제안**: Phase B PR 착수 이슈 트래킹용으로 plan 에 명시적 pre-check 항목 유지 필요. 현재 상태는 적절.

---

### [WARNING] `1-ai-agent.md` 를 exec-park 브랜치와 `agent-memory-summary-model-fa4efb` 브랜치(PR #473 OPEN) 가 동시 수정 — 머지 충돌 위험

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` (exec-park-a2b-infoextractor 브랜치: `_resumeCheckpoint` 설명에서 "ai_agent 한정" → "ai_agent · information_extractor" 로 변경, pending_plans 추가)
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` (worktree: `ai-context-memory-9c7e6e`), 현재 구현 브랜치는 `claude/agent-memory-summary-model-fa4efb` (PR #473 OPEN)
- **상세**: `claude/agent-memory-summary-model-fa4efb`(PR #473 OPEN, Step 2 ACTIVE 확인) 가 `spec/4-nodes/3-ai/1-ai-agent.md` 에 `summaryModel`/`extractionModel` 2필드 + §12.12 개정 + visibleWhen + Config echo 섹션 수정을 가한다. exec-park 브랜치는 같은 파일의 §7.5 `_resumeCheckpoint` 설명 행 + frontmatter `pending_plans` 를 수정한다. 수정 라인이 다르나 같은 파일을 동시에 변경하므로 **머지 순서에 따라 conflict 발생 가능**. 두 브랜치 모두 독립적으로 자기완결(의미 겹침 없음)하나 textual conflict 위험.
- **제안**: 두 브랜치 중 어느 쪽이 먼저 머지되면 나머지가 rebase 필요. exec-park A2b 는 작은 변경이므로 PR #473 머지 후 rebase 하는 순서가 낮은 충돌 risk. 또는 plan 상호 cross-ref 에 순서 명시 권장.

---

### [INFO] `spec/5-system/4-execution-engine.md` 의 §4.x 주석에 fast-path 관련 서술이 여전히 현행 구현 설명으로 남아있음 — Phase B 완료 전까지 정상

- **target 위치**: `spec/5-system/4-execution-engine.md` §4.x 현재 구현 메모 (L403 부근): "현재 재개 경로와 알려진 한계 — park 후 `runExecution` 코루틴은 in-process 로 살아 있어..."
- **관련 plan**: `plan/in-progress/exec-park-durable-resume.md` Phase B 완료 후 §Spec 변경 의무
- **상세**: A1/A2a/A2b 완료 후에도 fast-path 서술이 남는 것은 Phase B 미착수라 정상이다. Phase B 구현 완료 후 §Spec 변경 체크박스(plan §Spec 변경 항목)에 따라 이 서술을 갱신해야 한다.
- **제안**: 현재 상태로 문제없음. Phase B PR 에서 spec 갱신 범위 확인 필요.

---

### [INFO] `plan/in-progress/exec-intake-queue-impl.md` 의 "후속(project-planner)" 항목 2건 — exec-park 와 무관하나 추적 필요

- **target 위치**: `plan/in-progress/exec-intake-queue-impl.md` §SPEC-DRIFT 반영 후속 미완 2건: (1) `spec/data-flow/3-execution.md §1.1 시퀀스 + §2.2 BullMQ 표 + data-flow/0-overview.md §4 + 16-system-status-api.md §1 에 `execution-run` 반영`, (2) `execution-run` 을 `MONITORED_QUEUES` + e2e `EXPECTED_QUEUE_NAMES` 에 등록(PR2 이관)
- **관련 plan**: exec-park 와 직접 충돌 없음. exec-park 의 Phase B 는 `execution-run` 큐를 직접 수정하지 않음.
- **상세**: exec-intake-queue PR1 MERGED 이후 spec/data-flow 계열 문서 갱신이 남아있다. exec-park Phase B 가 `runExecutionFromQueue`/`applyContinuation` 을 수정하므로, 동일 섹션(data-flow §2.2 BullMQ 표)의 추가 수정이 겹칠 수 있다.
- **제안**: exec-park Phase B 착수 시 data-flow 계열 갱신과 scope 조율 필요. PR2 이관 항목(`MONITORED_QUEUES`)은 exec-park 범위 외.

---

### [INFO] D2 (user-defined variables 복원 범위) 미결 결정 — A3 착수 전 필요

- **target 위치**: `plan/in-progress/exec-park-durable-resume.md` §미해결 결정 D2
- **관련 plan**: 해당 plan 자체
- **상세**: D2 는 "user-defined variables 복원을 본 plan 에 포함할지, 별도 plan 분리할지" 미결이다. A3 항목(user-defined variables 영속)이 체크박스로 남아있다. 이 결정이 spec 갱신(data-model, execution-engine §6.2) 을 수반하므로 A3 착수 전 user/planner 합의가 필요하다.
- **제안**: D2 결정을 사용자에게 확인 후 A3 착수 여부 결정.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정 으로 skip 된 항목:

- `impl-exec-intake-queue` (branch `claude/impl-exec-intake-queue`) — Step 1 ancestor: ACTIVE (squash merge 로 hash 불일치), Step 2 PR #463 state: MERGED. **stale** 판정 — `spec/5-system/4-execution-engine.md` 수정 이력이 있으나 PR 종결로 경합 없음.
- `spec-exec-intake-queue` (branch `claude/spec-exec-intake-queue`) — Step 1 ancestor: ACTIVE, Step 2 PR: MERGED. **stale** 판정.
- `agent-memory-admin-ui-455467` (branch `claude/agent-memory-admin-ui-455467`) — Step 1 ancestor: ACTIVE, Step 2 PR: MERGED. **stale** 판정.
- `fix-bg-context-followups` (branch `claude/fix-bg-context-followups`) — Step 1 ancestor: ACTIVE, Step 2 PR: MERGED. **stale** 판정.
- `fix-spec-frontmatter-catalog` (branch `claude/fix-spec-frontmatter-catalog`) — Step 1 ancestor: ACTIVE, Step 2 PR: MERGED. **stale** 판정.
- `spec-inprogress-groom-c7568b` (branch `claude/spec-inprogress-impl2`) — Step 1 ancestor: STALE. **stale** 판정.
- `agent-summary-token-incremental-1fea7e` (branch `claude/agent-summary-token-incremental-1fea7e`) — Step 1 ancestor: ACTIVE, Step 2 PR: MERGED. **stale** 판정.
- `agent-memory-embedding-model` (branch `claude/agent-memory-embedding-model`) — Step 1 ancestor: STALE. **stale** 판정.

stale 판정 워크트리 8건 모두 정리 대상. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

**Non-stale, active worktree 충돌 분석 대상:**
- `agent-memory-summary-model-fa4efb` (branch `claude/agent-memory-summary-model-fa4efb`) — Step 1: ACTIVE, Step 2 PR #473: OPEN. **active** 판정 → WARNING §5 항목으로 보고됨 (1-ai-agent.md 동시 수정).
- `impl-exec-concurrency-cap` (branch `claude/impl-concurrency-cap-pr2b`) — Step 2 PR: 미발견(존재 미확인). 파일 수정 범위가 `plan/in-progress/exec-intake-queue-impl.md` 만이므로 spec 충돌 없음 → 분석 대상 제외.

---

## 요약

`exec-park-durable-resume` plan 은 Phase A1/A2a/A2b 완료 시점 기준으로 target spec 들(`4-execution-engine.md`, `1-ai-agent.md`, `3-information-extractor.md`)과 전반적으로 정합하다. 주요 미해결 결정(D2·D3)은 Phase A3/B 미착수 상태에서 합리적으로 미결이며, Phase B 선행 의무(D4 Rationale 명문화·node-cancellation §2 직렬화)도 현 시점 비차단이다. 주의 사항은 두 가지: (1) `1-ai-agent.md` 를 동시에 수정 중인 PR #473(OPEN)과의 textual 충돌 위험 — 머지 순서 조율 필요, (2) main 기준 `4-execution-engine.md` frontmatter `pending_plans` 에 본 plan이 미등록 — PR-A2b 포함 또는 후속 커밋 필요. worktree 충돌 후보 8건은 stale(MERGED/CLOSED PR) 확인, active 2건 중 1건이 WARNING 수준 충돌이며 나머지는 spec 범위 겹침 없음. 전체 위험도는 LOW.

---

## 위험도

LOW
