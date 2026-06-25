# Requirement Review — web-chat AI presentation render

Reviewed files:
- `codebase/channel-web-chat/src/lib/presentation.ts`
- `codebase/channel-web-chat/src/lib/presentation.test.ts`
- `plan/in-progress/web-chat-ai-presentation-render.md`

Related spec: `spec/7-channel-web-chat/1-widget-app.md §2`, `spec/4-nodes/3-ai/1-ai-agent.md §7.10`

---

## 발견사항

### **[INFO]** `itemButtons` 병합이 static 모드 standalone carousel 에도 적용됨 — spec 상 dynamic 전용이나 AI 경로에서는 의도된 동작

- 위치: `presentation.ts` `toCarousel`, 테스트 fixture `aiCarousel.payload.mode = "static"`
- 상세: `spec/4-nodes/6-presentation/1-carousel.md §1` 에서 `itemButtons` 는 `dynamic` 전용 필드(`dynamic 전용, 최대 5개`)로 정의한다. 그러나 `toCarousel` 의 `itemButtons = asButtons(config.itemButtons)` 는 mode 구분 없이 항상 병합한다. standalone carousel node(non-AI) 경로에서 static 모드 payload 에 `itemButtons` 가 있으면 의도치 않게 병합될 수 있다.
  - **AI `render_carousel` 경로**: `render-tool-provider.ts` 의 백엔드 semantic gate 가 `render_carousel` payload 의 `itemButtons` 를 허용한다(검증 코드에서 확인). AI carousel 에서 `itemButtons` 는 "모든 item 공통 액션 버튼" 의미로 쓰이므로 이 경로에서의 병합은 **의도된 동작**이다.
  - **standalone carousel node 경로**: `asEnvelope` 를 거치면 `config.itemButtons` 는 실제 node config 에서 온다. spec 상 dynamic 전용이지만, 코드가 mode 를 읽지 않아 static 모드에서도 병합이 일어날 수 있다. 단, standalone carousel 의 static 모드는 `config.items[].buttons` 에 버튼을 넣는 게 정석이므로 `itemButtons` 가 실제로 set 될 가능성이 낮다.
  - 제안: 현재 구현이 실용적으로 안전하므로 코드 변경 필요 없음.

### **[INFO]** `classifyPresentation({ type: "carousel" })` — payload 없는 type-only 객체는 null 분류

- 위치: `presentation.test.ts` 95행 테스트, `presentation.ts` `classifyPresentation`
- 상세: 테스트가 `{ type: "carousel" }` (payload 없음) 를 `null` 로 기대한다. 구현에서 `o.payload` 가 falsy 이면 fast-path 를 지나 shape 판별로 폴백하고, config/output 도 없어 null 을 반환한다. 의도된 동작이며 테스트가 이를 명시적으로 검증하고 있어 회귀 방어가 된다.

### **[INFO]** `toTemplate` — `output.rendered` 가 `output.content` 보다 우선하는 동작은 올바름

- 위치: `presentation.ts` `toTemplate` rendered 결정 로직
- 상세: 두 키가 동시에 존재하는 경우 `rendered` 를 우선 사용한다. `render-tool-provider.ts` 는 `content` 를 required field 로 검증하고 `rendered` 는 생성하지 않으므로 실제 AI path 에서는 `output.rendered` 가 undefined -> `content` 로 정상 폴백한다. standalone template node 경로는 `output.rendered` 를 생성하므로 기존 동작이 유지된다. 동작은 정확하다.

### **[INFO] [SPEC-DRIFT]** AI `render_template` payload 의 `content` 키 → 위젯 `rendered` 매핑이 spec 본문에 명시되지 않음

- 위치: `presentation.ts` `toTemplate` 주석 + `spec/4-nodes/3-ai/1-ai-agent.md §7.10`, `spec/4-nodes/6-presentation/0-common.md §10.2`
- 상세: `spec/4-nodes/3-ai/1-ai-agent.md §7.10` 의 `PresentationPayload` type 정의에서 `payload: object` 만 표기하고, template 의 경우 `content` 키를 사용해야 한다는 것은 백엔드 `render-tool-provider.ts` 의 semantic gate (case 'template': `payload.content`) 에만 구현되어 있다. `spec/7-channel-web-chat/1-widget-app.md §2` 의 presentation inline 렌더 행은 `(AI Agent §7.10)` 으로 크로스레퍼런스만 두고, `content` -> `rendered` 매핑 규칙을 명시하지 않는다. 위젯 코드가 `content` 키를 사용하는 근거는 코드 주석과 백엔드 구현에서만 추론 가능하다.
  - 이 코드 구현은 **합리적이고 의도적** (백엔드 semantic gate 와 정합). 코드 되돌리기가 오답.
  - 제안: 코드 유지 + spec 반영. `spec/4-nodes/3-ai/1-ai-agent.md §7.10` PresentationPayload type block 또는 `spec/4-nodes/6-presentation/0-common.md §10.2 도구 카탈로그` 의 `render_template` 행에 "`payload.content`: template HTML/Markdown 본문 문자열 (위젯은 이를 `rendered` 로 매핑)" 을 추가 권장. spec 갱신은 `project-planner` 경로.

### **[INFO]** 테스트에 `form` 타입 분류 제외 케이스가 없음

- 위치: `presentation.test.ts` PresentationPayload 테스트 블록
- 상세: `PRESENTATION_KINDS` 에 `form` 이 포함되지 않아 `{ type: "form", payload: {...} }` 는 null 이 된다. 이는 계획서("form 은 presentations[] 가 아닌 waiting_for_input 경로 → 4종 fast-path 에서 제외")에 명시된 의도적 설계다. 그러나 `classifyPresentation({ type: "form", toolCallId: "t", payload: {} }) === null` 케이스가 테스트에 없어, 향후 `form` 이 실수로 KINDS 에 추가되어도 감지되지 않는다.
  - 제안: `form` 타입이 분류에서 제외됨을 명시적으로 검증하는 테스트 케이스 추가 권장 (CRITICAL/WARNING은 아님).

---

## 요약

코드 변경은 `spec/7-channel-web-chat/1-widget-app.md §2` 의 "presentation(carousel/table/chart/template) inline 렌더 — `ai_message.presentations[]` — 전체 타입 inline 렌더(AI Agent §7.10)" 요구사항을 정확히 충족한다. `asEnvelope` 헬퍼가 두 shape(standalone `{config,output}` / AI PresentationPayload `{type,toolCallId,renderedAt,payload}`)를 통일된 인터페이스로 정규화하고, `classifyPresentation` 이 AI 명시 type 을 우선 판별한다. `toCarousel` 의 `itemButtons` 병합, `toTemplate` 의 `content` -> `rendered` 매핑 모두 백엔드 `render-tool-provider.ts` 의 semantic gate 와 정합하는 의도된 구현이다. 기존 `{config,output}` 경로의 회귀는 테스트에 의해 명시적으로 보호된다. `render_template` payload 의 `content` 키 매핑 규약이 위젯 면에서 spec 본문에 명시되지 않은 점이 [SPEC-DRIFT] 로 지적되나, 이는 코드 버그가 아니라 spec 갱신 누락이다. 전체적으로 기능 완전성, 에러 처리, 비즈니스 로직, 반환값 모두 요구사항을 만족한다.

## 위험도

LOW
