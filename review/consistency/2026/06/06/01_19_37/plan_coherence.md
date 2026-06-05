# Plan 정합성 Check 결과

- **검토 모드**: 구현 착수 전 (--impl-prep)
- **Target scope**: `spec/5-system` (실효 대상 = `spec/5-system/4-execution-engine.md`)
- **대상 작업**: `plan/in-progress/exec-park-durable-resume.md` — Phase B 잔여 (PR-B2: 멀티턴 AI turn-단위 park + `pendingContinuations`/`firstSegmentBarriers` 제거(B3)). Phase A(A1·A2a·A2b·A3)·PR-B1 은 완료·머지됨.
- **종합 판정**: **BLOCK: NO** (Critical 0 / Warning 2 / Info 3)

판정 요지: 본 plan 은 D1~D5 결정이 모두 확정되어 있고, 현행 `4-execution-engine.md` 가 이미 Phase B 모델(park=세그먼트 종료·slow-path 일원화·turn-단위 park D4·fresh-config D3)을 본문+§Rationale 로 반영하고 있어 — 즉 구현이 따라가야 할 spec 이 자기모순 없이 정렬돼 있다. 다만 **동일 spec 파일을 병렬 active worktree(`impl-exec-concurrency-cap` / branch `claude/impl-concurrency-cap-pr2b`)가 동시에 손대는 cross-worktree 경합**이 실재하며(plan 자신이 W4 로 등재), 이를 차단(Critical)이 아니라 머지 순서 운영 리스크(Warning)로 다룬다.

---

## Critical (착수 차단)

없음.

---

## Warning

### W1 — 병렬 worktree 가 동일 spec(`4-execution-engine.md`)을 stale baseline 으로 수정 중 (worktree 충돌 / 점검 관점 5·2)

- **사실**: 다른 active worktree `impl-exec-concurrency-cap`(branch `claude/impl-concurrency-cap-pr2b`)가 `spec/5-system/4-execution-engine.md` 를 동시에 수정한다.
  - merge-base = `#468`(`9f30216f`). 두 브랜치 모두 그 위에서 분기.
  - pr2b 의 spec diff(`git diff main..claude/impl-concurrency-cap-pr2b -- spec/5-system/4-execution-engine.md`) = **23 insert / 8 delete**, hunk 위치 §4.2 PR1 메모(L378)·§8 동시실행제한(L938)·§10.2 env 표(L1102)·§7.5 Rationale graceful-shutdown(L1218)·末 Rationale(L1281).
  - 이 hunk 들은 Phase B 핵심 배너(§4.x park ~L406-408, §6.3 D3 L672, §7.4 Worker L828-829, §Rationale "park 즉시 해제 + slow-path 일원화" L1245-1257)와 **직접 라인 충돌은 없다**(섹션이 다름).
- **그러나 위험은 라인-충돌이 아니라 content-staleness 다**: pr2b 의 파일 본문은 Phase B 전면 개정이 main 에 랜딩되기 전 baseline 을 담고 있어, pr2b 가 늦게 push/merge 되면 3-way merge 가 안전히 정리해 주지 못하는 케이스(특히 그 사이 Phase B 가 같은 인접 영역을 추가 개정할 때)에 **Phase B 서술을 덮어쓸 위험**이 있다.
- **plan 자체 인지**: 진행 메모 W4(L157)에 "`impl-concurrency-cap-pr2b` 가 `4-execution-engine.md` 를 Phase B 이전 모델로 수정 중 → PR-B1 머지 후 그 브랜치 push 시 Phase B 서술 덮어쓰기 위험. 본 plan 단독 해소 불가(타 worktree)" 로 동일 리스크가 이미 등재됨.
- **조치 권고 (착수 차단 아님, 머지 게이트)**:
  1. PR-B2 가 §7.4/§7.5/§Rationale 의 Phase B 서술을 추가 개정하므로, **머지 전 `claude/impl-concurrency-cap-pr2b` 의 현행 main rebase 선행**을 PR-B2 머지 조건에 명기(이미 `exec-intake-queue-impl.md` PR2b 착수조건에 명기 권고됨 — 양쪽 cross-link 유지).
  2. PR-B2 는 §8(동시실행제한)·§10.2 env 표·graceful-shutdown Rationale 을 **건드리지 않도록 변경 범위를 Phase B turn-park/barrier 제거에 한정**해, pr2b 와의 텍스트 교집합을 최소화한다.

### W2 — `pendingContinuations`/barrier 제거(B3)가 인접 plan 의 미머지 표면과 코드 영역 겹침 (후속 항목 / 점검 관점 4·2)

- **사실**: PR-B2 의 B3(`pendingContinuations` Map·`firstSegmentBarriers`·`armFirstSegmentBarrier`/`settleFirstSegment`/`signalParkBarrier`/`firePayload` scheduler 제거)는 `execution-engine.service.ts` 의 재개/dispatch 핵심 경로를 정리한다. 같은 경로를 손대는 인접 plan:
  - `node-cancellation-infrastructure.md §2`(worktree unstarted) — dispatch 직전 `abortSignal.aborted` 사전체크 + `NodeExecution.status='cancelled'` enum/migration + AbortError 분류. PR-B1 이 이미 `applyCancellation` async + `cancelParkedExecution`(코루틴 없는 WAITING 직접 CANCELLED)을 도입했으므로, §2 의 dispatch-경로 가드가 B3 이후 코드 형태를 전제로 재작성돼야 한다. 본 plan D5(L151)·Phase 0(L142)이 "직렬화 순서·status 가드 겹침 확정"을 PR-B2 착수조건으로 이미 명기.
  - `exec-intake-queue-impl.md` PR3(worktree `impl-exec-concurrency-cap`, branch `claude/impl-exec-intake-queue` 는 docs 커밋 `01bca178` 로 코드 미착수) — rehydration 을 ai_agent 너머 일반 노드로 확장 + 멱등 재개. 본 plan 이 D5 로 **흡수**(Phase 0/A2/B2 에서 직접 구현)하기로 확정. 단 그 plan 본문에는 PR3 가 여전히 자기 범위로 남아 있어 **이관 표기(planner)가 미완**(Phase 0 L143 체크박스 `[ ]` 미완).
