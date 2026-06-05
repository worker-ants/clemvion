# Plan 정합성 Check — `exec-park-durable-resume.md` (--impl-done, scope=spec/5-system/)

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)
Target plan: `plan/in-progress/exec-park-durable-resume.md`
검토 일시: 2026-06-05 (직전 검토: 09:58:17)

---

## 발견사항

### [WARNING] Phase 0 cross-link 미완료 — exec-intake-queue-impl.md PR3 항목에 "exec-park 이관" 표기 미반영

- **target 위치**: `exec-park-durable-resume.md §Phase 0` 마지막 항목 `[ ] 출처 plan(exec-intake-queue PR3·node-cancellation §2) 항목 이관 표기 + cross-link (planner)` — 여전히 미체크.
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md §PR3` — PR3 항목이 `[ ]` 미체크이며 "→ exec-park-durable-resume 로 이관" 표기가 없다. D5 결정(단일 worktree 통합)에 따른 이관이 exec-intake-queue-impl.md 에 반영되지 않았다.
- **상세**: Phase A1 spec/코드 구현은 완료됐으나, source plan 에 cross-link 가 없으면 exec-intake-queue-impl.md PR3 를 보는 개발자가 PR3 가 exec-park 로 흡수됐음을 알지 못하고 중복 구현에 착수할 수 있다. `node-cancellation-infrastructure.md §2` 도 동일하게 직렬화 순서 확정 결과가 기록되지 않았다.
- **제안**: `plan/in-progress/exec-intake-queue-impl.md §PR3` 항목에 "→ exec-park-durable-resume Phase A2/B2 로 이관(2026-06-05 D5)" 표기 추가. `node-cancellation-infrastructure.md §2` 도 직렬화 순서 확정 결과를 cross-note. (planner 작업)

---

### [WARNING] exec-intake-queue-impl.md 의 PR2a 상태 stale — "OPEN" 표기가 실제 MERGED 와 불일치

- **target 위치**: `plan/in-progress/exec-intake-queue-impl.md §PR2a` — PR #469 표기.
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md §PR2a`.
- **상세**: PR #469 (`feat(execution-engine): PR2a — §8 active-running 누적 타임아웃`)는 origin/main(`722edf7a`)에 이미 포함됨(exec-park branch 의 base 커밋). 마이그레이션 V083 이 exec-park worktree migrations 폴더에 존재하고 V084(conversation_thread)는 V083 직후이므로 번호 정합성은 유지되나, exec-intake-queue-impl.md 의 PR2a 상태가 plan tracker 로서 stale 하다. PR2b(concurrency cap) 착수 시 V085 번호 선점 확인 필요.
- **제안**: exec-intake-queue-impl.md §PR2a 상태를 `[x] PR #469 MERGED(2026-06-05)` 로 갱신. (planner 작업)

---

### [WARNING] D2/D3 미확정 — Phase A3·PR-B spec §7.5 의 "variables 복원" 약속과 충돌 가능

- **target 위치**: `exec-park-durable-resume.md §미해결 결정` D2, D3. `exec-park-durable-resume.md §Spec 변경` — "`4-execution-engine.md §7.5`: rehydration 이 conversationThread·**variables** 를 복원함을 명시(무손실 보장)".
- **관련 plan**: `plan/in-progress/exec-park-durable-resume.md §Phase A3`, §Spec 변경 bullet.
- **상세**: (a) D2(user-defined variables 복원 범위) 가 결정되지 않은 상태에서 spec §7.5 에 `variables 복원` 약속을 추가하면 구현 전 약속이 된다 — Planned 표기가 없는 사전 커밋 drift 패턴. 현재 커밋된 spec §7.5 diff 에는 `variables` 관련 서술이 없어 TODO 로 남아 있다. (b) D3(park 중 워크플로 편집 시 재개 정책)는 PR-B 의 "불변식 보장" 항목과 직접 관련되며 미결 상태에서 Phase B 착수 시 재개 의미가 불명확해진다.
- **제안**: Phase A3 착수 전 D2 를 확정(포함 or 별도 plan 분리)하고, spec §7.5 의 `variables` 복원 서술은 D2 확정 + 구현 완료 후 추가. D3 는 PR-B 착수 직전까지 확정.

---

### [WARNING] impl-exec-concurrency-cap(PR2b) migration race 위험 — V085 선점 충돌 가능

- **target 위치**: `exec-park-durable-resume.md §권장 PR 분해` — PR-A1(V084 migration 커밋 완료), PR-A2/B 이후 추가 migration 가능성.
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md §PR2b` (worktree `impl-exec-concurrency-cap`, branch `claude/impl-concurrency-cap-pr2b`, ACTIVE, PR 없음).
- **상세**: `claude/impl-concurrency-cap-pr2b` 는 현재 origin/main 대비 spec 파일을 수정하지 않는다(plan 파일 1커밋만 앞서). 그러나 PR2b 는 `execution.queued_at` 컬럼 신설(migration) 계획을 포함한다. exec-park V084 커밋 이후 PR2b 가 migration 을 추가하면 V085 를 시도할 것이며, 두 branch 가 병렬로 진행 중이라 V085 migration race 위험이 있다. 현재는 즉각 충돌 없으나 PR-A1 머지 전후로 순서 조율이 필요하다.
- **제안**: PR-A1 머지 후 PR2b 착수 시 `migrations.md §5/§6` 절차대로 V085(= max+1) 재부여 확인. 동시 착수가 불가피하면 두 plan 간 migration 번호를 조율하거나, exec-park A-series 를 PR2b 머지 이후 진행.

---

### [INFO] spec/1-data-model.md 의 `conversation_thread` 컬럼 행 — ai-context-memory 계열과 역할 분리 충분

- **target 위치**: `spec/1-data-model.md §2.13 Execution` — `conversation_thread JSONB?` 행 추가(V084, 커밋 완료).
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md`, `plan/in-progress/ai-context-memory-auto.md`.
- **상세**: 신규 컬럼 설명이 "park 중 in-flight thread 의 무손실 재개만을 목적" + "실행 이력 화면의 NodeExecution 분산 SoT 와 목적·소비처 분리"를 명시해 ai-context-memory 계열 plan 의 기존 Redis 직렬화 영속 경로와 역할이 겹치지 않음이 확인된다. ai-context-memory-followup-v2.md 의 pending v2 항목(tokenizer-exact, contextScope 확장)은 본 변경에 의해 무효화되지 않는다.
- **제안**: 별도 조치 불필요. ai-context-memory-followup-v2.md 에서 §4 영속화 표를 참조하는 v2 항목이 있다면 "exec-park PR-A1 이 §4 에 신규 행 추가함"을 인지할 수 있게 선택적 cross-note.

