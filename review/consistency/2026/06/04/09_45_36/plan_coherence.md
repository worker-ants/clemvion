# Plan 정합성 검토 결과

target: `plan/in-progress/spec-update-exec-intake-queue-pr1.md`
mode: --spec (spec draft 검토)
검토일: 2026-06-04

---

## 발견사항

### [WARNING] spec-sync-execution-engine-gaps.md 의 §4 항목이 target 변경 후 stale 됨
- **target 위치**: `spec-update-exec-intake-queue-pr1.md` §4 배너 변경 (SUMMARY#5) — "§4.1~4.3 은 미구현 (Planned)" → "§4.1~4.3 PR1 구현 완료"
- **관련 plan**: `plan/in-progress/spec-sync-execution-engine-gaps.md` (worktree: `spec-sync-audit`, 실제 stale worktree — 아래 §stale 목록 참조) 의 첫 번째 항목: `[ ] §4 Worker 모델 — 별도 Redis BQ task-queue, 1 Worker = 1 NodeExecution, ...`
- **상세**: `spec-sync-execution-engine-gaps.md` 는 §4 Worker 모델 전체를 미구현으로 추적한다. target plan 이 §4.1–4.3 (intake 큐·work-stealing·우선순위)을 "PR1 구현 완료"로 spec 배너에 반영하면, tracking plan 의 §4 항목은 부분 완료 상태가 된다. 그러나 §4 항목 본문이 "별도 Redis BQ task-queue, 1 Worker = 1 NodeExecution, `taskId`/`timeout`/`retryCount` 태스크 메시지, Worker 인스턴스 수 env, 큐 파티셔닝, 우선순위 큐"를 묶어 단일 `[ ]`로 추적하고 있어, PR1 구현 완료 부분(intake 큐·work-stealing·우선순위)과 여전히 Planned 인 부분(per-node model 폐기는 이미 결정 — 단, §7.1 heartbeat 와 §8 동시성 cap 은 별도 항목으로 존재)이 혼재된다. 현재 spec-sync plan 의 §4 항목 설명이 PR #458 이전의 per-node task-queue aspirational 모델 기술인데, PR #458 (commit `7a689796`)로 spec 자체가 execution-level intake 큐 모델로 재정의되었으므로 이미 §4 항목 기술이 outdated다.
- **제안**: target 적용 후 `spec-sync-execution-engine-gaps.md` 의 §4 항목을 갱신한다 — per-node 모델은 폐기 결정 완료이므로 제거하고, §4.1–4.3 (PR1 구현 완료) 표기 추가 또는 항목을 `[x]` 마킹 + 해소 기록. §7.1·§8 은 각 항목이 별도 `[ ]`로 이미 추적되므로 변경 불요.

### [INFO] §9.3 `exec:run:seq` Redis key 항목의 "(target — §4)" 마커가 범위 외로 남음
- **target 위치**: `spec-update-exec-intake-queue-pr1.md` §범위 외 — "§9.3 `exec:run:seq:<executionId>` Redis key '(target — §4)' 표기 (PR3 seq 추가 시 갱신)"
- **관련 plan**: `spec-sync-execution-engine-gaps.md` / target plan 자체 §범위 외 명시
- **상세**: origin/main 의 spec line 988에 `exec:run:seq:<executionId>` 항목이 "(target — §4)" + "구현 시 결정"으로 남아있다. target plan 은 이를 의도적으로 범위 외로 분류(PR3 seq 추가 시 갱신 예정). PR1 에서 jobId = executionId (seq 없음)이므로 seq Redis key 자체가 미사용 — 배너와 달리 이 항목은 실제로 구현되지 않았으므로 "범위 외" 처리가 정확하다. 추적 메모로 기록.

### [INFO] kb-quality-fba2f2 워크트리가 동일 파일의 다른 섹션 편집 중 (merge 시 수동 resolve 필요)
- **target 위치**: target plan 변경 대상 — §4 배너(line 348), §9.3 표(line 998), §11 ENV 표(line 1098)
- **관련 plan**: `plan/in-progress/rag-quality-improvement.md` (worktree: `kb-quality-fba2f2`, PR OPEN #457)
- **상세**: `kb-quality-fba2f2` 브랜치(PR #457 OPEN — active worktree)가 `spec/5-system/4-execution-engine.md` 을 수정한다. 단, 변경 위치는 §6.1 createContext 서명(line ~642)과 §11 graceful-shutdown Phase 1 note(line ~1079) — target plan 이 수정하는 §4 배너·§9.3·§11 ENV 표와 **다른 라인**이다. 논리적 충돌은 없으나, 두 브랜치가 동일 파일을 편집하므로 머지 시 git 충돌(git conflict)이 발생할 수 있다. CRITICAL 등급은 아님 — 수동 resolve 가능하며 내용 충돌이 아닌 위치 충돌.
- **제안**: target plan 적용(impl-exec-intake-queue → PR) 시 kb-quality-fba2f2 PR #457 과 merge 순서 조율. 먼저 merge 된 쪽을 base 로 나중 PR 이 rebase 처리.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

- `spec-exec-intake-queue` (branch `claude/spec-exec-intake-queue`) — Step 1: ACTIVE (squash merge 로 ancestor 아님), Step 2: PR #458 MERGED → stale. `spec/5-system/4-execution-engine.md` 를 수정하나 PR 이 이미 merge 완료. target 이 Before 로 쓴 spec 텍스트("§4.1~4.3 은 미구현 (Planned)")는 PR #458 의 squash 결과 origin/main 에 반영된 상태이며 target plan 의 Before 와 일치 — 정합함.
- `fix-spec-frontmatter-catalog` (branch `claude/fix-spec-frontmatter-catalog`) — Step 1: ACTIVE (squash merge), Step 2: PR #453 MERGED → stale.
- `spec-inprogress-impl2` (branch `claude/spec-inprogress-impl2`) — Step 1: STALE (ancestor) → stale.
- `spec-sync-audit` (branch `claude/spec-sync-audit`, `spec-sync-execution-engine-gaps.md` 의 frontmatter `worktree` 필드) — Step 1: ACTIVE (squash merge), Step 2: PR #443 MERGED → stale. 해당 worktree 디렉토리 자체는 존재하지 않음.
- `fix-bg-context-followups` (branch `claude/fix-bg-context-followups`) — Step 1: ACTIVE (squash merge), Step 2: PR #451 MERGED → stale. `spec/5-system/4-execution-engine.md` §6.1 일부 수정했으나 PR 종결.

stale worktree 5건이 `.claude/worktrees/` 또는 git branch 상에 잔존. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target plan `spec-update-exec-intake-queue-pr1.md` 는 PR1 구현 완료 사실을 spec 3곳(§4 배너·§9.3 표·§11 ENV 표)에 반영하는 SPEC-DRIFT 작업으로, 미해결 결정과의 충돌 없음. 제안된 Before/After 가 origin/main 의 실제 spec 텍스트와 정확히 일치하며 PR2-4 Planned 항목(§7.1·§8)을 올바르게 보존한다. 주요 위험은 WARNING 1건 — `spec-sync-execution-engine-gaps.md` 의 §4 추적 항목이 target 적용 후 stale 해지므로, spec 반영과 동시에 tracking plan 을 갱신해야 한다. worktree 충돌 후보 7건 중 stale 5건 skip, active 2건(kb-quality-fba2f2·impl-exec-intake-queue 자신) 분석 — kb-quality-fba2f2 는 동일 파일 다른 섹션 편집(merge-time 위치 충돌만, 논리 충돌 없음).

---

## 위험도

LOW
