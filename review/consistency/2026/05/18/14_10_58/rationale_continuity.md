# Rationale 연속성 검토 결과

검토 대상: `spec/conventions/conversation-thread.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-18

---

### 발견사항

- **[WARNING]** `ai_user` 출처 텍스트의 `[user-input]` 마커 적용 여부 미명시 — §1.4 와 §1.6 간 불일치 가능성
  - target 위치: `spec/conventions/conversation-thread.md` §1.4 텍스트 변환 규칙 표 (`message_received (ai_user)` 행) 및 §1.6 LLM-facing 보안 마커
  - 과거 결정 출처: 본 문서 §1.6 및 §8.1 Rationale ("사용자-출처 텍스트 `[user-input]…[/user-input]` 마커로 감싼다")
  - 상세: §1.6 첫 줄은 "`renderInteractionText`는 사용자-출처 텍스트 (form 제출값, button 라벨, URL) 를 `[user-input]…[/user-input]` 마커로 감싼다"라고 정의한다. §1.1 ConversationTurnSource 에서 `ai_user` 는 "AI Agent multi-turn 의 `output.interaction.type='message_received'` 시점"이며, 이는 최종 사용자가 AI Agent 에 직접 입력한 자연어 메시지다. 따라서 `ai_user` 텍스트도 사용자-출처에 해당할 수 있음에도, §1.4 표의 `message_received (ai_user)` 행은 LLM-facing text 를 "메시지 본문 그대로"로만 기술하고 마커 wrap 여부를 명시하지 않는다. 이는 §1.6 의 "사용자-출처 텍스트 의무 마커"와 충돌 가능성이 있다. 반면 §2.2 AI Agent 누적 컨트랙트는 `message_received` 를 `ai_user` source 로 정의해 source 값은 명확하나, 그 텍스트에 마커를 적용해야 하는지 여부가 §1.4 에 기술되지 않았다. `renderInteractionText` 가 interaction type 기반 함수라면 `message_received` 경로에도 마커 적용이 적합할 수 있다.
  - 제안: §1.4 의 `message_received (ai_user)` 행의 LLM-facing text 컬럼에 `[user-input]메시지 본문[/user-input]` (마커 적용) 또는 명시적으로 "마커 적용 없음 (이유: AI Agent 가 수신 단에서 이미 message 를 구별)" 중 하나를 명기한다. 또한 §1.6 에서 "사용자-출처" 범위가 form/button/URL 에 한정인지 `ai_user` 입력도 포함하는지를 한 문장으로 명확히 한다.

- **[INFO]** ConversationTurn 의 immutability 가 §3.2 Background 격리 invariant 로 사용되나 §1.2 에 명시되지 않음
  - target 위치: `spec/conventions/conversation-thread.md` §3.2 Background 격리 근거 및 §1.2 ConversationTurn 스키마
  - 과거 결정 출처: 본 문서 §3.2 ("ConversationTurn 객체 자체는 immutable (한 번 push 되면 수정되지 않음) 이라 깊은 복사까지 필요하지 않다")
  - 상세: §3.2 의 Background 격리 보증은 `ConversationTurn` 객체가 immutable 이라는 전제에 명시적으로 의존한다. 이 불변성이 깨지면 (`turns: [...thread.turns]` shallow copy 시 내부 turn 객체가 변형될 경우) Background 격리 근거가 무너진다. 그러나 §1.2 ConversationTurn 스키마 표에는 이 불변성 계약이 기술되어 있지 않다. 스키마를 보고 구현자가 turn 객체의 필드를 append 후 수정해도 되는지 여부를 §1.2 만으로는 알 수 없다.
  - 제안: §1.2 ConversationTurn 표 아래에 "turn 객체는 push 후 불변(immutable) — 필드 수정 금지 (§3.2 Background 격리의 전제)" 한 줄 주석을 추가하거나, §1.2 표 위에 invariant 문장을 명시해 §3.2 의 보증 근거를 스키마 정의 수준에서 강화한다.

- **[INFO]** §8 서두의 "Rationale 는 AI Agent §12 에 단일 인라인" 선언과 §8.1 신규 추가의 불일치 — 설명 보완 필요
  - target 위치: `spec/conventions/conversation-thread.md` §8 Rationale 첫 문단 및 §8.1
  - 과거 결정 출처: 본 문서 §8 ("설계 결정의 근거는 Spec AI Agent §12 Rationale 섹션에 단일 인라인")
  - 상세: §8 의 첫 문장은 "본 문서는 컨벤션의 단일 진실 공급원이며 동기·역사는 AI Agent 본문에 둔다"고 하면서 Rationale 를 타 문서에 위임한다. 그러나 §8.1 은 2026-05-18 에 본 문서 안에 직접 신규 결정을 기술했다. §8.1 Rationale 는 conversation-thread.md 고유의 렌더 규칙(§9) 에 관한 것으로 AI Agent §12 의 범위(도입 동기·선택지·v1/v2 경계·conversationHistory 제거)와 별개이므로 §8.1 의 추가 자체는 합리적이다. 다만 §8 의 첫 문단이 "Rationale 는 AI Agent §12 에만 있다"는 뉘앙스를 그대로 유지해 §8.1 존재와 모순처럼 읽힌다.
  - 제안: §8 첫 문단을 "도입 동기·선택지 비교·v1/v2 경계·conversationHistory 필드 제거 사유는 AI Agent §12 에 기술. 본 문서 고유 렌더 규칙·마커 정책의 결정 근거는 아래 절에 기술한다" 형태로 보완해 두 Rationale 위치의 분담을 명확히 한다.

---

### 요약

`spec/conventions/conversation-thread.md` 는 §8.1 Rationale 에서 기각한 대안(displayKind 신설, emit messages raw 직접 노출)을 재도입하지 않으며, 채택한 핵심 원칙(emit messages 와 conversationThread snapshot 의 역할 분리, 3중 시각 신호 강제, prefix 는 builder 책임)을 §9, §1.5, §1.6 전체에서 일관되게 구현하고 있다. 관련 Rationale 발췌(data-model, workflow-list, auth-flow, integration)는 conversation-thread 도메인과 직접 교차하는 결정을 포함하지 않아 cross-spec 위반은 발견되지 않는다. 다만 두 가지 INFO/WARNING 수준의 보완 사항이 있다: (1) `ai_user` 출처 텍스트에 `[user-input]` 마커 적용 여부가 §1.4 표에서 불명확해 §1.6 의 의무와 충돌 가능성이 있고 (WARNING), (2) Background 격리 보증의 전제인 ConversationTurn immutability 가 §1.2 스키마에 명시되지 않아 구현자가 놓칠 수 있으며 (INFO), (3) §8 첫 문단과 §8.1 추가 사이의 맥락 불일치가 독자 혼동을 초래할 수 있다 (INFO).

---

### 위험도

LOW
