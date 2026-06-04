---
worktree: exec-park-durable-resume
started: 2026-06-05
owner: developer
---

# Plan — park 완전 해제 + slow-path 일원화 (durable resume state)

> #468 은 worker 슬롯 점유 버그를 "detached coroutine + `firstSegmentBarriers`" 로
> 풀었다 — park 시 worker job 은 ack 하되 `runExecution` 코루틴을 **in-process 로
> 살려** 재개를 무손실 fast-path(`pendingContinuations`)로 처리한다. 그러나 유저
> 입력 시점이 불확정이라 **응답 없는 park execution 의 coroutine·context 가
> 메모리에 무한 누적**되는 리스크가 있다(#468 후속 #1, 사용자 정공법 결정 2026-06-05).
>
> 본 plan 은 이를 **"park 즉시 coroutine 완전 해제 + 모든 재개를 slow-path
> (rehydration) 로 일원화"** 로 전환한다. 전제는 **resume 상태의 durable 영속**으로
> rehydration 을 무손실화하는 것이다 (그래야 `RESUME_INCOMPATIBLE_STATE` /
> `RESUME_CHECKPOINT_MISSING` 이 상시화되지 않는다).
>
> SoT: `spec/5-system/4-execution-engine.md` §4.x(durable park)·§7.4(continuation bus)·§7.5(rehydration). 관련 잔여 추적: [`execution-engine-residual-gaps.md`](execution-engine-residual-gaps.md).

## 목표 / Rationale

- **bounded 메모리**: park 수와 무관하게 프로세스 메모리가 일정 — 응답 없는 대기가 누적돼도 안전.
- **단일 재개 경로**: fast-path/slow-path 이원화를 제거해 추론·테스트·운영 단순화, 멀티인스턴스/재시작/스케일아웃에 균일.
- **무손실 재개**: rehydration 이 conversationThread·멀티턴 상태를 정확히 복원 → 사용자 체감 동일.

## 현행 durability 맵 (조사 2026-06-05, `execution-engine.service.ts`)

**이미 durable (park 직전 DB 영속)**
- `Execution.status` / `NodeExecution.status` = `WAITING_FOR_INPUT`
- `NodeExecution.outputData` (form/button: full output + `meta.interactionType`)
- ai_agent `_resumeCheckpoint` (`outputData._resumeCheckpoint`) — 첫 park + 매 turn 저장. 포함: messages·turnCount·tokens·model/temperature/maxTokens·KB/rag/mcp ref·pendingFormToolCall. 미포함(node.config 재유도): llmConfigId·workspaceId·conditions·presentationTools·maxTurns 등.

**in-memory 전용 (rehydration 시 손실/리셋)**
- `conversationThread` → `createEmptyConversationThread()` 로 **리셋**. ★ 최대 갭. **단 이는 spec↔impl drift**: spec `4-execution-engine.md §6.2/§7.5` 와 `conversation-thread.md §4 L213` 은 "ExecutionContext rehydration 으로 thread 복원"을 이미 **약속**하나 코드는 미이행(빈 thread 리셋). 즉 A1 은 신규 정책이 아니라 **약속된 복원의 구현 + drift 정합화**다 (consistency-check I3 확인).
- user-defined variables (Variable Declaration 런타임 값) → 복원 안 됨
- `turnDebugHistory` / `lastTurnRequest/Response` → 손실 (debug 용, 수용 가능)
- `reachable` Set → 휴리스틱 재계산 (executedNodes 복원되므로 대체로 무해)

**재개 실패 코드**
- `RESUME_CHECKPOINT_MISSING`: execution/workflow/nodeExec 데이터 부재, 또는 비-ai_agent waiting 의 checkpoint 부재.
- `RESUME_INCOMPATIBLE_STATE`: ai_agent checkpoint 부재(배포 이전 row) 또는 `buildRetryReentryState` 재구성 실패(schema drift).

---

## Phase A — resume 상태 durable 영속 (rehydration 무손실화) [선행]

> Phase B(해제)의 **전제**. A 완료 전 B 로 flip 하면 재개가 상시 손실/실패한다.

### A1. conversationThread 영속 + rehydration 복원 — ⭐⭐⭐ (핵심, spec drift 정합화)
- [ ] **영속 매체 = `Execution.conversation_thread jsonb`** — spec `conversation-thread.md §4 L211/§9.11 L284` 이 이미 이 컬럼을 예고("향후 …검토", 현 NodeExecution 분산 저장의 cross-node N+1 해소 목적). D1 은 이 예고 컬럼 채택으로 확정(아래).
- [ ] migrations.md §5 절차로 `Execution.conversation_thread jsonb NULL` 마이그레이션.
- [ ] park 직전(각 `waitForX`) `context.conversationThread` 스냅샷을 해당 컬럼에 durable 저장.
- [ ] `rehydrateContext`(현 `createEmptyConversationThread()` 리셋, ~L91/L1194-1210)가 컬럼에서 thread 를 복원하도록 — spec §6.2/§7.5/§conversation-thread §4 L213 이 약속한 동작의 구현.
- [ ] conversation-thread.md "신규 DB 컬럼 없음" 조항(§4/§7/§8 세 앵커) + `4-execution-engine.md §6.2` 를 **한 PR 로 동기 갱신**, Rationale 에 정책 전환 사유 명문화 (planner). (consistency W2/W3)
- 테스트: park → thread 손실 없이 재개(같은 인스턴스·재시작·타 인스턴스).

### A2. _resumeCheckpoint 재구성 견고화 — ⭐⭐
- [ ] `buildRetryReentryState` 재구성 실패(schema drift) 시 graceful 처리 경계 점검 — 어떤 node.config 변경이 `RESUME_INCOMPATIBLE_STATE` 를 유발하는지 목록화.
- [ ] checkpoint 버전 필드 추가(스키마 진화 대비) + 누락 필드 기본값 보강.
- [ ] information_extractor 멀티턴도 ai_agent 와 동일하게 checkpoint 저장(현재 ai_agent 한정 여부 확인 후 확장).
- 테스트: 구(舊) checkpoint 포맷 → 재개 성공/명확한 graceful 종료.

### A3. user-defined variables 영속 + 복원 — ⭐⭐⭐ (범위 확인 필요)
- [ ] Variable Declaration 등 런타임 variables 가 재개 의미에 필요한지 판단(범위 D2).
- [ ] 필요 시 park 직전 `context.variables`(시스템 `__*` 제외 사용자분) 영속 + rehydration 복원.
- 주의: 범위가 크면 별도 plan 분리.

---

## Phase B — park 즉시 해제 + slow-path 일원화 [A 완료 후]

### B1. park 시 coroutine 반환(해제)
- [ ] `waitForFormSubmission`/`waitForButtonInteraction`/`waitForAiConversation` 의 `await new Promise()` 대기 제거 — durable 영속 후 **즉시 반환**해 `runExecution` 세그먼트 종료.
- [ ] `runExecutionFromQueue` 의 detached coroutine + `firstSegmentBarriers` 대기 단순화/제거 (park 가 곧 세그먼트 종료이므로 배리어 불필요).

### B2. 재개 = 항상 rehydration
- [ ] continuation 처리(`applyContinuation`)에서 fast-path(`pendingContinuations.has`) 제거 또는 "같은 프로세스 우연 생존 시 순수 최적화"로 강등(의존 금지).
- [ ] 모든 재개가 `execution-continuation` job → `rehydrateAndResume` 로 일원화.
- [ ] 불변식 보장: 동일 turn 이중 실행 0 (durable WAITING + status 가드), continuation 유실 0(durable 큐), 멱등.

### B3. 정리(제거)
- [ ] `pendingContinuations` Map (fast-path 의존 제거 후), `firstSegmentBarriers`/`armFirstSegmentBarrier`/`settleFirstSegment`/`signalParkBarrier` 제거 또는 축소.
- [ ] #468 의 W1/W2 방어 로직 중 해제로 불필요해진 부분 정리.

---

## Spec 변경 (project-planner)
- `4-execution-engine.md §4.x`(실제 heading "waiting_for_input park"): "park 즉시 해제 + slow-path 일원화" 로 구현 모델 갱신(현 §4.x 구현 메모 대체), fast-path 제거 반영.
- `4-execution-engine.md §7.4`: Worker 동작 행의 "로컬 pendingMap 즉시 resolve(fast-path)" 서술 정정(제거/강등). (consistency W5/I2 — 누락분 추가)
- `4-execution-engine.md §7.5`: rehydration 이 conversationThread·variables 를 복원함을 명시(무손실 보장) + case 1(fast-path) 문구 동반 정정.
- `4-execution-engine.md §6.2` + `conventions/conversation-thread.md §4/§7/§8`(세 앵커): "신규 DB 컬럼 없음" → `Execution.conversation_thread` 채택으로 **한 PR 동기 갱신**, Rationale 기록.
- A2 채택 시 "ai_agent 한정" 문구 3곳(`4-execution-engine.md §112`·`3-information-extractor.md §357`·`1-ai-agent.md §703`) 동기 갱신. (consistency I4)
- frontmatter `pending_plans:` 에 본 plan 등록 (`conversation-thread.md`·`4-execution-engine.md`). (I7)
- consistency-check `--spec` 의무(쓰기 직전), `--plan`(본 plan) 점검.

## 권장 PR 분해 (시퀀싱)
1. **PR-A1**: conversationThread durable 영속 + rehydration 복원 (+spec §7.5, conversation-thread.md).
2. **PR-A2**: checkpoint 견고화 + information_extractor 확장.
3. **PR-A3**(범위 시): user variables 영속 — 또는 별도 plan.
4. **PR-B**: park 즉시 해제 + slow-path 일원화 + fast-path 제거 (+spec §4.x). e2e 회귀(park→worker kill→무손실 재개) 필수.

> 각 PR 은 SDD+TDD, TEST/REVIEW WORKFLOW 이행. PR-B 는 실행엔진 코어라 e2e(dockerized) 무손실 재개 시나리오를 반드시 포함.

## 리스크
- **A1 conversationThread 직렬화**: turns 는 frozen·JSON 가능하나 크기(대화 길이) 고려 — 컬럼 vs 테이블 선택이 성능에 영향.
- **A2 멀티턴 직렬화**: `_resumeState` 의 비직렬화 요소(핸들러 ref·closure)는 이미 checkpoint allow-list 로 배제됨 — 재구성이 node.config 안정성에 의존. 워크플로 정의가 park 중 변경되면(편집) 재구성 의미 모호 → 결정 D3.
- **B 전환**: 매 재개가 rehydration 비용 — 재개는 사람-페이스라 수용 가능하나, 고빈도 멀티턴(자율 루프)에서 turn 마다 rehydration 시 비용 누적 가능 → B2 에서 멀티턴은 "한 세그먼트 = 대화 종료까지" 유지할지 turn-단위 park 할지 결정 D4.

## ⛔ 착수 차단 — consistency-check --plan BLOCK: YES (2026-06-05, `review/consistency/2026/06/05/08_04_44`)
병렬 active worktree 와의 코어 충돌로 **착수 전 직렬화 합의 필수**. (C2/W4 stale-worktree 오탐은 `fix/exec-engine-park-worker-job-release` 정리로 해소.)
- **C1 (진짜) — D5 로 승격**: `impl-exec-intake-queue` **PR3** 가 "rehydration 을 ai_agent 너머 일반 노드로 확장 + 멱등 재개(jobId·status 재검증·완료노드 미재실행)"를 이미 소유(`exec-intake-queue-impl.md` L44). 본 plan A2/B2 와 동일 표면(`rehydrateContext`/`rehydrateAndResume`, §7.5). **중복·분기 불가** → 소유권·머지 순서 합의 필요.
- **W6 (3-way)**: `node-cancellation-infrastructure.md §2`(branch `claude/node-cancellation-engine-6bfcaa`)도 재개/dispatch 경로 공유. PR3 자신도 cancellation 과 직렬화 순서 미확정.

## 미해결 결정 (사용자/planner)
- **D1 (확정 제안)**: conversationThread 영속 = **`Execution.conversation_thread jsonb`** (spec 예고 컬럼 §4 L211/§9.11 L284 채택). → 사용자 승인 시 확정.
- **D2**: user-defined variables 복원을 본 plan 범위에 포함할지, 별도 plan 분리할지.
- **D3**: park 중 워크플로 정의 편집 시 재개 정책(현행 node.config 재유도 의미 유지 여부).
- **D4**: 멀티턴 AI 를 turn-단위 park(매 turn 해제) vs 대화-단위 세그먼트(종료까지 유지) — 메모리 vs rehydration 비용 트레이드오프.
- **D5 (BLOCK 해소 핵심)**: exec-intake-queue PR3 와의 관계 — (a) PR3 를 "rehydration 일반화 소유" 로 두고 본 plan(A2/B2)은 그 인프라를 **소비/전제**(PR3 선행 머지), (b) 본 plan 이 rehydration 일반화를 흡수하고 PR3 는 큐 인프라만, (c) 단일 worktree 통합. + node-cancellation 직렬화 순서.

## 진행 메모
- 2026-06-05 착수. #468 머지 확인(main `9f30216f`). durability 맵 조사 완료(본 plan "현행 durability 맵").
