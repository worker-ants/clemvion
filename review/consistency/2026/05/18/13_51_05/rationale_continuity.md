# Rationale 연속성 검토 — `spec/conventions/conversation-thread.md`

검토 모드: `--spec`
검토 일시: 2026-05-18

---

### 발견사항

---

- **[CRITICAL]** `[user-input]…[/user-input]` 마커: "금지" → "LLM-facing 의무" 번복이 동일 spec 문서 내 상충 표현을 남김
  - target 위치: §1.2 `text` 필드 설명("인라인 마커는 박지 않는다"), §1.6 "LLM-facing 의무", §8.1 Rationale, §9.5 strip 규칙, CHANGELOG 두 번째 2026-05-18 항목
  - 과거 결정 출처: `spec/conventions/conversation-thread.md` (commit `48cc0ebf`, 첫 번째 2026-05-18 CHANGELOG 항목) §1.6 "금지된 인라인 마커" — `[user-input]…[/user-input]` 를 "spec 외 임의 마커" 로 규정하고 명시적으로 **금지**. 대안으로 `data.buttonLabel` 1급 필드 격상을 제안.
  - 상세: 동일 revision 사이클 안에서 같은 마커가 (a) 금지 → (b) LLM-facing 의무로 번복됐다. CHANGELOG 두 번째 2026-05-18 항목이 "옛 '금지' 진술을 정정"이라고 선언하므로 번복 의도는 명시되어 있다. 그러나 §1.2 `text` 필드 설명 중 "**`[user-input]…[/user-input]` 같은 인라인 마커는 박지 않는다**" 문구가 삭제 없이 그대로 남아 있어 — §1.6의 "LLM-facing 의무"와 §1.2의 "박지 않는다"가 **동일 target 문서 안에서 충돌**한다. 단순 누락인지 의도적 구분인지 독자가 판별 불가.
  - 제안: §1.2 `text` 필드의 "`[user-input]…[/user-input]` 같은 인라인 마커는 박지 않는다" 문구를 "보안 목적의 `[user-input]…[/user-input]` 마커는 LLM-facing 의무(§1.6). UI 표시 시 §9.5 에서 strip" 으로 교체. 또는 §1.2 상단의 "**LLM-facing 1차 텍스트** — ... 인라인 마커는 박지 않는다" 서술을 완전히 제거하고 §1.6 로 위임하는 형태로 일원화.

---

