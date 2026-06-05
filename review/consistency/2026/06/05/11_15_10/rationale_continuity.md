# Rationale 연속성 검토 결과

검토 모드: --impl-done (scope=spec/5-system/, diff-base=origin/main)
검토 대상: spec/5-system/ 전체 + plan/in-progress/exec-park-durable-resume.md

---

## 발견사항

### 1. [WARNING] Phase B 설계가 "항상 BullMQ enqueue" 원칙과 긴장 — fast-path/slow-path 이원화 제거 이유 불충분 기술

- **target 위치**: `plan/in-progress/exec-park-durable-resume.md` §Phase B, B2 "fast-path(`pendingContinuations.has`) 제거 또는 '같은 프로세스 우연 생존 시 순수 최적화'로 강등(의존 금지)"

- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §Rationale "Durable Continuation" — "Sticky fast-path 제거 — '항상 publish' 원칙 보존"`

- **상세**: spec의 해당 Rationale는 "publisher 가 자기 인스턴스에 key 가 있으면 BullMQ 우회하고 직접 resolve 하는 sticky fast-path 를 **이미 기각**했다. 모든 진입점은 항상 BullMQ enqueue 로 통일한다"고 명시한다. 이를 근거로 §7.4 라우팅 원칙 표는 "자기 인스턴스의 `pendingContinuations` 에 키가 있어도 항상 BullMQ enqueue" 를 현재 동작으로 기술한다.

  그런데 같은 §7.4 Worker 동작 행은 "로컬 `pendingContinuations` 에 키가 있으면 즉시 resolve (in-instance fast path). 없으면 §7.5 rehydration (slow path)" 로 fast-path 가 **worker 측 처리 로직**으로 여전히 존재함을 기술하고 있다. 즉 publisher 는 항상 BullMQ 를 거치되 worker 가 pick-up 후 Map 에서 빠르게 처리하는 구조다. Phase B2 는 이 worker 측 fast-path(Map 의존) 를 제거하겠다고 하는데, 이는 spec의 §4.x 현황 메모("같은 프로세스가 재개를 받으면 무손실 fast-path(in-memory `pendingContinuations` resolve)로 이어진다")와 §7.4 Worker 동작 표현이 기술하는 worker-side fast-path 의 존재와 긴장한다. Phase B(park 즉시 코루틴 해제)가 완료되면 `pendingContinuations` 자체가 무의미해져 자연 삭제 대상이 되는 논리는 있으나, 이 연결 고리가 plan 에 명시되지 않았고 spec §Rationale 에도 "B 완료 후 pendingContinuations 제거" 방향에 대한 사전 기록이 없다.

- **제안**: (a) plan의 Phase B2/B3 항목에 "Phase B 완료 후 `pendingContinuations` 는 코루틴이 park 시 즉시 해제되므로 Map 에 키가 쌓이지 않아 worker-side fast-path 자체가 dead code 가 됨 → 이는 §Rationale 'Sticky fast-path 제거' 의 publisher 측 원칙과는 별개로 worker-side fast-path 를 구조적으로 무력화함" 을 명시한다. (b) 구현 PR-B 전에 `spec/5-system/4-execution-engine.md §7.4 Worker 동작` 행과 §4.x 현황 메모를 "Phase B 이후에는 worker-side fast-path 도 불필요해져 제거된다" 방향으로 Rationale 와 함께 갱신하도록 spec 변경 항목에 추가한다.

---

### 2. [WARNING] Phase B의 "turn-단위 park" 결정(D4)이 spec §4.x 현황 메모 및 §Rationale 에 아직 미반영

- **target 위치**: `plan/in-progress/exec-park-durable-resume.md` §Phase B, B1 "멀티턴 AI = turn-단위 park(D4): `runAiConversationLoop` 의 장수 루프를 매 turn 입력 대기에서 해제" + 미결 결정 D4 "확정 2026-06-05"

- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §Rationale` 및 §4.x 현황 메모. 현행 spec §4.x 는 "구현 메모 — firstSegmentBarriers" 로 "단일 세그먼트 = 대화 시작 ~ 대화 종료(또는 다음 park)" 의미를 전제하고 있다. §Spec 변경 항목(plan §"Spec 변경") 에 D4 Rationale 명문화("4-execution-engine.md §4.x 또는 신규 §Rationale: 기존 '대화 전체=단일 waiting' 대비 차이, 채택 근거, 기각 대안")가 "Phase B 선행 — 구현 착수 전 의무"로 기재되어 있다.

- **상세**: D4는 plan 내에서 "확정 2026-06-05"로 기록되어 있으나, spec에 해당 Rationale 가 아직 작성되지 않았다. plan 스스로 "Phase B 선행 의무"로 명시한 것이므로 blocking 이슈는 아니지만, 현 시점 spec의 §4.x 구현 메모는 "firstSegmentBarriers" 를 통한 단일 세그먼트 모델을 기술하고 있어 D4의 turn-단위 park 가 왜 기각 대안("단일 waiting 유지 + 코루틴 누적 수용")을 넘는지 Rationale 가 없다. 구현 착수 전(PR-B 전) 에 반드시 작성되어야 하는 의무 항목임에도 현재 spec에 공백이 있다.

