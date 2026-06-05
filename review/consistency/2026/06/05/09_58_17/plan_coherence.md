# Plan 정합성 Check — `exec-park-durable-resume.md` (--impl-done, scope=spec/5-system/)

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)
Target plan: `plan/in-progress/exec-park-durable-resume.md`
검토 일시: 2026-06-05

---

## 발견사항

### [WARNING] Phase 0 cross-link 미완료 — exec-intake-queue-impl.md PR3 항목에 "exec-park 이관" 표기 미반영
- **target 위치**: `exec-park-durable-resume.md §Phase 0` 마지막 항목: `[ ] 출처 plan(exec-intake-queue PR3·node-cancellation §2) 항목 이관 표기 + cross-link (planner)`
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md §PR3`(`plan/in-progress/` 메인 버전 + worktree 양쪽 동일) — PR3 항목이 여전히 `[ ]` 상태이며 "→ exec-park-durable-resume 로 이관" 표기가 없다. D5 결정(단일 worktree 통합)에 따른 이관이 exec-intake-queue-impl.md 에 반영되지 않았다.
- **상세**: Phase 0 의 이 항목은 `(planner)` 소유로 명시되어 있고 아직 미체크다. A1 spec 변경은 이미 커밋됐으나, source plan 에 cross-link 가 없으면 exec-intake-queue-impl.md PR3 를 나중에 보는 개발자가 PR3 가 이미 exec-park 로 흡수됐음을 알지 못하고 중복 구현에 착수할 수 있다.
- **제안**: `plan/in-progress/exec-intake-queue-impl.md §PR3` 항목에 "→ exec-park-durable-resume Phase A2/B2 로 이관(2026-06-05 D5)" 표기 추가. `node-cancellation-infrastructure.md §2` 도 동일하게 직렬화 순서 확정 결과를 cross-note. (planner 작업)

---

### [WARNING] exec-intake-queue-impl.md 의 PR2a 상태 stale — "PR #469 OPEN" 표기가 실제 MERGED 와 불일치
- **target 위치**: `exec-park-durable-resume.md` (직접 포함하지 않으나 동일 worktree 내 `plan/in-progress/exec-intake-queue-impl.md` 가 참조 plan)
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md §PR2a` — `PR #469 OPEN(2026-06-05)` 표기.
- **상세**: PR #469 는 `feat(execution-engine): PR2a — §8 active-running 누적 타임아웃` 으로 origin/main(`722edf7a`)에 이미 포함됨(ancestor 확인). 마이그레이션 V083 도 exec-park worktree 의 migrations 폴더에 존재(V083 확인). exec-park branch 의 V084(`execution_conversation_thread`) 는 V083 직후이므로 현재 순번은 정합하나, exec-intake-queue-impl.md 의 PR2a 상태가 plan tracker 로서 stale 하다.
- **제안**: exec-intake-queue-impl.md §PR2a 상태를 `[x] PR #469 MERGED(2026-06-05)` 로 갱신. PR2b(concurrency cap) 착수 시 V085 번호 선점 확인 필요(exec-park V084 이후).

---

### [WARNING] D2/D3 미확정이 Phase A3·PR-B 범위에 영향 — spec §7.5 의 "variables 복원" 약속과 충돌 가능
- **target 위치**: `exec-park-durable-resume.md §미해결 결정` D2, D3. `exec-park-durable-resume.md §Spec 변경` — "`4-execution-engine.md §7.5`: rehydration 이 conversationThread·**variables** 를 복원함을 명시(무손실 보장)".
- **관련 plan**: `plan/in-progress/exec-park-durable-resume.md §Phase A3` — D2 미확정으로 미착수. spec 변경 항목에 `variables` 복원 명시가 포함돼 있으나 실제 커밋된 spec 변경(§7.5 diff)에는 `variables` 관련 서술이 없다. 즉 spec 변경 TODO 중 `variables` 파트가 아직 미반영.
- **상세**: (a) D2(user-defined variables 복원 포함 여부)가 결정되지 않은 상태에서 spec §7.5 에 `variables 복원` 약속을 추가하면 구현 전 약속이 된다 — 이는 "Planned" 표기와 동일한 drift 패턴. (b) D3(park 중 워크플로 편집 시 재개 정책)는 PR-B 의 "불변식 보장" 항목과 직접 관련되며 미결 상태에서 Phase B 착수 시 재개 의미가 불명확해진다.
- **제안**: Phase A3 착수 전 D2 를 확정(포함 or 별도 plan 분리)하고, spec §7.5 의 `variables` 복원 서술은 D2 확정 + 구현 완료 후 추가. D3 는 PR-B 착수 직전까지 확정.

