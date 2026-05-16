# Rationale 연속성 검토 — `spec-draft-ai-thread-source-mark.md`

검토 대상: `plan/in-progress/spec-draft-ai-thread-source-mark.md`
검토 시각: 2026-05-16
모드: spec draft 검토 (--spec)

---

## 발견사항

### 1. INFO: `messages[].source` 가 `output.messages` (DB 영속) 에 들어갈지 여부를 미확정으로 유보

- **target 위치**: 변경하지 않는 부분 (의도적 보존) 섹션 마지막 항 — "`messages[].source` 가 `output.messages` (DB 영속) 에도 함께 들어갈지는 backend 구현 phase 의 결정 사항으로 둔다 (parseHistoryMessages 일관성 위해 권장하지만 spec 강제는 아님)."
- **과거 결정 출처**: `spec/conventions/conversation-thread.md §4 영속화` — "`output.messages` (AI 멀티턴 누적 — waiting/resumed 시)…가 SoT." 및 동 §8 Rationale — "본 문서는 컨벤션의 단일 진실 공급원이며 동기·역사는 AI Agent 본문에 둔다."
- **상세**: conversation-thread 컨벤션은 `output.messages` 를 SoT(단일 진실)로 명시하고 있다. target 이 `source` 마커를 "transport 레벨 add-on" 으로 정의하면서 DB 영속 포함 여부를 구현 phase 로 유보하면, SoT 인 `output.messages` 와 WebSocket emit payload 의 `messages[].source` 사이에 일관성 공백이 생긴다. `parseHistoryMessages` 가 source 없이 재구성할 경우 이미 spec 에서 해결한 "turn 카운팅 불일치" 문제가 이력 조회 경로에서 재발할 수 있다. 이것이 기각된 결정의 재도입은 아니지만 SoT 원칙과의 정합 보완이 필요한 지점이다.
- **제안**: "transport 레벨 add-on" 과 SoT 원칙이 충돌하지 않도록 spec 본문에 "이력 재구성 시 source 마커를 어떻게 복원할 것인가" 에 대한 방침 (재계산 가능·재계산 불가 등) 을 §4.4.6 또는 conversation-thread §4 영속화 항에 명시할 것. 구현 위임이면 위임 범위를 명확히 서술해야 향후 parseHistoryMessages 작성자가 잘못된 결정을 내리는 것을 방지한다.

---

### 2. INFO: `injectedContextLength` 기각 Rationale 내 "단단한 가정" 표현이 실제 설계 불변량과 연계되지 않음

- **target 위치**: 변경 대상 1 / §4.4 신규 하위절 / 1-F Rationale 신규 항 — 후보 안 2번 "(기각) backend 가 `injectedContextLength: number` 만 동봉. 단순하지만 messages 배열의 prefix 가 연속된 injection 이라는 단단한 가정 필요."
- **과거 결정 출처**: `spec/conventions/conversation-thread.md §5 AI Agent 자동 주입` — "`[system, ...injectedThread, ...selfHistory]` 로 재빌드" 및 `getThreadExcludingNode` 로 자기 노드 제외 처리가 기술되어 있다.
- **상세**: 기각 이유로 든 "prefix 가 연속된 injection 이라는 가정이 깨진다" 는 정확한 지적이나, 현재 spec §5 의 `[system, ...injectedThread, ...selfHistory]` 재빌드 구조가 injected 부분이 실제로 messages 배열 앞쪽 연속 블록임을 암묵적으로 보장하고 있다. 향후 `multi-thread 머지` 또는 inline 주입 시나리오에서 이 가정이 깨질 것이라는 미래 근거는 타당하지만, 현재 spec 내의 어떤 항목이 이를 허용하는지 연결이 없다. 기각 Rationale 내에서 미래 시나리오를 언급할 때 해당 v2 로드맵 항목을 교차 참조하면 충돌 가능성이 더 명확해진다.
- **제안**: 기각 이유 2번에 `conversation-thread.md §7 v2 로드맵 "Multi-thread"` 항 교차 참조를 추가한다. 이렇게 하면 기각의 근거가 현재 spec 의 어느 v2 계획과 연결되는지 추적 가능해진다.

---

### 3. INFO: `source: 'live' | 'injected'` 2값 enum 이 ConversationTurnSource 5값 내부 모델과의 축약 관계를 Rationale 에서만 설명하고 spec 본문에 매핑 표가 없음

- **target 위치**: 변경하지 않는 부분 (의도적 보존) 첫 항 — "§1.1 ConversationTurnSource enum 은 그대로 유지 — 백엔드 내부 모델은 5값 분류를 계속 사용한다. emit 단계에서 2값으로 축약하는 것은 WebSocket 페이로드의 소비자(frontend) 가 필요한 최소 정보만 노출하기 위함."
- **과거 결정 출처**: `spec/conventions/conversation-thread.md §1.1 ConversationTurnSource` 5값 정의 (`presentation_user`, `ai_user`, `ai_assistant`, `ai_tool`, `system`). 동 §5.1 messages 모드 매핑 표.
- **상세**: 내부 5값 ConversationTurnSource 에서 외부 2값 `live | injected` 로의 축약 규칙이 target 의 §4.4.6 에 서술되어 있으나, "어느 5값이 `live` 가 되고 어느 것이 `injected` 가 되는지" 를 완전히 명시한 매핑 표가 §4.4.6 에 없다 (설명은 산문으로 있음). 특히 `ai_tool` 과 `system` source 를 가진 turn 이 injected 되었을 때 어떤 2값을 받는지 명확하지 않다. conversation-thread.md §5.1 의 messages 모드 매핑 표와 target §4.4.6 의 `source` 마커 정의 사이에 두 독자(spec 작성자와 구현자)가 각자 해석할 수 있는 여지가 있다.
- **제안**: §4.4.6 에 ConversationTurnSource → `messages[].source` 축약 매핑 표를 추가한다. 예: `presentation_user` → `injected`, `ai_user` (injected context) → `injected`, `ai_user` (live turn) → `live`, `ai_assistant` (injected) → `injected`, `ai_assistant` (live) → `live`, `ai_tool` → `live` (또는 조건부 정의). 이 표가 없으면 구현 시 ambiguity 가 발생한다.

---

## 요약

target 문서(`spec-draft-ai-thread-source-mark.md`)는 `messages[].source: 'live' | 'injected'` 마커 도입에 대해 명시적인 Rationale 신규 항(1-F)을 포함하고 있으며, 기각된 두 대안(`injectedContextLength`, 어시스턴트 메시지에 `turnIndex` 직접 동봉)의 폐기 근거도 함께 서술하고 있다. 기존 spec 의 `## Rationale` 에서 명시적으로 거부된 결정을 재도입하거나 합의된 invariant 를 직접 위반하는 CRITICAL/WARNING 수준의 사항은 발견되지 않았다. 다만 세 가지 INFO 수준의 정합 보완 제안이 있다: (1) `output.messages` SoT 와 transport add-on 간의 일관성 공백 명시화, (2) `injectedContextLength` 기각 근거의 v2 로드맵 교차 참조, (3) 내부 5값 ConversationTurnSource 에서 외부 2값으로의 축약 매핑 표 추가. 이 세 항목은 모두 Rationale 의 논리 강화 및 향후 구현자의 오해 방지를 위한 것으로, 현재 draft 의 스펙 반영을 차단할 수준은 아니다.

---

## 위험도

LOW
