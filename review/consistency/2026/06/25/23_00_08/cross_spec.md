# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/web-chat-ai-presentation-render.md`
검토 모드: `--impl-prep` (구현 착수 전)
검토 일시: 2026-06-25

---

## 발견사항

### [WARNING] `classifyPresentation` "4종" 표현이 PresentationPayload 의 5종 type 과 불일치

- **target 위치**: plan §수정 항목 2 — `"p.type 이 4종이면 우선 반환(PresentationPayload 경로)"`
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §7.10` `PresentationPayload` type 정의
- **상세**: spec 에 정의된 `PresentationPayload.type` 은 `'table' | 'chart' | 'carousel' | 'template' | 'form'` 의 5종이다. plan 이 "4종"이라 서술한 것은 `form` 을 누락한 표현이다. `render_form` 은 interactive blocking 흐름이지만 `PresentationPayload` 구조 자체는 동일하며 `ai_assistant` ConversationTurn 의 `presentations[]` 에 push 된다 (`spec/conventions/conversation-thread.md §1.2` — `type: 'form'` payload 가 `ai_form_render` waiting 중인 경우 `pendingFormToolCall.toolCallId` 매칭 시 interactive DynamicFormUI, 그 외 FormSubmittedContent 로 렌더). 위젯도 `ai_message.presentations[]` 에서 `type: 'form'` 페이로드를 수신할 수 있으므로, `classifyPresentation` 이 fast-path 에서 `'form'` 을 제외하면 수신된 form payload 가 기존 envelope shape 판별 경로로 낙하해 미렌더(null) 될 수 있다.
- **제안**: plan 구현 시 `classifyPresentation` fast-path 를 5종(`'table'|'chart'|'carousel'|'template'|'form'`)으로 구현할 것. `type: 'form'` payload 의 위젯 처리 범위(interactive DynamicFormUI vs FormSubmittedContent 분기, `pendingFormToolCall` 상태 참조 여부)는 현 PR 범위 외로 두더라도, fast-path 에 5종을 포함해야 기존 envelope 경로로의 낙하 부작용을 막는다.

---

### [WARNING] `toTemplate` 의 `payload.content` 필드가 spec 에 정의되지 않음

- **target 위치**: plan §수정 항목 5 — `"AI template payload 는 content(노드는 rendered) → output.rendered ?? output.content fallback"`
- **충돌 대상**: `spec/4-nodes/6-presentation/5-template.md §5.3` — template 노드 출력 필드는 `output.rendered` 단일. `spec/4-nodes/6-presentation/0-common.md` §136 은 `output.content` 가 **폐기된 필드**임을 명시
- **상세**: AI `render_template` tool 의 payload 는 `templateNodeConfigSchema` (input schema 재사용 — `spec/4-nodes/6-presentation/0-common.md §10.1`) 기반으로 생성된다. input schema 의 주요 필드는 `template`(원본 문자열)이며, `rendered` 는 expression resolver 가 handler 실행 시 채우는 **output** 필드다. LLM 이 호출하는 tool 은 input schema 를 사용하므로 payload 에는 `template` 필드가 있고 `rendered` 나 `content` 는 없다. plan 이 전제하는 `payload.content` 는 어떤 현행 spec 에도 정의되어 있지 않으며 폐기된 초안 필드명이다.
- **제안**: `render_template` 의 실제 wire payload 를 backend `render-tool-provider.ts` 및 wire 캡처로 확인한 뒤 `toTemplate` 의 입력 field path 를 확정할 것. backend 가 payload 에 input schema 그대로(`template` 원본 문자열)를 전달한다면 위젯이 `payload.template` 을 사용해야 한다. plan 의 "실 wire 픽스처 기반" 테스트 케이스 의도와 일치하므로, 테스트 작성 전 wire 확인 후 spec 에 AI tool mode payload 의 template 필드 mapping 을 명시하거나 코드 주석으로 근거를 남길 것.

---

### [INFO] `asEnvelope` 의 `{ config: payload, output: payload }` 동봉 — config/output 의미론 혼용

- **target 위치**: plan §수정 항목 1 — `"{ config: payload, output: payload }"`
- **충돌 대상**: `spec/4-nodes/6-presentation/0-common.md` Principle 1 — config 는 설정값, output 은 런타임 생성값
- **상세**: AI `render_*` tool payload 는 input schema shape 이므로 config 에 가깝다. payload 를 `config` 와 `output` 양쪽에 동일하게 매핑하는 것은 의미론적으로 이질적이다. 현재 `to*` 함수가 양쪽에서 어떤 필드를 읽는지에 따라 이 동봉이 올바를 수도 있으나, 향후 `to*` 함수가 config/output 구분을 강화하면 혼동 가능성이 있다.
- **제안**: `to*` 함수의 실제 필드 접근 경로를 확인해 최소한으로 필요한 쪽에만 매핑하는 방향을 검토한다. 현재 단계에서는 기능 정합성에 영향이 없으므로 INFO 수준.

---

### [INFO] AI `render_*` 버튼 클릭 시 `submit_message` 발화 책임이 위젯에서 명시되지 않음

- **target 위치**: plan §주의 — `"asButtons 가 userMessage 를 drop 하는 것은 의도(위젯은 buttonId 만 전송, 백엔드 resolve)"`
- **충돌 대상**: `spec/4-nodes/6-presentation/0-common.md §10.8` — port-type 버튼 클릭 후 `userMessage` 합성은 frontend `AssistantPresentationsBlock.handlePortButtonClick` 의 책임
- **상세**: spec §10.8 에서 AI `render_*` tool mode 의 port-type 버튼 클릭은 `submit_message`(text) 로 변환되어 다음 LLM turn 의 user 메시지가 된다(`userMessage ?? per-item fallback ?? global fallback ?? buttonId` 우선순위). 위젯이 `click_button {nodeId, buttonId}` 만 보낸다면 EIA 표면에서 백엔드가 이를 AI Agent multi-turn 의 `submit_message` 로 처리하는 경로가 별도 존재해야 한다. 현재 plan 과 spec 어느 쪽도 이 위젯-전용 경로를 명시하지 않는다.
- **제안**: AI `render_*` presentation 의 port-type 버튼 클릭 시 위젯이 `click_button` 을 쓰는지 `submit_message` 를 쓰는지, 혹은 백엔드가 `click_button` 을 AI turn 으로 해석하는지를 plan 또는 주석으로 명시할 것. 이번 PR 범위가 렌더만이라면 명시적으로 버튼 클릭 흐름은 기존 구현 그대로임을 기록한다.

---

## 요약

target plan 은 위젯 SPA 의 AI `render_*` PresentationPayload 미렌더 버그를 수정하는 widget-only 수정으로, AI Agent §7.10 / conversation-thread §1.2 / 1-widget-app §2 spec 계약을 충족하는 방향이며 전반적으로 spec 충돌 위험이 낮다. 주요 WARNING 은 두 가지다: (1) plan 이 "4종" fast-path 를 서술하지만 `PresentationPayload.type` 은 5종(`form` 포함)이므로 구현 시 fast-path 를 5종으로 확장해야 하며, (2) `toTemplate` 의 `payload.content` 필드는 spec 에 없는(폐기된) 필드로 wire 확인이 선행되어야 한다. 두 WARNING 모두 구현 착수 전 해소 가능하며 두 spec 중 하나가 작동 불가해지는 CRITICAL 수준은 아니다.

## 위험도

MEDIUM
