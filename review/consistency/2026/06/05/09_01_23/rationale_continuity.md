# Rationale 연속성 검토 결과

검토 모드: --impl-prep (구현 착수 전)
Target: `plan/in-progress/exec-park-durable-resume.md` (spec/5-system/ 구현 준비)

---

## 발견사항

- **[WARNING]** fast-path 잔존 서술과 B2/B3 제거 계획의 비대칭 — 새 Rationale 없이 spec 본문이 뒤처져 있음
  - target 위치: plan Phase B2("fast-path(`pendingContinuations.has`) 제거"), B3("`pendingContinuations` Map 제거")
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` Rationale "Durable Continuation & Graceful Shutdown — Sticky fast-path 제거" + §7.4 `Worker 동작` 행 및 §7.5 case 1 다이어그램
  - 상세: Rationale 는 "sticky fast-path 를 제거하고 '항상 BullMQ enqueue' 로 통일" 을 이미 선언했으나, spec 본문 §7.4 `Worker 동작` 행은 여전히 "로컬 `pendingContinuations` 에 키가 있으면 즉시 resolve (in-instance fast path)" 를 정상 동작으로 서술하고, §7.5 다이어그램도 case 1(fast path) 를 명시한다. Rationale 이 결정했는데 본문이 아직 반영되지 않은 상태다. plan B2/B3 이 이 제거를 구현 태스크로 올바르게 포함하고 있으나, 구현 착수 전 spec 본문 §7.4/§7.5 가 Rationale 과 정합하도록 갱신돼야 한다 — 아니면 구현자가 spec 본문을 "fast-path 유지"로 오독할 수 있다.
  - 제안: plan 의 "Spec 변경" 항목에 §7.4 `Worker 동작` 행 및 §7.5 case 1 다이어그램의 fast-path 서술 제거/강등을 명시적으로 포함한다. 또는 project-planner 가 spec PR-A1 에 §7.4/§7.5 본문 정정을 동기 포함한다.

- **[WARNING]** turn-단위 park(D4) — spec 본문·Rationale 어디에도 이 결정이 기록돼 있지 않음
  - target 위치: plan Phase B1("멀티턴 AI = turn-단위 park(D4)"), 결정 D4("확정 2026-06-05")
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §4.x 구현 메모 및 §7.4 ("park 동작" / `waitForAiConversation`) — 현재 spec 은 멀티턴 AI 를 단일 `waiting_for_input` 블록으로 서술하며 turn-단위 park 를 언급하지 않는다
  - 상세: 기존 spec 은 `waitForAiConversation` 이 하나의 waiting 블록으로 전체 대화를 흡수하는 것을 전제로 쓰여 있다(§4.x 구현 메모, §7.5 case 1/2 의 resume 경로 모두 "대화 전체 재개" 를 가정). D4 는 이것을 "매 turn 입력 대기 = 별도 세그먼트"로 전환하는 설계 변경이다. 이를 뒷받침하는 Rationale 이 spec 에 없고 plan 메모("메모리 일관성 우선")만 있다. Rationale 부재 상태로 구현하면, 향후 심사자가 이 변경을 "기존 결정 무근거 번복"으로 오인할 수 있다.
  - 제안: plan "Spec 변경" 항목에 "D4 turn-단위 park Rationale 명문화 (§4.x 또는 신규 §Rationale 항목)" 을 추가한다. 최소 내용: 기존 "대화 전체 = 단일 waiting" 방식과의 차이, D4 채택 근거(메모리 bounded + slow-path 일원화와의 정합성), 기각된 대안("대화 전체 = 단일 waiting 유지 + 코루틴 누적 수용").

- **[INFO]** A2 — `information_extractor` checkpoint 확장: Rationale 이 "일반화는 후속 작업" 으로 열어뒀으므로 번복 아님, 단 신규 Rationale 필요
  - target 위치: plan Phase A2("information_extractor 멀티턴도 ai_agent 와 동일하게 checkpoint 저장")
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` Rationale "Multi-turn 재시작 재개 — `_resumeCheckpoint` 보존" — "`ai_agent` 한정: 일반화는 후속 작업" 명시
  - 상세: 기존 Rationale 은 ai_agent 한정을 명시하면서 "일반화는 후속 작업" 으로 열어뒀다. 따라서 A2 는 이 결정의 자연스러운 연장으로 번복이 아니다. 그러나 확장 시 "information_extractor 고유 state 필드가 ai_agent checkpoint allow-list 와 동일하게 작동하는지, `buildRetryReentryState` 공유 재구성기가 information_extractor 에도 안전한지" 의 판단을 Rationale 에 기록해야 한다.
  - 제안: A2 구현 후 spec `4-execution-engine.md` Rationale "ai_agent 한정" 항목에 "확장 Rationale" 단락(information_extractor state 호환성 판단, allow-list 정책 적용 방식)을 추가한다. plan 에는 이미 "ai_agent 한정 여부 확인 후 확장" 이 포함돼 있으므로 진행 방향은 올바르다.

