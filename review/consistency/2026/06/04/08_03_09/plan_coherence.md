# Plan 정합성 검토 결과

> target: `plan/in-progress/spec-draft-exec-intake-queue.md`
> 검토일: 2026-06-04

---

## 발견사항

### [WARNING] spec-sync-execution-engine-gaps.md 의 §4·§7.1·§8 추적 항목이 무효화됨 — plan 갱신 필요

- **target 위치**: target 전체 (§1 §4 재정의, §3 §7.1 재정의, §5 §8 재정의)
- **관련 plan**: `plan/in-progress/spec-sync-execution-engine-gaps.md` — 3개 미해결 TODO
  - `[ ] §4 Worker 모델 — 별도 Redis BQ task-queue, 1 Worker = 1 NodeExecution …`
  - `[ ] §7.1 Worker Heartbeat — 5초 간격 heartbeat / 15초 미응답 판정 / 미응답 태스크 재큐 …`
  - `[ ] §8 동시 실행 제한 — 워크스페이스 10 / 워크플로우 3 동시 Execution 가드 …`
- **상세**: spec-sync 계획은 위 3항목을 "구현되지 않은 aspirational 표면"으로 추적하고 있다. target 이 spec 에 반영되면 이 항목들은 **per-node task queue 모델 자체가 폐기**되므로 기존 TODO가 의미를 잃는다. §4 는 "1 Worker = 1 NodeExecution" 대신 "1 Worker = 1 active 세그먼트"로, §7.1 은 heartbeat 재큐 대신 "BullMQ stalled-job 검출"로, §8 의 "30분 timeout(wall-clock)" 은 "active-running 누적 시간 기준"으로 대체된다. spec-sync plan 의 미결 박스들은 완료 또는 폐기 처리가 필요하며, 해당 plan 에서 타겟 변경에 의한 상태 변경을 명시해야 한다.
- **제안**: spec 본문 반영 전에 `plan/in-progress/spec-sync-execution-engine-gaps.md` 를 갱신하여 (a) §4 항목 → "per-node 모델 폐기, execution-level intake 큐로 대체 — spec-draft-exec-intake-queue.md 로 이관" 으로 닫고, (b) §7.1 항목 → "heartbeat 재큐 모델 폐기, BullMQ stalled-job 검출로 대체" 로 닫으며, (c) §8 항목 → "동시 cap·timeout 재정의 예정 — spec-draft-exec-intake-queue.md §5" 로 forwarding 처리한다.

---

### [WARNING] execution-engine-residual-gaps.md G1·G2 차단 전제와 target §7.1 재정의의 정합 확인 필요

- **target 위치**: target §3 `§7.1 재정의 — stalled-job 재큐 (active 세그먼트 한정)` + `recoverStuckExecutions() 절대시간 일괄 fail 을 stalled 메커니즘으로 대체 예정`
- **관련 plan**: `plan/in-progress/execution-engine-residual-gaps.md` G2 차단 사유 — "cross-instance 재개 메커니즘이 없다 (`execution-continuation` 큐 + `applyContinuation` 은 WAITING_FOR_INPUT rehydration 전용)"
- **상세**: target 의 §7.1 재정의는 "active 세그먼트 job 이 크래시하면 BullMQ stalled-job 검출 → §7.5 rehydration 으로 재개"라고 명시한다. 그런데 execution-engine-residual-gaps.md G2 는 "in-process 재개는 `execution-continuation` + `applyContinuation` 이 WAITING_FOR_INPUT rehydration 전용이라 cross-instance mid-execution 재개 불가"를 차단 사유 3번으로 기록하고 있다. target 의 stalled 재배달 → §7.5 rehydration 재개 경로가 실제로 이 gap 을 해소하는지, 아니면 target §7 구현은 별도 구현 선결 조건을 수반하는지 plan 내 명확화가 필요하다. G2 는 현재 BLOCKED 상태이며 spec-frontmatter-status-migration-027c17 worktree(MERGED/stale)에 할당돼 있어 혼선 우려.
- **제안**: target 의 후속(§후속 항목 4번 "구현 추적 plan 신설 — PR3 크래시 재개") 에 `execution-engine-residual-gaps.md G2 와의 관계` 명시를 추가하거나, G2 차단 항목을 target spec 반영 후 재평가한다는 메모를 해당 plan 에 기재한다.

---

### [WARNING] 0-overview.md Rationale 섹션 — active worktree 2개와 인접 hunk 충돌 위험

- **target 위치**: target §6 "Rationale '실행 엔진: Redis 큐 + 분산 워커 풀' 에 NodeExecution = 워커가 핸들러 호출 문구를 execution-level 세그먼트 모델로 정정" — `spec/0-overview.md` line ~382–384 영역
- **관련 plan**: `competitive-analysis-e0569b` worktree (PR OPEN) 가 동일 파일 line ~390 ("Cafe24·MakeShop 통합을 §6.1 완료 분류로" Rationale 제목 변경) 을 수정 중. `ai-context-memory-9c7e6e` worktree (PR 없음 — Step3 ACTIVE) 도 line ~390 같은 hunk 에 동일 변경을 포함.
- **상세**: `spec/0-overview.md` `## Rationale` 의 "실행 엔진: Redis 큐 + 분산 워커 풀" 항목(line ~380–384)과 "Cafe24·MakeShop 통합을 §6.1 완료 분류로" 항목(line ~389–392)은 10행 이내 거리로, 일반적 git diff 3-line-context 기준 동일 hunk 안에 들어올 가능성이 높다. target 이 line 382 영역을 수정하고 경쟁 worktree 가 line 390 을 수정하면 3-way merge 에서 충돌이 발생한다.
- **제안**: spec 반영 시 해당 파일을 먼저 경쟁 worktree(competitive-analysis, ai-context-memory)의 main 병합 후 최신 베이스에서 시작하거나, merge 시 수동 해소 계획을 세운다. target plan §후속 "spec 본문 반영" 항목에 "0-overview.md 는 competitive-analysis·ai-context-memory PR 선행 또는 수동 resolve 필요" 메모를 추가할 것.

