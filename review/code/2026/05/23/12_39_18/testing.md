# Testing Review — AI Agent render_* 버튼 클릭 user-message 합성

## 발견사항

### **[WARNING]** `render-tool-provider.spec.ts` 에 `userMessage` 보존 테스트 누락
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.spec.ts`
- 상세: plan `(C) backend` 항목은 "userMessage 가 schema 에서 보존되는 케이스 (LLM emit) + 미지정 케이스 (그대로 통과) 단위 테스트"를 명시하고 있다. 그러나 실제 `render-tool-provider.spec.ts` 에는 `userMessage` 를 직접 검증하는 테스트가 없다. `carousel`, `table`, `chart`, `template` 의 `buttonDefSchema` 에 `userMessage` 필드가 추가되었고 각 노드별 스키마 spec 파일에는 개별 보존 테스트가 있지만, `render-tool-provider.execute` 를 통해 실제 LLM 페이로드가 전달될 때 `presentationPayload.payload.buttons[].userMessage` 가 보존되는지 end-to-end 로 검증하는 케이스가 없다. backfill(`backfillButtonUuids`) 이 `userMessage` 를 삭제하지 않는다는 보증도 없다.
- 제안: 다음 케이스를 `render-tool-provider.spec.ts` 에 추가한다.
  1. `render_carousel` execute 시 `items[].buttons[].userMessage` 가 `presentationPayload.payload` 에 보존되는지 검증.
  2. `render_table` execute 시 `buttons[].userMessage` 보존 검증.
  3. `backfillButtonUuids` 가 `userMessage` 필드를 제거하지 않는다는 회귀 테스트.

### **[WARNING]** `button.types.spec.ts` — `validateButtons` 에 `userMessage` 필드 통과 테스트 누락
- 위치: `/codebase/backend/src/nodes/presentation/_shared/button.types.spec.ts`
- 상세: `ButtonDef` 인터페이스에 `userMessage?: string` 이 추가되었지만 `validateButtons` 함수 테스트에 `userMessage` 를 가진 버튼이 pass 하는 케이스가 없다. `validateButtons` 는 `userMessage` 를 명시적으로 처리하지 않으므로 `.passthrough()` 등 zod 와 달리 자동으로 무시되며, 혹시 미래에 유효성 로직이 추가될 때 회귀 방지 기준선이 없다.
- 제안: `validateButtons({ buttons: [{ id: 'a', label: 'X', type: 'port', userMessage: 'hello' }] })` 가 `[]` 를 반환하는 테스트 1건 추가. `link` 타입에 `userMessage` 가 있어도 에러 없이 통과하는 테스트도 추가 권장 (spec §1.1 "무시, warning 아님" 보증).

### **[WARNING]** `findButtonContext` — `items` 가 `data` 직속이면서 `data.config.itemButtons` 가 동시에 존재하는 복합 케이스 미검증
- 위치: `/codebase/frontend/src/components/editor/run-results/__tests__/assistant-presentations-block.test.tsx`
- 상세: `findButtonContext` 의 검색 우선순위는 (1) `items[].buttons` → (2) `config.itemButtons` → (3) `config.buttonConfig.buttons` 이다. 현재 테스트는 각 경로를 독립적으로 검증하지만, `items[].buttons` 와 `config.itemButtons` 가 같은 buttonId 에 대해 동시에 정의된 경우(dynamic 모드에서 static 아이템 fallback 이 혼재하는 경우) 어느 경로가 먼저 반환되는지 테스트가 없다. 우선순위 버그가 숨어 있을 경우 실사용 환경에서만 발견될 수 있다.
- 제안: `items[].buttons` 에 동일 id 가 있을 때 `config.itemButtons` 보다 먼저 반환됨을 확인하는 테스트 1건 추가.

### **[WARNING]** `AssistantPresentationsBlock` 통합 테스트 — global 버튼 + dynamic runtime ID 클릭 경로 미검증
- 위치: `/codebase/frontend/src/components/editor/run-results/__tests__/assistant-presentations-block.test.tsx`, 파일 끝 Note 주석
- 상세: 파일 하단 Note 에 "global 버튼 / dynamic runtime ID 의 합성 동작은 unit-level `composeUserMessage` / `findButtonContext` 테스트가 분리 검증한다 (integration 중복 회피)"라고 기술되어 있다. unit 테스트가 충분하므로 의도적 생략이며 타당하나, `handlePortButtonClick` 내에서 `findButtonContext` → `composeUserMessage` 가 실제로 연결되어 호출되는 경로의 검증은 integration 2 케이스(carousel per-item 고정)에만 한정된다. `onSendMessage` 가 `undefined` 일 때 함수가 early-return 하는 방어 로직도 테스트되지 않는다.
- 제안: `onSendMessage` prop 을 전달하지 않은 상태에서 버튼 클릭 시 예외가 발생하지 않는 smoke 테스트 1건 추가 (회귀 방지). global 버튼 클릭(`buttonConfig.buttons` 경로) → `label` 단독 발화 검증은 unit 으로 충분하다는 판단을 유지해도 무방하나 주석에 명시적으로 기재하면 가독성이 향상된다.

### **[INFO]** carousel spec 테스트 — `itemButtons` (dynamic 모드) `userMessage` 가 빈 문자열일 때 처리 미검증
- 위치: `/codebase/backend/src/nodes/presentation/carousel/carousel.schema.spec.ts`
- 상세: `composeUserMessage` 에서 `userMessage` 가 빈 문자열이면 무시하도록 구현되어 있고 frontend 단에서 단위 테스트로 검증된다. 그러나 backend zod schema 수준에서 빈 문자열 `userMessage` 를 parse 했을 때 `undefined` 로 strip 하지 않고 그대로 `""` 로 보존한다는 사실은 명시적으로 테스트되지 않는다. 이 비일관성이 frontend 에서 예상대로 동작하려면 빈 문자열 체크가 항상 frontend 에 위임되어야 하는데, backend 가 이를 strip 하도록 schema 를 변경할 경우 silent regression 이 발생할 수 있다.
- 제안: carousel schema spec 에 `userMessage: ""` 를 parse 하면 `""` 가 보존된다는 테스트 1건 추가 (현행 동작을 고정하는 회귀 기준선).

### **[INFO]** chart/table/template spec — 단일 `it` 블록 안에 두 개의 별개 assertion 혼합
- 위치: `/codebase/backend/src/nodes/presentation/chart/chart.schema.spec.ts`, `/codebase/backend/src/nodes/presentation/table/table.schema.spec.ts`, `/codebase/backend/src/nodes/presentation/template/template.schema.spec.ts` — 각 `buttonDefSchema — userMessage` 블록 내 단일 `it`
- 상세: 각 파일의 `userMessage` 테스트 블록이 `it('preserves userMessage ... and exposes it in JSON Schema', ...)` 하나에 "parse 값 보존"과 "JSON Schema 노출" 두 가지 assertion 을 묶고 있다. 두 assertion 중 하나가 실패하면 다른 실패 원인이 숨겨진다.
- 제안: carousel spec 처럼 관심사를 분리하거나, 최소한 설명을 "preserves userMessage and exposes it in JSON Schema"로 명확히 구분할 것. carousel 의 경우 5개 `it` 블록으로 분리된 반면 chart/table/template 은 1개 블록에 통합하여 커버리지 수준의 불일치가 있다. 중요도는 낮으나 일관성을 위해 분리를 권장한다.

### **[INFO]** `userMessage` 최대 길이 검증 케이스 없음
- 위치: 모든 schema 파일 (`carousel.schema.ts`, `chart.schema.ts`, `table.schema.ts`, `template.schema.ts`)
- 상세: `userMessage` 가 `z.string().optional()` 로만 정의되어 있어 최대 길이 제한이 없다. LLM 이 극단적으로 긴 문자열을 emit 할 경우 채팅 UI 에서 예상치 못한 렌더링 문제가 발생할 수 있다. 현재 테스트에 이 경계값 케이스가 없다.
- 제안: spec 에 최대 길이 제한이 정의되어 있지 않다면 현행 무제한 정책을 명시적으로 기록하고, 향후 제한 추가 시 테스트를 함께 추가할 것. 현재로서는 INFO 수준.

---

## 요약

이번 변경은 TDD 원칙을 충실히 따라 `findButtonContext`, `composeUserMessage` 핵심 로직에 대한 단위 테스트, 우선순위 시나리오별 분기 테스트, backend 4개 노드 스키마별 `userMessage` 보존 테스트를 선제적으로 추가하였다. 전반적으로 테스트 커버리지가 양호하며 테스트 가독성과 격리 수준도 높다. 주요 갭은 두 가지로 요약된다. 첫째, plan 에 명시된 `render-tool-provider.spec.ts` 내 `userMessage` 보존 테스트가 실제로 추가되지 않아, `execute` → `backfillButtonUuids` 파이프라인에서 필드가 소실되지 않는다는 end-to-end 보증이 없다. 둘째, `button.types.spec.ts` 에 `userMessage` 를 포함한 버튼이 `validateButtons` 를 통과하는 케이스가 없어 향후 해당 함수에 userMessage 관련 로직이 추가될 때 회귀 기준선이 부재한다. 이 두 항목은 WARNING 수준으로 보완이 필요하다.

## 위험도

MEDIUM