- **[WARNING]** chip 표시 "권장 → 강제" 격상이 `spec/5-system/6-websocket-protocol.md` §4.4.6 에 반영되지 않음
  - target 위치: §9.2 "시각 구분 신호 (3중 강제)", §8.1 Rationale "chip 표시 '권장 → 필수' 격상 이유"
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` §4.4.6 "소비 측 권장 동작" (2026-05-16) — "대화 UI 표시는 `injected` 도 함께 보여주되, '주입된 컨텍스트' 임을 시각적으로 구분(예: chip) 하는 것을 **권장**." WebSocket spec §Rationale("메시지 origin 마커 도입")에서도 채택 근거를 "소비 측이 `live` 만으로 turn 을 센다"로 제한.
  - 상세: target 의 §9.2 와 §8.1 은 chip 표시를 단일 신호로 불충분하다는 이유로 강제 3중 신호로 격상했다. 그러나 WebSocket 프로토콜 spec §4.4.6 의 "권장" 표현은 갱신되지 않아, 두 spec 문서가 동일 사안에 대해 서로 다른 강제 수준(권장 vs 강제)을 명시하고 있다. 구현자가 어느 spec 을 따라야 할지 모호하다.
  - 제안: `spec/5-system/6-websocket-protocol.md` §4.4.6 의 "대화 UI 표시는 `injected` 도 함께 보여주되, chip 으로 구분하는 것을 권장" 문구를 "대화 UI 표시는 conversation Thread spec §9.2 의 3중 강제 신호(아이콘·컨테이너·chip) 를 따른다 — 상세는 [Spec Conversation Thread §9.2](../conventions/conversation-thread.md#92-시각-구분-신호-3중-강제)" 로 갱신. 또는 본 target 의 §9.2 에 "WebSocket spec §4.4.6 도 함께 갱신 필요" 를 TODO 로 명기.

---

- **[WARNING]** `ai-thread-source-mark` 계획의 "잠정 결정" 번복: 새 Rationale 있으나 해당 plan 문서는 미갱신
  - target 위치: §8.1 Rationale "emit messages 를 conversation Preview 에서 격리한 이유", §9.3 D4 / §9.4 emit messages 노출 금지
  - 과거 결정 출처: `plan/in-progress/ai-thread-source-mark.md` Open Questions §83 — "injection 메시지를 UI conversation timeline 에 보여줄 것인지 vs 숨길 것인지. **잠정 결정**: 보여주되 turn 카운팅에서만 제외. inspector 에서 chip 으로 구분 표시는 추후 결정."
  - 상세: target §8.1 Rationale 이 이 잠정 결정을 "재검토"해 conversation Preview 의 1차 소스를 `conversationThread` snapshot 으로 교체하고 emit messages 는 debug 패널 전용으로 격리한다고 선언한다. 번복 Rationale 자체는 target 에 작성되어 있어 "결정의 무근거 번복"은 아니다. 그러나 `plan/in-progress/ai-thread-source-mark.md` Phase 3 의 구현 태스크 — "injection 메시지를 UI conversation timeline 에 보여줄 것인지" — 가 여전히 Open Question / 잠정 결정 상태로 남아 있어, 구현 단계에서 plan 과 spec 이 충돌한다.
  - 제안: `plan/in-progress/ai-thread-source-mark.md` Open Questions §83 항목을 "spec/conventions/conversation-thread.md §9.3-9.4 에서 확정: emit messages 는 conversation Preview 에서 숨기고 conversationThread snapshot 을 1차 소스로 사용"으로 갱신 후 체크박스를 닫거나 제거. Phase 3 의 해당 구현 태스크도 이 결정에 맞게 조정 필요.

---

- **[INFO]** §9 (미리보기 UI 렌더 규칙) 의 "강제" 표현이 convention 문서 범위를 넘어서는지 명확화 권장
  - target 위치: §9 전체, §9.1 "source 별 시각 매핑 (강제)", §9.2 "(3중 강제)"
  - 과거 결정 출처: `spec/conventions/conversation-thread.md` §8 "Rationale" 서두 — "설계 결정의 근거는 Spec AI Agent §12 Rationale 섹션에 단일 인라인 — ... 본 문서는 컨벤션의 단일 진실 공급원이며 동기·역사는 AI Agent 본문에 둔다."
  - 상세: `spec/conventions/` 하위 문서는 cross-cutting 규약을 정의한다. §9 의 UI 시각 구현 규칙(아이콘 글리프·bubble 모양·카드 full-width 등)은 convention 의 범위를 넘어 프론트엔드 컴포넌트 구현 세부에 가깝다. 이 범위를 본 convention 에 두는 근거(UI 규칙이 여러 UI 컨텍스트에 공통이라 convention 에 두었다)가 §8.1 에 암시되나 명시적이지 않다. 필수 위반은 아니나 향후 spec 범위 혼란을 줄이기 위한 보완을 권장한다.
  - 제안: §9 도입부에 "본 절은 모든 conversation 표시 UI 컴포넌트(AI Agent run-results · 실행 이력 · 기타 conversation timeline) 가 공통으로 따르는 시각 규약이다 — 단일 컴포넌트 구현이 아닌 cross-cutting UI contract" 한 문장 추가.

---

- **[INFO]** §9.3 "실행 이력 복원 view" 의 데이터 소스 경로가 §4 "영속화" 표와 참조 관계 불명확
  - target 위치: §9.3 표 세 번째 행 ("실행 이력 복원 view")
  - 과거 결정 출처: `spec/conventions/conversation-thread.md` §4 영속화 표 — "실행 후: NodeExecution 분산 저장 — `output.interaction` (presentation) / `output.messages` (AI 멀티턴) / `output.result.response` (AI 최종). thread 자체는 재구성 가능한 derived view"
  - 상세: §9.3 의 "두 경로를 합쳐 `conversationThread.turns` 와 동등한 view 를 재구성한다" 는 재구성 로직이 어떤 컴포넌트 / 서비스 의 책임인지 명시되지 않아, 구현자가 §4 의 SoT 분리와 연계해 어디서 재구성을 해야 하는지 파악이 어렵다.
  - 제안: §9.3 세 번째 행에 "(재구성 책임: `parseHistoryMessages` 또는 동등 converter — §9.5 strip 과 동일 진입점)" 주석 추가. 또는 §4 영속화 표에 "UI 복원 조합 규칙은 §9.3 참조" 역방향 링크 추가.

---

### 요약

target 문서(`spec/conventions/conversation-thread.md`)는 2026-05-18 구현 단계에서 발견된 사실(prompt injection 마커가 실제로 LLM-facing 의무로 존재하고 있었음)을 spec 에 반영하는 정정 작업으로, 핵심 번복 세 건 — (1) `[user-input]` 마커 "금지 → LLM-facing 의무", (2) chip 표시 "권장 → 3중 강제", (3) emit messages "타임라인 표시 → debug 패널 격리" — 모두 §8.1 Rationale 에 이유가 기술되어 있다. 그러나 (1)번의 경우 §1.2 `text` 필드 설명 문구("인라인 마커는 박지 않는다")가 §1.6 의 "LLM-facing 의무" 와 **동일 문서 내에서 직접 충돌**하는 CRITICAL 문제가 있다. (2)번은 `spec/5-system/6-websocket-protocol.md` §4.4.6 이 미갱신으로 두 spec 이 서로 다른 강제 수준을 명시한다. (3)번은 `plan/in-progress/ai-thread-source-mark.md` Open Questions 가 여전히 구 잠정 결정 상태라 구현자 혼동을 유발한다. Rationale 연속성 관점에서 명시 없이 과거 결정을 무시하거나 재도입하는 구조적 위반은 없으나, 문서 내 자기 충돌(§1.2 vs §1.6)과 연관 spec 미동기화(WebSocket §4.4.6)가 CRITICAL/WARNING 수준의 후속 조치를 요구한다.

### 위험도

MEDIUM
