---
worktree: exec-park-durable-resume
started: 2026-06-06
owner: planner
---

# Spec Draft — exec-park PR-B2 full durable turn-park + 중첩 call stack 영속 (D6)

> 대상 spec: `spec/5-system/4-execution-engine.md` (주), `spec/5-system/1-data-model.md §2.13 Execution`, `spec/5-system/13-replay-rerun.md`(직교 확인), `spec/conventions/migrations.md`(신규 마이그레이션).
> branch: `claude/exec-park-pr-b2` (origin/main `2b793ffa` 기반; PR-B1 #483 + Phase A V084/V085 머지됨).
> 결정 근거: plan `exec-park-durable-resume.md` D4·D6 + §PR-B2 구현 설계.

## 변경 요지 (적용 시 spec 에 반영될 내용)

### C1. 신규 컬럼 `Execution.resume_call_stack jsonb NULL` (V086+)
- **목적**: 중첩 sub-workflow(executeInline) blocking 노드 park 시, 재개에 필요한 **호출 체인**을 durable 영속. top-level park(중첩 깊이 0)는 `null`.
- **스키마**: `{ version: number, frames: ResumeCallStackFrame[] }`, `ResumeCallStackFrame = { workflowId: string, invokerNodeId: string, recursionDepth: number }` — outermost(top-level 바로 아래) → waiting inner 노드 직전까지. waiting inner 노드 자체는 기존 WAITING NodeExecution row + `_resumeCheckpoint` 로 식별.
  - `version`: **별도 상수 `CALL_STACK_SCHEMA_VERSION`** (기존 `CHECKPOINT_SCHEMA_VERSION` 과 독립 — 혼동/coupling 방지, W6). 필드명도 `_resumeCheckpoint.schemaVersion` 과 구분되도록 `version`.
  - `invokerNodeId`: **= 해당 sub-workflow 를 호출한 Workflow(sub-workflow) 노드의 `Node.id`** (부모 그래프 내). 재개 시 그 노드까지 전진 후 executeInline 재진입 키 (I10).
- **마이그레이션**: `V087__execution_resume_call_stack.sql` (현재 next=**V087**; 최고 V086 #482. migrations.md §5 대로 **구현 착수 직전 `ls migrations/V08* | tail -2` 재확인** 후 확정 — PR race 대비). data-model §2.13 병기 번호도 동일.
- **data-model**: `1-data-model.md §2.13 Execution` 컬럼 표에 `resume_call_stack jsonb NULL` 행 추가 (conversation_thread/user_variables 와 같은 "durable park 스냅샷" 분류).

### C2. 멀티턴 AI = turn-단위 park (D4) — 장수 루프 제거
- `runAiConversationLoop` 의 `while(!conversationEnded)` 장수 루프를 제거. 각 turn 은 **도착한 continuation job 1건 = 1 세그먼트**로 단발 처리.
- 첫 turn 진입: AI 노드 도달 → 초기 AI 응답 emit + `WAITING_FOR_INPUT` park → **즉시 세그먼트 종료(release)** (form/button 과 동일 PARK_RELEASED).
- 후속 turn: continuation job 도착 → rehydration → `_resumeCheckpoint` 로 `_resumeState` 재구성 → 단발 turn 처리(`handleAiMessageTurn`) → (a) 계속이면 `_resumeCheckpoint`(기존) + thread/variables 스냅샷(`stageDurableResumeSnapshot`, **후속 turn 에도 매번**) + WAITING 전이 후 release, (b) 종료면 `finalizeAiNode` → 그래프 전진.
- **효과**: 응답 없는 멀티턴 대화도 in-process 코루틴/컨텍스트 메모리 0 점유(bounded). 모든 재개 = rehydration 단일 경로.

### C3. 중첩 sub-workflow blocking 도 durable (D6) — full B3 의 전제
- executeInline 내 blocking(form/button/AI) 도 top-level 과 동일하게 **park-release + rehydration 재개**.
- park 시: `resume_call_stack` 영속(C1) — 상태전이 트랜잭션과 원자 commit.
- 재개 시: `driveResumeDetached`/`resumeFromCheckpoint` 가 call stack 을 읽어 **top-level → 각 sub-workflow 프레임을 재귀적으로 재진입**(executeInline 재호출). 각 프레임의 executedNodes 는 `execution_node_log`(같은 executionId)에서 seed → §7.2 완료노드 미재실행 멱등 유지. waiting inner 노드 도달 시 payload 전달.
- 프레임별 변수 스코프(`$parent`, §3.4)·sub-workflow input 재seed.
- **제약 유지**: 컨테이너(Loop/ForEach/Map/Parallel) body 의 blocking 은 **§3.2 금지 그대로** — 따라서 영속할 iteration/branch 상태 없음(선형 call stack 만).

### C4. full B3 제거 (모든 재개가 durable rehydration 이 되므로 in-memory 머신 불요)
- 제거: `pendingContinuations` Map · `applyContinuation` fast-path(pendingContinuations.has 분기) · `resolvePending` · `rejectPending` · `firstSegmentBarriers` · `armFirstSegmentBarrier` · `settleFirstSegment` · `signalParkBarrier` · `firePayload` scheduler.
- `applyContinuation` → 항상 `rehydrateAndResume`(slow-path 일원화).
- worker-return: `runExecutionFromQueue` 가 `await runExecution()` 직접(detached + barrier 제거) — 모든 park 에서 runExecution 이 반환하므로 가능.
- `resumeFromCheckpoint`/`driveResumeDetached` 도 detached(`void` + firePayload) 제거 → 직접 await.
- `applyCancellation` → 항상 `cancelParkedExecution`(rejectPending 분기 제거). 중첩 inner WAITING NodeExecution 도 executionId 키로 동일 CANCELLED 처리.

### C5. spec 서술 재전환 (PR-B1 정직화 → 완료형)
> **적용 전제(W3)**: C5 의 "완료형" spec 갱신은 **PR-B2 코드와 같은 PR 로 함께 머지**될 때만 적용한다 — 코드 머지 전에 spec 만 완료형으로 바꾸면 main 에서 spec↔구현 역전. 본 PR 은 spec+impl 동시 랜딩이므로 머지 시점엔 정합. (PR-B1 선례 동일.)
> **덮어쓰기 리스크(W5)**: PR-B2 머지 전 `impl-concurrency-cap-pr2b`(Phase B 이전 서술 보유 active worktree)가 origin/main rebase 선행하도록 `exec-intake-queue-impl.md` 착수조건에 명기 — 본 plan W4/진행메모에 이미 기록.
- §4.x banner 2개(park=세그먼트 종료 · slow-path 일원화): "PR-B2 미적용/멀티턴 잠정 잔존" 인라인 표기 제거 → **멀티턴 AI 포함 turn-park 완료 · fast-path 전면 제거 · 중첩 durable** 완료형.
- §7.4 Worker 동작(L829): "멀티턴 AI 잠정 경로 rejectPending" 단서 제거 → worker-side fast-path 완전 제거 확정.
- §Rationale "park 즉시 해제 + slow-path 일원화" L1257 "단계적 롤아웃(B1→B2)" note: **"B1·B2 모두 완료(full durable)"** 로 갱신 + D6(중첩 call stack 영속) 근거 추가.
- §6.2 저장 전략: durable park 스냅샷에 `resume_call_stack` 추가.
- §7.5 rehydration: 재귀 call-stack 재진입 절차 추가.

## Rationale (적용 시 §Rationale 에 추가)
- **D6 — 중첩 call stack durable 영속**: 컨테이너 body blocking 금지(§3.2)로 남는 중첩은 sub-workflow 호출 체인뿐 = 선형. 노드 출력은 같은 executionId 로 이미 DB 영속, thread/variables 는 V084/V085 영속 → 빠진 건 호출 체인 구조뿐. `resume_call_stack` 한 컬럼으로 영속해 재귀 재진입하면 중첩 blocking 도 durable·bounded-memory·multi-instance 균일.
- **per-node 분산(L1303 기각)과의 구분**: L1303 이 기각한 건 *모든 노드*를 워커로 분산(노드마다 전체 context 직렬화)하는 per-node task queue. D6 는 **park 지점(waiting node)에서만** 직렬화하는 "waiting 후 재개"의 중첩 확장 — 같은 범주이며 dispatch loop in-process 전제(L371)를 유지(한 세그먼트는 여전히 한 프로세스가 재귀 in-process 구동). 따라서 기각 대안의 재도입이 아니다.
- **무손실 전제(Phase A) 위에 성립**: conversation_thread(V084)·user_variables(V085)·_resumeCheckpoint(A2) 가 이미 영속돼 turn/프레임 재구성이 무손실. resume_call_stack 은 그 마지막 빠진 조각.
- **`_continuationCheckpoint` 컬럼 신설 기각(L1174)과의 구분(W2)**: 과거 §Rationale L1174 는 "continuation 페이로드/상태를 위한 별도 컬럼 신설"을 기각했다(continuation 은 BullMQ 큐가 durable 운반하므로 컬럼 불요). `resume_call_stack` 은 그것과 **다른 범주** — continuation 운반이 아니라 **park 시점의 중첩 실행 위상(호출 체인)** 영속이다. 큐가 운반하는 건 "어느 노드에 무슨 입력"이고, call stack 이 영속하는 건 "그 노드가 어느 sub-workflow 프레임 안에 있는가"다(직교). 따라서 기각 결정의 번복이 아니다. spec 적용 시 §Rationale 에 이 구분 주석 추가.
- **spec 적용 시 챙길 동기화(checker W1/W4·I 군)**: §6.2 commit 목록 + §1-data-model §2.13 컬럼 행 동시 추가(W1); §7.5 에 `resume_call_stack IS NOT NULL` → 재귀 프레임 재진입 → 최내층 WAITING NodeExecution payload 전달 절차 추가(W4); L1257 단계적 롤아웃 note 는 인라인 대체 대신 **말미에 "(완료 — B1·B2 모두 머지, 2026-06-06; 중첩은 D6 call stack 영속)" append**(B1·B2 분리불가 원칙 사유 등 역사 맥락 보존, I3/I11); §1.3 에 `CALL_STACK_SCHEMA_VERSION` 독립 상수 주석(I6); 13-replay-rerun §14.3 직교 유지 확인(I8); §4-nodes/2-flow/1-workflow.md §4 에 "sync sub-workflow 내부 blocking park 시 executeInline 도 PARK_RELEASED 버블업" 추가(W2).
