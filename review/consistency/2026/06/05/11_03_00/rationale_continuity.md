# Rationale 연속성 검토 결과

검토 모드: --impl-done (scope=spec/5-system/, diff-base=origin/main)
검토 대상 plan: plan/in-progress/exec-park-durable-resume.md
주요 관련 spec: spec/5-system/4-execution-engine.md

---

### 발견사항

- **[WARNING]** fast-path(`pendingContinuations`) 강등 기술이 Rationale 의 "항상 BullMQ enqueue" 원칙과 긴장 관계
  - target 위치: `plan/in-progress/exec-park-durable-resume.md` Phase B2 — "fast-path(`pendingContinuations.has`) 제거 또는 '같은 프로세스 우연 생존 시 순수 최적화'로 강등(의존 금지)"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §Rationale "Durable Continuation & Graceful Shutdown" — "Sticky fast-path 제거 — '항상 publish' 원칙 보존": "sticky fast-path 를 제거하고 '항상 BullMQ enqueue' 로 통일한다. local resolve 의 microsecond 절약은 운영 단순성·디버깅 가능성보다 가치가 낮다." 및 §7.4 라우팅 원칙 "모든 진입점은 항상 BullMQ enqueue. 자기 인스턴스의 pendingContinuations 에 키가 있어도 마찬가지"
  - 상세: 현행 Rationale 은 초기 검토 때 sticky fast-path 를 이미 검토 후 기각하고, "항상 BullMQ enqueue" 를 원칙으로 확정했다. plan 의 B2 는 "제거 또는 순수 최적화로 강등(의존 금지)" 이라 표현해 fast-path 를 "의존하지 않는 선택적 최적화"로 남길 가능성을 열어 두고 있다. 완전 제거가 아닌 "강등 유지" 경로를 취할 경우, 기존 Rationale 의 "제거" 결정이 번복되는 것이나 그에 대한 새 근거가 plan 에는 없다.
  - 제안: Phase B2 착수 전 spec §Rationale 에 "강등 유지 vs 완전 제거" 재검토 근거를 명시하거나, "완전 제거" 로 확정해 기존 Rationale 과 일치시킨다. 현 plan 문구("제거 또는 강등")는 결정이 유보된 상태이므로 Phase B 구현 전 명확화 권장.

- **[WARNING]** D4 (멀티턴 turn-단위 park) 에 대한 spec Rationale 미작성 — plan 이 스스로 인지한 미이행
  - target 위치: `plan/in-progress/exec-park-durable-resume.md` "Spec 변경" 항목 — "D4 turn-단위 park Rationale 명문화(4-execution-engine.md §4.x 또는 신규 §Rationale): 기존 '대화 전체=단일 waiting' 대비 차이, 채택 근거(메모리 bounded + slow-path 일원화 정합), 기각 대안('단일 waiting 유지+코루틴 누적 수용'). (consistency W4)" 이 "Phase B 선행 — 구현 착수 전 의무"로 명시됨
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §4.x — 현행 spec 은 "대화 전체를 단일 waiting 으로" 모델을 전제로 기술되어 있으며 ("AI Agent 가 `waiting_for_input` 상태로 일시 중단되면 세션은 close 되며 사용자 메시지 수신 후 재개 시점에 동일한 mcpServers 로부터 새 세션을 만든다" — §11-mcp-client §4.2 도 동일 전제). turn-단위 park 로 전환은 이 전제를 뒤집는 번복이다.
  - 상세: D4 결정 자체는 plan 에서 확정(2026-06-05) 됐으나, spec §Rationale 에 해당 번복 근거("대화 전체=단일 waiting 기각, turn-단위 park 채택 근거")가 아직 기록되지 않았다. plan 이 이를 "Phase B 구현 전 의무"로 인식하고 있으므로 실제 B1 구현 전에 반드시 이행해야 한다. 현재는 gap 상태이지 이행 누락 상태는 아니나, B1 착수 전 gate 로 작동해야 하는 항목이므로 WARNING 으로 분류한다.
  - 제안: Phase B1 착수 전 spec `4-execution-engine.md §Rationale` 에 turn-단위 park 결정 기록 추가. 기각 대안("대화 전체=단일 waiting + 코루틴 누적 수용"), 채택 근거(메모리 bounded, slow-path 일원화 정합)를 명시한다.

