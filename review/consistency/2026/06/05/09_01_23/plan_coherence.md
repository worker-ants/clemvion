# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)
Target plan: `plan/in-progress/exec-park-durable-resume.md`
검토 일시: 2026-06-05

---

## 발견사항

### [WARNING] D1 미확정 상태에서 `Execution.conversation_thread` 컬럼 채택 전제로 Phase A 구현 진행

- **target 위치**: `exec-park-durable-resume.md` Phase A1 전체 + Spec 변경 § 3번 째 항목
- **관련 plan**: `exec-park-durable-resume.md §미해결 결정` — "D1 (확정 제안): conversationThread 영속 = `Execution.conversation_thread jsonb` → **사용자 승인 시 확정**"
- **상세**: Phase A1 의 마이그레이션·코드·spec 동기 갱신 항목이 모두 `Execution.conversation_thread jsonb NULL` 컬럼을 전제로 설계돼 있다. 그러나 D1 은 plan 내에서 "확정 제안"으로 표시되어 있고 "사용자 승인 시 확정" 조건이 달려 있어 아직 미확정이다. `spec/conventions/conversation-thread.md §4 L211` 도 현재 "향후 … 검토"로 남아 있다. D1 미승인 상태에서 Phase A1 구현을 착수하면 재작업이 발생한다.
- **제안**: D1 을 착수 전에 사용자에게 명시적으로 승인받아 plan 의 "사용자 승인 시 확정" 조항을 닫아야 한다. 승인 후 D1 항목을 "(확정 2026-06-05)" 표기로 갱신하고 Phase A1 에 진입할 것.

---

### [WARNING] Phase 0 선행 조건(exec-intake-queue PR3) 미완료 상태에서 Phase A 착수 금지