- **제안**: Phase B 구현 착수 전, `spec/5-system/4-execution-engine.md §Rationale` 에 "멀티턴 AI turn-단위 park — D4 결정 근거" 항을 추가한다: (a) 기존 "대화 전체=단일 waiting + in-process 코루틴 유지" 방식의 메모리 누적 위험, (b) turn-단위 park + rehydration 재개 채택 근거(메모리 bounded + slow-path 일원화 정합), (c) 기각 대안("단일 waiting 유지 + 코루틴 누적 수용") 명시. 이는 plan 자체가 Phase B 착수 전 의무로 자인한 항목이다.

---

### 3. [INFO] Phase 0 "rehydration 일반화(ai_agent 너머 일반 노드)" 추가 시 spec의 "ai_agent 한정" 문구 3곳 갱신 의무 명시

- **target 위치**: `plan/in-progress/exec-park-durable-resume.md` §Phase 0 "(A2/B2 착수 전) PR3 의 rehydration 일반화(ai_agent → 일반 노드) + 멱등 재개를 본 plan A2/B2 로 직접 구현"

- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §Rationale "Multi-turn 재시작 재개"` 항 — "**`ai_agent` 한정**: checkpoint allow-list 와 재구성기가 `ai_agent` 의 `_resumeState` shape 전용이다. `information_extractor` 등 고유 state 필드를 갖는 다른 핸들러는 checkpoint 를 영속하지 않고 재개 시 graceful reset — **번복 이전과 동일 동작이므로 회귀가 아니다**. 일반화는 후속 작업."

- **상세**: spec의 Rationale 는 `ai_agent` 한정을 명시하고 "일반화는 후속 작업"으로 기록하였다. Phase 0 / A2/B2 에서 rehydration 을 일반 노드로 확장하면 이 "ai_agent 한정" 결정을 번복하는 것이다. plan 에는 "A2 채택 시 '`ai_agent` 한정' 문구 3곳(`4-execution-engine.md §1.3 L111`·`3-information-extractor.md §357`·`1-ai-agent.md §703`) 동기 갱신"이 spec 변경 항목으로 등재되어 있어 인식 자체는 있다. 다만 현 plan 에서 "일반화 구현"이 Phase 0/A2/B2 에서 직접 이루어진다는 결정이 spec에 아직 Rationale 없이 선언만 된 상태다.

- **제안**: Phase A2(일반화 구현) 착수 전 spec에 "checkpoint 일반화 — `ai_agent` 한정 해제" Rationale 를 추가하거나, 적어도 기존 "ai_agent 한정" 항의 결정 근거를 "일반화 구현 시 번복 사유(일반 노드도 rehydration 무손실 복원 이득이 있음)" 로 갱신한다. 현행 plan의 spec 변경 항목에 이 Rationale 기록 의무를 명시적으로 추가하도록 보완한다.

---

### 4. [INFO] A1 완료 후 spec §7.4 "Worker 동작" 행의 fast-path 서술이 현행 구현과 정합하는지 재확인 필요

- **target 위치**: `spec/5-system/4-execution-engine.md §7.4` Worker 동작 행 — "로컬 `pendingContinuations` 에 키가 있으면 즉시 resolve (in-instance fast path)"

- **과거 결정 출처**: 동일 spec §Rationale "Durable Continuation" — "Sticky fast-path 제거 — '항상 publish' 원칙 보존": publisher 측은 항상 BullMQ enqueue. 단 worker 처리 시 Map 에 키가 있으면 fast-path.

- **상세**: A1(conversationThread 영속)이 완료되어 PR #470 이 main 에 랜딩된 상황에서, `conversationThread` 는 durable commit 되었으나 `pendingContinuations` fast-path 는 여전히 존재한다. spec §7.4 Worker 동작 행이 현 구현 상태(A1 완료 후, Phase B 미착수 시점)를 정확히 반영하는지 — 즉 fast-path 는 A1 이후에도 여전히 정상 동작하는지, A1 이 fast-path의 동작에 영향을 주지 않는지 — 확인이 권장된다. 이는 spec 서술과 구현 간의 drift를 방지하기 위한 예방적 확인이다.

- **제안**: Phase B 착수 전 spec §7.4 Worker 동작 행에 "현 시점(A1 완료, Phase B 미착수)에서 fast-path 는 정상 운영 중이며 Phase B 완료 후 제거 예정" 을 주석이나 implementation note로 명시하여 spec 독자가 현 상태와 목표 상태를 구분하도록 한다.

---

## 요약

`plan/in-progress/exec-park-durable-resume.md` 가 기각된 대안을 직접 재도입하거나 합의된 invariant 를 명시적으로 위반하는 Critical 케이스는 발견되지 않았다. 다만 두 가지 WARNING이 있다. 첫째, Phase B2/B3의 `pendingContinuations` fast-path 제거가 spec §Rationale "Durable Continuation — Sticky fast-path 제거" 가 기각한 "publisher 측 sticky fast-path" 와는 다른 worker-side fast-path 제거임을 spec 과 plan 모두 명확히 연결하지 않아 혼동이 생길 수 있다. 둘째, D4(멀티턴 turn-단위 park)가 확정 결정으로 기록되었으나 plan 스스로 "Phase B 착수 전 의무"로 지정한 spec §Rationale 명문화가 현재까지 spec에 존재하지 않는다. 이 두 항목은 Phase B 구현 착수 전 spec 선행 갱신으로 해소해야 한다. INFO 항목 두 가지는 예방적 보완 제안이다.

## 위험도

LOW

---

STATUS: OK
