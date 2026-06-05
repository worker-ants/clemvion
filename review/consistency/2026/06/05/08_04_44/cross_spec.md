# Cross-Spec 일관성 Check 결과 — exec-park-durable-resume (plan draft)

- **검토 모드**: plan draft (`--plan`)
- **Target**: `plan/in-progress/exec-park-durable-resume.md`
- **관점**: 데이터 모델 / API 계약 / 요구사항 ID / 상태 전이 / RBAC / 계층 책임 충돌
- **SoT 참조**: `spec/5-system/4-execution-engine.md` (§1.1~§1.3 상태머신·재개 컨트랙트, §4.x park, §6.2 저장전략, §7.4 continuation bus, §7.5 rehydration, §Rationale "Durable Continuation"), `spec/conventions/conversation-thread.md` (§4 영속화, §7 v2 로드맵, §8.3 Rationale), `spec/1-data-model.md` (§2.13 Execution / §2.14 NodeExecution), `spec/0-overview.md` (§2.4 / §6.1)

> 참고: payload 에 동봉된 spec 본문은 0-overview / 1-data-model / 2-navigation/0-dashboard 뿐이고, 본 plan 의 실제 SoT(execution-engine.md §4.x/§7.4/§7.5, conversation-thread.md)는 미동봉이어서 worktree 레포에서 직접 로드해 대조했다.

---

## 요약 판정: BLOCK = NO

Critical 위배 없음. plan 의 방향(park 즉시 coroutine 해제 + slow-path 일원화 + resume 상태 durable 영속)은 **기존 spec 이 이미 "검토 대상"으로 명문화해 둔 전환**(`4-execution-engine.md §4.x` line 403, §Rationale "Durable Continuation", `execution-engine-residual-gaps.md` 추적)과 정합한다. data model·API 계약·상태 enum 을 건드리지 않는 내부 인프라 전환이므로 cross-spec drift 표면이 작다. 다만 **Warning 4건**(plan 본문 vs spec 사실 불일치 / 미반영 cross-link / 용어)과 **Info 2건**을 아래에 정리한다. 모두 plan 단계에서 흡수 가능하며 spec write 전 reconcile 권고.

---

## Warning

### W1 — durability 맵의 "conversationThread = ★최대 갭(손실/리셋)" 서술이 spec 의 "derived view, 재구성 가능" 정의와 충돌 (계층 책임)

- **Plan**: 현행 durability 맵에서 `conversationThread` 를 "in-memory 전용 → rehydration 시 손실/리셋(`createEmptyConversationThread()`), ★ 최대 갭" 으로 규정하고, A1 을 ⭐⭐⭐ 핵심으로 둔다.
- **Spec 사실**:
  - `conversation-thread.md §4` 영속화 표: 실행 후 SoT 는 `NodeExecution.outputData` 의 `output.result.messages`(AI 멀티턴 누적, D6 단일 경로) + `output.interaction`(presentation) 이며 **"thread 자체는 재구성 가능한 derived view"**.
  - `4-execution-engine.md §6.2` waiting 진입 행: "(c) 누적된 `conversationThread`(`output.messages` 또는 `output.interaction`)" 를 `NodeExecution.outputData` 에 commit — **별도 컬럼 없이 기존 outputData 를 §7.5 rehydration 의 단일 진실로 활용**.
  - `conversation-thread.md §9.11`(line 394): 실행 이력 복원 view 가 `output.result.messages` + `output.interaction` 두 경로를 합쳐 `conversationThread.turns` 동등 view 를 재구성한다고 명시.
