# Rationale 연속성 검토 — `plan/in-progress/exec-park-durable-resume.md`

검토 모드: plan draft (--plan)
검토 관점: 기각된 대안 재도입 / 합의 원칙 위반 / 무근거 번복 / 암묵적 invariant 충돌
SoT 대상: `spec/5-system/4-execution-engine.md §Rationale`·§6.2·§7.4·§7.5, `spec/conventions/conversation-thread.md §4`, `spec/0-overview.md §Rationale(실행 엔진)`

판정: **BLOCK: NO** — Critical 위배 없음. 단, plan 이 명시적으로 손대겠다고 선언한 두 합의 원칙(conversation-thread "신규 DB 컬럼 없음", "항상 publish / sticky fast-path 제거")이 있어 spec write 단계(project-planner)에서 Rationale 번복을 반드시 명문화해야 한다. 이는 plan 차원에서는 이미 정직하게 추적되고 있어 차단 사유가 아니다.

---

## W1 (Warning) — conversation-thread "신규 DB 컬럼 없음" 원칙을 번복하는데, plan 은 이를 인지·추적하고 있음

**합의 원칙**: `spec/conventions/conversation-thread.md §4` line 211 — *"v1 은 ConversationThread 본문에 신규 DB 컬럼 도입 없음. 향후 사용자 요구 명확해지면 `Execution.conversation_thread jsonb NULL` 컬럼 마이그레이션 검토."* 또한 line 213·284 가 동일 원칙을 재확인하고, execution-engine §6.2 line 725-726 도 *"NodeExecution.outputData 가 영구 SoT 이므로 별도 DB 컬럼 신설 없음"*, *"별도 `_continuationCheckpoint` 컬럼 신설하지 않는다"* 로 같은 사상을 공유한다.

**plan 의 행위**: A1 (line 73-76) 이 conversationThread durable 영속을 위해 "JSONB 컬럼 추가 vs 별도 테이블 vs `_resumeCheckpoint` 포함" 을 D1 으로 두고, line 76·112 에서 *"conversation-thread.md '신규 DB 컬럼 없음' 정책 재검토 → 정책 변경 시 Rationale 명문화 (planner)"* 를 명시적으로 적었다.

**평가**: 이것은 **무근거 번복이 아니다** — 오히려 모범적이다. ① 원칙이 애초에 *"향후 사용자 요구 명확해지면 컬럼 검토"* 라는 escape hatch 를 자체 내장한 조건부 원칙이었고, ② plan 이 그 원칙을 우회하지 않고 정면으로 "재검토 + Rationale 명문화" 를 phase 작업으로 박았으며, ③ 매체 선택을 미해결 결정(D1)으로 열어두어 planner 위임 경로가 명확하다.

**조치(차단 아님, 후속 의무)**: project-planner 가 `spec/` write 시 conversation-thread.md §4 와 execution-engine §6.2 양쪽의 "컬럼 신설 없음" Rationale 을 동시에 갱신해야 한다(둘이 같은 사상을 공유하므로 한쪽만 고치면 spec 내부 모순). 특히 만약 D1 이 `_resumeCheckpoint` 포함(=outputData JSONB 키 재사용)으로 결정되면 컬럼 신설 자체가 불필요해져 원칙 번복도 없어진다 — 이 경우가 기존 Rationale 과의 마찰이 가장 적다. plan 의 "별도 테이블/신규 컬럼" 안보다 `_resumeCheckpoint`/outputData 키 확장 안이 §6.2 의 "기존 SoT NodeExecution.outputData 활용" 선례와 연속적임을 D1 결정 시 우선 고려하도록 권고.

---

## W2 (Warning) — "항상 publish / sticky fast-path 제거" 원칙과 B2 의 fast-path 강등이 정렬되는지 확인 필요

**합의 원칙**: execution-engine §Rationale "Durable Continuation & Graceful Shutdown" 의 두 하위 결정 —
- *"Sticky fast-path 제거 — '항상 publish' 원칙 보존"*: publisher 가 자기 인스턴스 Map 에 키가 있으면 BullMQ 를 우회하던 sticky fast-path 를 **race window 라는 이유로 이미 제거**했고, "항상 BullMQ enqueue" 로 통일했다.
- §7.4/§7.5 (line 820, 835): 그러나 worker 가 job 을 pick up 한 *이후* 로컬 `pendingContinuations` 에 키가 있으면 "in-instance fast path" 로 즉시 resolve, 없으면 slow-path rehydration — 이 in-instance fast-path 는 **현재 유효한 설계로 spec 본문에 살아 있다**.

**plan 의 행위**: B2 (line 99-100) 가 `applyContinuation` 의 fast-path(`pendingContinuations.has`) 를 *"제거 또는 '같은 프로세스 우연 생존 시 순수 최적화'로 강등(의존 금지)"* 하고 모든 재개를 rehydration 으로 일원화한다. B3 (line 104) 가 `pendingContinuations` Map 제거까지 검토.

**평가**: 이것은 §Rationale 의 두 결정과 **방향이 일치**한다. enqueue 측 sticky fast-path 는 이미 제거됐고(원칙: 항상 publish), plan 은 그 짝인 **소비 측 in-instance fast-path** 까지 제거/강등해 비대칭을 해소하는 것이라 원칙의 자연스러운 연장이다. 다만 한 가지 주의:

**조치(차단 아님)**: §7.4/§7.5 의 in-instance fast-path 는 단순 최적화가 아니라 *"park 코루틴이 in-process 로 살아있어 무손실 재개"* 라는 **현행 무손실 보장의 핵심 기제**다(§0-overview 및 §4.x line 403 의 "현재 재개 경로와 알려진 한계" 가 이를 명시). plan 의 전제(Phase A 의 durable 영속 완료) 가 충족되기 **전에** B2/B3 로 fast-path 를 제거하면, in-memory 무손실 경로와 durable 무손실 경로가 둘 다 없는 공백이 생긴다. plan 은 line 70·92 에서 "B 는 A 완료 후" 시퀀싱을 명시해 이 invariant 를 이미 보호하고 있다 — 이 순서 의존을 PR 분해(line 115-121, PR-B 가 마지막)에서도 강제 유지할 것. spec §4.x line 403 의 "알려진 한계" 문단은 B 전환 완료 시 planner 가 갱신해야 한다(plan line 110 에 이미 반영됨).

---

## N1 (Note) — plan 의 durability 맵이 spec §6.2/§7.5 의 over-promise 를 정확히 교정함 (긍정적 연속성)

plan 의 "현행 durability 맵"(line 56-57)은 *"conversationThread → `createEmptyConversationThread()` 로 리셋(별도 DB 영속 없음), ★ 최대 갭"* 으로 적었다. 이는 코드 현실과 일치함을 검증했다:
- `execution-engine.service.ts` `rehydrateContext`(L1174-1255)는 `createContext`(빈 thread 초기화)로 시작해 `execution_node_log` 기반으로 **nodeOutputCache 만** 복원하고, conversationThread 를 durable snapshot 에서 복원하지 **않는다**.

반면 spec 본문은 이를 **무손실로 over-promise** 한다:
- §7.5 line 881: *"NodeExecution.outputData 에서 ... conversationThread 로드"*
- §6.2 line 726: waiting 진입 시 *"누적된 conversationThread (output.messages 또는 output.interaction)"* 를 commit
- conversation-thread.md §4 line 213: `runningSummary`/`summarizedUpToSeq` 가 *"ExecutionContext rehydration 으로 함께 복원된다"*

즉 **spec 본문이 conversationThread 의 rehydration 무손실 복원을 이미 약속했으나 구현은 리셋**이라는 spec↔impl drift 가 존재한다. plan 은 이를 갭으로 정직하게 식별하고 A1 으로 닫으려 한다 — Rationale 연속성 관점에서 이는 위배가 아니라 **기존 spec 약속을 구현으로 따라잡는 정합화**다. 단 planner 는 spec write 시 §7.5/§6.2 의 conversationThread 복원 서술이 "약속만 있고 미구현"이었음을 Rationale 에 사실대로 기록해(코드-sync 근거형 Rationale, §0-dashboard Rationale 의 전례처럼) drift 가 은폐되지 않도록 할 것.

---

## N2 (Note) — `_resumeCheckpoint` 관련 Rationale 들과 전면 정합

plan 의 A2(checkpoint 견고화)·B(slow-path 일원화)는 다음 기존 결정들과 **충돌 없이 연속적**이다:
- §Rationale "Multi-turn 재시작 재개 — `_resumeCheckpoint` 보존": 이미 "in-memory only 였던 `_resumeState` 를 평문 checkpoint 로 영속" 이라는 **번복을 한 차례 수행하며 그 근거를 박아둔** 결정. plan 은 이 방향을 (TTL 미포함, ai_agent 한정 → information_extractor 확장 등) 그대로 계승·확장한다. A2 의 "information_extractor 확장"(line 82)은 해당 Rationale 의 *"일반화는 후속 작업"* 명시와 정확히 호응.
- §Rationale "rehydration 단말 상태 이분 (cancelled/failed)": plan B2 의 "재개 = 항상 rehydration" 은 이 단말 정책을 그대로 상속하면 되며 새 enum 도입이 없어 cross-spec drift 우려 없음.
- §Rationale "타임아웃을 active-running 누적 기준으로", "per-node → execution-level intake 큐": plan 의 "park = 세그먼트 종료, active job 부재" 모델(B1)은 이 두 결정의 "park 중 job 부재" 전제와 동일 사상.

plan line 132 의 D4(turn-단위 park vs 대화-단위 세그먼트)는 위 "active-running 누적 타임아웃" Rationale 및 §4.x 세그먼트 모델과 직접 상호작용하므로, planner 결정 시 그 Rationale 을 SoT 로 참조할 것(plan 이 이미 트레이드오프로 인지).

---

## 결론

- **기각된 대안 재도입**: 없음. (오히려 §Rationale 가 한 번 기각한 in-memory-only 영속을 durable 로 가는 방향이라, 과거 번복 결정과 동일 방향.)
- **합의 원칙 위반**: 없음(차단 사유). conversation-thread "컬럼 신설 없음"(W1)·"sticky fast-path 제거/항상 publish"(W2) 두 원칙을 건드리나, 전자는 원칙 자체가 조건부였고 plan 이 정면 재검토를 phase 로 박았으며, 후자는 원칙과 같은 방향의 연장이다.
- **무근거 번복**: 없음. plan 은 모든 정책 변경을 "Rationale 명문화 (planner)" 로 추적(line 76·109-113).
- **암묵적 invariant 충돌**: 없음. "B 는 A 완료 후" 시퀀싱(line 70·92·115-121)이 무손실 보장 invariant 를 보호한다 — 이 순서 의존을 PR 분해에서 끝까지 유지하는 것이 유일한 운영 가드.

**후속 의무(planner spec write 시)**: ① conversation-thread.md §4 + execution-engine §6.2 의 "컬럼 신설 없음" Rationale 동시 갱신, ② §7.5/§6.2 의 conversationThread 복원 over-promise 를 "약속-있음/미구현→정합화" 로 사실 기록, ③ §4.x line 403 "알려진 한계" 문단을 B 완료 시 갱신. 모두 plan 의 "Spec 변경(project-planner)" 절(line 109-113)에 이미 반영되어 있어 plan 차원 흠결 없음.