- **[INFO]** B3 에서 `firstSegmentBarriers` / `pendingContinuations` 제거 후 §4.x 구현 메모 동기 갱신 필요
  - target 위치: `plan/in-progress/exec-park-durable-resume.md` Phase B3 — "`pendingContinuations` Map, `firstSegmentBarriers`/`armFirstSegmentBarrier`/`settleFirstSegment`/`signalParkBarrier` 제거 또는 축소"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §4.x 구현 메모 — `firstSegmentBarriers` 의 작동 원리와 `pendingContinuations` fast-path 를 상세 기술하고 있음; §7.4 Worker 동작 행 — "로컬 pendingContinuations 에 키가 있으면 즉시 resolve (in-instance fast path). 없으면 §7.5 rehydration 경로 (slow path)"
  - 상세: plan 의 Spec 변경 항목에 §7.4 의 fast-path 문구 정정이 언급(consistency W5/I2)돼 있으나, §4.x 구현 메모(`firstSegmentBarriers` 상세 설명)도 B3 이후 일치 갱신이 필요하다. 갱신 없이 B3 가 완료되면 구현 메모가 실제 코드와 불일치하는 stale spec 이 된다. plan 의 Spec 변경 목록에 §4.x 구현 메모 제거/갱신이 명시적으로 열거되지 않아 누락 위험이 있다.
  - 제안: plan 의 "Spec 변경" 항목에 "§4.x 구현 메모(`firstSegmentBarriers` 기술) 제거/갱신" 을 B3 대응 항목으로 명시 추가.

- **[INFO]** A2b 결정(information_extractor 멀티턴 checkpoint 확장)이 Rationale 의 "ai_agent 한정" 명시와 충돌 예정 — 명시적 번복 준비 확인
  - target 위치: `plan/in-progress/exec-park-durable-resume.md` Phase A2b — "IE 전용 checkpoint builder ... spec '`ai_agent` 한정' 문구 3곳 동기 갱신 ... IE 미적용→지원으로 전환, Rationale"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §Rationale "Multi-turn 재시작 재개" — "**`ai_agent` 한정**: checkpoint allow-list 와 재구성기가 `ai_agent` 의 `_resumeState` shape 전용이다. `information_extractor` 등 고유 state 필드를 갖는 다른 `ai_conversation` 핸들러는 checkpoint 를 영속하지 않고 재개 시 graceful reset — **번복 이전과 동일 동작이므로 회귀가 아니다**. 일반화는 후속 작업."
  - 상세: A2b 는 "일반화는 후속 작업"이라는 Rationale 의 예고에 따라 IE 확장을 진행하는 것이므로 Rationale 위반이 아니다. 다만 A2b 수행 시 해당 Rationale 항목("ai_agent 한정" 문구 + "일반화는 후속")을 적절히 갱신해야 한다. plan 이 "Rationale" 갱신 의무를 인식(consistency I4 언급)하고 있으므로 이행 가능성이 높으나, 실제 A2b PR 에서 누락 위험이 있어 INFO 로 기록.
  - 제안: A2b PR 체크리스트에 §Rationale "ai_agent 한정" 항목을 "ai_agent + information_extractor 지원" 으로 갱신하는 항목 명시.

---

### 요약

`plan/in-progress/exec-park-durable-resume.md` 는 전반적으로 `spec/5-system/4-execution-engine.md` 의 Rationale 과 일관성이 높다. A1(conversationThread durable 영속)은 spec 이 예고했던 결정을 이행한 것이고, A2a(checkpoint 견고화)는 기존 Rationale 의 확장이며, D4(turn-단위 park)는 메모리 bounded + slow-path 일원화 원칙에 부합한다. 주요 우려는 두 가지다. 첫째, Phase B2 에서 `pendingContinuations` fast-path 를 "완전 제거"가 아닌 "의존 금지 강등"으로 남길 가능성이 있는데, 기존 Rationale 은 sticky fast-path 를 명시적으로 기각하고 "항상 BullMQ enqueue" 원칙을 확정했으므로 강등 유지 경로를 취한다면 새 근거가 필요하다. 둘째, D4 turn-단위 park 결정이 spec Rationale 에 아직 기록되지 않았으며 plan 이 이를 Phase B 착수 전 의무로 스스로 인식하고 있다 — 이 gate 를 실제로 이행하지 않고 B1 구현에 착수할 경우 Rationale 없는 결정 번복이 된다. 두 항목 모두 구현 완료 후의 문제가 아니라 Phase B 착수 전에 처리돼야 하는 사전 조건이다.

### 위험도

LOW

---

STATUS: SUCCESS