- **조치 권고**:
  - PR-B2 착수 전 Phase 0 L142(node-cancellation §2 직렬화 순서) 확정 + L143 이관 표기(planner)를 닫는다 — 그래야 B3 의 barrier/Map 제거가 §2 가드·PR3 rehydration 일반화와 중복/역행하지 않는다.
  - `exec-intake-queue-impl.md` 의 PR3 항목에 "→ exec-park-durable-resume 로 이관" 표기를 추가(현재 누락)해, 두 worktree 가 동일 rehydration 일반화를 각자 구현하는 중복을 차단(점검 관점 2).

---

## Info

### I1 — D1~D5 미해결 결정은 모두 확정, target 과 일방 충돌 없음 (점검 관점 1)

`exec-park-durable-resume.md §미해결 결정` 의 D1(conversation_thread V084)·D2(user_variables V085·PR-A3)·D3(fresh-per-turn 수용)·D4(turn-단위 park)·D5(단일 worktree 통합)가 전부 "확정 2026-06-05 / 사용자 결정" 으로 닫혀 있고, 현행 `4-execution-engine.md`(§4.x L406-408·§6.3 L672·§7.4 L828-829·§7.5 L408·§Rationale L1245-1257)가 동일 결정을 본문에 반영했다. 구현이 spec 의 미해결 결정을 일방적으로 뒤집는 항목은 없다.

### I2 — Phase A 선행 조건 모두 해소됨 → Phase B 착수 전제 충족 (점검 관점 3)

본 plan 은 "Phase A 완료 = Phase B 전제(rehydration 무손실화)"를 명시한다(L48). A1(PR#470, main `57d366b6`)·A2a(`7c32712f`)·A2b·A3 모두 `[x]` 완료, 마이그레이션 V084/V085 적용. 현행 main 커밋 로그에도 PR-A2a(`5ebb1ee3`)·PR-A2b(`7afa9ae0`)·PR-A3(`9e65f853`)·PR-B1(`7ec999d7`/#483)이 랜딩됨. 따라서 PR-B2 의 선행 plan(Phase A·PR-B1) 미해소 항목 없음. Phase 0 의 PR3 흡수는 "흡수할 코드 없음(PR3 미구현) → 본 plan 이 직접 구현"으로 정리돼(L139) Phase B2 가 그 부분을 자체 구현하는 것이 정합.

### I3 — `spec-sync-*` 계열 plan 과의 영역 중복은 read/추적용으로 무해 (점검 관점 2)

`spec/5-system/4-execution-engine.md` 를 `pending_plans`/본문에서 참조하는 다른 in-progress plan(`spec-sync-execution-engine-gaps.md`·`spec-sync-execution-gaps.md` = worktree `spec-sync-audit`, owner planner / `spec-update-pr2a-*` = worktree `impl-exec-concurrency-cap` / `spec-update-execution-context-options-bag.md` = worktree `fix-bg-context-followups` / `execution-engine-residual-gaps.md`)가 존재하나, 이들은 (a) §8 동시성·active-running(PR2a/PR2b 영역, W1 의 pr2b 와 동일 묶음) 또는 (b) G1/G2 BLOCKED 미구현 표면 추적 또는 (c) ExecutionContext options-bag 으로, **Phase B park/slow-path 본문과 섹션이 분리**돼 직접 충돌은 W1(pr2b)에 집약된다. 나머지는 추적·후속용으로 PR-B2 착수를 막지 않는다.

---

## 부록 — 검증 근거 (git)

- worktree 현황: `git worktree list` → `impl-exec-concurrency-cap [claude/impl-concurrency-cap-pr2b]`, `impl-exec-intake-queue [claude/impl-exec-intake-queue @ 01bca178]`(docs 커밋·코드 미착수), `spec-exec-intake-queue` 동시 존재.
- pr2b spec divergence: `git diff main..claude/impl-concurrency-cap-pr2b -- spec/5-system/4-execution-engine.md` = 23/8, hunk L378/938/1102/1218/1281 (§4.2 PR1 메모·§8·§10.2 env·§7.5 Rationale graceful-shutdown·末 Rationale) — Phase B 배너 라인과 직접 충돌 없음(content-staleness 위험만).
- merge-base(main, pr2b) = `9f30216f` (#468).
- 현행 main spec 이 Phase B 반영: `4-execution-engine.md` L406-408·L672·L828-829·L1245-1257 에 "park = 세그먼트 종료"·"slow-path 일원화"·"turn-단위 park(D4)"·"fresh-config(D3)" + §Rationale "park 즉시 해제 + slow-path 일원화 (Phase B)" 존재.
- Phase A/PR-B1 머지 확인: main 로그 `7ec999d7`(PR-B1 #483)·`9e65f853`(A3 #476)·`7afa9ae0`(A2b #475)·`5ebb1ee3`(A2a #472).

STATUS: WROTE plan_coherence.md — BLOCK:NO (Critical 0 / Warning 2 / Info 3)
