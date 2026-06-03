# Plan 정합성 검토 결과

대상: `plan/in-progress/spec-draft-exec-intake-queue.md`
검토 시각: 2026-06-04

---

## 발견사항

### [WARNING] spec-sync-execution-engine-gaps.md §4/§7.1/§8 항목 전달 미완료

- **target 위치**: `spec-draft-exec-intake-queue.md` §후속 "side-effect — spec-sync plan 정리" (`[ ]` 체크박스)
- **관련 plan**: `plan/in-progress/spec-sync-execution-engine-gaps.md` — §4 Worker 모델, §7.1 Worker Heartbeat, §8 동시 실행 제한을 `[ ]` 미구현 aspirational 항목으로 추적 중
- **상세**: target plan 은 §4 per-node 모델을 execution-level intake 큐로 대체, §7.1 heartbeat 을 BullMQ stalled-job 으로 일원화, §8 wall-clock 타임아웃을 active-running 누적 기준으로 재정의한다. 이 결과 `spec-sync-execution-engine-gaps.md` 의 세 `[ ]` 항목은 "per-node 모델 폐기로 대체됨" 으로 forwarding 닫혀야 한다. target plan 이 이를 인식하고 후속 `[ ]` 에 명시했으나, 이 업데이트는 spec 본문 반영 이전에도 plan 간 일관성 측면에서 수행될 수 있다. spec 반영 시점까지 미루면 `spec-sync-execution-engine-gaps.md` 가 이미 폐기된 aspirational 항목을 살아있는 미구현 surface 로 오인하게 한다.
- **제안**: `spec-draft-exec-intake-queue.md` 의 "후속" 항목 순서를 조정하거나, `spec-sync-execution-engine-gaps.md` 에 즉시 "본 draft 로 forwarding — per-node 모델 폐기" 메모를 추가한다. plan 파일 수정은 spec 반영 전에도 가능하다.

---

### [WARNING] execution-engine-residual-gaps.md G2 관계 명시 미완료

- **target 위치**: `spec-draft-exec-intake-queue.md` §후속 "execution-engine-residual-gaps.md G2(cross-instance 재개)와 §7.1 stalled 재배달의 관계 명시" (`[ ]`)
- **관련 plan**: `plan/in-progress/execution-engine-residual-gaps.md` G2 — "cross-instance mid-execution 재개 인프라" 부재를 BLOCKED 이유 중 하나로 명시. G2 는 `errorPolicy='continue'` 인터럽트 노드의 cross-instance 재개 문제이고, target plan 의 §7.1 stalled-job 재배달은 "active 세그먼트 워커 크래시 후 다른 워커가 §7.5 rehydration 으로 재개" 를 제공한다.
- **상세**: G2 의 "cross-instance 재개 인프라 부재" 차단 사유가 target 의 stalled-job 재배달로 부분 해소되는지, 아니면 G2 의 `errorPolicy` 분기 요구사항은 별개인지 명확히 해야 한다. 현재 target plan 은 이를 후속 `[ ]` 로만 남겼다. G2 가 여전히 BLOCKED 상태로 유지된다면 target 이 해결하는 것과 G2 가 요구하는 것의 차이를 plan 에 명시해야 다음 진입자가 혼동하지 않는다.
- **제안**: `execution-engine-residual-gaps.md` G2 에 "target spec-draft-exec-intake-queue §7.1 stalled-job 으로 'cross-instance 재개 인프라 부재' 차단 사유 부분 해소 — 단, errorPolicy='continue' 분기 설계는 별도 미해결" 메모를 추가하거나, target plan §후속을 구체화한다.

---

### [INFO] spec/0-overview.md 동시 편집 — ai-context-memory-9c7e6e worktree (인접 하지 않음, self-noted)

