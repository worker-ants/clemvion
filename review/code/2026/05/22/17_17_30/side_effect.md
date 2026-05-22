# 부작용(Side Effect) 리뷰 결과

## 발견사항

### 1. `jsonSchemaCache` — 모듈 레벨 가변 전역 상태 (공유 캐시)

- **[WARNING]** `render-tool-provider.ts` 에 `jsonSchemaCache: Partial<Record<PresentationType, ...>>` 가 모듈 스코프 변수로 선언되어 있다.
  - 위치: `/codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` — `const jsonSchemaCache: Partial<...> = {}`
  - 상세: 이 캐시는 프로세스 전체에서 공유된다. NestJS 환경에서 서버가 재시작되기 전까지 캐시 내용이 유지되는 것은 의도된 동작이다. 그러나 테스트 환경에서 테스트 간 격리가 필요한 경우(예: 특정 타입의 zod schema 를 mock 으로 교체하는 테스트) 캐시가 이전 테스트 결과를 보유하고 있어 다음 테스트에 영향을 줄 수 있다. 현재 제공된 테스트 코드에서는 캐시를 직접 다루지 않으므로 실제 문제로 이어지지는 않지만, schema 변경을 모의하는 테스트가 추가될 경우 잠재적 오염 경로가 된다.
  - 제안: 테스트 격리가 필요한 경우 `RenderToolProvider` 인스턴스 내부로 캐시를 이동(인스턴스 멤버 `#schemaCache`)하거나, 현재 설계를 유지하면서 테스트 파일에 `beforeEach(() => { Object.keys(jsonSchemaCache).forEach(k => delete jsonSchemaCache[k]); })` 패턴을 명시한다.

---

### 2. `pushAiThreadTurn` 시그니처 변경 — 기존 호출자 영향

- **[WARNING]** `ai-agent.handler.ts` 의 `pushAiThreadTurn` 메서드에 세 번째(`toolCalls?`) 와 네 번째 (`presentations?`) 파라미터가 추가되었다.
  - 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `pushAiThreadTurn(target, nodeRef, source, content, toolCalls?, presentations?)`
  - 상세: 이 메서드의 두 호출 지점(단일턴 종료 push, 다중턴 조건 분기 push)에서 `undefined`를 명시적으로 전달하는 코드가 추가되었다(`undefined, presentationPayloads...`). 새로운 파라미터는 optional 이므로 TypeScript 컴파일 수준에서는 문제없다. 그러나 해당 메서드가 `private`이 아닌 경우 외부에서 3-인자 형태로 호출하는 코드가 있다면 silent 누락이 발생한다. diff 를 보면 이 메서드는 private 에 준하는 핸들러 내부 헬퍼로 사용되고 있어 외부 노출은 없는 것으로 보이며, 모든 호출 지점이 동일 파일 내에서 업데이트되어 있다.
  - 제안: 특별한 조치는 불필요하지만, 메서드에 `private` 접근자가 없다면 추가하여 외부 호출 경로가 생기지 않도록 명시한다.

---

### 3. `executeProviderToolBatch` 반환 타입 변경 — 호출자 영향

- **[INFO]** `executeProviderToolBatch` 의 반환 타입이 `{ executedCount: number }` 에서 `{ executedCount: number; blockingFormRender?: {...} }` 로 확장되었다.
  - 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
  - 상세: 반환 타입이 확장되었으나 additive 변경이다. 단일 turnloop 와 다중 turnloop 두 호출 지점 모두 `blockingFormRender` 를 구조 분해로 수신하도록 업데이트되었다. 단일턴 경로는 `blockingFormRender` 를 사용하지 않고 다중턴 경로에서는 수신 후 phase 2b 미완 처리로 schema violation 으로 기록하고 있다. 기존 호출자가 `{ executedCount }` 만 사용하는 코드가 남아있었다면 문제가 없다(기존 프로퍼티는 유지).
  - 제안: 없음 (이미 양쪽 호출 지점이 업데이트됨).

