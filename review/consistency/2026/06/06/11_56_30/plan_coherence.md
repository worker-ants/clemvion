# Plan 정합성 검토 결과

검토 모드: `--impl-done` | scope: `spec/5-system` | diff-base: origin/main
검토 시각: 2026-06-06 | target worktree: `exec-park-durable-resume` (branch `claude/exec-park-pr-b2`)

---

## 발견사항

### [WARNING] impl-concurrency-cap-pr2b — spec/5-system/4-execution-engine.md 동시 수정 중
- **target 위치**: `spec/5-system/4-execution-engine.md` (exec-park-durable-resume 의 diff 에 포함)
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` (worktree `impl-exec-concurrency-cap`, branch `claude/impl-concurrency-cap-pr2b`)
- **상세**: 두 active worktree 가 `spec/5-system/4-execution-engine.md` 를 동시에 수정하고 있다. exec-park-durable-resume 은 §4.x banner(PR-B2a/B2b 단계 롤아웃 정직화)·§6.2 waiting_for_input commit 표(resume_call_stack 행 추가)·§7.5 D6 재귀 재진입 절·§Rationale(D6/B2a/B2b 분리 롤아웃 갱신)를 대폭 수정했다. impl-concurrency-cap-pr2b 도 동일 파일을 수정 중이며, PR 이 없는 상태(미 push 또는 draft)라 GitHub PR state 조회 결과가 empty — Step 3 fallback 에 따라 active 처리된다. `exec-park-durable-resume.md` 의 W4 경고("PR-B1 머지 후 impl-concurrency-cap-pr2b rebase 선행을 착수조건에 명기")가 아직 해소되지 않은 상태다.
- **제안**: PR-B2 머지 전에 `exec-intake-queue-impl.md` PR2b 착수조건으로 "origin/main 을 PR-B2 포함 기준으로 rebase 완료 확인" 을 명기(planner). 또는 impl-concurrency-cap-pr2b 가 PR-B2 base 위에서 spec diff 를 재생성하도록 rebase 후 push 하여 W4 를 해소(해당 worktree 담당자).

### [WARNING] spec/5-system/14-external-interaction-api.md 동시 수정
- **target 위치**: `spec/5-system/14-external-interaction-api.md` (exec-park-durable-resume diff 포함)
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` (worktree `impl-exec-concurrency-cap`, 동 파일 수정)
- **상세**: exec-park-durable-resume 과 impl-exec-concurrency-cap 모두 `spec/5-system/14-external-interaction-api.md` 를 수정하고 있다. exec-park-durable-resume 은 PR-B1 에서 이미 변경(cancellation gap 수정 관련)했고, impl-exec-concurrency-cap 은 PR2a 에서 `EXECUTION_TIME_LIMIT_EXCEEDED` EIA classifier 전파를 반영했다. 두 변경이 서로 다른 섹션을 건드리는 경우에도 머지 순서 의존이 생긴다.
- **제안**: PR-B2 머지 후 impl-concurrency-cap-pr2b 가 즉시 rebase 해 14-external-interaction-api.md 충돌 여부를 확인. 충돌 없으면 무해, 있으면 수동 병합.

### [WARNING] exec-park D6 — 미구현 설계 확정안이 spec 에 완료형으로 노출될 위험
- **target 위치**: `spec/5-system/4-execution-engine.md` §6.2 waiting_for_input commit (e) 항, §7.5 "중첩 sub-workflow 재개" 절, §Rationale D6
- **관련 plan**: `plan/in-progress/exec-park-durable-resume.md` Phase B → PR-B2b (미착수)
- **상세**: spec diff 에서 (e) 항("구현 상태 2026-06-06: 컬럼 V087·타입·`CALL_STACK_SCHEMA_VERSION` 영속 매체는 추가됨 = 설계 확정. park 시 stage 와 §7.5 재귀 재진입 로직은 PR-B2 후속 커밋에서 구현")과 §7.5 D6 절("구현 상태(2026-06-06): 본 절차는 exec-park D6 의 설계 확정안이다")처럼 미구현 표기가 동반되어 있어 완료형 혼동 위험은 낮다. 그러나 spec 본문이 "설계 확정" 수준에서 상당히 상세한 알고리즘(재귀 재진입 절차 1~3단계, 선형 스택 불변식 등)을 영구 서술로 기술한 상태라, 추후 실제 구현이 미세하게 달라질 경우 spec↔impl drift 가 발생한다.
- **제안**: `spec/5-system/4-execution-engine.md §7.5` D6 절의 "설계 확정안" 문구가 PR-B2b 구현 후 반드시 "구현 완료" 로 갱신되도록 `exec-park-durable-resume.md` Phase B PR-B2b 체크리스트에 "spec §7.5 D6 절·§Rationale D6 구현 완료 플립" 항목을 추가.