---

### [INFO] spec/4-nodes/3-ai/1-ai-agent.md §12.13 변경 — ai-context-memory plan 과 정합

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §12.13` Redis fallback 정책 갱신(커밋 완료).
- **관련 plan**: `plan/in-progress/ai-context-memory-auto.md`, `plan/in-progress/ai-context-memory-followup-v2.md`.
- **상세**: §12.13 이 "park 시 conversation_thread 컬럼에 durable 영속"으로 갱신됐다. ai-context-memory-auto.md 의 `[x] conversation-thread.md §4: runningSummary/summarizedUpToSeq Redis 직렬화/rehydration` 완료 항목과 충돌하지 않는다 — park 스냅샷이 추가됐으나 active 세그먼트 중 Redis 직렬화 경로는 동일하게 유효.
- **제안**: 별도 조치 불필요.

---

## Stale 으로 skip 한 worktree (의무)

| worktree | branch | Step 1 | Step 2 | 판정 |
|---|---|---|---|---|
| `agent-a78619aab700d87a4` | `claude/agent-a78619aab700d87a4` | ACTIVE (squash) | PR #466 MERGED | **stale skip** |
| `agent-a382d5fc6d0ac5aca` | `claude/agent-a382d5fc6d0ac5aca` | ACTIVE (squash) | PR #467 MERGED | **stale skip** |
| `impl-exec-intake-queue` | `claude/impl-exec-intake-queue` | ACTIVE (squash) | PR #463 MERGED | **stale skip** |
| `spec-exec-intake-queue` | `claude/spec-exec-intake-queue` | ACTIVE (squash) | PR #458 MERGED | **stale skip** |
| `rag-rerank-impl` | `claude/rag-rerank-impl` | ACTIVE (squash) | MERGED | **stale skip** |
| `integration-index-unify-2c7973` | `claude/integration-index-unify-2c7973` | ACTIVE (squash) | MERGED | **stale skip** |
| `makeshop-api-catalog-730deb` | `claude/makeshop-api-catalog-730deb` | ACTIVE (squash) | MERGED | **stale skip** |
| `competitive-analysis-e0569b` | `claude/competitive-analysis-e0569b` | ACTIVE (squash) | MERGED | **stale skip** |
| `spec-inprogress-groom-c7568b` | `claude/spec-inprogress-impl2` | ACTIVE (squash) | PR #452 MERGED | **stale skip** |
| `fix-bg-context-followups` | `claude/fix-bg-context-followups` | ACTIVE (squash) | PR #451 MERGED | **stale skip** |
| `workflow-turn-timing-69fee2` | `claude/workflow-turn-timing-69fee2` | ACTIVE (squash) | MERGED | **stale skip** |
| `continuation-worker-concurrency-env` | `claude/continuation-worker-concurrency-env` | ACTIVE (squash) | MERGED | **stale skip** |
| `agent-memory-admin-ui-455467` | `claude/agent-memory-admin-ui-455467` | STALE (ancestor) | — | **stale skip** |

stale worktree 들은 활성 Git worktree 로 남아 있으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

**active 로 분류된 worktree:**
- `impl-exec-concurrency-cap` (branch `claude/impl-concurrency-cap-pr2b`) — PR 없음, Step 1 ACTIVE, origin/main 대비 spec 파일 무수정(plan 파일 1커밋만 앞섬). spec 충돌 CRITICAL 없음. migration race 위험만 존재(WARNING #4).

worktree 충돌 후보 13건 중 stale 12건 skip, active 1건 분석. active 1건은 spec 파일 비접촉으로 CRITICAL 해당 없음.

---

## 요약

이번 검토(--impl-done, 10:12)는 09:58 검토 이후 추가된 커밋 `7ba30c29`(spec §4.x blockquote A1 완료 반영 + plan D1 마이그레이션 V084 정정)를 포함한 최신 상태를 대상으로 한다. Phase A1 spec/코드 구현이 완료됐고 09:58 검토의 W1(spec §4.x 미갱신) 가 해소됐다. 직접 충돌(CRITICAL)은 없다. 남은 주요 위험은 (1) Phase 0 cross-link 미완료로 exec-intake-queue-impl.md PR3 가 이관 표기 없이 방치되어 중복 착수 오해를 유발할 수 있는 점, (2) exec-intake-queue-impl.md PR2a 상태가 "OPEN"으로 stale, (3) D2/D3 미결이 Phase A3·B 의 spec §7.5 `variables` 약속과 충돌 가능성, (4) PR2b(impl-exec-concurrency-cap) migration V085 race 위험이다. 이 4건은 모두 WARNING 등급으로 현재 A1 구현 결과 자체의 무결성을 침해하지 않는다. stale worktree 12건 skip, active 1건 분석(spec 비접촉, migration race 위험만).

---

## 위험도

LOW
