## 발견사항

### [WARNING] `spec-exec-intake-queue` worktree 가 `spec/5-system/4-execution-engine.md` 에 미착수 구현 plan (`exec-intake-queue-impl.md`) 을 올려두고 있으며, impl-prep 검토 대상 파일과 동일
- target 위치: `spec/5-system/4-execution-engine.md` §4 (Worker 모델 / intake 큐), §7.1 (Heartbeat), §8 (동시 실행 제한) — 모두 미구현(Planned) 표시
- 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` (worktree `spec-exec-intake-queue`) — PR1~PR4 전부 미착수 (all unchecked)
- 상세: `spec-exec-intake-queue` worktree 는 `spec/5-system/4-execution-engine.md` 를 직접 수정한 상태(현재 ACTIVE, main 에 미머지)이며, 이 파일이 impl-prep 검토 범위(`spec/5-system/`) 에 포함된다. 해당 plan 은 §4 intake 큐 도입 · §7.1 heartbeat · §8 동시 실행 제한을 증분 구현하는 PR1~PR4 를 아직 착수하지 않은 상태로 추적하고 있다. 구현 착수 시 동일 파일 경합 위험이 있다.
- 제안: 구현 착수 전 `spec-exec-intake-queue` 의 변경(plan 추가 + spec 갱신)이 먼저 main 에 머지되어야 한다. 머지 확인 후 구현 worktree 를 신설하고 해당 plan 의 PR1 선결 조건("동기 caller 식별")을 충족시키는 순서를 따른다.

### [WARNING] `fix-bg-context-followups` worktree 도 `spec/5-system/4-execution-engine.md` 에 사소한 diff 를 보유 (활성 — 미머지)
- target 위치: `spec/5-system/4-execution-engine.md` §5.5 `createContext` 시그니처 한 줄
- 관련 plan: `plan/in-progress/background-context-key-followups.md` (worktree `fix-bg-context-followups`)
- 상세: `fix-bg-context-followups` 가 동일 파일에서 `createContext` 시그니처 서술 한 줄을 `options?:` 형태로 갱신 중이다. 내용이 다른 절과 겹치지는 않으나, 구현 착수 worktree 가 같은 파일을 수정하면 두 브랜치가 동시에 열려 있는 기간 동안 3-way merge 충돌이 발생할 수 있다.
- 제안: `fix-bg-context-followups` 머지를 impl 착수 전에 완료하거나, 머지 순서를 명시적으로 조율한다.

### [INFO] `spec-sync-execution-engine-gaps.md` 의 §4/§7.1/§8 미구현 항목이 `exec-intake-queue-impl.md` PR1~PR4 로 이관됨을 명시해 두는 것이 추적 일관성에 유리
- target 위치: `plan/in-progress/spec-sync-execution-engine-gaps.md` (worktree `spec-sync-audit`)
- 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` 서두 "전신" 언급
- 상세: `spec-sync-execution-engine-gaps.md` 의 §4 Worker 모델 / §7.1 Heartbeat / §8 동시 실행 제한 항목이 `exec-intake-queue-impl.md` 로 이관됐다고 명시돼 있으나 `spec-sync-execution-engine-gaps.md` 본문에는 해당 항목이 여전히 미체크로 남아 있다. 구현이 완료되면 `spec-sync-execution-engine-gaps.md` 를 forwarding 완료로 갱신하거나 complete/ 로 이동해야 한다.
- 제안: PR1 착수 시 `spec-sync-execution-engine-gaps.md` 에 "→ exec-intake-queue-impl.md 로 이관됨" 표기 추가. 해당 plan 은 `spec-sync-audit` worktree 에 있으므로 해당 worktree 에서 갱신.

### [INFO] `execution-engine-residual-gaps.md` G2 ("cross-instance 재개 인프라 부재") 와 PR3 의 관계가 미확정 — 부분 해소 범위를 PR3 착수 시 명시 필요
- target 위치: `spec/5-system/4-execution-engine.md` §7.5 rehydration (PR3 범위)
- 관련 plan: `plan/in-progress/execution-engine-residual-gaps.md` G2 (BLOCKED)
- 상세: `exec-intake-queue-impl.md` 는 PR3 이 G2 를 "부분 해소"한다고 서술하지만, `errorPolicy='continue'` 분기의 세그먼트 재개 설계는 여전히 미해결로 G2 가 BLOCKED 상태를 유지한다고 명시한다. PR3 착수 시 G2 를 완전 해소할 수 있는지 여부를 확인하고 `execution-engine-residual-gaps.md` 를 갱신해야 한다.
- 제안: PR3 착수 직전 `execution-engine-residual-gaps.md` G2 의 "부분 해소" 범위를 명시. 전체 해소되면 plan 을 complete/ 로 이동.

### [INFO] `kb-quality-fba2f2` worktree 가 `spec/5-system/4-execution-engine.md` 에 단순 앵커 링크 수정 보유
- target 위치: `spec/5-system/4-execution-engine.md` §6.2 (WebSocket 링크 앵커 갱신)
- 관련 plan: `plan/in-progress/rag-quality-improvement.md` (추정)
- 상세: diff 내용이 WebSocket 링크 앵커 표기 수정 1행에 불과하여 내용 충돌 위험이 낮다. 그러나 동일 파일을 세 개의 활성 worktree 가 동시에 건드리는 상황이므로 머지 순서 주의가 필요하다.
- 제안: `kb-quality-fba2f2` 와 `fix-bg-context-followups` 를 먼저 머지해 파일 경합 윈도우를 최소화.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

- `impl-exec-intake-queue` (branch `claude/impl-exec-intake-queue`) — Step 1 ancestor: `git merge-base --is-ancestor claude/impl-exec-intake-queue origin/main` exit 0 (STALE). PR #458 로 main 에 이미 포함됨. 해당 worktree 가 활성으로 남아있을 이유가 없으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/5-system/` 전체를 대상으로 한 구현 착수 전(impl-prep) 검토에서 CRITICAL 등급 사안은 없다. 주요 관심사는 `spec/5-system/4-execution-engine.md` 에 대한 세 활성 worktree 의 동시 수정 경합이다. `spec-exec-intake-queue`(미머지, exec-intake 구현 plan PR1~PR4 미착수), `fix-bg-context-followups`(createContext 시그니처 1줄 갱신), `kb-quality-fba2f2`(앵커 링크 1줄 갱신)가 모두 같은 파일을 건드리고 있으므로, 구현 worktree 신설 전 이들의 머지 순서를 조율하는 것이 권장된다. 미해결 결정과의 충돌이나 spec 약속의 일방적 우회는 발견되지 않았으며, 미구현 항목은 이미 "Planned" 로 마킹되어 plan 과 정합하다. worktree 충돌 후보 3건 중 stale 1건 skip (impl-exec-intake-queue, PR #458 머지 확인), active 2건 분석.

---

## 위험도

LOW

STATUS: SUCCESS