- **충돌의 성격**: spec 은 "thread 본문은 derived 라 별도 영속 불필요, NodeExecution.outputData 에서 재구성 가능" 이라는 입장인데, plan 은 "thread 가 in-memory 전용이라 손실" 로 정반대 전제에 선다. 둘 중 하나가 부정확하다 — 실제로는 **rehydration 경로(§7.5)가 `createEmptyConversationThread()` 로 빈 thread 를 만든 뒤 outputData 의 messages/interaction 으로 재구성하지 *않고* 있다면** plan 이 옳고 spec §4/§6.2 가 과대 약속(over-promise)이다. 반대로 재구성이 실제로 일어난다면 plan 의 "★ 최대 갭" 은 과장이다.
- **권고**: A1 착수 전 `rehydrateContext`(~L91/L1194-1210)가 정말 빈 thread 로만 리셋하고 outputData 의 messages/interaction 을 재구성하지 않는지 코드로 확정하라. 그 결과에 따라 (a) plan 이 옳으면 `conversation-thread.md §4` 의 "derived view 라 재구성 가능" 문구와 `§6.2` (c) 행이 **현실과 어긋난 spec drift** 이므로 planner 가 동반 정정해야 하고, (b) spec 이 옳으면 plan 의 "최대 갭" 규정과 A1 범위(별도 영속 매체 D1)가 과대해진다. 어느 쪽이든 plan 의 "현행 durability 맵" 과 spec §4/§6.2/§9.11 의 SoT 서술을 **한 문장으로 합치**시켜야 한다.

### W2 — conversation-thread 영속 매체(D1)가 spec 이 이미 예고한 단일 형태(`Execution.conversation_thread jsonb`)와 후보가 어긋남 (데이터 모델)

- **Plan D1**: thread 영속 매체를 "JSONB 컬럼 / 별도 테이블 / `_resumeCheckpoint` 내 포함" 3안으로 열어둔다.
- **Spec 사실**: `conversation-thread.md §4`(line 211) + §7 v2 로드맵(line 284) 둘 다 향후 도입 형태를 **`Execution.conversation_thread jsonb NULL` 단일 컬럼**으로 못박아 예고한다("cross-node 조회 N+1 해소" 근거 포함). 즉 spec 은 이미 매체를 사실상 결정해 둔 상태.
- **충돌의 성격**: 직접 모순은 아니나(둘 다 "검토"), plan 의 3안 중 "별도 테이블" / "`_resumeCheckpoint` 포함" 은 spec 의 예고 형태와 배치된다. 특히 `_resumeCheckpoint` 포함안은 `4-execution-engine.md §1.3` 의 checkpoint allow-list(ai_agent 한정 · credential-strip · messages/turnCount/... 부분집합)와 thread(presentation_user/ai_user/tool turns 전체)의 scope 가 달라 의미 혼선을 일으킨다 — checkpoint 는 "다음 turn 재구성용 ai_agent 부분집합", thread 는 "전 노드 인터랙션 누적" 이라 한 컬럼에 합치면 §1.3 의 보존 정책(`stripControlFields` 보존 예외)과 충돌 소지.
- **권고**: D1 후보에 "spec §4/§7 이 이미 `Execution.conversation_thread jsonb` 단일 컬럼으로 예고함" 을 명시하고, `_resumeCheckpoint` 포함안 채택 시 §1.3 checkpoint scope 와의 분리를 Rationale 로 강제. 별도 테이블 채택 시 §7 로드맵 문구를 planner 가 정정.

### W3 — 추적 plan(`execution-engine-residual-gaps.md`)에 본 전환의 tracking 엔트리가 부재 (Plan Coherence / cross-link)

- **Plan & Spec 양쪽이 추적처로 지목**: 본 plan 헤더("관련 잔여 추적: execution-engine-residual-gaps.md")와 spec `§4.x`(line 403)·§7.1 banner 모두 "park 즉시 코루틴 해제 + slow-path 일원화 전환은 `execution-engine-residual-gaps.md` 추적" 이라고 명시.
- **실제**: `execution-engine-residual-gaps.md`(95 lines) 본문에 park / coroutine / 메모리 누적 / barrier / 일원화 키워드가 **없다**. G2 는 `errorPolicy='continue'` 분기 + cross-instance 재개 인프라 부재를 다루지만, "응답 없는 park execution 의 coroutine 무한 누적" 이라는 본 plan 의 출발 문제는 추적 항목으로 등재돼 있지 않다.
- **권고**: 본 plan 이 그 추적 항목의 formalization 이므로, (a) residual-gaps 에 본 전환을 가리키는 한 줄(또는 본 plan 으로의 cross-link)을 추가하거나, (b) 본 plan 이 residual-gaps 의 해당 gap 을 흡수·종결함을 양 문서에 상호 명시. 현재는 spec 이 "추적된다"고 약속한 항목이 추적 문서에 없는 dangling 상태.

