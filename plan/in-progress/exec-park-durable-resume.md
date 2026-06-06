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

### A1. conversationThread 영속 + rehydration 복원 — ✅ 완료 (PR #470, 2026-06-05, main `57d366b6`)
- [x] **영속 매체 = `Execution.conversation_thread jsonb`** — 마이그레이션 **V084**(#469 와 V083 충돌→rebase-renumber).
- [x] park 직전(각 `waitForX`) `stageConversationThreadSnapshot` 로 `context.conversationThread` 스냅샷을 `updateExecutionStatus` 트랜잭션과 **원자 commit**.
- [x] `rehydrateContext` 가 컬럼에서 `rehydrateConversationThread`(eviction-aware nextSeq·totalChars 재계산·turn sanitize·runningSummary cap) 로 무손실 복원 — createContext `conversationThread` 옵션 경유.
- [x] spec 동기 갱신: conversation-thread §4/§7/§8.4, 4-execution-engine §6.2/§7.5/§4.x, 1-ai-agent §12.1/§12.10/§12.13, 1-data-model §2.13.
- [x] 테스트: rehydrateContext 무손실 복원·NULL 회귀·park 스냅샷 + 정규화 단위(19) — 764 모듈 테스트·e2e 168 통과. consistency --impl-prep/--impl-done BLOCK:NO, ai-review LOW.

### A2 범위 분리 (2026-06-05, 사용자 결정)
조사 결과 A2 가 두 갈래(① checkpoint 견고화 self-contained, ② information_extractor 확장 — IE 고유 state·builder 일반화·spec 3곳 필요)로 갈리고 후자가 큼. **A2a(견고화)만 본 차수로 진행, A2b(IE)는 분리.**

### A2a. _resumeCheckpoint 견고화 — ✅ 완료 (PR-A2a, commit 7c32712f, 2026-06-05)
- [x] checkpoint 에 **버전 필드**(`CHECKPOINT_SCHEMA_VERSION`) 추가 — `buildResumeCheckpoint` 가 stamp, 재구성 시 검사. 버전 부재(구 row)=legacy 허용, 미래 버전(코드 미지원)=graceful `RESUME_INCOMPATIBLE_STATE`.
- [x] `buildRetryReentryState` 재구성 시 누락/비정상 checkpoint 필드 **기본값 보강** — 부분 손상이 크래시 대신 graceful 경계로.
- [x] schema drift(node.config 변경: `maxTurns`/`llmConfigId` 등 context-binding 필드) → `RESUME_INCOMPATIBLE_STATE` 경계 점검·문서화(현 catch L1816-1823 유지·강화).
- [x] spec: §7.5 `RESUME_INCOMPATIBLE_STATE` 케이스에 "checkpoint 버전 불일치" 추가(필요 시), §1.3 checkpoint 서술 보강.
- 테스트: 구(舊)/버전없는 checkpoint → 재개 성공, 미래 버전·손상 → 명확한 graceful 종료.

### A2b. information_extractor 멀티턴 checkpoint 확장 — ✅ 완료 (branch `claude/exec-park-a2b-infoextractor`, 2026-06-05)
- [x] `buildResumeCheckpoint` allow-list 합집합화 — IE 고유 runtime state `partialResult`/`collectionRetryCount` 추가(credential-free). `buildRetryReentryState` 가 IE config(`outputSchema`/`examples`/`instructions`/`maxCollectionRetries`)를 generic `resolveRetryNodeConfig` 로 재유도. (별도 IE builder 불요 — 아키텍처가 이미 합집합/polymorphic 지원)
- [x] 가드 3곳 확장(`ai_agent` → `ai_agent || information_extractor`): emitAiWaitingForInput·handleAiMessageTurn·driveResumeDetached 재진입. (IE 핸들러는 이미 `processMultiTurnMessage`/`endMultiTurnConversation` 보유 → 구조적 `isResumableNodeHandler` 가드 통과, 클래스 선언 변경 불요)
- [x] spec "ai_agent 한정" 3곳(`4-execution-engine §1.3`·`3-information-extractor L357`·`1-ai-agent L703`) → IE 지원 전환 + §Rationale L1166 번복 근거(점진 확장 — polymorphic dispatch·generic config 재유도·credential-free 소형 state) 기록. frontmatter pending_plans 등록.
- [x] 테스트: buildResumeCheckpoint IE 필드(2) + buildRetryReentryState IE config 재유도(2) + IE 재구성 통합(1). 789 모듈 회귀 green, build·lint OK.

### A3. user-defined variables 영속 + 복원 — ✅ 완료 (branch `claude/exec-park-a3-variables`, 2026-06-05)
> **조사 결론**: 복원 **필요**(실 data-flow: Variable Declaration→루프 modify→park 후 downstream 표현식 `$var.X` 읽음). **SMALL** — flat Record, coerce-type 가 JSON-serializable 보장, 컨테이너 스코프 격리 없음. → D2=포함.
- [x] 마이그레이션 **V085** `Execution.user_variables jsonb NULL`.
- [x] 헬퍼 `stageConversationThreadSnapshot` → **`stageDurableResumeSnapshot`** 확장: park 직전 thread + `context.variables` 중 `__*` 제외 사용자분을 `updateExecutionStatus` 트랜잭션과 원자 commit. (3 park 지점 rename)
- [x] `rehydrateContext` 가 **`rehydrateUserVariables`**(비객체→{}, 방어적 `__*` 제외)로 복원해 initialVariables 에 머지(user vars 먼저 spread → 시스템 `__*` override 충돌 방어).
- [x] spec: `4-execution-engine §6.1/§6.2/§7.5`, `1-data-model §2.13`.
- [x] 테스트: rehydrateContext variables 복원·NULL 회귀 + stage(__* 제외)·normalizer 단위. 829 모듈 회귀 green, build·lint·migration-guard OK.
> **consistency --impl-prep C1(BLOCK)**: `impl-concurrency-cap-pr2b`(docs-only 커밋, A1 머지 57d366b6 미포함=구 main stale)가 A1/A2b 를 "역행"한다는 발견 — **stale-baseline 거짓 양성**(git 반증: 해당 브랜치는 코드·마이그레이션 미착수, rebase 안 한 상태일 뿐). A3 변경은 현행 main 정합. PR2b 실착수 시 V086+ renumber 조율(현재 V085 자유).

---

## Phase B — park 즉시 해제 + slow-path 일원화 [A 완료 후]

> **PR 분할 (확정 2026-06-05, 사용자 결정)**: Phase B 를 **2개 PR** 로 분할한다(Phase A 4분할 선례·위험 격리). "B1·B2 분리 불가"(코루틴 해제⟺slow-path) 는 **park-site 단위로 유지** — 각 PR 이 자기 site 의 release+slow-path 를 함께 한다.
> - **PR-B1 (form/button)**: `waitForFormSubmission`/`waitForButtonInteraction` 단발 상호작용을 park-release+rehydration 으로. form/button 은 `pendingContinuations` 에 더 이상 등록 안 함 → `applyContinuation` 의 fast-path 가지(`pendingContinuations.has`)를 자연스럽게 miss 해 항상 slow-path. **AI 멀티턴 루프는 PR-B1 에서 미변경**(in-memory 유지) — 그 fast-path 만 잠정 잔존. dockerized e2e(park→worker kill→무손실 재개) 포함.
> - **PR-B2 (multi-turn AI)**: `runAiConversationLoop` 장수 루프 → turn-단위 park(D4, 매 turn 해제 + per-turn durable checkpoint). AI 도 `pendingContinuations` 등록 제거 → fast-path 가지·`pendingContinuations` Map·`firstSegmentBarriers`/`armFirstSegmentBarrier`/`settleFirstSegment`/`signalParkBarrier`/`firePayload` scheduler 완전 제거(B3). e2e(멀티턴 park→kill→재개) 포함.

### B1. park 시 coroutine 반환(해제) — 멀티턴 turn-단위(D4)
- [x] **(PR-B1, commit 20836914)** `waitForFormSubmission`/`waitForButtonInteraction` 의 `await new Promise()` 대기 제거 — durable 영속 후 **즉시 반환**(PARK_RELEASED)해 `runExecution`/resume·retry 드라이브 세그먼트 종료. dockerized e2e(form park→cold rehydration→무손실 completed) 통과.
- [x] **(PR-B2a #494)** 멀티턴 AI = turn-단위 park(D4): top-level `runAiConversationLoop` 해제 → `processAiResumeTurn`. **(PR-B2b `2dbb31b6`)** 중첩 포함 `runAiConversationLoop` 완전 제거.
- [x] **(PR-B2b `2dbb31b6`)** `runExecutionFromQueue` detached coroutine + `firstSegmentBarriers` 제거 → `await runExecution` 직접(park=세그먼트 종료라 슬롯 점유 없음).

### B2. 재개 = 항상 rehydration
- [x] **(PR-B1, form/button)** fresh top-level park 가 `pendingContinuations` 미등록 → `applyContinuation` fast-path miss → 항상 `rehydrateAndResume`(slow-path). 멀티턴 AI 는 PR-B2 까지 fast-path 잔존.
- [x] **(PR-B1, form/button)** 모든 form/button 재개가 `execution-continuation` job → `rehydrateAndResume` 로 일원화.
- [x] **(PR-B1)** cancellation gap 수정: `applyCancellation` async + `cancelParkedExecution` — park-release 로 코루틴 없는 WAITING 행 직접 CANCELLED 마감. 불변식(동일 turn 이중 실행 0 = WAITING status 가드, 멱등 = affected 가드) 유지.

### B3. 정리(제거)
- [x] **(PR-B2b `2dbb31b6`)** `pendingContinuations` Map·`firstSegmentBarriers`/`armFirstSegmentBarrier`/`settleFirstSegment`/`signalParkBarrier`/`resolvePending`/`rejectPending`/`firePayload`/`fireNested`/`NESTED_FIRE_*` 완전 제거.
- [x] **(PR-B2b `2dbb31b6`)** #468 의 W1/W2 방어 로직(detach/barrier) 중 해제로 불필요해진 부분 정리 — worker `await` 직접 전환으로 흡수.

### PR-B2 구현 설계 (2026-06-06, 코드 정밀조사 기반 — branch `claude/exec-park-pr-b2`)
> 대상: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (8897줄). 무손실 전제 충족 확인 — `handleAiMessageTurn` waiting 분기(L5523-5542)가 **이미 매 turn `_resumeCheckpoint` 를 nodeExec 에 영속**. 단 thread/variables 스냅샷(`stageDurableResumeSnapshot`)은 첫 turn(`emitAiWaitingForInput` L5288)에서만 호출 → **PR-B2 핵심 델타 = 후속 turn park 에도 thread/variables 스냅샷 + WAITING 전이 추가**.
>
> **핵심 통찰 — B3 는 B2 가 enable**: worker(`runExecutionFromQueue` L~2603)가 `runExecution` 을 detached + `firstSegmentBarriers`(arm→await settled)로 띄우는 **유일한 이유는 AI 멀티턴 in-memory 루프**(park 에서 `runExecution` 미반환). AI 도 turn-park 하면 `runExecution` 이 park 에서 반환 → worker 는 `await runExecution()` 만으로 job 반환 가능 → barrier/detached/`firePayload`/`pendingContinuations` 전부 불필요.
>
> **payload 전달 경로 단순화**: 기존 = continuation `payload` → `firePayload` polling → `resolvePending` → 루프 내 await Promise. 신규 = `applyContinuation(payload)` → `rehydrateAndResume(payload)` → resume drive 가 payload 를 **함수 인자로** 단발 turn 처리기에 직접 전달 (Map 우회 불요).
>
> 변경 단위:
> 1. **AI 단발 turn 처리기 신설**: `runAiConversationLoop` 의 while 루프를 제거하고, 도착한 단일 action 을 처리하는 경로로 대체. dispatch(end/message/form) → `handleAiMessageTurn`/`handleAiEndConversation` 재사용. (a) `conversationEnded` → `finalizeAiNode` → 그래프 전진(not parked). (b) 계속 → re-park: `stageDurableResumeSnapshot` + `updateExecutionStatus(WAITING_FOR_INPUT, nodeExec)` (turn resume 은 RUNNING→WAITING 정상 전이) → 반환(release).
> 2. **첫 turn 진입**(`waitForAiConversation`, dispatch site `runNodeDispatchLoop` AI 분기 L~1690): `emitAiWaitingForInput`(park) 후 **루프 없이 PARK_RELEASED 반환** → `runNodeDispatchLoop` 가 `{parked:true}` 로 세그먼트 종료. (form/button 과 동일 패턴)
> 3. **resume 경로**(`driveResumeDetached` AI 분기 L1977-2000): `_resumeCheckpoint`→`buildRetryReentryState`(resumeMode) 로 resumeState 재구성(기존 유지) 후 **도착 payload 로 단발 turn 처리기 호출** → park/finalize.
> 4. **retry 경로**(`applyRetryLastTurn`, `runAiConversationLoop(initialAction)` 사용): 단발 turn 처리기의 replay 분기(외부 대기 없이 즉시 처리)로 이관. cancel race 보존.
> 5. **worker-return 단순화**: `runExecutionFromQueue` — `armFirstSegmentBarrier`/`await settled`/detached 제거 → `await runExecution()` 직접. `resumeFromCheckpoint`/`driveResumeDetached` 도 detached 제거 → await.
> 6. **B3 제거**: `pendingContinuations` Map·`applyContinuation` fast-path(L1022/L1045)·`resolvePending`/`rejectPending`·`firstSegmentBarriers`·`armFirstSegmentBarrier`/`settleFirstSegment`/`signalParkBarrier`·`firePayload` scheduler(L1843-1859). `applyCancellation` → 항상 `cancelParkedExecution`(rejectPending 분기 제거).
> 7. **spec 재전환(별 commit)**: PR-B1 정직화로 "PR-B2 미적용" 표기한 §4.x banner·§7.4 L829 를 **완료형으로 재전환**(멀티턴 AI 도 turn-park·fast-path 제거 완료). §Rationale L1257 "단계적 롤아웃" note 는 "B1·B2 모두 완료"로 갱신. ← project-planner 위임.
> 8. **★중첩 call stack durable 영속 (D6, full B3 의 전제)**: 변경 5/6(worker-return 단순화·full B3 제거)이 **안전하려면 중첩 sub-workflow blocking 도 durable** 이어야 한다(아니면 detached/pending 제거 시 중첩 재개 회귀). 작업:
>   - (a) **신규 컬럼** `Execution.resume_call_stack jsonb NULL`(V086+, agent_memory V086 와 충돌 시 renumber) — park 시 executeInline 호출 체인 `[{workflowId, invokerNodeId, recursionDepth}]`(outermost→waiting) 영속. schemaVersion 포함.
>   - (b) **park 시 stage**: `stageDurableResumeSnapshot` 확장 또는 신규 — 중첩 깊이>0 일 때 call stack 도 Execution 행에 실어 상태전이 트랜잭션과 원자 commit.
>   - (c) **rehydration 재귀 재진입**: `driveResumeDetached`/`resumeFromCheckpoint` 가 call stack 을 읽어 top-level→sub-workflow 체인을 **재귀적으로 재진입**(executeInline 재호출), 각 프레임 executedNodes 를 DB(execution_node_log)에서 seed 해 완료 노드 skip, waiting inner 노드 도달 후 payload 전달. 프레임별 변수 스코프(`$parent`)·sub-workflow input 재seed.
>   - (d) **executeInline blocking 도 park-release**: L2924/2931/2942 의 `'await'` → `'release'` 전환(form/button/AI 모두), 단발 turn 처리는 AI 와 동일.
>   - (e) 중첩 cancel: `cancelParkedExecution` 가 중첩 inner WAITING NodeExecution 도 동일 처리(executionId 키라 자동).
>   - 제약: 컨테이너 body blocking 은 spec §3.2 로 금지 유지(영속 불요). 깊이 한도 = 기존 recursionDepth cap.
>
> 테스트: 단발 turn 처리기 단위테스트(park/end/fail/replay/cancel-race), `pendingContinuations` 부재 후 applyContinuation 항상 slow-path, AI turn cancel(WAITING→CANCELLED), rehydrate 반복 turn thread 누적 무결성, **중첩 call stack stage/rehydrate round-trip**(2-depth). **dockerized e2e**: 멀티턴 3턴 중 turn-2 park→worker kill→turn-2 재개 무손실; turn 중 cancel; **중첩 sub-workflow blocking park→worker kill→재개 무손실**(D6 회귀 게이트).
>
> **시퀀싱(사용자 결정 2026-06-06 "정공법")**: 단일 PR-B2 로 1~8 통합. 단계 내부 순서 = 8(a~c durable 인프라) 먼저 → 그 위에 1~6(turn-park + B3 제거) → 7(spec 재전환). 8 이 선행돼야 5/6 제거가 회귀 없이 성립.

---

## Spec 변경 (project-planner)
- `4-execution-engine.md §4.x`(실제 heading "waiting_for_input park"): "park 즉시 해제 + slow-path 일원화" 로 구현 모델 갱신(현 §4.x 구현 메모 대체), fast-path 제거 반영.
- `4-execution-engine.md §7.4`: Worker 동작 행의 "로컬 pendingMap 즉시 resolve(fast-path)" 서술 정정(제거/강등). (consistency W5/I2 — 누락분 추가)
- `4-execution-engine.md §7.5`: rehydration 이 conversationThread·variables 를 복원함을 명시(무손실 보장) + case 1(fast-path) 문구 동반 정정.
- `4-execution-engine.md §6.2` + `conventions/conversation-thread.md §4/§7/§8`(세 앵커): "신규 DB 컬럼 없음" → `Execution.conversation_thread` 채택으로 **한 PR 동기 갱신**, Rationale 기록. **[A1 완료 2026-06-05]** + `1-ai-agent.md §12.1/§12.10/§12.13` reconcile + **`1-data-model.md §2.13 Execution` 컬럼 행**(consistency W1) 동기 갱신 완료.
- **[Phase B 선행 — 완료 2026-06-05]** spec 모델 개정: `4-execution-engine.md` §1.1 전이표·§4.x banner 2개(park=세그먼트 종료, slow-path 일원화)·§6.2 rawConfig(D3 fresh-per-turn)·§7.4 Worker 동작+diagram·§7.5 case diagram·**§Rationale 신규 "park 즉시 해제 + slow-path 일원화 (Phase B)"** (D4 turn-park·D3 fresh-config·B1/B2 결합·worker-side fast-path 제거 근거). consistency W1~W4 해소.
- A2 채택 시 "ai_agent 한정" 문구 3곳(`4-execution-engine.md §1.3 L111`·`3-information-extractor.md §357`·`1-ai-agent.md §703`) 동기 갱신. (consistency I1/I4)
- **[W1 정합화 — 완료 2026-06-06]** D3 turn-scope 전파(consistency `01_19_37` W1/W2): `4-execution-engine.md §6.3` 표 "Multi-turn resume" 행에 "frozen 범위 = 한 turn(D3) — §6.1/§Rationale" cross-ref 추가, `13-replay-rerun.md §14.3` 에 D3 fresh-config-per-turn 단서 + §6.1 링크 추가. 더불어 `§4.x` banner 2개(park=세그먼트 종료·slow-path 일원화)를 **단계 롤아웃 정직화**(PR-B1 form/button 완료 / PR-B2 멀티턴 AI 미적용·fast-path 잠정 잔존) — 본문이 PR-B2 를 완료형 over-claim 하던 drift 제거.
- frontmatter `pending_plans:` 에 본 plan 등록 (`conversation-thread.md`·`4-execution-engine.md`·**`1-data-model.md`**). **[A1 완료]**
- consistency-check `--spec`/`--impl-prep` 의무, `--plan`(본 plan) 점검. **[--impl-prep BLOCK:NO 2026-06-05 `review/consistency/2026/06/05/09_01_23`]**

## 권장 PR 분해 (시퀀싱)
1. **PR-A1**: conversationThread durable 영속 + rehydration 복원 (+spec §7.5, conversation-thread.md).
2. **PR-A2**: checkpoint 견고화 + information_extractor 확장.
3. **PR-A3**(범위 시): user variables 영속 — 또는 별도 plan.
4. **PR-B1**: form/button park-release + slow-path 일원화 (+spec staged note). e2e 회귀(park→worker kill→무손실 재개) 필수.
5. **PR-B2** → **재분할 (2026-06-06, 사용자 승인)**: 중첩 D6(call-stack durable) 흡수로 PR-B2 가 비대·고위험화 → 2분할.
   - **PR-B2a (top-level 멀티턴 AI turn-park)** — `runAiConversationLoop` 장수 루프를 top-level AI 에서 해제(`processAiResumeTurn` 단발 처리 + re-park). 유저 #1 우려(top-level 응답 없는 대화 bounded-memory) 해소. **in-memory 머신(pendingContinuations/barriers/firePayload)은 nested/form-button resume 용으로 잠정 유지(partial B3)** = 현 main 과 동일 동작이라 회귀 아님. **진행: 구현 완료 + nest build 통과(commit, branch claude/exec-park-pr-b2). 남음: 실패 20 테스트 turn-park 모델 재작성 → dockerized e2e(top-level 멀티턴 park→kill→재개) → /ai-review + --impl-done → 머지.**
   - **PR-B2b (중첩 call-stack D6 + full B3)** — 중첩 sub-workflow blocking durable(resume_call_stack stage + `driveResumeDetached` 재귀 executeInline 재진입 + executeInline park-release) → in-memory 머신 완전 제거(pendingContinuations/firstSegmentBarriers/armFirstSegmentBarrier/settleFirstSegment/signalParkBarrier/firePayload/detached) + §4.x 완료형 flip. 최고 난이도라 독립 PR 로 집중 리뷰. e2e(중첩 park→kill→재개) 필수. (V087 컬럼·타입·spec D6 "구현 예정" 표식은 기반 슬라이스로 이미 랜딩.)

> 각 PR 은 SDD+TDD, TEST/REVIEW WORKFLOW 이행. PR-B1/B2 는 실행엔진 코어라 e2e(dockerized) 무손실 재개 시나리오를 반드시 포함. (구 단일 "PR-B" 는 2026-06-05 사용자 결정으로 B1/B2 2분할.)

## 리스크
- **A1 conversationThread 직렬화**: turns 는 frozen·JSON 가능하나 크기(대화 길이) 고려 — 컬럼 vs 테이블 선택이 성능에 영향.
- **A2 멀티턴 직렬화**: `_resumeState` 의 비직렬화 요소(핸들러 ref·closure)는 이미 checkpoint allow-list 로 배제됨 — 재구성이 node.config 안정성에 의존. 워크플로 정의가 park 중 변경되면(편집) 재구성 의미 모호 → 결정 D3.
- **B 전환**: 매 재개가 rehydration 비용 — 재개는 사람-페이스라 수용 가능하나, 고빈도 멀티턴(자율 루프)에서 turn 마다 rehydration 시 비용 누적 가능 → B2 에서 멀티턴은 "한 세그먼트 = 대화 종료까지" 유지할지 turn-단위 park 할지 결정 D4.

## 통합 결정 (consistency-check --plan BLOCK: YES → 해소, 2026-06-05, `review/consistency/2026/06/05/08_04_44`)
병렬 active worktree 코어 충돌(C1/W6)을 **단일 worktree 통합**(D5, 사용자 결정)으로 해소한다. C2/W4 stale-worktree 오탐은 `fix/exec-engine-park-worker-job-release` 정리로 해소.
- **본 plan 이 통합 umbrella**: 아래를 본 worktree(`exec-park-durable-resume`)로 흡수해 직렬 진행한다 —
  - `impl-exec-intake-queue` **PR3**(rehydration 을 ai_agent 너머 일반 노드로 확장 + 멱등 재개: jobId·`NodeExecution.status` 재검증·완료노드 미재실행) → 본 plan **Phase 0/A2** 로 흡수.
  - `node-cancellation-infrastructure.md §2`(재개/dispatch 경로 공유) → 직렬화 순서 본 plan **Phase 0** 에서 확정.
- 출처 plan 상호 cross-link + 해당 항목 "→ exec-park-durable-resume 로 이관" 표기 (planner). exec-intake-queue 의 PR2(concurrency cap)/PR4(priority)는 통합 범위 외 — 그대로 유지.

## Phase 0 — 통합 baseline [A2/B 의 선행, **A1 은 제외**]
> **조사 결과(2026-06-05)**: exec-intake-queue PR3 는 **미구현**(branch `claude/impl-exec-intake-queue` 최신이 docs 커밋 `01bca178`). 흡수할 코드가 없으므로 PR3 의 "rehydration 일반화 + 멱등 재개" 는 본 plan 이 **Phase A2/B2 에서 직접 구현**한다. fix/exec-engine-park-worker-job-release 는 #468(`9f30216f`)로 main 랜딩 → C2/W4 해소, 본 worktree 가 그 위.
> **A1 은 Phase 0 와 독립**(consistency W6 해소): A1(conversationThread durable 영속+복원)은 `rehydrateContext` 의 thread-복원 추가 + 신규 컬럼 + park 스냅샷으로 자기완결이며, PR3 의 rehydration 일반화(비-ai 노드 확장·멱등 jobId 재검증)와 표면이 겹치지 않는다. A1 선착수 가능.
- [ ] (A2/B2 착수 전) PR3 의 rehydration 일반화(ai_agent → 일반 노드) + 멱등 재개를 본 plan A2/B2 로 직접 구현.
- [x] (A2/B 착수 전) node-cancellation §2(`NodeExecution.status='cancelled'` enum·재개 경로)와의 직렬화 순서·status 가드 겹침 **확정(2026-06-06)**: 직렬화 순서 = 본 umbrella 의 **B3(PR-B2 dispatch-path 정리)가 선행**, node-cancellation §2(별도 worktree·미착수)는 그 결과 위로 rebase. status 가드는 PR-B1 의 `cancelParkedExecution`(WAITING NodeExecution → `cancelled` 직접 마킹, §7.4)으로 이미 확보 — B3 의 코루틴 제거가 이 DB-level terminal 가드를 침해하지 않음을 PR-B2 e2e 로 회귀 보증.
- [x] 출처 plan 이관 표기 + cross-link **완료(2026-06-06)**: `exec-intake-queue-impl.md` PR3·`node-cancellation-infrastructure.md §2` 에 "→ exec-park-durable-resume 로 이관(직접 구현)" 표기 추가. (exec-intake-queue PR3 는 L139 조사대로 미구현이라 본 plan A2/B2 가 직접 구현)

## 미해결 결정 (사용자/planner)
- **D1 (확정 2026-06-05)**: conversationThread 영속 = **`Execution.conversation_thread jsonb`** (spec 예고 컬럼 §4 L211/§7 L284 채택). 사용자 handoff 승인. spec 동기 갱신 완료(conversation-thread §4/§7/§8.4, 4-execution-engine §6.2/§7.5, 1-ai-agent §12.1/§12.10/§12.13, **1-data-model §2.13 Execution 컬럼 행** — consistency W1 해소). 마이그레이션 = **V084**(#469 PR2a 가 V083 선점 → §6.2 rebase-renumber 로 V083→V084 재부여, 2026-06-05).
- **D2 (확정 2026-06-05)**: user-defined variables 복원 = **본 plan 포함**(PR-A3). 조사 결과 복원 필요·SMALL scope(A1 패턴 재사용)라 분리 불요. 마이그레이션 V085 `Execution.user_variables jsonb`.
- **D3 (확정 2026-06-05)**: park 중 워크플로 편집 시 재개 = **Fresh-per-turn 수용**(사용자 결정). Phase B 의 매-turn rehydration 이 `node.config` 를 fresh 재유도하므로 park 중 편집이 다음 turn 부터 반영된다 — 현행 frozen-per-conversation(첫 turn rawConfig 고정) 대비 변경. checkpoint 에 rawConfig 영속 불요(구현 단순). spec §6.2 frozen-rawConfig 노트·§Rationale 갱신 필요(Phase B). replay reproducibility 약화는 수용.
- **(설계 발견 2026-06-05)**: **B1·B2 분리 불가** — 코루틴 진짜 해제(bounded 메모리)는 park 시 `await` 제거(runExecution 반환)를 요구하고, 그러면 in-memory resolve 가 사라져 **모든 재개가 rehydration(slow-path)**. 따라서 Phase B 코어 = B1+B2 한 덩어리(release+slow-path 일원화) + B3(barrier·pendingContinuations 정리). dockerized e2e "park→worker kill→무손실 재개" 필수.
- **D4 (확정 2026-06-05)**: 멀티턴 AI = **turn-단위 park(매 turn 해제)** — 메모리 일관성 우선(B1 반영).
- **D5 (확정 2026-06-05)**: **단일 worktree 통합** — 본 plan 이 exec-intake-queue PR3(rehydration)+node-cancellation §2 를 흡수해 직렬 진행(Phase 0). BLOCK 해소.
- **D6 (확정 2026-06-06, 사용자 결정 "call stack 영속화 정공법")**: 중첩 sub-workflow(executeInline) blocking 도 **durable 영속 + rehydration 재개**로 일원화한다 — in-memory 의존 완전 제거 → **full B3 달성**. 근거 재검토:
  - 컨테이너(Loop/ForEach/Map/Parallel) body 는 blocking **금지**(spec §3.2) → 남는 중첩은 sub-workflow 호출 체인뿐 = **선형 call stack**(iteration/branch 상태 영속 불요).
  - 노드 출력은 이미 같은 executionId 타임라인으로 DB 영속, thread/variables 는 Phase A(V084/V085) 영속 → **빠진 건 call stack 구조뿐**. 신규 `Execution.resume_call_stack jsonb`(가칭, V086+) 로 영속.
  - spec §Rationale L1303 이 기각한 건 *per-node 분산*(모든 노드 handoff)이지, **park 재개의 중첩 확장**("waiting 후 재개")이 아님 — 같은 범주라 tractable(엔진 재작성급 아님).
  - 현재 중첩 blocking 은 `driveResumeDetached` 가 executeInline 스택 미재진입이라 **재시작 후 재개 불가(latent gap)** — D6 가 이 gap 도 동반 수정.

## 진행 메모

### PR-B2b 착수 (2026-06-06, branch `claude/exec-park-b2b-04a2f8`, base origin/main `f5a16bb7`)
- 선행 확인: PR-B2a(#494) main 머지 완료(`8538ed8a`) — V087 `resume_call_stack` 컬럼·`ResumeCallStack`/`CALL_STACK_SCHEMA_VERSION` 타입·top-level turn-park(`processAiResumeTurn`/`reparkAiResumeTurn`) 랜딩됨. fresh worktree(origin/main).
- **consistency-check --impl-prep BLOCK:NO** (`review/consistency/2026/06/06/12_28_50`) — 5 checker 모두 LOW, Critical 0. WARNING 4건(W1 spec §4.x PR-B2a 표기=머지로 자동해소·B2b flip 에서 완료형; W2 cross-worktree rebase=타 worktree 책임; W3 D6 레이블 namespace=spec flip 시 검토; W4 frontmatter build guard=spec flip 후 확인).

#### PR-B2b 구현 설계 (코드 정밀조사 확정, 2026-06-06)
**전파 메커니즘 — `ParkReleaseSignal` throw (중첩 한정).** top-level 은 기존 `PARK_RELEASED` 심볼 return 유지(PR-B1/B2a 무변경). 중첩 `executeInline` blocking 노드가 release park → `waitForX('release')` 가 PARK_RELEASED 반환 → executeInline 이 `throw new ParkReleaseSignal()` 로 deep call stack unwind(ExecutionCancelledError 전파 패턴 동형). unwind 경로 처리: workflow.handler catch 에서 error 포트 라우팅 전 re-throw; executeNode catch(L7064) isAbortError 다음 re-throw; runExecution 메인 catch(L3534) 맨 앞 `return`; runNodeDispatchLoop executeNode throw 시 `{parked:true}`. 정의=`src/shared/execution-resume/park-release-signal.ts`(handler·engine 공유 import).

**call-stack 추적·영속.** `ExecutionContext._callStack?: ResumeCallStackFrame[]`. executeInline 진입(recursionDepth>0) push `{workflowId, invokerNodeId, recursionDepth}`, finally pop. `stageDurableResumeSnapshot` 확장: `execution.resumeCallStack = _callStack?.length ? {version, frames} : null`(top-level=NULL). invokerNodeId = 부모 그래프의 Workflow Node id → `InlineExecutionOptions.invokerNodeId` 신설, workflow.handler 가 `context.nodeId` 전달.

**중첩 재개 — frame-by-frame pointer 기반.** `resumeFromCheckpoint` 에서 `resumeCallStack` non-null → 신규 `driveCallStackResume`(기존 top-level 분기는 stack NULL). executed-skip 아닌 pointer 기반(back-edge 보존, L3275). (1) 최내 frame: waiting node turn 처리(AI=processAiResumeTurn, form/button=직접 payload) → 계속이면 parked, 종료면 runNodeDispatchLoop(waitingPointer+1) forward → frame lastOutput. (2) 외곽 frame: invoker 출력 `{result:innerOutput}` 주입+executedNodes.add → runNodeDispatchLoop(invokerPointer+1) forward. (3) top-level: 동일 후 COMPLETED(중간 재park=parked return, 새 call-stack 재영속). 각 frame 새 fresh sub-call park → ParkReleaseSignal → parked 전파.

**full B3 제거(중첩 durable 성립 후).** executeInline 3분기 'await'→throw. `runAiConversationLoop`/`signalParkBarrier`/`firstSegmentBarriers`/`armFirstSegmentBarrier`/`settleFirstSegment`/`firePayload`/`pendingContinuations`/`resolvePending`/`rejectPending` 제거. detached→await(runExecutionFromQueue/resumeFromCheckpoint/driveResumeDetached). applyContinuation 항상 rehydrate. applyCancellation 항상 cancelParkedExecution. applyRetryLastTurn replay→processAiResumeTurn 이관.

#### PR-B2b 진행 상태 (2026-06-06)
- [x] **8a 영속 stage**: `stageDurableResumeSnapshot` 확장 — `snapshotCallStack(context)` 가 `context._callStack` 을 `Execution.resume_call_stack`(V087, version envelope)로 직렬화. top-level(빈 stack)=NULL 명시 재설정. (unit 2건 green)
- [x] **8a call-stack 추적**: `ExecutionContext._callStack` 필드 + `executeInline` push(recursionDepth>0, finally pop). `InlineExecutionOptions.invokerNodeId` 신설, `WorkflowHandler` 가 `context.nodeId` 전달.
- [x] **8d executeInline park-release**: form/button/AI 3분기 `waitForX('release')` → PARK_RELEASED 시 `ParkReleaseSignal` throw. 전파: workflow.handler·executeNode·runExecution catch(return)·runNodeDispatchLoop({parked:true}).
- [x] **8c 중첩 재개**: `driveCallStackResume`+`driveResumeFrame`(frame-by-frame pointer 기반)+`injectInvokerOutput`. `resumeFromCheckpoint` 가 `resumeCallStack` non-null 시 분기(스키마 버전 가드; form/button=firePayload, AI=processAiResumeTurn). innermost turn 은 기존 waitForX('await')/processAiResumeTurn 재사용(B3 전이라 in-memory 머신 존속).
- [x] **검증 (step 8)**: nest build OK, eslint clean, execution-engine unit **304+pass**, workflow.handler 42 pass. dockerized e2e **175 pass**(기존 suite 무회귀). commit `b0764ef9`.
- [x] **REVIEW WORKFLOW (step 8)**: `/ai-review`(`review/code/2026/06/06/13_05_02`, HIGH — Critical 2=신규 resume 로직 단위테스트 공백/11 Warning) → `resolution-applier` 처리(fix commit `e8aaeaa7`: driveCallStackResume/driveResumeFrame/resumeFromCheckpoint 분기·버전가드 단위테스트 신설 + frames.length 가드·에러경로 방어 + WorkflowHandler/executeInline/park-release spec; 아키텍처 추출 4건 B3 로 deferred) → e2e 재통과 → RESOLUTION.md(`dfc8aecd`). `--impl-done` **BLOCK:NO**(`review/consistency/2026/06/06/13_43_53`, MEDIUM, W1~W4 모두 아래 spec flip 로 귀속).
- [x] **full B3 제거 완료** (commit `2dbb31b6`): 직접 처리기 `processForm/ButtonResumeTurn` 추출, waitForX 3종 park-only, `pendingContinuations`·`firstSegmentBarriers`·`armFirstSegmentBarrier`·`settleFirstSegment`·`signalParkBarrier`·`resolvePending`·`rejectPending`·`runAiConversationLoop`·`firePayload`/`fireNested`·`NESTED_FIRE_*` 제거, detached→await(runExecutionFromQueue/resumeFromCheckpoint), applyContinuation 항상 rehydrate·applyCancellation 항상 cancelParkedExecution, applyRetryLastTurn→processAiResumeTurn(retryReentry) 이관, background body park→ParkReleaseSignal graceful, processForm/Button RUNNING 가드. **단위 테스트 40개 신모델 재작성(execution-engine 679 pass)** + B3 ai-review 의 추가 단위테스트(W1/W3/W5)·예외전파 가드(W7)·stale 주석(W10) (commit `a053630f`). 아키텍처 추출(W11/W12: ProcessTurnResult 타입·updateExecutionStatus 멱등 가드)은 deferred(저위험, RESOLUTION 기록).
- [x] **dockerized e2e 완료** (commit `247f5cb5`): 중첩 sub-workflow form park→cold rehydration(`driveCallStackResume`) 무손실 재개 + `resume_call_stack` durable 영속·terminal clear 검증. **e2e 176 pass**(기존 175 + 중첩 1). e2e 가 terminal resume_call_stack clear 누락(driveCallStackResume/finalizeResumedExecutionOutcome) 을 잡아 동반 수정.
- [x] **spec flip 완료** (commits `5dc6444f`·`7c6d0f2c`·`35524fe4`): 4-execution-engine §4.x/§6.2/§7.4/§7.5(step2+diagram)/§12.2/§1.3/§Rationale·1-data-model §2.13·conventions/execution-context.md 원칙4·data-flow/3-execution §1.3·4-nodes/6-presentation/0-common §10.9·websocket-protocol §4.2 모두 full B3 완료형 정합. D6 레이블 disambiguate. SPEC-DRIFT draft 회수. `--impl-done` W1~W4 + ai-review W8/W9 + INFO6 해소.
- [ ] **PR-B2a follow-up (남음, 분리)**: LLM_STUB_MODE 문서화·EIA §8.3·doc-sync·e2e ENCRYPTION_KEY. (본 PR 범위 밖 — 별도 처리.)
- [ ] **umbrella 잔여(분리)**: Phase 0 PR3 rehydration 일반화(--impl-done I9 재검토), node-cancellation §2, W4 cross-worktree rebase(`impl-concurrency-cap-pr2b`), W11/W12 아키텍처 추출(ProcessTurnResult 타입·updateExecutionStatus 멱등 가드).
- [ ] **잔여 doc polish(비차단, 최종 --impl-done `16_16_04` BLOCK:NO)**: (W2) `driveResumeDetached` JSDoc "void로(detach) 호출" → "worker 직접 await" 정정; (INFO8/9) `spec/conventions/execution-context.md`·`spec/5-system/4-execution-engine.md` frontmatter `code:` 에 `codebase/backend/src/shared/execution-resume/**` 등록; (INFO5) `1-ai-agent §7` 잔존 `runAiConversationLoop` 언급 turn-park 주석. — 리뷰-게이트 루프 회피 위해 본 PR 에서는 미적용(게이트 GREEN 유지), 후속 doc PR 또는 umbrella 정리 시 일괄.
> **차수 메모 (2026-06-06)**: **PR-B2b 완료** (step 8 durable nested resume → full B3 제거 → 중첩 e2e → spec flip). 7+ commits, execution-engine unit 690+ pass, dockerized e2e 176 pass, build·lint clean. ai-review 2회(step8 HIGH→resolved, full-B3 MEDIUM 0-Critical→resolved), `--impl-done` BLOCK:NO. plan 시퀀싱(8→B3) 준수, 리뷰-게이트 루프 회피(코드 fix 배치 + review/** 전용 종결 커밋).

- 2026-06-05 착수. #468 머지 확인(main `9f30216f`). durability 맵 조사 완료(본 plan "현행 durability 맵").
- **2026-06-05 PR-B1 완료** (branch `claude/exec-park-b1`, base origin/main `84dd7314` #480): form/button park-release + slow-path 일원화 + cancellation gap 수정. 빌드·lint·unit(668)·dockerized e2e(29 suites/174, 신규 `execution-park-resume.e2e-spec.ts` 포함) 통과. ai-review(MEDIUM, Critical 0/Warning 19 → resolution 19/19 처리, e2e pass) → `--impl-done`(BLOCK:NO, `review/consistency/2026/06/05/15_27_01`).
  - **`--impl-done` WARNING 처리**: W2(§6.3 frozen vs D3) = 이미 §6.3 L672 D3 노트로 정합(무조치). W1(§7.4 과도기 인라인 주석) = §Rationale 단계적 롤아웃이 cross-ref(선택 polish, 미반영). W3(`error-codes.md §3` skipReason scope 경계) = PR-B1 범위 밖, 후속.
  - **W4 (cross-branch 운영 리스크, 미해결)**: `impl-concurrency-cap-pr2b` worktree 가 `spec/5-system/4-execution-engine.md` 를 **Phase B 이전 모델**로 수정 중 → PR-B1 머지 후 그 브랜치가 spec push 시 Phase B 서술 덮어쓰기 위험. **조치 필요**: PR-B1 머지 후 `impl-concurrency-cap-pr2b` rebase 선행을 `exec-intake-queue-impl.md` PR2b 착수조건에 명기(해당 worktree planner 담당). 본 plan 단독 해소 불가(타 worktree).
