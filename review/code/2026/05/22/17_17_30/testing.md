# 테스트(Testing) 코드 리뷰 결과

**대상**: AI Agent `render_*` presentation tool family 구현 (파일 1–21)
**검토 일시**: 2026-05-22

---

## 발견사항

### [WARNING] ai-agent.handler.spec.ts — `render_*` 디스패치 경로 전혀 미커버
- **위치**: `/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts`
- **상세**: 핸들러 본문 약 2,361 라인 중 `render_*` 관련 누적·분기 로직(725–810행 부근, 900–1300행 부근)에 대한 테스트가 단 한 건도 없다. 구체적으로:
  - LLM 이 `render_table` toolCall 을 반환했을 때 `presentationPayloads[]` 에 누적되어 `appendAiAssistantMessage` 의 `presentations` 인자로 전달되는 경로
  - `render_form` blocking 신호(`blockingFormRender`)가 단일 턴에서 silent-drop 되는 경로
  - 복수 `render_*` 호출이 동시에 배치 실행될 때 각각 누적되는 경로
  - 스키마 위반 retry 1회 후 silent drop 되어 `meta.presentationSchemaViolations` 에 기록되는 전체 retry 흐름
- **제안**: 핸들러 spec 에 다음 케이스를 추가해야 한다.
  ```ts
  it('LLM render_table 호출 → presentationPayload 가 ai_assistant turn 에 부착', ...)
  it('render_form in single_turn → silent drop, blockingFormRender 미설정', ...)
  it('schema 위반 2회 → presentationSchemaViolations 누적 후 텍스트만 출력', ...)
  ```

---

### [WARNING] conversation-thread.service.spec.ts — appendAiAssistantMessage 의 presentations 파라미터 미테스트
- **위치**: `/codebase/backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.spec.ts` (139행 `appendAiUserMessage / appendAiAssistantMessage` describe 블록)
- **상세**: `appendAiAssistantMessage` 에 새로 추가된 `presentations?: PresentationPayload[]` 파라미터를 검증하는 테스트가 없다. 특히:
  - `presentations` 배열을 전달했을 때 `turn.presentations` 가 그대로 보존되는지
  - 빈 배열(`[]`)을 전달했을 때 `turn.presentations` 가 `undefined` 로 저장되는지 (구현은 `length > 0` 조건으로 필터)
  - `undefined` 를 전달했을 때 `turn.presentations` 가 누락되는지
- **제안**: 기존 'pushes ai_assistant turn with toolCalls preserved' 케이스 옆에 presentations 관련 3가지 케이스를 추가한다.

---

### [WARNING] conversation-inspector.test.tsx — AssistantPresentationsBlock 렌더 경로 미커버
- **위치**: `/codebase/frontend/src/components/editor/run-results/__tests__/conversation-inspector.test.tsx`
- **상세**: `SummaryView` 와 `SelectedItemDetail` 두 곳에 `AssistantPresentationsBlock` 이 추가되었으나 이를 검증하는 테스트가 전혀 없다. 프론트엔드 전체 코드베이스에서 `AssistantPresentationsBlock` 또는 `assistant-presentations-block` 를 임포트하거나 언급하는 테스트 파일이 존재하지 않는다.
  - `presentations.length > 0` 일 때 블록이 렌더되는지
  - `presentations` 가 없을 때 `(empty)` fallback 이 올바르게 표시되는지 (`!hasContent && !hasAssistantToolCalls && !item.presentations?.length` 조건 변경)
  - truncation 뱃지 노출 여부
- **제안**: `conversation-inspector.test.tsx` 에 `assistant` 타입 아이템에 `presentations` 배열을 담아 렌더 후 특정 UI 요소를 검증하는 케이스를 추가한다. 또는 별도의 `assistant-presentations-block.test.tsx` 단위 테스트를 신설한다.

---

### [WARNING] overlayDefaults — null 입력에 대한 엣지 케이스 미테스트
- **위치**: `/codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.spec.ts` (overlayDefaults describe 블록, 443–472행)
- **상세**: 현재 테스트는 `undefined`, 배열, 객체, 프리미티브 케이스를 커버하지만, `null` 입력 조합이 누락되어 있다.
  - `overlayDefaults(null, { key: 'v' })` → 구현은 `llmPayload !== null` 체크로 인해 defaults 를 반환하지 않고 primitive 경로로 빠져나간다 (`return defaults` → `{key:'v'}` 반환). 이 동작이 의도적인지 검증이 필요하다.
  - `overlayDefaults({ a: 1 }, null)` → defaults 가 `null` 이면 `typeof defaults === 'object' && defaults !== null` 조건 실패로 primitive 경로 진입, `null` 이 반환된다. LLM 값이 완전히 사라지는 의도치 않은 결과.
- **제안**: null 입력 케이스 2가지를 `overlayDefaults` describe 블록에 추가하고, 의도된 동작인지 JSDoc 에 명시한다.

---

