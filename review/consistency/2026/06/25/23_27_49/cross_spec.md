# Cross-Spec 일관성 검토 결과

**검토 대상**: `plan/in-progress/web-chat-ai-presentation-render.md` (구현 완료 후 --impl-done)
**변경 범위**: `codebase/channel-web-chat/src/lib/presentation.ts` + `presentation.test.ts`
**검토 기준일**: 2026-06-25

---

## 발견사항

### [WARNING] `render_template` 의 body 필드명 — spec §10.1 vs 실제 backend 구현 불일치

- **target 위치**: `codebase/channel-web-chat/src/lib/presentation.ts` `toTemplate()` 함수 — `output.content` fallback 추가 (diff ~289행)
- **충돌 대상**: `spec/4-nodes/6-presentation/0-common.md §10.1` ("Schema 단일 진실") — "`render_template` | Template | `templateNodeConfigSchema` (zod) → JSON Schema"
- **상세**:
  - `spec/4-nodes/6-presentation/0-common.md §10.1` 은 `render_template` 의 parameter JSON Schema 출처가 `templateNodeConfigSchema` 라고 명시한다.
  - `templateNodeConfigSchema` (`codebase/backend/src/nodes/presentation/template/template.schema.ts:97`) 는 본문 필드를 `template: z.string()` 으로 정의하며, `content` 필드는 없다.
  - 그러나 실제 `render-tool-provider.ts` (`case 'template'`) 는 `payload.content` 를 필수 검증 대상으로 사용하고, DEFAULT_DESCRIPTIONS 에도 "content (HTML/Markdown 본문 문자열) 가 필수" 라고 명시한다.
  - LLM 은 `content` 키를 사용해 페이로드를 emit 하며, 위젯의 `toTemplate()` 도 `output.content` fallback 을 필요로 한다.
  - spec §10.1 은 `render_template` 이 `templateNodeConfigSchema` 를 그대로 사용한다고 선언하지만, 실제로는 `content` 필드를 직접 validate 하는 별도 검증 로직이 존재한다. spec 문서와 구현 사이에 명시적 divergence 가 있다.
  - 위젯의 `toTemplate()` 구현은 이 divergence 에 올바르게 대응하고 있으나, spec 이 `content` 필드를 전혀 언급하지 않아 다른 소비자(예: execution history page, 후속 개발자)가 `template` 키를 기대하는 혼동이 생길 수 있다.
- **제안**:
  - `spec/4-nodes/6-presentation/0-common.md §10.1` 또는 `spec/4-nodes/3-ai/1-ai-agent.md §7.10` 에 render_template AI tool 은 `templateNodeConfigSchema` 를 베이스로 하되 **body 필드명이 `content` 로 재매핑**됨을 명시한다.
  - 또는 `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` 의 `case 'template'` validate 와 DEFAULT_DESCRIPTIONS 를 `payload.template` 으로 변경해 schema 와 일치시킨다 (기존 LLM prompt/SSE 캡처와 호환성 검토 필요).

---

### [INFO] `form` 타입의 `classifyPresentation` fast-path 제외 — spec 과 정합하나 PresentationPayload type 선언이 모호

