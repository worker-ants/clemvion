# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
Target: `plan/in-progress/web-chat-ai-presentation-render.md`

---

## 발견사항

발견사항 없음.

Target 문서는 기존 spec Rationale 에서 기각·폐기된 대안을 재도입하지 않으며, 합의된 설계 원칙을 위반하지 않는다.

구체적으로 확인한 항목:

1. **PresentationPayload 두 shape 처리 — 위젯 측 구현**
   - target 은 위젯의 `classifyPresentation` 이 `PresentationPayload { type, toolCallId, renderedAt, payload }` shape 를 처리하지 못하는 버그를 수정한다.
   - `spec/4-nodes/3-ai/1-ai-agent.md §7.10` 의 Rationale 은 이 shape 를 ConversationTurn top-level `presentations[]` 의 단일 운반 경로로 채택했다고 명시한다. target 은 이 결정을 번복하지 않고 위젯이 해당 계약을 충족하도록 수정하는 것이다.
   - chat-channel(텔레그램)이 이미 `renderPresentationPayload` 로 `.type`+`.payload` 를 처리하고 있으므로 target 의 접근은 기존 채널 구현과 정합한다.

2. **`asEnvelope(p)` 헬퍼 신설 — 백엔드 정규화 X 원칙과의 정합**
   - target 은 "백엔드 정규화 X" 를 명시한다. 기존 Rationale 어디에도 "위젯 내부 shape 변환을 금지한다" 는 결정이 없으며, 채널별 어댑터가 PresentationPayload 를 처리하는 것은 기존 패턴(chat-channel 측 `renderPresentationPayload`) 과 정합한다.
   - `asEnvelope` 는 `payload → { config, output }` 로 내부 변환하는 위젯-internal 헬퍼이므로 백엔드 계약(PresentationPayload shape) 을 변경하지 않는다.

3. **`toCarousel` 의 `itemButtons` 병합**
   - `spec/4-nodes/6-presentation/0-common.md §Rationale` 는 `itemButtons` (carousel 전역 버튼) 가 각 item 에 공통으로 적용된다는 설계를 명시한다. 이를 각 item.buttons 에 병합하는 것은 spec 합의와 일치한다.

4. **`toTemplate` 의 `content` fallback**
   - AI `render_template` payload 는 `content` 필드를 쓰고, 노드는 `rendered` 를 쓴다. `output.rendered ?? output.content` fallback 을 두는 것은 spec §7.10 의 "payload 는 해당 presentation 노드 input schema 와 동일 shape" 계약과 실제 wire shape 의 차이를 처리하는 방어 코드다. 기각된 대안 재도입이 아니다.

5. **spec 변경 없음 선언**
   - target 은 "변경 없음 — 기존 계약 충족하는 버그 수정" 으로 명시했다. 기존 widget-app Rationale (R4/R5/R6) 및 AI Agent §12.4 Presentation Tool Family Rationale 을 번복하는 내용이 없다.

6. **`userMessage` drop 유지**
   - target 의 "asButtons 가 userMessage 를 drop 하는 것은 의도" 주석은 `spec/4-nodes/6-presentation/0-common.md §10.8` 의 "위젯은 buttonId 만 전송, 백엔드 resolve" 결정과 일치한다. userMessage 를 위젯 전송에 포함하지 않는 것은 기각된 대안이 아니라 합의된 설계다.

---

## 요약

`plan/in-progress/web-chat-ai-presentation-render.md` 는 기존 spec Rationale 의 합의된 결정 — PresentationPayload 의 ConversationTurn top-level `presentations[]` 단일 운반 경로, 채널 어댑터가 shape 를 처리하는 패턴, userMessage drop 정책, itemButtons 전역 병합 — 과 완전히 정합하는 버그 수정 계획이다. 기각된 대안을 재도입하거나 Rationale 에 박힌 invariant 를 우회하는 설계 요소가 없다.

---

## 위험도

NONE
