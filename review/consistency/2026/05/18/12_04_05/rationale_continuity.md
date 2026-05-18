# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-conversation-turn-render.md`
검토 모드: `--spec`
검토 일시: 2026-05-18

---

### 발견사항

- **[WARNING]** `§4.4.6` "injected chip" 권장을 새 Rationale 없이 필수로 격상
  - target 위치: §1 결정 D5 마지막 문장, §3.1 `(신규) §11 미리보기 UI 렌더 규칙`, §11.2 시각 구분 신호, §3.2 `spec/5-system/6-websocket-protocol.md §4.4.6` 개정 지점
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md §4.4.6` **소비 측 권장 동작** 두 번째 bullet ("대화 UI 표시는 `injected` 도 함께 보여주되, '주입된 컨텍스트' 임을 시각적으로 구분(예: chip) 하는 것을 **권장**") 및 `plan/in-progress/ai-thread-source-mark.md` §Follow-up ("UI: 'injected context' chip 표시 — 본 PR은 데이터 레이어까지만 다룬다. **별도 PR**")
  - 상세: 기존 §4.4.6 의 chip 표시는 명시적으로 **권장(recommendation)** 이었고, `ai-thread-source-mark` plan 은 chip 표시를 Follow-up(별도 PR) 으로 남겨두었다. target 은 이 "권장"을 새 §11.2 의 "3중 신호 **동시에** 적용" 필수 규약으로 전환하면서, 왜 지금 이 결정을 필수로 격상하는가에 대한 새 Rationale 이 없다. D5의 마지막 줄("WebSocket Protocol §4.4.6 의 소비 측 권장 동작 두 번째 줄(injected chip 권장)은 본 매핑표 채택으로 **권장 → 필수** 격상")이 결정 자체를 선언하지만 그 근거가 §8 Rationale 에 별도로 명시되어 있지 않다 — target §8 신규 Rationale 항목의 대안 비교 표에 chip 격상 사유가 기술되어 있지 않다.
  - 제안: target §8 Rationale 의 신규 항목(또는 별도 소항목)에 "injected chip 표시를 왜 지금 선택이 아닌 강제로 격상하는가"를 명시한다. 예: "기존 §4.4.6 은 turn 카운팅 버그 해소(source 마커 도입) 를 목표로 작성되었고 UI 표시 방식은 선택으로 두었으나, 본 작업의 목적이 사용자 오인 0% 지향임을 감안해 3중 신호(아이콘 + 컨테이너 + chip)를 동시 적용 필수로 격상한다." 형태로 Rationale 을 갱신해야 번복 근거가 명문화된다.

- **[INFO]** `ai-thread-source-mark` Follow-up 항목의 cross-link 갱신이 target 에서 정식 완료 처리되나, plan 의 체크박스 상태와 정합 확인 필요
  - target 위치: §3.4 `plan/in-progress/ai-thread-source-mark.md` 개정 항목
  - 과거 결정 출처: `plan/in-progress/ai-thread-source-mark.md` §Follow-up ("UI: 'injected context' chip 표시 — Phase 2/3 미완료, 별도 PR")
  - 상세: target §3.4 는 `ai-thread-source-mark.md` 의 chip Follow-up 항목을 "정식 spec화 완료"로 cross-link 업데이트하겠다고 기술한다. 그러나 `ai-thread-source-mark` plan 의 Phase 2/3 가 아직 미완료(체크박스 미체크)이고, chip 표시는 Phase 3 Open Questions 에서 "추후 결정"으로 남아있다. spec-draft 는 chip 표시를 이미 §11.2 필수로 확정하고 있으므로 plan 상태와 충돌한다. 구현 plan 이 선행해야 할 chip 구현 의사결정이 spec draft 에서 선제 확정되는 역전 구조이나, spec draft 자체가 구현 plan 보다 선행해 규칙을 확정짓는 SDD 방식이므로 구조적 문제는 아니다. 다만 ai-thread-source-mark 의 Follow-up 항목 상태가 "완료"로 기재되면 Phase 2/3 구현이 이미 끝난 것처럼 오독될 수 있으므로, cross-link 갱신 시 "spec화 완료 / 구현은 plan/in-progress/conversation-turn-render.md" 를 명확히 표기해야 한다.
  - 제안: §3.4 의 cross-link 갱신 문구를 "정식 spec화 완료 (spec 기준). 구현은 plan/in-progress/conversation-turn-render.md 에서 진행" 으로 명확화한다.

- **[INFO]** target 이 `emit messages` 기반 UI 표시를 대안 B로 기각하고 있으나, `ai-thread-source-mark` plan 의 Phase 3 Open Question 의 "잠정 결정: 보여주되 turn 카운팅에서만 제외" 와의 관계 미명시
  - target 위치: §1 결정 D4, §1 결정 D6, §3.1 §11.4
  - 과거 결정 출처: `plan/in-progress/ai-thread-source-mark.md` §Open Questions ("injection 메시지를 UI conversation timeline 에 보여줄 것인지 vs 숨길 것인지. **잠정 결정**: 보여주되 turn 카운팅에서만 제외.")
  - 상세: `ai-thread-source-mark` plan 은 "보여주되 turn 카운팅에서 제외" 라는 잠정 결정을 Open Question 으로 열어두었다. target 은 이 질문을 닫는 방향으로 결정하고 있다 — conversationThread snapshot 을 1차 소스로 하고, emit messages 를 LLM debug 패널 전용으로 격리한다. 이것은 "보여주되 카운팅에서 제외"와 결과적으로 다른 결정(emit messages 는 conversation preview 에서 숨기고 debug 패널로만 보낸다)이다. target §8 Rationale 의 대안 비교 표가 이 맥락(기존 잠정 결정과의 관계)을 언급하지 않으므로 독자가 과거 Open Question 이 어떻게 닫혔는지 추적할 수 없다.
  - 제안: target §8 의 신규 Rationale 항목에 "ai-thread-source-mark plan 의 Open Question '보여주되 turn 카운팅에서만 제외' 잠정 결정을 본 작업에서 재검토 — conversationThread snapshot 1차 소스 채택으로 emit messages 자체를 conversation preview 에서 제거, debug 패널 전용으로 격리"라는 경위를 한 줄 추가한다.

---

### 요약

target spec-draft 는 기존 spec 에서 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하는 항목이 없다. ConversationTurn 스키마 무변경 원칙, `source`/`nodeLabel`/`data` 메타 활용, LLM payload builder 책임 경계 분리 모두 기존 설계 원칙과 정합한다. `displayKind` 신규 필드 도입은 대안 A로 명시적으로 기각했고 기각 사유도 상세하다. 다만 `spec/5-system/6-websocket-protocol.md §4.4.6` 의 injected chip "권장"을 "필수" 로 격상하는 결정이 §8 Rationale 에 근거 없이 번복 형태로 들어왔고, `ai-thread-source-mark` plan 의 Open Question(잠정 결정: 보여주되 제외)을 실질적으로 번복하면서 경위가 명문화되지 않았다. 이 두 지점은 WARNING 1건과 INFO 2건으로 등록한다. 전체 연속성 위험도는 낮으나 Rationale 갱신으로 추적성을 보완하는 것이 권장된다.

---

### 위험도

LOW