- **[INFO]** A1 — `Execution.conversation_thread` 컬럼 채택: Rationale 이미 정합, 추가 확인 불필요
  - target 위치: plan Phase A1("영속 매체 = `Execution.conversation_thread jsonb`")
  - 과거 결정 출처: `spec/conventions/conversation-thread.md §8.4` "Execution.conversation_thread 컬럼 채택 — durable park resume"
  - 상세: `conversation-thread.md §8.4` 가 이미 "신규 DB 컬럼 없음" 원칙을 "durable park resume 한정으로 전환" 한다고 명시하고, 기각한 대안(derived-view 재구성)도 기록한다. plan A1 은 이 결정을 구현하는 것이므로 Rationale 정합 문제 없음.

- **[INFO]** B3 `firstSegmentBarriers` 제거: 기존 Rationale 과 방향 일치, 단 spec 구현 메모 갱신 필요
  - target 위치: plan Phase B3("firstSegmentBarriers/armFirstSegmentBarrier/settleFirstSegment/signalParkBarrier 제거")
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §4.x 구현 메모(L402) — `firstSegmentBarriers` 의 존재 이유("BLOCK 진입 시 job 정상 ack")를 기술함
  - 상세: `firstSegmentBarriers` 는 "park 시 BullMQ 슬롯이 점유되지 않도록 배리어가 job 을 ack 반환" 이라는 목적으로 §4.x 구현 메모에 설명돼 있다. plan B1 이 "park 즉시 세그먼트 종료" 로 전환하면 이 배리어의 목적 자체가 달성되어 제거가 논리적이다. 그러나 §4.x 구현 메모가 아직 배리어 존재를 전제로 서술되므로, B3 진행 전 해당 메모를 갱신하거나 삭제해야 한다.
  - 제안: plan "Spec 변경" 항목에 §4.x 구현 메모의 `firstSegmentBarriers` 관련 서술 정리를 포함한다.

---

## 요약

target plan `exec-park-durable-resume.md` 의 핵심 방향(fast-path 제거, slow-path 일원화, `Execution.conversation_thread` 채택)은 기존 spec Rationale 이 이미 선언·문서화한 결정들과 정합한다. 가장 주목할 점은 두 가지다: 첫째, spec 본문 §7.4/§7.5 가 Rationale 이 이미 제거했다고 선언한 fast-path 를 여전히 정상 동작으로 서술하고 있어, 구현 전 spec 본문 갱신이 필요하다(WARNING). 둘째, D4 turn-단위 park 는 멀티턴 AI 루프를 per-turn 세그먼트로 쪼개는 설계 변경인데 spec 어디에도 그 Rationale 이 기록되지 않아, 구현 후 "무근거 번복"으로 오인될 위험이 있다(WARNING). 나머지 항목들(A1 컬럼 채택, A2 ai_agent 확장, B3 배리어 제거)은 기존 Rationale 의 범위 내에 있으며 보완적 Rationale 기록 수준의 개선 사항이다.

---

## 위험도

MEDIUM
