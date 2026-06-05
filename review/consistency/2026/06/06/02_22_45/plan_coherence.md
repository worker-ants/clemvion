# Plan 정합성 검토 결과

target: `plan/in-progress/spec-draft-exec-park-b2-durable.md`
검토 기준일: 2026-06-06

---

## 발견사항

### 1. [WARNING] impl-concurrency-cap-pr2b worktree 가 동일 spec 파일을 Phase-B-이전 모델로 보유 중 (W4 미해소 확인)

- **target 위치**: C5 — `§4.x banner 2개`, `§7.4 Worker 동작(L829)`, `§Rationale L1257` 서술 재전환(완료형)
- **관련 plan**: `exec-park-durable-resume.md` §진행메모 W4 — "impl-concurrency-cap-pr2b worktree 가 `spec/5-system/4-execution-engine.md` 를 Phase B 이전 모델로 수정 중"
- **상세**: `impl-exec-concurrency-cap` worktree(branch `claude/impl-concurrency-cap-pr2b`)가 `spec/5-system/4-execution-engine.md` 를 포함하며 **Phase B 이전 서술** 을 갖고 있다. diff 확인:
  - `waiting_for_input | waiting_for_input` 전이 행이 "다른 인스턴스에서 재개 — `pendingContinuations` 가 새 인스턴스에 재등록" 이라고 기술 (= Phase B 완료 전 old model).
  - Worker 동작 셀이 "로컬 `pendingContinuations` 에 키가 있으면 즉시 resolve (in-instance fast path). 없으면 §7.5 rehydration" 이라고 기술.
  - §Rationale 의 "park 즉시 해제 + slow-path 일원화 (Phase B)" 단락이 없음. "단계적 롤아웃(B1→B2)" note 역시 Phase B 완료 반영 안 됨.
  - 해당 branch 에는 PR 없음(gh pr list 결과 empty). Step 3 fallback — active.
  - 해당 branch 의 `spec/5-system/4-execution-engine.md` 가 PR-B2 머지 후 push 되면 target 의 C5 서술 재전환이 덮어써질 수 있다.
- **제안**: PR-B2 머지 전에 `impl-concurrency-cap-pr2b` 담당자(exec-intake-queue-impl plan PR2b)가 origin/main rebase 를 반드시 선행해야 한다. 부모 plan(`exec-park-durable-resume.md`) §진행메모 W4 의 "PR-B1 머지 후 `impl-concurrency-cap-pr2b` rebase 선행을 PR2b 착수조건에 명기"가 실행됐는지 확인 필요. 미확인이면 `exec-intake-queue-impl.md` 에 조건 갱신.

---

### 2. [INFO] migration renumber — V086 충돌 인지, V087+ 확정 필요

- **target 위치**: C1 — "마이그레이션 `V086__execution_resume_call_stack.sql` (가칭). **주의**: main 에 이미 `V086` ... → **V087+ 로 renumber 필수**"
- **관련 plan**: `exec-park-durable-resume.md` §PR-B2 구현 설계 변경 단위 8(a)
- **상세**: main 현재 최대 마이그레이션은 `V086__agent_memory_scope_updated_index` (2건: `.conf` + `.sql`). target 은 이를 인지하고 V087+ renumber 필요성을 명시하고 있어 충돌 의식은 있다. 단, `impl-concurrency-cap-pr2b` branch 도 V084/V085/V086 을 포함하고 있어, 해당 branch 가 먼저 새 마이그레이션을 추가하면 renumber 시점 판단이 달라질 수 있다. 현재 `impl-concurrency-cap-pr2b` 에는 V084~V086 외 추가 마이그레이션 없음(PR 없음) — 현재 단계에서는 V087 이 안전하나, PR2b 착수 시 재점검 필요.
- **제안**: PR-B2 작업 착수 시점에 `migrations.md §5/§6` 절차대로 최신 origin/main max 버전 + open PR 점유 확인 후 번호 확정. 현재는 V087 사용 가능.

---

### 3. [INFO] `spec/5-system/13-replay-rerun.md` — "직교 확인" 대상이나 별도 plan 없음