---

### [WARNING] impl-exec-concurrency-cap(PR2b) 이 migration race 야기 가능 — V085 선점 충돌 위험
- **target 위치**: `exec-park-durable-resume.md §권장 PR 분해` — PR-A1(V084 migration 이미 커밋), PR-A2/B 이후 추가 migration 가능성.
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md §PR2b` — `execution.queued_at` 컬럼 신설(마이그레이션) 계획. 현재 branch `claude/impl-concurrency-cap-pr2b` 는 ACTIVE(미구현, plan 파일만 수정), V085 번호를 아직 선점하지 않았다.
- **상세**: exec-park V084 커밋 이후 PR2b 가 migration 을 추가하면 V085 를 시도할 것이다. 두 branch 가 병렬로 진행 중이라 V085 migration race 위험이 있다. 현재 `impl-exec-concurrency-cap` 은 code 변경 없이 plan 파일만 1커밋 앞서 있으므로 즉각 충돌은 아니나, PR-A1(exec-park) 이 먼저 머지되면 PR2b 는 V085 로 rebase 해야 한다.
- **제안**: PR-A1 머지 후 PR2b 착수 시 `migrations.md §5/§6` 절차대로 rebase + V085(= max+1) 재부여 확인. 동시 착수가 불가피하면 두 plan 간 migration 번호를 조율하거나, exec-park A-series 를 PR2b 머지 이후에 진행.

---

### [INFO] exec-intake-queue-impl.md 가 exec-park-durable-resume.md 를 pending_plans 에 등록하지 않음 — 추적 연결 부재
- **target 위치**: `spec/5-system/4-execution-engine.md` frontmatter `pending_plans` — exec-park-durable-resume.md 등록 완료. `plan/in-progress/exec-intake-queue-impl.md` frontmatter.
- **상세**: exec-intake-queue-impl.md 는 spec/5-system/4-execution-engine.md 를 SoT 로 삼고 있으며, Phase 0 흡수 결정(D5)으로 exec-park 가 PR3·PR4 의 일부를 담당하게 됐다. exec-intake-queue-impl.md 에 exec-park-durable-resume 참조나 D5 결정 메모가 없어 두 plan 의 연결 고리가 exec-park 단방향이다.
- **제안**: exec-intake-queue-impl.md 상단 또는 PR3 항목에 "Phase A2/B2 → exec-park-durable-resume 로 이관(D5 결정, 2026-06-05)" 메모 추가. (planner, WARNING #1 과 동일 작업)

---

### [INFO] spec/1-data-model.md 의 `conversation_thread` 컬럼 행 — 실행 이력 view SoT 와의 역할 분리 명시 충분
- **target 위치**: `spec/1-data-model.md §2.13 Execution` — `conversation_thread JSONB?` 행 추가(커밋 완료).
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md`, `plan/in-progress/ai-context-memory-auto.md`.
- **상세**: 신규 컬럼 설명이 "park 중 in-flight thread 의 무손실 재개만을 목적" + "실행 이력 화면의 NodeExecution 분산 SoT 와 목적·소비처 분리"를 명시해 ai-context-memory 계열 plan 의 기존 Redis 직렬화 영속 경로와 역할이 겹치지 않음이 확인된다. ai-context-memory-followup-v2.md 의 pending v2 항목(`tokenizer-exact`, `contextScope` 확장)은 본 변경에 의해 무효화되지 않는다.
- **제안**: 별도 조치 불필요. ai-context-memory-followup-v2.md 에서 §4 영속화 표를 참조하는 v2 항목이 있다면 "exec-park PR-A1 이 §4 에 신규 행 추가함" 을 인지할 수 있게 선택적 cross-note.

---