### [INFO] spec-sync-auth-gaps.md — spec/5-system/1-auth.md pending
- **target 위치**: `spec/5-system/1-auth.md` (target scope 포함)
- **관련 plan**: `plan/in-progress/spec-sync-auth-gaps.md` (worktree `spec-sync-audit` — active worktree 없음, sentinel `(unstarted)` 아닌 `spec-sync-audit` 지정이나 git worktree list 에 부재)
- **상세**: `exec-intake-queue-impl.md` --impl-prep 에서 `spec/5-system/1-auth.md` Critical 2건(초대 에러코드 casing·WebAuthn 응답 포맷)이 발견됐으나 본 worktree(`exec-park-durable-resume`)는 1-auth.md 를 수정하지 않아 충돌 없음. 정보성 메모.
- **제안**: 추적용 메모만. spec-sync-auth-gaps.md 의 실제 착수 시 spec/5-system/1-auth.md 수정이 발생하면 그 시점에 worktree 충돌 재점검.

### [INFO] execution-engine-residual-gaps.md G1/G2 — 미해소, target spec 에 영향 없음
- **target 위치**: `spec/5-system/4-execution-engine.md` §11 (graceful shutdown WS gate)
- **관련 plan**: `plan/in-progress/execution-engine-residual-gaps.md` (worktree `spec-frontmatter-status-migration-027c17` — git worktree list 에 부재, inactive)
- **상세**: G1(WS `execution.start` graceful gate)·G2(`errorPolicy='continue'` interrupt 분기)는 BLOCKED 상태로 spec 에 "미구현" 표기가 유지 중. exec-park-durable-resume 의 spec 변경이 §11 을 직접 수정하지 않으므로 충돌 없음. 다만 G2 의 "cross-instance 재개 인프라" 선행 전제가 exec-park Phase A/B 완료로 일부 충족되는 부분이 있어(exec-intake-queue-impl PR3 → exec-park 흡수), G2 재검토 시 본 plan 완료 여부를 참고해야 한다.
- **제안**: exec-park PR-B2 완료 후 execution-engine-residual-gaps.md G2 의 "인프라 부재" 장애물 상태를 재점검.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정 으로 skip 된 항목:

- `rag-eval-harness-b8cc46` (branch `claude/rag-eval-harness-b8cc46`) — Step 2: PR #488 MERGED. spec/5-system/4-execution-engine.md·14-external-interaction-api.md·9-rag-search.md·13-replay-rerun.md 수정했으나 stale.
- `rag-eval-plan-hygiene-279c3e` (branch `claude/rag-eval-plan-hygiene-279c3e`) — Step 2: PR #489 MERGED. spec/5-system/14-external-interaction-api.md 수정했으나 stale.

해당 worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target scope(`spec/5-system`) 에 대한 `--impl-done` 검토에서 **Critical 0건, Warning 2건, INFO 2건**이 발견됐다. 가장 실질적인 위험은 **`impl-exec-concurrency-cap`(branch `claude/impl-concurrency-cap-pr2b`)과 `spec/5-system/4-execution-engine.md` 및 `14-external-interaction-api.md` 의 동시 수정** — 이 branch 는 PR 이 없어 Step 2 결과가 empty, Step 3 fallback 으로 active 처리됐다. `exec-park-durable-resume.md` W4 경고로 이미 인식된 리스크이며, PR-B2 머지 후 해당 브랜치의 rebase 를 착수조건으로 명기해 순서를 보장해야 한다. exec-park D6 의 미구현 설계안이 spec 에 포함됐으나 "구현 상태" 한정 표기가 동반되어 있어 당장은 무해하되 PR-B2b 구현 후 flip 이 필수다. stale worktree 충돌 후보 7건 중 stale 2건 skip, active 2건(exec-park + impl-concurrency-cap) 분석됐다.

---

## 위험도

MEDIUM
