# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/web-chat-ai-presentation-render.md` (구현 diff — `codebase/channel-web-chat/src/lib/presentation.ts` + `presentation.test.ts`)
검토 기준: `spec/4-nodes/6-presentation/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/7-channel-web-chat/1-widget-app.md` 및 관련 Rationale 절

---

## 발견사항

### [INFO] `classifyPresentation` 의 명시 `type` fast-path 는 spec 정합
- target 위치: `presentation.ts` `classifyPresentation()` — `typeof o.type === "string" && PRESENTATION_KINDS.has(...) && o.payload` 분기
- 과거 결정 출처: `spec/4-nodes/6-presentation/0-common.md §4` Principle 1.1.4 ("노드 판별용 `type: 'carousel' | ...` 래퍼는 사용하지 않는다")
- 상세: Principle 1.1.4 는 **노드 output 안에** `type` 판별자를 박지 말라는 규칙이다 (backend NodeExecution output 의 `output.view.type` 패턴 금지). `PresentationPayload` 의 top-level `type` 은 backend `render-tool-provider` 가 내려주는 별도 wire shape (`spec/4-nodes/3-ai/1-ai-agent.md §7.10`) 로, 노드 output schema 의 Principle 1.1.4 와 다른 레이어다. frontend widget 이 AI wire shape 를 판별하기 위해 명시 `type` 을 우선 사용하는 것은 spec §7.10 의 `PresentationPayload { type, toolCallId, renderedAt, payload }` 정의와 정합하며, 기각된 패턴의 재도입이 아니다.
- 제안: 현재 구현이 Principle 1.1.4 를 위반하지 않음을 명시하는 주석이 이미 코드에 존재함 (`presentation.ts` 파일 상단 주석). 별도 조치 불필요.

### [INFO] `asEnvelope()` — payload → config/output aliasing 해소 정책 Rationale 부재
- target 위치: `presentation.ts` `asEnvelope()` — `payload` 를 `config: { ...payload }, output: { ...payload }` 양쪽으로 shallow copy
- 과거 결정 출처: 직접적으로 이 패턴을 기각·채택한 spec Rationale 절은 없음
- 상세: AI `PresentationPayload.payload` 를 `config`/`output` 양쪽에 shallow copy 해 기존 `to*()` 함수가 두 출처를 탐색하는 로직을 그대로 재사용하는 설계다. 이 접근은 기존 to* 함수를 fork 하지 않고 두 wire shape 를 통일하는 합리적 방법이나, spec 의 어떤 Rationale 에도 "AI payload 를 config/output 양쪽으로 펼치는" 결정이 명시되어 있지 않다. 향후 `to*()` 로직이 config 에서만 읽어야 하는 값이 늘어나거나 output 에서만 읽어야 하는 값이 분기될 경우, aliasing 이 silent bug 원인이 될 수 있다.
- 제안: `presentation.ts` 상단 또는 `asEnvelope()` 함수 주석에 "AI payload 는 config·output 양쪽 필드를 쓸 수 있어 shallow copy 로 aliasing 없이 펼침" 결정을 1-2줄 Rationale 로 추가. spec 에 공식 Rationale 이 필요하면 `spec/7-channel-web-chat/1-widget-app.md` §Rationale 에 추가 항목 작성.

### [INFO] `toTemplate()` — `output.content` fallback 키 spec 미명시
- target 위치: `presentation.ts` `toTemplate()` — `output.rendered` 없으면 `output.content` 로 fallback
- 과거 결정 출처: `spec/4-nodes/6-presentation/5-template.md §5` `output.rendered` 가 단일 진실; `spec/4-nodes/3-ai/1-ai-agent.md §7.10` PresentationPayload 의 payload shape 는 "해당 presentation 노드 input schema 와 동일 shape (defaults overlay 후 최종값)"
- 상세: spec §7.10 은 `render_template` 의 payload 가 "해당 노드 input schema 와 동일 shape" 이라 명시하며, `templateNodeConfigSchema` 에는 `content` 필드가 없고 `config.template` + `output.rendered` 가 쌍이다. 그러나 테스트(`payload: { content: "**안내**", outputFormat: "markdown" }`)에서 AI 가 `content` 키로 본문을 emit 한다는 사실이 드러났다. 이 LLM 실제 동작과 spec §7.10 의 "input schema 동일 shape" 약속 사이에 gap 이 있다. 구현은 gap 을 client-side fallback 으로 조용히 메우고 있으나, spec 에 이 결정이 기록되지 않아 `content` fallback 이 의도된 규약인지 임시 workaround 인지 불분명하다.
- 제안: (a) `spec/4-nodes/3-ai/1-ai-agent.md §7.10` 또는 `spec/4-nodes/6-presentation/5-template.md §Rationale` 에 "render_template 의 LLM payload 는 `content` 키를 body 로 사용할 수 있으며, widget 은 `rendered` 우선 → `content` fallback 으로 처리한다" 는 결정을 명문화하거나, (b) backend `render-tool-provider` 에서 `content` → `rendered` 정규화를 수행해 widget 이 단일 키만 보도록 정리. 어느 방향이든 spec Rationale 갱신 권장.

### [INFO] `form` 타입을 `PRESENTATION_KINDS` 에서 제외 — spec 과 정합
- target 위치: `presentation.ts` `PRESENTATION_KINDS = new Set(["carousel", "table", "chart", "template"])` — `form` 제외
- 과거 결정 출처: `spec/4-nodes/6-presentation/0-common.md §10.6` "render_form 은 ... `waiting_for_input` 흐름으로 진입"; `spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii`
- 상세: spec 에서 `render_form` 은 display-only `presentations[]` 경로가 아니라 별도 `waiting_for_input` + `ai_form_render` 경로를 사용하므로 제외가 맞다. 기각·폐기 결정과 일치.
- 제안: 조치 불필요.

### [INFO] `itemButtons` 를 각 item 에 병합하는 동작 — spec 정합
- target 위치: `presentation.ts` `toCarousel()` — `itemButtons = asButtons(config.itemButtons)` 를 각 item.buttons 에 append
- 과거 결정 출처: `spec/4-nodes/6-presentation/1-carousel.md §1`, `spec/4-nodes/6-presentation/0-common.md §10` AI tool 모드에서도 동일 schema 적용
- 상세: AI render_carousel payload 의 `payload.itemButtons` 를 각 item 에 append 하는 것은 carousel 노드 동작(§4 step 4 "itemButtons 가 설정되어 있으면 모든 아이템에 동일 버튼 적용")과 일관된다. 과거 기각된 패턴이 아님.
- 제안: 조치 불필요.

---

## 요약

이번 구현 diff(`presentation.ts` 두 wire shape 통합)는 기존 spec Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하는 부분이 없다. `classifyPresentation` 의 명시 `type` fast-path 는 Principle 1.1.4 (노드 output 판별자 금지)와 다른 레이어(AI wire PresentationPayload)를 다루므로 충돌하지 않고, `form` 타입 제외·`itemButtons` 병합 동작도 spec 과 정합한다. 다만 두 가지 INFO 수준 gap 이 있다: (1) `asEnvelope()` 의 "payload → config/output 양쪽 shallow copy" 결정이 spec Rationale 에 미기록, (2) `toTemplate()` 의 `content` fallback 키가 spec §7.10 의 "input schema 동일 shape" 약속과 실제 LLM emit 사이의 gap 을 client-side 에서 조용히 메우고 있어 spec 갱신이 권장된다. 두 항목 모두 기능 correctness 를 위협하지 않는 문서 보완 수준이다.

---

## 위험도

LOW