### [INFO] spec/4-nodes/3-ai/1-ai-agent.md §12.13 변경 — ai-context-memory plan 의 기존 결정과 정합
- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §12.13` 요약 보관 필드 fallback 결정 갱신(커밋 완료).
- **관련 plan**: `plan/in-progress/ai-context-memory-auto.md`, `plan/in-progress/ai-context-memory-followup-v2.md`.
- **상세**: 기존 §12.13 은 "Redis ExecutionContext 에만 보관, 별도 DB 컬럼 없음" 으로 정의됐으나, 이제 "park 시 conversation_thread 컬럼에 thread 와 함께 durable 영속" 으로 갱신됐다. ai-context-memory-auto.md 의 `[x] conversation-thread.md §4: runningSummary/summarizedUpToSeq Redis 직렬화/rehydration` 완료 항목과 충돌하지 않는다 — park 스냅샷이 추가됐으나 active 세그먼트 중 Redis 직렬화 경로는 동일하게 유효.
- **제안**: 별도 조치 불필요. ai-context-memory 계열 후속 착수 시 §12.13 의 "park 스냅샷 영속" 조항이 추가됐음을 인지하면 충분.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보에 대해 stale 판정 cascade 적용 결과:

| worktree | branch | Step 1 | Step 2 | 판정 |
|---|---|---|---|---|
| `agent-a78619aab700d87a4` | `claude/agent-a78619aab700d87a4` | ACTIVE (squash) | PR #466 MERGED | **stale skip** |
| `agent-a382d5fc6d0ac5aca` | `claude/agent-a382d5fc6d0ac5aca` | ACTIVE (squash) | PR #467 MERGED | **stale skip** |
| `impl-exec-intake-queue` | `claude/impl-exec-intake-queue` | ACTIVE (squash) | PR #463 MERGED | **stale skip** |
| `spec-exec-intake-queue` | `claude/spec-exec-intake-queue` | ACTIVE (squash) | PR #458 MERGED | **stale skip** |
| `rag-rerank-impl` | `claude/rag-rerank-impl` | — | PR #465 MERGED | **stale skip** |
| `integration-index-unify-2c7973` | `claude/integration-index-unify-2c7973` | — | MERGED | **stale skip** |
| `makeshop-api-catalog-730deb` | `claude/makeshop-api-catalog-730deb` | — | MERGED | **stale skip** |
| `competitive-analysis-e0569b` | `claude/competitive-analysis-e0569b` | — | MERGED | **stale skip** |
| `spec-inprogress-groom-c7568b` | `claude/spec-inprogress-impl2` | — | PR #452 MERGED | **stale skip** |
| (구 fix/exec-engine-park-worker-job-release) | `claude/agent-a71ad1921ae84d695` | STALE (ancestor) | — | **stale skip** |
| `agent-memory-embedding-model` | `claude/agent-memory-embedding-model` | — | spec 파일 미접촉 | **비대상** |

stale worktree 들은 활성 Git worktree 로 남아 있으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

**active 로 분류된 worktree:**
- `impl-exec-concurrency-cap` (branch `claude/impl-exec-concurrency-cap-pr2b`) — PR 없음, Step 1 ACTIVE, plan 파일만 수정(spec 파일 미접촉). §5 spec/5-system/4-execution-engine.md 미수정이므로 현재 spec 충돌 없음. migration race 위험만 존재 (WARNING #4).

worktree 충돌 후보 11건 중 stale 10건 skip, active 1건 분석. active 1건은 spec 파일 비접촉으로 CRITICAL 해당 없음.

---

## 요약

이번 검토(--impl-done)는 exec-park-durable-resume 의 Phase A1 spec 변경(A1 커밋: `spec/5-system/4-execution-engine.md`, `spec/1-data-model.md`, `spec/conventions/conversation-thread.md`, `spec/4-nodes/3-ai/1-ai-agent.md`)이 in-progress plan 들과 정합하는지 평가했다. D1/D4/D5 결정 확정·spec 동기 갱신·BLOCK:NO (--impl-prep 09:01)로 이전 BLOCK 이 해소된 상태이며, A1 구현 범위의 직접 충돌(CRITICAL)은 없다. 주요 위험은 (1) Phase 0 cross-link 미완료로 exec-intake-queue-impl.md PR3 항목이 이관 표기 없이 방치돼 중복 착수 오해를 유발할 수 있는 점, (2) PR2a 상태가 stale(plan에서 "OPEN"으로 남아 있으나 실제 MERGED), (3) D2/D3 미결이 Phase A3·B 의 spec §7.5 `variables` 약속과 충돌 가능성, (4) PR2b(impl-exec-concurrency-cap)의 신규 migration 이 V085 race 를 야기할 수 있는 점이다. stale worktree 10건 skip, active 1건 분석(spec 비접촉, migration race 위험만).

---

## 위험도

LOW
