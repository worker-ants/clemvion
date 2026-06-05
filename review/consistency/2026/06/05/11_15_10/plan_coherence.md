# Plan 정합성 검토 결과

검토 모드: `--impl-done`
Target 범위: `spec/5-system/`
기준 plan: `plan/in-progress/exec-park-durable-resume.md`

---

## 발견사항

### [WARNING] impl-exec-concurrency-cap 로컬 worktree 가 `spec/5-system/4-execution-engine.md` 에 구버전 복사본 보유
- **target 위치**: `spec/5-system/4-execution-engine.md` §4.3 ("waiting_for_input 진입 시" 행), §4.x 구현 메모
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` (worktree `impl-exec-concurrency-cap`, 로컬 브랜치 `claude/impl-concurrency-cap-pr2b`)
- **상세**: `impl-exec-concurrency-cap` worktree 는 PR #469(exec-park A2a/V083)·PR #470(exec-park A1, V084) 이전 main 베이스를 기준으로 체크아웃되어 있다. 해당 worktree 의 로컬 `spec/5-system/4-execution-engine.md` 는:
  1. `pending_plans:` 에서 `exec-park-durable-resume.md` 항목 제거(exec-park A1 이 아직 pending 이라는 전제 삭제).
  2. `§4.3 waiting_for_input 진입 시` 행에서 `Execution.conversation_thread` durable commit(V084) 서술을 제거하고 구 문구("별도 DB 컬럼 신설 없음")로 복원.
  3. `§4.x` 구현 메모에서 "park 즉시 코루틴 해제 + slow-path 일원화" 추진 참조를 `execution-engine-residual-gaps.md` 로 재연결(exec-park 완료 전 상태로 역전).
  
  브랜치 `claude/impl-concurrency-cap-pr2b` 는 현재 리모트 미push 상태. 이 로컬 변경이 그대로 push → PR 이 되면 PR #470 이 main 에 확립한 durable park spec 을 덮어쓰는 충돌이 발생한다.
- **제안**: `impl-exec-concurrency-cap` 담당자는 PR2b 착수 전 `origin/main` 으로 rebase 하여 A1/A2a spec 변경분을 흡수해야 한다. 해당 spec 행에 대한 독립적 변경이 없다면 rebase 후 무충돌로 해결된다.

---

### [WARNING] Phase B 착수 전 D4 turn-단위 park Rationale 미명문화 — 구현 선행 위험
- **target 위치**: `spec/5-system/4-execution-engine.md` §4.x (현재 "구현 메모" 절)
- **관련 plan**: `plan/in-progress/exec-park-durable-resume.md` Phase B 선행 의무 + 미해결 결정 D4 (확정 2026-06-05)
- **상세**: plan 은 "Phase B 착수 전 D4 turn-단위 park Rationale 명문화가 의무"(spec §4.x 또는 신규 §Rationale)라고 명시한다. D4 는 이미 "멀티턴 AI = turn-단위 park(매 turn 해제)"로 확정됐으나, 현재 `spec/5-system/4-execution-engine.md` 본문에는 이 결정의 Rationale(기존 "대화 전체=단일 waiting" 대비 차이, 채택 근거, 기각 대안)이 반영되지 않은 상태다. Phase B 구현이 이 명문화 없이 착수되면 spec-impl drift 가 발생하고 다음 consistency-check --impl-prep 에서 BLOCK 요인이 될 수 있다.
- **제안**: Phase B(B1/B2/B3) 구현 착수 직전 project-planner 가 `spec/5-system/4-execution-engine.md §4.x`(또는 §Rationale 신설)에 D4 turn-단위 park 결정 및 Rationale을 반영해야 한다. plan 에 이미 명시된 의무이므로 별도 결정 불요, 타이밍 준수만 필요.

---

### [INFO] 미해결 결정 D2(user-defined variables 복원 범위) — 후속 plan 분기 기준 미확정
- **target 위치**: `plan/in-progress/exec-park-durable-resume.md §A3`
- **관련 plan**: 동일 plan D2 미해결 결정
- **상세**: A3(user-defined variables 영속+복원) 는 범위 확인 대기 중이며, D2("본 plan 범위 포함 vs 별도 plan 분리")가 미확정이다. `spec/5-system/4-execution-engine.md §7.5`(rehydration 무손실 보장) 는 conversationThread 복원을 명시했지만 variables 복원은 미약속 상태이다. D2 결정 없이 Phase B(slow-path 일원화)를 완성하면 §7.5 의 "무손실" 주장이 부분적으로 허위가 될 수 있다.
- **제안**: D2 를 Phase B 착수 전 확정. 범위 포함이면 A3 가 B 보다 선행, 별도 plan 분리라면 §7.5 "무손실" 범위를 conversationThread/checkpoint 한정으로 명시 보강 필요(spec 갱신).

---

### [INFO] exec-park A2b(information_extractor 멀티턴 checkpoint) — spec "ai_agent 한정" 문구 3곳 잠재 충돌
- **target 위치**: `spec/5-system/4-execution-engine.md §1.3 L111`
- **관련 plan**: `plan/in-progress/exec-park-durable-resume.md §A2b` (분리된 후속, 미착수)
- **상세**: A2b 착수 시 `spec/5-system/4-execution-engine.md §1.3`, `spec/4-nodes/3-ai/3-information-extractor.md §357`, `spec/4-nodes/3-ai/1-ai-agent.md §703` 세 곳의 "ai_agent 한정" 문구를 변경해야 한다. 이 중 `spec/5-system/4-execution-engine.md` 는 `exec-intake-queue-impl.md` 와 `exec-park-durable-resume.md` 두 plan 이 공동으로 쓰는 파일이다. A2b 착수 시점에 `impl-exec-concurrency-cap` 가 spec §4.x 를 수정하는 PR 을 동시에 열면 §1.3 충돌이 발생할 수 있다.
- **제안**: A2b 착수 전 impl-exec-concurrency-cap worktree 의 rebase 및 PR2b 상태를 확인해 §1.3 수정 범위 충돌 여부를 점검.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

- `impl-exec-intake-queue` (branch `claude/impl-exec-intake-queue`) — Step 2 PR #463 MERGED → stale. `spec/5-system/4-execution-engine.md` 수정 이력이 있으나 이미 main 에 포함됨.
- `spec-exec-intake-queue` (branch `claude/spec-exec-intake-queue`) — Step 2 PR #458 MERGED → stale.
- `exec-park-durable-resume` worktree 내 `claude/exec-park-durable-resume` 브랜치 — Step 2 PR #470 MERGED → 본 분석의 기준 커밋 출처(이미 main 포함).

이 3개 worktree 는 활성으로 남아있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

활성 판정된 worktree 충돌 후보:
- `impl-exec-concurrency-cap` (branch `claude/impl-concurrency-cap-pr2b`) — Step 1 ACTIVE, Step 2: 리모트 미push → PR 없음, Step 3 fallback active 간주. `spec/5-system/4-execution-engine.md` 의 로컬 사본이 main 현재 상태(PR #470 반영)와 충돌하는 구버전 포함. WARNING 으로 보고.
- `exec-park-durable-resume` worktree 자체의 `claude/exec-park-a2-checkpoint` 연관 PR #472 OPEN — `spec/5-system/4-execution-engine.md` 수정 포함. 본 worktree 의 plan 에서 명시 추적 중이므로 자기 충돌 아님.

---

## 요약

`exec-park-durable-resume` plan 의 A1(PR #470 MERGED)·A2a(PR #472 OPEN) 이 target `spec/5-system/` 에 반영한 변경은 plan 내 확정 결정(D1·D4·D5)과 일관되며, spec 전략(durable park spec §4.3/§7.5·checkpoint schemaVersion §1.3/§7.5)을 올바르게 갱신했다. 미해결 결정 D2·D3 은 Phase A3/B 에서 다뤄지므로 현 시점에서 spec 과 충돌하지 않는다. 주요 위험은 외부 worktree(`impl-exec-concurrency-cap`)가 main rebase 없이 구버전 `spec/5-system/4-execution-engine.md` 를 로컬 보유하는 점(WARNING)으로, push 전 rebase 로 해소 가능하다. Phase B 착수 전 D4 Rationale 명문화 의무(Warning)와 D2 범위 결정(INFO) 도 타이밍 준수가 필요하다. worktree 충돌 후보 4건 중 stale 3건 skip, active 1건 분석.

---

## 위험도

LOW