- **target 위치**: `exec-park-durable-resume.md §Phase 0` 전체 항목 (모두 `[ ]` 미체크)
- **관련 plan**: `exec-intake-queue-impl.md §PR3` — "크래시 RUNNING checkpoint 재개: stalled active 세그먼트를 §7.5 rehydration 으로 재개. rehydration 을 `ai_agent` 너머 일반 노드로 확장. 멱등성 보장." PR3 는 현재 미착수.
- **상세**: exec-park plan 은 D5 결정으로 `exec-intake-queue` PR3(rehydration 일반화+멱등 재개)을 본 worktree 로 흡수하기로 확정했다. Phase 0 의 세 항목이 모두 체크되지 않은 상태이며, Phase A/B 는 Phase 0 baseline 위에서 진행해야 한다. 현재 `impl-exec-intake-queue` worktree 의 PR1(#463)은 MERGED 이지만 PR3 는 미구현이다. Phase 0 를 건너뛰고 Phase A 로 진입하면 rehydration 일반화가 빠진 상태에서 `conversationThread` 복원만 구현하게 되어 non-ai_agent waiting 노드의 재개가 여전히 손실 상태로 남는다.
- **제안**: Phase A 착수 전에 Phase 0 체크리스트를 완료할 것. 특히 PR3 코드를 본 worktree baseline 으로 흡수(rebase/cherry-pick 또는 PR3 선행 머지 후 rebase)하는 작업이 선행되어야 한다.

---

### [WARNING] `spec/5-system/4-execution-engine.md` 동시 수정 — impl-exec-concurrency-cap worktree 충돌 후보

- **target 위치**: `exec-park-durable-resume.md §Spec 변경` — `4-execution-engine.md §4.x, §7.4, §7.5, §6.2` 수정 예정
- **관련 plan**: `exec-intake-queue-impl.md §spec-update-pr2a-timeout` (worktree: `impl-exec-concurrency-cap`) — `4-execution-engine.md §8` 타임아웃 구현 상태 갱신
- **상세**: `impl-exec-concurrency-cap` worktree (branch `claude/impl-exec-concurrency-cap`)는 현재 ACTIVE (PR 없음, merge-base ACTIVE)이며 `spec/5-system/4-execution-engine.md §8` 을 수정하는 미머지 커밋을 보유하고 있다. exec-park plan 은 동일 파일의 §4.x, §6.2, §7.4, §7.5 를 수정할 예정이다. 두 worktree 가 같은 파일의 **서로 다른 섹션**을 병렬로 수정하는 상황이므로 PR 병합 순서에 따라 rebase 충돌이 발생할 수 있다.
- **제안**: `impl-exec-concurrency-cap` 의 spec 갱신(§8)을 먼저 머지하거나, exec-park 의 spec PR 착수 시점에 `impl-exec-concurrency-cap` 의 diff 를 확인하고 충돌 최소화 전략(cherry-pick 순서, rebase base 맞추기)을 수립할 것. 섹션이 달라 코드 충돌 가능성은 낮지만 git merge context 가 인접하면 충돌이 발생할 수 있다.

---

### [WARNING] `spec/conventions/conversation-thread.md §4/§7/§8` 동시 수정 — ai-context-memory-followup-v2 plan 과의 후속 항목 정합

- **target 위치**: `exec-park-durable-resume.md §Spec 변경` — `conversation-thread.md §4/§7/§8` "신규 DB 컬럼 없음" 조항 3곳 갱신 예정
- **관련 plan**: `ai-context-memory-followup-v2.md` (worktree: `ai-context-memory-9c7e6e`, 미착수) — `conversation-thread.md §7` v2 로드맵 및 §4 영속화 경로에 대한 미완료 v2 항목(`text_classifier/information_extractor` 자동 주입 확장, provider tokenizer-exact) 을 추적 중
- **상세**: exec-park plan 의 PR-A1 은 `conversation-thread.md §4` 의 "신규 DB 컬럼 없음" → `Execution.conversation_thread` 채택으로 전환한다. 이 변경은 동일 §4 L211 에서 `ai-context-memory-auto.md` (Phase B~G 완료)가 이미 추가한 `runningSummary`/`summarizedUpToSeq` Redis 직렬화 설명과 인접한다. exec-park 변경 후 `ai-context-memory-followup-v2.md` 의 v2 후속 작업이 §4 를 추가 편집할 때 stale 컨텍스트를 참조할 수 있다. 또한 exec-park 의 §7/§8 갱신이 `ai-context-memory-followup-v2.md` 의 §7 v2 로드맵 항목(token-aware cap, tokenizer-exact)과 위치 충돌 가능성이 있다.
- **제안**: exec-park PR-A1 의 `conversation-thread.md` 갱신 시, `ai-context-memory-auto.md` 가 추가한 §4 블록(L213~L216)의 내용을 훼손하지 않도록 정밀 편집 범위를 한정할 것. `ai-context-memory-followup-v2.md` 에도 "exec-park PR-A1 이 §4 DB 컬럼 조항을 변경함"을 cross-note 로 추가하여 v2 착수 시 충돌 인지가 가능하게 할 것.

---

### [INFO] D2, D3 결정 미확정 — Phase A3 착수 불확실

- **target 위치**: `exec-park-durable-resume.md §미해결 결정` D2, D3
- **관련 plan**: 없음 (내부 미결)
- **상세**: D2(user-defined variables 복원 범위) 와 D3(park 중 워크플로 정의 편집 시 재개 정책)이 열려 있어 Phase A3 착수 여부와 B 전환 시 동작 정의가 불확실하다. D2 가 "본 plan 포함"으로 결정되면 Phase A3 가 대형 scope 로 확장될 수 있으며, D3 는 PR-B 의 "불변식 보장" 항목에 직접 영향을 준다. 구현 착수 전에 두 결정의 답을 plan 에 명문화할 것이 권장된다.
- **제안**: D2·D3 를 D1 승인과 함께 사용자에게 확인하고, plan §미해결 결정에 "(확정)" 표기 + 결정 내용을 추가할 것. 특히 D3 는 "node.config 재유도 의미 유지" vs "편집 후 재개 차단(RESUME_INCOMPATIBLE_STATE 확대)" 중 명확한 선택이 PR-B 안전성에 필수적이다.

---

### [INFO] `node-cancellation-infrastructure.md §2` Phase 0 직렬화 순서 미확정

- **target 위치**: `exec-park-durable-resume.md §Phase 0` — "node-cancellation §2 와의 직렬화 순서 확정" 항목
- **관련 plan**: `node-cancellation-infrastructure.md §2` — `NodeExecution.status='cancelled'` enum 추가 + 엔진 dispatch 사전 체크. 현재 separate worktree(`node-cancellation-engine`) 에서 진행 중으로 기록됨
- **상세**: exec-park Phase 0 는 `node-cancellation §2` 와의 직렬화 순서를 확정해야 한다고 명시하고 있으나, 현재 `node-cancellation-infrastructure.md` 에서 §2 작업의 담당 worktree(`node-cancellation-engine`)가 활성 worktree 목록에 없다(git worktree list 에서 미발견). 두 작업의 선후행이 불명확한 상태로 Phase 0 를 완료하려 하면 상태 가드 겹침으로 인한 재작업이 발생할 수 있다.
- **제안**: Phase 0 착수 시 `node-cancellation-infrastructure.md §2` 의 현재 진행 상태(branch 존재 여부·담당자)를 확인하고 직렬화 순서를 명문화할 것.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정 cascade 로 skip 된 항목:

- `impl-exec-intake-queue` (branch `claude/impl-exec-intake-queue`) — Step 2 PR #463 MERGED. 해당 worktree 가 활성으로 남아 있으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.
- `spec-exec-intake-queue` (branch `claude/spec-exec-intake-queue`) — Step 2 PR #458 MERGED. 동일하게 cleanup 권장.
- `fix-bg-context-followups` (branch `claude/fix-bg-context-followups`) — Step 2 PR #451 MERGED. cleanup 권장.
- `kb-quality-fba2f2` (branch `claude/kb-quality-fba2f2`) — Step 2 PR #457 MERGED. `conversation-thread.md` 변경은 anchor text 링크 수정뿐이며 내용 충돌 없음. cleanup 권장.
- `agent-memory-admin-ui-455467` (branch `claude/agent-memory-admin-ui-455467`) — Step 1: main HEAD 와 동일 커밋(9f30216f), ancestor. STALE. 파일 변경 없음. cleanup 권장.

worktree 충돌 후보 7건 중 stale 5건 skip, active 2건 분석 (`impl-exec-concurrency-cap`, `ai-context-memory-9c7e6e`는 미착수 상태이므로 실제 worktree 없음 — 후자는 git worktree list 에 없어 충돌 위험 없음).

---

## 요약

`exec-park-durable-resume` plan 은 전반적으로 잘 구성되어 있으며, 이전 consistency-check (08:04:44) 에서 BLOCK 된 병렬 worktree 충돌(C1)을 단일 worktree 통합(D5)으로 해소한 점이 확인된다. 주요 정합 위험은 세 가지다: (1) D1(conversation_thread 컬럼 채택) 이 아직 사용자 승인을 기다리고 있어 Phase A1 전체가 전제 미확정 상태이고, (2) Phase 0 의 exec-intake-queue PR3(rehydration 일반화) 가 미구현 상태여서 Phase A 착수 전 선행 조건이 충족되지 않았으며, (3) `impl-exec-concurrency-cap` worktree 가 `4-execution-engine.md §8` 을 active 수정 중이라 같은 파일을 편집할 때 섹션이 달라도 PR 순서에 따른 rebase 충돌이 발생할 수 있다. stale worktree 5건은 이미 MERGED PR 의 정리되지 않은 worktree로, cleanup 이 권장된다. D2·D3 미결 결정도 구현 범위와 PR-B 안전성에 영향을 주므로 착수 전 확정이 권장된다.

---

## 위험도

MEDIUM