- **target 위치**: `spec-draft-exec-intake-queue.md` §6 (§0-overview §2.4/§2.6/Rationale 수정) + §후속 "merge 순서 메모"
- **관련 plan**: worktree `ai-context-memory-9c7e6e` (OPEN PR, branch `claude/ai-context-memory-9c7e6e`) — `spec/0-overview.md` 를 동시에 편집 중
- **상세**: `ai-context-memory-9c7e6e` 의 변경은 line 135 (디렉토리 표 한 셀 수정) 에 한정된다. target plan 이 변경하려는 §2.4 (~line 226-231), §2.6 (~line 240-243), Rationale (~line 380)과 물리적으로 분리된 hunk 이다. 병합 시 git 자동 해소 가능성이 높다. target plan 이 이미 "merge 순서 메모" 로 이를 인식·명시하고 있어 절차상 문제없다.
- **제안**: 추적 메모 수준 — 조치 불요. target plan 의 "해당 PR 선행 병합 후 base 최신화 또는 수동 resolve" 절차를 따른다.

---

### [INFO] spec/1-data-model.md 동시 편집 — kb-quality-fba2f2 worktree (비겹침)

- **target 위치**: `spec-draft-exec-intake-queue.md` §후속 `spec/1-data-model.md §2.13` EXECUTION_TIME_LIMIT_EXCEEDED 반영 (~line 447)
- **관련 plan**: worktree `kb-quality-fba2f2` (OPEN PR #457) — `spec/1-data-model.md` 를 lines 174, 268, 289, 305, 755 에서 편집 중
- **상세**: target 이 수정하려는 §2.13 (line ~434-460) 과 `kb-quality-fba2f2` 의 변경 라인이 겹치지 않는다. 병합 충돌 위험 낮음.
- **제안**: 추적 메모 수준 — 조치 불요.

---

### [INFO] spec/5-system/4-execution-engine.md 동시 편집 — kb-quality-fba2f2 worktree (비겹침)

- **target 위치**: `spec-draft-exec-intake-queue.md` — §4 (~line 346-400), §7.1 (~line 742), §7.2 (~line 754), §7.4/§7.5 (~line 776-900), §8 (~line 923)
- **관련 plan**: worktree `kb-quality-fba2f2` (OPEN PR #457) — `spec/5-system/4-execution-engine.md` 을 line ~712 (§5 Manual Trigger 영역)과 line ~1063 (§11 SIGTERM 영역)에서 편집 중
- **상세**: target 이 수정하려는 §4/§7.1/§7.2/§7.4/§8 과 `kb-quality-fba2f2` 가 수정하는 §5 (~712) / §11 (~1063) 은 hunk 분리. 충돌 위험 낮음.
- **제안**: 추적 메모 수준 — 조치 불요.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

- `fix-bg-context-followups` (branch `claude/fix-bg-context-followups`) — Step 1: ACTIVE (squash merge 로 ancestor 아님), Step 2: PR #451 MERGED → **stale**. `spec/5-system/4-execution-engine.md` §6.1 (~line 642) 편집. target 변경 영역(§4/§7.1/§7.2/§7.4/§8)과 비겹침.
- `fix-spec-frontmatter-catalog` (branch `claude/fix-spec-frontmatter-catalog`) — Step 1: ACTIVE, Step 2: PR #453 MERGED → **stale**. `spec/conventions/spec-impl-evidence.md` 편집.
- `makeshop-api-catalog-730deb` (branch `claude/makeshop-api-catalog-730deb`) — Step 1: ACTIVE, Step 2: PR #456 MERGED → **stale**. `spec/1-data-model.md` 편집(lines 비상세, 이미 main 반영).
- `spec-inprogress-groom-c7568b` (branch `claude/spec-inprogress-impl2`) — Step 1: STALE (ancestor 확인됨). 변경 없음(0 diff).

위 stale worktree 들은 git worktree 항목으로 남아있다. 필요 시 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec-draft-exec-intake-queue.md` 는 전반적으로 기존 plan 들과 정합하며, 미해결 결정의 일방적 우회나 active worktree 와의 실질적 hunk 충돌은 발견되지 않는다. 두 건의 WARNING 은 모두 후속 plan 갱신 누락 — `spec-sync-execution-engine-gaps.md` §4/§7.1/§8 항목 forwarding 처리와 `execution-engine-residual-gaps.md` G2 관계 명시가 `[ ]` 상태이며, spec 반영 전에 선행 처리하는 것이 plan 간 일관성을 높인다. worktree 충돌 후보 7건 중 stale 4건 skip (PR MERGED 확인), active 2건(`ai-context-memory-9c7e6e`, `kb-quality-fba2f2`) 분석 결과 hunk 비겹침으로 INFO 처리.

---

## 위험도

LOW