---

### 4. `_resumeState` 에 `presentationTools` 필드 추가 — 직렬화 영향

- **[WARNING]** 다중턴 `_resumeState` 직렬화에 `presentationTools: state.presentationTools ?? []` 가 추가되었다.
  - 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — 약 라인 1394, 1554
  - 상세: `_resumeState` 는 DB 에 직렬화·저장되어 resume 시 복원된다. 이 변경으로 인해 **해당 필드가 추가되기 이전에 생성된 실행(in-flight execution)** 의 `_resumeState` 에는 `presentationTools` 가 존재하지 않는다. `state.presentationTools ?? []` 의 `?? []` 폴백이 이 케이스를 처리하므로 실제 runtime error 는 발생하지 않는다. 또한 `presentationTools` 배열이 클 경우(여러 노드, 큰 `defaults` 객체 포함) resume state 크기가 늘어날 수 있다.
  - 제안: 현재 폴백 처리가 적절하다. 대용량 `defaults` 객체가 허용될 경우 state size 에 대한 상한 검증을 추가하는 것을 고려한다.

---

### 5. `AgentToolResult` 인터페이스 확장 — 기존 구현체 영향

- **[INFO]** `agent-tool-provider.interface.ts` 에 `presentationPayload`, `blockingFormRender`, `presentationSchemaViolation`, `presentationCall` 네 개의 optional 필드가 추가되었다.
  - 위치: `/codebase/backend/src/nodes/ai/ai-agent/tool-providers/agent-tool-provider.interface.ts`
  - 상세: 모두 `optional` 필드이므로 `KbToolProvider`, `McpToolProvider`, `Cafe24McpToolProvider` 등 기존 구현체는 수정 없이 컴파일된다. 기존 구현체가 이 필드들을 반환하지 않아도 `undefined` 로 처리되어 아무 부작용이 없다.
  - 제안: 없음 (additive-only 변경).

---

### 6. `presentation-renderers.tsx` 에서 함수 visibility 변경 — 번들 영향

- **[INFO]** `TableContent`, `CarouselContent`, `ChartContent`, `TemplateContent`, `FormSubmittedContent` 다섯 함수가 `function` 에서 `export function` 으로 변경되었다.
  - 위치: `/codebase/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx`
  - 상세: 이 파일이 이미 다른 위치에서 named export 로 사용되고 있었다면 이 변경은 아무 부작용이 없다(기존 코드는 컴파일 에러 없이 통과). 새로 export 된 함수들이 트리쉐이킹을 통과하는 방식은 기존과 동일하므로 번들 크기 증가는 미미하다. 다만 이 함수들은 이전에 내부 구현 세부 사항으로 숨겨져 있었으므로, 이제 외부에서 직접 사용 가능해짐으로써 향후 리팩토링 시 인터페이스 의존성이 생긴다.
  - 제안: 이 컴포넌트들이 공개 API 로 의도된 것이 맞다면(두 파일에서 이미 import 중임) 현재 변경이 적절하다.

---

### 7. `execution-store.ts` 의 re-export 패턴 — 잠재적 순환 import

- **[INFO]** `execution-store.ts` 가 `conversation-utils.ts` 의 타입을 re-export 하면서 동시에 `import type { PresentationPayload }` 로 소비하고 있다.
  - 위치: `/codebase/frontend/src/lib/stores/execution-store.ts` — `export type { PresentationType, PresentationPayload, PresentationPayloadTruncation } from "@/lib/conversation/conversation-utils"`
  - 상세: `execution-store.ts` 가 `PresentationPayload` 타입을 `conversation-utils.ts` 에서 가져와서 그대로 re-export 하는 구조다. 주석에 "legacy imports resolve here" 라고 명시되어 있으나, 현재 `assistant-presentations-block.tsx` 는 이미 `@/lib/conversation/conversation-utils` 에서 직접 import 하고 있어 re-export 가 실제로 필요한지 불명확하다. `execution-store.ts` 를 import 하는 파일 중 `PresentationPayload` 를 `execution-store` 경유로 사용하는 코드가 없다면 해당 re-export 는 불필요한 indirection 이다.
  - 제안: 실제로 `execution-store` 경유 `PresentationPayload` import 를 사용하는 코드가 없다면 re-export 를 제거하고 직접 `conversation-utils` 에서 import 하도록 통일한다.