- **target 위치**: `codebase/channel-web-chat/src/lib/presentation.ts` `PRESENTATION_KINDS` Set (`["carousel", "table", "chart", "template"]`, form 제외)
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §7.10` PresentationPayload type — `type: 'table' | 'chart' | 'carousel' | 'template' | 'form'` (5종)
- **상세**:
  - spec 의 PresentationPayload type 정의는 `form` 을 포함한 5종을 나열한다.
  - 구현은 `PRESENTATION_KINDS` 에서 `form` 을 제외하고, 코드 주석으로 그 이유(form 은 waiting_for_input(ai_form_render) 경로)를 설명한다.
  - 이는 `spec/4-nodes/6-presentation/0-common.md §10.6` ("render_form — interactive (blocking)") 및 `spec/7-channel-web-chat/1-widget-app.md §2` (form 은 `waiting_for_input.formConfig` 경로)와 일치한다. 동작은 정합.
  - 그러나 `spec/4-nodes/3-ai/1-ai-agent.md §7.10` PresentationPayload type block 이 `form` 을 5종에 포함하여 위젯 소비자가 form 을 presentations[] inline 으로 렌더해야 한다고 오해할 수 있다.
- **제안**:
  - `spec/4-nodes/3-ai/1-ai-agent.md §7.10` PresentationPayload type 정의에 `form` 은 presentations[] inline 렌더 대상이 아니라 `waiting_for_input` 별도 경로임을 보충 설명. 현재 동작에 문제는 없음.

---

### [INFO] `asEnvelope` — payload 전체를 config·output 양쪽에 복사 (spec Principle 1.1 경계 내 소비 계층 정규화)

- **target 위치**: `codebase/channel-web-chat/src/lib/presentation.ts` `asEnvelope()` 함수 (diff ~200행)
- **충돌 대상**: `spec/4-nodes/6-presentation/0-common.md §7` — "config: 리터럴 설정값 / output: 런타임 생성값만 (Principle 1.1)"
- **상세**:
  - spec Principle 1.1 은 config 와 output 의 역할을 엄격히 분리한다.
  - `asEnvelope()` 는 AI render_* payload 를 config·output 양쪽에 동일하게 shallow-copy 해 to* 함수들이 두 곳을 모두 탐색하도록 한다.
  - 위젯은 생성 side 가 아니라 소비 side 라 출력 계약(backend 책임)과 분리된 내부 정규화이므로 spec 위반이 아니다. backend 는 이미 올바른 envelope 또는 PresentationPayload 를 생성하고 있다.
  - spec 에 이 패턴을 명시적으로 허용한다는 기술이 없어 구현 근거가 문서화되지 않은 상태다.
- **제안**:
  - `spec/7-channel-web-chat/1-widget-app.md §2` 또는 presentation.ts 모듈 헤더에 "두 shape 를 내부 정규화" 한다는 한 줄 설명을 추가하면 자기완결적이 된다. 실제 충돌 없음.

---

### [INFO] `itemButtons` 가 AI carousel payload 에서 `config.itemButtons` 로 취급됨 — 동작 정합, spec 주석 보충 권장

- **target 위치**: `codebase/channel-web-chat/src/lib/presentation.ts` `toCarousel()` — `config.itemButtons` 읽기 (diff ~237행)
- **충돌 대상**: `spec/4-nodes/6-presentation/1-carousel.md §1` — `itemButtons` 는 dynamic 전용 config 필드로 정의
- **상세**:
  - carousel spec 은 `itemButtons` 를 dynamic 모드 전용 config 필드로 정의한다.
  - AI `render_carousel` 은 `mode: "static"` + `itemButtons` 조합으로 emit 할 수 있으며 (테스트에서 확인), `asEnvelope` 가 payload 를 config 양쪽에 복사하므로 `config.itemButtons` 에서 읽을 수 있다.
  - `spec/4-nodes/3-ai/1-ai-agent.md §4.1` DEFAULT_DESCRIPTIONS 는 이미 "mode=dynamic 은 데이터 바인딩 워크플로 전용이라 LLM 직접 호출에는 사용 금지" 를 명시해 AI tool 에서 static + items 직접 제공 패턴을 강제한다. static 모드에서의 itemButtons 공유 버튼은 의미론적으로 합당하다.
- **제안**:
  - `spec/4-nodes/6-presentation/1-carousel.md §1` 에 "AI render_carousel 에서는 mode=static + itemButtons 조합이 허용됨" 한 줄 보충. 동작 자체는 정합.

---

## 요약

이번 변경(`presentation.ts` + 테스트)은 `asEnvelope()` 도입으로 standalone 노드 envelope (`{ config, output }`)와 AI `render_*` PresentationPayload(`{ type, toolCallId, renderedAt, payload }`) 를 하나의 코드 경로로 통일한 것이 핵심이다. 스펙과의 실질적 정합성은 전반적으로 양호하나, **render_template 의 body 필드명이 spec 문서에서는 `templateNodeConfigSchema` 의 `template` 이라고 선언됐지만 실제 backend 구현(`render-tool-provider.ts`)은 `content` 를 사용**하는 WARNING 급 불일치가 존재한다. 이 divergence 는 위젯의 `output.content` fallback 이 필요한 근본 이유이며, spec 갱신 또는 backend 정렬 중 하나로 해소해야 한다. 나머지 INFO 항목들은 동작 정합이나 spec 문서 보충이 권장되는 수준이다.

---

## 위험도

LOW