### W4 — §4.x 라벨 명명 불일치: plan "durable park" vs spec "waiting_for_input park" (Naming)

- **Plan**: SoT 를 "§4.x(durable park)" 로, Spec 변경 항목을 "§4.x: park 즉시 해제 + slow-path 일원화로 구현 모델 갱신" 으로 표기.
- **Spec 사실**: 실제 §4.x heading 은 **"waiting_for_input park (intake 큐가 wait 의미를 바꾸지 않음)"** 이고, "durable park" 는 §4 banner(line 351 "active 세그먼트 + durable park") 의 설계모델 용어다. anchor(`#4x-waiting_for_input-park-...`)와 어긋날 수 있다.
- **권고**: plan 의 §4.x 참조를 spec 실제 heading 명("waiting_for_input park")에 맞춰 표기. 사소하나 spec write 시 anchor 정합을 위해 정리 권고.

---

## Info (위배 아님 — 정합 확인 / 주의 환기)

### I1 — 상태머신·enum 무변경이라 cross-spec drift 표면 작음 (정합 확인)

- 본 plan 은 Execution/NodeExecution `status` enum(`1-data-model.md §2.13/§2.14`, `4-execution-engine.md §1.1/§1.2`)을 건드리지 않는다. `4-execution-engine.md §Rationale`(line 1198)이 명시한 "WAITING_FOR_INPUT → INTERRUPTED 신규 enum 도입" 기각(DB migration / status pill / 외부 API / Re-run / Execution History 필터 cross-spec drift 회피)과 plan 의 "외부 상태는 그대로, 내부만 전환" 방향이 일치. `RESUME_*` 에러코드(§7.5 / `1-data-model.md §2.13 error` 열)도 신규 추가 없음 — plan 은 기존 3코드(`RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE`)의 상시화 방지를 목표로만 함. ✅

### I2 — B2(fast-path 강등/제거)는 §7.4 의 "항상 BullMQ enqueue" 원칙과 정합(오히려 강화)

- `4-execution-engine.md §7.4` 라우팅 원칙: "모든 진입점은 항상 BullMQ enqueue. 자기 인스턴스 `pendingContinuations` 에 키가 있어도 마찬가지 — local resolve 의 microsecond 절약은 운영 단순성보다 가치 낮음." `§Rationale`(line 1203 "sticky fast-path 제거")도 동일. plan B2(fast-path 를 "순수 최적화"로 강등하거나 제거, 의존 금지)는 이 원칙의 자연스러운 연장이며 충돌 없음. 단 §7.4 Worker 동작 행("로컬 pendingMap 히트 시 즉시 resolve") 자체를 제거하려면 그 행과 §7.5 case 1(fast path) 문구를 planner 가 동반 정정해야 함 — plan "Spec 변경" 목록에 §7.4 가 누락돼 있으니 추가 권고(현재는 §4.x·§7.5 만 열거).

### I3 — RBAC / API 계약 / 계층 책임 충돌 없음

- 권한·엔드포인트·request/response shape 변경 없음(내부 엔진 인프라 전환). `executions/:id/continue` · WS `execution.*` 명령(§7.4/§6-websocket)의 외부 계약은 plan 범위 밖으로 유지. background 격리(§3.3 / conversation-thread §3.2)·sub-workflow 상속(§3.1) 정책도 plan 이 건드리지 않음. ✅

---

## 결론

- **BLOCK: NO** — Critical 없음.
- spec write 진입(project-planner) 전 reconcile 권고:
  1. **W1** (가장 중요): A1 착수 전 rehydration 이 실제로 thread 를 재구성하는지 코드 확정 → plan "현행 durability 맵" 과 `conversation-thread.md §4/§9.11` · `4-execution-engine.md §6.2` 의 SoT 서술을 한쪽으로 합치.
  2. **W2**: D1 후보에 spec 예고 형태(`Execution.conversation_thread jsonb`) 명시 + `_resumeCheckpoint` 포함안의 §1.3 scope 충돌 가드.
  3. **W3**: `execution-engine-residual-gaps.md` 에 본 전환 tracking 엔트리 추가(또는 상호 cross-link).
  4. **W4 / I2**: plan "Spec 변경" 목록에 §4.x heading 명 정정 + §7.4 라우팅 원칙 정정 항목 추가.