---

### 8. `render_form` blocking 미완 처리 — 의도된 side effect 기록

- **[WARNING]** 다중턴 경로에서 `blockingFormRender` 신호 수신 시 `logger.warn` 을 발화하고 `presentationSchemaViolations` 에 push 하는 임시 처리가 있다.
  - 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — 약 라인 1715–1729
  - 상세: `render_form` blocking 흐름이 phase 2b 로 미뤄졌으므로, 현재는 LLM 이 `render_form` 을 호출하면 warning 로그가 서버에 기록되고 `presentationSchemaViolations` 에 false-positive 가 남는다. 이 violation 기록은 실제 schema 오류가 아니므로 "phase 2b pending" 이라는 원인이 violations 배열에 노출된다. 클라이언트가 이 violations 를 화면에 표시한다면 사용자에게 혼선을 줄 수 있다.
  - 제안: `meta.presentationSchemaViolations` 의 표면 위치(클라이언트 화면 노출 여부)를 확인한다. spec 에 따르면 이 필드는 디버그 메타이므로 사용자 노출이 없다면 현재 처리가 허용 가능하다. phase 2b 구현 전까지는 `issues` 배열에 `'render_form blocking flow pending phase 2b'` 같은 내부 키워드로 노출이 제한됨을 보장하는 것이 좋다.

---

### 9. `ConversationItem` 인터페이스 확장 — 직렬화 계약 변경

- **[INFO]** `ConversationItem` 에 `presentations?: PresentationPayload[]` 필드가 추가되었다.
  - 위치: `/codebase/frontend/src/lib/stores/execution-store.ts`
  - 상세: 이 인터페이스는 클라이언트 메모리 상태를 정의하는 타입으로, 서버 WebSocket 이벤트에서 채워진다. WebSocket 이벤트 payload 에도 `presentations` 필드가 추가되었으므로(`spec/5-system/6-websocket-protocol.md` 갱신 확인됨) 프로토콜 일관성은 유지된다. 기존 이벤트를 소비하는 다른 컴포넌트가 `ConversationItem` 의 새 필드를 알지 못해도 optional 이므로 런타임 오류는 없다.
  - 제안: 없음 (additive optional 변경).

---

## 요약

본 변경은 AI Agent 에 `render_*` presentation tool family 를 도입하는 대규모 기능 추가이다. 부작용 관점의 핵심 위험은 두 가지다. 첫째, `render-tool-provider.ts` 의 모듈 레벨 `jsonSchemaCache` 가 프로세스 공유 가변 상태로 존재하여 테스트 격리 문제를 유발할 수 있으나, 현재 운영 코드에서는 의도된 캐싱이다. 둘째, `_resumeState` 에 `presentationTools` 배열이 추가됨으로써 in-flight execution 의 resume state 크기가 증가하고, 대용량 `defaults` 객체가 허용될 경우 DB 직렬화 부담이 커질 수 있다 — `?? []` 폴백으로 하위 호환은 보장된다. 인터페이스 확장들은 모두 optional 필드 추가이므로 기존 호출자에 영향이 없다. `render_form` blocking 의 phase 2b 미완 처리에서 false-positive violation 기록이 발생하지만, 이는 내부 디버그 메타에 한정되어 사용자 노출은 없다.

---

## 위험도

**LOW**

> 전역 캐시와 resume state 직렬화 크기 증가가 구조적 side effect 로 존재하나, 현재 코드의 폴백 처리와 캐시 동작이 의도된 설계 범위 안에 있으며 CRITICAL/HIGH 수준의 즉각적 부작용은 없다.