---

### [INFO] §후속 항목 4번 구현 plan 신설 시 node-cancellation-infrastructure.md 와 선행 의존 확인 권장

- **target 위치**: target §후속 "구현 추적 plan 신설 (PR3 크래시 재개)"
- **관련 plan**: `plan/in-progress/node-cancellation-infrastructure.md` §2 — "stalled 재배달 시 §7.5 rehydration 으로 세그먼트 재개" 경로는 AbortSignal 전파(§2) 없이도 동작하지만, RUNNING 노드 크래시 후 재배달될 때 비멱등 노드 중복 실행은 §7.3 멱등성 및 §7.2 checkpoint 와 맞물린다.
- **상세**: target 의 구현 PR3 (크래시 재개) 를 신설할 때 node-cancellation-infrastructure.md 의 §2 (엔진단 signal 전파, 별도 cancel-status 작업) 와 같은 코드 영역(`execution-engine.service.ts`)이 겹칠 수 있다. 설계 충돌은 아니나 구현 시 coordinate 가 필요하다.
- **제안**: PR3 구현 plan 생성 시 node-cancellation-infrastructure.md §2 와의 직렬화 순서를 명시한다.

---

### [INFO] spec-draft-exec-intake-queue.md 자체의 "구현 선결조건 §7-1 동기 실행 경로 식별" 는 미해결 결정

- **target 위치**: target §7 "구현 선결조건" 항목 1 — `execute()` 를 인라인 await 하는 caller(REST API/chat-channel/EIA) 식별 및 비동기 전환 전략
- **관련 plan**: 없음 (신규 결정 필요 사항)
- **상세**: 이 항목은 spec 본문 반영(일반 독자에게 노출)에 포함되는 내용이지만, 실제 결정(어떤 caller 가 있고 어떻게 전환할지)은 아직 내려지지 않았다. spec 에 "구현 시 검증" 으로 명시한다고 되어 있어 spec 반영 자체는 가능하나, 구현 단계에서 결정이 필요함을 명확히 기록해 두어야 한다.
- **제안**: 해당 내용은 현재 수준("구현 선결로 식별 필요")으로 spec 반영하되, 구현 plan 신설 시 caller 식별 결과를 의사결정 기록으로 포함하도록 plan template 에 박스를 예약한다.

---

## Stale 으로 skip 한 worktree (의무 기재)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

| worktree | branch | 판정 |
|---|---|---|
| `spec-sync-audit` | `claude/spec-sync-audit` | Step 2: PR MERGED |
| `fix-bg-context-followups` | `claude/fix-bg-context-followups` | Step 2: PR MERGED |
| `spec-frontmatter-status-migration-027c17` | `claude/spec-frontmatter-status-migration-027c17` | Step 2: PR MERGED |
| `spec-drift-gates-b26bce` | `claude/spec-drift-gates-b26bce` | Step 2: PR #449 MERGED |
| `continuation-worker-concurrency-env` | `claude/continuation-worker-concurrency-env` | Step 2: PR #411 MERGED |
| `fix-spec-frontmatter-catalog` | `claude/fix-spec-frontmatter-catalog` | Step 2: PR #453 MERGED |
| `workflow-turn-timing-69fee2` | `claude/workflow-turn-timing-69fee2` | Step 2: PR MERGED |
| `spec-inprogress-groom-c7568b` | `claude/spec-inprogress-impl2` | Step 1: main 의 ancestor |

이 worktree 들은 활성으로 남아있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target `spec-draft-exec-intake-queue.md` 은 `spec/5-system/4-execution-engine.md` §4·§7.1·§8 과 `spec/0-overview.md` §2.4·§2.6·Rationale 을 재정의한다. 미해결 결정을 일방적으로 우회하거나 active worktree 의 동일 섹션과 직접 충돌하는 CRITICAL 건은 없다 — target 이 수정하는 `4-execution-engine.md` §4·§7·§8 구간(line 346+, 740+, 923+)과 경쟁 worktree(competitive-analysis·ai-context-memory·kb-quality)가 수정하는 구간(§5·§6.1·§6.2·§11)은 line range 가 분리된다. 단, **`spec-sync-execution-engine-gaps.md` 의 §4·§7.1·§8 추적 TODO 가 target 에 의해 무효화되는 WARNING 2건**과 **0-overview.md Rationale 인접 hunk 머지 충돌 위험 WARNING 1건**이 있어, spec 반영 전 해당 plan 의 후속 항목 갱신 및 merge 순서 조율이 필요하다. worktree 충돌 후보 10건 중 stale 8건 skip, active 3건(competitive-analysis·ai-context-memory·kb-quality) 분석.

---

## 위험도

LOW