### [WARNING] render-tool-provider.spec.ts — chart/template 1MB cap 초과 시 schema_violation 처리 미테스트
- **위치**: `/codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.spec.ts`
- **상세**: 기존 테스트는 `render_table` 의 row truncation(tail 잘라내기)만 검증한다. `render_chart` 와 `render_template` 은 1MB 초과 시 truncatable 배열이 없어 `schema_violation`으로 처리되는 다른 경로를 밟지만 이를 커버하는 테스트가 없다. 구현 분기(`type === 'chart' || type === 'template' || type === 'form'`)가 별도 경로이므로 독립 테스트가 필요하다.
- **제안**: 1MB를 초과하는 chart payload 를 넘겼을 때 `status: 'error'`, `presentationCall.status === 'schema_violation'` 이 반환되는 케이스를 추가한다.

---

### [INFO] render-tool-provider.spec.ts — render_form 의 multi_turn 미지정(mode 기본값) 케이스 미테스트
- **위치**: `/codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.spec.ts` (630–675행)
- **상세**: `render_form` 테스트는 `mode: 'multi_turn'` 명시 케이스와 `mode: 'single_turn'` 케이스만 있다. `mode` 가 아예 없는 경우(기본값 경로)에도 single_turn 으로 처리되는지(`(ctx.config.mode as string | undefined) === 'single_turn'` 표현식은 미지정 시 false를 반환 → multi_turn 취급) 확인하는 테스트가 없다.
- **제안**: `config: { presentationTools: [{ type: 'form' }] }` 에서 `mode` 없이 `render_form` 호출 시 `blockingFormRender` 가 설정되는지(multi_turn 취급) 테스트를 추가한다.

---

### [INFO] 프론트엔드 — execution-store 의 presentations 타입 re-export 에 대한 테스트 없음
- **위치**: `/codebase/frontend/src/lib/stores/__tests__/execution-store.test.ts`
- **상세**: `execution-store.ts` 에 `PresentationType`, `PresentationPayload`, `PresentationPayloadTruncation` 를 re-export 하는 코드가 추가되었으나, `ConversationItem` 의 `presentations` 필드 처리 경로(WebSocket 이벤트 → store 상태 업데이트 → ConversationItem 변환)에 대한 테스트가 없다.
- **제안**: `execution-store.test.ts` 또는 `apply-execution-snapshot.test.ts` 에 `ai_message` 이벤트 페이로드에 `presentations` 가 포함될 때 `ConversationItem.presentations` 가 올바르게 설정되는 케이스를 추가한다.

---

### [INFO] conversation-utils.test.ts — presentations 테스트 대상이 `threadTurnsToConversationItems` 에 국한
- **위치**: `/codebase/frontend/src/lib/conversation/__tests__/conversation-utils.test.ts`
- **상세**: 추가된 2개 테스트('picks up presentations[] on ai_assistant turns', 'omits presentations field on ai_assistant turn without payloads')는 적절히 작성되었고 의도가 명확하다. 다만 `presentations` 가 `ai_user` 또는 `ai_tool` source 에 붙어 들어오는 잘못된 데이터가 있을 때 무시되는지(현재 구현은 `source === 'ai_assistant'` 분기에서만 처리)는 커버되지 않는다.
- **제안**: `source: 'ai_user'` 턴에 `presentations` 가 있어도 변환된 ConversationItem 에 `presentations` 가 없음을 확인하는 케이스를 추가한다.

---

## 요약

핵심 신규 기능인 `render_*` 도구 패밀리에 대해 **RenderToolProvider 단위 테스트**(`render-tool-provider.spec.ts`)와 **스키마 유효성 테스트**(`ai-agent.schema.spec.ts`), **대화 유틸 변환 테스트**(`conversation-utils.test.ts`)가 신설되어 단위 레벨에서의 기반은 잘 갖춰져 있다. 그러나 **가장 복잡한 orchestration 계층인 `AiAgentHandler`** 에서 `render_*` 디스패치·누적·retry·silent-drop 전체 흐름을 검증하는 테스트가 전무하며, **프론트엔드 렌더러 컴포넌트**(`AssistantPresentationsBlock`)에 대한 테스트도 존재하지 않는다. `conversation-thread.service` 의 `presentations` 파라미터 전달 경로도 미커버 상태다. 이 세 가지 갭은 핵심 동작 경로를 보호하지 못하므로 회귀 위험이 존재한다. `overlayDefaults` 의 `null` 입력 엣지 케이스, chart/template 의 1MB cap schema_violation 경로도 보완이 필요하다.

---

## 위험도

**MEDIUM**

> RenderToolProvider 단위 테스트 자체는 충실하나, 핸들러 레벨의 통합 디스패치 경로와 프론트엔드 렌더러가 테스트 없이 출시되면, `presentationPayloads` 누적 로직 또는 `presentations` 필드 전달 시 회귀가 발생해도 테스트가 포착하지 못한다.