- **target 위치**: 문서 헤더 "대상 spec: ... `spec/5-system/13-replay-rerun.md`(직교 확인)"
- **관련 plan**: 없음 (해당 spec 을 수정하는 진행 중 plan 없음)
- **상세**: `13-replay-rerun.md` 는 현행 plan(`exec-park-durable-resume.md §Spec 변경` — W1 정합화 항목)에서 D3 fresh-config-per-turn 단서를 이미 추가한 이력이 있다(2026-06-06 완료). target 의 C5 변경(spec 서술 재전환)이 `13-replay-rerun.md` 에도 연쇄 갱신을 요구하는지 여부는 명시되지 않았다. 현재 `13-replay-rerun.md` 를 수정하는 다른 active worktree 는 없어 경합 위험은 없다. 다만 C5 완료형 재전환 시 `13-replay-rerun.md §14.3` 의 D3 단서도 함께 "B2 완료 반영"으로 정합화해야 한다면 target 범위에 포함해야 한다.
- **제안**: spec draft 적용 시 `13-replay-rerun.md §14.3` 의 D3 노트가 PR-B2 완료 후에도 여전히 유효한지(또는 완료형 재서술이 필요한지) 명시적 확인 추가 권장. 현재 "직교 확인"으로만 기재돼 있어 처리 방향이 불분명.

---

### 4. [INFO] `spec-draft-exec-park-b2-durable.md` — `plan/in-progress` 에 배치, plan frontmatter 없음

- **target 위치**: 파일 전체
- **관련 plan**: 없음
- **상세**: target 은 spec draft 문서로 `plan/in-progress/` 에 있지만 frontmatter(`worktree`, `owner`, `started` 등)가 없다. 부모 plan `exec-park-durable-resume.md` 가 umbrella 역할을 하므로 별도 frontmatter 없는 보조 draft 로 의도된 것으로 보인다. plan-lifecycle.md 정책 위반이지만 부모 plan 이 worktree 를 명시하고 있으므로 추적 가능. 심각도 낮음.
- **제안**: 혼동 방지를 위해 파일 최상단에 "보조 spec draft — 부모 plan: `exec-park-durable-resume.md` PR-B2 항목 7" 형태의 주석 또는 헤더 추가 고려.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보:

- `impl-exec-concurrency-cap` (branch `claude/impl-exec-concurrency-cap`) — Step 2 PR #469 MERGED. **stale skip**. (이 worktree 는 PR-2a 작업이 완료된 상태이며 현재 `impl-concurrency-cap-pr2b` 브랜치로 계속 사용 중이나, PR #469 자체는 MERGED — 단 현 head commit 은 branch `claude/impl-concurrency-cap-pr2b` 임. Step 1: ACTIVE, Step 2 for `impl-concurrency-cap-pr2b`: no PR → Step 3 fallback, active 처리.)

실제 활성 worktree 충돌 분석 대상:
- `impl-concurrency-cap-pr2b` — Step 1 ACTIVE (ancestor check ACTIVE). Step 2: gh pr list 결과 empty(PR 없음). Step 3 fallback: **active 로 처리** — "stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장". 이 worktree 가 `spec/5-system/4-execution-engine.md` 와 `spec/5-system/1-data-model.md` 에 동시 접촉 중이어서 발견사항 §1(WARNING) 으로 처리.

- `claude/exec-park-b1` — Step 2 PR #483 MERGED. **stale skip**.

stale skip 목록:
- `exec-park-b1` (branch `claude/exec-park-b1`) — Step 2 PR #483 MERGED
- `impl-exec-concurrency-cap` (branch `claude/impl-exec-concurrency-cap`) — Step 2 PR #469 MERGED

이 두 worktree/branch 가 활성 worktree 로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target `spec-draft-exec-park-b2-durable.md` 는 부모 plan `exec-park-durable-resume.md` 의 D4·D6 결정에 충실하며, 미해결 결정을 일방적으로 우회하는 항목은 없다. C1~C5 모두 부모 plan §PR-B2 구현 설계의 내용과 정합한다. 가장 큰 위험은 §1(WARNING) — `impl-concurrency-cap-pr2b` 가 active worktree 로 `spec/5-system/4-execution-engine.md` 에 Phase B 이전 서술을 보유하고 있어, PR-B2 머지 후 해당 branch 가 push 되면 target 의 C5 완료형 재전환이 덮어쓸 수 있다. 이는 부모 plan이 이미 인지(W4)하고 PR2b 착수조건에 rebase 명기를 지시했으나 실행 여부 미확인. migration 번호 충돌(V086)은 target 이 올바르게 인지하고 V087+ 로 명시했다. worktree 충돌 후보 3건 중 stale 2건 skip, active 1건(`impl-concurrency-cap-pr2b`) 분석.

## 위험도

LOW
